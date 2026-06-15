"""Tests para el calendario de rutas (/routes)."""
import os
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Client


def _client(session: Session, name: str, neighborhood: str, active: bool = True) -> Client:
    c = Client(name=name, neighborhood=neighborhood, plan="mensual", price=1000.0, is_active=active)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def test_add_neighborhood_to_date_lists_its_clients(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    _client(session, "Ana", "TERRON")
    _client(session, "Beto", "TERRON")
    _client(session, "Caro", "ZONA GOLF")  # otro barrio, no debe aparecer

    resp = client.post("/routes", json={"date": "2026-05-22", "neighborhood": "TERRON"})
    assert resp.status_code == 200, resp.text

    day = client.get("/routes/2026-05-22").json()
    assert day["neighborhoods"] == ["TERRON"]
    names = sorted(c["name"] for c in day["clients"])
    assert names == ["Ana", "Beto"]
    assert all(c["source"] == "barrio" for c in day["clients"])


def test_add_individual_client_to_date(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    c = _client(session, "Puntual", "OTRO BARRIO")

    resp = client.post("/routes", json={"date": "2026-05-22", "client_id": c.id})
    assert resp.status_code == 200, resp.text

    day = client.get("/routes/2026-05-22").json()
    assert len(day["clients"]) == 1
    assert day["clients"][0]["name"] == "Puntual"
    assert day["clients"][0]["source"] == "puntual"


def test_inactive_client_excluded_from_neighborhood(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    _client(session, "Activo", "Q2", active=True)
    _client(session, "Inactivo", "Q2", active=False)

    client.post("/routes", json={"date": "2026-05-22", "neighborhood": "Q2"})
    day = client.get("/routes/2026-05-22").json()
    assert [c["name"] for c in day["clients"]] == ["Activo"]


def test_create_requires_exactly_one_target(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    # ni barrio ni cliente
    r1 = client.post("/routes", json={"date": "2026-05-22"})
    assert r1.status_code == 422
    # ambos
    c = _client(session, "X", "Q2")
    r2 = client.post("/routes", json={"date": "2026-05-22", "neighborhood": "Q2", "client_id": c.id})
    assert r2.status_code == 422


def test_no_duplicate_neighborhood_same_date(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    client.post("/routes", json={"date": "2026-05-22", "neighborhood": "Q2"})
    client.post("/routes", json={"date": "2026-05-22", "neighborhood": "Q2"})
    day = client.get("/routes/2026-05-22").json()
    assert day["neighborhoods"] == ["Q2"]


def test_delete_entry(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    add = client.post("/routes", json={"date": "2026-05-22", "neighborhood": "Q2"}).json()
    resp = client.delete(f"/routes/{add['id']}")
    assert resp.status_code == 200
    day = client.get("/routes/2026-05-22").json()
    assert day["neighborhoods"] == []


def test_range_summary(client: TestClient, session: Session):
    os.environ["ALLOW_NO_AUTH"] = "true"
    _client(session, "Ana", "TERRON")
    client.post("/routes", json={"date": "2026-05-22", "neighborhood": "TERRON"})
    client.post("/routes", json={"date": "2026-05-23", "neighborhood": "Q2"})

    resp = client.get("/routes", params={"date_from": "2026-05-20", "date_to": "2026-05-25"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    days = {d["date"]: d for d in data}
    assert "2026-05-22" in days and "2026-05-23" in days
    assert days["2026-05-22"]["total_clients"] == 1
