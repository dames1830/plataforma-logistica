/* ═══════════════════════════════════════════════════════════════════════════════════════
 * EL MAESTRO DE ARTÍCULOS, DESDE EL POWER PIVOT
 *
 * Daniel, 16-sep-2026: *"me pasan un maestro de artículos que es un Power Pivot, demasiado
 * pesado; quiero cargarlo a la web así como está, y que la web lo convierta en valores y le
 * agregue la temporada y la marca"*. Hasta hoy lo pasaba a valores a mano y le agregaba las dos
 * columnas antes de publicarlo.
 *
 * CÓMO LLEGA. Por WhatsApp, como `Maestro Datamart W38 (15.09.26).xlsx`. Medido sobre ese:
 *
 *     168 MB, de los cuales 137 son el modelo de Power Pivot (xl/model/item.data, VertiPaq)
 *     hoja "Maestro": filtros arriba, títulos en la fila 10, datos desde la 11, columnas B a N
 *     el rango dice 792.131 filas, pero solo 30.370 tienen artículo: el resto están vacías
 *     y al final una fila "Total" que no es un artículo
 *
 * POR QUÉ NO SE USA LA LIBRERÍA DE EXCEL. SheetJS carga el zip entero y TODAS las hojas en
 * memoria: con 168 MB -216 de texto solo en la hoja- la pestaña se cuelga. Acá se lee el índice
 * del zip -que está al final del archivo-, se ubican las dos partes que sirven y se descomprimen
 * POR TROZOS con `DecompressionStream`, que viene con el navegador. El modelo de 137 MB ni se
 * toca. Medido en el navegador: 4 segundos y 31 MB de memoria.
 *
 * EL ARCHIVO NO SE SUBE A NINGÚN LADO. Se lee en la PC de quien lo carga y se publica solo el
 * resultado en valores, que es lo mismo que se publicaba antes a mano.
 *
 * ESTE ARCHIVO NO DIBUJA NADA. Lee y convierte; la pantalla vive en dashboard_v28.js. Así se
 * puede probar solo, contra el archivo de verdad, sin montar la plataforma:
 *     node scratch/probar_maestro_power_pivot.mjs
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/* EL ORDEN DE LAS COLUMNAS DEL MAESTRO PUBLICADO, Y NO SE NEGOCIA.
 *
 * Hay pantallas que leen el maestro POR POSICIÓN -`raw[1]` es el código, `raw[9]` la colección,
 * `raw[13]` la marca-. El 12-ago-2026 la tabla estuvo corrida un lugar y el cruce daba 1 código
 * de 29.465 sin avisar nada. Por eso cada columna se busca POR SU NOMBRE en el Power Pivot y se
 * pone en ESTE lugar, venga en el orden que venga: si mañana el pivot agrega o reordena una
 * columna, el maestro publicado queda igual. */
export const COLUMNAS_MAESTRO = [
    'CodCanal', 'CodArticulo', 'G. Gender', 'Gender RIMS', 'Category RIMS', 'Subcategory RIMS',
    'Gpo School', 'TemCom', 'MarcaStd', 'Coleccion PO', 'Tipo Obsolencia', 'Weeks', 'Total',
    'Marcas', 'Temporada'
];

/* Las dos que agrega la web. El resto tiene que venir en el Power Pivot. */
const CALCULADAS = ['Marcas', 'Temporada'];

/* EL MISMO DATO CON OTRO NOMBRE. El Power Pivot dice "Tipo Obsolescencia" y el maestro que se
   publica desde siempre dice "Tipo Obsolencia". Se publica con el nombre de siempre. */
const ALIAS = { 'tipo obsolescencia': 'Tipo Obsolencia' };

