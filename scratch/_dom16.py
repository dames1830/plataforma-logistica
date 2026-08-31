# -*- coding: utf-8 -*-
import csv, io, os, re, glob
from collections import defaultdict
csv.field_size_limit(10**7)
SCR = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock"
SKU = "6116913-1-07"
def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0

print("=== TODA linea del SKU en el picking del 15 al 18, sin filtrar estado ===")
for n in ["Picking 15-8.csv", "Picking 16-8.csv", "Picking 17-8.csv", "Picking 18-8.csv"]:
    p = os.path.join(SCR, "Picking", n)
    if not os.path.exists(p): print(" ", n, "NO EXISTE"); continue
    est = defaultdict(lambda: [0, 0.0])
    for r in csv.DictReader(io.open(p, encoding="utf-8-sig", newline="", errors="replace"), delimiter=";"):
        if lim(r.get("Código de artículo")) != SKU: continue
        e = lim(r.get("Estado")); est[e][0] += 1
        est[e][1] += num(r.get("Cantidad empaquetada"))
    print(" ", n, dict((k, (v[0], v[1])) for k, v in est.items()) or "sin lineas")

print("\n=== dias de picking que faltan entre el 14 y el 28 de agosto ===")
hay = set()
for p in glob.glob(os.path.join(SCR, "Picking", "Picking *-8.csv")):
    m = re.match(r"Picking (\d+)-8\.csv", os.path.basename(p))
    if m: hay.add(int(m.group(1)))
print("  faltan:", [d for d in range(14, 29) if d not in hay])

print("\n=== el SKU en CUALQUIER area, foto 17-08 07:00 vs 15-08 19:00 ===")
for n in ["Stock Activo 15-08-26 1900.csv", "Stock Activo 17-08-26 0700.csv"]:
    tot = defaultdict(float)
    for r in csv.DictReader(io.open(os.path.join(SCR, "Stock Activo", n), encoding="utf-8-sig", newline="", errors="replace"), delimiter=";"):
        if lim(r.get("Artículo")) != SKU: continue
        tot[lim(r.get("Área"))] += num(r.get("Cantidad actual"))
    print(" ", n, dict(tot), "=> %.0f" % sum(tot.values()))
