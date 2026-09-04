# -*- coding: utf-8 -*-
"""
ROBOT: EL CORTE DEL TURNO DIA.

Daniel, 03-sep-2026: *"al finalizar el turno dia, que mas o menos es a las siete
de la noche, deberiamos ya tener los reportes y KPIs de lo que hizo el turno dia.
O el encargado va a tener que esperar hasta las cuatro y media de la manana para
ver su produccion? [...] busca un espacio para tener el reporte final de picking
y embalaje"*. Y: *"el corte deberia ser a partir de las 7 pm"*.

QUE PROBLEMA RESUELVE
---------------------
Hasta hoy, al cerrar el turno dia el encargado veia:

    picking        el pase de las 18:00
    embalaje       el pase de las 18:20
    recepcion      NADA hasta las 04:30 de la madrugada siguiente
    mapa de calor  el dibujo de las 06:15 de esa manana

Los avances de cada 2 horas nunca dicen "este ya es el numero final", y el cierre
de verdad -`cierre_dia.py`- corre a las 08:30 del dia siguiente. En el medio hay
trece horas en que nadie sabe si lo que ve esta cerrado o a medias.

POR QUE A LAS 20:00 Y NO ANTES
------------------------------
Se midio la tarde entera antes de elegir:

    19:00  ancla de la noche  -> 19:16   INTOCABLE: arranca el turno noche
    19:20  Detalle de Orden   -> 20:00   tarda hasta 40 minutos
    20:00  avance de picking  -> 20:17   <- este espacio
    20:20  avance de embalaje -> 20:33   <- y este
    21:30  cruce contra el WMS

Entre las 18:33 y las 19:00 solo hay 27 minutos libres y el bloque necesita 50:
empezar a las 18:30 seguiria adentro del WMS cuando entra el ancla, que es el
error que ya tumbo el arranque del turno dos veces.

Las 20:00 son el primer hueco de verdad, y ademas NO CUESTAN TIEMPO DE WMS: los
pases sueltos de las 20:00 y 20:20 ya bajaban picking y embalaje. Este robot los
reemplaza -por eso van con `saltar` en horario_robot.py-, les agrega la recepcion
y publica los tres juntos como un cierre. Termina cerca de las 20:50, con 40
minutos de margen antes del cruce de las 21:30.

QUE CORRE, EN ORDEN
-------------------
    1. PICKING final del dia    picking_por_hora.py + produccion_picking.py
    2. EMBALAJE final del dia   oblpn_embalaje.py --hoy + produccion_embalaje.py
    3. RECEPCION del dia        asn_web_report.py --actual + asn_resumen.py

Picking y embalaje van primero porque son los dos que Daniel pidio por nombre. Si
el bloque se pasa de tiempo, lo que se pierde es lo ultimo, no lo que mas importa.

CADA PASO ES INDEPENDIENTE. Si la recepcion falla, picking y embalaje ya quedaron
publicados. Un cierre a medias sirve; uno que se rinde en el primer tropiezo, no.

SOLO SE BAJA EL MES EN CURSO (`--actual`). Los seis meses son 48 minutos y aca no
hacen falta: lo que se recibio hoy esta en el archivo de este mes. El robot de las
04:30 sigue bajando los seis, que es lo que alimenta "que viene en camino".

USO
    python corte_turno.py                  el corte completo
    python corte_turno.py --sin-recepcion  solo picking y embalaje
    python corte_turno.py --solo-recepcion para probar ese lado sin tocar el resto
"""
import json
import os
import sys
import subprocess
import urllib.request
from datetime import datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, r"C:\wms_scraping")

PY = sys.executable or os.path.join(
    os.environ.get("ProgramFiles", r"C:\Program Files"), "Python313", "python.exe")

API = "https://logistics-backend-wv0x.onrender.com/api/logistics/corte_turno"
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")

_t0 = datetime.now()


def log(t, nivel="INFO"):
    print("[%s] %-5s %s" % (datetime.now().strftime("%H:%M:%S"), nivel, t))
    sys.stdout.flush()


def correr(nombre, args, minutos=45):
    """Un paso. Devuelve (salio_bien, minutos_que_tardo)."""
    ini = datetime.now()
    log("--- %s" % nombre)
    try:
        r = subprocess.run([PY, "-u"] + args, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=minutos * 60)
    except subprocess.TimeoutExpired:
        log("%s se paso de %d minutos" % (nombre, minutos), "ERROR")
        return False, (datetime.now() - ini).total_seconds() / 60.0
    salida = r.stdout or ""
    for l in salida.splitlines():
        if any(x in l for x in ("Publicado", "publicado", "ERROR", "AVISO",
                                "BAJADO", "lineas", "filas")):
            log("   " + l.strip()[:150])
    if r.returncode != 0:
        for l in (r.stderr or salida).strip().splitlines()[-3:]:
            log("   " + l.strip()[:150], "ERROR")
    mins = (datetime.now() - ini).total_seconds() / 60.0
    log("    %s en %.1f min" % ("OK" if r.returncode == 0 else "FALLO", mins))
    return r.returncode == 0, mins


