const row = {
    'CodCanal': 5,
    'CodArticulo ': 6646806,
    'G. Gender': 'Footwear',
    'Gender RIMS': '02 WOMEN',
    'Category RIMS': 'B14_SUMMER',
    'Subcategory RIMS': 'B14_32_SANDAL HEIGHT 5',
    'Gpo School': 'Non School',
    'TemCom': 'Summer',
    'MarcaStd': 'Bata',
    'Coleccion PO': '2026-Q4',
    'Tipo Obsole': 'No Obsoleto',
    'Weeks': '(en blanco)',
    'Total': 1,
    'Marcas': 'Bata',
    'Temporada': 'T. Actual'
};

const getColSafe = (row, possibleNames) => {
    if (!row) return '';
    for (const key of Object.keys(row)) {
        const upperKey = key.toUpperCase().trim();
        if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
    }
    const raw = Array.isArray(row) ? row : Object.values(row);
    for (const name of possibleNames) {
        if (name === 'IDX0') return String(raw[0] || '');
        if (name === 'IDX1') return String(raw[1] || '');
        if (name === 'IDX2') return String(raw[2] || '');
        if (name === 'IDX3') return String(raw[3] || '');
        if (name === 'IDX4') return String(raw[4] || '');
        if (name === 'IDX5') return String(raw[5] || '');
        if (name === 'IDX7') return String(raw[7] || '');
        if (name === 'IDX10') return String(raw[10] || '');
        if (name === 'IDX13') return String(raw[13] || '');
        if (name === 'IDX14') return String(raw[14] || '');
    }
    return '';
}

const sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO', 'IDX1', 'IDX0']).trim();
const temp = getColSafe(row, ['TEMPORADA', 'SEASON', 'IDX14', 'IDX2']).trim();
const sku7 = sku.substring(0, 7);
let skuTemporada = {};
skuTemporada[sku7] = temp ? temp.toUpperCase() : 'DESCONOCIDA';
let temporadaRaw = skuTemporada[sku7] || 'DESCONOCIDA';
let temporadaClean = 'ANTERIOR'; 
const actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL'];
if (actuales.some(act => temporadaRaw.includes(act))) {
    temporadaClean = 'ACTUAL';
}
console.log("SKU:", sku);
console.log("Temp:", temp);
console.log("SKU Temporada:", skuTemporada[sku7]);
console.log("Temporada Clean:", temporadaClean);
