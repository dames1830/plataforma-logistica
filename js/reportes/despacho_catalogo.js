/**
 * DESPACHO DE CATÁLOGO
 *
 * Lo que hoy vive en el AppSheet "Catalogo Tracking", dentro de la plataforma.
 * Daniel, 15-sep-2026: *"no apagues AppSheet, pero arma lo de la maqueta de una vez,
 * con datos reales, y pásalo a beta"*. Los dos conviven: esto LEE, todavía no escribe.
 *
 * ── EL CIRCUITO, QUE ES LO QUE ORDENA LA PANTALLA ─────────────────────────────
 *
 *   1. Llega el Excel de comercial  ->  columnas E a R (asesor, líder, promotor,
 *      rótulo, agencia, destino, pedido, cantidad, flete, observación)
 *   2. Se le pone a mano el ID y la FECHA DE DESPACHO  ->  queda PENDIENTE
 *   3. El liquidador de transporte lo pasa a ATENDIDO con foto, factura y gasto
 *
 * Por eso las tres pestañas son esos tres momentos: HOY lo que se despacha, POR
 * LIQUIDAR lo que falta cerrar, HISTORIAL todo lo demás. El canal va como filtro y no
 * como pestaña, para que sumar Retail mañana sea una casilla y no otra pantalla.
 *
 * ── DE DÓNDE SALEN LOS DATOS ──────────────────────────────────────────────────
 *
 * Del área `despacho_catalogo` (MASTER). Viene COMPACTADA porque son 3.129 filas y el
 * área se descarga entera: los campos que se repiten -agencia, destino, asesor, estado,
 * líder- van en un catálogo y cada fila guarda el número. `abrir()` los rearma.
 *
 * La ruta de la foto también viene partida: todas son STATUS_Images/<id>.FOTO.<hora>,
 * así que se guarda solo la hora. El patrón viaja en el propio paquete (`fotoPatron`)
 * para que no haya que adivinarlo acá.
 *
 * ── LO QUE SE NORMALIZÓ AL IMPORTAR, y por qué importa ────────────────────────
 *
 * Agencia y asesor se pasaron a MAYÚSCULAS. En la hoja había "SHALOM" 1.538 veces y
 * "Shalom" 80: la misma agencia contada dos veces. De 140 agencias distintas quedaron
 * 102 reales, y de 753 destinos, 580.
 */

import * as DES from '../services_v245/despachoCatalogo.js?v=29.0821';
/* EL RANGO DE FECHAS ES EL DE TODA LA PLATAFORMA, no uno propio. Acá había dos
   <input type="date"> sueltos, que es justo lo que `selectorRango` vino a terminar: 21
   pantallas armaban el suyo, unas con "DE:/HASTA:", otras con "DE/A", la mayoría sin
   decir qué era el primer campo. Daniel lo cantó apenas lo vio al lado del Tracking:
   *"la fecha la puedes poner en una fila"*. Una sola caja que se lee como una frase. */
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0821';
/* La lectura del Excel es LA MISMA que usa el celular. Dos formas de leer el mismo
   archivo es el camino mas corto a que dos pantallas digan numeros distintos. */
import * as ORD from '../services_v245/despachoOrden.js?v=29.0821';

/* ── DE DÓNDE SALEN LOS DATOS ─────────────────────────────────────────────────
   De `despachoCatalogo.js`, que los baja POR SEMANAS. Acá había una copia de todo
   -las áreas, el achicado de fotos, el rearmado del paquete, la fecha de hoy- escrita
   antes de que existiera la pantalla del celular. Se fue: dos copias de la misma regla
   es el camino más corto a que la web y el celular digan números distintos del mismo
   día, y cuando dos pantallas se contradicen no se puede creer a ninguna.

   Lo que sí es de acá son los colores: el celular tiene su propia paleta. */
const { AREA_ADJ, guardarArea, achicarFoto, aBase64, TOPE_MB, hoyTexto } = DES;

/* Los estados que usa el AppSheet, con los colores de la web. Los dos primeros son los
   únicos que aparecen en las 3.129 filas de hoy; PENDIENTE y REPROGRAMAR existen en el
   formulario pero no quedan registrados, porque hoy se carga y se liquida casi seguido. */
const ESTADOS = {
    'ATENDIDO':    { et: 'Atendido',    color: 'var(--success)', fondo: 'rgba(var(--success-rgb), 0.12)' },
    'NO ATENDIDO': { et: 'No atendido', color: 'var(--danger)',  fondo: 'rgba(var(--danger-rgb), 0.12)' },
    'PENDIENTE':   { et: 'Pendiente',   color: 'var(--warning)', fondo: 'rgba(var(--warning-rgb), 0.12)' },
    'REPROGRAMAR': { et: 'Reprogramar', color: 'var(--warning)', fondo: 'rgba(var(--warning-rgb), 0.12)' }
};

const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('es-PE');
const soles = (n) => (n === null || n === undefined || n === '') ? '\u2014'
    : 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DIAS = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const fechaBonita = (f) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f || ''))) return f || '\u2014';
    const [a, m, d] = f.split('-').map(Number);
    const x = new Date(a, m - 1, d);
    return `${DIAS[x.getDay()]} ${d} de ${MESES[m - 1]}`;
};
const fechaCorta = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) ? f.slice(8, 10) + '/' + f.slice(5, 7) : (f || '\u2014');

let borrador = null;
let guardando = false;

/* ── EL ESTADO DE LA PANTALLA ────────────────────────────────────────────────── */
let pestana = 'hoy';
/* EL RANGO ARRANCA EN LA SEMANA EN CURSO, lunes a sábado, y no en el historial entero.
   Daniel, 15-sep-2026: *"no es necesario que tengas los 3.000 y tantos registros… no
   es mejor tener un rango de fechas y que se actualice a la fecha actual"*. El paquete
   completo son 1.144 KB y crece ~450 KB por mes; una semana son 20. */
const sem0 = DES.rangoDeLaSemana();
let filtro = { canal: 'catalogo', agencia: '', asesor: '', estado: '', texto: '',
               desde: sem0.desde, hasta: sem0.hasta };
let abierta = null;          /* el id de la fila abierta en la ficha */
let raiz = null;
let FILAS = [];              /* SOLO lo que la pestaña de turno necesita, de ESTE canal */
let cargando = false;
let diaMostrado = '';        /* qué día está mostrando la pestaña Hoy */
let marca = '';              /* la tarjeta del resumen que se tocó */
/* LA ORDEN QUE SE ESTA CARGANDO. null = no hay ninguna. Si no, lo leido del archivo
   esperando el visto bueno: nada se escribe hasta que se toca el boton. */
let carga = null;

/* ── UNA PANTALLA, DOS MÓDULOS ────────────────────────────────────────
   Daniel, 15-sep-2026: *"en la aplicación va a haber un solo tracking, yo puedo poner
   retail o no retail; pero cuando liquide, la data se va a ir al módulo que has creado
   en la web... un submódulo llamado tracking retail"*.

   Así que este archivo se monta DOS VECES, una en NO RETAIL y otra en Despacho, y lo
   único que cambia es el canal. No es una copia: una copia significaría arreglar cada
   cosa dos veces y que al mes digan números distintos.

   Lo que sí hay que hacer es LIMPIAR AL CAMBIAR DE CANAL. El estado -la pestaña, los
   filtros, la ficha abierta- vive en el módulo, y sin limpiarlo pasar de Catálogo a
   Retail arrastraría el filtro de agencia del otro y mostraría una lista vacía que
   parecería un error. */
const CARA = {
    catalogo: { ttl: 'Despacho de Catálogo', que: 'de catálogo' },
    retail:   { ttl: 'Tracking Retail',      que: 'de retail' }
};
let CANAL = 'catalogo';

const pendiente = (f) => DES.sinLiquidar(f);

const delDia = (f, dia) => String(f.desp || '') === dia;

/* ── QUÉ SE BAJA EN CADA PESTAÑA ──────────────────────────────────────────────
   Hoy         la semana en curso, y se muestra el día de hoy
   Por liquidar solo las semanas que el índice marca con guías abiertas
   Historial   las semanas que toca el rango elegido */
