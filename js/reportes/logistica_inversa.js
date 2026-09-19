/* LOGÍSTICA INVERSA — lo que las tiendas devuelven al CD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Módulo principal propio (Daniel, 19-sep-2026: "crea un módulo principal llamado Logística inversa y ahí
 * pones todo lo que hemos creado"). Es la maqueta del 19-sep llevada a la plataforma, pestaña por pestaña:
 *
 *   li_vuelve       Lo que vuelve: las guías T del ASN, por mes, qué vuelve, antigüedad, quién recibe,
 *                   por tienda y las guías con discrepancia.
 *   li_retorno      Despachado y devuelto: de lo despachado a cada tienda desde mayo, cuánto retornó,
 *                   en qué mes ingresó, y el detalle de un modelo en un modal.
 *   li_doble_tramo  Doble tramo: las guías T del correo de comercial con prioridad DOBLE TRAMO.
 *   li_produccion   Producción L.I: lo que recepción ingresa de logística inversa, por hora y persona.
 *
 * LOS DATOS LOS ARMA EL ROBOT `robot/logistica_inversa.py`, detrás del ASN, y cada pestaña baja SOLO su área
 * al abrirse (el detalle del modal, lo más pesado, recién al abrir el primer modal). Las reglas de cada
 * número están en el robot; acá solo se dibuja.
 *
 * LOS COLORES PASAN LOS CUATRO TEMAS (auditoría del 19-sep: 4,5:1 en letra, 3:1 en flechas y barritas, cero
 * fallas). El principal NO se usa como letra —en Índigo es morado oscuro sobre fondo oscuro—: la letra de
 * acento va en --li-acento, el semáforo en su versión legible, y en los temas claros los paneles son blancos.
 */

const API = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
const MEMORIA_MS = 5 * 60 * 1000;
const _datos = new Map();

const ESTILOS = `
/* EL MODAL VIVE FUERA DE #li, colgado del <body>: dentro del tablero, el .glass-panel (con desenfoque en Índigo)
   y el #app (con transform) encierran a un position:fixed en su caja. Por eso las reglas valen para los dos. */
#li,#lr_modal{--li-sup:rgba(var(--ink-rgb),.04);--li-acento:var(--brand-pale);--li-ok:var(--success-soft);
  --li-mal:var(--danger-soft);--li-ojo:var(--warning-soft);--li-tenue:var(--text-muted)}
html[data-tema="negro"] #li,html[data-tema="negro"] #lr_modal{--li-acento:var(--primary);--li-tenue:var(--text-grey2)}
html[data-tema="pbi-classic"] #li,html[data-tema="pbi-classic"] #lr_modal{--li-tenue:var(--text-grey)}
html[data-tema="pbi"] #li,html[data-tema="pbi-classic"] #li,html[data-tema="pbi"] #lr_modal,html[data-tema="pbi-classic"] #lr_modal{
  --li-sup:var(--panel-solid);--li-acento:var(--primary-hover);--li-ok:var(--success-deep);--li-mal:var(--danger-deep);
  --li-ojo:var(--yellow-deep)}
#li{display:flex;flex-direction:column;gap:14px}
:is(#li,#lr_modal) .li-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
:is(#li,#lr_modal) .li-sub{color:var(--li-tenue);font-size:var(--t-sm);max-width:90ch;margin:4px 0 0;line-height:1.6}
:is(#li,#lr_modal) .li-sub b{color:var(--text-strong)}
:is(#li,#lr_modal) select,:is(#li,#lr_modal) input[type=search]{background:rgba(var(--shadow-rgb),.3);border:1px solid var(--border);
  border-radius:9px;color:var(--text-strong);padding:8px 12px;font:inherit;font-size:var(--t-sm);font-weight:700;
  color-scheme:var(--scheme)}
:is(#li,#lr_modal) select:hover,:is(#li,#lr_modal) input[type=search]:focus{border-color:var(--primary);outline:none}
:is(#li,#lr_modal) input[type=search]{min-width:240px;font-weight:600}
:is(#li,#lr_modal) .li-selec{display:flex;gap:7px;flex-wrap:wrap;align-items:center;padding:11px 16px;
  background:var(--li-sup);border:1px solid var(--border);border-radius:12px}
:is(#li,#lr_modal) .li-rot{font-size:var(--t-xs);font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:var(--li-tenue);margin-right:2px}
:is(#li,#lr_modal) .li-selec button{font:inherit;font-size:var(--t-xs);font-weight:700;cursor:pointer;padding:5px 13px;
  border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--li-tenue)}
:is(#li,#lr_modal) .li-selec button[aria-pressed="true"]{background:rgba(var(--brand-rgb),.14);border-color:var(--primary);
  color:var(--li-acento)}
:is(#li,#lr_modal) .li-selec .div{width:1px;align-self:stretch;background:var(--border);margin:0 6px}
:is(#li,#lr_modal) .li-selec .der{margin-left:auto}
:is(#li,#lr_modal) .li-tarj{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
:is(#li,#lr_modal) .li-t{background:var(--li-sup);border:1px solid var(--border);border-top:3px solid var(--primary);
  border-radius:12px;padding:12px 15px}
:is(#li,#lr_modal) .li-t.ok{border-top-color:var(--success)}
:is(#li,#lr_modal) .li-t.oj{border-top-color:var(--warning)}
:is(#li,#lr_modal) .li-t.ma{border-top-color:var(--danger)}
:is(#li,#lr_modal) .li-t.gr{border-top-color:var(--li-tenue)}
:is(#li,#lr_modal) .li-t .e{font-size:var(--t-xs);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--li-tenue)}
:is(#li,#lr_modal) .li-t .v{font-size:var(--t-xl);font-weight:800;line-height:1.15;color:var(--text-strong);font-variant-numeric:tabular-nums}
:is(#li,#lr_modal) .li-t .d{font-size:var(--t-xs);color:var(--li-tenue)}
:is(#li,#lr_modal) .li-pan{background:var(--li-sup);border:1px solid var(--border);border-radius:14px;overflow:hidden}
:is(#li,#lr_modal) .li-cab{padding:13px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;
  align-items:center;gap:10px}
:is(#li,#lr_modal) .li-cab h3{margin:0;font-size:var(--t-sm);font-weight:800;letter-spacing:.9px;color:var(--text-strong);
  text-transform:uppercase}
:is(#li,#lr_modal) .li-cab p{color:var(--li-tenue);font-size:var(--t-xs);margin:0}
:is(#li,#lr_modal) .li-sc{overflow-x:auto}
:is(#li,#lr_modal) .li-alto{max-height:640px;overflow:auto}
:is(#li,#lr_modal) table{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
:is(#li,#lr_modal) th,:is(#li,#lr_modal) td{padding:6px 12px;text-align:left;white-space:nowrap}
:is(#li,#lr_modal) th.n,:is(#li,#lr_modal) td.n{text-align:right;font-variant-numeric:tabular-nums}
:is(#li,#lr_modal) thead th{background:rgba(var(--ink-rgb),.06);color:var(--li-tenue);font-size:var(--t-xs);font-weight:800;
  text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1}
:is(#li,#lr_modal) .li-alto thead th{background:var(--panel-deep)}
:is(#li,#lr_modal) thead th.ord{cursor:pointer}
:is(#li,#lr_modal) thead th.ord:hover{color:var(--li-acento)}
:is(#li,#lr_modal) thead th.act{color:var(--li-acento)}
:is(#li,#lr_modal) tbody tr{border-bottom:1px solid rgba(var(--ink-rgb),.05)}
:is(#li,#lr_modal) tbody tr:hover{background:rgba(var(--ink-rgb),.05)}
:is(#li,#lr_modal) td.k{font-weight:700;color:var(--text-strong)}
:is(#li,#lr_modal) td.m{color:var(--li-tenue)}
:is(#li,#lr_modal) td.z{color:var(--li-tenue);opacity:.8}
:is(#li,#lr_modal) td.cod{font-family:ui-monospace,Consolas,monospace;font-size:var(--t-xs)}
:is(#li,#lr_modal) tr.total td{font-weight:800;border-top:2px solid var(--border);background:rgba(var(--ink-rgb),.07);color:var(--text-strong)}
:is(#li,#lr_modal) tr.abre{cursor:pointer}
:is(#li,#lr_modal) tr.abre td:first-child::before{content:'▸';display:inline-block;width:14px;color:var(--li-tenue)}
:is(#li,#lr_modal) tr.abre.abierta td:first-child::before{content:'▾';color:var(--li-acento)}
:is(#li,#lr_modal) tr.abierta td{background:rgba(var(--brand-rgb),.08)}
:is(#li,#lr_modal) tr.hijo > td{padding:0 0 0 26px;background:rgba(var(--ink-rgb),.025)}
:is(#li,#lr_modal) tr.hijo table{font-size:var(--t-xs);border-left:2px solid var(--primary)}
:is(#li,#lr_modal) tr.hijo thead th{position:static;background:rgba(var(--ink-rgb),.05)}
:is(#li,#lr_modal) tr.hijo table td,:is(#li,#lr_modal) tr.hijo table th{white-space:normal}
:is(#li,#lr_modal) table.det{table-layout:fixed;width:100%}
:is(#li,#lr_modal) tr.n3 td:first-child{white-space:normal;min-width:300px}
:is(#li,#lr_modal) tr.modal td:first-child::before{content:'⧉' !important;color:var(--li-acento) !important;font-size:11px}
#lr_modal[hidden]{display:none !important}
#lr_modal table.det{font-size:var(--t-xs)}
#lr_modal table.det th,#lr_modal table.det td{padding:4px 8px;line-height:1.35}
#lr_modal table.det thead th{position:static}
#lr_modal table.det td,#lr_modal table.det th{white-space:normal;overflow-wrap:normal;word-break:normal;vertical-align:top}
#lr_modal table.det td.n,#lr_modal table.det th.n{white-space:nowrap}
#lr_modal table.det{width:auto;min-width:0;table-layout:auto}
#lr_modal table.det thead th{white-space:nowrap}
:is(#li,#lr_modal) tr.nieto > td{padding:0 0 0 26px;background:rgba(var(--ink-rgb),.035)}
:is(#li,#lr_modal) tr.nieto table{border-left:2px solid var(--warning)}
/* La plataforma pinta la fila bajo el mouse (temas.css, !important). La fila que CONTIENE la
   tabla de ASN o de articulos no se pinta: si no, todo el bloque abierto se tiñe al pasar. */
html[data-tema] :is(#li,#lr_modal) tr.hijo:hover td{background:transparent !important}
html[data-tema] :is(#li,#lr_modal) tr.hijo:hover > td{background:rgba(var(--ink-rgb),.025) !important}
html[data-tema] :is(#li,#lr_modal) tr.hijo tr:hover > td{background:rgba(var(--primary-rgb),.10) !important}
html[data-tema] :is(#li,#lr_modal) tr.hijo tr.nieto:hover > td{background:rgba(var(--ink-rgb),.035) !important}
html[data-tema] :is(#li,#lr_modal) tr.hijo:hover tr.abierta > td{background:rgba(var(--brand-rgb),.08) !important}
:is(#li,#lr_modal) .eti{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:4px}
:is(#li,#lr_modal) .eti-T{background:rgba(var(--warning-rgb),.14);color:var(--li-ojo)}
:is(#li,#lr_modal) .eti-R{background:rgba(var(--success-rgb),.14);color:var(--li-ok)}
:is(#li,#lr_modal) .eti-I{background:rgba(var(--brand-rgb),.16);color:var(--li-acento)}
:is(#li,#lr_modal) .eti-M{background:rgba(var(--danger-rgb),.08);color:var(--li-mal)}
:is(#li,#lr_modal) .eti-C{background:rgba(var(--ink-rgb),.12);color:var(--text-soft)}
:is(#li,#lr_modal) .eti-X{background:rgba(var(--ink-rgb),.10);color:var(--text-soft);margin-left:5px}
:is(#li,#lr_modal) .li-nota{padding:8px 12px;font-size:var(--t-xs);color:var(--text-main);border-left:2px solid var(--warning)}
/* 13 columnas: con el relleno de siempre no entraban en una pantalla de 1440 px */
:is(#li,#lr_modal) #li_dis_t > thead > tr > th,:is(#li,#lr_modal) #li_dis_t > tbody > tr > td{padding-left:8px;padding-right:8px}
:is(#li,#lr_modal) #li_dis_t > tbody > tr > td:nth-child(3){white-space:normal;min-width:150px}
:is(#li,#lr_modal) .mas{color:var(--li-ok);font-weight:700}
:is(#li,#lr_modal) .menos{color:var(--li-mal);font-weight:700}
:is(#li,#lr_modal) .viejo{color:var(--li-mal);font-weight:800}
:is(#li,#lr_modal) .medio{color:var(--li-ojo);font-weight:700}
:is(#li,#lr_modal) .barra{display:inline-block;height:6px;border-radius:3px;background:var(--li-acento);opacity:.8;vertical-align:middle}
:is(#li,#lr_modal) .li-dos thead th{white-space:normal;vertical-align:bottom;line-height:1.3}
:is(#li,#lr_modal) .li-dos{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(440px,1fr))}
:is(#li,#lr_modal) .vacio{padding:26px 16px;text-align:center;color:var(--li-tenue)}
:is(#li,#lr_modal) .li-pan .li-selec{border:0;border-bottom:1px solid var(--border);border-radius:0;background:transparent}
:is(#li,#lr_modal) .li-tres{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
:is(#li,#lr_modal) .li-tres > div + div{border-left:1px solid var(--border)}
:is(#li,#lr_modal) .li-tres td:first-child{white-space:normal}
:is(#li,#lr_modal) .li-dos th,:is(#li,#lr_modal) .li-dos td{padding-left:10px;padding-right:10px}
:is(#li,#lr_modal) input[type=date]{background:rgba(var(--shadow-rgb),.3);border:1px solid var(--border);border-radius:9px;color:var(--text-strong);
  padding:8px 12px;font:inherit;font-size:var(--t-sm);font-weight:700;color-scheme:var(--scheme);cursor:pointer}
:is(#li,#lr_modal) .li-mas{padding:10px 16px;border-top:1px solid var(--border);text-align:center}
:is(#li,#lr_modal) .li-mas button,:is(#li,#lr_modal) button.lr-todas{font:inherit;font-size:var(--t-xs);font-weight:700;cursor:pointer;padding:5px 14px;
  border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--li-acento)}
:is(#li,#lr_modal) td.nv{color:var(--li-tenue);opacity:.8;text-align:center}
:is(#li,#lr_modal) th.mesdev{color:var(--li-ojo)}
:is(#li,#lr_modal) tr.n1 td:first-child{padding-left:14px}
:is(#li,#lr_modal) tr.n2 td:first-child{padding-left:30px}
:is(#li,#lr_modal) tr.n3 td:first-child{padding-left:46px}
:is(#li,#lr_modal) tr.n2 td{font-size:var(--t-sm)}
:is(#li,#lr_modal) tr.n3 td{font-size:var(--t-xs)}
:is(#li,#lr_modal) tr.n1 td{font-weight:800;background:rgba(var(--ink-rgb),.035)}
:is(#li,#lr_modal) tr.resto td{color:var(--li-tenue);font-style:italic}
:is(#li,#lr_modal) .li-esperando{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;gap:1rem;
  color:var(--li-tenue);font-size:var(--t-sm);font-weight:600}
:is(#li,#lr_modal) .li-esperando i{width:32px;height:32px;border:3px solid rgba(var(--brand-rgb),.12);border-top-color:var(--brand-light);
  border-radius:50%;animation:spin 1s linear infinite}
`;

