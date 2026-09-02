/**
 * PICKING → PRODUCCIÓN PICKING EMBALAJE
 *
 * Lo pidió Daniel el 02-sep-2026: *"que me hagas un cálculo de cuánto se demora,
 * en cuánto va creciendo el picking por día, desde el historial que tenemos...
 * Quiero saber cuánto se demora por categoría, por gender, por calzado, no
 * calzado, promotional. Anda armándome la proyección"*. Y enseguida: *"En ese
 * módulo de productividad de picking y embalaje necesito gráficos"*.
 *
 * LOS METROS QUE CAMINA EL PICKER QUEDAN PARA DESPUÉS. Los dejó fuera él mismo:
 * *"se me hace interesante decirte cuántos metros recorre... pero eso lo dejamos
 * para después"*.
 *
 * ESTE ARCHIVO NO LEE DEL SERVIDOR. Recibe `OPC.picking` y `OPC.embalaje` —los
 * días ya bajados de las áreas `picking_por_hora` y `embalaje_por_hora`— y solo
 * calcula y dibuja. Igual que `produccion_hora.js` y `pendiente.js`.
 *
 * TODO EL CSS VA ENCERRADO BAJO `#pp` Y LOS IDS LLEVAN PREFIJO `pp_`, por lo
 * mismo que en `produccion_hora.js`: los nombres cortos —card, barra, nota—
 * chocarían con los del tablero.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ EL CRECIMIENTO SE MIDE EN LÍNEAS, NO EN PARES. Esto no es un detalle:    ║
 * ║ es lo único que hace que este cuadro sirva.                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * La primera versión de esta pantalla medía en pares, y decía que del 24 al 28
 * de agosto el CD había TRIPLICADO la producción: de 40.000 pares por día a
 * 124.000. Es mentira. Las líneas de esos días son las de siempre —entre 11.000
 * y 17.000, como los 31 días anteriores— y todo el salto está en NO CALZADO:
 *
 *     24-ago   13.244 líneas   ·   17.436 calzado suelto   ·   98.321 no calzado
 *     21-ago   11.231 líneas   ·   14.621 calzado suelto   ·    6.098 no calzado
 *
 * El calzado suelto ni se movió. Lo que se movió es que en no calzado la unidad
 * del WMS no es un par: son bolsas, medias, cajas de accesorio. Sumarlas como
 * pares infla el total sin que nadie haya trabajado más.
 *
 * LA LÍNEA ES LA TAREA. Un picker va a una ubicación, saca lo que le piden y
 * confirma: eso es una línea, y cuesta más o menos lo mismo sea un par de
 * zapatos o una bolsa de medias. Por eso el ritmo en líneas por persona-hora sale
 * plano —entre 46 y 66 en los 31 días— y el de pares salta de 105 a 472.
 *
 * Los pares SIGUEN ESTANDO, abiertos por categoría, que es donde dicen algo. Lo
 * que no se hace es mezclarlos en un solo número de crecimiento.
 *
 * ═══ OTRAS DOS COSAS AL LEER EL CUADRO ═══
 *
 * 1. LOS DÍAS DE JULIO DEL EMBALAJE SON PARCIALES, LOS DEL PICKING NO. El
 *    archivo más viejo del OBLPN es del 1 de agosto, así que de julio solo
 *    quedaron las líneas sueltas que ese archivo arrastraba (30-07: 4.804 líneas
 *    contra las ~12.000 de un día normal). El picking sí tiene julio completo
 *    —cada archivo trae su día entero—, así que la marca va POR LADO y no por
 *    fecha: marcar el picking de julio escondería días buenos.
 *
 * 2. EL DOMINGO NO SE TRABAJA. Un domingo en cero arrastra el promedio y aplana
 *    la tendencia. Los días sin movimiento quedan fuera de los promedios y de la
 *    proyección, pero SE SIGUEN VIENDO en el cuadro: esconderlos daría la
 *    impresión de que falta información.
 *
 * OPC = {
 *   picking:  [{fecha, datos}] de `picking_por_hora`
 *   embalaje: [{fecha, datos}] de `embalaje_por_hora`
 *   desde, hasta: el rango elegido, 'AAAA-MM-DD'
 *   alCambiarRango: (desde, hasta) => {}
 * }
 */

import { resolverColoresChart } from '../services_v245/temaService.js?v=29.0552';
import { selectorRango } from '../services_v245/reportesComunes.js?v=29.0552';

const nf = (n) => (n || n === 0) ? Math.round(Number(n)).toLocaleString('es-PE') : '–';
const n1 = (n) => (n || n === 0) ? Number(n).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–';
const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/* EL EMBALAJE NO TIENE JULIO COMPLETO. Ver la cabecera. */
const EMBALAJE_DESDE = '2026-08-01';

/* LA FECHA SE PARTE A MANO, NO CON `new Date(iso)`. Un 'AAAA-MM-DD' suelto se
   interpreta como UTC y en Lima retrocede al día anterior: el 1 de agosto se
   dibujaría como 31 de julio. Misma trampa que `toISOString()`, al revés. */
