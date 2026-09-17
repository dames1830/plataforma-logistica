/* ═══════════════════════════════════════════════════════════════════════════════════════
 * PRUEBA DEL AYUDANTE (sw.js): el aviso de lo que ya se leyo en otro aparato
 *
 * Corre sin navegador:      node scratch/probar_sw_ya_lo_viste.mjs
 *
 * Carga `sw.js` tal cual, con una bandeja de avisos de mentira, y le manda los mismos avisos
 * que manda el servidor. Mira que queda en la bandeja en cada caso. Devuelve 1 si algo falla.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CODIGO = fs.readFileSync(path.join(AQUI, '..', 'sw.js'), 'utf8');

/* Un telefono de mentira: la bandeja, las ventanas abiertas y los relojes. */
const armarTelefono = ({ ventanas = [] } = {}) => {
    const oyentes = {};
    const bandeja = [];
    const relojes = [];
    const mensajesALaApp = [];
    let alerto = 0;
    const aviso = (titulo, o) => {
        const n = { title: titulo, body: o.body, tag: o.tag, data: o.data, silent: !!o.silent,
                    renotify: !!o.renotify, icon: o.icon, badge: o.badge, timestamp: o.timestamp,
                    cerrado: false };
        n.close = () => { n.cerrado = true; const i = bandeja.indexOf(n); if (i >= 0) bandeja.splice(i, 1); };
        return n;
    };
    const registration = {
        showNotification: async (titulo, o) => {
            const previo = bandeja.find(x => x.tag === o.tag);
            /* Como Chrome: con la misma etiqueta REEMPLAZA en el sitio, y solo suena si es nuevo
               o si pide `renotify`. */
            if (previo) previo.close();
            if (!previo || o.renotify) { if (!o.silent) alerto++; }
            bandeja.push(aviso(titulo, o));
        },
        getNotifications: async (filtro) => bandeja.filter(n => !filtro || !filtro.tag || n.tag === filtro.tag),
    };
    const clients = {
        matchAll: async () => ventanas.map(v => ({
            visibilityState: v.visible ? 'visible' : 'hidden',
            postMessage: (m) => mensajesALaApp.push(m),
            focus: async () => {},
        })),
        claim: async () => {},
    };
    const self = {
        addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
        registration, clients, skipWaiting: () => {},
    };
    const contexto = {
        self, caches: { open: async () => ({ put: async () => {} }) }, Response: class {},
        URL, console, Date, Math, JSON, Promise, Object, Array, String, Number,
        setTimeout: (fn, ms) => { relojes.push({ fn, ms }); return relojes.length; },
    };
    vm.createContext(contexto);
    vm.runInContext(CODIGO, contexto);

    const empujar = async (datos) => {
        let espera = Promise.resolve();
        oyentes.push({ data: { json: () => datos, text: () => JSON.stringify(datos) },
                       waitUntil: (p) => { espera = p; } });
        await espera;
    };
    /* Deja pasar el tiempo: corre los relojes que el ayudante dejo puestos. */
    const pasarElTiempo = async () => {
        const pendientes = relojes.splice(0);
        for (const r of pendientes) { r.fn(); }
        await new Promise(r => setTimeout(r, 10));
    };
    return { bandeja, empujar, pasarElTiempo, mensajesALaApp, oyentes, alertas: () => alerto };
};

const MENSAJE = (id, texto) => ({ titulo: 'Maria Sosa', cuerpo: texto, etiqueta: 'chat_a',
                                  url: './index.html#chat=a', sala: 'a', msg: id,
                                  cuando: '2026-09-17T10:0' + id.slice(1) + ':00' });
const LEIDO = (ids) => ({ tipo: 'leido', sala: 'a', cubiertos: ids, titulo: 'Maria Sosa',
                          cuerpo: '✓ Ya lo viste en otro dispositivo', etiqueta: 'chat_a',
                          url: './index.html#chat=a' });

const casos = [];
const prueba = (titulo, obtenido, esperado) => casos.push({ titulo, obtenido, esperado });
const textos = (b) => b.map(n => `${n.tag}:${n.body}`);

/* ── 1. El aviso del mensaje lleva de que mensaje es ────────────────────────── */
{
    const t = armarTelefono();
    await t.empujar(MENSAJE('m3', 'llego el camion'));
    const n = t.bandeja[0] || {};
    prueba('el aviso guarda sala, mensaje y hora', [n.data && n.data.sala, n.data && n.data.msg, n.data && n.data.url],
           ['a', 'm3', './index.html#chat=a']);
    prueba('y suena', t.alertas(), 1);
}

