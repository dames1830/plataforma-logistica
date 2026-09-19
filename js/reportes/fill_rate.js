/**
 * PICKING → PICKING POR DÍA → FILL RATE  (al pie, debajo de "De dónde la sacan")
 *
 * El correo de comercial de punta a punta: cada fecha de correo, sus tiendas y sus
 * pedidos, con lo SOLICITADO y cuánto de eso se PICÓ, se EMBALÓ y se DESPACHÓ.
 * Daniel, 17-sep-2026: *"todas las fechas en que comercial ha mandado pedidos,
 * desde julio hasta ayer, expandible: la fecha, las tiendas, los pedidos [...]
 * para cerrar todo el ciclo"*. Aprobó la maqueta el 18-sep-2026 y pidió ponerla
 * *"en el módulo de picking por día, abajo, después del reporte de dónde lo sacan"*.
 *
 * ES LA MAQUETA TAL CUAL (`scratch/fillrate_correo/fr2_js.js`): el rango de fechas,
 * las seis cápsulas, el buscador, el Excel, el orden por columna y los títulos
 * inmovilizados. Lo único que cambió es el formato de los números: la maqueta
 * escribía 2.363.849 y 95,3%, y acá va el de toda la plataforma —`formato.js`,
 * es-PE: 2,363,849 y 95.3%—, porque en la misma pantalla conviven con los cuadros
 * de arriba y dos formas de escribir un número se leen como un error.
 *
 * ESTE ARCHIVO NO CALCULA NADA. Lo publica `robot/fill_rate_correo.py` en el área
 * `fill_rate_correo` (MASTER): cada guía con sus cinco números. Acá solo se filtra,
 * se suma y se dibuja. Por eso se puede probar sin contraseña.
 *
 * LA CADENA CUADRA EN CADA FILA, por construcción del robot:
 *     PICADO   = PATIO + EMBALADO
 *     EMBALADO = STAGING + CARGADO + DESPACHADO
 *
 * TODO EL CSS VA ENCERRADO BAJO `#fr` Y LAS CLASES LLEVAN PREFIJO `fr-`. Los nombres
 * de la maqueta —pan, cab, tabla, caps— chocarían con los del tablero.
 *
 * LA TABLA NO SE DEJA ORDENAR POR `tablasOrdenables.js`. Ese observador engancha
 * cualquier tabla y mueve filas sueltas: acá rompería el árbol (una tienda se iría
 * debajo de otra fecha). La tabla nace marcada con `data-__ordenable` y ordena con
 * lo suyo, que respeta los tres niveles.
 *
 * LO QUE SE ELIGE SE RECUERDA. El tablero vuelve a dibujar Picking por día entero
 * en cada cambio de día y en cada clic del sub-menú; sin esto, cambiar el día de
 * arriba borraría el rango, la cápsula, la búsqueda y lo abierto de acá abajo.
 *
 * DATOS = {desde, hasta, tipos, t: [tiendas], p: [prioridades],
 *          f: [[fecha, [[tienda, [[pedido, prioridad, tipo, sol, pic, stag, carg, desp]]]]]],
 *          guias, generado, ultimo_oblpn, ultimo_pick}
 */
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0833';
import { icono } from '../services_v245/iconos.js?v=29.0833';
import { n as nfmt, dec } from '../services_v245/formato.js?v=29.0833';

/* LAS SEIS CÁPSULAS, en el orden que dictó Daniel el 17-sep-2026. El tipo de cada guía
   viene en g[2]: 0 SOLID, 1 PREPACK, 2 NO CALZADO, 3 INSUMOS. */
const CAPS = [
    { n: 'TODOS', ok: () => true },
    { n: 'CALZADO', ok: (t) => t === 0 || t === 1 },
    { n: 'SOLID', ok: (t) => t === 0 },
    { n: 'PREPACK', ok: (t) => t === 1 },
    { n: 'NO CALZADO', ok: (t) => t === 2 },
    { n: 'INSUMOS', ok: (t) => t === 3 },
];
const SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const FLECHA = '<svg class="fr-flecha" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* LO QUE EL USUARIO ELIGIÓ, fuera del dibujo para que sobreviva al redibujado.
   `rangoTocado`: mientras nadie mueva el rango, sigue al de los datos —así, cuando el
   robot publica un correo nuevo, entra solo—. */
