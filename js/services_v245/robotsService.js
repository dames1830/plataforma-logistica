/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LOS HORARIOS DEL ROBOT — Configuración → Parámetros
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Daniel, 18-ago-2026: *"quiero que la hora del robot, tanto el stock ancla como los stocks de
 * avance, se pueda modificar desde la web. Yo cambio en la web y el robot se tiene que adaptar
 * a lo que yo digo"*. Y los días también: *"ahorita no está el domingo, pero si un domingo
 * venimos a trabajar lo pongo como un check"*.
 *
 * SE DA VUELTA EL RELOJ, y esa es toda la idea. Hasta hoy la hora vivía en el Programador de
 * tareas de Windows del servidor, así que cambiarla era entrar con un `.bat` —el ancla pasó de
 * 06:00 a 07:00 el 13-ago y hubo que hacerlo a mano—. Ahora Windows solo DESPIERTA al robot
 * cada 10 minutos y el robot pregunta acá si le toca. La hora pasa a ser un dato de la
 * plataforma, como la jornada o las capacidades.
 *
 * EL ROBOT LEE ESTO, ASÍ QUE EL FORMATO ES UN CONTRATO. Si se le agrega un campo, el robot
 * viejo tiene que seguir andando: por eso todo lo que falta se rellena con el valor de fábrica
 * y nada se da por presente.
 *
 * Vive en el área `config`, clave `robots`, al lado de `jornada`, `zonas` y `tallas`. Al
 * guardar se relee el cajón entero y se reemplaza SOLO esta clave.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config';
const CACHE_KEY = 'config_robots_v1';

/** Los días, en el orden en que se leen en la pantalla. `dom` va último a propósito. */
export const DIAS = [
    { id: 'lun', letra: 'L', nombre: 'lunes' },
    { id: 'mar', letra: 'M', nombre: 'martes' },
    { id: 'mie', letra: 'X', nombre: 'miércoles' },
    { id: 'jue', letra: 'J', nombre: 'jueves' },
    { id: 'vie', letra: 'V', nombre: 'viernes' },
    { id: 'sab', letra: 'S', nombre: 'sábado' },
    { id: 'dom', letra: 'D', nombre: 'domingo' }
];

/**
 * LAS TAREAS DEL SERVIDOR. Al 31-ago-2026 son diez.
 *
 * Los nombres dicen PARA QUÉ es cada una, no cada cuánto corre: la frecuencia
 * se cambia desde esta misma pantalla, así que meterla en el nombre lo deja
 * mintiendo. 'Stock por hora' corría cada dos horas y confundía.
 *
 * `tipo` dice cómo se lee la hora, y hay dos formas que no se pueden mezclar:
 *   'diaria'  corre UNA vez, a la hora exacta        -> `hora`
 *   'cada'    corre varias veces, al minuto que diga -> `minuto` + `cadaMin`
 *
 * El ancla va partida en dos —noche y mañana— porque tienen horas distintas y Daniel puede
 * querer días distintos: un domingo de trabajo quizá necesite la foto de la noche y no la de
 * la mañana.
 */
