/**
 * Jornada de Trabajo
 *
 * Los horarios de cada turno, día por día, y a partir de ellos LA HORA A LA QUE CAMBIA EL
 * DÍA OPERATIVO. Hasta v29.0008 esa hora estaba escrita a mano (las 06:00) dentro de
 * getLogicalDate(), así que un turno que salía 06:30 se partía en dos días: la última hora
 * de la jornada se registraba en el día siguiente.
 *
 * Dos niveles, igual que las metas de productividad:
 *
 *   BASE    un horario por cada día de la semana. El sábado el turno día sale antes, y eso
 *           no es una excepción: es como se trabaja siempre.
 *   REGLAS  tramos con fecha de inicio y fin que pisan al base mientras están vigentes.
 *           Al vencer, todo vuelve solo: nadie tiene que acordarse de deshacer la campaña.
 *
 * EL CORTE DEL DÍA LO PONE EL TURNO NOCHE, no el de día. Aunque el sábado el turno día
 * salga 13:00, el sábado sigue cerrando a las 05:30 del domingo, que es cuando termina su
 * turno noche.
 *
 * Vive en el servidor, en el área 'config', que el backend trata como SINGLETON: una sola
 * fila que se pisa en cada guardado. Así todas las PC calculan la misma jornada; si cada
 * una tuviera la suya, el mismo trabajo se imputaría a días distintos según dónde se
 * cargara, que es justo el enredo que ya pasó con el Maestro.
 *
 * La lectura es SÍNCRONA a propósito: getLogicalDate() se llama desde la inicialización del
 * módulo, antes de que termine cualquier await. Por eso se descarga una vez al arrancar
 * (cargarJornada) y de ahí en más se lee de memoria.
 */

const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config';
const CACHE_KEY = 'config_jornada_v2';

/** Orden de getDay(): 0 es domingo. */
export const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

export const DIAS_ORDEN = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

export const NOMBRE_DIA = {
    lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves',
    vie: 'Viernes', sab: 'Sábado', dom: 'Domingo'
};

const HORARIO_HABITUAL = { diaEntrada: '08:00', diaSalida: '17:30', nocheEntrada: '19:00', nocheSalida: '05:30' };

/**
 * Con lo que arranca una PC que todavía no tiene nada guardado. Todos los días vienen con
 * el horario habitual, domingo incluido: aunque no se trabaje, el día necesita su hora de
 * corte, porque alguien puede cerrar una tarea un domingo igual.
 */
export const jornadaPorDefecto = () => ({
    base: DIAS_ORDEN.reduce((acc, d) => {
        acc[d] = { ...HORARIO_HABITUAL };
        return acc;
    }, {}),
    reglas: [],
    /**
     * Margen de gracia para corregir una jornada ya cerrada. Antes era 0 implícito: la tarea
     * se trababa en el instante en que cambiaba el día operativo, y una corrección de último
     * momento ya no entraba.
     */
    horasBloqueo: 24
});

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

/** Deja fuera cualquier cosa que no sea HH:MM real, para que un dato roto no rompa las fechas. */
const horaLimpia = (valor, respaldo) => {
    const v = String(valor || '').trim();
    return HORA_VALIDA.test(v) ? v : respaldo;
};

const horarioLimpio = (crudo, respaldo) => {
    const c = (crudo && typeof crudo === 'object') ? crudo : {};
    const r = respaldo || HORARIO_HABITUAL;
    return {
        diaEntrada: horaLimpia(c.diaEntrada, r.diaEntrada),
        diaSalida: horaLimpia(c.diaSalida, r.diaSalida),
        nocheEntrada: horaLimpia(c.nocheEntrada, r.nocheEntrada),
        nocheSalida: horaLimpia(c.nocheSalida, r.nocheSalida)
    };
};

export const nuevoIdRegla = () => 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

