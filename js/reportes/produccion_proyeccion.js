/**
 * PICKING → PRODUCCIÓN PICKING EMBALAJE
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LA PREGUNTA QUE CONTESTA: ¿CUÁNTOS PARES POR HORA HACEMOS,               ║
 * ║ Y ESTÁ SUBIENDO O BAJANDO?                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Daniel, 02-sep-2026: *"yo no quiero saber cuántos pares se pican a la semana.
 * Yo quiero saber la producción por hora. ¿En una hora cuánto hacemos? Y eso
 * promédialo por semana, así como lo has hecho en almacenaje... la proyección
 * comenzó con cien pares por hora. Ese es su base, ahora quiero saber si está
 * subiendo o bajando: eso es lo que quiero identificar"*.
 *
 * ESTA PANTALLA SE HIZO MAL TRES VECES. Vale la pena dejarlo escrito, porque el
 * error de fondo fue siempre el mismo: contestar otra pregunta.
 *
 *   1. PARES POR DÍA, calzado y no calzado SUMADOS. Decía que el CD había
 *      triplicado la producción del 24 al 28 de agosto. Mentira: el calzado no se
 *      movió y todo el salto era papel de seda contado como pares.
 *   2. LÍNEAS. Salían planas y resolvían el síntoma, pero *"yo no veo nada en
 *      línea, yo veo pares"*.
 *   3. PARES POR SEMANA. Un total, no un ritmo. Decía *"sube 14.962 pares por
 *      semana"*, que no se puede comparar contra nada ni dice si el equipo rinde
 *      más. Daniel: *"¿qué es eso? Es una cifra que no se puede..."*.
 *
 * LA BUENA ES UN RITMO: PARES POR HORA. Un ritmo no depende de cuántos días tuvo
 * la semana ni de cuánta gente entró, así que se puede comparar la semana 32 con
 * la 35 de frente. Es exactamente lo que hace Almacenaje → Productividad, que
 * Daniel señaló como referencia: ahí dice *"474 u/h"* y *"sube cada semana
 * +19,9"*, no *"tantas unidades esta semana"*.
 *
 * DE DÓNDE SALEN LAS HORAS. No de la jornada ni de un horario teórico: de lo que
 * cada persona trabajó DE VERDAD en esa categoría. El robot publica, por persona
 * y por clase, los tramos en que estuvo moviendo esa cosa —`cal_suelto_iv`,
 * `no_cal_iv`—, y acá se unen dentro de cada persona y se suman entre personas.
 *
 *     UNIÓN DENTRO DE LA PERSONA, SUMA ENTRE PERSONAS. Nadie está en dos sitios a
 *     la vez, así que a una persona sus tramos se le unen; pero diez pickers
 *     trabajando a la misma hora son diez horas-persona, no una.
 *
 * EL RITMO DE LA SEMANA SE SACA SUMANDO Y DIVIDIENDO, NO PROMEDIANDO RITMOS.
 * Pares de la semana entre horas de la semana. Promediar los ritmos diarios le
 * daría el mismo peso a un sábado de tres horas que a un martes de doce.
 *
 * LOS TIPOS SON TRES, y cada uno con su cuadro y su unidad:
 *   · CALZADO      pares de verdad; suelto y prepack juntos, como se reporta
 *   · NO CALZADO   bolsas, medias, accesorios. La unidad del WMS no es un par
 *   · MATERIALES   papel de seda, etiquetas, cajas. No se vende
 *
 * LA SEMANA EN CURSO SÍ SE DIBUJA, y acá sí corresponde: al ser un ritmo, una
 * semana a medias ya da un número comparable. (Cuando esto medía totales había
 * que esconderla, porque una semana de un día valía la sexta parte y parecía un
 * desplome.) Va aparte y punteada, igual que en Almacenaje.
 *
 * ESTE ARCHIVO NO LEE DEL SERVIDOR. Recibe los días ya bajados de
 * `picking_por_hora` y `embalaje_por_hora`, y solo calcula y dibuja.
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

import { resolverColoresChart } from '../services_v245/temaService.js?v=29.0562';
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0562';

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/* LA FECHA SE PARTE A MANO, NO CON `new Date(iso)`. Un 'AAAA-MM-DD' suelto se
   interpreta como UTC y en Lima retrocede al día anterior. */
