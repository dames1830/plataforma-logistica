import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    content = f.read()

# ACTIVO block
search_activo = re.compile(r"let idxSku = 1, idxTemp = 14, idxGender = 3;\s*if \(articulosRaw\.length > 0 && Array\.isArray\(articulosRaw\[0\]\)\) \{\s*const headers = articulosRaw\[0\]\.map\(h => String\(h\)\.toUpperCase\(\)\.trim\(\)\);\s*const foundSku = headers\.findIndex\(h => h\.includes\('ARTICULO'\) \|\| h\.includes\('ARTÍCULO'\) \|\| h\.includes\('SKU'\) \|\| h\.includes\('PRODUCTO'\)\);\s*if \(foundSku >= 0\) idxSku = foundSku;\s*const foundTemp = headers\.findIndex\(h => h\.includes\('TEMPORADA'\) \|\| h === 'SEASON'\);\s*if \(foundTemp >= 0\) idxTemp = foundTemp;\s*const foundGender = headers\.findIndex\(h => h\.includes\('GENDER RIMS'\) \|\| h === 'RIMS'\);\s*if \(foundGender >= 0\) idxGender = foundGender;\s*\}")

replace_activo = "const idxSku = 1; // Columna B\n            const idxGender = 3; // Columna D\n            const idxTemp = 14; // Columna O"

# RESERVA block
search_reserva = re.compile(r"let idxSku = 1, idxTemp = 14;\s*if \(articulosRaw\.length > 0 && Array\.isArray\(articulosRaw\[0\]\)\) \{\s*const headers = articulosRaw\[0\]\.map\(h => String\(h\)\.toUpperCase\(\)\.trim\(\)\);\s*const foundSku = headers\.findIndex\(h => h\.includes\('ARTICULO'\) \|\| h\.includes\('ARTÍCULO'\) \|\| h\.includes\('SKU'\) \|\| h\.includes\('PRODUCTO'\)\);\s*if \(foundSku >= 0\) idxSku = foundSku;\s*const foundTemp = headers\.findIndex\(h => h\.includes\('TEMPORADA'\) \|\| h === 'SEASON'\);\s*if \(foundTemp >= 0\) idxTemp = foundTemp;\s*\}")

replace_reserva = "const idxSku = 1; // Columna B\n            const idxTemp = 14; // Columna O"

new_content = search_activo.sub(replace_activo, content)
new_content = search_reserva.sub(replace_reserva, new_content)

# Remove any other findIndex if needed, but the regex should cover it exactly.
# Let's also check showCellModal
search_modal = re.compile(r"let idxSku = 1;\s+let realHeaders = \[\];\s+if \(isArrayFormat\) \{\s+realHeaders = articulos\[0\]\.map\(h => String\(h\)\.trim\(\)\);\s+const foundSku = realHeaders\.findIndex\(h => h\.toUpperCase\(\)\.includes\('ARTICULO'\) \|\| h\.toUpperCase\(\)\.includes\('ARTÍCULO'\) \|\| h\.toUpperCase\(\)\.includes\('SKU'\)\);\s+if \(foundSku >= 0\) idxSku = foundSku;\s+\}")

replace_modal = """const idxSku = 1; // Columna B
      let realHeaders = [];
      if (isArrayFormat) {
          realHeaders = articulos[0].map(h => String(h).trim());
      }"""

new_content = search_modal.sub(replace_modal, new_content)

if content == new_content:
    print("NO MATCH FOUND")
else:
    with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("SUCCESS")
