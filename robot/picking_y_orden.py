# -*- coding: utf-8 -*-
"""
REPORTES DIARIOS DEL WMS  ·  Avance de Picking y Detalle de Orden
=================================================================

Baja los dos reportes del DÍA DE AYER y los deja en sus carpetas de OneDrive,
al lado de los que Daniel viene bajando a mano.

POR QUÉ A LAS 08:00 Y DEL DÍA ANTERIOR
--------------------------------------
Empezó siendo a las 07:00, con el criterio que fijó Daniel el 13-ago-2026: el
turno noche termina 06:30, así que a esa hora el almacén está quieto y ayer ya
cerró. Ese mismo día él movió la FOTO ANCLA del turno de las 06:00 a las 07:00
—que es lo correcto: el día operativo cambia a las 06:30, o sea que la foto de
las 06:00 se tomaba antes de que empezara el día que iba a medir—, y estos
reportes tuvieron que correrse a las 08:00.

No es un detalle de comodidad: el ancla tarda unos 25 minutos, Oracle no admite
dos sesiones del mismo usuario, y el ancla es la corrida más importante del día
—sobre ella se calculan el Replenishment, la Zona Buffer y las tareas—.

La hora exacta no cambia NADA de lo que traen estos reportes: bajan ayer, que
cerró a medianoche.

Y tiene que ser el día ANTERIOR COMPLETO, no el día en curso. Si el corte fuera a
las 19:00 se perdería todos los días lo que pica el área de catálogo web entre las
20:00 y las 23:59 —hoy se cortaría antes y el archivo de mañana empieza a las
00:00—. Bajando ayer entero de 00:00 a 23:59 no se pierde nada y la foto ya no se
mueve más.

LO QUE HOY FALTA EN LOS ARCHIVOS QUE HAY
----------------------------------------
Los 18 archivos de picking cargados están filtrados de 08:00 a 20:00 —comprobado:
213.884 líneas y ni una fuera de esa franja, y la grabación de Daniel muestra que
tecleó 8:00:00 y 20:00:00 a mano—, así que el picking de catálogo web de la noche
no está en ningún reporte. Con este robot entra.

POR QUÉ FALLÓ LA PRIMERA CORRIDA (13-ago-2026, 04:20, 0 de 2)
-------------------------------------------------------------
Tres cosas, y ninguna era la que yo suponía:

1. HAY DOS BOTONES QUE SE LLAMAN "Buscar". La lupa de arriba a la izquierda ABRE
   el panel de filtros; el de abajo del panel EJECUTA la búsqueda. El código
   tomaba el último y creía estar abriendo el panel cuando en realidad lanzaba la
   búsqueda sin fechas. Se ve en la grabación de Daniel: el grabador escribió la
   lupa como get_by_role("button", name="Buscar") y al de abajo tuvo que ponerle
   el id (#dijit_form_Button_44) justamente porque ya había otro con ese nombre.

2. QUEDABAN 11 PESTAÑAS ABIERTAS. Oracle deja el panel de cada pestaña en la
   página aunque no se vea, y con once había 28 campos de fecha "a la vista" y
   varios botones "Exportar". Por eso el Exportar que se apretaba era el de otra
   pantalla y el menú "Exportar a CSV" nunca aparecía. Ahora se abre la pantalla
   por el buscador de arriba con todo lo demás cerrado, igual que el robot del
   stock, que hace eso desde el 30-jul y no falla.

3. NO EXISTE NINGÚN "Aceptar" EN EL PANEL. Se cierra con Buscar · Cancelar ·
   Borrar, y el que aplica es Buscar. Buscar un "Aceptar" costaba 45 segundos de
   espera en cada intento. (El "Aceptar" que sí existe es el de la ventanita de
   exportación, y ese se sigue usando.)

LOS CAMPOS VAN POR SU ETIQUETA, NUNCA POR POSICIÓN
--------------------------------------------------
Los identificadores del tipo dijit_form_DateTextBox_4 CAMBIAN entre sesiones: en
la grabación de Daniel la segunda fecha era la _4 y en la exploración de esa misma
madrugada la _4 era la primera. Se busca la etiqueta y se toma el campo que está
en su misma fila.

LOS ESTADOS DEL DETALLE DE ORDEN VAN VACÍOS
-------------------------------------------
Vacío quiere decir "todos", y es lo que se quiere: Cancelado no es un quiebre sino
el último estado de la lista. Probado el 13-ago-2026: con las dos fechas y los
estados vacíos, el 12-ago dio 116 páginas —unas 14.500 líneas—, del orden del
archivo que Daniel bajó a mano ese mismo día.

Vaciarlos hay que hacerlo a propósito con Borrar, porque Oracle se acuerda de lo
último que quedó puesto en la sesión anterior.

UNA DIFERENCIA CON LOS ARCHIVOS QUE BAJÓ DANIEL A MANO
------------------------------------------------------
En su grabación puso solo la fecha DESDE y dejó la de HASTA vacía, así que su
"Detalle Orden 12-08.csv" arrastra también lo que se creó la madrugada del 13. El
robot pone las dos fechas: el archivo del 12 es el 12 y nada más. Los números van
a dar parecidos pero no idénticos, y el del robot es el correcto.

CÓMO PROBARLO SIN ARRIESGAR NADA
--------------------------------
    python picking_y_orden.py --ver --sin-exportar

Abre el navegador a la vista, hace toda la navegación, dice cuántas páginas trajo
y NO exporta. Tarda un minuto y medio en vez de nueve. Es la misma navegación que
usa la corrida de verdad: no hay dos copias del camino.

ESTE PASO SOLO BAJA LOS ARCHIVOS. El resumen al servidor viene después, cuando
sepamos que la descarga anda: no tiene sentido escribir el resumen de algo que
todavía no sabemos si baja.

LA FOTO FRESCA DE LA TARDE
--------------------------
    python picking_y_orden.py --solo-pendientes

Baja SOLO el "Detalle Orden Pendientes.csv" y hasta HOY, no hasta ayer. Lo llama
`armar_pendiente.py` en cuanto entra el correo de comercial, porque la foto de las
06:57 no sirve para cruzar contra un correo de las 19:00: el 21-ago-2026 el
automático publicó 31.246 unidades cuando lo real eran 116.467 —el 87% del
pendiente son órdenes nacidas durante el día—.

A esa hora el WMS lo está usando el robot del stock, así que esta bajada **cede**:
espera 20 minutos y, si sigue ocupado, sale con código 3 sin bajar nada. Vale más
quedarse con el pendiente de ayer que pisarlo con uno a medias.
"""

import os
import re
import sys
import time
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

LOGS = os.path.join(AQUI, "logs")
DIAS_DE_LOG = 7

# El nombre de cada pantalla en el WMS, tal cual se lee arriba en la pestaña.
PANTALLA_PICKING = "TRX_ASIGNACIONES"
BUSQUEDA_PICKING = "Avance Picking"
PANTALLA_ORDEN = "REP_DETALLE DE ORDEN"

# Las etiquetas de los filtros, tal cual las escribe Oracle en el panel.
ETQ_PICK_DESDE = "Registro de hora de inicio de selección"
ETQ_PICK_HASTA = "Registro de hora de fin de selección"
ETQ_ORD_DESDE = "De registro de hora de creación"
ETQ_ORD_HASTA = "A registro de hora de creación"
ETQ_ORD_ESTADO_DE = "De estado"
ETQ_ORD_ESTADO_A = "A estado"

