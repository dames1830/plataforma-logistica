@echo off
REM ============================================================
REM  GRABADOR DEL CAMINO EN EL WMS  -  ASN (lo que va a llegar)
REM
REM  El mismo que se uso para los stocks, el Avance de Picking,
REM  el Detalle de Orden y el Embalaje. Abre Chrome, vos haces
REM  los pasos UNA vez, y el escribe solo el codigo con el
REM  nombre exacto de cada boton y cada campo.
REM
REM  QUE ES EL ASN: "Advanced Shipping Notice", la mercaderia
REM  anunciada que todavia no llego. Es lo que deja ver con
REM  anticipacion que va a poner recepcion en el buffer.
REM
REM  SIN ACENTOS NI ENES A PROPOSITO: cmd.exe se come la primera
REM  letra de la orden siguiente y los IF ejecutan las dos ramas
REM  a la vez.
REM ============================================================

setlocal
cd /d "%~dp0"
color 0B
set PY=C:\Python314\python.exe
set SALIDA=%~dp0grabacion_asn.py

echo.
echo ============================================================
echo    GRABAR EL CAMINO DEL ASN
echo ============================================================
echo.
echo  Se va a abrir Chrome en el WMS y una ventanita al lado que
echo  escribe el codigo mientras vos haces clic.
echo.
echo  QUE TENES QUE HACER, UNA SOLA VEZ:
echo.
echo    1. Iniciar sesion.
echo    2. Llegar hasta la pantalla del ASN, como siempre.
echo    3. Poner los filtros que usas normalmente.
echo    4. Ejecutarlo y esperar a que termine.
echo    5. Exportarlo a CSV como lo exportas siempre.
echo    6. Cerrar Chrome.
echo.
echo  LO QUE MAS ME SIRVE, y esto es LO IMPORTANTE de esta
echo  grabacion:
echo.
echo    * ABRIR DESPACIO LA LISTA DE CAMPOS DE FECHA, aunque no
echo      la uses. Necesito ver TODAS las fechas que ofrece la
echo      pantalla para filtrar: fecha de envio, fecha de
echo      creacion, fecha de modificacion, hora de verificacion.
echo      De cual se pueda filtrar depende como partimos el ano
echo      en bloques.
echo.
echo    * El nombre EXACTO de la pantalla, tal cual sale arriba.
echo    * Si hay filtro de estado, abrir la lista para que se
echo      grabe que opciones ofrece.
echo.
echo  No hace falta que salga perfecto: si te equivocas y volves
echo  atras, no importa, se limpia despues.
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
