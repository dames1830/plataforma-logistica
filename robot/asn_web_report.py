# -*- coding: utf-8 -*-
"""
ROBOT DEL ASN - baja el web report "ASN" del WMS, un archivo por mes.

POR QUE POR MESES Y NO DE UN GOLPE
    Un mes son ~20 MB, ~140.000 filas y 7-8 minutos. Seis meses de una tirada
    serian ~120 MB y ~45 minutos. El tiempo total es casi el mismo, pero por
    partes: si un mes falla se reintenta ese solo, el candado del WMS se suelta
    entre mes y mes -en vez de quedarse tomado tres cuartos de hora- y se
    esquiva el 504 que Oracle devuelve con las consultas grandes. Es la misma
    leccion que dejo el OBLPN de agosto.
    Lo decidio Daniel el 01-sep-2026.

CUANDO PUEDE PEDIR EL ARCHIVO
    El visor abre a los ~15 segundos y su contador "Página 1 de N" sigue
    SUBIENDO un buen rato: no es el total, se va armando. Pero no hay que
    esperarlo, porque **Oracle arma el archivo de exportacion del lado del
    servidor**, con la consulta entera. Basta con que el visor este abierto.

QUE DEJA
    OneDrive\\scraping Stock\\ASN\\ASN 2026-08.csv   (uno por mes)

USO
    python asn_web_report.py                    los 6 meses (el actual y 5 atras)
    python asn_web_report.py --meses 3          los ultimos 3
    python asn_web_report.py --mes 2026-07      solo ese mes
    python asn_web_report.py --actual           solo el mes en curso
"""
import os
import sys
import time
import calendar
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# VA ANTES DE IMPORTAR PLAYWRIGHT. Como SYSTEM el navegador no esta en su perfil
# sino en el de Administrator. Mismo bloque que usa oblpn_embalaje.py.
if not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
    for _p in (os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "Administrator", "AppData", "Local", "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "dames", "AppData", "Local", "ms-playwright")):
        if _p and os.path.isdir(_p):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = _p
            break

import wms_automation_final as wms
import picking_y_orden as po
import bloqueo_wms
from playwright.sync_api import sync_playwright

QUIEN = "ASN web report"
CARPETA = "Dames"
INFORME = "ASN"

MESES_POR_DEFECTO = 6
MINIMO_KB = 20                  # Un Excel con solo encabezados pesa ~8 KB, asi que
                                # 20 alcanza para cachar uno vacio. NO subirlo: el
                                # mes EN CURSO empieza casi vacio -el 01-sep a las
                                # 03:46 septiembre pesaba 67 KB y era correcto- y un
                                # piso alto lo rechaza. Mismo error que el de 400 KB
                                # del OBLPN, que tiraba los domingos flojos.
MINUTOS_ARMADO = 40             # cuanto se espera a que Oracle arme el informe
INTENTOS = 2

# Posiciones fijas del arbol de informes. Estan medidas sobre 1920x1080.
RAYAS_X = 323.0                 # el icono de tres rayas de la fila seleccionada
EQUIS_FILTRO = (1889.0, 203.0)  # la X roja de la fila del filtro


# ────────────────────────────── los meses ──────────────────────────────

def rango_del_mes(anio, mes):
    """Del primero a las 00:00:00 al ultimo a las 23:59:59, como los escribe
    el propio WMS: dd/MM/yyyy."""
    ultimo = calendar.monthrange(anio, mes)[1]
    return ("01/%02d/%04d 00:00:00" % (mes, anio),
            "%02d/%02d/%04d 23:59:59" % (ultimo, mes, anio))


def meses_a_bajar():
    """El mes en curso y los anteriores, del mas nuevo al mas viejo."""
    hoy = datetime.now()
    if "--mes" in sys.argv:
        crudo = sys.argv[sys.argv.index("--mes") + 1]
        anio, mes = crudo.split("-")
        return [(int(anio), int(mes))]
    if "--actual" in sys.argv:
        return [(hoy.year, hoy.month)]
    cuantos = MESES_POR_DEFECTO
    if "--meses" in sys.argv:
        cuantos = int(sys.argv[sys.argv.index("--meses") + 1])
    salida = []
    anio, mes = hoy.year, hoy.month
    for _ in range(cuantos):
        salida.append((anio, mes))
        mes -= 1
        if mes == 0:
            anio, mes = anio - 1, 12
    return salida


def destino_de(anio, mes):
    # _base_onedrive() YA termina en "scraping Stock": agregarla otra vez
    # dejaba los archivos en ...\scraping Stock\scraping Stock\ASN.
    base = os.path.join(wms._base_onedrive(), "ASN")
    return os.path.join(base, "ASN %04d-%02d.xlsx" % (anio, mes))


# ─────────────────────────── ayudantes de pantalla ───────────────────────────

def foto(page, nombre):
    ruta = os.path.join(po.LOGS, "asnweb_%s.png" % nombre)
    try:
        page.screenshot(path=ruta, full_page=False)
        po.log("   foto: %s" % os.path.basename(ruta))
    except Exception:
        pass


def en_arbol(fr, texto):
    """La coincidencia del arbol de la izquierda (x < 360)."""
    loc = fr.get_by_text(texto, exact=True)
    for i in range(loc.count()):
        el = loc.nth(i)
        try:
            c = el.bounding_box()
        except Exception:
            c = None
        if c and c["x"] < 360:
            return el, c
    return None, None


def a_la_derecha(fr, texto, x_min=360):
    loc = fr.get_by_text(texto, exact=True)
    for i in range(loc.count()):
        el = loc.nth(i)
        try:
            el.scroll_into_view_if_needed(timeout=4000)
            c = el.bounding_box()
        except Exception:
            c = None
        if c and c["x"] > x_min:
            return el, c
    return None, None


def esperar_el_arbol(fr, segundos=120):
    """Espera a que el marco de informes tenga contenido.

    Antes se contaban 12 segundos fijos y alcanzaba. El 03-sep-2026 el modulo
    tardo mas y el marco llego VACIO: el robot no encontro la carpeta y aborto.
    Un numero fijo funciona hasta el dia que Oracle esta lento, y ese dia no
    baja el ASN sin que nadie sepa por que.

    Devuelve el texto del marco, o cadena vacia si nunca aparecio.
    """
    esperado = 0
    while esperado < segundos:
        try:
            t = fr.locator("body").inner_text(timeout=8000) or ""
        except Exception:
            t = ""
        if "Unexpected error" in t:
            po.log("   el modulo devolvio 'Unexpected error' de Oracle", "WARN")
            return t
        if t.strip():
            po.log("   arbol listo en %d s" % esperado)
            return t
        time.sleep(5)
        esperado += 5
    po.log("   el marco de informes sigue vacio tras %d s" % segundos, "WARN")
    return ""


def cerrar_pestanas_de_informe(fr):
    """Una pestana de edicion abierta de una corrida anterior hace que el WMS la
    restaure al entrar, y despues cualquier clic cae dentro de ese editor viejo
    en vez de sobre el informe. Se cierran antes de empezar."""
    cerradas = 0
    for _ in range(5):
        try:
            aspas = fr.locator(".wrTabCloseIcon, [class*='TabClose']")
            if aspas.count() == 0:
                break
            aspas.last.click(force=True, timeout=4000)
            cerradas += 1
            time.sleep(3)
        except Exception:
            break
    if cerradas:
        po.log("   pestanas de informe cerradas: %d" % cerradas)


def abrir_editor(fr, page):
    """Carpeta Dames -> informe ASN -> menu de tres rayas -> Editar."""
    # EL ICONO ALTERNA, asi que un clic a ciegas PLIEGA si la carpeta ya estaba
    # abierta. Y puede estarlo: la deja abierta cualquier corrida que se corte a
    # la mitad. Cuando eso paso, esta funcion fallaba con "no encuentro el
    # informe" -y el 01-sep esa misma escena tumbo el ancla de las 07:00-.
    #
    # Ahora se mira el RESULTADO en vez de confiar en el estado: se alterna hasta
    # que el informe se ve, con un tope para no quedarse dando vueltas.
    el, c = en_arbol(fr, INFORME)
    for intento in range(3):
        if el is not None:
            break
        carp, _ = en_arbol(fr, CARPETA)
        if carp is None:
            raise RuntimeError("no encuentro la carpeta %s en el arbol" % CARPETA)
        try:
            cont = carp.locator(
                "xpath=ancestor::*[contains(@class,'wrTrNodeTextHighlightContainer')][1]")
            cont.locator(".wrTrEi").first.click(timeout=8000)
        except Exception as e:
            po.log("   no pude alternar la carpeta: %s" % str(e)[:70], "WARN")
        time.sleep(7)
        el, c = en_arbol(fr, INFORME)
        if el is None:
            po.log("   la carpeta estaba al reves; vuelvo a intentar", "WARN")
    if el is None:
        raise RuntimeError("no encuentro el informe %s en el arbol" % INFORME)
    el.click(force=True)
    time.sleep(3)
    # El icono del medio EJECUTA el informe. Se apunta al ultimo, el del menu.
    page.mouse.click(RAYAS_X, c["y"] + c["height"] / 2.0)
    time.sleep(3)
    ed, _ = a_la_derecha(fr, "Editar", x_min=0)
    if ed is None:
        raise RuntimeError("no encuentro la opcion Editar")
    ed.click(force=True)
    time.sleep(16)


def poner_fechas(fr, page, desde, hasta):
    """Rehace el filtro de fecha con el rango del mes.

    Se rehace entero en vez de solo reescribir los valores porque el editor de
    Oracle CONSERVA lo que quedo de la corrida anterior, aunque no se haya
    guardado: si el filtro quedo apuntando a otro campo, reescribir el valor lo
    unico que hace es meter una fecha en el filtro equivocado. Ya paso.
    """
    fr.get_by_text("Filtros", exact=True).first.click(timeout=12000)
    time.sleep(10)

    # 1. Fuera lo que haya
    for _ in range(3):
        page.mouse.click(EQUIS_FILTRO[0], EQUIS_FILTRO[1])
        time.sleep(3)

    # 2. El campo: la fecha de creacion del DETALLE
    combo = None
    combos = fr.get_by_role("combobox")
    for i in range(combos.count()):
        cb = combos.nth(i)
        try:
            cc = cb.bounding_box()
        except Exception:
            cc = None
        if cc and cc["x"] > 360 and cc["y"] < 260:
            combo = cb
            break
    if combo is None:
        raise RuntimeError("no encuentro el desplegable de objetos")
    combo.select_option(label="ib_shipment_dtl", timeout=8000)
    time.sleep(6)

    cam, _ = a_la_derecha(fr, "create_ts")
    if cam is None:
        raise RuntimeError("no encuentro create_ts")
    cam.click(force=True)
    time.sleep(1)
    bot, _ = a_la_derecha(fr, "Agregar")
    if bot is None:
        raise RuntimeError("no encuentro el boton Agregar")
    bot.click(force=True, timeout=6000)
    time.sleep(6)

    # 3. El operador. OJO: con "Igual que" hay UNA caja de valor; solo con
    #    "Esta entre" aparecen las DOS que hacen falta.
    puesto = False
    combos = fr.get_by_role("combobox")
    for i in range(combos.count()):
        cb = combos.nth(i)
        try:
            cc = cb.bounding_box()
        except Exception:
            cc = None
        if not cc or cc["x"] < 360 or cc["y"] < 700:
            continue
        try:
            cb.select_option(label="Está entre", timeout=5000)
            puesto = True
            break
        except Exception:
            continue
    if not puesto:
        raise RuntimeError("no pude poner el operador 'Esta entre'")
    time.sleep(5)

    # 4. Las dos casillas apagadas: ni agrupar ni pedir el valor.
    cas = fr.get_by_role("checkbox")
    lista = []
    for i in range(cas.count()):
        ch = cas.nth(i)
        try:
            cc = ch.bounding_box()
        except Exception:
            cc = None
        if cc and cc["x"] > 360 and cc["y"] > 700:
            lista.append((cc["y"], ch))
    lista.sort()
    for _, ch in lista:
        try:
            ch.uncheck(timeout=6000)
        except Exception:
            pass
    time.sleep(4)

    # 5. Las fechas, DE ABAJO HACIA ARRIBA: el calendario de la caja de arriba
    #    se despliega encima de la de abajo y le come el clic.
    cajas = fr.get_by_role("textbox")
    valores = []
    for i in range(cajas.count()):
        cj = cajas.nth(i)
        try:
            if not cj.is_visible():
                continue
            cc = cj.bounding_box()
        except Exception:
            continue
        if cc and cc["x"] > 700 and cc["y"] > 800 and cc["width"] > 400:
            valores.append((cc["y"], cj))
    valores.sort()
    if len(valores) < 2:
        raise RuntimeError("esperaba dos cajas de fecha y hay %d" % len(valores))

    for idx, texto in ((1, hasta), (0, desde)):
        _, cj = valores[idx]
        puesta = False
        for _ in range(3):
            try:
                cj.fill(texto, timeout=8000)
                puesta = True
                break
            except Exception:
                try:
                    page.keyboard.press("Escape")
                except Exception:
                    pass
                time.sleep(2)
        if not puesta:
            raise RuntimeError("no pude escribir la fecha %s" % texto)
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        time.sleep(2)

    po.log("   filtro: create_ts entre %s y %s" % (desde, hasta))


def ejecutar_y_exportar(fr, page, destino):
    """Ejecuta desde la barra del editor, espera el VISOR y baja el archivo.

    DOS COSAS QUE COSTARON UNA CORRIDA PERDIDA:

    1. El selector de la flecha de exportar encuentra DOS botones: el
       desplegable PDF del **editor** y el del **visor**. Tomando el primero se
       abre el del editor, que no descarga nada: el robot creyo que el informe
       estaba listo en 0,1 minutos y despues se quedo 20 minutos esperando un
       archivo que nunca arranco. Va `.last`, que es el del visor.

    2. No hace falta esperar a que el visor termine de dibujar las paginas. El
       contador "de N" sigue subiendo un buen rato, pero **Oracle arma el
       archivo de exportacion del lado del servidor**, con la consulta completa.
       Basta con que el visor este abierto.
    """
    ej, _ = a_la_derecha(fr, "Ejecutar")
    if ej is None:
        raise RuntimeError("no encuentro el boton Ejecutar")
    ej.click(force=True, timeout=10000)
    po.log("   ejecutando...")

    # El visor esta arriba cuando aparecen a la vez "Página" y "Exportar".
    arranque = time.time()
    abierto = False
    while time.time() - arranque < MINUTOS_ARMADO * 60:
        time.sleep(10)
        try:
            texto = fr.locator("body").inner_text(timeout=15000)
        except Exception:
            continue
        if "Página" in texto and "Exportar" in texto:
            abierto = True
            break
    if not abierto:
        raise RuntimeError("el visor no abrio en %d minutos" % MINUTOS_ARMADO)

    # Cuantas paginas lleva: es la unica medida de avance que da el WMS.
    paginas = "?"
    lineas = [l.strip() for l in texto.splitlines() if l.strip()]
    for i, l in enumerate(lineas):
        if l == "de" and i + 1 < len(lineas):
            paginas = lineas[i + 1]
            break
    po.log("   visor abierto en %.0f s (va por %s paginas y sigue contando)"
           % (time.time() - arranque, paginas))

    # El boton de exportar del VISOR. Por clase no se puede distinguir: hay dos
    # -el desplegable PDF del editor y este- y probando `.first` y `.last` los
    # dos fallaron. Se va por posicion, que si es inequivoca: en el visor la
    # ETIQUETA "Exportar" esta arriba a la derecha y su flechita queda 29 px a
    # la derecha y 28 px por debajo.
    exp, ce = a_la_derecha(fr, "Exportar", x_min=1000)
    if exp is None:
        foto(page, "sin_exportar")
        raise RuntimeError("no encuentro la etiqueta Exportar del visor")
    fx = ce["x"] + 29
    fy = ce["y"] + 28
    po.log("   Exportar en x=%.0f y=%.0f -> flechita en (%.0f, %.0f)"
           % (ce["x"], ce["y"], fx, fy))
    page.mouse.click(fx, fy)
    time.sleep(4)

    # Si no se abrio el menu, se prueba el icono mismo, 17 px mas a la izquierda.
    try:
        texto2 = fr.locator("body").inner_text(timeout=10000)
    except Exception:
        texto2 = ""
    if "CSV" not in texto2 and "Excel" not in texto2:
        po.log("   el menu no aparecio; pruebo el icono")
        page.mouse.click(fx - 17, fy)
        time.sleep(4)
        try:
            texto2 = fr.locator("body").inner_text(timeout=10000)
        except Exception:
            texto2 = ""
    if "CSV" not in texto2 and "Excel" not in texto2:
        foto(page, "sin_menu_exportar")
        raise RuntimeError("no se abrio el menu de exportacion")

    foto(page, "menu_abierto")

    menu = fr.locator("[id^='wrExecuteExportTypeMenu']").last
    elegido = None
    # Excel PRIMERO: es el que descargar_stock_reserva() usa desde el 30-jul-2026
    # en este mismo visor. Con CSV el menu se abrio pero no arranco la bajada.
    for etiqueta in ("Excel", "CSV"):
        try:
            cand = menu.get_by_text(etiqueta, exact=True).filter(visible=True).first
            if cand.count() > 0:
                elegido = (etiqueta, cand)
                break
        except Exception:
            continue
    if elegido is None:
        foto(page, "sin_formato")
        raise RuntimeError("no encuentro CSV ni Excel en el menu de exportacion")

    etiqueta, cand = elegido
    po.log("   formato %s; el servidor arma el archivo (hasta 40 min)" % etiqueta)
    inicio_bajada = time.time()
    with page.expect_download(timeout=2400000) as bajada:
        cand.click(force=True)
    archivo = bajada.value
    po.log("   descarga arrancada a los %.1f min" % ((time.time() - inicio_bajada) / 60.0))

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    archivo.save_as(destino)
    kb = os.path.getsize(destino) / 1024.0
    if kb < MINIMO_KB:
        raise RuntimeError("el archivo bajo con solo %.0f KB, se esperaban mas de %d"
                           % (kb, MINIMO_KB))
    po.log("   guardado: %.1f MB en %.1f min -> %s"
           % (kb / 1024.0, (time.time() - inicio_bajada) / 60.0, destino))
    return True


def salir_del_editor(fr):
    """Cancelar, para no dejar el informe guardado con el mes de la ultima
    corrida. Igual el editor conserva lo que quedo, por eso cada mes rehace el
    filtro entero en vez de confiar en lo que encuentra."""
    try:
        can, _ = a_la_derecha(fr, "Cancelar")
        if can is not None:
            can.click(force=True, timeout=8000)
            time.sleep(8)
    except Exception:
        pass


def dejar_el_arbol_como_estaba(fr):
    """CIERRA LAS PESTANAS Y VUELVE A PLEGAR LA CARPETA.

    Oracle recuerda las carpetas abiertas ENTRE SESIONES y por usuario, y este
    robot entra con la misma cuenta que todos los demas. Dejar `Dames`
    desplegada le mueve el arbol a los otros robots.

    El 01-sep-2026 eso tumbo el ancla de las 07:00: `descargar_stock_reserva()`
    buscaba el informe por posicion, no lo encontro, y el turno arranco sin
    stock de reserva. Aquella funcion ya se arreglo -ahora busca por nombre-,
    pero igual corresponde salir dejando todo como estaba: el que ensucia,
    limpia.
    """
    try:
        cerradas = 0
        for _ in range(6):
            aspas = fr.locator(".wrTabCloseIcon, [class*='TabClose']")
            if aspas.count() == 0:
                break
            aspas.last.click(force=True, timeout=4000)
            cerradas += 1
            time.sleep(2)
        if cerradas:
            po.log("   pestanas de informe cerradas: %d" % cerradas)
    except Exception:
        pass

    # Si el informe ASN se ve en el arbol, es que la carpeta quedo abierta.
    for _ in range(3):
        try:
            visible = False
            obj = fr.get_by_text(INFORME, exact=True)
            for i in range(obj.count()):
                c = obj.nth(i).bounding_box()
                if c and c["x"] < 360:
                    visible = True
                    break
            if not visible:
                return
            el, _ = en_arbol(fr, CARPETA)
            if el is None:
                return
            cont = el.locator(
                "xpath=ancestor::*[contains(@class,'wrTrNodeTextHighlightContainer')][1]")
            cont.locator(".wrTrEi").first.click(timeout=8000)
            po.log("   carpeta %s vuelta a plegar" % CARPETA)
            time.sleep(4)
        except Exception:
            return


# ──────────────────────────────── un mes ────────────────────────────────

def bajar_mes(anio, mes):
    desde, hasta = rango_del_mes(anio, mes)
    destino = destino_de(anio, mes)
    po.log("=" * 58)
    po.log("ASN %04d-%02d" % (anio, mes))
    po.log("=" * 58)

    libre = bloqueo_wms.esperar_turno(po.log, minutos_max=25, quien=QUIEN)
    if not libre:
        po.log("   el WMS sigue ocupado; este mes se salta", "WARN")
        return False
    bloqueo_wms.tomar(QUIEN)
    try:
        with sync_playwright() as p:
            navegador = p.chromium.launch(headless=True)
            contexto = navegador.new_context(viewport={"width": 1920, "height": 1080},
                                             accept_downloads=True)
            page = contexto.new_page()
            page.on("dialog", lambda d: d.accept())
            page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            time.sleep(15)
            try:
                wms.cerrar_pestanas(page)
                time.sleep(1)
                fr = (page.locator("#reports_frame").content_frame
                      .locator("#reports_frame").content_frame)
                # El modulo Web hay que abrirlo antes de tener el marco
                buscador = page.get_by_role("textbox", name="Select Screen Textbox")
                buscador.wait_for(state="visible", timeout=60000)
                buscador.click()
                buscador.fill("")
                buscador.type("web", delay=150)
                time.sleep(2)
                page.get_by_text("Web", exact=True).click()
                time.sleep(12)
                fr = (page.locator("#reports_frame").content_frame
                      .locator("#reports_frame").content_frame)

                esperar_el_arbol(fr)
                cerrar_pestanas_de_informe(fr)
                abrir_editor(fr, page)
                poner_fechas(fr, page, desde, hasta)
                ok = ejecutar_y_exportar(fr, page, destino)
                salir_del_editor(fr)
                dejar_el_arbol_como_estaba(fr)
                return ok
            finally:
                try:
                    contexto.close()
                    navegador.close()
                except Exception:
                    pass
    finally:
        bloqueo_wms.soltar()


def main():
    po.abrir_log()
    meses = meses_a_bajar()
    po.log("=" * 58)
    po.log("ROBOT DEL ASN - %d mes(es)" % len(meses))
    po.log("=" * 58)
    for anio, mes in meses:
        po.log("   %04d-%02d" % (anio, mes))

    buenos, malos = [], []
    for anio, mes in meses:
        etiqueta = "%04d-%02d" % (anio, mes)
        for intento in range(1, INTENTOS + 1):
            try:
                if bajar_mes(anio, mes):
                    buenos.append(etiqueta)
                    break
                malos.append(etiqueta)
                break
            except Exception as e:
                po.log("   %s - intento %d de %d: %s: %s"
                       % (etiqueta, intento, INTENTOS, type(e).__name__, str(e)[:160]),
                       "ERROR")
                if intento == INTENTOS:
                    malos.append(etiqueta)
                else:
                    po.log("   reintentando en 3 minutos...")
                    time.sleep(180)

    po.log("=" * 58)
    po.log("LISTO - %d de %d meses" % (len(buenos), len(meses)))
    if buenos:
        po.log("   bajados: %s" % ", ".join(buenos))
    if malos:
        po.log("   fallaron: %s" % ", ".join(malos), "WARN")
    po.log("=" * 58)
    return 0 if not malos else 1


# EL GUARDIA QUE FALTABA. Sin esto, `import asn_web_report` ARRANCA la bajada
# entera de los seis meses: paso el 01-sep-2026 al reusar `ejecutar_y_exportar`
# desde otro script, que se llevo el WMS 45 minutos sin que nadie lo pidiera.
# Un modulo que se puede importar no puede correr solo al importarse.
if __name__ == "__main__":
    sys.exit(main())
