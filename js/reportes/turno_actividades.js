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

const CSS = "#ta {\n  color-scheme: dark;\n    --bg: #0b0e15;\n    --panel: #151a24;\n    --panel-2: #1b2130;\n    --line: #242b3a;\n    --line-2: #38425a;\n    --text: #e8ecf4;\n    --text-2: #99a3ba;\n    --text-3: #6a7590;\n    --accent: #8b93f8;\n    --accent-soft: #23244a;\n    --ok: #34d399;\n    --ok-soft: #10322a;\n    --warn: #fbbf24;\n    --warn-soft: #3a2c0c;\n    --bad: #f87171;\n    --bad-soft: #3a1d1d;\n    --plan-line: #3c4660;\n    --now: #fb7185;\n    --on-ok: #06231c; --on-warn: #2b1f04; --on-bad: #2e0f0f;\n    --neon: #00E5FF; --neon-glow: 0 0 14px rgba(0, 229, 255, .16);\n    --shadow: none;\n  }\n\n  /* Sin esto la caja punteada del plan de la última actividad se pasa 2 px del\n     carril: el borde se suma al ancho y la barra termina fuera del turno. */\n  #ta *, #ta *::before, #ta *::after { box-sizing: border-box; }\n\n  #ta { background: var(--bg); color: var(--text); font-family: var(--ui); font-size: 14px; line-height: 1.6; }\n\n  #ta .page { max-width: 1180px; margin: 0 auto; padding: 28px 22px 64px; display: flex; flex-direction: column; gap: 18px; }\n\n  #ta .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: var(--text-3); }\n  #ta h1 { font-size: 22px; font-weight: 500; margin: 2px 0 4px; letter-spacing: -.01em; text-wrap: balance; }\n  #ta h2 { font-size: 17px; font-weight: 500; margin: 0; letter-spacing: -.005em; }\n  #ta .lead { color: var(--text-2); font-size: 13px; margin: 0; max-width: 68ch; }\n\n  #ta .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px 20px; box-shadow: var(--shadow); }\n  #ta .phead { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }\n  #ta .phead .sub { font-family: var(--mono); font-size: 12px; color: var(--text-3); }\n  /* Marco de adentro: encierra lo que se MIRA —título, cuadro y leyenda— y deja\n     fuera la tabla, que es donde se ESCRIBE. */\n  #ta .marco { border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px 18px; }\n  /* Cian neón, el mismo que usa el reporte de Marcas en el tablero. En claro se\n     baja a un cian oscuro, porque el neón sobre blanco no se lee. */\n  #ta .neon { border-color: var(--neon); box-shadow: var(--neon-glow); }\n  #ta .marco .phead { margin-bottom: 14px; }\n\n  /* ── controles ───────────────────────────────────────────────────────── */\n  #ta input, #ta button { font-family: var(--mono); font-size: 13px; color: var(--text); background: var(--panel-2); border: 1px solid var(--line); border-radius: 7px; padding: 6px 9px; }\n  #ta input[type=\"text\"] { font-family: var(--ui); }\n  #ta input:hover { border-color: var(--line-2); }\n  #ta input:focus-visible, #ta button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }\n  #ta button { cursor: pointer; }\n  #ta button:hover { border-color: var(--line-2); }\n  #ta .btn-a { background: var(--accent-soft); border-color: transparent; color: var(--accent); }\n\n  /* ── gantt ───────────────────────────────────────────────────────────── */\n  /* La barra de desplazamiento, con los colores del tema. Firefox entiende\n     `scrollbar-color`; Chrome y Edge necesitan las pseudo-clases de abajo. */\n  #ta .gwrap, #ta .twrap { overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }\n  #ta .gwrap::-webkit-scrollbar, #ta .twrap::-webkit-scrollbar { height: 11px; width: 11px; }\n  #ta .gwrap::-webkit-scrollbar-track, #ta .twrap::-webkit-scrollbar-track { background: transparent; }\n  #ta .gwrap::-webkit-scrollbar-thumb, #ta .twrap::-webkit-scrollbar-thumb {\n    background: var(--line-2); border-radius: 7px; border: 3px solid var(--panel); background-clip: padding-box;\n  }\n  #ta .gwrap::-webkit-scrollbar-thumb:hover, #ta .twrap::-webkit-scrollbar-thumb:hover { background: var(--text-3); background-clip: padding-box; }\n  #ta .gwrap::-webkit-scrollbar-corner, #ta .twrap::-webkit-scrollbar-corner { background: transparent; }\n\n\n  /* SIN `min-width`: el ancho mínimo era lo que sacaba la barra de\n     desplazamiento cuando el cuadro entraba en un panel angosto. La rejilla es\n     186 px para el nombre y el resto para el turno, así que entra en cualquier\n     ancho; si queda muy angosto, el eje rotula las horas de dos en dos.\n     Los 186 px alcanzan porque la etiqueta \"auto\" ya no va acá. */\n  #ta .gg { display: grid; grid-template-columns: 186px 1fr; align-items: center; }\n  #ta .gnm { font-size: 13px; color: var(--text-2); padding: 0 12px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n  #ta .axis { position: relative; height: 20px; border-bottom: 1px solid var(--line); margin-bottom: 10px; }\n  #ta .tick { position: absolute; top: 0; font-family: var(--mono); font-size: 11px; color: var(--text-3); transform: translateX(-50%); }\n  /* Con el turno terminado, la línea de \"ahora\" cae en el 100% y su píxel de\n     borde asomaba fuera del carril: un solo píxel, pero alcanzaba para sacar\n     barra de desplazamiento en las siete filas. Todo lo que va adentro del\n     carril —barras, guías, la línea de ahora— se recorta en su borde. */\n  #ta .lane { position: relative; height: 34px; overflow: hidden; }\n  #ta .vl { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--line); }\n  #ta .bar { position: absolute; border-radius: 4px; }\n  #ta .plan { border: 1px dashed var(--plan-line); border-radius: 4px; top: 5px; height: 24px; }\n  #ta .now { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed var(--now); z-index: 3; }\n  /* `overflow:hidden` es el cinturón: aunque la etiqueta de la hora quede a un\n     pelo del borde, no puede empujar el ancho del cuadro ni sacar barra. */\n  #ta .foot { position: relative; height: 20px; overflow: hidden; }\n  #ta .nowtag { position: absolute; top: 2px; font-family: var(--mono); font-size: 11px; color: var(--now); transform: translateX(-50%); white-space: nowrap; }\n  #ta .endline { position: absolute; top: 0; bottom: 0; right: 0; width: 1px; background: var(--line-2); }\n\n  #ta .leg { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 12px; color: var(--text-2); margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }\n  #ta .sw { display: inline-block; width: 22px; height: 9px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; }\n\n  /* ── anillos ─────────────────────────────────────────────────────────── */\n  #ta .rings { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 12px; margin-bottom: 20px; }\n  #ta .rcard { background: var(--panel-2); border-radius: 10px; padding: 14px 10px 12px; text-align: center; }\n  #ta .ring { width: 82px; height: 82px; border-radius: 50%; margin: 0 auto 9px; display: flex; align-items: center; justify-content: center; }\n  #ta .hole { width: 62px; height: 62px; border-radius: 50%; background: var(--panel-2); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 16px; }\n  #ta .rn { font-size: 12.5px; margin-bottom: 3px; line-height: 1.35; }\n  #ta .rq { font-family: var(--mono); font-size: 11px; color: var(--text-3); line-height: 1.5; }\n\n  /* ── tablas ──────────────────────────────────────────────────────────── */\n  #ta table { border-collapse: collapse; width: 100%; min-width: 640px; }\n  /* Solo la columna de la actividad va pegada a la izquierda. Todo lo demás va\n     centrado, encabezado y celda con la misma regla: antes el encabezado tiraba\n     a la derecha y la celda a la izquierda, y las columnas salían descuadradas. */\n  #ta th { font-family: var(--mono); font-weight: 400; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); padding: 0 8px 8px; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }\n  #ta th.l { text-align: left; }\n  #ta td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: center; font-family: var(--mono); font-size: 13px; font-variant-numeric: tabular-nums; }\n  #ta td.fijo { color: var(--text-2); }\n  #ta td.l { text-align: left; font-family: var(--ui); color: var(--text-2); }\n  #ta td.u input[type=\"text\"] { text-align: center; }\n  #ta tr:last-child td { border-bottom: none; }\n  #ta td input[type=\"number\"] { width: 88px; text-align: right; }\n  #ta td input[type=\"time\"] { width: 104px; }\n  #ta td input[type=\"text\"] { width: 100%; min-width: 130px; }\n  #ta td.u input[type=\"text\"] { width: 100px; min-width: 0; }\n  /* Marca las actividades cuyos números NO se escriben a mano: llegan solos. */\n  #ta .auto { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .07em;\n          background: var(--accent-soft); color: var(--accent); padding: 2px 7px; border-radius: 10px;\n          margin-left: 7px; vertical-align: 1px; white-space: nowrap; }\n  #ta .chip { display: inline-block; font-family: var(--ui); font-size: 11.5px; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }\n  #ta .del { padding: 3px 8px; font-size: 12px; color: var(--text-3); background: transparent; border-color: transparent; }\n  #ta .del:hover { color: var(--bad); border-color: var(--line); }\n\n\n  /* ── carga de stock ──────────────────────────────────────────────────── */\n  #ta .slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }\n  #ta .slot { background: var(--panel-2); border-radius: 10px; padding: 12px 14px; }\n  #ta .slab { display: block; font-size: 12.5px; color: var(--text-2); margin-bottom: 8px; }\n  #ta .slot input[type=\"file\"] { width: 100%; font-size: 12px; padding: 5px; }\n  #ta .slot input[type=\"file\"]::file-selector-button { font-family: var(--mono); font-size: 12px; color: var(--accent);\n    background: var(--accent-soft); border: none; border-radius: 6px; padding: 5px 11px; margin-right: 10px; cursor: pointer; }\n  /* Arranca vacío: el propio campo ya dice \"Ningún archivo seleccionado\" y\n     repetirlo abajo con un \"sin cargar\" era decir dos veces lo mismo. */\n  #ta .sinfo { font-family: var(--mono); font-size: 11.5px; color: var(--text-3); margin-top: 8px; line-height: 1.6; }\n  #ta .sinfo:empty { margin-top: 0; }\n  #ta .sinfo b { color: var(--text-2); font-weight: 400; }\n\n\n  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }";

