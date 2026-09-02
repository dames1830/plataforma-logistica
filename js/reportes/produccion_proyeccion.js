/**
 * PICKING → PRODUCCIÓN PICKING EMBALAJE
 *
 * Cuánto se pica y cuánto se embala POR SEMANA, cuánto sube cada semana y cuánto
 * se proyecta. Abierto en calzado y no calzado, que se miran por separado.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ POR QUÉ VA EN PARES Y POR SEMANA. Esta pantalla se hizo mal dos veces    ║
 * ║ seguidas y las dos las corrigió Daniel.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * PRIMER INTENTO: pares por día, calzado y no calzado SUMADOS. Decía que del 24
 * al 28 de agosto el CD había triplicado la producción —de 40.000 pares diarios a
 * 124.000— y era mentira: el calzado no se movió y todo el salto estaba en no
 * calzado, donde la unidad del WMS no es un par sino una bolsa o una caja de
 * accesorio.
 *
 * SEGUNDO INTENTO: medirlo todo en LÍNEAS, que sí salen planas. Daniel,
 * 02-sep-2026: *"¿por qué me estás calculando líneas? Yo para qué quiero
 * calcular líneas... yo no veo nada en línea, yo veo pares"*. Y tiene razón: la
 * línea sirve para medir esfuerzo, pero él reporta VOLUMEN, y el volumen del CD
 * se cuenta en pares.
 *
 * EL ARREGLO NO ERA CAMBIAR DE UNIDAD, ERA NO MEZCLARLAS. Cada categoría con su
 * cuadro y su unidad: el calzado en pares, el no calzado en unidades. Así el
 * número no miente y sigue siendo el que él usa para reportar.
 *
 * POR SEMANA Y NO POR DÍA porque es como Daniel mira el CD: *"me lo das por
 * semana... en la semana treinta, cuánto subió el picking o cuánto se estima
 * subir"*. De un día al siguiente manda el tamaño del pedido; la semana ya deja
 * ver el ritmo.
 *
 * ESTE CUADRO COPIA A ALMACENAJE → PRODUCTIVIDAD, que él mismo señaló como
 * referencia: las mismas cinco cajas —cierre de la última semana, cierre de la
 * anterior, últimas cuatro, promedio general y cuánto sube por semana—, el mismo
 * gráfico semanal con su recta punteada, y la semana en curso aparte. La cuenta
 * de la semana ISO es la misma, así que la S35 de acá es la S35 de allá.
 *
 * LA SEMANA EN CURSO NO ENTRA EN NADA, Y TAMPOCO SE DIBUJA. Está a medio hacer,
 * y acá el eje es un TOTAL de la semana, no una velocidad: una semana con un día
 * siempre va a valer la sexta parte, así que dibujarla es un despeñadero al final
 * del gráfico que no dice nada —y en un cuadro que se mira de reojo, se lee como
 * que la producción se cayó—. Se cuenta con palabras debajo del gráfico.
 *
 * (En Almacenaje → Productividad sí se dibuja, y está bien: ahí el eje son
 * unidades POR HORA, y una semana a medias ya da un número comparable.)
 *
 * LAS SEMANAS CORTAS TAMPOCO. Una semana con dos días de datos —porque el robot
 * no corrió, o porque el histórico arranca ahí— no es una semana mala: es una
 * semana incompleta. Se muestran marcadas y con sus días a la vista, pero fuera
 * de la cuenta.
 *
 * ESTE ARCHIVO NO LEE DEL SERVIDOR. Recibe `OPC.picking` y `OPC.embalaje` —los
 * días ya bajados de las áreas `picking_por_hora` y `embalaje_por_hora`— y solo
 * calcula y dibuja.
 *
 * Los metros que camina el picker quedan para después, los dejó fuera él mismo.
 *
 * OPC = {
 *   picking:  [{fecha, datos}] de `picking_por_hora`
 *   embalaje: [{fecha, datos}] de `embalaje_por_hora`
 *   desde, hasta: el rango elegido, 'AAAA-MM-DD'
 *   alCambiarRango: (desde, hasta) => {}
 * }
 */

