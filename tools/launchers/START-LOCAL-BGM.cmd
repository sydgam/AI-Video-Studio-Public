@echo off
set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"
set "BGM_PY=%PROJECT_ROOT%\.runtime\bgm\ACE-Step-1.5\.venv\Scripts\python.exe"
if not exist "%BGM_PY%" (
  echo Local BGM engine is not installed.
  exit /b 1
)
"%BGM_PY%" -u "%PROJECT_ROOT%\tools\generate-local-bgm.py" %*
pause