/* ── lo común ─────────────────────────────────────────────────────────────── */
const NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombreMes = (m) => NOMBRES[+String(m).slice(5, 7) - 1] || String(m);
const nf = (n) => Math.round(n || 0).toLocaleString('en-US');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const dd = (s) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const tarj = (c, e, v, d) => '<div class="li-t ' + c + '"><div class="e">' + e + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
const esperando = (t) => '<div class="li-esperando"><i></i><span>' + t + '</span></div>';

function ponerEstilos() {
    if (document.getElementById('li-estilos')) return;
    const s = document.createElement('style');
    s.id = 'li-estilos';
    s.textContent = ESTILOS;
    document.head.appendChild(s);
}

/** El área publicada por el robot (fecha MASTER). Se guarda unos minutos: cambiar de pestaña y volver no la
 *  baja otra vez. null si no hay nada publicado todavía. */
async function traer(area) {
    const g = _datos.get(area);
    if (g && Date.now() - g.cuando < MEMORIA_MS) return g.datos;
    const r = await fetch(`${API}/${area}?date=MASTER&t=${Date.now()}`);
    if (!r.ok) return null;
    const j = await r.json();
    let d = (j && j.data !== undefined) ? j.data : j;
    if (Array.isArray(d)) d = d[0];
    if (!d || typeof d !== 'object') return null;
    _datos.set(area, {datos: d, cuando: Date.now()});
    return d;
}

/* Esc cierra el modal del detalle, esté en la pestaña que esté. Uno solo para todo el módulo. */
let _escPuesto = false;
function ponerEsc() {
    if (_escPuesto) return;
    _escPuesto = true;
    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        const m = document.getElementById('lr_modal');
        if (m && !m.hidden) { m.hidden = true; m.innerHTML = ''; }
    });
}

/* ══ PESTAÑA 1 · LO QUE VUELVE ════════════════════════════════════════════ */
const HTML_VUELVE = `
  <div class="li-top">
   <div>
    <p class="li-sub">Lo que las tiendas devuelven al CD: los ASN que empiezan con <b>T</b>. El número dice
     de qué tienda viene: <b>T</b> + los 3 dígitos de la tienda (T<b>251</b>… = 50<b>251</b>). Sale del ASN del
     WMS, del <span id="li_desde"></span> al <span id="li_corte"></span>.</p></div>
   <div><select id="li_mes"></select></div>
  </div>
  <div class="li-selec" id="li_filtros"></div>
  <div class="li-tarj" id="li_tarj"></div>
  <div class="li-dos">
   <div class="li-pan"><div class="li-cab"><h3>Por mes</h3><p>mes en que la tienda creó el ASN</p></div>
    <div class="li-sc"><table id="li_mes_t"></table></div></div>
   <div class="li-pan"><div class="li-cab"><h3>Qué vuelve</h3><p>calzado en pares; lo demás en unidades</p></div>
    <div class="li-sc"><table id="li_que_t"></table></div></div>
  </div>
  <div class="li-dos">
   <div class="li-pan"><div class="li-cab"><h3>En tránsito, por antigüedad</h3><p>días desde que la tienda lo creó</p></div>
    <div class="li-sc"><table id="li_edad_t"></table></div></div>
   <div class="li-pan"><div class="li-cab"><h3>Quién lo recibe</h3><p>usuario que verificó el ASN en el CD</p></div>
    <div class="li-sc"><table id="li_quien_t"></table></div></div>
  </div>
  <div class="li-pan"><div class="li-cab"><h3>Por tienda</h3><p id="li_tien_p"></p></div>
   <div class="li-sc li-alto"><table id="li_tien_t"></table></div>
   <div class="li-mas" id="li_tien_mas"></div></div>
  <div class="li-pan"><div class="li-cab"><h3>Guías con discrepancia</h3></div>
   <div class="li-selec" id="li_dis_sel"></div>
   <div class="li-sc li-alto"><table id="li_dis_t"></table></div>
   <div class="li-mas" id="li_dis_mas"></div></div>`;

