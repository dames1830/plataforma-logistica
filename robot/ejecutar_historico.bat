@echo off
set PY="C:\Program Files\Python313\python.exe"
%PY% -u C:\wms_scraping\rellenar_historico.py --publicar > C:\wms_scraping\logs\subida.txt 2>&1
echo FIN-DE-LA-SUBIDA >> C:\wms_scraping\logs\subida.txt