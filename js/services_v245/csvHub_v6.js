import * as syncEngine from './sync_engine_v24_9.js?v=29.0464';

// Almacenamiento en memoria CACHÉ para respuesta rápida UI
export const dataStore = {
  tabla_tallas: {} // Mapa de SKU -> Talla
  // Otros datos se cargarán dinámicamente: [area]_activo, [area]_reserva, [area]
};

// =============================================
// OPTIMIZACIÓN: BASE DE DATOS LOCAL (IndexedDB)
// =============================================
const DB_NAME = 'LogisticsPulseDB';
const STORE_NAME = 'DataCache';
const DB_VERSION = 1;
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 días de validez

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveToDB = async (key, data) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ data, ts: Date.now() }, key);
        // Guardar meta en LS para acceso rápido UI (indicadores verdes) con conteo de registros para acelerar el Home
        const len = Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0);
        localStorage.setItem('meta_' + key, JSON.stringify({ ts: Date.now(), hasData: true, length: len }));
    } catch (err) { console.error("Error IndexedDB Save:", err); }
};

const loadFromDB = async (key) => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
                if (req.result && (Date.now() - req.result.ts < CACHE_TTL)) {
                    resolve(req.result.data);
                } else resolve(null);
            };
            req.onerror = () => resolve(null);
        });
    } catch (err) { return null; }
};

/**
 * Borra un área del IndexedDB Y ESPERA A QUE LA TRANSACCIÓN CIERRE.
 *
 * Antes el borrado se disparaba y se seguía de largo —`tx.objectStore(...).delete(area)`
 * suelto—, así que quien redibujaba enseguida podía leer la copia vieja y volver a
 * dejarla en pantalla. Un borrado que no se espera no es un borrado.
 */
const deleteFromDB = async (key) => {
    try {
        const db = await openDB();
        await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror    = () => resolve();
            tx.onabort    = () => resolve();
        });
        return true;
    } catch (err) {
        console.warn(`[PULSE] Error al limpiar localmente '${key}':`, err);
        return false;
    }
};

/**
 * La fecha que manda el servidor, leída bien.
 *
 * EL BACKEND GUARDA HORA DE LIMA, no UTC: su `ahora()` convierte a la zona de Lima
 * antes de escribir. Pero acá se le agregaba una "Z" —"2026-08-06T19:09:26Z"—, que la
 * declara UTC, y al mostrarla el navegador le restaba las 5 horas de diferencia. El
 * stock publicado a las 19:09 aparecía en pantalla como las 2:09 p.m.
 *
 * Una fecha SIN zona se lee como hora local, que es lo correcto para lo que guarda el
 * backend. Y si ya trae zona —una ISO terminada en Z, o con +05:00— se respeta: el
 * stock que se sube desde el navegador se estampa con toISOString(), y ése sí es UTC.
 */
export const fechaDelServidor = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    if (typeof valor === 'number') { const d = new Date(valor); return isNaN(d.getTime()) ? null : d; }
    let t = String(valor).trim();
    if (!t) return null;
    if (t.includes(' ') && !t.includes('T')) t = t.replace(' ', 'T');
    const d = new Date(t);            // sin zona -> hora local; con Z o +hh:mm -> la suya
    return isNaN(d.getTime()) ? null : d;
};

/** La misma fecha, ya escrita para mostrar. Devuelve '' si no hay nada que mostrar. */
export const textoFechaServidor = (valor, opciones) => {
    const d = fechaDelServidor(valor);
    return d ? d.toLocaleString('es-PE', opciones) : '';
};

export const getUploadMeta = (area) => {
    try {
        const meta = localStorage.getItem('meta_' + area);
        return meta ? JSON.parse(meta) : null;
    } catch(e) { return null; }
};

/* CUANDO SE QUITO, Y NO SOLO QUE ESTA VACIA.
 *
 * Las tres areas de la demanda se comparten, asi que una puede quedar vacia por algo
 * que hizo otra PC. La tarjeta que dice "VACIO" a secas no distingue eso de "nunca se
 * cargo", y desde que a PEDIDOS lo llena el robot esa diferencia importa: si el
 * analisis sale sin pedidos, tiene que poder verse que alguien lo quito y a que hora.
 *
 * `meta_` no sirve para esto: se borra justamente cuando el area se vacia. */
export const getVacioMeta = (area) => {
    try {
        const ts = parseInt(localStorage.getItem('vacio_' + area) || '', 10);
        return isNaN(ts) ? null : { ts };
    } catch(e) { return null; }
};

const marcarVacio = (area, ts) => {
    try { localStorage.setItem('vacio_' + area, String(ts || Date.now())); } catch(e) {}
};

const olvidarVacio = (area) => {
    try { localStorage.removeItem('vacio_' + area); } catch(e) {}
};

export const getAreaLength = async (area) => {
    if (dataStore[area] && Array.isArray(dataStore[area])) {
        return dataStore[area].length;
    }
    const meta = getUploadMeta(area);
    if (meta && meta.length !== undefined) {
        return meta.length;
    }
    const dbData = await loadFromDB(area);
    if (dbData) {
        dataStore[area] = dbData;
        const len = Array.isArray(dbData) ? dbData.length : (dbData ? Object.keys(dbData).length : 0);
        localStorage.setItem('meta_' + area, JSON.stringify({
            ...(meta || { ts: Date.now(), hasData: true }),
            length: len
        }));
        return len;
    }
    return 0;
};

const clearDB = async () => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        Object.keys(dataStore).forEach(k => localStorage.removeItem('meta_' + k));
    } catch(e) {}
};

// Inicializar dataStore desde IndexedDB al cargar la app - Optimizado con lazy loading
export const initPersistentData = async () => {
    // Solo cargamos localmente tabla_tallas por rendimiento en el inicio
    const cached = await loadFromDB('tabla_tallas');
    if (cached) {
        dataStore['tabla_tallas'] = cached;
        console.log(`[PULSE] Recuperado tabla_tallas de DB Local.`);
    }
};

// Iniciar carga en segundo plano
initPersistentData();

// Control Trazabilidad: Fecha seleccionada (null = Fecha Actual/Más reciente)
export let currentDateFilter = null;

// URL MAESTRA DEL SERVIDOR (Punto de conexión)
const getApiBase = (defaultUrl) => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('local')) {
      const val = urlParams.get('local');
      if (val === '1' || val === 'true') {
          localStorage.setItem('PULSE_USE_LOCAL', 'true');
      } else {
          localStorage.removeItem('PULSE_USE_LOCAL');
      }
  }
  if (localStorage.getItem('PULSE_USE_LOCAL') === 'true') {
      return 'http://localhost:8000/api';
  }
  return defaultUrl;
};
const API_BASE = getApiBase('https://logistics-backend-wv0x.onrender.com/api');
const SHARED_API = 'https://logistics-shared-api.onrender.com/api';
const VERSION = '29.0464';
const CACHE_KEY = `logistics_v24_prod_`;
const API_URL    = `${API_BASE}/logistics`;

export const getCol = (row, names) => {
    if (!row) return null;
    const normalize = (str) => String(str || '').toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^A-Z0-9]/g, ''); // Quitar todo lo que no sea letra o número

    const rowKeys = Object.keys(row);
    for (let n of names) {
        if (row[n] !== undefined) return row[n];
        const target = normalize(n);
        const found = rowKeys.find(k => normalize(k) === target);
        if (found) return row[found];
    }
    return null;
};

export const setDateFilter = (newDateStr) => {
    if (currentDateFilter !== newDateStr) {
        currentDateFilter = newDateStr;
        // Limpiamos la memoria caché al viajar por el tiempo
        Object.keys(dataStore).forEach(k => dataStore[k] = null);
        clearDB();
    }
};

export const pingServer = () => {
    fetch(`${API_BASE}/health`, { 
        method: 'GET',
        headers: { 'X-Environment': 'production' }
    })
        .then(() => console.log('✅ Servidor backend activo.'))
        .catch(() => console.warn('⏳ Backend despertando (cold start Render)...'));
};

// ── BUFFER HISTORY — usa /api/logistics/buffer_history (endpoint existente) ─────────────
// El endpoint /api/buffer/history no está desplegado aun. Usamos el endpoint
// genérico /api/logistics/{area} que YA funciona en producción.
const BUFFER_HIST_AREA   = 'buffer_history';          // clave en el servidor
const BUFFER_HIST_LOCAL_KEY = 'logistics_buffer_kpi_history_local';

const fetchWithTimeout = async (url, options = {}, timeout = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

/** Lee el array completo desde el servidor, con fallback a localStorage */
const _fetchHistFromServer = async () => {
    try {
        const res = await fetchWithTimeout(`${API_URL}/${BUFFER_HIST_AREA}?t=${Date.now()}`, {
            headers: { 'X-Environment': 'production' }
        }, 4000);
        if (res.ok) {
            const json = await res.json();
            // El endpoint devuelve { status, data } o el array directamente
            const arr = Array.isArray(json) ? json
                      : (Array.isArray(json?.data) ? json.data : null);
            if (arr) return arr;
        }
    } catch(e) { 
        console.warn('[BH] ⚠️ Error leyendo del servidor (offline o timeout):', e);
    }
    return null;
};

/** Guarda el array completo al servidor (POST sobreescribe el slot del área) */
const _saveHistToServer = async (arr) => {
    try {
        const res = await fetchWithTimeout(`${API_URL}/${BUFFER_HIST_AREA}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify(arr)
        }, 4000);
        const json = await res.json();
        return json.status === 'success' || json.status === 'ok' || res.ok;
    } catch(e) {
        console.warn('[BH] ⚠️ Servidor no disponible al guardar.', e);
        return false;
    }
};

/**
 * Guarda un registro en el servidor Y en localStorage usando el Motor de Sincronización.
 */
export const saveBufferHistoryRecord = async (record) => {
    const newRecord = { ...record, id: Date.now(), created_at: new Date().toISOString() };
    try {
        const currentList = syncEngine.syncStore.buffer_history || [];
        const newList = [newRecord, ...currentList];
        if (newList.length > 90) newList.pop();
        
        syncEngine.syncStore.buffer_history = newList;
        localStorage.setItem(BUFFER_HIST_LOCAL_KEY, JSON.stringify(newList));
        const ok = await syncEngine.pushChange('buffer_history', newList);
        if (ok) return newRecord.id;
    } catch(e) {
        console.warn('[BH] ⚠️ Error sincronizando con servidor:', e);
    }
    return null;
};

/**
 * Carga el historial completo desde el servidor usando el Motor de Sincronización. Fallback a localStorage.
 */
export const fetchBufferHistory = async (force = false) => {
    try {
        await syncEngine.pullGlobal(['buffer_history'], force);
    } catch(e) {
        console.warn('[BH] ⚠️ Error descargando historial del syncEngine:', e);
    }
    const list = syncEngine.syncStore.buffer_history || [];
    if (Array.isArray(list) && list.length > 0) {
        localStorage.setItem(BUFFER_HIST_LOCAL_KEY, JSON.stringify(list));
        return list;
    }
    try {
        const localData = JSON.parse(localStorage.getItem(BUFFER_HIST_LOCAL_KEY) || '[]');
        return Array.isArray(localData) ? localData : [];
    } catch(e) { return []; }
};

// --- RESERVA HISTORY ---
const RESERVA_HIST_LOCAL_KEY = 'logistics_reserva_history_v1';

export const saveReservaHistoryRecord = async (record) => {
    const newRecord = { ...record, id: Date.now(), created_at: new Date().toISOString() };
    try {
        const currentList = syncEngine.syncStore.reserva_history || [];
        const newList = [newRecord, ...currentList];
        if (newList.length > 90) newList.pop();
        
        syncEngine.syncStore.reserva_history = newList;
        localStorage.setItem(RESERVA_HIST_LOCAL_KEY, JSON.stringify(newList));
        const ok = await syncEngine.pushChange('reserva_history', newList);
        if (ok) return newRecord.id;
    } catch(e) {
        console.warn('[RH] ⚠️ Error sincronizando con servidor:', e);
    }
    return null;
};

// --- FOTOS DE RESERVA: una por dia, la del ancla de la noche ---
/**
 * LA FOTO CHICA DE LA RESERVA. Pedida por Daniel el 21-ago-2026 para poder mirar dias
 * pasados en Analisis Reserva con un calendario.
 *
 * NO se guardan las 18.947 filas crudas —serian 4 MB por dia, 120 al mes, y el disco del
 * servidor tiene ~500 MB libres: se llenaria en cuatro meses—. Se guarda el RESULTADO ya
 * calculado de los dos cuadros: 25 KB por dia, 0,7 MB al mes. Alcanza para redibujarlos
 * enteros, clic en las celdas incluido.
 *
 * El precio, y hay que saberlo: si algun dia hace falta una pregunta NUEVA sobre un dia
 * viejo —por marca, por temporada—, no se va a poder. Eso solo estaria en la foto cruda.
 *
 * UNA SOLA POR DIA, la del ancla de la NOCHE. Regla de Daniel: *"en la mañana no quiero
 * que se actualice, solo en la noche"*. La hora sale de Configuracion -> Parametros
 * (`robotsService`), nunca escrita aca: el la cambia y esto la sigue.
 */
const RESERVA_FOTOS_LOCAL_KEY = 'logistics_reserva_fotos_v1';

/* ══════════════════════════════════════════════════════════════════════════════
 * LAS FOTOS TIENEN QUE LLEGAR SI O SI. Tres agujeros tapados el 22-ago-2026.
 *
 * Daniel abrió Análisis Reserva con la versión buena —v29.0344 en el encabezado— y no
 * había gráfico, y encima la matriz mostraba 2.383 ocupadas cuando la foto guardada del
 * 21-08 dice 2.339. Los dos síntomas salen de lo mismo: **el navegador se quedó sin las
 * fotos**. Sin ellas no hay serie que dibujar, y el cuadro se cae a recalcular con el
 * stock que haya —que a esa hora ya era el de la mañana—.
 *
 * Había tres maneras de perderlas, y ninguna avisaba:
 *
 *   1. `pullGlobal` sin `force` se saltea entero si hay un empuje pendiente. Devuelve
 *      lo que ya tenía en memoria, que puede ser nada. Ahora se pide con force.
 *   2. Si el `localStorage` está lleno, `setItem` tira QuotaExceededError **antes del
 *      return**, y la lista recién bajada se pierde por completo. Ahora el guardado
 *      local va aparte: si falla, se avisa y se devuelve igual lo que se bajó.
 *   3. Si el sincronizador igual no las trajo, se pedía la copia local y ahí terminaba.
 *      Ahora se va a buscarlas derecho al servidor antes de rendirse.
 * ══════════════════════════════════════════════════════════════════════════════ */
export const fetchFotosReserva = async (force = true) => {
    try {
        await syncEngine.pullGlobal(['reserva_fotos'], force);
    } catch(e) {
        console.warn('[RF] No se pudo descargar las fotos de reserva:', e);
    }
    let list = syncEngine.syncStore.reserva_fotos || [];

    // Si el sincronizador no las trajo, se piden derecho. Es una sola llamada y solo
    // ocurre cuando algo fallo antes.
    if (!Array.isArray(list) || !list.length) {
        try {
            const r = await fetch(`${API_BASE}/logistics/reserva_fotos?z=${Date.now()}`);
            if (r.ok) {
                const j = await r.json();
                const d = (j && j.data !== undefined) ? j.data : j;
                if (Array.isArray(d) && d.length) {
                    list = d;
                    syncEngine.syncStore.reserva_fotos = d;
                    console.warn('[RF] Las fotos vinieron del servidor directo: el sincronizador no las trajo.');
                }
            }
        } catch(e) { console.warn('[RF] Tampoco se pudieron pedir derecho:', e); }
    }

    if (Array.isArray(list) && list.length > 0) {
        /* EL GUARDADO LOCAL NO PUEDE COSTAR LA LISTA. Son ~40 KB por día y el navegador
           tiene un tope: el día que se pase, `setItem` tira y sin este try se perdía todo
           lo bajado. La copia local es una comodidad, no la fuente. */
        try { localStorage.setItem(RESERVA_FOTOS_LOCAL_KEY, JSON.stringify(list)); }
        catch(e) { console.warn('[RF] No se pudo guardar la copia local de las fotos:', e); }
        return list;
    }
    try {
        const local = JSON.parse(localStorage.getItem(RESERVA_FOTOS_LOCAL_KEY) || '[]');
        return Array.isArray(local) ? local : [];
    } catch(e) { return []; }
};

/* ══════════════════════════════════════════════════════════════════════════════
 * LA BASE DE LOS FRAGMENTADOS — el compromiso que no se mueve
 *
 * Daniel, 22-ago-2026: *"yo tengo que dar un estatus todos los dias de estos treinta
 * articulos que ya le estoy dando a mi jefe: de esas 571 ubicaciones tengo que reducir
 * 183, a 388. Eso no se tiene que mover para nada, lo unico que si se tiene que mover
 * es el avance"*. **Una meta que se recalcula sola no es una meta**: si la lista se
 * rearma cada noche con el stock nuevo, el numero contra el que se mide el avance ya no
 * es el que se prometio.
 *
 * NO GUARDA LOS DATOS, GUARDA LA FECHA. La base es *"la foto del 21-08"*, y esa foto ya
 * esta en `reserva_fotos` con sus 30 articulos y sus totales. Guardar una copia seria
 * tener dos versiones del mismo dia y el dia que una se corrija, la otra queda mintiendo.
 *
 * Va con `date: 'MASTER'` a proposito: asi hay UNA sola fila en el servidor y no una por
 * cada vez que se fija una base. Ademas el GET sin fecha ordena por texto, y 'MASTER' le
 * gana a cualquier '2026-...', asi que leer y escribir en MASTER es lo unico coherente.
 * ══════════════════════════════════════════════════════════════════════════════ */

export const fetchBaseReserva = async (force = false) => {
    try {
        await syncEngine.pullGlobal(['reserva_base'], force);
    } catch(e) {
        console.warn('[RB] No se pudo descargar la base de reserva:', e);
    }
    const b = syncEngine.syncStore.reserva_base;
    return (b && b.fecha) ? b : null;
};

/** Fija la base. `fecha` es la de una foto que ya existe en reserva_fotos. */
export const guardarBaseReserva = async (fecha, quien) => {
    if (!fecha) return null;
    const base = { fecha: fecha, fijadaEl: new Date().toISOString(), fijadaPor: quien || '' };
    try {
        syncEngine.syncStore.reserva_base = base;
        const ok = await syncEngine.pushChange('reserva_base', base, 'MASTER');
        return ok ? base : null;
    } catch(e) {
        console.warn('[RB] No se pudo fijar la base de reserva:', e);
        return null;
    }
};

/** Guarda la foto de un dia. Si ya habia una de ese dia, la reemplaza. */
export const guardarFotoReserva = async (foto) => {
    if (!foto || !foto.fecha) return null;
    try {
        const actuales = syncEngine.syncStore.reserva_fotos || [];
        const lista = actuales.filter(f => f && f.fecha !== foto.fecha);
        lista.unshift({ ...foto, guardado: new Date().toISOString() });
        // Tres meses de colchon y no mas: a 25 KB por dia son unos 2 MB.
        lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        while (lista.length > 92) lista.pop();
        syncEngine.syncStore.reserva_fotos = lista;
        localStorage.setItem(RESERVA_FOTOS_LOCAL_KEY, JSON.stringify(lista));
        const ok = await syncEngine.pushChange('reserva_fotos', lista);
        return ok ? foto.fecha : null;
    } catch(e) {
        console.warn('[RF] No se pudo guardar la foto de reserva:', e);
        return null;
    }
};

export const fetchReservaHistory = async (force = false) => {
    try {
        await syncEngine.pullGlobal(['reserva_history'], force);
    } catch(e) {
        console.warn('[RH] ⚠️ Error descargando historial del syncEngine:', e);
    }
    const list = syncEngine.syncStore.reserva_history || [];
    if (Array.isArray(list) && list.length > 0) {
        localStorage.setItem(RESERVA_HIST_LOCAL_KEY, JSON.stringify(list));
        return list;
    }
    try {
        const localData = JSON.parse(localStorage.getItem(RESERVA_HIST_LOCAL_KEY) || '[]');
        return Array.isArray(localData) ? localData : [];
    } catch(e) { return []; }
};

/**
 * Actualiza un registro (por id) en el servidor usando el Motor de Sincronización.
 */
export const updateBufferHistoryRecord = async (id, record) => {
    try {
        const currentList = syncEngine.syncStore.buffer_history || [];
        const newList = [...currentList];
        const idx = newList.findIndex(r => r.id === id);
        if (idx !== -1) {
            newList[idx] = { ...newList[idx], ...record };
            syncEngine.syncStore.buffer_history = newList;
            localStorage.setItem(BUFFER_HIST_LOCAL_KEY, JSON.stringify(newList));
            return await syncEngine.pushChange('buffer_history', newList);
        }
    } catch(e) { console.warn('[BH] Error actualizando registro:', e); }
    return false;
};

/**
 * Elimina un registro (por id) del servidor usando el Motor de Sincronización.
 */
export const deleteBufferHistoryRecord = async (id) => {
    try {
        const currentList = syncEngine.syncStore.buffer_history || [];
        const newList = currentList.filter(r => r.id !== id);
        syncEngine.syncStore.buffer_history = newList;
        localStorage.setItem(BUFFER_HIST_LOCAL_KEY, JSON.stringify(newList));
        return await syncEngine.pushChange('buffer_history', newList);
    } catch(e) { console.warn('[BH] Error eliminando registro:', e); }
    return false;
};

export const saveBufferReport = async () => true;  // legacy
export const loadBufferReport = async () => { const h = await fetchBufferHistory(); return h[0] || null; };

export const saveLastBufferKPI = async (data) => {
    await saveToDB('lastBufferKPI_report', data);
};

/* EL ANALISIS, EN EL SERVIDOR, PARA QUE LO VEA CUALQUIER PC.
 *
 * Daniel, 25-ago-2026. Hasta ahora el reporte vivia solo en el IndexedDB de la maquina que
 * proceso: otro usuario abria la pantalla vacia y, si procesaba para ver algo, pisaba el
 * plan del servidor con su corrida.
 *
 * Se manda el objeto COMPLETO, el mismo que va a IndexedDB. Recortarlo seria adivinar que
 * campos usa el dibujo, y el dia que se agregue un cuadro dejaria de pintar.
 *
 * EL TOPE NO ES UN ADORNO: por encima de 12 MB el servidor rechaza y sin este aviso la
 * pantalla diria que publico. Mejor que quede en local y se sepa. */
const AREA_ANALISIS_BUFFER = 'analisis_buffer';
const TOPE_ANALISIS_MB = 12;

export const publicarAnalisisBuffer = async (data, fecha) => {
    if (!data || !fecha) return false;
    let cuerpo;
    try { cuerpo = JSON.stringify(data); }
    catch (e) { console.warn('[AB] El análisis no se pudo serializar:', e); return false; }
    const mb = cuerpo.length / 1048576;
    if (mb > TOPE_ANALISIS_MB) {
        console.warn(`[AB] El análisis pesa ${mb.toFixed(1)} MB y no se sube `
            + `(tope ${TOPE_ANALISIS_MB} MB). Queda solo en esta PC.`);
        return false;
    }
    try {
        const r = await fetch(`${API_BASE}/logistics/${AREA_ANALISIS_BUFFER}?date=${fecha}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo
        });
        console.log(r.ok
            ? `[AB] ✅ Análisis publicado (${fecha}): ${mb.toFixed(2)} MB, visible desde cualquier PC.`
            : `[AB] ⚠️ El análisis no se pudo publicar (${r.status}).`);
        return r.ok;
    } catch (e) { console.warn('[AB] No se pudo publicar el análisis:', e); return false; }
};

