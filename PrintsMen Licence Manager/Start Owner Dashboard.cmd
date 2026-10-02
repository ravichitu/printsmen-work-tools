@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or later before starting the owner dashboard.
  pause
  exit /b 1
)
node setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4290 in your browser after the server starts.
node server.mjs
pause