export const TAREAS = [
    { id: 'ancla_noche', tipo: 'diaria', etiqueta: 'Stock ancla · noche',
      detalle: 'la foto sobre la que se calcula todo el turno', area: 'almacenaje_activo' },
    { id: 'ancla_manana', tipo: 'diaria', etiqueta: 'Stock ancla · mañana',
      detalle: 'la foto del día que empieza', area: 'almacenaje_activo' },
    { id: 'stock_hora', tipo: 'cada', etiqueta: 'Actividades del turno noche',
      detalle: 'el buffer, las paletas y el activo, para el Cumplimiento del turno', area: 'layout_stock_hora' },
    { id: 'picking_hora', tipo: 'cada', etiqueta: 'Avance de picking',
      detalle: 'lo que va picado en el dia; el pase de las 20:00 lo hace el Corte del turno día', area: 'picking_dias' },
    { id: 'oblpn_hora', tipo: 'cada', etiqueta: 'Avance de embalaje',
      detalle: 'lo que va embalado en el dia; el pase de las 20:20 lo hace el Corte del turno día', area: null },
    { id: 'mapa_hora', tipo: 'cada', etiqueta: 'Mapa de calor',
      detalle: 'las cuatro zonas; se dibuja con la foto del turno noche', area: 'layout_activo_SEL' },
    { id: 'reportes', tipo: 'cada', etiqueta: 'Detalle de Orden',
      detalle: 'el pendiente del día que cerró, detrás de cada ancla', area: null },
    { id: 'respaldo', tipo: 'diaria', etiqueta: 'Respaldo de datos',
      detalle: 'la copia de seguridad de las 63 áreas', area: null },
    { id: 'archivado', tipo: 'diaria', etiqueta: 'Archivar tareas viejas',
      detalle: 'manda al histórico lo que pasó de 30 días', area: null },
    { id: 'sin_salida', tipo: 'diaria', etiqueta: 'SKUs sin salida',
      detalle: 'el cuadro de lo que llegó y no se movió', area: 'sku_sin_salida' },
    { id: 'asn_web', tipo: 'diaria', etiqueta: 'ASN · seis meses',
      detalle: 'lo que viene en camino: un archivo por mes, seis meses atrás', area: null },
    /* VA DESPUÉS DE TODO EL TURNO. El último pase del avance de picking es 20:20 y el
       de embalaje 20:40; antes de esa hora el cruce compararía medio día. Las 21:30
       además es hueco: el stock por hora entra 22:00 y el respaldo 23:00. */
    /* EL CIERRE DEL DIA ANTERIOR, de 00:00 a 23:59. El avance de cada 2 horas
       termina a las 20:20 y el dia sigue: un reporte completo solo se puede bajar
       despues de medianoche. Esto es lo que queda en el historial. */
    { id: 'cierre_dia', tipo: 'diaria', etiqueta: 'Cierre del día anterior',
      detalle: 'el día entero, de 00:00 a 23:59; es el que queda en el historial',
      area: 'embalaje_por_hora' },
    { id: 'cruce_wms', tipo: 'diaria', etiqueta: 'Cruce contra el WMS',
      detalle: 'los dos web reports del WMS contra lo que calcula la plataforma',
      area: 'cruce_wms' },
    /* EL CORTE DEL TURNO DÍA. Daniel, 03-sep-2026: *"al finalizar el turno día deberíamos
       ya tener los reportes y KPIs de lo que hizo el turno día [...] busca un espacio para
       tener el reporte final de picking y embalaje"*, y *"el corte debería ser a partir de
       las 7 pm"*.

       VA A LAS 20:00, que es el primer hueco de verdad después de las 19:00: el ancla entra
       19:00 y sale 19:16, y el Detalle de Orden entra 19:20 y tarda hasta 40 minutos.

       SI SE LE CAMBIA LA HORA, hay que mirar dos cosas: que no pise el ancla de las 19:00
       —el bloque dura unos 50 minutos— y que los pases de picking de las 20:00 y de
       embalaje de las 20:20 siguen apagados en el servidor, porque este los reemplaza. */
    /* EL CORREO DE CITAS. Va como tarea que se repite y no como diaria porque *"lo
       mandan a partir de las cuatro, mas o menos"* no es una hora sino una franja:
       se intenta cada 30 minutos entre las 16:00 y las 18:30. El robot lleva su
       lista de correos vistos, así que repetir no duplica nada. */
    { id: 'correo_citas', tipo: 'cada', etiqueta: 'Correo de citas de recepción',
      detalle: 'la programación de recepción de nacional que llega por correo',
      area: 'citas_recepcion' },
    { id: 'corte_turno', tipo: 'diaria', etiqueta: 'Corte del turno día',
      detalle: 'el número final de picking, embalaje y recepción del día',
      area: 'corte_turno' }
];

/** Cada cuánto puede correr una tarea de las que se repiten. */
export const CADA = [
    { min: 30, texto: 'cada 30 minutos' },
    { min: 60, texto: 'cada 1 hora' },
    { min: 120, texto: 'cada 2 horas' },
    { min: 180, texto: 'cada 3 horas' },
    { min: 360, texto: 'cada 6 horas' },
    { min: 720, texto: 'dos veces al día' }
];

