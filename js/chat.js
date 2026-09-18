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

/* LOS AVISOS DE ESTA PC. Daniel, 15-sep-2026: *"tambien hay que hacer lo mismo para la web,
   para que le lleguen una notificacion"*. El mecanismo es el mismo que usa la app del
   celular; lo unico propio de aca es el boton y el cartelito que explica que va a llegar. */
import { puedeAvisos, mirarAvisos, prenderAvisos, apagarAvisos, queLlega,
         idDeEsteAparato, ponerAlDiaAvisos }
    from './services_v245/avisos.js?v=29.0827';

/* `typeof window` y no `window` a secas: `scratch/probar_marcas_chat.mjs` carga este
   archivo desde Node para comprobar el calculo de las marcas sin navegador, y sin la
   guarda la prueba revienta en esta linea antes de empezar. */
const BASE = (typeof window !== 'undefined' && window.API_BASE_URL)
    || 'https://logistics-backend-wv0x.onrender.com';
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
/* LO QUE LEYERON LOS DEMAS. Hasta hoy solo se guardaba lo mio, que es lo que hace falta para
   el contador. Para las marcas de entregado/leido hace falta el area entera: quien leyo que.
   Es un area chica -una fila por persona- y viaja en la misma bajada. */
let leidosDeTodos = {};     // { usuario: { salas: {idSala:'cuando'}, salasMs: {idSala: ms} } }
let leidosMs = {};          // lo mismo que `leidos`, pero en hora del SERVIDOR
/* LA MARCA QUE NO DEPENDE DE NINGUN RELOJ: el id del ultimo mensaje leido POR ORDEN DE LLEGADA
   al servidor. Ver `adoptarLeidos`. */
let leidosIds = {};         // { idSala: id del ultimo mensaje -en orden de llegada- que se vio }
let llegada = {};           // { idSala: { idMensaje: posicion en la lista del servidor } }
let ultimoLlegado = {};     // { idSala: id del ultimo mensaje que llego, de los que ve esta persona }
let noLeidos = {};          // { idSala: cuantos } — el contador vivo de esta pantalla
let versionesVistas = {};   // { area: marca } para no bajar lo que no cambió
let abiertas = [];          // [{ id, plegada }]
let panelAbierto = false;
let vistaGrupo = false;
let gente = [];             // usuarios de la plataforma
let reloj = null;
let sonando = true;
let avisosEstado = 'mirando';   // mirando | apagados | prendidos | sin-soporte | bloqueados
let avisosAbierto = false;      // el cartelito que explica antes de pedir el permiso
let audio = null;
let toastReloj = null;
let toastSala = null;
let arrancado = false;
let salaDelClip = null;     // a que conversacion va el archivo que se esta eligiendo
/* El panel de integrantes de UN grupo: { sala, buscando, filtro }, o null si esta cerrado. */
let integrantes = null;
let presencia = {};         // { usuario: cuando dijo "sigo aqui", en hora del servidor }
let desfaseReloj = 0;       // ms entre el reloj del servidor y el de esta PC
let ultimoAnuncio = 0;
let ultimaMirada = 0;
/* QUIEN MAS QUIERE ENTERARSE. La app del celular dibuja su propia pantalla, asi que el
   latido le avisa por aca en vez de pintar el cascaron de escritorio. */
let avisarCambio = null;
/* QUE CONVERSACION TIENE LA APP DEL CELULAR EN PANTALLA. Las ventanitas de la web viven en
   `abiertas`; la app dibuja lo suyo y lo dice por aca -ver `conversacionEnPantalla`-. */
let salaDeLaApp = null;
/* La ultima vez que alguien toco, movio el raton o escribio en esta pantalla. */
let ultimaActividad = Date.now();

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

/* ══ AGREGAR Y SACAR GENTE DE UN GRUPO ══════════════════════════════════════════════════
 *
 * Daniel, 16-sep-2026: *"cuando le de al nombre de Slotting, me salgan las personas que estan
 * en el grupo y me de la opcion de agregar mas"*. Lo que decidio:
 *   - CUALQUIERA del grupo agrega y saca, no solo el que lo creo;
 *   - se puede sacar a alguien;
 *   - queda un renglon gris en la conversacion, que no suena;
 *   - el que entra ve solo desde que lo agregaron.
 *
 * SE RELEE LA SALA ANTES DE TOCARLA. Si dos personas agregan a alguien a la vez y cada una sube
 * la sala que tiene en memoria, la segunda borra al que agrego la primera. Releyendo justo
 * antes, cada una agrega sobre lo ultimo. El PATCH del servidor REEMPLAZA la sala con el mismo
 * id y no toca las demas. */
const salaFresca = async (idSala) => {
    try {
        const todas = await traer(SALAS);
        const s = todas.filter(x => x && x.id === idSala)[0];
        if (s) return s;
    } catch (e) { /* se usa la de memoria */ }
    return salaDe(idSala);
};

const reemplazarSala = (sala) => {
    const i = salas.findIndex(x => x.id === sala.id);
    if (i >= 0) salas[i] = sala; else salas.push(sala);
};

const agregarAlGrupo = async (idSala, usuario) => {
    const s = await salaFresca(idSala);
    if (!s || s.tipo !== 'grupo' || !usuario) return false;
    const miembros = (s.miembros || []).slice();
    if (miembros.indexOf(usuario) >= 0) return true;          // ya estaba
    miembros.push(usuario);
    const desde = Object.assign({}, s.desde || {});
    desde[usuario] = sello();                                  // desde ahora ve la conversacion
    const nueva = Object.assign({}, s, { miembros, desde });
    reemplazarSala(nueva);
    await poner(SALAS, nueva);
    await mandar(idSala, 'agregó a ' + nombreDe(usuario), 'silencioso');
    pintar();
    return true;
};

