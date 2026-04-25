# Despliegue de BETA a PRODUCCIÓN
Copy-Item -Path .\beta\* -Destination .\ -Recurse -Force
git add .
git commit -m "PRODUCTION v12.0.0: Stable release with all buffer and attendance fixes"
git push origin main
