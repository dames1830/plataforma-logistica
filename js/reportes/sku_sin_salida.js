import { icono } from '../services_v245/iconos.js?v=29.0598';
/**
 * SKUs SIN SALIDA — los que llegaron y no se están moviendo
 *
 * Lo pidió Daniel el 12-ago-2026: *"quiero que me muestres los SKUs que en la
 * primera semana no han salido, ni en la segunda semana"*. Su vara: a la segunda
 * semana ya debería haberse ido entre el 50% y el 60% del SKU.
 *
 * ESTE ARCHIVO NO CALCULA NADA Y NO SABE LEER DEL SERVIDOR. Recibe el paquete que
 * publica el robot (`wms_scraping/sku_sin_salida.py`, área `sku_sin_salida`) y lo
 * dibuja. Es el mismo reparto que tienen turno_actividades.js y picking_piso.js:
 * el que dibuja no sale a buscar datos.
 *
 * POR QUÉ EL CÁLCULO VIVE EN EL ROBOT: necesita la SERIE de fotos diarias de stock
 * —183 días, 3,8 MB comprimidos— y el servidor guarda una sola foto por área. El
 * robot las tiene todas, así que el trabajo pesado corre allá y acá baja un
 * paquete de 20 KB.
 *
 * EL DISEÑO ES EL DE LA MAQUETA QUE DANIEL APROBÓ el 13-ago tras once idas y
 * vueltas (`scratch/maqueta_sku_sin_salida.html`). No se rediseña nada acá:
 *
 *   · CADA COLUMNA ORDENA. *"Quiero filtrarlo en base a lo que yo quiero"*. Antes
 *     el orden lo elegía yo y siempre iba a estar mal para la mitad de las
 *     preguntas.
 *   · El cuadro de arriba arranca por el PEDIDO MÁS ANTIGUO, no por el más
 *     grande: lo que decide a qué se le entra no es cuántos pares son, es cuántos
 *     días lleva el pedido sin atender.
 *   · La fecha ordena por la ISO, no por lo que se ve: "18-07" y "04-06"
 *     comparados como texto ponen junio detrás de julio.
 *   · El que NUNCA salió lleva 9999 días por dentro para quedar ARRIBA al
 *     ordenar: no tener ni una salida es el peor caso, no el mejor.
 *   · La reposición va en ámbar al lado de lo que llegó. Sin ella la cuenta
 *     `llegó + repuesto − picado = pares hoy` no cerraba en 6 de 14 filas y
 *     parecía un error del cuadro.
 *   · NADA DE SCROLL HORIZONTAL en ningún ancho: *"toda la data debería entrar"*.
 *     Lo que cede es el relleno de las celdas y el ancho del modelo, no las
 *     columnas.
 *
 * TODO EL CSS VA ENCERRADO BAJO `#sss` y los ids llevan prefijo `sss_`. Los
 * nombres que usa la maqueta —wrap, cab, tarjetas, t, der, cen— chocarían con los
 * del tablero.
 */

