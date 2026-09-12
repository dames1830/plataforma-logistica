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

/* TODO EL CHAT SE GUARDA BAJO LA MISMA FOTO: "MASTER".
 *
 * El servidor guarda UNA FOTO POR DIA de cada area y, cuando se le pide el area sin
 * decirle fecha, devuelve la MAS RECIENTE. A las 00:00 la foto del dia nuevo arranca
 * vacia: el primer mensaje de la madrugada creaba una foto con ese mensaje solo, y la
 * conversacion entera parecia borrada. Y no era solo parecer: el servidor conserva unicamente
 * las 2 fotos mas recientes de cada area, asi que a los dos dias los mensajes se perdian
 * de verdad.
 *
 * Guardando siempre en MASTER -como ya hacen la configuracion, los usuarios y las tareas
 * de almacenaje- la conversacion es UNA SOLA y no depende del dia. El robot de archivado
 * es el unico que la recorta, y recien a los 30 dias. */
const FOTO = 'date=MASTER';
const LEIDOS = 'chat_leidos';
const CADA_LENTO = 20000;   // sin ventanas abiertas: alcanza para el contador
const CADA_VIVO = 4000;     // con una ventana abierta: la conversación tiene que sentirse viva
const MAX_VENTANAS = 3;
const EN_LA_LISTA = 5;      // cuantas conversaciones se ven en el panel sin buscar
const PRESENCIA = 'chat_presencia';
const ANUNCIO_CADA = 25000;      // cada cuanto esta pantalla dice "sigo aqui"
const MIRAR_QUIEN_CADA = 15000;  // cada cuanto pregunta quien mas esta
const SE_APAGA_A_LOS = 70000;    // sin noticias, se apaga la bolita (dos avisos perdidos)
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
let salaDelClip = null;     // a que conversacion va el archivo que se esta eligiendo
let presencia = {};         // { usuario: cuando dijo "sigo aqui", en hora del servidor }
let desfaseReloj = 0;       // ms entre el reloj del servidor y el de esta PC
let ultimoAnuncio = 0;
let ultimaMirada = 0;

/* ── LO QUE HABLA CON EL SERVIDOR ──────────────────────────────────────────────────────── */

const cabeceras = () => {
    const h = { 'Content-Type': 'application/json' };
    if (YO && YO.token) h['X-Auth-Token'] = YO.token;
    return h;
};

const traer = async (area) => {
    const r = await fetch(`${API}/${area}?${FOTO}&t=${Date.now()}`);
    if (!r.ok) throw new Error(`${area}: ${r.status}`);
    const c = await r.json();
    const d = (c && c.data !== undefined) ? c.data : c;
    return Array.isArray(d) ? d : [];
};

/* Un elemento con id: el servidor lo reemplaza si existe y lo AGREGA si no. Es lo que
   permite mandar un mensaje sin reescribir la conversación entera. */