const cargar = async (recargar) => {
    cargando = true;
    try {
        if (pestana === 'liquidar') {
            FILAS = await DES.traerPendientes(recargar, CANAL);
            diaMostrado = '';
        } else if (pestana === 'hoy') {
            const r = DES.rangoDeLaSemana();
            FILAS = DES.delCanal(await DES.traerRango(r.desde, r.hasta, recargar), CANAL);
            diaMostrado = hoyTexto();
            /* SI HOY NO HAY NADA, SE MUESTRA EL ÚLTIMO DÍA CON DESPACHOS. Una pantalla
               en blanco haría pensar que está rota cuando lo que pasa es que todavía no
               cargaron el día. El último día lo dice el índice, sin bajar nada. */
            if (!FILAS.some((f) => delDia(f, diaMostrado))) {
                const i = DES.elIndice();
                const ult = (i && i.hasta) || '';
                if (ult && ult < diaMostrado) {
                    const r2 = DES.rangoDeLaSemana(ult);
                    FILAS = DES.delCanal(await DES.traerRango(r2.desde, r2.hasta, recargar), CANAL);
                    diaMostrado = ult;
                }
            }
        } else {
            FILAS = DES.delCanal(await DES.traerRango(filtro.desde, filtro.hasta, recargar), CANAL);
            diaMostrado = '';
        }
    } finally {
        cargando = false;
    }
};

const visibles = () => {
    let L = FILAS;
    if (pestana === 'hoy') L = L.filter((f) => delDia(f, diaMostrado));
    else if (pestana === 'liquidar') L = L.filter(pendiente);
    if (filtro.agencia) L = L.filter((f) => f.age === filtro.agencia);
    if (filtro.asesor) L = L.filter((f) => f.ase === filtro.asesor);
    if (filtro.estado) L = L.filter((f) => String(f.est || '').toUpperCase() === filtro.estado);
    if (filtro.texto) {
        const t = filtro.texto.toLowerCase();
        L = L.filter((f) => [f.rot, f.prom, f.ped, f.dest, f.age, f.fact, f.lider]
            .some((x) => String(x || '').toLowerCase().indexOf(t) >= 0));
    }
    return L;
};

/* ── PEDAZOS DE PANTALLA ─────────────────────────────────────────────────────── */
const pastilla = (e) => {
    const k = String(e || '').toUpperCase();
    const c = ESTADOS[k] || { et: k || 'Sin estado', color: 'var(--text-muted)', fondo: 'rgba(var(--ink-rgb), 0.06)' };
    return `<span style="display:inline-block; font-size:var(--t-xs); font-weight:800; letter-spacing:.04em;
        text-transform:uppercase; padding:2px 7px; border-radius:4px; white-space:nowrap;
        background:${c.fondo}; color:${c.color};">${esc(c.et)}</span>`;
};

/* ══ LAS TARJETAS DEL RESUMEN FILTRAN ═════════════════════════════════
   Daniel lo pidió para el celular —*"quiero entrar a la incidencia y no me da la
   opción"*— y acá faltaba lo mismo, peor: "con incidencia" no se podía alcanzar con
   NINGÚN filtro de esta pantalla. Los estados tenían su lista desplegable; la
   incidencia no tenía nada, y es la que uno busca.

   LOS NÚMEROS NO CAMBIAN AL FILTRAR: siguen siendo los del rango, que es lo que
   permite volver. Lo que se recorta es la tabla. */
const tarjeta = (n, rotulo, color, id) => `
    <div ${id !== undefined ? `data-marca="${id}" style="cursor:pointer;` : 'style="'}flex:1; min-width:96px;
                background:${id !== undefined && marca === id ? 'rgba(var(--primary2-rgb), 0.12)' : 'var(--panel)'};
                border:1px solid ${id !== undefined && marca === id ? 'var(--primary-2)' : 'var(--border)'};
                border-radius:12px; padding:.7rem .8rem;">
      <div style="font-family:var(--font-num); font-size:var(--t-2xl); font-weight:900; line-height:1.1;
                  color:${color || 'var(--text-strong)'};">${n}</div>
      <div style="font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase;
                  letter-spacing:.05em; margin-top:2px;">${esc(rotulo)}</div>
    </div>`;

const opciones = (campo, puesto) => {
    const vals = Array.from(new Set(FILAS.map((f) => f[campo]).filter(Boolean))).sort();
    return vals.map((v) => `<option value="${esc(v)}" ${v === puesto ? 'selected' : ''}>${esc(v)}</option>`).join('');
};

const barra = () => {
    const L = visibles();
    /* LAS CUENTAS SALEN DEL ÍNDICE, que pesa 1,3 KB. Antes salían de tener las 3.129
       filas en memoria, que es justamente lo que ya no se baja. */
    const abiertas = DES.abiertasDelCanal(CANAL);
    /* UN CERO NO ES LO MISMO QUE NO SABERLO: si la semana todavía no se bajó, la
       pestaña dice lo que costaría bajarla, nunca un cero que se leería como
       "ese día no se despachó nada". */
    const cuenta = (desde, hasta) => {
        const n = DES.contarRango(desde, hasta, CANAL);
        return n === null ? '·' : num(n);
    };
    const hoy = hoyTexto();
    const pes = [
        ['hoy', pestana === 'hoy' && diaMostrado && diaMostrado !== hoy
                ? fechaBonita(diaMostrado) : 'Hoy',
         pestana === 'hoy' ? num(L.length) : cuenta(hoy, hoy)],
        ['liquidar', 'Por liquidar', num(abiertas)],
        ['rango', 'Historial', pestana === 'rango' ? num(FILAS.length) : cuenta(filtro.desde, filtro.hasta)]
    ];
    return `
    <div style="display:flex; gap:.4rem; border-bottom:1px solid var(--border); margin-bottom:1rem;
                flex-wrap:wrap; align-items:center;">
      ${pes.map(([id, et, n]) => `
        <button type="button" data-pes="${id}" style="background:none; border:0; cursor:pointer;
            padding:.55rem .9rem; font-size:var(--t-sm); font-weight:800; font-family:inherit;
            color:${pestana === id ? 'var(--primary-2)' : 'var(--text-muted)'};
            border-bottom:2px solid ${pestana === id ? 'var(--primary-2)' : 'transparent'};">
          ${esc(et)} <span style="font-family:var(--font-num); font-weight:400; opacity:.75;">${esc(n)}</span>
        </button>`).join('')}
      ${cargando ? `<span style="margin-left:auto; padding:.55rem .3rem; font-size:var(--t-xs);
          color:var(--text-muted); display:flex; align-items:center; gap:.4rem;">
          <span style="width:12px; height:12px; border:2px solid rgba(var(--primary2-rgb), 0.2);
            border-left-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;
            display:inline-block;"></span>trayendo…</span>` : ''}
    </div>

    <div style="display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem;">
      <input id="dc_txt" type="text" placeholder="Buscar rótulo, pedido, factura, destino…"
        value="${esc(filtro.texto)}" style="flex:1; min-width:220px; background:var(--input-bg);
        border:1px solid var(--border); border-radius:9px; padding:.5rem .7rem; color:var(--text-main);
        font-size:var(--t-sm); font-family:inherit;">
      <select id="dc_age" style="background:var(--input-bg); border:1px solid var(--border); border-radius:9px;
        padding:.5rem .6rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit;">
        <option value="">Todas las agencias</option>${opciones('age', filtro.agencia)}</select>
      <select id="dc_ase" style="background:var(--input-bg); border:1px solid var(--border); border-radius:9px;
        padding:.5rem .6rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit;">
        <option value="">Todos los asesores</option>${opciones('ase', filtro.asesor)}</select>
      <select id="dc_est" style="background:var(--input-bg); border:1px solid var(--border); border-radius:9px;
        padding:.5rem .6rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit;">
        <option value="">Todos los estados</option>
        ${Object.keys(ESTADOS).map((k) => `<option value="${k}" ${filtro.estado === k ? 'selected' : ''}>${esc(ESTADOS[k].et)}</option>`).join('')}
      </select>
      ${pestana === 'rango' ? selectorRango(filtro.desde, filtro.hasta, null,
          { idDesde: 'dc_d1', idHasta: 'dc_d2' }) + atajos() : ''}
      <label id="dc_cargar" title="Cargar la orden que manda comercial"
        style="background:rgba(var(--primary2-rgb), 0.12); border:1px solid var(--primary-2);
        border-radius:9px; padding:.5rem .8rem; color:var(--primary-2); font-size:var(--t-sm);
        font-weight:700; cursor:pointer; font-family:inherit; display:inline-flex; gap:.35rem;
        align-items:center;">\ud83d\udcc4 Cargar orden<input type="file" data-dc-cargar
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style="display:none"></label>
      <button type="button" id="dc_excel" style="background:var(--panel); border:1px solid var(--border);
        border-radius:9px; padding:.5rem .8rem; color:var(--text-soft); font-size:var(--t-sm);
        font-weight:700; cursor:pointer; font-family:inherit;">Excel (${num(deLaMarca(L).length)})</button>
    </div>`;
};

/* ── LOS ATAJOS DE FECHA ──────────────────────────────────────────────────────
   Nadie quiere teclear dos fechas para ver la semana pasada. Y cada uno dice al lado
   cuánto falta bajar: la semana en curso ya está en memoria y no cuesta nada; el mes
   entero son cuatro semanas más.

   Cada uno decía al lado cuánto pesaba bajarlo -"+228 KB"-. Se fue: Daniel lo vio en el
   celular y lo llamó por su nombre, *"quita esta tontería de la app"*. Es plomería
   nuestra asomándose a la pantalla de otro, y no deja de serlo por estar en la web. */
const RANGOS = [
    ['Esta semana', () => DES.rangoDeLaSemana()],
    ['La pasada', () => DES.rangoDeLaSemana(DES.sumarDias(hoyTexto(), -7))],
    ['Últimos 15 días', () => ({ desde: DES.sumarDias(hoyTexto(), -14), hasta: hoyTexto() })],
    ['Este mes', () => ({ desde: hoyTexto().slice(0, 8) + '01', hasta: hoyTexto() })]
];

const atajos = () => RANGOS.map(([et, dame], k) => {
    const r = dame();
    const puesto = r.desde === filtro.desde && r.hasta === filtro.hasta;
    return `<button type="button" data-rango="${k}" title="${esc(fechaBonita(r.desde))} a ${esc(fechaBonita(r.hasta))}"
        style="background:${puesto ? 'rgba(var(--primary2-rgb), 0.14)' : 'var(--panel)'};
        border:1px solid ${puesto ? 'var(--primary-2)' : 'var(--border)'}; border-radius:9px;
        padding:.5rem .7rem; color:${puesto ? 'var(--primary-2)' : 'var(--text-soft)'};
        font-size:var(--t-sm); font-weight:700; cursor:pointer; font-family:inherit;">${esc(et)}</button>`;
}).join('');

