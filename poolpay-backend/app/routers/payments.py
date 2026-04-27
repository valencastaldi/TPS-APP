from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from datetime import datetime, timezone
from typing import Optional
from app.db import get_session
from app.models import Payment, Invoice
from app.schemas import PaymentCreate, PaymentResponse
from app.services.billing import recalculate_invoice_status

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentResponse)
def create_payment(payload: PaymentCreate, session: Session = Depends(get_session)):
    """Registrar un pago para una factura"""
    invoice = session.get(Invoice, payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    payment = Payment(
        invoice_id=payload.invoice_id,
        paid_at=datetime.now(timezone.utc),
        method=payload.method,
        amount=payload.amount,
        notes=payload.notes,
    )
    session.add(payment)
    session.flush()  # persiste el pago sin commitear para que lo lea recalculate

    recalculate_invoice_status(session, invoice)
    session.commit()
    session.refresh(payment)
    return payment


@router.get("", response_model=list[PaymentResponse])
def list_payments(
    invoice_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """Listar pagos, opcionalmente filtrados por factura"""
    query = select(Payment).order_by(Payment.paid_at.desc())
    if invoice_id:
        query = query.where(Payment.invoice_id == invoice_id)
    return session.exec(query).all()


@router.get("/by-client/{client_id}", response_model=list[PaymentResponse])
def get_payments_by_client(client_id: int, session: Session = Depends(get_session)):
    """Ver todos los pagos de un cliente específico"""
    from app.models import Invoice as Inv

    invoices = session.exec(select(Inv).where(Inv.client_id == client_id)).all()
    if not invoices:
        return []

    invoice_ids = [inv.id for inv in invoices]
    return session.exec(
        select(Payment)
        .where(Payment.invoice_id.in_(invoice_ids))
        .order_by(Payment.paid_at.desc())
    ).all()


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, session: Session = Depends(get_session)):
    """Obtener un pago específico"""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pago no encontrado")
    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, session: Session = Depends(get_session)):
    """Eliminar un pago y recalcular estado de la factura"""
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pago no encontrado")

    invoice = session.get(Invoice, payment.invoice_id)
    session.delete(payment)
    session.flush()

    if invoice:
        recalculate_invoice_status(session, invoice)

    session.commit()
    return {"ok": True}
