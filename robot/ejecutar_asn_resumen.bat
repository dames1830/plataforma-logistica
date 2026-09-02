@echo off
cd /d C:\wms_scraping
chcp 65001 >nul
"C:\Program Files\Python313\python.exe" -u C:\wms_scraping\asn_resumen.py %* > C:\wms_scraping\logs\asnresumen.txt 2>&1
