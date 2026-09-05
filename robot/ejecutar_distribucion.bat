@echo off
REM ============================================================
REM  DISTRIBUCION Y DESPACHO POTENCIAL  -  Bata
REM  Lo ejecuta la tarea "Robot distribucion", una vez al dia.
REM
REM  Daniel, 05-sep-2026, sobre los bultos que llevan dias
REM  parados: "eso es lo que quiero detectar. Ahorita lo hacen
REM  manualmente. Yo lo que quiero es automatizarlo".
REM
REM  PUBLICA TRES AREAS:
REM    distribucion_dia        el cuadro de Retail, los pivots de
REM                            turno x zona, patio, staging y los
REM                            bultos varados
REM    distribucion_detalle    el desglose por articulo, solo para
REM                            el boton de Excel
REM    despacho_potencial_dia  patio + staging + correo, por tienda
REM
REM  VA A LAS 22:00. Necesita dos cosas que llegan tarde: el
REM  picking del dia, que lo deja el Corte del turno cerca de las
REM  21:00, y el OBLPN de la noche.
REM
REM  NO TOCA EL WMS. Solo lee archivos que ya bajaron los otros
REM  robots y publica en la plataforma, asi que no le quita la
REM  sesion de Oracle a nadie y puede convivir con el stock por
REM  hora, que arranca a esa misma hora. Tarda 45 segundos.
REM
REM  PARA PROBARLO SIN PUBLICAR:  ejecutar_distribucion.bat --probar
REM  Deja los tres JSON al lado, con el mismo nombre del area.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u distribucion.py %*

exit /b %ERRORLEVEL%
