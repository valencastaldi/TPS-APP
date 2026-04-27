from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from typing import Optional
from app.db import get_session
from app.models import Invoice, Payment
from app.schemas import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentResponse

router = APIRouter(prefix="/invoices", tags=["invoices"])

@router.post("", response_model=InvoiceResponse)
def create_invoice(payload: InvoiceCreate, session=Depends(get_session)):
    """Crear una factura manualmente"""
    invoice = Invoice(**payload.model_dump())
    invoice.total = invoice.subtotal + invoice.extras
    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return invoice

@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    client_id: Optional[int] = None,
    period: Optional[str] = None,
    status: Optional[str] = None,
    session=Depends(get_session)
):
    """Listar facturas con filtros opcionales"""
    query = select(Invoice)

    if client_id:
        query = query.where(Invoice.client_id == client_id)
    if period:
        query = query.where(Invoice.period == period)
    if status:
        query = query.where(Invoice.status == status)

    query = query.order_by(Invoice.due_date.desc())
    return session.exec(query).all()

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, session=Depends(get_session)):
    """Obtener una factura específica"""
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")
    return invoice

@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: int, payload: InvoiceUpdate, session=Depends(get_session)):
    """Actualizar una factura (extras, estado, fecha vencimiento)"""
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(invoice, key, value)

    # Recalcular total si cambiaron extras
    if payload.extras is not None:
        invoice.total = invoice.subtotal + invoice.extras

    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return invoice

@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: int, session=Depends(get_session)):
    """Eliminar una factura"""
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    # Verificar que no tenga pagos
    payments = session.exec(select(Payment).where(Payment.invoice_id == invoice_id)).all()
    if payments:
        raise HTTPException(400, "No se puede eliminar una factura con pagos registrados")

    session.delete(invoice)
    session.commit()
    return {"ok": True}

@router.get("/{invoice_id}/payments", response_model=list[PaymentResponse])
def get_invoice_payments(invoice_id: int, session=Depends(get_session)):
    """Obtener todos los pagos de una factura"""
    invoice = session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    payments = session.exec(select(Payment).where(Payment.invoice_id == invoice_id)).all()
    return payments

