@echo off
REM ==================================================================
REM  Chequeo de OneDrive - Robot Oracle WMS
REM
REM  Doble clic. NO instala nada, NO cambia nada. Solo mira y avisa.
REM  Hay que correrlo EN EL SERVIDOR (vmi3488466).
REM ==================================================================

chcp 65001 >nul
title Chequeo de OneDrive - Robot Oracle WMS

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CHEQUEAR_ONEDRIVE.ps1"

echo.
pause
