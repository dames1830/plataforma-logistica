# -*- coding: utf-8 -*-
"""¿CADA ARCHIVO DE PICKING TRAE DE VERDAD SU DIA?

Nacio el 10-sep-2026 recuperando meses de picking. El robot dio por vacios
martes, jueves y lunes de mayo, alternados con dias que si bajaron, y el pie de
la grilla de esa pantalla resulto ambiguo: un "/ 1 Paginas" suelto que puede ser
de otro elemento o de Oracle todavia cargando.

Un dia vacio de mas se nota. Lo que NO se nota es lo contrario: un archivo con
el nombre del 08-05 y las filas del 07-05 adentro. Pesa lo normal, tiene las
filas normales y nadie lo va a abrir para mirarlo. Por eso esto no mira el
nombre ni el tamaño: lee la columna "Hora de seleccion" de cada fila y cuenta
cuantas son del dia que dice el nombre.

    python revisar_dias_picking.py
    python revisar_dias_picking.py --desde 01-04-2026 --hasta 09-09-2026
    python revisar_dias_picking.py --corte "10-09-2026 17:41"   solo los escritos despues
"""

import collections
import csv
import io
import os
import re
import sys
from datetime import datetime, timedelta


def arg(nombre, defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return defecto


def carpeta_picking():
    propia = arg("--base")
    if propia:
        return propia
    for raiz in (os.environ.get("USERPROFILE", ""), os.path.expanduser("~")):
        cand = os.path.join(raiz, "OneDrive", "danielames.bata", "scraping Stock", "Picking")
        if os.path.isdir(cand):
            return cand
    raise SystemExit("No encuentro la carpeta Picking; pasala con --base")


def columna_seleccion(cabecera):
    """La columna de la hora en que se pico. Se busca por el nombre, nunca por
       la posicion: el WMS reordena columnas cuando alguien toca la vista."""
    for pos, col in enumerate(cabecera):
        if col.strip().lower().startswith("hora de selecci"):
            return pos
    return None


def revisar_archivo(ruta, dia):
    """(filas con hora, filas del dia, las otras fechas mas comunes, error)."""
    esperado = dia.strftime("%d/%m/%Y")
    try:
        with io.open(ruta, encoding="utf-8-sig", errors="replace", newline="") as fh:
            primera = fh.readline()
            sep = ";" if primera.count(";") > primera.count(",") else ","
            fh.seek(0)
            lector = csv.reader(fh, delimiter=sep)
            cab = next(lector)
            pos = columna_seleccion(cab)
            if pos is None:
                return 0, 0, [], "sin columna 'Hora de seleccion' (%s)" % ", ".join(cab[:6])
            cuenta = collections.Counter()
            total = 0
            for reg in lector:
                if len(reg) <= pos:
                    continue
                valor = reg[pos].strip()
                if not valor:
                    continue
                total += 1
                cuenta[valor[:10]] += 1
    except Exception as e:
        return 0, 0, [], "%s: %s" % (type(e).__name__, str(e)[:80])
    otras = [(fecha, n) for fecha, n in cuenta.most_common(4) if fecha != esperado][:3]
    return total, cuenta.get(esperado, 0), otras, None


def main():
    base = carpeta_picking()
    d0 = datetime.strptime(arg("--desde", "01-04-2026"), "%d-%m-%Y")
    d1 = datetime.strptime(arg("--hasta", (datetime.now() - timedelta(days=1)).strftime("%d-%m-%Y")),
                           "%d-%m-%Y")
    corte_txt = arg("--corte")
    corte = datetime.strptime(corte_txt, "%d-%m-%Y %H:%M").timestamp() if corte_txt else None

    print("carpeta: %s" % base)
    print("rango:   %s a %s%s" % (d0.strftime("%d-%m-%Y"), d1.strftime("%d-%m-%Y"),
                                  ("   escritos despues de " + corte_txt) if corte else ""))
    print("")
    buenos = malos = sin_archivo = viejos = 0
    faltan = []
    d = d0
    while d <= d1:
        ruta = os.path.join(base, "Picking %d-%d.csv" % (d.day, d.month))
        etiqueta = d.strftime("%d-%m %a")
        if not os.path.exists(ruta):
            sin_archivo += 1
            faltan.append(d.strftime("%d-%m"))
            d += timedelta(days=1)
            continue
        escrito = datetime.fromtimestamp(os.path.getmtime(ruta))
        if corte and escrito.timestamp() < corte:
            viejos += 1
            d += timedelta(days=1)
            continue
        total, del_dia, otras, error = revisar_archivo(ruta, d)
        if error:
            print("%s  ERROR  %s" % (etiqueta, error))
            malos += 1
        else:
            pct = 100.0 * del_dia / total if total else 0.0
            ok = total > 0 and pct >= 98.0
            buenos += 1 if ok else 0
            malos += 0 if ok else 1
            print("%s  %s  filas %6s  del dia %5.1f%%  escrito %s%s" % (
                etiqueta, "ok " if ok else "MAL", format(total, ",d"), pct,
                escrito.strftime("%d-%m %H:%M"),
                ("   otras: " + ", ".join("%s=%d" % par for par in otras)) if otras and not ok else ""))
        d += timedelta(days=1)

    print("")
    print("con su propio dia ........ %d" % buenos)
    print("CON OTRO DIA ADENTRO ..... %d" % malos)
    print("sin archivo .............. %d" % sin_archivo)
    if corte:
        print("escritos antes del corte . %d  (no se revisaron)" % viejos)
    if faltan:
        print("")
        print("sin archivo: " + "  ".join(faltan))
    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main())