function parteVuelve(root, DATA) {
    const el = (id) => root.querySelector('#' + id);
    var CORTE = new Date(DATA.corte + 'T23:59:00');
    var T = DATA.tiendas, ART = DATA.arts;
    var CLASES = ['Calzado', 'Cajas H30', 'Bolsas y materiales', 'Accesorios'];
    var MESES = DATA.meses && DATA.meses.length ? DATA.meses : [...new Set(DATA.asn.map((x) => x[2].slice(0, 7)))].filter(Boolean).sort();
    var NMES = {}; MESES.forEach(function (m) { NMES[m] = nombreMes(m); });
    /* LA GUÍA PUEDE SER ANTERIOR AL ASN: los meses son los de los archivos del ASN (creación en el WMS) y la fecha que
       se muestra es la de la guía. Unas 170 guías de marzo o antes se crearon en el WMS desde abril: van juntas en
       "antes de abril", para que el cuadro por mes cuadre con las tarjetas. */
    var ANTES = 'antes', NANTES = MESES.length ? 'Antes de ' + NMES[MESES[0]].toLowerCase() : 'Antes';
    var mesDe = function (crea) { var m = crea.slice(0, 7); return MESES.length && m < MESES[0] ? ANTES : m; };
    var ESTADO = {T: 'En tránsito', R: 'Recibido', I: 'Recibiendo', C: 'Cancelado'};
    var S = {estado: '', clase: -1, tipo: '', zona: '', mes: '', q: '', orden: 'env', abiertas: {}, verTodas: false,
             dis: '', disOrden: 'crea', disAb: {}, disTodas: false};
    var fecha = function (s) { return s ? new Date(s.replace(' ', 'T') + ':00') : null; };
    var mediana = function (v) { if (!v.length) return null; v = v.slice().sort(function (a, b) { return a - b; });
        return v[Math.floor((v.length - 1) / 2)]; };
    var pct = function (a, b) { return b ? Math.round(100 * a / b) + '%' : '–'; };

    var A = DATA.asn.map(function (x) {
        var c = fecha(x[2]), r = fecha(x[3]);
        return {asn: x[0], t: x[1], crea: x[2], recep: x[3], e: x[4], tipo: x[5], cambio: x[6], user: x[7],
                E: x[8], R: x[9], L: x[10], mes: mesDe(x[2]),
                dias: r && c ? Math.round((r - c) / 864e5) : null,
                edad: c ? Math.floor((CORTE - c) / 864e5) : null};
    });
    el('li_corte').textContent = dd(DATA.corte);
    el('li_desde').textContent = MESES.length ? '01/' + MESES[0].slice(5, 7) + '/' + MESES[0].slice(0, 4) : '';

    var hayAntes = A.some(function (a) { return a.mes === ANTES; });
    el('li_mes').innerHTML = '<option value="">Todos los meses</option>' + (hayAntes ? '<option value="' + ANTES + '">' + NANTES + '</option>' : '') +
        MESES.map(function (m) { return '<option value="' + m + '">' + NMES[m] + ' ' + m.slice(0, 4) + '</option>'; }).join('');
    el('li_mes').onchange = function () { S.mes = this.value; pintar(); };
    // EL TIPO DEL ASN, tal como viene (56, 89, 16…): todavía no tiene nombre. Salen los que haya, el más usado primero.
    var tipos = {}; A.forEach(function (a) { if (a.tipo) tipos[a.tipo] = (tipos[a.tipo] || 0) + 1; });
    var grupos = [
        ['Estado', 'estado', [['', 'Todos'], ['T', 'En tránsito'], ['R', 'Recibido']]],
        ['Qué vuelve', 'clase', [[-1, 'Todo'], [0, 'Calzado'], [1, 'Cajas H30'], [2, 'Bolsas y materiales'], [3, 'Accesorios']]],
        ['Tipo', 'tipo', [['', 'Todos']].concat(Object.keys(tipos).sort(function (a, b) { return tipos[b] - tipos[a]; }).map(function (t) { return [t, t]; }))],
        ['Zona', 'zona', [['', 'Todas'], ['LIMA', 'Lima'], ['PROVINCIA', 'Provincia']]]];
    el('li_filtros').innerHTML = grupos.map(function (g, i) {
        return (i ? '<span class="div"></span>' : '') + '<span class="li-rot">' + g[0] + '</span>' +
            g[2].map(function (o) { return '<button data-k="' + g[1] + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('');
    }).join('') + '<span class="der"><input type="search" id="li_q" placeholder="Buscar tienda o ASN"></span>';
    el('li_filtros').addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        var k = b.dataset.k, v = b.dataset.v; S[k] = k === 'clase' ? Number(v) : v; S.abiertas = {}; pintar();
    });
    el('li_q').addEventListener('input', function () { S.q = this.value.trim().toLowerCase(); S.abiertas = {}; pintar(); });

    var env = function (a) { return S.clase < 0 ? a.E[0] + a.E[1] + a.E[2] + a.E[3] : a.E[S.clase]; };
    var rec = function (a) { return S.clase < 0 ? a.R[0] + a.R[1] + a.R[2] + a.R[3] : a.R[S.clase]; };
    var recibido = function (a) { return a.e === 'R' || a.e === 'I'; };

    function filtrados() {
        return A.filter(function (a) {
            if (S.estado === 'T' && a.e !== 'T') return false;
            if (S.estado === 'R' && !recibido(a)) return false;
            if (S.clase >= 0 && !a.E[S.clase] && !a.R[S.clase]) return false;
            if (S.tipo && a.tipo !== S.tipo) return false;
            if (S.zona && (T[a.t] || [])[1] !== S.zona) return false;
            if (S.mes && a.mes !== S.mes) return false;
            if (S.q) {
                var nom = ((T[a.t] || [])[0] || '').toLowerCase();
                if (a.asn.toLowerCase().indexOf(S.q) < 0 && a.t.indexOf(S.q) < 0 && nom.indexOf(S.q) < 0) return false;
            }
            return true;
        });
    }

    function pintar() {
        root.querySelectorAll('#li_filtros button').forEach(function (b) {
            b.setAttribute('aria-pressed', String(String(S[b.dataset.k]) === b.dataset.v)); });
        var F = filtrados();
        var nE = 0, nR = 0, trU = 0, trN = 0, viejoN = 0, viejoU = 0, dias = [], tiendas = {};
        F.forEach(function (a) {
            nE += env(a); nR += rec(a); tiendas[a.t] = 1;
            if (a.e === 'T') { trU += env(a); trN++; if (a.edad > 60) { viejoN++; viejoU += env(a); } }
            if (recibido(a) && a.dias != null) dias.push(a.dias);
        });
        var md = mediana(dias), ord = dias.slice().sort(function (a, b) { return a - b; });
        var q1 = ord.length ? ord[Math.floor(ord.length * .25)] : null, q3 = ord.length ? ord[Math.floor(ord.length * .75)] : null;
        var und = S.clase === 0 ? 'pares' : 'unidades';
        el('li_tarj').innerHTML =
            tarj('', 'ASN', nf(F.length), 'de ' + nf(Object.keys(tiendas).length) + ' tiendas') +
            tarj('', 'Anunciadas', nf(nE), und + ' que las tiendas mandaron') +
            tarj('ok', 'Recibidas', nf(nR), pct(nR, nE) + ' de lo anunciado') +
            tarj('oj', 'En tránsito', nf(trU), und + ' en ' + nf(trN) + ' ASN') +
            tarj('ma', 'Más de 60 días', nf(viejoN), 'ASN en tránsito · ' + nf(viejoU) + ' ' + und) +
            tarj('gr', 'Tarda en llegar', md == null ? '–' : md + ' días',
                 md == null ? 'sin recibidos' : 'mediana · la mitad entre ' + q1 + ' y ' + q3);
        porMes(F); queVuelve(F); porEdad(F); quien(F); porTienda(F); discrepancias(F);
    }

    function num(v, c) { return '<td class="n' + (v ? '' : ' z') + (c ? ' ' + c : '') + '">' + (v ? nf(v) : '–') + '</td>'; }

    function porMes(F) {
        var FILAS = (hayAntes ? [ANTES] : []).concat(MESES), NOM = function (m) { return m === ANTES ? NANTES : NMES[m]; };
        var g = {}; FILAS.forEach(function (m) { g[m] = {n: 0, e: 0, r: 0, t: 0, d: []}; });
        F.forEach(function (a) { var x = g[a.mes]; if (!x) return; x.n++; x.e += env(a); x.r += rec(a);
            if (a.e === 'T') x.t += env(a); if (recibido(a) && a.dias != null) x.d.push(a.dias); });
        var tot = {n: 0, e: 0, r: 0, t: 0, d: []};
        var h = '<thead><tr><th>Mes</th><th class="n">ASN</th><th class="n">Anunciadas</th><th class="n">Recibidas</th>' +
                '<th class="n">En tránsito</th><th class="n">Tarda (mediana)</th></tr></thead><tbody>';
        FILAS.forEach(function (m) { var x = g[m]; tot.n += x.n; tot.e += x.e; tot.r += x.r; tot.t += x.t; tot.d = tot.d.concat(x.d);
            var md = mediana(x.d);
            h += '<tr><td class="k">' + NOM(m) + '</td>' + num(x.n) + num(x.e) + num(x.r) + num(x.t, x.t ? 'medio' : '') +
                 '<td class="n' + (md == null ? ' z' : '') + '">' + (md == null ? '–' : md + ' días') + '</td></tr>'; });
        var mt = mediana(tot.d);
        h += '<tr class="total"><td>TOTAL</td>' + num(tot.n) + num(tot.e) + num(tot.r) + num(tot.t) +
             '<td class="n">' + (mt == null ? '–' : mt + ' días') + '</td></tr></tbody>';
        el('li_mes_t').innerHTML = h;
    }

    function queVuelve(F) {
        var e = [0, 0, 0, 0], r = [0, 0, 0, 0], t = [0, 0, 0, 0];
        F.forEach(function (a) { for (var i = 0; i < 4; i++) { if (S.clase >= 0 && i !== S.clase) continue;
            e[i] += a.E[i]; r[i] += a.R[i]; if (a.e === 'T') t[i] += a.E[i]; } });
        var te = e[0] + e[1] + e[2] + e[3], mx = Math.max.apply(null, e) || 1;
        var h = '<thead><tr><th>Qué es</th><th class="n">Anunciadas</th><th class="n">%</th><th></th>' +
                '<th class="n">Recibidas</th><th class="n">En tránsito</th></tr></thead><tbody>';
        for (var i = 0; i < 4; i++) {
            if (S.clase >= 0 && i !== S.clase) continue;
            h += '<tr><td class="k">' + CLASES[i] + (i === 0 ? ' <span class="m">(pares)</span>' : '') + '</td>' + num(e[i]) +
                 '<td class="n">' + pct(e[i], te) + '</td><td style="width:120px"><span class="barra" style="width:' +
                 Math.round(110 * e[i] / mx) + 'px"></span></td>' + num(r[i]) + num(t[i], t[i] ? 'medio' : '') + '</tr>';
        }
        h += '<tr class="total"><td>TOTAL</td>' + num(te) + '<td class="n">' + (te ? '100%' : '–') + '</td><td></td>' +
             num(r[0] + r[1] + r[2] + r[3]) + num(t[0] + t[1] + t[2] + t[3]) + '</tr></tbody>';
        el('li_que_t').innerHTML = h;
    }

    function porEdad(F) {
        var tr = [['0 a 7 días', 0, 7], ['8 a 30 días', 8, 30], ['31 a 60 días', 31, 60], ['61 a 90 días', 61, 90], ['Más de 90 días', 91, 1e9]];
        var g = tr.map(function () { return {n: 0, u: 0}; }), tn = 0, tu = 0;
        F.forEach(function (a) { if (a.e !== 'T' || a.edad == null) return;
            for (var i = 0; i < tr.length; i++) if (a.edad >= tr[i][1] && a.edad <= tr[i][2]) { g[i].n++; g[i].u += env(a); tn++; tu += env(a); break; } });
        var h = '<thead><tr><th>Antigüedad</th><th class="n">ASN</th><th class="n">Unidades</th><th class="n">%</th></tr></thead><tbody>';
        tr.forEach(function (x, i) { h += '<tr><td class="k' + (i >= 3 ? ' viejo' : i === 2 ? ' medio' : '') + '">' + x[0] + '</td>' +
            num(g[i].n) + num(g[i].u) + '<td class="n">' + pct(g[i].u, tu) + '</td></tr>'; });
        h += '<tr class="total"><td>TOTAL EN TRÁNSITO</td>' + num(tn) + num(tu) + '<td class="n">' + (tu ? '100%' : '–') + '</td></tr></tbody>';
        el('li_edad_t').innerHTML = h;
    }

    function quien(F) {
        var g = {}, tn = 0, tu = 0;
        F.forEach(function (a) { if (!recibido(a)) return; var u = a.user || '(sin usuario)';
            g[u] = g[u] || {n: 0, u: 0}; g[u].n++; g[u].u += rec(a); tn++; tu += rec(a); });
        var ks = Object.keys(g).sort(function (a, b) { return g[b].u - g[a].u; });
        var h = '<thead><tr><th>Usuario</th><th class="n">ASN</th><th class="n">Unidades recibidas</th><th class="n">%</th></tr></thead><tbody>';
        ks.forEach(function (k) { h += '<tr><td class="k cod">' + esc(k) + '</td>' + num(g[k].n) + num(g[k].u) +
            '<td class="n">' + pct(g[k].u, tu) + '</td></tr>'; });
        if (!ks.length) h += '<tr><td colspan="4" class="vacio">Nada recibido con este filtro</td></tr>';
        h += '<tr class="total"><td>TOTAL</td>' + num(tn) + num(tu) + '<td class="n">' + (tu ? '100%' : '–') + '</td></tr></tbody>';
        el('li_quien_t').innerHTML = h;
    }

    var COLS = [['t', 'Tienda', 0], ['zona', 'Zona', 0], ['n', 'ASN', 1], ['env', 'Anunciadas', 1], ['rec', 'Recibidas', 1],
                ['tr', 'En tránsito', 1], ['viejo', 'Más antiguo en tránsito', 1], ['md', 'Tarda (mediana)', 1], ['dif', 'Dif. al recibir', 1]];
    function porTienda(F) {
        var g = {};
        F.forEach(function (a) {
            var x = g[a.t] = g[a.t] || {t: a.t, nom: (T[a.t] || [''])[0], zona: (T[a.t] || ['', ''])[1], n: 0, env: 0, rec: 0,
                                        tr: 0, viejo: null, d: [], dif: 0, asn: []};
            x.n++; x.env += env(a); x.rec += rec(a); x.asn.push(a);
            if (a.e === 'T') { x.tr += env(a); if (x.viejo == null || a.edad > x.viejo) x.viejo = a.edad; }
            if (recibido(a)) { if (a.dias != null) x.d.push(a.dias); x.dif += rec(a) - env(a); }
        });
        var L = Object.keys(g).map(function (k) { var x = g[k]; x.md = mediana(x.d); return x; });
        var o = S.orden;
        L.sort(function (a, b) { if (o === 't' || o === 'zona') return String(a[o]).localeCompare(String(b[o]));
            return (b[o] == null ? -1e9 : b[o]) - (a[o] == null ? -1e9 : a[o]); });
        var tot = {n: 0, env: 0, rec: 0, tr: 0, dif: 0};
        L.forEach(function (x) { tot.n += x.n; tot.env += x.env; tot.rec += x.rec; tot.tr += x.tr; tot.dif += x.dif; });
        el('li_tien_p').textContent = nf(L.length) + ' tiendas · clic en una para ver sus ASN, y en un ASN para ver qué trae';
        var vis = S.verTodas ? L : L.slice(0, 40);
        var h = '<thead><tr><th class="n">#</th>' + COLS.map(function (c) { return '<th class="ord' + (c[2] ? ' n' : '') +
            (S.orden === c[0] ? ' act' : '') + '" data-o="' + c[0] + '">' + c[1] + (S.orden === c[0] ? ' ↓' : '') + '</th>'; }).join('') +
            '</tr></thead><tbody>';
        vis.forEach(function (x, i) {
            var ab = S.abiertas[x.t];
            h += '<tr class="abre' + (ab ? ' abierta' : '') + '" data-t="' + x.t + '"><td class="n m">' + (i + 1) + '</td>' +
                '<td class="k">' + x.t + ' <span style="font-weight:600">' + esc(x.nom) + '</span></td>' +
                '<td class="m">' + (x.zona === 'LIMA' ? 'Lima' : x.zona === 'PROVINCIA' ? 'Provincia' : '–') + '</td>' +
                num(x.n) + num(x.env) + num(x.rec) + num(x.tr, x.tr ? 'medio' : '') +
                '<td class="n' + (x.viejo == null ? ' z' : x.viejo > 60 ? ' viejo' : x.viejo > 30 ? ' medio' : '') + '">' +
                  (x.viejo == null ? '–' : x.viejo + ' días') + '</td>' +
                '<td class="n' + (x.md == null ? ' z' : '') + '">' + (x.md == null ? '–' : x.md + ' días') + '</td>' +
                '<td class="n' + (x.dif > 0 ? ' mas' : x.dif < 0 ? ' menos' : ' z') + '">' + (x.dif ? (x.dif > 0 ? '+' : '−') + nf(Math.abs(x.dif)) : '–') + '</td></tr>';
            if (ab) h += '<tr class="hijo"><td colspan="10">' + tablaAsn(x.asn) + '</td></tr>';
        });
        if (!L.length) h += '<tr><td colspan="10" class="vacio">Ninguna tienda con este filtro</td></tr>';
        h += '<tr class="total"><td></td><td>TOTAL</td><td></td>' + num(tot.n) + num(tot.env) + num(tot.rec) + num(tot.tr) +
             '<td></td><td></td><td class="n">' + (tot.dif ? (tot.dif > 0 ? '+' : '−') + nf(Math.abs(tot.dif)) : '–') + '</td></tr></tbody>';
        el('li_tien_t').innerHTML = h;
        el('li_tien_mas').innerHTML = L.length > 40 ? '<button id="li_vermas">' + (S.verTodas ? 'Ver solo las 40 primeras' :
            'Ver las ' + nf(L.length) + ' tiendas') + '</button>' : '';
        if (el('li_vermas')) el('li_vermas').onclick = function () { S.verTodas = !S.verTodas; porTienda(filtrados()); };
    }

    function tablaAsn(lista) {
        lista = lista.slice().sort(function (a, b) { return b.crea.localeCompare(a.crea); });
        var h = '<table><thead><tr><th>ASN</th><th>Creado</th><th>Estado</th><th>Tipo</th><th class="n">Anunciadas</th>' +
                '<th class="n">Recibidas</th><th class="n">Días</th><th class="n">Dif.</th><th>Recibió</th></tr></thead><tbody>';
        lista.forEach(function (a) {
            var dif = recibido(a) ? rec(a) - env(a) : 0, ab = S.abiertas['a' + a.asn];
            var dias = a.e === 'T' ? a.edad : a.dias;
            h += '<tr class="abre' + (ab ? ' abierta' : '') + '" data-a="' + a.asn + '"><td class="cod k">' + a.asn + '</td>' +
                '<td>' + dd(a.crea) + '</td><td><span class="eti eti-' + a.e + '">' + (ESTADO[a.e] || a.e) + '</span>' +
                (a.cambio ? '<span class="eti eti-X">cambio</span>' : '') + '</td><td class="m">' + esc(a.tipo) + '</td>' +
                num(env(a)) + num(rec(a)) +
                '<td class="n' + (dias == null ? ' z' : a.e === 'T' && dias > 60 ? ' viejo' : a.e === 'T' && dias > 30 ? ' medio' : '') + '">' +
                  (dias == null ? '–' : dias + (a.e === 'T' ? ' en tránsito' : '')) + '</td>' +
                '<td class="n' + (dif > 0 ? ' mas' : dif < 0 ? ' menos' : ' z') + '">' + (dif ? (dif > 0 ? '+' : '−') + nf(Math.abs(dif)) : '–') + '</td>' +
                '<td class="cod m">' + esc(a.user) + '</td></tr>';
            if (ab) h += '<tr class="nieto"><td colspan="9">' + tablaLineas(a) + '</td></tr>';
        });
        return h + '</tbody></table>';
    }

    function tablaLineas(a) {
        var h = '<table><thead><tr><th>Artículo</th><th>Descripción</th><th>Qué es</th><th class="n">Anunciada</th>' +
                '<th class="n">Recibida</th></tr></thead><tbody>';
        a.L.forEach(function (l) { var ar = ART[l[0]]; if (S.clase >= 0 && ar[2] !== S.clase) return;
            h += '<tr><td class="cod">' + esc(ar[0]) + '</td><td>' + esc(ar[1]) + '</td><td class="m">' + CLASES[ar[2]] + '</td>' +
                 num(l[1]) + '<td class="n' + (!recibido(a) ? ' z' : l[2] > l[1] ? ' mas' : l[2] < l[1] ? ' menos' : '') + '">' +
                 (recibido(a) ? nf(l[2]) : '–') + '</td></tr>'; });
        return h + '</tbody></table>';
    }

    /* GUÍAS CON DISCREPANCIA (Daniel, 19-sep-2026). Solo guías ya ingresadas: la que sigue en tránsito todavía no se
       contó. Se compara lo que la tienda anunció contra lo que el CD recibió por MODELO Y TALLA, SIN MIRAR LA CALIDAD:
       el -1- (buena), el -9- (baja) o el que venga son una etiqueta que pone el CD, y "todo lo que entra por
       logística inversa va junto". Cada diferencia se explica así:
         1. otra talla: sobra una talla y falta otra del mismo modelo (7 dígitos)
         2. no llegó / no venía en la guía: lo que queda sin pareja
       Qué pasó con la guía, uno solo y en este orden: sin cerrar (Receiving Started), recibida sin fecha de ingreso
       (el WMS no la trae), llegó de menos, llegó de más, o mismo total pero otro contenido. */
    // [nombre en el botón, color, nombre corto en la fila, la nota que sale al abrir la guía]
    var DIS = {sc: ['Ingreso sin cerrar', 'eti-T', 'Sin cerrar', 'El ingreso se empezó y no se cerró en el WMS (Receiving Started): lo recibido todavía puede cambiar.'],
               sf: ['Recibida sin fecha de ingreso', 'eti-T', 'Sin fecha', 'El WMS la da por recibida pero no trae la fecha de recepción.'],
               me: ['Llegó de menos', 'eti-M', 'De menos', ''], ma: ['Llegó de más', 'eti-I', 'De más', ''],
               co: ['Mismo total, otro contenido', 'eti-C', 'Otro contenido', '']};
    var tallaDe = function (d) { var m = /-(\d+(?:\.\d)?)\s*$/.exec(d || ''); return m ? m[1] : ''; };
    // modelo + talla, sin el dígito de calidad: 5096303-1-07 y 5096303-9-07 son el mismo artículo
    var sinCalidad = function (c) { return c.length === 12 && c.charAt(7) === '-' && c.charAt(9) === '-' ? c.slice(0, 7) + c.slice(9) : c; };
    function comparar(a) {
        var pa = {}, orden = [];
        a.L.forEach(function (l) { var ar = ART[l[0]]; if (S.clase >= 0 && ar[2] !== S.clase) return;
            var k = sinCalidad(ar[0]), x = pa[k];
            if (!x) { x = pa[k] = {c: ar[0], cs: [ar[0]], d: ar[1], e: 0, r: 0, que: []}; orden.push(k); }
            else if (x.cs.indexOf(ar[0]) < 0) { x.cs.push(ar[0]); x.c = x.cs.join(' + '); }
            x.e += l[1]; x.r += l[2]; });
        var sob = {}, fal = {}, o = {talla: 0, nollego: 0, novenia: 0};
        orden.forEach(function (k) { var x = pa[k]; if (x.r > x.e) sob[k] = x.r - x.e; else if (x.e > x.r) fal[k] = x.e - x.r; });
        Object.keys(sob).forEach(function (k) { Object.keys(fal).forEach(function (f) {
            if (!(sob[k] > 0 && fal[f] > 0 && f.slice(0, 7) === k.slice(0, 7))) return;
            var u = Math.min(sob[k], fal[f]); sob[k] -= u; fal[f] -= u; o.talla += u;
            pa[f].que.push('llegó la talla ' + tallaDe(pa[k].d) + ' ×' + nf(u)); pa[k].que.push('en vez de la talla ' + tallaDe(pa[f].d) + ' ×' + nf(u)); }); });
        Object.keys(fal).forEach(function (f) { if (fal[f] > 0) { o.nollego += fal[f]; pa[f].que.push('no llegó ×' + nf(fal[f])); } });
        Object.keys(sob).forEach(function (k) { if (sob[k] > 0) { o.novenia += sob[k]; pa[k].que.push('no venía en la guía ×' + nf(sob[k])); } });
        return {o: o, lineas: orden.map(function (k) { return pa[k]; })};
    }
    function discrepancias(F) {
        var L = [], cuenta = {'': 0, sc: 0, sf: 0, me: 0, ma: 0, co: 0};
        F.forEach(function (a) {
            if (!recibido(a)) return;
            var e = env(a), r = rec(a), c = comparar(a), o = c.o;
            var k = a.e === 'I' ? 'sc' : !a.recep ? 'sf' : r < e ? 'me' : r > e ? 'ma' : (o.talla || o.nollego || o.novenia) ? 'co' : '';
            if (!k) return;
            cuenta['']++; cuenta[k]++;
            if (S.dis && S.dis !== k) return;
            L.push({a: a, k: k, e: e, r: r, dif: r - e, talla: o.talla, nollego: o.nollego, novenia: o.novenia, lineas: c.lineas});
        });
        el('li_dis_sel').innerHTML = '<span class="li-rot">Qué pasó</span>' + [['', 'Todas']].concat(['sc', 'sf', 'me', 'ma', 'co'].map(function (k) { return [k, DIS[k][0]]; }))
            .map(function (o) { return '<button data-d="' + o[0] + '" aria-pressed="' + (S.dis === o[0]) + '">' + o[1] + ' · ' + nf(cuenta[o[0]]) + '</button>'; }).join('');
        var o = S.disOrden;
        L.sort(function (x, y) { return o === 'crea' ? y.a.crea.localeCompare(x.a.crea) : o === 'dif' ? Math.abs(y.dif) - Math.abs(x.dif) : y[o] - x[o]; });
        var CD = [['crea', 'Guía del'], ['e', 'Anunciado'], ['r', 'Recibido'], ['dif', 'Dif.'], ['talla', 'Otra talla'],
                  ['nollego', 'No llegó'], ['novenia', 'No venía']];
        var th = function (c, n) { return '<th class="ord' + (n ? ' n' : '') + (o === c[0] ? ' act' : '') + '" data-o="' + c[0] + '">' + c[1] + (o === c[0] ? ' ↓' : '') + '</th>'; };
        var h = '<thead><tr><th class="n">#</th><th>Guía</th><th>Tienda</th>' + th(CD[0], 0) + '<th>Ingresó</th><th>Recibió</th><th>Qué pasó</th>' +
            CD.slice(1).map(function (c) { return th(c, 1); }).join('') + '</tr></thead><tbody>';
        var vis = S.disTodas ? L : L.slice(0, 40), t = {e: 0, r: 0, talla: 0, nollego: 0, novenia: 0};
        L.forEach(function (x) { t.e += x.e; t.r += x.r; t.talla += x.talla; t.nollego += x.nollego; t.novenia += x.novenia; });
        vis.forEach(function (x, i) {
            var a = x.a, ab = S.disAb[a.asn];
            h += '<tr class="abre' + (ab ? ' abierta' : '') + '" data-g="' + a.asn + '"><td class="n m">' + (i + 1) + '</td>' +
                '<td class="cod k">' + a.asn + '</td><td><b>' + a.t + '</b> ' + esc((T[a.t] || [''])[0]) + '</td><td>' + dd(a.crea) + '</td>' +
                '<td' + (a.recep ? '' : ' class="z"') + '>' + (a.recep ? dd(a.recep).slice(0, 5) + ' ' + a.recep.slice(11, 16) : '–') + '</td>' +
                '<td class="cod m">' + esc(a.user || '–') + '</td><td><span class="eti ' + DIS[x.k][1] + '">' + DIS[x.k][2] + '</span></td>' +
                num(x.e) + num(x.r) + '<td class="n' + (x.dif > 0 ? ' mas' : x.dif < 0 ? ' menos' : ' z') + '">' + (x.dif ? (x.dif > 0 ? '+' : '−') + nf(Math.abs(x.dif)) : '–') + '</td>' +
                num(x.talla) + num(x.nollego) + num(x.novenia) + '</tr>';
            if (ab) h += '<tr class="hijo"><td colspan="13">' + lineasDis(x) + '</td></tr>';
        });
        if (!L.length) h += '<tr><td colspan="13" class="vacio">' + (S.estado === 'T' ? 'Las guías en tránsito todavía no se cuentan: la discrepancia aparece al ingresarlas.' :
            'Ninguna guía con discrepancia con este filtro') + '</td></tr>';
        var td = t.r - t.e;
        h += '<tr class="total"><td></td><td>TOTAL · ' + nf(L.length) + ' guías</td><td></td><td></td><td></td><td></td><td></td>' + num(t.e) + num(t.r) +
            '<td class="n">' + (td ? (td > 0 ? '+' : '−') + nf(Math.abs(td)) : '–') + '</td>' + num(t.talla) + num(t.nollego) + num(t.novenia) + '</tr></tbody>';
        el('li_dis_t').innerHTML = h;
        el('li_dis_mas').innerHTML = L.length > 40 ? '<button id="li_dis_vermas">' + (S.disTodas ? 'Ver solo las 40 primeras' : 'Ver las ' + nf(L.length) + ' guías') + '</button>' : '';
        if (el('li_dis_vermas')) el('li_dis_vermas').onclick = function () { S.disTodas = !S.disTodas; discrepancias(filtrados()); };
    }
    function lineasDis(x) {
        var dif = x.lineas.filter(function (l) { return l.e !== l.r; }), igual = x.lineas.length - dif.length;
        var h = (DIS[x.k][3] ? '<div class="li-nota">' + DIS[x.k][3] + '</div>' : '') + '<table><thead><tr><th>Artículo</th><th>Descripción</th><th class="n">Anunciado</th><th class="n">Recibido</th><th class="n">Dif.</th>' +
            '<th>Qué fue</th></tr></thead><tbody>';
        dif.forEach(function (l) { var d = l.r - l.e;
            h += '<tr><td class="cod">' + esc(l.c) + '</td><td>' + esc(l.d) + '</td>' + num(l.e) + num(l.r) +
                '<td class="n ' + (d > 0 ? 'mas' : 'menos') + '">' + (d > 0 ? '+' : '−') + nf(Math.abs(d)) + '</td><td>' + esc(l.que.join(' · ')) + '</td></tr>'; });
        if (igual) h += '<tr><td colspan="6" class="m">y ' + nf(igual) + (igual === 1 ? ' artículo llegó' : ' artículos llegaron') + ' igual a lo anunciado</td></tr>';
        return h + '</tbody></table>';
    }
    el('li_dis_sel').addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return; S.dis = b.dataset.d; S.disAb = {}; S.disTodas = false; discrepancias(filtrados()); });
    el('li_dis_t').addEventListener('click', function (ev) {
        var th = ev.target.closest('th.ord');
        if (th) { S.disOrden = th.dataset.o; discrepancias(filtrados()); return; }
        var tr = ev.target.closest('tr.abre'); if (!tr) return;
        var g = tr.dataset.g; if (S.disAb[g]) delete S.disAb[g]; else S.disAb[g] = 1; discrepancias(filtrados());
    });

    el('li_tien_t').addEventListener('click', function (ev) {
        var th = ev.target.closest('th.ord');
        if (th) { S.orden = th.dataset.o; porTienda(filtrados()); return; }
        var tr = ev.target.closest('tr.abre'); if (!tr) return;
        var k = tr.dataset.a ? 'a' + tr.dataset.a : tr.dataset.t;
        if (S.abiertas[k]) delete S.abiertas[k]; else S.abiertas[k] = 1;
        porTienda(filtrados());
    });
    pintar();
}

