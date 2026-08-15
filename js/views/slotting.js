/**
 * SLOTTING → TAREAS
 *
 * La pantalla donde el equipo trabaja los cuerpos que tienen más de un artículo. Cada tarea
 * junta unos 300 pares por sacar, ordenados por ubicación para no cruzar el almacén.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC` y quien lo monta
 * —dashboard_v28.js— busca y guarda. Mismo reparto que turno_actividades.js y marcas.js.
 *
 *   OPC.cajon      lo guardado, por jornada: { '2026-08-14': { tareas: [...] } }
 *   OPC.alGuardar  se llama con el cajón entero cuando cambia un estado o una nota
 *   OPC.alBarrer   se llama con BUSCAR AHORA; devuelve el cajón nuevo
 *   OPC.svc        slottingService
 *
 * TODO VA ENCERRADO BAJO `#slt`: los nombres que usa —fila, chip, panel— chocarían sueltos
 * con los del tablero.
 */

export const montarSlotting = (container, OPC = {}) => {
  const svc = OPC.svc;
  let cajon = OPC.cajon || {};
  let fecha = (svc.fechasDe(cajon)[0]) || '';
  let filtro = 'todos';

  const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (n) => (Number(n) || 0).toLocaleString('es-PE');

  const pintar = () => {
    const fechas = svc.fechasDe(cajon);
    const corrida = cajon[fecha];
    const res = svc.resumen(corrida);
    const tareas = ((corrida && corrida.tareas) || [])
        .filter(t => filtro === 'todos' || t.estado === filtro);

    const chip = (id, etiqueta, n, color) => `
      <button class="slt-chip" data-f="${id}" style="
        background:${filtro === id ? color : 'rgba(255,255,255,0.03)'};
        color:${filtro === id ? '#0b0f19' : 'var(--text-muted)'};
        border:1px solid ${filtro === id ? color : 'rgba(255,255,255,0.08)'};
        border-radius:20px; padding:0.35rem 0.9rem; font-size:0.72rem; font-weight:800;
        cursor:pointer; letter-spacing:0.04em; white-space:nowrap;">${etiqueta} · ${n}</button>`;

    container.innerHTML = `
      <div id="slt">
        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1.1rem 1.4rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.68rem; color:var(--text-muted); font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">
                Tareas de ordenamiento${res.zona ? ' · ' + esc(res.zona) : ''}
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; margin-top:0.35rem; flex-wrap:wrap;">
                <span style="font-size:2rem; font-weight:800; color:#fff; line-height:1;">${res.hecha}</span>
                <span style="font-size:1rem; color:var(--text-muted);">de ${res.total} tareas hechas</span>
                <span style="font-size:1.1rem; font-weight:800; color:#22c55e;">${res.avance}%</span>
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">
                ${res.cuerpos} cuerpos con más de un artículo · <b style="color:#94a3b8;">${num(res.pares)} pares</b> por sacar
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              ${fechas.length > 1 ? `
                <select id="slt_fecha" style="background:rgba(255,255,255,0.04); border:1px solid var(--border);
                        color:#fff; border-radius:7px; padding:0.4rem 0.7rem; font-size:0.75rem; cursor:pointer;">
                  ${fechas.map(f => `<option value="${f}" ${f === fecha ? 'selected' : ''}>${f}</option>`).join('')}
                </select>` : ''}
              <button id="slt_barrer" class="btn" style="background:var(--primary); width:auto;
                      padding:0.5rem 1.2rem; border-radius:8px; font-size:0.75rem; font-weight:800;">
                🔍 BUSCAR AHORA
              </button>
            </div>
          </div>
          <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-top:0.9rem;">
            <div style="width:${res.avance}%; height:100%; background:linear-gradient(90deg,#22c55e,#4ade80); border-radius:10px;"></div>
          </div>
          <div style="font-size:0.68rem; color:var(--text-muted); margin-top:0.5rem;">
            ${res.generado ? `Generado: <b style="color:#94a3b8;">${esc(res.generado)}</b>` : 'Todavía no se buscó nada.'}
          </div>
        </div>

        ${res.total ? `
        <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.9rem; flex-wrap:wrap;">
          ${chip('todos', 'Todas', res.total, '#94a3b8')}
          ${chip('pendiente', 'Por hacer', res.pendiente, '#f59e0b')}
          ${chip('proceso', 'En proceso', res.proceso, '#3b82f6')}
          ${chip('hecha', 'Hechas', res.hecha, '#22c55e')}
        </div>` : ''}

        <div style="display:flex; flex-direction:column; gap:0.6rem;">
          ${tareas.length ? tareas.map(tarjeta).join('') : `
            <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.85rem;
                        background:rgba(255,255,255,0.02); border:1px dashed var(--border); border-radius:10px;">
              ${res.total ? 'No hay tareas con ese filtro.'
                          : 'Todavía no hay tareas. Aprieta <b>BUSCAR AHORA</b> para revisar el almacén.'}
            </div>`}
        </div>
      </div>`;
    enganchar();
  };

  /** Una tarea, con sus líneas a la vista: el operario tiene que ver qué sacar sin abrir nada. */
  function tarjeta(t) {
    const est = svc.ESTADOS[t.estado] || svc.ESTADOS.pendiente;
    return `
      <div style="background:rgba(15,23,42,0.45); border:1px solid var(--border);
                  border-left:4px solid ${est.color}; border-radius:10px; padding:0.85rem 1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap;">
            <span style="font-size:1rem; font-weight:800; color:#fff;">TAREA ${t.n}</span>
            <span style="font-size:0.65rem; font-weight:800; padding:2px 9px; border-radius:20px;
                         background:${est.color}22; color:${est.color}; border:1px solid ${est.color}44;">
              ${est.etiqueta.toUpperCase()}</span>
            <span style="font-size:0.72rem; color:var(--text-muted);">
              ${num(t.pares)} pares · ${(t.lineas || []).length} líneas</span>
          </div>
          <select data-n="${t.n}" class="slt-estado" style="background:rgba(255,255,255,0.04);
                  border:1px solid var(--border); color:#fff; border-radius:7px;
                  padding:0.35rem 0.6rem; font-size:0.72rem; cursor:pointer;">
            ${Object.keys(svc.ESTADOS).map(k =>
              `<option value="${k}" ${t.estado === k ? 'selected' : ''}>${svc.ESTADOS[k].etiqueta}</option>`).join('')}
          </select>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:0.7rem; font-size:0.75rem;">
          <thead>
            <tr style="color:var(--text-muted); font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase;">
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">De dónde</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Sacar</th>
              <th style="text-align:right; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Pares</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Marca</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Temporada</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">A dónde va</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">El cuerpo queda para</th>
            </tr>
          </thead>
          <tbody>
            ${(t.lineas || []).map(l => `
              <tr>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#fff;">${esc(l.ubi)}</td>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#f59e0b; font-weight:700;">${esc(l.sku7)}</td>
                <td style="padding:4px 6px; text-align:right; font-family:ui-monospace,Consolas,monospace; color:#fff;">${num(l.pares)}</td>
                <td style="padding:4px 6px; color:#cbd5e1;">${esc(l.marca) || '—'}</td>
                <td style="padding:4px 6px; color:#94a3b8;">${esc(l.temporada) || '—'}</td>
                <!-- EL DESTINO SOLO LO TRAE EL ARRASTRE. Las líneas del cuerpo mezclado dicen
                     qué sacar y el equipo decide adónde; el arrastre lo sabe, porque la tarea
                     de almacenaje ya eligió el cuerpo esa misma noche. -->
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#93c5fd; font-weight:700;">
                  ${l.llevarA ? esc(l.llevarA) : '<span style="color:var(--text-muted); font-family:inherit; font-weight:400;">a criterio</span>'}</td>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#22c55e;">
                  ${l.motivo === 'arrastre'
                    ? '<span style="color:var(--text-muted); font-family:inherit;">junta la familia</span>'
                    : `${esc(l.dueno)} <span style="color:var(--text-muted);">(${num(l.duenoPares)})</span>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <input class="slt-nota" data-n="${t.n}" value="${esc(t.nota)}" placeholder="Nota..."
               style="width:100%; margin-top:0.6rem; background:rgba(255,255,255,0.02);
               border:1px solid var(--border); color:#cbd5e1; border-radius:6px;
               padding:0.35rem 0.6rem; font-size:0.72rem;">
      </div>`;
  }

  function enganchar() {
    container.querySelectorAll('.slt-chip').forEach(b =>
      b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));

    const sf = container.querySelector('#slt_fecha');
    if (sf) sf.addEventListener('change', () => { fecha = sf.value; pintar(); });

    const dameTarea = (n) => ((cajon[fecha] || {}).tareas || []).find(t => String(t.n) === String(n));

    container.querySelectorAll('.slt-estado').forEach(s =>
      s.addEventListener('change', async () => {
        const t = dameTarea(s.dataset.n);
        if (!t) return;
        t.estado = s.value;
        if (OPC.alGuardar) await OPC.alGuardar(cajon);
        pintar();
      }));

    container.querySelectorAll('.slt-nota').forEach(inp => {
      let esperar = null;
      inp.addEventListener('input', () => {
        const t = dameTarea(inp.dataset.n);
        if (!t) return;
        t.nota = inp.value;
        // Con espera: guardar en cada tecla escribiría cientos de veces
        clearTimeout(esperar);
        esperar = setTimeout(() => { if (OPC.alGuardar) OPC.alGuardar(cajon); }, 900);
      });
    });

    const btn = container.querySelector('#slt_barrer');
    if (btn) btn.addEventListener('click', async () => {
      if (!OPC.alBarrer) return;
      btn.disabled = true;
      btn.textContent = '⌛ REVISANDO EL ALMACÉN...';
      try {
        const nuevo = await OPC.alBarrer();
        if (nuevo) { cajon = nuevo; fecha = svc.fechasDe(cajon)[0] || fecha; }
      } catch (e) { console.error('[Slotting] no se pudo barrer:', e); }
      btn.disabled = false;
      pintar();
    });
  }

  pintar();
};
