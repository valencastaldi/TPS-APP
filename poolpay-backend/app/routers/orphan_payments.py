"""Endpoints para gestionar pagos huérfanos (transferencias al CBU que no se
pudieron auto-asociar a una factura).

Flujo típico de uso:
  1. GET /orphan-payments         → lista los pendientes de revisión
  2. GET /orphan-payments/{id}    → ve el detalle con sugerencias rankeadas
  3. POST /orphan-payments/{id}/assign?invoice_id=X
                                   → confirma la asignación: crea Payment real
  4. POST /orphan-payments/{id}/discard
                                   → descarta (ej: pago de prueba, no era para nosotros)
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from pydantic import BaseModel

from app.db import get_session
from app.models import Invoice, Payment, OrphanPayment
from app.services.billing import recalculate_invoice_status
from app.services.payment_matcher import find_candidates


router = APIRouter(prefix="/orphan-payments", tags=["orphan-payments"])


# ── Schemas de respuesta ────────────────────────────────────────────────────
class CandidateOut(BaseModel):
    invoice_id: int
    client_id: int
    client_name: str
    period: str
    total: float
    pending_amount: float
    due_date: Optional[str]
    status: str
    score: float
    reasons: List[str]


class OrphanPaymentSummary(BaseModel):
    id: int
    mp_payment_id: str
    amount: float
    paid_at: datetime
    payer_name: Optional[str]
    payer_dni: Optional[str]
    payment_type: Optional[str]
    payment_method: Optional[str]
    status: str
    created_at: datetime
    top_candidate_score: Optional[float] = None
    top_candidate_client: Optional[str] = None


class OrphanPaymentDetail(BaseModel):
    id: int
    mp_payment_id: str
    amount: float
    paid_at: datetime
    payer_name: Optional[str]
    payer_dni: Optional[str]
    payment_type: Optional[str]
    payment_method: Optional[str]
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    assigned_invoice_id: Optional[int] = None
    assigned_payment_id: Optional[int] = None
    candidates: List[CandidateOut]


# ── GET list ────────────────────────────────────────────────────────────────
@router.get("", response_model=List[OrphanPaymentSummary])
def list_orphans(
    status: Optional[str] = Query(default="pending_review", description="pending_review, assigned, discarded, all"),
    session: Session = Depends(get_session),
):
    """Lista pagos huérfanos. Por default solo los pendientes de revisión.

    Para cada huérfano agrega 'top_candidate_*' para que el frontend pueda
    mostrar un preview rápido del mejor match sugerido.
    """
    q = select(OrphanPayment)
    if status and status != "all":
        q = q.where(OrphanPayment.status == status)
    q = q.order_by(OrphanPayment.created_at.desc())

    orphans = session.exec(q).all()
    result = []
    for o in orphans:
        top_score = None
        top_client = None
        if o.status == "pending_review":
            cands = find_candidates(session, o.amount, o.payer_name, o.payer_dni, top_n=1)
            if cands:
                top_score = round(cands[0].score, 3)
                top_client = cands[0].client.name
        result.append(OrphanPaymentSummary(
            id=o.id,
            mp_payment_id=o.mp_payment_id,
            amount=o.amount,
            paid_at=o.paid_at,
            payer_name=o.payer_name,
            payer_dni=o.payer_dni,
            payment_type=o.payment_type,
            payment_method=o.payment_method,
            status=o.status,
            created_at=o.created_at,
            top_candidate_score=top_score,
            top_candidate_client=top_client,
        ))
    return result


# ── GET detail ──────────────────────────────────────────────────────────────
@router.get("/{orphan_id}", response_model=OrphanPaymentDetail)
def get_orphan(orphan_id: int, session: Session = Depends(get_session)):
    o = session.get(OrphanPayment, orphan_id)
    if not o:
        raise HTTPException(404, "Orphan payment no encontrado")

    candidates_data = []
    if o.status == "pending_review":
        cands = find_candidates(session, o.amount, o.payer_name, o.payer_dni, top_n=5)
        candidates_data = [c.to_dict() for c in cands]

    return OrphanPaymentDetail(
        id=o.id,
        mp_payment_id=o.mp_payment_id,
        amount=o.amount,
        paid_at=o.paid_at,
        payer_name=o.payer_name,
        payer_dni=o.payer_dni,
        payment_type=o.payment_type,
        payment_method=o.payment_method,
        status=o.status,
        created_at=o.created_at,
        resolved_at=o.resolved_at,
        assigned_invoice_id=o.assigned_invoice_id,
        assigned_payment_id=o.assigned_payment_id,
        candidates=candidates_data,
    )


# ── POST assign ─────────────────────────────────────────────────────────────
@router.post("/{orphan_id}/assign")
def assign_orphan(
    orphan_id: int,
    invoice_id: int = Query(..., description="ID de la factura a la que se aplica este pago"),
    session: Session = Depends(get_session),
):
    """Asigna un pago huérfano a una factura específica (acción manual del usuario).

    Crea el Payment real, marca el huérfano como 'assigned' y recalcula el estado
    de la factura.
    """
    o = session.get(OrphanPayment, orphan_id)
    if not o:
        raise HTTPException(404, "Orphan payment no encontrado")
    if o.status != "pending_review":
        raise HTTPException(400, f"Este huérfano ya fue resuelto (status={o.status})")

    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, f"Invoice {invoice_id} no encontrada")

    payment = Payment(
        invoice_id=invoice_id,
        paid_at=o.paid_at,
        method="mercado_pago",
        amount=o.amount,
        notes=(
            f"MP Payment ID: {o.mp_payment_id} | "
            f"tipo: {o.payment_type or 'N/A'} | "
            f"vía: asignación manual desde huérfano #{o.id} | "
            f"payer: {o.payer_name or 'N/A'}"
        ),
    )
    session.add(payment)
    session.flush()
    recalculate_invoice_status(session, invoice)

    o.status = "assigned"
    o.assigned_invoice_id = invoice_id
    o.assigned_payment_id = payment.id
    o.resolved_at = datetime.now(timezone.utc)
    session.add(o)
    session.commit()

    return {
        "ok": True,
        "orphan_id": o.id,
        "payment_id": payment.id,
        "invoice_id": invoice_id,
        "invoice_status": invoice.status,
    }


# ── POST discard ────────────────────────────────────────────────────────────
@router.post("/{orphan_id}/discard")
def discard_orphan(
    orphan_id: int,
    reason: Optional[str] = Query(default=None, description="Motivo del descarte (opcional)"),
    session: Session = Depends(get_session),
):
    """Descarta un huérfano sin crear Payment (ej: pago que no era para nosotros)."""
    o = session.get(OrphanPayment, orphan_id)
    if not o:
        raise HTTPException(404, "Orphan payment no encontrado")
    if o.status != "pending_review":
        raise HTTPException(400, f"Este huérfano ya fue resuelto (status={o.status})")

    o.status = "discarded"
    o.resolved_at = datetime.now(timezone.utc)
    if reason:
        o.raw = (o.raw or "") + f"\n\n[DESCARTADO] {reason}"
    session.add(o)
    session.commit()
    return {"ok": True, "orphan_id": o.id, "status": o.status}


# ── GET counter (para badge en sidebar) ─────────────────────────────────────
@router.get("/stats/pending-count", response_model=dict)
def pending_count(session: Session = Depends(get_session)):
    n = len(session.exec(
        select(OrphanPayment).where(OrphanPayment.status == "pending_review")
    ).all())
    return {"pending": n}