const partir = (f) => {
    const p = String(f || '').split('-');
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
};
const diaSemana = (f) => partir(f).getDay();
const corta = (f) => {
    const d = partir(f);
    return d.getDate() + ' ' + MESES[d.getMonth()];
};
const etiquetaDia = (f) => DIAS_SEMANA[diaSemana(f)] + ' ' + corta(f);
const aISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');

/* ══════════════════════════════════════════════════════════════════════════
   LA CUENTA
   ══════════════════════════════════════════════════════════════════════════ */

/* LAS TRES CATEGORÍAS QUE HOY SE PUEDEN SEPARAR.
 *
 * Salen del Maestro: el robot mira `G. Gender` y todo lo que NO es Footwear cae
 * en `no_cal`. Así que hoy "promotional" está ADENTRO de no calzado y no se
 * puede abrir desde acá — habría que volver a pasar los archivos del WMS en el
 * servidor. El cuadro lo dice donde se ve; no lo esconde.
 *
 * Si algún día el robot publica `gender` abierto, `categorias()` lo usa solo y
 * esta pantalla no se toca. */
const CLASES = [
    { id: 'cal_suelto',  eti: 'Calzado suelto',  color: '#6366f1' },
    { id: 'cal_prepack', eti: 'Calzado prepack', color: '#22c55e' },
    { id: 'no_cal',      eti: 'No calzado',      color: '#f59e0b' }
];

const PALETA = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'];

const categorias = (vista) => {
    const g = vista && vista.gender;
    if (g && typeof g === 'object' && Object.keys(g).length) {
        return Object.keys(g).sort().map((k, i) => ({
            id: k, eti: k, color: PALETA[i % PALETA.length], valor: Number(g[k]) || 0
        }));
    }
    const t = (vista && vista.totales) || {};
    return CLASES.map(c => ({ id: c.id, eti: c.eti, color: c.color, valor: Number(t[c.id]) || 0 }));
};

/* CUÁNTAS PERSONAS-HORA SE TRABAJARON.
 *
 * Se suma la gente que tuvo movimiento en cada hora, NO la gente del día. Dos
 * pickers de cuatro horas cada uno son ocho personas-hora, y con eso el ritmo se
 * puede comparar entre un día de doce personas y otro de cuatro. Contar
 * "personas del día" mezclaría al que estuvo el turno entero con el que entró una
 * hora, y el día corto saldría siempre peor. */
const personasHora = (vista) => {
    const ph = (vista && vista.por_hora) || {};
    let s = 0;
    Object.keys(ph).forEach(h => { s += Number((ph[h] || {}).personas) || 0; });
    return s;
};

const gentePorDia = (vista) => {
    const g = vista && vista.gente;
    if (Array.isArray(g)) return g.length;
    if (g && typeof g === 'object') return Object.keys(g).length;
    return 0;
};

/** Un día de un lado, resumido. */
const resumirDia = (entrada) => {
    const d = (entrada && entrada.datos) || {};
    const v = (d.vistas && d.vistas.TODOS) || {};
    const t = v.totales || {};
    return {
        fecha: entrada.fecha,
        lineas: Number(t.lineas) || 0,
        pares: Number(t.total) || 0,
        gente: gentePorDia(v),
        ph: personasHora(v),
        cat: categorias(v)
    };
};

/* LA RECTA DE LA TENDENCIA, por mínimos cuadrados.
 *
 * La `x` es la posición del día dentro de los días TRABAJADOS, no la fecha: si
 * fuera la fecha, cada domingo saltado metería un hueco y la recta saldría más
 * plana de lo que es. Devuelve null con menos de tres días, que es donde una
 * recta ya no dice nada. */
const tendencia = (valores) => {
    const n = valores.length;
    if (n < 3) return null;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += valores[i]; sxy += i * valores[i]; sxx += i * i; }
    const den = n * sxx - sx * sx;
    if (!den) return null;
    const b = (n * sxy - sx * sy) / den;
    return { a: (sy - b * sx) / n, b: b, en: (i) => ((sy - b * sx) / n) + b * i };
};

const promedio = (v) => v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;

/* ══════════════════════════════════════════════════════════════════════════
   EL DIBUJO
   ══════════════════════════════════════════════════════════════════════════ */

