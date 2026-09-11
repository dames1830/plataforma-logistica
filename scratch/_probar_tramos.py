# -*- coding: utf-8 -*-
"""PRUEBAS SIN WMS de la bajada por tramos de robot/picking_y_orden.py.

    python scratch/_probar_tramos.py
    python scratch/_probar_tramos.py "<carpeta>\\Detalle Orden Despachados.csv"

Simula el WMS: la grilla filtra por la fecha de creación de la CABECERA —con
fracciones de segundo—, muestra 125 filas por página y la exportación sale ordenada
por artículo y cortada en el tope. Con el tope achicado a 2.000 filas las pruebas
corren en segundos y pasan por el mismo código que la corrida de verdad.

Con la ruta de un archivo real, además, lo parte en tramos que se pisan y comprueba
que al juntarlos vuelvan exactamente las mismas filas.
"""
import collections
import io
import math
import os
import random
import shutil
import sys
import tempfile
import types
from datetime import datetime, timedelta

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, "..", "robot")))

REGISTRO = []

# El módulo de verdad arrastra Playwright; los tramos solo usan estas dos cosas.
falso = types.ModuleType("wms_automation_final")
falso.captura = lambda page, nombre: None


def _con_reintentos(nombre, funcion, page, intentos=None):
    for intento in range(1, (intentos or 3) + 1):
        try:
            if funcion():
                return True
            REGISTRO.append("[REINTENTO] el intento %d no completo" % intento)
        except Exception as e:
            REGISTRO.append("[REINTENTO] intento %d: %s: %s" % (intento, type(e).__name__, e))
    return False


falso.con_reintentos = _con_reintentos
sys.modules["wms_automation_final"] = falso

import picking_y_orden as po  # noqa: E402

po.log = lambda mensaje, nivel="INFO": REGISTRO.append("[%s] %s" % (nivel, mensaje))
TMP = tempfile.mkdtemp(prefix="probar_tramos_")
po.LOGS = TMP
BUSCAR_DE_VERDAD = po._buscar_detalle_orden

FALLAS = []


def comprobar(condicion, que):
    print(("   ok     " if condicion else "   FALLA  ") + que)
    if not condicion:
        FALLAS.append(que)
        for r in REGISTRO[-15:]:
            print("            | " + r)


def en_registro(pedazo):
    return any(pedazo in r for r in REGISTRO)


CABECERA = [
    "Instalación", "Número de orden", "Número de orden de compra de cliente",
    "OBLIGATORIO: Cadena", "Estado de orden", "Código de artículo", "Cantidad solicitada",
    "Unidades secundarias de cantidad solicitada", "Cantidad de orden original",
    "Cantidad asignada", "Unidades secundarias de cantidad asignada", "Cantidad empaquetada",
    "Unidades secundarias de cantidad empaquetada", "Instalación de destino",
    "Registro de hora de creación de cabecera de orden", "Fecha de envío requerida",
    "Descripción de artículo", "Registro de hora de modificación de cabecera de orden",
    "Fecha de orden", "Tipo de orden", "Campo personalizado 2", "Número de ciclo",
    "Número de carga", "Contenido", "**MOTIVA", "Número de OC", "Usuario de modificación",
    "Campo personalizado 1 ", "Detalle de orden - Campo personalizado 1",
    "OBLIGATORIO:Orden Compra Prove."]


def _campo(texto):
    if any(c in texto for c in ';"\r\n'):
        return '"%s"' % texto.replace('"', '""')
    return texto


def renglon(f):
    """Una fila como la escribe el WMS: ; de separador y ="..." en algunos números."""
    c = f["creada"].strftime("%d/%m/%Y %H:%M:%S")
    q = str(f["cant"])
    orden = f["orden"] if f["orden"].startswith("M") else '="%s"' % f["orden"]
    campos = ['="50008"', orden, '="%s"' % f["orden"], "", f["estado"], f["articulo"],
              q, q, q, q, q, q, q, '="50524"', c, c[:10], _campo(f["desc"]), c, c[:10],
              "Aldeas Bata", "", "WV5000800045965", "OS5000800029779", "", "", "",
              "usuario", "", "BAA", ""]
    return ";".join(campos) + "\r\n"


