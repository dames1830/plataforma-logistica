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

/* LA EQUIS TAMBIEN ES UNA SALIDA, y es la mas usada de la plataforma.
   Daniel, 15-sep-2026: *"le doy escape y ninguno de los tres se borra"*, con las tres
   ventanas del Tracking y del Despacho. Dos de ellas cierran con un boton que dice
   "&times;", y como `limpio()` borra todo lo que no es letra, la equis quedaba en
   cadena vacia y no coincidia con ningun rotulo. Se reconocia "Cerrar" y no la X, que
   es lo que casi todas usan. */
const EQUIS = ['×', '✕', '✖', '✗', '✘', '❌', '⨯', 'x'];
const esEquis = (b) => EQUIS.indexOf(String(b.textContent || '').trim().toLowerCase()) >= 0;

/* ── ESC NO CIERRA SESION. NUNCA. ───────────────────────────────────────
   "Salir" es ambiguo: en la hoja de una tarea significa "cerrar esta ventana", y en el
   menu del celular significa "cerrar sesion". Las dos dicen lo mismo y hacen cosas muy
   distintas, y una de las dos no se puede deshacer con otro Esc.

   Medido: con el menu del celular abierto, la ventana de arriba es `am-velo-menu` y el
   unico boton de salida que hay adentro es el de cerrar sesion. Sin esta guarda, apretar
   Esc ahi sacaba al usuario de su sesion.

   Se reconoce por las marcas del boton -no por el texto, que es el que enganna-. Si una
   ventana no tiene mas salida que esa, Esc no hace nada: se cierra tocando afuera. */
const PELIGRO = ['salir-app', 'salirapp', 'logout', 'cerrar-sesion', 'cerrarsesion', 'signout'];
const terminaLaSesion = (b) => {
  const pistas = [b.id, b.className, b.getAttributeNames().join(' ')].join(' ').toLowerCase();
  return PELIGRO.some((p) => pistas.indexOf(p) >= 0);
};

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
/** ¿Este elemento se comporta como una ventana encima de todo? */
function esUnaCapa(el) {
  if (!(el instanceof HTMLElement)) return false;
  const e = getComputedStyle(el);
  if (e.position !== 'fixed' || e.display === 'none' || e.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  /* Que tape la pantalla, para no confundirla con un aviso de una esquina o la barra
     de navegacion, que tambien van fijos. */
  return r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.6;
}

/* ¿LO QUE ENCONTRE ES UNA VENTANA, O ES LA PANTALLA?
   Una ventana se pone ENCIMA de la pantalla y tiene adentro lo suyo y nada mas. La app
   del celular, en cambio, es UN SOLO elemento fijo que ocupa todo: cumple punto por
   punto lo que pide `esUnaCapa`, y al ampliar la busqueda paso a ser candidata.

   Eso no era teorico. Adentro del celular hay un boton "Salir" -el de cerrar sesion-, y
   "salir" esta en la lista de rotulos de salida. Sin esta guarda, apretar Esc en la app
   habria sacado al usuario de su sesion. Lo cazo revisar que habia quedado expuesto
   despues de ampliar la busqueda, no una prueba.

   Se distinguen por tamano, que es lo que de verdad las separa: la app tiene adentro
   casi todo lo que hay en la pagina; una ventana tiene una parte chica. Medido en la
   pantalla del despacho: la app 0,99 del total, la ficha 0,19.

   OJO: la app del celular CUELGA DEL BODY, asi que el camino viejo tambien la tomaba.
   El agujero estaba abierto desde antes de ampliar la busqueda; por eso la guarda se
   aplica a los dos caminos y no solo al nuevo. */
function esLaPantallaEntera(el) {
  const total = document.body.getElementsByTagName('*').length;
  if (!total) return false;
  return el.getElementsByTagName('*').length >= total * 0.7;
}

function capaDeArriba() {
  /* PRIMERO SE MIRA QUE HAY ENCIMA DEL CENTRO DE LA PANTALLA, y no solo lo que cuelga
     del <body>. Esta funcion solo recorria `document.body.children`, y las ventanas que
     una pantalla dibuja dentro de su propio contenedor -como la ficha del Despacho, que
     sale con el innerHTML del modulo- no estaban ahi: Esc no las veia aunque taparan
     todo y tuvieran su boton de Cerrar. `elementsFromPoint` devuelve lo pintado en ese
     punto de arriba hacia abajo, asi que la primera que cumpla es la de encima, viva
     donde viva en el arbol. */
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const pila = (document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : []) || [];
  for (const punta of pila) {
    for (let el = punta; el && el !== document.body; el = el.parentElement) {
      if (esUnaCapa(el) && !esLaPantallaEntera(el)) return el;
    }
  }
  /* Y si el centro estuviera tapado por algo raro, se conserva el camino de antes. */
  const capas = [];
  for (const el of document.body.children) {
    if (!esUnaCapa(el) || esLaPantallaEntera(el)) continue;
    capas.push({ el, z: Number(getComputedStyle(el).zIndex) || 0 });
  }
  if (!capas.length) return null;
  /* La de arriba es la de mayor z-index; a igualdad, la ultima que se abrio. */
  return capas.reduce((a, b) => (b.z >= a.z ? b : a)).el;
}

/** El boton con el que esa ventana ya se deja cerrar. Sin el, no se toca. */
function botonDeSalida(capa) {
  const botones = [...capa.querySelectorAll('button')]
    .filter((b) => !b.disabled && b.offsetParent !== null && !terminaLaSesion(b));
  for (const rotulo of SALIDAS) {
    const b = botones.find((x) => limpio(x.textContent) === rotulo
                               || limpio(x.getAttribute('aria-label')) === rotulo
                               || limpio(x.getAttribute('title')) === rotulo);
    if (b) return b;
  }
  /* La equis va al final a proposito: si la ventana tiene un "Cerrar" de verdad, se
     prefiere ese, que es el que la ventana espera que se toque. */
  return botones.find(esEquis) || null;
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
