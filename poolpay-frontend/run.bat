@echo off
echo ========================================
echo Iniciando PoolPay Frontend...
echo ========================================
echo.

echo Activando Node 18...
call nvm use 18

REM -- nvm use actualiza el symlink pero no siempre actualiza el PATH
REM    de la sesión actual. Lo agregamos explícitamente.
if defined NVM_SYMLINK (
    set "PATH=%NVM_SYMLINK%;%PATH%"
)

REM -- Fallback: buscar npm en ubicaciones conocidas de nvm-windows
where npm >nul 2>&1
if errorlevel 1 (
    if exist "C:\nvm4w\nodejs\npm.cmd"        set "PATH=C:\nvm4w\nodejs;%PATH%"
    if exist "%NVM_HOME%\v18.20.8\npm.cmd"    set "PATH=%NVM_HOME%\v18.20.8;%PATH%"
    if exist "C:\nvm4w\v18.20.8\npm.cmd"      set "PATH=C:\nvm4w\v18.20.8;%PATH%"
    if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se encontro npm. Abrí una cmd nueva y ejecutá run.bat directamente.
    pause
    exit /b 1
)

echo Servidor en: http://localhost:3000
echo Presiona Ctrl+C para detener
echo.

if not exist node_modules\react (
    echo Instalando dependencias...
    npm install
    if errorlevel 1 (
        echo ERROR: Fallo npm install
        pause
        exit /b 1
    )
)

npm run dev
if errorlevel 1 (
    echo.
    echo Fallback: ejecutando Vite directamente...
    node node_modules\vite\bin\vite.js
)
