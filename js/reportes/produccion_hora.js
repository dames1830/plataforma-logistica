/**
 * PICKING → PICKING POR DÍA  y  PICKING → EMBALAJE POR DÍA
 *
 * La misma pantalla dos veces: quién movió qué, hora por hora, del turno de 08:00
 * a 19:00. Una mira el archivo de picking del WMS y la otra el OBLPN del embalaje.
 * Lo pidió Daniel el 01-sep-2026: *"igualito, tal cual figura acá, tal cual la
 * maqueta de picking día debe ser embalaje por día, no cambia nada"*.
 *
 * ESTE ARCHIVO NO SABE LEER DEL SERVIDOR. Recibe `OPC.dias` —lo que publican
 * `robot/picking_por_hora.py` y `robot/embalaje_por_hora.py` en las áreas
 * `picking_por_hora` y `embalaje_por_hora`— y solo dibuja. Mismo reparto que
 * `pendiente.js` y `turno_actividades.js`: por eso se puede probar sin contraseña.
 *
 * TODO EL CSS VA ENCERRADO BAJO `#ph` Y LOS IDS LLEVAN PREFIJO `ph_`. Los nombres
 * que usa —panel, card, bar, nota, tarj— chocarían con los del tablero.
 *
 * EL RANGO DE FECHAS SE ARMA JUNTANDO DÍAS, y eso es exactamente lo mismo que
 * juntar canales: las dos cosas pasan por `combinarVistas()`. Los pares y las
 * líneas se suman; las personas, las marcas y las ubicaciones SE UNEN, porque la
 * misma persona aparece en dos canales y en dos días, y sumarla la contaría doble.
 *
 * OPC = {
 *   dias:        [{fecha, datos}] ya traídos del servidor, en orden
 *   textos:      {cuadro, verbo, accion, origen} — las cuatro palabras que
 *                cambian entre picking y embalaje
 *   desde/hasta: el rango elegido, 'AAAA-MM-DD'
 *   fechas:      los días que el servidor tiene guardados
 *   alCambiarRango: (desde, hasta) => {}
 * }
 */

import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0519';

const nf = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE') : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const CLASES = [['total', 'Todo'], ['cal_suelto', 'Calzado suelto'],
                ['cal_prepack', 'Calzado prepack'], ['no_cal', 'No calzado']];
const CORTO = { total: 't', cal_suelto: 's', cal_prepack: 'p', no_cal: 'x' };
const CAMPO = { t: 'total', s: 'cal_suelto', p: 'cal_prepack', x: 'no_cal' };
const NOMBRE = { t: 'algo', s: 'calzado suelto', p: 'calzado prepack', x: 'no calzado' };
const SUMABLES = ['cal_suelto', 'cal_prepack', 'no_cal', 'lineas', 'total'];

const ZONAS = { MZN01: 'Mezzanine 1', MZN02: 'Mezzanine 2', MZN03: 'Mezzanine 3',
                MZN04: 'Mezzanine 4', SEL: 'Selectivo', AND: 'Andamio',
                CDBUFFER: 'Zona Buffer', PARED: 'Pared', PISO: 'Piso',
                '?': '(sin ubicación)' };

const CANAL_PIE = {
    TODOS: 'Las seis, juntas',
    RETAIL: 'Tiendas: el destino figura en el maestro de rutas',
    MAYORISTA: 'Aldeas V x Mayor · destinos 00196200xx',
    CATALOGO: 'Aldeas Catalogo · destino 91891',
    ECOMMERCE: 'Multivende ECommerce y Tda.Virtual · destinos 93173, 91890, 92458',
    INDUSTRIAL: 'Industrial CD.Aldeas · destino 81439',
    OTROS: 'Salida por Nota · destinos 98320 y 83310',
    'SIN CANAL': 'La orden no figura en ningún Detalle de Orden' };

/* Cada pantalla tiene su color para la matriz, y la clase elegida lo tiñe. */
const COLOR = { t: 'var(--primary)', s: 'var(--primary)',
                p: 'var(--warning)', x: 'var(--success)' };

/* ══════════════════════════════════════════════════════════════════════════
   JUNTAR VISTAS  —  sirve para días y para canales, es la misma operación
   ══════════════════════════════════════════════════════════════════════════ */

/** Une tramos de tiempo que se pisan. Dos canales —y dos personas del mismo
 *  día— comparten el mismo rato de trabajo, así que sumar minutos contaría el
 *  mismo minuto dos veces. */
function unirTramos(tramos, puenteSeg) {
    if (!tramos || !tramos.length) return [];
    const ts = tramos.slice().sort((a, b) => a[0] - b[0]);
    const fus = [ts[0].slice()];
    for (let i = 1; i < ts.length; i++) {
        if (ts[i][0] <= fus[fus.length - 1][1] + (puenteSeg || 0)) {
            fus[fus.length - 1][1] = Math.max(fus[fus.length - 1][1], ts[i][1]);
        } else { fus.push(ts[i].slice()); }
    }
    return fus;
}

const cero = () => ({ cal_suelto: 0, cal_prepack: 0, no_cal: 0, lineas: 0, total: 0 });
const sumar = (a, b) => { SUMABLES.forEach(k => { a[k] += (b && b[k]) || 0; }); return a; };

/**
 * Junta N vistas en una. `horas` es la lista de horas que se dibujan y `puente`
 * los segundos que unen dos tramos pegados.
 *
 * Una vista es lo que publica el robot: {totales, por_hora, gente, marcas,
 * coleccion, zonas}.
 */