def datos(inicio, filas_por_dia, semilla=7):
    """Órdenes de mentira: algunas creadas a las 23:00, 23:30 y 23:59:59,6 —el
    empalme—, otras a las 0:00:00; descripciones con punto y coma, con comillas y con
    saltos de línea; y líneas repetidas dentro de una misma orden, que son reales."""
    rnd = random.Random(semilla)
    filas = []
    numero = 7990000
    ultimo = len(filas_por_dia) - 1
    for i, objetivo in enumerate(filas_por_dia):
        dia = inicio + timedelta(days=i)
        hechas = 0
        while hechas < objetivo:
            numero += 1
            r = rnd.random()
            if r < 0.03:
                hora = dia.replace(hour=23, minute=30)
            elif r < 0.06 and i < ultimo:
                hora = dia.replace(hour=23, minute=59, second=59, microsecond=600000)
            elif r < 0.08:
                hora = dia.replace(hour=23)
            elif r < 0.10:
                hora = dia
            else:
                hora = dia + timedelta(seconds=rnd.randrange(86400))
            orden = ("M%d" if rnd.random() < 0.1 else "%d") % numero
            for _ in range(rnd.randint(1, 9)):
                k = rnd.random()
                desc = ("CON ; PUNTO Y COMA" if k < 0.01 else
                        "CON\nSALTO DE LINEA" if k < 0.02 else
                        'CON "COMILLAS"' if k < 0.03 else "MEN - LEGEND 76 - BLUE")
                f = {"orden": orden, "creada": hora, "cant": rnd.randint(1, 6),
                     "articulo": "%07d-1-%02d" % (rnd.randrange(10 ** 7), rnd.randint(1, 45)),
                     "estado": rnd.choice(("Enviado", "Cargado")), "desc": desc}
                filas.append(f)
                hechas += 1
                if rnd.random() < 0.04:
                    filas.append(dict(f))
                    hechas += 1
    return filas


# ── el WMS de mentira ──────────────────────────────────────────────────────────

class Grilla(object):
    def __init__(self, filas):
        self.filas = filas
        self.grilla = None
        self.paginas = 0
        self.busquedas = 0
        self.llamadas = 0
        self.exportaciones = 0
        self.sin_estado = False
        self.siguiente_vieja = False
        self.vieja_despues_de = 0     # tras esa exportación, la búsqueda siguiente no corre
        self.caer_en = ()             # llamadas a exportar que se caen a la mitad
        self.deriva = 0               # filas de más en cada exportación


def buscar_falso(page, que, de, a, estados, con_fotos=False):
    if page.sin_estado:
        return None
    page.busquedas += 1
    if page.siguiente_vieja:
        page.siguiente_vieja = False
        return page.paginas
    d0 = datetime.strptime("%s %s" % de, "%d/%m/%Y %H:%M:%S")
    d1 = datetime.strptime("%s %s" % a, "%d/%m/%Y %H:%M:%S")
    # EL FILTRO DE VERDAD: la cabecera, con fracciones de segundo. Una orden de las
    # 23:59:59,6 no entra en un "hasta 23:59:59".
    page.grilla = [f for f in page.filas if d0 <= f["creada"] <= d1]
    page.paginas = max(1, int(math.ceil(len(page.grilla) / float(po.FILAS_POR_PAGINA))))
    return page.paginas


def bajar_falso(page, paso, minutos_armado):
    page.llamadas += 1
    if page.llamadas in page.caer_en:
        raise TimeoutError("se corto la sesion a mitad de la exportacion")
    if not page.grilla:
        raise RuntimeError("No aparece el boton 'Exportar a CSV'")
    filas = sorted(page.grilla + page.grilla[:page.deriva], key=lambda f: f["articulo"])
    filas = filas[:po.TOPE_EXPORTACION_WMS]
    with io.open(paso, "w", encoding="utf-8-sig", newline="") as fh:
        fh.write(";".join(CABECERA) + "\r\n")
        for f in filas:
            fh.write(renglon(f))
    page.exportaciones += 1
    if page.exportaciones == page.vieja_despues_de:
        page.siguiente_vieja = True
    return True


