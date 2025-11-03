# 🧪 Prueba Rápida - PoolPay API

## Reinicia el servidor primero:
```
Ctrl+C
run.bat
```

Luego abre: http://localhost:8000/docs

---

## 1️⃣ Crear tu primer cliente

En `/clients` → `POST /clients` → Try it out:

```json
{
  "name": "Juan Pérez",
  "phone": "555-1234",
  "whatsapp": "555-9999",
  "address": "Av. Siempre Viva 123",
  "city": "Springfield",
  "plan": "mensual",
  "price": 150.0,
  "is_active": true
}
```

Click **Execute** → Verás el cliente creado con `id: 1`

---

## 2️⃣ Generar facturas del mes

En `/billing` → `POST /billing/generate` → Try it out:

```json
{
  "period": "2025-01",
  "due_day": 10
}
```

Click **Execute** → Verás cuántas facturas se crearon

---

## 3️⃣ Ver las facturas generadas

En `/invoices` → `GET /invoices` → Try it out → Execute

Verás todas las facturas creadas

---

## 4️⃣ Registrar un pago

En `/payments` → `POST /payments` → Try it out:

```json
{
  "invoice_id": 1,
  "method": "efectivo",
  "amount": 150.0,
  "notes": "Pago completo del mes"
}
```

Click **Execute** → La factura cambiará automáticamente a "pagado"

---

## 5️⃣ Ver el resumen

En `/billing` → `GET /billing/summary/2025-01` → Execute

Verás:
- Total facturado
- Total cobrado
- Facturas pendientes
- Estadísticas del período

---

## 6️⃣ Ver estadísticas generales

En `/billing` → `GET /billing/stats` → Execute

Verás el resumen completo de tu negocio

---

## ✅ ¡Listo!

Ya probaste todas las funcionalidades principales.

**Sigue explorando los demás endpoints en http://localhost:8000/docs**