const clave = (t) => String(t == null ? '' : t).trim().toLowerCase();

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * LEER EL ZIP SIN CARGARLO
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/** El índice del zip: { 'xl/worksheets/sheet1.xml': { metodo, comprimido, tamano, offset } } */
const leerIndice = async (archivo) => {
    const cola = new DataView(await archivo.slice(Math.max(0, archivo.size - 65557)).arrayBuffer());
    let eocd = -1;
    for (let i = cola.byteLength - 22; i >= 0; i--) {
        if (cola.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('No parece un archivo de Excel (.xlsx): no se encontró su índice.');
    const nEntradas = cola.getUint16(eocd + 10, true);
    const tamIndice = cola.getUint32(eocd + 12, true);
    const iniIndice = cola.getUint32(eocd + 16, true);
    /* ZIP64 guarda 0xFFFFFFFF en estos campos. Pasa con archivos de más de 4 GB: el Power Pivot
       está lejos, pero si algún día llega, vale más un mensaje claro que un índice mal leído. */
    if (iniIndice === 0xFFFFFFFF || tamIndice === 0xFFFFFFFF) {
        throw new Error('El archivo es demasiado grande para leerlo en el navegador (más de 4 GB).');
    }
    const idx = new DataView(await archivo.slice(iniIndice, iniIndice + tamIndice).arrayBuffer());
    const dec = new TextDecoder();
    const partes = {};
    let p = 0;
    for (let n = 0; n < nEntradas; n++) {
        if (idx.getUint32(p, true) !== 0x02014b50) break;
        const metodo = idx.getUint16(p + 10, true);
        const comprimido = idx.getUint32(p + 20, true);
        const tamano = idx.getUint32(p + 24, true);
        const largoNombre = idx.getUint16(p + 28, true);
        const largoExtra = idx.getUint16(p + 30, true);
        const largoComentario = idx.getUint16(p + 32, true);
        const offset = idx.getUint32(p + 42, true);
        const nombre = dec.decode(new Uint8Array(idx.buffer, idx.byteOffset + p + 46, largoNombre));
        partes[nombre] = { metodo, comprimido, tamano, offset };
        p += 46 + largoNombre + largoExtra + largoComentario;
    }
    return partes;
};

/* DEJAR RESPIRAR A LA PANTALLA. Los trozos del archivo llegan uno detrás de otro sin soltar
   nunca el hilo: en la primera prueba en el navegador la barra de avance no se pintó ni una vez
   en los 4 segundos de lectura, y la pantalla parecía colgada. Cada 50 ms se suelta un instante.
   Con MessageChannel y no con setTimeout: con la pestaña en segundo plano el navegador frena los
   setTimeout a uno por segundo, y la lectura tardaría un minuto en vez de cuatro segundos. */
const respirar = () => new Promise((listo) => {
    if (typeof MessageChannel !== 'function') { setTimeout(listo, 0); return; }
    const canal = new MessageChannel();
    canal.port1.onmessage = () => { canal.port1.close(); listo(); };
    canal.port2.postMessage(0);
});

/** Una parte del zip, como texto y por trozos. `alTrozo(texto)` recibe cada pedazo. */
const leerParte = async (archivo, parte, alTrozo) => {
    const cab = new DataView(await archivo.slice(parte.offset, parte.offset + 30).arrayBuffer());
    if (cab.getUint32(0, true) !== 0x04034b50) throw new Error('El archivo de Excel está dañado.');
    const desde = parte.offset + 30 + cab.getUint16(26, true) + cab.getUint16(28, true);
    let flujo = archivo.slice(desde, desde + parte.comprimido).stream();
    if (parte.metodo === 8) flujo = flujo.pipeThrough(new DecompressionStream('deflate-raw'));
    else if (parte.metodo !== 0) throw new Error('El archivo de Excel usa una compresión que no se puede leer.');
    const lector = flujo.pipeThrough(new TextDecoderStream()).getReader();
    let respiro = Date.now();
    for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        alTrozo(value);
        if (Date.now() - respiro > 50) { await respirar(); respiro = Date.now(); }
    }
};

/** La parte entera como texto: SOLO para las chicas (workbook.xml, sus relaciones). */
const leerParteEntera = async (archivo, parte) => {
    let t = '';
    await leerParte(archivo, parte, (trozo) => { t += trozo; });
    return t;
};

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desescapar = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()] || m;
});

/**
 * ¿ES UN POWER PIVOT? Se mira solo el índice del zip -unos KB del final del archivo-, así que
 * es instantáneo aunque pese 168 MB. Tiene que decidirse ANTES de pasárselo a la librería de
 * Excel: con un Power Pivot, esa librería colgaría la pestaña.
 */
