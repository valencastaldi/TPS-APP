# Handoff — Implementar app de Pileteros + sección Servicios

> Documento de transferencia para una nueva sesión de Claude (Code).
> Contiene TODO el contexto necesario para implementar este feature sin
> necesidad de leer la conversación anterior.

---

## 1. Contexto del proyecto

**PoolPay** es un sistema de gestión interno para un servicio de limpieza
de piscinas en Argentina. Backend FastAPI + SQLModel + MySQL, frontend
React + Tailwind + Vite. Procesa pagos via MercadoPago.

**Estado actual (todo funcionando):**
- CRUDs de clientes, facturas, pagos
- Generación masiva mensual de facturas
- Webhook MercadoPago con auto-match inteligente
- Bandeja de "Pagos sin asignar" (huérfanos) con asignación manual
- Auth JWT admin para el dashboard
- Modal custom de confirmación, refresh instantáneo via custom events

---

## 2. El feature a construir

Hay una **app móvil aparte** (otro equipo, fuera del scope de este repo)
para los pileteros (empleados que limpian). El flujo del negocio:

1. El piletero va a la casa del cliente y limpia la pileta
2. Al terminar, marca en su app móvil:
   - Cliente al que visitó
   - Productos usados, notas, duración
   - Monto cobrado (default = `client.price`, puede sobrescribir)
3. La app móvil hace **`POST /service-visits`** a este backend
4. El backend AUTOMÁTICAMENTE:
   - Registra la visita (`ServiceVisit`)
   - Crea una factura nueva (1 visita = 1 factura)
   - Genera link de pago MP
   - Envía link al cliente por WhatsApp
5. El cliente paga → webhook MP existente → factura marcada pagada
6. El admin (este dashboard) ve toda la cadena en una nueva página `/service-visits`

---

## 3. Decisiones arquitectónicas ya tomadas

- **Una visita = una factura** (no batch mensual)
- **Precio**: default `client.price`, pero el piletero puede sobrescribirlo
- **Si el cliente no tiene WhatsApp**: genera factura + link igual, marca
  como "WhatsApp pendiente". El admin lo ve en el dashboard y puede mandarlo
  por otro lado.
- **Auth de pileteros**: tabla `Piletero` con API key individual por persona.
  Header `X-Piletero-Key`.
- **WhatsApp sender pluggable**: por default usa `wa.me` (semi-automático,
  abre WhatsApp con mensaje pre-armado), pero configurable via
  `WHATSAPP_PROVIDER` para usar Meta API / UltraMsg / Twilio cuando el
  usuario tenga la integración pronta.

---

## 4. Plan de implementación (en orden)

### Pieza 1 — Modelos

En `app/models.py` agregá:

```python
class Piletero(SQLModel, table=True):
    """Empleado que hace las limpiezas. Cada uno tiene su API key propia
    para autenticarse desde la app móvil."""
    __tablename__ = "pileteros"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(120), nullable=False))
    phone: Optional[str] = Field(default=None, sa_column=Column(String(30)))
    api_key: str = Field(sa_column=Column(String(64), unique=True, index=True, nullable=False))
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServiceVisit(SQLModel, table=True):
    """Visita de limpieza. Una visita = una factura."""
    __tablename__ = "service_visits"
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="clients.id")
    piletero_id: Optional[int] = Field(default=None, foreign_key="pileteros.id")
    visited_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_minutes: Optional[int] = None
    products_used: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    notes: Optional[str] = Field(default=None, sa_column=Column(String(1000)))
    price: float                                          # monto final cobrado
    invoice_id: Optional[int] = Field(default=None, foreign_key="invoices.id")
    payment_link_url: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    whatsapp_status: str = Field(default="pending", sa_column=Column(String(20)))
    # "pending" | "sent" | "failed" | "no_phone"
    whatsapp_sent_at: Optional[datetime] = None
    whatsapp_error: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

### Pieza 2 — Auth middleware para pileteros

Crear `app/auth_piletero.py`:

```python
"""Auth simple por API key para la app móvil de los pileteros."""
from fastapi import Depends, HTTPException, Header, status
from sqlmodel import Session, select
from app.db import get_session
from app.models import Piletero


