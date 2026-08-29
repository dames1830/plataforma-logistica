@echo off
REM ============================================================
REM  GRABADOR DEL CAMINO EN EL WMS  -  EMBALAJE (OBLPN)
REM
REM  El mismo que se uso para los stocks, el Avance de Picking y
REM  el Detalle de Orden. Abre Chrome, vos haces los pasos UNA
REM  vez, y el escribe solo el codigo con el nombre exacto de
REM  cada boton y cada campo.
REM
REM  QUE ES OBLPN: "Outbound License Plate Number", que es como
REM  Oracle le llama a cada bulto que sale. Es el eslabon que
REM  falta entre el picking y el despacho: los chicos pican, pero
REM  tambien embalan, y hoy esa parte no la mide nadie.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

setlocal
cd /d "%~dp0"
color 0B
set PY=C:\Python314\python.exe
set SALIDA=%~dp0grabacion_embalaje.py

echo.
echo ============================================================
echo    GRABAR EL CAMINO DEL EMBALAJE  (OBLPN)
echo ============================================================
echo.
echo  Se va a abrir Chrome en el WMS y una ventanita al lado que
echo  escribe el codigo mientras vos haces clic.
echo.
echo  QUE TENES QUE HACER, UNA SOLA VEZ:
echo.
echo    1. Iniciar sesion.
echo    2. Llegar hasta la pantalla de embalaje, como siempre:
echo       buscador o carpetas, lo que uses. Es la que empieza
echo       con OBLPN.
echo    3. Poner los filtros que usas normalmente: la fecha de
echo       UN DIA, y el estado si es que filtras por estado.
echo    4. Ejecutarlo y esperar a que termine.
echo    5. Exportarlo a CSV como lo exportas siempre.
echo    6. Cerrar Chrome.
echo.
echo  Eso es todo. No hace falta que salga perfecto: si te
echo  equivocas y volves atras, no importa, se limpia despues.
echo.
echo  LO QUE MAS ME SIRVE que hagas despacio:
echo    - el nombre EXACTO de la pantalla, tal cual sale arriba
echo    - las etiquetas de los filtros de fecha
echo    - si hay filtro de estado, abrir la lista para que se
echo      grabe que opciones ofrece
echo.
echo  OJO: el archivo va a quedar con tu usuario y tu clave
echo  adentro, porque graba TODO lo que escribis. No lo mandes
echo  por correo ni lo subas a ningun lado. Yo lo leo de aca y
echo  saco solo el camino.
echo.
echo  El resultado queda en:
echo     %SALIDA%
echo.
pause

if not exist "%PY%" (
    echo.
    echo  ERROR: no esta el Python en
    echo     %PY%
    echo  Avisame y lo resolvemos.
    echo.
    pause
    exit /b 1
)

echo.
echo  Abriendo Chrome... (puede tardar unos segundos)
echo.
"%PY%" -m playwright codegen --target python -o "%SALIDA%" https://a10.wms.ocs.oraclecloud.com/bata/index/

echo.
if exist "%SALIDA%" (
    echo  LISTO. Quedo grabado en:
    echo     %SALIDA%
    echo.
    echo  Avisame y lo leo de ahi.
) else (
    echo  No se genero el archivo. Puede ser que hayas cerrado la
    echo  ventanita del grabador antes que Chrome. Se puede repetir
    echo  las veces que haga falta.
)
echo.
pause
