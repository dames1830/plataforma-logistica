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
/**
 * CUÁNTO BAJA AL PISO, según la marca. Tres reglas distintas:
 *
 *   PORCENTAJE  las marcas grandes —Bata, North Star, Bubblegummers— dejan la mitad del
 *               stock TOTAL (buffer + piso + reserva) abajo. Tienen cuerpos de sobra.
 *   CUERPOS     las medianas —Power, Weinbrenner, Puma, Industrials— llenan UN SOLO CUERPO
 *               y nada más, por más que lleguen mil pares. Si a Power le entran 330 en un
 *               cuerpo, se almacenan 330. Poner la mitad les comería dos o tres cuerpos y
 *               no quedaría lugar para el resto de los artículos de esa misma marca.
 *   TODO        Adidas y Skechers: lo que hay en el buffer se almacena entero, sin recorte.
 *
 * Una marca que no esté en la lista se trata como mediana: un cuerpo. Es lo prudente — de
 * más se llena el selectivo, de menos solo se repone más seguido.
 */
export const MODOS = {
    porcentaje: 'Un % del stock total',
    cuerpos:    'Llenar N cuerpos',
    todo:       'Todo lo del buffer',
    // Un tope fijo en pares, sin importar cuánto entre en un cuerpo. Lo pide el escolar:
    // bajan 50 pares y el resto va a reserva, vengan 300 o 3.000. Ver PARES_ESCOLAR.
    pares:      'Un tope fijo de pares'
};

export const modoPorDefecto = () => ({ modo: 'cuerpos', valor: 1 });

export const marcasPorDefecto = () => ({
    'Bata':          { modo: 'porcentaje', valor: 50 },
    'North Star':    { modo: 'porcentaje', valor: 50 },
    'Bubblegummers': { modo: 'porcentaje', valor: 50 },
    // Es la misma marca que Bubblegummers, así que va con la misma regla
    'B.G Licenses':  { modo: 'porcentaje', valor: 50 },
    'Power':         { modo: 'cuerpos', valor: 1 },
    'Weinbrenner':   { modo: 'cuerpos', valor: 1 },
    'Bata Industrials': { modo: 'cuerpos', valor: 1 },
    'Marie Claire':  { modo: 'cuerpos', valor: 1 },
    // LAS TRES DEL MEZZANINE 3 NO MANDAN NADA A RESERVA, llegue lo que llegue. Puma estaba en
    // un cuerpo y pasó acá el 05-ago-2026, con Adidas y Skechers, por regla de Daniel: las tres
    // viven en el mezzanine 3 y ahí se quedan. Si la zona se llena, lo que no entra se queda en
    // el buffer y vuelve en la corrida siguiente — a reserva no sube.
    'Adidas':        { modo: 'todo', valor: 0 },
    'Puma':          { modo: 'todo', valor: 0 },
    'Skechers':      { modo: 'todo', valor: 0 }
});

/** La regla de una marca. Si no está configurada, se la trata como mediana. */
export const modoDeMarca = (marca) => {
    const m = String(marca || '').trim();
    const cfg = tallasActual().marcas || marcasPorDefecto();
    if (cfg[m]) return cfg[m];
    const buscado = m.toUpperCase().replace(/\s+/g, ' ');
    const hallado = Object.keys(cfg).find(k => k.toUpperCase().replace(/\s+/g, ' ') === buscado);
    return hallado ? cfg[hallado] : modoPorDefecto();
};

/**
 * Cuántos pares del buffer bajan al piso y cuántos van arriba a reserva.
 *
 * A reserva solo se mandan CAJAS CERRADAS, así que lo que va arriba se recorta al múltiplo
 * del factor y la diferencia se queda abajo. Por eso el resultado puede pasarse un poco del
 * objetivo: es a propósito.
 */
export const cuantoAlPiso = ({ marca, buffer, piso = 0, reserva = 0, paresPorCuerpo = 330, factor = FACTOR_POR_DEFECTO }) => {
    const b = Math.max(0, Math.round(Number(buffer) || 0));
    const p = Math.max(0, Number(piso) || 0);
    const r = Math.max(0, Number(reserva) || 0);
    const f = Math.max(1, Math.round(Number(factor) || FACTOR_POR_DEFECTO));
    const regla = modoDeMarca(marca);
    if (!b) return { alPiso: 0, aReserva: 0, regla, objetivo: 0, total: b + p + r };

    let objetivo;                       // cuánto TENDRÍA que haber en piso al terminar
    if (regla.modo === 'todo')            objetivo = p + b;
    else if (regla.modo === 'cuerpos')    objetivo = Math.max(1, Number(regla.valor) || 1) * paresPorCuerpo;
    else                                  objetivo = (b + p + r) * ((Number(regla.valor) || 50) / 100);

    // Lo que falta para llegar al objetivo, sin pasarse de lo que hay en el buffer
    const falta = Math.max(0, Math.min(b, objetivo - p));
    // A reserva van cajas cerradas; el resto se queda abajo
    const aReserva = Math.floor((b - falta) / f) * f;
    return { alPiso: b - aReserva, aReserva, regla, objetivo: Math.round(objetivo), total: b + p + r };
};

