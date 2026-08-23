@echo off
REM ---------------------------------------------------------------------------
REM  mapa.bat  -  Lo dispara el Programador de tareas de Windows cada 10 min.
REM
REM  La primera linea pregunta si le toca segun el horario que Daniel puso en la
REM  web (Configuracion -> Parametros). Codigo 0 = te toca, 1 = no. Si no le
REM  toca, se sale sin hacer nada.
REM
REM  VA DESPUES DEL STOCK POR HORA, no antes: este mapa se dibuja con el stock
REM  que ese robot acaba de publicar. El de las :30 tarda unos 8 minutos, asi
REM  que el mapa va al :45 -y no al :50, que es del picking-.
REM
REM  NO ENTRA A ORACLE: lee de la API lo que ya esta publicado. Por eso no
REM  necesita el candado bloqueo_wms ni pelea la sesion con nadie.
REM ---------------------------------------------------------------------------

python C:\wms_scraping\horario_robot.py mapa_hora || exit /b 0
python C:\wms_scraping\mapa_por_hora.py
