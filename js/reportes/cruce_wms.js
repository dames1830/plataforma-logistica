/**
 * PICKING → CRUCE
 *
 * Los web reports del WMS —`PRODUCCION PICKING / EMBALAJE ALDEAS X HORA acc
 * calz`— contra lo que calculan las dos pantallas de la plataforma, puestos uno
 * al lado del otro. Lo pidió Daniel el 02-sep-2026: *"en ese cruce me vas a poner
 * el cruce entre la maqueta y el web report"*.
 *
 * LA PLATAFORMA NO SE DOBLA PARA QUE DÉ IGUAL AL WMS. Donde no cuadra se muestran
 * las líneas exactas que lo causan —artículo, tienda, ubicación y hora— para ir a
 * buscarlas al WMS. Daniel: *"yo lo voy a comparar con el WMS y voy a hacer mi
 * propio tracking, a ver si de repente el web report está mal o está omitiendo
 * algo"*. Una diferencia es una pista, no un error a tapar.
 *
 * SE VE UNO A LA VEZ. Los dos reportes viven en esta misma pantalla pero NUNCA
 * apilados: arriba se elige cuál. Daniel, el mismo día: *"son 2 maquetas, ¿por qué
 * todo lo estás juntando?"*.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe `OPC.datos` —lo que publica
 * `robot/cruce_wms.py` en el área `cruce_wms`— y solo dibuja.
 *
 * TODO EL CSS VA ENCERRADO BAJO `#crz` Y LOS IDS LLEVAN PREFIJO `crz_`.
 *
 * OPC = {
 *   datos:  {picking:{...}, embalaje:{...}} o null si esa fecha no tiene nada
 *   fecha:  'AAAA-MM-DD'
 *   fechas: los días que el servidor tiene guardados
 *   alCambiarFecha: (nueva) => {}
 * }
 */

const nf = (n) => Number(n || 0).toLocaleString('es-PE');
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const LADOS = [['picking', 'Picking'], ['embalaje', 'Embalaje']];

/**
 * La fila TOTAL GENERAL de las tablas del cruce.
 *
 * SUMA LAS FILAS QUE SE VEN, no los totales que trae el robot. Daniel suma las
 * columnas con la calculadora: si el pie no da exactamente la suma de lo dibujado,
 * el cuadro entero queda en duda —aunque el pie sea el número «bueno»—. Los dos
 * coinciden hoy, pero el día que la tabla filtre una fila esto sigue cuadrando.
 */
function filaTotal(filas, rot, conTotalPlataforma) {
    const s = (f) => filas.reduce((a, x) => a + (Number(x[f]) || 0), 0);
    const wc = s('webCalz'), mc = s('maqCalz'), wa = s('webAcc'), ma = s('maqAcc');
    return `<tr class="gran">
      <td>${rot}</td>
      <td class="n">${nf(wc)}</td><td class="n">${nf(mc)}</td>
      ${celdaDif(wc, mc)}
      <td class="n">${nf(wa)}</td><td class="n">${nf(ma)}</td>
      ${celdaDif(wa, ma)}
      ${conTotalPlataforma ? `<td class="n">${nf(mc + ma)}</td>` : ''}</tr>`;
}

