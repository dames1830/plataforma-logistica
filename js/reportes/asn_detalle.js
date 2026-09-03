/**
 * RECEPCIÓN → ASN DETALLE (los cuadros nuevos)
 *
 * Daniel, 03-sep-2026: *"necesito ver el mapa de lo que está llegando, pero
 * actualizado... no me das fecha, no hay ninguna fecha acá... necesito exportar...
 * en el reporte de mes a mes, el 26 del cuatro dice que falta 160 mil: necesito
 * darle clic y ver qué es lo que está faltando... los 122 parciales, necesito un
 * filtro... necesito un reporte que me diga qué artículo está llegando, qué marca
 * está llegando. Esa es la idea de tener el ASN"*.
 *
 * Hasta hoy el robot leía los seis archivos —1.557.048 líneas— y publicaba SOLO
 * totales. El detalle estaba en el origen y se tiraba.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LOS TOPES SALEN DE UNA MEDICIÓN, NO DE UNA CORAZONADA                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Son 23.533 artículos distintos y 11.307 con algo pendiente. Publicarlos todos
 * son 1.117 KB al navegador, y eso es exactamente lo que ya hizo lenta la web una
 * vez. Medido, cortando por los que más faltan:
 *
 *     los 200  ->  19 KB          los 500  ->  89 KB
 *     las 13 marcas -> 1 KB       los 50 de cada mes -> 74 KB entre los seis
 *
 * Con 500 artículos, las 13 marcas, 50 por mes y los 139 parciales enteros, el
 * paquete pesa 183 KB. Se baja UNA vez al abrir Recepción; el tablero, para
 * comparar, son 2.200 KB. Daniel lo aprobó mirando la maqueta con ese número.
 *
 * (La primera estimación decía 60 KB y estaba mal: no contaba la descripción ni
 * la marca de cada fila, que es la mitad del peso.)
 *
 * LA PANTALLA DICE SIEMPRE CUÁNTOS QUEDARON FUERA. Una tabla recortada que no
 * avisa se lee como la lista completa, y con eso se toman decisiones.
 *
 * ESTE ARCHIVO NO LEE DEL SERVIDOR. Recibe `OPC.datos` y solo dibuja.
 *
 * OPC = {
 *   datos:       el paquete del área `asn_recepcion`
 *   alExportar:  () => {}  — lo llama el botón de Excel
 * }
 */

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-04' → 'abril 2026'. El mes escrito se lee; el número hay que traducirlo. */
const mesLargo = (m) => {
    const p = String(m || '').split('-');
    return (MESES[(+p[1] || 1) - 1] || m) + ' ' + (p[0] || '');
};

/* DE CUÁNDO ES EL DATO, y si está viejo.
 *
 * El robot corre todas las madrugadas. Si el dato tiene más de 30 horas es que no
 * corrió, y eso hay que saberlo ANTES de mirar los números. */
const cuandoSeSaco = (sello) => {
    const t = String(sello || '').trim();
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return { texto: t || 'sin fecha', viejo: !t };
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const h = (Date.now() - d.getTime()) / 3600000;
    const cuando = h < 1 ? 'hace un rato'
        : h < 24 ? 'hace ' + Math.round(h) + (Math.round(h) === 1 ? ' hora' : ' horas')
        : 'hace ' + Math.round(h / 24) + (Math.round(h / 24) === 1 ? ' día' : ' días');
    return {
        texto: 'Datos del ' + (+m[3]) + ' de ' + MESES[+m[2] - 1] + ', ' + m[4] + ':' + m[5]
               + ' — ' + cuando,
        viejo: h > 30,
    };
};

