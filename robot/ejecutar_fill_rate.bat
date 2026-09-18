@echo off
REM ============================================================
REM  FILL RATE DEL CORREO DE COMERCIAL  -  Bata
REM  Lo ejecuta la tarea "Robot fill rate", a las 09:15 y a las
REM  21:15, de lunes a sabado (el horario lo manda la web).
REM
REM  Daniel, 17-sep-2026: "todas las fechas en que comercial ha
REM  mandado pedidos, desde julio hasta ayer [...] para cerrar
REM  todo el ciclo". Va al pie de Picking por dia.
REM
REM  PUBLICA UN AREA:
REM    fill_rate_correo   cada guia del correo con lo solicitado,
REM                       lo picado, el patio, el staging, lo
REM                       cargado y lo despachado
REM
REM  09:15 Y 21:15: despues del OBLPN entero de ayer (llega
REM  08:55) y despues del OBLPN y el picking de la tarde (19:54 y
REM  20:06) y del correo de comercial (19:00 en adelante).
REM
REM  NO TOCA EL WMS. Solo lee archivos que ya bajaron los otros
REM  robots y publica, asi que no le quita la sesion de Oracle a
REM  nadie. Tarda un minuto.
REM
REM  PARA PROBARLO SIN PUBLICAR:  ejecutar_fill_rate.bat --probar
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u fill_rate_correo.py %*

exit /b %ERRORLEVEL%
