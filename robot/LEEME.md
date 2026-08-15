# Los scripts del robot

Acá viven las piezas del robot que la web necesita mantener al día. El robot completo está
en `C:\wms_scraping` del servidor y **no tiene control de versiones propio**: esta carpeta
existe para que al menos lo que se toca desde acá quede versionado y, sobre todo, para que
el servidor pueda **bajarlo por internet** sin depender de que OneDrive sincronice.

El 15-ago-2026 esa dependencia fue justamente el problema: el archivo nuevo estaba en
OneDrive de la laptop y en el servidor no aparecía, así que la corrida seguía fallando con
la versión vieja.

## Cómo se actualiza el servidor

En una ventana de PowerShell **en el servidor**, una sola línea por archivo:

```powershell
cd C:\wms_scraping
curl.exe -L -o generar_rotacion.py https://dames1830.github.io/plataforma-logistica/robot/generar_rotacion.py
```

Y para comprobar que llegó el bueno:

```powershell
findstr /C:"def primero_de_mes" C:\wms_scraping\generar_rotacion.py
```

Si imprime la línea, está el nuevo. Si no imprime nada, es el viejo.

## Qué hay acá

| Archivo | Qué es |
|---|---|
| `generar_rotacion.py` | Rotación y Permanencia — el FSN del almacén más el aging. Publica el área `rotacion_permanencia`. |
| `generar_slotting.py` | El armador del Slotting de las 19:00. Acá está porque llama a los reportes de estudio al final de la corrida. |

## La cadena de las 19:00

```
ejecutar_robot_wms.bat            tarea "Robot Oracle WMS", 19:00 lun-sáb
  → wms_automation_final.py       baja los dos stocks del WMS
    → generar_slotting.py         arma el Slotting y publica los stocks
      → generar_evolucion.py      la evolución del artículo
      → generar_rotacion.py       rotación y permanencia
```

Los dos reportes del final van ahí a propósito: necesitan la foto de stock de hoy recién
dejada en OneDrive. Y **ninguno cambia el código de salida** de la corrida — son estudios,
no algo que el turno necesite. Si fallan, la pantalla se queda con el estudio del día
anterior y su fecha a la vista.

## Ojo

`generar_rotacion.py` le pide prestados a `generar_evolucion.py` solo los LECTORES de fotos
y del Maestro. Todo lo demás lo resuelve solo, a propósito: el servidor puede tener una
versión más vieja de ese archivo, y depender de sus funciones chicas hace que el estudio se
caiga por un cambio que no es suyo. Si algún día faltara un lector, avisa con nombre en vez
de reventar con un `AttributeError`.
