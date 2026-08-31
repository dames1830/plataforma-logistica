# -*- coding: utf-8 -*-
"""Lector de reserva corregido. Diagnostica por que fallaba y saca las filas del SKU."""
import zipfile, re, os, sys
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva"
P = os.path.join(D, "Stock Reserva 17-08-26 0700.xlsx")
z = zipfile.ZipFile(P)
sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
sh = ["".join(re.findall(r"<t[^>]*>(.*?)</t>", s, re.S))
      for s in re.findall(r"<si>(?:(?!</si>).)*?</si>", sx, re.S)]
# indice del SKU en sharedStrings
idx = [i for i, s in enumerate(sh) if s.strip() == "6116913-1-07"]
print("indice del SKU en sharedStrings:", idx)
sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8", "replace")
filas = re.findall(r"<row[^>]*r=\"(\d+)\"[^>]*>(.*?)</row>", sheet, re.S)
print("filas:", len(filas))
# cuantas filas contienen ese indice como valor de celda 's'
if idx:
    pat = re.compile(r'<c r="([A-Z]+)\d+"[^>]*t="s"[^>]*><v>(%s)</v></c>' % "|".join(str(i) for i in idx))
    hits = [(r, c) for r, c in filas if pat.search(c)]
    print("filas que contienen el SKU:", len(hits))
    for rn, c in hits[:8]:
        print("\n  --- fila", rn, "---")
        for col, attr, cu in re.findall(r'<c r="([A-Z]+)\d+"([^>]*)(?:/>|>(.*?)</c>)', c, re.S):
            v = re.search(r"<v>(.*?)</v>", cu or "", re.S)
            x = v.group(1) if v else ""
            if 't="s"' in attr and x:
                try: x = sh[int(x)]
                except: pass
            if x: print("     %-4s %s" % (col, x))
