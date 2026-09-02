@echo off
REM ============================================================
REM  Crea la tarea programada "Picking y Detalle Orden de ayer"
REM
REM  CLIC DERECHO -> EJECUTAR COMO ADMINISTRADOR.
REM  Una ventana normal no puede crear la tarea y falla con
REM  "Acceso denegado" sin explicar por que.
REM
REM  Se corre UNA SOLA VEZ. Despues la tarea queda sola.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO (ver ejecutar_picking_y_orden.bat).
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

echo.
echo ============================================================
echo   TAREA PROGRAMADA: Picking y Detalle Orden de ayer (08:00)
echo ============================================================
echo.

REM ---- Comprobar que estamos donde hay que estar ----
echo Esta maquina es: %COMPUTERNAME%
echo.
if /I not "%COMPUTERNAME%"=="VMI3488466" (
    echo ATENCION: esta NO parece ser el servidor.
    echo El servidor se llama VMI3488466. La laptop se llama DEAM-LAPTOP.
    echo.
    echo Ya se perdio una tarde por correr un instalador en la maquina
    echo equivocada. Si estas seguro, segui. Si no, cerra esta ventana.
    echo.
    pause
)

if not exist "%~dp0ejecutar_picking_y_orden.bat" (
    echo ERROR: no se encontro ejecutar_picking_y_orden.bat en esta carpeta.
    echo Carpeta actual: %~dp0
    pause
    exit /b 1
)

if not exist "%~dp0picking_y_orden.py" (
    echo ERROR: no se encontro picking_y_orden.py en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0bloqueo_wms.py" (
    echo ERROR: no se encontro bloqueo_wms.py en esta carpeta.
    echo Ese archivo es el que evita que dos robots entren a Oracle
    echo al mismo tiempo. Sin el, no conviene programar la tarea.
    pause
    exit /b 1
)

if not exist "%~dp0wms_automation_final.py" (
    echo ERROR: no se encontro wms_automation_final.py en esta carpeta.
    echo De ahi salen el login y la busqueda de la carpeta de OneDrive.
    pause
    exit /b 1
)

echo Creando la tarea...
echo.

REM /SC DAILY /ST 08:00  ->  todos los dias a las 08:00
REM
REM POR QUE A LAS 08:00 Y NO A LAS 07:00: a las 07:00 se toma la
REM foto ancla del turno (tarea "Robot Oracle WMS"), que tarda unos
REM 25 minutos. Oracle no admite dos sesiones del mismo usuario, y
REM el ancla es la corrida mas importante del dia: sobre ella se
REM calculan el Replenishment, la Zona Buffer y las tareas.
REM
REM Estos reportes bajan AYER, que ya cerro a medianoche, asi que
REM la hora exacta no cambia nada de lo que traen.
REM
REM /IT  ->  solo con la sesion abierta, igual que "Stock por hora".
REM          El servidor tiene inicio de sesion automatico, asi que
REM          la sesion esta siempre abierta.
schtasks /Create /F /TN "Picking y Detalle Orden de ayer" /TR "%~dp0ejecutar_picking_y_orden.bat" /SC DAILY /ST 08:00 /IT

if errorlevel 1 (
    echo.
    echo NO SE PUDO CREAR LA TAREA.
    echo Lo mas probable: esta ventana no se abrio como administrador.
    echo Cerrala, hace clic derecho en este archivo y elegi
    echo "Ejecutar como administrador".
    pause
    exit /b 1
)

echo.
echo Ajustando el limite de tiempo y el arranque tardio...
powershell -NoProfile -Command "try { $t = Get-ScheduledTask -TaskName 'Picking y Detalle Orden de ayer' -ErrorAction Stop; $t.Settings.ExecutionTimeLimit = 'PT45M'; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask -TaskName 'Picking y Detalle Orden de ayer' -Settings $t.Settings | Out-Null; Write-Host '   Listo: si el servidor estaba reiniciando a las 08:00, la corrida se hace igual apenas vuelve.' } catch { Write-Host '   No se pudo aplicar el ajuste (no es grave, la tarea igual quedo creada).' }"

echo.
echo ============================================================
echo   TAREA CREADA
echo ============================================================
echo.
echo   Corre todos los dias a las 08:00 y baja AYER completo.
echo   Tarda unos 5 minutos.
echo.
echo   Espera hasta 15 minutos si hay otro robot adentro de
echo   Oracle, y despues entra igual. NO se saltea el dia:
echo   este robot corre una sola vez, si se saltea se pierde.
echo.
echo   Deja los archivos en OneDrive:
echo      scraping Stock\Picking\Picking D-M.csv
echo      scraping Stock\Detalle Orden\Detalle Orden DD-MM.csv
echo.
echo   El log de cada corrida queda en la carpeta logs, con el
echo   nombre picking_orden_AAAA-MM-DD_HHMMSS.log. Se borran solos
echo   a los 7 dias.
echo.
echo ============================================================
echo.
echo Para probarla AHORA mismo sin esperar a manana:
echo    schtasks /Run /TN "Picking y Detalle Orden de ayer"
echo.
pause
