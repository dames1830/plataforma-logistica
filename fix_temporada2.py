import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    content = f.read()

# ACTIVO block
search_activo = re.compile(r"if \(activoRaw\.length && articulosRaw\.length\) \{\s+const skuTemporada = \{\};\s+const skuGender = \{\};\s+articulosRaw\.forEach\(row => \{\s+const sku = getColSafe\(row, \['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO', 'IDX1', 'IDX0'\]\)\.trim\(\);\s+const temp = getColSafe\(row, \['TEMPORADA', 'SEASON', 'IDX13', 'IDX14', 'IDX2'\]\)\.trim\(\);\s+const gender = getColSafe\(row, \['GENDER RIMS', 'RIMS', 'IDX3'\]\)\.trim\(\);\s+if \(sku\) \{\s+const sku7 = sku\.substring\(0, 7\);\s+skuTemporada\[sku7\] = temp \? temp\.toUpperCase\(\) : 'DESCONOCIDA';\s+skuTemporada\[sku\] = temp \? temp\.toUpperCase\(\) : 'DESCONOCIDA';\s+skuGender\[sku7\] = gender \? gender\.toUpperCase\(\) : '';\s+skuGender\[sku\] = gender \? gender\.toUpperCase\(\) : '';\s+\}\s+\}\);")

replace_activo = """if (activoRaw.length && articulosRaw.length) {
            const skuTemporada = {};
            const skuGender = {};
            
            let idxSku = 1, idxTemp = 14, idxGender = 3;
            if (articulosRaw.length > 0 && Array.isArray(articulosRaw[0])) {
                const headers = articulosRaw[0].map(h => String(h).toUpperCase().trim());
                const foundSku = headers.findIndex(h => h.includes('ARTICULO') || h.includes('ARTÍCULO') || h.includes('SKU') || h.includes('PRODUCTO'));
                if (foundSku >= 0) idxSku = foundSku;
                const foundTemp = headers.findIndex(h => h.includes('TEMPORADA') || h === 'SEASON');
                if (foundTemp >= 0) idxTemp = foundTemp;
                const foundGender = headers.findIndex(h => h.includes('GENDER RIMS') || h === 'RIMS');
                if (foundGender >= 0) idxGender = foundGender;
            }

            articulosRaw.forEach((row, i) => {
                if (i === 0 && Array.isArray(row) && String(row[0]).toUpperCase().includes('COD')) return;
                
                let sku = '', temp = '', gender = '';
                if (Array.isArray(row)) {
                    sku = String(row[idxSku] || '').trim();
                    temp = String(row[idxTemp] || '').trim();
                    gender = String(row[idxGender] || '').trim();
                } else {
                    sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO']).trim();
                    temp = getColSafe(row, ['TEMPORADA', 'SEASON']).trim();
                    gender = getColSafe(row, ['GENDER RIMS', 'RIMS']).trim();
                }

                if (sku) {
                    const sku7 = sku.substring(0, 7);
                    const tUpper = temp ? temp.toUpperCase() : 'DESCONOCIDA';
                    if (!skuTemporada[sku7] || !skuTemporada[sku7].includes('ACTUAL')) skuTemporada[sku7] = tUpper;
                    if (!skuTemporada[sku] || !skuTemporada[sku].includes('ACTUAL')) skuTemporada[sku] = tUpper;
                    
                    if (!skuGender[sku7]) skuGender[sku7] = gender ? gender.toUpperCase() : '';
                    if (!skuGender[sku]) skuGender[sku] = gender ? gender.toUpperCase() : '';
                }
            });"""

# RESERVA block
search_reserva = re.compile(r"const skuTemporada = \{\};\s+articulosRaw\.forEach\(row => \{\s+const sku = getColSafe\(row, \['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO', 'IDX1', 'IDX0'\]\)\.trim\(\);\s+const temp = getColSafe\(row, \['TEMPORADA', 'SEASON', 'IDX13', 'IDX14', 'IDX2'\]\)\.trim\(\);\s+if \(sku\) \{\s+const sku7 = sku\.substring\(0, 7\);\s+skuTemporada\[sku7\] = temp \? temp\.toUpperCase\(\) : 'DESCONOCIDA';\s+skuTemporada\[sku\] = temp \? temp\.toUpperCase\(\) : 'DESCONOCIDA';\s+\}\s+\}\);")

replace_reserva = """const skuTemporada = {};
            let idxSku = 1, idxTemp = 14;
            if (articulosRaw.length > 0 && Array.isArray(articulosRaw[0])) {
                const headers = articulosRaw[0].map(h => String(h).toUpperCase().trim());
                const foundSku = headers.findIndex(h => h.includes('ARTICULO') || h.includes('ARTÍCULO') || h.includes('SKU') || h.includes('PRODUCTO'));
                if (foundSku >= 0) idxSku = foundSku;
                const foundTemp = headers.findIndex(h => h.includes('TEMPORADA') || h === 'SEASON');
                if (foundTemp >= 0) idxTemp = foundTemp;
            }

            articulosRaw.forEach((row, i) => {
                if (i === 0 && Array.isArray(row) && String(row[0]).toUpperCase().includes('COD')) return;
                
                let sku = '', temp = '';
                if (Array.isArray(row)) {
                    sku = String(row[idxSku] || '').trim();
                    temp = String(row[idxTemp] || '').trim();
                } else {
                    sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO']).trim();
                    temp = getColSafe(row, ['TEMPORADA', 'SEASON']).trim();
                }

                if (sku) {
                    const sku7 = sku.substring(0, 7);
                    const tUpper = temp ? temp.toUpperCase() : 'DESCONOCIDA';
                    if (!skuTemporada[sku7] || !skuTemporada[sku7].includes('ACTUAL')) skuTemporada[sku7] = tUpper;
                    if (!skuTemporada[sku] || !skuTemporada[sku].includes('ACTUAL')) skuTemporada[sku] = tUpper;
                }
            });"""

new_content = search_activo.sub(replace_activo, content)
new_content = search_reserva.sub(replace_reserva, new_content)

if content == new_content:
    print("NO MATCH FOUND")
else:
    with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("SUCCESS")