function combinarVistas(lista, horas, puente) {
    const vistas = (lista || []).filter(Boolean);
    if (!vistas.length) {
        const vacio = { totales: cero(), por_hora: {}, gente: [],
                        marcas: [], coleccion: [], zonas: [] };
        horas.forEach(h => { vacio.por_hora[h] = Object.assign(cero(), { personas: 0 }); });
        return vacio;
    }
    if (vistas.length === 1) return vistas[0];

    const totales = vistas.reduce((a, v) => sumar(a, v.totales), cero());

    const por_hora = {};
    horas.forEach(h => {
        const o = vistas.reduce((a, v) => sumar(a, v.por_hora[h]), cero());
        /* LAS PERSONAS SE UNEN, NO SE SUMAN: la misma persona trabaja en dos
           canales y en dos días, y sumarla diría que hay el doble de gente. */
        const quien = new Set();
        vistas.forEach(v => (v.gente || []).forEach(g => {
            if (g.horas[h] && g.horas[h].total > 0) quien.add(g.usuario);
        }));
        o.personas = quien.size;
        por_hora[h] = o;
    });

    const juntarCorte = (campo) => {
        const mapa = new Map();
        vistas.forEach(v => (v[campo] || []).forEach(x => {
            const y = mapa.get(x.nom)
                || Object.assign(cero(), { nom: x.nom, ubis: new Set() });
            sumar(y, x);
            (x.ubis || []).forEach(u => y.ubis.add(u));
            mapa.set(x.nom, y);
        }));
        return [...mapa.values()]
            .map(y => Object.assign(y, { ubicaciones: y.ubis.size }))
            .sort((a, b) => b.total - a.total);
    };

    /* LA GENTE SE FUNDE CELDA POR CELDA: los pares y las líneas se suman, y los
       tramos de trabajo se unen. Con eso el ritmo sale igual que si el servidor
       hubiera juntado los canales y los días de una. */
    const CLAVES = ['cal_suelto', 'cal_prepack', 'no_cal', 'total'];
    const fundir = (dest, src) => {
        CLAVES.forEach(k => {
            if (k !== 'total') dest[k] = (dest[k] || 0) + ((src && src[k]) || 0);
            dest[k + '_l'] = (dest[k + '_l'] || 0)
                + (k === 'total' ? ((src && src.lineas) || 0) : ((src && src[k + '_l']) || 0));
            dest[k + '_iv'] = unirTramos(
                (dest[k + '_iv'] || []).concat((src && src[k + '_iv']) || []), puente);
        });
        dest.total = (dest.cal_suelto || 0) + (dest.cal_prepack || 0) + (dest.no_cal || 0);
        dest.lineas = dest.total_l || 0;
    };

    const gmapa = new Map();
    vistas.forEach(v => (v.gente || []).forEach(g => {
        let y = gmapa.get(g.usuario);
        if (!y) { y = { usuario: g.usuario, total: {}, horas: {} }; gmapa.set(g.usuario, y); }
        fundir(y.total, g.total);
        horas.forEach(h => {
            y.horas[h] = y.horas[h] || {};
            fundir(y.horas[h], g.horas[h]);
        });
    }));

    return { totales, por_hora,
             gente: [...gmapa.values()].sort((a, b) => b.total.total - a.total.total),
             marcas: juntarCorte('marcas'), coleccion: juntarCorte('coleccion'),
             zonas: juntarCorte('zonas') };
}

/**
 * De la lista de días a UN dato con la misma forma que publica el robot.
 * Cada canal se junta por su lado, y `TODOS` se junta aparte —no se recalcula
 * sumando canales, porque el robot ya lo trae y ahí las personas están unidas—.
 */
function juntarDias(dias) {
    const buenos = (dias || []).map(d => d && d.datos).filter(Boolean);
    if (!buenos.length) return null;
    if (buenos.length === 1) return Object.assign({}, buenos[0], { nDias: 1 });

    const horas = [...new Set(buenos.flatMap(d => d.horas || []))].sort((a, b) => a - b);
    const puente = ((buenos[0].cortes || {}).puenteMin || 0) * 60;
    const canales = [...new Set(buenos.flatMap(d => d.canales || []))];
    /* El orden es el del primer día que los trae: TODOS adelante y el resto como
       lo dejó el robot, que ya viene por tamaño. */
    canales.sort((a, b) => {
        if (a === 'TODOS') return -1;
        if (b === 'TODOS') return 1;
        const o = buenos[0].canales || [];
        return (o.indexOf(a) < 0 ? 99 : o.indexOf(a)) - (o.indexOf(b) < 0 ? 99 : o.indexOf(b));
    });

    const vistas = {};
    canales.forEach(c => {
        vistas[c] = combinarVistas(buenos.map(d => d.vistas && d.vistas[c]), horas, puente);
    });

    const gentePorCanal = {};
    canales.forEach(c => { gentePorCanal[c] = (vistas[c].gente || []).length; });

    const sumaCampo = (f) => buenos.reduce((s, d) => s + (Number(f(d)) || 0), 0);

    return {
        dia: buenos[0].dia,
        nDias: buenos.length,
        archivo: buenos.length + ' archivos',
        horas, canales, vistas, gentePorCanal,
        cortes: buenos[0].cortes || {},
        lineas_buenas: sumaCampo(d => d.lineas_buenas),
        lineas_descartadas: sumaCampo(d => d.lineas_descartadas),
        unidadesWms: sumaCampo(d => d.unidadesWms),
        preFuera: { lineas: sumaCampo(d => (d.preFuera || {}).lineas),
                    pares: sumaCampo(d => (d.preFuera || {}).pares) },
        usuario: buenos[0].usuario || null,
    };
}

/* ══════════════════════════════════════════════════════════════════════════
   EL ESTILO, todo bajo #ph
   ══════════════════════════════════════════════════════════════════════════ */