/** La celda de diferencia: `b` es la plataforma, `a` el WMS. */
function celdaDif(a, b) {
    const v = Math.round(b) - Math.round(a);
    if (v === 0) return '<td class="n crz-ok">—</td>';
    return `<td class="n ${v > 0 ? 'crz-mas' : 'crz-menos'}">${v > 0 ? '+' : ''}${v}</td>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   LO QUE YA SE SABE DE CADA DIFERENCIA

   Va acá y no en el robot porque son notas escritas a mano, de lo que se fue
   averiguando mirando los archivos. Si una celda no tiene nota, no se inventa
   ninguna: se muestran las líneas y ya.
   ══════════════════════════════════════════════════════════════════════════ */
const NOTAS = {
    'picking|pquispe3|11|ACC':
        'Dos movimientos de <b>500 bolsas</b> cada uno (<code>9945990-1-01</code>, '
        + 'BOLSAS BATA GRANDE) a la tienda 50109, a las <b>11:59:07</b> y '
        + '<b>11:59:23</b>, en contenedores distintos y creados por personas '
        + 'distintas. Son dos movimientos reales y separados; el web report no trae '
        + 'ninguno de los dos. <b>No los bota por categoría</b>: el <code>9005800</code> '
        + 'es del mismo <i>Non Commercial</i> y ese sí lo cuenta.',
    'picking|pquispe3|10|ACC':
        'El WMS le pone <b>62 de más</b>, que son exactamente las que la plataforma '
        + 'le pone a <b>ogarcia2</b> en esa misma hora. Es un traslado de persona, no '
        + 'una cantidad distinta.',
    'picking|ogarcia2|10|ACC':
        'Las <b>62</b> de arriba: 14 líneas de MZN04 a la tienda <b>50265</b>. El '
        + 'archivo de picking las firma <code>ogarcia2</code>; el web report se las '
        + 'acredita a <code>pquispe3</code>.',
    'embalaje|ameneses2|8|CALZ':
        'Le faltan <b>24</b>, que son las mismas que la plataforma le pone a '
        + '<b>alajara2</b> a esa hora. Otro traslado de persona.',
    'embalaje|alajara2|8|CALZ':
        'Las <b>24</b> de arriba: 18 líneas a las tiendas 50792 y 50832. El web '
        + 'report no le reconoce nada a <code>alajara2</code> en todo el día.',
    'embalaje|VLLONTOP|11|CALZ':
        '6 líneas a la tienda <b>50336</b>, todas de MZN04. El web report no le '
        + 'reconoce nada a <code>VLLONTOP</code> en todo el día.',
};
const NOTA_GENERICA = {
    1: 'Una sola unidad de diferencia sobre decenas de líneas: es el redondeo de la '
       + 'curva del prepack, no una línea perdida.',
};

/* ══════════════════════════════════════════════════════════════════════════
   EL ESTILO, todo bajo #crz
   ══════════════════════════════════════════════════════════════════════════ */

function estilos() {
    return `<style>
    #crz{display:flex;flex-direction:column;gap:14px}
    #crz .crz-top{display:flex;justify-content:space-between;align-items:flex-end;
      gap:16px;flex-wrap:wrap}
    #crz h2{font-size:var(--t-lg);font-weight:800;margin:0;color:var(--text-strong)}
    #crz .crz-sub{color:var(--text-muted);font-size:var(--t-sm);max-width:82ch;margin-top:4px}
    #crz .crz-guardados{font-size:var(--t-xs);color:var(--text-muted);margin-top:5px}
    #crz input[type=date]{background:rgba(var(--shadow-rgb),.3);border:1px solid var(--border);
      border-radius:8px;color:var(--text-strong);padding:8px 10px;font-size:var(--t-sm);
      font-weight:700;color-scheme:var(--scheme);cursor:pointer;letter-spacing:.3px}
    #crz input[type=date]:hover{border-color:var(--primary)}
    #crz input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:1;
      transform:scale(1.3);margin-left:6px;
      filter:invert(64%) sepia(38%) saturate(1400%) hue-rotate(207deg) brightness(102%)}

    /* SE VE UNO A LA VEZ: picking o embalaje, nunca los dos apilados. */
    #crz .crz-lados{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #crz .crz-lados button{font:inherit;font-size:var(--t-sm);font-weight:800;
      cursor:pointer;padding:8px 20px;border-radius:999px;border:1px solid var(--border);
      background:rgba(var(--ink-rgb),.04);color:var(--text-muted);letter-spacing:.3px}
    #crz .crz-lados button[aria-pressed="true"]{background:rgba(var(--brand-rgb),.14);
      border-color:var(--primary);color:var(--primary)}

    #crz .crz-pan{background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);
      border-radius:14px;overflow:hidden}
    #crz .crz-cab{padding:13px 16px;border-bottom:1px solid var(--border)}
    #crz .crz-cab h3{margin:0;font-size:var(--t-sm);font-weight:800;letter-spacing:.9px;
      color:var(--text-strong);text-transform:uppercase}
    #crz .crz-cab p{color:var(--text-muted);font-size:var(--t-xs);margin:4px 0 0;
      line-height:1.6}
    #crz .crz-cuerpo{padding:16px}
    #crz .crz-sc{overflow-x:auto;border:1px solid var(--border);border-radius:10px}

    #crz .crz-marc{display:grid;gap:12px;margin-bottom:16px;
      grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
    #crz .crz-mar{background:rgba(var(--ink-rgb),.05);border:1px solid var(--border);
      border-radius:12px;padding:12px 14px;display:flex;flex-wrap:wrap;
      align-items:flex-end;gap:14px}
    #crz .crz-mar .rot{flex:0 0 100%;font-size:var(--t-xs);font-weight:800;
      letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
    #crz .crz-par{display:flex;flex-direction:column}
    #crz .crz-par b{font-size:var(--t-lg);font-variant-numeric:tabular-nums;
      line-height:1.1;color:var(--text-strong)}
    #crz .crz-par span{font-size:10.5px;color:var(--text-muted);text-transform:uppercase;
      letter-spacing:.06em}
    #crz .crz-dd{margin-left:auto;font-size:var(--t-md);font-weight:800;
      font-variant-numeric:tabular-nums}
    #crz .crz-pct{flex:0 0 100%;font-size:var(--t-xs);color:var(--text-muted)}
    #crz .crz-mas{color:var(--danger,#e8776a)}
    #crz .crz-menos{color:var(--brand-light,#b78be6)}
    #crz .crz-ok{color:var(--text-muted);opacity:.5}

    #crz h4{margin:18px 0 8px;font-size:var(--t-xs);font-weight:800;
      text-transform:uppercase;letter-spacing:.07em;color:var(--text-main)}
    #crz h4 .sut{text-transform:none;letter-spacing:0;font-weight:400;
      color:var(--text-muted);margin-left:8px}
    #crz table{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
    #crz th,#crz td{padding:6px 11px;text-align:left;white-space:nowrap}
    #crz th.n,#crz td.n{text-align:right;font-variant-numeric:tabular-nums}
    #crz thead th{background:rgba(var(--ink-rgb),.07);color:var(--text-muted);
      font-size:var(--t-xs);font-weight:800;text-transform:uppercase;letter-spacing:.05em;
      border-bottom:1px solid var(--border)}
    #crz tbody tr{border-bottom:1px solid rgba(var(--ink-rgb),.05)}
    #crz tbody tr:last-child{border-bottom:0}
    #crz tbody tr.ojo{box-shadow:inset 3px 0 0 var(--warning)}
    #crz td.h{font-variant-numeric:tabular-nums;color:var(--text-muted)}
    #crz td.tot{font-weight:800;color:var(--text-strong)}
    #crz tbody tr.gran td{background:rgba(var(--ink-rgb),.07);font-weight:800;
      color:var(--text-strong);border-top:2px solid var(--border)}
    #crz td.de{color:var(--text-muted);font-size:var(--t-xs)}
    #crz code{font-family:ui-monospace,Consolas,monospace;font-size:var(--t-xs);
      background:rgba(var(--ink-rgb),.09);padding:1px 5px;border-radius:4px}

    /* ── una celda que no cuadra, con sus líneas adentro ── */
    #crz .crz-cel{border:1px solid var(--border);border-radius:10px;margin-bottom:8px;
      background:rgba(var(--ink-rgb),.05)}
    #crz .crz-cel.neg{border-left:3px solid var(--brand-light,#b78be6)}
    #crz .crz-cel.pos{border-left:3px solid var(--danger,#e8776a)}
    #crz .crz-cel summary{cursor:pointer;padding:10px 14px;display:flex;
      align-items:center;gap:12px;flex-wrap:wrap;list-style:none}
    #crz .crz-cel summary::-webkit-details-marker{display:none}
    #crz .crz-cel summary::before{content:'';width:6px;height:6px;flex:none;
      border-right:1.6px solid var(--text-muted);border-bottom:1.6px solid var(--text-muted);
      transform:rotate(-45deg);transition:transform .15s}
    #crz .crz-cel[open] summary::before{transform:rotate(45deg)}
    #crz .crz-qui{font-weight:800;min-width:118px;color:var(--text-strong)}
    #crz .crz-cua{font-variant-numeric:tabular-nums;color:var(--text-muted);min-width:52px}
    #crz .crz-tag{font-size:10px;font-weight:800;letter-spacing:.05em;
      text-transform:uppercase;padding:2px 7px;border-radius:5px;
      border:1px solid var(--border);color:var(--text-muted)}
    #crz .crz-vs{color:var(--text-muted);font-size:var(--t-xs)}
    #crz .crz-vs b{color:var(--text-strong);font-variant-numeric:tabular-nums}
    #crz .crz-cel .d{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums}
    #crz .crz-det{padding:0 14px 14px;border-top:1px solid var(--border)}
    #crz .crz-pista{background:rgba(var(--warning-rgb),.07);border:1px solid var(--border);
      border-left:3px solid var(--warning);border-radius:0 8px 8px 0;padding:9px 12px;
      margin:12px 0;font-size:var(--t-xs);color:var(--text-main);
      white-space:normal;line-height:1.65}
    #crz .crz-resto{font-size:var(--t-xs);color:var(--text-muted);margin:7px 0 0}
    #crz .crz-nota{background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);
      border-radius:12px;padding:12px 15px;font-size:var(--t-sm);color:var(--text-main);
      line-height:1.7}
    #crz ol{margin:8px 0 0;padding-left:22px;font-size:var(--t-sm);
      color:var(--text-main);line-height:1.7}
    #crz ol li{margin-bottom:8px}
    #crz .crz-nada{text-align:center;padding:44px 20px;color:var(--text-muted)}
    #crz .crz-nada-t{font-size:var(--t-lg);font-weight:800;color:var(--text-strong);
      margin-bottom:6px}
    </style>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   EL DIBUJO
   ══════════════════════════════════════════════════════════════════════════ */