const deLaMarca = (L) =>
      marca === 'atendidos' ? L.filter((f) => String(f.est).toUpperCase() === 'ATENDIDO')
    : marca === 'no atendidos' ? L.filter((f) => String(f.est).toUpperCase() === 'NO ATENDIDO')
    : marca === 'por liquidar' ? L.filter(pendiente)
    : marca === 'con incidencia' ? L.filter((f) => f.inc)
    : L;

const resumen = (L) => {
    const at = L.filter((f) => String(f.est).toUpperCase() === 'ATENDIDO').length;
    const no = L.filter((f) => String(f.est).toUpperCase() === 'NO ATENDIDO').length;
    const pen = L.filter(pendiente).length;
    const inc = L.filter((f) => f.inc).length;
    const gasto = L.reduce((a, f) => a + (Number(f.gasto) || 0), 0);
    return `
    <div style="display:flex; gap:.6rem; flex-wrap:wrap; margin-bottom:1rem;">
      ${tarjeta(num(L.length), 'despachos', null, '')}
      ${tarjeta(num(at), 'atendidos', 'var(--success)', 'atendidos')}
      ${pen ? tarjeta(num(pen), 'por liquidar', 'var(--warning)', 'por liquidar') : ''}
      ${tarjeta(num(no), 'no atendidos', no ? 'var(--danger)' : null, 'no atendidos')}
      ${tarjeta(num(inc), 'con incidencia', inc ? 'var(--warning)' : null, 'con incidencia')}
      ${tarjeta(soles(gasto).replace('S/ ', ''), 'gasto S/')}
    </div>
    ${marca ? `<p data-marca="" style="margin:-.5rem 0 1rem; cursor:pointer; font-size:var(--t-sm);
       color:var(--primary-2);">Viendo solo <b>${esc(marca)}</b> (${num(deLaMarca(L).length)} de
       ${num(L.length)}) · tocar para ver todo</p>` : ''}`;
};

const tabla = (L) => {
    if (!L.length) {
        /* "No hay con estos filtros" cuando no hay ningun filtro puesto hace pensar
           que algo quedo mal marcado. Se dice lo que realmente pasa en cada caso. */
        const puestos = filtro.texto || filtro.agencia || filtro.asesor || filtro.estado;
        const que = puestos ? 'No hay despachos con estos filtros.'
                  : pestana === 'liquidar' ? 'No queda ninguna guía por liquidar.'
                  : pestana === 'rango' ? 'No hubo despachos entre esas dos fechas.'
                  : 'Todavía no se cargó ninguna guía de este día.';
        return `<div style="padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:var(--t-sm);">
            ${esc(que)}</div>`;
    }
    /* Tope de dibujado: 3.129 filas de golpe cuelgan la pantalla un segundo largo y
       nadie mira más de doscientas. El Excel sí se las lleva todas. */
    const TOPE = 300;
    const corta = L.slice(0, TOPE);
    const th = (t, a) => `<th style="text-align:${a || 'left'}; padding:.5rem .55rem; font-size:var(--t-xs);
        text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); font-weight:800;
        border-bottom:1px solid var(--border); white-space:nowrap; position:sticky; top:0;
        background:var(--panel-solid); z-index:1;">${esc(t)}</th>`;
    return `
    <div style="overflow:auto; max-height:62vh; border:1px solid var(--border); border-radius:12px;">
      <table style="border-collapse:collapse; width:100%; min-width:1040px; font-size:var(--t-sm);">
        <thead><tr>
          ${th('ID')}${th('Despacho')}${th('Asesor')}${th('Rótulo')}${th('Agencia')}${th('Destino')}
          ${th('Pedido')}${th('Cant', 'right')}${th('Estado')}${th('Factura')}${th('Gasto', 'right')}
          ${th('Foto', 'center')}${th('Incidencia')}
        </tr></thead>
        <tbody>
          ${corta.map((f) => `
          <tr data-fila="${esc(f.id)}" style="border-bottom:1px solid rgba(var(--ink-rgb), 0.05); cursor:pointer;">
            <td style="padding:.45rem .55rem; font-family:var(--font-num); font-size:var(--t-xs); color:var(--text-muted);">${esc(f.id)}</td>
            <td style="padding:.45rem .55rem; font-family:var(--font-num); font-size:var(--t-xs); white-space:nowrap;">${esc(fechaCorta(f.desp))}</td>
            <td style="padding:.45rem .55rem; white-space:nowrap;">${esc(f.ase || '')}</td>
            <td style="padding:.45rem .55rem; color:var(--text-strong); font-weight:600; max-width:260px;
                       overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(f.rot || f.prom || '')}</td>
            <td style="padding:.45rem .55rem; white-space:nowrap;">${esc(f.age || '')}</td>
            <td style="padding:.45rem .55rem; white-space:nowrap;">${esc(f.dest || '')}</td>
            <td style="padding:.45rem .55rem; font-family:var(--font-num); font-size:var(--t-xs); white-space:nowrap;">${esc(f.ped || '')}</td>
            <td style="padding:.45rem .55rem; text-align:right; font-family:var(--font-num);">${num(f.cant)}</td>
            <td style="padding:.45rem .55rem;">${pastilla(f.est)}</td>
            <td style="padding:.45rem .55rem; font-family:var(--font-num); font-size:var(--t-xs); white-space:nowrap;">${esc(f.fact || '')}</td>
            <td style="padding:.45rem .55rem; text-align:right; font-family:var(--font-num);">${f.gasto ? num(f.gasto) : ''}</td>
            <td style="padding:.45rem .55rem; text-align:center;" title="${f.foto === 'plataforma' ? 'Subida desde la plataforma' : (f.foto ? 'En el Drive del AppSheet' : '')}">${f.foto === 'plataforma' ? '📷' : (f.foto ? '<span style="opacity:.45">📷</span>' : '')}</td>
            <td style="padding:.45rem .55rem; color:var(--danger-pale); max-width:230px; overflow:hidden;
                       text-overflow:ellipsis; white-space:nowrap;">${esc(f.inc || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${L.length > TOPE ? `<p style="margin:.6rem 0 0; font-size:var(--t-xs); color:var(--text-muted);">
        Se dibujan las primeras ${num(TOPE)} de ${num(L.length)}. Afina los filtros, o baja el Excel
        que se las lleva todas.</p>` : ''}`;
};

