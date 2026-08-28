/**
 * CÁLCULO COMPARTIDO DE REPORTES
 *
 * El mismo reporte se dibuja en dos sitios: el dashboard (dashboard_v28.js) y el
 * portal público (reportes_publicos.js). El diseño de cada uno es distinto a
 * propósito —uno oscuro para la pantalla, otro claro para imprimir— pero los
 * NÚMEROS tienen que ser los mismos.
 *
 * Estaban escritos dos veces, y se separaron: al juntar 'B.G Licenses' con
 * 'Bubblegummers Licenses' solo se arregló el dashboard, así que para julio 2026
 * el dashboard mostraba una fila de 5.708 y el portal público dos, de 4.700 y
 * 1.008. Los dos "bien", pero distintos.
 *
 * Todo lo que decida QUÉ se cuenta o CÓMO se agrupa va acá, y los dos lo importan.
 * Lo que quede en cada archivo es solo la pintura.
 */

/* ── MARCAS QUE SON LA MISMA ──────────────────────────────────────────────
   Cuando una marca cambia de nombre en el Maestro, las tareas ya guardadas se
   quedan con el nombre de entonces. En los reportes esa marca sale partida en dos
   filas, como si fueran dos marcas distintas, y los totales no cuadran con lo que
   uno tiene en la cabeza.
*/

/** Deja el nombre en su esqueleto: sin puntos, sin espacios y en mayúsculas. */
export const claveMarca = (m) => String(m == null ? '' : m).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Nombre viejo → nombre que vale hoy (el que trae el Maestro).
 * Se compara por el esqueleto, así que una sola entrada cubre todas las formas de
 * escribirlo: 'B.G Licenses', 'BG Licenses', 'BG. Licenses', 'B.G. LICENSES'...
 */
export const MARCAS_EQUIVALENTES = {
    // Abreviatura que se usó un tiempo. Hoy el Maestro dice el nombre completo,
    // pero quedaron tareas guardadas con la forma corta.
    BGLICENSES: 'Bubblegummers Licenses'
};

/**
 * Nombre único de una marca. Todo lo que agrupe marcas pasa por acá, así el
 * histórico se junta solo sin tener que reescribir las tareas ya guardadas.
 */
export const marcaNormalizada = (m) => {
    const limpio = String(m == null ? '' : m).trim();
    if (!limpio) return '';
    return MARCAS_EQUIVALENTES[claveMarca(limpio)] || limpio;
};

/**
 * Nombre corto para las tablas angostas.
 *
 * Son DOS cosas distintas y conviene no mezclarlas:
 *   marcaNormalizada  con qué nombre se AGRUPA  (el oficial, el del Maestro)
 *   marcaCorta        con qué nombre se MUESTRA (el que entra en la columna)
 *
 * 'Bubblegummers Licenses' no entra en una línea y parte la fila en dos (53px
 * contra los 32px de las demás), lo que descuadra la lectura del reporte entero.
 * Se acorta solo para pintarlo: los totales se siguen sumando bajo el nombre
 * completo, así que ningún número cambia de sitio.
 *
 * No se arregla renombrando en el Maestro: ahí va el nombre oficial, y habría que
 * volver a editarlo a mano cada vez que se publica uno nuevo.
 */
export const MARCAS_CORTAS = {
    'BUBBLEGUMMERS LICENSES': 'B.G Licenses'
};

export const marcaCorta = (m) => {
    const nombre = marcaNormalizada(m);
    return MARCAS_CORTAS[nombre.toUpperCase()] || nombre;
};

/* ── CUÁNDO CUENTA UNA TAREA ──────────────────────────────────────────────
   Qué sigue pendiente y a qué día se le imputa el trabajo. Estaba metido dentro
   de cada reporte y por eso el cuadro del día no cuadraba con el almacén.
*/

/**
 * EL MOMENTO DE UNA TAREA, EN HORA DE ACÁ.
 *
 * Las horas viajan en DOS formatos y confundirlos corre el trabajo casi medio día:
 * las que escribe una persona quedan en hora local (`2026-08-05T11:30:00`) y las que
 * pone el sistema al tocar un botón salen de `toISOString()`, o sea UTC y con Z
 * (`2026-08-07T01:38:47.104Z`), cinco horas adelante.
 */
export const momentoDeTarea = (valor) => {
    const s = String(valor || '').trim();
    if (!s) return null;
    const d = new Date(s);          // con Z lo pasa a local solo; sin Z ya lo lee local
    return isNaN(d.getTime()) ? null : d;
};

/** Una tarea sin cerrar vive 48 horas. Pasadas esas, su mercadería ya no está comprometida. */
export const HORAS_VENCIMIENTO = 48;

/**
 * Cuántas horas lleva la tarea. Se mide desde que se procesó; si esa marca falta —las
 * tareas viejas no siempre la traen— se cae a su fecha operativa a las 19:00, que es
 * cuando corre la ola. Sin eso una tarea sin `fechaProcesado` no vencería nunca.
 */
