# -*- coding: utf-8 -*-
"""Sigue al SKU 6116913-1-07 foto por foto del Stock Activo, para ver cuando lo
matriculo recepcion en el buffer y cuando almacenaje lo subio a su cuerpo.
Salida: _sku_buffer.json"""
import csv, io, os, re, json, glob, sys
from collections import defaultdict

csv.field_size_limit(10**7)
SCR = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Activo"
SKU = "6116913-1-07"
ESTILO = "6116913"   # todas las tallas del mismo modelo

def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0

fotos = []
for p in sorted(glob.glob(os.path.join(SCR, "Stock Activo *.csv"))):
    n = os.path.basename(p)
    m = re.search(r"(\d{2})-(\d{2})-(\d{2}) (\d{4})", n)
    if not m: continue
    d, mes, a, h = m.groups()
    fotos.append((("20%s-%s-%s %s:%s" % (a, mes, d, h[:2], h[2:])), p, n))
fotos.sort()
print("fotos:", len(fotos), file=sys.stderr)

hist = []
for sello, p, n in fotos:
    filas_sku, filas_estilo = [], []
    with io.open(p, encoding="utf-8-sig", newline="", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            a = lim(r.get("Artículo"))
            if not a.startswith(ESTILO): continue
            fila = {"sku": a, "area": lim(r.get("Área")), "ubic": lim(r.get("Ubicación")),
                    "cant": num(r.get("Cantidad actual")),
                    "mod": lim(r.get("Registro de hora de modificación")),
                    "user": lim(r.get("Usuario de modificación"))}
            filas_estilo.append(fila)
            if a == SKU: filas_sku.append(fila)
    buf_sku    = [x for x in filas_sku    if "BUFFER" in x["area"]]
    buf_estilo = [x for x in filas_estilo if "BUFFER" in x["area"]]
    cuerpo     = [x for x in filas_sku    if x["ubic"].startswith("SEL-07-03")]
    hist.append({"foto": sello, "archivo": n,
                 "sku_total": sum(x["cant"] for x in filas_sku),
                 "sku_ubic": len(filas_sku),
                 "sku_buffer": buf_sku,
                 "sku_cuerpo": sum(x["cant"] for x in cuerpo),
                 "cuerpo_det": cuerpo,
                 "estilo_buffer": buf_estilo,
                 "estilo_total": sum(x["cant"] for x in filas_estilo)})
    print("%s  SKU %6.0f par en %2d ubic | cuerpo %5.0f | buffer SKU %d | buffer estilo %d" % (
        sello, hist[-1]["sku_total"], hist[-1]["sku_ubic"], hist[-1]["sku_cuerpo"],
        len(buf_sku), len(buf_estilo)), file=sys.stderr)

io.open("_sku_buffer.json", "w", encoding="utf-8").write(json.dumps(hist, ensure_ascii=False, indent=1))

print("\n=== MOMENTOS EN QUE ESTUVO EN EL BUFFER (el SKU) ===", file=sys.stderr)
for h in hist:
    for b in h["sku_buffer"]:
        print("  %s  %-16s %-18s %5.0f par  mod %s  por %s" % (
            h["foto"], b["area"], b["ubic"], b["cant"], b["mod"], b["user"]), file=sys.stderr)

print("\n=== EL ESTILO %s COMPLETO EN EL BUFFER ===" % ESTILO, file=sys.stderr)
for h in hist:
    for b in h["estilo_buffer"]:
        print("  %s  %-14s %-18s %-14s %5.0f par  mod %s  por %s" % (
            h["foto"], b["area"], b["ubic"], b["sku"], b["cant"], b["mod"], b["user"]), file=sys.stderr)