/* LOS FACTORES DEL COLCHON, GLOBALES.
 *
 * Las tres tablas viven en el localStorage porque `calculateBufferPallets` es SINCRONA y las
 * lee sin poder esperar a la red. Asi que el servidor no las reemplaza: las BAJA y las
 * escribe en el localStorage antes de procesar. */
const AREA_CFG_ANALISIS = 'config_analisis';
const CLAVES_FACTORES = {
    tallasGenero: 'logistics_v24_prod_configTallasGenero',
    skuExcepciones: 'logistics_v24_prod_configSKUExcepciones',
    marcaGenero: 'logistics_v24_prod_configMarcaGenero'
};

export const publicarFactores = async () => {
    const cuerpo = {};
    Object.keys(CLAVES_FACTORES).forEach(k => {
        try { cuerpo[k] = JSON.parse(localStorage.getItem(CLAVES_FACTORES[k]) || '{}') || {}; }
        catch (e) { cuerpo[k] = {}; }
    });
    /* NUNCA PUBLICAR LAS TRES TABLAS VACIAS. Una PC que abre la pantalla sin factores y
       guarda estaria BORRANDOSELOS A TODOS: el area es una sola y la ultima escritura manda.
       Vaciar los factores tiene que ser una decision explicita, no el efecto de abrir una
       pantalla en la maquina equivocada. */
    const cuantos = Object.keys(CLAVES_FACTORES)
        .reduce((n, k) => n + Object.keys(cuerpo[k] || {}).length, 0);
    if (cuantos === 0) {
        console.warn('[FACTORES] No se publica: las tres tablas están vacías en esta PC. '
            + 'Publicarlas borraría los factores del servidor.');
        return false;
    }
    cuerpo.guardadoEl = new Date().toISOString();
    try {
        const r = await fetch(`${API_BASE}/logistics/${AREA_CFG_ANALISIS}?date=MASTER`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        console.log(r.ok
            ? `[FACTORES] ✅ Publicados: ${Object.keys(cuerpo.tallasGenero).length} por género/talla, `
              + `${Object.keys(cuerpo.marcaGenero).length} por marca, `
              + `${Object.keys(cuerpo.skuExcepciones).length} excepciones.`
            : `[FACTORES] ⚠️ No se pudieron publicar (${r.status}).`);
        return r.ok;
    } catch (e) { console.warn('[FACTORES] No se pudieron publicar:', e); return false; }
};

/* Los baja y los deja en el localStorage. Si el servidor no contesta, se sigue con lo que
   haya en esta PC: correr con los factores de ayer es mejor que no correr. */
export const bajarFactores = async () => {
    try {
        const r = await fetch(`${API_BASE}/logistics/${AREA_CFG_ANALISIS}?date=MASTER&z=${Date.now()}`);
        if (!r.ok) return false;
        const j = await r.json();
        const d = (j && j.data !== undefined) ? j.data : j;
        if (!d || typeof d !== 'object') return false;
        let n = 0;
        Object.keys(CLAVES_FACTORES).forEach(k => {
            if (d[k] && typeof d[k] === 'object') {
                localStorage.setItem(CLAVES_FACTORES[k], JSON.stringify(d[k]));
                n += Object.keys(d[k]).length;
            }
        });
        if (n) console.log(`[FACTORES] Traídos del servidor: ${n} valores.`);
        return n > 0;
    } catch (e) { console.warn('[FACTORES] No se pudieron traer:', e); return false; }
};

/* LAS TABLAS DE FACTORES CALCULADOS, para el combo del Analisis Buffer. Se cachean en
 * memoria: `calculateBufferPallets` es sincrona y no puede esperar a la red. */
let _factoresCalc = null;
export const traerFactoresCalculados = async (force = false) => {
    if (_factoresCalc && !force) return _factoresCalc;
    try {
        const r = await fetch(`${API_BASE}/logistics/factores_calculados?date=MASTER&z=${Date.now()}`);
        if (!r.ok) return null;
        const j = await r.json();
        const d = (j && j.data !== undefined) ? j.data : j;
        if (d && (d.dia1 || d.dia2)) { _factoresCalc = d; return d; }
        return null;
    } catch (e) { console.warn('[FACTORES] No se pudieron traer los calculados:', e); return null; }
};
export const factoresCalculadosEnMemoria = () => _factoresCalc;

export const traerAnalisisBuffer = async (fecha) => {
    if (!fecha) return null;
    try {
        const r = await fetch(`${API_BASE}/logistics/${AREA_ANALISIS_BUFFER}?date=${fecha}&z=${Date.now()}`);
        if (!r.ok) return null;
        const j = await r.json();
        const d = (j && j.data !== undefined) ? j.data : j;
        return (d && (d.resumenSKUDetalle || d.detalle || d.waterfall)) ? d : null;
    } catch (e) { console.warn('[AB] No se pudo traer el análisis del servidor:', e); return null; }
};
export const loadLastBufferKPI = async () => {
    return await loadFromDB('lastBufferKPI_report');
};

// ── KPI RESULTS — usa /api/logistics/kpi_results_v2 (endpoint existente) ────────────
const KPI_RESULTS_AREA   = 'kpi_results_v2';          // clave en el servidor
const KPI_RESULTS_LS_KEY = 'logistics_v24_prod_kpiResultsByDate';

/** Lee el objeto {fecha: [...resultados]} del servidor */
const _fetchKPIStore = async () => {
    try {
        const res = await fetchWithTimeout(`${API_URL}/${KPI_RESULTS_AREA}?t=${Date.now()}`, {
            headers: { 'X-Environment': 'production' }
        }, 4000);
        if (res.ok) {
            const json = await res.json();
            const obj = Array.isArray(json) ? null
                      : (json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data
                      : (typeof json === 'object' && !Array.isArray(json) && json !== null ? json : null));
            if (obj) return obj;
        }
    } catch(e) { /* offline */ }
    return null;
};

const _saveKPIStore = async (obj) => {
    try {
        const res = await fetchWithTimeout(`${API_URL}/${KPI_RESULTS_AREA}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify(obj)
        }, 4000);
        return (await res.json()).status === 'success' || res.ok;
    } catch(e) { return false; }
};

export const saveKPIResults = async (fecha, results) => {
    // 1. Cache local
    try {
        const raw = JSON.parse(localStorage.getItem(KPI_RESULTS_LS_KEY) || '{}');
        raw[fecha] = results;
        const keys = Object.keys(raw).sort().reverse();
        if (keys.length > 30) keys.slice(30).forEach(k => delete raw[k]);
        localStorage.setItem(KPI_RESULTS_LS_KEY, JSON.stringify(raw));
    } catch(e) {}
    // 2. Servidor
    try {
        const store = await _fetchKPIStore() || {};
        store[fecha] = results;
        const keys = Object.keys(store).sort().reverse();
        if (keys.length > 30) keys.slice(30).forEach(k => delete store[k]);
        const ok = await _saveKPIStore(store);
        if (ok) console.log(`[KPI] ✅ Guardado en servidor. fecha=${fecha} rows=${results.length}`);
        return ok;
    } catch(e) {
        console.warn('[KPI] ⚠️ Servidor no disponible:', e);
        return false;
    }
};

export const loadKPIResults = async (fecha = null) => {
    const store = await _fetchKPIStore();
    if (store) {
        const key = fecha || Object.keys(store).sort().reverse()[0];
        if (key && store[key]) return { fecha: key, data: store[key], row_count: store[key].length, from_server: true };
        return { fecha, data: [], row_count: 0, from_server: true };
    }
    // Fallback localStorage
    try {
        const raw = JSON.parse(localStorage.getItem(KPI_RESULTS_LS_KEY) || '{}');
        const key = fecha || Object.keys(raw).sort().reverse()[0];
        if (key && raw[key]) return { fecha: key, data: raw[key], row_count: raw[key].length, from_server: false };
    } catch(e) {}
    return { fecha, data: [], row_count: 0, from_server: false };
};

export const fetchKPIDates = async () => {
    const store = await _fetchKPIStore();
    if (store) return Object.keys(store).sort().reverse().map(f => ({ fecha: f, row_count: (store[f] || []).length }));
    try {
        const raw = JSON.parse(localStorage.getItem(KPI_RESULTS_LS_KEY) || '{}');
        return Object.keys(raw).sort().reverse().map(f => ({ fecha: f, row_count: raw[f].length }));
    } catch(e) { return []; }
};

export const loadKPIResultsRange = async (fechaFrom, fechaTo) => {
    // Leer del servidor usando el endpoint gen\u00e9rico que ya funciona
    const store = await _fetchKPIStore();
    const source = store || JSON.parse(localStorage.getItem(KPI_RESULTS_LS_KEY) || '{}');
    const from_server = !!store;

    const matchingDates = Object.keys(source)
        .filter(f => (!fechaFrom || f >= fechaFrom) && (!fechaTo || f <= fechaTo))
        .sort();
    const combined = matchingDates.flatMap(f => source[f] || []);
    return { data: combined, row_count: combined.length, dates: matchingDates, from_server };
};


export const fetchAvailableDates = async () => {
    try {
        const response = await fetch(`${API_URL}/dates`, {
            headers: { 'X-Environment': 'production' }
        });
        if (response.ok) {
            const data = await response.json();
            return data.dates || [];
        }
    } catch (e) { console.warn("No se pudo obtener el historial de fechas", e); }
    return [];
};

/* AQUI VIVIA logSystemAction, Y NUNCA GUARDO NADA.
 *
 * Mandaba cada accion a `POST /api/logs`, un endpoint que el servidor NO TIENE: devuelve
 * 404 desde siempre. El error lo tragaba su propio try/catch, asi que nueve sitios de la
 * plataforma creian estar dejando constancia de lo que hacian y no dejaban ninguna. Dos
 * de esos nueve encima lo llamaban mal: le pasaban 'TEMA' donde va el usuario.
 *
 * Daniel, 27-ago-2026: *"o lo solucionas o lo borras; si no apunta a nada, borralo"*.
 * Tiene razon: un registro que dice que registra y no registra es peor que no tenerlo,
 * porque el dia que haga falta buscar quien hizo algo, no va a estar.
 *
 * La tabla `audit_logs` sigue en el servidor, creada y vacia. No se toco: quitarla exige
 * desplegar el backend y no estorba. Si algun dia se quiere el historial de verdad, hay
 * que hacer el endpoint que falta -POST y GET- y una pantalla para mirarlo.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   EL MAESTRO DE ARTÍCULOS EN LA NUBE

   El Maestro es el único archivo que TODAS las pantallas necesitan: de ahí salen
   las categorías (Gender RIMS), las marcas y el gender de cada SKU. Hasta ahora
   era "solo local": cada PC tenía que subirlo por su cuenta, y la que no lo tenía
   se quedaba sin categorías.

   Ahora se publica UNA vez desde Configuración → Archivos Nube y todas las PC lo
   bajan de ahí. Para no bajar el archivo entero cada vez que alguien abre la web,
   se publican DOS cosas:

     articulos       las filas (pesa unos 5 MB, pero viaja comprimido a ~200 KB)
     articulos_meta  una ficha de unos pocos bytes: cuántas filas, cuándo y quién

   La ficha se consulta primero. Si coincide con lo que ya está guardado en el
   navegador, no se baja nada.

   Estas funciones son aparte a propósito: el resto del sistema sigue tratando
   'articulos' como archivo local, así que subirlo desde Archivo Almacenaje sigue
   afectando solo a esa PC. Publicar es un acto explícito y con permiso.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAESTRO_AREA = 'articulos';
const MAESTRO_FICHA = 'articulos_meta';
/** Lo último que este navegador bajó, para saber si hace falta bajar de nuevo. */
const MAESTRO_CACHE_KEY = 'maestro_nube_ficha_v1';

/** Columnas que el Maestro tiene que traer sí o sí para servir de algo. */
const MAESTRO_COLUMNAS = ['CodArticulo', 'G. Gender', 'Gender RIMS'];

/**
 * Revisa que el archivo sea realmente el Maestro antes de publicarlo.
 * Publicar el archivo equivocado deja sin categorías a toda la empresa, así que
 * conviene que falle acá y no después.
 */
export const revisarMaestro = (filas) => {
    if (!Array.isArray(filas) || filas.length === 0) {
        return { ok: false, motivo: 'El archivo está vacío.' };
    }
    const primera = filas[0];
    const titulos = (Array.isArray(primera) ? primera : Object.keys(primera))
        .map(h => String(h || '').trim().toUpperCase());

    const faltan = MAESTRO_COLUMNAS.filter(c => !titulos.includes(c.toUpperCase()));
    if (faltan.length) {
        return {
            ok: false,
            motivo: `No parece el Maestro de Artículos: le faltan las columnas ${faltan.join(', ')}.`,
            titulos
        };
    }
    // La fila de títulos no cuenta como artículo
    const articulos = Array.isArray(primera) ? filas.length - 1 : filas.length;
    if (articulos < 1000) {
        return {
            ok: false,
            motivo: `Solo tiene ${articulos.toLocaleString('es-PE')} artículos. El Maestro completo tiene decenas de miles: parece un archivo cortado.`,
            articulos
        };
    }
    return { ok: true, articulos, titulos };
};

/** Ficha de la copia publicada. Pesa unos pocos bytes, se puede pedir siempre. */
export const infoMaestroPublicado = async () => {
    try {
        const res = await fetch(`${API_URL}/${MAESTRO_FICHA}?t=${Date.now()}`);
        if (!res.ok) return null;
        const j = await res.json();
        const f = j && j.data;
        // Un área sin datos devuelve {} o []: eso significa "nunca se publicó"
        if (!f || Array.isArray(f) || !f.filas) return null;
        return { filas: f.filas, usuario: f.usuario || '—', fecha: f.fecha || j.updated_at || '' };
    } catch (e) {
        console.warn('[MAESTRO] No se pudo consultar la ficha:', e && e.message);
        return null;
    }
};

/**
 * LA HORA A LA QUE SE PUBLICÓ, EN HORA DE ACÁ Y NO EN LA DE GREENWICH.
 *
 * Acá había un toISOString(), que devuelve UTC. Perú está cinco horas atrás, así que un
 * Maestro publicado a las 19:31 quedaba fichado a las 00:31 —y del día siguiente—, que es
 * justo la hora a la que se trabaja: el turno noche entra a las 19:00.
 *
 * Y el daño no se podía deshacer después. La ficha no guarda el instante, guarda el texto
 * ya armado, y al armarlo se le cae la 'Z' que avisaba que eso era UTC. Sin esa marca, el
 * que la muestra no tiene cómo saber que hay que restarle cinco horas: la pinta tal cual.
 *
 * El backend estampa en hora de Lima desde la v29.0079, pero esta ficha se arma en el
 * navegador y quedó afuera de aquel arreglo.
 */
const selloLocal = () => {
    const d = new Date();
    const dd = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())} `
         + `${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
};

/**
 * Publica el Maestro para toda la empresa. Devuelve la ficha que quedó publicada.
 * Sube primero las filas y la ficha DESPUÉS: si el envío grande falla, la ficha
 * sigue describiendo la copia anterior y nadie baja un archivo a medias.
 */
export const publicarMaestro = async (filas, username = 'sistema') => {
    const revision = revisarMaestro(filas);
    if (!revision.ok) throw new Error(revision.motivo);

    const enviar = async (area, cuerpo) => {
        const res = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        if (!res.ok) throw new Error(`El servidor rechazó ${area} (${res.status}).`);
        return res;
    };

    await enviar(MAESTRO_AREA, filas);

    const ficha = {
        filas: revision.articulos,
        usuario: username,
        fecha: selloLocal()
    };
    await enviar(MAESTRO_FICHA, ficha);

    // Queda también en esta PC, para no tener que volver a bajarlo enseguida
    dataStore[MAESTRO_AREA] = filas;
    await saveToDB(MAESTRO_AREA, filas);
    localStorage.setItem(MAESTRO_CACHE_KEY, JSON.stringify(ficha));

    return ficha;
};

/**
 * Deja el Maestro publicado disponible en dataStore.articulos.
 * Solo baja el archivo grande si la copia guardada en el navegador no coincide
 * con la ficha publicada. Devuelve de dónde salió, para poder avisarlo.
 */
export const traerMaestroPublicado = async () => {
    const ficha = await infoMaestroPublicado();
    if (!ficha) return { origen: 'no publicado', filas: 0, ficha: null };

    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(MAESTRO_CACHE_KEY) || 'null'); } catch (e) { /* sin cache */ }

    const mismaCopia = guardada && guardada.fecha === ficha.fecha && guardada.filas === ficha.filas;
    if (mismaCopia) {
        // Ya se bajó antes: alcanza con lo que está en el navegador
        const local = dataStore[MAESTRO_AREA] || await loadFromDB(MAESTRO_AREA);
        if (Array.isArray(local) && local.length > 0) {
            dataStore[MAESTRO_AREA] = local;
            return { origen: 'navegador', filas: local.length, ficha };
        }
    }

    const res = await fetch(`${API_URL}/${MAESTRO_AREA}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`No se pudo bajar el Maestro (${res.status}).`);
    const j = await res.json();
    const filas = (j && j.data) || [];
    if (!Array.isArray(filas) || filas.length === 0) {
        return { origen: 'no publicado', filas: 0, ficha };
    }

    dataStore[MAESTRO_AREA] = filas;
    await saveToDB(MAESTRO_AREA, filas);
    localStorage.setItem(MAESTRO_CACHE_KEY, JSON.stringify(ficha));
    return { origen: 'servidor', filas: filas.length, ficha };
};

/**
 * GUARDA DATOS EN UN ÁREA CUANDO NO HAY ARCHIVO QUE SUBIR.
 *
 * Mismo camino que `parseFile` —memoria, base local, meta de carga y publicación de la
 * demanda— pero para filas que arma el propio sistema. Lo usa la Zona Buffer cuando la
 * corrida del Replenishment se trae del servidor en vez de bajarse en un Excel y volver a
 * subirse a mano.
 *
 * Las filas tienen que venir en el MISMO formato que dejaría el archivo, porque las lee el
 * mismo motor: para el replenishment, pares `[código, cantidad]` en ese orden, que es como
 * los lee `rawDemand['REPLENISHMENT']` —por posición, no por nombre de columna—.
 */
export const guardarAreaManual = async (area, filas, username = 'sistema') => {
    if (!area || !Array.isArray(filas)) throw new Error('Área o filas inválidas');
    await persistToDatabase(area, filas, username);
    return filas;
};

export const parseFile = (file, area) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject('Archivo inválido');
    setDateFilter(null);
    dataStore[area] = null;

    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
          if(results.errors.length && !results.data.length) reject(results.errors);
          else {
             try {
                 const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
                 await persistToDatabase(area, results.data, session.username || 'sistema');
                 resolve(results.data);
             } catch(dbErr) {
                 reject('Error Servidor: ' + dbErr.message);
             }
          }
        },
        error: (err) => reject(err)
      });
    } else if (file.name.toLowerCase().endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          let sheetName = workbook.SheetNames[0];
          if (area === 'stockReserva' || area.endsWith('_reserva')) {
              const foundName = workbook.SheetNames.find(name => {
                  const n = name.toLowerCase();
                  return n.includes('montacarga') || n.includes('reserva') || n.includes('alto') || n.includes('detall');
              });
              if (foundName) {
                  sheetName = foundName;
                  console.log(`[PULSE] Detectada pestaña específica de Reserva: ${sheetName}`);
              }
          }
          const sheet = workbook.Sheets[sheetName];
          
          let jsonData = [];
          if (area === 'no_retail') {
              const targetSheetName = workbook.SheetNames.find(name => name.toLowerCase().startsWith('orden_despacho')) || workbook.SheetNames[0];
              const targetSheet = workbook.Sheets[targetSheetName];
              const rawData = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: "" });
              
              // Eliminar estrictamente las 8 primeras filas como indica el usuario
              if (rawData.length > 8) {
                  jsonData = rawData.slice(8);
              } else {
                  jsonData = rawData;
              }
          } else if (area === 'stockReserva' || area.endsWith('_reserva')) {
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
              const dc = (s) => String(s || '').trim();
              const cleanUbi = (s) => dc(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

              for (let i = 2; i < rows.length; i++) {
                  const r = rows[i];
                  if (!r || r.length < 5) continue;
                  
                  // Mapeo flexible: Intentar por índice o por contenido si r[1] no es el nivel
                  const nivelRaw = dc(r[1]).toUpperCase();
                  const esAlto = nivelRaw.includes('ALTO') || nivelRaw === 'A';
                  
                  jsonData.push({
                      'NIVEL': nivelRaw,
                      'ES_ALTO': esAlto,
                      'PRODUCTO': dc(r[8]), // Columna I
                      'CANTIDAD': parseFloat(r[10]) || 0,
                      'UBICACION': dc(r[4]), // Columna E
                      'UBI_KEY': cleanUbi(r[4]),
                      'LPN': dc(r[5]),       // Columna F
                      'DESCRIPCION': dc(r[9]) 
                  });
              }
          } else if (area === 'matriz_ubicaciones') {
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
              const dc = (s) => String(s || '').trim();
              const cleanUbi = (s) => dc(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
              // Empezar en 0 pero filtrar cualquier fila que parezca un encabezado (UBICACION / UBICACIÓN)
              for (let i = 0; i < rows.length; i++) {
                  const r = rows[i];
                  if (!r || !dc(r[0])) continue;
                  const firstCell = dc(r[0]).toUpperCase();
                  if (firstCell.includes('UBICAC') || firstCell.includes('MATRIZ')) continue;
                  
                  jsonData.push({
                      'UBICACION': dc(r[0]),
                      'UBI_KEY': cleanUbi(r[0])
                  });
              }
          } else {
              // Por defecto para reportes genéricos como el Conteo ERI
              // Usamos header: 1 para obtener un array de arrays (A, B, C...)
              jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: "" });
          }

          const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
          await persistToDatabase(area, jsonData, session.username || 'sistema');
          resolve(jsonData);
        } catch(err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reject('Formato no soportado.');
    }
  });
};

