/**
 * PICKING > PEDIDOS WMS
 *
 * Lo que el WMS tiene abierto y comercial NUNCA libero, solo de retail. Vivia en
 * `Despacho > Correo de Hoy` y Daniel lo mudo aca el 10-sep-2026: *"estos dos
 * reportes no tienen que estar en el correo de hoy, deberian estar en el modulo
 * de picking, creale un submodulo llamado Pedidos WMS"*. Tiene razon: no habla
 * del correo del dia, habla de lo que el CD tiene parado.
 *
 * POR QUE EXISTE. Daniel: *"para yo decirle a mi jefe que tenemos pedidos en el
 * WMS que todavia no estan liberados de hace, un ejemplo, de hace un mes"*.
 *
 * LOS DATOS SALEN DEL AREA `correo_hoy`, que es donde los publica
 * `robot/armar_pendiente.py` en la misma corrida. No se duplican: un mismo
 * numero calculado en dos sitios se desincroniza, y ya paso en este proyecto.
 */

import { nf, esc, estilos, engancharBuscador } from './pendiente.js?v=29.0710';
import { icono } from '../services_v245/iconos.js?v=29.0710';

/**
 * LO QUE EL WMS ABRE Y COMERCIAL NUNCA LIBERO.
 *
 * Daniel, 10-sep-2026: *"para yo decirle a mi jefe que tenemos pedidos en el WMS
 * que todavia no estan liberados de hace, un ejemplo, de hace un mes"*. Hasta hoy
 * este grupo solo se veia como una fila gris en el Pendiente: un total sin
 * nombres y sin fechas, con el que no se puede reclamar nada.
 *
 * Reemplaza al cuadro "¿el WMS ya tiene lo que mando comercial?", que quedo en
 * cero para siempre al sacar el doble tramo: las guias que faltaban abrir eran
 * exactamente esas.
 *
 * LA ANTIGUEDAD SALE DE CUANDO EL WMS CREO LA ORDEN. Medido el 09-09-2026: 739
 * ordenes / 251.742 pares, la mas vieja del 01-nov-2025 -312 dias-.
 */
function cuadroPareto(n) {
    if (!n || !n.ordenes) return '';
    const filas = n.pareto || [];
    /* LO QUE EMPIEZA CON 50 Y EL MAESTRO NO CONOCE NO SE BORRA EN SILENCIO: es el
       caso que Daniel anticipo, una tienda nueva que todavia no esta cargada. */
    const fm = n.fueraMaestro;
    /* EL PARETO VA DE LO MAS VIEJO A LO MAS NUEVO, no de mayor a menor: lo que se
       reclama es la antiguedad, y el acumulado dice cuanto pesa lo viejo. */
    return `<div class="pend-panel">
        <h3>PEDIDOS WMS NO LIBERADOS</h3>
        <table>
          <thead><tr>
            <th>DESDE CUÁNDO ESPERA</th><th class="c">PEDIDOS</th>
            <th class="c">PARES</th><th class="c">%</th><th class="c">ACUM.</th>
          </tr></thead>
          <tbody>
            ${filas.map(f => {
                const viejo = /mas de 60|31 a 60|16 a 30/.test(f.k);
                return `<tr${viejo ? ' class="pend-ojo"' : ''}>
                  <td>${esc(f.k)}</td>
                  <td class="c">${nf(f.ped)}</td>
                  <td class="c">${nf(f.und)}</td>
                  <td class="c">${f.pct}%</td>
                  <td class="c">${f.acum}%</td></tr>`;
            }).join('')}
            <tr class="pend-total"><td>TOTAL</td>
              <td class="c">${nf(n.ordenes)}</td>
              <td class="c">${nf(n.unidades)}</td>
              <td class="c"></td><td class="c"></td></tr>
          </tbody>
        </table>
        ${fm && fm.und > 0 ? `<div class="pend-suave">${fm.destinos.map(x =>
            esc(x.k) + ' (' + nf(x.und) + ')').join(' &middot; ')}</div>` : ''}
      </div>`;
}

