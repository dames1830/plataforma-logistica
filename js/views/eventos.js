/**
 * LOG — lo que pasa en la plataforma
 *
 * Una sola tabla: cuándo, quién, qué pasó y el detalle. Lo más nuevo arriba.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR: recibe todo por `OPC`, igual que slotting.js y
 * turno_actividades.js. Quien lo monta —dashboard_v28.js— busca.
 *
 *   OPC.traer     ({dias, origen, tipo, q}) => { eventos, total }
 *   OPC.alertar   (titulo, mensaje, tipo)
 *
 * TODO VA ENCERRADO BAJO `#evt`.
 */

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* El color dice de un vistazo si algo salió mal. Va por el TIPO y no por el origen:
   lo que importa al abrir la pantalla es si hay errores, no quién los produjo. */
const COLOR = {
    ok:    { texto: 'var(--success)', fondo: 'rgba(var(--success-rgb), 0.14)', etiqueta: 'OK' },
    aviso: { texto: 'var(--warning-soft)', fondo: 'rgba(var(--warning-rgb), 0.16)', etiqueta: 'AVISO' },
    error: { texto: 'var(--danger-soft)', fondo: 'rgba(var(--danger-rgb), 0.16)', etiqueta: 'ERROR' }
};
const ICONO_ORIGEN = { robot: '🤖', web: '👤', servidor: '🖥️' };

