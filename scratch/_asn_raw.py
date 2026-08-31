# -*- coding: utf-8 -*-
import csv, io, re
csv.field_size_limit(10**7)
SKU = "6116913-1-07"; ESTILO = "6116913"
P = r"C:\Users\dames\Downloads\ASN Revisar.csv"
def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
hdr = None
n = 0
tot_est = 0.0
with io.open(P, encoding="utf-8-sig", newline="") as f:
    rd = csv.reader(f, delimiter=";")
    hdr = next(rd)
    idx = {h: i for i, h in enumerate(hdr)}
    # ojo: 'Código de SKU' aparece dos veces
    cols_sku = [i for i, h in enumerate(hdr) if h.strip() == "Código de SKU"]
    print("columnas llamadas 'Código de SKU':", cols_sku)
    for row in rd:
        if len(row) < len(hdr): continue
        if not any(lim(row[i]).startswith(ESTILO) for i in cols_sku): continue
        vals = {h: row[i] for h, i in idx.items()}
        if lim(row[cols_sku[0]]) == SKU:
            n += 1
            print("\n--- fila %d ---" % n)
            for i, h in enumerate(hdr):
                v = lim(row[i])
                if v: print("   %-52s %s" % (h[:52], v[:50]))
        tot_est += float(lim(vals.get("Cantidad recibida de detalle de envío de entrada")) or 0)
print("\nTOTAL RECIBIDO de todo el estilo %s: %.0f" % (ESTILO, tot_est))
