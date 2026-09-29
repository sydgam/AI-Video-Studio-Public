@echo off
set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"
set "TTS_PY=%LOCALAPPDATA%\AI-Video-Studio-TTS\venv\Scripts\python.exe"
set "HF_HOME=%LOCALAPPDATA%\AI-Video-Studio-TTS\models"
if not exist "%TTS_PY%" (
  echo Local TTS environment is not installed.
  echo Run the TTS installation step first.
  pause
  exit /b 1
)
echo Starting AI Video Studio Local TTS...
echo Address: http://127.0.0.1:8060
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\start-local-tts.ps1" -Restart
pause
