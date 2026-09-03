@echo off
REM ---------------------------------------------------------------------------
REM  archivar.bat  -  Lo dispara el Programador de tareas de Windows cada 10 min.
REM
REM  La primera linea pregunta si le toca segun el horario que Daniel puso en la
REM  web. Codigo 0 = te toca, 1 = no.
REM
REM  Va con --ejecutar porque aca no hay nadie mirando: sin eso el script solo
REM  simula y no archivaria nunca.
REM ---------------------------------------------------------------------------

python C:\wms_scraping\horario_robot.py archivado || exit /b 0
python C:\wms_scraping\archivar_tareas.py --ejecutar

REM  Y las otras dos areas que crecen sin techo: el historial de performance y
REM  la bitacora de RF. Van juntas porque es el mismo momento tranquilo de la
REM  noche y las tres reescriben el area entera.
python C:\wms_scraping\archivar_historicos.py --ejecutar
