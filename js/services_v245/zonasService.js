/**
 * Zonas de Almacenaje
 *
 * Dónde va cada mercadería y cuánta entra. Hasta la v29.0012 esto vivía escrito a mano
 * dentro de dashboard_v28.js —y en parte en ningún lado, solo en la cabeza de la gente—,
 * así que mover una columna de temporada anterior a actual era editar JavaScript.
 *
 * Cuatro cosas se configuran acá:
 *
 *   LAYOUT    por zona: cuántas columnas y cuerpos tiene, cuáles son pasillos del elevador,
 *             qué temporada le toca a cada columna, y desde cuántos pares deja de ser saldo.
 *   MARCAS    a qué zona va cada marca. Bata al selectivo, Bubblegummers al mezzanine 1...
 *   OTHERS    las ojotas no siguen a su marca: la subcategoría manda. Las de bolsa
 *             transparente van al mezzanine 4, las de caja al selectivo.
 *   DENSIDAD  cuántos pares entran en un cuerpo, según la serie (el primer dígito del
 *             código) y la zona. Un cuerpo de serie 0 aguanta 1.388 pares; uno de serie 7,
 *             181. El sistema la mide solo, y acá se puede pisar a mano.
 *
 * Vive en el área 'config' del servidor, que el backend trata como SINGLETON. Es un cajón
 * compartido —la jornada vive ahí al lado— así que al guardar se relee y se reemplaza SOLO
 * la clave 'zonas', para no llevarse por delante lo del vecino.
 *
 * La lectura es SÍNCRONA a propósito, igual que en jornadaService: se descarga una vez al
 * arrancar y de ahí en más se lee de memoria.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config';
const CACHE_KEY = 'config_zonas_v1';

/** Las cuatro temporadas que puede tener una columna. */
export const FRANJAS = {
    actual:   { etiqueta: 'Temporada actual',  color: '#3b82f6' },
    anterior: { etiqueta: 'Temporada anterior', color: '#ef4444' },
    saldos:   { etiqueta: 'Saldos',             color: '#f59e0b' },
    escolar:  { etiqueta: 'Escolar',            color: '#22c55e' },
    ninguna:  { etiqueta: 'Sin uso',            color: '#64748b' }
};

/** Repite una franja para un rango de columnas: rango(5, 13, 'actual'). */
const rango = (desde, hasta, franja) => {
    const o = {};
    for (let c = desde; c <= hasta; c++) o[c] = franja;
    return o;
};

/**
 * Lo que hoy hace el código, tal cual, para que al abrir el módulo por primera vez nada
 * cambie de comportamiento. Las densidades salen de medir el stock real del 01-ago-2026:
 * se miraron los cuerpos que tenían UN SOLO artículo y se tomó el máximo por serie.
 */
