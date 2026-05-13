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
        // Guardar meta en LS para acceso rápido UI (indicadores verdes)
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

// Inicializar dataStore desde IndexedDB al cargar la app
export const initPersistentData = async () => {
    // Escanear localStorage para encontrar todas las áreas que tienen metadata
    const keys = Object.keys(localStorage);
    const areaKeys = keys
        .filter(k => k.startsWith('meta_'))
        .map(k => k.replace('meta_', ''));
    
    // Añadir áreas estáticas conocidas por si acaso
    const staticAreas = ['buffer', 'solicitud', 'articulos', 'tallas', 'tabla_tallas', 'inventario', 'picking', 'packing', 'despacho', 'recepcion', 'almacenaje', 'no_retail'];
    const allUniqueAreas = [...new Set([...areaKeys, ...staticAreas])];

    for (const area of allUniqueAreas) {
        const cached = await loadFromDB(area);
        if (cached) {
            dataStore[area] = cached;
            console.log(`[PULSE] Recuperado ${area} de DB Local.`);
        }
    }
};

// Iniciar carga en segundo plano
initPersistentData();

// Control Trazabilidad: Fecha seleccionada (null = Fecha Actual/Más reciente)
export let currentDateFilter = null;

// URL MAESTRA DEL SERVIDOR (Punto de conexión Producción)
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const SHARED_API = 'https://logistics-shared-api.onrender.com/api';
const VERSION = '17.4.6';
const CACHE_KEY = `logistics_v17_4_6_shared_`;
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

// URL para Historial de Buffer en la DB Principal
const BUFFER_HISTORY_URL = `${API_URL}/buffer_history`;

export const saveBufferReport = async (bufferKPIObj, username = 'system') => {
    try {
        const payload = {
            data: bufferKPIObj,
            updated_by: username,
            ts: Date.now(),
            created_at: new Date().toISOString()
        };

        const response = await fetch(BUFFER_HISTORY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('✅ Reporte Buffer guardado en DB Principal.');
            saveToLocalHistory(payload);
            return true;
        } else {
            console.warn(`⚠️ Error DB (${response.status}): Guardando solo localmente.`);
            saveToLocalHistory(payload);
            return false;
        }
    } catch (e) {
        console.warn('⚠️ Fallo de conexión: Guardando solo localmente.', e);
        saveToLocalHistory({ data: bufferKPIObj, updated_by: username, ts: Date.now() });
        return false;
    }
};

const saveToLocalHistory = (report) => {
    try {
        const raw = localStorage.getItem('logistics_buffer_history_local') || '[]';
        const history = JSON.parse(raw);
        history.push(report);
        // Mantener solo los últimos 20 reportes localmente
        if (history.length > 20) history.shift();
        localStorage.setItem('logistics_buffer_history_local', JSON.stringify(history));
    } catch(e) { console.warn('⚠️ No se pudo guardar historial local:', e); }
};

export const loadBufferReport = async () => {
    try {
        const res = await fetch(`${SHARED_API}/buffer_report`, {
            headers: { 'X-Environment': 'production' }
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status === 'ok' && json.data) {
            console.log(`✅ Reporte Buffer cargado del servidor.`);
            // Si devuelve un array, tomamos el último
            if (Array.isArray(json.data)) return json.data[json.data.length - 1];
            return json.data;
        }
    } catch (e) {
        console.warn('⚠️ No se pudo cargar el reporte del servidor:', e);
    }
    return null;
};

export const fetchBufferHistory = async () => {
    let serverHistory = [];
    try {
        const res = await fetch(BUFFER_HISTORY_URL, {
            headers: { 'X-Environment': 'production' }
        });
        if (res.ok) {
            const json = await res.json();
            if (json.data) {
                serverHistory = Array.isArray(json.data) ? json.data : [json.data];
                console.log(`✅ ${serverHistory.length} reportes cargados de DB Principal.`);
            }
        }
    } catch (e) {
        console.warn('⚠️ Error obteniendo historial de DB:', e);
    }
    
    try {
        const localRaw = localStorage.getItem('logistics_buffer_history_local') || '[]';
        const localHistory = JSON.parse(localRaw);
        
        const combined = [...serverHistory];
        localHistory.forEach(lh => {
            const exists = combined.some(sh => (sh.ts === lh.ts) || (sh.created_at === lh.created_at));
            if (!exists) combined.push(lh);
        });
        
        // Limpieza de Quota: Solo mantener los últimos 10 locales si hay muchos
        if (localHistory.length > 10) {
            localStorage.setItem('logistics_buffer_history_local', JSON.stringify(localHistory.slice(-10)));
        }

        return combined;
    } catch(e) { 
        return serverHistory; 
    }
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
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          
          let jsonData = [];
          if (area.endsWith('_reserva')) {
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
              const dc = (s) => String(s || '').trim();
              for (let i = 3; i < rows.length; i++) {
                  const r = rows[i];
                  if (!r || r.length < 9) continue;
                  jsonData.push({
                      'NIVEL': dc(r[1]),
                      'PRODUCTO': dc(r[8]), // Columna I
                      'CANTIDAD': parseFloat(r[10]) || 0,
                      'UBICACION': dc(r[4]),
                      'LPN': dc(r[5]),
                      'NRO AND': dc(r[2]),
                      'DESCRIPCION': dc(r[9]) // Columna J
                  });
              }
          } else {
              jsonData = XLSX.utils.sheet_to_json(sheet, { range: 0, defval: "" });
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
    try {
        const response = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify(payload)
        });
        if(response.ok) {
           dataStore[area] = payload;
        await saveToDB(area, payload);
           await logSystemAction(username, 'SUBIDA_DATOS', `Área: ${area}. Registros: ${payload.length}`);
        } else {
           dataStore[area] = payload;
        await saveToDB(area, payload);
        }
    } catch (err) {
        dataStore[area] = payload;
        await saveToDB(area, payload);
    }
    
    // [AUTO] Actualizar Tabla de Tallas si es Stock Activo o Reserva
    if (area.endsWith('_activo') || area.endsWith('_reserva')) {
        updateTablaTallas();
    }
};