/** Las tres tablas de un lado: totales, hora por hora y persona por persona. */
function cuadro(C) {
    const T = C.totales || {};
    const wt = (T.webCalz || 0) + (T.webAcc || 0);
    const mt = (T.maqCalz || 0) + (T.maqAcc || 0);
    const vivos = (C.porPersona || []).filter(p =>
        p.webCalz + p.maqCalz + p.webAcc + p.maqAcc);
    const ok = vivos.filter(p => !(p.celdas || []).length).length;
    const pct = (100 - 100 * Math.abs(mt - wt) / (wt || 1)).toFixed(2).replace('.', ',');
    const signo = (v) => v > 0 ? 'crz-mas' : v < 0 ? 'crz-menos' : 'crz-ok';
    const mar = (rot, w, m, extra) => `
      <div class="crz-mar"><span class="rot">${rot}</span>
        <div class="crz-par"><b>${nf(w)}</b><span>WMS</span></div>
        <div class="crz-par"><b>${nf(m)}</b><span>plataforma</span></div>
        <div class="crz-dd ${signo(m - w)}">${m - w > 0 ? '+' : ''}${m - w}</div>
        ${extra || ''}</div>`;

    return `
      <div class="crz-marc">
        ${mar('Calzado', T.webCalz, T.maqCalz)}
        ${mar('No calzado', T.webAcc, T.maqAcc)}
        ${mar('Total', wt, mt, `<div class="crz-pct">${pct}% de coincidencia</div>`)}
      </div>

      <h4>Hora por hora</h4>
      <div class="crz-sc"><table>
        <thead><tr><th>Hora</th>
          <th class="n">WMS calz.</th><th class="n">Plataforma calz.</th><th class="n">Dif.</th>
          <th class="n">WMS no calz.</th><th class="n">Plataforma no calz.</th><th class="n">Dif.</th>
        </tr></thead><tbody>
        ${(C.porHora || []).map(h => `<tr>
          <td class="h">${String(h.hora).padStart(2, '0')}:00</td>
          <td class="n">${nf(h.webCalz)}</td><td class="n">${nf(h.maqCalz)}</td>
          ${celdaDif(h.webCalz, h.maqCalz)}
          <td class="n">${nf(h.webAcc)}</td><td class="n">${nf(h.maqAcc)}</td>
          ${celdaDif(h.webAcc, h.maqAcc)}</tr>`).join('')}
        ${filaTotal(C.porHora || [], 'TOTAL GENERAL', false)}
        </tbody></table></div>

      <h4>Persona por persona
        <span class="sut">${ok} de ${vivos.length} cuadran exacto</span></h4>
      <div class="crz-sc"><table>
        <thead><tr><th>Persona</th>
          <th class="n">WMS calz.</th><th class="n">Plataforma calz.</th><th class="n">Dif.</th>
          <th class="n">WMS no calz.</th><th class="n">Plataforma no calz.</th><th class="n">Dif.</th>
          <th class="n">Total plataforma</th>
        </tr></thead><tbody>
        ${vivos.map(p => `<tr${(p.celdas || []).length ? ' class="ojo"' : ''}>
          <td class="tot">${esc(p.usuario)}</td>
          <td class="n">${nf(p.webCalz)}</td><td class="n">${nf(p.maqCalz)}</td>
          ${celdaDif(p.webCalz, p.maqCalz)}
          <td class="n">${nf(p.webAcc)}</td><td class="n">${nf(p.maqAcc)}</td>
          ${celdaDif(p.webAcc, p.maqAcc)}
          <td class="n tot">${nf(p.maqCalz + p.maqAcc)}</td></tr>`).join('')}
        ${filaTotal(vivos, 'TOTAL GENERAL', true)}
        </tbody></table></div>`;
}

