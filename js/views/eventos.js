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
 *
 * EL MARCO SE DIBUJA UNA SOLA VEZ Y NO SE VUELVE A TOCAR. Ver más abajo, en `cargar`:
 * redibujarlo en cada filtro era lo que hacía parpadear la pantalla.
 */

import { icono } from '../services_v245/iconos.js?v=29.0622';

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

/* Los tres filtros. Cada uno es una lista aparte y no una sola mezclada, porque así se
   pueden cruzar —los errores DEL ROBOT de los últimos 3 días— cosa que los botones no
   dejaban: apretar uno apagaba al otro. */
const LISTAS = [
    { id: 'evt_dias', rotulo: 'Cuándo', campo: 'dias', ancho: '135px', opciones: [
        { v: 1, t: 'Hoy' }, { v: 3, t: 'Últimos 3 días' }, { v: 7, t: 'La semana' } ] },
    { id: 'evt_origen', rotulo: 'Origen', campo: 'origen', ancho: '130px', opciones: [
        { v: '', t: 'Todo' }, { v: 'robot', t: 'El robot' }, { v: 'web', t: 'Las personas' } ] },
    { id: 'evt_tipo', rotulo: 'Estado', campo: 'tipo', ancho: '130px', opciones: [
        { v: '', t: 'Todo' }, { v: 'error', t: 'Solo errores' },
        { v: 'aviso', t: 'Solo avisos' }, { v: 'ok', t: 'Solo lo que salió bien' } ] }
];

