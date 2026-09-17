/*
 * KPI PICKING SIN LÍNEAS — lo que se ve, probado con los días que publicó el robot (solo lectura).
 * Daniel, 16-sep-2026: "todo se debe calcular por pares, nada en líneas". El 17-sep preguntó si ya
 * estaba: la productividad sí, pero el KPI Picking seguía mostrando líneas en tarjetas, tablas y notas.
 *
 * Usa el código de verdad: picking.js y picking_cuadros.js importados, y de dashboard_v28.js se
 * cortan tal cual las tarjetas del reporte, `tarjetaPick`, `nMil` y la fila de "días cargados".
 *
 *     node scratch/probar_picking_sin_lineas.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const P = await import(pathToFileURL(path.join(AQUI, '..', 'js', 'reportes', 'picking.js')).href);
const Q = await import(pathToFileURL(path.join(AQUI, '..', 'js', 'reportes', 'picking_cuadros.js')).href);
// El archivo puede venir con saltos de Windows: se normalizan para poder cortar por texto.
const DASH = fs.readFileSync(path.join(AQUI, '..', 'js', 'views', 'dashboard_v28.js'), 'utf8').split('\r\n').join('\n');

let fallos = 0, total = 0;
const chk = (c, t) => { total++; if (!c) fallos++; console.log((c ? 'OK    ' : 'FALLA ') + t); };
const LINEA = /l[ií]nea/i;
const texto = (html) => String(html || '').replace(/<[^>]+>/g, ' ');

const r = await fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/picking_dias?date=MASTER&t=' + Date.now());
const todos = (await r.json()).data || {};
const fechas = Object.keys(todos).sort();
const ult = fechas.slice(-3);
console.log(`${fechas.length} días guardados; se prueba con ${ult.join(', ')}`);

// ── los cuadros ──────────────────────────────────────────────────────────────
for (const seg of ['calzado', 'no_calzado', 'todo']) {
    const R = P.juntarDias([todos[ult[2]]], seg);
    const R3 = P.juntarDias(ult.map(f => todos[f]), seg);
    const ayer = P.juntarDias([todos[ult[1]]], seg);
    if (!R) { console.log(`${seg}: sin datos`); continue; }
    const cuadros = {
        porHora: Q.cuadroPorHora(R), curvas: Q.cuadroCurvas(R), recorrido: Q.cuadroRecorrido(R),
        repetida: Q.cuadroRepetida(R), corridas: Q.cuadroCorridas(R), corridas3: Q.cuadroCorridas(R3),
        articulos: Q.cuadroArticulos(R), quePaso: Q.cuadroQuePaso(R, seg, ayer),
        total: Q.cuadroTotal(ult.map(f => ({ dia: f, resumen: todos[f] })), seg),
    };
    for (const [nom, html] of Object.entries(cuadros)) {
        chk(!LINEA.test(texto(html)), `${seg} · ${nom}: no dice "línea"${html ? '' : ' (vacío)'}`);
    }
    const pares = [...cuadros.corridas3.matchAll(/<b style="color:var\(--text-strong\);">([\d.,]+)<\/b>/g)]
        .map(m => Number(m[1].replace(/[.,]/g, '')));
    chk(pares.every((p, i) => i === 0 || pares[i - 1] >= p), `${seg} · corridas de tres días ordenadas por pares (${pares.slice(0, 4).join(' ≥ ')}…)`);
    const zona = (R.zonas || []).slice().sort((a, b) => b.pares - a.pares)[0];
    if (zona) chk(cuadros.quePaso.includes(`${zona.nom} es de donde más sale`), `${seg} · la nota de zonas nombra la de más pares: ${zona.nom}`);
    if (seg === 'calzado') chk(/Cajas<\/th>[\s\S]*Pares<\/th>/.test(cuadros.curvas) && !/Líneas<\/th>/.test(cuadros.curvas), 'curvas: quedan Cajas y Pares, sin columna Líneas');
}
const crono = P.juntarCronometros(ult.map(f => todos[f] && todos[f].pp));
chk(!LINEA.test(texto(Q.cuadroTiempoEntrePicks(crono))) && !LINEA.test(texto(Q.cuadroProductividad(crono))), 'productividad y tiempo entre picks: no dicen "línea"');

// ── las tarjetas del reporte, cortadas de dashboard_v28.js ───────────────────
const cortar = (desde, hasta) => {
    const i = DASH.indexOf(desde);
    if (i < 0) throw new Error('no encontré ' + desde);
    const j = DASH.indexOf(hasta, i + desde.length);
    return DASH.slice(i, j + hasta.length);
};
const nMilSrc = cortar('  const nMil = ', ';\n');
const nDiaSrc = cortar('  const nDia = ', ';\n');
const tarjetaSrc = cortar('  const tarjetaPick = ', '`;\n');
const filaSrc = cortar('  const filaDiaPicking = ', '\n  };\n');
const bloque = cortar("<div style=\"display:flex; gap:12px; flex-wrap:wrap;\">\n          ${tarjetaPick('Pares'", '</div>');
const armar = new Function('R', 'dia', 'resumen',
    `${nMilSrc}${nDiaSrc}${tarjetaSrc}${filaSrc}
     return { tarjetas: \`${bloque}\`, fila: filaDiaPicking(dia, resumen) };`);
for (const seg of ['calzado', 'no_calzado']) {
    const R = P.juntarDias([todos[ult[2]]], seg);
    const { tarjetas, fila } = armar(R, ult[2], todos[ult[2]]);
    const t = texto(tarjetas).replace(/\s+/g, ' ');
    chk(!LINEA.test(t), `${seg} · las 6 tarjetas no dicen "línea": ${t.trim().slice(0, 160)}…`);
    chk(/Ubicaciones/.test(t) && /faltaron [\d.,]+ pares/.test(t), `${seg} · tarjeta Ubicaciones y "faltaron N pares" presentes`);
    chk((fila.match(/<td/g) || []).length === 6 && !LINEA.test(texto(fila)), `${seg} · la fila de días cargados tiene 6 celdas (sin la de líneas)`);
}
const cab = cortar('<th style="padding:0.7rem 0.9rem; text-align:left;">Día</th>', '</tr>');
chk((cab.match(/<th/g) || []).length === 6 && !LINEA.test(cab), 'el encabezado de días cargados tiene 6 columnas, las mismas que cada fila, sin Líneas');
chk(!/líneas de calzado/.test(DASH), 'el aviso al cargar un archivo ya no dice "líneas de calzado"');

console.log('\n' + (fallos ? `FALLARON ${fallos} de ${total}` : `TODO BIEN (${total} de ${total})`));
process.exit(fallos ? 1 : 0);
