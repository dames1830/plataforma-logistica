# -*- coding: utf-8 -*-
"""Lee el Stock Reserva (xlsx como zip). Cabecera en la fila 3."""
import zipfile, re, json, io
from collections import defaultdict
RUTA = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva\Stock Reserva 28-08-26 1900.xlsx"
z = zipfile.ZipFile(RUTA)
sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
sh = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S))
      for s in re.findall(r"<si>(?:(?!</si>).)*?</si>", sx, re.S)]
sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
filas = re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)

def celdas(fila):
    out = {}
    for c in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)(?:/>|>(.*?)</c>)', fila, re.S):
        col, attr, cuerpo = c
        v = re.search(r"<v>(.*?)</v>", cuerpo or "", re.S)
        x = v.group(1) if v else ""
        if 't="s"' in attr and x:
            try: x = sh[int(x)]
            except: pass
        out[col] = x
    return out

hdr = {v.strip(): k for k, v in celdas(filas[2]).items() if v.strip()}
niv, zon = defaultdict(lambda: [0, 0.0, set()]), defaultdict(lambda: [0, 0.0])
tot, ubis, lpns = 0.0, set(), set()
for fila in filas[3:]:
    c = celdas(fila)
    q = float(c.get(hdr.get("CANTIDAD", ""), 0) or 0)
    n = (c.get(hdr.get("NIVEL", ""), "") or "").strip()
    u = (c.get(hdr.get("UBICACION", ""), "") or "").strip()
    l = (c.get(hdr.get("LPN", ""), "") or "").strip()
    tot += q; ubis.add(u); lpns.add(l)
    niv[n][0] += 1; niv[n][1] += q; niv[n][2].add(u)
    z2 = u.split("-")[0] if u else ""
    zon[z2][0] += 1; zon[z2][1] += q

# A/B/C = activo (se pica) · D a H = reserva (no se pica)
act = sum(v[1] for k, v in niv.items() if k in ("A","B","C"))
res = sum(v[1] for k, v in niv.items() if k not in ("A","B","C"))
out = {"foto": "28-08-26 19:00", "filas": len(filas)-3, "total": tot,
       "ubicaciones": len([u for u in ubis if u]), "paletas": len([l for l in lpns if l]),
       "niveles": {k: {"lineas": v[0], "unid": v[1], "ubic": len(v[2])} for k, v in sorted(niv.items())},
       "zonas": {k: {"lineas": v[0], "unid": v[1]} for k, v in sorted(zon.items(), key=lambda x:-x[1][1])[:10]},
       "abc_unid": act, "reserva_unid": res}
io.open("_reserva_flujo.json","w",encoding="utf-8").write(json.dumps(out,ensure_ascii=False,indent=1))
print(json.dumps(out, ensure_ascii=False, indent=1))
