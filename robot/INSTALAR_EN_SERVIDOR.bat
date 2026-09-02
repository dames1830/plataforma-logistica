@echo off
REM ==================================================================
REM  Lanzador del instalador del Robot Oracle WMS
REM  Clic derecho -> Ejecutar como administrador
REM ==================================================================

chcp 65001 >nul
title Instalador del Robot Oracle WMS

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR_EN_SERVIDOR.ps1"
