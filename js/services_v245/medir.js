/**
 * EL CRONÓMETRO DE LAS PANTALLAS
 *
 * Daniel, 02-sep-2026: *"9 segundos para entrar a Zona Buffer"*. Medí las áreas
 * del servidor y ninguna explica esos 9 segundos —la más pesada son 217 KB y 1,6
 * s—, así que el tiempo se va en otra parte. Y adivinar dónde no sirve: hay que
 * medirlo, y medirlo **en la PC de Daniel**, que es la que va lenta.
 *
 * SE APAGA SOLO. No hace nada salvo que la dirección lleve `?medir=1`. Sin eso
 * las llamadas cuestan una comparación de un booleano y no escriben nada, así que
 * pueden quedarse puestas para siempre sin ensuciar la consola ni frenar nada.
 *
 * CÓMO SE USA
 *
 *     import { marca, fin, resumen } from './medir.js';
 *     marca('buffer:leer cache');
 *     ...
 *     fin('buffer:leer cache');
 *     resumen('Zona Buffer');     // imprime el cuadro con todo lo medido
 *
 * Y para leerlo: abrir la plataforma con `?medir=1` al final de la dirección,
 * entrar a la pantalla lenta, y mirar la consola (F12 → Consola).
 */

const PEDIDO = (() => {
    try {
        const p = new URLSearchParams(window.location.search);
        return p.get('medir') === '1' || p.get('medir') === 'true';
    } catch (e) { return false; }
})();

/* SE MIDE SIEMPRE; SOLO SE IMPRIME CUANDO HACE FALTA.
 *
 * Anotar un tramo es guardar un número en un Map: no se nota. Lo que ensucia la
 * consola es imprimirlo, y eso ahora pasa en dos casos: cuando se pide con
 * `?medir=1`, o cuando la pantalla tardó MÁS DE DOS SEGUNDOS y medio.
 *
 * Así, la próxima vez que algo vaya lento el desglose sale solo, sin que Daniel
 * tenga que acordarse de nada ni yo tenga que pedírselo. */
const AVISA_DESDE_MS = 2500;

const abiertos = new Map();
const tramos = [];

/** Arranca el cronómetro de un tramo. */
export const marca = (nombre) => {
    abiertos.set(nombre, performance.now());
};

/** Cierra el tramo y lo anota. Devuelve los milisegundos, por si sirven. */
export const fin = (nombre) => {
    const t0 = abiertos.get(nombre);
    if (t0 === undefined) return 0;
    abiertos.delete(nombre);
    const ms = Math.round(performance.now() - t0);
    tramos.push({ nombre, ms });
    return ms;
};

/**
 * Imprime lo medido, de lo más lento a lo más rápido, y limpia la lista.
 *
 * VA CON `console.log` Y NO CON `console.table`: la tabla se ve linda pero no se
 * puede copiar y pegar, y lo que hace falta es que Daniel me pase el texto.
 */
export const resumen = (titulo) => {
    if (!tramos.length) return;
    const total = tramos.reduce((s, t) => s + t.ms, 0);
    const lento = total >= AVISA_DESDE_MS;
    if (PEDIDO || lento) {
        const orden = tramos.slice().sort((a, b) => b.ms - a.ms);
        const filas = orden.map(t => '  ' + String(t.ms).padStart(6) + ' ms   ' + t.nombre);
        const cabeza = (lento && !PEDIDO ? '🐢 LENTO · ' : '⏱ ')
            + (titulo || 'Medición') + ' — ' + total + ' ms en '
            + tramos.length + ' tramos';
        /* Con `warn` cuando es lento: queda resaltado y se puede filtrar por
           "LENTO" en la consola sin leer todo lo demas. */
        (lento && !PEDIDO ? console.warn : console.log)(cabeza + '
' + filas.join('
'));
    }
    tramos.length = 0;
    abiertos.clear();
};

/** Envuelve una promesa y la mide, para no tener que poner marca/fin a mano. */
export const medir = async (nombre, tarea) => {
    marca(nombre);
    try {
        return await tarea();
    } finally {
        fin(nombre);
    }
};

export const midiendo = () => PEDIDO;
