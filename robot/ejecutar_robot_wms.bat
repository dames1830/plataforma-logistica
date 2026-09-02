@echo off
REM ============================================================
REM  Robot Oracle WMS - Bata
REM  Lo ejecuta la tarea programada "Robot Oracle WMS", 19:00 lun-sab
REM ============================================================

REM La carpeta es la de ESTE archivo (%~dp0), no una escrita a mano. En la laptop el
REM robot vive en C:\Users\dames\.gemini\... y en el servidor en C:\wms_scraping, asi
REM que una ruta fija obliga a editar el archivo cada vez que se copia de una maquina
REM a la otra, y si alguien se olvida el robot arranca en la carpeta equivocada.
cd /d "%~dp0"

REM Codigo de pagina UTF-8 para que los acentos no salgan como simbolos raros
chcp 65001 >nul

REM -u = salida sin buffer, para que el log se escriba en vivo y no al final
python -u wms_automation_final.py

REM Codigos de salida, para que el Programador de tareas marque la corrida
REM como fallida en vez de darla por buena:
REM    0 = bajaron los dos archivos y se genero el reporte Slotting
REM    1 = error de configuracion o de login
REM    2 = falto descargar algun archivo
REM    3 = los archivos bajaron pero fallo el reporte Slotting
REM    4 = el stock que se iba a publicar NO era de esta corrida y se freno
REM        (agregado el 07-ago-2026: el 06-ago la descarga de las 19:00 no dejo
REM         archivo y se publico el de las 08:23 como si fuera nuevo)
set CODIGO=%ERRORLEVEL%

REM Le cuenta a la web como le fue la corrida. No cambia el codigo de salida.
python -u avisar_log.py

exit /b %CODIGO%

