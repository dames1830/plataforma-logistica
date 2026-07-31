@echo off
chcp 65001 >nul
title Revision del entorno de PRUEBAS
cd /d "%~dp0"
python revisar_pruebas.py
echo.
pause
