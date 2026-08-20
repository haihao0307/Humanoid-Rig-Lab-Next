@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-module-branches.ps1"
if errorlevel 1 (
  echo.
  echo Branch preparation failed. Read the message above.
  pause
  exit /b 1
)
echo.
pause
