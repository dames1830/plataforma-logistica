# -*- coding: utf-8 -*-
"""
EL STOCK DE LA HORA — el robot liviano.

Baja Stock Activo y Stock Reserva de Oracle WMS y los publica en un cajón APARTE,
para que los reportes muestren el avance del turno sin mover la foto del arranque.

═══════════════════════════════════════════════════════════════════════════════
POR QUÉ EXISTE
═══════════════════════════════════════════════════════════════════════════════

El robot de siempre corre a las 06:00 y a las 19:00 y publica el stock en
`almacenaje_activo` y `analisis_sku_reserva`. ESA foto es la del turno y no se
puede mover: sobre ella se calculan el Replenishment, la Zona Buffer, las tareas
de almacenaje y la meta de Limpieza del Buffer C. Si se moviera durante la noche,
cada pantalla daría un número distinto según a qué hora la abrieron, y la meta del
Buffer C se recalcularía sola contra el avance del propio turno.

Pero entonces, entre las 19:00 y las 06:00, no hay forma de ver cuánto se avanzó.
Daniel lo planteó así el 12-ago-2026: *"si mi jefe me pide a las once de la noche
un reporte, ¿qué hago?"*. Con un solo stock la respuesta era esperar hasta la
mañana.

Este robot resuelve eso sin tocar nada de lo anterior: publica los mismos dos
stocks en DOS ÁREAS NUEVAS que solo leen los reportes de avance.

═══════════════════════════════════════════════════════════════════════════════
LO QUE ESTE ROBOT **NO** HACE, Y ES A PROPÓSITO
═══════════════════════════════════════════════════════════════════════════════

  * **No toca `almacenaje_activo` ni `analisis_sku_reserva`.** Son la foto del turno.
  * **No arma el Slotting.** Eso necesita Excel de verdad (COM) y son 3,4 minutos más
    por corrida; 24 veces al día sería tener Excel abriéndose todo el día en el
    servidor sin que nadie use el resultado.
  * **No deja archivos en OneDrive.** Serían 8 MB × 24 corridas = 192 MB por día,
    unos 35 GB al año de archivos que nadie va a abrir. Los stocks bajan a una
    carpeta temporal y se borran al terminar. En OneDrive siguen quedando los de
    las 06:00 y las 19:00, como hasta ahora.
  * **No sube nada a Descargas**, ni actualiza la tabla de tallas, ni la evolución
    del artículo. Todo eso lo sigue haciendo la corrida principal, una vez al día.

Resultado: unos 8 minutos de cada hora, sin Excel y sin escribir en disco.

═══════════════════════════════════════════════════════════════════════════════
EL NOMBRE DEL ÁREA DEL ACTIVO ES HISTÓRICO, Y NO SE PUEDE CAMBIAR A LA LIGERA
═══════════════════════════════════════════════════════════════════════════════

`layout_stock_hora` se creó para el mapa de calor del Slotting, que necesitaba lo
mismo que necesitamos ahora y hasta hoy se cargaba A MANO desde la pantalla. Se
reutiliza tal cual por dos razones: el mapa empieza a llenarse solo sin cambiarle
una línea, y el nombre ya está elegido para esquivar dos reglas de la plataforma
(`csvHub_v6.js`):

  * si estuviera en `AREA_CANONICA` se repartiría a `buffer_activo`, `inventario_activo`
    y compañía, y volvería a mover justo lo que se quiso dejar quieto;
  * si terminara en `_activo` o `_reserva`, cada lectura dispararía `updateTablaTallas()`.

Por eso la reserva se llama `reserva_hora` y no `stock_hora_reserva`.
"""

