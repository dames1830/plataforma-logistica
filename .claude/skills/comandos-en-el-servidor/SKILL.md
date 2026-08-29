---
name: comandos-en-el-servidor
description: Cómo pasarle a Daniel un comando que corre en el servidor Contabo sin que se muera al cerrar la laptop. Úsala SIEMPRE que vayas a darle un comando para ejecutar allá — bajar archivos del WMS, correr un robot, un respaldo, una migración— y también cuando un proceso que él lanzó se haya cortado a la mitad. Cubre por qué un comando suelto no sobrevive, la forma con schtasks, cómo mirar el log después, y las cuatro trampas de armarlo.
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

## La forma correcta

Dos comandos, siempre en este orden. Corre como el servidor —`/RU SYSTEM`— y no necesita
que nadie esté conectado.

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
