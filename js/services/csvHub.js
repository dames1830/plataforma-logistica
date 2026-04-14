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

    // 2. Acumuladores de Cascada (Waterfall)
    let globalRQ = 0;
    let atdBaja = 0;
    let atdAlto = 0;
    let atdPiso = 0;
    let atdAereo = 0;
    let atdLogico = 0;

    // 3. Simulación de ruta por SKUs Pedidos
    pedidos.forEach(filaP => {
        let skuP = String(filaP['CÃ³digo de artÃculo'] || filaP['Código de artículo'] || '').trim();
        let cantPedida = parseFloat(filaP['Cantidad solicitada']) || 0;
        let cantAsignada = parseFloat(filaP['Cantidad asignada']) || 0;
        
        let faltanteLocal = cantPedida - cantAsignada;
        if (faltanteLocal <= 0 || !skuP) return;

        globalRQ += faltanteLocal;

        // Cascada 1: Zonas Bajas
        let p1 = Math.min(faltanteLocal, stBaja[skuP] || 0);
        atdBaja += p1;
        faltanteLocal -= p1;

        // Cascada 2: Alta
        let p2 = Math.min(faltanteLocal, stAlto[skuP] || 0);
        atdAlto += p2;
        faltanteLocal -= p2;

        // Cascada 3: Pisos
        let p3 = Math.min(faltanteLocal, stPiso[skuP] || 0);
        atdPiso += p3;
        faltanteLocal -= p3;

        // Cascada 4: Aereo
        let p4 = Math.min(faltanteLocal, stAereo[skuP] || 0);
        atdAereo += p4;
        faltanteLocal -= p4;

        // Cascada 5: Logico
        let p5 = Math.min(faltanteLocal, stLogico[skuP] || 0);
        atdLogico += p5;
        faltanteLocal -= p5;
    });

    // Mapeo Final de la Cascada para la vista Web
    const calcPct = (atd, total) => total > 0 ? ((atd / total) * 100).toFixed(0) + '%' : '0%';
    
    let waterfallArray = [
        { nivel: '1. Zonas Bajas', rq: globalRQ, atd: atdBaja, pct: calcPct(atdBaja, globalRQ) },
        { nivel: '2. Alto', rq: globalRQ, atd: atdAlto, pct: calcPct(atdAlto, globalRQ) },
        { nivel: '3. Pisos', rq: globalRQ, atd: atdPiso, pct: calcPct(atdPiso, globalRQ) },
        { nivel: '4. Aereo', rq: globalRQ, atd: atdAereo, pct: calcPct(atdAereo, globalRQ) },
        { nivel: '5. Lógicos', rq: globalRQ, atd: atdLogico, pct: calcPct(atdLogico, globalRQ) },
        { nivel: 'Total', rq: globalRQ, atd: (atdBaja + atdAlto + atdPiso + atdAereo + atdLogico), pct: calcPct((atdBaja + atdAlto + atdPiso + atdAereo + atdLogico), globalRQ) }
    ];

    return {
        waterfall: waterfallArray,
        detalle: null // Pendiente a programar más adelante cuando lo definas
    };
};