const CSS = `
#sss { --sss-rosa:var(--pink-soft); --sss-ambar:var(--warning-soft); --sss-rojo:var(--danger-soft);
       --sss-azul:var(--blue-mid); --sss-lila:var(--violet-soft); --sss-verde:var(--success-mid);
       --sss-gris:var(--text-muted); --sss-apagado:var(--text-faint); }
#sss * { box-sizing:border-box; }
/* 1.500 y no los 1.180 de siempre: el cuadro de arriba necesita 1.219 px por sus
   catorce columnas, y a 1.180 la última —Pedido más antiguo, que es por la que se
   ordena— quedaba cortada contra el borde. */
#sss .wrap { max-width:1500px; margin:0 auto; }
#sss .cab { display:flex; align-items:center; gap:14px; flex-wrap:wrap;
            padding-bottom:0.9rem; margin-bottom:1.2rem;
            border-bottom:1px solid rgba(var(--ink-rgb), 0.05); }
#sss h3.tit { font-size:var(--t-lg); font-weight:800; letter-spacing:0.4px; margin:0;
              color:var(--text-main); }
#sss .sello { font-size:var(--t-xs); font-weight:800; letter-spacing:1px;
              text-transform:uppercase; color:var(--sss-gris);
              border:1px solid rgba(var(--ink-rgb), 0.12); border-radius:6px; padding:3px 8px; }
#sss .tarjetas { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:1.2rem; }
#sss .t { flex:1; min-width:158px; background:rgba(var(--ink-rgb), 0.03);
          border:1px solid rgba(var(--ink-rgb), 0.07); border-radius:12px; padding:0.9rem 1.1rem; }
#sss .t .r { font-size:var(--t-xs); letter-spacing:0.8px; text-transform:uppercase;
             color:var(--text-muted); margin-bottom:0.35rem; }
#sss .t .v { font-size:var(--t-xl); font-weight:800; line-height:1.1; color:var(--text-main); }
#sss .t .p { font-size:var(--t-xs); color:var(--text-dim); margin-top:0.3rem; }
#sss h4.sec { font-size:var(--t-xs); font-weight:800; letter-spacing:1px; text-transform:uppercase;
              margin:1.6rem 0 0.6rem; }
#sss h4.sec span { font-weight:400; text-transform:none; letter-spacing:0; color:var(--text-dim);
                   font-size:var(--t-xs); margin-left:0.5rem; }
#sss table { width:100%; border-collapse:collapse; font-size:var(--t-sm); color:var(--text-grey); }
#sss thead tr { background:var(--panel-solid); }
/* El relleno lateral se achica solo cuando la pantalla aprieta: catorce columnas
   por dos costados son 66 px que no valen una barra de scroll. */
#sss th { padding:0.55rem clamp(0.3rem, 0.55vw, 0.7rem); font-weight:700; color:var(--text-muted);
          font-size:var(--t-xs); letter-spacing:0.4px; text-transform:uppercase; white-space:nowrap; }
#sss td { padding:0.5rem clamp(0.3rem, 0.55vw, 0.7rem);
          border-bottom:1px solid rgba(var(--ink-rgb), 0.04); white-space:nowrap; }
/* EL MODELO ES LA VÁLVULA. Es la única columna larga —252 px de los 1.219 que pide
   el cuadro—, así que es la que cede cuando la pantalla no da.
   CEDE CORTÁNDOSE, NO PARTIÉNDOSE: partido en tres renglones estiraba la fila entera
   y el cuadro se leía como una lista de párrafos. Ahora es UNA SOLA LÍNEA y lo que
   no entra termina en puntos suspensivos, con el nombre completo en el globito.
   Pedido de Daniel, 19-ago-2026. Sigue sin haber scroll horizontal. */
#sss td.mod { white-space:nowrap; }
#sss td.mod > span { display:block; max-width:15rem; overflow:hidden;
                     text-overflow:ellipsis; white-space:nowrap; }
#sss tbody tr:nth-child(even) { background:rgba(var(--ink-rgb), 0.02); }
#sss .der { text-align:right; } #sss .cen { text-align:center; }
#sss th.ord { cursor:pointer; user-select:none; }
#sss th.ord:hover { color:var(--text-main); background:rgba(var(--ink-rgb), 0.05); }
#sss .pie { margin-top:1rem; font-size:0.72rem; color:var(--text-dim); line-height:1.8; }
`;

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const mil = (n) => Number(n || 0).toLocaleString('es-PE');

/** Menos de dos décimas es "nada": un 0,1% en mil pares es un par, y escribirlo
    como porcentaje hace pensar que algo se movió. */
const pc = (v) => (Number(v) <= 0.2 ? 'nada' : Number(v).toFixed(1).replace('.', ',') + '%');

const dias = (d) => (d === 0 ? 'hoy' : d === 1 ? '1 día' : mil(d) + ' días');

const ddmm = (iso) => (iso && iso.length >= 10 ? iso.slice(8, 10) + '-' + iso.slice(5, 7) : '');

/** El último pick, con el color diciendo cuánto lleva parado: ámbar a los 14 días,
    rojo a los 30. El que nunca salió no lleva fecha sino la palabra. */
const ultimoPick = (iso, d) => {
    if (!iso) return '<span style="color:var(--sss-rojo); font-weight:800;">nunca</span>';
    const col = d >= 30 ? 'var(--sss-rojo)' : d >= 14 ? 'var(--sss-ambar)' : 'var(--sss-gris)';
    return ddmm(iso) + ' <span style="color:' + col + ';">(' + dias(d) + ')</span>';
};

/* `k` es la clave por la que ORDENA esa columna, que no siempre es la que se ve:
   "Llegó" muestra 18-07 y ordena por la ISO; "Pedido más antiguo" muestra la fecha
   y ordena por los DÍAS. `t` dice si compara como número o como texto. */
