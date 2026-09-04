/**
 * RECEPCIÓN → LO QUE ENTRÓ
 *
 * Daniel, 03-sep-2026: *"quiero un reporte donde me digas lo que entró el día de
 * hoy, lo que se recibió, tanto en importado como en nacional, en un solo
 * reporte, con un fill rate"*.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ ESTE CUADRO MIRA LA FECHA DE RECEPCIÓN, NO LA DE ENVÍO                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * El calendario de al lado contesta *"qué viene"* con la fecha que anuncia el ASN.
 * Este contesta *"qué entró"*, que es la única fecha que responde «se recibió
 * entre tal y tal día». Son preguntas distintas y no se pueden mezclar: lo
 * anunciado para el 5 puede entrar el 15.
 *
 * EL FILL RATE QUE SE PUEDE MEDIR HOY es el del ASN: de lo que esos ASN
 * anunciaron, cuánto entró. **NO es el que Daniel quiere de verdad**, que es
 * *programado contra recibido* —*"programó esto y recepcionó esto"*— y necesita
 * el correo de programación de citas, que todavía no se captura. Mientras no
 * exista, el cuadro dice de qué fill rate está hablando en vez de dejar creer
 * que es el otro.
 *
 * Y OJO CON LO NACIONAL: solo eso se programa. La importación depende del
 * contenedor y de aduana, así que ahí no hay cita contra la cual medir.
 *
 * OPC = {
 *   api:  la base del servidor
 *   hoy:  la fecha lógica del turno (NUNCA toISOString)
 * }
 */

import { icono } from '../services_v245/iconos.js?v=29.0618';

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const diaLargo = (iso) => {
    const p = String(iso || '').split('-').map(Number);
    if (p.length < 3) return iso || '';
    const d = new Date(p[0], p[1] - 1, p[2]);
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
};

/* Sin toISOString(): devuelve UTC y a las 19:00 —cuando entra el turno noche—
   ya adelantó el día. */
const _ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                  + '-' + String(d.getDate()).padStart(2, '0');
const masDias = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return _ymd(d);
};

const NOMBRE = {
    importacion: 'Importación', nacional: 'Nacional', inversa: 'Logística inversa',
    devolucion: 'Devolución', reingreso: 'Reingreso', traslado: 'Traslado',
    materiales: 'Materiales', sin_clasificar: 'Sin clasificar',
};
/* El orden en que Daniel los nombra: primero los dos que le importan. */
const ORDEN = ['importacion', 'nacional', 'inversa', 'reingreso', 'traslado',
               'materiales', 'devolucion', 'sin_clasificar'];

const CSS = [
'#entro .e-caja { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; overflow:hidden; }',
'#entro .e-cab { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding:.9rem 1.2rem; border-bottom:1px solid var(--border); }',
'#entro .e-cab h3 { margin:0; font-size:var(--t-md); font-weight:800; color:var(--text-strong); }',
'#entro .e-cab .nota { font-size:var(--t-xs); color:var(--text-muted); }',
'#entro .e-barra { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; padding:.7rem 1.2rem; border-bottom:1px solid var(--border); }',
'#entro .e-pill { border:1px solid var(--border); background:rgba(var(--ink-rgb),.03); color:var(--text-muted); border-radius:999px; padding:.4rem .9rem; font-size:var(--t-xs); font-weight:800; cursor:pointer; font-family:inherit; white-space:nowrap; }',
'#entro .e-pill.viva { background:var(--text-strong); border-color:var(--text-strong); color:var(--panel-deep); }',
'#entro .e-scroll { overflow-x:auto; }',
'#entro table { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#entro th { text-align:right; padding:.55rem .8rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-size:10.5px; border-bottom:2px solid var(--border); white-space:nowrap; }',
'#entro th:first-child, #entro td:first-child { text-align:left; }',
'#entro td { padding:.55rem .8rem; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb),.06); white-space:nowrap; }',
'#entro td, #entro th { width:1%; }',
'#entro td:first-child, #entro th:first-child { width:auto; white-space:normal; }',
'#entro .e-ok { color:var(--success); font-weight:800; }',
'#entro .e-mal { color:var(--danger); font-weight:800; }',
'#entro .e-u { font-weight:800; color:var(--text-strong); }',
'#entro .e-desc { color:var(--text-muted); font-size:10.5px; }',
'#entro .e-pie { padding:.7rem 1.2rem; font-size:var(--t-xs); color:var(--text-muted); border-top:1px solid var(--border); line-height:1.6; }',
'#entro .e-vacio { padding:2rem; text-align:center; color:var(--text-muted); font-size:var(--t-sm); }',
].join('\n');

