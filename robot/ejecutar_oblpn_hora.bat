@echo off
REM ============================================================
REM  AVANCE DE EMBALAJE POR HORA  -  Bata
REM  Lo ejecuta la tarea "Robot embalaje por hora", cada 2 horas
REM  al minuto 40.
REM
REM  Baja el OBLPN del DIA EN CURSO y lo deja en OneDrive:
REM      scraping Stock\OBLPN Embalaje\OBLPN DD-MM.csv
REM
REM  Daniel, 31-ago-2026: "el avance de picking, el avance de
REM  embalaje tiene que ser cada dos horas. Necesitamos un
REM  estatus cada dos horas".
REM
REM  VA AL MINUTO 40, detras del picking por hora que entra al
REM  :20 y tarda unos 19 minutos. Los dos entran al WMS y solo
REM  cabe uno: si este arrancara antes, uno de los dos se pierde
REM  la vuelta.
REM
REM  EL ARCHIVO SE PISA EN CADA PASE, a proposito: siempre queda
REM  el ultimo estado del dia, que es lo que se quiere de un
REM  avance. El ultimo pase del dia es a las 22:40.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

REM --hoy = el dia en curso. Sin esa bandera bajaria AYER, que es
REM la salida de emergencia para recuperar un dia que no salio.
python -u oblpn_embalaje.py --hoy
set RC=%ERRORLEVEL%

REM  SEGUNDO PASO: el cuadro de Embalaje por dia. NO entra al WMS:
REM  lee el OBLPN que la linea de arriba acaba de dejar y publica
REM  persona x hora, canal y efectividad. Corre aunque la bajada
REM  falle -queda el archivo del pase anterior y es mejor que
REM  dejar la pantalla sin datos-; el codigo de salida sigue
REM  siendo el de la bajada.
python -u produccion_embalaje.py

exit /b %RC%
