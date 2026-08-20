@echo off
setlocal
cd /d "%~dp0"
(
  echo Humanoid Rig Lab Next startup diagnostics
  echo Date: %DATE% %TIME%
  echo Folder: %CD%
  echo.
  echo [Node]
  where node 2^>nul
  node --version 2^>nul
  echo.
  echo [PowerShell]
  powershell.exe -NoProfile -Command "$PSVersionTable.PSVersion.ToString()" 2^>nul
  echo.
  echo [Port 4173]
  netstat -ano ^| findstr ":4173"
  echo.
  echo [Required files]
  if exist index.html (echo OK index.html) else (echo MISSING index.html)
  if exist server.mjs (echo OK server.mjs) else (echo MISSING server.mjs)
  if exist launcher.ps1 (echo OK launcher.ps1) else (echo MISSING launcher.ps1)
  if exist server-windows.ps1 (echo OK server-windows.ps1) else (echo MISSING server-windows.ps1)
) > startup-diagnostics.txt

echo Diagnostics saved to startup-diagnostics.txt
start "" notepad.exe "%~dp0startup-diagnostics.txt"
pause
endlocal
