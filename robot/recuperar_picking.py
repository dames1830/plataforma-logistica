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

import collections
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


# DONDE SE QUEDO, PARA PODER SEGUIR DESPUES.
#
# Daniel, 10-sep-2026: *"quince minutos antes de que sea el cambio de turno ya
# paras... me dices en que dia, para retomarlo despues de las nueve"*.
#
# No alcanza con anotarlo en el log: al retomar hace falta la lista EXACTA de
# dias que faltan, porque muchos de los que ya estan en la carpeta hay que
# rehacerlos igual -bajaron con el filtro de creacion viejo-. Mirando solo la
# carpeta, esos se saltearian y quedarian incompletos para siempre.
PENDIENTE = os.path.join(LOGS, "recuperar_picking_pendiente.json")


def guardar_pendiente(dias):
    try:
        os.makedirs(LOGS, exist_ok=True)
        with io.open(PENDIENTE, "w", encoding="utf-8") as fh:
            fh.write(json.dumps([d.strftime("%d-%m-%Y") for d in dias]))
        log("Anotado donde me quede: %d dias en %s"
            % (len(dias), os.path.basename(PENDIENTE)))
    except Exception as e:
        log("no pude anotar los pendientes (%s)" % type(e).__name__, "ERROR")


def leer_pendiente():
    with io.open(PENDIENTE, encoding="utf-8") as fh:
        return [datetime.strptime(x, "%d-%m-%Y") for x in json.load(fh)]


def borrar_pendiente():
    try:
        if os.path.exists(PENDIENTE):
            os.remove(PENDIENTE)
    except Exception:
        pass


def hora_limite(txt):
    """`--parar-a 19:15` -> el momento de hoy a esa hora."""
    if not txt:
        return None
    h, m = (txt.split(":") + ["0"])[:2]
    ahora = datetime.now()
    momento = ahora.replace(hour=int(h), minute=int(m), second=0, microsecond=0)
    # SI ESA HORA YA PASO, ES LA DE MAÑANA. La corrida que retoma a las 21:00
    # frena a las 06:45, antes del ancla de la mañana, y sin esto se detenia en el
    # primer segundo: las 06:45 de "hoy" ya habian pasado.
    if momento <= ahora:
        momento += timedelta(days=1)
    return momento


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


def dias_que_faltan(base, d0, d1, rehacer=False):
    """Los dias a pedir. Con `rehacer` van TODOS, esten o no.

       Hizo falta el 10-sep-2026: los primeros 41 dias se bajaron con la fecha
       de creacion que traia la busqueda guardada -01/05/2026- y les falta todo
       lo que se creo antes de esa fecha. Un archivo incompleto es peor que uno
       que no esta: nadie lo va a mirar dos veces."""
    vacios = set() if rehacer else ya_sin_movimiento()
    faltan = []
    d = d0
    while d <= d1:
        ruta = os.path.join(base, "Picking", "Picking %d-%d.csv" % (d.day, d.month))
        hay = os.path.exists(ruta) and os.path.getsize(ruta) > MINIMO_BUENO
        if rehacer or (not hay and d.strftime("%d-%m-%Y") not in vacios):
            faltan.append(d)
        d += timedelta(days=1)
    return faltan


# LA FECHA DE CREACION QUE TAPABA MEDIO AÑO.
#
# La busqueda guardada "Avance Picking" trae "De registro de hora de creacion"
# —campo OBLIGATORIO, con asterisco— clavado en **01/05/2026**. Todo lo creado
# antes de esa fecha queda fuera por mas que se pidan las fechas de seleccion de
# abril, y la grilla vuelve vacia sin decir por que.
#
# Yo lo lei como que el WMS no guardaba tan atras y se lo dije a Daniel asi.
# El contesto: *"yo estoy viendo manualmente que tiene datos en abril y en
# mayo"*. Tenia razon. El panel RECIEN ABIERTO, sin busqueda guardada, trae
# 01/01/2025: la historia esta, la tapaba el filtro.
#
# Se escribe siempre, en todos los dias, y no se toca la busqueda guardada de
# Daniel: es suya y la usa a mano.
# AGOSTO DE 2025, que es lo que pidio Daniel: *"voy a poner la fecha de creacion
# de agosto del dos mil veinticinco, asi mas o menos"*. El panel en blanco trae
# 01/01/2025 y el a mano usa 01/01/2026; con agosto de 2025 sobra margen para
# cualquier pedido viejo sin agrandar de mas la ventana que Oracle tiene que
# recorrer. Se cambia con `--creacion`.
ETQ_CREA_DESDE = "De registro de hora de creación"
CREACION_DESDE = "01/08/2025"


