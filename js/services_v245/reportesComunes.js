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
    const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const d = String(desde || '').split('-').reverse().join('/');
    const h = String(hasta || '').split('-').reverse().join('/');
    return `<span style="color:${color};">${d === h ? d : `${d} - ${h}`} ${hora}</span>`;
};

/**
 * Selector compacto de rango para la cabecera de un reporte.
 * `setter` es el nombre de una función global que recibe (desde, hasta); se le
 * pasa null en el que no cambió.
 */
export const selectorRango = (desde, hasta, setter, opciones = {}) => {
    const {
        color = '#00E5FF',
        fondo = 'rgba(0,0,0,0.45)',
        texto = '#fff',
        esquema = 'dark'
    } = opciones;
    return `
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        ${[['DE', desde, `${setter}(this.value, null)`], ['A', hasta, `${setter}(null, this.value)`]].map(([eti, val, ev]) => `
            <div style="display:flex; align-items:center; background:${fondo}; border:1px solid ${color}59; border-radius:8px; padding:3px 8px; gap:6px;">
                <span style="font-size:0.6rem; color:${color}; font-weight:800; letter-spacing:0.5px;">${eti}</span>
                <input type="date" value="${val}" onchange="${ev}" style="background:transparent; border:none; color:${texto}; font-size:0.68rem; font-weight:700; outline:none; cursor:pointer; font-family:var(--font-ui, 'Inter', sans-serif); color-scheme:${esquema};">
            </div>`).join('')}
    </div>`;
};
