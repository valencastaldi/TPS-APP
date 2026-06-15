# PoolPay Backend

API REST para gestión de clientes, facturación y pagos con FastAPI + MySQL.

## 🚀 Inicio Rápido

### Primera vez:
1. **Doble clic en `setup.bat`** (instala todo automáticamente)
2. **Edita el archivo `.env`** con tu password de MySQL
3. **Crea la base de datos MySQL:**
   ```sql
   CREATE DATABASE poolpay;
   ```

### Ejecutar servidor:
- **Doble clic en `run.bat`**
- Abre: http://localhost:8000/docs

### Detener servidor:
- Presiona `Ctrl+C` en la ventana de CMD

---

## ⚙️ Configurar PyCharm (Eliminar errores rojos)

1. `Ctrl+Alt+S` → `Python Interpreter`
2. Click en ⚙️ → `Add Interpreter` → `Add Local Interpreter`
3. `Existing` → Seleccionar: `.venv\Scripts\python.exe`
4. `OK` → Esperar 1 min → ✅ Errores desaparecen

---

## 📁 Archivos Principales

- `setup.bat` - Instalar (primera vez)
- `run.bat` - Iniciar servidor
- `.env` - Configuración (editar con tu password MySQL)
- `requirements.txt` - Dependencias
- `app/` - Código fuente


## 📋 Endpoints Principales

### 👥 Clientes
- `GET /clients` - Listar clientes
- `POST /clients` - Crear cliente
- `PATCH /clients/{id}` - Actualizar cliente
- `DELETE /clients/{id}` - Eliminar cliente

### 📄 Facturas
- `GET /invoices` - Listar facturas (filtros: client_id, period, status)
- `POST /invoices` - Crear factura
- `PATCH /invoices/{id}` - Actualizar factura
- `DELETE /invoices/{id}` - Eliminar factura
- `GET /invoices/{id}/payments` - Ver pagos de una factura

### 💰 Pagos
- `GET /payments` - Listar pagos
- `POST /payments` - Registrar pago (actualiza estado de factura automáticamente)
- `DELETE /payments/{id}` - Eliminar pago

### 📊 Facturación
- `POST /billing/generate` - Generar facturas automáticamente
- `GET /billing/summary/{period}` - Resumen del período
- `GET /billing/overdue` - Facturas vencidas
- `GET /billing/stats` - Estadísticas generales

Ver documentación completa en: http://localhost:8000/docs

---

## 🔧 Solución de Problemas

**Error: 'cryptography' package is required:**
- Ya está solucionado en `requirements.txt`
- Si vuelve a aparecer: `.venv\Scripts\pip.exe install cryptography`

**Error de imports en PyCharm:**
- Configura el intérprete (ver arriba)

**Error al iniciar servidor:**
- Verifica que MySQL esté corriendo
- Verifica el `.env` con password correcta
- Ejecuta `setup.bat` de nuevo

**TypeError con Literal:**
- Ya está solucionado en `models.py` (usa `str` en lugar de `Literal`)

---

## 📂 Estructura del Proyecto

```
poolpay-backend/
├── app/
│   ├── models.py      # Tablas de BD (Client, Invoice, Payment)
│   ├── schemas.py     # Validación (ClientCreate, ClientUpdate)
│   ├── db.py          # Conexión MySQL
│   ├── main.py        # Aplicación FastAPI
│   ├── routers/       # Endpoints
│   └── services/      # Lógica de negocio
├── .env               # Tu configuración
├── setup.bat          # Instalador
└── run.bat            # Ejecutar
```

---

**Desarrollado con FastAPI + SQLModel + MySQL** 🚀
sqlmodel
fastapi
uvicorn[standard]
python-dotenv
pymysql
sqlalchemy
alembic