export const esPowerPivot = async (archivo) => {
    try {
        const partes = await leerIndice(archivo);
        return Object.keys(partes).some(n => /^xl\/model\//i.test(n));
    } catch (e) { return false; }
};

/**
 * Lee la tabla del Power Pivot. Devuelve { titulos: ['CodCanal', ...], filas: [[...], ...] }
 * con los valores TAL CUAL vienen -todo texto-, sin convertir nada.
 *
 *   alAvanzar(fraccion, que)   opcional: de 0 a 1, y un texto de lo que está haciendo
 */
export const leerPowerPivot = async (archivo, alAvanzar = () => {}) => {
    const partes = await leerIndice(archivo);

    /* LA HOJA SE BUSCA POR NOMBRE. Hoy es la primera, pero asumir `sheet1.xml` es lo mismo que
       leer columnas por posición: funciona hasta que alguien agrega una hoja adelante. */
    alAvanzar(0.01, 'Abriendo el archivo');
    const libro = await leerParteEntera(archivo, partes['xl/workbook.xml'] || {});
    const rels = await leerParteEntera(archivo, partes['xl/_rels/workbook.xml.rels'] || {});
    const destinos = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = (/\bId="([^"]+)"/.exec(m[0]) || [])[1];
        const t = (/\bTarget="([^"]+)"/.exec(m[0]) || [])[1];
        if (id && t) destinos[id] = t.replace(/^\/?(xl\/)?/, 'xl/');
    }
    const hojas = [];
    for (const m of libro.matchAll(/<sheet\b[^>]*>/g)) {
        const nombre = desescapar((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || '');
        const rid = (/\br:id="([^"]+)"/.exec(m[0]) || [])[1];
        if (rid && destinos[rid]) hojas.push({ nombre, parte: destinos[rid] });
    }
    const hoja = hojas.filter(h => clave(h.nombre) === 'maestro')[0] || hojas[0];
    if (!hoja || !partes[hoja.parte]) throw new Error('No se encontró la hoja "Maestro" en el archivo.');

    /* LAS CADENAS COMPARTIDAS. Cada celda de texto guarda un número que apunta acá. */
    const cadenas = [];
    if (partes['xl/sharedStrings.xml']) {
        alAvanzar(0.03, 'Leyendo los textos');
        let buf = '';
        await leerParte(archivo, partes['xl/sharedStrings.xml'], (trozo) => {
            buf += trozo;
            let pos = 0, fin;
            while ((fin = buf.indexOf('</si>', pos)) >= 0) {
                const si = buf.slice(pos, fin).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');   // la fonética no es texto
                let texto = '';
                for (const t of si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) texto += t[1];
                cadenas.push(desescapar(texto));
                pos = fin + 5;
            }
            buf = buf.slice(pos);
        });
    }

    /* LA HOJA, FILA POR FILA, sin guardar nunca el texto entero -son 216 MB-. */
    const total = partes[hoja.parte].tamano || 1;
    let leidos = 0, ultimoAviso = 0;
    let titulos = null;          // { 'B': 'CodCanal', ... } de la fila de títulos
    let colArticulo = null;
    const filas = [];
    let buf = '';

    const valorDe = (celda) => {
        const t = (/\bt="([^"]+)"/.exec(celda.abre) || [])[1] || 'n';
        if (t === 'inlineStr') {
            let x = '';
            for (const m of celda.cuerpo.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) x += m[1];
            return desescapar(x);
        }
        const v = (/<v>([\s\S]*?)<\/v>/.exec(celda.cuerpo) || [])[1];
        if (v === undefined) return '';
        if (t === 's') return cadenas[+v] !== undefined ? cadenas[+v] : '';
        return desescapar(v);
    };

    const procesarFila = (xml) => {
        const celdas = {};
        for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const ref = (/\br="([A-Z]+)\d+"/.exec(m[1]) || [])[1];
            if (ref) celdas[ref] = valorDe({ abre: m[1], cuerpo: m[2] || '' });
        }
        if (!titulos) {
            /* La fila de títulos es la que dice CodArticulo. Hoy es la 10, pero arriba van los
               filtros de la tabla dinámica y cambian de largo según cuántos se pongan. */
            const col = Object.keys(celdas).filter(k => clave(celdas[k]) === 'codarticulo')[0];
            if (col) { titulos = celdas; colArticulo = col; }
            return;
        }
        const art = String(celdas[colArticulo] || '').trim();
        if (!art) return;                                   // filas vacías: hay 761.751
        if (/^total/i.test(art)) return;                    // la fila "Total" del final
        filas.push(celdas);
    };

    await leerParte(archivo, partes[hoja.parte], (trozo) => {
        leidos += trozo.length;
        buf += trozo;
        let pos = 0, fin;
        while ((fin = buf.indexOf('</row>', pos)) >= 0) {
            procesarFila(buf.slice(pos, fin));
            pos = fin + 6;
        }
        buf = buf.slice(pos);
        if (leidos - ultimoAviso > 4e6) {
            ultimoAviso = leidos;
            alAvanzar(0.05 + 0.9 * Math.min(1, leidos / total),
                      `Recorriendo la hoja: ${filas.length.toLocaleString('es-PE')} artículos`);
        }
    });

    if (!titulos) throw new Error('No se encontró la fila de títulos: ninguna fila dice "CodArticulo".');
    const letras = Object.keys(titulos).filter(k => String(titulos[k]).trim() !== '');
    return {
        titulos: letras.map(k => String(titulos[k]).trim()),
        filas: filas.map(c => letras.map(k => c[k] === undefined ? '' : c[k])),
        hoja: hoja.nombre
    };
};

