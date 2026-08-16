---
name: reglas-almacenaje
description: Las reglas que deciden si un artículo es CÓDIGO NUEVO o REPOSICIÓN, CUÁNTO baja al piso y DÓNDE va en las tareas de almacenaje. Úsala antes de tocar processAlmacenajeTasks, casoDelItem, calcularSugerenciaDeItem, planificarPorTalla, planificarAlmacenaje o cargarContextoSugerencia, o cuando una tarea salga con un destino, una cantidad o un "Paletizar" que no se entienda. Cubre el corte de los 20 pares, los dos caminos completos, el buffer A/B/C/D, la capacidad de cada cuerpo, el surtido de tallas dentro del cuerpo, qué columna le toca a cada marca, el escolar, y el trato aparte de Adidas, Puma y Skechers.
---

# Reglas de almacenaje

Las dictó Daniel. **No son deducibles del código ni de los datos** — vienen de cómo se
trabaja en el almacén, y varias tienen una excepción que parece un error hasta que se sabe
el motivo. Antes de "corregir" algo que acá figure, preguntar.

**Esto tiene que estar fino.** Si el papel sale mal, el operario no sabe dónde ni cuánto
almacenar, y el error se multiplica por cada tarea de la noche.

## Dónde vive cada cosa

| Qué decide | Archivo | Función |
|---|---|---|
| Nuevo o reposición | `js/views/dashboard_v28.js` | `casoDelItem` |
| Cuánto baja al piso | `js/services_v245/tallasService.js` | `planificarPorTalla` |
| Dónde va | `js/services_v245/zonasService.js` | `planificarAlmacenaje` |
| Qué hay en el almacén | `js/views/dashboard_v28.js` | `cargarContextoSugerencia` |
| Une todo y arma el papel | `js/views/dashboard_v28.js` | `calcularSugerenciaDeItem`, `filasDelPapel` |

**El archivo que corre es `dashboard_v28.js`.** `almacenaje_module.js` es código muerto y
engaña: tiene funciones con el mismo nombre que no se ejecutan.

## El flujo de una sola mirada

```
ZONA BUFFER  (A · B · D — la C es prepack y NO entra al circuito)
      |
   un artículo, con los pares que llegaron
      |
   [ los seis casos que se resuelven antes — ver más abajo ]
      |
   ¿CUÁNTO TIENE ESTE ARTÍCULO EN EL ALMACÉN?   ← activo + reserva
      |                                            lo que llega NO entra en la cuenta
      +---------------------------+
      |                           |
  20 pares o más           de 19 para abajo, o cero
   REPOSICIÓN                CÓDIGO NUEVO
```

**Primero CUÁNTO, después DÓNDE.** De la zona sale la capacidad del cuerpo, de la capacidad
sale cuántos pares bajan, y recién con esos pares se piden cuerpos. Al revés se reserva
lugar de más.

## 1. La pregunta que parte todo: 20 PARES

Daniel, 14-ago-2026:

> *"Si llega a mil y tienes más de veinte, igual o más de veinte, ya es un código de
> reposición. Pero si llega a mil y tienes menos de veinte, o sea, diecinueve para abajo, es
> un código nuevo, y le tenemos que dar el trato de un código nuevo."*

**Se cuenta lo que el artículo TIENE en el almacén: activo + reserva.** Cero también cae en
código nuevo — es la primera vez que ese código pisa el almacén.

**Lo que llega no interviene.** Un lote de 1.000 pares no convierte a un artículo en
reposición, y un lote de 10 no lo convierte en código nuevo.

### No confundir con el OTRO corte de 20

Son dos reglas distintas y se parecen:

| Corte | Qué decide | Valor |
|---|---|---|
| **20 pares** (esta) | código nuevo o reposición | siempre 20, en todas las zonas |
| `saldoMenorA` | si va a la **columna de saldos** | **20 en el SEL**, **80 en los tres mezzanines** |

Los dos están escritos y funcionando. El primero vive en `casoDelItem` como
`MINIMO_PARA_REPOSICION`, **EN BETA DESDE LA v29.0227**; hasta ahí la pregunta era otra y por
eso el corte no se cumplía — ver "El día que el corte de los 20 se delató solo".

### El día que el corte de los 20 se delató solo

Hasta la v29.0226 `casoDelItem` no contaba pares. Preguntaba **si el artículo tenía un cuerpo
en la columna que le tocaba por temporada**, y eso se parece lo suficiente como para no llamar
la atención: un artículo con stock casi siempre tiene su cuerpo en su franja, así que la
respuesta coincidía con la correcta por casualidad, no porque el sistema entendiera la regla.

El 15-ago-2026 se rompió solo, y lo rompió el cambio del día anterior. Al pasar la columna 4
del selectivo a `saldoGrande`, el `6110920` dejó de tener cuerpo en la franja actual y salió
como **código nuevo teniendo 363 pares en el piso y 700 en reserva**: se le bajaron 880 pares a
**tres cuerpos** del selectivo donde correspondían 320 a uno solo. Lo cazó Daniel leyendo la
tarea 24.

**No fue un caso aislado.** Medido sobre esa misma corrida: **17 de 41 artículos** estaban mal
clasificados, **3.070 pares de más** en el activo y **9 cuerpos de más** pedidos en una sola
noche — con el selectivo de temporada actual en 8 cuerpos libres y dos tareas ya trabadas por
falta de espacio.

**El arreglo cambia las dos cosas a la vez**, porque los dos defectos eran el mismo:

| | Antes | Ahora |
|---|---|---|
| Qué se pregunta | ¿tiene cuerpo en su franja? | ¿cuántos pares tiene en el almacén? |
| Qué se cuenta | nada | **activo + reserva** |

