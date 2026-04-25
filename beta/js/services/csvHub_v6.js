// Almacenamiento en memoria CACHÉ para respuesta rápida UI
export const dataStore = {
  stockActivo: null,
  stockReserva: null,
  inventario: null,
  picking: null,
  packing: null,
  despacho: null,
  recepcion: null,
  almacenaje: null,
  buffer: null,
  solicitud: null,
  articulos: null,
  tallas: null
};

// =============================================
// OPTIMIZACIÓN: CACHÉ PERSISTENTE En localStorage
// =============================================
const LS_PREFIX = 'logistics_cache_';
const META_PREFIX = 'logistics_meta_'; // Almacenamiento pequeño para persistencia de fechas
const LS_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas de validez

const saveToLS = (area, data) => {
    const ts = Date.now();
    try {
        // NIVEL 1: Metadatos (Siempre se guardan, muy pequeños)
        localStorage.setItem(META_PREFIX + area, JSON.stringify({ ts }));
    } catch(e) { console.warn("Error guardando meta:", e); }

    try {
        // NIVEL 2: Datos (Pueden fallar si localStorage está lleno)
        localStorage.setItem(LS_PREFIX + area, JSON.stringify({ ts, data }));
    } catch(e) { console.warn("Quota Full: Datos no persistidos localmente para " + area); }
};

const loadFromLS = (area) => {
    try {
        const raw = localStorage.getItem(LS_PREFIX + area);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts > LS_TTL_MS) {
            localStorage.removeItem(LS_PREFIX + area);
            return null;
        }
        return parsed.data;
    } catch(e) { return null; }
};

export const getUploadMeta = (area) => {
    try {
        // Intentar recuperar de la tabla de metadatos primero
        const metaRaw = localStorage.getItem(META_PREFIX + area);
        if (metaRaw) return JSON.parse(metaRaw);

        // Fallback: intentar recuperar del caché de datos si el meta no existe
        const raw = localStorage.getItem(LS_PREFIX + area);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch(e) { return null; }
};

const clearLS = () => {
    Object.keys(dataStore).forEach(k => {
        localStorage.removeItem(LS_PREFIX + k);
        localStorage.removeItem(META_PREFIX + k);
    });
};

// Inicializar dataStore desde localStorage al cargar la app
(() => {
    Object.keys(dataStore).forEach(area => {
        const cached = loadFromLS(area);
        if (cached) dataStore[area] = cached;
    });
})();

// Control Trazabilidad: Fecha seleccionada (null = Fecha Actual/Más reciente)
export let currentDateFilter = null;

// URL MAESTRA DEL SERVIDOR (Punto de conexión)
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const SHARED_API = 'https://logistics-shared-api.onrender.com/api';
const VERSION = '11.1.14-pulse';
const CACHE_KEY = `logistics_v11_1_14_`;
const API_URL    = `${API_BASE}/logistics`;

export const setDateFilter = (newDateStr) => {
    if (currentDateFilter !== newDateStr) {
        currentDateFilter = newDateStr;
        // Limpiamos la memoria caché al viajar por el tiempo
        Object.keys(dataStore).forEach(k => dataStore[k] = null);
        clearLS();
    }
};

export const pingServer = () => {
    fetch(`${API_BASE}/health`, { method: 'GET' })
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
            headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch(`${SHARED_API}/buffer_report`);
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
        const res = await fetch(BUFFER_HISTORY_URL);
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
        const response = await fetch(`${API_URL}/dates`);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, action, details })
        });
    } catch (e) { console.error("Error al loguear acción:", e); }
};

