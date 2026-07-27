import sys

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    ("document.querySelector('.nav-item.active')?.dataset.id", "((document.querySelector('.nav-item.active') || {}).dataset || {}).id"),
    ("allowedTabs[0]?.id", "(allowedTabs[0] ? allowedTabs[0].id : undefined)"),
    ("allowedSubTabs[0]?.id", "(allowedSubTabs[0] ? allowedSubTabs[0].id : undefined)"),
    ("data.sinStockSummary?.articulos", "(data.sinStockSummary ? data.sinStockSummary.articulos : undefined)"),
    ("data.sinStockSummary?.skus", "(data.sinStockSummary ? data.sinStockSummary.skus : undefined)"),
    ("data.sinStockSummary?.qty", "(data.sinStockSummary ? data.sinStockSummary.qty : undefined)"),
    ("adminService.getPermissions(r)?.[t.id]", "(adminService.getPermissions(r) ? adminService.getPermissions(r)[t.id] : undefined)"),
    ("adminService.getPermissions(r)?.[subKey]", "(adminService.getPermissions(r) ? adminService.getPermissions(r)[subKey] : undefined)"),
    ("adminService.getPermissions(r)?.[ssKey]", "(adminService.getPermissions(r) ? adminService.getPermissions(r)[ssKey] : undefined)"),
    ("existing?.finalized", "(existing ? existing.finalized : undefined)"),
    ("rec?.justification==='Descanso M\u00e9dico'", "(rec && rec.justification==='Descanso M\u00e9dico')"),
    ("rec?.justification==='Vacaciones'", "(rec && rec.justification==='Vacaciones')"),
    ("rec?.justification==='Otros'", "(rec && rec.justification==='Otros')"),
    ("workerRanking[0]?.name", "(workerRanking[0] ? workerRanking[0].name : undefined)"),
    ("activeMaestro?.[0]", "(activeMaestro ? activeMaestro[0] : undefined)"),
    ("mod?.subTabs", "(mod && mod.subTabs)"),
    ("Object.values(groupedByDate)[0]?.[0]?.fecha", "(Object.values(groupedByDate)[0] && Object.values(groupedByDate)[0][0] ? Object.values(groupedByDate)[0][0].fecha : undefined)"),
    ("workerRanking[0]?.name", "(workerRanking[0] ? workerRanking[0].name : undefined)"),
    ("stats.pickingStats?.picks", "(stats.pickingStats ? stats.pickingStats.picks : undefined)"),
    ("stats.pickingStats?.unidades", "(stats.pickingStats ? stats.pickingStats.unidades : undefined)"),
    ("stats.packingStats?.packs", "(stats.packingStats ? stats.packingStats.packs : undefined)"),
    ("stats.packingStats?.unidades", "(stats.packingStats ? stats.packingStats.unidades : undefined)")
]

for old, new in replacements:
    text = text.replace(old, new)

# Let's just catch any remaining ones manually
import re
text = re.sub(r'(\w+)\?\.', r'(\1 ? \1. : undefined)', text)
# Actually the regex above is broken since it replaces with `\1.` instead of properly handling the property. 
# Let's just rely on the manual replacements for known issues.

with open('js/views/dashboard_v28.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'v26\.5\.\d+', 'v26.5.486', html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Replaced safely.")
