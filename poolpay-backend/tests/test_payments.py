"""Tests de endpoints de pagos."""
from datetime import date
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Client, Invoice


def _seed(session: Session) -> tuple[Client, Invoice]:
    client = Client(name="Juan", plan="mensual", price=2000.0, is_active=True)
    session.add(client)
    session.commit()
    session.refresh(client)

    invoice = Invoice(
        client_id=client.id,
        period="2025-07",
        issue_date=date(2025, 7, 1),
        due_date=date(2025, 7, 10),
        subtotal=2000.0,
        extras=0.0,
        total=2000.0,
        status="pendiente",
    )
    session.add(invoice)
    session.commit()
    session.refresh(invoice)
    return client, invoice


def test_create_payment_marks_invoice_pagado(client: TestClient, session: Session):
    _, invoice = _seed(session)

    r = client.post("/payments", json={
        "invoice_id": invoice.id,
        "method": "efectivo",
        "amount": 2000.0,
    })
    assert r.status_code == 200
    session.refresh(invoice)
    assert invoice.status == "pagado"


def test_create_payment_marks_invoice_parcial(client: TestClient, session: Session):
    _, invoice = _seed(session)

    r = client.post("/payments", json={
        "invoice_id": invoice.id,
        "method": "efectivo",
        "amount": 500.0,
    })
    assert r.status_code == 200
    session.refresh(invoice)
    assert invoice.status == "parcial"


def test_delete_payment_recalculates_status(client: TestClient, session: Session):
    _, invoice = _seed(session)

    r = client.post("/payments", json={
        "invoice_id": invoice.id,
        "method": "transferencia",
        "amount": 2000.0,
    })
    payment_id = r.json()["id"]
    session.refresh(invoice)
    assert invoice.status == "pagado"

    client.delete(f"/payments/{payment_id}")
    session.refresh(invoice)
    assert invoice.status == "pendiente"


def test_create_payment_invoice_not_found(client: TestClient):
    r = client.post("/payments", json={
        "invoice_id": 99999,
        "method": "efectivo",
        "amount": 100.0,
    })
    assert r.status_code == 404


def test_list_payments_by_invoice(client: TestClient, session: Session):
    _, invoice = _seed(session)

    client.post("/payments", json={"invoice_id": invoice.id, "method": "efectivo", "amount": 100.0})
    client.post("/payments", json={"invoice_id": invoice.id, "method": "efectivo", "amount": 200.0})

    r = client.get(f"/payments?invoice_id={invoice.id}")
    assert r.status_code == 200
    assert len(r.json()) == 2
