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
| `horario_robot.py` | **Quién decide a qué hora corre cada tarea.** Lee el horario que Daniel pone en la web. Ver abajo. |
| `generar_respaldo.py` | La copia de seguridad de los datos. Baja las 63 áreas de producción y las deja en un zip fechado. Ver abajo. |
| `respaldo.bat` | Lo que dispara el Programador de Windows para el respaldo. |

## El horario lo manda la web (18-ago-2026)

Daniel: *"yo cambio en la web y el robot se tiene que adaptar a lo que yo digo"*. Antes la
hora vivía en el Programador de tareas de Windows y cambiarla era entrar al servidor con un
`.bat` — el ancla pasó de 06:00 a 07:00 el 13-ago y hubo que hacerlo así.

Ahora se da vuelta el reloj:

```
Programador de Windows          horario_robot.py              el robot
"despierta cada 10 min"   →   "¿me toca ahora?"   →   corre o no corre
```

Se edita en **Configuración → Parámetros**, y se guarda en el área `config`, clave `robots`.

### Cómo se engancha, sin tocar los scripts que ya andan

El código de salida hace todo: **0 = te toca, 1 = no**. Así que en el `.bat` de cada tarea
basta anteponer una línea:

```bat
python C:\wms_scraping\horario_robot.py ancla_noche || exit /b 0
python C:\wms_scraping\wms_automation_final.py
```

Las tareas son `ancla_noche`, `ancla_manana`, `stock_hora`, `picking_hora`, `reportes` y
`respaldo`.

### Lo que hay que cambiar en el servidor, UNA sola vez

Las tareas de Windows pasan de correr a hora fija a despertar cada 10 minutos. En PowerShell
**como administrador**, una por una:

```powershell
schtasks /Change /TN "Robot Oracle WMS" /RI 10 /DU 24:00 /ST 00:00 /SD 01/01/2026
```

`/RI 10` es cada 10 minutos y `/DU 24:00` que lo haga todo el día. Los días de la semana ya
no importan acá — los decide la web —, así que conviene dejarlos todos:

```powershell
schtasks /Change /TN "Robot Oracle WMS" /D MON,TUE,WED,THU,FRI,SAT,SUN
```

**Ojo con `Robot Oracle WMS`: tiene DOS disparadores** (07:00 y 19:00) y `schtasks /Change`
con varios no es confiable — pasó el 13-ago. Conviene dejar uno solo repitiendo cada 10
minutos, porque ahora las dos horas las distingue `horario_robot.py` (`ancla_manana` y
`ancla_noche`), no el disparador.

### Para probar sin gastar la corrida

```powershell
python C:\wms_scraping\horario_robot.py ancla_noche --probar
```

`--probar` dice qué decidiría y **no deja la marca**, así que no consume la franja.

### Dos archivos que aparecen solos, al lado del script

| Archivo | Para qué |
|---|---|
| `horario_cache.json` | la última configuración leída de la web. **Si la web no contesta, el robot trabaja con esta** — un problema de internet no puede dejar al almacén sin foto de stock |
| `horario_corridas.json` | la marca de qué franja ya corrió, para no repetir. Se limpia solo a los 3 días |

Si tampoco hay caché, mandan los valores de fábrica del propio script, que son los horarios
que el servidor tenía el 18-ago-2026.

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

---

## El respaldo de los datos (18-ago-2026)

Corre a las 23:00, de lunes a sábado, y la hora se cambia desde la web como las demás.

**Por qué existe.** Antes el respaldo se hacía a mano, creando carpetas `Punto_Restauracion_*`.
Al revisarlas el 18-ago aparecieron dos problemas: el ritmo se había apagado solo —50 puntos en
junio, 14 en julio, 2 en agosto— y, peor, guardaban la base **local**, con 24 áreas y datos
hasta el 26-may, cuando producción tenía 63 áreas al día. El código sí quedaba bien guardado;
los datos no.

**Qué guarda.** Las 63 áreas de producción, una por archivo `.json`, bajadas por la misma API
que usa la web. Quedan en `C:\wms_scraping\respaldos\Respaldo_AAAAMMDD_HHMM.zip`.

Pesan poco: 158 MB de datos comprimen a **9,5 MB**, así que 30 días ocupan unos 285 MB. La
rotación borra sola lo que pasa de 30 días, leyendo la fecha **del nombre** y no la del archivo
—copiar la carpeta a otro disco cambia las fechas y borraría lo que no toca.

**El código no se respalda acá, a propósito**: ya vive en GitHub, con historial. Lo que no está
en ningún otro lado son los datos.

### Cómo probarlo sin esperar a las 23:00

```powershell
python C:\wms_scraping\generar_respaldo.py --probar
python C:\wms_scraping\generar_respaldo.py --salida C:\temp\prueba
```

### Lo que hay que hacer en el servidor, UNA sola vez

Bajar los dos archivos nuevos y crear la tarea de Windows:

```powershell
cd C:\wms_scraping
curl.exe -L -o generar_respaldo.py https://dames1830.github.io/plataforma-logistica/robot/generar_respaldo.py
curl.exe -L -o respaldo.bat https://dames1830.github.io/plataforma-logistica/robot/respaldo.bat
curl.exe -L -o horario_robot.py https://dames1830.github.io/plataforma-logistica/robot/horario_robot.py

schtasks /Create /TN "Robot Respaldo" /TR "C:\wms_scraping\respaldo.bat" /SC MINUTE /MO 10 /ST 00:00 /RU SYSTEM /F
```

Igual que las demás: despierta cada 10 minutos y `horario_robot.py` decide si le toca.

### Si algo sale mal

El script devuelve **2** cuando el respaldo se hizo pero alguna área quedó fuera, y **1** si no
se pudo hacer nada. No es lo mismo un respaldo incompleto que ninguno, y el LEEME de adentro
del zip lista qué áreas faltaron.

Mientras escribe usa un `.parcial` y recién al terminar lo renombra: un zip a medio escribir
no debe parecer un respaldo bueno si el robot se corta en el medio.
