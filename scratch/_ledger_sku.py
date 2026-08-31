# -*- coding: utf-8 -*-
"""HISTORIAL COMPLETO del SKU 6116913-1-07 (PUMPS TACO 3 LUNA negro, talla 38):
los 1.038 pares del ASN seguidos etapa por etapa hasta el despacho.
Salida: _ledger_sku.json"""
import csv, io, os, re, json, glob, sys, zipfile
from datetime import datetime
from collections import defaultdict

csv.field_size_limit(10**7)
OD  = r"C:\Users\dames\OneDrive\danielames.bata"
SCR = os.path.join(OD, "scraping Stock")
SKU = "6116913-1-07"

def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0
def fec(v):
    v = lim(v)
    for f in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try: return datetime.strptime(v, f)
        except: pass
    return None
def leer(p):
    if not os.path.exists(p): return []
    with io.open(p, encoding="utf-8-sig", newline="", errors="replace") as f:
        return list(csv.DictReader(f, delimiter=";"))

R = {"sku": SKU}

# ================= 1. ASN =================
asn = []
for r in leer(r"C:\Users\dames\Downloads\ASN Revisar.csv"):
    if lim(r.get("Código de SKU")) != SKU: continue
    asn.append({"envio": lim(r.get("Envío de entrada")), "estado": lim(r.get("Estado")),
                "tipo": lim(r.get("OBLIGATORIO: Tipo ASN")),
                "enviado": num(r.get("Cantidad enviada de detalle de envío de entrada")),
                "recibido": num(r.get("Cantidad recibida de detalle de envío de entrada")),
                "fecha_envio": lim(r.get("Fecha de envío")),
                "verificado": lim(r.get("Hora de verificación")),
                "proveedor": lim(r.get("Información de proveedor"))})
asn.sort(key=lambda x: x["verificado"])
R["asn"] = {"lineas": asn, "enviado": sum(a["enviado"] for a in asn),
            "recibido": sum(a["recibido"] for a in asn)}
print("ASN: %d lineas, %.0f enviados, %.0f recibidos" % (len(asn), R["asn"]["enviado"], R["asn"]["recibido"]), file=sys.stderr)

# ================= 2. STOCK, foto por foto =================
fotos = []
for p in sorted(glob.glob(os.path.join(SCR, "Stock Activo", "Stock Activo *.csv"))):
    m = re.search(r"(\d{2})-(\d{2})-(\d{2}) (\d{4})", os.path.basename(p))
    if not m: continue
    d, mes, a, h = m.groups()
    fotos.append(("20%s-%s-%s %s:%s" % (a, mes, d, h[:2], h[2:]), p))
fotos.sort()

serie, buffer_ev, cuerpo_ev = [], [], []
for sello, p in fotos:
    filas = []
    with io.open(p, encoding="utf-8-sig", newline="", errors="replace") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if lim(r.get("Artículo")) != SKU: continue
            filas.append({"area": lim(r.get("Área")), "ubic": lim(r.get("Ubicación")),
                          "cant": num(r.get("Cantidad actual")),
                          "mod": lim(r.get("Registro de hora de modificación")),
                          "user": lim(r.get("Usuario de modificación"))})
    buf = [x for x in filas if "BUFFER" in x["area"]]
    sel = [x for x in filas if x["area"] == "SEL"]
    and_ = [x for x in filas if x["area"] == "AND"]
    serie.append({"foto": sello, "total": sum(x["cant"] for x in filas),
                  "buffer": sum(x["cant"] for x in buf),
                  "selectivo": sum(x["cant"] for x in sel),
                  "andamio": sum(x["cant"] for x in and_),
                  "ubicaciones": len(filas)})
    for b in buf: buffer_ev.append(dict(b, foto=sello))
    for s in sel:
        if s["ubic"].startswith("SEL-07"): cuerpo_ev.append(dict(s, foto=sello))
R["serie"] = serie
R["buffer_eventos"] = buffer_ev
print("fotos leidas: %d" % len(serie), file=sys.stderr)