def require_piletero(
    x_piletero_key: str = Header(..., alias="X-Piletero-Key"),
    session: Session = Depends(get_session),
) -> Piletero:
    """Valida el header X-Piletero-Key y devuelve el Piletero correspondiente.
    El piletero debe estar activo."""
    if not x_piletero_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "X-Piletero-Key faltante")

    piletero = session.exec(
        select(Piletero).where(Piletero.api_key == x_piletero_key)
    ).first()

    if not piletero:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API key inválida")
    if not piletero.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Piletero desactivado")

    return piletero
```

### Pieza 3 — Servicio WhatsApp pluggable

Crear `app/services/whatsapp_sender.py`:

```python
"""
Envío de WhatsApp pluggable. Drivers:
  - 'wame'    (default): genera URL wa.me, NO envía solo, devuelve la URL
                         para que el admin la abra con un click
  - 'ultramsg'         : llama a la API de UltraMsg (alternativa simple)
  - 'meta_api'         : usa WhatsApp Business API oficial (más setup)
  - 'none'             : no hace nada, modo silencio (tests/dev)

Configurable via env var WHATSAPP_PROVIDER.
"""
import os
import logging
import urllib.parse
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger("poolpay.whatsapp")

PROVIDER = os.getenv("WHATSAPP_PROVIDER", "wame").lower()


def _build_message(client_name: str, amount: float, payment_link: str, period: Optional[str] = None) -> str:
    """Mensaje plantilla para mandarle al cliente."""
    period_str = f" — Período {period}" if period else ""
    return (
        f"Hola {client_name}! 👋\n\n"
        f"Te paso el link de pago de tu servicio de limpieza{period_str}:\n"
        f"💵 Total: ${amount:.0f}\n"
        f"🔗 {payment_link}\n\n"
        f"Gracias!"
    )


def send_payment_link(
    phone: Optional[str],
    client_name: str,
    amount: float,
    payment_link: str,
    period: Optional[str] = None,
) -> Dict[str, Any]:
    """Devuelve dict con 'status': 'sent' | 'pending' | 'failed' | 'no_phone',
    y opcionalmente 'wame_url' (para mostrarlo al admin) o 'error' (si falló)."""

    if not phone:
        return {"status": "no_phone"}

    message = _build_message(client_name, amount, payment_link, period)
    phone_normalized = "".join(c for c in phone if c.isdigit())
    if not phone_normalized.startswith("54"):  # Argentina
        phone_normalized = "54" + phone_normalized.lstrip("0")

    if PROVIDER == "wame":
        # Genera URL wa.me; el admin la abre con un click
        encoded = urllib.parse.quote(message)
        wame_url = f"https://wa.me/{phone_normalized}?text={encoded}"
        logger.info("[whatsapp] wa.me URL generada para %s", phone_normalized)
        return {"status": "pending", "wame_url": wame_url}

    elif PROVIDER == "ultramsg":
        token = os.getenv("ULTRAMSG_TOKEN")
        instance = os.getenv("ULTRAMSG_INSTANCE")
        if not token or not instance:
            logger.error("[whatsapp] ULTRAMSG_TOKEN/ULTRAMSG_INSTANCE no configurados")
            return {"status": "failed", "error": "ultramsg no configurado"}
        try:
            r = httpx.post(
                f"https://api.ultramsg.com/{instance}/messages/chat",
                data={"token": token, "to": phone_normalized, "body": message},
                timeout=15,
            )
            r.raise_for_status()
            return {"status": "sent"}
        except Exception as e:
            logger.exception("[whatsapp] UltraMsg error")
            return {"status": "failed", "error": str(e)}

    elif PROVIDER == "meta_api":
        # Implementación pendiente: usar Meta WhatsApp Business API
        # (requiere template aprobado por Meta, business verified, etc)
        logger.warning("[whatsapp] meta_api driver aún no implementado")
        return {"status": "failed", "error": "meta_api driver no implementado todavía"}

    elif PROVIDER == "none":
        return {"status": "pending"}

    else:
        logger.warning("[whatsapp] WHATSAPP_PROVIDER=%s desconocido", PROVIDER)
        return {"status": "failed", "error": f"driver desconocido: {PROVIDER}"}
