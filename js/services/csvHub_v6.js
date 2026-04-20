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
                  if(rowStr.includes('PRODUCTO') || rowStr.includes('ARTICULO')) {
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
        const response = await fetch(`${API_BASE}/buffer/config`);
        if (response.ok) return await response.json();
    } catch (e) { console.warn("No se pudo obtener config buffer", e); }
    return { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
};

export const calculateBufferPallets = (configOverride = null) => {
    const activo = dataStore.stockActivo;
    const reserva = dataStore.stockReserva;
    const pedidos = dataStore.buffer; 
    
    if(!activo || !reserva || !pedidos) return null;

    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
    const getArticulo = (sku) => String(sku || '').substring(0, 7);

    // Mapeo detallado de stock por SKU para cada nivel
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

    let demanda = {};
    pedidos.forEach(f => {
        let sku = String(getCol(f, ['Articulo', 'SKU', 'Codigo de articulo', 'Artículo']) || '').trim();
        let cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada', 'Cant. Solicitada'])) || 0;
        let asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada', 'Cant. Asignada'])) || 0;
        let diff = cant - asig;
        if (diff > 0 && sku) demanda[sku] = (demanda[sku] || 0) + diff;
    });

    let globalRQ = 0, atdBaja = 0, atdAlto = 0, atdPiso = 0, atdAereo = 0, atdLogico = 0;
    let detalleZonas = [], stockUsadoMap = new Map(), ubicacionesEnElPiso = new Set(), cuotasPicking = {};

    const satisfyDemand = (sku, pending, stockMap, nivelLabel, counterRef) => {
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
                    'RQ': (pending === demanda[sku]) ? pending : 0,
                    'ATD RQ': pick
                });

                if (nivelLabel === 'Alto' || nivelLabel === 'Aereo') {
                    ubicacionesEnElPiso.add(ubi);
                    if (!cuotasPicking[ubi]) cuotasPicking[ubi] = {};
                    cuotasPicking[ubi][sku] = (cuotasPicking[ubi][sku] || 0) + pick;
                }

                stockUsadoMap.set(id, uses + pick);
                counterRef.val += pick;
                pending -= pick;
            }
        }
        return pending;
    };

    Object.keys(demanda).sort().forEach(sku => {
        let initialRQ = demanda[sku];
        let pending = initialRQ;
        globalRQ += initialRQ;

        let wrapBaja = { val: 0 };
        pending = satisfyDemand(sku, pending, stBajas, 'Zonas Bajas', wrapBaja);
        atdBaja += wrapBaja.val;

        let wrapAlto = { val: 0 };
        pending = satisfyDemand(sku, pending, stAltos, 'Alto', wrapAlto);
        atdAlto += wrapAlto.val;

        let wrapPiso = { val: 0 };
        pending = satisfyDemand(sku, pending, stPisos, 'Pisos', wrapPiso);
        atdPiso += wrapPiso.val;

        let wrapAereo = { val: 0 };
        pending = satisfyDemand(sku, pending, stAereos, 'Aereo', wrapAereo);
        atdAereo += wrapAereo.val;

        let wrapLogico = { val: 0 };
        pending = satisfyDemand(sku, pending, stLogicos, 'Logica', wrapLogico);
        atdLogico += wrapLogico.val;
    });

    let detallePallets = [];
    Array.from(ubicacionesEnElPiso).forEach(ubi => {
        let items = reserva.filter(f => String(f['UBICACION']).trim() === ubi);
        items.forEach(item => {
            let sku = String(getCol(item, ['PRODUCTO', 'Articulo', 'Producto']) || '').trim();
            let qty = parseFloat(item['CANTIDAD'] || 0);
            let pick = (cuotasPicking[ubi] && cuotasPicking[ubi][sku]) ? cuotasPicking[ubi][sku] : 0;
            if (pick > 0) {
                detallePallets.push({ 'UBICACIONES': ubi, 'LPN': item['LPN'], 'SKU': sku, 'QTY ACTIVO': 0, 'QTY RESERVA': qty, 'QTY BUFFER': pick });
            }
        });
    });

    const calcPct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(2) + '%' : '0.00%';
    let waterfall = [
        { nivel: '1. Zonas Bajas', rq: globalRQ, atd: atdBaja, pct: calcPct(atdBaja, globalRQ) },
        { nivel: '2. Alto', rq: globalRQ - atdBaja, atd: atdAlto, pct: calcPct(atdAlto, globalRQ - atdBaja) },
        { nivel: '3. Pisos', rq: globalRQ - atdBaja - atdAlto, atd: atdPiso, pct: calcPct(atdPiso, globalRQ - atdBaja - atdAlto) },
        { nivel: '4. Aereo', rq: globalRQ - atdBaja - atdAlto - atdPiso, atd: atdAereo, pct: calcPct(atdAereo, globalRQ - atdBaja - atdAlto - atdPiso) },
        { nivel: '5. Logica', rq: globalRQ - atdBaja - atdAlto - atdPiso - atdAereo, atd: atdLogico, pct: calcPct(atdLogico, globalRQ - atdBaja - atdAlto - atdPiso - atdAereo) },
        { nivel: 'Total', rq: globalRQ, atd: atdBaja + atdAlto + atdPiso + atdAereo + atdLogico, pct: calcPct(atdBaja + atdAlto + atdPiso + atdAereo + atdLogico, globalRQ) }
    ];

    // =============================================
    // V10.5-Pulse: ANÁLISIS FORENSE (ZONAS 3, 4, 5)
    // =============================================
    const forensicZones = ['Pisos', 'Aereo', 'Logica'];
    const getArtInfo = (sku) => {
        if (!dataStore.articulos || !sku) return { gender: 'S/MAESTRO', marca: 'S/Maestro' };
        
        const clean = (s) => String(s || '').trim();
        const to7 = (s) => clean(s).substring(0, 7);
        
        // El usuario indica: pedidos(Código de articulo)[7] -> articulos(CodArticulo)
        const target7 = to7(sku);

        const row = dataStore.articulos.find(a => {
            const masterVal = clean(getCol(a, ['CodArticulo', 'Articulo', 'ARTICULO', 'SKU', 'Producto']));
            return clean(masterVal) === target7 || to7(masterVal) === target7;
        });

        if (!row) return { gender: 'NO ENCONTRADO', marca: 'No Encontrado' };

        return {
            gender: String(getCol(row, ['Genero', 'Gender', 'GÉNERO', 'Categoria']) || 'OTROS').toUpperCase(),
            marca: String(getCol(row, ['Marca', 'Brand', 'MARCA']) || 'Otros')
        };
    };

    const genderAggr = {}, marcaAggr = {};
    detalleZonas.filter(d => forensicZones.includes(d['NIVEL/AREA'])).forEach(d => {
        const info = getArtInfo(d.SKU);
        const atd = d['ATD RQ'] || 0;
        if (!genderAggr[info.gender]) genderAggr[info.gender] = { rq: 0, atd: 0 };
        genderAggr[info.gender].atd += atd;
        genderAggr[info.gender].rq += atd; // User wants only total ATD as RQ

        if (!marcaAggr[info.marca]) marcaAggr[info.marca] = { rq: 0, atd: 0 };
        marcaAggr[info.marca].atd += atd;
        marcaAggr[info.marca].rq += atd;
    });

    const formatForensic = (aggr) => {
        const rows = Object.keys(aggr).sort().map(k => ({ key: k, rq: aggr[k].rq }));
        if (rows.length > 0) {
            rows.push({ key: 'TOTAL', rq: rows.reduce((sum, r) => sum + r.rq, 0) });
        }
        return rows;
    };

    const empaque = { 'SolidPack': { paletas: new Set(), skus: new Set(), parcaja: 0 }, 'PreePack': { paletas: new Set(), skus: new Set(), parcaja: 0 } };
    detallePallets.forEach(r => {
        const tipo = r.SKU.length >= 14 ? 'PreePack' : 'SolidPack';
        empaque[tipo].paletas.add(r.UBICACIONES);
        empaque[tipo].skus.add(r.SKU);
        empaque[tipo].parcaja += r['QTY BUFFER'];
    });

    const resEmp = Object.keys(empaque).map(t => ({ tipo: t, paletas: empaque[t].paletas.size, skus: empaque[t].skus.size, parcaja: empaque[t].parcaja }));
    if (resEmp.length) resEmp.push({ tipo: 'TOTAL', paletas: new Set(detallePallets.map(d=>d.UBICACIONES)).size, skus: new Set(detallePallets.map(d=>d.SKU)).size, parcaja: resEmp.reduce((a,b)=>a+b.parcaja, 0) });

    return { 
        waterfall, 
        detalle: detallePallets, 
        detalleZonas, 
        resumenSKU: resEmp,
        resumenGender: formatForensic(genderAggr),
        resumenMarca: formatForensic(marcaAggr)
    };
};
