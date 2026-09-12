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

import * as adminService from '../services_v245/adminService.js?v=29.0741';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0741';
import { armarLista, nombreCorto, iniciales } from '../services_v245/asistencia_comunes.js?v=29.0741';

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

#app-movil .am-cab { padding: calc(0.7rem + env(safe-area-inset-top)) 1.1rem 0.8rem;
  background: var(--am-papel); border-bottom: 1px solid var(--am-linea); }
#app-movil .am-cab .sub { font-family: var(--am-num); font-size: 0.7rem; letter-spacing: .04em;
  text-transform: uppercase; color: var(--am-tenue); }
#app-movil .am-cab .ttl { font-size: 1.12rem; font-weight: 750; letter-spacing: -0.015em; }

#app-movil .am-cuerpo { overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: 0.9rem 1.1rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }

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
#app-movil .am-persona { background: var(--am-carta); border: 1px solid var(--am-linea);
  border-radius: 11px; padding: 0.55rem 0.6rem 0.55rem 0.7rem; display: flex; align-items: center;
  gap: 0.6rem; min-width: 0; transition: border-color .15s ease, background .15s ease; }
#app-movil .am-persona.falto { border-color: #E7BEBC; background: #FDF7F7; }
#app-movil .am-persona .ini { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: var(--am-va-agua); color: var(--am-va); display: grid; place-items: center;
  font-size: 0.66rem; font-weight: 750; font-family: var(--am-num); }
#app-movil .am-persona.falto .ini { background: var(--am-tarde-agua); color: var(--am-tarde); }
#app-movil .am-persona .quien { flex: 1; min-width: 0; }
/* display:block en los dos: como span sueltos, el nombre y el DNI salian pegados en la
   misma linea -"Gian AlataDNI 74821779"- y el recorte con puntos suspensivos no aplicaba. */
#app-movil .am-persona .nm { display: block; font-weight: 650; font-size: 0.88rem; letter-spacing: -.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#app-movil .am-persona .dni { display: block; font-family: var(--am-num); font-size: 0.64rem;
  color: var(--am-tenue); line-height: 1.3; }
#app-movil .am-persona .marcas { display: flex; gap: 0.3rem; flex-shrink: 0; }
#app-movil .am-persona .marcas button { font-family: var(--am-ui); font-size: 0.72rem; font-weight: 700;
  padding: 0.42rem 0.6rem; border-radius: 8px; border: 1.5px solid var(--am-linea);
  background: var(--am-carta); color: var(--am-tenue); cursor: pointer; min-width: 52px; }
#app-movil .am-persona .marcas button.si-vino { background: var(--am-va); border-color: var(--am-va); color: #fff; }
#app-movil .am-persona .marcas button.si-falto { background: var(--am-tarde); border-color: var(--am-tarde); color: #fff; }
#app-movil .am-persona .marcas button:disabled { opacity: .55; cursor: default; }

/* La justificacion, colgada de la fila de quien falto. */
#app-movil .am-justif { background: #FDF7F7; border: 1px solid #E7BEBC; border-top: 0;
  border-radius: 0 0 11px 11px; margin: -11px 0 0; padding: 0.55rem 0.7rem 0.6rem;
  display: flex; align-items: center; gap: 0.5rem; }
#app-movil .am-justif label { font-family: var(--am-num); font-size: 0.6rem; letter-spacing: .1em;
  text-transform: uppercase; color: var(--am-tarde); font-weight: 700; flex-shrink: 0; }
#app-movil .am-justif select { flex: 1; min-width: 0; font-family: var(--am-ui); font-size: 0.82rem;
  padding: 0.45rem 0.5rem; border-radius: 8px; border: 1px solid #E7BEBC; background: var(--am-carta);
  color: var(--am-tinta); }
#app-movil .am-persona.falto { border-radius: 11px 11px 0 0; }
#app-movil .am-persona.falto.sola { border-radius: 11px; }

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
#app-movil .am-chico.solo-icono { padding: 0.5rem 0.6rem; border-color: var(--am-linea);
  color: var(--am-suave); font-size: 0.95rem; }
#app-movil .am-cerrada { background: var(--am-va-agua); border: 1px solid var(--am-va);
  color: var(--am-va); border-radius: 11px; padding: 0.85rem; text-align: center; font-weight: 700; }

#app-movil .am-boton { display: block; width: 100%; padding: 0.95rem; border-radius: 11px;
  border: 1px solid var(--am-va); background: var(--am-va); color: #fff; font-family: var(--am-ui);
  font-size: 0.98rem; font-weight: 700; cursor: pointer; }
#app-movil .am-boton:disabled { background: #C9D4D2; border-color: #C9D4D2; color: #55666B; cursor: default; }
#app-movil .am-boton.fino { background: none; color: var(--am-va); font-size: .86rem; padding: .7rem;
  border-style: dashed; }

