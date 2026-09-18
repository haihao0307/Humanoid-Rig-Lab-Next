@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
echo Open http://127.0.0.1:8792/linen.html?linen=1
node server\linen-server.cjs
pause
