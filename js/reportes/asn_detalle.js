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

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/* NADA DE toISOString(): devuelve UTC y adelanta el día a las 19:00, justo cuando
   entra el turno noche. Acá se compara texto 'AAAA-MM-DD' contra texto, que para
   fechas ISO ordena igual que el calendario, y el 'hoy' lo manda el tablero con
   getLogicalDate(). */
const comoFecha = (iso) => {
    const q = String(iso || '').split('-').map(Number);
    return new Date(q[0], (q[1] || 1) - 1, q[2] || 1);
};
const diasEntre = (a, b) => Math.round((comoFecha(b) - comoFecha(a)) / 86400000);
const diaLargo = (iso) => {
    const d = comoFecha(iso);
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
};
const diaCorto = (iso) => {
    const d = comoFecha(iso);
    return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
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
/* ── LA REJILLA ──────────────────────────────────────────────────────────────
   Dos cuadros por fila cuando entran. `auto-fit` con un minimo de 560px hace que
   en una pantalla angosta vuelvan a apilarse solos, sin media queries.
   `align-items:start` es lo que evita que un cuadro corto se estire para igualar
   al de al lado y quede con un hueco abajo. */
/* `columns` Y NO UNA REJILLA. Con dos columnas de rejilla la fila mide lo que el
   cuadro mas alto, y el corto deja un AGUJERO debajo — que es justo lo que Daniel
   senalo: *"como vas a dejar espacios en blanco asi"*. Con `columns` los cuadros
   se acomodan uno tras otro y no queda aire.
   `break-inside:avoid` es lo que impide que un cuadro salga partido a la mitad. */
'#asn .a-rejilla { columns:2; column-gap:18px; }',
'#asn .a-rejilla > .a-caja { break-inside:avoid; -webkit-column-break-inside:avoid; margin-bottom:18px; }',
'@media (max-width:1100px) { #asn .a-rejilla { columns:1; } }',
/* El que necesita el ancho entero se lo lleva: la lista de articulos, los
   parciales, y CUALQUIERA que tenga su detalle abierto. */
/* Los anchos NO entran al empaquetado: se dibujan aparte, a todo lo ancho. */
'#asn .a-ancho-fila { margin-bottom:18px; }',
/* ── QUE LOS NUMEROS NO SE ESTIREN ───────────────────────────────────────────
   Con `width:100%` y seis columnas, el navegador reparte el sobrante entre todas
   y deja huecos enormes entre cifras que hay que comparar de un vistazo. Ahora
   las columnas de numeros se ajustan a su contenido y el sobrante se lo lleva la
   primera, que es la que lleva texto largo. */
'#asn td, #asn th { width:1%; white-space:nowrap; }',
'#asn td:first-child, #asn th:first-child { width:auto; white-space:normal; }',
/* EN EL CALENDARIO EL SOBRANTE NO VA A LA PRIMERA COLUMNA. Ahi la primera es una
   fecha corta: dejarle el sobrante abria un hueco entre "viernes 4" y la fecha de
   entrada, que son justo las dos que hay que leer juntas. Se lo lleva la columna
   de marcas, que es la unica de texto largo. */
'#asn table.a-cal td:first-child, #asn table.a-cal th:first-child { width:1%; white-space:nowrap; }',
'#asn table.a-cal td.a-marcas, #asn table.a-cal th.a-marcas { width:auto; white-space:normal; }',
'#asn .a-tarjetas { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-bottom:18px; }',
'#asn .a-t { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; padding:1rem 1.1rem; }',
'#asn .a-t .et { font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); font-weight:800; }',
'#asn .a-t .n { font-size:1.7rem; font-weight:800; margin:.25rem 0 .1rem; font-variant-numeric:tabular-nums; }',
'#asn .a-t .p { font-size:var(--t-xs); color:var(--text-muted); }',
'#asn .a-barrita { height:8px; border-radius:99px; overflow:hidden; display:flex; background:rgba(var(--ink-rgb),.08); margin-top:.5rem; }',
'#asn .a-ya { color:var(--danger); font-weight:800; }',
'#asn .a-pronto { color:var(--warning); font-weight:800; }',
'#asn .a-lejos { color:var(--text-muted); }',
'#asn .a-marcas { color:var(--text-muted); text-align:left; font-size:10.5px; }',
].join('\n');

