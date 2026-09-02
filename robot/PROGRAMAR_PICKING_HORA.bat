@echo off
REM ============================================================
REM  Crea la tarea programada "Picking por hora"  (EL AVANCE)
REM
REM  CLIC DERECHO -> EJECUTAR COMO ADMINISTRADOR.
REM  Una ventana normal no puede crear la tarea y falla con
REM  "Acceso denegado" sin explicar por que.
REM
REM  Se corre UNA SOLA VEZ. Despues la tarea queda sola.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO.
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

echo.
echo ============================================================
echo   TAREA PROGRAMADA: Picking por hora (minuto 50)
echo ============================================================
echo.

echo Esta maquina es: %COMPUTERNAME%
echo.
if /I not "%COMPUTERNAME%"=="VMI3488466" (
    echo ATENCION: esta NO parece ser el servidor.
    echo El servidor se llama VMI3488466. La laptop se llama DEAM-LAPTOP.
    echo.
    echo Si estas seguro, segui. Si no, cerra esta ventana.
    echo.
    pause
)

if not exist "%~dp0ejecutar_picking_hora.bat" (
    echo ERROR: no se encontro ejecutar_picking_hora.bat en esta carpeta.
    echo Carpeta actual: %~dp0
    pause
    exit /b 1
)

if not exist "%~dp0picking_por_hora.py" (
    echo ERROR: no se encontro picking_por_hora.py en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0picking_y_orden.py" (
    echo ERROR: no se encontro picking_y_orden.py en esta carpeta.
    echo De ahi sale la navegacion del WMS. El picking de la hora usa
    echo EXACTAMENTE la misma, para que no haya dos copias del camino.
    pause
    exit /b 1
)

if not exist "%~dp0generar_slotting.py" (
    echo ERROR: no se encontro generar_slotting.py en esta carpeta.
    echo De ahi sale subir_datos, que es la puerta por la que el robot
    echo publica en la plataforma.
    pause
    exit /b 1
)

if not exist "%~dp0bloqueo_wms.py" (
    echo ERROR: no se encontro bloqueo_wms.py en esta carpeta.
    echo Sin el, dos robots pueden entrar a Oracle al mismo tiempo.
    pause
    exit /b 1
)

echo Creando la tarea...
echo.

REM /SC HOURLY /MO 1 /ST 00:50  ->  00:50, 01:50, 02:50 ... las 24 horas
REM /IT  ->  solo con la sesion abierta, igual que las otras dos tareas.
schtasks /Create /F /TN "Picking por hora" /TR "%~dp0ejecutar_picking_hora.bat" /SC HOURLY /MO 1 /ST 00:50 /IT

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
echo Ajustando el limite de tiempo a 40 minutos...
powershell -NoProfile -Command "try { $t = Get-ScheduledTask -TaskName 'Picking por hora' -ErrorAction Stop; $t.Settings.ExecutionTimeLimit = 'PT40M'; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask -TaskName 'Picking por hora' -Settings $t.Settings | Out-Null; Write-Host '   Listo: una corrida trabada se corta antes de la hora siguiente.' } catch { Write-Host '   No se pudo aplicar el limite (no es grave, la tarea igual quedo creada).' }"

echo.
echo ============================================================
echo   TAREA CREADA
echo ============================================================
echo.
echo   Corre cada hora al minuto 50, todos los dias.
echo   Tarda entre 1 y 5 minutos segun la hora del dia.
echo.
echo   Si hay otro robot adentro de Oracle, SE SALTEA esa hora
echo   y vuelve a la siguiente. No se pierde nada.
echo.
echo   No deja archivos: el CSV se borra al terminar.
echo.
echo   El log de cada corrida queda en la carpeta logs, con el
echo   nombre pickinghora_AAAA-MM-DD_HHMMSS.log. Se borran
echo   solos a los 7 dias.
echo.
echo ============================================================
echo.
echo Para probarla AHORA mismo sin esperar:
echo    schtasks /Run /TN "Picking por hora"
echo.
pause
