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

// URL MAESTRA DEL SERVIDOR (Punto de conexión)
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const SHARED_API = 'https://logistics-shared-api.onrender.com/api';
const VERSION = '18.5.3-BETA';
const CACHE_KEY = `logistics_v18_5_1_beta_shared_`;
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
          if (area === 'stockReserva' || area.endsWith('_reserva')) {
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
    
    // [AUTO] Actualizar Tabla de Tallas si es Stock Activo o Reserva de cualquier área
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

export const getAreaData = async (area) => {
  if (dataStore[area] !== null) return dataStore[area];
  
  // [MOD V12.1.47] Prioridad a la DB Local (Instantáneo)
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
// MOTOR DE EXTRACCIÓN DE TALLAS (v12.3.6)
// =============================================
const extractTalla = (desc) => {
    if (!desc) return null;
    const d = String(desc).trim();
    // Patrón: -[cualquier cosa]-[TALLA]
    // Buscamos la última coincidencia del patrón guion-algo-guion
    const parts = d.split('-');
    if (parts.length >= 3) {
        // Tomamos lo que viene después del último guion
        return parts[parts.length - 1].trim();
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
        // [ESTRICTO] JOIN con la tabla virtual de tallas (Maestro)
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); 
        try {
            const response = await fetch(`${API_BASE}/buffer/config`, { 
                signal: controller.signal,
                headers: { 'X-Environment': 'production' }
            });
            clearTimeout(timeoutId);
            if (response.ok) return await response.json();
        } catch (err) {
            if (err.name === 'AbortError') console.warn("Timeout config buffer (2s): usando local default");
            else console.warn("Error config buffer:", err);
        }
    } catch (e) { console.error("Error crítico fetchBufferConfig:", e); }
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



    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
    const getArticulo = (sku) => String(sku || '').substring(0, 7);

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

    // 2. Mapeo de RESERVA (COORDENADAS: NIVEL, PRODUCTO, CANTIDAD)
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

    // 2. Consolidar: Sumar todo y asignar a la MEJOR fuente (Jerarquía: Pedidos > Otras > Replenish)
    let tempMap = {}; // sku -> { total: 0, bestSrc: null }
    const hierarchy = ['PEDIDOS', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];

    hierarchy.forEach(src => {
        rawDemand[src].forEach(item => {
            if (!tempMap[item.sku]) {
                tempMap[item.sku] = { total: 0, bestSrc: src };
            }
            tempMap[item.sku].total += item.qty;
            // No cambiamos bestSrc porque el primero que lo puso (según jerarquía) gana
        });
    });

    // 3. Convertir al formato final de 'demanda'
    let demanda = {};
    Object.keys(tempMap).forEach(sku => {
        const item = tempMap[sku];
        demanda[sku] = {
            total: item.total,
            sources: [{ src: item.bestSrc, qty: item.total }]
        };
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
        const sku7 = sku.trim().substring(0, 7);
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
        globalRQ += totalSolicitado;

        // 1. Descontamos lo que ya está en Activo (Zonas Bajas)
        let enActivo = totalActivoPorSKU[sku] || 0;
        let pending = totalSolicitado;
        
        let atdActivo = Math.min(pending, enActivo);
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

        // 2. Satisfacemos el resto siguiendo las jerarquías permitidas
        if (pending > 0) {
            pending = satisfyDemand(sku, pending, stAltos, nivelesMap['Alto']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stPisos, nivelesMap['Piso']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stAereos, nivelesMap['Aereo']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stLogicos, nivelesMap['Logico']);
            if (pending > 0) pending = satisfyDemand(sku, pending, stMerma, nivelesMap['Merma']);
            
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
        }
    });


    const calcPct = (a, r) => r > 0 ? ((a / r) * 100).toFixed(1) + '%' : '0%';

    let runningRQ = globalRQ;
    const waterfall = Object.keys(nivelesMap).map(k => {
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

    // Mapa de Stock Activo para columna QTY ACTIVO
    const activeStockMap = {};
    activo.forEach(f => {
        const rawF = Array.isArray(f) ? f : Object.values(f);
        let area = String(rawF[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (area === 'MATE') return; // EXCLUIR MATE SEGÚN INDICACIÓN
        
        let sku = String(rawF[1] || '').trim(); // SKU en Columna B (índice 1)
        let qty = parseFloat(rawF[4]) || 0;     // Cantidad en Columna E (índice 4)
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
                            detallePallets.push({ 
                                'FUENTE': dSrc.src,
                                'UBICACIONES': ubi, 
                                'LPN': item['LPN'], 
                                'SKU': sku, 
                                'Articulo': sku.substring(0,7),
                                'RQ': dSrc.qty,
                                'QTY ACTIVO': activeStockMap[sku] || 0,
                                'QTY RESERVA': qty, 
                                'QTY BUFFER': Math.round(attributedUnits)
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
    detallePallets = Array.from(consolidatedMap.values());

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
                    'Articulo': sku.substring(0,7),
                    'SKU': sku,
                    'RQ': 0,
                    'QTY ACTIVO': activeStockMap[sku] || 0,
                    'QTY RESERVA': parseFloat(f['CANTIDAD']) || 0,
                    'QTY BUFFER': 0
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
            const sku7 = sku.trim().substring(0, 7);
            const info = articulosMap.get(sku7);
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

        return {
            'Sku': sku,
            'RQ': d.total,
            'Qty Activo': enActivo,
            'Diferencia': diff,
            'Qty Reserva': enReserva
        };
    });

    // 5. RESUMEN SIN STOCK (ZONA 7)
    const sinStockRows = detalleZonas.filter(d => d['NIVEL/AREA'] === '7. SIN STOCK');
    const sinStockSummary = {
        skus: new Set(sinStockRows.map(d => String(d['SKU'] || d['Sku'] || d['sku'] || '').trim()).filter(x => x)).size,
        articulos: new Set(sinStockRows.map(d => {
            let val = d['ARTÍCULO'] || d['ARTICULO'] || d['SKU'] || d['Sku'] || d['sku'] || '';
            return String(val).trim().substring(0, 7);
        }).filter(x => x && x.length >= 5)).size,
        qty: sinStockRows.reduce((acc, d) => acc + (parseFloat(d['ATD RQ'] || d['ATD_RQ'] || 0) || 0), 0)
    };

    // 6. CONSOLIDACIÓN GLOBAL POR ARTÍCULO (Activo + Reserva)
    const stockGlobalPorArticulo = new Map();
    
    // Sumar Activo
    Object.keys(activeStockMap).forEach(sku => {
        const art = String(sku).substring(0, 7);
        if (!stockGlobalPorArticulo.has(art)) stockGlobalPorArticulo.set(art, 0);
        stockGlobalPorArticulo.set(art, stockGlobalPorArticulo.get(art) + (activeStockMap[sku] || 0));
    });
    
    // Sumar Reserva
    reserva.forEach(r => {
        const sku = String(getCol(r, ['PRODUCTO', 'Articulo', 'Producto', 'SKU']) || '').trim();
        const qty = parseFloat(getCol(r, ['CANTIDAD', 'Cant', 'Stock', 'Quantity']) || 0);
        const art = sku.substring(0, 7);
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
        timestamp: new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    };
};
