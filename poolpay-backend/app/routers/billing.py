from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from datetime import date
from app.db import get_session
from app.models import Client, Invoice, Payment
from app.schemas import BillingGenerate
from app.services.mercadopago_service import MercadoPagoService
from app.services.billing import generate_invoices as generate_invoices_service

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


@router.post('/create-payment-links')
def create_payment_links(period: str | None = None, session: Session = Depends(get_session)):
    """Crear links de MercadoPago para facturas pendientes.

    Si se provee `period` (YYYY-MM) solo se procesan las facturas de ese periodo,
    si no, se procesan todas las facturas con estado 'pendiente'.

    Este endpoint NO guarda las preferencias en la base de datos; devuelve
    una lista con el resultado de la creación por factura.
    """
    # Obtener facturas pendientes
    q = select(Invoice).where(Invoice.status == 'pendiente')
    if period:
        q = q.where(Invoice.period == period)

    invoices = session.exec(q).all()
    results = []

    for inv in invoices:
        client = session.get(Client, inv.client_id)
        if not client:
            results.append({"invoice_id": inv.id, "ok": False, "error": "Cliente no encontrado"})
            continue

        # Construir email/contacto
        client_email = client.whatsapp or client.phone or None
        if client_email and "@" not in client_email:
            client_email = f"{client_email}@poolpay.com"
        if not client_email:
            client_email = f"cliente{client.id}@poolpay.local"

        # Llamar a MercadoPago
        mp_res = MercadoPagoService.create_payment_link(
            title=f"Factura #{inv.id} - Período {inv.period}",
            amount=inv.total,
            client_email=client_email,
            external_reference=f"invoice_{inv.id}",
            description=f"Factura automática para {client.name}"
        )

        if mp_res.get('success'):
            results.append({
                "invoice_id": inv.id,
                "ok": True,
                "preference_id": mp_res.get('preference_id'),
                "payment_link": mp_res.get('init_point')
            })
        else:
            results.append({"invoice_id": inv.id, "ok": False, "error": mp_res.get('error')})

    return {"count": len(results), "results": results}


@router.post('/auto-generate-and-create-links')
def auto_generate_and_create_links(payload: BillingGenerate, session: Session = Depends(get_session)):
    """Generar facturas para un periodo y crear links de MercadoPago para las nuevas facturas.

    Retorna cuántas facturas se crearon y los links generados para las nuevas facturas.
    """
    # Generar facturas (usa el servicio que ya existe)
    created = generate_invoices_service(session, payload.period, payload.due_day)

    # Buscar las facturas del periodo que estén pendientes
    q = select(Invoice).where(Invoice.period == payload.period, Invoice.status == 'pendiente')
    invoices = session.exec(q).all()

    # Crear links para las facturas pendientes (incluye las nuevas)
    links_res = []
    for inv in invoices:
        client = session.get(Client, inv.client_id)
        client_email = client.whatsapp or client.phone or None
        if client_email and "@" not in client_email:
            client_email = f"{client_email}@poolpay.com"
        if not client_email:
            client_email = f"cliente{client.id}@poolpay.local"

        mp_res = MercadoPagoService.create_payment_link(
            title=f"Factura #{inv.id} - Período {inv.period}",
            amount=inv.total,
            client_email=client_email,
            external_reference=f"invoice_{inv.id}",
            description=f"Factura generada automáticamente"
        )

        links_res.append({"invoice_id": inv.id, "mercadopago": mp_res})

    return {"created_invoices": created, "links": links_res}