/* ─────────────────────────────────────────────────────────────────────────────────────────
 * CONVERTIR AL MAESTRO QUE SE PUBLICA
 * Todo lo de acá abajo es PURO: no lee archivos ni toca la red. Se prueba solo.
 * ───────────────────────────────────────────────────────────────────────────────────────── */

/** '2026-09-16' → '2026-Q3'. Se le pasa la fecha LÓGICA de la jornada, nunca `toISOString()`. */
export const trimestreDe = (fechaIso) => {
    const m = /^(\d{4})-(\d{2})/.exec(String(fechaIso || ''));
    if (!m) return '';
    return `${m[1]}-Q${Math.ceil(parseInt(m[2], 10) / 3)}`;
};

/**
 * LA TEMPORADA, con la regla de Daniel: *"hoy es Q3; todo lo que es Q3 es temporada actual, para
 * adelante; anterior es del Q2 para atrás"*. Comprobada contra su maestro del 05-sep: coincide en
 * todos los artículos cuya colección no cambió entre esa semana y la siguiente.
 *
 * Solo cuenta como actual una colección con forma de trimestre (AAAA-QN). "ND" y "(en blanco)"
 * son anterior, que es como él las marcaba. La comparación de texto sirve porque el formato es
 * fijo: '2027-Q1' > '2026-Q4'.
 */
export const temporadaDe = (coleccion, trimestreActual) => {
    const c = String(coleccion == null ? '' : coleccion).trim();
    return (/^\d{4}-Q[1-4]$/.test(c) && trimestreActual && c >= trimestreActual) ? 'T. Actual' : 'T. Anterior';
};

/**
 * La tabla de marcas publicada -[{MarcaStd, Marcas}]- como diccionario para buscar. La clave va
 * sin espacios de más y en minúsculas: "Bata 3D" y "Bata 3d" son la misma MarcaStd.
 */
export const diccionarioDeMarcas = (pares) => {
    const d = {};
    (pares || []).forEach(p => {
        const k = clave(p && p.MarcaStd);
        const v = String((p && p.Marcas) == null ? '' : p.Marcas).trim();
        if (p && p.MarcaStd != null && v) d[k] = v;
    });
    return d;
};

/**
 * Del Power Pivot leído al maestro listo para publicar.
 *
 *   leido            lo que devuelve `leerPowerPivot`
 *   marcas           `diccionarioDeMarcas(tabla publicada)`
 *   trimestreActual  `trimestreDe(fecha lógica de hoy)`
 *
 * Devuelve { filas, resumen }. `filas` tiene la MISMA forma que da la librería de Excel con el
 * maestro trabajado -la primera fila son los títulos-, así que entra tal cual a `revisarMaestro`
 * y a `publicarMaestro`, que no cambian.
 */