```

### Pieza 4 — Endpoint POST /service-visits (consumido por app móvil)

Crear `app/routers/service_visits.py`:

```python
"""Endpoints para la app móvil de pileteros + admin del dashboard."""
import logging
from datetime import datetime, timezone, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

from app.db import get_session
from app.auth import require_auth
from app.auth_piletero import require_piletero
from app.models import Client, Invoice, Piletero, ServiceVisit
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
    due_date = issue_date  # vence el mismo día. Si querés flexibilidad, ajustá.

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

    # 3. Crear payment link MP
    mp_result = MercadoPagoService.create_payment_link(
        title=f"Limpieza pileta - {client.name} - {visited_at.strftime('%d/%m/%Y')}",
        amount=price,
        client_email=client.whatsapp or f"cliente{client.id}@poolpay.com",
        external_reference=f"invoice_{invoice.id}",
        description=payload.notes,
    )
    wame_url: Optional[str] = None

    if mp_result.get("success"):
        visit.payment_link_url = mp_result["init_point"]

        # 4. Enviar WhatsApp
        wa = send_payment_link(
            phone=client.whatsapp or client.phone,
            client_name=client.name,
            amount=price,
            payment_link=visit.payment_link_url,
            period=period,
        )
        visit.whatsapp_status = wa["status"]
        if wa["status"] == "sent":
            visit.whatsapp_sent_at = datetime.now(timezone.utc)
        if wa.get("error"):
            visit.whatsapp_error = wa["error"]
        if wa.get("wame_url"):
            wame_url = wa["wame_url"]
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
        payment_link_url=visit.payment_link_url,
        whatsapp_status=visit.whatsapp_status,
        whatsapp_sent_at=visit.whatsapp_sent_at,
        whatsapp_error=visit.whatsapp_error,
        wame_url=wame_url,
    )
```

### Pieza 5 — Router de pileteros (CRUD admin)

Crear `app/routers/pileteros.py` con CRUD básico:
- `GET /pileteros` lista todos
- `POST /pileteros` crea con auto-generación de api_key (`secrets.token_urlsafe(32)`)
- `PATCH /pileteros/{id}` editar
- `DELETE /pileteros/{id}` desactivar (soft delete: `is_active=false`)
- `POST /pileteros/{id}/regenerate-key` invalida la api_key vieja y genera una nueva

Todos requieren `dependencies=[Depends(require_auth)]`.

### Pieza 6 — Registrar routers

En `app/routers/__init__.py`:
```python
from . import clients, invoices, payments, billing, mercadopago, bank, orphan_payments, service_visits, pileteros
```

En `app/main.py`:
```python
app.include_router(pileteros.router, dependencies=_auth)
app.include_router(service_visits.router)  # auth interno per-endpoint
```

### Pieza 7 — Frontend: página `/service-visits`

Crear:
- `src/api/serviceVisits.ts` (cliente HTTP)
- `src/pages/ServiceVisits.tsx` (tabla con filtros)
- Agregar al sidebar de `src/components/Layout.tsx` con icono `Sparkles` o similar

Tabla con columnas: fecha, cliente, piletero, productos, $, estado WhatsApp (badge), estado pago, acciones (botón "Reenviar WhatsApp" si falló o "Copiar wa.me" si pending).

Si `whatsapp_status === 'pending'` y hay `wame_url`, mostrar un botón **"Abrir WhatsApp"** que abre `wame_url` en nueva pestaña.

### Pieza 8 — Página `/pileteros` admin (CRUD simple)

Lista de pileteros con sus api_keys ofuscadas (`tk_abc...xyz`). Botón **"Mostrar"** que revela. Botón **"Copiar"**. Botón **"Regenerar"** que invalida la vieja.

### Pieza 9 — Documentación API para el equipo móvil

Crear `D:\proyectos\TPS-APP\README_API_PILETEROS.md` con:
- Cómo autenticarse (header `X-Piletero-Key`)
- Ejemplo `curl` del POST /service-visits
- Schema de request/response (copiarlo del Pydantic)
- Códigos de error (401, 403, 404, 400)
- Cómo obtener un api_key (admin lo crea desde el dashboard)

---

## 5. Variables `.env` nuevas a documentar

```ini
# WhatsApp sender
WHATSAPP_PROVIDER=wame  # wame (default) | ultramsg | meta_api | none

