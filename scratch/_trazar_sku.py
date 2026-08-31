# -*- coding: utf-8 -*-
"""Traza UN hilo completo del SKU 6116913-1-07 (PUMPS TACO 3 LUNA negro, talla 38):
una orden que exista en el Detalle de Orden, en el picking y en el OBLPN, con todas
sus horas. Salida: _traza_sku.json"""
import csv, json, io, os, sys, re, zipfile
from datetime import datetime
from collections import defaultdict

csv.field_size_limit(10**7)
OD  = r"C:\Users\dames\OneDrive\danielames.bata"
SCR = os.path.join(OD, "scraping Stock")
DIAS = ["24-08", "25-08", "26-08", "27-08", "28-08"]
SKU  = "6116913-1-07"
ESTILO = SKU.split("-")[0]           # 6116913 -> el resto de tallas del mismo modelo

def leer(ruta):
    if not os.path.exists(ruta): return []
    with io.open(ruta, encoding="utf-8-sig", newline="", errors="replace") as f:
        return list(csv.DictReader(f, delimiter=";"))

def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
def num(v):
    try: return float(lim(v) or 0)
    except: return 0.0
def fec(v):
    v = lim(v)
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try: return datetime.strptime(v, fmt)
        except: pass
    return None
def iso(f): return f.strftime("%d/%m/%Y %H:%M") if f else None

R = {"sku": SKU}

# ---------- ASN: de donde vino este SKU ----------
asn = []
for r in leer(r"C:\Users\dames\Downloads\ASN Revisar.csv"):
    if lim(r.get("Código de SKU")) != SKU: continue
    asn.append({"envio": lim(r.get("Envío de entrada")), "estado": lim(r.get("Estado")),
                "tipo": lim(r.get("OBLIGATORIO: Tipo ASN")),
                "enviado": num(r.get("Cantidad enviada de detalle de envío de entrada")),
                "recibido": num(r.get("Cantidad recibida de detalle de envío de entrada")),
                "fecha_envio": lim(r.get("Fecha de envío")),
                "verificado": lim(r.get("Hora de verificación")),
                "proveedor": lim(r.get("Información de proveedor")),
                "ubicacion": lim(r.get("Ubicación")), "origen": lim(r.get("Instalación de origen")),
                "marca": lim(r.get("Jerarquía de artículo 4")), "desc": lim(r.get("Descripción de artículo"))})
asn.sort(key=lambda x: fec(x["fecha_envio"]) or datetime(2099,1,1))
R["asn"] = asn
print("ASN:", len(asn), file=sys.stderr)

# ---------- STOCK: donde vive hoy ----------
act, mate = [], 0
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 28-08-26 1900.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if lim(r.get("Artículo")) != SKU: continue
        act.append({"area": lim(r.get("Área")), "ubicacion": lim(r.get("Ubicación")),
                    "cant": num(r.get("Cantidad actual")), "asignada": num(r.get("Cantidad asignada")),
                    "tipo_ubic": lim(r.get("Tipo de ubicación")),
                    "modificado": lim(r.get("Registro de hora de modificación"))})
act.sort(key=lambda x: -x["cant"])
R["stock_activo"] = act
print("ubicaciones en piso:", len(act), file=sys.stderr)

# ---------- STOCK RESERVA (xlsx, cabecera fila 3) ----------
res = []
try:
    z = zipfile.ZipFile(os.path.join(SCR, "Stock Reserva", "Stock Reserva 28-08-26 1900.xlsx"))
    sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    sh = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S))
          for s in re.findall(r"<si>(?:(?!</si>).)*?</si>", sx, re.S)]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
    filas = re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)
    def celdas(fila):
        out = {}
        for col, attr, cuerpo in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)(?:/>|>(.*?)</c>)', fila, re.S):
            v = re.search(r"<v>(.*?)</v>", cuerpo or "", re.S)
            x = v.group(1) if v else ""
            if 't="s"' in attr and x:
                try: x = sh[int(x)]
                except: pass
            out[col] = x
        return out
    hdr = {v.strip(): k for k, v in celdas(filas[2]).items() if v.strip()}
    for fila in filas[3:]:
        c = celdas(fila)
        if (c.get(hdr.get("ARTICULO",""), "") or "").strip() != SKU: continue
        res.append({"ubicacion": c.get(hdr.get("UBICACION",""), ""), "lpn": c.get(hdr.get("LPN",""), ""),
                    "nivel": c.get(hdr.get("NIVEL",""), ""), "zona": c.get(hdr.get("ZONA",""), ""),
                    "cant": float(c.get(hdr.get("CANTIDAD",""), 0) or 0)})
except Exception as e:
    print("reserva:", e, file=sys.stderr)
R["stock_reserva"] = res
print("paletas en reserva:", len(res), file=sys.stderr)

# ---------- PICKING ----------
picks = []
for d in DIAS:
    for r in leer(os.path.join(SCR, "Picking", "Picking %d-%d.csv" % (int(d[:2]), int(d[3:])))):
        if lim(r.get("Código de artículo")) != SKU: continue
        if lim(r.get("Estado")) != "Finalizada": continue
        picks.append({"orden": lim(r.get("Número de orden")), "destino": lim(r.get("Instalación de destino")),
                      "orig": num(r.get("Cantidad de orden original")), "emp": num(r.get("Cantidad empaquetada")),
                      "de_ubicacion": lim(r.get("De ubicación")), "contenedor": lim(r.get("Número de contenedor")),
                      "tarea": lim(r.get("Número de tarea")), "ejecucion": lim(r.get("Número de ejecución")),
                      "creado": lim(r.get("Crear registro de hora")), "picado": lim(r.get("Hora de selección")),
                      "usuario": lim(r.get("Usuario de selección")), "creador": lim(r.get("Crear usuario")),
                      "jer2": lim(r.get("Jerarquía de artículo 2")), "jer3": lim(r.get("Jerarquía de artículo 3"))})
