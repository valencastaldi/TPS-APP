from typing import Optional, Literal
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

Plan = Literal["semanal", "quincenal", "mensual"]
Status = Literal["pendiente", "pagado", "parcial", "vencido"]
PaymentMethod = Literal["efectivo", "transferencia", "mercado_pago"]

# Client Schemas
class ClientCreate(BaseModel):
    name: str = Field(..., max_length=120)
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    plan: Plan
    price: Optional[float] = Field(default=None, description="Precio del plan; si se omite queda 0.0")
    is_active: Optional[bool] = True

class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    plan: Optional[Plan] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None

# Invoice Schemas
class InvoiceCreate(BaseModel):
    client_id: int
    period: str  # Formato: "YYYY-MM"
    issue_date: date
    due_date: date
    subtotal: float
    extras: Optional[float] = 0.0
    status: Optional[Status] = "pendiente"

class InvoiceUpdate(BaseModel):
    extras: Optional[float] = None
    status: Optional[Status] = None
    due_date: Optional[date] = None

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    period: str
    issue_date: date
    due_date: date
    subtotal: float
    extras: float
    total: float
    status: str

# Payment Schemas
class PaymentCreate(BaseModel):
    invoice_id: int
    method: PaymentMethod
    amount: float
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    paid_at: datetime
    method: str
    amount: float
    notes: Optional[str]

# Billing Schemas
class BillingGenerate(BaseModel):
    period: str  # Formato: "YYYY-MM"
    due_day: Optional[int] = 10
