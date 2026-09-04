# -*- coding: utf-8 -*-
"""MEDIR CADA LLAMADA A OUTLOOK POR SEPARADO.

El robot de citas se cuelga en el primer correo de la lista y ya se descartaron
dos culpables: el recorrido de los 109 y el cuerpo HTML. Toca medir llamada por
llamada, porque adivinar ya costo tres intentos.

Cada paso se cronometra y se imprime EN VIVO: lo que quede sin hora de fin es
donde se colgo.
"""
import sys
import time
from datetime import datetime


def paso(t):
    print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), t), flush=True)


t0 = time.time()
paso("arrancando")
import win32com.client
paso("pywin32 importado (%.1fs)" % (time.time() - t0))

mapi = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
paso("MAPI listo (%.1fs)" % (time.time() - t0))

bandeja = None
for st in mapi.Stores:
    try:
        b = st.GetDefaultFolder(6)
        paso("  buzon: %s" % st.DisplayName)
        if bandeja is None:
            bandeja = b
    except Exception as e:
        paso("  buzon inaccesible: %s" % e)
paso("bandeja elegida (%.1fs)" % (time.time() - t0))

items = bandeja.Items
paso("Items.Count = %s" % items.Count)

ORDENAR = "--sin-ordenar" not in sys.argv
if ORDENAR:
    t = time.time()
    items.Sort("[ReceivedTime]", True)
    paso("Sort de la bandeja: %.1fs" % (time.time() - t))

CONSULTA = "@SQL=\"urn:schemas:httpmail:subject\" LIKE '%PROGRAMACION DE RECEPCION%'"
t = time.time()
sel = items.Restrict(CONSULTA)
paso("Restrict por asunto: %.1fs" % (time.time() - t))
t = time.time()
n = sel.Count
paso("sel.Count = %s  (%.1fs)" % (n, time.time() - t))

if "--ordenar-sel" in sys.argv:
    t = time.time()
    try:
        sel.Sort("[ReceivedTime]", True)
        paso("Sort del resultado: %.1fs" % (time.time() - t))
    except Exception as e:
        paso("Sort del resultado FALLO: %s" % e)

t = time.time()
it = sel.GetFirst()
paso("GetFirst: %.1fs" % (time.time() - t))

for i in range(1, 6):
    if it is None:
        paso("no hay mas correos")
        break
    paso("--- correo %d ---" % i)
    for prop in ("Class", "ReceivedTime", "Subject", "SenderName"):
        t = time.time()
        try:
            v = getattr(it, prop)
            paso("    %-14s %-38s %.1fs" % (prop, str(v)[:38], time.time() - t))
        except Exception as e:
            paso("    %-14s FALLO %s  %.1fs" % (prop, str(e)[:40], time.time() - t))
    t = time.time()
    try:
        paso("    %-14s %d adjunto(s)  %.1fs" % ("Attachments", it.Attachments.Count, time.time() - t))
    except Exception as e:
        paso("    %-14s FALLO %s" % ("Attachments", str(e)[:40]))
    t = time.time()
    it = sel.GetNext()
    paso("    GetNext: %.1fs" % (time.time() - t))

paso("TERMINO BIEN en %.1fs" % (time.time() - t0))