// Helper para extraer columnas de forma robusta
const getCol = (row, possibleNames) => {
    if (!row) return null;
    const keys = Object.keys(row);
    const normalize = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const names = possibleNames.map(normalize);
    const foundKey = keys.find(k => names.includes(normalize(k)));
    return foundKey ? row[foundKey] : null;
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
          if (area === 'stockReserva') {
              // MODO QUIRÚRGICO: Salto fila 1 (Título) y 2 (Blanco). Fila 3 cabeceras.
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
              const deepClean = (s) => String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
              
              for (let i = 3; i < rows.length; i++) {
                  const row = rows[i];
                  if (!row || row.length < 2) continue;
                  jsonData.push({
                      'NIVEL': deepClean(row[1]),     // Columna B (index 1)
                      'PRODUCTO': deepClean(row[8]),  // Columna I (index 8)
                      'CANTIDAD': parseFloat(row[10]) || 0, // Columna K (index 10)
                      'UBICACION': deepClean(row[4]), // Columna E (index 4)
                      'LPN': deepClean(row[5]),       // Columna F (index 5)
                      'NRO AND': deepClean(row[2])    // Columna C (index 2)
                  });
              }
          } else {
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
              let headerIdx = 0;
              for(let i=0; i<Math.min(rows.length, 10); i++) {
                  const rowStr = JSON.stringify(rows[i]).toUpperCase();
                  if(rowStr.includes('PRODUCTO') || rowStr.includes('ARTICULO') || rowStr.includes('CODARTICULO')) {
                      headerIdx = i; break;
                  }
              }
              jsonData = XLSX.utils.sheet_to_json(sheet, { range: headerIdx, defval: "" });
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(response.ok) {
           dataStore[area] = payload;
           saveToLS(area, payload);
           await logSystemAction(username, 'SUBIDA_DATOS', `Área: ${area}. Registros: ${payload.length}`);
        } else {
           dataStore[area] = payload;
           saveToLS(area, payload);
        }
    } catch (err) {
        dataStore[area] = payload;
        saveToLS(area, payload);
    }
};

