@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0pet-install-diagnosis.ps1"
exit /b %errorlevel%
