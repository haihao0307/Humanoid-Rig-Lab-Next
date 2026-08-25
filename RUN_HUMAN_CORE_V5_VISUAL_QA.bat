@echo off
setlocal
pushd "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\run-human-core-v5-visual-qa.ps1" -Headed -KeepServer
set "QA_EXIT=%ERRORLEVEL%"
if not "%QA_EXIT%"=="0" pause
popd
exit /b %QA_EXIT%
