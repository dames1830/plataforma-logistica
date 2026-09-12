/**
 * RECIBIDO Y SIN PICAR  —  va al pie de `Análisis SKU › Artículo`.
 *
 * Lo que entró por recepción, ya está en el sistema y NO SALE A TIENDA. Lo pidió
 * Daniel el 10-sep-2026 y responde una pregunta que no tenía respuesta en
 * ninguna pantalla: *lo compré, ya lo tengo, y no se está moviendo*.
 *
 * VA EN DOS CUADROS, uno al lado del otro, y no es capricho de diseño: de los
 * 2.003 SKU del 09-09, **1.707 nunca se picaron**. En una sola tabla las cinco
 * columnas del pick salían vacías en el 85% de las filas y el reporte se leía
 * como un mar de guiones —Daniel, mirando la primera versión: *"ahora no hay
 * nada"*—. Cada cuadro lleva SOLO las columnas que le sirven.
 *
 * SOLO CANAL RETAIL. El filtro lo hace el robot: destino que empieza con 50 Y
 * está en el maestro de rutas. Ver el skill `una-guia-un-lugar`, sección 0-ter.
 *
 * Los datos los publica `robot/recibido_sin_picar.py` en el área del mismo
 * nombre, con fecha MASTER: es una foto, no una serie por día.
 */

import { nf, esc, estilos, engancharBuscador } from './pendiente.js?v=29.0728';
import { icono } from '../services_v245/iconos.js?v=29.0728';
import { laminaResumen } from '../services_v245/laminas.js?v=29.0728';

/* Las columnas que valen para los dos, y las que solo tienen sentido cuando
   hubo pick. Separarlas es lo que evita el mar de guiones. */
const COMUNES = [
    ['sku', 'SKU', ''], ['origen', 'ORIGEN', ''],
    ['marca', 'GENDER', ''], ['colec', 'COLECCIÓN', ''],
    ['asn', 'ASN', ''], ['lpnEntrada', 'LPN DE ENTRADA', ''],
    ['recibido', 'RECIBIDO', 'c'], ['dias', 'DÍAS', 'c'], ['pares', 'PARES', 'c'],
    /* Lo que si se pico, pero fuera de tienda. Cero aca = nadie lo toco. */
    ['otroCanal', 'PICADO A OTRO CANAL', 'c'],
];
const DEL_PICK = [
    ['picados', 'PICADOS', 'c'], ['picadoEl', 'PICADO EL', 'c'],
    ['lpnPick', 'LPN DEL PICK', ''], ['carton', 'CARTÓN OBLPN', ''],
    ['uPick', 'USUARIO PICKING', ''], ['uEmb', 'USUARIO EMBALAJE', ''],
];
const NUMERICAS = ['dias', 'pares', 'picados', 'otroCanal'];

