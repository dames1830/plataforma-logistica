/* ANÁLISIS RESERVA: qué va a mostrar la pantalla, sin abrir la pantalla.
 *
 * Corre el motor REAL contra los datos que hay publicados AHORA. Sirve para ver los
 * números antes de que nadie entre, y para comprobar de qué corte es el sello.
 *
 *     node scratch/prueba_reserva_hoy.mjs
 *
 * NO COPIA CÓDIGO: recorta las funciones del archivo de verdad en el momento de correr.
 * Una copia pegada acá se quedaría vieja y mentiría, que es justo lo que pasa con
 * `almacenaje_module.js`. Se recorta y no se importa entero porque el módulo arrastra el
 * sincronizador, y ese espera un navegador.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const leer = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8');
const recortar = (src, nombre, fin = '\n};') => {
    const i = src.indexOf(nombre);
    if (i < 0) throw new Error('no está en el archivo: ' + nombre);
    return src.slice(i, src.indexOf(fin, i) + fin.length).replace('export const', 'const');
};

const RC = leer('../js/reportes/reserva_consolidacion.js');
const HUB = leer('../js/services_v245/csvHub_v6.js');
const partes = [
    recortar(HUB, 'export const extractTalla'),
    RC.match(/^const FORMA_PREPACK = .*?;$/m)[0],
    RC.match(/^export const NIVELES_RESERVA = .*?;$/m)[0].replace('export const', 'const'),
    RC.match(/^export const COLS_RESERVA = .*?;$/m)[0].replace('export const', 'const'),
    recortar(RC, 'export const paletaDeReservaExiste'),
    recortar(RC, 'export const indicePorSku'),
    RC.match(/^export const _padreDeProducto = .*?;$/m)[0].replace('export const', 'const'),
    recortar(RC, 'export const consolidacionDeReserva'),
    recortar(RC, 'export const selloDeLaFoto'),
    recortar(RC, 'export const fotoChicaDeReserva', '});')
];
const tmp = new URL('./_motor_reserva.tmp.mjs', import.meta.url);
writeFileSync(tmp, partes.join('\n\n') + '\nexport { consolidacionDeReserva, indicePorSku, selloDeLaFoto, fotoChicaDeReserva };\n');
const M = await import(tmp.href + '?t=' + Date.now());
unlinkSync(tmp);

const B = 'https://logistics-backend-wv0x.onrender.com/api/logistics/';
const bajar = async (a) => {
    const r = await fetch(B + a + '?date=MASTER&t=' + Date.now());
    const c = await r.json();
    return { filas: (c && c.data !== undefined) ? c.data : c, sello: c.updated_at };
};

const res = await bajar('analisis_sku_reserva');
const mae = await bajar('articulos');
console.log('reserva publicada :', res.filas.length, 'filas ·', res.sello);
console.log('maestro publicado :', mae.filas.length, 'filas');

const c = M.consolidacionDeReserva(res.filas, { porSku: M.indicePorSku(mae.filas, null) });
if (!c) { console.log('NO SE PUDO CALCULAR'); process.exit(1); }

const s = (k) => c.matriz.reduce((a, x) => a + (x[k] || 0), 0);
const mil = (n) => Math.round(n).toLocaleString('es-PE');
console.log('\n=== LA MATRIZ ===');
console.log('  existen ', mil(s('existen')), ' ocupadas', mil(s('ocupadas')),
            '(' + Math.round(100 * s('ocupadas') / s('existen')) + '%)  libres', mil(s('libres')));
console.log('  footwear', mil(s('fw')), ' no FW', mil(s('nofw')), ' pares FW', mil(s('pares')));
console.log('  cuadra:', s('ocupadas') === s('fw') + s('nofw')
            && s('existen') === s('ocupadas') + s('libres') ? 'SÍ' : 'NO');
console.log('  fragmentados:', c.fragTotal, 'artículos en', mil(c.fragUbic), 'ubicaciones');

const DIAS = { dom: false, lun: true, mar: true, mie: true, jue: true, vie: true, sab: true };
const sello = M.selloDeLaFoto(new Date(), { activa: true, hora: '19:00', dias: DIAS },
                                          { activa: true, hora: '07:00', dias: DIAS });
console.log('\n=== EL SELLO ===');
console.log(' ', sello ? sello.fecha.split('-').reverse().join('/') + ' · ' + sello.hora : 'sin foto');
console.log('  la foto pesa', Math.round(JSON.stringify(M.fotoChicaDeReserva(c, sello)).length / 1024), 'KB');