export const parseBufferFiles = async (files) => {
    let combinedData = [];
    setDateFilter(null);
    for (let file of files) {
        if (!file.name.toLowerCase().endsWith('.csv')) continue;
        let res = await new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
            });
        });
        combinedData = combinedData.concat(res);
    }
    const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
    await persistToDatabase('buffer', combinedData, session.username || 'sistema');
    dataStore['buffer'] = combinedData;
    return combinedData;
};

/* ══════════════════════════════════════════════════════════════════════════════
   LA DEMANDA, EN LA NUBE

   El análisis del buffer se arma de TRES archivos, y los tres vivían solo en la PC
   que los cargó. Consecuencia: únicamente esa computadora podía correr el análisis.
   Si esa PC no estaba, nadie más podía; y el reporte del turno se quedaba sin meta
   para Bajada de paletas y para Separación.

   Es el mismo problema que el 02-ago-2026 se resolvió con los stocks —dos PC daban
   papeles distintos— y se resuelve igual: se publican, y todas las pantallas leen
   el mismo.

   SE SUBEN SOLO LAS COLUMNAS QUE EL MOTOR USA. El archivo de pedidos trae 30
   columnas y 50.333 filas: 58 MB. De ahí el motor lee TRES —código, solicitada y
   asignada— y calcula `solicitada − asignada`. Con esas tres son 4,6 MB.

   Las otras dos fuentes el motor las lee POR POSICIÓN —`Object.values(fila)[0]` es
   el código y `[1]` la cantidad— así que se guardan como pares en ese orden y no
   como objetos con nombre. Así la posición es explícita y no depende de en qué
   orden quedaron las claves.

   No se filtran las líneas ya atendidas aunque el motor las descarte: quedarían
   10.253 de 50.333 y la pantalla diría que se perdieron filas. Verificado que el
   total pedido es el mismo con y sin filtro: 20.245 pares.

   CADA UNA TRAE SU `valida`, Y NO ES UN ADORNO. En el servidor quedó un archivo de
   pedidos del 23-jun-2026 SIN REDUCIR, de cuando esto se guardaba entero: 50.333
   filas de 30 columnas. Hasta hoy nadie lo leía —el área era local— pero desde que
   se lee, una PC lo bajaría, se lo daría al motor Y ADEMÁS pisaría con él la copia
   local del archivo de hoy. Se rechaza lo que no tenga el formato reducido y se sigue
   con lo que tenga la PC, que es el bueno.
   ══════════════════════════════════════════════════════════════════════════════ */
const DEMANDA_EN_LA_NUBE = {
    /* PEDIDOS. Los nombres de salida son los canónicos, y están dentro de la lista
       que busca el motor, así que el cálculo no cambia ni una línea. */
    buffer: {
        reducir: (filas) => (filas || []).map(f => ({
            'Código de artículo':  String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo', 'Artículo', 'Cod. Articulo', 'CodArticulo', 'Producto']) || '').trim(),
            'Cantidad solicitada': getCol(f, ['Cantidad solicitada', 'Solicitada', 'Cant. Solicitada', 'Cantidad', 'Cant']) || 0,
            'Cantidad asignada':   getCol(f, ['Cantidad asignada', 'Asignada', 'Cant. Asignada', 'Asignado']) || 0
        })).filter(f => f['Código de artículo']),
        /* Tres columnas, no treinta. Se deja margen por si alguna vez se agrega una. */
        valida: (fila) => !!fila && !Array.isArray(fila) && Object.keys(fila).length <= 5
    },

    /* OTRAS SOLICITUDES y REPLENISHMENT: código y cantidad, EN ESE ORDEN. */
    solicitud: {
        reducir: (filas) => (filas || []).map(f => Object.values(f).slice(0, 2))
                                         .filter(v => String(v[0] || '').trim()),
        valida: (fila) => Array.isArray(fila) && fila.length === 2
    },
    tallas: {
        reducir: (filas) => (filas || []).map(f => Object.values(f).slice(0, 2))
                                         .filter(v => String(v[0] || '').trim()),
        valida: (fila) => Array.isArray(fila) && fila.length === 2
    }
};

/** ¿Esta área es una de las tres de la demanda, que ahora se comparten? */
export const esAreaDeDemanda = (area) => Object.prototype.hasOwnProperty.call(DEMANDA_EN_LA_NUBE, area);

const persistToDatabase = async (area, payload, username = 'sistema') => {
    // `username` ya no se usa: lo pedia logSystemAction, que se borro por no guardar nada.
    // Se deja en la firma porque media docena de sitios lo pasan; sacarlo obliga a tocarlos todos.
    // 1. Guardar de forma inmediata en local IndexedDB y memoria
    dataStore[area] = payload;
    await saveToDB(area, payload);
    
    // [AUTO] Actualizar Tabla de Tallas si es Stock Activo o Reserva de cualquier área
    if (area.endsWith('_activo') || area.endsWith('_reserva')) {
        updateTablaTallas();
    }

    /* 1.b LA DEMANDA SE PUBLICA, REDUCIDA.
     *
     * Va acá arriba y no en el envío de más abajo porque el área sigue siendo
     * "local-only" para todo lo demás: en la PC se guarda el archivo ENTERO, con sus
     * 30 columnas, que es lo que se ve en pantalla y lo que se descarga. A la nube va
     * solo lo que el motor necesita.
     *
     * Sin `await`: cargar el archivo no puede quedarse esperando al servidor. Si el
     * envío falla, esta PC igual tiene el archivo y puede calcular; lo que se pierde
     * es que las otras lo vean, y eso se arregla volviendo a cargarlo.
     *
     * NO SE LE PONE `X-Environment` A MANO. En pruebas lo sella `env.js`, y en
     * producción no va cabecera, que es como el servidor entiende "los datos de
     * verdad". Ponerla fija acá es lo que hace el envío de más abajo, y funciona solo
     * porque env.js la sobrescribe: es una trampa esperando a que alguien toque env.js.
     */
    if (DEMANDA_EN_LA_NUBE[area]) {
        olvidarVacio(area);
        try {
            const reducido = DEMANDA_EN_LA_NUBE[area].reducir(payload);
            fetch(`${API_URL}/${area}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reducido)
            }).then(r => {
                if (r.ok) {
                    console.log(`[DEMANDA] ✅ ${area} publicado: ${reducido.length.toLocaleString('es-PE')} filas de ${(payload || []).length.toLocaleString('es-PE')}.`);
                } else {
                    console.warn(`[DEMANDA] ⚠️ ${area} no se pudo publicar (${r.status}). Las otras PC van a seguir con el anterior.`);
                }
            }).catch(e => console.warn(`[DEMANDA] ⚠️ ${area} no se pudo publicar:`, e && e.message));
        } catch (e) {
            console.warn(`[DEMANDA] No se pudo preparar ${area} para publicar:`, e);
        }
    }

    // 2. Si es local-only, terminar aquí
    const isLocalOnly = area.startsWith('recepcion') || area === 'articulos' || area === 'validar_reserva' || area === 'validar_activo' || area === 'validar_lpn' || area.startsWith('buffer') || area === 'solicitud' || area === 'tallas' || area.startsWith('analisis_sku');
    if (isLocalOnly) {
        if (area.startsWith('recepcion')) {
            localStorage.removeItem('recepcion_report_processed');
        }

        // --- RESERVA HISTORY HOOK ---
        if (area === 'analisis_sku_reserva') {
            const raw = dataStore.analisis_sku_reserva;
            if (raw && raw.length > 0) {
                const skuGroups = {};
                const ubiGroups = {};
                for (let i = 0; i < raw.length; i++) {
                    const row = raw[i];
                    if (!row || (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL'))) continue;
                    const ubi = String(row.UBICACION || '').trim();
                    const lpn = String(row.LPN || '').trim();
                    const sku = String(row.PRODUCTO || '').trim();
                    const cant = parseFloat(row.CANTIDAD) || 0;
                    if (!sku || !ubi || cant <= 0) continue;
                    
                    const paletaKey = lpn ? `LPN: ${lpn} (${ubi})` : `UBI: ${ubi}`;
                    if (!skuGroups[sku]) skuGroups[sku] = new Set();
                    skuGroups[sku].add(paletaKey);
                    
                    const skuKey = lpn ? `LPN: ${lpn} (${sku})` : `SKU: ${sku}`;
                    if (!ubiGroups[ubi]) ubiGroups[ubi] = new Set();
                    ubiGroups[ubi].add(skuKey);
                }
                
                let skusFragmentados = 0;
                for (const s of Object.keys(skuGroups)) {
                    if (skuGroups[s].size > 1) skusFragmentados++;
                }
                
                let ubisMixtas = 0;
                for (const u of Object.keys(ubiGroups)) {
                    if (ubiGroups[u].size > 1) ubisMixtas++;
                }
                
                saveReservaHistoryRecord({
                    total_skus: Object.keys(skuGroups).length,
                    skus_fragmentados: skusFragmentados,
                    total_ubicaciones: Object.keys(ubiGroups).length,
                    ubicaciones_mixtas: ubisMixtas
                });
            }
        }

        return;
    }

    // 3. Sincronizar con el servidor en segundo plano (SIN await para no bloquear la interfaz)
    fetch(`${API_URL}/${area}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-Environment': 'production'
        },
        body: JSON.stringify(payload)
    }).then(response => {
        if (response.ok) {
        }
    }).catch(err => {
        console.warn(`[PULSE] Error de sincronización de fondo para ${area}:`, err);
    });
};

