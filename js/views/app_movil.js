/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  LA APP DEL CELULAR  ·  su propia cara, no la web metida en un telefono
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Daniel lo corrigio dos veces el 15-ago-2026: *"no quiero la web en un telefono, quiero
 *  una app aparte con su propia cara, mas limpia que la web"*. Y el 12-sep, al instalar la
 *  plataforma en su PC y ver la misma web adentro de una ventana: *"NO ENTIENDO, que es
 *  esto? yo quiero un APP para celular"*. Tenia razon: el manifiesto y el ayudante son el
 *  envase; ESTA es la app.
 *
 *  LAS SEIS REGLAS DE LA MAQUETA APROBADA, que no se negocian:
 *    1. UN numero grande por pantalla, no doce.
 *    2. Nada de tablas: filas de dos lineas, lo que importa arriba y el resto en gris.
 *    3. El estado se ve por color y por forma, no solo por texto.
 *    4. FONDO CLARO. La web es azul oscuro y en el almacen va bien, pero un chofer en la
 *       calle a mediodia no ve una pantalla oscura. Por eso la app NO sigue los temas.
 *    5. Botones grandes: se tocan de pie, con una mano y a veces con guantes.
 *    6. Cinco secciones abajo como maximo. Nada de menus dentro de menus.
 *
 *  DOS PERFILES, UN SOLO LOGIN. Oficina -jefe, supervisor, encargado- con cinco secciones,
 *  y transportista con dos. Lo decide el rol que ya tiene la persona en la plataforma.
 *  Por ahora se dibuja el de oficina; el del chofer llega con Despacho unificado.
 *
 *  DE DONDE SALEN LOS NUMEROS. De las MISMAS areas que ya baja la plataforma
 *  (`almacenaje_tasks`, `attendance`, `workers`): no se inventa ningun calculo nuevo ni se
 *  pide nada aparte al servidor.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

import * as adminService from '../services_v245/adminService.js?v=29.0754';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0754';
const BASE_API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics';

import { armarLista, nombreCorto, nombreCompleto, claveDeOrden, iniciales } from '../services_v245/asistencia_comunes.js?v=29.0754';

/* ── LA PALETA DE LA APP ─────────────────────────────────────────────────────────────────
   Es la de la maqueta aprobada y a proposito NO son las variables de los temas: la app va
   clara siempre, tambien cuando la web esta en el tema Negro. */
