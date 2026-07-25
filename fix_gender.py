# -*- coding: utf-8 -*-
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    text = f.read()

# Revert my bad replace
text = text.replace("const skuGender = window.DEBUG_SKU_GENDER || {}; const genderRaw = skuGender[skuFull] || skuGender[sku7] || '';", "const genderRaw = skuGender[skuFull] || skuGender[sku7] || '';")

# Now properly fix the ReferenceError in the reservaRaw block
# Find the reservaRaw block
idx = text.find("if (reservaRaw.length > 2 && articulosRaw.length) {")
if idx != -1:
    idx2 = text.find("const skuTemporada = {};", idx)
    if idx2 != -1:
        text = text[:idx2] + "const skuTemporada = {};\n          const skuGender = window.DEBUG_SKU_GENDER || {};" + text[idx2+len("const skuTemporada = {};"):]

with open("js/views/dashboard_v25.js", "w", encoding="utf-8") as f:
    f.write(text)
print("Done fixing gender reference error.")
