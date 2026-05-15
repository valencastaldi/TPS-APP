"""Recordatorios de cobranza — corre 1 vez al día.

Reglas (configurables via env, defaults razonables):
- 3 días ANTES del vencimiento  → kind="pre_due"
- el día del vencimiento         → kind="due"
- 3, 7, 15 días DESPUÉS          → kind="overdue_3" / "overdue_7" / "overdue_15"

Cada recordatorio se registra en la tabla ReminderLog. Si ya existe (mismo
invoice_id + kind) no se vuelve a enviar.

Sender pluggable:
- Si SMTP_HOST y SMTP_USER están configurados, manda email.
- Si no, loguea en consola (canal "log") — útil en dev.

Para integrar WhatsApp/Twilio, implementar `_send_whatsapp` y elegir canal en
`_send_reminder` según el cliente (whatsapp prioritario, fallback email).
"""
from __future__ import annotations

import asyncio
import logging
import os
import smtplib
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from typing import List

from sqlmodel import Session, select

from app.db import engine
from app.models import Invoice, Client, Payment, ReminderLog
from app.services.mercadopago_service import MercadoPagoService

logger = logging.getLogger("poolpay.reminders")

# Hora local del disparo diario
REMINDERS_RUN_HOUR = int(os.getenv("REMINDERS_RUN_HOUR", "9"))

# Días offset → kind
_REMINDER_RULES: list[tuple[int, str]] = [
    (-3, "pre_due"),     # 3 días ANTES del vencimiento
    (0,  "due"),         # día del vencimiento
    (3,  "overdue_3"),   # 3 días vencida
    (7,  "overdue_7"),
    (15, "overdue_15"),
]

# SMTP
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes")

ENABLE_PAYMENT_LINK = os.getenv("REMINDERS_INCLUDE_MP_LINK", "true").lower() in ("1", "true", "yes")


def _has_email_sender() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_FROM)


def _client_email(client: Client) -> str | None:
    # Si el campo whatsapp tiene un email (porque el form lo permite), úsalo
    candidates = [getattr(client, "email", None), client.whatsapp, client.phone]
    for c in candidates:
        if c and "@" in c:
            return c
    return None


def _unpaid_amount(session: Session, invoice: Invoice) -> float:
    payments = session.exec(select(Payment).where(Payment.invoice_id == invoice.id)).all()
    paid = sum(p.amount for p in payments) if payments else 0.0
    return float(invoice.total or 0.0) - float(paid)


def _build_message(client: Client, invoice: Invoice, kind: str, unpaid: float, payment_link: str | None) -> tuple[str, str]:
    """Devuelve (subject, body) para el email."""
    if kind == "pre_due":
        subject = f"Recordatorio: tu factura de {invoice.period} vence pronto"
        intro = f"Hola {client.name}, te recordamos que tu factura del período {invoice.period} vence el {invoice.due_date.strftime('%d/%m/%Y')}."
    elif kind == "due":
        subject = f"Tu factura de {invoice.period} vence hoy"
        intro = f"Hola {client.name}, tu factura del período {invoice.period} vence hoy ({invoice.due_date.strftime('%d/%m/%Y')})."
    else:
        days = kind.replace("overdue_", "")
        subject = f"Factura vencida hace {days} días — {invoice.period}"
        intro = f"Hola {client.name}, tu factura del período {invoice.period} está vencida desde el {invoice.due_date.strftime('%d/%m/%Y')}."

    body_lines = [
        intro,
        "",
        f"Importe pendiente: ${unpaid:,.2f}",
    ]
    if payment_link:
        body_lines += ["", f"Podés pagar online acá: {payment_link}"]
    body_lines += [
        "",
        "Si ya realizaste el pago, ignorá este mensaje.",
        "",
        "— PoolPay",
    ]
    return subject, "\n".join(body_lines)


def _send_email(to_addr: str, subject: str, body: str) -> tuple[bool, str]:
    if not _has_email_sender():
        return False, "smtp_not_configured"
    try:
        msg = EmailMessage()
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)

        if SMTP_TLS:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        return True, "sent"
    except Exception as e:
        logger.exception("[reminders] error SMTP a %s: %s", to_addr, e)
        return False, f"smtp_error:{e}"