# Solo si WHATSAPP_PROVIDER=ultramsg:
ULTRAMSG_TOKEN=
ULTRAMSG_INSTANCE=

# Solo si WHATSAPP_PROVIDER=meta_api (pendiente de implementar):
# META_PHONE_NUMBER_ID=
# META_ACCESS_TOKEN=
# META_TEMPLATE_NAME=
```

Agregalas a `.env.example`.

---

## 6. Tests recomendados

En `tests/test_service_visits.py`:
- `test_create_visit_happy_path` — visit crea invoice + payment link + ws status pending
- `test_create_visit_overrides_price` — payload.price sobrescribe client.price
- `test_create_visit_without_whatsapp` — client.whatsapp=null → status='no_phone'
- `test_create_visit_invalid_client` — client_id inexistente → 404
- `test_create_visit_unauthorized` — sin X-Piletero-Key → 401
- `test_create_visit_inactive_piletero` — api_key de piletero desactivado → 403

Mockear `MercadoPagoService.create_payment_link` y `whatsapp_sender.send_payment_link`.

---

## 7. Validación end-to-end

Después de implementar, levantar `start-all.bat` y probar:

1. Crear un piletero desde el dashboard, copiar su api_key
2. Curl simulando la app móvil:
   ```bash
   curl -X POST http://localhost:8000/service-visits \
     -H "X-Piletero-Key: TU-API-KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "client_id": 112,
       "products_used": "Cloro 2L, alguicida 1L",
       "notes": "Filtros sucios, sugerir cambio",
       "duration_minutes": 45
     }'
   ```
3. Verificar:
   - Response trae `invoice_id`, `payment_link_url`, `wame_url` (si provider=wame)
   - `GET /service-visits` lo lista
   - El cliente Juan García tiene una nueva factura del período actual
   - Si abrís el `wame_url` en el browser, te abre WhatsApp con el mensaje pre-armado

---

## 8. Archivos clave del proyecto que conviene leer antes de empezar

| Archivo | Por qué |
|---|---|
| `app/routers/mercadopago.py` | Cómo se usa MercadoPagoService para crear preferences |
| `app/routers/orphan_payments.py` | Patrón de router con Pydantic schemas y SQLModel |
| `app/services/mercadopago_service.py` | Wrapper del SDK de MP |
| `app/models.py` | Estilo de SQLModel + Field(sa_column=Column(...)) |
| `app/auth.py` | Cómo está armado require_auth |
| `src/pages/OrphanPayments.tsx` | Patrón de página con tabla expandible + modales |
| `src/components/Layout.tsx` | Cómo agregar item al sidebar con badge |

---

## 9. Cosas a NO romper

- El webhook MP (`/mercadopago/webhook`) sigue siendo el mismo. Como la
  factura nueva tiene `external_reference="invoice_X"`, el pago se asocia
  automáticamente por el camino "link" existente.
- Los `--reload` de uvicorn detectan cambios en `app/` → backend se reinicia
  solo, no requiere acción manual.
- La sección Facturación existente (generación mensual) sigue funcionando.
  El nuevo flujo de visitas es ADITIVO, no reemplaza nada.

---

## 10. Estado final esperado

- Backend con 2 modelos nuevos (`Piletero`, `ServiceVisit`), 2 routers nuevos
- Servicio WhatsApp pluggable con driver `wame` por default
- Frontend con 2 páginas nuevas (`/pileteros` y `/service-visits`)
- Doc `README_API_PILETEROS.md` lista para entregar al equipo móvil
- Tests pytest que pasan
