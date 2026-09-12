/* ═══════════════════════════════════════════════════════════════════════════════════════
 * CHAT INTERNO · la burbuja que flota en todas las pantallas
 *
 * Pedido de Daniel, 11-sep-2026: *"¿puedo tener un chat interno dentro de mi web, tipo
 * Facebook?"*, y al ver la maqueta: *"que no sea un módulo... que flote nada más, al costado
 * del ícono del servidor, y cuando lo abra se abra un pequeño chat"*.
 *
 * LO QUE SE ACORDÓ CON ÉL, y es lo que hace este archivo:
 *   · Todos se escriben con todos, sin límite por rol.
 *   · Solo el administrador (dames) borra un mensaje, y queda la marca "mensaje borrado".
 *   · Se guardan 3 meses; lo anterior lo archiva un robot, igual que las tareas.
 *   · En el celular llega con la app; por ahora es la web.
 *   · Cada conversación abre su ventanita, como en Facebook, y se pueden crear grupos.
 *   · Al llegar un mensaje: tono corto, tres latidos de la burbuja, globito 6 segundos y el
 *     contador rojo. La ventana NO se abre sola.
 *
 * POR QUÉ NO HIZO FALTA TOCAR EL SERVIDOR. Las áreas de `/api/logistics/<area>` ya guardan
 * listas y el `PATCH` **agrega el elemento si su id no está**. Con eso:
 *
 *     chat_salas          las conversaciones: quiénes son, si es grupo, quién lo creó
 *     chat_<idSala>       los mensajes de esa sala, uno por elemento
 *     chat_leidos         por persona, el último mensaje leído en cada sala
 *
 * Mandar un mensaje es UN PATCH con su id: no se reescribe la lista, así que dos personas
 * escribiendo a la vez no se pisan. Es la misma lección de las tareas, que se rompían cuando
 * cada PC subía el bloque entero.
 *
 * EL RELOJ. La plataforma tiene un reloj único cada 20 s (el radar del tablero) y no se toca:
 * este archivo pregunta SOLO por las marcas de versión —`/api/sync/versiones`, 2 KB— y baja
 * únicamente la sala que cambió. Mientras hay una ventana abierta mira cada 4 s, que es lo que
 * hace que una conversación se sienta viva; con todo cerrado, cada 20 s alcanza para el globo.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

const BASE = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com');
const API = BASE + '/api/logistics';
const SALAS = 'chat_salas';
const LEIDOS = 'chat_leidos';
const CADA_LENTO = 20000;   // sin ventanas abiertas: alcanza para el contador
const CADA_VIVO = 4000;     // con una ventana abierta: la conversación tiene que sentirse viva
const MAX_VENTANAS = 3;
const SUPERUSUARIO = 'dames';

let YO = null;              // { username, role, token }
let salas = [];             // [{ id, nombre, tipo, miembros, creador, creada }]
let mensajes = {};          // { idSala: [ {id, de, texto, cuando, borrado} ] }
let leidos = {};            // { idSala: 'cuando' del ultimo mensaje leido } — se guarda en el servidor
let noLeidos = {};          // { idSala: cuantos } — el contador vivo de esta pantalla
let versionesVistas = {};   // { area: marca } para no bajar lo que no cambió
let abiertas = [];          // [{ id, plegada }]
let panelAbierto = false;
let vistaGrupo = false;
let gente = [];             // usuarios de la plataforma
let reloj = null;
let sonando = true;
let audio = null;
let toastReloj = null;
let toastSala = null;
let arrancado = false;

/* ── LO QUE HABLA CON EL SERVIDOR ──────────────────────────────────────────────────────── */

const cabeceras = () => {
    const h = { 'Content-Type': 'application/json' };
    if (YO && YO.token) h['X-Auth-Token'] = YO.token;
    return h;
};

const traer = async (area) => {
    const r = await fetch(`${API}/${area}?t=${Date.now()}`);
    if (!r.ok) throw new Error(`${area}: ${r.status}`);
    const c = await r.json();
    const d = (c && c.data !== undefined) ? c.data : c;
    return Array.isArray(d) ? d : [];
};

/* Un elemento con id: el servidor lo reemplaza si existe y lo AGREGA si no. Es lo que
   permite mandar un mensaje sin reescribir la conversación entera. */
const poner = async (area, elemento) => {
    const r = await fetch(`${API}/${area}`, {
        method: 'PATCH', headers: cabeceras(), body: JSON.stringify(elemento)
    });
    if (!r.ok) throw new Error(`${area}: ${r.status}`);
    const c = await r.json();
    return !c || c.status !== 'error';
};

const marcasDelServidor = async () => {
    try {
        const r = await fetch(`${BASE}/api/sync/versiones?t=${Date.now()}`);
        if (!r.ok) return null;
        const c = await r.json();
        /* El endpoint las devuelve bajo `versiones`, no bajo `data` como las areas. Leerlo
           mal dejaba el chat mudo: ninguna marca coincidia con el nombre de la sala, se
           daba por "sin cambios" y el mensaje del otro no llegaba hasta abrir la ventana. */
        return (c && c.versiones) || null;
    } catch (e) { return null; }
};