**Ojo con la dirección del cambio: no siempre baja menos.** Un artículo con 0 pares abajo y 60
en reserva pasa a ser reposición y su objetivo son 2 cuerpos, así que puede bajar **más** que
con el 60%. Esa noche fueron 4 casos —el `6515899`, el `6615998`, el `6616998` y el
`5891371`—. Es lo que corresponde: la reserva dice que ese código ya entró al almacén.

## 2. Camino CÓDIGO NUEVO — siete pasos

1. **CUÁNTO BAJA — el 60% de lo que llega.** Sale del estudio de los 81 códigos que entraron
   en mayo de 2026: la primera semana se picó el 43,4% y la segunda el 21,3% —64,7% entre las
   dos— y de la tercera en adelante se planta en 1,2%. Es el colchón de dos semanas.

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

2. **EL RESTO SUBE A RESERVA.** El 40% se paletiza. **Solo suben cajas cerradas.**

3. **LA ZONA — la manda la marca.** Ver la tabla de "Por qué va en esa columna".

4. **LA COLUMNA — la temporada, y dentro, su marca.** Un código nuevo es temporada **actual**.
   Y dentro de esa franja, solo las columnas de su marca: el MZN01 lo comparten Power,
   Bubblegummers y B.G Licenses.

5. **LA CAPACIDAD — la serie y la zona.** El primer dígito del código es la serie, y de ahí
   sale cuántos pares entran en un cuerpo de esa zona.

6. **CUÁNTOS Y CUÁLES — pares ÷ capacidad.** Se toman cuerpos **vacíos**, los más seguidos
   que haya; si uno está ocupado se salta al siguiente, y de todas las tandas posibles se
   elige la que ocupa el tramo más corto. **Un código nuevo no comparte cuerpo**: llegó
   mercadería de verdad y tiene que entrar entera. (Los saldos sí comparten — ver más abajo.)

7. **SI NO HAY LUGAR — Revisar Slotting.** No es un consejo, es una compuerta: sin ubicación
   no se almacena. El operario **no improvisa**.

## 3. Camino REPOSICIÓN — cinco pasos

1. **CUÁNTO BAJA — hasta completar 2 cuerpos.** Ya salió antes y viene por su segundo lote;
   no se le calcula porcentaje.

2. **DÓNDE — a sus mismos cuerpos.** No se pregunta zona ni columna: el artículo ya tiene su
   lugar y ahí vuelve. **Un cuerpo cuenta como suyo desde 20 pares** (`MINIMO_PARA_SER_CASA`).

   Por qué ese mínimo: alcanzaba **una línea de stock —un par—** para que un cuerpo contara
   como casa. Pasó con el `5811379`: vive en `MZN02-11-05` con 215 pares y tenía UN par en
   `MZN03-05-01` y otro en `MZN03-07-01`; el sistema le creyó las tres casas y mandó la mitad
   del artículo a cuerpos que no eran suyos.

3. **¿LE ENTRA? — capacidad menos lo que ya hay.** Se descuenta **todo** lo que hay adentro,
   sea suyo o de otro artículo. Se tolera hasta un **10% de más** (`HOLGURA`) antes de abrir
   otro cuerpo: la capacidad es un percentil 75, no un límite físico.

   Esta pregunta antes no se hacía: se devolvían sus cuerpos y listo. El operario llegaba con
   500 pares a un cuerpo que ya tenía 300 de los suyos.

4. **SI NO LE ENTRA — se abren los que falten.** Primero en sus mismas columnas —si el suyo
   está lleno, lo natural es el de al lado— y después en el resto de su franja. `elegirCuerpos`
   **junta libres de varias columnas**: antes exigía que una sola columna tuviera todos los
   cuerpos necesarios, así que con el mezzanine cargado derivaba a Slotting habiendo lugar.

5. **SI NO HAY LUGAR — Revisar Slotting.** Mismo criterio.

**Por qué tiene menos pasos que el otro camino:** la reposición no elige zona, ni columna, ni
cuerpo. Todo eso ya quedó decidido la primera vez que el artículo entró al almacén. Solo mide
si le entra y, si no, le agrega cuerpos al lado.

## 4. Lo que se resuelve ANTES de la pregunta

Seis casos no llegan a la bifurcación porque su destino ya está decidido. Se preguntan en
este orden:

| Caso | Cuánto baja | Dónde va |
|---|---|---|
| **Escolar** (cualquier marca) | 50 pares **de cada talla**, el resto arriba | la columna de escolar de su marca |
| **Buffer D** · catálogo | todo | `MZN03` columna 8 |
| **Buffer B** · bajó de reserva | todo | sus cuerpos |
| **No es calzado** | todo, nada a reserva | `MZN04`, **sin ubicación exacta** |
| **Ojotas** (Gender RIMS `06 OTHERS`) | según el caso | manda la **subcategoría**, no la marca |
| **Adidas · Puma · Skechers** | todo, nada a reserva | la zona de la marca, sin cuerpo |

### El origen: qué significa cada sub-zona del buffer

| Origen | Qué es |
|---|---|
| `CDBUFFER-A` | Recepción: importado o nacional. Va al camino normal |
| `CDBUFFER-B` | Bajó de reserva por pedido o replenishment — **si de verdad bajó de arriba** |
| `CDBUFFER-C` | Prepack. **No entra al circuito.** Se pica por caja, no por par |
| `CDBUFFER-D` | Catálogo. Columna 8 del MZN03, sin mirar marca ni temporada |

### El buffer B NO se cree por la letra — y hoy se le está creyendo

El 05-ago-2026 el buffer A se llenó y recepción metió mercadería **nueva** en el B. No fue
descuido: no había otro lado. Va a volver a pasar.

**La letra no es prueba de nada.** Daniel, 14-ago-2026: *"¿Qué pasa si por error recepción mete
lo que llegó de importación en el buffer B, y da la casualidad que ese es código nuevo? Lo vas
a tratar como código de reposición. Ahí estás mal."*

