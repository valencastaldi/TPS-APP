"""Endpoints para la app móvil de pileteros + admin del dashboard."""
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

from app.db import get_session
from app.auth import require_auth
from app.auth_piletero import require_piletero
from app.models import Client, Invoice, Payment, Piletero, ServiceVisit
from app.services.mercadopago_service import MercadoPagoService
from app.services.whatsapp_sender import send_payment_link

logger = logging.getLogger("poolpay.service_visits")
router = APIRouter(prefix="/service-visits", tags=["service-visits"])


# ── Schemas ────────────────────────────────────────────────────────────────
class ServiceVisitCreate(BaseModel):
    client_id: int
    visited_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    products_used: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = PField(default=None, description="Si no se pasa, usa client.price")
    paid_cash: bool = PField(default=False, description="El cliente pagó en efectivo en el momento")


class ServiceVisitOut(BaseModel):
    id: int
    client_id: int
    client_name: str
    piletero_id: Optional[int]
    piletero_name: Optional[str]
    visited_at: datetime
    duration_minutes: Optional[int]
    products_used: Optional[str]
    notes: Optional[str]
    price: float
    invoice_id: Optional[int]
    invoice_status: Optional[str] = None  # "pendiente" | "pagado" | ...
    paid_cash: bool = False
    payment_link_url: Optional[str]
    whatsapp_status: str
    whatsapp_sent_at: Optional[datetime]
    whatsapp_error: Optional[str]
    wame_url: Optional[str] = None  # solo se devuelve cuando provider=wame y status=pending


# ── Endpoint principal: lo llama la app móvil ──────────────────────────────
@router.post("", response_model=ServiceVisitOut)
def create_visit(
    payload: ServiceVisitCreate,
    piletero: Piletero = Depends(require_piletero),
    session: Session = Depends(get_session),
):
    """Crea una visita completa: ServiceVisit + Invoice + payment link + WhatsApp."""
    client = session.get(Client, payload.client_id)
    if not client:
        raise HTTPException(404, "Cliente no encontrado")
    if not client.is_active:
        raise HTTPException(400, "Cliente desactivado")

    price = payload.price if payload.price and payload.price > 0 else client.price
    if price <= 0:
        raise HTTPException(400, "Precio inválido (debe ser > 0)")

    visited_at = payload.visited_at or datetime.now(timezone.utc)
    period = visited_at.strftime("%Y-%m")
    issue_date = visited_at.date()
    due_date = issue_date  # vence el mismo día

    # 1. Crear Invoice
    invoice = Invoice(
        client_id=client.id,
        period=period,
        issue_date=issue_date,
        due_date=due_date,
        subtotal=price,
        extras=0,
        total=price,
        status="pendiente",
    )
    session.add(invoice)
    session.flush()  # para tener invoice.id

    # 2. Crear ServiceVisit
    visit = ServiceVisit(
        client_id=client.id,
        piletero_id=piletero.id,
        visited_at=visited_at,
        duration_minutes=payload.duration_minutes,
        products_used=payload.products_used,
        notes=payload.notes,
        price=price,
        invoice_id=invoice.id,
    )
    session.add(visit)
    session.flush()

    wame_url: Optional[str] = None

    if payload.paid_cash:
        # 3a. Pago en efectivo registrado por el piletero: no hace falta link ni WhatsApp.
        payment = Payment(
            invoice_id=invoice.id,
            paid_at=visited_at,
            method="efectivo",
            amount=price,
            notes="Cobrado en efectivo por el piletero",
        )
        session.add(payment)
        invoice.status = "pagado"
        visit.whatsapp_status = "no_phone"  # no aplica: ya está cobrado
    else:
        # 3b. Crear payment link MP. El link queda "pendiente" y el operador
        # lo manda desde el dashboard (el piletero no contacta al cliente).
        mp_result = MercadoPagoService.create_payment_link(
            title=f"Limpieza pileta - {client.name} - {visited_at.strftime('%d/%m/%Y')}",
            amount=price,
            client_email=client.whatsapp or f"cliente{client.id}@poolpay.com",
            external_reference=f"invoice_{invoice.id}",
            description=payload.notes,
        )
        if mp_result.get("success"):
            visit.payment_link_url = mp_result["init_point"]
            visit.whatsapp_status = "pending"
        else:
            logger.error("[service_visits] MP create_payment_link falló: %s", mp_result.get("error"))
            visit.whatsapp_status = "failed"
            visit.whatsapp_error = f"MP error: {mp_result.get('error', 'unknown')}"

    session.commit()
    session.refresh(visit)

    return _to_out(session, visit, wame_url=wame_url)


