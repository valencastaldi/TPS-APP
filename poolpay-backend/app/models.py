from datetime import datetime, date, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column, String

class Client(SQLModel, table=True):
    __tablename__ = "clients"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(120), nullable=False))
    phone: Optional[str] = Field(default=None, sa_column=Column(String(30)))
    whatsapp: Optional[str] = Field(default=None, sa_column=Column(String(30)))
    address: Optional[str] = Field(default=None, sa_column=Column(String(200)))
    city: Optional[str] = Field(default=None, sa_column=Column(String(80)))
    plan: str = Field(sa_column=Column(String(20)))  # "semanal", "quincenal", "mensual"
    price: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="clients.id")
    period: str
    issue_date: date
    due_date: date
    subtotal: float
    extras: float = 0.0
    total: float
    status: str = Field(default="pendiente", sa_column=Column(String(20)))  # "pendiente", "pagado", "parcial", "vencido"

class Payment(SQLModel, table=True):
    __tablename__ = "payments"
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoices.id")
    paid_at: datetime
    method: str = Field(sa_column=Column(String(20)))  # "efectivo", "transferencia", "mercado_pago"
    amount: float
    notes: Optional[str] = None