**La cuenta que hay hoy no alcanza.** El código pregunta si lo que llega es menor o igual a lo
que hay en reserva (`pares <= enReserva`), y solo entonces le cree al B. Suena razonable y **en
la práctica no filtra nada**, medido sobre el buffer del 14-ago-2026:

- **38 de 41** artículos del buffer B pasan la prueba y se bajan enteros.
- La reserva es en promedio **89 veces** lo que llega. El caso más ajustado es 2,1 veces.
- La prueba solo salta si llega **más que TODA la reserva**. Con reservas de 300 a 3.500 pares
  y llegadas de 1 a 360, es prácticamente imposible que salte.

Se escribió por el `8816454` —lo cazó Daniel en el papel—: llegaron 3.274 pares con 60 en
reserva. Ese caso extremo sí lo agarra; ningún otro.

**Y hay un segundo agujero, peor:** la comparación usa el **total del buffer del artículo**
—sumando A y B—, y basta con que el artículo tenga algo en el B para que **todo lo del A entre
como si hubiera bajado de reserva**. La nota vieja decía que un artículo no aparece en A y en B
a la vez ("cero casos de 141", 04-ago); **el 14-ago había 5**, y dos de ellos arrastraron
**692 pares de recepción** tratados como replenishment.

**Lo que corresponde: dos decisiones separadas.** Hoy la letra B decide las dos a la vez y por
eso se salta la clasificación entera.

| Decisión | Quién la manda |
|---|---|
| **¿Se devuelve algo al rack?** | Si de verdad bajó de reserva: **no**. Es la posta del replenishment |
| **¿Es código nuevo o reposición?** | **Siempre** el stock del artículo: activo + reserva, corte en 20 |

El replenishment de verdad sigue protegido: si bajaron 200 de una reserva de 500, va todo al
piso y no se le devuelve nada al rack. Lo que falta es **saber** que bajó, en vez de adivinarlo
— ver `cadena-de-modulos`: el módulo anterior tiene que dejar constancia de lo que mandó bajar.

### El escolar manda sobre todo lo demás

Se pregunta **antes** que cualquier otra regla, incluso antes que el buffer B — excepción
consciente a "no contradecir al replenishment": el tope lo puso Daniel después y es más chico.
Vale *"así sea nuevo, reposición, lo que sea"*.

**Tienen que quedar 50 pares DE CADA TALLA en el activo.** Dos cosas que conviene no volver a
confundir, porque estuvieron mal entendidas del 05 al 14-ago-2026:

| | |
|---|---|
| **Por talla, no del artículo** | *"De la talla treinta, cincuenta pares; de la treinta y uno, cincuenta; treinta y dos, cincuenta"*. Un artículo de 9 tallas baja hasta 450, no 50 |
| **Es un objetivo, no una cantidad a bajar** | *"Si ya tiene diez, solo tendrías que reponer cuarenta. Si ya tienes cuarenta, solo tendrías que reponer diez"*. Una talla que ya llegó a 50 no recibe nada |

**Cómo se veía el error, y por qué nadie lo vio:** estaba puesto como tope del artículo entero
y repartido entre las tallas, así que a cada una le tocaban 5 o 6 pares —menos de una caja— y
el redondeo terminaba bajando **una caja por talla**. La cuenta cerraba sola: con 9 tallas
bajaban 90, con 19 tallas 304, y con 5 tallas daba 50 justo. Salió al pedir el papel de un
caso concreto.

Va con el modo **`paresPorTalla`** de `tallasService`, que **no es** el modo `pares` —ese fija
el tope del artículo entero—. Queda fuera del reparto de lo que falta: si una talla no tiene
buffer para llegar a 50, la que sobra **no** se lo compensa.

**Cada marca guarda su escolar en SU columna:**

| Marca | Columna |
|---|---|
| Bata | `SEL-14` |
| Bubblegummers | `MZN01-21` |
| B.G Licenses | `MZN01-21` — la misma, vía `COMPARTE_COLUMNAS` |
| Power | `MZN01-01` |
| North Star | `MZN02-04` |

**Las dos últimas llevan DOS franjas.** La 1 del MZN01 y la 4 del MZN02 son de temporada
anterior *y además* de escolar: son la única columna de anterior que le queda a esa marca, así
que cambiarles la franja las dejaría sin dónde poner lo viejo. Se resuelve con `franjasExtra`
por zona —lo que la columna **admite además**, sin tocarle lo que la columna **es**— y con
`columnaSirveParaFranja()`. **`franjasExtra` todavía no tiene pantalla de edición**: se carga
publicando la configuración.

### Los saldos SÍ comparten cuerpo

Son cientos de artículos con diez pares cada uno: darle un cuerpo propio a cada uno pediría
748 cuerpos y el selectivo tiene 284. Compartiendo entran en 26. Se busca el que **mejor lo
reciba** —el más lleno de los que todavía le dan, para consolidar— y un cuerpo vacío es el
último recurso.

**Al contar choques de cuerpos hay que sacar la franja de saldos**, o salen decenas de falsos
positivos.

## 5. Cuánto entra en un cuerpo

Lo manda la **serie** (primer dígito del código) y la **zona**. Valores publicados al
14-ago-2026 — **la fuente viva es la configuración publicada**, clave `zonas` del área `config`,
y se edita en Análisis SKU → Zonas de Almacenaje. Si esta tabla y la configuración no coinciden,
manda la configuración.

| Zona | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **SEL** | 830 | 740 | — | — | **330** | **330** | **330** | **330** | **330** | **330** |
| MZN01 | 700 | 610 | 570 | 400 | 284 | 372 | — | — | 347 | — |
| **MZN02** | **480** | **480** | **480** | **480** | **480** | **480** | **480** | **480** | **480** | **480** |
| MZN03 | — | — | 332 | 338 | 170 | 260 | 159 | 180 | 233 | — |
| MZN04 | — | — | — | — | — | 289 | 190 | — | 347 | 192 |

