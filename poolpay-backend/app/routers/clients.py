from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from app.db import get_session
from app.models import Client
from app.schemas import ClientCreate, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("", response_model=Client)
def create_client(payload: ClientCreate, session=Depends(get_session)):
    c = Client(**payload.model_dump())
    session.add(c); session.commit(); session.refresh(c)
    return c

@router.get("", response_model=list[Client])
def list_clients(active: bool | None = None, session=Depends(get_session)):
    q = select(Client)
    if active is not None:
        q = q.where(Client.is_active == active)
    return session.exec(q).all()

@router.get("/{client_id}", response_model=Client)
def get_client(client_id: int, session=Depends(get_session)):
    c = session.get(Client, client_id)
    if not c: raise HTTPException(404, "Client not found")
    return c

@router.patch("/{client_id}", response_model=Client)
def update_client(client_id: int, payload: ClientUpdate, session=Depends(get_session)):
    c = session.get(Client, client_id)
    if not c: raise HTTPException(404, "Client not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    session.add(c); session.commit(); session.refresh(c)
    return c

@router.delete("/{client_id}")
def delete_client(client_id: int, session=Depends(get_session)):
    c = session.get(Client, client_id)
    if not c: raise HTTPException(404, "Client not found")
    session.delete(c); session.commit()
    return {"ok": True}
