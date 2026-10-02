@echo off
cd /d "%~dp0"
if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" "%~dp0start.mjs" --updates
) else (
  node "%~dp0start.mjs" --updates
)
if errorlevel 1 pause