Donde dice — se usa el respaldo de la zona: **300**, salvo el MZN02 que va con **480**.

### Lo medido le gana al percentil

Las filas en negrita **las midió Daniel en el piso el 14-ago-2026**. Las demás siguen saliendo
del percentil 75 de los cuerpos que tienen un solo artículo.

**El percentil dice cuánto SUELE haber adentro, no cuánto ENTRA**, y esas son dos cosas
distintas: un cuerpo a medio llenar arrastra la medición. Los dos errores que salieron de ahí
iban en direcciones opuestas y los dos costaban caro:

| Zona | Decía | Entra | Qué pasaba |
|---|---|---|---|
| MZN02 | 259-352 | **480** | pedía cuerpos de más — 23 donde entraban 16, solo en las tareas de un día |
| SEL | 548 y 400 | **330** | mandaba al operario con mercadería que no cabía |

El del selectivo es **la queja que trajo Daniel del piso**: *"la tarea le indica almacenarlo en
cierto lugar, pero ya está ocupado ese espacio"*. Medido sobre las tareas vivas de ese día, 5 de
16 destinos del selectivo se pasaban — el peor, **412 pares a un cuerpo vacío del que el sistema
creía que aguantaba 548**.

**En el MZN02 la serie no parte nada:** son 480 parejo. La zona es de North Star casi entera
—62.783 de 62.788 pares—, así que no hay contra qué diferenciar.

**Dos avisos que siguen en pie:**

- **La tolerancia del 10% sigue viva.** Aun con la capacidad correcta, un cuerpo puede quedar
  al 110% en el papel.
- **Cuando el cuerpo ya tiene mercadería, el sistema NO usa la serie del artículo que llega:
  usa la del que más pesa adentro.** Con el MZN02 parejo eso deja de importar ahí, pero en las
  demás zonas sigue: un serie 4 puede terminar medido con la capacidad de un serie 8.

**Sin medir todavía:** las series 2 y 3 del selectivo, que caen en el respaldo de 300.

## 5b. EL CUERPO VA SURTIDO — parámetro `surtido`

Regla de Daniel, 14-ago-2026: *"en un cuerpo pueden ir varias tallas, surtido. La cosa es que
en un cuerpo esté surtido las tallas"*. Un cuerpo tiene tres niveles y en esos tres niveles
entra la curva entera, no un pedazo de la curva.

**Qué cambia.** Cuando un artículo ocupa más de un cuerpo, cada cuerpo lleva **una parte de
cada talla**, no un bloque de tallas seguidas.

| `surtido` | Cómo reparte |
|---|---|
| **`true`** (nuevo) | las cajas de cada talla se reparten entre todos sus cuerpos |
| `false` | se llena el primer cuerpo y recién ahí se pasa al siguiente — como venía |

**EN BETA DESDE LA v29.0214.** Vive en `asignarCuerpos` de `dashboard_v28.js`, con el
interruptor `SURTIDO_EN_EL_CUERPO` al lado para volver al reparto viejo sin revertir código.

**La talla NO se parte, y es a propósito.** El reparto entrega **la talla más grande primero al
cuerpo que menos lleve**, en vez de cortarla en cajas. Dos razones y las dos pesan:

- **El papel.** La unidad de la hoja —y de lo que `grabarPapelEnTareas` escribe de vuelta en la
  tarea— es la línea del buffer: una ubicación, un SKU, una talla. Partir una talla obliga a
  partir esa línea, y con eso se rompe el formato cerrado.
- **El picking.** Con la talla entera en un cuerpo, el picker va a un solo lugar a buscarla.

**De mayor a menor, no en orden de talla.** Empezando por las chicas, las grandes llegan al
final sin dónde entrar. Con 150·150·150·50·50·50 en dos cuerpos, de mayor a menor da 300 y 300;
en orden de talla daba 350 y 250.

**Lo que esto NO puede arreglar**, antes de que a alguien se le ocurra "mejorarlo": con tallas
muy grandes el reparto perfecto no existe. Un hombre de 1.000 pares en tres cuerpos —250, 250,
250, 70, 60, 60, 60— deja uno en 370 sobre 330 y no hay acomodo que lo evite: las cuatro tallas
chicas suman 250 y hay que repartirlas entre tres cuerpos que ya tienen 250. Es aritmética, no
un defecto. Y tampoco es nuevo: `cuantos` ya venía aceptando pasarse con la misma holgura.

**Lo que se gana, medido sobre el ejemplo de los 600 pares en dos cuerpos:**

| | cuerpo 1 | cuerpo 2 |
|---|---|---|
| bloque (hoy) | 350 pares — **106%** | 250 pares — 76% |
| surtido | 300 pares — 91% | 300 pares — 91% |

El reparto viejo no solo desequilibra: **pasa del cuerpo**. Las tres primeras tallas suman 350
en un cuerpo de 330 y entran por la tolerancia del 10%, que está para redondeos, no para
tapar un reparto mal hecho.

**Sigue valiendo todo lo de antes:** el nivel no importa —el destino es el cuerpo—, un cuerpo
lleva un solo artículo en la franja actual, y ninguna talla baja en unidades sueltas.


## 5c. EL RESTO QUE QUEDA ATRÁS — se arrastra al cuerpo nuevo

Regla de Daniel, 14-ago-2026. Es la otra mitad del corte de los 20 pares: **el mismo corte que
convierte un código en nuevo es el que deja un resto huérfano en el piso.**

> *"Lo ideal es que esos diecinueve deberían estar en zonas de saldos, que son el selectivo uno
> y dos. Pero a veces Slotting no se da abasto y esos diecinueve quedan en una zona de actual,
> por ejemplo en el selectivo cinco. Y tú le has dado una ubicación a esos seiscientos pares en
> otro selectivo: entonces esa tiene que ser una tarea para Slotting, mover esos diecinueve
> pares a la ubicación nueva que le has dado."*

