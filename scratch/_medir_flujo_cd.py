# -*- coding: utf-8 -*-
"""Mide el circuito completo del CD: ASN -> pedido -> picking -> embalaje -> carga -> despacho.
Salida: _flujo_cd.json  (lo consume la maqueta del diagrama de flujo)."""
import csv, json, sys, os, io
from datetime import datetime
from collections import defaultdict

csv.field_size_limit(10**7)
OD  = r"C:\Users\dames\OneDrive\danielames.bata"
SCR = os.path.join(OD, "scraping Stock")
DIAS = ["24-08", "25-08", "26-08", "27-08", "28-08"]

def leer(ruta):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            with io.open(ruta, encoding=enc, newline="") as f:
                return list(csv.DictReader(f, delimiter=";"))
        except UnicodeDecodeError:
            continue
    return []

def num(v):
    try: return float(str(v).replace('="','').replace('"','').strip() or 0)
    except: return 0.0

def fecha(v):
    v = (v or "").strip()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try: return datetime.strptime(v, fmt)
        except: pass
    return None

R = {}

# ---------------- 1. ENTRADA: el ASN ----------------
asn = leer(r"C:\Users\dames\Downloads\ASN Revisar.csv")
HOY = datetime(2026, 8, 29)
e_est, e_tipo, futuro = defaultdict(lambda: [0,0.0,0.0]), defaultdict(lambda: [0.0,0.0]), defaultdict(float)
venc = [0, 0.0]; masvieja = None
for r in asn:
    est, tipo = (r.get("Estado") or "").strip(), (r.get("OBLIGATORIO: Tipo ASN") or "").strip()
    env, rec = num(r.get("Cantidad enviada de detalle de envío de entrada")), num(r.get("Cantidad recibida de detalle de envío de entrada"))
    e_est[est][0] += 1; e_est[est][1] += env; e_est[est][2] += rec
    if tipo: e_tipo[tipo][0] += env; e_tipo[tipo][1] += rec
    if est == "En tránsito":
        f = fecha(r.get("Fecha de envío"))
        if f and f >= HOY: futuro[f.strftime("%Y-%m-%d")] += env
        elif f:
            venc[0] += 1; venc[1] += env
            if masvieja is None or f < masvieja: masvieja = f
R["asn"] = {
    "archivo": "ASN Revisar.csv", "filas": len(asn), "columnas": len(asn[0]) if asn else 0,
    "estados": {k: {"lineas": v[0], "enviado": v[1], "recibido": v[2]} for k, v in e_est.items()},
    "tipos": {k: {"enviado": v[0], "recibido": v[1]} for k, v in e_tipo.items()},
    "en_transito_futuro": sum(futuro.values()),
    "ola": sorted(futuro.items(), key=lambda x: -x[1])[:6],
    "vencidas_lineas": venc[0], "vencidas_unid": venc[1],
    "mas_vieja": masvieja.strftime("%d/%m/%Y") if masvieja else None,
    "dias_mas_vieja": (HOY - masvieja).days if masvieja else None,
}
print("ASN listo:", len(asn), "filas", file=sys.stderr)

# ---------------- 2. PEDIDO: lo creado en la ventana + el pendiente ----------------
ped = {}
for d in DIAS:
    for r in leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden %s.csv" % d)):
        ped[(r.get("Número de orden"), r.get("Código de artículo"))] = r
d_est = defaultdict(lambda: [0, 0.0, 0.0])
for r in ped.values():
    est = (r.get("Estado de orden") or "").strip()
    d_est[est][0] += 1
    d_est[est][1] += num(r.get("Cantidad de orden original"))
    d_est[est][2] += num(r.get("Cantidad empaquetada"))
R["pedido"] = {"archivo": "Detalle Orden <d>-<m>.csv", "dias": DIAS, "lineas_unicas": len(ped),
               "ordenes": len(set(k[0] for k in ped)),
               "estados": {k: {"lineas": v[0], "orig": v[1], "emp": v[2]} for k, v in d_est.items()}}

pend = leer(os.path.join(SCR, "Detalle Orden", "Detalle Orden Pendientes.csv"))
p_est, p_edad = defaultdict(lambda: [0, 0.0]), defaultdict(lambda: [0, 0.0])
for r in pend:
    est = (r.get("Estado de orden") or "").strip()
    q = num(r.get("Cantidad solicitada")) - num(r.get("Cantidad empaquetada"))
    p_est[est][0] += 1; p_est[est][1] += max(q, 0)
    f = fecha(r.get("Registro de hora de creación de cabecera de orden"))
    if f:
        dd = (HOY - f).days
        b = "0-7 dias" if dd <= 7 else "8-30" if dd <= 30 else "31-90" if dd <= 90 else "91-180" if dd <= 180 else "+180"
        p_edad[b][0] += 1; p_edad[b][1] += max(q, 0)
R["pendiente"] = {"archivo": "Detalle Orden Pendientes.csv", "filas": len(pend),
                  "estados": {k: {"lineas": v[0], "unid": v[1]} for k, v in p_est.items()},
                  "edad": {k: {"lineas": v[0], "unid": v[1]} for k, v in p_edad.items()}}
print("Pedido/pendiente listo:", len(ped), len(pend), file=sys.stderr)