export const horasDeTarea = (t) => {
    const p = momentoDeTarea(t && t.fechaProcesado);
    if (p) return (Date.now() - p.getTime()) / 3600000;
    const d = t && t.fecha ? new Date(`${t.fecha}T19:00:00`) : null;
    return (d && !isNaN(d.getTime())) ? (Date.now() - d.getTime()) / 3600000 : Infinity;
};

/** Si su mercadería sigue esperando en el buffer: ni cerrada, ni vencida, ni caduca. */
export const tareaSigueViva = (t) => {
    if (!t || t.status === 'Finalizado' || t.status === 'Vencida') return false;
    return horasDeTarea(t) < HORAS_VENCIMIENTO;
};

/**
 * A QUÉ JORNADA SE LE IMPUTA EL TRABAJO DE UNA TAREA.
 *
 * Se mira el INICIO, no el término: el trabajo es de la jornada que lo empezó. Un
 * operario de turno noche que arranca a las 21:00 y cierra a las 06:22 trabajó la noche
 * anterior, no la mañana siguiente — mirando el término, esas horas se le sumaban al día
 * equivocado. Lo señaló Daniel el 06-ago-2026: "el turno noche aún no almacena nada" y
 * el cuadro le mostraba 5.734 pares de North Star.
 *
 * El corte lo pone la jornada configurada (la salida del turno noche), así que quien
 * empieza a las 02:00 sigue dentro de la jornada de la tarde anterior.
 *
 * @param fechaLogicaDe  (Date) => 'YYYY-MM-DD' — se inyecta para no atar este archivo
 *                       a la configuración de jornada, que no todas las pantallas cargan.
 */
export const jornadaDelTrabajo = (t, fechaLogicaDe) => {
    const m = momentoDeTarea(t && t.inicio) || momentoDeTarea(t && t.termino);
    if (!m) return null;
    if (typeof fechaLogicaDe === 'function') return fechaLogicaDe(m);
    const dd = (n) => String(n).padStart(2, '0');
    return `${m.getFullYear()}-${dd(m.getMonth() + 1)}-${dd(m.getDate())}`;
};

/**
 * EN QUÉ DÍA CUENTA UNA TAREA. La usan TODOS los reportes.
 *
 * Una FINALIZADA cuenta en la jornada en que se trabajó; una que sigue pendiente, en el día
 * en que nació, porque todavía no se trabajó en ninguno.
 *
 * Los reportes agrupaban por `t.fecha`, que es el día en que se generó la ola. Como una tarea
 * podía vivir 48 horas, el turno de hoy trabajando una tarea de ayer sumaba al día de ayer.
 * El 07-ago-2026 Daniel abrió el detalle del jueves y le decía CERO en footwear, con su gente
 * habiendo movido 13.292 pares esa noche — y no era el único reporte con el mismo error.
 *
 * Regla de Daniel: "revisa todos los reportes, no puedo estar diciéndote me falta esto".
 * Por eso vive acá y no en cada pantalla: quien cuente tareas por día usa esta función.
 */
export const diaOperativoDeTarea = (t, fechaLogicaDe) => {
    if (!t) return null;
    if (t.status !== 'Finalizado') return t.fecha;

    // LA HORA GRABADA SOLO SE USA SI ES CREÍBLE.
    //
    // Hay 137 tareas viejas que dicen haberse trabajado ANTES de existir: nacieron a las
    // 19:30 y su hora de inicio quedó a la 01:00 del mismo día, porque hasta v29.0118 las
    // horas escritas a mano tomaban la fecha de la ola en vez del día del trabajo.
    //
    // Leer esa hora corre el trabajo un día HACIA ATRÁS, y eso rompió reportes que estaban
    // bien: el 07-ago-2026 Daniel comparó contra sus propios registros y el miércoles pasó
    // de 20.657 —su número real— a 10.426. Con esta guarda vuelve a dar 20.657 exacto, y el
    // jueves sigue mostrando los 13.292 que antes no aparecían.
    //
    // El criterio es sencillo: si el trabajo figura empezado antes de que la tarea existiera,
    // ese dato está corrupto y la fecha de la ola es más confiable. En el modelo nuevo —las
    // tareas se cierran en cada corrida y no se arrastran— las dos coinciden casi siempre.
    const nacio = momentoDeTarea(t.fechaProcesado);
    const trabajo = momentoDeTarea(t.inicio) || momentoDeTarea(t.termino);
    if (!trabajo) return t.fecha;
    if (nacio && trabajo < nacio) return t.fecha;

    return jornadaDelTrabajo(t, fechaLogicaDe) || t.fecha;
};

/* ── RANGO DE FECHAS DE UN REPORTE ────────────────────────────────────────
   Cada reporte lleva su propio rango, aparte del filtro general de la pantalla:
   sirve para mirar Marcas en una semana y Gender RIMS en otra sin pelearse.
*/

