/* ═══════════════════════════════════════════════════════════════════════════════════════
 * PRUEBA DE LAS MARCAS DEL CHAT — entregado y leído
 *
 * Corre sin navegador y sin servidor:      node scratch/probar_marcas_chat.mjs
 *
 * `calcularEstado` recibe todo lo que necesita, así que se le pueden armar los casos a mano.
 * Devuelve 1 si algo falla, para que se note.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import { calcularEstado } from '../js/chat.js';

const AHORA = Date.parse('2026-09-16T20:00:00');
const MIN = 60000;
/* LA MISMA HORA QUE ESCRIBE `sello()` EN EL CHAT: local y sin Z. Con `toISOString()` esto
   salia en UTC, `new Date()` lo volvia a leer como local y el mensaje quedaba cinco horas en
   el futuro: nada figuraba como leido. Es la trampa de siempre de este proyecto, y la prueba
   cayo en ella. */
const dd = (n) => String(n).padStart(2, '0');
const hora = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
         + `T${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
};

const DOS = { id: 'sala2', tipo: 'directa', miembros: ['dames', 'msosa'] };
const GRUPO = { id: 'salaG', tipo: 'grupo', nombre: 'Turno noche',
                miembros: ['dames', 'msosa', 'vmoron', 'rlunazco'] };

const casos = [];
const prueba = (titulo, sala, m, o, esperado) =>
    casos.push({ titulo, sala, m, o, esperado });

const mio = (cuandoMs, extra) => ({ id: 'x', de: 'dames', texto: 'hola',
                                    cuando: hora(cuandoMs), ...(extra || {}) });

/* ── CONVERSACION DE DOS ────────────────────────────────────────────────── */
prueba('lo leyó: azul', DOS, mio(AHORA - 30 * MIN),
    { yo: 'dames', leidosDe: { msosa: { salasMs: { sala2: AHORA - 20 * MIN } } } },
    { estado: 'leido', leyeron: 1, total: 1 });

prueba('no lo leyó pero se conectó después: entregado', DOS, mio(AHORA - 10 * MIN),
    { yo: 'dames', leidosDe: { msosa: { salasMs: { sala2: AHORA - 20 * MIN } } },
      presenciaDe: { msosa: AHORA - 5 * MIN } },
    { estado: 'entregado', leyeron: 0, total: 1 });

prueba('ni leído ni conectado: enviado', DOS, mio(AHORA - 1 * MIN),
    { yo: 'dames', leidosDe: { msosa: { salasMs: { sala2: AHORA - 20 * MIN } } },
      presenciaDe: { msosa: AHORA - 5 * MIN } },
    { estado: 'enviado', leyeron: 0, total: 1 });

prueba('el otro nunca abrió nada: enviado', DOS, mio(AHORA - 60 * MIN),
    { yo: 'dames' }, { estado: 'enviado', leyeron: 0, total: 1 });

/* ── GRUPO DE CUATRO ────────────────────────────────────────────────────── */
const todosLeyeron = { yo: 'dames', leidosDe: {
    msosa: { salasMs: { salaG: AHORA - 35 * MIN } },
    vmoron: { salasMs: { salaG: AHORA - 35 * MIN } },
    rlunazco: { salasMs: { salaG: AHORA - 35 * MIN } } } };

prueba('grupo, lo leyeron los tres: azul y 3 de 3', GRUPO, mio(AHORA - 40 * MIN),
    todosLeyeron, { estado: 'leido', leyeron: 3, total: 3 });

prueba('grupo, lo leyó uno de tres: NO es azul', GRUPO, mio(AHORA - 36 * MIN),
    { yo: 'dames', leidosDe: {
        msosa: { salasMs: { salaG: AHORA - 35 * MIN } },
        vmoron: { salasMs: { salaG: AHORA - 40 * MIN } },
        rlunazco: { salasMs: { salaG: AHORA - 40 * MIN } } } },
    { estado: 'entregado', leyeron: 1, total: 3 });

prueba('grupo, ninguno lo leyó y dos se conectaron: entregado 0 de 3', GRUPO,
    mio(AHORA - 12 * MIN),
    { yo: 'dames', leidosDe: todosLeyeron.leidosDe,
      presenciaDe: { msosa: AHORA - 5 * MIN, vmoron: AHORA - 5 * MIN,
                     rlunazco: AHORA - 30 * MIN } },
    { estado: 'entregado', leyeron: 0, total: 3 });

/* ── LO QUE NO LLEVA MARCA ──────────────────────────────────────────────── */
prueba('el mensaje del otro no lleva marca', DOS,
    { id: 'y', de: 'msosa', texto: 'hola', cuando: hora(AHORA) }, { yo: 'dames' }, null);
prueba('"creó el grupo" no lleva marca', GRUPO,
    mio(AHORA, { aviso: true }), { yo: 'dames' }, null);
prueba('un borrado no lleva marca', DOS,
    mio(AHORA, { borrado: true }), { yo: 'dames' }, null);
prueba('sin internet: sin enviar', DOS,
    mio(AHORA, { sinEnviar: true }), { yo: 'dames' },
    { estado: 'sinenviar', leyeron: 0, total: 0 });

/* ── LOS RELOJES ────────────────────────────────────────────────────────── */
prueba('mi reloj 3 min atrasado: igual sale leído', DOS, mio(AHORA - 30 * MIN),
    { yo: 'dames', desfase: 3 * MIN,
      leidosDe: { msosa: { salasMs: { sala2: AHORA - 20 * MIN } } } },
    { estado: 'leido', leyeron: 1, total: 1 });

prueba('sin salasMs se cae al texto y sigue funcionando', DOS, mio(AHORA - 30 * MIN),
    { yo: 'dames', leidosDe: { msosa: { salas: { sala2: hora(AHORA - 20 * MIN) } } } },
    { estado: 'leido', leyeron: 1, total: 1 });

/* ── EL VEREDICTO ───────────────────────────────────────────────────────── */
let fallos = 0;
console.log('');
console.log('MARCAS DEL CHAT · entregado y leído');
console.log('─'.repeat(74));
for (const c of casos) {
    const v = calcularEstado(c.sala, c.m, c.o);
    const salio = v ? `${v.estado} ${v.leyeron}/${v.total}` : 'sin marca';
    const esp = c.esperado ? `${c.esperado.estado} ${c.esperado.leyeron}/${c.esperado.total}` : 'sin marca';
    const ok = salio === esp;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'MAL '} ${c.titulo.padEnd(48)} ${salio}${ok ? '' : `   esperado: ${esp}`}`);
}
console.log('─'.repeat(74));
console.log(`${casos.length} casos · FALLARON: ${fallos}`);
console.log('');
process.exit(fallos ? 1 : 0);
