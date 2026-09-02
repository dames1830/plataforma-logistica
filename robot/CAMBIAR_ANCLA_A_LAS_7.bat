@echo off
REM ============================================================
REM  Mueve la foto ancla de la manana de las 06:00 a las 07:00
REM
REM  CLIC DERECHO -> EJECUTAR COMO ADMINISTRADOR.
REM
REM  Muestra como esta la tarea, pide confirmacion escribiendo
REM  SI, y despues muestra como quedo. Solo toca el disparador
REM  de las 06:00: el de las 19:00 queda igual.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO.
REM ============================================================

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CAMBIAR_ANCLA_A_LAS_7.ps1"
