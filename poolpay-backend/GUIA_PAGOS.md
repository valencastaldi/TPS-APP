# 💰 Guía de Registro de Pagos - PoolPay

## 🎯 Cómo Funciona

Cuando un cliente te paga (por cualquier medio), tú lo registras en el sistema y **automáticamente**:
- ✅ Se marca el pago como recibido
- ✅ Se actualiza el estado de la factura
- ✅ Se calcula el saldo restante
- ✅ Si está todo pagado, la factura se marca como "pagado"

---

## 📱 Métodos de Pago Soportados

### 1️⃣ Transferencia Bancaria
### 2️⃣ Efectivo
### 3️⃣ MercadoPago (automático con webhook)

---

## 🔄 Flujo de Trabajo Real

### Ejemplo: Cliente Juan Pérez

**1. Cliente debe $100 (Factura #5)**

**2. Juan te hace una transferencia de $100**

**3. Te llega notificación bancaria:**
```
Transferencia recibida
Monto: $100
Referencia: 123456789
De: Juan Pérez
```

**4. Registras el pago en PoolPay:**

#### Opción A: Desde la API (http://localhost:8000/docs)

**Endpoint:** `POST /payments/register-bank-transfer`

**Body:**
```json
{
  "invoice_id": 5,
  "amount": 100.00,
  "reference": "123456789",
  "notes": "Pago completo mes enero"
}
```

**Respuesta:**
```json
{
  "message": "Transferencia registrada exitosamente",
  "payment_id": 12,
  "invoice_status": "pagado",
  "total_paid": 100.00,
  "invoice_total": 100.00,
  "remaining": 0
}
```

✅ **Factura marcada automáticamente como PAGADA**

---

## 💵 Registrar Pago en Efectivo

**Cuando un cliente te paga en efectivo:**

**Endpoint:** `POST /payments/register-cash`

```json
{
  "invoice_id": 5,
  "amount": 100.00,
  "notes": "Pagado en efectivo el 28/10/2025"
}
```

**Respuesta:**
```json
{
  "message": "Pago en efectivo registrado",
  "payment_id": 13,
  "invoice_status": "pagado",
  "total_paid": 100.00,
  "invoice_total": 100.00,
  "remaining": 0
}
```

---

## 💳 MercadoPago (Automático)

### Opción 1: Generar Link de Pago

**Endpoint:** `POST /mercadopago/create-payment-link`

```json
{
  "invoice_id": 5,
  "client_email": "juan@example.com",
  "description": "Factura enero 2025"
}
```

**Respuesta:**
```json
{
  "success": true,
  "payment_link": "https://mpago.la/2XYZ123",
  "preference_id": "1234567890"
}
```

**¿Qué hacer?**
1. Copia el `payment_link`
2. Envíaselo al cliente por WhatsApp/Email
3. El cliente paga con su tarjeta
4. **MercadoPago notifica automáticamente a tu sistema**
5. **El pago se registra solo** ✨
6. **La factura se marca como pagada automáticamente**

### Configuración Necesaria para MercadoPago:

**1. Obtén tus credenciales en:** https://www.mercadopago.com.ar/developers/

**2. Edita el archivo `.env`:**
```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1234567890-abcdef-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-1234567890-abcdef-...
```

**3. Instala la dependencia:**
```cmd
cd "D:\app pool store\poolpay-backend"
.venv\Scripts\activate
pip install mercadopago
```

**4. Reinicia el servidor:**
```cmd
Ctrl+C
run.bat
```

---

## 📊 Ver Pagos de un Cliente

**Endpoint:** `GET /payments/by-client/{client_id}`

**Ejemplo:** `GET /payments/by-client/1`

**Respuesta:** Lista de todos los pagos del cliente

```json
[
  {
    "id": 12,
    "invoice_id": 5,
    "paid_at": "2025-01-28T10:30:00Z",
    "method": "transferencia",
    "amount": 100.00,
    "notes": "Ref: 123456789. Pago completo mes enero"
  },
  {
    "id": 8,
    "invoice_id": 4,
    "paid_at": "2024-12-28T14:20:00Z",
    "method": "efectivo",
    "amount": 100.00,
    "notes": "Pago en efectivo"
  }
]
```

---

## 🎯 Casos de Uso Comunes

### Caso 1: Pago Completo por Transferencia

Cliente debe $150, te transfiere $150:

```json
POST /payments/register-bank-transfer
{
  "invoice_id": 10,
  "amount": 150.00,
  "reference": "987654321"
}
```

✅ Factura → **PAGADA**

---

### Caso 2: Pago Parcial en Efectivo

Cliente debe $150, te da $80 en efectivo:

```json
POST /payments/register-cash
{
  "invoice_id": 10,
  "amount": 80.00,
  "notes": "Pago parcial, queda $70"
}
```

⚠️ Factura → **PARCIAL** (total_paid: $80, remaining: $70)

Luego te paga los $70 restantes:

```json
POST /payments/register-cash
{
  "invoice_id": 10,
  "amount": 70.00,
  "notes": "Saldo restante"
}
```

✅ Factura → **PAGADA** (total_paid: $150, remaining: $0)

---

### Caso 3: Cliente Paga con MercadoPago

1. Generas el link de pago
2. Se lo envías por WhatsApp
3. El cliente paga
4. **El sistema registra automáticamente** sin que hagas nada
5. Recibes el dinero en tu cuenta de MercadoPago

---

## 🔔 Webhook de MercadoPago (Automático)

Cuando un cliente paga con MercadoPago:

1. Cliente hace click en el link de pago
2. Paga con su tarjeta
3. **MercadoPago llama a:** `POST /mercadopago/webhook`
4. **Tu sistema automáticamente:**
   - Verifica que el pago fue aprobado
   - Busca la factura correspondiente
   - Crea el registro de pago
   - Actualiza el estado a "pagado"
5. **¡Todo automático!** ✨

---

## 📱 Uso Desde el Frontend

Cuando tengas el frontend corriendo (http://localhost:3000):

### Registrar Transferencia:
1. Ve a la página de Pagos
2. Click en "Registrar Pago"
3. Selecciona "Transferencia"
4. Ingresa:
   - Factura
   - Monto
   - Referencia
5. Click "Guardar"

✅ **Factura actualizada automáticamente**

---

## 🎓 Mejores Prácticas

### ✅ Hacer:
- Registrar el pago tan pronto como te llegue
- Incluir la referencia bancaria en las notas
- Verificar que el monto coincida con la factura

### ❌ Evitar:
- Olvidarte de registrar pagos (lleva un control)
- Duplicar pagos (verifica primero si ya está registrado)

---

## 🔍 Verificar Estado de Facturas

**Endpoint:** `GET /invoices?status=pendiente`

Ver todas las facturas pendientes de pago

**Endpoint:** `GET /invoices?client_id=1`

Ver todas las facturas de un cliente específico

---

## 💡 Ejemplo Completo de Workflow

**1. Cliente María González debe $200 (Factura #15)**

**2. María te hace 2 transferencias:**
   - Primera: $120
   - Segunda: $80

**3. Registras la primera transferencia:**
```json
POST /payments/register-bank-transfer
{
  "invoice_id": 15,
  "amount": 120.00,
  "reference": "TRF001",
  "notes": "Primer pago parcial"
}
```

**Respuesta:**
```json
{
  "invoice_status": "parcial",
  "total_paid": 120.00,
  "remaining": 80.00
}
```

**4. Registras la segunda transferencia:**
```json
POST /payments/register-bank-transfer
{
  "invoice_id": 15,
  "amount": 80.00,
  "reference": "TRF002",
  "notes": "Pago final"
}
```

**Respuesta:**
```json
{
  "invoice_status": "pagado",
  "total_paid": 200.00,
  "remaining": 0
}
```

✅ **Factura #15 completamente pagada**

---

## 🚀 Próximos Pasos

1. **Instala MercadoPago SDK:**
   ```cmd
   pip install mercadopago
   ```

2. **Configura tus credenciales en `.env`**

3. **Reinicia el servidor**

4. **Prueba registrar un pago de prueba**

5. **Verifica en el frontend que la factura cambió a "pagado"**

---

**¡Tu sistema de pagos está completo!** 🎉

Ahora cuando recibas pagos (transferencia, efectivo o MercadoPago), solo los registras y el sistema hace todo automáticamente.

