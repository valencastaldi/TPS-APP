@echo off
echo ========================================
echo Iniciando PoolPay Frontend...
echo ========================================
echo.
echo Activando Node 18...
call nvm use 18
if %errorlevel% neq 0 (
  echo ERROR: No se pudo activar Node 18 con nvm
  pause
  exit /b 1
)
echo Servidor en: http://localhost:3000
echo Presiona Ctrl+C para detener
echo.

:: Buscar npm si el comando falla
where npm >nul 2>&1
if errorlevel 1 (
  echo npm no esta en PATH, intentando localizar en NVM...
  if exist "%NVM_SYMLINK%\npm.cmd" set "NPM_CMD=%NVM_SYMLINK%\npm.cmd"
  if not defined NPM_CMD if exist "%NVM_HOME%\nodejs\npm.cmd" set "NPM_CMD=%NVM_HOME%\nodejs\npm.cmd"
  if not defined NPM_CMD if exist "C:\nvm4w\nodejs\npm.cmd" set "NPM_CMD=C:\nvm4w\nodejs\npm.cmd"
) else (
  set "NPM_CMD=npm"
)
if not defined NPM_CMD (
  echo ERROR: No se encontro npm. Instala Node/NVM correctamente.
  pause
  exit /b 1
)

:: Verificar dependencias minimas
if not exist node_modules\react (
  echo Dependencias faltantes. Ejecutando %NPM_CMD% install ...
  call %NPM_CMD% install
  if errorlevel 1 (
    echo ERROR: Fallo npm install
    pause
    exit /b 1
  )
)

call %NPM_CMD% run dev
if errorlevel 1 (
  echo.
  echo ========================================
  echo Fallback: ejecutando Vite directamente...
  echo ========================================
  node node_modules\vite\bin\vite.js
)