/**
 * EL DETALLE, CON NOMBRE Y FECHA DE CADA UNO.
 *
 * VAN LOS 275, NO UNA MUESTRA. Daniel, 10-sep-2026: *"me dices que hay
 * doscientos setenta y cinco pedidos, pero necesito hacer scroll y mirarlos"*.
 * Antes se mostraban las 15 mas viejas y el resto solo existia en el archivo
 * bajado: para reclamar hace falta poder buscar una orden ahi mismo.
 *
 * La lista se desliza dentro de su propio recuadro -la cabecera queda fija- y el
 * buscador filtra por lo que sea: orden, destino o tipo.
 */
function cuadroDetalle(n) {
    const filas = (n && n.detalle) || [];
    if (!filas.length) return '';
    return `<div class="pend-panel">
        <div class="pend-cab2">
          <div>
            <h3>TRACKING PEDIDOS</h3>
            <div class="pend-cap">Solo retail &middot; ${nf(filas.length)} pedidos</div>
          </div>
          <div class="pend-acc2">
            <input type="search" id="nolib_buscar" class="pend-buscar"
                   placeholder="Orden, destino o tipo">
            <button type="button" id="nolib_xls" class="btn-icono btn-excel"
                    title="Exportar a Excel" aria-label="Exportar a Excel">${icono('excel', 18)}</button>
          </div>
        </div>
        <div class="pend-scroll">
          <table>
            <thead><tr>
              <th>ORDEN</th><th>DESTINO</th><th>TIPO</th>
              <th class="n">CREADA</th><th class="n">DÍAS</th><th class="n">PARES</th>
            </tr></thead>
            <tbody id="nolib_filas">
              ${filas.map(f => `<tr${Number(f.dias) > 30 ? ' class="pend-ojo"' : ''}
                data-b="${esc((f.orden + ' ' + f.destino + ' ' + f.tipo).toLowerCase())}">
                <td>${esc(f.orden)}</td>
                <td>${esc(f.destino)}</td>
                <td>${esc(f.tipo)}</td>
                <td class="n">${esc(f.fecha)}</td>
                <td class="n">${nf(f.dias)}</td>
                <td class="n">${nf(f.pares)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="pend-suave" id="nolib_cuenta"></div>
      </div>`;
}

/**
 * CALZADO Y LO QUE NO LO ES, de lo no liberado.
 *
 * Va debajo del pareto y con su mismo ancho. Aca el gender SI sale del Maestro
 * -no de una etiqueta-: estas ordenes tienen lineas abiertas en el WMS, o sea
 * articulo al que preguntarle.
 */
function cuadroGender(n) {
    const filas = (n && n.gender) || [];
    if (!filas.length) return '';
    const tot = filas.reduce((a, f) => a + (Number(f.und) || 0), 0);
    return `<div class="pend-panel">
        <h3>GENDER</h3>
        <table>
          <thead><tr><th>TIPO</th><th class="c">PEDIDOS</th>
            <th class="c">PARES</th><th class="c">%</th></tr></thead>
          <tbody>
            ${filas.map(f => `<tr>
              <td>${esc(f.k)}</td>
              <td class="c">${nf(f.ped)}</td>
              <td class="c">${nf(f.und)}</td>
              <td class="c">${tot ? Math.round(100 * f.und / tot) : 0}%</td></tr>`).join('')}
            <tr class="pend-total"><td>TOTAL</td>
              <td class="c">${nf(n.ordenes)}</td>
              <td class="c">${nf(tot)}</td><td class="c">100%</td></tr>
          </tbody>
        </table>
      </div>`;
}

/* ── EL MONTAJE ─────────────────────────────────────────────────────────────── */

export function montarPedidosWms(raiz, OPC) {
    const O = OPC || {};
    const d = O.datos;
    const fecha = O.fecha || (d && d.fecha) || '';
    const n = d && d.noLiberados;

    const cab = `
      <div class="pend-head">
        <div>
          <h2>Pedidos WMS</h2>
          <div class="pend-sub">${d && d.generado
              ? 'lo que el WMS tiene abierto y comercial no ha liberado &middot; armado el '
                + esc(d.generado)
              : 'se arma solo cuando llega el correo de comercial'}</div>
        </div>
        <div class="pend-acc">
          <div class="pend-cal">
            <input type="date" id="pwms_fecha" value="${esc(fecha)}">
          </div>
        </div>
      </div>`;

    if (!n || !n.ordenes) {
        raiz.innerHTML = `<div id="pend">${estilos()}${cab}
          <div class="pend-panel pend-nada">
            <div class="pend-nada-t">Todavía no hay datos de esta fecha</div>
            <div class="pend-cap">Los arma el robot cuando llega el correo de
            comercial, entre las 19:00 y las 20:00.</div></div>${estiloPropio()}</div>`;
        engancharFecha(raiz, O);
        return;
    }

    /* UNO A LA IZQUIERDA Y OTRO A LA DERECHA, mitad y mitad y a la misma altura,
       como lo pidio Daniel. Mismo diseno y mismo tamano que tenian en el correo. */
    raiz.innerHTML = `<div id="pend">${estilos()}${cab}
        <div class="pend-grid">
          <div class="pend-dos">
            <div class="pend-col">${cuadroPareto(n)}${cuadroGender(n)}</div>
            ${cuadroDetalle(n)}
          </div>
        </div>${estiloPropio()}</div>`;

    engancharBuscador(raiz, 'nolib', {
        sacarFilas: () => ((O.datos || {}).noLiberados || {}).detalle,
        cabecera: ['Orden', 'Destino', 'Tipo de orden', 'Creada', 'Dias', 'Pares'],
        aFila: (f) => [f.orden, f.destino, f.tipo, f.fecha,
                       Number(f.dias) || 0, Number(f.pares) || 0],
        archivo: 'Pedidos WMS no liberados', unidad: 'pedidos', fecha: fecha,
    });
    engancharFecha(raiz, O);
}

function engancharFecha(raiz, O) {
    const cal = raiz.querySelector('#pwms_fecha');
    if (!cal) return;
    cal.addEventListener('change', () => {
        if (cal.value && typeof O.alCambiarFecha === 'function') O.alCambiarFecha(cal.value);
    });
    cal.addEventListener('click', () => {
        if (cal.showPicker) { try { cal.showPicker(); } catch (e) { /* el navegador no lo deja */ } }
    });
}

/** Lo unico de estilo que no esta en `estilos()`. OJO: nada de comillas
 *  invertidas adentro del bloque, esto vive en una plantilla. */
function estiloPropio() {
    return `<style>
    #pend .pend-dos{grid-column:1/-1;display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
    #pend .pend-dos .pend-panel{overflow-x:auto}
    /* La columna izquierda lleva dos cuadros apilados: el pareto y el
       gender, con el mismo ancho y el hueco de la grilla. */
    #pend .pend-col{display:flex;flex-direction:column;gap:16px}
    @media(max-width:1200px){#pend .pend-dos{grid-template-columns:1fr}}
    #pend .pend-cab2{display:flex;align-items:flex-start;justify-content:space-between;
      gap:12px;flex-wrap:wrap}
    #pend .pend-acc2{display:flex;align-items:center;gap:8px}
    #pend .pend-buscar{font-size:.78rem;padding:6px 10px;border-radius:4px;
      border:1px solid var(--border);background:var(--input-bg);
      color:var(--text-strong);width:170px}
    #pend .pend-scroll{max-height:430px;overflow-y:auto;margin-top:9px}
    #pend .pend-scroll thead th{position:sticky;top:0;z-index:1}
    #pend .pend-suave{margin-top:9px;font-size:var(--t-xs);color:var(--text-muted);
      opacity:.75;font-variant-numeric:tabular-nums}
    </style>`;
}