import io
import os
import shutil
import sys
import tempfile
import time
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = os.path.join(LOG_DIR, "hora_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))

# Las dos áreas de la hora. Ver la explicación del nombre arriba.
AREA_ACTIVO_HORA = "layout_stock_hora"
AREA_RESERVA_HORA = "reserva_hora"

# PISO DE CORDURA. Un export de Oracle que sale a medias trae un archivo válido pero
# casi vacío, y publicarlo dejaría el mapa de calor y el reporte del turno en blanco
# sin ningún error a la vista. Los números reales son ~31.700 filas de activo y
# ~17.800 de reserva; por debajo de esto, algo se rompió del lado de Oracle.
MINIMO_ACTIVO = 5000
MINIMO_RESERVA = 1000

# ── ESTE ROBOT CORRE LAS 24 HORAS, TAMBIÉN A LAS DEL ANCLA ───────────────────
#
# Se pensó saltear las 19:00 y las 06:00 —a esas horas corre el principal y su
# corrida YA deja el cajón de la hora al día, publicando las mismas filas que acaba
# de leer sin bajar nada extra— pero se descartó por dos razones:
#
#   1. LA JORNADA CIERRA A LAS 06:30. La tarea dispara al minuto 30, así que la
#      corrida de las 06:30 es JUSTO la lectura del cierre del turno. Saltear esa
#      hora perdería la última media hora de trabajo de la noche.
#   2. Un caso especial en un robot que corre solo es donde después aparecen los
#      problemas. Lo que ahorraba eran dos entradas a Oracle de 24.
#
# El cruce con el principal ya lo cubre el candado (ver bloqueo_wms.py): si el
# grande está adentro, este se saltea esa hora y vuelve a la siguiente.

# Los logs y las capturas de falla se acumulan: 24 corridas por día contra 2 que
# había antes. Se borra lo que pase de esto.
DIAS_DE_LOG = 7


# ─────────────────────────────── Registro ───────────────────────────────

# CUANTO PUEDE DURAR UNA CORRIDA. Ver reloj_muerto.py: pasado esto se corta sola,
# suelta el candado y lo deja escrito. Una corrida sana son unos 9 minutos.
MINUTOS_MAXIMOS = 40


def log(mensaje, nivel="INFO"):
    linea = "[%s] [%-5s] %s" % (datetime.now().strftime("%H:%M:%S"), nivel, mensaje)
    try:
        print(linea)
    except UnicodeEncodeError:
        print(linea.encode("ascii", "replace").decode("ascii"))
    try:
        with io.open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(linea + "\n")
    except Exception:
        pass


def limpiar_logs_viejos():
    """
    Borra los logs y las capturas de más de DIAS_DE_LOG días.

    Se toca SOLO lo que empieza por 'hora_' y las capturas .png. Los logs del robot
    principal (run_*.log, slotting_*.log) son dos por día y quedan: si una noche algo
    salió mal, ese es el archivo que se va a querer leer una semana después.
    """
    try:
        limite = time.time() - DIAS_DE_LOG * 86400
        borrados = 0
        for nombre in os.listdir(LOG_DIR):
            if not (nombre.startswith("hora_") or nombre.endswith(".png")):
                continue
            ruta = os.path.join(LOG_DIR, nombre)
            try:
                if os.path.isfile(ruta) and os.path.getmtime(ruta) < limite:
                    os.remove(ruta)
                    borrados += 1
            except Exception:
                pass
        if borrados:
            log("Limpieza: %d archivo(s) de log de más de %d días" % (borrados, DIAS_DE_LOG))
    except Exception as e:
        log("No se pudo limpiar la carpeta de logs: %s" % str(e)[:120], "WARN")


# ─────────────────────── El trabajo, paso por paso ───────────────────────

def bajar_los_dos(carpeta):
    """
    Baja los dos stocks a la carpeta temporal. Devuelve (ruta_activo, ruta_reserva),
    con None en el que no haya bajado.

    Reusa las funciones del robot de siempre —login, cierre de pestañas, reintentos,
    capturas de pantalla—. NO se copian acá: el 05-ago-2026 ya se pagó el precio de
    tener la misma lógica escrita en dos archivos, cuando uno se arregló y el otro no.
    Lo único que se cambia es a dónde escribe el log, para que una corrida quede
    entera en un solo archivo.
    """
    import wms_automation_final as wms
    from playwright.sync_api import sync_playwright

    wms.log = log  # todo el registro de la descarga cae en el log de esta corrida

    sello = datetime.now().strftime("%d-%m-%y %H%M")
    ruta_act = os.path.join(carpeta, "Stock Activo %s.csv" % sello)
    ruta_res = os.path.join(carpeta, "Stock Reserva %s.xlsx" % sello)

    if not wms.WMS_PASSWORD or wms.WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta configurar WMS_PASSWORD en el archivo .env", "ERROR")
        return None, None

    ok_act = ok_res = False
    with sync_playwright() as p:
        log("Abriendo navegador en segundo plano...")
        navegador = p.chromium.launch(headless=True)
        contexto = navegador.new_context(viewport={"width": 1920, "height": 1080})
        page = contexto.new_page()
        page.on("dialog", lambda d: d.accept())

        url = "https://a10.wms.ocs.oraclecloud.com/bata/index/"
        log("Entrando a %s" % url)
        page.goto(url)
        try:
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], input[value='Sign In']").first.click()
            log("Sesión iniciada como %s" % wms.WMS_USER)
        except Exception as e:
            log("No se pudo iniciar sesión: %s" % str(e)[:200], "ERROR")
            wms.captura(page, "hora_login")
            navegador.close()
            return None, None

        time.sleep(15)
        # Oracle recuerda las pestañas abiertas entre sesiones y sus paneles se quedan
        # en el DOM interfiriendo con los clics de la siguiente corrida.
        wms.cerrar_pestanas(page)

        ok_act = wms.con_reintentos("Stock Activo", lambda: wms.descargar_stock_activo(page, ruta_act), page)
        wms.cerrar_pestanas(page)
        ok_res = wms.con_reintentos("Stock Reserva", lambda: wms.descargar_stock_reserva(page, ruta_res), page)

        navegador.close()

    return (ruta_act if (ok_act and os.path.exists(ruta_act)) else None,
            ruta_res if (ok_res and os.path.exists(ruta_res)) else None)


