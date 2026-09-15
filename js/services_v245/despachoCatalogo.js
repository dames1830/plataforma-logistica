/**
 * DESPACHO DE CATÁLOGO · la capa de datos
 *
 * La usan LAS DOS pantallas: `js/reportes/despacho_catalogo.js` en la web y la sección
 * Despacho de la app del celular. Está acá y no repetida en cada una por un motivo
 * concreto: si la regla de qué cuenta como "por liquidar" viviera en dos sitios, el día
 * que se cambie en uno, la web y el celular dirían números distintos del mismo día. Y
 * cuando dos pantallas se contradicen, no se puede creer a ninguna.
 *
 * ── SE BAJA POR SEMANAS, NO TODO ──────────────────────────────────────────────
 *
 *   Daniel, 15-sep-2026: *"no es necesario que tengas los 3.000 y tantos registros…
 *   no es mejor tener un rango de fechas y que se actualice a la fecha actual, por
 *   ejemplo hoy día lunes, o el lunes hasta el sábado"*.
 *
 * Tenía razón y el número lo confirma: el paquete entero pesa 1.144 KB y crece unos
 * 450 KB por mes, así que en un año serían 5,4 MB bajados de nuevo cada vez que
 * alguien abre la pantalla —en un celular, con datos móviles— para mirar el día de hoy.
 *
 * Ahora hay UN ÁREA POR SEMANA, que empieza el lunes, y cada una se basta a sí misma:
 * trae su propio catálogo de agencias y destinos, así que se puede bajar una sin
 * depender de ninguna otra. Se bajan solo las semanas que el rango pedido toca.
 *
 *   despacho_catalogo_indice          1,3 KB · qué semanas hay, cuántas guías y
 *                                     cuántas quedan sin liquidar en cada una
 *   despacho_catalogo_sem_2026-09-14  19 KB  · la semana del lunes 14 de setiembre
 *   despacho_catalogo_cambios         lo liquidado desde la plataforma, una entrada por id
 *   despacho_adj_<id>_<cual>          cada foto o PDF, en base64, en su propia área
 *   despacho_catalogo                 el paquete entero de la importación. YA NO SE BAJA.
 *                                     Queda como respaldo: si algo sale mal se vuelve a
 *                                     partir desde ahí sin pedirle el Excel a nadie.
 *
 * Abrir la pantalla en el día de hoy pasó de bajar 1.144 KB a bajar 20 KB.
 *
 * El índice es también lo que evita pedir semanas que no existen: si un lunes no está
 * en la lista, no se pregunta por él. Y la cuenta de "sin liquidar" por semana es lo
 * que permite que la pestaña Por liquidar encuentre una guía vieja sin bajar el
 * historial completo — solo baja las semanas que tienen alguna abierta.
 *
 * Que la base no se reescriba es lo que hace seguro seguir usando el AppSheet en
 * paralelo, y evita que dos personas liquidando a la vez se pisen.
 */

const API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics';

export const AREA = 'despacho_catalogo';                 // el respaldo de la importación
export const AREA_INDICE = 'despacho_catalogo_indice';
export const AREA_SEMANA = (lunes) => 'despacho_catalogo_sem_' + lunes;
export const AREA_CAMBIOS = 'despacho_catalogo_cambios';
export const AREA_ADJ = (id, cual) => 'despacho_adj_' + String(id) + '_' + cual;

/* Los cuatro estados del AppSheet. En las 3.129 filas importadas solo aparecen los dos
   primeros: hoy se carga y se liquida casi seguido, así que PENDIENTE no deja rastro. */
export const ESTADOS = {
    'ATENDIDO':    { et: 'Atendido',    tono: 'bien' },
    'NO ATENDIDO': { et: 'No atendido', tono: 'mal' },
    'PENDIENTE':   { et: 'Pendiente',   tono: 'curso' },
    'REPROGRAMAR': { et: 'Reprogramar', tono: 'curso' }
};
const SIN_CERRAR = ['PENDIENTE', 'REPROGRAMAR', ''];

