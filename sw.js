/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  EL AYUDANTE QUE VUELVE INSTALABLE LA PLATAFORMA EN EL CELULAR
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Un "service worker" es lo unico que le falta a una web para que Android ofrezca
 *  INSTALARLA: con el, la plataforma queda con su icono propio en el telefono y abre a
 *  pantalla completa, sin la barra del navegador.
 *
 *  ESTE NO GUARDA NADA, Y ES A PROPOSITO.
 *
 *  La plataforma se apoya en el `?v=` de cada archivo para saber que version servir. Un
 *  ayudante que guardara copias devolveria unos archivos viejos y otros nuevos, que es
 *  exactamente la forma en que la web se rompe sin dejar rastro: la pantalla dibuja mal y
 *  el codigo parece correcto. Por eso aca solo hay un oyente de `fetch` que NO CONTESTA
 *  NADA: deja pasar cada pedido al navegador, tal cual, como si el ayudante no existiera.
 *  Alcanza para que Android lo cuente como app instalable y no puede romper nada.
 *
 *  SI ALGUN DIA HAY QUE APAGARLO, no basta con borrar el archivo: el navegador se queda con
 *  la copia que ya instalo. Hay que publicar este mismo archivo con el cuerpo cambiado por:
 *
 *      self.addEventListener('install', () => self.skipWaiting());
 *      self.addEventListener('activate', (e) => e.waitUntil(
 *          self.registration.unregister().then(() => self.clients.claim())));
 *
 *  y dejarlo unos dias, hasta que todos los telefonos lo hayan tomado.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

/* Que la version nueva entre enseguida y no espere a que se cierren todas las pestañas. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* El oyente tiene que EXISTIR, pero no hace nada: sin `respondWith`, el navegador maneja
   el pedido como siempre. Es la version mas segura posible de un service worker. */
self.addEventListener('fetch', () => { /* se deja pasar */ });
