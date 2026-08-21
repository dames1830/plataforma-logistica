/**
 * ZONA BUFFER → PENDIENTE
 *
 * Lo que comercial mando por correo y el CD todavia no atendio. Lo pidio Daniel el
 * 20-ago-2026 como fase 2 del robot del correo: *"ármame el submódulo pendiente,
 * ármame el Excel y ármame todos los reportes"*.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe `OPC.datos` ya calculados —los
 * publica `robot/armar_pendiente.py` en el area `pendiente_despacho`— y solo
 * dibuja. Mismo reparto que `turno_actividades.js` y `marcas.js`: por eso se puede
 * probar sin contraseña.
 *
 * TODO EL CSS VA ENCERRADO BAJO `#pend` Y LOS IDS LLEVAN PREFIJO `pend_`. Los
 * nombres que usa —panel, card, bar, nav— chocarian con los del tablero.
 *
 * OPC = {
 *   datos:          lo que publico el robot, o null si esa fecha no tiene nada
 *   fecha:          'AAAA-MM-DD'
 *   alCambiarFecha: (nueva) => {}
 *   alDescargar:    () => {}        // baja el Excel del modulo Descargas
 * }
 */

const nf = (n) => Number(n || 0).toLocaleString('es-PE');

/** El % que le toca a la barra, siempre contra el mayor de su propio cuadro. */
const anchoBarra = (v, max) => (max > 0 ? Math.max(2, Math.round(100 * v / max)) : 0);

const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * UN CUADRO DE LOS SIETE.
 *
 * `filas` son {k, ped, und}. La columna de pedidos se puede apagar —el corte por
 * calzado no la tiene, porque un pedido trae calzado Y no calzado a la vez y
 * contarlo en las dos filas daria un total que no cierra—.
 *
 * TODO CUADRO DICE DE QUE ES SU NUMERO. Regla de Daniel: *"no sé de qué es ese
 * número, si es calzado o viene combinado con todo"*.
 */
