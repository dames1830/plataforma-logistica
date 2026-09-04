@echo off
cd /d "%~dp0"
chcp 65001 >nul
python -u probar_outlook.py %* > logs\probar_outlook.txt 2>&1
exit /b %ERRORLEVEL%