const HTML = "<div class=\"page\">\n\n\n  <section class=\"panel\">\n    <div>\n      <div class=\"slots\">\n        <div class=\"slot\">\n          <span class=\"slab\">Stock <b>activo</b> de ahora</span>\n          <input type=\"file\" data-slot=\"now-activo\" accept=\".csv,text/csv\">\n          <div class=\"sinfo\" data-info=\"now-activo\"></div>\n        </div>\n        <div class=\"slot\">\n          <span class=\"slab\">Stock <b>reserva</b> de ahora</span>\n          <input type=\"file\" data-slot=\"now-reserva\" accept=\".xlsx,.csv\">\n          <div class=\"sinfo\" data-info=\"now-reserva\"></div>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"panel neon\">\n    <!-- El cuadro va en su propio marco, del título a la leyenda. La tabla de\n         abajo queda fuera: es para escribir, no para mirar. -->\n    <div class=\"marco neon\">\n      <div class=\"phead\"><h2>Gantt de actividades</h2><span class=\"sub\" id=\"ta_g_sub\"></span></div>\n      <div class=\"gwrap\"><div class=\"gg\" id=\"ta_gg\"></div></div>\n      <div class=\"leg\">\n        <span><span class=\"sw\" style=\"border:1px dashed var(--plan-line); height:8px\"></span>Lo que debía hacerse</span>\n        <span><span class=\"sw\" style=\"background:var(--ok)\"></span>Hecho</span>\n        <span><span class=\"sw\" style=\"background:var(--warn)\"></span>Se pasó del plan</span>\n        <span><span class=\"sw\" style=\"background:var(--accent)\"></span>En curso</span>\n        <span><span style=\"display:inline-block;width:0;border-left:1px dashed var(--now);height:12px;vertical-align:-2px;margin-right:8px\"></span>Ahora</span>\n      </div>\n    </div>\n\n    <div class=\"twrap\" style=\"margin-top:22px\">\n      <table id=\"ta_t_hor\">\n        <thead><tr>\n          <th class=\"l\">Actividad</th><th>Plan · empieza</th><th>Plan · termina</th>\n          <th>Real · empezó</th><th>Real · terminó</th><th>Desvío</th>\n          <th title=\"Marcada, la actividad entra al Cumplimiento del turno\">¿Tiene meta?</th><th></th>\n        </tr></thead>\n        <tbody></tbody>\n      </table>\n    </div>\n    <div style=\"margin-top:12px\"><button class=\"btn-a\" id=\"ta_b_add\">+ Agregar actividad</button></div>\n  </section>\n\n  <section class=\"panel neon\">\n    <div class=\"phead\"><h2>Cumplimiento del turno</h2><span class=\"sub\" id=\"ta_c_sub\"></span></div>\n    <div class=\"rings\" id=\"ta_rings\"></div>\n    <div class=\"twrap\">\n      <table id=\"ta_t_cum\">\n        <thead><tr>\n          <th class=\"l\">Actividad</th><th>Unidad</th><th>Meta</th><th>Avance</th>\n          <th>Falta</th><th>A esta hora</th><th>%</th><th>Estado</th><th></th>\n        </tr></thead>\n        <tbody></tbody>\n      </table>\n    </div>\n    <div style=\"margin-top:12px\"><button class=\"btn-a\" id=\"ta_b_add2\">+ Agregar actividad</button></div>\n  </section>\n\n</div>";