const CSS = `
#app-movil {
  --am-papel: #EEF2F1; --am-carta: #FFFFFF; --am-linea: #DCE4E2;
  --am-tinta: #131C1F; --am-suave: #4A5D63; --am-tenue: #6C7B80;
  --am-va: #0B5F52;  --am-va-agua: #E0EFEC;
  --am-curso: #B26A00; --am-curso-agua: #F8EEDC;
  --am-tarde: #98302E; --am-tarde-agua: #F7E6E5;
  --am-quieto: #6C7B80; --am-quieto-agua: #ECF0F0;
  --am-ui: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --am-num: "Cascadia Mono", ui-monospace, "SF Mono", Consolas, monospace;

  position: fixed; inset: 0; z-index: 10;
  background: var(--am-papel); color: var(--am-tinta);
  font-family: var(--am-ui); font-size: 14px; line-height: 1.45;
  display: grid; grid-template-rows: auto 1fr auto; grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
}
#app-movil * { box-sizing: border-box; }

#app-movil .am-cab > * { display: block; width: min(100%, 560px); margin-inline: auto; }
#app-movil .am-cab { padding: calc(0.7rem + env(safe-area-inset-top)) 1.1rem 0.8rem;
  background: var(--am-papel); border-bottom: 1px solid var(--am-linea); }
#app-movil .am-cab .sub { font-family: var(--am-num); font-size: 0.7rem; letter-spacing: .04em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-cab .ttl { font-size: 1.12rem; font-weight: 750; letter-spacing: -0.015em; }

/* AUNQUE LA VENTANA SEA ANCHA, LA APP SE QUEDA DEL ANCHO DE UN TELEFONO. Estirada, las
   tres columnas se separaban: el nombre solo a la izquierda y los botones y el motivo
   pegados a la derecha. Es una app de celular; se centra y se queda en su ancho. */
#app-movil .am-cuerpo { overflow-y: auto; -webkit-overflow-scrolling: touch;
  width: min(100%, 560px); margin-inline: auto;
  padding: 0.9rem 0.8rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }

#app-movil .am-tarjeta { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 12px; padding: 0.85rem 0.95rem; display: flex; flex-direction: column; gap: 0.35rem; }
#app-movil .am-grande { font-family: var(--am-num); font-variant-numeric: tabular-nums;
  font-size: 2.5rem; font-weight: 700; line-height: 1; letter-spacing: -0.03em; color: var(--am-va); }
#app-movil .am-rotulo { font-size: 0.7rem; font-family: var(--am-num); letter-spacing: .1em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-barrita { height: 7px; background: #E2EAE8; border-radius: 4px; overflow: hidden; margin-top: .35rem; }
#app-movil .am-barrita > i { display: block; height: 100%; background: var(--am-va); border-radius: 4px; }
#app-movil .am-pie { font-size: .72rem; color: var(--am-tenue); }

#app-movil .am-tres { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.55rem; }
#app-movil .am-tres .am-tarjeta { padding: 0.7rem 0.6rem; gap: 0.15rem; }
#app-movil .am-tres .n { font-family: var(--am-num); font-variant-numeric: tabular-nums;
  font-size: 1.32rem; font-weight: 700; line-height: 1.1; }
#app-movil .am-tres .l { font-size: 0.62rem; color: var(--am-tenue); line-height: 1.25; }

#app-movil .am-seccion { font-family: var(--am-num); font-size: 0.63rem; letter-spacing: .12em;
  text-transform: uppercase; color: var(--am-tenue); font-weight: 700; margin-top: 0.3rem; }

#app-movil .am-fila { background: var(--am-carta); border: 1px solid var(--am-linea); border-radius: 11px;
  padding: 0.7rem 0.85rem; display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
#app-movil .am-fila .cinta { width: 3px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
#app-movil .am-fila .medio { flex: 1; min-width: 0; }
#app-movil .am-fila .t { font-weight: 640; font-size: 0.87rem; letter-spacing: -0.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-fila .d { font-size: 0.72rem; color: var(--am-tenue);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-chapa { font-family: var(--am-num); font-size: 0.58rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; padding: 0.2rem 0.45rem; border-radius: 3px; white-space: nowrap; }
#app-movil .ch-va { background: var(--am-va-agua); color: var(--am-va); }
#app-movil .ch-curso { background: var(--am-curso-agua); color: #8A5200; }
#app-movil .ch-tarde { background: var(--am-tarde-agua); color: var(--am-tarde); }
#app-movil .ch-quieto { background: var(--am-quieto-agua); color: var(--am-quieto); }

#app-movil .am-vacio { text-align: center; color: var(--am-tenue); font-size: .85rem; padding: 1.4rem 0.5rem; }
#app-movil .am-pronto { background: var(--am-carta); border: 1px dashed #C2CFCC; border-radius: 12px;
  padding: 1.6rem 1.1rem; text-align: center; display: flex; flex-direction: column; gap: .5rem; }
#app-movil .am-pronto .ic { font-size: 1.6rem; }
#app-movil .am-pronto .q { font-weight: 700; }
#app-movil .am-pronto .p { font-size: .82rem; color: var(--am-tenue); }

#app-movil .am-salida { background: none; border: 0; color: var(--am-tenue); font-family: var(--am-ui);
  font-size: .78rem; text-decoration: underline; cursor: pointer; padding: .6rem; align-self: center; }

/* ── PASAR LISTA ─────────────────────────────────────────────────────────────────────── */
/* TRES COLUMNAS DE VERDAD, no una fila y otra debajo: quien | asistio o falto | motivo.
   La del motivo existe siempre -vacia en quien asistio- para que quede alineada de arriba
   abajo, que es lo que hace que se lea como columna y no como un remiendo. */
#app-movil .am-persona { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 11px; padding: 0.5rem 0.55rem; display: grid;
  grid-template-columns: minmax(0, 1fr) auto 86px; align-items: center;
  gap: 0.55rem; min-width: 0; transition: border-color .15s ease, background .15s ease; }
#app-movil .am-persona.falto { border-color: #E7BEBC; background: #FDF7F7; }
#app-movil .am-persona .quien { min-width: 0; }
/* display:block en los dos: como span sueltos, el nombre y el DNI salian pegados en la
   misma linea -"Gian AlataDNI 74821779"- y el recorte con puntos suspensivos no aplicaba. */
#app-movil .am-persona .nm { display: block; font-weight: 650; font-size: 0.88rem; letter-spacing: -.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-persona .dni { display: block; font-family: var(--am-num); font-size: 0.64rem;
  color: var(--am-tenue); line-height: 1.3; }
#app-movil .am-persona .marcas { display: flex; gap: 0.25rem; }
#app-movil .am-persona .marcas button { font-family: var(--am-ui); font-size: 0.68rem; font-weight: 700;
  padding: 0.42rem 0.4rem; border-radius: 8px; border: 1.5px solid var(--am-linea);
  background: var(--am-carta); color: var(--am-tenue); cursor: pointer; min-width: 46px; }
#app-movil .am-persona .motivo { min-width: 0; }
#app-movil .am-persona .motivo select { width: 100%; font-family: var(--am-ui); font-size: 0.7rem;
  padding: 0.4rem 0.3rem; border-radius: 8px; border: 1px solid #E7BEBC; background: var(--am-carta);
  color: var(--am-tinta); }
#app-movil .am-persona .motivo .nada { display: block; text-align: center; color: #C6D0CE; font-size: 0.8rem; }
#app-movil .am-persona .marcas button.si-vino { background: var(--am-va); border-color: var(--am-va); color: #fff; }
#app-movil .am-persona .marcas button.si-falto { background: var(--am-tarde); border-color: var(--am-tarde); color: #fff; }
#app-movil .am-persona .marcas button:disabled { opacity: .55; cursor: default; }

/* La cabecera de la lista, con el nombre de cada columna: sin esto, dos botones y un
   desplegable sueltos no se leen como una tabla. */
#app-movil .am-encabezado { display: grid; grid-template-columns: minmax(0, 1fr) auto 86px;
  gap: 0.55rem; padding: 0 0.55rem; font-family: var(--am-num); font-size: 0.58rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--am-tenue); font-weight: 700; }
#app-movil .am-encabezado .c2 { min-width: 96px; text-align: center; }
#app-movil .am-encabezado .c3 { text-align: center; }

/* EL RESUMEN: la cifra manda, el boton acompaña. */
#app-movil .am-resumen { display: grid; grid-template-columns: minmax(0, 1fr) auto;
  align-items: center; gap: 0.15rem 0.7rem; }
#app-movil .am-resumen .am-rotulo,
#app-movil .am-resumen .am-grande,
#app-movil .am-resumen .am-pie { grid-column: 1; }
#app-movil .am-resumen .acciones { grid-column: 2; grid-row: 1 / span 3;
  display: flex; align-items: center; gap: 0.4rem; }
#app-movil .am-chico { font-family: var(--am-ui); font-size: 0.82rem; font-weight: 680;
  padding: 0.5rem 0.85rem; border-radius: 9px; border: 1px solid var(--am-va);
  background: var(--am-carta); color: var(--am-va); cursor: pointer; white-space: nowrap; }
#app-movil .am-chico:disabled { border-color: var(--am-linea); color: var(--am-tenue); cursor: default; }
/* Los dos iconos miden lo mismo y se ven: antes la camara quedaba mas chica que el
   refrescar y Daniel la veia perdida. */
#app-movil .am-chico.solo-icono { width: 44px; height: 40px; padding: 0; display: grid;
  place-items: center; border-color: var(--am-linea); color: var(--am-suave); font-size: 1.25rem;
  line-height: 1; }
#app-movil .am-nota { font-size: .72rem; color: var(--am-tenue); text-align: center; margin: 0; padding: 0 .6rem; }
#app-movil .am-cerrada { background: var(--am-va-agua); border: 1px solid var(--am-va);
  color: var(--am-va); border-radius: 11px; padding: 0.85rem; text-align: center; font-weight: 700; }

#app-movil .am-boton { display: block; width: 100%; padding: 0.95rem; border-radius: 11px;
  border: 1px solid var(--am-va); background: var(--am-va); color: #fff; font-family: var(--am-ui);
  font-size: 0.98rem; font-weight: 700; cursor: pointer; }
#app-movil .am-boton:disabled { background: #C9D4D2; border-color: #C9D4D2; color: #55666B; cursor: default; }
#app-movil .am-boton.fino { background: none; color: var(--am-va); font-size: .86rem; padding: .7rem;
  border-style: dashed; }

#app-movil .am-barra { display: flex; background: var(--am-carta); border-top: 1px solid var(--am-linea);
  padding: 0.4rem 0.25rem calc(0.55rem + env(safe-area-inset-bottom));
  width: min(100%, 560px); margin-inline: auto; }
#app-movil .am-barra button { flex: 1; min-width: 0; background: none; border: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0.25rem 0.1rem;
  font-family: var(--am-ui); font-size: 0.58rem; font-weight: 650; color: #8B9B9F; position: relative; }
#app-movil .am-barra button .gl { width: 22px; height: 22px; display: block; }
#app-movil .am-barra button .gl svg { width: 100%; height: 100%; display: block; }
#app-movil .am-barra button[aria-selected="true"] { color: var(--am-va); }
#app-movil .am-barra .punto { position: absolute; top: 2px; right: 50%; margin-right: -14px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--am-tarde); }
`;

const ICONOS = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9.2 21v-6.4h5.6V21"/></svg>',
    reportes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M9.3 20V4.5"/><path d="M14.7 20v-7.5"/><path d="M20 20V7"/></svg>',
    tareas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.4 12.2l2.4 2.4 4.8-5"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.6 20c0-3.2 2.4-5.2 5.4-5.2s5.4 2 5.4 5.2"/><path d="M17 11.5l1.7 1.7 3.1-3.3"/></svg>',
    avisos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.8a6 6 0 1 0-12 0c0 5.4-2 7-2 7h16s-2-1.6-2-7"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>'
};

/* El icono de compartir de siempre -tres puntos unidos-, dibujado y no puesto como emoji:
   asi se ve igual en todos los telefonos y a tono con los de la barra de abajo. Daniel:
   "ya no tiene sentido el icono de la camara, deberia estar un icono de compartir". */
const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block"><circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M8.3 10.8 15.7 6.8"/><path d="M8.3 13.2l7.4 4"/></svg>';

/* LA LLAVE PUBLICA DE LOS AVISOS. Es publica a proposito: identifica al servidor que manda
   y no sirve para mandar nada. La privada vive SOLO en el servidor del almacen, como
   variable de maquina (`VAPID_PRIVADA`), nunca en el repositorio. */
const LLAVE_AVISOS = 'BE2dQmsJ0AvtY2ZSq9C3CqEvfv9zRkpyuJCz40uiUxkbemrIWHrF4JAopR0z4ZYw28zRpe-HW0goOTh1yIxbGQk';
const AREA_AVISOS = 'push_suscripciones';