const E = { clase: 0, desde: null, hasta: null, rangoTocado: false,
            abiertos: new Set(), q: '', qTexto: '', abiertosBusq: new Set(),
            ord: { col: -1, dir: 0 } };

/* EL ALTO DE LA PRIMERA FILA DE TÍTULOS cambia con la letra de cada tema, y la
   segunda se pega justo debajo. Un solo escucha para toda la vida de la página: el
   tablero monta este cuadro muchas veces y cada montaje sumaría uno. */
let _ajustar = null;
let _escuchando = false;
function escucharCabecera() {
    if (_escuchando) return;
    _escuchando = true;
    const corre = () => { if (_ajustar) _ajustar(); };
    window.addEventListener('resize', corre);
    try {
        new MutationObserver(() => setTimeout(corre, 0))
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    } catch (e) { /* sin observador, se ajusta al redimensionar */ }
}

const nf = (v) => nfmt(Math.round(v || 0));
const pc = (a, b) => (b ? dec(100 * a / b, 1) + '%' : '—');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Fecha local, nunca toISOString: a las 19:00 de Lima ya sería el día siguiente. */
const dia = (iso) => {
    const p = iso.split('-');
    const f = new Date(+p[0], +p[1] - 1, +p[2]);
    return SEM[f.getDay()] + ' ' + p[2] + '-' + p[1] + '-' + p[0];
};
const ddmmaaaa = (iso) => { const p = iso.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; };
const nuevo = () => ({ sol: 0, pic: 0, stag: 0, carg: 0, desp: 0 });
const sumar = (a, g) => { a.sol += g[3]; a.pic += g[4]; a.stag += g[5]; a.carg += g[6]; a.desp += g[7]; return a; };
const sumarS = (a, s) => { a.sol += s.sol; a.pic += s.pic; a.stag += s.stag; a.carg += s.carg; a.desp += s.desp; return a; };
const num = (v, extra) => '<td class="' + (extra || '') + (v ? '' : ' fr-cero') + '">' + nf(v) + '</td>';
/* EL BUSCADOR NO DISTINGUE TILDES NI Ñ: "brena" encuentra B2 BREÑA. */
const plano = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* LA BARRA DE AVANCE. Daniel, 17-sep-2026: "ponle una barra de progreso y que se adapte
   al tema". El color sale del tema (--fr-barra) y la pista de la tinta del tema. Pasado
   el 100% la barra se queda llena y el número dice cuánto es. */
function barra(a, b) {
    if (!b) return '<td class="fr-pct">—</td>';
    const v = 100 * a / b, w = Math.max(0, Math.min(100, v));
    return '<td class="fr-pct"><span class="fr-medidor"><span class="fr-pista" aria-hidden="true"><span class="fr-lleno" style="width:'
        + w.toFixed(1) + '%"></span></span><b>' + pc(a, b) + '</b></span></td>';
}
function celdas(s) {
    const emb = s.stag + s.carg + s.desp, patio = s.pic - emb;
    return '<td class="fr-sep">' + nf(s.sol) + '</td>'
        + num(s.pic, 'fr-sep') + barra(s.pic, s.sol) + num(patio)
        + num(emb, 'fr-sep') + barra(emb, s.sol)
        + num(s.stag, 'fr-sep') + num(s.carg) + num(s.desp) + barra(s.desp, s.sol);
}

