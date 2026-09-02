/**
 * TURNO — GANTT DE ACTIVIDADES Y CUMPLIMIENTO
 *
 * El control del turno de noche: qué se hizo, a qué hora, y cuánto de lo que
 * había que hacer. Vive en Administración → Actividades.
 *
 * TODO VA ENCERRADO BAJO `#ta`. Los nombres que usa —panel, marco, bar, slot,
 * lane— son los que uno elegiría en cualquier pantalla, así que sueltos
 * chocarían con los del tablero. Encerrados no tocan nada, y nada los toca.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC`, y quien lo
 * monta —dashboard_v28.js— se encarga de buscarlo. Es el mismo reparto que ya
 * tienen marcas.js y picking_piso.js: el que dibuja no sale a buscar datos.
 *
 *   OPC.estado      lo guardado del turno: actividades, horarios, metas a mano
 *   OPC.fuentes     los números que llegan solos, por actividad
 *   OPC.alGuardar   se llama con el estado cada vez que algo cambia
 *
 * DE DÓNDE SALE CADA NÚMERO — verificado contra el servidor el 11-ago-2026:
 *
 *   Almacenamiento     reporte Marcas: BUFFER es la meta, TOTAL el avance
 *   Bajada de paletas  área buffer_history: paletasSolicitadas y paletasCompletas
 *   Separación         del mismo registro: unidadesASeparar y unidadesSeparadas
 *   Limpieza Buffer C  la foto del robot de las 19:00 contra la que se cargue
 *                      acá, CÓDIGO POR CÓDIGO: restar totales no sirve, la noche
 *                      del 10-ago el Buffer C cerró con MÁS de lo que empezó
 *   Slotting y BPA     a mano, no hay fuente
 */

const CSS = "#ta {\n  color-scheme: var(--scheme);\n    --bg: var(--panel-deeper);\n    --panel: var(--panel-alt);\n    --panel-2: rgba(var(--ink-rgb), 0.07);\n    --line: rgba(var(--ink-rgb), 0.16);\n    --line-2: rgba(var(--ink-rgb), 0.34);\n    --text: var(--blue-pale);\n    --text-2: var(--text-muted);\n    --text-3: var(--text-dim);\n    --accent: var(--brand-light);\n    --accent-soft: var(--panel-deep);\n    --ok: var(--success);\n    --ok-soft: rgba(var(--success-rgb), 0.18);\n    --warn: var(--warning);\n    --warn-soft: rgba(var(--warning-rgb), 0.18);\n    --bad: var(--danger);\n    --bad-soft: rgba(var(--danger-rgb), 0.18);\n    --plan-line: var(--text-faint);\n    --now: var(--danger-soft);\n    --on-ok: var(--success-dark); --on-warn: var(--warning-pale); --on-bad: var(--danger-deeper);\n    --neon: var(--cyan-neon); --neon-glow: 0 0 14px rgba(var(--cyan-neon-rgb), .16);\n    --shadow: none;\n    /* LAS DOS TIPOGRAFIAS. Se usaban 16 veces sin definirlas en ningun lado: el\n       navegador tiraba esa linea y las cifras salian con la fuente heredada, no con\n       la de tabla. `--ui` es la del tema; `--mono` no existe en la plataforma y se\n       arma aca, que es el unico sitio que la pide -numeros alineados en columna-. */\n    --ui: var(--font-ui);\n    --mono: ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;\n  }\n\n  /* Sin esto la caja punteada del plan de la última actividad se pasa 2 px del\n     carril: el borde se suma al ancho y la barra termina fuera del turno. */\n  #ta *, #ta *::before, #ta *::after { box-sizing: border-box; }\n\n  #ta { background: var(--bg); color: var(--text); font-family: var(--ui); font-size:var(--t-md); line-height: 1.6; }\n\n  #ta .page { max-width: 1180px; margin: 0 auto; padding: 28px 22px 64px; display: flex; flex-direction: column; gap: 18px; }\n\n  #ta .eyebrow { font-family: var(--mono); font-size:var(--t-xs); letter-spacing: .09em; text-transform: uppercase; color: var(--text-3); }\n  #ta h1 { font-size:var(--t-xl); font-weight: 500; margin: 2px 0 4px; letter-spacing: -.01em; text-wrap: balance; }\n  #ta h2 { font-size:var(--t-lg); font-weight: 500; margin: 0; letter-spacing: -.005em; }\n  #ta .lead { color: var(--text-2); font-size:var(--t-sm); margin: 0; max-width: 68ch; }\n\n  #ta .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px 20px; box-shadow: var(--shadow); }\n  #ta .phead { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }\n  #ta .fh { font-family: var(--mono); font-size:var(--t-sm); color: var(--text-3); }\n  .cal { font-size:var(--t-sm); padding: 3px 7px; color: var(--text-2); }\n  /* Marco de adentro: encierra lo que se MIRA —título, cuadro y leyenda— y deja\n     fuera la tabla, que es donde se ESCRIBE. */\n  #ta .marco { border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px 18px; }\n  /* Cian neón, el mismo que usa el reporte de Marcas en el tablero. En claro se\n     baja a un cian oscuro, porque el neón sobre blanco no se lee. */\n  #ta .neon { border-color: var(--neon); box-shadow: var(--neon-glow); }\n  #ta .marco .phead { margin-bottom: 14px; }\n\n  /* ── controles ───────────────────────────────────────────────────────── */\n  #ta input, #ta button { font-family: var(--mono); font-size:var(--t-sm); color: var(--text); background: var(--panel-2); border: 1px solid var(--line); border-radius: 7px; padding: 6px 9px; }\n  #ta input[type=\"text\"] { font-family: var(--ui); }\n  #ta input:hover { border-color: var(--line-2); }\n  #ta input:focus-visible, #ta button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }\n  #ta button { cursor: pointer; }\n  #ta button:hover { border-color: var(--line-2); }\n  #ta .btn-a { background: var(--accent-soft); border-color: transparent; color: var(--accent); }\n\n  /* ── gantt ───────────────────────────────────────────────────────────── */\n  /* La barra de desplazamiento, con los colores del tema. Firefox entiende\n     `scrollbar-color`; Chrome y Edge necesitan las pseudo-clases de abajo. */\n  #ta .gwrap, #ta .twrap { overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }\n  #ta .gwrap::-webkit-scrollbar, #ta .twrap::-webkit-scrollbar { height: 11px; width: 11px; }\n  #ta .gwrap::-webkit-scrollbar-track, #ta .twrap::-webkit-scrollbar-track { background: transparent; }\n  #ta .gwrap::-webkit-scrollbar-thumb, #ta .twrap::-webkit-scrollbar-thumb {\n    background: var(--line-2); border-radius: 7px; border: 3px solid var(--panel); background-clip: padding-box;\n  }\n  #ta .gwrap::-webkit-scrollbar-thumb:hover, #ta .twrap::-webkit-scrollbar-thumb:hover { background: var(--text-3); background-clip: padding-box; }\n  #ta .gwrap::-webkit-scrollbar-corner, #ta .twrap::-webkit-scrollbar-corner { background: transparent; }\n\n\n  /* SIN `min-width`: el ancho mínimo era lo que sacaba la barra de\n     desplazamiento cuando el cuadro entraba en un panel angosto. La rejilla es\n     186 px para el nombre y el resto para el turno, así que entra en cualquier\n     ancho; si queda muy angosto, el eje rotula las horas de dos en dos.\n     Los 186 px alcanzan porque la etiqueta \"auto\" ya no va acá. */\n  #ta .gg { display: grid; grid-template-columns: 186px 1fr; align-items: center; }\n  #ta .gnm { font-size:var(--t-sm); color: var(--text-2); padding: 0 12px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n  #ta .axis { position: relative; height: 20px; border-bottom: 1px solid var(--line); margin-bottom: 10px; }\n  #ta .tick { position: absolute; top: 0; font-family: var(--mono); font-size:var(--t-xs); color: var(--text-3); transform: translateX(-50%); }\n  /* Con el turno terminado, la línea de \"ahora\" cae en el 100% y su píxel de\n     borde asomaba fuera del carril: un solo píxel, pero alcanzaba para sacar\n     barra de desplazamiento en las siete filas. Todo lo que va adentro del\n     carril —barras, guías, la línea de ahora— se recorta en su borde. */\n  #ta .lane { position: relative; height: 34px; overflow: hidden; }\n  #ta .vl { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--line); }\n  #ta .bar { position: absolute; border-radius: 4px; }\n  #ta .plan { border: 1px dashed var(--plan-line); border-radius: 4px; top: 5px; height: 24px; }\n  #ta .now { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed var(--now); z-index: 3; }\n  /* `overflow:hidden` es el cinturón: aunque la etiqueta de la hora quede a un\n     pelo del borde, no puede empujar el ancho del cuadro ni sacar barra. */\n  #ta .foot { position: relative; height: 20px; overflow: hidden; }\n  #ta .nowtag { position: absolute; top: 2px; font-family: var(--mono); font-size:var(--t-xs); color: var(--now); transform: translateX(-50%); white-space: nowrap; }\n  #ta .endline { position: absolute; top: 0; bottom: 0; right: 0; width: 1px; background: var(--line-2); }\n\n  #ta .leg { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size:var(--t-sm); color: var(--text-2); margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }\n  #ta .sw { display: inline-block; width: 22px; height: 9px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; }\n\n  /* ── anillos ─────────────────────────────────────────────────────────── */\n  #ta .rings { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 12px; margin-bottom: 20px; }\n  #ta .rcard { background: var(--panel-2); border-radius: 10px; padding: 14px 10px 12px; text-align: center; }\n  #ta .ring { width: 82px; height: 82px; border-radius: 50%; margin: 0 auto 9px; display: flex; align-items: center; justify-content: center; }\n  #ta .hole { width: 62px; height: 62px; border-radius: 50%; background: var(--panel); /* OPACO a proposito: es lo que le hace el agujero a la dona. Con un color translucido se transparenta el relleno del anillo por debajo y el porcentaje del centro, que va del mismo color que el arco, desaparece. */ display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size:var(--t-lg); }\n  #ta .rn { font-size:var(--t-sm); margin-bottom: 3px; line-height: 1.35; }\n  #ta .rq { font-family: var(--mono); font-size:var(--t-xs); color: var(--text-3); line-height: 1.5; }\n\n  /* ── tablas ──────────────────────────────────────────────────────────── */\n  #ta table { border-collapse: collapse; width: 100%; min-width: 640px; }\n  /* Solo la columna de la actividad va pegada a la izquierda. Todo lo demás va\n     centrado, encabezado y celda con la misma regla: antes el encabezado tiraba\n     a la derecha y la celda a la izquierda, y las columnas salían descuadradas. */\n  #ta th { font-family: var(--mono); font-weight: 400; font-size:var(--t-xs); letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); padding: 0 8px 8px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }\n  #ta th.l { text-align: left; }\n  #ta td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: center; font-family: var(--mono); font-size:var(--t-sm); font-variant-numeric: tabular-nums; }\n  #ta td.fijo { color: var(--text-2); }\n  #ta td.l { text-align: left; font-family: var(--ui); color: var(--text-2); }\n  #ta td.u input[type=\"text\"] { text-align: center; }\n  #ta tr:last-child td { border-bottom: none; }\n  #ta td input[type=\"number\"] { width: 88px; text-align: right; }\n  #ta td input[type=\"time\"] { width: 104px; }\n  #ta td input[type=\"text\"] { width: 100%; min-width: 130px; }\n  #ta td.u input[type=\"text\"] { width: 100px; min-width: 0; }\n  /* Marca las actividades cuyos números NO se escriben a mano: llegan solos. */\n  #ta .auto { font-family: var(--mono); font-size:var(--t-xs); text-transform: uppercase; letter-spacing: .07em;\n          background: var(--accent-soft); color: var(--accent); padding: 2px 7px; border-radius: 10px;\n          margin-left: 7px; vertical-align: 1px; white-space: nowrap; }\n  #ta .chip { display: inline-block; font-family: var(--ui); font-size:var(--t-xs); padding: 2px 9px; border-radius: 20px; white-space: nowrap; }\n  /* EL CANDADO DE LA META: SOLO EL DIBUJO. Sin fondo, sin borde y sin texto al lado\n     -regla de la casa desde la v29.0404, la misma que sigue `.btn-icono`-. Lo que hace\n     se lee al pasar el mouse; por eso el `title` no es opcional.\n     Cerrado se pinta del color de acento: es lo unico que distingue los dos estados. */\n  #ta .cand { margin-left: auto; padding: 4px; background: none; border: 1px solid transparent;\n              color: var(--text-3); line-height: 0; }\n  #ta .cand:hover { color: var(--text); }\n  #ta .cand.fija { color: var(--accent); }\n  #ta .cand[disabled] { cursor: default; opacity: .5; }\n\n  #ta .del { padding: 3px 8px; font-size:var(--t-sm); color: var(--text-3); background: transparent; border-color: transparent; }\n  #ta .del:hover { color: var(--bad); border-color: var(--line); }\n\n\n  /* ── carga de stock ──────────────────────────────────────────────────── */\n  #ta .slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }\n  #ta .slot { background: var(--panel-2); border-radius: 10px; padding: 12px 14px; }\n  #ta .slab { display: block; font-size:var(--t-sm); color: var(--text-2); margin-bottom: 8px; }\n  #ta .slot input[type=\"file\"] { width: 100%; font-size:var(--t-sm); padding: 5px; }\n  #ta .slot input[type=\"file\"]::file-selector-button { font-family: var(--mono); font-size:var(--t-sm); color: var(--accent);\n    background: var(--accent-soft); border: none; border-radius: 6px; padding: 5px 11px; margin-right: 10px; cursor: pointer; }\n  /* Arranca vacío: el propio campo ya dice \"Ningún archivo seleccionado\" y\n     repetirlo abajo con un \"sin cargar\" era decir dos veces lo mismo. */\n  #ta .sinfo { font-family: var(--mono); font-size:var(--t-xs); color: var(--text-3); margin-top: 8px; line-height: 1.6; }\n  #ta .sinfo:empty { margin-top: 0; }\n  #ta .sinfo b { color: var(--text-2); font-weight: 400; }\n\n\n  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }";

