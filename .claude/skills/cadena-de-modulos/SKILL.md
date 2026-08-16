---
name: cadena-de-modulos
description: Cómo se encadenan los módulos de la operación —Pedidos, Otras Solicitudes, Replenishment, Análisis Buffer, Procesar Tareas y Slotting— y por qué ninguno puede decidir por su cuenta ni contradecir al anterior. Úsala antes de tocar el motor del buffer (csvHub_v6.js), processAlmacenajeTasks, el Replenishment o la configuración de topes, y siempre que un módulo vaya a recalcular, corregir o revertir algo que otro módulo ya decidió. También cuando un número no cuadre entre dos pantallas.
---

# La cadena de módulos

Regla de arquitectura dictada por Daniel el 14-ago-2026. **No es una preferencia de diseño:
es cómo funciona la operación**, y romperla se paga en el piso.

> *"Un módulo no es independiente. Todos dependen de alguno. Un módulo no puede decidir por
> sí solo y no puede contradecir lo que otro módulo diga."*

## 1. Para qué existe todo esto

**El operario no tiene que pensar en nada.** Su ruta es la hoja de tareas, y la hoja le tiene
que decir cinco cosas:

```
de dónde sacar  ·  qué sacar  ·  cuánto sacar  ·  qué talla sacar  ·  dónde ponerlo
```

Simple como eso. Todo lo demás —los factores, los topes, las capacidades, las franjas, los
cuerpos libres— existe para que esas cinco casillas salgan bien y **el sistema lo monitoree
todo**. Si el operario tiene que decidir algo, es que un módulo de la cadena no hizo su parte.

Cuando evalúes un cambio, la pregunta es siempre la misma: **¿esto le agrega o le quita una
decisión al operario?**

## 2. La cadena, en orden

```
  Pedidos (comercial)  ─┐
  Otras Solicitudes    ─┼──►  ANÁLISIS BUFFER  ──►  PROCESAR TAREAS  ──►  hoja del operario
  Replenishment        ─┘      qué baja y cuánto     dónde va y cuánto           │
        ▲                                                     │                  │
        │                                                     ▼                  ▼
   Topes / Factores                                       SLOTTING          el operario
   (Análisis SKU)                                    cuerpos por revisar        ejecuta
```

| Módulo | Qué decide | De qué depende | Dónde vive |
|---|---|---|---|
| **Pedidos** | qué pide comercial | llega por correo, se carga a mano | Zona Buffer → Archivo |
| **Otras Solicitudes** | pedidos que no vienen de comercial | carga manual: SKU y cantidad | Zona Buffer → Archivo |
| **Replenishment** | qué reponer y cuánto, para lo que nadie pidió | de los **topes** de Análisis SKU | Análisis SKU → Replenishment |
| **Análisis Buffer** | **qué baja de reserva y cuánto** | de los tres de arriba | Zona Buffer → Análisis Buffer |
| **Procesar Tareas** | dónde poner lo que ya está en el buffer | del buffer, del stock y de las zonas | Almacenaje → Tareas Día |
| **Slotting** | qué hacer con lo que no tiene lugar | de Procesar Tareas | módulo principal (14-ago-2026) |

**Procesar Tareas solo EJECUTA.** No vuelve a decidir qué bajar: eso ya se decidió antes.

## 3. La regla de la posta

**Un módulo recibe una decisión tomada y no la revisa.** La afina, la ejecuta o la traduce a
otra unidad, pero no la contradice.

### El ejemplo canónico, y por qué duele

Daniel, textual:

> *"El replenishment me hace bajar tanta cantidad de paletas. Cuando yo proceso tareas, no me
> puede decir que lo vuelva a subir. No me puede decir que de los quinientos pares que bajé de
> reposición, baje trescientos y doscientos suba. Ese es un error de lógica, un error de ruta."*