/* ── 2. Unico aviso, app cerrada: se cambia por "ya lo viste" y despues se va ── */
{
    const t = armarTelefono();
    await t.empujar(MENSAJE('m3', 'llego el camion'));
    await t.empujar(LEIDO(['m1', 'm3']));
    prueba('unico aviso: queda el "ya lo viste" mientras Chrome cuenta', textos(t.bandeja),
           ['chat_a:✓ Ya lo viste en otro dispositivo']);
    prueba('el cambio NO suena', t.alertas(), 1);
    prueba('conserva quien escribio', (t.bandeja[0] || {}).title, 'Maria Sosa');
    await t.pasarElTiempo();
    prueba('a los segundos se retira: bandeja vacia', t.bandeja.length, 0);
}

/* ── 3. La app abierta a la vista: se retira de una ─────────────────────────── */
{
    const t = armarTelefono({ ventanas: [{ visible: true }] });
    await t.empujar(MENSAJE('m3', 'llego el camion'));
    await t.empujar(LEIDO(['m3']));
    prueba('app a la vista: se retira en el acto', t.bandeja.length, 0);
    prueba('y la app se entera para apagar su contador', t.mensajesALaApp, [{ tipo: 'leido', sala: 'a' }]);
}

/* ── 4. Hay otros avisos en la bandeja: se retira de una ────────────────────── */
{
    const t = armarTelefono({ ventanas: [{ visible: false }] });
    await t.empujar({ titulo: 'Robot', cuerpo: 'stock listo', etiqueta: 'robot_stock' });
    await t.empujar(MENSAJE('m3', 'llego el camion'));
    await t.empujar(LEIDO(['m3']));
    prueba('con otro aviso en la bandeja: se retira y el otro queda', textos(t.bandeja), ['robot_stock:stock listo']);
    prueba('la app atras tambien se entera', t.mensajesALaApp.length, 1);
}

/* ── 5. Llega un mensaje NUEVO mientras se retira el "ya lo viste" ──────────── */
{
    const t = armarTelefono();
    await t.empujar(MENSAJE('m3', 'llego el camion'));
    await t.empujar(LEIDO(['m3']));
    await t.empujar(MENSAJE('m5', 'otro mas'));
    prueba('el mensaje nuevo reemplaza al "ya lo viste"', textos(t.bandeja), ['chat_a:otro mas']);
    prueba('y SUENA, aunque tenga la misma etiqueta', t.alertas(), 2);
    await t.pasarElTiempo();
    prueba('el reloj del "ya lo viste" no se lleva el mensaje nuevo', textos(t.bandeja), ['chat_a:otro mas']);
}

/* ── 6. Lo leido no incluye el mensaje del aviso ────────────────────────────── */
{
    const t = armarTelefono();
    await t.empujar(MENSAJE('m5', 'otro mas'));
    await t.empujar(LEIDO(['m3', 'm4']));
    await t.pasarElTiempo();
    prueba('si su mensaje no se leyo, el aviso se queda tal cual', textos(t.bandeja), ['chat_a:otro mas']);
}

/* ── 7. Un aviso de antes del arreglo, sin id de mensaje ────────────────────── */
{
    const t = armarTelefono({ ventanas: [{ visible: true }] });
    await t.empujar({ titulo: 'Maria Sosa', cuerpo: 'viejo', etiqueta: 'chat_a', url: './index.html#chat=a' });
    await t.empujar(LEIDO(['m3']));
    prueba('aviso viejo sin id: la conversacion se leyo, se retira', t.bandeja.length, 0);
}

/* ── 8. Otra conversacion no se toca ────────────────────────────────────────── */
{
    const t = armarTelefono({ ventanas: [{ visible: true }] });
    await t.empujar(Object.assign(MENSAJE('m3', 'de la sala b'), { etiqueta: 'chat_b', sala: 'b' }));
    await t.empujar(LEIDO(['m3']));
    prueba('lo leido en la sala a no toca el aviso de la b', textos(t.bandeja), ['chat_b:de la sala b']);
}

/* ── 9. La pagina pregunta que sabe hacer el ayudante ───────────────────────── */
{
    const t = armarTelefono();
    const respuestas = [];
    t.oyentes.message({ data: { tipo: 'que-sabes' }, ports: [{ postMessage: (m) => respuestas.push(m) }] });
    prueba('contesta que sabe retirar lo leido (2)', respuestas, [{ tipo: 'sabe', sabe: 2 }]);
}

/* ── EL VEREDICTO ───────────────────────────────────────────────────────── */
let fallos = 0;
console.log('');
console.log('AYUDANTE · lo leido en otro aparato sale de la bandeja');
console.log('─'.repeat(78));
for (const c of casos) {
    const a = JSON.stringify(c.obtenido), b = JSON.stringify(c.esperado);
    const ok = a === b;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'MAL '} ${c.titulo.padEnd(64)} ${ok ? '' : `\n       salio:    ${a}\n       esperado: ${b}`}`);
}
console.log('─'.repeat(78));
console.log(`${casos.length} casos · FALLARON: ${fallos}`);
console.log('');
process.exit(fallos ? 1 : 0);
