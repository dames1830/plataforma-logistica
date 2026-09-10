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

import { nf, esc, cuadro, cuadroRutas, estilos, engancharBuscador }
    from './pendiente.js?v=29.0697';
import { icono } from '../services_v245/iconos.js?v=29.0697';

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
        <td class="c">${nf(v.guias)}</td>
        <td class="c">${nf(v.und)}</td></tr>`;
    /* VA PELADO. Daniel lo repaso renglon por renglon el 10-sep-2026 y saco el
       titulo, el pie, la palabra PASO, la explicacion del doble tramo y la nota
       de los pares: lo unico que queria ver es la resta. Los signos menos se
       quedan porque son la resta misma, no una explicacion. */
    return `<div class="pend-panel">
        <table>
          <thead><tr><th></th><th class="c">GUÍAS</th><th class="c">UNIDADES</th></tr></thead>
          <tbody>
            ${fila('Correo comercial', k.trae)}
            ${fila('− Doble tramo', k.dobleTramo, 'pend-gris')}
            ${fila('− Ya está en el pendiente de despacho', k.repetidas, 'pend-ojo')}
            <tr class="pend-total"><td>= NUEVO DE HOY → esto es el correo de hoy</td>
              <td class="c">${nf(k.nuevo.guias)}</td>
              <td class="c">${nf(k.nuevo.und)}</td></tr>
          </tbody>
        </table>
      </div>`;
}

/**
 * TIENDA A DESPACHAR.
 *
 * Daniel, 10-sep-2026: *"me dices que hay ochenta y dos tiendas pero solo veo
 * las diez primeras; quiero hacer scroll y verlas todas"*. Y sin la barrita de
 * progreso, con los numeros centrados, y con buscador y Excel arriba a la
 * derecha, igual que el detalle de no liberados.
 *
 * No usa `cuadro()` porque ese lo comparte el Pendiente, donde las diez primeras
 * y la barra sirven. Aca hace falta otra cosa.
 */
function cuadroTiendas(filas) {
    const lista = filas || [];
    if (!lista.length) return '';
    return `<div class="pend-panel">
        <div class="pend-cab2">
          <div><h3>TIENDA A DESPACHAR</h3></div>
          <div class="pend-acc2">
            <input type="search" id="tie_buscar" class="pend-buscar"
                   placeholder="Tienda o código">
            <button type="button" id="tie_xls" class="btn-icono btn-excel"
                    title="Exportar a Excel" aria-label="Exportar a Excel">${icono('excel', 18)}</button>
          </div>
        </div>
        <div class="pend-scroll">
          <table>
            <thead><tr>
              <th>TIENDA</th><th class="c">GUÍAS</th><th class="c">UNIDADES</th>
            </tr></thead>
            <tbody id="tie_filas">
              ${lista.map(f => `<tr data-b="${esc(String(f.k).toLowerCase())}">
                <td>${esc(f.k)}</td>
                <td class="c">${nf(f.ped)}</td>
                <td class="c">${nf(f.und)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="pend-suave" id="tie_cuenta"></div>
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
          <thead><tr><th></th><th class="c">GUÍAS</th><th class="c">UNIDADES</th></tr></thead>
          <tbody>
            ${filas.map(f => `<tr>
              <td>${esc(f.k)}</td>
              <td class="c">${nf(f.guias)}</td>
              <td class="c">${nf(f.und)}</td></tr>`).join('')}
            <tr class="pend-total"><td>= NUEVO DE HOY</td>
              <td class="c">${nf(tot.guias)}</td>
              <td class="c">${nf(tot.und)}</td></tr>
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

    return `<div class="pend-panel">
        <h3>PEDIDOS QUE YA ESTÁN EN EL PENDIENTE</h3>
        <table>
          <thead><tr>
            <th>GUÍA</th><th>TIENDA</th><th>PRIORIDAD</th>
            <th class="n">FECHA</th><th class="n">PIDIÓ HOY</th>
            <th class="n">ESTADO DEL WMS</th>
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

    /* "(en blanco)" y "ND" NO SON COLECCIONES: son articulos a los que el Maestro
       no les puso una. Se mandan al final para que no se lean como una temporada
       mas —Daniel, 10-sep-2026—. Lo demas sigue de mayor a menor. */
    const sinColeccion = (k) => /^\(|^nd$|^n\/?d$/i.test(String(k || '').trim());
    const colOrdenada = (d.coleccion || []).slice().sort((a, b) => {
        const sa = sinColeccion(a.k), sb = sinColeccion(b.k);
        return sa !== sb ? (sa ? 1 : -1) : (Number(b.und) || 0) - (Number(a.und) || 0);
    });

    const cuadros = [
        /* LOS TRES DE ARRIBA EN UNA FILA, un tercio cada uno. Lo pidio Daniel el
           10-sep-2026: se leen juntos —qué trajo el correo, qué es, y qué hay
           parado en el WMS— y apilados obligaban a bajar la pantalla. */
        `<div class="pend-tres">${cuadroCascada(d.cascada)}`
          + `${cuadroEtiquetas(d.cascada)}`
          + cuadro('CALZADO Y LO QUE NO LO ES',
                   'Lo separa el G. Gender del Maestro, no la etiqueta del correo',
                   d.gender, { etiqueta: 'TIPO', tope: 6, conPed: false, conPct: true,
                               centrado: true, sinBarra: true, conTotal: true })
          + `</div>`,
        /* LOS NO LIBERADOS SE MUDARON A Picking > Pedidos WMS -10-sep-2026-. Los
           huecos que dejaron los ocupan los dos cortes por articulo que estaban
           al final: asi el modulo abre con el correo entero y cierra con el
           detalle, sin bajar tres pantallas. */
        `<div class="pend-dos">`
          + cuadro('POR GENDER RIMS', 'Sale del Maestro de artículos',
                   d.rims, { etiqueta: 'GENDER RIMS', tope: 999, etiquetaPed: 'GUÍAS',
                             centrado: true, sinBarra: true })
          + cuadroRepetidas(d.repetidas)
          + `</div>`,
        /* TIENDA Y RUTA JUNTAS: las dos dicen a donde va lo de hoy, una por
           destino y la otra por como sale. Prioridad baja, que es otra pregunta. */
        /* TIENDA, RUTA Y COLECCION en una fila de tres. La coleccion va ENTERA,
           sin el "y 4 mas": son doce filas y caben. */
        `<div class="pend-tres">`
          + cuadroTiendas(d.tiendas)
          + cuadroRutas(d.rutas, d.rutasSinCruce,
                        { centrado: true, sinCap: true, sinPie: true })
          + cuadro('POR COLECCIÓN', '', colOrdenada,
                   { etiqueta: 'COLECCIÓN', tope: 999, conPct: true,
                     etiquetaPed: 'GUÍAS', centrado: true, sinBarra: true })
          + `</div>`,
        cuadro('POR QUÉ LO PIDIÓ COMERCIAL', 'La columna Prioridad del correo',
               d.prioridad, { etiqueta: 'PRIORIDAD', tope: 8, conPct: true,
                              etiquetaPed: 'GUÍAS' }),
    ].join('');

    return cab + tarjetas + `<div class="pend-grid">${cuadros}</div>` + estiloBloque();
}

/** Lo único de estilo que no está en `estilos()`: el rótulo que parte los bloques. */
function estiloBloque() {
    return `<style>
    /* Una fila entera partida en tres. En pantalla angosta se apilan, y una tabla
       que no entre se desliza sola en vez de romper el ancho. */
    #pend .pend-tres{grid-column:1/-1;display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
    #pend .pend-tres > .pend-ancho{grid-column:auto}
    #pend .pend-tres .pend-panel{overflow-x:auto}
    /* LOS DOS DE LA FILA TERMINAN A LA MISMA ALTURA. Sin esto cada uno tomaba
       la suya y quedaban desparejos -Daniel, 10-sep-2026-. La clase pend-ancho se
       neutraliza: adentro de esta fila un panel ocupa su mitad, no todo.
       OJO: nada de comillas invertidas aca dentro, esto vive en una plantilla. */
    #pend .pend-dos{grid-column:1/-1;display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}
    #pend .pend-dos > .pend-ancho{grid-column:auto}
    #pend .pend-dos .pend-panel{overflow-x:auto}
    /* Encabezado con acciones a la derecha, buscador y lista que se desliza con
       la cabecera fija. El alto sale de que entren unas doce filas sin empujar
       el resto del modulo. */
    #pend .pend-cab2{display:flex;align-items:flex-start;justify-content:space-between;
      gap:12px;flex-wrap:wrap}
    #pend .pend-acc2{display:flex;align-items:center;gap:8px}
    #pend .pend-buscar{font-size:.78rem;padding:6px 10px;border-radius:4px;
      border:1px solid var(--border);background:var(--input-bg);
      color:var(--text-strong);width:170px}
    #pend .pend-scroll{max-height:430px;overflow-y:auto;margin-top:9px}
    #pend .pend-scroll thead th{position:sticky;top:0;z-index:1}
    @media(max-width:1200px){#pend .pend-dos{grid-template-columns:1fr}}
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

    /* EL BUSCADOR filtra las filas que ya estan dibujadas: son cientos, no
       miles, asi que no hace falta volver a pintar la tabla. */
    const bus = raiz.querySelector('#nolib_buscar');
    const cuenta = raiz.querySelector('#nolib_cuenta');
    const filasTabla = () => Array.prototype.slice.call(
        raiz.querySelectorAll('#nolib_filas tr'));
    const contar = (visibles, total) => {
        if (!cuenta) return;
        cuenta.textContent = visibles === total
            ? nf(total) + ' pedidos'
            : nf(visibles) + ' de ' + nf(total) + ' pedidos';
    };
    if (bus) {
        const todas = filasTabla();
        contar(todas.length, todas.length);
        bus.addEventListener('input', () => {
            const q = bus.value.trim().toLowerCase();
            let n = 0;
            todas.forEach(tr => {
                const ok = !q || (tr.dataset.b || '').indexOf(q) !== -1;
                tr.hidden = !ok;
                if (ok) n++;
            });
            contar(n, todas.length);
        });
    }

    /* EL EXCEL BAJA LA LISTA COMPLETA, no lo que dejo ver el buscador: el archivo
       es para llevarselo al jefe, y una lista filtrada sin decirlo engana. */
    const xls = raiz.querySelector('#nolib_xls');
    if (xls) xls.addEventListener('click', () => {
        const filas = ((O.datos || {}).noLiberados || {}).detalle || [];
        if (!filas.length || typeof XLSX === 'undefined') return;
        const aoa = [['Orden', 'Destino', 'Tipo de orden', 'Creada', 'Dias', 'Pares']];
        filas.forEach(f => aoa.push([f.orden, f.destino, f.tipo, f.fecha,
                                     Number(f.dias) || 0, Number(f.pares) || 0]));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 12 },
                       { wch: 7 }, { wch: 9 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'No liberados');
        XLSX.writeFile(wb, 'Pedidos WMS no liberados ' + (fecha || '') + '.xlsx');
    });

    engancharBuscador(raiz, 'tie', {
        sacarFilas: () => (O.datos || {}).tiendas,
        cabecera: ['Tienda', 'Guias', 'Unidades'],
        aFila: (f) => [f.k, Number(f.ped) || 0, Number(f.und) || 0],
        archivo: 'Tienda a despachar', unidad: 'tiendas', fecha: fecha,
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