# LA SEGUNDA DESCARGA DEL DETALLE DE ORDEN: lo que sigue sin atender.
#
# UN AÑO HACIA ATRÁS, Y NO 90 DÍAS. Se arrancó con 90 y el 19-ago-2026 se probó una
# corrida de 365 para ver si quedaba algo colgado. Quedaba, y mucho: 45.891 pares
# —el 36% de todo el pendiente— son anteriores al 21 de mayo. Hay pedidos sin
# asignar de agosto de 2025, y el bulto está en diciembre de 2025 (18.907 pares en
# 102 líneas) y en febrero de 2026 (10.012 pares en apenas 5 líneas).
#
# Y NO CUESTA NADA: la corrida de 365 días tardó 7,9 minutos contra 7,4 la de 90, y
# el archivo pesó 11,60 MB contra 12,10. El filtro es por ESTADO, no por fecha: lo
# viejo que sigue abierto son unas pocas cientos de líneas.
DIAS_PENDIENTES = 365
# LOS DOS ESTADOS QUE PUEDEN TENER PENDIENTE, medido el 19-ago-2026 sobre los doce
# archivos que hay: "Creada" (76.113 lineas, 152.698 pares) y "Parcialmente
# asignado" (2.549 lineas, 68.563 pares). Enviado, Asignado, Empaquetado, En
# empaquetado y Cancelado NUNCA tienen: solicitada y asignada son iguales.
#
# Casi se filtra solo por "Creada" mirando un archivo suelto —el Sem30 no tenia
# parciales esa semana— y eso habria perdido el 31% de los pares pendientes.
# Lo cazo Daniel: *"yo te puse todos los estados"*.
#
# SI EL RANGO TRAE ESTADOS DE MAS, NO SE ROMPE NADA: sku_sin_salida.py se queda
# solo con las lineas donde solicitada > asignada. Lo unico que crece es el archivo.
# ══ LAS DOS LISTAS DE ESTADO TIENEN NOMBRES DISTINTOS PARA LO MISMO ══
# No es un error de tipeo: el panel del WMS escribe una cosa en "De estado" y otra
# en "A estado", y el CSV que exporta ese mismo WMS usa los de la segunda. Salió
# de los logs del 19-ago-2026, que listan lo que ofrece cada lista:
#
#   De estado:  Creado | Asign Parcial | Asignados | En seleccion | Se... |
#               En empaque | Empacado | Cargado | Enviado | Cancelado
#   A estado:   Creada | Parcialmente asignado | Asignado | En seleccion |
#               Seleccionada | En empaquetado | Empaquetado | Cargado | Enviado |
#               Cancelado
#
# Las dos vienen en el ORDEN DEL PROCESO, que es lo que hace falta: el rango va
# del primero al segundo y no incluye nada más. Si algún día el WMS les cambia el
# nombre otra vez, el log dice qué ofrece la lista y se corrige acá.
# Se aceptan LOS DOS NOMBRES de cada estado y gana el que aparezca. El WMS los
# escribe distinto segun la lista, y encima no siempre igual: el 19-ago-2026 la
# de "De estado" ofrecio los cortos a las 06:24 y los largos a las 06:47.
ESTADO_DESDE = ("Creado", "Creada")
# "Asig Parcial" SIN LA N: asi lo escribe la lista, comprobado en el log del
# 19-ago 07:42. La variante con n estaba mal leida de una captura.
ESTADO_HASTA = ("Asig Parcial", "Asign Parcial", "Parcialmente asignado")
ARCHIVO_PENDIENTES = "Detalle Orden Pendientes.csv"

# ══ LO DESPACHADO ══════════════════════════════════════════════════════════════
#
# Daniel, 28-ago-2026: *"cuando la orden es enviada, ya se despachó"*. El fill rate del
# picking no lo sabe: mide lo que salió del RACK, no lo que salió del ALMACÉN.
#
# CÓMO ES EL CIRCUITO DE VERDAD, dictado por Daniel:
#
#   Cargado  →  están pistoleando caja por caja por ruta. Está en el camión, PERO
#               TODAVÍA SIN GUÍA. Ese "cargado" se le manda por interfaz a otro
#               sistema, el SIS.
#   Enviado  →  el SIS emitió la guía —el WMS no guía— y le devuelve una interfaz al
#               WMS que le cambia el estado. Esto sí es despachado.
#
# POR ESO ENTRAN LOS DOS Y NO SE MEZCLAN. Una orden parada en "Cargado" no es un
# problema del almacén: el almacén ya hizo su parte y está esperando la guía del SIS.
# Contarla como "no despachada" le echaría al picking una demora que no es suya.
#
# NO SIRVE EL ESTADO DEL DETALLE DIARIO. Ese archivo trae las órdenes CREADAS ese día
# y guarda el estado de ese momento —casi todas "Creada"—; una orden aparece en UNA
# sola foto y nunca se actualiza. Medido el 28-ago sobre 5.484 órdenes: ninguna sale en
# dos archivos. Por eso lo picado el 27 daba 73,6% "Creada" y 0,7% "Enviado", que no es
# la realidad sino el estado congelado del día en que nacieron.
ESTADO_DESP_DESDE = ("Cargado", "Cargada")
ESTADO_DESP_HASTA = ("Enviado", "Enviada")
ARCHIVO_DESPACHADOS = "Detalle Orden Despachados.csv"
# TREINTA DÍAS, no 365 como los pendientes. Una orden se despacha a los pocos días de
# creada, así que 30 cubre de sobra y deja el archivo chico. Lo que hace falta es poder
# preguntar "esta orden que se picó, ¿salió?", y lo que se mira es el picking del mes.
DIAS_DESPACHADOS = 30
MINIMO_KB_DESPACHADOS = 200

# Cuánto tiene que pesar cada archivo para darlo por bueno. Los que ya están
# cargados van de 3,7 a 8,8 MB el picking y 3,4 MB el detalle de un día; el piso
# está bien abajo para que un domingo flojo no dispare la alarma, pero deja afuera
# los 30 KB que baja una búsqueda mal filtrada.
MINIMO_KB_PICKING = 500
MINIMO_KB_ORDEN = 300
# Los pendientes de 90 días eran 64.000 líneas el 19-ago-2026, unos 15 MB. El piso
# va bajo a propósito: lo que tiene que delatar es una búsqueda mal filtrada de
# 30 KB, no un mes flojo.
MINIMO_KB_PENDIENTES = 300

# CUANTO SE LE DA A ORACLE PARA ARMAR EL CSV, en minutos. Los reportes de siempre lo
# arman en dos o tres; el OBLPN es mucho mas pesado y le pasa su propio valor.
MINUTOS_ARMADO = 15

_LOG = None
_PASO = 0


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
    _LOG = os.path.join(LOGS, "picking_orden_%s.log" % datetime.now().strftime("%Y-%m-%d_%H%M%S"))
    # Los logs se borran solos a los 7 días, como en el robot de la hora.
    corte = time.time() - DIAS_DE_LOG * 86400
    for f in os.listdir(LOGS):
        if f.startswith(("picking_orden_", "reportes_")) and f.endswith(".log"):
            p = os.path.join(LOGS, f)
            try:
                if os.path.getmtime(p) < corte:
                    os.remove(p)
            except OSError:
                pass


def dia_pedido():
    """Qué día hay que bajar.

    Sin argumentos es AYER, que es lo que corre solo a las 08:00.

    CON `--dia 12-08-2026` SE RECUPERA CUALQUIER DÍA PASADO, y esa es la salida de
    emergencia: si una mañana el robot falla —se cayó internet, Oracle andaba
    lento, el servidor se estaba reiniciando— ese día NO se pierde. El WMS guarda
    la historia; lo único que hacía falta era poder pedírsela.

    Sin esto, un día que no bajó a la mañana no lo baja nunca más nadie.
    """
    for i, a in enumerate(sys.argv):
        valor = None
        if a.startswith("--dia="):
            valor = a.split("=", 1)[1]
        elif a == "--dia" and i + 1 < len(sys.argv):
            valor = sys.argv[i + 1]
        if not valor:
            continue
        for formato in ("%d-%m-%Y", "%d/%m/%Y", "%d-%m", "%d/%m"):
            try:
                d = datetime.strptime(valor, formato)
                return d.replace(year=datetime.now().year) if d.year == 1900 else d
            except ValueError:
                continue
        raise SystemExit("No entendí la fecha '%s'. Se escribe asi: --dia 12-08-2026" % valor)
    # SIN --dia, la corrida de las 08:00 baja AYER. La bajada de la tarde
    # -`--solo-pendientes`, la que dispara el correo de comercial- tiene que
    # llegar hasta HOY: lo que busca son justamente las ordenes nacidas durante
    # el dia, que a las 06:57 todavia no existian.
    if "--solo-pendientes" in sys.argv:
        return datetime.now()
    return datetime.now() - timedelta(days=1)


