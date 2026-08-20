---
name: actividades-del-turno
description: Qué mide de verdad cada fila del Cumplimiento del turno (Administración → Actividades) y con qué señal se mide cada una. Úsala antes de tocar fuentesDelTurno, renderActividadesSection o turno_actividades.js, y SIEMPRE que Daniel diga que una fila muestra avance sin que nadie haya trabajado, que un número no cuadra con lo que él vio en el piso, o que el avance "se resetea". Cubre el circuito reserva → bajada → buffer → separación → almacenamiento, por qué la MATRÍCULA es la señal que cuenta, por qué la meta es el plan entero y nunca se toca, y las cinco veces que este mismo cuadro salió mal.
---

# Las actividades del turno

Las dictó Daniel, midiendo el piso. **No son deducibles del código ni de los datos.** Varias
parecen un error hasta que se sabe cómo se trabaja de noche.

**Antes de cambiar una regla de acá, preguntarle.** Y antes de dar por buena una corrección,
**bajar las áreas del servidor y rehacer la cuenta a mano** — es lo único que encontró los
cuatro defectos que este cuadro ya tuvo.

## LA REGLA DE ORO

> **Cada actividad se mide con SU PROPIA señal. Ninguna se mide con la señal de otra.**

Las cuatro veces que este cuadro salió mal fue por lo mismo: **dos filas mirando el mismo
hecho físico.** Si dos actividades suben juntas siempre, una de las dos está mal medida.

La prueba de un minuto: **¿puede esta fila marcar avance sin que nadie haya hecho ESA
actividad?** Si la respuesta es sí, está midiendo el trabajo de otro.

## El circuito físico, que es de donde sale todo

```
RESERVA (selectivo, nivel alto)
   │   el montacarguista baja la paleta          ──► actividad: BAJADA DE PALETAS
   ▼
ZONA DE TRABAJO / BUFFER
   │   los chicos abren la paleta, sacan SOLO
   │   lo que el plan pidió y lo matriculan      ──► actividad: SEPARACIÓN DE MERCADERÍA
   │   (el resto de la paleta vuelve arriba)
   ▼
BUFFER, ya matriculado (normalmente el C o el B)
   │   de ahí sale a su ubicación definitiva     ──► actividad: ALMACENAMIENTO
   ▼
MEZZANINE / SELECTIVO / ANDAMIO
```

**Bajar la paleta NO es separarla.** Son dos actividades distintas, con dos horarios distintos
y dos equipos distintos. Daniel, 20-ago-2026:

> *"Trabajamos una paleta, un ejemplo de doscientos pares, y solo separamos veinte. Por eso se
> llama separación, ¿no crees? Porque si yo matriculara todo, entonces ya solo sería una
> bajada nada más."*

## LA MATRÍCULA ES LA QUE CUENTA — el filtro que faltaba

> *"Yo lo puedo matricular en el C o en el B. Normalmente lo hacemos en el C o en el B. Sí, eso
> debería sumar."* — Daniel, 20-ago-2026

**Mientras la paleta está bajada pero sin trabajar, no figura en NINGUNA ubicación del buffer.**
El reporte de stock la ve recién cuando se matricula. Por eso la matrícula es la señal que
distingue "bajaron la paleta" de "hicieron el trabajo".

**El avance de la separación es:**

```
min( lo que pide el plan , lo que bajó de reserva , lo que se matriculó en el buffer )
```

- **Filtro 1 — que venga de reserva.** Un movimiento del mismo SKU que no bajó de arriba no
  es separación.
- **Filtro 2 — que el SKU esté en el plan** del análisis del buffer.
- **Filtro 3 — que esté matriculado**, o sea que aparezca en una ubicación `CDBUFFER-*`.

Con los tres, al abrir el turno da **cero** —que era el reclamo— y sube cuando el trabajo
existe de verdad. **Con solo los dos primeros, esta fila es una copia de Bajada de paletas**:
las mismas 46 paletas alimentaban las dos filas la noche del 19-ago.