/* ── LAS SALAS ─────────────────────────────────────────────────────────────────────────── */

/** El id de una conversación de dos sale de los dos nombres, ordenados: las dos PC lo
 *  calculan igual sin preguntarle nada a nadie. */
const idDirecta = (a, b) => 'du_' + [a, b].sort().join('__');

const salaDe = (id) => salas.filter(s => s.id === id)[0];

const nombreDeSala = (s) => {
    if (!s) return '';
    if (s.tipo === 'grupo') return s.nombre;
    const otro = (s.miembros || []).filter(u => u !== YO.username)[0];
    return otro || s.nombre || '';
};

const esMiSala = (s) => !!s && (s.tipo === 'grupo'
    ? (s.miembros || []).indexOf(YO.username) >= 0
    : (s.miembros || []).indexOf(YO.username) >= 0);

const iniciales = (nombre) => String(nombre || '?').slice(0, 2).toUpperCase();

const crearDirecta = async (usuario) => {
    const id = idDirecta(YO.username, usuario);
    if (!salaDe(id)) {
        const sala = { id, tipo: 'directa', nombre: '', miembros: [YO.username, usuario],
                       creador: YO.username, creada: sello() };
        salas.push(sala);
        await poner(SALAS, sala);
    }
    return id;
};

const crearGrupo = async (nombre, miembros) => {
    const id = 'gr_' + Date.now().toString(36);
    const sala = { id, tipo: 'grupo', nombre: nombre || 'Grupo', creador: YO.username,
                   miembros: [YO.username].concat(miembros.filter(m => m !== YO.username)),
                   creada: sello() };
    salas.push(sala);
    await poner(SALAS, sala);
    await mandar(id, 'creó el grupo', true);
    return id;
};

/* ── LOS MENSAJES ──────────────────────────────────────────────────────────────────────── */

/** La hora, como en toda la plataforma: local y sin Z. `toISOString()` adelanta el día a las
 *  19:00 hora de Lima, justo cuando entra el turno noche. */
