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

REM ============================================================
REM  EL CIERRE DE TURNO NO TERMINA CON EL STOCK
REM
REM  Daniel, 04-sep-2026: *"cuando baje reserva en los cierres de turno, tambien
REM  actualices todos los reportes"*. Los cinco archivos del cierre son Stock
REM  Activo, Stock Reserva, Picking, OBLPN Embalaje y Detalle Orden del dia; los
REM  dos primeros los acaba de bajar wms_automation_final.py y con ellos ya se
REM  publico el Slotting.
REM
REM  EL ORDEN IMPORTA Y NO ES CASUAL. El stock y el Slotting van PRIMERO porque a
REM  las 07:10 Daniel ya esta procesando tareas de almacenaje y necesita el
REM  analisis de reserva publicado. Lo demas puede llegar veinte minutos despues.
REM
REM  CADA PASO ES INDEPENDIENTE: si el stock fallo, el picking se baja igual. Por
REM  eso no se corta con %ERRORLEVEL% y el codigo de salida sigue siendo el del
REM  stock, que es lo que mira el Programador de tareas.
REM
REM  --sin-recepcion: el ASN baja UNA vez al dia, a las 02:30, seis meses enteros.
REM  Volver a bajarlo aca serian 63 minutos por algo que casi no cambio.
REM ============================================================
python -u corte_turno.py --sin-recepcion

REM Detalle Orden DEL DIA. `--solo-dia` deja fuera Pendientes (21 MB) y
REM Despachados (52 MB), que son acumulados y van en la corrida de las 04:30.
python -u picking_y_orden.py --solo-dia

REM Le cuenta a la web como le fue la corrida. No cambia el codigo de salida.
python -u avisar_log.py

exit /b %CODIGO%

