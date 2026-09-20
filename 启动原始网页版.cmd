@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "CENTOPIA_OPEN_BROWSER=1"
node scripts\web-server.cjs
if errorlevel 1 pause