import { resolverColoresChart } from '../services_v245/temaService.js?v=29.0557';
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0557';

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/* LA FECHA SE PARTE A MANO, NO CON `new Date(iso)`. Un 'AAAA-MM-DD' suelto se
   interpreta como UTC y en Lima retrocede al día anterior. Misma trampa que
   `toISOString()`, al revés. */
const partir = (f) => {
    const p = String(f || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
};
const corta = (f) => {
    const d = partir(f);
    return d.getDate() + ' ' + MESES[d.getMonth()];
};

/* SEMANA ISO: el jueves decide a qué semana pertenece un día. Es la misma cuenta
   que usa Almacenaje → Productividad, para que la semana 35 sea la misma en las
   dos pantallas. */
const semanaDe = (f) => {
    const d = partir(f);
    if (isNaN(d)) return null;
    const jue = new Date(d);
    jue.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const ene4 = new Date(jue.getFullYear(), 0, 4);
    const n = 1 + Math.round(((jue - ene4) / 86400000 - 3 + ((ene4.getDay() + 6) % 7)) / 7);
    return { anio: jue.getFullYear(), sem: n,
             clave: jue.getFullYear() + '-' + String(n).padStart(2, '0') };
};

const lunesDe = (anio, sem) => {
    const ene4 = new Date(anio, 0, 4);
    const lun = new Date(ene4);
    lun.setDate(ene4.getDate() - ((ene4.getDay() + 6) % 7) + (sem - 1) * 7);
    return lun;
};

/* ══════════════════════════════════════════════════════════════════════════
   LAS CUATRO SERIES QUE SE MIRAN
   ══════════════════════════════════════════════════════════════════════════ */

/* El calzado son las dos formas juntas —suelto y prepack—: las dos son pares de
   zapatos y Daniel las reporta juntas. El desglose se sigue viendo en el pie de
   la primera caja, porque se trabajan distinto.

   El no calzado va aparte Y CON SU PROPIA UNIDAD. Ahí el WMS no cuenta pares:
   cuenta bolsas, medias y cajas de accesorio. Sumarlo con el calzado fue el error
   de la primera versión de esta pantalla. */
const SERIES = [
    { id: 'pick_cal',   lado: 'p', cat: 'cal',   titulo: 'PICKING · CALZADO',
      color: '#2563eb', unidad: 'pares' },
    { id: 'pick_nocal', lado: 'p', cat: 'nocal', titulo: 'PICKING · NO CALZADO',
      color: '#d97706', unidad: 'unidades' },
    { id: 'emb_cal',    lado: 'e', cat: 'cal',   titulo: 'EMBALAJE · CALZADO',
      color: '#16a34a', unidad: 'pares' },
    { id: 'emb_nocal',  lado: 'e', cat: 'nocal', titulo: 'EMBALAJE · NO CALZADO',
      color: '#9333ea', unidad: 'unidades' },
];

/** Un día de un lado, reducido a lo que hace falta. */
const resumirDia = (entrada) => {
    const d = (entrada && entrada.datos) || {};
    const t = ((d.vistas && d.vistas.TODOS) || {}).totales || {};
    const suelto = Number(t.cal_suelto) || 0;
    const prepack = Number(t.cal_prepack) || 0;
    return {
        fecha: entrada.fecha,
        cal: suelto + prepack,
        suelto: suelto,
        prepack: prepack,
        nocal: Number(t.no_cal) || 0,
    };
};

/* MÍNIMOS CUADRADOS sobre los puntos que se le pasen. Devuelve cuánto sube por
   paso —acá, por semana— y dónde arranca la recta. */
const recta = (ys) => {
    const n = ys.length;
    if (n < 2) return { m: 0, b: n ? ys[0] : 0 };
    const mx = (n - 1) / 2;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) * (i - mx); });
    const m = den ? num / den : 0;
    return { m: m, b: my - m * mx };
};

