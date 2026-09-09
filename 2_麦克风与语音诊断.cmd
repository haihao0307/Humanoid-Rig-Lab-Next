@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 贾维斯本机语音工作台 V1.15.1
echo 贾维斯 V1.15.1：本机录音与转写
echo 本页不需要安装模型，先录音回放检查声音。
echo 请保持此窗口开启。录音不会上传云端。
where py >nul 2>nul
if not errorlevel 1 (
  py -3 server\start_server.py --open --page "audio-check.html"
  goto :done
)
where python >nul 2>nul
if not errorlevel 1 (
  python server\start_server.py --open --page "audio-check.html"
  goto :done
)
echo.
echo 未找到 Python。此版本的独立语音服务需要 Python 3.9 或更新版本。
echo 请从 https://www.python.org/downloads/ 安装，勾选 Add Python to PATH。
echo 旧版 Node 或 PowerShell 静态服务器没有本机转写功能，不能用于本次测试。
:done
echo.
echo 服务已退出。如有错误，请保留上方错误信息。
pause
endlocal