const CSS = [
'#asn .a-caja { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; margin-bottom:18px; overflow:hidden; }',
'#asn .a-cab { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding:.9rem 1.2rem; border-bottom:1px solid var(--border); }',
'#asn .a-cab h3 { margin:0; font-size:var(--t-md); font-weight:800; color:var(--text-strong); }',
'#asn .a-cab .nota { font-size:var(--t-xs); color:var(--text-muted); }',
'#asn .a-cuerpo { padding:0 0 .2rem; }',
'#asn .a-scroll { overflow-x:auto; overflow-y:auto; max-height:460px; width:0; min-width:100%; }',
'#asn table { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#asn th { position:sticky; top:0; z-index:1; background:var(--panel-deep); text-align:right; padding:.55rem .8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-size:10.5px; border-bottom:2px solid var(--border); white-space:nowrap; }',
'#asn th:first-child, #asn td:first-child { text-align:left; }',
'#asn td { padding:.5rem .8rem; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb),.06); white-space:nowrap; }',
'#asn tr.a-clic { cursor:pointer; }',
'#asn tr.a-clic:hover td { background:rgba(var(--ink-rgb),.05); }',
'#asn tr.a-viva td { background:rgba(var(--brand-rgb, 99,102,241),.10); font-weight:800; }',
'#asn .a-falta { color:var(--danger); font-weight:800; }',
'#asn .a-ok { color:var(--success); font-weight:800; }',
'#asn .a-desc { color:var(--text-muted); font-size:10.5px; }',
'#asn .a-barra { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; padding:.7rem 1.2rem; border-bottom:1px solid var(--border); }',
'#asn .a-buscar { flex:1 1 220px; min-width:0; background:rgba(var(--ink-rgb),.04); border:1px solid var(--border); border-radius:8px; padding:.45rem .8rem; color:var(--text-main); font-size:var(--t-xs); font-family:inherit; }',
'#asn .a-buscar:focus { outline:none; border-color:var(--primary); }',
'#asn .a-pill { border:1px solid var(--border); background:rgba(var(--ink-rgb),.03); color:var(--text-muted); border-radius:999px; padding:.35rem .9rem; font-size:var(--t-xs); font-weight:800; cursor:pointer; font-family:inherit; }',
'#asn .a-pill.viva { background:var(--text-strong); border-color:var(--text-strong); color:var(--panel-deep); }',
'#asn .a-sello { display:inline-flex; align-items:center; gap:.5rem; padding:.35rem .85rem; border-radius:999px; font-size:var(--t-xs); font-weight:700; }',
'#asn .a-pie { padding:.7rem 1.2rem; font-size:var(--t-xs); color:var(--text-muted); border-top:1px solid var(--border); line-height:1.6; }',
'#asn .a-vacio { padding:2rem; text-align:center; color:var(--text-muted); font-size:var(--t-sm); }',
'#asn, #asn .a-caja { max-width:100%; min-width:0; }',
].join('\n');

/* Lo que se está mirando. Es de módulo para que sobreviva al redibujado. */
let _mes = null;          // el mes abierto en "mes a mes"
let _buscaArt = '';
let _buscaPar = '';
let _marca = '';
let _cont = null;
let _OPC = null;