export const zonasPorDefecto = () => ({
    zonas: {
        SEL: {
            etiqueta: 'Selectivo',
            activa: true,
            columnas: 14,
            cuerpos: 22,
            saldoMenorA: 20,
            // Los cuerpos 11 y 22 de las columnas 2 a 13 son el paso del elevador: el rack
            // se abre abajo y recién desde el nivel F cruza por encima.
            pasillos: [{ desdeCol: 2, hastaCol: 13, cuerpos: [11, 22] }],
            franjas: { ...rango(1, 2, 'saldos'), ...rango(3, 4, 'anterior'),
                       ...rango(5, 13, 'actual'), 14: 'escolar' }
        },
        MZN01: {
            etiqueta: 'Mezzanine 1',
            activa: true,
            columnas: 24,
            cuerpos: 22,
            saldoMenorA: 80,
            pasillos: [],
            franjas: { ...rango(1, 3, 'anterior'), ...rango(4, 20, 'actual'),
                       ...rango(21, 23, 'anterior'), 24: 'actual' }
        },
        MZN02: {
            etiqueta: 'Mezzanine 2',
            activa: true,
            columnas: 24,
            cuerpos: 22,
            saldoMenorA: 80,
            pasillos: [],
            franjas: { ...rango(1, 5, 'anterior'), ...rango(6, 24, 'actual') }
        },
        // Sin reglas todavía. Daniel las carga desde este mismo módulo cuando las ordene:
        // mientras 'activa' esté en false, la sugerencia avisa en vez de inventar.
        MZN03: {
            etiqueta: 'Mezzanine 3',
            activa: false,
            columnas: 24,
            cuerpos: 22,
            saldoMenorA: 80,
            pasillos: [],
            franjas: {}
        },
        MZN04: {
            etiqueta: 'Mezzanine 4',
            activa: false,
            columnas: 24,
            cuerpos: 22,
            saldoMenorA: 80,
            pasillos: [],
            franjas: {}
        }
    },

    /**
     * Esto no estaba en el código: se dedujo del stock real. Con footwear y sin contar el
     * andamio, cada marca está casi entera en una sola zona (Power 100% en MZN01,
     * Puma/Adidas/Skechers 100% en MZN03, Bata 71% en el selectivo).
     */
    marcas: {
        'Bata': 'SEL',
        'Bubblegummers': 'MZN01',
        'B.G Licenses': 'MZN01',
        'Power': 'MZN01',
        'North Star': 'MZN02',
        'Puma': 'MZN03',
        'Adidas': 'MZN03',
        'Weinbrenner': 'MZN03',
        'Bata Industrials': 'MZN03',
        'Marie Claire': 'MZN03',
        'Skechers': 'MZN03'
    },

    /**
     * Las ojotas (Gender RIMS '06 OTHERS') NO siguen a su marca. Lo que decide es el
     * empaque, y el corte va por la subcategoría COMPLETA, no por la familia: F46 tiene
     * pantuflas en caja Y el botín Kate en bolsa. Agrupar por familia da mal.
     * Se compara por prefijo, así que 'F44' alcanza para todas las F44_*.
     */
    others: [
        { subcategoria: 'F44',                 zona: 'MZN04', nota: 'ojota en bolsa (factor 20/40)' },
        { subcategoria: 'F45',                 zona: 'MZN04', nota: 'ojota en bolsa (factor 20/40)' },
        { subcategoria: 'F46_75_KIDS WINTER',  zona: 'MZN04', nota: 'botín Kate, viene en bolsa' },
        { subcategoria: 'F46_71_MEN WINTER',   zona: 'SEL',   nota: 'pantufla en caja' },
        { subcategoria: 'F46_73_WOMEN WINTER', zona: 'SEL',   nota: 'pantufla en caja' }
    ],

    /**
     * Pares por cuerpo. Medido, no inventado: el máximo visto en cuerpos de un solo
     * artículo. Es un PISO —un cuerpo con 200 pares puede estar a medio llenar—, por eso
     * se puede subir a mano. Las combinaciones sin medición caen al respaldo de la zona.
     */
    densidad: {
        SEL:   { 0: 1388, 1: 1012, 5: 640, 6: 530, 7: 181, 8: 604 },
        MZN01: { 0: 747, 1: 880, 2: 683, 3: 488, 4: 481, 5: 567, 8: 391 },
        MZN02: { 4: 394, 5: 437, 6: 402, 8: 424 },
        MZN03: {},
        MZN04: {}
    },

    /** Cuando no hay medición para esa serie en esa zona. */
    densidadRespaldo: { SEL: 330, MZN01: 500, MZN02: 400, MZN03: 400, MZN04: 400 },

    /** La categoría que no sigue a su marca. */
    categoriaOthers: '06 OTHERS'
});

const _num = (v, respaldo, min, max) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= min && n <= max) ? Math.round(n) : respaldo;
};