# EL "/ 1 PAGINAS" DE ESTA PANTALLA NO ES CONFIABLE.
#
# 10-sep-2026, recuperando mayo: el robot dio por vacios el martes 05, el jueves
# 07, el lunes 11, el miercoles 13, el viernes 15 y el lunes 18 -dias de trabajo
# normales-, alternados con dias que si bajaron. Y apenas arranco un bloque con
# el navegador limpio, el 19, el 20 y el 21 volvieron a bajar bien.
#
# El pie de TRX_ASIGNACIONES no trae el "Recuperados <fecha> <hora>": el robot lo
# lee de un "/ N Paginas" suelto, y con Oracle todavia cargando ese suelto dice
# "/ 1". Se aceptaba a los 3 segundos, se intentaba exportar sobre una grilla que
# no estaba lista, no aparecia "Exportar a CSV" y el dia quedaba sin movimiento.
#
# LA REGLA QUE SALIO DE ESO: un dia vacio NUNCA se acepta a la primera. Se vuelve
# a pedir con la pantalla recien abierta y con paciencia, y solo si tampoco ahi
# hay nada que exportar queda como vacio. Y lo que SI se exporta se lee fila por
# fila antes de guardarlo: tiene que ser del dia que dice el nombre.
#
# Revisado ese mismo dia sobre lo ya bajado: 39 de 39 archivos traian el 100% de
# su dia. El dano era solo el vacio falso, nunca un dia cambiado por otro. La
# validacion queda igual, porque la causa del pie no se entendio del todo.

VACIOS_CONFIRMADOS = os.path.join(LOGS, "picking_vacios_confirmados.json")