/* ── EL CANAL, Y POR QUÉ SE REPARTE DISTINTO EN CADA PANTALLA ─────────────────
   Daniel, 15-sep-2026: *"en el móvil va a estar solamente una pestaña llamada
   despacho, ahí se van a ver todos los canales; pero en la web, si es de no retail se
   va a ir a no retail, y si es de retail se va a ir a retail"*.

   Tiene sentido y no es un capricho: el que liquida en la calle abre una guía y no le
   importa de qué canal venga —quiere cerrarla—; el que analiza en la web mira su área.
   Misma tabla, dos formas de repartirla.

   HOY TODO ES CATÁLOGO. Las 3.129 filas importadas vienen de no retail, así que el
   campo no viaja en el dato: se asume. Cuando entre Retail, cada fila traerá el suyo y
   no hay que cambiar ni una pantalla — solo dejarán de caer todas en el mismo saco. */
export const CANALES = {
    catalogo: { et: 'Catálogo', modulo: 'no_retail' },
    retail:   { et: 'Retail',   modulo: 'retail' }
};
export const canalDe = (f) => String((f && f.canal) || 'catalogo').toLowerCase();
export const delCanal = (filas, canal) => !canal ? filas : filas.filter((f) => canalDe(f) === canal);

export const sinLiquidar = (f) => SIN_CERRAR.indexOf(String(f.est || '').toUpperCase()) >= 0;

/* ── LAS FECHAS, SIN toISOString ──────────────────────────────────────────────
   toISOString devuelve UTC y en Lima adelanta el día a las 19:00, justo cuando entra el
   turno noche. Es la trampa número uno de este proyecto, y acá haría que a las 19:01 de
   un sábado la pantalla saltara a la semana siguiente y se viera vacía. */
const dd = (n) => String(n).padStart(2, '0');
const aTexto = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const aFecha = (t) => {
    const p = String(t || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
};
export const esFecha = (t) => /^\d{4}-\d{2}-\d{2}$/.test(String(t || ''));
export const hoyTexto = () => aTexto(new Date());
export const sumarDias = (t, n) => { const d = aFecha(t); d.setDate(d.getDate() + n); return aTexto(d); };

/** El lunes de la semana de esa fecha. Es la clave con la que se guarda cada semana. */
export const lunesDe = (t) => {
    const d = aFecha(t);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // getDay: 0 = domingo
    return aTexto(d);
};

/** Los lunes de todas las semanas que toca un rango, en orden. */
export const semanasEntre = (desde, hasta) => {
    if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) return [];
    const fin = lunesDe(hasta);
    const lista = [];
    let l = lunesDe(desde);
    while (l <= fin && lista.length < 520) { lista.push(l); l = sumarDias(l, 7); }
    return lista;
};

/**
 * EL RANGO CON EL QUE ABRE LA PANTALLA: lunes a sábado de esta semana.
 * De lunes a sábado y no los siete días porque el despacho no sale los domingos: un
 * domingo en el filtro solo ensancha el rango sin agregar una sola guía.
 */
export const rangoDeLaSemana = (ref) => {
    const l = lunesDe(ref || hoyTexto());
    return { desde: l, hasta: sumarDias(l, 5) };
};

/* ── HABLAR CON EL SERVIDOR ───────────────────────────────────────────────────
   Se distingue "no hay nada" de "no pude preguntar". Confundirlos es lo que hizo que
   la pantalla del Maestro dijera "Nunca publicado" en un reinicio del servidor. */
const pedirArea = async (area) => {
    try {
        const r = await fetch(`${API}/${area}?date=MASTER&z=${Date.now()}`);
        if (r.status === 404) return { ok: true, datos: null };
        if (!r.ok) return { ok: false, motivo: 'el servidor contestó ' + r.status };
        const j = await r.json();
        const d = (j && j.data !== undefined) ? j.data : j;
        return { ok: true, datos: (d && typeof d === 'object' && Object.keys(d).length) ? d : null };
    } catch (e) {
        return { ok: false, motivo: (e && e.message) || 'no se pudo conectar' };
    }
};

