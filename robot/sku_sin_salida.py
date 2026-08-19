# -*- coding: utf-8 -*-
"""
SKUs SIN SALIDA  ·  los que llegaron y no se están moviendo
============================================================

Lo pidió Daniel el 12-ago-2026: *"quiero que me muestres los SKUs que en la
primera semana no han salido, ni en la segunda semana"*, sobre las temporadas
2026-Q3, 2026-Q4, 2027-Q1 y 2027-Q2. Su vara: **a la segunda semana ya debería
haberse ido el 50-60%** del SKU.

Este archivo hace lo que hacían dos scripts sueltos —`sin_salida.py` y
`maqueta2.py`— con los que se armó la maqueta que él aprobó el 13-ago, pero en
vez de escribir un HTML con los números pegados, **publica los datos** para que
la pantalla los dibuje. Once idas y vueltas con Daniel definieron cada columna;
no se cambia ninguna sin volver a preguntarle.

DOS FUENTES, Y NADA MÁS
-----------------------
  1. **Las fotos de stock** (activo + reserva), que el robot ya baja y acumula en
     `evolucion_fotos.json.gz`. De ahí sale cuándo llegó cada artículo y con
     cuánto, cuánto salió cada semana, cuánto se picó desde que llegó, cuándo fue
     el último pick y cuánto queda hoy.
  2. **El Detalle de Orden**, de donde sale el pendiente, las órdenes, las
     tiendas y el pedido más antiguo.

LO PICADO SALE DE LAS FOTOS, NO DE LOS ARCHIVOS DE PICKING. Comprobado contra los
39: con las fotos, `llegó + repuso − picado = pares hoy` cierra en los 39; con los
archivos de picking, en 10. Esos archivos van del 20-jul en adelante y la mitad de
estos artículos llegó en febrero o marzo.

LA REGLA DEL PENDIENTE, que la fijó Daniel
------------------------------------------
`pendiente = Cantidad solicitada − Cantidad asignada`, y las tres columnas van a
la vista, no solo la resta: él preguntó por qué "Pares hoy" y "Pendiente" no
coincidían y supuso que la diferencia era lo asignado. No lo es —`asignado +
pendiente` es lo que se pidió, y eso no tiene por qué coincidir con lo que hay en
el almacén—.

EL QUE HOY ESTÁ EN CERO NO ENTRA
--------------------------------
*"¿Cómo se va a hacer un pedido con stock cero? No tiene pedido porque no hay
stock para pedirlo"*. Y el denominador de la tarjeta se calcula con la MISMA
regla: si el numerador deja fuera a los que están en cero, el denominador también.

EL ORDEN LO DECIDE LA ESPERA, NO EL TAMAÑO
------------------------------------------
Primero ordenaba por el tamaño del pendiente y Daniel lo corrigió: lo que decide a
qué se le entra no es cuántos pares son, es **cuántos días lleva el pedido sin
atender**. A igualdad de días, el más grande arriba. Los que nadie pidió no tienen
fecha contra qué ordenar: van por pares parados.

Y el que NUNCA salió lleva 9999 días por dentro, para que al ordenar quede
ARRIBA: no tener ni una salida es el peor caso, no el mejor.

CÓMO SE CORRE
-------------
    python sku_sin_salida.py                 calcula y publica
    python sku_sin_salida.py --sin-publicar  calcula y muestra, no escribe nada
"""

import csv
import glob
import gzip
import io
import json
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

LOGS = os.path.join(AQUI, "logs")
DIAS_DE_LOG = 7

AREA = "sku_sin_salida"

# Las temporadas que se miden. Las viejas no: ya se sabe que no salen.
TEMPORADAS = ("2026-Q3", "2026-Q4", "2027-Q1", "2027-Q2")

# Por debajo de esto se considera que el SKU no salió. Daniel puso la vara en
# 50-60% a la segunda semana; el 10% es el corte de "esto directamente no se
# movió", que es lo que el reporte muestra.
CORTE_SALIDA_PCT = 10

_LOG = None


def log(mensaje, nivel="INFO"):
    linea = "[%s] [%-5s] %s" % (datetime.now().strftime("%H:%M:%S"), nivel, mensaje)
    try:
        print(linea)
    except UnicodeEncodeError:
        print(linea.encode("ascii", "replace").decode("ascii"))
    if _LOG:
        try:
            with open(_LOG, "a", encoding="utf-8") as fh:
                fh.write(linea + "\n")
        except Exception:
            pass