El montacarguista bajó 500 pares porque una talla estaba por quebrar. Si la tarea devuelve 200
al rack: **el trabajo se paga dos veces y la talla sigue quebrada.** Medido sobre el buffer del
04-ago-2026: de los 6.993 pares parados en `CDBUFFER-B` volvían arriba 4.520, el **65%**.

**Cómo está resuelto hoy:** la sub-zona del buffer dice de dónde vino la mercadería, y
`casoDelItem` lo respeta. `CDBUFFER-B` significa "bajó de reserva" → **todo al piso**, sin
recalcular nada.

**La única salvaguarda permitida es de integridad, no de criterio.** Se puede preguntar *"¿esto
de verdad bajó de arriba?"*, porque el buffer A se llena y recepción mete mercadería nueva en el
B. La cuenta que lo destapa: **lo que baja de reserva no puede ser más de lo que había en
reserva**. Si llega más, entró por la puerta. Eso NO es contradecir al módulo anterior — es
detectar que el dato no viene de él.

## 4. Quién manda cuando dos módulos piden lo mismo

En `csvHub_v6.js`, al consolidar la demanda:

| Caso | Quién manda |
|---|---|
| El SKU tiene **Pedidos** y/o **Otras Solicitudes** | se **suman** las dos, y **Replenishment se ignora por completo** |
| El SKU **solo** aparece en Replenishment | manda Replenishment, y el buffer respeta su número tal cual |

La razón: si comercial ya pidió una cantidad, esa cantidad es la verdad. Sumarle encima la
reposición automática bajaría de más.

En una misma paleta viajan los dos tipos —comercial pide una talla y las otras van por
reposición— y no se pisan.

**El colchón del buffer** para lo que comercial pide sale del **mismo factor** que usa
Replenishment, con la misma cascada (excepción del SKU → marca+género+talla → género+talla).
Usar otra fuente los desincronizaría.

## 5. Qué NO debe saber cada módulo

Tan importante como la posta: **un módulo que duplica la lógica de otro se desincroniza**.
La primera vez que los dos números se separen, nadie va a saber cuál creer.

| Módulo | NO debe saber |
|---|---|
| **Análisis Buffer** | *(ver abajo: SÍ sabe de cuerpos)* |
| **Replenishment** | dónde se va a guardar. Solo dice qué y cuánto |
| **Procesar Tareas** | por qué bajó esa mercadería. Solo dónde ponerla |
| **La hoja del operario** | nada del cálculo. Solo las cinco casillas |

### El Análisis Buffer SÍ sabe de cuerpos, y tiene que saber

Acá había una regla mal escrita —*"el buffer no sabe de cuerpos y así debe quedar"*— que Daniel
corrigió el 14-ago-2026 con el caso completo:

> *"Comercial le manda cien pares. Analiza el stock activo y encuentra cincuenta, dice: me
> faltan cincuenta para llegar a los cien, entonces lo busco en reserva. Y cuando lo encuentra
> no baja solamente cincuenta: va a bajar cincuenta más su tope de esa serie y de esa marca.
> Pero ahí tiene que calcular que su tope tampoco rebalse el cuerpo, los dos cuerpos."*

Y el porqué de fondo, que es lo que lo cierra: **el pedido de comercial también es una
reposición**. Un código nuevo nunca se manda entero a reserva — baja el 60% al activo y el 40%
queda arriba. Ese 40% es justo lo que el Análisis Buffer va bajando de a poco. Cuando el activo
se agota empieza a tirar de la reserva, y ahí hay que **llenar dos cuerpos**.

Un buffer que ignora el cuerpo baja números que dejan cuerpos a medias, y **un cuerpo ocupado
al 10% bloquea las tareas de mañana por falta de espacio**. Medido el 14-ago: 15 artículos
dejaban un cuerpo a menos de la mitad, varios al 2%.

