# -*- coding: utf-8 -*-
"""AVISAR AL LOG DE LA WEB CÓMO LE FUE A LA CORRIDA DEL WMS.

Daniel, 28-ago-2026: *"¿cómo me doy cuenta de que no está corriendo? Créame un módulo en la
web que se llame log"*. El caso que lo motivó: el Stock Reserva de las 07:00 llevaba SEIS
DÍAS sin bajar y nadie se enteró, porque el robot lo dejaba escrito en un archivo del
servidor que nadie abre.

POR QUÉ ES UN SCRIPT APARTE Y NO UNA LÍNEA DENTRO DEL ROBOT GRANDE:

  1. `wms_automation_final.py` vive SOLO en el servidor, no en este repo. Editarlo desde
     acá exige comandos a mano sobre un archivo de producción, y eso se hace una vez y se
     hace mal la segunda.
  2. Y lo más importante: cuando la descarga falla, ese script se rinde y **`generar_slotting`
     nunca corre**. O sea que el log se quedaría callado justo el día que hace falta. Este
     lee el registro DESPUÉS, pase lo que pase.

Se ejecuta al final de la tarea de Windows, después del robot:

    python C:\\wms_scraping\\avisar_log.py

No devuelve error nunca: si avisar falla, no puede tumbar nada.
"""
import glob
import io
import json
import os
import re
import sys
import urllib.request

CARPETA = os.environ.get("WMS_LOGS", r"C:\wms_scraping\logs")
API = "https://logistics-backend-wv0x.onrender.com/api/eventos"
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")


def ultimo_registro():
    """El `run_*.log` más nuevo. Por fecha de archivo: los nombres llevan la hora de
    arranque, así que ordenarlos por nombre también sirve, pero la fecha es más directa."""
    archivos = glob.glob(os.path.join(CARPETA, "run_*.log"))
    if not archivos:
        return None
    return max(archivos, key=os.path.getmtime)


def leer(ruta):
    for cod in ("utf-8", "latin-1"):
        try:
            with io.open(ruta, encoding=cod) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    return ""


def eventos_de(texto, nombre):
    """Traduce el resumen del robot a anotaciones. Una por cosa que pasó."""
    ev = []
    turno = "ancla_manana" if re.search(r"run_\d{4}-\d{2}-\d{2}_0[0-9]", nombre) else "ancla_noche"

    # Lo que el propio robot escribe al cerrar. Se lee eso y no se re-deduce: si mañana
    # cambia el resumen, cambia el aviso, y no quedan dos versiones diciendo cosas distintas.
    for linea in texto.splitlines():
        l = linea.strip()
        m = re.search(r"(Stock \w+)\s+OK\s+([\d.,]+\s*MB)", l)
        if m:
            ev.append({"tipo": "ok", "accion": "%s bajado" % m.group(1), "detalle": m.group(2)})
            continue
        m = re.search(r"(Stock \w+)\s+FALTA", l)
        if m:
            ev.append({"tipo": "error", "accion": "%s NO se pudo bajar" % m.group(1),
                       "detalle": "el WMS no entregó el archivo"})
            continue
        if "Quedaron" in l and "sin descargar" in l:
            ev.append({"tipo": "error", "accion": "Quedaron archivos sin descargar",
                       "detalle": l.split("]")[-1].strip()})
        elif "No se genera el reporte Slotting" in l:
            ev.append({"tipo": "error", "accion": "No se generó el Slotting",
                       "detalle": "faltan archivos de entrada"})
        elif "RESUMEN DE LA CORRIDA" in l:
            m2 = re.search(r"\(([\d.]+)\s*minutos\)", l)
            ev.append({"tipo": "ok", "accion": "Corrida del WMS terminada",
                       "detalle": "%s minutos" % m2.group(1) if m2 else ""})

    if not ev:
        ev.append({"tipo": "aviso", "accion": "La corrida del WMS no dejó resumen",
                   "detalle": "revisar %s" % os.path.basename(nombre)})
    for e in ev:
        e["origen"] = "robot"
        e["quien"] = turno
    return ev


def main():
    ruta = ultimo_registro()
    if not ruta:
        print("No hay ningun run_*.log en %s" % CARPETA)
        return 0
    ev = eventos_de(leer(ruta), os.path.basename(ruta))
    print("Registro: %s" % os.path.basename(ruta))
    for e in ev:
        print("   [%s] %s%s" % (e["tipo"], e["accion"], ("  ·  " + e["detalle"]) if e["detalle"] else ""))
    if "--solo-ver" in sys.argv:
        print("(sin enviar)")
        return 0
    try:
        cuerpo = json.dumps(ev, ensure_ascii=False).encode("utf-8")
        p = urllib.request.Request(API, data=cuerpo, method="POST",
                                   headers={"Content-Type": "application/json"})
        if ROBOT_TOKEN:
            p.add_header("X-Robot-Token", ROBOT_TOKEN)
        with urllib.request.urlopen(p, timeout=30) as r:
            print("Enviado: %s" % r.status)
    except Exception as e:
        print("No se pudo avisar: %s: %s" % (type(e).__name__, str(e)[:150]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
