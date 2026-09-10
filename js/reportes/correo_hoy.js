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

import { nf, esc, cuadro, cuadroRutas, estilos } from './pendiente.js?v=29.0677';

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

/**
 * DE LO QUE TRAE EL CORREO A LO QUE MUESTRA EL MODULO.
 *
 * Es la resta que Daniel hace a mano cada noche sobre el Excel de comercial, y
 * hasta el 10-sep-2026 la pantalla no la mostraba: abria con el resultado y el
 * numero no le cuadraba con su archivo.
 */
function cuadroCascada(k, tiendas) {
    if (!k || !k.trae) return '';
    const fila = (etiqueta, v, clase) => `<tr${clase ? ' class="' + clase + '"' : ''}>
        <td>${etiqueta}</td>
        <td class="n">${nf(v.guias)}</td>
        <td class="n">${nf(v.und)}</td></tr>`;
    return `<div class="pend-panel">
        <h3>DE DÓNDE SALE ESTE NÚMERO</h3>
        <div class="pend-cap">La misma resta que se hace sobre el Excel de comercial</div>
        <table>
          <thead><tr><th>PASO</th><th class="n">GUÍAS</th><th class="n">UNIDADES</th></tr></thead>
          <tbody>
            ${fila('El correo trae', k.trae)}
            ${fila('− Doble tramo → no es un pedido, es una reasignación',
                   k.dobleTramo, 'pend-gris')}
            ${fila('− Ya lo había mandado otro día', k.repetidas, 'pend-ojo')}
            <tr class="pend-total"><td>= NUEVO DE HOY → esto es el correo de hoy</td>
              <td class="n">${nf(k.nuevo.guias)}</td>
              <td class="n">${nf(k.nuevo.und)}</td></tr>
          </tbody>
        </table>
        <div class="pend-nota">Todo en <b>pares</b>: la caja de prepack cuenta por sus
          pares, igual que en el correo de comercial. Las ${nf(k.nuevo.guias)} guías
          nuevas se reparten en ${nf(tiendas)} tiendas.</div>
      </div>`;
}

/**
 * LO QUE COMERCIAL YA HABIA MANDADO ANTES.
 *
 * Va al pie del modulo, y lo pidio Daniel el 09-sep-2026 al ver la lista:
 * *"ahi se esta equivocando comercial, me esta mandando y esta inflando su
 * capacidad, porque ya me esta enviando ese pedido, ya fueron enviados. Es mas,
 * en el WMS ya esta hasta cerrado"*.
 *
 * Del correo de esa noche eran 7 guias por 3.057 pares, y de esas **6 el WMS ya
 * las tenia cerradas** —dos de 2.000 y 1.000 pares, del 26-ago—. Pasaba sin que
 * nadie se enterara.
 *
 * CALZADO O NO SALE DE LA ETIQUETA DEL CORREO, no del Maestro: estas guias no
 * tienen lineas abiertas en el WMS, asi que no hay SKU con que preguntarle. El
 * pie del cuadro lo dice, para que nadie lo lea como el gender de siempre.
 */