# ── Endpoints admin ────────────────────────────────────────────────────────
@router.get("", response_model=List[ServiceVisitOut], dependencies=[Depends(require_auth)])
def list_visits(
    client_id: Optional[int] = None,
    piletero_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    q = select(ServiceVisit).order_by(ServiceVisit.visited_at.desc())
    if client_id:
        q = q.where(ServiceVisit.client_id == client_id)
    if piletero_id:
        q = q.where(ServiceVisit.piletero_id == piletero_id)
    visits = session.exec(q).all()
    return [_to_out(session, v) for v in visits]


@router.get("/{visit_id}", response_model=ServiceVisitOut, dependencies=[Depends(require_auth)])
def get_visit(visit_id: int, session: Session = Depends(get_session)):
    visit = session.get(ServiceVisit, visit_id)
    if not visit:
        raise HTTPException(404, "Visita no encontrada")
    return _to_out(session, visit)


@router.delete("/{visit_id}", dependencies=[Depends(require_auth)])
def delete_visit(visit_id: int, session: Session = Depends(get_session)):
    """Borra una visita y su factura asociada.
    Se bloquea si la factura ya tiene pagos registrados, para no perder el registro."""
    visit = session.get(ServiceVisit, visit_id)
    if not visit:
        raise HTTPException(404, "Visita no encontrada")

    invoice_id = visit.invoice_id
    if invoice_id:
        has_payment = session.exec(
            select(Payment).where(Payment.invoice_id == invoice_id)
        ).first()
        if has_payment:
            raise HTTPException(
                400,
                "La factura de esta visita ya tiene un pago registrado. No se puede borrar.",
            )

    # Borrar primero la visita (tiene FK a invoice), luego la factura
    session.delete(visit)
    session.flush()
    if invoice_id:
        invoice = session.get(Invoice, invoice_id)
        if invoice:
            session.delete(invoice)

    session.commit()
    return {"ok": True, "id": visit_id}


@router.post("/{visit_id}/resend-whatsapp", dependencies=[Depends(require_auth)])
def resend_whatsapp(visit_id: int, session: Session = Depends(get_session)):
    visit = session.get(ServiceVisit, visit_id)
    if not visit:
        raise HTTPException(404, "Visita no encontrada")
    if not visit.payment_link_url:
        raise HTTPException(400, "Esta visita no tiene payment link")
    client = session.get(Client, visit.client_id)
    wa = send_payment_link(
        phone=client.whatsapp or client.phone,
        client_name=client.name,
        amount=visit.price,
        payment_link=visit.payment_link_url,
        period=visit.visited_at.strftime("%Y-%m"),
    )
    visit.whatsapp_status = wa["status"]
    if wa["status"] == "sent":
        visit.whatsapp_sent_at = datetime.now(timezone.utc)
    visit.whatsapp_error = wa.get("error")
    session.add(visit)
    session.commit()
    return {"ok": True, "status": wa["status"], "wame_url": wa.get("wame_url")}


# ── Helper ─────────────────────────────────────────────────────────────────
def _to_out(session: Session, visit: ServiceVisit, wame_url: Optional[str] = None) -> ServiceVisitOut:
    client = session.get(Client, visit.client_id)
    piletero = session.get(Piletero, visit.piletero_id) if visit.piletero_id else None
    invoice = session.get(Invoice, visit.invoice_id) if visit.invoice_id else None
    paid_cash = False
    if visit.invoice_id:
        paid_cash = bool(session.exec(
            select(Payment).where(
                Payment.invoice_id == visit.invoice_id,
                Payment.method == "efectivo",
            )
        ).first())
    return ServiceVisitOut(
        id=visit.id,
        client_id=visit.client_id,
        client_name=client.name if client else "—",
        piletero_id=visit.piletero_id,
        piletero_name=piletero.name if piletero else None,
        visited_at=visit.visited_at,
        duration_minutes=visit.duration_minutes,
        products_used=visit.products_used,
        notes=visit.notes,
        price=visit.price,
        invoice_id=visit.invoice_id,
        invoice_status=invoice.status if invoice else None,
        paid_cash=paid_cash,
        payment_link_url=visit.payment_link_url,
        whatsapp_status=visit.whatsapp_status,
        whatsapp_sent_at=visit.whatsapp_sent_at,
        whatsapp_error=visit.whatsapp_error,
        wame_url=wame_url,
    )
