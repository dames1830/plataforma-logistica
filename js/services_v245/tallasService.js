/**
 * Reparto por Tallas
 *
 * Cuánto de lo que se almacena le toca a cada talla. No es proporcional a lo que llega: las
 * tallas comerciales se llevan más, porque son las que se venden.
 *
 * La regla de Daniel para 02 WOMEN: seis tallas (35 a 40), las tres comerciales —36, 37 y
 * 38— se llevan el 25% CADA UNA, y el 25% que queda se reparte entre las otras tres. Eso
 * puede cambiar: mañana puede querer 20% a la 36 y a la 38, y más a la 37. Por eso vive acá
 * y no dentro del código.
 *
 * El reparto se aplica DESPUÉS de saber cuántos pares van al piso —eso sale de la regla del
 * 50%— y antes de saber en qué cuerpos entran.
 *
 * Vive en el área 'config' del servidor, que es un cajón compartido con la jornada y las
 * zonas. Al guardar se relee y se reemplaza SOLO la clave 'tallas'.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config';
const CACHE_KEY = 'config_tallas_v1';

/**
 * Un reparto parejo entre las tallas que se le pasen. El sobrante de los decimales se lo
 * lleva la primera, o el total no daría 100 justo: 100/19 son 5,26 y por 19 dan 99,94.
 */
export const repartoParejo = (tallas) => {
    const p = {};
    const cada = Math.floor((100 / tallas.length) * 100) / 100;
    tallas.forEach(t => { p[t] = cada; });
    const falta = Math.round((100 - cada * tallas.length) * 100) / 100;
    if (falta && tallas.length) p[tallas[0]] = Math.round((cada + falta) * 100) / 100;
    return p;
};
const parejo = repartoParejo;

/**
 * Arranca con las tallas REALES de cada categoría, medidas sobre el stock del 01-ago-2026.
 * WOMEN y MEN vienen con la regla que dictó Daniel; el resto arranca parejo y marcado como
 * sin configurar, para que se note que hay que revisarlas y no se tomen por buenas.
 */
export const tallasPorDefecto = () => ({
    categorias: {
        '02 WOMEN': {
            configurado: true,
            tallas: ['35', '36', '37', '38', '39', '40'],
            comerciales: ['36', '37', '38'],
            porcentajes: { '35': 8.34, '36': 25, '37': 25, '38': 25, '39': 8.33, '40': 8.33 }
        },
        '01 MEN': {
            configurado: true,
            // La 38 aparece con el 6% del stock. Se deja: si no va, se saca desde la pantalla.
            tallas: ['38', '39', '40', '41', '42', '43', '44'],
            comerciales: ['40', '41', '42'],
            porcentajes: { '38': 6.25, '39': 6.25, '40': 25, '41': 25, '42': 25, '43': 6.25, '44': 6.25 }
        },
        '03 KIDS': {
            configurado: false, comerciales: [],
            tallas: ['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36'],
            porcentajes: parejo(['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36'])
        },
        '05 SCHOOL': {
            configurado: false, comerciales: [],
            tallas: ['26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44'],
            porcentajes: parejo(['26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44'])
        },
        '04 SPORT': {
            configurado: false, comerciales: [],
            tallas: ['34','35','36','37','38','39','40','41','42','43','44'],
            porcentajes: parejo(['34','35','36','37','38','39','40','41','42','43','44'])
        },
        '06 OTHERS': {
            configurado: false, comerciales: [],
            tallas: ['35','36','37','38','39','40','41','42','43','44'],
            porcentajes: parejo(['35','36','37','38','39','40','41','42','43','44'])
        },
        '07 INDUSTRIAL': {
            configurado: false, comerciales: [],
            tallas: ['35','36','37','38','39','40','41','42','43','44','45'],
            porcentajes: parejo(['35','36','37','38','39','40','41','42','43','44','45'])
        }
    }
});

const normalizar = (crudo) => {
    const def = tallasPorDefecto();
    const c = (crudo && typeof crudo === 'object') ? crudo : {};
    const origen = (c.categorias && typeof c.categorias === 'object') ? c.categorias : def.categorias;

    const categorias = {};
    Object.keys(origen).forEach(k => {
        const v = origen[k] || {};
        const tallas = Array.isArray(v.tallas) ? v.tallas.map(String).filter(Boolean) : [];
        if (!tallas.length) return;
        const porcentajes = {};
        tallas.forEach(t => {
            const n = Number((v.porcentajes || {})[t]);
            porcentajes[t] = (Number.isFinite(n) && n >= 0 && n <= 100) ? n : 0;
        });
        categorias[String(k).toUpperCase()] = {
            configurado: !!v.configurado,
            tallas,
            comerciales: Array.isArray(v.comerciales) ? v.comerciales.map(String).filter(t => tallas.includes(t)) : [],
            porcentajes
        };
    });
    return { categorias: Object.keys(categorias).length ? categorias : def.categorias };
};

let _tallas = null;

const leerCache = () => {
    try {
        const txt = localStorage.getItem(CACHE_KEY);
        return txt ? normalizar(JSON.parse(txt)) : null;
    } catch (e) { return null; }
};

const escribirCache = (cfg) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin caché se sigue igual */ }
};

export const tallasActual = () => {
    if (_tallas) return _tallas;
    const local = leerCache();
    if (local) { _tallas = local; return _tallas; }
    return tallasPorDefecto();
};

export const cargarTallas = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && datos.tallas) {
                _tallas = normalizar(datos.tallas);
                escribirCache(_tallas);
                return _tallas;
            }
        }
    } catch (e) {
        console.warn('[Tallas] no se pudo traer el reparto publicado:', e && e.message);
    }
    _tallas = leerCache() || tallasPorDefecto();
    return _tallas;
};

export const guardarTallas = async (nueva) => {
    const cfg = normalizar(nueva);
    _tallas = cfg;
    escribirCache(cfg);

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo de tallas */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, tallas: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};

/** Cuánto suman los porcentajes de una categoría. Tiene que dar 100. */
export const sumaDe = (cat) => {
    const c = tallasActual().categorias[String(cat).toUpperCase()];
    if (!c) return 0;
    return Math.round(Object.values(c.porcentajes).reduce((a, b) => a + Number(b || 0), 0) * 100) / 100;
};

/**
 * Reparte los pares que van al piso entre las tallas de esa categoría.
 *
 * Se reparte por parte entera y los pares que sobran del redondeo se le dan a las tallas con
 * mayor porcentaje: si a la 37 le toca el 25% no puede terminar con un par menos que la 35
 * por un tema de decimales.
 */
export const repartirPorTalla = (categoria, pares) => {
    const c = tallasActual().categorias[String(categoria || '').toUpperCase()];
    const total = Math.max(0, Math.round(Number(pares) || 0));
    if (!c || !total) return null;

    const suma = Object.values(c.porcentajes).reduce((a, b) => a + Number(b || 0), 0);
    if (suma <= 0) return null;

    const filas = c.tallas.map(t => {
        const exacto = total * (Number(c.porcentajes[t]) || 0) / suma;
        return { talla: t, porcentaje: Number(c.porcentajes[t]) || 0, exacto, pares: Math.floor(exacto),
                 comercial: c.comerciales.includes(t) };
    });

    let sobran = total - filas.reduce((a, f) => a + f.pares, 0);
    [...filas].sort((a, b) => b.porcentaje - a.porcentaje || (b.exacto - b.pares) - (a.exacto - a.pares))
        .forEach(f => { if (sobran > 0) { f.pares++; sobran--; } });

    return { total, filas, sumaPorcentajes: Math.round(suma * 100) / 100 };
};
