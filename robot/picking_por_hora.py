# -*- coding: utf-8 -*-
"""
EL PICKING DE LA HORA  ·  el avance del día en curso
=====================================================

Cada hora baja el picking de HOY —de 00:00 hasta este momento—, lo hace calcular
y publica el resumen del día en `picking_dias`. Cada corrida pisa la anterior:
eso es el avance.

POR QUÉ EXISTE
--------------
El robot de las 08:00 (`picking_y_orden.py`) baja AYER completo, y esa foto ya no
se mueve. Pero durante el día no había forma de ver cómo va la jornada sin que
alguien bajara el archivo a mano y lo cargara en la pantalla. Daniel lo pidió así
el 13-ago-2026: *"necesito el Robot Picking Hora, eso es el avance"*.

EL CÁLCULO NO SE REESCRIBE: SE USA EL DE LA PLATAFORMA
------------------------------------------------------
Esta es la decisión que más importa de todo el archivo.

El cálculo del picking son 2.257 líneas de JavaScript que ya saben que la fila
`Cancelado` es una copia y no un quiebre, que hay que cruzar con el Maestro y
quedarse solo con Footwear, que el prepack se abre con la tabla de equivalencia,
y cómo se cuentan las horas de cada persona sobre su propia franja. Todas esas
reglas las validó Daniel a mano, una por una.

Reescribirlas en Python daría DOS cálculos que tienen que dar el mismo número, y
se van a separar. Ya se pagó ese precio el 05-ago-2026 con la misma lógica en dos
archivos: se arregló uno y el otro quedó mal semanas.

Así que el robot **abre el picking.js de producción y llama a la misma función que
llama la pantalla**:

    https://deam1830.com/js/reportes/picking.js  ->  procesarArchivoPicking()

Si mañana se corrige una regla ahí, el robot la toma solo. No hay copia que
mantener. El archivo no importa nada de nadie —son funciones sueltas— así que se
puede cargar sin abrir la aplicación y sin iniciar sesión en ningún lado.

Y para publicar se usa la misma puerta que ya usan los stocks: `subir_datos()`,
que postea directo a la API. El robot no necesita usuario ni contraseña de la
plataforma; nunca los necesitó.

LO QUE ESTE ROBOT **NO** HACE, Y ES A PROPÓSITO
-----------------------------------------------
  * **No deja archivos.** El CSV baja a una carpeta temporal y se borra al
    terminar. Un día completo son 7 MB; 24 corridas serían 170 MB diarios que
    nadie abre.
  * **No toca los días anteriores.** Escribe UNA sola clave por corrida.
  * **No baja el Detalle de Orden.** Ese va una vez al día.

CEDE EL PASO, NO ESPERA
-----------------------
Al revés que el robot de las 08:00. Aquel corre una sola vez al día: si cede, ese
día se pierde para siempre, así que espera y entra igual. Este vuelve en 60
minutos, así que si hay otro robot adentro se saltea la hora y no se pierde nada.
Oracle no admite dos sesiones del mismo usuario.

CÓMO SE USA
-----------
    python picking_por_hora.py
        Hoy, de 00:00 hasta ahora. Es lo que corre solo cada hora.

    python picking_por_hora.py --sin-publicar
        Baja y calcula, muestra los números y no escribe en la plataforma.

    python picking_por_hora.py --dia 12-08-2026
        Un día entero, de 00:00 a 23:59.

    python picking_por_hora.py --dias archivos
        RECARGA los días que estén en la carpeta Picking de OneDrive, uno por
        uno y en UNA sola sesión de Oracle. Es la forma de volver a cargar los
        18 días viejos CON la noche: están cortados de 08:00 a 20:00 y por eso
        el picking de catálogo web no aparece en ningún reporte.

    python picking_por_hora.py --dias 20-7,21-7,22-7
        Los días que se le pidan.
"""

import json
import os
import shutil
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

