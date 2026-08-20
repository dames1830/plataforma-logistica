# -*- coding: utf-8 -*-
"""BAJA EL DETALLE DE ORDEN DE DÍAS VIEJOS, CON TODOS LOS ESTADOS.

POR QUÉ EXISTE. El robot diario baja el Detalle de Orden completo, pero recién
desde el 12-ago-2026. De antes solo hay dos archivos y los dos traen únicamente
"Creada" y "Parcialmente asignado": el de Pendientes y los `Sem##` que Daniel
bajó a mano. En esos, un pedido ya despachado sencillamente no aparece, así que
no se puede saber cuántos se atendieron: cualquier KPI por estado saldría
diciendo que está todo abierto.

TRAE TODOS LOS ESTADOS. Daniel propuso poner el rango "de Creada a Cancelado",
que es correcto: son el primero y el último de la lista y abarcan todo lo del
medio. Pero puesto a mano NO FUNCIONA -ver el comentario de `descargar_dia`-, y no
hace falta: **el campo de estado vacío ya trae los diez**, que es como lo baja el
robot todas las mañanas.

VA DÍA POR DÍA, TAMBIÉN POR DECISIÓN DE DANIEL: *"si te bajas varios meses en un
solo archivo va a ser muy pesado y no sé si el WMS vaya a fallar"*. Tiene razón:
un día con todos los estados son unas 14.500 líneas y 116 páginas —eso es lo que
el robot baja cada mañana sin fallar—, así que un mes serían unas 2.500 páginas.
La fecha va en "De registro de hora de creación" y "A registro de hora de
creación", el mismo par de filtros que usa el robot diario.

    python bajar_historico_orden.py --desde 01-03-2026 --hasta 11-08-2026

  --desde / --hasta   el rango, inclusive. Sin --hasta, hasta ayer.
  --parar-a HH:MM     se detiene solo a esa hora. Por defecto 06:30.
  --rehacer           vuelve a bajar los días que ya tienen archivo.
  --ver               con el navegador a la vista, para mirarlo trabajar.

SE DETIENE SOLO ANTES DE LAS 06:45, y esto no es un adorno. Oracle no admite dos
sesiones del mismo usuario:

  · El robot de la hora SÍ cede: si encuentra el candado tomado se saltea esa
    vuelta y vuelve en 60 minutos. Cada hora que corra este masivo es una hora
    sin avance de picking publicado, pero no se rompe nada.
  · El robot diario de las 06:45 NO cede: espera 15 minutos y entra igual, porque
    si se saltea nadie baja el picking de ese día. Ahí sí habría dos sesiones a la
    vez y lo más probable es que fallen las dos.

Por eso el corte por defecto son las 06:30: alcanza para cerrar el día que esté
bajando y soltar el candado antes de que llegue el diario.

Cada día queda como `Detalle Orden 05-03.csv`, con el mismo nombre que usa el
robot diario: son el mismo archivo y los lee el mismo código.

ES LARGO. De uno a tres minutos por día, así que marzo a agosto —unos 160 días—
puede llevar entre tres y ocho horas. SE PUEDE CORTAR Y SEGUIR DESPUÉS: los días
que ya tienen archivo se saltean solos, así que basta con volver a lanzarlo con
el mismo rango.

NO CORRE SOLO. Se lanza a mano y de a uno: Oracle no admite dos sesiones del mismo
usuario, y por eso toma el mismo candado que los demás robots.
"""
import os
import sys
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import wms_automation_final as wms                    # noqa: E402
from picking_y_orden import (                         # noqa: E402
    abrir_log, log, descargar_detalle_orden)
from playwright.sync_api import sync_playwright       # noqa: E402