def correr(filas, inicio, dias, **ajustes):
    """Una corrida completa de los despachados contra la grilla de mentira, con los
    mismos reintentos que la de verdad."""
    po._TRAMOS_LISTOS.clear()
    po._CARPETAS_LIMPIAS.clear()
    del REGISTRO[:]
    page = Grilla(filas)
    for k, v in ajustes.items():
        setattr(page, k, v)
    salida = os.path.join(TMP, "salida")
    shutil.rmtree(salida, ignore_errors=True)
    os.makedirs(salida)
    destino = os.path.join(salida, "Detalle Orden Despachados.csv")
    with io.open(destino, "w", encoding="utf-8") as fh:
        fh.write(u"EL ARCHIVO DE AYER\n")
    hasta = inicio + timedelta(days=dias - 1, hours=19)
    ok = falso.con_reintentos("Despachados", lambda: po.descargar_por_tramos(
        page, destino, "Despachados", inicio, hasta,
        (po.ESTADO_DESP_DESDE, po.ESTADO_DESP_HASTA), 1), page)
    return ok, page, destino


def es_el_de_ayer(destino):
    with io.open(destino, encoding="utf-8") as fh:
        return fh.read() == u"EL ARCHIVO DE AYER\n"


def igual_a_la_grilla(destino, filas):
    registros = po._registros(destino)
    cabecera, _ = next(registros)
    textos, articulos = [], []
    for campos, texto in registros:
        textos.append(texto)
        articulos.append(po._limpio(campos[5]))
    return (cabecera == CABECERA
            and collections.Counter(textos) == collections.Counter(renglon(f) for f in filas)
            and articulos == sorted(articulos))


def sin_restos():
    vacia = lambda c: not os.path.isdir(c) or not os.listdir(c)
    return (vacia(os.path.join(TMP, "descargas_en_paso"))
            and vacia(os.path.join(TMP, "tramos_despachados")))


def contar(pedazo):
    return sum(1 for r in REGISTRO if pedazo in r)


# ══════════════════════════════════════════════════════════════════════════════

print("\n1. Páginas contra filas, con las 55 descargas reales del 06 al 10-sep-2026")
REALES = [(45, 5621), (5, 567), (828, 103477), (1378, 172220), (221, 27621), (3, 357),
          (808, 100878), (1374, 171677), (1, 48), (219, 27486), (286, 35793), (929, 116117),
          (1400, 174935), (352, 43963), (93, 11602), (147, 18343), (932, 116409),
          (1397, 174606), (1, 94), (346, 43177), (6, 693), (6, 652), (48, 5952), (3, 373),
          (3, 301), (5, 504), (57, 7093), (4, 383), (57, 7093), (4, 383), (215, 26876),
          (293, 36583), (686, 85660), (1733, 200000), (113, 14035), (134, 16724),
          (395, 49365), (691, 86298), (1620, 200000), (1, 45), (387, 48266), (201, 25089),
          (274, 34189), (788, 98450), (1681, 200000), (364, 45396), (111, 13818),
          (146, 18155), (799, 99765), (1585, 198031), (362, 45146), (218, 27165),
          (303, 38299), (770, 96199), (1673, 200000)]
cuenta = collections.Counter(po.cuadra_con_paginas(f, p) for p, f in REALES)
comprobar(len(REALES) == 55, "son 55")
comprobar(cuenta == {"exacto": 47, "cerca": 3, "no": 5},
          "47 exactas, 3 cerca y 5 que no cuadran: %s" % dict(cuenta))
no_cuadran = sorted((p, f) for p, f in REALES if po.cuadra_con_paginas(f, p) == "no")
comprobar(no_cuadran == [(303, 38299), (1620, 200000), (1673, 200000), (1681, 200000),
                         (1733, 200000)],
          "las que no cuadran son las 4 de 200.000 filas y un OBLPN del día (+424 filas)")
comprobar(all(po.motivo_de_rechazo(f, 2000, None) == "truncado"
              for p, f in no_cuadran if f == 200000),
          "y el tope rechaza las de 200.000 aunque no se sepan las páginas")
comprobar(all(po.cuadra_con_paginas(f, p) == "exacto" for p, f in REALES
              if f != 200000 and p in (828, 1378, 808, 1374, 929, 1400, 932, 1397, 686,
                                       691, 788, 799, 1585, 770)),
          "todas las de Pendientes y Despachados que no estaban cortadas cayeron exactas")
comprobar(po.motivo_de_rechazo(198031, 2000, 1585) is None,
          "198.031 filas en 1.585 páginas (la de la madrugada del 10) pasa")
comprobar(po.motivo_de_rechazo(199999, 2000, None) is None
          and po.motivo_de_rechazo(200001, 2000, None) is None,
          "el tope es EXACTO: 199.999 y 200.001 no son un corte")
comprobar(po.motivo_de_rechazo(39, 40) == "corto", "el piso sigue funcionando")

