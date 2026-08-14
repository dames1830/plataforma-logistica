/**
 * SLOTTING — DONDE ATERRIZA LO QUE EL CÁLCULO ENCUENTRA ROTO
 *
 * Pedido de Daniel el 01-ago-2026 y construido el 14-ago. Hasta ahora, cuando la tarea de
 * almacenaje se topaba con un problema —un cuerpo con dos artículos, un código sin dónde ir—
 * lo resolvía como podía y **el hallazgo se perdía**. A la noche siguiente reaparecía igual,
 * porque nadie lo había anotado en ningún lado.
 *
 * Daniel, 14-ago-2026: *"crea el módulo slotting y esas casuísticas, esos problemas los vas
 * pasando a ese módulo. Ya sabes que todo debe estar conectado, ningún módulo debe estar
 * independiente, porque uno depende de otro"*.
 *
 * Este archivo NO decide nada: guarda, lee y cuenta. Quien encuentra los problemas es el
 * cálculo de la tarea (ver `hallazgosDeMezcla` en dashboard_v28.js) y quien los muestra es la
 * pantalla. Es el mismo reparto que tienen los demás servicios.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * LO QUE SE GUARDA, Y LO QUE NO SE PISA
 *
 * La ubicación es la clave: `MZN02-20-19`. Un cuerpo con problema es UN registro, aunque
 * aparezca veinte noches seguidas.
 *
 * Al registrar de nuevo un hallazgo que ya existe se actualiza lo que cambia solo —cuándo se
 * vio por última vez, cuántas veces, qué artículos hay hoy adentro— y **NUNCA el estado ni la
 * nota**: eso lo escribe la persona que lo está revisando y el robot no se lo puede llevar
 * puesto.
 *
 * Con una excepción que importa: si un hallazgo estaba RESUELTO y vuelve a aparecer, vuelve a
 * pendiente. Que el problema haya vuelto es información, no ruido — y si se quedara en
 * "resuelto" el módulo mentiría.
 * ══════════════════════════════════════════════════════════════════════════════
 */

const AREA = 'slotting_hallazgos';
const _url = () =>
    `${window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com'}/api/logistics/${AREA}?date=MASTER`;

/** Los estados por los que pasa un hallazgo. El orden es el del avance. */
export const ESTADOS = {
    pendiente: { etiqueta: 'Por revisar', color: '#f59e0b' },
    proceso:   { etiqueta: 'En proceso',  color: '#3b82f6' },
    resuelto:  { etiqueta: 'Resuelto',    color: '#22c55e' }
};

/** Qué clase de problema es. Nace con uno solo; la idea es que entren más sin rehacer nada. */
export const TIPOS = {
    mezcla: {
        etiqueta: 'Dos o más artículos en un cuerpo',
        detalle: 'La franja pide un cuerpo por artículo y hay más de uno adentro.'
    },
    sin_lugar: {
        etiqueta: 'Sin cuerpo donde almacenar',
        detalle: 'El artículo llegó al buffer y no hay lugar en las columnas que le tocan.'
    }
};