const sello = () => {
    const d = new Date(), dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
         + `T${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
};

const horaCorta = (cuando) => String(cuando || '').slice(11, 16);
const diaDe = (cuando) => String(cuando || '').slice(0, 10);

const mandar = async (idSala, texto, esAviso = false) => {
    const t = String(texto || '').trim();
    if (!t) return false;
    const msg = { id: `${Date.now().toString(36)}_${YO.username}_${Math.random().toString(36).slice(2, 7)}`,
                  de: YO.username, texto: t, cuando: sello() };
    if (esAviso) msg.aviso = true;
    mensajes[idSala] = (mensajes[idSala] || []).concat(msg);
    leidos[idSala] = msg.cuando;
    noLeidos[idSala] = 0;
    pintar();
    try {
        await poner('chat_' + idSala, msg);
        await guardarLeidos();
        return true;
    } catch (e) {
        console.warn('[CHAT] no se pudo mandar el mensaje:', e && e.message);
        msg.sinEnviar = true;
        pintar();
        return false;
    }
};

const borrar = async (idSala, idMensaje) => {
    if (YO.username !== SUPERUSUARIO) return;
    const lista = mensajes[idSala] || [];
    const m = lista.filter(x => x.id === idMensaje)[0];
    if (!m) return;
    const borrado = { id: m.id, de: m.de, cuando: m.cuando, texto: '', borrado: true,
                      borradoPor: YO.username };
    mensajes[idSala] = lista.map(x => x.id === idMensaje ? borrado : x);
    pintar();
    try { await poner('chat_' + idSala, borrado); }
    catch (e) { console.warn('[CHAT] no se pudo borrar:', e && e.message); }
};

const guardarLeidos = async () => {
    try { await poner(LEIDOS, { id: YO.username, salas: leidos }); }
    catch (e) { /* el contador se corrige en la próxima vuelta */ }
};

/* CUANTOS SIN LEER. Se cuenta lo que DE VERDAD llego a esta pantalla, no la posicion de una
   marca dentro de la lista. Es a proposito: los relojes de dos PC nunca estan iguales al
   segundo, y un mensaje que llega con la hora un minuto atrasada caia ANTES de la marca y no
   se contaba nunca. Lo que se guarda en el servidor (`leidos`) es la hora del ultimo leido, y
   sirve para reponer el contador al volver a entrar. */
const sinLeer = (idSala) => noLeidos[idSala] || 0;

const sinLeerTotal = () => salas.reduce((s, x) => s + sinLeer(x.id), 0);

const marcarLeida = (idSala) => {
    const lista = mensajes[idSala] || [];
    const ultimo = lista.slice(-1)[0];
    noLeidos[idSala] = 0;
    if (ultimo) { leidos[idSala] = ultimo.cuando; guardarLeidos(); }
};

const reponerContador = (idSala) => {
    const desde = leidos[idSala] || '';
    noLeidos[idSala] = (mensajes[idSala] || [])
        .filter(m => m.de !== YO.username && String(m.cuando || '') > desde).length;
};

/* ── EL TONO ───────────────────────────────────────────────────────────────────────────── */

/* Dos notas cortas hechas por el navegador: no hace falta ningún archivo de sonido, y así
   suena igual aunque el servidor esté lento. Se silencia con la campanita del panel y queda
   guardado por persona en esta PC. */
const tin = () => {
    if (!sonando) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!audio) audio = new AC();
        if (audio.state === 'suspended') audio.resume();
        const t0 = audio.currentTime;
        [[880, 0], [1318.5, 0.11]].forEach(par => {
            const osc = audio.createOscillator();
            const vol = audio.createGain();
            osc.type = 'sine';
            osc.frequency.value = par[0];
            vol.gain.setValueAtTime(0.0001, t0 + par[1]);
            vol.gain.exponentialRampToValueAtTime(0.22, t0 + par[1] + 0.012);
            vol.gain.exponentialRampToValueAtTime(0.0001, t0 + par[1] + 0.34);
            osc.connect(vol);
            vol.connect(audio.destination);
            osc.start(t0 + par[1]);
            osc.stop(t0 + par[1] + 0.4);
        });
    } catch (e) { /* si el navegador no deja sonar, el aviso igual se ve */ }
};

/* ── EL LATIDO: qué cambió desde la vuelta anterior ────────────────────────────────────── */

/** Baja la sala y devuelve los mensajes que esta pantalla NO tenia, por id. */
const bajarSala = async (idSala) => {
    try {
        const lista = await traer('chat_' + idSala);
        lista.sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
        const conocidos = {};
        (mensajes[idSala] || []).forEach(m => { conocidos[m.id] = m; });
        const nuevos = lista.filter(m => !conocidos[m.id]);
        mensajes[idSala] = lista;
        return nuevos;
    } catch (e) { return []; }
};

const latir = async () => {
    /* SE LATE TAMBIEN CON LA PESTANA EN SEGUNDO PLANO. El contador del titulo y el tono son
       justamente para cuando la persona esta mirando otra cosa; si el latido se apagara al
       cambiar de pestana, el mensaje aparecia recien al volver. El navegador espacia solo los
       relojes de las pestanas ocultas, y con eso alcanza. */
    const marcas = await marcasDelServidor();
    const cambio = (area) => {
        if (!marcas) return true;                       // sin versiones, se pregunta igual
        const m = marcas[area];
        /* Un area que todavia no existe no tiene marca: se pregunta igual. Es una sala
           recien creada, y preguntar por ella cuesta una respuesta vacia. */
        if (m === undefined) return true;
        if (versionesVistas[area] === m) return false;
        versionesVistas[area] = m;
        return true;
    };

    if (cambio(SALAS)) {
        try { salas = (await traer(SALAS)).filter(esMiSala); } catch (e) { /* se reintenta */ }
    }

    let llego = null;
    for (const s of salas) {
        const abiertaViva = abiertas.some(v => v.id === s.id && !v.plegada);
        if (!cambio('chat_' + s.id) && !abiertaViva) continue;
        const nuevos = (await bajarSala(s.id)).filter(m => m.de !== YO.username);
        if (!nuevos.length) continue;
        if (abiertaViva) {
            marcarLeida(s.id);                       // la esta mirando: ya esta leido
        } else {
            noLeidos[s.id] = (noLeidos[s.id] || 0) + nuevos.length;
            if (!llego) llego = { sala: s, msg: nuevos[nuevos.length - 1] };
        }
    }
    if (llego) avisar(llego.sala, llego.msg);
    pintar();
};

const acomodarReloj = () => {
    if (reloj) clearInterval(reloj);
    /* Rapido solo cuando hay algo abierto Y la pestana esta a la vista: si esta oculta, el
       ritmo lento alcanza y no se gasta bateria ni datos. */
    const vivo = document.visibilityState === 'visible' && (abiertas.some(v => !v.plegada) || panelAbierto);
    reloj = setInterval(latir, vivo ? CADA_VIVO : CADA_LENTO);
};

/* ── LA PANTALLA ───────────────────────────────────────────────────────────────────────── */

const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICONO_GENTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>';

const CSS = `
#chat-burbuja {
  position: fixed; bottom: 20px; right: 72px; z-index: 9999; width: 40px; height: 40px;
  border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer;
  background: rgba(var(--primary-rgb), 0.95); border: 1.5px solid rgba(var(--brand-rgb), 0.6);
  box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.45), 0 4px 20px rgba(var(--shadow-rgb), 0.4);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
#chat-burbuja:hover { transform: scale(1.1); }
#chat-burbuja svg { width: 21px; height: 21px; fill: #fff; }
#chat-burbuja.late { animation: chat-latido 1s ease-in-out 3; border-color: var(--warning-soft); }
@keyframes chat-latido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
#chat-globo {
  position: absolute; top: -4px; right: -4px; min-width: 19px; height: 19px; padding: 0 5px;
  border-radius: 50px; background: var(--danger-soft); color: #1a1a1a; font-size: 11px;
  font-weight: 800; display: grid; place-items: center; border: 2px solid var(--bg-dark);
  font-variant-numeric: tabular-nums;
}
#chat-panel {
  position: fixed; right: 20px; bottom: 72px; z-index: 9998; width: 310px; max-height: 430px;
  background: var(--panel-solid); border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 14px;
  box-shadow: 0 18px 40px rgba(var(--shadow-rgb), 0.55); display: grid;
  grid-template-rows: auto auto 1fr; overflow: hidden; font-size: var(--t-xs);
}
#chat-panel .cab { display: flex; align-items: center; gap: 0.4rem; padding: 0.7rem 0.9rem;
  border-bottom: 1px solid rgba(var(--ink-rgb), 0.07); }