# ================= 3. PICKING, todos los dias disponibles =================
pk_dia = defaultdict(lambda: {"lineas": 0, "pares": 0.0, "tiendas": set(), "ubic": defaultdict(float), "users": set()})
for p in sorted(glob.glob(os.path.join(SCR, "Picking", "Picking *.csv"))):
    m = re.match(r"Picking (\d+)-(\d+)\.csv", os.path.basename(p))
    if not m: continue
    d, mes = int(m.group(1)), int(m.group(2))
    clave = "2026-%02d-%02d" % (mes, d)
    for r in leer(p):
        if lim(r.get("Código de artículo")) != SKU: continue
        if lim(r.get("Estado")) != "Finalizada": continue
        q = num(r.get("Cantidad empaquetada"))
        e = pk_dia[clave]
        e["lineas"] += 1; e["pares"] += q
        e["tiendas"].add(lim(r.get("Instalación de destino")))
        e["ubic"][lim(r.get("De ubicación"))] += q
        e["users"].add(lim(r.get("Usuario de selección")))
pick = []
for k in sorted(pk_dia):
    e = pk_dia[k]
    pick.append({"dia": k, "lineas": e["lineas"], "pares": e["pares"],
                 "tiendas": len(e["tiendas"]), "personas": len(e["users"]),
                 "ubic": sorted(e["ubic"].items(), key=lambda x: -x[1])})
R["picking"] = pick
R["picking_total"] = {"dias": len(pick), "lineas": sum(p["lineas"] for p in pick),
                      "pares": sum(p["pares"] for p in pick)}
print("picking: %d dias, %.0f pares" % (len(pick), R["picking_total"]["pares"]), file=sys.stderr)

# ================= 4. OBLPN: embalaje, patio, despacho =================
mejor = {}
for p in sorted(glob.glob(os.path.join(SCR, "OBLPN Embalaje", "*.csv"))):
    for r in leer(p):
        if lim(r.get("Código de artículo")) != SKU: continue
        k = (lim(r.get("Número de LPN")), lim(r.get("Número de orden")))
        f = fec(r.get("Registro de hora de modificación de LPN"))
        pr = mejor.get(k)
        if pr is None or (f and (pr[0] is None or f > pr[0])): mejor[k] = (f, r)

est = defaultdict(lambda: {"lineas": 0, "pares": 0.0, "bultos": set()})
patio, rutas = [], defaultdict(float)
CORTE = datetime(2026, 8, 29, 6, 0)
for f, r in mejor.values():
    e = lim(r.get("Estado de LPN")); q = num(r.get("Cantidad empaquetada"))
    est[e]["lineas"] += 1; est[e]["pares"] += q; est[e]["bultos"].add(lim(r.get("Número de LPN")))
    if e == "Cancelado": continue
    rutas[lim(r.get("De número de ruta"))] += q
    if e == "Empaquetado":
        fe = fec(r.get("Registro de hora de empaquetado"))
        patio.append({"lpn": lim(r.get("Número de LPN")), "pares": q,
                      "ruta": lim(r.get("De número de ruta")), "tienda": lim(r.get("Instalación de destino")),
                      "empacado": lim(r.get("Registro de hora de empaquetado")),
                      "horas": round((CORTE-fe).total_seconds()/3600, 1) if fe else None})
patio.sort(key=lambda x: -(x["horas"] or 0))
R["oblpn"] = {k: {"lineas": v["lineas"], "pares": v["pares"], "bultos": len(v["bultos"])}
              for k, v in est.items()}
R["patio"] = patio
R["rutas"] = sorted([(k, v) for k, v in rutas.items() if k], key=lambda x: -x[1])
print("OBLPN estados: %s" % json.dumps({k: v["pares"] for k, v in est.items()}), file=sys.stderr)

# ================= 5. EL BALANCE =================
f0 = serie[0]; fN = serie[-1]
antes = next(s for s in serie if s["foto"] == "2026-08-15 07:00")
pico  = next(s for s in serie if s["foto"] == "2026-08-15 19:00")
pick_desde15 = sum(p["pares"] for p in pick if p["dia"] >= "2026-08-15")
R["balance"] = {
  "stock_antes": antes["total"], "foto_antes": antes["foto"],
  "asn_recibido": R["asn"]["recibido"],
  "buffer_matriculado": pico["buffer"],
  "stock_pico": pico["total"], "foto_pico": pico["foto"],
  "picado_desde_15": pick_desde15,
  "stock_final": fN["total"], "foto_final": fN["foto"],
  "cuadre": round(pico["total"] - pick_desde15 - fN["total"], 0),
}
io.open("_ledger_sku.json", "w", encoding="utf-8").write(json.dumps(R, ensure_ascii=False, indent=1))
print("\nBALANCE:", json.dumps(R["balance"], ensure_ascii=False, indent=1), file=sys.stderr)
