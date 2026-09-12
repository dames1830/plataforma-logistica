/* ══════════════════════════════════════════════════════════════════════════════
 *  DISTRIBUCIÓN Y DESPACHO POTENCIAL — el reporte, una sola vez
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Lo usan LA PLATAFORMA y EL ENLACE PÚBLICO. Antes el enlace tenía su propia
 *  versión reducida y salía distinto; Daniel, 07-sep-2026: *"los reportes
 *  públicos deberían salir igual que los originales, ¿por qué ese sale de esa
 *  forma?"*. Dos versiones del mismo cuadro se separan siempre.
 *
 *  Los dos leen un área que publica `robot/distribucion.py`. El navegador NO
 *  puede armarlos: Distribución cruza el picking del día con los 33 archivos del
 *  OBLPN, y eso son cientos de megas que no se bajan a una PC.
 *
 *  LAS DOS COSAS QUE CADA LADO PONE POR SU CUENTA:
 *
 *      hoy()          la fecha del día, solo para el nombre del Excel
 *      sinPublicar()  qué mostrar cuando el robot todavía no publicó
 *
 *  Se inyectan con `configurar()`. Si no se llama, hay un valor razonable para
 *  las dos, así que el módulo funciona solo.
 * ════════════════════════════════════════════════════════════════════════════ */

import { traerAreaPublicada } from '../services_v245/csvHub_v6.js?v=29.0713';
/* El icono del Excel, el mismo que usa toda la plataforma. */
import { icono } from '../services_v245/iconos.js?v=29.0713';

/* LA FECHA NUNCA SALE DE toISOString(): devuelve UTC y a las 19:00 hora de Lima
   ya adelantó el día. Se arma a mano con la hora local. */
