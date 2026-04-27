"""Servicio de marcado automático de facturas vencidas."""
import asyncio
import logging
from datetime import date
from sqlmodel import Session, select
from app.db import engine
from app.models import Invoice

logger = logging.getLogger(__name__)

_INTERVAL_HOURS = 24


def mark_overdue_sync() -> int:
    """Marca como 'vencido' todas las facturas cuya fecha de vencimiento ya pasó.

    Returns:
        Cantidad de facturas actualizadas.
    """
    today = date.today()
    updated = 0
    try:
        with Session(engine) as session:
            overdue = session.exec(
                select(Invoice).where(
                    Invoice.due_date < today,
                    Invoice.status.not_in(["pagado", "vencido"]),
                )
            ).all()
            for inv in overdue:
                inv.status = "vencido"
                session.add(inv)
                updated += 1
            if updated:
                session.commit()
                logger.info(f"[auto-vencimiento] {updated} factura(s) marcadas como vencidas.")
    except Exception as e:
        logger.error(f"[auto-vencimiento] Error: {e}")
    return updated


async def overdue_scheduler() -> None:
    """Loop asíncrono que corre mark_overdue_sync cada 24 horas."""
    while True:
        await asyncio.sleep(_INTERVAL_HOURS * 3600)
        mark_overdue_sync()
