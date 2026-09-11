# -*- coding: utf-8 -*-
"""PRUEBAS SIN WMS de la bajada del correo sin Despachados y del candado cortado.

    python scratch/_probar_sin_despachados.py

1. `picking_y_orden.run()` con un WMS de mentira: que baja con cada juego de
   banderas, lado a lado con la version de `despachados-tramos` (df368695) y con la
   que corre hoy en el servidor (cd8c2904). La corrida de las 04:30
   (`--solo-pendientes` a secas) tiene que bajar lo mismo que antes; la del correo
   (`--solo-pendientes --sin-despachados`), solo el Pendientes.

2. `armar_pendiente.refrescar_pendientes()` con procesos de verdad: un
   picking_y_orden.py de mentira que termina, cede, se cuelga adentro con el candado
   o se cuelga esperando el de otro. El tiempo de espera se achica a segundos, pero
   el corte es el mismo `subprocess.run(timeout=...)` del servidor y el candado es el
   archivo de `bloqueo_wms.py`, en una carpeta de prueba. La version vieja de
   armar_pendiente pasa por el mismo caso colgado para que se vea el defecto: deja el
   candado puesto.
"""
import ctypes
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import types
from datetime import datetime
from unittest import mock

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(AQUI, ".."))
ROBOT = os.path.join(REPO, "robot")
sys.path.insert(0, ROBOT)
TMP = tempfile.mkdtemp(prefix="probar_sin_desp_")
FALLAS = []


def comprobar(condicion, que, registro=None):
    print(("   ok     " if condicion else "   FALLA  ") + que)
    if not condicion:
        FALLAS.append(que)
        for r in (registro or [])[-12:]:
            print("            | %s" % (r,))


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def version_de(commit, ruta, nombre):
    """El archivo tal cual estaba en ese commit, cargado como modulo aparte."""
    texto = subprocess.run(["git", "-C", REPO, "show", "%s:%s" % (commit, ruta)],
                           capture_output=True, check=True).stdout
    destino = os.path.join(TMP, nombre + ".py")
    with open(destino, "wb") as fh:
        fh.write(texto)
    return cargar(nombre, destino)


import bloqueo_wms  # noqa: E402

# ══ 1. picking_y_orden.run(): que baja con cada bandera ═════════════════════════
print("1. picking_y_orden.run() con el WMS de mentira")

bloqueo_wms.CARPETA = os.path.join(TMP, "candado_1")
bloqueo_wms.ARCHIVO = os.path.join(bloqueo_wms.CARPETA, "wms_ocupado.lock")

BASE = os.path.join(TMP, "scraping Stock")
os.makedirs(os.path.join(BASE, "Detalle Orden"))
BAJADAS = []
FALLA_EN = set()

wms = types.ModuleType("wms_automation_final")
wms.INTENTOS = 3
wms.WMS_USER = "dames"
wms.WMS_PASSWORD = "de-mentira"
wms._base_onedrive = lambda: BASE
wms.captura = lambda page, nombre: None
wms.cerrar_pestanas = lambda page, maximo=25: 0


def _con_reintentos(nombre, funcion, page, intentos=None):
    """No entra a ningun WMS: anota que bajada se pidio."""
    BAJADAS.append(nombre)
    return nombre not in FALLA_EN


wms.con_reintentos = _con_reintentos
sys.modules["wms_automation_final"] = wms
pw = types.ModuleType("playwright.sync_api")
pw.sync_playwright = lambda: mock.MagicMock()
sys.modules["playwright.sync_api"] = pw

PICK, ORD, PEND, DESP = "Avance de Picking", "Detalle de Orden", "Pendientes", "Despachados"
CORTO = {PICK: "Picking", ORD: "Detalle", PEND: "Pend", DESP: "Desp"}


def preparar(modulo):
    registro = []
    modulo.log = lambda mensaje, nivel="INFO": registro.append("[%s] %s" % (nivel, mensaje))
    modulo.LOGS = os.path.join(TMP, "logs_" + modulo.__name__)
    modulo.time = types.SimpleNamespace(time=time.time, sleep=lambda s: None)
    return registro


