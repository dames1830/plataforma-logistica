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
// Al estar en local:
const API_URL = "http://127.0.0.1:8000/api/logistics";
// Cuando lo subas a Render.com y te den un link, cambiarás esta variable por ej:
// const API_URL = "https://tu-logistica.onrender.com/api/logistics";

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
    
    if(!activo || !reserva) return null;

    let totalPalletsABajar = 0;
    let listadoPallets = [];

    const forbiddenAreas = ['DIS', 'MATE', 'PISO'];

    activo.forEach(filaActivo => {
        let areaVal = String(filaActivo['Ãrea'] || filaActivo['Área'] || filaActivo['Area'] || '').trim().toUpperCase();
        if (forbiddenAreas.includes(areaVal)) return;

        let valAsignada = parseFloat(filaActivo['Cantidad asignada']) || 0;
        let valActual = parseFloat(filaActivo['Cantidad actual']) || 0;
        
        if (valAsignada > valActual) {
            let cantFaltante = valAsignada - valActual;
            let artId = filaActivo['ArtÃculo'] || filaActivo['Artículo'] || filaActivo['Articulo'];
            
            let lpnsReserva = reserva.filter(r => {
                let rNivel = String(r['NIVEL']).trim().toUpperCase();
                let rArt = String(r['ARTICULO']).trim();
                let aArt = String(artId).trim();
                return (rArt === aArt) && (rNivel === 'ALTO');
            });

            let acumulado = 0;
            let lpnsUsados = 0;

            for(let lpn of lpnsReserva) {
                if(acumulado >= cantFaltante) break;
                let lpnQ = parseFloat(lpn['CANTIDAD']) || 0;
                if(lpnQ > 0) {
                   acumulado += lpnQ;
                   lpnsUsados++;
                   listadoPallets.push(lpn);
                }
            }
            totalPalletsABajar += lpnsUsados;
        }
    });

    return {
        totalPallets: totalPalletsABajar,
        detalle: listadoPallets
    };
};