const COLS_CP = [
    { r: 'Código', k: 'cod', t: 's' }, { r: 'Marca', k: 'marca', t: 's' },
    { r: 'Colec.', k: 'coleccion', t: 's', a: 'cen' }, { r: 'Modelo', k: 'modelo', t: 's' },
    { r: 'Llegó', k: 'llegada', t: 's', a: 'cen' },
    { r: 'Último pick', k: 'dias_sin_salir', t: 'n', a: 'cen' },
    { r: 'Pares hoy', k: 'hoy', t: 'n', a: 'der' }, { r: 'Picado', k: 'picado', t: 'n', a: 'der' },
    { r: 'Pedido', k: 'solicitado', t: 'n', a: 'der' },
    { r: 'Salió 2ª sem', k: 'salio_sem2', t: 'n', a: 'der' },
    { r: 'Pendiente', k: 'pendiente', t: 'n', a: 'der' },
    { r: 'Órdenes', k: 'ordenes', t: 'n', a: 'der' },
    { r: 'Tiendas', k: 'tiendas', t: 'n', a: 'der' },
    { r: 'Pedido más antiguo', k: 'dias_esperando', t: 'n', a: 'cen' }
];

const COLS_SP = [
    { r: 'Código', k: 'cod', t: 's' }, { r: 'Marca', k: 'marca', t: 's' },
    { r: 'Colec.', k: 'coleccion', t: 's', a: 'cen' }, { r: 'Modelo', k: 'modelo', t: 's' },
    { r: 'Llegó', k: 'llegada', t: 's', a: 'cen' },
    { r: 'Último pick', k: 'dias_sin_salir', t: 'n', a: 'cen' },
    { r: 'Llegó con', k: 'llego_con', t: 'n', a: 'der' },
    { r: 'Picado', k: 'picado', t: 'n', a: 'der' },
    { r: 'Pares hoy', k: 'hoy', t: 'n', a: 'der' },
    { r: 'Salió 1ª sem', k: 'salio_sem1', t: 'n', a: 'der' },
    { r: 'Salió 2ª sem', k: 'salio_sem2', t: 'n', a: 'der' }
];

const celdasCP = (f) =>
    '<td style="color:var(--text-main);">' + esc(f.cod) + '</td>'
    + '<td>' + esc(f.marca) + '</td>'
    + '<td class="cen" style="color:var(--sss-gris);">' + esc(f.coleccion) + '</td>'
    + '<td class="mod" style="color:var(--sss-gris);"><span title="' + esc(f.modelo || '') + '">' + esc(f.modelo || '') + '</span></td>'
    + '<td class="cen" style="color:var(--sss-gris);">' + ddmm(f.llegada) + '</td>'
    + '<td class="cen">' + ultimoPick(f.ultima_salida, f.dias_sin_salir) + '</td>'
    + '<td class="der" style="color:var(--text-main);">' + mil(f.hoy) + '</td>'
    /* Picado en cero va apagado y no en blanco: en este cuadro que no se haya picado
       nada es lo normal —por eso están acá— y en blanco parecía un dato que falta. */
    + '<td class="der" style="color:' + (f.picado ? 'var(--sss-verde)' : 'var(--sss-apagado)') + ';">' + mil(f.picado) + '</td>'
    + '<td class="der" style="color:var(--sss-gris);">' + mil(f.solicitado) + '</td>'
    + '<td class="der" style="color:' + (f.salio_sem2 <= 0.2 ? 'var(--sss-rojo)' : 'var(--sss-ambar)') + ';">' + pc(f.salio_sem2) + '</td>'
    + '<td class="der" style="color:var(--sss-rojo); font-weight:800;">' + mil(f.pendiente) + '</td>'
    + '<td class="der">' + mil(f.ordenes) + '</td>'
    + '<td class="der" style="color:var(--sss-gris);">' + mil(f.tiendas) + '</td>'
    + '<td class="cen">' + ddmm(f.pedido_viejo) + ' <span style="color:'
    + (f.dias_esperando >= 14 ? 'var(--sss-rojo)' : 'var(--sss-gris)') + ';">('
    + dias(f.dias_esperando) + ')</span></td>';

