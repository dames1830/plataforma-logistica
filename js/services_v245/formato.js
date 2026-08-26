/**
 * COMO SE ESCRIBEN LOS NUMEROS Y LAS FECHAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un solo sitio, para toda la plataforma.
 *
 * POR QUE HIZO FALTA
 *   Habia 10 maneras distintas de formatear un numero, y 81 de ellas eran
 *   `toLocaleString()` A SECAS, sin decir el idioma. Sin idioma, el separador
 *   sale del Windows de cada maquina:
 *
 *       PC en español Peru o ingles ......  13,292
 *       PC en español España ............  13.292
 *       PC en frances ...................  13 292
 *
 *   Y como 97 sitios SI decian el idioma y 81 no, dentro de la misma pantalla
 *   convivian las dos formas. Daniel suma las filas con la calculadora: un
 *   13.292 leido como "trece coma tres" tira abajo el cuadro entero.
 *
 *   Aca se fija es-PE y se acabo la discusion: el mismo numero se ve igual en
 *   todas las PC del almacen, esten como esten configuradas.
 */

/** El idioma de la casa. Peru: coma para los miles, punto para los decimales. */
export const IDIOMA = 'es-PE';

/**
 * Un numero entero, con separador de miles.
 *   n(13292)  ->  "13,292"
 * Lo que no es un numero devuelve el guion, que es como se marca "no hay dato"
 * en toda la plataforma. Nunca "NaN" ni "undefined" en pantalla.
 */
export const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x).toLocaleString(IDIOMA) : '—';
};

/**
 * Un numero con decimales fijos.
 *   dec(12.3456, 1)  ->  "12.3"
 */
export const dec = (v, dig = 1) => {
  const x = Number(v);
  return Number.isFinite(x)
    ? x.toLocaleString(IDIOMA, { minimumFractionDigits: dig, maximumFractionDigits: dig })
    : '—';
};

/**
 * Un porcentaje. Se le pasa el numero YA calculado, no la division.
 *   pct(157)      ->  "157%"
 *   pct(91.6, 1)  ->  "91.6%"
 */
export const pct = (v, dig = 0) => {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return (dig ? dec(x, dig) : n(x)) + '%';
};

/**
 * Una fecha corta.  fecha('2026-08-24')  ->  "24/08/2026"
 *
 * Ojo con las fechas en texto: 'YYYY-MM-DD' a secas la interpreta el navegador
 * como UTC, y a las 19:00 hora de Lima eso ya es el dia siguiente -justo cuando
 * entra el turno noche-. Por eso se le agrega la hora local antes de leerla.
 */
export const fecha = (v) => {
  if (!v) return '—';
  const d = (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
    ? new Date(v + 'T00:00:00')
    : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString(IDIOMA);
};

/** Fecha y hora.  fechaHora(...)  ->  "24/08/2026, 19:05" */
export const fechaHora = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString(IDIOMA, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};