def correr(modulo, registro, banderas):
    del BAJADAS[:]
    del registro[:]
    sys.argv = ["picking_y_orden.py"] + banderas
    rc = modulo.run()
    return list(BAJADAS), rc


NUEVO = cargar("po_nuevo", os.path.join(ROBOT, "picking_y_orden.py"))
TRAMOS = version_de("df368695", "robot/picking_y_orden.py", "po_tramos")
SERVIDOR = version_de("cd8c2904", "robot/picking_y_orden.py", "po_servidor")
REG = {m: preparar(m) for m in (NUEVO, TRAMOS, SERVIDOR)}

# (nombre, banderas, lo que baja el nuevo, lo que bajan los de antes)
CASOS = [
    ("la corrida de las 04:30", ["--solo-pendientes"], [PEND, DESP], [PEND, DESP]),
    ("la bajada del correo", ["--solo-pendientes", "--sin-despachados"], [PEND], [PEND, DESP]),
    ("el cierre de turno", ["--solo-dia"], [PICK, ORD], [PICK, ORD]),
    ("sin banderas (ayer)", [], [PICK, ORD, PEND, DESP], [PICK, ORD, PEND, DESP]),
]
print("   %-26s %-22s %-22s %s" % ("", "servidor (cd8c2904)", "tramos (df368695)", "nuevo"))
for nombre, banderas, espera_nuevo, espera_antes in CASOS:
    fila = {}
    for m in (SERVIDOR, TRAMOS, NUEVO):
        fila[m] = correr(m, REG[m], banderas)
    print("   %-26s %-22s %-22s %s" % (
        nombre, *["+".join(CORTO[b] for b in fila[m][0]) + "  rc %s" % fila[m][1]
                  for m in (SERVIDOR, TRAMOS, NUEVO)]))
    comprobar(fila[NUEVO] == (espera_nuevo, 0), "%s: el nuevo baja %s" % (nombre, espera_nuevo),
              REG[NUEVO])
    comprobar(fila[TRAMOS] == (espera_antes, 0) and fila[SERVIDOR] == (espera_antes, 0),
              "%s: los de antes bajan %s" % (nombre, espera_antes))
    comprobar(not os.path.exists(bloqueo_wms.ARCHIVO), "%s: el candado queda libre" % nombre)

hoy = datetime.now().strftime("%d-%m-%Y")
correr(NUEVO, REG[NUEVO], ["--solo-pendientes", "--sin-despachados"])
comprobar(any("FOTO FRESCA" in r and hoy in r for r in REG[NUEVO]),
          "la bajada del correo pide el dia de HOY (%s)" % hoy, REG[NUEVO])
comprobar(any("--sin-despachados: los Despachados NO se bajan" in r for r in REG[NUEVO]),
          "el log dice que los Despachados no se bajan", REG[NUEVO])
comprobar(any("Despachados: no tocaba (--sin-despachados)" in r for r in REG[NUEVO]),
          "el resumen dice 'no tocaba (--sin-despachados)'", REG[NUEVO])
comprobar(not any("Despachados  ->" in r for r in REG[NUEVO]),
          "no anuncia una ruta de Despachados que no va a bajar", REG[NUEVO])

correr(NUEVO, REG[NUEVO], ["--solo-dia"])
comprobar(any("Despachados: no tocaba (--solo-dia)" in r for r in REG[NUEVO]),
          "el cierre de turno sigue diciendo 'no tocaba (--solo-dia)'", REG[NUEVO])

FALLA_EN.add(PEND)
_, rc = correr(NUEVO, REG[NUEVO], ["--solo-pendientes", "--sin-despachados"])
FALLA_EN.clear()
comprobar(rc == 1, "si el Pendientes falla, la bajada del correo sale con 1 (salio %s)" % rc)

