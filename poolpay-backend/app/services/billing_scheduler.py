"""Scheduler asíncrono que genera las facturas del mes el día 1 (configurable).

Ejecuta `generate_invoices` para todos los clientes activos del período
correspondiente al mes en curso. Si el servidor se levantó después del día
configurado y todavía no se generaron las facturas del mes, las genera al arranque.
"""
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone

from sqlmodel import Session, select

from app.db import engine
from app.models import Invoice, Client
from app.services.billing import generate_invoices

logger = logging.getLogger("poolpay.billing_scheduler")

# Día del mes en el que se generan las facturas (default: 1)
BILLING_RUN_DAY = int(os.getenv("BILLING_RUN_DAY", "1"))
# Hora local (24h) en la que el scheduler dispara (default: 03)
BILLING_RUN_HOUR = int(os.getenv("BILLING_RUN_HOUR", "3"))
# Día del mes para vencimiento de las facturas generadas
BILLING_DUE_DAY = int(os.getenv("BILLING_DUE_DAY", "10"))


def _current_period() -> str:
    today = date.today()
    return f"{today.year:04d}-{today.month:02d}"


def _has_invoices_for_period(period: str) -> bool:
    with Session(engine) as session:
        existing = session.exec(select(Invoice).where(Invoice.period == period)).first()
        return existing is not None


def _has_active_clients() -> bool:
    with Session(engine) as session:
        client = session.exec(select(Client).where(Client.is_active == True)).first()  # noqa: E712
        return client is not None


def run_monthly_billing(period: str | None = None, due_day: int | None = None) -> int:
    """Genera facturas del período indicado (o del mes actual). Devuelve cuántas creó."""
    period = period or _current_period()
    due_day = due_day or BILLING_DUE_DAY
    try:
        with Session(engine) as session:
            created = generate_invoices(session, period, due_day=due_day)
            if created:
                logger.info("[billing-scheduler] %s factura(s) creada(s) para %s.", created, period)
            else:
                logger.info("[billing-scheduler] Sin facturas nuevas para %s.", period)
            return created
    except Exception as e:
        logger.exception("[billing-scheduler] Error generando facturas del período %s: %s", period, e)
        return 0


def bootstrap_check() -> None:
    """Si ya pasó el día configurado del mes y aún no hay facturas para este período, generarlas."""
    today = date.today()
    if today.day < BILLING_RUN_DAY:
        return
    period = _current_period()
    if not _has_active_clients():
        logger.info("[billing-scheduler] No hay clientes activos; salteo bootstrap.")
        return
    if _has_invoices_for_period(period):
        logger.info("[billing-scheduler] Ya hay facturas para %s; bootstrap no hace nada.", period)
        return
    logger.info("[billing-scheduler] Bootstrap: generando facturas para %s.", period)
    run_monthly_billing(period)


def _next_run_at(now: datetime | None = None) -> datetime:
    """Devuelve el datetime UTC del próximo disparo (día configurado a la hora configurada)."""
    now = now or datetime.now(timezone.utc)
    # Trabajamos en hora local del servidor para el "día 1 a las 3am"
    local_now = datetime.now()
    year, month = local_now.year, local_now.month
    candidate = local_now.replace(
        day=min(BILLING_RUN_DAY, 28),
        hour=BILLING_RUN_HOUR,
        minute=0, second=0, microsecond=0,
    )
    if candidate <= local_now:
        # próximo mes
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        candidate = candidate.replace(year=year, month=month)
    return candidate.astimezone(timezone.utc)


async def billing_scheduler() -> None:
    """Loop asíncrono — duerme hasta el próximo disparo y corre run_monthly_billing."""
    # Pequeño delay de arranque para que el servidor termine de levantar
    await asyncio.sleep(5)
    try:
        bootstrap_check()
    except Exception as e:
        logger.exception("[billing-scheduler] bootstrap_check falló: %s", e)

    while True:
        try:
            next_run = _next_run_at()
            wait_s = max(60.0, (next_run - datetime.now(timezone.utc)).total_seconds())
            logger.info("[billing-scheduler] Próximo disparo: %s (en %.0f s).", next_run.isoformat(), wait_s)
            await asyncio.sleep(wait_s)
            run_monthly_billing()
        except asyncio.CancelledError:
            logger.info("[billing-scheduler] Cancelado.")
            raise
        except Exception as e:
            logger.exception("[billing-scheduler] Loop error: %s", e)
            # Esperar 1h y reintentar
            await asyncio.sleep(3600)
