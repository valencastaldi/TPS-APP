import os
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr

from app.db import get_session
from app.auth import require_auth
from app.models import Invoice, Payment, Client, ProcessedMpPayment, OrphanPayment
from app.services.mercadopago_service import MercadoPagoService
from app.services.billing import recalculate_invoice_status
from app.services.payment_matcher import find_candidates, decide_auto_match

logger = logging.getLogger("poolpay.mercadopago")

router = APIRouter(prefix="/mercadopago", tags=["mercadopago"])

# ── Config ──────────────────────────────────────────────────────────────────
# Secret para validar la firma del webhook. Se obtiene en el panel de MP
# "Configurar notificaciones > Webhooks > Generar clave secreta".
MP_WEBHOOK_SECRET = os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "").strip()
# En dev (localhost) la firma no se valida porque MP no llega a tu PC.
MP_VERIFY_SIGNATURE = os.getenv("MP_VERIFY_SIGNATURE", "false").lower() in ("1", "true", "yes")


class CreatePaymentLinkRequest(BaseModel):
    invoice_id: int
    client_email: EmailStr
    description: Optional[str] = None


class PaymentLinkResponse(BaseModel):
    success: bool
    payment_link: Optional[str] = None
    preference_id: Optional[str] = None
    error: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────────────────────
