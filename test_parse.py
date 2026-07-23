import json

def getColSafe(row, possibleNames):
    if not row: return ''
    # JS: for (const key of Object.keys(row))
    for key in row.keys():
        upperKey = key.upper().strip()
        # JS: if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
        for name in possibleNames:
            if name.upper() in upperKey:
                return str(row[key])
    
    # JS: const raw = Array.isArray(row) ? row : Object.values(row);
    raw = list(row.values())
    
    for name in possibleNames:
        if name == 'IDX0' and len(raw) > 0: return str(raw[0] or '')
        if name == 'IDX1' and len(raw) > 1: return str(raw[1] or '')
        if name == 'IDX2' and len(raw) > 2: return str(raw[2] or '')
        if name == 'IDX13' and len(raw) > 13: return str(raw[13] or '')
        if name == 'IDX14' and len(raw) > 14: return str(raw[14] or '')
    return ''

row = {
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
}

sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO', 'IDX1', 'IDX0']).strip()
temp = getColSafe(row, ['TEMPORADA', 'SEASON', 'IDX14', 'IDX2']).strip()
sku7 = sku[:7]
skuTemporada = {}
skuTemporada[sku7] = temp.upper() if temp else 'DESCONOCIDA'
temporadaRaw = skuTemporada.get(sku7, 'DESCONOCIDA')

temporadaClean = 'ANTERIOR'
actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL']
for act in actuales:
    if act in temporadaRaw:
        temporadaClean = 'ACTUAL'

print(f"SKU: {sku}")
print(f"Temp: {temp}")
print(f"SKU Temporada: {skuTemporada[sku7]}")
print(f"Temporada Clean: {temporadaClean}")
