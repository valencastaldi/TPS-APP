from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from app.routers import clients, invoices, payments, billing, mercadopago
from app.routers import bank

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (si necesitas limpiar recursos)

app = FastAPI(
    title="PoolPay API",
    description="API REST para gestión de clientes, facturación y pagos de piscinas",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(clients.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(billing.router)
app.include_router(mercadopago.router)
app.include_router(bank.router)

@app.get("/")
def root():
    """Endpoint raíz con información de la API"""
    return {
        "name": "PoolPay API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "clients": "/clients",
            "invoices": "/invoices",
            "payments": "/payments",
            "billing": "/billing",
            "mercadopago": "/mercadopago",
            "bank": "/bank"
        }
    }
