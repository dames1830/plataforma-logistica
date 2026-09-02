@echo off
REM ==================================================================
REM  Destrabar los Slotting - Robot Oracle WMS   07-ago-2026
REM
REM  Doble clic. Se detiene solo si no es el servidor.
REM  Respalda cada archivo AFUERA de OneDrive antes de tocarlo.
REM ==================================================================

chcp 65001 >nul
title Destrabar los Slotting - Robot Oracle WMS

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DESTRABAR_SLOTTING.ps1"

echo.
pause
