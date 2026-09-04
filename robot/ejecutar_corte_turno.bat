@echo off
REM ============================================================
REM  CORTE DEL TURNO DIA  -  Bata
REM  Lo ejecuta la tarea "Robot corte de turno", una vez al dia.
REM
REM  Daniel, 03-sep-2026: "al finalizar el turno dia deberiamos ya
REM  tener los reportes y KPIs de lo que hizo el turno dia [...]
REM  busca un espacio para tener el reporte final de picking y
REM  embalaje", y "el corte deberia ser a partir de las 7 pm".
REM
REM  BAJA Y PUBLICA TRES COSAS, EN ESTE ORDEN:
REM    1. picking final del dia
REM    2. embalaje final del dia
REM    3. recepcion del dia (el ASN del mes en curso)
REM
REM  VA A LAS 20:00. No puede ir antes de las 19:00 porque el
REM  turno sigue trabajando, y entre las 19:16 y las 20:00 esta el
REM  Detalle de Orden. Las 20:00 son el primer hueco de verdad.
REM
REM  EL ULTIMO AVANCE DEL DIA ES EL DE LAS 16:00. Los pases de
REM  picking (18:00 y 20:00) y de embalaje (18:20 y 20:20) quedan
REM  apagados con `saltar` en horario_robot.py: un numero de las
REM  18:00 que queda viejo cincuenta minutos despues no sirve.
REM
REM  CADA PASO ES INDEPENDIENTE: si la recepcion falla, picking y
REM  embalaje ya quedaron publicados.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u corte_turno.py %*

exit /b %ERRORLEVEL%
