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

import { resolverColoresChart } from '../services_v245/temaService.js?v=29.0599';
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0599';
/* LA EQUIVALENCIA SE IMPORTA, NO SE COPIA. Vive en `picking.js` desde que se
   midio sobre nueve archivos reales, y escribirla otra vez aca seria tener dos
   verdades que un dia se separan. */
import { EQUIVALENCIA_PREPACK } from './picking.js?v=29.0599';

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
/* LOS FACTORES VAN CON DOS DECIMALES. Con uno, el 1,83 que Daniel tiene en la
   cabeza salia escrito "1,8" y el 1,28 salia "1,3": el numero deja de ser
   reconocible y parece otro. */
const n2 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–';
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

/* ══════════════════════════════════════════════════════════════════════════
   LAS TRES MANERAS DE MIRAR EL CALZADO
   ══════════════════════════════════════════════════════════════════════════

   Daniel, 02-sep-2026: *"estamos mezclando ahi mercaderia que no es lo mismo.
   Un par es lo mismo que picar un solid, que es un par; no es lo mismo que picar
   un prepack, que es una caja, pero dentro de la caja vienen diez pares, o
   dependiendo de la curva ocho, seis... Ponme dos pildoras, solid y prepack, y en
   base a eso el filtro que se recalcule. Y me pones un tercero con el calculo del
   uno punto ochenta y tres"*.

   SOLID        pares por hora. Aca un pick es un par, asi que el par SI mide el
                trabajo. Es el numero que se compara contra el piso de 100.
   PREPACK      CAJAS por hora, no pares. Un pick es una caja; contar sus pares
                seria decir que sacar una caja de diez cuesta diez veces mas, y
                esta medido que no: el trabajo es llegar al sitio, no levantarla.
   EQUIVALENTE  los dos juntos, con el prepack pesando lo que de verdad cuesta.
                Un pick suelto vale 1; una caja vale su factor medido. Es la unica
                forma de tener UN numero sin mentir.

   EL FACTOR SALE DE LA TABLA MEDIDA, no de un numero puesto a mano: un pick
   suelto tarda 18 s (mediana de 79.770) y una caja de diez, 33 s -> 1,83. Pero
   1,83 es LA CAJA DE DIEZ, y este CD promedia 6,95 pares por caja: sobre lo
   publicado, la curva que manda es la de 7, con factor 1,28. Se usa el factor de
   la curva promedio de esa semana y el cuadro dice cual aplico. */
const MODOS = {
    solid: {
        eti: 'Solid', unidad: 'pares', que: 'pares por hora',
        valor: (x) => (x.solid.horas > 0 ? x.solid.pares / x.solid.horas : 0),
        arriba: (x) => x.solid.pares, horas: (x) => x.solid.horas,
        piso: true,
    },
    prepack: {
        eti: 'Prepack', unidad: 'cajas', que: 'cajas por hora',
        valor: (x) => (x.prepack.horas > 0 ? x.prepack.picks / x.prepack.horas : 0),
        arriba: (x) => x.prepack.picks, horas: (x) => x.prepack.horas,
        piso: false,
    },
    equivalente: {
        eti: 'Equivalente', unidad: 'picks equiv.', que: 'picks equivalentes por hora',
        valor: (x) => {
            const h = MODOS.equivalente.horas(x);
            return h > 0 ? (x.solid.picks + x.prepack.picks * factorDe(x)) / h : 0;
        },
        arriba: (x) => x.solid.picks + x.prepack.picks * factorDe(x),
        /* AHORA SE SUMAN, y ya no hace falta unir nada: cada tarea aporta sus
           minutos una sola vez y una tarea es de una clase o de otra. El problema
           de contar doble era del metodo viejo, que unia TRAMOS y hacia que el
           rato de alternar cayera dentro de las dos clases. */
        horas: (x) => x.solid.horas + x.prepack.horas,
        piso: false,
    },
};

/** El factor que le toca al prepack de ese periodo, segun su curva promedio. */
const factorDe = (x) => {
    if (!x.prepack.picks) return EQUIVALENCIA_PREPACK.factor_general;
    const curva = Math.round(x.prepack.pares / x.prepack.picks);
    const c = EQUIVALENCIA_PREPACK.curvas[curva];
    return c ? c.usa : EQUIVALENCIA_PREPACK.factor_general;
};

