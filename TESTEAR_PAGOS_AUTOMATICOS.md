# Cómo testear los pagos automáticos de PoolPay (paso a paso)

Esta guía te lleva de la mano para probar **de punta a punta** que cuando un cliente paga un link de MercadoPago, tu sistema lo registra solo (vía webhook). Todo se hace en **modo TEST** así que **no se mueve plata real**.

> Tiempo estimado total: 30–40 minutos la primera vez.

---

## Prerrequisitos rápidos

Antes de empezar, asegurate de tener:

- Python instalado y el backend levantando bien con `run.bat`.
- Una cuenta personal de MercadoPago (la que ya usás, no hace falta una nueva).
- Conexión a internet (ngrok abre un túnel desde el celular de MP hasta tu PC).

---

## Paso 1 — Obtener el TEST access token

1. Andá a https://www.mercadopago.com.ar/developers/panel
2. Iniciá sesión con tu cuenta normal de MercadoPago.
3. Click en **"Tus integraciones"** → **"Crear aplicación"**.
   - Nombre: `PoolPay Test` (lo que quieras)
   - Tipo de integración: **"Pagos online"**.
   - Modelo de integración: **"CheckoutPro"** (es el que usa tu backend con `preference().create`).
4. Una vez creada, entrá a la app → menú izquierdo → **"Credenciales"** → pestaña **"Credenciales de prueba"**.
5. Copiá el **Access Token** (empieza con `TEST-...`).

> ⚠️ **Importante**: usá las credenciales de **prueba**, NO las de producción. Si no, te cobra plata real.

---

## Paso 2 — Pegar el token en .env y arrancar el backend

1. Abrí `poolpay-backend\.env` con tu editor.
2. Encontrá la línea `MERCADOPAGO_ACCESS_TOKEN=` y pegá el TEST token:

   ```
   MERCADOPAGO_ACCESS_TOKEN=TEST-1234567890abcdef-...
   MP_VERIFY_SIGNATURE=false
   API_URL=http://localhost:8000
   FRONTEND_URL=http://localhost:3000
   ```

3. Guardá el archivo.
4. Reiniciá el backend:

   ```cmd
   cd D:\proyectos\TPS-APP\poolpay-backend
   run.bat
   ```

5. Verificá que en los logs aparezca:
   - `DB URL usada: ...`
   - `Uvicorn running on http://127.0.0.1:8000`
   - **NO** debe aparecer `MercadoPago no está configurado`.

> 💡 En desarrollo dejamos `MP_VERIFY_SIGNATURE=false` para no tener que firmar HMAC. En producción se pone `true` y se pega el `MERCADOPAGO_WEBHOOK_SECRET` del panel.

---

## Paso 3 — Levantar ngrok (túnel público a tu PC)

MercadoPago necesita una URL pública para mandarte el webhook. `localhost:8000` no le sirve a ellos. ngrok te da una URL temporal `https://abc123.ngrok.io` que apunta a tu PC.