export const montarEventos = (container, OPC = {}) => {
    const avisar = OPC.alertar || ((t, m) => alert(t + '\n\n' + m));
    let filtros = { dias: 1, origen: '', tipo: '', q: '' };
    let datos = { eventos: [], total: 0 };
    let cargando = false;

    /* La hora sale como viene del servidor —hora de Lima— y solo se le da vuelta a la
       fecha. Nada de `new Date()`: interpretarla como UTC correría todo cinco horas. */
    const cuandoBonito = (s) => {
        const [f, h] = String(s || '').split(' ');
        const [a, m, d] = String(f || '').split('-');
        return { dia: (d && m) ? `${d}/${m}` : (f || ''), hora: (h || '').slice(0, 8), fecha: f || '' };
    };

    const pastilla = (tipo) => {
        const c = COLOR[tipo] || COLOR.ok;
        return `<span style="display:inline-block; min-width:52px; text-align:center; font-size:var(--t-xs);
                       font-weight:800; letter-spacing:0.04em; color:${c.texto}; background:${c.fondo};
                       border:1px solid ${c.texto}; border-radius:6px; padding:2px 7px;">${c.etiqueta}</span>`;
    };

    const boton = (id, texto, activo) => `
        <button class="evt-f" data-id="${id}" style="background:${activo ? 'var(--btn-fill)' : 'rgba(var(--ink-rgb), 0.05)'};
                color:${activo ? 'var(--on-primary)' : 'var(--text-pale)'}; border:1px solid ${activo ? 'transparent' : 'var(--border)'};
                border-radius:8px; padding:0.45rem 0.9rem; font-size:var(--t-xs); font-weight:800;
                cursor:pointer; font-family:inherit; white-space:nowrap;">${texto}</button>`;

    const pintar = () => {
        const hayErrores = datos.eventos.filter(e => e.tipo === 'error').length;
        const filas = datos.eventos.map(e => {
            const c = cuandoBonito(e.cuando);
            const col = COLOR[e.tipo] || COLOR.ok;
            return `
            <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.05);">
              <td style="padding:9px 10px; white-space:nowrap; font-family:var(--font-num); font-size:var(--t-xs);
                         color:var(--text-muted);">${esc(c.dia)}<span style="color:var(--text-strong);
                         font-weight:700; margin-left:6px;">${esc(c.hora)}</span></td>
              <td style="padding:9px 10px; white-space:nowrap;">${pastilla(e.tipo)}</td>
              <td style="padding:9px 10px; white-space:nowrap; font-size:var(--t-sm);">
                  ${ICONO_ORIGEN[e.origen] || '•'} <b style="color:var(--text-strong);">${esc(e.quien || e.origen)}</b></td>
              <td style="padding:9px 10px; font-size:var(--t-sm); color:${col.texto}; font-weight:600;">${esc(e.accion)}</td>
              <td style="padding:9px 10px; font-size:var(--t-xs); color:var(--text-muted);">${esc(e.detalle)}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
        <div id="evt" class="animate-fade-in" style="display:flex; flex-direction:column; gap:1rem;">

          <div class="glass-panel" style="padding:1.1rem 1.3rem; display:flex; align-items:center;
                      justify-content:space-between; gap:1rem; flex-wrap:wrap;">
            <div>
              <h4 style="margin:0; color:var(--text-strong); font-size:var(--t-lg); font-weight:800;
                         letter-spacing:0.5px;">📜 LOG DE LA PLATAFORMA</h4>
              <div style="font-size:var(--t-xs); color:var(--text-muted); margin-top:3px;">
                ${datos.eventos.length} de ${datos.total} anotaciones ·
                ${hayErrores ? `<b style="color:var(--danger-soft);">${hayErrores} con error</b> · ` : ''}se guarda una semana
              </div>
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
              ${boton('d1', 'Hoy', filtros.dias === 1)}
              ${boton('d3', '3 días', filtros.dias === 3)}
              ${boton('d7', 'La semana', filtros.dias === 7)}
              <span style="width:1px; height:22px; background:var(--border); margin:0 4px;"></span>
              ${boton('o', 'Todo', !filtros.origen && !filtros.tipo)}
              ${boton('orobot', '🤖 Robot', filtros.origen === 'robot')}
              ${boton('oweb', '👤 Personas', filtros.origen === 'web')}
              ${boton('terror', '⚠️ Solo errores', filtros.tipo === 'error')}
              <input id="evt_q" type="text" value="${esc(filtros.q)}" placeholder="🔍 Buscar..."
                     style="background:rgba(var(--ink-rgb), 0.04); border:1px solid var(--border);
                            color:var(--text-strong); padding:0.45rem 0.8rem; border-radius:8px;
                            font-size:var(--t-xs); outline:none; width:170px; font-family:inherit;">
              <button id="evt_refrescar" class="btn-icono" title="Volver a leer">🔄</button>
            </div>
          </div>

          <div class="glass-panel" style="padding:0; overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:rgba(var(--ink-rgb), 0.04); color:var(--text-muted);
                             font-size:var(--t-xs); text-transform:uppercase; letter-spacing:0.06em;">
                    <th style="padding:10px; text-align:left; width:110px;">Cuándo</th>
                    <th style="padding:10px; text-align:left; width:80px;">Estado</th>
                    <th style="padding:10px; text-align:left; width:170px;">Quién</th>
                    <th style="padding:10px; text-align:left;">Qué pasó</th>
                    <th style="padding:10px; text-align:left;">Detalle</th>
                  </tr>
                </thead>
                <tbody>${filas || `
                  <tr><td colspan="5" style="padding:2.5rem; text-align:center; color:var(--text-muted);
                          font-size:var(--t-sm);">${cargando ? 'Leyendo...'
                          : 'No hay nada anotado con estos filtros.'}</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>`;

        enganchar();
    };

    const enganchar = () => {
        container.querySelectorAll('.evt-f').forEach(b => b.addEventListener('click', () => {
            const id = b.dataset.id;
            if (id === 'd1') filtros.dias = 1;
            else if (id === 'd3') filtros.dias = 3;
            else if (id === 'd7') filtros.dias = 7;
            else if (id === 'o') { filtros.origen = ''; filtros.tipo = ''; }
            else if (id === 'orobot') { filtros.origen = filtros.origen === 'robot' ? '' : 'robot'; filtros.tipo = ''; }
            else if (id === 'oweb') { filtros.origen = filtros.origen === 'web' ? '' : 'web'; filtros.tipo = ''; }
            else if (id === 'terror') { filtros.tipo = filtros.tipo === 'error' ? '' : 'error'; filtros.origen = ''; }
            cargar();
        }));
        const q = container.querySelector('#evt_q');
        if (q) {
            /* Se busca al soltar Enter y no en cada tecla: cada letra sería una consulta
               al servidor, y con una semana de anotaciones eso se nota. */
            q.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { filtros.q = q.value.trim(); cargar(); }
            });
        }
        const r = container.querySelector('#evt_refrescar');
        if (r) r.addEventListener('click', cargar);
    };

    const cargar = async () => {
        if (!OPC.traer) return;
        cargando = true; pintar();
        try {
            datos = await OPC.traer(filtros);
        } catch (e) {
            datos = { eventos: [], total: 0 };
            avisar('NO SE PUDO LEER EL LOG', (e && e.message) || String(e), 'error');
        }
        cargando = false;
        pintar();
    };

    cargar();
};
