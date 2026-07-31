@echo off
title PRUEBAS - Logistica Deam1830
cd /d "%~dp0"

echo.
echo   ==========================================
echo    ENTORNO DE PRUEBAS (beta)
echo   ==========================================
echo.
echo   Levantando el sitio en tu computadora...
echo.

start "Servidor de pruebas - NO CERRAR" /min python -m http.server 5599 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:5599/index.html

echo   Listo. Deberias ver la web con un MARCO NARANJA
echo   y el cartel "MODO PRUEBAS" arriba.
echo.
echo   El servidor quedo corriendo en una ventana minimizada
echo   llamada "Servidor de pruebas - NO CERRAR".
echo   Cierra esa ventana cuando termines de probar.
echo.
pause
