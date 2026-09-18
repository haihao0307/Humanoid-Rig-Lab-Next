@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "SHORTS_PREVIEW=1"
node tools\build-shorts-preview.mjs
if errorlevel 1 goto :failed
echo Open http://127.0.0.1:8793/shorts.html?shorts=1
node server\linen-server.cjs
pause
exit /b
:failed
echo Shorts preview could not be built. See the error above.
pause
exit /b 1