function tabla(pref, titulo, pie, filas, cols, ambar) {
    return `<div class="pend-panel">
        <div class="rsp-cab">
          <div><h3>${esc(titulo)}</h3><div class="pend-cap">${pie}</div></div>
          <div class="rsp-acc">
            <input type="search" id="${pref}_buscar" class="rsp-buscar"
                   placeholder="SKU, ASN, origen o usuario">
            <button type="button" id="${pref}_xls" class="btn-icono btn-excel"
                    title="Exportar a Excel" aria-label="Exportar a Excel">${icono('excel', 18)}</button>
          </div>
        </div>
        <div class="rsp-scroll">
          <table>
            <thead><tr>${cols.map(([, t, c]) =>
                `<th${c ? ' class="c"' : ''}>${t}</th>`).join('')}</tr></thead>
            <tbody id="${pref}_filas">
              ${filas.map(f => `<tr${ambar ? ' class="pend-ojo"' : ''}
                data-b="${esc([f.sku, f.asn, f.origen, f.marca, f.colec, f.uPick, f.uEmb]
                    .filter(Boolean).join(' ').toLowerCase())}">
                ${cols.map(([k, , c]) => `<td${c ? ' class="c"' : ''}>${
                    NUMERICAS.indexOf(k) >= 0 ? nf(f[k])
                        : (esc(f[k]) || '<span class="rsp-vacio">—</span>')
                }</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="pend-suave" id="${pref}_cuenta"></div>
      </div>`;
}

export function montarRecibidoSinPicar(raiz, OPC) {
    const O = OPC || {};
    const d = O.datos;
    if (!raiz) return;

    if (!d || !d.tarjetas) {
        raiz.innerHTML = `<div id="pend" class="rsp">${estilos()}${estiloPropio()}
          <div class="pend-panel pend-nada">
            <div class="pend-nada-t">Todavía no hay estudio de recibido sin picar</div>
            <div class="pend-cap">Lo arma el robot cruzando el ASN con el picking y el
            OBLPN. Si ya corrió y esto sigue vacío, conviene mirar el log de la
            corrida.</div></div></div>`;
        return;
    }

    const t = d.tarjetas;
    const nunca = (d.filas || []).filter(f => !f.picados);
    const pocos = (d.filas || []).filter(f => f.picados > 0);

    const tarjeta = (v, l, clase) =>
        `<div class="pend-card"><div class="v${clase || ''}">${nf(v)}</div>
           <div class="l">${l}</div></div>`;

    raiz.innerHTML = `<div id="pend" class="rsp">${estilos()}${estiloPropio()}
      <div class="pend-head">
        <div>
          <h2>Recibido y sin picar</h2>
          <div class="pend-sub">Entró por recepción, ya está en el sistema y no sale a
            tienda &middot; solo importación y nacional, canal retail &middot;
            al ${esc(d.fecha || '')}</div>
        </div>
      </div>

      <div class="pend-cards rsp-cards">
        <button type="button" id="rsp_foto" class="btn-icono rsp-cam"
                title="Armar la lámina del resumen para mandarla por WhatsApp"
                aria-label="Tomar la lámina">${icono('camara', 18)}</button>
        ${tarjeta(t.skus, 'SKU RECIBIDOS SIN MOVER')}
        ${tarjeta(t.nadieLoToco, 'NADIE LOS PICÓ', ' hot')}
        ${tarjeta(t.sinPicar, 'NO SALIERON A TIENDA')}
        ${tarjeta(t.conPocos, 'SE PICARON 5 O MENOS')}
        ${tarjeta(t.paresParados, 'PARES PARADOS')}
        ${tarjeta(t.masViejo, 'DÍAS EL MÁS VIEJO')}
      </div>

      <div class="rsp-dos">
        ${tabla('rsp1', 'NO SALIERON A TIENDA',
                'Entraron y no salió ni un par a tienda &middot; puede haber salido a otro canal',
                nunca, COMUNES, true)}
        ${tabla('rsp2', 'SE PICARON 5 PARES O MENOS',
                'Salió algo, pero casi nada', pocos, COMUNES.concat(DEL_PICK), false)}
      </div>
    </div>`;

    /* LA LAMINA QUE SE MANDA AL GRUPO DE LOS JEFES. Formato cerrado, el mismo
       del UCA y el Replenishment: un numero manda y dos lo acompanan. Acá manda
       el que duele —los SKU que entraron y NUNCA salieron— y lo acompañan los
       que salieron casi nada y la antigüedad del peor. Ver el skill
       `laminas-camara`: el borde limpio lo da `paraFoto`, no subir el tamaño. */
    const cam = raiz.querySelector('#rsp_foto');
    if (cam) cam.addEventListener('click', () => {
        laminaResumen({
            titulo: 'RECIBIDO Y SIN PICAR',
            /* EL ROTULO DICE LA UNIDAD. SKUs y DIAS no son la misma clase de cosa
               y sin decirlo la lamina invita a sumarlos. */
            tarjetas: [
                { rotulo: 'NO SALIERON A TIENDA', valor: t.sinPicar,
                  color: 'var(--warning)' },
                /* "DIAS EL MAS VIEJO 37" no se entendia leido de corrido. Ahora
                   la unidad va debajo, en chico. */
                { rotulo: 'EL MÁS ANTIGUO TIENE', valor: t.masViejo,
                  sufijo: 'días', color: 'var(--warning)' },
            ],
            /* EL NUMERO DURO manda: ni a tienda ni a ningun otro canal. Daniel
               pregunto TRES VECES si los 1.707 no los habia tocado nadie, y no
               era cierto: 633 de ellos si se picaron, a otro canal. */
            grande: { rotulo: 'SKUs QUE NADIE PICÓ', valor: t.nadieLoToco,
                      color: 'var(--danger)' },
            pie: 'Solo canal retail · al ' + (d.fecha || ''),
        });
    });

    /* El Excel baja la lista completa del cuadro, no lo que dejó ver el buscador:
       el archivo es para llevárselo, y uno filtrado sin avisar engaña. */
    engancharBuscador(raiz, 'rsp1', {
        sacarFilas: () => nunca,
        cabecera: COMUNES.map(c => c[1]),
        aFila: (f) => COMUNES.map(c => NUMERICAS.indexOf(c[0]) >= 0
            ? (Number(f[c[0]]) || 0) : (f[c[0]] || '')),
        archivo: 'Recibido nunca picado', unidad: 'SKU', fecha: d.fecha,
    });
    engancharBuscador(raiz, 'rsp2', {
        sacarFilas: () => pocos,
        cabecera: COMUNES.concat(DEL_PICK).map(c => c[1]),
        aFila: (f) => COMUNES.concat(DEL_PICK).map(c => NUMERICAS.indexOf(c[0]) >= 0
            ? (Number(f[c[0]]) || 0) : (f[c[0]] || '')),
        archivo: 'Recibido con poco pick', unidad: 'SKU', fecha: d.fecha,
    });
}

/** Lo propio de este reporte. OJO: nada de comillas invertidas acá adentro,
 *  esto vive en una plantilla y una comilla la corta —pantalla en blanco—. */
function estiloPropio() {
    return `<style>
    #pend.rsp .rsp-dos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;align-items:start}
    @media(max-width:1200px){#pend.rsp .rsp-dos{grid-template-columns:1fr}}
    #pend.rsp .rsp-cab{display:flex;align-items:flex-start;justify-content:space-between;
      gap:12px;flex-wrap:wrap}
    #pend.rsp .rsp-acc{display:flex;align-items:center;gap:8px}
    #pend.rsp .rsp-buscar{font-size:.78rem;padding:6px 10px;border-radius:4px;
      border:1px solid var(--border);background:var(--input-bg);
      color:var(--text-strong);width:170px}
    #pend.rsp .rsp-scroll{overflow:auto;max-height:430px;margin-top:10px}
    #pend.rsp .rsp-scroll thead th{position:sticky;top:0;z-index:1;
      background:var(--panel-solid)}
    /* NADA SE PARTE EN DOS RENGLONES. El SKU salia como 9920781- / 1-01 y el
       gender estiraba la fila a tres lineas: la tabla se leia como parrafos. Lo
       que no entra se desliza, que para eso esta el scroll. */
    #pend.rsp .rsp-scroll th,#pend.rsp .rsp-scroll td{white-space:nowrap}
    /* La camara va en la esquina de las tarjetas, sin robarles sitio. */
    #pend.rsp .rsp-cards{position:relative;padding-right:34px}
    #pend.rsp .rsp-cam{position:absolute;top:-2px;right:0;z-index:2}
    #pend.rsp .rsp-vacio{color:var(--text-faint)}
    #pend.rsp .pend-suave{margin-top:9px;font-size:var(--t-xs);color:var(--text-muted);
      opacity:.75;font-variant-numeric:tabular-nums}
    </style>`;
}
