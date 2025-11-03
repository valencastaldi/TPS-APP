# 🚀 PoolPay API - Documentación Completa

## ✅ Desarrollo Completado

La API ahora incluye todas las funcionalidades necesarias para gestionar:
- ✅ Clientes
- ✅ Facturas (Invoices)
- ✅ Pagos (Payments)
- ✅ Facturación automática y reportes

---

## 📋 Endpoints Disponibles

### 👥 CLIENTES (`/clients`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/clients` | Crear cliente |
| `GET` | `/clients` | Listar clientes (filtro por activo/inactivo) |
| `GET` | `/clients/{id}` | Obtener un cliente |
| `PATCH` | `/clients/{id}` | Actualizar cliente |
| `DELETE` | `/clients/{id}` | Eliminar cliente |

**Ejemplo crear cliente:**
```json
POST /clients
{
  "name": "Juan Pérez",
  "phone": "555-1234",
  "whatsapp": "555-1234",
  "address": "Calle Falsa 123",
  "city": "Buenos Aires",
  "plan": "mensual",
  "price": 100.0,
  "is_active": true
}
```

---

### 📄 FACTURAS (`/invoices`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/invoices` | Crear factura manual |
| `GET` | `/invoices` | Listar facturas (filtros: client_id, period, status) |
| `GET` | `/invoices/{id}` | Obtener una factura |
| `PATCH` | `/invoices/{id}` | Actualizar factura (extras, estado, vencimiento) |
| `DELETE` | `/invoices/{id}` | Eliminar factura |
| `GET` | `/invoices/{id}/payments` | Ver pagos de una factura |

**Ejemplo crear factura:**
```json
POST /invoices
{
  "client_id": 1,
  "period": "2025-01",
  "issue_date": "2025-01-01",
  "due_date": "2025-01-10",
  "subtotal": 100.0,
  "extras": 0.0,
  "status": "pendiente"
}
```

**Filtrar facturas:**
```
GET /invoices?client_id=1
GET /invoices?period=2025-01
GET /invoices?status=pendiente
```

---

### 💰 PAGOS (`/payments`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/payments` | Registrar un pago |
| `GET` | `/payments` | Listar pagos (filtro por invoice_id) |
| `GET` | `/payments/{id}` | Obtener un pago |
| `DELETE` | `/payments/{id}` | Eliminar pago (recalcula estado factura) |

**Ejemplo registrar pago:**
```json
POST /payments
{
  "invoice_id": 1,
  "method": "efectivo",
  "amount": 50.0,
  "notes": "Pago parcial"
}
```

**Métodos de pago válidos:**
- `efectivo`
- `transferencia`
- `mercado_pago`

**Automatización:**
- Al registrar un pago, el sistema actualiza automáticamente el estado de la factura:
  - `pendiente` → si no hay pagos
  - `parcial` → si hay pagos pero no cubren el total
  - `pagado` → si los pagos cubren o superan el total

---

### 📊 FACTURACIÓN (`/billing`)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/billing/generate` | Generar facturas automáticamente |
| `GET` | `/billing/summary/{period}` | Resumen de facturación del período |
| `GET` | `/billing/overdue` | Facturas vencidas |
| `GET` | `/billing/stats` | Estadísticas generales |

**Generar facturas automáticas:**
```json
POST /billing/generate
{
  "period": "2025-01",
  "due_day": 10
}
```

**Respuesta:**
```json
{
  "period": "2025-01",
  "created": 15,
  "skipped": 0,
  "total_clients": 15
}
```

**Resumen del período:**
```
GET /billing/summary/2025-01
```

**Respuesta:**
```json
{
  "period": "2025-01",
  "total_invoices": 15,
  "total_amount": 1500.0,
  "paid": 10,
  "pending": 3,
  "partial": 2,
  "overdue": 0,
  "collected": 1200.0,
  "pending_amount": 300.0
}
```

