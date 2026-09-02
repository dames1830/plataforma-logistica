@echo off
REM ============================================================
REM  CIERRE DEL DIA ANTERIOR  -  Bata
REM  Lo ejecuta la tarea "Robot cierre dia", una vez al dia.
REM
REM  Baja el OBLPN del dia anterior ENTERO y recalcula los dos
REM  cuadros -picking y embalaje- de 00:00 a 23:59. Lo que queda
REM  en el historial es esto, no el ultimo avance de las 20:20.
REM
REM  El picking de ayer NO se vuelve a bajar: ya lo deja el robot
REM  de las 07:20, y repetirlo serian trece minutos mas de WMS
REM  ocupado para el mismo archivo.
REM
REM  VA A LAS 08:30: el robot de las 07:20 tarda hasta 40 minutos,
REM  asi que a esa hora el picking de ayer ya esta y el WMS queda
REM  libre hasta el primer avance de las 10:00.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u cierre_dia.py

exit /b %ERRORLEVEL%
