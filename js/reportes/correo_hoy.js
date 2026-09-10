/**
 * DESPACHO > CORREO DE HOY
 *
 * El desglose del correo de comercial que llegó hoy. Lo pidió Daniel el
 * 09-sep-2026, el mismo día que sacó el correo del día del Pendiente de
 * Despacho: *"lo de hoy viene a entrar a PEDIDOS, no es un pendiente porque
 * recién está llegando"*. Los dos módulos quedaron juntos en Despacho.
 *
 * VA PARTIDO EN DOS BLOQUES, Y NO ES UN CAPRICHO DE DISEÑO: el correo de
 * comercial NO trae columna de artículo —sus columnas son Cadena, TIEND, NOMBR,
 * Prioridad, Etiqueta, FECHA, GUIA, ALMAC, Despachar, Cantidad y CD—. Comercial
 * libera la GUÍA entera. Entonces:
 *
 *   LO QUE MANDÓ COMERCIAL      la unidad es la guía y la cantidad es la del
 *                               correo -> tienda, prioridad, y si el WMS ya la
 *                               tiene abierta
 *   LO QUE EL WMS TIENE ABIERTO todo lo que necesita el artículo -> gender rims,
 *                               colección, calzado y el corte por ruta
 *
 * Juntarlos en una sola lista habría dejado dos totales distintos sin decir por
 * qué, y esos cuadros se leen con la calculadora al lado.
 *
 * Los datos los publica `robot/armar_pendiente.py` en el área `correo_hoy`,
 * en la misma corrida que arma el pendiente.
 */

import { nf, esc, cuadro, cuadroRutas, estilos } from './pendiente.js?v=29.0671';

/* ── LA CABECERA ────────────────────────────────────────────────────────────── */

function cabecera(d, fecha, dias) {
    dias = Array.isArray(dias) ? dias.slice().sort().reverse() : [];
    return `
      <div class="pend-head">
        <div>
          <h2>Correo de hoy</h2>
          <div class="pend-sub">${d && d.generado
              ? 'lo que mandó comercial el ' + esc(fecha) + ' &middot; armado el ' + esc(d.generado)
              : 'se arma solo en cuanto el robot guarda el correo de comercial'}</div>
        </div>
        <div class="pend-acc">
          <div class="pend-cal">
            <input type="date" id="correo_fecha" value="${esc(fecha)}"
                   ${dias.length ? `min="${esc(dias[dias.length - 1])}" max="${esc(dias[0])}"` : ''}>
            ${dias.length
                ? `<span class="pend-guardados">${nf(dias.length)} ${dias.length === 1
                    ? 'día guardado' : 'días guardados'}</span>`
                : ''}
          </div>
        </div>
      </div>`;
}

/* ── EL CUADRO PROPIO DE ESTE MÓDULO ────────────────────────────────────────── */

/**
 * ¿EL WMS YA TIENE LO QUE MANDÓ COMERCIAL?
 *
 * No existía en ninguna pantalla. Una guía que comercial mandó y que el WMS no
 * tiene abierta NO SE PUEDE PICAR HOY, y hasta ahora eso no se veía en ningún
 * lado: se notaba recién al final del día, cuando faltaba despachar.
 *
 * Medido la primera noche, 09-sep-2026: de 879 guías del correo, el WMS tenía
 * abiertas 461 y le faltaban 418 —8.433 unidades de 30 tiendas—.
 */
function cuadroLlegada(d) {
    const c = d.correo || {}, w = d.wms || {}, s = d.sinAbrir || {};
    return `
      <div class="pend-panel">
        <h3>¿EL WMS YA TIENE LO QUE MANDÓ COMERCIAL?</h3>
        <div class="pend-cap">Una guía que el WMS no tiene abierta no se puede trabajar todavía</div>
        <table>
          <thead><tr>
            <th>ESTADO DE LA GUÍA</th><th class="n">GUÍAS</th>
            <th class="n">PIDIÓ COMERCIAL</th><th class="n">ABIERTO EN EL WMS</th>
          </tr></thead>
          <tbody>
            <tr><td><b>Abierta en el WMS</b> → se puede trabajar</td>
                <td class="n"><b>${nf(w.guias)}</b></td>
                <td class="n">${nf(d.pedidoAbiertas)}</td>
                <td class="n"><b>${nf(w.unidades)}</b></td></tr>
            <tr class="pend-ojo"><td>Todavía no abierta en el WMS</td>
                <td class="n">${nf(s.guias)}</td>
                <td class="n">${nf(s.unidades)}</td>
                <td class="n">—</td></tr>
            <tr class="pend-total"><td>TOTAL DEL CORREO</td>
                <td class="n">${nf(c.guias)}</td>
                <td class="n">${nf(c.unidades)}</td>
                <td class="n">${nf(w.unidades)}</td></tr>
          </tbody>
        </table>
        ${s.guias ? `<div class="pend-nota"><b>${nf(s.guias)} guías</b> de
          ${nf(s.tiendas)} tiendas llegaron por correo y el WMS todavía no las tiene
          abiertas. Son ${nf(s.unidades)} unidades que hoy no se pueden picar.</div>` : ''}
      </div>`;
}

/** El rótulo que separa los dos bloques y dice sobre qué total va cada uno. */
const rotulo = (titulo, cuenta) =>
    `<div class="pend-bloque"><h4>${esc(titulo)}</h4><div class="c">${cuenta}</div></div>`;

