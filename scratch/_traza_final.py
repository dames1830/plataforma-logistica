# -*- coding: utf-8 -*-
"""Arma la traza final del SKU 6116913-1-07 talla 38 para la maqueta.
Un hilo: ASN -> stock -> orden 8003497 -> picking -> bulto 508004111790 -> camion."""
import csv, json, io, os, re, glob, sys
from datetime import datetime
from collections import defaultdict

csv.field_size_limit(10**7)
SCR = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock"
SKU, ORDEN, LPN, TIENDA = "6116913-1-07", "8003497", "508004111790", "50208"
DIAS = ["24-08", "25-08", "26-08", "27-08", "28-08"]
SEM = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"]

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
def dia(f): return SEM[f.weekday()] if f else None
def leer(p):
    if not os.path.exists(p): return []
    with io.open(p, encoding="utf-8-sig", newline="", errors="replace") as f:
        return list(csv.DictReader(f, delimiter=";"))

R = {}

# ---- el bulto completo, linea por linea ----
lineas = {}
for p in sorted(glob.glob(os.path.join(SCR, "OBLPN Embalaje", "*.csv"))):
    for r in leer(p):
        if lim(r.get("Número de LPN")) != LPN: continue
        lineas[(lim(r.get("Número de orden")), lim(r.get("Código de artículo")))] = r
uno = next(r for (o, a), r in lineas.items() if a == SKU)

bulto = []
for (o, a), r in sorted(lineas.items(), key=lambda x: fec(x[1].get("Detail Picked Time")) or datetime(2099,1,1)):
    bulto.append({"orden": o, "sku": a, "desc": lim(r.get("Descripción de artículo")),
                  "pares": num(r.get("Cantidad empaquetada")), "ubic": lim(r.get("Ubicación de selección")),
                  "hora": (fec(r.get("Detail Picked Time")) or datetime(2099,1,1)).strftime("%H:%M:%S"),
                  "es_nuestro": a == SKU, "marca": lim(r.get("Jerarquía de artículo 4"))})
fp0 = min(fec(r.get("Detail Picked Time")) for r in lineas.values())
fp1 = max(fec(r.get("Detail Picked Time")) for r in lineas.values())
R["bulto"] = {
  "lpn": LPN, "tipo": lim(uno.get("Tipo de LPN")), "estado": lim(uno.get("Estado de LPN")),
  "ruta": lim(uno.get("De número de ruta")), "tienda": TIENDA,
  "lineas": len(bulto), "pares": sum(b["pares"] for b in bulto),
  "ordenes": sorted(set(b["orden"] for b in bulto)),
  "lineas_de_1_par": sum(1 for b in bulto if b["pares"] == 1),
  "recorrido_min": round((fp1 - fp0).total_seconds()/60, 0),
  "primera_parada": fp0.strftime("%H:%M:%S"), "ultima_parada": fp1.strftime("%H:%M:%S"),
  "detalle": bulto,
  "creado": lim(uno.get("Registro de hora de creación de LPN")),
  "empacado": lim(uno.get("Registro de hora de empaquetado")),
  "etiqueta": lim(uno.get("Etiqueta de envío: último registro de hora impreso")),
  "cargado": lim(uno.get("Hora de asignación de carga")),
  "carga": lim(uno.get("Número de carga")),
  "user_pick": lim(uno.get("Detail Pick User")),
  "user_lpn": lim(uno.get("Usuario de modificación de LPN")),
  "user_asig": lim(uno.get("Usuario de modificación de asignación")),
  "user_carga": lim(uno.get("Usuario de carga")),
  "ejecucion": lim(uno.get("Número de ejecución")),
}

# ---- nuestra linea ----
R["linea"] = {"sku": SKU, "desc": lim(uno.get("Descripción de artículo")), "talla": "38",
              "pares": num(uno.get("Cantidad empaquetada")), "ubic": lim(uno.get("Ubicación de selección")),
              "picado": lim(uno.get("Detail Picked Time")),
              "jer": [lim(uno.get("Jerarquía de artículo %d" % i)) for i in (1,2,3,4)],
              "barra": lim(uno.get("Código de barras de artículo"))}

# ---- la orden ----
for d in DIAS:
    for r in leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden %s.csv" % d)):
        if lim(r.get("Número de orden")) == ORDEN and lim(r.get("Código de artículo")) == SKU:
            R["orden"] = {"orden": ORDEN, "tipo": lim(r.get("Tipo de orden")),
                          "estado": lim(r.get("Estado de orden")), "tienda": lim(r.get("Instalación de destino")),
                          "solicitada": num(r.get("Cantidad solicitada")),
                          "creada": lim(r.get("Registro de hora de creación de cabecera de orden")),
                          "requerida": lim(r.get("Fecha de envío requerida"))}
