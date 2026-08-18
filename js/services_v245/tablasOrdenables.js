// -*- coding: utf-8 -*-
/**
 * tablasOrdenables.js  -  Ordenar cualquier tabla haciendo clic en el encabezado.
 *
 *   La plataforma dibuja 79 tablas y ninguna se podia ordenar. Reescribir las 79
 *   no era opcion: se insertan con innerHTML desde 312 sitios distintos. Por eso
 *   esto no se llama en cada sitio, sino que se engancha solo: un observador mira
 *   el DOM y cuando aparece una tabla nueva la deja lista.
 *
 *   Tres cosas que parecen detalle y no lo son:
 *
 *   1. Las filas de TOTAL no se mueven. Hay 47 tablas con una fila de suma al pie.
 *      Si al ordenar el total se va al medio, el cuadro deja de cuadrar y el
 *      reporte entero pierde credibilidad.
 *   2. Los numeros ordenan como numeros. La plataforma los escribe con tres
 *      formatos ('es-PE', 'es', 'en-US'), asi que "1.540" y "1,540" son ambos mil
 *      quinientos cuarenta. Ordenados como texto, el 96 quedaria despues del 1.540.
 *   3. El tercer clic devuelve el orden original. El orden en que llegan las filas
 *      suele ser el del reporte (por ubicacion, por hora), y perderlo sin poder
 *      recuperarlo obliga a recargar la pagina.
 */

const MARCA = '__ordenable';
const MIN_FILAS = 3;

/** Convierte "S/ 1.540,50" o "1,540.50" o "45%" a numero. null si no es numero. */
function aNumero(txt) {
    let s = String(txt).replace(/[^\d.,-]/g, '').trim();
    if (!s || !/\d/.test(s)) return null;

    const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
    if (coma > -1 && punto > -1) {
        // El que va ultimo es el decimal; el otro separa miles.
        s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (coma > -1) {
        s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    } else if (punto > -1) {
        // 1.234 y 1.234.567 son miles; 1.5 es decimal.
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

/** Convierte "18/08/2026" a milisegundos. null si no es fecha. */
function aFecha(txt) {
    const m = String(txt).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (!m) return null;
    let anio = +m[3];
    if (anio < 100) anio += 2000;
    const d = new Date(anio, +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d.getTime();
}

/** Una fila de suma no se mueve nunca: se queda al pie. */
function esFilaTotal(tr) {
    if (tr.closest('tfoot')) return true;
    const t = (tr.textContent || '').toUpperCase();
    return /\b(TOTAL|SUBTOTAL|GENERAL|SUMA|ACUMULADO)\b/.test(t);
}

function valorDe(tr, i) {
    const celda = tr.children[i];
    return celda ? (celda.textContent || '').trim() : '';
}

/**
 * Mira la columna y decide como compararla. Se fija en las filas que de verdad
 * tienen contenido: una columna con tres huecos arriba no es una columna de texto.
 */
function comparadorDe(filas, i) {
    let numeros = 0, fechas = 0, conDato = 0;
    for (const tr of filas) {
        const v = valorDe(tr, i);
        if (!v || v === '-' || v === '—') continue;
        conDato++;
        if (aFecha(v) !== null) fechas++;
        else if (aNumero(v) !== null) numeros++;
    }
    if (!conDato) return null;

    if (fechas / conDato > 0.7) {
        return (a, b) => (aFecha(valorDe(a, i)) ?? -Infinity) - (aFecha(valorDe(b, i)) ?? -Infinity);
    }
    if (numeros / conDato > 0.7) {
        return (a, b) => (aNumero(valorDe(a, i)) ?? -Infinity) - (aNumero(valorDe(b, i)) ?? -Infinity);
    }
    return (a, b) => valorDe(a, i).localeCompare(valorDe(b, i), 'es', { numeric: true, sensitivity: 'base' });
}

function pintarFlechas(encabezados, activo, dir) {
    encabezados.forEach((th, i) => {
        let f = th.querySelector('.orden-flecha');
        if (!f) {
            f = document.createElement('span');
            f.className = 'orden-flecha';
            f.style.cssText = 'margin-left:5px; font-size:0.85em;';
            th.appendChild(f);
        }
        const activa = i === activo && dir !== 0;
        f.textContent = activa ? (dir > 0 ? '▲' : '▼') : '↕';
        f.style.opacity = activa ? '1' : '0.3';
    });
}

/** Deja una tabla lista para ordenarse. Devuelve false si no aplica. */
export function activarOrdenamiento(tabla) {
    if (!tabla || tabla.dataset[MARCA]) return false;

    const cuerpo = tabla.tBodies[0];
    const filaEnc = tabla.tHead && tabla.tHead.rows[0];
    if (!cuerpo || !filaEnc) return false;

    const encabezados = Array.from(filaEnc.cells);
    if (encabezados.length < 2) return false;
    if (Array.from(cuerpo.rows).filter(tr => !esFilaTotal(tr)).length < MIN_FILAS) return false;

    tabla.dataset[MARCA] = '1';
    let colActiva = -1, dir = 0;
    const original = Array.from(cuerpo.rows);

    encabezados.forEach((th, i) => {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.title = 'Clic para ordenar';
        th.addEventListener('click', () => {
            // Mismo encabezado: asc -> desc -> orden original.
            if (colActiva === i) dir = dir === 1 ? -1 : (dir === -1 ? 0 : 1);
            else { colActiva = i; dir = 1; }

            const todas = Array.from(cuerpo.rows);
            const totales = todas.filter(esFilaTotal);
            let datos = todas.filter(tr => !esFilaTotal(tr));

            if (dir === 0) {
                datos = original.filter(tr => !esFilaTotal(tr));
                colActiva = -1;
            } else {
                const cmp = comparadorDe(datos, i);
                if (!cmp) return;
                datos.sort((a, b) => cmp(a, b) * dir);
            }

            const frag = document.createDocumentFragment();
            datos.forEach(tr => frag.appendChild(tr));
            totales.forEach(tr => frag.appendChild(tr));
            cuerpo.appendChild(frag);

            pintarFlechas(encabezados, colActiva, dir);
        });
    });

    pintarFlechas(encabezados, -1, 0);
    return true;
}

let observando = false;

/** Engancha las tablas que ya estan y las que aparezcan despues. */
export function observarTablas(raiz = document.body) {
    // init() vuelve a correr al entrar y salir de la sesion. Sin este seguro
    // quedarian varios observadores mirando el mismo DOM.
    if (observando) return;
    observando = true;

    const barrer = () => raiz.querySelectorAll('table').forEach(activarOrdenamiento);
    barrer();

    let pendiente = null;
    new MutationObserver(() => {
        // Las vistas repintan de golpe; sin este respiro barreriamos en cada nodo.
        clearTimeout(pendiente);
        pendiente = setTimeout(barrer, 120);
    }).observe(raiz, { childList: true, subtree: true });
}
