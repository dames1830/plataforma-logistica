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
REM  VA A LAS 20:00 y no antes. El ancla entra 19:00 y sale 19:16;
REM  el Detalle de Orden entra 19:20 y tarda hasta 40 minutos.
REM  Entre las 18:33 y las 19:00 hay 27 minutos libres y este
REM  bloque necesita 50: arrancar a las 18:30 seguiria adentro del
REM  WMS cuando entra el ancla, que es lo que ya tumbo el arranque
REM  del turno dos veces.
REM
REM  NO CUESTA TIEMPO DE WMS DE MAS: reemplaza los pases sueltos de
REM  picking (20:00) y embalaje (20:20), que ya bajaban lo mismo.
REM  Esos dos van apagados con `saltar` en horario_robot.py.
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
