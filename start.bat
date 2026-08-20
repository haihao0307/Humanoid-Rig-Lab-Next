@echo off
setlocal
cd /d "%~dp0"
title Humanoid Rig Lab Next

echo.
echo ===============================================
echo   Humanoid Rig Lab Next - local review server
echo ===============================================
echo.
echo Starting from:
echo %CD%
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Startup failed with exit code %EXIT_CODE%.
  echo Please send launcher.log and startup-diagnostics.txt back for checking.
  echo.
  pause
)

endlocal
