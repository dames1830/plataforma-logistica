/**
 * SLOTTING — TAREAS PARA ORDENAR EL ALMACÉN
 *
 * Pedido de Daniel el 01-ago-2026 y construido el 14-ago. Hasta ahora, cuando el cálculo de
 * almacenaje se topaba con un cuerpo que tenía dos artículos, lo resolvía como podía y **el
 * problema se perdía**: a la noche siguiente reaparecía igual porque nadie lo había anotado.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * NO SON HALLAZGOS PARA MIRAR: SON TAREAS PARA TRABAJAR
 *
 * Daniel, 14-ago-2026: *"en el cuerpo veinte está el artículo X, pero también está el B. Quien
 * tenga más cantidad, le pertenece a ese artículo. Si el X tiene doscientos y el B tiene
 * veinte, ese cuerpo le pertenece al X. El B hay que sacarlo, entonces ahí tiene veinte ya por
 * sacar, y así que vaya acumulando"*.
 *
 * De ahí salen las tres reglas del módulo:
 *
 *   EL DUEÑO ES EL QUE MÁS PARES TIENE. No el más antiguo ni el de la marca de la columna:
 *   el que más ocupa. Mover al que menos hay es el trabajo más barato.
 *
 *   LO DEL RESTO SE SACA. Cada artículo que no es el dueño se convierte en una línea de
 *   trabajo: sacar N pares de tal ubicación.
 *
 *   SE ACUMULA EN TAREAS. Las líneas se juntan hasta llegar a un volumen de trabajo —300
 *   pares por defecto—, ordenadas por ubicación para que el operario recorra una columna por
 *   vez y no cruce el almacén de ida y vuelta.
 *
 * Este archivo NO decide nada ni sale a buscar datos: guarda, lee y cuenta. Quien encuentra
 * los cuerpos es `barrerParaSlotting` en dashboard_v28.js, y quien los muestra es la pantalla.
 * ══════════════════════════════════════════════════════════════════════════════
 */

const AREA = 'slotting_tareas';
const _url = () =>
    `${window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com'}/api/logistics/${AREA}?date=MASTER`;

/** Cuántos pares junta una tarea antes de cerrarla. */
export const PARES_POR_TAREA = 300;

/** Los estados por los que pasa una tarea. El orden es el del avance. */
export const ESTADOS = {
    pendiente: { etiqueta: 'Por hacer',  color: '#f59e0b' },
    proceso:   { etiqueta: 'En proceso', color: '#3b82f6' },
    hecha:     { etiqueta: 'Hecha',      color: '#22c55e' }
};

/** La fecha y hora de acá. Nunca toISOString: devuelve UTC y a las 19:00 ya es otro día. */
const sello = () => {
    const d = new Date(), dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())} `
         + `${dd(d.getHours())}:${dd(d.getMinutes())}`;
};

export const traerTareas = async () => {
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

export const guardarTareas = async (cajon) => {
    const res = await fetch(_url(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cajon || {})
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return true;
};

/**
 * ARMA LAS TAREAS a partir de las líneas por sacar.
 *
 * Se ordenan por ubicación y se van juntando hasta el tope. Una línea sola más grande que el
 * tope se queda sola en su tarea: partir la mercadería de un cuerpo entre dos operarios es
 * peor que una tarea grande.
 */
export const armarTareas = (lineas, tope = PARES_POR_TAREA) => {
    const orden = [...(lineas || [])].sort((a, b) => String(a.ubi).localeCompare(String(b.ubi)));
    const tareas = [];
    let actual = [], suma = 0;
    orden.forEach(l => {
        const p = Math.round(Number(l.pares) || 0);
        if (suma > 0 && suma + p > tope) { tareas.push({ lineas: actual, pares: suma }); actual = []; suma = 0; }
        actual.push(l); suma += p;
    });
    if (actual.length) tareas.push({ lineas: actual, pares: suma });
    return tareas;
};

/**
 * GUARDA LA CORRIDA DEL DÍA.
 *
 * Las tareas se rehacen en cada barrido —el almacén cambió y el reparto de ayer ya no
 * corresponde— PERO lo que el equipo marcó como hecho no se toca: esas líneas ya no están
 * mezcladas, así que el barrido siguiente no las va a volver a encontrar. Si alguna vuelve a
 * aparecer es porque el problema volvió, y entonces sí corresponde que salga de nuevo.
 *
 * Se guarda por jornada: `2026-08-14`. Así se puede ver qué se hizo cada día sin que una
 * corrida pise la anterior.
 */
export const publicarCorrida = async (fecha, lineas, zona) => {
    const cajon = await traerTareas();
    const tareas = armarTareas(lineas);
    const previo = cajon[fecha];
    // Lo ya trabajado se respeta: se busca por la firma de la línea, no por el número de tarea
    const hechas = new Map();
    (previo && previo.tareas || []).forEach((t, i) => {
        if (t.estado && t.estado !== 'pendiente') {
            (t.lineas || []).forEach(l => hechas.set(`${l.ubi}|${l.sku7}`, t.estado));
        }
    });

    cajon[fecha] = {
        fecha, zona: zona || 'SEL', generado: sello(),
        cuerpos: [...new Set(lineas.map(l => l.ubi))].length,
        pares: lineas.reduce((a, l) => a + (Number(l.pares) || 0), 0),
        tareas: tareas.map((t, i) => {
            // Si TODAS sus líneas ya estaban trabajadas, la tarea nace con ese estado
            const est = t.lineas.map(l => hechas.get(`${l.ubi}|${l.sku7}`)).filter(Boolean);
            return {
                n: i + 1, pares: t.pares, lineas: t.lineas,
                estado: (est.length === t.lineas.length && est.length) ? est[0] : 'pendiente',
                nota: ''
            };
        })
    };

    // Se guardan 30 días: alcanza para ver el avance del mes y no crece sin control
    const dias = Object.keys(cajon).sort();
    if (dias.length > 30) dias.slice(0, dias.length - 30).forEach(d => delete cajon[d]);

    await guardarTareas(cajon);
    return cajon[fecha];
};

/** El avance de una corrida: cuántas tareas hechas de cuántas. */
export const resumen = (corrida) => {
    const tareas = (corrida && corrida.tareas) || [];
    const por = { pendiente: 0, proceso: 0, hecha: 0 };
    tareas.forEach(t => { por[t.estado] = (por[t.estado] || 0) + 1; });
    const total = tareas.length;
    return {
        total, ...por,
        avance: total ? Math.round(por.hecha / total * 100) : 0,
        pares: (corrida && corrida.pares) || 0,
        cuerpos: (corrida && corrida.cuerpos) || 0,
        generado: (corrida && corrida.generado) || '',
        zona: (corrida && corrida.zona) || ''
    };
};

/** Las fechas guardadas, de la más nueva a la más vieja. */
export const fechasDe = (cajon) => Object.keys(cajon || {}).sort().reverse();