/** Rótulo del rango: una sola fecha si es de un día, o 'desde - hasta'. */
export const rotuloRango = (desde, hasta, color = '#94a3b8') => {
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const d = String(desde || '').split('-').reverse().join('/');
    const h = String(hasta || '').split('-').reverse().join('/');
    return `<span style="color:${color};">${d === h ? d : `${d} - ${h}`} ${hora}</span>`;
};

/* EL ICONO DEL RANGO.
   Va en SVG y no en emoji por dos razones que ya costaron caro: el emoji lo
   dibuja cada sistema a su manera —el 📅 de Windows no es el del celular— y en
   el tema negro los emoji del menú se apagan con un filtro, así que el mismo
   caracter aparecía a color en una pantalla y gris en otra. El trazo toma el
   color que se le pase, y por eso sigue al tema sin escribir un color a mano. */
const iconoCalendario = (color) =>
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"`
    + ` stroke-linecap="round" style="flex-shrink:0;" aria-hidden="true">`
    + `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`;

/**
 * EL RANGO DE FECHAS DE TODA LA PLATAFORMA.
 *
 * Daniel, 28-ago-2026: siempre "Desde … hasta …", con su ícono y los colores del
 * tema. Antes cada pantalla armaba el suyo —21 rangos escritos a mano, unos con
 * `DE:`/`HASTA:`, otros con `DE`/`A`, y la mayoría sin decir qué era el primer
 * campo—. Una sola caja que se lee como una frase, y el día que haya que
 * cambiarle algo se cambia acá y sale igual en las 21.
 *
 * Los valores por defecto son variables del tema, así que no hay que pasarle
 * nada: `selectorRango(desde, hasta, 'window.miSetter')` ya sale bien en los
 * cuatro temas. Todas las `var()` llevan valor de reserva porque los reportes
 * públicos se abren sin sesión y ni siquiera cargan `main.css`.
 *
 * Se puede enganchar de las dos formas, según cómo esté hecha la pantalla:
 *   - `setter`: nombre de una función global que recibe (desde, hasta), con null
 *     en el que no cambió. Sale como `onchange` en línea.
 *   - `idDesde` / `idHasta`: para las pantallas que ya escuchan por id con
 *     `addEventListener`. Las dos se pueden usar a la vez.
 */
export const selectorRango = (desde, hasta, setter, opciones = {}) => {
    const {
        color   = "var(--brand-light, #818cf8)",          // el ícono
        fondo   = "rgba(var(--ink-rgb, 255,255,255), 0.04)",
        borde   = "var(--border, rgba(255,255,255,0.1))",
        texto   = "var(--text-strong, #ffffff)",          // la fecha
        rotulo  = "var(--text-muted, #94a3b8)",           // 'Desde' y 'hasta'
        esquema = "var(--scheme, dark)",
        idDesde = '',
        idHasta = ''
    } = opciones;

    const campo = (eti, val, id, ev) => `
        <span style="font-size:11px; color:${rotulo}; font-weight:800; letter-spacing:0.04em; white-space:nowrap;">${eti}</span>
        <input type="date"${id ? ` id="${id}"` : ''} value="${val || ''}"${ev ? ` onchange="${ev}"` : ''} style="background:transparent; border:none; color:${texto}; font-size:12.5px; font-weight:700; outline:none; cursor:pointer; font-family:var(--font-ui, 'Inter', sans-serif); color-scheme:${esquema};">`;

    /* La clase `rango-fechas` no pinta nada por sí sola: es el agarre para las pocas
       reglas de `temas.css` que necesitan alcanzar el rango entero —la franja azul de
       Power BI, por ejemplo—. Antes esas reglas apuntaban al `input[type="date"]`
       suelto, que era la pastilla; ahora la pastilla es este recuadro y el input va
       transparente adentro. */
    return `
    <div class="rango-fechas" style="display:inline-flex; align-items:center; gap:9px; background:${fondo}; border:1px solid ${borde}; border-radius:9px; padding:5px 12px; flex-wrap:wrap;">
        ${iconoCalendario(color)}
        ${campo('Desde', desde, idDesde, setter ? `${setter}(this.value, null)` : '')}
        ${campo('hasta', hasta, idHasta, setter ? `${setter}(null, this.value)` : '')}
    </div>`;
};

/**
 * ES ESCOLAR.
 *
 * Vive aca y no dentro de un modulo porque la usan dos que no se ven entre si: el
 * almacenaje -que reparte 50 pares por talla a rajatabla- y el replenishment -que por eso
 * mismo no le rellena el cuerpo-. Estuvo declarada dentro del almacenaje hasta el
 * 27-ago-2026; el replenishment no la alcanzaba, y escribir una segunda copia es como
 * vuelven los problemas que una regla unica ya habia resuelto.
 */
export const esEscolar = (genderRims) =>
  String(genderRims || '').toUpperCase().includes('SCHOOL');
