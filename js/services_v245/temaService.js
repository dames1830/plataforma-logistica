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

/**
 * El ultimo tema que se eligio en ESTA computadora, sea quien sea.
 *
 * Hace falta para el login y la pantalla de carga: ahi todavia no se sabe quien
 * va a entrar -no hay sesion- y sin esto arrancaban siempre en el tema de
 * fabrica. Daniel lo vio enseguida: elegia Power BI, cerraba sesion, y el login
 * volvia a salir azul noche.
 */
const CLAVE_ULTIMO = 'deam_tema_ultimo';

/**
 * El ultimo tema ASIGNADO que se le vio a esta persona en esta computadora.
 *
 * Sirve para distinguir dos cosas que parecen la misma: que el administrador le
 * haya dejado un tema puesto desde siempre, y que se lo ACABE DE CAMBIAR. Lo
 * segundo es una instruccion nueva y tiene que ganar, aunque la persona haya
 * elegido otro antes; lo primero no, porque entonces el administrador le estaria
 * pisando la eleccion en cada arranque.
 */
const claveAsignado = (usuario) => `deam_tema_asignado_${usuario || 'anon'}`;

/**
 * AVISARLE AL SERVIDOR QUE ESTA PERSONA USA ESTE TEMA.
 *
 * Daniel, 27-ago-2026: vio en Administracion > Usuarios que el asistente tenia Power BI
 * asignado, pero en su pantalla estaba en indigo. La columna mostraba lo que el
 * ADMINISTRADOR habia dejado puesto, no lo que la persona esta usando de verdad.
 *
 * ESTO NO CAMBIA COMO SE APLICA EL TEMA. Se sigue guardando en esta computadora y se
 * sigue pintando antes del primer pixel; el aviso sale despues y a nadie le importa si
 * llega o no. Si el servidor esta caido, la persona ve su tema igual.
 *
 * VA POR PATCH Y CON EL USUARIO COMO id, asi el servidor cambia SOLO esa fila. Con un
 * POST del bloque entero, dos personas cambiando el tema a la vez se borrarian entre
 * ellas. Y va aparte de `users` a proposito: escribir ahi exige ser administrador
 * —esa operacion borra a quien no venga en la lista— y un operario no puede ni debe.
 *
 * SE AVISA SOLO CUANDO CAMBIA: se recuerda aca lo ultimo que se aviso, y si es lo mismo
 * no se manda nada. Entrar a la plataforma no tiene por que costar una llamada mas.
 */
const API_TEMAS = 'https://logistics-backend-wv0x.onrender.com/api/logistics/temas_en_uso';
const claveReportado = (usuario) => `deam_tema_reportado_${usuario || 'anon'}`;

export const avisarTemaAlServidor = (usuario, tema) => {
  if (!usuario || usuario === 'anon' || !existeTema(tema)) return;
  try {
    if (localStorage.getItem(claveReportado(usuario)) === tema) return;
  } catch (e) { /* almacenamiento bloqueado: se avisa igual, no molesta */ }

  const entorno = (typeof window !== 'undefined' && window.PULSE_ES_BETA) ? 'beta' : 'production';
  fetch(`${API_TEMAS}?date=MASTER`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Environment': entorno },
    body: JSON.stringify({ id: usuario, tema, cuando: selloLocal() })
  }).then(r => {
    if (!r.ok) return;
    try { localStorage.setItem(claveReportado(usuario), tema); } catch (e) {}
  }).catch(() => { /* sin internet: se vuelve a intentar la proxima vez que entre */ });
};

/** La hora de esta computadora en texto, sin pasar por UTC. */
const selloLocal = () => {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};

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
/**
 * Que tema le toca a esta persona, por orden de prioridad:
 *
 *   1. Lo que ELLA eligio en esta computadora. Manda siempre: el tema que pone
 *      el administrador es el de arranque, no una imposicion.
 *   2. El que el ADMINISTRADOR le dejo asignado en Administracion > Usuarios.
 *      Este viaja con la persona: entra desde cualquier PC y lo trae puesto.
 *   3. El ultimo que se uso en esta computadora (para el login, que corre antes
 *      de saber quien entra).
 *   4. El de fabrica.
 */