export const clearAreaData = async (area, username = 'sistema') => {
    dataStore[area] = null;
    localStorage.removeItem('meta_' + area);
    
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(area);
        
        // Enviar array vacío al servidor para "limpiar"
        await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify([])
        });
        await logSystemAction(username, 'LIMPIEZA_DATOS', `Área: ${area} vaciada.`);
    } catch (e) {
        console.warn(`[PULSE] No se pudo limpiar el servidor para '${area}', se limpió solo local.`, e);
    }
};

export const getAreaData = async (area) => {
  if (dataStore[area] !== null && dataStore[area] !== undefined) return dataStore[area];
  
  const dbData = await loadFromDB(area);
  if (dbData) { 
      dataStore[area] = dbData; 
      return dbData; 
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
// MOTOR DE EXTRACCIÓN DE TALLAS (v17.4.6)
// =============================================
const extractTalla = (desc) => {
    if (!desc) return null;
    const d = String(desc).trim();
    const parts = d.split('-');
    if (parts.length >= 3) {
        return parts[parts.length - 1].trim();
    }
    return null;
};

export const updateTablaTallas = () => {
    const mapa = dataStore.tabla_tallas || {};
    
    Object.keys(dataStore).forEach(area => {
        if (area.endsWith('_activo') && dataStore[area]) {
            dataStore[area].forEach(row => {
                const raw = Array.isArray(row) ? row : Object.values(row);
                const sku = String(raw[1] || '').trim(); // Columna B
                const desc = getCol(row, ['Descripcion', 'Descripción', 'Description']) || 
                             (Array.isArray(row) ? row[2] : Object.values(row)[2]);
                if (sku && desc) {
                    const talla = extractTalla(desc);
                    if (talla) mapa[sku] = talla;
                }
            });
        }
        if (area.endsWith('_reserva') && dataStore[area]) {
            dataStore[area].forEach(row => {
                const sku = row.PRODUCTO;
                const desc = row.DESCRIPCION;
                if (sku && desc) {
                    const talla = extractTalla(desc);
                    if (talla) mapa[sku] = talla;
                }
            });
        }
        if (area === 'tallas' && dataStore[area]) {
            dataStore[area].forEach(row => {
                const raw = Array.isArray(row) ? row : Object.values(row);
                const sku = String(raw[0] || '').trim();   // Columna A
                const tallaReal = String(raw[1] || '').trim(); // Columna B
                if (sku && tallaReal) mapa[sku] = tallaReal;
            });
        }
    });

    dataStore.tabla_tallas = mapa;
    saveToDB('tabla_tallas', mapa);
    
    // PERSISTENCIA GLOBAL v17.4.6
    if (Object.keys(mapa).length > 0) {
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
        const response = await fetch(`${API_BASE}/buffer/config`, { 
            headers: { 'X-Environment': 'production' }
        });
        if (response.ok) return await response.json();
    } catch (e) { console.error("Error fetchBufferConfig:", e); }
    return { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
};

export const calculateBufferPallets = (configOverride = null) => {
    const activo = dataStore.buffer_activo;
    const reserva = dataStore.buffer_reserva;
    const pedidos = dataStore.buffer; 
    const solicitud = dataStore.solicitud; 
    const tallas = dataStore.tallas;     
    const articulos = dataStore.articulos;
    
    if(!activo || !reserva || !articulos) {
        return null;
    }

    const articulosMap = new Map();
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

    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
    const getArticulo = (sku) => String(sku || '').substring(0, 7);

    let stBajas = {}, stAltos = {}, stPisos = {}, stAereos = {}, stLogicos = {}, stMerma = {};
    const registerStock = (map, sku, qty, row) => {
        if (!map[sku]) map[sku] = [];
        map[sku].push({ qty, row });
    };

    const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
    
    activo.forEach(f => {
        let areaRaw = getCol(f, ['Ãrea', 'Area', 'Área', 'Ārea']);
        let area = String(areaRaw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        let sku = String(getCol(f, ['ArtÃculo', 'Articulo', 'Artículo', 'Sku']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
        if(!sku || qty <= 0) return;
        if (activeWhitelist.some(w => area.includes(w))) {
            registerStock(stBajas, sku, qty, f); 
        }
    });

    reserva.forEach(f => {
        let nivel = String(f['NIVEL'] || '').trim().toUpperCase();
        let sku = String(f['PRODUCTO'] || '').trim();
        let qty = parseFloat(f['CANTIDAD']) || 0;
        let nroAnd = String(f['NRO AND'] || f['AND'] || '').trim().toUpperCase();
        if(!sku || qty <= 0) return;
        if (nivel === 'ALTO') registerStock(stAltos, sku, qty, f);
        else if (nivel === 'CROSS') registerStock(stPisos, sku, qty, f);
        else if (nivel === 'AEREO') registerStock(stAereos, sku, qty, f);
        else if (nivel === 'PISO' || nivel === 'DIS') registerStock(stLogicos, sku, qty, f);
        else if (nivel === 'VER') {
            if (nroAnd === 'MZM-TR') registerStock(stLogicos, sku, qty, f);
            else registerStock(stMerma, sku, qty, f);
        }
    });

    const rawDemand = { 'PEDIDOS': [], 'OTRAS SOLICITUDES': [], 'REPLENISHMENT': [] };
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

    let tempMap = {};
    const hierarchy = ['PEDIDOS', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
    hierarchy.forEach(src => {
        rawDemand[src].forEach(item => {
            if (!tempMap[item.sku]) tempMap[item.sku] = { total: 0, bestSrc: src };
            tempMap[item.sku].total += item.qty;
        });
    });

    let demanda = {};
    Object.keys(tempMap).forEach(sku => {
        const item = tempMap[sku];
        demanda[sku] = { total: item.total, sources: [{ src: item.bestSrc, qty: item.total }] };
    });

    let detalleZonas = [], stockUsadoMap = new Map(), ubicacionesEnElPiso = new Set(), cuotasPicking = {};
    let globalRQ = 0, totalsByNivel = {};

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
                detalleZonas.push({ 'NIVEL/AREA': nivelLabel, 'UBICACION': ubi, 'ARTÍCULO': getArticulo(sku), 'SKU': sku, 'ATD RQ': pick });
                const lvlUpper = nivelLabel.toUpperCase();
                if (lvlUpper.includes('ALTO') || lvlUpper.includes('PISO') || lvlUpper.includes('AEREO') || lvlUpper.includes('AÉREO')) {
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

    const totalActivoPorSKU = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return;
        let sku = String(rawF[1] || '').trim();
        let qty = parseFloat(rawF[4]) || 0;
        if (!sku || qty <= 0) return;
        if (activeWhitelist.some(w => area.includes(w))) {
            totalActivoPorSKU[sku] = (totalActivoPorSKU[sku] || 0) + qty;
        } else {
            registerStock(stLogicos, sku, qty, f);
        }
    });

    const getArtInfo = (sku) => {
        const sku7 = String(sku || '').trim().substring(0, 7);
        const info = articulosMap.get(sku7) || { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        return { gender: info.gender, marca: info.marca };
    };

    const nivelesMap = { 'Bajas': '1. BAJAS', 'Alto': '2. ALTO', 'Piso': '3. PISO', 'Aereo': '4. AÉREO', 'Logico': '5. LÓGICO', 'Merma': '6. MERMA' };

    Object.keys(demanda).sort().forEach(sku => {
        let totalSolicitado = demanda[sku].total;
        globalRQ += totalSolicitado;
        let enActivo = totalActivoPorSKU[sku] || 0;
        let pending = totalSolicitado;
        let atdActivo = Math.min(pending, enActivo);
        if (!totalsByNivel[nivelesMap['Bajas']]) totalsByNivel[nivelesMap['Bajas']] = 0;
        totalsByNivel[nivelesMap['Bajas']] += atdActivo;
        if (atdActivo > 0) {
            detalleZonas.push({ 'NIVEL/AREA': nivelesMap['Bajas'], 'UBICACION': 'ZONA PICKING', 'ARTÍCULO': getArticulo(sku), 'SKU': sku, 'ATD RQ': atdActivo });
        }
        pending -= atdActivo;
        if (pending > 0) {
            pending = satisfyDemand(sku, pending, stAltos, nivelesMap['Alto']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stPisos, nivelesMap['Piso']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stAereos, nivelesMap['Aereo']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stLogicos, nivelesMap['Logico']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stMerma, nivelesMap['Merma']);
            if (pending > 0) {
                detalleZonas.push({ 'NIVEL/AREA': '7. SIN STOCK', 'UBICACION': 'S/S', 'ARTÍCULO': getArticulo(sku), 'SKU': sku, 'ATD RQ': pending });
            }
        }
    });

    const calcPct = (a, r) => r > 0 ? ((a / r) * 100).toFixed(1) + '%' : '0%';
    let runningRQ = globalRQ;
    const waterfall = Object.keys(nivelesMap).map(k => {
        const val = totalsByNivel[nivelesMap[k]] || 0;
        const currentRQ = runningRQ;
        runningRQ = Math.max(0, runningRQ - val);
        return { nivel: nivelesMap[k], rq: currentRQ, atd: val, pct: calcPct(val, globalRQ) };
    });
    waterfall.push({ nivel: '7. SIN STOCK', rq: runningRQ, atd: runningRQ, pct: calcPct(runningRQ, globalRQ) });
    waterfall.push({ nivel: 'Total', rq: globalRQ, atd: globalRQ, pct: '100.0%' });

    const empaqueAggr = {};
    const sources = ['PEDIDOS', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
    sources.forEach(s => {
        empaqueAggr[s] = { 'SolidPack': { pal: new Set(), sku: new Set(), units: 0 }, 'PreePack': { pal: new Set(), sku: new Set(), units: 0 } };
    });

    const activeStockMap = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return;
        let sku = String(rawF[1] || '').trim();
        let qty = parseFloat(rawF[4]) || 0;
        if (sku) activeStockMap[sku] = (activeStockMap[sku] || 0) + qty;
    });

    let detallePallets = [];
    Array.from(ubicacionesEnElPiso).forEach(ubi => {
        let items = reserva.filter(f => String(f['UBICACION']).trim() === ubi);
        items.forEach(item => {
            let sku = String(getCol(item, ['PRODUCTO', 'Articulo', 'Producto']) || '').trim();
            let qty = parseFloat(item['CANTIDAD'] || 0);
            let pick = (cuotasPicking[ubi] && cuotasPicking[ubi][sku]) ? cuotasPicking[ubi][sku] : 0;
            if (pick > 0) {
                const demandObj = demanda[sku];
                const tipo = sku.length >= 14 ? 'PreePack' : 'SolidPack';
                if (demandObj) {
                    demandObj.sources.forEach(dSrc => {
                        const proportion = dSrc.qty / demandObj.total;
                        const attributedUnits = pick * proportion;
                        if (attributedUnits > 0) {
                            detallePallets.push({ 'FUENTE': dSrc.src, 'UBICACIONES': ubi, 'LPN': item['LPN'], 'SKU': sku, 'Articulo': sku.substring(0,7), 'RQ': dSrc.qty, 'QTY ACTIVO': activeStockMap[sku] || 0, 'QTY RESERVA': qty, 'QTY BUFFER': Math.round(attributedUnits) });
                            empaqueAggr[dSrc.src][tipo].pal.add(ubi);
                            empaqueAggr[dSrc.src][tipo].sku.add(sku);
                            empaqueAggr[dSrc.src][tipo].units += attributedUnits;
                        }
                    });
                }
            }
        });
    });

    const resEmp = [];
    sources.forEach(s => {
        let sourcePallets = new Set();
        let sourceSkus = new Set();
        let sourceUnits = 0;
        ['SolidPack', 'PreePack'].forEach(t => {
            const data = empaqueAggr[s][t];
            resEmp.push({ fuente: s, tipo: t, paletas: data.pal.size, skus: data.sku.size, parcaja: Math.round(data.units) });
            data.pal.forEach(p => sourcePallets.add(p));
            data.sku.forEach(sk => sourceSkus.add(sk));
            sourceUnits += data.units;
        });
        resEmp.push({ fuente: `TOTAL ${s}`, tipo: '', paletas: sourcePallets.size, skus: sourceSkus.size, parcaja: Math.round(sourceUnits), isSubTotal: true });
    });

    return { 
        version: 'v17.4.6',
        totalReserva: globalRQ,
        detalleZonas, 
        resumenSKU: resEmp,
        waterfall: waterfall,
        timestamp: new Date().toLocaleString()
    };
};
