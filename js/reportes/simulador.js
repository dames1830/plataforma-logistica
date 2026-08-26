/**
 * SIMULADOR DE DOTACIÓN Y CAPACIDAD DEL TURNO
 *
 * Vive en Administración → Simulador. Pedido de Daniel el 26-ago-2026, después del
 * comité de las 50.000 unidades: *"de repente yo voy con un formato y le digo estas son
 * 32 personas, y después me dicen pero calcúlalo con 28, ¿y qué le voy a presentar?
 * ¿Tengo que volver otro día?"*. De ahí sale todo lo que hace esta pantalla: mover la
 * gente y el horario delante del comité y que los números se acomoden solos.
 *
 * TODO VA ENCERRADO BAJO `#sim`, igual que turno_actividades.js. Los nombres que usa
 * —panel, campo, frente, medido— sueltos chocarían con los del tablero.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC` y quien lo monta
 * —dashboard_v28.js— se encarga de buscarlo:
 *
 *   OPC.medidos     lo que la plataforma mide sobre las tareas reales
 *   OPC.estado      los parámetros guardados (horarios, gente, rendimientos)
 *   OPC.alGuardar   se llama con el estado cada vez que algo cambia
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * LA REGLA DE ESTA PANTALLA: LO QUE SE MIDE NO SE ESCRIBE
 *
 * Daniel, 26-ago-2026: *"ocupación real, ¿yo tengo que poner el número ahí? Si es que yo
 * no tengo que editar nada, entonces bloquéalo, pues"*.
 *
 * Tiene razón, y vale para más de un campo. Van cerrados los tres que la plataforma
 * calcula sola de las tareas finalizadas:
 *
 *   OCUPACIÓN REAL     tiempo dentro de tareas ÷ tiempo en el piso
 *   PARES POR HORA     de las mismas tareas
 *   PERSONAS POR GRUPO de las mismas tareas (hoy, todas son de a 2)
 *
 * Se pueden abrir para simular —"¿y si llegamos al 90 %?" es pregunta legítima de
 * comité— pero entonces la pantalla lo avisa y la lámina del PPT sale marcada
 * ESCENARIO SIMULADO. Un supuesto que viaja con cara de medición es la peor manera
 * de perder un comité.
 *
 * Lo de slotting y buffer NO va cerrado, y no es un olvido: nadie los midió todavía.
 * El módulo de Slotting está en construcción y el stock no trae usuario, así que no
 * hay de dónde sacar su ritmo.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * EL GENERADOR DE PRESENTACIONES PESA 477 KB y se baja RECIÉN cuando se pide la
 * lámina. Cargado en index.html se lo comería toda la plataforma en cada arranque,
 * aunque nadie abriera esta pantalla.
 */

const CDN_PPTX = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
const NOMBRE_PPT = 'Simulador_Dotacion.pptx';

/* ── Los parámetros de arranque ───────────────────────────────────────────────
 * Los horarios son los que dictó Daniel midiendo el piso: entra 20:00, la charla
 * termina 20:20, a las 20:30 arrancan las tareas, 06:00 se corta para BPA y 06:30
 * se sale. La jornada del servidor dice 19:00–06:45, pero ESA ES LA DEL TURNO, no
 * la del operario. */
export const BASE = {
    entrada: '20:00', arranque: '20:30', bpa: '06:00', salida: '06:30',
    cena: '01:00', cenaMin: 60,
    aGrupos: 16, sPers: 5, sEnc: 1, sUph: 200,
    bGrupos: 2, bTam: 5, bPal: 70, bMonta: 2,
    meta: 50000
};

