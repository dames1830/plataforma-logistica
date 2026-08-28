/* Cuanto tarda getCol antes y despues, con el Maestro real. Las dos versiones se recortan
   del archivo: la nueva del codigo actual, la vieja de lo que habia en git. */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sacar = (src, marca) => {
    const i = src.indexOf(marca);
    return src.slice(i, src.indexOf('\n};', i) + 3);
};
const armar = async (cuerpo, nom) => {
    const f = new URL('./_gc_' + nom + '.tmp.mjs', import.meta.url);
    writeFileSync(f, cuerpo.replace('export const getCol', 'export const getCol'));
    const m = await import(f.href + '?t=' + Date.now());
    unlinkSync(f); return m.getCol;
};

const ahora = readFileSync(new URL('../js/services_v245/csvHub_v6.js', import.meta.url), 'utf-8');
const antes = execSync('git show HEAD:js/services_v245/csvHub_v6.js', { encoding: 'utf-8', maxBuffer: 1 << 28 });

const nueva = await armar(
    sacar(ahora, 'const _normCache = new Map();').replace('\n};','\n};') + '\n'
    + sacar(ahora, 'export const getCol = (row, names)'), 'nueva');
const vieja = await armar(sacar(antes, 'export const getCol = (row, names)'), 'vieja');

const B = 'https://logistics-backend-wv0x.onrender.com/api/logistics/';
const r = await fetch(B + 'articulos?date=MASTER');
const c = await r.json();
const maestro = c.data !== undefined ? c.data : c;
console.log('Maestro:', maestro.length, 'filas\n');

const NOMBRES = [
  ['CodArticulo','Cod Articulo','CODARTICULO','Articulo','ARTICULO','CODIGO'],
  ['Gender RIMS','GENDER RIMS','GenderRIMS','GENDER_RIMS'],
  ['G. Gender','G.Gender','G GENDER','GGender'],
  ['Marcas','MARCAS','Marca','MARCA'],
  ['Temporada','TEMPORADA','Season','SEASON']
];
const medir = (fn) => {
  const t = Date.now();
  for (const nombres of NOMBRES) for (let k = 0; k < maestro.length; k++) fn(maestro[k], nombres);
  return Date.now() - t;
};
const a = medir(vieja), b = medir(nueva);
console.log('  antes:', a, 'ms');
console.log('  ahora:', b, 'ms   (' + Math.round(100 - 100 * b / a) + '% menos)');
// Y que devuelvan LO MISMO, que es lo que importa
let iguales = 0, distintos = 0;
for (const nombres of NOMBRES) for (let k = 0; k < maestro.length; k += 37)
  (String(vieja(maestro[k], nombres)) === String(nueva(maestro[k], nombres)) ? iguales++ : distintos++);
console.log('\n  devuelven lo mismo en', iguales, 'casos ·', distintos, 'distintos');
