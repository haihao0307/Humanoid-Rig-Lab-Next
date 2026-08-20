@echo off
setlocal
cd /d "%~dp0"
title Humanoid Rig Lab V8.4 Setup

echo.
echo ============================================
echo   Prepare local Three.js 0.185.1 runtime
echo ============================================
echo.

set "RUNTIME_READY=0"
if exist "node_modules\three\build\three.webgpu.js" set "RUNTIME_READY=1"
if exist "vendor\three.webgpu.js" if exist "vendor\three.core.js" set "RUNTIME_READY=1"

if "%RUNTIME_READY%"=="0" (
  where npm >nul 2>nul
  if not errorlevel 1 (
    echo Trying npm installation first...
    call npm install --no-audit --no-fund --fetch-retries=2 --fetch-timeout=60000
    if exist "node_modules\three\build\three.webgpu.js" set "RUNTIME_READY=1"
  )
)

if "%RUNTIME_READY%"=="0" (
  echo.
  echo npm did not provide the runtime. Trying direct vendor download...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-three-runtime.ps1"
  if exist "vendor\three.webgpu.js" if exist "vendor\three.core.js" set "RUNTIME_READY=1"
)

if "%RUNTIME_READY%"=="0" (
  echo.
  echo Local Three.js setup did not finish.
  echo Check the network or proxy, then run this file again.
  pause
  exit /b 1
)

echo.
echo Local Three.js runtime is ready. Starting V8.4...
where node >nul 2>nul
if errorlevel 1 goto powershell_server

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?build=v8.3-anatomical-fit"
node server.mjs
if errorlevel 1 pause
exit /b

:powershell_server
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?build=v8.3-anatomical-fit"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-windows.ps1"
if errorlevel 1 pause
endlocal