/** Deja fuera cualquier cosa que no sea configuración válida, para que un dato roto no rompa la sugerencia. */
const normalizar = (crudo) => {
    const def = zonasPorDefecto();
    const c = (crudo && typeof crudo === 'object') ? crudo : {};

    const zonas = {};
    Object.keys(def.zonas).forEach(z => {
        const d = def.zonas[z];
        const v = (c.zonas && typeof c.zonas[z] === 'object') ? c.zonas[z] : {};
        const franjas = {};
        const origen = (v.franjas && typeof v.franjas === 'object') ? v.franjas : d.franjas;
        Object.keys(origen).forEach(k => {
            const col = Number(k);
            if (Number.isInteger(col) && col >= 1 && col <= 99 && FRANJAS[origen[k]]) {
                franjas[col] = origen[k];
            }
        });
        zonas[z] = {
            etiqueta: String(v.etiqueta || d.etiqueta),
            activa: typeof v.activa === 'boolean' ? v.activa : d.activa,
            columnas: _num(v.columnas, d.columnas, 1, 99),
            cuerpos: _num(v.cuerpos, d.cuerpos, 1, 99),
            saldoMenorA: _num(v.saldoMenorA, d.saldoMenorA, 0, 100000),
            pasillos: Array.isArray(v.pasillos) ? v.pasillos.filter(p =>
                p && Number.isFinite(Number(p.desdeCol)) && Array.isArray(p.cuerpos)) : d.pasillos,
            franjas
        };
    });

    const marcas = {};
    const mSrc = (c.marcas && typeof c.marcas === 'object') ? c.marcas : def.marcas;
    Object.keys(mSrc).forEach(m => { if (zonas[mSrc[m]]) marcas[m] = mSrc[m]; });

    const others = (Array.isArray(c.others) ? c.others : def.others)
        .filter(o => o && o.subcategoria && zonas[o.zona])
        .map(o => ({ subcategoria: String(o.subcategoria).trim().toUpperCase(),
                     zona: o.zona, nota: String(o.nota || '') }));

    const densidad = {};
    Object.keys(zonas).forEach(z => {
        densidad[z] = {};
        const src = (c.densidad && c.densidad[z]) || def.densidad[z] || {};
        Object.keys(src).forEach(s => {
            const n = _num(src[s], 0, 1, 100000);
            if (n) densidad[z][String(s)] = n;
        });
    });

    const respaldo = {};
    Object.keys(zonas).forEach(z => {
        respaldo[z] = _num((c.densidadRespaldo || {})[z], def.densidadRespaldo[z] || 330, 1, 100000);
    });

    return { zonas, marcas, others, densidad, densidadRespaldo: respaldo,
             categoriaOthers: String(c.categoriaOthers || def.categoriaOthers) };
};

let _zonas = null;

const leerCache = () => {
    try {
        const txt = localStorage.getItem(CACHE_KEY);
        return txt ? normalizar(JSON.parse(txt)) : null;
    } catch (e) { return null; }
};

const escribirCache = (cfg) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin caché se sigue igual */ }
};

/** La configuración vigente, SIN esperar a nadie. */
export const zonasActual = () => {
    if (_zonas) return _zonas;
    const local = leerCache();
    if (local) { _zonas = local; return _zonas; }
    return zonasPorDefecto();
};

/** Trae la configuración publicada. Se llama una vez al arrancar la app. */
export const cargarZonas = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && datos.zonas) {
                _zonas = normalizar(datos.zonas);
                escribirCache(_zonas);
                return _zonas;
            }
        }
    } catch (e) {
        console.warn('[Zonas] no se pudo traer la publicada, se usa la de esta PC:', e && e.message);
    }
    _zonas = leerCache() || zonasPorDefecto();
    return _zonas;
};

/**
 * Publica para todas las PC. Se relee 'config' y se reemplaza SOLO la clave 'zonas':
 * el área es compartida con la jornada y pisarla entera se la llevaría puesta.
 */
