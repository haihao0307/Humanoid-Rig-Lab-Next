@echo off
setlocal
cd /d "%~dp0"
title Humanoid Rig Lab V8.5 3D

where node >nul 2>nul
if errorlevel 1 goto powershell_fallback

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?build=v8.5-performance-rig"
node server.mjs
if errorlevel 1 pause
endlocal
exit /b

:powershell_fallback
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?build=v8.5-performance-rig"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-windows.ps1"
if errorlevel 1 pause
endlocal