/** La curva promedio, para poder decirla en pantalla. */
const curvaDe = (x) => (x.prepack.picks ? x.prepack.pares / x.prepack.picks : 0);

/* Que modo se esta mirando. Es de modulo para que sobreviva al redibujado que
   hace la propia pildora. */
let _modo = 'solid';
let _cont = null;
let _OPC = null;

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

/* LAS LINEAS DE UNA CLASE: cuantos PICKS hizo la gente.
 *
 * En el suelto una linea es un par —el 70% saca uno solo—; en el prepack una
 * linea es UNA CAJA, y adentro vienen entre 4 y 12 pares. Por eso los pares del
 * prepack no se pueden comparar con los del suelto, que es justo lo que Daniel
 * vino a decir: *"un par no es lo mismo que picar un prepack, que es una caja"*. */
const lineasDe = (vista, clases) => {
    let n = 0;
    (vista.gente || []).forEach(p => {
        const t = p.total || {};
        clases.forEach(c => { n += Number(t[c + '_l']) || 0; });
    });
    return n;
};

/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║ LAS HORAS: LO QUE DICE EL WMS, SUMADO. NADA MAS.                        ║
   ╚══════════════════════════════════════════════════════════════════════════╝

   Daniel, 02-sep-2026: *"tu deberias sacar lo que dice el WMS, no te debieras de
   inventar nada. La tarea uno se hizo de nueve a diez, ahi son sesenta minutos.
   La segunda de diez y diez a las once, cincuenta. En total ciento diez"*.

   CADA TAREA APORTA (ULTIMO PICK - PRIMER PICK), Y SE SUMAN TODAS. Punto.

   Lo que habia antes y ya no esta:
     · UN PUENTE DE 15 MINUTOS que fusionaba tareas cercanas y regalaba al calculo
       los huecos cortos. Me lo habia inventado yo.
     · DESCONTAR LOS SOLAPES. Daniel: *"si la otra tarea esta dentro de esa tarea,
       tu sigue acumulando el dato nada mas. Seis minutos, sumale. No importa si
       esta dentro o afuera"*. Con numeros de tarea reales solo se pisa el 1,6%,
       asi que tampoco cambia gran cosa.

   SOLO LAS LINEAS CON NUMERO DE TAREA. El 34,4% no lo trae y antes se les ponia
   el numero de contenedor como apaño; eso partia una tarea en varias y hacia que
   el 48,7% pareciera pisarse — un solape que inventaba mi forma de agrupar, no el
   almacen. Daniel: *"dejalas fuera"*.

   Y POR ESO LOS PARES DE ESTA PANTALLA SON `_q`, NO LOS TOTALES DEL DIA: si se
   descartan esas lineas del tiempo hay que descartarlas tambien de los pares, o
   el ritmo sale inflado. Son el 20,4% de los pares. Los totales que muestra
   Picking por dia NO cambian: ahi se sigue contando todo.

   El robot ya publica los dos numeros por persona y por clase: `<clase>_s` son
   los segundos sumados y `<clase>_q` los pares de esas mismas lineas. */
const horasDe = (vista, clases) => {
    let seg = 0;
    (vista.gente || []).forEach(p => {
        const t = p.total || {};
        clases.forEach(c => { seg += Number(t[c + '_s']) || 0; });
    });
    return seg / 3600;
};

/** Los pares que van con esas horas: solo los de lineas con numero de tarea. */
const paresDe = (vista, clases) => {
    let q = 0;
    (vista.gente || []).forEach(p => {
        const t = p.total || {};
        clases.forEach(c => { q += Number(t[c + '_q']) || 0; });
    });
    return q;
};

