from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from datetime import date
from app.db import get_session
from app.models import Client, Invoice, Payment
from app.schemas import BillingGenerate

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/generate")
def generate_invoices(payload: BillingGenerate, session: Session = Depends(get_session)):
    """Generar facturas automáticamente para todos los clientes activos del período"""
    try:
        year, month = map(int, payload.period.split("-"))
        issue_date = date(year, month, 1)

        # Calcular día de vencimiento (evitar días inválidos)
        max_day = 28 if month == 2 else 30
        due_day = min(payload.due_day, max_day)
        due_date = date(year, month, due_day)
    except ValueError:
        raise HTTPException(400, "Formato de período inválido. Usa: YYYY-MM")

    # Obtener clientes activos
    active_clients = session.exec(select(Client).where(Client.is_active == True)).all()

    created = 0
    skipped = 0

    for client in active_clients:
        # Verificar si ya existe factura para este período
        existing = session.exec(
            select(Invoice).where(
                Invoice.client_id == client.id,
                Invoice.period == payload.period
            )
        ).first()

        if existing:
            skipped += 1
            continue

        # Crear factura
        invoice = Invoice(
            client_id=client.id,
            period=payload.period,
            issue_date=issue_date,
            due_date=due_date,
            subtotal=client.price,
            extras=0.0,
            total=client.price,
            status="pendiente"
        )
        session.add(invoice)
        created += 1

    session.commit()

    return {
        "period": payload.period,
        "created": created,
        "skipped": skipped,
        "total_clients": len(active_clients)
    }

@router.get("/summary/{period}")
def get_billing_summary(period: str, session: Session = Depends(get_session)):
    """Obtener resumen de facturación de un período"""
    invoices = session.exec(select(Invoice).where(Invoice.period == period)).all()

    if not invoices:
        return {
            "period": period,
            "total_invoices": 0,
            "total_amount": 0,
            "paid": 0,
            "pending": 0,
            "partial": 0,
            "overdue": 0,
            "collected": 0
        }

    total_amount = sum(inv.total for inv in invoices)
    by_status = {"pendiente": 0, "pagado": 0, "parcial": 0, "vencido": 0}

    for inv in invoices:
        by_status[inv.status] = by_status.get(inv.status, 0) + 1

    # Calcular total cobrado
    invoice_ids = [inv.id for inv in invoices]
    payments = session.exec(
        select(Payment).where(Payment.invoice_id.in_(invoice_ids))
    ).all()
    collected = sum(p.amount for p in payments)

    return {
        "period": period,
        "total_invoices": len(invoices),
        "total_amount": total_amount,
        "paid": by_status["pagado"],
        "pending": by_status["pendiente"],
        "partial": by_status["parcial"],
        "overdue": by_status["vencido"],
        "collected": collected,
        "pending_amount": total_amount - collected
    }

@router.get("/overdue")
def get_overdue_invoices(session: Session = Depends(get_session)):
    """Obtener facturas vencidas (fecha de vencimiento pasada y no pagadas)"""
    today = date.today()

    overdue = session.exec(
        select(Invoice).where(
            Invoice.due_date < today,
            Invoice.status != "pagado"
        ).order_by(Invoice.due_date)
    ).all()

    # Actualizar estado a vencido si es necesario
    for invoice in overdue:
        if invoice.status != "vencido":
            invoice.status = "vencido"
            session.add(invoice)

    if overdue:
        session.commit()

    return overdue

@router.get("/stats")
def get_general_stats(session: Session = Depends(get_session)):
    """Obtener estadísticas generales del sistema"""
    total_clients = session.exec(select(Client)).all()
    active_clients = [c for c in total_clients if c.is_active]

    all_invoices = session.exec(select(Invoice)).all()
    all_payments = session.exec(select(Payment)).all()

    total_billed = sum(inv.total for inv in all_invoices)
    total_collected = sum(p.amount for p in all_payments)

    return {
        "total_clients": len(total_clients),
        "active_clients": len(active_clients),
        "inactive_clients": len(total_clients) - len(active_clients),
        "total_invoices": len(all_invoices),
        "total_payments": len(all_payments),
        "total_billed": total_billed,
        "total_collected": total_collected,
        "pending_collection": total_billed - total_collected
    }

