import os
import mercadopago
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Inicializar SDK de MercadoPago solo si hay credenciales
MERCADOPAGO_TOKEN = os.getenv("MERCADOPAGO_ACCESS_TOKEN", "")
MERCADOPAGO_ENABLED = bool(MERCADOPAGO_TOKEN and MERCADOPAGO_TOKEN != "TEST-tu-access-token-aqui")

sdk = None
if MERCADOPAGO_ENABLED:
    try:
        sdk = mercadopago.SDK(MERCADOPAGO_TOKEN)
    except Exception as e:
        print(f"Error inicializando MercadoPago: {e}")
        MERCADOPAGO_ENABLED = False

class MercadoPagoService:
    """Servicio para integración con MercadoPago"""

    @staticmethod
    def create_payment_link(
        title: str,
        amount: float,
        client_email: str,
        external_reference: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Crear un link de pago de MercadoPago

        Args:
            title: Título del pago
            amount: Monto a cobrar
            client_email: Email del cliente
            external_reference: Referencia externa (ej: invoice_id)
            description: Descripción opcional

        Returns:
            Dict con información del pago creado
        """
        if not MERCADOPAGO_ENABLED or not sdk:
            return {
                "success": False,
                "error": "MercadoPago no está configurado. Agrega tus credenciales en el archivo .env"
            }

        preference_data = {
            "items": [
                {
                    "title": title,
                    "quantity": 1,
                    "currency_id": "ARS",  # Cambiar según tu país
                    "unit_price": float(amount)
                }
            ],
            "payer": {
                "email": client_email
            },
            "external_reference": external_reference,
            "notification_url": f"{os.getenv('API_URL', 'http://localhost:8000')}/mercadopago/webhook",
            "back_urls": {
                "success": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment-success",
                "failure": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment-failure",
                "pending": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment-pending"
            },
            "auto_return": "approved",
        }

        if description:
            preference_data["items"][0]["description"] = description

        try:
            preference_response = sdk.preference().create(preference_data)
            preference = preference_response["response"]

            return {
                "success": True,
                "preference_id": preference["id"],
                "init_point": preference["init_point"],  # Link de pago para desktop
                "sandbox_init_point": preference.get("sandbox_init_point"),  # Link para sandbox
                "qr_code": preference.get("qr_code"),  # Código QR si está disponible
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def get_payment_info(payment_id: str) -> Dict[str, Any]:
        """
        Obtener información de un pago

        Args:
            payment_id: ID del pago en MercadoPago

        Returns:
            Dict con información del pago
        """
        if not MERCADOPAGO_ENABLED or not sdk:
            return {
                "success": False,
                "error": "MercadoPago no está configurado"
            }

        try:
            payment_info = sdk.payment().get(payment_id)
            return {
                "success": True,
                "payment": payment_info["response"]
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def create_qr_code(
        title: str,
        amount: float,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Crear un código QR para cobrar con MercadoPago Point

        Args:
            title: Título del cobro
            amount: Monto a cobrar
            description: Descripción opcional

        Returns:
            Dict con QR generado
        """
        qr_data = {
            "external_reference": f"qr_{title}_{amount}",
            "title": title,
            "description": description or title,
            "total_amount": float(amount),
            "items": [
                {
                    "title": title,
                    "unit_price": float(amount),
                    "quantity": 1,
                    "unit_measure": "unit",
                    "total_amount": float(amount)
                }
            ]
        }

        try:
            # Nota: Necesitas tener configurado un POS en tu cuenta de MercadoPago
            # Este endpoint puede variar según tu integración
            return {
                "success": True,
                "qr_data": qr_data,
                "message": "Para QR dinámicos, necesitas configurar MercadoPago Point"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Ejemplo de uso
"""
from app.services.mercadopago_service import MercadoPagoService

# Crear link de pago
result = MercadoPagoService.create_payment_link(
    title="Factura #123 - Junio 2025",
    amount=150.00,
    client_email="cliente@example.com",
    external_reference="invoice_123",
    description="Servicio de mantenimiento de piscina"
)

if result["success"]:
    payment_link = result["init_point"]
    # Enviar este link al cliente
else:
    print(result["error"])
"""

