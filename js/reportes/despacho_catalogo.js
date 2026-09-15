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

import { traerAreaPublicada } from '../services_v245/csvHub_v6.js?v=29.0774';

const AREA = 'despacho_catalogo';

/* ── DONDE SE GUARDA LO QUE SE LIQUIDA DESDE ACA ──────────────────────────────
   NO se reescribe `despacho_catalogo`. Son 3.129 filas y un megabyte: mandarlo
   entero cada vez que alguien liquida uno es lento y, el dia que dos personas
   liquiden a la vez, el segundo pisa al primero.

   En vez de eso, los cambios van a un area aparte, chica, con UNA entrada por id.
   Al leer se superponen a la base. La base importada queda intacta, que ademas es
   lo que hace seguro seguir con el AppSheet en paralelo: si algo sale mal, se
   vuelve a importar y no se perdio nada. */
const AREA_CAMBIOS = 'despacho_catalogo_cambios';

/* Los adjuntos van uno por area -`despacho_adj_<id>`- con el archivo en base64.
   Es el mismo camino que usa el chat, y por el mismo motivo: `/api/archivos` esta
   hecho para el robot y BORRA el anterior del mismo tipo, que aca seria perder la
   foto de una liquidacion al subir la de la siguiente. */
const AREA_ADJ = (id, cual) => 'despacho_adj_' + String(id) + '_' + cual;

const API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics';

const guardarArea = async (area, datos) => {
    const r = await fetch(API + '/' + area + '?date=MASTER', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (!r.ok) throw new Error('el servidor contestó ' + r.status);
    return true;
};

/* LAS FOTOS SE ACHICAN EN EL NAVEGADOR, pero MENOS QUE EN EL CHAT.
   El chat usa 1600 px y JPEG 0,72, que para una conversacion sobra. Aca no:

     Daniel, 15-sep-2026: *"las fotos que no bajen mucho la calidad, no se va a
     apreciar, y eso lo tiene que ver el area comercial tambien para que ellos lo
     metan a contabilidad y finanzas"*.

   Lo que se fotografia es la FACTURA junto con la guia de la agencia. Si el numero
   de factura o el monto no se leen, la foto no sirve para lo unico que tiene que
   servir. Por eso 2200 px y calidad 0,88: una foto de celular de 4 MB queda en unos
   700 KB -el triple que en el chat- y los numeros se leen. */
const LADO_MAXIMO = 2200;
const CALIDAD = 0.88;
const TOPE_MB = 6;

const achicarFoto = (archivo) => new Promise((listo) => {
    const mime = String(archivo.type || '');
    if (mime.indexOf('image/') !== 0 || mime.indexOf('gif') >= 0) { listo(archivo); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
        const e = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        if (e >= 1 && archivo.size < 900 * 1024) { URL.revokeObjectURL(url); listo(archivo); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); listo(b || archivo); }, 'image/jpeg', CALIDAD);
    };
    img.onerror = () => { URL.revokeObjectURL(url); listo(archivo); };
    img.src = url;
});

const aBase64 = (blob) => new Promise((listo, falla) => {
    const l = new FileReader();
    l.onload = () => listo(String(l.result));
    l.onerror = () => falla(new Error('no se pudo leer el archivo'));
    l.readAsDataURL(blob);
});

/* Los estados que usa el AppSheet. Los dos primeros son los únicos que aparecen en las
   3.129 filas de hoy; PENDIENTE y REPROGRAMAR existen en el formulario pero no quedan
   registrados, porque hoy se carga y se liquida casi seguido. */
const ESTADOS = {
    'ATENDIDO':    { et: 'Atendido',    color: 'var(--success)', fondo: 'rgba(var(--success-rgb), 0.12)' },
    'NO ATENDIDO': { et: 'No atendido', color: 'var(--danger)',  fondo: 'rgba(var(--danger-rgb), 0.12)' },
    'PENDIENTE':   { et: 'Pendiente',   color: 'var(--warning)', fondo: 'rgba(var(--warning-rgb), 0.12)' },
    'REPROGRAMAR': { et: 'Reprogramar', color: 'var(--warning)', fondo: 'rgba(var(--warning-rgb), 0.12)' }
};
const PENDIENTES = ['PENDIENTE', 'REPROGRAMAR', ''];

const esc = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('es-PE');
const soles = (n) => (n === null || n === undefined || n === '') ? '—'
    : 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── LA FECHA, SIN toISOString ────────────────────────────────────────────────
   Devuelve UTC y en Lima adelanta el día a las 19:00, justo cuando entra el turno
   noche. Es la trampa número uno de este proyecto. */
