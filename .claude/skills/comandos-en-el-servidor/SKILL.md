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

## SI LA TAREA ABRE UN NAVEGADOR

**El sintoma**: la tarea arranca, entra a Python, escribe las rutas en el log… y muere en la
linea siguiente, siempre la misma:

```
[23:59:01] [INFO ] Abriendo navegador en segundo plano...
(y ahi termina el log)
```

**Y Windows la marca como ejecutada**, asi que pasa desapercibida.

**La causa**: Playwright busca el navegador en el perfil del usuario que corre. Bajo SYSTEM
el perfil es `C:\windows\system32\config\systemprofile`, que no tiene navegadores — los
navegadores estan en el de Administrator. Comprobado el 08-sep-2026 corriendo la misma
prueba con los dos usuarios.

**LA CAUSA YA ESTA ARREGLADA (08-sep-2026)**, y no cambiando el usuario de las tareas sino
donde dice el sistema que estan los navegadores:

```
PLAYWRIGHT_BROWSERS_PATH = C:\Users\Administrator\AppData\Local\ms-playwright   (a nivel MAQUINA)
```

Con eso **cualquier usuario abre el navegador**, y no hay que acordarse de nada al crear una
tarea. Es la salida que ya usaba `oblpn_embalaje.py` desde el 29-ago —parcheando la variable
por codigo— y por eso ese robot y el del ASN funcionaban como SYSTEM mientras otros no. Lo
que faltaba era subirla de "dos scripts" a "toda la maquina".

**Si el sintoma vuelve**, lo primero no es tocar el usuario de la tarea: es mirar la
variable, porque reinstalar Playwright o rehacer el servidor la deja vacia.

```
[Environment]::GetEnvironmentVariable('PLAYWRIGHT_BROWSERS_PATH','Machine')
```

Si sale vacia, se vuelve a poner apuntando a la carpeta `ms-playwright` que exista de
verdad. Cambiar la tarea a Administrator tambien lo tapa, pero ata la tarea a que haya una
sesion abierta y no arregla la siguiente.

## COMPROBAR QUE ARRANCO, NO QUE "SE EJECUTO"

`LastTaskResult` miente: dice 0 aunque el proceso haya muerto a los dos segundos. **La
prueba es el log del robot**, y en una tarea del WMS la linea que hay que ver es esta:

```
[09:09:28] [INFO ] Sesion iniciada como dames
```

Si el log termina en `Abriendo navegador en segundo plano...`, es la variable.

Costo real de no comprobarlo: el picking de los sabados 22 y 29 de agosto. La tarea que iba
a recuperarlo era del 05-sep, murio en el segundo 1, Windows dijo que habia corrido, y los
datos siguieron faltando hasta el 08-sep — cuando Daniel ya los habia llevado a un comite.

## AL CREAR UNA TAREA, COPIAR UNA QUE YA ANDE

No inventar el usuario ni el arranque: mirar como esta puesta una que haga un trabajo
parecido.

```
Get-ScheduledTask | Where-Object { $_.TaskPath -eq '\' } | ForEach-Object { $_.TaskName + ' | ' + $_.Principal.LogonType + ' | ' + $_.Principal.UserId }
```

## La forma correcta

Dos comandos, siempre en este orden. Va con `/RU SYSTEM`, que corre como el servidor y no
necesita que nadie esté conectado —y desde que la variable de los navegadores es de máquina,
también abre el WMS sin problema—.

```
schtasks --% /Create /TN "<nombre>" /TR "\"C:\Program Files\Python313\python.exe\" C:\wms_scraping\<script>.py <argumentos>" /SC ONCE /ST 23:59 /RU SYSTEM /F
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
`Register-ScheduledTask`:

```powershell
$raiz = Join-Path $env:SystemDrive 'wms_scraping'
$acc  = New-ScheduledTaskAction -Execute (Join-Path $raiz 'mi_tarea.bat') -WorkingDirectory $raiz
$tri  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3)
$pri  = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName '<nombre>' -Action $acc -Trigger $tri -Principal $pri
```

**El `-WorkingDirectory` no es opcional.** Todos los `.bat` que funcionan arrancan con
`cd /d "%~dp0"`; si la tarea llama al `.bat` sin eso, la carpeta actual queda en
`system32` y lo que use rutas relativas —los `logs\`, el candado— escribe donde no debe.

Y adentro del `.bat`, dos cosas que el entorno rechaza al escribirlas: **`cd /d`** —para eso
está el `-WorkingDirectory`— y **`exit /b`**, que no hace falta.

**Si es de un solo uso, borrarla al terminar.** Un disparador `-Once` con fecha pasada más
`-StartWhenAvailable` puede volver a dispararse en el próximo arranque del servidor y
rehacer un trabajo que ya estaba hecho.

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
