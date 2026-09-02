# -*- coding: utf-8 -*-
"""
EVOLUCIÓN DEL ARTÍCULO — el estudio que responde cuánto tarda en agotarse un código nuevo.

Lo corre el robot después de bajar los stocks de las 19:00. Deja el resultado en la
plataforma, en Picking → KPI Picking.

═══════════════════════════════════════════════════════════════════════════════════
POR QUÉ ACÁ Y NO EN LA WEB

El estudio no se puede calcular en el navegador: necesita la SERIE de fotos diarias
—cuánto tenía cada código cada día desde que llegó— y el servidor guarda una sola
foto por área, la última. Guardar 76 fotos de 8 MB no entra en su disco de 1 GB.

El robot sí las tiene todas en OneDrive. Así que el cálculo pesado corre acá y a la
plataforma sube SOLO EL RESULTADO, unos cientos de KB. Es el mismo trato que ya
tienen el Slotting y la tabla de tallas.

EL ACUMULADO. Releer las 76 fotos tarda unos dos minutos y media hora de aquí a un
año. Por eso se guarda `evolucion_fotos.json.gz`: cada corrida agrega SOLO la foto
del día. La primera vez que corre lo arma entero; después son segundos.
Si el archivo se pierde, se rehace solo. No hay nada que sembrar a mano.

═══════════════════════════════════════════════════════════════════════════════════
LAS DECISIONES, que las tomó Daniel el 06-ago-2026

· AGOTADO ES CERO PARES. No "menos del 5%" ni "menos de media caja": cero. Es lo más
  claro de explicar y el reporte no tiene que aclarar ningún umbral.

· SE SIGUE A CADA ARTÍCULO HASTA DONDE LLEGUE. La pregunta es "en cuántas semanas
  cruzó tal hito", y esa medida no necesita que todos tengan el mismo largo. Eso
  permitió pasar de 81 códigos a 203.
  OJO: para el GRÁFICO de picos sí hace falta un grupo fijo. Midiendo a todos hasta
  donde lleguen, cada semana se mide sobre un grupo distinto y la curva llega a SUBIR,
  que es imposible. El gráfico usa solo los que ya cumplieron SEMANAS_FIJAS.

· LA CURVA PRINCIPAL ES DE MARCA PROPIA. Propia y terceros se comportan al revés:
  de 149 códigos propios ni uno llegó a cero, y de 39 de terceros se agotaron 12.
  Los terceros entran y salen casi enteros —son cruce de andén, no mercadería que se
  almacena— y mezclarlos hace parecer que el almacén rota mejor de lo que rota.

· VENTANA MÓVIL DE TRES MESES. Si el grupo quedara fijo en mayo y junio, dentro de
  medio año el reporte hablaría de mercadería vieja.
"""
import csv
import gzip
import json
import os
import re
import sys
import time
import zipfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

# ── LO QUE SE PUEDE TOCAR ────────────────────────────────────────────────────────
VENTANA_DIAS = 90        # de cuánto atrás se toman los códigos nuevos
MINIMO_PARES = 350       # un cuerpo: menos que eso no obliga a decidir ubicación
SEMANAS_FIJAS = 9        # el gráfico de picos, solo con los que llegaron a esto
HITOS = [50, 25, 10]     # % que le queda de lo que llegó
TOLERANCIA_DIAS = 3      # cuánto puede alejarse una foto del día exacto de la semana

WEB_SUBIR = True
WEB_ENTORNO = os.environ.get("PULSE_ENTORNO", "produccion")
WEB_DATOS_API = "https://logistics-backend-wv0x.onrender.com/api/logistics"
AREA = "evolucion_articulo"

# LAS MARCAS PROPIAS. Si aparece una que no está en ninguna de las dos listas, el
# log lo dice: hay que decidir de qué lado va, no dejarla caer en el default.
MARCAS_PROPIAS = {
    "BATA", "BATA COMFIT", "BATA LITE", "NORTH STAR", "BUBBLEGUMMERS", "POWER",
    "WEINBRENNER", "MARIE CLAIRE", "B.G LICENSES", "BUBBLEGUMMERS LICENSES",
    "FLEXIBLE", "SANDAK", "PATAPATA",
    # Las licencias de personajes —Bluey, Toy Story, Marvel— vienen a veces con la
    # marca escrita solo como "LICENSES". Son mercadería propia.
    "LICENSES",
}
MARCAS_TERCEROS = {"PUMA", "ADIDAS", "SKECHERS", "NIKE", "REEBOK", "FILA", "CONVERSE"}

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
AQUI = os.path.dirname(os.path.abspath(__file__))
ACUMULADO = os.path.join(AQUI, "evolucion_fotos.json.gz")
# Subir este número obliga a releer las 76 fotos. Se sube cuando cambia QUÉ se guarda
# de cada foto: lo ya guardado quedó armado con la regla vieja y no se puede mezclar.
FORMATO_ACUMULADO = 2


