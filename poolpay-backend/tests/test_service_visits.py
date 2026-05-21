"""Tests para el endpoint POST /service-visits y autenticación de pileteros."""
import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from datetime import datetime, timezone
from app.models import Client, Invoice, Payment, Piletero, ServiceVisit


# ── Helpers ─────────────────────────────────────────────────────────────────
def _make_client(session: Session, price: float = 5000.0, phone: str = "1134567890") -> Client:
    c = Client(
        name="Juan García",
        phone=phone,
        whatsapp=phone,
        address="Av. Test 123",
        city="Rosario",
        plan="mensual",
        price=price,
        is_active=True,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def _make_piletero(session: Session, is_active: bool = True) -> Piletero:
    p = Piletero(name="Carlos el piletero", api_key="test-api-key-abc123", is_active=is_active)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


_MP_SUCCESS = {
    "success": True,
    "preference_id": "pref_123",
    "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_123",
    "sandbox_init_point": None,
    "qr_code": None,
}

_WA_WAME = {"status": "pending", "wame_url": "https://wa.me/5411345678?text=Hola"}
_WA_NO_PHONE = {"status": "no_phone"}


# ── Tests ────────────────────────────────────────────────────────────────────
@patch("app.routers.service_visits.send_payment_link", return_value=_WA_WAME)
@patch("app.routers.service_visits.MercadoPagoService.create_payment_link", return_value=_MP_SUCCESS)
def test_create_visit_happy_path(mock_mp, mock_wa, client: TestClient, session: Session):
    """Visita crea Invoice + payment link. NO se envía nada al cliente: queda pending."""
    c = _make_client(session)
    p = _make_piletero(session)

    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id, "products_used": "Cloro 2L", "duration_minutes": 45},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["invoice_id"] is not None
    assert data["payment_link_url"] == _MP_SUCCESS["init_point"]
    assert data["whatsapp_status"] == "pending"
    assert data["wame_url"] is None
    # El piletero no contacta al cliente: send_payment_link no debe llamarse al crear
    mock_wa.assert_not_called()
    assert data["price"] == c.price
    assert data["client_name"] == c.name
    assert data["piletero_name"] == p.name


@patch("app.routers.service_visits.send_payment_link", return_value=_WA_WAME)
@patch("app.routers.service_visits.MercadoPagoService.create_payment_link", return_value=_MP_SUCCESS)
def test_create_visit_overrides_price(mock_mp, mock_wa, client: TestClient, session: Session):
    """payload.price sobrescribe client.price."""
    c = _make_client(session, price=3000.0)
    p = _make_piletero(session)

    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id, "price": 7500.0},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["price"] == 7500.0


@patch("app.routers.service_visits.send_payment_link", return_value=_WA_NO_PHONE)
@patch("app.routers.service_visits.MercadoPagoService.create_payment_link", return_value=_MP_SUCCESS)
def test_create_visit_without_phone_still_pending(mock_mp, mock_wa, client: TestClient, session: Session):
    """Cliente sin teléfono: la visita igual queda pending (el cobro se gestiona desde el panel)."""
    c = _make_client(session, phone=None)
    # Quitar whatsapp también
    c.whatsapp = None
    session.add(c)
    session.commit()

    p = _make_piletero(session)
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["whatsapp_status"] == "pending"
    mock_wa.assert_not_called()


@patch("app.routers.service_visits.send_payment_link", return_value=_WA_WAME)
@patch("app.routers.service_visits.MercadoPagoService.create_payment_link", return_value=_MP_SUCCESS)
def test_create_visit_paid_cash(mock_mp, mock_wa, client: TestClient, session: Session):
    """paid_cash=True: registra Payment efectivo, factura pagada, sin link MP."""
    c = _make_client(session)
    p = _make_piletero(session)

    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id, "paid_cash": True},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["paid_cash"] is True
    assert data["invoice_status"] == "pagado"
    assert data["payment_link_url"] is None
    # No se intenta crear link de pago ni contactar al cliente
    mock_mp.assert_not_called()
    mock_wa.assert_not_called()
    # Hay un Payment en efectivo asociado a la factura
    pay = session.exec(
        select(Payment).where(Payment.invoice_id == data["invoice_id"])
    ).first()
    assert pay is not None and pay.method == "efectivo" and pay.amount == c.price


def test_create_visit_invalid_client(client: TestClient, session: Session):
    """client_id inexistente → 404."""
    p = _make_piletero(session)
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": 99999},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 404


def test_create_visit_unauthorized(client: TestClient, session: Session):
    """Sin X-Piletero-Key → 422 (header requerido faltante)."""
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post("/service-visits", json={"client_id": 1})
    # FastAPI devuelve 422 cuando falta un header requerido
    assert resp.status_code == 422


def test_create_visit_invalid_api_key(client: TestClient, session: Session):
    """API key inválida → 401."""
    c = _make_client(session)
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id},
        headers={"X-Piletero-Key": "clave-que-no-existe"},
    )
    assert resp.status_code == 401


def test_create_visit_inactive_piletero(client: TestClient, session: Session):
    """API key de piletero desactivado → 403."""
    c = _make_client(session)
    p = _make_piletero(session, is_active=False)
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.post(
        "/service-visits",
        json={"client_id": c.id},
        headers={"X-Piletero-Key": p.api_key},
    )
    assert resp.status_code == 403


def _make_visit_with_invoice(session: Session, c: Client, p: Piletero) -> ServiceVisit:
    inv = Invoice(
        client_id=c.id, period="2026-05",
        issue_date=datetime.now(timezone.utc).date(),
        due_date=datetime.now(timezone.utc).date(),
        subtotal=c.price, extras=0, total=c.price, status="pendiente",
    )
    session.add(inv)
    session.flush()
    visit = ServiceVisit(client_id=c.id, piletero_id=p.id, price=c.price, invoice_id=inv.id)
    session.add(visit)
    session.commit()
    session.refresh(visit)
    return visit


def test_delete_visit_removes_invoice(client: TestClient, session: Session):
    """Borrar visita elimina también su factura."""
    c = _make_client(session)
    p = _make_piletero(session)
    visit = _make_visit_with_invoice(session, c, p)
    invoice_id = visit.invoice_id

    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.delete(f"/service-visits/{visit.id}")
    assert resp.status_code == 200, resp.text
    assert session.get(ServiceVisit, visit.id) is None
    assert session.get(Invoice, invoice_id) is None


def test_delete_visit_blocked_with_payment(client: TestClient, session: Session):
    """No se puede borrar una visita cuya factura ya tiene un pago."""
    c = _make_client(session)
    p = _make_piletero(session)
    visit = _make_visit_with_invoice(session, c, p)
    session.add(Payment(
        invoice_id=visit.invoice_id,
        paid_at=datetime.now(timezone.utc),
        method="efectivo", amount=c.price,
    ))
    session.commit()

    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.delete(f"/service-visits/{visit.id}")
    assert resp.status_code == 400
    assert session.get(ServiceVisit, visit.id) is not None


def test_delete_visit_not_found(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    resp = client.delete("/service-visits/99999")
    assert resp.status_code == 404
