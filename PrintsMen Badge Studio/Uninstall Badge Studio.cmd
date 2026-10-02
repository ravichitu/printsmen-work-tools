@echo off
cd /d "%~dp0"
node setup\managed-install.mjs uninstall
pause