/* ══ PESTAÑA 2 · DESPACHADO Y DEVUELTO ════════════════════════════════════ */
const HTML_RETORNO = `
   <div class="li-top"><div>
    <p class="li-sub">De lo que se le despachó a cada tienda <b>desde <span id="lr_desde"></span></b>, cuánto retornó por logística
     inversa y <b>en qué mes ingresó</b>. Solo calzado, en pares. Cada devolución se cruza con el despacho de ese mismo
     modelo y talla a esa misma tienda —la calidad -1- o -9- va junta—, el más antiguo primero.</p></div></div>
   <div class="li-selec" id="lr_filtros"></div>
   <div class="li-tarj" id="lr_tarj"></div>
   <div class="li-pan"><div class="li-cab"><h3>Por mes de despacho</h3></div>
    <div class="li-sc li-alto"><table id="lr_t"></table></div></div>
   <div class="li-dos">
    <div class="li-pan"><div class="li-cab"><h3>En tránsito o ingresado</h3>
      <p>de lo que retornó · el sistema registra el ingreso, no la llegada al CD</p></div>
     <div class="li-sc"><table id="lr_est_t"></table></div></div>
    <div class="li-pan"><div class="li-cab"><h3 id="lr_sin_h"></h3><p id="lr_sin_p"></p></div>
     <div class="li-sc li-alto"><table id="lr_sin_t"></table></div></div>
   </div>`;