#chat-panel .cab h3 { margin: 0 auto 0 0; font-size: var(--t-sm); font-weight: 800;
  letter-spacing: 1px; text-transform: uppercase; color: var(--text-strong); }
#chat-panel .icono { background: rgba(var(--ink-rgb), 0.05); border: 1px solid rgba(var(--ink-rgb), 0.1);
  color: var(--text-pale); border-radius: 8px; padding: 0.3rem 0.6rem; font-size: var(--t-xs);
  font-weight: 700; cursor: pointer; }
#chat-panel .icono:hover { background: rgba(var(--primary-rgb), 0.3); }
#chat-panel .buscar { padding: 0.55rem 0.9rem; border-bottom: 1px solid rgba(var(--ink-rgb), 0.07); }
#chat-panel .buscar input { width: 100%; background: var(--panel-deep, #0b1120); color: var(--text-main);
  border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 8px; padding: 0.4rem 0.7rem; font-size: var(--t-xs); }
#chat-lista { overflow-y: auto; }
#chat-lista .sec { padding: 0.5rem 0.9rem 0.25rem; font-size: 10px; font-weight: 800; letter-spacing: 1px;
  text-transform: uppercase; color: var(--text-dim); }
#chat-lista .vacio { padding: 0.8rem 0.9rem; color: var(--text-dim); }
.chat-fila { width: 100%; text-align: left; background: none; border: 0; color: inherit; cursor: pointer;
  border-bottom: 1px solid rgba(var(--ink-rgb), 0.05); padding: 0.55rem 0.9rem; display: grid;
  grid-template-columns: 32px 1fr auto; gap: 0.05rem 0.6rem; align-items: center; font-family: inherit; }
.chat-fila:hover { background: rgba(var(--ink-rgb), 0.04); }
.chat-ini { grid-row: span 2; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
  font-size: 11px; font-weight: 800; color: var(--brand-pale); background: rgba(var(--brand-rgb), 0.16);
  border: 1px solid rgba(var(--brand-rgb), 0.3); }