R["picking_total"] = {"lineas": len(picks), "pares": sum(p["emp"] for p in picks),
                      "tiendas": len(set(p["destino"] for p in picks)),
                      "usuarios": sorted(set(p["usuario"] for p in picks if p["usuario"])),
                      "ubicaciones": sorted(set(p["de_ubicacion"] for p in picks if p["de_ubicacion"]))}
print("lineas de picking:", len(picks), file=sys.stderr)

# ---------- OBLPN ----------
mejor = {}
for d in DIAS:
    for r in leer(os.path.join(SCR, "OBLPN Embalaje", "OBLPN %s.csv" % d)):
        if lim(r.get("Código de artículo")) != SKU: continue
        k = (lim(r.get("Número de LPN")), lim(r.get("Número de orden")))
        f = fec(r.get("Registro de hora de modificación de LPN"))
        p = mejor.get(k)
        if p is None or (f and (p[0] is None or f > p[0])): mejor[k] = (f, r)
bultos = []
for f, r in mejor.values():
    if lim(r.get("Estado de LPN")) == "Cancelado": continue
    bultos.append({"lpn": lim(r.get("Número de LPN")), "orden": lim(r.get("Número de orden")),
                   "estado": lim(r.get("Estado de LPN")), "cant": num(r.get("Cantidad empaquetada")),
                   "ruta": lim(r.get("De número de ruta")), "destino": lim(r.get("Instalación de destino")),
                   "ubic_sel": lim(r.get("Ubicación de selección")),
                   "picado": lim(r.get("Detail Picked Time")), "pick_user": lim(r.get("Detail Pick User")),
                   "empacado": lim(r.get("Registro de hora de empaquetado")), "pack_user": lim(r.get("Usuario de paquete")),
                   "cargado": lim(r.get("Hora de asignación de carga")), "carga_user": lim(r.get("Usuario de carga")),
                   "creado": lim(r.get("Registro de hora de creación de LPN")),
                   "peso": lim(r.get("Peso")), "volumen": lim(r.get("Volumen")),
                   "carga": lim(r.get("Número de carga")), "seguimiento": lim(r.get("Número de seguimiento"))})
R["bultos_total"] = {"bultos": len(bultos), "pares": sum(b["cant"] for b in bultos),
                     "enviados": sum(1 for b in bultos if b["estado"] == "Enviado"),
                     "en_patio": sum(1 for b in bultos if b["estado"] == "Empaquetado"),
                     "pares_patio": sum(b["cant"] for b in bultos if b["estado"] == "Empaquetado"),
                     "rutas": sorted(set(b["ruta"] for b in bultos if b["ruta"]))}
print("bultos:", len(bultos), file=sys.stderr)

# ---------- DETALLE DE ORDEN ----------
ords = {}
for d in DIAS:
    for r in leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden %s.csv" % d)):
        if lim(r.get("Código de artículo")) != SKU: continue
        ords[lim(r.get("Número de orden"))] = {
            "orden": lim(r.get("Número de orden")), "estado": lim(r.get("Estado de orden")),
            "cadena": lim(r.get("OBLIGATORIO: Cadena")), "tipo": lim(r.get("Tipo de orden")),
            "solicitada": num(r.get("Cantidad solicitada")), "orig": num(r.get("Cantidad de orden original")),
            "asignada": num(r.get("Cantidad asignada")), "empaquetada": num(r.get("Cantidad empaquetada")),
            "destino": lim(r.get("Instalación de destino")),
            "creada": lim(r.get("Registro de hora de creación de cabecera de orden")),
            "fecha_orden": lim(r.get("Fecha de orden")),
            "envio_requerido": lim(r.get("Fecha de envío requerida"))}
print("ordenes en el detalle:", len(ords), file=sys.stderr)

# ---------- EL HILO: una orden que este en los tres ----------
por_orden = defaultdict(dict)
for p in picks: por_orden[p["orden"]]["pick"] = p
for b in bultos: por_orden[b["orden"]].setdefault("bultos", []).append(b)
for o, v in ords.items(): por_orden[o]["orden"] = v

hilos = []
for o, v in por_orden.items():
    if not (v.get("pick") and v.get("bultos") and v.get("orden")): continue
    env = [b for b in v["bultos"] if b["estado"] == "Enviado" and b["cargado"]]
    if not env: continue
    b = max(env, key=lambda x: x["cant"])
    fo, fp, fe, fc = (fec(v["orden"]["creada"]), fec(b["picado"]), fec(b["empacado"]), fec(b["cargado"]))
    if not (fo and fp and fe and fc and fo <= fp <= fe <= fc): continue
    hilos.append({"orden": v["orden"], "pick": v["pick"], "bulto": b,
                  "h_pedido_pick": round((fp-fo).total_seconds()/3600, 1),
                  "h_pick_emp": round((fe-fp).total_seconds()/3600, 1),
                  "h_emp_carga": round((fc-fe).total_seconds()/3600, 1),
                  "h_total": round((fc-fo).total_seconds()/3600, 1)})
hilos.sort(key=lambda x: -x["bulto"]["cant"])
R["hilos"] = hilos[:10]
R["ordenes"] = list(ords.values())[:20]
R["bultos"] = sorted(bultos, key=lambda x: -x["cant"])[:20]
R["picks"] = sorted(picks, key=lambda x: -x["emp"])[:20]
print("hilos completos y en orden:", len(hilos), file=sys.stderr)

io.open("_traza_sku.json", "w", encoding="utf-8").write(json.dumps(R, ensure_ascii=False, indent=1))
print("OK -> _traza_sku.json", file=sys.stderr)
