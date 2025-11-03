@echo off
echo ========================================
echo PoolPay Backend - Setup
echo ========================================
echo.

echo [1/4] Creando entorno virtual...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: No se pudo crear el entorno virtual
    echo Verifica que Python este instalado: python --version
    pause
    exit /b 1
)

echo [2/4] Activando entorno virtual...
call .venv\Scripts\activate.bat

echo [3/4] Actualizando pip...
python -m pip install --upgrade pip

echo [4/4] Instalando dependencias...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completado exitosamente!
echo ========================================
echo.
echo Para iniciar el servidor ejecuta: run.bat
echo O manualmente:
echo   1. .venv\Scripts\activate.bat
echo   2. uvicorn app.main:app --reload
echo.
pause