const SECCIONES = [
    { id: 'inicio', rotulo: 'Inicio', icono: 'inicio' },
    { id: 'reportes', rotulo: 'Reportes', icono: 'reportes' },
    { id: 'tareas', rotulo: 'Tareas', icono: 'tareas' },
    { id: 'lista', rotulo: 'Asistencia', icono: 'lista' },
    { id: 'avisos', rotulo: 'Avisos', icono: 'avisos' }
];

/* Lo que todavia no tiene pantalla. Se dice lo que va a haber, con nombre y todo: una
   seccion en blanco parece rota; una que avisa que esta en camino, no. */
const EN_CAMINO = {
    reportes: ['Los siete reportes en pantalla chica', 'Turno, picking por hora, KPI, marcas, SKU sin salida y rotación. Los números ya se calculan bien: falta rearmarlos para el celular.'],
    tareas: ['Asignar una tarea desde el celular', 'Ver las abiertas, elegir al operario y asignársela. La asignación ya funciona en la web y se sincroniza tarea por tarea.'],
    lista: ['Pasar lista del turno', 'Marcar P, T o F por cada persona con el pulgar. Se guarda en el mismo sitio que la lista de la web.'],
    avisos: ['Los avisos', 'Robot caído, tarea vencida, ruta demorada. Es lo único que empieza de cero: hace falta el envío desde el servidor y el permiso del teléfono.']
};

let raiz = null;
let seccion = 'inicio';
let YO = null;
let alSalir = null;
let reloj = null;

const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const numero = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La fecha del turno, escrita como la lee Daniel: "vie 12 sep". */
const diaEnLetras = () => {
    const f = jornadaService.fechaLogicaDe();          // nunca toISOString: es la fecha del turno
    const [a, m, d] = String(f).split('-').map(Number);
    const fecha = new Date(a, m - 1, d);
    return `${DIAS[fecha.getDay()].slice(0, 3)} ${d} ${MESES[m - 1]}`;
};

