import * as syncEngine from './sync_engine_v24_9.js?v=26.5.550';

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

export const getUploadMeta = (area) => {
    try {
        const meta = localStorage.getItem('meta_' + area);
        return meta ? JSON.parse(meta) : null;
    } catch(e) { return null; }
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
const VERSION = '26.5.550';
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

export const logSystemAction = async (username, action, details) => {
    try {
        await fetch(`${API_BASE}/logs`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify({ username, action, details })
        });
    } catch (e) { console.error("Error al loguear acción:", e); }
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

const persistToDatabase = async (area, payload, username = 'sistema') => {
    // 1. Guardar de forma inmediata en local IndexedDB y memoria
    dataStore[area] = payload;
    await saveToDB(area, payload);
    
    // [AUTO] Actualizar Tabla de Tallas si es Stock Activo o Reserva de cualquier área
    if (area.endsWith('_activo') || area.endsWith('_reserva')) {
        updateTablaTallas();
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
            logSystemAction(username, 'SUBIDA_DATOS', `Área: ${area}. Registros: ${payload.length} (Segundo plano)`);
        }
    }).catch(err => {
        console.warn(`[PULSE] Error de sincronización de fondo para ${area}:`, err);
    });
};

export const clearAreaData = async (area, username = 'sistema') => {
    dataStore[area] = null;
    localStorage.removeItem('meta_' + area);
    
    // [MOD LOCAL] Si es del módulo de Recepción o el Maestro de Artículos, procesar 100% de manera local
    if (area.startsWith('recepcion') || area === 'articulos' || area === 'validar_reserva' || area === 'validar_activo' || area === 'validar_lpn' || area.startsWith('buffer') || area === 'solicitud' || area === 'tallas' || area.startsWith('analisis_sku')) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(area);
        } catch (e) {
            console.warn(`[PULSE] Error al limpiar localmente '${area}':`, e);
        }
        return;
    }

    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(area);
        
        // Enviar array vacío al servidor para "limpiar" la persistencia remota
        await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify([])
        });
        await logSystemAction(username, 'LIMPIEZA_DATOS', `Área: ${area} vaciada por el usuario.`);
    } catch (e) {
        console.warn(`[PULSE] No se pudo limpiar el servidor para '${area}', se limpió solo local.`, e);
    }
};

export const getAreaData = async (area, forceRefresh = false) => {
  if (!forceRefresh && dataStore[area] !== undefined && dataStore[area] !== null) return dataStore[area];
  
  if (!forceRefresh) {
      // [MOD V12.1.47] Prioridad a la DB Local (Instantáneo)
      const dbData = await loadFromDB(area);
      if (dbData) { 
          dataStore[area] = dbData; 
          return dbData; 
      }
  }

  // [MOD LOCAL] Si es del módulo de Recepción o el Maestro de Artículos, no buscar en el servidor
  if (area.startsWith('recepcion') || area === 'articulos' || area === 'validar_reserva' || area === 'validar_activo' || area === 'validar_lpn' || area.startsWith('buffer') || area === 'solicitud' || area === 'tallas' || area.startsWith('analisis_sku')) {
      if (area.endsWith('_activo') || area.endsWith('_reserva')) {
          updateTablaTallas();
      }
      return null;
  }

  try {
     let queryURL = `${API_URL}/${area}`;
     if (currentDateFilter) queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
     const response = await fetch(queryURL, {
         headers: { 'X-Environment': 'production' }
     });
     if (response.ok) {
         const serverResponse = await response.json();
          if (serverResponse.data && Array.isArray(serverResponse.data) && serverResponse.data.length > 0) {
              dataStore[area] = serverResponse.data;
              await saveToDB(area, serverResponse.data); // Sincronizar cache local
              if (serverResponse.updated_at) {
                  let safeDateStr = serverResponse.updated_at;
                  if (safeDateStr.includes(' ') && !safeDateStr.includes('T')) {
                      safeDateStr = safeDateStr.replace(' ', 'T');
                  }
                  if (!safeDateStr.endsWith('Z')) {
                      safeDateStr += 'Z';
                  }
                  const parsedTime = new Date(safeDateStr).getTime();
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
  
  if (area.endsWith('_activo') || area.endsWith('_reserva')) {
      updateTablaTallas();
  }

  return null;
};

// =============================================
// MOTOR DE EXTRACCIÓN DE TALLAS (v12.3.6)
// =============================================
const extractTalla = (desc) => {
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
    const getExtraBuffer = (sku) => {
        if (!sku) return 0;
        const trimmedSku = sku.trim();
        if (trimmedSku.length === 15) {
            return 0;
        }
        
        let configTallasGenero = {};
        let configSKUExcepciones = {};
        try {
            const g = localStorage.getItem('logistics_v24_prod_configTallasGenero');
            if (g) configTallasGenero = JSON.parse(g) || {};
            const s = localStorage.getItem('logistics_v24_prod_configSKUExcepciones');
            if (s) configSKUExcepciones = JSON.parse(s) || {};
        } catch(e) {
            console.warn("[PULSE] Error al leer configuraciones de Analisis SKU:", e);
        }

        if (configSKUExcepciones[trimmedSku] !== undefined) {
            return parseInt(configSKUExcepciones[trimmedSku]) || 0;
        }

        const sku7 = trimmedSku.substring(0, 7);
        const info = articulosMap.get(sku7);
        if (!info) return 0;

        const g = String(info.gender || 'OTROS').trim().toUpperCase();
        
        let talla = '-';
        const tallasMap = dataStore.tabla_tallas || {};
        talla = tallasMap[trimmedSku] || '-';
        if (talla === '-') {
            const segments = trimmedSku.split('-');
            if (segments.length >= 3) {
                talla = segments[segments.length - 1].trim(); // Solo extrae el sufijo sin reglas matemáticas
            }
        }

        const key = `${g}_${talla}`;
        return parseInt(configTallasGenero[key]) || 0;
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

    const satisfyDemand = (sku, pending, stockMap, nivelLabel) => {
        if (!stockMap[sku] || pending <= 0) return pending;
        for (let item of stockMap[sku]) {
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
            factorVirtual = Math.min(factorFaltante, stockReservaReal);
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
    const activeStockMap = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return; // EXCLUIR MATE SEGÚN INDICACIÓN
        
        const isLevel1 = activeWhitelist.some(w => area.includes(w));
        if (!isLevel1) return; // Omitir si no pertenece a zona de picking activa

        let sku = String(rawF[1] || '').trim(); // SKU en Columna B (índice 1)
        let qty = parseFloat(rawF[4]) || 0;     // Cantidad en Columna E (índice 4)
        if (sku) activeStockMap[sku] = (activeStockMap[sku] || 0) + qty;
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
    detallePallets.forEach(dp => {
        const lvl = getNivelLabel(dp.NIVEL);
        if (lvl === '2. ALTO') {
            totalsByNivel['2. ALTO'] += dp['QTY BUFFER'] || 0;
        }
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
        timestamp: new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    };
};