export const convertirAlMaestro = (leido, marcas, trimestreActual) => {
    if (!leido || !Array.isArray(leido.titulos)) throw new Error('No hay datos leídos del Power Pivot.');
    const donde = {};
    leido.titulos.forEach((t, i) => {
        const nombre = ALIAS[clave(t)] || String(t).trim();
        if (donde[clave(nombre)] === undefined) donde[clave(nombre)] = i;
    });

    /* SI FALTA UNA COLUMNA, NO SE PUBLICA. Un maestro al que le falta la colección o el gender
       deja las tareas sin zona y los reportes sin categoría, y no avisa nada. */
    const faltan = COLUMNAS_MAESTRO.filter(c => CALCULADAS.indexOf(c) < 0 && donde[clave(c)] === undefined);
    if (faltan.length) {
        throw new Error(`Al Power Pivot le faltan columnas: ${faltan.join(', ')}. No se publicó nada.`);
    }

    const iMarcaStd = donde[clave('MarcaStd')];
    const iColeccion = donde[clave('Coleccion PO')];
    const desconocidas = {};
    let actual = 0, anterior = 0;

    const datos = leido.filas.map(r => {
        const marcaStd = String(r[iMarcaStd] == null ? '' : r[iMarcaStd]).trim();
        let marca = marcas[clave(marcaStd)];
        /* MARCA DESCONOCIDA → OTROS. Daniel: "si aparece una marca desconocida, yo la pongo como
           Otros". Se cuenta para decirlo ANTES de publicar: puede que no sea Otros de verdad. */
        if (!marca) { marca = 'Otros'; desconocidas[marcaStd] = (desconocidas[marcaStd] || 0) + 1; }
        const temporada = temporadaDe(r[iColeccion], trimestreActual);
        if (temporada === 'T. Actual') actual++; else anterior++;

        return COLUMNAS_MAESTRO.map(c => {
            if (c === 'Marcas') return marca;
            if (c === 'Temporada') return temporada;
            const v = r[donde[clave(c)]];
            const s = v == null ? '' : String(v);
            /* TOTAL ES NÚMERO. En el maestro publicado desde siempre es la única columna numérica;
               lo demás es texto, y CodArticulo tiene que conservar los ceros de adelante. */
            if (c === 'Total') return /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : s;
            return s;
        });
    });

    return {
        filas: [COLUMNAS_MAESTRO.slice()].concat(datos),
        resumen: {
            articulos: datos.length,
            trimestreActual,
            temporadaActual: actual,
            temporadaAnterior: anterior,
            marcasDesconocidas: Object.keys(desconocidas)
                .map(k => ({ marcaStd: k || '(vacía)', articulos: desconocidas[k] }))
                .sort((a, b) => b.articulos - a.articulos),
            marcaStdDistintas: new Set(leido.filas.map(r => String(r[iMarcaStd] == null ? '' : r[iMarcaStd]).trim())).size
        }
    };
};

/**
 * La tabla de marcas desde su Excel (Marcas.xlsx): la matriz que da la librería de Excel, con
 * los títulos en la primera fila. Busca las columnas POR NOMBRE. Devuelve [{MarcaStd, Marcas}].
 */
export const leerTablaMarcas = (matriz) => {
    if (!Array.isArray(matriz) || matriz.length < 2) throw new Error('El archivo de marcas está vacío.');
    const tit = (matriz[0] || []).map(clave);
    const iStd = tit.indexOf('marcastd');
    const iMarca = tit.indexOf('marcas') >= 0 ? tit.indexOf('marcas') : tit.indexOf('marca');
    if (iStd < 0 || iMarca < 0) {
        throw new Error('El archivo de marcas tiene que traer las columnas "MarcaStd" y "Marcas".');
    }
    const vistos = {};
    const pares = [];
    for (const r of matriz.slice(1)) {
        if (!r) continue;
        const std = String(r[iStd] == null ? '' : r[iStd]).trim();
        const marca = String(r[iMarca] == null ? '' : r[iMarca]).trim();
        if (!std || !marca) continue;
        if (vistos[clave(std)]) continue;      // repetida: vale la primera, como en Excel
        vistos[clave(std)] = true;
        pares.push({ MarcaStd: std, Marcas: marca });
    }
    if (!pares.length) throw new Error('El archivo de marcas no trae ninguna equivalencia.');
    return pares;
};
