import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.auth import require_auth
from app.routers import clients, invoices, payments, billing, mercadopago, bank, orphan_payments
from app.routers.auth import router as auth_router
from app.services.overdue import mark_overdue_sync, overdue_scheduler
from app.services.billing_scheduler import billing_scheduler
from app.services.reminders import reminders_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    init_db()
    mark_overdue_sync()  # verificar vencimientos al arrancar

    tasks = [
        asyncio.create_task(overdue_scheduler()),       # vencidas (24h)
        asyncio.create_task(billing_scheduler()),       # facturación mensual
        asyncio.create_task(reminders_scheduler()),     # recordatorios diarios
    ]
    yield
    # ── Shutdown ─────────────────────────────────────────────
    for t in tasks:
        t.cancel()


# CORS — en producción setear BACKEND_CORS_ORIGINS en .env
_raw_origins = os.getenv("BACKEND_CORS_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else ["*"]  # dev: permitir todo
)

app = FastAPI(
    title="PoolPay API",
    description="API REST para gestión de clientes, facturación y pagos de piscinas",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_auth = [Depends(require_auth)]

app.include_router(auth_router)
app.include_router(clients.router, dependencies=_auth)
app.include_router(invoices.router, dependencies=_auth)
app.include_router(payments.router, dependencies=_auth)
app.include_router(billing.router, dependencies=_auth)
app.include_router(bank.router, dependencies=_auth)
app.include_router(orphan_payments.router, dependencies=_auth)
app.include_router(mercadopago.router)  # webhook sin auth (lo llama MP)


@app.get("/")
def root():
    return {"name": "PoolPay API", "version": "1.0.0", "docs": "/docs"}