/**
 * Quita un área. Devuelve `true` si quedó realmente vacía, `false` si no.
 *
 * LO QUE SE PUBLICA, SE DESPUBLICA.
 *
 * Las tres de la demanda —pedidos (`buffer`), otras solicitudes (`solicitud`) y
 * replenishment (`tallas`)— se comparten desde el 12-ago-2026: se suben reducidas y
 * `getAreaData` las lee DEL SERVIDOR, salteándose el IndexedDB. Esta función se quedó
 * con la lista vieja de áreas "solo locales", así que el 🗑️ no borraba nada: limpiaba
 * la PC, el redibujado le volvía a pedir el área al servidor —que la tenía intacta—,
 * la bajaba y encima la reescribía en el IndexedDB. El archivo reaparecía en el mismo
 * clic, y ni REINICIAR MEMORIA lo sacaba.
 *
 * Se vacía el servidor CON `await` y antes de contestar: si el POST no llegó, el
 * redibujado la baja de vuelta y estaríamos en lo mismo. Por eso el `false` importa —
 * la pantalla tiene que poder decir que no se pudo en vez de fingir que sí.
 *
 * SIN `X-Environment` A MANO, igual que al publicar (ver persistToDatabase): en pruebas
 * la sella env.js y en producción no va cabecera. Fijarla acá escribía en producción
 * desde beta.
 *
 * Es un dato compartido: quitarlo lo quita para TODAS las PC. Mismo trato que al
 * cargarlo, que también pisa el de todas.
 */
export const clearAreaData = async (area, username = 'sistema') => {
    // `username` ya no se usa: lo pedia logSystemAction, que se borro por no guardar nada.
    // Se deja en la firma porque media docena de sitios lo pasan; sacarlo obliga a tocarlos todos.
    dataStore[area] = null;
    localStorage.removeItem('meta_' + area);

    let ok = true;

    if (DEMANDA_EN_LA_NUBE[area]) {
        try {
            const r = await fetch(`${API_URL}/${area}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([])
            });
            if (r.ok) {
                marcarVacio(area);
            } else {
                ok = false;
                console.warn(`[DEMANDA] ⚠️ No se pudo vaciar '${area}' en el servidor (${r.status}): va a volver a aparecer.`);
            }
        } catch (e) {
            ok = false;
            console.warn(`[DEMANDA] ⚠️ No se pudo vaciar '${area}' en el servidor:`, e && e.message);
        }
    }

    // [MOD LOCAL] Si es del módulo de Recepción o el Maestro de Artículos, procesar 100% de manera local
    if (area.startsWith('recepcion') || area === 'articulos' || area === 'validar_reserva' || area === 'validar_activo' || area === 'validar_lpn' || area.startsWith('buffer') || area === 'solicitud' || area === 'tallas' || area.startsWith('analisis_sku')) {
        await deleteFromDB(area);
        return ok;
    }

    try {
        await deleteFromDB(area);

        // Enviar array vacío al servidor para "limpiar" la persistencia remota
        await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify([])
        });
    } catch (e) {
        ok = false;
        console.warn(`[PULSE] No se pudo limpiar el servidor para '${area}', se limpió solo local.`, e);
    }
    return ok;
};

/**
 * TODAS LAS PANTALLAS MIRAN EL MISMO STOCK.
 *
 * Cada módulo nació con su propio archivo —la convención es `{modulo}_activo` y
 * `{modulo}_reserva`—, así que el mismo CSV de Oracle había que cargarlo a mano una vez por
 * pestaña. En la práctica se cargaba en una y las demás se quedaban con la foto vieja: el
 * 02-ago-2026 había áreas de hace CINCO y SEIS semanas conviviendo con la del día, dos PC
 * daban papeles distintos, y la reserva que usaba el cálculo llevaba un mes parada.
 *
 * Desde que el robot publica los stocks todas apuntan al mismo cajón. Los datos NO se
 * copian: se reparte la MISMA REFERENCIA, así que siguen ocupando memoria una sola vez.
 *
 * Es seguro porque el formato es idéntico en todas: el CSV lo parsea Papa.parse igual para
 * cualquier área, y todas las de reserva pasan por el mismo mapeo de columnas (ver parseFile,
 * la rama `area.endsWith('_reserva')`).
 *
 * Las de validación (validar_activo, validar_reserva, validar_lpn) NO entran: son archivos
 * de control que se cruzan CONTRA el stock, y hacerlas apuntar al mismo lado las volvería
 * inútiles —se compararía el stock consigo mismo—.
 */
export const AREA_CANONICA = {
    // Stock Activo — el que publica el robot a las 19:00
    'analisis_sku_activo': 'almacenaje_activo',
    'buffer_activo':       'almacenaje_activo',
    'inventario_activo':   'almacenaje_activo',
    'recepcion_activo':    'almacenaje_activo',
    'stockActivo':         'almacenaje_activo',
    'inventario':          'almacenaje_activo',
    // Stock Reserva
    'almacenaje_reserva':  'analisis_sku_reserva',
    'buffer_reserva':      'analisis_sku_reserva',
    'inventario_reserva':  'analisis_sku_reserva',
    'recepcion_reserva':   'analisis_sku_reserva',
    'stockReserva':        'analisis_sku_reserva',
};

/** ¿Esta área la publica el robot? Entonces no se sube a mano. */
export const esAreaDeLaNube = (area) =>
    area === 'almacenaje_activo' || area === 'analisis_sku_reserva' || !!AREA_CANONICA[area];

/**
 * Reparte la misma referencia a todos los nombres viejos. Hace falta porque hay pantallas
 * que leen `dataStore.buffer_activo` derecho, sin pasar por getAreaData.
 */
const repartirCanonica = (canonica, datos) => {
    Object.keys(AREA_CANONICA).forEach(a => {
        if (AREA_CANONICA[a] === canonica) dataStore[a] = datos;
    });
};

export const getAreaData = async (area, forceRefresh = false) => {
  // Un nombre viejo se resuelve por el nuevo y se guarda en los dos
  const canonica = AREA_CANONICA[area];
  if (canonica) {
      const datos = await getAreaData(canonica, forceRefresh);
      dataStore[area] = datos;
      return datos;
  }

  // Las dos que publica el robot SÍ se bajan del servidor, aunque el nombre empiece por
  // 'analisis_sku'. Esa lista es de cuando cada PC cargaba sus archivos a mano; dejar
  // 'analisis_sku_reserva' adentro la devolvía vacía en cualquier computadora que no la
  // hubiera cargado, y por eso la sugerencia tenía que pedirla por su cuenta con un fetch.
  const laPublicaElRobot = (area === 'almacenaje_activo' || area === 'analisis_sku_reserva');

  /* Y desde el 12-ago-2026 también las TRES DE LA DEMANDA —pedidos, otras solicitudes
     y replenishment—, por el mismo motivo: vivían solo en la PC que cargó el archivo,
     así que únicamente esa computadora podía correr el análisis del buffer. Ojo: es
     coincidencia exacta, no por prefijo. `buffer` sí; `buffer_activo` y
     `buffer_history` no, que son otra cosa y ya se resuelven más arriba. */
  const vieneDeLaNube = laPublicaElRobot || esAreaDeDemanda(area);

  if (!forceRefresh && dataStore[area] !== undefined && dataStore[area] !== null) return dataStore[area];

  // EN LAS DEL ROBOT MANDA EL SERVIDOR, no la copia de esta PC.
  //
  // El IndexedDB de una computadora puede tener la foto de hace semanas —o el formato de 33
  // columnas de antes del 02-ago— y no hay manera de saberlo sin preguntar. Preguntar sale
  // barato: el servidor las manda comprimidas y son unos 360 KB. Si no contesta, más abajo
  // se cae igual al respaldo local, así que sin internet se sigue trabajando.
  if (!forceRefresh && !vieneDeLaNube) {
      // [MOD V12.1.47] Prioridad a la DB Local (Instantáneo)
      const dbData = await loadFromDB(area);
      if (dbData) {
          dataStore[area] = dbData;
          repartirCanonica(area, dbData);
          return dbData;
      }
  }

  // [MOD LOCAL] Si es del módulo de Recepción o el Maestro de Artículos, no buscar en el servidor
  if (!vieneDeLaNube && (area.startsWith('recepcion') || area === 'articulos' || area === 'validar_reserva' || area === 'validar_activo' || area === 'validar_lpn' || area.startsWith('buffer') || area === 'solicitud' || area === 'tallas' || area.startsWith('analisis_sku'))) {
      if (area.endsWith('_activo') || area.endsWith('_reserva')) {
          updateTablaTallas();
      }
      return null;
  }

  /* UN VACÍO PUBLICADO ES UN DATO, NO UNA FALLA.
     Cuando alguien quita el archivo de pedidos, el servidor queda con una lista vacía
     sellada con la hora del borrado. Si eso se tratara como "el servidor no contestó",
     el respaldo de más abajo reviviría la copia de esta PC y el archivo volvería en la
     máquina de al lado. Se anota acá y se resuelve después del try. */
  let vacioPublicadoTs = 0;

  try {
     let queryURL = `${API_URL}/${area}`;
     if (currentDateFilter) queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
     const response = await fetch(queryURL, {
         headers: { 'X-Environment': 'production' }
     });
     if (response.ok) {
         const serverResponse = await response.json();

          /* Se mira ANTES de rechazar el formato viejo: ahí abajo el array se vacía a
             propósito, y eso no es el servidor diciendo que no hay nada. Y solo cuenta
             si trae `updated_at`: un área que NUNCA se publicó también llega vacía, y
             ésa no puede borrarle su archivo a la PC que sí lo cargó. */
          if (esAreaDeDemanda(area) && Array.isArray(serverResponse.data)
              && serverResponse.data.length === 0 && serverResponse.updated_at) {
              const f = fechaDelServidor(serverResponse.updated_at);
              vacioPublicadoTs = f ? f.getTime() : 0;
          }

          /* Lo que hay en el servidor para una de las tres de la demanda tiene que venir
             REDUCIDO. Si no, es de antes de que esto existiera —el archivo de pedidos
             entero del 23-jun sigue ahí— y usarlo sería darle al motor un archivo de hace
             dos meses y encima pisar con él la copia buena de esta PC. */
          if (esAreaDeDemanda(area) && Array.isArray(serverResponse.data) && serverResponse.data.length > 0
              && !DEMANDA_EN_LA_NUBE[area].valida(serverResponse.data[0])) {
              console.warn(`[DEMANDA] Lo que hay en el servidor para '${area}' no está reducido ` +
                           `(${serverResponse.data.length.toLocaleString('es-PE')} filas del formato viejo). ` +
                           `Se ignora y se usa la copia de esta PC.`);
              serverResponse.data = [];
          }

          if (serverResponse.data && Array.isArray(serverResponse.data) && serverResponse.data.length > 0) {
              dataStore[area] = serverResponse.data;
              olvidarVacio(area);
              repartirCanonica(area, serverResponse.data);
              await saveToDB(area, serverResponse.data); // Sincronizar cache local
              if (serverResponse.updated_at) {
                  // Ver fechaDelServidor: lo que manda el backend YA es hora de Lima, y
                  // marcarlo como UTC hacía que en pantalla se viera 5 horas antes.
                  const fecha = fechaDelServidor(serverResponse.updated_at);
                  const parsedTime = fecha ? fecha.getTime() : NaN;
                  const len = serverResponse.data.length;
                  localStorage.setItem('meta_' + area, JSON.stringify({
                      ts: isNaN(parsedTime) ? Date.now() : parsedTime,
                      timestamp: serverResponse.updated_at,
                      length: len
                  }));
              }
              return serverResponse.data;
          }
     }
  } catch (err) { console.warn(`Backend lento o vacío para '${area}'.`); }

  /* SI LO QUITARON, SE QUITA ACÁ TAMBIÉN.
     El vacío del servidor le gana a la copia local solo si es IGUAL O MÁS NUEVO que
     ella. Al revés —el archivo se cargó recién y la publicación no llegó— manda la PC,
     que es la que tiene el bueno. Se limpia el IndexedDB de paso: si no, esta misma
     comprobación habría que hacerla en cada pantalla que lea el área. */
  const tsLocal = (getUploadMeta(area) || {}).ts || 0;
  if (vacioPublicadoTs && vacioPublicadoTs >= tsLocal) {
      console.warn(`[DEMANDA] '${area}' está vacía en el servidor: se quitó también de esta PC.`);
      // Con la hora del SERVIDOR, no la de ahora: lo pudo haber quitado otra PC hace
      // dos horas y esta recien entera de enterarse.
      marcarVacio(area, vacioPublicadoTs);
      dataStore[area] = null;
      localStorage.removeItem('meta_' + area);
      await deleteFromDB(area);
      return null;
  }

  // El respaldo de las que vienen de la nube: se saltaron el IndexedDB para ir al servidor,
  // así que si el servidor no contestó hay que volver por él. Sin esto, quedarse sin internet
  // dejaría la pantalla vacía cuando en la PC había una copia perfectamente usable.
  //
  // Vale también para las TRES DE LA DEMANDA, y ahí es todavía más importante: la PC que
  // cargó el archivo tiene el bueno: si el servidor no contesta y no se cae acá, esa
  // computadora se quedaría sin poder correr el análisis con su propio archivo.
  if (vieneDeLaNube && !forceRefresh) {
      const respaldo = await loadFromDB(area);
      if (respaldo) {
          console.warn(`[PULSE] '${area}' no llegó del servidor: se usa la copia de esta PC.`);
          dataStore[area] = respaldo;
          repartirCanonica(area, respaldo);
          return respaldo;
      }
  }

  if (area.endsWith('_activo') || area.endsWith('_reserva')) {
      updateTablaTallas();
  }

  return null;
};

// =============================================
// MOTOR DE EXTRACCIÓN DE TALLAS (v12.3.6)
// =============================================
//
// LA TALLA SALE DE ACÁ Y DE NINGÚN OTRO LADO.
//
// Había tres maneras distintas de sacar la talla de un SKU conviviendo en la aplicación: esta
// —el patrón '-N-' de la descripción, que es el bueno—, el diccionario 'tabla_tallas', que se
// contaminó cuando el archivo de Replenishment se usó por error como diccionario y escribió
// cantidades en lugar de tallas, y una regla que le sumaba 36 al sufijo del SKU.
//
// Esa última inventaba tallas: 4816309-1-12 es una 37 según su descripción y la regla la daba
// como 48. Con eso la pantalla de factores le armaba a 02 WOMEN una fila de veinte tallas
// cuando en el almacén tiene seis, y las casillas que el usuario llenaba no cruzaban nunca
// con las que la reposición iba a buscar. El factor quedaba en cero y todo salía OK.
export const extractTalla = (desc) => {
    if (!desc) return null;
    const d = String(desc).trim();
    
    // Buscar guion, digito del 1 al 9, guion y talla al final (ej: -1-44, -9-44)
    const regexPatron = /-([1-9])-([A-Z0-9.\u00c1\u00c9\u00cd\u00d3\u00da\u00d1]+)$/i;
    const match = d.match(regexPatron);
    if (match) {
        return match[2].trim();
    }
    
    const parts = d.split('-');
    if (parts.length >= 3) {
        const preLast = parts[parts.length - 2].trim();
        if (preLast.length === 1 && preLast >= '1' && preLast <= '9') {
            return parts[parts.length - 1].trim();
        }
    }
    return null;
};

/**
 * LA TABLA DE TALLAS QUE PUBLICA EL ROBOT.
 *
 * El robot es el único que tiene los DOS stocks juntos. Medido sobre los datos del
 * 05-ago-2026: el activo da 17.554 SKU con talla y la reserva 9.428, pero **la reserva
 * aporta 4.609 que el activo no tiene**. Una PC que solo vio el activo nunca va a saber la
 * talla de esos: están arriba, en paletas, y no aparecen abajo hasta que se bajan.
 *
 * Es ACUMULATIVA: el robot solo agrega. Así una talla corregida a mano no se pisa, y un
 * artículo que se agotó conserva la suya para cuando vuelva.
 *
 * SI NO ESTÁ, NO PASA NADA. Se sigue leyendo del texto de la descripción, que es lo que se
 * hacía hasta ahora. La tabla acelera y completa, no es un requisito.
 */
let _tallasNube = null;
let _tallasPedidas = false;

export const cargarTablaTallasNube = async () => {
    if (_tallasNube || _tallasPedidas) return _tallasNube;
    _tallasPedidas = true;
    try {
        const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
        const res = await fetch(`${base}/api/logistics/tabla_tallas?t=${Date.now()}`);
        if (!res.ok) return null;
        const cuerpo = await res.json();
        const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
        if (Array.isArray(datos) && datos.length) {
            const m = {};
            datos.forEach(d => { if (d && d.SKU) m[String(d.SKU).trim()] = String(d.TALLA || '').trim(); });
            _tallasNube = m;
            console.log(`[Tallas] ${datos.length.toLocaleString('es-PE')} tallas del robot`);
        }
    } catch (e) {
        console.warn('[Tallas] no se pudo traer la tabla publicada:', e && e.message);
    }
    return _tallasNube;
};

/**
 * La talla de un SKU. Primero la tabla del robot; si no está, se lee de la descripción.
 * Devuelve null si no se puede saber — quien llama decide qué comodín usar.
 */
export const tallaDeSku = (sku, desc) => {
    const s = String(sku || '').trim();
    if (_tallasNube && s && _tallasNube[s]) return _tallasNube[s];
    return extractTalla(desc);
};

export const updateTablaTallas = () => {
    const mapa = dataStore.tabla_tallas || {};
    
    // Procesar todos los stocks activos y de reserva de todas las áreas para tener un maestro de tallas completo
    Object.keys(dataStore).forEach(area => {
        if (area.endsWith('_activo') && dataStore[area]) {
            dataStore[area].forEach(row => {
                const raw = Array.isArray(row) ? row : Object.values(row);
                const sku = getCol(row, ['Articulo', 'Artículo', 'Sku', 'PRODUCTO', 'SKU', 'CODIGO']) || String(raw[1] || '').trim();
                const desc = getCol(row, ['Descripcion de articulo', 'Descripción de artículo', 'Descripcin de artculo', 'DescripciÃ³n de artÃculo', 'Descripcion', 'Descripción', 'Description', 'DESCRIPCION']) || 
                             (Array.isArray(row) ? row[2] : Object.values(row)[2]);
                if (sku && desc) {
                    const talla = extractTalla(desc);
                    if (talla) mapa[sku] = talla;
                }
            });
        }
        if (area.endsWith('_reserva') && dataStore[area]) {
            dataStore[area].forEach(row => {
                const raw = Array.isArray(row) ? row : Object.values(row);
                const sku = getCol(row, ['PRODUCTO', 'SKU', 'Articulo', 'Artículo', 'Sku', 'CODIGO']) || row.PRODUCTO || String(raw[2] || '').trim();
                const desc = getCol(row, ['DESCRIPCION', 'Descripcion', 'Descripción', 'Description']) || row.DESCRIPCION || (Array.isArray(row) ? row[7] : Object.values(row)[7]);
                if (sku && desc) {
                    const talla = extractTalla(desc);
                    if (talla) mapa[sku] = talla;
                }
            });
        }
        // [ELIMINADO] El archivo 'tallas' (Replenishment) se usaba erróneamente como diccionario de tallas, 
        // lo que sobreescribía la talla real con la Cantidad (QTY) de la columna B. 
        // Ya no se procesará aquí para proteger la integridad de las tallas extraídas de las descripciones.
    });

    dataStore.tabla_tallas = mapa;
    saveToDB('tabla_tallas', mapa);
    
    // [MOD V17.4.4] PERSISTENCIA GLOBAL: Cualquier usuario que genere la tabla virtual la comparte
    const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
    if (Object.keys(mapa).length > 0) {
        const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
        fetch(`${API_URL}/tabla_tallas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify(Object.entries(mapa).map(([sku, talla]) => ({ sku, talla })))
        }).then(() => console.log("[PULSE] Tabla virtual sincronizada globalmente."))
          .catch(e => console.warn("[PULSE] Error sincronizando tabla virtual:", e));
    }
    
    console.log(`[PULSE] Tabla de tallas unificada actualizada. Total SKUs: ${Object.keys(mapa).length}`);
};

