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

const LS_PREFIX = 'logistics_cache_';
const LS_TTL_MS = 8 * 60 * 60 * 1000;

const saveToLS = (area, data) => {
    try { localStorage.setItem(LS_PREFIX + area, JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
};

const loadFromLS = (area) => {
    try {
        const raw = localStorage.getItem(LS_PREFIX + area);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts > LS_TTL_MS) { localStorage.removeItem(LS_PREFIX + area); return null; }
        return parsed.data;
    } catch(e) { return null; }
};

(() => {
    Object.keys(dataStore).forEach(area => {
        const cached = loadFromLS(area);
        if (cached) dataStore[area] = cached;
    });
})();

export let currentDateFilter = null;
const API_BASE   = "https://logistics-backend-wv0x.onrender.com/api";
const API_URL    = `${API_BASE}/logistics`;
const SHARED_API = `${API_BASE}/shared`;

export const setDateFilter = (newDateStr) => {
    if (currentDateFilter !== newDateStr) {
        currentDateFilter = newDateStr;
        Object.keys(dataStore).forEach(k => dataStore[k] = null);
        Object.keys(dataStore).forEach(k => localStorage.removeItem(LS_PREFIX + k));
    }
};

export const pingServer = () => {
    fetch(`${API_BASE}/health`).catch(() => {});
};

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
    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
           dataStore[area] = results.data;
           saveToLS(area, results.data);
           resolve(results.data);
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
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          dataStore[area] = jsonData;
          saveToLS(area, jsonData);
          resolve(jsonData);
        } catch(err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
};

export const fetchBufferConfig = async () => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' });

