---
name: reglas-almacenaje
description: Las reglas que deciden CUÁNTO baja al piso y DÓNDE va cada artículo en las tareas de almacenaje. Úsala antes de tocar processAlmacenajeTasks, casoDelItem, calcularSugerenciaDeItem, planificarPorTalla o planificarAlmacenaje, o cuando una tarea salga con un destino, una cantidad o un "Paletizar" que no se entienda. Cubre el buffer A/B/C/D, el código nuevo, el escolar, y el trato aparte de Adidas, Puma y Skechers.
---

# Reglas de almacenaje

Las dictó Daniel. **No son deducibles del código ni de los datos** — vienen de cómo se
trabaja en el almacén, y varias tienen una excepción que parece un error hasta que se sabe
el motivo. Antes de "corregir" algo que acá figure, preguntar.

## Dónde vive cada cosa

| Qué decide | Archivo | Función |
|---|---|---|
| Cuánto baja al piso | `js/services_v245/tallasService.js` | `planificarPorTalla` |
| El caso de cada artículo | `js/views/dashboard_v28.js` | `casoDelItem` |
| Dónde va | `js/services_v245/zonasService.js` | `planificarAlmacenaje` |
| Une las dos y arma el papel | `js/views/dashboard_v28.js` | `calcularSugerenciaDeItem`, `filasDelPapel` |

**El archivo que corre es `dashboard_v28.js`.** `almacenaje_module.js` es código muerto y
engaña: tiene funciones con el mismo nombre que no se ejecutan.

**Primero CUÁNTO, después DÓNDE.** De la zona sale la densidad del cuerpo, de la densidad
sale cuántos pares bajan, y recién con esos pares se piden cuerpos. Al revés se reserva
lugar de más.

## 1. Cuánto baja: manda el ORIGEN, no la marca

La sub-zona del buffer dice de dónde vino la mercadería, y eso decide más que la marca.

| Origen | Qué es | Cuánto baja |
|---|---|---|
| `CDBUFFER-A` | Recepción: importado o nacional | Según sea código nuevo o reposición — ver abajo |
| `CDBUFFER-B` | Bajó de reserva por pedido o replenishment | **Todo**, *si de verdad bajó de arriba* |
| `CDBUFFER-C` | Prepack | **No entra al circuito.** Se pica por caja, no por par |
| `CDBUFFER-D` | Catálogo | **Todo**, a la columna 8 del MZN03, sin mirar marca ni temporada |

### El buffer B no se cree solo por la letra

El 05-ago-2026 el buffer A se llenó y recepción metió mercadería **nueva** en el B. No fue
descuido: no había otro lado. Va a volver a pasar.

Como el B significa "bajó de reserva", esos códigos nuevos se almacenaban enteros. Antes de
creerle a la letra hay que preguntar **de dónde habría bajado**: lo que baja de reserva
estuvo antes en algún lado, así que un artículo **sin un solo par en el piso y sin un solo
par en reserva no pudo haber bajado de ninguna parte**. Ese cae a la regla del código nuevo.

De 41 códigos en el B ese día, 37 tenían piso o reserva y 4 no tenían nada.

### Código nuevo: el 60%, salvo que entre en un cuerpo

Un código nuevo deja abajo el **60% de lo que llega**. Sale del estudio de los 81 códigos
que entraron en mayo de 2026: la primera semana se picó el 43,4% y la segunda el 21,3%
—64,7% entre las dos— y de la tercera en adelante se planta en 1,2%.

**Redondeo y piso son dos cosas distintas**, y confundirlas costó una versión:

- **Redondeo** — llevar el objetivo al cuerpo entero más cercano. El código nuevo **no** lo
  usa (`sinCandado: true`): *"no importa si me ocupa un cuerpo, dos cuerpos o tres cuerpos,
  pero el sesenta por ciento tiene que quedarse abajo"*.
- **Piso** — si todo lo que hay entra en un cuerpo, **baja entero**. Vale siempre. Un cuerpo
  no se comparte entre dos artículos, así que sacarle el 40% a una llegada chica deja el
  cuerpo casi vacío y manda a reserva una caja que hay que volver a bajar. *"Si un código
  nuevo llega con trescientos, no vayas a separar el sesenta por ciento, porque sabes que
  esos trescientos sí entran en un cuerpo."*

Antes eran 3 cuerpos fijos. Se cambió porque el cuerpo no se estira con la llegada: con
cuerpos de 330, una llegada típica de 1.082 dejaba abajo el 91% y una de 2.519 el 39%.

**Reposición de fábrica** (ya tiene cuerpo en su franja) → 2 cuerpos. Esa no cambió.

### El escolar manda sobre todo lo demás

