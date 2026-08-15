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

/** Cuántos pares junta una tarea antes de cerrarla. Es el respaldo: manda la configuración. */
export const PARES_POR_TAREA = 300;

/* ══════════════════════════════════════════════════════════════════════════════
 * LOS ESTADOS SON LOS MISMOS DE ALMACENAJE, y eso es a propósito.
 *
 * Daniel, 15-ago-2026: la tarea de Slotting se asigna, se inicia y se finaliza igual que la de
 * almacenaje, con las mismas reglas. Tener dos vocabularios para el mismo ciclo obliga a
 * traducir en cada pantalla y en cada reporte, y ahí es donde los números dejan de cuadrar.
 *
 * 'Vencida' se muestra como NO TRABAJADA, igual que allá: no es un error, es el final normal
 * de lo que no se alcanzó en el turno.
 *
 * Las corridas guardadas antes de la v29.0218 traen los estados viejos —pendiente, proceso,
 * hecha—; `migrarEstado` los traduce al leer, así no hay que tocar lo que ya está en el
 * servidor.
 * ══════════════════════════════════════════════════════════════════════════════ */
export const ESTADOS = {
    Creada:     { etiqueta: 'CREADA',        color: '#60a5fa' },
    Asignado:   { etiqueta: 'ASIGNADO',      color: '#eab308' },
    Finalizado: { etiqueta: 'FINALIZADO',    color: '#22c55e' },
    Vencida:    { etiqueta: 'NO TRABAJADA',  color: '#94a3b8' }
};

const ESTADO_VIEJO = { pendiente: 'Creada', proceso: 'Asignado', hecha: 'Finalizado' };
export const migrarEstado = (t) => {
    if (!t) return 'Creada';
    const s = t.status || t.estado || '';
    return ESTADOS[s] ? s : (ESTADO_VIEJO[s] || 'Creada');
};

/* ══════════════════════════════════════════════════════════════════════════════
 * LA CONFIGURACIÓN. Ningún número de estos vive en el código.
 *
 * Daniel, 15-ago-2026: *"pongo mi configuración de Slotting, y ahí pongo el tiempo mínimo de
 * una tarea y también la productividad por hora, para que sea dinámico"*.
 *
 * EL TIEMPO MÍNIMO ES LO QUE HACE QUE LA META NO SEA ABSURDA. Sin él, una tarea de un par
 * tendría que hacerse en 24 segundos: *"eso lo va a tener que hacer en tres segundos, es
 * imposible"*. Con la base, se le dan 10 minutos y 24 segundos.
 *
 * `minutosPorCuerpoExtra` queda en 0 y se prueba así: en 0 la base es una sola por tarea, como
 * en almacenaje. Una tarea de Slotting visita VARIOS cuerpos —hay de cinco—, así que si las
 * grandes salen siempre en rojo se le sube sin tocar código.
 *
 * Vive en el cajón `config` del servidor, al lado de `zonas` y `jornada`. Al guardar se relee
 * el cajón entero y se reemplaza SOLO la clave `slotting`, para no pisar a los vecinos.
 * ══════════════════════════════════════════════════════════════════════════════ */
const URL_CONFIG = () =>
    `${window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com'}/api/logistics/config`;

export const configPorDefecto = () => ({
    tiempoBase: 10,             // minutos de recorrido, iguales a los de almacenaje
    minutosPorCuerpoExtra: 0,   // 0 = una sola base por tarea
    uphSolo: 150,               // pares por hora con un operario
    uphGrupo: 300,              // pares por hora con dos
    paresPorTarea: PARES_POR_TAREA,
    zonas: ['SEL', 'MZN01', 'MZN02', 'MZN03'],  // el MZN04 nunca entra: no lleva calzado
    /* UNA SOLA CORRIDA POR TURNO. Daniel, 15-ago-2026: *"el procesar slotting solamente se
     * tiene que dar una vez por turno"* — entre las 20:00 y las 06:30.
     *
     * El motivo es la posta: volver a procesar rehace el reparto entero, así que las tareas
     * que el equipo tiene en la mano dejan de existir y las que ya empezó cambian de número.
     * Se puede apagar desde acá para las noches en que haga falta correrlo de nuevo.
     *
     * EL BOTÓN NO SE OCULTA NI SE DESHABILITA, decisión suya: queda igual y al apretarlo sale
     * el aviso. Un botón que desaparece hace pensar que se rompió algo. */
    unaVezPorTurno: true
});

