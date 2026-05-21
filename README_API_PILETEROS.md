# API para la App Móvil de Pileteros

Referencia del contrato HTTP entre la app móvil de pileteros y el backend PoolPay.

---

## Autenticación

Todas las requests de la app móvil deben incluir el header:

```
X-Piletero-Key: <tu-api-key>
```

Las API keys se generan desde el panel admin en `/pileteros`. Cada piletero
tiene su propia clave individual. El admin puede regenerarla o desactivarla
en cualquier momento.

---

## Endpoint principal

### `POST /service-visits`

Registra una visita de limpieza completada. El backend automáticamente:
1. Crea la factura (`Invoice`) asociada al cliente
2. Genera un link de pago MercadoPago
3. Envía (o prepara) el WhatsApp al cliente con el link

#### Headers requeridos

| Header | Valor |
|---|---|
| `X-Piletero-Key` | Tu API key personal |
| `Content-Type` | `application/json` |

#### Body (JSON)

```json
{
  "client_id": 112,
  "visited_at": "2026-05-19T14:30:00Z",
  "duration_minutes": 45,
  "products_used": "Cloro 2L, Alguicida 1L",
  "notes": "Filtros sucios, sugerir cambio",
  "price": null
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `client_id` | `int` | ✅ | ID del cliente visitado |
| `visited_at` | `datetime` ISO 8601 | ❌ | Fecha/hora de la visita (default: ahora UTC) |
| `duration_minutes` | `int` | ❌ | Duración de la limpieza en minutos |
| `products_used` | `string` | ❌ | Productos utilizados (texto libre, máx 500 chars) |
| `notes` | `string` | ❌ | Notas adicionales (máx 1000 chars) |
| `price` | `float` | ❌ | Monto a cobrar. Si no se envía o es 0, usa `client.price` |

#### Ejemplo `curl`

```bash
curl -X POST https://tu-backend.com/service-visits \
  -H "X-Piletero-Key: TU_API_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 112,
    "products_used": "Cloro 2L, alguicida 1L",
    "notes": "Filtros sucios, sugerir cambio",
    "duration_minutes": 45
  }'
```

#### Respuesta exitosa `200 OK`

```json
{
  "id": 7,
  "client_id": 112,
  "client_name": "Juan García",
  "piletero_id": 3,
  "piletero_name": "Carlos el piletero",
  "visited_at": "2026-05-19T14:30:00Z",
  "duration_minutes": 45,
  "products_used": "Cloro 2L, alguicida 1L",
  "notes": "Filtros sucios, sugerir cambio",
  "price": 5000.0,
  "invoice_id": 89,
  "payment_link_url": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "whatsapp_status": "pending",
  "whatsapp_sent_at": null,
  "whatsapp_error": null,
  "wame_url": "https://wa.me/5491134567890?text=Hola+Juan..."
}
```

**Campos de respuesta clave:**

| Campo | Descripción |
|---|---|
| `invoice_id` | ID de la factura creada automáticamente |
| `payment_link_url` | Link de pago MercadoPago para compartir al cliente |
| `whatsapp_status` | `pending` \| `sent` \| `failed` \| `no_phone` |
| `wame_url` | URL wa.me pre-armada (solo si `WHATSAPP_PROVIDER=wame`). Útil si la app quiere abrir WhatsApp directamente. |

#### Valores de `whatsapp_status`

| Valor | Significado |
|---|---|
| `pending` | URL wa.me generada, el admin la abre manualmente desde el dashboard |
| `sent` | Mensaje enviado automáticamente (driver ultramsg) |
| `failed` | Error al enviar (ver `whatsapp_error`) |
| `no_phone` | El cliente no tiene teléfono/WhatsApp registrado |

---

## Códigos de error

| Código | Causa |
|---|---|
| `401 Unauthorized` | Header `X-Piletero-Key` faltante o API key inválida |
| `403 Forbidden` | El piletero existe pero está desactivado |
| `404 Not Found` | `client_id` no existe en el sistema |
| `400 Bad Request` | Cliente desactivado, o precio inválido (≤0) |
| `422 Unprocessable Entity` | Body JSON mal formado o tipos incorrectos |

---

## Cómo obtener una API key

1. El admin abre el dashboard en `/pileteros`
2. Crea un piletero con nombre y teléfono opcional
3. El sistema genera automáticamente una API key única (`secrets.token_urlsafe(32)`)
4. El admin copia la key y se la entrega al piletero de forma segura
5. Si la key se compromete, el admin puede regenerarla desde el mismo panel
   (la key vieja queda invalidada instantáneamente)

---

## Notas de integración

- La URL del backend en producción es la URL de ngrok (o dominio propio si
  lo tienen desplegado). El admin la puede ver en `http://127.0.0.1:4040`.
- Las visitas quedan visibles en el dashboard en `/service-visits`.
- El webhook de MercadoPago sigue funcionando igual: cuando el cliente paga,
  la factura generada por esta visita se marca automáticamente como pagada.
- El campo `visited_at` acepta cualquier ISO 8601 con timezone. Si no se
  envía, el backend usa la hora actual UTC.