print("\n2. contar_filas cuenta registros, no renglones")
ruta = os.path.join(TMP, "multilinea.csv")
with io.open(ruta, "w", encoding="utf-8-sig", newline="") as fh:
    fh.write('a;b\r\n1;"dos\r\nrenglones"\r\n2;x\r\n3;"con ; adentro"\r\n')
comprobar(po.contar_filas(ruta) == 3, "3 filas aunque sean 5 renglones")

# desde acá, el WMS de mentira y el tope achicado
po._buscar_detalle_orden = buscar_falso
po._bajar_exportacion = bajar_falso
po.TOPE_EXPORTACION_WMS = 2000
po.FILAS_POR_TRAMO = 1500

print("\n3. Un archivo cortado no pisa al bueno")
FILA_FIJA = {"orden": "7997635", "creada": datetime(2026, 8, 13, 18, 44, 55), "cant": 1,
             "articulo": "0011446-1-03", "estado": "Enviado", "desc": "CASUAL"}


def escribir(ruta, n):
    with io.open(ruta, "w", encoding="utf-8-sig", newline="") as fh:
        fh.write(";".join(CABECERA) + "\r\n")
        for _ in range(n):
            fh.write(renglon(FILA_FIJA))


destino = os.path.join(TMP, "destino3.csv")
paso = os.path.join(TMP, "paso3.csv")
with io.open(destino, "w", encoding="utf-8") as fh:
    fh.write(u"EL ARCHIVO DE AYER\n")
del REGISTRO[:]
escribir(paso, po.TOPE_EXPORTACION_WMS)
comprobar(not po._dar_por_bueno(None, paso, destino, 1), "2.000 filas justas (el tope de la prueba) se rechaza")
comprobar(es_el_de_ayer(destino), "y el archivo anterior queda como estaba")
comprobar(en_registro("ARCHIVO TRUNCADO"), "y el log dice ARCHIVO TRUNCADO")
escribir(paso, 10)
comprobar(not po._dar_por_bueno(None, paso, destino, 40) and es_el_de_ayer(destino),
          "uno corto tampoco pisa al bueno (antes sí lo pisaba)")
escribir(paso, po.TOPE_EXPORTACION_WMS - 1)
comprobar(po._dar_por_bueno(None, paso, destino, 1)
          and po.contar_filas(destino) == po.TOPE_EXPORTACION_WMS - 1
          and not os.path.exists(paso),
          "1.999 filas pasa, pisa al anterior y no deja el de paso")
escribir(paso, 300)
comprobar(not po._dar_por_bueno(None, paso, destino, 1, paginas=1)
          and po.contar_filas(destino) == po.TOPE_EXPORTACION_WMS - 1,
          "300 filas para 1 página no cuadra y no pisa")

print("\n4. Partir y empalmar: 30 días hasta llegar a un día, sin huecos ni repetidos")
inicio = datetime(2026, 8, 12)
hojas = []


def partir(d, h):
    m = po.partir_en_dos(d, h)
    if not m:
        hojas.append((d, h))
        return
    partir(*m[0])
    partir(*m[1])


partir(inicio, datetime(2026, 9, 10, 19, 2))
comprobar(len(hojas) == 30 and all(d.date() == h.date() for d, h in hojas),
          "30 días se parten en 30 tramos de un día")
comprobar([d.date() for d, _ in hojas] == [(inicio + timedelta(days=i)).date() for i in range(30)],
          "en orden, sin huecos ni días repetidos")
filtros = [po.filtro_del_tramo(d, h, inicio) for d, h in hojas]
comprobar(filtros[0][0] == ("12/08/2026", "0:00:00"), "el primero arranca el 12/08 a las 0:00:00")
comprobar(all(filtros[i][0] == (filtros[i - 1][1][0], po.HORA_EMPALME) for i in range(1, 30)),
          "cada uno arranca a las 23:00:00 del día en que termina el anterior")
comprobar(all(f[1][1] == "23:59:59" for f in filtros), "y todos terminan a las 23:59:59")

print("\n5. La búsqueda: estados obligatorios y el pie que no cambia")
guardado = {n: getattr(po, n) for n in ("abrir_pantalla", "abrir_panel", "limpiar_panel",
                                        "poner_fecha_y_hora", "poner_estado", "total_paginas",
                                        "ejecutar_busqueda", "esperar_resultado", "foto")}