export const montarEventos = (container, OPC = {}) => {
    const avisar = OPC.alertar || ((t, m) => alert(t + '\n\n' + m));
    const filtros = { dias: 1, origen: '', tipo: '', q: '' };
    let datos = { eventos: [], total: 0 };

    /* La hora sale como viene del servidor —hora de Lima— y solo se le da vuelta a la
       fecha. Nada de `new Date()`: interpretarla como UTC correría todo cinco horas. */
    const cuandoBonito = (s) => {
        const [f, h] = String(s || '').split(' ');
        const [, m, d] = String(f || '').split('-');
        return { dia: (d && m) ? `${d}/${m}` : (f || ''), hora: (h || '').slice(0, 8) };
    };

    const pastilla = (tipo) => {
        const c = COLOR[tipo] || COLOR.ok;
        return `<span style="display:inline-block; min-width:52px; text-align:center; font-size:var(--t-xs);
                       font-weight:800; letter-spacing:0.04em; color:${c.texto}; background:${c.fondo};
                       border:1px solid ${c.texto}; border-radius:6px; padding:2px 7px;">${c.etiqueta}</span>`;
    };

    const lista = (L) => `
        <label style="display:flex; align-items:center; gap:0.45rem;">
          <span style="font-size:var(--t-xs); font-weight:800; letter-spacing:0.04em;
                       color:var(--text-muted); text-transform:uppercase;">${L.rotulo}</span>
          <select id="${L.id}" style="background:var(--panel-deep); border:1px solid rgba(var(--ink-rgb), 0.14);
                       color:var(--text-strong); padding:0.38rem 0.7rem; border-radius:6px; width:${L.ancho};
                       font-size:var(--t-xs); font-weight:700; cursor:pointer; outline:none; font-family:inherit;">
            ${L.opciones.map(o => `<option value="${o.v}"${o.v === filtros[L.campo] ? ' selected' : ''}
                >${esc(o.t)}</option>`).join('')}
          </select>
        </label>`;

    /* ---------- El marco. Se dibuja UNA vez ---------- */
    const armar = () => {
        container.innerHTML = `
        <div id="evt" class="animate-fade-in" style="display:flex; flex-direction:column; gap:1rem;">

          <div class="glass-panel" style="padding:1.1rem 1.3rem; display:flex; align-items:center;
                      justify-content:space-between; gap:1rem; flex-wrap:wrap;">
            <div>
              <h4 style="margin:0; color:var(--text-strong); font-size:var(--t-lg); font-weight:800;
                         letter-spacing:0.5px;">📜 LOG DE LA PLATAFORMA</h4>
              <div id="evt_cuenta" style="font-size:var(--t-xs); color:var(--text-muted); margin-top:3px;">
                Leyendo...</div>
            </div>
            <div style="display:flex; gap:0.7rem; align-items:center; flex-wrap:wrap;">
              ${LISTAS.map(lista).join('')}
              <input id="evt_q" type="text" placeholder="🔍 Buscar..."
                     style="background:rgba(var(--ink-rgb), 0.04); border:1px solid var(--border);
                            color:var(--text-strong); padding:0.45rem 0.8rem; border-radius:8px;
                            font-size:var(--t-xs); outline:none; width:170px; font-family:inherit;">
              <button id="evt_refrescar" class="btn-icono" title="Volver a leer">${icono('refrescar', 22)}</button>
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
                <tbody id="evt_cuerpo" style="transition:opacity .12s;"></tbody>
              </table>
            </div>
          </div>
        </div>`;

        LISTAS.forEach(L => {
            const s = container.querySelector('#' + L.id);
            if (s) s.addEventListener('change', () => {
                const v = s.value;
                filtros[L.campo] = (L.campo === 'dias') ? Number(v) : v;
                cargar();
            });
        });
        const q = container.querySelector('#evt_q');
        /* Se busca al soltar Enter y no en cada tecla: cada letra sería una consulta al
           servidor, y con una semana de anotaciones eso se nota. */
        if (q) q.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { filtros.q = q.value.trim(); cargar(); }
        });
        const r = container.querySelector('#evt_refrescar');
        if (r) r.addEventListener('click', cargar);
    };

    /* ---------- Lo único que cambia al filtrar: las filas y la cuenta ---------- */
    const pintarFilas = () => {
        const cuerpo = container.querySelector('#evt_cuerpo');
        const cuenta = container.querySelector('#evt_cuenta');
        if (!cuerpo) return;

        cuerpo.innerHTML = datos.eventos.map(e => {
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
        }).join('') || `
            <tr><td colspan="5" style="padding:2.5rem; text-align:center; color:var(--text-muted);
                    font-size:var(--t-sm);">No hay nada anotado con estos filtros.</td></tr>`;

        if (cuenta) {
            const conError = datos.eventos.filter(e => e.tipo === 'error').length;
            cuenta.innerHTML = `${datos.eventos.length} de ${datos.total} anotaciones · `
                + (conError ? `<b style="color:var(--danger-soft);">${conError} con error</b> · ` : '')
                + 'se guarda una semana';
        }
    };

    /* ---------- Leer ----------
       DOS COSAS QUE EVITAN EL PARPADEO, y las dos hacen falta:

       1. No se toca el marco. Antes se redibujaba el contenedor entero dos veces por clic
          —una en blanco con "Leyendo..." y otra con el resultado—, así que los filtros
          desaparecían y volvían, y el que acababas de apretar perdía el foco.
       2. No se avisa que está leyendo si tarda poco. Por debajo de un cuarto de segundo el
          aviso molesta más que la espera: aparece y se va antes de que alcances a leerlo. */
    let temporizador = null;
    let pedido = 0;

    const cargar = async () => {
        if (!OPC.traer) return;
        const cuerpo = container.querySelector('#evt_cuerpo');
        const mio = ++pedido;

        clearTimeout(temporizador);
        if (cuerpo) temporizador = setTimeout(() => { cuerpo.style.opacity = '0.4'; }, 250);

        let leido, falla = null;
        try { leido = await OPC.traer({ ...filtros }); } catch (e) { falla = e; }

        /* Si mientras tanto se apretó otro filtro, esta respuesta ya no sirve: pintarla
           dejaría en pantalla el resultado del filtro viejo. */
        if (mio !== pedido) return;

        clearTimeout(temporizador);
        if (cuerpo) cuerpo.style.opacity = '1';

        if (falla) {
            datos = { eventos: [], total: 0 };
            avisar('NO SE PUDO LEER EL LOG', (falla && falla.message) || String(falla), 'error');
        } else {
            datos = leido;
        }
        pintarFilas();
    };

    armar();
    cargar();
};