**El peligro real no era el conocimiento, era la DUPLICACIÓN.** El buffer tiene que leer la
capacidad y las franjas de la **misma configuración** que usa el almacenaje —`zonasService`—,
nunca de una copia propia. Dos tablas de capacidad se separan a la primera, y el día que pase
nadie va a saber cuál creer.

## 6. Vocabulario que no se puede mezclar

Mezclar estas palabras costó varias vueltas:

| Palabra | Qué es | Dónde vive |
|---|---|---|
| **TOPE** | el máximo que debe haber en el piso de un SKU | Análisis SKU → Configuración Análisis |
| **FACTOR** | cuántos pares trae una caja cerrada (10; 20 o 40 en ojotas) | `tallasService.js` |
| **CAPACIDAD** | cuántos pares entran en un cuerpo, por serie y zona | configuración de zonas |

**El tope NO es lo que se baja.** Con tope 150 y 50 abajo se bajan 100, aunque arriba haya 500.
Y si arriba solo hay 50, se bajan 50: **nunca se inventa stock**.

Dos números distintos y hacen falta los dos:

| | Fórmula | Para qué |
|---|---|---|
| **A BAJAR** | `min(tope − activo, reserva)` | lo que mueve el montacarguista |
| **SOLICITUD** | `activo + a bajar` | lo que se le pide a la Zona Buffer |

La solicitud no es el tope: es el tope **recortado a lo que existe**. Pidiendo el tope entero
cuando no hay stock, se reporta como faltante algo que sencillamente no existe.

**Ojo:** adentro del código varios nombres todavía dicen "factor" donde el producto ya dice
TOPE (`_publicarFactores`, `hojaFactores`, `i.factor`). Son internos.

## 7. La cuenta que tiene que cerrar

> **Si el buffer tiene veinte mil, las tareas suman veinte mil. Ni de más ni de menos.**

De ahí salen tres comportamientos de `processAlmacenajeTasks` que parecen agresivos y no lo son:

1. **Se vencen primero las viejas**, después se cuenta. Si una Creada de hace tres días siguiera
   contando como comprometida, su stock quedaría bloqueado y no entraría en la ola de esta noche.
2. **Una Creada no se arrastra**: lo que no se trabajó en el turno se cierra y la ola nueva se
   arma con el stock de este momento. *"Si hay diez tareas y solamente avancé dos, las ocho que
   quedan creadas se cambian de estado al momento que yo procese tareas."*
3. **Las Asignadas NO se tocan.** Alguien las está trabajando con la hoja en la mano y su
   mercadería sigue en el buffer; el descuento de `yaComprometido` las cuenta, así que no se
   duplican.

Y el orden importa: **vencer → cerrar → ajustar → contar**. Cambiarlo rompe la cuenta.

## 8. Dónde la cadena está rota hoy

Medido el 14-ago-2026 contra producción.

### Slotting YA EXISTE (14-ago-2026) — lo que falta es el resto de los hallazgos

Se construyó como **módulo principal**, no colgado de Inventario: no es una vista de consulta,
es donde el equipo trabaja. Vive en `js/services_v245/slottingService.js` (guardar, leer,
contar), `js/views/slotting.js` (la pantalla) y el barrido en `dashboard_v28.js`.

**Recibe la posta sola.** Al procesar tareas se barre el almacén entero y se registran los
cuerpos con más de un artículo donde la franja pide uno solo. Va en un `try` aparte: si
Slotting falla, las tareas ya están creadas y el turno trabaja igual.

**El barrido es del almacén completo, no de lo que llegó al buffer.** Los cuerpos que nadie va
a tocar en meses son justamente los que se quedan mezclados para siempre, y solo aparecen
barriendo todo. Sobre el stock del 14-ago encontraba 284.

**Lo que la persona escribe no se pisa nunca:** al volver a registrar un hallazgo se actualiza
lo que cambia solo —cuándo se vio, cuántas veces, qué hay adentro— y nunca el estado ni la
nota. Con una excepción: si estaba **resuelto** y vuelve a aparecer, **vuelve a pendiente** —
dejarlo en resuelto sería mentir.