/** Las celdas que no cuadran, cada una con las líneas que la causan. */
function celdas(lado, detalle) {
    const lista = detalle || [];
    if (!lista.length) {
        return `<h4>Las celdas que no cuadran</h4>
          <div class="crz-nota">Todas las celdas persona × hora cuadran con el web
            report del WMS. No hay nada que rastrear.</div>`;
    }
    return `<h4>Las ${lista.length} celdas que no cuadran
        <span class="sut">ábrelas para ver las líneas</span></h4>`
      + lista.map(c => {
        const nota = NOTAS[`${lado}|${c.usuario}|${c.hora}|${c.tipo}`]
            || NOTA_GENERICA[Math.abs(c.dif)] || '';
        const filas = (c.lineas || []).map(l => `<tr>
            <td><code>${esc(l.sku)}</code></td>
            <td class="de">${esc(l.desc) || '—'}</td>
            <td>${esc(l.destino)}</td>
            <td class="de">${esc(l.ubi)}</td>
            <td class="n">${nf(l.cant)}</td>
            <td class="n">${nf(l.pares)}</td>
            <td class="de">${esc(l.hora)}</td></tr>`).join('');
        const resto = (c.lineasTotal || 0) > (c.lineas || []).length
            ? `<p class="crz-resto">…y ${c.lineasTotal - c.lineas.length} líneas más
               de esa misma celda.</p>` : '';
        return `<details class="crz-cel ${c.dif < 0 ? 'neg' : 'pos'}"><summary>
            <span class="crz-qui">${esc(c.usuario)}</span>
            <span class="crz-cua">${String(c.hora).padStart(2, '0')}:00</span>
            <span class="crz-tag">${c.tipo === 'CALZ' ? 'Calzado' : 'No calzado'}</span>
            <span class="crz-vs">WMS <b>${nf(c.web)}</b> &nbsp;·&nbsp;
              plataforma <b>${nf(c.maq)}</b></span>
            <span class="d ${c.dif > 0 ? 'crz-mas' : 'crz-menos'}">${
              c.dif > 0 ? '+' : ''}${c.dif}</span></summary>
          <div class="crz-det">
            ${nota ? `<p class="crz-pista">${nota}</p>` : ''}
            <div class="crz-sc"><table>
              <thead><tr><th>Artículo</th><th>Descripción</th><th>Tienda</th>
                <th>Ubicación</th><th class="n">Cant.</th><th class="n">Pares</th>
                <th>Hora</th></tr></thead>
              <tbody>${filas || `<tr><td colspan="7" class="de">El WMS cuenta más que
                la plataforma: no hay líneas nuestras que mostrar. Mirá la celda de la
                otra persona en esa misma hora.</td></tr>`}</tbody></table></div>
            ${resto}
          </div></details>`;
    }).join('');
}