function parteRetorno(root, R) {
    const el = (id) => root.querySelector('#' + id);
    var T = R.tiendas, M = R.meses, NM = M.length, DET = null;
    var NMES = {}; M.forEach(function (m) { NMES[m] = nombreMes(m); });
    var PREVIO = nombreMes(R.previo || '').toLowerCase();
    var S = {zona: '', q: '', abiertas: {}, todas: {}};
    var pct = function (a, b) { if (!b) return '–'; var p = 100 * a / b; return (p > 0 && p < 0.1 ? '<0.1' : p.toFixed(1)) + '%'; };
    var nomT = function (t) { return (T[t] || ['(no está en rutas)'])[0]; };
    var zonaT = function (t) { return (T[t] || ['', ''])[1]; };
    var ceros = function () { return M.map(function () { return 0; }); };
    el('lr_desde').textContent = NMES[M[0]].toLowerCase();
    el('lr_sin_h').textContent = 'Devuelto que no sale de un despacho desde ' + NMES[M[0]].toLowerCase();
    el('lr_sin_p').textContent = 'despachado en ' + PREVIO + ', o más viejo, o de otra tienda';

    el('lr_filtros').innerHTML = '<span class="li-rot">Zona</span>' +
        [['', 'Todas'], ['LIMA', 'Lima'], ['PROVINCIA', 'Provincia']].map(function (o) {
            return '<button data-k="zona" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') +
        '<span class="der"><input type="search" id="lr_q" placeholder="Buscar tienda, modelo o SKU"></span>';
    el('lr_filtros').addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return; S[b.dataset.k] = b.dataset.v; S.abiertas = {}; pintar(); });
    el('lr_q').addEventListener('input', function () { S.q = this.value.trim().toLowerCase(); S.abiertas = {}; pintar(); });

    function vacio() { return {desp: 0, dev: 0, tr: 0, pm: ceros(), dias: {}}; }
    function suma(a, b) { a.desp += b.desp; a.dev += b.dev; a.tr += b.tr || 0; for (var i = 0; i < NM; i++) a.pm[i] += b.pm[i];
        for (var d in b.dias) a.dias[d] = (a.dias[d] || 0) + b.dias[d]; return a; }
    function deSku(x) { return {desp: x[2], dev: x[3], tr: x[6] || 0, pm: x[5].slice(), dias: x[4]}; }
    function cuantil(dias, q) { var ks = Object.keys(dias).map(Number).sort(function (a, b) { return a - b; });
        var tot = 0; ks.forEach(function (k) { tot += dias[k]; }); if (!tot) return null; var acc = 0;
        for (var i = 0; i < ks.length; i++) { acc += dias[ks[i]]; if (acc >= tot * q) return ks[i]; } return null; }
    var mediana = function (d) { return cuantil(d, .5); };

    function filtrado() {
        var q = S.q;
        return R.arbol.map(function (mt) {
            var ts = [];
            mt[1].forEach(function (x) {
                var t = x[0];
                if (S.zona && zonaT(t) !== S.zona) return;
                if (!q || t.indexOf(q) >= 0 || nomT(t).toLowerCase().indexOf(q) >= 0) { ts.push(x); return; }
                var mods = x[2].filter(function (o) {
                    return o[0].indexOf(q) >= 0 || o[1].toLowerCase().indexOf(q) >= 0 ||
                           o[3].some(function (k) { return k[0].toLowerCase().indexOf(q) >= 0; }); });
                if (mods.length) ts.push([t, 0, mods]);
            });
            return [mt[0], ts];
        });
    }
    // EL ORDEN: los meses van en orden y, adentro, % RETORNÓ DE MAYOR A MENOR (Daniel, 19-sep-2026). Empata por lo que retornó.
    function orden(a, b) {
        var p = function (v) { return v.desp ? v.dev / v.desp : -1; };
        return (p(b) - p(a)) || (b.dev - a.dev) || (b.desp - a.desp);
    }
    function totMod(o) { return o[3].reduce(function (a, k) { return suma(a, deSku(k)); }, vacio()); }
    function totTienda(x) { var a = x[2].reduce(function (a, o) { return suma(a, totMod(o)); }, vacio()); a.desp += x[1]; return a; }

    // una fila del cuadro: i = mes de despacho; los meses de antes no aplican
    function fila(clase, clave, nombre, v, i, abre) {
        var md = mediana(v.dias), h = '<tr class="' + clase + (abre ? ' abre' + (S.abiertas[clave] ? ' abierta' : '') : '') +
            '"' + (abre ? ' data-k="' + esc(clave) + '"' : '') + '><td>' + nombre + '</td>' +
            '<td class="n">' + nf(v.desp) + '</td>' +
            '<td class="n' + (v.dev ? ' k' : ' z') + '">' + (v.dev ? nf(v.dev) : '–') + '</td>' +
            '<td class="n' + (v.tr ? ' medio' : ' z') + '">' + (v.tr ? nf(v.tr) : '–') + '</td>' +
            '<td class="n' + (v.dev - v.tr ? '' : ' z') + '">' + (v.dev - v.tr ? nf(v.dev - v.tr) : '–') + '</td>' +
            '<td class="n' + (v.dev ? '' : ' z') + '">' + (v.dev ? pct(v.dev, v.desp) : '–') + '</td>';
        for (var j = 0; j < NM; j++) h += j < i ? '<td class="nv">·</td>' :
            '<td class="n' + (v.pm[j] ? '' : ' z') + '">' + (v.pm[j] ? nf(v.pm[j]) : '–') + '</td>';
        return h + '<td class="n' + (md == null ? ' z' : '') + '">' + (md == null ? '–' : md + ' días') + '</td></tr>';
    }

    function pintar() {
        root.querySelectorAll('#lr_filtros button').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.v === S[b.dataset.k])); });
        var F = filtrado(), total = vacio(), tiendasDesp = {}, tiendasDev = {};
        var h = '<thead><tr><th rowspan="2">Mes de despacho · tienda · modelo</th><th class="n" rowspan="2">Despachado</th><th class="n" rowspan="2">Retornó</th><th class="n" rowspan="2">En<br>tránsito</th><th class="n" rowspan="2">Ingresado</th><th class="n" rowspan="2">% Retornó ↓</th>' +
            '<th colspan="' + NM + '" class="mesdev" style="text-align:center;border-bottom:none" title="Solo lo ingresado, en el mes en que se ingresó. Lo que está en tránsito no entra.">ingresó en</th>' +
            '<th class="n" rowspan="2">Tarda<br>(mediana)</th></tr><tr>' +
            M.map(function (m) { return '<th class="n mesdev">' + NMES[m].slice(0, 3) + '</th>'; }).join('') +
            '</tr></thead><tbody>';
        F.forEach(function (mt) {
            var m = mt[0], km = 'm' + m, i = M.indexOf(m);
            var tot = mt[1].reduce(function (a, x) { var v = totTienda(x); tiendasDesp[x[0]] = 1; if (v.dev) tiendasDev[x[0]] = 1; return suma(a, v); }, vacio());
            suma(total, tot);
            h += fila('n1', km, NMES[m] + ' <span class="m" style="font-weight:600">· ' + nf(mt[1].length) + ' tiendas</span>', tot, i, true);
            if (!S.abiertas[km]) return;
            var ts = mt[1].map(function (x) { return [x, totTienda(x)]; }).sort(function (a, b) { return orden(a[1], b[1]); });
            (S.todas[km] ? ts : ts.slice(0, 30)).forEach(function (tv) {
                var x = tv[0], kt = 't' + m + x[0];
                h += fila('n2', kt, '<b>' + x[0] + '</b> ' + esc(nomT(x[0])), tv[1], i, x[2].length > 0);
                if (!S.abiertas[kt]) return;
                x[2].map(function (o) { return [o, totMod(o)]; }).sort(function (a, b) { return orden(a[1], b[1]); })
                    .forEach(function (ov) {
                        var o = ov[0], ko = 'o' + m + x[0] + o[0];
                        h += fila('n3 modal', ko, '<span class="cod">' + o[0] + '</span> ' + esc(o[1]) +
                             (o[2] ? ' <span class="m">· ' + esc(o[2]) + '</span>' : ''), ov[1], i, true);
                    });
                if (x[1]) h += fila('n3 resto', '', 'otros modelos, sin devolución', {desp: x[1], dev: 0, tr: 0, pm: ceros(), dias: {}}, i, false);
            });
            if (ts.length > 30) h += '<tr><td colspan="' + (7 + NM) + '" style="text-align:center"><button class="lr-todas" data-m="' + km +
                '">' + (S.todas[km] ? 'ver solo las 30 que más devolvieron' : 'ver las ' + nf(ts.length) + ' tiendas') + '</button></td></tr>';
        });
        var mdT = mediana(total.dias);
        h += '<tr class="total"><td>TOTAL</td><td class="n">' + nf(total.desp) + '</td><td class="n">' + nf(total.dev) + '</td>' +
            '<td class="n">' + nf(total.tr) + '</td><td class="n">' + nf(total.dev - total.tr) + '</td>' +
            '<td class="n">' + pct(total.dev, total.desp) + '</td>' +
            total.pm.map(function (p) { return '<td class="n">' + (p ? nf(p) : '–') + '</td>'; }).join('') +
            '<td class="n">' + (mdT == null ? '–' : mdT + ' días') + '</td></tr></tbody>';
        el('lr_t').innerHTML = h;
        fijarEncabezado();

        // ── en tránsito o ingresado, por mes de despacho ──
        var eh = '<thead><tr><th>Mes de despacho</th><th class="n">Retornó</th><th class="n">En tránsito</th>' +
            '<th class="n">Ingresado</th><th class="n">% ingresado</th><th class="n">Tarda en ingresar<br>(mediana)</th></tr></thead><tbody>';
        var et = {dev: 0, tr: 0, ding: {}};
        F.forEach(function (mt) {
            var e = {dev: 0, tr: 0, ding: {}};
            mt[1].forEach(function (x) { x[2].forEach(function (o) { o[3].forEach(function (k) {
                e.dev += k[3]; e.tr += k[6]; for (var d in k[7]) e.ding[d] = (e.ding[d] || 0) + k[7][d]; }); }); });
            et.dev += e.dev; et.tr += e.tr; for (var d in e.ding) et.ding[d] = (et.ding[d] || 0) + e.ding[d];
            eh += filaEstado(NMES[mt[0]], e, '');
        });
        el('lr_est_t').innerHTML = eh + filaEstado('TOTAL', et, 'total') + '</tbody>';

        // ── lo devuelto que no sale de un despacho desde el primer mes ──
        var conFiltro = !!(S.zona || S.q), abrTot = 0, sinSolo = 0;
        var sh = '<thead><tr><th>Mes en que retornó · tienda · modelo</th><th class="n">De lo despachado en ' + PREVIO + '</th>' +
            '<th class="n">Anterior o de otra tienda</th><th class="n">Total</th></tr></thead><tbody>';
        R.sin.forEach(function (ms, i) {
            var m = ms[0], k = 's' + m;
            var ts = ms[1].filter(function (x) { return !S.zona || zonaT(x[0]) === S.zona; }).map(function (x) {
                var q = S.q; if (!q || x[0].indexOf(q) >= 0 || nomT(x[0]).toLowerCase().indexOf(q) >= 0) return x;
                var mods = x[1].filter(function (o) { var d = R.sinDesc[o[0]] || ['', ''];
                    return o[0].indexOf(q) >= 0 || d[0].toLowerCase().indexOf(q) >= 0; });
                return mods.length ? [x[0], mods] : null; }).filter(Boolean)
                .map(function (x) { var p = 0; x[1].forEach(function (o) { p += o[1]; }); return [x, p]; })
                .sort(function (a, b) { return b[1] - a[1]; });
            var pares = ts.reduce(function (a, xp) { return a + xp[1]; }, 0);
            var ab = conFiltro ? 0 : R.abril[i]; abrTot += ab; sinSolo += pares;
            sh += '<tr class="n1 abre' + (S.abiertas[k] ? ' abierta' : '') + '" data-k="' + k + '"><td>' + NMES[m] +
                ' <span class="m" style="font-weight:600">· ' + nf(ts.length) + ' tiendas</span></td>' +
                '<td class="n' + (conFiltro ? ' nv' : '') + '">' + (conFiltro ? '·' : nf(ab)) + '</td><td class="n">' + nf(pares) + '</td>' +
                '<td class="n">' + nf(ab + pares) + '</td></tr>';
            if (!S.abiertas[k]) return;
            (S.todas[k] ? ts : ts.slice(0, 30)).forEach(function (xp) {
                var x = xp[0], kt = k + x[0];
                sh += '<tr class="n2 abre' + (S.abiertas[kt] ? ' abierta' : '') + '" data-k="' + kt + '"><td><b>' + x[0] + '</b> ' +
                    esc(nomT(x[0])) + '</td><td class="nv">·</td><td class="n">' + nf(xp[1]) + '</td><td class="n">' + nf(xp[1]) + '</td></tr>';
                if (!S.abiertas[kt]) return;
                x[1].forEach(function (o) { var d = R.sinDesc[o[0]] || ['', ''];
                    sh += '<tr class="n3"><td><span class="cod">' + o[0] + '</span> ' + esc(d[0]) + (d[1] ? ' <span class="m">· ' + esc(d[1]) + '</span>' : '') +
                        '</td><td class="nv">·</td><td class="n">' + nf(o[1]) + '</td><td class="n">' + nf(o[1]) + '</td></tr>'; });
            });
            if (ts.length > 30) sh += '<tr><td colspan="4" style="text-align:center"><button class="lr-todas" data-m="' + k +
                '">' + (S.todas[k] ? 'ver solo las 30 que más devolvieron' : 'ver las ' + nf(ts.length) + ' tiendas') + '</button></td></tr>';
        });
        sh += '<tr class="total"><td>TOTAL</td><td class="n' + (conFiltro ? ' nv' : '') + '">' + (conFiltro ? '·' : nf(abrTot)) +
            '</td><td class="n">' + nf(sinSolo) + '</td><td class="n">' + nf(abrTot + sinSolo) + '</td></tr></tbody>';
        el('lr_sin_t').innerHTML = sh;

        var q1 = cuantil(total.dias, .25), q3 = cuantil(total.dias, .75), todo = total.dev + abrTot + sinSolo;
        el('lr_tarj').innerHTML =
            tarj('', 'Despachado', nf(total.desp), 'pares a ' + nf(Object.keys(tiendasDesp).length) + ' tiendas, del 01/' + M[0].slice(5, 7) + ' al ' + dd(R.corte).slice(0, 5)) +
            tarj('oj', 'Retornó de eso', nf(total.dev), pct(total.dev, total.desp) + ' de lo despachado · ' + nf(total.tr) +
                 ' en tránsito · ' + nf(total.dev - total.tr) + ' ingresado') +
            tarj('gr', 'Tarda en retornar', mdT == null ? '–' : mdT + ' días', mdT == null ? '' : 'mediana · la mitad entre ' + q1 + ' y ' + q3 + ' días') +
            tarj('ok', 'Tiendas que devolvieron', nf(Object.keys(tiendasDev).length), 'de ' + nf(Object.keys(tiendasDesp).length) + ' a las que se despachó') +
            tarj('ma', 'Retornó desde ' + NMES[M[0]].toLowerCase() + ', en total', nf(todo), nf(total.dev) + ' de estos despachos · ' +
                 (conFiltro ? '' : nf(abrTot) + ' de ' + PREVIO + ' · ') + nf(sinSolo) + ' anterior u otra tienda');
    }
    function filaEstado(nom, e, clase) {
        var ing = e.dev - e.tr, md = mediana(e.ding);
        return '<tr' + (clase ? ' class="' + clase + '"' : '') + '><td' + (clase ? '' : ' class="k"') + '>' + nom + '</td>' +
            '<td class="n' + (e.dev ? '' : ' z') + '">' + (e.dev ? nf(e.dev) : '–') + '</td>' +
            '<td class="n' + (e.tr ? (clase ? '' : ' medio') : ' z') + '">' + (e.tr ? nf(e.tr) : '–') + '</td>' +
            '<td class="n' + (ing ? '' : ' z') + '">' + (ing ? nf(ing) : '–') + '</td>' +
            '<td class="n">' + (e.dev ? Math.round(100 * ing / e.dev) + '%' : '–') + '</td>' +
            '<td class="n' + (md == null ? ' z' : '') + '">' + (md == null ? '–' : md + ' días') + '</td></tr>';
    }
    /* EL DETALLE DE UN MODELO: cada despacho de ese modelo a esa tienda en ese mes, con su pedido, quién lo picó,
       la caja, quién la embaló, cuándo se cargó, y las guías T que retornaron de ese despacho. Aquí sí va el SKU. */
    function detalle(m, t, mod) {
        var l = DET[m + '|' + t + '|' + mod] || [], tp = 0, tv = 0;
        var h = '<table class="det"><thead><tr><th>SKU · talla</th><th>Pedido</th><th>Picking</th><th>Embalaje · caja</th><th>Despacho</th>' +
            '<th class="n">Pares</th><th class="n">Retornó</th><th>Guía T que retornó</th></tr></thead><tbody>';
        l.forEach(function (r) {
            tp += r[9]; tv += r[10];
            h += '<tr><td class="cod">' + esc(r[0]) + ' <span class="m">· ' + esc(r[1]) + '</span></td>' +
                '<td class="cod k">' + esc(r[3]) + '</td>' +
                '<td>' + esc(r[5]) + ' <span class="m">· ' + esc(r[6]) + '</span></td>' +
                '<td>' + esc(r[7]) + ' <span class="m">· ' + esc(r[8]) + ' ·</span> <span class="m cod">' + esc(r[4]) + '</span></td>' +
                '<td>' + esc(r[2]) + '</td>' +
                '<td class="n">' + nf(r[9]) + '</td>' +
                '<td class="n' + (r[10] ? ' k' : ' z') + '">' + (r[10] ? nf(r[10]) : '–') + '</td>' +
                '<td>' + porGuia(r[11]).map(function (g) {
                    return '<div style="white-space:nowrap"><span class="cod k">' + esc(g.asn) + '</span> · guía ' + esc(g.fecha.slice(0, 5)) + ' · <b>' + nf(g.pares) +
                        (Math.round(g.pares) === 1 ? ' par' : ' pares') + '</b> <span class="m">(' + Object.keys(g.tallas).sort(function (a, b) { return parseFloat(a) - parseFloat(b); })
                            .map(function (t) { return 't.' + esc(t) + ' ×' + nf(g.tallas[t]); }).join(' · ') + ')</span> ' +
                        (g.tr ? '<span class="eti eti-T">en tránsito</span>' : '<span class="eti eti-R">ingresada ' + esc(g.ing) + '</span>') + '</div>'; }).join('') + '</td></tr>';
        });
        return h + '<tr class="total"><td>TOTAL</td><td>' + nf(l.length) + ' despachos</td><td></td><td></td><td></td>' +
            '<td class="n">' + nf(tp) + '</td><td class="n">' + nf(tv) + '</td><td></td></tr></tbody></table>';
    }
    // UNA LÍNEA POR GUÍA: una misma guía T vuelve con varias tallas y cada talla se casó por separado.
    // g: [guía T, pares, fecha de la guía, en tránsito, talla devuelta, SKU devuelto, fecha de ingreso]
    function porGuia(l) {
        var g = {}, ord = [];
        l.forEach(function (x) {
            if (!g[x[0]]) { g[x[0]] = {asn: x[0], pares: 0, fecha: x[2], tr: x[3], ing: x[6] || '', tallas: {}}; ord.push(x[0]); }
            g[x[0]].pares += x[1]; g[x[0]].tallas[x[4]] = (g[x[0]].tallas[x[4]] || 0) + x[1];
        });
        return ord.map(function (k) { return g[k]; });
    }
    // LA SEGUNDA FILA DEL ENCABEZADO VA PEGADA DEBAJO DE LA PRIMERA al bajar por el cuadro.
    function fijarEncabezado() {
        var th = el('lr_t').tHead; if (!th || th.rows.length < 2) return;
        var alto = th.rows[0].getBoundingClientRect().height; if (!alto) return;
        Array.prototype.forEach.call(th.rows[1].cells, function (c) { c.style.top = alto + 'px'; });
    }
    /* EL DETALLE VA EN UN MODAL (Daniel, 19-sep-2026: "lo quiero en modal"): velo oscuro, ventana con su título y su
       botón de cerrar (la X). También cierra con Esc y con un clic fuera de la ventana. El detalle se baja la
       primera vez que se abre un modal: es lo más pesado del módulo. */
    var modal = document.createElement('div');
    modal.id = 'lr_modal'; modal.hidden = true;
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;' +
        'justify-content:center;padding:1rem';
    // A LA PÁGINA, no al módulo: ver la nota de los estilos. El de una visita anterior se quita.
    var viejo = document.getElementById('lr_modal'); if (viejo) viejo.remove();
    document.body.appendChild(modal);
    function cerrarModal() { modal.hidden = true; modal.innerHTML = ''; }
    modal.addEventListener('click', function (ev) { if (ev.target === modal || ev.target.closest('.lr-cerrar')) cerrarModal(); });
    ponerEsc();
    async function abrirModal(m, t, mod) {
        var mt = R.arbol.filter(function (a) { return a[0] === m; })[0], x = mt && mt[1].filter(function (y) { return y[0] === t; })[0];
        var o = x && x[2].filter(function (y) { return y[0] === mod; })[0]; if (!o) return;
        var v = totMod(o);
        var cab = '<div style="padding:.6rem .9rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:1rem;' +
            'align-items:flex-start;position:sticky;top:0;background:var(--panel-solid);z-index:3">' +
            '<div><div style="font-size:var(--t-md);font-weight:900;color:var(--text-strong)"><span class="cod">' + esc(o[0]) + '</span> ' + esc(o[1]) +
            ' <span style="font-weight:600;color:var(--li-tenue);font-size:var(--t-xs)">· ' + esc(o[2] || '') + '</span></div>' +
            '<div style="font-size:var(--t-xs);color:var(--li-tenue);margin-top:2px">Despachado en <b>' + NMES[m].toLowerCase() + '</b> a <b>' + t + ' ' +
            esc(nomT(t)) + '</b> · <span style="color:var(--text-main)">despachado <b>' + nf(v.desp) + '</b> · retornó <b>' + nf(v.dev) +
            '</b> (' + pct(v.dev, v.desp) + ') · en tránsito <b>' + nf(v.tr) + '</b> · ingresado <b>' + nf(v.dev - v.tr) + '</b></span></div></div>' +
            '<button class="lr-cerrar" aria-label="Cerrar" title="Cerrar (Esc)" style="font:inherit;font-size:18px;line-height:1;cursor:pointer;' +
            'border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--li-tenue);padding:3px 10px">×</button></div>';
        var ventana = function (cuerpo) {
            return '<div style="display:block;background:var(--panel-solid);border:1px solid var(--border);border-radius:16px;' +
                'max-width:96vw;width:auto;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">' + cab +
                '<div style="padding:.5rem .7rem .7rem">' + cuerpo + '</div></div>';
        };
        if (!DET) {
            modal.innerHTML = ventana('<div class="li-esperando"><i></i><span>Trayendo el detalle…</span></div>');
            modal.hidden = false;
            var d = null;
            try { d = await traer('li_retorno_det'); } catch (e) { d = null; }
            if (modal.hidden) return;                    // lo cerraron mientras llegaba
            if (!d || !d.det) { modal.innerHTML = ventana('<div class="vacio">No se pudo traer el detalle. Prueba de nuevo en un momento.</div>'); return; }
            DET = d.det;
        }
        modal.innerHTML = ventana(detalle(m, t, mod));
        modal.hidden = false;
    }
    function clic(ev) {
        var b = ev.target.closest('button.lr-todas');
        if (b) { S.todas[b.dataset.m] = !S.todas[b.dataset.m]; pintar(); return; }
        var tr = ev.target.closest('tr.abre'); if (!tr) return;
        var k = tr.dataset.k;
        if (tr.classList.contains('modal')) { abrirModal(k.substr(1, 7), k.substr(8, 5), k.substr(13)); return; }
        if (S.abiertas[k]) delete S.abiertas[k]; else S.abiertas[k] = 1; pintar();
    }
    el('lr_t').addEventListener('click', clic); el('lr_sin_t').addEventListener('click', clic);
    pintar();
}

