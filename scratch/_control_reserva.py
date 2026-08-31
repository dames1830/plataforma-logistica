# -*- coding: utf-8 -*-
"""Control positivo: el estilo 6116913, aparece en el archivo de reserva?
Se busca la cadena cruda en sharedStrings, sin pasar por mi parser."""
import zipfile, re, os
D = r"C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Stock Reserva"
for n in ["Stock Reserva 15-08-26 1900.xlsx", "Stock Reserva 17-08-26 0700.xlsx",
          "Stock Reserva 18-08-26 0700.xlsx", "Stock Reserva 28-08-26 1900.xlsx"]:
    p = os.path.join(D, n)
    if not os.path.exists(p): print(n, "NO EXISTE"); continue
    z = zipfile.ZipFile(p)
    sx = z.read("xl/sharedStrings.xml").decode("utf-8", "replace")
    hay = sx.count("6116913")
    # control: un SKU que SI sabemos que esta en reserva
    ctrl = sx.count("5518905")
    print("%-38s '6116913' aparece %3d veces | control '5518905': %d | tam sharedStrings %d KB" % (
        n, hay, ctrl, len(sx)//1024))
    if hay:
        for m in re.finditer(r"6116913[-\d]*", sx):
            print("      ->", m.group(0))