export function montarAsnDetalle(cont, OPC) {
    if (!cont) return;
    _cont = cont;
    if (OPC) _OPC = OPC;
    const O = _OPC || {};
    const p = O.datos || {};

    if (!p.articulos && !p.marcas) {
        cont.innerHTML = '<style>' + CSS + '</style><div id="asn"><div class="a-vacio">'
            + 'Todavía no hay detalle publicado.<br>'
            + 'Lo arma el robot del ASN en la madrugada.</div></div>';
        return;
    }

    const c = cuandoSeSaco(p.generado);
    const T = [];
    T.push('<style>' + CSS + '</style><div id="asn">');

    // ─── CABECERA, con la fecha del dato bien a la vista ─────────────────────
    T.push('<div style="margin-bottom:1rem;">'
    + '<h2 style="margin:0 0 .3rem; font-size:var(--t-xl); font-weight:800; color:var(--text-strong);">'
    + 'Lo que viene y lo que llegó</h2>'
    + '<div style="display:flex; gap:.7rem; align-items:center; flex-wrap:wrap;">'
    + '<span class="a-sello" style="background:' + (c.viejo ? 'rgba(var(--warning-rgb),.12)' : 'rgba(var(--ink-rgb),.05)')
    + '; border:1px solid ' + (c.viejo ? 'rgba(var(--warning-rgb),.45)' : 'var(--border)')
    + '; color:' + (c.viejo ? 'var(--warning)' : 'var(--text-muted)') + ';">'
    + (c.viejo ? '⚠️' : '📅') + ' ' + esc(c.texto)
    + (c.viejo ? ' · el robot corre todas las madrugadas: revisa si corrió' : '') + '</span>'
    + '<button class="a-pill" onclick="window.__asnExportar()">⬇ EXPORTAR A EXCEL</button>'
    + '</div>'
    + '<div style="font-size:var(--t-xs); color:var(--text-muted); margin-top:.5rem;">'
    /* El robot lo publica dentro de `totales`, no suelto. Leyendolo suelto la
       pantalla decia "– lineas", que es justo el hueco que Daniel reclamo en el
       resto del modulo: un numero que falta se lee como un dato que no existe. */
    + nf((p.totales && p.totales.lineas) || p.lineas) + ' líneas · ' + nf(p.articulosDistintos) + ' artículos distintos · '
    + nf(p.articulosConFalta) + ' con algo pendiente</div></div>');

    // ─── MES A MES, y al hacer clic se abre el detalle ───────────────────────
    const meses = Object.keys(p.porMes || {}).sort().reverse();
    /* `sobra` es lo que llego DE MAS. Sin mostrarlo, la suma de los meses no da
       el total de arriba y no hay manera de saber por que: en abril son 26.918
       que convierten 187.691 en los 160.773 que dice el cuadro de marcas. */
    const sumar = (k) => meses.reduce((a, m) => a + (Number(p.porMes[m][k]) || 0), 0);
    const haySobra = meses.some(m => (Number(p.porMes[m].sobra) || 0) > 0);
    /* Mientras el robot no haya vuelto a correr, el paquete viejo no trae
       `faltaBruta`: sin esto salen dos columnas con el mismo numero. */
    const hayBruta = meses.some(m => p.porMes[m].faltaBruta != null);

    T.push('<div class="a-caja"><div class="a-cab"><h3>Mes a mes</h3>'
    /* POR FECHA DE CREACION, que es como agrupa el robot -un archivo por mes- y
       como ya lo decia el cuadro de arriba. El rotulo decia "por fecha de envio"
       porque asi lo habia agrupado la medicion de prueba, y dos cuadros pegados
       diciendo cosas distintas del mismo dato es peor que no ponerle rotulo. */
    + '<span class="nota">por fecha de creación · <b>haz clic en un mes</b> para ver qué falta</span></div>'
    /* LAS TRES COLUMNAS TIENEN QUE CERRAR ENTRE SI, y la fila de TOTAL esta para
       que se pueda comprobar sin sacar la calculadora:  falta = bruta - sobra.
       Daniel suma las filas; si una no cierra, cae el reporte entero. */
    + '<div class="a-scroll"><table><thead><tr>'
    + '<th>Mes</th><th>Artículos con falta</th>'
    + (hayBruta ? '<th>Falta</th>' : '')
    + (haySobra ? '<th>Recibido de más</th>' : '')
    + '<th>Pendiente</th><th></th></tr></thead><tbody>'
    + meses.map(m => {
        const x = p.porMes[m];
        const bruta = (x.faltaBruta == null) ? x.falta : x.faltaBruta;
        return '<tr class="a-clic' + (m === _mes ? ' a-viva' : '') + '" '
            + 'onclick="window.__asnMes(&quot;' + m + '&quot;)">'
            + '<td>' + esc(mesLargo(m)) + '</td>'
            + '<td>' + nf(x.articulos) + '</td>'
            + (hayBruta ? '<td>' + nf(bruta) + '</td>' : '')
            + (haySobra ? '<td class="a-ok">' + (x.sobra ? '−' + nf(x.sobra) : '–') + '</td>' : '')
            + '<td class="a-falta">' + nf(x.falta) + '</td>'
            + '<td style="color:var(--text-muted);">' + (m === _mes ? '▼ abierto' : 'ver ▸') + '</td></tr>';
    }).join('')
    + '<tr style="border-top:2px solid var(--border); font-weight:800;">'
    + '<td>Total</td><td></td>'
    + (hayBruta ? '<td>' + nf(sumar('faltaBruta')) + '</td>' : '')
    + (haySobra ? '<td class="a-ok">−' + nf(sumar('sobra')) + '</td>' : '')
    + '<td class="a-falta">' + nf(sumar('falta')) + '</td><td></td></tr>'
    + '</tbody></table></div>');

    if (_mes && p.porMes[_mes]) {
        const x = p.porMes[_mes];
        T.push('<div class="a-cab" style="border-top:1px solid var(--border);">'
        + '<h3>Qué falta en ' + esc(mesLargo(_mes)) + '</h3>'
        + '<span class="nota">' + nf(x.top.length) + ' de ' + nf(x.articulos)
        + ' artículos · los que más faltan primero</span></div>'
        + '<div class="a-scroll"><table><thead><tr>'
        + '<th>Artículo</th><th>Marca</th><th>Enviado</th><th>Recibido</th><th>Falta</th>'
        + '</tr></thead><tbody>'
        + x.top.map(a => '<tr><td>' + esc(a.cod)
            + '<br><span class="a-desc">' + esc(a.desc || '') + '</span></td>'
            + '<td style="text-align:left;">' + esc(a.marca || '') + '</td>'
            + '<td>' + nf(a.env) + '</td><td>' + nf(a.rec) + '</td>'
            + '<td class="a-falta">' + nf(a.falta) + '</td></tr>').join('')
        + '</tbody></table></div>'
        /* NO PROMETER LO QUE EL EXCEL NO LLEVA: exporta este mismo top, no los
           11.307. Decia "el Excel los trae todos" y era falso. */
        + '<div class="a-pie">'
        + (x.articulos > x.top.length
            ? 'Se muestran los <b>' + nf(x.top.length) + '</b> que más faltan; quedan <b>'
              + nf(x.articulos - x.top.length) + '</b> artículos más con falta en este mes. '
              + 'El Excel exporta estos mismos, no la lista completa. '
            : '')
        + 'Estos ' + nf(x.top.length) + ' suman <b>' + nf(x.top.reduce((a, r) => a + r.falta, 0))
        + '</b> de los ' + nf((x.faltaBruta == null) ? x.falta : x.faltaBruta) + ' que faltan en el mes'
        + ((Number(x.sobra) || 0) > 0
            ? ', y hay <b>' + nf(x.sobra) + '</b> recibidos de más en '
              + nf(x.sobraArticulos) + ' artículos, que es lo que baja el pendiente a '
              + nf(x.falta) + '.' : '.')
        + '</div>');
    }
    T.push('</div>');

    // ─── POR MARCA ───────────────────────────────────────────────────────────
    const marcas = p.marcas || [];
    T.push('<div class="a-caja"><div class="a-cab"><h3>Qué marca está llegando</h3>'
    + '<span class="nota">las ' + marcas.length + ' marcas · clic para filtrar los artículos de abajo</span></div>'
    + '<div class="a-scroll"><table><thead><tr>'
    + '<th>Marca</th><th>Enviado</th><th>Recibido</th><th>Falta</th><th>Cumple</th>'
    + '</tr></thead><tbody>'
    + marcas.map(m => {
        const bien = (m.cumple || 0) >= 95;
        return '<tr class="a-clic' + (m.marca === _marca ? ' a-viva' : '') + '" '
            + 'onclick="window.__asnMarca(&quot;' + esc(m.marca).replace(/"/g, '') + '&quot;)">'
            + '<td>' + esc(m.marca) + '</td>'
            + '<td>' + nf(m.env) + '</td><td>' + nf(m.rec) + '</td>'
            + '<td class="' + (m.falta > 0 ? 'a-falta' : '') + '">' + nf(m.falta) + '</td>'
            + '<td class="' + (bien ? 'a-ok' : 'a-falta') + '">' + n1(m.cumple) + '%</td></tr>';
    }).join('')
    + '</tbody></table></div>'
    + '<div class="a-pie">El <b>cumple</b> es cuánto de lo enviado llegó de verdad. '
    + 'Una marca por debajo del 95% tiene mercadería en el aire.</div></div>');

    // ─── LOS ARTÍCULOS, con buscador ─────────────────────────────────────────
    const arts = (p.articulos || []).filter(a => {
        if (_marca && a.marca !== _marca) return false;
        if (!_buscaArt) return true;
        const q = _buscaArt.toLowerCase();
        return (a.cod || '').toLowerCase().indexOf(q) >= 0
            || (a.desc || '').toLowerCase().indexOf(q) >= 0
            || (a.marca || '').toLowerCase().indexOf(q) >= 0;
    });
    T.push('<div class="a-caja"><div class="a-cab"><h3>Qué artículo está llegando</h3>'
    + '<span class="nota">los ' + nf((p.articulos || []).length) + ' con más pendiente, de '
    + nf(p.articulosConFalta) + '</span></div>'
    + '<div class="a-barra">'
    + '<input class="a-buscar" placeholder="Buscar por código, descripción o marca..." '
    + 'value="' + esc(_buscaArt) + '" oninput="window.__asnBuscar(&quot;art&quot;, this.value)">'
    + (_marca ? '<button class="a-pill viva" onclick="window.__asnMarca(&quot;&quot;)">'
              + esc(_marca) + ' ✕</button>' : '')
    + '<span style="font-size:var(--t-xs); color:var(--text-muted);">' + nf(arts.length) + ' a la vista</span>'
    + '</div>'
    + '<div class="a-scroll"><table><thead><tr>'
    + '<th>Artículo</th><th>Marca</th><th>Tipo</th><th>Enviado</th><th>Recibido</th><th>Falta</th>'
    + '</tr></thead><tbody>'
    + (arts.length ? arts.map(a => '<tr><td>' + esc(a.cod)
        + '<br><span class="a-desc">' + esc(a.desc || '') + '</span></td>'
        + '<td style="text-align:left;">' + esc(a.marca || '') + '</td>'
        + '<td style="text-align:left;" class="a-desc">' + esc(a.gender || '') + '</td>'
        + '<td>' + nf(a.env) + '</td><td>' + nf(a.rec) + '</td>'
        + '<td class="a-falta">' + nf(a.falta) + '</td></tr>').join('')
      : '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">'
        + 'Nada con ese texto.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="a-pie">Se publican los <b>' + nf((p.articulos || []).length) + '</b> que más '
    + 'faltan, de <b>' + nf(p.articulosConFalta) + '</b> con algo pendiente. Mandarlos todos al '
    + 'navegador serían 1.117 KB y eso es lo que ya hizo lenta la web una vez; el Excel los trae '
    + 'completos.</div></div>');

    // ─── LOS PARCIALES, con buscador ─────────────────────────────────────────
    const par = (p.parciales || []).filter(x => {
        if (!_buscaPar) return true;
        const q = _buscaPar.toLowerCase();
        return (x.asn || '').toLowerCase().indexOf(q) >= 0
            || (x.estado || '').toLowerCase().indexOf(q) >= 0
            || (x.envio || '').toLowerCase().indexOf(q) >= 0;
    });
    T.push('<div class="a-caja"><div class="a-cab"><h3>Los ASN parciales</h3>'
    + '<span class="nota">llegó algo pero no todo · son los que hay que perseguir</span></div>'
    + '<div class="a-barra">'
    + '<input class="a-buscar" placeholder="Buscar por ASN, estado o fecha..." '
    + 'value="' + esc(_buscaPar) + '" oninput="window.__asnBuscar(&quot;par&quot;, this.value)">'
    + '<span style="font-size:var(--t-xs); color:var(--text-muted);">'
    + nf(par.length) + ' de ' + nf((p.parciales || []).length) + '</span>'
    + '</div>'
    + '<div class="a-scroll"><table><thead><tr>'
    + '<th>ASN</th><th>Envío</th><th>Estado</th><th>Enviado</th><th>Recibido</th><th>Falta</th><th>Cumple</th>'
    + '</tr></thead><tbody>'
    + (par.length ? par.map(x => '<tr><td>' + esc(x.asn) + '</td>'
        + '<td style="text-align:left;">' + esc(x.envio || '') + '</td>'
        + '<td style="text-align:left;">' + esc(x.estado || '') + '</td>'
        + '<td>' + nf(x.enviado) + '</td><td>' + nf(x.recibido) + '</td>'
        + '<td class="a-falta">' + nf(x.falta) + '</td>'
        + '<td>' + n1(x.cumple) + '%</td></tr>').join('')
      : '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">'
        + 'Nada con ese texto.</td></tr>')
    + '</tbody></table></div></div>');

    T.push('</div>');
    cont.innerHTML = T.join('');

    const redibujar = () => { const y = window.scrollY; montarAsnDetalle(_cont, null); window.scrollTo(0, y); };
    window.__asnMes = (m) => { _mes = (_mes === m) ? null : m; redibujar(); };
    window.__asnMarca = (m) => { _marca = (_marca === m) ? '' : m; redibujar(); };
    window.__asnBuscar = (cual, v) => {
        if (cual === 'art') _buscaArt = v; else _buscaPar = v;
        redibujar();
        /* El cursor vuelve al buscador y al final del texto: sin esto, cada letra
           que se escribe pierde el foco y hay que volver a hacer clic. */
        const cajas = document.querySelectorAll('#asn .a-buscar');
        const caja = cajas[cual === 'art' ? 0 : 1];
        if (caja) { caja.focus(); caja.setSelectionRange(v.length, v.length); }
    };
    window.__asnExportar = () => { if (typeof O.alExportar === 'function') O.alExportar(p); };
}