def foto(page, nombre):
    """Una captura numerada de cada paso. Solo en modo prueba: cuando algo no sale
    como se esperaba, la foto dice en un segundo lo que el log no dice en veinte
    líneas. Fue lo que destrabó esto la primera vez."""
    global _PASO
    _PASO += 1
    ruta = os.path.join(LOGS, "paso_%02d_%s.png" % (_PASO, nombre))
    try:
        page.screenshot(path=ruta, full_page=True)
        log("   foto: %s" % os.path.basename(ruta))
    except Exception:
        pass


# ──────────────────── Abrir la pantalla, sola y sin vecinas ────────────────────

def abrir_pantalla(page, nombre):
    """Cierra TODO y abre la pantalla pedida desde el buscador de arriba.

    ES EL PASO QUE MÁS IMPORTA. Con otras pestañas abiertas, Oracle deja los
    paneles de todas ellas en la página: hay varios campos "De registro de hora de
    creación", varios botones "Buscar" y varios "Exportar", y no hay forma de saber
    cuál es el de la pantalla que uno está mirando. Con una sola pestaña abierta
    cada nombre vuelve a ser único y todo lo demás se simplifica.

    Es exactamente lo que hace descargar_stock_activo() desde el 30-jul-2026.
    """
    import wms_automation_final as wms

    cerradas = wms.cerrar_pestanas(page)
    time.sleep(1)
    pestanas = page.locator("[role='tab']").count()
    log("Pestañas cerradas: %d · quedan %d" % (cerradas, pestanas))
    if pestanas > 1:
        log("Todavía quedan %d pestañas abiertas; los nombres pueden repetirse"
            % pestanas, "WARN")

    buscador = page.get_by_role("textbox", name="Select Screen Textbox")
    buscador.wait_for(state="visible", timeout=60000)
    buscador.click()
    buscador.fill("")
    buscador.type(nombre, delay=120)
    time.sleep(2)
    try:
        page.get_by_role("option", name=nombre).first.click(force=True, timeout=15000)
    except Exception:
        # Si el buscador no la ofrece, se cae a la pestaña, que es como se llegaba
        # antes. Se avisa, porque entonces vuelven a convivir dos paneles.
        log("El buscador no ofreció '%s'; se abre por la pestaña" % nombre, "WARN")
        try:
            page.get_by_role("button", name="Tablist Right Button").click(timeout=4000)
            time.sleep(1)
        except Exception:
            pass
        page.get_by_role("tab", name=nombre).click(timeout=30000)
    time.sleep(4)
    log("Pantalla %s abierta" % nombre)


# ─────────────────── Los dos "Buscar": la lupa y el de abajo ───────────────────

def _buscar_ordenados(page):
    """Todos los botones llamados "Buscar" que están a la vista, de arriba hacia
    abajo, con su altura. Se descartan los del encabezado negro (el buscador global
    de Oracle también se llama "Buscar" y vive arriba del todo)."""
    loc = page.get_by_role("button", name="Buscar").filter(visible=True)
    encontrados = []
    for i in range(loc.count()):
        b = loc.nth(i)
        try:
            caja = b.bounding_box()
        except Exception:
            caja = None
        if caja and caja["y"] > 100:
            encontrados.append((caja["y"], b))
    encontrados.sort(key=lambda t: t[0])
    return encontrados


def abrir_panel(page):
    """Abre el panel de filtros con la LUPA, que es el "Buscar" de más arriba.

    Si ya hay dos, el panel estaba abierto y no hay que tocar nada: apretar la lupa
    otra vez lo cerraría.
    """
    lista = _buscar_ordenados(page)
    log("Botones 'Buscar' a la vista: %d (alturas: %s)"
        % (len(lista), ", ".join(str(int(y)) for y, _ in lista)))

    if len(lista) >= 2:
        log("El panel de filtros ya estaba abierto")
        return
    if not lista:
        raise RuntimeError("No aparece la lupa para abrir el panel de filtros")

    lista[0][1].click(timeout=15000)
    time.sleep(2.5)
    lista = _buscar_ordenados(page)
    log("Panel abierto · ahora hay %d botones 'Buscar' (alturas: %s)"
        % (len(lista), ", ".join(str(int(y)) for y, _ in lista)))
    if len(lista) < 2:
        raise RuntimeError("La lupa no abrió el panel de filtros")


def ejecutar_busqueda(page):
    """El "Buscar" de abajo del panel, el que aplica los filtros. Es el de más
    abajo en la pantalla. NO hay ningún "Aceptar": el panel se cierra con
    Buscar · Cancelar · Borrar."""
    lista = _buscar_ordenados(page)
    if not lista:
        raise RuntimeError("No aparece el botón Buscar del panel")
    y, boton = lista[-1]
    log("Ejecutando la búsqueda (botón a la altura %d)" % int(y))
    boton.click(timeout=20000)


# ──────────────────── Los campos, buscados por su etiqueta ────────────────────

def _campo(page, etiqueta, prefijo):
    """El campo que está en la misma fila que la etiqueta.

    En el panel de Oracle cada filtro es una fila de tabla: la etiqueta en una
    celda y el campo en la de al lado. Se prueban tres formas de llegar porque
    algunas filas envuelven el campo un nivel más adentro; la primera que
    encuentre algo, gana, y queda anotado cuál fue.
    """
    intentos = (
        ("celda de al lado",
         "xpath=//td[starts-with(normalize-space(.), \"%s\")]"
         "/following-sibling::td[1]//input[starts-with(@id,'%s')]" % (etiqueta, prefijo)),
        ("misma fila",
         "xpath=//td[starts-with(normalize-space(.), \"%s\")]"
         "/ancestor::tr[1]//input[starts-with(@id,'%s')]" % (etiqueta, prefijo)),
        ("desde la etiqueta",
         "xpath=//label[starts-with(normalize-space(.), \"%s\")]"
         "/ancestor::tr[1]//input[starts-with(@id,'%s')]" % (etiqueta, prefijo)),
    )
    for como, xp in intentos:
        loc = page.locator(xp).filter(visible=True)
        n = loc.count()
        if n:
            if n > 1:
                log("   '%s': %d campos coinciden, se toma el primero (%s)"
                    % (etiqueta, n, como), "WARN")
            return loc.first
    raise RuntimeError("No se encontró el campo '%s' en el panel" % etiqueta)


def _escribir(campo, valor):
    campo.click()
    campo.fill("")
    campo.type(valor, delay=60)
    campo.press("Escape")   # cierra el calendario o la lista de horas que se abre sola
    time.sleep(0.4)


def poner_fecha_y_hora(page, etiqueta, fecha, hora):
    """La fecha y la hora de una misma fila del panel.

    SE TECLEA, NO SE NAVEGA EL CALENDARIO. La grabación llegaba a la fecha a fuerza
    de clics en celdas como "12", que es el día del mes: eso funciona una vez y
    falla al día siguiente.
    """
    _escribir(_campo(page, etiqueta, "dijit_form_DateTextBox_"), fecha)
    if hora is not None:
        try:
            _escribir(_campo(page, etiqueta, "dijit_form_TimeTextBox_"), hora)
        except RuntimeError:
            log("   '%s' no tiene campo de hora, se deja solo la fecha" % etiqueta)
            hora = None
    log("   %s = %s%s" % (etiqueta, fecha, (" " + hora) if hora else ""))


