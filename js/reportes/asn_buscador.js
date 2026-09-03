/**
 * RECEPCIÓN → BUSCAR EN LOS SEIS MESES DEL ASN
 *
 * Daniel, 03-sep-2026: *"cuando me digan 'va a llegar el expediente tal', yo tomo
 * ese expediente, lo pongo en la web como filtro y me sale qué es lo que tiene,
 * qué es lo que contiene"*. Y después: *"no quiero ponerle una curita a la herida,
 * quiero curar toda la herida: que yo pueda tener acceso a los seis meses"*.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ ESTE CUADRO NO FILTRA LO QUE YA SE BAJÓ: LE PREGUNTA AL SERVIDOR         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Todo el resto de la plataforma se baja un paquete entero y filtra en el
 * navegador; por eso todo viene recortado. Acá no: el servidor tiene los seis
 * meses en una tabla —76.658 filas, 22 MB— y devuelve **solo lo que coincide**.
 * Por eso se puede buscar un expediente de hace cinco meses sin bajarse nada.
 *
 * Escribir `2026-178` y escribir `2026000178` dan lo mismo: el correo de
 * comercial usa una forma y el WMS la otra, y el servidor traduce.
 *
 * OPC = {
 *   api:   la base del servidor (la misma que usa el resto)
 *   sello: (opcional) función que agrega la cabecera del entorno
 * }
 */

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const CSS = [
'#bus .b-caja { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; overflow:hidden; }',
'#bus .b-cab { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding:.9rem 1.2rem; border-bottom:1px solid var(--border); }',
'#bus .b-cab h3 { margin:0; font-size:var(--t-md); font-weight:800; color:var(--text-strong); }',
'#bus .b-cab .nota { font-size:var(--t-xs); color:var(--text-muted); }',
'#bus .b-barra { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; padding:.8rem 1.2rem; border-bottom:1px solid var(--border); }',
'#bus .b-buscar { flex:1 1 260px; min-width:0; background:rgba(var(--ink-rgb),.04); border:1px solid var(--border); border-radius:8px; padding:.55rem .9rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit; }',
'#bus .b-buscar:focus { outline:none; border-color:var(--primary); }',
'#bus .b-pill { border:1px solid var(--border); background:rgba(var(--ink-rgb),.03); color:var(--text-muted); border-radius:999px; padding:.4rem .9rem; font-size:var(--t-xs); font-weight:800; cursor:pointer; font-family:inherit; white-space:nowrap; }',
'#bus .b-pill.viva { background:var(--text-strong); border-color:var(--text-strong); color:var(--panel-deep); }',
'#bus .b-scroll { overflow-x:auto; overflow-y:auto; max-height:480px; width:0; min-width:100%; }',
'#bus table { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#bus th { position:sticky; top:0; z-index:1; background:var(--panel-deep); text-align:right; padding:.55rem .8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-size:10.5px; border-bottom:2px solid var(--border); white-space:nowrap; }',
'#bus th:first-child, #bus td:first-child { text-align:left; }',
'#bus td { padding:.5rem .8rem; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb),.06); white-space:nowrap; }',
'#bus td, #bus th { width:1%; }',
'#bus td:first-child, #bus th:first-child { width:auto; white-space:normal; }',
'#bus .b-desc { color:var(--text-muted); font-size:10.5px; }',
'#bus .b-falta { color:var(--danger); font-weight:800; }',
'#bus .b-ok { color:var(--success); font-weight:800; }',
'#bus .b-tarjetas { display:flex; gap:.9rem; flex-wrap:wrap; padding:.9rem 1.2rem; border-bottom:1px solid var(--border); }',
'#bus .b-t { min-width:120px; }',
'#bus .b-t .et { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); font-weight:800; }',
'#bus .b-t .n { font-size:1.25rem; font-weight:800; color:var(--text-strong); font-variant-numeric:tabular-nums; }',
'#bus .b-pie { padding:.7rem 1.2rem; font-size:var(--t-xs); color:var(--text-muted); border-top:1px solid var(--border); line-height:1.6; }',
'#bus .b-vacio { padding:2.2rem; text-align:center; color:var(--text-muted); font-size:var(--t-sm); }',
].join('\n');

let _OPC = null;
let _cont = null;
let _texto = '';
let _agrupar = '';        // '' = detalle
let _soloPend = false;
let _ultimo = null;
let _cargando = false;
let _reloj = null;

const AGRUPACIONES = [
    ['', 'Detalle'],
    ['expediente', 'Por expediente'],
    ['asn', 'Por ASN'],
    ['articulo', 'Por artículo'],
    ['orden', 'Por orden de compra'],
    ['tipo', 'Por tipo'],
    ['marca', 'Por marca'],
];

