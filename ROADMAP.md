# PoolPay — Roadmap

Estado del proyecto y trabajo pendiente, en orden de prioridad.
Última actualización: sesión del 2026-05-13.

---

## ✅ Hecho en sesiones anteriores

- Backend FastAPI con CRUDs de clientes, facturas, pagos, billing
- Integración MercadoPago: webhook + creación de preferences
- Frontend React + Tailwind con páginas Clientes, Facturas, Pagos, Billing, Dashboard
- Auth JWT con login admin
- Schedulers: facturación mensual, vencimientos diarios, recordatorios
- Export Excel del período

## ✅ Hecho en la sesión 2026-05-13

### Pagos automáticos end-to-end
- Setup completo TEST de MercadoPago (token, ngrok, panel webhook)
- Validación del webhook con pago de prueba registrado correctamente vía link MP

### Auto-match inteligente de transferencias CBU
- Tabla `OrphanPayment` para pagos sin link
- Servicio `payment_matcher` con scoring por monto + nombre fuzzy + vencimiento
- Threshold dual: single candidate ≥0.70, multi ≥0.80 con gap 0.20
- Filtros: clientes inactivos descartados, facturas con total=0 descartadas, montos<=0 rechazados
- Endpoints `/orphan-payments` (list, detail, assign, discard, pending-count)
- Página frontend `/orphan-payments` con candidatos rankeados, badges visuales y modales custom
- Refresh instantáneo del badge sidebar via custom events (sin esperar 30s)

### Infraestructura
- `start-all.bat` que levanta backend + frontend + ngrok con detección de puerto ocupado
- Doc `TESTEAR_PAGOS_AUTOMATICOS.md` paso a paso

### Auditoría
- Auditoría de seguridad completa (7 críticos, 8 importantes, 8 menores)
- Auditoría de bugs lógicos (5 críticos, 9 menores, 11 edge cases)
- **Bloque 1: 8 fixes críticos aplicados:**
  1. Eliminado bypass de auth en modo dev (require `ALLOW_NO_AUTH=true` explícito)
  2. Auth agregado a `/mercadopago/create-payment-link`, `/payment/{id}`, `/quick-payment`
  3. Validación de monto en webhook (rechaza ≤0, warning >150% del total)
  4. Estados intermedios MP no se marcan como procesados (no más pagos perdidos)
  5. Clientes inactivos filtrados en matcher
  6. Guard contra `due_date=None`
  7. Guard contra `amount<=0` y `total<=0`
  8. Coerción `str(payer_dni)` defensiva

---

## 🔴 PRIORIDAD ALTA — Antes de producción

### Bloque 2: Configuración de seguridad (sin código, solo `.env`)

Estimación: ~30 min total

