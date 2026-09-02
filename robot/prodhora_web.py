# -*- coding: utf-8 -*-
"""
CORRE Y BAJA EL EXCEL DE LOS DOS WEB REPORTS DE PRODUCCION POR HORA.

    PRODUCCION PICKING  ALDEAS X HORA acc calz
    PRODUCCION EMBALAJE ALDEAS X HORA acc calz

NO SE MODIFICA NADA DEL REPORTE. Daniel, 01-sep-2026: *"no vayas a modificar su
codigo... puedes bajar el Excel"*. Solo se abre, se le pone la fecha en el
dialogo que el propio reporte pide en cada corrida, se ejecuta y se exporta.
NUNCA se aprieta Guardar; se sale con Cancelar.

NO SE IMPORTA `asn_web_report`. El 01-sep-2026 lo importe para reusar su
exportacion y, como terminaba en `sys.exit(main())` sin guardia `if __name__`,
CON SOLO IMPORTARLO arranco la bajada entera de los seis meses del ASN y se
llevo el WMS 45 minutos. Las dos funciones que hacen falta estan copiadas aca.

LAS TRAMPAS, todas medidas esta noche:
  1. El doble clic abre el DISENADOR, no la corrida. Adentro hay un "Ejecutar".
  2. El filtro es `allocation.picked_ts` "Esta entre" y pide DOS fechas CON HORA.
  3. LAS DOS CAJAS SE LLENAN CON `fill()` Y SIN Escape de por medio: el Escape
     cierra el dialogo entero y las dos dan TimeoutError.
  4. El boton del dialogo es "Aceptar", no "Ejecutar".
  5. En el visor hay DOS botones "Exportar" y por clase no se distinguen: se va
     por POSICION, la flechita queda 29 px a la derecha y 28 abajo de la
     etiqueta que esta a la derecha del todo (x > 1000).
  6. El formato es EXCEL. Con CSV el menu se abre y no baja nada.
"""
import os
import sys
import time

sys.path.insert(0, r"C:\wms_scraping")

if not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
    for _p in (os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "Administrator", "AppData",
                            "Local", "ms-playwright")):
        if _p and os.path.isdir(_p):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = _p
            break

import wms_automation_final as wms
import picking_y_orden as po
import bloqueo_wms
from playwright.sync_api import sync_playwright

QUIEN = "Bajar produccion por hora"
CARPETA = "ALDEAS"
DESTINO = os.path.join("C:", os.sep, "wms_scraping", "logs", "prodhora")
MINUTOS_VISOR = 25          # cuanto se espera a que Oracle arme el informe
# ESTOS DOS INFORMES SON RESUMENES Y PESAN POCO: el de picking bajo con 10 KB y
# el de embalaje con 7,6 KB, los dos completos y correctos. Con el corte en 15 KB
# que traia de los informes grandes se rechazaban descargas buenas.
MINIMO_KB = 4

REPORTES = [
    ("picking", "PRODUCCION PICKING ALDEAS X HORA acc calz"),
    ("embalaje", "PRODUCCION EMBALAJE  ALDEAS X HORA acc calz"),
]


def a_la_derecha(fr, texto, x_min=360):
    """El elemento con ese texto que este a la derecha de x_min. Copiado de
    asn_web_report.py: la misma etiqueta aparece varias veces y `.first`/`.last`
    agarran la equivocada."""
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


def flecha_de(fr, nombre):
    """La flechita de expandir de una carpeta, POR NOMBRE. Nunca por posicion:
    `div:nth-child(11)` es lo que tumbo el ancla dos veces."""
    fs = fr.locator(".wrTrEi")
    for i in range(fs.count()):
        f = fs.nth(i)
        try:
            txt = f.locator("xpath=ancestor::*[self::div][1]").inner_text(timeout=1200)
        except Exception:
            continue
        if " ".join(txt.split()).strip().lower().startswith(nombre.lower()):
            return f
    return None


