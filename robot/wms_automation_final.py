# -*- coding: utf-8 -*-
"""
Robot de extracción de Oracle WMS (Bata)
Descarga Stock Activo (CSV) y Stock Reserva (Excel) a OneDrive.

Cambios del 30-07-26, tras detectar que Stock Activo fallaba de forma intermitente:
  - La espera fija de 60 segundos se reemplaza por una espera real a que la grilla
    termine de cargar. Los días que Oracle va lento, el robot ahora espera en vez
    de dar por cargada una tabla que todavía estaba a medias.
  - Cada extracción se reintenta hasta 3 veces antes de rendirse.
  - Todo queda registrado en logs\\run_AAAA-MM-DD_HHMMSS.log
  - Ante cualquier falla se guarda una captura de pantalla del momento exacto.
  - Al terminar se verifica que los dos archivos existan y se avisa si falta alguno.
"""

import os
import io
import sys
import time
import subprocess
from datetime import datetime
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

WMS_USER = os.getenv("WMS_USER", "dames")
WMS_PASSWORD = os.getenv("WMS_PASSWORD", "")

def _base_onedrive():
    """
    La carpeta de OneDrive donde van los stocks. SE BUSCA, NO SE ESCRIBE A MANO.

    Es la MISMA función que usa generar_slotting.py. Si las dos se separan vuelve
    el problema que esto vino a resolver, porque uno escribe donde el otro lee.

    El 05-ago-2026 se arregló la ruta fija en generar_slotting.py, pero acá quedó
    apuntando a C:\\Users\\dames, que es la laptop. En el servidor el usuario es
    'Administrator', así que esa carpeta no existe... y como más abajo se crea con
    makedirs, el servidor se fabricaba una carpeta fantasma y dejaba ahí los dos
    stocks. Nadie los veía: no estaban en OneDrive, no se sincronizaban, y encima
    generar_slotting.py —que sí buscaba bien— leía la carpeta buena y armaba el
    reporte con el stock más viejo que encontrara. Del 05 al 07-ago-2026.

    Se prueban las candidatas en orden y se usa la primera que exista de verdad.
    """
    candidatas = [
        os.environ.get("OneDrive"),                          # lo que dice el propio Windows
        os.environ.get("OneDriveCommercial"),
        os.path.join(os.path.expanduser("~"), "OneDrive"),   # el usuario que esté corriendo
        r"C:\Users\Administrator\OneDrive",                  # el servidor
        r"C:\Users\dames\OneDrive",                          # la laptop
    ]
    for c in candidatas:
        if not c:
            continue
        ruta = os.path.join(c, "danielames.bata", "scraping Stock")
        if os.path.isdir(ruta):
            return ruta
    # Ninguna existe: se devuelve la del usuario actual para que el error diga dónde buscó.
    return os.path.join(os.path.expanduser("~"), "OneDrive", "danielames.bata", "scraping Stock")


