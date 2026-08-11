/* ============================================================================
   PICKING — lectura del archivo del WMS y agregados del reporte
   ----------------------------------------------------------------------------
   Acá vive TODO el cálculo del módulo Picking. La pantalla solo pinta lo que
   esto devuelve.

   POR QUÉ SE GUARDAN AGREGADOS Y NO LAS FILAS. Un día son ~11.400 filas de 33
   columnas; nueve días pasan de 100.000. El servidor tiene 1 GB para todo, y
   ninguna pantalla necesita la fila suelta: necesita los totales. Así que el
   navegador lee el CSV, calcula, y sube un resumen de unos pocos KB por día.
   La contrapartida, asumida: para calcular algo que hoy no está en el resumen
   hay que volver a subir los archivos.

   LAS CUATRO TRAMPAS DEL ARCHIVO, que son la razón de casi todo lo de abajo:

     1. `Estado = Cancelado` NO es un quiebre, es una COPIA. Cada picking real
        deja dos filas: la de la tarea (queda Cancelado, contenedor PRE...) y la
        de la confirmación (Finalizada). Misma ubicación, misma persona, el
        mismo segundo exacto. Contarlas duplica todo e inventa pares no
        entregados que sí salieron. Solo cuenta `Finalizada`.

     2. NO TODO LO QUE SALE SON PARES. Bolsas, mochilas y complementos vienen
        mezclados: el 06-ago el artículo que más "pares" movió era una BOLSA con
        3.000 unidades. El corte lo hace el Maestro, `G. Gender = Footwear`.

     3. EL PREPACK APLASTA EL CONTEO. Sus SKU tienen 15 caracteres y los dos
        primeros dígitos del sufijo son los pares de la caja; el WMS anota 1 en
        `Cantidad empaquetada`, o sea cuenta CAJAS, no pares. Sin abrir la curva
        el reporte subcuenta entre 19% y 38% según el día.

     4. Los archivos ordenan mal por nombre: "Picking 1-8" va antes que
        "Picking 30-7" alfabéticamente. El día sale del CONTENIDO, nunca del
        nombre del archivo.

   Ver la memoria del proyecto y `Documentacion/`. Los números de este archivo
   se validaron contra la maqueta del 09-ago-2026.
   ============================================================================ */

/* --- Lectura del CSV -------------------------------------------------------- */

/** El WMS envuelve los números en `="..."` para que Excel no se los coma. */
const limpiar = (v) => {
    const s = String(v == null ? '' : v).trim();
    return (s.startsWith('="') && s.endsWith('"')) ? s.slice(2, -1).trim() : s;
};

const aNumero = (v) => {
    const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isNaN(n) ? 0 : Math.trunc(n);
};

/**
 * `dd/mm/aaaa hh:mm:ss` → Date. Devuelve null si no se puede leer.
 * Se arma campo por campo y no con `new Date(texto)`: el navegador interpreta
 * dd/mm como mm/dd y el 06/08 se convertiría en agosto 6 de otra jornada.
 */
export const horaDePick = (s) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    return isNaN(d.getTime()) ? null : d;
};

/** `dd/mm/aaaa hh:mm:ss` → `aaaa-mm-dd`, para ordenar y comparar sin ambigüedad. */
export const diaDePick = (s) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/**
 * Parsea el CSV del WMS: separador `;`, UTF-8 con BOM, sin comillas de campo
 * (los valores ya vienen envueltos en `="..."`, que es otra cosa).
 */
export const parsearCsvPicking = (texto) => {
    const limpio = String(texto || '').replace(/^﻿/, '');
    const lineas = limpio.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lineas.length < 2) return [];
    const cab = lineas[0].split(';').map(c => c.trim());
    const filas = [];
    for (let i = 1; i < lineas.length; i++) {
        const partes = lineas[i].split(';');
        const o = {};
        for (let j = 0; j < cab.length; j++) o[cab[j]] = limpiar(partes[j]);
        filas.push(o);
    }
    return filas;
};

/* --- El prepack ------------------------------------------------------------- */

/**
 * Los pares que trae una caja de prepack, o 1 si el SKU es suelto.
 *
 * El SKU normal tiene 12 caracteres (`#######-#-##`) y el prepack 15
 * (`#######-#-#####`): los dos primeros dígitos del sufijo son los pares. El
 * mismo código aparece en 06, 08 y 10.
 */
/**
 * Se reconoce por la FORMA del código, no por su largo: `#######-#-#####`.
 * Un código de 15 caracteres con otro formato no es prepack, y contarlo como
 * tal le multiplicaría los pares por un número sacado de donde no toca.
 */
const FORMA_PREPACK = /^\d{7}-\d-\d{5}$/;

export const esPrepack = (sku) => FORMA_PREPACK.test(String(sku || '').trim());

export const paresDeLaCaja = (sku) => {
    const s = String(sku || '').trim();
    if (!FORMA_PREPACK.test(s)) return 1;
    const n = parseInt(s.slice(-5).slice(0, 2), 10);
    return (n > 0 && n <= 24) ? n : 1;
};

/**
 * LO QUE CUESTA UN PICK DE PREPACK, MEDIDO CONTRA UNO SUELTO.
 *
 * Daniel no quiere dos productividades, quiere UNA, con el prepack pesando por
 * dentro. Es la equivalencia que él resume como *"por cada caja que saco de
 * prepack, equivale a 1,83"* — ese 1,83 es la caja de 10, la más común.
 *
 * CÓMO SE MIDIÓ, sobre los nueve archivos reales: el hueco entre un pick y el
 * siguiente DE LA MISMA PERSONA es lo que costó ese pick —caminar hasta el
 * sitio y sacar—, descartando los huecos de más de 5 minutos, que son paradas
 * y no trabajo. Un pick suelto tarda 18 s (mediana de 79.770 mediciones).
 *
 * NO cuesta diez veces más sacar una caja de diez: el trabajo es llegar al
 * sitio, no levantar la caja. Con el pick anterior en el MISMO sitio son 9 s
 * el suelto contra 20 s el prepack; cambiando de sitio, 20 s contra 28 s.
 *
 * `MUESTRA` es cuántos picks respaldan cada fila y está acá a propósito: la
 * curva de 5 salió con factor 7,72 sobre TRES mediciones y no se usa —se le
 * aplica el general—, porque tres huecos no miden nada. El corte es 50.
 */