/* Lo que se está mirando. Es de módulo para que sobreviva al redibujado. */
let _mes = null;          // el mes abierto en "mes a mes"
let _buscaArt = '';
let _buscaPar = '';
let _marca = '';
let _dia = null;
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

    /* Las descripciones dejaron de repetirse en cada fila -eran la mitad del
       peso- y viven en `p.desc`. El respaldo `a.desc` es para el paquete viejo,
       que sigue publicado hasta que el robot vuelva a correr. */
    const DSC = p.desc || {};
    const dsc = (a) => (a && a.desc) || DSC[a && a.cod] || '';

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

    // =========================================================================
    // CUANDO LLEGA - lo primero, porque es sobre lo que se prepara el almacen
    // =========================================================================
    //
    // Daniel, 03-sep-2026: *"necesito saber la fecha aproximada en que va a llegar
    // y los SKU y marcas, porque si no, no puedo preparar el almacen. El SKU X va
    // a llegar el quince de septiembre, entonces yo ya se"*.
    //
    // SE MUESTRA LO VENCIDO AL LADO, SIEMPRE. Medido el 03-sep: el 37,6% del
    // pendiente tiene la fecha YA PASADA. Un calendario solo, sin ese numero, se
    // lee como una promesa, y mas de un tercio de las veces no se cumple.
    const CL = p.cuandoLlega;
    /* El paquete viejo no trae la fecha de entrada. Sin este guardian, la columna
       saldria vacia y la tabla quedaria descuadrada hasta la proxima corrida. */
    const hayEntra = !!(CL && CL.dias && CL.dias.length && CL.dias[0].entra);
    const hayCuando = !!(CL && CL.dias && CL.dias.length);
    const hoy = (O.hoy || (CL && CL.hoy) || '');

    /* La celda CUANDO del cuadro de articulos. Sin fecha NO se pone un guion
       suelto: se dice que no la anuncia, que es distinto de que no llegue. */
    const cuandoLlegaEste = (iso) => {
        if (!iso) return '<span class="a-desc">no la anuncia</span>';
        const f = hoy ? diasEntre(hoy, iso) : null;
        const cl = f === null ? '' : f <= 2 ? 'a-ya' : f <= 7 ? 'a-pronto' : 'a-lejos';
        return '<span class="' + cl + '">' + esc(diaCorto(iso)) + '</span>';
    };

    if (hayCuando) {
        const fut = CL.futuro || 0, ven = CL.vencido || 0;
        const tot = fut + ven;
        const pF = tot ? (100 * fut / tot) : 0;
        const cerca = CL.dias.filter(d => hoy && diasEntre(hoy, d.dia) <= 7);

        T.push('<div class="a-tarjetas">'
        + '<div class="a-t"><div class="et">Con fecha por delante</div>'
          + '<div class="n" style="color:var(--success);">' + nf(fut) + '</div>'
          + '<div class="p">' + n1(pF) + '% del pendiente · ' + CL.dias.length + ' días con llegadas</div>'
          + '<div class="a-barrita"><div style="width:' + pF + '%; background:var(--success);"></div>'
          + '<div style="width:' + (100 - pF) + '%; background:var(--danger);"></div></div></div>'
        + '<div class="a-t"><div class="et">Fecha ya vencida</div>'
          + '<div class="n" style="color:var(--danger);">' + nf(ven) + '</div>'
          + '<div class="p">' + n1(100 - pF) + '% · debió llegar y no llegó</div></div>'
        + '<div class="a-t"><div class="et">Llega en los próximos 7 días</div>'
          + '<div class="n">' + nf(cerca.reduce((a, d) => a + d.u, 0)) + '</div>'
          + '<div class="p">en ' + nf(cerca.length) + ' días con llegada</div></div>'
        + '</div>');

        /* SIEMPRE A LO ANCHO: es el de siete columnas y 33 dias, el mas denso de todos,
   y ademas deja a los otros cuatro emparejados de a dos sin que sobre ninguno. */
        T.push('<div class="a-caja caja-pbi a-ancho-fila"><div class="a-cab tapa-pbi"><h3>Cuándo llega</h3>'
        + '<span class="nota">'
        + (hayEntra ? '<b>anunciado</b> y cuándo suele <b>entrar</b>' : 'la fecha la anuncia el ASN')
        + ' · <b>haz clic en un día</b> para ver los artículos</span></div>'
        + '<div class="a-scroll"><table class="a-cal rep-pbi"><thead><tr>'
        + '<th>Anunciado</th>'
        + (hayEntra ? '<th>Suele entrar</th>' : '')
        + '<th>Falta</th><th>Unidades</th><th>Artículos</th>'
        + '<th class="a-marcas" style="text-align:left;">Marcas</th><th></th>'
        + '</tr></thead><tbody>'
        + CL.dias.map(d => {
            const f = hoy ? diasEntre(hoy, d.dia) : null;
            const cl = f === null ? '' : f <= 2 ? 'a-ya' : f <= 7 ? 'a-pronto' : 'a-lejos';
            const cu = f === null ? '' : f <= 0 ? 'hoy' : f === 1 ? 'mañana' : 'en ' + f + ' días';
            return '<tr class="a-clic' + (d.dia === _dia ? ' a-viva' : '') + '" '
              + 'onclick="window.__asnDia(&quot;' + d.dia + '&quot;)">'
              + '<td>' + esc(diaLargo(d.dia)) + '</td>'
              + (hayEntra ? '<td style="text-align:left; color:var(--text-strong); font-weight:700;">'
                  + esc(diaLargo(d.entra))
                  + '<br><span class="a-desc">+' + d.demora + ' días</span></td>' : '')
              + '<td class="' + cl + '">' + cu + '</td>'
              + '<td style="font-weight:800; color:var(--text-strong);">' + nf(d.u) + '</td>'
              + '<td>' + nf(d.n) + '</td>'
              + '<td class="a-marcas">' + (d.marcas || []).slice(0, 3)
                  .map(m => esc(m.m) + ' ' + nf(m.u)).join(' · ')
              + ((d.marcas || []).length > 3 ? ' +' + (d.marcas.length - 3) : '') + '</td>'
              + '<td style="color:var(--text-muted);">' + (d.dia === _dia ? '▼ abierto' : 'ver ▸')
              + '</td></tr>';
          }).join('')
        + '<tr class="gran-tot" style="border-top:2px solid var(--border); font-weight:800;">'
        + '<td>Total</td>' + (hayEntra ? '<td></td>' : '') + '<td></td>'
        + '<td style="color:var(--text-strong);">' + nf(CL.dias.reduce((a, d) => a + d.u, 0)) + '</td>'
        + '<td></td><td></td><td></td></tr>'
        + '</tbody></table></div>'
        /* LO ANUNCIADO NO ES LO QUE BAJA DEL CAMION ESE DIA, y decirlo importa:
           Daniel, 03-sep-2026: *"si la orden dice 142 mil y solo hay 25 mil, esta
           mandando un parcial. No es que de golpe te mande los 142.597, te va a
           estar mandando parciales"*. Sin este pie, el cuadro se lee como una
           promesa de descarga y con eso se arma la gente de un turno. */
        + (hayEntra ? '<div class="a-pie">Las unidades son <b>la orden completa</b>, '
            + 'no lo que baja del camión ese día: el proveedor manda <b>parciales</b>. '
            + 'La columna «suele entrar» sale de medir '
            + '<b>1,3 millones</b> de líneas ya recibidas — mediana de '
            /* Los nombres se escriben acentuados: las claves del paquete van sin
               tilde -son identificadores- pero lo que se lee no. */
            + [['importacion', 'importación'], ['nacional', 'nacional']]
                .filter(x => (CL.demoraDias || {})[x[0]])
                .map(x => CL.demoraDias[x[0]] + ' días la ' + x[1]).join(' y ')
            + '. Solo el 8% entra antes de la fecha anunciada.</div>' : '')
        + '');

        const D = _dia ? CL.dias.find(x => x.dia === _dia) : null;
        if (D) {
            T.push('<div class="a-cab tapa-pbi" style="border-top:1px solid var(--border);">'
            + '<h3>Qué llega el ' + esc(diaLargo(D.dia)) + '</h3>'
            + '<span class="nota">' + (D.completo ? 'los ' + nf(D.n) + ' artículos'
                : nf(D.top.length) + ' de ' + nf(D.n) + ' artículos · los de mayor cantidad')
            + '</span></div>'
            + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
            + '<th>Artículo</th><th style="text-align:left;">Marca</th><th>Unidades</th>'
            + '</tr></thead><tbody>'
            + D.top.map(a => '<tr><td>' + esc(a.cod)
                + (dsc(a) ? '<br><span class="a-desc">' + esc(dsc(a)) + '</span>' : '')
                + '</td><td style="text-align:left;">' + esc(a.marca || '') + '</td>'
                + '<td style="font-weight:800; color:var(--text-strong);">' + nf(a.u) + '</td></tr>').join('')
            + '</tbody></table></div>'
            + '<div class="a-pie">'
            + (D.completo
                ? 'Están los <b>' + nf(D.n) + '</b> artículos del día y suman <b>' + nf(D.u) + '</b> unidades.'
                : 'Estos <b>' + nf(D.top.length) + '</b> suman <b>'
                  + nf(D.top.reduce((a, x) => a + x.u, 0)) + '</b> de las ' + nf(D.u)
                  + ' del día; quedan <b>' + nf(D.n - D.top.length) + '</b> artículos más. '
                  + 'Los días de aquí a ' + (CL.diasCerca || 14) + ' vienen completos.')
            + '</div>');
        }
        T.push('</div>');

        /* AQUI ARRANCA EL EMPAQUETADO: el calendario va a lo ancho -siete columnas
           y 33 dias- y los cuatro cuadros chicos se acomodan de a dos. */
        T.push('<div class="a-rejilla">');

        // -- lo vencido -------------------------------------------------------
        const ed = CL.vencidoEdad || {};
        const ORD = [['1a7', 'Hace 1 a 7 días', 'puede caer cualquier día — hay que preverlo'],
                     ['8a30', 'Hace 8 a 30 días', 'atrasado, conviene preguntar'],
                     ['31a90', 'Hace 31 a 90 días', 'muy atrasado'],
                     ['mas90', 'Hace más de 90 días', 'ASN colgado: o se perdió o nadie lo cerró']];
        const filas = ORD.filter(x => ed[x[0]]);
        if (filas.length) {
            T.push('<div class="a-caja caja-pbi"><div class="a-cab tapa-pbi"><h3>Lo que debió llegar y no llegó</h3>'
            + '<span class="nota">' + nf(ven) + ' unidades en ' + nf(CL.lineasVencido)
            + ' líneas con la fecha ya pasada</span></div>'
            + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
            + '<th>Se anunció</th><th>Unidades</th><th style="text-align:left;">Qué significa</th>'
            + '</tr></thead><tbody>'
            + filas.map(x => '<tr><td>' + x[1] + '</td>'
                + '<td style="font-weight:800; color:var(--text-strong);">' + nf(ed[x[0]]) + '</td>'
                + '<td style="text-align:left;" class="a-desc">' + x[2] + '</td></tr>').join('')
            + '<tr class="gran-tot" style="border-top:2px solid var(--border); font-weight:800;">'
            + '<td>Total</td><td style="color:var(--text-strong);">'
            + nf(filas.reduce((a, x) => a + ed[x[0]], 0)) + '</td><td></td></tr>'
            + '</tbody></table></div>'
            /* EL DESCUADRE CONTRA "MES A MES" SE DICE ACA, no se esconde: Daniel
               suma las filas y lo iba a encontrar. Aca cada LINEA cuenta con su
               propia fecha; alla cada ARTICULO se suma entero, y los recibidos de
               mas dentro de un mismo articulo se cancelan. */
            + '<div class="a-pie"><b>' + nf(fut) + '</b> por llegar + <b>' + nf(ven)
            + '</b> vencido = <b>' + nf(tot) + '</b>. El cuadro «Mes a mes» dice <b>'
            /* No se puede usar `sumar`: se declara mas abajo, en el bloque de MES A
               MES, y en la zona muerta del const revienta. Lo caza EJECUTAR la
               pantalla, no el chequeo de sintaxis. */
            + nf(Object.values(p.porMes || {}).reduce(
                  (a, m) => a + (Number(m.faltaBruta != null ? m.faltaBruta : m.falta) || 0), 0))
            + '</b> porque allá cada artículo se '
            + 'suma entero y acá cada línea cuenta con su propia fecha.</div></div>');
        }
    }

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

    T.push('<div class="a-caja caja-pbi' + (_mes ? ' a-ancho' : '') + '"><div class="a-cab tapa-pbi"><h3>Mes a mes</h3>'
    /* POR FECHA DE CREACION, que es como agrupa el robot -un archivo por mes- y
       como ya lo decia el cuadro de arriba. El rotulo decia "por fecha de envio"
       porque asi lo habia agrupado la medicion de prueba, y dos cuadros pegados
       diciendo cosas distintas del mismo dato es peor que no ponerle rotulo. */
    + '<span class="nota">por fecha de creación · <b>haz clic en un mes</b> para ver qué falta</span></div>'
    /* LAS TRES COLUMNAS TIENEN QUE CERRAR ENTRE SI, y la fila de TOTAL esta para
       que se pueda comprobar sin sacar la calculadora:  falta = bruta - sobra.
       Daniel suma las filas; si una no cierra, cae el reporte entero. */
    + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
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
    + '<tr class="gran-tot" style="border-top:2px solid var(--border); font-weight:800;">'
    + '<td>Total</td><td></td>'
    + (hayBruta ? '<td>' + nf(sumar('faltaBruta')) + '</td>' : '')
    + (haySobra ? '<td class="a-ok">−' + nf(sumar('sobra')) + '</td>' : '')
    + '<td class="a-falta">' + nf(sumar('falta')) + '</td><td></td></tr>'
    + '</tbody></table></div>');

    if (_mes && p.porMes[_mes]) {
        const x = p.porMes[_mes];
        T.push('<div class="a-cab tapa-pbi" style="border-top:1px solid var(--border);">'
        + '<h3>Qué falta en ' + esc(mesLargo(_mes)) + '</h3>'
        + '<span class="nota">' + nf(x.top.length) + ' de ' + nf(x.articulos)
        + ' artículos · los que más faltan primero</span></div>'
        + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
        + '<th>Artículo</th><th>Marca</th><th>Enviado</th><th>Recibido</th><th>Falta</th>'
        + '</tr></thead><tbody>'
        + x.top.map(a => '<tr><td>' + esc(a.cod)
            + '<br><span class="a-desc">' + esc(dsc(a)) + '</span></td>'
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
    // ─── DE DONDE VIENE ──────────────────────────────────────────────────────
    //
    // Daniel, 03-sep-2026: *"falta anadir importacion, nacional, logistica
    // inversa y otras cosas al reporte"*.
    //
    // SE DICE DE DONDE SALE LA CLASIFICACION. 16.179 de los 16.404 ASN los
    // clasifica el propio WMS por su codigo; los 225 que no traen codigo salen
    // del patron del numero, que coincide con el codigo el 97,4% de las veces.
    // No es lo mismo un dato del sistema que una deduccion, y el que lee tiene
    // derecho a saber cual esta mirando.
    const tipos = p.tipos || [];
    if (tipos.length) {
        const NOMBRE = {
            importacion: 'Importación', nacional: 'Nacional',
            inversa: 'Logística inversa', devolucion: 'Devolución',
            reingreso: 'Reingreso', traslado: 'Traslado',
            materiales: 'Materiales', sin_clasificar: 'Sin clasificar',
        };
        const PIE = {
            importacion: 'se anuncia con ~37 días de anticipación y se paga en dólares',
            nacional: 'proveedor local, en soles; llega casi completo',
            inversa: 'vuelve de tienda — el ASN empieza con T',
            devolucion: 'devoluciones sueltas, de a pocas unidades',
            reingreso: 'cambio de calidad, acuerdo comercial, Falabella',
            traslado: 'movimiento entre almacenes',
            materiales: 'cajas, bolsas y empaque — no es mercadería',
            sin_clasificar: 'el WMS no le puso código y el número no lo dice',
        };
        const f = p.tipoFuente || {};
        const totF = tipos.reduce((a, x) => a + x.falta, 0);
        T.push('<div class="a-caja caja-pbi"><div class="a-cab tapa-pbi"><h3>De dónde viene</h3>'
        + '<span class="nota">'
        + (f.porCodigo ? nf(f.porCodigo) + ' clasificados por el WMS' : '')
        + (f.porNumero ? ' · ' + nf(f.porNumero) + ' por el número del ASN' : '')
        + '</span></div>'
        + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
        + '<th>De dónde</th><th>ASN</th><th>Enviado</th><th>Recibido</th>'
        + '<th>Falta</th><th>Cumple</th></tr></thead><tbody>'
        + tipos.map(x => '<tr><td>' + esc(NOMBRE[x.tipo] || x.tipo)
            + '<br><span class="a-desc">' + esc(PIE[x.tipo] || '') + '</span></td>'
            + '<td>' + nf(x.asn) + '</td>'
            + '<td>' + nf(x.enviado) + '</td>'
            + '<td>' + nf(x.recibido) + '</td>'
            + '<td class="a-falta">' + nf(x.falta) + '</td>'
            + '<td class="' + (x.cumple >= 95 ? 'a-ok' : 'a-falta') + '">'
            + n1(x.cumple) + '%</td></tr>').join('')
        + '<tr class="gran-tot" style="border-top:2px solid var(--border); font-weight:800;">'
        + '<td>Total</td>'
        + '<td>' + nf(tipos.reduce((a, x) => a + x.asn, 0)) + '</td>'
        + '<td>' + nf(tipos.reduce((a, x) => a + x.enviado, 0)) + '</td>'
        + '<td>' + nf(tipos.reduce((a, x) => a + x.recibido, 0)) + '</td>'
        + '<td class="a-falta">' + nf(totF) + '</td><td></td></tr>'
        + '</tbody></table></div>'
        + '<div class="a-pie">'
        + (tipos[0] ? 'El <b>' + Math.round(100 * tipos[0].falta / (totF || 1))
            + '%</b> de todo lo pendiente es <b>' + esc((NOMBRE[tipos[0].tipo] || '').toLowerCase())
            + '</b>. ' : '')
        + 'Lo nacional llega prácticamente completo; lo que se persigue es la importación.'
        + '</div></div>');
    }

    T.push('<div class="a-caja caja-pbi"><div class="a-cab tapa-pbi"><h3>Qué marca está llegando</h3>'
    + '<span class="nota">las ' + marcas.length + ' marcas · clic para filtrar los artículos de abajo</span></div>'
    + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
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
            || dsc(a).toLowerCase().indexOf(q) >= 0
            || (a.marca || '').toLowerCase().indexOf(q) >= 0;
    });
    T.push('</div>');   // cierra el empaquetado: lo que sigue va a lo ancho

    T.push('<div class="a-caja caja-pbi a-ancho-fila"><div class="a-cab tapa-pbi"><h3>Qué artículo está llegando</h3>'
    + '<span class="nota">los ' + nf((p.articulos || []).length) + ' con más pendiente, de '
    + nf(p.articulosConFalta) + '</span></div>'
    + '<div class="a-barra">'
    + '<input class="a-buscar" placeholder="Buscar por código, descripción o marca..." '
    + 'value="' + esc(_buscaArt) + '" oninput="window.__asnBuscar(&quot;art&quot;, this.value)">'
    + (_marca ? '<button class="a-pill viva" onclick="window.__asnMarca(&quot;&quot;)">'
              + esc(_marca) + ' ✕</button>' : '')
    + '<span style="font-size:var(--t-xs); color:var(--text-muted);">' + nf(arts.length) + ' a la vista</span>'
    + '</div>'
    + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
    + '<th>Artículo</th><th>Marca</th><th>Tipo</th>'
    + (hayCuando ? '<th>Cuándo llega</th>' : '')
    + '<th>Enviado</th><th>Recibido</th><th>Falta</th>'
    + '</tr></thead><tbody>'
    + (arts.length ? arts.map(a => '<tr><td>' + esc(a.cod)
        + '<br><span class="a-desc">' + esc(dsc(a)) + '</span></td>'
        + '<td style="text-align:left;">' + esc(a.marca || '') + '</td>'
        + '<td style="text-align:left;" class="a-desc">' + esc(a.gender || '') + '</td>'
        + (hayCuando ? '<td style="text-align:left;">' + cuandoLlegaEste(a.prox) + '</td>' : '')
        + '<td>' + nf(a.env) + '</td><td>' + nf(a.rec) + '</td>'
        + '<td class="a-falta">' + nf(a.falta) + '</td></tr>').join('')
      : '<tr><td colspan="' + (hayCuando ? 7 : 6) + '" style="text-align:center; padding:1.5rem; color:var(--text-muted);">'
        + 'Nada con ese texto.</td></tr>')
    + '</tbody></table></div>'
    + '<div class="a-pie">Se publican los <b>' + nf((p.articulos || []).length) + '</b> que más '
    + 'faltan, de <b>' + nf(p.articulosConFalta) + '</b> con algo pendiente. Mandarlos todos al '
    + 'navegador serían 1.117 KB y eso es lo que ya hizo lenta la web una vez. '
    /* DECIA "el Excel los trae completos" Y ERA FALSO: exporta estos mismos 500. */
    + 'El Excel exporta estos mismos.</div></div>');

    // ─── LOS PARCIALES, con buscador ─────────────────────────────────────────
    const par = (p.parciales || []).filter(x => {
        if (!_buscaPar) return true;
        const q = _buscaPar.toLowerCase();
        return (x.asn || '').toLowerCase().indexOf(q) >= 0
            || (x.estado || '').toLowerCase().indexOf(q) >= 0
            || (x.envio || '').toLowerCase().indexOf(q) >= 0;
    });
    T.push('<div class="a-caja caja-pbi a-ancho-fila"><div class="a-cab tapa-pbi"><h3>Los ASN parciales</h3>'
    + '<span class="nota">llegó algo pero no todo · son los que hay que perseguir</span></div>'
    + '<div class="a-barra">'
    + '<input class="a-buscar" placeholder="Buscar por ASN, estado o fecha..." '
    + 'value="' + esc(_buscaPar) + '" oninput="window.__asnBuscar(&quot;par&quot;, this.value)">'
    + '<span style="font-size:var(--t-xs); color:var(--text-muted);">'
    + nf(par.length) + ' de ' + nf((p.parciales || []).length) + '</span>'
    + '</div>'
    + '<div class="a-scroll"><table class="rep-pbi"><thead><tr>'
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
    window.__asnDia = (d) => { _dia = (_dia === d) ? null : d; redibujar(); };
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
