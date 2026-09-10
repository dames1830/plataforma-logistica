# -*- coding: utf-8 -*-
"""RECUPERAR MESES DE PICKING  ·  una sola entrada al WMS, muchos dias.

Lo pidio Daniel el 10-sep-2026: *"necesito desde abril hasta ahora el picking"*.
Habia 44 dias -del 20-jul al 09-sep-; faltaban 118.

POR QUE NO SIRVE LLAMAR 118 VECES A picking_y_orden.py --dia
------------------------------------------------------------
Ese robot esta hecho para UN dia: abre navegador, entra a Oracle, baja, cierra.
Medido en los logs del servidor, **el archivo tarda ~1 minuto y todo lo demas
tarda 3 o 4**: arrancar Chromium, el login, esperar los 15 segundos del portal,
abrir la pantalla, elegir la busqueda guardada. Llamarlo 118 veces seria pagar
ese peaje 118 veces.

Aca se paga una vez por BLOQUE y adentro se bajan los dias uno tras otro
reusando la misma pagina: solo cambian las dos fechas y se vuelve a exportar.

POR QUE IGUAL SE TRABAJA EN BLOQUES Y NO DE UN TIRON
---------------------------------------------------
**Oracle no admite dos sesiones del mismo usuario**: la segunda invalida a la
primera. En el servidor hay una docena de robots que entran con la cuenta
`dames` -el ancla de las 07:00, el corte de turno, los de cada hora- y se
coordinan con un candado (`bloqueo_wms`).

El candado solo detiene al que llega; **no detiene al que ya esta adentro**. Y
los importantes -el ancla, sobre todo- despues de 45 minutos de espera ENTRAN
IGUAL, que es la regla correcta: perder la foto del turno es peor que un cruce.
Una corrida de siete horas agarrada al candado los haria entrar por encima y
matar las dos sesiones.

Por eso cada bloque dura `--bloque` minutos -20 por defecto-, y al terminarlo
**se cierra el navegador y se suelta el candado**. Si otro robot esta esperando,
entra ahi. La cuenta: ~40 segundos de re-login cada 20 minutos, contra la
certeza de no tumbarle la corrida a nadie.

    Daniel: *"el que no debe de omitir es el de las siete, del corte de turno"*.
    Con los bloques no hay que omitir a ninguno: esperan como mucho 20 minutos.

SE PUEDE VOLVER A CORRER SIN MIEDO
----------------------------------
No baja lo que ya esta: mira la carpeta antes. Si se corta -se cae la red, se
reinicia el servidor- se lanza de nuevo y sigue donde iba. Un dia que fallo por
otra cosa queda listado al final, para una segunda pasada.

LOS DOMINGOS SE PIDEN IGUAL. Casi ninguno tiene movimiento, pero el 16 y el 23
de agosto SI: darlos por vacios de antemano dejaria huecos de verdad. El que no
tiene nada se anota en `sin_movimiento.json` y no se vuelve a pedir.

    python recuperar_picking.py --probar                 dice que dias faltan
    python recuperar_picking.py --desde 01-04-2026
    python recuperar_picking.py --desde 01-04-2026 --hasta 09-09-2026 --bloque 20
"""

import io
import json
import os
import sys
import time
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
LOGS = os.path.join(AQUI, "logs")
_LOG = None

# Cuanto se queda adentro antes de soltarle el paso a los demas robots.
BLOQUE_MIN = 20
# Un respiro entre bloques, para que el que estaba esperando tome el candado
# antes que yo lo vuelva a pedir.
ESPERA_ENTRE_BLOQUES = 45
# Un archivo mas chico que esto es una exportacion que salio mal, no un dia
# flojo: el dia mas pobre que hay pesa 3,7 MB.
MINIMO_BUENO = 100 * 1024


def log(mensaje, nivel="INFO"):
    linea = "[%s] [%-5s] %s" % (datetime.now().strftime("%H:%M:%S"), nivel, mensaje)
    try:
        print(linea)
    except Exception:
        pass
    try:
        if _LOG:
            with io.open(_LOG, "a", encoding="utf-8") as fh:
                fh.write(linea + "\n")
    except Exception:
        pass


def abrir_log():
    global _LOG
    os.makedirs(LOGS, exist_ok=True)
    _LOG = os.path.join(LOGS, "recuperar_picking_%s.log"
                        % datetime.now().strftime("%Y-%m-%d_%H%M%S"))


