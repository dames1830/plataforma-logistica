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

// URL MAESTRA DEL SERVIDOR (Punto de conexión)
// Al estar en local tu computadora solía conectarse con:
// const API_URL = "http://127.0.0.1:8000/api/logistics";

// Producción Mundial - Servidor Nube:
const API_URL = "https://logistics-backend-tsw6.onrender.com/api/logistics";

export const parseFile = (file, area) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject('Archivo inválido');
    
    dataStore[area] = null;

    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
          if(results.errors.length && !results.data.length) reject(results.errors);
          else {
             try {
                 await persistToDatabase(area, results.data);
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
    await persistToDatabase('buffer', combinedData);
    dataStore['buffer'] = combinedData;
    return combinedData;
};

// Función Interna: Enviar data fuerte al Servidor Python SQL
const persistToDatabase = async (area, payload) => {
    try {
        const response = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(response.ok) {
           dataStore[area] = payload; // Guarda en caché solo si la BD lo aceptó
        } else {
           console.error("Fallo guardando en servidor DB.");
        }
    } catch (err) {
        console.error("Error de Red, el servidor Python está apagado?", err);
        // Fallback local: si Python muere, se sigue usando local en RAM
        dataStore[area] = payload;
    }
};

// Función Asíncrona: Preguntar a la BD maestra por los datos, si no tiene, usa nulo
export const getAreaData = async (area) => {
  try {
     const response = await fetch(`${API_URL}/${area}`);
     if(response.ok) {
         const serverResponse = await response.json();
         if(serverResponse.data) {
             dataStore[area] = serverResponse.data;
             return dataStore[area];
         }
     }
  } catch (err) {
      console.warn("Servidor Backend Inactivo. Usando memoria caché.");
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

export const calculateBufferPallets = () => {
    let activo = dataStore.stockActivo;
    let reserva = dataStore.stockReserva;
    let pedidos = dataStore.buffer; 
    
    if(!activo || !reserva || !pedidos) return null;

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
        
        if (areaRaw === 'PISO') {
            stPiso[sku] = (stPiso[sku] || 0) + qty;
        } else if (areaRaw === 'DIS' || areaRaw === 'MATE') {
            stLogico[sku] = (stLogico[sku] || 0) + qty;
        } else if (areaRaw === 'AEREO') {
            // Un probable caso de fallback si estuviera en Activo, pero el user dijo Reserva
        } else {
            // Zonas Bajas (Cualquier área regular)
            stBaja[sku] = (stBaja[sku] || 0) + qty;
        }
    });

    reserva.forEach(filaVal => {
        let nivelRaw = String(filaVal['NIVEL'] || filaVal['Nivel'] || '').trim().toUpperCase();
        let sku = String(filaVal['PRODUCTO'] || filaVal['Producto'] || filaVal['ARTICULO'] || filaVal['ArtÃculo'] || filaVal['Artículo'] || filaVal['Articulo'] || '').trim();
        let qty = parseFloat(filaVal['CANTIDAD'] || filaVal['Cantidad actual'] || filaVal['Cantidad'] || filaVal['cantidad']) || 0;

        if(!sku || qty <= 0) return;

        if (nivelRaw === 'ALTO') {
            stAlto[sku] = (stAlto[sku] || 0) + qty;
        } else if (nivelRaw === 'AEREO') {
            stAereo[sku] = (stAereo[sku] || 0) + qty;
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
    
    let sumRQ = rqBaja + rqAlto + rqPiso + rqAereo + rqLogico;
    let sumATD = atdBaja + atdAlto + atdPiso + atdAereo + atdLogico;

    let waterfallArray = [
        { nivel: '1. Zonas Bajas', rq: rqBaja, atd: atdBaja, pct: calcPct(atdBaja, rqBaja) },
        { nivel: '2. Alto', rq: rqAlto, atd: atdAlto, pct: calcPct(atdAlto, rqAlto) },
        { nivel: '3. Pisos', rq: rqPiso, atd: atdPiso, pct: calcPct(atdPiso, rqPiso) },
        { nivel: '4. Aereo', rq: rqAereo, atd: atdAereo, pct: calcPct(atdAereo, rqAereo) },
        { nivel: '5. Lógicos', rq: rqLogico, atd: atdLogico, pct: calcPct(atdLogico, rqLogico) },
        { nivel: 'Total', rq: sumRQ, atd: sumATD, pct: calcPct(sumATD, sumRQ) }
    ];

    return {
        waterfall: waterfallArray,
        detalle: detallePallets
    };
};
