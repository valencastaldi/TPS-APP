- **API**: http://localhost:8000

## 📚 Documentación Completa

- 📖 [**Guía de Pagos Automáticos**](README_PAGOS_AUTOMATICOS.md) - Paso a paso para configurar
- 🔧 [**Implementación Completa**](IMPLEMENTACION_COMPLETA.md) - Detalles técnicos
- ⚙️ [**Backend README**](poolpay-backend/README.md) - API y configuración
- 🎨 [**Frontend README**](poolpay-frontend/README.md) - UI y componentes
- 💳 [**Guía MercadoPago**](poolpay-backend/PAGOS_AUTOMATICOS.md) - Configuración del webhook

## 📁 Estructura del Proyecto

```
TPS-APP/
├── poolpay-backend/          # API REST con FastAPI
│   ├── app/
│   │   ├── routers/          # Endpoints (clients, invoices, payments, billing, mercadopago)
│   │   ├── services/         # Lógica de negocio (MercadoPago, billing)
│   │   ├── models.py         # Modelos de base de datos
│   │   └── main.py           # App principal
│   ├── .env.example          # Template de configuración
│   └── requirements.txt      # Dependencias Python
│
├── poolpay-frontend/         # Interfaz web con React
│   ├── src/
│   │   ├── pages/            # Páginas (Clients, Invoices, Payments, Billing)
│   │   ├── api/              # Clientes HTTP
│   │   └── components/       # Componentes reutilizables
│   └── package.json          # Dependencias Node
│
├── README_PAGOS_AUTOMATICOS.md   # Guía de uso
├── IMPLEMENTACION_COMPLETA.md    # Documentación técnica
└── run.bat                        # Ejecuta todo el sistema
```

## 🔧 Tecnologías

**Backend:**
- FastAPI - Framework web moderno
- SQLModel - ORM con validación Pydantic
- MySQL/SQLite - Base de datos
- MercadoPago SDK - Procesamiento de pagos
- Uvicorn - Servidor ASGI

**Frontend:**
- React 18 + TypeScript - UI framework
- Tailwind CSS - Estilos utility-first
- Vite - Build tool rápido
- Axios - Cliente HTTP
- Lucide React - Iconos

## 💳 Configurar MercadoPago (5 minutos)

1. Ve a https://www.mercadopago.com.ar/developers
2. Crea una aplicación
3. Copia tu ACCESS TOKEN
4. Edita `poolpay-backend/.env`:
   ```
   MERCADOPAGO_ACCESS_TOKEN=TU_TOKEN_AQUI
   ```
5. Configura el webhook: `https://tu-dominio.com/mercadopago/webhook`
6. ¡Listo! Los pagos se registrarán automáticamente

Ver guía completa: [README_PAGOS_AUTOMATICOS.md](README_PAGOS_AUTOMATICOS.md)

## 🎯 Flujo de Trabajo

1. **Agregar clientes** → Define barrio, plan y precio
2. **Generar facturas** → Un click genera facturas del mes
3. **Crear links de pago** → Automático para cada factura
4. **Enviar links** → WhatsApp o email
5. **Cliente paga** → Link o transferencia al CBU
6. **Sistema registra** → Automático vía webhook de MercadoPago
7. **Ver en dashboard** → Quién pagó y cuándo

## 🚦 Estado del Proyecto

✅ Sistema completo y funcional  
✅ Pagos automáticos implementados  
✅ Webhook de MercadoPago configurado  
✅ UI completa con todas las funcionalidades  
✅ Documentación completa  

### Próximas mejoras
- [ ] Envío automático de links por WhatsApp API
- [ ] Recordatorios automáticos antes del vencimiento
- [ ] Dashboard con gráficos en tiempo real
- [ ] Exportar reportes a Excel/PDF
- [ ] App móvil con React Native

## 📞 Soporte

Para problemas o preguntas:
1. Revisa la documentación en `README_PAGOS_AUTOMATICOS.md`
2. Consulta los logs del backend
3. Verifica la configuración en `.env`

## 📄 Licencia

MIT License - ver archivo LICENSE

## 👨‍💻 Autor

**Valentino Castaldi**  
📧 tinocastaldi04@gmail.com

