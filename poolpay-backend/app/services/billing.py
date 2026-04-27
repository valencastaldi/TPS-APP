from datetime import date
from sqlmodel import select, Session
from app.models import Client, Invoice, Payment


def recalculate_invoice_status(session: Session, invoice: Invoice, extra_amount: float = 0.0) -> None:
    """Recalcula y persiste el estado de una factura según sus pagos ya commiteados.

    Args:
        session: Sesión de base de datos activa.
        invoice: Instancia de Invoice a actualizar.
        extra_amount: Monto adicional aún no commiteado (ej: pago recién creado pero no guardado).
    """
    existing_payments = session.exec(
        select(Payment).where(Payment.invoice_id == invoice.id)
    ).all()
    total_paid = sum(p.amount for p in existing_payments) + extra_amount

    tolerance = 0.01
    if total_paid >= invoice.total - tolerance:
        invoice.status = "pagado"
    elif total_paid > 0:
        invoice.status = "parcial"
    else:
        invoice.status = "pendiente"

    session.add(invoice)


def generate_invoices(session, period: str, due_day: int = 10) -> int:
    y, m = map(int, period.split("-"))
    issue = date(y, m, 1)
    # Evitar problemas con feb/meses cortos
    due = date(y, m, min(due_day, 28))
    created = 0
    for c in session.exec(select(Client).where(Client.is_active == True)):
        exists = session.exec(
            select(Invoice).where(Invoice.client_id == c.id, Invoice.period == period)
        ).first()
        if exists: continue
        inv = Invoice(
            client_id=c.id, period=period, issue_date=issue, due_date=due,
            subtotal=c.price, extras=0.0, total=c.price, status="pendiente"
        )
        session.add(inv); created += 1
    session.commit()
    return created
