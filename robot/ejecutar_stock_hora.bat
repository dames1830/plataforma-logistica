@echo off
REM ============================================================
REM  Stock de la hora - Bata
REM  Lo ejecuta la tarea programada "Stock por hora", cada hora
REM  al minuto 30, todos los dias.
REM
REM  Baja Stock Activo y Stock Reserva de Oracle y los publica en
REM  el cajon de la hora, para que los reportes muestren el avance
REM  del turno. NO toca la foto de las 19:00, NO arma el Slotting
REM  y NO deja archivos en OneDrive.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas a
REM  la vez. Paso el 08-ago-2026 y el resultado en pantalla no vale.
REM ============================================================

REM La carpeta es la de ESTE archivo. En la laptop el robot vive en
REM C:\Users\dames\.gemini\... y en el servidor en C:\wms_scraping.
cd /d "%~dp0"

REM Codigo de pagina UTF-8 para que los acentos del log no salgan rotos
chcp 65001 >nul

REM -u = salida sin buffer, para que el log se escriba en vivo
python -u stock_por_hora.py

REM Codigos de salida:
REM    0 = publicado, o salteado porque el robot principal estaba adentro
REM    1 = error de configuracion o de login
REM    2 = no bajo ninguno de los dos stocks
REM    3 = bajaron pero no se pudieron publicar (o solo se publico uno)
exit /b %ERRORLEVEL%
