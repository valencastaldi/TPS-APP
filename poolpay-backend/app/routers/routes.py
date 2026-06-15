"""Rutas/calendario: qué barrios y clientes se visitan en cada fecha.
Admin (dashboard) usa estos endpoints; la app del piletero consume la ruta del día."""
import datetime as _dt
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlmodel import Session, select

from app.db import get_session
from app.models import Client, RouteEntry

router = APIRouter(prefix="/routes", tags=["routes"])


# ── Schemas ──────────────────────────────────────────────────────────────────
class RouteEntryCreate(BaseModel):
    date: _dt.date
    neighborhood: Optional[str] = None
    client_id: Optional[int] = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if bool(self.neighborhood) == bool(self.client_id):
            raise ValueError("Indicá un barrio O un cliente (exactamente uno)")
        return self


class RouteEntryOut(BaseModel):
    id: int
    date: _dt.date
    neighborhood: Optional[str]
    client_id: Optional[int]
    client_name: Optional[str]


class RouteClientItem(BaseModel):
    id: int
    name: str
    address: Optional[str]
    neighborhood: Optional[str]
    phone: Optional[str]
    plan: str
    price: float
    lat: Optional[float]
    lng: Optional[float]
    source: str  # "barrio" | "puntual"


class RouteDayOut(BaseModel):
    date: _dt.date
    neighborhoods: List[str]
    entries: List[RouteEntryOut]
    clients: List[RouteClientItem]


class RouteDaySummary(BaseModel):
    date: _dt.date
    neighborhoods: List[str]
    total_clients: int


# ── Helpers ──────────────────────────────────────────────────────────────────
def _entries_for(session: Session, day: date) -> List[RouteEntry]:
    return session.exec(
        select(RouteEntry).where(RouteEntry.date == day).order_by(RouteEntry.id)
    ).all()


def _clients_for(session: Session, entries: List[RouteEntry]) -> List[RouteClientItem]:
    neighborhoods = [e.neighborhood for e in entries if e.neighborhood]
    extra_ids = [e.client_id for e in entries if e.client_id]

    by_id: dict[int, RouteClientItem] = {}

    if neighborhoods:
        rows = session.exec(
            select(Client).where(
                Client.is_active == True,
                Client.neighborhood.in_(neighborhoods),
            ).order_by(Client.neighborhood, Client.name)
        ).all()
        for c in rows:
            by_id[c.id] = _to_item(c, "barrio")

    if extra_ids:
        rows = session.exec(select(Client).where(Client.id.in_(extra_ids))).all()
        for c in rows:
            if c.id not in by_id:  # si ya viene por barrio, prevalece "barrio"
                by_id[c.id] = _to_item(c, "puntual")

    return sorted(by_id.values(), key=lambda x: (x.neighborhood or "", x.name))


def _to_item(c: Client, source: str) -> RouteClientItem:
    return RouteClientItem(
        id=c.id, name=c.name, address=c.address, neighborhood=c.neighborhood,
        phone=c.whatsapp or c.phone, plan=c.plan, price=c.price,
        lat=c.lat, lng=c.lng, source=source,
    )


def _entry_out(session: Session, e: RouteEntry) -> RouteEntryOut:
    name = None
    if e.client_id:
        c = session.get(Client, e.client_id)
        name = c.name if c else None
    return RouteEntryOut(
        id=e.id, date=e.date, neighborhood=e.neighborhood,
        client_id=e.client_id, client_name=name,
    )


# ── GET rango (calendario) ─────────────────────────────────────────────────────
@router.get("", response_model=List[RouteDaySummary])
def list_routes(date_from: date, date_to: date, session: Session = Depends(get_session)):
    """Resumen por día en un rango de fechas (para pintar el calendario)."""
    entries = session.exec(
        select(RouteEntry).where(
            RouteEntry.date >= date_from, RouteEntry.date <= date_to
        ).order_by(RouteEntry.date)
    ).all()

    by_day: dict[date, List[RouteEntry]] = {}
    for e in entries:
        by_day.setdefault(e.date, []).append(e)

    result = []
    for day, day_entries in sorted(by_day.items()):
        clients = _clients_for(session, day_entries)
        result.append(RouteDaySummary(
            date=day,
            neighborhoods=[e.neighborhood for e in day_entries if e.neighborhood],
            total_clients=len(clients),
        ))
    return result


# ── GET detalle de un día ──────────────────────────────────────────────────────
@router.get("/{day}", response_model=RouteDayOut)
def get_route_day(day: date, session: Session = Depends(get_session)):
    entries = _entries_for(session, day)
    return RouteDayOut(
        date=day,
        neighborhoods=[e.neighborhood for e in entries if e.neighborhood],
        entries=[_entry_out(session, e) for e in entries],
        clients=_clients_for(session, entries),
    )


# ── POST agregar barrio o cliente a una fecha ──────────────────────────────────
@router.post("", response_model=RouteEntryOut)
def add_route_entry(payload: RouteEntryCreate, session: Session = Depends(get_session)):
    # Evitar duplicados (mismo barrio o mismo cliente en la misma fecha)
    existing = session.exec(
        select(RouteEntry).where(
            RouteEntry.date == payload.date,
            RouteEntry.neighborhood == payload.neighborhood,
            RouteEntry.client_id == payload.client_id,
        )
    ).first()
    if existing:
        return _entry_out(session, existing)

    if payload.client_id:
        if not session.get(Client, payload.client_id):
            raise HTTPException(404, "Cliente no encontrado")

    entry = RouteEntry(
        date=payload.date,
        neighborhood=payload.neighborhood,
        client_id=payload.client_id,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return _entry_out(session, entry)


# ── DELETE quitar entrada ──────────────────────────────────────────────────────
@router.delete("/{entry_id}")
def delete_route_entry(entry_id: int, session: Session = Depends(get_session)):
    entry = session.get(RouteEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entrada de ruta no encontrada")
    session.delete(entry)
    session.commit()
    return {"ok": True, "id": entry_id}