## LA META ES EL PLAN ENTERO. NO SE TOCA.

> *"La zona buffer dice que tengo que bajar 2.398, eso debería ser mi meta."*

**Prepack incluido.** El 20-ago saqué el prepack de la meta por mi cuenta —nadie me lo pidió—
y el turno quedó mostrando 0 de 1.469: el trabajo de la noche desaparecido y Daniel sin nada
que reportar. *"¿O sea las paletas que matriculé en el buffer C no sirven de nada?"*

**Prepack y SolidPack se trabajan distinto, pero los dos cuentan:**

| | Cómo se trabaja | ¿Cuenta en la separación? |
|---|---|---|
| **Prepack** (`0000000-0-00000`) | Baja y **se matricula la paleta completa**, no se abre | **SÍ**, al matricularla |
| **SolidPack** (`0000000-0-00`) | Baja, se abre y se separa lo que el plan pidió | **SÍ**, al matricular lo separado |

*"En el prepack, paleta que se baja no se separa: se matricula paleta completa en el buffer C.
En el solidpack sí separamos."* — la diferencia es **cómo** se trabaja, no **si** cuenta.

**Nunca cambiar una meta sin que Daniel lo pida.** La meta es lo que le manda la Zona Buffer y
es contra eso que él reporta.

## UN TURNO NUEVO ARRANCA TODO EN CERO

> *"Cuando el turno cierre deberían todas las metas y avances estar en 0."*

La plantilla `BASE` de `turno_actividades.js` **no inventa números**. Traía Slotting con
`meta: 60, av: 45` desde la maqueta, así que cada jornada nueva nacía con 45 de 60 hechos sin
que nadie hubiera trabajado — y como la meta se congela apenas tiene un valor, ese 60 se
quedaba fijo. Corregido en v29.0298.

## Qué mide cada fila, y de dónde sale

| Actividad | Meta | Avance | Fuente |
|---|---|---|---|
| Charla de seguridad | — | — | solo Gantt |
| **Almacenamiento** | BUFFER | TOTAL | `datosMarcas(...).granTotal` sobre las tareas finalizadas |
| **Slotting** | a mano | a mano | no hay fuente: el stock no trae usuario |
| **Limpieza de Buffer C** | lo que había en el C al arrancar | `min(lo que bajó del C, lo que subió fuera del C)` | `buffer_c_arranque` vs `layout_stock_hora` |
| **Bajada de paletas** | `plan.paletas` | paletas pedidas que ya no están arriba **o tienen menos pares** | `analisis_sku_reserva` vs `reserva_hora` |
| **Separación de mercadería** | el plan entero, prepack incluido | `min(plan, bajó de reserva, matriculado en el buffer)` | `analisis_sku_reserva` vs `reserva_hora`, y `almacenaje_activo` vs `layout_stock_hora` para el buffer |
| BPA | — | — | solo Gantt |

**Una paleta no se vacía**: se baja, se le sacan las cajas del plan y vuelve arriba. Por eso la
bajada cuenta también las que siguen arriba con menos pares — si no, de 164 se veían 47.

**Si una fuente falta, la fila queda SIN NÚMERO y editable.** Nunca un cero, que se lee como
trabajo no hecho.

## Las cuatro veces que salió mal — no repetirlas

| | Qué se creyó | Qué era |
|---|---|---|
| **v29.0236** 17-ago | "lo separado es lo que subió en el activo" | Medía en TODAS las ubicaciones contra una base que era solo zonas de picking. **Las dos puntas de la resta no medían lo mismo** |
| **v29.0243** 18-ago | faltaba exigir que bajara de reserva | Cierto, pero incompleto |
| **v29.0248** 18-ago | "separado es lo que bajó de reserva" | **Convirtió la separación en una copia de la bajada de paletas.** Las mismas 46 paletas alimentaban las dos filas |
| **v29.0296** 20-ago | "el prepack no se separa, fuera de la meta" | **Mío, y Daniel no lo pidió.** Dejó la noche en 0 de 1.469 y el trabajo hecho invisible |
| **v29.0297** 20-ago | — | Faltaba el tercer filtro: **que esté matriculado**. Meta 2.398, avance 512 |

