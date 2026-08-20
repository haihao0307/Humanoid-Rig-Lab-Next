@echo off
setlocal
cd /d "%~dp0"
title Humanoid Rig Lab V8.4 2D

where node >nul 2>nul
if errorlevel 1 goto powershell_fallback
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?renderer=2d&build=v8.3-anatomical-fit"
node server.mjs
if errorlevel 1 pause
exit /b

:powershell_fallback
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4173/?renderer=2d&build=v8.3-anatomical-fit"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-windows.ps1"
if errorlevel 1 pause
endlocal
