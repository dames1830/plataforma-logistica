// Almacenamiento en memoria CACHÉ para respuesta rápida UI
export const dataStore = {
  tabla_tallas: {} // Mapa de SKU -> Talla
};

// =============================================
// OPTIMIZACIÓN: BASE DE DATOS LOCAL (IndexedDB)
// =============================================
const DB_NAME = 'LogisticsPulseDB';
const STORE_NAME = 'DataCache';
const DB_VERSION = 1;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 horas de validez

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
        localStorage.setItem('meta_' + key, JSON.stringify({ ts: Date.now(), hasData: true }));
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

const clearDB = async () => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        Object.keys(dataStore).forEach(k => localStorage.removeItem('meta_' + k));
    } catch(e) {}
};

export const initPersistentData = async () => {
    const keys = Object.keys(localStorage);
    const areaKeys = keys.filter(k => k.startsWith('meta_')).map(k => k.replace('meta_', ''));
    const staticAreas = ['buffer', 'solicitud', 'articulos', 'tallas', 'tabla_tallas', 'inventario', 'picking', 'packing', 'despacho', 'recepcion', 'almacenaje', 'no_retail'];
    const allUniqueAreas = [...new Set([...areaKeys, ...staticAreas])];

    for (const area of allUniqueAreas) {
        const cached = await loadFromDB(area);
        if (cached) {
            dataStore[area] = cached;
        }
    }
};

initPersistentData();

export let currentDateFilter = null;
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const API_URL = `${API_BASE}/logistics`;
const BUFFER_HISTORY_URL = `${API_URL}/buffer_history`;

export const getCol = (row, names) => {
    if (!row) return null;
    const normalize = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, '');
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
        Object.keys(dataStore).forEach(k => dataStore[k] = null);
        clearDB();
    }
};

export const saveBufferReport = async (bufferKPIObj, username = 'system') => {
    try {
        const payload = { data: bufferKPIObj, updated_by: username, ts: Date.now(), created_at: new Date().toISOString() };
        const response = await fetch(BUFFER_HISTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            saveToLocalHistory(payload);
            return true;
        }
        saveToLocalHistory(payload);
        return false;
    } catch (e) {
        saveToLocalHistory({ data: bufferKPIObj, updated_by: username, ts: Date.now() });
        return false;
    }
};

const saveToLocalHistory = (report) => {
    try {
        const raw = localStorage.getItem('logistics_buffer_history_local') || '[]';
        const history = JSON.parse(raw);
        history.push(report);
        if (history.length > 20) history.shift();
        localStorage.setItem('logistics_buffer_history_local', JSON.stringify(history));
    } catch(e) {}
};

export const fetchBufferHistory = async () => {
    let serverHistory = [];
    try {
        const res = await fetch(BUFFER_HISTORY_URL, { headers: { 'X-Environment': 'production' } });
        if (res.ok) {
            const json = await res.json();
            if (json.data) serverHistory = Array.isArray(json.data) ? json.data : [json.data];
        }
    } catch (e) {}
    
    try {
        const localRaw = localStorage.getItem('logistics_buffer_history_local') || '[]';
        const localHistory = JSON.parse(localRaw);
        const combined = [...serverHistory];
        localHistory.forEach(lh => {
            const exists = combined.some(sh => (sh.ts === lh.ts) || (sh.created_at === lh.created_at));
            if (!exists) combined.push(lh);
        });
        return combined;
    } catch(e) { return serverHistory; }
};

export const getAreaData = async (area) => {
    if (dataStore[area] !== null && dataStore[area] !== undefined) return dataStore[area];
    const dbData = await loadFromDB(area);
    if (dbData) { dataStore[area] = dbData; return dbData; }

    try {
        let queryURL = `${API_URL}/${area}`;
        if (currentDateFilter) queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
        const response = await fetch(queryURL, { headers: { 'X-Environment': 'production' } });
        if (response.ok) {
            const serverResponse = await response.json();
            const result = serverResponse.data !== undefined ? serverResponse.data : serverResponse;
            if (result && Array.isArray(result) && result.length > 0) {
                dataStore[area] = result;
                await saveToDB(area, result);
                return result;
            }
        }
    } catch (err) {}
    return null;
};

export const clearAreaData = async (area, username = 'sistema') => {
    dataStore[area] = null;
    localStorage.removeItem('meta_' + area);
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(area);
        await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify([])
        });
    } catch (e) {}
};