def publicar(ruta_act, ruta_res):
    """
    Deja los dos stocks en las áreas de la hora. Devuelve cuántos se publicaron.

    Se leen con las MISMAS funciones que usa la corrida principal, así las seis
    columnas del activo y las ocho de la reserva salen idénticas. Ese orden es un
    contrato: hay código de la plataforma que lee la columna 1 y la 2 POR POSICIÓN,
    y moverlas rompe la talla en silencio.
    """
    import generar_slotting as gs
    gs.log = log

    publicados = 0

    if ruta_act:
        filas = gs.datos_activo_web(ruta_act)
        if len(filas) < MINIMO_ACTIVO:
            log("El Stock Activo trajo solo %s filas (se esperaban más de %s). NO se publica: "
                "un export a medias dejaría el mapa y el reporte del turno en blanco."
                % (format(len(filas), ",d"), format(MINIMO_ACTIVO, ",d")), "ERROR")
        elif gs.subir_datos(AREA_ACTIVO_HORA, filas):
            publicados += 1

    if ruta_res:
        filas = gs.datos_reserva_web(ruta_res)
        if len(filas) < MINIMO_RESERVA:
            log("El Stock Reserva trajo solo %s filas (se esperaban más de %s). NO se publica."
                % (format(len(filas), ",d"), format(MINIMO_RESERVA, ",d")), "ERROR")
        elif gs.subir_datos(AREA_RESERVA_HORA, filas):
            publicados += 1

    return publicados


