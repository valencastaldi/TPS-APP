"""
Matcher inteligente de pagos huérfanos a facturas pendientes.

Cuando llega una transferencia al CBU/CVU de MercadoPago, el webhook recibe
el evento pero el payload NO trae `external_reference: invoice_X` porque
el cliente no usó un link de pago. Hay que adivinar a qué factura corresponde.

Este servicio rankea facturas candidatas usando varios factores y devuelve
un score 0..1 por candidata. Si el mejor candidato supera un threshold y
está suficientemente lejos del segundo, el webhook puede auto-asignar.

Factores que aportan al score:
  - Monto exacto (peso 0.50)
  - Saldo pendiente exacto (si factura ya tiene pago parcial, peso 0.40)
  - Nombre del payer ~ nombre del cliente, fuzzy match (peso 0..0.30)
  - DNI del payer == "12345678" en notas/identification del cliente (peso 0.20)
  - Factura vence pronto / acaba de vencer (peso 0..0.10)
  - Cliente activo (penaliza inactivos: -0.20)

Threshold default:
  - Auto-asignar si: best_score >= 0.85 Y (best_score - second_score) >= 0.20
  - Si no, devolvemos candidatas rankeadas para revisión manual en el panel.
"""
from __future__ import annotations

import unicodedata
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Optional, Tuple

from sqlmodel import Session, select

from app.models import Client, Invoice, Payment


# ── Tuneables ───────────────────────────────────────────────────────────────
AUTO_MATCH_THRESHOLD = 0.80          # score mínimo cuando hay varios candidatos
AUTO_MATCH_THRESHOLD_SINGLE = 0.70   # más laxo si hay un solo candidato (sin ambigüedad posible)
AUTO_MATCH_GAP = 0.20                # diferencia mínima entre #1 y #2 para considerar match único


@dataclass
class CandidateMatch:
    invoice: Invoice
    client: Client
    score: float
    reasons: List[str]            # explicación humana de por qué este match
    pending_amount: float          # cuánto le falta pagar a la factura

    def to_dict(self) -> dict:
        return {
            "invoice_id": self.invoice.id,
            "client_id": self.client.id,
            "client_name": self.client.name,
            "period": self.invoice.period,
            "total": self.invoice.total,
            "pending_amount": self.pending_amount,
            "due_date": self.invoice.due_date.isoformat() if self.invoice.due_date else None,
            "status": self.invoice.status,
            "score": round(self.score, 3),
            "reasons": self.reasons,
        }


# ── Utilidades ──────────────────────────────────────────────────────────────
def _normalize(s: str) -> str:
    """Lower + sin acentos + sin puntuación, para comparar nombres."""
    s = unicodedata.normalize("NFKD", s).encode("ASCII", "ignore").decode("ASCII")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _name_similarity(payer_name: str, client_name: str) -> float:
    """Score 0..1 de similitud entre nombres.

    Estrategia simple sin dependencias externas:
      - Tokenizamos ambos nombres
      - Contamos cuántos tokens del payer aparecen en el cliente (Jaccard sobre tokens)
      - Bonus si el primer token (probablemente nombre) coincide
    """
    if not payer_name or not client_name:
        return 0.0

    np = set(_normalize(payer_name).split())
    nc = set(_normalize(client_name).split())
    if not np or not nc:
        return 0.0

    # Jaccard
    inter = np & nc
    union = np | nc
    jaccard = len(inter) / len(union)

    # Bonus si hay al menos un token compartido de longitud >=4
    significant = any(len(t) >= 4 for t in inter)
    bonus = 0.15 if significant else 0.0

    return min(1.0, jaccard + bonus)


def _invoice_pending_amount(session: Session, invoice: Invoice) -> float:
    """Total - suma de pagos previos de esa factura."""
    pagos = session.exec(select(Payment).where(Payment.invoice_id == invoice.id)).all()
    pagado = sum(p.amount for p in pagos)
    return round(invoice.total - pagado, 2)


def _days_to_due(invoice: Invoice, today: Optional[date] = None) -> int:
    """Días hasta el vencimiento. Si no hay due_date, devolvemos un número grande
    para que el factor 'vencimiento próximo' no se active (no rompe el flujo)."""
    if invoice.due_date is None:
        return 9999
    today = today or date.today()
    return (invoice.due_date - today).days


