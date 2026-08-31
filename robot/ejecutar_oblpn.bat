@echo off
REM ============================================================
REM  OBLPN de embalaje - Bata
REM  Lo ejecuta la tarea programada "Robot OBLPN embalaje",
REM  a las 06:45 de lunes a sabado.
REM
REM  Baja de Oracle la pantalla TRX_OBLPN/CARTON del DIA ANTERIOR
REM  y la deja en OneDrive:
REM      scraping Stock\OBLPN Embalaje\OBLPN DD-MM.csv
REM
REM  MISMA HORA Y MISMOS DIAS QUE EL DETALLE DE ORDEN. Lo pidio
REM  Daniel el 30-ago-2026 y tiene sentido: los dos bajan AYER ya
REM  cerrado, asi que tienen que mirar la misma jornada. Si uno
REM  corriera a otra hora, un dia cualquiera cruzarian jornadas
REM  distintas y el cruce picking-embalaje saldria mal.
REM
REM  Los dos entran al WMS a la misma hora. No se pisan: el
REM  candado los ordena y el segundo espera su turno hasta 25
REM  minutos.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez. Paso el 08-ago-2026.
REM ============================================================

REM La carpeta es la de ESTE archivo (C:\wms_scraping en el servidor)
cd /d "%~dp0"

REM Codigo de pagina UTF-8 para que los acentos del log no salgan rotos
chcp 65001 >nul

REM -u = salida sin buffer, para que el log se escriba en vivo.
REM Sin argumentos baja AYER, que es lo que se quiere todos los dias.
python -u oblpn_embalaje.py

REM Codigos de salida:
REM    0 = bajo el archivo
REM    1 = falla de configuracion, de login, o no bajo
REM
REM SI UN DIA FALLA, ESE DIA NO SE PIERDE. El WMS guarda la
REM historia. Se recupera a mano abriendo una ventana de comandos
REM en C:\wms_scraping y escribiendo, por ejemplo:
REM
REM    python oblpn_embalaje.py --dia 12-08-2026
REM
REM O un tramo entero:
REM
REM    python oblpn_embalaje.py --desde 01-08-2026 --hasta 06-08-2026
REM
REM OJO CON LOS TRAMOS LARGOS: el candado del WMS se toma UNA vez
REM para toda la corrida y vence a los 150 minutos. Un tramo de
REM mas de 6 dias pasa de esas 2.5 horas y otro robot podria
REM entrar en el medio. Partirlo en tandas.
exit /b %ERRORLEVEL%