export const guardarArea = async (area, datos) => {
    const r = await fetch(`${API}/${area}?date=MASTER`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (!r.ok) throw new Error('el servidor contestó ' + r.status);
    return true;
};

/* ── EL PAQUETE COMPACTO, REARMADO ────────────────────────────────────────────
   Los campos que se repiten —agencia, destino, asesor, estado, líder— van en un
   catálogo y cada fila guarda el número. La ruta de la foto es un patrón y se guarda
   solo la parte variable. Acá se deshace todo eso. */
const abrir = (p) => {
    if (!p || !Array.isArray(p.filas)) return [];
    const cat = p.cat || {};
    const patron = p.fotoPatron || 'STATUS_Images/{id}.FOTO.{foto}';
    return p.filas.map((f) => {
        const g = {};
        Object.keys(f).forEach((k) => {
            g[k] = (cat[k] && typeof f[k] === 'number') ? (cat[k][f[k]] || '') : f[k];
        });
        if (f.foto !== undefined && f.fotoX === undefined) {
            g.foto = patron.replace('{id}', f.id).replace('{foto}', f.foto);
        } else if (f.fotoX !== undefined) {
            g.foto = f.fotoX;
        }
        return g;
    });
};

/* ── LO QUE SE VA GUARDANDO EN MEMORIA ───────────────────────────────────────── */
let INDICE = null;
let CAMBIOS = { porId: {} };
let cambiosLeidos = false;
const SEMANAS = {};        // lunes -> filas, ya con lo liquidado superpuesto
let ultimoFallo = '';

export const elIndice = () => INDICE;
export const semanasEnMemoria = () => Object.keys(SEMANAS).sort();
/** El motivo del último tropiezo, para poder decirlo en pantalla en vez de mentir. */
export const ultimoProblema = () => ultimoFallo;

const aplicarCambios = (filas) => {
    const porId = (CAMBIOS && CAMBIOS.porId) || {};
    filas.forEach((f) => {
        const c = porId[String(f.id)];
        if (c) Object.keys(c).forEach((k) => { f[k] = c[k]; });
    });
    return filas;
};

/** El mapa de semanas. Pesa poco más de un kilobyte y se baja siempre. */
export const traerIndice = async (recargar) => {
    if (INDICE && !recargar) return INDICE;
    const r = await pedirArea(AREA_INDICE);
    if (!r.ok) { ultimoFallo = r.motivo; return null; }
    INDICE = r.datos || { semanas: {}, total: 0 };
    return INDICE;
};

const traerCambios = async (recargar) => {
    if (cambiosLeidos && !recargar) return CAMBIOS;
    const r = await pedirArea(AREA_CAMBIOS);
    if (!r.ok) { ultimoFallo = r.motivo; return CAMBIOS; }
    CAMBIOS = r.datos || { porId: {} };
    if (!CAMBIOS.porId) CAMBIOS.porId = {};
    cambiosLeidos = true;
    return CAMBIOS;
};

/** Una semana suelta. Devuelve [] si esa semana no tiene guías. */
export const traerSemana = async (lunes, recargar) => {
    if (SEMANAS[lunes] && !recargar) return SEMANAS[lunes];
    await traerCambios();
    const r = await pedirArea(AREA_SEMANA(lunes));
    if (!r.ok) { ultimoFallo = r.motivo; return null; }
    SEMANAS[lunes] = aplicarCambios(abrir(r.datos));
    return SEMANAS[lunes];
};

/**
 * LAS GUÍAS DE UN RANGO DE FECHAS. Es la puerta que usan las dos pantallas.
 *
 * Baja en paralelo solo las semanas que el rango toca Y que el índice dice que
 * existen; las que ya estaban en memoria no se vuelven a pedir. Devuelve las filas
 * recortadas al rango exacto —una semana trae de lunes a domingo y el rango puede
 * empezar un miércoles—, ordenadas de la más nueva a la más vieja.
 */
export const traerRango = async (desde, hasta, recargar) => {
    await traerIndice(recargar);
    const hay = (INDICE && INDICE.semanas) || {};
    const lunes = semanasEntre(desde, hasta).filter((l) => hay[l] !== undefined);
    await Promise.all(lunes.map((l) => traerSemana(l, recargar)));
    const filas = [];
    lunes.forEach((l) => (SEMANAS[l] || []).forEach((f) => {
        const d = String(f.desp || '');
        if (d >= desde && d <= hasta) filas.push(f);
    }));
    filas.sort((a, b) => String(b.desp || '').localeCompare(String(a.desp || '')));
    return filas;
};

/**
 * LAS QUE SIGUEN ABIERTAS, estén en la semana que estén.
 *
 * Sin el índice esto obligaría a bajar el historial completo para encontrar una guía
 * de hace un mes que quedó sin liquidar. Con él se bajan solo las semanas que tienen
 * alguna abierta, que en la práctica son una o dos.
 */
export const traerPendientes = async (recargar, canal) => {
    await traerIndice(recargar);
    const hay = (INDICE && INDICE.semanas) || {};
    /* Se bajan las semanas que tienen alguna abierta DE ESTE CANAL. Si el índice es de
       los viejos y no trae el reparto, se miran todas las que tengan alguna: bajar una
       semana de más cuesta 19 KB; no bajarla cuesta una guía escondida. */
    const conAbiertas = Object.keys(hay).filter((l) => {
        const x = hay[l] || {};
        return (canal && x.sinPorCanal) ? (x.sinPorCanal[canal] || 0) > 0 : (x.sin || 0) > 0;
    });
    await Promise.all(conAbiertas.map((l) => traerSemana(l, recargar)));
    const filas = [];
    /* Se barren TODAS las semanas que haya en memoria, no solo las que el índice
       marca: si alguien acaba de abrir una guía que estaba cerrada, el índice todavía
       no lo sabe y la pantalla igual tiene que mostrarla. */
    Object.keys(SEMANAS).forEach((l) => (SEMANAS[l] || []).forEach((f) => {
        if (sinLiquidar(f) && (!canal || canalDe(f) === canal)) filas.push(f);
    }));
    filas.sort((a, b) => String(b.desp || '').localeCompare(String(a.desp || '')));
    return filas;
};

/** El historial entero. Solo cuando alguien lo pide a propósito: son más de 1 MB. */
export const traerTodo = async (recargar) => {
    const i = await traerIndice(recargar);
    const l = Object.keys((i && i.semanas) || {}).sort();
    if (!l.length) return [];
    return traerRango(l[0], sumarDias(l[l.length - 1], 6), recargar);
};

/**
 * Cuántas guías de ese rango hay YA EN MEMORIA, o null si falta bajar alguna semana.
 *
 * Es para los rótulos de las pestañas. Devolver 0 cuando en realidad no se sabe sería
 * peor que no decir nada: un cero se lee como "ese día no se despachó".
 */
export const contarRango = (desde, hasta, canal) => {
    const hay = (INDICE && INDICE.semanas) || {};
    const lunes = semanasEntre(desde, hasta).filter((l) => hay[l] !== undefined);
    if (lunes.some((l) => !SEMANAS[l])) return null;
    let n = 0;
    lunes.forEach((l) => SEMANAS[l].forEach((f) => {
        const d = String(f.desp || '');
        if (d >= desde && d <= hasta && (!canal || canalDe(f) === canal)) n++;
    }));
    return n;
};

/**
 * CUANTAS QUEDAN ABIERTAS, POR CANAL, SEGUN EL INDICE.
 *
 * Tiene que ser por canal o el cuadro no cuadra: el modulo de Retail dirla "3 por
 * liquidar" y al entrar mostrarla cero, porque las tres eran de Catalogo. Un numero
 * en una pestana que no coincide con lo que hay adentro tira abajo la pantalla entera.
 *
 * Los indices viejos no traen el reparto por canal -se agrego despues-. En ese caso se
 * devuelve el total, que es lo que habia: es preferible un numero de mas en Catalogo
 * -donde hoy esta todo- que esconder una guia abierta.
 */
export const abiertasDelCanal = (canal) => {
    const hay = (INDICE && INDICE.semanas) || {};
    return Object.keys(hay).reduce((t, l) => {
        const x = hay[l] || {};
        if (!canal || !x.sinPorCanal) return t + (x.sin || 0);
        return t + (x.sinPorCanal[canal] || 0);
    }, 0);
};

/* ACÁ HABÍA UN `pesoDelRango`, que decía cuántos kilobytes costaba un rango todavía no
   bajado, y las dos pantallas lo pintaban al lado de los atajos de fecha: "+228 KB".
   Daniel lo vio en el celular y lo llamó por su nombre: *"quita esta tontería de la
   app"*. Tenía razón —al que liquida en la calle le importa la fecha, no el peso— y se
   fue también la función, no solo el texto: dejarla exportada sin que la use nadie es
   una invitación a volver a pintarla. El `kb` de cada semana sigue en el índice, que es
   donde sirve, para saber cómo está repartido el peso sin abrir el navegador. */

/** true si el índice se pudo leer. Distingue "no hay nada" de "no pude preguntar". */
export const seLeyo = () => !!INDICE;

/* ── LAS FOTOS SE ACHICAN MENOS QUE EN EL CHAT ────────────────────────────────
   El chat usa 1600 px y calidad 0,72, que para una conversación sobra. Acá no:

     Daniel, 15-sep-2026: *"las fotos que no bajen mucho la calidad, no se va a
     apreciar, y eso lo tiene que ver el área comercial también para que ellos lo
     metan a contabilidad y finanzas"*.

   Lo que se fotografía es la FACTURA junto con la guía de la agencia. Si el número de
   factura o el monto no se leen, la foto no sirve para lo único que tiene que servir.
   Con 2200 px y 0,88, una foto de celular de 4 MB queda en unos 700 KB —el triple que
   en el chat— y los números se leen. */
export const LADO_MAXIMO = 2200;
export const CALIDAD = 0.88;
export const TOPE_MB = 6;

export const achicarFoto = (archivo) => new Promise((listo) => {
    const mime = String(archivo.type || '');
    if (mime.indexOf('image/') !== 0 || mime.indexOf('gif') >= 0) { listo(archivo); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
        const e = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        /* Una que ya viene chica y nítida no se vuelve a comprimir: recomprimir un JPEG
           siempre pierde, y acá lo que se pierde son los números de la factura. */
        if (e >= 1 && archivo.size < 900 * 1024) { URL.revokeObjectURL(url); listo(archivo); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); listo(b || archivo); }, 'image/jpeg', CALIDAD);
    };
    img.onerror = () => { URL.revokeObjectURL(url); listo(archivo); };
    img.src = url;
});

