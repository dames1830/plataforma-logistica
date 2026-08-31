# -*- coding: utf-8 -*-
"""Que dice EXACTAMENTE el ASN sobre las fechas de este SKU."""
import csv, io, re
csv.field_size_limit(10**7)
SKU = "6116913-1-07"
def lim(v): return re.sub(r'^="|"$', "", (v or "").strip()).strip('"')
CAMPOS = ["Envío de entrada", "Número de LPN", "Cantidad recibida de detalle de envío de entrada",
          "Fecha de envío", "Registro de hora de recepción de última LPN",
          "Hora de verificación", "Registro de hora de modificación de cabecera",
          "Usuario de modificación de cabecera", "Información de proveedor",
          "**RUC ASOCIADO", "Estado", "Estado de LPN", "Ubicación", "Carga"]
filas = []
with io.open(r"C:\Users\dames\Downloads\ASN Revisar.csv", encoding="utf-8-sig", newline="") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if lim(r.get("Código de SKU")) != SKU: continue
        filas.append({c: lim(r.get(c)) for c in CAMPOS})
filas.sort(key=lambda x: x["Hora de verificación"])
for i, x in enumerate(filas, 1):
    print("--- envio %d ---" % i)
    for c in CAMPOS:
        if x[c]: print("   %-46s %s" % (c, x[c]))
    print()
print("=== resumen ===")
print("  fechas de envio distintas   :", sorted(set(x["Fecha de envío"] for x in filas)))
print("  llegadas al CD distintas    :", sorted(set(x["Registro de hora de recepción de última LPN"] for x in filas)))
print("  verificaciones distintas    :", sorted(set(x["Hora de verificación"] for x in filas)))
print("  proveedores                 :", sorted(set(x["Información de proveedor"] for x in filas)))
print("  quien verifico              :", sorted(set(x["Usuario de modificación de cabecera"] for x in filas)))
tot = sum(float(x["Cantidad recibida de detalle de envío de entrada"] or 0) for x in filas)
print("  total recibido              :", tot)
for h in sorted(set(x["Hora de verificación"] for x in filas)):
    q = sum(float(x["Cantidad recibida de detalle de envío de entrada"] or 0) for x in filas if x["Hora de verificación"] == h)
    print("     %s -> %5.0f pares" % (h, q))
