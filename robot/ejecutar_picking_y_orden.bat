@echo off
REM ============================================================
REM  DETALLE DE ORDEN  -  Bata
REM  Lo ejecuta la tarea "Picking y Detalle Orden de ayer", dos
REM  veces al dia: 07:20 y 19:20.
REM
REM  Baja el picking del dia que cerro y el Detalle de Orden.
REM
REM  Y DETRAS, SIN ENTRAR AL WMS, CALCULA LOS SKUs SIN SALIDA.
REM  Daniel, 04-sep-2026: "no quiero llenarme de interfaces, si
REM  otro reporte lo puede hacer quita esa interfaz".
REM
REM  Tiene razon: ese calculo NO BAJA NADA. Solo lee las fotos de
REM  stock que el ancla ya trae, el Maestro y el Detalle de Orden
REM  que esta misma corrida acaba de dejar. Era una linea mas en
REM  la lista para un minuto de cuenta.
REM
REM  VA ACA Y NO EN OTRO LADO porque su ultimo ingrediente es el
REM  Detalle de Orden del dia que cerro, y llega justo arriba.
REM
REM  SOLO EN EL PASE DE LA MANANA. El de las 19:20 puede estirarse
REM  hasta las 20:00 y ahi entra el corte del turno: sumarle otro
REM  minuto seria empujarlo encima.
REM
REM  Y SI EL DETALLE DE ORDEN FALLA, SE CALCULA IGUAL: las fotos
REM  de stock alcanzan para saber que no se movio; lo que se
REM  pierde es la columna de pedidos pendientes. Un cuadro sin esa
REM  columna sirve; ninguno, no.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

python -u picking_y_orden.py
set RC=%ERRORLEVEL%

REM LA HORA LA DECIDE PYTHON, no el %TIME% de cmd: ese depende del
REM idioma de Windows y trae un espacio delante cuando la hora es de
REM una cifra. Es de las cosas que fallan una vez cada tanto, de
REM madrugada, sin que nadie lo note. Sale con 0 si es de manana.
python -c "import datetime,sys; sys.exit(0 if datetime.datetime.now().hour < 12 else 1)"
if not errorlevel 1 python -u sku_sin_salida.py

exit /b %RC%