def exportar(fr, page, destino):
    """Espera el visor y baja el Excel. Copiado de asn_web_report.py."""
    arranque = time.time()
    texto = ""
    while time.time() - arranque < MINUTOS_VISOR * 60:
        time.sleep(8)
        try:
            texto = fr.locator("body").inner_text(timeout=15000)
        except Exception:
            continue
        if "Exportar" in texto and ("Página" in texto or "Pagina" in texto):
            break
        if "Sin datos" in texto:
            raise RuntimeError("Sin datos calificados: la fecha no filtro nada")
    else:
        raise RuntimeError("el visor no abrio en %d minutos" % MINUTOS_VISOR)

    paginas = "?"
    ls = [l.strip() for l in texto.splitlines() if l.strip()]
    for i, l in enumerate(ls):
        if l == "de" and i + 1 < len(ls):
            paginas = ls[i + 1]
            break
    po.log("   visor abierto en %.0f s (%s paginas)" % (time.time() - arranque, paginas))

    exp, ce = a_la_derecha(fr, "Exportar", x_min=1000)
    if exp is None:
        raise RuntimeError("no encuentro la etiqueta Exportar del visor")
    fx, fy = ce["x"] + 29, ce["y"] + 28
    po.log("   Exportar en (%.0f, %.0f) -> flechita en (%.0f, %.0f)"
           % (ce["x"], ce["y"], fx, fy))
    page.mouse.click(fx, fy)
    time.sleep(4)
    try:
        t2 = fr.locator("body").inner_text(timeout=10000)
    except Exception:
        t2 = ""
    if "Excel" not in t2 and "CSV" not in t2:
        po.log("   el menu no aparecio; pruebo el icono 17 px a la izquierda")
        page.mouse.click(fx - 17, fy)
        time.sleep(4)
        try:
            t2 = fr.locator("body").inner_text(timeout=10000)
        except Exception:
            t2 = ""
    if "Excel" not in t2 and "CSV" not in t2:
        raise RuntimeError("no se abrio el menu de exportacion")

    menu = fr.locator("[id^='wrExecuteExportTypeMenu']").last
    cand = None
    for etiqueta in ("Excel", "CSV"):          # Excel primero: con CSV no baja
        try:
            c = menu.get_by_text(etiqueta, exact=True).filter(visible=True).first
            if c.count() > 0:
                cand = (etiqueta, c)
                break
        except Exception:
            continue
    if cand is None:
        raise RuntimeError("no encuentro Excel ni CSV en el menu")
    etiqueta, boton = cand
    po.log("   formato %s; el servidor arma el archivo..." % etiqueta)
    inicio = time.time()
    with page.expect_download(timeout=MINUTOS_VISOR * 60000) as bajada:
        boton.click(force=True)
    archivo = bajada.value
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    archivo.save_as(destino)
    kb = os.path.getsize(destino) / 1024.0
    if kb < MINIMO_KB:
        raise RuntimeError("bajo con solo %.0f KB" % kb)
    po.log("   BAJADO: %.0f KB en %.1f min -> %s"
           % (kb, (time.time() - inicio) / 60.0, destino))
    return destino


def cancelar(fr):
    """CANCELAR, NUNCA GUARDAR: el reporte es de todos y no se toca."""
    try:
        can, _ = a_la_derecha(fr, "Cancelar", x_min=0)
        if can is not None:
            can.click(force=True, timeout=8000)
            time.sleep(6)
    except Exception:
        pass


def correr_uno(page, fr, clave, nombre, dia):
    po.log("")
    po.log("=" * 62)
    po.log("%s  ->  %s" % (clave.upper(), nombre))
    po.log("=" * 62)
    fr.get_by_text(nombre, exact=True).first.dblclick(timeout=20000)
    time.sleep(12)
    po.log("   disenador abierto (no se toca el diseno)")

    ej, _ = a_la_derecha(fr, "Ejecutar", x_min=0)
    if ej is None:
        raise RuntimeError("no encuentro Ejecutar")
    ej.click(force=True, timeout=12000)
    time.sleep(9)

    cajas = fr.locator("input[name*='ReportFilters']")
    vis = []
    for i in range(cajas.count()):
        c = cajas.nth(i)
        try:
            if c.is_visible():
                vis.append(c)
        except Exception:
            pass
    po.log("   cajas del filtro: %d" % len(vis))
    if len(vis) < 2:
        raise RuntimeError("no veo las dos cajas de fecha")
    # La fecha va en formato del WMS: DD/MM/AAAA con hora. `dia` llega DD-MM-AAAA.
    d = dia.replace('-', '/')
    for c, val in ((vis[0], d + ' 00:00:00'), (vis[1], d + ' 23:59:59')):
        c.fill(val, timeout=10000)      # SIN Escape: cierra el dialogo
        po.log("   <- %s" % val)
        time.sleep(1)

    ac, _ = a_la_derecha(fr, "Aceptar", x_min=0)
    if ac is None:
        raise RuntimeError("no encuentro Aceptar")
    ac.click(force=True, timeout=8000)
    time.sleep(8)
    po.log("   filtro aceptado; ejecutando...")

    ej, _ = a_la_derecha(fr, "Ejecutar", x_min=0)
    if ej is not None:
        ej.click(force=True, timeout=10000)
    corto = '-'.join(dia.split('-')[:2])      # DD-MM, como los demas archivos
    return exportar(fr, page, os.path.join(DESTINO, "%s_%s.xlsx" % (clave, corto)))


