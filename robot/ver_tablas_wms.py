# -*- coding: utf-8 -*-
"""MIRAR QUE TABLAS OFRECE EL DISENADOR DE INFORMES. NO GUARDA NADA.

Daniel, 04-sep-2026: *"entra al WMS y revisa"*.

PARA QUE. La columna que falta en el reporte de recepcion es *lo matriculado en el
buffer*, y las fotos de stock no alcanzan: el buffer rota mas rapido que las dos
del dia -el 70% de las matriculaciones las vio UNA sola foto-. Hace falta la tabla
de MOVIMIENTOS DE INVENTARIO, que registra cada matriculacion con su LPN,
ubicacion, usuario y hora.

PERO PRIMERO HAY QUE SABER COMO SE LLAMA. Automatizar el asistente entero para
descubrir a mitad de camino que la tabla no existe cuesta una edicion y una
bajada; mirar cuesta dos minutos.

QUE HACE, EXACTAMENTE
    1. entra al WMS y abre el modulo Web
    2. Create New Report -> Informe express -> paso Categorias
    3. escribe cada palabra en el buscador de tablas y anota lo que sale
    4. SALE SIN GUARDAR

NO TOCA NINGUN INFORME. No abre el arbol, no edita, no exporta. El asistente se
abandona con Cancelar, que es lo unico que garantiza no dejar un informe a medias.

**EL EDITOR CONSERVA LOS CAMBIOS AUNQUE NO SE GUARDE** -la trampa mas cara de las
diez anotadas- pero eso vale para EDITAR un informe existente. Aca se crea uno
nuevo y se abandona: no hay informe al que ensuciar.

TOMA EL CANDADO DEL WMS como cualquier otro robot. Si hay otro adentro, espera; si
no consigue turno, no entra. Entrar sin candado es lo que ya tumbo el ancla dos
veces.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, r"C:\wms_scraping")

if not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
    for _p in (os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "Administrator", "AppData", "Local", "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "dames", "AppData", "Local", "ms-playwright")):
        if _p and os.path.isdir(_p):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = _p
            break

import wms_automation_final as wms
import bloqueo_wms
from playwright.sync_api import sync_playwright

QUIEN = "ver_tablas"
PALABRAS = ["invent", "hist", "trans", "lpn", "locn", "activity", "move",
            "task", "putaway", "receiv"]


def log(t):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), t), flush=True)


def contar(fr, page, momento):
    """Deja una foto y una lista de lo que se puede apretar. Es lo unico que
    evita adivinar el nombre de un boton en una pantalla que no se ve."""
    try:
        page.screenshot(path=os.path.join(os.environ.get("TEMP", "."),
                                          "wms_%s.png" % momento))
    except Exception:
        pass
    log("--- lo que hay en pantalla (%s) ---" % momento)
    try:
        texto = fr.locator("body").inner_text()
        for l in [x.strip() for x in texto.splitlines() if x.strip()][:45]:
            log("    | %s" % l[:95])
    except Exception as e:
        log("    no se pudo leer el texto: %s" % type(e).__name__)
    for sel, como in (("button", "boton"), ("a", "enlace"),
                      ("[role=button]", "role=button")):
        try:
            loc = fr.locator(sel)
            n = min(loc.count(), 25)
            vistos = []
            for i in range(n):
                try:
                    t = (loc.nth(i).inner_text() or "").strip()
                    ti = loc.nth(i).get_attribute("title") or ""
                except Exception:
                    continue
                e = (t or ti).strip()
                if e and e not in vistos:
                    vistos.append(e[:34])
            log("    %s (%d): %s" % (como, loc.count(), " · ".join(vistos[:16])))
        except Exception:
            pass


def mirar(fr, page):
    contar(fr, page, "arbol")

    # El boton de crear puede estar en castellano o ser un icono. Se prueban los
    # nombres conocidos y, si ninguno esta, la foto y la lista de arriba dicen que
    # hay de verdad.
    abierto = False
    for etiqueta in ("Create New Report", "Crear informe nuevo", "Nuevo informe",
                     "Crear nuevo informe", "Nuevo", "Crear"):
        try:
            loc = fr.get_by_text(etiqueta, exact=False).first
            loc.wait_for(state="visible", timeout=4000)
            loc.click()
            log("abri con la etiqueta %r" % etiqueta)
            abierto = True
            break
        except Exception:
            continue
    if not abierto:
        log("NO ENCONTRE el boton de crear. Queda la foto wms_arbol.png")
        return
    time.sleep(4)
    contar(fr, page, "tipos")

    for etiqueta in ("Informe express", "Express Report", "Express"):
        try:
            loc = fr.get_by_text(etiqueta, exact=False).first
            loc.wait_for(state="visible", timeout=4000)
            loc.click()
            log("elegi %r" % etiqueta)
            break
        except Exception:
            continue
    time.sleep(4)
    contar(fr, page, "asistente")

    # ── paso Categorias ─────────────────────────────────────────────────────
    # El asistente arranca en Nombre; se pasa a Categorias con el paso de arriba.
    for etiqueta in ("Categorías", "Categorias", "Categories"):
        try:
            fr.get_by_text(etiqueta, exact=True).first.click()
            log("en el paso %s" % etiqueta)
            time.sleep(3)
            break
        except Exception:
            continue

    contar(fr, page, "categorias")

    caja = None
    for nombre in ("Buscar...", "Buscar", "Search..."):
        try:
            caja = fr.get_by_placeholder(nombre).first
            caja.wait_for(state="visible", timeout=5000)
            break
        except Exception:
            caja = None
    if caja is None:
        log("NO ENCONTRE la caja de buscar tablas; queda la foto para mirarla")
        return

    for palabra in PALABRAS:
        try:
            caja.fill("")
            caja.type(palabra, delay=60)
            time.sleep(2.5)
            filas = fr.locator(".wrTrNodeTextHighlightContainer, .wrListItem, li, tr")
            vistos, n = [], min(filas.count(), 200)
            for i in range(n):
                try:
                    t = (filas.nth(i).inner_text() or "").strip()
                except Exception:
                    continue
                if t and len(t) < 60 and palabra.lower() in t.lower() and t not in vistos:
                    vistos.append(t)
            log("  %-10s -> %s" % (palabra, ", ".join(vistos[:14]) if vistos else "(nada)"))
        except Exception as e:
            log("  %-10s -> fallo: %s" % (palabra, type(e).__name__))


def main():
    if not bloqueo_wms.esperar_turno(log, minutos_max=15, quien=QUIEN):
        log("el WMS esta ocupado por otro robot; NO se entra")
        return 1
    bloqueo_wms.tomar(QUIEN)
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(headless=True)
            ctx = nav.new_context(viewport={"width": 1920, "height": 1080})
            page = ctx.new_page()
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
                mirar(fr, page)
            finally:
                # SIEMPRE SE CIERRA EL NAVEGADOR, salga como salga. Una sesion
                # abierta deja pestanas colgadas y las pestanas del WMS rompen a
                # los robots que vienen despues.
                try:
                    ctx.close(); nav.close()
                except Exception:
                    pass
        return 0
    finally:
        bloqueo_wms.soltar()
        log("candado del WMS soltado")


if __name__ == "__main__":
    sys.exit(main())