let _config = configPorDefecto();
export const configActual = () => _config;

const normalizar = (c) => {
    const d = configPorDefecto();
    const n = (v, def, min, max) => {
        const x = Number(v);
        return Number.isFinite(x) && x >= min && x <= max ? x : def;
    };
    return {
        tiempoBase: n(c && c.tiempoBase, d.tiempoBase, 0, 600),
        minutosPorCuerpoExtra: n(c && c.minutosPorCuerpoExtra, d.minutosPorCuerpoExtra, 0, 600),
        uphSolo: n(c && c.uphSolo, d.uphSolo, 1, 100000),
        uphGrupo: n(c && c.uphGrupo, d.uphGrupo, 1, 100000),
        paresPorTarea: n(c && c.paresPorTarea, d.paresPorTarea, 1, 100000),
        zonas: (Array.isArray(c && c.zonas) && c.zonas.length ? c.zonas : d.zonas)
            .filter(z => d.zonas.includes(z)),
        unaVezPorTurno: typeof (c && c.unaVezPorTurno) === 'boolean' ? c.unaVezPorTurno : d.unaVezPorTurno
    };
};

/**
 * ¿YA SE PROCESÓ EN ESTE TURNO?
 *
 * El turno es la JORNADA LÓGICA —de las 20:00 a las 06:30—, que ya la resuelve jornadaService:
 * la corrida se guarda con esa fecha, así que alcanza con mirar si existe. No hace falta
 * guardar una marca aparte, y así no hay dos verdades que se puedan separar.
 */
export const yaSeProcesoEsteTurno = (cajon, fechaLogica) =>
    !!(cajon && cajon[fechaLogica] && (cajon[fechaLogica].tareas || []).length);