### LA FRANJA DONDE ESTABA EL RESTO NO IMPORTA — SE MUEVE SIEMPRE

Acá hubo una versión mal escrita que decía que el resto de la columna de saldos se quedaba
donde estaba. **Está mal y Daniel lo corrigió el mismo día:**

> *"Por más que esté en temporada antigua, temporada actual o en saldos, deberían moverse esos
> diecinueve a donde están los seiscientos pares, para que esté toda la familia en un solo
> cuerpo o en dos. No puede estar en dos zonas diferentes, no puede estar en zona de saldos y
> en zona de almacenaje. Debería estar todo junto."*

**La regla es una sola: TODA LA FAMILIA JUNTA.** Un artículo vive en uno o dos cuerpos, no
repartido entre franjas. Si el almacenaje le acaba de dar cuerpos nuevos, **todo lo que ese
artículo tenga en cualquier otro lado del piso se arrastra ahí** — de saldos, de temporada
anterior, de escolar, de catálogo o de otra columna de actual, da igual.

**Por qué:** un artículo partido entre la columna de saldos y su cuerpo nuevo se pica desde los
dos lados, envejece en el pedazo que nadie mira, y deja ocupado un cuerpo de saldos con 19
pares. Es el mismo mecanismo que hoy tiene **303 cuerpos inmovilizados**: el saldo envejece
donde está porque el sistema solo decide ubicación cuando la mercadería llega, y nunca vuelve a
mirarlo.

**Ojo con el efecto secundario, que es sano:** con esta regla la columna de saldos se queda
solo con lo que **ya no vuelve a llegar**, que es exactamente lo que un saldo es. Lo que
todavía recibe mercadería sale de ahí solo.

**EN BETA DESDE LA v29.0214**, al final de `barrerParaSlotting` en `dashboard_v28.js`.

**ES LA ÚNICA LÍNEA DE SLOTTING CON DESTINO** (`llevarA`). Las del cuerpo mezclado dicen qué
sacar y el equipo decide adónde; esta dice las dos cosas, porque la tarea de almacenaje ya
eligió el cuerpo esa misma noche. Si la tarea le dio más de un cuerpo, va al primero.

**NO SE DUPLICA CON EL BARRIDO DE MEZCLAS.** Un resto que está en un cuerpo mezclado ya salió
como línea sin destino; si además hay que arrastrarlo, se le completa el destino a esa línea en
vez de agregar otra. Sin eso el operario recibía la misma mercadería dos veces.

**EL BARRIDO CORRE DESPUÉS DE ARMAR LAS TAREAS, no antes.** El destino no existe hasta que
`calcularSugerenciaDeItem` eligió los cuerpos.

**SE ARRASTRA UN RESTO, NO UNA MUDANZA — y ese candado costó descubrirlo.** La primera versión
arrastraba todo lo que el artículo tuviera fuera de sus cuerpos nuevos, y corriéndola contra los
datos de verdad salían líneas de **612, 573 y 553 pares**: un artículo que vive en tres cuerpos
del MZN02 y al que la tarea le nombró otro. Eso no es juntar la familia, es mover el artículo
entero a un cuerpo donde no entra.

El candado sale del mismo corte de los 20: si lo que el artículo tiene **fuera de sus cuerpos
nuevos llega a 20 pares, no es un resto** y no se toca. Medido sobre beta el 14-ago-2026: con el
candado salen **22 arrastres** de 12 a 19 pares; sin él salían 118, y 71 artículos se movían de
más.

**Cuántos hay, medido sobre el stock del 14-ago-2026** — artículos con 19 pares o menos en todo
el piso, y dónde está cada resto suyo:

| Zona | Restos | Pares | | Franja de donde salen | Restos | Pares |
|---|---|---|---|---|---|---|
| SEL | 273 | 1.819 | | actual | 687 | 2.718 |
| MZN01 | 426 | 2.111 | | saldos | 592 | 3.388 |
| MZN02 | 158 | 900 | | anterior | 228 | 1.049 |
| MZN03 | 788 | 3.116 | | escolar | 95 | 484 |
| | | | | catálogo | 43 | 307 |
| **Total** | **1.645** | **7.946** | | **Total** | **1.645** | **7.946** |

Son **1.280 artículos**, de los cuales **260 ya están partidos en más de un sitio**. Todo junto
serían unas **27 tareas** de Slotting de 300 pares, pero no se hace de una: la tarea se dispara
**solo cuando llega mercadería de ese código**, así que por noche son los pocos que aparezcan en
el buffer.

**Ocho de esos restos están solos en su cuerpo** —un cuerpo de 300 con 14 pares adentro— y esos
ocho cuerpos se liberarían enteros. **El barrido de hoy no los ve**: solo mira cuerpos con más
de un artículo. Y de los que sí ve, ninguno sale con destino.

**El tamaño del pozo:** de los 2.860 artículos del piso, **1.280 tienen 19 pares o menos**.
Casi la mitad del almacén va a pasar por esta regla tarde o temprano.

**Sin resolver todavía:** los artículos de REPOSICIÓN repartidos en 3 o más cuerpos — hay
**233** — caen bajo el mismo principio de "toda la familia junta", pero por otro camino: esos no
están esperando una llegada que los consolide. Preguntarle a Daniel si quieren tarea propia.

## 5d. EL SALDO GRANDE — `SEL-04`, y ahí se comparte cuerpo

Regla de Daniel, 14-ago-2026. Es la banda que faltaba entre "saldo" y "artículo normal".

> *"Los saldos que son mayores o igual a veinte se enviarán al SEL cuatro. Todo ese selectivo
> puede tener más de un artículo en un cuerpo. Siempre y cuando el saldo sea T. Actual."*

