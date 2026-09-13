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

/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  LOS AVISOS
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Esto es lo que hace que el telefono se entere CON LA PANTALLA APAGADA y la app cerrada.
 *  El resto de la plataforma se entera preguntando cada 20 segundos, y un celular en el
 *  bolsillo no pregunta nada: el navegador lo congela. Aca es al reves — el servidor avisa.
 *
 *  QUIEN LO MANDA: el robot `avisar_push.py`, desde el servidor del almacen. No pasa por
 *  Render ni por ninguna tienda.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (evento) => {
    let d = {};
    try { d = evento.data ? evento.data.json() : {}; } catch (e) { d = { cuerpo: evento.data && evento.data.text() }; }

    const titulo = d.titulo || 'Logística Deam1830';
    const opciones = {
        body: d.cuerpo || '',
        icon: d.icono || 'iconos/app-192.png',
        badge: 'iconos/app-192.png',
        /* LA ETIQUETA AGRUPA. Si el mismo robot avisa dos veces, la segunda REEMPLAZA a la
           primera en vez de apilarse: lo que importa es lo ultimo que paso, no la lista de
           todo lo que paso mientras el telefono estaba guardado. */
        tag: d.etiqueta || 'deam',
        renotify: !!d.insistir,
        data: { url: d.url || './index.html' },
        /* Sin vibracion ni sonido propios: los pone el telefono como la persona los tenga
           configurados, que es lo correcto de madrugada. */
        timestamp: Date.now()
    };
    evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

/* Al tocar el aviso: si la app ya esta abierta se trae al frente -no se abre otra-, y si no,
   se abre. Abrir una segunda ventana de lo mismo desorienta. */
self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const destino = (evento.notification.data && evento.notification.data.url) || './index.html';
    evento.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abiertas) => {
            for (const c of abiertas) {
                if ('focus' in c) return c.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(destino);
        })
    );
});