const celdasSP = (f) =>
    '<td style="color:var(--text-main);">' + esc(f.cod) + '</td>'
    + '<td>' + esc(f.marca) + '</td>'
    + '<td class="cen" style="color:var(--sss-gris);">' + esc(f.coleccion) + '</td>'
    + '<td class="mod" style="color:var(--sss-gris);"><span title="' + esc(f.modelo || '') + '">' + esc(f.modelo || '') + '</span></td>'
    + '<td class="cen" style="color:var(--sss-gris);">' + ddmm(f.llegada) + '</td>'
    + '<td class="cen">' + ultimoPick(f.ultima_salida, f.dias_sin_salir) + '</td>'
    + '<td class="der">' + mil(f.llego_con)
    + (f.repuesto ? ' <span style="color:var(--sss-ambar);">+' + mil(f.repuesto) + '</span>' : '') + '</td>'
    + '<td class="der" style="color:' + (f.picado ? 'var(--sss-verde)' : 'var(--sss-apagado)') + ';">' + mil(f.picado) + '</td>'
    + '<td class="der" style="color:var(--text-main);">' + mil(f.hoy) + '</td>'
    + '<td class="der" style="color:' + (f.salio_sem1 <= 0.2 ? 'var(--sss-rojo)' : 'var(--sss-ambar)') + ';">' + pc(f.salio_sem1) + '</td>'
    + '<td class="der" style="color:' + (f.salio_sem2 <= 0.2 ? 'var(--sss-rojo)' : 'var(--sss-ambar)') + ';">' + pc(f.salio_sem2) + '</td>';


/** Dibuja el reporte dentro de `RAIZ`. `OPC.paquete` es lo que publicó el robot. */
export const montarSinSalida = function (RAIZ, OPC) {
    OPC = OPC || {};
    const P = OPC.paquete;
    if (!RAIZ || !P) return;

    const cp = (P.con_pedido && P.con_pedido.filas) || [];
    const sp = (P.sin_pedido && P.sin_pedido.filas) || [];
    const pctSku = P.medidos ? (P.skus * 100 / P.medidos).toFixed(1).replace('.', ',') : '0';

    RAIZ.innerHTML = `<style>${CSS}</style>
<div id="sss"><div class="wrap">

  <div class="cab">
    <h3 class="tit">SKUs sin salida</h3>
    <span class="sello" title="${esc((P.temporadas || []).join(' · '))}">${(P.temporadas || []).length} temporadas</span>
    <span style="margin-left:auto; font-size:var(--t-xs); color:var(--text-muted);">
      al ${ddmm(P.fecha)} &middot; ${esc(P.hora || '')}
    </span>
    ${OPC.alExportar ? `<button id="sss_xls" class="btn-icono btn-excel" title="Exportar a Excel">${icono('excel', 18)}</button>` : ''}
  </div>

  <div class="tarjetas">
    <div class="t" style="border-left:3px solid var(--sss-rosa);">
      <div class="r">SKUs sin salida</div><div class="v">${mil(P.skus)}</div>
      <div class="p">de ${mil(P.medidos)} medidos &middot; ${pctSku}%</div></div>
    <div class="t" style="border-left:3px solid var(--sss-ambar);">
      <div class="r">Pares parados</div><div class="v">${mil(P.pares_parados)}</div>
      <div class="p">no salieron en 2 semanas</div></div>
    <div class="t" style="border-left:3px solid var(--sss-rojo);">
      <div class="r">Pedido sin asignar</div>
      <div class="v" style="color:var(--sss-rojo);">${mil(P.con_pedido.skus)}</div>
      <div class="p">${mil(P.con_pedido.pares_parados)} pares parados &middot; ${mil(P.con_pedido.pedidos)} pedidos</div></div>
    <div class="t" style="border-left:3px solid var(--sss-azul);">
      <div class="r">Sin ning&uacute;n pedido</div><div class="v">${mil(P.sin_pedido.skus)}</div>
      <div class="p">${mil(P.sin_pedido.pares_parados)} pares parados</div></div>
    <div class="t" style="border-left:3px solid var(--sss-lila);">
      <div class="r">Pedido m&aacute;s antiguo</div><div class="v">${mil(P.con_pedido.mas_viejo_dias)}</div>
      <div class="p">d&iacute;as esperando</div></div>
  </div>

  <h4 class="sec" style="color:var(--sss-rojo);">Se pidieron y no se asignaron
    <span>&mdash; hay demanda y mercader&iacute;a; la orden nunca se asign&oacute;
    &middot; clic en cualquier t&iacute;tulo para ordenar por esa columna</span></h4>
  <div><table><thead><tr id="sss_th_cp"></tr></thead><tbody id="sss_cp"></tbody></table></div>

  <h4 class="sec" style="color:var(--sss-azul);">Sin ning&uacute;n pedido
    <span>&mdash; nadie los pidi&oacute;: no es un problema del almac&eacute;n</span></h4>
  <div><table><thead><tr id="sss_th_sp"></tr></thead><tbody id="sss_sp"></tbody></table></div>

  <div class="pie">
    Temporadas ${esc((P.temporadas || []).join(', '))}, con dos semanas cumplidas.
    La salida se mide con las fotos de stock &mdash;activo m&aacute;s reserva&mdash;
    del ${ddmm(P.fotos && P.fotos.desde)} al ${ddmm(P.fotos && P.fotos.hasta)}
    (${mil(P.fotos && P.fotos.dias)} d&iacute;as). El pendiente sale del detalle de orden:
    <b style="color:var(--sss-gris);">cantidad solicitada menos cantidad asignada</b>.
    <br>A la segunda semana deber&iacute;a haber salido entre el 50% y el 60%.
    <br><b style="color:var(--sss-gris);">Quedan aparte</b> los SKUs que recibieron m&aacute;s
    mercader&iacute;a dentro de sus dos primeras semanas: con el stock subiendo en el medio,
    la resta no significa nada. Y los que hoy est&aacute;n en cero tampoco entran
    &mdash;no hay pares parados que recuperar, y aparecer en &laquo;nadie los pidi&oacute;&raquo;
    ser&iacute;a injusto: nadie los pidi&oacute; porque no queda nada&mdash;.
  </div>
</div></div>`;

    montarTabla(RAIZ, 'cp', cp, COLS_CP, celdasCP, 13);   // arranca por el pedido más antiguo
    montarTabla(RAIZ, 'sp', sp, COLS_SP, celdasSP, 8);    // arranca por los pares parados

    /* EXPORTAR. El módulo no arma el archivo —no conoce ExcelJS ni tiene por qué—:
       avisa hacia afuera con las filas YA ORDENADAS como se están viendo. Si el
       Excel saliera en otro orden que la pantalla, el que lo abre pensaría que son
       dos reportes distintos. */
    const btn = RAIZ.querySelector('#sss_xls');
    if (btn && OPC.alExportar) {
        btn.onclick = async () => {
            const antes = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '⌛ GENERANDO...';
            try {
                await OPC.alExportar({
                    paquete: P,
                    conPedido: { cols: COLS_CP, filas: ordenadas(cp, COLS_CP, 13) },
                    sinPedido: { cols: COLS_SP, filas: ordenadas(sp, COLS_SP, 8) }
                });
            } catch (e) {
                console.warn('[SIN SALIDA] no se pudo exportar:', e && e.message);
            }
            btn.disabled = false;
            btn.innerHTML = antes;
        };
    }
};