# ── API pública ─────────────────────────────────────────────────────────────
def find_candidates(
    session: Session,
    amount: float,
    payer_name: Optional[str] = None,
    payer_dni: Optional[str] = None,
    top_n: int = 5,
) -> List[CandidateMatch]:
    """Devuelve hasta `top_n` facturas candidatas, rankeadas por score descendente.

    Considera solo facturas con status in ("pendiente", "parcial", "vencido").
    """
    today = date.today()
    payer_name_norm = _normalize(payer_name) if payer_name else ""

    # 🛡️ Guard #1: nunca matcheamos montos <=0 (data ruidosa o webhooks malformados)
    if amount is None or amount <= 0:
        return []

    # 🛡️ Guard #2: aceptar payer_dni como int o str (MP a veces lo manda como número)
    payer_dni_str: Optional[str] = str(payer_dni) if payer_dni is not None else None

    # Traer todas las facturas no pagadas + sus clientes
    invoices = session.exec(
        select(Invoice).where(Invoice.status.in_(("pendiente", "parcial", "vencido")))
    ).all()

    candidates: List[CandidateMatch] = []
    for inv in invoices:
        client = session.get(Client, inv.client_id)
        if not client:
            continue

        # 🛡️ Guard #3: clientes inactivos NUNCA son candidatos
        # (antes restaba 0.20, pero un match fuerte podía ganar igual y
        # auto-asignar a un cliente desactivado — bug #4 del audit).
        if not client.is_active:
            continue

        # 🛡️ Guard #4: facturas con total <=0 no se matchean
        # (evita el caso de las 105 facturas legacy con total=0 que daban
        # falsos positivos con cualquier monto cercano a 0).
        if inv.total is None or inv.total <= 0:
            continue

        pending = _invoice_pending_amount(session, inv)
        reasons: List[str] = []
        score = 0.0

        # ── Monto ────────────────────────────────────────────────────
        # Match con total: si nunca se pagó nada (status=pendiente)
        if abs(inv.total - amount) < 0.01:
            score += 0.50
            reasons.append(f"Monto exacto al total (${inv.total:.2f})")
        elif abs(pending - amount) < 0.01 and pending > 0:
            # Match con saldo pendiente: si la factura ya tenía pago parcial
            score += 0.40
            reasons.append(f"Monto exacto al saldo pendiente (${pending:.2f})")
        elif inv.total > 0 and 0.95 <= amount / inv.total <= 1.05:
            # Tolerancia 5% (por si MP retiene comisiones)
            score += 0.20
            reasons.append(f"Monto cercano (~{int(amount/inv.total*100)}% del total)")
        else:
            # Sin match de monto, score base muy bajo
            continue  # descartamos esta factura, no aporta

        # ── Nombre del payer vs nombre del cliente ───────────────────
        if payer_name_norm:
            sim = _name_similarity(payer_name, client.name)
            if sim >= 0.7:
                score += 0.30
                reasons.append(f"Nombre coincide fuerte ({client.name})")
            elif sim >= 0.4:
                score += 0.15
                reasons.append(f"Nombre similar ({client.name})")
            elif sim > 0:
                score += 0.05
                reasons.append(f"Algún token de nombre coincide")

        # ── DNI ──────────────────────────────────────────────────────
        # Hoy Client no tiene campo DNI, pero a veces el alias o teléfono
        # contienen el DNI. Match permisivo. Convertimos a str porque MP
        # a veces manda identification.number como int.
        if payer_dni_str:
            stash = " ".join(filter(None, [client.phone, client.whatsapp]))
            if payer_dni_str in stash:
                score += 0.20
                reasons.append(f"DNI {payer_dni_str} en datos del cliente")

        # ── Cercanía al vencimiento ──────────────────────────────────
        days = _days_to_due(inv, today)
        if -3 <= days <= 10:
            score += 0.10
            reasons.append("Vencimiento próximo o reciente")
        elif inv.status == "vencido":
            score += 0.03  # ligera preferencia por levantar vencidas
            reasons.append("Factura vencida")

        score = max(0.0, min(1.0, score))
        candidates.append(CandidateMatch(
            invoice=inv,
            client=client,
            score=score,
            reasons=reasons,
            pending_amount=pending,
        ))

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates[:top_n]


def decide_auto_match(candidates: List[CandidateMatch]) -> Optional[CandidateMatch]:
    """Política de auto-match: asignamos solos si:
      - hay 1 solo candidato Y su score >= 0.70 (sin ambigüedad posible)
      - O hay varios, el mejor tiene score >= 0.80 Y le saca al menos 0.20 al segundo

    Returns el candidato a auto-asignar, o None si hay que dejarlo huérfano.
    """
    if not candidates:
        return None

    best = candidates[0]

    # Caso 1: único candidato. Sin ambigüedad, más laxos con el threshold.
    if len(candidates) == 1:
        return best if best.score >= AUTO_MATCH_THRESHOLD_SINGLE else None

    # Caso 2: varios candidatos. Más estricto.
    if best.score < AUTO_MATCH_THRESHOLD:
        return None

    second = candidates[1]
    if (best.score - second.score) < AUTO_MATCH_GAP:
        return None  # demasiado parecidos, mejor revisar a mano

    return best