# ---------------- 3. PICKING ----------------
pk_est = defaultdict(lambda: [0, 0.0, 0.0])
pk_dia = {}
for d in DIAS:
    ruta = os.path.join(SCR, "Picking", "Picking %s.csv" % d.lstrip("0").replace("-0", "-"))
    if not os.path.exists(ruta):
        ruta = os.path.join(SCR, "Picking", "Picking %d-%d.csv" % (int(d[:2]), int(d[3:])))
    rows = leer(ruta)
    fin = [r for r in rows if (r.get("Estado") or "").strip() == "Finalizada"]
    pk_dia[d] = {"filas": len(rows), "finalizadas": len(fin),
                 "orig": sum(num(r.get("Cantidad de orden original")) for r in fin),
                 "emp": sum(num(r.get("Cantidad empaquetada")) for r in fin)}
    for r in rows:
        est = (r.get("Estado") or "").strip()
        pk_est[est][0] += 1
        pk_est[est][1] += num(r.get("Cantidad de orden original"))
        pk_est[est][2] += num(r.get("Cantidad empaquetada"))
R["picking"] = {"archivo": "Picking <d>-<m>.csv", "dias": pk_dia,
                "estados": {k: {"lineas": v[0], "orig": v[1], "emp": v[2]} for k, v in pk_est.items()}}
print("Picking listo", file=sys.stderr)

# ---------------- 4. OBLPN: embalaje / carga / despacho ----------------
# Se deduplica por LPN+SKU quedandose con la modificacion mas nueva:
# un mismo bulto aparece en varios dias porque el filtro es por modificacion.
mejor = {}
filas_total = 0
for d in DIAS:
    rows = leer(os.path.join(SCR, "OBLPN Embalaje", "OBLPN %s.csv" % d))
    filas_total += len(rows)
    for r in rows:
        k = (r.get("Número de LPN"), r.get("Código de artículo"))
        f = fecha(r.get("Registro de hora de modificación de LPN"))
        prev = mejor.get(k)
        if prev is None or (f and (prev[0] is None or f > prev[0])):
            mejor[k] = (f, r)
regs = [v[1] for v in mejor.values()]

ob_est = defaultdict(lambda: [0, 0.0, set()])
horas = {"pick_emp": [], "emp_carga": [], "carga_env": [], "pick_carga": []}
rutas, destinos = defaultdict(float), set()
espera_patio = []
patio_tramo = defaultdict(lambda: [0, 0.0])
for r in regs:
    est = (r.get("Estado de LPN") or "").strip()
    q = num(r.get("Cantidad empaquetada"))
    ob_est[est][0] += 1; ob_est[est][1] += q; ob_est[est][2].add(r.get("Número de LPN"))
    if est == "Cancelado": continue
    rutas[(r.get("De número de ruta") or "").strip()] += q
    destinos.add((r.get("Instalación de destino") or "").strip())
    fp = fecha(r.get("Detail Picked Time"))
    fe = fecha(r.get("Registro de hora de empaquetado"))
    fc = fecha(r.get("Hora de asignación de carga"))
    fv = fecha(r.get("Etiqueta de envío: último registro de hora impreso"))
    if fp and fe: horas["pick_emp"].append((fe-fp).total_seconds()/3600)
    if fe and fc: horas["emp_carga"].append((fc-fe).total_seconds()/3600)
    if fc and fv: horas["carga_env"].append((fv-fc).total_seconds()/3600)
    if fp and fc: horas["pick_carga"].append((fc-fp).total_seconds()/3600)
    if est == "Empaquetado" and fe:
        h = (datetime(2026,8,29,6,0) - fe).total_seconds()/3600
        espera_patio.append(h)
        b = "menos de 24 h" if h < 24 else "1 a 2 dias" if h < 48 else "2 a 4 dias" if h < 96 else "mas de 4 dias"
        patio_tramo[b][0] += 1; patio_tramo[b][1] += q

def mediana(xs):
    if not xs: return None
    s = sorted(xs); n = len(s)
    return round((s[n//2] if n % 2 else (s[n//2-1]+s[n//2])/2), 1)

R["oblpn"] = {
    "archivo": "OBLPN <d>-<m>.csv", "dias": DIAS, "filas_brutas": filas_total,
    "filas_unicas": len(regs), "columnas": len(regs[0]) if regs else 0,
    "estados": {k: {"lineas": v[0], "unid": v[1], "bultos": len(v[2])} for k, v in ob_est.items()},
    "medianas_h": {k: mediana(v) for k, v in horas.items()},
    "n_medidos": {k: len(v) for k, v in horas.items()},
    "patio_tramos": {k: {"lineas": v[0], "unid": v[1]} for k, v in patio_tramo.items()},
    "espera_patio_mediana": mediana(espera_patio),
    "espera_patio_max": round(max(espera_patio), 1) if espera_patio else None,
    "transportistas": len([k for k in rutas if k]),
    "destinos": len([d for d in destinos if d]),
    "top_rutas": sorted([(k, v) for k, v in rutas.items() if k], key=lambda x: -x[1])[:6],
}
print("OBLPN listo:", len(regs), "unicas de", filas_total, file=sys.stderr)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_flujo_cd.json")
with io.open(out, "w", encoding="utf-8") as f:
    json.dump(R, f, ensure_ascii=False, indent=1)
print("OK ->", out, file=sys.stderr)