const promedio = (v) => v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;

/* ══════════════════════════════════════════════════════════════════════════
   EL DIBUJO
   ══════════════════════════════════════════════════════════════════════════ */

const CSS = [
'#pp .pp-caja { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:18px; }',
'#pp .pp-cab { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }',
'#pp .pp-cab > .pp-quien { flex:1 1 280px; min-width:0; }',
'#pp .pp-cab h2 { margin:0 0 5px; font-size:var(--t-xl); font-weight:800; color:var(--text-strong); text-wrap:balance; }',
'#pp .pp-cab .pp-cuantos { font-size:var(--t-xs); color:var(--text-muted); }',
'#pp .pp-cab .rango-fechas { flex:0 0 auto; }',
'#pp .pp-titulo { font-size:var(--t-sm); font-weight:900; letter-spacing:0.06em; margin:0 0 3px; }',
'#pp .pp-sub { font-size:var(--t-xs); color:var(--text-muted); margin:0 0 14px; line-height:1.65; }',
'#pp .pp-cajas { display:grid; grid-template-columns:repeat(auto-fit, minmax(148px, 1fr)); gap:12px; margin-bottom:16px; }',
'#pp .pp-c { background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.08); border-radius:10px; padding:0.85rem 1rem; }',
'#pp .pp-c .r { font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.45); }',
'#pp .pp-c .v { font-size:var(--t-2xl); font-weight:900; color:var(--text-strong); line-height:1.15; font-variant-numeric:tabular-nums; }',
'#pp .pp-c .p { font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35); line-height:1.45; }',
'#pp .pp-graf { position:relative; height:260px; width:0; min-width:100%; }',
'#pp .pp-scroll { overflow-x:auto; width:0; min-width:100%; }',
'#pp table.pp-tabla { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#pp table.pp-tabla th { text-align:right; padding:9px 10px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid var(--border); white-space:nowrap; font-size:10.5px; }',
'#pp table.pp-tabla th.pp-grupo { text-align:center; border-bottom:1px solid var(--border); padding-bottom:5px; }',
'#pp table.pp-tabla th:first-child, #pp table.pp-tabla td:first-child { text-align:left; }',
'#pp table.pp-tabla td { padding:8px 10px; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb), 0.06); white-space:nowrap; }',
'#pp table.pp-tabla td.pp-sep, #pp table.pp-tabla th.pp-sep { border-left:1px solid var(--border); }',
'#pp table.pp-tabla tr.pp-parcial td { color:var(--text-muted); font-style:italic; }',
'#pp table.pp-tabla tfoot td { font-weight:800; color:var(--text-strong); border-top:2px solid var(--border); border-bottom:none; padding-top:11px; }',
'#pp .pp-nota { font-size:var(--t-xs); color:var(--text-muted); line-height:1.65; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }',
'#pp .pp-vacio { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:var(--t-sm); line-height:1.7; }',
'#pp, #pp .pp-caja { max-width:100%; min-width:0; }',
].join('\n');

let _graficos = [];
const soltarGraficos = () => {
    _graficos.forEach(g => { try { g.destroy(); } catch (e) { /* ya estaba muerto */ } });
    _graficos = [];
};