export const getTema = (usuario, asignado) => {
  try {
    const g = localStorage.getItem(claveDe(usuario));
    if (g && existeTema(g)) return g;
    if (asignado && existeTema(asignado)) return asignado;
    // Sin nada guardado para esta persona, se hereda el ultimo de la maquina:
    // es mucho mejor que saltar de golpe al tema de fabrica.
    const u = localStorage.getItem(CLAVE_ULTIMO);
    if (u && existeTema(u)) return u;
  } catch (e) { /* navegador con el almacenamiento bloqueado: sigue con el defecto */ }

  // Ultimo recurso: el que YA esta puesto en la pantalla. Sin esto, cerrar
  // sesion devolvia la web al tema de fabrica de golpe -Daniel lo vio: estaba
  // en Power BI, cerraba sesion y el login salia azul noche-.
  try {
    const puesto = document.documentElement.getAttribute('data-tema');
    if (existeTema(puesto)) return puesto;
  } catch (e) { /* sin DOM: sigue con el defecto */ }

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
    // Y aparte, suelto: es el que van a usar el login y la pantalla de carga,
    // que corren antes de saber quien entra.
    localStorage.setItem(CLAVE_ULTIMO, tema);
  } catch (e) {
    console.warn('[TEMA] No se pudo guardar la eleccion:', e);
  }
  avisarTemaAlServidor(usuario, tema);
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
export const aplicarTemaDeUsuario = (usuario, asignado) => {
  // Si el administrador le CAMBIO el tema desde la ultima vez, esa es una orden
  // nueva: se aplica y se borra la eleccion anterior de esta PC. Despues la
  // persona puede volver a elegir el suyo y ese vuelve a mandar.
  try {
    if (asignado && existeTema(asignado)) {
      if (localStorage.getItem(claveAsignado(usuario)) !== asignado) {
        localStorage.setItem(claveAsignado(usuario), asignado);
        localStorage.removeItem(claveDe(usuario));
      }
    } else if (!asignado) {
      localStorage.removeItem(claveAsignado(usuario));
    }
  } catch (e) { /* almacenamiento bloqueado: sigue con el orden normal */ }

  const tema = getTema(usuario, asignado);
  // Queda anotado como el ultimo de ESTA maquina, que es lo que van a leer el
  // login y la pantalla de carga la proxima vez -ellos corren antes de que
  // haya sesion-. Tambien arregla solo a quien ya tenia un tema elegido de
  // antes de que existiera esta clave.
  try { localStorage.setItem(CLAVE_ULTIMO, tema); } catch (e) { /* almacenamiento bloqueado */ }
  // Tambien al entrar, no solo al elegir: asi la columna de Administracion se llena con
  // quien nunca toco el tema, y con quien lo eligio en otra PC. Solo manda algo si cambio.
  avisarTemaAlServidor(usuario, tema);
  return aplicarTema(tema);
};

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

/**
 * Deja un config de Chart.js con colores DE VERDAD.
 *
 * Un grafico se dibuja en un <canvas>: ahi `var(--loquesea)` no es CSS, es una
 * cadena que Chart.js intenta leer como color, no puede, y pinta negro. Eso paso
 * con el grafico de rendimiento: el relleno salio negro sobre fondo blanco.
 *
 * No alcanza con revisar lo que hay dentro del `new Chart(...)`: los datasets se
 * arman antes, en variables sueltas, y el color entra por ahi. Por eso esto
 * recorre el config ENTERO -datasets, escalas, leyenda, tooltip- y cambia
 * cualquier var() que encuentre, venga de donde venga.
 *
 * Se modifica el mismo objeto, no una copia: asi no se rompe ninguna referencia
 * que Chart.js pueda estar guardando.
 */
export const resolverColoresChart = (config) => {
  const raiz = getComputedStyle(document.documentElement);
  const cambiar = (txt) => txt.replace(/var\(\s*(--[a-z0-9-]+)\s*\)/gi,
    (_, nombre) => raiz.getPropertyValue(nombre).trim() || 'transparent');

  const vistos = new WeakSet();
  const paseo = (nodo) => {
    if (!nodo || typeof nodo !== 'object' || vistos.has(nodo)) return;
    vistos.add(nodo);
    for (const k in nodo) {
      const v = nodo[k];
      if (typeof v === 'string') {
        if (v.indexOf('var(--') !== -1) nodo[k] = cambiar(v);
      } else if (v && typeof v === 'object') {
        paseo(v);   // las funciones y los elementos del DOM se dejan como estan
      }
    }
  };
  paseo(config);
  return config;
};
