# -*- coding: utf-8 -*-
"""RECUPERAR MESES DE EMBALAJE (OBLPN)  ·  una sola corrida, muchos dias, con prioridad.

Daniel, 10-sep-2026: *"hagamos lo mismo ahora para embalaje. Creo que tenemos desde agosto
nada mas... hay que traerlo desde abril, igualito que picking. Recuerda la fecha de creacion:
tiene que ser de agosto del dos mil veinticinco, y vas poniendo las fechas en base a lo que vas
avanzando... Si algun robot se te cruza, omite ese robot, que no se corra. El robot de embalaje
tiene la prioridad"*.

QUE BAJA: la pantalla TRX_OBLPN/CARTON de cada dia con la MISMA `descargar_oblpn` del robot de
todos los dias (`oblpn_embalaje.py`): fecha de MODIFICACION del dia, de 00:00 a 23:59. Cambian
tres cosas:

  1. EL PISO DE CREACION ES 01/08/2025, no 01/01/2026. Lo pidio Daniel, igual que en picking.
  2. EL PISO DE FILAS ES UNA. Lo que devuelve el WMS es lo que se trabajo: un feriado con
     veinte lineas es un dia de veinte lineas, no una descarga fallida.
  3. EL CANDADO NO SE SUELTA ENTRE DIAS. Los demas robots del WMS, al encontrarlo tomado, se
     saltean su corrida o se rinden sin entrar: es el "que no se corra" de Daniel.

QUE DIAS PIDE: los que no tienen archivo Y LOS QUE QUEDARON CORTADOS. Un archivo grabado antes
de que terminara su dia no trae la tarde: `OBLPN 10-09.csv` lo bajo el cierre de las 19:30 a las
20:34, y lo completaba el `cierre_dia` de las 08:30, que mientras corre esto no entra. Sin
`--hasta` el tramo llega hasta AYER y se vuelve a mirar al terminar, asi que los dias que pasen
mientras corre tambien quedan completos. Un dia marcado "sin movimiento" solo cuenta como vacio
si la marca se escribio despues de que el dia termino: la del cierre de las 07:00 dice que la
noche no embalo, no que el dia entero estuvo quieto.

LOS DOS CIERRES DE TURNO NO SE TOCAN. No ceden -esperan 12 minutos y entran igual, porque el
stock del turno no se puede perder; Daniel: *"el que no debe omitir es el de las siete"*- y dos
sesiones de la cuenta `dames` se tumban entre si. Las horas salen del horario publicado en la
web, el mismo que lee el ancla. Antes de cada cierre no se empieza un dia que no alcance a
terminar, se suelta el WMS, y se retoma recien cuando el cierre termino ENTERO: se mira que no
quede vivo ninguno de sus pasos, no la hora ni el candado. Entre paso y paso del cierre el
candado queda libre unos segundos, y entrar ahi dejaria sin WMS al paso siguiente.

CADA ARCHIVO QUEDA FECHADO AL CIERRE DE SU DIA. `produccion_embalaje.py`, cuando no hay archivo
de hoy, publica "el mas nuevo" por fecha de archivo: sin esto, un dia de abril recien bajado
pasaria por el ultimo.

SE PUEDE VOLVER A CORRER SIN MIEDO: mira la carpeta y pide solo lo que falta.

    python recuperar_oblpn.py --probar
    python recuperar_oblpn.py --desde 01-04-2026 --vence 14-09-2026
"""
import io
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)
LOGS = os.path.join(AQUI, "logs")
TEMPORAL = os.path.join(AQUI, "_bajando_oblpn")
_LOG = None

QUIEN = "recuperar embalaje"
CREACION = "01/08/2025"
DESDE = datetime(2026, 4, 1)
# Los cierres de turno, con la hora que vale si la web no contesta.
ANCLAS = (("ancla_manana", "07:00"), ("ancla_noche", "19:30"))
# Los pasos de `ejecutar_robot_wms.bat`. Mientras uno siga vivo, el cierre no termino.
PASOS_DEL_CIERRE = ("wms_automation_final.py", "corte_turno.py", "picking_y_orden.py --solo-dia",
                    "avisar_log.py", "resumen_turno.py")
MARGEN_MIN = 3             # el dia tiene que terminar al menos esto antes del ancla
ARRANQUE_MIN = 15          # si a esta altura no hay ningun paso del cierre andando, hoy no corre
PAUSA_A_CIEGAS_MIN = 100   # si no se pueden mirar los procesos, lo que dura un cierre con parte
DIA_ESTIMADO_MIN = 35      # lo que se supone que tarda un dia hasta medir los primeros
DIAS_POR_SESION = 3        # se vuelve a entrar al WMS cada tantos dias
MAX_INTENTOS = 3