const HTML = "<div class=\"page\">\n\n\n  <section class=\"panel\">\n    <div>\n      <div class=\"slots\">\n        <div class=\"slot\">\n          <span class=\"slab\">Stock <b>activo</b> de ahora</span>\n          <input type=\"file\" data-slot=\"now-activo\" accept=\".csv,text/csv\">\n          <div class=\"sinfo\" data-info=\"now-activo\"></div>\n        </div>\n        <div class=\"slot\">\n          <span class=\"slab\">Stock <b>reserva</b> de ahora</span>\n          <input type=\"file\" data-slot=\"now-reserva\" accept=\".xlsx,.csv\">\n          <div class=\"sinfo\" data-info=\"now-reserva\"></div>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"panel neon\">\n    <!-- El cuadro va en su propio marco, del título a la leyenda. La tabla de\n         abajo queda fuera: es para escribir, no para mirar. -->\n    <div class=\"marco neon\">\n      <div class=\"phead\"><h2>Gantt de actividades</h2><input type=\"date\" class=\"cal\" id=\"ta_g_dia\" title=\"Ver otra jornada\"><span class=\"fh\" id=\"ta_g_fh\"></span></div>\n      <div class=\"gwrap\"><div class=\"gg\" id=\"ta_gg\"></div></div>\n      <div class=\"leg\">\n        <span><span class=\"sw\" style=\"border:1px dashed var(--plan-line); height:8px\"></span>Lo que debía hacerse</span>\n        <span><span class=\"sw\" style=\"background:var(--ok)\"></span>Hecho</span>\n        <span><span class=\"sw\" style=\"background:var(--warn)\"></span>Se pasó del plan</span>\n        <span><span class=\"sw\" style=\"background:var(--accent)\"></span>En curso</span>\n        <span><span style=\"display:inline-block;width:0;border-left:1px dashed var(--now);height:12px;vertical-align:-2px;margin-right:8px\"></span>Ahora</span>\n      </div>\n    </div>\n\n    <div class=\"twrap\" style=\"margin-top:22px\">\n      <table id=\"ta_t_hor\">\n        <thead><tr>\n          <th class=\"l\">Actividad</th><th>Plan · empieza</th><th>Plan · termina</th>\n          <th>Real · empezó</th><th>Real · terminó</th><th>Desvío</th>\n          <th title=\"Marcada, la actividad entra al Cumplimiento del turno\">¿Tiene meta?</th><th></th>\n        </tr></thead>\n        <tbody></tbody>\n      </table>\n    </div>\n    <div style=\"margin-top:12px\"><button class=\"btn-a\" id=\"ta_b_add\">+ Agregar actividad</button></div>\n  </section>\n\n  <section class=\"panel neon\">\n    <div class=\"phead\"><h2>Cumplimiento del turno</h2><input type=\"date\" class=\"cal\" id=\"ta_c_dia\" title=\"Ver otra jornada\"><span class=\"fh\" id=\"ta_c_fh\"></span><button class=\"cand\" id=\"ta_cand\"></button></div>\n    <div class=\"rings\" id=\"ta_rings\"></div>\n    <div class=\"twrap\">\n      <table id=\"ta_t_cum\">\n        <thead><tr>\n          <th class=\"l\">Actividad</th><th>Unidad</th><th>Meta</th><th>Avance</th>\n          <th>Falta</th><th>A esta hora</th><th>%</th><th>Estado</th><th></th>\n        </tr></thead>\n        <tbody></tbody>\n      </table>\n    </div>\n    <div style=\"margin-top:12px\"><button class=\"btn-a\" id=\"ta_b_add2\">+ Agregar actividad</button></div>\n  </section>\n\n</div>";

/** Dibuja el reporte dentro de `raiz` y avisa por `OPC.alGuardar` cuando algo cambia. */
import { icono } from '../services_v245/iconos.js?v=29.0533';

