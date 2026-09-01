@echo off
REM ============================================================
REM  ASN completo - Bata
REM  Lo ejecuta la tarea programada "Robot ASN" a las 04:30,
REM  todos los dias, y la hora se cambia desde el modulo web.
REM
REM  Hace DOS cosas, en este orden:
REM    1) baja el web report "ASN" del WMS, un archivo por mes,
REM       seis meses hacia atras, a OneDrive\scraping Stock\ASN
REM    2) lee esos seis archivos y publica el resumen a la
REM       plataforma, area 'asn_recepcion', que es lo que dibuja
REM       la pantalla Recepcion -> ASN Detalle
REM
REM  POR QUE POR MESES Y NO UN BLOQUE UNICO: un mes son ~13 MB y
REM  5 minutos; los seis, 64 MB y 48 minutos. El tiempo total es
REM  casi el mismo, pero por partes: si falla un mes se reintenta
REM  ese solo, el candado del WMS se suelta entre mes y mes, y se
REM  esquiva el 504 que Oracle devuelve con las consultas grandes.
REM
REM  EL RESUMEN CORRE IGUAL AUNQUE ALGUN MES FALLE. Con cinco de
REM  seis la pantalla sirve; dejarla en blanco por un mes que no
REM  bajo seria peor.
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
REM Sin argumentos baja los seis meses.
python -u asn_web_report.py %* > logs\asnweb.txt 2>&1
set BAJADA=%ERRORLEVEL%

python -u asn_resumen.py > logs\asnresumen.txt 2>&1
set RESUMEN=%ERRORLEVEL%

REM Codigos de salida:
REM    0 = bajo todo y publico
REM    1 = algun mes no bajo (el resumen igual se publico)
REM    3 = el resumen no se pudo publicar
if not "%RESUMEN%"=="0" exit /b %RESUMEN%
exit /b %BAJADA%