/* ── LA FICHA ─────────────────────────────────────────────────────────────────
   El mismo formulario del AppSheet, de solo lectura por ahora: esto todavía no
   escribe, y un botón que no guarda es peor que no tenerlo. */
const campoTexto = (id, rotulo, valor, tipo) => `
    <label style="display:block; margin-bottom:.45rem;">
      <span style="display:block; font-size:var(--t-xs); color:var(--text-muted); margin-bottom:2px;">${esc(rotulo)}</span>
      <input id="${id}" type="${tipo || 'text'}" value="${esc(valor === null || valor === undefined ? '' : valor)}"
        style="width:100%; background:var(--input-bg); border:1px solid var(--border); border-radius:8px;
               padding:.45rem .6rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit;">
    </label>`;

const ficha = () => {
    if (!abierta) return '';
    const f = DES.filaDe(abierta) || FILAS.find((x) => String(x.id) === String(abierta));
    if (!f) return '';
    const b = borrador || {};
    const val = (k) => (b[k] !== undefined ? b[k] : (f[k] !== undefined ? f[k] : ''));
    const est = String(val('est') || '').toUpperCase();
    const c = ESTADOS[est] || {};
    const dato = (r, v, mono) => `
        <div style="display:flex; justify-content:space-between; gap:1rem; padding:.2rem 0; font-size:var(--t-sm);">
          <span style="color:var(--text-muted); flex-shrink:0;">${esc(r)}</span>
          <span style="color:var(--text-strong); font-weight:700; text-align:right;
                ${mono ? 'font-family:var(--font-num);' : ''}">${esc(v || '—')}</span>
        </div>`;
    const caja = (t, dentro) => `
        <div style="background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:.75rem .85rem;">
          <div style="font-size:var(--t-xs); text-transform:uppercase; letter-spacing:.1em; font-weight:800;
                      color:var(--text-muted); margin-bottom:.4rem;">${esc(t)}</div>${dentro}</div>`;

    const adj = (cual, rotulo, pide) => {
        const puesto = b['_' + cual] !== undefined ? b['_' + cual] : null;
        const hay = puesto || (cual === 'foto' && f.foto);
        return `
        <div style="flex:1; min-width:0;">
          <div style="font-size:var(--t-xs); color:${pide && !hay ? 'var(--danger)' : 'var(--text-muted)'};
                      margin-bottom:3px;">${esc(rotulo)}${pide ? ' *' : ''}</div>
          <label style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                 gap:3px; aspect-ratio:3/4; border-radius:10px; cursor:pointer; text-align:center; padding:.4rem;
                 border:1px ${hay ? 'solid' : 'dashed'} ${hay ? 'var(--success)' : (pide ? 'var(--danger)' : 'var(--border)')};
                 background:${hay ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(var(--ink-rgb), 0.03)'};">
            <span style="font-size:1.3rem;">${cual === 'pdf' ? '📄' : '📷'}</span>
            <span style="font-size:var(--t-xs); color:var(--text-muted); word-break:break-word;">
              ${puesto ? 'Listo para subir' : (hay ? 'Ya tiene' : 'Tocar para elegir')}</span>
            <input type="file" data-adj="${cual}" accept="${cual === 'pdf' ? 'application/pdf' : 'image/*'}"
                   style="display:none;">
          </label>
        </div>`;
    };

    /* ── EL CANAL, Y POR QUÉ SE PUEDE CAMBIAR DESDE ACÁ ─────────────────────
       Normalmente se marca en el celular, al liquidar. Pero una guía marcada Retail por
       error desaparece de este módulo y solo reaparece en el otro: sin poder corregirla
       desde la web, la única salida sería buscar el teléfono del liquidador. Al tocar el
       otro canal se avisa que la guía se muda, porque eso es lo que pasa. */
    const canal = String(val('canal') || DES.canalDe(f)).toLowerCase();
    const botonCanal = (k) => `
        <button type="button" data-canal="${k}" style="border:1px solid ${canal === k ? 'var(--primary-2)' : 'var(--border)'};
          border-radius:9px; padding:.5rem .3rem; cursor:pointer; font-family:inherit; font-size:var(--t-sm);
          font-weight:700; background:${canal === k ? 'rgba(var(--primary2-rgb), 0.14)' : 'var(--panel)'};
          color:${canal === k ? 'var(--primary-2)' : 'var(--text-muted)'};">${esc(DES.CANALES[k].et)}</button>`;

    const botonEstado = (k) => `
        <button type="button" data-est="${k}" style="border:1px solid ${est === k ? (ESTADOS[k].color) : 'var(--border)'};
          border-radius:9px; padding:.5rem .3rem; cursor:pointer; font-family:inherit; font-size:var(--t-sm);
          font-weight:700; background:${est === k ? ESTADOS[k].fondo : 'var(--panel)'};
          color:${est === k ? ESTADOS[k].color : 'var(--text-muted)'};">${esc(ESTADOS[k].et)}</button>`;

    return `
    <div id="dc_velo" style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9000;
         display:flex; align-items:center; justify-content:center; padding:1rem;">
      <div style="background:var(--panel-solid); border:1px solid var(--border); border-radius:16px;
           max-width:580px; width:100%; max-height:88vh; overflow:auto;">
        <div style="padding:1rem 1.1rem; border-bottom:1px solid var(--border);
             background:${c.fondo || 'var(--panel)'};">
          <div style="font-size:var(--t-lg); font-weight:900; color:${c.color || 'var(--text-strong)'};">
            ${esc(f.rot || f.prom || 'Despacho')}</div>
          <div style="font-size:var(--t-xs); color:var(--text-soft); margin-top:2px;">
            ${esc(f.age || '')} → ${esc(f.dest || '')} · ${esc(f.ase || '')} · despacho ${esc(fechaBonita(f.desp))}</div>
        </div>
        <div style="padding:.9rem; display:flex; flex-direction:column; gap:.6rem;">

          ${caja('Lo que vino de comercial',
              dato('Líder', f.lider) + dato('Promotor', f.prom) + dato('Pedidos', f.ped, true) +
              dato('Cantidad', num(f.cant), true) + dato('Bolsas', num(f.bolsas), true) +
              dato('Cobro de flete', f.flete) + (f.obs ? dato('Observación', f.obs) : ''))}

          ${caja('A qué módulo va', `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:.4rem;">
              ${Object.keys(DES.CANALES).map(botonCanal).join('')}
            </div>
            <p style="margin:.5rem 0 0; font-size:var(--t-xs); color:var(--text-muted); line-height:1.5;">
              ${canal === CANAL
                ? 'Se queda en este módulo.'
                : 'Al guardar, esta guía <b>se muda</b> a ' + esc((CARA[canal] || CARA.catalogo).ttl)
                  + ' y deja de verse acá.'}</p>`)}

          ${caja('Cómo quedó', `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:.4rem;">
              ${Object.keys(ESTADOS).map(botonEstado).join('')}
            </div>
            <div style="margin-top:.5rem;">
              ${campoTexto('dc_entr', 'Fecha de entrega', val('entr'), 'date')}
              ${est === 'REPROGRAMAR' ? campoTexto('dc_repr', 'Nueva fecha', val('repr'), 'date') : ''}
              ${campoTexto('dc_inc', 'Incidencia', val('inc'))}
            </div>`)}

          ${caja('La prueba', `
            <div style="display:flex; gap:.5rem;">
              ${adj('foto', 'Foto', true)}${adj('foto2', 'Foto 2')}${adj('pdf', 'PDF')}
            </div>
            ${['foto', 'foto2', 'pdf'].filter((k) => f[k] === 'plataforma').length ? `
              <div style="display:flex; gap:.4rem; margin-top:.5rem; flex-wrap:wrap;">
                ${['foto', 'foto2', 'pdf'].filter((k) => f[k] === 'plataforma').map((k) => `
                  <button type="button" data-ver="${k}" style="background:var(--panel); border:1px solid var(--border);
                    border-radius:8px; padding:.35rem .7rem; color:var(--text-soft); font-size:var(--t-xs);
                    font-weight:700; cursor:pointer; font-family:inherit;">Ver ${k}</button>`).join('')}
              </div>` : ''}
            ${(f.foto && f.foto !== 'plataforma') ? `<p style="margin:.5rem 0 0; font-size:var(--t-xs);
               color:var(--text-muted); line-height:1.5; word-break:break-all;">
               La foto de este despacho sigue en el Drive del AppSheet
               (${esc(f.foto)}). Desde acá no se puede abrir.</p>` : ''}`)}

          ${caja('Lo que llena el liquidador', `
            ${campoTexto('dc_fact', 'Factura', val('fact'))}
            <label style="display:block; margin-bottom:.45rem;">
              <span style="display:block; font-size:var(--t-xs); color:var(--text-muted); margin-bottom:2px;">Facturado a</span>
              <select id="dc_factA" style="width:100%; background:var(--input-bg); border:1px solid var(--border);
                border-radius:8px; padding:.45rem .6rem; color:var(--text-main); font-size:var(--t-sm); font-family:inherit;">
                <option value="">—</option>
                ${['Consulting', 'Empresas Comerciales'].map((o) =>
                    `<option value="${o}" ${val('factA') === o ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </label>
            <div style="display:flex; gap:.5rem;">
              <div style="flex:1;">${campoTexto('dc_gasto', 'Gasto S/', val('gasto'), 'number')}</div>
              <div style="flex:1;">${campoTexto('dc_bulto', 'Bultos', val('bulto'), 'number')}</div>
            </div>`)}

          <div id="dc_msg" style="display:none; font-size:var(--t-sm); padding:.55rem .7rem; border-radius:9px;"></div>

          <button type="button" id="dc_guardar" style="background:var(--primary); border:0; border-radius:10px;
            padding:.7rem; color:var(--on-primary); font-size:var(--t-sm); font-weight:800; cursor:pointer;
            font-family:inherit;">${guardando ? 'Guardando…' : 'Guardar la liquidación'}</button>
          <button type="button" id="dc_cerrar" style="background:var(--panel); border:1px solid var(--border);
            border-radius:10px; padding:.6rem; color:var(--text-soft); font-size:var(--t-sm); font-weight:700;
            cursor:pointer; font-family:inherit;">Cerrar</button>
        </div>
      </div>
    </div>`;
};

/* ── EL EXCEL ─────────────────────────────────────────────────────────────────
   Sin librería: un CSV con BOM que Excel abre de una. Las 3.129 caben de sobra. */
const bajarExcel = (L) => {
    const cab = ['ID', 'Despacho', 'Entrega', 'Asesor', 'Lider', 'Promotor', 'Rotulo', 'Agencia',
                 'Destino', 'Pedido', 'Cantidad', 'Bolsas', 'CobroFlete', 'Observacion', 'Estado',
                 'Incidencia', 'Factura', 'FacturadoA', 'Gasto', 'Bultos', 'Declarado', 'Foto'];
    const campos = ['id', 'desp', 'entr', 'ase', 'lider', 'prom', 'rot', 'age', 'dest', 'ped',
                    'cant', 'bolsas', 'flete', 'obs', 'est', 'inc', 'fact', 'factA', 'gasto',
                    'bulto', 'decl', 'foto'];
    const limpio = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [cab.map(limpio).join(';')]
        .concat(L.map((f) => campos.map((c) => limpio(f[c])).join(';'))).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `Despacho ${CANAL === 'retail' ? 'Retail' : 'Catalogo'} ${hoyTexto()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/* ── VER UN ADJUNTO ───────────────────────────────────────────────────────────
   Los que se subieron desde acá viven en su propia área, en base64. Se traen solo
   cuando alguien los pide: son 50 KB cada uno y traerlos con la lista sería bajar
   varios MB para mirar una.

   Los que vienen del AppSheet siguen en el Drive y acá solo se ve su nombre: la
   plataforma no tiene acceso a esa carpeta. Se dice tal cual, sin prometer una foto
   que no se puede mostrar. */
const verAdjunto = async (id, cual) => {
    const a = await DES.traerAdjunto(id, cual);
    if (!a || !a.dato) { aviso('No se pudo traer el archivo.', true); return; }

    const capa = document.createElement('div');
    capa.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:9500;' +
        'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.8rem; padding:1rem;';
    const esPdf = String(a.tipo || '').indexOf('pdf') >= 0;
    capa.innerHTML = esPdf
        ? `<iframe src="${a.dato}" style="width:100%; max-width:820px; height:78vh; border:0;
             border-radius:10px; background:#fff;"></iframe>`
        : `<img src="${a.dato}" alt="${esc(a.nombre || cual)}"
             style="max-width:100%; max-height:78vh; border-radius:10px; object-fit:contain;">`;
    const pie = document.createElement('div');
    pie.style.cssText = 'display:flex; gap:.6rem; align-items:center;';
    pie.innerHTML = `<span style="color:rgba(255,255,255,.7); font-size:var(--t-sm);">${esc(a.nombre || cual)}</span>`;
    const bajar = document.createElement('a');
    bajar.href = a.dato; bajar.download = a.nombre || (cual + (esPdf ? '.pdf' : '.jpg'));
    bajar.textContent = 'Guardar';
    bajar.style.cssText = 'background:var(--primary); color:var(--on-primary); text-decoration:none;' +
        'padding:.45rem .9rem; border-radius:8px; font-size:var(--t-sm); font-weight:700;';
    const cerrar = document.createElement('button');
    cerrar.type = 'button'; cerrar.textContent = 'Cerrar';
    cerrar.style.cssText = 'background:rgba(255,255,255,.15); color:#fff; border:0; cursor:pointer;' +
        'padding:.45rem .9rem; border-radius:8px; font-size:var(--t-sm); font-weight:700; font-family:inherit;';
    pie.appendChild(bajar); pie.appendChild(cerrar);
    capa.appendChild(pie);
    cerrar.addEventListener('click', () => capa.remove());
    capa.addEventListener('click', (e) => { if (e.target === capa) capa.remove(); });
    document.body.appendChild(capa);
};

/* ── GUARDAR LA LIQUIDACIÓN ───────────────────────────────────────────────────
   Tres cosas, en este orden, y el orden importa:

     1. Los adjuntos, cada uno a su área. Si uno falla, no se guarda nada más: es
        peor un despacho marcado ATENDIDO sin su foto que uno sin marcar.
     2. Los cambios del formulario, al área de cambios.
     3. Recién ahí se toca lo que está en pantalla.

   NO SE REESCRIBE LA BASE: los cambios van a un área aparte. Lo hace el servicio. */
const aviso = (texto, malo) => {
    const d = raiz && raiz.querySelector('#dc_msg');
    if (!d) return;
    d.style.display = 'block';
    d.style.background = malo ? 'rgba(var(--danger-rgb), 0.12)' : 'rgba(var(--success-rgb), 0.12)';
    d.style.color = malo ? 'var(--danger-pale)' : 'var(--success)';
    d.textContent = texto;
};

const liquidar = async () => {
    if (guardando || !abierta) return;
    const f = DES.filaDe(abierta);
    if (!f) return;
    const b = borrador || {};

    const lee = (id) => {
        const e = raiz.querySelector(id);
        return e ? e.value.trim() : undefined;
    };
    const cambio = {};
    const poner = (k, v) => { if (v !== undefined && v !== null) cambio[k] = v; };
    poner('est', (b.est !== undefined ? b.est : f.est) || '');
    /* SIEMPRE VIAJA, aunque no se haya tocado: las 3.129 guías importadas no traen el
       campo y se asumen catálogo. Que lo asumido y lo guardado digan lo mismo cuesta
       doce caracteres, y evita que el día que algo filtre por canal de verdad las viejas
       queden fuera de los dos módulos. */
    poner('canal', String((b.canal !== undefined ? b.canal : DES.canalDe(f)) || 'catalogo').toLowerCase());
    poner('entr', lee('#dc_entr'));
    poner('repr', lee('#dc_repr'));
    poner('inc', lee('#dc_inc'));
    poner('fact', lee('#dc_fact'));
    poner('factA', lee('#dc_factA'));
    const g = lee('#dc_gasto'); if (g !== undefined) cambio.gasto = g === '' ? null : Number(g);
    const bu = lee('#dc_bulto'); if (bu !== undefined) cambio.bulto = bu === '' ? null : Number(bu);

    /* LA FOTO ES OBLIGATORIA PARA DAR POR ATENDIDO. Es la regla del AppSheet de hoy
       -el campo lleva asterisco- y es lo que hace que la liquidación valga: sin foto
       no hay con qué demostrar la entrega. La regla vive en el servicio, y la miran
       igual la web y el celular. */
    const adj = { foto: b._foto, foto2: b._foto2, pdf: b._pdf };
    if (DES.faltaLaFoto(f, adj, cambio.est)) {
        aviso('Para marcar ATENDIDO hace falta la foto. Es la prueba de la entrega.', true);
        return;
    }

    guardando = true;
    pintar();
    try {
        /* TODO EL GUARDADO ES DEL SERVICIO. Acá había una segunda copia, y desde que
           los datos se bajan por semanas ya no daba igual: además de subir la foto y
           los campos, hay que recontar cuántas guías quedan abiertas en esa semana,
           que es de donde saca la pestaña Por liquidar las viejas sin bajar todo el
           historial. Una copia que no recontara dejaría guías escondidas. */
        await DES.liquidar(f.id, cambio, adj, aviso);
        borrador = null;
        guardando = false;
        abierta = null;
        pintar();
    } catch (e) {
        guardando = false;
        pintar();
        aviso('No se pudo guardar: ' + ((e && e.message) || 'sin detalle') + '. Nada se perdió, vuelve a intentarlo.', true);
    }
};

/* ── DIBUJAR ──────────────────────────────────────────────────────────────────── */
/* Recien aca se escribe algo. Si falla, la ventana se queda con lo leido y el motivo:
   perder el archivo obligaria a ir a buscarlo otra vez. */
const guardarLaOrden = async () => {
    const c = carga;
    if (!c || c.guardando || !c.filas) return;
    if (!DES.esFecha(c.fecha)) { c.aviso = 'Falta la fecha de despacho.'; pintar(); return; }
    c.guardando = true; c.aviso = ''; pintar();
    try {
        const r = await ORD.guardarOrden(c.orden, c.filas, c.fecha,
            (t) => { c.aviso = t; pintar(); }, CANAL);
        carga = { estado: 'listo', orden: c.orden, fecha: c.fecha,
                  guardadas: r.guardadas, reusadas: r.reusadas };
        pintar();
    } catch (e) {
        c.guardando = false;
        c.aviso = 'No se pudo guardar: ' + ((e && e.message) || 'sin detalle')
                + '. Nada se perdi\u00f3, vuelve a intentarlo.';
        pintar();
    }
};

/* ══ CARGAR LA ORDEN DE DESPACHO ══════════════════════════════════════
   Lo mismo que en el celular y con la misma lectura, porque es el mismo archivo. Lo
   unico que cambia es el canal: cargar desde Tracking Retail marca las guias como
   retail, y desde Despacho de Catalogo como catalogo. La pantalla ya sabe cual es.

   Se ve lo que se leyo ANTES de guardar. Si algo no cuadra se cancela y no quedo ni
   media fila escrita. */
const ventanaDeCarga = () => {
    if (!carga) return '';
    const c = carga;
    const caja2 = (t, cuerpo) => `
      <div style="background:var(--panel); border:1px solid var(--border); border-radius:12px;
                  padding:.8rem .9rem; margin-bottom:.7rem;">
        <div style="font-size:var(--t-xs); font-weight:800; letter-spacing:.06em;
             text-transform:uppercase; color:var(--text-muted); margin-bottom:.45rem;">${esc(t)}</div>
        ${cuerpo}</div>`;
    const marco = (cuerpo) => `
      <div id="dc_velo_carga" style="position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:9200;
           display:flex; align-items:center; justify-content:center; padding:1rem;">
        <div style="background:var(--panel-solid); border:1px solid var(--border); border-radius:16px;
             max-width:560px; width:100%; max-height:88vh; overflow:auto; padding:1.1rem;">
          ${cuerpo}</div></div>`;

    if (c.estado === 'leyendo') {
        return marco(`<p style="margin:0; padding:1.4rem; text-align:center; color:var(--text-muted);
          font-size:var(--t-sm);">Leyendo el archivo…</p>`);
    }
    if (c.estado === 'malo') {
        return marco(`
          <h3 style="margin:0 0 .5rem; font-size:var(--t-lg); font-weight:900;
              color:var(--text-strong);">No se pudo leer</h3>
          <div style="background:rgba(var(--danger-rgb), 0.12); color:var(--danger-pale);
               border-radius:9px; padding:.7rem .8rem; font-size:var(--t-sm);">
            ${esc(c.motivo || 'El archivo no se pudo abrir.')}</div>
          <p style="font-size:var(--t-xs); color:var(--text-muted); line-height:1.6;">
            Tiene que ser el Excel de la orden de despacho, el que manda comercial.</p>
          <button type="button" data-dc-carga-cerrar style="background:var(--panel);
            border:1px solid var(--border); border-radius:9px; padding:.5rem 1rem;
            color:var(--text-soft); font-size:var(--t-sm); font-weight:700; cursor:pointer;
            font-family:inherit;">Cerrar</button>`);
    }
    if (c.estado === 'listo') {
        return marco(`
          <h3 style="margin:0 0 .5rem; font-size:var(--t-lg); font-weight:900; color:var(--success);">
            ${c.guardadas} guías cargadas</h3>
          <p style="margin:0 0 .8rem; font-size:var(--t-sm); color:var(--text-muted); line-height:1.6;">
            Orden <b>${esc(c.orden.od || '\u2014')}</b>, despacho del
            <b>${esc(fechaBonita(c.fecha))}</b>, en <b>PENDIENTE</b>.${
            c.reusadas ? ` De esas, ${c.reusadas} ya estaban y se actualizaron sin tocar lo liquidado.` : ''}</p>
          <button type="button" data-dc-carga-cerrar style="background:var(--primary);
            color:var(--on-primary); border:0; border-radius:9px; padding:.55rem 1.1rem;
            font-size:var(--t-sm); font-weight:800; cursor:pointer; font-family:inherit;">Ver</button>`);
    }

    const q = c.cuadre || {};
    const lista = c.filas.slice(0, 6).map((f) => `
      <div style="display:flex; gap:.6rem; padding:.4rem 0; border-bottom:1px solid var(--border);
                  font-size:var(--t-sm);">
        <div style="min-width:0; flex:1;">
          <div style="font-weight:700; color:var(--text-strong); white-space:nowrap;
               overflow:hidden; text-overflow:ellipsis;">${esc(f.rot || f.prom || '\u2014')}</div>
          <div style="font-size:var(--t-xs); color:var(--text-muted);">${esc(f.age || '')}
            \u2192 ${esc(f.dest || '')} \u00b7 ${esc(f.ase || '')}</div>
        </div>
        <div style="font-family:var(--font-num); color:var(--text-soft); flex-shrink:0;">
          ${num(f.cant || 0)}</div>
      </div>`).join('');

    return marco(`
      <h3 style="margin:0 0 .15rem; font-size:var(--t-lg); font-weight:900; color:var(--text-strong);">
        ${esc(c.orden.od || 'Orden de despacho')}</h3>
      <p style="margin:0 0 .8rem; font-size:var(--t-xs); color:var(--text-muted);">
        ${esc(c.orden.archivo || '')}${c.orden.creada ? ' \u00b7 creada el '
          + esc(fechaBonita(c.orden.creada)) : ''}</p>

      <div style="display:flex; gap:.6rem; margin-bottom:.7rem;">
        ${tarjeta(num(c.filas.length), 'gu\u00edas')}
        ${tarjeta(num(Math.round(q.pares || 0)), 'pares')}
        ${tarjeta(num(c.agencias), 'agencias')}
      </div>

      <div style="background:${q.ok ? 'rgba(var(--success-rgb), 0.12)' : 'rgba(var(--danger-rgb), 0.12)'};
           color:${q.ok ? 'var(--success)' : 'var(--danger-pale)'}; border-radius:9px;
           padding:.6rem .8rem; font-size:var(--t-sm); line-height:1.55; margin-bottom:.7rem;">
        ${q.ok
          ? `<b>Cuadra con el resumen del archivo.</b> ${num(Math.round(q.pares))} pares y
             ${soles(q.venta)}, igual que lo que dice el propio Excel.`
          : `<b>No cuadra con el resumen del archivo.</b> Le\u00ed ${num(Math.round(q.pares))}
             pares y el archivo dice ${num(q.dicePares)}. Mejor no cargarlo hasta saber por qu\u00e9.`}
      </div>

      ${q.premios ? `<p style="margin:0 0 .7rem; font-size:var(--t-xs); color:var(--text-muted);
        line-height:1.6;">El archivo dice <b>${num(q.dicePares + q.premios)} enviados</b> y las gu\u00edas
        suman <b>${num(q.dicePares)} pedidos</b>. Los ${num(q.premios)} de diferencia son premios, y el
        archivo no dice de qu\u00e9 gu\u00eda son: la cantidad de cada gu\u00eda queda en la pedida.</p>` : ''}

      ${c.repetida ? `<div style="background:rgba(var(--warning-rgb), 0.12); color:var(--warning);
        border-radius:9px; padding:.6rem .8rem; font-size:var(--t-sm); line-height:1.55;
        margin-bottom:.7rem;"><b>Esta orden ya est\u00e1 cargada</b>${c.repetida.cargada
        ? ' desde el ' + esc(fechaBonita(c.repetida.cargada)) : ''}. Si la vuelves a cargar se
        actualizan, no se duplican, y lo que ya se liquid\u00f3 no se toca.</div>` : ''}

      ${caja2('Fecha de despacho',
        /* UNA SOLA FECHA, no un rango. `selectorRango` mostraba "Desde 15/09 hasta
           15/09", que para un dia solo se lee como si faltara algo. */
        `<div class="rango-fechas" style="display:inline-flex; align-items:center; gap:9px;
           background:rgba(var(--ink-rgb), 0.04); border:1px solid var(--border);
           border-radius:9px; padding:5px 12px;">
           <span style="font-size:11px; color:var(--text-muted); font-weight:800;
             letter-spacing:.04em;">SALE EL</span>
           <input id="dc_cfecha" type="date" value="${esc(c.fecha)}" style="background:transparent;
             border:none; color:var(--text-strong); font-size:12.5px; font-weight:700;
             outline:none; cursor:pointer; font-family:inherit; color-scheme:var(--scheme);">
         </div>`
        + `<p style="margin:.5rem 0 0; font-size:var(--t-xs); color:var(--text-muted); line-height:1.5;">
           Es el d\u00eda que sale el cami\u00f3n, no el que comercial arm\u00f3 la orden${
           c.orden.creada ? ' (' + esc(fechaBonita(c.orden.creada)) + ')' : ''}. Entran en
           <b>${esc((CARA[CANAL] || CARA.catalogo).ttl)}</b>.</p>`)}

      ${caja2('Las primeras, para mirar', lista + (c.filas.length > 6
        ? `<p style="margin:.5rem 0 0; font-size:var(--t-xs); color:var(--text-muted);">y
           ${num(c.filas.length - 6)} m\u00e1s.</p>` : ''))}

      ${c.aviso ? `<div style="background:rgba(var(--ink-rgb), 0.06); border-radius:9px;
        padding:.5rem .8rem; font-size:var(--t-sm); color:var(--text-soft);
        margin-bottom:.6rem;">${esc(c.aviso)}</div>` : ''}

      <div style="display:flex; gap:.5rem;">
        <button type="button" data-dc-carga-guardar ${c.guardando ? 'disabled' : ''}
          style="flex:1; background:var(--primary); color:var(--on-primary); border:0;
          border-radius:9px; padding:.6rem 1rem; font-size:var(--t-sm); font-weight:800;
          cursor:pointer; font-family:inherit;">${c.guardando ? 'Guardando\u2026'
            : 'Cargar las ' + c.filas.length + ' gu\u00edas'}</button>
        <button type="button" data-dc-carga-cerrar style="background:var(--panel);
          border:1px solid var(--border); border-radius:9px; padding:.6rem 1.1rem;
          color:var(--text-soft); font-size:var(--t-sm); font-weight:700; cursor:pointer;
          font-family:inherit;">Cancelar</button>
      </div>
      <p style="margin:.6rem 0 0; font-size:var(--t-xs); color:var(--text-muted);">
        Nada se guarda hasta tocar el bot\u00f3n.</p>`);
};

const pintar = () => {
    if (!raiz) return;
    const L = visibles();
    const dia = hoyTexto();
    const hayHoy = FILAS.some((f) => delDia(f, dia));
    const ultimo = diaMostrado || FILAS.reduce((a, f) => (f.desp > a ? f.desp : a), '');

    raiz.innerHTML = `
    <div style="padding:1.1rem 1.2rem;">
      <div style="margin-bottom:.9rem;">
        <h2 style="margin:0; font-size:var(--t-xl); font-weight:900; color:var(--text-strong);
                   letter-spacing:-.01em;">${esc((CARA[CANAL] || CARA.catalogo).ttl)}</h2>
        <p style="margin:.15rem 0 0; font-size:var(--t-sm); color:var(--text-muted);">
          ${pestana === 'hoy'
            ? (hayHoy ? `Despachos de ${esc(fechaBonita(dia))}`
                      : `Todavía no hay despachos de hoy · se muestra el último día: ${esc(fechaBonita(ultimo))}`)
            : pestana === 'liquidar' ? 'Lo que falta cerrar'
            : `Del ${esc(fechaBonita(filtro.desde))} al ${esc(fechaBonita(filtro.hasta))}${
                FILAS.length ? ` · ${num(FILAS.length)} despachos` : ''}`}
        </p>
      </div>
      ${barra()}
      ${resumen(L)}
      ${tabla(deLaMarca(L))}
    </div>
    ${ficha()}${ventanaDeCarga()}`;

    /* Los toques */
    raiz.querySelectorAll('[data-pes]').forEach((b) => b.addEventListener('click', async () => {
        pestana = b.getAttribute('data-pes'); abierta = null; marca = ''; pintar();
        await cargar(); pintar();
    }));
    raiz.querySelectorAll('[data-rango]').forEach((b) => b.addEventListener('click', async () => {
        const r = RANGOS[Number(b.getAttribute('data-rango'))][1]();
        filtro.desde = r.desde; filtro.hasta = r.hasta; abierta = null; marca = ''; pintar();
        await cargar(); pintar();
    }));
    raiz.querySelectorAll('[data-fila]').forEach((tr) => tr.addEventListener('click', () => {
        abierta = tr.getAttribute('data-fila'); pintar();
    }));
    /* Los botones de estado: se guardan en el borrador y se repinta, sin perder lo
       que ya se escribió en los otros campos. */
    raiz.querySelectorAll('[data-canal]').forEach((b) => b.addEventListener('click', () => {
        borrador = borrador || {};
        ['dc_entr', 'dc_repr', 'dc_inc', 'dc_fact', 'dc_gasto', 'dc_bulto', 'dc_factA'].forEach((id) => {
            const e = raiz.querySelector('#' + id);
            if (e) borrador[id.slice(3)] = e.value;
        });
        borrador.canal = b.getAttribute('data-canal');
        pintar();
    }));

    raiz.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', () => {
        borrador = borrador || {};
        ['dc_entr', 'dc_repr', 'dc_inc', 'dc_fact', 'dc_gasto', 'dc_bulto', 'dc_factA'].forEach((id) => {
            const e = raiz.querySelector('#' + id);
            if (e) borrador[id.slice(3)] = e.value;
        });
        borrador.est = b.getAttribute('data-est');
        pintar();
    }));

    /* Los adjuntos. Se achican, se pasan a base64 y se quedan en el borrador hasta
       que se toque Guardar: así, si alguien cierra sin guardar, no queda una foto
       suelta en el servidor. */
    raiz.querySelectorAll('[data-adj]').forEach((inp) => inp.addEventListener('change', async () => {
        const cual = inp.getAttribute('data-adj');
        const arch = inp.files && inp.files[0];
        if (!arch) return;
        try {
            const chico = cual === 'pdf' ? arch : await achicarFoto(arch);
            if (chico.size > TOPE_MB * 1024 * 1024) {
                aviso('Ese archivo pesa ' + (chico.size / 1024 / 1024).toFixed(1) + ' MB y el tope son ' + TOPE_MB + ' MB.', true);
                return;
            }
            borrador = borrador || {};
            ['dc_entr', 'dc_repr', 'dc_inc', 'dc_fact', 'dc_gasto', 'dc_bulto', 'dc_factA'].forEach((id) => {
                const e = raiz.querySelector('#' + id);
                if (e) borrador[id.slice(3)] = e.value;
            });
            borrador['_' + cual] = {
                nombre: arch.name, tipo: chico.type || arch.type,
                dato: await aBase64(chico)
            };
            pintar();
            aviso('Ya está ' + (cual === 'pdf' ? 'el PDF' : 'la ' + cual) + '. Toca Guardar para subirlo.');
        } catch (e) {
            aviso('No se pudo leer el archivo: ' + ((e && e.message) || ''), true);
        }
    }));

    raiz.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
        verAdjunto(abierta, b.getAttribute('data-ver'));
    }));

    const bg = raiz.querySelector('#dc_guardar');
    if (bg) bg.addEventListener('click', liquidar);

    const cerrar = () => { abierta = null; borrador = null; pintar(); };
    const bc = raiz.querySelector('#dc_cerrar'); if (bc) bc.addEventListener('click', cerrar);
    const velo = raiz.querySelector('#dc_velo');
    if (velo) velo.addEventListener('click', (e) => { if (e.target === velo) cerrar(); });

    const txt = raiz.querySelector('#dc_txt');
    if (txt) {
        let reloj = null;
        txt.addEventListener('input', () => {
            clearTimeout(reloj);
            reloj = setTimeout(() => { filtro.texto = txt.value.trim(); pintar();
                const n = raiz.querySelector('#dc_txt'); if (n) { n.focus(); n.selectionStart = n.value.length; } }, 320);
        });
    }
    const liga = (id, campo) => {
        const s = raiz.querySelector(id);
        if (s) s.addEventListener('change', () => { filtro[campo] = s.value; pintar(); });
    };
    liga('#dc_age', 'agencia'); liga('#dc_ase', 'asesor'); liga('#dc_est', 'estado');
    /* Las fechas no son un filtro más: cambiarlas manda a buscar semanas al servidor. */
    const fecha = (id, campo) => {
        const e = raiz.querySelector(id);
        if (e) e.addEventListener('change', async () => {
            filtro[campo] = e.value;
            if (filtro.hasta < filtro.desde) filtro[campo === 'desde' ? 'hasta' : 'desde'] = e.value;
            pintar(); await cargar(); pintar();
        });
    };
    fecha('#dc_d1', 'desde'); fecha('#dc_d2', 'hasta');
    /* ── EL CARGADOR ── */
    const inpCarga = raiz.querySelector('[data-dc-cargar]');
    if (inpCarga) inpCarga.addEventListener('change', async () => {
        const arch = inpCarga.files && inpCarga.files[0];
        inpCarga.value = '';
        if (!arch) return;
        carga = { estado: 'leyendo' }; pintar();
        try {
            const r = await ORD.leerArchivo(arch);
            if (!r.ok) { carga = { estado: 'malo', motivo: r.motivo }; pintar(); return; }
            const idx = await DES.traerIndice(true);
            carga = {
                estado: 'mirando', orden: r.orden, filas: r.filas, cuadre: r.cuadre,
                fecha: hoyTexto(),
                agencias: new Set(r.filas.map((f) => String(f.age || '').toUpperCase())).size,
                repetida: ORD.yaCargada(idx, r.orden.od)
            };
        } catch (e) {
            carga = { estado: 'malo', motivo: (e && e.message) || 'no se pudo leer' };
        }
        pintar();
    });
    raiz.querySelectorAll('[data-dc-carga-cerrar]').forEach((b) => b.addEventListener('click', async () => {
        const habiaCargado = carga && carga.estado === 'listo';
        carga = null; pintar();
        if (habiaCargado) { await cargar(true); pintar(); }
    }));
    const bcg = raiz.querySelector('[data-dc-carga-guardar]');
    if (bcg) bcg.addEventListener('click', guardarLaOrden);
    const cf = raiz.querySelector('#dc_cfecha');
    if (cf) cf.addEventListener('change', () => { if (carga) { carga.fecha = cf.value; pintar(); } });

    const ex = raiz.querySelector('#dc_excel');
    if (ex) ex.addEventListener('click', () => bajarExcel(deLaMarca(visibles())));
    /* La tarjeta tocada filtra; volver a tocarla apaga el filtro. */
    raiz.querySelectorAll('[data-marca]').forEach((b) => b.addEventListener('click', () => {
        const q = b.getAttribute('data-marca');
        marca = (q === marca) ? '' : q;
        abierta = null; pintar();
    }));
};

/* ── LA PUERTA ────────────────────────────────────────────────────────────────── */
export const renderDespachoCatalogo = async (container, canal) => {
    const nuevo = (canal && CARA[canal]) ? canal : 'catalogo';
    /* AL CAMBIAR DE CANAL SE EMPIEZA DE CERO. Ver CARA arriba: el estado vive en el
       módulo y arrastrarlo entre Catálogo y Retail mostraría una lista vacía que
       parecería un error. */
    if (nuevo !== CANAL) {
        CANAL = nuevo;
        pestana = 'hoy'; abierta = null; borrador = null; FILAS = []; diaMostrado = '';
        const r = DES.rangoDeLaSemana();
        filtro = { canal: CANAL, agencia: '', asesor: '', estado: '', texto: '',
                   desde: r.desde, hasta: r.hasta };
    }
    raiz = container;
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; padding:3rem; color:var(--text-muted);">
        <div style="width:22px; height:22px; border:3px solid rgba(var(--primary2-rgb), 0.15);
             border-left-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
        <span style="font-size:var(--t-md);">Trayendo los despachos ${esc(CARA[CANAL].que)} de la semana…</span>
      </div>`;

    const i = await DES.traerIndice();
    await cargar();

    if (!i) {
        /* NO SE PUDO PREGUNTAR NO ES QUE NO HAYA NADA. Se dice cuál de las dos. */
        container.innerHTML = `
          <div style="padding:3rem 1.2rem; text-align:center;">
            <p style="margin:0 0 .4rem; font-size:var(--t-lg); font-weight:800; color:var(--text-strong);">
              No se pudo leer el despacho ${esc((CARA[CANAL] || CARA.catalogo).que)}</p>
            <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted); line-height:1.6;">
              Esto <b>no</b> quiere decir que no haya datos: no se pudo preguntar.
              ${esc(DES.ultimoProblema() || '')}<br>Puede que el servidor esté reiniciando;
              vuelve a entrar en un minuto.</p>
          </div>`;
        return;
    }
    /* OJO: acá se mira si el ÁREA está vacía, no si este canal lo está. Retail empieza
       en cero y va a estarlo por un tiempo; taparle la pantalla con un cartel le
       quitaría las pestañas y el selector de fechas. Que esté vacío lo dice la tabla,
       abajo, donde no estorba. */
    if (!i.total) {
        container.innerHTML = `
          <div style="padding:3rem 1.2rem; text-align:center;">
            <p style="margin:0 0 .4rem; font-size:var(--t-lg); font-weight:800; color:var(--text-strong);">
              Todavía no hay despachos ${esc((CARA[CANAL] || CARA.catalogo).que)}</p>
            <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted);">
              El área existe pero llegó vacía.</p>
          </div>`;
        return;
    }
    pintar();
};
