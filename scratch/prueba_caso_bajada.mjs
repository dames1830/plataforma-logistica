/* Prueba casoDelItem EXTRAYENDOLO del dashboard, con los datos reales de la Tarea6
   del 26-ago-2026. No es una copia de la logica: es la funcion que se va a publicar.
   El repo guarda con saltos de Windows, asi que se normalizan antes de buscar. */
import fs from 'fs';

const CR = String.fromCharCode(13);
const RUTA = 'C:/Users/dames/.gemini/antigravity/scratch/logistics-web-app/js/views/dashboard_v28.js';
const src = fs.readFileSync(RUTA, 'utf8').split(CR).join('');

const ini = src.indexOf('  const casoDelItem = (s7, datos, pares, zona, ctx) => {');
const fin = src.indexOf('La sugerencia de UN artículo de una tarea');
if (ini < 0 || fin < 0) { console.error('no se encontro casoDelItem', ini, fin); process.exit(1); }
// hasta el cierre de la funcion, antes del comentario de la siguiente
const cuerpo = src.slice(ini, src.lastIndexOf('};', fin) + 2);

const cte = (n, d) => { const m = new RegExp(n + '\\s*=\\s*([\\d.]+)').exec(src); return m ? Number(m[1]) : d; };
const MINIMO_PARA_REPOSICION = cte('MINIMO_PARA_REPOSICION', 20);
const CUERPOS_REPOSICION = cte('CUERPOS_REPOSICION', 1);
const PCT_CODIGO_NUEVO = cte('PCT_CODIGO_NUEVO', 60);
const PARES_ESCOLAR = cte('PARES_ESCOLAR', 50);
console.log('constantes del archivo: corte=' + MINIMO_PARA_REPOSICION
  + ' cuerpos_repo=' + CUERPOS_REPOSICION + ' pct_nuevo=' + PCT_CODIGO_NUEVO);

const prefacio = [
  'const MINIMO_PARA_REPOSICION=' + MINIMO_PARA_REPOSICION + ', CUERPOS_REPOSICION=' + CUERPOS_REPOSICION + ';',
  'const PCT_CODIGO_NUEVO=' + PCT_CODIGO_NUEVO + ', PARES_ESCOLAR=' + PARES_ESCOLAR + ';',
  "const esEscolar = (g) => String(g||'').includes('SCHOOL');",
  "const zonasService = { esZonaSinUbicacion: (z) => z === 'MZN04' };",
  'const tallasService = { modoDeMarca: () => null };'
].join('\n');

const mod = 'data:text/javascript,' + encodeURIComponent(prefacio + '\n' + cuerpo + '\nexport default casoDelItem;');
const casoDelItem = (await import(mod)).default;

const SKU = '5616493';
const base = () => ({
  bajadoPorBuffer: new Map([[SKU, { pares: 112, fuentes: new Set(['PEDIDOS']) }]]),
  porTallaDe: new Map([[SKU, {}]]),
  reservaDe: new Map([[SKU, 44]]),
  origenDe: new Map([[SKU, new Set(['A'])]])
});
const datos = { marca: 'Bata', genderRims: '02 WOMEN' };

const escenarios = [
  ['REAL de la Tarea6: llegaron 2.459, bajaron 112, picking SI lo toco', 2459, new Set([SKU])],
  ['llegaron 2.459, bajaron 112, picking NO lo toco', 2459, new Set()],
  ['llegaron 100 y bajaron 112 (esto SI es lo que bajo)', 100, new Set()]
];
for (const [nom, pares, pick] of escenarios) {
  const r = casoDelItem(SKU, datos, pares, 'SEL', { ...base(), picadoHoy: pick });
  console.log('\n' + nom);
  console.log('   caso  : ' + r.nombre);
  console.log('   regla : ' + JSON.stringify(r.regla));
  console.log('   piso  : ' + (r.pisoDeBajada || 0));
  console.log('   motivo: ' + r.motivo);
}

let fallas = 0;
const ok = (nom, cond) => { console.log((cond ? 'OK  ' : 'MAL ') + nom); if (!cond) fallas++; };
const real = casoDelItem(SKU, datos, 2459, 'SEL', { ...base(), picadoHoy: new Set([SKU]) });
const sinPick = casoDelItem(SKU, datos, 2459, 'SEL', { ...base(), picadoHoy: new Set() });
const chico = casoDelItem(SKU, datos, 100, 'SEL', { ...base(), picadoHoy: new Set() });

console.log('\n-- LO QUE TIENE QUE PASAR --');
ok('el caso real ya NO se salta la clasificacion', real.nombre !== 'reposicion-buffer');
ok('queda como reposicion de fabrica (44 en reserva >= 20)', real.nombre === 'reposicion-fabrica');
ok('la regla pasa a ser de CUERPOS, no "todo"', real.regla.modo === 'cuerpos');
ok('sin piso, porque picking ya se llevo lo que bajo', (real.pisoDeBajada || 0) === 0);
ok('si picking NO lo toco, queda piso de 112', sinPick.pisoDeBajada === 112);
ok('lo que de verdad bajo sigue yendo entero al piso', chico.regla.modo === 'todo');
ok('y ese caso conserva su nombre', chico.nombre === 'reposicion-buffer');

console.log(fallas ? '\n' + fallas + ' FALLARON' : '\nTodo como se espera.');
process.exit(fallas ? 1 : 0);
