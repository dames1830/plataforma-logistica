@echo off
REM  Generado por instalar_horarios.ps1 - no editar a mano.
REM  Uso:  correr_si_toca.bat <tareas-de-la-web> "<comando completo>"
REM  Devuelve 0 y no hace nada si a esa tarea no le toca ahora.
python C:\wms_scraping\horario_robot.py %~1
if errorlevel 1 (
  echo [HORARIO] no le toca; no se corre nada.
  exit /b 0
)
echo [HORARIO] le toca; arrancando...
call %~2
set RC=%ERRORLEVEL%

REM  EL AVISO AL CELULAR. Va aca y no dentro de cada robot: por este lanzador pasan TODOS
REM  los que tienen horario, asi que con una linea quedan cubiertos todos y los que vengan.
REM  Nunca frena ni cambia el resultado: si el aviso falla, el robot igual devuelve lo suyo.
python C:\wms_scraping\avisar_push.py --robot %~1 --resultado %RC% >> C:\wms_scraping\logs\avisar_push.txt 2>&1

exit /b %RC%