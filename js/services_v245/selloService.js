/* ══════════════════════════════════════════════════════════════════════════════
 *  EL SELLO DE CADA REPORTE — cuándo se procesó de verdad
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Daniel, 07-sep-2026: *"todos los reportes deben identificar el sello de ese
 *  reporte procesado. No vaya a ser que yo esté mirando un reporte pensando que
 *  es del día y el reporte por X motivos no actualizó y sea de hace dos días.
 *  Entonces voy a dar una mala información"*.
 *
 *  DE DÓNDE SALE LA HORA. El servidor guarda `updated_at` cada vez que un robot
 *  publica un área, y `/api/sync/versiones` los devuelve todos de una: 90 áreas
 *  en un JSON de pocos kilobytes. No hace falta que cada robot estampe nada ni
 *  que cada pantalla pida lo suyo.
 *
 *  Comprobado el 07-sep-2026 contra el log del robot: `despacho_potencial_dia`
 *  decía 09:01:22 y el log del servidor decía "publicado 09:01:22". Es hora de
 *  Lima y es exacta.
 *
 *  EL COLOR ES EL AVISO, no la fecha. Una fecha en gris chico no frena a nadie:
 *  el punto de esto es que un reporte viejo SALTE A LA VISTA.
 *
 *      hoy          gris, discreto      está al día
 *      ayer         ámbar               mírelo antes de usarlo
 *      2+ días      rojo                no lo use sin revisar
 *
 *  POR QUÉ NO SE COMPARA CONTRA EL HORARIO DEL ROBOT. Sería más fino —"debía
 *  correr a las 20:00 y son las 23:00"— pero obliga a mantener dos copias del
 *  horario, y cuando se desincronizan el aviso miente. La edad del dato es un
 *  hecho; el horario es una promesa.
 * ════════════════════════════════════════════════════════════════════════════ */

/* LA MISMA BASE QUE EL RESTO, y con el mismo respeto por `?local=1`: no hay un
   modulo de configuracion comun, asi que se repite el gesto de sync_engine.
   El sello de beta lo pone `env.js`, que envuelve el fetch global. */
const BASE = (localStorage.getItem('PULSE_USE_LOCAL') === 'true')
    ? 'http://localhost:8000/api'
    : 'https://logistics-backend-wv0x.onrender.com/api';
const VERSIONES = `${BASE}/sync/versiones`;

/* Se pide una vez y se reusa: cambiar de submódulo no vuelve a pegarle al
   servidor. Un minuto es de sobra —el robot más seguido corre cada 10—. */
const VIGENCIA_MS = 60 * 1000;
let _sellos = null;
let _cuando = 0;
let _pidiendo = null;

