@echo off
REM ============================================================
REM  DESPACHO POTENCIAL  -  Bata
REM  Lo ejecuta la tarea "Robot despacho potencial", cada media
REM  hora de 18:30 a 23:30, de lunes a viernes.
REM
REM  ESPERA AL CORREO DE COMERCIAL. Daniel, 07-sep-2026: "para el
REM  despacho potencial tu necesitas si o si el correo comercial,
REM  y llega entre las seis de la tarde y puede llegar hasta las
REM  diez de la noche. Una vez que tengas el correo comercial,
REM  ahi recien procesas ese reporte".
REM
REM  Medido: los correos llegan de 18:02 a 22:32, lunes a viernes.
REM
REM  COMO SE COMPORTA EN CADA PASE:
REM    no llego el correo   -> no publica nada y sale con 0
REM    llego y es nuevo     -> publica y deja una marca
REM    ya se proceso        -> no lo repite
REM  La marca guarda el nombre y la hora del archivo: si comercial
REM  manda una correccion, se vuelve a procesar solo.
REM
REM  PUBLICA UNA AREA:  despacho_potencial_dia
REM
REM  PARA FORZARLO A MANO:  ejecutar_potencial.bat --forzar
REM  PARA PROBAR SIN PUBLICAR:  ejecutar_potencial.bat --probar
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u distribucion.py --solo-potencial %*

exit /b %ERRORLEVEL%