/* ══ PESTAÑA 3 · DOBLE TRAMO ══════════════════════════════════════════════ */
const HTML_DOBLE = `
   <div class="li-top"><div>
    <p class="li-sub">Guías T que una tienda manda al CD para que las <b>reenvíe a otra tienda</b>. No entran al ASN:
     salen en el correo de comercial con prioridad <b>DOBLE TRAMO</b>, que dice a qué tienda van. El correo trae las
     unidades, no el SKU.</p></div></div>
   <div class="li-tarj" id="dt_tarj"></div>
   <div class="li-dos">
    <div class="li-pan"><div class="li-cab"><h3>Por mes</h3><p>mes del correo de comercial</p></div>
     <div class="li-sc"><table id="dt_mes_t"></table></div></div>
    <div class="li-pan"><div class="li-cab"><h3>Por tienda</h3><p>unidades que manda y que recibe</p></div>
     <div class="li-sc li-alto"><table id="dt_tien_t"></table></div><div class="li-mas" id="dt_tien_mas"></div></div>
   </div>
   <div class="li-pan"><div class="li-cab"><h3>De qué tienda a qué tienda</h3><p id="dt_par_p"></p></div>
    <div class="li-sc li-alto"><table id="dt_par_t"></table></div></div>`;

function parteDobleTramo(root, D) {
    const el = (id) => root.querySelector('#' + id);
    var T = D.tiendas, G = D.guias;   // guía: [T..., origen, destino, mes, unidades, etiqueta]
    var MESES = D.meses && D.meses.length ? D.meses : [...new Set(G.map((g) => g[3]))].sort();
    var NMES = {}; MESES.forEach(function (m) { NMES[m] = nombreMes(m); });
    var S = {abiertas: {}, todas: false};
    var nomT = function (t) { return '<b>' + t + '</b> ' + esc((T[t] || ['?'])[0]); };

    function pintar() {
        var uds = 0, mandan = {}, reciben = {}, remo = [0, 0];
        G.forEach(function (g) { uds += g[4]; mandan[g[1]] = 1; reciben[g[2]] = 1;
            if (/REMODEL/i.test(g[5])) { remo[0]++; remo[1] += g[4]; } });
        el('dt_tarj').innerHTML =
            tarj('', 'Guías doble tramo', nf(G.length), 'en los correos de comercial, ' +
                 (MESES.length ? NMES[MESES[0]].slice(0, 3).toLowerCase() + ' → ' + NMES[MESES[MESES.length - 1]].slice(0, 3).toLowerCase() : '')) +
            tarj('oj', 'Unidades', nf(uds), 'lo que dice el correo; no trae el SKU') +
            tarj('gr', 'Tiendas que mandan', nf(Object.keys(mandan).length), 'origen: la T de la guía') +
            tarj('ok', 'Tiendas que reciben', nf(Object.keys(reciben).length), 'destino: la tienda del correo') +
            (remo[0] ? tarj('ma', 'Por remodelación', nf(remo[1]), 'unidades en ' + nf(remo[0]) + ' guías') : '');

        var h = '<thead><tr><th>Mes del correo</th><th class="n">Guías</th><th class="n">Unidades</th>' +
                '<th class="n">Tiendas que mandan</th><th class="n">Tiendas que reciben</th></tr></thead><tbody>';
        var tg = 0, tu = 0;
        MESES.forEach(function (m) {
            var gs = G.filter(function (g) { return g[3] === m; }), u = 0, o = {}, d = {};
            gs.forEach(function (g) { u += g[4]; o[g[1]] = 1; d[g[2]] = 1; }); tg += gs.length; tu += u;
            h += '<tr><td class="k">' + NMES[m] + '</td><td class="n">' + nf(gs.length) + '</td><td class="n">' + nf(u) + '</td>' +
                 '<td class="n">' + nf(Object.keys(o).length) + '</td><td class="n">' + nf(Object.keys(d).length) + '</td></tr>';
        });
        el('dt_mes_t').innerHTML = h + '<tr class="total"><td>TOTAL</td><td class="n">' + nf(tg) + '</td><td class="n">' + nf(tu) +
            '</td><td class="n">' + nf(Object.keys(mandan).length) + '</td><td class="n">' + nf(Object.keys(reciben).length) + '</td></tr></tbody>';

        var pt = {};
        G.forEach(function (g) { (pt[g[1]] = pt[g[1]] || [0, 0])[0] += g[4]; (pt[g[2]] = pt[g[2]] || [0, 0])[1] += g[4]; });
        var ks = Object.keys(pt).sort(function (a, b) { return (pt[b][0] + pt[b][1]) - (pt[a][0] + pt[a][1]); });
        var vis = S.todas ? ks : ks.slice(0, 25), sm = 0, sr = 0;
        h = '<thead><tr><th>Tienda</th><th class="n">Manda</th><th class="n">Recibe</th><th class="n">Queda</th></tr></thead><tbody>';
        vis.forEach(function (t) { var x = pt[t], n = x[1] - x[0];
            h += '<tr><td>' + nomT(t) + '</td><td class="n' + (x[0] ? '' : ' z') + '">' + (x[0] ? nf(x[0]) : '–') + '</td>' +
                 '<td class="n' + (x[1] ? '' : ' z') + '">' + (x[1] ? nf(x[1]) : '–') + '</td>' +
                 '<td class="n ' + (n > 0 ? 'mas' : n < 0 ? 'menos' : 'z') + '">' + (n ? (n > 0 ? '+' : '−') + nf(Math.abs(n)) : '–') + '</td></tr>'; });
        ks.forEach(function (t) { sm += pt[t][0]; sr += pt[t][1]; });
        h += '<tr class="total"><td>TOTAL · ' + nf(ks.length) + ' tiendas</td><td class="n">' + nf(sm) + '</td><td class="n">' + nf(sr) +
             '</td><td class="n">–</td></tr></tbody>';
        el('dt_tien_t').innerHTML = h;
        el('dt_tien_mas').innerHTML = ks.length > 25 ? '<button id="dt_vermas">' +
            (S.todas ? 'ver solo las 25 que más mueven' : 'ver las ' + nf(ks.length) + ' tiendas') + '</button>' : '';
        if (el('dt_vermas')) el('dt_vermas').onclick = function () { S.todas = !S.todas; pintar(); };

        var pares = {};
        G.forEach(function (g) { var k = g[1] + '>' + g[2]; (pares[k] = pares[k] || []).push(g); });
        var pk = Object.keys(pares).map(function (k) { var u = 0; pares[k].forEach(function (g) { u += g[4]; }); return [k, u]; })
            .sort(function (a, b) { return b[1] - a[1]; });
        h = '<thead><tr><th>Manda</th><th>Recibe</th><th class="n">Guías</th><th class="n">Unidades</th></tr></thead><tbody>';
        pk.slice(0, 30).forEach(function (p) {
            var o = p[0].split('>'), ab = S.abiertas[p[0]];
            h += '<tr class="abre' + (ab ? ' abierta' : '') + '" data-k="' + p[0] + '"><td>' + nomT(o[0]) + '</td><td>' + nomT(o[1]) + '</td>' +
                 '<td class="n">' + nf(pares[p[0]].length) + '</td><td class="n">' + nf(p[1]) + '</td></tr>';
            if (ab) pares[p[0]].forEach(function (g) {
                h += '<tr class="n3"><td class="cod">' + g[0] + '</td><td class="m">' + (NMES[g[3]] || g[3]) + (g[5] && g[5] !== 'VARIOS' ? ' · ' + esc(g[5]) : '') +
                     '</td><td></td><td class="n">' + nf(g[4]) + '</td></tr>'; });
        });
        el('dt_par_t').innerHTML = h + '</tbody>';
        el('dt_par_p').textContent = nf(pk.length) + ' recorridos distintos · los 30 más grandes · clic para ver sus guías';
    }
    el('dt_par_t').addEventListener('click', function (ev) {
        var tr = ev.target.closest('tr.abre'); if (!tr) return;
        var k = tr.dataset.k; if (S.abiertas[k]) delete S.abiertas[k]; else S.abiertas[k] = 1; pintar();
    });
    pintar();
}

