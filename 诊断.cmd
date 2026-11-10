@echo off
chcp 65001 >nul
set "PET_PYTHON=%AGENT_PET_PYTHON%"
if not defined PET_PYTHON set "PET_PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%PET_PYTHON%" (
  echo Python interpreter missing. Set AGENT_PET_PYTHON or install .venv. 1>&2
  exit /b 2
)
call "%PET_PYTHON%" -X utf8 -B "%~dp0setup_check.py"
exit /b %errorlevel%
