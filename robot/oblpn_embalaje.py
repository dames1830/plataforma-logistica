# -*- coding: utf-8 -*-
"""
OBLPN / EMBALAJE  ·  el eslabón que faltaba entre el picking y el despacho
================================================================================

Daniel, 29-ago-2026: *"los chicos pican, pero también embalan. No hemos visto el tema de
embalaje"*. Hasta acá el circuito se medía hasta que la mercadería salía del rack y volvía
a aparecer recién cuando ya estaba despachada. En el medio no había nada.

QUE ES UN OBLPN: *Outbound License Plate Number*, el número de cada bulto que sale. Una
línea por artículo dentro de cada bulto.

POR QUE ESTE ARCHIVO CIERRA EL CIRCUITO SOLO. Trae las cuatro etapas con hora Y con el
nombre de quién hizo cada una:

    Detail Pick User / Detail Picked Time                   quién picó y cuándo
    Usuario de paquete / Registro de hora de empaquetado    quién embaló y cuándo
    Usuario de carga / Hora de asignación de carga          quién cargó y cuándo
    Estado de LPN                                           Empaquetado | Cargado | Enviado

Medido sobre el archivo del 27-ago: picar → empaquetar tarda 0,8 h de mediana, pero
**empaquetar → cargar tarda 21,3 h**. El cuello no está en el almacén: está entre que el
bulto queda armado y sube al camión. Y ese día quedaron 44.050 unidades en 1.518 bultos
en estado Empaquetado sin salir, esperando 31 horas de mediana.

EL CAMINO SALE DE UNA GRABACION de Daniel del 29-ago-2026, no de adivinar:
    pantalla TRX_OBLPN/CARTON  ·  botón Buscar  ·  botón Borrar
    las fechas  ·  Exportar → Exportar a CSV

TARDA 10 A 12 MINUTOS, cronometrado por él haciéndolo a mano. Por eso las esperas de acá
son mucho más largas que las del picking: con los 7 minutos que usan los otros, este se
cortaría siempre.

Se apoya en los ayudantes de `picking_y_orden.py` —abrir pantalla, panel, escribir fechas,
exportar— para no tener dos copias de lo mismo. Ver `robot/LEEME.md`.
"""
import os
import sys
import time
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import picking_y_orden as po        # los ayudantes, ya probados contra el WMS

# El nombre de la pantalla, tal cual lo grabó Daniel el 29-ago-2026.
PANTALLA_OBLPN = "TRX_OBLPN/CARTON"

# LAS ETIQUETAS DE LAS FECHAS VAN COMO LISTA DE CANDIDATAS, no como una sola.
#
# La grabación llegó a las fechas a fuerza de clics en el calendario, así que no dejó
# escrito cómo se llaman los campos. Lo que sí se sabe es cómo se llama la COLUMNA en el
# CSV que sale —"Registro de hora de creación de LPN"— y en el Detalle de Orden el panel
# usa el mismo texto con "De " y "A " adelante.
#
# Se prueban en orden y gana la primera que exista. Si no está ninguna, el robot ANOTA las
# etiquetas que sí encontró en el panel, que es lo que hace falta para corregirlo en un
# minuto en vez de volver a grabar.
ETQ_DESDE = ("De registro de hora de creación de LPN",
             "De registro de hora de creación",
             "De fecha de creación")
ETQ_HASTA = ("A registro de hora de creación de LPN",
             "A registro de hora de creación",
             "A fecha de creación")

CARPETA = "OBLPN Embalaje"       # la misma donde Daniel viene guardando los suyos
# El archivo del 27-ago pesó 16,7 MB con 29.827 filas. El piso va bien abajo: lo que tiene
# que delatar es una búsqueda mal filtrada de unos KB, no un domingo flojo.
MINIMO_KB = 400
# El WMS tarda 10 a 12 minutos en esta pantalla. Se le dan 20 de margen.
ESPERA_SEG = 1200


def etiqueta_que_exista(page, candidatas, prefijo="dijit_form_DateTextBox_"):
    """La primera de las candidatas que de verdad esté en el panel.

    Devuelve None si no hay ninguna, y en ese caso deja anotado en el log qué etiquetas
    ofrece el panel: sin eso, un cambio de nombre en el WMS obliga a volver a grabar.
    """
    for etq in candidatas:
        try:
            po._campo(page, etq, prefijo)
            return etq
        except Exception:
            continue
    try:
        vistas = page.locator("xpath=//td[.//input[starts-with(@id,'%s')]]"
                              "/preceding-sibling::td[1]" % prefijo).all_inner_texts()
        po.log("   El panel ofrece estas etiquetas de fecha: %s"
               % " | ".join(t.strip() for t in vistas if t.strip())[:400], "WARN")
    except Exception:
        pass
    return None