const DOS = (n) => String(n).padStart(2, '0');
const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${DOS(d.getMonth() + 1)}-${DOS(d.getDate())}`;
};

/* Los miles con punto, como los escribe todo el resto de la plataforma. */
const milDist = (n) => Number(n || 0).toLocaleString('es-PE');

let getLogicalDate = hoyLocal;
let pantallaSinPublicar = (container, titulo, detalle, area) => {
    container.innerHTML = `
      <div class="glass-panel" style="padding:1.6rem; max-width:760px;">
        <h3 style="margin:0 0 .6rem 0;">${titulo}</h3>
        <p style="color:var(--text-muted); margin:0 0 1rem 0;">${detalle}</p>
        <p style="color:var(--text-muted); margin:0; font-size:.85rem;">
          El robot todavía no publica el área <b>${area}</b>. En cuanto corra por
          primera vez, esta pantalla se llena sola.
        </p>
      </div>`;
};

/** Cada lado pone su fecha del día y su pantalla de "todavía no hay datos". */
export const configurar = (opciones = {}) => {
    if (typeof opciones.hoy === 'function') getLogicalDate = opciones.hoy;
    if (typeof opciones.sinPublicar === 'function') pantallaSinPublicar = opciones.sinPublicar;
};

const estiloDistribucion = () => {
  if (document.getElementById('css_distribucion')) return;
  const st = document.createElement('style');
  st.id = 'css_distribucion';
  st.textContent = `
    /* Los dos acentos. El vivo se lee en tema oscuro; sobre blanco no
       llega al minimo de contraste, por eso los claros usan el oscurecido. */
    :root{--dst-f:#22A7B0; --dst-n:#D08A5E;
          --dst-a1:#22A7B0; --dst-a2:#D6A03A; --dst-a3:#E08A3C;
          --dst-a4:#E8635E; --dst-a5:#C4483D;
          --dst-alto:#6FD8A4; --dst-medio:#E5B45C; --dst-bajo:#F0908A;
          --dst-silueta:rgba(var(--ink-rgb),.10)}
    html[data-tema="pbi"],html[data-tema="pbi-classic"]{
          --dst-f:#0A6E77; --dst-n:#96522C;
          --dst-a1:#0A757E; --dst-a2:#8A6A12; --dst-a3:#B35A16;
          --dst-a4:#C4413C; --dst-a5:#8E2F28;
          --dst-alto:#0D6B37; --dst-medio:#7A5E06; --dst-bajo:#9E2F2A}

    /* EL ANCHO DE LA MAQUETA: 1.400px centrados y 34px entre bloques. */
    .dst-wrap{max-width:1400px; margin:0 auto; display:flex;
      flex-direction:column; gap:34px}
    .dst-grid{display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start}
    @media (max-width:980px){.dst-grid{grid-template-columns:1fr}}
    .dst-caja{background:var(--panel-solid); border:1px solid var(--border);
      border-radius:5px; overflow:hidden; display:flex; flex-direction:column}
    .dst-caja.alto{height:560px}
    @media (max-width:980px){.dst-caja.alto{height:480px}}

    /* EL ALCANCE: las cuatro cifras de arriba, en una tira de celdas
       pegadas. El fondo de la tira es el borde y cada celda tapa lo suyo. */
    .dst-alcance{display:grid; grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
      gap:1px; background:var(--border); border:1px solid var(--border);
      border-radius:5px; overflow:hidden}
    .dst-alcance > div{background:var(--panel-solid); padding:13px 15px;
      display:flex; flex-direction:column; gap:2px}
    .dst-alcance .q{font-size:.69rem; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted)}
    .dst-alcance .a{font-size:1.32rem; font-weight:700; line-height:1.2}
    .dst-alcance .d{font-size:.78rem; color:var(--text-muted)}

    /* EL AVISO: de cuando es cada cifra. Va antes del cuadro porque la
       mitad de las columnas son de un archivo y la otra mitad de otro. */
    .dst-aviso{background:rgba(var(--warning-rgb),.10); border:1px solid var(--border);
      border-left:3px solid var(--warning); border-radius:0 5px 5px 0;
      padding:14px 17px; display:flex; flex-direction:column; gap:5px}
    .dst-aviso .et{font-size:.69rem; font-weight:700; letter-spacing:.09em;
      text-transform:uppercase; color:var(--dst-medio)}
    .dst-aviso p{font-size:.84rem; color:var(--text-main); margin:0; max-width:80ch}

    .dst-cab{display:flex; justify-content:space-between; align-items:flex-start; gap:14px;
      padding:13px 14px 12px; border-bottom:1px solid var(--border);
      flex-wrap:wrap; flex:0 0 auto}
    .dst-cab .t{font-weight:700; font-size:.82rem; margin:0}
    .dst-cab .s{font-size:.75rem; color:var(--text-muted); margin:3px 0 0; max-width:40ch}
    /* Las acciones son una fila: a la izquierda el buscador con sus dos
       cápsulas debajo, a la derecha la hoja de Excel. */
    .dst-acc{display:flex; align-items:center; gap:8px; flex:0 0 auto}
    .dst-filtros{display:flex; flex-direction:column; gap:7px; flex:0 0 auto}
    .dst-buscar{font-size:.78rem; padding:6px 10px; border-radius:4px;
      border:1px solid var(--border); background:var(--input-bg);
      color:var(--text-strong); width:170px}
    .dst-caps{display:grid; grid-template-columns:1fr 1fr; gap:7px; width:170px}
    .dst-cap{font-size:.69rem; font-weight:700; cursor:pointer; padding:6px 4px;
      border-radius:999px; white-space:nowrap; background:transparent;
      color:var(--text-muted); border:1px solid var(--border);
      transition:background .12s, color .12s, border-color .12s}
    .dst-cap:hover{color:var(--text-strong); border-color:var(--text-muted)}
    .dst-cap.on{color:#FFFFFF; border-color:transparent}
    .dst-cap.on[data-g="F"]{background:#0B5C63}
    .dst-cap.on[data-g="N"]{background:#9C5A3C}
    .dst-scroll{overflow:auto; flex:1 1 auto; min-height:0}

    table.dst{width:100%; border-collapse:collapse; font-size:.82rem}
    table.dst th,table.dst td{padding:8px 10px; text-align:right; white-space:nowrap}
    table.dst th:first-child,table.dst td:first-child{text-align:left}
    table.dst thead th{font-size:.66rem; letter-spacing:.06em; text-transform:uppercase;
      color:var(--text-muted); background:var(--panel-solid);
      border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;
      white-space:normal; line-height:1.25; vertical-align:bottom}
    table.dst tbody td{border-bottom:1px solid var(--border)}
    table.dst tfoot td{border-top:2px solid var(--text-strong); font-weight:700;
      background:rgba(var(--ink-rgb),.06)}
    table.dst .n{font-variant-numeric:tabular-nums}
    table.dst tr.banda th{text-align:center; background:var(--panel-solid);
      letter-spacing:.11em; padding:7px 11px 6px;
      border-bottom:1px solid var(--border); position:static}
    /* La silueta separa lo que hace picking-embalaje de lo que hace
       despacho: marca donde empieza cada area sin meter una linea dura. */
    table.dst.principal th:nth-child(4), table.dst.principal td:nth-child(4),
    table.dst.principal th:nth-child(9), table.dst.principal td:nth-child(9),
    table.dst.principal tr.banda th:nth-child(2),
    table.dst.principal tr.banda th:nth-child(3){border-left:1px solid var(--dst-silueta)}
    /* El semaforo del % picado. Va por variable porque tambien se pinta
       sobre la franja del total, y ahi un tono medio ya no se lee. */
    .dst-pct{font-weight:700}
    .dst-pct.alto{color:var(--dst-alto)}
    .dst-pct.medio{color:var(--dst-medio)}
    .dst-pct.bajo{color:var(--dst-bajo)}

    .dst-pill{display:inline-block; font-size:.66rem; font-weight:700; letter-spacing:.06em;
      text-transform:uppercase; padding:2px 7px; border-radius:2px}
    .dst-pill.f{background:rgba(11,92,99,.14); color:var(--dst-f)}
    .dst-pill.n{background:rgba(156,90,60,.16); color:var(--dst-n)}

    /* LAS DOS ALARMAS: lo que hay que leer de un golpe es CUANTOS y CUAN
       VIEJO; despues, la forma de la cola en la barra apilada. */
    .dst-alarmas{display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:20px}
    .dst-alarma{background:var(--panel-solid); border:1px solid var(--border);
      border-radius:6px; overflow:hidden; display:flex; flex-direction:column;
      gap:14px; padding:0 0 16px}
    .dst-alarma .tt{font-size:.72rem; font-weight:700; letter-spacing:.09em;
      text-transform:uppercase; color:var(--text-soft);
      background:rgba(var(--ink-rgb),.06);
      border-bottom:1px solid var(--border); padding:10px 18px; margin:0}
    .dst-cifras{display:flex; gap:30px; padding:0 18px; flex-wrap:wrap}
    .dst-cifra{display:flex; flex-direction:column; gap:1px}
    .dst-cifra .v{font-size:2.4rem; font-weight:700; line-height:1; letter-spacing:-.02em}
    .dst-cifra.rojo .v{color:var(--danger-soft)}
    .dst-cifra .e{font-size:.69rem; font-weight:700; letter-spacing:.07em;
      text-transform:uppercase; color:var(--text-muted); margin-top:5px}
    .dst-cifra .p{font-size:.78rem; color:var(--text-main)}
    .dst-barra{display:flex; height:9px; margin:0 18px; border-radius:5px;
      overflow:hidden; background:rgba(var(--ink-rgb),.14)}
    .dst-tramos{list-style:none; margin:0; padding:0 18px; display:flex;
      flex-wrap:wrap; gap:5px 18px; font-size:.75rem; color:var(--text-muted)}
    .dst-tramos li{display:flex; align-items:baseline; gap:6px}
    .dst-tramos li::before{content:""; width:8px; height:8px; border-radius:2px; background:var(--x)}
    .dst-tramos b{font-weight:700; color:var(--text-strong)}

    .dst-dias{font-weight:700; font-variant-numeric:tabular-nums}
    .dst-dias.r{color:var(--danger-soft)} .dst-dias.a{color:var(--warning)}
    .dst-lpn{font-size:.75rem; color:var(--text-muted)}
    .dst-pie{font-size:.75rem; color:var(--text-muted); padding:9px 14px;
      border-top:1px solid var(--border); flex:0 0 auto; margin:0}

    /* La nota del control de PRE: recuadro con el canto en rojo, porque
       cada fila de ahi es algo que no deberia existir. */
    .dst-nota{background:var(--panel-solid); border:1px solid var(--border);
      border-left:3px solid var(--danger); border-radius:0 5px 5px 0;
      padding:15px 17px; display:flex; flex-direction:column; gap:8px}
    .dst-nota h3{font-size:.88rem; font-weight:700; margin:0; color:var(--text-strong)}
    table.dst.mini{font-size:.8rem; margin-top:4px}
    table.dst.mini th,table.dst.mini td{padding:5px 10px}

    tr.dst-zona{cursor:pointer}
    tr.dst-zona td{background:rgba(var(--ink-rgb),.06); font-weight:700;
      border-top:1px solid var(--border)}
    tr.dst-oculta{display:none}
    .dst-flecha{display:inline-block; width:0; height:0; margin-right:.5rem;
      border-left:5px solid currentColor; border-top:4px solid transparent;
      border-bottom:4px solid transparent; transform:rotate(90deg); vertical-align:middle}
    tr.dst-zona.cerrada .dst-flecha{transform:rotate(0)}
    .dst-mez{display:flex; height:7px; border-radius:4px; overflow:hidden;
      background:rgba(var(--ink-rgb),.14); min-width:90px}
    /* LA SUMA: los tres sumandos y el resultado, en una sola tira.
       No son cuatro tarjetas sueltas: se leen como una operacion. */
    .dst-suma{display:flex; align-items:stretch; flex-wrap:wrap; gap:0;
      background:var(--panel-solid); border:1px solid var(--border);
      border-radius:6px; overflow:hidden}
    .dst-paso{flex:1 1 170px; padding:16px 20px; display:flex; flex-direction:column;
      gap:2px; border-left:4px solid var(--x)}
    .dst-paso + .dst-paso{box-shadow:inset 1px 0 0 var(--border)}
    .dst-paso .q{font-size:.69rem; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--text-muted)}
    .dst-paso .v{font-size:1.82rem; font-weight:700; line-height:1.15}
    .dst-paso .d{font-size:.78rem; color:var(--text-muted)}
    .dst-paso.res{background:rgba(var(--ink-rgb),.06); border-left-color:var(--text-strong)}
    .dst-paso.res .q,.dst-paso.res .d{color:var(--text-soft)}

    tr.dst-zona td:first-child{font-size:.72rem; letter-spacing:.08em;
      text-transform:uppercase}
    tr.dst-zona .cuantas{font-size:.72rem; font-weight:400; letter-spacing:0;
      text-transform:none; color:var(--text-soft); margin-left:8px}
    th.dst-mezcla,td.dst-mezcla{width:120px; padding-right:14px}

    /* La clave de colores de la barra de mezcla. */
    .dst-leyenda{display:flex; gap:18px; flex-wrap:wrap; font-size:.75rem;
      color:var(--text-muted); padding:0 2px}
    .dst-leyenda span{display:flex; align-items:center; gap:6px}
    .dst-leyenda i{width:9px; height:9px; border-radius:2px; background:var(--x)}
  `;
  document.head.appendChild(st);
};

const TONOS_VAR = {
  '1 día': 'var(--dst-a1)', '2 a 3 días': 'var(--dst-a2)',
  '4 a 7 días': 'var(--dst-a3)', '8 a 14 días': 'var(--dst-a4)',
  'más de 14 días': 'var(--dst-a5)'
};

/* EL DETALLE POR ARTÍCULO NO VIAJA CON LA PANTALLA. Son 2.404 bultos y el
   desglose triplica el peso; se trae solo cuando alguien pide el Excel. */
let detalleDistribucion;
const traerDetalleDistribucion = async () => {
  if (detalleDistribucion === undefined) {
    detalleDistribucion = await traerAreaPublicada('distribucion_detalle');
  }
  return detalleDistribucion;
};

/* Una hoja por lista, una fila por artículo del bulto. Si el detalle no
   está publicado, baja lo que se ve en pantalla: bulto por bulto. */
const excelBultos = (filas, arts, detalle, archivo, hoja, cols) => {
  /* El desglose puede venir de dos sitios: del area de detalle que se baja
     aparte (las dos listas del dia) o de la propia fila (los varados, que
     ya lo traen). Si NINGUNA fila lo tiene, el Excel sale por bulto. */
  const itemsDe = (r) => (detalle && detalle[r.l]) || r.i || null;
  const hayDetalle = filas.some(itemsDe);
  const enc = hayDetalle
    ? [cols[0], 'LPN', 'Código tienda', 'Tienda', cols[3], 'Artículo', 'Descripción', 'Pares']
    : [cols[0], 'LPN', 'Código tienda', 'Tienda', cols[3], 'Pares'];
  const out = [enc];
  filas.forEach((r) => {
    /* La primera columna es la que diga `cols`: en las listas del día es el
       pedido, en varados son los días parado. */
    const primera = cols[0] === 'Días' ? r.dias : r.o;
    const cab = [primera, r.l, r.d, r.t, r.f || r.desde || ''];
    const items = itemsDe(r);
    if (items) {
      items.forEach((it) => {
        const a = (arts || {})[it[0]] || [''];
        out.push(cab.concat([it[0], a[0], it[1]]));
      });
    } else if (hayDetalle) {
      out.push(cab.concat(['', '', r.q]));       /* que la fila no se corra */
    } else {
      out.push(cab.concat([r.q]));
    }
  });
  const ws = XLSX.utils.aoa_to_sheet(out);
  ws['!cols'] = [{ wch: 13 }, { wch: 21 }, { wch: 9 }, { wch: 26 }, { wch: 12 },
                 { wch: 17 }, { wch: 46 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, archivo);
};

/* Una lista de bultos, con buscador, cápsulas de gender y su Excel. El
   Excel baja SOLO lo que está a la vista: el filtro y la búsqueda mandan. */
const listaBultos = (caja, filas, arts, cols, excel) => {
  const cuerpo = caja.querySelector('tbody');
  const pie = caja.querySelector('.dst-pie');
  const buscar = caja.querySelector('.dst-buscar');
  const btnXls = caja.querySelector('.btn-excel');
  let genero = '';
  let vistas = filas;
  const paresDe = (r) => {
    if (!genero || !r.i || !arts) return r.q;
    return r.i.reduce((a, it) => a + ((arts[it[0]] || [])[1] === genero ? it[1] : 0), 0);
  };
  const pinta = () => {
    const f = (buscar.value || '').trim().toUpperCase();
    vistas = filas.filter(r => {
      if (genero && r.i && paresDe(r) <= 0) return false;
      return !f || String(r.o || '').indexOf(f) >= 0 || r.l.indexOf(f) >= 0 ||
             r.d.indexOf(f) >= 0 || (r.t || '').toUpperCase().indexOf(f) >= 0;
    });
    cuerpo.innerHTML = vistas.map(r => cols(r, paresDe(r))).join('');
    const u = vistas.reduce((a, r) => a + paresDe(r), 0);
    pie.textContent = `${milDist(vistas.length)} bultos · ${milDist(u)} pares`;
  };
  caja.querySelectorAll('.dst-cap').forEach(b => b.addEventListener('click', () => {
    genero = genero === b.dataset.g ? '' : b.dataset.g;
    caja.querySelectorAll('.dst-cap').forEach(o => o.classList.toggle('on', o.dataset.g === genero));
    pinta();
  }));
  buscar.addEventListener('input', pinta);
  if (btnXls && excel) {
    btnXls.addEventListener('click', async () => {
      btnXls.disabled = true;
      try {
        const det = await traerDetalleDistribucion();
        excelBultos(vistas, arts || (det && det.arts), det && det[excel.clave],
                    excel.archivo, excel.hoja, excel.cols);
      } catch (e) {
        console.warn('[Distribución] No se pudo armar el Excel:', e);
        alert('No se pudo armar el Excel.');
      }
      btnXls.disabled = false;
    });
  }
  pinta();
};

const cabLista = (titulo, sub, tituloXls) => `
  <div class="dst-cab">
    <div><p class="t">${titulo}</p><p class="s">${sub}</p></div>
    <div class="dst-acc">
      <div class="dst-filtros">
        <input type="search" class="dst-buscar" placeholder="Pedido, LPN o tienda">
        <div class="dst-caps">
          <button type="button" class="dst-cap" data-g="F">Footwear</button>
          <button type="button" class="dst-cap" data-g="N">No&nbsp;Footwear</button>
        </div>
      </div>
      <button type="button" class="btn-icono btn-excel" title="${tituloXls || 'Exportar a Excel'}"
        aria-label="${tituloXls || 'Exportar a Excel'}">${icono('excel', 18)}</button>
    </div>
  </div>`;

export const renderDistribucion = async (container) => {
  estiloDistribucion();
  container.innerHTML = `<p style="color:var(--text-muted);">Trayendo el reporte…</p>`;
  const D = await traerAreaPublicada('distribucion_dia');
  if (!D || !D.tabla) {
    pantallaSinPublicar(container, 'Distribución',
      'El cuadro de Retail del día, lo que hay en el patio y en staging, y ' +
      'los bultos que llevan días parados.', 'distribucion_dia');
    return;
  }
  const T = D.tabla;
  const su = (k) => T.reduce((a, f) => a + (f[k] || 0), 0);
  const pct = (a, b) => b ? (100 * a / b).toFixed(1).replace('.', ',') + '%' : '—';
  /* El color del % dice de un vistazo si el día va bien: el mismo corte de
     la maqueta —80% y 50%—, para que no cambie de significado. */
  const clasePct = (a, b) => {
    if (!b) return '';
    const p = 100 * a / b;
    return p >= 80 ? 'alto' : (p >= 50 ? 'medio' : 'bajo');
  };
  const fila = (f) => `<tr>
      <td><span class="dst-pill ${f.g === 'Footwear' ? 'f' : 'n'}">${f.g}</span></td>
      <td class="n">${milDist(f.ped)}</td><td class="n">${milDist(f.qPed)}</td>
      <td class="n">${milDist(f.qPic)}</td>
      <td class="n dst-pct ${clasePct(f.qPic, f.qPed)}">${pct(f.qPic, f.qPed)}</td>
      <td class="n">${milDist(f.pend)}</td><td class="n">${milDist(f.emb)}</td>
      <td class="n">${milDist(f.patio)}</td>
      <td class="n">${milDist(f.stg)}</td><td class="n">${milDist(f.car)}</td>
      <td class="n">${milDist(f.env)}</td></tr>`;

  const pivot = (titulo, d) => `
    <div class="dst-caja">
      <div class="dst-cab"><div><p class="t">${titulo}</p></div></div>
      <table class="dst">
        <thead><tr><th>Turno</th><th>Zona</th><th style="text-align:center">Footwear</th>
          <th style="text-align:center">No Footwear</th></tr></thead>
        <tbody>${d.filas.map(f => `<tr><td style="font-weight:700">${f.turno}</td>
          <td style="text-align:left; color:var(--text-muted); font-size:.78rem">${f.zona}</td>
          <td class="n" style="text-align:center">${milDist(f.cal)}</td>
          <td class="n" style="text-align:center">${milDist(f.noc)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total general</td><td></td>
          <td class="n" style="text-align:center">${milDist(d.total.cal)}</td>
          <td class="n" style="text-align:center">${milDist(d.total.noc)}</td></tr></tfoot>
      </table>
    </div>`;

  const alarma = (nombre, etapa, dd) => {
    const v = dd.filas.filter(x => x.dias >= 4);
    const np = v.reduce((a, x) => a + x.q, 0);
    const mas = dd.filas[0];
    const cola = (D.varados.resumen[etapa] || []).filter(x => x.t !== 'se movió ayer');
    const tot = cola.reduce((a, x) => a + x.n, 0) || 1;
    return `<article class="dst-alarma">
      <p class="tt">${nombre}</p>
      <div class="dst-cifras">
        <div class="dst-cifra"><div class="v n">${milDist(v.length)}</div>
          <div class="e">bultos varados</div><div class="p">${milDist(np)} pares · 4 días o más</div></div>
        <div class="dst-cifra rojo"><div class="v n">${mas ? mas.dias : 0}</div>
          <div class="e">días el más viejo</div>
          <div class="p">${mas ? 'desde el ' + mas.desde : '—'}</div></div>
      </div>
      <div class="dst-barra">${cola.map(x =>
        `<span style="width:${Math.max(4, 100 * x.n / tot).toFixed(1)}%;background:${TONOS_VAR[x.t] || 'var(--border)'}"></span>`).join('')}</div>
      <ul class="dst-tramos">${cola.map(x =>
        `<li style="--x:${TONOS_VAR[x.t] || 'var(--border)'}"><b>${milDist(x.n)}</b>${x.t}</li>`).join('')}</ul>
    </article>`;
  };

  const nBultos = (l) => milDist(l.length);
  const paresDe = (l) => milDist(l.reduce((a, r) => a + (r.q || 0), 0));

  container.innerHTML = `
    <div class="dst-wrap">
      <div class="dst-alcance">
        <div><span class="q">N° pedidos</span><span class="a n">${milDist(su('ped'))}</span>
          <span class="d">Retail, del día</span></div>
        <div><span class="q">Qty pedida</span><span class="a n">${milDist(su('qPed'))}</span>
          <span class="d">${su('ped') ? milDist(Math.round(su('qPed') / su('ped'))) : 0} por pedido en promedio</span></div>
        <div><span class="q">Qty picada</span><span class="a n">${milDist(su('qPic'))}</span>
          <span class="d">el ${pct(su('qPic'), su('qPed'))} de lo pedido</span></div>
        <div><span class="q">Qty patio</span><span class="a n">${milDist(su('patio'))}</span>
          <span class="d">en ${nBultos(D.listas.patio)} bultos, todos en PRE</span></div>
      </div>

      <div class="dst-aviso">
        <span class="et">De cuándo es cada cifra</span>
        <p>${D.aviso || `Las columnas de picking salen del archivo de picking del día.
        <b>Qty patio, Staging, Cargado y Enviado son la foto del OBLPN</b>, así que
        esas cuatro cambian cuando baja el archivo siguiente. ${D.generado || ''}`}</p>
      </div>

      <div class="dst-caja">
        <div class="dst-cab"><div><p class="t">Reporte de Retail</p>
          <p class="s">Las cantidades son <b>pares</b>: la caja de prepack cuenta por
          los pares que trae, no como una unidad.</p></div></div>
        <div class="dst-scroll">
        <table class="dst principal">
          <thead>
            <tr class="banda"><th colspan="3"></th>
              <th colspan="5" style="color:var(--dst-f)">Picking y embalaje</th>
              <th colspan="3" style="color:var(--dst-n)">Despacho</th></tr>
            <tr><th>Gender</th><th>N° pedidos</th><th>Qty pedida</th>
              <th>Qty picada</th><th>% picado</th><th>Qty pendiente</th>
              <th>Qty embalada</th><th>Qty patio</th>
              <th>Staging</th><th>Cargado</th><th>Enviado</th></tr>
          </thead>
          <tbody>${T.map(fila).join('')}</tbody>
          <tfoot><tr><td>Total Retail</td>
            <td class="n">${milDist(su('ped'))}</td><td class="n">${milDist(su('qPed'))}</td>
            <td class="n">${milDist(su('qPic'))}</td>
            <td class="n dst-pct ${clasePct(su('qPic'), su('qPed'))}">${pct(su('qPic'), su('qPed'))}</td>
            <td class="n">${milDist(su('pend'))}</td><td class="n">${milDist(su('emb'))}</td>
            <td class="n">${milDist(su('patio'))}</td>
            <td class="n">${milDist(su('stg'))}</td><td class="n">${milDist(su('car'))}</td>
            <td class="n">${milDist(su('env'))}</td></tr></tfoot>
        </table></div>
      </div>

      <div class="dst-grid">
        ${pivot('Embalaje turno y zona', D.turnoZona.patio)}
        ${pivot('Staging turno y zona', D.turnoZona.staging)}
      </div>

      <div class="dst-grid">
        <div class="dst-caja alto" id="dst_patio">
          ${cabLista('Qué hay en el patio',
            `<b>${paresDe(D.listas.patio)} pares</b> en ${nBultos(D.listas.patio)} bultos, de
             todos los días. El LPN es el <b>PRE</b> del coche de picking.`,
            'Exportar el detalle a Excel')}
          <div class="dst-scroll"><table class="dst">
            <thead><tr><th>N° pedido</th><th>LPN</th><th>Tienda</th><th>Día del pick</th><th>Pares</th></tr></thead>
            <tbody></tbody></table></div>
          <p class="dst-pie"></p>
        </div>
        <div class="dst-caja alto" id="dst_staging">
          ${cabLista('Qué hay en staging',
            `<b>${paresDe(D.listas.staging)} pares</b> en ${nBultos(D.listas.staging)} bultos, de
             todos los días. Ya embalados, con su carga asignada, esperando el pistoleo.`,
            'Exportar el detalle a Excel')}
          <div class="dst-scroll"><table class="dst">
            <thead><tr><th>N° pedido</th><th>LPN</th><th>Tienda</th><th>Día de embalaje</th><th>Pares</th></tr></thead>
            <tbody></tbody></table></div>
          <p class="dst-pie"></p>
        </div>
      </div>

      <div class="dst-alarmas">
        ${alarma('Patio · picado y sin embalar', 'patio', D.varados.patio)}
        ${alarma('Staging · embalado y sin salir', 'staging', D.varados.staging)}
      </div>

      <div class="dst-grid">
        <div class="dst-caja alto" id="dst_vpatio">
          ${cabLista('Patio · picado y sin embalar',
            'El bulto sigue siendo un <b>PRE</b>: embalaje no lo agarró.')}
          <div class="dst-scroll"><table class="dst">
            <thead><tr><th>Días</th><th>LPN</th><th>Tienda</th><th>Desde el pick</th><th>Pares</th></tr></thead>
            <tbody></tbody></table></div>
          <p class="dst-pie"></p>
        </div>
        <div class="dst-caja alto" id="dst_vstaging">
          ${cabLista('Staging · embalado y sin salir',
            'Bulto armado, con carga asignada, que nadie pistoleó.')}
          <div class="dst-scroll"><table class="dst">
            <thead><tr><th>Días</th><th>LPN</th><th>Tienda</th><th>Embalado el</th><th>Pares</th></tr></thead>
            <tbody></tbody></table></div>
          <p class="dst-pie"></p>
        </div>
      </div>

      <div class="dst-nota">
        <h3>Control: PRE despachados sin pasar por embalaje</h3>
        <div class="dst-scroll"><table class="dst mini">
          <thead><tr><th>LPN</th><th>Pedido</th><th>Tienda</th><th>Pares</th></tr></thead>
          <tbody>${(D.controlPRE || []).map(x => `<tr><td>${x.l}</td>
            <td class="n">${x.p}</td><td style="text-align:left">${x.d} · ${x.t}</td>
            <td class="n">${milDist(x.q)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>`;

  const colBulto = (r, q) => `<tr><td class="n">${r.o}</td>
    <td class="dst-lpn">${r.l}</td>
    <td style="text-align:left"><b>${r.d}</b> ${r.t}</td>
    <td class="dst-lpn n">${r.f || ''}</td>
    <td class="n" style="font-weight:700">${milDist(q)}</td></tr>`;
  const colVarado = (r, q) => `<tr>
    <td class="dst-dias ${r.dias >= 8 ? 'r' : (r.dias >= 4 ? 'a' : '')}">${r.dias}</td>
    <td class="dst-lpn">${r.l}</td>
    <td style="text-align:left"><b>${r.d}</b> ${r.t}</td>
    <td class="dst-lpn n">${r.desde}</td>
    <td class="n" style="font-weight:700">${milDist(q)}</td></tr>`;
  const F = D.fecha || getLogicalDate();
  listaBultos(container.querySelector('#dst_patio'), D.listas.patio, null, colBulto,
    { clave: 'patio', archivo: `Patio_${F}.xlsx`, hoja: 'Patio',
      cols: ['Pedido', 'LPN', 'Tienda', 'Día del pick'] });
  listaBultos(container.querySelector('#dst_staging'), D.listas.staging, null, colBulto,
    { clave: 'staging', archivo: `Staging_${F}.xlsx`, hoja: 'Staging',
      cols: ['Pedido', 'LPN', 'Tienda', 'Día de embalaje'] });
  listaBultos(container.querySelector('#dst_vpatio'), D.varados.patio.filas,
    D.varados.patio.arts, colVarado,
    { clave: 'nada', archivo: `Varados_patio_${F}.xlsx`, hoja: 'Varados patio',
      cols: ['Días', 'LPN', 'Tienda', 'Desde el pick'] });
  listaBultos(container.querySelector('#dst_vstaging'), D.varados.staging.filas,
    D.varados.staging.arts, colVarado,
    { clave: 'nada', archivo: `Varados_staging_${F}.xlsx`, hoja: 'Varados staging',
      cols: ['Días', 'LPN', 'Tienda', 'Embalado el'] });
};

export const renderDespachoPotencial = async (container) => {
  estiloDistribucion();
  container.innerHTML = `<p style="color:var(--text-muted);">Trayendo el reporte…</p>`;
  const D = await traerAreaPublicada('despacho_potencial_dia');
  if (!D || !D.filas) {
    pantallaSinPublicar(container, 'Despacho Potencial',
      'Por tienda: lo que ya está embalado, lo que falta embalar y lo que mandó ' +
      'comercial. Sumados, es lo que se podría sacar hoy.', 'despacho_potencial_dia');
    return;
  }
  let genero = '';
  const cerradas = {};
  const v = (f, k) => genero ? f[k + genero] : (f[k + 'F'] + f[k + 'N']);
  /* Los tres sumandos con su color: el mismo de la barra de mezcla, para
     que la tira de arriba y la barra de cada fila se lean juntas. */
  const COL = { p: '#C08A2E', s: '#2E9E6B', c: '#7A8A96' };

  container.innerHTML = `
    <div class="dst-wrap">
      <div class="dst-suma" id="dst_suma"></div>
      <div class="dst-caja alto" id="dst_pot" style="height:620px">
        <div class="dst-cab">
          <div><p class="t">Por tienda</p>
            <p class="s">De la que más podría salir a la que menos.</p></div>
          <div class="dst-acc">
            <div class="dst-filtros">
              <input type="search" class="dst-buscar" placeholder="Tienda, código o ruta">
              <div class="dst-caps">
                <button type="button" class="dst-cap" data-g="F">Footwear</button>
                <button type="button" class="dst-cap" data-g="N">No&nbsp;Footwear</button>
              </div>
            </div>
            <button type="button" class="btn-icono btn-excel" title="Exportar a Excel"
              aria-label="Exportar a Excel">${icono('excel', 18)}</button>
          </div>
        </div>
        <div class="dst-scroll"><table class="dst">
          <thead><tr><th>Tienda</th><th style="text-align:center">Ruta</th>
            <th>Patio</th><th>Staging</th><th>Correo</th><th>Potencial</th>
            <th class="dst-mezcla" style="text-align:center">Mezcla</th></tr></thead>
          <tbody></tbody>
          <tfoot><tr><td>Total</td><td></td>
            <td class="n" data-t="p">—</td><td class="n" data-t="s">—</td>
            <td class="n" data-t="c">—</td><td class="n" data-t="t">—</td><td></td></tr></tfoot>
        </table></div>
        <p class="dst-pie"></p>
      </div>
      <div class="dst-leyenda">
        <span><i style="--x:${COL.p}"></i>Patio</span>
        <span><i style="--x:${COL.s}"></i>Staging</span>
        <span><i style="--x:${COL.c}"></i>Correo</span>
      </div>
    </div>`;

  const caja = container.querySelector('#dst_pot');
  const cuerpo = caja.querySelector('tbody');
  const buscar = caja.querySelector('.dst-buscar');
  const suma = container.querySelector('#dst_suma');
  const btnXls = caja.querySelector('.btn-excel');
  let vistas = D.filas;

  const mez = (p, s, c, t) => {
    const an = (x) => t ? (100 * x / t).toFixed(1) + '%' : '0%';
    return `<td class="dst-mezcla"><div class="dst-mez">
      <span style="width:${an(p)};background:${COL.p}"></span>
      <span style="width:${an(s)};background:${COL.s}"></span>
      <span style="width:${an(c)};background:${COL.c}"></span></div></td>`;
  };

  const pinta = () => {
    const q = (buscar.value || '').trim().toUpperCase();
    vistas = D.filas.filter(f => v(f, 't') > 0 && (!q ||
      f.d.indexOf(q) >= 0 || (f.t || '').toUpperCase().indexOf(q) >= 0 ||
      (f.r || '').toUpperCase().indexOf(q) >= 0 || (f.z || '').toUpperCase().indexOf(q) >= 0));
    const zonas = {};
    vistas.forEach(f => { (zonas[f.z || 'Sin zona'] = zonas[f.z || 'Sin zona'] || []).push(f); });
    const orden = Object.keys(zonas).sort((a, b) =>
      zonas[b].reduce((x, f) => x + v(f, 't'), 0) - zonas[a].reduce((x, f) => x + v(f, 't'), 0));
    let html = '';
    orden.forEach(z => {
      const g = zonas[z].slice().sort((a, b) => v(b, 't') - v(a, 't'));
      let zp = 0, zs = 0, zc = 0, zt = 0;
      g.forEach(f => { zp += v(f, 'p'); zs += v(f, 's'); zc += v(f, 'c'); zt += v(f, 't'); });
      const cer = !!cerradas[z];
      html += `<tr class="dst-zona${cer ? ' cerrada' : ''}" data-z="${z}">
        <td colspan="2"><span class="dst-flecha"></span>${z}
          <span class="cuantas">${g.length} tiendas</span></td>
        <td class="n">${milDist(zp)}</td><td class="n">${milDist(zs)}</td>
        <td class="n">${milDist(zc)}</td><td class="n">${milDist(zt)}</td>${mez(zp, zs, zc, zt)}</tr>`;
      g.forEach(f => {
        const p = v(f, 'p'), s = v(f, 's'), c = v(f, 'c'), t = v(f, 't');
        html += `<tr class="dst-de${cer ? ' dst-oculta' : ''}" data-de="${z}">
          <td style="padding-left:1.6rem"><b>${f.d}</b> ${f.t}</td>
          <td style="text-align:center;color:var(--text-muted)">${f.r || ''}</td>
          <td class="n">${milDist(p)}</td><td class="n">${milDist(s)}</td>
          <td class="n">${milDist(c)}</td>
          <td class="n" style="font-weight:700">${milDist(t)}</td>${mez(p, s, c, t)}</tr>`;
      });
    });
    cuerpo.innerHTML = html;
    const TT = { p: 0, s: 0, c: 0, t: 0 };
    vistas.forEach(f => { TT.p += v(f, 'p'); TT.s += v(f, 's'); TT.c += v(f, 'c'); TT.t += v(f, 't'); });
    Object.keys(TT).forEach(k => { caja.querySelector(`[data-t="${k}"]`).textContent = milDist(TT[k]); });
    caja.querySelector('.dst-pie').textContent =
      `${milDist(vistas.length)} tiendas · ${milDist(TT.t)} pares en ${orden.length} zonas`;
    suma.innerHTML = [
      ['Patio', TT.p, 'picado, falta embalar', COL.p, ''],
      ['+ Staging', TT.s, 'embalado, listo para cargar', COL.s, ''],
      ['+ Correo de comercial', TT.c, 'mandado a picar', COL.c, ''],
      ['= Potencial de despacho', TT.t, `en ${milDist(vistas.length)} tiendas`, '', ' res']
    ].map(([q2, val, d, col, res]) =>
      `<div class="dst-paso${res}" style="--x:${col || 'var(--text-strong)'}">
        <span class="q">${q2}</span><span class="v n">${milDist(val)}</span>
        <span class="d">${d}</span></div>`).join('');
  };

  /* EL EXCEL BAJA LO QUE ESTÁ A LA VISTA: el resumen por tienda en la
     primera hoja y, después, una hoja de detalle por zona con el LPN. */
  const aExcel = () => {
    const wb = XLSX.utils.book_new();
    const res = [['Zona', 'Ruta', 'Código', 'Tienda', 'Patio', 'Staging', 'Correo', 'Potencial']];
    const porZona = {};
    vistas.slice().sort((a, b) => v(b, 't') - v(a, 't')).forEach(f => {
      res.push([f.z || '', f.r || '', f.d, f.t, v(f, 'p'), v(f, 's'), v(f, 'c'), v(f, 't')]);
      (porZona[f.z || 'Sin zona'] = porZona[f.z || 'Sin zona'] || []).push(f);
    });
    const ws = XLSX.utils.aoa_to_sheet(res);
    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 30 },
                   { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
    Object.keys(porZona).forEach(z => {
      const det = [['Zona', 'Ruta', 'Código', 'Tienda', 'Origen', 'LPN', 'Pares']];
      /* El detalle viaja como [origen, LPN o guia, pares]. Se acepta
         tambien la forma vieja en objeto, por si quedo un dato publicado
         antes del robot: un Excel con columnas vacias no avisa de nada. */
      porZona[z].forEach(f => (f.det || []).forEach(x => det.push(
        Array.isArray(x) ? [f.z || '', f.r || '', f.d, f.t, x[0], x[1], x[2]]
                         : [f.z || '', f.r || '', f.d, f.t, x.o, x.l || x.p,
                            (x.F || 0) + (x.N || 0)])));
      if (det.length === 1) return;
      const w = XLSX.utils.aoa_to_sheet(det);
      w['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 30 },
                    { wch: 10 }, { wch: 21 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, w, ('Detalle ' + z).substring(0, 31));
    });
    XLSX.writeFile(wb, `Despacho_potencial_${D.fecha || getLogicalDate()}.xlsx`);
  };

  cuerpo.addEventListener('click', (e) => {
    const tr = e.target.closest('tr.dst-zona');
    if (!tr) return;
    const z = tr.dataset.z;
    cerradas[z] = !cerradas[z];
    tr.classList.toggle('cerrada', cerradas[z]);
    cuerpo.querySelectorAll(`tr.dst-de[data-de="${z}"]`).forEach(f =>
      f.classList.toggle('dst-oculta', cerradas[z]));
  });
  caja.querySelectorAll('.dst-cap').forEach(b => b.addEventListener('click', () => {
    genero = genero === b.dataset.g ? '' : b.dataset.g;
    caja.querySelectorAll('.dst-cap').forEach(o => o.classList.toggle('on', o.dataset.g === genero));
    pinta();
  }));
  buscar.addEventListener('input', pinta);
  if (btnXls) btnXls.addEventListener('click', aExcel);
  pinta();
};
