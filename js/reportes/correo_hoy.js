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

import { nf, esc, cuadro, cuadroRutas, estilos } from './pendiente.js?v=29.0685';

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
function cuadroNoLiberados(n) {
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
            <th>DESDE CUÁNDO ESPERA</th><th class="n">PEDIDOS</th>
            <th class="n">PARES</th><th class="n">%</th><th class="n">ACUM.</th>
          </tr></thead>
          <tbody>
            ${filas.map(f => {
                const viejo = /mas de 60|31 a 60|16 a 30/.test(f.k);
                return `<tr${viejo ? ' class="pend-ojo"' : ''}>
                  <td>${esc(f.k)}</td>
                  <td class="n">${nf(f.ped)}</td>
                  <td class="n">${nf(f.und)}</td>
                  <td class="n">${f.pct}%</td>
                  <td class="n">${f.acum}%</td></tr>`;
            }).join('')}
            <tr class="pend-total"><td>TOTAL</td>
              <td class="n">${nf(n.ordenes)}</td>
              <td class="n">${nf(n.unidades)}</td>
              <td class="n"></td><td class="n"></td></tr>
          </tbody>
        </table>
        ${fm && fm.und > 0 ? `<div class="pend-suave">${fm.destinos.map(x =>
            esc(x.k) + ' (' + nf(x.und) + ')').join(' &middot; ')}</div>` : ''}
      </div>`;
}

/**
 * EL DETALLE, CON NOMBRE Y FECHA DE CADA UNO.
 *
 * En pantalla van las 15 mas viejas —la lista entera son cientos— y el boton baja
 * el CSV completo. Daniel lo pidio para llevarselo a su jefe, y para eso hace
 * falta el papel, no un total.
 */
function cuadroNoLiberadosDetalle(n) {
    const filas = (n && n.detalle) || [];
    if (!filas.length) return '';
    const top = filas.slice(0, 15);
    return `<div class="pend-panel pend-ancho">
        <h3>UNO POR UNO, DEL MÁS VIEJO AL MÁS NUEVO</h3>
        <div class="pend-cap">Solo retail &middot; las 15 más viejas de ${nf(filas.length)} &middot; el botón baja la lista completa</div>
        <table>
          <thead><tr>
            <th>ORDEN</th><th>DESTINO</th><th>TIPO</th>
            <th class="n">CREADA</th><th class="n">DÍAS</th><th class="n">PARES</th>
          </tr></thead>
          <tbody>
            ${top.map(f => `<tr${Number(f.dias) > 30 ? ' class="pend-ojo"' : ''}>
              <td>${esc(f.orden)}</td>
              <td>${esc(f.destino)}</td>
              <td>${esc(f.tipo)}</td>
              <td class="n">${esc(f.fecha)}</td>
              <td class="n">${nf(f.dias)}</td>
              <td class="n">${nf(f.pares)}</td></tr>`).join('')}
          </tbody>
        </table>
        <button id="nolib_csv" class="btn-icono btn-excel pend-btn"
                style="margin-top:11px">BAJAR LOS ${nf(filas.length)} EN CSV</button>
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
function cuadroCascada(k) {
    if (!k || !k.trae) return '';
    const fila = (etiqueta, v, clase) => `<tr${clase ? ' class="' + clase + '"' : ''}>
        <td>${etiqueta}</td>
        <td class="n">${nf(v.guias)}</td>
        <td class="n">${nf(v.und)}</td></tr>`;
    /* VA PELADO. Daniel lo repaso renglon por renglon el 10-sep-2026 y saco el
       titulo, el pie, la palabra PASO, la explicacion del doble tramo y la nota
       de los pares: lo unico que queria ver es la resta. Los signos menos se
       quedan porque son la resta misma, no una explicacion. */
    return `<div class="pend-panel">
        <table>
          <thead><tr><th></th><th class="n">GUÍAS</th><th class="n">UNIDADES</th></tr></thead>
          <tbody>
            ${fila('Correo comercial', k.trae)}
            ${fila('− Doble tramo', k.dobleTramo, 'pend-gris')}
            ${fila('− Ya lo había mandado otro día', k.repetidas, 'pend-ojo')}
            <tr class="pend-total"><td>= NUEVO DE HOY → esto es el correo de hoy</td>
              <td class="n">${nf(k.nuevo.guias)}</td>
              <td class="n">${nf(k.nuevo.und)}</td></tr>
          </tbody>
        </table>
      </div>`;
}

/**
 * QUE ES ESO NUEVO DE HOY, por la ETIQUETA DEL CORREO.
 *
 * Va justo debajo de la cascada y con la misma forma: arranca en los 38.142 y
 * los reparte. Lo pidio Daniel el 10-sep-2026: *"de ahi partes, ahi me pones el
 * gender segun la etiqueta que hizo el correo, de esos treinta y ocho mil, que
 * es"*.
 *
 * SALE DE LA ETIQUETA Y NO DEL MAESTRO a proposito: es el reparto que hace
 * comercial, y tiene que sumar exactamente el mismo total de arriba. El corte
 * por el gender del Maestro esta mas abajo, sobre lo que el WMS tiene abierto.
 */
function cuadroEtiquetas(k) {
    const filas = (k && k.etiquetas) || [];
    if (!filas.length) return '';
    const tot = filas.reduce((a, f) => ({ guias: a.guias + (f.guias || 0),
                                          und: a.und + (f.und || 0) }),
                             { guias: 0, und: 0 });
    return `<div class="pend-panel">
        <table>
          <thead><tr><th></th><th class="n">GUÍAS</th><th class="n">UNIDADES</th></tr></thead>
          <tbody>
            ${filas.map(f => `<tr>
              <td>${esc(f.k)}</td>
              <td class="n">${nf(f.guias)}</td>
              <td class="n">${nf(f.und)}</td></tr>`).join('')}
            <tr class="pend-total"><td>= NUEVO DE HOY</td>
              <td class="n">${nf(tot.guias)}</td>
              <td class="n">${nf(tot.und)}</td></tr>
          </tbody>
        </table>
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
        /* LOS TRES DE ARRIBA EN UNA FILA, un tercio cada uno. Lo pidio Daniel el
           10-sep-2026: se leen juntos —qué trajo el correo, qué es, y qué hay
           parado en el WMS— y apilados obligaban a bajar la pantalla. */
        `<div class="pend-tres">${cuadroCascada(d.cascada)}`
          + `${cuadroEtiquetas(d.cascada)}${cuadroNoLiberados(d.noLiberados)}</div>`,
        /* LOS DOS DETALLES VAN PEGADOS A ESA FILA, no al final de la pagina.
           Daniel, 10-sep-2026: son el respaldo de los dos cuadros de arriba -uno
           por uno los no liberados, y las guias que comercial repitio-, y al
           fondo obligaban a recorrer el modulo entero para llegar. */
        cuadroNoLiberadosDetalle(d.noLiberados),
        cuadroRepetidas(d.repetidas),
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
    /* Los dos cuadros del correo, apilados dentro de una sola celda: el segundo
       tiene que quedar DEBAJO del primero, no al costado. El hueco es el mismo
       que separa los paneles de la grilla. */
    /* Una fila entera partida en tres. En pantalla angosta se apilan, y una tabla
       que no entre se desliza sola en vez de romper el ancho. */
    #pend .pend-tres{grid-column:1/-1;display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
    #pend .pend-tres .pend-panel{overflow-x:auto}
    @media(max-width:1200px){#pend .pend-tres{grid-template-columns:1fr}}
    /* La referencia de lo que quedo fuera del maestro: se deja a la vista pero
       sin pesar. Daniel: *"que no se note mucho, con una letra pluma"*. */
    #pend .pend-suave{margin-top:9px;font-size:var(--t-xs);color:var(--text-muted);
      opacity:.75;font-variant-numeric:tabular-nums}
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

    /* EL CSV SE ARMA ACA, con lo que ya vino publicado: no hay que pedirle nada
       al servidor ni esperar a que el robot suba un Excel. */
    const btn = raiz.querySelector('#nolib_csv');
    if (btn) btn.addEventListener('click', () => {
        const filas = ((O.datos || {}).noLiberados || {}).detalle || [];
        if (!filas.length) return;
        const cab = ['Orden', 'Destino', 'Tipo de orden', 'Creada', 'Dias', 'Pares'];
        const esc2 = (v) => {
            const t = String(v == null ? '' : v);
            return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        };
        const cuerpo = filas.map(f => [f.orden, f.destino, f.tipo, f.fecha, f.dias, f.pares]
            .map(esc2).join(';')).join('\n');
        /* El BOM va adelante para que Excel abra los acentos bien. */
        const blob = new Blob(['\ufeff' + cab.join(';') + '\n' + cuerpo],
                              { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'No liberados ' + (fecha || '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

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
