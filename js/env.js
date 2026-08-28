/* ============================================================================
   ENTORNO (produccion vs pruebas)  -  v26.5.572
   ----------------------------------------------------------------------------
   Este archivo se carga ANTES que cualquier otro. Hace tres cosas:

     1. Decide si la web esta corriendo en PRODUCCION o en PRUEBAS (beta),
        mirando el dominio desde el que se abrio.

     2. Si esta en PRUEBAS, le pone un sello ("X-Environment: beta") a TODAS
        las llamadas al servidor. El servidor lee ese sello y usa una base de
        datos APARTE. Asi nada de lo que hagas en pruebas toca lo real.

     3. Le pone la CREDENCIAL de quien esta usando la web a toda llamada que
        ESCRIBA, en los dos entornos. Es el unico sitio por donde pasan todas.

     4. Pinta un marco naranja y un cartel para que sea imposible confundirse
        de entorno.

   REGLA DE ORO: si no esta clarisimo que es produccion, se asume PRUEBAS.
   Equivocarse hacia "pruebas" no rompe nada; equivocarse hacia "produccion" si.

   En produccion lo unico que hace este archivo es lo del punto 3, y solo cuando
   hay sesion iniciada: ni pinta, ni sella el entorno, ni toca las lecturas.
   ============================================================================ */
