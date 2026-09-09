@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 贾维斯本机语音工作台 V1.15.1
echo 贾维斯 V1.15.1：本机录音与转写
echo 首次打开后，在 工具 - 语音设置 中安装本地模型。
echo 请保持此窗口开启。录音不会上传云端。
rem Probe the interpreter itself: Windows aliases may exist without Python.
py -3 -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>nul
if not errorlevel 1 goto :run_py
python -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>nul
if not errorlevel 1 goto :run_python
set "JARVIS_PYTHON=%~dp0.venv\Scripts\python.exe"
if exist "%JARVIS_PYTHON%" goto :probe_local
:find_bundled
set "JARVIS_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%JARVIS_PYTHON%" goto :missing_python
"%JARVIS_PYTHON%" -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>nul
if not errorlevel 1 goto :run_local
goto :missing_python
:probe_local
"%JARVIS_PYTHON%" -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>nul
if not errorlevel 1 goto :run_local
goto :find_bundled
:missing_python
echo.
echo 未找到 Python。此版本的独立语音服务需要 Python 3.9 或更新版本。
echo 请从 https://www.python.org/downloads/ 安装，勾选 Add Python to PATH。
echo 旧版 Node 或 PowerShell 静态服务器没有本机转写功能，不能用于本次测试。
goto :done
:run_py
py -3 -X utf8 server\start_server.py --open --page index.html
goto :service_exit
:run_python
python -X utf8 server\start_server.py --open --page index.html
goto :service_exit
:run_local
echo Python: "%JARVIS_PYTHON%"
"%JARVIS_PYTHON%" -X utf8 server\start_server.py --open --page index.html
:service_exit
echo 服务退出码：%errorlevel%
:done
echo.
echo 服务已退出。如有错误，请保留上方错误信息。
pause
endlocal
