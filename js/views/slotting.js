/**
 * SLOTTING — CUERPOS POR REVISAR
 *
 * El módulo donde aterriza lo que el cálculo de almacenaje encuentra roto. Hasta el
 * 14-ago-2026 no existía: la tarea se topaba con un cuerpo que tenía dos artículos, lo
 * resolvía como podía, y el hallazgo se perdía. A la noche siguiente reaparecía igual.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe todo por `OPC` y quien lo monta
 * —dashboard_v28.js— se encarga de buscarlo y de guardarlo. Mismo reparto que
 * turno_actividades.js y marcas.js: el que dibuja no sale a buscar datos.
 *
 *   OPC.cajon       lo guardado: { 'MZN02-20-19': {...}, __corrida: '...' }
 *   OPC.alGuardar   se llama con el cajón entero cuando alguien cambia un estado o una nota
 *   OPC.alBarrer    se llama cuando aprietan "Buscar ahora"; devuelve el cajón nuevo
 *   OPC.svc         slottingService, para ESTADOS/TIPOS/comoLista/resumen
 *
 * TODO VA ENCERRADO BAJO `#slt`. Los nombres que usa —fila, chip, panel— son los que uno
 * elegiría en cualquier pantalla; encerrados no chocan con los del tablero.
 */

export const montarSlotting = (container, OPC = {}) => {
  const svc = OPC.svc;
  let cajon = OPC.cajon || {};
  let filtro = 'pendiente';          // qué estado se está mirando
  let texto = '';

  const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const pintar = () => {
    const res = svc.resumen(cajon);
    const todos = svc.comoLista(cajon);
    const q = texto.trim().toLowerCase();
    const lista = todos.filter(h => {
      if (filtro !== 'todos' && h.estado !== filtro) return false;
      if (!q) return true;
      return String(h.id).toLowerCase().includes(q)
          || (h.items || []).some(i => String(i.sku7).includes(q)
                                    || String(i.marca).toLowerCase().includes(q));
    });

    const chip = (id, etiqueta, n, color) => `
      <button class="slt-chip" data-f="${id}" style="
        background:${filtro === id ? color : 'rgba(255,255,255,0.03)'};
        color:${filtro === id ? '#0b0f19' : 'var(--text-muted)'};
        border:1px solid ${filtro === id ? color : 'rgba(255,255,255,0.08)'};
        border-radius:20px; padding:0.35rem 0.9rem; font-size:0.72rem; font-weight:800;
        cursor:pointer; letter-spacing:0.04em; white-space:nowrap;">
        ${etiqueta} · ${n}
      </button>`;

    container.innerHTML = `
      <div id="slt">
        <!-- ── el avance, que es lo que se mira primero ── -->
        <div style="background:rgba(30,41,59,0.35); border:1px solid var(--border); border-radius:12px;
                    padding:1.1rem 1.4rem; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
            <div>
              <div style="font-size:0.68rem; color:var(--text-muted); font-weight:800; letter-spacing:0.12em; text-transform:uppercase;">
                Cuerpos por revisar
              </div>
              <div style="display:flex; align-items:baseline; gap:0.6rem; margin-top:0.35rem;">
                <span style="font-size:2rem; font-weight:800; color:#fff; line-height:1;">${res.resuelto}</span>
                <span style="font-size:1rem; color:var(--text-muted);">de ${res.total} resueltos</span>
                <span style="font-size:1.1rem; font-weight:800; color:#22c55e;">${res.avance}%</span>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
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
            ${res.corrida ? `Última búsqueda: <b style="color:#94a3b8;">${esc(res.corrida)}</b>` : 'Todavía no se buscó nada.'}
          </div>
        </div>

        <!-- ── filtros ── -->
        <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.9rem; flex-wrap:wrap;">
          ${chip('pendiente', 'Por revisar', res.pendiente, '#f59e0b')}
          ${chip('proceso', 'En proceso', res.proceso, '#3b82f6')}
          ${chip('resuelto', 'Resueltos', res.resuelto, '#22c55e')}
          ${chip('todos', 'Todos', res.total, '#94a3b8')}
          <input id="slt_buscar" type="search" placeholder="Ubicación, artículo o marca..."
                 value="${esc(texto)}" autocomplete="off" style="flex:1; min-width:200px;
                 background:rgba(255,255,255,0.03); border:1px solid var(--border); color:#fff;
                 border-radius:8px; padding:0.45rem 0.8rem; font-size:0.78rem;">
        </div>

        <!-- ── la lista ── -->
        <div id="slt_lista" style="display:flex; flex-direction:column; gap:0.5rem;">
          ${lista.length ? lista.map(fila).join('') : `
            <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.85rem;
                        background:rgba(255,255,255,0.02); border:1px dashed var(--border); border-radius:10px;">
              ${todos.length ? 'No hay nada con ese filtro.'
                             : 'Todavía no hay hallazgos. Aprieta <b>BUSCAR AHORA</b> para revisar el almacén.'}
            </div>`}
        </div>
      </div>`;

    enganchar();
  };

  /** Una tarjeta por cuerpo con problema. Lo que hay adentro va a la vista, no escondido. */
  function fila(h) {
    const est = svc.ESTADOS[h.estado] || svc.ESTADOS.pendiente;
    const tipo = svc.TIPOS[h.tipo] || { etiqueta: h.tipo };
    const items = h.items || [];
    const total = items.reduce((a, i) => a + (Number(i.pares) || 0), 0);

    return `
      <div style="background:rgba(15,23,42,0.45); border:1px solid var(--border);
                  border-left:4px solid ${est.color}; border-radius:10px; padding:0.85rem 1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap;">
              <span style="font-family:ui-monospace,Consolas,monospace; font-size:1rem; font-weight:800; color:#fff;">
                ${esc(h.id)}
              </span>
              <span style="font-size:0.65rem; font-weight:800; padding:2px 9px; border-radius:20px;
                           background:${est.color}22; color:${est.color}; border:1px solid ${est.color}44;">
                ${est.etiqueta.toUpperCase()}
              </span>
              ${(h.veces || 1) > 1 ? `<span style="font-size:0.65rem; color:#f59e0b;">visto ${h.veces} días</span>` : ''}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">
              ${esc(tipo.etiqueta)} · ${items.length} artículos · ${total.toLocaleString('es-PE')} pares
            </div>
          </div>
          <select data-id="${esc(h.id)}" class="slt-estado" style="background:rgba(255,255,255,0.04);
                  border:1px solid var(--border); color:#fff; border-radius:7px;
                  padding:0.35rem 0.6rem; font-size:0.72rem; cursor:pointer;">
            ${Object.keys(svc.ESTADOS).map(k =>
              `<option value="${k}" ${h.estado === k ? 'selected' : ''}>${svc.ESTADOS[k].etiqueta}</option>`).join('')}
          </select>
        </div>

        ${items.length ? `
        <table style="width:100%; border-collapse:collapse; margin-top:0.7rem; font-size:0.74rem;">
          <thead>
            <tr style="color:var(--text-muted); font-size:0.62rem; letter-spacing:0.08em; text-transform:uppercase;">
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Artículo</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Marca</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Temporada</th>
              <th style="text-align:left; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Categoría</th>
              <th style="text-align:right; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">Pares</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td style="padding:4px 6px; font-family:ui-monospace,Consolas,monospace; color:#fff;">${esc(i.sku7)}</td>
                <td style="padding:4px 6px; color:#cbd5e1;">${esc(i.marca) || '—'}</td>
                <td style="padding:4px 6px; color:#cbd5e1;">${esc(i.temporada) || '—'}</td>
                <td style="padding:4px 6px; color:#94a3b8;">${esc(i.categoria) || '—'}</td>
                <td style="padding:4px 6px; text-align:right; font-family:ui-monospace,Consolas,monospace; color:#fff;">
                  ${(Number(i.pares) || 0).toLocaleString('es-PE')}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : ''}

        <input class="slt-nota" data-id="${esc(h.id)}" value="${esc(h.nota)}"
               placeholder="Nota para el equipo..." style="width:100%; margin-top:0.6rem;
               background:rgba(255,255,255,0.02); border:1px solid var(--border); color:#cbd5e1;
               border-radius:6px; padding:0.35rem 0.6rem; font-size:0.72rem;">
      </div>`;
  }

  function enganchar() {
    container.querySelectorAll('.slt-chip').forEach(b =>
      b.addEventListener('click', () => { filtro = b.dataset.f; pintar(); }));

    const buscar = container.querySelector('#slt_buscar');
    if (buscar) buscar.addEventListener('input', (e) => {
      texto = e.target.value;
      // Se repinta solo la lista para no perder el foco del buscador
      const res = svc.comoLista(cajon);
      const q = texto.trim().toLowerCase();
      const vis = res.filter(h => (filtro === 'todos' || h.estado === filtro) && (!q ||
          String(h.id).toLowerCase().includes(q) ||
          (h.items || []).some(i => String(i.sku7).includes(q) || String(i.marca).toLowerCase().includes(q))));
      const cont = container.querySelector('#slt_lista');
      if (cont) cont.innerHTML = vis.length ? vis.map(fila).join('')
        : `<div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted); font-size:0.85rem;
                 background:rgba(255,255,255,0.02); border:1px dashed var(--border); border-radius:10px;">
             No hay nada con ese filtro.</div>`;
      enganchar();
    });

    container.querySelectorAll('.slt-estado').forEach(s =>
      s.addEventListener('change', async () => {
        const h = cajon[s.dataset.id];
        if (!h) return;
        h.estado = s.value;
        if (s.value === 'resuelto') h.resueltoEl = new Date().toLocaleString('es-PE');
        if (OPC.alGuardar) await OPC.alGuardar(cajon);
        pintar();
      }));

    container.querySelectorAll('.slt-nota').forEach(inp => {
      let t = null;
      inp.addEventListener('input', () => {
        const h = cajon[inp.dataset.id];
        if (!h) return;
        h.nota = inp.value;
        // Con espera: guardar en cada tecla escribiría cientos de veces
        clearTimeout(t);
        t = setTimeout(() => { if (OPC.alGuardar) OPC.alGuardar(cajon); }, 900);
      });
    });

    const btn = container.querySelector('#slt_barrer');
    if (btn) btn.addEventListener('click', async () => {
      if (!OPC.alBarrer) return;
      btn.disabled = true;
      btn.textContent = '⌛ REVISANDO EL ALMACÉN...';
      try {
        const nuevo = await OPC.alBarrer();
        if (nuevo) cajon = nuevo;
      } catch (e) {
        console.error('[Slotting] no se pudo barrer:', e);
      }
      btn.disabled = false;
      pintar();
    });
  }

  pintar();
};
