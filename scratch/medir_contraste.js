/* MIDE SI CADA TEXTO SE LEE, EN LOS CUATRO TEMAS.
 *
 * No confía en ningún modelo de colores: lee lo que el navegador computa de
 * verdad. Para el fondo sube por los padres apilando los velos, que es la
 * parte que siempre se calcula mal a mano — un `rgba(var(--ink-rgb),.06)`
 * encima de un panel no es ni el velo ni el panel.
 *
 * Mínimos (WCAG AA): 4,5:1 para letra normal; 3:1 si es grande (24px, o
 * 18,66px en negrita).
 *
 * Se usa desde un banco de pruebas:
 *     const { medir } = await import('./medir_contraste.js');
 *     console.log(medir('#d1, #d2'));
 *
 * Nació el 5-sep-2026, después de que Distribución saliera en blanco sobre
 * blanco: yo había comprobado el dibujo contra un banco que declaraba MIS
 * variables inventadas. Medir lo que pinta el navegador no se puede engañar
 * así.
 */
const TEMAS = ['indigo', 'pbi', 'pbi-classic', 'negro'];

const num = (c) => (c.match(/[\d.]+/g) || []).map(Number);

const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]);
};

const mezclar = (frente, alfa, fondo) => [0, 1, 2].map(i => alfa * frente[i] + (1 - alfa) * fondo[i]);

/* El fondo EFECTIVO: sube por los padres hasta uno opaco y baja aplicando
   cada velo. Sin esto, un texto sobre franja translúcida se mide contra el
   panel y da un número que no es. */
const fondoDe = (el) => {
  const capas = [];
  for (let n = el; n; n = n.parentElement) {
    const c = num(getComputedStyle(n).backgroundColor);
    if (!c.length) continue;
    const a = c.length > 3 ? c[3] : 1;
    if (a === 0) continue;
    capas.push([c.slice(0, 3), a]);
    if (a === 1) break;
  }
  let f = [255, 255, 255];
  for (let i = capas.length - 1; i >= 0; i--) f = mezclar(capas[i][0], capas[i][1], f);
  return f;
};

const contraste = (a, b) => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
};

/* Solo los nodos que tienen texto PROPIO: si se contara el de los hijos, un
   contenedor se mediría con la tinta que hereda y no con la que se ve. */
const conTexto = (sel) => {
  const out = [];
  document.querySelectorAll(sel.split(',').map(s => s.trim() + ' *').join(', ')).forEach(el => {
    const propio = [...el.childNodes]
      .filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');
    if (!propio) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    const px = parseFloat(cs.fontSize), peso = parseInt(cs.fontWeight) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    out.push({
      el, min: grande ? 3 : 4.5, txt: propio.slice(0, 46),
      etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
    });
  });
  return out;
};

export const medir = (sel = 'body') => {
  const antes = document.documentElement.getAttribute('data-tema');
  const informe = {};
  for (const t of TEMAS) {
    document.documentElement.setAttribute('data-tema', t);
    document.body.offsetHeight;                        /* fuerza el recálculo */
    const malos = [];
    let n = 0;
    for (const x of conTexto(sel)) {
      const c = contraste(num(getComputedStyle(x.el).color).slice(0, 3), fondoDe(x.el));
      n++;
      if (c < x.min) malos.push(`${x.etiqueta} "${x.txt}" ${c.toFixed(2)}:1 (min ${x.min})`);
    }
    informe[t] = { revisados: n, fallos: [...new Set(malos)] };
  }
  if (antes) document.documentElement.setAttribute('data-tema', antes);
  return informe;
};

export const resumen = (informe) => TEMAS.map(t => {
  const r = informe[t];
  return `${t}: ${r.revisados} textos · ` +
    (r.fallos.length ? `${r.fallos.length} NO SE LEEN — ${r.fallos.join(' | ')}` : 'todos se leen');
}).join('\n');
