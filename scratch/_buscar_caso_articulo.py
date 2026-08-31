# -*- coding: utf-8 -*-
"""Busca un SKU DE DAMA (WOMEN) con su talla que tenga la cadena COMPLETA:
ASN -> stock -> pedido -> picking -> embalaje -> carga -> despacho, con las horas
en orden. En estos archivos el Codigo de articulo YA es el SKU con su talla:
la descripcion termina en -1-<talla>.  Salida: _caso_articulo.json"""
import csv, json, io, os, sys, re
from datetime import datetime
from collections import defaultdict

csv.field_size_limit(10**7)
OD  = r"C:\Users\dames\OneDrive\danielames.bata"
SCR = os.path.join(OD, "scraping Stock")
DIAS = ["24-08", "25-08", "26-08", "27-08", "28-08"]

def leer(ruta):
    if not os.path.exists(ruta): return []
    with io.open(ruta, encoding="utf-8-sig", newline="", errors="replace") as f:
        return list(csv.DictReader(f, delimiter=";"))

def lim(v):
    return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')

def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0

def fec(v):
    v = lim(v)
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try: return datetime.strptime(v, fmt)
        except: pass
    return None

def talla(desc):
    m = re.search(r"-(\d{1,2}(?:\.\d)?)$", (desc or "").strip())
    return m.group(1) if m else None

# ---------- 1. OBLPN: bultos ENVIADOS de dama, con las tres horas ----------
print("leyendo OBLPN...", file=sys.stderr)
mejor = {}
for d in DIAS:
    for r in leer(os.path.join(SCR, "OBLPN Embalaje", "OBLPN %s.csv" % d)):
        k = (lim(r.get("Número de LPN")), lim(r.get("Código de artículo")))
        f = fec(r.get("Registro de hora de modificación de LPN"))
        p = mejor.get(k)
        if p is None or (f and (p[0] is None or f > p[0])): mejor[k] = (f, r)

arts_ob = defaultdict(list)
for f, r in mejor.values():
    if lim(r.get("Estado de LPN")) != "Enviado": continue
    if lim(r.get("Jerarquía de artículo 1")) != "WOMEN": continue
    fp, fe, fc = (fec(r.get("Detail Picked Time")), fec(r.get("Registro de hora de empaquetado")),
                  fec(r.get("Hora de asignación de carga")))
    if not (fp and fe and fc and fp <= fe <= fc): continue
    if num(r.get("Cantidad empaquetada")) <= 0: continue
    if not lim(r.get("De número de ruta")): continue
    if not talla(lim(r.get("Descripción de artículo"))): continue
    arts_ob[lim(r.get("Código de artículo"))].append({"r": r, "fp": fp, "fe": fe, "fc": fc})
print("SKU de dama enviados con cadena completa:", len(arts_ob), file=sys.stderr)

# ---------- 2. ASN: el mismo SKU, verificado ----------
print("leyendo ASN...", file=sys.stderr)
asn = defaultdict(list)
for r in leer(r"C:\Users\dames\Downloads\ASN Revisar.csv"):
    a = lim(r.get("Código de SKU"))
    if a in arts_ob and lim(r.get("Estado")) == "Verificado" and num(r.get("Cantidad recibida de detalle de envío de entrada")) > 0:
        asn[a].append(r)
print("de esos, con ASN verificado:", len(asn), file=sys.stderr)

# ---------- 3. PICKING ----------
print("leyendo picking...", file=sys.stderr)
pick = defaultdict(list)
for d in DIAS:
    for r in leer(os.path.join(SCR, "Picking", "Picking %d-%d.csv" % (int(d[:2]), int(d[3:])))):
        a = lim(r.get("Código de artículo"))
        if a in asn and lim(r.get("Estado")) == "Finalizada":
            pick[a].append(r)
print("de esos, con linea de picking:", len(pick), file=sys.stderr)

# ---------- 4. DETALLE DE ORDEN ----------
print("leyendo detalle de orden...", file=sys.stderr)
orden = defaultdict(list)
for d in DIAS:
    for r in leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden %s.csv" % d)):
        a = lim(r.get("Código de artículo"))
        if a in pick: orden[a].append(r)
print("de esos, con orden:", len(orden), file=sys.stderr)

# ---------- 5. STOCK ACTIVO ----------
print("leyendo stock activo...", file=sys.stderr)
stock = defaultdict(list)
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 28-08-26 1900.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        a = lim(r.get("Artículo"))
        if a in pick: stock[a].append(r)

# ---------- elegir ----------
elegibles = [a for a in pick if orden.get(a) and stock.get(a)]
print("candidatos con la cadena COMPLETA:", len(elegibles), file=sys.stderr)
if not elegibles: elegibles = list(pick)

def clave(a):
    # que la orden se haya creado antes de picar, y que haya un ASN viejo detras
    fs = [fec(x.get("Fecha de envío")) for x in asn[a]]
    fs = [x for x in fs if x]
    return (-(len(arts_ob[a]) + len(pick[a]) + len(stock[a])), min(fs) if fs else datetime(2099,1,1))
elegibles.sort(key=clave)

top = []
for a in elegibles[:15]:
    d0 = lim(arts_ob[a][0]["r"].get("Descripción de artículo"))
    top.append({"sku": a, "talla": talla(d0), "desc": d0[:64],
                "asn": len(asn[a]), "pick": len(pick[a]), "orden": len(orden[a]),
                "ubic_stock": len(stock[a]), "bultos": len(arts_ob[a])})
print(json.dumps(top, ensure_ascii=False, indent=1), file=sys.stderr)

sel = elegibles[0]
salida = {"sku": sel, "talla": talla(lim(arts_ob[sel][0]["r"].get("Descripción de artículo"))),
          "asn": asn[sel], "picking": pick[sel], "orden": orden[sel], "stock": stock[sel],
          "oblpn": [x["r"] for x in arts_ob[sel]], "candidatos": top}
io.open("_caso_articulo.json", "w", encoding="utf-8").write(json.dumps(salida, ensure_ascii=False, indent=1))
print("OK -> _caso_articulo.json  SKU elegido:", sel, file=sys.stderr)