50 pares al piso y el resto a reserva, *"así sea nuevo, reposición, lo que sea"*. Se
pregunta **antes** que cualquier otra regla, incluso antes que el buffer B.

## 2. Adidas, Puma y Skechers: el trato aparte

Las tres viven en el mezzanine 3 y se trabajan distinto del resto. Regla de Daniel del
05-ago-2026, y las tres partes van juntas.

### No mandan nada a reserva, llegue lo que llegue

Las tres van con `modo: 'todo'`. **Y eso le gana al caso**: un Puma nuevo caía en la regla
del 60% y se le paletizaba el 40% teniendo cuerpos libres. El único que sigue mandando por
encima es el escolar, porque se pregunta antes.

### El destino es la COLUMNA, no el cuerpo

```
antes    MZN03-13-07, MZN03-13-08, MZN03-14-02, MZN03-14-03...
ahora    MZN03 · Col 12-15
```

Sus columnas son propias y nadie más entra ahí, así que nombrar el cuerpo no le ahorra un
paso al operario: le llena el papel de renglones. Una llegada de Adidas se reparte en seis o
siete cuerpos y salía una ubicación distinta por talla. *"La ubicación exacta es muy
complicada de que el operario entienda."*

| Marca | Columnas del MZN03 | Sale como |
|---|---|---|
| Skechers | 9, 10, 11 | `MZN03 · Col 9-11` |
| Adidas | 12, 13, 14, 15 | `MZN03 · Col 12-15` |
| Puma | 16, 17 | `MZN03 · Col 16-17` |

La lista `MARCAS_SIN_CUERPO` va **escrita a mano**, no derivada de "las marcas de modo
todo", aunque hoy sean las mismas tres. Son dos reglas que coinciden por casualidad: una
dice CUÁNTO baja, la otra CÓMO se nombra el destino. Atarlas haría que agregar una marca al
modo `'todo'` le borrara la ubicación exacta sin que nadie lo pidiera.

### Nunca van a Slotting

Si la zona está llena, el papel **manda igual**. El operario almacena lo que entra y lo que
sobra se queda en el buffer hasta la corrida siguiente. *"Tú mandas nada más, y si no entra
lo voy a dejar en buffer. Yo decido qué artículos se quedan."*

Por eso se reemplaza el plan entero sin mirar si quedaban cuerpos libres. Antes, sin
cuerpos, el artículo se iba a Slotting y no salía en ninguna tarea.

### El buffer D queda afuera de todo esto

Lo que llega por catálogo va a la **columna 8** del MZN03, mezclando las tres marcas, y no a
las columnas de la suya. **Un Puma que viene por el D no vuelve a la 16 ni aunque ya viva
ahí.** Sin ese filtro el papel lo manda a `Col 16-17`, justo al revés de lo que corresponde.

## 3. Dónde va el resto de las marcas

1. **¿Es OTHERS?** Manda la subcategoría, no la marca.
2. **¿No es calzado?** (`G. Gender`, no `Gender RIMS`) → mezzanine 4, y ahí se entrega **sin
   ubicación**: sin columna, sin cuerpo, sin nivel. Y nada sube a reserva.
3. **La zona sale de la marca**, y las columnas también cuando la marca las tiene repartidas
   (MZN01 lo comparten Power, Bubblegummers y B.G Licenses).
4. **Reposición:** si el artículo ya vive en el almacén va a sus mismos cuerpos. Si no le
   entra, se le abren los que falten empezando por sus columnas.
5. **Si no hay lugar, no se improvisa:** va a Slotting — salvo las tres marcas de arriba.

Las tallas se reparten llenando un cuerpo hasta su capacidad antes de pasar al siguiente, de
menor a mayor. **El destino es el cuerpo, no el nivel.**

## Trampas conocidas

- **Las fechas nunca salen de `toISOString()`.** Devuelve UTC y Perú está cinco horas atrás:
  a las 19:00 —cuando entra el turno noche— ya es el día siguiente. Va `getLogicalDate()`, o
  armar el texto con `getFullYear`/`getHours`.
- **Un dato del maestro que falta no se ve como falta:** sale `S/M`, `S/G`, `S/C`. Si una
  tarea dice `S/M`, el artículo no está en el Maestro **publicado en el servidor** — que es
  el que vale, no el `.xlsx` de OneDrive.
- **Compilar no es probar.** `node --check` no ve un identificador mal escrito dentro de un
  template de HTML. Repasar los nombres nuevos antes de desplegar.
- **El caché de la configuración:** si se agrega un campo con valor de fábrica nuevo, hay que
  subirle la versión a `CACHE_KEY` (`config_zonas_v5`) o las PC con caché viejo se quedan sin
  él para siempre.