def bajar(dia, abrir_log=True):
    """Baja los dos web reports de ese dia. `dia` es DD-MM-AAAA.

    Devuelve {clave: ruta} con lo que si se pudo bajar. NO levanta excepcion si
    uno falla: el cruce con uno solo sigue sirviendo, y tumbarlo entero por eso
    seria cambiar medio reporte por ninguno.
    """
    if abrir_log:
        po.abrir_log()
    po.log("=" * 62)
    po.log("BAJANDO PRODUCCION POR HORA DEL %s  (sin tocar el diseno)" % dia)
    po.log("=" * 62)

    if not bloqueo_wms.esperar_turno(po.log, minutos_max=20, quien=QUIEN):
        po.log("El WMS esta ocupado; no se entra.", "WARN")
        return {}
    bloqueo_wms.tomar(QUIEN)
    bajados = {}
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(headless=True)
            ctx = nav.new_context(viewport={"width": 1920, "height": 1080},
                                  accept_downloads=True)
            page = ctx.new_page()
            page.on("dialog", lambda d: d.accept())
            page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            time.sleep(15)
            b = page.get_by_role("textbox", name="Select Screen Textbox")
            b.wait_for(state="visible", timeout=60000)
            b.click(); b.fill(""); b.type("web", delay=150)
            time.sleep(2)
            page.get_by_text("Web", exact=True).click()
            time.sleep(14)
            fr = page.locator("#reports_frame").content_frame \
                     .locator("#reports_frame").content_frame
            try:
                fr.locator(".wrTrEi").first.click(timeout=10000)
                time.sleep(3)
                f = flecha_de(fr, CARPETA)
                if f is None:
                    raise RuntimeError("no veo la carpeta %s" % CARPETA)
                f.click(timeout=10000)
                time.sleep(3)
                for clave, nombre in REPORTES:
                    try:
                        bajados[clave] = correr_uno(page, fr, clave, nombre, dia)
                    except Exception as e:
                        po.log("   %s FALLO: %s: %s"
                               % (clave, type(e).__name__, str(e)[:150]), "ERROR")
                    finally:
                        cancelar(fr)
                        try:
                            for et in ("Introducción", "Introduccion", "Informes"):
                                t2 = fr.get_by_text(et, exact=True)
                                if t2.count() and t2.first.is_visible():
                                    t2.first.click(timeout=6000)
                                    time.sleep(5)
                                    break
                        except Exception:
                            pass
            finally:
                po.log("")
                po.log("cerrando el arbol...")
                try:
                    for _ in range(10):
                        ab = fr.locator(".wrTrEiOpen")
                        v = [ab.nth(i) for i in range(ab.count()) if ab.nth(i).is_visible()]
                        if not v:
                            break
                        v[-1].click(timeout=6000)
                        time.sleep(1.2)
                    ab = fr.locator(".wrTrEiOpen")
                    q = sum(1 for i in range(ab.count()) if ab.nth(i).is_visible())
                    po.log("nodos abiertos al salir: %d" % q,
                           "INFO" if q == 0 else "ERROR")
                except Exception as e:
                    po.log("no pude cerrar el arbol: %s" % e, "WARN")
                ctx.close()
                nav.close()
    finally:
        bloqueo_wms.soltar()

    po.log("")
    po.log("=" * 62)
    for clave, _ in REPORTES:
        po.log("  %-10s %s" % (clave, bajados.get(clave, "NO SE BAJO")))
    po.log("candado liberado")
    return bajados


def main():
    """Suelto, para bajar un dia a mano:  python prodhora_web.py 31-08-2026"""
    dia = sys.argv[1] if len(sys.argv) > 1 else         __import__('datetime').datetime.now().strftime('%d-%m-%Y')
    bajados = bajar(dia)
    return 0 if len(bajados) == len(REPORTES) else 1


# SIN ESTE CANDADO, IMPORTAR EL ARCHIVO LO EJECUTA ENTERO. Paso el 01-sep-2026
# con asn_web_report.py: un import para reusar una funcion arranco la descarga de
# seis meses de ASN y dejo el WMS tomado antes del ancla de las 07:00.
if __name__ == "__main__":
    sys.exit(main())
