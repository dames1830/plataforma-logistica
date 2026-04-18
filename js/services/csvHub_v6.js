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
  buffer: null
};

// =============================================
// OPTIMIZACIÓN: CACHÉ PERSISTENTE EN localStorage
// Evita re-descargar datos al refrescar la página
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

export const setDateFilter = (newDateStr) => {
    if (currentDateFilter !== newDateStr) {
        currentDateFilter = newDateStr;
        // Limpiamos la memoria caché al viajar por el tiempo
        Object.keys(dataStore).forEach(k => dataStore[k] = null);
        clearLS();
    }
};

// PING al servidor en background para despertarlo antes de que el usuario lo necesite
export const pingServer = () => {
    fetch('https://logistics-backend-wv0x.onrender.com/api/health', { method: 'GET' })
        .then(() => console.log('✅ Servidor backend activo.'))
        .catch(() => console.warn('⏳ Backend despertando (cold start Render)...'));
};

const SHARED_API = 'https://logistics-backend-wv0x.onrender.com/api/shared';

// ── Guardar reporte Buffer en el servidor (para sincronizar entre PCs) ──
export const saveBufferReport = async (bufferKPIObj, username = 'system') => {
    try {
        // Serializamos: los Sets ya están convertidos a arrays en resumenSKU
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

// ── Cargar reporte Buffer desde el servidor ──
export const loadBufferReport = async () => {
    try {
        const res = await fetch(`${SHARED_API}/buffer_report`);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status === 'ok' && json.data) {
            console.log(`✅ Reporte Buffer cargado del servidor (subido por ${json.updated_by} el ${json.updated_at}).`);
            return json.data;
        }
    } catch (e) {
        console.warn('⚠️ No se pudo cargar el reporte del servidor:', e);
    }
    return null;
};

// Traer las fechas históricas disponibles en el servidor
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

// URL MAESTRA DEL SERVIDOR (Punto de conexión)
const API_BASE = "https://logistics-backend-wv0x.onrender.com/api";
const API_URL  = `${API_BASE}/logistics`;

export const parseFile = (file, area) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject('Archivo inválido');
    
    // Al subir nueva data, forzamos regresar al día "Actual" para verla
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
                 const user = JSON.parse(localStorage.getItem('user') || '{}');
                 await persistToDatabase(area, results.data, user.username || 'sistema');
                 resolve(results.data);
             } catch(dbErr) {
                 reject('Error Servidor: ' + dbErr.message);
             }
          }
        },
        error: function(err) { reject('PapaParse Error: ' + err); }
      });
    } else if (file.name.toLowerCase().endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { range: 2, defval: "" });
          
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          await persistToDatabase(area, json, user.username || 'sistema');
          resolve(json);
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      reject('Formato de archivo no soportado. Usa CSV o XLSX.');
    }
  });
};

export const parseBufferFiles = async (files) => {
    let combinedData = [];
    
    setDateFilter(null); // Al subir forzamos regresar a la fecha más reciente
    
    // Parseamos cada archivo manualmente
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
    
    // Subimos la carga ensamblada al servidor como un solo paquete
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await persistToDatabase('buffer', combinedData, user.username || 'sistema');
    dataStore['buffer'] = combinedData;
    return combinedData;
};

