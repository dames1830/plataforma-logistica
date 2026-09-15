/**
 * DESPACHO DE CATÁLOGO · la capa de datos
 *
 * La usan LAS DOS pantallas: `js/reportes/despacho_catalogo.js` en la web y la sección
 * Despacho de la app del celular. Está acá y no repetida en cada una por un motivo
 * concreto: si la regla de qué cuenta como "por liquidar" viviera en dos sitios, el día
 * que se cambie en uno, la web y el celular dirían números distintos del mismo día. Y
 * cuando dos pantallas se contradicen, no se puede creer a ninguna.
 *
 * ── LAS TRES ÁREAS ────────────────────────────────────────────────────────────
 *
 *   despacho_catalogo           la base importada del AppSheet. NO SE TOCA.
 *   despacho_catalogo_cambios   lo liquidado desde la plataforma, una entrada por id
 *   despacho_adj_<id>_<cual>    cada foto o PDF, en base64, en su propia área
 *
 * Que la base no se reescriba es lo que hace seguro seguir usando el AppSheet en
 * paralelo: si algo sale mal, se vuelve a importar y no se pierde una liquidación. Y
 * evita que dos personas liquidando a la vez se pisen, que es lo que pasaría mandando
 * el megabyte entero cada vez.
 */

const API = (window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com') + '/api/logistics';

export const AREA = 'despacho_catalogo';
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

/* ── LA FECHA, SIN toISOString ────────────────────────────────────────────────
   Devuelve UTC y en Lima adelanta el día a las 19:00, justo cuando entra el turno
   noche. Es la trampa número uno de este proyecto. */
export const hoyTexto = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const traerArea = async (area) => {
    try {
        const r = await fetch(`${API}/${area}?date=MASTER&z=${Date.now()}`);
        if (!r.ok) return null;
        const j = await r.json();
        const d = (j && j.data !== undefined) ? j.data : j;
        return (d && typeof d === 'object' && Object.keys(d).length) ? d : null;
    } catch (e) {
        console.warn('[catalogo] no se pudo traer', area, e && e.message);
        return null;
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
   Son 3.129 filas y el área se descarga entera, así que viene apretada: los campos
   que se repiten -agencia, destino, asesor, estado, líder- van en un catálogo y cada
   fila guarda el número. La ruta de la foto es un patrón y se guarda solo la parte
   variable. Acá se deshace todo eso. */
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

let FILAS = null;
let CAMBIOS = {};
let seLeyoLaBase = false;

/** Todos los despachos, con lo liquidado desde la plataforma ya superpuesto. */
export const traerDespachos = async (recargar) => {
    if (FILAS && !recargar) return FILAS;
    const base = await traerArea(AREA);
    seLeyoLaBase = !!base;
    const filas = abrir(base);
    CAMBIOS = (await traerArea(AREA_CAMBIOS)) || {};
    const porId = CAMBIOS.porId || {};
    filas.forEach((f) => {
        const c = porId[String(f.id)];
        if (c) Object.keys(c).forEach((k) => { f[k] = c[k]; });
    });
    FILAS = filas;
    return FILAS;
};

/** true si la base se pudo leer. Sirve para distinguir "no hay nada" de "no pude preguntar". */
export const seLeyo = () => seLeyoLaBase;

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
    if (!adjuntosVistos[clave]) adjuntosVistos[clave] = await traerArea(AREA_ADJ(id, cual));
    return adjuntosVistos[clave];
};

/**
 * Guarda una liquidación. Primero los adjuntos, después los campos: es peor un
 * despacho marcado ATENDIDO sin su foto que uno sin marcar.
 *
 * `cambio` son los campos del formulario; `adjuntos` es {foto, foto2, pdf} con lo que
 * devolvió prepararAdjunto(). Devuelve el cambio final, ya aplicado a la fila.
 */
export const liquidar = async (id, cambio, adjuntos, avisar) => {
    const f = (FILAS || []).find((x) => String(x.id) === String(id));
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
    const porId = Object.assign({}, (CAMBIOS && CAMBIOS.porId) || {});
    porId[String(id)] = Object.assign({}, porId[String(id)] || {}, listo);
    await guardarArea(AREA_CAMBIOS, { porId });
    CAMBIOS = { porId };
    Object.keys(listo).forEach((k) => { f[k] = listo[k]; });
    return listo;
};

/** La regla de la foto, en un solo sitio: sin foto no se puede dar por atendido. */
export const faltaLaFoto = (fila, adjuntos, estado) =>
    String(estado || '').toUpperCase() === 'ATENDIDO'
    && !(adjuntos && adjuntos.foto) && !(fila && fila.foto);
