# -*- coding: utf-8 -*-
"""Mide el tramo del medio del circuito: buffer, piso (activo) y reserva."""
import csv, json, io, os, sys, zipfile, re
from collections import defaultdict
csv.field_size_limit(10**7)
SCR = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock"

def num(v):
    try: return float(str(v).replace('="','').replace('"','').strip() or 0)
    except: return 0.0

# --- Stock Activo (csv) ---
act = defaultdict(lambda: [0, 0.0])
ubis = defaultdict(set)
with io.open(os.path.join(SCR, "Stock Activo", "Stock Activo 28-08-26 1900.csv"),
             encoding="utf-8-sig", newline="", errors="replace") as f:
    for r in csv.DictReader(f, delimiter=";"):
        area = (r.get("Área") or "").strip()
        q = num(r.get("Cantidad actual"))
        grupo = "BUFFER" if area.startswith("CDBUFFER") or "BUFFER" in area else area
        act[grupo][0] += 1; act[grupo][1] += q
        ubis[grupo].add((r.get("Ubicación") or "").strip())

# --- Stock Reserva (xlsx) -> se lee como zip ---
res_tot, res_filas, res_ubis = 0.0, 0, set()
try:
    z = zipfile.ZipFile(os.path.join(SCR, "Stock Reserva", "Stock Reserva 28-08-26 1900.xlsx"))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
        shared = re.findall(r"<si>(?:(?!</si>).)*?</si>", sx, re.S)
        shared = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S)) for s in shared]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
    filas = re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)
    hdr = None
    for fi, fila in enumerate(filas):
        celdas = re.findall(r'<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>(.*?)</v>|<is><t[^>]*>(.*?)</t></is>)?</c>', fila, re.S)
        vals = {}
        for col, t, v, inl in celdas:
            x = inl if inl else v
            if t == "s" and v not in (None, ""):
                try: x = shared[int(v)]
                except: x = v
            vals[col] = x or ""
        if hdr is None:
            hdr = {v.strip(): k for k, v in vals.items()}
            continue
        res_filas += 1
        c = hdr.get("Cantidad actual") or hdr.get("Cantidad")
        u = hdr.get("Ubicación")
        if c: res_tot += num(vals.get(c))
        if u: res_ubis.add(vals.get(u, ""))
    print("cabeceras reserva:", list(hdr)[:12], file=sys.stderr)
except Exception as e:
    print("reserva fallo:", e, file=sys.stderr)

out = {
  "activo": {k: {"lineas": v[0], "unid": v[1], "ubicaciones": len(ubis[k])}
             for k, v in sorted(act.items(), key=lambda x: -x[1][1])},
  "activo_total": sum(v[1] for v in act.values()),
  "reserva": {"filas": res_filas, "unid": res_tot, "ubicaciones": len(res_ubis)},
  "foto": "28-08-26 19:00",
}
io.open("_stock_flujo.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print(json.dumps(out, ensure_ascii=False, indent=1)[:1800])