BASE_ONEDRIVE = _base_onedrive()
ONEDRIVE_ACTIVO_PATH = os.path.join(BASE_ONEDRIVE, "Stock Activo")
ONEDRIVE_RESERVA_PATH = os.path.join(BASE_ONEDRIVE, "Stock Reserva")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = os.path.join(LOG_DIR, "run_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))

# Cuánto se le tolera a Oracle para devolver la data antes de rendirse
TIMEOUT_CARGA_SEG = 480      # 8 minutos
ESTABLE_SEG = 8              # la grilla debe quedarse quieta este tiempo para darla por cargada
INTENTOS = 3
ESPERA_ENTRE_INTENTOS = 180


# ─────────────────────────────── Registro ───────────────────────────────

def log(mensaje, nivel="INFO"):
    linea = "[%s] [%-5s] %s" % (datetime.now().strftime("%H:%M:%S"), nivel, mensaje)
    try:
        print(linea)
    except UnicodeEncodeError:
        print(linea.encode("ascii", "replace").decode("ascii"))
    try:
        with io.open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(linea + "\n")
    except Exception:
        pass


def captura(page, nombre):
    """Foto de la pantalla en el momento de la falla. Vale más que cualquier mensaje de error."""
    ruta = os.path.join(LOG_DIR, "%s_%s.png" % (datetime.now().strftime("%Y-%m-%d_%H%M%S"), nombre))
    try:
        page.screenshot(path=ruta, full_page=True)
        log("Captura de la falla guardada en: %s" % ruta, "WARN")
    except Exception as e:
        log("No se pudo tomar la captura: %s" % str(e)[:120], "WARN")


def con_reintentos(nombre, funcion, page, intentos=None):
    """Ejecuta la extracción y la reintenta si falla. Antes se rendía al primer error.

    `intentos` deja pedir más vueltas para una extracción concreta. El Stock Reserva
    pide ocho: ver el comentario de `descargar_stock_reserva`.
    """
    intentos = intentos or INTENTOS
    for intento in range(1, intentos + 1):
        log("%s - intento %d de %d" % (nombre, intento, intentos))
        try:
            if funcion():
                return True
            log("%s - el intento %d no completó la descarga" % (nombre, intento), "WARN")
        except Exception as e:
            log("%s - error en el intento %d: %s: %s" % (nombre, intento, type(e).__name__, str(e)[:200]), "ERROR")
            captura(page, "%s_intento%d" % (nombre.replace(" ", "_"), intento))

        if intento < intentos:
            log("%s - reintentando en %d segundos..." % (nombre, ESPERA_ENTRE_INTENTOS))
            time.sleep(ESPERA_ENTRE_INTENTOS)
            cerrar_pestanas(page)
    return False


def cerrar_pestanas(page, maximo=25):
    """
    Cierra TODAS las pestanas abiertas del WMS.

    Esta era la causa real de las fallas. Oracle WMS recuerda las pestanas abiertas
    entre sesiones y se fueron acumulando (llego a haber 9). Cada pestana deja su
    panel cargado en el DOM con sus propios botones Buscar y Borrar, asi que el
    .last del codigo viejo terminaba haciendo clic en el boton de una pestana
    OCULTA y se quedaba esperando hasta agotar el timeout.

    31-ago-2026: se juntaron 11 y se cayeron los OBLPN del 14, 16 y 17 al 23. El
    cierre se rendia al primer tropiezo. Cuando hay muchas, la barra se desplaza y
    el icono de un extremo queda FUERA DE LA VISTA: ese clic se agota, y el `break`
    viejo abandonaba las diez restantes. Ahora se prueba por los dos extremos, se
    corre la barra si ninguno responde, y recien se corta despues de tres vueltas
    sin cerrar nada.
    """
    cerradas = 0
    en_seco = 0
    for _ in range(maximo):
        iconos = page.locator(".tabCloseIcon")
        try:
            if iconos.count() == 0:
                break
        except Exception:
            break

        cerro = False
        # Los dos extremos: con la barra desplazada uno queda fuera de la vista,
        # pero el otro casi siempre esta a mano.
        for icono in (iconos.last, iconos.first):
            try:
                icono.click(force=True, timeout=2500)
                cerradas += 1
                cerro = True
                time.sleep(0.8)
                break
            except Exception:
                continue

        if cerro:
            en_seco = 0
            continue

        # Ninguno de los dos extremos respondio: se corre la barra y se reintenta.
        en_seco += 1
        if en_seco >= 3:
            break
        for flecha in ("Tablist Left Button", "Tablist Right Button"):
            try:
                page.get_by_role("button", name=flecha).click(timeout=2000)
                time.sleep(0.6)
                break
            except Exception:
                continue

    if cerradas:
        log("Pestanas del WMS cerradas: %d" % cerradas)
    return cerradas

def boton_visible(page, nombre, timeout=15000):
    """
    Devuelve el botón que está realmente a la vista.

    Con varias pestañas abiertas hay muchos botones con el mismo nombre en el DOM,
    uno por panel. Solo se puede hacer clic en el de la pestaña activa.
    """
    loc = page.get_by_role("button", name=nombre).filter(visible=True)
    loc.last.wait_for(state="visible", timeout=timeout)
    return loc.last


def esperar_datos(page, timeout_seg=TIMEOUT_CARGA_SEG, estable_seg=ESTABLE_SEG):
    """
    Reemplaza el viejo time.sleep(60).

    En vez de asumir que en un minuto Oracle terminó, cuenta las filas de la grilla
    hasta que el número deja de moverse. Si Oracle tarda 4 minutos, espera 4 minutos;
    si tarda 20 segundos, sigue de largo. Era la causa de las fallas intermitentes:
    los días de mayor carga el minuto fijo no alcanzaba y se exportaba una tabla
    todavía a medio cargar.
    """
    inicio = time.time()
    anterior = -1
    quieto_desde = None

    while time.time() - inicio < timeout_seg:
        try:
            filas = page.locator("tr").count()
        except Exception:
            filas = -1

        transcurrido = int(time.time() - inicio)

        if filas > 1 and filas == anterior:
            if quieto_desde is None:
                quieto_desde = time.time()
            elif time.time() - quieto_desde >= estable_seg:
                log("Data cargada: %d filas, estable tras %ds" % (filas, transcurrido))
                return True
        else:
            if filas != anterior and transcurrido > 0 and transcurrido % 30 < 3:
                log("Cargando... %d filas a los %ds" % (filas, transcurrido))
            quieto_desde = None

        anterior = filas
        time.sleep(2)

    log("Se agotaron los %ds esperando la data. Último conteo: %d filas" % (timeout_seg, anterior), "WARN")
    return False


# ──────────────────────────── Stock Activo (CSV) ────────────────────────────

def descargar_stock_activo(page, dest_path):
    log("=" * 58)
    log("STOCK ACTIVO (CSV)")
    log("=" * 58)

    # 1. Abrir el módulo desde el buscador global
    buscador = page.get_by_role("textbox", name="Select Screen Textbox")
    buscador.wait_for(state="visible", timeout=60000)
    buscador.click()
    buscador.fill("")
    buscador.type("Rep_Inventario Activo", delay=150)
    time.sleep(2)
    page.get_by_role("option", name="Rep_Inventario Activo").click(force=True)
    log("Módulo Rep_Inventario Activo abierto")

    # 2. Abrir el panel de filtros y lanzar la búsqueda.
    #    Siempre sobre elementos VISIBLES: los paneles de otras pestañas siguen en
    #    el DOM y el .last de antes clickeaba el botón de una pestaña oculta.
    log("Abriendo panel de filtros y ejecutando búsqueda...")
    page.locator("span").filter(has_text="●Buscar").filter(visible=True).last.click(timeout=15000)
    time.sleep(1)
    boton_visible(page, "Borrar").click(timeout=15000)
    time.sleep(1)
    boton_visible(page, "Buscar").click(timeout=15000)

    # 3. Esperar de verdad a que la data termine de cargar
    log("Esperando a que Oracle termine de cargar la grilla...")
    if not esperar_datos(page):
        captura(page, "activo_sin_datos")
        raise TimeoutError("La grilla no terminó de cargar dentro del tiempo permitido")

    # 4. Exportar a CSV, también sobre los botones visibles
    log("Exportando a CSV...")
    boton_visible(page, "Exportar").click(force=True)
    time.sleep(2)
    boton_visible(page, "Exportar a CSV").click(force=True)
    time.sleep(1)
    boton_visible(page, "Aceptar").click(force=True)

    log("Esperando que el servidor genere el archivo (hasta 15 minutos)...")
    with page.expect_download(timeout=900000) as download_info:
        time.sleep(1)
        page.get_by_role("link", name="Descargar").last.click(force=True, timeout=600000)

    log("Descarga detectada, guardando...")
    download = download_info.value
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    download.save_as(dest_path)

    # Un CSV de esta consulta ronda los 7 MB. Si baja mucho menos, algo salió mal.
    tam_mb = os.path.getsize(dest_path) / (1024.0 * 1024.0)
    if tam_mb < 1:
        log("El archivo bajó con solo %.2f MB, se esperaban unos 7 MB" % tam_mb, "ERROR")
        captura(page, "activo_archivo_chico")
        return False

    log("Stock Activo guardado: %.2f MB en %s" % (tam_mb, dest_path))
    cerrar_pestanas(page)
    return True


# ─────────────────────────── Stock Reserva (Excel) ───────────────────────────


def abrir_informe(fr, nombre, vueltas=30):
    """Abre un informe del árbol BUSCÁNDOLO POR SU NOMBRE.

    NO se navega por posición, y esto no es un detalle de estilo. El código
    viejo expandía el primer nodo y después el `div:nth-child(11)`, dando por
    sentado que el árbol siempre está igual. **No lo está**: alcanza con que
    alguien deje una carpeta desplegada para que el hijo número 11 sea otra
    cosa, ALDEAS no se abra y el informe no aparezca jamás.

    Eso tumbó el ancla de las 07:00 del 01-sep-2026 y el turno arrancó sin
    stock de reserva. Y el WMS recuerda las carpetas abiertas entre sesiones,
    así que el estropicio sobrevive al reinicio del robot.

    Acá se mira si el informe ya está a la vista; si no, se expande UNA carpeta
    y se vuelve a mirar, hasta encontrarlo. Da igual cómo esté el árbol y da
    igual si mañana agregan o quitan carpetas.
    """
    intentados = set()
    for vuelta in range(vueltas):
        try:
            obj = fr.get_by_text(nombre, exact=True)
            if obj.count() > 0:
                obj.first.click(timeout=10000)
                log("'%s' abierto en la vuelta %d" % (nombre, vuelta + 1))
                return True
        except Exception:
            pass

        # No está a la vista: se expande la próxima carpeta sin abrir.
        try:
            iconos = fr.locator(".wrTrEi")
            total = iconos.count()
        except Exception:
            return False
        abierta = False
        for i in range(total):
            if i in intentados:
                continue
            intentados.add(i)
            try:
                iconos.nth(i).click(force=True, timeout=4000)
                abierta = True
                break
            except Exception:
                continue
        if not abierta:
            break
        time.sleep(2)

    log("No aparecio '%s' despues de %d vueltas" % (nombre, vueltas), "ERROR")
    return False


def descargar_stock_reserva(page, dest_path):
    log("=" * 58)
    log("STOCK RESERVA (Excel)")
    log("=" * 58)

    buscador = page.get_by_role("textbox", name="Select Screen Textbox")
    buscador.wait_for(state="visible", timeout=60000)
    buscador.click()
    buscador.fill("")

    log("Abriendo el módulo Web...")
    buscador.type("web", delay=150)
    time.sleep(2)
    page.get_by_text("Web", exact=True).click()
    time.sleep(10)

    # Oracle Web Reports vive dentro de dos iframes anidados
    log("Entrando al sub-sistema de reportes...")
    report_iframe = page.locator("#reports_frame").content_frame.locator("#reports_frame").content_frame

    log("Buscando el informe en el árbol...")
    if not abrir_informe(report_iframe, "Reporte de Stock Reserva"):
        raise RuntimeError("no encontré 'Reporte de Stock Reserva' en el árbol de informes")
    time.sleep(5)

    log("Ejecutando el reporte (puede tardar más de 15 minutos)...")
    report_iframe.get_by_role("button").nth(5).click()
    time.sleep(30)

    # CUATRO MINUTOS, NO TREINTA. Cuando el informe sale, sale en UN MINUTO: medido
    # cuatro veces el 03 y el 04-sep -62 s, 61 s, 62 s y 58 s desde "Ejecutando" hasta
    # el archivo guardado-. Esperar treinta o cuarenta no lo hace aparecer: solo quema
    # el tiempo que servia para volver a intentar.
    #
    # El 04-sep el ancla gasto 1h25m en TRES intentos y se rindio sin el archivo. El
    # 03-sep el intento 1 tambien fallo -treinta minutos- y el 2 lo bajo en 81 segundos:
    # la unica diferencia entre las dos mananas fue que a una le alcanzo el turno.
    #
    # Con 4 minutos y ocho vueltas, en el mismo rato hay OCHO oportunidades en vez de
    # tres. Ver `con_reintentos(..., intentos=8)` mas abajo.
    log("Desplegando el menú de exportación...")
    flecha = report_iframe.locator(".wrHvButtonandArrowContainer.wrHvExportButton > .wrPopoverMenuButtonOpenArrow").first
    flecha.wait_for(state="visible", timeout=240000)
    flecha.click(force=True)
    time.sleep(2)

    # Hay varios elementos 'Excel' ocultos; solo sirve el visible del menú desplegable
    log("Exportando a Excel...")
    with page.expect_download(timeout=240000) as download_info:
        report_iframe.locator("[id^='wrExecuteExportTypeMenu']").get_by_text("Excel").filter(visible=True).first.click(force=True)

    download = download_info.value
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    download.save_as(dest_path)

    tam_mb = os.path.getsize(dest_path) / (1024.0 * 1024.0)
    if tam_mb < 0.1:
        log("El archivo bajó con solo %.2f MB, se esperaba cerca de 1 MB" % tam_mb, "ERROR")
        captura(page, "reserva_archivo_chico")
        return False

    log("Stock Reserva guardado: %.2f MB en %s" % (tam_mb, dest_path))
    return True


# ──────────────────────────────── Principal ────────────────────────────────

def _correr():
    os.makedirs(LOG_DIR, exist_ok=True)
    inicio = time.time()

    log("=" * 58)
    log("ROBOT ORACLE WMS - BATA")
    log("=" * 58)

    if not WMS_PASSWORD or WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta configurar WMS_PASSWORD en el archivo .env", "ERROR")
        return 1

    # La carpeta se BUSCA (ver _base_onedrive) y queda escrita en el log SIEMPRE, para
    # que mirando el log se sepa dónde quedaron los archivos sin tener que adivinar.
    #
    # Y si no existe, se corta acá. Más abajo makedirs la crearía igual y el robot
    # terminaría "bien", con los dos stocks guardados en una carpeta que nadie mira y
    # que no se sincroniza con nada. Es exactamente lo que pasó del 05 al 07-ago-2026:
    # tres días de corridas perfectas cuyos stocks no llegaron a ninguna parte.
    log("Los stocks van a: %s" % BASE_ONEDRIVE)
    if not os.path.isdir(BASE_ONEDRIVE):
        log("Esa carpeta de OneDrive NO EXISTE en esta máquina.", "ERROR")
        log("No se descarga nada: los archivos quedarían donde nadie los ve.", "ERROR")
        return 1

    # EL NOMBRE LLEVA LA HORA, no solo la fecha. Desde que el robot corre dos veces al
    # día —06:00 y 19:00— con solo la fecha la corrida de la noche escribía encima de la
    # de la mañana y quedaba una sola foto por día. Con la hora quedan las dos, y se
    # puede ver cuánto se movió el almacén durante el turno.
    #
    # El formato es "Stock Activo 06-08-26 1900.csv". Quien los lee busca por la FECHA y
    # se queda con el más reciente de ese día, así que los archivos viejos —los que no
    # tienen hora— se siguen encontrando igual.
    sello = datetime.now().strftime("%d-%m-%y %H%M")
    archivo_activo = os.path.join(ONEDRIVE_ACTIVO_PATH, "Stock Activo %s.csv" % sello)
    archivo_reserva = os.path.join(ONEDRIVE_RESERVA_PATH, "Stock Reserva %s.xlsx" % sello)

    ok_activo = False
    ok_reserva = False

    with sync_playwright() as p:
        log("Abriendo navegador en segundo plano...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        page.on("dialog", lambda dialog: dialog.accept())

        url = "https://a10.wms.ocs.oraclecloud.com/bata/index/"
        log("Navegando a %s" % url)
        page.goto(url)

        try:
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", WMS_USER)
            page.fill("input[name='password']", WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], input[value='Sign In']").first.click()
            log("Sesión iniciada como %s" % WMS_USER)
        except Exception as e:
            log("No se pudo iniciar sesión: %s" % str(e)[:200], "ERROR")
            captura(page, "login")
            browser.close()
            return 1

        log("Esperando a que cargue el dashboard...")
        time.sleep(15)

        # Arrancar SIEMPRE con el WMS limpio. Oracle recuerda las pestañas abiertas
        # entre sesiones y sus paneles quedan en el DOM interfiriendo con los clics.
        log("Cerrando pestañas que quedaron abiertas de sesiones anteriores...")
        cerrar_pestanas(page)

        ok_activo = con_reintentos("Stock Activo", lambda: descargar_stock_activo(page, archivo_activo), page)
        cerrar_pestanas(page)
        # OCHO VUELTAS PARA LA RESERVA, tres para el activo. El activo baja siempre
        # -es una pantalla del WMS y no depende del servidor de informes-; la reserva
        # va por Web Reports, que en la ventana de las 07:00 contesta o no contesta.
        ok_reserva = con_reintentos("Stock Reserva",
                                    lambda: descargar_stock_reserva(page, archivo_reserva),
                                    page, intentos=8)

        browser.close()

    # Verificación final: no alcanza con que el código no haya fallado, el archivo tiene que estar
    minutos = (time.time() - inicio) / 60.0
    log("=" * 58)
    log("RESUMEN DE LA CORRIDA (%.1f minutos)" % minutos)
    log("=" * 58)

    faltantes = []
    for etiqueta, ruta, ok in (("Stock Activo", archivo_activo, ok_activo),
                               ("Stock Reserva", archivo_reserva, ok_reserva)):
        existe = os.path.exists(ruta)
        if existe and ok:
            log("%-14s OK    %.2f MB" % (etiqueta, os.path.getsize(ruta) / (1024.0 * 1024.0)))
        else:
            log("%-14s FALTA %s" % (etiqueta, "el archivo no se generó" if not existe else "la descarga no se completó"), "ERROR")
            faltantes.append(etiqueta)

    if faltantes:
        log("Quedaron %d archivo(s) sin descargar: %s" % (len(faltantes), ", ".join(faltantes)), "ERROR")
        log("Revisá las capturas de pantalla en: %s" % LOG_DIR, "ERROR")
        log("Log completo: %s" % LOG_FILE, "ERROR")
        log("No se genera el reporte Slotting: faltan archivos de entrada", "ERROR")
        return 2

    log("Los dos archivos se descargaron correctamente")

    # Con los dos archivos en su lugar, se arma el reporte Slotting.
    # Va en un proceso aparte para que un problema de Excel no arrastre al robot.
    # Se le dicen los archivos EXACTOS que se acaban de bajar. Antes el generador los
    # buscaba solo, con la regla del "más reciente del día", y el 06-ago-2026 -cuando la
    # descarga de las 19:00 no dejó archivo- publicó el de las 08:23 como si fuera nuevo.
    ok_slotting = generar_slotting(archivo_activo, archivo_reserva)

    log("Log completo: %s" % LOG_FILE)
    return 0 if ok_slotting else 3


def generar_slotting(archivo_activo=None, archivo_reserva=None):
    """Lanza el generador del reporte Slotting y devuelve si salió bien.

    Se le pasan los archivos que ESTA corrida bajó, para que no tenga que buscarlos.
    """
    script = os.path.join(BASE_DIR, "generar_slotting.py")
    if not os.path.exists(script):
        log("No se encontró generar_slotting.py, se omite el reporte", "WARN")
        return False

    log("=" * 58)
    log("GENERANDO EL REPORTE SLOTTING")
    log("=" * 58)
    try:
        proc = subprocess.run(
            [sys.executable, "-u", script]
            + (["--activo=%s" % archivo_activo] if archivo_activo else [])
            + (["--reserva=%s" % archivo_reserva] if archivo_reserva else []),
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=2400,   # 40 minutos de margen
        )
        # Se replican sus líneas en el log del robot, para tener todo junto
        for linea in (proc.stdout or "").splitlines():
            if linea.strip():
                log("   " + linea.rstrip())
        if proc.returncode == 0:
            log("Reporte Slotting generado")
            return True
        log("El generador del Slotting terminó con código %d" % proc.returncode, "ERROR")
        for linea in (proc.stderr or "").splitlines()[-12:]:
            if linea.strip():
                log("   " + linea.rstrip(), "ERROR")
        return False
    except subprocess.TimeoutExpired:
        log("El generador del Slotting superó los 40 minutos y se canceló", "ERROR")
        return False
    except Exception as e:
        log("No se pudo ejecutar el generador: %s: %s" % (type(e).__name__, str(e)[:200]), "ERROR")
        return False


def run():
    """
    El robot de siempre, ahora avisando que está adentro.

    Desde el 12-ago-2026 hay un segundo robot —`stock_por_hora.py`— que entra a Oracle
    cada hora con el MISMO usuario. Oracle no admite dos sesiones a la vez: la segunda
    invalida a la primera, y la que estaba esperando su archivo se queda esperando uno
    que ya nadie va a generar.

    ESTE MANDA. Espera un rato a que el de la hora termine y, si no termina, entra
    igual: perder la corrida de las 19:00 es perder el stock del turno, y eso es mucho
    peor que un cruce. El de la hora, en cambio, se saltea y vuelve en 60 minutos.

    La marca se saca SIEMPRE, salga bien o mal. Si quedara puesta, el robot de la hora
    se saltearía las siguientes corridas hasta que el candado se venciera solo.
    """
    try:
        import bloqueo_wms
    except Exception as e:
        # Sin el módulo del candado el robot igual tiene que correr: lo peor que puede
        # pasar es un cruce, y no correr es peor que eso.
        log("No se pudo cargar bloqueo_wms (%s). Se sigue sin candado." % str(e)[:120], "WARN")
        return _correr()

    bloqueo_wms.esperar_turno(log, minutos_max=12, quien="robot principal")
    bloqueo_wms.tomar("robot principal")
    try:
        return _correr()
    finally:
        bloqueo_wms.soltar()


if __name__ == "__main__":
    sys.path.insert(0, BASE_DIR)
    try:
        sys.exit(run())
    except Exception as e:
        log("Error no controlado: %s: %s" % (type(e).__name__, str(e)[:300]), "ERROR")
        try:
            import bloqueo_wms
            bloqueo_wms.soltar()
        except Exception:
            pass
        sys.exit(1)

