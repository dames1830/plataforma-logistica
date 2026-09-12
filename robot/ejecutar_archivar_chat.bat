@echo off
chcp 65001 >nul
"C:\Program Files\Python313\python.exe" -u C:\wms_scraping\archivar_chat.py --ejecutar %* > C:\wms_scraping\logs\archivar_chat.txt 2>&1
