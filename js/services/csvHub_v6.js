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
// OPTIMIZACIÓN: CACHÉ PERSISTENTE EN localStorage
// =============================================
const LS_PREFIX = 'logistics_cache_';
const LS_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas de validez

const saveToLS = (area, data) => {
    try {
        localStorage.setItem(LS_PREFIX + area, JSON.stringify({ ts: Date.now(), data }));
    } catch(e) { /* cuota llena, ignorar */ }
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

const clearLS = () => {
    Object.keys(dataStore).forEach(k => localStorage.removeItem(LS_PREFIX + k));
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
const API_BASE   = "https://logistics-backend-wv0x.onrender.com/api";
const API_URL    = `${API_BASE}/logistics`;
const SHARED_API = `${API_BASE}/shared`;

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

export const saveBufferReport = async (bufferKPIObj, username = 'system') => {
    try {
        await fetch(`${SHARED_API}/buffer_report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: bufferKPIObj, updated_by: username })
        });
        console.log('✅ Reporte Buffer guardado en servidor.');
    } catch (e) {
        console.warn('⚠️ No se pudo guardar el reporte en servidor:', e);
    }
};

export const loadBufferReport = async () => {
    try {
        const res = await fetch(`${SHARED_API}/buffer_report`);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status === 'ok' && json.data) {
            console.log(`✅ Reporte Buffer cargado del servidor.`);
            return json.data;
        }
    } catch (e) {
        console.warn('⚠️ No se pudo cargar el reporte del servidor:', e);
    }
    return null;
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
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2, defval: "" });
          const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
          await persistToDatabase(area, json, session.username || 'sistema');
          resolve(json);
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
        const response = await fetch(`${API_BASE}/buffer/config`);
        if (response.ok) return await response.json();
    } catch (e) { console.warn("No se pudo obtener config buffer", e); }
    return { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
};

export const calculateBufferPallets = (configOverride = null) => {
    let activo = dataStore.stockActivo;
    let reserva = dataStore.stockReserva;
    let pedidos = dataStore.buffer; 
    
    if(!activo || !reserva || !pedidos) return null;

    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };

    let stBaja = {}, stPiso = {}, stLogico = {}, stAlto = {}, stAereo = {};

    activo.forEach(f => {
        let area = String(getCol(f, ['Area', 'Área', 'Ãrea']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Articulo', 'Artículo', 'ArtÃculo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad', 'Cant.'])) || 0;
        if(!sku || qty <= 0) return;
        if (config.include_piso === '1' && (area === 'PISO' || area === 'CROSS')) stPiso[sku] = (stPiso[sku] || 0) + qty;
        else if (config.include_logico === '1' && area === 'DIS') stLogico[sku] = (stLogico[sku] || 0) + qty;
        else if (config.include_reserva === '1') stBaja[sku] = (stBaja[sku] || 0) + qty;
    });

    reserva.forEach(f => {
        let nivel = String(getCol(f, ['Nivel', 'NIVEL']) || '').trim().toUpperCase();
        let nroAnd = String(getCol(f, ['NRO AND', 'Nro And']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Producto', 'PRODUCTO', 'Articulo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad', 'CANTIDAD'])) || 0;
        if(!sku || qty <= 0) return;
        if (config.include_alto === '1' && nivel === 'ALTO') stAlto[sku] = (stAlto[sku] || 0) + qty;
        else if (config.include_aereo === '1' && nivel === 'AEREO') stAereo[sku] = (stAereo[sku] || 0) + qty;
        else if (config.include_piso === '1' && nivel === 'CROSS') stPiso[sku] = (stPiso[sku] || 0) + qty;
        else if (config.include_logico === '1' && nivel === 'VER' && nroAnd === 'MZM-TR') stLogico[sku] = (stLogico[sku] || 0) + qty;
    });

    let demanda = {};
    pedidos.forEach(f => {
        let sku = String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo']) || '').trim();
        let cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada'])) || 0;
        let asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada'])) || 0;
        let diff = cant - asig;
        if (diff > 0 && sku) demanda[sku] = (demanda[sku] || 0) + diff;
    });

    const reservaPorSku = {};
    reserva.forEach(r => {
        let skuR = String(getCol(r, ['PRODUCTO', 'Articulo', 'Producto']) || '').trim();
        if (!reservaPorSku[skuR]) reservaPorSku[skuR] = [];
        reservaPorSku[skuR].push(r);
    });

    let globalRQ = 0, atdBaja = 0, atdAlto = 0, atdPiso = 0, atdAereo = 0, atdLogico = 0;
    let resumenSKU = [], stockUsadoMap = new Map(), ubicacionesEnElPiso = new Set(), cuotasPicking = {};

    Object.keys(demanda).sort().forEach(sku => {
        let pending = demanda[sku];
        globalRQ += pending;

        let pickedBaja = Math.min(pending, stBaja[sku] || 0);
        atdBaja += pickedBaja;
        pending -= pickedBaja;

        if (pending > 0 && reservaPorSku[sku]) {
            for (let r of reservaPorSku[sku]) {
                if (pending <= 0) break;
                let nivel = String(r['NIVEL'] || '').trim().toUpperCase();
                if (nivel !== 'ALTO') continue;
                let q = parseFloat(r['CANTIDAD'] || 0);
                let id = r._id || `${r.LPN}_${sku}_${r.UBICACION}`;
                let uses = stockUsadoMap.get(id) || 0;
                let avail = q - uses;
                if (avail > 0) {
                    let pick = Math.min(pending, avail);
                    pending -= pick;
                    atdAlto += pick;
                    stockUsadoMap.set(id, uses + pick);
                    let ubi = String(r['UBICACION']).trim();
                    ubicacionesEnElPiso.add(ubi);
                    if (!cuotasPicking[ubi]) cuotasPicking[ubi] = {};
                    cuotasPicking[ubi][sku] = (cuotasPicking[ubi][sku] || 0) + pick;
                }
            }
        }

        let pickedPiso = Math.min(pending, stPiso[sku] || 0);
        atdPiso += pickedPiso;
        pending -= pickedPiso;

        if (pending > 0 && reservaPorSku[sku]) {
            for (let r of reservaPorSku[sku]) {
                if (pending <= 0) break;
                let nivel = String(r['NIVEL'] || '').trim().toUpperCase();
                if (nivel !== 'AEREO') continue;
                let q = parseFloat(r['CANTIDAD'] || 0);
                let id = r._id || `${r.LPN}_${sku}_${r.UBICACION}`;
                let uses = stockUsadoMap.get(id) || 0;
                let avail = q - uses;
                if (avail > 0) {
                    let pick = Math.min(pending, avail);
                    pending -= pick;
                    atdAereo += pick;
                    stockUsadoMap.set(id, uses + pick);
                    let ubi = String(r['UBICACION']).trim();
                    ubicacionesEnElPiso.add(ubi);
                    if (!cuotasPicking[ubi]) cuotasPicking[ubi] = {};
                    cuotasPicking[ubi][sku] = (cuotasPicking[ubi][sku] || 0) + pick;
                }
            }
        }

        let pickedLogico = Math.min(pending, stLogico[sku] || 0);
        atdLogico += pickedLogico;
        pending -= pickedLogico;
    });

    let detallePallets = [];
    Array.from(ubicacionesEnElPiso).forEach(ubi => {
        let items = reserva.filter(f => String(f['UBICACION']).trim() === ubi);
        items.forEach(item => {
            let sku = String(getCol(item, ['PRODUCTO', 'Articulo', 'Producto']) || '').trim();
            let qty = parseFloat(item['CANTIDAD'] || 0);
            let pick = (cuotasPicking[ubi] && cuotasPicking[ubi][sku]) ? cuotasPicking[ubi][sku] : 0;
            detallePallets.push({ 'UBICACIONES': ubi, 'LPN': item['LPN'], 'SKU': sku, 'QTY ACTIVO': 0, 'QTY RESERVA': qty, 'QTY BUFFER': pick });
        });
    });

    const calcPct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(2) + '%' : '0.00%';
    let waterfall = [
        { nivel: '1. Zonas Bajas', rq: globalRQ, atd: atdBaja, pct: calcPct(atdBaja, globalRQ) },
        { nivel: '2. Alto', rq: globalRQ - atdBaja, atd: atdAlto, pct: calcPct(atdAlto, globalRQ - atdBaja) },
        { nivel: '3. Pisos', rq: globalRQ - atdBaja - atdAlto, atd: atdPiso, pct: calcPct(atdPiso, globalRQ - atdBaja - atdAlto) },
        { nivel: '4. Aereo', rq: globalRQ - atdBaja - atdAlto - atdPiso, atd: atdAereo, pct: calcPct(atdAereo, globalRQ - atdBaja - atdAlto - atdPiso) },
        { nivel: '5. Lógica', rq: globalRQ - atdBaja - atdAlto - atdPiso - atdAereo, atd: atdLogico, pct: calcPct(atdLogico, globalRQ - atdBaja - atdAlto - atdPiso - atdAereo) },
        { nivel: 'Total', rq: globalRQ, atd: atdBaja + atdAlto + atdPiso + atdAereo + atdLogico, pct: calcPct(atdBaja + atdAlto + atdPiso + atdAereo + atdLogico, globalRQ) }
    ];

    const empaque = {
        'SolidPack': { paletas: new Set(), skus: new Set(), parcaja: 0 },
        'PreePack': { paletas: new Set(), skus: new Set(), parcaja: 0 }
    };
    detallePallets.forEach(r => {
        const tipo = r.SKU.length >= 14 ? 'PreePack' : 'SolidPack';
        empaque[tipo].paletas.add(r.UBICACIONES);
        empaque[tipo].skus.add(r.SKU);
        empaque[tipo].parcaja += r['QTY BUFFER'];
    });

    const resEmp = Object.keys(empaque).map(t => ({ tipo: t, paletas: empaque[t].paletas.size, skus: empaque[t].skus.size, parcaja: empaque[t].parcaja }));
    if (resEmp.length) resEmp.push({ tipo: 'TOTAL', paletas: new Set(detallePallets.map(d=>d.UBICACIONES)).size, skus: new Set(detallePallets.map(d=>d.SKU)).size, parcaja: resEmp.reduce((a,b)=>a+b.parcaja, 0) });

    return { waterfall, detalle: detallePallets, resumenSKU: resEmp };
};