export const cargarConfig = async () => {
    try {
        const res = await fetch(`${URL_CONFIG()}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const cajon = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            _config = normalizar(cajon && cajon.slotting);
        }
    } catch (e) { console.warn('[Slotting] no se pudo leer la configuración:', e && e.message); }
    return _config;
};

export const guardarConfig = async (cfg) => {
    const limpia = normalizar(cfg);
    let cajon = {};
    try {
        const res = await fetch(`${URL_CONFIG()}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo de slotting */ }
    const res = await fetch(URL_CONFIG(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, slotting: limpia })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    _config = limpia;
    return limpia;
};

/**
 * CUÁNTO DEBERÍA TARDAR UNA TAREA, en minutos.
 *
 *     tiempo esperado = base + (cuerpos - 1) × extra + (pares ÷ meta por hora) × 60
 *
 * La meta por hora sale de cuánta gente la trabaja: 150 con uno, 300 con dos. Y la base es lo
 * que evita que una tarea de diez pares salga siempre en rojo.
 */
export const minutosEsperados = (t) => {
    const c = configActual();
    const cuerpos = Math.max(1, ((t && t.lineas) ? new Set(t.lineas.map(l => l.ubi)).size : 1));
    const uph = (t && t.u2) ? c.uphGrupo : c.uphSolo;
    const pares = Number(t && t.pares) || 0;
    return c.tiempoBase + (cuerpos - 1) * c.minutosPorCuerpoExtra
         + (uph > 0 ? (pares / uph) * 60 : 0);
};

/** Los minutos que de verdad tardó, o null si todavía no terminó. */
export const minutosReales = (t) => {
    if (!t || !t.inicio || !t.termino) return null;
    const a = new Date(t.inicio).getTime(), b = new Date(t.termino).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    return Math.round((b - a) / 60000);
};

/** Pares por hora de verdad. */
export const productividad = (t) => {
    const m = minutosReales(t);
    return m ? Math.round((Number(t.pares) || 0) / (m / 60)) : null;
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
 * ══════════════════════════════════════════════════════════════════════════════
 * LA UNIDAD ES EL CUERPO, NO EL PAR. Un cuerpo NUNCA se parte entre dos tareas.
 *
 * Decisión de Daniel del 14-ago-2026, después de medir las dos formas sobre la corrida real
 * —252 cuerpos mezclados, 1.106 líneas, 22.259 pares—:
 *
 *              por pares (como estaba)      por cuerpo
 *   tareas               86                     94
 *   mediana             269 pares              248 pares
 *   la más grande       300                    478
 *   CUERPOS PARTIDOS     27 (11%)               0
 *
 * Los 27 cuerpos partidos son el problema: el operario sacaba la mitad de los intrusos en una
 * tarea y la otra mitad quedaba para otra, quizás de otro día u otra persona. Mientras tanto
 * ese cuerpo **no sirve para nada** —sigue mezclado— y la tarea de almacenaje que lo estaba
 * esperando sigue bloqueada. **La unidad de valor es el cuerpo limpio; medio cuerpo limpio no
 * entrega nada.**
 *
 * El tope pasa a ser una GUÍA DE CARGA, no un corte: se juntan cuerpos enteros mientras entren,
 * y un cuerpo que por sí solo se pasa del tope se queda solo en su tarea. Con los datos del
 * 14-ago eso son 4 de 252 cuerpos, el mayor de 478 pares.
 *
 * Sale barato porque casi todos los cuerpos son chicos: limpiar uno cuesta 72 pares de mediana
 * y el 35% se limpian con 50 o menos.
 *
 * La regla ya existía para una línea suelta —"partir la mercadería de un cuerpo entre dos
 * operarios es peor que una tarea grande"—; esto la extiende al cuerpo entero, que es lo que
 * siempre quiso decir.
 * ══════════════════════════════════════════════════════════════════════════════
 */
export const armarTareas = (lineas, tope = PARES_POR_TAREA) => {
    // Primero se juntan las líneas de cada cuerpo, para no poder partirlo ni por error
    const porCuerpo = new Map();
    (lineas || []).forEach(l => {
        const k = String(l.ubi || '');
        if (!porCuerpo.has(k)) porCuerpo.set(k, []);
        porCuerpo.get(k).push(l);
    });

    // Y los cuerpos se recorren en orden de ubicación, para que el operario haga una columna
    // por vez y no cruce el almacén de ida y vuelta.
    const orden = [...porCuerpo.keys()].sort((a, b) => a.localeCompare(b));
    const tareas = [];
    let actual = [], suma = 0;
    orden.forEach(k => {
        const grupo = porCuerpo.get(k);
        const p = grupo.reduce((a, l) => a + Math.round(Number(l.pares) || 0), 0);
        if (suma > 0 && suma + p > tope) { tareas.push({ lineas: actual, pares: suma }); actual = []; suma = 0; }
        actual.push(...grupo); suma += p;
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
/** La marca de una tarea: la de más pares. Si toca varias, se avisa con un '+'. */
const marcaDe = (lineas) => {
    const por = new Map();
    (lineas || []).forEach(l => {
        const m = String(l.marca || '').trim();
        if (m) por.set(m, (por.get(m) || 0) + (Number(l.pares) || 0));
    });
    if (!por.size) return '';
    const orden = [...por.entries()].sort((a, b) => b[1] - a[1]);
    return orden[0][0] + (orden.length > 1 ? ' +' : '');
};

export const publicarCorrida = async (fecha, lineas, zona) => {
    const cajon = await traerTareas();
    const tareas = armarTareas(lineas, configActual().paresPorTarea);
    const previo = cajon[fecha];

    /* LO YA TRABAJADO NO SE PIERDE AL VOLVER A PROCESAR. Se busca por la firma de la línea y no
     * por el número de tarea, porque el reparto de la corrida nueva es otro. Y ahora viaja
     * TODO lo del ciclo —quién la hizo y a qué hora—, no solo el estado: sin eso, volver a
     * procesar borraba las asignaciones de la noche y el KPI se quedaba sin datos. */
    const hechas = new Map();
    (previo && previo.tareas || []).forEach(t => {
        const est = migrarEstado(t);
        if (est !== 'Creada') {
            (t.lineas || []).forEach(l => hechas.set(`${l.ubi}|${l.sku7}`,
                { status: est, u1: t.u1 || '', u2: t.u2 || '', inicio: t.inicio || '', termino: t.termino || '', nota: t.nota || '' }));
        }
    });

    cajon[fecha] = {
        fecha, zona: zona || 'SEL', generado: sello(),
        cuerpos: [...new Set(lineas.map(l => l.ubi))].length,
        pares: lineas.reduce((a, l) => a + (Number(l.pares) || 0), 0),
        tareas: tareas.map((t, i) => {
            // Si TODAS sus líneas ya estaban trabajadas, la tarea nace con ese estado y su gente
            const antes = t.lineas.map(l => hechas.get(`${l.ubi}|${l.sku7}`)).filter(Boolean);
            const viene = (antes.length === t.lineas.length && antes.length) ? antes[0] : null;
            return {
                n: i + 1, pares: t.pares, lineas: t.lineas,
                cuerpos: new Set(t.lineas.map(l => l.ubi)).size,
                marca: marcaDe(t.lineas),
                status: viene ? viene.status : 'Creada',
                u1: viene ? viene.u1 : '', u2: viene ? viene.u2 : '',
                inicio: viene ? viene.inicio : '', termino: viene ? viene.termino : '',
                nota: viene ? viene.nota : ''
            };
        })
    };

    // Se guardan 30 días: alcanza para ver el avance del mes y no crece sin control
    const dias = Object.keys(cajon).sort();
    if (dias.length > 30) dias.slice(0, dias.length - 30).forEach(d => delete cajon[d]);

    await guardarTareas(cajon);
    return cajon[fecha];
};

/**
 * LAS TAREAS VENCEN AL CERRAR LA JORNADA. Decisión de Daniel, 15-ago-2026: *"tienen que vencer
 * las tareas"*.
 *
 * Es la misma regla de almacenaje y por el mismo motivo: el barrido se rehace cada noche con el
 * almacén de ese momento, así que una Creada de hace tres días no significa nada. Se marca NO
 * TRABAJADA —no es un error, es el final normal de lo que no se alcanzó— y deja de contar.
 *
 * Las ASIGNADAS también vencen: si nadie la finalizó y la jornada cerró, no se finalizó. Lo que
 * está en Finalizado no se toca nunca.
 */
export const vencerLasViejas = (cajon, jornadaVencida) => {
    let n = 0;
    Object.keys(cajon || {}).forEach(fecha => {
        if (!jornadaVencida(fecha)) return;
        ((cajon[fecha] || {}).tareas || []).forEach(t => {
            const est = migrarEstado(t);
            if (est === 'Finalizado' || est === 'Vencida') return;
            t.status = 'Vencida';
            n++;
        });
    });
    return n;
};

/** El avance de una corrida: cuántas tareas hechas de cuántas. */
export const resumen = (corrida) => {
    const tareas = (corrida && corrida.tareas) || [];
    const por = { Creada: 0, Asignado: 0, Finalizado: 0, Vencida: 0 };
    tareas.forEach(t => { por[migrarEstado(t)]++; });
    const total = tareas.length;
    return {
        total, ...por,
        avance: total ? Math.round(por.Finalizado / total * 100) : 0,
        pares: (corrida && corrida.pares) || 0,
        cuerpos: (corrida && corrida.cuerpos) || 0,
        cuerposLiberados: tareas.filter(t => migrarEstado(t) === 'Finalizado')
            .reduce((a, t) => a + (t.cuerpos || new Set((t.lineas || []).map(l => l.ubi)).size), 0),
        generado: (corrida && corrida.generado) || '',
        zona: (corrida && corrida.zona) || ''
    };
};

/** Las fechas guardadas, de la más nueva a la más vieja. */
export const fechasDe = (cajon) => Object.keys(cajon || {}).sort().reverse();

/** Las fechas del cajón que caen dentro del rango DE/HASTA, de la más nueva a la más vieja. */
export const fechasEnRango = (cajon, desde, hasta) => fechasDe(cajon)
    .filter(f => (!desde || f >= desde) && (!hasta || f <= hasta));

/**
 * EL KPI, sobre las tareas FINALIZADAS de un rango.
 *
 * Se cuenta por CUERPO liberado y no solo por pares: un cuerpo con nueve pares cuesta el mismo
 * viaje que uno con trescientos, y lo que le devuelve espacio al almacén es el cuerpo limpio.
 */
export const kpi = (cajon, desde, hasta) => {
    const fechas = fechasEnRango(cajon, desde, hasta);
    const todas = [], hechas = [];
    let mezclados = 0, paresTotales = 0;
    fechas.forEach(f => {
        const c = cajon[f] || {};
        mezclados += c.cuerpos || 0;
        paresTotales += c.pares || 0;
        (c.tareas || []).forEach(t => {
            todas.push(t);
            if (migrarEstado(t) === 'Finalizado') hechas.push(t);
        });
    });

    const cuerposDe = (t) => t.cuerpos || new Set((t.lineas || []).map(l => l.ubi)).size;
    const liberados = hechas.reduce((a, t) => a + cuerposDe(t), 0);
    const paresMovidos = hechas.reduce((a, t) => a + (Number(t.pares) || 0), 0);
    const minutos = hechas.map(minutosReales).filter(m => m > 0);
    const totalMin = minutos.reduce((a, b) => a + b, 0);

    // Quién limpió cuánto. Los dos usuarios cuentan el cuerpo: lo hicieron juntos.
    const porPersona = new Map();
    hechas.forEach(t => [t.u1, t.u2].filter(Boolean).forEach(u => {
        const v = porPersona.get(u) || { cuerpos: 0, pares: 0, tareas: 0 };
        v.cuerpos += cuerposDe(t); v.pares += Number(t.pares) || 0; v.tareas++;
        porPersona.set(u, v);
    }));

    // Cuántas cumplieron el objetivo
    const conTiempo = hechas.filter(t => minutosReales(t) !== null);
    const cumplieron = conTiempo.filter(t => minutosReales(t) <= minutosEsperados(t)).length;

    // Un cuerpo que se limpió y volvió a aparecer en una corrida posterior
    const vistoLimpio = new Set(), reincidentes = new Set();
    fechas.slice().reverse().forEach(f => {           // de la más vieja a la más nueva
        const c = cajon[f] || {};
        (c.tareas || []).forEach(t => (t.lineas || []).forEach(l => {
            if (vistoLimpio.has(l.ubi)) reincidentes.add(l.ubi);
        }));
        (c.tareas || []).filter(t => migrarEstado(t) === 'Finalizado')
            .forEach(t => (t.lineas || []).forEach(l => vistoLimpio.add(l.ubi)));
    });

    return {
        fechas, mezclados, paresTotales,
        tareas: todas.length, hechas: hechas.length,
        avance: todas.length ? Math.round(hechas.length / todas.length * 100) : 0,
        cuerposLiberados: liberados,
        paresMovidos,
        paresPorHora: totalMin ? Math.round(paresMovidos / (totalMin / 60)) : 0,
        minutosPorCuerpo: liberados && totalMin ? Math.round(totalMin / liberados * 10) / 10 : 0,
        cumplieron, conTiempo: conTiempo.length,
        reincidentes: reincidentes.size,
        porPersona: [...porPersona.entries()]
            .map(([u, v]) => ({ usuario: u, ...v }))
            .sort((a, b) => b.cuerpos - a.cuerpos)
    };
};