const reglaLimpia = (crudo) => {
    const c = (crudo && typeof crudo === 'object') ? crudo : {};
    const dias = Array.isArray(c.dias) ? c.dias.filter(d => DIAS_ORDEN.includes(d)) : [];
    const turno = (c.turno === 'dia' || c.turno === 'noche') ? c.turno : 'ambos';
    return {
        id: String(c.id || nuevoIdRegla()),
        nombre: String(c.nombre || 'Sin nombre').trim().slice(0, 60),
        desde: FECHA_VALIDA.test(String(c.desde)) ? c.desde : '',
        hasta: FECHA_VALIDA.test(String(c.hasta)) ? c.hasta : '',
        dias: dias.length ? dias : [...DIAS_ORDEN],
        turno,
        ...horarioLimpio(c)
    };
};

const normalizar = (crudo) => {
    const def = jornadaPorDefecto();
    const c = (crudo && typeof crudo === 'object') ? crudo : {};

    // Migración desde v29.0008, que guardaba un solo horario plano para toda la semana.
    if (!c.base && (c.diaEntrada || c.nocheSalida)) {
        const plano = horarioLimpio(c);
        DIAS_ORDEN.forEach(d => { def.base[d] = { ...plano }; });
        const h = Number(c.horasBloqueo);
        if (Number.isFinite(h) && h >= 0 && h <= 168) def.horasBloqueo = h;
        return def;
    }

    const base = {};
    DIAS_ORDEN.forEach(d => {
        base[d] = horarioLimpio(c.base && c.base[d], HORARIO_HABITUAL);
    });

    const horas = Number(c.horasBloqueo);
    return {
        base,
        reglas: Array.isArray(c.reglas) ? c.reglas.map(reglaLimpia) : [],
        horasBloqueo: (Number.isFinite(horas) && horas >= 0 && horas <= 168) ? horas : def.horasBloqueo
    };
};

let _jornada = null;

const leerCache = () => {
    try {
        const txt = localStorage.getItem(CACHE_KEY) || localStorage.getItem('config_jornada_v1');
        return txt ? normalizar(JSON.parse(txt)) : null;
    } catch (e) { return null; }
};

const escribirCache = (cfg) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin caché se sigue igual */ }
};

/**
 * La jornada vigente, SIN esperar a nadie. Mientras la descarga no haya terminado devuelve
 * lo último que quedó en esta PC, y si nunca hubo nada, los valores por defecto.
 */
export const jornadaActual = () => {
    if (_jornada) return _jornada;
    const local = leerCache();
    if (local) { _jornada = local; return _jornada; }
    return jornadaPorDefecto();
};

/** Trae la jornada publicada. Se llama una vez al arrancar la app. */
export const cargarJornada = async () => {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            // El área 'config' es un cajón compartido: la jornada vive en su propia clave para
            // que mañana quepa otra configuración al lado sin pisarse.
            if (datos && typeof datos === 'object' && datos.jornada) {
                _jornada = normalizar(datos.jornada);
                escribirCache(_jornada);
                return _jornada;
            }
        }
    } catch (e) {
        console.warn('[Jornada] no se pudo traer la publicada, se usa la de esta PC:', e && e.message);
    }
    _jornada = leerCache() || jornadaPorDefecto();
    return _jornada;
};

/**
 * Publica la jornada para todas las PC. Antes de escribir se relee lo que haya en 'config' y
 * solo se reemplaza la clave 'jornada': el área es compartida y pisarla entera se llevaría
 * por delante cualquier otra configuración que llegue a guardarse ahí.
 */
export const guardarJornada = async (nueva) => {
    const cfg = normalizar(nueva);
    _jornada = cfg;
    escribirCache(cfg);

    let cajon = {};
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) {
            const cuerpo = await res.json();
            const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
            if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
    } catch (e) { /* si no se puede releer, se manda solo la jornada */ }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cajon, jornada: cfg })
    });
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    return cfg;
};

const aMinutos = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h * 60) + m;
};

const comoTexto = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

/** Mediodía a propósito: evita que un cambio de horario de verano corra el día. */
const comoFecha = (fechaStr) => new Date(String(fechaStr) + 'T12:00:00');