export const calculateBufferPallets = (configOverride = null) => {
    const activo = dataStore.stockActivo;
    const reserva = dataStore.stockReserva;
    const pedidos = dataStore.buffer; 
    
    if(!activo || !reserva || !pedidos) return null;
    const config = configOverride || { include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' };
    const getArticulo = (sku) => String(sku || '').substring(0, 7);

    let stBajas = {}, stPisos = {}, stLogicos = {}, stAltos = {}, stAereos = {};
    const registerStock = (map, sku, qty, row) => {
        if (!map[sku]) map[sku] = [];
        map[sku].push({ qty, row });
    };

    activo.forEach(f => {
        let area = String(getCol(f, ['Area', 'Área']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Articulo', 'Artículo']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad actual', 'Cantidad'])) || 0;
        if (config.include_piso === '1' && (area === 'PISO' || area === 'CROSS')) registerStock(stPisos, sku, qty, f);
        else if (config.include_logico === '1' && area === 'DIS') registerStock(stLogicos, sku, qty, f);
        else if (config.include_reserva === '1') registerStock(stBajas, sku, qty, f);
    });

    reserva.forEach(f => {
        let nivel = String(getCol(f, ['Nivel', 'NIVEL']) || '').trim().toUpperCase();
        let sku = String(getCol(f, ['Producto', 'PRODUCTO']) || '').trim();
        let qty = parseFloat(getCol(f, ['Cantidad', 'CANTIDAD'])) || 0;
        if (config.include_alto === '1' && nivel === 'ALTO') registerStock(stAltos, sku, qty, f);
        else if (config.include_aereo === '1' && nivel === 'AEREO') registerStock(stAereos, sku, qty, f);
        else if (config.include_piso === '1' && nivel === 'CROSS') registerStock(stPisos, sku, qty, f);
    });

    let demanda = {};
    pedidos.forEach(f => {
        let sku = String(getCol(f, ['Articulo', 'SKU']) || '').trim();
        let cant = parseFloat(getCol(f, ['Cantidad solicitada', 'Solicitada'])) || 0;
        let asig = parseFloat(getCol(f, ['Cantidad asignada', 'Asignada'])) || 0;
        let diff = cant - asig;
        if (diff > 0 && sku) demanda[sku] = (demanda[sku] || 0) + diff;
    });

    let globalRQ = 0, atdBaja = 0, atdAlto = 0, atdPiso = 0, atdAereo = 0, atdLogico = 0;
    let detalleZonas = [], stockUsadoMap = new Map(), ubicacionesEnElPiso = new Set(), cuotasPicking = {};

    const satisfyDemand = (sku, pending, stockMap, nivelLabel, counterRef) => {
        if (!stockMap[sku] || pending <= 0) return pending;
        for (let item of stockMap[sku]) {
            if (pending <= 0) break;
            let id = item.row._id || `${getCol(item.row, ['LPN']) || ''}_${sku}_${getCol(item.row, ['UBICACION']) || ''}`;
            let uses = stockUsadoMap.get(id) || 0;
            let avail = item.qty - uses;
            if (avail > 0) {
                let pick = Math.min(pending, avail);
                detalleZonas.push({
                    'NIVEL/AREA': nivelLabel,
                    'UBICACION': String(getCol(item.row, ['UBICACION']) || 'S/U').trim(),
                    'ARTÍCULO': getArticulo(sku),
                    'SKU': sku,
                    'RQ': (pending === demanda[sku]) ? initialRQ : 0,
                    'ATD RQ': pick
                });
                if (nivelLabel === 'Alto' || nivelLabel === 'Aereo') ubicacionesEnElPiso.add(String(getCol(item.row, ['UBICACION']) || '').trim());
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
        let w = { val: 0 };
        pending = satisfyDemand(sku, pending, stBajas, 'Zonas Bajas', w); atdBaja += w.val; w.val=0;
        pending = satisfyDemand(sku, pending, stAltos, 'Alto', w); atdAlto += w.val; w.val=0;
        pending = satisfyDemand(sku, pending, stPisos, 'Pisos', w); atdPiso += w.val; w.val=0;
        pending = satisfyDemand(sku, pending, stAereos, 'Aereo', w); atdAereo += w.val; w.val=0;
        pending = satisfyDemand(sku, pending, stLogicos, 'Logica', w); atdLogico += w.val;
    });

    const calcPct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(2) + '%' : '0.00%';
    let waterfall = [
        { nivel: '1. Zonas Bajas', rq: globalRQ, atd: atdBaja, pct: calcPct(atdBaja, globalRQ) },
        { nivel: '2. Alto', rq: globalRQ - atdBaja, atd: atdAlto, pct: calcPct(atdAlto, globalRQ - atdBaja) },
        { nivel: '3. Pisos', rq: globalRQ - atdBaja - atdAlto, atd: atdPiso, pct: calcPct(atdPiso, globalRQ - atdBaja - atdAlto) },
        { nivel: '4. Aereo', rq: globalRQ - atdBaja - atdAlto - atdPiso, atd: atdAereo, pct: calcPct(atdAereo, globalRQ - atdBaja - atdAlto - atdPiso) },
        { nivel: '5. Logica', rq: globalRQ - atdBaja - atdAlto - atdPiso - atdAereo, atd: atdLogico, pct: calcPct(atdLogico, globalRQ - atdBaja - atdAlto - atdPiso - atdAereo) },
        { nivel: 'Total', rq: globalRQ, atd: atdBaja + atdAlto + atdPiso + atdAereo + atdLogico, pct: calcPct(atdBaja+atdAlto+atdPiso+atdAereo+atdLogico, globalRQ) }
    ];

    const empMap = { 'SolidPack': { pals: new Set(), skus: new Set(), qty: 0 }, 'PreePack': { pals: new Set(), skus: new Set(), qty: 0 } };
    detalleZonas.forEach(d => {
        const t = d.SKU.length >= 14 ? 'PreePack' : 'SolidPack';
        empMap[t].pals.add(d.UBICACION); empMap[t].skus.add(d.SKU); empMap[t].qty += d['ATD RQ'];
    });
    const resSKU = Object.keys(empMap).map(p => ({ tipo: p, paletas: empMap[p].pals.size, skus: empMap[p].skus.size, parcaja: empMap[p].qty }));
    resSKU.push({ tipo: 'TOTAL', paletas: new Set(detalleZonas.map(d=>d.UBICACION)).size, skus: new Set(detalleZonas.map(d=>d.SKU)).size, parcaja: resSKU.reduce((a,b)=>a+b.parcaja, 0) });

    const forensicZones = ['Pisos', 'Aereo', 'Logica'];
    let gAggr = {}, mAggr = {};
    detalleZonas.filter(d => forensicZones.includes(d['NIVEL/AREA'])).forEach(d => {
        const art = d.SKU.substring(0, 7);
        const row = dataStore.articulos?.find(a => String(getCol(a, ['Articulo']) || '').trim() === art);
        const g = String(getCol(row, ['Genero', 'Gender']) || 'OTROS').toUpperCase();
        const m = String(getCol(row, ['Marca', 'Brand']) || 'Otros');
        if(!gAggr[g]) gAggr[g] = { rq: 0, atd: 0 }; gAggr[g].atd += d['ATD RQ']; gAggr[g].rq += d['ATD RQ'];
        if(!mAggr[m]) mAggr[m] = { rq: 0, atd: 0 }; mAggr[m].atd += d['ATD RQ']; mAggr[m].rq += d['ATD RQ'];
    });

    const fmtF = (ag) => {
        const rs = Object.keys(ag).sort().map(k => ({ key: k, rq: ag[k].rq, atd: ag[k].atd }));
        if(rs.length) rs.push({ key: 'TOTAL', rq: rs.reduce((a,b)=>a+b.rq,0), atd: rs.reduce((a,b)=>a+b.atd,0)});
        return rs;
    };

    return { waterfall, detalleZonas, resumenSKU: resSKU, resumenGender: fmtF(gAggr), resumenMarca: fmtF(mAggr) };
};
