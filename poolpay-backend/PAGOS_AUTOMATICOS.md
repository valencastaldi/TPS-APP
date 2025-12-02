"""
GUÍA: Configurar Pagos Automáticos con MercadoPago
===================================================

Este sistema permite cobrar AUTOMÁTICAMENTE tanto por link de pago como por transferencia al CBU de MercadoPago.

PASO 1: Obtener tus credenciales de MercadoPago
------------------------------------------------
1. Ingresa a https://www.mercadopago.com.ar/developers
2. Ve a "Tus aplicaciones" → Crea una aplicación
3. Copia tu ACCESS TOKEN (Production o Test según necesites)
4. En el archivo .env del backend, agrega:
   MERCADOPAGO_ACCESS_TOKEN=TU_ACCESS_TOKEN_AQUI

PASO 2: Configurar el Webhook (CRÍTICO para pagos automáticos)
---------------------------------------------------------------
El webhook es la URL que MercadoPago llama automáticamente cuando entra un pago.

1. En tu aplicación de MercadoPago, ve a "Webhooks"
2. Agrega esta URL: https://TU_DOMINIO.com/mercadopago/webhook
   
   Si estás en desarrollo local, usa ngrok:
   - Descarga ngrok: https://ngrok.com/download
   - Ejecuta: ngrok http 8000
   - Copia la URL que te da (ej: https://abc123.ngrok.io)
   - En MercadoPago webhook: https://abc123.ngrok.io/mercadopago/webhook

3. Selecciona los eventos:
   ✅ payment (pagos)
   ✅ merchant_order (órdenes)

4. Guarda y activa el webhook

PASO 3: Generar facturas automáticas cada mes
----------------------------------------------
Opción A - Manual desde la UI:
1. Ve a http://localhost:3000/billing
2. Selecciona el período (ej: 2025-12)
3. Click en "Generar Facturas"
4. El sistema creará facturas para todos los clientes activos

Opción B - Automático con endpoint:
POST http://localhost:8000/billing/auto-generate-and-create-links
Body:
{
  "period": "2025-12",
  "due_day": 10
}

Respuesta: Lista de facturas creadas + links de MercadoPago

PASO 4: Enviar links de pago a clientes
----------------------------------------
Opción 1 - Por WhatsApp (manual):
1. Después de generar facturas, copia los links
2. Envía por WhatsApp: "Hola! Tu factura de diciembre: [LINK]"

Opción 2 - Por email (próximamente):
- Integraremos envío automático por email

Opción 3 - Los clientes te transfieren directo:
- Dale a tus clientes el CBU/CVU de tu cuenta de MercadoPago
- Cuando transfieren, MercadoPago detecta el pago automáticamente
- El webhook registra el pago en el sistema
- La factura se marca como pagada automáticamente

FLUJO COMPLETO DE PAGO AUTOMÁTICO
==================================

1. Sistema genera factura → Cliente ID 123, Factura #456, Monto $150
2. Sistema crea link de MercadoPago → external_reference: "invoice_456"
3. Cliente recibe link por WhatsApp
4. Cliente OPCIÓN A: Paga con el link (tarjeta, débito, etc)
   Cliente OPCIÓN B: Transfiere $150 al CBU de MercadoPago
5. MercadoPago detecta el pago
6. MercadoPago llama al webhook: POST /mercadopago/webhook
7. Webhook busca la factura #456
8. Webhook crea Payment(invoice_id=456, amount=150, method="mercado_pago")
9. Webhook actualiza Invoice status → "pagado"
10. ✅ En la web aparece: "Cliente 123 - Pagado el 02/12/2025"

VERIFICAR QUE FUNCIONA
======================

Test 1 - Crear una factura de prueba:
POST http://localhost:8000/billing/generate
Body: {"period": "2025-12", "due_day": 10}

Test 2 - Crear link de pago:
POST http://localhost:8000/mercadopago/create-payment-link
Body: {
  "invoice_id": 1,
  "client_email": "test@test.com"
}

Test 3 - Simular webhook (después de pagar con el link):
El webhook se llama automáticamente, pero puedes ver logs en la consola del backend.

MONITOREO
=========
- Logs del backend muestran: "[WEBHOOK MP] ✅ Pago registrado: Invoice #X"
- En la UI verás facturas con estado "pagado" y la fecha del pago
- En /payments verás todos los pagos registrados

TROUBLESHOOTING
===============
❌ "MercadoPago no está configurado"
   → Verifica que MERCADOPAGO_ACCESS_TOKEN esté en .env

❌ "Webhook no se ejecuta"
   → Verifica la URL en MercadoPago dashboard
   → Si estás en local, asegúrate que ngrok esté corriendo
   → Revisa logs del backend

❌ "Pago no se registra automáticamente"
   → Verifica que external_reference sea "invoice_XXX"
   → Revisa logs: [WEBHOOK MP]
   → Asegúrate que la factura existe en la BD

PRÓXIMAS MEJORAS
================
- [ ] Envío automático de links por WhatsApp API
- [ ] Envío automático por email
- [ ] Recordatorios antes del vencimiento
- [ ] Dashboard con estadísticas en tiempo real
- [ ] Notificaciones cuando entra un pago