/** Las filas en el mismo orden en que arrancó el cuadro. */
function ordenadas(datos, cols, iniCol) {
    const c = cols[iniCol];
    return datos.slice().sort((a, b) => {
        const x = a[c.k], y = b[c.k];
        if (c.t === 'n') return Number(y) - Number(x);
        return String(y == null ? '' : y).localeCompare(String(x == null ? '' : x), 'es');
    });
}


function montarTabla(RAIZ, id, datos, cols, celdas, iniCol) {
    const orden = { i: iniCol, desc: true };
    const cabe = RAIZ.querySelector('#sss_th_' + id);
    const cuerpo = RAIZ.querySelector('#sss_' + id);
    if (!cabe || !cuerpo) return;

    if (!datos.length) {
        cabe.innerHTML = '';
        cuerpo.innerHTML = '<tr><td style="padding:1.2rem; color:var(--text-muted);">'
            + 'Ninguno en este momento.</td></tr>';
        return;
    }

    const pintar = () => {
        cabe.innerHTML = cols.map((c, i) => {
            const act = i === orden.i;
            return '<th class="ord ' + (c.a || '') + '" data-i="' + i + '"'
                + (act ? ' style="color:var(--text-main);"' : '') + '>' + esc(c.r)
                + '<span style="margin-left:4px; opacity:' + (act ? '1' : '.25') + ';">'
                + (act ? (orden.desc ? '▼' : '▲') : '▼') + '</span></th>';
        }).join('');

        const c = cols[orden.i], s = orden.desc ? -1 : 1;
        const copia = datos.slice().sort((a, b) => {
            const x = a[c.k], y = b[c.k];
            if (c.t === 'n') return (Number(x) - Number(y)) * s;
            return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'es') * s;
        });
        cuerpo.innerHTML = copia.map(f => '<tr>' + celdas(f) + '</tr>').join('');

        cabe.querySelectorAll('th').forEach(th => {
            th.onclick = () => {
                const i = Number(th.dataset.i);
                /* Volver a la misma columna da vuelta el orden; una columna nueva
                   arranca por lo que se quiere ver primero: los números grandes y
                   los días viejos. */
                if (i === orden.i) orden.desc = !orden.desc;
                else { orden.i = i; orden.desc = cols[i].t === 'n'; }
                pintar();
            };
        });
    };
    pintar();
}