export function montarProduccionProyeccion(cont, OPC) {
    if (!cont) return;
    soltarGraficos();

    const O = OPC || {};
    const dias = { p: {}, e: {} };
    (O.picking || []).forEach(x => { const d = resumirDia(x); dias.p[d.fecha] = d; });
    (O.embalaje || []).forEach(x => { const d = resumirDia(x); dias.e[d.fecha] = d; });

    const fechas = Array.from(new Set(
        Object.keys(dias.p).concat(Object.keys(dias.e)))).sort();

    if (!fechas.length) {
        cont.innerHTML = '<style>' + CSS + '</style><div id="pp"><div class="pp-vacio">'
            + 'No hay días guardados en este rango.<br>'
            + 'Los publica el robot del servidor todas las noches, en Picking por día y Embalaje por día.'
            + '</div></div>';
        return;
    }

    /* ─── SE AGRUPA POR SEMANA ─────────────────────────────────────────────
       Un día cuenta para la semana solo si ESE LADO tuvo movimiento: si el robot
       del picking no corrió un sábado, esa semana tiene cinco días de picking y
       seis de embalaje. Hay que saberlo para no leer un bajón donde lo único que
       falta es un archivo. */
    const semanas = {};
    fechas.forEach(f => {
        const s = semanaDe(f);
        if (!s) return;
        const w = semanas[s.clave] || (semanas[s.clave] = {
            clave: s.clave, sem: s.sem, anio: s.anio, lunes: lunesDe(s.anio, s.sem),
            p: { cal: 0, nocal: 0, suelto: 0, prepack: 0, dias: 0 },
            e: { cal: 0, nocal: 0, suelto: 0, prepack: 0, dias: 0 },
        });
        ['p', 'e'].forEach(lado => {
            const d = dias[lado][f];
            if (!d || (!d.cal && !d.nocal)) return;
            w[lado].cal += d.cal;
            w[lado].nocal += d.nocal;
            w[lado].suelto += d.suelto;
            w[lado].prepack += d.prepack;
            w[lado].dias++;
        });
    });

    const orden = Object.keys(semanas).sort().map(k => semanas[k]);

    /* LA SEMANA EN CURSO es la de hoy, si está en la lista. No entra en promedios
       ni en la recta: está a medio hacer, y tirar de ella hacia abajo haría
       parecer que la producción cayó. */
    const hoy = new Date();
    const hoyISO = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
        + '-' + String(hoy.getDate()).padStart(2, '0');
    const claveEnCurso = (semanaDe(hoyISO) || {}).clave;

    /* UNA SEMANA CORTA NO ES UNA SEMANA MALA. Con menos de cuatro días de datos de
       ese lado, el total no se puede comparar con una semana entera: queda a la
       vista pero fuera de la cuenta. */
    const DIAS_MINIMOS = 4;

    const serieDe = (cfg) => {
        const puntos = orden.map(w => ({
            clave: w.clave, sem: w.sem, lunes: w.lunes,
            valor: w[cfg.lado][cfg.cat],
            dias: w[cfg.lado].dias,
            suelto: w[cfg.lado].suelto,
            prepack: w[cfg.lado].prepack,
            enCurso: w.clave === claveEnCurso,
        }));
        const cerradas = puntos.filter(p => !p.enCurso && p.dias >= DIAS_MINIMOS && p.valor > 0);
        const enCurso = puntos.filter(p => p.enCurso && p.valor > 0)[0] || null;
        const cortas = puntos.filter(p => !p.enCurso && p.valor > 0 && p.dias < DIAS_MINIMOS);
        if (!cerradas.length) return { cfg: cfg, puntos: puntos, cerradas: cerradas,
                                       enCurso: enCurso, cortas: cortas, vacio: true };
        const ult4 = cerradas.slice(-4);
        const r = recta(cerradas.map(p => p.valor));
        return {
            cfg: cfg, puntos: puntos, cerradas: cerradas, enCurso: enCurso, cortas: cortas,
            vacio: false,
            ultima: cerradas[cerradas.length - 1],
            anterior: cerradas.length > 1 ? cerradas[cerradas.length - 2] : null,
            prom4: promedio(ult4.map(p => p.valor)),
            promTodas: promedio(cerradas.map(p => p.valor)),
            pendiente: r.m,
            recta: r,
        };
    };

    const resumenes = SERIES.map(serieDe);

    // ─── HTML ────────────────────────────────────────────────────────────────
    const desde = O.desde || fechas[0];
    const hasta = O.hasta || fechas[fechas.length - 1];
    const nSem = Math.max.apply(null, resumenes.map(r => r.cerradas.length).concat([0]));

    const T = [];
    T.push('<style>' + CSS + '</style><div id="pp">');

    T.push('<div class="pp-cab"><div class="pp-quien">'
    + '<h2>Producción Picking y Embalaje</h2>'
    + '<div class="pp-cuantos">'
    + nSem + (nSem === 1 ? ' semana cerrada' : ' semanas cerradas')
    + ', del ' + corta(fechas[0]) + ' al ' + corta(fechas[fechas.length - 1])
    + (claveEnCurso && semanas[claveEnCurso]
        ? ' · la semana ' + semanas[claveEnCurso].sem + ' está en curso y no entra en la cuenta'
        : '')
    + '</div></div>'
    + selectorRango(desde, hasta, 'window.__ppRango')
    + '</div>');

    /* ─── UNA TARJETA GRANDE POR SERIE ─────────────────────────────────────
       Mismo formato que Almacenaje → Productividad, que es el que Daniel ya lee. */
    const caja = (rot, val, pie, color) =>
        '<div class="pp-c"' + (color ? ' style="background:' + color + '18; border-color:' + color + '44;"' : '')
        + '><div class="r"' + (color ? ' style="color:' + color + ';"' : '') + '>' + rot + '</div>'
        + '<div class="v"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</div>'
        + '<div class="p"' + (color ? ' style="color:' + color + 'bb;"' : '') + '>' + pie + '</div></div>';

    resumenes.forEach(r => {
        const c = r.cfg;
        T.push('<div class="pp-caja" style="border-color:' + c.color + '55;">');
        T.push('<p class="pp-titulo" style="color:' + c.color + ';">' + c.titulo + '</p>');

        if (r.vacio) {
            T.push('<p class="pp-sub">Todavía no hay ninguna semana cerrada con datos suficientes.</p></div>');
            return;
        }

        const sube = r.pendiente >= 0;
        const dif = r.anterior ? r.ultima.valor - r.anterior.valor : null;

        T.push('<p class="pp-sub">'
            + nf(r.cerradas.reduce((s, p) => s + p.valor, 0)) + ' ' + c.unidad + ' en '
            + r.cerradas.length + (r.cerradas.length === 1 ? ' semana cerrada' : ' semanas cerradas')
            + (c.cat === 'nocal'
                ? '. <b>Acá la unidad del WMS no es un par</b>: son bolsas, medias y cajas de '
                + 'accesorio. Por eso va en su propio cuadro y nunca sumado al calzado.'
                : '. Van juntos el suelto y el prepack, que es como se reporta; el desglose está '
                + 'en el pie de la primera caja.')
            + '</p>');

        T.push('<div class="pp-cajas">'
        /* EL PROMEDIO POR DIA VA AL LADO DEL TOTAL, y no es adorno: una semana de
           cinco dias contra una de seis no se pueden comparar de frente. La S34
           parecia una caida contra la S33 y lo unico que le faltaba era un dia. */
        + caja('Cierre semana ' + r.ultima.sem, nf(r.ultima.valor),
               r.ultima.dias + (r.ultima.dias === 1 ? ' día' : ' días') + ' · '
               + nf(r.ultima.valor / r.ultima.dias) + ' por día'
               + (c.cat === 'cal' && r.ultima.suelto
                   ? '<br>' + nf(r.ultima.suelto) + ' sueltos · ' + nf(r.ultima.prepack) + ' prepack'
                   : ''))
        + (r.anterior ? caja('Cierre semana ' + r.anterior.sem, nf(r.anterior.valor),
               r.anterior.dias + (r.anterior.dias === 1 ? ' día' : ' días') + ' · '
               + nf(r.anterior.valor / r.anterior.dias) + ' por día') : '')
        + caja('Últimas 4 semanas', nf(r.prom4), 'promedio por semana')
        + caja('Promedio general', nf(r.promTodas), r.cerradas.length + ' semanas cerradas')
        + caja((sube ? 'Sube cada semana' : 'Baja cada semana'),
               (sube ? '+' : '−') + nf(Math.abs(r.pendiente)),
               c.unidad + ' por semana', sube ? '#16a34a' : '#dc2626')
        + '</div>');

        T.push('<div class="pp-graf"><canvas id="pp_g_' + c.id + '"></canvas></div>');

        const linea = [];
        if (dif !== null) {
            linea.push('De la semana ' + r.anterior.sem + ' a la ' + r.ultima.sem + ' '
                + (dif >= 0 ? 'subió' : 'bajó') + ' <b>' + nf(Math.abs(dif)) + ' ' + c.unidad + '</b>'
                + (r.anterior.valor ? ' (' + n1(Math.abs(dif) * 100 / r.anterior.valor) + '%)' : '') + '.');
            /* SI LAS DOS SEMANAS NO TIENEN LOS MISMOS DIAS, la comparacion de
               frente engaña y hay que decirlo con el numero al lado. */
            if (r.ultima.dias !== r.anterior.dias) {
                const dd = (r.ultima.valor / r.ultima.dias) - (r.anterior.valor / r.anterior.dias);
                linea.push('Ojo que no tienen los mismos días —' + r.ultima.dias + ' contra '
                    + r.anterior.dias + '—: <b>por día</b> ' + (dd >= 0 ? 'subió' : 'bajó') + ' '
                    + nf(Math.abs(dd)) + ' ' + c.unidad + '.');
            }
        }
        linea.push('Si sigue este ritmo, la semana ' + (r.ultima.sem + 1) + ' daría <b>'
            + nf(Math.max(0, r.recta.b + r.recta.m * r.cerradas.length)) + ' ' + c.unidad + '</b>.');
        if (r.enCurso) {
            linea.push('La semana ' + r.enCurso.sem + ' va por <b>' + nf(r.enCurso.valor) + ' '
                + c.unidad + '</b> en ' + r.enCurso.dias
                + (r.enCurso.dias === 1 ? ' día' : ' días') + ', o sea '
                + nf(r.enCurso.valor / r.enCurso.dias) + ' por día; todavía no cerró y por eso '
                + 'no está en el gráfico ni en los promedios.');
        }
        if (r.cortas.length) {
            linea.push('Quedan fuera de la cuenta ' + r.cortas.length
                + (r.cortas.length === 1 ? ' semana corta' : ' semanas cortas')
                + ' —' + r.cortas.map(p => 'S' + p.sem + ' con ' + p.dias
                    + (p.dias === 1 ? ' día' : ' días')).join(', ')
                + '—: con menos de ' + DIAS_MINIMOS + ' días no se comparan con una semana entera.');
        }
        T.push('<div class="pp-nota">' + linea.join(' ') + '</div>');
        T.push('</div>');
    });

    /* ─── LA PROYECCIÓN DE LAS PRÓXIMAS SEMANAS ──────────────────────────── */
    const PROX = 4;
    const conRecta = resumenes.filter(r => !r.vacio);
    if (conRecta.length) {
        const ultimaSem = Math.max.apply(null, conRecta.map(r => r.ultima.sem));
        T.push('<div class="pp-caja"><p class="pp-titulo" style="color:var(--text-strong);">'
            + 'LO QUE VIENE, SI SIGUE ESTE RITMO</p>'
            + '<p class="pp-sub">Las próximas ' + PROX + ' semanas, sacadas de la recta de cada '
            + 'cuadro de arriba. <b>No es una promesa</b>: es lo que daría si los pedidos, el '
            + 'equipo y la gente siguen como en estas ' + nSem + ' semanas. Un pico de campaña o '
            + 'una semana con menos personal lo cambia entero.</p>'
            + '<div class="pp-scroll"><table class="pp-tabla"><thead><tr><th>Semana</th>'
            + conRecta.map(r => '<th>' + esc(r.cfg.titulo.replace(' · ', ' ')) + '<br>'
                + '<span style="opacity:0.6; font-weight:600;">' + r.cfg.unidad + '</span></th>').join('')
            + '</tr></thead><tbody>'
            + Array.from({ length: PROX }, (v, k) =>
                '<tr><td>Semana ' + (ultimaSem + 1 + k) + '</td>'
                + conRecta.map(r => '<td>'
                    + nf(Math.max(0, r.recta.b + r.recta.m * (r.cerradas.length + k)))
                    + '</td>').join('') + '</tr>').join('')
            + '</tbody></table></div></div>');
    }

    /* ─── LA TABLA SEMANA A SEMANA ───────────────────────────────────────── */
    const totalCerradas = (i) => resumenes[i].cerradas.reduce((s, p) => s + p.valor, 0);
    T.push('<div class="pp-caja"><p class="pp-titulo" style="color:var(--text-strong);">SEMANA A SEMANA</p>'
    + '<p class="pp-sub">Los números son los del archivo del WMS. «Días» es cuántos días de esa '
    + 'semana tienen datos <b>de ese lado</b>: si son menos de ' + DIAS_MINIMOS + ', esa mitad '
    + 'sale en gris con un ✎ y no entra en los promedios ni en la recta. La marca va por lado y '
    + 'no por fila, porque una semana puede estar completa en picking y corta en embalaje.</p>'
    + '<div class="pp-scroll"><table class="pp-tabla"><thead>'
    + '<tr><th></th><th class="pp-grupo" colspan="3">Picking</th>'
    + '<th class="pp-grupo pp-sep" colspan="3">Embalaje</th></tr>'
    + '<tr><th>Semana</th><th>Días</th><th>Calzado</th><th>No calzado</th>'
    + '<th class="pp-sep">Días</th><th>Calzado</th><th>No calzado</th></tr></thead><tbody>'
    /* LA MARCA DE CORTA VA POR LADO, NO POR FILA. La S31 tiene 4 dias de picking
       -completa- y 3 de embalaje -corta-: marcar la fila entera decia que el
       picking de esa semana no servia, y si servia. Se pinta la mitad que
       corresponde y el resto de la fila queda normal. */
    + orden.slice().reverse().map(w => {
        const enCurso = w.clave === claveEnCurso;
        const cortoP = !enCurso && w.p.dias > 0 && w.p.dias < DIAS_MINIMOS;
        const cortoE = !enCurso && w.e.dias > 0 && w.e.dias < DIAS_MINIMOS;
        const nota = enCurso ? ' <span style="font-size:10px;">(en curso)</span>' : '';
        const flojo = ' style="color:var(--text-muted); font-style:italic;"';
        const pd = cortoP ? flojo : '';
        const ed = cortoE ? flojo : '';
        const l = w.lunes;
        return '<tr class="' + (enCurso ? 'pp-parcial' : '') + '">'
            + '<td>Semana ' + w.sem + nota + '<br><span style="font-size:10px; opacity:0.6;">desde el '
            + l.getDate() + ' ' + MESES[l.getMonth()] + '</span></td>'
            + '<td' + pd + '>' + (w.p.dias || '–') + (cortoP ? ' ✎' : '') + '</td>'
            + '<td' + pd + '>' + nf(w.p.cal || null) + '</td>'
            + '<td' + pd + '>' + nf(w.p.nocal || null) + '</td>'
            + '<td class="pp-sep"' + ed.replace(' style=', ' style=') + '>' + (w.e.dias || '–')
            + (cortoE ? ' ✎' : '') + '</td>'
            + '<td' + ed + '>' + nf(w.e.cal || null) + '</td>'
            + '<td' + ed + '>' + nf(w.e.nocal || null) + '</td></tr>';
    }).join('')
    + '</tbody><tfoot><tr><td>Total de las semanas cerradas</td>'
    + '<td>–</td><td>' + nf(totalCerradas(0)) + '</td><td>' + nf(totalCerradas(1)) + '</td>'
    + '<td class="pp-sep">–</td><td>' + nf(totalCerradas(2)) + '</td><td>' + nf(totalCerradas(3)) + '</td>'
    + '</tr></tfoot></table></div>'
    + '<div class="pp-nota">Cada total suma solo las semanas cerradas DE ESA COLUMNA, que no son '
    + 'siempre las mismas: una semana puede estar completa en embalaje y corta en picking. Por eso '
    + 'las cuatro columnas no tienen por qué sumar los mismos días.</div>'
    + '</div>');

    T.push('</div>');
    cont.innerHTML = T.join('');

    window.__ppRango = (d, h) => {
        if (typeof O.alCambiarRango === 'function') O.alCambiarRango(d, h);
    };

    // ─── LOS GRÁFICOS ────────────────────────────────────────────────────────
    if (typeof Chart === 'undefined') {
        console.warn('[PRODUCCIÓN] Chart.js no está cargado: los gráficos quedan vacíos.');
        return;
    }

    resumenes.forEach(r => {
        if (r.vacio) return;
        const cv = document.getElementById('pp_g_' + r.cfg.id);
        if (!cv) return;

        /* LA SEMANA EN CURSO NO SE DIBUJA. Acá el eje es un TOTAL de la semana,
           no una velocidad: una semana con un día siempre va a valer la sexta
           parte, así que dibujarla es un despeñadero al final del gráfico que no
           dice nada —y en un cuadro que se mira de reojo, se lee como que la
           producción se cayó.

           En Almacenaje → Productividad sí se dibuja, y está bien: ahí el eje son
           unidades POR HORA, y una semana a medias ya da un número comparable.
           Acá no. La semana en curso se cuenta con palabras, debajo del gráfico.

           El último punto SÍ lleva un paso más de recta, para que se vea hacia
           dónde va la semana que todavía no cerró. */
        const todas = r.cerradas;
        const etiquetas = todas.map(p => 'S' + p.sem).concat(['S' + (r.ultima.sem + 1)]);
        const cerradas = todas.map(p => p.valor).concat([null]);
        const tend = etiquetas.map((v, i) => Math.max(0, Math.round(r.recta.b + r.recta.m * i)));

        _graficos.push(new Chart(cv, resolverColoresChart({
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Tendencia', data: tend, borderColor: 'rgba(148,163,184,0.85)',
                      borderWidth: 2, borderDash: [6, 5], pointRadius: 0, fill: false, order: 3 },
                    { label: 'Cerrada', data: cerradas, borderColor: r.cfg.color,
                      backgroundColor: r.cfg.color + '22', borderWidth: 3, tension: 0.3,
                      pointRadius: 4, pointBackgroundColor: r.cfg.color, fill: true, order: 1 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: {
                        title: (c) => {
                            const p = todas[c[0].dataIndex];
                            if (!p) return 'Semana ' + (r.ultima.sem + 1) + ' · todavía no empezó';
                            return 'Semana ' + p.sem + ' · ' + p.dias
                                + (p.dias === 1 ? ' día' : ' días')
                                + ' · ' + nf(p.valor / p.dias) + ' por día';
                        },
                        label: (c) => (c.parsed.y === null || c.parsed.y === undefined) ? null
                            : c.dataset.label + ': ' + nf(c.parsed.y) + ' ' + r.cfg.unidad,
                    } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (v) => nf(v) } },
                    x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 20 } }
                }
            }
        })));
    });
}