**Las tres condiciones, y tienen que darse las tres:**

| | |
|---|---|
| **Cuánto** | de **20 a 199 pares**. Menos de 20 sigue yendo a `SEL-01` y `SEL-02` |
| **Qué temporada** | **T. Actual**. La anterior tiene su columna y no se mezcla |
| **Dónde** | `SEL-04`, y esa columna **admite varios artículos por cuerpo** |

El corte de arriba lo eligió Daniel el 14-ago sobre los números del piso. Sin tope la regla se
lleva el selectivo entero: los 153 artículos de la franja actual tienen 20 pares o más.

**Por qué existe esta banda.** El corte de los 20 era un acantilado: con 19 pares un artículo
comparte cuerpo, y con 20 se lleva un cuerpo entero de 330. Un artículo de 25 pares ocupando un
cuerpo completo es el desperdicio más caro que tiene el almacén, y de ahí sale buena parte de
los cuerpos que hoy bloquean tareas por falta de espacio.

**Consecuencia que hay que asumir: la columna 4 deja de ser temporada actual.** La franja actual
pasa de 10 columnas a 9 — de 200 cuerpos a 180.

**El balance, medido sobre el stock del 14-ago-2026:**

| | |
|---|---|
| Saldos grandes hoy | **52 artículos, 5.359 pares** |
| Caben en | **17 cuerpos compartidos** de los 20 usables del `SEL-04` |
| Cuerpos que tocan hoy | 38, repartidos por toda la franja actual |
| Cuerpos de la 5-13 que quedan **vacíos** al mudarlos | **17** |
| Hay que sacar del `SEL-04` | 11 artículos grandes, **3.373 pares** ≈ 11 cuerpos |

**Neto: la franja actual pasa de CERO cuerpos libres a unos 6.**

### EL INTERCAMBIO SE PAGA CON SU PROPIO HUECO

Acá había escrito que la mudanza estaba trabada porque los 3.373 pares de la columna 4 no tenían
a dónde ir. **Está mal, y lo corrigió Daniel:**

> *"Claro que hay dónde ponerlos, porque al sacar del selectivo cinco al trece los saldos y
> ponerlos al cuatro, vas a hacer hueco, y en ese hueco va lo que está en el selectivo cuatro."*

**No hacen falta cuerpos vacíos de arranque: los fabrica el mismo movimiento.** Verificado sobre
el stock del 14-ago-2026:

| Paso | Qué pasa |
|---|---|
| **0** | El `SEL-04` ya tiene **679 pares de sitio** en tres cuerpos que hoy llevan solo saldos — `SEL-04-03`, `-04` y `-19` |
| **1** | Con ese sitio se vacían **7 cuerpos** de las columnas 5-13 de una: `SEL-07-01`, `-07-02`, `SEL-10-10`, `-10-16`, `-10-21`, `SEL-05-21`, `SEL-09-01` |
| **2** | Esos huecos reciben lo grande que sale del `SEL-04`, y cada cuerpo que se libera allá da más sitio para el saldo siguiente |
| **3** | Al final se vacían **17 cuerpos** en 5-13 y se necesitan **11** para lo que salió de la 4 |

El más barato de todos es `SEL-07-01` + `SEL-07-02`: son **el mismo artículo partido en dos**
—el `7646807`, con 93 y 16 pares— así que juntarlo en la columna 4 libera dos cuerpos moviendo
109 pares.

**Lo único que importa es el ORDEN: primero el saldo sale de 5-13, después lo grande sale de la
4.** Al revés no arranca.

**EN BETA DESDE LA v29.0214.** Franja `saldoGrande` en `FRANJAS`, corte `saldoGrandeHasta` por
zona, la banda dentro de `franjaDeArticulo` y la franja agregada a `FRANJAS_QUE_COMPARTEN`, todo
en `zonasService.js`. Se edita en Análisis SKU → Zonas de Almacenaje, campo "Saldo grande hasta".
**El `CACHE_KEY` subió a `config_zonas_v6`** — sin eso las PC con caché viejo se quedaban sin el
campo para siempre. La configuración de beta ya está republicada con la columna 4 en la banda
nueva; **la de producción sigue con la 4 en `actual`**.

**Ojo con `saldoMenorA`:** sigue valiendo 20 en el SEL y 80 en los mezzanines, y sigue decidiendo
lo mismo de siempre —quién baja a `SEL-01`/`SEL-02`—. La banda nueva es un segundo corte, no un
reemplazo. Y **por ahora es solo del selectivo**: en los mezzanines no está dictada.

## 6. Por qué va en esa columna

Deciden dos cosas: **de quién es** la columna y **qué temporada lleva**. Valores publicados al
14-ago-2026; misma advertencia que arriba, manda la configuración.

| Marca | Zona | Sus columnas |
|---|---|---|
| Bata | SEL | toda la zona |
| Power | MZN01 | 1 – 9 |
| Bubblegummers | MZN01 | 10 – 23 |
| B.G Licenses | MZN01 | 24 |
| North Star | MZN02 | toda la zona |
| Bata Industrials | MZN03 | 1 – 5 |
| Marie Claire | MZN03 | 6, 7 |
| Skechers | MZN03 | 9 – 11 |
| Adidas | MZN03 | 12 – 15 |
| Puma | MZN03 | 16, 17 |
| Weinbrenner | MZN03 | 18 – 24 |

| Zona | actual | anterior | saldos | otras |
|---|---|---|---|---|
| SEL | **5 – 13** | 3 | 1, 2 (menos de 20 pares) | **saldo grande: 4** · escolar: 14 |
| MZN01 | 4, 7, 8, 10 – 21, 24 | 1, 22 | 2, 3, 23 | |
| MZN02 | 7, 8, 11, 12, 15, 16, 19, 20, 23, 24 | 4 | 1, 2, 3 | |
| MZN03 | 4, 5, 9 – 17, 20 – 24 | 2, 3, 7, 19 | 1, 6, 18 | catálogo: 8 |

