"""
Simulador del webhook de MercadoPago para PoolPay.

Reproduce EXACTAMENTE lo que pasa en producción cuando un cliente paga:

    1. MercadoPago manda un POST a /mercadopago/webhook con un payload tipo:
         { "action": "payment.created", "type": "payment", "data": { "id": "..." } }
    2. Tu backend consulta a MP los detalles del pago (status, monto, external_ref)
    3. Si el status es "approved" y la referencia externa empieza con "invoice_",
       crea un registro en la tabla `payments` y recalcula el estado de la
       factura → pasa de "pendiente" a "pagado".
    4. El frontend muestra el pago al refrescar.

Este script ejecuta todo eso pero "mockea" el paso 2 (la consulta a MP) con
datos canned approved, para no depender del sandbox de MP que tiene quirks.

Importante: usa la MISMA base de datos que tu backend (la que está en .env).
Después de correrlo podés refrescar tu frontend y vas a ver:
  - http://localhost:3000/invoices  → factura marcada como "pagado"
  - http://localhost:3000/payments  → un pago nuevo con método "mercado_pago"

USO:
    cd D:\\proyectos\\TPS-APP\\poolpay-backend
    python simular_webhook.py             # default: invoice_id=107, monto=100
    python simular_webhook.py 42           # invoice_id=42
    python simular_webhook.py 42 250.50    # invoice_id=42, monto=250.50
"""

import os
import sys
import json
from datetime import datetime, timezone

# ── 1. Cargar variables de entorno ───────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

# 🛡️ Guard de producción — este script INYECTA PAGOS FALSOS en la DB.
# Solo debe correr en entornos de desarrollo. Si la variable ENV=production
# está seteada, el script aborta antes de hacer nada.
if os.getenv("ENV", "").lower() == "production":
    print("=" * 72)
    print("  ❌ SCRIPT BLOQUEADO")
    print("=" * 72)
    print("  Este simulador crea pagos falsos. NO debe correr en producción.")
    print("  Si esto fue un error, revertí ENV=production en tu entorno.")
    print("=" * 72)
    sys.exit(1)

# ── 2. Parsear argumentos ────────────────────────────────────────────────────
INVOICE_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 107
AMOUNT = float(sys.argv[2]) if len(sys.argv) > 2 else 100.0
FAKE_MP_PAYMENT_ID = str(int(datetime.now().timestamp() * 1000))

# ── 3. Mockear MercadoPagoService.get_payment_info ──────────────────────────
# Hacemos esto ANTES de importar el router, para asegurarnos que cuando el
# webhook llame al servicio, vea nuestro mock en vez del SDK real de MP.
import app.services.mercadopago_service as mp_svc

def fake_get_payment_info(payment_id: str):
    """Reemplazo del call real a MP. Devuelve un pago 'approved' canned."""
    return {
        "success": True,
        "payment": {
            "id": payment_id,
            "status": "approved",
            "status_detail": "accredited",
            "transaction_amount": AMOUNT,
            "payment_method_id": "master",
            "payment_type_id": "credit_card",
            "external_reference": f"invoice_{INVOICE_ID}",
            "date_approved": datetime.now(timezone.utc).isoformat(),
            "payer": {"email": "test_user@simulated.com"},
        },
    }

mp_svc.MercadoPagoService.get_payment_info = staticmethod(fake_get_payment_info)

# ── 4. Ahora sí, importar la app y el TestClient ────────────────────────────
from fastapi.testclient import TestClient
from app.main import app


def main():
    print("=" * 72)
    print("  SIMULADOR DE WEBHOOK MERCADOPAGO - PoolPay")
    print("=" * 72)
    print(f"  Factura a marcar como pagada:   #{INVOICE_ID}")
    print(f"  Monto simulado:                 ${AMOUNT:.2f}")
    print(f"  MP payment_id ficticio:         {FAKE_MP_PAYMENT_ID}")
    print(f"  Status simulado:                approved")
    print("=" * 72)

    # Payload IDÉNTICO al que manda MercadoPago en producción
    webhook_payload = {
        "action": "payment.created",
        "api_version": "v1",
        "data": {"id": FAKE_MP_PAYMENT_ID},
        "date_created": datetime.now(timezone.utc).isoformat(),
        "id": int(datetime.now().timestamp()),
        "live_mode": False,
        "type": "payment",
        "user_id": "688274381",
    }

    print("\n→ Enviando POST /mercadopago/webhook")
    print(f"  Headers: Content-Type: application/json")
    print(f"  Body:    {json.dumps(webhook_payload, indent=11)}")
    print()

    with TestClient(app) as client:
        response = client.post(
            "/mercadopago/webhook",
            json=webhook_payload,
        )

        print(f"← HTTP {response.status_code}")
        try:
            print(f"← Response body:")
            print(json.dumps(response.json(), indent=4, ensure_ascii=False))
        except Exception:
            print(f"← Body raw: {response.text}")

        print()
        if response.status_code == 200:
            data = response.json()
            if data.get("invoice_id"):
                print("=" * 72)
                print("  ✅  PAGO REGISTRADO AUTOMÁTICAMENTE")
                print("=" * 72)
                print(f"  Factura #{data['invoice_id']} → estado actualizado")
                print(f"  Pago interno #{data.get('payment_id')} creado")
                print(f"  MP payment_id: {data['mp_payment_id']}")
                print(f"  MP status:     {data['mp_status']}")
                print()
                print("  Verificá visualmente:")
                print(f"    http://localhost:3000/invoices")
                print(f"    http://localhost:3000/payments")
                print(f"    http://localhost:8000/invoices/{INVOICE_ID}")
                print("=" * 72)
            else:
                print("⚠️  El webhook respondió 200 pero no procesó el pago.")
                print("    Causas posibles:")
                print(f"    - La factura #{INVOICE_ID} no existe en la BD")
                print(f"    - El payment_id ya fue procesado antes (idempotencia)")
                print(f"    - Mirá el response arriba para más detalle.")
        else:
            print("❌  Webhook falló. Revisá la respuesta arriba.")


if __name__ == "__main__":
    main()
