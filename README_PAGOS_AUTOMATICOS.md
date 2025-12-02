# Sistema de Pagos Automáticos - PoolPay
## Tu CBU de MercadoPago registra pagos automáticamente 🚀

## ¿Cómo funciona?

Este sistema está configurado para que **MercadoPago registre automáticamente TODOS los pagos**:
- ✅ Pagos con link de MercadoPago (tarjeta, débito, etc)
- ✅ Transferencias directas al CBU/CVU de MercadoPago

**NO necesitas hacer nada manual** - cuando un cliente paga, el sistema lo registra automáticamente.

---

## Configuración Inicial (Una sola vez)

### 1. Obtener credenciales de MercadoPago

1. Ve a: https://www.mercadopago.com.ar/developers
2. Crea una aplicación (o usa una existente)
3. Copia tu **ACCESS TOKEN**:
   - Para pruebas: usa el token de TEST
   - Para producción: usa el token de PRODUCCIÓN

4. Edita el archivo `poolpay-backend\.env`:
   ```
   MERCADOPAGO_ACCESS_TOKEN=TU_TOKEN_AQUI
   ```

### 2. Configurar Webhook (CRÍTICO)

El webhook es lo que hace que los pagos se registren automáticamente.

#### Opción A: Producción (con dominio público)
1. En MercadoPago → Tu aplicación → Webhooks
2. Agrega URL: `https://tudominio.com/mercadopago/webhook`
3. Selecciona evento: **payment**
4. Guarda y activa

#### Opción B: Desarrollo Local (con ngrok)
1. Descarga ngrok: https://ngrok.com/download
2. Ejecuta: `ngrok http 8000`
3. Copia la URL (ej: `https://abc123.ngrok.io`)
4. En MercadoPago webhook: `https://abc123.ngrok.io/mercadopago/webhook`

### 3. Reiniciar el Backend

```cmd
cd D:\proyectos\TPS-APP\poolpay-backend
run.bat
```

Verifica en los logs:
- ✅ `DB URL usada: ...`
- ✅ `Uvicorn running on http://127.0.0.1:8000`

---

## Flujo de Trabajo Mensual

### Paso 1: Generar Facturas del Mes

**Opción A - Desde la Web:**
1. Ve a http://localhost:3000/billing
2. Ingresa el período: `2025-12` (año-mes)
3. Click "Generar Facturas"
4. El sistema crea una factura para cada cliente activo

**Opción B - Desde API:**
```bash
curl -X POST http://localhost:8000/billing/generate \
  -H "Content-Type: application/json" \
  -d '{"period": "2025-12", "due_day": 10}'
```

### Paso 2: Crear Links de Pago

```bash
curl -X POST http://localhost:8000/billing/create-payment-links?period=2025-12
```

Respuesta:
```json
{
  "count": 50,
  "results": [
    {
      "invoice_id": 1,
      "ok": true,
      "payment_link": "https://mpago.la/xyz123"
    }
  ]
}
```

### Paso 3: Enviar Links a Clientes

**Por WhatsApp (manual por ahora):**
```
Hola [Nombre]! 👋
Tu factura de diciembre está lista: $150
Podés pagar aquí: https://mpago.la/xyz123

O transferir a nuestro CBU de MercadoPago:
CBU: 0000003100012345678901
Alias: poolpay.mp
```

### Paso 4: Los Pagos se Registran Solos ✨

Cuando el cliente paga (link O transferencia):
1. MercadoPago detecta el pago
2. Llama automáticamente al webhook
3. El sistema registra el pago
4. La factura se marca como "pagada"
5. **En la web aparece: "Cliente Juan Pérez - Pagado el 02/12/2025"**

---

## Verificar que Funciona

### Ver Logs del Backend

Busca en la consola:
```
[WEBHOOK MP] Recibido: {...}
[WEBHOOK MP] Payment status: approved
[WEBHOOK MP] ✅ Pago registrado: Invoice #123, Monto: $150.0
```

### Ver en la Web

1. **Facturas**: http://localhost:3000/invoices
   - Estado cambiará de "pendiente" → "pagado"

2. **Pagos**: http://localhost:3000/payments
   - Verás: "🤖 MercadoPago (Auto)" con fecha y hora exacta

---

## Comandos Útiles

### Generar facturas + crear links en un solo paso
```bash
curl -X POST http://localhost:8000/billing/auto-generate-and-create-links \
  -H "Content-Type: application/json" \
  -d '{"period": "2025-12", "due_day": 10}'
```

### Ver facturas pendientes
```bash
curl http://localhost:8000/invoices?status=pendiente
```

### Ver todos los pagos
```bash
curl http://localhost:8000/payments
```

### Ver resumen del período
```bash
curl http://localhost:8000/billing/summary/2025-12
```

---

## Troubleshooting

### ❌ "MercadoPago no está configurado"
**Solución:**
1. Verifica que `MERCADOPAGO_ACCESS_TOKEN` esté en `.env`
2. Reinicia el backend
3. El token debe empezar con `APP_USR-` o `TEST-`

### ❌ Webhook no se ejecuta
**Solución:**
1. Verifica la URL en el dashboard de MercadoPago
2. Si usas ngrok, asegúrate que esté corriendo
3. Revisa logs del backend: debe decir `[WEBHOOK MP]`

### ❌ Pago no se registra automáticamente
**Diagnóstico:**
1. Revisa logs del backend (busca `[WEBHOOK MP]`)
2. Verifica que `external_reference` sea `invoice_XXX`
3. Asegúrate que la factura existe en la BD

**Solución:**
```bash
# Ver facturas
curl http://localhost:8000/invoices

# Ver si el webhook se llamó (logs del backend)
```

### ❌ "Unknown column 'neighborhood'"
**Solución:**
El backend aplica la migración automáticamente al arrancar. Si falla:
```sql
ALTER TABLE `clients` ADD COLUMN `neighborhood` VARCHAR(80) NULL AFTER `city`;
```

---

## Próximas Mejoras

- [ ] Envío automático de links por WhatsApp API
- [ ] Envío automático por email
- [ ] Recordatorios automáticos antes del vencimiento
- [ ] Dashboard con pagos en tiempo real
- [ ] Notificaciones push cuando entra un pago

---

## Contacto de Soporte

Si algo no funciona, revisa:
1. Logs del backend (`[WEBHOOK MP]`)
2. Logs de MercadoPago (Dashboard → Webhooks → Logs)
3. Archivo `PAGOS_AUTOMATICOS.md` para más detalles técnicos

