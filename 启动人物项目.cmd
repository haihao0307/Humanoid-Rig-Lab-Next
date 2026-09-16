@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
rem Keep this batch file ASCII, without a BOM, and with CRLF line endings.
rem Prevent inherited Python inspection mode from opening an interactive prompt.
set "PYTHONINSPECT="
set "JARVIS_EXIT_CODE=1"
cd /d "%~dp0"
if errorlevel 1 goto :missing_project
if not exist "%~dp0server\start_server.py" goto :missing_project
if not exist "%~dp0index.html" goto :missing_project
title Human Workbench R11
echo Human Workbench R11 - starting the local server...
echo Keep this window open. The browser will open when the server is ready.
rem Probe the interpreter itself: Windows aliases may exist without Python.
py -3 -c "import sys; sys.exit(sys.version_info < (3, 9))" <nul >nul 2>nul
if not errorlevel 1 goto :run_py
python -c "import sys; sys.exit(sys.version_info < (3, 9))" <nul >nul 2>nul
if not errorlevel 1 goto :run_python
set "JARVIS_PYTHON=%~dp0.venv\Scripts\python.exe"
if exist "%JARVIS_PYTHON%" goto :probe_local
:find_bundled
set "JARVIS_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%JARVIS_PYTHON%" goto :missing_python
"%JARVIS_PYTHON%" -c "import sys; sys.exit(sys.version_info < (3, 9))" <nul >nul 2>nul
if not errorlevel 1 goto :run_local
goto :missing_python
:probe_local
"%JARVIS_PYTHON%" -c "import sys; sys.exit(sys.version_info < (3, 9))" <nul >nul 2>nul
if not errorlevel 1 goto :run_local
goto :find_bundled
:missing_python
echo.
echo [ERROR] Python 3.9 or newer was not found.
echo Install Python from https://www.python.org/downloads/ and enable Add Python to PATH.
echo Then run this launcher again.
goto :done
:missing_project
echo.
echo [ERROR] Cannot find the workbench files beside this launcher.
echo Keep this launcher, index.html and the server folder in the same project directory.
goto :done
:run_py
py -3 -X utf8 "%~dp0server\start_server.py" --open --page index.html
set "JARVIS_EXIT_CODE=%errorlevel%"
goto :service_exit
:run_python
python -X utf8 "%~dp0server\start_server.py" --open --page index.html
set "JARVIS_EXIT_CODE=%errorlevel%"
goto :service_exit
:run_local
echo Python: "%JARVIS_PYTHON%"
"%JARVIS_PYTHON%" -X utf8 "%~dp0server\start_server.py" --open --page index.html
set "JARVIS_EXIT_CODE=%errorlevel%"
:service_exit
echo Server exit code: %JARVIS_EXIT_CODE%
:done
echo.
echo The server has stopped. Keep any error message above.
pause
endlocal & exit /b %JARVIS_EXIT_CODE%