for m in (TRAMOS, NUEVO):
    bajo, rc = correr(m, REG[m], ["--solo-despachados"])
    comprobar((bajo, rc) == ([DESP], 0), "%s --solo-despachados baja solo Despachados" % m.__name__)
comprobar(any("Pendientes:  no tocaba (--solo-despachados)" in r for r in REG[NUEVO]),
          "--solo-despachados sigue diciendo 'no tocaba (--solo-despachados)'", REG[NUEVO])

# ══ 2. armar_pendiente: la bajada cortada y su candado ═════════════════════════
print()
print("2. armar_pendiente.refrescar_pendientes() con procesos de verdad")

FALSO = os.path.join(TMP, "robot_falso")
os.makedirs(os.path.join(FALSO, "logs"))
os.makedirs(os.path.join(FALSO, "Correos Picking"))
shutil.copyfile(os.path.join(ROBOT, "bloqueo_wms.py"), os.path.join(FALSO, "bloqueo_wms.py"))
bloqueo_wms.CARPETA = os.path.join(FALSO, "logs")
bloqueo_wms.ARCHIVO = os.path.join(FALSO, "logs", "wms_ocupado.lock")

BAJADOR_FALSO = '''# -*- coding: utf-8 -*-
import io, json, os, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import bloqueo_wms
guion = json.load(io.open(os.path.join(AQUI, "guion.json"), encoding="utf-8"))
with io.open(os.path.join(AQUI, "lanzado.json"), "w", encoding="utf-8") as fh:
    fh.write(json.dumps({"argv": sys.argv[1:], "pid": os.getpid()}))
modo = guion["modo"]
if modo == "termina":
    bloqueo_wms.tomar("pendientes de la tarde")
    with io.open(guion["pendientes"], "w", encoding="utf-8") as fh:
        fh.write("foto nueva")
    bloqueo_wms.soltar()
    sys.exit(0)
if modo == "cede":
    sys.exit(3)
if modo == "colgada_adentro":
    bloqueo_wms.tomar("pendientes de la tarde")
    time.sleep(300)
if modo == "colgada_esperando":
    time.sleep(300)
sys.exit(1)
'''
with io.open(os.path.join(FALSO, "picking_y_orden.py"), "w", encoding="utf-8") as fh:
    fh.write(BAJADOR_FALSO)

import armar_pendiente as AP_NUEVO  # noqa: E402

AP_VIEJO = version_de("df368695", "robot/armar_pendiente.py", "armar_viejo")
ESPERA = 5


def preparar_armador(A):
    registro = []
    A.log = lambda t, nivel="INFO": registro.append("[%s] %s" % (nivel, t))
    A.AQUI = FALSO
    A.PENDIENTES = os.path.join(FALSO, "Detalle Orden Pendientes.csv")
    A.CORREOS = os.path.join(FALSO, "Correos Picking")
    A.ESPERA_BAJADA = ESPERA
    return registro


def sigue_vivo(pid):
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)   # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return False
    codigo = ctypes.c_ulong()
    k.GetExitCodeProcess(h, ctypes.byref(codigo))
    k.CloseHandle(h)
    return codigo.value == 259               # STILL_ACTIVE


def escenario(A, registro, modo, candado=None, hace_seg=0):
    """Foto de la manana, correo de la tarde, y la bajada hace lo que diga `modo`."""
    del registro[:]
    lanzado_json = os.path.join(FALSO, "lanzado.json")
    if os.path.exists(lanzado_json):
        os.remove(lanzado_json)
    bloqueo_wms.soltar()
    with io.open(os.path.join(FALSO, "guion.json"), "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"modo": modo, "pendientes": A.PENDIENTES}))
    ahora = time.time()
    with io.open(A.PENDIENTES, "w", encoding="utf-8") as fh:
        fh.write("foto vieja")
    os.utime(A.PENDIENTES, (ahora - 7200, ahora - 7200))
    correo = os.path.join(A.CORREOS, "Guías %s.xlsx" % datetime.now().strftime("%d.%m"))
    with io.open(correo, "w", encoding="utf-8") as fh:
        fh.write("correo")
    os.utime(correo, (ahora - 600, ahora - 600))
    if candado:
        bloqueo_wms.tomar(candado)
        os.utime(bloqueo_wms.ARCHIVO, (ahora - hace_seg, ahora - hace_seg))
    t0 = time.time()
    ok = A.refrescar_pendientes()
    dur = time.time() - t0
    lanzado = {}
    if os.path.exists(lanzado_json):
        with io.open(lanzado_json, encoding="utf-8") as fh:
            lanzado = json.load(fh)
    return ok, dur, lanzado, bloqueo_wms.quien_esta()


def dice(registro, pedazo):
    return any(pedazo in r for r in registro)


REG_N = preparar_armador(AP_NUEVO)
REG_V = preparar_armador(AP_VIEJO)

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "termina")
comprobar(ok and duenio is None, "termina bien: hay foto nueva y el candado queda libre", REG_N)
comprobar(lanzado.get("argv") == ["--solo-pendientes", "--sin-despachados"],
          "lanza picking_y_orden.py --solo-pendientes --sin-despachados (lanzo %s)"
          % lanzado.get("argv"))
ok, dur, lanzado, duenio = escenario(AP_VIEJO, REG_V, "termina")
comprobar(lanzado.get("argv") == ["--solo-pendientes"],
          "(la version vieja lanzaba %s)" % lanzado.get("argv"))

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "cede")
comprobar(not ok and dice(REG_N, "le cede el paso") and duenio is None
          and not dice(REG_N, "se solto"),
          "cede (codigo 3): no publica y no toca ningun candado", REG_N)

ok, dur, lanzado, duenio = escenario(AP_VIEJO, REG_V, "colgada_adentro")
comprobar(duenio is not None and duenio["quien"] == "pendientes de la tarde",
          "DEFECTO DE ANTES: la version vieja corta la bajada y el candado queda puesto "
          "(%s)" % (duenio and duenio["quien"]), REG_V)
comprobar(dice(REG_V, "FALLO (codigo -1)"),
          "(y la version vieja lo anotaba como 'FALLO (codigo -1)')", REG_V)

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "colgada_adentro")
comprobar(not ok and ESPERA - 0.5 <= dur < ESPERA + 10,
          "colgada adentro: se corta a los %d s (tardo %.1f s) y no publica" % (ESPERA, dur),
          REG_N)
comprobar(dice(REG_N, "se corto sin terminar") and not dice(REG_N, "FALLO (codigo"),
          "el log dice que se corto por tiempo, no un 'FALLO (codigo -1)'", REG_N)
comprobar(duenio is None and dice(REG_N, "se solto el candado"),
          "suelta el candado que dejo SU bajada", REG_N)
comprobar(lanzado.get("pid") and not sigue_vivo(lanzado["pid"]),
          "la bajada cortada ya no esta viva (pid %s)" % lanzado.get("pid"))

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "colgada_esperando",
                                     candado="recuperar picking", hace_seg=300)
comprobar(duenio is not None and duenio["quien"] == "recuperar picking"
          and dice(REG_N, "es de otro robot"),
          "cortada mientras esperaba: el candado de 'recuperar picking' NO se toca", REG_N)

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "colgada_esperando",
                                     candado="pendientes de la tarde", hace_seg=60)
comprobar(duenio is not None and duenio["quien"] == "pendientes de la tarde"
          and dice(REG_N, "es de otro robot"),
          "un 'pendientes de la tarde' tomado ANTES de lanzar la bajada NO se toca", REG_N)

ok, dur, lanzado, duenio = escenario(AP_NUEVO, REG_N, "colgada_esperando")
comprobar(duenio is None and dice(REG_N, "ya estaba libre"),
          "cortada sin candado: lo dice y no hace nada", REG_N)

bloqueo_wms.soltar()
shutil.rmtree(TMP, ignore_errors=True)
print()
if FALLAS:
    print("%d FALLAS" % len(FALLAS))
    sys.exit(1)
print("TODO OK")