/**
 * PALETIZAR PARA RESERVA no es lo mismo que almacenar en el piso.
 *
 * Bajar al activo es romper la caja, cortar la cinta, sacar par por par y ubicar. Subir a
 * reserva es armar la paleta, enfilarla y sacarle el LPN. Si los pares de las dos cosas se
 * cuentan igual, una tarea con mucha reserva sale con una productividad inflada.
 *
 * Se mide POR PALETA y no en pares por hora, porque una paleta a medio llenar lleva casi el
 * mismo tiempo que una llena: igual hay que enfilarla y darle su LPN.
 *
 * Los 5 minutos los puso Daniel el 01-ago-2026. Su primera estimación fueron 8 a 10 y
 * después la bajó a 5; queda editable por si en la práctica sale corta.
 */
export const reservaPorDefecto = () => ({ paresPorPaleta: 200, minutosPorPaleta: 5 });

/** Paletas que salen de esos pares. Una a medio llenar cuenta entera. */
export const paletasDe = (pares) => {
    const r = tallasActual().reserva || reservaPorDefecto();
    const p = Math.max(0, Math.round(Number(pares) || 0));
    return p ? Math.ceil(p / Math.max(1, r.paresPorPaleta)) : 0;
};

/** Minutos que lleva paletizar esos pares para reserva. */
export const minutosDeReserva = (pares) => {
    const r = tallasActual().reserva || reservaPorDefecto();
    return paletasDe(pares) * Math.max(0, r.minutosPorPaleta);
};