export const EQUIVALENCIA_PREPACK = {
    segundos_suelto: 18,
    muestra_suelto: 79770,
    factor_general: 1.56,
    minimo_muestra: 50,
    // curva → { seg: cuánto tarda, factor: medido, muestra: en cuántos picks, usa: el que se aplica }
    curvas: {
        4:  { seg: 35, factor: 1.94, muestra: 53,   usa: 1.94 },
        5:  { seg: 139, factor: 7.72, muestra: 3,   usa: 1.56 },
        6:  { seg: 26, factor: 1.44, muestra: 4500, usa: 1.44 },
        7:  { seg: 23, factor: 1.28, muestra: 57,   usa: 1.28 },
        8:  { seg: 29, factor: 1.61, muestra: 1203, usa: 1.61 },
        9:  { seg: 23, factor: 1.28, muestra: 186,  usa: 1.28 },
        10: { seg: 33, factor: 1.83, muestra: 1397, usa: 1.83 },
        12: { seg: 61, factor: 3.39, muestra: 229,  usa: 3.39 }
    }
};

/**
 * El esfuerzo de una línea, en "líneas sueltas equivalentes".
 *
 * Una curva que no está en la tabla se cuenta con el factor general (1,56) y NO
 * se interpola: interpolar inventa precisión que la medición no tiene, y la
 * tabla ya no es monótona —la de 9 cuesta menos que la de 8—, así que la recta
 * entre dos vecinas no significa nada.
 */
export const esfuerzoDeLinea = (sku) => {
    if (!esPrepack(sku)) return 1;
    const c = EQUIVALENCIA_PREPACK.curvas[paresDeLaCaja(sku)];
    return c ? c.usa : EQUIVALENCIA_PREPACK.factor_general;
};

/** Los pares de verdad de una línea: la caja de prepack cuenta por sus pares. */
export const paresDeLinea = (fila) => {
    const cant = aNumero(fila['Cantidad empaquetada']);
    return cant * paresDeLaCaja(fila['Código de artículo']);
};

/* --- El Maestro ------------------------------------------------------------- */

/**
 * Índice del Maestro por los 7 primeros dígitos del código.
 *
 * El Maestro publicado llega como arreglos y su PRIMERA FILA son los títulos,
 * así que las columnas se buscan por nombre y no se dan por sentadas: si
 * Comercial agrega una columna, esto sigue funcionando.
 */
export const indexarMaestroPicking = (maestro) => {
    const filas = maestro || [];
    if (!filas.length) return { get: () => null, vacio: true };

    const cabecera = Array.isArray(filas[0]) ? filas[0].map(c => String(c || '').trim()) : null;
    const col = (nombres) => {
        if (!cabecera) return -1;
        for (const n of nombres) {
            const i = cabecera.findIndex(c => c.toLowerCase() === n.toLowerCase());
            if (i !== -1) return i;
        }
        return -1;
    };
    const iSku = col(['CodArticulo', 'SKU', 'Articulo']);
    const iGen = col(['G. Gender', 'G Gender']);
    const iRim = col(['Gender RIMS']);
    const iMar = col(['Marcas', 'MarcaStd']);
    const iCol = col(['Coleccion PO']);

    const porSku = new Map();
    for (let i = 1; i < filas.length; i++) {
        const f = filas[i];
        if (!Array.isArray(f)) continue;
        const sku = String(f[iSku] || '').trim().slice(0, 7);
        if (!sku || porSku.has(sku)) continue;
        const dato = (idx) => {
            const v = String((idx >= 0 ? f[idx] : '') || '').trim();
            return (!v || v === '(en blanco)') ? 'Sin dato' : v;
        };
        porSku.set(sku, {
            gender: dato(iGen), rims: dato(iRim),
            marca: dato(iMar), coleccion: dato(iCol)
        });
    }
    return {
        vacio: porSku.size === 0,
        get: (sku) => porSku.get(String(sku || '').trim().slice(0, 7)) || null
    };
};

const SIN_DATO = { gender: 'Sin dato', rims: 'Sin dato', marca: 'Sin dato', coleccion: 'Sin dato' };

/* --- Agregados -------------------------------------------------------------- */

const ZONA_NOMBRE = {
    MZN01: 'Mezzanine 1', MZN02: 'Mezzanine 2', MZN03: 'Mezzanine 3', MZN04: 'Mezzanine 4',
    SEL: 'Selectivo', CDBUFFER: 'Zona Buffer', AND: 'Andamio', PISO: 'Piso', PARED: 'Pared'
};

/**
 * HORAS MÍNIMAS PARA ENTRAR AL RANKING.
 *
 * Sin corte encabezaba gente con 36 minutos trabajados: cuatro picks seguidos
 * en el mismo sitio dan un ritmo que nadie sostiene una jornada. Quien no llega
 * al corte sigue contando en los totales; lo único que no hace es figurar en el
 * podio. Elegido a falta de decisión de Daniel — está a la vista en el pie del
 * cuadro para poder discutirlo sobre la pantalla.
 */
export const HORAS_MIN_RANKING = 2;