export const updateTablaTallas = () => {
    const mapa = dataStore.tabla_tallas || {};
    Object.keys(dataStore).forEach(area => {
        if (area.endsWith('_activo') && dataStore[area]) {
            dataStore[area].forEach(row => {
                const raw = Array.isArray(row) ? row : Object.values(row);
                const sku = String(raw[1] || '').trim();
                const desc = getCol(row, ['Descripcion', 'Descripción', 'Description']) || (Array.isArray(row) ? row[2] : Object.values(row)[2]);
                if (sku && desc) {
                    const parts = String(desc).split('-');
                    if (parts.length >= 3) mapa[sku] = parts[parts.length - 1].trim();
                }
            });
        }
    });
    dataStore.tabla_tallas = mapa;
    saveToDB('tabla_tallas', mapa);
};

export const calculateBufferPallets = (configOverride = null) => {
    const activo = dataStore.buffer_activo;
    const reserva = dataStore.buffer_reserva;
    const pedidos = dataStore.buffer;
    const articulos = dataStore.articulos;
    if(!activo || !reserva || !articulos) return null;

    const articulosMap = new Map();
    articulos.forEach(row => {
        const raw = Array.isArray(row) ? row : Object.values(row);
        const sku7 = String(raw[1] || '').trim().substring(0,7);
        if (sku7 && !articulosMap.has(sku7)) {
            articulosMap.set(sku7, { gender: String(raw[3] || 'OTROS').trim().toUpperCase(), marca: String(raw[13] || 'OTROS').trim() });
        }
    });

    let stBajas = {}, stAltos = {}, stPisos = {}, stAereos = {}, stLogicos = {};
    const registerStock = (map, sku, qty, row) => { if (!map[sku]) map[sku] = []; map[sku].push({ qty, row }); };

    const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
    activo.forEach(f => {
        const area = String(getCol(f, ['Area', 'Área', 'Ãrea']) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const sku = String(getCol(f, ['Articulo', 'Artículo', 'ArtÃculo', 'Sku']) || '').trim();
        const qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
        if (sku && qty > 0 && activeWhitelist.some(w => area.includes(w))) registerStock(stBajas, sku, qty, f);
    });

    reserva.forEach(f => {
        const nivel = String(f['NIVEL'] || '').trim().toUpperCase();
        const sku = String(f['PRODUCTO'] || '').trim();
        const qty = parseFloat(f['CANTIDAD']) || 0;
        if (sku && qty > 0) {
            if (nivel === 'ALTO') registerStock(stAltos, sku, qty, f);
            else if (nivel === 'CROSS') registerStock(stPisos, sku, qty, f);
            else if (nivel === 'AEREO') registerStock(stAereos, sku, qty, f);
            else registerStock(stLogicos, sku, qty, f);
        }
    });

    let demanda = {};
    if (pedidos) {
        pedidos.forEach(f => {
            const sku = String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo', 'Artículo'])) || '';
            const cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada', 'Cantidad'])) || 0;
            const asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada'])) || 0;
            if (sku && cant - asig > 0) {
                if (!demanda[sku]) demanda[sku] = { total: 0, sources: [{ src: 'PEDIDOS', qty: 0 }] };
                demanda[sku].total += (cant - asig);
                demanda[sku].sources[0].qty += (cant - asig);
            }
        });
    }

    let detalleZonas = [], globalRQ = 0, waterfall = { bajas: 0, alto: 0, piso: 0, aereo: 0, logico: 0 };
    Object.keys(demanda).forEach(sku => {
        let pending = demanda[sku].total;
        globalRQ += pending;
        const satisfy = (map, key) => {
            if (!map[sku]) return;
            map[sku].forEach(item => {
                const take = Math.min(pending, item.qty);
                if (take > 0) {
                    pending -= take;
                    waterfall[key] += take;
                    detalleZonas.push({ 'NIVEL/AREA': key.toUpperCase(), 'UBICACION': getCol(item.row, ['UBICACION', 'Ubicación']) || 'S/U', 'SKU': sku, 'ATD RQ': take });
                }
            });
        };
        satisfy(stBajas, 'bajas');
        if (pending > 0) satisfy(stAltos, 'alto');
        if (pending > 0) satisfy(stPisos, 'piso');
        if (pending > 0) satisfy(stAereos, 'aereo');
        if (pending > 0) satisfy(stLogicos, 'logico');
    });

    return { totalReserva: globalRQ, detalleZonas, resumenSKU: [], waterfall, timestamp: new Date().toLocaleString() };
};

export const logSystemAction = async (username, action, details) => {
    try {
        await fetch(`${API_BASE}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
            body: JSON.stringify({ username, action, details })
        });
    } catch (e) {}
};
