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
export const paresDeLaCaja = (sku) => {
    const s = String(sku || '').trim();
    if (s.length !== 15) return 1;
    const suf = s.slice(-5);
    const n = parseInt(suf.slice(0, 2), 10);
    return (n > 0 && n <= 24) ? n : 1;
};

export const esPrepack = (sku) => String(sku || '').trim().length === 15;

/**
 * LO QUE CUESTA UN PICK DE PREPACK, MEDIDO CONTRA UNO SUELTO.
 *
 * Daniel no quiere dos productividades, quiere UNA, con el prepack pesando por
 * dentro. El factor se midió con el reloj del propio archivo: el hueco entre un
 * pick y el siguiente ES lo que costó ese pick (descartando los de más de 5
 * minutos, que son paradas). Un pick suelto tarda 18 s.
 *
 * NO cuesta 10 veces más sacar una caja de 10: el trabajo es llegar al sitio,
 * no levantar la caja. Con el pick anterior en el mismo sitio son 9 s contra
 * 18 s; cambiando de sitio, 20 s contra 26 s.
 */
const FACTOR_PREPACK = { 6: 1.28, 8: 1.61, 10: 1.97, 12: 4.11 };

/** El esfuerzo de una línea, en "líneas sueltas equivalentes". */
export const esfuerzoDeLinea = (sku) => {
    if (!esPrepack(sku)) return 1;
    const pares = paresDeLaCaja(sku);
    if (FACTOR_PREPACK[pares]) return FACTOR_PREPACK[pares];
    // Curva no medida: se interpola con las dos vecinas conocidas en vez de
    // contarla como suelta, que la dejaría valiendo lo mismo que un par.
    const medidas = Object.keys(FACTOR_PREPACK).map(Number).sort((a, b) => a - b);
    if (pares <= medidas[0]) return FACTOR_PREPACK[medidas[0]];
    if (pares >= medidas[medidas.length - 1]) return FACTOR_PREPACK[medidas[medidas.length - 1]];
    for (let i = 0; i < medidas.length - 1; i++) {
        const a = medidas[i], b = medidas[i + 1];
        if (pares > a && pares < b) {
            const t = (pares - a) / (b - a);
            return +(FACTOR_PREPACK[a] + t * (FACTOR_PREPACK[b] - FACTOR_PREPACK[a])).toFixed(2);
        }
    }
    return 1;
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
        }
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
