# Los scripts del robot

Acá viven las piezas del robot que la web necesita mantener al día. El robot completo está
en `C:\wms_scraping` del servidor y **no tiene control de versiones propio**: esta carpeta
existe para que al menos lo que se toca desde acá quede versionado y, sobre todo, para que
el servidor pueda **bajarlo por internet** sin depender de que OneDrive sincronice.

El 15-ago-2026 esa dependencia fue justamente el problema: el archivo nuevo estaba en
OneDrive de la laptop y en el servidor no aparecía, así que la corrida seguía fallando con
la versión vieja.

## Cómo se actualiza el servidor

> **Ojo con la rama.** `dames1830.github.io` publica desde **`main`**. Un archivo que
> todavía está en `beta` **no está ahí**: el `curl` baja la página de error 404 —unos 9 KB de
> HTML— y la deja con el nombre del script, así que parece que funcionó. Pasó el 18-ago-2026
> con `generar_respaldo.py` y `respaldo.bat`, y de paso `horario_robot.py` volvió a la versión
> vieja de `main`.
>
> Mientras algo esté en beta, hay que bajarlo apuntando a la rama:
>
> ```powershell
> curl.exe -L -o <archivo> https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/<archivo>
> ```
>
> Y comprobar siempre el tamaño: si bajó ~9.379 bytes, eso es el 404, no el script.


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
| `archivar_tareas.py` | Manda al histórico las tareas de almacenaje que pasaron de 30 días. Ver abajo. |
| `archivar.bat` | Lo que dispara el Programador de Windows para el archivado. |
| `sku_sin_salida.py` | El cuadro de **SKUs sin salida**: lo que llegó y no se movió en dos semanas. Publica el área `sku_sin_salida`. Corre a las 07:30, DESPUÉS de los reportes diarios de las 06:45 —necesita el Detalle de Orden— y del ancla de stock de las 07:00. |
| `sin_salida.bat` | Lo que dispara el Programador de Windows para SKUs sin salida. |
| `picking_y_orden.py` | Las descargas del WMS: el **Avance de Picking** y el **Detalle de Orden** del día que cerró, más —desde el 19-ago-2026— **los pendientes de los últimos 90 días**. Tarea "Picking y Detalle Orden de ayer", 06:45. |

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

Las tareas son `ancla_noche`, `ancla_manana`, `stock_hora`, `picking_hora`, `reportes`,
`respaldo` y `archivado`.

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

---

## El archivado de tareas viejas (19-ago-2026)

Corre a las **03:00 todos los días**, y la hora se cambia desde la web como las demás.

**Por qué existe.** En cada arranque la web bajaba las 1.337 tareas de almacenaje, y 795
eran de mayo, junio y julio: meses cerrados que nadie consulta desde ahí. Eran 1.342 KB de
los 2.255 que la página espera antes de mostrarse. El área `almacenaje_tasks_history`
existe justo para eso, pero el archivado se dejó de hacer en julio.

**Por qué a las 03:00 y no antes.** El script reescribe el área entera de tareas: si
alguien guarda una en el medio, esa tarea se pierde. Se midió que a la 01:00 el turno noche
todavía guarda cada pocos minutos. A las 03:00 no hay movimiento.

**El corte va por antigüedad, no por una fecha fija.** Se conservan los últimos 30 días y
lo anterior se archiva. Así corriendo todas las noches las tareas activas se mantienen
solas, en vez de volver a crecer hasta que alguien se acuerde — que es exactamente lo que
pasó en julio.

**Nunca archiva una tarea abierta**, aunque sea vieja: solo las que están `Finalizado` o
`Vencida`. Una abierta puede estar trabajándose todavía.

### El orden, que es lo que lo hace seguro

1. Copia al histórico.
2. **Comprueba** leyendo el área de vuelta. Si falta alguna, corta y no borra nada.
3. Recién entonces las saca de las activas.

Al revés —borrar y después copiar— un corte de red en el medio las perdería.

### Cómo probarlo sin que toque nada

```powershell
python C:\wms_scraping\archivar_tareas.py
python C:\wms_scraping\archivar_tareas.py --dias 60
```

Sin `--ejecutar` solo dice qué haría. El `.bat` sí lo lleva, porque en el servidor no hay
nadie mirando.

### Lo que hay que hacer en el servidor, UNA sola vez

```powershell
cd C:\wms_scraping
curl.exe -L -o archivar_tareas.py https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/archivar_tareas.py
curl.exe -L -o archivar.bat https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/archivar.bat
curl.exe -L -o horario_robot.py https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/horario_robot.py

schtasks /Create /TN "Robot Archivado" /TR "C:\wms_scraping\archivar.bat" /SC MINUTE /MO 10 /ST 00:00 /RU SYSTEM /F
```

---

## `avisar_log.py` — le cuenta a la web cómo le fue a la corrida

Daniel, 28-ago-2026: *"¿cómo me doy cuenta de que no está corriendo?"*. El Stock Reserva de
las 07:00 llevaba seis días sin bajar y nadie se enteró, porque el robot lo dejaba escrito en
un `run_*.log` del servidor que nadie abre.

Este lee el `run_*.log` más nuevo, traduce el resumen a anotaciones y las manda al módulo
**Configuración → LOG** de la web.

**Va aparte del robot grande a propósito.** Cuando una descarga falla, `wms_automation_final.py`
se rinde y `generar_slotting.py` **nunca corre** — o sea que un aviso metido ahí adentro se
quedaría callado justo el día que hace falta. Este corre después, pase lo que pase.

```powershell
python C:\wms_scraping\avisar_log.py --solo-ver
python C:\wms_scraping\avisar_log.py
```

Con `--solo-ver` muestra lo que mandaría sin mandarlo. Si el envío falla no devuelve error:
avisar no puede tumbar una corrida.

### Instalarlo

```powershell
cd C:\wms_scraping
curl.exe -L -o avisar_log.py https://raw.githubusercontent.com/dames1830/plataforma-logistica/beta/robot/avisar_log.py
```

Y agregarlo al final del `.bat` que llama al robot, después de la línea del
`wms_automation_final.py`:

```
python C:\wms_scraping\avisar_log.py
```