function estilos() {
    return `<style>
    #fr{margin-top:14px;min-width:0}
    #fr .fr-filtros{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
    #fr .fr-caps{display:flex;gap:6px;flex-wrap:wrap}
    #fr .fr-caps button{background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);color:var(--text-muted);border-radius:999px;
      padding:6px 14px;font-family:inherit;font-size:11px;font-weight:800;letter-spacing:.06em;cursor:pointer}
    #fr .fr-caps button:hover{color:var(--text-strong);border-color:var(--primary)}
    #fr .fr-caps button[aria-pressed=true]{background:rgba(var(--primary-rgb),.14);border-color:var(--primary);color:var(--text-strong)}
    #fr .fr-pan{padding:0;overflow:hidden}
    #fr .fr-cab{padding:13px 18px;border-bottom:1px solid rgba(var(--ink-rgb),.07);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px}
    #fr .fr-cab h3{justify-self:start}
    #fr .fr-cab .fr-buscar{justify-self:center}
    #fr .fr-cab .fr-exp{justify-self:end}
    @media (max-width:700px){#fr .fr-cab{grid-template-columns:1fr auto}#fr .fr-cab .fr-buscar{grid-column:1 / -1;grid-row:2;justify-self:stretch}#fr .fr-cab .fr-buscar input{width:100%}}
    /* EL BUSCADOR: el mismo recuadro que el de pendiente.js (pend-buscar) */
    #fr .fr-buscar input{background:rgba(var(--shadow-rgb),.3);border:1px solid var(--border);border-radius:8px;color:var(--text-strong);padding:7px 10px;font-size:var(--t-sm);font-family:inherit;min-width:260px;box-sizing:border-box}
    #fr .fr-buscar input::placeholder{color:var(--text-dim)}
    #fr .fr-buscar input:focus{outline:none;border-color:var(--primary)}
    #fr .fr-exp{display:flex;align-items:center;gap:10px}
    #fr .fr-exp-estado{font-size:var(--t-xs);color:var(--text-muted)}
    #fr .fr-btn-xls{all:unset;display:flex;align-items:center;cursor:pointer;opacity:.85}
    #fr .fr-btn-xls:hover{opacity:1}
    #fr .fr-btn-xls:disabled{opacity:.35;cursor:default}
    #fr .fr-btn-xls:focus-visible{outline:2px solid var(--primary);outline-offset:3px;border-radius:3px}
    #fr .fr-cab h3{margin:0;font-size:var(--t-md);font-weight:900;color:var(--text-strong);letter-spacing:.4px}
    #fr .fr-tabla{overflow:auto;max-height:68vh}
    @media (max-height:700px){#fr .fr-tabla{max-height:60vh}}
    #fr .fr-arbol thead th{position:sticky;top:0;z-index:5;background-color:var(--panel-solid)}
    #fr .fr-arbol thead tr:nth-child(2) th{top:var(--alto-banda,1.9rem);z-index:4}
    #fr .fr-arbol th[data-col]{cursor:pointer;user-select:none}
    #fr .fr-arbol th[data-col]:hover{color:var(--text-strong)}
    #fr .fr-arbol th[data-col]:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}
    #fr table.fr-arbol{width:100%;border-collapse:collapse}
    #fr .fr-arbol th{padding:9px 10px;text-align:right;font-size:var(--t-xs);font-weight:800;letter-spacing:.06em;
      color:var(--text-muted);text-transform:uppercase;white-space:nowrap;vertical-align:bottom}
    #fr .fr-arbol th:first-child,#fr .fr-arbol td:first-child{text-align:left}
    #fr .fr-arbol th.fr-banda{text-align:center;padding-bottom:4px;border-bottom:1px solid rgba(var(--ink-rgb),.08)}
    #fr .fr-arbol thead tr:last-child th{border-bottom:1px solid rgba(var(--ink-rgb),.10)}
    #fr .fr-arbol td{padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
      border-bottom:1px solid rgba(var(--ink-rgb),.06)}
    #fr .fr-arbol .fr-sep{border-left:1px solid rgba(var(--ink-rgb),.08)}
    #fr .fr-arbol td.fr-pct{font-weight:800;color:var(--text-strong)}
    #fr .fr-arbol td.fr-cero{color:rgba(var(--ink-rgb),.28)}
    #fr .fr-arbol tr.fr-n0 td{background:rgba(var(--ink-rgb),.05);font-weight:900;color:var(--text-strong)}
    #fr .fr-arbol tr.fr-n1 td{font-weight:700;color:var(--text-strong)}
    #fr .fr-arbol tr.fr-n1 td:first-child{font-weight:900}
    #fr .fr-arbol tr.fr-n2 td{color:var(--text-pale)}
    #fr .fr-arbol tr.fr-n2 td:first-child{padding-left:34px}
    #fr .fr-arbol tr.fr-n3 td{font-size:var(--t-xs);color:var(--text-muted)}
    #fr .fr-arbol tr.fr-n3 td:first-child{padding-left:60px}
    #fr .fr-arbol tr.fr-n2 td.fr-pct,#fr .fr-arbol tr.fr-n3 td.fr-pct{color:var(--text-pale)}
    #fr .fr-arbol tr.fr-abre:hover td{background:rgba(var(--ink-rgb),.035)}
    #fr .fr-arbol button.fr-tog{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
    #fr .fr-arbol button.fr-tog:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:4px}
    #fr .fr-arbol .fr-flecha{width:12px;height:12px;flex-shrink:0;transition:transform .15s}
    #fr .fr-arbol button.fr-tog[aria-expanded=true] .fr-flecha{transform:rotate(90deg)}
    #fr .fr-arbol .fr-prio{color:var(--text-dim);margin-left:8px;letter-spacing:.03em}
    @media (prefers-reduced-motion:reduce){#fr .fr-arbol .fr-flecha{transition:none}}

    /* LA BARRA DE AVANCE DE LOS %. El relleno cambia con el tema: en los oscuros va el
       acento claro (--brand-light), que sobre el fondo oscuro se lee; en los dos de Power
       BI va su azul o su teal (--primary), que sobre blanco se lee. La pista es la tinta
       del tema con transparencia. */
    #fr{--fr-barra:var(--brand-light)}
    html[data-tema="pbi"] #fr,html[data-tema="pbi-classic"] #fr{--fr-barra:var(--primary)}
    #fr .fr-arbol .fr-medidor{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px}
    #fr .fr-arbol .fr-pista{display:inline-block;width:56px;height:6px;border-radius:3px;overflow:hidden;
      background:rgba(var(--ink-rgb),.10)}
    #fr .fr-arbol .fr-lleno{display:block;height:100%;border-radius:3px;background:var(--fr-barra)}
    #fr .fr-arbol .fr-medidor b{min-width:46px;text-align:right;font-weight:800}
    #fr .fr-arbol tr.fr-n3 .fr-pista{width:48px;height:4px}
    #fr .fr-arbol tr.fr-n3 .fr-medidor b{font-weight:700}
    #fr .fr-nada{padding:16px 18px;color:var(--text-muted)}
    </style>`;
}