### El segundo tipo de hallazgo YA LLEGA — v29.0231, 15-ago-2026

Era el que más rendía y estaba sin hacer: el papel de almacenaje imprimía **"Revisar Slotting"**
y ahí moría. Slotting armaba su corrida barriendo cuerpos mezclados y **nunca se enteraba de que
había mercadería parada esperándolo**. Medido sobre la corrida del 15-ago-2026: **18 artículos y
9.241 pares** parados, contra 9 tareas de Slotting que no tenían relación con ninguno de ellos.

**Lo primero que faltaba no era el aviso: era el MOTIVO.** Se perdía. Ni el operario ni Slotting
sabían si el cuerpo estaba sucio, si no quedaban cuerpos libres o si la marca no tenía columnas
— tanto que al querer reconstruir por qué se trabó la Tarea 25 de esa noche **no se pudo**. Ahora
se graba en el artículo de la tarea, campo `traba`: motivo, pares parados, cuerpo y quién está
adentro.

**Los dos casos van distinto, y la diferencia importa:**

| Traba | Qué produce | Por qué |
|---|---|---|
| **cuerpo sucio** | tarea de Slotting de verdad, con líneas y destino | se sabe exactamente qué sacar |
| **sin lugar** | aviso en la cabecera de la corrida | no hay un cuerpo puntual que limpiar: hay que liberar cualquiera de la franja |

**Lo que ordena la prioridad son los PARES PARADOS.** Mover 269 pares para destrabar 2.982 no es
lo mismo que una mezcla común de 40 que no destraba nada, y en la lista las dos se veían igual.

**No se duplica:** si el barrido ya encontró esa línea por su cuenta, se le agrega la prioridad
en vez de agregar otra. El operario no puede recibir dos veces la misma mercadería.

**Se ve en tres lugares**, y los tres hacen falta —Daniel, 15-ago-2026: *"si él no ve que diga
prioridad en rojo, él no va a imprimir la hoja"*—: cartel arriba del cuadro, la palabra
`PRIORIDAD` en rojo al costado del número de tarea **en la misma línea** (no en dos renglones, y
sin repetirlo en la columna Estado), y el mismo cartel en la hoja impresa, porque la hoja viaja
sola y quien la recibe no vio la pantalla.

**LO QUE SIGUE ABIERTO: las zonas.** Solo entran las trabas de las zonas que Slotting tiene
configuradas —hoy el selectivo—. De los 18 trabados del 15-ago habrían entrado **2**; los otros
16 son de los mezzanines. Se amplía tildando la zona en Configuración de Slotting, sin tocar
código, pero **los mezzanines todavía no tienen reglas propias de Slotting**.

### Y la posta de vuelta también llega — v29.0232, 15-ago-2026

Slotting le avisa a almacenaje que ya lo resolvió, y la tarea trabada se puede rehacer esa misma
noche en vez de esperar a la corrida de mañana. Antes se perdía el turno entero: el 15-ago
fueron **9.241 pares** parados hasta el día siguiente.

**NO HACE FALTA NINGÚN DATO NUEVO NI ESPERAR EL CORTE DE STOCK.** La tarea de Slotting ya dice
qué artículo se sacó de qué cuerpo; con marcarla **Finalizada** alcanza. Sobre la foto de las
19:00 se descuenta eso y recién ahí se decide — `cuerposLimpiadosPorSlotting()`, que se le pasa
a `cargarContextoSugerencia`.

Con el `SEL-04-21` de esa noche: la foto dice 573 pares —304 del `6116913`, 171 del `5516327` y
98 del `5513311`—; la tarea de Slotting finalizada dice que salieron los dos últimos, así que
almacenaje trabaja con 304 y el cuerpo queda limpio.

**TIENEN QUE HABER SALIDO TODOS LOS INTRUSOS.** No alcanza con que el cuerpo aparezca en una
tarea de Slotting: si sacaron uno de dos, el cuerpo sigue sucio y la tarea sigue bloqueada.

