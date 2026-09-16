/*
 * EL MAESTRO DESDE EL POWER PIVOT, PROBADO CONTRA LOS ARCHIVOS DE VERDAD.
 *
 * Usa el MISMO archivo que carga la web -js/services_v245/maestroPowerPivot.js-, sin navegador.
 * Node trae DecompressionStream y Blob, que es lo que usa el lector.
 *
 *     node scratch/probar_maestro_power_pivot.mjs
 *
 * Necesita tres archivos. Por defecto busca los de Daniel; se pueden cambiar con variables:
 *     PIVOT=...   el Power Pivot tal como llega por WhatsApp
 *     MAESTRO=... el maestro trabajado a mano, JSON {titulos, filas}, para comparar
 *     MARCAS=...  la tabla de marcas, JSON con la matriz de Marcas.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(path.join(AQUI, '..', 'js', 'services_v245', 'maestroPowerPivot.js')).href);

const PIVOT = process.env.PIVOT || 'C:/Users/dames/Downloads/Maestro Datamart W38 (15.09.26).xlsx';
const TRABAJADO_XLSX = process.env.TRABAJADO_XLSX || 'C:/Users/dames/OneDrive/danielames.bata/Maestro_Articulos.xlsx';
const MAESTRO = process.env.MAESTRO;
const MARCAS = process.env.MARCAS;

let fallos = 0, total = 0;
const chk = (c, texto) => { total++; if (!c) fallos++; console.log((c ? 'OK    ' : 'FALLA ') + texto); };
const titulo = (t) => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 70 - t.length)));

/* ── 1. LAS REGLAS, SIN ARCHIVOS ─────────────────────────────────────────────────────────── */
titulo('El trimestre de hoy');
chk(M.trimestreDe('2026-09-16') === '2026-Q3', 'septiembre es Q3');
chk(M.trimestreDe('2026-07-01') === '2026-Q3', 'julio tambien');
chk(M.trimestreDe('2026-06-30') === '2026-Q2', 'junio es Q2');
chk(M.trimestreDe('2026-10-01') === '2026-Q4', 'octubre es Q4');
chk(M.trimestreDe('2027-01-15') === '2027-Q1', 'enero del año siguiente es Q1');
chk(M.trimestreDe('') === '', 'sin fecha no inventa nada');

titulo('La temporada (regla de Daniel)');
const Q = '2026-Q3';
chk(M.temporadaDe('2026-Q3', Q) === 'T. Actual', 'el Q de hoy es actual');
chk(M.temporadaDe('2026-Q4', Q) === 'T. Actual', 'lo que viene, actual');
chk(M.temporadaDe('2027-Q1', Q) === 'T. Actual', 'el año que viene, actual');
chk(M.temporadaDe('2026-Q2', Q) === 'T. Anterior', 'el Q de antes, anterior');
chk(M.temporadaDe('2019-Q1', Q) === 'T. Anterior', 'lo viejo, anterior');
chk(M.temporadaDe('ND', Q) === 'T. Anterior', '"ND" va a anterior');
chk(M.temporadaDe('(en blanco)', Q) === 'T. Anterior', '"(en blanco)" va a anterior');
chk(M.temporadaDe('', Q) === 'T. Anterior', 'vacio va a anterior');
chk(M.temporadaDe(' 2026-Q3 ', Q) === 'T. Actual', 'con espacios de mas sigue siendo actual');

/* ── 2. LOS ARCHIVOS ─────────────────────────────────────────────────────────────────────── */
if (!fs.existsSync(PIVOT)) {
    console.log('\nNo esta el Power Pivot en ' + PIVOT + ': se prueban solo las reglas.');
    console.log('\n' + (fallos ? `FALLARON ${fallos} de ${total}` : `TODO BIEN (${total})`));
    process.exit(fallos ? 1 : 0);
}

