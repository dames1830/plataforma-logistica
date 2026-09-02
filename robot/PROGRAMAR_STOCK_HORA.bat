@echo off
REM ============================================================
REM  Crea la tarea programada "Stock por hora"
REM
REM  CLIC DERECHO -> EJECUTAR COMO ADMINISTRADOR.
REM  Una ventana normal no puede crear la tarea y falla con
REM  "Acceso denegado" sin explicar por que.
REM
REM  Se corre UNA SOLA VEZ. Despues la tarea queda sola.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO (ver ejecutar_stock_hora.bat).
REM ============================================================

cd /d "%~dp0"
chcp 65001 >nul

echo.
echo ============================================================
echo   TAREA PROGRAMADA: Stock por hora
echo ============================================================
echo.

if not exist "%~dp0ejecutar_stock_hora.bat" (
    echo ERROR: no se encontro ejecutar_stock_hora.bat en esta carpeta.
    echo Carpeta actual: %~dp0
    pause
    exit /b 1
)

if not exist "%~dp0stock_por_hora.py" (
    echo ERROR: no se encontro stock_por_hora.py en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0bloqueo_wms.py" (
    echo ERROR: no se encontro bloqueo_wms.py en esta carpeta.
    echo Ese archivo es el que evita que los dos robots entren a Oracle
    echo al mismo tiempo. Sin el, no conviene programar la tarea.
    pause
    exit /b 1
)

echo Creando la tarea...
echo.

REM /SC HOURLY /MO 1 /ST 00:30  ->  00:30, 01:30, 02:30 ... las 24 horas
REM /IT  ->  solo con la sesion abierta, igual que "Robot Oracle WMS".
REM          El servidor tiene inicio de sesion automatico, asi que la
REM          sesion esta siempre abierta.
REM
REM La ruta va sin comillas internas porque ninguna de las dos carpetas
REM donde vive el robot tiene espacios (C:\wms_scraping en el servidor).
schtasks /Create /F /TN "Stock por hora" /TR "%~dp0ejecutar_stock_hora.bat" /SC HOURLY /MO 1 /ST 00:30 /IT

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
echo Ajustando el limite de tiempo a 50 minutos...
powershell -NoProfile -Command "try { $t = Get-ScheduledTask -TaskName 'Stock por hora' -ErrorAction Stop; $t.Settings.ExecutionTimeLimit = 'PT50M'; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask -TaskName 'Stock por hora' -Settings $t.Settings | Out-Null; Write-Host '   Listo: una corrida trabada se corta antes de la hora siguiente.' } catch { Write-Host '   No se pudo aplicar el limite (no es grave, la tarea igual quedo creada).' }"

echo.
echo ============================================================
echo   TAREA CREADA
echo ============================================================
echo.
echo   Corre cada hora al minuto 30, todos los dias.
echo   Tarda unos 8 minutos y no usa Excel.
echo.
echo   Si el robot principal (06:00 / 19:00) esta corriendo, esta
echo   tarea se saltea esa hora sola y vuelve a la siguiente.
echo.
echo   El log de cada corrida queda en la carpeta logs, con el
echo   nombre hora_AAAA-MM-DD_HHMMSS.log. Se borran solos a los
echo   7 dias.
echo.
echo ============================================================
echo.
echo Para probarla AHORA mismo sin esperar, corre:
echo    schtasks /Run /TN "Stock por hora"
echo.
pause