const hoyTexto = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const fechaBonita = (f) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f || ''))) return f || '—';
    const [a, m, d] = f.split('-').map(Number);
    const x = new Date(a, m - 1, d);
    return `${DIAS[x.getDay()]} ${d} de ${MESES[m - 1]}`;
};
const fechaCorta = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) ? f.slice(8, 10) + '/' + f.slice(5, 7) : (f || '—');

/* ── EL PAQUETE COMPACTO, REARMADO ───────────────────────────────────────────── */
let PAQUETE = null;
let FILAS = [];
let CAMBIOS = {};
let borrador = null;
let guardando = false;

const abrir = (p) => {
    if (!p || !Array.isArray(p.filas)) return [];
    const cat = p.cat || {};
    const patron = p.fotoPatron || 'STATUS_Images/{id}.FOTO.{foto}';
    return p.filas.map((f) => {
        const g = {};
        Object.keys(f).forEach((k) => {
            g[k] = (cat[k] && typeof f[k] === 'number') ? (cat[k][f[k]] || '') : f[k];
        });
        if (f.foto !== undefined && f.fotoX === undefined) {
            g.foto = patron.replace('{id}', f.id).replace('{foto}', f.foto);
        } else if (f.fotoX !== undefined) {
            g.foto = f.fotoX;
        }
        return g;
    });
};

/* ── EL ESTADO DE LA PANTALLA ────────────────────────────────────────────────── */
let pestana = 'hoy';
let filtro = { canal: 'catalogo', agencia: '', asesor: '', estado: '', texto: '', desde: '', hasta: '' };
let abierta = null;          /* el id de la fila abierta en la ficha */
let raiz = null;

const pendiente = (f) => PENDIENTES.indexOf(String(f.est || '').toUpperCase()) >= 0;

const delDia = (f, dia) => String(f.desp || '') === dia;

