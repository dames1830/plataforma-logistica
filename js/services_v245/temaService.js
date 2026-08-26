/**
 * TEMA DE LA PLATAFORMA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Decide de que color se ve todo. Los valores de cada tema viven en
 * css/temas.css; aca solo se elige cual esta puesto y se recuerda.
 *
 * QUE HACE, EN CRIOLLO
 *   - Pone data-tema="loquesea" en el <html>. Con eso el CSS ya sabe que
 *     valores usar y se repinta la plataforma entera de una sola vez.
 *   - Se acuerda de la eleccion POR USUARIO. Dos personas que entran en la
 *     misma PC no se pisan el tema: cada una ve el suyo.
 *
 * POR QUE POR USUARIO Y NO EN EL SERVIDOR
 *   El tema es un gusto personal, no un dato del almacen. Guardarlo en el
 *   servidor obligaria a esperar la respuesta antes de dibujar, y la pantalla
 *   arrancaria con un tema y saltaria al otro. Guardado aca se aplica antes
 *   del primer pixel. Ver el <script> de arranque de index.html.
 *
 * OJO: el tema NO viaja entre PCs. Si Daniel entra desde otra maquina, ahi
 * arranca en el tema por defecto y lo vuelve a elegir. Es a proposito: lo
 * contrario cuesta un viaje al servidor en cada arranque.
 */

/** La clave donde se guarda. Va con el usuario adentro. */
const claveDe = (usuario) => `deam_tema_${usuario || 'anon'}`;

/** El tema que se usa cuando la persona todavia no eligio ninguno. */
export const TEMA_POR_DEFECTO = 'indigo';

/**
 * Los temas que existen. El orden es el que se ve en Configuracion.
 *
 * `muestras` son los cinco colores del cuadradito de la tarjeta: fondo, panel,
 * principal, acento y tinta. Estan a proposito escritos a mano y no leidos del
 * CSS, porque las cinco tarjetas se ven a la vez y cada una tiene que mostrar
 * SU paleta, no la del tema que este puesto.
 */
export const TEMAS = [
  {
    id: 'indigo',
    nombre: 'Índigo Noche',
    descripcion: 'El de siempre. Fondo azul noche con paneles translúcidos.',
    muestras: ['#0f172a', '#1e293b', '#4f46e5', '#818cf8', '#fbbf24']
  },
  {
    id: 'pbi',
    nombre: 'Gerencial · Power BI',
    descripcion: 'Los colores y la tipografía de Power BI. El que reconocen en dirección.',
    muestras: ['#F3F2F1', '#FFFFFF', '#118DFF', '#12239E', '#252423']
  },
  {
    id: 'pbi-classic',
    nombre: 'Gerencial · Power BI Classic',
    descripcion: 'La paleta clásica de Power BI, la del teal. También en Segoe UI.',
    muestras: ['#F5F5F5', '#FFFFFF', '#01B8AA', '#374649', '#F2C80F']
  },
  {
    id: 'negro',
    nombre: 'Negro',
    descripcion: 'Negro puro. Las cifras van en blanco y solo el semáforo pinta.',
    muestras: ['#000000', '#0C0C0C', '#1F1F1F', '#FFFFFF', '#3FA968']
  }
];

/** true si ese id existe de verdad. Un id inventado vuelve al por defecto. */
export const existeTema = (id) => TEMAS.some(t => t.id === id);

/**
 * Que tema tiene guardado esta persona.
 * Si nunca eligio, o si quedo guardado un nombre que ya no existe, devuelve el
 * por defecto en vez de dejar la plataforma sin pintar.
 */
export const getTema = (usuario) => {
  try {
    const g = localStorage.getItem(claveDe(usuario));
    if (g && existeTema(g)) return g;
  } catch (e) { /* navegador con el almacenamiento bloqueado: sigue con el defecto */ }
  return TEMA_POR_DEFECTO;
};

/**
 * Pinta la plataforma con ese tema. No guarda nada: solo aplica.
 * Se usa para la vista previa mientras la persona va tocando las tarjetas.
 */
export const aplicarTema = (id) => {
  const tema = existeTema(id) ? id : TEMA_POR_DEFECTO;
  document.documentElement.setAttribute('data-tema', tema);
  return tema;
};

/** Elige el tema: lo aplica Y lo guarda para la proxima vez que entre. */
export const setTema = (id, usuario) => {
  const tema = aplicarTema(id);
  try {
    localStorage.setItem(claveDe(usuario), tema);
  } catch (e) {
    console.warn('[TEMA] No se pudo guardar la eleccion:', e);
  }
  return tema;
};

/** El tema que esta puesto ahora mismo en la pantalla. */
export const temaActual = () =>
  document.documentElement.getAttribute('data-tema') || TEMA_POR_DEFECTO;

/**
 * Se llama al entrar, cuando ya se sabe quien es.
 *
 * Hace falta ademas del arranque de index.html porque ese corre ANTES del
 * login: no sabe quien va a entrar. Al terminar de entrar hay que releer la
 * preferencia de esa persona, que puede no ser la del ultimo que uso la PC.
 */
export const aplicarTemaDeUsuario = (usuario) => aplicarTema(getTema(usuario));

/**
 * El valor REAL de un token, ya resuelto.
 *
 * Hace falta para Chart.js: los graficos se dibujan en un <canvas>, y ahi
 * `var(--text-muted)` no significa nada -no es CSS, es una cadena que la
 * libreria intenta interpretar como color y no puede-. Los ejes saldrian
 * negros. Con esto el grafico pregunta "de que color es este token AHORA" y
 * recibe un color de verdad, asi que tambien sigue el tema.
 *
 *     colorTema('--text-muted')   ->  "#94a3b8"
 *     colorTema('--ink-rgb')      ->  "255, 255, 255"
 *
 * Los graficos se pintan al dibujar la vista, asi que al cambiar de tema
 * toman los colores nuevos en cuanto la pantalla se vuelve a dibujar.
 */
export const colorTema = (nombre) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Un velo con transparencia, ya resuelto. Para las grillas de los graficos. */
export const veloTema = (alfa) => `rgba(${colorTema('--ink-rgb')}, ${alfa})`;
