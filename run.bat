@echo off
echo ========================================
echo Iniciando PoolPay - Full Stack
echo ========================================
echo.

echo [1/3] Verificando backend...
if not exist "poolpay-backend\.venv\" (
    echo ERROR: Backend no configurado. Ejecuta poolpay-backend\setup.bat primero
    pause
    exit /b 1
)

echo [2/3] Verificando frontend...
if not exist "poolpay-frontend\node_modules\" (
    echo ERROR: Frontend no configurado. Ejecuta poolpay-frontend\setup.bat primero
    pause
    exit /b 1
)

echo [3/3] Iniciando servicios...
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo Documentacion API: http://localhost:8000/docs
echo.
echo Presiona Ctrl+C para detener ambos servicios
echo.

start "PoolPay Backend" cmd /k "cd /d %~dp0poolpay-backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload"
:: Espera breve para backend
ping -n 3 127.0.0.1 >nul
start "PoolPay Frontend" cmd /k "cd /d %~dp0poolpay-frontend && call run.bat"

echo.
echo Servicios iniciados en ventanas separadas
pause