# ── EL CIERRE DE LA JORNADA ──────────────────────────────────────────────────
#
# El turno cierra a las 06:30. La corrida de esa hora es la ÚLTIMA lectura de la
# noche, y hay que congelarla: si no, el avance de esa jornada se pierde.
#
# Y se pierde de verdad. El cajón de la hora va con MASTER —cada corrida pisa a la
# anterior— así que a las 08:30 ya es otra foto. El reporte, a propósito, no mide una
# jornada pasada contra el stock de ahora: seria comparar el arranque de anoche con
# el almacén de esta tarde y dar un número inventado. Resultado: a las 06:30 los tres
# avances de la noche volvían a cero, con las metas ahí puestas.
#
# Lo encontró Daniel el 12-ago-2026 a las 06:47: *"¿qué pasa con el avance? Bajó el
# stock de las 6 am, se supone que tiene que validar lo que falta"*.
#
# Se guardan TRES fotos con la fecha de la jornada que termina, y con eso el reporte
# de cualquier día pasado se calcula igual que en vivo:
#
#   buffer_c_cierre   el Buffer C al cerrar      ~2,7 KB
#   reserva_cierre    las paletas altas al cerrar ~40 KB
#   activo_cierre     el stock activo, PERO SOLO de los códigos que pidió el análisis
#                     de esa noche —unos 130— y no de los 18.500 que hay. Se leen del
#                     área `plan_buffer`, que la pantalla ya publica.  ~3 KB
#
# Unos 45 KB por noche, 16 MB al año. Guardar el activo entero serían 135 MB.
HORA_CIERRE = 6
MINUTO_CIERRE = 30


def es_la_corrida_del_cierre():
    """
    ¿Esta corrida es la que cierra la jornada?

    La tarea dispara al minuto 30 de cada hora, así que la del cierre es la de las
    06:30. Se compara con >= para que un arranque tardío —06:34, 06:41— siga contando
    como el cierre, pero sin pasarse de la hora: la de las 07:30 ya no.
    """
    ahora = datetime.now()
    return ahora.hour == HORA_CIERRE and ahora.minute >= MINUTO_CIERRE


def guardar_cierre(ruta_act, ruta_res):
    """Congela la última lectura de la jornada que termina. Devuelve si salió bien."""
    import generar_slotting as gs
    gs.log = log

    if not (ruta_act and ruta_res):
        log("Falta uno de los dos stocks: el cierre de la jornada no se guarda", "WARN")
        return False

    # La jornada que cierra es la de AYER: empezó a las 19:00 del día anterior.
    jornada = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    log("=" * 58)
    log("CIERRE DE LA JORNADA %s" % jornada)
    log("=" * 58)

    act = gs.datos_activo_web(ruta_act)
    res = gs.datos_reserva_web(ruta_res)
    ok = True

    # 1. El Buffer C
    foto = gs.foto_buffer_c(act)
    foto["fecha"] = jornada
    log("Buffer C al cerrar: %s pares en %s artículos"
        % (format(foto["pares"], ",d"), format(foto["articulos"], ",d")))
    ok = gs.subir_datos("buffer_c_cierre", foto, fecha=jornada) and ok

    # 2. Las paletas altas
    pal = gs.foto_reserva(res)
    pal["fecha"] = jornada
    log("Paletas altas al cerrar: %s" % format(pal["paletas"], ",d"))
    ok = gs.subir_datos("reserva_cierre", pal, fecha=jornada) and ok

    # 3. El activo, solo de los códigos del plan de esa noche
    try:
        plan = gs.bajar_area("plan_buffer", jornada) or {}
        codigos = plan.get("codigos") if isinstance(plan, dict) else None
        skus = set(str((c or {}).get("sku") or "").strip() for c in (codigos or []))
        skus.discard("")
        if skus:
            por_sku = {}
            for f in act:
                a = (f.get("Artículo") or "").strip()
                if a not in skus:
                    continue
                try:
                    por_sku[a] = por_sku.get(a, 0) + float(str(f.get("Cantidad actual") or 0).replace(",", ""))
                except ValueError:
                    pass
            cierre = {"fecha": jornada, "hora": datetime.now().strftime("%H:%M"),
                      "detalle": {k: int(round(v)) for k, v in por_sku.items()}}
            log("Activo al cerrar: %s de los %s códigos del plan"
                % (format(len(por_sku), ",d"), format(len(skus), ",d")))
            ok = gs.subir_datos("activo_cierre", cierre, fecha=jornada) and ok
        else:
            log("Esa jornada no tiene plan del buffer guardado: no hay códigos que "
                "congelar para la Separación", "WARN")
    except Exception as e:
        log("No se pudo congelar el activo del cierre: %s: %s"
            % (type(e).__name__, str(e)[:150]), "WARN")
        ok = False

    return ok


