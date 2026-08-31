# -*- coding: utf-8 -*-
"""Sigue al SKU 6116913-1-07 en RESERVA, foto por foto de agosto.
OJO: en este archivo la columna ARTICULO viene vacia y el codigo va en PRODUCTO.
Salida: _reserva_sku.json"""
import zipfile, re, os, json, io, sys
from collections import defaultdict
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva"
SKU, ESTILO = "6116913-1-07", "6116913"

def leer(p):
    z = zipfile.ZipFile(p)
    sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    sh = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S))
          for s in re.findall(r"<si>(?:(?!</si>).)*?</si>", sx, re.S)]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
    filas = re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S)
    def cel(f):
        o = {}
        for col, attr, cu in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)(?:/>|>(.*?)</c>)', f, re.S):
            v = re.search(r"<v>(.*?)</v>", cu or "", re.S); x = v.group(1) if v else ""
            if 't="s"' in attr and x:
                try: x = sh[int(x)]
                except: pass
            o[col] = x
        return o
    return filas, cel

# columnas reales, comprobadas contra los datos:
# A sucursal · B nivel · C zona · D nro · E ubicacion · F LPN · G atributo
# I ARTICULO (el header lo llama PRODUCTO) · J descripcion · K cantidad
COL = {"nivel": "B", "zona": "C", "ubic": "E", "lpn": "F", "sku": "I", "cant": "K"}

hist = []
for n in sorted(x for x in os.listdir(D) if re.search(r"-08-26", x) and x.endswith(".xlsx")):
    try:
        filas, cel = leer(os.path.join(D, n))
    except Exception as e:
        print("  %-38s ERROR %s" % (n, e), file=sys.stderr); continue
    m = re.search(r"(\d{2})-(\d{2})-(\d{2})(?: (\d{4}))?", n)
    hh = m.group(4) or "0000"
    sello = "20%s-%s-%s %s:%s" % (m.group(3), m.group(2), m.group(1), hh[:2], hh[2:])
    det, est_tot = [], 0.0
    for f in filas[3:]:
        c = cel(f)
        a = (c.get(COL["sku"], "") or "").strip()
        if not a.startswith(ESTILO): continue
        q = float(c.get(COL["cant"], 0) or 0)
        est_tot += q
        if a != SKU: continue
        det.append({"nivel": c.get(COL["nivel"], ""), "zona": c.get(COL["zona"], ""),
                    "ubic": c.get(COL["ubic"], ""), "lpn": c.get(COL["lpn"], ""), "cant": q})
    alto = sum(d["cant"] for d in det if d["nivel"] == "ALTO")
    merma = sum(d["cant"] for d in det if "MERMA" in d["zona"])
    otros = sum(d["cant"] for d in det) - alto - merma
    hist.append({"foto": sello, "total": sum(d["cant"] for d in det),
                 "alto": alto, "merma": merma, "otros": otros,
                 "estilo": est_tot, "detalle": det})
    print("%s  SKU en reserva %6.0f (alto %5.0f · merma %2.0f · otros %4.0f) | estilo %7.0f" % (
        sello, hist[-1]["total"], alto, merma, otros, est_tot), file=sys.stderr)

io.open("_reserva_sku.json", "w", encoding="utf-8").write(json.dumps(hist, ensure_ascii=False, indent=1))

print("\n=== DETALLE, primera y ultima foto ===", file=sys.stderr)
for h in (hist[0], hist[-1]):
    print(" ", h["foto"], file=sys.stderr)
    for d in h["detalle"]:
        print("     %-6s %-10s %-20s %-22s %6.0f" % (d["nivel"], d["zona"], d["ubic"], d["lpn"], d["cant"]), file=sys.stderr)

print("\n=== CUANDO CAMBIA LA PALETA ALTO ===", file=sys.stderr)
prev = None
for h in hist:
    a = [d for d in h["detalle"] if d["nivel"] == "ALTO"]
    firma = tuple(sorted((d["ubic"], d["cant"]) for d in a))
    if firma != prev:
        print("  %s -> %s" % (h["foto"], firma or "(vacio)"), file=sys.stderr)
        prev = firma