def leer_confirmados():
    try:
        with io.open(VACIOS_CONFIRMADOS, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def marcar_confirmado(dia):
    datos = leer_confirmados()
    datos[dia.strftime("%d-%m-%Y")] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        os.makedirs(LOGS, exist_ok=True)
        with io.open(VACIOS_CONFIRMADOS, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(datos, ensure_ascii=False, indent=1))
    except Exception as e:
        log("no pude anotar el vacio confirmado (%s)" % type(e).__name__, "WARN")


def buscar_dia(pk, page, dia, espera):
    """Pone las tres fechas, busca y devuelve las paginas que dice el pie.

       EL PIE DE LA BUSQUEDA ANTERIOR SE PASA COMO `distinto_de`. Reusando la
       pagina, la grilla del dia anterior sigue en pantalla: sin eso el robot
       lee el resultado viejo como si fuera el nuevo."""
    f = dia.strftime("%d/%m/%Y")
    pk.abrir_panel(page)
    pk.poner_fecha_y_hora(page, ETQ_CREA_DESDE, CREACION_DESDE, "0:00:00")
    pk.poner_fecha_y_hora(page, pk.ETQ_PICK_DESDE, f, "0:00:00")
    pk.poner_fecha_y_hora(page, pk.ETQ_PICK_HASTA, f, "23:59:59")
    _, pie = pk.total_paginas(page)
    pk.ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    return pk.esperar_resultado(page, timeout_seg=espera, distinto_de=pie)


def exportar_y_validar(pk, page, destino, dia):
    """Exporta a un archivo DE PASO, lo lee y recien ahi lo pone en su lugar.

       'ok'    las filas son del dia y el archivo quedo en la carpeta
       'vacio' no hubo nada que exportar
       'mal'   se exporto algo que no es de ese dia, o no llego a bajar

       DE PASO Y FUERA DE LA CARPETA Picking, a proposito: otros robots leen
       Picking/*.csv -el de recibido y sin picar, a las 02:30- y un archivo a
       medio validar ahi adentro lo contarian como bueno. Y sobre todo: uno malo
       no pisa al que ya estaba."""
    import revisar_dias_picking as rv
    paso = os.path.join(LOGS, "picking_en_paso")
    os.makedirs(paso, exist_ok=True)
    tmp = os.path.join(paso, os.path.basename(destino))
    if os.path.exists(tmp):
        os.remove(tmp)
    try:
        # PISO DE UNA FILA, no de 200: el domingo 19-04 tiene 6 filas y es real.
        ok = pk.exportar_csv(page, tmp, 1)
    except Exception as e:
        if "Exportar" in str(e):
            return "vacio"
        raise
    if not ok or not os.path.exists(tmp):
        return "mal"
    total, del_dia, otras, error = rv.revisar_archivo(tmp, dia)
    pct = 100.0 * del_dia / total if total else 0.0
    if error or pct < 98.0:
        log("El archivo del %s NO es de ese dia: %s filas, %.1f%% del dia%s%s"
            % (dia.strftime("%d-%m-%Y"), format(total, ",d"), pct,
               (" · otras " + ", ".join("%s=%d" % par for par in otras)) if otras else "",
               (" · " + error) if error else ""), "ERROR")
        os.remove(tmp)
        return "mal"
    os.replace(tmp, destino)
    log("Validado: %s filas, %.1f%% del %s -> %s"
        % (format(total, ",d"), pct, dia.strftime("%d-%m-%Y"), os.path.basename(destino)))
    return "ok"


def bajar_dia(pk, page, destino, dia, armar=False, confirmar=False):
    """Un dia entero: buscar, esperar lo que haga falta, exportar y validar.

       `armar` abre la pantalla y elige la busqueda guardada: el primer dia de
       cada bloque y cada confirmacion. Los demas dias NO la repiten, porque el
       boton "Busquedas guardadas" es un INTERRUPTOR: el primer clic despliega el
       bloque y el segundo lo pliega, y repetirla fallaba uno de cada dos dias.
       Solo arma el panel; con reescribir las fechas alcanza.

       `confirmar` es la segunda mirada a un dia que parecio vacio: pantalla
       recien abierta y hasta un minuto de paciencia antes de creerle al pie."""
    log("=" * 58)
    log("AVANCE DE PICKING · %s%s" % (
        dia.strftime("%d-%m-%Y"),
        "  (CONFIRMANDO, pantalla recien abierta)" if confirmar
        else ("" if armar else "  (mismo panel)")))
    log("=" * 58)
    if armar:
        pk.abrir_pantalla(page, pk.PANTALLA_PICKING)
        pk.abrir_panel(page)
        log("Eligiendo la búsqueda guardada '%s'..." % pk.BUSQUEDA_PICKING)
        pk.elegir_busqueda_guardada(page, pk.BUSQUEDA_PICKING)
    paginas = buscar_dia(pk, page, dia, 240 if confirmar else 90)
    if not paginas or paginas <= 1:
        # No se le cree al "/ 1": se le da tiempo a Oracle y se vuelve a mirar.
        hasta = time.time() + (60 if confirmar else 8)
        while time.time() < hasta:
            time.sleep(5)
            otra, txt = pk.total_paginas(page)
            if otra and otra > 1:
                log("El pie cambio a '%s': SI habia filas." % txt, "WARN")
                break
    return exportar_y_validar(pk, page, destino, dia)


def bajar_un_bloque(pk, wms, sync, base, pendientes, minutos, a_la_vista,
                    limite=None):
    """Entra al WMS y trabaja dias hasta que se acabe el bloque.

       Devuelve (bajados, vacios, fallaron). Cada dia sale de `pendientes` apenas
       tiene veredicto; los que no llego a tocar quedan para el bloque siguiente.

       YA NO HAY REINTENTO POR `picking_y_orden.descargar_picking`: ese usa la
       fecha de creacion de la busqueda guardada -01/05/2026- y un dia bajado por
       ahi saldria incompleto con la hora de hoy, sin que nada lo delate."""
    bajados, vacios, fallaron = [], [], []
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

            armar = True
            while pendientes and (time.time() - t0) < minutos * 60:
                # EL FRENO VA ANTES DE EMPEZAR EL DIA, no en el medio: un dia a
                # medias dejaria un CSV cortado que parece bueno.
                if limite and datetime.now() >= limite:
                    log("Son las %s: me detengo antes del cambio de turno."
                        % datetime.now().strftime("%H:%M"), "WARN")
                    break
                dia = pendientes[0]
                destino = os.path.join(base, "Picking",
                                       "Picking %d-%d.csv" % (dia.day, dia.month))
                try:
                    estado = bajar_dia(pk, page, destino, dia, armar=armar)
                    armar = False
                    if estado != "ok":
                        log("El %s dio '%s'. No se le cree a la primera: se "
                            "confirma con la pantalla recien abierta."
                            % (dia.strftime("%d-%m-%Y"), estado), "WARN")
                        estado = bajar_dia(pk, page, destino, dia, armar=True,
                                           confirmar=True)
                        if estado == "ok":
                            log("El %s NO estaba vacio: era el pie de la grilla."
                                % dia.strftime("%d-%m-%Y"), "WARN")
                except Exception as e:
                    log("El %s fallo (%s: %s)"
                        % (dia.strftime("%d-%m-%Y"), type(e).__name__, str(e)[:140]),
                        "WARN")
                    estado = "error"
                pendientes.pop(0)
                if estado == "ok":
                    bajados.append(dia)
                elif estado == "vacio":
                    log("El %s queda como VACIO CONFIRMADO (dos miradas, la "
                        "segunda con la pantalla recien abierta)."
                        % dia.strftime("%d-%m-%Y"))
                    marcar_confirmado(dia)
                    vacios.append(dia)
                else:
                    # UN DIA QUE FALLA NO PUEDE PARAR LOS DEMAS. Se anota y se
                    # corta el bloque: el siguiente arranca con navegador limpio,
                    # que es justamente lo que lo arreglo en mayo.
                    fallaron.append(dia)
                    break
        finally:
            try:
                nav.close()
            except Exception:
                pass
    return bajados, vacios, fallaron


def dias_por_hacer(base, d0, d1, corte):
    """QUE FALTA DE VERDAD, mirando la carpeta y no una lista anotada.

       Un dia esta hecho si su archivo se escribio DESPUES de `corte` -con la
       fecha de creacion corregida- y sus filas son de ese dia, o si quedo como
       vacio confirmado. Todo lo demas se pide: los que no tienen archivo, los que
       se bajaron con el filtro viejo -antes del corte- y cualquiera que traiga
       otro dia adentro.

       Sin esto, retomar desde la lista que anoto la corrida de las 19:15 se
       habria salteado los vacios falsos de mayo: esa corrida los conto hechos."""
    import revisar_dias_picking as rv
    confirmados = leer_confirmados()
    faltan, motivos = [], collections.Counter()
    d = d0
    while d <= d1:
        clave = d.strftime("%d-%m-%Y")
        ruta = os.path.join(base, "Picking", "Picking %d-%d.csv" % (d.day, d.month))
        if clave in confirmados:
            motivos["vacio confirmado"] += 1
        elif not os.path.exists(ruta):
            faltan.append(d)
            motivos["sin archivo"] += 1
        elif os.path.getmtime(ruta) < corte:
            faltan.append(d)
            motivos["filtro viejo"] += 1
        else:
            total, del_dia, _, error = rv.revisar_archivo(ruta, d)
            if error or not total or del_dia * 100.0 / total < 98.0:
                faltan.append(d)
                motivos["otro dia adentro"] += 1
            else:
                motivos["hecho y validado"] += 1
        d += timedelta(days=1)
    return faltan, motivos


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

    global CREACION_DESDE
    CREACION_DESDE = arg("--creacion", CREACION_DESDE)
    probar = "--probar" in sys.argv
    a_la_vista = "--ver" in sys.argv
    rehacer = "--rehacer" in sys.argv
    seguir = "--seguir" in sys.argv
    limite = hora_limite(arg("--parar-a"))
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

    if seguir:
        if not os.path.exists(PENDIENTE):
            log("No hay nada anotado como pendiente: no quedo nada a medias.")
            return 0
        faltan = leer_pendiente()
        log("=" * 62)
        log("RETOMANDO LO QUE QUEDO PENDIENTE  ·  %d dias" % len(faltan))
        log("=" * 62)
        log("creado desde .............. %s" % CREACION_DESDE)
        if not faltan:
            borrar_pendiente()
            return 0
        log("del %s al %s" % (faltan[0].strftime("%d-%m-%Y"),
                              faltan[-1].strftime("%d-%m-%Y")))
        return trabajar(pk, wms, bloqueo_wms, sync_playwright, base, faltan,
                        bloque, a_la_vista, limite)

    # --corte: LO QUE FALTA DE VERDAD, sacado de la carpeta. Es el modo con el que
    # se retoma, y reemplaza a --seguir: la lista que anota una corrida vieja
    # cuenta como hechos los vacios falsos que ella misma produjo.
    corte_txt = arg("--corte")
    if corte_txt:
        corte = datetime.strptime(corte_txt, "%d-%m-%Y %H:%M").timestamp()
        faltan, motivos = dias_por_hacer(base, d0, d1, corte)
        log("=" * 62)
        log("RECUPERAR PICKING  ·  %s a %s  ·  lo que falta de verdad"
            % (d0.strftime("%d-%m-%Y"), d1.strftime("%d-%m-%Y")))
        log("=" * 62)
        for motivo, cuantos in sorted(motivos.items()):
            log("   %-24s %d" % (motivo, cuantos))
        log("creado desde .............. %s" % CREACION_DESDE)
        log("se piden .................. %d" % len(faltan))
        if limite:
            log("frena a las ............... %s" % limite.strftime("%d-%m %H:%M"))
        if not faltan:
            log("No falta ninguno.")
            borrar_pendiente()
            return 0
        log("del %s al %s" % (faltan[0].strftime("%d-%m-%Y"),
                              faltan[-1].strftime("%d-%m-%Y")))
        if probar:
            log("")
            log("MODO PROBAR. Los dias serian:")
            for i in range(0, len(faltan), 12):
                log("   " + "  ".join(x.strftime("%d-%m") for x in faltan[i:i + 12]))
            return 0
        return trabajar(pk, wms, bloqueo_wms, sync_playwright, base, faltan,
                        bloque, a_la_vista, limite)

    faltan = dias_que_faltan(base, d0, d1, rehacer)
    log("=" * 62)
    log("RECUPERAR PICKING  ·  %s a %s"
        % (d0.strftime("%d-%m-%Y"), d1.strftime("%d-%m-%Y")))
    log("=" * 62)
    log("dias en el rango .......... %d" % ((d1 - d0).days + 1))
    log("%s %d" % ("SE REHACEN TODOS .........." if rehacer
                   else "faltan por bajar ..........", len(faltan)))
    log("creado desde .............. %s" % CREACION_DESDE)
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

    return trabajar(pk, wms, bloqueo_wms, sync_playwright, base, faltan,
                    bloque, a_la_vista, limite)


def trabajar(pk, wms, bloqueo_wms, sync_playwright, base, faltan, bloque,
             a_la_vista, limite):
    """El bucle de bloques. Lo llaman los dos caminos —la corrida normal y
       `--seguir`— para que retomar sea exactamente lo mismo que empezar."""
    t0 = time.time()
    bajados, vacios, fallaron, n = [], [], [], 0
    while faltan:
        if limite and datetime.now() >= limite:
            log("")
            log("PARO ACA: son las %s y el ancla del cambio de turno entra a las "
                "%s." % (datetime.now().strftime("%H:%M"),
                         (limite + timedelta(minutes=15)).strftime("%H:%M")), "WARN")
            break
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
            b, v, f = bajar_un_bloque(pk, wms, sync_playwright, base, faltan,
                                      bloque, a_la_vista, limite)
        except Exception as e:
            log("El bloque %d se cayo entero (%s: %s). Se sigue con el siguiente."
                % (n, type(e).__name__, str(e)[:160]), "WARN")
            b, v, f = [], [], []
        finally:
            bloqueo_wms.soltar()
        bajados += b
        vacios += v
        fallaron += f
        log("bloque %d: %d bajados  ·  %d vacios confirmados  ·  %d fallaron  ·  quedan %d"
            % (n, len(b), len(v), len(f), len(faltan)))
        if not b and not v and not f:
            log("Ese bloque no logro bajar nada. Se corta para no dar vueltas "
                "en falso; hay que volver a lanzarlo cuando el WMS este mejor.",
                "ERROR")
            break
        if faltan:
            time.sleep(ESPERA_ENTRE_BLOQUES)

    # LO QUE NO SE ALCANZO A HACER SE ANOTA, incluidos los que fallaron: al
    # retomar hay que pedirlos otra vez, y mirando la carpeta no se distinguen.
    queda = list(faltan) + [d for d in fallaron if d not in faltan]
    queda.sort()
    log("")
    log("=" * 62)
    log("%s en %.1f horas  ·  %d bajados  ·  %d vacios confirmados  ·  %d fallaron"
        "  ·  %d sin tocar"
        % ("PARADO" if queda else "LISTO", (time.time() - t0) / 3600.0,
           len(bajados), len(vacios), len(fallaron), len(faltan)))
    if bajados:
        log("del %s al %s" % (bajados[0].strftime("%d-%m-%Y"),
                              bajados[-1].strftime("%d-%m-%Y")))
    if fallaron:
        log("no se pudieron bajar: "
            + ", ".join(d.strftime("%d-%m") for d in fallaron), "WARN")
    if queda:
        log("ME QUEDE EN: falta desde el %s (%d dias)"
            % (queda[0].strftime("%d-%m-%Y"), len(queda)), "WARN")
        guardar_pendiente(queda)
        log("Para seguir:  python recuperar_picking.py --seguir")
    else:
        borrar_pendiente()
    log("=" * 62)
    return 0 if not queda else 1


if __name__ == "__main__":
    sys.exit(run())