export const tallasPorDefecto = () => ({
    marcas: marcasPorDefecto(),
    reserva: reservaPorDefecto(),
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

    const marcas = {};
    const mSrc = (c.marcas && typeof c.marcas === 'object') ? c.marcas : def.marcas;
    Object.keys(mSrc).forEach(k => {
        const v = mSrc[k] || {};
        const modo = MODOS[v.modo] ? v.modo : 'cuerpos';
        let valor = Number(v.valor);
        if (!Number.isFinite(valor) || valor < 0) valor = modo === 'porcentaje' ? 50 : 1;
        if (modo === 'porcentaje') valor = Math.min(100, valor);
        if (modo === 'cuerpos') valor = Math.max(1, Math.round(valor));
        if (modo === 'pares') valor = Math.max(0, Math.round(valor));
        marcas[String(k).trim()] = { modo, valor };
    });

    const rSrc = (c.reserva && typeof c.reserva === 'object') ? c.reserva : def.reserva;
    const _ent = (v, resp, min, max) => {
        const n = Math.round(Number(v));
        return (Number.isFinite(n) && n >= min && n <= max) ? n : resp;
    };
    const reserva = {
        paresPorPaleta: _ent(rSrc.paresPorPaleta, def.reserva.paresPorPaleta, 1, 100000),
        minutosPorPaleta: _ent(rSrc.minutosPorPaleta, def.reserva.minutosPorPaleta, 0, 600)
    };

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
    return {
        marcas: Object.keys(marcas).length ? marcas : def.marcas,
        reserva,
        categorias: Object.keys(categorias).length ? categorias : def.categorias
    };
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

/**
 * QUÉ BAJA AL PISO, TALLA POR TALLA.
 *
 * Se repone la TALLA, no el artículo. Un cuerpo puede estar lleno en total y aun así tener
 * la talla 40 en dos pares: si se mira solo el total se manda todo a reserva y esa talla se
 * quiebra. Por eso el reparto por tallas no sirve solo para repartir lo que baja — define
 * CUÁNTO TIENE QUE HABER de cada talla en el piso, y la reposición llena las que faltan.
 *
 * Las tallas que ya llegaron a su objetivo no reciben nada. Las que faltan bajan aunque el
 * cuerpo esté pasado en total: el cuerpo se queda un tiempo por encima hasta que se venda
 * lo sobrante, que fue la decisión de Daniel. Lo que sobra del buffer sube a reserva en
 * cajas cerradas; las unidades sueltas se quedan abajo.
 *
 * porTalla: { '38': { buffer, piso }, '39': {...} }  — lo que hay hoy de cada talla.
 */
export const planificarPorTalla = ({ marca, categoria, porTalla, paresPorCuerpo = 300,
                                     piso = 0, reserva = 0, factor = FACTOR_POR_DEFECTO,
                                     reglaForzada = null }) => {
    const f = Math.max(1, Math.round(Number(factor) || FACTOR_POR_DEFECTO));
    const tallas = porTalla && typeof porTalla === 'object' ? porTalla : {};
    const claves = Object.keys(tallas);
    if (!claves.length) return null;

    const bufferTotal = claves.reduce((a, t) => a + (Number(tallas[t].buffer) || 0), 0);
    const pisoTotal = piso || claves.reduce((a, t) => a + (Number(tallas[t].piso) || 0), 0);

    // 1. Cuánto TENDRÍA que haber del artículo entero en el piso
    //
    // MANDA EL ORIGEN, NO LA MARCA. La regla de la marca —la mitad del stock para Bata, un
    // cuerpo para Power— es la de mercadería NUEVA, y se venía aplicando también a lo que
    // bajaba de reserva: el replenishment mandaba bajar 421 pares porque una talla estaba
    // por quebrar, y la tarea devolvía 120 al rack. Medido sobre el buffer del 04-ago, de
    // los 6.993 pares parados en CDBUFFER-B volvían arriba 4.520, el 65%.
    //
    // Por eso quien llama puede forzar la regla según de dónde vino la mercadería. Si no
    // fuerza nada, sigue mandando la marca y no cambia nada.
    const regla = reglaForzada || modoDeMarca(marca);
    let objetivoArt;
    if (regla.modo === 'todo')          objetivoArt = pisoTotal + bufferTotal;
    else if (regla.modo === 'cuerpos')  objetivoArt = Math.max(1, Number(regla.valor) || 1) * paresPorCuerpo;
    // TOPE FIJO EN PARES. No se mide en cuerpos: son los pares que tienen que quedar abajo y
    // nada más. El escolar va así — 50 pares, lleguen 300 o 3.000.
    else if (regla.modo === 'pares')    objetivoArt = Math.max(0, Number(regla.valor) || 0);
    else                                objetivoArt = (bufferTotal + pisoTotal + (Number(reserva) || 0)) * ((Number(regla.valor) || 50) / 100);

    // EL CANDADO. Un cuerpo no se comparte entre dos artículos, así que ocuparlo cuesta lo
    // mismo con 160 pares que con 500. Dejarlo a medio llenar y mandar el resto arriba no
    // ahorra un centímetro de espacio: solo obliga a bajarlo de nuevo la semana que viene.
    //
    // El objetivo se redondea al CUERPO ENTERO más cercano, con un mínimo de uno, y nunca
    // por encima de lo que hay. Así:
    //   350 pares y un cuerpo de 332  ->  entran todos, nada a reserva
    //   500 pares y un cuerpo de 700  ->  entran todos, nada a reserva
    //   1.500 pares y un cuerpo de 700 -> 700 abajo (un cuerpo lleno) y 800 arriba
    //
    // No se aplica a 'todo' -que ya baja todo- ni a 'cuerpos', que por definición ya es un
    // número entero de cuerpos.
    //
    // `sinCandado` -que usa el código nuevo con su 60%- apaga el REDONDEO, no el piso de
    // abajo. Son dos cosas distintas y conviene no confundirlas:
    //
    //   REDONDEO   llevar el objetivo al cuerpo entero más cercano. Al código nuevo no se le
    //              aplica: "no importa si me ocupa un cuerpo, dos cuerpos o tres cuerpos,
    //              pero el sesenta por ciento tiene que quedarse abajo".
    //
    //   PISO       si TODO lo que hay entra en un cuerpo, baja todo. Este vale siempre, y el
    //              código nuevo lo necesita más que nadie. El 5616307 llegó con 125 pares a
    //              un cuerpo del selectivo de 548: sacarle el 40% dejaba 75 abajo —un cuerpo
    //              al 14%, porque un cuerpo no se comparte— y mandaba 50 pares a armar una
    //              paleta. No se ahorra nada y hay que volver a bajarlos. Daniel, 05-ago-2026:
    //              "si un código nuevo llega con trescientos, no vayas a separar el sesenta
    //              por ciento, porque sabes que esos trescientos sí entran en un cuerpo".
    //
    // Para las marcas no cambia nada: el candado viejo ya daba esto mismo cuando lo que había
    // entraba en un cuerpo, porque el mínimo de un cuerpo se recortaba contra lo que hay.
    let candado = null;
    if (regla.modo === 'porcentaje' && paresPorCuerpo > 0) {
        const hay = pisoTotal + bufferTotal;
        const conCandado = (hay <= paresPorCuerpo)
            ? hay                                                    // el piso: cabe en un cuerpo
            : (regla.sinCandado
                ? objetivoArt                                        // el 60% manda, sin redondear
                : Math.min(Math.max(1, Math.round(objetivoArt / paresPorCuerpo)) * paresPorCuerpo, hay));
        if (Math.round(conCandado) !== Math.round(objetivoArt)) {
            candado = { antes: Math.round(objetivoArt),
                        cuerpos: Math.max(1, Math.round(conCandado / paresPorCuerpo)),
                        capacidad: paresPorCuerpo };
        }
        objetivoArt = conCandado;
    }

    // 2. Ese objetivo se reparte entre las tallas, con los porcentajes de la categoría.
    //
    // Los porcentajes se renormalizan sobre LAS TALLAS QUE EL ARTÍCULO TIENE, no sobre
    // todas las de la categoría. Un artículo de KIDS puede venir solo en la 26 a la 29
    // mientras la categoría tiene 19 tallas: repartiendo sobre las 19, el 80% del objetivo
    // se le asigna a tallas que ese artículo no existe y se pierde. Con 1.590 pares en
    // buffer bajaban 170 en vez de 800.
    const cat = tallasActual().categorias[String(categoria || '').toUpperCase()];
    const suma = cat ? claves.reduce((a, t) => a + (Number(cat.porcentajes[t]) || 0), 0) : 0;

    const filas = claves.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).map(t => {
        const buf = Math.max(0, Math.round(Number(tallas[t].buffer) || 0));
        const pis = Math.max(0, Math.round(Number(tallas[t].piso) || 0));
        // Sin perfil de tallas, se reparte parejo entre las que tiene el artículo
        const pct = (cat && suma > 0) ? (Number(cat.porcentajes[t]) || 0) / suma : 1 / claves.length;
        const objetivo = regla.modo === 'todo' ? pis + buf : Math.round(objetivoArt * pct);

        const falta = Math.max(0, objetivo - pis);
        let asignado = Math.min(buf, Math.round(falta / f) * f);
        if (asignado === 0 && falta > 0 && buf > 0) asignado = Math.min(buf, f);  // al menos una caja

        return { talla: t, buffer: buf, piso: pis, objetivo, falta, pct, asignado,
                 comercial: !!(cat && cat.comerciales.includes(t)) };
    });

    // SEGUNDA PASADA. La parte del objetivo que le tocaba a una talla SIN buffer no la puede
    // cubrir nadie y se perdía en el aire: el artículo quedaba por debajo de su objetivo y al
    // mismo tiempo subía mercadería a reserva, teniendo lugar abajo. Pasaba con North Star:
    // 72 pares en buffer, el cuerpo con lugar de sobra, y 30 se iban arriba igual.
    //
    // Si el artículo sigue corto y hay tallas con buffer de sobra, se les da más —de a cajas
    // enteras, y primero a las de mayor peso, que son las comerciales.
    let faltaArt = Math.round(objetivoArt) - pisoTotal - filas.reduce((a, x) => a + x.asignado, 0);
    if (faltaArt >= f) {
        const conSobra = filas.filter(x => x.buffer > x.asignado)
                              .sort((a, b) => b.pct - a.pct || b.buffer - a.buffer);
        let sigue = true;
        while (faltaArt >= f && sigue) {
            sigue = false;
            for (const x of conSobra) {
                if (faltaArt < f) break;
                if (x.buffer - x.asignado >= f) { x.asignado += f; faltaArt -= f; sigue = true; }
            }
        }
    }

    // Recién ahora se decide qué sube: a reserva solo cajas cerradas, lo suelto se queda abajo
    filas.forEach(x => {
        x.aReserva = Math.floor((x.buffer - x.asignado) / f) * f;
        x.baja = x.buffer - x.aReserva;
    });

    return {
        regla, candado, objetivoArticulo: Math.round(objetivoArt), paresPorCuerpo, factor: f,
        bufferTotal, pisoTotal, filas,
        alPiso: filas.reduce((a, x) => a + x.baja, 0),
        aReserva: filas.reduce((a, x) => a + x.aReserva, 0),
        sinPerfil: !cat
    };
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