def limpiar_panel(page):
    """El botón "Borrar" del panel, que deja todos los filtros vacíos.

    HACE FALTA PORQUE ORACLE SE ACUERDA. El panel viene con lo último que quedó de
    la sesión anterior: la exploración del 13-ago encontró "De registro de hora de
    modificación" con 30/12/2025 y los estados en Asignado/Asignados sin que nadie
    los pusiera. Un filtro viejo que nadie ve deja el archivo corto y el archivo
    corto parece bueno.

    Es el mismo Borrar que aprieta el robot del Stock Activo antes de cada
    búsqueda. NO se usa en el picking: ahí los filtros los pone la búsqueda
    guardada y Borrar los tiraría.
    """
    import wms_automation_final as wms
    wms.boton_visible(page, "Borrar").click(timeout=15000)
    time.sleep(1.5)
    log("   panel limpio (Borrar)")


# ─────────────────── Esperar de verdad a que Oracle conteste ───────────────────

def total_paginas(page):
    """Cuántas páginas de resultados hay, leídas del pie de la grilla.

    El pie dice "Recuperados 13/08/2026 5:04:52   1 / 116 Páginas" cuando terminó,
    y "0 / 0 Páginas" mientras busca. Son 125 filas por página, así que 116 páginas
    son unas 14.500 líneas: un día entero.
    """
    # GANA EL PIE QUE TRAE LA HORA. En la pantalla del OBLPN hay varios elementos con la
    # palabra "Páginas" y el último es uno pelado —"/ 282 Páginas"—, sin el "Recuperados
    # <fecha> <hora>" de adelante. Sin la hora, dos búsquedas iguales se ven idénticas y
    # `esperar_resultado` espera un cambio que nunca llega: el 29-ago-2026 el reintento del
    # 27 se quedó 11 minutos mirando el mismo número, con el resultado ya en pantalla.
    txt = ""
    try:
        con_hora = page.locator(
            "xpath=//*[contains(text(),'Páginas') and contains(text(),'Recuperados')]"
        ).filter(visible=True)
        if con_hora.count():
            txt = con_hora.last.inner_text()
    except Exception:
        txt = ""
    if not txt:
        try:
            txt = page.locator("xpath=//*[contains(text(),'Páginas')]").filter(
                visible=True).last.inner_text()
        except Exception:
            return None, ""
    txt = " ".join(txt.split())
    m = re.search(r"/\s*([\d.,]+)\s*P", txt)
    if not m:
        return None, txt
    try:
        return int(m.group(1).replace(".", "").replace(",", "")), txt
    except ValueError:
        return None, txt


def esperar_resultado(page, timeout_seg=600, distinto_de=None):
    """Espera a que la búsqueda TRAIGA DATOS, no a que la pantalla se quede quieta.

    POR QUÉ NO SIRVE esperar_datos(): cuenta las filas de la página y las da por
    buenas cuando el número deja de moverse. Mientras Oracle busca, la grilla
    muestra su armazón vacío —43 filas— y ese número no se mueve nunca. El 13-ago
    a las 05:04 dio "cargada" a los 10 segundos con el reloj todavía girando, y el
    robot se iba a exportar una tabla vacía.

    Lo que sí prueba que llegó la data es el pie: pasa a decir "Recuperados" con la
    hora y el total de páginas. Se espera eso.

    Y HAY UN SEGUNDO FALSO POSITIVO, cazado el 19-ago-2026 en la prueba en seco de
    los pendientes: el pie de la búsqueda ANTERIOR sigue en pantalla. La de los
    pendientes dio "96 Páginas en 0 segundos", que eran las 96 del Detalle de Orden
    que se había buscado un minuto antes. Un resultado viejo se ve idéntico a uno
    bueno. Por eso `distinto_de` recibe el pie de antes de apretar Buscar y se
    espera a que CAMBIE. Sin eso, el robot exporta lo que ya estaba en la grilla.
    """
    inicio = time.time()
    aviso = 0
    while time.time() - inicio < timeout_seg:
        paginas, txt = total_paginas(page)
        transcurrido = int(time.time() - inicio)

        if paginas and txt.strip() != (distinto_de or "").strip():
            time.sleep(3)                       # que termine de asentarse
            paginas, txt = total_paginas(page)
            log("Resultado: %s  (%ds)" % (txt, transcurrido))
            return paginas

        # Si ya contestó y de verdad no hay nada, no tiene sentido esperar 10
        # minutos: se corta enseguida y el que llama decide.
        try:
            listo = page.locator("xpath=//*[contains(text(),'Recuperados')]").filter(
                visible=True).count() > 0
        except Exception:
            listo = False
        # EL "Recuperados" DE LA BÚSQUEDA ANTERIOR TAMBIÉN CUENTA COMO CONTESTADO,
        # y por eso este corte se disparaba a los 18 segundos con una búsqueda que
        # todavía estaba corriendo (19-ago-2026, los pendientes). Cuando se pidió
        # un pie distinto, esto solo vale si el pie YA cambió.
        cambio = txt.strip() != (distinto_de or "").strip()
        if listo and transcurrido > 15 and (distinto_de is None or cambio):
            log("Oracle contestó y no trajo ninguna fila (%s)" % txt, "ERROR")
            return 0

        if transcurrido - aviso >= 30:
            aviso = transcurrido
            log("Buscando... %ds  (%s)" % (transcurrido, txt or "sin pie de grilla"))
        time.sleep(3)

    log("Se agotaron los %ds esperando la data" % timeout_seg, "WARN")
    return 0


# ──────────────────────────── Exportar el CSV ────────────────────────────

def abrir_menu_exportar(page):
    """El botón "Exportar".

    En la grabación de Daniel salió como un botón normal, pero en las capturas de
    la exploración la barra de la pantalla no lo muestra: está detrás del menú "…"
    de la derecha. Depende del ancho que le quede a la barra, así que se prueban
    los dos caminos en vez de apostar a uno.
    """
    import wms_automation_final as wms
    try:
        wms.boton_visible(page, "Exportar", timeout=6000).click(force=True)
        log("Exportar estaba en la barra")
        return
    except Exception:
        pass

    log("Exportar no está en la barra; se abre el menú '…'")
    abierto = False
    for nombre in ("...", "…", "More", "Más", "Más opciones", "More Options"):
        try:
            page.get_by_role("button", name=nombre, exact=True).filter(
                visible=True).last.click(timeout=3000)
            abierto = True
            log("Menú '%s' abierto" % nombre)
            break
        except Exception:
            continue
    if not abierto:
        # Último recurso: el icono de más a la derecha de la barra de la pantalla.
        try:
            page.locator("[class*='overflow'], [class*='moreButton'], [class*='dijitMenuBar'] "
                         "[class*='Menu']").filter(visible=True).last.click(timeout=4000)
            abierto = True
            log("Menú '…' abierto por el icono de la derecha")
        except Exception:
            pass
    if not abierto:
        raise RuntimeError("No se pudo abrir ni el botón Exportar ni el menú '…'")
    time.sleep(1.5)
    wms.boton_visible(page, "Exportar", timeout=10000).click(force=True)