# tamano total de la orden
tot_o = {}
for d in DIAS:
    for r in leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden %s.csv" % d)):
        if lim(r.get("Número de orden")) == ORDEN:
            tot_o[lim(r.get("Código de artículo"))] = num(r.get("Cantidad solicitada"))
R["orden"]["skus"] = len(tot_o); R["orden"]["pares"] = sum(tot_o.values())

# ---- la linea de picking ----
for d in DIAS:
    for r in leer(os.path.join(SCR, "Picking", "Picking %d-%d.csv" % (int(d[:2]), int(d[3:])))):
        if lim(r.get("Número de orden")) == ORDEN and lim(r.get("Código de artículo")) == SKU:
            R["pick"] = {"tarea": lim(r.get("Número de tarea")), "ejecucion": lim(r.get("Número de ejecución")),
                         "de_ubic": lim(r.get("De ubicación")), "usuario": lim(r.get("Usuario de selección")),
                         "hora": lim(r.get("Hora de selección")), "creador": lim(r.get("Crear usuario")),
                         "orig": num(r.get("Cantidad de orden original")), "emp": num(r.get("Cantidad empaquetada"))}

# ---- ASN, stock, totales del SKU (del paso anterior) ----
prev = json.load(io.open("_traza_sku.json", encoding="utf-8"))
R["asn"] = prev["asn"]; R["stock"] = prev["stock_activo"]
R["sku_totales"] = {"picking": prev["picking_total"], "bultos": prev["bultos_total"]}

# ---- la linea de tiempo ----
hitos = [
  ("Salio del proveedor", R["asn"][0]["fecha_envio"], "ASN Revisar.csv", "4 envios IMP"),
  ("Verificado en el CD", R["asn"][0]["verificado"], "ASN Revisar.csv", "1.038 de 1.038 pares"),
  ("Comercial lo pidio", R["orden"]["creada"], "Detalle Orden", "orden " + ORDEN),
  ("Lo picaron del rack", R["pick"]["hora"], "Picking / OBLPN", R["pick"]["usuario"]),
  ("Se cerro el bulto", R["bulto"]["empacado"], "OBLPN", "LPN " + LPN),
  ("Se imprimio la etiqueta", R["bulto"]["etiqueta"], "OBLPN", ""),
  ("Subio al camion", R["bulto"]["cargado"], "OBLPN", R["bulto"]["user_carga"]),
]
tl = []
for nombre, cuando, arch, quien in hitos:
    f = fec(cuando)
    tl.append({"hito": nombre, "cuando": cuando, "dia": dia(f), "archivo": arch, "quien": quien,
               "ts": f.isoformat() if f else None})
R["linea_tiempo"] = tl

f_env, f_ver = fec(R["asn"][0]["fecha_envio"]), fec(R["asn"][0]["verificado"])
f_ped, f_pic = fec(R["orden"]["creada"]), fec(R["pick"]["hora"])
f_emp, f_car = fec(R["bulto"]["empacado"]), fec(R["bulto"]["cargado"])
R["tramos"] = [
  {"t": "Viaje del proveedor al CD", "d": (f_ver-f_env).days, "u": "dias"},
  {"t": "Esperando en el piso a que lo pidan", "d": (f_ped-f_ver).days, "u": "dias"},
  {"t": "Del pedido al picking", "h": round((f_pic-f_ped).total_seconds()/3600,1)},
  {"t": "Picar y cerrar el bulto", "h": round((f_emp-f_pic).total_seconds()/3600,1)},
  {"t": "Esperando el camion", "h": round((f_car-f_emp).total_seconds()/3600,1)},
]
R["total_h"] = round((f_car-f_ped).total_seconds()/3600, 1)
R["total_dias_cd"] = (f_car - f_ver).days
R["total_dias_todo"] = (f_car - f_env).days
R["tienda"] = {"cdg": TIENDA, "nombre": "B PLAZA NORTE", "zona": "LIMA", "turno": "NOCHE",
               "ruta2": "R028", "dias": "LUNES - MIERCOLES - VIERNES"}

io.open("_traza_final.json","w",encoding="utf-8").write(json.dumps(R, ensure_ascii=False, indent=1))
print(json.dumps({"linea_tiempo": R["linea_tiempo"], "tramos": R["tramos"],
                  "total_h": R["total_h"], "dias_cd": R["total_dias_cd"], "dias_todo": R["total_dias_todo"],
                  "bulto": {k: v for k, v in R["bulto"].items() if k != "detalle"},
                  "orden": R["orden"], "pick": R["pick"]}, ensure_ascii=False, indent=1))