export function montarCruce(cont, OPC) {
    if (!cont) return;
    const O = OPC || {};
    const D = O.datos || null;
    let lado = O.lado || 'picking';

    const guardados = (O.fechas || []).length
        ? `El servidor tiene ${O.fechas.length} día${O.fechas.length === 1 ? '' : 's'} guardado${O.fechas.length === 1 ? '' : 's'}.`
        : '';

    const cabecera = `
      <div class="crz-top">
        <div>
          <h2>Cruce contra el WMS</h2>
          <p class="crz-sub">Los web reports <i>PRODUCCION PICKING / EMBALAJE ALDEAS
            X HORA acc calz</i> contra lo que calcula la plataforma. <b>La plataforma
            no se dobla para que dé igual</b>: donde no cuadra, están las líneas
            exactas que lo causan, para ir a buscarlas al WMS.</p>
          ${guardados ? `<div class="crz-guardados">${esc(guardados)}</div>` : ''}
        </div>
        <input type="date" id="crz_fecha" value="${esc(O.fecha || '')}"
               ${(O.fechas || []).length ? `min="${esc(O.fechas[0])}" max="${esc(O.fechas[O.fechas.length - 1])}"` : ''}>
      </div>`;

    const pintar = () => {
        const C = D && D[lado];
        const botones = `<div class="crz-lados" id="crz_lados">
            ${LADOS.map(([k, lab]) => `<button data-lado="${k}"
              aria-pressed="${String(k === lado)}">${lab}</button>`).join('')}
          </div>`;

        if (!C) {
            cont.innerHTML = estilos() + `<div id="crz">${cabecera}${botones}
              <div class="crz-pan"><div class="crz-nada">
                <div class="crz-nada-t">No hay cruce guardado de ese día</div>
                <p style="max-width:62ch;margin:0 auto;line-height:1.7;">
                  El cruce lo publica el robot del servidor: baja los dos web reports
                  del WMS y los compara contra lo que calcula la plataforma. Si ese día
                  no tiene cruce, todavía no corrió.</p>
              </div></div></div>`;
        } else {
            cont.innerHTML = estilos() + `<div id="crz">
              ${cabecera}
              ${botones}
              <div class="crz-nota">
                <b>Cómo leerlo.</b> El reporte del WMS se llama <b>ALDEAS</b>: mira solo
                las tiendas, así que la plataforma se compara filtrada en
                <b>canal RETAIL</b>. Los dos lados están en <b>pares</b>, con el prepack
                ya convertido —la columna <i>Cantidad convertida</i> del WMS hace lo
                mismo—. <b>Dif. = plataforma − WMS.</b>
              </div>
              <div class="crz-pan">
                <div class="crz-cab"><h3>${esc(C.nombre || lado)}</h3>
                  <p>WMS: <i>${esc(C.titulo || '')}</i> &nbsp;·&nbsp;
                     plataforma: <code>${esc(C.archivoMaq || '')}</code>, canal RETAIL
                     &nbsp;·&nbsp; la persona es <b>${esc(C.columnaUsuario || '')}</b></p></div>
                <div class="crz-cuerpo">
                  ${cuadro(C)}
                  ${celdas(lado, (D.detalle || {})[lado])}
                </div>
              </div>
            </div>`;
        }

        const caja = cont.querySelector('#crz_lados');
        if (caja) caja.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            lado = b.dataset.lado;
            pintar();
        });
        const f = cont.querySelector('#crz_fecha');
        if (f) f.addEventListener('change', () => {
            if (typeof O.alCambiarFecha === 'function') O.alCambiarFecha(f.value, lado);
        });
    };

    pintar();
}
