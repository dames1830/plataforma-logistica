# -*- coding: utf-8 -*-
"""Busca el SKU en TODAS las fotos de reserva de agosto."""
import zipfile, re, os, sys
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva"
SKU = "6116913-1-07"; ESTILO = "6116913"
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
    hdr = {v.strip(): k for k, v in cel(filas[2]).items() if v.strip()}
    return filas, cel, hdr
nombres = sorted(n for n in os.listdir(D) if re.search(r"-08-26", n) and n.endswith(".xlsx"))
print("fotos de reserva en agosto:", len(nombres))
for n in nombres:
    try:
        filas, cel, hdr = leer(os.path.join(D, n))
    except Exception as e:
        print("  %-38s ERROR %s" % (n, e)); continue
    ca, cu = hdr.get("ARTICULO", ""), hdr.get("CANTIDAD", "")
    sku_t = est_t = 0.0
    for f in filas[3:]:
        c = cel(f)
        a = (c.get(ca, "") or "").strip()
        if not a.startswith(ESTILO): continue
        q = float(c.get(cu, 0) or 0)
        est_t += q
        if a == SKU: sku_t += q
    if sku_t or est_t:
        print("  %-38s SKU %6.0f   estilo %6.0f" % (n, sku_t, est_t))
print("(las fotos no listadas no tienen nada de este estilo)")