const LUN_A_SAB = { lun: true, mar: true, mie: true, jue: true, vie: true, sab: true, dom: false };
const TODOS = { lun: true, mar: true, mie: true, jue: true, vie: true, sab: true, dom: true };

/**
 * LO QUE HACÍA EL SERVIDOR AL 18-ago-2026, tal cual. Es el punto de partida y también el
 * respaldo: si la publicada no trae una tarea, vale esto y el robot no se queda sin horario.
 *
 * El domingo apagado en las tres diarias es la máscara `dias=126` de las tareas de Windows
 * (2+4+8+16+32+64 = lunes a sábado). Las dos "por hora" sí corrían todos los días.
 */
export const robotsPorDefecto = () => ({
    ancla_noche:  { activa: true, hora: '19:00', dias: { ...LUN_A_SAB } },
    ancla_manana: { activa: true, hora: '07:00', dias: { ...LUN_A_SAB } },
    stock_hora:   { activa: true, minuto: 0, cadaMin: 120, dias: { ...TODOS },
                    desde: '22:00', hasta: '06:00' },
    picking_hora: { activa: true, minuto: 0, cadaMin: 120, dias: { ...TODOS },
                    desde: '10:00', hasta: '17:00', saltar: ['18:00', '20:00'] },
    /* FALTABA. Se agregó a TAREAS el 31-ago-2026 y se olvidó acá, así que la pantalla
       venía avisando por consola y cayendo a "apagada, todos los días". Funcionaba de
       casualidad, porque el servidor sí la publica; el día que no contestara, Daniel
       habría visto el avance de embalaje apagado sin estarlo. */
    oblpn_hora:   { activa: true, minuto: 20, cadaMin: 120, dias: { ...TODOS },
                    desde: '10:00', hasta: '17:00', saltar: ['18:20', '20:20'] },
    mapa_hora:    { activa: true, minuto: 15, cadaMin: 120, dias: { ...TODOS },
                    desde: '22:00', hasta: '06:15' },
    /* `minuto: 440` son las 07:20 contadas desde medianoche, no el minuto 440 de una
       hora. Es la única tarea que usa el campo así, y es cómo consigue correr dos veces
       al día —440 y 440+720 = 19:20—. Por eso el rango del validador llega a 1439. */
    reportes:     { activa: true, minuto: 440, cadaMin: 720, dias: { ...TODOS } },
    respaldo:     { activa: true, hora: '23:00', dias: { ...LUN_A_SAB } },
    archivado:    { activa: true, hora: '03:00', dias: { ...TODOS } },
    sin_salida:   { activa: true, hora: '07:30', dias: { ...LUN_A_SAB } },
    asn_web:      { activa: true, hora: '04:30', dias: { ...TODOS } },
    cierre_dia:   { activa: true, hora: '08:30', dias: { ...TODOS } },
    cruce_wms:    { activa: true, hora: '21:30', dias: { ...LUN_A_SAB } },
    corte_turno:  { activa: true, hora: '20:00', dias: { ...LUN_A_SAB } },
    correo_citas: { activa: true, minuto: 0, cadaMin: 30, dias: { ...TODOS },
                    desde: '15:00', hasta: '18:30' }
});

const _hhmm = (v, respaldo) => {
    const m = String(v == null ? '' : v).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return respaldo;
    const h = Number(m[1]), mi = Number(m[2]);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return respaldo;
    return String(h).padStart(2, '0') + ':' + m[2];
};

const _entre = (v, respaldo, min, max) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= min && n <= max) ? Math.round(n) : respaldo;
};

const _dias = (v, respaldo) => {
    const out = {};
    DIAS.forEach(d => {
        out[d.id] = (v && typeof v === 'object' && d.id in v) ? !!v[d.id] : !!respaldo[d.id];
    });
    return out;
};