def abrir_log():
    global _LOG
    os.makedirs(LOGS, exist_ok=True)
    _LOG = os.path.join(LOGS, "sinsalida_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))
    corte = time.time() - DIAS_DE_LOG * 86400
    for f in os.listdir(LOGS):
        if f.startswith("sinsalida_") and f.endswith(".log"):
            p = os.path.join(LOGS, f)
            try:
                if os.path.getmtime(p) < corte:
                    os.remove(p)
            except OSError:
                pass


# ─────────────────────────── El Detalle de Orden ───────────────────────────

def _txt(r, k):
    return (r.get(k) or "").replace('="', "").replace('"', "").strip()


def _num(r, k):
    try:
        return int(float(_txt(r, k) or 0))
    except ValueError:
        return 0


def cod7(a):
    """Los siete primeros dígitos son el artículo; lo de atrás es la talla."""
    return (a or "").split("-")[0].lstrip("0")


def leer_pedidos(carpeta):
    """El pendiente por artículo, leyendo TODOS los archivos sin contar dos veces.

    HAY DOS CLASES DE ARCHIVO EN ESA CARPETA Y SE PISAN:

      * los SEMANALES que baja Daniel a mano (`Detalle Orden Sem33.csv`), con solo
        los estados que faltan atender y varias semanas hacia atrás;
      * los DIARIOS que baja el robot desde el 13-ago-2026 (`Detalle Orden
        12-08.csv`), con todos los estados pero de un solo día.

    La misma línea de pedido está en los dos, así que sumarlas de corrido duplica
    el pendiente. Se guarda UNA sola entrada por (orden, artículo, tienda), y gana
    **la del archivo modificado más tarde**: si un pedido ya se atendió, el
    archivo nuevo lo dice y el viejo no.

    Ojo: el pendiente de las semanas viejas vive solo en los semanales. Mientras
    el robot no baje también la ventana de estados abiertos, esos archivos hay que
    refrescarlos a mano o el pendiente antiguo envejece.
    """
    lineas = {}
    archivos = sorted(glob.glob(os.path.join(carpeta, "*.csv")),
                      key=lambda p: os.path.getmtime(p))
    if not archivos:
        log("No hay ningún archivo en %s" % carpeta, "WARN")
        return {}, []

    leidos = []
    for ruta in archivos:
        n = 0
        with io.open(ruta, encoding="utf-8-sig", errors="replace") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                clave = (_txt(r, "Número de orden"),
                         _txt(r, "Código de artículo"),
                         _txt(r, "Instalación de destino"))
                lineas[clave] = r      # el archivo más nuevo pisa al viejo
                n += 1
        leidos.append((os.path.basename(ruta), n))

    P = defaultdict(lambda: {"pend": 0, "sol": 0, "asig": 0,
                             "ordenes": set(), "tiendas": set(), "viejo": None})
    for r in lineas.values():
        sol, asig = _num(r, "Cantidad solicitada"), _num(r, "Cantidad asignada")
        pend = sol - asig
        if pend <= 0:
            continue
        d = P[cod7(_txt(r, "Código de artículo"))]
        d["sol"] += sol
        d["asig"] += asig
        d["pend"] += pend
        d["ordenes"].add(_txt(r, "Número de orden"))
        d["tiendas"].add(_txt(r, "Instalación de destino"))
        f = _txt(r, "Registro de hora de creación de cabecera de orden")[:10]
        if len(f) == 10:
            try:
                iso = date(int(f[6:10]), int(f[3:5]), int(f[0:2]))
            except ValueError:
                continue
            if d["viejo"] is None or iso < d["viejo"]:
                d["viejo"] = iso
    return P, leidos


# ─────────────────────── Lo que dicen las fotos de stock ───────────────────────

def ultima_salida(ACU, cod):
    """El último día en que el total BAJÓ, que es el último día en que salió algo.

    Se mira la bajada y no "el último cambio": una reposición también mueve el
    stock y dejaría el artículo como si se hubiera trabajado ayer."""
    serie = ACU["datos"].get(cod)
    if not serie:
        return None
    ult, prev = None, None
    for f in sorted(serie):
        v = serie[f]
        tot = (v[0] or 0) + (v[1] or 0)      # activo + reserva
        if prev is not None and tot < prev:
            ult = f
        prev = tot
    return ult


def movimiento_desde(ACU, cod, llegada):
    """(lo que salió, lo que volvió a entrar) desde que el artículo llegó.

    Las subidas van aparte y NO se restan: son reposición, no picking al revés.
    Sin mostrarlas, la resta `llegó − picado = hoy` no cerraba en 6 de 14 filas y
    parecía un error del reporte."""
    serie = ACU["datos"].get(cod)
    if not serie:
        return 0, 0
    baja = sube = 0
    prev = None
    for f in sorted(serie):
        if f < llegada:
            continue
        v = serie[f]
        tot = (v[0] or 0) + (v[1] or 0)
        if prev is not None:
            if tot < prev:
                baja += prev - tot
            elif tot > prev:
                sube += tot - prev
        prev = tot
    return baja, sube


# ──────────────────────────────── El cálculo ────────────────────────────────

def calcular():
    """Devuelve el paquete listo para publicar."""
    import generar_evolucion as G

    # SE MONTA SOBRE EL MOTOR DE "EVOLUCIÓN DEL ARTÍCULO" para no reinventar las
    # trampas que ya tiene resueltas: que una tanda es un salto y no la suma de los
    # ruiditos, que la foto de la semana N puede caer corrida un día porque el robot
    # no corre los domingos, y que lo que entró es la llegada más cada subida.
    #
    # Se le sacan tres filtros a propósito:
    #   * el piso de 350 pares — deja 950 SKUs de temporada actual afuera
    #   * la ventana de 6 meses — se toma toda la historia que haya
    #   * el corte de marcas conocidas y el de calzado — se etiquetan, no se descartan
    G.WEB_SUBIR = False
    G.MINIMO_PARES = 1
    G.MESES_VENTANA = 12
    G.Estudio.conocida = lambda self, m, desc: True
    G.Estudio.es_calzado = lambda self, cod: True
    G.log = log

    base = G._base_onedrive()
    log("OneDrive: %s" % base)

    ACU, nuevas = G.actualizar_acumulado(base)
    log("Fotos de stock: %d, del %s al %s (%d nuevas)"
        % (len(ACU["fechas"]), ACU["fechas"][0], ACU["fechas"][-1], nuevas))

    maestro = G.leer_maestro(base)
    art = G.Estudio(ACU, maestro).armar()
    log("Artículos con llegada vista: %s" % format(len(art), ",d"))

    hoy = date.today()

    # ── Los de temporada actual con dos semanas cumplidas ──
    medibles, malos = 0, []
    for a in art:
        if a["coleccion"] not in TEMPORADAS:
            continue
        c = a["curva"]
        if len(c) < 3:                        # todavía no cumplió dos semanas
            continue
        w0, w1, w2 = c[0][1], c[1][1], c[2][1]
        if w0 <= 0:
            continue
        # RECIBIÓ MÁS MERCADERÍA DENTRO DE LAS DOS SEMANAS: no se puede medir con
        # esta regla, porque el stock le sube en el medio.
        if (w1 > w0) or (w2 > w1):
            continue
        if a["hoy"] <= 0:                     # el que hoy está en cero no entra
            continue
        medibles += 1
        pct2 = round((w0 - w2) * 100.0 / w0, 1)
        if pct2 < CORTE_SALIDA_PCT:
            malos.append((a, w0, round((w0 - w1) * 100.0 / w0, 1), pct2))

    log("Medibles con stock hoy: %s · sin salida: %s"
        % (format(medibles, ",d"), format(len(malos), ",d")))

    # ── El pendiente ──
    # OJO CON LA RUTA: hay DOS funciones `_base_onedrive()` y devuelven niveles
    # distintos. La de `generar_evolucion` —la que se usa acá— llega hasta
    # `danielames.bata`; la de `wms_automation_final` llega hasta `scraping Stock`.
    # Sin este `scraping Stock` la carpeta no existe, no revienta nada y el
    # pendiente sale en CERO: los 39 aparecerían todos como "sin ningún pedido",
    # que es justo la conclusión contraria a la verdadera.
    P, leidos = leer_pedidos(os.path.join(base, "scraping Stock", "Detalle Orden"))
    for nombre, n in leidos:
        log("   %-34s %s líneas" % (nombre, format(n, ",d")))

    filas = []
    for a, w0, pct1, pct2 in malos:
        c = a["cod"]
        d = P.get(c)
        viejo = d["viejo"] if d else None
        pic, rep = movimiento_desde(ACU, c, a["llegada"])
        us = ultima_salida(ACU, c)
        filas.append({
            "cod": c, "marca": a["marca"], "coleccion": a["coleccion"],
            "modelo": a["modelo"],
            "llegada": a["llegada"],                       # AAAA-MM-DD, la que ordena
            "llego_con": w0, "hoy": a["hoy"],
            "picado": pic, "repuesto": rep,
            "salio_sem1": pct1, "salio_sem2": pct2,
            "ultima_salida": us or "",
            # El que NUNCA salió lleva 9999 para quedar arriba al ordenar.
            "dias_sin_salir": (hoy - date(int(us[0:4]), int(us[5:7]), int(us[8:10]))).days if us else 9999,
            "pendiente": d["pend"] if d else 0,
            "solicitado": d["sol"] if d else 0,
            "asignado": d["asig"] if d else 0,
            "ordenes": len(d["ordenes"]) if d else 0,
            "tiendas": len(d["tiendas"]) if d else 0,
            "pedido_viejo": viejo.isoformat() if viejo else "",
            "dias_esperando": (hoy - viejo).days if viejo else 0,
        })

    conped = sorted([f for f in filas if f["pendiente"] > 0],
                    key=lambda f: (-f["dias_esperando"], -f["pendiente"]))
    sinped = sorted([f for f in filas if f["pendiente"] == 0], key=lambda f: -f["hoy"])

    paquete = {
        "fecha": hoy.isoformat(),
        "hora": datetime.now().strftime("%H:%M"),
        "temporadas": list(TEMPORADAS),
        "corte_pct": CORTE_SALIDA_PCT,
        "fotos": {"dias": len(ACU["fechas"]),
                  "desde": ACU["fechas"][0], "hasta": ACU["fechas"][-1]},
        "medidos": medibles,
        "skus": len(filas),
        "pares_parados": sum(f["hoy"] for f in filas),
        "con_pedido": {"skus": len(conped),
                       "pares_parados": sum(f["hoy"] for f in conped),
                       "pedidos": sum(f["pendiente"] for f in conped),
                       "mas_viejo_dias": max((f["dias_esperando"] for f in conped), default=0),
                       "filas": conped},
        "sin_pedido": {"skus": len(sinped),
                       "pares_parados": sum(f["hoy"] for f in sinped),
                       "filas": sinped},
    }
    return paquete


def run():
    import generar_slotting as gs

    abrir_log()
    t0 = time.time()
    sin_publicar = "--sin-publicar" in sys.argv

    log("=" * 58)
    log("SKUs SIN SALIDA%s" % ("  (NO PUBLICA)" if sin_publicar else ""))
    log("=" * 58)

    p = calcular()

    log("-" * 58)
    log("SKUs sin salida  : %s  de %s medidos (%.1f%%)"
        % (format(p["skus"], ",d"), format(p["medidos"], ",d"),
           100.0 * p["skus"] / max(1, p["medidos"])))
    log("Pares parados    : %s" % format(p["pares_parados"], ",d"))
    log("Con pedido       : %s SKUs · %s parados · %s pedidos · el más viejo %s días"
        % (p["con_pedido"]["skus"], format(p["con_pedido"]["pares_parados"], ",d"),
           format(p["con_pedido"]["pedidos"], ",d"), p["con_pedido"]["mas_viejo_dias"]))
    log("Sin ningún pedido: %s SKUs · %s parados"
        % (p["sin_pedido"]["skus"], format(p["sin_pedido"]["pares_parados"], ",d")))
    log("-" * 58)

    if sin_publicar:
        log("MODO PRUEBA: no se publica")
        ruta = os.path.join(LOGS, "sku_sin_salida_prueba.json")
        with io.open(ruta, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(p, ensure_ascii=False, indent=1))
        log("Escrito para mirarlo: %s" % ruta)
        return 0

    gs.log = log
    if not gs.subir_datos(AREA, p):
        log("No se pudo publicar", "ERROR")
        return 1

    log("LISTO en %.1f minutos" % ((time.time() - t0) / 60.0))
    return 0


if __name__ == "__main__":
    sys.exit(run())