for n in ("abrir_pantalla", "abrir_panel", "limpiar_panel", "poner_fecha_y_hora",
          "ejecutar_busqueda", "foto"):
    setattr(po, n, lambda *a, **k: None)


def probar_busqueda(espera, pie, estado_falla=False):
    del REGISTRO[:]
    po.esperar_resultado = lambda *a, **k: espera
    po.total_paginas = lambda page: pie

    def estado(*a, **k):
        if estado_falla:
            raise RuntimeError("Ninguno de Cargado esta en la lista de 'De estado'")
    po.poner_estado = estado
    try:
        return BUSCAR_DE_VERDAD(None, "Despachados", ("12/08/2026", "0:00:00"),
                                ("10/09/2026", "23:59:59"), (("Cargado",), ("Enviado",)))
    except TimeoutError:
        return "error"


comprobar(probar_busqueda(9, (9, "/ 9 Páginas")) == 9, "una búsqueda normal devuelve sus páginas")
comprobar(probar_busqueda(0, (9, "/ 9 Páginas")) == 9 and en_registro("El pie no cambió"),
          "si el pie no cambió pero hay páginas que caben, se sigue y lo avisa")
comprobar(probar_busqueda(0, (13, "/ 13 Páginas")) == "error",
          "si esas páginas no caben en un tramo, es error y se reintenta")
comprobar(probar_busqueda(0, (None, "")) == "error", "sin páginas es error")
comprobar(probar_busqueda(9, (9, "/ 9 Páginas"), estado_falla=True) is None
          and en_registro("No se baja"), "si un estado no se pudo poner, no se busca nada")
for n, f in guardado.items():
    setattr(po, n, f)

print("\n6. Un rango que cabe se baja de una vez, igual que antes")
inicio = datetime(2026, 8, 12)
filas = datos(inicio, [100] * 10)
ok, page, destino = correr(filas, inicio, 10)
comprobar(ok and page.busquedas == 1 and page.exportaciones == 1,
          "%d filas: 1 búsqueda y 1 exportación" % len(filas))
comprobar(igual_a_la_grilla(destino, filas), "el archivo es la grilla entera, ordenada por artículo")
comprobar(sin_restos(), "no quedan archivos de paso ni tramos")

print("\n7. Un rango que no cabe se parte, y lo juntado es exactamente la grilla")
dias30 = [12 if (inicio + timedelta(days=i)).weekday() >= 5 else 160 for i in range(30)]
filas30 = datos(inicio, dias30, semilla=11)
ok, page, destino = correr(filas30, inicio, 30)
buenos = contar("bueno:")
comprobar(ok, "%d filas en 30 días: bajó" % len(filas30))
comprobar(page.busquedas >= 3 and buenos >= 2 and page.exportaciones == buenos,
          "se partió: %d búsquedas, %d tramos, cada uno exportado una vez"
          % (page.busquedas, buenos))
comprobar(igual_a_la_grilla(destino, filas30),
          "juntado es exactamente la grilla: mismas filas, mismas repeticiones, ordenado")
empalme = [r for r in REGISTRO if "repetidas del empalme" in r]
comprobar(empalme and " 0 repetidas" not in empalme[0], "el empalme tenía órdenes repetidas y se quitaron: %s"
          % (empalme[0].split("] ", 1)[1] if empalme else "-"))
tardias = [f for f in filas30 if f["creada"].microsecond]
comprobar(len(tardias) > 0, "hay %d filas creadas a las 23:59:59 y medio (entran solo en el tramo siguiente)"
          % len(tardias))
comprobar(sin_restos(), "no quedan archivos de paso ni tramos")

print("\n8. La grilla vieja: se exporta la búsqueda anterior y se rechaza")
ok, page, destino = correr(filas30, inicio, 30, vieja_despues_de=1)
comprobar(en_registro("FUERA del tramo"), "el tramo con filas de otro rango se detecta")
comprobar(ok and igual_a_la_grilla(destino, filas30), "el reintento lo arregla y el archivo sale igual")
comprobar(en_registro("ya bajó bien en el intento anterior"),
          "y el reintento no vuelve a bajar lo que estaba bien")

print("\n9. Un tramo sin filas no es una falla")
dias_vacios = [150] * 12 + [0] * 18
filas_v = datos(inicio, dias_vacios, semilla=5)
filas_v = [f for f in filas_v if f["creada"] < inicio + timedelta(days=12)]
ok, page, destino = correr(filas_v, inicio, 30)
comprobar(ok and en_registro("sin filas"), "el tramo vacío se anota y se sigue")
comprobar(igual_a_la_grilla(destino, filas_v), "y el archivo es la grilla")