def _verify_mp_signature(request: Request, body_bytes: bytes) -> bool:
    """Valida el header `x-signature` de MercadoPago.

    MP firma con HMAC-SHA256 sobre un manifest del estilo:
        id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    """
    if not MP_VERIFY_SIGNATURE:
        return True
    if not MP_WEBHOOK_SECRET:
        logger.warning("MP_VERIFY_SIGNATURE=true pero MERCADOPAGO_WEBHOOK_SECRET vacío. Rechazo el webhook.")
        return False

    sig_header = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    if not sig_header or not request_id:
        logger.warning("Webhook MP sin x-signature/x-request-id.")
        return False

    parts = dict(p.strip().split("=", 1) for p in sig_header.split(",") if "=" in p)
    ts = parts.get("ts")
    v1 = parts.get("v1")
    if not ts or not v1:
        logger.warning("Webhook MP con x-signature mal formado.")
        return False

    try:
        body = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        body = {}
    data_id = str(body.get("data", {}).get("id") or body.get("id") or "")

    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    expected = hmac.new(
        MP_WEBHOOK_SECRET.encode("utf-8"),
        manifest.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, v1):
        logger.warning("Firma de MP no coincide. Posible request falso.")
        return False
    return True


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.post("/create-payment-link", response_model=PaymentLinkResponse, dependencies=[Depends(require_auth)])
async def create_payment_link(
    request: CreatePaymentLinkRequest,
    session: Session = Depends(get_session),
):
    """Crear un link de pago MercadoPago para una factura."""
    invoice = session.get(Invoice, request.invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    result = MercadoPagoService.create_payment_link(
        title=f"Factura #{invoice.id} - Período {invoice.period}",
        amount=invoice.total,
        client_email=request.client_email,
        external_reference=f"invoice_{invoice.id}",
        description=request.description,
    )
    if result["success"]:
        return PaymentLinkResponse(
            success=True,
            payment_link=result["init_point"],
            preference_id=result["preference_id"],
        )
    return PaymentLinkResponse(success=False, error=result.get("error", "Error desconocido"))


@router.post("/webhook")
async def mercadopago_webhook(request: Request, session: Session = Depends(get_session)):
    """Webhook de MercadoPago — registra pagos aprobados de forma idempotente."""
    body_bytes = await request.body()

    if not _verify_mp_signature(request, body_bytes):
        # Devolvemos 401 para que MP reintente, pero log para que veas el rechazo.
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body_bytes.decode("utf-8") or "{}")
    except Exception:
        data = {}

    notification_type = data.get("type") or data.get("topic")
    logger.info("[webhook MP] type=%s body=%s", notification_type, data)

    if notification_type != "payment":
        return {"status": "ignored", "reason": f"tipo no soportado: {notification_type}"}

    payment_id = data.get("data", {}).get("id") or data.get("id")
    if not payment_id:
        return {"status": "error", "message": "No payment_id en payload"}
    payment_id = str(payment_id)

    # ── Idempotencia: si ya fue procesado, salir ────────────────────────────
    already = session.exec(
        select(ProcessedMpPayment).where(ProcessedMpPayment.mp_payment_id == payment_id)
    ).first()
    if already:
        logger.info("[webhook MP] payment_id=%s ya procesado, ignoro.", payment_id)
        return {"status": "ok", "message": "duplicado", "mp_payment_id": payment_id}

    # ── Consultar el pago en MP ─────────────────────────────────────────────
    payment_info = MercadoPagoService.get_payment_info(payment_id)
    if not payment_info["success"]:
        logger.error("[webhook MP] no pude consultar pago %s: %s", payment_id, payment_info.get("error"))
        raise HTTPException(502, "MercadoPago consulta fallida")

    pdata = payment_info["payment"]
    status = pdata.get("status")
    external_ref = pdata.get("external_reference", "") or ""
    amount = float(pdata.get("transaction_amount") or 0.0)

    invoice_id_db: Optional[int] = None
    payment_db_id: Optional[int] = None
    orphan_id_db: Optional[int] = None
    match_mode = "none"  # "link" | "auto_smart" | "orphan" | "none"

    # Estados FINALES de MP (no van a cambiar) — solo estos los marcamos como procesados.
    # Los no-finales (pending, in_process, authorized) los dejamos para reprocesar
    # cuando MP nos avise el siguiente estado.
    FINAL_STATUSES = {"approved", "rejected", "cancelled", "refunded", "charged_back"}

    if status == "approved":
        # 🛡️ Anti-forge: rechazá montos <=0 (no son pagos válidos)
        if amount <= 0:
            logger.warning(
                "[webhook MP] payment %s approved con monto inválido: %s. Ignoro.",
                payment_id, amount,
            )
            return {"status": "ignored", "reason": "amount<=0", "mp_payment_id": payment_id}

        # ── Camino 1: pago con LINK MP (external_reference="invoice_X") ───
        handled_via_link = False
        if external_ref.startswith("invoice_"):
            invoice_id: Optional[int] = None
            try:
                parsed = int(external_ref.replace("invoice_", ""))
                if parsed > 0:
                    invoice_id = parsed
            except ValueError:
                pass

            invoice = session.get(Invoice, invoice_id) if invoice_id else None
            if invoice:
                # 🛡️ Anti-forge: avisar si el monto está muy lejos del total
                if invoice.total > 0 and amount > invoice.total * 1.5:
                    logger.warning(
                        "[webhook MP] ⚠️ monto sospechoso para invoice=%s: pagado=%s vs total=%s "
                        "(>150%%). Se registra igual pero revisar.",
                        invoice_id, amount, invoice.total,
                    )

                payment = Payment(
                    invoice_id=invoice_id,
                    paid_at=datetime.now(timezone.utc),
                    method="mercado_pago",
                    amount=amount,
                    notes=(
                        f"MP Payment ID: {payment_id} | "
                        f"método: {pdata.get('payment_method_id', 'N/A')} | "
                        f"tipo: {pdata.get('payment_type_id', 'N/A')} | "
                        f"vía: link MP"
                    ),
                )
                session.add(payment)
                session.flush()
                recalculate_invoice_status(session, invoice)
                invoice_id_db = invoice_id
                payment_db_id = payment.id
                match_mode = "link"
                handled_via_link = True
                logger.info(
                    "[webhook MP] ✅ Pago registrado vía link: invoice=%s mp_payment=%s monto=%s",
                    invoice_id, payment_id, amount,
                )
            else:
                # external_reference apuntaba a una invoice inválida/inexistente.
                # En vez de tragárnoslo, lo mandamos al flujo de huérfanos para que
                # no se pierda el pago real.
                logger.warning(
                    "[webhook MP] external_reference inválido o invoice inexistente (%s) → "
                    "lo mando al flujo de huérfanos para no perder el pago.",
                    external_ref,
                )

        # ── Camino 2: pago SIN link (transferencia al CBU/CVU) ────────────
        # Intentamos matchear automáticamente con scoring inteligente.
        # Entra acá si NO había external_reference, o si el camino link falló.
        if not handled_via_link:
            payer = pdata.get("payer") or {}
            first = (payer.get("first_name") or "").strip()
            last = (payer.get("last_name") or "").strip()
            payer_name = (f"{first} {last}").strip() or (payer.get("name") or None)
            ident = (payer.get("identification") or {})
            payer_dni = ident.get("number")

            logger.info(
                "[webhook MP] transferencia sin link: monto=%s payer=%r dni=%s — buscando candidatos",
                amount, payer_name, payer_dni,
            )

            candidates = find_candidates(session, amount, payer_name=payer_name, payer_dni=payer_dni)
            auto = decide_auto_match(candidates)

            if auto is not None:
                # ✅ Hay un candidato claramente ganador → auto-asignar
                payment = Payment(
                    invoice_id=auto.invoice.id,
                    paid_at=datetime.now(timezone.utc),
                    method="mercado_pago",
                    amount=amount,
                    notes=(
                        f"MP Payment ID: {payment_id} | "
                        f"tipo: {pdata.get('payment_type_id', 'N/A')} | "
                        f"vía: auto-match (score {auto.score:.2f}) | "
                        f"payer: {payer_name or 'N/A'}"
                    ),
                )
                session.add(payment)
                session.flush()
                recalculate_invoice_status(session, auto.invoice)
                invoice_id_db = auto.invoice.id
                payment_db_id = payment.id
                match_mode = "auto_smart"
                logger.info(
                    "[webhook MP] ✅ Auto-match: invoice=%s cliente=%s score=%.2f razones=%s",
                    auto.invoice.id, auto.client.name, auto.score, auto.reasons,
                )
            else:
                # 🟡 Sin match seguro → registrar como huérfano para revisión manual
                orphan = OrphanPayment(
                    mp_payment_id=str(payment_id),
                    amount=amount,
                    paid_at=datetime.now(timezone.utc),
                    payer_name=payer_name,
                    payer_dni=payer_dni,
                    payment_type=pdata.get("payment_type_id"),
                    payment_method=pdata.get("payment_method_id"),
                    raw=json.dumps(pdata, default=str)[:1900],
                    status="pending_review",
                )
                session.add(orphan)
                session.flush()
                orphan_id_db = orphan.id
                match_mode = "orphan"
                logger.info(
                    "[webhook MP] 🟡 Sin match seguro, guardado como huérfano: orphan_id=%s candidatos=%s",
                    orphan.id, [c.invoice.id for c in candidates],
                )
    else:
        logger.info("[webhook MP] payment %s status=%s — no aplica", payment_id, status)

    # ── Marcar como procesado SOLO si el estado es final ────────────────────
    # Si el estado es no-final (pending, in_process, authorized) NO marcamos,
    # así MP nos puede reenviar el siguiente estado y lo procesamos como nuevo.
    # Si lo marcáramos como procesado en pending, cuando llegue "approved"
    # lo rechazaríamos como duplicado y perderíamos el pago. BUG #14 del audit.
    if status in FINAL_STATUSES:
        try:
            raw_str = json.dumps(pdata, default=str)[:1900]
        except Exception:
            raw_str = None

        session.add(ProcessedMpPayment(
            mp_payment_id=payment_id,
            invoice_id=invoice_id_db,
            payment_id=payment_db_id,
            status=str(status or "unknown"),
            amount=amount,
            raw=raw_str,
        ))
        session.commit()
    else:
        # Estado no-final: commit lo que hayamos hecho (probablemente nada),
        # pero NO marcamos como procesado para permitir reintentos legítimos.
        logger.info(
            "[webhook MP] status=%s no es final, NO marco como procesado (esperando próximo estado)",
            status,
        )
        session.commit()

    return {
        "status": "ok",
        "mp_payment_id": payment_id,
        "mp_status": status,
        "invoice_id": invoice_id_db,
        "payment_id": payment_db_id,
        "orphan_id": orphan_id_db,
        "match_mode": match_mode,
    }


