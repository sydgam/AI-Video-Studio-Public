@echo off
set "TTS_PY=%LOCALAPPDATA%\AI-Video-Studio-TTS\venv\Scripts\python.exe"
set "HF_HOME=%LOCALAPPDATA%\AI-Video-Studio-TTS\models"
if exist "%TTS_PY%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local-tts.ps1"
)
cd /d "%~dp0pixel-office"
if not exist node_modules (
  echo Installing Pixel Office dependencies...
  call npm.cmd install
  if errorlevel 1 goto :build_failed
)
echo Building Pixel Office for AI Video Studio...
call npm.cmd run build
if errorlevel 1 goto :build_failed
cd /d "%~dp0"
set AI_VIDEO_STUDIO_PORT=8055
python server.py
pause
exit /b 0

:build_failed
echo Pixel Office build failed. AI Video Studio was not started.
pause
exit /b 1
