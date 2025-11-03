# PoolPay Frontend

Aplicación web moderna para gestión de piscinas construida con React + TypeScript + Vite.

## 🚀 Inicio Rápido

### Primera vez:
1. **Doble clic en `setup.bat`** (instala dependencias)
2. **Doble clic en `run.bat`** (inicia el servidor)
3. Abre: http://localhost:3000

### Requisitos Previos
- Node.js 18+ instalado
- Backend corriendo en http://localhost:8000

---

## 🎨 Tecnologías

- **React 18** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool ultra rápido
- **TailwindCSS** - Estilos utility-first
- **React Router** - Navegación
- **Axios** - Cliente HTTP
- **Lucide React** - Íconos

---

## 📁 Estructura del Proyecto

```
poolpay-frontend/
├── src/
│   ├── api/              # Servicios API
│   │   ├── client.ts     # Configuración Axios
│   │   ├── clients.ts    # API de clientes
│   │   ├── invoices.ts   # API de facturas
│   │   ├── payments.ts   # API de pagos
│   │   └── billing.ts    # API de facturación
│   ├── components/       # Componentes reutilizables
│   │   └── Layout.tsx    # Layout principal
│   ├── pages/            # Páginas/Vistas
│   │   ├── Dashboard.tsx # Estadísticas
│   │   ├── Clients.tsx   # Gestión de clientes
│   │   ├── Invoices.tsx  # Gestión de facturas
│   │   ├── Payments.tsx  # Gestión de pagos
│   │   └── Billing.tsx   # Facturación automática
│   ├── types/            # TypeScript types
│   │   └── index.ts      # Tipos de datos
│   ├── App.tsx           # Componente principal
│   ├── main.tsx          # Punto de entrada
│   └── index.css         # Estilos globales
├── setup.bat             # Instalador
├── run.bat               # Ejecutar servidor
└── package.json          # Dependencias
```

---

## 🔧 Comandos

### Desarrollo
```bash
npm run dev      # Iniciar servidor de desarrollo
```

### Producción
```bash
npm run build    # Compilar para producción
npm run preview  # Vista previa de build
```

### Linting
```bash
npm run lint     # Verificar código
```

---

## 📱 Funcionalidades

### ✅ Dashboard
- Estadísticas generales del negocio
- Total de clientes activos
- Monto facturado y cobrado
- Resumen financiero

### ✅ Clientes
- Lista de clientes con filtros
- Crear/Editar/Eliminar clientes
- Información de contacto
- Planes (semanal, quincenal, mensual)
- Estado activo/inactivo

### ✅ Facturas
- Lista de facturas con filtros
- Filtrar por período y estado
- Ver detalles de cada factura
- Estados: pendiente, pagado, parcial, vencido

### ✅ Pagos
- Registro de todos los pagos
- Métodos: efectivo, transferencia, MercadoPago
- Estadísticas de cobros
- Asociación automática a facturas

### ✅ Facturación
- Generación automática de facturas mensuales
- Configuración de período y día de vencimiento
- Validación de duplicados
- Resumen de facturas generadas

---

## 🎨 Diseño

- **Interfaz moderna** con TailwindCSS
- **Responsive** (móvil, tablet, desktop)
- **Íconos** de Lucide React
- **Color scheme** azul profesional
- **Modo claro** optimizado

---

## 🔗 Conexión con Backend

El frontend se conecta automáticamente al backend en:
```
http://localhost:8000
```

Si el backend está en otra URL, edita:
```typescript
// src/api/client.ts
const API_URL = 'http://tu-backend:puerto'
```

---

## 🐛 Solución de Problemas

**Error: "Cannot find module"**
- Ejecuta `setup.bat` de nuevo

**Error de conexión con API**
- Verifica que el backend esté corriendo
- Verifica la URL en `src/api/client.ts`

**Puerto 3000 ocupado**
- Cambia el puerto en `vite.config.ts`:
  ```ts
  server: { port: 3001 }
  ```

---

## 🚀 Despliegue

Para producción:
```bash
npm run build
```

Los archivos compilados estarán en `dist/`

Puedes servirlos con:
- Vercel
- Netlify
- GitHub Pages
- Cualquier servidor estático

---

**Desarrollado con ❤️ para la gestión eficiente de piscinas** 🏊‍♂️