const partir = (f) => {
    const p = String(f || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
};
const corta = (f) => {
    const d = partir(f);
    return d.getDate() + ' ' + MESES[d.getMonth()];
};

/* SEMANA ISO: el jueves decide a qué semana pertenece un día. Es la misma cuenta
   que usa Almacenaje → Productividad, así que la S35 de acá es la S35 de allá. */
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
   LOS TRES TIPOS, Y LAS HORAS DE CADA UNO
   ══════════════════════════════════════════════════════════════════════════ */

const TIPOS = {
    cal:   { clases: ['cal_suelto', 'cal_prepack'], unidad: 'pares' },
    nocal: { clases: ['no_cal'],                    unidad: 'unidades' },
    mat:   { clases: ['materiales', 'sin_tipo'],    unidad: 'unidades' },
};

/* EL PISO DE 100 PARES/HORA.
 *
 * Daniel, 02-sep-2026: *"el piso hay que ponerlo de cien, porque picking dijo que
 * cien era su piso. Ahora paguen cien, y desde ahi hay que comenzar"*.
 *
 * No es un numero sacado de la data: es lo que el area de picking se comprometio
 * a hacer. Por eso va SOLO en picking calzado —es donde se dio el compromiso— y
 * no se le inventa un piso a las otras tres. El dia que embalaje comprometa el
 * suyo, se agrega aca y aparece solo.
 *
 * Se dibuja como una raya roja a lo ancho del grafico, y las cajas dicen cuanto
 * se esta por encima. Si una semana cae por debajo, se ve de una. */
const SERIES = [
    { id: 'pick_cal',   lado: 'p', tipo: 'cal',   titulo: 'PICKING · CALZADO',    color: '#2563eb',
      piso: 100, pisoQuien: 'el piso que comprometió picking' },
    { id: 'pick_nocal', lado: 'p', tipo: 'nocal', titulo: 'PICKING · NO CALZADO', color: '#d97706' },
    { id: 'emb_cal',    lado: 'e', tipo: 'cal',   titulo: 'EMBALAJE · CALZADO',   color: '#16a34a' },
    { id: 'emb_nocal',  lado: 'e', tipo: 'nocal', titulo: 'EMBALAJE · NO CALZADO', color: '#9333ea' },
];

/* HORAS REALMENTE TRABAJADAS EN UNAS CLASES.
 *
 * UNIÓN DENTRO DE CADA PERSONA, SUMA ENTRE PERSONAS. Una persona no puede estar
 * en dos sitios a la vez, así que sus tramos se unen —si no, alguien que alterna
 * entre calzado y no calzado contaría el doble de horas—. Pero diez pickers
 * trabajando a la misma hora son diez horas-persona, no una: entre personas se
 * suma. La primera medición unía todo junto y daba 85 minutos de trabajo por día
 * para todo el CD.
 *
 * Los tramos los publica el robot en `gente[].total.<clase>_iv`, en segundos
 * desde medianoche. Son los mismos con los que se calcula el ritmo del turno. */
const horasDe = (vista, clases) => {
    let total = 0;
    (vista.gente || []).forEach(p => {
        const t = p.total || {};
        let iv = [];
        clases.forEach(c => { iv = iv.concat(t[c + '_iv'] || []); });
        if (!iv.length) return;
        iv = iv.map(x => [Number(x[0]) || 0, Number(x[1]) || 0])
               .filter(x => x[1] > x[0])
               .sort((a, b) => a[0] - b[0]);
        if (!iv.length) return;
        let ci = iv[0][0], cf = iv[0][1], s = 0;
        for (let i = 1; i < iv.length; i++) {
            if (iv[i][0] > cf) { s += cf - ci; ci = iv[i][0]; cf = iv[i][1]; }
            else if (iv[i][1] > cf) { cf = iv[i][1]; }
        }
        s += cf - ci;
        total += s;
    });
    return total / 3600;
};

/** Un día de un lado: pares y horas de cada tipo. */
const resumirDia = (entrada) => {
    const d = (entrada && entrada.datos) || {};
    const v = (d.vistas && d.vistas.TODOS) || {};
    const t = v.totales || {};
    const o = { fecha: entrada.fecha };
    Object.keys(TIPOS).forEach(k => {
        const cl = TIPOS[k].clases;
        o[k] = { pares: cl.reduce((s, c) => s + (Number(t[c]) || 0), 0),
                 horas: horasDe(v, cl) };
    });
    o.suelto = Number(t.cal_suelto) || 0;
    o.prepack = Number(t.cal_prepack) || 0;
    o.sinTipo = Number(t.sin_tipo) || 0;
    return o;
};

/* MÍNIMOS CUADRADOS. Devuelve cuánto sube por semana y dónde arranca la recta. */
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
'#pp .pp-cajas { display:grid; grid-template-columns:repeat(auto-fit, minmax(152px, 1fr)); gap:12px; margin-bottom:16px; }',
'#pp .pp-c { background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.08); border-radius:10px; padding:0.85rem 1rem; }',
'#pp .pp-c .r { font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.45); }',
'#pp .pp-c .v { font-size:var(--t-2xl); font-weight:900; color:var(--text-strong); line-height:1.15; font-variant-numeric:tabular-nums; }',
'#pp .pp-c .u { font-size:12px; font-weight:700; opacity:0.6; margin-left:3px; }',
'#pp .pp-c .p { font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.35); line-height:1.45; }',
'#pp .pp-graf { position:relative; height:260px; width:0; min-width:100%; }',
'#pp .pp-scroll { overflow-x:auto; width:0; min-width:100%; }',
'#pp table.pp-tabla { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#pp table.pp-tabla th { text-align:right; padding:9px 10px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid var(--border); white-space:nowrap; font-size:10.5px; }',
'#pp table.pp-tabla th.pp-grupo { text-align:center; border-bottom:1px solid var(--border); padding-bottom:5px; }',
'#pp table.pp-tabla th:first-child, #pp table.pp-tabla td:first-child { text-align:left; }',
'#pp table.pp-tabla td { padding:8px 10px; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb), 0.06); white-space:nowrap; }',
'#pp table.pp-tabla td.pp-sep, #pp table.pp-tabla th.pp-sep { border-left:1px solid var(--border); }',
'#pp table.pp-tabla td.pp-ritmo { font-weight:800; color:var(--text-strong); }',
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

    /* ─── POR SEMANA: SE SUMAN PARES Y HORAS, Y RECIÉN DESPUÉS SE DIVIDE ────
       El ritmo de la semana NO es el promedio de los ritmos diarios: eso le daría
       el mismo peso a un sábado de tres horas que a un martes de doce. Es la suma
       de pares dividida por la suma de horas. */
    const semanas = {};
    const vacio = () => {
        const o = { dias: 0, suelto: 0, prepack: 0, sinTipo: 0 };
        Object.keys(TIPOS).forEach(k => { o[k] = { pares: 0, horas: 0 }; });
        return o;
    };
    fechas.forEach(f => {
        const s = semanaDe(f);
        if (!s) return;
        const w = semanas[s.clave] || (semanas[s.clave] = {
            clave: s.clave, sem: s.sem, anio: s.anio, lunes: lunesDe(s.anio, s.sem),
            p: vacio(), e: vacio(),
        });
        ['p', 'e'].forEach(lado => {
            const d = dias[lado][f];
            if (!d) return;
            const algo = Object.keys(TIPOS).some(k => d[k].pares > 0);
            if (!algo) return;
            Object.keys(TIPOS).forEach(k => {
                w[lado][k].pares += d[k].pares;
                w[lado][k].horas += d[k].horas;
            });
            w[lado].suelto += d.suelto;
            w[lado].prepack += d.prepack;
            w[lado].sinTipo += d.sinTipo;
            w[lado].dias++;
        });
    });

    const orden = Object.keys(semanas).sort().map(k => semanas[k]);

    const hoy = new Date();
    const hoyISO = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
        + '-' + String(hoy.getDate()).padStart(2, '0');
    const claveEnCurso = (semanaDe(hoyISO) || {}).clave;

    /* UN RITMO AGUANTA UNA SEMANA CORTA. Al ser pares POR HORA, una semana de dos
       días ya da un número comparable —esto no pasaba cuando el cuadro medía
       totales—. Lo único que se pide son horas suficientes para que el número no
       sea ruido: menos de cuatro horas de trabajo en una categoría es una muestra,
       no una semana. */
    const HORAS_MINIMAS = 4;

    const serieDe = (cfg) => {
        const T = TIPOS[cfg.tipo];
        const puntos = orden.map(w => {
            const x = w[cfg.lado][cfg.tipo];
            return {
                clave: w.clave, sem: w.sem, lunes: w.lunes,
                pares: x.pares, horas: x.horas,
                ritmo: x.horas > 0 ? x.pares / x.horas : 0,
                dias: w[cfg.lado].dias,
                suelto: w[cfg.lado].suelto, prepack: w[cfg.lado].prepack,
                enCurso: w.clave === claveEnCurso,
            };
        });
        const cerradas = puntos.filter(p => !p.enCurso && p.horas >= HORAS_MINIMAS && p.ritmo > 0);
        const enCurso = puntos.filter(p => p.enCurso && p.horas >= HORAS_MINIMAS)[0] || null;
        const flacas = puntos.filter(p => !p.enCurso && p.pares > 0 && p.horas < HORAS_MINIMAS);
        if (!cerradas.length) return { cfg: cfg, T: T, puntos: puntos, cerradas: cerradas,
                                       enCurso: enCurso, flacas: flacas, vacio: true };
        const ult4 = cerradas.slice(-4);
        const r = recta(cerradas.map(p => p.ritmo));
        /* Los promedios también van pares/horas, no promedio de ritmos. */
        const tasa = (ps) => {
            const P = ps.reduce((s, p) => s + p.pares, 0);
            const H = ps.reduce((s, p) => s + p.horas, 0);
            return H > 0 ? P / H : 0;
        };
        return {
            cfg: cfg, T: T, puntos: puntos, cerradas: cerradas, enCurso: enCurso,
            flacas: flacas, vacio: false,
            ultima: cerradas[cerradas.length - 1],
            anterior: cerradas.length > 1 ? cerradas[cerradas.length - 2] : null,
            prom4: tasa(ult4),
            promTodas: tasa(cerradas),
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
    + '<div class="pp-cuantos">Pares por hora trabajada · '
    + nSem + (nSem === 1 ? ' semana cerrada' : ' semanas cerradas')
    + ', del ' + corta(fechas[0]) + ' al ' + corta(fechas[fechas.length - 1])
    + (claveEnCurso && semanas[claveEnCurso]
        ? ' · la semana ' + semanas[claveEnCurso].sem + ' está en curso'
        : '')
    + '</div></div>'
    + selectorRango(desde, hasta, 'window.__ppRango')
    + '</div>');

    const caja = (rot, val, uni, pie, color) =>
        '<div class="pp-c"' + (color ? ' style="background:' + color + '18; border-color:' + color + '44;"' : '')
        + '><div class="r"' + (color ? ' style="color:' + color + ';"' : '') + '>' + rot + '</div>'
        + '<div class="v"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val
        + (uni ? '<span class="u">' + uni + '</span>' : '') + '</div>'
        + '<div class="p"' + (color ? ' style="color:' + color + 'bb;"' : '') + '>' + pie + '</div></div>';

    resumenes.forEach(r => {
        const c = r.cfg;
        const uni = r.T.unidad;
        T.push('<div class="pp-caja" style="border-color:' + c.color + '55;">');
        T.push('<p class="pp-titulo" style="color:' + c.color + ';">' + c.titulo + '</p>');

        if (r.vacio) {
            T.push('<p class="pp-sub">Todavía no hay ninguna semana cerrada con horas suficientes.</p></div>');
            return;
        }

        const sube = r.pendiente >= 0;
        const dif = r.anterior ? r.ultima.ritmo - r.anterior.ritmo : null;

        T.push('<p class="pp-sub">'
            + uni.charAt(0).toUpperCase() + uni.slice(1) + ' por hora realmente trabajada en '
            + 'esta categoría. En ' + r.cerradas.length
            + (r.cerradas.length === 1 ? ' semana cerrada' : ' semanas cerradas')
            + ' se movieron ' + nf(r.cerradas.reduce((s, p) => s + p.pares, 0)) + ' ' + uni
            + ' en ' + nf(r.cerradas.reduce((s, p) => s + p.horas, 0)) + ' horas-persona'
            + (c.tipo === 'nocal'
                ? '. <b>Acá la unidad del WMS no es un par</b>: son bolsas, medias y cajas de '
                + 'accesorio, y por eso el ritmo sale mucho más alto que en calzado. Se mira '
                + 'contra sí mismo, no contra el calzado.'
                : '. Van juntos el suelto y el prepack, que es como se reporta.')
            + '</p>');

        T.push('<div class="pp-cajas">'
        + caja('Cierre semana ' + r.ultima.sem, nf(r.ultima.ritmo), uni + '/h',
               nf(r.ultima.pares) + ' ' + uni + ' en ' + nf(r.ultima.horas) + ' h · '
               + r.ultima.dias + (r.ultima.dias === 1 ? ' día' : ' días'))
        + (r.anterior ? caja('Cierre semana ' + r.anterior.sem, nf(r.anterior.ritmo), uni + '/h',
               nf(r.anterior.pares) + ' ' + uni + ' en ' + nf(r.anterior.horas) + ' h') : '')
        + caja('Últimas 4 semanas', nf(r.prom4), uni + '/h', 'promedio')
        + caja('Promedio general', nf(r.promTodas), uni + '/h',
               r.cerradas.length + ' semanas cerradas')
        + caja((sube ? 'Sube cada semana' : 'Baja cada semana'),
               (sube ? '+' : '−') + n1(Math.abs(r.pendiente)), '',
               uni + '/h por semana', sube ? '#16a34a' : '#dc2626')
        /* CONTRA EL PISO, cuando la categoria tiene uno comprometido. Va con la
           ultima semana cerrada y no con el promedio: lo que importa es como se
           esta cerrando ahora. */
        + (c.piso
            ? caja('Sobre el piso de ' + nf(c.piso),
                   (r.ultima.ritmo >= c.piso ? '+' : '−')
                   + n1(Math.abs(r.ultima.ritmo - c.piso) * 100 / c.piso) + '%', '',
                   'la semana ' + r.ultima.sem + ' cerró en ' + nf(r.ultima.ritmo) + ' ' + uni + '/h',
                   r.ultima.ritmo >= c.piso ? '#16a34a' : '#dc2626')
            : '')
        + '</div>');

        T.push('<div class="pp-graf"><canvas id="pp_g_' + c.id + '"></canvas></div>');

        const linea = [];
        if (dif !== null) {
            linea.push('De la semana ' + r.anterior.sem + ' a la ' + r.ultima.sem + ' el ritmo '
                + (dif >= 0 ? 'subió' : 'bajó') + ' <b>' + n1(Math.abs(dif)) + ' ' + uni + '/h</b>'
                + (r.anterior.ritmo ? ' (' + n1(Math.abs(dif) * 100 / r.anterior.ritmo) + '%)' : '')
                + ', de ' + nf(r.anterior.ritmo) + ' a ' + nf(r.ultima.ritmo) + '.');
        }
        linea.push('Si sigue así, la semana ' + (r.ultima.sem + 1) + ' daría <b>'
            + nf(Math.max(0, r.recta.b + r.recta.m * r.cerradas.length)) + ' ' + uni + '/h</b>.');
        if (r.enCurso) {
            linea.push('La semana ' + r.enCurso.sem + ' va por <b>' + nf(r.enCurso.ritmo) + ' '
                + uni + '/h</b> con ' + nf(r.enCurso.horas) + ' horas hechas; todavía no cerró, '
                + 'así que va punteada y no entra en los promedios.');
        }
        if (c.piso) {
            const bajo = r.cerradas.filter(p => p.ritmo < c.piso);
            linea.push('El gráfico arranca en <b>Origen</b>, que son los <b>' + nf(c.piso)
                + ' ' + uni + '/h</b> que comprometió picking — el punto rojo —; de ahí en '
                + 'adelante va lo que se picó de verdad.'
                + (bajo.length
                    ? ' <b>' + bajo.length + (bajo.length === 1 ? ' semana cerró' : ' semanas cerraron')
                      + ' por debajo</b>: ' + bajo.map(p => 'S' + p.sem + ' con ' + nf(p.ritmo)).join(', ') + '.'
                    : ' Ninguna semana cerrada cayó por debajo.'));
        }
        if (r.flacas.length) {
            linea.push('Quedan fuera ' + r.flacas.length
                + (r.flacas.length === 1 ? ' semana con muy pocas horas' : ' semanas con muy pocas horas')
                + ' —' + r.flacas.map(p => 'S' + p.sem + ' con ' + n1(p.horas) + ' h').join(', ')
                + '—: con menos de ' + HORAS_MINIMAS + ' horas el ritmo es ruido.');
        }
        T.push('<div class="pp-nota">' + linea.join(' ') + '</div>');
        T.push('</div>');
    });

    /* ─── MATERIALES, EN CHICO ─────────────────────────────────────────────
       Daniel no quiere llenarse de tipos, pero lo que el Maestro no conoce —papel
       de seda, etiquetas, cajas— tampoco puede ir en "no calzado" como si fuera
       mercadería: era lo que le movía la tendencia. Va al final y en chico. */
    const totMat = (lado, campo) => orden.reduce((s, w) =>
        s + (w.clave === claveEnCurso ? 0 : w[lado].mat[campo]), 0);
    const totSin = (lado) => orden.reduce((s, w) =>
        s + (w.clave === claveEnCurso ? 0 : w[lado].sinTipo), 0);
    if (totMat('p', 'pares') || totMat('e', 'pares')) {
        const hp = totMat('p', 'horas'), he = totMat('e', 'horas');
        T.push('<div class="pp-caja" style="border-color:#64748b55;">'
        + '<p class="pp-titulo" style="color:#64748b;">MATERIALES</p>'
        + '<p class="pp-sub">Papel de seda, etiquetas colgantes, cajas de cartón y plantillas: '
        + 'todo lo que el picker mueve y <b>no se vende</b>. Se separó el 02-sep-2026 porque antes '
        + 'entraba en «no calzado» y le movía la tendencia — la subida del 24 al 28 de agosto era '
        + 'un solo código de papel de seda, no producción.</p>'
        + '<div class="pp-cajas">'
        + caja('Picking', nf(hp > 0 ? totMat('p', 'pares') / hp : 0), 'u/h',
               nf(totMat('p', 'pares')) + ' unidades en ' + nf(hp) + ' h', '#64748b')
        + caja('Embalaje', nf(he > 0 ? totMat('e', 'pares') / he : 0), 'u/h',
               nf(totMat('e', 'pares')) + ' unidades en ' + nf(he) + ' h', '#64748b')
        + ((totSin('p') || totSin('e'))
            ? caja('Sin tipo', nf(totSin('p') + totSin('e')), '',
                   'no están en el Maestro y no tienen forma de material', '#dc2626')
            : caja('Sin tipo', '0', '', 'todo lo desconocido resultó ser material', '#16a34a'))
        + '</div>'
        + '<div class="pp-nota">«Sin tipo» es lo que el Maestro no conoce y <b>no</b> tiene la '
        + 'forma de un material —cinco dígitos—. Si ese número crece, hay artículos que le faltan '
        + 'al Maestro del WMS.</div></div>');
    }

    /* ─── LA TABLA SEMANA A SEMANA ───────────────────────────────────────── */
    const cel = (w, lado, tipo) => {
        const x = w[lado][tipo];
        return x.horas > 0 ? nf(x.pares / x.horas) : '–';
    };
    T.push('<div class="pp-caja"><p class="pp-titulo" style="color:var(--text-strong);">SEMANA A SEMANA</p>'
    + '<p class="pp-sub">El ritmo de cada semana en <b>' + 'unidades por hora' + '</b>, y al lado '
    + 'las horas-persona con que se calculó. Los pares y las horas salen del archivo del WMS: el '
    + 'ritmo es la división de los dos, no un promedio de días.</p>'
    + '<div class="pp-scroll"><table class="pp-tabla"><thead>'
    + '<tr><th></th><th class="pp-grupo" colspan="4">Picking · por hora</th>'
    + '<th class="pp-grupo pp-sep" colspan="4">Embalaje · por hora</th></tr>'
    + '<tr><th>Semana</th><th>Horas</th><th>Calzado</th><th>No calzado</th><th>Materiales</th>'
    + '<th class="pp-sep">Horas</th><th>Calzado</th><th>No calzado</th><th>Materiales</th>'
    + '</tr></thead><tbody>'
    + orden.slice().reverse().map(w => {
        const enCurso = w.clave === claveEnCurso;
        const hp = w.p.cal.horas + w.p.nocal.horas + w.p.mat.horas;
        const he = w.e.cal.horas + w.e.nocal.horas + w.e.mat.horas;
        const l = w.lunes;
        return '<tr class="' + (enCurso ? 'pp-parcial' : '') + '">'
            + '<td>Semana ' + w.sem
            + (enCurso ? ' <span style="font-size:10px;">(en curso)</span>' : '')
            + '<br><span style="font-size:10px; opacity:0.6;">desde el '
            + l.getDate() + ' ' + MESES[l.getMonth()] + ' · ' + (w.p.dias || w.e.dias) + ' días</span></td>'
            + '<td>' + (hp ? nf(hp) : '–') + '</td>'
            + '<td class="pp-ritmo">' + cel(w, 'p', 'cal') + '</td>'
            + '<td>' + cel(w, 'p', 'nocal') + '</td><td>' + cel(w, 'p', 'mat') + '</td>'
            + '<td class="pp-sep">' + (he ? nf(he) : '–') + '</td>'
            + '<td class="pp-ritmo">' + cel(w, 'e', 'cal') + '</td>'
            + '<td>' + cel(w, 'e', 'nocal') + '</td><td>' + cel(w, 'e', 'mat') + '</td></tr>';
    }).join('')
    + '</tbody></table></div>'
    + '<div class="pp-nota">La tabla no lleva fila de total: <b>los ritmos no se suman</b>. El '
    + 'promedio general de cada categoría está en su cuadro de arriba, y sale de dividir todos los '
    + 'pares entre todas las horas.</div></div>');

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

        /* LA SEMANA EN CURSO SÍ VA, punteada y aparte, igual que en Almacenaje →
           Productividad. Al ser un RITMO, una semana a medias ya da un número
           comparable; cuando esto medía totales había que esconderla. Se engancha
           al último punto cerrado para que no quede suelta en el aire. */
        const reales = r.enCurso ? r.cerradas.concat([r.enCurso]) : r.cerradas;

        /* EL PISO ES EL PUNTO DE ARRANQUE, NO UNA RAYA A LO ANCHO.
         *
         * Daniel, 02-sep-2026: *"antes de la semana treinta y uno pon una semana
         * antes, como de decir origen, y ahi pon cien pares por hora comprometidos
         * por picking, y de ahi la semana treinta y uno ya pon lo que de verdad
         * esta picando"*.
         *
         * Cruzando el grafico entero, el piso se leia como una medicion mas.
         * Puesto al principio se lee como lo que es: de aca partimos, y esto es lo
         * que paso despues. La linea sube de 100 a lo real y el salto se ve solo.
         *
         * NO ENTRA EN LA RECTA NI EN LOS PROMEDIOS: es un compromiso, no algo que
         * se haya medido. La tendencia arranca en la primera semana de verdad. */
        const conPiso = !!r.cfg.piso;
        const todas = conPiso ? [null].concat(reales) : reales;
        const etiquetas = (conPiso ? ['Origen'] : []).concat(reales.map(p => 'S' + p.sem));
        const desfase = conPiso ? 1 : 0;

        const cerradas = (conPiso ? [r.cfg.piso] : [])
            .concat(r.cerradas.map(p => Math.round(p.ritmo)))
            .concat(r.enCurso ? [null] : []);
        const enCurso = (conPiso ? [null] : []).concat(r.cerradas.map(() => null))
            .concat(r.enCurso ? [Math.round(r.enCurso.ritmo)] : []);
        if (r.enCurso && r.cerradas.length) {
            enCurso[desfase + r.cerradas.length - 1] =
                Math.round(r.cerradas[r.cerradas.length - 1].ritmo);
        }
        /* La recta se dibuja sobre las semanas reales; en el origen va `null` para
           que no parezca que la tendencia arranca en el compromiso. */
        const tend = (conPiso ? [null] : [])
            .concat(reales.map((p, i) => Math.max(0, Math.round(r.recta.b + r.recta.m * i))));
        /* El tamaño del punto dice cuántas horas hay detrás: un punto chico es una
           semana corta, y eso explica un número raro sin tener que ir a la tabla. */
        const radio = todas.map(p => p
            ? Math.min(8, 3 + Math.sqrt(Math.max(0, p.horas)) / 3.5)
            : 6);                                   // el origen, siempre bien visible
        const colorPunto = todas.map(p => p ? r.cfg.color : '#dc2626');

        _graficos.push(new Chart(cv, resolverColoresChart({
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Tendencia', data: tend, borderColor: 'rgba(148,163,184,0.85)',
                      borderWidth: 2, borderDash: [6, 5], pointRadius: 0, fill: false, order: 3 },
                    { label: 'Cerrada', data: cerradas, borderColor: r.cfg.color,
                      backgroundColor: r.cfg.color + '22', borderWidth: 3, tension: 0.3,
                      pointRadius: radio, pointBackgroundColor: colorPunto,
                      pointBorderColor: colorPunto, fill: true, order: 1 },
                    { label: 'Semana en curso', data: enCurso, borderColor: r.cfg.color,
                      borderWidth: 2, borderDash: [4, 4], pointRadius: 5, pointStyle: 'rectRot',
                      fill: false, order: 2 },
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
                            if (!p) return 'Origen';
                            const l = p.lunes;
                            return 'Semana ' + p.sem + (p.enCurso ? ' (en curso)' : '')
                                + ' · desde el ' + l.getDate() + '/' + (l.getMonth() + 1);
                        },
                        label: (c) => {
                            if (c.parsed.y === null || c.parsed.y === undefined) return null;
                            const p = todas[c.dataIndex];
                            if (c.dataset.label === 'Tendencia') {
                                return 'Tendencia: ' + nf(c.parsed.y) + ' ' + r.T.unidad + '/h';
                            }
                            /* En el origen no hay pares ni horas que mostrar: es lo
                               comprometido, no algo que se midio. */
                            if (!p) {
                                return nf(c.parsed.y) + ' ' + r.T.unidad
                                     + '/h comprometidos por picking';
                            }
                            return nf(c.parsed.y) + ' ' + r.T.unidad + '/h'
                                + '  ·  ' + nf(p.pares) + ' en ' + nf(p.horas) + ' h';
                        },
                    } }
                },
                scales: {
                    /* Arranca en cero a proposito: con un eje recortado, 149 y 181
                       parecen el doble uno del otro, y el piso de 100 se pierde. */
                    y: { beginAtZero: true, ticks: { callback: (v) => nf(v) } },
                    x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 20 } }
                }
            }
        })));
    });
}
