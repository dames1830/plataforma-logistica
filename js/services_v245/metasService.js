/**
 * Metas de Productividad de Almacenaje
 *
 * Las categorías NO están escritas en este archivo: salen del Maestro de Artículos.
 *   Columna C — G. Gender   → familia (FOOTWEAR, NON FOOTWEAR, Non Commercial, Promotions…)
 *   Columna D — Gender RIMS → detalle (01 MEN, 02 WOMEN, 08 ACCESORIES…)
 *
 * Las reglas viven en su propio almacenamiento, aparte del Maestro. Si una categoría
 * desaparece del Maestro, su regla NO se borra: queda dormida. Es lo que permite que un
 * reporte de julio siga midiendo con la meta de julio aunque hoy esa categoría ya no exista.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config_metas_almacenaje';
const CACHE_KEY = 'config_metas_almacenaje_v2';

export const META_FALLBACK = 300;
export const TAMANO_FALLBACK = 300;

/** Nivel al que aplica una regla. */
export const NIVEL = { DETALLE: 'detalle', FAMILIA: 'familia', GLOBAL: 'global' };

let reglas = null;

const nuevoId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

const norm = (v) => String(v || '').trim().toUpperCase();

/**
 * Los valores de Gender RIMS vienen numerados ('01 MEN', '08 ACCESORIES') y los de
 * G. Gender no ('FOOTWEAR', 'Non Commercial'). Sirve para leer tareas antiguas, que
 * guardaban un solo campo sin decir de qué columna salía.
 */
export const pareceDetalle = (valor) => /^\d{1,2}[\s.-]/.test(String(valor || '').trim());

/** Valores que no aportan categoría. */
export const esCategoriaVacia = (valor) => {
    const v = norm(valor);
    return !v || v === '-' || v === 'S/G' || v === 'S/GR' || v === 'N/A';
};

const reglasPorDefecto = () => ([
    { id: nuevoId(), categoria: 'FOOTWEAR', nivel: NIVEL.FAMILIA, metaUph: 300, tamanoTarea: 300, desde: '2026-01-01', hasta: '', nota: 'Regla base calzado', base: true },
    { id: nuevoId(), categoria: 'GLOBAL', nivel: NIVEL.GLOBAL, metaUph: 300, tamanoTarea: 300, desde: '2026-01-01', hasta: '', nota: 'Regla de respaldo para cualquier categoría sin regla propia', base: true }
]);

/** Migra reglas de la versión anterior, que usaba el pseudo-nivel NO_FOOTWEAR. */
const migrar = (lista) => (lista || []).map(r => {
    if (r.nivel) return r;
    const cat = norm(r.categoria);
    if (cat === 'NO_FOOTWEAR') return { ...r, categoria: 'NON FOOTWEAR', nivel: NIVEL.FAMILIA };
    if (cat === 'GLOBAL') return { ...r, nivel: NIVEL.GLOBAL };
    return { ...r, nivel: pareceDetalle(r.categoria) ? NIVEL.DETALLE : NIVEL.FAMILIA };
});

export const cargarReglas = async (forzar = false) => {
    if (reglas && !forzar) return reglas;

    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { headers: { 'X-Environment': 'production' } });
        if (res.ok) {
            const payload = await res.json();
            if (payload && Array.isArray(payload.data) && payload.data.length > 0) {
                reglas = migrar(payload.data);
                localStorage.setItem(CACHE_KEY, JSON.stringify(reglas));
                return reglas;
            }
        }
    } catch (err) {
        console.warn('[METAS] Servidor no disponible, se usa la copia local.', err);
    }

    const local = localStorage.getItem(CACHE_KEY) || localStorage.getItem('config_metas_almacenaje_v1');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
                reglas = migrar(parsed);
                return reglas;
            }
        } catch (e) { /* copia local corrupta, se ignora */ }
    }

    reglas = reglasPorDefecto();
    return reglas;
};

export const getReglas = () => reglas || [];

