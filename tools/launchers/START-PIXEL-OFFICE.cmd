@echo off
set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%\pixel-office"
if not exist node_modules (
  echo Installing Pixel Office dependencies...
  call npm.cmd install
)
call npm.cmd run dev
pause