export const traerSellos = async (forzar = false) => {
    if (!forzar && _sellos && (Date.now() - _cuando) < VIGENCIA_MS) return _sellos;
    if (_pidiendo) return _pidiendo;
    _pidiendo = (async () => {
        try {
            const r = await fetch(`${VERSIONES}?z=${Date.now()}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            _sellos = (j && j.versiones) || {};
            _cuando = Date.now();
        } catch (e) {
            console.warn('[sello] no se pudieron traer las versiones:', e && e.message);
            /* NO SE BORRA LO QUE YA SE TENÍA: un corte de red no debe hacer
               desaparecer el sello, que es justo cuando más se necesita. */
            if (!_sellos) _sellos = {};
        } finally {
            _pidiendo = null;
        }
        return _sellos;
    })();
    return _pidiendo;
};

/** La fecha en que se publicó un área, o null si nunca se publicó. */
export const selloDe = (area) => {
    const v = _sellos && _sellos[area];
    if (!v) return null;
    /* VIENE COMO "2026-09-07 09:01:02", en hora de Lima y SIN zona. Se arma a
       mano: `new Date('2026-09-07 09:01:02')` lo interpreta distinto según el
       navegador, y con la T y la Z lo correría cinco horas. */
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
};

const DOS = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${DOS(d.getHours())}:${DOS(d.getMinutes())}`;
const ddmm = (d) => `${DOS(d.getDate())}-${DOS(d.getMonth() + 1)}`;

/** Cuántos días de calendario hay entre esa fecha y hoy. Hoy = 0, ayer = 1. */
const diasAtras = (d) => {
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const h = new Date();
    const b = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    return Math.round((b - a) / 86400000);
};

/**
 * Cómo se lee y de qué color va.
 * @returns {{texto:string, nivel:'ok'|'viejo'|'muy-viejo'|'nunca', fecha:Date|null}}
 */
export const leerSello = (area) => {
    const d = selloDe(area);
    if (!d) return { texto: 'sin publicar', nivel: 'nunca', fecha: null };
    const n = diasAtras(d);
    if (n <= 0) {
        const min = Math.round((Date.now() - d.getTime()) / 60000);
        /* LOS PRIMEROS MINUTOS SE DICEN EN MINUTOS: "hace 3 min" tranquiliza
           mucho más que "hoy 09:01" cuando uno acaba de correr el robot. */
        if (min < 60) return { texto: `hace ${Math.max(1, min)} min`, nivel: 'ok', fecha: d };
        return { texto: `hoy ${hhmm(d)}`, nivel: 'ok', fecha: d };
    }
    if (n === 1) return { texto: `ayer ${hhmm(d)}`, nivel: 'viejo', fecha: d };
    return { texto: `hace ${n} días · ${ddmm(d)} ${hhmm(d)}`, nivel: 'muy-viejo', fecha: d };
};

/**
 * El sello listo para pegar en el HTML.
 * @param {string|string[]} areas  una o varias; manda la MÁS VIEJA, que es la
 *                                 que puede estar dando información equivocada.
 */
export const chipSello = (areas) => {
    const lista = (Array.isArray(areas) ? areas : [areas]).filter(Boolean);
    if (!lista.length) return '';
    const leidos = lista.map(a => ({ area: a, ...leerSello(a) }));
    const orden = { 'nunca': 3, 'muy-viejo': 2, 'viejo': 1, 'ok': 0 };
    leidos.sort((a, b) => (orden[b.nivel] - orden[a.nivel])
                       || ((a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0)));
    const peor = leidos[0];
    const detalle = leidos.map(x => `${x.area}: ${x.texto}`).join('\n');
    const icono = peor.nivel === 'ok' ? '🕒' : '⚠️';
    return `<span class="sello ${peor.nivel}" title="Cuándo se procesó&#10;${detalle}">`
         + `${icono} Actualizado ${peor.texto}</span>`;
};

/* ── EL PINTADO AUTOMÁTICO ────────────────────────────────────────────────────
 *
 *  Cada módulo dibuja su propia barra de submódulos, así que no hay UN sitio
 *  donde poner esto. En vez de tocar catorce funciones de dibujo, se mira el
 *  DOM: cuando aparece una `.sub-nav`, se le cuelga el sello del submódulo que
 *  esté activo.
 *
 *  LA TABLA VIVE ACÁ Y NO EN `TABS` a propósito. `TABS` son 65 entradas
 *  repartidas en un archivo de 34.000 líneas; acá se lee de un vistazo cuál
 *  pantalla mira qué área, que es lo que hay que auditar cuando un sello no
 *  cuadra. Una pantalla que no está en la tabla simplemente no lleva sello: es
 *  lo correcto para las de carga de archivos y las de configuración.
 * ─────────────────────────────────────────────────────────────────────────── */
export const AREAS_POR_PANTALLA = {
    // ── Picking ──────────────────────────────────────────────────────────────
    reporte_picking:   ['picking_por_hora', 'embalaje_por_hora'],
    picking_dia:       ['picking_por_hora'],
    embalaje_dia:      ['embalaje_por_hora'],
    cruce_wms:         ['cruce_wms'],
    prod_proyeccion:   ['picking_por_hora', 'embalaje_por_hora'],
    // ── Despacho ─────────────────────────────────────────────────────────────
    distribucion:      ['distribucion_dia'],
    despacho_potencial:['despacho_potencial_dia'],
    // ── NO RETAIL ────────────────────────────────────────────────────────────
    despacho_no_retail:['no_retail_cache'],
    // ── Recepción ────────────────────────────────────────────────────────────
    asn_recepcion:     ['asn_recepcion'],
    reportes_recepcion:['citas_recepcion'],
    // ── Almacenaje ───────────────────────────────────────────────────────────
    tareas_dia:        ['almacenaje_tasks'],
    kpi_tareas:        ['almacenaje_tasks'],
    productividad:     ['almacenaje_tasks'],
    capacidad:         ['almacenaje_activo'],
    // ── Slotting ─────────────────────────────────────────────────────────────
    slot_tareas:       ['slotting_tareas'],
    slot_kpi:          ['slotting_tareas'],
    // ── Despacho ─────────────────────────────────────────────────────────────
    // El Pendiente vivia en Zona Buffer hasta el 09-sep-2026. La clave es el id
    // de la sub-pestana, que no cambio al mudarse de modulo.
    pendiente:         ['pendiente_despacho'],
    correo_hoy:        ['correo_hoy'],
    // ── Zona Buffer ──────────────────────────────────────────────────────────
    reportes:          ['analisis_buffer', 'buffer_bajado_dia'],
    historial_buffer:  ['buffer_history'],
    kpi_buffer:        ['kpi_results_v2'],
    // ── Análisis SKU ─────────────────────────────────────────────────────────
    articulo_temp:     ['evolucion_articulo'],
    replenishment:     ['replenishment_dia'],
    analisis_reserva:  ['analisis_sku_reserva'],
    layout_activo:     ['layout_stock_hora'],
    // ── Performance ──────────────────────────────────────────────────────────
    actividades:       ['turno_actividades'],
    asistencia:        ['attendance'],
    // ── Inventario ───────────────────────────────────────────────────────────
    kpi_inventarios:   ['inventario'],
};

const idActivo = () => {
    const a = document.querySelector('.sub-nav-item.active');
    if (!a) return null;
    return a.dataset.id || a.dataset.s || null;
};

/**
 * Cuelga (o refresca) el sello en la barra de submódulos.
 *
 * SOLO EN LA PRIMERA. Hay módulos con barra de segundo nivel —Slotting,
 * Configuración, Performance— y el sello salía dos veces. La de arriba es la
 * del submódulo, que es la que corresponde a la tabla.
 */
export const pintarSellos = () => {
    const id = idActivo();
    const areas = id && AREAS_POR_PANTALLA[id];
    /* Las de más abajo se limpian por si quedó una de un dibujo anterior. */
    document.querySelectorAll('nav.sub-nav .sello-caja').forEach((c, i) => {
        if (i > 0 || !areas) c.remove();
    });
    if (!areas) return;
    const nav = document.querySelector('nav.sub-nav');
    if (!nav) return;
    let caja = nav.querySelector(':scope > .sello-caja');
    if (!caja) {
        caja = document.createElement('span');
        caja.className = 'sello-caja';
        nav.appendChild(caja);
    }
    const html = chipSello(areas);
    /* SE COMPARA ANTES DE ESCRIBIR: este pintado lo dispara un observador del
       DOM, y tocar el HTML en cada pasada lo volvería a disparar sin parar. */
    if (caja.innerHTML !== html) caja.innerHTML = html;
};

let _observando = false;

/**
 * Arranca el pintado automático. Se llama UNA vez al abrir el tablero.
 *
 * EL OBSERVADOR MIRA EL CUERPO ENTERO porque cada módulo reemplaza su
 * contenedor por completo al dibujar, y el que se guarde una referencia se
 * queda mirando un nodo que ya nadie usa. Se agrupa con un tiempo muerto corto
 * para no repintar en cada una de las mil inserciones de una tabla grande.
 */
export const vigilarSellos = () => {
    if (_observando) return;
    _observando = true;
    let t = null;
    const repintar = () => {
        clearTimeout(t);
        t = setTimeout(() => { traerSellos().then(pintarSellos).catch(() => {}); }, 120);
    };
    new MutationObserver(repintar).observe(document.body, { childList: true, subtree: true });
    /* Y CADA MINUTO SE REFRESCA SOLO: la pantalla se queda abierta horas y
       "hace 3 min" tiene que envejecer. */
    setInterval(() => { traerSellos(true).then(pintarSellos).catch(() => {}); }, VIGENCIA_MS);
    repintar();
};
