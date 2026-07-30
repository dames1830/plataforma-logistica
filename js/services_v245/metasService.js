/**
 * Metas de Productividad de Almacenaje
 * Reglas configurables por categoría con vigencia por fechas.
 * Reemplaza los valores fijos de 150/300 que estaban en el código.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config_metas_almacenaje';
const CACHE_KEY = 'config_metas_almacenaje_v1';

// Categorías que NO son calzado, para el desplegable de configuración.
export const CATEGORIAS_NO_FOOTWEAR = [
    '11 NON COMMERCIAL COMPLEMENTS',
    '08 ACCESORIES',
    '09 CLOTHING',
    '06 OTHERS',
    '10 PROMOTIONS',
    'NON FOOTWEAR',
    'NON COMMERCIAL'
];

// El Maestro trae el mismo concepto escrito de varias formas ('08 ACCESORIES', 'NON FOOTWEAR',
// 'NON COMMERCIAL'...), así que se reconoce por raíz de palabra en vez de por texto exacto.
const RAICES_NO_FOOTWEAR = ['NON FOOTWEAR', 'NO FOOTWEAR', 'NON COMMERCIAL', 'ACCESOR', 'CLOTHING', 'OTHERS', 'PROMOTION', 'COMPLEMENT'];

export const META_FALLBACK = 300;
export const TAMANO_FALLBACK = 300;

let reglas = null;

const nuevoId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/** Normaliza un Gender RIMS para comparar sin acentos ni espacios de más. */
const norm = (v) => String(v || '').trim().toUpperCase();

/** true si el Gender RIMS corresponde a una categoría que no es calzado. */
export const esNoFootwear = (genderRims) => {
    const g = norm(genderRims);
    if (!g) return false;
    if (g === 'FOOTWEAR') return false; // el literal 'FOOTWEAR' contiene 'FOOTWEAR', hay que descartarlo antes
    return RAICES_NO_FOOTWEAR.some(raiz => g.includes(raiz));
};

/** Devuelve 'FOOTWEAR' o 'NO_FOOTWEAR' para un Gender RIMS. */
export const grupoDe = (genderRims) => esNoFootwear(genderRims) ? 'NO_FOOTWEAR' : 'FOOTWEAR';

const reglasPorDefecto = () => ([
    { id: nuevoId(), categoria: 'FOOTWEAR', metaUph: 300, tamanoTarea: 300, desde: '2026-01-01', hasta: '', nota: 'Regla base calzado', base: true },
    { id: nuevoId(), categoria: 'NO_FOOTWEAR', metaUph: 1000, tamanoTarea: 1000, desde: '2026-01-01', hasta: '', nota: 'Regla base complementos', base: true }
]);

/** Carga las reglas del servidor. Si falla, usa la copia local y si no hay, las de fábrica. */
export const cargarReglas = async (forzar = false) => {
    if (reglas && !forzar) return reglas;

    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { headers: { 'X-Environment': 'production' } });
        if (res.ok) {
            const payload = await res.json();
            if (payload && Array.isArray(payload.data) && payload.data.length > 0) {
                reglas = payload.data;
                localStorage.setItem(CACHE_KEY, JSON.stringify(reglas));
                return reglas;
            }
        }
    } catch (err) {
        console.warn('[METAS] Servidor no disponible, se usa la copia local.', err);
    }

    const local = localStorage.getItem(CACHE_KEY);
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
                reglas = parsed;
                return reglas;
            }
        } catch (e) { /* copia local corrupta, se ignora */ }
    }

    reglas = reglasPorDefecto();
    return reglas;
};

/** Reglas ya cargadas en memoria, sin ir al servidor. */
export const getReglas = () => reglas || [];

/** Guarda en local de inmediato y sincroniza con el servidor en segundo plano. */
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
    const lista = [...getReglas(), { ...regla, id: nuevoId() }];
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
    if (objetivo && objetivo.base) return { ok: false, mensaje: 'La regla base no se puede borrar. Sin ella el sistema se queda sin meta.' };
    const lista = getReglas().filter(r => r.id !== id);
    await guardarReglas(lista);
    return { ok: true, lista };
};

/** true si la fecha (YYYY-MM-DD) cae dentro de la vigencia de la regla. */
export const reglaVigenteEn = (regla, fecha) => {
    if (!fecha) return false;
    const desde = regla.desde || '0000-01-01';
    const hasta = regla.hasta || '9999-12-31';
    return fecha >= desde && fecha <= hasta;
};

/**
 * Resuelve la meta que aplica a una categoría en una fecha dada.
 * Precedencia: categoría exacta > grupo (FOOTWEAR/NO_FOOTWEAR) > global > fallback.
 * Entre reglas del mismo nivel gana la de inicio más reciente, así una campaña
 * pisa a la regla base sin tener que borrarla.
 */
export const resolverMeta = (genderRims, fecha) => {
    const lista = getReglas();
    const cat = norm(genderRims);
    const grupo = grupoDe(genderRims);

    const vigentes = lista.filter(r => reglaVigenteEn(r, fecha));
    const masReciente = (candidatas) => candidatas.sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')))[0];

    const exacta = masReciente(vigentes.filter(r => cat && norm(r.categoria) === cat));
    if (exacta) return { metaUph: exacta.metaUph, tamanoTarea: exacta.tamanoTarea, regla: exacta, origen: 'categoria' };

    const porGrupo = masReciente(vigentes.filter(r => norm(r.categoria) === grupo));
    if (porGrupo) return { metaUph: porGrupo.metaUph, tamanoTarea: porGrupo.tamanoTarea, regla: porGrupo, origen: 'grupo' };

    const global = masReciente(vigentes.filter(r => norm(r.categoria) === 'GLOBAL'));
    if (global) return { metaUph: global.metaUph, tamanoTarea: global.tamanoTarea, regla: global, origen: 'global' };

    return { metaUph: META_FALLBACK, tamanoTarea: TAMANO_FALLBACK, regla: null, origen: 'fallback' };
};

/** Meta que aplica hoy, para el generador de tareas. */
export const resolverMetaHoy = (genderRims) => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    return resolverMeta(genderRims, fecha);
};