titulo('¿Es un Power Pivot?');
const pivot = await fs.openAsBlob(PIVOT);
chk(await M.esPowerPivot(pivot), 'el Maestro Datamart SI (' + (pivot.size / 1048576).toFixed(1) + ' MB)');
if (fs.existsSync(TRABAJADO_XLSX)) {
    chk(!(await M.esPowerPivot(await fs.openAsBlob(TRABAJADO_XLSX))),
        'el maestro trabajado en valores NO: ese sigue por el camino de siempre');
}

titulo('Leer el Power Pivot');
const t0 = performance.now();
let ultimo = 0, avisos = 0;
const leido = await M.leerPowerPivot(pivot, (f) => { avisos++; if (f < ultimo) avisos = -9999; ultimo = f; });
const ms = Math.round(performance.now() - t0);
chk(leido.hoja === 'Maestro', 'encontro la hoja por su nombre: "' + leido.hoja + '"');
chk(leido.titulos.length === 13, 'trae 13 columnas: ' + leido.titulos.join(' | '));
chk(leido.filas.length === 30370, 'y 30,370 articulos (de 792,131 filas del rango): ' + leido.filas.length);
chk(!leido.filas.some(r => /^total/i.test(String(r[leido.titulos.indexOf('CodArticulo')]))),
    'la fila "Total" del final no entro como articulo');
chk(avisos > 3, 'avisa el avance mientras lee, y nunca para atras (' + avisos + ' avisos)');
chk(ms < 60000, 'tardo ' + (ms / 1000).toFixed(1) + ' s');
const codigos = leido.filas.map(r => r[leido.titulos.indexOf('CodArticulo')]);
chk(new Set(codigos).size === codigos.length, 'ningun codigo repetido');
chk(codigos[0] === '0011321', 'los codigos conservan los ceros de adelante: ' + codigos[0]);

titulo('La tabla de marcas');
const matrizMarcas = MARCAS ? JSON.parse(fs.readFileSync(MARCAS, 'utf8')) : null;
let pares = null;
if (matrizMarcas) {
    pares = M.leerTablaMarcas(matrizMarcas);
    chk(pares.length === 63, 'lee las 63 equivalencias de Marcas.xlsx: ' + pares.length);
    chk(new Set(pares.map(p => p.Marcas)).size === 12, 'en 12 marcas');
} else {
    console.log('(sin MARCAS=... no se prueba la lectura de Marcas.xlsx)');
}
let error = '';
try { M.leerTablaMarcas([['Codigo', 'Nombre'], ['a', 'b']]); } catch (e) { error = e.message; }
chk(/MarcaStd/.test(error), 'un Excel sin las columnas MarcaStd y Marcas se rechaza con un mensaje claro');