const corte = (filas, clave, maestro, tope) => {
    const m = new Map();
    filas.forEach(r => {
        const k = clave(r, maestro.get(r['Código de artículo']) || SIN_DATO) || 'Sin dato';
        const a = m.get(k) || { nom: k, lineas: 0, pares: 0 };
        a.lineas++; a.pares += paresDeLinea(r);
        m.set(k, a);
    });
    const lista = [...m.values()].sort((a, b) => b.pares - a.pares);
    return tope ? lista.slice(0, tope) : lista;
};

/**
 * Todo lo que la pantalla necesita de un conjunto de filas ya filtradas.
 *
 * Las listas de personas, ubicaciones y códigos se guardan enteras (`_personas`,
 * `_ubic`, `_cod`) porque ESO NO SE SUMA ENTRE DÍAS: quien trabajó los ocho días
 * es UNA persona, no ocho. Al juntar varias fechas se unen los conjuntos.
 */
export const agregar = (filas, maestro) => {
    if (!filas.length) return null;

    const horas = filas.map(r => horaDePick(r['Hora de selección'])).filter(Boolean);
    const pares = filas.reduce((s, r) => s + paresDeLinea(r), 0);
    const esfuerzo = filas.reduce((s, r) => s + esfuerzoDeLinea(r['Código de artículo']), 0);

    const o = {
        lineas: filas.length,
        pares,
        esfuerzo: +esfuerzo.toFixed(1),
        pedidos: new Set(filas.map(r => r['Número de orden'])).size,
        olas: new Set(filas.map(r => r['Número de ejecución']).filter(Boolean)).size,
        desde: horas.length ? new Date(Math.min(...horas)).toTimeString().slice(0, 5) : '',
        hasta: horas.length ? new Date(Math.max(...horas)).toTimeString().slice(0, 5) : '',
        _personas: [...new Set(filas.map(r => r['Usuario de selección']).filter(Boolean))].sort(),
        _ubic: [...new Set(filas.map(r => r['De ubicación']).filter(Boolean))].sort(),
        _cod: [...new Set(filas.map(r => String(r['Código de artículo'] || '').slice(0, 7)))].sort()
    };
    o.pares_x_linea = +(o.pares / o.lineas).toFixed(2);

    // Cuánto del volumen entró en caja de prepack: explica por qué las líneas y
    // los pares no se mueven juntos.
    const filasPre = filas.filter(r => esPrepack(r['Código de artículo']));
    o.prepack = {
        lineas: filasPre.length,
        pares: filasPre.reduce((s, r) => s + paresDeLinea(r), 0)
    };

    // Lo pedido que no salió, por pedido+código: se compara la mayor cantidad
    // original contra lo que de verdad se empaquetó.
    const g = new Map();
    filas.forEach(r => {
        const k = `${r['Número de orden']}|${r['Código de artículo']}`;
        const a = g.get(k) || { pedido: 0, salio: 0 };
        a.pedido = Math.max(a.pedido, aNumero(r['Cantidad de orden original']));
        a.salio += aNumero(r['Cantidad empaquetada']);
        g.set(k, a);
    });
    let falta = 0, incompletas = 0;
    g.forEach(a => { const d = a.pedido - a.salio; if (d > 0) { falta += d; incompletas++; } });
    o.no_entregado = falta;
    o.lineas_incompletas = incompletas;
    o.nivel_atencion = (o.pares + falta) ? +(100 * o.pares / (o.pares + falta)).toFixed(1) : 0;

    // Por persona. Las horas van sobre SU PROPIA franja (primer a último pick),
    // no sobre la jornada: quien entró a las 22:00 no trabajó desde las 19:00.
    const pu = new Map();
    filas.forEach(r => {
        const u = r['Usuario de selección'] || 'Sin usuario';
        const a = pu.get(u) || { lineas: 0, pares: 0, esfuerzo: 0, ped: new Set(), ubi: new Set(), horas: [] };
        a.lineas++; a.pares += paresDeLinea(r);
        a.esfuerzo += esfuerzoDeLinea(r['Código de artículo']);
        a.ped.add(r['Número de orden']); a.ubi.add(r['De ubicación']);
        const h = horaDePick(r['Hora de selección']); if (h) a.horas.push(h);
        pu.set(u, a);
    });
    o.gente = [...pu.entries()].map(([usuario, a]) => {
        const span = a.horas.length > 1 ? (Math.max(...a.horas) - Math.min(...a.horas)) / 3600000 : 0;
        const suficiente = span >= HORAS_MIN_RANKING;
        return {
            usuario, lineas: a.lineas, pares: a.pares,
            esfuerzo: +a.esfuerzo.toFixed(1),
            pedidos: a.ped.size, ubicaciones: a.ubi.size,
            desde: a.horas.length ? new Date(Math.min(...a.horas)).toTimeString().slice(0, 5) : '',
            hasta: a.horas.length ? new Date(Math.max(...a.horas)).toTimeString().slice(0, 5) : '',
            horas: +span.toFixed(1),
            // La cifra que Daniel quiere ver: esfuerzo por hora, con el prepack
            // pesando por dentro. Null si no llega al corte — no es cero.
            ritmo: suficiente ? Math.round(a.esfuerzo / span) : null,
            pares_hora: suficiente ? Math.round(a.pares / span) : null,
            bajo_corte: !suficiente
        };
    }).sort((a, b) => (b.ritmo || -1) - (a.ritmo || -1));

    // De dónde sale la mercadería
    const z = new Map();
    filas.forEach(r => {
        const k = String(r['De ubicación'] || '?').split('-')[0];
        const a = z.get(k) || { cod: k, nom: ZONA_NOMBRE[k] || k, lineas: 0, pares: 0, ubi: new Set() };
        a.lineas++; a.pares += paresDeLinea(r); a.ubi.add(r['De ubicación']);
        z.set(k, a);
    });
    o.zonas = [...z.values()]
        .map(v => ({ cod: v.cod, nom: v.nom, lineas: v.lineas, pares: v.pares, ubicaciones: v.ubi.size }))
        .sort((a, b) => b.pares - a.pares);

    o.marcas = corte(filas, (r, m) => m.marca, maestro);
    o.coleccion = corte(filas, (r, m) => m.coleccion, maestro);
    o.categoria = corte(filas, (r, m) => m.rims, maestro, 10);
    o.genero = corte(filas, (r) => r['Jerarquía de artículo 1'], maestro, 10);

    // ── A QUÉ HORA SE PICÓ ────────────────────────────────────────────────
    // La hora del reloj, no la de la jornada: sirve para ver dónde está el pico
    // del turno y dónde se cae. Se guarda por hora entera.
    const ph = new Map();
    filas.forEach(r => {
        const h = horaDePick(r['Hora de selección']);
        if (!h) return;
        const k = h.getHours();
        const a = ph.get(k) || { hora: k, lineas: 0, pares: 0, gente: new Set() };
        a.lineas++; a.pares += paresDeLinea(r);
        a.gente.add(r['Usuario de selección']);
        ph.set(k, a);
    });
    o.por_hora = [...ph.values()]
        .map(a => ({ hora: a.hora, lineas: a.lineas, pares: a.pares, personas: a.gente.size }))
        .sort((a, b) => a.hora - b.hora);

    // ── LAS CORRIDAS (olas) ───────────────────────────────────────────────
    const ol = new Map();
    filas.forEach(r => {
        const k = r['Número de ejecución'];
        if (!k) return;
        const a = ol.get(k) || { ola: k, lineas: 0, pares: 0, gente: new Set(), horas: [] };
        a.lineas++; a.pares += paresDeLinea(r);
        a.gente.add(r['Usuario de selección']);
        const h = horaDePick(r['Hora de selección']); if (h) a.horas.push(h);
        ol.set(k, a);
    });
    o.corridas = [...ol.values()].filter(a => a.horas.length).map(a => ({
        ola: a.ola, lineas: a.lineas, pares: a.pares, personas: a.gente.size,
        desde: new Date(Math.min(...a.horas)).toTimeString().slice(0, 5),
        hasta: new Date(Math.max(...a.horas)).toTimeString().slice(0, 5),
        minutos: Math.round((Math.max(...a.horas) - Math.min(...a.horas)) / 60000)
    })).sort((a, b) => b.lineas - a.lineas).slice(0, 15);

    // ── LOS ARTÍCULOS QUE MÁS SALIERON ────────────────────────────────────
    const ta = new Map();
    filas.forEach(r => {
        const k = String(r['Código de artículo'] || '').slice(0, 7);
        const a = ta.get(k) || { codigo: k, lineas: 0, pares: 0, desc: '', ubis: new Set() };
        a.lineas++; a.pares += paresDeLinea(r);
        a.desc = r['Descripción de artículo'] || a.desc;
        a.ubis.add(r['De ubicación']);
        ta.set(k, a);
    });
    o.articulos = [...ta.values()].map(a => {
        const m = maestro.get(a.codigo) || SIN_DATO;
        return { codigo: a.codigo, lineas: a.lineas, pares: a.pares, desc: a.desc,
                 marca: m.marca, coleccion: m.coleccion, ubicaciones: a.ubis.size };
    }).sort((a, b) => b.pares - a.pares).slice(0, 40);

    // ── QUÉ CURVAS SE PICARON ─────────────────────────────────────────────
    // Cajas, líneas y pares por tamaño de curva. Las cajas no son las líneas:
    // una línea puede llevar más de una caja del mismo código.
    const cv = new Map();
    filasPre.forEach(r => {
        const k = paresDeLaCaja(r['Código de artículo']);
        const a = cv.get(k) || { curva: k, cajas: 0, lineas: 0, pares: 0 };
        a.cajas += aNumero(r['Cantidad empaquetada']);
        a.lineas++; a.pares += paresDeLinea(r);
        cv.set(k, a);
    });
    o.curvas = [...cv.values()].sort((a, b) => a.curva - b.curva);

    // ── EL RECORRIDO: contenedores que obligan a visitar más de una zona ───
    const cont = new Map();
    filas.forEach(r => {
        const k = r['Número de contenedor'];
        if (!k) return;
        const a = cont.get(k) || { zonas: new Set(), lineas: 0 };
        a.zonas.add(String(r['De ubicación'] || '?').split('-')[0]);
        a.lineas++;
        cont.set(k, a);
    });
    const dist = new Map();
    let multi = 0, lineasMulti = 0;
    cont.forEach(a => {
        const n = a.zonas.size;
        dist.set(n, (dist.get(n) || 0) + 1);
        if (n > 1) { multi++; lineasMulti += a.lineas; }
    });
    o.recorrido = {
        contenedores: cont.size,
        con_varias_zonas: multi,
        lineas_en_multi: lineasMulti,
        pct: cont.size ? +(100 * multi / cont.size).toFixed(1) : 0,
        dist: [...dist.entries()].sort((a, b) => a[0] - b[0]).map(([z, n]) => [z, n])
    };

    // ── UBICACIÓN REPETIDA ────────────────────────────────────────────────
    // Cuántas de las visitas son volver a un sitio donde ya se estuvo ese día.
    const vis = new Map();
    filas.forEach(r => {
        const u = r['De ubicación'];
        if (!u) return;
        vis.set(u, (vis.get(u) || 0) + 1);
    });
    const totalVisitas = [...vis.values()].reduce((s, v) => s + v, 0);
    o.repetida = {
        visitas: totalVisitas,
        ubicaciones: vis.size,
        repetidas: totalVisitas - vis.size,
        pct: totalVisitas ? +(100 * (totalVisitas - vis.size) / totalVisitas).toFixed(1) : 0,
        top: [...vis.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
            .map(([ubicacion, visitas]) => ({ ubicacion, visitas }))
    };

    return o;
};

/**
 * Un archivo de picking → el resumen de ese día, partido en tres segmentos.
 *
 * El segmento filtra la pantalla entera y lo decide `G. Gender` del Maestro:
 * no es igual picar cien pares que cinco mil bolsas, y mezclarlos hace que la
 * productividad no signifique nada.
 */
export const procesarArchivoPicking = (texto, maestro) => {
    const filas = parsearCsvPicking(texto);
    if (!filas.length) return { error: 'El archivo no tiene filas.' };
    if (!('Estado' in filas[0]) || !('Hora de selección' in filas[0])) {
        return { error: 'No parece un archivo de picking del WMS: le faltan las columnas Estado y Hora de selección.' };
    }

    const idx = indexarMaestroPicking(maestro);
    // Trampa 1: la fila Cancelado es la copia de la tarea, no un quiebre.
    const buenas = filas.filter(r => r['Estado'] === 'Finalizada');
    if (!buenas.length) return { error: 'El archivo no trae ninguna línea Finalizada.' };

    const esCalzado = (r) => (idx.get(r['Código de artículo']) || SIN_DATO).gender === 'Footwear';
    const calzado = buenas.filter(esCalzado);
    const noCalzado = buenas.filter(r => !esCalzado(r));

    // Trampa 4: el día sale del contenido, nunca del nombre del archivo.
    const dia = diaDePick(buenas[0]['Hora de selección']);

    return {
        dia,
        filas_archivo: filas.length,
        filas_copia: filas.length - buenas.length,
        maestro_vacio: idx.vacio,
        seg: {
            calzado: agregar(calzado, idx),
            no_calzado: agregar(noCalzado, idx),
            todo: agregar(buenas, idx)
        },
        // El cronómetro va sobre TODO el picking, no por segmento: la caja de
        // prepack cuesta lo mismo lleve zapatos o lleve otra cosa, y partirlo
        // por segmento solo reduciría la muestra sin cambiar lo que mide.
        pp: cronometrarJornada(buenas, filas.length)
    };
};

/* --- Juntar varios días ----------------------------------------------------- */

const unir = (listas) => {
    const m = new Map();
    listas.forEach(l => (l || []).forEach(x => {
        const a = m.get(x.nom) || { nom: x.nom, lineas: 0, pares: 0 };
        a.lineas += x.lineas; a.pares += x.pares;
        m.set(x.nom, a);
    }));
    return [...m.values()].sort((a, b) => b.pares - a.pares);
};

/**
 * Varios días en un solo cuadro.
 *
 * Lo que se SUMA: líneas, pares, esfuerzo, pedidos, olas.
 * Lo que se UNE: personas, ubicaciones y códigos — quien trabajó los ocho días
 * es una persona, no ocho. Sumarlos fue el primer error de la maqueta.
 */
export const juntarDias = (resumenes, segmento) => {
    const dias = (resumenes || []).map(r => r && r.seg && r.seg[segmento]).filter(Boolean);
    if (!dias.length) return null;
    if (dias.length === 1) return { ...dias[0], jornadas: 1 };

    const o = {
        jornadas: dias.length,
        lineas: dias.reduce((s, d) => s + d.lineas, 0),
        pares: dias.reduce((s, d) => s + d.pares, 0),
        esfuerzo: +dias.reduce((s, d) => s + d.esfuerzo, 0).toFixed(1),
        pedidos: dias.reduce((s, d) => s + d.pedidos, 0),
        olas: dias.reduce((s, d) => s + d.olas, 0),
        no_entregado: dias.reduce((s, d) => s + d.no_entregado, 0),
        lineas_incompletas: dias.reduce((s, d) => s + d.lineas_incompletas, 0),
        prepack: {
            lineas: dias.reduce((s, d) => s + d.prepack.lineas, 0),
            pares: dias.reduce((s, d) => s + d.prepack.pares, 0)
        },
        _personas: [...new Set(dias.flatMap(d => d._personas))].sort(),
        _ubic: [...new Set(dias.flatMap(d => d._ubic))].sort(),
        _cod: [...new Set(dias.flatMap(d => d._cod))].sort()
    };
    o.pares_x_linea = +(o.pares / o.lineas).toFixed(2);
    o.nivel_atencion = (o.pares + o.no_entregado)
        ? +(100 * o.pares / (o.pares + o.no_entregado)).toFixed(1) : 0;

    o.marcas = unir(dias.map(d => d.marcas));
    o.coleccion = unir(dias.map(d => d.coleccion));
    o.categoria = unir(dias.map(d => d.categoria)).slice(0, 10);
    o.genero = unir(dias.map(d => d.genero)).slice(0, 10);

    const z = new Map();
    dias.forEach(d => (d.zonas || []).forEach(x => {
        const a = z.get(x.cod) || { cod: x.cod, nom: x.nom, lineas: 0, pares: 0, ubicaciones: 0 };
        a.lineas += x.lineas; a.pares += x.pares;
        // Las ubicaciones distintas no se pueden sumar entre días (se repiten):
        // se toma el día más amplio, que es una cota baja honesta.
        a.ubicaciones = Math.max(a.ubicaciones, x.ubicaciones);
        z.set(x.cod, a);
    }));
    o.zonas = [...z.values()].sort((a, b) => b.pares - a.pares);

    // ── Y LOS CUADROS QUE SE AGREGARON DESPUÉS ────────────────────────────
    // La regla es la de siempre: el VOLUMEN se suma, lo DISTINTO se une.

    // Por hora: se suma la misma hora de días distintos. Las personas de esa
    // hora no se pueden sumar —es la misma gente cada día—, así que se toma la
    // del día más cargado.
    const ph = new Map();
    dias.forEach(d => (d.por_hora || []).forEach(x => {
        const a = ph.get(x.hora) || { hora: x.hora, lineas: 0, pares: 0, personas: 0 };
        a.lineas += x.lineas; a.pares += x.pares;
        a.personas = Math.max(a.personas, x.personas);
        ph.set(x.hora, a);
    }));
    o.por_hora = [...ph.values()].sort((a, b) => a.hora - b.hora);

    // Las corridas son de cada día y no se juntan: se apilan y se queda con las
    // más grandes del período.
    o.corridas = dias.flatMap(d => d.corridas || [])
        .sort((a, b) => b.lineas - a.lineas).slice(0, 15);

    const ta = new Map();
    dias.forEach(d => (d.articulos || []).forEach(x => {
        const a = ta.get(x.codigo) || { ...x, lineas: 0, pares: 0, ubicaciones: 0 };
        a.lineas += x.lineas; a.pares += x.pares;
        a.ubicaciones = Math.max(a.ubicaciones, x.ubicaciones);
        ta.set(x.codigo, a);
    }));
    o.articulos = [...ta.values()].sort((a, b) => b.pares - a.pares).slice(0, 40);

    const cv = new Map();
    dias.forEach(d => (d.curvas || []).forEach(x => {
        const a = cv.get(x.curva) || { curva: x.curva, cajas: 0, lineas: 0, pares: 0 };
        a.cajas += x.cajas; a.lineas += x.lineas; a.pares += x.pares;
        cv.set(x.curva, a);
    }));
    o.curvas = [...cv.values()].sort((a, b) => a.curva - b.curva);

    const rec = { contenedores: 0, con_varias_zonas: 0, lineas_en_multi: 0, dist: [] };
    const dm = new Map();
    dias.forEach(d => {
        const r = d.recorrido; if (!r) return;
        rec.contenedores += r.contenedores;
        rec.con_varias_zonas += r.con_varias_zonas;
        rec.lineas_en_multi += r.lineas_en_multi;
        (r.dist || []).forEach(([zn, n]) => dm.set(zn, (dm.get(zn) || 0) + n));
    });
    rec.dist = [...dm.entries()].sort((a, b) => a[0] - b[0]);
    rec.pct = rec.contenedores ? +(100 * rec.con_varias_zonas / rec.contenedores).toFixed(1) : 0;
    o.recorrido = rec;

    // Ubicación repetida: las visitas se suman, pero las ubicaciones DISTINTAS
    // del período son la unión —que ya está calculada en `_ubic`—, no la suma.
    // Sumarlas contaría una misma ubicación tantas veces como días se visitó.
    const visitas = dias.reduce((s, d) => s + ((d.repetida && d.repetida.visitas) || 0), 0);
    const tp = new Map();
    dias.forEach(d => ((d.repetida && d.repetida.top) || []).forEach(x => {
        tp.set(x.ubicacion, (tp.get(x.ubicacion) || 0) + x.visitas);
    }));
    o.repetida = {
        visitas,
        ubicaciones: o._ubic.length,
        repetidas: visitas - o._ubic.length,
        pct: visitas ? +(100 * (visitas - o._ubic.length) / visitas).toFixed(1) : 0,
        top: [...tp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
            .map(([ubicacion, v]) => ({ ubicacion, visitas: v }))
    };

    // La gente sí se acumula por persona, y el ritmo se recalcula sobre el total
    // de horas de esa persona: promediar ritmos de días distintos da un número
    // que no es de nadie.
    const g = new Map();
    dias.forEach(d => (d.gente || []).forEach(p => {
        const a = g.get(p.usuario) || { usuario: p.usuario, lineas: 0, pares: 0, esfuerzo: 0, pedidos: 0, ubicaciones: 0, horas: 0, dias: 0 };
        a.lineas += p.lineas; a.pares += p.pares; a.esfuerzo += p.esfuerzo;
        a.pedidos += p.pedidos; a.horas += p.horas; a.dias++;
        a.ubicaciones = Math.max(a.ubicaciones, p.ubicaciones);
        g.set(p.usuario, a);
    }));
    o.gente = [...g.values()].map(a => {
        const suficiente = a.horas >= HORAS_MIN_RANKING;
        return {
            ...a,
            esfuerzo: +a.esfuerzo.toFixed(1),
            horas: +a.horas.toFixed(1),
            ritmo: suficiente ? Math.round(a.esfuerzo / a.horas) : null,
            pares_hora: suficiente ? Math.round(a.pares / a.horas) : null,
            bajo_corte: !suficiente
        };
    }).sort((a, b) => (b.ritmo || -1) - (a.ritmo || -1));

    return o;
};

/* ============================================================================
   PREPACK CONTRA SUELTO — el cronómetro
   ----------------------------------------------------------------------------
   Todo lo de abajo sale de UNA sola idea: el hueco entre un movimiento y el
   siguiente DE LA MISMA PERSONA es lo que costó ese movimiento —caminar hasta
   el sitio y sacar—. No hay ninguna estimación: es el reloj del propio archivo.

   POR QUÉ SE GUARDAN HISTOGRAMAS Y NO LA MEDIANA YA CALCULADA. La mediana de
   varios días NO es el promedio de las medianas de cada día: hay que volver a
   ordenar todas las mediciones juntas. Guardando cuántas veces se midió cada
   valor de segundos —un histograma de 300 casillas como mucho— se recalcula la
   mediana EXACTA de cualquier combinación de fechas sin arrastrar las 87.000
   mediciones sueltas.
   ============================================================================ */

/** Un hueco de más de esto no es trabajo: es refrigerio, reunión o parada. */
export const TOPE_HUECO_SEG = 300;

/**
 * LA DEL MEDIO, y tiene que ser un valor REALMENTE MEDIDO.
 *
 * El promedio de los dos centrales —lo que hace la mediana de manual cuando la
 * muestra es par— da un número que no existe en los datos: el detalle mostraba
 * 23 s donde la celda decía 22. Se toma el de la posición del medio.
 */
const medianaDeHistograma = (h) => {
    const valores = Object.keys(h).map(Number).sort((a, b) => a - b);
    const total = valores.reduce((s, v) => s + h[v], 0);
    if (!total) return null;
    const objetivo = Math.floor(total / 2);
    let acum = 0;
    for (const v of valores) {
        acum += h[v];
        if (acum > objetivo) return v;
    }
    return valores[valores.length - 1];
};

const totalDeHistograma = (h) => Object.keys(h || {}).reduce((s, v) => s + h[v], 0);

/** Suma dos histogramas sin tocar los originales. */
const sumarHistogramas = (a, b) => {
    const o = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(k => { o[k] = (o[k] || 0) + b[k]; });
    return o;
};

/** La clave del tipo de movimiento: pares sueltos, o la curva de la caja. */
const tipoDeFila = (fila) => esPrepack(fila['Código de artículo'])
    ? String(paresDeLaCaja(fila['Código de artículo']))
    : 'suelto';

/**
 * Cronometra una jornada. `filas` son las Finalizada del día ya filtradas, y
 * `totalArchivo` el total de filas del CSV antes de quitar las copias.
 */
export const cronometrarJornada = (filas, totalArchivo) => {
    const porPersona = new Map();
    filas.forEach(r => {
        const u = r['Usuario de selección'] || 'Sin usuario';
        if (!porPersona.has(u)) porPersona.set(u, []);
        porPersona.get(u).push(r);
    });

    const hist = {};
    const histSit = { suelto: { mismo: {}, camino: {} }, prepack: { mismo: {}, camino: {} } };
    const muestras = {};
    const cuenta = {};

    porPersona.forEach((lista, usuario) => {
        lista.sort((a, b) => {
            const ha = horaDePick(a['Hora de selección']);
            const hb = horaDePick(b['Hora de selección']);
            return (ha ? ha.getTime() : 0) - (hb ? hb.getTime() : 0);
        });
        for (let i = 0; i < lista.length; i++) {
            const t = tipoDeFila(lista[i]);
            if (!cuenta[t]) cuenta[t] = { picks: 0, primeros: 0, largos: 0, simultaneos: 0 };
            cuenta[t].picks++;
            if (i === 0) { cuenta[t].primeros++; continue; }

            const h1 = horaDePick(lista[i - 1]['Hora de selección']);
            const h2 = horaDePick(lista[i]['Hora de selección']);
            if (!h1 || !h2) { cuenta[t].simultaneos++; continue; }
            const seg = Math.round((h2 - h1) / 1000);
            // Dos confirmaciones en el MISMO segundo no miden ningún trabajo: el
            // WMS las graba juntas. Se cuentan aparte para que el embudo cierre
            // con el número de mediciones que se muestra arriba.
            if (seg <= 0) { cuenta[t].simultaneos++; continue; }
            if (seg > TOPE_HUECO_SEG) { cuenta[t].largos++; continue; }

            if (!hist[t]) hist[t] = {};
            hist[t][seg] = (hist[t][seg] || 0) + 1;

            const familia = t === 'suelto' ? 'suelto' : 'prepack';
            const donde = (lista[i]['De ubicación'] === lista[i - 1]['De ubicación']) ? 'mismo' : 'camino';
            histSit[familia][donde][seg] = (histSit[familia][donde][seg] || 0) + 1;

            if (!muestras[t]) muestras[t] = [];
            if (muestras[t].length < 6) {
                muestras[t].push({
                    user: usuario,
                    ant: String(lista[i - 1]['Hora de selección'] || '').slice(11, 19),
                    hora: String(lista[i]['Hora de selección'] || '').slice(11, 19),
                    seg: seg,
                    ubi: lista[i]['De ubicación'] || ''
                });
            }
        }
    });

    const movPrepack = filas.filter(r => esPrepack(r['Código de artículo']));
    const cajas = movPrepack.reduce((s, r) => s + (parseInt(r['Cantidad empaquetada'], 10) || 0), 0);
    const paresWms = filas.reduce((s, r) => s + (parseInt(r['Cantidad empaquetada'], 10) || 0), 0);
    const paresReales = filas.reduce((s, r) => s + paresDeLinea(r), 0);

    return {
        total_archivo: totalArchivo || filas.length,
        mov: { suelto: filas.length - movPrepack.length, prepack: movPrepack.length, cajas: cajas },
        pares_wms: paresWms,
        pares_reales: paresReales,
        hist: hist,
        hist_sit: histSit,
        muestras: muestras,
        cuenta: cuenta
    };
};

/** Junta los cronómetros de varios días en uno solo. */
export const juntarCronometros = (cronos) => {
    const buenos = (cronos || []).filter(Boolean);
    if (!buenos.length) return null;

    const o = {
        jornadas: buenos.length,
        total_archivo: buenos.reduce((s, d) => s + (d.total_archivo || 0), 0),
        mov: {
            suelto: buenos.reduce((s, d) => s + d.mov.suelto, 0),
            prepack: buenos.reduce((s, d) => s + d.mov.prepack, 0),
            cajas: buenos.reduce((s, d) => s + d.mov.cajas, 0)
        },
        pares_wms: buenos.reduce((s, d) => s + d.pares_wms, 0),
        pares_reales: buenos.reduce((s, d) => s + d.pares_reales, 0),
        hist: {},
        hist_sit: { suelto: { mismo: {}, camino: {} }, prepack: { mismo: {}, camino: {} } },
        muestras: {},
        cuenta: {}
    };

    buenos.forEach(d => {
        Object.keys(d.hist || {}).forEach(t => { o.hist[t] = sumarHistogramas(o.hist[t], d.hist[t]); });
        ['suelto', 'prepack'].forEach(f => {
            const s = (d.hist_sit || {})[f];
            if (!s) return;
            o.hist_sit[f].mismo = sumarHistogramas(o.hist_sit[f].mismo, s.mismo);
            o.hist_sit[f].camino = sumarHistogramas(o.hist_sit[f].camino, s.camino);
        });
        Object.keys(d.muestras || {}).forEach(t => {
            if (!o.muestras[t] || !o.muestras[t].length) o.muestras[t] = d.muestras[t];
        });
        Object.keys(d.cuenta || {}).forEach(t => {
            if (!o.cuenta[t]) o.cuenta[t] = { picks: 0, primeros: 0, largos: 0, simultaneos: 0 };
            o.cuenta[t].picks += d.cuenta[t].picks;
            o.cuenta[t].primeros += d.cuenta[t].primeros;
            o.cuenta[t].largos += d.cuenta[t].largos;
            o.cuenta[t].simultaneos += (d.cuenta[t].simultaneos || 0);
        });
    });
    return o;
};

/** Cuántas mediciones y cuánto tarda un tipo, leído del histograma. */
export const tiempoDe = (crono, tipo) => {
    const h = (crono && crono.hist && crono.hist[tipo]) || null;
    if (!h) return { n: 0, mediana: null };
    return { n: totalDeHistograma(h), mediana: medianaDeHistograma(h) };
};

/** Lo mismo para una situación: 'suelto'/'prepack' por 'mismo'/'camino'. */
export const tiempoSituacion = (crono, familia, donde) => {
    const h = (((crono || {}).hist_sit || {})[familia] || {})[donde] || null;
    if (!h) return { n: 0, mediana: null };
    return { n: totalDeHistograma(h), mediana: medianaDeHistograma(h) };
};

/**
 * La escalera de un tipo: la más rápida, los cuartos, la del medio y la más
 * lenta, más los valores pegados al corte. Es lo que se abre al tocar el
 * número de segundos, y existe para que nadie tenga que creer en la mediana.
 */
export const escaleraDe = (crono, tipo) => {
    const h = (crono && crono.hist && crono.hist[tipo]) || null;
    if (!h) return null;
    const valores = Object.keys(h).map(Number).sort((a, b) => a - b);
    const total = totalDeHistograma(h);
    if (!total) return null;

    const enPosicion = (pos) => {
        let acum = 0;
        for (const v of valores) { acum += h[v]; if (acum > pos) return v; }
        return valores[valores.length - 1];
    };
    const medio = Math.floor(total / 2);
    const q1 = Math.floor(total / 4);
    const q3 = Math.floor(3 * total / 4);

    const puestos = [
        { pos: 1, seg: valores[0], et: 'la más rápida' },
        { pos: Math.max(1, q1), seg: enPosicion(q1), et: 'una de cada cuatro está por debajo' },
        { pos: medio + 1, seg: enPosicion(medio), et: 'LA DEL MEDIO', medio: true },
        { pos: Math.max(1, q3), seg: enPosicion(q3), et: 'tres de cada cuatro están por debajo' },
        { pos: total, seg: valores[valores.length - 1], et: 'la más lenta' }
    ];

    const centro = [];
    let acum = 0;
    for (const v of valores) {
        const desde = acum + 1, hasta = acum + h[v];
        for (let p = Math.max(desde, medio - 4); p <= Math.min(hasta, medio + 6); p++) centro.push(v);
        acum = hasta;
        if (acum > medio + 6) break;
    }
    return { puestos: puestos, centro: centro, mediana: enPosicion(medio), n: total };
};

/**
 * El embudo: de las filas del archivo a las mediciones que quedan.
 *
 * Es la respuesta a "de dónde salen esas N mediciones", y cada paso dice qué se
 * quita y por qué. Sin esto, el número es un dato que hay que creer.
 */
export const embudoDe = (crono, tipo) => {
    const c = (crono && crono.cuenta && crono.cuenta[tipo]) || null;
    if (!c) return [];
    const nombre = tipo === 'suelto' ? 'son pares sueltos' : 'son cajas de ' + tipo + ' pares';
    return [
        { n: crono.total_archivo, q: 'Filas en el archivo del WMS', p: '' },
        { n: crono.mov.suelto + crono.mov.prepack, q: 'Quitando las Cancelado, que son copias',
          p: 'cada picking real deja dos filas: la tarea y la confirmación' },
        { n: c.picks, q: 'De esas, las que ' + nombre, p: '' },
        { n: c.picks - c.primeros, q: 'Menos el primer movimiento de cada persona',
          p: 'no tiene un movimiento anterior contra el cual medirse' },
        { n: c.picks - c.primeros - (c.simultaneos || 0), q: 'Menos los grabados en el mismo segundo',
          p: 'el WMS confirma varios a la vez: entre ellos no hay trabajo que medir' },
        { n: c.picks - c.primeros - (c.simultaneos || 0) - c.largos,
          q: 'Menos los huecos de más de ' + (TOPE_HUECO_SEG / 60) + ' minutos',
          p: 'son paradas, refrigerio o reuniones: no es trabajo' }
    ];
};