export const aBase64 = (blob) => new Promise((listo, falla) => {
    const l = new FileReader();
    l.onload = () => listo(String(l.result));
    l.onerror = () => falla(new Error('no se pudo leer el archivo'));
    l.readAsDataURL(blob);
});

/** Prepara un archivo elegido: lo achica, lo pasa a base64 y avisa si se pasa del tope. */
export const prepararAdjunto = async (archivo, cual) => {
    const chico = cual === 'pdf' ? archivo : await achicarFoto(archivo);
    if (chico.size > TOPE_MB * 1024 * 1024) {
        throw new Error('pesa ' + (chico.size / 1024 / 1024).toFixed(1) + ' MB y el tope son ' + TOPE_MB + ' MB');
    }
    return { nombre: archivo.name, tipo: chico.type || archivo.type, dato: await aBase64(chico), kb: Math.round(chico.size / 1024) };
};

const adjuntosVistos = {};

/** Trae un adjunto guardado en la plataforma. `null` si no está o no se pudo. */
export const traerAdjunto = async (id, cual) => {
    const clave = id + '_' + cual;
    if (!adjuntosVistos[clave]) {
        const r = await pedirArea(AREA_ADJ(id, cual));
        if (!r.ok) { ultimoFallo = r.motivo; return null; }
        adjuntosVistos[clave] = r.datos;
    }
    return adjuntosVistos[clave];
};