#app-movil .am-barra { display: flex; background: var(--am-carta); border-top: 1px solid var(--am-linea);
  padding: 0.4rem 0.25rem calc(0.55rem + env(safe-area-inset-bottom)); }
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
        /* LA JUSTIFICACION CUELGA DE LA FILA, y solo de la de quien falto: en la web es una
           columna porque hay pantalla de sobra; treinta y tres desplegables en un telefono
           serian un estorbo. A quien vino no se le pone justificacion nunca. */
        const justif = !falto ? '' : `
        <div class="am-justif">
            <label for="j-${esc(p.dni)}">Motivo</label>
            <select id="j-${esc(p.dni)}" ${bloq} data-justif="${esc(p.dni)}">
                ${JUSTIFICACIONES.map(([valor, rotulo]) =>
                    `<option value="${esc(valor)}" ${String(p.justification || '') === valor ? 'selected' : ''}>${esc(rotulo)}</option>`).join('')}
            </select>
        </div>`;
        return `
        <div class="am-persona ${falto ? 'falto' : ''}">
            <span class="ini">${esc(iniciales(p))}</span>
            <span class="quien"><span class="nm">${esc(nombreCorto(p))}</span><span class="dni">DNI ${esc(p.dni)}</span></span>
            <span class="marcas">
                <button type="button" ${bloq} class="${falto ? '' : 'si-vino'}" data-vino="${esc(p.dni)}">Vino</button>
                <button type="button" ${bloq} class="${falto ? 'si-falto' : ''}" data-falto="${esc(p.dni)}">Faltó</button>
            </span>
        </div>${justif}`;
    }).join('');

    return `
        <div class="am-tarjeta am-resumen">
            <span class="am-rotulo">Vinieron</span>
            <span class="am-grande">${numero(vinieron)}<span style="font-size:1.3rem;color:#8B9B9F">/${numero(total)}</span></span>
            <span class="am-pie">${faltaron ? `${numero(faltaron)} ${faltaron === 1 ? 'falta' : 'faltas'}` : 'nadie faltó'}${listaCerrada ? ' · lista cerrada' : ' · toca solo a quien faltó'}</span>
            ${listaCerrada ? '' : `<span class="acciones">
                <button type="button" class="am-chico solo-icono" data-sincronizar title="Traer lo último del servidor">🔄</button>
                <button type="button" class="am-chico" data-guardar ${listaGuardando ? 'disabled' : ''}>${listaGuardando ? 'Guardando…' : 'Guardar'}</button>
            </span>`}
        </div>

        ${listaCerrada
            ? `<div class="am-cerrada">✅ Asistencia cerrada</div>
               ${esElAdministrador() ? '<button type="button" class="am-boton fino" data-reabrir>Reabrir la lista</button>' : ''}`
            : ''}

        <div class="am-seccion">${listaCerrada ? 'Lista cerrada del turno' : 'Turno noche'}</div>
        ${gente}

        ${listaCerrada ? '' : '<button type="button" class="am-boton fino" data-cerrar>💾 Cerrar asistencia</button>'}
        <button type="button" class="am-salida" data-escritorio>Ver la versión de escritorio</button>
    `;
};

const esElAdministrador = () => String((YO && YO.username) || '') === 'dames';

const marcar = (dni, vino) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (!p) return;
    p.present = !!vino;
    if (!vino) p.onTime = false;      // quien no vino no puede haber llegado a tiempo
    if (vino) p.justification = '';   // si al final vino, el motivo que se puso ya no aplica
    pintar();
};

const anotarMotivo = (dni, motivo) => {
    if (listaCerrada || !listaLocal) return;
    const p = listaLocal.filter(x => String(x.dni) === String(dni))[0];
    if (p) p.justification = motivo || '';
    /* NO se repinta: se perderia el desplegable recien abierto y el sitio de la lista. */
};

const sincronizar = async (boton) => {
    if (boton) { boton.disabled = true; boton.textContent = '⌛'; }
    try { await adminService.initializeAdminData(true); } catch (e) { console.warn('[APP] sincronizar:', e && e.message); }
    cargarLista();
    pintar();
};

const reabrirLista = async () => {
    if (!esElAdministrador()) return;
    if (!confirm('¿Reabrir la lista del turno? Se va a poder editar de nuevo.')) return;
    try { await adminService.reopenAttendance(fechaDeLaLista()); } catch (e) { alert('No se pudo reabrir.'); return; }
    cargarLista();
    pintar();
};

const guardarLista = async (cerrando) => {
    if (!listaLocal || listaGuardando) return;
    if (cerrando && !confirm('¿Cerrar la lista del turno? Después se corrige desde la web.')) return;
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

const CABECERAS = {
    inicio: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: `${saludo()}, ${String(YO.name || YO.username).split(' ')[0]}` }),
    reportes: () => ({ sub: `Datos del ${diaEnLetras()}`, ttl: 'Reportes' }),
    tareas: () => ({ sub: `Turno · ${diaEnLetras()}`, ttl: 'Tareas' }),
    lista: () => ({ sub: `Turno noche · ${diaEnLetras()}`, ttl: 'Pasar lista' }),
    avisos: () => ({ sub: 'Sin avisos todavía', ttl: 'Avisos' })
};

const pintar = () => {
    if (!raiz) return;
    const cab = (CABECERAS[seccion] || CABECERAS.inicio)();
    raiz.querySelector('.am-cab .sub').textContent = cab.sub;
    raiz.querySelector('.am-cab .ttl').textContent = cab.ttl;

    const cuerpo = raiz.querySelector('.am-cuerpo');
    cuerpo.innerHTML = seccion === 'inicio' ? pantallaInicio()
        : seccion === 'lista' ? pantallaLista()
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
            if (seccion === 'lista') cargarLista();   // se relee al entrar, no al dibujar
            pintar();
            return;
        }
        const vino = e.target.closest('[data-vino]');
        if (vino) { marcar(vino.getAttribute('data-vino'), true); return; }
        const falto = e.target.closest('[data-falto]');
        if (falto) { marcar(falto.getAttribute('data-falto'), false); return; }
        if (e.target.closest('[data-guardar]')) { guardarLista(false); return; }
        const sinc = e.target.closest('[data-sincronizar]');
        if (sinc) { sincronizar(sinc); return; }
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