**Columnas bloqueadas** (fuera de circulación, ya descontadas arriba): MZN01 la 5, 6 y 9 ·
MZN02 la 5, 6, 9, 10, 13, 14, 17, 18, 21 y 22. **Cuando Daniel dice "fila" quiere decir
COLUMNA.**

**Cuántos cuerpos tiene cada columna:** el selectivo llega a 22 —los cuerpos 11 y 22 de las
columnas 2-13 son el paso del elevador, ya configurado como pasillo—; los mezzanines llegan a
**20**, salvo las columnas 2, 3, 22 y 23 del MZN01 y las 2, 3 y 23 del MZN02, que se quedan en
17. El layout publicado es la fuente de verdad de la forma del almacén.

**B.G Licenses ES Bubblegummers** — la misma marca, solo que la licencia trae dibujitos
licenciados. Su temporada **actual** se queda sola en la 24; su **anterior y sus saldos** van a
las columnas de Bubblegummers. Sin eso no tenían a dónde ir: le toca una sola columna y es de
actual, así que caían en el respaldo y terminaban mezclados con la temporada actual, sin aviso.
Va en la tabla `COMPARTE_COLUMNAS` de `zonasService.js`.

**Marie Claire tiene el problema inverso y sigue abierto:** sus columnas son anterior y saldos,
sin ninguna de actual. Hoy no se dispara porque no tiene nada en el buffer, pero el día que
llegue algo de temporada actual va a caer en el respaldo.

## Un cuerpo, un artículo — y dónde NO aplica

**La exigencia va por FRANJA, no por zona.** Daniel, 14-ago-2026: *"hay que ser bien estricto
con eso, y para no llegar a eso debe respetarse cuerpo-artículo. Todos los cuerpos deberían ser
cuerpo-artículo, salvo los mixtos o las temporadas anteriores o escolar"*.

| Franja | ¿Puede haber varios artículos en un cuerpo? |
|---|---|
| **actual** | **NO.** Es la zona viva de cada marca y donde se pica todo el día |
| anterior | sí — envejecen juntos y no vale un cuerpo cada uno |
| saldos | sí — cientos de artículos de diez pares |
| **saldo grande** (`SEL-04`) | sí — 20 a 199 pares de T. Actual. Ver 5d |
| escolar | sí — curvas cortas y poco volumen por código |
| catálogo | sí — la columna 8 del MZN03 mezcla las tres marcas por diseño |

**En el selectivo eso quiere decir, en concreto** —y conviene tenerlo a mano porque es donde
más se confunde—:

| Columnas | Qué son | |
|---|---|---|
| **1 y 2** | saldos y mixtos — menos de 20 pares | **fuera** del control |
| **3** | temporada anterior — van todas las temporadas anteriores juntas | **fuera** |
| **4** | saldo grande — T. Actual de 20 a 199 pares (ver 5d) | **fuera** |
| **5 a 13** | temporada actual | **acá sí: un cuerpo, un artículo** |
| **14** | escolar | **fuera** |

Medido el 14-ago-2026 sobre el selectivo: hay **110 cuerpos** con más de un artículo, pero
**solo 37 son un problema** — los de las columnas 4 a 13. Los otros 73 están en saldos,
anterior y escolar, donde compartir es como se trabaja. Contarlos todos daría un número que
asusta y que no significa nada.

Vive en `FRANJAS_QUE_COMPARTEN` y `columnaAdmiteVariosArticulos()` de `zonasService.js`. Una
columna que lleva dos franjas comparte si **cualquiera** de las dos lo permite.

**Y si el cuerpo propio de un artículo está sucio, LA TAREA SE BLOQUEA.** No se le busca otro
cuerpo. Daniel, 14-ago-2026: *"lo que tienes que hacer es bloquear la tarea, y ahí tiene que
entrar — para eso están las tareas de slotting. El slotting va, entra, soluciona, y ahí entra
el almacenaje. Así de simple"*.

Es el orden correcto y además el barato: el artículo YA TIENE su cuerpo, lo que sobra es el
intruso. Mudarlo sería gastar un cuerpo vacío —en el MZN01 quedan cinco— para tapar un
problema que se arregla sacando veinte pares. Slotting limpia, y a la noche siguiente la tarea
sale sola y va a su lugar de siempre.

El papel lo imprime con el aviso de Slotting, igual que cualquier otro caso trabado: el
operario no almacena eso.

**Lo que sí es problema aterriza en el módulo de Slotting**, que arma tareas de ~300 pares con
lo que hay que sacar. Ver `cadena-de-modulos`.

## 7. Adidas, Puma y Skechers: el trato aparte

Las tres viven en el mezzanine 3 y se trabajan distinto del resto. Regla de Daniel del
05-ago-2026, y las tres partes van juntas.

### No mandan nada a reserva, llegue lo que llegue

Van con `modo: 'todo'`. **Y eso le gana al caso**: un Puma nuevo caía en la regla del 60% y se
le paletizaba el 40% teniendo cuerpos libres. El único que sigue mandando por encima es el
escolar, porque se pregunta antes.

### El destino es la COLUMNA, no el cuerpo

```
antes    MZN03-13-07, MZN03-13-08, MZN03-14-02, MZN03-14-03...
ahora    MZN03 · ZONA ADIDAS
```

Sus columnas son propias y nadie más entra ahí, así que nombrar el cuerpo no le ahorra un paso
al operario: le llena el papel de renglones. *"La ubicación exacta es muy complicada de que el
operario entienda."*