export const claveDiaDe = (fechaStr) => DIAS[comoFecha(fechaStr).getDay()];

const reglaVigente = (r, fechaStr) => {
    if (r.desde && fechaStr < r.desde) return false;
    if (r.hasta && fechaStr > r.hasta) return false;
    return true;
};

/**
 * El horario que rige una fecha concreta: el del día de la semana, con las reglas vigentes
 * encima. Si dos reglas pisan el mismo turno gana la última de la lista, que es la de más
 * abajo en pantalla; así el orden que ve el usuario es el que manda.
 */
export const horarioDe = (fechaStr) => {
    const cfg = jornadaActual();
    const clave = claveDiaDe(fechaStr);
    let h = { ...(cfg.base[clave] || HORARIO_HABITUAL) };

    (cfg.reglas || []).forEach(r => {
        if (!reglaVigente(r, fechaStr)) return;
        if (!r.dias.includes(clave)) return;
        if (r.turno === 'dia' || r.turno === 'ambos') {
            h.diaEntrada = r.diaEntrada; h.diaSalida = r.diaSalida;
        }
        if (r.turno === 'noche' || r.turno === 'ambos') {
            h.nocheEntrada = r.nocheEntrada; h.nocheSalida = r.nocheSalida;
        }
    });
    return h;
};

/** Las reglas que aplican a una fecha, para poder mostrarlo en pantalla. */
export const reglasQueAplican = (fechaStr) => {
    const clave = claveDiaDe(fechaStr);
    return (jornadaActual().reglas || []).filter(r => reglaVigente(r, fechaStr) && r.dias.includes(clave));
};

/**
 * A qué día operativo pertenece un momento dado.
 *
 * Se mira el corte del DÍA ANTERIOR, no el de hoy: si todavía no llegó la hora a la que
 * cerraba ayer, seguimos dentro de la jornada de ayer. Quien entró el sábado 19:00 y sigue
 * a las 03:00 del domingo está trabajando el sábado, no el domingo.
 *
 * Empezar por el día anterior también resuelve el enredo de que cada día tenga su propia
 * hora de corte: preguntar "¿qué corte me aplica?" antes de saber en qué día estoy sería
 * circular.
 */
export const fechaLogicaDe = (momento) => {
    const ahora = momento instanceof Date ? momento : new Date();
    const ayer = new Date(ahora);
    ayer.setDate(ahora.getDate() - 1);

    const corte = aMinutos(horarioDe(comoTexto(ayer)).nocheSalida);
    const minutos = (ahora.getHours() * 60) + ahora.getMinutes();

    return comoTexto(minutos < corte ? ayer : ahora);
};

/**
 * Momento exacto en que deja de poder editarse la jornada de una fecha: su hora de cierre
 * (la salida del turno noche, ya al día siguiente) más el margen de gracia.
 */
export const cierreDe = (fechaStr) => {
    const cfg = jornadaActual();
    const base = comoFecha(fechaStr);
    if (isNaN(base.getTime())) return null;
    const [h, m] = String(horarioDe(fechaStr).nocheSalida).split(':').map(Number);
    base.setDate(base.getDate() + 1);
    base.setHours(h, m, 0, 0);
    return new Date(base.getTime() + (cfg.horasBloqueo * 3600000));
};

/** Si la jornada de esa fecha ya cerró para todo el mundo salvo el superusuario. */
export const jornadaVencida = (fechaStr) => {
    const cierre = cierreDe(fechaStr);
    return !!cierre && (new Date() > cierre);
};

/** Frase para el candado y los avisos, para que el horario no quede escrito a mano en el texto. */
export const textoCierre = () => {
    const horas = jornadaActual().horasBloqueo;
    if (!horas) return 'hasta que cierra la jornada del día siguiente';
    if (horas === 24) return 'hasta 24 horas después de que cierra la jornada';
    return `hasta ${horas} horas después de que cierra la jornada`;
};
