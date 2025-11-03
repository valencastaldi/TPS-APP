from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from datetime import datetime, timezone
from typing import Optional
from app.db import get_session
from app.models import Payment, Invoice
from app.schemas import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("", response_model=PaymentResponse)
def create_payment(payload: PaymentCreate, session: Session = Depends(get_session)):
    """Registrar un pago para una factura"""
    # Verificar que la factura existe
    invoice = session.get(Invoice, payload.invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    # Crear el pago
    payment = Payment(
        invoice_id=payload.invoice_id,
        paid_at=datetime.now(timezone.utc),
        method=payload.method,
        amount=payload.amount,
        notes=payload.notes
    )
    session.add(payment)

    # Actualizar estado de la factura según pagos
    total_paid = session.exec(
        select(Payment).where(Payment.invoice_id == payload.invoice_id)
    ).all()
    total_amount = sum(p.amount for p in total_paid) + payload.amount

    if total_amount >= invoice.total:
        invoice.status = "pagado"
    elif total_amount > 0:
        invoice.status = "parcial"

    session.add(invoice)
    session.commit()
    session.refresh(payment)
    return payment

@router.get("", response_model=list[PaymentResponse])
def list_payments(
    invoice_id: int | None = None,
    session: Session = Depends(get_session)
):
    """Listar pagos, opcionalmente filtrados por factura"""
    query = select(Payment).order_by(Payment.paid_at.desc())

    if invoice_id:
        query = query.where(Payment.invoice_id == invoice_id)

    return session.exec(query).all()

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

    invoice_id = payment.invoice_id
    session.delete(payment)

    # Recalcular estado de la factura
    invoice = session.get(Invoice, invoice_id)
    if invoice:
        remaining_payments = session.exec(
            select(Payment).where(Payment.invoice_id == invoice_id)
        ).all()

        total_paid = sum(p.amount for p in remaining_payments)

        if total_paid >= invoice.total:
            invoice.status = "pagado"
        elif total_paid > 0:
            invoice.status = "parcial"
        else:
            invoice.status = "pendiente"

        session.add(invoice)

    session.commit()
    return {"ok": True}

@router.post("/register-bank-transfer")
def register_bank_transfer(
    invoice_id: int,
    amount: float,
    reference: str,
    notes: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Registrar un pago recibido por transferencia bancaria

    Cuando te llega una transferencia a tu cuenta bancaria:
    1. Ingresas el ID de la factura
    2. El monto que recibiste
    3. La referencia/número de operación
    4. El sistema marca automáticamente la factura como pagada
    """
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    # Crear el pago
    payment = Payment(
        invoice_id=invoice_id,
        paid_at=datetime.now(timezone.utc),
        method="transferencia",
        amount=amount,
        notes=f"Ref: {reference}. {notes or ''}"
    )
    session.add(payment)

    # Actualizar estado de factura
    total_paid = session.exec(
        select(Payment).where(Payment.invoice_id == invoice_id)
    ).all()
    total_amount = sum(p.amount for p in total_paid) + amount

    if total_amount >= invoice.total:
        invoice.status = "pagado"
    elif total_amount > 0:
        invoice.status = "parcial"

    session.add(invoice)
    session.commit()
    session.refresh(payment)

    return {
        "message": "Transferencia registrada exitosamente",
        "payment_id": payment.id,
        "invoice_status": invoice.status,
        "total_paid": total_amount,
        "invoice_total": invoice.total,
        "remaining": max(0, invoice.total - total_amount)
    }

@router.post("/register-cash")
def register_cash_payment(
    invoice_id: int,
    amount: float,
    notes: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Registrar un pago en efectivo

    Cuando recibes efectivo de un cliente, registras aquí:
    - ID de la factura
    - Monto recibido
    - El sistema actualiza automáticamente el estado
    """
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    payment = Payment(
        invoice_id=invoice_id,
        paid_at=datetime.now(timezone.utc),
        method="efectivo",
        amount=amount,
        notes=notes
    )
    session.add(payment)

    # Actualizar estado
    total_paid = session.exec(
        select(Payment).where(Payment.invoice_id == invoice_id)
    ).all()
    total_amount = sum(p.amount for p in total_paid) + amount

    if total_amount >= invoice.total:
        invoice.status = "pagado"
    elif total_amount > 0:
        invoice.status = "parcial"

    session.add(invoice)
    session.commit()
    session.refresh(payment)

    return {
        "message": "Pago en efectivo registrado",
        "payment_id": payment.id,
        "invoice_status": invoice.status,
        "total_paid": total_amount,
        "invoice_total": invoice.total,
        "remaining": max(0, invoice.total - total_amount)
    }

@router.get("/by-client/{client_id}")
def get_payments_by_client(client_id: int, session: Session = Depends(get_session)):
    """
    Ver todos los pagos de un cliente específico
    Útil para ver el historial de pagos de un cliente
    """
    from app.models import Invoice

    # Obtener todas las facturas del cliente
    invoices = session.exec(
        select(Invoice).where(Invoice.client_id == client_id)
    ).all()

    if not invoices:
        return []

    invoice_ids = [inv.id for inv in invoices]

    # Obtener todos los pagos de esas facturas
    payments = session.exec(
        select(Payment).where(Payment.invoice_id.in_(invoice_ids))
        .order_by(Payment.paid_at.desc())
    ).all()

    return payments

