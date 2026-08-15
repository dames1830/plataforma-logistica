/**
 * SLOTTING → TAREAS DÍA · KPI SLOTTING · CONFIG. SLOTTING
 *
 * Los tres submódulos donde el equipo trabaja los cuerpos que tienen más de un artículo.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * TABLERO PROPIO, NO EL DE ALMACENAJE. Decisión de Daniel, 15-ago-2026.
 *
 * Comparten la forma —las mismas columnas, los mismos estados, el mismo modal de asignar— pero
 * no se trabajan juntas, y mezclarlas rompería el conteo de productividad de almacenaje: una
 * tarea de Slotting de 20 pares hundiría el promedio de una noche.
 *
 * Lo que sí se comparte es la LISTA DE OPERARIOS y las reglas de asignación, que llegan por
 * `OPC`: acá no se duplica ninguna.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC` y quien lo monta
 * —dashboard_v28.js— busca y guarda. Mismo reparto que turno_actividades.js y marcas.js.
 *
 *   OPC.cajon           lo guardado, por jornada: { '2026-08-14': { tareas: [...] } }
 *   OPC.vista           'tareas_dia' | 'kpi' | 'config'
 *   OPC.svc             slottingService
 *   OPC.alGuardar       se llama con el cajón entero cuando cambia algo
 *   OPC.alProcesar      PROCESAR SLOTTING; devuelve el cajón nuevo
 *   OPC.operarios       [{ usuario, nombre, turno }] activos y ordenados
 *   OPC.jornadaVencida  (fecha) => bool, para el candado de jornada cerrada
 *   OPC.alertar         (titulo, mensaje, tipo) — el aviso de siempre
 *   OPC.alGuardarConfig se llama con la configuración nueva
 *
 * TODO VA ENCERRADO BAJO `#slt`: los nombres que usa chocarían sueltos con los del tablero.
 */