let _OPC = null, _cont = null;
let _desde = '', _hasta = '', _atajo = 'hoy';
let _datos = null, _cargando = false;

const ATAJOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días']];

const rango = () => {
    const hoy = (_OPC && _OPC.hoy) || _ymd(new Date());
    if (_atajo === 'hoy') return [hoy, hoy];
    if (_atajo === 'ayer') return [masDias(hoy, -1), masDias(hoy, -1)];
    if (_atajo === '7') return [masDias(hoy, -6), hoy];
    if (_atajo === '30') return [masDias(hoy, -29), hoy];
    return [_desde || hoy, _hasta || hoy];
};

const preguntar = async () => {
    const [d, h] = rango();
    const p = new URLSearchParams({ rec_desde: d, rec_hasta: h, recibido: '1',
                                    agrupar: 'tipo', limite: '20' });
    const r = await fetch(((_OPC && _OPC.api) || '') + '/api/asn?' + p.toString());
    if (!r.ok) throw new Error('el servidor respondió ' + r.status);
    const j = await r.json();
    if (j.status !== 'ok') throw new Error(j.message || 'no se pudo consultar');
    return j;
};

const pintar = () => {
    const caja = _cont.querySelector('#entro_res');
    if (!caja) return;
    if (_cargando) { caja.innerHTML = '<div class="e-vacio">Buscando…</div>'; return; }
    if (_datos && _datos.error) {
        caja.innerHTML = '<div class="e-vacio" style="color:var(--danger);">' + esc(_datos.error) + '</div>';
        return;
    }
    if (!_datos) { caja.innerHTML = '<div class="e-vacio">Elige un día.</div>'; return; }

    const g = (_datos.grupos || []).slice().sort(
        (a, b) => ORDEN.indexOf(a.clave) - ORDEN.indexOf(b.clave));
    const t = _datos.total || {};
    const [d, h] = rango();

    if (!t.filas) {
        caja.innerHTML = '<div class="e-vacio">No entró nada '
            + (d === h ? 'el ' + esc(diaLargo(d)) : 'entre el ' + esc(d) + ' y el ' + esc(h))
            + '.</div>';
        return;
    }

    /* LOS DOS QUE IMPORTAN, arriba y aparte. Daniel: *"enfocate mas en lo que es
       nacional e importacion"*. El resto queda abajo, que para eso esta. */
    const dos = g.filter(x => x.clave === 'importacion' || x.clave === 'nacional');
    const resto = g.filter(x => x.clave !== 'importacion' && x.clave !== 'nacional');
    const rec = (l) => l.reduce((a, x) => a + (x.recibido || 0), 0);

    const fila = (x) => {
        const fr = x.enviado ? (100 * x.recibido / x.enviado) : 0;
        return '<tr><td><b>' + esc(NOMBRE[x.clave] || x.clave) + '</b></td>'
            + '<td>' + nf(x.asn) + '</td><td>' + nf(x.filas) + '</td>'
            + '<td class="e-u">' + nf(x.recibido) + '</td>'
            + '<td>' + nf(x.enviado) + '</td>'
            + '<td class="' + (fr >= 95 ? 'e-ok' : 'e-mal') + '">' + n1(fr) + '%</td></tr>';
    };

    caja.innerHTML =
      '<div class="e-scroll"><table class="rep-pbi"><thead><tr>'
    + '<th>Tipo</th><th>ASN</th><th>Artículos</th><th>Entró</th>'
    + '<th>Anunciado</th><th>Fill rate</th></tr></thead><tbody>'
    + dos.map(fila).join('')
    + (dos.length ? '<tr class="gran-tot" style="font-weight:800;"><td>Importación + Nacional</td>'
        + '<td>' + nf(dos.reduce((a, x) => a + x.asn, 0)) + '</td>'
        + '<td>' + nf(dos.reduce((a, x) => a + x.filas, 0)) + '</td>'
        + '<td>' + nf(rec(dos)) + '</td>'
        + '<td>' + nf(dos.reduce((a, x) => a + x.enviado, 0)) + '</td>'
        + '<td>' + n1(100 * rec(dos) / (dos.reduce((a, x) => a + x.enviado, 0) || 1)) + '%</td></tr>' : '')
    + resto.map(fila).join('')
    + '<tr class="gran-tot" style="font-weight:800;"><td>Total del día</td>'
    + '<td>' + nf(t.asn) + '</td><td>' + nf(t.filas) + '</td>'
    + '<td>' + nf(t.recibido) + '</td><td>' + nf(t.enviado) + '</td>'
    + '<td>' + n1(100 * (t.recibido || 0) / (t.enviado || 1)) + '%</td></tr>'
    + '</tbody></table></div>'
    /* SE DICE DE QUE FILL RATE SE ESTA HABLANDO. El que Daniel quiere para lo
       nacional es programado contra recibido, y ese necesita el correo de citas
       que todavia no se captura. Callarlo dejaria creer que ya es ese. */
    + '<div class="e-pie">El <b>fill rate</b> de acá es <b>lo que entró contra lo que '
    + 'anunciaba el ASN</b> de esos mismos ingresos. '
    + 'El de <b>programado contra recibido</b> —el de las citas— sale cuando el robot '
    + 'capture el correo de programación de recepción; ese solo aplica a lo <b>nacional</b>, '
    + 'porque la importación depende del contenedor y de aduana.</div>';
};