**Se llegó acá por descarte y el camino conviene no repetirlo.** Primero se probó el rango de
columnas (`MZN03 · Col 12-15`): rechazado, porque el operario lee ubicaciones todo el día y una
que se escribe distinta lo hace frenar. Después la primera columna de la marca (`MZN03-12`), y
ahí Daniel encontró el agujero: si es siempre la primera, **¿cuándo diría 13, 14 o 15? Nunca.**
Y no era teórico — mandaba Skechers a la columna 9, que ese día tenía sus 20 cuerpos ocupados.

Elegir "la columna con más lugar" tampoco va: dentro de su zona el operario ya sabe acomodar, y
una columna calculada envejece mal, porque el papel se imprime a las 19:00 y se trabaja toda la
noche. **La zona de la marca dice todo lo que hace falta y no miente nunca.**

La lista `MARCAS_SIN_CUERPO` va **escrita a mano**, no derivada de "las marcas de modo todo",
aunque hoy sean las mismas tres. Son dos reglas que coinciden por casualidad: una dice CUÁNTO
baja, la otra CÓMO se nombra el destino. Atarlas haría que agregar una marca al modo `'todo'`
le borrara la ubicación exacta sin que nadie lo pidiera.

### Nunca van a Slotting

Si la zona está llena, el papel **manda igual**. El operario almacena lo que entra y lo que
sobra se queda en el buffer hasta la corrida siguiente. *"Tú mandas nada más, y si no entra lo
voy a dejar en buffer. Yo decido qué artículos se quedan."*

### El buffer D queda afuera de todo esto

Lo que llega por catálogo va a la **columna 8** del MZN03, mezclando las tres marcas, y no a las
columnas de la suya. **Un Puma que viene por el D no vuelve a la 16 ni aunque ya viva ahí.** Sin
ese filtro el papel diría `ZONA PUMA`, justo al revés de lo que corresponde.

## 8. Lo que el código TODAVÍA NO HACE

Medido el 14-ago-2026 contra las tareas y el stock de producción. **Están abiertos:**

1. ~~**El corte de los 20 pares no existe.**~~ **RESUELTO EN LA v29.0227** — ver "El día que el
   corte de los 20 se delató solo". `casoDelItem` ahora mide activo + reserva y corta en 20.

   **Lo que queda de este punto:** `casaDe` sigue con su agujero. El corte de 20 está escrito,
   pero **si ningún cuerpo llega a 20 igual le da casa con el más cargado, aunque tenga 1 par**.
   Eso ya no cambia la clasificación —esa la decide el corte nuevo—, pero sí el **destino**: un
   artículo clasificado como código nuevo puede terminar mandado a una casa de un par. Va junto
   con el punto 3.

2. ~~**La reserva no entra en la cuenta.**~~ **RESUELTO EN LA v29.0227**, en el mismo cambio: la
   reserva se lee de `ctx.reservaDe` y suma igual que el piso.

3. **El destino no respeta el camino elegido.** `planificarAlmacenaje` toma el atajo de
   reposición mirando **solo `art.yaTiene`**, sin consultar qué decidió `casoDelItem`. El cálculo
   puede decir "código nuevo, baja el 60%" y mandar igual esos pares al cuerpo viejo del saldo.

4. **Los cuerpos ya prometidos no se marcan ocupados.** El bloque de `cargarContextoSugerencia`
   busca `art.sugerencia`, un dato que **nadie escribe** en todo el proyecto. Lo que sí se graba
   es `i.destino` como texto (`SEL-07-13`). Por eso la segunda corrida de un turno manda otro
   artículo a un cuerpo que la primera ya prometió: el 12-ago las corridas de las 14:01 y las
   00:11 se pisaron en siete cuerpos de la columna 8 del MZN02.

5. **El corte de saldos mide lo que llega, no lo que hay.** `franjaDeArticulo` compara
   `saldoMenorA` contra los pares del buffer.

6. **Al buffer B se le cree por la letra.** La prueba `pares <= enReserva` no filtra: pasan 38
   de 41. Y suma A + B, así que la mercadería de recepción entra como replenishment si el
   artículo tiene aunque sea un par en el B. **La clasificación nuevo/reposición nunca llega a
   hacerse para esos artículos.** Detalle arriba, en "El buffer B NO se cree por la letra".

## Trampas conocidas

- **Las fechas nunca salen de `toISOString()`.** Devuelve UTC y Perú está cinco horas atrás:
  a las 19:00 —cuando entra el turno noche— ya es el día siguiente. Va `getLogicalDate()`, o
  armar el texto con `getFullYear`/`getHours`.
- **Un dato del maestro que falta no se ve como falta:** sale `S/M`, `S/G`, `S/C`. Si una
  tarea dice `S/M`, el artículo no está en el Maestro **publicado en el servidor** — que es
  el que vale, no el `.xlsx` de OneDrive.
- **La talla sale de `extractTalla()` y de ningún otro lado.** Hubo dos expresiones distintas
  —una aceptaba letras y la otra no— y el papel salía con todo al piso y el destino en guion,
  sin ningún aviso. Eran 42 de 187 líneas del buffer.
- **El stock es una foto y envejece.** Se publica a las 19:00 y las tareas nacen a medianoche:
  son cinco horas de turno ya trabajado que el cálculo no ve.
- **Compilar no es probar.** `node --check` no ve un identificador mal escrito dentro de un
  template de HTML. Repasar los nombres nuevos antes de desplegar.
- **El caché de la configuración:** si se agrega un campo con valor de fábrica nuevo, hay que
  subirle la versión a `CACHE_KEY` (`config_zonas_v5`) o las PC con caché viejo se quedan sin
  él para siempre.
- **Republicar la configuración va DESPUÉS del despliegue, nunca antes.** Publicar una
  configuración que el código viejo no entiende es pedir problemas. Al publicar se relee el
  cajón `config` completo y se reemplaza solo la clave propia: comparte lugar con la jornada.
