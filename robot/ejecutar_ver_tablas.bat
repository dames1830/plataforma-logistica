@echo off
REM  Mira que tablas ofrece el disenador de informes del WMS. NO GUARDA NADA.
cd /d "%~dp0"
chcp 65001 >nul
python -u ver_tablas_wms.py > logs\ver_tablas.txt 2>&1
exit /b %ERRORLEVEL%