/** La fecha y hora de acá, nunca toISOString: devuelve UTC y a las 19:00 ya es otro día. */
const sello = () => {
    const d = new Date(), dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())} `
         + `${dd(d.getHours())}:${dd(d.getMinutes())}`;
};

const soloDia = (txt) => String(txt || '').substring(0, 10);

/** Lo guardado. Devuelve {} si no hay nada o si el servidor no contesta. */
export const traerHallazgos = async () => {
    try {
        const res = await fetch(`${_url()}&t=${Date.now()}`);
        if (!res.ok) return {};
        const cuerpo = await res.json();
        const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
        return (datos && typeof datos === 'object' && !Array.isArray(datos)) ? datos : {};
    } catch (e) {
        console.warn('[Slotting] no se pudo leer:', e && e.message);
        return {};
    }
};

/** Escribe el cajón entero. Quien llama ya lo releyó y lo modificó. */
export const guardarHallazgos = async (cajon) => {
    const res = await fetch(_url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cajon || {})
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return true;
};

/**
 * REGISTRA LO QUE ENCONTRÓ LA CORRIDA. Es la puerta de entrada del módulo.
 *
 * `nuevos` son objetos { tipo, zona, columna, cuerpo, articulos[], detalle }. Se relee el
 * cajón, se mezcla y se guarda: si dos PC corren tareas casi a la vez, ninguna pierde lo de
 * la otra.
 *
 * Devuelve un resumen para poder avisarlo en pantalla sin volver a leer.
 */
export const registrarHallazgos = async (nuevos) => {
    const lista = (nuevos || []).filter(h => h && h.zona && h.columna && h.cuerpo);
    if (!lista.length) return { nuevos: 0, repetidos: 0, reabiertos: 0, total: 0 };

    const cajon = await traerHallazgos();
    const ahora = sello();
    let nCrea = 0, nRep = 0, nReab = 0;

    lista.forEach(h => {
        const id = `${h.zona}-${String(h.columna).padStart(2, '0')}-${String(h.cuerpo).padStart(2, '0')}`;
        const arts = [...new Set((h.articulos || []).map(String))].sort();
        const previo = cajon[id];

        /* LOS DATOS DEL ARTÍCULO VIAJAN CON EL HALLAZGO.
         *
         * Daniel, 14-ago-2026: *"que vaya sacando la cantidad, la marca, temporada, todo, para
         * que el equipo de slotting vaya de frente a ese artículo"*. Sin eso, quien abre el
         * módulo tiene una ubicación y nada más, y le toca ir a buscar a otra pantalla qué hay
         * ahí adentro — que es justo el trabajo que este módulo tiene que ahorrarle. */
        const items = (h.items || []).map(i => ({
            sku7: String(i.sku7 || ''), pares: Math.round(Number(i.pares) || 0),
            marca: String(i.marca || ''), temporada: String(i.temporada || ''),
            categoria: String(i.categoria || '')
        })).sort((a, b) => b.pares - a.pares);

        if (!previo) {
            cajon[id] = {
                id, tipo: h.tipo || 'mezcla',
                zona: h.zona, columna: Number(h.columna), cuerpo: Number(h.cuerpo),
                articulos: arts, items, detalle: h.detalle || '',
                visto: ahora, ultimo: ahora, ultimoContado: ahora, veces: 1,
                estado: 'pendiente', nota: ''
            };
            nCrea++;
            return;
        }

        // Ya estaba: se actualiza lo que cambia solo y se respeta lo que escribió la persona
        previo.ultimo = ahora;
        previo.articulos = arts;
        previo.items = items;
        previo.detalle = h.detalle || previo.detalle;
        // Una vez por día, no una por corrida: dos corridas en el mismo turno no son dos
        // apariciones del problema, es el mismo problema visto dos veces.
        if (soloDia(previo.ultimoContado) !== soloDia(ahora)) {
            previo.veces = (Number(previo.veces) || 1) + 1;
            previo.ultimoContado = ahora;
        }
        if (previo.estado === 'resuelto') { previo.estado = 'pendiente'; previo.reabierto = ahora; nReab++; }
        else nRep++;
    });

    // Y el sello de la corrida, para que la pantalla pueda decir de cuándo son los datos
    cajon.__corrida = ahora;

    await guardarHallazgos(cajon);
    return { nuevos: nCrea, repetidos: nRep, reabiertos: nReab, total: lista.length };
};

/** Los hallazgos como lista, sin la marca de corrida y ordenados: lo pendiente primero. */
export const comoLista = (cajon) => {
    const orden = { pendiente: 0, proceso: 1, resuelto: 2 };
    return Object.keys(cajon || {})
        .filter(k => k !== '__corrida')
        .map(k => cajon[k])
        .filter(h => h && h.id)
        .sort((a, b) => (orden[a.estado] ?? 0) - (orden[b.estado] ?? 0)
                     || (b.veces || 0) - (a.veces || 0)
                     || String(a.id).localeCompare(String(b.id)));
};

/**
 * EL AVANCE, que es lo que Daniel pidió ver: *"100 cuerpos por revisar, hicieron 60 → 60%"*.
 *
 * Cuenta sobre el total del módulo, no sobre lo de hoy: la pregunta es cuánto lleva revisado
 * el equipo, y un hallazgo de la semana pasada sin tocar sigue siendo trabajo pendiente.
 */
export const resumen = (cajon) => {
    const lista = comoLista(cajon);
    const por = { pendiente: 0, proceso: 0, resuelto: 0 };
    lista.forEach(h => { por[h.estado] = (por[h.estado] || 0) + 1; });
    const total = lista.length;
    return {
        total, ...por,
        avance: total ? Math.round(por.resuelto / total * 100) : 0,
        corrida: (cajon && cajon.__corrida) || ''
    };
};
