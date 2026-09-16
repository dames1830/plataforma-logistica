/* ═══════════════════════════════════════════════════════════════════════════════════════
 * LOS AVISOS DEL TELEFONO Y DE LA PC, en un solo sitio
 *
 * Daniel, 15-sep-2026: *"también hay que hacer lo mismo para la web, para que le lleguen una
 * notificación"*. Hasta hoy esto vivía suelto dentro de `app_movil.js` y la web no tenía
 * forma de suscribirse: en la PC el chat solo avisaba por dentro de la pantalla.
 *
 * VA A UN ARCHIVO COMPARTIDO Y NO SE COPIA. Dos copias del mismo mecanismo se desincronizan,
 * y en este proyecto ya pasó más de una vez. La app y la web llaman a las mismas tres
 * funciones; lo único que cambia es el botón que las dispara.
 *
 * CADA APARATO SE REGISTRA SOLO. Una persona puede tener el celular, la tablet y la PC: cada
 * uno guarda su propia suscripción con su propio id, y el aviso llega a todos. Por eso la
 * clave lleva el usuario Y el aparato -`dames|k3m9x2`-: si se pisaran, el aviso llegaría a
 * uno solo.
 *
 * QUIEN LOS MANDA. Los de los robots, `robot/avisar_push.py` desde el Contabo. Los del chat,
 * `backend/avisos_chat.py` en el mismo instante en que se guarda el mensaje. Los dos leen el
 * área `push_suscripciones`, que es la que escribe este archivo.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/* `typeof window` y no `window` a secas: este archivo lo arrastra `chat.js`, y chat.js se
   carga tambien desde Node para probar el calculo de las marcas -sin navegador-. Sin la
   guarda, esa prueba revienta antes de empezar. */
const BASE = (typeof window !== 'undefined' && window.API_BASE_URL)
    || 'https://logistics-backend-wv0x.onrender.com';
const AREA = 'push_suscripciones';

/* LA LLAVE PUBLICA. Identifica al servidor que manda y NO sirve para mandar nada: la privada
   vive solo en el Contabo y en Render, como variable de entorno. */
export const LLAVE_AVISOS =
    'BE2dQmsJ0AvtY2ZSq9C3CqEvfv9zRkpyuJCz40uiUxkbemrIWHrF4JAopR0z4ZYw28zRpe-HW0goOTh1yIxbGQk';

/** El identificador de ESTE aparato, el mismo que ya usaba la app. */
export const idDeEsteAparato = () => {
    try {
        let id = localStorage.getItem('deam_id_telefono');
        if (!id) {
            id = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('deam_id_telefono', id);
        }
        return id;
    } catch (e) { return 'sin-memoria'; }
};

/** ¿Este navegador sabe hacerlo? Firefox en modo privado y los iPhone sin "agregar a inicio"
 *  no, y hay que decirlo en vez de dejar un botón que no hace nada. */
export const puedeAvisos = () => ('serviceWorker' in navigator)
    && ('PushManager' in window) && ('Notification' in window);

/** La llave viaja en base64 de URL y el navegador la quiere en bytes. */
const llaveEnBytes = (base64) => {
    const relleno = '='.repeat((4 - base64.length % 4) % 4);
    const limpia = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(limpia);
    const bytes = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return bytes;
};

/**
 * COMO ESTA ESTE APARATO. Devuelve uno de:
 *   'sin-soporte'  este navegador no puede
 *   'bloqueados'   la persona dijo que no; hay que ir a los ajustes del navegador
 *   'prendidos'    ya está suscrito
 *   'apagados'     puede, y todavía no
 */
export const mirarAvisos = async () => {
    if (!puedeAvisos()) return 'sin-soporte';
    if (Notification.permission === 'denied') return 'bloqueados';
    try {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.pushManager.getSubscription()) ? 'prendidos' : 'apagados';
    } catch (e) { return 'apagados'; }
};

/**
 * PRENDERLOS. Pide el permiso y guarda la suscripción.
 *
 * EL PERMISO SE PIDE DESPUES DE DECIR QUE VA A LLEGAR, y eso lo decide quien llama: un
 * "¿permitir notificaciones?" al abrir se contesta que no sin leerlo, y volver atrás obliga a
 * entrar a los ajustes del navegador. Por eso esta función no dibuja nada.
 */
export const prenderAvisos = async (yo) => {
    if (!puedeAvisos()) return 'sin-soporte';
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueados' : 'apagados';
    const reg = await navigator.serviceWorker.ready;
    const sus = await reg.pushManager.subscribe({
        userVisibleOnly: true,                       // sin esto el navegador no suscribe
        applicationServerKey: llaveEnBytes(LLAVE_AVISOS)
    });
    const s = sus.toJSON();
    await fetch(`${BASE}/api/logistics/${AREA}?date=MASTER`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json',
                   ...(yo && yo.token ? { 'X-Auth-Token': yo.token } : {}) },
        body: JSON.stringify({
            id: yo.username + '|' + idDeEsteAparato(),
            usuario: yo.username,
            rol: yo.role || '',
            endpoint: s.endpoint,
            claves: s.keys,
            telefono: navigator.userAgent.slice(0, 90),
            cuando: new Date().toISOString()
        })
    });
    return 'prendidos';
};

/** APAGARLOS en este aparato. Los otros siguen recibiendo. */
export const apagarAvisos = async (yo) => {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.getSubscription();
        if (sus) await sus.unsubscribe();
    } catch (e) { /* si ya no estaba, da igual */ }
    try {
        await fetch(`${BASE}/api/logistics/${AREA}?date=MASTER`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json',
                       ...(yo && yo.token ? { 'X-Auth-Token': yo.token } : {}) },
            body: JSON.stringify({ id: yo.username + '|' + idDeEsteAparato(),
                                   usuario: yo.username, baja: true })
        });
    } catch (e) { /* la baja también la hace el que manda, ante un 404 */ }
    return 'apagados';
};

/** QUE LE VA A LLEGAR A ESTA PERSONA. Se dice ANTES de pedir el permiso. */
export const queLlega = (rol) => (String(rol || '') === 'admin')
    ? ['Los mensajes del chat', 'Cada robot que corre y cómo le fue',
       'Los cortes de stock de las 07:00 y las 19:00']
    : ['Los mensajes del chat', 'Los cortes de stock de las 07:00 y las 19:00'];
