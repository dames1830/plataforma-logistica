@echo off
REM ============================================================
REM  INSTALA LA TAREA DEL CORTE DEL TURNO DIA  -  Bata
REM
REM  Se corre UNA sola vez, en el servidor, como administrador.
REM  Despues la hora se cambia desde la web, no desde aca.
REM
REM  QUE QUEDA INSTALADO
REM    Una tarea que Windows despierta cada 10 minutos y que
REM    pregunta al horario de la web si le toca. A las 20:00 le
REM    toca y corre; el resto del dia sale enseguida sin hacer
REM    nada. Es el mismo mecanismo de los otros nueve robots.
REM
REM  QUE HACE CUANDO LE TOCA
REM    1. picking final del dia
REM    2. embalaje final del dia
REM    3. recepcion del dia (el ASN del mes en curso)
REM
REM  OJO: ESTA TAREA REEMPLAZA DOS PASES QUE YA EXISTEN. El
REM  avance de picking de las 20:00 y el de embalaje de las 20:20
REM  quedan apagados en horario_robot.py con `saltar`. Si se
REM  instala esta tarea SIN actualizar horario_robot.py, esos dos
REM  pases corren igual y se pelean con el corte por el WMS.
REM
REM  CORRE CON LA SESION ABIERTA, igual que los otros robots que
REM  entran a Oracle: como SYSTEM no encuentran el navegador. Por
REM  eso una sesion de RDP cerrada las deja en 0x800710E0.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

echo.
echo ============================================================
echo   CORTE DEL TURNO DIA
echo ============================================================
echo.

if not exist "%~dp0corte_turno.py" (
    echo ERROR: no se encontro corte_turno.py en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0ejecutar_corte_turno.bat" (
    echo ERROR: no se encontro ejecutar_corte_turno.bat en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0correr_si_toca.bat" (
    echo ERROR: no se encontro correr_si_toca.bat en esta carpeta.
    echo Ese es el envoltorio que le pregunta la hora a la web.
    pause
    exit /b 1
)

REM El horario tiene que conocer la tarea o el envoltorio sale con
REM codigo 2 y la tarea queda en rojo todos los dias. Es lo que le
REM paso al ASN, que se quedo dos dias sin bajar.
REM
REM VA CON --probar. Sin esa bandera, preguntar "le toca?" TAMBIEN
REM ANOTA la corrida como hecha: instalar esto entre las 20:00 y
REM las 20:09 se comeria el corte de esa noche y nadie se
REM enteraria hasta el dia siguiente.
"C:\Program Files\Python313\python.exe" "%~dp0horario_robot.py" corte_turno --probar >nul 2>&1
if errorlevel 2 (
    echo ERROR: horario_robot.py todavia no conoce 'corte_turno'.
    echo Baja la version nueva antes de instalar esta tarea:
    echo    curl.exe -L -o horario_robot.py https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/horario_robot.py
    pause
    exit /b 1
)

echo Creando la tarea...
echo.

REM LA TAREA LA REGISTRA UN .ps1, no este archivo.
REM
REM El comando lleva un argumento que a su vez es una ruta entre comillas, y las
REM comillas anidadas se rompen distinto en cmd, en un .bat y en la consola. En
REM un .ps1 no hay nada que escapar y ademas se puede probar con -Simular antes
REM de tocar el Programador de tareas.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programar_corte_turno.ps1"

if errorlevel 1 (
    echo.
    echo NO SE PUDO CREAR LA TAREA.
    echo Lo mas probable: esta ventana no se abrio como administrador.
    echo Cierrala, haz clic derecho en este archivo y elige
    echo "Ejecutar como administrador".
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   TAREA CREADA
echo ============================================================
echo.
echo   Corre a las 20:00, de lunes a sabado.
echo   Tarda unos 50 minutos: termina cerca de las 20:50.
echo.
echo   La hora y los dias se cambian desde la web, en
echo   Configuracion, Parametros, Robots del servidor.
echo.
echo   El log queda en la carpeta logs.
echo.
echo ============================================================
echo.
echo Para probarla AHORA mismo sin esperar a las 20:00:
echo    "%~dp0ejecutar_corte_turno.bat"
echo.
pause