function estilos() {
    return `<style>
    #ph{display:flex;flex-direction:column;gap:14px}
    #ph .ph-top{display:flex;justify-content:space-between;align-items:flex-end;
      gap:16px;flex-wrap:wrap}
    #ph h2{font-size:var(--t-lg);font-weight:800;margin:0;color:var(--text-strong)}
    #ph .ph-sub{color:var(--text-muted);font-size:var(--t-sm);max-width:80ch;margin-top:4px}
    #ph .ph-guardados{font-size:var(--t-xs);color:var(--text-muted);margin-top:5px}

    /* El calendario tiene que verse: sin color-scheme el iconito queda gris
       oscuro sobre fondo oscuro y no se encuentra. Misma regla que en Pendiente. */
    #ph input[type=date]{color-scheme:var(--scheme);cursor:pointer}
    #ph input[type=date]::-webkit-calendar-picker-indicator{
      cursor:pointer;opacity:1;transform:scale(1.2);margin-left:4px;
      filter:invert(64%) sepia(38%) saturate(1400%) hue-rotate(207deg) brightness(102%)}

    /* ── el combo de canal: se pueden marcar varios a la vez ── */
    #ph .ph-canal{display:flex;gap:10px;align-items:center;flex-wrap:wrap;position:relative;
      background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);
      border-radius:12px;padding:9px 14px}
    #ph .ph-rot{font-size:var(--t-xs);font-weight:800;letter-spacing:.08em;
      text-transform:uppercase;color:var(--text-muted)}
    #ph #ph_combo{font:inherit;font-size:var(--t-sm);font-weight:700;cursor:pointer;
      text-align:left;min-width:200px;padding:7px 30px 7px 12px;border-radius:8px;
      border:1px solid var(--border);background:rgba(var(--shadow-rgb),.3);
      color:var(--text-strong);position:relative}
    #ph #ph_combo::after{content:'';position:absolute;right:12px;top:50%;
      width:6px;height:6px;border-right:1.6px solid var(--text-muted);
      border-bottom:1.6px solid var(--text-muted);transform:translateY(-70%) rotate(45deg)}
    #ph #ph_combo:hover{border-color:var(--primary)}
    #ph #ph_desplegable{position:absolute;top:calc(100% - 2px);left:64px;z-index:30;
      min-width:280px;background:var(--panel-solid);
      border:1px solid var(--border);border-radius:10px;
      box-shadow:0 10px 30px rgba(0,0,0,.35);padding:6px;backdrop-filter:none}
    #ph #ph_desplegable[hidden]{display:none}
    #ph #ph_lista label{display:flex;align-items:center;gap:9px;padding:6px 9px;
      border-radius:6px;cursor:pointer;font-size:var(--t-sm);color:var(--text-main)}
    #ph #ph_lista label:hover{background:rgba(var(--ink-rgb),.06)}
    #ph #ph_lista label span:first-of-type{flex:1}
    #ph #ph_lista input{margin:0;accent-color:var(--primary);width:15px;height:15px}
    #ph .ph-acciones{display:flex;gap:6px;padding:6px 9px 3px;
      border-top:1px solid var(--border);margin-top:4px}
    #ph .ph-acciones button{font:inherit;font-size:var(--t-xs);font-weight:700;
      cursor:pointer;padding:4px 11px;border-radius:6px;border:1px solid var(--border);
      background:transparent;color:var(--text-muted)}
    #ph .ph-acciones button:hover{color:var(--primary);border-color:var(--primary)}
    #ph .ph-chip{font-size:var(--t-xs);font-weight:800;font-variant-numeric:tabular-nums;
      color:var(--text-muted);background:rgba(var(--ink-rgb),.08);
      border-radius:999px;padding:1px 8px}

    /* ── tarjetas ── */
    #ph .ph-tarj{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(158px,1fr))}
    #ph .ph-t{background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);
      border-top:3px solid var(--primary);border-radius:12px;padding:12px 15px}
    #ph .ph-t.pre{border-top-color:var(--warning)}
    #ph .ph-t.nc{border-top-color:var(--success)}
    #ph .ph-t.gr{border-top-color:var(--text-muted)}
    #ph .ph-t .e{font-size:var(--t-xs);font-weight:800;letter-spacing:.08em;
      text-transform:uppercase;color:var(--text-muted)}
    #ph .ph-t .v{font-size:var(--t-xl);font-weight:800;line-height:1.15;
      color:var(--text-strong);font-variant-numeric:tabular-nums}
    #ph .ph-t .d{font-size:var(--t-xs);color:var(--text-muted)}

    /* ── paneles y tablas ── */
    #ph .ph-pan{background:rgba(var(--ink-rgb),.04);border:1px solid var(--border);
      border-radius:14px;overflow:hidden}
    #ph .ph-cab{padding:13px 16px;border-bottom:1px solid var(--border)}
    #ph .ph-cab h3{margin:0;font-size:var(--t-sm);font-weight:800;letter-spacing:.9px;
      color:var(--text-strong);text-transform:uppercase}
    #ph .ph-cab p{color:var(--text-muted);font-size:var(--t-xs);margin:4px 0 0}
    #ph .ph-sc{overflow-x:auto}
    #ph table{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
    #ph th,#ph td{padding:6px 12px;text-align:left;white-space:nowrap}
    #ph th.n,#ph td.n{text-align:right;font-variant-numeric:tabular-nums}
    #ph thead th{background:rgba(var(--ink-rgb),.06);color:var(--text-muted);
      font-size:var(--t-xs);font-weight:800;text-transform:uppercase;letter-spacing:.06em;
      border-bottom:1px solid var(--border)}
    #ph tbody tr{border-bottom:1px solid rgba(var(--ink-rgb),.05)}
    #ph tbody tr:last-child{border-bottom:0}
    #ph tbody tr:hover{background:rgba(var(--ink-rgb),.05)}
    #ph td.k{font-weight:700;color:var(--text-strong)}
    #ph td.nom{font-family:ui-monospace,Consolas,monospace;font-size:var(--t-sm)}
    #ph td.f{position:relative}
    #ph .ph-bar{position:absolute;left:12px;right:12px;bottom:2px;height:2px;
      background:var(--primary);opacity:.3;border-radius:2px}
    #ph tr.off td{color:var(--text-muted);opacity:.6}
    #ph tr.total td{font-weight:800;border-top:2px solid var(--border);
      background:rgba(var(--ink-rgb),.07);color:var(--text-strong)}
    #ph tr.elegida td{background:rgba(var(--brand-rgb),.10)}
    #ph .ph-eti{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      padding:1px 6px;border-radius:4px;margin-left:6px}
    #ph .ph-eti-ok{background:rgba(var(--success-rgb),.18);color:var(--success)}
    #ph .ph-eti-ojo{background:rgba(var(--warning-rgb),.20);color:var(--warning)}
    #ph .ph-eti-corta{background:rgba(var(--ink-rgb),.12);color:var(--text-muted)}
    #ph .ph-cod{color:var(--text-muted);font-size:var(--t-xs);font-weight:400;
      margin-left:6px;opacity:.8}

    /* ── la matriz persona x hora ── */
    #ph .ph-mtz table{font-size:var(--t-xs)}
    #ph .ph-mtz th,#ph .ph-mtz td{padding:4px 9px}
    /* LAS DOS COLUMNAS CONGELADAS VAN CON UN COLOR SOLIDO DEL TEMA.
       Estaban en var(--surface, #161a22) y ese token NO EXISTE en la
       plataforma: los cuatro temas caian al color de reserva, que es oscuro. En
       tema claro quedaban dos columnas negras con la letra negra encima y no se
       leia ningun nombre. Lo cazo Daniel el 02-sep-2026 apenas abrio la pantalla:
       *"picking y embalaje tienen ese fondo negro"*.
       Tiene que ser SOLIDO —no rgba— porque las filas pasan por debajo al
       desplazar la tabla de costado; con transparencia se veria el numero de
       atras cruzado con el nombre. */
    #ph .ph-mtz thead th:nth-child(1),#ph .ph-mtz thead th:nth-child(2),
    #ph .ph-mtz tbody td:nth-child(1),#ph .ph-mtz tbody td:nth-child(2){
      position:sticky;background:var(--panel-deep);z-index:1}
    #ph .ph-mtz thead th:nth-child(1),#ph .ph-mtz thead th:nth-child(2),
    #ph .ph-mtz tr.total td:nth-child(1),#ph .ph-mtz tr.total td:nth-child(2){
      background:var(--panel-deeper)}
    #ph .ph-mtz thead th:nth-child(1),#ph .ph-mtz thead th:nth-child(2){z-index:2}
    #ph .ph-mtz thead th:nth-child(1),#ph .ph-mtz tbody td:nth-child(1){
      left:0;width:34px;color:var(--text-muted)}
    #ph .ph-mtz thead th:nth-child(2),#ph .ph-mtz tbody td:nth-child(2){left:34px}
    #ph .ph-mtz td.tot{font-weight:800;border-left:1px solid var(--border)}
    /* Un cero suelto pesa lo mismo que un número de verdad y marea la lectura:
       el 0 y el "no se pudo medir" se dibujan igual, una raya apagada. */
    #ph .ph-mtz td.c.z,#ph .ph-mtz td.tot.z,#ph .ph-mtz td.z{
      color:var(--text-muted);opacity:.45;font-weight:400}
    #ph .ph-mtz td.sub{color:var(--text-muted)}
    #ph .ph-mtz td.vacio{padding:26px 16px;text-align:center;color:var(--text-muted);
      white-space:normal;font-weight:400}

    #ph .ph-selec{display:flex;gap:7px;flex-wrap:wrap;align-items:center;
      padding:11px 16px;border-bottom:1px solid var(--border)}
    #ph .ph-selec button{font:inherit;font-size:var(--t-xs);font-weight:700;cursor:pointer;
      padding:5px 13px;border-radius:999px;border:1px solid var(--border);
      background:transparent;color:var(--text-muted)}
    #ph .ph-selec button[aria-pressed="true"]{background:rgba(var(--brand-rgb),.14);
      border-color:var(--primary);color:var(--primary)}
    #ph .ph-selec .div{width:1px;align-self:stretch;background:var(--border);margin:0 6px}

    #ph .ph-dos{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(420px,1fr))}
    #ph .ph-nota{padding:10px 16px;border-top:1px solid var(--border);
      color:var(--text-muted);font-size:var(--t-xs);white-space:normal;line-height:1.6}
    #ph .ph-nota b{color:var(--text-main)}
    #ph .ph-nada{text-align:center;padding:44px 20px;color:var(--text-muted)}
    #ph .ph-nada-t{font-size:var(--t-lg);font-weight:800;color:var(--text-strong);
      margin-bottom:6px}
    </style>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   EL DIBUJO
   ══════════════════════════════════════════════════════════════════════════ */

export function montarProduccionHora(cont, OPC) {
    if (!cont) return;
    const O = OPC || {};
    const T = Object.assign({ cuadro: 'Picking por hora', verbo: 'picó',
                              accion: 'movieron', origen: 'De dónde la sacan',
                              titulo: 'Picking por día', fuente: 'archivo de picking' },
                            O.textos || {});
    const D = juntarDias(O.dias);

    const rango = selectorRango(O.desde, O.hasta, '', {
        idDesde: 'ph_desde', idHasta: 'ph_hasta' });
    const guardados = (O.fechas || []).length
        ? `El servidor tiene ${O.fechas.length} día${O.fechas.length === 1 ? '' : 's'} guardado${O.fechas.length === 1 ? '' : 's'}: del ${O.fechas[0]} al ${O.fechas[O.fechas.length - 1]}.`
        : '';

    const cabecera = `
      <div class="ph-top">
        <div>
          <h2>${esc(T.titulo)}</h2>
          <p class="ph-sub">Quién ${esc(T.verbo)} qué, hora por hora, del turno de
            08:00 a 19:00. Sale del ${esc(T.fuente)} del WMS.</p>
          ${guardados ? `<div class="ph-guardados">${esc(guardados)}</div>` : ''}
        </div>
        <div>${rango}</div>
      </div>`;

    /* SIN DATOS NO SE DIBUJA NADA, pero se dice por qué y qué hacer. */
    if (!D || !D.canales || !D.canales.length) {
        cont.innerHTML = estilos() + `<div id="ph">${cabecera}
          <div class="ph-pan"><div class="ph-nada">
            <div class="ph-nada-t">No hay nada guardado en ese rango</div>
            <p style="max-width:60ch;margin:0 auto;line-height:1.7;">
              Este cuadro lo publica el robot del servidor con el ${esc(T.fuente)} del
              WMS. Si el rango que elegiste no tiene archivo, no hay nada que mostrar:
              elegí uno de los días guardados.</p>
          </div></div></div>`;
        engancharRango(cont, O);
        return;
    }

    const HORAS = D.horas, C = D.cortes || {};
    const SOLOS = D.canales.filter(c => c !== 'TODOS');
    let vista = 'vol', clase = 't';

    cont.innerHTML = estilos() + `<div id="ph">
      ${cabecera}

      <div class="ph-canal" id="ph_canales">
        <span class="ph-rot">Canal</span>
        <button id="ph_combo" type="button" aria-expanded="false"
                aria-controls="ph_desplegable">Todos los canales</button>
        <div id="ph_desplegable" hidden>
          <div id="ph_lista"></div>
          <div class="ph-acciones">
            <button type="button" id="ph_todos">Todos</button>
            <button type="button" id="ph_ninguno">Ninguno</button>
          </div>
        </div>
      </div>

      <div class="ph-tarj" id="ph_tarjetas"></div>

      <div class="ph-pan">
        <div class="ph-cab"><h3>Por canal</h3>
          <p>Si el destino figura en el <b>maestro de rutas</b> es una tienda, y eso
            es retail. Lo que no es tienda lo separa el <b>Tipo de orden</b> del
            Detalle de Orden.</p></div>
        <div class="ph-sc"><table>
          <thead><tr><th>Canal</th><th class="n">Líneas</th><th class="n">Suelto</th>
            <th class="n">Prepack</th><th class="n">No calz.</th><th class="n">Pares</th>
            <th class="n">%</th><th class="n">Personas</th></tr></thead>
          <tbody id="ph_porcanal"></tbody></table></div>
      </div>

      <div class="ph-pan">
        <div class="ph-cab"><h3>El turno, hora por hora</h3>
          <p>El prepack cuenta por sus <b>pares</b>, no por cajas: una caja de 10
            son 10 pares.</p></div>
        <div class="ph-sc"><table>
          <thead><tr><th>Hora</th><th class="n">Calzado suelto</th>
            <th class="n">Calzado prepack</th><th class="n">No calzado</th>
            <th class="n">Pares</th><th class="n">Líneas</th><th class="n">Personas</th>
            <th class="n">Pares/persona</th></tr></thead>
          <tbody id="ph_horas"></tbody></table></div>
        <div class="ph-nota" id="ph_nota_horas"></div>
      </div>

      <div class="ph-pan ph-mtz">
        <div class="ph-cab"><h3 id="ph_mtz_tit">${esc(T.cuadro)}</h3>
          <p id="ph_mtz_pie"></p></div>
        <div class="ph-selec" id="ph_sel"></div>
        <div class="ph-sc"><table>
          <thead><tr><th>#</th><th>Persona</th>
            ${HORAS.map(h => `<th class="n">${String(h).padStart(2, '0')}</th>`).join('')}
            <th class="n">Pares</th>
            <th class="n" title="líneas por hora sobre el tiempo trabajado">Lín/h</th>
            <th class="n">Líneas</th>
            <th class="n" title="minutos de trabajo, sumando tramos">Min</th></tr></thead>
          <tbody id="ph_cuerpo"></tbody></table></div>
        <div class="ph-nota" id="ph_mtz_nota"></div>
      </div>

      <div class="ph-dos">
        <div class="ph-pan"><div class="ph-cab"><h3>Por marca</h3>
            <p>Las 10 que más movieron en lo que está filtrado</p></div>
          <div class="ph-sc"><table>
            <thead><tr><th>Marca</th><th class="n">Suelto</th><th class="n">Prepack</th>
              <th class="n">No calz.</th><th class="n">Pares</th>
              <th class="n">Líneas</th></tr></thead>
            <tbody id="ph_marcas"></tbody></table></div></div>

        <div class="ph-pan"><div class="ph-cab"><h3>Por colección</h3>
            <p>La Coleccion PO del Maestro, no la Temporada del mezzanine</p></div>
          <div class="ph-sc"><table>
            <thead><tr><th>Colección</th><th class="n">Suelto</th><th class="n">Prepack</th>
              <th class="n">No calz.</th><th class="n">Pares</th>
              <th class="n">Líneas</th></tr></thead>
            <tbody id="ph_colec"></tbody></table></div></div>
      </div>

      <div class="ph-pan">
        <div class="ph-cab"><h3>${esc(T.origen)}</h3>
          <p>La zona sale de la ubicación de origen de cada línea</p></div>
        <div class="ph-sc"><table>
          <thead><tr><th>Zona</th><th class="n">Suelto</th><th class="n">Prepack</th>
            <th class="n">No calz.</th><th class="n">Pares</th>
            <th class="n">Ubicaciones</th></tr></thead>
          <tbody id="ph_zonas"></tbody></table></div>
      </div>
    </div>`;

    const el = (id) => cont.querySelector('#ph_' + id);
    const raiz = cont.querySelector('#ph');

    /* ── el ritmo: misma fórmula y mismos guardarraíles que el análisis ──
       Una raya no es un cero: es que no alcanza la muestra. */
    const activos = (tramos) => unirTramos(tramos, (C.puenteMin || 0) * 60)
        .reduce((s, [a, b]) => s + (b - a), 0);

    function ritmo(lineas, tramos, dia) {
        const seg = activos(tramos);
        if (!seg || lineas < 2) return null;
        if (lineas < (dia ? C.lineasDia : C.lineasCelda)) return null;
        if (seg < (dia ? C.minutosDia : C.minutosCelda) * 60) return null;
        if (seg / (lineas - 1) < C.segLineaMin) return null;  // confirmación en bloque
        return Math.round(lineas / (seg / 3600));
    }

    /* ── el combo de canal ── */
    el('lista').innerHTML = SOLOS.map(c => `<label><input type="checkbox"
        value="${esc(c)}" checked> <span>${esc(c)}</span>
        <span class="ph-chip">${nf(D.vistas[c].totales.lineas)}</span></label>`).join('');

    const marcados = () => [...el('lista').querySelectorAll('input:checked')].map(x => x.value);

    const V = () => {
        const sel = marcados();
        if (sel.length === SOLOS.length) return D.vistas.TODOS;
        return combinarVistas(sel.map(c => D.vistas[c]), HORAS, (C.puenteMin || 0) * 60);
    };

    function rotulo() {
        const s = marcados();
        el('combo').textContent = s.length === SOLOS.length ? 'Todos los canales'
            : s.length === 0 ? 'Ningún canal'
            : s.length === 1 ? s[0]
            : s.length + ' canales';
    }

    /* ── el cuadro que compara los canales, siempre entero ── */
    const tot = D.vistas.TODOS.totales;
    el('porcanal').innerHTML = SOLOS.map(c => {
        const t = D.vistas[c].totales;
        return `<tr data-canal="${esc(c)}"><td class="k">${esc(c)}
            <span class="ph-cod">${esc(CANAL_PIE[c] || '')}</span></td>
          <td class="n">${nf(t.lineas)}</td>
          <td class="n">${nf(t.cal_suelto)}</td><td class="n">${nf(t.cal_prepack)}</td>
          <td class="n">${nf(t.no_cal)}</td>
          <td class="n f">${nf(t.total)}<span class="ph-bar"
            style="width:${Math.round(100 * t.total / (tot.total || 1))}%"></span></td>
          <td class="n">${Math.round(1000 * t.total / (tot.total || 1)) / 10}%</td>
          <td class="n">${D.gentePorCanal[c]}</td></tr>`;
    }).join('') + `<tr class="total"><td class="k">TODOS</td>
        <td class="n">${nf(tot.lineas)}</td><td class="n">${nf(tot.cal_suelto)}</td>
        <td class="n">${nf(tot.cal_prepack)}</td><td class="n">${nf(tot.no_cal)}</td>
        <td class="n">${nf(tot.total)}</td><td class="n">100%</td>
        <td class="n">${D.gentePorCanal.TODOS}</td></tr>`;

    /* ── los botones de la matriz ── */
    el('sel').innerHTML = '<span class="ph-rot">Ver</span>'
        + '<button data-vista="vol" aria-pressed="true">Volumen</button>'
        + '<button data-vista="ef">Efectividad</button>'
        + '<span class="div"></span><span class="ph-rot">Clase</span>'
        + CLASES.map(([k, lab]) => `<button data-clase="${CORTO[k]}"${
            k === 'total' ? ' aria-pressed="true"' : ''}>${lab}</button>`).join('');

    /* ── todo lo que depende del canal ── */
    function pintar() {
        const v = V(), t = v.totales;
        raiz.style.setProperty('--ph-mtz', COLOR[clase]);
        el('sel').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',
            b.dataset.vista ? String(b.dataset.vista === vista) : String(b.dataset.clase === clase)));
        const sel = marcados();
        el('porcanal').querySelectorAll('tr').forEach(tr =>
            tr.classList.toggle('elegida', !!tr.dataset.canal && sel.includes(tr.dataset.canal)));

        const act = HORAS.map(h => [h, v.por_hora[h].total]).filter(x => x[1]);
        const pico = act.length ? act.reduce((a, b) => b[1] > a[1] ? b : a) : [0, 0];

        el('tarjetas').innerHTML = [
            ['', 'Calzado suelto', nf(t.cal_suelto),
             'pares · ' + Math.round(100 * t.cal_suelto / (t.total || 1)) + '% de lo filtrado'],
            ['pre', 'Calzado prepack', nf(t.cal_prepack), 'pares, no cajas'],
            ['nc', 'No calzado', nf(t.no_cal), 'bolsas y complementos'],
            ['gr', 'Total', nf(t.total),
             nf(t.lineas) + ' líneas · ' + v.gente.length + ' personas'],
            ['gr', 'Hora pico', pico[0] ? String(pico[0]).padStart(2, '0') + ':00' : '–',
             pico[1] ? nf(pico[1]) + ' pares con ' + v.por_hora[pico[0]].personas + ' personas' : ''],
        ].map(([cl, e, val, d]) => `<div class="ph-t ${cl}"><span class="e">${e}</span>
            <div class="v">${val}</div><div class="d">${d}</div></div>`).join('');

        /* el turno hora por hora */
        const maxh = Math.max(1, ...HORAS.map(h => v.por_hora[h].total));
        const topeGente = act.length ? Math.max(...act.map(y => v.por_hora[y[0]].personas)) : 0;
        const valle = act.filter(x => v.por_hora[x[0]].personas >= topeGente / 2)
            .reduce((a, b) => b[1] < a[1] ? b : a, [0, Infinity]);
        el('horas').innerHTML = HORAS.map(h => {
            const x = v.por_hora[h], n = x.personas;
            const eti = h === pico[0] ? ' <span class="ph-eti ph-eti-ok">pico</span>'
                      : h === valle[0] ? ' <span class="ph-eti ph-eti-ojo">refrigerio</span>' : '';
            return `<tr${x.total ? '' : ' class="off"'}>
              <td class="k">${String(h).padStart(2, '0')}:00${eti}</td>
              <td class="n">${nf(x.cal_suelto)}</td><td class="n">${nf(x.cal_prepack)}</td>
              <td class="n">${nf(x.no_cal)}</td>
              <td class="n f">${nf(x.total)}<span class="ph-bar"
                style="width:${Math.round(100 * x.total / maxh)}%"></span></td>
              <td class="n">${nf(x.lineas)}</td><td class="n">${n || '–'}</td>
              <td class="n">${n ? nf(Math.round(x.total / n)) : '–'}</td></tr>`;
        }).join('');
        el('nota_horas').innerHTML = act.length
            ? `El hundimiento de las <b>${String(valle[0]).padStart(2, '0')}:00</b> es el
               refrigerio: ${nf(valle[1])} pares contra ${nf(pico[1])} en el pico de las
               <b>${String(pico[0]).padStart(2, '0')}:00</b>.`
            : (sel.length ? 'Esta selección no movió nada en ese rango.'
                          : 'Elige al menos un canal arriba.');

        pintarMatriz(v);

        /* marca, colección y zonas */
        const corte = (lista) => {
            const top = Math.max(1, ...lista.map(x => x.total));
            return lista.slice(0, 10).map(x => `<tr>
              <td class="k">${esc(x.nom)}</td>
              <td class="n">${nf(x.cal_suelto)}</td><td class="n">${nf(x.cal_prepack)}</td>
              <td class="n">${nf(x.no_cal)}</td>
              <td class="n f">${nf(x.total)}<span class="ph-bar"
                style="width:${Math.round(100 * x.total / top)}%"></span></td>
              <td class="n">${nf(x.lineas)}</td></tr>`).join('');
        };
        el('marcas').innerHTML = corte(v.marcas);
        el('colec').innerHTML = corte(v.coleccion);
        el('zonas').innerHTML = v.zonas.slice(0, 12).map(x => `<tr>
            <td class="k">${esc(ZONAS[x.nom] || x.nom)}
              <span class="ph-cod">${esc(x.nom)}</span></td>
            <td class="n">${nf(x.cal_suelto)}</td><td class="n">${nf(x.cal_prepack)}</td>
            <td class="n">${nf(x.no_cal)}</td>
            <td class="n f">${nf(x.total)}<span class="ph-bar"
              style="width:${Math.round(100 * x.total / ((v.zonas[0] || {}).total || 1))}%"></span></td>
            <td class="n">${nf(x.ubicaciones)}</td></tr>`).join('');
    }

    /* ── la matriz persona x hora ── */
    function pintarMatriz(v) {
        const esEf = vista === 'ef';
        const suf = CAMPO[clase];
        const dato = (c, dia) => esEf
            ? ritmo(c[suf + '_l'] != null ? c[suf + '_l'] : c.lineas, c[suf + '_iv'], !!dia)
            : c[suf];

        /* CADA VISTA FILTRA POR LO SUYO. En Volumen entra quien movió pares; en
           Efectividad, solo quien tiene ritmo medible. Antes el filtro miraba el
           volumen en las dos y en "efectividad + no calzado" quedaban filas enteras
           de rayas. Daniel: *"solamente muéstrame los que tienen datos"*. */
        const gente = v.gente
            .filter(g => esEf ? dato(g.total, 1) != null : g.total[suf] > 0)
            .sort((a, b) => {
                const x = dato(a.total, 1), y = dato(b.total, 1);
                if (x == null && y == null) return 0;
                if (x == null) return 1;
                if (y == null) return -1;
                return y - x;
            });

        let max = 0;
        gente.forEach(g => HORAS.forEach(h => {
            const d = dato(g.horas[h]); if (d) max = Math.max(max, d);
        }));

        if (!gente.length) {
            /* UNA TABLA VACÍA NO EXPLICA NADA. Ecommerce no mueve prepack, y sin este
               aviso el cuadro quedaba en blanco y parecía roto. */
            el('cuerpo').innerHTML = `<tr><td colspan="${HORAS.length + 6}" class="vacio">
              ${esEf ? 'Nadie tiene ritmo medible en' : 'Nadie ' + esc(T.verbo)}
              <b>${NOMBRE[clase]}</b> en lo que está filtrado.</td></tr>`;
        } else {
            el('cuerpo').innerHTML = gente.map((g, i) => {
                const celdas = HORAS.map(h => {
                    const c = g.horas[h], d = dato(c);
                    const tit = CLASES.slice(1).filter(([k]) => c[k + '_l'])
                        .map(([k, lab]) => `${lab}: ${nf(c[k + '_l'])} líneas`).join(' — ');
                    return `<td class="n c${d ? '' : ' z'}" title="${esc(tit)}"
                      ${d ? `style="background:rgba(var(--brand-rgb), ${
                          (0.03 + 0.26 * d / (max || 1)).toFixed(3)})"` : ''}
                      >${d ? nf(d) : '–'}</td>`;
                }).join('');
                const G = g.total;
                const rit = ritmo(G.total_l, G.total_iv, 1);
                const mins = Math.round(activos(G.total_iv) / 60) || 0;
                return `<tr><td class="k">${i + 1}</td>
                  <td class="k nom">${esc(g.usuario)}${mins > 0 && mins < (C.muestraCortaMin || 0)
                      ? ` <span class="ph-eti ph-eti-corta" title="menos de ${
                          C.muestraCortaMin} min trabajados">corta</span>` : ''}</td>
                  ${celdas}
                  <td class="n tot">${nf(G[suf] || 0)}</td>
                  <td class="n tot${rit ? '' : ' z'}">${rit ? nf(rit) : '–'}</td>
                  <td class="n sub">${nf(G[suf + '_l'] != null ? G[suf + '_l'] : G.lineas)}</td>
                  <td class="n sub">${nf(mins)}</td></tr>`;
            }).join('');

            /* LA FILA DE ABAJO. En volumen SUMA; en efectividad PROMEDIA, porque
               sumar ritmos daría la velocidad de una persona que no existe. */
            const col = (f) => {
                const vs = gente.map(f).filter(x => x != null && x !== 0);
                if (!vs.length) return null;
                return esEf ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length)
                            : vs.reduce((a, b) => a + b, 0);
            };
            const celdas = HORAS.map(h => {
                const x = col(g => dato(g.horas[h]));
                return `<td class="n${x ? '' : ' z'}">${x ? nf(x) : '–'}</td>`;
            }).join('');
            const ritmos = gente.map(g => ritmo(g.total.total_l, g.total.total_iv, 1)).filter(Boolean);
            const prom = ritmos.length
                ? Math.round(ritmos.reduce((a, b) => a + b, 0) / ritmos.length) : null;
            const pares = gente.reduce((s, g) => s + (g.total[suf] || 0), 0);
            const lin = gente.reduce((s, g) => s + (g.total[suf + '_l'] != null
                ? g.total[suf + '_l'] : g.total.lineas), 0);
            el('cuerpo').insertAdjacentHTML('beforeend', `<tr class="total">
              <td class="k"></td><td class="k">TOTAL</td>
              ${celdas}
              <td class="n">${nf(pares)}</td>
              <td class="n${prom ? '' : ' z'}">${prom ? nf(prom) : '–'}</td>
              <td class="n">${nf(lin)}</td>
              <td class="n">–</td></tr>`);
        }

        el('mtz_tit').textContent = T.cuadro;
        el('mtz_pie').innerHTML = 'Sigue el <b>filtro de canal</b> de arriba. ' + (esEf
            ? 'Cada celda son las <b>líneas por hora</b> sobre el tiempo que esa persona '
              + 'estuvo realmente trabajando. No depende de cuánto trabajo le tocara.'
            : 'Cada celda son los <b>pares</b> que esa persona ' + esc(T.verbo) + ' en esa hora.');
        el('mtz_nota').innerHTML =
            `<b>${gente.length} de ${v.gente.length} personas</b> `
            + (esEf ? `tienen ritmo medible en ${NOMBRE[clase]}`
                    : `${esc(T.accion)} ${NOMBRE[clase]}`)
            + '; el resto no figura. '
            + (esEf
                ? `Líneas por hora, <b>sin la equivalencia del prepack</b>: suelto y prepack
                   se miden por separado. Una raya no es un cero: es que no alcanza la
                   muestra —hacen falta ${C.lineasCelda} líneas y ${C.minutosCelda} min en la
                   celda, ${C.lineasDia} y ${C.minutosDia} min en el total—, y se descartan
                   los tramos de menos de ${C.segLineaMin} segundos por línea, que no son
                   alguien trabajando sino una confirmación en bloque del WMS.`
                : 'Ordenado por pares: dice cuánto trabajo le tocó a cada uno, no qué tan '
                  + 'rápido lo hizo. Para eso está Efectividad.');
    }

    /* ── los enganches ── */
    el('combo').addEventListener('click', (e) => {
        e.stopPropagation();
        const abierto = el('desplegable').hidden;
        el('desplegable').hidden = !abierto;
        el('combo').setAttribute('aria-expanded', String(abierto));
    });
    el('lista').addEventListener('change', () => { rotulo(); pintar(); });
    el('todos').addEventListener('click', () => {
        el('lista').querySelectorAll('input').forEach(x => { x.checked = true; });
        rotulo(); pintar();
    });
    el('ninguno').addEventListener('click', () => {
        el('lista').querySelectorAll('input').forEach(x => { x.checked = false; });
        rotulo(); pintar();
    });
    /* SE CIERRA SOLO: un desplegable que se queda abierto tapa el reporte. Los dos
       escuchas van sobre `document`, así que se sueltan cuando el nodo se va —el
       tablero vuelve a dibujar la pestaña entera en cada clic del sub-menú—. */
    const cerrar = (e) => {
        if (!cont.isConnected) { document.removeEventListener('click', cerrar); return; }
        const caja = el('canales');
        if (caja && !caja.contains(e.target)) {
            el('desplegable').hidden = true;
            el('combo').setAttribute('aria-expanded', 'false');
        }
    };
    document.addEventListener('click', cerrar);
    el('sel').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.vista) vista = b.dataset.vista; else clase = b.dataset.clase;
        pintar();
    });

    engancharRango(cont, O);
    rotulo();
    pintar();
}

/** El rango se engancha por id: `selectorRango` deja los dos inputs y acá se les
 *  escucha. Va aparte porque la pantalla sin datos también lo necesita. */
function engancharRango(cont, O) {
    const d = cont.querySelector('#ph_desde'), h = cont.querySelector('#ph_hasta');
    const avisar = () => {
        if (typeof O.alCambiarRango === 'function') {
            O.alCambiarRango(d ? d.value : null, h ? h.value : null);
        }
    };
    if (d) d.addEventListener('change', avisar);
    if (h) h.addEventListener('change', avisar);
}
