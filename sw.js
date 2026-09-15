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

/* ═══════════════════════════════════════════════════════════════════════════════
 *  COMPARTIR DESDE WHATSAPP
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Daniel, 15-sep-2026: *"arma el compartir desde WhatsApp"*. Con el `share_target` del
 *  manifest, Android pone la plataforma en la lista de Compartir, al lado de Drive y
 *  OneDrive: se mantiene apretado el Excel en WhatsApp, Compartir, y listo.
 *
 *  POR QUE HACE FALTA EL AYUDANTE. Android manda el archivo con un POST, y esta web es
 *  ESTATICA: no hay nadie del otro lado que reciba un POST. El unico que puede atenderlo
 *  es este ayudante, que corre en el propio telefono. Lo que hace es: agarrar el archivo,
 *  guardarlo un momento, y mandar el navegador a la pagina normal. La app lo recoge al
 *  abrir y abre el cargador con el archivo puesto.
 *
 *  EL ORDEN IMPORTA. Primero se guarda el archivo y RECIEN DESPUES se redirige. Al reves
 *  la pagina abriria antes de que el archivo este, y el usuario veria la app normal sin
 *  entender por que no paso nada.
 *
 *  Y SIGUE SIN CONTESTAR NADA MAS. Este oyente responde UNICAMENTE al POST de Compartir;
 *  todo lo demas se deja pasar tal cual, como hasta hoy. Un ayudante que empiece a
 *  contestar pedidos normales serviria unos archivos viejos y otros nuevos, que es la
 *  forma en que esta web se rompe sin dejar rastro. */
const CAJON = 'compartido-v1';
const LLAVE = './__compartido__';

self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;
    if (pedido.method !== 'POST') return;                 // todo lo demas: se deja pasar
    const url = new URL(pedido.url);
    if (!url.searchParams.has('compartido')) return;

    evento.respondWith((async () => {
        try {
            const datos = await pedido.formData();
            const archivo = datos.get('archivo');
            if (archivo && archivo.size) {
                const cajon = await caches.open(CAJON);
                await cajon.put(LLAVE, new Response(archivo, {
                    headers: {
                        'Content-Type': archivo.type || 'application/octet-stream',
                        /* El nombre viaja aparte porque una Response no lo guarda. Va
                           codificado: los nombres traen espacios y acentos, y una
                           cabecera no los admite crudos. */
                        'X-Nombre': encodeURIComponent(archivo.name || 'compartido.xlsx')
                    }
                }));
            }
        } catch (e) {
            /* Si algo sale mal igual se manda a la app: es preferible que se abra y no
               encuentre nada -y se pueda cargar a mano- a que quede una pagina en blanco. */
        }
        return Response.redirect('./index.html?compartido=1', 303);
    })());
});

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
                if ('focus' in c) {
                    /* TRAERLA AL FRENTE NO ALCANZA. Si la app ya estaba abierta en otra
                       pantalla, el toque la enfocaba y dejaba a Daniel donde estuviera:
                       tocaba el aviso de un robot caido y aparecia el chat. Se le dice a
                       donde ir; si no entiende el mensaje -version vieja-, al menos
                       enfoca, que es lo que hacia antes. */
                    try { c.postMessage({ tipo: 'ir', url: destino }); } catch (e) { /* da igual */ }
                    return c.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(destino);
        })
    );
});
