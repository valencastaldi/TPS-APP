"""Pequeño script para probar el endpoint /bank/transactions/process

Uso: python tools\bank_importer.py
Este script hace un POST con varias transacciones de ejemplo al endpoint local.
"""
import requests
from datetime import datetime

URL = "http://127.0.0.1:8000/bank/transactions/process"

payload = {
    "transactions": [
        {
            "transaction_id": "TX-001",
            "date": datetime.utcnow().isoformat(),
            "amount": 150.0,
            "description": "Pago servicio invoice_1",
            "reference": "invoice_1",
            "account_to": "CUIT 00-00000000-0"
        },
        {
            "transaction_id": "TX-002",
            "date": datetime.utcnow().isoformat(),
            "amount": 200.0,
            "description": "Transferencia cliente 2392618680"
        }
    ]
}

r = requests.post(URL, json=payload)
print(r.status_code)
print(r.text)

