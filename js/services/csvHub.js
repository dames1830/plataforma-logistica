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

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
          if(results.errors.length && !results.data.length) reject(results.errors);
          else {
             await persistToDatabase(area, results.data);
             resolve(results.data);
          }
        },
        error: function(err) { reject(err); }
      });
    } else if (file.name.endsWith('.xlsx')) {
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

    // 1. Acumulador de Stock Activo (Ignorando áreas basuras)
    const forbiddenAreas = ['DIS', 'MATE', 'PISO', 'dis', 'mate', 'piso'];
    let stockActivoPorSKU = {};
    activo.forEach(filaA => {
        let areaVal = String(filaA['Ãrea'] || filaA['Área'] || filaA['Area'] || '').trim().toUpperCase();
        if (forbiddenAreas.includes(areaVal)) return; // Ignora zonas muertas
        
        // Formateo de SKU y cantidad
        let sku = String(filaA['ArtÃculo'] || filaA['Artículo'] || filaA['Articulo'] || '').trim();
        let qty = parseFloat(filaA['Cantidad actual']) || 0;
        
        if(!stockActivoPorSKU[sku]) stockActivoPorSKU[sku] = 0;
        stockActivoPorSKU[sku] += qty;
    });

    // 2. Extracción de Pedidos Pendientes
    let quiebresDeStock = {};
    pedidos.forEach(filaP => {
        let skuPedidos = String(filaP['CÃ³digo de artÃculo'] || filaP['Código de artículo'] || '').trim();
        let cantPedida = parseFloat(filaP['Cantidad solicitada']) || 0;
        let cantDada = parseFloat(filaP['Cantidad asignada']) || 0;
        
        let pedidoPendiente = cantPedida - cantDada;
        
        if (pedidoPendiente > 0) {
            let cantEnPiso = stockActivoPorSKU[skuPedidos] || 0;
            // Si el piso no me alcanza para cubrir el pedido
            if (pedidoPendiente > cantEnPiso) {
                let faltanteReal = pedidoPendiente - cantEnPiso;
                if(!quiebresDeStock[skuPedidos]) quiebresDeStock[skuPedidos] = 0;
                quiebresDeStock[skuPedidos] += faltanteReal;
            }
        }
    });

    // 3. Algoritmo de Búsqueda y Bajada en Reserva Alta
    // Filtrar solo NIVEL ALTO
    let dbAlta = reserva.filter(r => String(r['NIVEL']).trim().toUpperCase() === 'ALTO');
    
    // Ordenar todas las locaciones ASCENDENTEMENTE por UBICACION para la ruta del montacargas
    dbAlta.sort((a, b) => {
        let ubiA = String(a['UBICACION'] || '').trim();
        let ubiB = String(b['UBICACION'] || '').trim();
        return ubiA.localeCompare(ubiB);
    });

    let palletsABajar = [];
    let ubicacionesBloqueadas = new Set();

    // Recorremos cada zapato que nos falta para buscarlo en la ruta
    for (let skuRoto in quiebresDeStock) {
        let cantidadQueNecesitoAun = quiebresDeStock[skuRoto];

        for (let pallet of dbAlta) {
            if (cantidadQueNecesitoAun <= 0) break; // Ya encontré suficientes de este SKU

            let ubi = String(pallet['UBICACION']).trim();
            if (ubicacionesBloqueadas.has(ubi)) continue; // Si ya mandamos a bajar esta tarima, saltamos
            
            let palletSku = String(pallet['ARTICULO'] || '').trim();
            let palletQty = parseFloat(pallet['CANTIDAD']) || 0;

            if (palletSku === skuRoto && palletQty > 0) {
                // ENCONTRADO: Descontamos lo que encontramos de nuestro faltante
                cantidadQueNecesitoAun -= palletQty;
                
                // MÁXIMA REGLA: Extraemos y sumamos TODA la ubicación, bajamos todo el bloque físico
                ubicacionesBloqueadas.add(ubi);
                // Buscar todo lo que exista en esa posición exacta en toda la reserva general
                let filasMismaUbicacion = reserva.filter(rr => String(rr['UBICACION']).trim() === ubi);
                
                filasMismaUbicacion.forEach(f => palletsABajar.push(f));
            }
        }
    }

    return {
        totalUbicaciones: ubicacionesBloqueadas.size,
        totalSkusColaterales: palletsABajar.length,
        detalle: palletsABajar
    };
};