const sacarDelGrupo = async (idSala, usuario) => {
    const s = await salaFresca(idSala);
    if (!s || s.tipo !== 'grupo' || !usuario) return false;
    const miembros = (s.miembros || []).filter(u => u !== usuario);
    if (miembros.length === (s.miembros || []).length) return true;   // ya no estaba
    const desde = Object.assign({}, s.desde || {});
    delete desde[usuario];            // si lo vuelven a agregar, ve desde esa vez
    const nueva = Object.assign({}, s, { miembros, desde });
    reemplazarSala(nueva);
    await poner(SALAS, nueva);
    await mandar(idSala, 'sacó a ' + nombreDe(usuario), 'silencioso');
    pintar();
    return true;
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
    /* 'silencioso': el renglon gris de agregar o sacar a alguien. Queda escrito pero no suena
       ni pone el globo rojo -`sistema` ya lo filtran el latido y el contador-, ni manda aviso
       al celular -`aviso` ya lo filtra el servidor-. "creo el grupo" sigue como estaba. */
    if (esAviso === 'silencioso') msg.sistema = true;
    if (adjunto) msg.adjunto = adjunto;
    mensajes[idSala] = (mensajes[idSala] || []).concat(msg);
    leidos[idSala] = msg.cuando;
    /* Quien escribe vio lo que tenia en pantalla. La marca por orden de llegada va hasta lo
       ultimo que BAJO, no hasta este mensaje: lo que haya entrado recien y todavia no se vea
       sigue sin leer. */
    if (marcaAvanza(idSala, ultimoLlegado[idSala])) leidosIds[idSala] = ultimoLlegado[idSala];
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

/* SE GUARDA DOS VECES LA MISMA MARCA, y hace falta.
 *
 *   `salas`    la hora local de esta PC. Es la de siempre y la que usa el contador.
 *   `salasMs`  la misma marca en HORA DEL SERVIDOR.
 *
 * Las marcas de leido comparan la marca de OTRA persona contra la hora de MI mensaje, y dos
 * relojes distintos no se pueden comparar: una PC dos minutos atrasada dejaria mis mensajes
 * como no leidos para siempre. Es la misma lección de la presencia -ver `ahoraDelServidor`-.
 * `salas` se sigue escribiendo para no romper a quien todavia tenga la version vieja. */
const guardarLeidos = async () => {
    try {
        /* `aparato`: desde cual se leyo. El servidor avisa a los OTROS aparatos de la persona
           para que retiren el aviso de la bandeja; a este no le hace falta. */
        await poner(LEIDOS, { id: YO.username, salas: leidos, salasMs: leidosMs, ids: leidosIds,
                              aparato: idDeEsteAparato() });
        leidosDeTodos[YO.username] = { salas: { ...leidos }, salasMs: { ...leidosMs },
                                       ids: { ...leidosIds } };
    } catch (e) { /* el contador se corrige en la próxima vuelta */ }
};

/* CUANTOS SIN LEER. Se cuenta lo que DE VERDAD llego a esta pantalla, no la posicion de una
   marca dentro de la lista. Es a proposito: los relojes de dos PC nunca estan iguales al
   segundo, y un mensaje que llega con la hora un minuto atrasada caia ANTES de la marca y no
   se contaba nunca. Lo que se guarda en el servidor (`leidos`) es la hora del ultimo leido, y
   sirve para reponer el contador al volver a entrar. */
const sinLeer = (idSala) => noLeidos[idSala] || 0;

const sinLeerTotal = () => salas.reduce((s, x) => s + sinLeer(x.id), 0);

/** ¿`id` va mas adelante, POR ORDEN DE LLEGADA, que la marca de leido de esa sala?
 *
 * Si la marca de aca no esta en la lista bajada, se avanza igual. O se la llevo el robot de
 * archivado -y entonces es anterior a todo-, o la puso otro aparato que ya tenia mensajes que
 * aca todavia no bajaron: en ese caso el servidor se queda con la mas adelantada al guardar
 * -ver `mezclar_leidos`- y la vuelta siguiente la trae de nuevo. Sin avanzar, una conversacion
 * con la marca archivada quedaria trabada para siempre. */
const marcaAvanza = (idSala, id) => {
    if (!id) return false;
    const actual = leidosIds[idSala];
    if (!actual || actual === id) return !actual;
    const pos = llegada[idSala] || {};
    if (pos[actual] === undefined) return true;
    if (pos[id] === undefined) return false;
    return pos[id] > pos[actual];
};

/** Da por leida la sala hasta lo ultimo que bajo. Devuelve true si cambio algo. */
const marcarLeida = (idSala) => {
    const lista = mensajes[idSala] || [];
    const ultimo = lista.slice(-1)[0];
    const habia = noLeidos[idSala] || 0;
    noLeidos[idSala] = 0;
    if (!ultimo) return habia > 0;
    const hasta = String(ultimo.cuando || '');
    const avanzaHora = hasta > String(leidos[idSala] || '');
    const avanzaId = marcaAvanza(idSala, ultimoLlegado[idSala]);
    /* NADA NUEVO QUE MARCAR, NADA QUE ESCRIBIR. Pasa seguido: la conversacion ya estaba leida
       -aca o en el otro aparato- y se vuelve a abrir. Escribir igual hacia viajar la fila
       entera al servidor por nada. */
    if (!avanzaHora && !avanzaId && !habia) return false;
    /* LA MARCA NO RETROCEDE. Si la lista de aca todavia no bajo lo ultimo, lo que tiene es mas
       viejo que lo que ya se leyo en el otro aparato: se queda la marca de alla. El servidor
       hace lo mismo al guardar -ver `mezclar_leidos` en `avisos_chat.py`-. */
    if (avanzaHora) leidos[idSala] = hasta;
    if (avanzaId) leidosIds[idSala] = ultimoLlegado[idSala];
    if (!avanzaHora && !avanzaId) return true;      // solo habia que apagar el contador de aca
    leidosMs[idSala] = ahoraDelServidor();
    guardarLeidos();
    limpiarAvisos();
    return true;
};

/* ══ LO QUE SE LEYO EN OTRO APARATO ═══════════════════════════════════════════════════════
 *
 * Daniel, 17-sep-2026: *"me llega un mensaje a los dos, tanto a la web como al aplicativo, y si
 * lo veo en el móvil ya debería quitar ese aviso en la web, y viceversa... ahorita lo veo en el
 * aplicativo, y en la web me sigue marcando como una conversación que todavía no lo veo"*.
 *
 * LA FILA YA LLEGABA Y NADIE LA USABA. El latido bajaba `chat_leidos` entera -la de todos, para
 * las marcas azules- pero la MIA solo se leia al abrir la pagina. Lo leido en el celular quedaba
 * guardado en el servidor, y la web seguia contando con lo suyo hasta que se recargara.
 *
 * SE COMPARA POR ORDEN DE LLEGADA, NO POR LA HORA. La hora de cada mensaje la pone el reloj de
 * quien lo mando, y en el almacen hay PCs con minutos de diferencia: un mensaje que llega DESPUES
 * puede traer una hora ANTERIOR. Comparando por hora, ese mensaje quedaba como ya leido en los
 * dos aparatos sin que nadie lo viera -ni sonaba-. El servidor guarda cada mensaje al final de la
 * lista, asi que su posicion es el orden real en que llegaron. La marca es el id del ultimo que
 * el otro aparato tenia al leer (`ids`), y lo leido es todo lo que esta hasta esa posicion.
 *
 * SOLO AVANZA. Se toma la marca del servidor unicamente en las salas donde va MAS ADELANTE que la
 * de aca; en las demas no se toca nada. Y el contador nunca SUBE por esto, solo baja: lo que el
 * otro aparato no alcanzo a ver -un mensaje que entro despues- sigue contando aca.
 *
 * Si la marca del servidor es de un mensaje que aca todavia no bajo, se espera: el latido baja
 * esa sala en la misma vuelta -ver `unaVuelta`- y se decide con la lista entera.
 *
 * EL CALCULO VA APARTE Y NO TOCA NADA DE AFUERA, como `calcularEstado`: se prueba sin navegador
 * en `scratch/probar_marcas_chat.mjs`.
 */
export const adoptarLeidos = (o) => {
    const yo = (o && o.yo) || '';
    const fila = (o && o.fila) || {};
    const suyasIds = fila.ids || {};
    const suyas = fila.salas || {};
    const suyasMs = fila.salasMs || {};
    const leidosN = Object.assign({}, (o && o.leidos) || {});
    const leidosMsN = Object.assign({}, (o && o.leidosMs) || {});
    const leidosIdsN = Object.assign({}, (o && o.leidosIds) || {});
    const noLeidosN = Object.assign({}, (o && o.noLeidos) || {});
    const lista = (o && o.mensajes) || {};
    const llegadaDe = (o && o.llegada) || {};
    const cambiaron = [];
    Object.keys(suyasIds).forEach(sala => {
        const suya = String(suyasIds[sala] || '');
        const mia = String(leidosIdsN[sala] || '');
        if (!suya || suya === mia) return;
        const pos = llegadaDe[sala] || {};
        const pSuya = pos[suya];
        if (pSuya === undefined) return;                     // aca todavia no bajo: se espera
        if (mia && pos[mia] !== undefined && pos[mia] >= pSuya) return;   // aca va igual o mas adelante
        leidosIdsN[sala] = suya;
        const hora = String(suyas[sala] || '');
        if (hora > String(leidosN[sala] || '')) {
            leidosN[sala] = hora;
            if (suyasMs[sala] !== undefined) leidosMsN[sala] = suyasMs[sala];
        }
        const quedan = (lista[sala] || []).filter(m => m && m.de !== yo && !m.sistema
            && !(pos[m.id] <= pSuya)).length;
        noLeidosN[sala] = Math.min(noLeidosN[sala] || 0, quedan);
        cambiaron.push(sala);
    });
    return { leidos: leidosN, leidosMs: leidosMsN, leidosIds: leidosIdsN, noLeidos: noLeidosN,
             cambiaron };
};

/** Toma lo que la persona leyo en otro aparato. Devuelve true si algo cambio. */
const adoptarMisLeidos = () => {
    if (!YO) return false;
    const r = adoptarLeidos({ yo: YO.username, fila: leidosDeTodos[YO.username],
                              leidos, leidosMs, leidosIds, noLeidos, mensajes, llegada });
    if (!r.cambiaron.length) return false;
    leidos = r.leidos; leidosMs = r.leidosMs; leidosIds = r.leidosIds; noLeidos = r.noLeidos;
    /* El globito de "mensaje nuevo" de esa conversacion ya no tiene nada que anunciar. */
    if (toastSala && !sinLeer(toastSala)) esconderToast();
    limpiarAvisos();
    return true;
};

/* ══ ¿HAY ALGUIEN MIRANDO? ═══════════════════════════════════════════════════════════════
 *
 * Hasta el 17-sep, una ventanita abierta bastaba para dar por leido todo lo que entraba. Con
 * la PC sola en la oficina, la web marcaba leido cada mensaje apenas llegaba. Mientras cada
 * aparato llevaba su cuenta no se notaba; ahora que lo leido en uno se borra en el otro, eso
 * le apagaba a Daniel el aviso del celular de mensajes que nadie habia visto.
 *
 * SE DA POR VISTO SOLO SI: la pantalla esta a la vista, la ventana del navegador es la que
 * esta en uso, y alguien toco, movio el raton o escribio en los ultimos 2 minutos. Es lo que
 * hace WhatsApp Web: con la ventana en segundo plano el mensaje llega, pero no queda leido
 * hasta que uno vuelve a ella.
 */
const QUIETO_MS = 120000;

const hayAlguienMirando = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
    try { if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false; }
    catch (e) { /* si no se puede saber, vale la vista */ }
    return (Date.now() - ultimaActividad) < QUIETO_MS;
};

/** Las conversaciones que se ven en pantalla: las ventanitas desplegadas de la web, o la que
 *  tenga abierta la app del celular. `abiertas` solo vale con el cascaron de la web: en la app
 *  nadie la dibuja, y una sala que quedara ahi se daria por leida sin que nadie la vea. */
const salasALaVista = () => {
    const ids = raiz ? abiertas.filter(v => !v.plegada).map(v => v.id) : [];
    if (salaDeLaApp) {
        try { const id = salaDeLaApp(); if (id && ids.indexOf(id) < 0) ids.push(id); }
        catch (e) { /* la app no contesto: no hay ninguna */ }
    }
    return ids;
};

/** Marca leido lo que esta en pantalla, si hay alguien mirando. Devuelve true si marco algo. */
const leerLoQueSeVe = () => {
    if (!YO || !hayAlguienMirando()) return false;
    let marco = false;
    /* `marcarLeida` ya sabe si hay algo nuevo: si no lo hay, no escribe nada. */
    salasALaVista().forEach(id => { if (marcarLeida(id)) marco = true; });
    return marco;
};

/* VOLVIO. Tras un rato sin tocar nada, o al volver a la ventana: lo que tiene delante ya lo vio,
   y se pregunta enseguida si hay algo nuevo en vez de esperar a la proxima vuelta. */
const volvioAMirar = () => {
    if (!YO || !hayAlguienMirando()) return;
    if (leerLoQueSeVe()) pintar();
    acomodarReloj();
    latir();
};

const sentirActividad = () => {
    const ahora = Date.now();
    const estabaQuieto = (ahora - ultimaActividad) >= QUIETO_MS;
    ultimaActividad = ahora;
    if (estabaQuieto) volvioAMirar();
};

/* ══ LOS AVISOS DE LA BANDEJA DE ESTE APARATO ═══════════════════════════════════════════════
 *
 * Lo que se lee ACA tambien tiene que salir de la bandeja de ACA: si Daniel abre la app desde el
 * icono -y no tocando el aviso-, el aviso del mensaje se quedaba ahi aunque ya lo haya leido.
 * Los de los OTROS aparatos los retira el servidor -ver `avisar_leido` y `sw.js`-.
 *
 * Se retira un aviso del chat si su mensaje ya esta leido aca, y siempre los "✓ Ya lo viste en
 * otro dispositivo" que hayan quedado. Los avisos de antes de este arreglo no dicen de que
 * mensaje son: esos se retiran si su conversacion no tiene nada sin leer. */
let limpiezaPendiente = null;

const limpiarAvisos = () => {
    if (limpiezaPendiente || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    limpiezaPendiente = setTimeout(() => { limpiezaPendiente = null; cerrarAvisosDeLoLeido(); }, 400);
};

const cerrarAvisosDeLoLeido = async () => {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg || typeof reg.getNotifications !== 'function') return;
        const lista = await reg.getNotifications();
        lista.forEach(n => {
            const tag = String(n.tag || '');
            if (tag.indexOf('chat_') !== 0) return;
            const d = n.data || {};
            if (d.visto) { n.close(); return; }
            const sala = tag.slice('chat_'.length);
            if (!salaDe(sala)) return;
            /* Por ORDEN DE LLEGADA, como todo lo leido: un mensaje que aca todavia no bajo no
               esta leido, y su aviso se queda. */
            const pos = llegada[sala] || {};
            const hasta = posicionLeida(sala);
            const leida = d.msg
                ? (hasta !== undefined && pos[d.msg] !== undefined && pos[d.msg] <= hasta)
                : sinLeer(sala) === 0;
            if (leida) n.close();
        });
    } catch (e) { /* sin avisos en este aparato no hay nada que retirar */ }
};

/* ══ LO ULTIMO QUE SE VIO, GUARDADO EN EL APARATO ═══════════════════════════════════════
 *
 * Daniel, 16-sep-2026: *"le das clic y te manda un chat vacio porque todavia no carga nada, y
 * despues de diez, once, doce segundos recien te abre el chat... ¿no hay alguna posibilidad de
 * que cargue mas rapido, o se quede en memoria algo?"*.
 *
 * Se guarda la ultima foto de las conversaciones EN EL APARATO y se pinta AL INSTANTE, antes
 * de preguntarle nada al servidor. Lo fresco entra un segundo despues y repinta encima. Es lo
 * que hace WhatsApp Web: primero lo que ya sabias, y encima lo nuevo.
 *
 * SOLO LOS ULTIMOS 40 DE CADA SALA: es lo que entra en una pantalla y lo que se mira al abrir.
 * El resto baja igual enseguida. Los adjuntos NO se guardan -viven en su propia area-, asi que
 * esto pesa unas decenas de KB y no un megabyte.
 *
 * LLEVA EL USUARIO EN LA CLAVE: si entra otra persona en la misma PC no ve nada de la anterior.
 */
const MEMORIA_TOPE = 40;
const claveMemoria = () => 'deam_chat_memoria_' + ((YO && YO.username) || '');

const guardarEnElAparato = () => {
    if (!YO) return;
    try {
        const m = {};
        Object.keys(mensajes).forEach(id => {
            m[id] = (mensajes[id] || []).slice(-MEMORIA_TOPE);
        });
        localStorage.setItem(claveMemoria(), JSON.stringify({
            v: 1, salas, mensajes: m, gente, leidos, leidosMs, leidosIds, cuando: Date.now()
        }));
    } catch (e) { /* sin sitio en el disco: se vive sin memoria, solo tarda mas */ }
};

