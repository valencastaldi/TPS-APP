@echo off
setlocal enabledelayedexpansion
title PoolPay - Launcher

echo ============================================================
echo   PoolPay - Levantando backend + frontend + app movil
echo ============================================================
echo.

cd /d "%~dp0"

REM --- Ubicar Node 22 (requerido por Expo SDK 54) ---
set "NODE22=%NVM_HOME%\v22.12.0"
if not exist "!NODE22!\node.exe" set "NODE22=%LOCALAPPDATA%\nvm\v22.12.0"
if not exist "!NODE22!\node.exe" (
    echo [AVISO] No se encontro Node 22. La app movil necesita Node 20+.
    echo         Instalalo con:  nvm install 22.12.0
    echo.
)

REM --- 1) Backend (escucha en TODA la red para que el celular llegue) ---
set "BACKEND_SKIP=0"
netstat -an | findstr ":8000" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [1/3] Backend saltado: el puerto 8000 ya esta en uso.
    set "BACKEND_SKIP=1"
) else (
    echo [1/3] Arrancando backend en http://localhost:8000 ...
    start "PoolPay Backend" cmd /k "cd /d %~dp0poolpay-backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    timeout /t 4 /nobreak >nul
)

REM --- 2) Frontend (usa su propio run.bat con Node 18) ---
netstat -an | findstr ":3000" | findstr "LISTENING" >nul
if !errorlevel! equ 0 (
    echo [2/3] Frontend saltado: el puerto 3000 ya esta en uso.
) else (
    echo [2/3] Arrancando frontend en http://localhost:3000 ...
    start "PoolPay Frontend" cmd /k "cd /d %~dp0poolpay-frontend && call run.bat"
)

REM --- 3) App movil (Expo LAN, con Node 22) ---
echo [3/3] Arrancando app movil (Expo)...
start "PoolPay Mobile" cmd /k "cd /d %~dp0poolpay-mobile && set PATH=!NODE22!;%PATH% && node --version && npx expo start --lan"

echo.
echo ============================================================
echo   Listo. Se abrieron las ventanas necesarias.
echo ============================================================
echo   Backend:    http://localhost:8000   (docs en /docs)
echo   Frontend:   http://localhost:3000
echo   App movil:  escanea el QR de la ventana "PoolPay Mobile" con Expo Go
echo.
echo   El celular y la PC tienen que estar en la MISMA WiFi.
echo   Si Windows pregunta por el firewall, permiti el acceso.
echo ============================================================
echo.
pause
endlocal