1. Bajate ngrok: https://ngrok.com/download
2. Descomprimí el `ngrok.exe` en una carpeta cómoda (por ejemplo `C:\ngrok\`).
3. (Opcional pero recomendado) Creá cuenta gratis y agregá tu authtoken:
   ```cmd
   C:\ngrok\ngrok.exe authtoken TU_AUTHTOKEN
   ```
4. En una **terminal nueva** (no cierres la del backend), corré:
   ```cmd
   C:\ngrok\ngrok.exe http 8000
   ```
5. Vas a ver algo como:
   ```
   Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
   ```
6. **Copiá esa URL `https://abc123.ngrok-free.app`** — la vas a usar en el siguiente paso.

> 💡 Si ngrok te pide ir a una página de "visit site", abrila una vez en el navegador para autorizar el túnel.

---

## Paso 4 — Configurar el webhook en el panel de MP

1. Volvé a https://www.mercadopago.com.ar/developers/panel
2. Entrá a tu aplicación `PoolPay Test`.
3. Menú izquierdo → **"Webhooks"** → **"Configurar notificaciones"**.
4. Modo: **"Pruebas"**.
5. URL para notificaciones: `https://abc123.ngrok-free.app/mercadopago/webhook`
   - Reemplazá `abc123.ngrok-free.app` por **tu** URL de ngrok.
6. Eventos: marcá **"Pagos"** (`payment`).
7. Guardá.
8. Click en **"Simular"** (botón al lado) para mandar un webhook de prueba. En la consola del backend deberías ver:
   ```
   [webhook MP] type=payment body={...}
   ```

Si ves eso, **el canal está abierto**. ✅

---

## Paso 5 — Crear cliente y factura de prueba

Abrí http://localhost:8000/docs (Swagger).

### 5.1 Crear cliente
`POST /clients` → Try it out → pegá:
```json
{
  "name": "Cliente Test",
  "phone": "1122334455",
  "whatsapp": "1122334455",
  "address": "Calle Falsa 123",
  "city": "CABA",
  "plan": "mensual",
  "price": 100.0,
  "is_active": true
}
```
Execute → te devuelve `"id": 1` (anotá ese ID).

### 5.2 Generar factura del mes
`POST /billing/generate` → pegá:
```json
{
  "period": "2026-05",
  "due_day": 10
}
```
Execute → te devuelve cuántas facturas creó. Andá a `GET /invoices` para ver el ID de la factura (la llamamos `INVOICE_ID`).

### 5.3 Crear el link de pago MP
`POST /mercadopago/create-payment-link` → pegá (reemplazá `INVOICE_ID`):
```json
{
  "invoice_id": INVOICE_ID,
  "client_email": "test_user_123@testuser.com",
  "description": "Cuota mayo 2026"
}
```
Execute → te devuelve:
```json
{
  "success": true,
  "payment_link": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "preference_id": "..."
}
```

**Copiá el `payment_link`** — ese es el link que un cliente real recibiría.

> ⚠️ Si te tira `"MercadoPago no está configurado"`, el .env no se cargó. Reiniciá el backend.

---

## Paso 6 — Crear usuario comprador de prueba

Si pagás el link con tu cuenta personal, MP lo rechaza por usar tus propias credenciales. Hay que crear un **usuario de prueba comprador**.

1. https://www.mercadopago.com.ar/developers/panel/test-users
2. Click en **"Crear usuario de prueba"**.
3. País: Argentina.
4. Te devuelve usuario, password y email (algo como `TESTUSER123456`).
5. **Guardá esas credenciales** — son para loguearte como comprador.

---

## Paso 7 — Pagar el link con tarjeta TEST

1. Abrí una **ventana de incógnito** (importante: para no estar logueado con tu cuenta real).
2. Pegá el `payment_link` del paso 5.3.
3. Logueate con el usuario de prueba comprador del paso 6.
4. Elegí "Tarjeta de crédito".
5. Usá los datos de tarjeta de prueba para que el pago sea **aprobado**:

   | Campo | Valor |
   |---|---|
   | Número | `5031 7557 3453 0604` (Mastercard) |
   | CVV | `123` |
   | Vencimiento | `11/30` (cualquier futura) |
   | Nombre del titular | **`APRO`** ← clave |
   | DNI | `12345678` |

   > 🔑 El nombre `APRO` le dice al simulador "aprobar el pago". Si ponés `OTHE` rechaza, `CONT` queda pendiente, etc.

6. Confirmá el pago. Deberías ver pantalla de éxito y volver a tu frontend (`/payment-success`).

---

## Paso 8 — Verificar que el webhook lo registró

### En la consola del backend
Buscá líneas como:
```
[webhook MP] type=payment body={...}
[webhook MP] ✅ Pago registrado: invoice=1 mp_payment=1234567890 monto=100.0
```

### En Swagger
- `GET /invoices/1` → debe mostrar `"status": "pagado"`.
- `GET /payments` → debe aparecer un pago nuevo con `"method": "mercado_pago"` y notas que mencionan `MP Payment ID: ...`.

### En el frontend
- http://localhost:3000/invoices → la factura aparece en verde / pagada.
- http://localhost:3000/payments → aparece "🤖 MercadoPago" con fecha.

### Idempotencia (bonus)
En el panel de MP > Webhooks > **"Reenviar"** la notificación. En los logs debería decir:
```
[webhook MP] payment_id=... ya procesado, ignoro.
```
Eso prueba que no se duplican pagos aunque MP reintente.

---

## Si algo no funciona

| Síntoma | Causa probable | Fix |
|---|---|---|
| `MercadoPago no está configurado` | El backend no cargó el token | Verificá `.env` y reiniciá `run.bat` |
| ngrok dice "tunnel not found" | El túnel se cayó (sesión gratuita expira) | Volvé a correr `ngrok http 8000` y actualizá la URL en MP |
| El webhook llega pero no marca pagada la factura | El `external_reference` no es `invoice_X` | Verificá en `GET /mercadopago/payment/{id}` que `external_reference` empiece con `invoice_` |
| Pago aprobado pero no aparece en /payments | El webhook nunca llegó | Mirá en panel MP > Webhooks > Logs si hubo 200 OK |
| 401 Invalid signature | Pusiste `MP_VERIFY_SIGNATURE=true` sin secret | En dev dejalo `false` |

---

## Alternativa: testear sin MercadoPago (rápido, sin ngrok)

Si querés probar **solo la lógica del webhook** sin pasar por MP (por ejemplo cuando no tenés internet), podés mockear el servicio y mandarle un POST falso al endpoint. Pedímelo y te paso el script. Esto NO prueba la integración real con MP, pero sí que tu código reacciona bien al payload esperado.

---

**Autor de la guía**: Valentino Castaldi (vibecodeada con Claude)
**Última actualización**: 2026-05-12