const CSS = [
'#pp { --pp-pick:#6366f1; --pp-emb:#22c55e; }',
/* LA CABECERA SE PARTE, NO EMPUJA. Sin el `min-width:0` el bloque del titulo no
   puede achicarse por debajo de su texto, el rango de fechas no baja de linea y
   la PAGINA ENTERA queda con barra horizontal: en una laptop de 1.366 se veia
   media caja de avisos cortada. */
'#pp .pp-cab { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }',
'#pp .pp-cab > .pp-quien { flex:1 1 280px; min-width:0; }',
'#pp .pp-cab h2 { margin:0 0 5px; font-size:var(--t-xl); font-weight:800; color:var(--text-strong); text-wrap:balance; }',
'#pp .pp-cab .pp-cuantos { font-size:var(--t-xs); color:var(--text-muted); }',
'#pp .pp-cab .rango-fechas { flex:0 0 auto; }',
'#pp .pp-caja { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; padding:18px 20px; margin-bottom:18px; }',
'#pp .pp-titulo { font-size:var(--t-xs); font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-muted); margin:0 0 4px; }',
'#pp .pp-sub { font-size:var(--t-xs); color:var(--text-muted); margin:0 0 14px; line-height:1.6; }',
'#pp .pp-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(215px, 1fr)); gap:14px; margin-bottom:18px; }',
'#pp .pp-card { background:var(--panel-deep); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }',
'#pp .pp-card .rot { font-size:var(--t-xs); font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px; }',
'#pp .pp-card .cifra { font-size:26px; font-weight:800; color:var(--text-strong); line-height:1.1; font-variant-numeric:tabular-nums; }',
'#pp .pp-card .uni { font-size:12px; font-weight:700; color:var(--text-muted); margin-left:4px; }',
'#pp .pp-card .pie { font-size:var(--t-xs); color:var(--text-muted); margin-top:7px; line-height:1.55; }',
'#pp .pp-sube { color:var(--success); font-weight:800; }',
'#pp .pp-baja { color:var(--warning); font-weight:800; }',
'#pp .pp-graf { position:relative; height:300px; width:0; min-width:100%; }',
'#pp .pp-dos { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px; }',
/* NADA DE ESTA PANTALLA PUEDE EMPUJAR LA PÁGINA A LO ANCHO.
   La tabla del día por día son diez columnas que no se parten, y su ancho mínimo
   —922 px medidos— se contagiaba hacia arriba: `#pp` se estiraba a 963, los
   gráficos se dibujaban de 921 y LA PÁGINA ENTERA salía con barra horizontal. En
   una laptop de 1.366 se veía media caja de avisos cortada.
   `overflow-x:auto` por sí solo NO alcanza: el recuadro sigue reclamando el ancho
   de su contenido. El par `width:0` + `min-width:100%` sí: el ancho propio pasa a
   ser cero —así no reclama nada— y después se estira al 100% del padre. La tabla
   scrollea adentro y los gráficos se dibujan del tamaño que hay. */
'#pp .pp-scroll { overflow-x:auto; width:0; min-width:100%; }',
'#pp, #pp .pp-caja, #pp .pp-card { max-width:100%; min-width:0; }',
'#pp table.pp-tabla { width:100%; border-collapse:collapse; font-size:var(--t-xs); font-variant-numeric:tabular-nums; }',
'#pp table.pp-tabla th { text-align:right; padding:9px 10px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid var(--border); white-space:nowrap; font-size:10.5px; }',
'#pp table.pp-tabla th.pp-grupo { text-align:center; border-bottom:1px solid var(--border); padding-bottom:5px; }',
'#pp table.pp-tabla th:first-child, #pp table.pp-tabla td:first-child { text-align:left; }',
'#pp table.pp-tabla td { padding:8px 10px; text-align:right; color:var(--text-main); border-bottom:1px solid rgba(var(--ink-rgb), 0.06); white-space:nowrap; }',
'#pp table.pp-tabla td.pp-sep, #pp table.pp-tabla th.pp-sep { border-left:1px solid var(--border); }',
'#pp table.pp-tabla tr.pp-libre td { color:var(--text-muted); font-style:italic; }',
'#pp table.pp-tabla tfoot td { font-weight:800; color:var(--text-strong); border-top:2px solid var(--border); border-bottom:none; padding-top:11px; }',
'#pp .pp-aviso { background:rgba(var(--warning-rgb), 0.10); border:1px solid rgba(var(--warning-rgb), 0.35); border-radius:11px; padding:13px 16px; font-size:var(--t-xs); color:var(--text-main); line-height:1.65; margin-bottom:18px; }',
'#pp .pp-vacio { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:var(--t-sm); line-height:1.7; }',
'#pp .pp-leyenda { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; font-size:var(--t-xs); color:var(--text-muted); }',
'#pp .pp-leyenda i { width:11px; height:11px; border-radius:3px; display:inline-block; margin-right:6px; vertical-align:-1px; }',
'#pp .pp-proy { display:grid; grid-template-columns:repeat(auto-fit, minmax(148px, 1fr)); gap:12px; margin-top:14px; }',
'#pp .pp-proy .pp-p { background:var(--panel-deeper); border:1px solid var(--border); border-radius:11px; padding:12px 14px; }',
'#pp .pp-proy .d { font-size:var(--t-xs); color:var(--text-muted); font-weight:700; }',
'#pp .pp-proy .v { font-size:19px; font-weight:800; color:var(--text-strong); font-variant-numeric:tabular-nums; margin-top:4px; }',
'#pp .pp-nota { font-size:var(--t-xs); color:var(--text-muted); line-height:1.65; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }'
].join('\n');

