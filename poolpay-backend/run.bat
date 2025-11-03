@echo off
echo ========================================
echo Iniciando PoolPay Backend...
echo ========================================
echo.
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: No se encontro el entorno virtual
    echo Por favor ejecuta setup.bat primero
    pause
    exit /b 1
)
echo Servidor iniciando en http://localhost:8000
echo Documentacion en http://localhost:8000/docs
echo Presiona Ctrl+C para detener el servidor
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