LOGS = os.path.join(AQUI, "logs")
DIAS_DE_LOG = 7

# El archivo de producción, no el de la carpeta de desarrollo. Se usa el que está
# publicado: es el mismo que corre la pantalla cuando Daniel carga un archivo.
URL_PICKING_JS = "https://deam1830.com/js/reportes/picking.js"
URL_SITIO = "https://deam1830.com/"

API = "https://logistics-backend-wv0x.onrender.com/api/logistics"
AREA_PICKING = "picking_dias"
AREA_MAESTRO = "articulos"

# El mismo tope que aplica la pantalla (csvHub_v6.js: PICKING_TOPE_DIAS).
TOPE_DIAS = 120

# CUÁNTO TIENE QUE PESAR EL CSV. Muy por debajo del piso del robot diario (500 KB)
# a propósito: a las 08:00 este robot pide cuatro horas de catálogo web, que son
# unos pocos cientos de líneas y unas decenas de KB. Igual no puede venir vacío,
# porque la descarga solo arranca cuando Oracle contestó con al menos una página.
MINIMO_KB = 20

# El Maestro completo tiene 29.783 filas. Si viene mucho menos, está cortado, y un
# Maestro cortado no rompe nada de forma visible: simplemente deja artículos sin
# categoría y el reporte da de menos sin avisar.
MINIMO_MAESTRO = 1000

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
    _LOG = os.path.join(LOGS, "pickinghora_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))
    corte = time.time() - DIAS_DE_LOG * 86400
    for f in os.listdir(LOGS):
        if f.startswith("pickinghora_") and f.endswith(".log"):
            p = os.path.join(LOGS, f)
            try:
                if os.path.getmtime(p) < corte:
                    os.remove(p)
            except OSError:
                pass


def argumento(nombre):
    """Lee `--nombre valor` o `--nombre=valor`."""
    for i, a in enumerate(sys.argv):
        if a.startswith("--%s=" % nombre):
            return a.split("=", 1)[1]
        if a == "--%s" % nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return None


def _fecha(texto):
    for formato in ("%d-%m-%Y", "%d/%m/%Y", "%d-%m", "%d/%m"):
        try:
            d = datetime.strptime(texto.strip(), formato)
            return d.replace(year=datetime.now().year) if d.year == 1900 else d
        except ValueError:
            continue
    raise SystemExit("No entendí la fecha '%s'. Se escribe asi: 12-08-2026" % texto)


def dias_a_bajar():
    """Qué días bajar y con qué franja horaria cada uno.

    La hora va sin cero adelante porque el campo de Oracle tiene formato H:mm:ss y
    muestra "0:00:00", no "00:00:00".
    """
    varios = argumento("dias")
    if varios:
        if varios.strip().lower() == "archivos":
            import wms_automation_final as wms
            carpeta = os.path.join(wms._base_onedrive(), "Picking")
            dias = []
            for nombre in sorted(os.listdir(carpeta)):
                if not (nombre.startswith("Picking ") and nombre.endswith(".csv")):
                    continue
                try:
                    dias.append(_fecha(nombre[len("Picking "):-len(".csv")]))
                except SystemExit:
                    log("No entendí el nombre '%s', se saltea" % nombre, "WARN")
        else:
            dias = [_fecha(x) for x in varios.split(",") if x.strip()]
        dias.sort()
        return [(d, "0:00:00", "23:59:59") for d in dias]

    pedido = argumento("dia")
    if pedido:
        return [(_fecha(pedido), "0:00:00", "23:59:59")]

    ahora = datetime.now()
    return [(ahora, "0:00:00", "%d:%02d:%02d" % (ahora.hour, ahora.minute, ahora.second))]


# ─────────── Esquivar las corridas que ya viven en el servidor ───────────
#
# ESTO SOLO HACE FALTA CUANDO SE RECARGAN VARIOS DÍAS DESDE LA LAPTOP. El candado
# de `bloqueo_wms` es un archivo dentro de la carpeta del robot, así que el de la
# laptop y el del servidor son dos archivos distintos en dos máquinas: ninguno ve
# al otro. Y Oracle no admite dos sesiones del mismo usuario —la segunda invalida
# a la primera y la que estaba descargando se queda esperando un archivo que ya
# nadie va a generar—.
#
# Una recarga de 18 días dura horas, así que atraviesa varias corridas del
# servidor. Se esquivan por reloj.
#
# NO SE BLOQUEA EL MINUTO :50 (el propio Picking por hora) a propósito: mientras
# se hace la recarga esa tarea todavía no está instalada, y bloquearlo costaría
# una hora entera de espera de más. No instalarla hasta que la recarga termine.

def ventana_ocupada(t):
    if 28 <= t.minute <= 42:
        return "el Stock por hora (minuto :30)"
    # SE BLOQUEAN LAS DOS HORAS DEL ANCLA DE LA MAÑANA, la vieja y la nueva.
    # El 13-ago-2026 Daniel la movió de las 06:00 a las 07:00, pero el cambio se
    # aplica en el servidor y desde acá no hay forma de saber si ya se hizo.
    # Bloquear una hora de más cuesta unos minutos de espera; equivocarse cuesta
    # la corrida más importante del día.
    if (t.hour == 5 and t.minute >= 58) or (t.hour == 6 and t.minute <= 35):
        return "el robot principal (ancla de las 06:00)"
    if (t.hour == 6 and t.minute >= 58) or (t.hour == 7 and t.minute <= 35):
        return "el robot principal (ancla de las 07:00)"
    if (t.hour == 7 and t.minute >= 58) or (t.hour == 8 and t.minute <= 25):
        return "el Picking y Detalle Orden de ayer (08:00)"
    if (t.hour == 18 and t.minute >= 58) or (t.hour == 19 and t.minute <= 35):
        return "el robot principal de las 19:00"
    return None


def esperar_ventana_libre(minutos=6):
    """Espera a que haya `minutos` limpios por delante antes de entrar a Oracle."""
    ultimo = None
    while True:
        ahora = datetime.now()
        razon = ventana_ocupada(ahora) or ventana_ocupada(ahora + timedelta(minutes=minutos))
        if not razon:
            return
        if razon != ultimo:
            log("Esperando: en los próximos %d minutos corre %s en el servidor"
                % (minutos, razon))
            ultimo = razon
        time.sleep(60)


# ─────────────────── Hablar con la plataforma ───────────────────

def leer_area(area, timeout=300):
    """Trae un área de datos. El servidor puede estar dormido y tardar en despertar."""
    url = "%s/%s?date=MASTER&t=%d" % (API, area, int(time.time()))
    pedido = urllib.request.Request(url, headers={"User-Agent": "robot-picking-hora"})
    with urllib.request.urlopen(pedido, timeout=timeout) as resp:
        j = json.loads(resp.read().decode("utf-8"))
    if isinstance(j, dict) and "data" in j:
        return j["data"]
    return j


# ─────────────────── El cálculo, con el código de la plataforma ───────────────────

CALCULAR_JS = """
async ([csv, urlModulo, urlMaestro, minimoMaestro]) => {
    // El MISMO archivo que corre la pantalla. No importa nada de nadie, así que
    // se puede cargar suelto, sin abrir la aplicación ni iniciar sesión.
    let mod;
    try {
        mod = await import(urlModulo);
    } catch (e) {
        return { error: 'No se pudo cargar picking.js: ' + (e && e.message ? e.message : e) };
    }
    if (typeof mod.procesarArchivoPicking !== 'function') {
        return { error: 'picking.js cargó pero no exporta procesarArchivoPicking' };
    }

    let maestro;
    try {
        const resp = await fetch(urlMaestro);
        if (!resp.ok) return { error: 'El Maestro respondió HTTP ' + resp.status };
        const json = await resp.json();
        maestro = (json && json.data) ? json.data : json;
    } catch (e) {
        return { error: 'No se pudo leer el Maestro: ' + (e && e.message ? e.message : e) };
    }
    if (!Array.isArray(maestro) || maestro.length < minimoMaestro) {
        return { error: 'El Maestro vino con ' + (Array.isArray(maestro) ? maestro.length : 0)
                        + ' filas; se esperaban mas de ' + minimoMaestro };
    }

    try {
        const r = mod.procesarArchivoPicking(csv, maestro);
        return { ok: r, filasMaestro: maestro.length };
    } catch (e) {
        return { error: 'El calculo fallo: ' + (e && e.message ? e.message : e) };
    }
}
"""


def calcular(page, ruta_csv):
    """Corre el cálculo de la plataforma sobre el CSV recién bajado."""
    with open(ruta_csv, encoding="utf-8-sig") as fh:
        csv = fh.read()
    log("Calculando con el picking.js de producción (%.2f MB de texto)..."
        % (len(csv) / (1024.0 * 1024.0)))

    page.goto(URL_SITIO, wait_until="domcontentloaded", timeout=120000)
    t0 = time.time()
    r = page.evaluate(CALCULAR_JS, [csv, URL_PICKING_JS,
                                    "%s/%s?date=MASTER" % (API, AREA_MAESTRO),
                                    MINIMO_MAESTRO])
    if not r or r.get("error"):
        raise RuntimeError((r or {}).get("error", "el cálculo no devolvió nada"))

    log("   listo en %.0f s · Maestro con %s artículos"
        % (time.time() - t0, format(r.get("filasMaestro", 0), ",d")))
    resumen = r["ok"]
    if resumen.get("error"):
        raise RuntimeError("procesarArchivoPicking: %s" % resumen["error"])
    if not resumen.get("dia"):
        raise RuntimeError("No se pudo deducir el día: la columna Hora de selección vino vacía")
    return resumen


def contar(resumen):
    """Las tres cifras que dicen si el resultado tiene sentido."""
    calzado = (resumen.get("seg") or {}).get("calzado") or {}
    return (resumen.get("filas_archivo", 0), resumen.get("filas_copia", 0),
            calzado.get("lineas", 0), calzado.get("pares", 0))


# ──────────────────────────── Sesión y publicación ────────────────────────────

def abrir_sesion(p, a_la_vista):
    """Abre el navegador y entra al WMS. Devuelve navegador, contexto y pestaña."""
    import wms_automation_final as wms
    navegador = p.chromium.launch(headless=not a_la_vista,
                                  slow_mo=300 if a_la_vista else 0)
    contexto = navegador.new_context(viewport={"width": 1920, "height": 1080})
    page = contexto.new_page()
    page.on("dialog", lambda d: d.accept())

    log("Entrando al WMS...")
    page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
    page.wait_for_selector("input[name='username']", timeout=20000)
    page.fill("input[name='username']", wms.WMS_USER)
    page.fill("input[name='password']", wms.WMS_PASSWORD)
    page.locator("button[type='submit'], input[type='submit'], "
                 "input[value='Sign In']").first.click()
    log("Sesión iniciada como %s" % wms.WMS_USER)
    time.sleep(15)
    return navegador, contexto, page


def publicar_dia(resumen):
    """Mete UN día en `picking_dias` y sube el bloque entero.

    SE VUELVE A LEER ANTES DE CADA PUBLICACIÓN, no se guarda una copia en memoria:
    la recarga de los días viejos dura horas, y en el medio Daniel puede cargar un
    archivo desde la pantalla. Con una copia vieja en memoria, ese trabajo se
    borraría sin que nadie se entere.
    """
    import generar_slotting as gs
    store = leer_area(AREA_PICKING) or {}
    if not isinstance(store, dict):
        log("%s devolvió algo que no es un objeto de días. NO se publica: "
            "escribir encima borraría el histórico." % AREA_PICKING, "ERROR")
        return False
    antes = len(store)
    ya_estaba = resumen["dia"] in store

    store[resumen["dia"]] = resumen
    dias = sorted(store.keys())
    if len(dias) > TOPE_DIAS:
        for viejo in dias[:len(dias) - TOPE_DIAS]:
            del store[viejo]

    log("Publicando %s (%s): %d días antes, %d después"
        % (resumen["dia"], "reemplaza" if ya_estaba else "nuevo", antes, len(store)))
    return gs.subir_datos(AREA_PICKING, store)


# ──────────────────────────────── La corrida ────────────────────────────────

def run():
    import bloqueo_wms
    import generar_slotting as gs
    import picking_y_orden as rd
    import wms_automation_final as wms
    from playwright.sync_api import sync_playwright

    abrir_log()
    wms.log = log
    rd.log = log
    gs.log = log
    t0 = time.time()

    lista = dias_a_bajar()
    sin_publicar = "--sin-publicar" in sys.argv
    a_la_vista = "--ver" in sys.argv
    recarga = len(lista) > 1

    log("=" * 58)
    if recarga:
        log("RECARGA DE %d DÍAS, con la noche incluida%s"
            % (len(lista), "  (NO PUBLICA)" if sin_publicar else ""))
        log("   %s" % ", ".join(d.strftime("%d-%m") for d, _, _ in lista))
    else:
        dia, desde, hasta = lista[0]
        log("PICKING DE LA HORA · %s · %s a %s%s"
            % (dia.strftime("%d-%m-%Y"), desde, hasta,
               "  (NO PUBLICA)" if sin_publicar else ""))
    log("=" * 58)

    # ESTE ROBOT CEDE. Vuelve en 60 minutos y no se pierde nada; el de las 08:00,
    # que corre una sola vez al día, es el que espera y entra igual.
    duenio = bloqueo_wms.quien_esta()
    if duenio:
        log("Hay otro robot adentro (%s, hace %.0f min). Se saltea esta hora."
            % (duenio["quien"], duenio["minutos"]), "WARN")
        log("No es un error: en 60 minutos se vuelve a intentar.")
        return 0
    bloqueo_wms.tomar("picking de la hora")

    if not wms.WMS_PASSWORD or wms.WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta WMS_PASSWORD en el .env", "ERROR")
        bloqueo_wms.soltar()
        return 1

    carpeta = tempfile.mkdtemp(prefix="picking_hora_")
    ruta_csv = os.path.join(carpeta, "picking.csv")
    hechos, fallados = [], []

    try:
        with sync_playwright() as p:
            navegador, contexto, page = abrir_sesion(p, a_la_vista)

            for n, (dia, desde, hasta) in enumerate(lista, 1):
                if recarga:
                    log("")
                    log("### DÍA %d de %d: %s" % (n, len(lista), dia.strftime("%d-%m-%Y")))
                    esperar_ventana_libre()

                # El candado vence a los 45 minutos y la recarga dura horas: se
                # refresca antes de cada día para que no quede libre a mitad.
                bloqueo_wms.tomar("picking de la hora")

                resumen = None
                for intento in (1, 2):
                    try:
                        # LA MISMA NAVEGACIÓN QUE EL ROBOT DE LAS 08:00. Las horas
                        # son parámetro justamente para esto: una sola copia.
                        if not wms.con_reintentos(
                                "Avance de Picking",
                                lambda: rd.descargar_picking(page, ruta_csv, dia,
                                                             desde, hasta,
                                                             minimo_kb=MINIMO_KB),
                                page):
                            raise RuntimeError("no se pudo bajar el picking")

                        # El cálculo va en OTRA pestaña: la del WMS queda como está.
                        hoja = contexto.new_page()
                        try:
                            resumen = calcular(hoja, ruta_csv)
                        finally:
                            hoja.close()

                        # CDCOPIA_PARA_PRODUCCION_PICKING
                        # SE GUARDA UNA COPIA DEL CSV, que si no se pierde: la
                        # carpeta es temporal y se borra al final. La lee
                        # `produccion_picking.py`, que arma el cuadro de Picking
                        # por dia detras de esta misma corrida.
                        #
                        # Va DESPUES de calcular: recien ahi se sabe que el
                        # archivo bajo entero. Y va a una carpeta propia y no a
                        # la de OneDrive, porque de esa este mismo robot relee
                        # todos los `Picking *.csv` en una recarga y le
                        # cambiaria lo que publica.
                        #
                        # Que falle la copia NO puede tumbar la corrida: lo que
                        # importa es el avance que ya se publico.
                        try:
                            import shutil as _sh
                            _dst = os.path.join('C:' + os.sep, 'wms_scraping',
                                                'logs', 'picking_hora')
                            os.makedirs(_dst, exist_ok=True)
                            _sh.copyfile(ruta_csv, os.path.join(
                                _dst, 'Picking %d-%d.csv' % (dia.day, dia.month)))
                        except Exception as _e:
                            log('no se pudo guardar la copia del CSV: %s' % _e, 'WARN')
                        break
                    except Exception as e:
                        log("%s: %s" % (type(e).__name__, str(e)[:200]), "ERROR")
                        if intento == 2:
                            break
                        # LA SESIÓN DE ORACLE SE VENCE. Una recarga de 18 días dura
                        # horas; si el primer intento falló, lo más probable es que
                        # la sesión ya no exista. Se entra de nuevo.
                        log("Se vuelve a entrar al WMS y se reintenta el día...", "WARN")
                        try:
                            navegador.close()
                        except Exception:
                            pass
                        navegador, contexto, page = abrir_sesion(p, a_la_vista)

                if not resumen:
                    fallados.append(dia.strftime("%d-%m-%Y"))
                    continue

                filas, copias, lineas, pares = contar(resumen)
                log("-" * 58)
                log("DÍA %s" % resumen["dia"])
                log("   filas del archivo : %s" % format(filas, ",d"))
                log("   copias descartadas: %s" % format(copias, ",d"))
                log("   líneas de calzado : %s" % format(lineas, ",d"))
                log("   PARES             : %s" % format(pares, ",d"))
                log("-" * 58)

                if sin_publicar:
                    log("MODO PRUEBA: no se publica nada")
                    hechos.append((resumen["dia"], filas, lineas, pares))
                    continue

                if publicar_dia(resumen):
                    hechos.append((resumen["dia"], filas, lineas, pares))
                else:
                    log("No se pudo publicar %s" % resumen["dia"], "ERROR")
                    fallados.append(dia.strftime("%d-%m-%Y"))

            try:
                navegador.close()
            except Exception:
                pass
    finally:
        bloqueo_wms.soltar()
        shutil.rmtree(carpeta, ignore_errors=True)

    log("=" * 58)
    if recarga:
        log("RECARGA TERMINADA en %.0f minutos · %d de %d días"
            % ((time.time() - t0) / 60.0, len(hechos), len(lista)))
        for d, f, l, pa in hechos:
            log("   %s   filas=%-8s líneas=%-8s pares=%s"
                % (d, format(f, ",d"), format(l, ",d"), format(pa, ",d")))
        if fallados:
            log("NO SALIERON: %s" % ", ".join(fallados), "ERROR")
            log("Se recuperan con:  python picking_por_hora.py --dias %s"
                % ",".join(fallados), "ERROR")
    else:
        log("LISTO en %.1f minutos" % ((time.time() - t0) / 60.0))
    log("=" * 58)
    return 0 if not fallados else 1


if __name__ == "__main__":
    sys.exit(run())