const poner = async (area, elemento) => {
    const r = await fetch(`${API}/${area}?${FOTO}`, {
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

/* ── QUIEN ESTA CONECTADO ──────────────────────────────────────────────────────────────
 *
 * El servidor no avisa nada por su cuenta, asi que cada pantalla escribe "sigo aqui" en el
 * area `chat_presencia` cada 25 segundos. Quien dijo algo en los ultimos 70 esta en linea;
 * los 70 son a proposito: aguantan dos avisos perdidos por una red lenta sin apagar la
 * bolita de alguien que si esta.
 *
 * LA HORA ES LA DEL SERVIDOR, NO LA DE CADA PC. Dos computadoras del almacen pueden tener
 * la hora distinta por minutos -ya paso con el contador de no leidos-. Si la bolita se
 * calculara con el reloj de cada una, una PC atrasada veria a todo el mundo desconectado.
 * Se pregunta la hora del servidor UNA vez al entrar y se guarda la diferencia. */

const ahoraDelServidor = () => Date.now() + desfaseReloj;

const sincronizarReloj = async () => {
    try {
        const salida = Date.now();
        const r = await fetch(`${BASE}/api/health?t=${salida}`);
        if (!r.ok) return;
        const c = await r.json();
        if (!c || !c.timestamp) return;
        /* Se le descuenta la mitad del viaje de ida y vuelta: es la forma barata de no
           contar como desfase lo que en realidad tardo la red. */
        const viaje = (Date.now() - salida) / 2;
        desfaseReloj = new Date(c.timestamp).getTime() + viaje - Date.now();
    } catch (e) { desfaseReloj = 0; }
};

/** Dice "sigo aqui". Con `apagandome`, dice lo contrario: al salir, la bolita se apaga ya. */
const anunciarme = async (apagandome = false) => {
    if (!YO) return;
    try { await poner(PRESENCIA, { id: YO.username, visto: apagandome ? 0 : ahoraDelServidor() }); }
    catch (e) { /* se reintenta en el proximo latido */ }
};

const mirarQuienEsta = async () => {
    try {
        const lista = await traer(PRESENCIA);
        const nuevo = {};
        lista.forEach(p => { if (p && p.id) nuevo[p.id] = Number(p.visto) || 0; });
        presencia = nuevo;
    } catch (e) { /* se reintenta; mientras tanto vale lo ultimo que se supo */ }
};

const enLinea = (usuario) => !!usuario
    && (ahoraDelServidor() - (presencia[usuario] || 0)) < SE_APAGA_A_LOS;

/* ── LAS SALAS ─────────────────────────────────────────────────────────────────────────── */

/** El id de una conversación de dos sale de los dos nombres, ordenados: las dos PC lo
 *  calculan igual sin preguntarle nada a nadie. */
const idDirecta = (a, b) => 'du_' + [a, b].sort().join('__');

const salaDe = (id) => salas.filter(s => s.id === id)[0];

const nombreDeSala = (s) => {
    if (!s) return '';
    if (s.tipo === 'grupo') return s.nombre;
    const otro = (s.miembros || []).filter(u => u !== YO.username)[0];
    return nombreDe(otro) || s.nombre || '';
};

const esMiSala = (s) => !!s && (s.tipo === 'grupo'
    ? (s.miembros || []).indexOf(YO.username) >= 0
    : (s.miembros || []).indexOf(YO.username) >= 0);

/* EN PANTALLA VA EL NOMBRE, NO EL USUARIO. Daniel: "lo debo buscar por nombre, pero en la web
   solo lo puedo buscar por usuario". El usuario queda abajo, chiquito, porque sigue siendo lo
   que identifica a la persona en las tareas y en los reportes. */
/** A quien se le puede escribir hoy: los dados de baja no pueden entrar a la web. */
const activos = () => gente.filter(p => p.active !== 0 && p.active !== false);

/* LOS NOMBRES, TODOS IGUALES. En la lista de usuarios hay nombres escritos en mayusculas
   -"VICENTE MORON"- y otros normales, y en el chat quedaban mezclados. Se dibujan siempre
   con la primera letra de cada palabra en mayuscula y el resto en minuscula. NO se toca el
   dato guardado: si manana alguien carga otro nombre a los gritos, tambien se vera parejo. */
const nombreBonito = (texto) => String(texto || '').trim().toLocaleLowerCase('es')
    .replace(/(^|[\s\-'])(\S)/g, (t, antes, letra) => antes + letra.toLocaleUpperCase('es'));

const nombreDe = (usuario) => {
    const p = gente.filter(x => x.username === usuario)[0];
    return (p && nombreBonito(p.name)) || usuario || '';
};

const iniciales = (texto) => {
    const partes = String(texto || '?').trim().split(' ').filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return String(texto || '?').slice(0, 2).toUpperCase();
};

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

const mandar = async (idSala, texto, esAviso = false, adjunto = null) => {
    const t = String(texto || '').trim();
    if (!t && !adjunto) return false;
    const msg = { id: `${Date.now().toString(36)}_${YO.username}_${Math.random().toString(36).slice(2, 7)}`,
                  de: YO.username, texto: t, cuando: sello() };
    if (esAviso) msg.aviso = true;
    if (adjunto) msg.adjunto = adjunto;
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
        .filter(m => m.de !== YO.username && !m.sistema && String(m.cuando || '') > desde).length;
};

/* -- LAS FOTOS Y LOS ARCHIVOS -------------------------------------------------------------
 *
 * CADA ADJUNTO VIVE EN SU PROPIA AREA, `chat_adj_<id>`, con el archivo en base64 adentro.
 * No se usa el almacen de `/api/archivos` -el de los stocks y el slotting- porque ese esta
 * hecho para el robot: al subir uno nuevo BORRA el anterior del mismo tipo y del mismo dia, y
 * aca cada foto tiene que quedarse. Un area por archivo tambien evita reescribir una lista de
 * varios MB cada vez que alguien manda algo.
 *
 * LAS FOTOS SE ACHICAN EN EL NAVEGADOR antes de salir: 1600 px de lado mayor y JPEG 0,72. Una
 * foto de celular de 4 MB queda en unos 250 KB y en pantalla se ve igual.
 *
 * A los 30 dias el robot de archivado se las lleva a OneDrive y las borra de aca: el servidor
 * nunca acumula.
 */
const TOPE_ARCHIVO_MB = 5;
const TOPE_VIDEO_MB = 15;
const LADO_MAXIMO = 1600;

const tipoDeArchivo = (mime) => {
    const m = String(mime || '').toLowerCase();
    if (m.indexOf('image/') === 0) return 'imagen';
    if (m.indexOf('video/') === 0) return 'video';
    return 'archivo';
};

const pesoLegible = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
};

const leerComoDatos = (blob) => new Promise((listo, falla) => {
    const lector = new FileReader();
    lector.onload = () => listo(lector.result);
    lector.onerror = () => falla(new Error('no se pudo leer el archivo'));
    lector.readAsDataURL(blob);
});

/** Achica la foto en el navegador. Si algo falla, se manda tal cual vino. */
const achicarFoto = (archivo) => new Promise((listo) => {
    const mime = String(archivo.type || '');
    if (mime.indexOf('image/') !== 0 || mime.indexOf('gif') >= 0) { listo(archivo); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
        try {
            const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
            if (escala >= 1 && archivo.size < 400 * 1024) { URL.revokeObjectURL(url); listo(archivo); return; }
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
            lienzo.toBlob((b) => {
                URL.revokeObjectURL(url);
                listo(b && b.size < archivo.size ? b : archivo);
            }, 'image/jpeg', 0.72);
        } catch (e) { URL.revokeObjectURL(url); listo(archivo); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); listo(archivo); };
    img.src = url;
});

const adjuntos = {};      // { idAdjunto: datos } - lo ya bajado, para no pedirlo dos veces

const traerAdjunto = async (id) => {
    if (adjuntos[id]) return adjuntos[id];
    try {
        const lista = await traer('chat_adj_' + id);
        const a = lista[0];
        if (a && a.datos) { adjuntos[id] = a.datos; return a.datos; }
    } catch (e) { /* se vuelve a intentar en el proximo dibujo */ }
    return null;
};

/** Sube el archivo y devuelve la ficha que viaja dentro del mensaje. */
const subirAdjunto = async (archivo) => {
    const tipo = tipoDeArchivo(archivo.type);
    const listo = tipo === 'imagen' ? await achicarFoto(archivo) : archivo;
    const topeMb = tipo === 'video' ? TOPE_VIDEO_MB : TOPE_ARCHIVO_MB;
    if (listo.size > topeMb * 1024 * 1024) {
        alert('Ese archivo pesa ' + pesoLegible(listo.size) + ' y el maximo es ' + topeMb + ' MB.');
        return null;
    }
    const datos = await leerComoDatos(listo);
    const id = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    /* AL ACHICARLA, LA FOTO CAMBIA DE FORMATO. Guardarla con el nombre ".png" de antes deja
       un archivo que por dentro es JPEG: se abre igual, pero el nombre miente y asi queda
       para siempre en OneDrive cuando el robot la archive. */
    let nombre = archivo.name || 'foto.jpg';
    if (tipo === 'imagen' && (listo.type || '') === 'image/jpeg' && !/\.jpe?g$/i.test(nombre)) {
        nombre = nombre.replace(/\.[^.]+$/, '') + '.jpg';
    }
    const ficha = { id, nombre, tipo,
                    mime: listo.type || archivo.type || '', tamano: listo.size };
    const r = await fetch(API + '/chat_adj_' + id + '?' + FOTO, {
        method: 'POST', headers: cabeceras(),
        body: JSON.stringify([Object.assign({ datos: datos }, ficha)])
    });
    if (!r.ok) throw new Error('no se pudo subir el archivo');
    adjuntos[id] = datos;
    return ficha;
};

const mandarConAdjunto = async (idSala, archivo) => {
    const clip = raiz.querySelector('[data-clip="' + idSala + '"]');
    if (clip) { clip.textContent = '...'; clip.disabled = true; }
    try {
        const ficha = await subirAdjunto(archivo);
        if (ficha) {
            const cajaTexto = raiz.querySelector('[data-escribir="' + idSala + '"]');
            const texto = (cajaTexto && cajaTexto.value.trim()) || '';
            if (cajaTexto) cajaTexto.value = '';
            await mandar(idSala, texto, false, ficha);
        }
    } catch (e) {
        console.warn('[CHAT] no se pudo mandar el archivo:', e && e.message);
        alert('No se pudo mandar el archivo. Vuelve a intentar.');
    } finally {
        const otro = raiz.querySelector('[data-clip="' + idSala + '"]');
        if (otro) { otro.textContent = '📎'; otro.disabled = false; }
    }
};

/** Rellena las fotos que ya estan en pantalla, cuando llegan sus datos. */
const pintarAdjuntos = () => {
    if (!raiz) return;
    raiz.querySelectorAll('[data-adj]:not([data-listo])').forEach((el) => {
        const id = el.getAttribute('data-adj');
        traerAdjunto(id).then((datos) => {
            if (!datos) return;
            el.setAttribute('data-listo', '1');
            if (el.tagName === 'IMG') el.src = datos;
        });
    });
};

const verGrande = (id) => {
    traerAdjunto(id).then((datos) => {
        if (!datos) return;
        const v = nodo('chat-visor');
        v.querySelector('img').src = datos;
        v.hidden = false;
    });
};

const bajarAdjunto = (id, nombre) => {
    traerAdjunto(id).then((datos) => {
        if (!datos) return;
        const a = document.createElement('a');
        a.href = datos;
        a.download = nombre || 'archivo';
        document.body.appendChild(a);
        a.click();
        a.remove();
    });
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
    /* "Sigo aqui" y "quien mas esta". Van con su propio reloj y no con el del latido:
       el latido se acelera a 4 s con una ventana abierta, y no hace falta anunciarse
       quince veces por minuto. */
    const ahoraAqui = Date.now();
    if (ahoraAqui - ultimoAnuncio > ANUNCIO_CADA) { ultimoAnuncio = ahoraAqui; anunciarme(); }
    if (ahoraAqui - ultimaMirada > MIRAR_QUIEN_CADA) { ultimaMirada = ahoraAqui; await mirarQuienEsta(); }

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
        /* `sistema` es lo que deja el robot de archivado: no suena ni pone globo rojo.
           Corre de madrugada y toca todas las conversaciones; sin esto todo el mundo
           amaneceria con un aviso por conversacion. */
        const nuevos = (await bajarSala(s.id)).filter(m => m.de !== YO.username && !m.sistema);
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
/* LA BURBUJA SE QUEDO SOLA EN LA ESQUINA: el foquito del servidor subio a la barra de
   arriba, al costado del nombre, asi que este rincon es todo del chat. */
#chat-burbuja {
  position: fixed; bottom: 20px; right: 20px; z-index: 9999; width: 40px; height: 40px;
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
.chat-ini { position: relative; grid-row: span 2; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
  font-size: 11px; font-weight: 800; color: var(--brand-pale); background: rgba(var(--brand-rgb), 0.16);
  border: 1px solid rgba(var(--brand-rgb), 0.3); }
/* La bolita verde: quien esta con la web abierta ahora mismo. */
.chat-ini.en-linea::after { content: ''; position: absolute; right: -3px; bottom: -3px;
  width: 11px; height: 11px; border-radius: 50%; background: rgba(var(--success-rgb), 1);
  border: 2px solid var(--panel-solid); box-shadow: 0 0 6px rgba(var(--success-rgb), 0.7); }
.chat-ventana .vcab .luz { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
  background: rgba(var(--ink-rgb), 0.28); }
.chat-ventana .vcab .luz.si { background: rgba(var(--success-rgb), 1);
  box-shadow: 0 0 6px rgba(var(--success-rgb), 0.7); }
.chat-ini.grupo { color: var(--text-pale); background: rgba(var(--ink-rgb), 0.06); border-color: rgba(var(--ink-rgb), 0.12); }
.chat-fila .quien { font-weight: 700; color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-fila .hora { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
.chat-fila .ultimo { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-fila .nuevos { font-size: 11px; font-weight: 800; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 50px; background: var(--primary); color: #fff; display: grid; place-items: center; }
.chat-fila .marca { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: var(--brand-pale); }
/* LAS VENTANITAS VIVEN AL COSTADO DEL PANEL. Con el panel cerrado se corren a la derecha,
   hasta quedar pegadas a la burbuja: si no, dejaban un hueco del ancho del panel.
   SIN TRANSICION: con transition en right el navegador se quedaba en el valor viejo -medido,
   no supuesto- y la ventanita no se movia nunca. El salto es instantaneo y basta. */
#chat-ventanas { position: fixed; right: 348px; bottom: 20px; z-index: 9998; display: flex;
  flex-direction: row-reverse; align-items: flex-end; gap: 10px; }
#chat-ventanas.solas { right: 72px; }
.chat-ventana { width: 288px; background: var(--panel-solid); border: 1px solid rgba(var(--ink-rgb), 0.1);
  border-radius: 14px 14px 0 0; box-shadow: 0 18px 40px rgba(var(--shadow-rgb), 0.55);
  display: grid; grid-template-rows: auto 1fr auto; overflow: hidden;
  /* minmax(0, ...): sin esto la columna se estira a lo que pida la pieza mas ancha
     -la fila de escribir- y la ventana corta por la derecha lo que le sobra. */
  grid-template-columns: minmax(0, 1fr); }
.chat-ventana > * { min-width: 0; }
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
  line-height: 1.5; color: var(--text-pale); background: var(--panel-alt, #1c2b3a); border: 1px solid rgba(var(--ink-rgb), 0.06);
  /* Un link largo o un codigo sin espacios se parte antes que empujar la ventana. */
  min-width: 0; overflow-wrap: anywhere; }
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
.chat-ventana .caja { min-width: 0; }
.chat-ventana .caja input { flex: 1; min-width: 0; background: var(--panel-deep, #0b1120); color: var(--text-main);
  border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 8px; padding: 0.45rem 0.6rem; font-size: var(--t-xs); }
.chat-ventana .caja button { background: var(--primary); border: 0; color: #fff; border-radius: 8px;
  padding: 0.45rem 0.7rem; font-size: var(--t-xs); font-weight: 700; cursor: pointer; }
.chat-msg .adj-img { display: block; max-width: 100%; border-radius: 8px; margin-top: 0.2rem; cursor: zoom-in; background: rgba(var(--ink-rgb), 0.06); min-height: 40px; }
.chat-msg .adj-file { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem; padding: 0.4rem 0.5rem;
  border-radius: 8px; background: rgba(var(--ink-rgb), 0.06); border: 1px solid rgba(var(--ink-rgb), 0.1);
  cursor: pointer; color: var(--text-pale); min-width: 0; max-width: 100%; }
.chat-msg .adj-file .nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-msg .adj-file:hover { background: rgba(var(--primary-rgb), 0.25); }
.chat-msg .adj-file .ico { font-size: var(--t-lg); }
.chat-msg .adj-file .peso { margin-left: auto; font-size: 10px; color: var(--text-dim); white-space: nowrap; }
.chat-ventana .clip { background: rgba(var(--ink-rgb), 0.06); border: 1px solid rgba(var(--ink-rgb), 0.1);
  color: var(--text-pale); border-radius: 8px; padding: 0.45rem 0.5rem; font-size: var(--t-sm); cursor: pointer;
  flex: 0 0 auto; line-height: 1; }
.chat-ventana .clip:hover { background: rgba(var(--primary-rgb), 0.3); }
.chat-ventana.soltando { outline: 2px dashed var(--brand-light); outline-offset: -4px; }
#chat-visor { position: fixed; inset: 0; z-index: 10000; background: rgba(var(--shadow-rgb), 0.88);
  display: flex; align-items: center; justify-content: center; padding: 2rem; cursor: zoom-out; }
#chat-visor[hidden] { display: none !important; }
#chat-visor img { max-width: 100%; max-height: 100%; border-radius: 10px; box-shadow: 0 20px 60px rgba(var(--shadow-rgb), 0.6); }
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
@media (max-width: 900px) { #chat-ventanas, #chat-ventanas.solas { right: 20px; bottom: 130px; } #chat-panel, #chat-grupo { width: 280px; } }
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
        <div id="chat-visor" hidden><img alt="Imagen del chat"></div>
        <input id="chat-archivo" type="file" hidden accept="image/*,video/*,.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt">
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
        ? (s.tipo === 'grupo' && !ultimo.aviso && ultimo.de !== YO.username ? nombreDe(ultimo.de).split(' ')[0] + ': ' : '')
            + (ultimo.borrado ? 'mensaje borrado' : ultimo.texto)
        : 'Sin mensajes todavía';
    const conQuien = s.tipo === 'grupo' ? null : (s.miembros || []).filter(u => u !== YO.username)[0];
    return `<button type="button" class="chat-fila" data-sala="${esc(s.id)}">
        <span class="chat-ini ${s.tipo === 'grupo' ? 'grupo' : ''} ${enLinea(conQuien) ? 'en-linea' : ''}">${esc(iniciales(nombreDeSala(s)))}</span>
        <span class="quien">${esc(nombreDeSala(s))}</span>
        <span class="hora">${ultimo ? esc(horaCorta(ultimo.cuando)) : ''}</span>
        <span class="ultimo">${esc(previo)}</span>
        <span class="nuevos" ${n ? '' : 'style="visibility:hidden"'}>${n || ''}</span>
    </button>`;
};

const filaPersona = (p) => `<button type="button" class="chat-fila" data-persona="${esc(p.username)}">
        <span class="chat-ini ${enLinea(p.username) ? 'en-linea' : ''}">${esc(iniciales(nombreBonito(p.name) || p.username))}</span>
        <span class="quien">${esc(nombreBonito(p.name) || p.username)}</span>
        <span class="marca">Nuevo</span>
        <span class="ultimo">${esc(p.username)} · ${esc(p.role || '')}</span>
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
    /* SOLO LAS ULTIMAS. Daniel: "deberia aparecerme solo los ultimos cinco chat que han tenido
       conversacion... pero no debe pasarse de cinco para que no se haga un listado tan grande".
       Si hay tres, salen tres. Las demas se encuentran por el buscador de arriba.
       Las que tienen mensajes sin leer van primero -no se puede esconder un mensaje nuevo-,
       pero el tope de cinco es tope: ocupan lugar, no lo agregan. */
    if (!q) {
        const alaVista = ordenadas.filter(s => sinLeer(s.id))
            .concat(ordenadas.filter(s => !sinLeer(s.id)))
            .slice(0, EN_LA_LISTA);
        caja.innerHTML = alaVista.map(filaSala).join('')
            || '<div class="vacio">Todavía no hay conversaciones. Busca a alguien arriba.</div>';
        return;
    }
    const salasQ = ordenadas.filter(s => nombreDeSala(s).toLowerCase().indexOf(q) >= 0);
    const conSala = {};
    salas.forEach(s => { if (s.tipo !== 'grupo') (s.miembros || []).forEach(u => { conSala[u] = true; }); });
    const personas = activos().filter(p => p.username !== YO.username && !conSala[p.username]
        && (String(p.name || '').toLowerCase().indexOf(q) >= 0
            || p.username.toLowerCase().indexOf(q) >= 0
            || String(p.role || '').toLowerCase().indexOf(q) >= 0));
    let html = '';
    if (salasQ.length) html += '<div class="sec">Conversaciones</div>' + salasQ.map(filaSala).join('');
    if (personas.length) html += '<div class="sec">Personas de la web</div>' + personas.map(filaPersona).join('');
    caja.innerHTML = html || '<div class="vacio">Nadie con ese nombre.</div>';
};

/* AL REPINTAR NO SE PIERDE NI EL CURSOR NI LO ESCRITO A MEDIAS.
   Daniel: "cuando envio un mensaje el foco debe volver al chat para seguir escribiendo... tengo
   que darle clic a la caja de texto". Pasaba porque cada refresco -el propio envio, y el latido
   cada 4 segundos- rehacia la ventanita entera: el navegador tira la caja vieja y crea otra, sin
   foco y sin lo que hubiera adentro. Ahora: si el dibujo quedo igual no se toca nada, y si
   cambio se repone el texto de cada caja, el foco y la posicion del cursor. */
const pintarVentanas = () => {
    const caja = nodo('chat-ventanas');
    if (!caja) return;
    const html = abiertas.map(v => {
        const s = salaDe(v.id);
        if (!s) return '';
        const lista = mensajes[v.id] || [];
        let diaPintado = '';
        const cuerpo = lista.map(m => {
            let html = '';
            const dia = diaDe(m.cuando);
            if (dia && dia !== diaPintado) { diaPintado = dia; html += `<div class="chat-dia">${esc(dia === diaDe(sello()) ? 'Hoy' : dia.split('-').reverse().join('/'))}</div>`; }
            if (m.aviso) return html + `<div class="chat-msg aviso">${esc(nombreDe(m.de))} ${esc(m.texto)}</div>`;
            if (m.borrado) return html + `<div class="chat-msg borrado">mensaje borrado</div>`;
            const mio = m.de === YO.username;
            const de = (!mio && s.tipo === 'grupo') ? `<div class="de">${esc(nombreDe(m.de))}</div>` : '';
            const estado = mio ? (m.sinEnviar ? ' · sin enviar' : '') : '';
            const quitar = YO.username === SUPERUSUARIO
                ? `<button class="quitar" type="button" title="Borrar (solo el administrador)" data-borrar="${esc(m.id)}" data-sala="${esc(s.id)}">×</button>` : '';
            const adj = !m.adjunto ? ''
                : (m.adjunto.tipo === 'imagen'
                    ? `<img class="adj-img" data-adj="${esc(m.adjunto.id)}" data-ver="${esc(m.adjunto.id)}" alt="${esc(m.adjunto.nombre)}">`
                    : `<div class="adj-file" data-bajar="${esc(m.adjunto.id)}" data-nombre="${esc(m.adjunto.nombre)}">
                           <span class="ico">${m.adjunto.tipo === 'video' ? '\u{1F3AC}' : '\u{1F4C4}'}</span>
                           <span class="nom">${esc(m.adjunto.nombre)}</span>
                           <span class="peso">${esc(pesoLegible(m.adjunto.tamano))}</span>
                       </div>`);
            return html + `<div class="chat-msg ${mio ? 'mio' : ''}">${de}${esc(m.texto)}${adj}
                <div class="pie">${esc(horaCorta(m.cuando))}${estado}</div>${quitar}</div>`;
        }).join('');
        const n = sinLeer(s.id);
        return `<section class="chat-ventana ${v.plegada ? 'plegada' : 'abierta'} ${n ? 'con-nuevos' : ''}" data-sala="${esc(s.id)}">
            <header class="vcab" data-plegar="${esc(s.id)}">
                ${s.tipo === 'grupo' ? '' : `<span class="luz ${enLinea((s.miembros || []).filter(u => u !== YO.username)[0]) ? 'si' : ''}" title="${enLinea((s.miembros || []).filter(u => u !== YO.username)[0]) ? 'En línea' : 'Sin conexión'}"></span>`}
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
                    <button type="button" class="clip" data-clip="${esc(s.id)}" title="Mandar una foto o un archivo">📎</button>
                    <input type="text" placeholder="Escribe…" data-escribir="${esc(s.id)}" aria-label="Escribe un mensaje">
                    <button type="button" data-enviar="${esc(s.id)}">Enviar</button>
                </div>
            </div>
        </section>`;
    }).join('');

    if (caja.__ultimoDibujo === html) return;          // nada cambio: no se toca la pantalla

    const act = document.activeElement;
    const escribiendo = (act && act.getAttribute && act.getAttribute('data-escribir'))
        ? { sala: act.getAttribute('data-escribir'), valor: act.value, pos: act.selectionStart }
        : null;
    const aMedias = {};
    caja.querySelectorAll('[data-escribir]').forEach(i => {
        if (i.value) aMedias[i.getAttribute('data-escribir')] = i.value;
    });

    caja.__ultimoDibujo = html;
    caja.innerHTML = html;

    caja.querySelectorAll('[data-escribir]').forEach(i => {
        const id = i.getAttribute('data-escribir');
        if (aMedias[id]) i.value = aMedias[id];
    });
    if (escribiendo) {
        const otra = caja.querySelector(`[data-escribir="${escribiendo.sala}"]`);
        if (otra) {
            otra.value = escribiendo.valor;
            otra.focus();
            try { otra.setSelectionRange(escribiendo.pos, escribiendo.pos); } catch (e) { /* da igual */ }
        }
    }
    abiertas.forEach(v => {
        const c = caja.querySelector(`[data-cuerpo="${v.id}"]`);
        if (c) c.scrollTop = c.scrollHeight;
    });
    pintarAdjuntos();
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

/* Donde van las ventanitas: al costado del panel si esta abierto, pegadas a la burbuja si no.
   Se calcula en cada dibujo y no en cada clic, asi vale para todos los caminos que abren o
   cierran el panel (la burbuja, crear un grupo, cancelarlo). */
const acomodarVentanas = () => {
    const caja = nodo('chat-ventanas');
    if (!caja) return;
    const panelALaVista = panelAbierto || !nodo('chat-grupo').hidden;
    caja.classList.toggle('solas', !panelALaVista);
};

const pintar = () => { pintarLista(); pintarVentanas(); pintarGlobo(); acomodarVentanas(); };

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

/* EL PANEL SE ABRE SIEMPRE LIMPIO: sin lo que se busco la vez pasada y con las ultimas
   conversaciones a la vista. Daniel: "escribo, cierro, vuelvo a abrir y sigue la palabra ahi;
   deberia quedarse en cero y mostrarme los cinco". Va en un solo sitio porque el panel se
   abre por dos caminos -la burbuja y volver de "+ Grupo"- y los dos tienen que limpiar. */
const abrirPanel = () => {
    panelAbierto = true;
    nodo('chat-panel').hidden = false;
    nodo('chat-buscar').value = '';
    pintarLista();
    nodo('chat-buscar').focus();
    acomodarVentanas();
};

const cerrarPanel = () => {
    panelAbierto = false;
    nodo('chat-panel').hidden = true;
    acomodarVentanas();
};

const enganchar = () => {
    nodo('chat-burbuja').addEventListener('click', () => {
        nodo('chat-grupo').hidden = true;
        if (panelAbierto) cerrarPanel();
        else { abrirPanel(); latir(); }
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
        nodo('chat-grupo-gente').innerHTML = activos().filter(p => p.username !== YO.username)
            .map(p => `<label><input type="checkbox" value="${esc(p.username)}"> ${esc(nombreBonito(p.name) || p.username)} · <span style="color:var(--text-dim)">${esc(p.username)} · ${esc(p.role || '')}</span></label>`).join('');
        nodo('chat-grupo').hidden = false;
        acomodarVentanas();
    });
    nodo('chat-grupo-cancelar').addEventListener('click', () => {
        nodo('chat-grupo').hidden = true;
        abrirPanel();
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
        const ver = e.target.closest('[data-ver]');
        if (ver) { verGrande(ver.getAttribute('data-ver')); return; }
        const bajar = e.target.closest('[data-bajar]');
        if (bajar) { bajarAdjunto(bajar.getAttribute('data-bajar'), bajar.getAttribute('data-nombre')); return; }
        const clip = e.target.closest('[data-clip]');
        if (clip) {
            salaDelClip = clip.getAttribute('data-clip');
            const elegidor = nodo('chat-archivo');
            elegidor.value = '';
            elegidor.click();
            return;
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

    /* Pegar una captura con Ctrl+V: es como se manda la mayoria de las fotos de pantalla. */
    ventanas.addEventListener('paste', (e) => {
        const sala = e.target.getAttribute && e.target.getAttribute('data-escribir');
        if (!sala || !e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
        e.preventDefault();
        mandarConAdjunto(sala, e.clipboardData.files[0]);
    });

    /* Arrastrar el archivo encima de la ventanita. */
    const salaDe = (nodo2) => {
        const v = nodo2 && nodo2.closest ? nodo2.closest('.chat-ventana') : null;
        return v ? v.getAttribute('data-sala') : null;
    };
    ventanas.addEventListener('dragover', (e) => {
        if (!salaDe(e.target)) return;
        e.preventDefault();
        const v = e.target.closest('.chat-ventana');
        if (v) v.classList.add('soltando');
    });
    ventanas.addEventListener('dragleave', (e) => {
        const v = e.target.closest && e.target.closest('.chat-ventana');
        if (v) v.classList.remove('soltando');
    });
    ventanas.addEventListener('drop', (e) => {
        const sala = salaDe(e.target);
        if (!sala) return;
        e.preventDefault();
        const v = e.target.closest('.chat-ventana');
        if (v) v.classList.remove('soltando');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            mandarConAdjunto(sala, e.dataTransfer.files[0]);
        }
    });

    nodo('chat-archivo').addEventListener('change', (e) => {
        const archivo = e.target.files && e.target.files[0];
        if (archivo && salaDelClip) mandarConAdjunto(salaDelClip, archivo);
    });

    nodo('chat-visor').addEventListener('click', () => { nodo('chat-visor').hidden = true; });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && raiz && nodo('chat-visor') && !nodo('chat-visor').hidden) nodo('chat-visor').hidden = true;
    });
};

const escribir = async (idSala) => {
    const caja = raiz.querySelector(`[data-escribir="${idSala}"]`);
    if (!caja) return;
    const texto = caja.value;
    caja.value = '';
    caja.focus();                       // el cursor se queda aca, sin esperar al servidor
    await mandar(idSala, texto);
    const otra = raiz.querySelector(`[data-escribir="${idSala}"]`);
    if (otra && document.activeElement !== otra) otra.focus();
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
        /* El directorio guarda a TODOS, tambien a los dados de baja: sus mensajes viejos
           tienen que seguir mostrando su nombre y no su usuario. A quien se le puede escribir
           hoy lo decide `activos()`. */
        gente = (Array.isArray(d) ? d : []).filter(u => u && u.username);
    } catch (e) { gente = []; }

    try { salas = (await traer(SALAS)).filter(esMiSala); } catch (e) { salas = []; }
    try {
        const filas = await traer(LEIDOS);
        const mio = filas.filter(f => f.id === YO.username)[0];
        leidos = (mio && mio.salas) || {};
    } catch (e) { leidos = {}; }

    await sincronizarReloj();
    await mirarQuienEsta();
    ultimaMirada = Date.now();
    anunciarme();
    ultimoAnuncio = Date.now();

    for (const s of salas) { await bajarSala(s.id); reponerContador(s.id); }
    pintar();
    acomodarReloj();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') latir(); });
    console.log(`💬 [CHAT] listo para ${YO.username}: ${salas.length} conversación(es).`);
};

export const desmontarChat = () => {
    anunciarme(true);        // al salir, la bolita se apaga enseguida y no en 70 segundos
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    const est = document.getElementById('chat-estilos');
    if (est && est.parentNode) est.parentNode.removeChild(est);
    raiz = null; arrancado = false; salas = []; mensajes = {}; abiertas = []; panelAbierto = false;
    presencia = {}; ultimoAnuncio = 0; ultimaMirada = 0;
};

/* Para la prueba del navegador: deja a mano lo que hace falta empujar sin tocar la pantalla. */
window.__chat = { latir, mandar, crearDirecta, crearGrupo, borrar, bajarSala, marcasDelServidor,
                  mandarConAdjunto, subirAdjunto, achicarFoto,
                  anunciarme, mirarQuienEsta, enLinea, nombreBonito, sincronizarReloj,
                  estado: () => ({ salas, mensajes, leidos, noLeidos, abiertas, versionesVistas,
                                   sinLeer: sinLeerTotal() }) };
