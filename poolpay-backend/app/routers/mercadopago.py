from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.db import get_session
from app.models import Invoice, Payment, Client
from app.services.mercadopago_service import MercadoPagoService
from datetime import datetime, timezone

router = APIRouter(prefix="/mercadopago", tags=["mercadopago"])

class CreatePaymentLinkRequest(BaseModel):
    invoice_id: int
    client_email: EmailStr
    description: Optional[str] = None

class PaymentLinkResponse(BaseModel):
    success: bool
    payment_link: Optional[str] = None
    preference_id: Optional[str] = None
    error: Optional[str] = None

@router.post("/create-payment-link", response_model=PaymentLinkResponse)
async def create_payment_link(
    request: CreatePaymentLinkRequest,
    session: Session = Depends(get_session)
):
    """
    Crear un link de pago de MercadoPago para una factura

    El cliente recibirá un link para pagar con tarjeta de crédito, débito, o efectivo
    """
    # Verificar que la factura existe
    invoice = session.get(Invoice, request.invoice_id)
    if not invoice:
        raise HTTPException(404, "Factura no encontrada")

    # Crear el link de pago
    result = MercadoPagoService.create_payment_link(
        title=f"Factura #{invoice.id} - Período {invoice.period}",
        amount=invoice.total,
        client_email=request.client_email,
        external_reference=f"invoice_{invoice.id}",
        description=request.description
    )

    if result["success"]:
        return PaymentLinkResponse(
            success=True,
            payment_link=result["init_point"],
            preference_id=result["preference_id"]
        )
    else:
        return PaymentLinkResponse(
            success=False,
            error=result.get("error", "Error desconocido")
        )

@router.post("/webhook")
async def mercadopago_webhook(request: Request, session: Session = Depends(get_session)):
    """
    Webhook para recibir notificaciones de MercadoPago (AUTOMÁTICO)

    Se llama automáticamente cuando:
    - Un pago es aprobado (link de pago O transferencia a tu CBU de MercadoPago)
    - Un pago es rechazado
    - Un pago está pendiente

    Este endpoint registra automáticamente los pagos en el sistema sin intervención manual.
    """
    try:
        # Obtener datos del webhook
        data = await request.json()

        # Log para debugging
        print(f"[WEBHOOK MP] Recibido: {data}")

        # MercadoPago envía diferentes tipos de notificaciones
        notification_type = data.get("type") or data.get("topic")

        if notification_type == "payment":
            payment_id = data.get("data", {}).get("id") or data.get("id")

            if not payment_id:
                return {"status": "error", "message": "No payment_id found"}

            # Obtener información del pago
            payment_info = MercadoPagoService.get_payment_info(str(payment_id))

            if payment_info["success"]:
                payment_data = payment_info["payment"]

                print(f"[WEBHOOK MP] Payment status: {payment_data.get('status')}")

                # Verificar si el pago fue aprobado
                if payment_data["status"] == "approved":
                    # Extraer el invoice_id de la referencia externa
                    external_ref = payment_data.get("external_reference", "")

                    # Verificar si ya existe este pago para evitar duplicados
                    existing = session.exec(
                        select(Payment).where(Payment.notes.contains(f"MercadoPago Payment ID: {payment_id}"))
                    ).first()

                    if existing:
                        print(f"[WEBHOOK MP] Pago {payment_id} ya registrado, ignorando duplicado")
                        return {"status": "ok", "message": "Pago ya registrado"}

                    if external_ref.startswith("invoice_"):
                        invoice_id = int(external_ref.replace("invoice_", ""))

                        # Buscar la factura
                        invoice = session.get(Invoice, invoice_id)
                        if invoice:
                            # Registrar el pago
                            payment = Payment(
                                invoice_id=invoice_id,
                                paid_at=datetime.now(timezone.utc),
                                method="mercado_pago",
                                amount=float(payment_data["transaction_amount"]),
                                notes=f"MercadoPago Payment ID: {payment_id} | Método: {payment_data.get('payment_method_id', 'N/A')} | Tipo: {payment_data.get('payment_type_id', 'N/A')}"
                            )
                            session.add(payment)

                            # Actualizar estado de la factura
                            total_paid = session.exec(
                                select(Payment).where(Payment.invoice_id == invoice_id)
                            ).all()
                            total_amount = sum(p.amount for p in total_paid) + payment.amount

                            if total_amount >= invoice.total - 0.01:  # tolerancia centavos
                                invoice.status = "pagado"
                            elif total_amount > 0:
                                invoice.status = "parcial"

                            session.add(invoice)
                            session.commit()

                            print(f"[WEBHOOK MP] ✅ Pago registrado: Invoice #{invoice_id}, Monto: ${payment.amount}")

                            return {"status": "ok", "message": "Pago registrado automáticamente"}
                        else:
                            print(f"[WEBHOOK MP] ⚠️ Invoice {invoice_id} no encontrada")
                    else:
                        print(f"[WEBHOOK MP] ⚠️ External reference no válida: {external_ref}")

        return {"status": "ok"}

    except Exception as e:
        print(f"[WEBHOOK MP] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@router.get("/payment/{payment_id}")
async def get_payment_status(payment_id: str):
    """
    Consultar el estado de un pago de MercadoPago
    """
    result = MercadoPagoService.get_payment_info(payment_id)

    if result["success"]:
        payment = result["payment"]
        return {
            "status": payment["status"],
            "status_detail": payment["status_detail"],
            "amount": payment["transaction_amount"],
            "payment_method": payment.get("payment_method_id"),
            "external_reference": payment.get("external_reference")
        }
    else:
        raise HTTPException(500, result.get("error", "Error al consultar pago"))

class QuickPaymentRequest(BaseModel):
    client_id: int
    amount: float
    description: str

@router.post("/quick-payment")
async def create_quick_payment(
    request: QuickPaymentRequest,
    session: Session = Depends(get_session)
):
    """
    Crear un link de pago rápido sin factura (para cobros eventuales)
    """
    # Verificar que el cliente existe
    client = session.get(Client, request.client_id)
    if not client:
        raise HTTPException(404, "Cliente no encontrado")

    # Usar email del cliente o uno por defecto
    client_email = client.whatsapp or client.phone or "cliente@poolpay.com"
    if "@" not in client_email:
        client_email = f"{client_email}@poolpay.com"

    result = MercadoPagoService.create_payment_link(
        title=f"Cobro rápido - {client.name}",
        amount=request.amount,
        client_email=client_email,
        external_reference=f"quick_payment_{client.id}_{datetime.now().timestamp()}",
        description=request.description
    )

    if result["success"]:
        return {
            "success": True,
            "payment_link": result["init_point"],
            "message": f"Link de pago creado para {client.name}"
        }
    else:
        raise HTTPException(500, result.get("error", "Error al crear link de pago"))