def arg(nombre, por_defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith(nombre + "="):
            return a.split("=", 1)[1]
    return por_defecto


def fecha(txt, que):
    for f in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(txt, f)
        except ValueError:
            continue
    raise SystemExit("No entendí la fecha de %s: '%s'. Se escribe asi: 01-03-2026"
                     % (que, txt))


def descargar_dia(page, destino, dia):
    """El Detalle de Orden de UN día, con todos los estados.

    NO HACE NADA PROPIO: llama a la misma `descargar_detalle_orden` que el robot
    baja todas las mañanas desde el 12-ago. Ese es el punto.

    LA PRIMERA VERSIÓN PONÍA EL RANGO DE ESTADOS A MANO -de Creada a Cancelado- y
    NO FUNCIONÓ. Falló el 20-ago-2026 a las 00:03 con el 01-08: puso las dos
    fechas, puso los dos estados, ejecutó la búsqueda y se quedó diez minutos
    mirando un pie de página que seguía diciendo "5 Páginas". Un día suelto tiene
    unas 116. Lo que pasa es lo que ya avisaba el comentario de
    `descargar_detalle_orden`: esas listas desplegables DISPARAN LA BÚSQUEDA al
    confirmarse, así que cuando el script apretaba Buscar la pantalla ya estaba en
    otra cosa y el resultado que llegó era el de una búsqueda a medio filtrar.

    DEJAR LOS ESTADOS VACÍOS TRAE LOS MISMOS DIEZ ESTADOS. Está comprobado el
    13-ago contra el archivo que Daniel bajó a mano: el 12-ago dio 116 páginas,
    unas 14.500 líneas, del orden del suyo. El rango "de Creada a Cancelado" y el
    campo vacío llevan al mismo lugar; el vacío es el que no rompe la pantalla.
    """
    return descargar_detalle_orden(page, destino, dia)


def main():
    abrir_log()
    wms.log = log
    inicio = datetime.now()

    if not arg("--desde"):
        raise SystemExit("Falta --desde. Ejemplo:\n"
                         "   python bajar_historico_orden.py --desde 01-03-2026")
    desde = fecha(arg("--desde"), "--desde")
    hasta = (fecha(arg("--hasta"), "--hasta") if arg("--hasta")
             else datetime.now() - timedelta(days=1))
    if hasta < desde:
        raise SystemExit("El --hasta (%s) es anterior al --desde (%s)"
                         % (hasta.strftime("%d-%m-%Y"), desde.strftime("%d-%m-%Y")))

    # EL NOMBRE DEL ARCHIVO NO LLEVA AÑO: es "Detalle Orden DD-MM.csv". Un rango
    # que cruce más de doce meses pisaría los archivos del año anterior.
    if (hasta - desde).days > 364:
        raise SystemExit("El rango pasa de un año y los nombres no llevan año: "
                         "se pisarían archivos. Bajalo por tramos más cortos.")

    rehacer = "--rehacer" in sys.argv
    a_la_vista = "--ver" in sys.argv

    # LA HORA DE CORTE. Se detiene ANTES de empezar un dia nuevo, no en la mitad:
    # cortar a la mitad dejaria un csv incompleto que despues nadie sabria que
    # esta cojo. Como el archivo solo se escribe al final, el dia a medio bajar
    # simplemente no queda y se vuelve a pedir la proxima corrida.
    txt_corte = arg("--parar-a", "06:30")
    try:
        hh, mm = [int(x) for x in txt_corte.split(":")]
        assert 0 <= hh <= 23 and 0 <= mm <= 59
    except Exception:
        raise SystemExit("No entendi --parar-a '%s'. Se escribe asi: --parar-a 06:30"
                         % txt_corte)

    def hora_de_parar():
        ahora = datetime.now()
        corte = ahora.replace(hour=hh, minute=mm, second=0, microsecond=0)
        # Si el corte ya paso hoy, es el de manana: la corrida arranca de noche.
        if corte <= inicio:
            corte += timedelta(days=1)
        return ahora >= corte

    base = wms._base_onedrive()
    if not base or not os.path.isdir(base):
        log("No se encontró la carpeta de OneDrive (%s)." % base, "ERROR")
        return 1
    carpeta = os.path.join(base, "Detalle Orden")

    # Un archivo que ya está no se vuelve a pedir: así el script se puede cortar a
    # la mitad y seguir después sin repetir trabajo.
    dias, ya = [], 0
    d = desde
    while d <= hasta:
        ruta = os.path.join(carpeta, "Detalle Orden %s.csv" % d.strftime("%d-%m"))
        if os.path.exists(ruta) and not rehacer:
            ya += 1
        else:
            dias.append((d, ruta))
        d += timedelta(days=1)

    log("=" * 58)
    log("HISTÓRICO DEL DETALLE DE ORDEN · día por día, todos los estados")
    log("=" * 58)
    log("Rango       : %s al %s" % (desde.strftime("%d-%m-%Y"), hasta.strftime("%d-%m-%Y")))
    log("Ya estaban  : %d días" % ya)
    log("Por bajar   : %d días" % len(dias))
    if not dias:
        log("No hay nada que bajar.")
        return 0
    log("Entre 1 y 3 minutos por día: esto puede tardar horas.")
    log("Se detiene solo a las %s para dejarle el WMS al robot diario." % txt_corte)
    log("Se puede cortar con Ctrl+C y volver a lanzarlo: sigue donde quedó.")

    import bloqueo_wms
    bloqueo_wms.esperar_turno(log, minutos_max=30, quien="histórico de orden")
    bloqueo_wms.tomar("histórico de orden")

    ok = fallados = cortado = 0
    t0 = time.time()
    try:
        with sync_playwright() as p:
            navegador = p.chromium.launch(headless=not a_la_vista,
                                          slow_mo=300 if a_la_vista else 0)
            contexto = navegador.new_context(viewport={"width": 1920, "height": 1080})
            page = contexto.new_page()
            page.on("dialog", lambda dlg: dlg.accept())

            url = "https://a10.wms.ocs.oraclecloud.com/bata/index/"
            log("Entrando a %s" % url)
            page.goto(url)
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            log("Sesión iniciada como %s" % wms.WMS_USER)
            time.sleep(15)

            for i, (dia, ruta) in enumerate(dias, 1):
                if hora_de_parar():
                    cortado = len(dias) - i + 1
                    log("")
                    log("SON LAS %s: me detengo para dejarle el WMS al robot "
                        "diario. Quedaron %d dias sin bajar."
                        % (datetime.now().strftime("%H:%M"), cortado), "WARN")
                    break
                log("")
                log("--- día %d de %d · %s ---"
                    % (i, len(dias), dia.strftime("%d-%m-%Y")))
                try:
                    # UN DÍA QUE FALLA NO CORTA LA CORRIDA: son horas de trabajo y
                    # que se caiga el 4 de mayo no puede tirar abajo los otros 159.
                    hecho = wms.con_reintentos(
                        "Detalle histórico %s" % dia.strftime("%d-%m"),
                        lambda d_=dia, r_=ruta: descargar_dia(page, r_, d_),
                        page)
                    if hecho:
                        ok += 1
                    else:
                        fallados += 1
                        log("   quedó sin bajar", "WARN")
                except Exception as e:
                    fallados += 1
                    log("   %s: %s" % (type(e).__name__, str(e)[:200]), "WARN")
                # Un respiro entre días: el WMS se pone lento si se lo empuja.
                time.sleep(3)

            navegador.close()
    finally:
        bloqueo_wms.soltar()

    log("=" * 58)
    log("LISTO en %.1f minutos · %d días bajados, %d fallados%s"
        % ((time.time() - t0) / 60.0, ok, fallados,
           ", %d sin empezar por la hora" % cortado if cortado else ""))
    if fallados or cortado:
        log("Volvé a lanzarlo con el mismo rango: solo va a pedir los que faltan.")
    log("=" * 58)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