def _generate_payment_link(client: Client, invoice: Invoice) -> str | None:
    if not ENABLE_PAYMENT_LINK:
        return None
    email = _client_email(client) or f"cliente{client.id}@poolpay.local"
    res = MercadoPagoService.create_payment_link(
        title=f"Factura #{invoice.id} - Período {invoice.period}",
        amount=invoice.total,
        client_email=email,
        external_reference=f"invoice_{invoice.id}",
        description=f"Recordatorio para {client.name}",
    )
    if res.get("success"):
        return res.get("init_point")
    return None


def _already_sent(session: Session, invoice_id: int, kind: str) -> bool:
    existing = session.exec(
        select(ReminderLog).where(
            ReminderLog.invoice_id == invoice_id,
            ReminderLog.kind == kind,
        )
    ).first()
    return existing is not None


def run_reminders_once() -> dict:
    """Recorre las facturas no pagadas y envía los recordatorios que correspondan."""
    today = date.today()
    summary = {"checked": 0, "sent": 0, "skipped": 0, "errors": 0, "log_only": 0}

    with Session(engine) as session:
        invoices: List[Invoice] = session.exec(
            select(Invoice).where(Invoice.status != "pagado")
        ).all()
        clients_by_id = {c.id: c for c in session.exec(select(Client)).all()}

        for inv in invoices:
            summary["checked"] += 1
            client = clients_by_id.get(inv.client_id)
            if not client or not client.is_active:
                summary["skipped"] += 1
                continue

            # Determinar qué kind aplica HOY
            offset = (today - inv.due_date).days  # negativo si aún no venció
            applicable_kind = None
            for off, kind in _REMINDER_RULES:
                if off == offset:
                    applicable_kind = kind
                    break
            if not applicable_kind:
                summary["skipped"] += 1
                continue

            if _already_sent(session, inv.id, applicable_kind):
                summary["skipped"] += 1
                continue

            unpaid = _unpaid_amount(session, inv)
            if unpaid <= 0.01:
                summary["skipped"] += 1
                continue

            payment_link = _generate_payment_link(client, inv)
            subject, body = _build_message(client, inv, applicable_kind, unpaid, payment_link)

            email = _client_email(client)
            channel = "email" if (email and _has_email_sender()) else "log"
            success = True
            detail = ""

            if channel == "email":
                success, detail = _send_email(email, subject, body)
            else:
                # Modo dev / sin SMTP: log estructurado para que el operador vea qué se enviaría.
                logger.info(
                    "[reminders][LOG-ONLY] invoice=%s kind=%s a=%s subject=%r body=%r",
                    inv.id, applicable_kind, email or "(sin email)", subject, body,
                )
                detail = "logged_only"
                summary["log_only"] += 1

            session.add(ReminderLog(
                invoice_id=inv.id,
                kind=applicable_kind,
                channel=channel,
                success=success,
                detail=detail[:500],
            ))
            session.commit()

            if success and channel == "email":
                summary["sent"] += 1
            elif not success:
                summary["errors"] += 1

    logger.info("[reminders] resumen=%s", summary)
    return summary


def _seconds_until_next_run() -> float:
    """Próxima corrida: hoy a la hora REMINDERS_RUN_HOUR si aún no pasó, si no mañana."""
    now = datetime.now()
    target = now.replace(hour=REMINDERS_RUN_HOUR, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return max(60.0, (target - now).total_seconds())


async def reminders_scheduler() -> None:
    """Loop diario de recordatorios."""
    await asyncio.sleep(10)  # esperar a que el server termine de levantar
    while True:
        try:
            wait_s = _seconds_until_next_run()
            logger.info("[reminders] próxima corrida en %.0f s.", wait_s)
            await asyncio.sleep(wait_s)
            run_reminders_once()
        except asyncio.CancelledError:
            logger.info("[reminders] cancelado.")
            raise
        except Exception as e:
            logger.exception("[reminders] error en loop: %s", e)
            await asyncio.sleep(3600)
