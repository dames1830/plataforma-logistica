# -*- coding: utf-8 -*-
"""Prueba decisiva: el ASN contra el buffer, TALLA POR TALLA del modelo 6116913.
Si a todas les falta la misma proporcion, el problema es de lectura, no de mercaderia."""
import csv, io, os, re, sys
from collections import defaultdict
csv.field_size_limit(10**7)
SCR = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock"
ASN = r"C:\Users\dames\Downloads\ASN Revisar.csv"
ESTILO = "6116913"

def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0

# ---- ASN: por SKU, y ojo con filas repetidas ----
asn = defaultdict(float)
asn_lineas = defaultdict(int)
llaves = defaultdict(int)
det = []
with io.open(ASN, encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f, delimiter=";"):
        a = lim(r.get("Código de SKU"))
        if not a.startswith(ESTILO): continue
        q = num(r.get("Cantidad recibida de detalle de envío de entrada"))
        asn[a] += q; asn_lineas[a] += 1
        k = (lim(r.get("Envío de entrada")), lim(r.get("Número de LPN")), a)
        llaves[k] += 1
        det.append({"sku": a, "envio": lim(r.get("Envío de entrada")), "lpn": lim(r.get("Número de LPN")),
                    "q": q, "verif": lim(r.get("Hora de verificación")),
                    "estado": lim(r.get("Estado")), "lpn_estado": lim(r.get("Estado de LPN")),
                    "recep_lpn": lim(r.get("Registro de hora de recepción de última LPN"))})
rep = {k: v for k, v in llaves.items() if v > 1}
print("ASN: %d lineas del estilo, %d combinaciones envio+LPN+SKU repetidas" % (sum(asn_lineas.values()), len(rep)), file=sys.stderr)
if rep:
    for k, v in list(rep.items())[:5]: print("   REPETIDA x%d: %s" % (v, k), file=sys.stderr)

# ---- BUFFER el 15/08 19:00 ----
buf = defaultdict(float)
antes = defaultdict(float)
for n, dest in [("Stock Activo 15-08-26 0700.csv", antes), ("Stock Activo 15-08-26 1900.csv", None)]:
    pass
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 15-08-26 0700.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        a = lim(r.get("Artículo"))
        if a.startswith(ESTILO): antes[a] += num(r.get("Cantidad actual"))
todo1900 = defaultdict(float)
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 15-08-26 1900.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        a = lim(r.get("Artículo"))
        if not a.startswith(ESTILO): continue
        todo1900[a] += num(r.get("Cantidad actual"))
        if "BUFFER" in lim(r.get("Área")): buf[a] += num(r.get("Cantidad actual"))

# ---- despues de almacenar (17/08 07:00) ----
desp = defaultdict(float)
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 17-08-26 0700.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        a = lim(r.get("Artículo"))
        if a.startswith(ESTILO): desp[a] += num(r.get("Cantidad actual"))

skus = sorted(set(list(asn) + list(buf) + list(antes) + list(desp)))
print("\n%-16s %8s %8s %8s %8s %9s %9s" % ("SKU", "ASN", "antes", "buffer", "subida", "ASN-buf", "%falta"), file=sys.stderr)
tA = tB = tS = 0.0
for s in skus:
    subida = todo1900[s] - antes[s]
    falta = asn[s] - buf[s]
    pct = (falta / asn[s] * 100) if asn[s] else 0
    tA += asn[s]; tB += buf[s]; tS += subida
    print("%-16s %8.0f %8.0f %8.0f %8.0f %9.0f %8.1f%%" % (
        s, asn[s], antes[s], buf[s], subida, falta, pct), file=sys.stderr)
print("%-16s %8.0f %8s %8.0f %8.0f %9.0f %8.1f%%" % ("TOTAL", tA, "", tB, tS, tA-tB, (tA-tB)/tA*100 if tA else 0), file=sys.stderr)

print("\n=== las lineas del ASN de este estilo ===", file=sys.stderr)
for d in sorted(det, key=lambda x: (x["sku"], x["verif"])):
    print("  %-14s %-26s %-22s %6.0f  verif %s  LPN %s  recep %s" % (
        d["sku"], d["envio"], d["lpn"], d["q"], d["verif"], d["lpn_estado"], d["recep_lpn"]), file=sys.stderr)