/* LOS GRÁFICOS SE SUELTAN ANTES DE REDIBUJAR. Chart.js se queda con el canvas y
   con los escuchas del mouse; sin `destroy()` cada cambio de rango deja uno vivo
   y a la quinta vuelta la pantalla se arrastra. */
let _graficos = [];
const soltarGraficos = () => {
    _graficos.forEach(g => { try { g.destroy(); } catch (e) { /* ya estaba muerto */ } });
    _graficos = [];
};

export function montarProduccionProyeccion(cont, OPC) {
    if (!cont) return;
    soltarGraficos();

    const O = OPC || {};
    const pick = (O.picking || []).map(resumirDia).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    const emb = (O.embalaje || []).map(resumirDia).sort((a, b) => a.fecha < b.fecha ? -1 : 1);

    const porFecha = {};
    const meter = (lista, lado) => lista.forEach(d => {
        porFecha[d.fecha] = porFecha[d.fecha] || { fecha: d.fecha };
        porFecha[d.fecha][lado] = d;
    });
    meter(pick, 'p');
    meter(emb, 'e');
    const filas = Object.keys(porFecha).sort().map(f => porFecha[f]);

    if (!filas.length) {
        cont.innerHTML = '<style>' + CSS + '</style><div id="pp"><div class="pp-vacio">'
            + 'No hay días guardados en este rango.<br>'
            + 'Los publica el robot del servidor todas las noches, en Picking por día y Embalaje por día.'
            + '</div></div>';
        return;
    }

    /* QUÉ CUENTA COMO DÍA TRABAJADO. No alcanza con "tiene una fila": un día con
       doscientas líneas es un rezago, no una jornada. El corte va en el 20% de la
       mediana de las líneas, que separa limpio los domingos y los parciales sin
       dejar afuera ningún día real.

       LA MARCA DE PARCIAL VA POR LADO: el embalaje no tiene julio completo y el
       picking sí. Ver la cabecera del archivo. */
    const lineasPick = pick.map(d => d.lineas).filter(x => x > 0).sort((a, b) => a - b);
    const medianaP = lineasPick.length ? lineasPick[Math.floor(lineasPick.length / 2)] : 0;
    const CORTE = medianaP * 0.2;

    filas.forEach(f => {
        if (f.p) f.p.vale = CORTE > 0 && f.p.lineas >= CORTE;
        if (f.e) {
            f.e.parcial = f.fecha < EMBALAJE_DESDE;
            f.e.vale = CORTE > 0 && f.e.lineas >= CORTE && !f.e.parcial;
        }
        f.trabajado = !!((f.p && f.p.vale) || (f.e && f.e.vale));
    });

    const dP = filas.filter(f => f.p && f.p.vale);
    const dE = filas.filter(f => f.e && f.e.vale);
    const buenos = filas.filter(f => f.trabajado);
    const hayParciales = filas.some(f => f.e && f.e.parcial);

    // ─── LAS SERIES. TODO EN LÍNEAS. ─────────────────────────────────────────
    const serieP = dP.map(f => f.p.lineas);
    const serieE = dE.map(f => f.e.lineas);
    const promP = promedio(serieP);
    const promE = promedio(serieE);

    /* EL CRECIMIENTO SE MIDE ENTRE SEMANAS, NO ENTRE DÍAS. De un día al siguiente
       manda el tamaño del pedido, no el ritmo del equipo. A seis días trabajados
       por semana, comparar los últimos seis contra los seis anteriores ya deja
       ver si el CD viene levantando o cayendo. */
    const VENTANA = 6;
    const ventanas = (serie) => {
        const u = serie.slice(-VENTANA);
        const p = serie.slice(-VENTANA * 2, -VENTANA);
        const au = promedio(u), ap = promedio(p);
        return { au: au, ap: ap, crece: (p.length >= 3 && ap > 0) ? (au - ap) / ap : null };
    };
    const vP = ventanas(serieP);
    const vE = ventanas(serieE);

    const tP = tendencia(serieP);
    const tE = tendencia(serieE);

    /* EL PORCENTAJE NUNCA VA SOLO: al lado va la diferencia en líneas por día. Un
       "12% más" no dice nada si no se sabe si son 200 líneas o 2.000. */
    const flecha = (v, ant, act, uni) => {
        if (v === null) return '<span style="color:var(--text-muted);">Faltan días para comparar</span>';
        const arriba = v >= 0;
        return '<span class="' + (arriba ? 'pp-sube' : 'pp-baja') + '">'
            + (arriba ? '▲' : '▼') + ' ' + n1(Math.abs(v) * 100) + '%</span> '
            + (arriba ? 'más' : 'menos') + ' que la semana anterior<br>'
            + nf(Math.abs(act - ant)) + ' ' + uni + ' por día de diferencia';
    };

    // EL RITMO. Líneas por persona y hora — el número que sale plano.
    const ritmoP = dP.map(f => f.p.ph ? f.p.lineas / f.p.ph : 0).filter(x => x > 0);
    const ritmoE = dE.map(f => f.e.ph ? f.e.lineas / f.e.ph : 0).filter(x => x > 0);
    const promRitP = promedio(ritmoP);
    const promRitE = promedio(ritmoE);

    const mejor = dP.slice().sort((a, b) => b.p.lineas - a.p.lineas)[0];

    // ─── LA PROYECCIÓN ───────────────────────────────────────────────────────
    /* SEIS DÍAS HACIA ADELANTE, que es la semana del CD (lunes a sábado). Va
       sobre la recta de la tendencia y no sobre el promedio: el promedio no
       sabría que viene creciendo. */
    const PROX = 6;
    const proy = [];
    /* ARRANCA DESPUES DEL ULTIMO DIA CON DATOS DE CUALQUIER LADO, no del ultimo
       de picking. El picking suele ir un dia atras del embalaje —el robot lo
       calcula despues—, y arrancando en el ultimo de picking la proyeccion
       "predecia" un dia que el embalaje ya tenia trabajado y publicado. */
    if (tP && dP.length && buenos.length) {
        const base = dP.length;
        const cur = partir(buenos[buenos.length - 1].fecha);
        let puestos = 0;
        while (puestos < PROX) {
            cur.setDate(cur.getDate() + 1);
            if (cur.getDay() === 0) continue;              // el domingo no se trabaja
            proy.push({
                fecha: aISO(cur),
                p: Math.max(0, tP.en(base + puestos)),
                e: tE ? Math.max(0, tE.en(dE.length + puestos)) : 0
            });
            puestos++;
        }
    }
    const totProyP = proy.reduce((s, x) => s + x.p, 0);
    const totProyE = proy.reduce((s, x) => s + x.e, 0);

    // ─── LAS CATEGORÍAS. ACÁ SÍ VAN LOS PARES. ───────────────────────────────
    const catAcum = {};
    dP.forEach(f => f.p.cat.forEach(c => {
        catAcum[c.id] = catAcum[c.id] || { eti: c.eti, color: c.color, valor: 0 };
        catAcum[c.id].valor += c.valor;
    }));
    const catLista = Object.keys(catAcum).map(k => ({
        id: k, eti: catAcum[k].eti, color: catAcum[k].color, valor: catAcum[k].valor
    }));
    const totCat = catLista.reduce((s, c) => s + c.valor, 0);
    /* ¿Vino el gender abierto del robot, o son las tres clases de siempre? Si vino
       abierto no hace falta la advertencia de que promotional está adentro. */
    const abierto = catLista.length > 0 && !catLista.some(c => c.id === 'no_cal');

    const totLinP = dP.reduce((s, f) => s + f.p.lineas, 0);
    const totLinE = dE.reduce((s, f) => s + f.e.lineas, 0);
    const totParP = dP.reduce((s, f) => s + f.p.pares, 0);
    const totParE = dE.reduce((s, f) => s + f.e.pares, 0);

    // ─── HTML ────────────────────────────────────────────────────────────────
    const desde = O.desde || filas[0].fecha;
    const hasta = O.hasta || filas[filas.length - 1].fecha;

    const T = [];
    T.push('<style>' + CSS + '</style>');
    T.push('<div id="pp">');

    T.push(
      '<div class="pp-cab"><div class="pp-quien">'
    + '<h2>Producción Picking y Embalaje</h2>'
    + '<div class="pp-cuantos">'
    + dP.length + ' días de picking y ' + dE.length + ' de embalaje, del '
    + corta(filas[0].fecha) + ' al ' + corta(filas[filas.length - 1].fecha)
    + (filas.length - buenos.length > 0
        ? ' · ' + (filas.length - buenos.length) + ' fuera del promedio (domingos y días sin trabajo)'
        : '')
    + '</div></div>'
    + selectorRango(desde, hasta, 'window.__ppRango')
    + '</div>');

    T.push('<div class="pp-aviso">'
    + '<b>Este cuadro mide en LÍNEAS, no en pares.</b> Una línea es una tarea: el picker va a '
    + 'una ubicación, saca lo que le piden y confirma. En no calzado la unidad del WMS no es un '
    + 'par —son bolsas, medias, cajas de accesorio—, así que sumarlas como pares infla el total '
    + 'sin que nadie haya trabajado más: del 24 al 28 de agosto los pares del picking se '
    + 'triplicaron mientras las líneas seguían iguales. <b>Los pares están más abajo, abiertos '
    + 'por categoría</b>, que es donde sí dicen algo.'
    + (hayParciales
        ? '<br><br><b>El embalaje de julio está incompleto</b> —el archivo más viejo del OBLPN '
        + 'es del 1 de agosto— y queda fuera del promedio y de la proyección. El picking de '
        + 'julio sí está completo y cuenta normal.'
        : '')
    + '</div>');

    T.push('<div class="pp-cards">'
    + '<div class="pp-card"><div class="rot" style="color:var(--pp-pick);">Picking · por día</div>'
    + '<div class="cifra">' + nf(promP) + '<span class="uni">líneas</span></div>'
    + '<div class="pie">promedio de ' + dP.length + ' días trabajados<br>'
    + flecha(vP.crece, vP.ap, vP.au, 'líneas') + '</div></div>'

    + '<div class="pp-card"><div class="rot" style="color:var(--pp-emb);">Embalaje · por día</div>'
    + '<div class="cifra">' + nf(promE) + '<span class="uni">líneas</span></div>'
    + '<div class="pie">promedio de ' + dE.length + ' días trabajados<br>'
    + flecha(vE.crece, vE.ap, vE.au, 'líneas') + '</div></div>'

    + '<div class="pp-card"><div class="rot">Ritmo del picking</div>'
    + '<div class="cifra">' + nf(promRitP) + '<span class="uni">líneas / persona-hora</span></div>'
    + '<div class="pie">El embalaje va a <b>' + nf(promRitE) + '</b> líneas por persona y hora.<br>'
    + 'Se cuenta la gente que tuvo movimiento en cada hora, no la del día.</div></div>'

    + '<div class="pp-card"><div class="rot">El día más alto</div>'
    + '<div class="cifra">' + (mejor ? nf(mejor.p.lineas) : '–') + '<span class="uni">líneas</span></div>'
    + '<div class="pie">' + (mejor ? etiquetaDia(mejor.fecha) + ' · ' + nf(mejor.p.gente)
        + ' personas · ' + nf(mejor.p.ph ? mejor.p.lineas / mejor.p.ph : 0)
        + ' líneas por persona-hora' : 'sin datos') + '</div></div>'
    + '</div>');

    T.push('<div class="pp-caja">'
    + '<p class="pp-titulo">Cómo viene creciendo</p>'
    + '<p class="pp-sub">Líneas por día. La línea gris punteada es la tendencia de los '
    + dP.length + ' días de picking, estirada ' + PROX + ' días hacia adelante. '
    + (tP ? 'El picking viene <b>' + (tP.b >= 0 ? 'subiendo' : 'bajando') + ' '
        + n1(Math.abs(tP.b)) + ' líneas por día trabajado</b>'
        + (Math.abs(tP.b) * dP.length < promP * 0.1
            ? ', que sobre ' + nf(promP) + ' líneas diarias es prácticamente plano.'
            : '.')
        : '')
    + '</p><div class="pp-graf"><canvas id="pp_g_serie"></canvas></div></div>');

    T.push('<div class="pp-dos">'
    + '<div class="pp-caja"><p class="pp-titulo">Qué se pica, por categoría</p>'
    + '<p class="pp-sub">' + nf(totCat) + ' unidades en ' + dP.length + ' días. '
    + '<b>Acá la barra naranja no son pares</b>: en no calzado el WMS cuenta bolsas y unidades '
    + 'sueltas. Por eso esta caja se mira por su forma —qué proporción de cada cosa entra— y no '
    + 'por el total.'
    + (abierto ? ''
        : ' Sale del <b>G. Gender</b> del Maestro, y hoy <b>promotional está adentro de «no '
        + 'calzado»</b>. Con la misma pasada se podría medir <b>cuánto tiempo se lleva cada '
        + 'categoría</b> —el robot tiene la hora de cada línea, pero no la publica abierta por '
        + 'categoría—: las dos cosas salen de volver a pasar los archivos del WMS en el servidor.')
    + '</p><div class="pp-graf" style="height:270px;"><canvas id="pp_g_cat"></canvas></div>'
    + '<div class="pp-leyenda">'
    + catLista.map(c => '<span><i style="background:' + c.color + ';"></i>' + esc(c.eti)
        + ' — ' + nf(c.valor) + ' (' + n1(totCat ? c.valor * 100 / totCat : 0) + '% del total)</span>').join('')
    + '</div></div>'

    + '<div class="pp-caja"><p class="pp-titulo">El ritmo, día por día</p>'
    + '<p class="pp-sub">Líneas por persona y hora. Este es el número que dice si el equipo está '
    + 'rindiendo: no lo mueve el tamaño del pedido, solo el trabajo. Si un día se cae, ahí hubo '
    + 'algo —falta de mercadería, una zona trabada, gente parada.</p>'
    + '<div class="pp-graf" style="height:270px;"><canvas id="pp_g_ritmo"></canvas></div></div>'
    + '</div>');

    if (proy.length) {
        T.push('<div class="pp-caja">'
        + '<p class="pp-titulo">Lo que viene, si sigue este ritmo</p>'
        + '<p class="pp-sub">Los próximos ' + PROX + ' días de trabajo, sacados de la tendencia. '
        + '<b>No es una promesa</b>: es lo que daría si los pedidos, el equipo y la gente siguen '
        + 'como en estos ' + dP.length + ' días. Un pico de campaña o una semana con menos '
        + 'personal lo cambia entero.</p>'
        + '<div class="pp-proy">'
        + proy.map(x => '<div class="pp-p"><div class="d">' + etiquetaDia(x.fecha) + '</div>'
            + '<div class="v">' + nf(x.p) + '</div>'
            + '<div class="d" style="margin-top:3px;">líneas · embalaje ' + nf(x.e) + '</div></div>').join('')
        + '</div>'
        + '<div class="pp-nota">'
        + 'Suman <b>' + nf(totProyP) + ' líneas</b> de picking y <b>' + nf(totProyE) + ' líneas</b> '
        + 'de embalaje en la semana. Con el promedio de hoy —' + nf(promP) + ' por día— serían '
        + nf(promP * PROX) + ' líneas en esos ' + PROX + ' días.<br>'
        + 'Para hacerlas harían falta unas <b>' + nf(promRitP ? totProyP / promRitP : 0)
        + ' personas-hora</b> de picking, al ritmo actual de ' + nf(promRitP) + ' líneas por '
        + 'persona y hora.'
        + '</div></div>');
    }

    T.push('<div class="pp-caja">'
    + '<p class="pp-titulo">Día por día</p>'
    + '<p class="pp-sub">Las líneas y los pares son los del archivo del WMS. «Ritmo» son las '
    + 'líneas divididas entre las personas-hora de ese día. La última columna dice cuánto embaló '
    + 'el CD de lo que picó: <b>no tiene por qué dar 100%</b>, porque lo que se pica un día se '
    + 'embala en parte al día siguiente.</p>'
    + '<div class="pp-scroll"><table class="pp-tabla"><thead>'
    + '<tr><th></th><th class="pp-grupo" colspan="4">Picking</th>'
    + '<th class="pp-grupo pp-sep" colspan="4">Embalaje</th><th class="pp-sep"></th></tr>'
    + '<tr><th>Día</th>'
    + '<th>Líneas</th><th>Pares</th><th>Gente</th><th>Ritmo</th>'
    + '<th class="pp-sep">Líneas</th><th>Pares</th><th>Gente</th><th>Ritmo</th>'
    + '<th class="pp-sep">Embalado / picado</th></tr></thead><tbody>'
    + filas.slice().reverse().map(f => {
        const p = f.p, e = f.e;
        const rp = (p && p.ph) ? p.lineas / p.ph : 0;
        const re = (e && e.ph) ? e.lineas / e.ph : 0;
        /* SOLO SE COMPARA CONTRA UN EMBALAJE COMPLETO. Con el embalaje parcial de
           julio salia "34,4% de lo picado", que se lee como que el CD no embalo
           dos tercios de lo que pico, y lo que falta es el archivo. */
        const rel = (p && p.vale && e && e.vale && e.lineas) ? (e.lineas * 100 / p.lineas) : null;
        let nota = '';
        if (!f.trabajado) nota = ' <span style="font-size:10px;">(sin trabajo)</span>';
        else if (e && e.parcial) nota = ' <span style="font-size:10px;">(embalaje parcial)</span>';
        return '<tr class="' + (f.trabajado ? '' : 'pp-libre') + '">'
            + '<td>' + etiquetaDia(f.fecha) + nota + '</td>'
            + '<td>' + nf(p ? p.lineas : null) + '</td><td>' + nf(p ? p.pares : null) + '</td>'
            + '<td>' + nf(p ? p.gente : null) + '</td><td>' + (rp ? nf(rp) : '–') + '</td>'
            + '<td class="pp-sep">' + nf(e ? e.lineas : null) + '</td><td>' + nf(e ? e.pares : null) + '</td>'
            + '<td>' + nf(e ? e.gente : null) + '</td><td>' + (re ? nf(re) : '–') + '</td>'
            + '<td class="pp-sep">' + (rel === null ? '–' : n1(rel) + '%') + '</td></tr>';
    }).join('')
    + '</tbody><tfoot><tr>'
    + '<td>Total · ' + dP.length + ' días de picking, ' + dE.length + ' de embalaje</td>'
    + '<td>' + nf(totLinP) + '</td><td>' + nf(totParP) + '</td>'
    + '<td>–</td><td>' + nf(promRitP) + '</td>'
    + '<td class="pp-sep">' + nf(totLinE) + '</td><td>' + nf(totParE) + '</td>'
    + '<td>–</td><td>' + nf(promRitE) + '</td>'
    + '<td class="pp-sep">–</td>'
    + '</tr></tfoot></table></div>'
    + '<div class="pp-nota">Los totales suman solo los días trabajados de cada lado, que no son '
    + 'los mismos: por eso la última columna no se totaliza —dividir dos totales de días '
    + 'distintos daría un porcentaje que no significa nada.</div>'
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

    /* EL EJE ES EL DE TODOS LOS DÍAS TRABAJADOS, no el del picking: el embalaje
       tiene días que el picking no tiene —el 22 y el 29 de agosto, por ejemplo— y
       si cada serie usara su propio eje quedarían corridas una respecto de otra y
       el cuadro mentiría sin que se note. Cada serie pone `null` donde no tiene. */
    const ejeDias = buenos.map(f => f.fecha);
    const ejes = ejeDias.map(corta);
    const ejesProy = proy.map(x => corta(x.fecha));

    const enEje = (lado, campo) => ejeDias.map(f => {
        const fila = porFecha[f], d = fila && fila[lado];
        return (d && d.vale) ? d[campo] : null;
    });

    /* La recta se dibuja sobre el eje ENTERO. Como la tendencia se calculó sobre
       los días de picking y el eje trae también los del embalaje, se avanza el
       índice solo en los días que sí entraron en el cálculo. */
    const rectaP = [];
    if (tP) {
        let i = 0;
        ejeDias.forEach(f => {
            const fila = porFecha[f];
            rectaP.push(Math.max(0, tP.en(i)));
            if (fila.p && fila.p.vale) i++;
        });
        for (let k = 0; k < proy.length; k++) rectaP.push(Math.max(0, tP.en(i + k)));
    }
    const colaProy = Array(ejes.length).fill(null).concat(proy.map(x => x.p));

    const g1 = document.getElementById('pp_g_serie');
    if (g1) _graficos.push(new Chart(g1, resolverColoresChart({
        type: 'line',
        data: {
            labels: ejes.concat(ejesProy),
            datasets: [
                { label: 'Picking', data: enEje('p', 'lineas'), borderColor: '#6366f1',
                  backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 2.5,
                  tension: 0.25, fill: true, pointRadius: 2.5, spanGaps: true },
                { label: 'Embalaje', data: enEje('e', 'lineas'), borderColor: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 2.5,
                  tension: 0.25, fill: true, pointRadius: 2.5, spanGaps: true },
                { label: 'Tendencia del picking', data: rectaP, borderColor: '#94a3b8',
                  borderWidth: 2, borderDash: [6, 5], pointRadius: 0, fill: false },
                { label: 'Proyección', data: colaProy, borderColor: '#6366f1',
                  borderWidth: 2, borderDash: [3, 3], pointRadius: 3.5,
                  pointStyle: 'rectRot', fill: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
                tooltip: { callbacks: { label: (c) => c.dataset.label + ': '
                    + (c.parsed.y === null ? '–' : nf(c.parsed.y) + ' líneas') } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => nf(v) } },
                x: { ticks: { maxRotation: 60, minRotation: 0, autoSkip: true, maxTicksLimit: 18 } }
            }
        }
    })));

    const g2 = document.getElementById('pp_g_cat');
    if (g2) _graficos.push(new Chart(g2, resolverColoresChart({
        type: 'bar',
        data: {
            labels: ejes,
            datasets: catLista.map(c => ({
                label: c.eti,
                data: ejeDias.map(f => {
                    const d = porFecha[f].p;
                    if (!d || !d.vale) return 0;
                    const hit = d.cat.filter(x => x.id === c.id)[0];
                    return hit ? hit.valor : 0;
                }),
                backgroundColor: c.color, borderWidth: 0
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
                tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + nf(c.parsed.y) } }
            },
            scales: {
                x: { stacked: true, ticks: { maxRotation: 60, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => nf(v) } }
            }
        }
    })));

    const g3 = document.getElementById('pp_g_ritmo');
    if (g3) _graficos.push(new Chart(g3, resolverColoresChart({
        type: 'line',
        data: {
            labels: ejes,
            datasets: [
                { label: 'Picking (eje izquierdo)', borderColor: '#6366f1', borderWidth: 2.5,
                  tension: 0.25, pointRadius: 2.5, fill: false, spanGaps: true, yAxisID: 'yp',
                  data: ejeDias.map(f => {
                      const d = porFecha[f].p;
                      return (d && d.vale && d.ph) ? d.lineas / d.ph : null;
                  }) },
                { label: 'Embalaje (eje derecho)', borderColor: '#22c55e', borderWidth: 2.5,
                  tension: 0.25, pointRadius: 2.5, fill: false, spanGaps: true, yAxisID: 'ye',
                  data: ejeDias.map(f => {
                      const d = porFecha[f].e;
                      return (d && d.vale && d.ph) ? d.lineas / d.ph : null;
                  }) }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
                tooltip: { callbacks: { label: (c) => c.dataset.label.split(' (')[0] + ': '
                    + nf(c.parsed.y) + ' líneas por persona y hora' } }
            },
            /* CADA UNO CON SU EJE. El embalaje va a unas 146 líneas por persona-hora
               y el picking a 54: en un solo eje el picking queda aplastado contra el
               suelo y no se le ve el movimiento, que es justo lo que hay que mirar.
               Los dos arrancan en cero para que la altura siga significando algo. */
            scales: {
                yp: { position: 'left', beginAtZero: true, ticks: { callback: (v) => nf(v) },
                      title: { display: true, text: 'Picking' } },
                ye: { position: 'right', beginAtZero: true, ticks: { callback: (v) => nf(v) },
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: 'Embalaje' } },
                x: { ticks: { maxRotation: 60, autoSkip: true, maxTicksLimit: 14 } }
            }
        }
    })));
}
