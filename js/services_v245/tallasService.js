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

/** El factor de empaque por defecto. Las ojotas en bolsa vienen en 20 o 40. */
export const FACTOR_POR_DEFECTO = 10;

/**
 * Reparte los pares que van al piso entre las tallas de esa categoría.
 *
 * CADA TALLA SE REDONDEA AL FACTOR, no solo el total. A ninguna talla se le puede dar 66
 * pares: van 70, que son seis cajas. Ni al piso ni a reserva se mandan unidades sueltas.
 *
 * Eso hace que el total se corra un poco del objetivo —con 800 pares de 02 WOMEN salen 810,
 * un 1,25% de más— y está bien: Daniel lo dio por bueno hasta un 1,5%. Lo que no se puede es
 * dejar 53 abajo y mandar 47 arriba.
 *
 * Los porcentajes efectivos dejan de ser los escritos: un 25% puede terminar siendo 24,7%.
 * Por eso se devuelven los dos, el pedido y el que realmente quedó.
 */
export const repartirPorTalla = (categoria, pares, factor) =>
    repartirCon(tallasActual().categorias[String(categoria || '').toUpperCase()], pares, factor);

/**
 * El mismo reparto, pero sobre una categoría que se pasa a mano. Lo usa la pantalla de
 * configuración para mostrar el ejemplo con lo que se está editando, que todavía no se
 * publicó y por lo tanto no está en tallasActual().
 */
export const repartirCon = (c, pares, factor) => {
    const objetivo = Math.max(0, Math.round(Number(pares) || 0));
    const f = Math.max(1, Math.round(Number(factor) || FACTOR_POR_DEFECTO));
    if (!c || !objetivo) return null;

    const suma = Object.values(c.porcentajes).reduce((a, b) => a + Number(b || 0), 0);
    if (suma <= 0) return null;

    const filas = c.tallas.map(t => {
        const exacto = objetivo * (Number(c.porcentajes[t]) || 0) / suma;
        // Al múltiplo más cercano. Nunca a cero si le tocaba algo: la talla igual va, con
        // una caja, o quedaría sin representación en el piso.
        let redondeado = Math.round(exacto / f) * f;
        if (redondeado === 0 && exacto > 0) redondeado = f;
        return {
            talla: t,
            comercial: c.comerciales.includes(t),
            porcentaje: Number(c.porcentajes[t]) || 0,
            exacto: Math.round(exacto * 10) / 10,
            pares: redondeado,
            cajas: redondeado / f
        };
    });

    // Redondear cada talla por su cuenta puede irse lejos del objetivo cuando hay muchas
    // tallas y a cada una le toca cerca de media caja: 19 tallas de KIDS a 42,1 pares
    // redondean todas a 40 y se pierden 40 pares. Se corrige moviendo CAJAS ENTERAS —nunca
    // unidades— en las tallas que más se desviaron, hasta que acercarse más no se pueda.
    const distancia = (t) => Math.abs(t - objetivo);
    let total = filas.reduce((a, x) => a + x.pares, 0);
    for (let vuelta = 0; vuelta < 500; vuelta++) {
        if (total === objetivo) break;
        let cand = null;
        if (total > objetivo) {
            // sacar una caja a la talla que más de más recibió, sin dejarla en cero
            filas.forEach(x => {
                if (x.pares <= f) return;
                if (!cand || (x.pares - x.exacto) > (cand.pares - cand.exacto)) cand = x;
            });
            if (!cand || distancia(total - f) >= distancia(total)) break;
            cand.pares -= f; total -= f;
        } else {
            filas.forEach(x => {
                if (!cand || (x.exacto - x.pares) > (cand.exacto - cand.pares)) cand = x;
            });
            if (!cand || distancia(total + f) >= distancia(total)) break;
            cand.pares += f; total += f;
        }
    }
    filas.forEach(x => {
        x.cajas = x.pares / f;
        x.porcentajeReal = total ? Math.round((100 * x.pares / total) * 10) / 10 : 0;
    });

    return {
        objetivo, total, factor: f, filas,
        desvio: total - objetivo,
        desvioPct: objetivo ? Math.round((100 * (total - objetivo) / objetivo) * 10) / 10 : 0,
        sumaPorcentajes: Math.round(suma * 100) / 100
    };
};