(function () {
  'use strict';

  if (window.__PULSE_ENV_LISTO) return;
  window.__PULSE_ENV_LISTO = true;

  /* --- Dominios oficiales. TODO lo demas (localhost, onrender, etc) = pruebas --- */
  var HOSTS_PRODUCCION = [
    'deam1830.com',
    'www.deam1830.com',
    'dames1830.github.io'
  ];

  /* --- Servidores a los que SI hay que ponerles el sello --- */
  var HOSTS_BACKEND = [
    'logistics-backend-wv0x.onrender.com',
    'localhost',
    '127.0.0.1'
  ];

  /* ------------------------------------------------------------------ */
  /* 1. Decidir el entorno                                              */
  /* ------------------------------------------------------------------ */

  function memoria(accion, valor) {
    // sessionStorage puede fallar (modo privado, file://). Nunca debe romper la app.
    try {
      if (accion === 'get') return sessionStorage.getItem('PULSE_ENV');
      if (accion === 'set') sessionStorage.setItem('PULSE_ENV', valor);
      if (accion === 'del') sessionStorage.removeItem('PULSE_ENV');
    } catch (e) { /* sin memoria: se decide por dominio y ya */ }
    return null;
  }

  function calcularEntorno() {
    // Interruptor manual: ?env=beta  /  ?env=produccion  (dura solo esta pestana)
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.has('env')) {
        var v = (p.get('env') || '').toLowerCase();
        if (v === 'beta' || v === 'pruebas') memoria('set', 'beta');
        else if (v === 'produccion' || v === 'production' || v === 'prod') memoria('set', 'produccion');
        else memoria('del');
      }
    } catch (e) { /* ignorar */ }

    var forzado = memoria('get');
    if (forzado === 'beta' || forzado === 'produccion') {
      return { env: forzado, forzado: true };
    }

    var esProduccion = HOSTS_PRODUCCION.indexOf(window.location.hostname) !== -1;
    return { env: esProduccion ? 'produccion' : 'beta', forzado: false };
  }

  var decision = calcularEntorno();
  var ENV = decision.env;
  var ES_BETA = (ENV === 'beta');

  window.PULSE_ENV = ENV;
  window.PULSE_ES_BETA = ES_BETA;

  /* Modo servidor local (?local=1), compatible con lo que ya existia en auth.js */
  try {
    if (localStorage.getItem('PULSE_USE_LOCAL') === 'true') {
      window.API_BASE_URL = 'http://localhost:8000';
    }
  } catch (e) { /* ignorar */ }

  console.log('%c[ENTORNO] ' + ENV.toUpperCase() + (decision.forzado ? ' (forzado a mano)' : ' (por dominio: ' + window.location.hostname + ')'),
              'font-weight:bold;color:' + (ES_BETA ? '#f97316' : '#16a34a'));

  /* ------------------------------------------------------------------ */
  /* 2. Sellar las llamadas al servidor                                  */
  /*    - el sello del entorno, SOLO en pruebas                          */
  /*    - la credencial de quien escribe, en los dos entornos            */
  /* ------------------------------------------------------------------ */

  function esLlamadaAlBackend(url) {
    try {
      var u = new URL(url, window.location.href);
      return HOSTS_BACKEND.indexOf(u.hostname) !== -1 && u.pathname.indexOf('/api') === 0;
    } catch (e) {
      return false;
    }
  }

  /* LA CREDENCIAL VA ACA Y NO EN CADA LLAMADA. 28-ago-2026.
   *
   * El servidor puede exigir credencial para escribir (EXIGIR_TOKEN_ESCRITURA en
   * backend/main.py), y estaba planeado encenderlo cuando el contador de escrituras
   * anonimas de `/health` llegara a cero. NUNCA iba a llegar: el token lo mandaba
   * SOLO el motor de sincronizacion, y la web escribe al servidor desde ~30 sitios
   * mas —la tabla de tallas, el analisis del buffer, cada configuracion, el layout,
   * las actividades del turno, el tema de cada usuario...—. Todos anonimos.
   *
   * Ponerselo a los 30 a mano era repetir el mismo descuido 30 veces y volver a
   * olvidarse en el sitio 31. Va en el UNICO lugar por donde pasan todas.
   *
   * SOLO EN LAS QUE ESCRIBEN. Un GET sin cabeceras raras es una peticion "simple" y
   * el navegador la manda directa; agregarle una cabecera propia obligaria a una
   * consulta previa (preflight) y DUPLICARIA todas las lecturas. Las escrituras ya
   * mandan `Content-Type: application/json`, asi que ya la hacen: la credencial no
   * agrega ni un viaje.
   *
   * Si no hay sesion no se pone nada, y la llamada sale como salia. */
  var ESCRIBEN = { POST: 1, PATCH: 1, PUT: 1, DELETE: 1 };

  function metodoDe(input, init) {
    var m = (init && init.method) ||
            (typeof input !== 'string' && input && input.method) || 'GET';
    return String(m).toUpperCase();
  }

  function tokenDeSesion() {
    try {
      return (JSON.parse(localStorage.getItem('logistics_session') || '{}') || {}).token || '';
    } catch (e) { return ''; }
  }

  if (typeof window.fetch === 'function') {
    var fetchOriginal = window.fetch.bind(window);

    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (esLlamadaAlBackend(url)) {
          var token = ESCRIBEN[metodoDe(input, init)] ? tokenDeSesion() : '';
          if (ES_BETA || token) {
            var opciones = init ? Object.assign({}, init) : {};
            var base = opciones.headers ||
                       ((typeof input !== 'string' && input && input.headers) || undefined);
            var cabeceras = new Headers(base);
            if (ES_BETA) cabeceras.set('X-Environment', 'beta');
            /* Si la llamada ya trae la suya —el motor de sincronizacion la pone— se
               respeta: puede ser un token de robot y no el de esta sesion. */
            if (token && !cabeceras.has('X-Auth-Token') && !cabeceras.has('X-Robot-Token')) {
              cabeceras.set('X-Auth-Token', token);
            }
            opciones.headers = cabeceras;
            return fetchOriginal(input, opciones);
          }
        }
      } catch (e) {
        // Si el sellado falla por lo que sea, la llamada sigue su curso normal.
        console.warn('[ENTORNO] No se pudo sellar la llamada, sigue sin sello:', e);
      }
      return fetchOriginal(input, init);
    };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Aviso visual                                                     */
  /* ------------------------------------------------------------------ */

  // Caso peligroso: estas en un sitio de pruebas pero forzaste datos reales.
  var PELIGRO = decision.forzado && ENV === 'produccion' &&
                HOSTS_PRODUCCION.indexOf(window.location.hostname) === -1;

  if (!ES_BETA && !PELIGRO) return;   // produccion normal: no se pinta nada

  var COLOR   = PELIGRO ? '#dc2626' : '#f97316';
  var TEXTO   = PELIGRO ? '⚠️ CUIDADO: DATOS REALES'
                        : '🧪 MODO PRUEBAS · los datos NO son los reales';

  var PREFIJO = PELIGRO ? '⚠️ REAL · ' : '🧪 BETA · ';

  /**
   * Marca la pestaña. Es idempotente y se puede llamar tantas veces como haga
   * falta: no hace nada si el <title> todavía no existe (el script corre antes
   * de que se parsee) ni si ya está marcado, y lo repone si la app lo cambia.
   */
  function marcarTitulo() {
    try {
      var t = document.title || '';
      if (!t || t.indexOf(PREFIJO) === 0) return;
      document.title = PREFIJO + t;
    } catch (e) { /* ignorar */ }
  }

  function pintarAviso() {
    marcarTitulo();
    if (document.getElementById('pulse-env-aviso')) return;
    // Se cuelga de <html>, NO de <body>: la app reemplaza el body entero al
    // arrancar y al cambiar de vista, y ahí se llevaba el aviso por delante.
    var raiz = document.documentElement;
    if (!raiz) return;

    var capa = document.createElement('div');
    capa.id = 'pulse-env-aviso';
    capa.setAttribute('aria-hidden', 'true');
    capa.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'pointer-events:none',
      'border:4px solid ' + COLOR
    ].join(';');

    // Abajo al centro: arriba tapaba el logo de la app, y el indicador de
    // sincronización ocupa la esquina inferior derecha. Este hueco está libre
    // en todas las vistas.
    var cartel = document.createElement('div');
    cartel.textContent = TEXTO;
    cartel.style.cssText = [
      'position:absolute', 'bottom:0', 'left:50%', 'transform:translateX(-50%)',
      'background:' + COLOR, 'color:#fff',
      'font:800 11px/1 Inter,system-ui,sans-serif', 'letter-spacing:.5px',
      'padding:6px 16px', 'border-radius:10px 10px 0 0',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)', 'white-space:nowrap',
      'text-transform:uppercase', 'max-width:96vw', 'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');

    capa.appendChild(cartel);
    raiz.appendChild(capa);
  }

  // Se pinta de inmediato, sin esperar al DOM: durante los segundos que tarda
  // en cargar la app tiene que verse igual que después.
  pintarAviso();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pintarAviso);
  }

  // Vigilante: si alguna vista lo borra, vuelve en el mismo instante, no dentro
  // de unos segundos. Un rato sin aviso es un rato en el que te puedes confundir
  // de entorno, que es justo lo que esto existe para evitar.
  try {
    new MutationObserver(function () {
      if (!document.getElementById('pulse-env-aviso')) pintarAviso();
    }).observe(document.documentElement, { childList: true, subtree: false });
  } catch (e) { /* navegador sin MutationObserver: queda el respaldo de abajo */ }

  // Respaldo por si el vigilante no alcanza (p. ej. document.write), y de paso
  // repone el título si alguna vista lo reescribe.
  setInterval(function () {
    if (!document.getElementById('pulse-env-aviso')) pintarAviso();
    else marcarTitulo();
  }, 1000);

})();