export const generateKPIs = (data, area) => {
  if(!data || !data.length) return null;
  const totalRecords = data.length;
  let completed = 0;
  let pending = 0;
  data.forEach(row => {
     let lowerStr = JSON.stringify(row).toLowerCase();
     if(lowerStr.includes('completado') || lowerStr.includes('disponible') || lowerStr.includes('enviado') || lowerStr.includes('ok')) completed++;
     else pending++;
  });
  return { totalRecords, completed, pending, successRate: Math.round((completed / totalRecords) * 100) || 0 };
};

export const fetchBufferConfig = async () => {
    try {
        const local = localStorage.getItem('logistics_buffer_config_local');
        if (local) {
            return JSON.parse(local);
        }
    } catch (e) { console.error("Error config buffer local:", e); }
    return { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1', include_merma: '1' };
};

export const saveBufferConfig = async (config) => {
    try {
        localStorage.setItem('logistics_buffer_config_local', JSON.stringify(config));
        return { status: 'success' };
    } catch (e) {
        console.error("Error al guardar la configuración de buffer local:", e);
    }
    return { status: 'error', message: 'Error al guardar la configuración local' };
};

/**
 * LAS ZONAS DE LA MERCADERÍA QUE SE PICA. Es la lista de siempre, sacada acá afuera
 * para que la use también el reporte del turno: hasta v29.0235 el análisis medía el
 * stock de un código SOLO en estas zonas y el avance de la separación lo medía en
 * TODAS las ubicaciones del almacén, así que se restaban dos cosas distintas y el
 * turno arrancaba con avance sin que nadie moviera nada. Ver `esZonaDeDestino`.
 */
export const ZONAS_ACTIVAS = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];

/** Si esa ubicación —o área— es una de las que se pican. */
export const esZonaActiva = (ubi) => {
    const u = String(ubi || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!u || u === 'MATE') return false;
    return ZONAS_ACTIVAS.some(w => u.includes(w));
};

/**
 * Si esa ubicación es DESTINO de la separación, o sea zona activa que NO es el buffer.
 *
 * Separar es sacar del buffer y llevarlo a su sitio, así que lo que sigue en el buffer
 * —o lo que ACABA DE LLEGAR a él— no está separado. La noche del 17-ago-2026 entraron
 * 208 unidades al `CDBUFFER-A` entre las 19:07 y las 20:35, casi todas del artículo
 * 8811350, y el reporte las contó como trabajo hecho.
 */