def log(mensaje, nivel="INFO"):
    linea = "[%s] [%-5s] %s" % (datetime.now().strftime("%d-%m %H:%M:%S"), nivel, mensaje)
    try:
        print(linea)
        sys.stdout.flush()
    except Exception:
        pass
    try:
        if _LOG:
            with io.open(_LOG, "a", encoding="utf-8") as fh:
                fh.write(linea + "\n")
    except Exception:
        pass


def abrir_log():
    global _LOG
    os.makedirs(LOGS, exist_ok=True)
    _LOG = os.path.join(LOGS, "recuperar_oblpn_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))


def arg(nombre, defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith(nombre + "="):
            return a.split("=", 1)[1]
    return defecto


def fecha(txt):
    return datetime.strptime(txt, "%d-%m-%Y") if txt else None


def ayer():
    h = datetime.now()
    return datetime(h.year, h.month, h.day) - timedelta(days=1)


# ── LOS DIAS ──────────────────────────────────────────────────────────────────

def fin_del_dia(d):
    return datetime(d.year, d.month, d.day) + timedelta(days=1)


def nombre_de(carpeta, d):
    return os.path.join(carpeta, "OBLPN %s.csv" % d.strftime("%d-%m"))


def marcas_sin_movimiento():
    """{dia: cuando se comprobo} de los dias que el OBLPN encontro vacios."""
    try:
        with io.open(os.path.join(LOGS, "sin_movimiento.json"), encoding="utf-8") as fh:
            crudo = json.load(fh).get("oblpn") or {}
    except Exception:
        return {}
    marcas = {}
    for dia, cuando in crudo.items():
        try:
            marcas[dia] = datetime.strptime(str(cuando)[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return marcas


def estado_del_dia(carpeta, d, marcas):
    """'bajado', 'sin movimiento', 'cortado' o 'falta'."""
    ruta = nombre_de(carpeta, d)
    hay = os.path.exists(ruta) and os.path.getsize(ruta) > 0
    if hay and datetime.fromtimestamp(os.path.getmtime(ruta)) >= fin_del_dia(d):
        return "bajado"
    cuando = marcas.get(d.strftime("%d-%m-%Y"))
    if cuando and cuando >= fin_del_dia(d):
        return "sin movimiento"
    return "cortado" if hay else "falta"


def dias_por_bajar(carpeta, d0, d1, intentos, marcas=None):
    """[(dia, motivo)] en orden. Deja afuera los que ya gastaron sus intentos."""
    if marcas is None:
        marcas = marcas_sin_movimiento()
    pedir, d = [], d0
    while d <= d1:
        e = estado_del_dia(carpeta, d, marcas)
        if e in ("falta", "cortado") and intentos.get(d, 0) < MAX_INTENTOS:
            pedir.append((d, e))
        d += timedelta(days=1)
    return pedir


def fechar(ruta, d):
    """El archivo queda con la hora en que cerro su dia. Ver arriba."""
    t = (fin_del_dia(d) + timedelta(seconds=30)).timestamp()
    try:
        os.utime(ruta, (t, t))
    except OSError as e:
        log("no pude ponerle al archivo la fecha de su dia (%s)" % e, "WARN")


def mover(origen, destino):
    """Del temporal a OneDrive. Reintenta: OneDrive puede tener el archivo viejo abierto."""
    ultimo = None
    for _ in range(3):
        try:
            os.replace(origen, destino)
            return True
        except OSError as e:
            ultimo = e
            time.sleep(10)
    try:
        shutil.copyfile(origen, destino)
        os.remove(origen)
        return True
    except OSError as e:
        log("No se pudo dejar el archivo en OneDrive (%s / %s)" % (ultimo, e), "ERROR")
        return False


def estimado(duraciones):
    """Cuanto se supone que va a tardar el dia que sigue, en minutos."""
    if not duraciones:
        return DIA_ESTIMADO_MIN
    return max(15.0, max(duraciones[-4:]) + 8.0)


# ── LOS CIERRES DE TURNO ──────────────────────────────────────────────────────

_HORARIO = {"cuando": 0.0, "cfg": None}


def config_publicada():
    """Los horarios de los robots, los mismos que lee el ancla. Se releen cada 30 minutos."""
    if _HORARIO["cfg"] is None or time.time() - _HORARIO["cuando"] > 1800:
        try:
            import horario_robot as hr
            _HORARIO["cfg"], _ = hr.configuracion()
        except Exception as e:
            log("No se pudo leer el horario (%s): van las horas de siempre" % e, "WARN")
            _HORARIO["cfg"] = {}
        _HORARIO["cuando"] = time.time()
    return _HORARIO["cfg"]


def cierres_proximos(ahora):
    """[(inicio, tarea)] de los cierres de hoy y de manana, en orden."""
    cfg = config_publicada()
    try:
        import horario_robot as hr
    except Exception:
        hr = None
    base = datetime(ahora.year, ahora.month, ahora.day)
    salida = []
    for k in (0, 1):
        dia = base + timedelta(days=k)
        for tarea, defecto in ANCLAS:
            hora, activa = defecto, True
            if hr is not None and cfg:
                c = hr._de(cfg, tarea)
                hora = c.get("hora") or defecto
                activa = bool(c.get("activa", True)) and bool(
                    (c.get("dias") or {}).get(hr.DIAS[dia.weekday()], True))
            if not activa:
                continue
            try:
                h, m = [int(x) for x in str(hora).split(":")]
            except ValueError:
                h, m = [int(x) for x in defecto.split(":")]
            salida.append((dia + timedelta(hours=h, minutes=m), tarea))
    return sorted(salida)


def cierre_que_se_cruza(ahora, minutos_dia, atendidos):
    """El cierre que arranca antes de que termine un dia empezado ahora, o None."""
    for inicio, tarea in cierres_proximos(ahora):
        if inicio in atendidos or ahora >= inicio + timedelta(minutes=ARRANQUE_MIN):
            continue
        if ahora + timedelta(minutes=minutos_dia + MARGEN_MIN) >= inicio:
            return inicio, tarea
    return None


def pasos_del_cierre_vivos():
    """True si corre algun paso del cierre, False si no, None si no se pudo mirar."""
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command",
             "Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }"],
            capture_output=True, encoding="utf-8", errors="replace", timeout=90,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except Exception:
        return None
    if r.returncode != 0 or not r.stdout.strip():
        return None
    return any(p in linea for linea in r.stdout.splitlines() for p in PASOS_DEL_CIERRE)


def es_mio(bloqueo_wms):
    d = bloqueo_wms.quien_esta()
    return bool(d) and d.get("quien") == QUIEN


def soltar_si_es_mio(bloqueo_wms):
    d = bloqueo_wms.quien_esta()
    if not d or d.get("quien") == QUIEN:
        bloqueo_wms.soltar()


def esperar_wms_libre(bloqueo_wms):
    """Toma el candado cuando el WMS quedo libre DE VERDAD: sin otro robot con el candado y sin
    ningun paso del cierre vivo, dos veces seguidas con un minuto de diferencia."""
    seguidas, avisado = 0, False
    while True:
        duenio = bloqueo_wms.quien_esta()
        otro = bool(duenio) and duenio.get("quien") != QUIEN
        ocupado = otro or bool(pasos_del_cierre_vivos())
        if ocupado:
            seguidas = 0
            if not avisado:
                log("El WMS esta ocupado (%s): se espera, sin entrar encima."
                    % (duenio["quien"] if otro else "un paso del cierre de turno"))
                avisado = True
        else:
            seguidas += 1
            if seguidas >= 2:
                break
        time.sleep(60)
    if avisado:
        log("El WMS quedo libre: se sigue.")
    bloqueo_wms.tomar(QUIEN)


def pausar_por_cierre(inicio, tarea, bloqueo_wms, cerrar_sesion):
    log("")
    log("PAUSA POR EL CIERRE DE TURNO (%s de las %s): no se empieza otro dia y se suelta el WMS."
        % (tarea, inicio.strftime("%d-%m %H:%M")), "WARN")
    cerrar_sesion()
    soltar_si_es_mio(bloqueo_wms)
    vivos = None
    while datetime.now() < inicio + timedelta(minutes=ARRANQUE_MIN):
        vivos = pasos_del_cierre_vivos()
        if vivos:
            break
        time.sleep(60)
    if vivos is None:
        fin = inicio + timedelta(minutes=PAUSA_A_CIEGAS_MIN)
        log("No se pueden mirar los procesos: se espera hasta las %s." % fin.strftime("%H:%M"),
            "WARN")
        while datetime.now() < fin:
            time.sleep(60)
    elif vivos:
        log("El cierre arranco: se espera a que termine entero, con su parte.")
    else:
        log("No arranco ningun paso del cierre: hoy no corre. Se sigue.", "WARN")
    esperar_wms_libre(bloqueo_wms)
    log("Se retoma despues del cierre.")


# ── EL WMS ────────────────────────────────────────────────────────────────────

def entrar(p, wms):
    """Igual que `oblpn_embalaje.run()`: el mismo navegador y la misma entrada."""
    nav = p.chromium.launch(headless=True)
    try:
        page = nav.new_context().new_page()
        page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
        page.wait_for_selector("input[name='username']", timeout=20000)
        page.fill("input[name='username']", wms.WMS_USER)
        page.fill("input[name='password']", wms.WMS_PASSWORD)
        page.locator("button[type='submit'], input[type='submit'], "
                     "input[value='Sign In']").first.click()
        log("Sesion iniciada como %s" % wms.WMS_USER)
        time.sleep(15)
        return nav, page
    except Exception:
        cerrar(nav)
        raise


def cerrar(nav):
    try:
        if nav:
            nav.close()
    except Exception:
        pass


def run():
    abrir_log()
    import bloqueo_wms
    import picking_y_orden as po
    import oblpn_embalaje as ob
    import wms_automation_final as wms

    po.log = log
    wms.log = log
    ob.PISO_CREACION = arg("--creacion", CREACION)
    ob.MINIMO_FILAS = 1

    vence = fecha(arg("--vence"))
    if vence and datetime.now() >= fin_del_dia(vence):
        log("La recuperacion vencio el %s: no se hace nada." % vence.strftime("%d-%m-%Y"))
        return 0
    d0 = fecha(arg("--desde")) or DESDE
    hasta_fija = fecha(arg("--hasta"))
    base = ob.base_onedrive()
    if not base:
        log("No encuentro la carpeta de OneDrive", "ERROR")
        return 1
    carpeta = os.path.join(base, ob.CARPETA)
    os.makedirs(carpeta, exist_ok=True)
    intentos = {}

    def tramo():
        d1 = min(hasta_fija or ayer(), ayer())
        return d1, dias_por_bajar(carpeta, d0, d1, intentos)

    d1, pendientes = tramo()
    faltan = sum(1 for _, m in pendientes if m == "falta")
    log("=" * 66)
    log("RECUPERAR EMBALAJE  ·  %s a %s" % (d0.strftime("%d-%m-%Y"), d1.strftime("%d-%m-%Y")))
    log("=" * 66)
    log("por bajar ................. %d  (%d sin archivo, %d cortados antes de terminar el dia)"
        % (len(pendientes), faltan, len(pendientes) - faltan))
    log("fecha de creacion desde ... %s" % ob.PISO_CREACION)
    log("carpeta ................... %s" % carpeta)
    for inicio, tarea in cierres_proximos(datetime.now()):
        log("cierre de turno ........... %s  %s" % (inicio.strftime("%d-%m %H:%M"), tarea))
    for i in range(0, len(pendientes), 10):
        log("   " + "  ".join(d.strftime("%d-%m") + ("*" if m == "cortado" else "")
                              for d, m in pendientes[i:i + 10]))
    if "--probar" in sys.argv:
        log("pasos del cierre andando ahora: %s" % pasos_del_cierre_vivos())
        log("(* = cortado: el archivo se grabo antes de que terminara su dia)")
        return 0
    if not pendientes:
        log("No falta ninguno.")
        return 0
    if not wms.WMS_PASSWORD or wms.WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta WMS_PASSWORD en el .env", "ERROR")
        return 1

    from playwright.sync_api import sync_playwright
    os.makedirs(TEMPORAL, exist_ok=True)
    t0 = time.time()
    bajados, vacios, fallaron, duraciones = [], [], [], []
    atendidos = set()
    sesion = {"nav": None, "page": None, "dias": 0}
    fallas_entrada = 0

    def cerrar_sesion():
        cerrar(sesion["nav"])
        sesion.update(nav=None, page=None, dias=0)

    try:
        with sync_playwright() as p:
            esperar_wms_libre(bloqueo_wms)
            while True:
                if not pendientes:
                    d1, pendientes = tramo()
                    if not pendientes:
                        break
                    log("Se agregan %d dias: terminaron o quedaron cortados mientras corria esto."
                        % len(pendientes))

                choque = cierre_que_se_cruza(datetime.now(), estimado(duraciones), atendidos)
                if choque:
                    atendidos.add(choque[0])
                    pausar_por_cierre(choque[0], choque[1], bloqueo_wms, cerrar_sesion)
                    continue
                if not es_mio(bloqueo_wms) or pasos_del_cierre_vivos():
                    cerrar_sesion()
                    esperar_wms_libre(bloqueo_wms)
                    continue
                bloqueo_wms.tomar(QUIEN)             # refresca: vence a los 150 minutos

                d, motivo = pendientes[0]
                clave = d.strftime("%d-%m-%Y")
                if sesion["nav"] is None or sesion["dias"] >= DIAS_POR_SESION:
                    cerrar_sesion()
                    try:
                        sesion["nav"], sesion["page"] = entrar(p, wms)
                        fallas_entrada = 0
                    except Exception as e:
                        fallas_entrada += 1
                        espera = min(10, 2 * fallas_entrada)
                        log("No se pudo entrar al WMS (%s: %s). Nuevo intento en %d min."
                            % (type(e).__name__, str(e)[:160], espera), "WARN")
                        if fallas_entrada >= 12:
                            log("Doce veces seguidas sin poder entrar: se corta la corrida.",
                                "ERROR")
                            break
                        time.sleep(espera * 60)
                        continue

                t_dia = time.time()
                temporal = os.path.join(TEMPORAL, "OBLPN %s.csv" % d.strftime("%d-%m"))
                if os.path.exists(temporal):
                    os.remove(temporal)
                ob.SIN_MOVIMIENTO.discard(clave)
                try:
                    ok = bool(ob.descargar_oblpn(sesion["page"], temporal, d))
                except Exception as e:
                    log("El %s fallo (%s: %s)" % (clave, type(e).__name__, str(e)[:160]), "WARN")
                    ok = False
                sesion["dias"] += 1
                minutos = (time.time() - t_dia) / 60.0

                if not ok and not es_mio(bloqueo_wms):
                    log("Mientras se bajaba el %s entro otro robot al WMS (%s): no cuenta como "
                        "intento y se repite despues." % (
                            clave, (bloqueo_wms.quien_esta() or {}).get("quien", "?")), "WARN")
                    cerrar_sesion()
                    continue
                intentos[d] = intentos.get(d, 0) + 1

                if clave in ob.SIN_MOVIMIENTO:
                    vacios.append(d)
                    pendientes.pop(0)
                    estado = "sin movimiento (no se embalo)"
                elif ok and os.path.exists(temporal):
                    destino = nombre_de(carpeta, d)
                    if mover(temporal, destino):
                        fechar(destino, d)
                        bajados.append(d)
                        duraciones.append(minutos)
                        pendientes.pop(0)
                        estado = "bajado, %.1f MB" % (os.path.getsize(destino) / 1048576.0)
                    else:
                        ok = False
                else:
                    ok = False
                if not ok and clave not in ob.SIN_MOVIMIENTO:
                    # EL INTENTO SIGUIENTE VA CON NAVEGADOR LIMPIO: es lo que destrabo los dias
                    # que fallaban seguidos en la recuperacion de picking.
                    cerrar_sesion()
                    if intentos[d] >= MAX_INTENTOS:
                        fallaron.append(d)
                        pendientes.pop(0)
                        estado = "NO SALIO en %d intentos, se sigue con el siguiente" % MAX_INTENTOS
                    else:
                        estado = "fallo el intento %d, se repite" % intentos[d]

                promedio = sum(duraciones) / len(duraciones) if duraciones else DIA_ESTIMADO_MIN
                log("DIA %s (%s): %s en %.1f min  ·  %d bajados, %d sin movimiento, %d fallaron  "
                    "·  quedan %d (~%.0f h de WMS)  ·  %.1f h de corrida" % (
                        clave, motivo, estado, minutos, len(bajados), len(vacios), len(fallaron),
                        len(pendientes), len(pendientes) * promedio / 60.0,
                        (time.time() - t0) / 3600.0))
    finally:
        cerrar_sesion()
        soltar_si_es_mio(bloqueo_wms)

    log("")
    log("=" * 66)
    log("%s en %.1f horas  ·  %d bajados  ·  %d sin movimiento  ·  %d fallaron" % (
        "LISTO" if not fallaron else "TERMINADO CON FALLAS", (time.time() - t0) / 3600.0,
        len(bajados), len(vacios), len(fallaron)))
    if fallaron:
        log("NO SALIERON: %s" % ", ".join(x.strftime("%d-%m") for x in fallaron), "ERROR")
        log("Se piden de nuevo corriendo lo mismo: la carpeta dice que faltan.", "ERROR")
    log("=" * 66)
    return 0 if not fallaron else 1


if __name__ == "__main__":
    try:
        sys.exit(run())
    except SystemExit:
        raise
    except BaseException:
        log("SE CAYO:\n" + traceback.format_exc(), "ERROR")
        sys.exit(1)
