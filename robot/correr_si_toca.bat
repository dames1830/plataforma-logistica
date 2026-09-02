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
exit /b %errorlevel%