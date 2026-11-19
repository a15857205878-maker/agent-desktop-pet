@echo off
chcp 65001 >nul
py -3.12 -m venv "%~dp0.venv"
if errorlevel 1 exit /b 1
"%~dp0.venv\Scripts\python.exe" -m pip install -r "%~dp0requirements.lock.txt"
exit /b %errorlevel%