**El síntoma siempre fue el mismo** y Daniel lo dijo con las mismas palabras las cuatro veces:
*"al comenzar el turno ya tenía mercadería separada y no se había bajado ni una paleta"*.

## Dos trampas que valen para CUALQUIER cuadro medido con dos fotos

**1. Las dos puntas tienen que estar DENTRO de la jornada que se mide.** A las 07:00 la corrida
de la mañana reemplaza `layout_stock_hora`, `reserva_hora` y `analisis_sku_reserva`. Sin
descartar la foto posterior al cierre, a las 07:20 la noche del 17 se medía contra el almacén
de esa mañana. Esa fue la causa de raíz del "se resetea".

**2. Restar totales no sirve.** Entra mercadería nueva mientras se trabaja. El Buffer C cerró
una noche con MÁS de lo que empezó y la resta daba −61 cuando el equipo había sacado 869.

## EL AVANCE NO RETROCEDE — así que un número inflado NO se corrige solo

El avance se queda con el máximo alcanzado. **Después de arreglar una regla, el número malo
sigue guardado.** Hay que reescribirlo a mano en `turno_actividades?date=AAAA-MM-DD`,
releyendo el área y reemplazando solo el `av` de esa actividad.

Y **desplegar no es que él lo vea**: la pantalla vieja sigue guardando. Pedir **Ctrl+F5** en
todas las PC. Para saber si una PC está calculando con la regla vieja, comparar el número
guardado contra lo que da cada regla.

## Cómo se comprueba — el único método que ha funcionado

Bajar las áreas del servidor y rehacer la cuenta con las reglas candidatas, **antes** de tocar
código:

```
plan_buffer            el plan: codigos[], paletas[], porPaleta[]
analisis_sku_reserva   la reserva del arranque, con LPN y PRODUCTO
reserva_hora           la reserva de ahora
layout_stock_hora      el activo de ahora (NO trae LPN)
almacenaje_activo      durante la noche ES la foto de las 19:00
turno_actividades?date=AAAA-MM-DD    lo que quedó guardado
```

`https://logistics-backend-wv0x.onrender.com/api/logistics/<area>`

**Dos pruebas, no una:**

1. Que con los datos reales dé lo que Daniel dice que pasó.
2. **Que simulando trabajo real el número SÍ suba.** Un cero fijo también "arregla" el
   síntoma. El 20-ago se simuló separar tres paletas SolidPack del plan y el avance dio 161
   exactos.

## Errores comunes

- **Creer que "llegó al buffer" y "bajó de reserva" son señales distintas.** Medidas entre dos
  fotos lejanas dan lo mismo; se separan solo en los momentos intermedios.
- **Buscar la matriculación en el stock.** `layout_stock_hora` trae Área, Artículo, Ubicación y
  Cantidad — **no trae LPN**. Hoy no se puede distinguir una paleta tirada en el buffer de una
  ya matriculada.
- **Contar una paleta que nadie pidió.** Con `porPaleta` cargado, una paleta fuera del plan
  cuenta CERO: no es trabajo del plan.
- **Tocar la meta.** Es lo que le manda la Zona Buffer y es contra eso que él reporta. Si algo
  del plan no se puede cumplir, se dice al lado — **no se le achica la meta**.
- **Confundir "no se separa" con "no cuenta".** El prepack no se abre, pero matricularlo es
  trabajo del turno y suma.

Ver [[reporte-turno-actividades]], [[circuito-reposicion]] y el skill `reglas-almacenaje`.