function cuadroRepetidas(filas) {
    const lista = (filas || []).filter(f => f && Number(f.pidio) > 0);
    if (!lista.length) return '';

    const bloque = (tipo) => {
        const suyas = lista.filter(f => (f.tipo || '') === tipo);
        if (!suyas.length) return '';
        const sub = suyas.reduce((s, f) => s + (Number(f.pidio) || 0), 0);
        return `<tr class="pend-zona">
            <td colspan="4">${esc(tipo.toUpperCase())}</td>
            <td class="n">${nf(sub)}</td><td class="n"></td></tr>` +
          suyas.map(f => `<tr${Number(f.wms) > 0 ? '' : ' class="pend-ojo"'}>
            <td class="pend-sangria">${esc(f.guia)}</td>
            <td>${esc(f.tienda)}</td>
            <td>${esc(f.prioridad)}</td>
            <td class="n">${esc(f.desde)}</td>
            <td class="n">${nf(f.pidio)}</td>
            <td class="n">${Number(f.wms) > 0 ? nf(f.wms) : 'cerrada'}</td>
          </tr>`).join('');
    };

    const total = lista.reduce((s, f) => s + (Number(f.pidio) || 0), 0);
    const cerradas = lista.filter(f => !(Number(f.wms) > 0));
    const undCerradas = cerradas.reduce((s, f) => s + (Number(f.pidio) || 0), 0);

    return `<div class="pend-panel pend-ancho">
        <h3>LO QUE COMERCIAL YA HABÍA MANDADO ANTES</h3>
        <div class="pend-cap">Guías que vienen en el correo de hoy pero que comercial
          ya había pedido otro día</div>
        <table>
          <thead><tr>
            <th>GUÍA</th><th>TIENDA</th><th>PRIORIDAD</th>
            <th class="n">LA MANDÓ EL</th><th class="n">PIDIÓ HOY</th>
            <th class="n">ABIERTO EN EL WMS</th>
          </tr></thead>
          <tbody>
            ${bloque('Calzado')}${bloque('No calzado')}
            <tr class="pend-total">
              <td colspan="4">TOTAL</td>
              <td class="n">${nf(total)}</td><td class="n"></td></tr>
          </tbody>
        </table>
        ${cerradas.length ? `<div class="pend-nota">
          <b>${nf(cerradas.length)} de estas ${nf(lista.length)} guías el WMS ya las tiene
          cerradas</b> —son ${nf(undCerradas)} pares—: ya se despacharon, o esas órdenes se
          cerraron sin atenderse. Comercial las está volviendo a pedir.</div>` : ''}
        <div class="pend-nota">Calzado y no calzado salen de la <b>etiqueta del correo</b>,
          no del Maestro: estas guías no tienen líneas abiertas en el WMS, así que no hay
          artículo al que preguntarle.</div>
      </div>`;
}

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
    const k = d.cascada || {};
    /* ARRANCA POR LO QUE TRAE EL CORREO. Daniel, 10-sep-2026: *"lo que siempre
       voy a hacer por default va a ser mirar cuánto tiene el correo, cincuenta
       mil. Entonces eso debe estar como inicio, y de ahí ya le vas haciendo el
       descuento"*. Antes la primera tarjeta decía "unidades que pidió comercial"
       y mostraba 38.142 cuando el correo traía 50.914: el número estaba bien
       calculado y mal rotulado, y no cuadraba con su archivo. */
    const tarjeta = (valor, etiqueta, clase) =>
        `<div class="pend-card"><div class="v${clase || ''}">${nf(valor)}</div>
           <div class="l">${etiqueta}</div></div>`;
    const tarjetas = k.trae ? `
      <div class="pend-cards">
        ${tarjeta(k.trae.und, 'LO QUE TRAE EL CORREO')}
        ${tarjeta(k.dobleTramo.und, 'DOBLE TRAMO, FUERA')}
        ${tarjeta(k.repetidas.und, 'YA LO HABÍA MANDADO')}
        ${tarjeta(c.unidades, 'NUEVO DE HOY', ' hot')}
        ${tarjeta(w.unidades, 'ABIERTO EN EL WMS')}
      </div>` : `
      <div class="pend-cards">
        ${tarjeta(c.guias, 'GUÍAS')}
        ${tarjeta(c.tiendas, 'TIENDAS')}
        ${tarjeta(c.unidades, 'NUEVO DE HOY', ' hot')}
        ${tarjeta(w.unidades, 'ABIERTO EN EL WMS')}
        ${tarjeta((d.sinAbrir || {}).guias, 'GUÍAS SIN ABRIR')}
      </div>`;

    const cuadros = [
        rotulo('LO QUE MANDÓ COMERCIAL HOY',
               `${nf(c.guias)} guías &middot; ${nf(c.unidades)} pares nuevos de hoy &middot; `
               + `la cantidad es la del correo`),
        cuadroCascada(d.cascada, c.tiendas),
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
        cuadroRepetidas(d.repetidas),
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