const buscar = async () => {
    _cargando = true; pintar();
    try { _datos = await preguntar(); }
    catch (e) { _datos = { error: 'No se pudo consultar: ' + (e && e.message || e) }; }
    _cargando = false; pintar();
};

export function montarLoQueEntro(cont, OPC) {
    if (!cont) return;
    _cont = cont;
    if (OPC) _OPC = OPC;
    const [d, h] = rango();

    cont.innerHTML = '<style>' + CSS + '</style><div id="entro"><div class="e-caja caja-pbi">'
    + '<div class="e-cab tapa-pbi"><h3>Lo que entró</h3>'
    + '<span class="nota">por fecha de recepción · '
    + (d === h ? esc(diaLargo(d)) : esc(d) + ' a ' + esc(h)) + '</span></div>'
    + '<div class="e-barra">'
    + ATAJOS.map(a => '<button class="e-pill' + (a[0] === _atajo ? ' viva' : '') + '" '
        + 'data-atajo="' + a[0] + '">' + a[1] + '</button>').join('')
    + '<span style="flex:1 1 auto;"></span>'
    + '<button class="btn-icono btn-excel" title="Exportar a Excel" id="entro_excel"'
    + ' style="background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center;">'
    + icono('excel', 18) + '</button>'
    + '</div><div id="entro_res"></div></div></div>';

    cont.querySelectorAll('[data-atajo]').forEach(b => {
        b.onclick = () => { _atajo = b.getAttribute('data-atajo'); montarLoQueEntro(_cont); buscar(); };
    });
    const bx = cont.querySelector('#entro_excel');
    if (bx) bx.onclick = () => {
        if (_OPC && typeof _OPC.alExportar === 'function') {
            const [a, b2] = rango();
            _OPC.alExportar(_datos, a, b2);
        }
    };
    pintar();
    if (!_datos && !_cargando) buscar();
}