export const esZonaDeDestino = (ubi) => {
    const u = String(ubi || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return esZonaActiva(u) && !u.includes('CDBUFFER');
};

export const calculateBufferPallets = (configOverride = null) => {
    const activo = dataStore.buffer_activo;
    const reserva = dataStore.buffer_reserva;
    const pedidos = dataStore.buffer; 
    const solicitud = dataStore.solicitud; 
    const tallas = dataStore.tallas;     
    const articulos = dataStore.articulos;
    
    if(!activo || !reserva || !articulos) {
        console.error("[VALIDACIÓN] Faltan datos críticos para el cálculo.", { activo: !!activo, reserva: !!reserva, maestro: !!articulos });
        return null;
    }

    const articulosMap = new Map();
    // [ESTRICTO] Coordenadas fijas: B(1), C(2), K(10), J(9)
    articulos.forEach((row) => {
        const raw = Array.isArray(row) ? row : Object.values(row);
        
        const skuVal = String(raw[1] || '').trim();
        const sku7 = skuVal.substring(0, 7);
        
        if (sku7 && !articulosMap.has(sku7)) {
            articulosMap.set(sku7, {
                gGender: String(raw[2] || '').trim(),
                gender: String(raw[3] || 'OTROS').trim().toUpperCase(),
                temporada: String(raw[9] || 'S/T').trim(),
                tipoObsolencia: String(raw[10] || '').trim(),
                marca: String(raw[13] || 'OTROS').trim()
            });
        }
    });



    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1', include_merma: '1' };
    const getArticulo = (sku) => {
        if (!sku) return '';
        const trimmedSku = String(sku).trim();
        if (trimmedSku.length === 15) {
            return trimmedSku; // No le saques los 7 primeros
        }
        return trimmedSku.substring(0, 7);
    };

    // Mapeo de Stock según Jerarquías (Fase 11.9.1)
    let stBajas = {}, stAltos = {}, stPisos = {}, stAereos = {}, stLogicos = {}, stMerma = {};
    const registerStock = (map, sku, qty, row) => {
        if (!map[sku]) map[sku] = [];
        map[sku].push({ qty, row });
    };

    // 1. Mapeo de ACTIVO (COORDENADAS: Ãrea, ArtÃculo, Cantidad actual)
    const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
    const possibleAreaHeaders = ['Ãrea', 'Area', 'Área', 'Ārea'];
    const possibleSkuHeaders = ['ArtÃculo', 'Articulo', 'Artículo', 'Sku'];
    const possibleQtyHeaders = ['Cantidad actual', 'Cantidad', 'Cant.'];
    
    activo.forEach(f => {
        let areaRaw = getCol(f, possibleAreaHeaders);
        let area = String(areaRaw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        let sku = String(getCol(f, possibleSkuHeaders) || '').trim();
        let qty = parseFloat(getCol(f, possibleQtyHeaders)) || 0;
        if(!sku || qty <= 0) return;

        if (activeWhitelist.some(w => area.includes(w))) {
            registerStock(stBajas, sku, qty, f); 
        }
    });

    // 2. Mapeo de RESERVA (Ordenado de forma ascendente por UBICACION)
    const sortedReserva = [...reserva].sort((a, b) => {
        const ubiA = String(a['UBICACION'] || '').trim().toUpperCase();
        const ubiB = String(b['UBICACION'] || '').trim().toUpperCase();
        return ubiA.localeCompare(ubiB);
    });

    sortedReserva.forEach(f => {
        let nivel = String(f['NIVEL'] || '').trim().toUpperCase();
        let sku = String(f['PRODUCTO'] || '').trim();
        let qty = parseFloat(f['CANTIDAD']) || 0;
        let nroAnd = String(f['NRO AND'] || f['AND'] || '').trim().toUpperCase();
        if(!sku || qty <= 0) return;

        if (nivel === 'ALTO' || nivel.includes('ALTO') || nivel === 'A') registerStock(stAltos, sku, qty, f);
        else if (nivel === 'CROSS') registerStock(stPisos, sku, qty, f);
        else if (nivel === 'AEREO') registerStock(stAereos, sku, qty, f);
        else if (nivel === 'PISO' || nivel === 'DIS') registerStock(stLogicos, sku, qty, f);
        else if (nivel === 'VER') {
            if (nroAnd === 'MZM-TR') registerStock(stLogicos, sku, qty, f);
            else registerStock(stMerma, sku, qty, f);
        }
    });

    // [MOD V12.1.46] NUEVA LÓGICA DE CONSOLIDACIÓN POR PRIORIDAD
    // 1. Recolectar datos crudos de todas las fuentes
    const rawDemand = {
        'PEDIDOS': [],
        'OTRAS SOLICITUDES': [],
        'REPLENISHMENT': []
    };

    if (pedidos && pedidos.length) {
        pedidos.forEach(f => {
            let sku = String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo', 'Artículo', 'Cod. Articulo', 'CodArticulo', 'Producto']) || '').trim();
            let cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada', 'Cant. Solicitada', 'Cantidad', 'Cant'])) || 0;
            let asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada', 'Cant. Asignada', 'Asignado'])) || 0;
            let diff = cant - asig;
            if (diff > 0 && sku) rawDemand['PEDIDOS'].push({ sku, qty: diff });
        });
    }

    if (solicitud && solicitud.length) {
        solicitud.forEach(row => {
            const raw = Object.values(row);
            const sku = String(raw[0] || '').trim();
            const qty = parseFloat(raw[1]) || 0;
            if (sku && qty > 0) rawDemand['OTRAS SOLICITUDES'].push({ sku, qty });
        });
    }

    if (tallas && tallas.length) {
        tallas.forEach(row => {
            const raw = Object.values(row);
            const sku = String(raw[0] || '').trim();
            const qty = parseFloat(raw[1]) || 0;
            if (sku && qty > 0) rawDemand['REPLENISHMENT'].push({ sku, qty });
        });
    }

    // 2. Consolidar: Sumar todo y asignar a la MEJOR fuente. Si hay Pedidos/Otras, se IGNORA Replenishment.
    let tempMap = {}; // sku -> { total: 0, bestSrc: null, isReplenishmentOnly: false }
    
    // Primero procesamos PEDIDOS y OTRAS SOLICITUDES
    ['PEDIDOS', 'OTRAS SOLICITUDES'].forEach(src => {
        rawDemand[src].forEach(item => {
            if (!tempMap[item.sku]) {
                tempMap[item.sku] = { total: 0, bestSrc: src, isReplenishmentOnly: false };
            }
            tempMap[item.sku].total += item.qty;
        });
    });

    // Luego procesamos REPLENISHMENT
    rawDemand['REPLENISHMENT'].forEach(item => {
        if (!tempMap[item.sku]) {
            // Solo entra si NO hubo pedidos u otras solicitudes
            tempMap[item.sku] = { total: item.qty, bestSrc: 'REPLENISHMENT', isReplenishmentOnly: true };
        }
        // Si ya existía (tiene pedidos/otras), lo ignoramos por completo
    });

    // [NUEVO] Cargar y parsear configuración de buffer extra por Marca y Género
    let savedQtys = {};
    if (config && config.brand_gender_qtys) {
        try {
            savedQtys = JSON.parse(config.brand_gender_qtys) || {};
        } catch (e) {
            console.warn("[PULSE] Error parsing config.brand_gender_qtys inside engine:", e);
        }
    }

    // Helper para obtener el buffer extra de un SKU usando la configuracion de analisis SKU (Genero y Talla + Excepciones SKU)
    // ══════════════════════════════════════════════════════════════════════════════
    // EL OBJETIVO DE PISO DE UN SKU, igual que lo resuelve Replenishment.
    //
    // Antes esto no cruzaba con lo que se cargaba en la pantalla de factores, por dos
    // motivos, y en los dos casos el resultado era un cero silencioso:
    //
    //   LA TALLA. Salía del diccionario 'tabla_tallas' —que se contaminó cuando el
    //   archivo de Replenishment se usó por error como diccionario y escribió
    //   cantidades— y si no estaba ahí, del SUFIJO CRUDO del SKU. El sufijo no es la
    //   talla: 8811610-1-07 es una talla 43 y esto armaba la clave con '07'. Ahora sale
    //   de la descripción con extractTalla(), la misma que usa todo lo demás.
    //
    //   LA MARCA. No existía. Dentro de un mismo Gender RIMS conviven Bata, North Star y
    //   Power, que no se reponen igual, y desde v29.0042 el objetivo se carga por marca.
    //
    // Además se leía el localStorage COMPLETO —dos JSON.parse— en cada SKU, y esto se
    // llama miles de veces por corrida. Ahora se lee una sola vez, arriba.
    // ══════════════════════════════════════════════════════════════════════════════
    let _cfgTallasGenero = {}, _cfgSKUExcepciones = {}, _cfgMarcaGenero = {};
    /* EL COMBO DEL FACTOR manda sobre la tabla de marca+genero+talla:
     *   'sin'  el factor es CERO para todos: solo se baja lo que el pedido pide
     *   'd1'   la tabla medida para un dia de picking
     *   'd2'   la de dos dias
     * Sin combo -o con 'config'- se usa lo que Daniel tenga configurado a mano, que es como
     * funcionaba antes de que esto existiera. */
    const _modoFactor = String(config.factorModo || 'config');
    const _tablasCalc = factoresCalculadosEnMemoria();
    try {
        const g = localStorage.getItem('logistics_v24_prod_configTallasGenero');
        if (g) _cfgTallasGenero = JSON.parse(g) || {};
        const s = localStorage.getItem('logistics_v24_prod_configSKUExcepciones');
        if (s) _cfgSKUExcepciones = JSON.parse(s) || {};
        const m = localStorage.getItem('logistics_v24_prod_configMarcaGenero');
        if (m) _cfgMarcaGenero = JSON.parse(m) || {};
    } catch(e) {
        console.warn("[PULSE] Error al leer configuraciones de Analisis SKU:", e);
    }
    if (_modoFactor === 'sin') {
        /* Cero de verdad: se vacian las tres tablas para que `getExtraBuffer` devuelva 0 sea
           cual sea el camino -excepcion por SKU, marca+genero+talla o genero+talla-. */
        _cfgTallasGenero = {}; _cfgSKUExcepciones = {}; _cfgMarcaGenero = {};
    } else if (_modoFactor === 'd1' || _modoFactor === 'd2') {
        const t = _tablasCalc && _tablasCalc[_modoFactor === 'd1' ? 'dia1' : 'dia2'];
        if (t) { _cfgMarcaGenero = t; _cfgTallasGenero = {}; _cfgSKUExcepciones = {}; }
        else console.warn('[FACTORES] No hay tabla calculada para', _modoFactor,
            '- se usa la configuracion de esta PC.');
    }

    /** SKU -> talla real, sacada de la descripción del activo y de la reserva. */
    const _tallaReal = new Map();
    activo.forEach(f => {
        const raw = Array.isArray(f) ? f : Object.values(f);
        const sku = String(getCol(f, ['Artículo','Articulo','ArtÃculo','Sku','SKU','CODIGO']) || raw[1] || '').trim();
        if (!sku || _tallaReal.has(sku)) return;
        const t = extractTalla(getCol(f, ['Descripcion de articulo','Descripción de artículo','Descripcion','Descripción','DESCRIPCION','Description']) || raw[2]);
        if (t) _tallaReal.set(sku, t);
    });
    reserva.forEach(f => {
        const sku = String(f['PRODUCTO'] || getCol(f, ['PRODUCTO','SKU','CODIGO']) || '').trim();
        if (!sku || _tallaReal.has(sku)) return;
        const t = extractTalla(f['DESCRIPCION'] || getCol(f, ['DESCRIPCION','Descripcion','Descripción','Description']));
        if (t) _tallaReal.set(sku, t);
    });

    const _claveMGT = (marca, genero, talla) =>
        `${String(marca || '').trim().toUpperCase()}|${String(genero || '').trim().toUpperCase()}|${String(talla || '').trim()}`;

    const getExtraBuffer = (sku) => {
        if (!sku) return 0;
        const trimmedSku = sku.trim();
        // Un prepack ya viene armado con su curva: no lleva objetivo por talla.
        if (trimmedSku.length === 15) return 0;

        // 1. La excepción de ese SKU exacto
        if (_cfgSKUExcepciones[trimmedSku] !== undefined) {
            return parseInt(_cfgSKUExcepciones[trimmedSku]) || 0;
        }

        const info = articulosMap.get(trimmedSku.substring(0, 7));
        if (!info) return 0;

        const g = String(info.gender || 'OTROS').trim().toUpperCase();
        const talla = _tallaReal.get(trimmedSku);
        if (!talla) return 0;   // sin talla no hay objetivo que buscar

        // 2. Su marca + género + talla
        const porMarca = _cfgMarcaGenero[_claveMGT(info.marca, g, talla)];
        if (porMarca !== undefined) return parseInt(porMarca) || 0;

        // 3. Su género + talla, que es como se cargaba antes de que existieran las marcas
        return parseInt(_cfgTallasGenero[`${g}_${talla}`]) || 0;
    };

    // Colectar todos los SKUs físicamente presentes en activo o reserva
    const allKnownSkus = new Set();
    const activeSkuHeaders = ['ArtÃculo', 'Articulo', 'Artículo', 'Sku'];
    activo.forEach(f => {
        let sku = String(getCol(f, activeSkuHeaders) || '').trim();
        if (sku) allKnownSkus.add(sku);
    });
    reserva.forEach(f => {
        let sku = String(f['PRODUCTO'] || '').trim();
        if (sku) allKnownSkus.add(sku);
    });

    // El factor de Configuración Análisis SKU se aplica dentro de la cascada como: pending = brecha + factor
    // donde brecha = (RQ pedidos - Bajas). Garantiza que ATD nunca supere el RQ efectivo.

    let demanda = {};
    Object.keys(tempMap).forEach(sku => {
        const item = tempMap[sku];
        demanda[sku] = {
            total: item.total,
            isReplenishmentOnly: item.isReplenishmentOnly,
            sources: [{ src: item.bestSrc, qty: item.total }]
        };
    });

    let detalleZonas = [], stockUsadoMap = new Map(), ubicacionesEnElPiso = new Set(), cuotasPicking = {};
    let detalleRQRevisar = [];
    let globalRQ = 0, totalsByNivel = {};
    let sinStockPorRevisar = [];

    /* ══════════════════════════════════════════════════════════════════════════════
     * MODELO 1 — EL ORDEN: DE LA PALETA MAS VACIA A LA MAS LLENA
     * ══════════════════════════════════════════════════════════════════════════════
     *
     * Hasta el 25-ago-2026 se recorrian en el orden en que venian del WMS —ordenado por
     * UBICACION, del SEL-01 al SEL-12—, asi que una paleta con 20 pares en el SEL-11 se
     * quedaba intacta mientras se abria una llena en el SEL-01. Esos restos envejecen arriba
     * ocupando una ubicacion entera.
     *
     * Daniel, 25-ago-2026: *"que vaya buscando la paleta que tenga menos cantidad, y asi va
     * buscando, y al ultimo recien rompa una paleta nueva"*.
     *
     * EL DESEMPATE POR UBICACION NO ES UN ADORNO. Con dos paletas de la misma cantidad, sin
     * el desempate manda el orden del archivo del WMS — y ese orden cambia solo entre una
     * exportacion y otra. Es la misma trampa que movio el avance de la consolidacion de 40 a
     * 39 sin que nadie tocara una paleta. */
    const ordenarPorMenor = (mapa) => {
        Object.keys(mapa).forEach(sku => {
            mapa[sku].sort((a, b) => (a.qty - b.qty)
                || String(getCol(a.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '')
                     .localeCompare(String(getCol(b.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '')));
        });
    };
    /* MODELO 3 — el pasadizo que ya tiene trabajo, y dentro la paleta mas grande. */
    const modelo3 = config.modelo3 === true || config.modelo3 === 1
        || String(config.modelo3) === 'true' || String(config.modelo3) === '1';
    /* Los selectivos comparten pasadizo de a dos: 01+02 es el 1, 03+04 el 2, y asi. */
    const pasilloDe = (ubi) => {
        const m = /^SEL-(\d+)/i.exec(String(ubi || '').trim());
        return m ? Math.ceil(parseInt(m[1], 10) / 2) : 0;
    };
    const cargaPasillo = new Map();     // pasadizo -> paletas ya asignadas ahi
    const ubisTocadas = new Set();

    const satisfyDemand = (sku, pending, stockMap, nivelLabel) => {
        if (!stockMap[sku] || pending <= 0) return pending;
        /* Con el modelo 3 el orden se calcula EN EL MOMENTO: depende de cuanto trabajo
           lleva cada pasadizo, y eso cambia con cada SKU. Sin el, se respeta el orden que
           ya trae el mapa -el del WMS, o el del modelo 1 si esta prendido-. */
        const lista = modelo3
            ? stockMap[sku].slice().sort((a, b) => {
                  const ua = String(getCol(a.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '');
                  const ub = String(getCol(b.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '');
                  return (cargaPasillo.get(pasilloDe(ub)) || 0) - (cargaPasillo.get(pasilloDe(ua)) || 0)
                      || (b.qty - a.qty) || ua.localeCompare(ub);
              })
            : stockMap[sku];
        for (let item of lista) {
            if (pending <= 0) break;
            let id = item.row._id || `${getCol(item.row, ['LPN']) || ''}_${sku}_${getCol(item.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || ''}`;
            let uses = stockUsadoMap.get(id) || 0;
            let avail = item.qty - uses;
            if (avail > 0) {
                let pick = Math.min(pending, avail);
                let ubi = String(getCol(item.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || 'S/U').trim();
                
                detalleZonas.push({
                    'NIVEL/AREA': nivelLabel,
                    'UBICACION': ubi,
                    'ARTÍCULO': getArticulo(sku),
                    'SKU': sku,
                    'ATD RQ': pick
                });

                // RELLENAR DATOS PARA REPORTE SKU (Zonas que impactan paletas/buffer)
                if (ubi.toUpperCase().startsWith('SEL-')) {
                    /* La primera vez que se toca una ubicacion, su pasadizo suma uno: es lo
                       que hace que el modelo 3 vuelva a ese pasadizo con el siguiente SKU. */
                    if (!ubisTocadas.has(ubi)) {
                        ubisTocadas.add(ubi);
                        const P = pasilloDe(ubi);
                        if (P) cargaPasillo.set(P, (cargaPasillo.get(P) || 0) + 1);
                    }
                    ubicacionesEnElPiso.add(ubi);
                    if (!cuotasPicking[ubi]) cuotasPicking[ubi] = {};
                    cuotasPicking[ubi][sku] = (cuotasPicking[ubi][sku] || 0) + pick;
                }

                stockUsadoMap.set(id, uses + pick);
                if (!totalsByNivel[nivelLabel]) totalsByNivel[nivelLabel] = 0;
                totalsByNivel[nivelLabel] += pick;
                pending -= pick;
            }
        }
        return pending;
    };

    // 0. Mapa global de Activo para descuento rápido
    const totalActivoPorSKU = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return;

        let sku = String(rawF[1] || '').trim(); // SKU en B(1)
        let qty = parseFloat(rawF[4]) || 0;     // Cantidad en E(4)
        if (!sku || qty <= 0) return;

        // Para la cascada de Zona Buffer seguimos distinguiendo por zonas conocidas
        const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
        const isLevel1 = activeWhitelist.some(w => area.includes(w));

        if (isLevel1) {
            totalActivoPorSKU[sku] = (totalActivoPorSKU[sku] || 0) + qty;
        } else {
            // Todo lo demás que no es MATE pero tampoco es Picking, va a Lógico por defecto
            registerStock(stLogicos, sku, qty, f);
        }
    });

    const getArtInfo = (sku) => {
        if (!sku) return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        const trimmedSku = sku.trim();
        if (trimmedSku.length === 15) {
            return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        }
        const sku7 = trimmedSku.substring(0, 7);
        const info = articulosMap.get(sku7);
        if (!info) return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        
        let m = info.marca;
        if (m.toUpperCase().includes('BUBBLEGUMMERS LICENSES')) m = 'BG Licenses';
        else if (m.toUpperCase().includes('BUBBLEGUMMERS')) m = 'BG';
        else if (m.toUpperCase().includes('BATA INDUSTRIALS')) m = 'Industrials';
        else if (m.toUpperCase().includes('11 NON COMMERCIAL COMPLEMENTS')) m = '11 COMPLEMENTS';

        return { gender: info.gender, marca: m };
    };

    const nivelesMap = {
        'Bajas': '1. BAJAS',
        'Alto': '2. ALTO',
        'Piso': '3. PISO',
        'Aereo': '4. AÉREO',
        'Logico': '5. LÓGICO',
        'Merma': '6. MERMA'
    };

    // PROCESAMIENTO DE ANÁLISIS (JERARQUÍA 1 A 7)
    /* SE ORDENA ACA Y NO ANTES: mas arriba todavia se registra stock en `stLogicos`
       -lo que no es MATE ni picking-, y ordenar antes dejaba ese nivel a medio ordenar.
       Ordenar es barato y pasa una sola vez por corrida. */
    /* MODELO 1 — Daniel, 25-ago-2026. Sin el check se recorren en el orden del WMS
       -ascendente por ubicacion, del SEL-01 al SEL-12-, que es como fue siempre. */
    const modelo1 = config.modelo1 === true || config.modelo1 === 1
        || String(config.modelo1) === 'true' || String(config.modelo1) === '1';
    if (modelo1) [stAltos, stPisos, stAereos, stLogicos, stMerma].forEach(ordenarPorMenor);

    Object.keys(demanda).sort().forEach(sku => {
        let totalSolicitado = demanda[sku].total;

        // 1. Calculamos la Necesidad Total y el Factor
        let enActivo = totalActivoPorSKU[sku] || 0;
        
        // Calculamos stock real total en reserva
        let stockReservaReal = 0;
        if (stAltos[sku]) stAltos[sku].forEach(p => stockReservaReal += p.qty);
        if (stPisos[sku]) stPisos[sku].forEach(p => stockReservaReal += p.qty);
        if (stAereos[sku]) stAereos[sku].forEach(p => stockReservaReal += p.qty);
        
        let necesidadTotal = 0;
        let factorConfig = 0;
        let factorVirtual = 0;

        if (demanda[sku].isReplenishmentOnly) {
            // Si viene SOLO por Replenishment, NO se suma el factor (Factor = 0)
            necesidadTotal = totalSolicitado;
        } else {
            // Si viene por Pedidos / Otras Solicitudes, SÍ se suma el factor
            factorConfig = getExtraBuffer(sku);
            
            // Lógica de colchón: proyectar el stock después de atender los pedidos
            let stockProyectado = Math.max(0, enActivo - totalSolicitado);
            let factorFaltante = Math.max(0, factorConfig - stockProyectado);

            // EL COLCHÓN SE SIRVE DE LO QUE SOBRA, NO DE TODA LA RESERVA.
            //
            // Lo que el pedido no encuentra en el piso también sale de arriba, así que esos
            // pares ya están comprometidos. Topeando el colchón contra la reserva ENTERA, los
            // dos reservaban los mismos pares y se pedía de más: con un pedido de 100, 50
            // abajo y 70 arriba, se pedían 170 cuando en todo el almacén hay 120. Bajaban los
            // 70 que había —eso siempre estuvo bien— pero los otros 50 se reportaban como
            // SIN STOCK, y no faltaban: estaban contados dos veces.
            const reservaParaElPedido = Math.max(0, totalSolicitado - enActivo);
            const reservaLibre = Math.max(0, stockReservaReal - reservaParaElPedido);

            factorVirtual = Math.min(factorFaltante, reservaLibre);
            necesidadTotal = totalSolicitado + factorVirtual;
        }
        
        // El globalRQ es la necesidad total (lo que la tienda requiere en total para pedidos y cobertura)
        globalRQ += necesidadTotal;
        
        let pending = necesidadTotal;

        // Extraemos para Bajas SOLO lo que pide el Pedido (RQ)
        let atdActivo = Math.min(totalSolicitado, enActivo);
        if (!totalsByNivel[nivelesMap['Bajas']]) totalsByNivel[nivelesMap['Bajas']] = 0;
        totalsByNivel[nivelesMap['Bajas']] += atdActivo;
        
        if (atdActivo > 0) {
            detalleZonas.push({
                'NIVEL/AREA': nivelesMap['Bajas'],
                'UBICACION': 'ZONA PICKING',
                'ARTÍCULO': getArticulo(sku),
                'SKU': sku,
                'ATD RQ': atdActivo
            });
        }

        pending -= atdActivo;

        let tallaStr = '-';
        const tallasMap = dataStore.tabla_tallas || {};
        tallaStr = tallasMap[sku] || '-';
        if (tallaStr === '-') {
            const segments = sku.split('-');
            if (segments.length >= 3) {
                tallaStr = segments[segments.length - 1].trim();
            }
        }

        detalleRQRevisar.push({
            'SKU': sku,
            'Talla': tallaStr,
            'Cantidad RQ': totalSolicitado,
            'Stock Activo': enActivo,
            'Stock Reserva': stockReservaReal,
            'Factor Config': factorConfig,
            'Factor Virtual Aplicado': factorVirtual,
            'Necesidad Total': necesidadTotal
        });

        // 2. Satisfacemos el resto siguiendo las jerarquías permitidas
        const isConfigEnabled = (val) => {
            if (val === undefined || val === null) return true; // Default to enabled if not set
            return val === true || val === 1 || String(val) === '1' || String(val).toLowerCase() === 'true';
        };

        if (pending > 0 && isConfigEnabled(config.include_reserva)) {
            if (isConfigEnabled(config.include_alto)) pending = satisfyDemand(sku, pending, stAltos, nivelesMap['Alto']);
            if (pending > 0 && isConfigEnabled(config.include_piso)) pending = satisfyDemand(sku, pending, stPisos, nivelesMap['Piso']);
            if (pending > 0 && isConfigEnabled(config.include_aereo)) pending = satisfyDemand(sku, pending, stAereos, nivelesMap['Aereo']);
            if (pending > 0 && isConfigEnabled(config.include_logico)) pending = satisfyDemand(sku, pending, stLogicos, nivelesMap['Logico']);
            if (pending > 0 && isConfigEnabled(config.include_merma)) pending = satisfyDemand(sku, pending, stMerma, nivelesMap['Merma']);
        }
        
        // 3. Si aún queda pendiente, es "Sin Stock"
        if (pending > 0) {
            detalleZonas.push({
                'NIVEL/AREA': '7. SIN STOCK',
                'UBICACION': 'S/S',
                'ARTÍCULO': getArticulo(sku),
                'SKU': sku,
                'ATD RQ': pending
            });
        }
        
        // --- CÁLCULO DEL "FANTASMA" SIN STOCK PARA LA NUEVA PESTAÑA ---
        let initialPending = Math.max(0, necesidadTotal - enActivo);
        let atdReserva = initialPending - pending; // Lo que sacó de la cascada
        let totalAtdS = atdActivo + atdReserva;
        let uiSinStockForSKU = necesidadTotal - totalAtdS;

        if (uiSinStockForSKU > 0) {
            sinStockPorRevisar.push({
                'SKU': sku,
                'Cantidad RQ': totalSolicitado,
                'Stock Activo': enActivo,
                'Stock Reserva': stockReservaReal,
                'Factor Config': factorConfig,
                'Factor Virtual Aplicado': factorVirtual,
                'Necesidad Total': necesidadTotal,
                'ATD Bajas': atdActivo,
                'ATD Reserva': atdReserva,
                'Total ATD': totalAtdS,
                'Sin Stock (Grafico UI)': uiSinStockForSKU
            });
        }
    });

    /* ══════════════════════════════════════════════════════════════════════════════
     * EL BARRIDO DE SALDOS  —  solo si Daniel prendio el check
     * ══════════════════════════════════════════════════════════════════════════════
     *
     * La paleta que ya baja por el pedido y volveria arriba con MUY POCO se baja entera:
     * ese resto se queda meses ocupando una ubicacion completa. Se corre DESPUES de servir
     * todo el pedido, asi que no le quita ni un par a nadie ni cambia el sin stock.
     *
     * SOLO PALETAS QUE YA IBAN A BAJAR. Nunca abre una ubicacion nueva: si el pedido no la
     * toco, el barrido tampoco. El montacarguista hace el mismo viaje.
     *
     * Va apagado por defecto —ver el comentario del check en la pantalla—. */
    /* Se pregunta a mano y no con `isConfigEnabled`: esa vive DENTRO del bucle por SKU y
       acá no alcanza. Y ojo con el default: `isConfigEnabled` da true cuando el valor no
       existe, y el barrido tiene que nacer APAGADO. */
    /* Lo que se lleva el barrido NO es demanda atendida: se cuenta aparte para poder
       descontarlo del cuadro de niveles, que si no deja de cuadrar. */
    let paresBarridoTotal = 0;
    const barridoPorUbiSku = new Map();   // ubi|sku -> pares que puso el barrido
    /* MODELO 2. Se sigue leyendo `barrido` por si quedo guardado con el nombre viejo. */
    const _m2 = (config.modelo2 !== undefined) ? config.modelo2 : config.barrido;
    const barridoOn = _m2 === true || _m2 === 1
        || String(_m2) === 'true' || String(_m2) === '1';
    if (barridoOn) {
        const CORTE = Number(config.modelo2Corte || config.barridoCorte) > 0
            ? Number(config.modelo2Corte || config.barridoCorte) : 40;
        /* Cuanto queda EN CADA UBICACION despues de servir el pedido, sku por sku. */
        const restoPorUbi = new Map();      // ubi -> [{sku, resto, row}]
        Object.keys(stAltos).forEach(sku => {
            stAltos[sku].forEach(item => {
                const ubi = String(getCol(item.row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '').trim();
                if (!ubi.toUpperCase().startsWith('SEL-')) return;
                if (!cuotasPicking[ubi]) return;          // esta paleta no bajaba: no se toca
                const id = item.row._id || `${getCol(item.row, ['LPN']) || ''}_${sku}_${ubi}`;
                const resto = item.qty - (stockUsadoMap.get(id) || 0);
                if (resto <= 0) return;
                if (!restoPorUbi.has(ubi)) restoPorUbi.set(ubi, []);
                restoPorUbi.get(ubi).push({ sku, resto, id });
            });
        });
        let ubisBarridas = 0, paresBarridos = 0;
        restoPorUbi.forEach((lineas, ubi) => {
            const queda = lineas.reduce((a, b) => a + b.resto, 0);
            if (queda <= 0 || queda > CORTE) return;      // vuelve con mucho: se deja subir
            ubisBarridas++;
            lineas.forEach(l => {
                paresBarridos += l.resto;
                detalleZonas.push({
                    'NIVEL/AREA': nivelesMap['Alto'],
                    'UBICACION': ubi,
                    'ARTÍCULO': getArticulo(l.sku),
                    'SKU': l.sku,
                    'ATD RQ': l.resto,
                    'BARRIDO': 'SI'
                });
                cuotasPicking[ubi][l.sku] = (cuotasPicking[ubi][l.sku] || 0) + l.resto;
                barridoPorUbiSku.set(ubi + '|' + l.sku,
                    (barridoPorUbiSku.get(ubi + '|' + l.sku) || 0) + l.resto);
                stockUsadoMap.set(l.id, (stockUsadoMap.get(l.id) || 0) + l.resto);
            });
        });
        paresBarridoTotal = paresBarridos;
        console.log(`[BARRIDO] corte ${CORTE}: ${ubisBarridas} ubicaciones se vacian, `
            + `${Math.round(paresBarridos)} pares de mas al piso.`);
    }


    const calcPct = (a, r) => r > 0 ? ((a / r) * 100).toFixed(1) + '%' : '0%';

    let runningRQ = globalRQ;
    let waterfall = Object.keys(nivelesMap).map(k => {
        const val = totalsByNivel[nivelesMap[k]] || 0;
        const currentRQ = runningRQ;
        runningRQ = Math.max(0, runningRQ - val);
        return {
            nivel: nivelesMap[k],
            rq: currentRQ,
            atd: val,
            pct: calcPct(val, globalRQ)
        };
    });

    // 7. SIN STOCK
    waterfall.push({
        nivel: '7. SIN STOCK',
        rq: runningRQ,
        atd: runningRQ,
        pct: calcPct(runningRQ, globalRQ)
    });

    waterfall.push({ nivel: 'Total', rq: globalRQ, atd: globalRQ, pct: '100.0%' });
    // (Para saber cuántos palets y SKUs corresponden a cada fuente)
    const empaqueAggr = {}; // { source: { type: { pal: Set, sku: Set, units: 0 } } }
    const sources = ['PEDIDOS', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
    sources.forEach(s => {
        empaqueAggr[s] = {
            'SolidPack': { pal: new Set(), sku: new Set(), units: 0 },
            'PreePack': { pal: new Set(), sku: new Set(), units: 0 }
        };
    });

    // Mapa de Stock Activo para columna QTY ACTIVO (Solo zonas de Picking autorizadas)
    /* Y al lado el mismo mapa SIN EL BUFFER, que es la línea de base con la que el
       reporte del turno mide la separación: lo que está en el buffer todavía hay que
       sacarlo. Se llenan en la misma pasada para que nunca queden de fotos distintas. */
    const activeStockMap = {};
    const destinoStockMap = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return; // EXCLUIR MATE SEGÚN INDICACIÓN

        const isLevel1 = activeWhitelist.some(w => area.includes(w));
        if (!isLevel1) return; // Omitir si no pertenece a zona de picking activa

        let sku = String(rawF[1] || '').trim(); // SKU en Columna B (índice 1)
        let qty = parseFloat(rawF[4]) || 0;     // Cantidad en Columna E (índice 4)
        if (!sku) return;
        activeStockMap[sku] = (activeStockMap[sku] || 0) + qty;
        if (!area.includes('CDBUFFER')) destinoStockMap[sku] = (destinoStockMap[sku] || 0) + qty;
    });

    let detallePallets = [];
    Array.from(ubicacionesEnElPiso).forEach(ubi => {
        let items = reserva.filter(f => String(f['UBICACION']).trim() === ubi);
        
        let remainingPicks = {};
        if (cuotasPicking[ubi]) {
            Object.keys(cuotasPicking[ubi]).forEach(k => remainingPicks[k] = cuotasPicking[ubi][k]);
        }

        items.forEach(item => {
            let sku = String(getCol(item, ['PRODUCTO', 'Articulo', 'Producto']) || '').trim();
            let qty = parseFloat(item['CANTIDAD'] || 0);
            
            let pickTotal = remainingPicks[sku] || 0;
            if (pickTotal > 0) {
                let actualPick = Math.min(pickTotal, qty);
                remainingPicks[sku] -= actualPick;

                const demandObj = demanda[sku];
                const tipo = sku.length >= 14 ? 'PreePack' : 'SolidPack';
                
                if (demandObj) {
                    demandObj.sources.forEach(dSrc => {
                        const proportion = dSrc.qty / demandObj.total;
                        const attributedUnits = actualPick * proportion;
                        
                        if (attributedUnits > 0) {
                            detallePallets.push({ 
                                'FUENTE': dSrc.src,
                                'UBICACIONES': ubi, 
                                'LPN': item['LPN'], 
                                'SKU': sku, 
                                'Articulo': sku.trim().length === 15 ? sku.trim() : sku.substring(0,7),
                                'DESCRIPCION': String(item['DESCRIPCION'] || '').trim(),
                                'RQ': dSrc.qty,
                                'QTY ACTIVO': activeStockMap[sku] || 0,
                                'QTY DESTINO': destinoStockMap[sku] || 0,
                                'QTY RESERVA': qty,
                                'QTY BUFFER': Math.round(attributedUnits),
                                'QTY EXTRA': 0,
                                'NIVEL': String(item['NIVEL'] || '').trim().toUpperCase(),
                                'ES_ALTO': item['ES_ALTO'] !== false
                            });
                            
                            empaqueAggr[dSrc.src][tipo].pal.add(ubi);
                            empaqueAggr[dSrc.src][tipo].sku.add(sku);
                            empaqueAggr[dSrc.src][tipo].units += attributedUnits;
                        }
                    });
                }
            }
        });
    });

    // [MOD V12.1.18] CONSOLIDACIÓN: Evitar duplicados por SKU/LPN/Ubicación en el Excel (Multi-fuente)
    const consolidatedMap = new Map();
    detallePallets.forEach(d => {
        const key = `${d.UBICACIONES}|${d.LPN}|${d.SKU}`;
        if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, { ...d });
        } else {
            consolidatedMap.get(key)['QTY BUFFER'] += d['QTY BUFFER'];
        }
    });
    // Factor de Configuración Análisis ya incorporado en la cascada (brecha + factor).
    // QTY BUFFER ya es correcto — no se aplica ningún extra post-cascada.
    detallePallets = Array.from(consolidatedMap.values());

    // --- RECONSTRUCCIÓN DE REPORTES CON DETALLE DE PALLETS ---
    const getNivelLabel = (nivelKey) => {
        const key = String(nivelKey || '').trim().toUpperCase();
        if (key === 'ALTO' || key === '2. ALTO') return '2. ALTO';
        if (key === 'PISO' || key === '3. PISO') return '3. PISO';
        if (key === 'AEREO' || key === 'AÉREO' || key === '4. AEREO' || key === '4. AÉREO') return '4. AÉREO';
        if (key === 'LOGICO' || key === 'LÓGICO' || key === '5. LOGICO' || key === '5. LÓGICO') return '5. LÓGICO';
        if (key === 'MERMA' || key === '6. MERMA') return '6. MERMA';
        return key;
    };

    // 1. Re-calcular totalsByNivel SOLAMENTE para '2. ALTO' con las cantidades con buffer extra
    totalsByNivel['2. ALTO'] = 0;
    /* EL BARRIDO NO ES DEMANDA ATENDIDA. `QTY BUFFER` trae lo que el barrido se lleva de
       mas -y esta bien: el montacarguista lo baja-, pero contarlo como demanda servida hace
       que el cuadro pase del total pedido y el SIN STOCK se desarme. Se descuenta ubicacion
       por ubicacion y SKU por SKU, no con un total: restar el total de golpe sacaba de mas y
       el SIN STOCK subia de 909 a 973 sin que faltara un solo par. */
    const yaDescontado = new Map();
    detallePallets.forEach(dp => {
        const lvl = getNivelLabel(dp.NIVEL);
        if (lvl !== '2. ALTO') return;
        let q = dp['QTY BUFFER'] || 0;
        const k = String(dp.UBICACIONES || '').trim() + '|' + String(dp.SKU || '').trim();
        const barrido = barridoPorUbiSku.get(k) || 0;
        if (barrido > 0) {
            const resta = Math.min(q, barrido - (yaDescontado.get(k) || 0));
            if (resta > 0) { q -= resta; yaDescontado.set(k, (yaDescontado.get(k) || 0) + resta); }
        }
        totalsByNivel['2. ALTO'] += q;
    });

    // 2. Re-generar waterfall con las nuevas cantidades
    let runningRQ_recalc = globalRQ;
    waterfall = Object.keys(nivelesMap).map(k => {
        const val = totalsByNivel[nivelesMap[k]] || 0;
        const currentRQ = runningRQ_recalc;
        runningRQ_recalc = Math.max(0, runningRQ_recalc - val);
        return {
            nivel: nivelesMap[k],
            rq: currentRQ,
            atd: val,
            pct: calcPct(val, globalRQ)
        };
    });

    // 7. SIN STOCK (se mantiene igual pero con el runningRQ recalculado)
    waterfall.push({
        nivel: '7. SIN STOCK',
        rq: runningRQ_recalc,
        atd: runningRQ_recalc,
        pct: calcPct(runningRQ_recalc, globalRQ)
    });

    waterfall.push({
        nivel: 'Total',
        rq: globalRQ,
        atd: waterfall.filter(w => w.nivel !== 'Total').reduce((acc, w) => acc + w.atd, 0),
        pct: '100.0%'
    });

    // 3. Re-generar empaqueAggr para reflejar el buffer extra en la tabla de empaques
    sources.forEach(s => {
        empaqueAggr[s] = {
            'SolidPack': { pal: new Set(), sku: new Set(), units: 0 },
            'PreePack': { pal: new Set(), sku: new Set(), units: 0 }
        };
    });
    detallePallets.forEach(dp => {
        const s = dp.FUENTE;
        const tipo = dp.SKU.trim().length >= 14 ? 'PreePack' : 'SolidPack';
        if (empaqueAggr[s] && empaqueAggr[s][tipo]) {
            if (dp.UBICACIONES) empaqueAggr[s][tipo].pal.add(dp.UBICACIONES);
            empaqueAggr[s][tipo].sku.add(dp.SKU);
            empaqueAggr[s][tipo].units += (dp['QTY BUFFER'] || 0);
        }
    });

    // 4. Re-generar detalleZonas reemplazando únicamente las filas de '2. ALTO'
    const finalDetalleZonas = [];
    detalleZonas.forEach(dz => {
        const lvl = getNivelLabel(dz['NIVEL/AREA']);
        if (lvl !== '2. ALTO') {
            finalDetalleZonas.push(dz);
        }
    });
    detallePallets.forEach(dp => {
        const lvl = getNivelLabel(dp.NIVEL);
        if (lvl === '2. ALTO') {
            finalDetalleZonas.push({
                'NIVEL/AREA': lvl,
                'UBICACION': dp.UBICACIONES,
                'ARTÍCULO': dp.Articulo,
                'SKU': dp.SKU,
                'ATD RQ': dp['QTY BUFFER']
            });
        }
    });
    detalleZonas = finalDetalleZonas;

    // [MOD V12.1.8] EXPLOSIÓN DE LPN: Basta que se pida un SKU de un LPN, traemos TODO el LPN.
    const selectedLPNs = new Set();
    detallePallets.forEach(d => { if(d.LPN) selectedLPNs.add(d.LPN); });

    const detalleExplosionado = [];
    const rowsYaIncluidas = new Set();
    
    detallePallets.forEach((d, idx) => {
        detalleExplosionado.push(d);
        rowsYaIncluidas.add(idx); // No necesitamos el ID real aquí, solo marcar posición
    });

    if (selectedLPNs.size > 0) {
        reserva.forEach((f, idx) => {
            const lpn = String(f['LPN'] || '').trim();
            // Evitar duplicados (si el LPN ya estaba en detallePallets por demanda)
            const yaEnDetalle = detallePallets.some(dp => dp.LPN === lpn && dp.SKU === String(f['PRODUCTO']).trim());
            
            if (selectedLPNs.has(lpn) && !yaEnDetalle) {
                const sku = String(f['PRODUCTO'] || '').trim();
                detalleExplosionado.push({
                    'FUENTE': 'ACOMPAÑANTE LPN',
                    'UBICACIONES': String(f['UBICACION'] || '').trim(),
                    'LPN': lpn,
                    'Articulo': sku.trim().length === 15 ? sku.trim() : sku.substring(0,7),
                    'SKU': sku,
                    'DESCRIPCION': String(f['DESCRIPCION'] || '').trim(),
                    'RQ': 0,
                    'QTY ACTIVO': activeStockMap[sku] || 0,
                    'QTY DESTINO': destinoStockMap[sku] || 0,
                    'QTY RESERVA': parseFloat(f['CANTIDAD']) || 0,
                    'QTY BUFFER': 0,
                    'QTY EXTRA': 0,
                    'NIVEL': String(f['NIVEL'] || '').trim().toUpperCase(),
                    'ES_ALTO': f['ES_ALTO'] !== false
                });
            }
        });
    }

    // 5. Agrupar resultados por Fuente y Tipo para el resumen SKU
    let r = {}; 
    sources.forEach(s => { r[s] = { 'SolidPack': { pal: 0, skus: 0, qty: 0 }, 'PreePack': { pal: 0, skus: 0, qty: 0 } }; });

    Object.keys(demanda).forEach(sku => {
        const d = demanda[sku];
        const type = sku.trim().length >= 14 ? 'PreePack' : 'SolidPack';
        const src = d.sources[0].src; 

        if (r[src] && r[src][type]) {
            r[src][type].qty += d.total;
            r[src][type].skus++;
             // Nota: Para paletas usamos el maestro si existe, sino 1
             const trimmedSku = sku.trim();
             const sku7 = trimmedSku.length === 15 ? trimmedSku : trimmedSku.substring(0, 7);
             const info = trimmedSku.length === 15 ? null : articulosMap.get(sku7);
             r[src][type].pal += (d.total / (info?.unidadesPorPalet || 1));
        }
    });

    const resEmp = [];
    sources.forEach(s => {
        let sourcePallets = new Set();
        let sourceSkus = new Set();
        let sourceUnits = 0;

        ['SolidPack', 'PreePack'].forEach(t => {
            const data = empaqueAggr[s][t];
            // [MOD V12.1.44] ESTRUCTURA 100% FIJA: Siempre mostrar fila, sea 0 o no
            resEmp.push({ 
                fuente: s, 
                tipo: t, 
                paletas: data.pal.size || 0, 
                skus: data.sku.size || 0, 
                parcaja: Math.round(data.units) || 0
            });
            
            data.pal.forEach(p => sourcePallets.add(p));
            data.sku.forEach(sk => sourceSkus.add(sk));
            sourceUnits += data.units;
        });

        resEmp.push({
            fuente: `TOTAL ${s}`,
            tipo: '',
            paletas: sourcePallets.size,
            skus: sourceSkus.size,
            parcaja: Math.round(sourceUnits),
            isSubTotal: true
        });
    });

    if (resEmp.length) {
        resEmp.push({ 
            fuente: 'TOTAL GENERAL', 
            tipo: '', 
            paletas: resEmp.filter(r=>r.isSubTotal).reduce((a,b)=>a+b.paletas, 0), 
            skus: resEmp.filter(r=>r.isSubTotal).reduce((a,b)=>a+b.skus, 0), 
            parcaja: Math.round(resEmp.filter(r=>r.isSubTotal).reduce((a,b)=>a+b.parcaja, 0)) 
        });
    }

    // 2. MATRIZ DE DISCREPANCIAS (YA OPTIMIZADA AL INICIO)


    // [MOD V12.1.52] INICIALIZACIÓN DE MATRICES FIJAS
    const demandMarcas = new Set();
    const demandGenders = new Set();
    Object.keys(demanda).forEach(sku => {
        const info = getArtInfo(sku);
        if (info.marca) demandMarcas.add(info.marca);
        if (info.gender) demandGenders.add(info.gender);
    });

    const buildMatrix = (filterFn) => {
        const aggr = {};
        const keys = new Set(demandGenders);
        
        // Inicializar marcas de la demanda con ceros para asegurar estructura fija
        demandMarcas.forEach(m => aggr[m] = {});

        detalleZonas.filter(filterFn).forEach(d => {
            const info = getArtInfo(d.SKU);
            const qty = d['ATD RQ'] || 0;
            if (!aggr[info.marca]) aggr[info.marca] = {};
            if (!aggr[info.marca][info.gender]) aggr[info.marca][info.gender] = 0;
            aggr[info.marca][info.gender] += qty;
        });
        const sorted = Array.from(keys).sort();
        const rows = Object.keys(aggr).sort().map(marca => {
            const row = { marca, breakdown: {}, total: 0 };
            sorted.forEach(g => {
                const val = aggr[marca][g] || 0;
                row.breakdown[g] = val;
                row.total += val;
            });
            return row;
        });

        if (rows.length > 0) {
            const totalRow = { marca: 'TOTAL', breakdown: {}, total: 0 };
            sorted.forEach(g => {
                const sumG = rows.reduce((acc, r) => acc + (r.breakdown[g] || 0), 0);
                totalRow.breakdown[g] = sumG;
                totalRow.total += sumG;
            });
            rows.push(totalRow);
        }
        return { columns: sorted, rows: rows };
    };

    const matrixResumen = buildMatrix(d => ['3. PISO', '4. AÉREO', '5. LÓGICO', '6. MERMA'].includes(d['NIVEL/AREA']));
    const matrixSinStock = buildMatrix(d => d['NIVEL/AREA'] === '7. SIN STOCK');

    // 3. RESUMEN PARA HISTORIAL (OPTIMIZADO)
    const historyDataMap = {}; 
    detalleZonas.forEach(dz => {
        const demandObj = demanda[dz.SKU];
        if (!demandObj) return;
        
        const ubi = dz.UBICACION;
        const isPalletSource = ubicacionesEnElPiso.has(ubi);
        const nivelLabel = dz['NIVEL/AREA'];

        demandObj.sources.forEach(ds => {
            if (ds.qty <= 0) return;
            if (!historyDataMap[ds.src]) historyDataMap[ds.src] = {};
            if (!historyDataMap[ds.src][nivelLabel]) historyDataMap[ds.src][nivelLabel] = { pal: new Set(), sku: new Set() };
            if (isPalletSource) historyDataMap[ds.src][nivelLabel].pal.add(ubi);
            historyDataMap[ds.src][nivelLabel].sku.add(dz.SKU);
        });
    });

    const historyData = [];
    Object.keys(historyDataMap).sort().forEach(s => {
        Object.keys(historyDataMap[s]).sort().forEach(lvl => {
            historyData.push({
                fuente: s,
                nivel: lvl,
                pal: historyDataMap[s][lvl].pal.size,
                sku: historyDataMap[s][lvl].sku.size
            });
        });
    });

    // 4. RESUMEN SKU DETALLE (Para pestaña Detalle y Sku Bajar)
    const resumenSKUDetalle = Object.keys(demanda).sort().map(sku => {
        const d = demanda[sku];
        const enActivo = totalActivoPorSKU[sku] || 0;
        const diff = Math.max(0, d.total - enActivo);
        
        // Calcular stock en reserva total (Solo nivel ALTO)
        let enReserva = 0;
        if (stAltos[sku]) {
            enReserva = stAltos[sku].reduce((acc, i) => acc + i.qty, 0);
        }

        let factor = getExtraBuffer(sku);
        if (d.isReplenishmentOnly) factor = 0;

        let talla = (dataStore.tabla_tallas && dataStore.tabla_tallas[sku]) || '-';
        if (talla === '-') {
            const segments = sku.split('-');
            if (segments.length >= 3) talla = segments[segments.length - 1].trim();
        }

        let bajado = 0;
        Object.keys(cuotasPicking).forEach(ubi => {
            if (cuotasPicking[ubi][sku]) bajado += cuotasPicking[ubi][sku];
        });
        return {
            'Sku': sku,
            'RQ': d.total,
            'Qty Activo': enActivo,
            'Diferencia': diff,
            'Qty Reserva': enReserva,
            'Talla Usada': talla,
            'Factor Aplicado': factor,
            'QTY BUFFER (Bajado)': bajado,
            'Fuente': d.bestSrc || 'PEDIDO'
        };
    });

    // 5. RESUMEN SIN STOCK (ZONA 7)
    const sinStockRows = detalleZonas.filter(d => d['NIVEL/AREA'] === '7. SIN STOCK');
    const sinStockSummary = {
        skus: new Set(sinStockRows.map(d => String(d['SKU'] || d['Sku'] || d['sku'] || '').trim()).filter(x => x)).size,
        articulos: new Set(sinStockRows.map(d => {
            let val = d['ARTÍCULO'] || d['ARTICULO'] || d['SKU'] || d['Sku'] || d['sku'] || '';
            const trimmedVal = String(val).trim();
            return trimmedVal.length === 15 ? trimmedVal : trimmedVal.substring(0, 7);
        }).filter(x => x && x.length >= 5)).size,
        qty: sinStockRows.reduce((acc, d) => acc + (parseFloat(d['ATD RQ'] || d['ATD_RQ'] || 0) || 0), 0)
    };

    // 6. CONSOLIDACIÓN GLOBAL POR ARTÍCULO (Activo + Reserva)
    const stockGlobalPorArticulo = new Map();
    
    // Sumar Activo
    Object.keys(activeStockMap).forEach(sku => {
        const trimmedSku = String(sku).trim();
        const art = trimmedSku.length === 15 ? trimmedSku : trimmedSku.substring(0, 7);
        if (!stockGlobalPorArticulo.has(art)) stockGlobalPorArticulo.set(art, 0);
        stockGlobalPorArticulo.set(art, stockGlobalPorArticulo.get(art) + (activeStockMap[sku] || 0));
    });
    
    // Sumar Reserva
    reserva.forEach(r => {
        const sku = String(getCol(r, ['PRODUCTO', 'Articulo', 'Producto', 'SKU']) || '').trim();
        const qty = parseFloat(getCol(r, ['CANTIDAD', 'Cant', 'Stock', 'Quantity']) || 0);
        const trimmedSku = sku.trim();
        const art = trimmedSku.length === 15 ? trimmedSku : trimmedSku.substring(0, 7);
        if (art) {
            if (!stockGlobalPorArticulo.has(art)) stockGlobalPorArticulo.set(art, 0);
            stockGlobalPorArticulo.set(art, stockGlobalPorArticulo.get(art) + qty);
        }
    });

    // Generar Reporte Temporadas Q agrupado por AÑO con columnas Q1-Q4
    const aggrAnual = {};
    const aggrGender = {};
    const aggrObsolencia = {};

    stockGlobalPorArticulo.forEach((qty, art) => {
        const info = articulosMap.get(art) || { temporada: 'S/MAESTRO', gGender: 'S/MAESTRO', tipoObsolencia: 'S/MAESTRO' };
        
        // Agregación Gender
        const g = (info.gGender || 'S/MAESTRO').trim();
        aggrGender[g] = (aggrGender[g] || 0) + qty;

        // Agregación Obsolescencia
        const o = (info.tipoObsolencia || 'S/MAESTRO').trim();
        aggrObsolencia[o] = (aggrObsolencia[o] || 0) + qty;

        const fullTemp = info.temporada || 'S/MAESTRO';
        
        let año = 'S/MAESTRO';
        let qKey = 'OTROS';

        // Lógica de extracción de Año y Q (Formatos: YYYY-Q, YYYY-X, YYYY)
        if (fullTemp.includes('-')) {
            const parts = fullTemp.split('-');
            año = parts[0];
            const qPart = parts[1];
            if (['1','2','3','4'].includes(qPart)) qKey = 'Q' + qPart;
            else if (qPart.toUpperCase().includes('Q')) {
                const match = qPart.match(/[1-4]/);
                qKey = match ? 'Q' + match[0] : 'OTROS';
            }
        } else if (/^\d{4}$/.test(fullTemp)) {
            año = fullTemp;
            qKey = 'OTROS';
        } else {
            año = fullTemp;
        }

        if (!aggrAnual[año]) {
            aggrAnual[año] = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, OTROS: 0, Total: 0 };
        }
        
        if (aggrAnual[año][qKey] !== undefined) {
            aggrAnual[año][qKey] += qty;
        } else {
            aggrAnual[año].OTROS += qty;
        }
        aggrAnual[año].Total += qty;
    });

    const sortSpecial = (a, b) => {
        const bottom = ['S/MAESTRO', '(EN BLANCO)', 'ND', 'OTROS', ''];
        const labelA = String(a.label || '').trim().toUpperCase();
        const labelB = String(b.label || '').trim().toUpperCase();
        
        const aIsBottom = bottom.includes(labelA);
        const bIsBottom = bottom.includes(labelB);
        
        if (aIsBottom && !bIsBottom) return 1;
        if (!aIsBottom && bIsBottom) return -1;
        if (aIsBottom && bIsBottom) return bottom.indexOf(labelA) - bottom.indexOf(labelB);
        
        return b.qty - a.qty;
    };


    const reporteGender = Object.keys(aggrGender).map(label => ({
        label: label,
        qty: Math.round(aggrGender[label])
    })).sort(sortSpecial);

    const reporteObsolencia = Object.keys(aggrObsolencia).map(label => ({
        label: label,
        qty: Math.round(aggrObsolencia[label])
    })).sort(sortSpecial);



    const reporteTemporadasQ = Object.keys(aggrAnual).map(año => ({
        'Año': año,
        'Q1': Math.round(aggrAnual[año].Q1),
        'Q2': Math.round(aggrAnual[año].Q2),
        'Q3': Math.round(aggrAnual[año].Q3),
        'Q4': Math.round(aggrAnual[año].Q4),
        'OTROS': Math.round(aggrAnual[año].OTROS),
        'TOTAL': Math.round(aggrAnual[año].Total)
    })).sort((a, b) => {
        const bottom = ['ND', '(en blanco)', 'S/T', 'S/MAESTRO'];
        const aIsBottom = bottom.includes(a.Año);
        const bIsBottom = bottom.includes(b.Año);
        
        if (aIsBottom && !bIsBottom) return 1;
        if (!aIsBottom && bIsBottom) return -1;
        if (aIsBottom && bIsBottom) return bottom.indexOf(a.Año) - bottom.indexOf(b.Año);
        
        // Orden descendente por Año numérico
        return b.Año.localeCompare(a.Año);
    });

    const detalleObsGen = [];
    const detalleTemporadas = [];
    stockGlobalPorArticulo.forEach((qty, art) => {
        const info = articulosMap.get(art) || { gGender: 'S/MAESTRO', tipoObsolencia: 'S/MAESTRO', temporada: 'S/MAESTRO' };
        
        // Detalle Obsolescencia
        detalleObsGen.push({
            'Articulo': art,
            'TIPO OBSOLENCIA': info.tipoObsolencia || 'S/MAESTRO',
            'G. GENDER': info.gGender || 'S/MAESTRO',
            'CANTIDAD': Math.round(qty)
        });

        // Detalle Temporadas
        const fullTemp = info.temporada || 'S/MAESTRO';
        let año = 'S/MAESTRO';
        let qKey = 'OTROS';

        if (fullTemp.includes('-')) {
            const parts = fullTemp.split('-');
            año = parts[0];
            const qPart = parts[1];
            if (['1','2','3','4'].includes(qPart)) qKey = 'Q' + qPart;
            else if (qPart.toUpperCase().includes('Q')) {
                const match = qPart.match(/[1-4]/);
                qKey = match ? 'Q' + match[0] : 'OTROS';
            }
        } else if (/^\d{4}$/.test(fullTemp)) {
            año = fullTemp;
            qKey = 'OTROS';
        } else {
            año = fullTemp;
        }

        detalleTemporadas.push({
            'Articulo': art,
            'Año/Temporadas': año,
            'Q': qKey,
            'Cantidad': Math.round(qty)
        });
    });


    console.log(`[PULSE] Analisis Finalizado: ${detalleTemporadas.length} items en temporadas.`);
    return { 
        version: 'v12.3.0',
        totalReserva: globalRQ,
        detalle: detalleExplosionado, 
        detalleZonas, 
        resumenSKU: resEmp,
        resumenSKUDetalle, 
        resumenNiveles: historyData, 
        waterfall: waterfall,
        resumenMatrix: matrixResumen,
        resumenMatrixSinStock: matrixSinStock,
        sinStockSummary: sinStockSummary,
        reporteTemporadasQ: reporteTemporadasQ,
        reporteGender: reporteGender,
        reporteObsolencia: reporteObsolencia,
        detalleObsGen: detalleObsGen,
        detalleTemporadas: detalleTemporadas,
        detalleRQRevisar: detalleRQRevisar,
        sinStockPorRevisar: sinStockPorRevisar,
        timestamp: new Date().toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    };
};

/* ============================================================================
   PICKING — el resumen de cada día, guardado en la nube
   ----------------------------------------------------------------------------
   Un archivo de picking son ~11.400 filas de 33 columnas. NO se guardan: el
   navegador lee el CSV, calcula (ver `js/reportes/picking.js`) y sube un
   resumen de unos 80 KB por día. Sesenta días son 4,7 MB, que el disco de 1 GB
   aguanta sin problema; las filas crudas serían cientos de MB.

   Todo vive en UNA sola clave `{ "aaaa-mm-dd": {resumen} }`, igual que
   `kpi_results_v2`, porque siempre se leen varios días juntos: Daniel no mide
   día por día — *"yo no voy a medir día por día"*— y bajar un archivo por
   jornada sería una llamada por día.

   A DIFERENCIA DEL KPI VIEJO, ACÁ NO SE FUERZA `X-Environment: production`.
   Ese sello está puesto a mano en `_fetchKPIStore` y hace que pruebas escriba
   sobre los datos reales. Sin él, `env.js` sella solo cuando toca y beta
   trabaja contra su propia base, que es lo que se quiere.
   ============================================================================ */

const PICKING_AREA = 'picking_dias';
/** Tope de días guardados. A 80 KB cada uno son ~9,6 MB en el peor caso. */
const PICKING_TOPE_DIAS = 120;

/**
 * SIEMPRE `?date=MASTER`, EN LA LECTURA Y EN LA ESCRITURA.
 *
 * `picking_dias` no está en `SINGLETON_AREAS` del backend, así que sin este
 * parámetro cada guardado dejaría UN SNAPSHOT NUEVO con la fecha del día: el
 * bloque entero —casi 1 MB con nueve jornadas— duplicado cada vez que alguien
 * carga un archivo, hasta llenar el disco de 1 GB. Con MASTER se reemplaza.
 * Es lo mismo que hace el robot con los stocks.
 *
 * Y se lee con MASTER explícito, no a secas: sin fecha el servidor devuelve el
 * snapshot más reciente por orden alfabético, que hoy es MASTER de casualidad
 * —la M va después de los años— pero no es algo en lo que convenga confiar.
 */
const PICKING_URL = `${API_URL}/${PICKING_AREA}?date=MASTER`;

/** Lee el objeto {dia: resumen} completo. Devuelve {} si no hay nada. */
export const cargarPickingDias = async () => {
    try {
        const res = await fetchWithTimeout(`${PICKING_URL}&t=${Date.now()}`, {}, 15000);
        if (res.ok) {
            const json = await res.json();
            const obj = (json && json.data && typeof json.data === 'object' && !Array.isArray(json.data))
                ? json.data
                : ((typeof json === 'object' && json !== null && !Array.isArray(json)) ? json : null);
            if (obj) return obj;
        }
    } catch (e) { /* sin conexión: se devuelve vacío y la pantalla lo dice */ }
    return {};
};

/**
 * Agrega o reemplaza los días indicados y sube el bloque entero.
 *
 * SE RELEE ANTES DE ESCRIBIR. Si dos personas cargan archivos distintos a la
 * vez, quien guarde último se llevaría por delante lo del otro: releyendo, cada
 * uno solo agrega lo suyo. Es la misma razón de `guardarBloqueFusionado` en las
 * tareas de almacenaje.
 */
export const guardarPickingDias = async (nuevos) => {
    const store = await cargarPickingDias();
    Object.keys(nuevos || {}).forEach(d => { store[d] = nuevos[d]; });

    const dias = Object.keys(store).sort();
    if (dias.length > PICKING_TOPE_DIAS) {
        dias.slice(0, dias.length - PICKING_TOPE_DIAS).forEach(d => { delete store[d]; });
    }
    try {
        const res = await fetchWithTimeout(PICKING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(store)
        }, 30000);
        if (!res.ok) return false;
        const j = await res.json().catch(() => ({}));
        return j.status !== 'error';
    } catch (e) { return false; }
};

/** Borra un día del histórico. */
export const borrarPickingDia = async (dia) => {
    const store = await cargarPickingDias();
    if (!(dia in store)) return true;
    delete store[dia];
    try {
        const res = await fetchWithTimeout(PICKING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(store)
        }, 30000);
        return res.ok;
    } catch (e) { return false; }
};