const CSS = `
#sim {
  color-scheme: var(--scheme);
  --bg: var(--panel-deeper);
  --panel: var(--panel-alt);
  --panel-2: rgba(var(--ink-rgb), 0.07);
  --line: rgba(var(--ink-rgb), 0.16);
  --line-2: rgba(var(--ink-rgb), 0.34);
  --text: var(--blue-pale);
  --text-2: var(--text-muted);
  --text-3: var(--text-dim);
  --accent: var(--brand-light);
  --accent-soft: var(--panel-deep);
  --ok: var(--success);
  --ok-soft: rgba(var(--success-rgb), 0.18);
  --warn: var(--warning);
  --warn-soft: rgba(var(--warning-rgb), 0.18);
  --bad: var(--danger);
  --bad-soft: rgba(var(--danger-rgb), 0.18);
  --alm: var(--warning);       --alm-soft: rgba(var(--warning-rgb), 0.16);
  --slo: var(--primary-2);     --slo-soft: rgba(var(--ink-rgb), 0.10);
  --buf: var(--success);       --buf-soft: rgba(var(--success-rgb), 0.14);
  --cena-c: var(--yellow);
  --gris-tramo: var(--text-faint);
}

#sim *, #sim *::before, #sim *::after { box-sizing: border-box; }
#sim { color: var(--text); font-size: var(--t-md); line-height: 1.55; }
#sim .page { max-width: 1180px; margin: 0 auto; }

#sim .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 16px; }
#sim .panel-h { padding: 13px 18px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
#sim .panel-h h2 { margin: 0; flex: 1; font-size: var(--t-xs); font-weight: 800; letter-spacing: .09em;
  text-transform: uppercase; color: var(--text-2); }
/* Sin esto el botón del encabezado se estira a todo el ancho sobrante: los botones
   de main.css vienen con ancho completo y acá el flex se lo respeta.
   OJO: nada de acentos graves en este bloque — el CSS vive dentro de un template
   literal y un acento grave suelto lo cierra a la mitad. Ya rompió la pantalla una vez. */
#sim .panel-h .btn { flex: none; width: auto; }
#sim .panel-b { padding: 18px; }
#sim .nota { font-size: var(--t-xs); color: var(--text-3); line-height: 1.7; }
#sim .nota b { color: var(--text-2); }

#sim .cabecera { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
  flex-wrap: wrap; margin-bottom: 18px; }
#sim h1 { margin: 0 0 4px; font-size: var(--t-xl); font-weight: 800; letter-spacing: -.01em; color: var(--text); }
#sim .sub { color: var(--text-3); font-size: var(--t-sm); }
#sim .acciones { text-align: right; }
#sim .estado-proc { font-size: var(--t-xs); color: var(--text-3); margin-top: 7px; max-width: 340px; line-height: 1.6; }
#sim .estado-proc.listo { color: var(--ok); font-weight: 700; }
#sim .estado-proc.error { color: var(--bad); font-weight: 700; }

#sim .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
#sim .kpi { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
#sim .kpi .lab { font-size: var(--t-xs); font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: var(--text-3); margin-bottom: 6px; }
#sim .kpi .val { font-size: var(--t-2xl); font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; }
#sim .kpi .pie { font-size: var(--t-xs); color: var(--text-3); margin-top: 3px; }
#sim .kpi.alm .val { color: var(--alm); }
#sim .kpi.slo .val { color: var(--slo); }
#sim .kpi.buf .val { color: var(--buf); }
#sim .kpi.tot { background: var(--accent-soft); border-color: transparent; }
#sim .kpi.tot .val { color: var(--accent); }
#sim .kpi.tot .lab { color: var(--accent); opacity: .85; }

#sim .leyenda { display: flex; gap: 26px; flex-wrap: wrap; margin-bottom: 16px; padding: 10px 16px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
  font-size: var(--t-xs); color: var(--text-2); }
#sim .leyenda b.v { color: var(--ok); }
#sim .leyenda b.e { color: var(--accent); }
#sim .leyenda.simulando { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }

#sim .campos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 18px; }
#sim .campo label { display: block; font-size: var(--t-xs); font-weight: 700; color: var(--text-2); margin-bottom: 5px; }
#sim input[type="time"], #sim input[type="number"] { width: 100%; padding: 7px 9px;
  font-family: inherit; font-size: var(--t-md); font-weight: 700; color: var(--text);
  background: var(--panel-2); border: 1px solid var(--line-2); border-radius: 7px;
  font-variant-numeric: tabular-nums; }
#sim input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* Lo que la plataforma mide va cerrado. Ver la cabecera del archivo. */
#sim .medido { position: relative; }
#sim .medido input { background: transparent; border-color: transparent; padding-left: 0;
  color: var(--ok); cursor: default; }
#sim .medido input:read-only:focus-visible { outline: none; }
#sim .medido.abierto input { background: var(--warn-soft); border-color: var(--warn);
  color: var(--warn); padding-left: 9px; cursor: auto; }
#sim .candado { position: absolute; right: 0; top: -1px; background: none; border: none;
  cursor: pointer; font-size: var(--t-sm); padding: 2px 4px; line-height: 1; opacity: .55; }
#sim .candado:hover { opacity: 1; }
#sim .fuente { font-size: var(--t-xs); color: var(--text-3); line-height: 1.7; margin-top: 2px; }
#sim .fuente b { color: var(--ok); }
#sim .uph-op { font-family: inherit; font-size: var(--t-xs); color: var(--text-2); cursor: pointer;
  background: var(--panel-2); border: 1px solid var(--line-2); border-radius: 20px;
  padding: 2px 10px; margin: 3px 5px 3px 0; }
#sim .uph-op b { color: var(--text-2); }
#sim .uph-op:hover { border-color: var(--ok); }
#sim .uph-op.on { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
#sim .uph-op.on b { color: var(--ok); }
#sim .medido.abierto .fuente b { color: var(--warn); }
#sim .fila-p.medido input { text-align: right; padding-right: 20px; }
#sim .fila-p .candado { top: 6px; right: -2px; }

#sim .turno-barra { position: relative; height: 46px; border-radius: 8px; overflow: hidden;
  background: var(--panel-2); border: 1px solid var(--line); margin-top: 6px; }
/* EL RÓTULO VA A LA IZQUIERDA, no centrado: el refrigerio se dibuja ENCIMA del tramo
   de tareas y, con los dos textos centrados, tapaba la palabra TAREAS justo en el
   medio. Al ras de su borde, cada tramo muestra el suyo.
   El color sale de --on-accent, que se invierte con el tema: en claro el ámbar es
   oscuro y el texto va blanco; en oscuro el ámbar es brillante y el texto va negro. */
#sim .tramo { position: absolute; top: 0; height: 100%; display: flex; align-items: center;
  justify-content: flex-start; padding-left: 9px; font-size: var(--t-xs); font-weight: 800;
  letter-spacing: .04em; overflow: hidden; white-space: nowrap; color: var(--on-accent, #10151f); }
/* Dos niveles: 20:00 y 20:30 en un turno de 10 h caen a menos de 5 % de distancia
   y una hora se escribiría encima de la otra. */
#sim .reglas { position: relative; height: 32px; margin-top: 4px; }
#sim .marca { position: absolute; top: 0; font-size: var(--t-xs); font-weight: 700; color: var(--text-3);
  transform: translateX(-50%); font-variant-numeric: tabular-nums; white-space: nowrap; }
#sim .marca.baja { top: 15px; }
#sim .marca.baja::before { content: ''; position: absolute; left: 50%; top: -13px; height: 11px;
  border-left: 1px dotted var(--line-2); }

#sim .formula { margin-top: 16px; padding: 13px 15px; background: var(--panel-2); border-radius: 9px;
  font-size: var(--t-sm); line-height: 2; border: 1px solid var(--line); }
#sim .formula b { font-variant-numeric: tabular-nums; }
#sim .formula .res { color: var(--accent); font-weight: 800; }

#sim .frentes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
#sim .frente { border: 1px solid var(--line); border-radius: 12px; background: var(--panel);
  display: flex; flex-direction: column; }
#sim .frente-h { padding: 12px 16px 10px; }
#sim .frente-h .tit { font-size: var(--t-xs); font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
#sim .frente.a .tit { color: var(--alm); }
#sim .frente.s .tit { color: var(--slo); }
#sim .frente.b .tit { color: var(--buf); }
#sim .frente-h .des { font-size: var(--t-xs); color: var(--text-3); margin-top: 2px; }
#sim .frente-b { padding: 0 16px 16px; display: flex; flex-direction: column; flex: 1; }

#sim .stepper { display: flex; align-items: center; gap: 8px; margin: 4px 0 2px; }
#sim .stepper button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-2);
  background: var(--panel-2); color: var(--text); font-size: var(--t-lg); font-weight: 800;
  cursor: pointer; line-height: 1; display: flex; align-items: center; justify-content: center; }
#sim .stepper button:hover { border-color: var(--accent); color: var(--accent); }
#sim .stepper .n { min-width: 44px; text-align: center; font-size: var(--t-xl); font-weight: 800;
  font-variant-numeric: tabular-nums; }
#sim .stepper .u { font-size: var(--t-xs); color: var(--text-2); }

#sim .fila-p { display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 0; border-top: 1px solid var(--line); font-size: var(--t-sm); position: relative; }
#sim .fila-p span { color: var(--text-2); }
#sim .fila-p input { width: 78px; padding: 4px 7px; font-size: var(--t-sm); text-align: right; }

#sim .salida { margin-top: auto; padding: 11px 13px; border-radius: 9px;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
#sim .frente.a .salida { background: var(--alm-soft); }
#sim .frente.s .salida { background: var(--slo-soft); }
#sim .frente.b .salida { background: var(--buf-soft); }
#sim .salida .big { font-size: var(--t-xl); font-weight: 800; font-variant-numeric: tabular-nums; }
#sim .frente.a .salida .big { color: var(--alm); }
#sim .frente.s .salida .big { color: var(--slo); }
#sim .frente.b .salida .big { color: var(--buf); }
#sim .salida .lab { font-size: var(--t-xs); font-weight: 700; opacity: .85; }
#sim .frente.a .salida .lab { color: var(--alm); }
#sim .frente.s .salida .lab { color: var(--slo); }
#sim .frente.b .salida .lab { color: var(--buf); }

#sim .meta-fila { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
#sim .meta-campo { width: 150px; }
#sim .barra-meta { flex: 1; min-width: 260px; height: 30px; border-radius: 8px; background: var(--panel-2);
  border: 1px solid var(--line); position: relative; overflow: hidden; }
#sim .barra-meta .rell { position: absolute; left: 0; top: 0; height: 100%; opacity: .85; }
#sim .barra-meta .txt { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; font-size: var(--t-sm); font-weight: 800; color: var(--text);
  font-variant-numeric: tabular-nums; }
#sim .veredicto { padding: 11px 14px; border-radius: 9px; font-size: var(--t-sm); font-weight: 700; margin-top: 14px; }
#sim .veredicto.ok { background: var(--ok-soft); color: var(--ok); }
#sim .veredicto.no { background: var(--bad-soft); color: var(--bad); }

#sim .btn { padding: 8px 15px; border-radius: 8px; border: 1px solid var(--accent);
  background: var(--accent); color: var(--panel-deeper); font-family: inherit;
  font-size: var(--t-xs); font-weight: 800; cursor: pointer; white-space: nowrap; }
#sim .btn.sec { background: transparent; color: var(--accent); }
#sim .btn:hover { filter: brightness(1.08); }
#sim .btn.grande { padding: 12px 20px; font-size: var(--t-sm); border-radius: 10px; }
#sim .btn:disabled { opacity: .6; cursor: progress; }

#sim .comp { display: flex; align-items: flex-end; gap: 10px; height: 190px; padding-top: 8px; }
#sim .comp-col { flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: flex-end; height: 100%; }
#sim .comp-bar { width: 100%; border-radius: 7px 7px 0 0; background: var(--gris-tramo); }
#sim .comp-col.cumple .comp-bar { background: var(--ok); }
#sim .comp-col.actual .comp-bar { background: var(--alm); }
#sim .comp-val { font-size: var(--t-xs); font-weight: 800; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
#sim .comp-pie { margin-top: 7px; text-align: center; font-size: var(--t-xs); line-height: 1.35; }
#sim .comp-pie b { display: block; font-size: var(--t-md); font-variant-numeric: tabular-nums; }
#sim .comp-col.actual .comp-pie b { color: var(--alm); }
#sim .comp-wrap { position: relative; }
#sim .linea-meta { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--bad);
  font-size: var(--t-xs); font-weight: 800; color: var(--bad); text-align: right; pointer-events: none; }

#sim .resumen { font-size: var(--t-md); line-height: 2; }
#sim .resumen b { font-variant-numeric: tabular-nums; }
#sim .chip { display: inline-block; padding: 1px 8px; border-radius: 20px; font-size: var(--t-sm);
  font-weight: 800; font-variant-numeric: tabular-nums; }
#sim .chip.a { background: var(--alm-soft); color: var(--alm); }
#sim .chip.s { background: var(--slo-soft); color: var(--slo); }
#sim .chip.b { background: var(--buf-soft); color: var(--buf); }
#sim .aviso { margin-top: 14px; padding: 12px 15px; border-radius: 9px; background: var(--warn-soft);
  color: var(--warn); font-size: var(--t-sm); line-height: 1.75; font-weight: 600; }

@media (max-width: 980px) {
  #sim .kpis, #sim .campos { grid-template-columns: repeat(2, 1fr); }
  #sim .frentes { grid-template-columns: 1fr; }
}
`;

