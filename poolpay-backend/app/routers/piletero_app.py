"""Endpoints consumidos por la app móvil del piletero.
Todos usan X-Piletero-Key para auth (no JWT de admin).
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.auth_piletero import require_piletero
from app.models import Client, Piletero, ServiceVisit

router = APIRouter(prefix="/piletero", tags=["piletero-app"])
_dep = [Depends(require_piletero)]


# ── Schemas ────────────────────────────────────────────────────────────────
class PileteroProfile(BaseModel):
    id: int
    name: str
    phone: Optional[str]


class ClientMapItem(BaseModel):
    id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    neighborhood: Optional[str]
    plan: str
    assigned_days: Optional[str]
    price: float
    lat: Optional[float]
    lng: Optional[float]


class MyVisitOut(BaseModel):
    id: int
    client_id: int
    client_name: str
    visited_at: datetime
    duration_minutes: Optional[int]
    products_used: Optional[str]
    notes: Optional[str]
    price: float
    invoice_id: Optional[int]
    payment_link_url: Optional[str]
    whatsapp_status: str
    wame_url: Optional[str] = None


class UpdateClientCoords(BaseModel):
    lat: float
    lng: float


# ── GET /piletero/profile ──────────────────────────────────────────────────
@router.get("/profile", response_model=PileteroProfile, dependencies=_dep)
def get_profile(piletero: Piletero = Depends(require_piletero)):
    return PileteroProfile(id=piletero.id, name=piletero.name, phone=piletero.phone)


# ── GET /piletero/clients ──────────────────────────────────────────────────
@router.get("/clients", response_model=List[ClientMapItem], dependencies=_dep)
def list_clients(session: Session = Depends(get_session)):
    """Lista todos los clientes activos con sus coordenadas para el mapa."""
    clients = session.exec(
        select(Client).where(Client.is_active == True).order_by(Client.name)
    ).all()
    return [
        ClientMapItem(
            id=c.id,
            name=c.name,
            address=c.address,
            city=c.city,
            neighborhood=c.neighborhood,
            plan=c.plan,
            assigned_days=c.assigned_days,
            price=c.price,
            lat=c.lat,
            lng=c.lng,
        )
        for c in clients
    ]


# ── GET /piletero/my-visits ────────────────────────────────────────────────
@router.get("/my-visits", response_model=List[MyVisitOut], dependencies=_dep)
def my_visits(
    piletero: Piletero = Depends(require_piletero),
    session: Session = Depends(get_session),
):
    """Visitas realizadas por este piletero, ordenadas por fecha desc."""
    visits = session.exec(
        select(ServiceVisit)
        .where(ServiceVisit.piletero_id == piletero.id)
        .order_by(ServiceVisit.visited_at.desc())
    ).all()

    result = []
    for v in visits:
        client = session.get(Client, v.client_id)
        result.append(MyVisitOut(
            id=v.id,
            client_id=v.client_id,
            client_name=client.name if client else "—",
            visited_at=v.visited_at,
            duration_minutes=v.duration_minutes,
            products_used=v.products_used,
            notes=v.notes,
            price=v.price,
            invoice_id=v.invoice_id,
            payment_link_url=v.payment_link_url,
            whatsapp_status=v.whatsapp_status,
        ))
    return result


# ── PATCH /piletero/clients/{id}/coords ────────────────────────────────────
@router.patch("/clients/{client_id}/coords", dependencies=_dep)
def update_client_coords(
    client_id: int,
    payload: UpdateClientCoords,
    session: Session = Depends(get_session),
):
    """El piletero actualiza las coordenadas GPS de un cliente al llegar.
    Se llama automáticamente al registrar una visita si se pasan coords."""
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    client.lat = payload.lat
    client.lng = payload.lng
    session.add(client)
    session.commit()
    return {"ok": True, "client_id": client_id, "lat": payload.lat, "lng": payload.lng}
