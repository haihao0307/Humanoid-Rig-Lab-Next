@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto :fallback
node.exe "%~dp0New-Human-Production\R007\start-preview.cjs"
goto :done
:fallback
if not exist "%ProgramFiles%\nodejs\node.exe" goto :missing
"%ProgramFiles%\nodejs\node.exe" "%~dp0New-Human-Production\R007\start-preview.cjs"
goto :done
:missing
echo Node.js was not found. Install Node.js and run this file again.
pause
exit /b 1
:done
if errorlevel 1 pause
endlocal
