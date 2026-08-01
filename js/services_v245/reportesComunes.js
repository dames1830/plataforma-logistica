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
                <input type="date" value="${val}" onchange="${ev}" style="background:transparent; border:none; color:${texto}; font-size:0.68rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:${esquema};">
            </div>`).join('')}
    </div>`;
};