const HTML = `
<div class="page">
  <div class="cabecera">
    <div>
      <h1>🧮 Simulador de dotación</h1>
      <div class="sub">Mueva la gente y el horario, y vea cuánto se produce.</div>
    </div>
    <div class="acciones">
      <button class="btn grande" id="sim_procesar">📊 PROCESAR Y GENERAR PRESENTACIÓN</button>
      <div class="estado-proc" id="sim_estado">La presentación sale siempre con el mismo nombre.</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi alm"><div class="lab">Almacenamiento</div><div class="val" id="sim_k_alm">—</div>
      <div class="pie" id="sim_k_alm_pie">pares en el turno</div></div>
    <div class="kpi slo"><div class="lab">Slotting</div><div class="val" id="sim_k_slo">—</div>
      <div class="pie" id="sim_k_slo_pie">pares en el turno</div></div>
    <div class="kpi buf"><div class="lab">Buffer</div><div class="val" id="sim_k_buf">—</div>
      <div class="pie" id="sim_k_buf_pie">paletas en el turno</div></div>
    <div class="kpi tot"><div class="lab">Personal del turno</div><div class="val" id="sim_k_tot">—</div>
      <div class="pie" id="sim_k_tot_pie">personas</div></div>
  </div>

  <div class="leyenda" id="sim_leyenda"></div>

  <div class="panel">
    <div class="panel-h"><h2>1 · La jornada</h2>
      <button class="btn sec" id="sim_reset">Volver al horario de hoy</button></div>
    <div class="panel-b">
      <div class="campos">
        <div class="campo"><label>Entrada del turno</label><input type="time" id="sim_entrada"></div>
        <div class="campo"><label>Arranque de tareas</label><input type="time" id="sim_arranque"></div>
        <div class="campo"><label>Corte para BPA</label><input type="time" id="sim_bpa"></div>
        <div class="campo"><label>Salida</label><input type="time" id="sim_salida"></div>
        <div class="campo"><label>Refrigerio empieza</label><input type="time" id="sim_cena"></div>
        <div class="campo"><label>Refrigerio dura (min)</label><input type="number" id="sim_cenaMin" min="0" max="180" step="5"></div>
        <div class="campo medido" id="sim_c_ocup">
          <label>Ocupación real (%) 🔒</label>
          <button class="candado" data-abre="sim_c_ocup" title="Lo mide la plataforma. Ábralo solo para simular.">🔓</button>
          <input type="number" id="sim_ocup" min="30" max="100" step="1" readonly>
          <div class="fuente" id="sim_f_ocup"></div>
        </div>
        <div class="campo"><label>Horas efectivas</label>
          <div style="padding:7px 0; font-size:var(--t-xl); font-weight:800; color:var(--accent); font-variant-numeric:tabular-nums;" id="sim_efec">—</div></div>
      </div>
      <div style="margin-top:18px;">
        <div class="turno-barra" id="sim_barra"></div>
        <div class="reglas" id="sim_reglas"></div>
      </div>
      <div class="formula" id="sim_formula"></div>
      <div class="nota" style="margin-top:12px;">
        La <b>ocupación real</b> es la única cifra que no se negocia: la mide la plataforma comparando el
        tiempo que un grupo pasa dentro de tareas contra el que pasa en el piso. Baños, traslados y
        coordinación ya están descontados ahí — no hay que volver a restarlos.
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-h"><h2>2 · Los tres frentes</h2></div>
    <div class="panel-b">
      <div class="frentes">
        <div class="frente a">
          <div class="frente-h"><div class="tit">Almacenamiento</div>
            <div class="des">Del buffer a su ubicación definitiva</div></div>
          <div class="frente-b">
            <div class="stepper">
              <button data-paso="-1" data-campo="aGrupos">−</button>
              <div class="n" id="sim_n_aGrupos">—</div>
              <button data-paso="1" data-campo="aGrupos">+</button>
              <div class="u">grupos de <b id="sim_n_aTam">—</b> = <b id="sim_n_aPers">—</b> personas</div>
            </div>
            <div class="fila-p medido" id="sim_c_aTam"><span>Personas por grupo 🔒</span>
              <input type="number" id="sim_aTam" min="1" max="6" readonly>
              <button class="candado" data-abre="sim_c_aTam" title="Lo mide la plataforma. Ábralo solo para simular.">🔓</button></div>
            <div class="fila-p medido" id="sim_c_aUph"><span>Pares por hora, por grupo 🔒</span>
              <input type="number" id="sim_aUph" min="50" max="3000" step="10" readonly>
              <button class="candado" data-abre="sim_c_aUph" title="Lo mide la plataforma. Ábralo solo para simular.">🔓</button></div>
            <div class="fuente" id="sim_f_uph" style="padding-bottom:6px;"></div>
            <div class="fila-p"><span>Pares por grupo en el turno</span><b id="sim_v_aGrupo">—</b></div>
            <div class="salida">
              <div><div class="big" id="sim_v_aTotal">—</div><div class="lab">PARES EN EL TURNO</div></div>
              <div style="text-align:right;"><div style="font-size:var(--t-xs); color:var(--text-3);">por persona</div>
                <b id="sim_v_aPp" style="font-size:var(--t-md);">—</b></div>
            </div>
          </div>
        </div>

        <div class="frente s">
          <div class="frente-h"><div class="tit">Slotting</div>
            <div class="des">Reacomodo del piso · el encargado guía, no mueve</div></div>
          <div class="frente-b">
            <div class="stepper">
              <button data-paso="-1" data-campo="sPers">−</button>
              <div class="n" id="sim_n_sPers">—</div>
              <button data-paso="1" data-campo="sPers">+</button>
              <div class="u">personas · <b id="sim_n_sProd">—</b> mueven carga</div>
            </div>
            <div class="fila-p"><span>Encargados que solo guían</span>
              <input type="number" id="sim_sEnc" min="0" max="6"></div>
            <div class="fila-p"><span>Pares por hora, por persona</span>
              <input type="number" id="sim_sUph" min="20" max="2000" step="10"></div>
            <div class="fuente" style="padding-bottom:6px;">Nadie midió esta tarea todavía: el módulo de Slotting
              está en construcción y el stock no trae usuario. Los dos números de arriba son un supuesto.</div>
            <div class="fila-p"><span>Pares por persona en el turno</span><b id="sim_v_sPersona">—</b></div>
            <div class="salida">
              <div><div class="big" id="sim_v_sTotal">—</div><div class="lab">PARES EN EL TURNO</div></div>
              <div style="text-align:right;"><div style="font-size:var(--t-xs); color:var(--text-3);">sin medición</div>
                <b style="font-size:var(--t-sm);">a comprobar</b></div>
            </div>
          </div>
        </div>

        <div class="frente b">
          <div class="frente-h"><div class="tit">Buffer · de reserva al activo</div>
            <div class="des">Bajar la paleta y dejarla matriculada</div></div>
          <div class="frente-b">
            <div class="stepper">
              <button data-paso="-1" data-campo="bGrupos">−</button>
              <div class="n" id="sim_n_bGrupos">—</div>
              <button data-paso="1" data-campo="bGrupos">+</button>
              <div class="u">grupos de <b id="sim_n_bTam">—</b> = <b id="sim_n_bPers">—</b> personas</div>
            </div>
            <div class="fila-p"><span>Personas por grupo</span>
              <input type="number" id="sim_bTam" min="1" max="12"></div>
            <div class="fila-p"><span>Paletas por grupo en el turno</span>
              <input type="number" id="sim_bPal" min="5" max="400" step="5"></div>
            <div class="fila-p"><span>Montacarguistas</span>
              <input type="number" id="sim_bMonta" min="0" max="10"></div>
            <div class="salida">
              <div><div class="big" id="sim_v_bTotal">—</div><div class="lab">PALETAS EN EL TURNO</div></div>
              <div style="text-align:right;"><div style="font-size:var(--t-xs); color:var(--text-3);">un grupo saca una cada</div>
                <b id="sim_v_bRitmo" style="font-size:var(--t-md);">—</b></div>
            </div>
          </div>
        </div>
      </div>
      <div class="nota" id="sim_nota_buffer" style="margin-top:14px;"></div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-h"><h2>3 · Contra la meta</h2>
      <button class="btn" id="sim_ajustar">Ajustar la gente a la meta</button></div>
    <div class="panel-b">
      <div class="meta-fila">
        <div class="campo meta-campo"><label>Meta de pares por día</label>
          <input type="number" id="sim_meta" min="1000" max="500000" step="1000"></div>
        <div class="barra-meta"><div class="rell" id="sim_meta_rell"></div><div class="txt" id="sim_meta_txt"></div></div>
      </div>
      <div class="veredicto" id="sim_veredicto"></div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-h"><h2>4 · Si en el comité le piden otro número</h2>
      <span class="nota">Almacenamiento, con el horario y el rendimiento de arriba</span></div>
    <div class="panel-b">
      <div class="comp-wrap"><div class="comp" id="sim_comp"></div>
        <div class="linea-meta" id="sim_linea_meta"></div></div>
      <div class="nota" style="margin-top:14px;">
        Cada columna es una dotación distinta. Las <b style="color:var(--ok)">verdes</b> llegan a la meta,
        la <b style="color:var(--alm)">naranja</b> es la que está cargada arriba.
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-h"><h2>5 · Lo que se lleva al comité</h2></div>
    <div class="panel-b">
      <div class="resumen" id="sim_resumen"></div>
      <div class="aviso" id="sim_aviso"></div>
    </div>
  </div>
</div>
`;