/** La fila con ese id, mire la pantalla la semana que mire. */
export const filaDe = (id) => {
    const claves = Object.keys(SEMANAS);
    for (let i = 0; i < claves.length; i++) {
        const f = SEMANAS[claves[i]].find((x) => String(x.id) === String(id));
        if (f) return f;
    }
    return null;
};

/**
 * Guarda una liquidación. Primero los adjuntos, después los campos: es peor un
 * despacho marcado ATENDIDO sin su foto que uno sin marcar.
 *
 * `cambio` son los campos del formulario; `adjuntos` es {foto, foto2, pdf} con lo que
 * devolvió prepararAdjunto(). Devuelve el cambio final, ya aplicado a la fila.
 */
export const liquidar = async (id, cambio, adjuntos, avisar) => {
    const f = filaDe(id);
    if (!f) throw new Error('no se encontró el despacho ' + id);

    const listo = Object.assign({}, cambio);
    for (const cual of ['foto', 'foto2', 'pdf']) {
        const a = adjuntos && adjuntos[cual];
        if (!a) continue;
        if (avisar) avisar('Subiendo ' + cual + '…');
        await guardarArea(AREA_ADJ(id, cual), {
            id: String(id), cual, tipo: a.tipo, nombre: a.nombre, dato: a.dato, cuando: hoyTexto()
        });
        listo[cual] = 'plataforma';      // marca de que vive acá, no en el Drive
        /* SE OLVIDA LA COPIA GUARDADA: sin esto, después de subir una foto nueva el
           visor seguía mostrando la anterior. Lo cazó la prueba de subir dos seguidas. */
        delete adjuntosVistos[id + '_' + cual];
    }

    listo.liquidadoEl = hoyTexto();
    await traerCambios();
    const porId = Object.assign({}, (CAMBIOS && CAMBIOS.porId) || {});
    porId[String(id)] = Object.assign({}, porId[String(id)] || {}, listo);
    await guardarArea(AREA_CAMBIOS, { porId });
    CAMBIOS = { porId };
    cambiosLeidos = true;
    Object.keys(listo).forEach((k) => { f[k] = listo[k]; });

    await recontarLaSemana(f);
    return listo;
};