export const getAreaData = async (area) => {
  if (dataStore[area] !== null) return dataStore[area];
  const lsData = loadFromLS(area);
  if (lsData) { dataStore[area] = lsData; return lsData; }

  try {
     let queryURL = `${API_URL}/${area}`;
     if (currentDateFilter) queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
     const response = await fetch(queryURL);
     if (response.ok) {
         const serverResponse = await response.json();
         if (serverResponse.data) {
             dataStore[area] = serverResponse.data;
             saveToLS(area, serverResponse.data);
             return serverResponse.data;
         }
     }
  } catch (err) { console.warn(`Backend lento para '${area}'.`); }
  return null;
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
            const response = await fetch(`${API_BASE}/buffer/config`, { signal: controller.signal });
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
    const activo = dataStore.stockActivo;
    const reserva = dataStore.stockReserva;
    const pedidos = dataStore.buffer; 
    const solicitud = dataStore.solicitud; // OTRAS SOLICITUDES
    const tallas = dataStore.tallas;     // REPLENISHMENT
    const articulos = dataStore.articulos;
    
    if(!activo || !reserva || !pedidos) {
        console.error("[VALIDACIÓN] Datos base críticos incompletos.", { activo: !!activo, reserva: !!reserva, pedidos: !!pedidos });
        return null;
    }

    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
    const getArticulo = (sku) => String(sku || '').substring(0, 7);

    // Mapeo de Stock
    let stBajas = {}, stPisos = {}, stLogicos = {}, stAltos = {}, stAereos = {};
    const registerStock = (map, sku, qty, row) => {
        if (!map[sku]) map[sku] = [];
        map[sku].push({ qty, row });
    };

    activo.forEach(f => {
        let area = String(getCol(f, ['Area', 'Área', 'Ãrea']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Articulo', 'Artículo', 'ArtÃculo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
        if(!sku || qty <= 0) return;
        if (config.include_piso === '1' && (area === 'PISO' || area === 'CROSS')) registerStock(stPisos, sku, qty, f);
        else if (config.include_logico === '1' && area === 'DIS') registerStock(stLogicos, sku, qty, f);
        else if (config.include_reserva === '1') registerStock(stBajas, sku, qty, f);
    });

    reserva.forEach(f => {
        let nivel = String(getCol(f, ['Nivel', 'NIVEL']) || '').trim().toUpperCase();
        let nroAnd = String(getCol(f, ['NRO AND', 'Nro And']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Producto', 'PRODUCTO', 'Articulo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad', 'CANTIDAD'])) || 0;
        if(!sku || qty <= 0) return;
        if (config.include_alto === '1' && nivel === 'ALTO') registerStock(stAltos, sku, qty, f);
        else if (config.include_aereo === '1' && nivel === 'AEREO') registerStock(stAereos, sku, qty, f);
        else if (config.include_piso === '1' && nivel === 'CROSS') registerStock(stPisos, sku, qty, f);
        else if (config.include_logico === '1' && nivel === 'VER' && nroAnd === 'MZM-TR') registerStock(stLogicos, sku, qty, f);
    });

    // CONSOLIDACIÓN DE DEMANDA MULTI-FUENTE (CON JERARQUÍA)
    let demanda = {}; // sku -> { total: X, sources: [ {src, qty} ] }
    let processedSKUs = new Set();
    
    // 1. PRIORIDAD: PEDIDOS (CSV)
    pedidos.forEach(f => {
        let sku = String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo', 'Artículo']) || '').trim();
        let cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada', 'Cant. Solicitada'])) || 0;
        let asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada', 'Cant. Asignada'])) || 0;
        let diff = cant - asig;
        if (diff > 0 && sku) {
            if (!demanda[sku]) demanda[sku] = { total: 0, sources: [] };
            demanda[sku].total += diff;
            demanda[sku].sources.push({ src: 'PEDIDO', qty: diff });
            processedSKUs.add(sku); // Bloqueamos este SKU para fuentes de menor prioridad
        }
    });

    // 2. PRIORIDAD: OTRAS SOLICITUDES (XLSX)
    if (solicitud && solicitud.length) {
        solicitud.forEach(row => {
            const keys = Object.keys(row);
            const sku = String(row[keys[0]] || '').trim();
            const qty = parseFloat(row[keys[1]]) || 0;
            // Solo si no fue procesado por PEDIDOS
            if (sku && qty > 0 && !processedSKUs.has(sku)) {
                if (!demanda[sku]) demanda[sku] = { total: 0, sources: [] };
                demanda[sku].total += qty;
                demanda[sku].sources.push({ src: 'OTRAS SOLICITUDES', qty: qty });
                processedSKUs.add(sku); // Bloqueamos para REPLENISHMENT
            }
        });
    }

    // 3. PRIORIDAD: REPLENISHMENT (XLSX)
    if (tallas && tallas.length) {
        tallas.forEach(row => {
            const keys = Object.keys(row);
            const sku = String(row[keys[0]] || '').trim();
            const qty = parseFloat(row[keys[1]]) || 0;
            // Solo si no fue procesado por PEDIDOS ni OTRAS SOLICITUDES
            if (sku && qty > 0 && !processedSKUs.has(sku)) {
                if (!demanda[sku]) demanda[sku] = { total: 0, sources: [] };
                demanda[sku].total += qty;
                demanda[sku].sources.push({ src: 'REPLENISHMENT', qty: qty });
            }
        });
    }

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

                if (nivelLabel === 'Alto' || nivelLabel === 'Aereo') {
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
        let sku = String(getCol(f, ['Articulo', 'Artículo', 'ArtÃculo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
        if (sku) totalActivoPorSKU[sku] = (totalActivoPorSKU[sku] || 0) + qty;
    });

    // PROCESAMIENTO DE ANÁLISIS (SÓLO LO SOLICITADO - RQ)
    Object.keys(demanda).sort().forEach(sku => {
        let totalSolicitado = demanda[sku].total;
        globalRQ += totalSolicitado;

        // 1. Descontamos TODO lo que haya en Activo para este SKU
        let enActivo = totalActivoPorSKU[sku] || 0;
        
        // 2. Lo que realmente necesitamos bajar es: Pedido - Activo
        let realPending = Math.max(0, totalSolicitado - enActivo);

        // Actualizamos Waterfall para Zonas Bajas (lo que ya está ahí)
        if (!totalsByNivel['Zonas Bajas']) totalsByNivel['Zonas Bajas'] = 0;
        totalsByNivel['Zonas Bajas'] += Math.min(totalSolicitado, enActivo);

        // 3. Sólo si falta algo, buscamos en las zonas de reserva
        if (realPending > 0) {
            // No procesamos stBajas aquí porque ya lo descontamos arriba
            realPending = satisfyDemand(sku, realPending, stAltos, 'Alto');
            realPending = satisfyDemand(sku, realPending, stPisos, 'Pisos');
            realPending = satisfyDemand(sku, realPending, stAereos, 'Aereo');
            realPending = satisfyDemand(sku, realPending, stLogicos, 'Logica');
            
            // 4. Si aún queda pendiente, es "Sin Stock"
            if (realPending > 0) {
                detalleZonas.push({
                    'NIVEL/AREA': '6. Sin Stock',
                    'UBICACION': 'S/S',
                    'ARTÍCULO': getArticulo(sku),
                    'SKU': sku,
                    'ATD RQ': realPending
                });
            }
        }
    });

    // DISTRIBUCIÓN PROPORCIONAL DE PALETS POR FUENTE
    // (Para saber cuántos palets y SKUs corresponden a cada fuente)
    const empaqueAggr = {}; // { source: { type: { pal: Set, sku: Set, units: 0 } } }
    const sources = ['PEDIDO', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
    sources.forEach(s => {
        empaqueAggr[s] = {
            'SolidPack': { pal: new Set(), sku: new Set(), units: 0 },
            'PreePack': { pal: new Set(), sku: new Set(), units: 0 }
        };
    });

    // Mapa de Stock Activo para columna QTY ACTIVO
    const activeStockMap = {};
    activo.forEach(f => {
        let sku = String(getCol(f, ['Articulo', 'Artículo', 'ArtÃculo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
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
                            
                            // Atribución para resumen empaque
                            empaqueAggr[dSrc.src][tipo].pal.add(ubi);
                            empaqueAggr[dSrc.src][tipo].sku.add(sku);
                            empaqueAggr[dSrc.src][tipo].units += attributedUnits;
                        }
                    });
                } else {
                    // Caso borde: SKU sin demanda clara (no debería pasar)
                    detallePallets.push({ 
                        'FUENTE': 'DESCONOCIDO',
                        'UBICACIONES': ubi, 
                        'LPN': item['LPN'], 
                        'SKU': sku, 
                        'RQ': 0,
                        'QTY ACTIVO': activeStockMap[sku] || 0,
                        'QTY RESERVA': qty, 
                        'QTY BUFFER': pick 
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
        let hasData = false;

        ['SolidPack', 'PreePack'].forEach(t => {
            const data = empaqueAggr[s][t];
            if (data.sku.size > 0) {
                hasData = true;
                resEmp.push({ 
                    fuente: s, 
                    tipo: t, 
                    paletas: data.pal.size, 
                    skus: data.sku.size, 
                    parcaja: Math.round(data.units) 
                });
                data.pal.forEach(p => sourcePallets.add(p));
                data.sku.forEach(sk => sourceSkus.add(sk));
                sourceUnits += data.units;
            }
        });

        if (hasData) {
            resEmp.push({
                fuente: `TOTAL ${s}`,
                tipo: '---',
                paletas: sourcePallets.size,
                skus: sourceSkus.size,
                parcaja: Math.round(sourceUnits),
                isSubTotal: true
            });
        }
    });

    if (resEmp.length) {
        resEmp.push({ 
            fuente: 'TOTAL GENERAL', 
            tipo: '---', 
            paletas: new Set(detallePallets.map(d=>d.UBICACIONES)).size, 
            skus: new Set(detallePallets.map(d=>d.SKU)).size, 
            parcaja: Math.round(resEmp.filter(r=>r.isSubTotal).reduce((a,b)=>a+b.parcaja, 0)) 
        });
    }

    // 1. WATERFALL (RESUMEN POR NIVELES DESCENDENTE)
    const waterfall = [];
    const nivelesMap = {
        'Zonas Bajas': '1. Zonas Bajas',
        'Alto': '2. Alto',
        'Pisos': '3. Pisos',
        'Aereo': '4. Aereo',
        'Logica': '5. Logica'
    };
    const nivelesList = ['Zonas Bajas', 'Alto', 'Pisos', 'Aereo', 'Logica'];
    let runningRQ = globalRQ;
    let totalATD = 0;

    const calcPct = (a, r) => r > 0 ? ((a / r) * 100).toFixed(1) + '%' : '0%';

    nivelesList.forEach(nivel => {
        const atd = totalsByNivel[nivel] || 0;
        waterfall.push({
            nivel: nivelesMap[nivel],
            rq: Math.max(0, runningRQ),
            atd: atd,
            pct: calcPct(atd, runningRQ)
        });
        runningRQ -= atd;
        totalATD += atd;
    });

    // 6. Sin Stock (Lo que no se encontró en ninguna zona)
    if (runningRQ > 0) {
        waterfall.push({
            nivel: '6. Sin Stock',
            rq: runningRQ,
            atd: 0,
            pct: '0.0%',
            isOOS: true
        });
    }

    waterfall.push({ nivel: 'Total', rq: globalRQ, atd: totalATD, pct: calcPct(totalATD, globalRQ) });

    // 2. MATRIZ DE DISCREPANCIAS (MARCAS VS GÉNEROS - ZONAS 3,4,5)
    const forensicZones = ['Pisos', 'Aereo', 'Logica'];
    const getArtInfo = (sku) => {
        if (!articulos || !sku) return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        const clean = (s) => String(s || '').trim();
        const to7 = (s) => clean(s).substring(0, 7);
        const target7 = to7(sku);

        const row = articulos.find(a => {
            const masterVal = clean(getCol(a, ['CodArticulo', 'Articulo', 'ARTICULO', 'SKU', 'Producto', 'Codigo', 'Item']));
            return clean(masterVal) === target7 || to7(masterVal) === target7;
        });

        if (!row) return { gender: 'OTRO', marca: 'OTRO' };
        return {
            gender: String(getCol(row, ['Gender RIMS', 'Genero', 'Gender', 'Categoria', 'Division', 'Seccion', 'Sexo', 'GÉNERO', 'CATEGORÍA']) || 'OTROS').toUpperCase(),
            marca: String(getCol(row, ['Marcas', 'Marca', 'Brand', 'MARCA', 'Marca Comercial', 'Línea', 'LINEA', 'Fabricante']) || 'Otros')
        };
    };

    const matrixAggr = {};
    const genderKeys = new Set();
    
    detalleZonas.filter(d => forensicZones.includes(d['NIVEL/AREA'])).forEach(d => {
        const info = getArtInfo(d.SKU);
        const atd = d['ATD RQ'] || 0;
        genderKeys.add(info.gender);
        if (!matrixAggr[info.marca]) matrixAggr[info.marca] = {};
        if (!matrixAggr[info.marca][info.gender]) matrixAggr[info.marca][info.gender] = 0;
        matrixAggr[info.marca][info.gender] += atd;
    });

    const sortedGenders = Array.from(genderKeys).sort();
    const matrixRows = Object.keys(matrixAggr).sort().map(marca => {
        const row = { marca: marca, breakdown: {}, total: 0 };
        sortedGenders.forEach(g => {
            const val = matrixAggr[marca][g] || 0;
            row.breakdown[g] = val;
            row.total += val;
        });
        return row;
    });
    
    if (matrixRows.length > 0) {
        const totalRow = { marca: 'TOTAL', breakdown: {}, total: 0 };
        sortedGenders.forEach(g => {
            const sumG = matrixRows.reduce((acc, r) => acc + (r.breakdown[g] || 0), 0);
            totalRow.breakdown[g] = sumG;
            totalRow.total += sumG;
        });
        matrixRows.push(totalRow);
    }

    // 3. RESUMEN PARA HISTORIAL (3 FILAS POR PROCESO)
    const historyData = [];
    sources.forEach(s => {
        const sourceLvlAggr = {};
        detalleZonas.forEach(dz => {
            const demandObj = demanda[dz.SKU];
            if (demandObj) {
                const proportion = (demandObj.sources.find(ds => ds.src === s)?.qty || 0) / demandObj.total;
                if (proportion > 0) {
                    const ubi = dz.UBICACION;
                    const isPalletSource = ubicacionesEnElPiso.has(ubi);
                    const nivelLabel = dz['NIVEL/AREA'];
                    if (!sourceLvlAggr[nivelLabel]) sourceLvlAggr[nivelLabel] = { pal: new Set(), sku: new Set() };
                    if (isPalletSource) sourceLvlAggr[nivelLabel].pal.add(ubi);
                    sourceLvlAggr[nivelLabel].sku.add(dz.SKU);
                }
            }
        });

        Object.keys(sourceLvlAggr).forEach(lvl => {
            historyData.push({
                fuente: s,
                nivel: lvl,
                pal: sourceLvlAggr[lvl].pal.size,
                sku: sourceLvlAggr[lvl].sku.size
            });
        });
    });

    // 4. RESUMEN SKU DETALLE (Para pestaña Detalle y Sku Bajar)
    const resumenSKUDetalle = Object.keys(demanda).sort().map(sku => {
        const d = demanda[sku];
        const enActivo = totalActivoPorSKU[sku] || 0;
        const diff = Math.max(0, d.total - enActivo);
        
        // Calcular stock en reserva total (Altos + Pisos + Aereos + Logicos)
        let enReserva = 0;
        [stAltos, stPisos, stAereos, stLogicos].forEach(map => {
            if (map[sku]) enReserva += map[sku].reduce((acc, i) => acc + i.qty, 0);
        });

        return {
            'Sku': sku,
            'RQ': d.total,
            'Qty Activo': enActivo,
            'Diferencia': diff,
            'Qty Reserva': enReserva
        };
    });

    return { 
        detalle: detallePallets, 
        detalleZonas, 
        resumenSKU: resEmp,
        resumenSKUDetalle, // Nueva data para Excel
        resumenNiveles: historyData, 
        waterfall: waterfall,
        resumenMatrix: { columns: sortedGenders, rows: matrixRows }
    };
};
