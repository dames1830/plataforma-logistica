/* ═══════════════════════════════════════════════════════════════════════════════════════
 * PRUEBA: LO LEIDO EN UN APARATO SE APAGA EN EL OTRO
 *
 * Corre sin navegador y sin servidor:      node scratch/probar_leidos_entre_aparatos.mjs
 *
 * Daniel, 17-sep-2026: *"lo veo en el aplicativo, y en la web me sigue marcando como una
 * conversación que todavía no lo veo"*. `adoptarLeidos` es lo que hace la web (o la app) con
 * la fila de leidos que baja del servidor. Recibe todo lo que necesita, asi que los casos se
 * arman a mano. Devuelve 1 si algo falla.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import { adoptarLeidos } from '../js/chat.js';

/* LA SALA TAL COMO LA GUARDA EL SERVIDOR, POR ORDEN DE LLEGADA. `m4` llego DESPUES que `m3`
   pero desde una PC con el reloj atrasado: su hora es ANTERIOR. Es el caso que rompe
   cualquier comparacion por hora. */
const SERVIDOR = [
    { id: 'm1', de: 'msosa', cuando: '2026-09-17T10:01:00' },
    { id: 'm2', de: 'dames', cuando: '2026-09-17T10:02:00' },
    { id: 'm3', de: 'msosa', cuando: '2026-09-17T10:05:00' },
    { id: 'm4', de: 'vmoron', cuando: '2026-09-17T10:03:00' },
    { id: 's1', de: 'robot', cuando: '2026-09-17T10:06:00', sistema: true },
    { id: 'm5', de: 'msosa', cuando: '2026-09-17T10:09:00' },
];
const posiciones = (lista) => { const p = {}; lista.forEach((m, i) => { p[m.id] = i; }); return p; };
/* En pantalla, ordenados por hora -como los deja `bajarSala`-. */
const enPantalla = (lista) => lista.slice().sort((a, b) => a.cuando.localeCompare(b.cuando));

const casos = [];
const prueba = (titulo, obtenido, esperado) => casos.push({ titulo, obtenido, esperado });

/* ── 1. LO LEYO EN EL CELULAR ─────────────────────────────────────────────── */
{
    // La web tenia m3 sin leer; el celular leyo hasta m3.
    const lista = SERVIDOR.slice(0, 3);
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm3' }, salas: { a: '2026-09-17T10:05:00' }, salasMs: { a: 900 } },
        leidos: { a: '2026-09-17T10:02:00' }, leidosMs: { a: 100 }, leidosIds: { a: 'm2' },
        noLeidos: { a: 1 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('leido en el celular: la web apaga el contador', r.noLeidos.a, 0);
    prueba('toma la marca del celular', r.leidosIds.a, 'm3');
    prueba('y su hora, con su hora de lectura', [r.leidos.a, r.leidosMs.a], ['2026-09-17T10:05:00', 900]);
    prueba('dice que sala cambio', r.cambiaron, ['a']);
}

/* ── 2. EL RELOJ ATRASADO ─────────────────────────────────────────────────── */
{
    // El celular leyo hasta m3. Despues llego m4, con hora ANTERIOR. La web tiene los dos.
    const lista = SERVIDOR.slice(0, 4);
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm3' }, salas: { a: '2026-09-17T10:05:00' } },
        leidos: { a: '2026-09-17T10:02:00' }, leidosIds: { a: 'm2' },
        noLeidos: { a: 2 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('reloj atrasado: m4 llego despues y SIGUE sin leer', r.noLeidos.a, 1);
}

/* ── 3. NUNCA SUBE ────────────────────────────────────────────────────────── */
{
    // La web ya tenia todo leido (0). La marca del celular es mas vieja.
    const lista = SERVIDOR.slice(0, 4);
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm1' } },
        leidosIds: { a: 'm4' }, noLeidos: { a: 0 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('marca del otro mas vieja: no se toca nada', [r.leidosIds.a, r.noLeidos.a, r.cambiaron.length], ['m4', 0, 0]);
}
{
    // La web tenia 1 sin leer (m5, que el celular no vio). El celular leyo hasta m3.
    const lista = SERVIDOR;
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm3' } },
        leidosIds: { a: 'm4' }, noLeidos: { a: 1 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('lo que la web ya habia leido no vuelve a contar', [r.leidosIds.a, r.noLeidos.a], ['m4', 1]);
}
{
    // El contador de aca decia 1; recontando por la marca del otro darian 2 (m4 y m5). Se queda 1.
    const lista = SERVIDOR;
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm3' } },
        leidosIds: { a: 'm2' }, noLeidos: { a: 1 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('el contador solo baja, nunca sube', r.noLeidos.a, 1);
}

/* ── 4. LO QUE ACA NO BAJO TODAVIA ────────────────────────────────────────── */
{
    // El celular leyo hasta m5, que la web todavia no bajo: se espera a bajarla.
    const lista = SERVIDOR.slice(0, 4);
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm5' } },
        leidosIds: { a: 'm2' }, noLeidos: { a: 2 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('marca de un mensaje que aca no esta: se espera', [r.leidosIds.a, r.noLeidos.a, r.cambiaron.length], ['m2', 2, 0]);
}

/* ── 5. MIS MENSAJES Y LOS DEL ROBOT NO CUENTAN ────────────────────────────── */
{
    const lista = SERVIDOR;
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { ids: { a: 'm4' } },
        leidosIds: {}, noLeidos: { a: 9 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('sin marca propia: queda solo m5 (el renglon del robot no cuenta)', r.noLeidos.a, 1);
}

/* ── 6. LA FILA DE LA VERSION DE ANTES, SIN ids ───────────────────────────── */
{
    const lista = SERVIDOR;
    const r = adoptarLeidos({
        yo: 'dames',
        fila: { salas: { a: '2026-09-17T10:09:00' } },
        leidosIds: { a: 'm2' }, noLeidos: { a: 3 },
        mensajes: { a: enPantalla(lista) }, llegada: { a: posiciones(lista) },
    });
    prueba('sin ids no se adopta nada por la hora', [r.noLeidos.a, r.cambiaron.length], [3, 0]);
}

/* ── EL VEREDICTO ───────────────────────────────────────────────────────── */
let fallos = 0;
console.log('');
console.log('LEIDOS ENTRE APARATOS · lo que se lee en uno se apaga en el otro');
console.log('─'.repeat(74));
for (const c of casos) {
    const a = JSON.stringify(c.obtenido), b = JSON.stringify(c.esperado);
    const ok = a === b;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'MAL '} ${c.titulo.padEnd(62)} ${a}${ok ? '' : `   esperado: ${b}`}`);
}
console.log('─'.repeat(74));
console.log(`${casos.length} casos · FALLARON: ${fallos}`);
console.log('');
process.exit(fallos ? 1 : 0);