def avisar(pasos, dia):
    """DEJA LA MARCA DE QUE EL DIA ESTA CERRADO.

    Sin esto la pantalla no puede distinguir un avance de las 14:00 de un cierre:
    los dos son el mismo JSON con un numero adentro. La marca es lo que le deja
    decir "cerrado a las 20:47" en vez de "ultimo avance".

    Si no se puede avisar NO se cae el robot: el cierre ya esta hecho y publicado,
    esto solo lo rotula.
    """
    cuerpo = json.dumps({"data": {
        "dia": dia,
        "cuando": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "minutos": round((datetime.now() - _t0).total_seconds() / 60.0, 1),
        "pasos": pasos,
        "completo": bool(pasos) and all(p["ok"] for p in pasos),
    }}, ensure_ascii=False).encode("utf-8")
    pet = urllib.request.Request(API, data=cuerpo, method="POST",
                                 headers={"Content-Type": "application/json"})
    if ROBOT_TOKEN:
        pet.add_header("X-Robot-Token", ROBOT_TOKEN)
    try:
        with urllib.request.urlopen(pet, timeout=60) as r:
            log("marca del cierre publicada (%s)" % r.status)
    except Exception as e:
        log("no se pudo publicar la marca del cierre: %s" % e, "WARN")


def main():
    args = sys.argv[1:]
    dia = datetime.now().strftime("%Y-%m-%d")

    log("=" * 64)
    log("CORTE DEL TURNO DIA  ·  %s" % datetime.now().strftime("%d-%m-%Y %H:%M"))
    log("=" * 64)

    pasos = []
    solo_rec = "--solo-recepcion" in args

    if not solo_rec:
        # ── 1. PICKING final del dia ────────────────────────────────────────
        # Los dos pasos del avance de siempre: bajar y publicar. El segundo corre
        # aunque el primero falle -queda el archivo del pase anterior, y un cuadro
        # de hace dos horas es mejor que una pantalla en blanco-.
        ok, m = correr("PICKING · bajando el archivo del dia",
                       [os.path.join(AQUI, "picking_por_hora.py")], minutos=40)
        ok2, m2 = correr("PICKING · publicando el cuadro",
                         [os.path.join(AQUI, "produccion_picking.py")], minutos=20)
        pasos.append({"paso": "picking", "ok": ok and ok2, "min": round(m + m2, 1)})

        # ── 2. EMBALAJE final del dia ───────────────────────────────────────
        # `--hoy` = el dia en curso. Sin esa bandera bajaria AYER, que es la salida
        # de emergencia para recuperar un dia que no salio.
        ok, m = correr("EMBALAJE · bajando el OBLPN del dia",
                       [os.path.join(AQUI, "oblpn_embalaje.py"), "--hoy"], minutos=40)
        ok2, m2 = correr("EMBALAJE · publicando el cuadro",
                         [os.path.join(AQUI, "produccion_embalaje.py")], minutos=20)
        pasos.append({"paso": "embalaje", "ok": ok and ok2, "min": round(m + m2, 1)})

    # ── 3. RECEPCION del dia ────────────────────────────────────────────────
    if "--sin-recepcion" not in args:
        ok, m = correr("RECEPCION · bajando el ASN del mes en curso",
                       [os.path.join(AQUI, "asn_web_report.py"), "--actual"], minutos=40)
        # El resumen relee los SEIS archivos que ya estan en disco -no entra al
        # WMS- y republica el paquete y la tabla de consulta de los seis meses.
        ok2, m2 = correr("RECEPCION · rehaciendo el resumen y la tabla",
                         [os.path.join(AQUI, "asn_resumen.py")], minutos=30)
        pasos.append({"paso": "recepcion", "ok": ok and ok2, "min": round(m + m2, 1)})

    log("")
    log("-" * 64)
    buenos = sum(1 for p in pasos if p["ok"])
    for p in pasos:
        log("   %-10s %-6s %5.1f min" % (p["paso"], "OK" if p["ok"] else "FALLO", p["min"]))
    log("   %d de %d en %.1f minutos"
        % (buenos, len(pasos), (datetime.now() - _t0).total_seconds() / 60.0))
    log("-" * 64)

    avisar(pasos, dia)
    return 0 if buenos == len(pasos) else 1


if __name__ == "__main__":
    sys.exit(main())
