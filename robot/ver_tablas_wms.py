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
# Lo que puede llamarse un informe de movimientos de inventario, en los dos
# idiomas: el arbol mezcla nombres en castellano y en ingles.
PALABRAS = ["invent", "hist", "movim", "lpn", "ubicac", "almacen", "buffer",
            "recep", "putaway", "transac", "kardex", "traza"]


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


def apretar(fr, nombres, que, espera=4):
    """Aprieta el primero de esos nombres que exista, probando tres formas.

    POR ROL PRIMERO: en esta pantalla los botones llevan el texto adentro de un
    <span> anidado y `get_by_text` no los ve, aunque la lista de botones los
    muestre. Costo dos corridas descubrirlo.
    """
    for nombre in nombres:
        for como, hacer in (
                ("rol", lambda n=nombre: fr.get_by_role("button", name=n, exact=False).first),
                ("boton con texto", lambda n=nombre: fr.locator("button").filter(has_text=n).first),
                ("texto", lambda n=nombre: fr.get_by_text(n, exact=False).first)):
            try:
                loc = hacer()
                loc.wait_for(state="visible", timeout=3500)
                loc.click()
                log("%s: apretado %r (por %s)" % (que, nombre, como))
                time.sleep(espera)
                return True
            except Exception:
                continue
    log("%s: NO ENCONTRE ninguno de %s" % (que, nombres))
    return False


def mirar(fr, page):
    """Lista los informes que ya existen. NO abre ningun asistente."""
    contar(fr, page, "arbol")

    caja = None
    for nombre in ("Buscar...", "Buscar", "Search...", "Search"):
        try:
            caja = fr.get_by_placeholder(nombre).first
            caja.wait_for(state="visible", timeout=4000)
            log("caja de busqueda: %r" % nombre)
            break
        except Exception:
            caja = None
    if caja is None:
        log("NO ENCONTRE la caja de buscar; queda la foto wms_arbol.png")
        return

    log("")
    log("=== INFORMES QUE YA EXISTEN, por palabra ===")
    for palabra in PALABRAS:
        try:
            caja.fill("")
            time.sleep(0.6)
            caja.type(palabra, delay=50)
            time.sleep(2.2)
            filas = fr.locator(".wrTrNodeTextHighlightContainer, .wrListItem, li, tr")
            vistos, n = [], min(filas.count(), 250)
            for k in range(n):
                try:
                    t = (filas.nth(k).inner_text() or "").strip()
                except Exception:
                    continue
                if t and len(t) < 70 and palabra.lower() in t.lower() and t not in vistos:
                    vistos.append(t)
            log("  %-12s %s" % (palabra, " · ".join(vistos[:16]) if vistos else "(nada)"))
        except Exception as e:
            log("  %-12s fallo: %s" % (palabra, type(e).__name__))
    for nombre in CANDIDATOS:
        try:
            espiar_informe(fr, page, nombre)
        except Exception as e:
            log("   %s fallo: %s" % (nombre, type(e).__name__))
    try:
        caja.fill("")
        log("")
        log("caja de busqueda limpiada: el arbol queda como estaba")
    except Exception:
        pass


CANDIDATOS = ["ALMACENAMIENTO DETALLE X ARTICULO", "Movimiento X Usuario",
              "History Rf_alm"]


def espiar_informe(fr, page, nombre):
    """Ejecuta un informe y lee sus encabezados. NO lo edita."""
    log("")
    log("=== %s ===" % nombre)
    caja = None
    for n in ("Buscar", "Buscar...", "Search"):
        try:
            caja = fr.get_by_placeholder(n).first
            caja.wait_for(state="visible", timeout=4000)
            break
        except Exception:
            caja = None
    if caja is None:
        log("   no encuentro la caja de busqueda")
        return
    caja.fill("")
    time.sleep(0.5)
    caja.type(nombre[:26], delay=40)
    time.sleep(2.5)
    try:
        fila = fr.get_by_text(nombre, exact=False).first
        fila.wait_for(state="visible", timeout=6000)
        fila.click()
        time.sleep(1.5)
    except Exception:
        log("   no aparecio en el arbol")
        return

    # LOS TRES ICONOS DE LA DERECHA NO TIENEN TEXTO, asi que buscarlos por nombre
    # no sirve -tres corridas lo confirmaron-. Se listan con su clase, su title y
    # su posicion; con eso se los aprieta despues sin adivinar.
    log("   --- lo que tiene la fila seleccionada ---")
    try:
        iconos = fr.locator("i, svg, span[class*=icon], span[class*=Icon], "
                            "[class*=wrTrNodeIcon], [class*=wrIcon]")
        n = min(iconos.count(), 40)
        for k in range(n):
            e = iconos.nth(k)
            try:
                if not e.is_visible():
                    continue
                caja = e.bounding_box() or {}
                if caja.get("x", 0) < 150:
                    continue          # los de la izquierda son del arbol
                log("      clase=%-34s title=%-18s x=%.0f y=%.0f"
                    % ((e.get_attribute("class") or "")[:34],
                       (e.get_attribute("title") or e.get_attribute("aria-label") or "")[:18],
                       caja.get("x", 0), caja.get("y", 0)))
            except Exception:
                continue
    except Exception as e:
        log("      no se pudieron listar: %s" % type(e).__name__)
    return
    try:
        page.screenshot(path=os.path.join(os.environ.get("TEMP", "."),
                                          "wms_%s.png" % nombre[:14].replace(" ", "_")))
    except Exception:
        pass
    try:
        filas = fr.locator("table tr")
        for k in range(min(filas.count(), 4)):
            t = (filas.nth(k).inner_text() or "").strip().replace(chr(10), " | ")
            if t:
                log("   fila %d: %s" % (k, t[:250]))
    except Exception as e:
        log("   no se pudo leer la tabla: %s" % type(e).__name__)
    apretar(fr, ("Cerrar", "Close", "Cancelar"), "cerrar el visor", espera=3)


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