**Facturas vencidas:**
```
GET /billing/overdue
```

**Estadísticas generales:**
```
GET /billing/stats
```

**Respuesta:**
```json
{
  "total_clients": 20,
  "active_clients": 18,
  "inactive_clients": 2,
  "total_invoices": 45,
  "total_payments": 38,
  "total_billed": 4500.0,
  "total_collected": 4200.0,
  "pending_collection": 300.0
}
```

---

## 🔄 Flujo de Trabajo Típico

### 1️⃣ Crear Clientes
```json
POST /clients
{
  "name": "María González",
  "plan": "semanal",
  "price": 25.0
}
```

### 2️⃣ Generar Facturas del Mes
```json
POST /billing/generate
{
  "period": "2025-01",
  "due_day": 10
}
```

### 3️⃣ Ver Facturas Generadas
```
GET /invoices?period=2025-01
```

### 4️⃣ Registrar Pagos
```json
POST /payments
{
  "invoice_id": 5,
  "method": "transferencia",
  "amount": 100.0
}
```

### 5️⃣ Ver Resumen
```
GET /billing/summary/2025-01
```

### 6️⃣ Detectar Morosos
```
GET /billing/overdue
```

---

## 🎨 Planes Disponibles

Valores válidos para el campo `plan`:
- `semanal`
- `quincenal`
- `mensual`

---

## 📝 Estados de Facturas

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Sin pagos registrados |
| `parcial` | Pagos parciales, no cubre total |
| `pagado` | Totalmente pagada |
| `vencido` | Fecha de vencimiento pasada |

---

## 🧪 Probar la API

1. **Abre la documentación interactiva:**
   ```
   http://localhost:8000/docs
   ```

2. **Usa Swagger UI** para probar todos los endpoints

3. **O usa curl/Postman:**
   ```bash
   # Listar clientes
   curl http://localhost:8000/clients
   
   # Crear cliente
   curl -X POST http://localhost:8000/clients \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","plan":"mensual","price":100}'
   
   # Generar facturas
   curl -X POST http://localhost:8000/billing/generate \
     -H "Content-Type: application/json" \
     -d '{"period":"2025-01","due_day":10}'
   ```

---

## 🛡️ Validaciones Automáticas

✅ **Clientes:**
- Plan debe ser: semanal, quincenal o mensual
- Price debe ser mayor a 0

✅ **Facturas:**
- No se pueden crear duplicadas (mismo client_id + period)
- Total se calcula automáticamente (subtotal + extras)
- No se pueden eliminar si tienen pagos

✅ **Pagos:**
- Factura debe existir
- Estado de factura se actualiza automáticamente
- Al eliminar un pago, se recalcula el estado

---

## 📊 Modelos de Datos

### Client
```python
{
  "id": 1,
  "name": "Juan Pérez",
  "phone": "555-1234",
  "whatsapp": "555-1234",
  "address": "Calle Falsa 123",
  "city": "Buenos Aires",
  "plan": "mensual",
  "price": 100.0,
  "is_active": true,
  "created_at": "2025-01-28T10:00:00Z"
}
```

### Invoice
```python
{
  "id": 1,
  "client_id": 1,
  "period": "2025-01",
  "issue_date": "2025-01-01",
  "due_date": "2025-01-10",
  "subtotal": 100.0,
  "extras": 0.0,
  "total": 100.0,
  "status": "pendiente"
}
```

### Payment
```python
{
  "id": 1,
  "invoice_id": 1,
  "paid_at": "2025-01-05T15:30:00Z",
  "method": "efectivo",
  "amount": 100.0,
  "notes": "Pago completo"
}
```

---

## 🚀 Siguiente Paso

**Reinicia el servidor para cargar los nuevos endpoints:**
```cmd
Ctrl+C
run.bat
```

**Luego abre:** http://localhost:8000/docs

**¡Verás todos los nuevos endpoints disponibles!** 🎉