def arg(nombre, defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith(nombre + "="):
            return a.split("=", 1)[1]
    return defecto


def fecha(txt, defecto):
    if not txt:
        return defecto
    for f in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(txt, f)
        except ValueError:
            pass
    raise SystemExit("No entendi la fecha '%s'. Se escribe asi: 01-04-2026" % txt)


def ya_sin_movimiento():
    """Los dias que ya se comprobaron vacios. No se vuelven a pedir: cada uno
       cuesta un par de minutos de navegacion para llegar a la misma grilla."""
    try:
        p = os.path.join(LOGS, "sin_movimiento.json")
        if not os.path.exists(p):
            return set()
        with io.open(p, encoding="utf-8") as fh:
            return set((json.load(fh).get("picking") or {}).keys())
    except Exception:
        return set()


def dias_que_faltan(base, d0, d1):
    vacios = ya_sin_movimiento()
    faltan = []
    d = d0
    while d <= d1:
        ruta = os.path.join(base, "Picking", "Picking %d-%d.csv" % (d.day, d.month))
        hay = os.path.exists(ruta) and os.path.getsize(ruta) > MINIMO_BUENO
        if not hay and d.strftime("%d-%m-%Y") not in vacios:
            faltan.append(d)
        d += timedelta(days=1)
    return faltan


def bajar_dia_rapido(pk, page, destino, dia):
    """El MISMO panel, otras dos fechas.

    NO SE VUELVE A ELEGIR LA BUSQUEDA GUARDADA, y esa es la diferencia entera
    entre que esto funcione o no. El boton "Busquedas guardadas" es un
    INTERRUPTOR: el primer clic despliega el bloque y el segundo lo PLIEGA, asi
    que dentro de una misma sesion sale bien uno de cada dos.

    Medido el 10-sep-2026 con la sonda `--mirar`: 15-04 bien, 29-04 falla,
    15-05 bien, 29-05 falla, 12-06 bien, 26-06 falla. Alternancia perfecta.

    Y no hace falta repetirla: la busqueda guardada solo sirve para ARMAR el
    panel -la pantalla exige una fecha de creacion-, y ya quedo armado con el
    primer dia del bloque. De paso cada dia cuesta la mitad, porque tampoco hay
    que cerrar y reabrir la pantalla.

    EL PIE DE LA BUSQUEDA ANTERIOR ES LA OTRA TRAMPA. Reusando la pagina, la
    grilla del dia anterior sigue en pantalla con su pie de "Recuperados": sin
    `distinto_de` el robot lo lee como si fuera el resultado nuevo y exporta el
    dia equivocado dentro del archivo de hoy.
    """
    f = dia.strftime("%d/%m/%Y")
    log("=" * 58)
    log("AVANCE DE PICKING · %s  (mismo panel)" % dia.strftime("%d-%m-%Y"))
    log("=" * 58)
    pk.abrir_panel(page)
    pk.poner_fecha_y_hora(page, pk.ETQ_PICK_DESDE, f, "0:00:00")
    pk.poner_fecha_y_hora(page, pk.ETQ_PICK_HASTA, f, "23:59:59")
    _, pie = pk.total_paginas(page)
    pk.ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    # DOS MINUTOS Y MEDIO, NO DIEZ. `esperar_resultado` solo se da por vencido
    # antes de tiempo cuando el pie CAMBIO, y dos dias vacios seguidos dejan el
    # mismo pie -"/ 1 Paginas"-, asi que se comia el timeout entero por dia. Un
    # dia con datos contesta en 3 a 9 segundos; 150 sobran de lejos.
    paginas = pk.esperar_resultado(page, timeout_seg=150, distinto_de=pie)
    if not paginas:
        log("El %s no trajo ninguna fila." % dia.strftime("%d-%m-%Y"), "WARN")
        pk.marcar_sin_movimiento("picking", dia.strftime("%d-%m-%Y"))
        return False
    try:
        pk.exportar_csv(page, destino, pk.MINIMO_FILAS_PICKING)
        return True
    except Exception as e:
        if pk.dia_vacio(e, paginas, "picking", dia.strftime("%d-%m-%Y")):
            return False
        raise


def bajar_un_bloque(pk, wms, sync, base, pendientes, minutos, a_la_vista):
    """Entra al WMS y baja dias hasta que se acabe el bloque.

       Los dias bajados se sacan de `pendientes`; los que no llego a tocar
       quedan ahi para el bloque siguiente."""
    bajados, fallaron = [], []
    t0 = time.time()
    with sync() as p:
        log("Abriendo navegador...")
        nav = p.chromium.launch(headless=not a_la_vista)
        ctx = nav.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx.new_page()
        page.on("dialog", lambda d: d.accept())
        try:
            page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            log("Sesion iniciada como %s" % wms.WMS_USER)
            time.sleep(15)

            primero = True
            while pendientes and (time.time() - t0) < minutos * 60:
                dia = pendientes[0]
                destino = os.path.join(base, "Picking",
                                       "Picking %d-%d.csv" % (dia.day, dia.month))
                try:
                    # El primer dia del bloque abre la pantalla y elige la
                    # busqueda guardada; los demas reusan ese mismo panel.
                    if primero:
                        pk.descargar_picking(page, destino, dia)
                        primero = False
                    else:
                        bajar_dia_rapido(pk, page, destino, dia)
                    bajados.append(dia)
                    pendientes.pop(0)
                except Exception as e:
                    # SE INTENTA UNA VEZ MAS ANTES DE DARLO POR PERDIDO. La lista
                    # de busquedas guardadas a veces no se despliega a tiempo -el
                    # robot diario tambien lo sufre y lo resuelve reabriendola-, y
                    # eso no es motivo para perder el dia.
                    log("El %s fallo (%s: %s). Un intento mas, reabriendo la "
                        "pantalla..."
                        % (dia.strftime("%d-%m-%Y"), type(e).__name__, str(e)[:110]),
                        "WARN")
                    try:
                        # A PROPOSITO POR EL CAMINO LARGO: `descargar_picking`
                        # cierra y reabre la pantalla, y eso deja el bloque de
                        # busquedas guardadas plegado otra vez, que es el estado
                        # desde el que el interruptor funciona.
                        pk.descargar_picking(page, destino, dia)
                        bajados.append(dia)
                        pendientes.pop(0)
                        continue
                    except Exception as e2:
                        # UN DIA QUE FALLA NO PUEDE PARAR LOS OTROS 117. Se anota,
                        # se saca de la cola y se sigue; al final se listan todos
                        # juntos para una segunda pasada.
                        log("El %s no se pudo bajar (%s: %s)"
                            % (dia.strftime("%d-%m-%Y"), type(e2).__name__,
                               str(e2)[:140]), "WARN")
                    fallaron.append(dia)
                    pendientes.pop(0)
                    # La pagina puede haber quedado a medias. Se corta el bloque
                    # y el siguiente arranca con navegador limpio.
                    break
        finally:
            try:
                nav.close()
            except Exception:
                pass
    return bajados, fallaron


def solo_mirar(pk, wms, sync, base, fechas):
    """HASTA DONDE LLEGA LA MEMORIA DEL WMS.

       No exporta nada: pone las fechas, ejecuta la busqueda y mira si la grilla
       trae filas. Unos 30 segundos por dia contra los 2 o 3 minutos de una
       bajada, asi que preguntarle al WMS por seis fechas sueltas cuesta menos
       que descubrir a los tropezones que abril esta vacio.

       Hizo falta el 10-sep-2026: el 01-04 y el 03-04 volvieron sin una sola
       fila, y bajar 118 dias para enterarse de eso habria costado horas."""
    hay = []
    with sync() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx.new_page()
        page.on("dialog", lambda d: d.accept())
        try:
            page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            log("Sesion iniciada como %s" % wms.WMS_USER)
            time.sleep(15)
            # OJO AL LEER ESTO: "1 Pagina" ES LA GRILLA VACIA, no un dia flojo.
            # La primera version cantaba "TIENE DATOS" con una sola pagina y me
            # hizo creer que abril y mayo estaban, cuando estaban vacios. Manda
            # el numero de paginas, no que la navegacion no se haya caido.
            primero = True
            for d in fechas:
                try:
                    if primero:
                        pk.descargar_picking(page, None, d, sin_exportar=True)
                        primero = False
                    else:
                        f = d.strftime("%d/%m/%Y")
                        pk.abrir_panel(page)
                        pk.poner_fecha_y_hora(page, pk.ETQ_PICK_DESDE, f, "0:00:00")
                        pk.poner_fecha_y_hora(page, pk.ETQ_PICK_HASTA, f, "23:59:59")
                        _, pie = pk.total_paginas(page)
                        pk.ejecutar_busqueda(page)
                        pk.esperar_resultado(page, distinto_de=pie)
                    n, txt = pk.total_paginas(page)
                    if n and n > 1:
                        log(">>> %s  TIENE DATOS  (%s)" % (d.strftime("%d-%m-%Y"), txt))
                        hay.append(d)
                    else:
                        log(">>> %s  VACIO  (%s)" % (d.strftime("%d-%m-%Y"), txt), "WARN")
                except Exception as e:
                    log(">>> %s  no se pudo mirar  (%s)"
                        % (d.strftime("%d-%m-%Y"), str(e)[:70]), "WARN")
        finally:
            try:
                nav.close()
            except Exception:
                pass
    log("")
    log("=" * 62)
    log("CON DATOS: %s" % (", ".join(d.strftime("%d-%m") for d in hay) or "ninguna"))
    log("=" * 62)
    return 0


JS_PANEL = """() => {
  const filas = [];
  document.querySelectorAll('input').forEach(i => {
    const caja = i.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;
    let et = '';
    let n = i.closest('tr') || i.parentElement;
    for (let k = 0; k < 4 && n && !et; k++) {
      et = (n.innerText || '').trim().split('\\n')[0] || '';
      n = n.parentElement;
    }
    filas.push({etiqueta: et.slice(0, 60), valor: (i.value || '').slice(0, 40),
                y: Math.round(caja.y)});
  });
  filas.sort((a, b) => a.y - b.y);
  return filas;
}"""


def ver_panel(pk, wms, sync, dia):
    """QUE TIENE PUESTO EL PANEL DE VERDAD, campo por campo.

       Hizo falta el 10-sep-2026. Le dije a Daniel que el WMS no guardaba abril
       ni mayo porque la grilla volvia vacia, y el contesto: *"yo estoy viendo
       manualmente que tiene datos en abril y en mayo"*. Tenia razon.

       El robot escribe las fechas de SELECCION, pero la pantalla exige ademas
       una FECHA DE CREACION y esa la trae la busqueda guardada. Suponer que
       venia abierta era justamente el error: hay que mirarla."""
    with sync() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx.new_page()
        page.on("dialog", lambda d: d.accept())
        try:
            page.goto("https://a10.wms.ocs.oraclecloud.com/bata/index/")
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            log("Sesion iniciada como %s" % wms.WMS_USER)
            time.sleep(15)
            pk.abrir_pantalla(page, pk.PANTALLA_PICKING)
            pk.abrir_panel(page)
            log("")
            log("--- panel RECIEN ABIERTO, sin busqueda guardada ---")
            for c in page.evaluate(JS_PANEL):
                if c["etiqueta"]:
                    log("   %-58s = %s" % (c["etiqueta"], c["valor"] or "(vacio)"))
            pk.elegir_busqueda_guardada(page, pk.BUSQUEDA_PICKING)
            log("")
            log("--- panel DESPUES de aplicar '%s' ---" % pk.BUSQUEDA_PICKING)
            for c in page.evaluate(JS_PANEL):
                if c["etiqueta"]:
                    log("   %-58s = %s" % (c["etiqueta"], c["valor"] or "(vacio)"))
            f = dia.strftime("%d/%m/%Y")
            pk.poner_fecha_y_hora(page, pk.ETQ_PICK_DESDE, f, "0:00:00")
            pk.poner_fecha_y_hora(page, pk.ETQ_PICK_HASTA, f, "23:59:59")
            log("")
            log("--- panel con las fechas de seleccion del %s ---"
                % dia.strftime("%d-%m-%Y"))
            for c in page.evaluate(JS_PANEL):
                if c["etiqueta"]:
                    log("   %-58s = %s" % (c["etiqueta"], c["valor"] or "(vacio)"))
        finally:
            try:
                nav.close()
            except Exception:
                pass
    return 0


def run():
    abrir_log()
    import bloqueo_wms
    import wms_automation_final as wms
    import picking_y_orden as pk
    from playwright.sync_api import sync_playwright

    # Los dos modulos escriben con su propio `log`; se los apunta al mio para
    # que el detalle de la navegacion caiga en ESTE archivo y no se parta.
    pk.log = log
    wms.log = log

    probar = "--probar" in sys.argv
    a_la_vista = "--ver" in sys.argv
    bloque = int(arg("--bloque", BLOQUE_MIN))
    d0 = fecha(arg("--desde"), datetime(datetime.now().year, 4, 1))
    d1 = fecha(arg("--hasta"), datetime.now() - timedelta(days=1))

    base = wms._base_onedrive()
    if not base or not os.path.isdir(base):
        log("No encuentro la carpeta de OneDrive (%s)" % base, "ERROR")
        return 1

    panel = arg("--ver-panel")
    if panel:
        bloqueo_wms.esperar_turno(log, minutos_max=60, quien="ver panel picking")
        bloqueo_wms.tomar("ver panel picking")
        try:
            return ver_panel(pk, wms, sync_playwright, fecha(panel, None))
        finally:
            bloqueo_wms.soltar()

    mirar = arg("--mirar")
    if mirar:
        fechas = [fecha(x.strip(), None) for x in mirar.split(",") if x.strip()]
        log("=" * 62)
        log("SOLO MIRAR  ·  %d fechas, sin exportar nada" % len(fechas))
        log("=" * 62)
        bloqueo_wms.esperar_turno(log, minutos_max=60, quien="mirar picking")
        bloqueo_wms.tomar("mirar picking")
        try:
            return solo_mirar(pk, wms, sync_playwright, base, fechas)
        finally:
            bloqueo_wms.soltar()

    faltan = dias_que_faltan(base, d0, d1)
    log("=" * 62)
    log("RECUPERAR PICKING  ·  %s a %s"
        % (d0.strftime("%d-%m-%Y"), d1.strftime("%d-%m-%Y")))
    log("=" * 62)
    log("dias en el rango .......... %d" % ((d1 - d0).days + 1))
    log("faltan por bajar .......... %d" % len(faltan))
    log("bloques de ................ %d minutos" % bloque)
    if not faltan:
        log("No falta ninguno. Nada que hacer.")
        return 0
    log("del %s al %s" % (faltan[0].strftime("%d-%m-%Y"),
                          faltan[-1].strftime("%d-%m-%Y")))
    if probar:
        log("")
        log("MODO PROBAR. Los dias serian:")
        for i in range(0, len(faltan), 12):
            log("   " + "  ".join(d.strftime("%d-%m") for d in faltan[i:i + 12]))
        return 0

    if not wms.WMS_PASSWORD or wms.WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta WMS_PASSWORD en el .env", "ERROR")
        return 1

    t0 = time.time()
    bajados, fallaron, n = [], [], 0
    while faltan:
        n += 1
        # SE ESPERA EL TURNO COMO CUALQUIER OTRO ROBOT, y esta corrida SI cede:
        # no tiene hora, puede seguir dentro de una hora. Lo que no puede es
        # arruinarle la suya al que si la tiene.
        bloqueo_wms.esperar_turno(log, minutos_max=60, quien="recuperar picking")
        bloqueo_wms.tomar("recuperar picking")
        log("")
        log("-" * 62)
        log("BLOQUE %d  ·  quedan %d dias  ·  llevamos %.0f min"
            % (n, len(faltan), (time.time() - t0) / 60.0))
        log("-" * 62)
        try:
            b, f = bajar_un_bloque(pk, wms, sync_playwright, base, faltan,
                                   bloque, a_la_vista)
        except Exception as e:
            log("El bloque %d se cayo entero (%s: %s). Se sigue con el siguiente."
                % (n, type(e).__name__, str(e)[:160]), "WARN")
            b, f = [], []
        finally:
            bloqueo_wms.soltar()
        bajados += b
        fallaron += f
        log("bloque %d: %d bajados  ·  %d fallaron  ·  quedan %d"
            % (n, len(b), len(f), len(faltan)))
        if not b and not f:
            log("Ese bloque no logro bajar nada. Se corta para no dar vueltas "
                "en falso; hay que volver a lanzarlo cuando el WMS este mejor.",
                "ERROR")
            break
        if faltan:
            time.sleep(ESPERA_ENTRE_BLOQUES)

    log("")
    log("=" * 62)
    log("LISTO en %.1f horas  ·  %d bajados  ·  %d fallaron  ·  %d sin tocar"
        % ((time.time() - t0) / 3600.0, len(bajados), len(fallaron), len(faltan)))
    if fallaron:
        log("no se pudieron bajar: "
            + ", ".join(d.strftime("%d-%m") for d in fallaron), "WARN")
        log("Se recuperan volviendo a lanzar este mismo script.")
    log("=" * 62)
    return 0 if not fallaron and not faltan else 1


if __name__ == "__main__":
    sys.exit(run())