# Cuando lo llama el robot le pasa SU log, para que todo quede en el mismo archivo de
# la corrida. Suelto, escribe por pantalla.
_LOG_EXTERNO = None


def log(msg, nivel="INFO"):
    if _LOG_EXTERNO:
        _LOG_EXTERNO("[evolución] " + msg, nivel)
        return
    print("[%s] %-5s %s" % (datetime.now().strftime("%H:%M:%S"), nivel, msg), flush=True)


# ═══════════════════════════════════════════════════════════════════════════════
# LEER LAS FOTOS
# ═══════════════════════════════════════════════════════════════════════════════

def _base_onedrive():
    """LAS RUTAS NO SE ESCRIBEN A MANO: en la laptop el usuario es 'dames' y en el
    servidor 'Administrator'. Ya pasó una vez que el robot dijera "falta el archivo"
    con los archivos en su lugar, solo porque la ruta estaba fija."""
    candidatas = []
    if os.environ.get("OneDrive"):
        candidatas.append(os.path.join(os.environ["OneDrive"], "danielames.bata"))
    perfil = os.environ.get("USERPROFILE", "")
    if perfil:
        candidatas.append(os.path.join(perfil, "OneDrive", "danielames.bata"))
    candidatas += [r"C:\Users\dames\OneDrive\danielames.bata",
                   r"C:\Users\Administrator\OneDrive\danielames.bata"]
    for c in candidatas:
        if os.path.isdir(c):
            return c
    raise RuntimeError("No se encontró la carpeta de OneDrive. Se probó: %s" % candidatas)


def fechas_disponibles(base):
    """{fecha: (activo, reserva)}. Solo las que tienen LAS DOS: sin la reserva, la
    mitad que sube a reserva se ve igual que una venta y todo sale al doble."""
    carpetas = [
        (os.path.join(base, "scraping Stock", "Stock Activo"),
         os.path.join(base, "scraping Stock", "Stock Reserva")),
        (os.path.join(base, "Stock Activo"), os.path.join(base, "Stock Reserva")),
    ]
    act, res = {}, {}
    for ca, cr in carpetas:
        for carpeta, dest, ext in ((ca, act, ".csv"), (cr, res, ".xlsx")):
            if not os.path.isdir(carpeta):
                continue
            for f in os.listdir(carpeta):
                if not f.lower().endswith(ext):
                    continue
                m = re.search(r"(\d{4})-(\d{2})-(\d{2})", f)
                if m:
                    d = "%s-%s-%s" % m.groups()
                else:
                    m = re.search(r"(\d{2})-(\d{2})-(\d{2})", f)
                    if not m:
                        continue
                    d = "20%s-%s-%s" % (m.group(3), m.group(2), m.group(1))
                # DOS COSAS A LA VEZ, y el orden importa:
                #  · el scraping manda sobre las carpetas viejas —se recorre primero—,
                #    así que una fecha ya puesta no se pisa;
                #  · dentro de la misma carpeta hay DOS archivos por día desde que el
                #    robot corre a las 06:00 y a las 19:00, y el estudio se queda con
                #    EL MÁS TARDE, que es la foto con la que se cerró el día. Si se
                #    quedara con el de la mañana, la curva mediría medio día menos.
                ruta = os.path.join(carpeta, f)
                if d not in dest:
                    dest[d] = ruta
                elif os.path.dirname(dest[d]) == carpeta and f > os.path.basename(dest[d]):
                    dest[d] = ruta
    return {d: (act[d], res[d]) for d in sorted(set(act) & set(res))}


def cod_base(articulo):
    """'0034869-1-03' -> '34869'. Los ceros de la izquierda no son parte del código."""
    return (articulo.split("-")[0].strip().strip('="').lstrip("0")) or "0"


def leer_activo(path):
    """{cod: pares} + catálogo. LAS COLUMNAS SE LEEN POR POSICIÓN, igual que la web:
    1 artículo, 2 descripción, 4 cantidad. Es el mismo contrato de siempre."""
    tot, cat = {}, {}
    with open(path, "r", encoding="utf-8-sig", errors="replace", newline="") as fh:
        r = csv.reader(fh, delimiter=";")
        if next(r, None) is None:
            return tot, cat
        for row in r:
            if len(row) < 5 or not row[1]:
                continue
            c = cod_base(row[1])
            try:
                tot[c] = tot.get(c, 0) + int(float(row[4] or 0))
            except ValueError:
                continue
            cat.setdefault(c, [row[2], row[1]])
    return tot, cat


