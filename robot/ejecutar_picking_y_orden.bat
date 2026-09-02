@echo off
REM ============================================================
REM  Picking y Detalle Orden de ayer - Bata
REM  Lo ejecuta la tarea programada "Picking y Detalle Orden de ayer",
REM  todos los dias a las 08:00.
REM
REM  Baja de Oracle los dos reportes del DIA ANTERIOR COMPLETO y
REM  los deja en OneDrive:
REM      scraping Stock\Picking\Picking D-M.csv
REM      scraping Stock\Detalle Orden\Detalle Orden DD-MM.csv
REM
REM  Va a las 08:00 porque a las 07:00 se toma la foto ancla del
REM  turno y Oracle no admite dos sesiones a la vez. Estos
REM  reportes bajan AYER, que ya cerro. Y baja AYER ENTERO,
REM  de 00:00 a 23:59, para no perder lo que pica catalogo web
REM  entre las 20:00 y las 23:59.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez. Paso el 08-ago-2026 y el resultado en pantalla no
REM  vale.
REM ============================================================

REM La carpeta es la de ESTE archivo (C:\wms_scraping en el servidor)
cd /d "%~dp0"

REM Codigo de pagina UTF-8 para que los acentos del log no salgan rotos
chcp 65001 >nul

REM -u = salida sin buffer, para que el log se escriba en vivo
python -u picking_y_orden.py

REM Codigos de salida:
REM    0 = bajaron los dos
REM    1 = falto alguno, o falla de configuracion
REM
REM SI UN DIA FALLA, ESE DIA NO SE PIERDE. El WMS guarda la
REM historia. Se recupera a mano abriendo una ventana de comandos
REM en C:\wms_scraping y escribiendo, por ejemplo:
REM
REM    python picking_y_orden.py --dia 12-08-2026
REM
exit /b %ERRORLEVEL%
