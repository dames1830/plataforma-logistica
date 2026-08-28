/**
 * EL REGISTRO DE LO QUE PASA
 *
 * Daniel, 28-ago-2026: *"¿cómo me doy cuenta de que el robot no está corriendo? Créame un
 * módulo en la web que se llame log [...] ahí ponme todo lo que pasa, lo que el robot haga,
 * lo que descargue, lo que el usuario haga con nombre"*.
 *
 * Nació de un caso concreto: el Stock Reserva de las 07:00 llevaba SEIS DÍAS sin bajar y
 * nadie se enteró. El robot lo dejaba escrito en un archivo del servidor que nadie abre.
 *
 * ANOTAR NO PUEDE ROMPER NADA. Todo lo que hay acá falla callado: si el servidor no
 * responde, la tarea del turno sigue igual. Un registro que tumba una operación es peor
 * que no tener registro.
 *
 * Y NO SE ESPERA. `registrar` no devuelve promesa que haya que aguardar: se dispara y la
 * pantalla sigue. Poner un `await` antes de guardar una tarea sería agregarle al operario
 * el tiempo del registro.
 */

const API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/eventos';

/** Quién está usando la plataforma ahora. Si no hay sesión, queda vacío. */
const quienEs = () => {
    try {
        const s = JSON.parse(localStorage.getItem('logistics_session') || '{}') || {};
        return s.name || s.username || '';
    } catch (e) { return ''; }
};

/**
 * Anota una cosa que pasó.
 *
 * @param {string} accion  qué pasó, en una línea y en palabras del almacén
 * @param {string} detalle los números o el porqué. Opcional
 * @param {string} tipo    'ok' | 'aviso' | 'error'
 */
export const registrar = (accion, detalle = '', tipo = 'ok') => {
    if (!accion) return;
    try {
        fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origen: 'web', quien: quienEs(), tipo, accion, detalle }),
            /* `keepalive` para que el aviso salga aunque la persona cierre la pestaña
               justo después: sin esto el navegador cancela la llamada y se pierde
               justamente el registro de lo último que hizo. */
            keepalive: true
        }).catch(() => {});
    } catch (e) { /* anotar nunca rompe nada */ }
};

/** Lo anotado, lo más nuevo primero. */
export const traer = async ({ dias = 7, origen = '', tipo = '', q = '', limite = 1000 } = {}) => {
    const p = new URLSearchParams({ dias: String(dias), limite: String(limite) });
    if (origen) p.set('origen', origen);
    if (tipo) p.set('tipo', tipo);
    if (q) p.set('q', q);
    const r = await fetch(`${API}?${p}&z=${Date.now()}`);
    if (!r.ok) throw new Error('El servidor respondió ' + r.status);
    const c = await r.json();
    return { eventos: c.eventos || [], total: c.total || 0 };
};