def leer_reserva(path):
    """({cod: pares}, {cod: merma_dev}, catálogo). El xlsx se abre como zip: esta PC
    no tiene openpyxl. El encabezado está en la fila 3, no en la 1.

    LA RESERVA TAMBIÉN APORTA CATÁLOGO, y no es un detalle: hay artículos que el
    activo no vio nunca porque entraron en cajas cerradas y subieron derecho a
    reserva. Sin esto, un código nuevo que todavía no bajó al piso se descarta por
    no tener descripción — justo el caso que este estudio viene a mirar."""
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    hoja = sorted(n for n in z.namelist() if n.startswith("xl/worksheets/sheet"))[0]
    ok, mal, cat = {}, {}, {}
    for i, row in enumerate(ET.fromstring(z.read(hoja)).iter(NS + "row")):
        if i < 3:
            continue
        cel = {}
        for c in row.iter(NS + "c"):
            ref = re.match(r"([A-Z]+)", c.get("r") or "")
            if not ref:
                continue
            v = c.find(NS + "v")
            val = v.text if v is not None else ""
            if c.get("t") == "s" and val:
                val = shared[int(val)]
            cel[ref.group(1)] = val
        art, cant = cel.get("H", ""), cel.get("K", "")
        if not art or not cant:
            continue
        try:
            q = int(float(cant))
        except ValueError:
            continue
        # MERMA y DEV no son stock vendible: van aparte y no cuentan como "lo que queda"
        nand = (cel.get("C") or "").upper()
        d = mal if ("MERMA" in nand or "DEV" in nand) else ok
        c = cod_base(art)
        d[c] = d.get(c, 0) + q
        # I es el SKU con talla ('5094405-1-04') y J la descripción: lo mismo que da
        # el activo en sus columnas 1 y 2.
        sku, desc = cel.get("I", ""), cel.get("J", "")
        if sku and desc:
            cat.setdefault(c, [desc, sku])
    return ok, mal, cat


def leer_maestro(base):
    """{cod: (marca, coleccionPO, gGender)} del Maestro de Artículos.

    LA COLUMNA ES 'Coleccion PO' (J), NO la que se llama 'Temporada' (O). Son dos cosas
    distintas y la que Daniel mira es la primera.

    La marca sale de acá y no del texto de la descripción: en la descripción vienen
    'BATA-06044' y 'BUBBLEGUMMERS / MARVEL-08006', y adivinarla de ahí es frágil. Si el
    artículo no está en el Maestro, se cae al texto, que para eso está.

    Se lee con zipfile y no con openpyxl a propósito: así el estudio corre igual en una
    PC que no tenga la librería instalada."""
    ruta = os.path.join(base, "scraping Stock", "Archivos", "Maestro_Articulos.xlsx")
    if not os.path.exists(ruta):
        log("No está el Maestro (%s): la marca sale de la descripción y no habrá "
            "Colección PO" % ruta, "WARN")
        return {}
    try:
        z = zipfile.ZipFile(ruta)
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
                shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
        hoja = sorted(n for n in z.namelist() if n.startswith("xl/worksheets/sheet"))[0]
        mapa = {}
        for i, row in enumerate(ET.fromstring(z.read(hoja)).iter(NS + "row")):
            if i == 0:
                continue
            cel = {}
            for c in row.iter(NS + "c"):
                ref = re.match(r"([A-Z]+)", c.get("r") or "")
                if not ref:
                    continue
                v = c.find(NS + "v")
                val = v.text if v is not None else ""
                if c.get("t") == "s" and val:
                    val = shared[int(val)]
                cel[ref.group(1)] = val
            cod = (cel.get("B") or "").strip()
            if not cod:
                continue
            # N 'Marcas' es el nombre que usa el negocio; I 'MarcaStd' es el interno.
            # C 'G. Gender' dice si es Footwear: es lo único que separa de verdad el
            # calzado de las bolsas y la papelería.
            mapa[cod.lstrip("0") or "0"] = ((cel.get("N") or cel.get("I") or "").strip(),
                                            (cel.get("J") or "").strip(),
                                            (cel.get("C") or "").strip())
        log("Maestro: %s artículos" % format(len(mapa), ",d"))
        return mapa
    except Exception as e:
        log("No se pudo leer el Maestro (%s): se sigue sin él" % str(e)[:150], "WARN")
        return {}


def cargar_acumulado():
    vacio = {"v": FORMATO_ACUMULADO, "fechas": [], "cat": {}, "datos": {}}
    if not os.path.exists(ACUMULADO):
        return vacio
    try:
        with gzip.open(ACUMULADO, "rt", encoding="utf-8") as fh:
            A = json.load(fh)
    except Exception as e:
        log("El acumulado está ilegible (%s), se rehace entero" % str(e)[:120], "WARN")
        return vacio
    # Si cambió la forma de leer las fotos, lo guardado ya no sirve y hay que releer.
    if A.get("v") != FORMATO_ACUMULADO:
        log("El acumulado es de un formato anterior (v%s), se rehace entero" % A.get("v"), "WARN")
        return vacio
    return A


