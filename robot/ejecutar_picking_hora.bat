@echo off
REM ============================================================
REM  AVANCE DE PICKING POR HORA  -  Bata
REM  Lo ejecuta la tarea "Picking por hora", cada 2 horas al
REM  minuto 20.
REM
REM  Son DOS pasos y en este orden:
REM   1. picking_por_hora.py   entra al WMS y baja el archivo de
REM                            picking del dia a OneDrive.
REM   2. produccion_picking.py NO entra al WMS: lee ese archivo
REM                            y publica el cuadro de Picking por
REM                            dia -persona x hora, canal y
REM                            efectividad-.
REM
REM  Daniel, 02-sep-2026: "ese picking por hora es el que tienes
REM  que agarrar para el modulo de picking dia". Por eso el
REM  cuadro va enganchado aca atras y no como robot aparte: nadie
REM  baja nada dos veces ni pelea por el turno del WMS.
REM
REM  EL PASO 2 CORRE AUNQUE EL 1 FALLE. Si el WMS estaba ocupado
REM  y no se bajo nada, queda el archivo del pase anterior y el
REM  cuadro se rearma con ese: es mejor que dejar la pantalla sin
REM  datos. El codigo de salida sigue siendo el del paso 1, que
REM  es el que dice si la bajada anduvo.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u picking_por_hora.py
set RC=%ERRORLEVEL%

python -u produccion_picking.py

exit /b %RC%