**En pantalla va todo dentro de la fila** —Daniel, 15-ago-2026: *"está muy acumulado de
botones"*, sobre poner un botón en la cabecera—:

| Estado | Cómo se ve |
|---|---|
| Slotting no lo resolvió | `BLOQUEADA` en rojo, fila roja suave, **sin** impresora |
| Slotting lo resolvió | `REIMPRIMIR` en verde, fila verde suave, **aparece** la impresora |

El ícono no está mientras no haya lugar, a propósito: apretarlo no haría nada y enseñaría a
apretarlo en vano. La fila cambia sola, sin recargar.

**Al apretar se recalcula la tarea ENTERA** con el almacén de ese momento, no solo el cuerpo que
faltaba: si mientras tanto picking vació otro mejor, la tarea lo aprovecha. Y sale **una sola
hoja** — las demás ya están impresas y en manos de alguien.

**LO QUE TODAVÍA NO CIERRA:** esto cubre las trabas por **cuerpo sucio**. Las de **sin lugar**
—no quedaba ningún cuerpo libre en la franja— siguen sin ícono, porque no hay un cuerpo puntual
del que depender. Y los otros dos cruces del cuadro de abajo siguen abiertos: nadie sabe lo que
picking sacó en el turno, ni lo que Slotting ejecutó vuelve a la foto hasta que el robot publique.

### Y falta el tercero: ARRASTRAR EL RESTO — y este viene CON DESTINO

Regla de Daniel, 14-ago-2026. Cuando el almacenaje trata un código como nuevo —19 pares o menos
en el almacén— y le asigna cuerpos, **todo lo que ese artículo tenga en cualquier otro lado del
piso se convierte en una línea de Slotting: moverlo al cuerpo nuevo**. La franja de donde sale
no importa —saldos, anterior, escolar, catálogo o actual—: *"debería estar todo junto"*. Son
1.645 restos y 7.946 pares medidos al 14-ago; el detalle en `reglas-almacenaje` sección 5c.

**EN BETA DESDE LA v29.0214.** Es la posta de Procesar Tareas a Slotting y ahora llega completa:
la línea del arrastre lleva `llevarA` con el cuerpo de destino, así que el operario no decide
nada —la pregunta 2 de la sección 9—. Las líneas del cuerpo mezclado siguen sin destino a
propósito: ahí el equipo elige.

Y hay una dependencia de orden que no se puede romper: **el destino existe recién cuando la
tarea de almacenaje eligió los cuerpos**, así que el barrido de Slotting corre DESPUÉS de armar
las tareas de la noche, no antes.

### Cómo era antes, y por qué se construyó

El papel imprime **"Revisar Slotting"** cuando un artículo no tiene dónde ir, y **no hay ningún
módulo donde eso aterrice**. Ni pantalla, ni maqueta, ni registro: el hallazgo se pierde y el
problema reaparece la noche siguiente igual.

Es el eslabón que más rinde de todos, porque **el sistema ya sabe a las 19:00 lo que hoy se
descubre a las 02:00 con el operario parado en el pasillo**. Ocho horas antes, y Slotting puede
hacer el espacio al día siguiente.

Lo que ya tendría que aterrizar ahí: los códigos del buffer sin cuerpo libre (continuo, cada
noche), los cuerpos con 3 o más artículos —hoy solo el 57% del selectivo cumple "un cuerpo, un
artículo"— y la mercadería mal ubicada que el cálculo detecta de paso. Daniel lo quiere en la
pestaña **Inventario**, con **estado y porcentaje de avance**: *"100 cuerpos por revisar,
hicieron 60 → 60% hoy"*. El módulo tiene que aguantar tipos de hallazgo nuevos sin rehacerse.

### NINGÚN MÓDULO SABE LO QUE SE MUEVE — el agujero de fondo