// Función Interna: Enviar data fuerte al Servidor Python SQL
const persistToDatabase = async (area, payload, username = 'sistema') => {
    try {
        const response = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(response.ok) {
           dataStore[area] = payload;
           saveToLS(area, payload); // Persistir en localStorage
           await logSystemAction(username, 'SUBIDA_DATOS', `Área: ${area}. Registros: ${payload.length}`);
        } else {
           console.error("Fallo guardando en servidor DB.");
           // Guardar igual localmente como fallback
           dataStore[area] = payload;
           saveToLS(area, payload);
        }
    } catch (err) {
        console.error("Error de Red, guardando solo localmente.", err);
        dataStore[area] = payload;
        saveToLS(area, payload);
    }
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

// Función Asíncrona: Preguntar a la BD maestra por los datos
export const getAreaData = async (area) => {
  // 1. Prioridad: Memoria RAM
  if (dataStore[area] !== null) return dataStore[area];

  // 2. Prioridad: LocalStorage
  const lsData = loadFromLS(area);
  if (lsData) {
      dataStore[area] = lsData;
      return lsData;
  }

  // 3. Prioridad: Servidor
  try {
     let queryURL = `${API_URL}/${area}`;
     if (currentDateFilter) queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
     
     const response = await fetch(queryURL, { signal: AbortSignal.timeout(6000) });
     if (response.ok) {
         const serverResponse = await response.json();
         if (serverResponse.data && serverResponse.data.length > 0) {
             dataStore[area] = serverResponse.data;
             saveToLS(area, serverResponse.data);
             return dataStore[area];
         }
     }
  } catch (err) {
      console.warn(`Backend lento o inactivo para '${area}'.`);
  }
  
  return null;
};

export const generateKPIs = (data, area) => {
  if(!data || !data.length) return null;
  const totalRecords = data.length;
  let completed = 0;
  let pending = 0;

  data.forEach(row => {
     let lowerStr = JSON.stringify(row).toLowerCase();
     if(lowerStr.includes('completado') || lowerStr.includes('disponible') || lowerStr.includes('enviado') || lowerStr.includes('ok')) {
        completed++;
     } else if (lowerStr.includes('pendiente') || lowerStr.includes('proceso') || lowerStr.includes('faltante') || lowerStr.includes('asignada')) {
        pending++; // 'asignada' suele implicar reserva no despachada
     }
  });

  return {
    totalRecords,
    completed,
    pending,
    successRate: totalRecords ? Math.round((completed / totalRecords) * 100) : 0
  };
};

export const fetchBufferConfig = async () => {
    try {
        const response = await fetch(`${API_BASE}/buffer/config`);
        if (response.ok) return await response.json();
    } catch (e) { console.warn("No se pudo obtener la configuración del buffer", e); }
    return {
        include_reserva: '1', include_alto: '1', include_piso: '1', 
        include_aereo: '1', include_logico: '1'
    };
};

export const calculateBufferPallets = (configOverride = null) => {
    let activo = dataStore.stockActivo;
    let reserva = dataStore.stockReserva;
    let pedidos = dataStore.buffer; 
    
    // Validar que EXISTAN y tengan datos ([] es truthy en JS!)
    if(!activo || !activo.length || !reserva || !reserva.length || !pedidos || !pedidos.length) {
        console.warn('⚠️ calculateBufferPallets: Datos insuficientes →', {
            activo: activo ? activo.length : 'null',
            reserva: reserva ? reserva.length : 'null',
            pedidos: pedidos ? pedidos.length : 'null'
        });
        return null;
    }

    // DIAGNÓSTICO: Mostrar las columnas de cada fuente para detectar desajustes
    console.log('🔍 Columnas Stock Activo:', Object.keys(activo[0]));
    console.log('🔍 Columnas Stock Reserva:', Object.keys(reserva[0]));
    console.log('🔍 Columnas Pedidos:', Object.keys(pedidos[0]));

    // Configuración por defecto si no se pasa nada
    const config = configOverride || {
        include_reserva: '1', include_alto: '1', include_piso: '1', 
        include_aereo: '1', include_logico: '1'
    };

    // 1. Indexación del Almacén Físico Global
    let stBaja = {};
    let stPiso = {};
    let stLogico = {};
    let stAlto = {};
    let stAereo = {};

    activo.forEach(filaVal => {
        let areaRaw = String(filaVal['Ãrea'] || filaVal['Área'] || filaVal['Area'] || '').trim().toUpperCase();
        let sku = String(filaVal['ArtÃculo'] || filaVal['Artículo'] || filaVal['Articulo'] || '').trim();
        let qty = parseFloat(filaVal['Cantidad actual']) || 0;
        
        if(!sku || qty <= 0) return;
        
        if (config.include_piso === '1' && (areaRaw === 'PISO' || areaRaw === 'CROSS')) {
            stPiso[sku] = (stPiso[sku] || 0) + qty;
        } else if (config.include_logico === '1' && areaRaw === 'DIS') {
            stLogico[sku] = (stLogico[sku] || 0) + qty;
        } else {
            // Zonas Bajas (Cualquier área regular)
            if (config.include_reserva === '1') {
                stBaja[sku] = (stBaja[sku] || 0) + qty;
            }
        }
    });

    reserva.forEach(filaVal => {
        let nivelRaw = String(filaVal['NIVEL'] || filaVal['Nivel'] || '').trim().toUpperCase();
        let nroAnd = String(filaVal['NRO AND'] || filaVal['Nro And'] || filaVal['nro and'] || '').trim().toUpperCase();
        let sku = String(filaVal['PRODUCTO'] || filaVal['Producto'] || filaVal['ARTICULO'] || filaVal['ArtÃculo'] || filaVal['Artículo'] || filaVal['Articulo'] || '').trim();
        let qty = parseFloat(filaVal['CANTIDAD'] || filaVal['Cantidad actual'] || filaVal['Cantidad'] || filaVal['cantidad']) || 0;

        if(!sku || qty <= 0) return;

        if (config.include_alto === '1' && nivelRaw === 'ALTO') {
            stAlto[sku] = (stAlto[sku] || 0) + qty;
        } else if (config.include_aereo === '1' && nivelRaw === 'AEREO') {
            stAereo[sku] = (stAereo[sku] || 0) + qty;
        } else if (config.include_piso === '1' && nivelRaw === 'CROSS') {
            stPiso[sku] = (stPiso[sku] || 0) + qty;
        } else if (config.include_logico === '1' && nivelRaw === 'VER' && nroAnd === 'MZM-TR') {
            stLogico[sku] = (stLogico[sku] || 0) + qty;
        }
    });

    // 2. Extracción y Consolidación de Pedidos
    let demandaConsolidada = {};
    pedidos.forEach(filaP => {
        let skuP = String(filaP['CÃ³digo de artÃculo'] || filaP['Código de artículo'] || '').trim();
        let cantPedida = parseFloat(filaP['Cantidad solicitada']) || 0;
        let cantAsignada = parseFloat(filaP['Cantidad asignada']) || 0;
        let faltanteLocal = cantPedida - cantAsignada;
        
        if (faltanteLocal <= 0 || !skuP) return;
        demandaConsolidada[skuP] = (demandaConsolidada[skuP] || 0) + faltanteLocal;
    });

    // 3. Acumuladores de Cascada (Waterfall)
    let globalRQ = 0;
    let atdBaja = 0;
    let atdAlto = 0;
    let atdPiso = 0;
    let atdAereo = 0;
    let atdLogico = 0;

    let detallePallets = [];
    
    // Pre-ordenar Reserva para ruta de montacargas determinista (Ubicación -> SKU -> LPN)
    let reservaRuta = [...reserva].sort((a, b) => {
        let uA = String(a['UBICACION'] || '').trim();
        let uB = String(b['UBICACION'] || '').trim();
        if (uA !== uB) return uA.localeCompare(uB);
        
        let sA = String(a['PRODUCTO'] || a['ARTICULO'] || '').trim();
        let sB = String(b['PRODUCTO'] || b['ARTICULO'] || '').trim();
        if (sA !== sB) return sA.localeCompare(sB);
        
        return String(a['LPN'] || '').localeCompare(String(b['LPN'] || ''));
    });

    let ubicacionesEnElPiso = new Set();
    let cuotasPicking = {}; // Mapa para órdenes de extracción
    let stockUsadoMap = new Map(); // Mapa local para evitar efectos secundarios en dataStore

    // 4. Simulación de ruta CRUZANDO LA DEMANDA CONSOLIDADA VS STOCK FÍSICO (Ordenado para determinismo)
    Object.keys(demandaConsolidada).sort().forEach(skuP => {
        let faltanteTotalSinergia = demandaConsolidada[skuP];
        globalRQ += faltanteTotalSinergia;

        // Cascada 1: Zonas Bajas
        let p1 = Math.min(faltanteTotalSinergia, stBaja[skuP] || 0);
        atdBaja += p1;
        faltanteTotalSinergia -= p1;

        // Cascada 2: Alta (Rastreo Físico de Paletas)
        if (faltanteTotalSinergia > 0) {
            let cuotaAltoTeorico = Math.min(faltanteTotalSinergia, stAlto[skuP] || 0);
            let needed = cuotaAltoTeorico;
            let actuallyPickedAlto = 0;
            
            for (let r of reservaRuta) {
                if (needed <= 0) break;
                
                let nivelR = String(r['NIVEL'] || r['Nivel'] || '').trim().toUpperCase();
                let skuR = String(r['PRODUCTO'] || r['Producto'] || r['ARTICULO'] || r['ArtÃculo'] || r['Artículo'] || r['Articulo'] || '').trim();
                let qtyR = parseFloat(r['CANTIDAD'] || r['Cantidad actual'] || r['Cantidad'] || r['cantidad']) || 0;
                
                // Usamos el ID de la fila o LPN+SKU+UBI para rastrear uso local
                let rowId = r._id || `${r.LPN || ''}_${skuR}_${r.UBICACION || ''}`;
                let pickeadoMismaPaleta = stockUsadoMap.get(rowId) || 0;
                let available = qtyR - pickeadoMismaPaleta;
                
                if (nivelR === 'ALTO' && skuR === skuP && available > 0) {
                    let pick = Math.min(needed, available);
                    needed -= pick;
                    actuallyPickedAlto += pick;
                    stockUsadoMap.set(rowId, pickeadoMismaPaleta + pick);
                    let ubiRaw = String(r['UBICACION'] || '').trim();
                    ubicacionesEnElPiso.add(ubiRaw);
                    if (!cuotasPicking[ubiRaw]) cuotasPicking[ubiRaw] = {};
                    cuotasPicking[ubiRaw][skuP] = (cuotasPicking[ubiRaw][skuP] || 0) + pick;
                }
            }
            faltanteTotalSinergia -= actuallyPickedAlto;
        }

        let p3 = Math.min(faltanteTotalSinergia, stPiso[skuP] || 0);
        faltanteTotalSinergia -= p3;

        let actuallyPickedAereo = 0;
        if (faltanteTotalSinergia > 0) {
            let neededAe = Math.min(faltanteTotalSinergia, stAereo[skuP] || 0);
            for (let r of reservaRuta) {
                if (neededAe <= 0) break;
                let nivelR = String(r['NIVEL'] || r['Nivel'] || '').trim().toUpperCase();
                let skuR = String(r['PRODUCTO'] || r['Producto'] || r['ARTICULO'] || r['ArtÃculo'] || r['Artículo'] || r['Articulo'] || '').trim();
                let qtyR = parseFloat(r['CANTIDAD'] || r['Cantidad actual'] || r['Cantidad'] || r['cantidad']) || 0;
                let rowIdAe = r._id || `${r.LPN || ''}_${skuR}_${r.UBICACION || ''}`;
                let pickeadoMismaPaletaAe = stockUsadoMap.get(rowIdAe) || 0;
                let availableAe = qtyR - pickeadoMismaPaletaAe;
                if (nivelR === 'AEREO' && skuR === skuP && availableAe > 0) {
                    let pickAe = Math.min(neededAe, availableAe);
                    neededAe -= pickAe;
                    actuallyPickedAereo += pickAe;
                    stockUsadoMap.set(rowIdAe, pickeadoMismaPaletaAe + pickAe);
                    let ubiRawAe = String(r['UBICACION'] || '').trim();
                    ubicacionesEnElPiso.add(ubiRawAe);
                    if (!cuotasPicking[ubiRawAe]) cuotasPicking[ubiRawAe] = {};
                    cuotasPicking[ubiRawAe][skuP] = (cuotasPicking[ubiRawAe][skuP] || 0) + pickAe;
                }
            }
            faltanteTotalSinergia -= actuallyPickedAereo;
        }

        let p5 = Math.min(faltanteTotalSinergia, stLogico[skuP] || 0);
        faltanteTotalSinergia -= p5;

        resumenSKU.push({ sku: skuP, total: demandaConsolidada[skuP], baja: p1, alto: actuallyPickedAlto, piso: p3, aereo: actuallyPickedAereo, logico: p5, faltante: faltanteTotalSinergia });
    });

    let atdBaja = resumenSKU.reduce((sum, r) => sum + r.baja, 0);
    let atdAlto = resumenSKU.reduce((sum, r) => sum + r.alto, 0);
    let atdPiso = resumenSKU.reduce((sum, r) => sum + r.piso, 0);
    let atdAereo = resumenSKU.reduce((sum, r) => sum + r.aereo, 0);
    let atdLogico = resumenSKU.reduce((sum, r) => sum + r.logico, 0);
    let totalRQ_Global = Object.values(demandaConsolidada).reduce((a, b) => a + b, 0);
    let totalATD_Global = atdBaja + atdAlto + atdPiso + atdAereo + atdLogico;

    const reservaMapByUbi = {};
    reserva.forEach(f => {
        const u = String(f['UBICACION'] || '').trim();
        if (!reservaMapByUbi[u]) reservaMapByUbi[u] = [];
        reservaMapByUbi[u].push(f);
    });

    let detallePallets = [];
    Array.from(ubicacionesEnElPiso).forEach(ubi => {
        let inquilinosMadera = reservaMapByUbi[ubi] || [];
        let skusEnEstaMadera = {};
        inquilinosMadera.forEach(inquilino => {
            let colSku = String(inquilino['PRODUCTO'] || inquilino['Producto'] || inquilino['ARTICULO'] || inquilino['ArtÃculo'] || inquilino['Artículo'] || inquilino['Articulo'] || '').trim();
            let colQty = parseFloat(inquilino['CANTIDAD'] || inquilino['Cantidad actual'] || inquilino['Cantidad'] || inquilino['cantidad']) || 0;
            let colLpn = String(inquilino['LPN'] || '').trim();
            if (!skusEnEstaMadera[colSku]) skusEnEstaMadera[colSku] = { qty: 0, lpn: colLpn };
            skusEnEstaMadera[colSku].qty += colQty;
        });
        Object.keys(skusEnEstaMadera).forEach(colSku => {
            let dataG = skusEnEstaMadera[colSku];
            let bufferPick = (cuotasPicking[ubi] && cuotasPicking[ubi][colSku]) ? cuotasPicking[ubi][colSku] : 0;
            detallePallets.push({ 'UBICACIONES': ubi, 'LPN': dataG.lpn, 'SKU': colSku, 'QTY ACTIVO': Math.floor(stBaja[colSku] || 0), 'QTY RESERVA': dataG.qty, 'QTY BUFFER': bufferPick, 'ARTICULO': colSku.split('-')[0] });
        });
    });

    // Sincronización Matemática (V3)
    const atd_Alto_Total = detallePallets.reduce((acc, r) => {
        // Encontrar nivel de la ubicación original
        const u = String(r['UBICACIONES']).toUpperCase();
        const niv = (reserva.find(f => String(f['UBICACION']).toUpperCase() === u) || {})['NIVEL'] || '';
        return (niv.toUpperCase() === 'ALTO') ? acc + Number(r['QTY BUFFER']) : acc;
    }, 0);

    const atd_Aereo_Total = detallePallets.reduce((acc, r) => {
        const u = String(r['UBICACIONES']).toUpperCase();
        const niv = (reserva.find(f => String(f['UBICACION']).toUpperCase() === u) || {})['NIVEL'] || '';
        return (niv.toUpperCase() === 'AEREO') ? acc + Number(r['QTY BUFFER']) : acc;
    }, 0);

    const atd_Baja_X = resumenSKU.reduce((s, r) => s + (r.baja || 0), 0);
    const atd_Piso_X = resumenSKU.reduce((s, r) => s + (r.piso || 0), 0);
    const atd_Logico_X = resumenSKU.reduce((s, r) => s + (r.logico || 0), 0);

    const total_atd_fisico = atd_Baja_X + atd_Alto_Total + atd_Piso_X + atd_Aereo_Total + atd_Logico_X;
    const calcPctVal = (a, b) => b > 0 ? ((a / b) * 100).toFixed(2) + '%' : '0.00%';

    let waterfallV3 = [
        { nivel: '1. Zonas Bajas', rq: totalRQ_Global, atd: atd_Baja_X, pct: calcPctVal(atd_Baja_X, totalRQ_Global) },
        { nivel: '2. Alto', rq: totalRQ_Global - atd_Baja_X, atd: atd_Alto_Total, pct: calcPctVal(atd_Alto_Total, totalRQ_Global - atd_Baja_X) },
        { nivel: '3. Pisos', rq: totalRQ_Global - atd_Baja_X - atd_Alto_Total, atd: atd_Piso_X, pct: calcPctVal(atd_Piso_X, totalRQ_Global - atd_Baja_X - atd_Alto_Total) },
        { nivel: '4. Aereo', rq: totalRQ_Global - atd_Baja_X - atd_Alto_Total - atd_Piso_X, atd: atd_Aereo_Total, pct: calcPctVal(atd_Aereo_Total, totalRQ_Global - atd_Baja_X - atd_Alto_Total - atd_Piso_X) },
        { nivel: '5. Lógicas', rq: totalRQ_Global - atd_Baja_X - atd_Alto_Total - atd_Piso_X - atd_Aereo_Total, atd: atd_Logico_X, pct: calcPctVal(atd_Logico_X, totalRQ_Global - atd_Baja_X - atd_Alto_Total - atd_Piso_X - atd_Aereo_Total) },
        { nivel: 'Total', rq: totalRQ_Global, atd: total_atd_fisico, pct: calcPctVal(total_atd_fisico, totalRQ_Global) }
    ];

    // Resumen por Empaque (Tabla 2) - Forzar cuadre con detalle
    const empaqueData = {};
    detallePallets.forEach(row => {
        const sku = String(row['SKU']).trim();
        const tipo = (sku.length >= 14 || sku.includes('-')) ? 'PreePack' : 'SolidPack';
        if (!empaqueData[tipo]) empaqueData[tipo] = { paletas: new Set(), skus: new Set(), parcaja: 0 };
        empaqueData[tipo].paletas.add(String(row['UBICACIONES']));
        empaqueData[tipo].skus.add(sku);
        empaqueData[tipo].parcaja += Number(row['QTY BUFFER']);
    });

    const resumenEmpaque = Object.keys(empaqueData).map(t => ({
        tipo: t,
        paletas: empaqueData[t].paletas.size,
        skus: empaqueData[t].skus.size,
        parcaja: empaqueData[t].parcaja
    }));

    if (resumenEmpaque.length > 0) {
        resumenEmpaque.push({
            tipo: 'TOTAL',
            paletas: new Set(detallePallets.map(r => r['UBICACIONES'])).size,
            skus: new Set(detallePallets.map(r => r['SKU'])).size,
            parcaja: resumenEmpaque.reduce((a, b) => a + b.parcaja, 0)
        });
    }

    return {
        waterfall: waterfallV3,
        detalle:   detallePallets,
        resumenSKU: resumenEmpaque
    };
};


