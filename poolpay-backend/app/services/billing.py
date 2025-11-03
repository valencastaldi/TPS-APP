from datetime import date
from sqlmodel import select
from app.models import Client, Invoice

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
