---
name: una-guia-un-lugar
description: La regla que reparte la demanda de comercial en tres grupos que no se pisan —Correo de Hoy, Pendiente de Despacho y lo que el WMS abre pero comercial nunca liberó— y por qué una misma guía no puede aparecer en dos. Úsala antes de tocar robot/armar_pendiente.py, js/reportes/pendiente.js, js/reportes/correo_hoy.js, las tarjetas PEDIDOS y PENDIENTE de Zona Buffer o cualquier cuadro que cuente pedidos, guías o unidades por atender. También cuando un total no cuadre contra lo que el WMS tiene abierto, o cuando haya que decidir si algo "ya se puede trabajar".
---

# Una guía, un solo lugar

Regla dictada por Daniel el 09-sep-2026, después de encontrar el mismo correo contado
dos veces:

> *"El pedido no se tiene que repetir en ninguno de los tres módulos. El correo es el
> que llega todos los días, el correo es el actual. De ahí viene el pendiente de
> despacho, que es el día anterior hacia atrás. Y de ahí vienen los pedidos del WMS
> que no están liberados: esos no tienen que estar ni en pedidos ni en pendiente de
> despacho, porque no lo liberó todavía comercial."*

## 1. La unidad es la GUÍA, nunca el SKU

> *"No te tienes que guiar del detalle del SKU, nada de eso. Te tienes que guiar del
> pedido nada más, de la guía."*

Comercial libera **la guía entera**. Su correo ni siquiera trae columna de artículo —sus
columnas son `Cadena · TIEND · NOMBR · Prioridad · Etiqueta · FECHA · GUIA · ALMAC ·
Despachar · Cantidad · CD`—. Entonces:

- **Para repartir**, decide siempre la guía. Nunca el SKU, nunca la línea, nunca la talla.
- **Para cortar por artículo** (gender rims, colección, calzado) solo se puede usar lo que
  el WMS tiene abierto, porque el Maestro se alcanza por el SKU y el correo no lo trae.
  Ese corte va en un bloque aparte y rotulado: es otro total y hay que decirlo.

## 2. Los tres grupos

Cada guía abierta en el WMS cae en **uno y solo uno**:

| Grupo | Dónde se ve | Cómo se decide |
|---|---|---|
| **Correo de Hoy** | `Despacho › Correo de Hoy` | la guía aparece por **primera vez** en el correo con fecha de **hoy** |
| **Pendiente de Despacho** | `Despacho › Pendiente de Despacho` | apareció por primera vez en un correo **anterior a hoy** y sigue abierta en el WMS |
| **Nunca liberado** | la fila gris del Pendiente | la guía **no está en ningún correo** de comercial |

**Manda la fecha del PRIMER correo que trajo la guía.** Si comercial vuelve a mandar hoy
un pedido que ya había mandado el lunes, esa guía **se queda en el pendiente**: *"eso es
lo primero que mandó"*. `leer_correos()` ya se queda con la primera aparición, así que la
regla sale sola —pero si alguien toca esa función, se rompe esto.

**Una guía se muda sola, con el tiempo.** Lo que hoy está en Correo de Hoy, mañana está en
el Pendiente sin que nadie haga nada: pasó a ser "de ayer hacia atrás". Nunca se mueve a
mano ni se acumula nada.

## 3. El cuadre, que es la prueba

Los tres suman **todo lo que el WMS tiene abierto** en estado `Creada` o
`Parcialmente asignado`. Medido con los datos reales del 09-sep-2026:

```
    Pendiente de Despacho    1.135 guías      40.986 unidades
    Nunca liberado             740 guías     237.331 unidades
                            ───────────    ────────────────
    el WMS abre, sin hoy     1.875 guías     278.317 unidades

    Correo de Hoy              461 guías      28.914 unidades
                            ───────────    ────────────────
    TODO lo abierto          2.336 guías     307.231 unidades
```

**Si esa suma no da, hay un defecto.** No es una coincidencia bonita: es la comprobación.

Y **cada módulo muestra su propio universo**. El Pendiente dice *"abierto en el WMS, sin
el correo de hoy"* = 1.875, porque sus dos filas tienen que sumarlo exacto. Poner ahí las
2.336 dejaría un cuadro que no cierra, y esos cuadros se leen con la calculadora al lado.

## 4. Los errores que ya se cometieron

