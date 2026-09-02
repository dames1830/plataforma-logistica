@echo off
REM ============================================================
REM  CRUCE CONTRA EL WMS  -  Bata
REM  Lo ejecuta la tarea "Robot cruce WMS", una vez al dia.
REM
REM  Baja los dos web reports del WMS
REM      PRODUCCION PICKING  ALDEAS X HORA acc calz
REM      PRODUCCION EMBALAJE ALDEAS X HORA acc calz
REM  y los compara contra lo que calculo la plataforma.
REM
REM  NO SE TOCA EL DISENO DE ESOS DOS INFORMES. Se corren y se
REM  exportan; jamas se aprieta Guardar. Se sale con Cancelar y
REM  el arbol de informes queda cerrado.
REM
REM  VA A LAS 21:30: el ultimo pase del avance de picking es
REM  20:20 y el de embalaje 20:40, asi que antes compararia
REM  medio dia. Y es hueco: el stock por hora entra 22:00 y el
REM  respaldo 23:00.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u cruce_wms.py

exit /b %ERRORLEVEL%