def descargar_oblpn(page, destino, dia, sin_exportar=False, con_fotos=False):
    """El OBLPN de UN día, con todos sus estados.

    NO SE FILTRA POR ESTADO A PROPOSITO. El archivo tiene que traer Empaquetado, Cargado y
    Enviado juntos: la gracia del reporte es justamente comparar cuánto se quedó en cada
    escalón. Filtrar por uno solo tapa el que interesa.

    Las filas en `Cancelado` vienen igual y hay que descartarlas al leer, no acá: son
    copias de la tarea con cero unidades —14.988 de las 29.827 del 27-ago—, la misma
    trampa que tiene el archivo de picking.
    """
    import wms_automation_final as wms
    po.log("=" * 58)
    po.log("OBLPN / EMBALAJE · %s" % dia.strftime("%d-%m-%Y"))
    po.log("=" * 58)

    po.abrir_pantalla(page, PANTALLA_OBLPN)
    po.abrir_panel(page)
    po.limpiar_panel(page)

    etq_d = etiqueta_que_exista(page, ETQ_DESDE)
    etq_h = etiqueta_que_exista(page, ETQ_HASTA)
    if not etq_d or not etq_h:
        po.log("No se encontraron los campos de fecha en el panel. Sin fecha esto traeria "
               "el historico entero: no se baja.", "ERROR")
        wms.captura(page, "oblpn_sin_campos_de_fecha")
        return False

    po.poner_fecha_y_hora(page, etq_d, dia.strftime("%d/%m/%Y"), "0:00:00")
    po.poner_fecha_y_hora(page, etq_h, dia.strftime("%d/%m/%Y"), "23:59:59")
    if con_fotos:
        po.foto(page, "oblpn_filtros_puestos")

    _, pie_antes = po.total_paginas(page)
    po.ejecutar_busqueda(page)
    po.log("Esperando a que Oracle traiga las filas... (esta pantalla tarda 10 a 12 min)")
    if not po.esperar_resultado(page, timeout_seg=ESPERA_SEG, distinto_de=pie_antes):
        wms.captura(page, "oblpn_sin_datos")
        raise TimeoutError("El OBLPN no trajo ninguna fila en %d minutos" % (ESPERA_SEG // 60))
    if con_fotos:
        po.foto(page, "oblpn_resultado")

    if sin_exportar:
        po.log("MODO PRUEBA: no se exporta")
        return True
    return po.exportar_csv(page, destino, MINIMO_KB)


def run():
    import bloqueo_wms
    import wms_automation_final as wms
    from playwright.sync_api import sync_playwright

    po.abrir_log()
    wms.log = po.log
    t0 = time.time()

    a_la_vista = "--ver" in sys.argv
    sin_exportar = "--sin-exportar" in sys.argv
    dia = po.dia_pedido()

    po.log("=" * 58)
    po.log("OBLPN / EMBALAJE — %s" % dia.strftime("%d-%m-%Y"))
    po.log("=" * 58)

    base = wms._base_onedrive()
    if not base or not os.path.isdir(base):
        po.log("No se encontró la carpeta de OneDrive (%s)." % base, "ERROR")
        return 1
    carpeta = os.path.join(base, CARPETA)
    if not os.path.isdir(carpeta):
        os.makedirs(carpeta)
        po.log("Se creó la carpeta %s" % carpeta)
    # El mismo formato que viene usando Daniel a mano: "OBLPN 27-08.csv"
    destino = os.path.join(carpeta, "OBLPN %s.csv" % dia.strftime("%d-%m"))
    po.log("Va a quedar en -> %s" % destino)

    # ESTE ROBOT CEDE EL PASO. Tarda 12 minutos y corre una vez al día; si el del picking
    # o el de los stocks está adentro, conviene esperarlos a que terminen antes que
    # pelearse la sesión: Oracle no admite dos del mismo usuario.
    libre = bloqueo_wms.esperar_turno(po.log, minutos_max=25, quien="OBLPN de embalaje")
    if not libre:
        po.log("Otro robot lleva mucho rato en el WMS. Se deja para la próxima.", "WARN")
        return 2
    bloqueo_wms.tomar("OBLPN de embalaje")

    ok = False
    try:
        with sync_playwright() as p:
            navegador = p.chromium.launch(headless=not a_la_vista, channel="chrome")
            page = navegador.new_context().new_page()
            url = "https://a10.wms.ocs.oraclecloud.com/bata/index/"
            po.log("Entrando a %s" % url)
            page.goto(url)
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            po.log("Sesión iniciada como %s" % wms.WMS_USER)
            time.sleep(15)

            ok = wms.con_reintentos(
                "OBLPN",
                lambda: descargar_oblpn(page, destino, dia,
                                        sin_exportar=sin_exportar, con_fotos=sin_exportar),
                page)
            navegador.close()
    finally:
        bloqueo_wms.soltar()

    po.log("=" * 58)
    po.log("OBLPN: %s" % ("bajado" if ok else "NO se bajo"))
    po.log("LISTO en %.1f minutos" % ((time.time() - t0) / 60.0))
    po.log("=" * 58)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run())