@router.get("/payment/{payment_id}", dependencies=[Depends(require_auth)])
async def get_payment_status(payment_id: str):
    """Consultar el estado de un pago de MercadoPago."""
    result = MercadoPagoService.get_payment_info(payment_id)
    if result["success"]:
        payment = result["payment"]
        return {
            "status": payment["status"],
            "status_detail": payment["status_detail"],
            "amount": payment["transaction_amount"],
            "payment_method": payment.get("payment_method_id"),
            "external_reference": payment.get("external_reference"),
        }
    raise HTTPException(500, result.get("error", "Error al consultar pago"))


class QuickPaymentRequest(BaseModel):
    client_id: int
    amount: float
    description: str


@router.post("/quick-payment", dependencies=[Depends(require_auth)])
async def create_quick_payment(
    request: QuickPaymentRequest,
    session: Session = Depends(get_session),
):
    """Crear un link de pago rápido sin factura (cobros eventuales)."""
    client = session.get(Client, request.client_id)
    if not client:
        raise HTTPException(404, "Cliente no encontrado")

    client_email = client.whatsapp or client.phone or "cliente@poolpay.com"
    if "@" not in client_email:
        client_email = f"{client_email}@poolpay.com"

    result = MercadoPagoService.create_payment_link(
        title=f"Cobro rápido - {client.name}",
        amount=request.amount,
        client_email=client_email,
        external_reference=f"quick_payment_{client.id}_{datetime.now().timestamp()}",
        description=request.description,
    )
    if result["success"]:
        return {
            "success": True,
            "payment_link": result["init_point"],
            "message": f"Link de pago creado para {client.name}",
        }
    raise HTTPException(500, result.get("error", "Error al crear link de pago"))