/** Dibuja el simulador dentro de `RAIZ`. Ver la cabecera del archivo por el contrato de OPC. */
export const montarSimulador = function (RAIZ, OPC) {
    OPC = OPC || {};
    const M = OPC.medidos || {};
    /* REDONDEA ANTES DE FORMATEAR. Sin el Math.round, 513 × 7,14 × 16 sale como
       "58,605.12" en el cuadro grande: nadie almacena doce centésimas de par. */
    const nMil = (n) => Math.round(Number(n) || 0).toLocaleString('es-PE');

    /* Los medidos son el piso de esta pantalla: si por lo que sea no llegaron —una PC que
       entra sin haber pasado nunca por Almacenaje— se cae al valor conocido en vez de
       dejar la pantalla en cero, que se leería como "no se produce nada". */
    const MED = {
        ocup: Number.isFinite(M.ocupPct) ? Math.round(M.ocupPct) : 84,
        aTam: Number.isFinite(M.tamGrupo) ? M.tamGrupo : 2,
        aUph: Number.isFinite(M.uphPonderada) ? Math.round(M.uphPonderada) : 450
    };

    /* LOS MEDIDOS VAN ÚLTIMOS, y eso es a propósito: pisan a lo guardado. Son datos,
       no configuración. Si se guardaran, el día que la medición cambie —porque
       entraron tareas nuevas— la pantalla seguiría mostrando la de hace un mes y
       encima la marcaría como "simulada" por no coincidir consigo misma. */
    const ARRANQUE = { ...BASE, ...(OPC.estado || {}), ...MED };
    const S = { ...ARRANQUE };

    /** Las dos lecturas del mismo dato. Ninguna de las dos es "simular". */
    const UPH_REAL = MED.aUph;
    const UPH_TIPICA = Number.isFinite(M.uphMediana) && M.uphMediana > 0 ? Math.round(M.uphMediana) : MED.aUph;

    /* Las paletas por grupo se midieron sobre un turno de este largo. Si el horario se
       mueve, el total de paletas se mueve con él. Se fija con el horario de arranque y no
       se vuelve a tocar: si se recalculara en cada dibujo, el total nunca cambiaría. */
    let HORAS_REF = null;

    const $ = (id) => RAIZ.querySelector('#' + id);
    const hhmm = (min) => {
        const h = Math.floor(min / 60), m = Math.round(min % 60);
        return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
    };

    /** Minutos desde la entrada del turno. Suma 24 h cuando la hora ya cruzó la medianoche:
     *  sin esto las 06:00 quedan ANTES de las 20:00 y todo el turno sale negativo. */
    const desdeEntrada = (hora, entrada) => {
        const [h, m] = String(hora || '00:00').split(':').map(Number);
        const [he, me] = String(entrada || '00:00').split(':').map(Number);
        let d = (h * 60 + m) - (he * 60 + me);
        if (d < 0) d += 24 * 60;
        return d;
    };

    // ── EL CÁLCULO ───────────────────────────────────────────────────────────
    function calcular() {
        const tArranque = desdeEntrada(S.arranque, S.entrada);
        const tBpa = desdeEntrada(S.bpa, S.entrada);
        const tSalida = desdeEntrada(S.salida, S.entrada);
        const tCena = desdeEntrada(S.cena, S.entrada);

        const ventana = Math.max(0, tBpa - tArranque);
        // El refrigerio solo descuenta si cae DENTRO de la ventana de trabajo.
        const cenaDentro = (tCena >= tArranque && tCena < tBpa) ? Math.min(S.cenaMin, tBpa - tCena) : 0;
        const disponible = Math.max(0, ventana - cenaDentro);
        const efectivas = disponible * (S.ocup / 100) / 60;

        if (HORAS_REF === null) HORAS_REF = efectivas || 1;

        const aPers = S.aGrupos * S.aTam;
        const aGrupo = S.aUph * efectivas;
        const aTotal = aGrupo * S.aGrupos;

        const sProd = Math.max(0, S.sPers - S.sEnc);
        const sPersona = S.sUph * efectivas;
        const sTotal = sPersona * sProd;

        const bPers = S.bGrupos * S.bTam;
        const bTotal = S.bPal * S.bGrupos * (HORAS_REF > 0 ? efectivas / HORAS_REF : 1);
        const porGrupo = bTotal / Math.max(1, S.bGrupos);
        const bRitmo = porGrupo > 0 ? (efectivas * 60) / porGrupo : 0;

        return {
            tArranque, tBpa, tSalida, tCena, ventana, cenaDentro, disponible, efectivas,
            aPers, aGrupo, aTotal, sProd, sPersona, sTotal, bPers, bTotal, bRitmo,
            total: aPers + S.sPers + bPers + S.bMonta
        };
    }

    // ── LOS CANDADOS ─────────────────────────────────────────────────────────
    const MEDIDOS = { sim_ocup: 'ocup', sim_aTam: 'aTam', sim_aUph: 'aUph' };
    /* El ritmo tiene DOS valores medidos válidos —el real y el de la tarea típica—;
       elegir entre ellos no es simular, es elegir con qué mezcla de trabajo se
       proyecta. Cualquier otro número sí es un supuesto puesto a mano. */
    const haySimulado = () =>
        Number(S.ocup) !== Number(MED.ocup)
        || Number(S.aTam) !== Number(MED.aTam)
        || (Number(S.aUph) !== UPH_REAL && Number(S.aUph) !== UPH_TIPICA);

    function refrescarLeyenda() {
        const l = $('sim_leyenda');
        const sim = haySimulado();
        l.className = 'leyenda' + (sim ? ' simulando' : '');
        l.innerHTML = sim
            ? '<span>⚠️ <b>Está simulando</b> — hay un dato medido cambiado a mano. La presentación lo va a decir.</span>'
            : '<span><b class="v">🔒 Con candado</b> — lo mide la plataforma sola, usted no lo escribe.</span>'
            + '<span><b class="e">Lo demás</b> — lo define usted: los horarios, la gente y la meta.</span>';
    }

    // ── EL DIBUJO ────────────────────────────────────────────────────────────
    function pintarBarra(R) {
        const largo = Math.max(R.tSalida, 1);
        const pct = (min) => (min / largo) * 100;
        const tramos = [
            { ini: 0, fin: R.tArranque, txt: 'CHARLA', color: 'var(--gris-tramo)' },
            { ini: R.tArranque, fin: R.tBpa, txt: 'TAREAS', color: 'var(--alm)' },
            { ini: R.tBpa, fin: R.tSalida, txt: 'BPA', color: 'var(--slo)' }
        ];
        if (R.cenaDentro > 0) tramos.push({ ini: R.tCena, fin: R.tCena + R.cenaDentro, txt: 'REFRIGERIO', color: 'var(--cena-c)' });

        $('sim_barra').innerHTML = tramos.filter(t => t.fin > t.ini).map(t => {
            const ancho = pct(t.fin - t.ini);
            return `<div class="tramo" style="left:${pct(t.ini)}%; width:${ancho}%; background:${t.color};">`
                + (ancho > 7 ? t.txt : '') + '</div>';
        }).join('');

        const marcas = [
            { t: 0, h: S.entrada }, { t: R.tArranque, h: S.arranque },
            { t: R.tBpa, h: S.bpa }, { t: R.tSalida, h: S.salida }
        ];
        if (R.cenaDentro > 0) marcas.push({ t: R.tCena, h: S.cena });
        marcas.sort((a, b) => a.t - b.t);
        let ultima = -99;
        $('sim_reglas').innerHTML = marcas.map(m => {
            const p = pct(m.t);
            const choca = (p - ultima) < 7;   // menos de 7 % son unos 25 px: se pisarían
            if (!choca) ultima = p;
            return `<div class="marca${choca ? ' baja' : ''}" style="left:${Math.min(97, Math.max(3, p))}%;">${m.h}</div>`;
        }).join('');
    }

    function pintarComparador(R) {
        const centro = S.aGrupos;
        const grupos = [];
        for (let i = -3; i <= 3; i++) if (centro + i >= 1) grupos.push(centro + i);
        const datos = grupos.map(g => ({ g, pers: g * S.aTam, pares: R.aGrupo * g }));
        const tope = Math.max(S.meta, ...datos.map(d => d.pares)) * 1.08 || 1;

        $('sim_comp').innerHTML = datos.map(d => {
            const clases = ['comp-col'];
            if (d.pares >= S.meta) clases.push('cumple');
            if (d.g === centro) clases.push('actual');
            return `<div class="${clases.join(' ')}"><div class="comp-val">${nMil(d.pares)}</div>`
                + `<div class="comp-bar" style="height:${(d.pares / tope) * 100}%;"></div>`
                + `<div class="comp-pie"><b>${d.pers}</b>personas</div></div>`;
        }).join('');

        const ALTO = 190;
        $('sim_linea_meta').style.top = (ALTO - (S.meta / tope) * ALTO) + 'px';
        $('sim_linea_meta').textContent = 'meta ' + nMil(S.meta) + ' ';
    }

    function pintar() {
        const R = calcular();

        $('sim_k_alm').textContent = nMil(R.aTotal);
        $('sim_k_alm_pie').textContent = `${S.aGrupos} grupos · ${R.aPers} personas`;
        $('sim_k_slo').textContent = nMil(R.sTotal);
        $('sim_k_slo_pie').textContent = `${R.sProd} de ${S.sPers} mueven carga`;
        $('sim_k_buf').textContent = nMil(R.bTotal);
        $('sim_k_buf_pie').textContent = `${S.bGrupos} grupos · ${R.bPers} personas`;
        $('sim_k_tot').textContent = R.total;
        $('sim_k_tot_pie').textContent = `${R.aPers} + ${S.sPers} + ${R.bPers} + ${S.bMonta} montacarguistas`;

        $('sim_efec').textContent = hhmm(R.efectivas * 60);
        pintarBarra(R);
        $('sim_formula').innerHTML =
            `<b>${hhmm(R.ventana)}</b> de ventana <span style="color:var(--text-3)">(${S.arranque} a ${S.bpa})</span>`
            + `&nbsp; menos <b>${R.cenaDentro} min</b> de refrigerio &nbsp;=&nbsp; <b>${hhmm(R.disponible)}</b> disponibles<br>`
            + `<b>${hhmm(R.disponible)}</b> × <b>${S.ocup} %</b> de ocupación real &nbsp;=&nbsp; `
            + `<span class="res">${hhmm(R.efectivas * 60)} efectivas por persona</span>`;

        $('sim_n_aGrupos').textContent = S.aGrupos;
        $('sim_n_aTam').textContent = S.aTam;
        $('sim_n_aPers').textContent = R.aPers;
        $('sim_v_aGrupo').textContent = nMil(R.aGrupo) + ' pares';
        $('sim_v_aTotal').textContent = nMil(R.aTotal);
        $('sim_v_aPp').textContent = nMil(R.aTotal / Math.max(1, R.aPers)) + ' pares';

        $('sim_n_sPers').textContent = S.sPers;
        $('sim_n_sProd').textContent = R.sProd;
        $('sim_v_sPersona').textContent = nMil(R.sPersona) + ' pares';
        $('sim_v_sTotal').textContent = nMil(R.sTotal);

        $('sim_n_bGrupos').textContent = S.bGrupos;
        $('sim_n_bTam').textContent = S.bTam;
        $('sim_n_bPers').textContent = R.bPers;
        $('sim_v_bTotal').textContent = nMil(R.bTotal);
        $('sim_v_bRitmo').textContent = R.bRitmo > 0 ? Math.round(R.bRitmo) + ' min' : '—';

        $('sim_nota_buffer').innerHTML =
            `Las <b>${nMil(S.bPal)} paletas por grupo</b> están medidas sobre un turno de <b>${hhmm(HORAS_REF * 60)}</b>. `
            + `Con las <b>${hhmm(R.efectivas * 60)}</b> de ahora quedan en <b>${nMil(R.bTotal)} paletas</b>, `
            + `que son <b>${(R.bTotal / Math.max(1, R.bPers)).toFixed(1)} por persona</b>.`;

        const pct = S.meta > 0 ? (R.aTotal / S.meta) * 100 : 0;
        $('sim_meta_rell').style.width = Math.min(100, pct) + '%';
        $('sim_meta_rell').style.background = pct >= 100 ? 'var(--ok)' : 'var(--alm)';
        $('sim_meta_txt').textContent = `${nMil(R.aTotal)} de ${nMil(S.meta)} pares · ${Math.round(pct)} %`;

        const dif = R.aTotal - S.meta;
        const v = $('sim_veredicto');
        v.className = 'veredicto ' + (dif >= 0 ? 'ok' : 'no');
        const hacenFalta = Math.ceil(S.meta / Math.max(1, R.aGrupo));
        v.innerHTML = dif >= 0
            ? `✔ Con <b>${R.aPers} personas</b> en almacenamiento se llega: sobran <b>${nMil(dif)} pares</b> de margen.`
            : `✘ Con <b>${R.aPers} personas</b> no se llega: faltan <b>${nMil(-dif)} pares</b>. `
            + `Hacen falta <b>${hacenFalta * S.aTam} personas</b> (${hacenFalta} grupos).`;

        pintarComparador(R);

        $('sim_resumen').innerHTML =
            `Para mover <b>${nMil(S.meta)} pares por día</b> en un turno de <b>${hhmm(R.efectivas * 60)} efectivas</b> `
            + `hacen falta <span class="chip a">${R.aPers}</span> personas en almacenamiento `
            + `(${S.aGrupos} grupos de ${S.aTam}, a ${nMil(S.aUph)} pares/hora cada grupo), `
            + `<span class="chip s">${S.sPers}</span> en slotting (${R.sProd} moviendo carga y ${S.sEnc} guiando) y `
            + `<span class="chip b">${R.bPers + S.bMonta}</span> en buffer `
            + `(${S.bGrupos} grupos de ${S.bTam} más ${S.bMonta} montacarguistas) para <b>${nMil(R.bTotal)} paletas</b>.`
            + `<br>Total: <b style="font-size:var(--t-lg); color:var(--accent);">${R.total} personas</b> por turno.`;

        const netas = Number.isFinite(M.horasNetasHoy) ? M.horasNetasHoy : 4.75;
        $('sim_aviso').innerHTML =
            `⚠️ Esto supone que cada frente se dedica a lo suyo. Hoy un grupo de almacenamiento trabaja `
            + `<b>${hhmm(netas * 60)} netas</b> de las ${hhmm(R.efectivas * 60)}, porque el mismo personal también baja `
            + `paletas y separa. Con ese reparto, las ${R.aPers} personas rendirían cerca de `
            + `<b>${nMil(S.aGrupos * S.aUph * netas)} pares</b>, no ${nMil(R.aTotal)}.`;

        pintarFuenteUph();

        /* Se guarda lo que se DECIDE, no lo que se mide. La ocupación, el ritmo y el
           tamaño del grupo salen de las tareas cada vez que se abre la pantalla. */
        if (typeof OPC.alGuardar === 'function') {
            const { ocup, aTam, aUph, ...aGuardar } = S;
            OPC.alGuardar(aGuardar);
        }
    }

    // ── EL MONTAJE ───────────────────────────────────────────────────────────
    RAIZ.id = 'sim';
    RAIZ.innerHTML = `<style>${CSS}</style>` + HTML;

    // Los medidos y su procedencia, que es lo que le da defensa en comité.
    const rango = (M.desde && M.hasta)
        ? `${String(M.desde).split('-').reverse().join('-')} al ${String(M.hasta).split('-').reverse().join('-')}`
        : 'las últimas jornadas';
    $('sim_f_ocup').innerHTML = M.tareas
        ? `Lo mide la plataforma sobre <b>${nMil(M.tareas)} tareas</b> del ${rango}. Usted no lo escribe.`
        : 'Sin tareas para medir: se usa el último valor conocido.';
    /* LAS DOS LECTURAS DEL RITMO, a un clic.
     *
     * No es un adorno: es la decisión que más mueve el resultado de esta pantalla.
     * El RITMO REAL (total ÷ total) incluye el prepack, que se matricula por paleta
     * entera y va rapidísimo; la TAREA TÍPICA (mediana) es cómo le va a una tarea
     * corriente. Con la misma meta, una da 28 personas y la otra 34. Cuál usar
     * depende de qué mezcla de trabajo se espere, y eso lo sabe Daniel, no el
     * código: por eso se eligen acá y ninguna de las dos marca "simulando". */
    function pintarFuenteUph() {
        if (!M.tareas) {
            $('sim_f_uph').textContent = 'Sin tareas para medir: se usa el último valor conocido.';
            return;
        }
        const act = Number(S.aUph);
        const bot = (val, nom, tit) =>
            `<button class="uph-op${act === val ? ' on' : ''}" data-uph="${val}" title="${tit}">`
            + `${nom} <b>${nMil(val)}</b></button>`;
        $('sim_f_uph').innerHTML =
            `De <b>${nMil(M.tareas)} tareas finalizadas</b> salen dos lecturas del ritmo: `
            + bot(UPH_REAL, 'ritmo real', `Total sobre total: ${nMil(M.pares)} pares en ${nMil(M.horasGrupo)} horas de grupo. Incluye el prepack.`)
            + bot(UPH_TIPICA, 'tarea típica', 'La mediana de las tareas. Es el ritmo de una tarea corriente, sin el empuje del prepack.')
            + `<br>La diferencia entre las dos <b>es el prepack</b>, que se matricula por paleta entera y no se trabaja par por par.`;
    }

    const campos = ['entrada', 'arranque', 'bpa', 'salida', 'cena', 'cenaMin', 'ocup',
        'aTam', 'aUph', 'sEnc', 'sUph', 'bTam', 'bPal', 'bMonta', 'meta'];
    const esTexto = { entrada: 1, arranque: 1, bpa: 1, salida: 1, cena: 1 };

    campos.forEach(c => {
        const el = $('sim_' + c);
        el.value = S[c];
        el.addEventListener('input', (e) => {
            const v = esTexto[c] ? e.target.value : Number(e.target.value);
            // Un campo vacío no debe volver el estado NaN y borrar toda la pantalla.
            if (!esTexto[c] && !Number.isFinite(v)) return;
            S[c] = v;
            if (MEDIDOS['sim_' + c]) refrescarLeyenda();
            pintar();
        });
    });

    /* Los botones del ritmo se redibujan en cada pintado, así que el escuchador va
       en la raíz: enganchado al botón, se perdería en el primer redibujo. */
    RAIZ.addEventListener('click', (e) => {
        const b = e.target.closest('.uph-op');
        if (!b || !RAIZ.contains(b)) return;
        S.aUph = Number(b.dataset.uph);
        $('sim_aUph').value = S.aUph;
        refrescarLeyenda();
        pintar();
    });

    RAIZ.querySelectorAll('.stepper button').forEach(b => {
        b.addEventListener('click', () => {
            const c = b.dataset.campo;
            S[c] = Math.max(1, S[c] + Number(b.dataset.paso));
            pintar();
        });
    });

    RAIZ.querySelectorAll('.candado').forEach(b => {
        b.addEventListener('click', () => {
            const caja = $(b.dataset.abre);
            const campo = caja.querySelector('input');
            const clave = MEDIDOS[campo.id];
            const abriendo = !caja.classList.contains('abierto');
            caja.classList.toggle('abierto', abriendo);
            campo.readOnly = !abriendo;
            b.textContent = abriendo ? '🔒' : '🔓';
            b.title = abriendo ? 'Volver al dato medido' : 'Lo mide la plataforma. Ábralo solo para simular.';
            if (abriendo) { campo.focus(); campo.select(); }
            else {
                // Al cerrar vuelve al medido: si no, quedaría un número inventado con
                // cara de medición y nadie se acordaría de haberlo tocado.
                campo.value = MED[clave];
                S[clave] = MED[clave];
            }
            refrescarLeyenda();
            pintar();
        });
    });

    $('sim_ajustar').addEventListener('click', () => {
        const R = calcular();
        if (R.aGrupo > 0) {
            S.aGrupos = Math.ceil(S.meta / R.aGrupo);
            pintar();
        }
    });

    $('sim_reset').addEventListener('click', () => {
        Object.assign(S, ARRANQUE);
        campos.forEach(c => { $('sim_' + c).value = S[c]; });
        // Los candados también se cierran: "volver al horario de hoy" tiene que dejar la
        // pantalla como recién abierta, sin simulaciones colgadas de antes.
        RAIZ.querySelectorAll('.medido.abierto').forEach(caja => {
            caja.classList.remove('abierto');
            caja.querySelector('input').readOnly = true;
            const b = caja.querySelector('.candado');
            b.textContent = '🔓';
            b.title = 'Lo mide la plataforma. Ábralo solo para simular.';
        });
        refrescarLeyenda();
        pintar();
    });

    // ── LA PRESENTACIÓN ──────────────────────────────────────────────────────
    function cargarPptx() {
        if (window.PptxGenJS) return Promise.resolve();
        return new Promise((ok, fallo) => {
            const et = document.createElement('script');
            et.src = CDN_PPTX;
            et.onload = () => ok();
            et.onerror = () => fallo(new Error('No se pudo bajar el generador. Revise la conexión.'));
            document.head.appendChild(et);
        });
    }

    /** Fecha de hoy en texto. NUNCA por toISOString(): devuelve UTC y a partir de las 19:00
     *  de Lima ya escribe el día siguiente, justo cuando entra el turno. */
    function fechaLarga() {
        const d = new Date();
        const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
            'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${d.getDate()} de ${MES[d.getMonth()]} de ${d.getFullYear()}`;
    }

    async function generarPPT() {
        await cargarPptx();
        const R = calcular();
        const FONDO = '132038', TARJETA = '1D2E4D', BLANCO = 'FFFFFF';
        const GRIS = 'A9B6CC', GRIS2 = '8393AD';
        const AMBAR = 'F2A03D', AZUL = '5AB0E2', VERDE = '5FB98F';

        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_WIDE';
        pres.author = 'Logistica DEAM1830';
        const s = pres.addSlide();
        s.background = { color: FONDO };
        const efec = hhmm(R.efectivas * 60);

        s.addText(`DOTACIÓN PARA ${nMil(S.meta)} PARES POR DÍA`, {
            x: 0.5, y: 0.32, w: 9.15, h: 0.6, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 26, bold: true, color: BLANCO, valign: 'middle'
        });
        s.addText(`Comité del ${fechaLarga()}   ·   Centro de Distribución   ·   Turno noche`, {
            x: 0.5, y: 1.0, w: 8.9, h: 0.3, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 12, color: GRIS, valign: 'middle'
        });
        s.addShape(pres.ShapeType.roundRect, {
            x: 9.72, y: 0.34, w: 3.11, h: 1.0, rectRadius: 0.08,
            fill: { color: AMBAR }, line: { color: AMBAR }
        });
        s.addText(String(R.total), {
            x: 9.86, y: 0.4, w: 1.1, h: 0.88, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 44, bold: true, color: '15243D', align: 'center', valign: 'middle'
        });
        s.addText([
            { text: 'PERSONAS', options: { fontSize: 15, bold: true, color: '15243D', breakLine: true } },
            { text: 'en los tres frentes', options: { fontSize: 11, color: '4A3611' } }
        ], {
            x: 10.94, y: 0.4, w: 1.8, h: 0.88, isTextBox: true, margin: 0,
            fontFace: 'Arial', align: 'left', valign: 'middle', lineSpacingMultiple: 1.1
        });

        const CY = 1.62, CH = 3.28, CW = 4.01;
        [
            {
                x: 0.5, ac: AMBAR, tit: 'ALMACENAMIENTO', num: String(R.aPers),
                sub: `personas  ·  ${S.aGrupos} grupos de ${S.aTam}`,
                filas: [['Meta del comité', `${nMil(S.meta)} pares por día`],
                ['Rendimiento por grupo', `${nMil(S.aUph)} pares por hora`],
                [`${efec} efectivas por noche`, `${nMil(R.aGrupo)} pares por grupo`],
                [`${S.aGrupos} grupos x ${nMil(R.aGrupo)}`, `${nMil(R.aTotal)} pares por día`]]
            },
            {
                x: 4.66, ac: AZUL, tit: 'SLOTTING', num: String(S.sPers),
                sub: `personas  ·  ${R.sProd} mueven carga`,
                filas: [['El módulo está en construcción', 'todavía no hay historial'],
                [`${S.sEnc} encargado guía, no mueve`, `quedan ${R.sProd} productivas`],
                ['Supuesto por persona', `${nMil(S.sUph)} pares por hora`],
                [`${R.sProd} personas x ${nMil(R.sPersona)}`, `${nMil(R.sTotal)} pares por día`]]
            },
            {
                x: 8.82, ac: VERDE, tit: 'BUFFER  ·  DE RESERVA AL ACTIVO', num: String(R.bPers + S.bMonta),
                sub: `${R.bPers} operarios + ${S.bMonta} montacarguistas`,
                filas: [['Cómo se arma', `${S.bGrupos} grupos de ${S.bTam} personas`],
                ['Por grupo en el turno', `${nMil(S.bPal)} paletas`],
                // "por grupo" va dicho: sin eso, 6 minutos se lee como el tiempo de UNA
                // persona y el número parece imposible.
                ['Ritmo que exige', `un grupo saca una cada ${Math.round(R.bRitmo)} min`],
                ['Carga total del turno', `${nMil(R.bTotal)} paletas`]]
            }
        ].forEach(c => {
            s.addShape(pres.ShapeType.roundRect, {
                x: c.x, y: CY, w: CW, h: CH, rectRadius: 0.05,
                fill: { color: TARJETA }, line: { color: '2B3F63', width: 1 }
            });
            s.addText(c.tit, {
                x: c.x + 0.26, y: CY + 0.2, w: CW - 0.52, h: 0.26, isTextBox: true, margin: 0,
                fontFace: 'Arial', fontSize: 11, bold: true, color: c.ac, charSpacing: 0.8, valign: 'middle'
            });
            s.addText(c.num, {
                x: c.x + 0.22, y: CY + 0.5, w: 1.25, h: 0.86, isTextBox: true, margin: 0,
                fontFace: 'Arial', fontSize: 52, bold: true, color: BLANCO, align: 'left', valign: 'middle'
            });
            s.addText(c.sub, {
                x: c.x + 1.5, y: CY + 0.5, w: CW - 1.76, h: 0.86, isTextBox: true, margin: 0,
                fontFace: 'Arial', fontSize: 11.5, color: GRIS, align: 'left', valign: 'middle'
            });
            c.filas.forEach((f, i) => {
                const y = CY + 1.5 + i * 0.44;
                s.addText(f[0], {
                    x: c.x + 0.26, y: y, w: CW - 0.52, h: 0.2, isTextBox: true, margin: 0,
                    fontFace: 'Arial', fontSize: 9.5, color: GRIS2, valign: 'middle'
                });
                s.addText(f[1], {
                    x: c.x + 0.26, y: y + 0.19, w: CW - 0.52, h: 0.23, isTextBox: true, margin: 0,
                    fontFace: 'Arial', fontSize: 12, bold: true, color: BLANCO, valign: 'middle'
                });
            });
        });

        const BY = 5.14, BH = 1.42;
        s.addShape(pres.ShapeType.roundRect, {
            x: 0.5, y: BY, w: 8.17, h: BH, rectRadius: 0.05,
            fill: { color: '18294A' }, line: { color: '2B3F63', width: 1 }
        });
        s.addText(`DE DÓNDE SALEN LAS ${efec.toUpperCase()} EFECTIVAS`, {
            x: 0.76, y: BY + 0.16, w: 7.65, h: 0.24, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 10, bold: true, color: AMBAR, charSpacing: 0.8, valign: 'middle'
        });
        s.addText([
            { text: S.entrada, options: { bold: true, color: BLANCO } },
            { text: ' entrada y charla      ', options: { color: GRIS } },
            { text: S.arranque, options: { bold: true, color: BLANCO } },
            { text: ' arrancan las tareas      ', options: { color: GRIS } },
            { text: S.bpa, options: { bold: true, color: BLANCO } },
            { text: ' BPA      ', options: { color: GRIS } },
            { text: S.salida, options: { bold: true, color: BLANCO } },
            { text: ' salida', options: { color: GRIS } }
        ], {
            x: 0.76, y: BY + 0.46, w: 7.65, h: 0.28, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 11.5, valign: 'middle'
        });
        s.addText([
            { text: `${hhmm(R.ventana)} de ventana`, options: { bold: true, color: BLANCO } },
            { text: '  menos  ', options: { color: GRIS2 } },
            { text: `${R.cenaDentro} min de refrigerio`, options: { bold: true, color: BLANCO } },
            { text: `  =  ${hhmm(R.disponible)} disponibles  `, options: { color: GRIS } },
            { text: `x ${S.ocup} % de ocupación real`, options: { bold: true, color: AMBAR } },
            { text: '  =  ', options: { color: GRIS } },
            { text: `${efec} efectivas`, options: { bold: true, color: AMBAR } }
        ], {
            // 10 pt y no 11,5: la línea entera son unos 108 caracteres y a 11,5 se pasa
            // de los 7,65" de la caja, se parte en dos y el segundo renglón pisa la
            // nota en cursiva de abajo.
            x: 0.76, y: BY + 0.82, w: 7.65, h: 0.28, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 10, valign: 'middle'
        });
        s.addText('El porcentaje de ocupación es lo que la plataforma mide en el piso: baños, traslados y coordinación ya están descontados ahí.', {
            x: 0.76, y: BY + 1.09, w: 7.65, h: 0.22, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 9, italic: true, color: GRIS2, valign: 'middle'
        });

        s.addShape(pres.ShapeType.roundRect, {
            x: 8.82, y: BY, w: 4.01, h: BH, rectRadius: 0.05,
            fill: { color: '18294A' }, line: { color: '2B3F63', width: 1 }
        });
        s.addText('DÓNDE ESTAMOS HOY', {
            x: 9.08, y: BY + 0.16, w: 3.49, h: 0.24, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 10, bold: true, color: VERDE, charSpacing: 0.8, valign: 'middle'
        });
        s.addText([
            { text: nMil(M.hoyPares || 0), options: { fontSize: 26, bold: true, color: BLANCO } },
            { text: '  pares por noche', options: { fontSize: 12, color: GRIS } }
        ], {
            x: 9.08, y: BY + 0.44, w: 3.49, h: 0.42, isTextBox: true, margin: 0,
            fontFace: 'Arial', valign: 'middle'
        });
        s.addText(
            `Con ${(M.hoyPersonas || 0).toFixed(1).replace('.', ',')} personas en promedio. `
            + `El techo alcanzado fue de ${nMil(M.techo || 0)} pares.`, {
            x: 9.08, y: BY + 0.9, w: 3.49, h: 0.4, isTextBox: true, margin: 0,
            fontFace: 'Arial', fontSize: 9.5, color: GRIS, valign: 'top', lineSpacingMultiple: 1.15
        });

        // Si se abrió un candado, la lámina TIENE que decirlo.
        const sim = haySimulado();
        s.addText(
            sim
                ? `⚠  ESCENARIO SIMULADO: hay un dato medido cambiado a mano — ${nMil(S.aUph)} pares/hora `
                + `por grupo de ${S.aTam}, ocupación ${S.ocup} %.   ·   Generado desde el Simulador.`
                : `Medido sobre ${nMil(M.tareas || 0)} tareas finalizadas del ${rango} `
                + `(${nMil(M.pares || 0)} pares almacenados).   ·   Generado desde el Simulador.`,
            {
                x: 0.5, y: 6.72, w: 12.33, h: 0.26, isTextBox: true, margin: 0,
                fontFace: 'Arial', fontSize: 8.5, bold: sim, color: sim ? AMBAR : '6C7C99', valign: 'middle'
            });

        await pres.writeFile({ fileName: NOMBRE_PPT });
    }

    $('sim_procesar').addEventListener('click', async () => {
        const btn = $('sim_procesar'), est = $('sim_estado');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ GENERANDO...';
        est.className = 'estado-proc';
        est.textContent = 'Armando la presentación con los datos de pantalla...';
        try {
            pintar();
            await generarPPT();
            const h = new Date();
            est.className = 'estado-proc listo';
            est.textContent = `✔ ${NOMBRE_PPT} generado a las `
                + `${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}. `
                + 'Cada vez que procese sale el mismo archivo con los datos nuevos.';
        } catch (e) {
            // Si algo falla se DICE. Un botón que no hace nada deja al usuario esperando
            // un archivo que nunca va a llegar.
            est.className = 'estado-proc error';
            est.textContent = '✘ ' + ((e && e.message) || 'No se pudo generar la presentación.');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    refrescarLeyenda();
    pintar();
};
