# 🔧 Configuración de MercadoPago - PoolPay

## ⚠️ Estado Actual

**MercadoPago está DESHABILITADO** porque no tienes credenciales configuradas.

**Funcionalidades disponibles SIN MercadoPago:**
- ✅ Registro manual de transferencias bancarias
- ✅ Registro manual de pagos en efectivo
- ✅ Gestión completa de clientes y facturas
- ❌ Links de pago automáticos de MercadoPago
- ❌ Webhook automático de MercadoPago

---

## 🚀 Cómo Activar MercadoPago (Cuando Tengas Credenciales)

### Paso 1: Obtener Credenciales

1. **Crea una cuenta en MercadoPago:**
   - https://www.mercadopago.com.ar/

2. **Ve a Developers:**
   - https://www.mercadopago.com.ar/developers/

3. **Crea una aplicación:**
   - Click en "Tus integraciones"
   - Click en "Crear aplicación"
   - Completa los datos

4. **Obtén tus credenciales:**
   - Ve a "Credenciales"
   - Copia el **Access Token** (Production o Test)
   - Copia el **Public Key** (opcional, para frontend)

---

### Paso 2: Configurar en el Sistema

**Edita el archivo `.env`:**

Ubicación: `D:\app pool store\poolpay-backend\.env`

Reemplaza estas líneas:
```env
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=TEST-tu-access-token-aqui
MERCADOPAGO_PUBLIC_KEY=TEST-tu-public-key-aqui
```

Con tus credenciales reales:
```env
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1234567890-abcdef-xyz123...
MERCADOPAGO_PUBLIC_KEY=APP_USR-1234567890-abcdef-xyz123...
```

---

### Paso 3: Reiniciar el Servidor

```cmd
Ctrl+C  (detener servidor)
run.bat (iniciar de nuevo)
```

---

### Paso 4: Verificar que Funciona

**Abre:** http://localhost:8000/docs

**Prueba el endpoint:**
`POST /mercadopago/create-payment-link`

**Si está configurado correctamente:**
- ✅ Recibirás un link de pago válido
- ✅ Podrás enviar links de pago a clientes
- ✅ El webhook recibirá notificaciones automáticas

**Si NO está configurado:**
- ❌ Recibirás error: "MercadoPago no está configurado"

---

## 🎯 Mientras Tanto - Usar Sin MercadoPago

### Puedes usar TODOS estos endpoints SIN MercadoPago:

#### ✅ Registrar Transferencia Bancaria
```
POST /payments/register-bank-transfer
{
  "invoice_id": 1,
  "amount": 100.00,
  "reference": "123456789",
  "notes": "Pago de enero"
}
```

#### ✅ Registrar Pago en Efectivo
```
POST /payments/register-cash
{
  "invoice_id": 1,
  "amount": 100.00,
  "notes": "Efectivo recibido"
}
```

#### ✅ Crear Clientes
```
POST /clients
{
  "name": "Juan Pérez",
  "plan": "mensual",
  "price": 100.00
}
```

#### ✅ Generar Facturas Automáticas
```
POST /billing/generate
{
  "period": "2025-01",
  "due_day": 10
}
```

#### ✅ Ver Estadísticas
```
GET /billing/stats
```

---

## 📝 Tipos de Credenciales

### Test (Sandbox)
- Para pruebas
- No cobra dinero real
- Prefijo: `TEST-`
- Útil para desarrollo

### Production
- Para uso real
- Cobra dinero de verdad
- Prefijo: `APP_USR-`
- Necesita verificación de cuenta

---

## 💡 Recomendación

**Por ahora:**
1. ✅ Usa el sistema SIN MercadoPago
2. ✅ Registra pagos manualmente (transferencia/efectivo)
3. ✅ Cuando tengas las credenciales, las agregas al `.env`
4. ✅ Reinicia el servidor
5. ✅ MercadoPago se activa automáticamente

**El sistema funciona perfectamente sin MercadoPago** - solo no tendrás links de pago automáticos.

---

## 🔍 Verificar Estado de MercadoPago

**Cuando inicies el servidor, verás en la consola:**

**Si NO está configurado:**
```
(No verás errores, simplemente no estará habilitado)
```

**Si está configurado correctamente:**
```
INFO:     Application startup complete.
```

Y podrás usar todos los endpoints de `/mercadopago`

---

## 🆘 Problemas Comunes

### ❌ "Access denied"
- Verifica que el Access Token sea correcto
- Asegúrate de que no tenga espacios extra
- Verifica que sea de producción si quieres cobrar de verdad

### ❌ "Invalid credentials"
- El token puede haber expirado
- Genera nuevas credenciales en el panel de MercadoPago
- Reemplaza en `.env` y reinicia

### ❌ Webhook no funciona
- Necesitas una URL pública (no localhost)
- Usa ngrok o similar para desarrollo
- En producción, usa tu dominio real

---

## ✅ Todo Funciona Sin MercadoPago

**Recuerda:**
- El sistema está 100% funcional SIN MercadoPago
- MercadoPago es OPCIONAL
- Solo agrega comodidad para pagos online
- Puedes registrar todos los pagos manualmente

---

**Cuando tengas las credenciales, solo edita `.env` y reinicia** 🚀

