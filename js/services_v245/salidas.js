/* ══════════════════════════════════════════════════════════════════════════════
 * LO QUE SE PEGA ENCIMA TIENE QUE PODER DESPEGARSE
 *
 * Daniel, 28-ago-2026: *"al apretar Esc, que se quite la imagen y me deje ver la web.
 * En algunas se puede, en otras no. Necesito que estandarices eso"*. Y cuando se le
 * ofrecio arreglar las 37 ventanas una por una o poner un solo escuchador para todas,
 * eligio lo segundo: *"la B"*.
 *
 * Es la misma idea que el viene repitiendo toda la noche: una regla en un solo sitio vale
 * para una ventana o para mil, y tambien para las que se hagan manana.
 *
 * ── EL CANDADO QUE HACE QUE ESTO SEA SEGURO ──────────────────────────────────
 *
 * Esc NO cierra cualquier cosa: solo lo que YA tiene su propia salida, o sea una ventana
 * con un boton de Cerrar, Cancelar, Salir o No. Se le da un clic a ESE boton, no se
 * arranca el nodo.
 *
 * Por que asi y no borrando la capa: un formulario a medio llenar se descarta con su
 * boton, que es lo que la ventana espera —puede tener que avisar, guardar un borrador o
 * soltar un candado—. Arrancarla del DOM se saltaria todo eso y podria perder lo escrito.
 * Y si una ventana NO tiene salida propia es porque es un paso obligatorio: esa no se
 * toca.
 * ══════════════════════════════════════════════════════════════════════════════ */

/* Los rotulos que significan "salir de aca sin hacer nada". En orden de preferencia: si
   hay Cerrar y Cancelar, se usa Cerrar. */
const SALIDAS = ['cerrar', 'cancelar', 'salir', 'volver', 'no'];

const limpio = (t) => String(t || '')
  .replace(/[^a-záéíóúñ ]/gi, '')
  .trim()
  .toLowerCase();

/**
 * La capa de arriba de todo: fija, que tape casi toda la pantalla y se vea.
 *
 * No se buscan por clase porque no la tienen: las 43 ventanas de la plataforma se
 * escriben con el estilo pegado al elemento. Se reconocen por como se COMPORTAN.
 */
function capaDeArriba() {
  const capas = [];
  for (const el of document.body.children) {
    if (!(el instanceof HTMLElement)) continue;
    const e = getComputedStyle(el);
    if (e.position !== 'fixed' || e.display === 'none' || e.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    /* Que tape la pantalla, para no confundirla con un aviso de una esquina o la barra
       de navegacion, que tambien van fijos. */
    if (r.width < window.innerWidth * 0.6 || r.height < window.innerHeight * 0.6) continue;
    capas.push({ el, z: Number(e.zIndex) || 0 });
  }
  if (!capas.length) return null;
  /* La de arriba es la de mayor z-index; a igualdad, la ultima que se abrio. */
  return capas.reduce((a, b) => (b.z >= a.z ? b : a)).el;
}

/** El boton con el que esa ventana ya se deja cerrar. Sin el, no se toca. */
function botonDeSalida(capa) {
  const botones = [...capa.querySelectorAll('button')]
    .filter((b) => !b.disabled && b.offsetParent !== null);
  for (const rotulo of SALIDAS) {
    const b = botones.find((x) => limpio(x.textContent) === rotulo
                               || limpio(x.getAttribute('aria-label')) === rotulo
                               || limpio(x.getAttribute('title')) === rotulo);
    if (b) return b;
  }
  return null;
}

/**
 * Se instala UNA vez, al arrancar la plataforma. A partir de ahi vale para cualquier
 * ventana, incluidas las que todavia no existen.
 */
export function instalarSalidaConEsc() {
  if (window.__salidaEscPuesta) return false;
  window.__salidaEscPuesta = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const capa = capaDeArriba();
    if (!capa) return;
    const salida = botonDeSalida(capa);
    if (!salida) return;            // sin salida propia: es un paso obligatorio
    e.preventDefault();
    salida.click();
  });
  return true;
}

/* Se exportan para poder probarlas por separado: la prueba no puede depender de abrir
   ventanas de verdad para saber si el reconocimiento funciona. */
export const _capaDeArriba = capaDeArriba;
export const _botonDeSalida = botonDeSalida;
