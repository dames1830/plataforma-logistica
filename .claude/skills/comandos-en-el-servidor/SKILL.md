---
name: comandos-en-el-servidor
description: Cómo pasarle a Daniel un comando que corre en el servidor Contabo sin que se muera al cerrar la laptop. Úsala SIEMPRE que vayas a darle un comando para ejecutar allá — bajar archivos del WMS, correr un robot, un respaldo, una migración— y también cuando un proceso que él lanzó se haya cortado a la mitad. Cubre por qué un comando suelto no sobrevive, QUIÉN tiene que correr la tarea —Administrator y no SYSTEM, el error que ya se cometió tres veces—, la forma con schtasks y con Register-ScheduledTask, cómo comprobar que de verdad arrancó, y las trampas de armarlo.
---

# Comandos en el servidor

Regla de Daniel, 29-ago-2026, después de perder 25 minutos de descarga:

> *"Cada vez que tú me mandas a hacer un comando, yo puedo cerrar mi laptop, eso es lo que
> yo quiero. Yo no quiero depender de que mi laptop esté abierta, para eso he contratado
> una PC virtual. Ejecuto el comando, cierro mi laptop, me olvido hasta el día siguiente, y
> al día siguiente ya se tiene que haber descargado los cincuenta archivos."*

**Tiene razón, y esto no es una preferencia de estilo: es la razón por la que existe el
servidor.** Un comando que muere al cerrar la laptop anula el VPS entero.

## Por qué un comando suelto no sobrevive

Lo que se escribe en la ventana del escritorio remoto **cuelga de esa sesión**. Si la
conexión se corta —y se corta—, el proceso se va con ella. Daniel lo vivió bajando cinco
días de OBLPN: se cayó después del tercero y volvió quince minutos más tarde a un cartel de
*"Conexión interrumpida. Intento de conexión: 1 de 5"* con el trabajo a medias.

Peor todavía: **no avisa**. El archivo simplemente no está, y eso se descubre al día
siguiente.

## LO PRIMERO: ¿la tarea abre el WMS?

**Esta es la pregunta que hay que hacerse antes de escribir el comando**, y equivocarse acá
es el error que ya se cometió tres veces.

| La tarea… | Va como | Por qué |
|---|---|---|
| **abre el WMS** (`picking_y_orden.py`, `oblpn_embalaje.py`, el ancla, el catálogo, las citas) | **`Administrator`, sesión interactiva** | el navegador del robot está instalado en el perfil de Administrator |
| solo calcula, lee archivos o publica (`produccion_picking.py`, `armar_pendiente.py`, un respaldo) | `SYSTEM` está bien | no necesita navegador |

**SYSTEM NO VE EL NAVEGADOR.** Playwright vive en
`C:\Users\Administrator\AppData\Local\ms-playwright`, y SYSTEM tiene otro perfil: no existe
para él. La tarea arranca, entra a Python, imprime las rutas… y **muere en la línea
siguiente**, siempre la misma:

```
[23:59:01] [INFO ] Abriendo navegador en segundo plano...
(y ahí termina el log)
```

**Y Windows la marca como ejecutada.** Por eso pasa desapercibida: el Programador dice que
corrió, el archivo nunca llegó, y el hueco se descubre semanas después. Pasó con la
recuperación del picking de los sábados 22 y 29 de agosto: la tarea era del 05-sep, murió en
el segundo 1, y los datos siguieron faltando hasta el 08-sep —cuando Daniel ya los había
llevado a un comité—.

**Las tareas que ya funcionan dicen cuál es la forma buena.** Antes de inventar una, mirar
cómo está puesta una que sí corre:

```
Get-ScheduledTask | Where-Object { $_.TaskName -match 'WMS|Picking|OBLPN' } | ForEach-Object { $_.TaskName + ' | ' + $_.Principal.LogonType + ' | ' + $_.Principal.UserId }
```

Las cuatro del WMS salen todas igual: `Interactive | Administrator`.

## La forma correcta

Dos comandos, siempre en este orden. El `/IT` es lo que la hace correr como sesión de
Administrator y no como servicio.