const saludo = () => {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

/* ── LOS NUMEROS DEL TURNO ───────────────────────────────────────────────────────────────
   Salen de las mismas areas que ya baja la plataforma. Nada nuevo que pedirle al servidor. */
const datosDelTurno = () => {
    const hoy = jornadaService.fechaLogicaDe();
    const tareas = (adminService.getAlmacenajeTasks() || []).filter(t => t && String(t.fecha) === String(hoy));

    const estado = (t) => String(t.status || t.estado || '').toLowerCase();
    const finalizadas = tareas.filter(t => estado(t).indexOf('finaliz') === 0).length;
    const vencidas = tareas.filter(t => estado(t).indexOf('vencid') === 0);
    const sinAsignar = tareas.filter(t => estado(t).indexOf('creada') === 0);
    const enCurso = tareas.filter(t => estado(t).indexOf('asignad') === 0);
    const abiertas = sinAsignar.length + enCurso.length;

    const lista = adminService.getAttendance(hoy);
    const marcados = Array.isArray(lista) ? lista.filter(x => x && (x.estado || x.status)).length : 0;
    const deTurno = Array.isArray(lista) ? lista.length : 0;

    return { tareas, finalizadas, vencidas, sinAsignar, enCurso, abiertas, marcados, deTurno };
};

const fila = (cinta, titulo, detalle, chapa) => `
    <div class="am-fila">
        <span class="cinta" style="background:${cinta}"></span>
        <span class="medio"><span class="t">${esc(titulo)}</span><span class="d">${esc(detalle)}</span></span>
        ${chapa ? `<span class="am-chapa ${chapa[1]}">${esc(chapa[0])}</span>` : ''}
    </div>`;

const pantallaInicio = () => {
    const d = datosDelTurno();
    const total = d.tareas.length;
    const pct = total ? Math.round((d.finalizadas / total) * 100) : 0;

    /* LO QUE NECESITA ATENCION, y en ese orden: primero lo vencido, que es lo que come
       stock, y despues lo que espera operario. */
    const atencion = []
        .concat(d.vencidas.slice(0, 4).map(t => fila('#98302E',
            `${t.id || 'Tarea'} · ${t.zona || t.destino || 'sin zona'}`,
            `${numero(t.cuerpos || t.cantidad || 0)} cuerpos · no se trabajó`, ['Vencida', 'ch-tarde'])))
        .concat(d.sinAsignar.slice(0, 4).map(t => fila('#B26A00',
            `${t.id || 'Tarea'} · ${t.zona || t.destino || 'sin zona'}`,
            `${numero(t.cuerpos || t.cantidad || 0)} cuerpos · espera operario`, ['Abierta', 'ch-curso'])));

    return `
        <div class="am-tarjeta">
            <span class="am-rotulo">Tareas cerradas del turno</span>
            <span class="am-grande">${pct}<span style="font-size:1.3rem">%</span></span>
            <div class="am-barrita"><i style="width:${pct}%"></i></div>
            <span class="am-pie">${numero(d.finalizadas)} de ${numero(total)} tareas${total ? '' : ' · todavía no se creó ninguna'}</span>
        </div>

        <div class="am-tres">
            <div class="am-tarjeta"><span class="n" style="color:#B26A00">${numero(d.abiertas)}</span><span class="l">Tareas abiertas</span></div>
            <div class="am-tarjeta"><span class="n" style="color:#0B5F52">${numero(d.marcados)}<span style="font-size:.8rem;color:#8B9B9F">/${numero(d.deTurno)}</span></span><span class="l">Asistencia</span></div>
            <div class="am-tarjeta"><span class="n" style="color:${d.vencidas.length ? '#98302E' : '#0B5F52'}">${numero(d.vencidas.length)}</span><span class="l">Vencidas</span></div>
        </div>

        <div class="am-seccion">Necesita tu atención</div>
        ${atencion.length ? atencion.join('') : '<div class="am-vacio">Nada pendiente ahora mismo.</div>'}

        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const pantallaEnCamino = (id) => {
    const [que, detalle] = EN_CAMINO[id] || ['En camino', ''];
    return `
        <div class="am-pronto">
            <span class="ic">🚧</span>
            <span class="q">${esc(que)}</span>
            <span class="p">${esc(detalle)}</span>
        </div>
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

/* ── PASAR LISTA ─────────────────────────────────────────────────────────────────────────
   Todos arrancan presentes y se toca SOLO a quien falto. La puntualidad y la justificacion
   se afinan en la web: aca va lo que se necesita de pie y con una mano. */
/* LAS MISMAS CUATRO DE LA WEB, con el mismo valor guardado: si aca dijera "Descanso medico"
   sin tilde, el mismo dia quedarian dos motivos distintos para lo mismo. */
const JUSTIFICACIONES = [
    ['', '— sin motivo —'],
    ['Descanso Médico', 'Descanso médico'],
    ['Vacaciones', 'Vacaciones'],
    ['Cumpleaños', 'Cumpleaños'],
    ['Otros', 'Otros']
];

let listaTocada = false;     // se marco algo y todavia no se guardo: no se pisa con lo del servidor
let listaLocal = null;       // la lista de hoy, mientras se edita
let listaCerrada = false;    // ya la cerraron: se ve, no se toca
let listaGuardando = false;

const fechaDeLaLista = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

const cargarLista = () => {
    const guardado = adminService.getAttendance(fechaDeLaLista());
    listaCerrada = !!(guardado && guardado.finalized);
    listaLocal = armarLista(adminService.getWorkers() || [], guardado);
    listaTocada = false;
};

const pantallaLista = () => {
    if (!listaLocal) cargarLista();
    const total = listaLocal.length;
    const faltaron = listaLocal.filter(p => p.present === false).length;
    const vinieron = total - faltaron;

    if (!total) {
        return `<div class="am-vacio">No hay gente del turno noche cargada para pasar lista.</div>
                <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>`;
    }

    const gente = listaLocal.map(p => {
        const falto = p.present === false;
        const bloq = listaCerrada ? 'disabled' : '';
        /* El motivo SOLO se puede elegir en quien falto, pero la columna esta siempre: en
           quien asistio va una raya, para que las tres columnas queden alineadas. */
        const motivo = falto
            ? `<select ${bloq} data-justif="${esc(p.dni)}" aria-label="Motivo de la falta">
                   ${JUSTIFICACIONES.map(([valor, rotulo]) =>
                       `<option value="${esc(valor)}" ${String(p.justification || '') === valor ? 'selected' : ''}>${esc(rotulo)}</option>`).join('')}
               </select>`
            : '<span class="nada">–</span>';
        return `
        <div class="am-persona ${falto ? 'falto' : ''}">
            <span class="quien"><span class="nm">${esc(nombreCorto(p))}</span><span class="dni">DNI ${esc(p.dni)}</span></span>
            <span class="marcas">
                <button type="button" ${bloq} class="${falto ? '' : 'si-vino'}" data-vino="${esc(p.dni)}">Asistió</button>
                <button type="button" ${bloq} class="${falto ? 'si-falto' : ''}" data-falto="${esc(p.dni)}">Faltó</button>
            </span>
            <span class="motivo">${motivo}</span>
        </div>`;
    }).join('');

    return `
        <div class="am-tarjeta am-resumen">
            <span class="am-rotulo">Asistieron</span>
            <span class="am-grande">${numero(vinieron)}<span style="font-size:1.3rem;color:#8B9B9F">/${numero(total)}</span></span>
            <span class="am-pie">${faltaron ? `${numero(faltaron)} ${faltaron === 1 ? 'falta' : 'faltas'}` : 'nadie faltó'}${listaCerrada ? ' · lista cerrada' : ' · toca solo a quien faltó'}</span>
            <span class="acciones">
                <button type="button" class="am-chico solo-icono" data-foto title="Compartir la lista con Recursos Humanos">${ICONO_COMPARTIR}</button>
                ${listaCerrada ? '' : `
                <button type="button" class="am-chico" data-guardar ${listaGuardando ? 'disabled' : ''}>${listaGuardando ? 'Guardando…' : 'Guardar'}</button>`}
            </span>
        </div>

        ${listaCerrada
            ? `<div class="am-cerrada">✅ Asistencia cerrada</div>
               ${esElAdministrador() ? '<button type="button" class="am-boton fino" data-reabrir>Reabrir la lista</button>' : ''}`
            : ''}

        <div class="am-seccion">${listaCerrada ? 'Lista cerrada del turno' : 'Turno noche'}</div>
        <div class="am-encabezado"><span>Persona</span><span class="c2">Asistió / Faltó</span><span class="c3">Motivo</span></div>
        ${gente}

        ${listaCerrada ? '' : '<p class="am-nota">Al guardar, la lista queda cerrada y pasa al historial. Solo el administrador puede reabrirla.</p>'}
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const esElAdministrador = () => String((YO && YO.username) || '') === 'dames';

const marcar = (dni, vino) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (!p) return;
    p.present = !!vino;
    listaTocada = true;
    if (!vino) p.onTime = false;      // quien no vino no puede haber llegado a tiempo
    if (vino) p.justification = '';   // si al final vino, el motivo que se puso ya no aplica
    pintar();
};

const anotarMotivo = (dni, motivo) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (p) { p.justification = motivo || ''; listaTocada = true; }
    /* NO se repinta: se perderia el desplegable recien abierto y el sitio de la lista. */
};

/* SIN BOTON DE REFRESCAR: la lista se trae sola al entrar a la seccion. Daniel lo pidio y
   tiene razon, pero ojo con el por que: la app NO se refresca cada 20 segundos -eso es el
   radar de la web-. Aca las demas pantallas se rehacen cada minuto y LA LISTA NO SE TOCA
   sola a proposito, porque estaria pisando lo que se acaba de marcar. Por eso el traido va
   al entrar, y solo se aplica si todavia no se marco nada. */
const refrescarLista = async () => {
    try { await adminService.initializeAdminData(true); } catch (e) { console.warn('[APP] traer la lista:', e && e.message); }
    if (listaTocada) return;          // se empezo a marcar mientras llegaba: no se pisa
    cargarLista();
    if (seccion === 'lista') pintar();
};

const reabrirLista = async () => {
    if (!esElAdministrador()) return;
    if (!confirm('¿Reabrir la lista del turno? Se va a poder editar de nuevo.')) return;
    try { await adminService.reopenAttendance(fechaDeLaLista()); } catch (e) { alert('No se pudo reabrir.'); return; }
    cargarLista();
    pintar();
};

/* GUARDAR ES GUARDAR Y CERRAR. Daniel, 12-sep: *"al guardar deberias bloquear... y el unico
   que puede desbloquear soy yo, como dames"*. Cerrar no es un detalle: es lo que manda la
   lista al historial de performance con su puntaje, asi que se pregunta antes. */
const guardarLista = async (cerrando) => {
    if (!listaLocal || listaGuardando) return;
    if (cerrando && !confirm('Al guardar, la lista queda CERRADA y pasa al historial.\n\n¿Guardar y cerrar?')) return;
    listaGuardando = true;
    pintar();
    try {
        await adminService.saveAttendance(fechaDeLaLista(), { data: listaLocal, finalized: !!cerrando });
        if (cerrando) listaCerrada = true;
    } catch (e) {
        console.warn('[APP] no se pudo guardar la lista:', e && e.message);
        alert('No se pudo guardar la lista. Vuelve a intentar.');
    }
    listaGuardando = false;
    pintar();
};

/* ── LA FOTO PARA RECURSOS HUMANOS ─────────────────────────────────────────────────────── */

const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                   'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fechaLarga = (iso) => {
    const [a, m, d] = String(iso).split('-').map(Number);
    const f = new Date(a, m - 1, d);
    return `${DIAS[f.getDay()]} ${d} de ${MES_LARGO[m - 1]} de ${a}`;
};

/* LA SEMANA QUE SE MUESTRA: de lunes a domingo, la del dia de hoy. Es la misma ventana que
   usa el cuadro de la web, para que los dos digan lo mismo. */
const semanaDeHoy = () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const dias = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        dias.push(d);
    }
    return dias;
};

const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** El numero de semana, contado por su jueves, igual que en la web. */
const numeroDeSemana = (lunes) => {
    const jue = new Date(lunes); jue.setDate(lunes.getDate() + 3);
    const eneUno = new Date(jue.getFullYear(), 0, 1);
    return Math.ceil(((jue - eneUno) / 86400000 + 1) / 7);
};

/** La inicial del motivo, la misma de la web: en una foto no hay cursor que pasar, asi que
 *  la celda tiene que decir POR QUE sola. */
const letraDelMotivo = (obs) => {
    const t = String(obs || '').trim().toUpperCase();
    if (t.indexOf('VAC') === 0) return 'V';
    if (t.indexOf('DESC') === 0) return 'M';
    if (t.indexOf('CUMPLE') === 0) return 'C';
    if (t.indexOf('OTRO') === 0) return 'O';
    return '!';
};

/* EL CARGO Y EL SEXO SALEN DEL MAESTRO DE TRABAJADORES, cruzados por DNI. El sexo NO se
   deduce del nombre: seria inventar un dato sobre una persona de verdad; quien no este
   marcado no suma a ninguno de los dos. */
const ABREVIA = { 'AYUDANTE DE ALMACEN': 'A. ALMACEN', 'MONTACARGUISTA': 'MONTACARG.',
                  'OPERADOR DE SISTEMA': 'OP. SISTEMA', 'RECEPCION': 'RECEPCIÓN' };

const fichaMaestro = (dni) => {
    const w = (adminService.getWorkers() || []).filter(x =>
        String(x.dni || x.Dni || '').trim() === String(dni).trim())[0];
    if (!w) return { cargo: '', sexo: '' };
    const cargo = String(w.puesto || w.Puesto || '').trim().toUpperCase();
    return { cargo: ABREVIA[cargo] || cargo, sexo: String(w.sexo || w.Sexo || '').trim().toUpperCase() };
};

/* SOLO LOS DIAS GUARDADOS. Daniel, 12-sep: *"solo debe mostrar asistencia los dias
   guardados o asistencia cerrada; esta mostrando el sabado cuando ni siquiera he tomado
   asistencia"*. Una foto que se manda a Recursos Humanos no puede decir que la gente
   asistio cuando todavia no se paso lista. Una lista sin cerrar es como si no estuviera,
   igual que en el cuadro de la web. */
const marcasDeLaSemana = (dias) => {
    const por = {};
    const cerrados = [];
    dias.forEach(d => {
        const k = claveDia(d);
        const reg = adminService.getAttendance(k);
        if (!reg || !Array.isArray(reg.data) || reg.finalized !== true) return;
        cerrados.push(k);
        reg.data.forEach(p => {
            const dni = String(p.dni || '').trim();
            if (!dni) return;
            if (!por[dni]) por[dni] = {};
            por[dni][k] = { vino: p.present === true, obs: String(p.justification || '').trim() };
        });
    });
    return { por, cerrados };
};

const dibujarLaFoto = (deEsteBloque, nBloque, deCuantos) => {
    const ESCALA = 2;               // se dibuja al doble: en un celular, a 1x sale borroso
    const MARGEN = 18;
    const ANCHO_NUM = 20, ANCHO_NOMBRE = 168, ANCHO_DNI = 64, ANCHO_CARGO = 84, ANCHO_DIA = 29;
    const ANCHO = MARGEN * 2 + ANCHO_NUM + ANCHO_NOMBRE + ANCHO_DNI + ANCHO_CARGO + 7 * ANCHO_DIA;
    const ALTO_FILA = 20;
    const ALTO_TITULO = 66;
    const ALTO_TARJETAS = 62;
    const ALTO_ENCABEZADO = 26;
    const ALTO_PIE = 30;      // solo la leyenda: debajo ya no va nada

    const dias = semanaDeHoy();
    const { por: marcas, cerrados } = marcasDeLaSemana(dias);
    /* LAS TARJETAS CUENTAN EL ULTIMO DIA CERRADO, no el de hoy sin guardar: un resumen de
       algo que nadie ha pasado todavia no dice nada. Es lo mismo que hace la web. */
    const ultimoCerrado = cerrados.length ? cerrados[cerrados.length - 1] : null;
    const deEseDia = ultimoCerrado
        ? (adminService.getAttendance(ultimoCerrado).data || []) : [];

    const total = deEseDia.length;
    const faltaron = deEseDia.filter(p => p.present === false && !String(p.justification || '').trim()).length;
    const conObs = deEseDia.filter(p => p.present === false && String(p.justification || '').trim()).length;
    const asistieron = deEseDia.filter(p => p.present !== false).length;
    let hombres = 0, mujeres = 0;
    deEseDia.forEach(p => {
        const sx = fichaMaestro(p.dni).sexo;
        if (sx === 'H') hombres++; else if (sx === 'M') mujeres++;
    });

    const alto = ALTO_TITULO + ALTO_TARJETAS + ALTO_ENCABEZADO + deEsteBloque.length * ALTO_FILA + ALTO_PIE;

    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO * ESCALA;
    lienzo.height = alto * ESCALA;
    const g = lienzo.getContext('2d');
    g.scale(ESCALA, ESCALA);
    g.textBaseline = 'middle';

    const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const VA = '#0B5F52', TARDE = '#98302E', CURSO = '#B26A00', TENUE = '#6C7B80',
          TINTA = '#131C1F', AZUL = '#2C4C7C';

    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, ANCHO, alto);

    /* ── EL TITULO, como el de la web ────────────────────────────────────────────────── */
    g.fillStyle = VA;
    g.fillRect(0, 0, ANCHO, ALTO_TITULO);
    g.fillStyle = '#FFFFFF';
    g.font = `800 16px ${UI}`;
    g.fillText('CONTROL DE ASISTENCIA TURNO NOCHE', MARGEN, 24);
    const a = dias[0], b = dias[6];
    g.font = `400 11px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(`Semana ${numeroDeSemana(a)}  ·  ${a.getDate()} de ${MES_LARGO[a.getMonth()]} al `
               + `${b.getDate()} de ${MES_LARGO[b.getMonth()]} de ${b.getFullYear()}`, MARGEN, 44);
    g.textAlign = 'right';
    g.font = `400 9px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('LOGÍSTICA', ANCHO - MARGEN, 18);
    g.font = `800 13px ${UI}`;
    g.fillStyle = '#8FD8C9';
    g.fillText('DEAM1830', ANCHO - MARGEN, 33);
    g.font = `700 9px ${UI}`;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    if (ultimoCerrado) {
        const f = new Date(ultimoCerrado + 'T12:00:00');
        g.fillText(`RESUMEN DEL ${DIAS[f.getDay()].slice(0, 3).toUpperCase()} ${f.getDate()}`, ANCHO - MARGEN, 50);
    } else {
        g.fillText('SIN DÍAS CERRADOS', ANCHO - MARGEN, 50);
    }
    g.textAlign = 'left';

    /* ── LAS CINCO TARJETAS ──────────────────────────────────────────────────────────── */
    /* LAS DOS SILUETAS de la tarjeta de hombres y mujeres: cabeza y cuerpo, en relleno.
       Se dibujan a mano porque un canvas no entiende los iconos SVG de la plataforma. Son
       las mismas de la lamina de la web, que las pidio Daniel: "iconos de hombre y mujer
       (como sombras)". La cabeza es igual en las dos; lo que cambia es el cuerpo: en el
       hombre baja casi recto desde los hombros y en la mujer se abre hacia abajo. */
    const silueta = (cx, cy, alto, esHombre, color) => {
        const r = alto * 0.19;
        const yCab = cy - alto / 2 + r;
        const yHom = yCab + r + alto * 0.05;
        const yPie = cy + alto / 2;
        const hom = alto * 0.29;
        const pie = esHombre ? alto * 0.24 : alto * 0.42;
        g.fillStyle = color;
        g.beginPath(); g.arc(cx, yCab, r, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.moveTo(cx - hom, yHom + alto * 0.10);
        g.quadraticCurveTo(cx - hom, yHom, cx - hom * 0.5, yHom);
        g.lineTo(cx + hom * 0.5, yHom);
        g.quadraticCurveTo(cx + hom, yHom, cx + hom, yHom + alto * 0.10);
        g.lineTo(cx + pie, yPie);
        g.lineTo(cx - pie, yPie);
        g.closePath(); g.fill();
    };

    const TARJETAS = [
        [String(total), 'OPERARIOS', TINTA],
        [String(asistieron), 'ASISTENCIAS', VA],
        [String(faltaron), faltaron === 1 ? 'FALTA' : 'FALTAS', TARDE],
        [String(conObs), 'OBSERVACIONES', CURSO],
        [`${hombres} · ${mujeres}`, 'HOMBRES · MUJERES', AZUL]
    ];
    const anchoT = (ANCHO - 2 * MARGEN - 4 * 6) / 5;
    TARJETAS.forEach(([valor, rotulo, color], i) => {
        const x = MARGEN + i * (anchoT + 6);
        g.fillStyle = '#F3F6F5';
        g.fillRect(x, ALTO_TITULO + 10, anchoT, ALTO_TARJETAS - 20);
        g.textAlign = 'center';
        g.fillStyle = color;
        g.font = `800 16px ${UI}`;
        if (i === 4) {
            /* La ultima lleva las dos siluetas, cada una delante de su numero. */
            const AZUL_H = '#2C4C7C', NARANJA_M = '#B26A00';
            const anchoH = g.measureText(String(hombres)).width;
            const anchoM = g.measureText(String(mujeres)).width;
            const sep = 9, icono = 9;
            const todo = icono + 3 + anchoH + sep + icono + 3 + anchoM;
            let cx = x + anchoT / 2 - todo / 2;
            silueta(cx + icono / 2, ALTO_TITULO + 27, 16, true, AZUL_H);
            cx += icono + 3;
            g.textAlign = 'left'; g.fillStyle = AZUL_H;
            g.fillText(String(hombres), cx, ALTO_TITULO + 28);
            cx += anchoH + sep;
            silueta(cx + icono / 2, ALTO_TITULO + 27, 16, false, NARANJA_M);
            cx += icono + 3;
            g.fillStyle = NARANJA_M;
            g.fillText(String(mujeres), cx, ALTO_TITULO + 28);
            g.textAlign = 'center';
        } else {
            g.fillText(valor, x + anchoT / 2, ALTO_TITULO + 28);
        }
        g.fillStyle = TENUE;
        g.font = `700 7.5px ${UI}`;
        let r = rotulo;
        while (g.measureText(r).width > anchoT - 6 && r.length > 4) r = r.slice(0, -1);
        g.fillText(r, x + anchoT / 2, ALTO_TITULO + 42);
    });
    g.textAlign = 'left';

    /* ── LOS ENCABEZADOS DE COLUMNA ──────────────────────────────────────────────────── */
    const xNum = MARGEN;
    const xNombre = xNum + ANCHO_NUM;
    const xDni = xNombre + ANCHO_NOMBRE;
    const xCargo = xDni + ANCHO_DNI;
    const xDia = (i) => xCargo + ANCHO_CARGO + i * ANCHO_DIA + ANCHO_DIA / 2;
    const yEnc = ALTO_TITULO + ALTO_TARJETAS + 4;

    g.fillStyle = '#EEF2F1';
    g.fillRect(MARGEN - 6, yEnc - 12, ANCHO - 2 * MARGEN + 12, ALTO_ENCABEZADO - 2);
    g.fillStyle = TENUE;
    g.font = `700 8.5px ${UI}`;
    g.fillText('#', xNum, yEnc);
    g.fillText('NOMBRES Y APELLIDOS', xNombre, yEnc);
    g.fillText('DNI', xDni, yEnc);
    g.fillText('CARGO', xCargo, yEnc);
    const ROTULO = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
    g.textAlign = 'center';
    dias.forEach((d, i) => {
        const esHoy = claveDia(d) === ultimoCerrado;
        g.fillStyle = esHoy ? VA : TENUE;
        g.font = `${esHoy ? 800 : 700} 8.5px ${UI}`;
        g.fillText(ROTULO[i], xDia(i), yEnc - 4);
        g.font = `400 8px ${UI}`;
        g.fillText(String(d.getDate()), xDia(i), yEnc + 6);
    });
    g.textAlign = 'left';

    let y = yEnc + ALTO_ENCABEZADO;
    deEsteBloque.forEach((p, i) => {
        /* Se resalta por lo que dice el ULTIMO DIA CERRADO, no por lo que hay en pantalla:
           la foto habla de lo guardado. */
        const delDia = ultimoCerrado ? (marcas[String(p.dni)] || {})[ultimoCerrado] : null;
        const falto = !!delDia && delDia.vino === false;
        if (i % 2 === 1) { g.fillStyle = '#F6F9F8'; g.fillRect(MARGEN - 6, y - 10, ANCHO - 2 * MARGEN + 12, ALTO_FILA); }
        g.textAlign = 'left';
        g.fillStyle = TENUE;
        g.font = `400 9px ${UI}`;
        g.fillText(String(p.__n), xNum, y);
        g.fillStyle = TINTA;
        g.font = `${falto ? 700 : 400} 11px ${UI}`;
        let nombre = nombreCompleto(p);
        while (g.measureText(nombre).width > ANCHO_NOMBRE - 8 && nombre.length > 4) nombre = nombre.slice(0, -2);
        g.fillText(nombre, xNombre, y);
        g.fillStyle = TENUE;
        g.font = `400 9.5px ${UI}`;
        g.fillText(String(p.dni || ''), xDni, y);
        let cargo = fichaMaestro(p.dni).cargo;
        while (g.measureText(cargo).width > ANCHO_CARGO - 6 && cargo.length > 3) cargo = cargo.slice(0, -2);
        g.fillText(cargo, xCargo, y);

        /* La semana, con el mismo codigo de simbolos de la web. */
        g.textAlign = 'center';
        dias.forEach((d, j) => {
            const m = (marcas[String(p.dni)] || {})[claveDia(d)];
            if (!m) { g.fillStyle = '#C6D0CE'; g.font = `400 11px ${UI}`; g.fillText('–', xDia(j), y); return; }
            if (m.obs) { g.fillStyle = CURSO; g.font = `800 11px ${UI}`; g.fillText(letraDelMotivo(m.obs), xDia(j), y); return; }
            g.fillStyle = m.vino ? VA : TARDE;
            g.font = `700 11.5px ${UI}`;
            g.fillText(m.vino ? '✓' : '✗', xDia(j), y);
        });
        g.textAlign = 'left';
        y += ALTO_FILA;
    });

    /* ── LA LEYENDA: es lo que hace que el cuadro se entienda sin preguntar ───────────── */
    g.strokeStyle = '#DCE4E2';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(MARGEN, y + 2); g.lineTo(ANCHO - MARGEN, y + 2); g.stroke();

    const leyenda = [['✓', 'asistió', VA], ['V', 'vacaciones', CURSO], ['M', 'descanso médico', CURSO],
                     ['C', 'cumpleaños', CURSO], ['O', 'otros (justificada)', CURSO],
                     ['✗', 'falta injustificada', TARDE]];
    let lx = MARGEN;
    leyenda.forEach(([simbolo, texto, color]) => {
        g.fillStyle = color;
        g.font = `800 10px ${UI}`;
        g.fillText(simbolo, lx, y + 18);
        lx += g.measureText(simbolo).width + 4;
        g.fillStyle = TENUE;
        g.font = `400 9.5px ${UI}`;
        g.fillText(texto, lx, y + 18);
        lx += g.measureText(texto).width + 12;
    });

    /* DEBAJO DE LA LEYENDA NO VA NADA. Estaba el sello con la hora y el "sin cerrar", y
       Daniel lo saco: la foto se manda al toque, asi que la hora la pone el propio WhatsApp,
       y lo de "sin cerrar" es cosa de la web, no de Recursos Humanos. */

    return lienzo;
};

/** Muestra las fotos a pantalla completa, para guardarlas o compartirlas a mano. */
const verLaFoto = (lista) => {
    const datos = Array.isArray(lista) ? lista : [lista];
    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.9);'
        + 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:16px;';
    capa.style.overflowY = 'auto';
    capa.style.justifyContent = 'flex-start';
    datos.forEach((d, i) => {
        const img = document.createElement('img');
        img.src = d;
        img.style.cssText = 'max-width:100%; border-radius:10px; background:#fff;';
        const bajar = document.createElement('a');
        bajar.href = d;
        bajar.download = datos.length > 1
            ? 'Asistencia ' + fechaDeLaLista() + ' (' + (i + 1) + ' de ' + datos.length + ').png'
            : 'Asistencia ' + fechaDeLaLista() + '.png';
        bajar.textContent = datos.length > 1 ? 'Guardar el bloque ' + (i + 1) : 'Guardar la foto';
        bajar.style.cssText = 'background:#0B5F52; color:#fff; padding:.8rem 1.4rem; border-radius:10px;'
            + 'font-family:system-ui,sans-serif; font-weight:700; text-decoration:none;';
        capa.appendChild(img); capa.appendChild(bajar);
    });
    const nota = document.createElement('span');
    nota.textContent = 'Mantén el dedo sobre la foto para compartirla';
    nota.style.cssText = 'color:#C8D2D0; font-family:system-ui,sans-serif; font-size:.8rem;';
    capa.appendChild(nota);
    capa.addEventListener('click', (e) => { if (e.target === capa) capa.remove(); });
    document.body.appendChild(capa);
};

/* UNA SOLA IMAGEN. Daniel, viendola: *"en una sola imagen nada mas, dejalo, esta bien"*.
   Se probo partirla en dos porque el tope de WhatsApp cae sobre el lado mas largo, pero con
   la gente de hoy entra de sobra y prefiere mandar una. Si algun dia crece la lista y llega
   borrosa, partirla es volver a repartir `orden` en dos mitades y llamar dos veces a
   `dibujarLaFoto`, que ya sabe decir "bloque 1 de 2". */
const laminasDeLaLista = () => {
    /* POR APELLIDO, como la web. Antes iban primero los que faltaron: quien cruza la foto
       contra el cuadro de la web tenia que buscar a cada persona dos veces. */
    const orden = listaLocal.slice()
        .sort((x, y) => claveDeOrden(x).localeCompare(claveDeOrden(y), 'es'))
        .map((p, i) => Object.assign({ __n: i + 1 }, p));

    return [dibujarLaFoto(orden, 1, 1)];
};

/** Arma los bloques y los manda por donde el telefono deje: WhatsApp, correo, lo que sea. */
const mandarFoto = async () => {
    if (!listaLocal) cargarLista();
    if (!listaLocal.length) return;
    const lienzos = laminasDeLaLista();
    const archivos = [];
    for (let i = 0; i < lienzos.length; i++) {
        const blob = await new Promise(r => lienzos[i].toBlob(r, 'image/png'));
        const nombre = lienzos.length > 1
            ? 'Asistencia ' + fechaDeLaLista() + ' (' + (i + 1) + ' de ' + lienzos.length + ').png'
            : 'Asistencia ' + fechaDeLaLista() + '.png';
        archivos.push(new File([blob], nombre, { type: 'image/png' }));
    }
    /* El menu de compartir del telefono, con los dos bloques de una vez. Si el navegador no
       lo tiene -o es una PC- se muestran para guardarlos, que es la salida de siempre. */
    try {
        if (navigator.canShare && navigator.canShare({ files: archivos })) {
            await navigator.share({ files: archivos, title: 'Asistencia del turno' });
            return;
        }
    } catch (e) { /* si la persona cancela el menu, no pasa nada */ return; }
    verLaFoto(lienzos.map(l => l.toDataURL('image/png')));
};

/* ── LOS AVISOS DEL CELULAR ───────────────────────────────────────────────────────────── */

let avisosEstado = 'mirando';    // mirando | apagados | prendidos | sin-soporte | bloqueados
let avisosTrabajando = false;

/** El identificador de ESTE telefono. Una persona puede tener el celular y la tablet, y cada
 *  uno necesita su propia suscripcion: si se pisaran, el aviso llegaria a uno solo. */
const idDeEsteTelefono = () => {
    try {
        let id = localStorage.getItem('deam_id_telefono');
        if (!id) {
            id = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('deam_id_telefono', id);
        }
        return id;
    } catch (e) { return 'sin-memoria'; }
};

const puedeAvisos = () => ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

const mirarAvisos = async () => {
    if (!puedeAvisos()) { avisosEstado = 'sin-soporte'; return; }
    if (Notification.permission === 'denied') { avisosEstado = 'bloqueados'; return; }
    try {
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.getSubscription();
        avisosEstado = sus ? 'prendidos' : 'apagados';
    } catch (e) { avisosEstado = 'apagados'; }
};

/** La llave viaja en base64 de URL y el navegador la quiere en bytes. */
const llaveEnBytes = (base64) => {
    const relleno = '='.repeat((4 - base64.length % 4) % 4);
    const limpia = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(limpia);
    const bytes = new Uint8Array(crudo.length);
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return bytes;
};

const prenderAvisos = async () => {
    if (avisosTrabajando) return;
    avisosTrabajando = true; pintar();
    try {
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
            avisosEstado = permiso === 'denied' ? 'bloqueados' : 'apagados';
            return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.subscribe({
            userVisibleOnly: true,                       // sin esto el navegador no suscribe
            applicationServerKey: llaveEnBytes(LLAVE_AVISOS)
        });
        const s = sus.toJSON();
        await fetch(`${BASE_API}/${AREA_AVISOS}?date=MASTER`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(YO.token ? { 'X-Auth-Token': YO.token } : {}) },
            body: JSON.stringify({
                id: YO.username + '|' + idDeEsteTelefono(),
                usuario: YO.username,
                rol: YO.role || '',
                endpoint: s.endpoint,
                claves: s.keys,
                telefono: navigator.userAgent.slice(0, 90),
                cuando: new Date().toISOString()
            })
        });
        avisosEstado = 'prendidos';
    } catch (e) {
        console.warn('[APP] no se pudieron prender los avisos:', e && e.message);
        alert('No se pudieron activar los avisos. Vuelve a intentar.');
        await mirarAvisos();
    }
    avisosTrabajando = false;
    pintar();
};

const apagarAvisos = async () => {
    if (avisosTrabajando) return;
    avisosTrabajando = true; pintar();
    try {
        const reg = await navigator.serviceWorker.ready;
        const sus = await reg.pushManager.getSubscription();
        if (sus) await sus.unsubscribe();
        /* Se borra tambien del servidor: si quedara, el robot seguiria mandando avisos a un
           telefono que ya no los quiere y el servicio terminaria rechazandolos. */
        await fetch(`${BASE_API}/${AREA_AVISOS}?date=MASTER`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(YO.token ? { 'X-Auth-Token': YO.token } : {}) },
            body: JSON.stringify({ id: YO.username + '|' + idDeEsteTelefono(), usuario: YO.username, baja: true })
        });
        avisosEstado = 'apagados';
    } catch (e) { console.warn('[APP] apagar avisos:', e && e.message); }
    avisosTrabajando = false;
    pintar();
};

const pantallaAvisos = () => {
    const esAdmin = esElAdministrador();
    const loQueLlega = esAdmin
        ? [['🤖', 'Cada robot que corre', 'Cómo le fue a cada corrida, apenas termina.'],
           ['📦', 'Los cortes de stock', 'El de las 07:00 y el de las 19:00.'],
           ['💬', 'Los mensajes del chat', 'Cuando alguien te escribe.']]
        : [['📦', 'Los cortes de stock', 'El de las 07:00 y el de las 19:00.'],
           ['💬', 'Los mensajes del chat', 'Cuando alguien te escribe.']];

    const lista = loQueLlega.map(([ic, que, detalle]) => `
        <div class="am-fila">
            <span class="cinta" style="background:var(--am-va)"></span>
            <span class="medio"><span class="t">${ic} ${esc(que)}</span><span class="d">${esc(detalle)}</span></span>
        </div>`).join('');

    let caja = '';
    if (avisosEstado === 'sin-soporte') {
        caja = `<div class="am-pronto"><span class="ic">📵</span><span class="q">Este teléfono no admite avisos</span>
                <span class="p">Hace falta Android con Chrome, o un iPhone con la app agregada a la pantalla de inicio.</span></div>`;
    } else if (avisosEstado === 'bloqueados') {
        caja = `<div class="am-pronto"><span class="ic">🔕</span><span class="q">Los avisos están bloqueados</span>
                <span class="p">Se dijo que no una vez. Para volver a permitirlos hay que entrar a los ajustes del navegador, en los permisos de este sitio.</span></div>`;
    } else if (avisosEstado === 'prendidos') {
        caja = `<div class="am-cerrada">🔔 Avisos activados en este teléfono</div>
                <button type="button" class="am-boton fino" data-apagar-avisos ${avisosTrabajando ? 'disabled' : ''}>Apagar los avisos aquí</button>`;
    } else {
        caja = `<div class="am-tarjeta">
                    <span class="am-rotulo">Avisos</span>
                    <span class="am-pie">Con esto el teléfono avisa <b>aunque esté guardado y con la pantalla apagada</b>. Sin esto, solo te enteras al abrir la app.</span>
                </div>
                <button type="button" class="am-boton" data-prender-avisos ${avisosTrabajando ? 'disabled' : ''}>${avisosTrabajando ? 'Activando…' : '🔔 Activar los avisos'}</button>`;
    }

    return `
        ${caja}
        <div class="am-seccion">Qué te va a llegar</div>
        ${lista}
        <p class="am-nota">Los avisos los manda el servidor del almacén. No pasan por ninguna tienda ni cuestan nada.</p>
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const CABECERAS = {
    inicio: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: `${saludo()}, ${String(YO.name || YO.username).split(' ')[0]}` }),
    reportes: () => ({ sub: `Datos del ${diaEnLetras()}`, ttl: 'Reportes' }),
    tareas: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: 'Tareas' }),
    lista: () => ({ sub: `Turno noche · ${diaEnLetras()}`, ttl: 'Pasar lista' }),
    avisos: () => ({ sub: avisosEstado === 'prendidos' ? 'Activados en este teléfono' : 'Apagados', ttl: 'Avisos' })
};