titulo('Convertir al maestro que se publica');
if (!pares) {
    console.log('(sin MARCAS=... no se puede convertir)');
} else {
    const dic = M.diccionarioDeMarcas(pares);
    const { filas, resumen } = M.convertirAlMaestro(leido, dic, '2026-Q3');
    chk(JSON.stringify(filas[0]) === JSON.stringify(M.COLUMNAS_MAESTRO),
        'los titulos quedan en el orden del maestro publicado, con "Tipo Obsolencia"');
    chk(filas.length === 30371, 'titulos + 30,370 articulos');
    chk(resumen.temporadaActual === 2525 && resumen.temporadaAnterior === 27845,
        `temporada: ${resumen.temporadaActual} actual y ${resumen.temporadaAnterior} anterior (lo que dio el calculo aparte: 2,525 y 27,845)`);
    chk(resumen.marcasDesconocidas.length === 0, 'ninguna marca desconocida en el W38');
    chk(typeof filas[1][12] === 'number', 'Total queda como NUMERO, como en el maestro publicado');
    chk(filas.slice(1).every(r => typeof r[1] === 'string'), 'CodArticulo queda como TEXTO en todas las filas');

    // Una marca que no esta en la tabla
    const conRara = { titulos: leido.titulos, filas: leido.filas.slice(0, 5).map(r => r.slice()) };
    conRara.filas[0][leido.titulos.indexOf('MarcaStd')] = 'Crocs';
    const r2 = M.convertirAlMaestro(conRara, dic, '2026-Q3');
    chk(r2.filas[1][13] === 'Otros', 'una MarcaStd que no esta en la tabla sale como "Otros"');
    chk(r2.resumen.marcasDesconocidas.length === 1 && r2.resumen.marcasDesconocidas[0].marcaStd === 'Crocs',
        'y queda anotada para avisarlo antes de publicar');

    // Si el pivot perdiera una columna
    const sinColeccion = { titulos: leido.titulos.map(t => t === 'Coleccion PO' ? 'Otra cosa' : t), filas: leido.filas.slice(0, 3) };
    let e2 = '';
    try { M.convertirAlMaestro(sinColeccion, dic, '2026-Q3'); } catch (e) { e2 = e.message; }
    chk(/Coleccion PO/.test(e2), 'si al Power Pivot le falta una columna, NO se publica y dice cual');

    // Si el pivot viniera con las columnas en otro orden
    const orden = leido.titulos.map((t, i) => i).reverse();
    const alReves = { titulos: orden.map(i => leido.titulos[i]), filas: leido.filas.slice(0, 50).map(r => orden.map(i => r[i])) };
    const r3 = M.convertirAlMaestro(alReves, dic, '2026-Q3');
    const r4 = M.convertirAlMaestro({ titulos: leido.titulos, filas: leido.filas.slice(0, 50) }, dic, '2026-Q3');
    chk(JSON.stringify(r3.filas) === JSON.stringify(r4.filas),
        'con las columnas del pivot EN OTRO ORDEN, el maestro sale identico: no se corre nada');

    /* ── 3. CONTRA EL MAESTRO QUE DANIEL HIZO A MANO ── */
    titulo('Contra el maestro que Daniel hizo a mano');
    if (!MAESTRO || !fs.existsSync(MAESTRO)) {
        console.log('(sin MAESTRO=... no se compara)');
    } else {
        const T = JSON.parse(fs.readFileSync(MAESTRO, 'utf8'));
        chk(JSON.stringify(T.titulos) === JSON.stringify(M.COLUMNAS_MAESTRO),
            'su maestro tiene EXACTAMENTE las mismas 15 columnas, en el mismo orden');
        const mio = {};
        filas.slice(1).forEach(r => { mio[r[1]] = r; });
        const suyo = {};
        T.filas.forEach(r => { suyo[String(r[1]).trim()] = r; });
        const comunes = Object.keys(suyo).filter(k => mio[k]);
        chk(comunes.length === T.filas.length, `los ${T.filas.length} articulos de su maestro estan en el pivot`);

        const iCol = 9, iStd = 8;
        let marcaMal = 0, marcaMalPorCambio = 0, tempMal = 0, tempMalPorCambio = 0, baseMal = 0;
        comunes.forEach(k => {
            const a = mio[k], b = suyo[k];
            if (String(a[13]) !== String(b[13])) {
                if (String(a[iStd]).trim() !== String(b[iStd]).trim()) marcaMalPorCambio++; else marcaMal++;
            }
            if (String(a[14]) !== String(b[14])) {
                if (String(a[iCol]).trim() !== String(b[iCol]).trim()) tempMalPorCambio++; else tempMal++;
            }
        });
        chk(marcaMal === 0, `MARCAS: cero diferencias de regla (${marcaMalPorCambio} por MarcaStd que cambio de una semana a otra)`);
        chk(tempMal === 0, `TEMPORADA: cero diferencias de regla (${tempMalPorCambio} por Coleccion PO que cambio de una semana a otra)`);
    }
}

console.log('\n' + (fallos ? `FALLARON ${fallos} de ${total}` : `TODO BIEN (${total} de ${total})`));
process.exit(fallos ? 1 : 0);
