@echo off
set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"
set AI_VIDEO_STUDIO_PORT=8055
python server.py
pause