export const guardarZonas = async (nueva) => {
    const cfg = normalizar(nueva);
    _zonas = cfg;
    escribirCache(cfg);

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo de zonas */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, zonas: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};

// ── Lo que consulta la sugerencia ────────────────────────────────────────────

/** La zona de una marca. Devuelve null si esa marca no está configurada. */
export const zonaDeMarca = (marca) => {
    const m = String(marca || '').trim();
    const cfg = zonasActual();
    if (cfg.marcas[m]) return cfg.marcas[m];
    // Sin distinguir mayúsculas ni espacios de más, que el Maestro no siempre es prolijo
    const buscado = m.toUpperCase().replace(/\s+/g, ' ');
    const hallado = Object.keys(cfg.marcas).find(k => k.toUpperCase().replace(/\s+/g, ' ') === buscado);
    return hallado ? cfg.marcas[hallado] : null;
};

/**
 * La zona de una ojota, por su subcategoría. Gana la regla MÁS LARGA que le calce, para que
 * 'F46_75_KIDS WINTER' no la resuelva un 'F46' genérico que alguien agregue después.
 */
export const zonaDeOthers = (subcategoria) => {
    const s = String(subcategoria || '').trim().toUpperCase();
    if (!s) return null;
    const calzan = zonasActual().others
        .filter(o => s.startsWith(o.subcategoria))
        .sort((a, b) => b.subcategoria.length - a.subcategoria.length);
    return calzan.length ? calzan[0].zona : null;
};

/** ¿Esta categoría es la que no sigue a su marca? */
export const esOthers = (genderRims) =>
    String(genderRims || '').trim().toUpperCase().includes('OTHERS');

/** La serie es el PRIMER DÍGITO del código de artículo. La 0 es la más chica. */
export const serieDe = (codigo) => {
    const s = String(codigo || '').trim();
    return /^\d/.test(s) ? s[0] : null;
};

/** Pares que entran en un cuerpo de esa zona para esa serie. */
export const densidadDe = (zona, serie) => {
    const cfg = zonasActual();
    const d = cfg.densidad[zona] || {};
    const v = d[String(serie)];
    return v || cfg.densidadRespaldo[zona] || 330;
};

/** La temporada que le toca a una columna: 'actual', 'anterior', 'saldos', 'escolar'... */
export const franjaDeColumna = (zona, columna) => {
    const z = zonasActual().zonas[zona];
    return (z && z.franjas[Number(columna)]) || 'ninguna';
};

/** Las columnas de una zona que llevan esa temporada, en orden. */
export const columnasDeFranja = (zona, franja) => {
    const z = zonasActual().zonas[zona];
    if (!z) return [];
    return Object.keys(z.franjas)
        .filter(c => z.franjas[c] === franja)
        .map(Number).sort((a, b) => a - b);
};

/** ¿Ese cuerpo es paso del elevador? Entonces no existe como ubicación de almacenaje. */
export const esPasillo = (zona, columna, cuerpo) => {
    const z = zonasActual().zonas[zona];
    if (!z) return false;
    const col = Number(columna), cue = Number(cuerpo);
    return (z.pasillos || []).some(p =>
        col >= Number(p.desdeCol) && col <= Number(p.hastaCol) && p.cuerpos.map(Number).includes(cue));
};

/** Todos los cuerpos que existen en una zona, salteando los pasillos. */
export const cuerposDe = (zona) => {
    const z = zonasActual().zonas[zona];
    if (!z) return [];
    const salida = [];
    for (let c = 1; c <= z.columnas; c++) {
        for (let cu = 1; cu <= z.cuerpos; cu++) {
            if (!esPasillo(zona, c, cu)) salida.push({ columna: c, cuerpo: cu });
        }
    }
    return salida;
};

/** Las zonas que ya tienen reglas cargadas y pueden sugerir. */
export const zonasActivas = () => {
    const z = zonasActual().zonas;
    return Object.keys(z).filter(k => z[k].activa);
};