/* ══ PESTAÑA 4 · PRODUCCIÓN L.I ═══════════════════════════════════════════ */
const HTML_PRODUCCION = `
   <div class="li-top"><div>
    <p class="li-sub">Lo que recepción <b>ingresa</b> de logística inversa: cada guía T que se verifica en el WMS, quién la
     verificó y a qué hora. El WMS guarda <b>una sola hora por guía</b> —cuando se cierra—, así que la guía entera cae en esa hora.</p></div>
    <div><input type="date" id="pl_fecha"></div></div>
   <div class="li-tarj" id="pl_tarj"></div>
   <div class="li-pan"><div class="li-cab"><h3>El turno, hora por hora</h3><p>calzado en pares; lo demás en unidades</p></div>
    <div class="li-sc"><table id="pl_horas_t"></table></div></div>
   <div class="li-pan"><div class="li-cab"><h3>Ingreso por hora</h3></div>
    <div class="li-selec" id="pl_sel"></div>
    <div class="li-sc"><table id="pl_mtz_t"></table></div></div>
   <div class="li-dos">
    <div class="li-pan"><div class="li-cab"><h3>Ingreso por mes</h3><p id="pl_mes_p"></p></div>
     <div class="li-sc"><table id="pl_mes_t"></table></div></div>
    <div class="li-pan"><div class="li-cab"><h3>Ingreso por semana</h3><p>de lunes a domingo, la más nueva arriba</p></div>
     <div class="li-sc li-alto"><table id="pl_sem_t"></table></div></div>
   </div>
   <div class="li-pan"><div class="li-cab"><h3>Qué se ingresó</h3><p>colección, marca y gender</p></div>
    <div class="li-selec" id="pl_per"></div>
    <div class="li-tres">
     <div class="li-sc li-alto"><table id="pl_col_t"></table></div>
     <div class="li-sc li-alto"><table id="pl_mar_t"></table></div>
     <div class="li-sc li-alto"><table id="pl_gen_t"></table></div>
    </div></div>`;

