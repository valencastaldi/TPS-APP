"""CRUD admin de pileteros (empleados que hacen las limpiezas)."""
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.auth import require_auth
from app.models import Piletero

router = APIRouter(prefix="/pileteros", tags=["pileteros"], dependencies=[Depends(require_auth)])


# ── Schemas ────────────────────────────────────────────────────────────────
class PileteroCreate(BaseModel):
    name: str
    phone: Optional[str] = None


class PileteroUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class PileteroOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    api_key: str
    is_active: bool
    created_at: datetime


# ── GET list ────────────────────────────────────────────────────────────────
@router.get("", response_model=List[PileteroOut])
def list_pileteros(session: Session = Depends(get_session)):
    return session.exec(select(Piletero).order_by(Piletero.name)).all()


# ── POST create ─────────────────────────────────────────────────────────────
@router.post("", response_model=PileteroOut)
def create_piletero(payload: PileteroCreate, session: Session = Depends(get_session)):
    piletero = Piletero(
        name=payload.name,
        phone=payload.phone,
        api_key=secrets.token_urlsafe(32),
    )
    session.add(piletero)
    session.commit()
    session.refresh(piletero)
    return piletero


# ── PATCH edit ──────────────────────────────────────────────────────────────
@router.patch("/{piletero_id}", response_model=PileteroOut)
def update_piletero(
    piletero_id: int,
    payload: PileteroUpdate,
    session: Session = Depends(get_session),
):
    piletero = session.get(Piletero, piletero_id)
    if not piletero:
        raise HTTPException(404, "Piletero no encontrado")

    if payload.name is not None:
        piletero.name = payload.name
    if payload.phone is not None:
        piletero.phone = payload.phone
    if payload.is_active is not None:
        piletero.is_active = payload.is_active

    session.add(piletero)
    session.commit()
    session.refresh(piletero)
    return piletero


# ── DELETE (soft) ───────────────────────────────────────────────────────────
@router.delete("/{piletero_id}")
def deactivate_piletero(piletero_id: int, session: Session = Depends(get_session)):
    piletero = session.get(Piletero, piletero_id)
    if not piletero:
        raise HTTPException(404, "Piletero no encontrado")

    piletero.is_active = False
    session.add(piletero)
    session.commit()
    return {"ok": True, "id": piletero_id, "is_active": False}


# ── POST regenerar API key ───────────────────────────────────────────────────
@router.post("/{piletero_id}/regenerate-key", response_model=PileteroOut)
def regenerate_key(piletero_id: int, session: Session = Depends(get_session)):
    piletero = session.get(Piletero, piletero_id)
    if not piletero:
        raise HTTPException(404, "Piletero no encontrado")

    piletero.api_key = secrets.token_urlsafe(32)
    session.add(piletero)
    session.commit()
    session.refresh(piletero)
    return piletero
