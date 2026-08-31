# -*- coding: utf-8 -*-
import csv, io, re, os
csv.field_size_limit(10**7)
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Activo"
SKU = "6116913-1-07"
def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
for n in ["Stock Activo 15-08-26 0700.csv", "Stock Activo 15-08-26 1900.csv",
          "Stock Activo 17-08-26 0700.csv", "Stock Activo 26-08-26 0700.csv"]:
    print("===", n, "===")
    t = 0
    with io.open(os.path.join(D, n), encoding="utf-8-sig", newline="", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if lim(r.get("Artículo")) != SKU: continue
            c = float(lim(r.get("Cantidad actual")) or 0); t += c
            print("   %-10s %-20s %6.0f par   mod %-20s por %s" % (
                lim(r.get("Área")), lim(r.get("Ubicación")), c,
                lim(r.get("Registro de hora de modificación")), lim(r.get("Usuario de modificación"))))
    print("   TOTAL %.0f\n" % t)