function parteProduccion(root, P) {
    const el = (id) => root.querySelector('#' + id);
    var EV = P.ev;   // guía: [ASN, usuario, 'AAAA-MM-DD HH:MM:SS', calzado, no calzado, líneas]
    var MESES = P.meses && P.meses.length ? P.meses : Object.keys(P.res).filter(function (m) { return m !== 'Todo'; }).sort();
    var NMES = {}; MESES.forEach(function (m) { NMES[m] = nombreMes(m); });
    var PAUSA = 30 * 60, REFRI = 60 * 60, MIN_CELDA = 5 * 60, CORTA = 60 * 60;
    var S = {dia: '', ver: 'vol', clase: 't', per: 'Todo'};
    var seg = function (s) { return (+s.slice(11, 13)) * 3600 + (+s.slice(14, 16)) * 60 + (+s.slice(17, 19)); };
    var uds = function (e) { return S.clase === 'c' ? e[3] : S.clase === 'n' ? e[4] : e[3] + e[4]; };
    var DIAS = [...new Set(EV.map(function (e) { return e[2].slice(0, 10); }))].sort();
    if (!DIAS.length) { root.insertAdjacentHTML('afterbegin', '<div class="vacio">Todavía no hay guías T verificadas.</div>'); return; }
    S.dia = DIAS[DIAS.length - 1];
    el('pl_mes_p').textContent = 'del ' + dd(DIAS[0]).slice(0, 5) + ' al ' + dd(DIAS[DIAS.length - 1]).slice(0, 5);

    el('pl_fecha').value = S.dia; el('pl_fecha').min = DIAS[0]; el('pl_fecha').max = DIAS[DIAS.length - 1];
    el('pl_fecha').onchange = function () { if (this.value) { S.dia = this.value; pintarDia(); } };
    el('pl_sel').innerHTML = '<span class="li-rot">Ver</span>' +
        [['vol', 'Volumen'], ['ef', 'Efectividad']].map(function (o) { return '<button data-k="ver" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') +
        '<span class="div"></span><span class="li-rot">Clase</span>' +
        [['t', 'Todo'], ['c', 'Calzado'], ['n', 'No calzado']].map(function (o) { return '<button data-k="clase" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('');
    el('pl_sel').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; S[b.dataset.k] = b.dataset.v; pintarDia(); });
    el('pl_per').innerHTML = '<span class="li-rot">Período</span>' + [['Todo', 'Todo']].concat(MESES.map(function (m) { return [m, NMES[m]]; }))
        .map(function (o) { return '<button data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('');
    el('pl_per').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; S.per = b.dataset.v; pintarQue(); });

    /* EL TIEMPO TRABAJADO, la misma regla que Picking y Embalaje por día (Daniel, 17-sep-2026): el reloj va de la
       primera guía cerrada a la última; una pausa de menos de 30 min es trabajo; de las de 30 o más se descuenta el
       refrigerio, hasta 60 min en el día, empezando por la más larga. Cada rato se lo lleva la guía que se cierra
       después, y se reparte entre calzado y no calzado según sus unidades. */
    function tiempos(evs) {
        var t = evs.map(function (e) { return seg(e[2]); }), out = evs.map(function () { return [0, 0]; });
        var huecos = []; for (var i = 1; i < t.length; i++) huecos.push([t[i] - t[i - 1], i]);
        var desc = {}, resto = REFRI;
        huecos.filter(function (h) { return h[0] >= PAUSA; }).sort(function (a, b) { return b[0] - a[0]; })
            .forEach(function (h) { if (resto <= 0) return; desc[h[1]] = Math.min(h[0], resto); resto -= desc[h[1]]; });
        huecos.forEach(function (h) { var i = h[1], d = h[0] - (desc[i] || 0), e = evs[i], tot = e[3] + e[4];
            out[i] = tot ? [d * e[3] / tot, d * e[4] / tot] : [d / 2, d / 2]; });
        return out;
    }
    var tDe = function (x) { return S.clase === 'c' ? x[0] : S.clase === 'n' ? x[1] : x[0] + x[1]; };
    function nz(v) { return '<td class="n' + (v ? '' : ' z') + '">' + (v ? nf(v) : '–') + '</td>'; }

    function pintarDia() {
        root.querySelectorAll('#pl_sel button').forEach(function (b) { b.setAttribute('aria-pressed', String(S[b.dataset.k] === b.dataset.v)); });
        var evs = EV.filter(function (e) { return e[2].slice(0, 10) === S.dia; });
        if (!evs.length) {
            el('pl_tarj').innerHTML = ''; el('pl_horas_t').innerHTML = '<tr><td class="vacio">Ese día no se ingresó ninguna guía de logística inversa.</td></tr>';
            el('pl_mtz_t').innerHTML = ''; return;
        }
        var porH = {}, gente = {};
        evs.forEach(function (e) { var h = +e[2].slice(11, 13);
            var x = porH[h] = porH[h] || {g: 0, c: 0, n: 0, p: {}}; x.g++; x.c += e[3]; x.n += e[4]; x.p[e[1]] = 1;
            (gente[e[1]] = gente[e[1]] || []).push(e); });
        var hs = Object.keys(porH).map(Number).sort(function (a, b) { return a - b; });
        var HORAS = []; for (var h = hs[0]; h <= hs[hs.length - 1]; h++) HORAS.push(h);
        var tc = 0, tn = 0, pico = hs[0];
        hs.forEach(function (h) { tc += porH[h].c; tn += porH[h].n; if (porH[h].c + porH[h].n > porH[pico].c + porH[pico].n) pico = h; });
        el('pl_tarj').innerHTML =
            tarj('', 'Ingresado', nf(tc + tn), 'unidades · ' + dd(S.dia)) + tarj('ok', 'Calzado', nf(tc), 'pares') +
            tarj('oj', 'No calzado', nf(tn), 'unidades: cajas H30, bolsas, accesorios') + tarj('gr', 'Guías', nf(evs.length), 'guías T verificadas') +
            tarj('', 'Personas', nf(Object.keys(gente).length), 'verificaron ese día') +
            tarj('ma', 'Hora pico', String(pico).padStart(2, '0') + ':00', nf(porH[pico].c + porH[pico].n) + ' unidades en ' + nf(porH[pico].g) + ' guías');

        var h1 = '<thead><tr><th>Hora</th><th class="n">Guías</th><th class="n">Calzado</th><th class="n">No calzado</th>' +
            '<th class="n">Unidades</th><th class="n">Personas</th><th class="n">Unidades/persona</th></tr></thead><tbody>';
        HORAS.forEach(function (h) { var x = porH[h] || {g: 0, c: 0, n: 0, p: {}}, np = Object.keys(x.p).length, u = x.c + x.n;
            h1 += '<tr><td class="k">' + String(h).padStart(2, '0') + ':00</td>' + nz(x.g) + nz(x.c) + nz(x.n) + nz(u) + nz(np) +
                  nz(np ? u / np : 0) + '</tr>'; });
        el('pl_horas_t').innerHTML = h1 + '<tr class="total"><td>TOTAL</td><td class="n">' + nf(evs.length) + '</td><td class="n">' + nf(tc) +
            '</td><td class="n">' + nf(tn) + '</td><td class="n">' + nf(tc + tn) + '</td><td class="n">' + nf(Object.keys(gente).length) + '</td><td class="n">–</td></tr></tbody>';

        var filas = Object.keys(gente).map(function (u) {
            var l = gente[u].sort(function (a, b) { return a[2] < b[2] ? -1 : 1; }), tt = tiempos(l), c = {}, tseg = 0, un = 0;
            l.forEach(function (e, i) { var h = +e[2].slice(11, 13), x = c[h] = c[h] || [0, 0]; x[0] += uds(e); x[1] += tDe(tt[i]); tseg += tDe(tt[i]); un += uds(e); });
            return {u: u, c: c, un: un, t: tseg, ritmo: tseg >= MIN_CELDA ? un / (tseg / 3600) : null};
        }).filter(function (f) { return f.un > 0; }).sort(function (a, b) { return b.un - a.un; });
        var ef = S.ver === 'ef';
        var h2 = '<thead><tr><th class="n">#</th><th>Persona</th>' + HORAS.map(function (h) { return '<th class="n">' + String(h).padStart(2, '0') + '</th>'; }).join('') +
            '<th class="n">Unidades</th><th class="n">U/H</th><th class="n">Min</th></tr></thead><tbody>';
        filas.forEach(function (f, i) {
            h2 += '<tr><td class="n m">' + (i + 1) + '</td><td class="k cod">' + esc(f.u) + (f.t < CORTA ? ' <span class="eti eti-C">corta</span>' : '') + '</td>' +
                HORAS.map(function (h) { var x = f.c[h]; if (!x || !x[0]) return '<td class="n z">–</td>';
                    if (!ef) return '<td class="n">' + nf(x[0]) + '</td>';
                    return x[1] >= MIN_CELDA ? '<td class="n">' + nf(x[0] / (x[1] / 3600)) + '</td>' : '<td class="n z">–</td>'; }).join('') +
                '<td class="n k">' + nf(f.un) + '</td><td class="n' + (f.ritmo ? '' : ' z') + '">' + (f.ritmo ? nf(f.ritmo) : '–') + '</td>' +
                '<td class="n m">' + nf(f.t / 60) + '</td></tr>';
        });
        var col = function (h) { var v = filas.map(function (f) { var x = f.c[h]; if (!x || !x[0]) return null;
            return ef ? (x[1] >= MIN_CELDA ? x[0] / (x[1] / 3600) : null) : x[0]; }).filter(function (x) { return x != null; });
            if (!v.length) return null; var s = v.reduce(function (a, b) { return a + b; }, 0); return ef ? s / v.length : s; };
        var rit = filas.map(function (f) { return f.ritmo; }).filter(Boolean);
        h2 += '<tr class="total"><td></td><td>TOTAL</td>' + HORAS.map(function (h) { var x = col(h); return '<td class="n' + (x ? '' : ' z') + '">' + (x ? nf(x) : '–') + '</td>'; }).join('') +
            '<td class="n">' + nf(filas.reduce(function (a, f) { return a + f.un; }, 0)) + '</td><td class="n">' +
            (rit.length ? nf(rit.reduce(function (a, b) { return a + b; }, 0) / rit.length) : '–') + '</td><td class="n">–</td></tr></tbody>';
        el('pl_mtz_t').innerHTML = h2;
    }

    function lunes(d) { var x = new Date(d + 'T12:00:00'), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
    var iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    function agrupar(clave) {
        var g = {};
        EV.forEach(function (e) { var k = clave(e[2].slice(0, 10)), x = g[k] = g[k] || {g: 0, c: 0, n: 0, d: {}, p: {}};
            x.g++; x.c += e[3]; x.n += e[4]; x.d[e[2].slice(0, 10)] = 1; x.p[e[1]] = 1; });
        return g;
    }
    function tablaPer(id, titulo, g, ord, nombre) {
        var h = '<thead><tr><th>' + titulo + '</th><th class="n">Guías</th><th class="n">Unidades</th><th class="n">Calzado</th>' +
            '<th class="n">No calzado</th><th class="n">Días</th><th class="n">Por día</th><th class="n">Personas</th></tr></thead><tbody>';
        var t = {g: 0, c: 0, n: 0, d: {}, p: {}};
        ord.forEach(function (k) { var x = g[k]; if (!x) return; var nd = Object.keys(x.d).length;
            t.g += x.g; t.c += x.c; t.n += x.n; Object.assign(t.d, x.d); Object.assign(t.p, x.p);
            h += '<tr><td class="k">' + nombre(k) + '</td><td class="n">' + nf(x.g) + '</td><td class="n k">' + nf(x.c + x.n) + '</td><td class="n">' + nf(x.c) +
                 '</td><td class="n">' + nf(x.n) + '</td><td class="n">' + nd + '</td><td class="n">' + nf((x.c + x.n) / nd) + '</td><td class="n">' +
                 Object.keys(x.p).length + '</td></tr>'; });
        var nd = Object.keys(t.d).length;
        el(id).innerHTML = h + '<tr class="total"><td>TOTAL</td><td class="n">' + nf(t.g) + '</td><td class="n">' + nf(t.c + t.n) + '</td><td class="n">' + nf(t.c) +
            '</td><td class="n">' + nf(t.n) + '</td><td class="n">' + nd + '</td><td class="n">' + (nd ? nf((t.c + t.n) / nd) : '–') + '</td><td class="n">' + Object.keys(t.p).length + '</td></tr></tbody>';
    }
    tablaPer('pl_mes_t', 'Mes', agrupar(function (d) { return d.slice(0, 7); }), MESES, function (k) { return NMES[k]; });
    var sem = agrupar(function (d) { return iso(lunes(d)); });
    tablaPer('pl_sem_t', 'Semana', sem, Object.keys(sem).sort().reverse(), function (k) {
        var a = new Date(k + 'T12:00:00'), b = new Date(a); b.setDate(b.getDate() + 6);
        var t = new Date(a); t.setDate(t.getDate() + 3); var y = new Date(t.getFullYear(), 0, 4);
        var n = 1 + Math.round(((t - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7);
        return 'Sem ' + n + '<br><span class="m" style="font-weight:600;font-size:var(--t-xs)">' + dd(iso(a)).slice(0, 5) + ' – ' + dd(iso(b)).slice(0, 5) + '</span>'; });

    function pintarQue() {
        root.querySelectorAll('#pl_per button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === S.per)); });
        var r = P.res[S.per] || {col: [], mar: [], gen: []};
        [['pl_col_t', 'col', 'Colección PO'], ['pl_mar_t', 'mar', 'Marca'], ['pl_gen_t', 'gen', 'Gender']].forEach(function (x) {
            var l = r[x[1]], tot = l.reduce(function (a, y) { return a + y[1]; }, 0), tc = l.reduce(function (a, y) { return a + y[2]; }, 0);
            var h = '<thead><tr><th>' + x[2] + '</th><th class="n">Unidades</th><th class="n">%</th><th class="n">Calzado</th></tr></thead><tbody>';
            l.forEach(function (y) { h += '<tr><td class="k">' + esc(y[0]) + '</td><td class="n">' + nf(y[1]) + '</td><td class="n">' +
                (tot ? (100 * y[1] / tot).toFixed(1) + '%' : '–') + '</td>' + nz(y[2]) + '</tr>'; });
            el(x[0]).innerHTML = h + '<tr class="total"><td>TOTAL</td><td class="n">' + nf(tot) + '</td><td class="n">' + (tot ? '100%' : '–') +
                '</td><td class="n">' + nf(tc) + '</td></tr></tbody>';
        });
    }
    pintarDia(); pintarQue();
}

/* ══ LA PUERTA DE ENTRADA ═════════════════════════════════════════════════ */
const PARTES = {
    li_vuelve: [HTML_VUELVE, parteVuelve, 'las guías T del ASN'],
    li_retorno: [HTML_RETORNO, parteRetorno, 'lo despachado y lo que retornó'],
    li_doble_tramo: [HTML_DOBLE, parteDobleTramo, 'las guías de doble tramo'],
    li_produccion: [HTML_PRODUCCION, parteProduccion, 'lo que ingresó recepción'],
};

/**
 * Dibuja UNA pestaña del módulo dentro de `cont`.
 * @param {HTMLElement} cont   donde se dibuja (el #areaContent del módulo)
 * @param {{parte: string}} OPC  la sub-pestaña: li_vuelve, li_retorno, li_doble_tramo o li_produccion
 */
export async function montarLogisticaInversa(cont, OPC = {}) {
    ponerEstilos();
    const parte = PARTES[OPC.parte] ? OPC.parte : 'li_vuelve';
    const [html, dibujar, que] = PARTES[parte];
    cont.innerHTML = '<div id="li">' + esperando('Trayendo ' + que + '…') + '</div>';
    const root = cont.querySelector('#li');
    let datos = null;
    try { datos = await traer(parte); } catch (e) { console.warn('[LOGÍSTICA INVERSA] no se pudo traer', parte, e); }
    if (!root.isConnected) return;                   // se cambió de pestaña mientras llegaba
    if (!datos) {
        root.innerHTML = '<div class="li-pan"><div class="vacio">Todavía no hay datos publicados. Los arma el robot detrás del ' +
            'ASN, cada mañana.</div></div>';
        return;
    }
    root.innerHTML = html;
    dibujar(root, datos);
}
