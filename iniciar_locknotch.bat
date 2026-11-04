@echo off
cd /d "%~dp0"
title LockNotch
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM media-service.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit
