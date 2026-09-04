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
Se midio la tarde entera antes de elegir. Asi queda:

    16:00  avance de picking   -> 16:17   el ultimo del dia
    16:20  avance de embalaje  -> 16:33   el ultimo del dia
           (el WMS queda libre dos horas y media)
    19:00  ancla de la noche   -> 19:16   INTOCABLE: arranca el turno noche
    19:20  Detalle de Orden    -> 20:00   tarda hasta 40 minutos
    20:00  CORTE DEL TURNO DIA -> 20:50
    21:30  cruce contra el WMS

NO PUEDE IR ANTES DE LAS 19:00 porque el turno sigue trabajando y el corte se
perderia la ultima hora. Y entre las 19:16 y las 20:00 esta el Detalle de Orden,
que Daniel puso ahi el 31-ago para que el turno noche entre con el pendiente a la
vista. Las 20:00 son el primer hueco de verdad.

LOS AVANCES DE LAS 18:00 Y 18:20 SE SACARON. Daniel, 03-sep-2026: *"el avance de
picking y embalaje de las seis y tantos ya no lo des, si a las siete y media,
ocho vas a tener el reporte completo"*. Un numero de las 18:00 que queda viejo
cincuenta minutos despues no le sirve a nadie.

CUIDADO AL APAGAR PASES: lo que los apaga es `saltar`, NO la ventana `hasta`. La
configuracion publicada le gana a los valores de fabrica, y ahi esta guardado
`hasta: '21:00'`. Bajarlo en fabrica no apaga nada.

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
import io
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

# EL LOG EN ARCHIVO, ademas de la pantalla. Lo que la tarea de Windows imprime se
# pierde: queda solo el codigo de salida. Y un corte que fallo sin dejar rastro es
# el caso que motivo el modulo Log -el Stock Reserva estuvo seis dias sin bajar y
# nadie se entero-.
CARPETA_LOGS = os.path.join(AQUI, "logs")
_ARCHIVO = None
try:
    if not os.path.isdir(CARPETA_LOGS):
        os.makedirs(CARPETA_LOGS)
    _ARCHIVO = io.open(os.path.join(
        CARPETA_LOGS, "corteturno_%s.log" % _t0.strftime("%Y-%m-%d_%H%M%S")),
        "w", encoding="utf-8")
except Exception:
    _ARCHIVO = None      # sin log se sigue igual: no puede tumbar el corte

# EL CORTE NO PUEDE MORDER LO QUE VIENE DESPUES. Arranca 20:00 y detras tiene el
# cruce contra el WMS (21:30) y el stock por hora (22:00). Si un paso se cuelga
# -el WMS no entrega un archivo y el robot reintenta- los topes de cada paso suman
# 190 minutos y a las 23:10 seguiria adentro.
#
# Con este presupuesto, pasados los 75 minutos NO SE EMPIEZA un paso nuevo. El que
# ya arranco termina; lo que se pierde es lo de mas atras, que por eso va ultimo.
PRESUPUESTO_MIN = 75


def log(t, nivel="INFO"):
    linea = "[%s] %-5s %s" % (datetime.now().strftime("%H:%M:%S"), nivel, t)
    print(linea)
    sys.stdout.flush()
    if _ARCHIVO:
        try:
            _ARCHIVO.write(linea + chr(10))
            _ARCHIVO.flush()      # en vivo: si se cuelga, el archivo ya tiene hasta donde llego
        except Exception:
            pass


def limpiar_logs(dias=14):
    """Los de mas de dos semanas se borran solos, como los de los otros robots."""
    try:
        corte = datetime.now().timestamp() - dias * 86400
        for n in os.listdir(CARPETA_LOGS):
            if n.startswith("corteturno_") and n.endswith(".log"):
                ruta = os.path.join(CARPETA_LOGS, n)
                if os.path.getmtime(ruta) < corte:
                    os.remove(ruta)
    except Exception:
        pass


def gastado():
    return (datetime.now() - _t0).total_seconds() / 60.0


def hay_tiempo(paso):
    """Si queda presupuesto para empezar `paso`. Se avisa fuerte cuando no."""
    if gastado() < PRESUPUESTO_MIN:
        return True
    log("%s NO ARRANCA: van %.0f minutos y el tope es %d. Detras entra el cruce "
        "de las 21:30 y el stock de las 22:00." % (paso, gastado(), PRESUPUESTO_MIN), "ERROR")
    return False


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
        "minutos": round(gastado(), 1),
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
        if hay_tiempo("EMBALAJE"):
            ok, m = correr("EMBALAJE · bajando el OBLPN del dia",
                           [os.path.join(AQUI, "oblpn_embalaje.py"), "--hoy"], minutos=40)
            ok2, m2 = correr("EMBALAJE · publicando el cuadro",
                             [os.path.join(AQUI, "produccion_embalaje.py")], minutos=20)
            pasos.append({"paso": "embalaje", "ok": ok and ok2, "min": round(m + m2, 1)})
        else:
            pasos.append({"paso": "embalaje", "ok": False, "min": 0, "motivo": "sin tiempo"})

    # ── 3. RECEPCION del dia ────────────────────────────────────────────────
    if "--sin-recepcion" not in args:
        if hay_tiempo("RECEPCION"):
            ok, m = correr("RECEPCION · bajando el ASN del mes en curso",
                           [os.path.join(AQUI, "asn_web_report.py"), "--actual"], minutos=40)
            # El resumen relee los SEIS archivos que ya estan en disco -no entra al
            # WMS- y republica el paquete y la tabla de consulta de los seis meses.
            ok2, m2 = correr("RECEPCION · rehaciendo el resumen y la tabla",
                             [os.path.join(AQUI, "asn_resumen.py")], minutos=30)
            pasos.append({"paso": "recepcion", "ok": ok and ok2, "min": round(m + m2, 1)})
        else:
            pasos.append({"paso": "recepcion", "ok": False, "min": 0, "motivo": "sin tiempo"})

    log("")
    log("-" * 64)
    buenos = sum(1 for p in pasos if p["ok"])
    for p in pasos:
        log("   %-10s %-6s %5.1f min  %s" % (p["paso"], "OK" if p["ok"] else "FALLO",
                                              p["min"], p.get("motivo", "")))
    log("   %d de %d en %.1f minutos"
        % (buenos, len(pasos), gastado()))
    log("-" * 64)

    avisar(pasos, dia)
    limpiar_logs()
    if _ARCHIVO:
        try:
            _ARCHIVO.close()
        except Exception:
            pass
    return 0 if buenos == len(pasos) else 1


if __name__ == "__main__":
    sys.exit(main())