/** Deja la configuración con todas las tareas y todos los campos, sin inventar nada. */
export const normalizar = (cfg) => {
    const def = robotsPorDefecto();
    const c = (cfg && typeof cfg === 'object') ? cfg : {};
    const out = {};
    TAREAS.forEach(t => {
        /* SIN VALORES DE FÁBRICA NO SE CAE LA PANTALLA ENTERA.
         *
         * Pasó el 23-ago-2026 con `mapa_hora`: se agregó a TAREAS y se olvidó en
         * `robotsPorDefecto()`, así que `d` venía `undefined` y `d.dias` tiraba
         * "Cannot read properties of undefined". No fallaba esa fila: fallaba
         * Configuración → Parámetros completa, que es justo la pantalla desde la que se
         * manejan los robots. Un olvido de una línea dejó a Daniel sin poder tocar
         * ningún horario.
         *
         * Ahora una tarea sin fábrica cae a un valor sensato —apagada, todos los días—
         * y las demás se dibujan igual. Se avisa por consola, que es donde lo ve quien
         * la agregó, y no en la cara del que solo quiere cambiar una hora. */
        const d = def[t.id] || { activa: false, hora: '00:00', minuto: 0, cadaMin: 60,
                                 dias: { ...TODOS } };
        if (!def[t.id]) console.warn(`[ROBOTS] la tarea '${t.id}' no tiene valores de fábrica en robotsPorDefecto()`);
        const v = (c[t.id] && typeof c[t.id] === 'object') ? c[t.id] : {};
        const base = { activa: ('activa' in v) ? !!v.activa : d.activa, dias: _dias(v.dias, d.dias) };
        if (t.tipo === 'diaria') {
            base.hora = _hhmm(v.hora, d.hora);
        } else {
            /* HASTA 1439, NO HASTA 59. `reportes` guarda 440 —las 07:20 contadas desde
               medianoche— y con el tope en 59 el valor se descartaba y quedaba en
               `undefined`: la pantalla mostraba "al minuto undefined" y calculaba las
               corridas como si fuera el minuto 0. */
            base.minuto = _entre(v.minuto, d.minuto, 0, 1439);
            // Solo los valores que la pantalla ofrece: un "cada 7 minutos" escrito a mano
            // dejaría al robot corriendo todo el día.
            base.cadaMin = CADA.some(x => x.min === Number(v.cadaMin)) ? Number(v.cadaMin) : d.cadaMin;
            /* LA VENTANA Y LOS PASES SALTEADOS VIAJAN. `normalizar` reconstruía cada
               tarea con cinco campos y tiraba el resto, así que la pantalla creía que el
               avance de picking corre las 24 horas cuando el servidor lo tiene de 10:00
               a 21:00, y que corre a las 20:00 cuando ahí va el Corte del turno día.
               El servidor no se enteraba —completa lo que falta con sus valores de
               fábrica— pero lo que Daniel leía en pantalla no era lo que pasaba. */
            if (v.desde || d.desde) base.desde = _hhmm(v.desde, d.desde);
            if (v.hasta || d.hasta) base.hasta = _hhmm(v.hasta, d.hasta);
            const salt = Array.isArray(v.saltar) ? v.saltar : d.saltar;
            if (Array.isArray(salt) && salt.length) {
                base.saltar = salt.map(x => _hhmm(x, null)).filter(Boolean);
            }
        }
        out[t.id] = base;
    });
    return out;
};

let _robots = null;

const leerCache = () => {
    try {
        const txt = localStorage.getItem(CACHE_KEY);
        return txt ? normalizar(JSON.parse(txt)) : null;
    } catch (e) { return null; }
};

const escribirCache = (cfg) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin caché se sigue igual */ }
};

export const robotsActual = () => {
    if (_robots) return _robots;
    const local = leerCache();
    if (local) { _robots = local; return _robots; }
    return robotsPorDefecto();
};

export const cargarRobots = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && datos.robots) {
                _robots = normalizar(datos.robots);
                escribirCache(_robots);
                return _robots;
            }
        }
    } catch (e) {
        console.warn('[Robots] no se pudo traer el horario publicado:', e && e.message);
    }
    _robots = leerCache() || robotsPorDefecto();
    return _robots;
};

