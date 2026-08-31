# -*- coding: utf-8 -*-
import csv, io, re, os
from collections import defaultdict
csv.field_size_limit(10**7)
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Picking"
SKU = "6116913-1-07"
def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
for n in ["Picking 15-8.csv", "Picking 16-8.csv", "Picking 17-8.csv"]:
    ub = defaultdict(lambda: [0, 0.0])
    tot = 0.0
    with io.open(os.path.join(D, n), encoding="utf-8-sig", newline="", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if lim(r.get("Código de artículo")) != SKU: continue
            if lim(r.get("Estado")) != "Finalizada": continue
            q = float(lim(r.get("Cantidad empaquetada")) or 0)
            u = lim(r.get("De ubicación")); tot += q
            ub[u][0] += 1; ub[u][1] += q
    print("%s -> %.0f pares en %d lineas" % (n, tot, sum(v[0] for v in ub.values())))
    for u, v in sorted(ub.items(), key=lambda x: -x[1][1]):
        print("     %-20s %3d lineas  %5.0f pares" % (u, v[0], v[1]))
