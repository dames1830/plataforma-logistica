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

**Falta el segundo tipo de hallazgo:** los códigos que llegan al buffer y **no tienen dónde ir**.
El tipo ya está declarado (`sin_lugar`) pero nadie lo registra todavía. Es el que más rinde,
porque el sistema lo sabe a las 19:00 y hoy se descubre a las 02:00 con el operario parado en
el pasillo.

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
