@echo off
REM ---------------------------------------------------------------------------
REM  respaldo.bat  -  Lo dispara el Programador de tareas de Windows cada 10 min.
REM
REM  La primera linea pregunta si le toca segun el horario que Daniel puso en la
REM  web. Codigo 0 = te toca, 1 = no. Si no le toca, se sale sin hacer nada, que
REM  es lo que pasa 143 de las 144 veces que despierta en el dia.
REM ---------------------------------------------------------------------------

python C:\wms_scraping\horario_robot.py respaldo || exit /b 0
python C:\wms_scraping\generar_respaldo.py