const visibles = () => {
    const dia = hoyTexto();
    let L = FILAS;
    if (pestana === 'hoy') {
        L = L.filter((f) => delDia(f, dia));
        /* SI HOY NO HAY NADA, SE MUESTRA EL ÚLTIMO DÍA CON DESPACHOS.
           Los datos importados llegan hasta el 14-sep: una pantalla en blanco haría
           pensar que está rota cuando lo que pasa es que aún no cargaron el día. */
        if (!L.length && FILAS.length) {
            const ultimo = FILAS.reduce((a, f) => (f.desp > a ? f.desp : a), '');
            L = FILAS.filter((f) => delDia(f, ultimo));
        }
    } else if (pestana === 'liquidar') {
        L = L.filter(pendiente);
    } else {
        if (filtro.desde) L = L.filter((f) => String(f.desp || '') >= filtro.desde);
        if (filtro.hasta) L = L.filter((f) => String(f.desp || '') <= filtro.hasta);
    }
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

const tarjeta = (n, rotulo, color) => `
    <div style="flex:1; min-width:96px; background:var(--panel); border:1px solid var(--border);
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
    const pes = [
        ['hoy', 'Hoy', FILAS.filter((f) => delDia(f, hoyTexto())).length],
        ['liquidar', 'Por liquidar', FILAS.filter(pendiente).length],
        ['historial', 'Historial', FILAS.length]
    ];
    return `
    <div style="display:flex; gap:.4rem; border-bottom:1px solid var(--border); margin-bottom:1rem; flex-wrap:wrap;">
      ${pes.map(([id, et, n]) => `
        <button type="button" data-pes="${id}" style="background:none; border:0; cursor:pointer;
            padding:.55rem .9rem; font-size:var(--t-sm); font-weight:800; font-family:inherit;
            color:${pestana === id ? 'var(--primary-2)' : 'var(--text-muted)'};
            border-bottom:2px solid ${pestana === id ? 'var(--primary-2)' : 'transparent'};">
          ${esc(et)} <span style="font-family:var(--font-num); font-weight:400; opacity:.75;">${num(n)}</span>
        </button>`).join('')}
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
      ${pestana === 'historial' ? `
      <input id="dc_d1" type="date" value="${esc(filtro.desde)}" title="Desde"
        style="background:var(--input-bg); border:1px solid var(--border); border-radius:9px; padding:.45rem .5rem;
               color:var(--text-main); font-size:var(--t-sm); color-scheme:var(--scheme);">
      <input id="dc_d2" type="date" value="${esc(filtro.hasta)}" title="Hasta"
        style="background:var(--input-bg); border:1px solid var(--border); border-radius:9px; padding:.45rem .5rem;
               color:var(--text-main); font-size:var(--t-sm); color-scheme:var(--scheme);">` : ''}
      <button type="button" id="dc_excel" style="background:var(--panel); border:1px solid var(--border);
        border-radius:9px; padding:.5rem .8rem; color:var(--text-soft); font-size:var(--t-sm);
        font-weight:700; cursor:pointer; font-family:inherit;">Excel (${num(L.length)})</button>
    </div>`;
};

const resumen = (L) => {
    const at = L.filter((f) => String(f.est).toUpperCase() === 'ATENDIDO').length;
    const no = L.filter((f) => String(f.est).toUpperCase() === 'NO ATENDIDO').length;
    const pen = L.filter(pendiente).length;
    const inc = L.filter((f) => f.inc).length;
    const gasto = L.reduce((a, f) => a + (Number(f.gasto) || 0), 0);
    return `
    <div style="display:flex; gap:.6rem; flex-wrap:wrap; margin-bottom:1rem;">
      ${tarjeta(num(L.length), 'despachos')}
      ${tarjeta(num(at), 'atendidos', 'var(--success)')}
      ${pen ? tarjeta(num(pen), 'por liquidar', 'var(--warning)') : ''}
      ${tarjeta(num(no), 'no atendidos', no ? 'var(--danger)' : null)}
      ${tarjeta(num(inc), 'con incidencia', inc ? 'var(--warning)' : null)}
      ${tarjeta(soles(gasto).replace('S/ ', ''), 'gasto S/')}
    </div>`;
};

const tabla = (L) => {
    if (!L.length) {
        return `<div style="padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:var(--t-sm);">
            No hay despachos con estos filtros.</div>`;
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
    const f = FILAS.find((x) => String(x.id) === String(abierta));
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
    a.download = `Despacho Catalogo ${hoyTexto()}.csv`;
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
const adjuntosVistos = {};

const verAdjunto = async (id, cual) => {
    const clave = id + '_' + cual;
    if (!adjuntosVistos[clave]) {
        adjuntosVistos[clave] = await traerAreaPublicada(AREA_ADJ(id, cual));
    }
    const a = adjuntosVistos[clave];
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

   NO SE REESCRIBE LA BASE. Ver AREA_CAMBIOS arriba. */
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
    const f = FILAS.find((x) => String(x.id) === String(abierta));
    if (!f) return;
    const b = borrador || {};

    const lee = (id) => {
        const e = raiz.querySelector(id);
        return e ? e.value.trim() : undefined;
    };
    const cambio = {};
    const poner = (k, v) => { if (v !== undefined && v !== null) cambio[k] = v; };
    poner('est', (b.est !== undefined ? b.est : f.est) || '');
    poner('entr', lee('#dc_entr'));
    poner('repr', lee('#dc_repr'));
    poner('inc', lee('#dc_inc'));
    poner('fact', lee('#dc_fact'));
    poner('factA', lee('#dc_factA'));
    const g = lee('#dc_gasto'); if (g !== undefined) cambio.gasto = g === '' ? null : Number(g);
    const bu = lee('#dc_bulto'); if (bu !== undefined) cambio.bulto = bu === '' ? null : Number(bu);

    /* LA FOTO ES OBLIGATORIA PARA DAR POR ATENDIDO. Es la regla del AppSheet de hoy
       -el campo lleva asterisco- y es lo que hace que la liquidación valga: sin foto
       no hay con qué demostrar la entrega. */
    const tieneFoto = b._foto || f.foto;
    if (String(cambio.est).toUpperCase() === 'ATENDIDO' && !tieneFoto) {
        aviso('Para marcar ATENDIDO hace falta la foto. Es la prueba de la entrega.', true);
        return;
    }

    guardando = true;
    pintar();
    try {
        for (const cual of ['foto', 'foto2', 'pdf']) {
            const dato = b['_' + cual];
            if (!dato) continue;
            aviso('Subiendo ' + cual + '…');
            await guardarArea(AREA_ADJ(f.id, cual), {
                id: String(f.id), cual: cual, tipo: dato.tipo,
                nombre: dato.nombre, dato: dato.dato,
                cuando: hoyTexto()
            });
            cambio[cual] = 'plataforma';      // marca de que vive acá, no en el Drive
            /* SE OLVIDA LA COPIA GUARDADA. El visor se queda con el archivo en memoria
               para no volver a pedirlo, y sin esto, después de subir una foto nueva
               seguía mostrando la anterior. Lo cazó la prueba de subir dos seguidas. */
            delete adjuntosVistos[f.id + '_' + cual];
        }

        cambio.liquidadoEl = hoyTexto();
        const porId = Object.assign({}, (CAMBIOS && CAMBIOS.porId) || {});
        porId[String(f.id)] = Object.assign({}, porId[String(f.id)] || {}, cambio);
        await guardarArea(AREA_CAMBIOS, { porId: porId });
        CAMBIOS = { porId: porId };

        Object.keys(cambio).forEach((k) => { f[k] = cambio[k]; });
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
const pintar = () => {
    if (!raiz) return;
    const L = visibles();
    const dia = hoyTexto();
    const hayHoy = FILAS.some((f) => delDia(f, dia));
    const ultimo = FILAS.reduce((a, f) => (f.desp > a ? f.desp : a), '');

    raiz.innerHTML = `
    <div style="padding:1.1rem 1.2rem;">
      <div style="margin-bottom:.9rem;">
        <h2 style="margin:0; font-size:var(--t-xl); font-weight:900; color:var(--text-strong);
                   letter-spacing:-.01em;">Despacho de Catálogo</h2>
        <p style="margin:.15rem 0 0; font-size:var(--t-sm); color:var(--text-muted);">
          ${pestana === 'hoy'
            ? (hayHoy ? `Despachos de ${esc(fechaBonita(dia))}`
                      : `Todavía no hay despachos de hoy · se muestra el último día: ${esc(fechaBonita(ultimo))}`)
            : pestana === 'liquidar' ? 'Lo que falta cerrar'
            : `${num(FILAS.length)} despachos importados del AppSheet`}
        </p>
      </div>
      ${barra()}
      ${resumen(L)}
      ${tabla(L)}
    </div>
    ${ficha()}`;

    /* Los toques */
    raiz.querySelectorAll('[data-pes]').forEach((b) => b.addEventListener('click', () => {
        pestana = b.getAttribute('data-pes'); abierta = null; pintar();
    }));
    raiz.querySelectorAll('[data-fila]').forEach((tr) => tr.addEventListener('click', () => {
        abierta = tr.getAttribute('data-fila'); pintar();
    }));
    /* Los botones de estado: se guardan en el borrador y se repinta, sin perder lo
       que ya se escribió en los otros campos. */
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
            aviso(cual + ' listo: ' + Math.round(chico.size / 1024) + ' KB. Toca Guardar para subirlo.');
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
    liga('#dc_d1', 'desde'); liga('#dc_d2', 'hasta');
    const ex = raiz.querySelector('#dc_excel');
    if (ex) ex.addEventListener('click', () => bajarExcel(visibles()));
};

/* ── LA PUERTA ────────────────────────────────────────────────────────────────── */
export const renderDespachoCatalogo = async (container) => {
    raiz = container;
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; padding:3rem; color:var(--text-muted);">
        <div style="width:22px; height:22px; border:3px solid rgba(var(--primary2-rgb), 0.15);
             border-left-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
        <span style="font-size:var(--t-md);">Trayendo los despachos de catálogo…</span>
      </div>`;

    if (!PAQUETE) {
        PAQUETE = await traerAreaPublicada(AREA);
        FILAS = abrir(PAQUETE);
        /* LO LIQUIDADO DESDE LA PLATAFORMA SE SUPERPONE A LA BASE. La base es lo que
           se importo del AppSheet; esto es lo que se hizo despues, y manda. */
        CAMBIOS = (await traerAreaPublicada(AREA_CAMBIOS)) || {};
        const porId = CAMBIOS.porId || {};
        FILAS.forEach((f) => {
            const c = porId[String(f.id)];
            if (c) Object.keys(c).forEach((k) => { f[k] = c[k]; });
        });
    }

    if (!FILAS.length) {
        /* NO SE PUDO PREGUNTAR NO ES QUE NO HAYA NADA. Se dice cuál de las dos. */
        container.innerHTML = `
          <div style="padding:3rem 1.2rem; text-align:center;">
            <p style="margin:0 0 .4rem; font-size:var(--t-lg); font-weight:800; color:var(--text-strong);">
              Todavía no hay despachos de catálogo</p>
            <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted); line-height:1.6;">
              ${PAQUETE ? 'El área existe pero llegó vacía.'
                        : 'No se pudo leer el área <b>despacho_catalogo</b>. Esto no quiere decir que no haya datos: puede ser que el servidor esté reiniciando. Vuelve a entrar en un minuto.'}
            </p>
          </div>`;
        return;
    }
    pintar();
};
