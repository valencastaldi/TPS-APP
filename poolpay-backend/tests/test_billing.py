"""Tests del servicio de generación de facturas."""
from datetime import date
from sqlmodel import Session

from app.models import Client, Invoice
from app.services.billing import generate_invoices, recalculate_invoice_status


def _make_client(session: Session, price: float = 1500.0) -> Client:
    client = Client(name="Test Client", plan="mensual", price=price, is_active=True)
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def test_generate_invoices_creates_one_per_active_client(session: Session):
    _make_client(session)
    _make_client(session)
    created = generate_invoices(session, "2025-06")
    assert created == 2


def test_generate_invoices_skips_existing(session: Session):
    _make_client(session)
    generate_invoices(session, "2025-06")
    created_again = generate_invoices(session, "2025-06")
    assert created_again == 0


def test_generate_invoices_skips_inactive_clients(session: Session):
    client = Client(name="Inactive", plan="mensual", price=500.0, is_active=False)
    session.add(client)
    session.commit()
    created = generate_invoices(session, "2025-06")
    assert created == 0


def test_recalculate_status_pendiente(session: Session):
    client = _make_client(session)
    invoice = Invoice(
        client_id=client.id,
        period="2025-06",
        issue_date=date(2025, 6, 1),
        due_date=date(2025, 6, 10),
        subtotal=1000.0,
        extras=0.0,
        total=1000.0,
        status="pendiente",
    )
    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    recalculate_invoice_status(session, invoice)
    assert invoice.status == "pendiente"


def test_recalculate_status_pagado(session: Session):
    from app.models import Payment
    from datetime import datetime, timezone

    client = _make_client(session, price=1000.0)
    invoice = Invoice(
        client_id=client.id,
        period="2025-06",
        issue_date=date(2025, 6, 1),
        due_date=date(2025, 6, 10),
        subtotal=1000.0,
        extras=0.0,
        total=1000.0,
        status="pendiente",
    )
    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    payment = Payment(
        invoice_id=invoice.id,
        paid_at=datetime.now(timezone.utc),
        method="efectivo",
        amount=1000.0,
    )
    session.add(payment)
    session.flush()

    recalculate_invoice_status(session, invoice)
    assert invoice.status == "pagado"


def test_recalculate_status_parcial(session: Session):
    from app.models import Payment
    from datetime import datetime, timezone

    client = _make_client(session, price=1000.0)
    invoice = Invoice(
        client_id=client.id,
        period="2025-06",
        issue_date=date(2025, 6, 1),
        due_date=date(2025, 6, 10),
        subtotal=1000.0,
        extras=0.0,
        total=1000.0,
        status="pendiente",
    )
    session.add(invoice)
    session.commit()
    session.refresh(invoice)

    payment = Payment(
        invoice_id=invoice.id,
        paid_at=datetime.now(timezone.utc),
        method="efectivo",
        amount=400.0,
    )
    session.add(payment)
    session.flush()

    recalculate_invoice_status(session, invoice)
    assert invoice.status == "parcial"