export const montarSlotting = (container, OPC = {}) => {
  const svc = OPC.svc;
  let cajon = OPC.cajon || {};
  const vista = OPC.vista || 'tareas_dia';
  const avisar = OPC.alertar || ((t, m) => alert(t + '\n\n' + m));
  const operarios = OPC.operarios || [];

  const todasLasFechas = svc.fechasDe(cajon);
  // El rango arranca en la jornada más nueva, que es lo que se trabaja esta noche
  let hasta = todasLasFechas[0] || '';
  let desde = todasLasFechas[0] || '';

  const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (n) => (Number(n) || 0).toLocaleString('es-PE');
  const hora = (v) => {
    if (!v) return '---';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '---'
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  /** La hora local, nunca toISOString: devuelve UTC y a las 19:00 ya es otro día. */
  const selloHora = () => {
    const d = new Date(), dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())} `
         + `${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
  };

  const cuerposDe = (t) => t.cuerpos || new Set(((t && t.lineas) || []).map(l => l.ubi)).size;

  /** Todas las tareas del rango, con su fecha pegada para poder ubicarlas de vuelta. */
  const tareasDelRango = () => svc.fechasEnRango(cajon, desde, hasta)
      .flatMap(f => ((cajon[f] || {}).tareas || []).map(t => ({ ...t, fecha: f })));

  const dameTarea = (fecha, n) => ((cajon[fecha] || {}).tareas || [])
      .find(t => String(t.n) === String(n));

  const pintar = () => {
    if (vista === 'kpi') return pintarKPI();
    if (vista === 'config') return pintarConfig();
    return pintarTareas();
  };

  /* ════════════════════════ 1. TAREAS DÍA ════════════════════════ */
  function pintarTareas() {
    const lista = tareasDelRango();
    const por = { Creada: 0, Asignado: 0, Finalizado: 0, Vencida: 0 };
    lista.forEach(t => por[svc.migrarEstado(t)]++);
    const pares = lista.reduce((a, t) => a + (Number(t.pares) || 0), 0);
    const cuerpos = lista.reduce((a, t) => a + cuerposDe(t), 0);
    const liberados = lista.filter(t => svc.migrarEstado(t) === 'Finalizado')
                           .reduce((a, t) => a + cuerposDe(t), 0);
    const avance = lista.length ? Math.round(por.Finalizado / lista.length * 100) : 0;
    const gen = ((cajon[hasta] || {}).generado) || '';

    container.innerHTML = `
      <div id="slt">
        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1.1rem 1.4rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.66rem; color:var(--text-muted); font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">
                Tareas de ordenamiento</div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; margin-top:0.35rem; flex-wrap:wrap;">
                <span style="font-size:2rem; font-weight:800; color:#fff; line-height:1;">${por.Finalizado}</span>
                <span style="font-size:1rem; color:var(--text-muted);">de ${lista.length} tareas hechas</span>
                <span style="font-size:1.1rem; font-weight:800; color:#22c55e;">${avance}%</span>
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
                ${cuerpos} cuerpos por limpiar · <b style="color:#94a3b8;">${num(pares)} pares</b> por sacar ·
                <b style="color:#22c55e;">${liberados} cuerpos liberados</b>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:0.66rem; color:var(--text-muted); font-weight:800; letter-spacing:0.06em;">DE:</span>
                <input type="date" id="slt_desde" value="${esc(desde)}" style="background:rgba(255,255,255,0.04);
                       border:1px solid var(--border); color:#fff; border-radius:7px; padding:0.42rem 0.6rem; font-size:0.75rem;">
                <span style="font-size:0.66rem; color:var(--text-muted); font-weight:800; letter-spacing:0.06em;">HASTA:</span>
                <input type="date" id="slt_hasta" value="${esc(hasta)}" style="background:rgba(255,255,255,0.04);
                       border:1px solid var(--border); color:#fff; border-radius:7px; padding:0.42rem 0.6rem; font-size:0.75rem;">
              </div>
              ${lista.length ? `<button id="slt_imprimir" class="btn" style="background:rgba(255,255,255,0.06);
                       border:1px solid var(--border); color:#e2e8f0; width:auto; padding:0.5rem 1.1rem;
                       border-radius:8px; font-size:0.74rem; font-weight:800;">🖨️ IMPRIMIR</button>` : ''}
              <button id="slt_procesar" class="btn" style="background:var(--primary); width:auto;
                      padding:0.5rem 1.1rem; border-radius:8px; font-size:0.74rem; font-weight:800;">
                ⚙️ PROCESAR SLOTTING</button>
            </div>
          </div>
          <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-top:0.9rem;">
            <div style="width:${avance}%; height:100%; background:linear-gradient(90deg,#22c55e,#4ade80); border-radius:10px;"></div>
          </div>
          <div style="font-size:0.68rem; color:var(--text-muted); margin-top:0.5rem;">
            ${gen ? `Generado: <b style="color:#94a3b8;">${esc(gen)}</b>` : 'Todavía no se procesó nada.'}
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:0.4rem 0.6rem; overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.78rem; min-width:1150px;">
            <thead><tr style="color:var(--text-muted); text-transform:uppercase; font-size:0.68rem;
                       font-weight:800; letter-spacing:0.05em; border-bottom:2px solid rgba(79,70,229,0.35);">
              <th style="padding:7px 9px; text-align:left;">Fecha</th>
              <th style="padding:7px 9px; text-align:left;">Tarea</th>
              <th style="padding:7px 9px; text-align:center;">Pares</th>
              <th style="padding:7px 9px; text-align:center;">Cuerpos</th>
              <th style="padding:7px 9px; text-align:left;">Marca</th>
              <th style="padding:7px 9px; text-align:left;">Usuario1</th>
              <th style="padding:7px 9px; text-align:left;">Usuario2</th>
              <th style="padding:7px 9px; text-align:left;">Inicio</th>
              <th style="padding:7px 9px; text-align:left;">Término</th>
              <th style="padding:7px 9px; text-align:center;">Productividad</th>
              <th style="padding:7px 9px; text-align:center;">Objetivo</th>
              <th style="padding:7px 9px; text-align:center;">Estado</th>
              <th style="padding:7px 9px; text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${lista.length ? lista.map(fila).join('') : `
              <tr><td colspan="13" style="padding:2.5rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
                No hay tareas en el rango. Apretá <b>PROCESAR SLOTTING</b> para revisar el almacén.
              </td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    engancharTareas();
  }

  function fila(t) {
    const est = svc.migrarEstado(t);
    const info = svc.ESTADOS[est];
    const prod = svc.productividad(t);
    const real = svc.minutosReales(t);
    const esperado = Math.round(svc.minutosEsperados(t));
    const cerrada = OPC.jornadaVencida ? OPC.jornadaVencida(t.fecha) : false;
    let objetivo = '---', color = 'var(--text-muted)', pie = '';
    if (real !== null) {
      const ok = real <= esperado;
      objetivo = ok ? 'CUMPLIÓ' : 'NO CUMPLIÓ';
      color = ok ? '#22c55e' : '#ef4444';
      pie = `<div style="font-size:0.62rem; color:var(--text-muted); font-weight:400;">${real} min · esperado ${esperado}</div>`;
    }
    return `
      <tr class="slt-fila" data-f="${esc(t.fecha)}" data-n="${esc(t.n)}"
          style="border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer;">
        <td style="padding:10px 9px;">${esc(String(t.fecha).split('-').reverse().join('/'))}</td>
        <td style="padding:10px 9px; color:#fff; font-weight:700;">Slot ${esc(t.n)}</td>
        <td style="padding:10px 9px; text-align:center;">${num(t.pares)}</td>
        <td style="padding:10px 9px; text-align:center;">${cuerposDe(t)}</td>
        <td style="padding:10px 9px;">${esc(t.marca || '---')}</td>
        <td style="padding:10px 9px; color:#fff; font-weight:800; background:rgba(79,70,229,0.06);">${esc(t.u1 || '---')}</td>
        <td style="padding:10px 9px; color:#fff; font-weight:800; opacity:0.8;">${esc(t.u2 || '---')}</td>
        <td style="padding:10px 9px; font-size:0.75rem; opacity:0.6;">${hora(t.inicio)}</td>
        <td style="padding:10px 9px; font-size:0.75rem; opacity:0.6;">${hora(t.termino)}</td>
        <td style="padding:10px 9px; text-align:center; color:#fff; font-weight:900; font-size:0.95rem;">${prod === null ? '---' : num(prod)}</td>
        <td style="padding:10px 9px; text-align:center; font-size:0.7rem;">
          <span style="color:${color}; font-weight:900;">${objetivo}</span>${pie}</td>
        <td style="padding:10px 9px; text-align:center;">
          <span style="color:${info.color}; font-weight:900; font-size:0.7rem;">${info.etiqueta}</span></td>
        <td style="padding:10px 9px; text-align:center;" onclick="event.stopPropagation()">
          ${cerrada
            ? `<span title="Jornada cerrada: la tarea ya no se puede editar." style="font-size:1.05rem; opacity:0.45; cursor:help;">🔒</span>`
            : `<button class="slt-reiniciar" data-f="${esc(t.fecha)}" data-n="${esc(t.n)}" title="Reiniciar tarea"
                       style="background:none; border:none; cursor:pointer; font-size:1.05rem; color:#60a5fa;">🔄</button>`}
        </td>
      </tr>`;
  }

  /* ════════════════════════ EL MODAL DE ASIGNAR ════════════════════════
   *
   * Es el mismo de Almacenaje, con las mismas reglas. La ÚNICA que cambia es el Usuario 2.
   *
   * Daniel, 15-ago-2026: *"el slotting no es lo mismo que almacenar; de repente vas y mueves
   * una, dos o diez cajas, normal una sola persona"*. Así que acá el Usuario 2 es OPCIONAL de
   * verdad: el rótulo y la validación dicen lo mismo. En almacenaje el rótulo dice "Opcional"
   * pero la validación exige los dos, porque ahí toda tarea se trabaja en grupo de 2.
   */
  function abrirAsignar(fecha, n) {
    const t = dameTarea(fecha, n);
    if (!t) return;
    if (OPC.jornadaVencida && OPC.jornadaVencida(fecha)) {
      avisar('JORNADA CERRADA', 'Esta jornada ya cerró y sus tareas no se pueden editar.', 'warning');
      return;
    }
    const est = svc.migrarEstado(t);
    if (est === 'Finalizado') {
      avisar('TAREA BLOQUEADA', 'Esta tarea ya está finalizada y bloqueada. Para deshacerla, usá el botón de reiniciar (🔄).', 'warning');
      return;
    }
    if (est === 'Vencida') {
      avisar('TAREA NO TRABAJADA', 'Esta tarea venció con la jornada y ya no se puede trabajar. Volvé a procesar Slotting.', 'warning');
      return;
    }

    const viejo = document.getElementById('slt_modal');
    if (viejo) viejo.remove();

    const opciones = operarios.map(o =>
      `<option value="${esc(o.usuario)}">${esc(o.usuario)} (${esc(o.nombre)})</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'slt_modal';
    modal.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8);'
                + 'z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
    modal.innerHTML = `
      <div class="glass-panel" style="width:380px; padding:2rem; border:1px solid var(--primary); border-radius:16px;">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; text-align:center;">
          Asignar Tarea: <span style="color:var(--primary);">Slot ${esc(t.n)}</span></h3>
        <div style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:6px;">Usuario 1 (Obligatorio)</label>
            <select id="slt_u1" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2);
                    padding:0.8rem; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.9rem;">
              <option value="">Seleccionar operario...</option>${opciones}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:6px;">Usuario 2 (Opcional)</label>
            <select id="slt_u2" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2);
                    padding:0.8rem; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.9rem;">
              <option value="">Ninguno</option>${opciones}
            </select>
          </div>
          <div style="font-size:0.68rem; color:var(--text-muted); line-height:1.5;">
            Con un operario la meta es <b style="color:#e2e8f0;">${num(svc.configActual().uphSolo)} pares/h</b>;
            con dos, <b style="color:#e2e8f0;">${num(svc.configActual().uphGrupo)} pares/h</b>.
            Más ${svc.configActual().tiempoBase} minutos de recorrido.
          </div>
          <div style="margin-top:0.4rem; display:flex; gap:10px;">
            <button id="slt_asignar" class="btn" style="flex:1; padding:0.8rem; font-size:0.75rem; font-weight:800;">ASIGNAR E INICIAR</button>
            ${est === 'Asignado' ? `<button id="slt_finalizar" class="btn" style="flex:1; background:#22c55e; padding:0.8rem; font-size:0.75rem; font-weight:800;">FINALIZAR</button>` : ''}
          </div>
          <button id="slt_cerrar" style="background:none; border:none; color:var(--text-muted);
                  cursor:pointer; font-size:0.7rem; margin-top:0.5rem; width:100%;">Cerrar sin cambios</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    if (t.u1) modal.querySelector('#slt_u1').value = t.u1;
    if (t.u2) modal.querySelector('#slt_u2').value = t.u2;

    const turnoDe = (usuario) => {
      const o = operarios.find(x => x.usuario === usuario);
      return o ? o.turno : null;
    };

    modal.querySelector('#slt_cerrar').onclick = () => modal.remove();

    modal.querySelector('#slt_asignar').onclick = async () => {
      const u1 = modal.querySelector('#slt_u1').value;
      const u2 = modal.querySelector('#slt_u2').value;
      // Usuario 1 SÍ es obligatorio; el 2 no. Es la única regla distinta de almacenaje.
      if (!u1) { avisar('FALTA EL USUARIO 1', 'Toda tarea necesita al menos un operario asignado.', 'error'); return; }
      if (u2 && u1 === u2) { avisar('USUARIO REPETIDO', 'Usuario 1 y Usuario 2 no pueden ser la misma persona.', 'error'); return; }
      if (u2) {
        const t1 = turnoDe(u1), t2 = turnoDe(u2);
        if (t1 && t2 && t1 !== t2) {
          avisar('⚠️ CONFLICTO DE TURNO',
            `No se puede asignar esta tarea: Usuario 1 es de turno ${t1} y Usuario 2 es de turno ${t2}. `
            + 'Ambos operarios deben pertenecer al mismo turno.', 'error');
          return;
        }
      }

      // SE ESPERA AL SERVIDOR Y, SI NO LLEGA, SE VUELVE ATRÁS. Mismo trato que almacenaje:
      // sin esto el modal se cierra, la pantalla se redibuja y la asignación no aparece.
      const btn = modal.querySelector('#slt_asignar');
      const rotulo = btn.textContent;
      btn.disabled = true; btn.textContent = 'GUARDANDO...';
      const previo = { u1: t.u1, u2: t.u2, status: t.status, inicio: t.inicio };
      t.u1 = u1; t.u2 = u2; t.status = 'Asignado';
      if (!t.inicio) t.inicio = selloHora();

      const ok = OPC.alGuardar ? await OPC.alGuardar(cajon) : true;
      if (ok === false) {
        Object.assign(t, previo);
        btn.disabled = false; btn.textContent = rotulo;
        avisar('NO SE PUDO GUARDAR', 'La asignación no llegó al servidor. Volvé a intentar.', 'error');
        return;
      }
      modal.remove();
      pintar();
    };

    const fin = modal.querySelector('#slt_finalizar');
    if (fin) fin.onclick = async () => {
      fin.disabled = true; fin.textContent = 'GUARDANDO...';
      const previo = { status: t.status, termino: t.termino };
      t.status = 'Finalizado';
      t.termino = selloHora();
      const ok = OPC.alGuardar ? await OPC.alGuardar(cajon) : true;
      if (ok === false) {
        Object.assign(t, previo);
        fin.disabled = false; fin.textContent = 'FINALIZAR';
        avisar('NO SE PUDO GUARDAR', 'El cierre no llegó al servidor. Volvé a intentar.', 'error');
        return;
      }
      modal.remove();
      pintar();
    };
  }

  /* ════════════════════════ 2. KPI SLOTTING ════════════════════════ */
  function pintarKPI() {
    const k = svc.kpi(cajon, desde, hasta);
    const c = svc.configActual();
    const tarjeta = (titulo, valor, pie, color) => `
      <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px; padding:0.85rem 1rem;">
        <h4 style="margin:0; font-size:0.64rem; text-transform:uppercase; letter-spacing:0.08em;
                   color:var(--text-muted); font-weight:800;">${titulo}</h4>
        <div style="font-size:1.9rem; font-weight:900; color:${color || '#fff'}; line-height:1.15; margin-top:2px;">${valor}</div>
        <div style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">${pie}</div>
      </div>`;

    const maxCuerpos = Math.max(1, ...k.porPersona.map(p => p.cuerpos));
    const barra = (etiqueta, valor, texto, col) => `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.74rem;">
        <span style="width:120px; color:var(--text-muted);">${esc(etiqueta)}</span>
        <div style="flex:1; height:14px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${valor}%; background:${col || '#4f46e5'};"></div></div>
        <b style="width:80px; text-align:right; color:#fff;">${texto}</b>
      </div>`;

    container.innerHTML = `
      <div id="slt">
        <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;">
          <span style="font-size:0.66rem; color:var(--text-muted); font-weight:800; letter-spacing:0.06em;">DE:</span>
          <input type="date" id="slt_desde" value="${esc(desde)}" style="background:rgba(255,255,255,0.04);
                 border:1px solid var(--border); color:#fff; border-radius:7px; padding:0.42rem 0.6rem; font-size:0.75rem;">
          <span style="font-size:0.66rem; color:var(--text-muted); font-weight:800; letter-spacing:0.06em;">HASTA:</span>
          <input type="date" id="slt_hasta" value="${esc(hasta)}" style="background:rgba(255,255,255,0.04);
                 border:1px solid var(--border); color:#fff; border-radius:7px; padding:0.42rem 0.6rem; font-size:0.75rem;">
          <span style="font-size:0.68rem; color:var(--text-muted); margin-left:0.6rem;">
            ${k.fechas.length} jornada${k.fechas.length === 1 ? '' : 's'} · las metas salen de Config. Slotting</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:0.8rem; margin-bottom:1rem;">
          ${tarjeta('Cuerpos liberados', k.cuerposLiberados,
                    `de ${num(k.mezclados)} mezclados · ${k.mezclados ? Math.round(k.cuerposLiberados / k.mezclados * 100) : 0}%`)}
          ${tarjeta('Pares movidos', num(k.paresMovidos), `de ${num(k.paresTotales)} por sacar`)}
          ${tarjeta('Tareas hechas', `${k.hechas}<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);"> / ${k.tareas}</span>`,
                    `${k.avance}% de la corrida`)}
          ${tarjeta('Pares por hora', num(k.paresPorHora),
                    `meta ${num(c.uphSolo)} solo · ${num(c.uphGrupo)} en grupo`)}
          ${tarjeta('Minutos por cuerpo', String(k.minutosPorCuerpo).replace('.', ','), 'mediana del rango')}
          ${tarjeta('Cumplieron el objetivo', k.conTiempo ? `${k.cumplieron}<span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);"> / ${k.conTiempo}</span>` : '---',
                    'contra el tiempo esperado')}
          ${tarjeta('Cuerpos reincidentes', k.reincidentes,
                    'se limpiaron y volvieron', k.reincidentes ? '#f59e0b' : '#fff')}
        </div>

        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1rem 1.2rem; margin-bottom:1rem;">
          <h3 style="margin:0 0 0.8rem; font-size:0.78rem; color:#fff; letter-spacing:0.06em;
                     text-transform:uppercase; font-weight:800;">Quién limpió cuánto</h3>
          ${k.porPersona.length
            ? k.porPersona.map(p => barra(p.usuario, Math.round(p.cuerpos / maxCuerpos * 100),
                `${p.cuerpos} cuerpo${p.cuerpos === 1 ? '' : 's'}`)).join('')
            : `<div style="color:var(--text-muted); font-size:0.78rem;">Todavía no hay tareas finalizadas en el rango.</div>`}
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.5rem; line-height:1.6;">
            Se cuenta por CUERPO liberado y no por pares: un cuerpo con nueve pares cuesta el mismo
            viaje que uno con trescientos. Cuando la tarea la hacen dos, el cuerpo se le cuenta a los dos.
          </div>
        </div>
      </div>`;
    engancharRango();
  }

  /* ════════════════════════ 3. CONFIG. SLOTTING ════════════════════════ */
  function pintarConfig() {
    const c = svc.configActual();
    const campo = (id, etiqueta, valor, sufijo, ayuda) => `
      <div>
        <label style="display:block; font-size:0.64rem; color:var(--text-muted); text-transform:uppercase;
                      font-weight:800; margin-bottom:5px;" title="${esc(ayuda || '')}">${etiqueta}</label>
        <div style="display:flex; align-items:center; gap:7px;">
          <input type="number" id="${id}" value="${valor}" min="0" style="width:95px; background:rgba(255,255,255,0.04);
                 border:1px solid var(--border); color:#fff; border-radius:7px; padding:0.55rem 0.7rem;
                 font-weight:800; font-size:0.9rem;">
          <span style="font-size:0.68rem; color:var(--text-muted);">${sufijo}</span>
        </div>
      </div>`;

    container.innerHTML = `
      <div id="slt">
        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1rem 1.2rem; margin-bottom:1rem;">
          <h3 style="margin:0 0 0.8rem; font-size:0.78rem; color:#fff; letter-spacing:0.06em;
                     text-transform:uppercase; font-weight:800;">Meta de productividad</h3>
          <div style="display:flex; gap:1.5rem; flex-wrap:wrap; align-items:flex-end;">
            ${campo('cfg_base', 'Tiempo mínimo por tarea', c.tiempoBase, 'minutos',
                    'El recorrido fijo. Sin esto una tarea de un par tendría que hacerse en 24 segundos.')}
            ${campo('cfg_extra', 'Minutos extra por cuerpo adicional', c.minutosPorCuerpoExtra, 'minutos',
                    'En 0 la base es una sola por tarea, como en almacenaje.')}
            ${campo('cfg_solo', 'Pares por hora · 1 persona', c.uphSolo, 'pares/h')}
            ${campo('cfg_grupo', 'Pares por hora · 2 personas', c.uphGrupo, 'pares/h')}
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.8rem; line-height:1.6;
                      background:rgba(79,70,229,0.08); border:1px solid rgba(79,70,229,0.25);
                      border-radius:8px; padding:0.7rem 0.9rem;">
            <b style="color:#fff;">tiempo esperado = base + (cuerpos − 1) × extra + ( pares ÷ meta por hora ) × 60</b><br>
            Los minutos de base son los que hacen que la meta no sea absurda: con 150 por hora y sin
            base, mover un par pediría 24 segundos. Los "minutos extra por cuerpo" existen porque una
            tarea de Slotting visita varios cuerpos —hay de cinco—; en 0 se comporta igual que almacenaje.
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1rem 1.2rem; margin-bottom:1rem;">
          <h3 style="margin:0 0 0.8rem; font-size:0.78rem; color:#fff; letter-spacing:0.06em;
                     text-transform:uppercase; font-weight:800;">Cómo se arman las tareas</h3>
          <div style="display:flex; gap:1.5rem; flex-wrap:wrap; align-items:flex-end;">
            ${campo('cfg_tope', 'Pares por tarea', c.paresPorTarea, 'pares · es una guía: un cuerpo nunca se parte')}
            <div>
              <label style="display:block; font-size:0.64rem; color:var(--text-muted); text-transform:uppercase;
                            font-weight:800; margin-bottom:5px;">Zonas que se barren</label>
              <div style="display:flex; align-items:center; gap:11px; padding-top:0.4rem; font-size:0.72rem; color:var(--text-muted);">
                ${['SEL', 'MZN01', 'MZN02', 'MZN03'].map(z =>
                  `<label style="cursor:pointer;"><input type="checkbox" class="cfg_zona" value="${z}"
                     ${c.zonas.includes(z) ? 'checked' : ''}> ${z}</label>`).join('')}
                <label style="opacity:0.4;" title="El Mezzanine 4 no lleva calzado y queda fuera de todo análisis de cuerpos.">
                  <input type="checkbox" disabled> MZN04</label>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.6rem;">
          <button id="cfg_guardar" class="btn" style="width:auto; padding:0.6rem 1.2rem;
                  border-radius:8px; font-size:0.75rem; font-weight:800;">💾 GUARDAR Y PUBLICAR</button>
          <button id="cfg_volver" class="btn" style="width:auto; background:rgba(255,255,255,0.06);
                  border:1px solid var(--border); color:#e2e8f0; padding:0.6rem 1.2rem;
                  border-radius:8px; font-size:0.75rem; font-weight:800;">↩️ VOLVER A LO PUBLICADO</button>
        </div>
      </div>`;

    container.querySelector('#cfg_guardar').onclick = async () => {
      const v = (id) => Number(container.querySelector('#' + id).value);
      const zonas = [...container.querySelectorAll('.cfg_zona')].filter(x => x.checked).map(x => x.value);
      if (!zonas.length) { avisar('SIN ZONAS', 'Hay que dejar al menos una zona para barrer.', 'error'); return; }
      const btn = container.querySelector('#cfg_guardar');
      btn.disabled = true; btn.textContent = 'GUARDANDO...';
      try {
        if (OPC.alGuardarConfig) await OPC.alGuardarConfig({
          tiempoBase: v('cfg_base'), minutosPorCuerpoExtra: v('cfg_extra'),
          uphSolo: v('cfg_solo'), uphGrupo: v('cfg_grupo'),
          paresPorTarea: v('cfg_tope'), zonas
        });
        avisar('CONFIGURACIÓN PUBLICADA', 'Las tareas que se procesen desde ahora usan estos números.', 'success');
      } catch (e) {
        avisar('NO SE PUDO GUARDAR', (e && e.message) || String(e), 'error');
      }
      btn.disabled = false; btn.textContent = '💾 GUARDAR Y PUBLICAR';
      pintar();
    };
    container.querySelector('#cfg_volver').onclick = () => pintar();
  }

  /* ══════════════════════════════════════════════════════════════════════════════
   * EL PAPEL. Diseñado con Daniel el 14-ago-2026, mirando la maqueta y corrigiéndola.
   *
   * Cinco columnas más el tilde: ✓ · Origen · SKU · Talla · Pares · Destino.
   *
   *   EL ORIGEN VA COMPLETO, con nivel. Para SACAR hay que saber exactamente dónde está: el
   *   8517900 tiene la talla 43 partida entre el nivel B y el C del mismo cuerpo. El DESTINO
   *   va con el cuerpo, porque al GUARDAR el nivel no importa — regla del 05-ago.
   *
   *   UNA LÍNEA POR SKU Y TALLA. *"Así podré saber qué tallas voy a sacar"*.
   *
   *   LA BANDA DE LA COLUMNA VA ARRIBA DE LOS TÍTULOS: primero dónde estoy parado, después
   *   qué dice cada casilla. Si la tarea toca dos columnas, se repiten las dos.
   *
   *   TOTAL POR ARTÍCULO con fondo suave al cambiar de código, y UN ARTÍCULO NO SE PARTE
   *   entre dos hojas: sus filas y su total viajan juntos, igual que en el papel de almacenaje.
   *
   *   LA COMPAGINACIÓN VA ARRIBA, a la derecha del subtítulo.
   *
   * Todo en blanco y negro: la impresora del almacén es monocromática, así que los destacados
   * van con fondo gris, nunca con color.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const CSS_PAPEL = `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #58585b; }
    body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; color: #000; }
    .pg { width: 210mm; height: 297mm; padding: 9mm 7mm; background: #fff;
          margin: 0 auto 6mm; position: relative; overflow: hidden; }
    .t1 { text-align: center; font-size: 26pt; font-weight: 700; line-height: 1.05; }
    .t1.cont { font-size: 18pt; }
    .t2 { text-align: center; font-size: 10.5pt; margin-top: 1mm; position: relative; }
    .pagX { position: absolute; right: 0; top: -0.5mm; font-size: 11pt; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    .firmas { margin-top: 3mm; font-size: 10.5pt; }
    .firmas td { border: 1px solid #888780; height: 10mm; padding: 0 2mm; }
    .firmas .rot { background: #F1EFE8; font-weight: 400; white-space: nowrap; }
    .det { margin-top: 3mm; }
    .det th { border: 1px solid #888780; height: 7mm; text-align: center;
              font-size: 10.5pt; font-weight: 700; background: #F1EFE8; }
    .det td { border: 1px solid #888780; height: 8.5mm; text-align: center;
              padding: 0 1mm; font-size: 12pt; }
    .det td.b { font-weight: 700; }
    .det td.t { font-weight: 700; font-size: 13pt; }
    .det td.dest { background: #F1EFE8; font-weight: 700; font-size: 13pt; }
    .det tr.tot td { background: #E5E3DC; font-weight: 700; height: 7.5mm; font-size: 11pt; }
    .det tr.tt td { background: #2C2C2A; color: #fff; font-weight: 700; height: 8mm; font-size: 12pt; }
    .banda th { background: #2C2C2A; color: #fff; font-weight: 700; text-align: left;
                height: 8mm; font-size: 13pt; letter-spacing: 1.5px; padding: 0 2mm; }
    .tick div { width: 4.6mm; height: 4.6mm; border: 1.5px solid #000; margin: 0 auto; }
    .nota { margin-top: 2.5mm; border: 1px solid #888780; height: 12mm; font-size: 9pt;
            padding: 1mm 2mm; color: #555; }
    .cierre { display: flex; align-items: center; justify-content: center; height: 100%;
              color: #888780; font-size: 13pt; font-weight: 700; text-align: center; }
    @media print { body { background: #fff; } .pg { margin: 0; page-break-after: always; }
                   .pg:last-child { page-break-after: auto; } .noimp { display: none !important; } }
    .noimp { position: sticky; top: 0; z-index: 9; background: #1e293b; color: #e2e8f0;
             padding: 10px 14px; font: 600 13px/1.5 system-ui, sans-serif; text-align: center; }
    .noimp button { background: #4f46e5; color: #fff; border: 0; border-radius: 8px;
             padding: 7px 18px; font: 700 13px system-ui, sans-serif; cursor: pointer; margin-left: 10px; }`;

  const CABECERA = `<tr>
      <th style="width:7%">✓</th><th style="width:26%">Origen</th><th style="width:24%">SKU</th>
      <th style="width:10%">Talla</th><th style="width:10%">Pares</th><th style="width:23%">Destino</th>
    </tr>`;

  /** La columna del almacén de una ubicación: 'SEL-06-01' -> 'SEL-06'. */
  const columnaDe = (ubi) => String(ubi || '').split('-').slice(0, 2).join('-');

  /**
   * Las filas de una tarea, ya en el orden del papel y con las bandas puestas.
   *
   * Cada línea del barrido trae su `detalle` —una entrada por SKU y talla, con la ubicación
   * completa—. Las tareas viejas, guardadas antes de que existiera, no lo traen: para esas se
   * arma una sola fila con lo que hay, que es mejor que no imprimir nada.
   */
  function filasDelPapel(t) {
    const bloques = [];
    let columna = null;
    (t.lineas || []).forEach(l => {
      const col = columnaDe(l.ubi);
      const det = (l.detalle && l.detalle.length)
        ? l.detalle
        : [{ ubi: l.ubi, skuFull: l.sku7, talla: '—', pares: l.pares }];
      const filas = det.map(d => ({ tipo: 'det', ubi: d.ubi, sku: d.skuFull,
                                    talla: d.talla, pares: d.pares, destino: l.llevarA || '' }));
      filas.push({ tipo: 'tot', sku7: l.sku7, pares: l.pares });
      // Un artículo es un BLOQUE: sus filas y su total no se separan nunca
      bloques.push({ columna, nuevaColumna: col !== columna, col, filas });
      columna = col;
    });
    return bloques;
  }

  /** El alto que ocupa cada cosa, en milímetros. Las alturas son fijas y salen del CSS. */
  const ALTO = { det: 8.5, tot: 7.5, banda: 8, titulos: 7, tabla: 3, total: 8, nota: 14.5 };

  function imprimirTareas() {
    const tareas = tareasDelRango();
    if (!tareas.length) return;

    const win = window.open('', '_blank');
    if (!win) { avisar('EL NAVEGADOR BLOQUEÓ LA VENTANA', 'Permití las ventanas emergentes de este sitio para poder imprimir.', 'warning'); return; }
    const rotulo = desde === hasta ? esc(desde) : `${esc(desde)} a ${esc(hasta)}`;
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Slotting · ${rotulo}</title><style>${CSS_PAPEL}</style></head>
      <body><div class="noimp">Tareas de Slotting · ${rotulo}
      <button onclick="window.print()">🖨️ Imprimir</button></div><div id="hojas"></div></body></html>`);
    win.document.close();
    const hojas = win.document.getElementById('hojas');

    tareas.forEach(t => {
      const bloques = filasDelPapel(t);
      const nLineas = bloques.reduce((a, b) => a + b.filas.length - 1, 0);
      const zona = ((cajon[t.fecha] || {}).zona) || '';
      const subtitulo = `${esc(t.fecha)}${zona ? ' · ' + esc(zona) : ''}`
                      + ` · ${nLineas} líneas · ${num(t.pares)} pares`;

      // Se reparten los bloques en hojas ANTES de dibujar, así se sabe cuántas son y el
      // "Páginas 1 de 3" sale bien desde la primera. Sin esto habría que dibujar dos veces.
      const paginas = [];
      let actual = [], libre = 0, colActual = null;
      const alturaUtil = (primera) => 297 - 18 - (primera ? 16 + 23 : 13) - ALTO.tabla;
      libre = alturaUtil(true);
      bloques.forEach(b => {
        const cabecera = (b.col !== colActual) ? ALTO.banda + ALTO.titulos : 0;
        const alto = cabecera + b.filas.reduce((a, f) => a + ALTO[f.tipo], 0);
        if (actual.length && alto > libre) {
          paginas.push(actual);
          actual = []; colActual = null;
          libre = alturaUtil(false) - (ALTO.banda + ALTO.titulos)
                - b.filas.reduce((a, f) => a + ALTO[f.tipo], 0);
          actual.push({ ...b, nuevaColumna: true });
          colActual = b.col;
          return;
        }
        libre -= alto;
        actual.push({ ...b, nuevaColumna: b.col !== colActual });
        colActual = b.col;
      });
      if (actual.length) paginas.push(actual);
      // El cierre —total de la tarea y observaciones— va en la última; si no entra, abre una
      if (paginas.length && libre < ALTO.total + ALTO.nota) paginas.push([]);

      paginas.forEach((bloquesDeLaHoja, i) => {
        const primera = i === 0, ultima = i === paginas.length - 1;
        let cuerpo = '', colHoja = null;
        bloquesDeLaHoja.forEach(b => {
          if (b.col !== colHoja) {
            if (cuerpo) cuerpo += '</tbody></table>';
            cuerpo += `<table class="det"><thead>`
                    + `<tr class="banda"><th colspan="6">COLUMNA ${esc(b.col)}</th></tr>`
                    + CABECERA + `</thead><tbody>`;
            colHoja = b.col;
          }
          b.filas.forEach(f => {
            cuerpo += f.tipo === 'det'
              ? `<tr><td class="tick"><div></div></td><td class="b">${esc(f.ubi)}</td>`
                + `<td>${esc(f.sku)}</td><td class="t">${esc(f.talla)}</td>`
                + `<td class="b">${num(f.pares)}</td><td class="dest">${esc(f.destino)}</td></tr>`
              : `<tr class="tot"><td colspan="4">Total ${esc(f.sku7)}</td><td>${num(f.pares)}</td><td></td></tr>`;
          });
        });
        if (cuerpo) cuerpo += '</tbody></table>';
        if (ultima) {
          cuerpo += `<table class="det"><tbody><tr class="tt">`
                  + `<td colspan="4">TOTAL DE LA TAREA</td><td>${num(t.pares)}</td><td></td>`
                  + `</tr></tbody></table><div class="nota">Observaciones:</div>`;
        }

        const pg = win.document.createElement('div');
        pg.className = 'pg';
        pg.innerHTML =
            `<div class="t1${primera ? '' : ' cont'}">SLOTTING · TAREA ${esc(t.n)}${primera ? '' : ' (cont.)'}</div>`
          + `<div class="t2">${subtitulo}<span class="pagX">Páginas ${i + 1} de ${paginas.length}</span></div>`
          + (primera ? `<table class="firmas">
               <tr><td class="rot" style="width:24mm">Nombres</td><td></td>
                   <td class="rot" style="width:16mm">Inicio</td><td style="width:20mm"></td>
                   <td class="rot" style="width:18mm">Término</td><td style="width:20mm"></td></tr>
               <tr><td class="rot">Revisado por</td><td colspan="5"></td></tr>
             </table>` : '')
          + cuerpo;
        hojas.appendChild(pg);
      });

      /* LA IMPRESORA DEL ALMACÉN IMPRIME A DOBLE CARA, y eso obliga a cerrar cada tarea en
       * un número PAR de páginas.
       *
       * Daniel, 15-ago-2026: *"recuerda que la impresora de mi trabajo por defecto imprime a
       * doble cara"*. Sin esto, una tarea de una sola página deja la siguiente al dorso de su
       * misma hoja: el operario se lleva su tarea y sin querer se lleva la del compañero, o
       * se la deja. Y son la mayoría — casi todas las tareas entran en una hoja.
       *
       * Es el mismo problema que ya se había resuelto en el Excel poniendo una HOJA por tarea:
       * ahí Excel arranca cada una en una hoja física nueva. Acá se consigue agregando una
       * página en blanco cuando quedan impares.
       *
       * La hoja en blanco lleva un cartel: sin él parece un error de impresión y alguien la
       * saca, que es justo lo que rompe el emparejado. */
      if (paginas.length % 2 === 1) {
        const blanca = win.document.createElement('div');
        blanca.className = 'pg';
        blanca.innerHTML = `<div class="cierre">Esta hoja va en blanco a propósito.<br>`
                         + `La tarea ${esc(t.n)} termina en la página anterior.</div>`;
        hojas.appendChild(blanca);
      }
    });
  }

  /* ════════════════════════ ENGANCHES ════════════════════════ */
  function engancharRango() {
    const d = container.querySelector('#slt_desde');
    const h = container.querySelector('#slt_hasta');
    if (d) d.addEventListener('change', () => { desde = d.value; if (hasta < desde) hasta = desde; pintar(); });
    if (h) h.addEventListener('change', () => { hasta = h.value; if (desde > hasta) desde = hasta; pintar(); });
  }

  function engancharTareas() {
    engancharRango();

    const imp = container.querySelector('#slt_imprimir');
    if (imp) imp.addEventListener('click', imprimirTareas);

    container.querySelectorAll('.slt-fila').forEach(tr =>
      tr.addEventListener('click', () => abrirAsignar(tr.dataset.f, tr.dataset.n)));

    /* REINICIAR devuelve la tarea a Creada y le borra la gente y las horas. Es lo mismo que
     * hace almacenaje: sirve cuando se asignó a quien no era, o cuando se finalizó de más. */
    container.querySelectorAll('.slt-reiniciar').forEach(b =>
      b.addEventListener('click', async () => {
        const t = dameTarea(b.dataset.f, b.dataset.n);
        if (!t) return;
        t.status = 'Creada'; t.u1 = ''; t.u2 = ''; t.inicio = ''; t.termino = '';
        if (OPC.alGuardar) await OPC.alGuardar(cajon);
        pintar();
      }));

    const btn = container.querySelector('#slt_procesar');
    if (btn) btn.addEventListener('click', async () => {
      if (!OPC.alProcesar) return;
      btn.disabled = true;
      btn.textContent = '⌛ REVISANDO EL ALMACÉN...';
      try {
        const nuevo = await OPC.alProcesar();
        if (nuevo) {
          cajon = nuevo;
          const f = svc.fechasDe(cajon)[0];
          if (f) { hasta = f; if (!desde || desde > f) desde = f; }
        }
      } catch (e) { console.error('[Slotting] no se pudo procesar:', e); }
      btn.disabled = false;
      pintar();
    });
  }

  pintar();
};