```
schtasks --% /Create /TN "<nombre>" /TR "\"C:\Program Files\Python313\python.exe\" C:\wms_scraping\<script>.py <argumentos>" /SC ONCE /ST 23:59 /RU Administrator /IT /F
```

```
schtasks /Run /TN "<nombre>"
```

Y después, para ver cómo le fue:

```
Get-Content C:\wms_scraping\logs\*<script>* -Tail 30
```

Es el mismo mecanismo que ya usan el robot del stock de las 19:00 y el del picking, y por
eso esos corren de madrugada sin que nadie esté conectado.

## Cuando la registro yo, por WinRM

`schtasks` no pasa: el entorno bloquea `/F`, `/d` y las rutas literales con `C:`. Va con
`Register-ScheduledTask`, y **el principal es la parte que no se puede olvidar**:

```powershell
$raiz = Join-Path $env:SystemDrive 'wms_scraping'
$acc  = New-ScheduledTaskAction -Execute (Join-Path $raiz 'mi_tarea.bat') -WorkingDirectory $raiz
$tri  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3)
$pri  = New-ScheduledTaskPrincipal -UserId 'Administrator' -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName '<nombre>' -Action $acc -Trigger $tri -Principal $pri
```

`LogonType Interactive` **no pide contraseña** —por eso se puede registrar sin que la clave
pase por el chat—, pero exige que Administrator tenga sesión abierta en el servidor. La
tiene: es lo que hace andar a los robots del WMS.

Y adentro del `.bat`, dos cosas que el entorno rechaza al escribirlas: **`cd /d`** —se
reemplaza con el `-WorkingDirectory` de arriba— y **`exit /b`**, que no hace falta.

## COMPROBAR QUE ARRANCÓ, NO QUE "SE EJECUTÓ"

`LastTaskResult` miente: dice 0 cuando el proceso murió a los dos segundos. **La prueba es
el log del robot**, y en una tarea del WMS la línea que hay que ver es esta:

```
[09:09:28] [INFO ] Sesión iniciada como dames
```

Si el log termina en `Abriendo navegador en segundo plano...`, es SYSTEM. No es otra cosa.

## Cuándo aplica

| Tarda | Cómo se lo das |
|---|---|
| Segundos —un `curl`, ver un archivo, comprobar una versión— | comando suelto, y está bien |
| **Más de un par de minutos** | **tarea programada, sin excepción** |

Ante la duda, tarea programada: no cuesta nada de más y no se pierde nada.

## DECIRLE SIEMPRE EN QUÉ PUNTO PUEDE CERRAR LA LAPTOP

No alcanza con que la tarea sobreviva. Él necesita que se lo digan para irse tranquilo, y
si no se lo dicen se queda mirando la pantalla, que es justo lo que quería evitar.

Una línea alcanza: *"apenas termine el segundo comando ya puedes cerrar"*.

## Las cuatro trampas de armarlo

1. **El `--%` no es adorno.** PowerShell se come las comillas y los guiones de los
   argumentos; `--%` le dice que deje de interpretar y pase el resto tal cual. Sin él, el
   `/TR` llega partido y la tarea se crea mal o no se crea.
2. **Python está en `C:\Program Files\Python313\python.exe`**, con espacio en la ruta. Por
   eso van las comillas escapadas `\"` adentro del `/TR`. En la laptop de Daniel es otra
   —`C:\Python314`—: no confundirlas.
3. **`/ST 23:59` con `/SC ONCE` no significa que espere a esa hora.** Es solo la hora
   obligatoria que pide el Programador; el `schtasks /Run` la arranca en el momento.
4. **`/F` pisa la tarea si ya existía.** Sin él, volver a crear una con el mismo nombre
   falla y el segundo comando arranca la vieja.

## Una medición que engaña

**Una prueba con `--sin-exportar` no dice lo que tarda de verdad.** El OBLPN daba **1
minuto** recorriendo la pantalla y **12 a 13 minutos** bajando el archivo de 11 a 16 MB. Lo
que pesa es la descarga, no la búsqueda.

Así que el tiempo que se le promete a Daniel sale de una corrida completa, nunca de la de
prueba.