/** Devuelve true si habia algo que pintar. */
const leerDelAparato = () => {
    if (!YO) return false;
    try {
        const c = JSON.parse(localStorage.getItem(claveMemoria()) || 'null');
        if (!c || c.v !== 1 || !Array.isArray(c.salas)) return false;
        salas = c.salas.filter(esMiSala);
        mensajes = c.mensajes || {};
        if (Array.isArray(c.gente) && c.gente.length) gente = c.gente;
        leidos = c.leidos || {};
        leidosMs = c.leidosMs || {};
        leidosIds = c.leidosIds || {};
        salas.forEach(x => reponerContador(x.id));
        return salas.length > 0;
    } catch (e) { return false; }
};

const olvidarElAparato = () => {
    try { localStorage.removeItem(claveMemoria()); } catch (e) { /* da igual */ }
};

const reponerContador = (idSala) => {
    const deOtros = (mensajes[idSala] || []).filter(m => m.de !== YO.username && !m.sistema);
    /* Con la marca por orden de llegada y la lista ya bajada, se cuenta por posicion: no la
       engaña el reloj de nadie -ver `adoptarLeidos`-. */
    const pos = llegada[idSala];
    const marca = leidosIds[idSala];
    if (pos && marca && pos[marca] !== undefined) {
        const p = pos[marca];
        noLeidos[idSala] = deOtros.filter(m => !(pos[m.id] <= p)).length;
        return;
    }
    /* Sin eso -la memoria del aparato antes de bajar, o una marca de la version de antes-, por
       la hora, como siempre. */
    const desde = leidos[idSala] || '';
    noLeidos[idSala] = deOtros.filter(m => String(m.cuando || '') > desde).length;
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
/* DESDE CUANDO VE UNA PERSONA LA CONVERSACION.
 *
 * Daniel, 16-sep-2026, sobre agregar gente a un grupo: *"el que entra va a ver a partir del
 * dia en que se le agrego, la hora que se le agrego hacia adelante; hacia atras ya no puede
 * ver, igual que el WhatsApp"*.
 *
 * La sala guarda `desde: { usuario: 'cuando lo agregaron' }`. Los que estaban al crearla no
 * figuran ahi y ven todo.
 *
 * EL FILTRO VA ACA Y EN NINGUN OTRO SITIO. Todo lo demas -la ventanita, la vista previa de la
 * lista, el contador de no leidos, la memoria del aparato, la app del celular- lee de
 * `mensajes`, asi que filtrando al bajar lo heredan todos sin tocarlos.
 *
 * OJO, Y SE LE DIJO: esto lo esconde de la PANTALLA. Los mensajes siguen guardados juntos en
 * el servidor. Para quien usa la plataforma es invisible; hacerlo imposible de leer incluso
 * sabiendo programar es trabajo del servidor, no de aca. */
const vistoDesde = (idSala) => {
    const s = salaDe(idSala);
    return (s && s.desde && YO && s.desde[YO.username]) || '';
};

const bajarSala = async (idSala) => {
    try {
        let lista = await traer('chat_' + idSala);
        /* EL ORDEN DE LLEGADA SE ANOTA ANTES DE ORDENAR POR HORA. El servidor guarda cada
           mensaje al final de la lista: la posicion es el orden real en que llegaron, y es con
           lo que se decide que esta leido -ver `adoptarLeidos`-. Ordenada por hora, se pierde. */
        const pos = {};
        lista.forEach((m, i) => { if (m && m.id) pos[m.id] = i; });
        const desde = vistoDesde(idSala);
        if (desde) lista = lista.filter(m => String(m.cuando || '') >= desde);
        let ultimo = '';
        lista.forEach(m => { if (m && m.id && (!ultimo || pos[m.id] > pos[ultimo])) ultimo = m.id; });
        lista.sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
        const conocidos = {};
        (mensajes[idSala] || []).forEach(m => { conocidos[m.id] = m; });
        const nuevos = lista.filter(m => !conocidos[m.id]);
        mensajes[idSala] = lista;
        llegada[idSala] = pos;
        ultimoLlegado[idSala] = ultimo;
        return nuevos;
    } catch (e) { return []; }
};

/* HASTA DONDE ESTA LEIDA UNA SALA, POR ORDEN DE LLEGADA: la mas adelantada entre la marca de
   este aparato y la del servidor -que trae lo leido en los otros-. `undefined` si ninguna de
   las dos esta en la lista bajada. */
const posicionLeida = (idSala) => {
    const pos = llegada[idSala] || {};
    const aca = pos[leidosIds[idSala]];
    const alla = pos[(((leidosDeTodos[YO.username] || {}).ids) || {})[idSala]];
    if (aca === undefined) return alla;
    if (alla === undefined) return aca;
    return Math.max(aca, alla);
};

/* La marca del servidor que se fue a buscar, por sala: si no aparece ni bajando la sala -se la
   llevo el robot de archivado-, no se vuelve a bajar en cada vuelta por ella. */
let marcaBuscada = {};

/* LA LISTA DE USUARIOS SE VUELVE A PEDIR SI NO VINO.
 *
 * Daniel, 16-sep-2026, con una captura del panel: *"por que sale con nombre de usuario y no
 * el nombre de la persona"*. Porque esto se pedia UNA SOLA VEZ al abrir el chat, y esa vez
 * habia fallado -el servidor estaba reiniciando-. Sin la lista, `nombreDe()` no tiene con que
 * traducir y cae al usuario: "rlunazco" en vez de "Roberson Lunazco". Y se quedaba asi hasta
 * recargar la pagina entera.
 *
 * NO SE PISA LO QUE YA SE SABE: una respuesta vacia no borra la lista buena. Y vacia no es un
 * estado normal -siempre hay usuarios-, asi que vacia significa que fallo. */
const cargarGente = async () => {
    try {
        const r = await fetch(`${API}/users?t=${Date.now()}`);
        const c = await r.json();
        const d = (c && c.data) || c || [];
        /* El directorio guarda a TODOS, tambien a los dados de baja: sus mensajes viejos
           tienen que seguir mostrando su nombre y no su usuario. A quien se le puede escribir
           hoy lo decide `activos()`. */
        const lista = (Array.isArray(d) ? d : []).filter(u => u && u.username);
        if (lista.length) gente = lista;
        return lista.length > 0;
    } catch (e) { return false; }
};

let ultimoIntentoGente = 0;
const REINTENTO_GENTE = 30000;

/* UNA VUELTA A LA VEZ.
 *
 * El latido lo llaman el reloj, volver a la pestaña, tocar la burbuja, el aviso de "ya lo
 * viste" que manda el ayudante... Dos vueltas encimadas bajaban la misma sala a la vez y las
 * dos contaban el mismo mensaje como nuevo: el contador sumaba dos por uno.
 *
 * Quien pide una vuelta mientras otra esta en camino recibe esa misma, y al terminar se da UNA
 * mas: lo que lo hizo llamar -por ejemplo, que se leyo en el celular- puede haber pasado
 * despues de que la vuelta en camino ya pregunto. El reloj no pide la vuelta extra: si el
 * servidor anda lento, las vueltas no se amontonan. */
let latidoEnCurso = null;
let otraVuelta = false;

const latir = () => {
    if (latidoEnCurso) { otraVuelta = true; return latidoEnCurso; }
    latidoEnCurso = (async () => {
        try {
            do { otraVuelta = false; await unaVuelta(); } while (otraVuelta);
        } finally { latidoEnCurso = null; }
    })();
    return latidoEnCurso;
};

const latirDelReloj = () => { if (!latidoEnCurso) latir(); };

const unaVuelta = async () => {
    /* SE LATE TAMBIEN CON LA PESTANA EN SEGUNDO PLANO. El contador del titulo y el tono son
       justamente para cuando la persona esta mirando otra cosa; si el latido se apagara al
       cambiar de pestana, el mensaje aparecia recien al volver. El navegador espacia solo los
       relojes de las pestanas ocultas, y con eso alcanza. */
    /* "Sigo aqui" y "quien mas esta". Van con su propio reloj y no con el del latido:
       el latido se acelera a 4 s con una ventana abierta, y no hace falta anunciarse
       quince veces por minuto. */
    const ahoraAqui = Date.now();
    /* Sin la lista de usuarios los nombres se ven como usuarios. Se reintenta, pero no en
       cada vuelta: como mucho una vez cada 30 s, y solo si de verdad falta. */
    if (!gente.length && (ahoraAqui - ultimoIntentoGente) > REINTENTO_GENTE) {
        ultimoIntentoGente = ahoraAqui;
        if (await cargarGente()) pintar();
    }
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

    /* QUIEN LEYO QUE. Va por la misma puerta de versiones que todo lo demas: si nadie abrio
       una conversacion desde la ultima vuelta, el area no cambio y no se baja nada. Asi las
       marcas de leido se actualizan solas sin agregar una llamada por latido. */
    if (cambio(LEIDOS)) {
        try {
            const filas = await traer(LEIDOS);
            const nuevo = {};
            filas.forEach(f => { if (f && f.id) nuevo[f.id] = f; });
            leidosDeTodos = nuevo;
        } catch (e) { /* vale lo ultimo que se supo */ }
    }

    let llego = null;
    const aLaVista = salasALaVista();
    const mirando = hayAlguienMirando();
    const marcasDeAlla = ((leidosDeTodos[YO.username] || {}).ids) || {};
    for (const s of salas) {
        const enPantalla = aLaVista.indexOf(s.id) >= 0;
        const cambiada = cambio('chat_' + s.id);
        /* Lo leido en otro aparato llega hasta un mensaje que aca puede no haber bajado todavia:
           se baja la sala en esta misma vuelta, para decidir con la lista entera. */
        const alla = marcasDeAlla[s.id];
        const faltaLaMarca = !!alla && ((llegada[s.id] || {})[alla] === undefined)
            && marcaBuscada[s.id] !== alla;
        if (!cambiada && !enPantalla && !faltaLaMarca) continue;
        if (faltaLaMarca) marcaBuscada[s.id] = alla;
        /* `sistema` es lo que deja el robot de archivado: no suena ni pone globo rojo.
           Corre de madrugada y toca todas las conversaciones; sin esto todo el mundo
           amaneceria con un aviso por conversacion. */
        const bajados = await bajarSala(s.id);
        /* LO QUE YA SE LEYO EN OTRO APARATO no suena, no abre la ventana ni suma al contador:
           la persona ya lo vio. Pasaba con la web atras: el mensaje bajaba recien despues de
           leerlo en el celular, y la PC sonaba por algo ya leido. Por ORDEN DE LLEGADA, no por
           la hora: ver `adoptarLeidos`. */
        const pos = llegada[s.id] || {};
        const leidaHasta = posicionLeida(s.id);
        const nuevos = bajados.filter(m => m.de !== YO.username && !m.sistema
            && !(leidaHasta !== undefined && pos[m.id] <= leidaHasta));
        if (!nuevos.length) continue;
        if (enPantalla && mirando) {
            marcarLeida(s.id);                       // la esta mirando: ya esta leido
        } else {
            /* En pantalla pero SIN NADIE MIRANDO -la PC sola, o la ventana atras- cuenta como
               cualquier otra: suena, suma, y se da por leida cuando alguien vuelva. */
            noLeidos[s.id] = (noLeidos[s.id] || 0) + nuevos.length;
            if (!llego) llego = { sala: s, msg: nuevos[nuevos.length - 1] };
        }
    }
    /* Y DESPUES DE BAJAR, lo leido en el otro aparato: el recuento se hace con la lista fresca. */
    adoptarMisLeidos();
    abrirEnCuantoLlegue();      // la que pidio el aviso, si ya bajo
    guardarEnElAparato();       // que la proxima vez abra con lo ultimo que se vio

    if (llego) {
        /* LA CONVERSACION SE ABRE SOLA, PERO SOLO CON LA WEB A LA VISTA.
         *
         * Daniel, 16-sep-2026: *"cuando yo estoy en la web, si me entra un chat nuevo,
         * necesito que se abra esa conversacion en automatico"*. Cambia lo que el mismo habia
         * pedido el 11-sep -*"la ventana no se abre sola, si estoy procesando tareas una
         * ventana encima estorba"*-, y ese motivo sigue siendo bueno para el OTRO caso: con la
         * pestaña atras no se abre nada, porque volveria a su pantalla con cinco ventanas
         * encima de lo que estaba haciendo. Ahi avisan el globito de la barra y el titulo.
         *
         * `abrirSala` marca la conversacion como leida -la esta mirando-, asi que el contador
         * no sube. Por eso el tono se toca aparte: `avisar` no llega a correr. */
        /* `raiz` tiene que existir: es el cascaron flotante de la WEB. En la app del
           celular no hay ventanitas que abrir, y `abrirSala` marcaria la conversacion
           como LEIDA sin que nadie la haya visto — se perderia el aviso. */
        if (raiz && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            /* `true`: la abre el latido, no la persona. Queda leida solo si hay alguien
               mirando -ver `hayAlguienMirando`-; si no, se abre y espera a que vuelva. */
            await abrirSala(llego.sala.id, true);
            tin();
        } else {
            avisar(llego.sala, llego.msg);
        }
    }
    pintar();
    acomodarReloj();            // el ritmo depende de lo que haya quedado en pantalla
};

let relojCada = 0;

const acomodarReloj = () => {
    if (typeof document === 'undefined') return;
    /* Rapido solo cuando hay algo abierto Y la pestana esta a la vista: si esta oculta, el
       ritmo lento alcanza y no se gasta bateria ni datos.
     *
     * Y TAMBIEN CON ALGO SIN LEER Y ALGUIEN MIRANDO. Si Daniel lo lee en el celular con la PC
     * delante, la PC tiene que apagar el contador en segundos, no en veinte. Con la PC sola
     * vuelve al ritmo lento: nadie esta mirando ese contador. */
    const vivo = document.visibilityState === 'visible'
        && (salasALaVista().length > 0 || panelAbierto || (sinLeerTotal() > 0 && hayAlguienMirando()));
    const cada = vivo ? CADA_VIVO : CADA_LENTO;
    /* Si ya va a ese ritmo no se reinicia: el latido lo llama en cada vuelta, y reiniciarlo
       cada vez correria la siguiente vuelta hacia adelante sin parar. */
    if (reloj && relojCada === cada) return;
    if (reloj) clearInterval(reloj);
    relojCada = cada;
    reloj = setInterval(latirDelReloj, cada);
};

/* ══ ENTREGADO Y LEIDO ════════════════════════════════════════════════════════════════════
 *
 * Daniel, 15-sep-2026: *"al yo escribirle a alguien, que me muestre en el mismo mensaje, en la
 * misma ventanita, si lo leyo o no lo leyo... mensaje entregado, mensaje leido"*. Y al elegir
 * como: *"como WhatsApp, azul cuando todos lo leyeron"*, con *"leido por tres de cinco"* en
 * los grupos.
 *
 * ESTA FUNCION VIVE ACA Y NO EN CADA PANTALLA. La web dibuja burbujas flotantes y la app del
 * celular su propia pantalla, pero el CALCULO es el mismo. Dos copias del mismo calculo se
 * desincronizan, y en este proyecto ya paso.
 *
 * LOS TRES ESTADOS, y de donde sale cada uno:
 *
 *   enviado     se guardo en el servidor. Es lo minimo que se sabe.
 *   entregado   el otro se anuncio DESPUES de mi mensaje -`chat_presencia`-, o sea que su
 *               pantalla ya lo bajo. No es una promesa de que lo vio; es que le llego.
 *   leido       abrio la conversacion -`chat_leidos`-.
 *
 * NO SE INVENTA UN "ENTREGADO" QUE NO SE PUEDA COMPROBAR: si el otro no se ha conectado desde
 * que escribi, se queda en enviado y ya. Un cuadro que miente es peor que uno que no sabe.
 *
 * TODO SE COMPARA EN HORA DEL SERVIDOR. `m.cuando` lo escribio MI reloj, asi que se le suma mi
 * propio desfase para llevarlo a la del servidor; la presencia ya viene en esa hora y los
 * leidos traen `salasMs` justamente para esto. Mezclar dos relojes locales dejaba mensajes
 * como no leidos para siempre en cuanto una PC anduviera atrasada.
 *
 * SOLO PARA MIS MENSAJES. En los del otro la marca no significa nada y no se dibuja.
 */
/* EL CALCULO VA APARTE Y NO TOCA NADA DE AFUERA: se le pasa todo lo que necesita. Asi se
 * puede probar solo, sin navegador y sin servidor, que es la unica forma de comprobar los
 * seis casos sin montar media plataforma. `estadoDelMensaje` es la misma cuenta con el
 * estado de este archivo ya puesto.
 *
 *   yo          quien soy
 *   leidosDe    { usuario: { salas: {sala:'cuando'}, salasMs: {sala: ms} } }
 *   presenciaDe { usuario: ms de su ultimo "sigo aqui" }
 *   desfase     ms entre el reloj del servidor y el de esta pantalla
 */
export const calcularEstado = (sala, m, o) => {
    const yo = (o && o.yo) || '';
    const leidosDe = (o && o.leidosDe) || {};
    const presenciaDe = (o && o.presenciaDe) || {};
    const desfase = (o && o.desfase) || 0;

    if (!sala || !m || !yo || m.de !== yo || m.aviso || m.borrado) return null;
    if (m.sinEnviar) return { estado: 'sinenviar', leyeron: 0, total: 0 };

    const otros = (sala.miembros || []).filter(u => u && u !== yo);
    if (!otros.length) return { estado: 'enviado', leyeron: 0, total: 0 };

    const cuando = new Date(m.cuando).getTime() + desfase;
    let leyeron = 0;
    let entregado = false;
    otros.forEach(u => {
        const f = leidosDe[u] || {};
        const ms = (f.salasMs || {})[sala.id];
        /* SIN salasMs SE CAE AL TEXTO. Es quien todavia no recargo la pagina: su marca vieja
           es la hora de SU reloj, y comparada con la mia puede fallar por minutos. Vale mas una
           marca casi buena que ninguna, y se corrige sola en cuanto recargue. */
        const leyo = (ms !== undefined && !isNaN(cuando))
            ? ms >= cuando
            : String((f.salas || {})[sala.id] || '') >= String(m.cuando || '');
        if (leyo) { leyeron++; entregado = true; return; }
        if ((presenciaDe[u] || 0) >= cuando) entregado = true;
    });

    const total = otros.length;
    /* AZUL SOLO CUANDO LO LEYERON TODOS, como en WhatsApp. Lo eligio Daniel. */
    if (leyeron >= total) return { estado: 'leido', leyeron, total };
    return { estado: entregado ? 'entregado' : 'enviado', leyeron, total };
};

export const estadoDelMensaje = (sala, m) => calcularEstado(sala, m, {
    yo: YO && YO.username, leidosDe: leidosDeTodos,
    presenciaDe: presencia, desfase: desfaseReloj
});

/** El pie de la burbuja: la hora, la marca y -en grupo- cuantos lo leyeron. */
export const marcaDelMensaje = (sala, m) => {
    const v = estadoDelMensaje(sala, m);
    if (!v) return '';
    if (v.estado === 'sinenviar') return ' · sin enviar';
    const dobles = v.estado === 'entregado' || v.estado === 'leido';
    const rotulo = v.estado === 'leido' ? 'Leído'
        : (v.estado === 'entregado' ? 'Entregado' : 'Enviado');
    /* EL CONTEO SOLO EN GRUPO. En una conversacion de dos, "1 de 1" no dice nada. */
    const cuantos = (sala.tipo === 'grupo' && v.total > 1 && v.estado !== 'enviado')
        ? `<span class="cuantos">${v.leyeron} de ${v.total}</span>` : '';
    return `<span class="visto ${v.estado === 'leido' ? 'leido' : ''}" title="${rotulo}">`
        + (dobles ? '✓✓' : '✓') + '</span>' + cuantos;
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
  /* --btn-fill y no --primary: en el tema Negro el acento es BLANCO y la burbuja
     quedaba blanca con el icono blanco adentro. Es la misma regla de los botones. */
  background: var(--btn-fill); border: 1.5px solid rgba(var(--brand-rgb), 0.6);
  box-shadow: 0 0 15px rgba(var(--brand-rgb), 0.35), 0 4px 20px rgba(var(--shadow-rgb), 0.4);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
#chat-burbuja:hover { transform: scale(1.1); }
#chat-burbuja svg { width: 21px; height: 21px; fill: var(--on-primary); }
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
/* EL CARTEL DE LOS AVISOS. Cuelga de la cabecera del panel y empuja la lista hacia abajo:
   asi se lee entero antes de decidir, que es justo lo que se busca. */
#chat-avisos-cartel { padding: 0.7rem 0.8rem; border-bottom: 1px solid rgba(var(--ink-rgb), 0.08);
  font-size: var(--t-xs); color: var(--text-soft); line-height: 1.5; }
#chat-avisos-cartel p { margin: 0 0 0.4rem; }
#chat-avisos-cartel b { color: var(--text-strong); }
#chat-avisos-cartel ul { margin: 0 0 0.6rem; padding-left: 1.1rem; }
#chat-avisos-cartel li { margin-bottom: 0.15rem; }
#chat-avisos-cartel button { border-radius: 8px; padding: 0.4rem 0.8rem; font-size: var(--t-xs);
  font-weight: 700; cursor: pointer; font-family: inherit; }