.chat-ini.grupo { color: var(--text-pale); background: rgba(var(--ink-rgb), 0.06); border-color: rgba(var(--ink-rgb), 0.12); }
.chat-fila .quien { font-weight: 700; color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-fila .hora { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
.chat-fila .ultimo { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-fila .nuevos { font-size: 11px; font-weight: 800; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 50px; background: var(--primary); color: #fff; display: grid; place-items: center; }
.chat-fila .marca { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--brand-pale); }
#chat-ventanas { position: fixed; right: 348px; bottom: 20px; z-index: 9998; display: flex;
  flex-direction: row-reverse; align-items: flex-end; gap: 10px; }
.chat-ventana { width: 288px; background: var(--panel-solid); border: 1px solid rgba(var(--ink-rgb), 0.1);
  border-radius: 14px 14px 0 0; box-shadow: 0 18px 40px rgba(var(--shadow-rgb), 0.55);
  display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; }
.chat-ventana.abierta { height: 372px; }
.chat-ventana.plegada .cuerpo, .chat-ventana.plegada .pie { display: none; }
.chat-ventana .vcab { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.7rem;
  background: rgba(var(--primary-rgb), 0.28); border-bottom: 1px solid rgba(var(--ink-rgb), 0.08); cursor: pointer; }
.chat-ventana.plegada.con-nuevos .vcab { background: rgba(var(--warning-soft-rgb), 0.22); }
.chat-ventana .vcab .n { font-size: var(--t-xs); font-weight: 800; color: var(--text-strong); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.chat-ventana .vcab .cuenta { font-size: 10px; font-weight: 800; background: var(--danger-soft); color: #1a1a1a;
  border-radius: 50px; padding: 0 6px; }
.chat-ventana .vcab .acciones { margin-left: auto; display: flex; gap: 0.15rem; }
.chat-ventana .vcab button { background: none; border: 0; color: var(--text-pale); cursor: pointer;
  font-size: var(--t-sm); line-height: 1; padding: 0.2rem 0.35rem; border-radius: 6px; }
.chat-ventana .vcab button:hover { background: rgba(var(--ink-rgb), 0.12); }
.chat-ventana .cuerpo { padding: 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; overflow-y: auto; }
.chat-dia { align-self: center; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
  color: var(--text-dim); padding: 0.15rem 0.6rem; border-radius: 50px; background: rgba(var(--ink-rgb), 0.05); }
.chat-msg { position: relative; max-width: 82%; padding: 0.45rem 0.6rem; border-radius: 10px; font-size: var(--t-xs);
  line-height: 1.5; color: var(--text-pale); background: var(--panel-alt, #1c2b3a); border: 1px solid rgba(var(--ink-rgb), 0.06); }
.chat-msg .de { font-size: 10px; font-weight: 700; color: var(--brand-pale); margin-bottom: 0.15rem; }
.chat-msg .pie { margin-top: 0.25rem; font-size: 10px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
.chat-msg.mio { align-self: flex-end; background: rgba(var(--primary-rgb), 0.38); border-color: rgba(var(--brand-rgb), 0.35);
  color: var(--text-main); }
.chat-msg.mio .pie { text-align: right; color: var(--brand-pale); }
.chat-msg.aviso { align-self: center; max-width: 95%; text-align: center; font-size: 10px; color: var(--warning-soft);
  background: rgba(var(--warning-soft-rgb), 0.08); border-color: rgba(var(--warning-soft-rgb), 0.3); }
.chat-msg.borrado { font-style: italic; color: var(--text-dim); }
.chat-msg .quitar { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 50%;
  border: 1px solid rgba(var(--danger-rgb), 0.5); background: var(--panel-deep, #0b1120); color: var(--danger-soft);
  font-size: 11px; line-height: 1; cursor: pointer; display: none; place-items: center; }
.chat-msg:hover .quitar { display: grid; }
.chat-ventana .pie { border-top: 1px solid rgba(var(--ink-rgb), 0.07); }
.chat-ventana .caja { display: flex; gap: 0.4rem; padding: 0.55rem 0.6rem; }
.chat-ventana .caja input { flex: 1; background: var(--panel-deep, #0b1120); color: var(--text-main);
  border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 8px; padding: 0.45rem 0.6rem; font-size: var(--t-xs); }
.chat-ventana .caja button { background: var(--primary); border: 0; color: #fff; border-radius: 8px;
  padding: 0.45rem 0.7rem; font-size: var(--t-xs); font-weight: 700; cursor: pointer; }
#chat-toast { position: fixed; right: 20px; bottom: 72px; z-index: 9999; width: 270px; background: var(--panel-solid);
  border: 1px solid rgba(var(--warning-soft-rgb), 0.45); border-left: 3px solid var(--warning-soft); border-radius: 12px;
  box-shadow: 0 18px 40px rgba(var(--shadow-rgb), 0.55); padding: 0.6rem 0.75rem; display: grid;
  grid-template-columns: 32px 1fr; gap: 0.15rem 0.6rem; cursor: pointer; text-align: left; font-family: inherit; }
#chat-toast .de { font-size: var(--t-xs); font-weight: 800; color: var(--text-strong); }
#chat-toast .txt { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* EL ATRIBUTO hidden TIENE QUE GANARLE AL display DE ARRIBA.
   Un selector de id con display:grid le gana al [hidden]{display:none} que trae el navegador,
   asi que el panel, la ventana de grupo y el globito se veian los TRES encimados aunque por
   dentro estuvieran cerrados; y como quedaban uno sobre otro, los clics no llegaban. Lo vio
   Daniel en su pantalla: "se esta pisando el chat... doy clic y no funciona nada". La prueba
   automatica no lo agarro porque miraba la propiedad hidden y no si se veia: aplicado no es lo
   mismo que se ve. */
#chat-panel[hidden], #chat-grupo[hidden], #chat-toast[hidden], #chat-globo[hidden] { display: none !important; }
#chat-grupo { position: fixed; right: 20px; bottom: 72px; z-index: 9998; width: 310px; background: var(--panel-solid);
  border: 1px solid rgba(var(--brand-rgb), 0.4); border-radius: 14px; box-shadow: 0 18px 40px rgba(var(--shadow-rgb), 0.55);
  padding: 0.9rem; display: grid; gap: 0.6rem; font-size: var(--t-xs); }
#chat-grupo h3 { margin: 0; font-size: var(--t-sm); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--text-strong); }
#chat-grupo input[type="text"] { background: var(--panel-deep, #0b1120); color: var(--text-main);
  border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 8px; padding: 0.45rem 0.7rem; font-size: var(--t-xs); }
#chat-grupo .gente { display: grid; gap: 0.3rem; max-height: 170px; overflow-y: auto; }
#chat-grupo label { display: flex; align-items: center; gap: 0.5rem; color: var(--text-soft); cursor: pointer; }
#chat-grupo .botones { display: flex; gap: 0.5rem; justify-content: flex-end; }
#chat-grupo button { border-radius: 8px; padding: 0.4rem 0.8rem; font-size: var(--t-xs); font-weight: 700; cursor: pointer; }
#chat-grupo .crear { background: var(--primary); border: 1px solid var(--primary); color: #fff; }
#chat-grupo .cancelar { background: none; border: 1px solid rgba(var(--ink-rgb), 0.15); color: var(--text-muted); }
@media (max-width: 900px) { #chat-ventanas { right: 20px; bottom: 130px; } #chat-panel, #chat-grupo { width: 280px; } }
@media (prefers-reduced-motion: reduce) { #chat-burbuja.late { animation: none; } }
`;

let raiz = null;     // el nodo que cuelga del body con todo adentro

const nodo = (id) => raiz && raiz.querySelector('#' + id);

const dibujarCascaron = () => {
    const estilo = document.createElement('style');
    estilo.id = 'chat-estilos';
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    raiz = document.createElement('div');
    raiz.id = 'chat-raiz';
    raiz.innerHTML = `
        <div id="chat-ventanas"></div>
        <div id="chat-panel" hidden>
            <div class="cab">
                <h3>Chat</h3>
                <button class="icono" id="chat-tono" type="button" title="Tono activado">🔔</button>
                <button class="icono" id="chat-nuevo-grupo" type="button">+ Grupo</button>
            </div>
            <div class="buscar"><input id="chat-buscar" type="search" placeholder="Buscar a cualquier persona…" aria-label="Buscar a cualquier persona"></div>
            <div id="chat-lista"></div>
        </div>
        <div id="chat-grupo" hidden>
            <h3>Nuevo grupo</h3>
            <input type="text" id="chat-grupo-nombre" placeholder="Nombre del grupo (ej. Turno noche)">
            <div class="gente" id="chat-grupo-gente"></div>
            <div class="botones">
                <button class="cancelar" id="chat-grupo-cancelar" type="button">Cancelar</button>
                <button class="crear" id="chat-grupo-crear" type="button">Crear grupo</button>
            </div>
        </div>
        <button id="chat-toast" type="button" hidden>
            <span class="chat-ini" id="chat-toast-ini">··</span>
            <span class="de" id="chat-toast-de"></span>
            <span class="txt" id="chat-toast-txt"></span>
        </button>
        <button id="chat-burbuja" type="button" aria-label="Abrir el chat">
            ${ICONO_GENTE}
            <span id="chat-globo" hidden>0</span>
        </button>`;
    document.body.appendChild(raiz);
    enganchar();
};

const filaSala = (s) => {
    const lista = mensajes[s.id] || [];
    const ultimo = lista.slice(-1)[0];
    const n = sinLeer(s.id);
    const previo = ultimo
        ? (s.tipo === 'grupo' && ultimo.de !== YO.username ? ultimo.de + ': ' : '')
            + (ultimo.borrado ? 'mensaje borrado' : ultimo.texto)
        : 'Sin mensajes todavía';
    return `<button type="button" class="chat-fila" data-sala="${esc(s.id)}">
        <span class="chat-ini ${s.tipo === 'grupo' ? 'grupo' : ''}">${esc(iniciales(nombreDeSala(s)))}</span>
        <span class="quien">${esc(nombreDeSala(s))}</span>
        <span class="hora">${ultimo ? esc(horaCorta(ultimo.cuando)) : ''}</span>
        <span class="ultimo">${esc(previo)}</span>
        <span class="nuevos" ${n ? '' : 'style="visibility:hidden"'}>${n || ''}</span>
    </button>`;
};

const filaPersona = (p) => `<button type="button" class="chat-fila" data-persona="${esc(p.username)}">
        <span class="chat-ini">${esc(iniciales(p.username))}</span>
        <span class="quien">${esc(p.username)}</span>
        <span class="marca">Nuevo</span>
        <span class="ultimo">${esc(p.role || '')} · sin conversación todavía</span>
        <span class="nuevos" style="visibility:hidden"></span>
    </button>`;

const pintarLista = () => {
    const caja = nodo('chat-lista');
    if (!caja) return;
    const q = ((nodo('chat-buscar') || {}).value || '').trim().toLowerCase();
    const ordenadas = salas.slice().sort((a, b) => {
        const ua = (mensajes[a.id] || []).slice(-1)[0];
        const ub = (mensajes[b.id] || []).slice(-1)[0];
        return String((ub || {}).cuando || '').localeCompare(String((ua || {}).cuando || ''));
    });
    if (!q) { caja.innerHTML = ordenadas.map(filaSala).join('') || '<div class="vacio">Todavía no hay conversaciones. Busca a alguien arriba.</div>'; return; }
    const salasQ = ordenadas.filter(s => nombreDeSala(s).toLowerCase().indexOf(q) >= 0);
    const conSala = {};
    salas.forEach(s => { if (s.tipo !== 'grupo') (s.miembros || []).forEach(u => { conSala[u] = true; }); });
    const personas = gente.filter(p => p.username !== YO.username && !conSala[p.username]
        && (p.username.toLowerCase().indexOf(q) >= 0 || String(p.role || '').toLowerCase().indexOf(q) >= 0));
    let html = '';
    if (salasQ.length) html += '<div class="sec">Conversaciones</div>' + salasQ.map(filaSala).join('');
    if (personas.length) html += '<div class="sec">Personas de la web</div>' + personas.map(filaPersona).join('');
    caja.innerHTML = html || '<div class="vacio">Nadie con ese nombre.</div>';
};

const pintarVentanas = () => {
    const caja = nodo('chat-ventanas');
    if (!caja) return;
    caja.innerHTML = abiertas.map(v => {
        const s = salaDe(v.id);
        if (!s) return '';
        const lista = mensajes[v.id] || [];
        let diaPintado = '';
        const cuerpo = lista.map(m => {
            let html = '';
            const dia = diaDe(m.cuando);
            if (dia && dia !== diaPintado) { diaPintado = dia; html += `<div class="chat-dia">${esc(dia === diaDe(sello()) ? 'Hoy' : dia.split('-').reverse().join('/'))}</div>`; }
            if (m.aviso) return html + `<div class="chat-msg aviso">${esc(m.de)} ${esc(m.texto)}</div>`;
            if (m.borrado) return html + `<div class="chat-msg borrado">mensaje borrado</div>`;
            const mio = m.de === YO.username;
            const de = (!mio && s.tipo === 'grupo') ? `<div class="de">${esc(m.de)}</div>` : '';
            const estado = mio ? (m.sinEnviar ? ' · sin enviar' : '') : '';
            const quitar = YO.username === SUPERUSUARIO
                ? `<button class="quitar" type="button" title="Borrar (solo el administrador)" data-borrar="${esc(m.id)}" data-sala="${esc(s.id)}">×</button>` : '';
            return html + `<div class="chat-msg ${mio ? 'mio' : ''}">${de}${esc(m.texto)}
                <div class="pie">${esc(horaCorta(m.cuando))}${estado}</div>${quitar}</div>`;
        }).join('');
        const n = sinLeer(s.id);
        return `<section class="chat-ventana ${v.plegada ? 'plegada' : 'abierta'} ${n ? 'con-nuevos' : ''}" data-sala="${esc(s.id)}">
            <header class="vcab" data-plegar="${esc(s.id)}">
                <span class="n">${esc(nombreDeSala(s))}</span>
                ${v.plegada && n ? `<span class="cuenta">${n}</span>` : ''}
                <span class="acciones">
                    <button type="button" data-plegar="${esc(s.id)}" title="Plegar">–</button>
                    <button type="button" data-cerrar="${esc(s.id)}" title="Cerrar">×</button>
                </span>
            </header>
            <div class="cuerpo" data-cuerpo="${esc(s.id)}">${cuerpo || '<div class="chat-dia">Sin mensajes</div>'}</div>
            <div class="pie">
                <div class="caja">
                    <input type="text" placeholder="Escribe…" data-escribir="${esc(s.id)}" aria-label="Escribe un mensaje">
                    <button type="button" data-enviar="${esc(s.id)}">Enviar</button>
                </div>
            </div>
        </section>`;
    }).join('');
    abiertas.forEach(v => {
        const c = caja.querySelector(`[data-cuerpo="${v.id}"]`);
        if (c) c.scrollTop = c.scrollHeight;
    });
};

const pintarGlobo = () => {
    const g = nodo('chat-globo');
    if (!g) return;
    const n = sinLeerTotal();
    g.textContent = n;
    g.hidden = n === 0;
    const base = String(document.title || '').replace(/^\(\d+\)\s*/, '');
    document.title = n ? `(${n}) ${base}` : base;
};

const pintar = () => { pintarLista(); pintarVentanas(); pintarGlobo(); };

const esconderToast = () => {
    const t = nodo('chat-toast');
    if (t) t.hidden = true;
    toastSala = null;
    if (toastReloj) { clearTimeout(toastReloj); toastReloj = null; }
};

const avisar = (sala, msg) => {
    const t = nodo('chat-toast');
    if (!t) return;
    /* Si el panel o la ventana de grupo estan abiertos, el globito no sale: ocupan el mismo
       rincon y quedarian uno encima del otro. El contador rojo y la lista ya avisan. */
    if (panelAbierto || !nodo('chat-grupo').hidden) { tin(); return; }
    toastSala = sala.id;
    nodo('chat-toast-ini').textContent = iniciales(nombreDeSala(sala));
    nodo('chat-toast-de').textContent = nombreDeSala(sala);
    nodo('chat-toast-txt').textContent = msg.texto;
    t.hidden = false;
    const b = nodo('chat-burbuja');
    if (b) { b.classList.remove('late'); void b.offsetWidth; b.classList.add('late'); }
    if (toastReloj) clearTimeout(toastReloj);
    toastReloj = setTimeout(esconderToast, 6000);
    tin();
};

/* ── LO QUE HACE EL USUARIO ────────────────────────────────────────────────────────────── */

const abrirSala = async (id) => {
    const s = salaDe(id);
    if (!s) return;
    const ya = abiertas.filter(v => v.id === id)[0];
    if (ya) ya.plegada = false;
    else {
        abiertas.unshift({ id, plegada: false });
        if (abiertas.length > MAX_VENTANAS) abiertas.pop();
    }
    await bajarSala(id);
    marcarLeida(id);
    esconderToast();
    pintar();
    acomodarReloj();
    const caja = raiz.querySelector(`[data-escribir="${id}"]`);
    if (caja) caja.focus();
};

const enganchar = () => {
    nodo('chat-burbuja').addEventListener('click', () => {
        nodo('chat-grupo').hidden = true;
        panelAbierto = !panelAbierto;
        nodo('chat-panel').hidden = !panelAbierto;
        if (panelAbierto) { pintarLista(); nodo('chat-buscar').focus(); latir(); }
        acomodarReloj();
    });

    nodo('chat-buscar').addEventListener('input', pintarLista);

    nodo('chat-lista').addEventListener('click', async (e) => {
        const p = e.target.closest('[data-persona]');
        if (p) {
            const id = await crearDirecta(p.getAttribute('data-persona'));
            nodo('chat-buscar').value = '';
            await abrirSala(id);
            return;
        }
        const f = e.target.closest('[data-sala]');
        if (f) abrirSala(f.getAttribute('data-sala'));
    });

    nodo('chat-toast').addEventListener('click', () => { if (toastSala) abrirSala(toastSala); });

    nodo('chat-tono').addEventListener('click', (e) => {
        sonando = !sonando;
        e.currentTarget.textContent = sonando ? '🔔' : '🔇';
        e.currentTarget.title = sonando ? 'Tono activado' : 'Tono silenciado';
        try { localStorage.setItem('chat_tono', sonando ? '1' : '0'); } catch (err) { /* da igual */ }
        if (sonando) tin();
    });

    nodo('chat-nuevo-grupo').addEventListener('click', () => {
        nodo('chat-panel').hidden = true;
        panelAbierto = false;
        nodo('chat-grupo-gente').innerHTML = gente.filter(p => p.username !== YO.username)
            .map(p => `<label><input type="checkbox" value="${esc(p.username)}"> ${esc(p.username)} · <span style="color:var(--text-dim)">${esc(p.role || '')}</span></label>`).join('');
        nodo('chat-grupo').hidden = false;
    });
    nodo('chat-grupo-cancelar').addEventListener('click', () => {
        nodo('chat-grupo').hidden = true;
        panelAbierto = true;
        nodo('chat-panel').hidden = false;
    });
    nodo('chat-grupo-crear').addEventListener('click', async () => {
        const nombre = nodo('chat-grupo-nombre').value.trim();
        const elegidos = Array.prototype.slice.call(raiz.querySelectorAll('#chat-grupo-gente input:checked')).map(i => i.value);
        if (!elegidos.length) return;
        const id = await crearGrupo(nombre, elegidos);
        nodo('chat-grupo-nombre').value = '';
        nodo('chat-grupo').hidden = true;
        panelAbierto = false;
        nodo('chat-panel').hidden = true;
        await abrirSala(id);
    });

    const ventanas = nodo('chat-ventanas');
    ventanas.addEventListener('click', (e) => {
        const cerrar = e.target.closest('[data-cerrar]');
        if (cerrar) {
            abiertas = abiertas.filter(v => v.id !== cerrar.getAttribute('data-cerrar'));
            pintarVentanas(); acomodarReloj(); return;
        }
        const plegar = e.target.closest('[data-plegar]');
        if (plegar) {
            const id = plegar.getAttribute('data-plegar');
            abiertas.forEach(v => { if (v.id === id) { v.plegada = !v.plegada; if (!v.plegada) marcarLeida(id); } });
            pintar(); acomodarReloj(); return;
        }
        const quitar = e.target.closest('[data-borrar]');
        if (quitar) { borrar(quitar.getAttribute('data-sala'), quitar.getAttribute('data-borrar')); return; }
        const enviar = e.target.closest('[data-enviar]');
        if (enviar) escribir(enviar.getAttribute('data-enviar'));
    });
    ventanas.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('[data-escribir]')) {
            e.preventDefault();
            escribir(e.target.getAttribute('data-escribir'));
        }
    });
};

const escribir = async (idSala) => {
    const caja = raiz.querySelector(`[data-escribir="${idSala}"]`);
    if (!caja) return;
    const texto = caja.value;
    caja.value = '';
    await mandar(idSala, texto);
    const otra = raiz.querySelector(`[data-escribir="${idSala}"]`);
    if (otra) otra.focus();
};

/* ── ARRANQUE Y APAGADO ────────────────────────────────────────────────────────────────── */

export const montarChat = async (session) => {
    if (arrancado) return;
    YO = session && session.username ? session : null;
    if (!YO) return;
    arrancado = true;
    try { sonando = localStorage.getItem('chat_tono') !== '0'; } catch (e) { /* da igual */ }

    dibujarCascaron();

    try {
        const r = await fetch(`${API}/users?t=${Date.now()}`);
        const c = await r.json();
        const d = (c && c.data) || c || [];
        gente = (Array.isArray(d) ? d : []).filter(u => u && u.username && u.active !== 0);
    } catch (e) { gente = []; }

    try { salas = (await traer(SALAS)).filter(esMiSala); } catch (e) { salas = []; }
    try {
        const filas = await traer(LEIDOS);
        const mio = filas.filter(f => f.id === YO.username)[0];
        leidos = (mio && mio.salas) || {};
    } catch (e) { leidos = {}; }

    for (const s of salas) { await bajarSala(s.id); reponerContador(s.id); }
    pintar();
    acomodarReloj();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') latir(); });
    console.log(`💬 [CHAT] listo para ${YO.username}: ${salas.length} conversación(es).`);
};

export const desmontarChat = () => {
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    const est = document.getElementById('chat-estilos');
    if (est && est.parentNode) est.parentNode.removeChild(est);
    raiz = null; arrancado = false; salas = []; mensajes = {}; abiertas = []; panelAbierto = false;
};

/* Para la prueba del navegador: deja a mano lo que hace falta empujar sin tocar la pantalla. */
window.__chat = { latir, mandar, crearDirecta, crearGrupo, borrar, bajarSala, marcasDelServidor,
                  estado: () => ({ salas, mensajes, leidos, noLeidos, abiertas, versionesVistas,
                                   sinLeer: sinLeerTotal() }) };
