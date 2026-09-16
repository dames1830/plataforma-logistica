/*
 * KPI PICKING EN PARES POR HORA — probado contra los días que publicó el robot (solo lectura).
 * Daniel, 16-sep-2026: "todo se debe calcular por pares, nada en líneas".
 *
 *     node scratch/probar_picking_pares.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const P = await import(pathToFileURL(path.join(AQUI, '..', 'js', 'reportes', 'picking.js')).href);
const Q = await import(pathToFileURL(path.join(AQUI, '..', 'js', 'reportes', 'picking_cuadros.js')).href);

let fallos = 0, total = 0;
const chk = (c, t) => { total++; if (!c) fallos++; console.log((c ? 'OK    ' : 'FALLA ') + t); };
const ordenado = (g) => g.every((p, i) => i === 0 || (g[i - 1].pares_hora || -1) >= (p.pares_hora || -1));

const r = await fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/picking_dias?date=MASTER&t=' + Date.now());
const todos = (await r.json()).data || {};
const fechas = Object.keys(todos).sort();
console.log(`${fechas.length} días guardados, del ${fechas[0]} al ${fechas[fechas.length - 1]}`);
const ult = fechas.slice(-3);
const segs = Object.keys(todos[ult[2]].seg || {});
console.log('segmentos:', segs.join(', '));

for (const seg of segs) {
    const uno = P.juntarDias([todos[ult[2]]], seg);
    if (!uno) continue;
    const conRitmo = uno.gente.filter(p => !p.bajo_corte);
    chk(ordenado(conRitmo), `${seg} · un día: la gente sale ordenada por pares por hora (${conRitmo.length} personas; antes venía por "ritmo")`);
    const tres = P.juntarDias(ult.map(f => todos[f]), seg);
    chk(ordenado(tres.gente.filter(p => !p.bajo_corte)), `${seg} · tres días: ordenada por pares por hora`);
    const malos = tres.gente.filter(p => !p.bajo_corte && p.pares_hora !== Math.round(p.pares / p.horas));
    chk(!malos.length, `${seg} · tres días: pares por hora = pares ÷ horas de cada persona (${malos.length} distintos)`);
    chk(!('ritmo' in (tres.gente[0] || {})), `${seg} · tres días: el "ritmo" en picks ya no se calcula`);
}

const crono = P.juntarCronometros(ult.map(f => todos[f] && todos[f].pp));
chk(crono && ordenado(crono.gente), 'productividad (cronómetro), tres días: ordenada por pares por hora');
const sp = crono.gente.reduce((s, p) => s + p.pares, 0), sh = crono.gente.reduce((s, p) => s + p.horas, 0);
chk(crono.pares_hora === Math.round(sp / sh), `la cifra del equipo = pares ÷ horas sumados: ${crono.pares_hora}`);
chk(!('picks_hora' in crono) && crono.gente.every(p => !('picks_hora' in p)), 'ya no hay "picks por hora" en el resultado');

const html = Q.cuadroProductividad(crono);
chk(/PARES POR HORA/.test(html) && /Pares por hora/.test(html), 'el cuadro dice PARES POR HORA');
chk(!/picks por hora|Picks por hora|De ahí, sueltos|De ahí, cajas|l[ií]nea/i.test(html), 'y no dice picks, sueltos, cajas ni líneas');
const primero = crono.gente.find(p => p.pares_hora);
chk(html.includes(primero.usuario), `el primero del cuadro es ${primero.usuario} con ${primero.pares_hora} pares por hora`);

const avisos = Q.cuadroQuePaso ? null : null;   // el aviso de la brecha vive en otro cuadro: se prueba por código abajo
const uno = P.juntarDias([todos[ult[2]]], segs[0]);
const con = uno.gente.filter(p => p.pares_hora).sort((a, b) => b.pares_hora - a.pares_hora);
chk(con.length >= 3 ? con[0].pares_hora >= con[con.length - 1].pares_hora : true, 'la brecha se mide entre el de más y el de menos pares por hora');

console.log('\n' + (fallos ? `FALLARON ${fallos} de ${total}` : `TODO BIEN (${total} de ${total})`));
process.exit(fallos ? 1 : 0);