print("\n10. Sin filtro de estado no se baja nada")
ok, page, destino = correr(filas30, inicio, 30, sin_estado=True)
comprobar(not ok and page.exportaciones == 0 and es_el_de_ayer(destino),
          "no exporta y el archivo de ayer queda como estaba")

print("\n11. Filas de más entre la búsqueda y la exportación")
ok, page, destino = correr(filas, inicio, 10, deriva=300)
comprobar(not ok and es_el_de_ayer(destino) and en_registro("No se da por bueno"),
          "300 filas de más no cuadran con las páginas: se rechaza y no pisa")

print("\n12. Se cae una exportación a la mitad")
ok, page, destino = correr(filas30, inicio, 30, caer_en=(2,))
comprobar(ok and igual_a_la_grilla(destino, filas30), "el reintento termina y el archivo sale igual")
comprobar(en_registro("ya bajó bien en el intento anterior") and page.exportaciones == contar("bueno:"),
          "los tramos buenos no se vuelven a exportar")

print("\n13. Un tramo que sigue sin caber en un solo día")
po.FILAS_POR_TRAMO = 100
ok, page, destino = correr(filas, inicio, 10)
comprobar(not ok and en_registro("UN día") and es_el_de_ayer(destino),
          "si un solo día no cabe, se rinde con un error claro y no pisa")
po.FILAS_POR_TRAMO = 1500

if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
    print("\n14. El archivo real, partido en tres tramos que se pisan")
    registros = po._registros(sys.argv[1])
    cabecera, texto_cabecera = next(registros)
    i_cre = cabecera.index(po.COL_CREACION)
    cortes = [(datetime(2026, 8, 12), datetime(2026, 8, 21)),
              (datetime(2026, 8, 22), datetime(2026, 8, 31)),
              (datetime(2026, 9, 1), datetime(2026, 9, 10))]
    tramos = []
    for n, (d, h) in enumerate(cortes):
        de, a = po.filtro_del_tramo(d, h, cortes[0][0])
        tramos.append((os.path.join(TMP, "real_%d.csv" % n),
                       datetime.strptime("%s %s" % de, "%d/%m/%Y %H:%M:%S"),
                       datetime.strptime("%s %s" % a, "%d/%m/%Y %H:%M:%S")))
    archivos = [io.open(t[0], "w", encoding="utf-8-sig", newline="") for t in tramos]
    for fh in archivos:
        fh.write(texto_cabecera)
    originales = collections.Counter()
    n_original = 0
    for campos, texto in registros:
        n_original += 1
        originales[texto] += 1
        creada = po._fecha_wms(campos[i_cre])
        for t, fh in zip(tramos, archivos):
            if t[1] <= creada <= t[2]:
                fh.write(texto)
    for fh in archivos:
        fh.close()
    por_tramo = [po.contar_filas(t[0]) for t in tramos]
    salida = os.path.join(TMP, "real_juntado.csv")
    escritas, repetidas = po.juntar_tramos(tramos, salida)
    juntadas = collections.Counter()
    en_orden = True
    anterior = ""
    registros = po._registros(salida)
    next(registros)
    for campos, texto in registros:
        juntadas[texto] += 1
        art = po._limpio(campos[5])
        en_orden = en_orden and art >= anterior
        anterior = art
    print("      tramos de %s filas; %s repetidas del empalme; %s juntadas"
          % (" + ".join(format(x, ",d") for x in por_tramo), format(repetidas, ",d"),
             format(escritas, ",d")))
    comprobar(escritas == n_original, "juntadas quedan las %s filas del original" % format(n_original, ",d"))
    comprobar(juntadas == originales, "y son las mismas, una por una, con sus repeticiones")
    comprobar(en_orden, "ordenadas por artículo, como exporta el WMS")
    comprobar(repetidas > 0 and sum(por_tramo) == escritas + repetidas,
              "el empalme traía órdenes repetidas y la cuenta cierra")

shutil.rmtree(TMP, ignore_errors=True)
print("\n" + ("TODO BIEN" if not FALLAS else
              "%d FALLAS:\n  - %s" % (len(FALLAS), "\n  - ".join(FALLAS))))
sys.exit(1 if FALLAS else 0)