/** Dibuja el reporte dentro de `raiz` y avisa por `OPC.alGuardar` cuando algo cambia. */
export const montarTurno = function (RAIZ, OPC) {
  OPC = OPC || {};
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
    /* EL TURNO NO SE CONFIGURA ACÁ. Sale de la jornada que ya está en el
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
      { n: 'Slotting',             u: 'tareas',      meta: 60,    av: 45,    pi: '20:30', pf: '06:00', ri: '20:30', rf: '06:00', cuenta: true },
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
  function normalizar(g) {
    if (!g || !g.procs || !g.procs.length) g = JSON.parse(JSON.stringify(BASE));
    /* Un campo nuevo no puede llegar vacío a lo que ya estaba guardado: se
       rellena con el valor de fábrica, nunca con vacío. */
    g.procs.forEach(function (p) { if (p.cuenta === undefined) p.cuenta = true; });
    if (!g.ini) g.ini = BASE.ini;
    if (!g.fin) g.fin = BASE.fin;
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

    var enCurso = ri !== null && rf === null;
    var rFin = enCurso ? Math.max(ri, AHORA) : rf;

    var meta = Number(p.meta) || 0, av = Number(p.av) || 0;
    var esperado = 0;
    if (pi !== null && pf !== null && pf > pi) {
      var r = (AHORA - pi) / (pf - pi);
      esperado = meta * Math.max(0, Math.min(1, r));
    }
    esperado = Math.round(esperado);

    var est, tono;
    if (meta > 0 && av >= meta) { est = 'Cumplido'; tono = 'ok'; }
    else if (av === 0 && esperado === 0) { est = 'Sin empezar'; tono = 'off'; }
    else if (av >= esperado) { est = 'Al día'; tono = 'ok'; }
    else if (av >= esperado * 0.8) { est = 'Justo'; tono = 'warn'; }
    else { est = 'Pendiente'; tono = 'bad'; }

    var desvio = null, desvTxt = '—';
    if (rf !== null && pf !== null) { desvio = rf - pf; desvTxt = (desvio > 0 ? '+' : '') + desvio + ' min'; }
    else if (enCurso && pi !== null) { desvio = ri - pi; desvTxt = 'arrancó ' + (desvio > 0 ? '+' : '') + desvio + ' min'; }

    return {
      pi: pi, pf: pf, ri: ri, rf: rFin, enCurso: enCurso,
      meta: meta, av: av, esperado: esperado,
      pct: meta > 0 ? Math.round(100 * av / meta) : 0,
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

    $('#ta_g_sub').textContent = reloj(INI) + ' → ' + reloj(INI + SPAN) + ' · ' + S.procs.length + ' actividades';
  }

  /* ── Anillos y tabla de cumplimiento ──────────────────────────────────── */
  /* Las que tienen meta, con el índice que ocupan en la lista completa: los
     campos editables lo necesitan para no escribir en la actividad equivocada. */
  function conMeta() {
    var r = [];
    S.procs.forEach(function (p, i) { if (p.cuenta) r.push({ p: p, i: i }); });
    return r;
  }

  /* EL COLOR DEL ANILLO va por lo simple, que es como lo pidió Daniel:
     verde si está cumplido, amarillo si avanzó algo y rojo si no hay nada.

     No usa el mismo criterio que la columna Estado —esa mira además si a esta
     altura del turno ya debería llevar más—, porque el anillo se lee de lejos y
     ahí manda una sola pregunta: ¿está o no está? La actividad sin meta puesta
     queda gris: en rojo parecería que se hizo mal algo que nadie definió. */
  function tonoAnillo(c) {
    if (!c.meta) return 'off';
    if (c.av >= c.meta) return 'ok';
    if (c.av > 0) return 'warn';
    return 'bad';
  }
  function pintarAnillos() {
    var anillos = '';

    conMeta().forEach(function (x) {
      var p = x.p;
      var c = calcular(p);
      var g = Math.max(0, Math.min(100, c.pct));
      anillos += '<div class="rcard">' +
        '<div class="ring" style="background:conic-gradient(' + COLOR[tonoAnillo(c)] + ' 0 ' + g + '%, var(--line) ' + g + '% 100%)">' +
        '<div class="hole" style="color:' + COLOR[tonoAnillo(c)] + '">' + c.pct + '%</div></div>' +
        '<div class="rn">' + rotulo(p) + '</div>' +
        '<div class="rq">' + nf(c.av) + ' de ' + nf(c.meta) + '<br>' + esc(p.u || '') + '</div></div>';
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
      { html: c.pct + '%', color: COLOR[c.tono] },
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
        /* LO AUTOMÁTICO NO SE ESCRIBE. Si estos dos fueran campos, escribir en
           ellos no serviría de nada: el número vuelve del servidor en el
           siguiente dibujado y parecería que se borra solo. Salen como texto,
           que además deja claro de un vistazo cuáles se cargan a mano. */
        (p.auto
          ? '<td class="fijo">' + nf(c.meta) + '</td><td class="fijo">' + nf(c.av) + '</td>'
          : '<td><input type="number" min="0" ' + SIN_AYUDA + ' data-t="c" data-k="meta" data-i="' + i + '" value="' + c.meta + '"></td>' +
            '<td><input type="number" min="0" ' + SIN_AYUDA + ' data-t="c" data-k="av" data-i="' + i + '" value="' + c.av + '"></td>') +
        celdasCalculadas(c).map(function (z) { return '<td style="color:' + z.color + '">' + z.html + '</td>'; }).join('') +
        '<td><button class="del" data-del="' + i + '" title="Quitar esta actividad">✕</button></td>' +
        '</tr>';
    }).join('');

    $('#ta_c_sub').textContent = 'actualizado ' + S.ahora;
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
    $('#ta_c_sub').textContent = 'actualizado ' + S.ahora;

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
  function rotulo(p) { return esc(p.n) + (p.auto ? ' <span class="auto">auto</span>' : ''); }

  /* ── EL STOCK SE LEE ACÁ, NO SE PUBLICA ───────────────────────────────────
     El archivo entra por el navegador, se calcula y se queda en esta pantalla.
     No hay ningún envío al servidor: no toca el stock del robot ni lo que ven
     las otras computadoras. Alimenta las DOS partes del reporte, porque al
     cargar la foto de ahora se mueve la hora actual de todo el tablero. */
  var STOCK = { 'now-activo': null, 'now-reserva': null };

  /* EL ARRANQUE DEL TURNO lo publica el robot a las 19:00, en el área
     'buffer_c_arranque': artículo por artículo, porque restar totales no sirve. */
  var ARRANQUE = (OPC.fuentes && OPC.fuentes.arranqueBufferC) || { hora: '', fecha: '', bufferC: {} };

  var num = function (v) { return parseFloat(String(v == null ? 0 : v).replace(/,/g, '')) || 0; };

  /* La hora sale del nombre que le pone el robot: "Stock Activo 11-08-26 0600.csv" */
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
    var bufferC = new Map(), buffer = new Map(), totalC = 0, totalB = 0, lineas = 0;
    for (var k = 1; k < l.length; k++) {
      if (!l[k]) continue;
      var c = l[k].split(sep);
      var u = String(c[iU] || '').trim().toUpperCase();
      if (u.indexOf('CDBUFFER') !== 0) continue;
      var q = num(c[iQ]); if (q <= 0) continue;
      var a = String(c[iA] || '').trim();
      lineas++;
      buffer.set(a, (buffer.get(a) || 0) + q); totalB += q;
      if (u.indexOf('CDBUFFER-C') === 0) { bufferC.set(a, (bufferC.get(a) || 0) + q); totalC += q; }
    }
    return { tipo: 'activo', bufferC: bufferC, buffer: buffer, totalC: totalC, totalB: totalB, lineas: lineas };
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
      STOCK[id] = res;
      var det = res.tipo === 'activo'
        ? nf(res.totalB) + ' pares en el buffer · <b>' + nf(res.totalC) + '</b> en el Buffer C'
        : nf(res.total) + ' pares en reserva · ' + nf(res.lineas) + ' líneas';
      infoSlot(id, '<b>' + esc(file.name) + '</b><br>' + (res.hora ? 'foto de las ' + res.hora + ' · ' : '') + det);
      /* Con una foto cargada manda la hora de la foto: el reloj deja de mover
         nada, o el cuadro diría una hora y los números serían de otra. */
      if (id === 'now-activo' && res.hora) { S.ahora = res.hora; mandaLaFoto = true; }
      pintar();
    } catch (err) {
      STOCK[id] = null;
      infoSlot(id, '<span style="color:var(--bad)">No se pudo leer: ' + esc(err.message) + '</span>');
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
  function aplicarFuentes() {
    var F = OPC.fuentes || {};
    S.procs.forEach(function (p) {
      if (!p.fuente || p.fuente === 'bufferC') return;
      var f = F[p.fuente];
      if (!f) return;
      if (typeof f.meta === 'number') p.meta = Math.round(f.meta);
      if (typeof f.avance === 'number') p.av = Math.round(f.avance);
      if (f.unidad) p.u = f.unidad;
      p.auto = true;
    });
  }

  function aplicarStock() {
    var b = STOCK['now-activo'];
    var meta = 0, av = 0;
    Object.keys(ARRANQUE.bufferC).forEach(function (art) {
      var x = ARRANQUE.bufferC[art];
      meta += x;
      if (b) { var y = b.bufferC.get(art) || 0; if (x > y) av += x - y; }
    });
    /* LA META SE MUESTRA SIEMPRE, aunque todavía no se haya cargado la foto de
       ahora: es lo que había en el Buffer C al arrancar el turno y lo publica el
       robot. El AVANCE, en cambio, necesita las dos fotos. */
    S.procs.forEach(function (p) {
      if (p.fuente !== 'bufferC') return;
      if (meta > 0) { p.meta = Math.round(meta); p.u = 'pares'; p.auto = true; }
      if (b) p.av = Math.round(av);
    });
  }

  RAIZ.addEventListener('change', function (e) {
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
    guardar();
  }

  RAIZ.addEventListener('input', function (e) {
    var t = e.target;
    var k = t.getAttribute('data-k');
    if (!k) return;
    var i = Number(t.getAttribute('data-i'));
    S.procs[i][k] = k === 'cuenta' ? t.checked
      : (k === 'meta' || k === 'av') ? (t.value === '' ? 0 : Number(t.value))
      : t.value;
    pintar({ t: t.getAttribute('data-t'), k: k, i: i, p: (t.selectionStart == null ? 0 : t.selectionStart) });
  });

  RAIZ.addEventListener('click', function (e) {
    var d = e.target.getAttribute && e.target.getAttribute('data-del');
    if (d !== null && d !== undefined) { S.procs.splice(Number(d), 1); pintar(); return; }
    if (e.target.id === 'ta_b_add' || e.target.id === 'ta_b_add2') {
      /* `cuenta: true` no es un detalle: sin él la actividad nueva nacía sin la
         marca de "tiene meta", salía en el Gantt y NO en el Cumplimiento. El
         relleno solo corre al montar la pantalla, así que aparecía
         recién al recargar. */
      S.procs.push({ n: 'Actividad nueva', u: 'unidades', meta: 0, av: 0, pi: '', pf: '', ri: '', rf: '', cuenta: true });
      pintar();
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
  }
  arrancar();
};
