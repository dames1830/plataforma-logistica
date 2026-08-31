# -*- coding: utf-8 -*-
import zipfile, re, os, sys
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva"
SKU = "6116913-1-07"
def leerxlsx(p):
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
    return [cel(f) for f in filas[3:]], hdr
for n in sorted(os.listdir(D)):
    if not re.search(r"1[5-8]-08-26", n): continue
    try:
        filas, hdr = leerxlsx(os.path.join(D, n))
    except Exception as e:
        print(n, "->", e); continue
    hits = [c for c in filas if (c.get(hdr.get("ARTICULO",""), "") or "").strip() == SKU]
    tot = sum(float(c.get(hdr.get("CANTIDAD",""), 0) or 0) for c in hits)
    print("%-40s %2d filas  %6.0f pares" % (n, len(hits), tot))
    for c in hits:
        print("      %-18s nivel %-6s LPN %-16s %5.0f" % (
            c.get(hdr.get("UBICACION",""), ""), c.get(hdr.get("NIVEL",""), ""),
            c.get(hdr.get("LPN",""), ""), float(c.get(hdr.get("CANTIDAD",""), 0) or 0)))