def run():
    import bloqueo_wms
    import reloj_muerto

    os.makedirs(LOG_DIR, exist_ok=True)
    inicio = time.time()

    log("=" * 58)
    log("STOCK DE LA HORA - BATA")
    log("=" * 58)

    # ── SE CEDE EL PASO AL ROBOT PRINCIPAL ────────────────────────────────
    # Los dos entran a Oracle con el mismo usuario y la segunda sesión invalida a la
    # primera. Si el grande está adentro, esta hora se saltea y en 60 minutos se
    # vuelve a intentar: no se pierde nada. Al revés no —perder la corrida de las
    # 19:00 sería perder el stock del turno—.
    duenio = bloqueo_wms.quien_esta()
    if duenio:
        log("El robot principal está corriendo (%s, hace %.0f min). Esta hora se saltea."
            % (duenio["quien"], duenio["minutos"]))
        log("No es un error: en la próxima hora se vuelve a intentar.")
        return 0

    bloqueo_wms.tomar("stock por hora")

    # ── EL RELOJ, JUSTO DESPUES DE TOMAR EL CANDADO ──────────────────────
    # El 02-sep-2026 a las 02:00 esta corrida se colgo exportando el Stock
    # Reserva: se le murio el navegador y el proceso quedo 38 minutos vivo, sin
    # escribir una linea, CON EL CANDADO PUESTO. Nadie aviso.
    #
    # Va DESPUES de tomar el candado y no antes, porque lo que hay que garantizar
    # es que el candado se suelte pase lo que pase; y el `al_morir` es justamente
    # soltarlo, ya que al cortar de raiz no se ejecutan los `finally`.
    #
    # 40 MINUTOS: una corrida sana son unos 9 y el propio WMS avisa que el
    # reporte "puede tardar mas de 15". Cuarenta no aprieta a nadie y caza el
    # colgado mucho antes de que el candado venza solo, que son 150.
    apagar_reloj = reloj_muerto.arrancar(
        MINUTOS_MAXIMOS, log,
        al_morir=lambda: bloqueo_wms.soltar(),
        quien="el stock de la hora")

    carpeta = tempfile.mkdtemp(prefix="stock_hora_")
    try:
        ruta_act, ruta_res = bajar_los_dos(carpeta)

        if not ruta_act and not ruta_res:
            log("No bajó ninguno de los dos stocks. Las áreas de la hora se quedan con "
                "lo de la corrida anterior, que es mejor que quedar vacías.", "ERROR")
            return 2

        if not ruta_act:
            log("El Stock Activo no bajó; se publica solo la reserva", "WARN")
        if not ruta_res:
            log("El Stock Reserva no bajó; se publica solo el activo", "WARN")

        publicados = publicar(ruta_act, ruta_res)
        esperados = (1 if ruta_act else 0) + (1 if ruta_res else 0)

        # LA CORRIDA DE LAS 06:30 CONGELA LA NOCHE. Va después de publicar, y a
        # propósito NO cambia el código de salida: si el cierre falla, el cajón de la
        # hora ya quedó bien y el turno día trabaja igual. Lo que se pierde es el
        # histórico de esa noche, y eso se ve en el log.
        if es_la_corrida_del_cierre():
            if not guardar_cierre(ruta_act, ruta_res):
                log("El cierre de la jornada no se guardó completo: esa noche va a "
                    "quedar sin avance en el reporte del turno", "WARN")

        log("=" * 58)
        log("LISTO en %.1f minutos - %d de %d publicados"
            % ((time.time() - inicio) / 60.0, publicados, esperados))
        log("=" * 58)

        if publicados == 0:
            return 3
        if publicados < esperados or not (ruta_act and ruta_res):
            return 3
        return 0

    finally:
        # El reloj se apaga primero: si no, una corrida que termino bien pero
        # tardo mas de la cuenta se mataria a si misma al salir.
        apagar_reloj()
        # El candado se suelta SIEMPRE. Si quedara puesto, el robot de la hora se
        # saltearía las siguientes 45 corridas hasta que se venciera solo.
        bloqueo_wms.soltar()
        shutil.rmtree(carpeta, ignore_errors=True)
        limpiar_logs_viejos()


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
