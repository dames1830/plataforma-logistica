@echo off
REM ---------------------------------------------------------------------------
REM  sin_salida.bat  -  Lo dispara el Programador de tareas de Windows cada 10 min.
REM
REM  La primera linea pregunta si le toca segun el horario que Daniel puso en la
REM  web. Codigo 0 = te toca, 1 = no. Si no le toca, se sale sin hacer nada.
REM
REM  VA DESPUES DE LOS REPORTES DIARIOS, no antes: este cuadro necesita el
REM  Detalle de Orden del dia que cerro —de ahi salen el pendiente, las ordenes,
REM  las tiendas y el pedido mas antiguo—. Si corre primero, muestra la demanda
REM  de anteayer con el stock de hoy y nadie lo nota.
REM ---------------------------------------------------------------------------

python C:\wms_scraping\horario_robot.py sin_salida || exit /b 0
python C:\wms_scraping\sku_sin_salida.py