#chat-avisos-cartel .prender { background: var(--btn-fill); border: 1px solid var(--btn-fill);
  color: var(--on-primary); }
#chat-avisos-cartel .apagar { background: none; border: 1px solid rgba(var(--ink-rgb), 0.15);
  color: var(--text-muted); }
#chat-avisos-cartel .nota { display: block; margin-top: 0.5rem; color: var(--text-dim); }
#chat-panel .cab .icono.prendido { color: var(--success); }
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
  border-radius: 50px; background: var(--btn-fill); color: var(--on-primary); display: grid; place-items: center; }
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
/* LA HORA VA CON --text-muted Y NO CON --text-dim. Medido sobre la burbuja de verdad, el
   gris apagado daba 3,03 a 1 en Indigo y 3,36 en PBI, contra un minimo legible de 4,5 — y
   es texto de 10 px. En la app del celular esto ya se habia subido por el mismo motivo. */
.chat-msg .pie { margin-top: 0.25rem; font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
/* ── LAS MARCAS DE ENTREGADO Y LEIDO ── OJO: NADA DE COMILLAS INVERTIDAS ACA ADENTRO,
   esto vive dentro de una plantilla de texto y una sola la corta. Ya paso al escribir
   este mismo comentario: el CSS entero se leyo como codigo. ──────────────────────────────────────────────────────
   Van pegadas a la hora, como en WhatsApp. El azul del leido NO se pone aca: sale de
   la variable --chat-leido, que cambia por tema. Sobre la burbuja clara un cian vivo da 1,1 de
   contraste -invisible- y sobre la oscura 8,2; es la misma regla del sello de los reportes.
   Medido sobre la burbuja de verdad, que es translucida y aclara lo que tiene debajo:
       indigo 8,20 · negro 9,08 · pbi 5,53 · pbi-classic 6,00   (el minimo legible es 4,5) */
.chat-msg .visto { margin-left: 3px; letter-spacing: -2px; font-weight: 900; }
.chat-msg .visto.leido { color: var(--chat-leido); }
/* El "3 de 5" del grupo: pegado a la marca y mas apagado. El dato es la marca; el numero
   es el detalle de quien quiera mirarlo. */
.chat-msg .cuantos { margin-left: 5px; opacity: .8; letter-spacing: 0; }
.chat-msg.mio { align-self: flex-end; background: rgba(var(--brand-rgb), 0.22); border-color: rgba(var(--brand-rgb), 0.35);
  color: var(--text-strong); }
.chat-msg.mio .pie { text-align: right; color: var(--brand-pale); }
/* EL AVISO ES UNA ETIQUETA, NO UN MENSAJE (Daniel, 16-sep-2026). Ya iba al centro y en
   amarillo, pero con el borde y las esquinas de una burbuja, y parecia un mensaje mas. Queda
   como en la maqueta: pastilla chica, sin borde, redondeada entera. */
.chat-msg.aviso { align-self: center; max-width: 92%; text-align: center; font-size: 10px; font-weight: 700;
  color: var(--warning-soft); background: rgba(var(--warning-soft-rgb), 0.14);
  border: 0; border-radius: 50px; padding: 0.2rem 0.75rem; margin: 0.15rem 0; }
/* --text-muted y no --text-dim: medido, el gris mas apagado daba 3,03 a 1 contra el fondo
   del globo -por debajo de lo que se lee comodo- y encima en italica y chiquito. */
.chat-msg.borrado { font-style: italic; color: var(--text-muted); }
.chat-msg .quitar { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 50%;
  border: 1px solid rgba(var(--danger-rgb), 0.5); background: var(--panel-deep, #0b1120); color: var(--danger-soft);
  font-size: 11px; line-height: 1; cursor: pointer; display: none; place-items: center; }
.chat-msg:hover .quitar { display: grid; }
.chat-ventana .pie { border-top: 1px solid rgba(var(--ink-rgb), 0.07); }
.chat-ventana .caja { display: flex; gap: 0.4rem; padding: 0.55rem 0.6rem; }
.chat-ventana .caja { min-width: 0; }
.chat-ventana .caja input { flex: 1; min-width: 0; background: var(--panel-deep, #0b1120); color: var(--text-main);
  border: 1px solid rgba(var(--ink-rgb), 0.1); border-radius: 8px; padding: 0.45rem 0.6rem; font-size: var(--t-xs); }
/* :not(.clip) porque .caja button le ganaba en peso a la regla del clip y se lo pintaba
   igual que Enviar: dos botones llenos uno al lado del otro, y el clip no es una accion
   principal. */
.chat-ventana .caja button:not(.clip) { background: var(--btn-fill); border: 0; color: var(--on-primary); border-radius: 8px;
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
#chat-grupo .crear { background: var(--btn-fill); border: 1px solid var(--btn-fill); color: var(--on-primary); }
#chat-grupo .cancelar { background: none; border: 1px solid rgba(var(--ink-rgb), 0.15); color: var(--text-muted); }
@media (max-width: 900px) { #chat-ventanas, #chat-ventanas.solas { right: 20px; bottom: 130px; } #chat-panel, #chat-grupo { width: 280px; } }
@media (prefers-reduced-motion: reduce) { #chat-burbuja.late { animation: none; } }
/* == INTEGRANTES DEL GRUPO (16-sep-2026) ==================================================
   Copiado de la maqueta aprobada. El panel sale ENCIMA de la conversacion, dentro de la
   ventanita, y se vuelve con la flecha. NADA DE COMILLAS INVERTIDAS ACA. */
.chat-ventana { position: relative; }
.chat-ventana .vcab .n[data-integrantes] { cursor: pointer; border-radius: 6px; padding: 0 0.2rem; }
.chat-ventana .vcab .n[data-integrantes]:hover { background: rgba(var(--ink-rgb), 0.1); }
.chat-ventana .vcab .n .cuantos { font-size: 9px; font-weight: 600; color: var(--text-muted); }
.gente-panel { position: absolute; inset: 0; z-index: 5; background: var(--panel-solid);
  display: grid; grid-template-rows: auto 1fr auto; grid-template-columns: minmax(0, 1fr);
  overflow: hidden; border-radius: 14px 14px 0 0; }
.gente-panel > * { min-width: 0; }
.gente-cab { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.7rem;
  background: rgba(var(--primary-rgb), 0.28); border-bottom: 1px solid rgba(var(--ink-rgb), 0.08); }
.gente-cab .n { font-size: var(--t-xs); font-weight: 800; color: var(--text-strong); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }
.gente-volver { background: none; border: 0; color: var(--text-pale); cursor: pointer;
  font-size: var(--t-md); line-height: 1; padding: 0.15rem 0.4rem; border-radius: 6px; }
.gente-volver:hover { background: rgba(var(--ink-rgb), 0.12); }
.gente-cuerpo { overflow-y: auto; padding: 0.35rem 0; }
.gente-tit { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
  color: var(--text-dim); padding: 0.4rem 0.8rem; }
.gente-fila { display: flex; align-items: center; gap: 0.55rem; padding: 0.4rem 0.8rem; }
.gente-fila:hover { background: rgba(var(--ink-rgb), 0.04); }
.gente-ini { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center;
  font-size: 10px; font-weight: 800; color: var(--on-primary); background: var(--btn-fill); position: relative; }
.gente-ini.en-linea::after { content: ''; position: absolute; right: -1px; bottom: -1px; width: 9px; height: 9px;
  border-radius: 50%; background: rgba(var(--success-rgb), 1); border: 2px solid var(--panel-solid); }
.gente-txt { min-width: 0; flex: 1; }
.gente-txt b { display: block; font-size: var(--t-xs); font-weight: 700; color: var(--text-strong);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gente-txt span { font-size: 10px; color: var(--text-muted); }
.gente-marca { font-size: 9px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
  color: var(--brand-pale); background: rgba(var(--brand-rgb), 0.18); border-radius: 50px;
  padding: 0.1rem 0.45rem; flex: none; }
.gente-sacar { background: none; border: 1px solid rgba(var(--danger-soft-rgb, 248 113 113), 0.4);
  color: var(--danger-soft); cursor: pointer; font-size: 10px; font-weight: 800;
  padding: 0.2rem 0.5rem; border-radius: 7px; flex: none; }
.gente-sacar:hover { background: rgba(var(--danger-soft-rgb, 248 113 113), 0.15); }
.gente-mas { background: rgba(var(--success-rgb), 0.16); border: 1px solid rgba(var(--success-rgb), 0.4);
  color: var(--success); border-radius: 7px; font-size: 10px; font-weight: 800; cursor: pointer;
  padding: 0.22rem 0.55rem; flex: none; }
.gente-sacar:disabled, .gente-mas:disabled { opacity: 0.5; cursor: wait; }
.gente-buscar { padding: 0.45rem 0.7rem 0; }
.gente-buscar input { width: 100%; box-sizing: border-box; }
.gente-vacio { font-size: 10px; color: var(--text-muted); padding: 0.4rem 0.8rem; }
.gente-pie { padding: 0.55rem 0.7rem; border-top: 1px solid rgba(var(--ink-rgb), 0.07); }
.gente-agregar { width: 100%; border-radius: 9px; padding: 0.5rem; font-size: var(--t-xs); font-weight: 800;
  cursor: pointer; background: var(--btn-fill); color: var(--on-primary); border: 0; }

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
                <button class="icono" id="chat-avisos" type="button" title="Avisos en esta PC">📳</button>
                <button class="icono" id="chat-tono" type="button" title="Tono activado">🔔</button>
                <button class="icono" id="chat-nuevo-grupo" type="button">+ Grupo</button>
            </div>
            <div id="chat-avisos-cartel" hidden></div>
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
    /* EL DIBUJO SE COMPARA ANTES DE TOCAR LA PANTALLA, igual que en `pintarVentanas`.
       Sin esto la lista se rehacia entera en CADA vuelta -mas de una vez por segundo-, y si el
       redibujo caia entre que se aprieta el boton y se suelta, la fila sobre la que se apreto
       ya no existia: el navegador no dispara el clic y la conversacion no abria. Daniel,
       16-sep-2026: *"le doy clic a uno, no abre; le doy clic al otro, no abre"*. */
    const poner = (html) => {
        if (caja.__ultimoDibujo === html) return;      // nada cambio: no se toca la pantalla
        caja.__ultimoDibujo = html;
        caja.innerHTML = html;
    };
    if (!q) {
        const alaVista = ordenadas.filter(s => sinLeer(s.id))
            .concat(ordenadas.filter(s => !sinLeer(s.id)))
            .slice(0, EN_LA_LISTA);
        poner(alaVista.map(filaSala).join('')
            || '<div class="vacio">Todavía no hay conversaciones. Busca a alguien arriba.</div>');
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
    poner(html || '<div class="vacio">Nadie con ese nombre.</div>');
};

/* AL REPINTAR NO SE PIERDE NI EL CURSOR NI LO ESCRITO A MEDIAS.
   Daniel: "cuando envio un mensaje el foco debe volver al chat para seguir escribiendo... tengo
   que darle clic a la caja de texto". Pasaba porque cada refresco -el propio envio, y el latido
   cada 4 segundos- rehacia la ventanita entera: el navegador tira la caja vieja y crea otra, sin
   foco y sin lo que hubiera adentro. Ahora: si el dibujo quedo igual no se toca nada, y si
   cambio se repone el texto de cada caja, el foco y la posicion del cursor. */
/* EL PANEL DE INTEGRANTES, copiado de la maqueta aprobada (16-sep-2026). Sale ENCIMA de la
   conversacion y se vuelve con la flecha. Cualquiera del grupo agrega y saca. */
const filaIntegrante = (s, u) => {
    const yo = YO && u === YO.username;
    const p = gente.filter(x => x.username === u)[0] || {};
    return `<div class="gente-fila">
        <span class="gente-ini ${enLinea(u) ? 'en-linea' : ''}">${esc(iniciales(nombreDe(u)))}</span>
        <span class="gente-txt"><b>${esc(nombreDe(u))}${yo ? ' (tú)' : ''}</b>
            <span>${esc(u)}${p.role ? ' · ' + esc(p.role) : ''}</span></span>
        ${u === s.creador ? '<span class="gente-marca">creó</span>' : ''}
        ${yo ? '' : `<button type="button" class="gente-sacar" data-sacar="${esc(u)}" data-sala-gente="${esc(s.id)}">Sacar</button>`}
    </div>`;
};

/* Los que se pueden agregar: activos y que no esten ya. Va aparte porque el buscador repinta
   SOLO esto: si repintara el panel entero, la caja perderia el foco a cada letra. */
const candidatosHTML = (s) => {
    const q = String((integrantes && integrantes.filtro) || '').trim().toLowerCase();
    const libres = activos().filter(p => (s.miembros || []).indexOf(p.username) < 0
        && (!q || String(p.name || '').toLowerCase().indexOf(q) >= 0
               || p.username.toLowerCase().indexOf(q) >= 0));
    if (!libres.length) return '<div class="gente-vacio">Nadie más con ese nombre.</div>';
    return libres.map(p => `<div class="gente-fila">
        <span class="gente-ini ${enLinea(p.username) ? 'en-linea' : ''}">${esc(iniciales(nombreDe(p.username)))}</span>
        <span class="gente-txt"><b>${esc(nombreDe(p.username))}</b>
            <span>${esc(p.username)}${p.role ? ' · ' + esc(p.role) : ''}</span></span>
        <button type="button" class="gente-mas" data-agregar-a="${esc(p.username)}" data-sala-gente="${esc(s.id)}">Agregar</button>
    </div>`).join('');
};

const panelIntegrantes = (s) => {
    const buscando = !!(integrantes && integrantes.buscando);
    return `<div class="gente-panel">
        <div class="gente-cab">
            <button type="button" class="gente-volver" data-cerrar-integrantes title="Volver a la conversación">←</button>
            <span class="n">${esc(nombreDeSala(s))}</span>
        </div>
        <div class="gente-cuerpo">
            ${buscando ? `<div class="gente-buscar"><input type="text" data-buscar-gente="${esc(s.id)}"
                placeholder="Buscar a cualquier persona…" value="${esc((integrantes && integrantes.filtro) || '')}"></div>` : ''}
            <div class="gente-tit">${(s.miembros || []).length} personas</div>
            ${(s.miembros || []).map(u => filaIntegrante(s, u)).join('')}
            ${buscando ? `<div class="gente-tit">Agregar a</div><div data-candidatos="${esc(s.id)}">${candidatosHTML(s)}</div>` : ''}
        </div>
        <div class="gente-pie">
            <button type="button" class="gente-agregar" data-buscar-toggle="${esc(s.id)}">${buscando ? 'Listo' : '+ Agregar personas'}</button>
        </div>
    </div>`;
};

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
            const estado = mio ? marcaDelMensaje(s, m) : '';
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
                <span class="n" ${s.tipo === 'grupo' ? `data-integrantes="${esc(s.id)}" title="Ver quién está en el grupo"` : ''}>${esc(nombreDeSala(s))}${s.tipo === 'grupo' ? `<span class="cuantos"> · ${(s.miembros || []).length} personas</span>` : ''}</span>
                ${v.plegada && n ? `<span class="cuenta">${n}</span>` : ''}
                <span class="acciones">
                    <button type="button" data-plegar="${esc(s.id)}" title="Plegar">–</button>
                    <button type="button" data-cerrar="${esc(s.id)}" title="Cerrar">×</button>
                </span>
            </header>
            <div class="cuerpo" data-cuerpo="${esc(s.id)}">${cuerpo || '<div class="chat-dia">Sin mensajes</div>'}</div>
            ${integrantes && integrantes.sala === s.id && !v.plegada ? panelIntegrantes(s) : ''}
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

/* ══ EL AVISO DE AFUERA: el icono de la barra y el de la pestaña ═══════════════════════════
 *
 * Daniel, 16-sep-2026, mandando una foto de su barra de tareas: *"si te mandan un mensaje se va
 * acumulando, dice uno, dos, tres, como un circulo al costado del icono... eso deberia ser
 * tambien el chat"*.
 *
 * SON DOS SITIOS DISTINTOS, no uno, y hacen falta los dos:
 *
 *   EL ICONO DE LA BARRA DE TAREAS lo pinta Windows, no la web: `navigator.setAppBadge(n)`.
 *   Es el globito exacto de su captura. Solo sale con la plataforma INSTALADA -la ventana sin
 *   barra de direcciones-; abierta como una pestaña mas de Chrome no hace nada. Por eso no
 *   alcanza sola.
 *
 *   EL ICONO DE LA PESTAÑA se dibuja aca con el numero encima, y ese sirve siempre. Se vuelve
 *   a dibujar en un lienzo -mismo degradado y mismas letras que `favicon.svg`- en vez de cargar
 *   el SVG y pintarle algo arriba: un `drawImage` de otro archivo puede ensuciar el lienzo y
 *   dejar `toDataURL` sin poder leerlo.
 *
 * EL NOMBRE DE LA PESTAÑA PARPADEA SOLO EN SEGUNDO PLANO. Con la web a la vista, un titulo que
 * salta cada segundo cansa y no dice nada que el globo rojo no diga ya.
 *
 * SE RESPETA EL SELLO DE `env.js`. En beta el titulo lleva '🧪 BETA · ' delante y env.js lo
 * REPONE cada segundo si alguien se lo saca. Los dos textos que alternan lo llevan puesto, asi
 * que nunca se pelean: sin esto, en beta el titulo cambiaria de forma en cada tick.
 */
const SELLOS_ENTORNO = ['⚠️ REAL · ', '🧪 BETA · '];
const selloDelTitulo = (t) => {
    const s = String(t || '');
    for (const sello of SELLOS_ENTORNO) if (s.indexOf(sello) === 0) return sello;
    return '';
};

let tituloBase = '';          // el nombre de la pestaña tal cual, con su sello si lo tiene
let faviconOriginal = null;   // { href, tipo } para reponerlo cuando no queda nada sin leer
let parpadeoTitulo = null;
let tituloAlterno = false;

/** El iconito con el globo rojo encima, dibujado. Devuelve un PNG listo para el <link>. */
const iconoConNumero = (n) => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext && c.getContext('2d');
    if (!x) return null;
    const g = x.createLinearGradient(0, 0, 64, 64);
    g.addColorStop(0, '#0ea5e9'); g.addColorStop(1, '#6366f1');
    x.fillStyle = g;
    if (x.roundRect) { x.beginPath(); x.roundRect(0, 0, 64, 64, 13); x.fill(); }
    else x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#ffffff';
    x.font = '800 19px "Segoe UI", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('DEAM', 32, 36);
    /* De 10 para arriba va "9+": tres cifras en los 16 px de una pestaña no se leen. */
    const txt = n > 9 ? '9+' : String(n);
    x.beginPath(); x.arc(46, 18, 18, 0, Math.PI * 2);
    x.fillStyle = '#ef4444'; x.fill();
    x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.stroke();
    x.fillStyle = '#ffffff';
    x.font = '900 ' + (n > 9 ? 20 : 24) + 'px "Segoe UI", system-ui, sans-serif';
    x.fillText(txt, 46, 19);
    return c.toDataURL('image/png');
};

/* EL PNG SE DIBUJA UNA SOLA VEZ POR NUMERO.
 *
 * `toDataURL` es sincrono y caro -crea el lienzo, dibuja y codifica el PNG entero a texto-, y
 * `pintarGlobo` corre en CADA dibujo del chat: mas de una vez por segundo. Haciendolo siempre,
 * el hilo del navegador se queda ocupado y LOS CLICS SE ENCOLAN: Daniel, 16-sep-2026, *"le doy
 * clic a uno, no abre; le doy clic al otro, no abre... y de ahi recien me abre los tres de
 * porrazo"*. Lo mismo vale para `setAppBadge`, que es una llamada al sistema.
 *
 * Con la guarda, un chat quieto no hace NADA en cada vuelta. */
let ultimoPintado = { favicon: -1, badge: -1 };

const pintarFavicon = (n) => {
    if (ultimoPintado.favicon === n) return;
    const l = document.querySelector('link[rel="icon"]');
    if (!l) return;
    ultimoPintado.favicon = n;
    if (faviconOriginal === null) {
        faviconOriginal = { href: l.getAttribute('href') || '', tipo: l.getAttribute('type') || '' };
    }
    if (n <= 0) {
        l.setAttribute('href', faviconOriginal.href);
        if (faviconOriginal.tipo) l.setAttribute('type', faviconOriginal.tipo);
        return;
    }
    const png = iconoConNumero(n);
    if (!png) return;
    l.setAttribute('type', 'image/png');
    l.setAttribute('href', png);
};

/** El globito de la barra de tareas. Sin la web instalada no hace nada, y esta bien asi. */
const pintarBadge = (n) => {
    if (ultimoPintado.badge === n) return;
    try {
        if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
        ultimoPintado.badge = n;
        if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge();
    } catch (e) { /* el navegador no quiso: el numero igual se ve en la pestaña */ }
};

let ultimoTitulo = { n: -1, visible: null };

const pintarTitulo = (n) => {
    const visible = document.visibilityState === 'visible';
    /* SI NO CAMBIO NADA, NO SE TOCA EL RELOJ DEL PARPADEO.
       `pintarGlobo` corre en CADA dibujo, y el chat dibuja mas de una vez por segundo
       -medido: cuatro veces en dos segundos y medio-. Reiniciando el intervalo en cada
       vuelta, el primer tic no llegaba nunca y el nombre de la pestaña se quedaba quieto:
       parecia que el parpadeo no estuviera hecho. Lo cazo la prueba automatica. */
    if (ultimoTitulo.n === n && ultimoTitulo.visible === visible) return;
    ultimoTitulo = { n, visible };
    if (parpadeoTitulo) { clearInterval(parpadeoTitulo); parpadeoTitulo = null; }
    if (!tituloBase) tituloBase = String(document.title || 'DEAM 1830');
    const sello = selloDelTitulo(tituloBase);
    const limpio = tituloBase.slice(sello.length);
    const conNumero = n ? `${sello}(${n}) ${limpio}` : tituloBase;
    document.title = conNumero;
    if (n <= 0 || visible) return;
    const aviso = `${sello}(${n}) ${n === 1 ? 'Mensaje nuevo' : 'Mensajes nuevos'}`;
    tituloAlterno = false;
    parpadeoTitulo = setInterval(() => {
        tituloAlterno = !tituloAlterno;
        document.title = tituloAlterno ? aviso : conNumero;
    }, 1000);
};

const pintarGlobo = () => {
    const n = sinLeerTotal();
    const g = nodo('chat-globo');
    if (g) { g.textContent = n; g.hidden = n === 0; }
    /* Y afuera de la pantalla del chat: la barra de tareas, el iconito de la pestaña y el
       nombre. Van fuera del `if` de la burbuja porque no dependen de ella. */
    pintarTitulo(n);
    pintarFavicon(n);
    pintarBadge(n);
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

/* == LOS AVISOS DE ESTA PC ================================================================
 *
 * EL PERMISO SE PIDE DESPUES DE DECIR QUE VA A LLEGAR. Un "¿permitir notificaciones?" al
 * abrir se contesta que no sin leerlo, y volver atras obliga a entrar a los ajustes del
 * navegador: una sola negativa distraida deja a esa PC sin avisos para siempre. Es la misma
 * decision que ya se tomo en la app del celular.
 */
const pintarAvisos = () => {
    const boton = nodo('chat-avisos');
    const cartel = nodo('chat-avisos-cartel');
    if (!boton || !cartel) return;

    const rotulo = { prendidos: 'Avisos activados en esta PC',
                     bloqueados: 'Avisos bloqueados por el navegador',
                     'sin-soporte': 'Este navegador no puede avisar' };
    boton.textContent = avisosEstado === 'prendidos' ? '📳' : '📴';
    boton.title = rotulo[avisosEstado] || 'Activar los avisos en esta PC';
    boton.classList.toggle('prendido', avisosEstado === 'prendidos');

    cartel.hidden = !avisosAbierto;
    if (!avisosAbierto) return;

    if (avisosEstado === 'sin-soporte') {
        cartel.innerHTML = '<p>Este navegador no sabe mandar avisos. En una PC funciona con '
            + 'Chrome, Edge o Firefox.</p>';
        return;
    }
    if (avisosEstado === 'bloqueados') {
        cartel.innerHTML = '<p><b>El navegador los tiene bloqueados.</b> Toca el candado de la '
            + 'barra de direcciones, busca <b>Notificaciones</b> y ponlo en <b>Permitir</b>. '
            + 'Despu\u00e9s vuelve a entrar aqu\u00ed.</p>';
        return;
    }
    /* CON LOS AVISOS YA PRENDIDOS, SOLO EL BOTON.
     *
     * Daniel, 16-sep-2026, mandando dos capturas del cartel: *"tambien quita todo esto del
     * chat, solo que quede el boton"*. Y tiene razon: el texto y la lista estan para que uno
     * sepa QUE le va a llegar ANTES de darle el permiso al navegador. Una vez dado, ya no
     * deciden nada \u2014 solo ocupan media pantalla del panel cada vez que se abre.
     *
     * APAGADO SE QUEDAN. Ahi si hacen falta: un "\u00bfpermitir notificaciones?" a secas se
     * contesta que no sin leerlo, y volver atras obliga a entrar a los ajustes del navegador.
     * Es la misma decision que ya se habia tomado para la app del celular. */
    if (avisosEstado === 'prendidos') {
        cartel.innerHTML = '<button type="button" class="apagar" id="chat-avisos-apagar">'
            + 'Apagar en esta PC</button>';
        return;
    }
    const lista = queLlega(YO && YO.role).map(x => `<li>${esc(x)}</li>`).join('');
    cartel.innerHTML =
        `<p><b>Que esta PC te avise</b>, aunque el navegador est\u00e9 cerrado:</p>
         <ul>${lista}</ul>
         <button type="button" class="prender" id="chat-avisos-prender">Activar los avisos</button>
         <span class="nota">Tu celular se activa aparte, desde la app.</span>`;
};

const cambiarAvisos = async (prender) => {
    try {
        avisosEstado = prender ? await prenderAvisos(YO) : await apagarAvisos(YO);
    } catch (e) {
        console.warn('[CHAT] avisos:', e && e.message);
        avisosEstado = await mirarAvisos();
    }
    pintarAvisos();
};

const pintar = () => {
    /* SIN CASCARON NO HAY NADA QUE PINTAR, pero el que escucha si tiene que enterarse: es
       el caso del celular, que usa estos datos y dibuja lo suyo. */
    if (avisarCambio) { try { avisarCambio(); } catch (e) { /* que no tumbe el latido */ } }
    if (!raiz) return;

    /* EL CURSOR SE QUEDA DONDE ESTABA. `pintarVentanas` reemplaza el HTML de la ventana, y
       con el la caja de texto: el cursor se quedaba sin sitio y habia que volver a tocarla.
       `escribir()` ya lo devolvia despues de mandar, pero el LATIDO repinta un segundo
       despues y se lo llevaba otra vez — por eso Daniel lo notaba igual. Se arregla aca,
       que es por donde pasan todos los repintados. */
    const a = document.activeElement;
    const escribiendo = a && a.getAttribute && a.getAttribute('data-escribir');
    const cursor = escribiendo ? a.selectionStart : 0;
    const llevaba = escribiendo ? a.value : '';

    pintarLista(); pintarVentanas(); pintarGlobo(); acomodarVentanas(); pintarAvisos();

    if (escribiendo) {
        const otra = raiz.querySelector(`[data-escribir="${escribiendo}"]`);
        if (otra) {
            if (llevaba && !otra.value) otra.value = llevaba;
            otra.focus();
            try { otra.setSelectionRange(cursor, cursor); } catch (e) { /* da igual */ }
        }
    }
};

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

/* LA CONVERSACION QUE PIDIO EL AVISO, mientras la lista no haya llegado.
 *
 * Mismo agujero que en la app del celular (Daniel, 16-sep-2026: *"me lleva al chat, no me
 * lleva a la conversacion"*): al tocar el aviso se pide una sala que TODAVIA NO ESTA en
 * memoria, `salaDe()` no la encuentra y `abrirSala` se rendia en la primera linea.
 * Se guarda y se abre en cuanto la sala aparece, en la siguiente vuelta del latido. */
let salaPendiente = null;

/* LA CONVERSACION PEDIDA SOBREVIVE A LA RECARGA.
 *
 * Al tocar el aviso con la web YA ABIERTA, el destino llega por `postMessage` del service
 * worker: no esta en la direccion, esta en una variable. Si la pagina se recarga justo
 * entonces -y se recarga sola cuando hay version nueva, que es lo que le pasaba a Daniel- esa
 * variable se pierde y se llega al chat sin saber que conversacion abrir.
 *
 * `sessionStorage` aguanta la recarga de la misma pestaña; el hash cubre el otro camino. */
const PEDIDO_GUARDADO = 'deam_chat_pedido';
const recordarPedido = (id) => { try { sessionStorage.setItem(PEDIDO_GUARDADO, String(id || '')); } catch (e) { /* da igual */ } };
const pedidoGuardado = () => { try { return sessionStorage.getItem(PEDIDO_GUARDADO) || ''; } catch (e) { return ''; } };
const olvidarPedido = () => { try { sessionStorage.removeItem(PEDIDO_GUARDADO); } catch (e) { /* da igual */ } };

const abrirEnCuantoLlegue = () => {
    if (!salaPendiente) return;
    if (!salaDe(salaPendiente)) return;
    const id = salaPendiente;
    salaPendiente = null;
    abrirSala(id);
};

/* `sola`: la abre el latido porque llego un mensaje, no la persona. Queda leida solo si hay
   alguien mirando -ver `hayAlguienMirando`-; si no, se abre y espera a que vuelva. */
const abrirSala = async (id, sola = false) => {
    let s = salaDe(id);
    if (!s) {
        /* NO SE ESPERA AL LATIDO.
         *
         * Antes esto dejaba la sala apuntada y se iba, y lo unico que la abria era la
         * siguiente vuelta del latido: 20 segundos con el chat quieto, y **hasta un minuto
         * con la pestaña oculta**, porque el navegador espacia los relojes de las pestañas
         * que no se ven. Daniel, 16-sep-2026: *"el chat esta en blanco mas de un minuto, tuve
         * que cambiar de pestaña y al volver recien se abrio"* — cambiar de pestaña es
         * justamente lo que dispara un latido inmediato.
         *
         * Se pide la lista AHORA MISMO. Es un solo viaje y es el que hace falta. */
        salaPendiente = id;
        recordarPedido(id);             // que aguante una recarga por version nueva
        try { salas = (await traer(SALAS)).filter(esMiSala); } catch (e) { /* queda pendiente */ }
        s = salaDe(id);
        if (!s) return;                 // de verdad no existe todavia: lo reintenta el latido
        salaPendiente = null;
    }
    olvidarPedido();
    const ya = abiertas.filter(v => v.id === id)[0];
    if (ya) ya.plegada = false;
    else {
        abiertas.unshift({ id, plegada: false });
        if (abiertas.length > MAX_VENTANAS) abiertas.pop();
    }
    /* SE DIBUJA PRIMERO Y SE BAJA DESPUES.
       `bajarSala` es una llamada de red; esperandola antes de pintar, la ventana no aparecia
       hasta que el servidor contestara y el clic se sentia muerto. Lo que ya se tiene en
       memoria se muestra en el acto y el resto entra cuando llega. */
    esconderToast();
    pintar();
    acomodarReloj();
    await bajarSala(id);
    if (!sola || hayAlguienMirando()) marcarLeida(id);
    pintar();
    /* `raiz` es null en la app del celular, que usa estos datos y dibuja su propia
       pantalla. Sin la guarda, esto tumbaba el latido entero. */
    const caja = raiz && raiz.querySelector(`[data-escribir="${id}"]`);
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

    nodo('chat-avisos').addEventListener('click', async () => {
        avisosAbierto = !avisosAbierto;
        if (avisosAbierto && avisosEstado === 'mirando') avisosEstado = await mirarAvisos();
        pintarAvisos();
    });

    /* El boton de adentro del cartel se redibuja cada vez, asi que se escucha desde el
       cartel y no desde el boton: uno enganchado al boton se perderia al repintar. */
    nodo('chat-avisos-cartel').addEventListener('click', (e) => {
        if (e.target.id === 'chat-avisos-prender') cambiarAvisos(true);
        if (e.target.id === 'chat-avisos-apagar') cambiarAvisos(false);
    });

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
    ventanas.addEventListener('input', (e) => {
        const caja = e.target.closest && e.target.closest('[data-buscar-gente]');
        if (!caja || !integrantes) return;
        integrantes.filtro = caja.value;
        const s = salaDe(caja.getAttribute('data-buscar-gente'));
        const lista = ventanas.querySelector('[data-candidatos]');
        if (s && lista) lista.innerHTML = candidatosHTML(s);
    });
    ventanas.addEventListener('click', (e) => {
        const cerrar = e.target.closest('[data-cerrar]');
        if (cerrar) {
            abiertas = abiertas.filter(v => v.id !== cerrar.getAttribute('data-cerrar'));
            pintarVentanas(); acomodarReloj(); return;
        }
        /* EL NOMBRE DEL GRUPO VA ANTES QUE PLEGAR: esta dentro de la cabecera, y la cabecera
           entera pliega. Tocar el nombre abre quien esta; tocar el resto sigue plegando. */
        const verGente = e.target.closest('[data-integrantes]');
        if (verGente) {
            const id = verGente.getAttribute('data-integrantes');
            integrantes = (integrantes && integrantes.sala === id) ? null
                        : { sala: id, buscando: false, filtro: '' };
            pintarVentanas(); return;
        }
        if (e.target.closest('[data-cerrar-integrantes]')) { integrantes = null; pintarVentanas(); return; }
        const toggle = e.target.closest('[data-buscar-toggle]');
        if (toggle && integrantes) {
            integrantes.buscando = !integrantes.buscando; integrantes.filtro = '';
            pintarVentanas();
            const caja = ventanas.querySelector('[data-buscar-gente]');
            if (caja) caja.focus();
            return;
        }
        const agregarA = e.target.closest('[data-agregar-a]');
        if (agregarA) {
            agregarA.disabled = true;
            agregarAlGrupo(agregarA.getAttribute('data-sala-gente'), agregarA.getAttribute('data-agregar-a'))
                .catch(() => alert('No se pudo agregar. Revisa la conexión.'))
                .finally(() => pintarVentanas());
            return;
        }
        const sacarA = e.target.closest('[data-sacar]');
        if (sacarA) {
            sacarA.disabled = true;
            sacarDelGrupo(sacarA.getAttribute('data-sala-gente'), sacarA.getAttribute('data-sacar'))
                .catch(() => alert('No se pudo sacar. Revisa la conexión.'))
                .finally(() => pintarVentanas());
            return;
        }
        if (e.target.closest('.gente-panel')) return;      // un clic dentro del panel no pliega nada

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

/* ══════════════════════════════════════════════════════════════════════════════════════
 *  LOS DATOS DEL CHAT, SIN PANTALLA
 *  ──────────────────────────────────────────────────────────────────────────────────────
 *  Trae el directorio, las salas, los leidos y la presencia, y deja el latido andando. NO
 *  dibuja nada: de eso se encarga quien llame — el cascaron flotante en la web, o la
 *  pantalla completa en el celular.
 *
 *  Existe para que el chat del telefono no sea OTRO chat. Las salas, los mensajes y los
 *  leidos son los mismos: leer algo en el celular lo deja leido en la PC.
 * ══════════════════════════════════════════════════════════════════════════════════════ */
export const arrancarDatosDelChat = async (session) => {
    const quienEra = YO && YO.username;
    YO = session && session.username ? session : null;
    if (!YO) return false;
    /* OTRA PERSONA EN LA MISMA PAGINA: lo leido de la anterior no se mezcla con lo suyo. Lo del
       servidor se junta con lo que ya habia en memoria -ver `traerLeidos`-, asi que tiene que
       arrancar vacio. */
    if (quienEra !== YO.username) {
        leidos = {}; leidosMs = {}; leidosIds = {}; llegada = {}; ultimoLlegado = {};
        noLeidos = {}; leidosDeTodos = {}; marcaBuscada = {};
    }
    try { sonando = localStorage.getItem('chat_tono') !== '0'; } catch (e) { /* da igual */ }

    /* PRIMERO LO QUE YA SE SABIA. Se pinta sin pedir nada, asi el chat nunca sale vacio. */
    if (leerDelAparato() && avisarCambio) { try { avisarCambio(); } catch (e) { /* da igual */ } }

    /* Y AHORA TODO A LA VEZ, no uno detras de otro.
       Esto iba en fila india -gente, salas, leidos, reloj, presencia- y cada uno esperaba a
       que el anterior contestara. Son cinco viajes al servidor que no dependen entre si. */
    const traerSalas = traer(SALAS).then(d => { salas = d.filter(esMiSala); }).catch(() => {});
    const traerLeidos = traer(LEIDOS).then(filas => {
        leidosDeTodos = {};
        filas.forEach(f => { if (f && f.id) leidosDeTodos[f.id] = f; });
        const mio = leidosDeTodos[YO.username] || {};
        /* LO DEL SERVIDOR MANDA -trae lo leido en los otros aparatos, ya juntado-, pero lo de
           este aparato que vaya mas adelante no se pierde: si el ultimo guardado fallo, se
           volveria a ver como nuevo algo ya leido. Las horas se comparan aca; el orden de
           llegada, en la primera vuelta del latido, cuando las salas ya bajaron. */
        const deAca = leidos, deAcaMs = leidosMs;
        leidos = Object.assign({}, deAca);
        leidosMs = Object.assign({}, deAcaMs);
        Object.keys(mio.salas || {}).forEach(id => {
            if (String(mio.salas[id] || '') <= String(leidos[id] || '')) return;
            leidos[id] = mio.salas[id];
            if ((mio.salasMs || {})[id] !== undefined) leidosMs[id] = mio.salasMs[id];
        });
        leidosIds = Object.assign({}, leidosIds, mio.ids || {});
    /* SI EL SERVIDOR NO CONTESTA, VALE LO QUE RECORDABA EL APARATO. Antes se borraba todo, y con
       el servidor reiniciando la persona entraba con todas las conversaciones como no leidas. */
    }).catch(() => { leidosDeTodos = {}; });

    await Promise.all([
        cargarGente().catch(() => false),
        traerSalas,
        traerLeidos,
        sincronizarReloj().catch(() => {}),
        mirarQuienEsta().catch(() => {}),
    ]);
    ultimaMirada = Date.now();
    anunciarme();
    ultimoAnuncio = Date.now();

    /* LAS CONVERSACIONES, TODAS A LA VEZ.
       Estaban en un `for` con `await` adentro: siete conversaciones eran siete viajes uno
       detras de otro. Medido por Daniel: "diez, once, doce segundos" hasta que abria.
       Juntas tardan lo que la mas lenta. */
    await Promise.all(salas.map(x =>
        bajarSala(x.id).then(() => reponerContador(x.id)).catch(() => {})));
    guardarEnElAparato();
    acomodarReloj();
    /* Lo que ya estaba leido antes de abrir sale de la bandeja de este aparato. */
    limpiarAvisos();
    /* Que el servidor sepa que este aparato ya entiende el aviso de "ya lo viste". */
    ponerAlDiaAvisos(YO).catch(() => {});
    /* AL TOCAR EL AVISO DE WINDOWS, ABRIR ESA CONVERSACION.
       El `sw.js` avisa con `{tipo:'ir', url:'...#chat=<sala>'}`. Lo escuchaba SOLO la app del
       celular, asi que en la PC el aviso traia la ventana al frente y dejaba a la persona
       donde estuviera. Es el mismo aviso y el mismo problema: va en los dos sitios. */
    try {
        if (navigator.serviceWorker && !window.__chatEscuchaAvisos) {
            window.__chatEscuchaAvisos = true;
            navigator.serviceWorker.addEventListener('message', (ev) => {
                const d = ev && ev.data;
                /* LO LEYO EN OTRO APARATO: el ayudante lo avisa al recibirlo, y el contador se
                   apaga ya, sin esperar la proxima vuelta -con la pestaña atras, el navegador
                   la espacia hasta un minuto-. */
                if (d && d.tipo === 'leido') { latir(); return; }
                /* LA APP DEL CELULAR ATIENDE SU PROPIO "ir" -ver `irDesdeElAviso`-. Si ademas lo
                   atendia esto, la sala quedaba anotada como ventanita abierta en una pantalla
                   que no tiene ventanitas, y se daba por leido todo lo que entraba ahi. */
                if (!d || d.tipo !== 'ir' || !raiz) return;
                const u = String(d.url || '');
                const i = u.indexOf('#chat');
                if (i < 0) return;
                const sala = u.slice(i + '#chat'.length).replace(/^=/, '');
                if (sala) abrirSala(decodeURIComponent(sala));
                else abrirPanel();
            });
        }
    } catch (e) { /* sin service worker, el aviso igual abre la web */ }

    /* Y con la pestaña cerrada, el destino llega por la direccion; si la pagina se recargo
       por la version nueva justo despues de tocar el aviso, por lo guardado antes. */
    try {
        const h = String(location.hash || '');
        const i = h.indexOf('#chat');
        let quiere = '';
        if (i >= 0) quiere = decodeURIComponent(h.slice(i + '#chat'.length).replace(/^=/, ''));
        if (!quiere) quiere = pedidoGuardado();
        /* Solo en la web: la app del celular lee la direccion por su cuenta y abre su pantalla. */
        if (quiere && raiz) setTimeout(() => abrirSala(quiere), 0);
    } catch (e) { /* da igual */ }

    /* `pintarGlobo()` va PRIMERO y aparte del latido: al volver a la pestaña, el nombre tiene
       que dejar de parpadear en el acto y no cuando termine `latir()`, que es una llamada de
       red y puede tardar segundos. */
    document.addEventListener('visibilitychange', () => {
        pintarGlobo();
        if (document.visibilityState !== 'visible') { acomodarReloj(); return; }
        /* Volver a la pestaña o desbloquear el celular lo hace una persona: esta mirando. */
        ultimaActividad = Date.now();
        if (leerLoQueSeVe()) pintar();
        acomodarReloj();
        latir();
    });

    /* ¿HAY ALGUIEN? Se escucha una sola vez por pagina, aunque se cierre y abra sesion. */
    try {
        if (!window.__chatSienteActividad) {
            window.__chatSienteActividad = true;
            ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(ev =>
                window.addEventListener(ev, sentirActividad, { passive: true, capture: true }));
            /* Volver a la ventana del navegador desde otro programa. */
            window.addEventListener('focus', () => { ultimaActividad = Date.now(); volvioAMirar(); });
        }
    } catch (e) { /* sin esto, lo abierto se da por leido cuando se toca o se escribe */ }
    console.log(`💬 [CHAT] datos listos para ${YO.username}: ${salas.length} conversación(es).`);
    return true;
};

/* El chat de ESCRITORIO: los mismos datos, mas su cascaron flotante. */
export const montarChat = async (session) => {
    if (arrancado) return;
    if (!(session && session.username)) return;
    arrancado = true;
    dibujarCascaron();
    if (!(await arrancarDatosDelChat(session))) { arrancado = false; return; }
    pintar();
};

/* ── LO QUE NECESITA QUIEN DIBUJE OTRA PANTALLA ──────────────────────────────────────────
   Se exporta lo que ya existe; no hay funciones nuevas ni reglas nuevas. `alCambiarElChat`
   es el aviso del latido: llega un mensaje, y quien escucha redibuja. */
export const alCambiarElChat = (fn) => { avisarCambio = fn; };
/* LA APP DICE QUE CONVERSACION TIENE EN PANTALLA: una funcion que devuelve su id, o null en la
   lista. Con eso el latido da por leido lo que entra ahi -si hay alguien mirando- y late rapido
   mientras este abierta, igual que una ventanita de la web. */
export const conversacionEnPantalla = (fn) => { salaDeLaApp = typeof fn === 'function' ? fn : null; };
export const estadoDelChat = () => ({
    yo: YO, salas, mensajes, leidos, noLeidos, gente, presencia,
    sinLeerTotal: sinLeerTotal()
});
export { mandar, mandarConAdjunto, borrar, crearDirecta, crearGrupo, bajarSala, latir,
         agregarAlGrupo, sacarDelGrupo,
         marcarLeida, sinLeer, sinLeerTotal, enLinea, nombreDe, nombreBonito, iniciales,
         nombreDeSala, idDirecta, salaDe, activos, horaCorta, diaDe, traerAdjunto,
         pesoLegible, tipoDeArchivo };

export const desmontarChat = () => {
    anunciarme(true);        // al salir, la bolita se apaga enseguida y no en 70 segundos
    /* EL AVISO DE AFUERA SE APAGA ACA. El globito de la barra de tareas y el iconito con el
       numero sobreviven a la pantalla: son del navegador, no del chat. Sin esto, quien cierra
       sesion se queda con un "3" pegado en la barra que ya no lleva a ninguna parte. */
    if (parpadeoTitulo) { clearInterval(parpadeoTitulo); parpadeoTitulo = null; }
    pintarFavicon(0);
    pintarBadge(0);
    if (tituloBase) document.title = tituloBase;
    tituloBase = ''; faviconOriginal = null; ultimoTitulo = { n: -1, visible: null };
    ultimoPintado = { favicon: -1, badge: -1 };
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    const est = document.getElementById('chat-estilos');
    if (est && est.parentNode) est.parentNode.removeChild(est);
    /* `gente` tambien se va: al cerrar sesion no tiene por que quedar en memoria el
       directorio de la empresa, y dejarlo ahi hacia que el chat siguiente arrancara con
       la lista del anterior sin haberla pedido. */
    raiz = null; arrancado = false; salas = []; mensajes = {}; abiertas = []; panelAbierto = false;
    olvidarElAparato();      // el chat guardado es de quien cerro sesion, no del siguiente
    gente = []; ultimoIntentoGente = 0;
    presencia = {}; ultimoAnuncio = 0; ultimaMirada = 0;
};

/* Para la prueba del navegador: deja a mano lo que hace falta empujar sin tocar la pantalla.
   La guarda es para que `probar_marcas_chat.mjs` pueda cargar este archivo desde Node. */
if (typeof window !== 'undefined') window.__chat = { latir, mandar, crearDirecta, crearGrupo, borrar, bajarSala, marcasDelServidor,
                  agregarAlGrupo, sacarDelGrupo,
                  mandarConAdjunto, subirAdjunto, achicarFoto,
                  anunciarme, mirarQuienEsta, enLinea, nombreBonito, sincronizarReloj,
                  /* Para probar el cartel de avisos sin que el navegador conceda el
                     permiso de verdad, que en una prueba automatica no se puede. */
                  fingirEstadoAvisos: (e) => { avisosEstado = e; avisosAbierto = true; pintarAvisos(); },
                  estado: () => ({ salas, mensajes, leidos, noLeidos, abiertas, versionesVistas, gente,
                                   leidosIds, llegada, leidosDeTodos, relojCada,
                                   mirando: hayAlguienMirando(),
                                   sinLeer: sinLeerTotal() }) };