def sello_exportacion(page):
    """El pie de la pantalla dice "Exportación a CSV reciente (13/08/2026 3:31:14)".

    ESE SELLO ES EL SEGURO. Al lado hay un enlace "Descargar" que ya existe ANTES de
    exportar nada, y apunta a la exportación anterior —la que hizo Daniel a mano
    esta madrugada, por ejemplo—. Si el robot lo aprieta apenas termina de pedir el
    archivo nuevo, se trae el viejo: un archivo del tamaño correcto, con el nombre
    correcto y los datos de otro momento.

    Ya pasó una vez, el 06-ago-2026, por otro camino: el servidor publicó el stock
    de las 08:23 como si fuera el de las 19:00 y se armó una corrida entera de
    tareas sobre mercadería ya guardada. La regla que salió de ahí es esta: el
    robot no puede publicar un archivo que no sea de su propia corrida.
    """
    try:
        txt = page.locator("xpath=//*[contains(text(),'Exportación a CSV')]").filter(
            visible=True).last.inner_text()
        return " ".join(txt.split())
    except Exception:
        return ""


def exportar_csv(page, destino, minimo_kb, minutos_armado=MINUTOS_ARMADO):
    """Exportar -> Exportar a CSV -> Aceptar -> esperar el sello nuevo -> Descargar.

    Es el mismo camino que baja el Stock Activo todos los días desde el 30-jul-2026,
    con el seguro del sello agregado.

    `minutos_armado` es cuánto se le da a Oracle para armar el archivo. Son 15 para los
    reportes de siempre y 30 para el OBLPN, que es el más pesado: la corrida del 29-ago a
    las 04:16 se rindió a los 15 minutos con el archivo todavía armándose."""
    import wms_automation_final as wms

    sello_viejo = sello_exportacion(page)
    log("Exportación que ya estaba en pantalla: %s" % (sello_viejo or "ninguna"))

    log("Exportando a CSV...")
    abrir_menu_exportar(page)
    time.sleep(2)
    wms.boton_visible(page, "Exportar a CSV").click(force=True)
    time.sleep(1)
    wms.boton_visible(page, "Aceptar").click(force=True)

    log("Esperando a que el servidor arme el archivo (hasta %d minutos)..." % minutos_armado)
    inicio = time.time()
    aviso = 0
    sello_nuevo = ""
    while time.time() - inicio < minutos_armado * 60:
        sello_nuevo = sello_exportacion(page)
        if sello_nuevo and sello_nuevo != sello_viejo:
            log("Archivo listo: %s  (%.1f min)" % (sello_nuevo, (time.time() - inicio) / 60.0))
            break
        transcurrido = int(time.time() - inicio)
        if transcurrido - aviso >= 60:
            aviso = transcurrido
            log("   armando el archivo... %d min" % (transcurrido // 60))
        time.sleep(5)
    else:
        log("Pasaron %d minutos y la exportación sigue diciendo lo mismo (%s). No se "
            "descarga nada: sería el archivo anterior."
            % (minutos_armado, sello_viejo or "nada"), "ERROR")
        wms.captura(page, "export_no_llego")
        return False

    with page.expect_download(timeout=300000) as info:
        time.sleep(1)
        page.get_by_role("link", name="Descargar").last.click(force=True, timeout=120000)
    descarga = info.value
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    descarga.save_as(destino)

    kb = os.path.getsize(destino) / 1024.0
    if kb < minimo_kb:
        log("El archivo bajó con solo %.0f KB, se esperaban más de %d KB"
            % (kb, minimo_kb), "ERROR")
        wms.captura(page, "archivo_chico")
        return False
    log("Guardado: %.2f MB en %s" % (kb / 1024.0, destino))
    return True


# ──────────────────────────── Los dos reportes ────────────────────────────

def descargar_picking(page, destino, dia, desde="0:00:00", hasta="23:59:59",
                      sin_exportar=False, con_fotos=False, minimo_kb=None):
    """Avance de Picking de un día, entre dos horas.

    LA FRANJA COMPLETA ES EL PUNTO cuando se baja el día cerrado. Los archivos que
    hay están cortados de 08:00 a 20:00 y por eso el picking nocturno de catálogo
    web no aparece en ningún reporte de la plataforma.

    LAS HORAS SON PARÁMETRO PARA QUE EL ROBOT DE LA HORA REUSE ESTA MISMA FUNCIÓN.
    El de las 08:00 pide el día de ayer entero; el de cada hora pide el día
    en curso de 00:00 hasta ahora. Es UNA sola navegación con dos llamadores: el
    05-ago-2026 ya se pagó el precio de tener la misma lógica en dos archivos,
    cuando uno se arregló y el otro no.
    """
    import wms_automation_final as wms
    log("=" * 58)
    log("AVANCE DE PICKING · %s · %s a %s" % (dia.strftime("%d-%m-%Y"), desde, hasta))
    log("=" * 58)

    abrir_pantalla(page, PANTALLA_PICKING)
    if con_fotos:
        foto(page, "picking_abierta")
    abrir_panel(page)

    # EL PICKING NO LLEVA FILTRO DE ESTADO, y este robot tampoco se lo pone: la
    # búsqueda guardada solo sirve para dejar el panel armado —la pantalla pide una
    # fecha de creación obligatoria— y las fechas de selección se escriben encima,
    # que por eso van después: puestas antes, la búsqueda guardada las pisa.
    #
    # ACÁ DECÍA que la búsqueda guardada traía "De estado = Asignado, A estado =
    # Asignados". ERA FALSO, y lo corrigió Daniel el 20-ago-2026: él nunca le puso
    # estado al bajarlo a mano. Los datos le dan la razón —el archivo del 18-ago
    # trae Finalizada 12.857, Cancelado 7.903 y Asignado 4 a la vez, y con un
    # filtro de un solo estado saldría uno solo—.
    #
    # OJO AL LEER EL ARCHIVO: "Cancelado" NO es un quiebre, es una copia. Cada pick
    # real deja dos filas -la tarea queda Cancelado con contenedor PRE…, y la
    # confirmación Finalizada con el contenedor real-, misma ubicación, misma
    # persona, el mismo segundo. Se cuenta solo Finalizada.
    log("Eligiendo la búsqueda guardada '%s'..." % BUSQUEDA_PICKING)
    elegir_busqueda_guardada(page, BUSQUEDA_PICKING)
    if con_fotos:
        foto(page, "picking_busqueda_guardada")

    f = dia.strftime("%d/%m/%Y")
    poner_fecha_y_hora(page, ETQ_PICK_DESDE, f, desde)
    poner_fecha_y_hora(page, ETQ_PICK_HASTA, f, hasta)
    if con_fotos:
        foto(page, "picking_filtros_puestos")

    ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    if not esperar_resultado(page):
        wms.captura(page, "picking_sin_datos")
        raise TimeoutError("El picking del %s no trajo ninguna fila"
                           % dia.strftime("%d-%m-%Y"))
    if con_fotos:
        foto(page, "picking_resultado")

    if sin_exportar:
        log("MODO PRUEBA: no se exporta")
        return True
    # EL PISO DE TAMAÑO ES PARÁMETRO PORQUE NO SIRVE EL MISMO PARA LOS DOS.
    # Un día completo pesa entre 3,7 y 8,8 MB, así que 500 KB delata una búsqueda
    # mal filtrada. Pero el robot de la hora pide "hoy hasta ahora": a las 08:00
    # son cuatro horas de catálogo web y unos pocos cientos de líneas, y con el
    # piso del día entero daría por fallada una corrida que estuvo perfecta.
    return exportar_csv(page, destino, minimo_kb if minimo_kb is not None
                        else MINIMO_KB_PICKING)


def elegir_busqueda_guardada(page, nombre):
    """Las búsquedas guardadas están plegadas arriba del panel y hacen falta DOS
    clics: uno abre el bloque y otro abre la lista. La grabación de Daniel muestra
    los dos; con uno solo, la opción no existe todavía y el robot se queda
    esperándola hasta agotar el tiempo. Eso fue lo que falló en los tres intentos
    del picking el 13-ago."""
    page.get_by_role("button", name="Búsquedas guardadas").filter(
        visible=True).last.click(timeout=15000)
    time.sleep(1.5)

    try:
        page.get_by_role("option", name=nombre).first.click(timeout=4000)
        log("   búsqueda guardada elegida (la lista ya estaba abierta)")
    except Exception:
        # La flechita del desplegable. Se toma la de más arriba: el bloque de las
        # búsquedas guardadas está al tope del panel.
        flechas = page.locator("[class*='dijitArrowButtonContainer']").filter(visible=True)
        conY = []
        for i in range(flechas.count()):
            e = flechas.nth(i)
            try:
                caja = e.bounding_box()
            except Exception:
                caja = None
            if caja and caja["y"] > 100:
                conY.append((caja["y"], e))
        conY.sort(key=lambda t: t[0])
        if not conY:
            raise RuntimeError("No aparece la lista de búsquedas guardadas")
        conY[0][1].click(timeout=8000)
        time.sleep(1.2)
        page.get_by_role("option", name=nombre).first.click(timeout=15000)
        log("   búsqueda guardada elegida (hubo que abrir la lista)")
    time.sleep(2.5)


def descargar_detalle_orden(page, destino, dia, sin_exportar=False, con_fotos=False):
    """Detalle de Orden del día, con TODOS los estados.

    LOS ESTADOS SE DEJAN VACÍOS, que es lo que trae todos. Se probó el 13-ago:
    solo con las dos fechas, el 12-ago dio 116 páginas —unas 14.500 líneas—, del
    orden del archivo que Daniel bajó a mano ese mismo día.

    Y NO SE TOCAN LOS CAMPOS DE ESTADO. Escribir en ellos salió caro: son listas
    desplegables y el Enter que las confirma DISPARA LA BÚSQUEDA. El panel se
    cerraba a mitad de camino y el filtro siguiente ya no existía. Lo que hay que
    hacer es vaciarlos, y para eso está Borrar.
    """
    import wms_automation_final as wms
    log("=" * 58)
    log("DETALLE DE ORDEN · %s" % dia.strftime("%d-%m-%Y"))
    log("=" * 58)

    abrir_pantalla(page, PANTALLA_ORDEN)
    if con_fotos:
        foto(page, "orden_abierta")
    abrir_panel(page)
    limpiar_panel(page)

    f = dia.strftime("%d/%m/%Y")
    poner_fecha_y_hora(page, ETQ_ORD_DESDE, f, "0:00:00")
    poner_fecha_y_hora(page, ETQ_ORD_HASTA, f, "23:59:59")
    if con_fotos:
        foto(page, "orden_filtros_puestos")

    ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    if not esperar_resultado(page):
        wms.captura(page, "orden_sin_datos")
        raise TimeoutError("El detalle de orden del %s no trajo ninguna fila"
                           % dia.strftime("%d-%m-%Y"))
    if con_fotos:
        foto(page, "orden_resultado")

    if sin_exportar:
        log("MODO PRUEBA: no se exporta")
        return True
    return exportar_csv(page, destino, MINIMO_KB_ORDEN)



# ─────────────────── La segunda descarga: lo que sigue pendiente ───────────────

def poner_estado(page, etiqueta, valor):
    """Elige un valor en una lista desplegable del panel SIN ESCRIBIR NI DAR ENTER.

    ESCRIBIR EN LOS ESTADOS SALIÓ CARO Y ESTÁ DOCUMENTADO ARRIBA: son listas de
    Oracle y el Enter que las confirma DISPARA LA BÚSQUEDA, así que el panel se
    cierra a mitad de camino y el filtro siguiente ya no existe.

    Acá se hace lo mismo que con las búsquedas guardadas, que sí funciona hace
    meses: se abre la lista con su flechita y se hace CLIC en la opción. Sin
    teclado, no hay Enter que dispare nada.
    """
    fila = ("xpath=//td[starts-with(normalize-space(.), \"%s\")]/ancestor::tr[1]"
            % etiqueta)
    flechas = page.locator(fila + "//*[contains(@class,'dijitArrowButtonContainer')]"
                           ).filter(visible=True)
    if not flechas.count():
        raise RuntimeError("No aparece la lista de '%s'" % etiqueta)

    # LA LISTA ANTERIOR PUEDE HABER QUEDADO ABIERTA y se come el clic de la
    # siguiente. Escape antes de nada: es lo que falló el 19-ago con 'A estado'.
    try:
        page.keyboard.press("Escape")
        time.sleep(0.5)
    except Exception:
        pass

    flechas.first.click(timeout=10000)
    time.sleep(1.5)

    # SE PRUEBAN LOS DOS NOMBRES y gana el que exista. Sin exact=True: alcanza
    # con que la opcion EMPIECE como lo que se pide.
    candidatos = (valor,) if isinstance(valor, str) else tuple(valor)
    opcion = None
    for cand in candidatos:
        loc = page.get_by_role("option", name=re.compile(
            r"^\s*" + re.escape(cand[:14]), re.IGNORECASE))
        if loc.count():
            opcion = loc
            break
    if opcion is None:
        hay = page.get_by_role("option")
        nombres = []
        for i in range(min(hay.count(), 25)):
            try:
                t = hay.nth(i).inner_text().strip()
            except Exception:
                continue
            if t:
                nombres.append(t)
        log("   la lista de '%s' ofrece: %s"
            % (etiqueta, " | ".join(nombres) if nombres else "(ninguna opción a la vista)"),
            "WARN")
        raise RuntimeError("Ninguno de %s esta en la lista de '%s'"
                           % (" ni ".join(candidatos), etiqueta))
    # SE ANOTA LO QUE SE CLICO, NO LO QUE SE PIDIO. En la prueba del 19-ago el log
    # decia "A estado = Parcialmente asignado" cuando en la lista esa opcion ni
    # existe: anunciaba el pedido, no el hecho. Un log que dice lo que queriamos
    # hacer no sirve para saber que paso.
    try:
        elegido = opcion.first.inner_text().strip()
    except Exception:
        elegido = valor
    opcion.first.click(timeout=10000)
    time.sleep(1.0)
    log("   %s = %s" % (etiqueta, elegido))


def descargar_pendientes(page, destino, hasta_dia, dias=DIAS_PENDIENTES,
                         sin_exportar=False, con_fotos=False):
    """El Detalle de Orden de TODO lo que sigue sin atender, hasta %d días atrás.

    POR QUÉ EXISTE. La descarga de arriba trae las órdenes CREADAS AYER, y nada
    más. Una orden del 22 de julio no se creó ayer: no vuelve a aparecer nunca, ni
    para decir que sigue esperando ni para decir que ya se atendió. El cuadro de
    SKUs sin salida mostraba el 19-ago un pendiente de 1.136 pares que salía de un
    archivo que Daniel bajó a mano el 12-ago; medido, el 52%% de los pares
    pendientes venía de archivos a mano.

    LA VENTANA ES DE 90 DÍAS y la eligió Daniel el 19-ago-2026. Lo más viejo que
    seguía pendiente ese día era del 09-jul —41 días—, y sus archivos no llegaban
    más atrás, así que 90 sirve además para descubrir si hay pendientes de mayo o
    junio que hoy no ve nadie.

    EL FILTRO VA DE "Creada" A "Parcialmente asignado", que son los dos únicos
    estados que pueden tener pendiente —medido sobre los doce archivos que hay— y
    los mismos dos que traen los semanales de Daniel. Sin filtro de estado esto
    traería 90 días de TODO —unas 900.000 líneas, 7.200 páginas— y no terminaría.

    El archivo se llama siempre igual y se pisa: es una foto del pendiente de hoy,
    no un histórico.
    """
    import wms_automation_final as wms
    desde_dia = hasta_dia - timedelta(days=dias - 1)
    log("=" * 58)
    log("PENDIENTES · del %s al %s (%d días)"
        % (desde_dia.strftime("%d-%m-%Y"), hasta_dia.strftime("%d-%m-%Y"), dias))
    log("=" * 58)

    abrir_pantalla(page, PANTALLA_ORDEN)
    abrir_panel(page)
    limpiar_panel(page)

    poner_fecha_y_hora(page, ETQ_ORD_DESDE, desde_dia.strftime("%d/%m/%Y"), "0:00:00")
    poner_fecha_y_hora(page, ETQ_ORD_HASTA, hasta_dia.strftime("%d/%m/%Y"), "23:59:59")

    # Los estados van DESPUÉS de las fechas: si la lista dispara una búsqueda por
    # su cuenta, que al menos salga con las fechas ya puestas y no con 90 días de
    # todo el almacén.
    for etq, val in ((ETQ_ORD_ESTADO_DE, ESTADO_DESDE), (ETQ_ORD_ESTADO_A, ESTADO_HASTA)):
        try:
            poner_estado(page, etq, val)
        except Exception as e:
            log("   NO se pudo poner '%s' = %s (%s: %s). El archivo va a salir "
                "enorme: son 90 dias de todos los estados."
                % (etq, val, type(e).__name__, str(e)[:120]), "WARN")
    if con_fotos:
        foto(page, "pendientes_filtros_puestos")

    _, pie_antes = total_paginas(page)      # el pie que deja la búsqueda anterior
    ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    if not esperar_resultado(page, timeout_seg=420, distinto_de=pie_antes):
        wms.captura(page, "pendientes_sin_datos")
        raise TimeoutError("Los pendientes no trajeron ninguna fila")
    if con_fotos:
        foto(page, "pendientes_resultado")

    if sin_exportar:
        log("MODO PRUEBA: no se exporta")
        return True
    return exportar_csv(page, destino, MINIMO_KB_PENDIENTES)


# ──────────────────────────────── La corrida ────────────────────────────────

def descargar_despachados(page, destino, hasta_dia, dias=DIAS_DESPACHADOS,
                          sin_exportar=False, con_fotos=False):
    """El Detalle de Orden de lo que ya salio del almacen, hasta %d dias atras.

    POR QUE EXISTE. El fill rate del picking dice cuanto salio del rack; no dice si eso
    llego al camion. Con este archivo se puede preguntar, para cada orden que se pico,
    si termino en "Enviado" -guiada por el SIS y despachada- o si sigue en el patio.

    EL FILTRO VA DE "Cargado" A "Enviado", los dos ultimos de la cadena del WMS. Ver el
    bloque de arriba: son dos cosas distintas y el reporte no las puede juntar.

    El archivo se pisa en cada corrida: es la foto de lo despachado del ultimo mes, no
    un historico. El historico de lo picado ya lo tiene el archivo de picking de cada dia.
    """
    import wms_automation_final as wms
    desde_dia = hasta_dia - timedelta(days=dias - 1)
    log("=" * 58)
    log("DESPACHADOS - del %s al %s (%d dias) - estados Cargado y Enviado"
        % (desde_dia.strftime("%d-%m-%Y"), hasta_dia.strftime("%d-%m-%Y"), dias))
    log("=" * 58)

    abrir_pantalla(page, PANTALLA_ORDEN)
    abrir_panel(page)
    limpiar_panel(page)

    poner_fecha_y_hora(page, ETQ_ORD_DESDE, desde_dia.strftime("%d/%m/%Y"), "0:00:00")
    poner_fecha_y_hora(page, ETQ_ORD_HASTA, hasta_dia.strftime("%d/%m/%Y"), "23:59:59")

    # Igual que en los pendientes: los estados van DESPUES de las fechas, por si la
    # lista dispara una busqueda por su cuenta.
    for etq, val in ((ETQ_ORD_ESTADO_DE, ESTADO_DESP_DESDE),
                     (ETQ_ORD_ESTADO_A, ESTADO_DESP_HASTA)):
        try:
            poner_estado(page, etq, val)
        except Exception as e:
            # SIN EL FILTRO NO SE BAJA NADA. Aca no vale el "que salga grande y ya":
            # sin estado esto trae 30 dias de TODAS las ordenes, y el reporte creeria
            # que todo eso se despacho. Un archivo que no esta se nota; uno que miente,
            # no.
            log("   NO se pudo poner '%s' = %s (%s: %s). Sin ese filtro el archivo "
                "traeria todos los estados y el reporte contaria como despachado lo "
                "que no lo esta. No se baja."
                % (etq, val, type(e).__name__, str(e)[:120]), "ERROR")
            return False

    if con_fotos:
        foto(page, "despachados_filtros_puestos")

    _, pie_antes = total_paginas(page)
    ejecutar_busqueda(page)
    log("Esperando a que Oracle traiga las filas...")
    if not esperar_resultado(page, timeout_seg=420, distinto_de=pie_antes):
        wms.captura(page, "despachados_sin_datos")
        raise TimeoutError("Los despachados no trajeron ninguna fila")
    if con_fotos:
        foto(page, "despachados_resultado")

    if sin_exportar:
        log("MODO PRUEBA: no se exporta")
        return True
    return exportar_csv(page, destino, MINIMO_KB_DESPACHADOS)


class _SinAcumulados(Exception):
    """Corta la bajada de Pendientes y Despachados cuando va `--solo-dia`.

    Se usa una excepcion y no un `if` porque los dos acumulados estan dentro del
    mismo `try` y lo que sigue ya sabe tratarlos como no bajados.
    """


def run():
    import bloqueo_wms
    import wms_automation_final as wms
    from playwright.sync_api import sync_playwright

    abrir_log()
    wms.log = log
    t0 = time.time()

    a_la_vista = "--ver" in sys.argv
    sin_exportar = "--sin-exportar" in sys.argv
    solo_pend = "--solo-pendientes" in sys.argv
    # `--solo-dia` es el reves de `--solo-pendientes`: baja Picking y Detalle Orden
    # DEL DIA y deja fuera los dos acumulados -Pendientes 21 MB y Despachados 52 MB-.
    #
    # Lo pidio Daniel el 04-sep-2026 al partir el dia en dos cierres de turno: los
    # archivos del dia van en el cierre de las 07:00 y de las 19:00, y los acumulados
    # una sola vez de madrugada, porque lo que cambia en doce horas no justifica bajar
    # 73 MB dos veces.
    solo_dia = "--solo-dia" in sys.argv

    dia = dia_pedido()
    log("=" * 58)
    log("%s · día %s%s"
        % ("PENDIENTES DEL WMS, FOTO FRESCA" if solo_pend else "REPORTES DIARIOS DEL WMS",
           dia.strftime("%d-%m-%Y"), "  (MODO PRUEBA, no exporta)" if sin_exportar else ""))
    log("=" * 58)

    # En modo prueba no se reintenta: si algo falla quiero verlo ya, no dentro de
    # nueve minutos. La corrida de verdad sí reintenta.
    if sin_exportar:
        wms.INTENTOS = 1

    # EL CANDADO ES OBLIGATORIO: Oracle no admite dos sesiones del mismo usuario.
    #
    # PERO ESTE ROBOT ESPERA SU TURNO, NO CEDE. El de la hora puede cederle el paso
    # a otro porque vuelve en 60 minutos y no se pierde nada. Este corre UNA VEZ AL
    # DÍA: si se saltea, el picking y el detalle de ese día no los baja nadie. Se
    # espera hasta 15 minutos —lo normal es que la corrida de las 06:00 ya haya
    # terminado— y si el otro sigue adentro se entra igual.
    #
    # PERO LA BAJADA DE LA TARDE SI CEDE, y por eso lleva su propia rama. Entre las
    # 18:00 y las 23:00 el WMS lo esta usando el robot del stock -el principal a las
    # 19:00 y el de la hora cada :30- y meterse encima le invalida la sesion. Si
    # despues de 20 minutos sigue ocupado, esta sale SIN bajar nada y con codigo 3:
    # `armar_pendiente.py` entonces no publica y queda el pendiente de ayer, que es
    # la regla que puso Daniel. El correo se vuelve a despertar en media hora.
    # LA CORRIDA DIARIA ESPERA 45 MINUTOS, NO 15. Entra a las 07:20, quince minutos
    # despues del ancla, y el ancla normalmente tarda 16: el margen era de un minuto.
    # Cuando el Stock Reserva se pone lento el ancla sigue adentro, y esta entraba
    # igual con la MISMA cuenta `dames`.
    #
    # El 04-sep-2026 se vio entero: el ancla pidio el Excel a las 07:07, esta entro a
    # las 07:35 -"se entra igual"- y el ancla fallo sus tres intentos y perdio la
    # manana. Ya habia pasado el 31-ago con esta corrida a las 06:45; moverla a las
    # 07:20 solo corrio el choque de lugar.
    #
    # NO SE PIERDE LA CORRIDA, que es la regla de Daniel: a los 45 minutos entra
    # igual. Solo deja de pisar al ancla en los casos en que el ancla se demora, que
    # son justo los que la rompian.
    quien = "pendientes de la tarde" if solo_pend else "reportes diarios"
    libre = bloqueo_wms.esperar_turno(log, minutos_max=20 if solo_pend else 45, quien=quien)
    if solo_pend and not libre:
        log("El WMS sigue ocupado. NO se baja la foto: vale mas quedarse con el "
            "pendiente de ayer que pisarlo con uno a medias.", "ERROR")
        return 3
    bloqueo_wms.tomar(quien)

    base = wms._base_onedrive()
    # _base_onedrive() YA devuelve ...\\scraping Stock. Agregárselo otra vez daba
    # 'scraping Stock\\scraping Stock\\Picking', que no existe.
    if not base or not os.path.isdir(base):
        log("No se encontró la carpeta de OneDrive (%s). No hay dónde dejar los "
            "archivos." % base, "ERROR")
        bloqueo_wms.soltar()
        return 1

    # Los nombres siguen los que ya usa Daniel: "Picking 12-8.csv" -sin ceros- y
    # "Detalle Orden 12-08.csv" -con ceros-. No se unifican a propósito: cambiarlos
    # rompería los archivos que ya están cargados.
    ruta_pick = os.path.join(base, "Picking", "Picking %d-%d.csv" % (dia.day, dia.month))
    ruta_ord = os.path.join(base, "Detalle Orden", "Detalle Orden %s.csv" % dia.strftime("%d-%m"))
    ruta_pend = os.path.join(base, "Detalle Orden", ARCHIVO_PENDIENTES)
    ruta_desp = os.path.join(base, "Detalle Orden", ARCHIVO_DESPACHADOS)
    if not solo_pend:
        log("Picking      -> %s" % ruta_pick)
        log("Detalle Orden-> %s" % ruta_ord)
    if not solo_dia:
        log("Pendientes   -> %s" % ruta_pend)

    if not wms.WMS_PASSWORD or wms.WMS_PASSWORD == "TU_PASSWORD_AQUI":
        log("Falta WMS_PASSWORD en el .env", "ERROR")
        bloqueo_wms.soltar()
        return 1

    # CUANTOS DIAS MIRA HACIA ATRAS EL PENDIENTE. Todos los dias son 90, que es lo
    # que Daniel eligio. Se puede pedir mas de una vez para revisar si quedo algo
    # colgado de meses anteriores:  python picking_y_orden.py --dias 365
    dias_pend = DIAS_PENDIENTES
    for i, a in enumerate(sys.argv):
        if a == "--dias" and i + 1 < len(sys.argv):
            try:
                dias_pend = max(1, int(sys.argv[i + 1]))
            except ValueError:
                pass
    if dias_pend != DIAS_PENDIENTES:
        log("Los pendientes se van a pedir de %d dias, no de %d" % (dias_pend, DIAS_PENDIENTES))

    ok_pick = ok_ord = ok_pend = ok_desp = False
    try:
        with sync_playwright() as p:
            log("Abriendo navegador %s..." % ("A LA VISTA" if a_la_vista else "en segundo plano"))
            navegador = p.chromium.launch(headless=not a_la_vista, slow_mo=300 if a_la_vista else 0)
            contexto = navegador.new_context(viewport={"width": 1920, "height": 1080})
            page = contexto.new_page()
            page.on("dialog", lambda d: d.accept())

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

            if not solo_pend:
                ok_pick = wms.con_reintentos(
                    "Avance de Picking",
                    lambda: descargar_picking(page, ruta_pick, dia,
                                              sin_exportar=sin_exportar, con_fotos=sin_exportar),
                    page)
                ok_ord = wms.con_reintentos(
                    "Detalle de Orden",
                    lambda: descargar_detalle_orden(page, ruta_ord, dia,
                                                    sin_exportar=sin_exportar, con_fotos=sin_exportar),
                    page)
            # LOS PENDIENTES VAN AL FINAL y no cambian el resultado de la corrida:
            # es el más largo —90 días— y el único que todavía no tiene meses de
            # espalda. Si falla, los otros dos ya están bajados y el cuadro se
            # queda con el pendiente de ayer, que es lo que tenía igual.
            if solo_dia:
                log("--solo-dia: Pendientes y Despachados NO se bajan; van en la "
                    "corrida de las 04:30")
            try:
                if solo_dia:
                    raise _SinAcumulados("no toca")
                ok_pend = wms.con_reintentos(
                    "Pendientes",
                    lambda: descargar_pendientes(page, ruta_pend, dia, dias=dias_pend,
                                                 sin_exportar=sin_exportar,
                                                 con_fotos=sin_exportar),
                    page)
            except _SinAcumulados:
                pass
            except Exception as e:
                log("Los pendientes no se pudieron bajar: %s: %s"
                    % (type(e).__name__, str(e)[:200]), "WARN")

            # LOS DESPACHADOS VAN ULTIMOS y tampoco cambian el resultado de la
            # corrida. Es el mas nuevo de los cuatro: si falla, el picking y el
            # detalle ya estan bajados y lo unico que se pierde es saber que salio.
            try:
                if solo_dia:
                    raise _SinAcumulados("no toca")
                ok_desp = wms.con_reintentos(
                    "Despachados",
                    lambda: descargar_despachados(page, ruta_desp, dia,
                                                  sin_exportar=sin_exportar,
                                                  con_fotos=sin_exportar),
                    page)
            except _SinAcumulados:
                pass
            except Exception as e:
                log("Los despachados no se pudieron bajar: %s: %s"
                    % (type(e).__name__, str(e)[:200]), "WARN")

            navegador.close()
    finally:
        bloqueo_wms.soltar()

    hechos = int(bool(ok_pick)) + int(bool(ok_ord))
    log("=" * 58)
    _ac = lambda ok: "no tocaba (--solo-dia)" if solo_dia else ("bajados" if ok else "NO se bajaron")
    log("Pendientes:  %s" % _ac(ok_pend))
    log("Despachados: %s" % _ac(ok_desp))
    if solo_pend:
        log("LISTO en %.1f minutos" % ((time.time() - t0) / 60.0))
        log("=" * 58)
        return 0 if ok_pend else 1
    log("LISTO en %.1f minutos - %d de 2 %s"
        % ((time.time() - t0) / 60.0, hechos, "recorridos" if sin_exportar else "bajados"))
    log("=" * 58)
    return 0 if hechos == 2 else 1


if __name__ == "__main__":
    sys.exit(run())
