@echo off
echo ========================================
echo PoolPay Frontend - Setup
echo ========================================
echo.

echo [1/2] Instalando dependencias...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias
    echo Verifica que Node.js y npm esten instalados
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completado!
echo ========================================
echo.
echo Para iniciar el frontend ejecuta: run.bat
echo.
pause