**Contar el correo de hoy dentro del pendiente.** Fue el defecto original: el reporte
cruzaba contra *todos* los correos, así que el de la noche entraba a las dos partes. Eran
461 guías y 28.914 unidades, **el 41% de lo que decía la pantalla**.

**Meter el correo de hoy en "comercial nunca lo liberó".** Al sacarlo del pendiente lo
mandé con las de afuera, y esa fila pasó de 740 a 1.201 guías. **Es mentira**: comercial
sí las liberó, esa misma noche. Un grupo no se vacía tirando su contenido en otro.

**Restar dos medidas distintas.** Le dije a Daniel que faltaban 17.661 unidades por abrir,
restando `46.575 − 28.914`. Una es lo que comercial pidió y la otra lo que el WMS tiene
abierto: no se restan. Las que de verdad faltaban por abrir eran **8.433**, la suma de lo
pedido en las guías que el WMS no tiene.

## 5. Lo que el correo dice y lo que el WMS tiene, no son lo mismo

**Una guía liberada no siempre se puede trabajar.** El 09-09 comercial mandó **879 guías /
46.575 unidades** y el WMS solo tenía abiertas **461 / 28.914**: **418 guías (8.433
unidades, 30 tiendas) no estaban abiertas todavía**. Eso no se veía en ninguna pantalla y
por eso existe el cuadro *"¿el WMS ya tiene lo que mandó comercial?"*.

**La cantidad la pone el WMS, no el correo.** Lo que falta de cada línea es
`Cantidad solicitada − Cantidad asignada`. Comprobado el 09-09 sobre las 1.135 guías del
pendiente: en **0 guías** el WMS pide más de lo que comercial pidió; en 814 pide menos
—ya se picó parte— y en 321 es igual. **Si alguna vez el WMS pidiera de más, sería un
defecto**: el CD estaría trabajando algo que comercial no liberó.

**El segundo filtro no es un adorno.** *"Ponte que del WMS saques veinte mil, pero de esos
comercial solo mandó diez mil."* Sin el cruce contra el correo entrarían al buffer 237.331
unidades que nadie pidió.

## 6. Dónde vive cada cosa

| Pieza | Archivo |
|---|---|
| El reparto y las dos publicaciones | `robot/armar_pendiente.py` — `armar()` y `armar_correo_hoy()` |
| El corte por fecha | `armar()`, la variable `es_de_hoy` |
| La pantalla del pendiente | `js/reportes/pendiente.js` |
| La pantalla del correo | `js/reportes/correo_hoy.js` |
| Las áreas publicadas | `pendiente_despacho` y `correo_hoy`, un mes cada una |

**Las tarjetas de Zona Buffer son otra cosa y siguen la misma regla:** `PEDIDOS` (área
`buffer`) lleva el correo de hoy y `PENDIENTE` (área `buffer_pendiente`) lo de antes, para
poder correr el análisis un día con el correo y otro sin él. Son el mismo reparto visto por
SKU, porque el motor del buffer trabaja con artículos. **Al cambiar el reparto hay que
mover las cuatro cosas juntas**, o una pantalla dirá un número que ninguna otra confirma.

## 7. Cómo se comprueba, sin creerle a nadie

Antes de dar por bueno un cambio en el reparto, correr el armador contra los archivos
reales y verificar tres cosas:

```
python comprobar_reparto.py            # la corrida de hoy
python comprobar_reparto.py 2026-09-09 # o la de un dia concreto
```

Corre las tres solo, con los archivos reales, y devuelve `1` si alguna falla:

1. **Ninguna guía en dos grupos a la vez** —los tres pares comprobados.
2. **La suma de los tres grupos = las guías abiertas en el WMS.**
3. **En ninguna guía el WMS pide más que el correo.**

No reimplementa nada: importa `armar_pendiente` y usa sus mismas funciones.

Para dejar un correo fuera y ver el efecto —por ejemplo, correr como si el de hoy no
hubiera llegado—: `python armar_pendiente.py --probar --sin-correo 09.09`.

**Y no alcanza con que el número dé.** Un cruce roto da casi cero y no avisa: el WMS
envuelve los códigos como fórmula (`="7997215"`) y el correo los escribe pelados, así que
basta un cambio de formato para que no calce ninguno. Por eso existe `MINIMO_CRUCE` y por
eso **se mide contra todo lo que el WMS abre**, no contra el universo ya recortado: si se
midiera contra el recorte, una noche de correo grande se leería como cruce roto y el
pendiente no se publicaría por nada.