const pintar = () => {
    if (!raiz) return;
    const cab = (CABECERAS[seccion] || CABECERAS.inicio)();
    raiz.querySelector('.am-cab .sub').textContent = cab.sub;
    raiz.querySelector('.am-cab .ttl').textContent = cab.ttl;

    const cuerpo = raiz.querySelector('.am-cuerpo');
    cuerpo.innerHTML = seccion === 'inicio' ? pantallaInicio()
        : seccion === 'lista' ? pantallaLista()
        : seccion === 'avisos' ? pantallaAvisos()
        : pantallaEnCamino(seccion);
    cuerpo.scrollTop = 0;

    raiz.querySelector('.am-barra').innerHTML = SECCIONES.map(s => `
        <button type="button" role="tab" data-seccion="${s.id}" aria-selected="${s.id === seccion}">
            <span class="gl">${ICONOS[s.icono]}</span>${esc(s.rotulo)}
        </button>`).join('');
};

/** Vuelve a la web de siempre y se acuerda de la decisión. */
const irAEscritorio = () => {
    try { localStorage.setItem('deam_prefiere_escritorio', '1'); } catch (e) { /* da igual */ }
    location.reload();
};

export const prefiereEscritorio = () => {
    try { return localStorage.getItem('deam_prefiere_escritorio') === '1'; } catch (e) { return false; }
};