const NOMBRE_TIPO = {
    importacion: 'Importación', nacional: 'Nacional', inversa: 'Logística inversa',
    devolucion: 'Devolución', reingreso: 'Reingreso', traslado: 'Traslado',
    materiales: 'Materiales', sin_clasificar: 'Sin clasificar',
};

/** La consulta al servidor. Devuelve el objeto tal cual, o un error legible. */
const preguntar = async () => {
    const O = _OPC || {};
    const p = new URLSearchParams();
    if (_texto) p.set('q', _texto);
    if (_agrupar) p.set('agrupar', _agrupar);
    if (_soloPend) p.set('pendiente', '1');
    p.set('limite', _agrupar ? '300' : '300');
    const url = (O.api || '') + '/api/asn?' + p.toString();
    const r = await fetch(url, O.cabeceras ? { headers: O.cabeceras } : undefined);
    if (!r.ok) throw new Error('el servidor respondió ' + r.status);
    const j = await r.json();
    if (j.status !== 'ok') throw new Error(j.message || 'no se pudo consultar');
    return j;
};

const pintar = () => {
    const caja = _cont.querySelector('#bus_resultado');
    if (!caja) return;

    if (_cargando) {
        caja.innerHTML = '<div class="b-vacio">Buscando en los seis meses…</div>';
        return;
    }
    if (!_ultimo) {
        caja.innerHTML = '<div class="b-vacio">Escribe un expediente, un ASN, '
            + 'un artículo o una orden de compra.<br>'
            + '<span style="font-size:var(--t-xs);">Del correo de comercial sirve tal cual: '
            + '<b>2026-178</b>.</span></div>';
        return;
    }
    if (_ultimo.error) {
        caja.innerHTML = '<div class="b-vacio" style="color:var(--danger);">'
            + esc(_ultimo.error) + '</div>';
        return;
    }

    const t = _ultimo.total || {};
    const T = [];
    T.push('<div class="b-tarjetas">'
        + '<div class="b-t"><div class="et">Filas</div><div class="n">' + nf(t.filas) + '</div></div>'
        + '<div class="b-t"><div class="et">ASN</div><div class="n">' + nf(t.asn) + '</div></div>'
        + '<div class="b-t"><div class="et">Expedientes</div><div class="n">' + nf(t.expedientes) + '</div></div>'
        + '<div class="b-t"><div class="et">Enviado</div><div class="n">' + nf(t.enviado) + '</div></div>'
        + '<div class="b-t"><div class="et">Recibido</div><div class="n">' + nf(t.recibido) + '</div></div>'
        + '<div class="b-t"><div class="et">Pendiente</div><div class="n b-falta">'
        + nf((t.enviado || 0) - (t.recibido || 0)) + '</div></div>'
        + '</div>');

    if (!t.filas) {
        T.push('<div class="b-vacio">No hay nada con eso en los seis meses.</div>');
        caja.innerHTML = T.join('');
        return;
    }

    if (_ultimo.agrupado) {
        const g = _ultimo.grupos || [];
        const eti = (AGRUPACIONES.find(x => x[0] === _ultimo.agrupado) || ['', ''])[1];
        T.push('<div class="b-scroll"><table><thead><tr>'
        + '<th>' + esc(eti.replace('Por ', '')) + '</th><th>ASN</th><th>Filas</th>'
        + '<th>Enviado</th><th>Recibido</th><th>Falta</th><th>Desde</th><th>Hasta</th>'
        + '</tr></thead><tbody>'
        + g.map(x => '<tr><td>'
            + esc(_ultimo.agrupado === 'tipo' ? (NOMBRE_TIPO[x.clave] || x.clave)
                                              : (x.clave || '(sin dato)'))
            + '</td><td>' + nf(x.asn) + '</td><td>' + nf(x.filas) + '</td>'
            + '<td>' + nf(x.enviado) + '</td><td>' + nf(x.recibido) + '</td>'
            + '<td class="' + (x.falta > 0 ? 'b-falta' : 'b-ok') + '">' + nf(x.falta) + '</td>'
            + '<td>' + esc(x.desde || '') + '</td><td>' + esc(x.hasta || '') + '</td></tr>').join('')
        + '</tbody></table></div>');
        if (g.length >= 300) {
            T.push('<div class="b-pie">Se muestran los 300 grupos con más pendiente. '
                + 'Afina la búsqueda para verlos todos.</div>');
        }
    } else {
        const d = _ultimo.datos || [];
        T.push('<div class="b-scroll"><table><thead><tr>'
        + '<th>Artículo</th><th style="text-align:left;">ASN</th>'
        + '<th style="text-align:left;">Expediente</th><th style="text-align:left;">Orden</th>'
        + '<th style="text-align:left;">Tipo</th><th style="text-align:left;">Estado</th>'
        + '<th>Envío</th><th>Recepción</th><th>Enviado</th><th>Recibido</th><th>Falta</th>'
        + '</tr></thead><tbody>'
        + d.map(x => '<tr><td>' + esc(x.articulo)
            + (x.descripcion ? '<br><span class="b-desc">' + esc(x.descripcion) + '</span>' : '')
            + '</td><td style="text-align:left;">' + esc(x.asn) + '</td>'
            + '<td style="text-align:left;">' + esc(x.expediente || '') + '</td>'
            + '<td style="text-align:left;">' + esc(x.orden || '') + '</td>'
            + '<td style="text-align:left;">' + esc(NOMBRE_TIPO[x.tipo] || x.tipo || '') + '</td>'
            + '<td style="text-align:left;">' + esc(x.estado || '') + '</td>'
            + '<td>' + esc(x.fecha_envio || '') + '</td>'
            + '<td>' + esc(x.fecha_recepcion || '–') + '</td>'
            + '<td>' + nf(x.enviado) + '</td><td>' + nf(x.recibido) + '</td>'
            + '<td class="' + (x.enviado - x.recibido > 0 ? 'b-falta' : 'b-ok') + '">'
            + nf(x.enviado - x.recibido) + '</td></tr>').join('')
        + '</tbody></table></div>');
        /* SE DICE SIEMPRE CUÁNTO QUEDÓ FUERA. Una tabla recortada que no avisa se
           lee como la lista completa, y con eso se toman decisiones. */
        if (t.filas > d.length) {
            T.push('<div class="b-pie">Se muestran <b>' + nf(d.length) + '</b> de <b>'
                + nf(t.filas) + '</b> filas. Los totales de arriba sí son de todas. '
                + 'Agrupa por expediente o por artículo para verlo entero.</div>');
        }
    }
    caja.innerHTML = T.join('');
};

