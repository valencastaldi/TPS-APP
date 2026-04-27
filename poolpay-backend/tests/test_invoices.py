"""Tests de endpoints de facturas."""
from datetime import date
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Client


def _seed_client(session: Session) -> Client:
    client = Client(name="Ana", plan="mensual", price=1800.0, is_active=True)
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def test_create_invoice(client: TestClient, session: Session):
    c = _seed_client(session)
    r = client.post("/invoices", json={
        "client_id": c.id,
        "period": "2025-08",
        "issue_date": "2025-08-01",
        "due_date": "2025-08-10",
        "subtotal": 1800.0,
        "extras": 200.0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 2000.0
    assert data["status"] == "pendiente"


def test_update_invoice_extras_recalculates_total(client: TestClient, session: Session):
    c = _seed_client(session)
    create_r = client.post("/invoices", json={
        "client_id": c.id,
        "period": "2025-08",
        "issue_date": "2025-08-01",
        "due_date": "2025-08-10",
        "subtotal": 1800.0,
    })
    inv_id = create_r.json()["id"]

    r = client.patch(f"/invoices/{inv_id}", json={"extras": 500.0})
    assert r.status_code == 200
    assert r.json()["total"] == 2300.0


def test_delete_invoice_with_payments_fails(client: TestClient, session: Session):
    c = _seed_client(session)
    create_r = client.post("/invoices", json={
        "client_id": c.id,
        "period": "2025-08",
        "issue_date": "2025-08-01",
        "due_date": "2025-08-10",
        "subtotal": 1800.0,
    })
    inv_id = create_r.json()["id"]

    client.post("/payments", json={"invoice_id": inv_id, "method": "efectivo", "amount": 100.0})

    r = client.delete(f"/invoices/{inv_id}")
    assert r.status_code == 400


def test_get_invoice_not_found(client: TestClient):
    r = client.get("/invoices/99999")
    assert r.status_code == 404


def test_list_invoices_filter_by_status(client: TestClient, session: Session):
    c = _seed_client(session)
    client.post("/invoices", json={
        "client_id": c.id,
        "period": "2025-09",
        "issue_date": "2025-09-01",
        "due_date": "2025-09-10",
        "subtotal": 1800.0,
        "status": "pagado",
    })
    client.post("/invoices", json={
        "client_id": c.id,
        "period": "2025-10",
        "issue_date": "2025-10-01",
        "due_date": "2025-10-10",
        "subtotal": 1800.0,
        "status": "pendiente",
    })

    r = client.get("/invoices?status=pagado")
    assert r.status_code == 200
    assert all(inv["status"] == "pagado" for inv in r.json())