- [ ] Rotar `SECRET_KEY` con `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] Settear `ADMIN_PASSWORD` con hash bcrypt — generar con:
      ```python
      from passlib.context import CryptContext
      CryptContext(['bcrypt']).hash('tu-password-fuerte')
      ```
- [ ] Rotar password de MySQL (la actual está en plaintext, asumir comprometida)
- [ ] Activar `MP_VERIFY_SIGNATURE=true` y settear `MERCADOPAGO_WEBHOOK_SECRET`
      (obtener clave del panel MP > Webhooks)
- [ ] Settear `BACKEND_CORS_ORIGINS` con tu dominio específico (no vacío)
### Race conditions y robustez

- [ ] Wrap del check `ProcessedMpPayment` + insert con try/except `IntegrityError`
      para evitar duplicados en webhooks paralelos
- [ ] Validar `invoice.status != 'pagado'` en `assign_orphan` antes de crear Payment

---

## 🟡 PRIORIDAD MEDIA — Features funcionales

### A. App de Pileteros + sección Servicios

**Concepto:** una app móvil aparte (futura) para los empleados que limpian.
Cuando terminan una pileta, marcan en su app y se dispara: factura nueva +
link MP + envío automático por WhatsApp al cliente.

Estimación: 4-6 horas de desarrollo

- [ ] Tabla `Piletero` con API key individual por persona
- [ ] Tabla `ServiceVisit` (visita = factura): cliente, fecha, piletero,
      productos usados, notas, precio (default `client.price`, sobrescribible)
- [ ] Auth middleware para app móvil: header `X-Piletero-Key`
- [ ] Endpoint `POST /service-visits` que:
  - Crea ServiceVisit
  - Crea Invoice asociada
  - Genera preference MP + payment_link
  - Dispara envío WhatsApp (o queda "pendiente WhatsApp" si no hay teléfono)
- [ ] Servicio `whatsapp_sender.py` pluggable:
  - Driver default: `wa.me` (genera URL clickeable, semi-automático)
  - Driver `meta_api` (oficial, requiere setup Meta Business)
  - Driver `ultramsg` o `twilio` (alternativas más simples)
  - Switch vía `WHATSAPP_PROVIDER` en `.env`
- [ ] Endpoints admin: `GET /service-visits`, `GET /service-visits/{id}`,
      `POST /service-visits/{id}/resend-whatsapp`
- [ ] Página frontend `/service-visits` con tabla, filtros, badge contador
- [ ] Doc `README_API_PILETEROS.md` con contrato del endpoint para el equipo
      que haga la app móvil

### B. Mejoras chicas con alto impacto

- [ ] **Script `fix_zero_invoices.py`**: actualiza las 105 facturas con `total=0`
      asignándoles el `price` actual del cliente. Sino esa data está rota.
- [ ] **Memoria del matcher**: tabla `payer_aliases (payer_name, client_id)`.
      Al asignar manualmente un huérfano, se guarda el mapeo. La próxima
      transferencia con el mismo payer_name auto-matchea con score 1.0.
- [ ] **Botón "Marcar pagada en efectivo"** en cada factura del frontend.
      Crea Payment con `method="efectivo"` sin pasar por Swagger.
- [ ] **Badge "vía: auto-match (X%)"** en `/payments`. Hoy esa info vive en
      `notes` (string libre) pero queda escondida. Mostrarla visible.
- [ ] **Re-evaluar huérfanos al asignar otro**: al asignar manual un huérfano,
      sugerir auto-asignar los demás del mismo cliente.

---

## 🟢 PRIORIDAD BAJA — Deuda técnica

- [ ] Migrar montos `float` → `Decimal` (precisión financiera correcta)
- [ ] Tests pytest del matcher y orphan flow (cobertura)
- [ ] No logear PII (email/DNI/nombres en logs) — cumplimiento Ley 25.326
- [ ] Rate limiting `/auth/login` y `/webhook` con `slowapi` o nginx
- [ ] Manejar `refunded` / `charged_back` post-aprobación (revertir Payment)
- [ ] Paginar SELECT del matcher (si crecés a >1000 facturas pendientes)
- [ ] Errores genéricos al cliente, detalle solo en logs (hoy expone stack del SDK MP)
- [ ] Dashboard widget "X pagos automáticos este mes" — métrica del auto-match
- [ ] Borrar password de DB del repo y rotarla en producción
- [ ] Considerar Hosting real (Railway, Render, VPS) en lugar de ngrok

---

## 🔵 Por decidir / revisar

- [ ] **Sección Clientes**: ¿agregar campos `dni`, `cbu`, `alias`? Mejora
      drásticamente la precisión del matcher (DNI match = +0.20, CBU exacto
      podría ser +0.40).
- [ ] **Sección Facturas**: ¿algún botón / vista que falte?
- [ ] **Sección Pagos**: idem.
- [ ] **Login**: ¿registro de usuarios múltiples (operadores) o sigue con
      un solo admin?
- [ ] **Plan de hosting** cuando salgas de dev: ngrok pago / Railway /
      Render / VPS propio.

---

## Notas para la próxima sesión

Cuando retomes:

1. Levantá todo con `start-all.bat` (ya está testeado y andando).
2. Abrí `ROADMAP.md` y eligí por dónde seguir.
3. Si volvés a tener algún bug del flujo de pagos, revisar `TESTEAR_PAGOS_AUTOMATICOS.md`
   que tiene toda la doc del setup.

### Archivos clave a recordar

- **Backend:**
  - `app/routers/mercadopago.py` — webhook + endpoints de pagos
  - `app/routers/orphan_payments.py` — endpoints de huérfanos
  - `app/services/payment_matcher.py` — scoring del auto-match
  - `app/services/billing.py` — recálculo de status de facturas
  - `app/auth.py` — middleware de autenticación
- **Frontend:**
  - `src/pages/OrphanPayments.tsx` — bandeja de huérfanos
  - `src/components/ConfirmModal.tsx` — modal custom
  - `src/components/Layout.tsx` — sidebar con badge
- **Scripts:**
  - `start-all.bat` — levanta backend + frontend + ngrok

### Credenciales y endpoints

- Frontend dev: http://localhost:3000
- Backend dev: http://localhost:8000
- Swagger: http://localhost:8000/docs
- ngrok dashboard: http://127.0.0.1:4040
- Admin login: `admin` / `admin` *(rotar antes de prod, ver Bloque 2)*
