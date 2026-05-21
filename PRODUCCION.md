# Checklist pre-producción — PoolPay

Pasos a ejecutar **antes de deployar** PoolPay a un servidor público.
Hoy estás en modo dev local y muchas cosas están con valores default.

> ⚠️ NO deployes a producción sin pasar TODOS los checks marcados como
> 🔴 Crítico. Tu backend procesa pagos reales — un error de configuración
> puede significar plata perdida o data filtrada.

---

## 🔴 Críticos — bloquean el deploy

### 1. Rotar `SECRET_KEY`

Hoy es `cambia-esta-clave-secreta-por-una-generada` (el default).
Cualquiera con acceso al código puede forjar JWTs y suplantar el admin.

**Pasos:**

```cmd
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Te imprime algo como `_abc123def456...`. Copialo y en `.env` reemplazá:

```
SECRET_KEY=el-valor-aleatorio-largo-que-genero-python
```

> ⚠️ Al cambiar el SECRET_KEY se invalidan todas las sesiones JWT activas.
> Vas a tener que re-loguearte.

### 2. Cambiar `ADMIN_PASSWORD` a un hash bcrypt

Hoy estás con `admin/admin`. Cualquiera puede entrar.

**Pasos:**

1. Elegí una password fuerte. Generala con 1Password / Bitwarden / Keepass.
2. Generá el hash bcrypt:

```cmd
python -c "from passlib.context import CryptContext; print(CryptContext(['bcrypt']).hash('TU-PASSWORD-FUERTE'))"
```

3. Te imprime algo como `$2b$12$abc...`. En `.env`:

```
ADMIN_PASSWORD=$2b$12$abc...
```

> Tu sistema acepta tanto plaintext (dev) como hash bcrypt. Si pones el hash,
> automáticamente lo verifica con bcrypt.

### 3. Rotar password de MySQL

Hoy `MYSQL_PASSWORD=tinoCASTALDI1` está en plaintext en `.env`. Si el repo
estuvo en algún momento en GitHub público, considerala comprometida.

**Pasos:**

1. Entrar a MySQL como root:
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'TU-NUEVA-PASSWORD-FUERTE';
   FLUSH PRIVILEGES;
   ```
2. Actualizar `.env`:
   ```
   MYSQL_PASSWORD=TU-NUEVA-PASSWORD-FUERTE
   ```
3. (Opcional) Crear un usuario dedicado para PoolPay:
   ```sql
   CREATE USER 'poolpay'@'localhost' IDENTIFIED BY 'OTRA-PASSWORD';
   GRANT ALL ON poolpay.* TO 'poolpay'@'localhost';
   ```
   Y en `.env` cambiar `MYSQL_USER=poolpay`.

### 4. Activar verificación de firma del webhook MP

Hoy `MP_VERIFY_SIGNATURE=false`. Cualquiera puede mandar webhooks falsos
a tu URL pública y forzar registros de pagos falsos.

**Pasos:**

1. Entrá a https://www.mercadopago.com.ar/developers/panel → tu app
2. Menú izquierdo → **Webhooks**
3. Buscá el botón **"Generar clave secreta"** (o "Mostrar clave" si ya existía)
4. Copiá el string que te muestra
5. En `.env`:
   ```
   MERCADOPAGO_WEBHOOK_SECRET=el-secret-que-copiaste
   MP_VERIFY_SIGNATURE=true
   ```
6. Reiniciá el backend
7. Probá: tocá "Simular" en el panel MP → en los logs deberías ver el webhook
   con HTTP 200. Si todo lo nuevo te rechaza con 401, el secret está mal.

### 5. Configurar `BACKEND_CORS_ORIGINS` con tu dominio real

Hoy si la variable está vacía, el backend acepta `*` (cualquier origen).
Combinado con `allow_credentials=True` es una invitación abierta.

**Pasos:**

En `.env`:

```
BACKEND_CORS_ORIGINS=https://poolpay.tudominio.com,https://api.poolpay.tudominio.com
```

Solo los dominios donde corre tu frontend (admin) deben estar.

### 6. Pasar `MERCADOPAGO_ACCESS_TOKEN` a producción

Hoy estás con un token `TEST-...` (sandbox). Para procesar pagos reales:

1. Panel MP → tu app → Credenciales → pestaña **"Credenciales de producción"**
2. Copiá el Access Token (empieza con `APP_USR-...`)
3. En `.env`:
   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
   ```

> ⚠️ Con el token de producción, los pagos son REALES. Probá primero con
> montos chiquitos.

### 7. Bloquear los scripts simuladores

Los scripts `simular_webhook.py` y `simular_transferencia.py` ya tienen
guard `if ENV=production: exit(1)`, pero asegurate de:

1. **Setear `ENV=production` en el `.env` del server**:
   ```
   ENV=production
   ```
2. **O directamente NO copiar los archivos al server**:
   - Agregalos a `.dockerignore` si usás Docker
   - Excluilos del rsync / git deploy

### 8. Activar `--proxy-headers` y deshabilitar `--reload` en uvicorn

En dev usás `uvicorn app.main:app --reload`. En producción NO.

**Pasos:**

```cmd
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*" --workers 2
```

- `--reload` → activa watcher de archivos (innecesario y costoso en prod)
- `--proxy-headers` → respeta los headers X-Forwarded-Proto/For del reverse proxy
- `--workers 2` → 2 procesos para handle más requests en paralelo

> Asumí que vas a tener un nginx o Caddy adelante terminando TLS.

---

## 🟡 Importantes — deberían estar antes de producción

### 9. Settear `BILLING_DUE_DAY` correctamente

Hoy está en 10. Si tus clientes vencen otro día, ajustalo:

```
BILLING_DUE_DAY=15
```

### 10. SMTP para recordatorios de cobranza

Si querés que el scheduler de recordatorios mande mails:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@mail.com
SMTP_PASSWORD=app-password-no-tu-pass
SMTP_FROM=poolpay@tudominio.com
SMTP_TLS=true
```

> Para Gmail necesitás un "App Password" generado desde tu cuenta Google,
> no tu password normal.

### 11. Configurar HTTPS con certificado válido

ngrok te resolvía esto en dev. En prod necesitás:

- **Opción A**: Caddy o nginx con Let's Encrypt automático
- **Opción B**: hosting como Railway/Render que ya viene con TLS

Tu `API_URL` y `FRONTEND_URL` en `.env` deberían apuntar a `https://...`,
no `http://`.

### 12. Backups de la BD

Antes de production, configurá:

```bash
# Backup diario con cron / Task Scheduler
mysqldump -u root -p poolpay > /backups/poolpay-$(date +%Y%m%d).sql
```

Probá una restauración al menos UNA vez antes de confiar.

---

## 🟢 Recomendados — nice to have

### 13. Logs estructurados (JSON) en lugar de texto plano

Si vas a procesar logs con Datadog/Sentry/Loki, conviene formatearlos JSON.
Agregar `python-json-logger` y configurar en `app/main.py`.

### 14. Rate limiting

Instalar `slowapi`:

```python
pip install slowapi
```

Agregar a `app/auth.py` algo como:
```python
@limiter.limit("5/minute")
async def login(...):
```

Y al webhook:
```python
@limiter.limit("60/minute")
async def webhook(...):
```

### 15. Monitoring de errores

Conectar Sentry:
```
pip install sentry-sdk
```
Y en `app/main.py`:
```python
import sentry_sdk
sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))
```

### 16. Métricas Prometheus/Grafana

Si vas a tener volumen, exponer `/metrics` con `prometheus-fastapi-instrumentator`.

### 17. Migrar montos `float` → `Decimal`

Cambio invasivo (toca models.py, billing.py, payment_matcher.py) pero la
forma correcta de manejar plata. Te garantiza precisión exacta.

---

## Resumen del orden recomendado

1. **Crítico día -1 del deploy**: items 1-8 (todos los `.env` de seguridad + uvicorn config)
2. **Crítico día del deploy**: probar el flujo completo en producción con montos chiquitos antes de avisarle a clientes
3. **Primera semana en producción**: items 9-12 (backups, SMTP, HTTPS, billing days)
4. **Primer mes**: items 13-17 (observability)

---

## Verificación rápida post-deploy

Después de deployar, validá:

- [ ] `POST /auth/login` con `admin/[nueva-password]` devuelve token JWT
- [ ] `GET /clients` sin auth devuelve **401** (no 200)
- [ ] `POST /mercadopago/webhook` con body random devuelve **401** (no 200)
      *(porque MP_VERIFY_SIGNATURE está activo y no traés signature)*
- [ ] `GET /mercadopago/create-payment-link` sin auth devuelve **401**
- [ ] Frontend cargado en HTTPS, no HTTP
- [ ] Webhook real desde MP llega con HTTP 200
- [ ] Pago de prueba con monto chiquito se registra correctamente
