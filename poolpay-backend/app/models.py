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
    neighborhood: Optional[str] = Field(default=None, sa_column=Column(String(80)))  # Barrio
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


class ProcessedMpPayment(SQLModel, table=True):
    """Registro de pagos de MercadoPago ya procesados (idempotencia del webhook)."""
    __tablename__ = "processed_mp_payments"
    id: Optional[int] = Field(default=None, primary_key=True)
    mp_payment_id: str = Field(sa_column=Column(String(64), nullable=False, unique=True, index=True))
    invoice_id: Optional[int] = Field(default=None, foreign_key="invoices.id")
    payment_id: Optional[int] = Field(default=None, foreign_key="payments.id")
    status: str = Field(sa_column=Column(String(20)))  # approved, rejected, pending, ...
    amount: Optional[float] = None
    raw: Optional[str] = Field(default=None, sa_column=Column(String(2000)))
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrphanPayment(SQLModel, table=True):
    """Pago de MercadoPago recibido sin external_reference (ej: transferencia directa al CBU)
    que el sistema no pudo asociar automáticamente a una factura.

    Se acumulan acá para revisión manual. Cuando el usuario los asigna a una factura
    desde el panel, se crea un Payment normal y el OrphanPayment queda con status='assigned'.
    """
    __tablename__ = "orphan_payments"
    id: Optional[int] = Field(default=None, primary_key=True)
    mp_payment_id: str = Field(sa_column=Column(String(64), nullable=False, unique=True, index=True))
    amount: float
    paid_at: datetime
    payer_name: Optional[str] = Field(default=None, sa_column=Column(String(200)))
    payer_dni: Optional[str] = Field(default=None, sa_column=Column(String(40)))
    payment_type: Optional[str] = Field(default=None, sa_column=Column(String(40)))
    payment_method: Optional[str] = Field(default=None, sa_column=Column(String(40)))
    raw: Optional[str] = Field(default=None, sa_column=Column(String(2000)))
    status: str = Field(default="pending_review", sa_column=Column(String(20)))  # pending_review, assigned, discarded
    assigned_payment_id: Optional[int] = Field(default=None, foreign_key="payments.id")
    assigned_invoice_id: Optional[int] = Field(default=None, foreign_key="invoices.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None


class ReminderLog(SQLModel, table=True):
    """Registro de recordatorios de cobranza enviados (evita duplicados)."""
    __tablename__ = "reminder_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoices.id")
    kind: str = Field(sa_column=Column(String(20)))  # "pre_due", "due", "overdue_3", "overdue_7", ...
    channel: str = Field(sa_column=Column(String(20)))  # "email", "whatsapp", "log"
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    success: bool = True
    detail: Optional[str] = Field(default=None, sa_column=Column(String(500)))