Regla de Daniel, 14-ago-2026, y es la que ordena todas las de abajo:

> *"Slotting, así como los demás módulos, debe enterarse de qué es lo que hacen los otros
> módulos. Todos los módulos deben estar sincronizados, sabiendo lo que se mueve: ingresos o
> salidas."*

**Hoy cada módulo decide contra la foto de stock de las 19:00**, y esa foto no sabe nada de lo
que pasó después. Todo lo que se movió en el turno —lo que el almacenaje bajó, lo que picking
sacó, lo que Slotting mudó— es invisible hasta que el robot publique la foto siguiente.

**Los cuatro cruces que faltan, en orden de lo que duelen:**

| Quién | Tiene que saber de | Qué pasa hoy |
|---|---|---|
| **Slotting** | los cuerpos que **Procesar Tareas** prometió esa noche | manda un intruso a un cuerpo que la tarea de almacenaje ya reservó, y los dos llegan al mismo lugar |
| **Procesar Tareas** | los cuerpos que **Slotting** va a liberar | los ve ocupados y deriva a Slotting habiendo lugar mañana — el huevo y la gallina que trabó la tarea de Bata |
| **Los dos** | lo que **picking** sacó en el turno | un cuerpo puede estar vacío desde las 23:00 y el cálculo de medianoche lo cree lleno |
| **La foto siguiente** | lo que **Slotting** ya ejecutó | entre que se ejecuta y el robot publica, el barrido vuelve a encontrar el mismo hallazgo |

**La pieza que falta es una sola: un registro de MOVIMIENTOS COMPROMETIDOS**, con lo que cada
módulo mandó mover y todavía no se refleja en el stock. Sobre la foto se le suman las entradas y
se le restan las salidas, y recién sobre ese resultado se decide. Es la misma forma que ya se
usó para el Replenishment —publicar la corrida en vez de adivinarla— aplicada a las ubicaciones.

**El parche que hay hoy no alcanza:** `destinosDeLasTareas()` lee los destinos grabados en las
tareas, pero solo eso —ni las salidas de picking, ni lo ejecutado de Slotting— y encima
`cargarContextoSugerencia` **solo mira las tareas no Finalizadas**, así que una tarea trabajada a
las 23:00 desaparece de la cuenta justo cuando su mercadería ya está en el cuerpo.

### NADA QUEDA A CRITERIO DEL OPERARIO

Daniel, 14-ago-2026: *"nada debe quedar a criterio del operario, el sistema lo debe controlar
todo"*. Vale para la hoja de Slotting igual que para la de almacenaje: **toda línea sale con su
cuerpo de destino**, no solo las del arrastre.

**Y se puede.** Medido sobre el selectivo con el stock del 14-ago-2026, las **51 líneas** del
barrido encuentran destino con las reglas que ya existen:

| A dónde va | Líneas | Pares |
|---|---|---|
| a su propio cuerpo — junta la familia | 23 | 1.211 |
| a la columna de **saldo grande** (`SEL-04`) | 25 | 1.759 |
| a la columna de saldos | 3 | 41 |
| **sin lugar** | **0** | **0** |

**La banda del saldo grande es lo que lo hace posible.** Sin ella, los 25 intrusos de 20 a 199
pares pedían un cuerpo entero de la franja actual, y ahí no hay ninguno libre.

Si alguna vez una línea no tiene destino, **no sale en el papel**: queda retenida hasta que lo
tenga. Una línea sin destino le devuelve la decisión al operario, que es justo lo que no se puede.

### Procesar Tareas no se pasa la posta a sí mismo

Los cuerpos que una tarea ya prometió **no se marcan como ocupados** para la corrida siguiente:
el bloque que debería hacerlo busca un dato que nadie escribe. Y tiene un segundo hueco, más
profundo: **solo mira las tareas que no están Finalizadas**. Una tarea trabajada a las 23:00 ya
puso su mercadería en el cuerpo, pero eso no aparece en la foto de stock hasta que el robot
vuelva a publicar, y al estar Finalizada tampoco se la cuenta como ocupante.