export const renderAppMovil = async (contenedor, user, onLogout) => {
    YO = user;
    alSalir = onLogout;
    seccion = 'inicio';

    /* Los mismos datos de siempre. Si el servidor tarda, la app dibuja igual y se completa
       en la siguiente vuelta: mas vale una pantalla con ceros que una en blanco. */
    try { await adminService.initializeAdminData(); } catch (e) { console.warn('[APP] datos:', e && e.message); }

    if (!document.getElementById('app-movil-estilos')) {
        const est = document.createElement('style');
        est.id = 'app-movil-estilos';
        est.textContent = CSS;
        document.head.appendChild(est);
    }

    contenedor.innerHTML = '';
    raiz = document.createElement('div');
    raiz.id = 'app-movil';
    raiz.innerHTML = `
        <header class="am-cab"><div class="sub"></div><div class="ttl"></div></header>
        <main class="am-cuerpo"></main>
        <nav class="am-barra" role="tablist"></nav>`;
    document.body.appendChild(raiz);

    /* LA CINTA DE PRUEBAS NO PUEDE TAPAR LA BARRA DE ABAJO. En beta, env.js pega un cartel
       fijo en el borde inferior y se comia las cinco secciones. En produccion no existe y
       la app llega hasta el borde, como debe ser. */
    const capaCinta = document.getElementById(String.fromCharCode(112) + 'ulse-env-aviso');
    if (capaCinta) {
        /* Se mide el CARTEL, no la capa: la capa cubre la pantalla entera y su alto es el
           alto de la ventana. Medir la capa dejaba la app fuera de la pantalla. */
        const cartel = capaCinta.firstElementChild;
        /* Lo que hay que dejar libre NO es el alto del cartel sino CUANTO OCUPA DESDE EL
           BORDE DE ABAJO: el cartel no esta pegado al borde, y por esos pocos pixeles la
           barra le quedaba encima igual. */
        const caja = cartel && cartel.getBoundingClientRect();
        const ocupa = caja ? Math.ceil(window.innerHeight - caja.top) : 0;
        raiz.style.bottom = (ocupa > 6 && ocupa < 90 ? ocupa : 30) + 'px';
    }

    raiz.addEventListener('click', (e) => {
        const s = e.target.closest('[data-seccion]');
        if (s) {
            seccion = s.getAttribute('data-seccion');
                if (seccion === 'lista') { cargarLista(); refrescarLista(); }   // se trae al entrar
            if (seccion === 'avisos') mirarAvisos().then(pintar);
            pintar();
            return;
        }
        const vino = e.target.closest('[data-vino]');
        if (vino) { marcar(vino.getAttribute('data-vino'), true); return; }
        const falto = e.target.closest('[data-falto]');
        if (falto) { marcar(falto.getAttribute('data-falto'), false); return; }
        if (e.target.closest('[data-guardar]')) { guardarLista(true); return; }
        if (e.target.closest('[data-foto]')) { mandarFoto(); return; }
        if (e.target.closest('[data-prender-avisos]')) { prenderAvisos(); return; }
        if (e.target.closest('[data-apagar-avisos]')) { apagarAvisos(); return; }
        if (e.target.closest('[data-reabrir]')) { reabrirLista(); return; }
        if (e.target.closest('[data-cerrar]')) { guardarLista(true); return; }
        if (e.target.closest('[data-escritorio]')) { irAEscritorio(); return; }
    });

    raiz.addEventListener('change', (e) => {
        const j = e.target.closest('[data-justif]');
        if (j) anotarMotivo(j.getAttribute('data-justif'), j.value);
    });

    pintar();

    /* Se refresca solo, pero despacio: un celular en el bolsillo no tiene por que preguntar
       cada veinte segundos. Con un minuto alcanza, y cuando vuelve a la mano se refresca. */
    if (reloj) clearInterval(reloj);
    reloj = setInterval(() => {
        /* NO SE REPINTA LA LISTA SOLA: se estaria pisando lo que la persona acaba de marcar
           y todavia no guardo. Las demas pantallas si se refrescan. */
        if (document.visibilityState === 'visible' && seccion !== 'lista') pintar();
    }, 60000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') pintar();
    });

    console.log(`📲 [APP] la app del celular, lista para ${user.username}`);
};

export const desmontarAppMovil = () => {
    if (reloj) { clearInterval(reloj); reloj = null; }
    if (raiz && raiz.parentNode) raiz.parentNode.removeChild(raiz);
    raiz = null;
};
