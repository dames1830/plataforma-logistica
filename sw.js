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

    /* "YA LO VISTE EN OTRO APARATO": no es un mensaje, es la orden de retirar uno. */
    if (d.tipo === 'leido') { evento.waitUntil(yaLoViste(d)); return; }

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
        /* `sala`, `msg` y `cuando` dicen DE QUE MENSAJE es el aviso del chat: con eso se sabe
           si ya se leyo en otro aparato. Los avisos de los robots no los traen. */
        data: { url: d.url || './index.html', sala: d.sala || '', msg: d.msg || '', cuando: d.cuando || '' },
        /* Sin vibracion ni sonido propios: los pone el telefono como la persona los tenga
           configurados, que es lo correcto de madrugada. */
        timestamp: Date.now()
    };
    evento.waitUntil((async () => {
        /* Si en la bandeja quedo el "ya lo viste" de esta misma conversacion, el mensaje nuevo
           lo reemplaza en el sitio -misma etiqueta-, y reemplazar NO SUENA. Un mensaje nuevo
           tiene que sonar: se le pide que vuelva a avisar. */
        try {
            const previos = await self.registration.getNotifications({ tag: opciones.tag });
            if (previos.some(n => n.data && n.data.visto)) opciones.renotify = true;
        } catch (e) { /* sin la lista, se muestra igual */ }
        await self.registration.showNotification(titulo, opciones);
    })());
});

/* ═══════════════════════════════════════════════════════════════════════════════════════
 *  LO QUE YA SE LEYO EN OTRO APARATO SE RETIRA DE LA BANDEJA
 *  ───────────────────────────────────────────────────────────────────────────────────────
 *  Daniel, 17-sep-2026: *"si lo veo en el móvil ya debería quitar ese aviso en la web, y
 *  viceversa... que deje ya la notificación como si fuera un mensaje nuevo, porque ya lo vi
 *  en otro dispositivo"*.
 *
 *  Lo manda el servidor (`backend/avisos_chat.py`, `avisar_leido`) cuando la persona lee en
 *  otro aparato. Trae la sala y los ids de los mensajes leidos (`cubiertos`): se retira SOLO
 *  el aviso cuyo mensaje figure ahi. Si mientras tanto llego uno nuevo, su aviso se queda.
 *
 *  LA REGLA DEL NAVEGADOR, Y POR QUE ESTO NO ES UN SIMPLE `close()`.
 *
 *  Chrome obliga a que cada aviso que llega con la app cerrada termine con algo a la vista en
 *  la bandeja. Si al terminar no queda NINGUN aviso, gasta de un saldo chico de avisos
 *  "mudos" -unos pocos por dia- y, agotado, pone el suyo propio: "este sitio se actualizo en
 *  segundo plano". Eso confundiria mas que el aviso original.
 *
 *  Por eso hay tres caminos:
 *    · La app esta a la vista, o quedan otros avisos en la bandeja: se retira y listo.
 *    · Era el unico: se CAMBIA en el sitio por "✓ Ya lo viste en otro dispositivo" -sin
 *      sonar-, que cumple la regla, y unos segundos despues se retira. La cuenta de Chrome se
 *      hace al terminar y ya encontro el aviso puesto.
 *    · Si por lo que sea no llega a retirarse -el telefono cerro el navegador en esos
 *      segundos-, se queda el "ya lo viste", que ya no parece un mensaje nuevo. Se va solo al
 *      abrir la app.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
const RETIRAR_EN_MS = 4000;

/* Lo que sabe hacer este ayudante. La pagina lo pregunta antes de anotarlo en la suscripcion,
   y el servidor solo le manda el aviso de leido a quien diga 2 o mas. */
const SABE = 2;

self.addEventListener('message', (evento) => {
    const d = evento && evento.data;
    if (!d || d.tipo !== 'que-sabes') return;
    const puerto = evento.ports && evento.ports[0];
    try {
        if (puerto) puerto.postMessage({ tipo: 'sabe', sabe: SABE });
        else if (evento.source) evento.source.postMessage({ tipo: 'sabe', sabe: SABE });
    } catch (e) { /* la pagina vuelve a preguntar la proxima vez */ }
});

const yaLoViste = async (d) => {
    const sala = String(d.sala || '');
    if (!sala) return;
    const etiqueta = 'chat_' + sala;
    const cubiertos = (Array.isArray(d.cubiertos) ? d.cubiertos : []).map(String);

    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    /* La app abierta -aunque este detras de otra- se pone al dia EN EL ACTO, sin esperar a su
       proxima vuelta: el contador y la lista dejan de marcar la conversacion como nueva. */
    ventanas.forEach(c => { try { c.postMessage({ tipo: 'leido', sala }); } catch (e) { /* da igual */ } });

    const todos = await self.registration.getNotifications();
    /* Un aviso sin `msg` es de antes de este arreglo: si la conversacion se leyo, tambien. */
    const leidos = todos.filter(n => n.tag === etiqueta && !(n.data && n.data.visto)
        && (!(n.data && n.data.msg) || cubiertos.indexOf(String(n.data.msg)) >= 0));
    if (!leidos.length) return;

    const aLaVista = ventanas.some(c => c.visibilityState === 'visible');
    /* El aviso que pone Chrome por su cuenta no cuenta como "otro aviso": Chrome no lo suma. */
    const quedan = todos.filter(n => leidos.indexOf(n) < 0 && n.tag !== 'user_visible_auto_notification');
    if (aLaVista || quedan.length) { leidos.forEach(n => n.close()); return; }

    const n = leidos[leidos.length - 1];
    const marca = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await self.registration.showNotification(n.title || 'Logística Deam1830', {
        body: '✓ Ya lo viste en otro dispositivo',
        icon: n.icon || 'iconos/app-192.png',
        badge: n.badge || 'iconos/app-192.png',
        tag: etiqueta,
        renotify: false,
        silent: true,
        data: Object.assign({}, n.data || {}, { visto: marca }),
        timestamp: n.timestamp || Date.now()
    });
    /* FUERA del `waitUntil`, a proposito: si se retirara adentro, la cuenta de Chrome
       encontraria la bandeja vacia. Antes de cerrar se vuelve a mirar: si en estos segundos
       llego un mensaje nuevo a la misma conversacion, su aviso ocupa el mismo lugar y no se
       toca. */
    setTimeout(() => {
        self.registration.getNotifications({ tag: etiqueta })
            .then(lista => lista.forEach(x => { if (x.data && x.data.visto === marca) x.close(); }))
            .catch(() => { /* se va al abrir la app */ });
    }, RETIRAR_EN_MS);
};

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