**La foto de stock no es la verdad del momento.** Se publica a las 19:00 y las tareas nacen a
medianoche: cinco horas de turno ya trabajado que el cálculo no ve. Cualquier módulo que decida
sobre ocupación tiene que sumarle a la foto **lo que las tareas ya movieron**.

### El pedido de comercial entra a mano

Llega por correo y se carga a mano en Zona Buffer. Es el único eslabón de la cadena que depende
de que una persona no se olvide.

### Replenishment le pasa la posta al buffer en un Excel, a mano

Hoy: se procesa Replenishment → se descarga un Excel → **Daniel lo sube a mano** al Análisis
Buffer. El buffer recibe SKU y cantidad y **no sabe que eso vino de Replenishment**: es una
lista de números sin remitente.

De ahí sale el problema del buffer B: como el buffer no sabe qué mandó bajar Replenishment,
Procesar Tareas tiene que **adivinarlo por la letra de la ubicación**, y esa adivinanza no
filtra nada (ver `reglas-almacenaje`).

**Lo que corresponde, acordado con Daniel el 14-ago-2026:** al procesar Replenishment, **una
copia va al servidor**. El Análisis Buffer lo trae desde ahí con un botón —*"¿quieres traer el
Replenishment para procesarlo?"*— en vez de importar el Excel.

**Y va con pregunta, no automático. La razón es operativa y hay que respetarla:**

> *"Actualmente no lo puedo hacer porque no tengo mucho espacio en el almacén, y solo le doy
> prioridad al archivo de pedidos de comercial nada más, porque es lo que sí o sí tenemos que
> despachar. Y se está quedando muchas cosas en replenishment, esos SKU por quebrar o peor aún
> quebrados."*

Lo normal sería procesar los tres juntos —pedidos de comercial, Replenishment y otras
solicitudes—. Hoy no se puede: **falta espacio**, así que se baja solo lo que hay que
despachar y la reposición se posterga. **El costo es visible: SKU por quebrar y quebrados.**

Un botón que traiga el Replenishment cuando se lo pide, y no siempre, es lo que refleja cómo se
trabaja de verdad. Automatizarlo entero le sacaría a Daniel una decisión que hoy tiene que
tomar sí o sí.

**Esa misma pieza cierra dos cosas a la vez:** saca el paso manual del Excel, y le da al buffer
—y a Procesar Tareas detrás— **la certeza de qué bajó por reposición**, que es justo lo que hoy
se adivina mal.

**Otras Solicitudes no necesita nada de esto:** llega cada varias semanas y la carga es rápida.

**Lo que queda registrado, además, tiene valor propio:** con las corridas de Replenishment
guardadas se puede ver **qué se mandó bajar y nunca se bajó** — que es exactamente la lista de
lo que está quebrando por falta de espacio.

## 9. Cómo evaluar un cambio en cualquiera de estos módulos

Antes de escribir código, cuatro preguntas:

1. **¿Este módulo está decidiendo algo que ya decidió otro?** Si sí, no es una mejora: es una
   contradicción esperando salir en un papel.
2. **¿Le agrega una decisión al operario?** La hoja tiene cinco casillas y ninguna se llama
   "criterio".
3. **¿Duplica un dato o una fórmula que vive en otro módulo?** Los dos números se van a separar,
   y el día que pase nadie va a saber cuál creer.
4. **¿Qué módulo recibe la posta después de este, y le está llegando completa?** Si el resultado
   incluye un "revisar", tiene que haber un lugar donde ese revisar aterrice.

Las reglas de negocio del almacenaje —cuánto baja, dónde va, capacidades, columnas— están en el
skill **`reglas-almacenaje`**, que es el que manda sobre el contenido. Este cubre cómo se
encadenan los módulos entre sí.