def actualizar_acumulado(base):
    """Agrega al acumulado las fotos que todavía no estaban. La primera vez son todas."""
    A = cargar_acumulado()
    ya = set(A["fechas"])
    disp = fechas_disponibles(base)
    # LA FOTO DE HOY SE RELEE SIEMPRE. Desde que el robot corre dos veces —06:00 y
    # 19:00— la corrida de la noche encuentra la fecha de hoy ya guardada, y saltearla
    # dejaría el estudio con el stock de la mañana: dos corridas y la segunda no serviría
    # de nada. Las fechas anteriores no se releen: ésas ya no cambian.
    hoy = max(disp) if disp else None
    faltan = [d for d in sorted(disp) if d not in ya or d == hoy]
    if not faltan:
        log("El acumulado ya tiene las %d fotos, no hay nada nuevo" % len(ya))
        return A, 0
    log("Fotos nuevas para leer: %d%s" % (len(faltan), " (se arma de cero)" if not ya else ""))
    t0 = time.time()
    leidas = 0
    for d in faltan:
        pa, pr = disp[d]
        try:
            act, cat = leer_activo(pa)
            res, mal, cat_res = leer_reserva(pr)
        except Exception as e:
            log("No se pudo leer la foto del %s: %s" % (d, str(e)[:150]), "WARN")
            continue
        for origen in (cat, cat_res):
            for c, v in origen.items():
                A["cat"].setdefault(c, v)
        for c in set(act) | set(res) | set(mal):
            A["datos"].setdefault(c, {})[d] = [act.get(c, 0), res.get(c, 0), mal.get(c, 0)]
        A["fechas"].append(d)
        leidas += 1
    A["fechas"] = sorted(set(A["fechas"]))
    A["v"] = FORMATO_ACUMULADO
    with gzip.open(ACUMULADO, "wt", encoding="utf-8") as fh:
        json.dump(A, fh)
    log("Acumulado al día: %d fotos, del %s al %s (%d nuevas en %.0fs, %.1f MB)"
        % (len(A["fechas"]), A["fechas"][0], A["fechas"][-1], leidas, time.time() - t0,
           os.path.getsize(ACUMULADO) / 1e6))
    return A, leidas


# ═══════════════════════════════════════════════════════════════════════════════
# EL ESTUDIO
# ═══════════════════════════════════════════════════════════════════════════════

def _d(s):
    a, m, dd = s.split("-")
    return date(int(a), int(m), int(dd))


def marca_de(desc):
    """La marca que aparezca en la descripción, la más larga primero.

    NO SE PUEDE CORTAR POR EL FINAL. Lo esperable es
    '...- BLACK/NEGRO - NORTH STAR-1-38', pero también vienen
    '...- BATA-06044' y '...- BUBBLEGUMMERS / MARVEL-08006', y ahí cortar por
    '-1-' deja pegado un código de proveedor y la marca no cruza con nada.
    Se busca la más larga primero para que 'BATA COMFIT' gane sobre 'BATA' y
    'BUBBLEGUMMERS LICENSES' sobre 'BUBBLEGUMMERS'."""
    d = " " + re.sub(r"\s+", " ", re.sub(r"[-,/]", " ", desc.upper())) + " "
    for m in _MARCAS_ORDENADAS:
        if m in d:
            return m.strip()
    return "?"


_MARCAS_ORDENADAS = sorted(
    (" %s " % m for m in (MARCAS_PROPIAS | MARCAS_TERCEROS)),
    key=len, reverse=True)


def modelo_de(desc):
    p = desc.split("-1-")[0].split(" - ")
    return " · ".join(x.strip().title() for x in p[:2]) if len(p) > 1 else desc[:40]


def color_de(desc):
    p = desc.split("-1-")[0].split(" - ")
    return p[2].split("/")[0].strip().title() if len(p) > 3 else ""