export const montarTurno = function (RAIZ, OPC) {
  OPC = OPC || {};

  /* ── LOS ESCUCHADORES SE LIMPIAN ANTES DE VOLVER A ENGANCHARLOS ──────────
   *
   * Este módulo cuelga cuatro escuchadores de RAIZ —click, change, input y otro
   * click— y RAIZ NO SE REEMPLAZA entre montajes: quien monta solo le cambia el
   * contenido. Así que cada vez que se remontaba quedaban cuatro más encima de los
   * de antes.
   *
   * Con dos montajes, cambiar la fecha llamaba DOS veces a `alCambiarFecha`, o sea
   * dos remontajes, que dejaban cuatro escuchadores más cada uno... y a la vuelta
   * siguiente cuatro llamadas, y ocho. La pantalla se veía temblar: aparecía con
   * datos, volvía al cargador, aparecía otra vez.
   *
   * Lo reportó Daniel el 12-ago-2026: *"me aparece un gráfico con data, y de ahí se
   * reversa, y de ahí vuelve a actualizarse; está que se mueve a cada rato"*. Se
   * notó ahora porque el cálculo se hizo más lento —lee las fotos del cierre— y el
   * ida y vuelta pasó a durar lo suficiente para verse.
   *
   * No alcanza con `RAIZ.innerHTML = ''`: eso se lleva a los hijos, no a lo que está
   * enganchado en RAIZ. */
  if (RAIZ.__taEscuchas) {
    RAIZ.__taEscuchas.forEach(function (e) { RAIZ.removeEventListener(e[0], e[1]); });
  }
  RAIZ.__taEscuchas = [];
  var escuchar = function (tipo, fn) {
    RAIZ.addEventListener(tipo, fn);
    RAIZ.__taEscuchas.push([tipo, fn]);
  };
  if (!document.getElementById('ta_estilos')) {
    var hoja = document.createElement('style');
    hoja.id = 'ta_estilos';
    hoja.textContent = CSS;
    document.head.appendChild(hoja);
  }
  RAIZ.id = 'ta';
  RAIZ.innerHTML = HTML;

  /* HORARIO FIJO DEL TURNO — el que dictó Daniel el 11-ago-2026.
     El plan no cambia de un día para otro: se configura una vez. Lo que cambia
     cada noche es la hora real y el avance. Por eso arrancan iguales.

     `cuenta` separa las dos cosas: TODA actividad sale en el Gantt, pero solo
     las que tienen `cuenta: true` entran al Cumplimiento. La Charla de
     seguridad ocupa su rato del turno y hay que verla en el Gantt, pero no es
     una meta —no se mide en cantidades— así que no entra a los cuadros. */
  var BASE = {
    /* UN TURNO NUEVO ARRANCA TODO EN CERO. Regla de Daniel, 20-ago-2026: *"cuando
       el turno cierre deberían todas las metas y avances estar en 0"*. Slotting
       traía `meta: 60, av: 45` escritos acá desde la maqueta, así que cada jornada
       nueva nacía con 45 de 60 hechos sin que nadie hubiera trabajado. Las metas y
       los avances los ponen las fuentes o los escribe él; la plantilla NO.

       EL TURNO NO SE CONFIGURA ACÁ. Sale de la jornada que ya está en el
       servidor —área `config`, clave `jornada`, que lee `jornadaService`—, donde
       hay un horario por cada día de la semana y reglas que lo pisan por
       temporada. Estos son los valores que tiene hoy el turno noche:
       `nocheEntrada` 19:00 y `nocheSalida` 06:30. */
    ini: '19:00', fin: '06:30', ahora: '06:30',
    procs: [
      { n: 'Charla de seguridad',  u: '',            meta: 0,     av: 0,     pi: '20:15', pf: '20:30', ri: '20:15', rf: '20:30', cuenta: false },
      /* AUTOMÁTICA. Los dos números salen solos del reporte Almacenaje → Marcas
         (`datosMarcas` en js/reportes/marcas.js): la meta es la columna BUFFER
         —lo que dejó por almacenar la corrida de olas— y el avance es la columna
         TOTAL —día + noche de las tareas que se van finalizando—. Los de acá son
         los del corte del 10-ago-2026 que dio Daniel: 32.994 y 18.195. */
      { n: 'Almacenamiento',       u: 'pares',       meta: 0,     av: 0,     fuente: 'almacenamiento', pi: '20:30', pf: '05:45', ri: '20:30', rf: '05:45', cuenta: true, auto: true },
      { n: 'Slotting',             u: 'tareas',      meta: 0,     av: 0,     pi: '20:30', pf: '06:00', ri: '20:30', rf: '06:00', cuenta: true },
      /* AUTOMÁTICA, comparando dos fotos del stock activo. Meta = los pares que
         tenía CDBUFFER-C a las 19:00; avance = los de esa foto que ya no están
         a las 06:00. Los de acá son los reales de la noche del 10 al 11-ago:
         1.759 en 133 ubicaciones, de los que se movieron 869. NO sirve restar
         los totales: a las 06:00 había 1.820 —más que al empezar— porque entraron
         930 pares nuevos durante la noche. */
      { n: 'Limpieza de Buffer C', u: 'pares',       meta: 0,     av: 0,       pi: '20:30', pf: '22:00', ri: '20:30', rf: '22:00', cuenta: true, auto: true, fuente: 'bufferC' },
      /* AUTOMÁTICA. Sale del área `buffer_history` del servidor, que ya guarda
         `paletasSolicitadas` (meta), `paletasBajadas` (avance), `diferencias` y
         `fillRate`. Estos son los del registro real del 10-ago-2026: 124 y 124.
         OJO: `paletasBajadas` suma las INCOMPLETAS como bajadas, así que da 100%
         casi siempre —11 de las últimas 12 corridas—. Si el avance debe ser solo
         las completas, hay que guardar ese número aparte. */
      { n: 'Bajada de paletas',    u: 'paletas',     meta: 0,     av: 0,     fuente: 'paletas',   pi: '00:00', pf: '03:00', ri: '00:00', rf: '03:00', cuenta: true, auto: true },
      /* Es el análisis del buffer. LA META son las unidades que hay que bajar
         para cubrir el pedido: la suma de `plannedQty` por código —los 2.496 que
         Daniel leyó en Análisis Buffer SKU—. No es lo que pide el pedido entero,
         es lo que FALTA: si piden 100 y en el buffer ya hay 20, la meta son 80.

         EL AVANCE sale de la foto del stock de las 06:00, código por código:
             avance = Σ min( lo que había que bajar , lo que hay en el buffer )
         El tope es la regla de Daniel: bajar 100 cuando pedían 80 cuenta 80, no
         100. Y cuenta CUALQUIER buffer —A, B, C o D—, no solo los de almacenaje.
         Funciona porque lo que ya estaba se almacena durante el turno para hacer
         sitio, así que a las 06:00 el buffer tiene lo que se bajó esa noche.

         Para esto hace falta guardar la LISTA de códigos del pedido, no solo el
         total: el 2.496 suelto no sirve, la cuenta es código por código.
         El horario 03:00 → 05:45 lo puse yo: es el hueco entre las paletas y BPA. */
      { n: 'Separación de mercadería', u: 'unidades', meta: 0,    av: 0,     fuente: 'separacion',    pi: '03:00', pf: '05:45', ri: '',      rf: '',      cuenta: true, auto: true },
      /* MANUAL por decisión de Daniel. La unidad y la meta siguen siendo
         suposiciones mías, pendientes de confirmar. */
      { n: 'BPA',                  u: '',            meta: 0,     av: 0,     pi: '05:45', pf: '06:20', ri: '05:45', rf: '06:20', cuenta: false }
    ]
  };

  /* EL ESTADO VIENE DE AFUERA Y VUELVE AFUERA.
     Lo trae quien monta el módulo —que lo lee del servidor— y cada cambio se le
     devuelve. Antes vivía en el navegador de cada PC, y eso significaba que cada
     computadora veía sus propias actividades: el mismo enredo que ya se había
     resuelto con el stock. */
  var S = normalizar(OPC.estado);
  if (OPC.fecha) S.dia = OPC.fecha;
  function normalizar(g) {
    if (!g || !g.procs || !g.procs.length) g = JSON.parse(JSON.stringify(BASE));
    /* Un campo nuevo no puede llegar vacío a lo que ya estaba guardado: se
       rellena con el valor de fábrica, nunca con vacío. */
    g.procs.forEach(function (p) { if (p.cuenta === undefined) p.cuenta = true; });
    if (!g.ini) g.ini = BASE.ini;
    if (!g.fin) g.fin = BASE.fin;
    /* UNA JORNADA SIN META NACE ABIERTA. Si todavía no hay ningún número, no hay nada
       que proteger y sí hay algo que ganar: que siga a la última corrida. */
    if (g.metaFija === undefined && !g.procs.some(function (p) { return p.meta > 0; })) {
      g.metaFija = false;
    }
    return g;
  }
  function guardar() { if (typeof OPC.alGuardar === 'function') OPC.alGuardar(S); }

  /* El navegador ofrece lo que ya se escribió en campos parecidos y lo pinta
     ENCIMA de la celda: en la columna Unidad se veían letras sueltas de otra
     cosa. Estos campos no son un formulario que valga la pena recordar. */
  var SIN_AYUDA = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';

  var $ = function (s) { return RAIZ.querySelector(s); };
  var nf = function (n) { return Number(n || 0).toLocaleString('es-PE'); };
  var mm = function (t) {
    var p = String(t || '').split(':');
    var h = Number(p[0]), m = Number(p[1]);
    return (isFinite(h) && isFinite(m) && p.length === 2) ? h * 60 + m : null;
  };
  var reloj = function (v) {
    v = ((v % 1440) + 1440) % 1440;
    return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  };

  var INI = 1200, SPAN = 630, AHORA = 550;

  /* Minutos desde que empieza el turno. Un turno de noche cruza la medianoche,
     así que toda hora menor que la de entrada pertenece al día siguiente. */
  function off(t) {
    var v = mm(t); if (v === null) return null;
    return (v < INI ? v + 1440 : v) - INI;
  }
  function pc(v) { return (v / SPAN * 100) + '%'; }

  function recalcularTurno() {
    INI = mm(S.ini); if (INI === null) INI = 1200;
    var fin = mm(S.fin); if (fin === null) fin = INI + 600;
    SPAN = (fin < INI ? fin + 1440 : fin) - INI;
    if (SPAN <= 0) SPAN = 60;
    AHORA = off(S.ahora); if (AHORA === null) AHORA = 0;
    AHORA = Math.max(0, Math.min(SPAN, AHORA));
  }

  /* Todo lo derivado de una actividad: horario, desvío, esperado y estado. */
  function calcular(p) {
    var pi = off(p.pi), pf = off(p.pf), ri = off(p.ri), rf = off(p.rf);
    if (pi !== null && pf !== null && pf < pi) pf += 1440;
    if (ri !== null && rf !== null && rf < ri) rf += 1440;

    /* UNA ACTIVIDAD NO PUEDE HABER TERMINADO EN EL FUTURO.
       Si no tiene hora de fin, o si la que tiene todavia no llego, esta EN CURSO:
       la barra corre hasta ahora y sale en morado. Daniel puso las horas de
       arranque y el fin quedo en 00:00 sin que el lo tocara; sin esta regla el
       cuadro mostraba barras verdes hasta la medianoche a las 20:42, o sea
       trabajo dado por hecho tres horas antes de que ocurriera. */
    var enCurso = ri !== null && (rf === null || rf > AHORA);
    var rFin = enCurso ? Math.max(ri, AHORA) : rf;

    var meta = Number(p.meta) || 0, av = Number(p.av) || 0;
    var esperado = 0;
    if (pi !== null && pf !== null && pf > pi) {
      var r = (AHORA - pi) / (pf - pi);
      esperado = meta * Math.max(0, Math.min(1, r));
    }
    esperado = Math.round(esperado);

    /* TRES ESTADOS, los que pidió Daniel:
     *
     *     ATENDIDO      llegó a la meta
     *     PENDIENTE     avanzó algo pero todavía le falta
     *     NO ATENDIDO   no se hizo nada
     *
     * Es la MISMA regla que pinta el anillo, a propósito: antes el estado miraba
     * además si a esta altura del turno ya debería llevar más, y podía decir "Al
     * día" mientras el anillo salía amarillo. Dos cuadros del mismo renglón
     * diciendo cosas distintas.
     *
     * Sin meta puesta no hay estado que dar: va un guion en gris. Poner
     * NO ATENDIDO ahí sería culpar al turno de algo que nadie definió todavía. */
    var est, tono;
    if (!meta)           { est = '—';           tono = 'off';  }
    else if (av >= meta) { est = 'ATENDIDO';    tono = 'ok';   }
    else if (av > 0)     { est = 'PENDIENTE';   tono = 'warn'; }
    else                 { est = 'NO ATENDIDO'; tono = 'bad';  }

    var desvio = null, desvTxt = '—';
    /* El desvio del final solo vale si la actividad TERMINO. En curso, lo unico
       que se puede medir es cuanto se corrio el arranque. */
    if (!enCurso && rf !== null && pf !== null) { desvio = rf - pf; desvTxt = (desvio > 0 ? '+' : '') + desvio + ' min'; }
    else if (enCurso && pi !== null) { desvio = ri - pi; desvTxt = 'arrancó ' + (desvio > 0 ? '+' : '') + desvio + ' min'; }

    return {
      pi: pi, pf: pf, ri: ri, rf: rFin, enCurso: enCurso,
      meta: meta, av: av, esperado: esperado,
      /* SIN META NO HAY PORCENTAJE, y va null y no 0.
         El 12-ago-2026 la Bajada de paletas mostraba "109 de 0" y al lado un 0%:
         bajaron 109 paletas de verdad, medidas contra el stock, y el cuadro decía
         que no se había hecho nada. Lo que falta es la meta —sale del análisis del
         buffer— y eso hay que decirlo, no disfrazarlo de cero. */
      pct: meta > 0 ? Math.round(100 * av / meta) : null,
      falta: Math.max(0, meta - av),
      est: est, tono: tono, desvio: desvio, desvTxt: desvTxt
    };
  }

  var COLOR = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', off: 'var(--text-3)' };
  var FONDO = { ok: 'var(--ok-soft)', warn: 'var(--warn-soft)', bad: 'var(--bad-soft)', off: 'var(--panel-2)' };

  /* ── El Gantt ─────────────────────────────────────────────────────────── */
  function pintarGantt() {
    var lane = RAIZ.querySelector('.gg .axis');
    var ancho = lane ? lane.getBoundingClientRect().width : 900;
    if (!ancho) ancho = 900;

    /* Cada cuánto se rotula el eje: si las horas quedan a menos de 58 px, se
       saltea de dos en dos. Es lo que hacía que 06:00 se montara sobre el fin
       del turno cuando la pantalla es angosta. */
    var horas = SPAN / 60;
    var paso = 1;
    while (ancho / (horas / paso) < 58) paso++;

    var eje = '', guias = '', t;
    for (t = 0; t <= SPAN; t += 60) {
      var etiqueta = (t / 60) % paso === 0 && (SPAN - t) > 30;
      if (t > 0) guias += '<span class="vl" style="left:' + pc(t) + '"></span>';
      if (etiqueta) eje += '<span class="tick" style="left:' + pc(t) + '">' + reloj(INI + t) + '</span>';
    }

    var filas = S.procs.map(function (p) {
      var c = calcular(p), b = '';
      if (c.pi !== null && c.pf !== null) {
        b += '<span class="bar plan" style="left:' + pc(c.pi) + '; width:' + pc(c.pf - c.pi) + '"></span>';
      }
      if (c.ri !== null && c.rf !== null) {
        var color = c.enCurso ? 'var(--accent)' : 'var(--ok)';
        var corte = c.pf !== null ? Math.min(c.rf, c.pf) : c.rf;
        if (corte > c.ri) b += '<span class="bar" style="left:' + pc(c.ri) + '; width:' + pc(corte - c.ri) + '; top:12px; height:11px; background:' + color + '"></span>';
        if (c.rf > corte) {
          var d = Math.max(corte, c.ri);
          b += '<span class="bar" style="left:' + pc(d) + '; width:' + pc(c.rf - d) + '; top:12px; height:11px; background:var(--warn)"></span>';
        }
      }
      return '<div class="gnm">' + esc(p.n) + '</div><div class="lane">' + guias + b +
        '<span class="now" style="left:' + pc(AHORA) + '"></span><span class="endline"></span></div>';
    }).join('');

    $('#ta_gg').innerHTML =
      '<div></div><div class="axis">' + eje + '<span class="endline"></span></div>' + filas +
      /* La etiqueta va centrada bajo su línea, salvo cuando la línea está pegada
         a un extremo: ahí se apoya contra el borde. Centrada al 100% se salía 35
         px del cuadro y sacaba barra de desplazamiento. */
      '<div></div><div class="foot"><span class="nowtag" style="left:' + pc(AHORA) +
      '; transform:translateX(' + (AHORA / SPAN > 0.92 ? '-100%' : (AHORA / SPAN < 0.08 ? '0' : '-50%')) + ')">' +
      'ahora ' + esc(S.ahora) + '</span></div>';
    pintarFechaHora();
  }

  /* ── Anillos y tabla de cumplimiento ──────────────────────────────────── */
  /* Las que tienen meta, con el índice que ocupan en la lista completa: los
     campos editables lo necesitan para no escribir en la actividad equivocada. */
  function conMeta() {
    var r = [];
    S.procs.forEach(function (p, i) { if (p.cuenta) r.push({ p: p, i: i }); });
    return r;
  }

  /* EL CALENDARIO DE CADA CUADRO.
     Los dos van sincronizados a propósito: son dos vistas del MISMO turno, y
     verlos con fechas distintas se leería como un error del reporte. Se toca
     uno y los dos se mueven. */
  function fechaElegida() { return S.dia || hoyISO(); }
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function pintarCalendario() {
    var v = fechaElegida();
    ['#ta_g_dia', '#ta_c_dia'].forEach(function (sel) {
      var i = $(sel);
      if (i && i.value !== v) i.value = v;
    });
  }

  /* LA FECHA Y LA HORA, al lado de cada título. Sale del reloj, o de la foto de
     stock si se cargó una: así los dos cuadros dicen SIEMPRE el mismo momento y
     no hay forma de mirar uno creyendo que es de otra hora. */
  function fechaHora() {
    var d = new Date();
    var f = S.fecha || (String(d.getDate()).padStart(2, '0') + '/' +
                        String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear());
    return f + ' · ' + S.ahora;
  }
  function pintarFechaHora() {
    pintarCalendario();
    var t = fechaHora();
    var a = $('#ta_g_fh'), b = $('#ta_c_fh');
    if (a) a.textContent = t;
    if (b) b.textContent = t;
  }

  function pintarAnillos() {
    var anillos = '';
    conMeta().forEach(function (x) {
      var p = x.p;
      var c = calcular(p);
      /* El anillo vacío y un guion cuando todavía no hay meta: un 0% ahí diría que
         no se hizo nada, y abajo puede haber un avance medido de verdad. */
      var g = c.pct === null ? 0 : Math.max(0, Math.min(100, c.pct));
      anillos += '<div class="rcard">' +
        '<div class="ring" style="background:conic-gradient(' + COLOR[c.tono] + ' 0 ' + g + '%, var(--line) ' + g + '% 100%)">' +
        '<div class="hole" style="color:' + COLOR[c.tono] + '">' + (c.pct === null ? '—' : c.pct + '%') + '</div></div>' +
        '<div class="rn">' + rotulo(p) + '</div>' +
        '<div class="rq">' + nf(c.av) + (c.meta ? ' de ' + nf(c.meta) : ' · <span style="opacity:.65">sin meta</span>') +
        '<br>' + esc(p.u || '') +
        /* Lo que salió del Buffer C y todavía no llegó a destino. Va al lado del
           avance y no adentro: no es avance, pero tampoco es cero trabajo. */
        (p.pend ? '<br><span style="color:var(--warning-soft); font-size:.92em;">+' + nf(p.pend) +
                  ' en LPN sin matricular</span>' : '') +
        '</div></div>';
    });
    $('#ta_rings').innerHTML = anillos;
  }

  /* Las cuatro celdas CALCULADAS de la fila —falta, lo esperado, el % y el
     estado—. Se arman acá una sola vez para que el dibujado completo y el
     refresco al escribir no puedan separarse. */
  function celdasCalculadas(c) {
    return [
      { html: c.falta ? nf(c.falta) : '—', color: c.falta ? 'var(--text-2)' : 'var(--text-3)' },
      { html: nf(c.esperado), color: 'var(--text-3)' },
      { html: c.pct === null ? '—' : c.pct + '%', color: COLOR[c.tono] },
      { html: '<span class="chip" style="background:' + FONDO[c.tono] + '; color:' + COLOR[c.tono] + '">' + c.est + '</span>', color: '' }
    ];
  }

  function pintarTablaCum() {
    var cuerpo = $('#ta_t_cum').tBodies[0];
    cuerpo.innerHTML = conMeta().map(function (x) {
      var p = x.p, i = x.i, c = calcular(p);
      return '<tr data-i="' + i + '">' +
        /* SIN la etiqueta "auto" acá. No entra: la celda ya la ocupa el campo del
           nombre, y la etiqueta asomaba cortada sobre la columna Unidad —se veía
           una "A" suelta y ensuciaba el cuadro—. La marca sigue estando donde sí
           hay sitio: en los anillos de arriba y en el Gantt. */
        '<td class="l"><input type="text" ' + SIN_AYUDA + ' data-t="c" data-k="n" data-i="' + i + '" value="' + esc(p.n) + '" style="min-width:118px"></td>' +
        '<td class="u"><input type="text" ' + SIN_AYUDA + ' data-t="c" data-k="u" data-i="' + i + '" value="' + esc(p.u || '') + '"></td>' +
        /* META Y AVANCE SIEMPRE SE PUEDEN ESCRIBIR, también en las automáticas.
           Lo que se escribe a mano MANDA: desde esa tecla la fuente deja de pisar
           ese número por el resto de la jornada. Sin esa marca el valor volvía en
           el siguiente dibujado y parecía que se borraba solo. Mañana, con otra
           jornada, la fuente vuelve a mandar sola. */
        '<td><input type="number" min="0" ' + SIN_AYUDA + ' data-t="c" data-k="meta" data-i="' + i + '" value="' + c.meta + '"></td>' +
        '<td><input type="number" min="0" ' + SIN_AYUDA + ' data-t="c" data-k="av" data-i="' + i + '" value="' + c.av + '"></td>' +
        celdasCalculadas(c).map(function (z) { return '<td style="color:' + z.color + '">' + z.html + '</td>'; }).join('') +
        '<td><button class="del" data-del="' + i + '" title="Quitar esta actividad">✕</button></td>' +
        '</tr>';
    }).join('');
    pintarFechaHora();
  }

  /* ── REFRESCO AL ESCRIBIR ────────────────────────────────────────────────
     Mientras se escribe NO se rehacen las tablas. Rehacerlas cambia el campo
     por otro nuevo y el cursor se va al principio: tecleando 2496 salía 6942.
     Acá solo se reescriben las celdas calculadas, que no son campos. */
  function refrescarCalculadas() {
    var f = $('#ta_t_cum').tBodies[0].rows, r, i, cc, k, td;
    for (r = 0; r < f.length; r++) {
      i = Number(f[r].getAttribute('data-i'));
      if (!S.procs[i]) continue;
      cc = celdasCalculadas(calcular(S.procs[i]));
      for (k = 0; k < cc.length; k++) {
        td = f[r].cells[4 + k];
        if (td) { td.innerHTML = cc[k].html; td.style.color = cc[k].color; }
      }
    }
    pintarFechaHora();

    f = $('#ta_t_hor').tBodies[0].rows;
    for (r = 0; r < f.length; r++) {
      i = Number(f[r].getAttribute('data-i'));
      if (!S.procs[i]) continue;
      var c = calcular(S.procs[i]);
      td = f[r].cells[5];
      if (td) {
        td.textContent = c.desvTxt;
        td.style.color = c.desvio === null ? 'var(--text-3)' : (c.desvio > 0 ? 'var(--warn)' : 'var(--ok)');
      }
    }
  }

  /* ── Tabla de horarios ────────────────────────────────────────────────── */
  function pintarHorarios() {
    /* El plan se escribe directo en la tabla. Antes estaba con candado y había un
       botón para abrirlo; se saco porque el candado no aportaba nada: si el
       horario hay que cambiarlo, se cambia. */
    var plan = function (k, i, v) {
      return '<input type="time" data-t="h" data-k="' + k + '" data-i="' + i + '" value="' + esc(v) + '">';
    };

    var cuerpo = $('#ta_t_hor').tBodies[0];
    cuerpo.innerHTML = S.procs.map(function (p, i) {
      var c = calcular(p);
      var col = c.desvio === null ? 'var(--text-3)' : (c.desvio > 0 ? 'var(--warn)' : 'var(--ok)');
      return '<tr data-i="' + i + '">' +
        '<td class="l"><input type="text" ' + SIN_AYUDA + ' data-t="h" data-k="n" data-i="' + i + '" value="' + esc(p.n) + '"></td>' +
        '<td>' + plan('pi', i, p.pi) + '</td>' +
        '<td>' + plan('pf', i, p.pf) + '</td>' +
        '<td><input type="time" data-t="h" data-k="ri" data-i="' + i + '" value="' + esc(p.ri) + '"></td>' +
        '<td><input type="time" data-t="h" data-k="rf" data-i="' + i + '" value="' + esc(p.rf) + '"></td>' +
        '<td style="color:' + col + '">' + c.desvTxt + '</td>' +
        '<td><input type="checkbox" data-t="h" data-k="cuenta" data-i="' + i + '"' + (p.cuenta ? ' checked' : '') +
        ' title="Marcada, entra al Cumplimiento del turno"></td>' +
        '<td><button class="del" data-del="' + i + '" title="Quitar esta actividad">✕</button></td>' +
        '</tr>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* El nombre, con la marca "auto" cuando los números no se escriben a mano
     sino que llegan del sistema. Hoy solo Almacenamiento. */
  function rotulo(p) { return esc(p.n); }

  /* ── EL STOCK SE LEE ACÁ, NO SE PUBLICA ───────────────────────────────────
     El archivo entra por el navegador, se calcula y se queda en esta pantalla.
     No hay ningún envío al servidor: no toca el stock del robot ni lo que ven
     las otras computadoras. Alimenta las DOS partes del reporte, porque al
     cargar la foto de ahora se mueve la hora actual de todo el tablero. */
  var STOCK = { 'now-activo': null, 'now-reserva': null };

  /* EL ARRANQUE DEL TURNO lo publica el robot a las 19:00, en el área
     'buffer_c_arranque': artículo por artículo, porque restar totales no sirve. */
  var ARRANQUE = (OPC.fuentes && OPC.fuentes.arranqueBufferC) || { hora: '', fecha: '', bufferC: {} };

  /* ── Y LA FOTO DE AHORA TAMBIÉN LLEGA SOLA ────────────────────────────────
     Desde el 12-ago-2026 el robot publica el stock cada hora, así que el avance
     de la Limpieza de Buffer C ya no espera a que alguien baje el CSV de Oracle
     y lo arrastre acá. Quien monta el módulo la trae en `fuentes.ahoraBufferC`.

     Se arma con la MISMA forma que devuelve leerActivo() —bufferC como Map— para
     que aplicarStock() no tenga que preguntar de dónde vino cada foto.

     EL ARCHIVO CARGADO A MANO SIGUE MANDANDO sobre esta: es la salida para el día
     que el robot no corra, o para revisar una foto puntual. */
  var AUTO = (function () {
    var a = OPC.fuentes && OPC.fuentes.ahoraBufferC;
    if (!a || !a.bufferC) return null;
    var m = new Map();
    Object.keys(a.bufferC).forEach(function (k) { m.set(k, a.bufferC[k]); });
    /* Los pares que cada SKU tiene FUERA del Buffer C. Puede no venir —una jornada
       cerrada no lo guarda— y ahí el avance vuelve a la regla vieja. */
    var fu = null;
    if (a.fuera) { fu = new Map(); Object.keys(a.fuera).forEach(function (k) { fu.set(k, a.fuera[k]); }); }
    return {
      tipo: 'activo', bufferC: m, buffer: new Map(), fuera: fu,
      totalC: a.totalC || 0, totalB: 0, lineas: a.lineas || 0,
      hora: a.hora || '', auto: true
    };
  })();

  var num = function (v) { return parseFloat(String(v == null ? 0 : v).replace(/,/g, '')) || 0; };

  /* La hora sale del nombre que le pone el robot: "Stock Activo 11-08-26 0600.csv" */
  /* "Stock Activo 11-08-26 0600.csv" → 11/08/2026 */
  function fechaDelNombre(nombre) {
    var m = String(nombre).match(/(\d{2})-(\d{2})-(\d{2})/);
    return m ? (m[1] + '/' + m[2] + '/20' + m[3]) : null;
  }

  function horaDelNombre(nombre) {
    var m = String(nombre).match(/\d{2}-\d{2}-\d{2}\s+(\d{2})(\d{2})/);
    return m ? m[1] + ':' + m[2] : null;
  }

  /* El CSV del stock activo: UTF-8 y separado por punto y coma. Las columnas se
     buscan POR NOMBRE, no por posición: si el WMS mueve una, esto sigue andando. */
  function leerActivo(texto) {
    var l = texto.split(/\r?\n/);
    var sep = (l[0] || '').indexOf(';') >= 0 ? ';' : ',';
    var cab = (l[0] || '').split(sep).map(function (s) { return s.trim(); });
    var iU = cab.findIndex(function (c) { return /^Ubicaci/i.test(c); });
    var iQ = cab.findIndex(function (c) { return /^Cantidad actual/i.test(c); });
    var iA = cab.findIndex(function (c) { return /^Art/i.test(c); });
    if (iU < 0 || iQ < 0 || iA < 0) throw new Error('faltan las columnas Artículo, Ubicación o Cantidad actual');
    /* `fuera` son los pares de cada SKU en CUALQUIER ubicación que no sea del Buffer C.
       Antes el bucle se saltaba todo lo que no fuera CDBUFFER y con eso alcanzaba, pero
       el avance ahora necesita saber si lo que bajó del C apareció en otro lado. */
    var bufferC = new Map(), buffer = new Map(), fuera = new Map();
    var totalC = 0, totalB = 0, lineas = 0;
    for (var k = 1; k < l.length; k++) {
      if (!l[k]) continue;
      var c = l[k].split(sep);
      var u = String(c[iU] || '').trim().toUpperCase();
      var q = num(c[iQ]); if (q <= 0) continue;
      var a = String(c[iA] || '').trim(); if (!a) continue;
      if (u.indexOf('CDBUFFER-C') === 0) {
        bufferC.set(a, (bufferC.get(a) || 0) + q); totalC += q;
      } else {
        fuera.set(a, (fuera.get(a) || 0) + q);
      }
      if (u.indexOf('CDBUFFER') === 0) { lineas++; buffer.set(a, (buffer.get(a) || 0) + q); totalB += q; }
    }
    return { tipo: 'activo', bufferC: bufferC, buffer: buffer, fuera: fuera,
             totalC: totalC, totalB: totalB, lineas: lineas };
  }

  /* ── EL EXCEL DE RESERVA, ABIERTO COMO LO QUE ES: UN ZIP ───────────────────
     Sin librerías, que acá no se pueden cargar. El navegador ya sabe
     descomprimir (DecompressionStream) y leer XML (DOMParser); un .xlsx no es
     más que eso adentro. Se lee el directorio central del zip, que es el que
     siempre trae los tamaños correctos. */
  async function abrirZip(buf) {
    var dv = new DataView(buf), n = buf.byteLength, fin = -1;
    for (var i = n - 22; i >= 0 && i > n - 66000; i--) { if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; } }
    if (fin < 0) throw new Error('no parece un archivo de Excel');
    var cuantos = dv.getUint16(fin + 10, true), p = dv.getUint32(fin + 16, true), ent = {};
    for (var e = 0; e < cuantos; e++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      ent[new TextDecoder().decode(new Uint8Array(buf, p + 46, nl))] = {
        metodo: dv.getUint16(p + 10, true), comp: dv.getUint32(p + 20, true), lho: dv.getUint32(p + 42, true)
      };
      p += 46 + nl + el + cl;
    }
    return {
      nombres: Object.keys(ent),
      sacar: async function (nombre) {
        var en = ent[nombre]; if (!en) return null;
        var ini = en.lho + 30 + dv.getUint16(en.lho + 26, true) + dv.getUint16(en.lho + 28, true);
        var crudo = new Uint8Array(buf, ini, en.comp);
        if (en.metodo === 0) return new TextDecoder().decode(crudo);
        return await new Response(new Blob([crudo]).stream()
          .pipeThrough(new DecompressionStream('deflate-raw'))).text();
      }
    };
  }

  async function filasDelXlsx(buf) {
    var zip = await abrirZip(buf);
    var textos = [], ss = await zip.sacar('xl/sharedStrings.xml');
    if (ss) {
      var si = new DOMParser().parseFromString(ss, 'application/xml').getElementsByTagName('si');
      for (var i = 0; i < si.length; i++) {
        var ts = si[i].getElementsByTagName('t'), s = '';
        for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
        textos.push(s);
      }
    }
    var hoja = zip.nombres.filter(function (x) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(x); }).sort()[0];
    if (!hoja) throw new Error('el Excel no tiene hojas');
    var d = new DOMParser().parseFromString(await zip.sacar(hoja), 'application/xml');
    var rows = d.getElementsByTagName('row'), out = [];
    for (var r = 0; r < rows.length; r++) {
      var cs = rows[r].getElementsByTagName('c'), fila = [];
      for (var q = 0; q < cs.length; q++) {
        var letras = (cs[q].getAttribute('r') || '').replace(/\d+/g, ''), col = 0;
        for (var z = 0; z < letras.length; z++) col = col * 26 + (letras.charCodeAt(z) - 64);
        var t = cs[q].getAttribute('t'), v = cs[q].getElementsByTagName('v')[0];
        var val = v ? v.textContent : '';
        if (t === 's') val = textos[Number(val)] || '';
        else if (t === 'inlineStr') { var w = cs[q].getElementsByTagName('t')[0]; val = w ? w.textContent : ''; }
        fila[Math.max(0, col - 1)] = val;
      }
      out.push(fila);
    }
    return out;
  }

  /* La reserva no arranca en la primera fila: lleva título y una fila en blanco
     antes de los encabezados. Por eso se busca la fila que los tiene. */
  function resumirReserva(filas) {
    var cab = null, iCab = -1;
    for (var r = 0; r < Math.min(filas.length, 15); r++) {
      var f = (filas[r] || []).map(function (x) { return String(x || '').trim().toUpperCase(); });
      if (f.some(function (c) { return /^(PRODUCTO|ARTICULO|ARTÍCULO)$/.test(c); })) { cab = f; iCab = r; break; }
    }
    if (!cab) throw new Error('no encontré la fila de encabezados (PRODUCTO / CANTIDAD)');
    /* PRODUCTO primero, y ARTICULO solo si no está: la reserva trae las dos, y
       ARTICULO es el código corto de 7 dígitos, que NO cruza con el del stock
       activo. Si se toma ese, ningún artículo coincide y todo sale en cero. */
    var iP = cab.indexOf('PRODUCTO');
    if (iP < 0) iP = cab.findIndex(function (c) { return /^(ARTICULO|ARTÍCULO)$/.test(c); });
    var iQ = cab.findIndex(function (c) { return /^CANTIDAD/.test(c); });
    var porArt = new Map(), total = 0, lineas = 0;
    for (var k = iCab + 1; k < filas.length; k++) {
      var f2 = filas[k] || [], q = num(f2[iQ]);
      if (!(q > 0)) continue;
      var a = String(f2[iP] || '').trim(); if (!a) continue;
      porArt.set(a, (porArt.get(a) || 0) + q); total += q; lineas++;
    }
    return { tipo: 'reserva', porArt: porArt, total: total, lineas: lineas };
  }

  function infoSlot(id, html) {
    var d = RAIZ.querySelector('[data-info="' + id + '"]');
    if (d) d.innerHTML = html;
  }

  /* El texto del stock que llega solo, CON SU HORA.
     Sin la hora a la vista, un avance calculado a las 23:30 se lee como si fuera
     de las 23:58 y no hay forma de saber que faltan 28 minutos por contar. */
  function pintarInfoAuto() {
    if (AUTO) {
      infoSlot('now-activo',
        '<b>Llega solo del robot</b>' + (AUTO.hora ? ' · foto de las <b>' + esc(AUTO.hora) + '</b>' : '') +
        '<br>' + nf(AUTO.totalC) + ' pares en el Buffer C' +
        '<br><span style="opacity:.7">Se actualiza cada hora. Solo hace falta cargar un ' +
        'archivo para mirar otra foto.</span>');
    }
    /* La reserva no alimenta ningún cálculo de esta pantalla, pero SÍ es de donde
       sale la Bajada de paletas, que se cruza afuera. Se dice acá para que el número
       no aparezca sin explicación. */
    var p = (OPC.fuentes && OPC.fuentes.paletas) || null;
    if (p && p.hora && p.alArrancar) {
      /* Cuando el plan de esa noche no guardó qué paletas se pidió bajar —las
         jornadas anteriores al 12-ago-2026— el número sale de TODAS las que estaban
         arriba. Es cuántas bajaron, no cuántas de las pedidas bajaron, y hay que
         decirlo: un número aproximado presentado como exacto es peor que no tenerlo. */
      var aprox = (p.exacto === false);
      infoSlot('now-reserva',
        '<b>Llega solo del robot</b> · foto de las <b>' + esc(p.hora) + '</b>' +
        '<br>' + nf(p.avance) + (aprox ? ' paletas bajaron esa noche' : ' de ' + nf(p.alArrancar) + ' paletas pedidas ya no están arriba') +
        (p.paresBajados ? ' · ' + nf(p.paresBajados) + ' pares' : '') +
        '<br><span style="opacity:.7">Se cuenta paleta por paleta: las que subieron ' +
        'durante el turno no descuentan.' +
        (aprox ? ' <b>Esa noche no se guardó qué paletas pidió el análisis</b>, así que ' +
                 'son todas las que bajaron: como mucho, las pedidas.' : '') +
        '</span>');
    }
  }

  /* LA VUELTA ATRÁS. Una foto cargada a mano se queda mandando hasta que alguien
     recargue la pantalla, y sin salida la primera prueba se vuelve permanente: el
     11-ago un 500 escrito para probar dejó el avance clavado y desde afuera se veía
     como un defecto. Acá el camino de vuelta está a la vista, al lado del número. */
  var fechaAntesDeLaFoto = null;
  function volverAlAutomatico() {
    STOCK['now-activo'] = null;
    if (fechaAntesDeLaFoto !== null) { S.fecha = fechaAntesDeLaFoto; fechaAntesDeLaFoto = null; }
    mandaLaFoto = false;
    S.ahora = delReloj();
    var inp = RAIZ.querySelector('[data-slot="now-activo"]');
    if (inp) inp.value = '';
    /* Se REDIBUJA. Soltar sin rehacer deja el campo con el número viejo mientras
       el bueno vuelve por detrás, y parece roto de otra manera. */
    pintarYGuardar();
    pintarInfoAuto();
  }

  /* APRETAR EL CANDADO.
   *
   * CONGELAR va directo: es la accion que protege, y hacerla dificil no ayuda.
   * DESCONGELAR pregunta primero -regla de Daniel, 27-ago-2026: *"si, con
   * confirmacion"*-. Un clic sin querer no puede soltar la meta de un turno.
   *
   * Al congelar NO se toca ningun numero: lo que ya esta calculado se queda tal
   * cual, y lo unico que cambia es que de ahi en adelante nadie lo pisa. */
  escuchar('click', function (e) {
    var c = e.target.closest && e.target.closest('#ta_cand');
    if (c) {
      if (c.disabled) return;
      if (!metaCongelada()) { S.metaFija = true; pintarYGuardar(); return; }
      var pregunta = typeof OPC.alPreguntar === 'function'
        ? OPC.alPreguntar('DESCONGELAR LA META',
            'La meta va a volver a tomarse de la <b>ultima corrida del buffer</b>, '
            + 'asi que puede cambiar.<br><br>Se hace cuando se corrio el analisis mas '
            + 'de una vez y quedo congelada la corrida equivocada.')
        : Promise.resolve(window.confirm('Descongelar la meta? Va a volver a tomarse de '
            + 'la ultima corrida del buffer.'));
      Promise.resolve(pregunta).then(function (ok) {
        if (!ok) return;
        S.metaFija = false;
        /* Las metas automaticas vuelven a cero para que la fuente las reescriba:
           `congelado()` ya no las frena, pero el valor viejo seguiria a la vista
           hasta el proximo refresco y parece que el candado no hizo nada. */
        S.procs.forEach(function (p) {
          if (p.fuente && !(p.aMano && p.aMano.meta)) p.meta = 0;
        });
        pintarYGuardar();
      });
      return;
    }
    var a = e.target.closest && e.target.closest('[data-volver-auto]');
    if (!a) return;
    e.preventDefault();
    volverAlAutomatico();
  });

  async function cargarArchivo(id, file) {
    infoSlot(id, 'leyendo <b>' + esc(file.name) + '</b>…');
    try {
      var res;
      if (/\.xlsx$/i.test(file.name)) res = resumirReserva(await filasDelXlsx(await file.arrayBuffer()));
      else if (id.indexOf('reserva') >= 0) {
        var txt = await file.text(), sep = (txt.split(/\r?\n/)[0] || '').indexOf(';') >= 0 ? ';' : ',';
        res = resumirReserva(txt.split(/\r?\n/).map(function (x) { return x.split(sep); }));
      } else res = leerActivo(await file.text());
      res.nombre = file.name;
      res.hora = horaDelNombre(file.name);
      res.fecha = fechaDelNombre(file.name);
      STOCK[id] = res;
      var det = res.tipo === 'activo'
        ? nf(res.totalB) + ' pares en el buffer · <b>' + nf(res.totalC) + '</b> en el Buffer C'
        : nf(res.total) + ' pares en reserva · ' + nf(res.lineas) + ' líneas';
      /* El camino de vuelta, al lado del número que acaba de pisar al automático. */
      var volver = (id === 'now-activo' && AUTO)
        ? '<br><a href="#" data-volver-auto="1">volver al automático</a>' : '';
      infoSlot(id, '<b>' + esc(file.name) + '</b><br>' + (res.hora ? 'foto de las ' + res.hora + ' · ' : '') + det + volver);
      /* Con una foto cargada manda la hora de la foto: el reloj deja de mover
         nada, o el cuadro diría una hora y los números serían de otra. */
      if (id === 'now-activo') {
        if (fechaAntesDeLaFoto === null) fechaAntesDeLaFoto = S.fecha;
        if (res.fecha) S.fecha = res.fecha;
        if (res.hora) { S.ahora = res.hora; mandaLaFoto = true; }
      }
      pintarYGuardar();
    } catch (err) {
      /* El archivo no se pudo leer: se vuelve solo al automático, en vez de dejar
         el avance en blanco por un archivo equivocado. */
      STOCK[id] = null;
      infoSlot(id, '<span style="color:var(--bad)">No se pudo leer: ' + esc(err.message) + '</span>');
      pintarYGuardar();
    }
  }

  /* Con las dos fotos del activo, la Limpieza de Buffer C se calcula sola:
     de lo que había al arrancar, cuánto ya no está. Código por código, porque
     restar los totales no sirve —durante la noche entra prepack nuevo—. */
  /* LOS NÚMEROS QUE LLEGAN SOLOS.
     Cada actividad dice de qué vive en su campo `fuente`, y acá se le copian
     la meta y el avance. La que no tiene fuente se escribe a mano y no se
     toca nunca: es lo que separa Slotting y BPA de las demás.

     El Buffer C no pasa por acá: su avance sale de comparar la foto del
     arranque contra la que se cargue, y de eso se encarga aplicarStock(). */
  /* ─────────────── LO QUE YA QUEDÓ FIJADO NO SE VUELVE A CALCULAR ───────────────
   *
   * Lo fijó Daniel el 13-ago-2026, y son dos reglas distintas:
   *
   *   LA META es lo que salió cuando se PROCESÓ. *"Yo proceso tareas veinte mil y
   *   eso tiene que ser la meta. Yo proceso, él va a hacer sesenta paletas, y esa
   *   es la meta de paletas."* Una vez que quedó registrada no se toca más — y
   *   reprocesar el análisis de una jornada que ya tiene meta *"nunca pasa"*.
   *
   *   EL AVANCE se recalcula cada hora mientras el turno corre, y **se cierra a
   *   las 06:30 con la jornada**. Una jornada cerrada muestra lo que se midió esa
   *   noche; no se vuelve a calcular porque alguien la abra después.
   *
   * SIN ESTO, MIRAR CAMBIABA LOS DATOS. El 13-ago Daniel abrió la jornada del 12
   * a las 07:30 y los números se movieron solos: el reporte los recalculó contra
   * lo que había en ese momento y —peor— los guardó encima. Ver el porqué de que
   * `guardar()` ya no viva adentro de `pintar()`.
   *
   * Escribir a mano sigue mandando sobre las dos: el campo queda marcado en
   * `aMano` y vaciarlo devuelve el automático. */
  function congelado(p, campo) {
    var cerrada = !!(OPC.fuentes && OPC.fuentes.jornadaCerrada);
    if (campo === 'meta') return metaCongelada();
    return cerrada && p.av > 0;
  }

  /* ¿ESTA CONGELADA LA META? Lo decide el candado, no el hecho de que ya haya un
   * número. Daniel, 27-ago-2026: *"si yo no he abierto las actividades, puedo correr
   * una, dos, tres, cuatro veces, y cuando lo abra recién me captura la última"*.
   *
   * Con la regla vieja eso no era cierto: la meta se clavaba al escribir en CUALQUIER
   * campo de la tabla, sin avisar. Se congelaba sin que nadie lo pidiera y el mismo
   * Daniel no sabía en qué momento pasaba.
   *
   * Ahora:
   *   candado ABIERTO  -> la meta sigue a la última corrida del buffer, siempre
   *   candado CERRADO  -> queda fija; ninguna corrida nueva la mueve
   *   jornada CERRADA  -> fija igual, aunque nadie haya tocado el candado
   *
   * Y las jornadas guardadas ANTES de que el candado existiera no traen la marca:
   * esas conservan la regla vieja, para no moverle los números a un turno cerrado.
   */
  function metaCongelada() {
    if (OPC.fuentes && OPC.fuentes.jornadaCerrada) return true;
    if (S.metaFija === true) return true;
    if (S.metaFija === false) return false;
    return S.procs.some(function (p) { return p.meta > 0; });
  }

  /**
   * UN AVANCE NO PUEDE ACHICARSE. Regla de Daniel, y la trajo él mismo el 18-ago-2026:
   * *"hace un rato tenía en Limpieza de Buffer C novecientos ocho en avance, pero ahora veo
   * que ha bajado a ochocientos treinta y dos"*.
   *
   * Las tres cuentas automáticas comparan la foto del arranque contra la de la hora, y esa
   * resta SE PUEDE TAPAR: si al mismo artículo le entra mercadería nueva, lo que figura como
   * "salió" se achica aunque el trabajo ya esté hecho. Esa noche entraron 213 pares al Buffer
   * C después del arranque; 75 eran de artículos que ya estaban, y son exactamente los 76 que
   * el avance perdió.
   *
   * El trabajo hecho no se deshace porque llegue mercadería nueva, así que dentro de una
   * jornada el avance solo puede subir. Al cambiar de fecha se recarga el estado de esa
   * jornada, así que el tope es por turno y no se arrastra al día siguiente.
   */
  function noRetrocede(p, nuevo) {
    var n = Math.round(Number(nuevo) || 0);
    var previo = Math.round(Number(p.av) || 0);
    return Math.max(n, previo);
  }

  function aplicarFuentes() {
    var F = OPC.fuentes || {};
    S.procs.forEach(function (p) {
      if (!p.fuente || p.fuente === 'bufferC') return;
      var f = F[p.fuente];
      if (!f) return;
      /* Lo que Daniel escribió a mano MANDA. Sin esto la fuente lo volvía a pisar
         en el dibujado siguiente y parecía que el número se borraba solo. */
      var m = p.aMano || {};
      if (typeof f.meta === 'number' && !m.meta && !congelado(p, 'meta')) p.meta = Math.round(f.meta);
      if (typeof f.avance === 'number' && !m.av && !congelado(p, 'av')) p.av = noRetrocede(p, f.avance);
      if (f.unidad) p.u = f.unidad;
      p.auto = true;
    });
  }

  /* AVANCE ES LO QUE SALIÓ DEL C **Y SE VE LLEGAR A OTRO LADO**.
   *
   * Lo fijó Daniel el 12-ago-2026. Hasta esa noche bastaba con que el par
   * desapareciera de la zona C, y eso daba 1.110 de 1.769 en tres horas y media:
   * de esos, solo 138 aparecían en otra ubicación del activo. Los otros 972 estaban
   * encajados en un LPN todavía sin matricular — salieron del sistema en el C pero
   * no llegaron a ningún destino, y contarlos infla el avance con trabajo a medias.
   *
   * SE REGULARIZA SOLO: cuando el LPN se matricula, la corrida de la hora siguiente
   * ve esos pares en su ubicación nueva y el avance sube. No se pierde nada, se
   * cuenta cuando llega. Daniel: *"voy a decir a los chicos que no dejen pendiente
   * LPNs cargados para que yo pueda ver el avance real"*.
   *
   * HACE FALTA LA LÍNEA DE BASE. Un SKU puede estar en el C y en el mezzanine a la
   * vez, así que "aparecer fuera del C" no alcanza: hay que comparar contra lo que
   * ese SKU ya tenía fuera al arrancar el turno. Si esa base no llega —una jornada
   * vieja no la guardó— se vuelve a la regla anterior, que es la única medible con
   * lo que hay.
   *
   * NO SE MIRA LA RESERVA. El Buffer C es justamente lo que se BAJA de reserva:
   * contar un par como avance porque aparece arriba sería darle la vuelta al
   * circuito. Todo esto se mide dentro del stock activo.
   */
  function aplicarStock() {
    /* La cargada a mano primero; si no hay, la que publica el robot cada hora. */
    var b = STOCK['now-activo'] || AUTO;
    var base = ARRANQUE.fuera || null;
    var meta = 0, av = 0, sinDestino = 0, medible = !!(b && b.fuera && base);
    Object.keys(ARRANQUE.bufferC).forEach(function (art) {
      var x = ARRANQUE.bufferC[art];
      meta += x;
      if (!b) return;
      var y = b.bufferC.get(art) || 0;
      if (x <= y) return;
      var bajo = x - y;
      if (!medible) { av += bajo; return; }
      var subio = (b.fuera.get(art) || 0) - (base[art] || 0);
      var conDestino = Math.max(0, Math.min(bajo, subio));
      av += conDestino;
      sinDestino += bajo - conDestino;
    });
    /* LA META SE MUESTRA SIEMPRE, aunque todavía no se haya cargado la foto de
       ahora: es lo que había en el Buffer C al arrancar el turno y lo publica el
       robot. El AVANCE, en cambio, necesita las dos fotos. */
    S.procs.forEach(function (p) {
      if (p.fuente !== 'bufferC') return;
      var m = p.aMano || {};
      if (meta > 0 && !m.meta && !congelado(p, 'meta')) { p.meta = Math.round(meta); }
      if (meta > 0 && !m.meta) { p.u = 'pares'; p.auto = true; }
      if (b && !m.av && !congelado(p, 'av')) p.av = noRetrocede(p, av);
      /* Los que salieron del C y no llegaron a destino NO se esconden: si no se
         vieran, tres horas de trabajo parecerían no haber pasado. */
      p.pend = (b && !m.av && medible && !congelado(p, 'av')) ? Math.round(sinDestino) : p.pend || 0;
    });
  }

  escuchar('change', function (e) {
    /* CAMBIAR LA FECHA no se resuelve acá: este archivo no sabe leer del
       servidor. Se avisa hacia afuera y quien monta el módulo vuelve a traer
       la jornada entera —lo guardado y los números que llegan solos— y lo
       monta de nuevo. */
    if (e.target.classList && e.target.classList.contains('cal') && e.target.value) {
      S.dia = e.target.value;
      pintarCalendario();
      if (typeof OPC.alCambiarFecha === 'function') OPC.alCambiarFecha(S.dia);
      return;
    }
    var slot = e.target.getAttribute && e.target.getAttribute('data-slot');
    if (slot && e.target.files && e.target.files[0]) cargarArchivo(slot, e.target.files[0]);
  });

  /* Se vuelven a dibujar los tres bloques. Las tablas se rehacen enteras, así
     que el foco se devuelve al campo que se estaba escribiendo. */
  function pintar(foco) {
    recalcularTurno();
    aplicarFuentes();
    aplicarStock();
    if (foco && foco.k !== 'cuenta') {
      /* Escribiendo: las tablas se dejan en paz y solo se reescriben las celdas
         calculadas. La casilla "¿Tiene meta?" es la excepción —cambia qué filas
         entran al Cumplimiento— y ahí sí hay que rehacerlo todo. */
      refrescarCalculadas();
      /* El nombre vive en las dos tablas: se copia a la gemela, que no se está
         editando, para que no queden distintas hasta el próximo dibujado. */
      if (foco.k === 'n' && S.procs[foco.i]) {
        var gemela = RAIZ.querySelector('[data-t="' + (foco.t === 'h' ? 'c' : 'h') + '"][data-k="n"][data-i="' + foco.i + '"]');
        if (gemela) gemela.value = S.procs[foco.i].n;
      }
    } else {
      pintarHorarios();
      pintarTablaCum();
    }
    pintarAnillos();
    pintarGantt();
    pintarCandado();
  }

  /* EL CANDADO DE LA META, dibujado. Dice en que estado esta SIN tener que abrir
   * nada, y al pasar el mouse explica que va a pasar si se aprieta.
   *
   * Con la jornada cerrada queda apagado: a esa altura la meta ya es historia y
   * descongelarla solo serviria para ensuciar un turno que ya se reporto. */
  function pintarCandado() {
    var b = $('#ta_cand');
    if (!b) return;
    var cerrada = !!(OPC.fuentes && OPC.fuentes.jornadaCerrada);
    var fija = metaCongelada();
    b.classList.toggle('fija', fija);
    b.disabled = cerrada;
    b.innerHTML = icono(fija ? 'candado' : 'candado_abierto', 18);
    b.title = cerrada
      ? 'La jornada ya cerro: la meta quedo fija con lo que se midio esa noche.'
      : (fija
        ? 'La meta esta congelada: ninguna corrida nueva del buffer la mueve.\nClic para descongelarla.'
        : 'La meta sigue a la ULTIMA corrida del buffer.\nPuedes correr el analisis las veces que quieras.\nClic para congelarla.');
  }

  /* MIRAR NO ES CAMBIAR, y por eso `guardar()` ya no vive adentro de `pintar()`.
   *
   * Estaba al final del dibujado, así que CUALQUIER redibujado escribía en el
   * servidor. Abrir una jornada pasada alcanzaba: se dibujaba con lo guardado
   * —que se veía bien—, llegaban por detrás las fuentes que se piden solas, se
   * volvía a dibujar con los números recalculados, y esos números quedaban
   * guardados encima de los verdaderos. Daniel lo cazó el 13-ago-2026: *"he
   * filtrado el doce, me estaba saliendo bien, pero después de unos segundos se
   * ha vuelto a regresar"*. En el servidor se veía igual de claro: el registro
   * del 12-ago figuraba reescrito a las 07:30 sin que nadie tocara nada.
   *
   * Ahora se guarda solo cuando hay una acción de verdad: escribir un campo,
   * agregar o borrar una actividad, cargar una foto de stock a mano o volver al
   * automático. Montar la pantalla NO guarda. */
  function pintarYGuardar(foco) { pintar(foco); guardar(); }

  escuchar('input', function (e) {
    var t = e.target;
    var k = t.getAttribute('data-k');
    if (!k) return;
    var i = Number(t.getAttribute('data-i'));
    /* Escribir la meta o el avance los deja marcados como puestos A MANO, y
       desde ahí la fuente automática no los vuelve a pisar en esta jornada. */
    if (k === 'meta' || k === 'av') {
      /* VACIAR EL CAMPO DEVUELVE EL AUTOMATICO.
         Sin esta salida, escribir una vez un numero dejaba esa casilla clavada
         para siempre: Daniel puso 500 de prueba en el avance de Almacenamiento y
         el 3.547 que llegaba solo no volvia a entrar nunca. Ahora se borra el
         contenido y la fuente vuelve a mandar. */
      if (!S.procs[i].aMano) S.procs[i].aMano = {};
      if (t.value === '') delete S.procs[i].aMano[k];
      else S.procs[i].aMano[k] = true;
      /* Al soltar el campo hay que REDIBUJARLO ENTERO para que se vea el numero
         que devuelve la fuente; el refresco liviano no toca los campos. */
      if (t.value === '' && S.procs[i].fuente) { S.procs[i][k] = 0; pintarYGuardar(); return; }
    }
    S.procs[i][k] = k === 'cuenta' ? t.checked
      : (k === 'meta' || k === 'av') ? (t.value === '' ? 0 : Number(t.value))
      : t.value;
    pintarYGuardar({ t: t.getAttribute('data-t'), k: k, i: i, p: (t.selectionStart == null ? 0 : t.selectionStart) });
  });

  escuchar('click', function (e) {
    var d = e.target.getAttribute && e.target.getAttribute('data-del');
    if (d !== null && d !== undefined) { S.procs.splice(Number(d), 1); pintarYGuardar(); return; }
    if (e.target.id === 'ta_b_add' || e.target.id === 'ta_b_add2') {
      /* `cuenta: true` no es un detalle: sin él la actividad nueva nacía sin la
         marca de "tiene meta", salía en el Gantt y NO en el Cumplimiento. El
         relleno solo corre al montar la pantalla, así que aparecía
         recién al recargar. */
      S.procs.push({ n: 'Actividad nueva', u: 'unidades', meta: 0, av: 0, pi: '', pf: '', ri: '', rf: '', cuenta: true });
      pintarYGuardar();
      /* El cursor queda en la tabla desde la que se apretó el botón: si no,
         agregar desde Cumplimiento saltaba de vuelta al Gantt. */
      var tabla = e.target.id === 'ta_b_add2' ? 'c' : 'h';
      var f = RAIZ.querySelector('[data-t="' + tabla + '"][data-k="n"][data-i="' + (S.procs.length - 1) + '"]');
      if (f) { f.focus(); f.select(); }
      return;
    }
  });

  var alRedimensionar = function () { if (RAIZ.isConnected) pintarGantt(); };
  window.addEventListener('resize', alRedimensionar);

  /* Mientras no se cargue una foto de stock, la hora del reporte es la del
     reloj de la computadora. */
  var mandaLaFoto = false;
  function delReloj() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* LA HORA CORRE SOLA. Cada medio minuto se mueve la línea de "ahora" y se
     vuelve a calcular cuánto debería llevar cada actividad a esta altura del
     turno. NO se rehacen las tablas: si alguien está escribiendo un número, no
     se entera de nada. */
  var latido = setInterval(function () {
    /* Si la pestaña ya no está en pantalla, el módulo se apaga solo: si no,
       cada visita dejaría otro reloj corriendo sobre una pantalla que ya no existe. */
    if (!RAIZ.isConnected) {
      clearInterval(latido);
      window.removeEventListener('resize', alRedimensionar);
      return;
    }
    if (mandaLaFoto) return;
    var h = delReloj();
    if (h === S.ahora) return;
    S.ahora = h;
    recalcularTurno();
    refrescarCalculadas();
    pintarAnillos();
    pintarGantt();
  }, 30000);

  function arrancar() {
    /* La hora actual es la del reloj, no un campo que alguien tenga que llenar.
       Si se carga una foto de stock, pasa a ser la hora de esa foto. */
    S.ahora = delReloj();
    mandaLaFoto = false;
    pintar();
    /* Y se dice que el stock de ahora llegó solo, con la hora de esa foto. */
    pintarInfoAuto();
  }
  arrancar();
};