/**
 * El índice dice cuántas guías quedan abiertas en cada semana, y de ese número depende
 * que la pestaña Por liquidar las encuentre sin bajar el historial entero. Al cerrar
 * una hay que actualizarlo, o una guía vieja quedaría escondida para siempre.
 *
 * Se recuenta mirando la semana completa que está en memoria —no restando uno—: si la
 * cuenta se llevara a mano y se perdiera un guardado, el número iría quedando cada vez
 * más lejos de la verdad sin que nadie se entere. Y si el índice no se puede guardar,
 * la liquidación NO se deshace: ya está guardada, que es lo que importa.
 */
const recontarLaSemana = async (fila) => {
    try {
        const l = lunesDe(String(fila.desp || hoyTexto()));
        const filas = SEMANAS[l];
        if (!filas || !INDICE || !INDICE.semanas || !INDICE.semanas[l]) return;
        const abiertas = filas.filter(sinLiquidar);
        const sin = abiertas.length;
        /* Y EL REPARTO POR CANAL, que es de donde sale el número de cada módulo de la
           web. Se arma con TODOS los canales conocidos, no solo con los que aparecen:
           sin el cero explicito, Retail leería `undefined` y caería al total. */
        const porCanal = {};
        Object.keys(CANALES).forEach((c) => { porCanal[c] = 0; });
        abiertas.forEach((f) => { const c = canalDe(f); porCanal[c] = (porCanal[c] || 0) + 1; });
        const igual = INDICE.semanas[l].sin === sin
            && JSON.stringify(INDICE.semanas[l].sinPorCanal || null) === JSON.stringify(porCanal);
        if (igual) return;
        INDICE.semanas[l].sin = sin;
        INDICE.semanas[l].sinPorCanal = porCanal;
        await guardarArea(AREA_INDICE, INDICE);
    } catch (e) {
        console.warn('[despacho] no se pudo actualizar el índice:', e && e.message);
    }
};

/** La regla de la foto, en un solo sitio: sin foto no se puede dar por atendido. */
export const faltaLaFoto = (fila, adjuntos, estado) =>
    String(estado || '').toUpperCase() === 'ATENDIDO'
    && !(adjuntos && adjuntos.foto) && !(fila && fila.foto);