export const guardarReglas = async (nuevasReglas) => {
    reglas = nuevasReglas;
    localStorage.setItem(CACHE_KEY, JSON.stringify(reglas));
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify(reglas)
        });
        return res.ok;
    } catch (err) {
        console.warn('[METAS] No se pudo sincronizar con el servidor.', err);
        return false;
    }
};

export const agregarRegla = async (regla) => {
    const nivel = regla.nivel || (norm(regla.categoria) === 'GLOBAL' ? NIVEL.GLOBAL : (pareceDetalle(regla.categoria) ? NIVEL.DETALLE : NIVEL.FAMILIA));
    const lista = [...getReglas(), { ...regla, nivel, id: nuevoId() }];
    await guardarReglas(lista);
    return lista;
};

export const actualizarRegla = async (id, cambios) => {
    const lista = getReglas().map(r => r.id === id ? { ...r, ...cambios, id: r.id } : r);
    await guardarReglas(lista);
    return lista;
};

export const borrarRegla = async (id) => {
    const objetivo = getReglas().find(r => r.id === id);
    if (objetivo && objetivo.base) return { ok: false, mensaje: 'La regla base no se puede borrar. Sin ella el sistema se queda sin meta de respaldo.' };
    const lista = getReglas().filter(r => r.id !== id);
    await guardarReglas(lista);
    return { ok: true, lista };
};

/** Cierra la vigencia en vez de borrar. Preserva los reportes históricos intactos. */
export const cerrarVigencia = async (id, fechaFin) => {
    return await actualizarRegla(id, { hasta: fechaFin });
};

export const reglaVigenteEn = (regla, fecha) => {
    if (!fecha) return false;
    const desde = regla.desde || '0000-01-01';
    const hasta = regla.hasta || '9999-12-31';
    return fecha >= desde && fecha <= hasta;
};

/**
 * Meta vigente para una categoría en una fecha.
 * Precedencia: Gender RIMS exacto → G. Gender → GLOBAL → respaldo fijo.
 * Entre reglas del mismo nivel gana la de inicio más reciente, así una campaña
 * pisa a la regla base durante su vigencia sin necesidad de borrar nada.
 */
export const resolverMeta = (detalle, familia, fecha) => {
    const vigentes = getReglas().filter(r => reglaVigenteEn(r, fecha));
    const masReciente = (arr) => arr.sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')))[0];

    const d = norm(detalle);
    if (d && !esCategoriaVacia(d)) {
        const porDetalle = masReciente(vigentes.filter(r => norm(r.categoria) === d));
        if (porDetalle) return { metaUph: porDetalle.metaUph, tamanoTarea: porDetalle.tamanoTarea, regla: porDetalle, origen: NIVEL.DETALLE };
    }

    const f = norm(familia);
    if (f && !esCategoriaVacia(f)) {
        const porFamilia = masReciente(vigentes.filter(r => norm(r.categoria) === f));
        if (porFamilia) return { metaUph: porFamilia.metaUph, tamanoTarea: porFamilia.tamanoTarea, regla: porFamilia, origen: NIVEL.FAMILIA };
    }

    const global = masReciente(vigentes.filter(r => norm(r.categoria) === 'GLOBAL'));
    if (global) return { metaUph: global.metaUph, tamanoTarea: global.tamanoTarea, regla: global, origen: NIVEL.GLOBAL };

    return { metaUph: META_FALLBACK, tamanoTarea: TAMANO_FALLBACK, regla: null, origen: 'respaldo' };
};

/** Meta de hoy, para el generador de tareas. */
export const resolverMetaHoy = (detalle, familia) => {
    const h = new Date();
    const fecha = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    return resolverMeta(detalle, familia, fecha);
};

/** true si existe alguna regla propia para esa categoría, vigente o no. */
export const tieneReglaPropia = (categoria) => {
    const c = norm(categoria);
    return getReglas().some(r => norm(r.categoria) === c);
};