/* ── EL CUERPO ──────────────────────────────────────────────────────────────── */

function cuerpo(d, fecha, dias) {
    const cab = cabecera(d, fecha, dias);

    /* SIN DATOS NO SE INVENTA UN CERO, igual que en el Pendiente: un cuadro en
       cero se lee como "hoy comercial no mandó nada", que es muy distinto de
       "todavía no llegó el correo". */
    if (!d || !d.correo) {
        return cab + `<div class="pend-panel pend-nada">
            <div class="pend-nada-t">Todavía no llegó el correo de esta fecha</div>
            <div class="pend-cap">Se arma solo en cuanto el robot guarda el correo de
            comercial, entre las 19:00 y las 20:00. Si ya pasó esa hora y sigue vacío,
            revisar el log del robot.</div></div>`;
    }

    const c = d.correo, w = d.wms || {};
    const tarjetas = `
      <div class="pend-cards">
        <div class="pend-card"><div class="v">${nf(c.guias)}</div>
          <div class="l">GUÍAS</div></div>
        <div class="pend-card"><div class="v">${nf(c.tiendas)}</div>
          <div class="l">TIENDAS</div></div>
        <div class="pend-card"><div class="v hot">${nf(c.unidades)}</div>
          <div class="l">UNIDADES QUE PIDIÓ COMERCIAL</div></div>
        <div class="pend-card"><div class="v">${nf(w.unidades)}</div>
          <div class="l">ABIERTO EN EL WMS</div></div>
        <div class="pend-card"><div class="v">${nf((d.sinAbrir || {}).guias)}</div>
          <div class="l">GUÍAS SIN ABRIR</div></div>
      </div>`;

    const cuadros = [
        rotulo('LO QUE MANDÓ COMERCIAL HOY',
               `${nf(c.guias)} guías &middot; ${nf(c.unidades)} unidades &middot; la cantidad es la del correo`),
        cuadroLlegada(d),
        cuadro('A QUÉ TIENDA HAY QUE DESPACHAR',
               `Las 10 más cargadas de ${nf(c.tiendas)}`,
               d.tiendas, { etiqueta: 'TIENDA', tope: 10, etiquetaPed: 'GUÍAS' }),
        cuadro('POR QUÉ LO PIDIÓ COMERCIAL', 'La columna Prioridad del correo',
               d.prioridad, { etiqueta: 'PRIORIDAD', tope: 8, conPct: true,
                              etiquetaPed: 'GUÍAS' }),
        rotulo('DE ESO, LO QUE EL WMS TIENE ABIERTO',
               `${nf(w.guias)} guías &middot; ${nf(w.unidades)} unidades &middot; el correo no trae el `
               + `artículo, así que estos cortes solo se pueden hacer sobre lo abierto`),
        cuadro('POR GENDER RIMS', 'Sale del Maestro de artículos',
               d.rims, { etiqueta: 'GENDER RIMS', tope: 10, etiquetaPed: 'GUÍAS' }),
        cuadro('POR COLECCIÓN', 'La Coleccion PO del Maestro — no la Temporada del mezzanine',
               d.coleccion, { etiqueta: 'COLECCIÓN', tope: 8, conPct: true,
                              etiquetaPed: 'GUÍAS' }),
        cuadro('CALZADO Y LO QUE NO LO ES',
               'Lo separa el G. Gender del Maestro, no la etiqueta del correo',
               d.gender, { etiqueta: 'TIPO', tope: 6, conPed: false, conPct: true,
                           nota: 'Un total que mezcla zapatos con cajas no dice nada.' }),
        cuadroRutas(d.rutas, d.rutasSinCruce),
    ].join('');

    return cab + tarjetas + `<div class="pend-grid">${cuadros}</div>` + estiloBloque();
}

/** Lo único de estilo que no está en `estilos()`: el rótulo que parte los bloques. */
function estiloBloque() {
    return `<style>
    #pend .pend-bloque{grid-column:1/-1;margin:6px 0 -4px;padding:0 2px}
    #pend .pend-bloque h4{margin:0;font-size:var(--t-sm);font-weight:900;
      letter-spacing:.06em;color:var(--text-strong)}
    #pend .pend-bloque .c{font-size:var(--t-sm);color:var(--text-muted);margin-top:2px}
    </style>`;
}

/* ── EL MONTAJE ─────────────────────────────────────────────────────────────── */

export function montarCorreoHoy(raiz, OPC) {
    const O = OPC || {};
    const d = O.datos;
    const fecha = O.fecha || (d && d.fecha) || '';

    /* EL ENVOLTORIO TIENE QUE SER `#pend`: los estilos que se comparten con el
       Pendiente cuelgan todos de ese id. */
    raiz.innerHTML = `<div id="pend">${estilos()}${cuerpo(d, fecha, O.fechas)}</div>`;

    const cal = raiz.querySelector('#correo_fecha');
    if (cal) {
        cal.addEventListener('change', () => {
            if (cal.value && typeof O.alCambiarFecha === 'function') O.alCambiarFecha(cal.value);
        });
        /* Clic en cualquier parte del campo abre el calendario, no solo en el
           iconito. Mismo recurso que el Pendiente. */
        cal.addEventListener('click', () => {
            if (cal.showPicker) { try { cal.showPicker(); } catch (e) { /* el navegador no lo deja */ } }
        });
    }
}