def mediana(v):
    v = sorted(v)
    n = len(v)
    if not n:
        return None
    return float(v[n // 2]) if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2.0


def pctil(v, p):
    v = sorted(v)
    if not v:
        return None
    return float(v[min(len(v) - 1, int(round((len(v) - 1) * p / 100.0)))])


def r1(v):
    return None if v is None else round(v, 1)


class Estudio(object):
    def __init__(self, A, maestro=None):
        self.fechas = A["fechas"]
        self.cat = A["cat"]
        self.datos = A["datos"]
        self.maestro = maestro or {}
        self.dfechas = [_d(f) for f in self.fechas]
        self.hasta = self.fechas[-1]
        self.desconocidas = set()
        self.sin_maestro = 0

    def movimiento(self, cod):
        """(último día que el stock cambió, días parado, días en el almacén desde que llegó).

        'Parado' se cuenta desde el último cambio, no desde la última foto: un artículo
        que hace tres semanas que tiene los mismos pares está parado hace tres semanas
        aunque la foto sea de anoche."""
        serie = self.datos[cod]
        ds = sorted(serie)
        ult = ds[0]
        for i in range(1, len(ds)):
            if self.total(cod, ds[i]) != self.total(cod, ds[i - 1]):
                ult = ds[i]
        fin = _d(self.hasta)
        return ult, (fin - _d(ult)).days, (fin - _d(ds[0])).days

    def total(self, cod, f):
        v = self.datos[cod].get(f)
        return (v[0] + v[1]) if v else 0     # activo + reserva; merma y dev no cuentan

    def foto_cercana(self, objetivo):
        """El robot no corre los domingos ni los feriados: la foto de la semana N
        puede caer uno o dos días corrida."""
        mejor, dist = None, 999
        for i, fd in enumerate(self.dfechas):
            k = abs((fd - objetivo).days)
            if k < dist:
                mejor, dist = self.fechas[i], k
        return mejor if dist <= TOLERANCIA_DIAS else None

    def es_calzado(self, cod):
        """MANDA EL MAESTRO, que es el único que lo sabe de verdad.

        El criterio de la talla no alcanza: la 'BOLSA E-COMMERCE CHICA 31 CM x 46 CM'
        trae sufijo y lo pasa, y entró al reporte con 40.000 unidades contadas como
        pares — el 23% de todo lo que el Pareto decía que faltaba picar. En el Maestro
        es 'Packaging', no 'Footwear', y ahí se ve de una.

        Para lo que no está en el Maestro se cae al sufijo, que deja fuera los
        materiales terminados en '-1-00'."""
        m = self.maestro.get(cod)
        if m and len(m) > 2 and m[2]:
            return m[2].strip().upper() == "FOOTWEAR"
        v = self.cat.get(cod)
        if not v:
            return False
        p = v[1].split("-")
        return len(p) >= 3 and p[-1] not in ("00", "")

    def conocida(self, m, desc):
        """Una marca que no está en ninguna de las dos listas queda AFUERA del estudio,
        no cae en terceros. Así no se cuelan las bolsas de empaque ni la papelería, que
        no son pares y arruinarían las medianas. El log las lista para decidir de qué
        lado va cada una."""
        if m in MARCAS_PROPIAS or m in MARCAS_TERCEROS:
            return True
        self.desconocidas.add("%s  (ej: %s)" % (m, desc[:52]))
        return False

    def armar(self):
        corte = _d(self.hasta) - timedelta(days=VENTANA_DIAS)
        primera = self.fechas[0]
        art = []
        for cod, serie in self.datos.items():
            llegada = min(serie)
            # Los que ya estaban en la primera foto no "llegaron": no se sabe con cuánto
            if llegada == primera or _d(llegada) < corte:
                continue
            pares = self.total(cod, llegada)
            if pares < MINIMO_PARES or not self.es_calzado(cod):
                continue
            desc = self.cat[cod][0]
            # La marca la manda el Maestro; la descripción es el respaldo
            mm = self.maestro.get(cod)
            if mm and mm[0]:
                m = mm[0].upper()
            else:
                m = marca_de(desc)
                self.sin_maestro += 1
            if not self.conocida(m, desc):
                continue
            c = []
            k = 0
            while True:
                f = self.foto_cercana(_d(llegada) + timedelta(days=7 * k))
                if f is None:
                    break
                c.append([k, self.total(cod, f), None, f])
                k += 1
            semanas = c[-1][0]

            # LA CURVA TIENE QUE LLEGAR HASTA LA ÚLTIMA FOTO. Cortada en la última semana
            # cumplida se quedaba hasta seis días atrás, y ahí el cuadro dejaba de cerrar:
            # "lo picado + lo que queda" no daba lo que entró porque lo de esos días no
            # estaba en ninguna parte. Pasaba en 73 de 323 artículos, con diferencias de
            # hasta 1.459 pares. El punto extra lleva su semana con decimal.
            if c[-1][3] != self.hasta:
                dias = (_d(self.hasta) - _d(llegada)).days
                c.append([round(dias / 7.0, 1), self.total(cod, self.hasta), None, self.hasta])
            hoy = self.total(cod, self.hasta)
            ult, parado, dias = self.movimiento(cod)
            # SI RECIBIÓ UNA SEGUNDA TANDA, EL % VA SOBRE TODO LO QUE ENTRÓ. Medido
            # contra la primera llegada salían cosas como "270% de lo que llegó", que se
            # lee como un error del reporte. Lo que entró en total no se puede saber al
            # par —haría falta el movimiento de ingresos— pero el máximo que llegó a
            # tener es la mejor cota que dan las fotos, y nunca da más de 100%.
            # CUÁNTO ENTRÓ EN TOTAL = la primera llegada MÁS cada subida posterior.
            #
            # No alcanza con el máximo que llegó a tener: un artículo que llegó con 1.436,
            # bajó a 641 picando y después recibió 3.249 más recibió 4.685 en total, no
            # 3.890. Con el máximo, "lo picado + lo que queda" no daba lo que entró y el
            # cuadro no cerraba — que es lo primero que se nota al sumarlo a mano.
            #
            # Se mira foto a foto y no semana a semana: una tanda que entra un miércoles
            # cae entre dos semanas y no se vería.
            #
            # UNA TANDA ES UN SALTO, no la suma de los ruiditos. El stock oscila unos
            # pares por los recuentos, y sumando eso a lo largo de 76 fotos había
            # artículos que pasaban los 50 pares de a poquito y quedaban marcados como
            # "recibió una segunda tanda", que los deja fuera del estudio. Para `entro`
            # se suma todo —si no, el cuadro no cierra—; para la marca, solo los saltos.
            # Se mide sobre LA MISMA serie que se dibuja. Mirando todas las fotos daba un
            # número más fino, pero el cuadro que Daniel suma a mano sale de la curva: si
            # las dos cuentas no son la misma, la resta no cierra y el reporte se cae.
            entro, rep = c[0][1], False
            for i in range(1, len(c)):
                sube = c[i][1] - c[i - 1][1]
                if sube > 0:
                    entro += sube
                    if sube > 50:
                        rep = True
            # El % de la curva se mide contra TODO lo que entró. Para el que llegó una
            # sola vez es lo mismo de siempre; para el que recibió otra tanda es lo único
            # que hace que "lo picado + lo que queda" dé lo que entró.
            for p in c:
                p[2] = round(p[1] / entro * 100.0, 1)
            art.append({
                "cod": cod, "marca": m.title(), "propia": m in MARCAS_PROPIAS,
                "modelo": modelo_de(desc), "color": color_de(desc),
                "coleccion": (mm[1] if mm and mm[1] else ""),
                "ultMov": ult, "parado": parado, "dias": dias,
                "llegada": llegada, "pares": pares, "curva": c,
                "entro": entro, "rep": rep,
                # 'sem' son las semanas CUMPLIDAS: es lo que decide si entra al grupo fijo,
                # y el punto extra hasta la última foto no es una semana más.
                "sem": semanas, "hoy": hoy, "pct": round(hoy / entro * 100.0, 1),
                "cero": next((s for s, q, p, f in c if s > 0 and q == 0), None),
                "hitos": {str(u): self.cruce(c, u) for u in HITOS},
            })
        art.sort(key=lambda a: -a["hoy"])
        if self.sin_maestro:
            log("Artículos que no están en el Maestro: %d · la marca salió de la "
                "descripción y quedaron sin Colección PO" % self.sin_maestro, "WARN")
        if self.desconocidas:
            log("Marcas sin clasificar, quedaron FUERA del estudio (%d):"
                % len(self.desconocidas), "WARN")
            for x in sorted(self.desconocidas):
                log("    %s" % x, "WARN")
        return art

    @staticmethod
    def cruce(c, umbral):
        """En cuántas semanas bajó de ese %, interpolando entre las dos fotos."""
        for i in range(1, len(c)):
            if c[i][2] <= umbral < c[i - 1][2]:
                a, b = c[i - 1][2], c[i][2]
                return round(c[i - 1][0] + ((a - umbral) / (a - b) if a != b else 0), 2)
        return None


def resumen(art, etiqueta):
    """El paquete de números de un conjunto de artículos."""
    if not art:
        return None
    fijo = [a for a in art if a["sem"] >= SEMANAS_FIJAS]
    curva, prev, acum = [], 100.0, 0.0
    for k in range(0, SEMANAS_FIJAS + 1):
        v = [a["curva"][k][2] for a in fijo]
        if not v:
            break
        m = mediana(v)
        acum += (prev - m) if k else 0
        curva.append({"s": k, "queda": r1(m), "salio": r1(prev - m) if k else None,
                      "acum": r1(acum) if k else None,
                      "p25": r1(pctil(v, 25)), "p75": r1(pctil(v, 75))})
        prev = m
    # LOS HITOS TAMBIÉN VAN SOBRE EL GRUPO FIJO. Contando "cruzaron 42 de 264" se
    # mezclan los que tuvieron nueve semanas para cruzar con los que llegaron hace
    # dos: el porcentaje sale bajísimo y no dice nada del almacén, dice que la
    # ventana es de tres meses. Con el grupo fijo, todos tuvieron el mismo plazo.
    hitos = {}
    for u in HITOS:
        v = [a["hitos"][str(u)] for a in fijo if a["hitos"][str(u)] is not None]
        hitos[str(u)] = {"sem": r1(mediana(v)), "cruzaron": len(v), "de": len(fijo),
                         "pct": r1(len(v) * 100.0 / max(1, len(fijo))),
                         "rapido": r1(pctil(v, 25)), "lento": r1(pctil(v, 75))} if v else None
    ceros = [a for a in fijo if a["cero"] is not None]
    # EL SEMÁFORO SE MIDE SOLO SOBRE LOS QUE YA TIENEN RECORRIDO. Con la ventana de
    # tres meses entran códigos que llegaron hace dos semanas: uno de esos con el 40%
    # no está plantado, está en su curva normal. Mezclarlos hacía que "se plantaron"
    # pasara de 21% a 54% sin que hubiera cambiado nada en el almacén.
    tramos = [("agotado", lambda a: a["hoy"] == 0),
              ("casi", lambda a: 0 < a["pct"] < 5),
              ("saliendo", lambda a: 5 <= a["pct"] < 20),
              ("plantado", lambda a: a["pct"] >= 20)]
    return {
        "etiqueta": etiqueta,
        "articulos": len(art), "pares": sum(a["pares"] for a in art),
        "hoy": sum(a["hoy"] for a in art),
        "pct": r1(sum(a["hoy"] for a in art) * 100.0 / max(1, sum(a["pares"] for a in art))),
        "tipica": int(mediana([a["pares"] for a in art])),
        "curva": curva, "grupoFijo": len(fijo), "semanasFijas": SEMANAS_FIJAS,
        "dosSemanas": r1(100 - curva[2]["queda"]) if len(curva) > 2 else None,
        "hitos": hitos,
        "cero": {"n": len(ceros), "de": len(fijo),
                 "pct": r1(len(ceros) * 100.0 / max(1, len(fijo))),
                 "sem": r1(mediana([a["cero"] for a in ceros])) if ceros else None},
        "estadosDe": len(fijo),
        "estados": [{"k": k, "n": len(s), "pct": r1(len(s) * 100.0 / max(1, len(fijo))),
                     "pares": sum(a["hoy"] for a in s),
                     "cuerpos": r1(sum(a["hoy"] for a in s) / 350.0)}
                    for k, f in tramos for s in [[a for a in fijo if f(a)]]],
        # Los recién llegados no entran al semáforo, pero hay que decir cuántos son:
        # si no, el reporte parece hablar de todo el grupo y habla de una parte.
        "enCurva": len(art) - len(fijo),
    }


def pareto(art):
    """ABC sobre los pares que faltan picar. Las partes tienen que sumar el total."""
    A = [a for a in art if a["hoy"] > 0]
    if not A:
        return None
    TQ = sum(a["hoy"] for a in A)
    # Lo que entró, no lo que llegó la primera vez: si no, el total no cierra contra los
    # pares que hay hoy y el cuadro se lee como si sobrara mercadería de la nada.
    TL = sum(a["entro"] for a in art)
    ac, clase = 0, []
    for a in A:
        ac += a["hoy"]
        clase.append(0 if ac * 100.0 / TQ <= 80 else (1 if ac * 100.0 / TQ <= 95 else 2))
    cls = []
    for i, k in enumerate("ABC"):
        s = [A[j] for j in range(len(A)) if clase[j] == i]
        p = sum(a["hoy"] for a in s)
        cls.append({"k": k, "art": len(s), "pctArt": r1(len(s) * 100.0 / len(art)),
                    "pares": p, "pct": r1(p * 100.0 / TQ), "cuerpos": r1(p / 350.0)})
    n20 = max(1, int(round(len(art) * 0.20)))
    need = next((j for j in range(len(A))
                 if sum(a["hoy"] for a in A[:j + 1]) * 100.0 / TQ >= 80), len(A) - 1) + 1
    return {"falta": TQ, "llego": TL, "pct": r1(TQ * 100.0 / TL), "cuerpos": r1(TQ / 350.0),
            "conStock": len(A), "clases": cls,
            "pct20": r1(sum(a["hoy"] for a in A[:n20]) * 100.0 / TQ), "art20": n20,
            "para80": need, "pctPara80": r1(need * 100.0 / len(art)),
            "clase": [clase[j] for j in range(len(A))],
            "orden": [a["cod"] for a in A]}


def construir(A, maestro=None):
    e = Estudio(A, maestro)
    art = e.armar()
    if not art:
        raise RuntimeError("La ventana de %d días no dejó ningún artículo" % VENTANA_DIAS)
    limpios = [a for a in art if not a["rep"]]
    propia = [a for a in limpios if a["propia"]]
    terceros = [a for a in limpios if not a["propia"]]
    log("Grupo: %d artículos (%d con reposición) · propia %d · terceros %d"
        % (len(art), len(art) - len(limpios), len(propia), len(terceros)))

    # EL RESUMEN NO VIAJA: lo calcula la pantalla desde la lista de artículos. Tiene que
    # hacerlo igual para poder filtrar por marca o por tamaño de llegada sin volver a
    # pedir nada, y mandar además el resumen de acá dejaría la misma cuenta escrita dos
    # veces —en Python y en JavaScript— con dos resultados el día que alguien toque una.
    # Acá se calcula solo para dejarlo en el registro de la corrida.
    for nom, conj in (("marca propia", propia), ("terceros", terceros)):
        r = resumen(conj, nom)
        if not r:
            continue
        log("  %s: %d artículos · %d con %d semanas · dos primeras semanas %s%%"
            % (nom, r["articulos"], r["grupoFijo"], SEMANAS_FIJAS, r["dosSemanas"]))
        log("     agotados (cero pares): %d de %d (%s%%)"
            % (r["cero"]["n"], r["cero"]["de"], r["cero"]["pct"]))
        for u in HITOS:
            h = r["hitos"][str(u)]
            if h:
                log("     baja al %d%%: %s semanas · lo cruzaron %d de %d"
                    % (u, h["sem"], h["cruzaron"], h["de"]))

    return {
        "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "hasta": e.hasta, "desde": A["fechas"][0], "fotos": len(A["fechas"]),
        "ventanaDias": VENTANA_DIAS, "minimoPares": MINIMO_PARES, "hitos": HITOS,
        "semanasFijas": SEMANAS_FIJAS,
        "total": {"articulos": len(art), "conReposicion": len(art) - len(limpios),
                  "pares": sum(a["entro"] for a in art)},
        # El Pareto tampoco viaja calculado: lo rehace la pantalla desde los artículos,
        # igual que el resumen. Mandarlo hecho dejaría dos versiones del mismo cuadro.
        "articulos": art,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SUBIR
# ═══════════════════════════════════════════════════════════════════════════════

def subir(paquete, intentos=3):
    if not WEB_SUBIR:
        log("Publicación desactivada (WEB_SUBIR = False), se omite")
        return True
    cuerpo = json.dumps(paquete, ensure_ascii=False).encode("utf-8")
    url = "%s/%s?date=MASTER" % (WEB_DATOS_API, AREA)
    for intento in range(1, intentos + 1):
        try:
            pedido = urllib.request.Request(url, data=cuerpo, method="POST")
            pedido.add_header("Content-Type", "application/json")
            if WEB_ENTORNO == "beta":
                pedido.add_header("X-Environment", "beta")
            # El servidor puede estar dormido y tardar casi un minuto en despertar
            with urllib.request.urlopen(pedido, timeout=300) as resp:
                r = json.loads(resp.read().decode("utf-8"))
            if r.get("status") in (None, "success"):
                log("%s publicado en %s: %.2f MB" % (AREA, WEB_ENTORNO, len(cuerpo) / 1048576.0))
                return True
            raise RuntimeError(r.get("message", "respuesta inesperada del servidor"))
        except Exception as ex:
            det = "%s: %s" % (type(ex).__name__, str(ex)[:200])
            if intento < intentos:
                log("Intento %d: no se pudo publicar (%s), se reintenta..." % (intento, det), "WARN")
                time.sleep(20)
            else:
                log("No se pudo publicar %s: %s" % (AREA, det), "ERROR")
    return False


def main(solo_calcular=None, log_externo=None):
    """`solo_calcular` deja el resultado en disco sin publicarlo. Cuando lo llama el
    robot se le pasa explícito: leer sys.argv desde adentro tomaría los argumentos
    del robot, que son otros."""
    global _LOG_EXTERNO
    if log_externo:
        _LOG_EXTERNO = log_externo
    if solo_calcular is None:
        solo_calcular = "--solo-calcular" in sys.argv
    try:
        base = _base_onedrive()
    except RuntimeError as e:
        log(str(e), "ERROR")
        return 1
    log("OneDrive: %s" % base)

    A, nuevas = actualizar_acumulado(base)
    if not A["fechas"]:
        log("No hay ninguna foto para leer", "ERROR")
        return 2

    paquete = construir(A, leer_maestro(base))
    salida = os.path.join(AQUI, "evolucion_articulo.json")
    with open(salida, "w", encoding="utf-8") as fh:
        json.dump(paquete, fh, ensure_ascii=False)
    log("Resultado en %s (%.2f MB)" % (salida, os.path.getsize(salida) / 1048576.0))

    if solo_calcular:
        log("--solo-calcular: no se publica")
        return 0
    return 0 if subir(paquete) else 3


if __name__ == "__main__":
    sys.exit(main())
