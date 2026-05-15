"""
Simulador de TRANSFERENCIA CBU (pago sin link MP).

A diferencia de simular_webhook.py (que simula un pago con link, con
external_reference='invoice_X'), este script simula una transferencia
directa al CBU/CVU de tu MercadoPago. El payload NO trae external_reference,
así que el sistema tiene que adivinar a qué factura aplicarlo usando el
matcher inteligente.

Posibles resultados:
  • match_mode=auto_smart  → un solo candidato claramente ganador,
                              se asignó solo (igual que un link)
  • match_mode=orphan       → varios candidatos o ninguno claro,
                              quedó en bandeja de "Pagos sin asignar"

USO:
    cd D:\\proyectos\\TPS-APP\\poolpay-backend

    # Defaults: $100, payer "Juan Pérez"
    python simular_transferencia.py

    # Custom: $250, payer "Maria Gomez"
    python simular_transferencia.py 250 "Maria Gomez"

    # Custom completo (monto, nombre, dni)
    python simular_transferencia.py 1500 "Cliente Test Webhook" 12345678
"""
import sys
import json
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

# ── Args ────────────────────────────────────────────────────────────────────
AMOUNT = float(sys.argv[1]) if len(sys.argv) > 1 else 100.0
PAYER_FULLNAME = sys.argv[2] if len(sys.argv) > 2 else "Juan Pérez"
PAYER_DNI = sys.argv[3] if len(sys.argv) > 3 else None

FAKE_MP_PAYMENT_ID = str(int(datetime.now().timestamp() * 1000))

parts = PAYER_FULLNAME.split(" ", 1)
PAYER_FIRST = parts[0]
PAYER_LAST = parts[1] if len(parts) > 1 else ""

# ── Mockear MercadoPagoService.get_payment_info ─────────────────────────────
import app.services.mercadopago_service as mp_svc


def fake_get_payment_info(payment_id: str):
    """Mock que simula un pago aprobado vía transferencia CBU, sin external_reference."""
    payer = {
        "first_name": PAYER_FIRST,
        "last_name": PAYER_LAST,
    }
    if PAYER_DNI:
        payer["identification"] = {"type": "DNI", "number": PAYER_DNI}

    return {
        "success": True,
        "payment": {
            "id": payment_id,
            "status": "approved",
            "status_detail": "accredited",
            "transaction_amount": AMOUNT,
            "payment_method_id": "cvu",
            "payment_type_id": "bank_transfer",
            "external_reference": "",   # ← clave: no hay referencia
            "date_approved": datetime.now(timezone.utc).isoformat(),
            "payer": payer,
        },
    }


mp_svc.MercadoPagoService.get_payment_info = staticmethod(fake_get_payment_info)

# ── Importar app después del patch ──────────────────────────────────────────
from fastapi.testclient import TestClient
from app.main import app


def main():
    print("=" * 72)
    print("  SIMULADOR DE TRANSFERENCIA AL CBU (sin link MP)")
    print("=" * 72)
    print(f"  Monto recibido:        ${AMOUNT:.2f}")
    print(f"  Payer (quien transfirió): {PAYER_FULLNAME}")
    if PAYER_DNI:
        print(f"  DNI del payer:         {PAYER_DNI}")
    print(f"  MP payment_id ficticio: {FAKE_MP_PAYMENT_ID}")
    print(f"  Tipo:                  bank_transfer (CVU)")
    print(f"  external_reference:    (vacío — sin link)")
    print("=" * 72)

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

    print("\n→ POST /mercadopago/webhook")
    with TestClient(app) as client:
        response = client.post("/mercadopago/webhook", json=webhook_payload)

        print(f"← HTTP {response.status_code}")
        try:
            body = response.json()
            print("← Body:")
            print(json.dumps(body, indent=4, ensure_ascii=False))
        except Exception:
            print(f"← Body raw: {response.text}")
            return

        mode = body.get("match_mode", "?")
        print()
        print("=" * 72)
        if mode == "auto_smart":
            print(f"  ✅  AUTO-MATCH EXITOSO")
            print("=" * 72)
            print(f"  El sistema identificó a un cliente único con alta confianza")
            print(f"  y asignó el pago solo (sin tu intervención).")
            print(f"")
            print(f"  Factura asignada: #{body.get('invoice_id')}")
            print(f"  Pago creado:      #{body.get('payment_id')}")
            print(f"  Verificá en: http://localhost:3000/payments")
        elif mode == "orphan":
            print(f"  🟡  PAGO QUEDÓ COMO HUÉRFANO")
            print("=" * 72)
            print(f"  El sistema no encontró un match seguro (0 o varios candidatos).")
            print(f"  El pago quedó en la bandeja de revisión manual para que vos")
            print(f"  lo asignes desde el panel.")
            print(f"")
            print(f"  Orphan ID: #{body.get('orphan_id')}")
            print(f"  Revisalo en: http://localhost:3000/orphan-payments")
            print(f"  o por API:   GET http://localhost:8000/orphan-payments/{body.get('orphan_id')}")
        elif mode == "link":
            print(f"  ✅ Pago vía link (inesperado en este test)")
        else:
            print(f"  ⚠️  match_mode={mode} — revisá los logs del backend")
        print("=" * 72)


if __name__ == "__main__":
    main()
