@echo off
REM ============================================================
REM  DISTRIBUCION  -  Bata
REM  Lo ejecuta la tarea "Robot distribucion", a las 08:00 y a
REM  las 20:00, de lunes a sabado.
REM
REM  Daniel, 05-sep-2026, sobre los bultos que llevan dias
REM  parados: "eso es lo que quiero detectar. Ahorita lo hacen
REM  manualmente. Yo lo que quiero es automatizarlo".
REM
REM  PUBLICA DOS AREAS:
REM    distribucion_dia        el cuadro de Retail, los pivots de
REM                            turno x zona, patio, staging y los
REM                            bultos varados
REM    distribucion_detalle    el desglose por articulo, solo para
REM                            el boton de Excel
REM
REM  EL DESPACHO POTENCIAL YA NO SALE DE AQUI. Necesita el correo
REM  de comercial, que llega entre las 18:00 y las 22:30, asi que
REM  tiene su propia tarea: ejecutar_potencial.bat. Daniel,
REM  07-sep-2026: "para distribucion no necesitas el correo de
REM  comercial, lo puedes hacer con los cortes de turno".
REM
REM  08:00 Y 20:00, NO 07:00 Y 19:00: a esa hora el cierre de
REM  turno todavia esta bajando el picking del dia -termina 07:50
REM  y 19:44- y este robot lo lee.
REM
REM  NO TOCA EL WMS. Solo lee archivos que ya bajaron los otros
REM  robots y publica en la plataforma, asi que no le quita la
REM  sesion de Oracle a nadie. Tarda 45 segundos.
REM
REM  PARA PROBARLO SIN PUBLICAR:  ejecutar_distribucion.bat --probar
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u distribucion.py --solo-distribucion %*

exit /b %ERRORLEVEL%
