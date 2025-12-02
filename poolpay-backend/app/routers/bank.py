from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date, timezone
from sqlmodel import Session, select
from app.db import get_session
from app.models import Invoice, Payment, Client

router = APIRouter(prefix="/bank", tags=["bank"])

class BankTransaction(BaseModel):
    transaction_id: Optional[str] = None
    date: datetime
    amount: float
    description: Optional[str] = None
    reference: Optional[str] = None
    account_to: Optional[str] = None

class BankImportRequest(BaseModel):
    transactions: List[BankTransaction]


def _get_invoice_unpaid_amount(session: Session, invoice: Invoice) -> float:
    payments = session.exec(select(Payment).where(Payment.invoice_id == invoice.id)).all()
    paid = sum(p.amount for p in payments) if payments else 0.0
    return float(invoice.total or 0.0) - float(paid)


@router.post("/transactions/process")
def process_bank_transactions(payload: BankImportRequest, session: Session = Depends(get_session)):
    """Recibe un lote de transacciones bancarias y las intenta emparejar con facturas pendientes.

    Lógica de coincidencia (heurística):
    - Para cada transacción, busca facturas con estado distinto de 'pagado'.
    - Calcula unpaid_amount = invoice.total - sum(payments).
    - Selecciona la factura cuyo unpaid_amount sea lo más cercano al monto de la transacción
      (dentro de una tolerancia).
    - Si la `reference` o `description` contiene el id de factura (p.ej. "invoice_123") o el teléfono del cliente,
      eso aumenta la prioridad de la coincidencia.

    Si encuentra coincidencia, crea un `Payment` y actualiza el estado de la `Invoice`.
    Devuelve un resumen por transacción.
    """
    TOLERANCE = 1.0  # ARS - tolerancia para emparejar montos

    results = []

    # Preleer facturas pendientes/por pagar
    candidates = session.exec(select(Invoice).where(Invoice.status != 'pagado')).all()

    for tx in payload.transactions:
        matched = None
        best_score = None
        best_invoice = None

        # Normalizar texto para búsqueda
        tx_text = " ".join(filter(None, [tx.reference, tx.description])).lower() if (tx.reference or tx.description) else ""

        for inv in candidates:
            unpaid = _get_invoice_unpaid_amount(session, inv)
            # difference absoluto entre lo que falta y lo que vino
            diff = abs(unpaid - float(tx.amount))

            # base score: menor diff => mejor
            score = diff

            # si la referencia/texto menciona "invoice_{id}" mejor prioridad
            if f"invoice_{inv.id}" in tx_text:
                score -= 5

            # si la referencia menciona el nombre o telefono del cliente, priorizar
            client = session.get(Client, inv.client_id)
            if client:
                if client.phone and client.phone in tx_text:
                    score -= 3
                if client.whatsapp and client.whatsapp in tx_text:
                    score -= 3
                if client.name and client.name.lower() in tx_text:
                    score -= 1

            # escoger mejor invoice que esté dentro de tolerancia razonable
            if diff <= max(TOLERANCE, 0.01) or score < 2:
                if best_score is None or score < best_score:
                    best_score = score
                    best_invoice = inv

        if best_invoice:
            # Registrar pago
            paid_at = tx.date if isinstance(tx.date, datetime) else datetime.combine(tx.date, datetime.min.time()).replace(tzinfo=timezone.utc)
            payment = Payment(
                invoice_id=best_invoice.id,
                paid_at=paid_at,
                method="transferencia",
                amount=float(tx.amount),
                notes=f"Banco TX: {tx.transaction_id or ''} | ref:{tx.reference or ''} | desc:{tx.description or ''}"
            )
            session.add(payment)

            # actualizar estado de la factura
            total_paid = sum(p.amount for p in session.exec(select(Payment).where(Payment.invoice_id == best_invoice.id)).all()) + 0.0
            # recalcular con el nuevo pago incluido
            total_paid = total_paid
            if total_paid >= best_invoice.total - 0.01:
                best_invoice.status = 'pagado'
            elif total_paid > 0:
                best_invoice.status = 'parcial'

            session.add(best_invoice)
            session.commit()

            results.append({
                "transaction_id": tx.transaction_id,
                "matched": True,
                "invoice_id": best_invoice.id,
                "amount": tx.amount,
                "message": f"Pago aplicado a factura {best_invoice.id}"
            })

            # remove this invoice from candidates if now fully paid
            if best_invoice.status == 'pagado':
                candidates = [c for c in candidates if c.id != best_invoice.id]
        else:
            results.append({
                "transaction_id": tx.transaction_id,
                "matched": False,
                "amount": tx.amount,
                "message": "No se encontró factura candidata. Requiere conciliación manual."
            })

    return {"processed": len(payload.transactions), "results": results}

