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


def _build_message(
    client_name: str,
    amount: float,
    payment_link: str,
    period: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Mensaje plantilla para mandarle al cliente.
    Si hay notas del piletero, se incluyen antes del link de pago."""
    period_str = f" - Período {period}" if period else ""
    note_block = ""
    if notes and notes.strip():
        note_block = f"\nNota del servicio: {notes.strip()}\n"
    return (
        f"Hola {client_name}!\n\n"
        f"Te paso el link de pago de tu servicio de limpieza{period_str}:\n"
        f"{note_block}\n"
        f"Total: ${amount:.0f}\n"
        f"Link de pago: {payment_link}\n\n"
        f"Muchas gracias!"
    )


def send_payment_link(
    phone: Optional[str],
    client_name: str,
    amount: float,
    payment_link: str,
    period: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Devuelve dict con 'status': 'sent' | 'pending' | 'failed' | 'no_phone',
    y opcionalmente 'wame_url' (para mostrarlo al admin) o 'error' (si falló)."""

    if not phone:
        return {"status": "no_phone"}

    message = _build_message(client_name, amount, payment_link, period, notes)
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