const buscar = async () => {
    if (!_texto && !_agrupar && !_soloPend) { _ultimo = null; pintar(); return; }
    _cargando = true;
    pintar();
    try {
        _ultimo = await preguntar();
    } catch (e) {
        _ultimo = { error: 'No se pudo consultar: ' + (e && e.message || e) };
    }
    _cargando = false;
    pintar();
};

export function montarBuscadorAsn(cont, OPC) {
    if (!cont) return;
    _cont = cont;
    if (OPC) _OPC = OPC;

    cont.innerHTML = '<style>' + CSS + '</style><div id="bus"><div class="b-caja">'
    + '<div class="b-cab"><h3>Buscar en los seis meses</h3>'
    + '<span class="nota">le pregunta al servidor · no baja el historial</span></div>'
    + '<div class="b-barra">'
    + '<input class="b-buscar" id="bus_q" placeholder="Expediente, ASN, artículo u orden de compra…  (del correo sirve tal cual: 2026-178)">'
    + AGRUPACIONES.map(a => '<button class="b-pill' + (a[0] === _agrupar ? ' viva' : '') + '" '
        + 'data-agrupar="' + a[0] + '">' + a[1] + '</button>').join('')
    + '<button class="b-pill' + (_soloPend ? ' viva' : '') + '" id="bus_pend">Solo pendiente</button>'
    + '</div><div id="bus_resultado"></div></div></div>';

    const caja = cont.querySelector('#bus_q');
    if (caja) {
        caja.value = _texto;
        /* MEDIO SEGUNDO DE ESPERA. Sin esto sale una consulta por tecla y el
           servidor recibe ocho seguidas para escribir "2026-178". */
        caja.addEventListener('input', () => {
            _texto = caja.value.trim();
            clearTimeout(_reloj);
            _reloj = setTimeout(buscar, 500);
        });
        caja.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { clearTimeout(_reloj); buscar(); }
        });
    }
    cont.querySelectorAll('[data-agrupar]').forEach(b => {
        b.onclick = () => { _agrupar = b.getAttribute('data-agrupar'); montarBuscadorAsn(_cont); buscar(); };
    });
    const bp = cont.querySelector('#bus_pend');
    if (bp) bp.onclick = () => { _soloPend = !_soloPend; montarBuscadorAsn(_cont); buscar(); };

    pintar();
}