/** Publica para el servidor. Se relee `config` y se reemplaza SOLO la clave `robots`. */
export const guardarRobots = async (nueva) => {
    const cfg = normalizar(nueva);
    _robots = cfg;
    escribirCache(cfg);

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo de robots */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, robots: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};

/* ══════════════════════════════════════════════════════════════════════════
   EL CORREO DE COMERCIAL

   Vive en la misma área `config`, en la clave `correoGuias`, al lado de
   `robots`. Va acá y no en un servicio aparte porque comparte todo: el mismo
   endpoint, la misma cascada web → caché → fábrica, y la misma regla de releer
   el cajón entero antes de guardar para no pisar lo que escribió otro.

   NO ES UNA TAREA MÁS DE `robots` porque su horario es una VENTANA —de tal hora
   a tal hora— y las tareas de `robots` son "una vez a las 19:00" o "cada 60
   minutos". Meterla ahí obligaba a inventar un tercer tipo y tocar una pantalla
   que ya funciona.
   ══════════════════════════════════════════════════════════════════════════ */
const CACHE_CORREO = 'config_correo_guias_v1';

export const correoGuiasPorDefecto = () => ({
    activa: true,
    // El asunto que manda comercial. El remitente va VACÍO a propósito: el mismo
    // archivo llega dos veces —el original y un reenvío "RV:"— y filtrar por
    // persona dejaría el día sin bajar si un día lo manda otro.
    asunto: 'Guías de Prescripciones',
    remitente: '',
    desde: '18:00',          // el correo llega entre las 19:00 y las 20:00
    hasta: '23:00',
    /* LA HORA MÁS TEMPRANA A LA QUE SE PUEDE ARMAR EL PENDIENTE, y es un PISO, no un
       horario. El correo se guarda a la hora que llegue; lo que espera es el cruce
       contra el WMS. Daniel, 21-ago-2026: *"por más que el correo te llegue a las
       seis y media, normal, tú lo capturas, esperas a las siete de la noche y corres
       interfaz de WMS"*. A las 06:57 la foto del WMS trae CERO pedidos del día, y a
       las 18:30 todavía le faltan los de la tarde. */
    pendienteDesde: '19:00',
    diasAtras: 3,
    dias: { ...LUN_A_SAB }
});

export const normalizarCorreo = (cfg) => {
    const d = correoGuiasPorDefecto();
    const c = (cfg && typeof cfg === 'object') ? cfg : {};
    return {
        activa: ('activa' in c) ? !!c.activa : d.activa,
        asunto: String(c.asunto == null ? d.asunto : c.asunto).slice(0, 120),
        remitente: String(c.remitente == null ? d.remitente : c.remitente).slice(0, 120),
        desde: _hhmm(c.desde, d.desde),
        hasta: _hhmm(c.hasta, d.hasta),
        pendienteDesde: _hhmm(c.pendienteDesde, d.pendienteDesde),
        diasAtras: _entre(c.diasAtras, d.diasAtras, 1, 30),
        dias: _dias(c.dias, d.dias)
    };
};

let _correo = null;

export const correoGuiasActual = () => {
    if (_correo) return _correo;
    try {
        const txt = localStorage.getItem(CACHE_CORREO);
        if (txt) { _correo = normalizarCorreo(JSON.parse(txt)); return _correo; }
    } catch (e) { /* sin caché se sigue igual */ }
    return correoGuiasPorDefecto();
};

export const cargarCorreoGuias = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object') {
                _correo = normalizarCorreo(datos.correoGuias);
                try { localStorage.setItem(CACHE_CORREO, JSON.stringify(_correo)); } catch (e) {}
                return _correo;
            }
        }
    } catch (e) {
        console.warn('[Correo guías] no se pudo traer la configuración:', e && e.message);
    }
    return correoGuiasActual();
};

/** Publica. Se relee `config` y se reemplaza SOLO la clave `correoGuias`. */
export const guardarCorreoGuias = async (nueva) => {
    const cfg = normalizarCorreo(nueva);
    _correo = cfg;
    try { localStorage.setItem(CACHE_CORREO, JSON.stringify(cfg)); } catch (e) {}

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo lo del correo */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, correoGuias: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};


