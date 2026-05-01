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
const VERSION = '11.1.37-pulse';
const CACHE_KEY = `logistics_v12_1_21_`;
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
    // Normalización extrema: Quita acentos, barras (macrones), tildes y espacios
    const normalize = (s) => String(s || '').toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quita diacríticos
        .replace(/[^a-z0-9]/g, "")      // Deja solo letras y números
        .trim();
    
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
                      'NRO AND': dc(r[2])
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

export const clearAreaData = async (area, username = 'sistema') => {
    dataStore[area] = null;
    localStorage.removeItem(LS_PREFIX + area);
    localStorage.removeItem(META_PREFIX + area);
    
    try {
        // Enviar array vacío al servidor para "limpiar" la persistencia remota
        await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([])
        });
        await logSystemAction(username, 'LIMPIEZA_DATOS', `Área: ${area} vaciada por el usuario.`);
    } catch (e) {
        console.warn(`[PULSE] No se pudo limpiar el servidor para '${area}', se limpió solo local.`, e);
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
         if (serverResponse.data && Array.isArray(serverResponse.data) && serverResponse.data.length > 0) {
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
    
    if(!activo || !reserva) {
        console.error("[VALIDACIÓN] Datos base críticos incompletos.", { activo: !!activo, reserva: !!reserva });
        return null;
    }

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

    // CONSOLIDACIÓN DE DEMANDA MULTI-FUENTE (CON JERARQUÍA)
    let demanda = {}; // sku -> { total: X, sources: [ {src, qty} ] }
    let processedSKUs = new Set();
    
    // 1. PRIORIDAD: PEDIDOS (CSV)
    if (pedidos && pedidos.length) {
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
    }


    // 2. PRIORIDAD: OTRAS SOLICITUDES (XLSX)
    if (solicitud && solicitud.length) {
        solicitud.forEach(row => {
            const sku = String(getCol(row, ['Articulo', 'SKU', 'Codigo', 'CodArticulo', 'Producto']) || '').trim();
            const qty = parseFloat(getCol(row, ['Cantidad', 'QTY', 'Cant', 'Solicitado', 'Solicitada'])) || 0;
            if (sku && qty > 0) {
                if (!demanda[sku]) demanda[sku] = { total: 0, sources: [] };
                demanda[sku].total += qty;
                demanda[sku].sources.push({ src: 'OTRAS SOLICITUDES', qty: qty });
            }
        });
    }

    // 3. PRIORIDAD: REPLENISHMENT (XLSX)
    if (tallas && tallas.length) {
        tallas.forEach(row => {
            const sku = String(getCol(row, ['Articulo', 'SKU', 'Codigo', 'CodArticulo', 'Producto']) || '').trim();
            const qty = parseFloat(getCol(row, ['Cantidad', 'QTY', 'Cant', 'Solicitado', 'Solicitada'])) || 0;
            if (sku && qty > 0) {
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

                // RELLENAR DATOS PARA REPORTE SKU (Zonas que impactan paletas/buffer)
                if (nivelLabel.includes('2. ALTO') || nivelLabel.includes('3. PISOS') || nivelLabel.includes('4. AEREO')) {
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
        const possibleAreaHeaders = ['Ãrea', 'Area', 'Área', 'Ārea'];
        let areaRaw = getCol(f, possibleAreaHeaders);
        let area = String(areaRaw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
        const isLevel1 = activeWhitelist.some(w => area.includes(w));

        const possibleSkuHeaders = ['ArtÃculo', 'Articulo', 'Artículo', 'Sku'];
        const possibleQtyHeaders = ['Cantidad actual', 'Cantidad', 'Cant.'];
        let sku = String(getCol(f, possibleSkuHeaders) || '').trim();
        let qty = parseFloat(getCol(f, possibleQtyHeaders)) || 0;
        
        if (!sku || qty <= 0) return;

        if (isLevel1) {
            totalActivoPorSKU[sku] = (totalActivoPorSKU[sku] || 0) + qty;
        } else if (area === 'DIS' || area === 'VER' || area === 'PISO') {
            if (area === 'DIS' || area === 'PISO') {
                registerStock(stLogicos, sku, qty, f);
            } else if (area === 'VER') {
                let andVal = String(f['NRO AND'] || f['AND'] || '').trim().toUpperCase();
                if (andVal === 'MZM-TR') registerStock(stLogicos, sku, qty, f);
                else registerStock(stMerma, sku, qty, f);
            }
        }
    });

    const nivelesMap = {
        'Bajas': '1. ZONAS BAJAS',
        'Alto': '2. ALTO',
        'Piso': '3. PISOS',
        'Aereo': '4. AEREO',
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
        let area = String(getCol(f, ['Area', 'Área', 'Ãrea']) || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        // [MOD V12.1.21] DIS y VER ahora se muestran como stock en reportes pero restan de niveles superiores
        const validAreas = ['AND', 'CDBUFFER', 'MZN01', 'MZN02', 'MZN03', 'MZN04', 'PARED', 'SEL', 'DIS', 'VER'];
        if (!validAreas.some(w => area.includes(w))) return;
        
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
                    'QTY BUFFER': parseFloat(f['CANTIDAD']) || 0
                });
            }
        });
    }

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

    // 2. MATRIZ DE DISCREPANCIAS (OPTIMIZADO CON MAPA)
    const articulosMap = new Map();
    if (articulos && articulos.length) {
        articulos.forEach(a => {
            const rawValues = Object.values(a);
            // Coordenada exacta: Artículo en Columna B (index 1)
            const masterVal = String(rawValues[1] || '').trim();
            const sku7 = masterVal.substring(0, 7);
            
            if (sku7 && !articulosMap.has(sku7)) {
                // Coordenada exacta: Temporada en Columna J (index 9)
                const seasonVal = rawValues[9] || 'S/T';

                articulosMap.set(sku7, {
                    gender: String(getCol(a, ['Gender RIMS', 'Genero', 'Gender', 'Categoria', 'Division', 'Seccion', 'Sexo', 'GÉNERO', 'CATEGORÍA']) || 'OTROS').toUpperCase(),
                    marca: (() => {
                        let m = String(getCol(a, ['Marcas', 'Marca', 'Brand', 'MARCA', 'Marca Comercial', 'Línea', 'LINEA', 'Fabricante']) || 'Otros').trim();
                        if (m.toUpperCase().includes('BUBBLEGUMMERS LICENSES')) return 'BG Licenses';
                        if (m.toUpperCase().includes('BUBBLEGUMMERS')) return 'BG';
                        if (m.toUpperCase().includes('BATA INDUSTRIALS')) return 'Industrials';
                        if (m.toUpperCase().includes('11 NON COMMERCIAL COMPLEMENTS')) return '11 COMPLEMENTS';
                        return m;
                    })(),
                    temporada: String(seasonVal).trim()
                });
            }
        });
    }

    const getArtInfo = (sku) => {
        if (!sku) return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        const sku7 = sku.trim().substring(0, 7);
        return articulosMap.get(sku7) || { gender: 'OTRO', marca: 'OTRO' };
    };

    const buildMatrix = (filterFn) => {
        const aggr = {};
        const keys = new Set();
        detalleZonas.filter(filterFn).forEach(d => {
            const info = getArtInfo(d.SKU);
            const qty = d['ATD RQ'] || 0;
            keys.add(info.gender);
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

    const matrixResumen = buildMatrix(d => ['3. PISOS', '4. AEREO', '5. LÓGICO', '6. MERMA'].includes(d['NIVEL/AREA']));
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

    // [BETA] 6. CONSOLIDACIÓN GLOBAL POR ARTÍCULO (Activo + Reserva)
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

    // Generar Reporte Temporadas Q
    const aggrTemporadas = {};
    stockGlobalPorArticulo.forEach((qty, art) => {
        const info = articulosMap.get(art) || { temporada: 'S/MAESTRO' };
        const temp = info.temporada || 'S/MAESTRO';
        if (!aggrTemporadas[temp]) aggrTemporadas[temp] = 0;
        aggrTemporadas[temp] += qty;
    });

    const reporteTemporadasQ = Object.keys(aggrTemporadas).map(temp => ({
        'Temporada': temp,
        'Qty': Math.round(aggrTemporadas[temp])
    })).sort((a, b) => b.Qty - a.Qty);

    return { 
        version: 'v12.1.31-BETA',
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
        reporteTemporadasQ: reporteTemporadasQ
    };
};