/**
 * Dibuja el Fill Rate dentro de `host`. `D` es lo que publicó el robot; si todavía no
 * hay nada, se dice y no se dibuja una tabla vacía.
 */
export function montarFillRate(host, D) {
    if (!host) return;
    if (!D || !Array.isArray(D.f)) {
        host.innerHTML = estilos() + `<div id="fr"><div class="glass-panel fr-pan">
          <div class="fr-cab"><h3>FILL RATE</h3></div>
          <div class="fr-nada">Todavía no hay datos del Fill Rate. Los publica el robot del
            servidor con los correos de comercial, el picking y el embalaje.</div></div></div>`;
        return;
    }
    if (!E.rangoTocado || !E.desde || !E.hasta) { E.desde = D.desde; E.hasta = D.hasta; }

    host.innerHTML = estilos() + `<div id="fr">
      <div class="fr-filtros">
        <div id="fr_rango">${selectorRango(E.desde, E.hasta, 'window.__frRango', { rotulo: 'var(--text-muted)' })}</div>
        <div class="fr-caps" role="group" aria-label="Qué se mide">
          ${CAPS.map((c, i) => `<button type="button" aria-pressed="${i === E.clase}">${c.n}</button>`).join('')}
        </div>
      </div>
      <div class="glass-panel fr-pan">
        <div class="fr-cab"><h3>FILL RATE</h3>
          <div class="fr-buscar"><input type="search" id="fr_buscar" placeholder="Pedido o tienda" aria-label="Buscar pedido o tienda" autocomplete="off" value="${esc(E.qTexto)}"></div>
          <div class="fr-exp"><span id="fr_estado" class="fr-exp-estado" aria-live="polite"></span>
            <button type="button" id="fr_exportar" class="fr-btn-xls" title="Exportar" aria-label="Exportar a Excel">${icono('excel', 19)}</button></div></div>
        <div class="fr-tabla">
          <table class="fr-arbol" data-__ordenable="1">
            <thead>
              <tr><th rowspan="2" data-col="0">CORREO &middot; TIENDA &middot; PEDIDO</th><th rowspan="2" class="fr-sep" data-col="1">SOLICITADO</th>
                  <th colspan="3" class="fr-banda fr-sep">PICKING</th><th colspan="2" class="fr-banda fr-sep">EMBALAJE</th>
                  <th colspan="4" class="fr-banda fr-sep">DESPACHO</th></tr>
              <tr><th class="fr-sep" data-col="2">PICADO</th><th data-col="3">% PICADO</th><th data-col="4">PATIO</th>
                  <th class="fr-sep" data-col="5">EMBALADO</th><th data-col="6">% EMBALADO</th>
                  <th class="fr-sep" data-col="7">STAGING</th><th data-col="8">CARGADO</th><th data-col="9">DESPACHADO</th><th data-col="10">% DESPACHADO</th></tr>
            </thead>
            <tbody id="fr_arbol"></tbody>
          </table>
        </div>
      </div>
    </div>`;

    const raiz = host.querySelector('#fr');
    const tabla = raiz.querySelector('table.fr-arbol');
    const cuerpo = raiz.querySelector('#fr_arbol');
    const botonExportar = raiz.querySelector('#fr_exportar');
    const estado = raiz.querySelector('#fr_estado');
    const ORD = E.ord;

    const abiertos = () => (E.q ? E.abiertosBusq : E.abiertos);
    const abierto = (k) => abiertos().has(k);

    function fila(nivel, clave, etiqueta, s) {
        const abre = clave !== null, ab = abre && abierto(clave);
        const nom = abre
            ? '<button type="button" class="fr-tog" data-k="' + esc(clave) + '" aria-expanded="' + ab + '">' + FLECHA + etiqueta + '</button>'
            : etiqueta;
        return '<tr class="fr-n' + nivel + (abre ? ' fr-abre' : '') + '"><td>' + nom + '</td>' + celdas(s) + '</tr>';
    }

    /* ── EL ORDEN ─────────────────────────────────────────────────────────────
       El de siempre (Daniel, 17-sep-2026): las fechas de la más nueva a la más vieja, y
       al abrir una fecha "por el porcentaje de picado, el mayor siempre arriba, hasta
       abajo el menor"; igual los pedidos dentro de la tienda. Con una columna elegida se
       ordena por ella en los tres niveles sin romper el árbol: las fechas entre sí, las
       tiendas dentro de su fecha, los pedidos dentro de su tienda. */
    function valorCol(col, x) {
        const s = x.s, emb = s.stag + s.carg + s.desp;
        switch (col) {
            case 0: return x.nombre;
            case 1: return s.sol;
            case 2: return s.pic;
            case 3: return s.sol ? s.pic / s.sol : -1;
            case 4: return s.pic - emb;
            case 5: return emb;
            case 6: return s.sol ? emb / s.sol : -1;
            case 7: return s.stag;
            case 8: return s.carg;
            case 9: return s.desp;
            case 10: return s.sol ? s.desp / s.sol : -1;
        }
        return 0;
    }
    function porColumna(a, b) {
        const va = valorCol(ORD.col, a), vb = valorCol(ORD.col, b);
        const r = typeof va === 'string' ? va.localeCompare(vb, 'es', { numeric: true, sensitivity: 'base' }) : va - vb;
        return (r * ORD.dir) || (b.s.sol - a.s.sol);
    }
    const pctPic = (s) => (s.sol ? s.pic / s.sol : -1);
    const ordenHijos = (a, b) => (ORD.dir ? porColumna(a, b) : ((pctPic(b.s) - pctPic(a.s)) || (b.s.sol - a.s.sol)));
    const ordenFechas = (a, b) => (ORD.dir ? porColumna(a, b) : (a.f < b.f ? 1 : (a.f > b.f ? -1 : 0)));

    /* LO FILTRADO Y ORDENADO: el rango, la cápsula, la búsqueda y la columna. Lo usan la
       pantalla y el Excel, así que los dos dicen exactamente lo mismo. Daniel: "lo que
       filtro es lo que quiero exportar". */
    function armar() {
        const total = nuevo(), fechas = [];
        D.f.forEach((f) => {
            if (f[0] < E.desde || f[0] > E.hasta) return;
            const ts = [], sf = nuevo();
            f[1].forEach((t) => {
                const gs = [];
                const laTienda = !!E.q && plano(D.t[t[0]]).indexOf(E.q) >= 0;
                t[1].forEach((g) => {
                    if (!CAPS[E.clase].ok(g[2])) return;
                    if (E.q && !laTienda && plano(g[0]).indexOf(E.q) < 0 && plano(D.p[g[1]]).indexOf(E.q) < 0) return;
                    gs.push({ g: g, s: sumar(nuevo(), g), nombre: g[0] });
                });
                if (!gs.length) return;
                const st = nuevo();
                gs.forEach((x) => { sumarS(st, x.s); });
                gs.sort(ordenHijos);
                ts.push({ t: t[0], gs: gs, s: st, nombre: D.t[t[0]], porPedido: !laTienda });
                sumarS(sf, st);
            });
            if (!ts.length) return;
            ts.sort(ordenHijos);
            sumarS(total, sf);
            fechas.push({ f: f[0], s: sf, ts: ts, nombre: f[0] });
        });
        fechas.sort(ordenFechas);
        return { total: total, fechas: fechas };
    }

    function dibujar() {
        const A = armar(), filas = [];
        A.fechas.forEach((x) => {
            const kf = 'f' + x.f;
            filas.push(fila(1, kf, dia(x.f), x.s));
            if (!abierto(kf)) return;
            x.ts.forEach((t) => {
                const ks = 's' + x.f + '|' + t.t;
                filas.push(fila(2, ks, esc(t.nombre), t.s));
                if (!abierto(ks)) return;
                t.gs.forEach((p) => {
                    filas.push(fila(3, null, esc(p.g[0]) + '<span class="fr-prio">' + esc(D.p[p.g[1]]) + '</span>', p.s));
                });
            });
        });
        cuerpo.innerHTML = A.fechas.length
            ? fila(0, null, 'TOTAL', A.total) + filas.join('')
            : '<tr><td colspan="11" style="padding:16px 18px;color:var(--text-muted)">'
              + (E.q ? 'No hay pedidos que coincidan' : 'No hay correos en ese rango') + '</td></tr>';
        botonExportar.disabled = !A.fechas.length;
    }

    cuerpo.addEventListener('click', (ev) => {
        const b = ev.target.closest ? ev.target.closest('button.fr-tog') : null;
        if (!b) return;
        const k = b.getAttribute('data-k');
        const conjunto = abiertos();
        if (conjunto.has(k)) conjunto.delete(k); else conjunto.add(k);
        dibujar();
        const otra = [...cuerpo.querySelectorAll('button.fr-tog')].find((x) => x.getAttribute('data-k') === k);
        if (otra) otra.focus();
    });

    /* EL BUSCADOR. Daniel, 17-sep-2026, buscando la donación del 14-09: "ponme un filtro
       arriba". Busca en el pedido, la tienda y la prioridad. Mientras hay algo escrito se
       abren solas las fechas y las tiendas donde está lo que se busca; al borrarlo vuelve
       lo que estaba abierto a mano. */
    const buscador = raiz.querySelector('#fr_buscar');
    let esperaBusqueda = null;
    function buscar() {
        E.qTexto = buscador.value.trim();
        E.q = plano(E.qTexto);
        E.abiertosBusq = new Set();
        if (E.q) {
            armar().fechas.forEach((x) => {
                E.abiertosBusq.add('f' + x.f);
                x.ts.forEach((t) => { if (t.porPedido) E.abiertosBusq.add('s' + x.f + '|' + t.t); });
            });
        }
        dibujar();
    }
    buscador.addEventListener('input', () => {
        clearTimeout(esperaBusqueda);
        esperaBusqueda = setTimeout(buscar, 250);
    });

    const caps = [...raiz.querySelectorAll('.fr-caps button')];
    caps.forEach((b, i) => {
        b.addEventListener('click', () => {
            E.clase = i;
            caps.forEach((o, j) => { o.setAttribute('aria-pressed', String(j === i)); });
            if (E.q) buscar(); else dibujar();
        });
    });

    /* Los títulos que ordenan: las mismas flechas de tablasOrdenables.js */
    const titulos = [...tabla.querySelectorAll('thead th[data-col]')];
    function pintarFlechas() {
        titulos.forEach((th) => {
            const f = th.querySelector('.orden-flecha');
            const activa = +th.getAttribute('data-col') === ORD.col && ORD.dir !== 0;
            f.textContent = activa ? (ORD.dir > 0 ? '▲' : '▼') : '↕';
            f.style.opacity = activa ? '1' : '0.3';
        });
    }
    function ordenarPor(col) {
        if (ORD.col === col) ORD.dir = ORD.dir === 1 ? -1 : (ORD.dir === -1 ? 0 : 1);
        else { ORD.col = col; ORD.dir = 1; }
        if (ORD.dir === 0) ORD.col = -1;
        pintarFlechas();
        dibujar();
    }
    titulos.forEach((th) => {
        const f = document.createElement('span');
        f.className = 'orden-flecha';
        f.style.cssText = 'margin-left:5px; font-size:0.85em;';
        f.setAttribute('aria-hidden', 'true');
        th.appendChild(f);
        th.title = 'Clic para ordenar';
        th.tabIndex = 0;
        th.addEventListener('click', () => ordenarPor(+th.getAttribute('data-col')));
        th.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ordenarPor(+th.getAttribute('data-col')); }
        });
    });
    pintarFlechas();

    /* LOS TÍTULOS SE QUEDAN ARRIBA AL BAJAR. La segunda fila de títulos se pega justo
       debajo de la primera: se mide la primera, porque su alto cambia con la letra. */
    _ajustar = () => {
        if (!tabla.isConnected) return;
        const banda = tabla.tHead.rows[0].querySelector('th.fr-banda');
        if (banda) tabla.style.setProperty('--alto-banda', banda.getBoundingClientRect().height + 'px');
    };
    escucharCabecera();

    /* ── EXPORTAR ── el árbol como está en pantalla y una hoja plana de pedidos. */
    const avisar = (t) => { estado.textContent = t || ''; };
    function exportar() {
        if (typeof ExcelJS === 'undefined') { avisar('No se pudo cargar el generador de Excel.'); return; }
        const A = armar();
        if (!A.fechas.length) return;
        botonExportar.disabled = true;
        avisar('Armando el Excel…');
        const clase = CAPS[E.clase].n;
        const rango = ddmmaaaa(E.desde) + ' al ' + ddmmaaaa(E.hasta);
        const COLS = ['SOLICITADO', 'PICADO', '% PICADO', 'PATIO', 'EMBALADO', '% EMBALADO',
                      'STAGING', 'CARGADO', 'DESPACHADO', '% DESPACHADO'];
        const valores = (s) => {
            const emb = s.stag + s.carg + s.desp;
            return [s.sol, s.pic, s.sol ? s.pic / s.sol : null, s.pic - emb, emb, s.sol ? emb / s.sol : null,
                    s.stag, s.carg, s.desp, s.sol ? s.desp / s.sol : null];
        };
        const formatos = (r, desde) => {
            for (let i = 0; i < COLS.length; i++) {
                r.getCell(desde + i).numFmt = (i === 2 || i === 5 || i === 9) ? '0.0%' : '#,##0';
            }
        };
        const cabecera = (ws, nombres) => {
            const r = ws.addRow(nombres);
            r.font = { bold: true };
            r.eachCell((c) => {
                c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                c.border = { bottom: { style: 'thin' } };
            });
        };
        try {
            const wb = new ExcelJS.Workbook();

            // Hoja 1: el árbol, con los grupos de Excel (+ y -), abierto y ordenado igual que en la pantalla
            const ws = wb.addWorksheet('Fill rate', {
                properties: { outlineProperties: { summaryBelow: false, summaryRight: false } },
                views: [{ state: 'frozen', ySplit: 3 }],
            });
            ws.addRow(['FILL RATE · ' + clase + ' · ' + rango + (E.qTexto ? ' · búsqueda: ' + E.qTexto : '')]).font = { bold: true, size: 13 };
            ws.addRow([]);
            cabecera(ws, ['CORREO · TIENDA · PEDIDO', 'PRIORIDAD'].concat(COLS));
            const rt = ws.addRow(['TOTAL', ''].concat(valores(A.total)));
            rt.font = { bold: true };
            formatos(rt, 3);
            A.fechas.forEach((x) => {
                const abiertaF = abierto('f' + x.f);
                const rf = ws.addRow([dia(x.f), ''].concat(valores(x.s)));
                rf.font = { bold: true };
                formatos(rf, 3);
                x.ts.forEach((t) => {
                    const abiertaT = abiertaF && abierto('s' + x.f + '|' + t.t);
                    const r2 = ws.addRow([t.nombre, ''].concat(valores(t.s)));
                    r2.outlineLevel = 1;
                    r2.hidden = !abiertaF;
                    r2.getCell(1).alignment = { indent: 2 };
                    formatos(r2, 3);
                    t.gs.forEach((p) => {
                        const r3 = ws.addRow([p.g[0], D.p[p.g[1]]].concat(valores(p.s)));
                        r3.outlineLevel = 2;
                        r3.hidden = !abiertaT;
                        r3.getCell(1).alignment = { indent: 4 };
                        formatos(r3, 3);
                    });
                });
            });
            ws.getColumn(1).width = 34;
            ws.getColumn(2).width = 18;
            for (let c = 3; c <= 2 + COLS.length; c++) ws.getColumn(c).width = 13;

            // Hoja 2: un pedido por fila, para filtrar y armar tablas dinámicas
            const wp = wb.addWorksheet('Pedidos', { views: [{ state: 'frozen', ySplit: 1 }] });
            cabecera(wp, ['FECHA CORREO', 'TIENDA', 'PEDIDO', 'PRIORIDAD', 'TIPO'].concat(COLS));
            A.fechas.forEach((x) => {
                x.ts.forEach((t) => {
                    t.gs.forEach((p) => {
                        formatos(wp.addRow([ddmmaaaa(x.f), t.nombre, p.g[0], D.p[p.g[1]], D.tipos[p.g[2]]].concat(valores(p.s))), 6);
                    });
                });
            });
            wp.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 + COLS.length } };
            [13, 30, 12, 18, 13].forEach((w, i) => { wp.getColumn(i + 1).width = w; });
            for (let c2 = 6; c2 <= 5 + COLS.length; c2++) wp.getColumn(c2).width = 13;

            const nombre = 'Fill rate correo comercial ' + clase + ' ' + rango + '.xlsx';
            wb.xlsx.writeBuffer().then((buf) => {
                const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = nombre;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
                avisar('');
            }).catch(() => {
                avisar('No se pudo exportar.');
            }).then(() => { botonExportar.disabled = false; });
        } catch (e) {
            avisar('No se pudo exportar.');
            botonExportar.disabled = false;
        }
    }
    botonExportar.addEventListener('click', exportar);

    /* El rango usa un setter global, como todos los de la plataforma. El último cuadro
       montado es el que responde. */
    window.__frRango = (desde, hasta) => {
        if (desde) E.desde = desde;
        if (hasta) E.hasta = hasta;
        E.rangoTocado = true;
        if (E.q) buscar(); else dibujar();
    };

    if (E.q) buscar(); else dibujar();
    _ajustar();
}