/** Un día de un lado: pares y horas de cada tipo. */
const resumirDia = (entrada) => {
    const d = (entrada && entrada.datos) || {};
    const v = (d.vistas && d.vistas.TODOS) || {};
    const t = v.totales || {};
    const o = { fecha: entrada.fecha };
    Object.keys(TIPOS).forEach(k => {
        const cl = TIPOS[k].clases;
        /* LOS PARES VAN CON SUS HORAS. `paresDe` cuenta solo las lineas con
           numero de tarea, que son las mismas que aportan tiempo; usar el total
           del dia contra esas horas inflaria el ritmo un 25%. */
        o[k] = { pares: paresDe(v, cl), horas: horasDe(v, cl),
                 paresTodos: cl.reduce((s2, c) => s2 + (Number(t[c]) || 0), 0) };
    });
    /* El calzado, abierto: suelto y prepack cada uno con sus pares, sus picks y
       sus horas. Son dos trabajos distintos y se miden por separado. */
    o.solid = { pares: paresDe(v, ['cal_suelto']),
                picks: lineasDe(v, ['cal_suelto']),
                horas: horasDe(v, ['cal_suelto']) };
    o.prepack = { pares: paresDe(v, ['cal_prepack']),
                  picks: lineasDe(v, ['cal_prepack']),
                  horas: horasDe(v, ['cal_prepack']) };
    o.suelto = o.solid.pares;
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
'#pp .pp-pastillas { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 12px; }',
'#pp .pp-pastilla { border:1px solid var(--border); background:rgba(var(--ink-rgb), 0.03); color:var(--text-muted); border-radius:999px; padding:6px 15px; font-size:var(--t-xs); font-weight:800; cursor:pointer; font-family:inherit; letter-spacing:0.02em; }',
'#pp .pp-pastilla:hover { border-color:rgba(var(--ink-rgb), 0.25); color:var(--text-main); }',
'#pp .pp-pastilla.pp-viva { background:var(--text-strong); border-color:var(--text-strong); color:var(--panel-deep); }',
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

    /* SE GUARDAN PARA PODER REDIBUJAR AL CAMBIAR DE PILDORA. La pildora no pide
       nada al servidor: los dias ya estan en memoria y lo unico que cambia es que
       se mira de ellos, asi que el cambio es instantaneo. */
    _cont = cont;
    if (OPC) _OPC = OPC;
    const O = _OPC || {};
    const dias = { p: {}, e: {} };
    (O.picking || []).forEach(x => { const d = resumirDia(x); dias.p[d.fecha] = d; });
    (O.embalaje || []).forEach(x => { const d = resumirDia(x); dias.e[d.fecha] = d; });

    const fechas = Array.from(new Set(
        Object.keys(dias.p).concat(Object.keys(dias.e)))).sort();

    /* ¿LOS DÍAS TRAEN EL TIEMPO? Desde v29.0566 el ritmo se saca de `<clase>_s`,
       que publica el robot. Un día calculado antes de ese cambio no lo tiene, y
       sin tiempo no hay ritmo: la pantalla salía entera en blanco diciendo "no
       hay semanas cerradas", que se lee como que no hay datos.

       Pasa mientras el robot rehace el histórico —son unos 35 minutos— y pasaría
       otra vez el día que se cambie la regla del tiempo. Vale más decirlo. */
    const conTiempo = (O.picking || []).concat(O.embalaje || []).some(x => {
        const g = (((x.datos || {}).vistas || {}).TODOS || {}).gente || [];
        return g.some(p => Object.keys(p.total || {}).some(k => k.endsWith('_s')));
    });
    if (fechas.length && !conTiempo) {
        cont.innerHTML = '<style>' + CSS + '</style><div id="pp"><div class="pp-vacio">'
            + '<b>Los días guardados todavía no traen el tiempo trabajado.</b><br><br>'
            + 'Desde el 02-sep-2026 el ritmo se mide con los minutos que suma cada tarea, y '
            + 'ese dato lo tiene que publicar el robot del servidor. Los ' + fechas.length
            + ' días de este rango se calcularon antes del cambio.<br><br>'
            + 'Cuando el robot termine de rehacer el histórico —unos 35 minutos— este cuadro '
            + 'se llena solo. Los pares del día no se ven afectados: Picking por día y Embalaje '
            + 'por día siguen mostrando todo.'
            + '</div></div>';
        return;
    }

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
        const o = { dias: 0, sinTipo: 0 };
        Object.keys(TIPOS).forEach(k => { o[k] = { pares: 0, horas: 0 }; });
        /* El calzado, ademas, abierto en sus dos formas y con los PICKS: sin los
           picks no se puede saber cuantas cajas fueron ni pesar la equivalencia. */
        o.solid = { pares: 0, picks: 0, horas: 0 };
        o.prepack = { pares: 0, picks: 0, horas: 0 };
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
            ['solid', 'prepack'].forEach(k => {
                w[lado][k].pares += d[k].pares;
                w[lado][k].picks += d[k].picks;
                w[lado][k].horas += d[k].horas;
            });
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

    /* EL CALZADO SE MIRA CON EL MODO ELEGIDO -solid, prepack o equivalente-; el
       resto de las categorias no tiene modos y va como siempre. */
    const serieDe = (cfg) => {
        const esCal = cfg.tipo === 'cal';
        const M = esCal ? MODOS[_modo] : null;
        const T = esCal
            ? { unidad: M.unidad, que: M.que }
            : TIPOS[cfg.tipo];
        const puntos = orden.map(w => {
            const lado = w[cfg.lado];
            const x = lado[cfg.tipo];
            const arriba = esCal ? M.arriba(lado) : x.pares;
            const horas = esCal ? M.horas(lado) : x.horas;
            return {
                clave: w.clave, sem: w.sem, lunes: w.lunes,
                pares: arriba, horas: horas,
                ritmo: horas > 0 ? arriba / horas : 0,
                dias: lado.dias,
                solid: lado.solid, prepackCaja: lado.prepack,
                curva: esCal ? curvaDe(lado) : 0,
                factor: esCal ? factorDe(lado) : 0,
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

        /* LAS PILDORAS SOLO EN CALZADO: son las dos formas de picar un zapato.
           No calzado y materiales no se separan asi. */
        if (c.tipo === 'cal') {
            T.push('<div class="pp-pastillas">'
                + Object.keys(MODOS).map(k =>
                    '<button type="button" class="pp-pastilla' + (k === _modo ? ' pp-viva' : '')
                    + '" onclick="window.__ppModo(&quot;' + k + '&quot;)">'
                    + MODOS[k].eti + '</button>').join('')
                + '</div>');
        }

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
                : (_modo === 'solid'
                    ? '. Solo el <b>solid</b>: acá un pick es un par, así que el par sí mide el '
                    + 'trabajo. Es el número que se compara contra el piso.'
                  : _modo === 'prepack'
                    ? '. Solo el <b>prepack</b>, y en <b>cajas</b>, no en pares: un pick es una '
                    + 'caja. Contar sus pares diría que sacar una caja de diez cuesta diez veces '
                    + 'más, y está medido que no — el trabajo es llegar al sitio, no levantarla.'
                    : '. Los dos juntos, con el prepack pesando lo que de verdad cuesta: un pick '
                    + 'suelto vale 1 y una caja vale su factor medido.'))
            + '</p>');

        T.push('<div class="pp-cajas">'
        + caja('Cierre semana ' + r.ultima.sem, nf(r.ultima.ritmo), uni + '/h',
               nf(r.ultima.pares) + ' ' + uni + ' en ' + nf(r.ultima.horas) + ' h · '
               + r.ultima.dias + (r.ultima.dias === 1 ? ' día' : ' días')
               /* EN PREPACK Y EQUIVALENTE VA LA CURVA A LA VISTA: es lo que decide
                  el factor, y sin ella el número no se puede auditar. */
               + (c.tipo === 'cal' && _modo !== 'solid' && r.ultima.curva
                   ? '<br>' + n1(r.ultima.curva) + ' pares por caja'
                     + (_modo === 'equivalente' ? ' · factor ' + n2(r.ultima.factor) : '')
                   : ''))
        + (r.anterior ? caja('Cierre semana ' + r.anterior.sem, nf(r.anterior.ritmo), uni + '/h',
               nf(r.anterior.pares) + ' ' + uni + ' en ' + nf(r.anterior.horas) + ' h · '
               + r.anterior.dias + (r.anterior.dias === 1 ? ' día' : ' días')) : '')
        + caja('Últimas 4 semanas', nf(r.prom4), uni + '/h', 'promedio')
        + caja('Promedio general', nf(r.promTodas), uni + '/h',
               r.cerradas.length + ' semanas cerradas')
        /* ESTAS DOS CAJAS PARECEN CONTRADECIRSE Y NO LO HACEN. Daniel, 02-sep:
           *"me dices que baja cada semana 1,4 y al final que sobre el piso esta
           +18,7%. No me cuadra"*. Una dice HACIA DONDE VA y la otra DONDE ESTA:
           se puede ir bajando y seguir muy por encima del piso. Ahora cada una
           lo dice en su pie. */
        + caja((sube ? 'Sube cada semana' : 'Baja cada semana'),
               (sube ? '+' : '−') + n1(Math.abs(r.pendiente)), '',
               uni + '/h por semana<br><b>hacia dónde va</b>',
               sube ? '#16a34a' : '#dc2626')
        /* CONTRA EL PISO, cuando la categoria tiene uno comprometido. Va con la
           ultima semana cerrada y no con el promedio: lo que importa es como se
           esta cerrando ahora. */
        + (c.piso && (c.tipo !== 'cal' || _modo === 'solid')
            ? caja('Sobre el piso de ' + nf(c.piso),
                   (r.ultima.ritmo >= c.piso ? '+' : '−')
                   + n1(Math.abs(r.ultima.ritmo - c.piso) * 100 / c.piso) + '%', '',
                   'la semana ' + r.ultima.sem + ' cerró en ' + nf(r.ultima.ritmo) + ' ' + uni
                   + '/h<br><b>dónde está hoy</b>',
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
        if (c.piso && (c.tipo !== 'cal' || _modo === 'solid') && !sube) {
            linea.push('<b>Que baje y que esté sobre el piso no se contradicen</b>: la '
                + 'pendiente dice hacia dónde va y el piso dice dónde está. Se puede venir '
                + 'aflojando de a poco y seguir muy por encima de lo comprometido.');
        }
        if (c.piso && (c.tipo !== 'cal' || _modo === 'solid')) {
            const bajo = r.cerradas.filter(p => p.ritmo < c.piso);
            linea.push('El gráfico arranca en <b>Origen</b>, que son los <b>' + nf(c.piso)
                + ' ' + uni + '/h</b> que comprometió picking — el punto rojo —; de ahí en '
                + 'adelante va lo que se picó de verdad.'
                + (bajo.length
                    ? ' <b>' + bajo.length + (bajo.length === 1 ? ' semana cerró' : ' semanas cerraron')
                      + ' por debajo</b>: ' + bajo.map(p => 'S' + p.sem + ' con ' + nf(p.ritmo)).join(', ') + '.'
                    : ' Ninguna semana cerrada cayó por debajo.'));
        }
        if (c.tipo === 'cal' && _modo === 'equivalente' && r.ultima.curva) {
            const diez = EQUIVALENCIA_PREPACK.curvas[10];
            linea.push('El factor sale de la tabla medida: un pick suelto tarda <b>'
                + EQUIVALENCIA_PREPACK.segundos_suelto + ' s</b> (mediana de '
                + nf(EQUIVALENCIA_PREPACK.muestra_suelto) + ' picks) y una caja de diez, <b>'
                + diez.seg + ' s</b> — de ahí el <b>' + n2(diez.factor) + '</b>. '
                + 'Pero <b>este CD promedia ' + n1(r.ultima.curva) + ' pares por caja</b>, así '
                + 'que la semana ' + r.ultima.sem + ' se pesó con <b>' + n2(r.ultima.factor)
                + '</b>, que es el factor medido para esa curva.');
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
    + '<p class="pp-sub">El ritmo de cada semana en <b>unidades por hora</b>, y al lado las '
    + 'horas-persona con que se calculó. Los pares y las horas salen del archivo del WMS: el '
    + 'ritmo es la división de los dos, no un promedio de días.<br>'
    /* Daniel, 02-sep: *"en la S31 hacemos 219 horas y de ahi saltas a la S32 con 588
       y a la S33 con 895. No me esta cuadrando"*. Las horas saltan porque saltan
       los dias y la gente, y ESA es la razon de medir por hora y no por semana. */
    + '<b>Las horas saltan mucho de una semana a otra, y está bien</b>: unas tienen seis días y '
    + 'otras cinco o dos, y entra distinta cantidad de gente. Por eso el cuadro mide <b>por '
    + 'hora</b> y no por semana — el ritmo se queda quieto aunque las horas se muevan.</p>'
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

    window.__ppModo = (m) => {
        if (!MODOS[m] || m === _modo) return;
        _modo = m;
        /* Se redibuja con lo que ya hay: `montarProduccionProyeccion` sin OPC
           reusa `_OPC`. Se conserva a donde estaba mirando la pagina para que no
           salte al principio al apretar la pildora. */
        const y = window.scrollY;
        montarProduccionProyeccion(_cont, null);
        window.scrollTo(0, y);
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
        /* EL PISO SOLO EN SOLID. Los 100 que comprometio picking son PARES
           PICADOS; ponerlos de referencia contra cajas por hora o contra picks
           equivalentes seria comparar cosas distintas. */
        const conPiso = !!r.cfg.piso && (r.cfg.tipo !== 'cal' || _modo === 'solid');
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