const cuadro = (titulo, pie, filas, opciones) => {
    const o = opciones || {};
    const tope = o.tope || 8;
    const conPed = o.conPed !== false;
    const conPct = !!o.conPct;
    const lista = (filas || []).slice(0, tope);
    const max = lista.reduce((m, f) => Math.max(m, Number(f.und) || 0), 0);
    const total = (filas || []).reduce((s, f) => s + (Number(f.und) || 0), 0);
    const resto = (filas || []).length - lista.length;

    if (!lista.length) {
        return `<div class="pend-panel"><h3>${esc(titulo)}</h3>
            <div class="pend-cap">${esc(pie)}</div>
            <div class="pend-vacio">Sin datos para esta fecha</div></div>`;
    }

    return `<div class="pend-panel">
        <h3>${esc(titulo)}</h3>
        <div class="pend-cap">${esc(pie)}</div>
        <table>
          <thead><tr>
            <th>${esc(o.etiqueta || 'DETALLE')}</th>
            ${conPed ? '<th class="n">PEDIDOS</th>' : ''}
            <th class="n">UNIDADES</th>
            ${conPct ? '<th class="n">%</th>' : ''}
          </tr></thead>
          <tbody>
            ${lista.map(f => {
                const und = Number(f.und) || 0;
                const destacar = o.destacar && o.destacar(f);
                return `<tr${destacar ? ' class="pend-ojo"' : ''}>
                  <td>${esc(f.k)}</td>
                  ${conPed ? `<td class="n">${nf(f.ped)}</td>` : ''}
                  <td class="n">${nf(und)}
                    <span class="pend-bar${destacar ? ' ambar' : ''}"
                          style="width:${anchoBarra(und, max)}%"></span></td>
                  ${conPct ? `<td class="n">${total ? Math.round(100 * und / total) : 0}%</td>` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${resto > 0 ? `<span class="pend-mas">▸ y ${nf(resto)} más</span>` : ''}
        ${o.nota ? `<div class="pend-nota">${o.nota}</div>` : ''}
      </div>`;
};

export function montarPendiente(raiz, OPC) {
    const O = OPC || {};
    const d = O.datos;
    const fecha = O.fecha || (d && d.fecha) || '';

    raiz.innerHTML = `<div id="pend">${estilos()}${cuerpo(d, fecha)}</div>`;

    const cal = raiz.querySelector('#pend_fecha');
    if (cal) cal.addEventListener('change', () => {
        if (cal.value && typeof O.alCambiarFecha === 'function') O.alCambiarFecha(cal.value);
    });
    const bajar = raiz.querySelector('#pend_bajar');
    if (bajar) bajar.addEventListener('click', () => {
        if (typeof O.alDescargar === 'function') O.alDescargar();
    });
}

/* ── EL CUERPO ─────────────────────────────────────────────────────────────── */

function cuerpo(d, fecha) {
    const cab = `
      <div class="pend-head">
        <div>
          <h2>Pendiente de despacho</h2>
          <div class="pend-sub">${d && d.generado
              ? 'armado el ' + esc(d.generado)
              : 'lo arma el robot cuando llega el correo de comercial'}</div>
        </div>
        <div class="pend-acc">
          <input type="date" id="pend_fecha" value="${esc(fecha)}">
          <button id="pend_bajar" class="pend-btn"${d ? '' : ' disabled'}>📥 DESCARGAR EXCEL</button>
        </div>
      </div>`;

    /* SIN DATOS NO SE INVENTA UN CERO. Un cuadro en cero se lee como "no hay nada
       pendiente", que es lo contrario de "todavia no se armo". */
    if (!d || !d.totales) {
        return cab + `<div class="pend-panel pend-nada">
            <div class="pend-nada-t">Todavía no hay pendiente de esta fecha</div>
            <div class="pend-cap">Se arma solo en cuanto el robot guarda el correo de
            comercial, entre las 19:00 y las 20:00. Si ya pasó esa hora y sigue vacío,
            revisar el log del robot.</div></div>`;
    }

    const t = d.totales, o = d.origen || {};
    const viejos = (d.antiguedad || []).filter(x => /8 a 15|mas de 15/.test(x.k));
    const pedViejos = viejos.reduce((s, x) => s + (x.ped || 0), 0);
    const undViejos = viejos.reduce((s, x) => s + (x.und || 0), 0);

    const tarjetas = `
      <div class="pend-cards">
        ${[['pedidos', t.pedidos], ['tiendas', t.tiendas], ['artículos', t.articulos]]
          .map(([l, v]) => `<div class="pend-card"><div class="v">${nf(v)}</div>
              <div class="l">${l.toUpperCase()}</div></div>`).join('')}
        <div class="pend-card"><div class="v hot">${nf(t.unidades)}</div>
          <div class="l">UNIDADES POR ATENDER</div></div>
        <div class="pend-card"><div class="v">${nf(t.diasMasVieja)}</div>
          <div class="l">DÍAS LA MÁS VIEJA</div></div>
      </div>`;

    const origen = `
      <div class="pend-panel">
        <h3>DE DÓNDE SALE ESTE NÚMERO</h3>
        <div class="pend-cap">El WMS muestra mucho más abierto de lo que el CD debe trabajar</div>
        <table>
          <thead><tr><th>ORIGEN</th><th class="n">ÓRDENES</th><th class="n">UNIDADES</th></tr></thead>
          <tbody>
            <tr><td>Abierto en el WMS (Creada + Parc. asignado)</td>
                <td class="n">${nf(o.abiertoWms && o.abiertoWms.ordenes)}</td>
                <td class="n">${nf(o.abiertoWms && o.abiertoWms.unidades)}</td></tr>
            <tr><td><b>Comercial SÍ lo mandó</b> → esto se trabaja</td>
                <td class="n"><b>${nf(o.mandado && o.mandado.ordenes)}</b></td>
                <td class="n"><b>${nf(o.mandado && o.mandado.unidades)}</b></td></tr>
            <tr class="pend-gris"><td>Comercial nunca lo liberó → no es deuda del CD</td>
                <td class="n">${nf(o.noLiberado && o.noLiberado.ordenes)}</td>
                <td class="n">${nf(o.noLiberado && o.noLiberado.unidades)}</td></tr>
          </tbody>
        </table>
        <div class="pend-nota">Sin el cruce contra el correo entrarían al buffer
          <b>${nf(o.noLiberado && o.noLiberado.unidades)} unidades que nadie pidió</b>.</div>
      </div>`;

    const cuadros = [
        cuadro('DESDE CUÁNDO ESPERA',
               'Contando desde que comercial la mandó por correo',
               d.antiguedad, {
                 etiqueta: 'ANTIGÜEDAD', tope: 8,
                 destacar: f => /8 a 15|mas de 15/.test(f.k),
                 nota: pedViejos
                   ? `<b>${nf(pedViejos)} pedidos llevan más de una semana esperando.</b>
                      Son ${nf(undViejos)} unidades, pero son ${nf(pedViejos)} tiendas
                      que no recibieron.`
                   : ''
               }),
        cuadro('A QUÉ TIENDA LE FALTA DESPACHAR',
               `Las 10 más cargadas de ${nf(t.tiendas)}`,
               d.tiendas, { etiqueta: 'TIENDA', tope: 10 }),
        cuadro('POR GENDER RIMS',
               'Sale del Maestro de artículos',
               d.rims, { etiqueta: 'GENDER RIMS', tope: 10 }),
        cuadro('POR COLECCIÓN',
               'La Coleccion PO del Maestro — no la Temporada del mezzanine',
               d.coleccion, { etiqueta: 'COLECCIÓN', tope: 8, conPct: true }),
        cuadro('POR QUÉ LO PIDIÓ COMERCIAL',
               'La columna Prioridad del correo',
               d.prioridad, { etiqueta: 'PRIORIDAD', tope: 8 }),
        cuadro('CALZADO Y LO QUE NO LO ES',
               'Lo separa el G. Gender del Maestro, no la etiqueta del correo',
               d.gender, {
                 etiqueta: 'TIPO', tope: 6, conPed: false, conPct: true,
                 nota: 'Un total que mezcla zapatos con cajas no dice nada.'
               }),
    ].join('');

    return cab + tarjetas + `<div class="pend-grid">${cuadros}${origen}</div>`;
}

/* ── EL ESTILO, todo bajo #pend ─────────────────────────────────────────────── */

function estilos() {
    return `<style>
    #pend{--pend-amber:#f59e0b}
    #pend .pend-head{display:flex;justify-content:space-between;align-items:center;
      flex-wrap:wrap;gap:12px;margin-bottom:16px}
    #pend h2{font-size:1.2rem;font-weight:800;margin:0;color:#fff}
    #pend .pend-sub{color:var(--text-muted);font-size:.8rem}
    #pend .pend-acc{display:flex;gap:8px;align-items:center}
    #pend input[type=date]{background:rgba(0,0,0,.3);border:1px solid var(--border);
      border-radius:8px;color:#fff;padding:8px 10px;font-size:.82rem}
    #pend .pend-btn{background:var(--primary);color:#0b1020;border:0;border-radius:9px;
      padding:9px 16px;font-weight:800;font-size:.78rem;letter-spacing:.4px;cursor:pointer}
    #pend .pend-btn:disabled{opacity:.4;cursor:not-allowed}

    #pend .pend-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
      gap:12px;margin-bottom:16px}
    #pend .pend-card{background:rgba(255,255,255,.04);border:1px solid var(--border);
      border-radius:14px;padding:15px;text-align:center}
    #pend .pend-card .v{font-size:1.55rem;font-weight:800;color:#fff;line-height:1.1}
    #pend .pend-card .v.hot{color:var(--pend-amber)}
    #pend .pend-card .l{font-size:.7rem;color:var(--text-muted);margin-top:3px;letter-spacing:.4px}

    #pend .pend-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media(max-width:980px){#pend .pend-grid{grid-template-columns:1fr}}
    #pend .pend-panel{background:rgba(255,255,255,.04);border:1px solid var(--border);
      border-radius:14px;padding:16px 18px}
    #pend .pend-panel h3{margin:0 0 2px;font-size:.8rem;font-weight:800;
      letter-spacing:.9px;color:#fff}
    #pend .pend-cap{font-size:.73rem;color:var(--text-muted);margin-bottom:11px}
    #pend .pend-vacio{color:var(--text-muted);font-size:.8rem;padding:12px 0}

    #pend table{width:100%;border-collapse:collapse;font-size:.82rem}
    #pend th{text-align:left;color:var(--text-muted);font-size:.65rem;letter-spacing:.6px;
      font-weight:700;padding:6px 8px;border-bottom:1px solid var(--border)}
    #pend th.n,#pend td.n{text-align:right;font-variant-numeric:tabular-nums}
    #pend td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.05)}
    #pend tbody tr:last-child td{border-bottom:0}
    #pend .pend-bar{height:5px;border-radius:4px;background:rgba(129,140,248,.75);
      display:block;margin-top:3px}
    #pend .pend-bar.ambar{background:rgba(245,158,11,.8)}
    #pend .pend-ojo td{color:#fde68a}
    #pend .pend-gris td{color:var(--text-muted)}
    #pend .pend-mas{font-size:.73rem;color:var(--primary);font-weight:700;
      padding-top:8px;display:block}
    #pend .pend-nota{border-left:3px solid var(--pend-amber);padding:9px 13px;
      background:rgba(245,158,11,.07);border-radius:0 8px 8px 0;margin-top:11px;
      font-size:.79rem;color:#e8edf7}
    #pend .pend-nada{text-align:center;padding:40px 20px}
    #pend .pend-nada-t{font-size:1rem;font-weight:700;color:#fff;margin-bottom:6px}
    </style>`;
}
