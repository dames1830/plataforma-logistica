@echo off
REM ============================================================
REM  CORREO DE PROGRAMACION DE RECEPCION  -  Bata
REM  Lo ejecuta la tarea "Robot correo citas", cada 30 minutos
REM  entre las 16:00 y las 18:30.
REM
REM  Daniel, 03-sep-2026: "el correo lo mandan a partir de las
REM  cuatro de la tarde, mas o menos, o sea que entre cuatro y
REM  seis tienes que capturar ese correo".
REM
REM  SE INTENTA VARIAS VECES a proposito: "a partir de las cuatro,
REM  mas o menos" es una franja, no una hora. El robot lleva su
REM  lista de correos vistos, asi que el segundo pase encuentra
REM  el mismo correo y no hace nada.
REM
REM  NO ENTRA AL WMS: habla con el Outlook de escritorio de esta
REM  maquina por COM. No le pelea el turno a ningun otro robot,
REM  pero SI necesita que Outlook este abierto con ese buzon.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u correo_citas.py %*

exit /b %ERRORLEVEL%
