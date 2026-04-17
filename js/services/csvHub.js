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
    fetch('https://logistics-backend-wv0x.onrender.com/api/logs?username=_ping', { method: 'GET' })
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
// Al estar en local tu computadora solía conectarse con:
// const API_URL = "http://127.0.0.1:8000/api/logistics";

// Producción Mundial - Servidor Nube:
const API_URL = "https://logistics-backend-wv0x.onrender.com/api/logistics";

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
                 const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
                 await persistToDatabase(area, results.data, session.username);
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
          
          await persistToDatabase(area, json);
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
    const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
    await persistToDatabase('buffer', combinedData, session.username);
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
        await fetch(`${API_URL.replace('/logistics', '/logs')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, action, details })
        });
    } catch (e) { console.error("Error al loguear acción:", e); }
};

// Función Asíncrona: Preguntar a la BD maestra por los datos, si no tiene, usa nulo
export const getAreaData = async (area) => {
  // Si la data del área ya fue descargada y alojada en la memoria caché RAM, usar esa
  // ¡Esto evita descargar Megabytes redundantes por HTTP cada vez que cambias de pestaña!
  if (dataStore[area] !== null) {
      return dataStore[area];
  }

  try {
     let queryURL = `${API_URL}/${area}`;
     if (currentDateFilter) {
         queryURL += `?date=${encodeURIComponent(currentDateFilter)}`;
     }
     
     const response = await fetch(queryURL, { signal: AbortSignal.timeout(8000) });
     if (response.ok) {
         const serverResponse = await response.json();
         if (serverResponse.data && serverResponse.data.length > 0) {
             dataStore[area] = serverResponse.data;
             saveToLS(area, serverResponse.data); // Persistir para próxima vez
             return dataStore[area];
         }
     }
  } catch (err) {
      console.warn(`Backend lento o inactivo para '${area}'. Usando caché local.`);
  }
  
  // Último recurso: buscar en localStorage aunque no esté en RAM
  if (!dataStore[area]) {
      const lsData = loadFromLS(area);
      if (lsData) dataStore[area] = lsData;
  }
  return dataStore[area];
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
        const response = await fetch(`${API_URL.replace('/logistics', '/buffer/config')}`);
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
    
    // Pre-ordenar Reserva para ruta de montacargas progresiva
    let reservaRuta = [...reserva].sort((a,b) => {
        let uA = String(a['UBICACION'] || '').trim();
        let uB = String(b['UBICACION'] || '').trim();
        return uA.localeCompare(uB);
    });

    let ubicacionesEnElPiso = new Set();
    let cuotasPicking = {};

    // 4. Simulación de ruta CRUZANDO LA DEMANDA CONSOLIDADA VS STOCK FÍSICO
    Object.keys(demandaConsolidada).forEach(skuP => {
        let faltanteTotalSinergia = demandaConsolidada[skuP];
        globalRQ += faltanteTotalSinergia;

        // Cascada 1: Zonas Bajas
        let p1 = Math.min(faltanteTotalSinergia, stBaja[skuP] || 0);
        atdBaja += p1;
        faltanteTotalSinergia -= p1;

        // Cascada 2: Alta (Rastreo Físico de Paletas)
        if (faltanteTotalSinergia > 0) {
            let cuotaAlto = Math.min(faltanteTotalSinergia, stAlto[skuP] || 0);
            let needed = cuotaAlto;
            
            for (let r of reservaRuta) {
                if (needed <= 0) break;
                // NOTA: Para simulación robusta restamos del array dinámico también para casos repetidos de extracción.
                let nivelR = String(r['NIVEL'] || r['Nivel'] || '').trim().toUpperCase();
                let skuR = String(r['PRODUCTO'] || r['Producto'] || r['ARTICULO'] || r['Articulo'] || '').trim();
                let qtyR = parseFloat(r['CANTIDAD'] || r['Cantidad actual'] || r['Cantidad'] || 0) || 0;
                let pickeadoMismaPaleta = r['_usado'] || 0;
                let available = qtyR - pickeadoMismaPaleta;
                
                if (nivelR === 'ALTO' && skuR === skuP && available > 0) {
                    let pick = Math.min(needed, available);
                    needed -= pick;
                    r['_usado'] = pickeadoMismaPaleta + pick;
                    
                    let ubiRaw = String(r['UBICACION'] || '').trim();
                    ubicacionesEnElPiso.add(ubiRaw);
                    if (!cuotasPicking[ubiRaw]) cuotasPicking[ubiRaw] = {};
                    cuotasPicking[ubiRaw][skuP] = (cuotasPicking[ubiRaw][skuP] || 0) + pick;
                }
            }
            atdAlto += cuotaAlto;
            faltanteTotalSinergia -= cuotaAlto;
        }

        // Cascada 3: Pisos
        let p3 = Math.min(faltanteTotalSinergia, stPiso[skuP] || 0);
        atdPiso += p3;
        faltanteTotalSinergia -= p3;

        // Cascada 4: Aereo (Rastreo Físico Secundaria)
        if (faltanteTotalSinergia > 0) {
            let cuotaAereo = Math.min(faltanteTotalSinergia, stAereo[skuP] || 0);
            let neededAe = cuotaAereo;
            for (let r of reservaRuta) {
                if (neededAe <= 0) break;
                let nivelR = String(r['NIVEL'] || r['Nivel'] || '').trim().toUpperCase();
                let skuR = String(r['PRODUCTO'] || r['Producto'] || r['ARTICULO'] || r['Articulo'] || '').trim();
                let qtyR = parseFloat(r['CANTIDAD'] || r['Cantidad actual'] || r['Cantidad'] || 0) || 0;
                let pickeadoMismaPaleta = r['_usado'] || 0;
                let availableAe = qtyR - pickeadoMismaPaleta;
                
                if (nivelR === 'AEREO' && skuR === skuP && availableAe > 0) {
                    let pickAe = Math.min(neededAe, availableAe);
                    neededAe -= pickAe;
                    r['_usado'] = pickeadoMismaPaleta + pickAe;
                    
                    let ubiRawAe = String(r['UBICACION'] || '').trim();
                    ubicacionesEnElPiso.add(ubiRawAe);
                    if (!cuotasPicking[ubiRawAe]) cuotasPicking[ubiRawAe] = {};
                    cuotasPicking[ubiRawAe][skuP] = (cuotasPicking[ubiRawAe][skuP] || 0) + pickAe;
                }
            }
            atdAereo += cuotaAereo;
            faltanteTotalSinergia -= cuotaAereo;
        }

        // Cascada 5: Logico
        let p5 = Math.min(faltanteTotalSinergia, stLogico[skuP] || 0);
        atdLogico += p5;
        faltanteTotalSinergia -= p5;
    });

    // 5. Construcción del Reporte Físico (Desplegando Contenido Íntegro de las Paletas)
    let arrayUbicacionesActivas = Array.from(ubicacionesEnElPiso);
    arrayUbicacionesActivas.forEach(ubi => {
        // Traemos todas las filas (SKUs) que viven orgánicamente en esa locación de Reserva
        let inquilinosMadera = reserva.filter(f => String(f['UBICACION'] || '').trim() === ubi);
        
        // Consolidación de SKUs idénticos en la misma madera (paleta)
        let skusEnEstaMadera = {};
        inquilinosMadera.forEach(inquilino => {
            let colSku = String(inquilino['PRODUCTO'] || inquilino['Producto'] || inquilino['ARTICULO'] || inquilino['Articulo'] || '').trim();
            let colQty = parseFloat(inquilino['CANTIDAD'] || inquilino['Cantidad actual'] || inquilino['Cantidad'] || 0) || 0;
            let colLpn = String(inquilino['LPN'] || '').trim();
            
            if (!skusEnEstaMadera[colSku]) {
                skusEnEstaMadera[colSku] = { qty: 0, lpn: colLpn };
            }
            skusEnEstaMadera[colSku].qty += colQty;
        });

        // Generar las filas finales del reporte por cada SKU único en la paleta
        Object.keys(skusEnEstaMadera).forEach(colSku => {
            let dataG = skusEnEstaMadera[colSku];
            let bufferPick = 0;
            
            // ¿A este zapato le toca picking en esta bajada?
            if (cuotasPicking[ubi] && cuotasPicking[ubi][colSku]) {
                bufferPick = cuotasPicking[ubi][colSku];
                cuotasPicking[ubi][colSku] = 0; // Se apaga la cuota por seguridad
            }

            detallePallets.push({
                'UBICACIONES': ubi,
                'LPN': dataG.lpn,
                'SKU': colSku,
                'QTY ACTIVO': Math.floor(stBaja[colSku] || 0),
                'QTY RESERVA': dataG.qty,
                'QTY BUFFER': bufferPick,
                'ARTICULO': colSku.split('-')[0]
            });
        });
    });

    // Mapeo Final de la Cascada para la vista Web
    const calcPct = (atd, total) => total > 0 ? ((atd / total) * 100).toFixed(2) + '%' : '0.00%';
    
    let rqBaja = globalRQ;
    let rqAlto = rqBaja - atdBaja;
    let rqPiso = rqAlto - atdAlto;
    let rqAereo = rqPiso - atdPiso;
    let rqLogico = rqAereo - atdAereo;
    
    let sumRQ = rqBaja; // Mantenemos el RQ inicial global como Total de Demanda
    let sumATD = atdBaja + atdAlto + atdPiso + atdAereo + atdLogico;

    let waterfallArray = [
        { nivel: '1. Zonas Bajas', rq: rqBaja, atd: atdBaja, pct: calcPct(atdBaja, rqBaja) },
        { nivel: '2. Alto', rq: rqAlto, atd: atdAlto, pct: calcPct(atdAlto, rqAlto) },
        { nivel: '3. Pisos', rq: rqPiso, atd: atdPiso, pct: calcPct(atdPiso, rqPiso) },
        { nivel: '4. Aereo', rq: rqAereo, atd: atdAereo, pct: calcPct(atdAereo, rqAereo) },
        { nivel: '5. Lógicas', rq: rqLogico, atd: atdLogico, pct: calcPct(atdLogico, rqLogico) },
        { nivel: 'Total', rq: sumRQ, atd: sumATD, pct: calcPct(sumATD, sumRQ) }
    ];

    // ==================================================
    // RESUMEN BUFFER SKU — Agrupa por TIPO DE EMPAQUE
    // PALETAS  = ubicaciones únicas por tipo
    // SKUS     = códigos SKU únicos por tipo
    // PAR/CAJA = suma de QTY BUFFER por tipo
    // ==================================================
    const acumPaletas = {}; // tipo -> Set de UBICACIONES
    const acumSkus    = {}; // tipo -> Set de SKU
    const acumParcaja = {}; // tipo -> suma QTY BUFFER

    detallePallets.forEach(row => {
        const sku       = String(row['SKU'] || '').trim();
        const ubicacion = String(row['UBICACIONES'] || '').trim();
        const qtyBuffer = Number(row['QTY BUFFER']) || 0;

        // REGLA DEFINITIVA: largo total del SKU — 12 caracteres = SolidPack | 15 caracteres = PreePack
        const largoSKU = sku.length; // largo total (letras + dígitos)
        let tipo;
        if (largoSKU === 15) {
            tipo = 'PreePack';
        } else {
            tipo = 'SolidPack'; // 12 caracteres u otro = SolidPack
        }

        if (!acumPaletas[tipo]) {
            acumPaletas[tipo] = new Set();
            acumSkus[tipo]    = new Set();
            acumParcaja[tipo] = 0;
        }
        acumPaletas[tipo].add(ubicacion);
        acumSkus[tipo].add(sku);
        acumParcaja[tipo] += qtyBuffer;
    });

    const resumenSKU = Object.keys(acumPaletas).map(tipo => ({
        tipo,
        paletas: acumPaletas[tipo].size,
        skus:    acumSkus[tipo].size,
        parcaja: acumParcaja[tipo]
    }));

    if (resumenSKU.length > 0) {
        resumenSKU.push({
            tipo:    'TOTAL',
            paletas: resumenSKU.reduce((s, r) => s + r.paletas, 0),
            skus:    new Set(detallePallets.map(r => r['SKU'])).size,
            parcaja: resumenSKU.reduce((s, r) => s + r.parcaja, 0)
        });
    }

    return {
        waterfall: waterfallArray,
        detalle:   detallePallets,
        resumenSKU
    };
};