/** '10:00' -> 600. null si no viene, que significa "sin límite". */
const _min = (hhmm) => {
    const m = String(hhmm == null ? '' : hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * ¿ESE MINUTO DEL DÍA CAE DENTRO DE LA VENTANA? Sin ventana, siempre.
 *
 * LA VENTANA PUEDE CRUZAR LA MEDIANOCHE, y hace falta: el avance del turno noche va de
 * 22:00 a 06:00, o sea que `hasta` es MENOR que `desde`. Cuando pasa eso, dentro es
 * "de las 22:00 en adelante O hasta las 06:00", no el tramo entre las dos.
 *
 * Copia exacta de `_en_ventana` en horario_robot.py: si las dos se separan, la pantalla
 * dice una cosa y el servidor hace otra.
 */
const _enVentana = (base, desde, hasta) => {
    if (desde === null && hasta === null) return true;
    if (desde !== null && hasta !== null) {
        return desde <= hasta ? (base >= desde && base <= hasta) : (base >= desde || base <= hasta);
    }
    return desde !== null ? base >= desde : base <= hasta;
};

/**
 * ¿LE TOCA CORRER A ESTA TAREA EN ESTE MOMENTO? La misma cuenta que hace el robot en el
 * servidor, escrita una sola vez para que las dos puntas no se separen.
 *
 * `ventanaMin` es cuánto abarca cada despertar: el robot se levanta cada 10 minutos, así que
 * una hora puesta a las 19:00 se atiende si el reloj está entre 19:00 y 19:09. Sin ventana,
 * un despertar a las 19:01 se saltaría la corrida para siempre.
 */
export const leToca = (tarea, cfg, momento, ventanaMin = 10) => {
    const t = TAREAS.find(x => x.id === tarea);
    const c = (cfg || robotsActual())[tarea];
    if (!t || !c || !c.activa) return false;

    const ahora = momento instanceof Date ? momento : new Date();
    if (!c.dias[DIAS[(ahora.getDay() + 6) % 7].id]) return false;   // getDay(): 0 = domingo

    const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes();
    if (t.tipo === 'diaria') {
        const [h, m] = String(c.hora).split(':').map(Number);
        const objetivo = h * 60 + m;
        return minutosDelDia >= objetivo && minutosDelDia < objetivo + ventanaMin;
    }
    // Las que se repiten: cada `cadaMin` a partir de medianoche, al minuto que diga
    const cada = Math.max(1, Number(c.cadaMin) || 60);
    const arranque = Number(c.minuto) || 0;
    const salteados = (c.saltar || []).map(_min).filter(x => x !== null);
    for (let base = arranque; base < 24 * 60; base += cada) {
        if (minutosDelDia >= base && minutosDelDia < base + ventanaMin) {
            if (!_enVentana(base, _min(c.desde), _min(c.hasta))) return false;
            if (salteados.includes(base)) return false;
            return true;
        }
    }
    return false;
};

/** Texto corto de cuándo corre, para la pantalla y para el papel. */
export const comoCorre = (tarea, cfg) => {
    const t = TAREAS.find(x => x.id === tarea);
    const c = (cfg || robotsActual())[tarea];
    if (!t || !c) return '';
    if (!c.activa) return 'apagada';
    if (t.tipo === 'diaria') return `todos los días a las ${c.hora}`;
    const cada = CADA.find(x => x.min === c.cadaMin);
    /* Cuando el paso es de 12 horas el `minuto` son minutos desde medianoche, no el
       minuto de la hora: decir "al minuto 440" no significa nada para nadie. */
    const paso = cada ? cada.texto : 'cada ' + c.cadaMin + ' min';
    let txt = c.cadaMin >= 720
        ? `${paso}, a las ${String(Math.floor(c.minuto / 60)).padStart(2, '0')}:${String(c.minuto % 60).padStart(2, '0')}`
        : `${paso}, al minuto ${c.minuto}`;
    if (c.desde && c.hasta) txt += `, de ${c.desde} a ${c.hasta}`;
    if (c.saltar && c.saltar.length) txt += ` (salvo ${c.saltar.join(' y ')})`;
    return txt;
};
