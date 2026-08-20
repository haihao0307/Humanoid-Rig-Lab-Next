@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-skin-v002.ps1"
if errorlevel 1 (
  echo.
  echo SKIN V002 launch failed. Check skin-v002-launch-error.log in this folder.
  echo.
  pause
)
endlocal
