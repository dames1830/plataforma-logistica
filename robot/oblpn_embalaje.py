# -*- coding: utf-8 -*-
"""
OBLPN / EMBALAJE  ·  el eslabón que faltaba entre el picking y el despacho
================================================================================

Daniel, 29-ago-2026: *"los chicos pican, pero también embalan. No hemos visto el tema de
embalaje"*. Hasta acá el circuito se medía hasta que la mercadería salía del rack y volvía
a aparecer recién cuando ya estaba despachada. En el medio no había nada.

QUE ES UN OBLPN: *Outbound License Plate Number*, el número de cada bulto que sale. Una
línea por artículo dentro de cada bulto.

POR QUE ESTE ARCHIVO CIERRA EL CIRCUITO SOLO. Trae las cuatro etapas con hora Y con el
nombre de quién hizo cada una:

    Detail Pick User / Detail Picked Time                   quién picó y cuándo
    Usuario de paquete / Registro de hora de empaquetado    quién embaló y cuándo
    Usuario de carga / Hora de asignación de carga          quién cargó y cuándo
    Estado de LPN                                           Empaquetado | Cargado | Enviado

Medido sobre el archivo del 27-ago: picar → empaquetar tarda 0,8 h de mediana, pero
**empaquetar → cargar tarda 21,3 h**. El cuello no está en el almacén: está entre que el
bulto queda armado y sube al camión. Y ese día quedaron 44.050 unidades en 1.518 bultos
en estado Empaquetado sin salir, esperando 31 horas de mediana.

EL CAMINO SALE DE UNA GRABACION de Daniel del 29-ago-2026, no de adivinar:
    pantalla TRX_OBLPN/CARTON  ·  botón Buscar  ·  botón Borrar
    las fechas  ·  Exportar → Exportar a CSV

TARDA 10 A 12 MINUTOS, cronometrado por él haciéndolo a mano. Por eso las esperas de acá
son mucho más largas que las del picking: con los 7 minutos que usan los otros, este se
cortaría siempre.

Se apoya en los ayudantes de `picking_y_orden.py` —abrir pantalla, panel, escribir fechas,
exportar— para no tener dos copias de lo mismo. Ver `robot/LEEME.md`.
"""
import os
import sys
import time
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

# ══ DONDE ESTA EL NAVEGADOR, PARA PODER CORRER COMO TAREA ══════════════════════
#
# Playwright guarda su Chromium en el perfil del usuario. Corriendo como tarea programada
# con SYSTEM el perfil es otro, no lo encuentra y el robot muere al abrir el navegador —
# codigo 1, en segundos, justo despues de anunciar donde iba a guardar los archivos.
#
# Eso paso el 29-ago-2026 y costo cuatro intentos. La otra salida era crear la tarea con el
# usuario Administrator, pero eso pide la contraseña de Windows y falla si no se acierta.
# Apuntar la variable de entorno no pide nada y funciona con cualquier usuario.
#
# VA ANTES DE IMPORTAR NADA de playwright: la lee al arrancar, no al lanzar el navegador.
if not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
    for _p in (os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "Administrator", "AppData", "Local", "ms-playwright"),
               os.path.join("C:", os.sep, "Users", "dames", "AppData", "Local", "ms-playwright")):
        if _p and os.path.isdir(_p):
            os.environ["PLAYWRIGHT_BROWSERS_PATH"] = _p
            break

import picking_y_orden as po        # los ayudantes, ya probados contra el WMS

# El nombre de la pantalla, tal cual lo grabó Daniel el 29-ago-2026.
PANTALLA_OBLPN = "TRX_OBLPN/CARTON"

# ══ LAS DOS FECHAS, Y CUAL MANDA ═══════════════════════════════════════════════
#
# SE FILTRA POR FECHA DE MODIFICACION, NO DE CREACION. Lo corrigió Daniel el 29-ago-2026
# leyendo el log de la primera prueba: *"en la grabación yo puse fecha de creación el
# primero de enero, y en la de modificación del 26 a las 00:00 al 27 a las 00:00. Veo en tu
# comando que está seleccionando fecha de creación desde-hasta, cuando yo no lo hice así"*.
#
# Y no son lo mismo: el bulto se CREA cuando arranca el picking, pero se MODIFICA cada vez
# que cambia de estado —empaquetado, cargado, enviado—. Para ver la actividad de un día hay
# que mirar la modificación. Filtrando por creación se pierde lo que nació ayer y se movió
# hoy, que es justamente lo que interesa medir.
#
# LA VENTANA ES DEL DIA 00:00 AL MISMO DIA 23:59, pedido por Daniel el 29-ago-2026: *"que
# sea de 28 a las 00:00 hasta las 28 23:59"*. En la grabación lo había hecho del 26 00:00 al
# 27 00:00 —un día de diferencia—, pero así el corte queda dentro del mismo día y no toma la
# medianoche del siguiente.
ETQ_MOD_DESDE = ("De registro de hora de modificación de LPN",
                 "De registro de hora de modificación")
ETQ_MOD_HASTA = ("A registro de hora de modificación de LPN",
                 "A registro de hora de modificación")

# LA CREACION LLEVA SOLO EL "DE", Y EL "HASTA" VA VACIO. Daniel, 29-ago-2026: *"con la
# fecha de creación solamente tienes que poner el desde, desde el primero de enero de dos
# mil veintiséis, y en el hasta no va nada, va vacío"*.
#
# ES UN PISO, no una ventana, y por eso la fecha NO se mueve con el tiempo: 1 de enero de
# 2026, y siempre. Cada año que pase el piso queda más atrás, que es exactamente lo que
# tiene que pasar. Calcularlo como "un año hacia atrás" —que fue mi primer intento— iría
# dejando afuera los bultos viejos que todavía se mueven.
#
# Poner también el "hasta" recortaría por arriba sin ninguna necesidad: lo que elige el día
# es la modificación. Como `limpiar_panel` deja el panel vacío, alcanza con no tocarlo.
#
# Esta etiqueta está COMPROBADA: la corrida del 29-ago la encontró y la escribió en el log.
# Las de modificación no, y por eso van con dos candidatas cada una.
ETQ_CRE_DESDE = ("De registro de hora de creación de LPN",
                 "De registro de hora de creación")
PISO_CREACION = "01/01/2026"

# ══ LA CARPETA DE ONEDRIVE SE BUSCA, NO SE HEREDA ══════════════════════════════
#
# Corriendo como tarea programada el usuario es SYSTEM, no Administrator, y su perfil es
# otro: `~/OneDrive` no existe y la variable de entorno tampoco está. Por eso van también
# las dos rutas fijas, igual que en `armar_pendiente.py`, `correo_guias.py` y
# `generar_slotting.py`.
#
# Antes esto usaba `wms._base_onedrive()`, que vive solo en el servidor y no se puede
# comprobar desde acá. La primera corrida como tarea programada murió con código 1 en
# segundos, y ésta es la causa más probable.
def base_onedrive():
    """La carpeta `scraping Stock`, probando las rutas de las dos máquinas."""
    for c in (os.environ.get("OneDrive"), os.environ.get("OneDriveCommercial"),
              os.path.join(os.path.expanduser("~"), "OneDrive"),
              os.path.join("C:", os.sep, "Users", "Administrator", "OneDrive"),
              os.path.join("C:", os.sep, "Users", "dames", "OneDrive")):
        if not c:
            continue
        ruta = os.path.join(c, "danielames.bata", "scraping Stock")
        if os.path.isdir(ruta):
            return ruta
    return None


CARPETA = "OBLPN Embalaje"       # la misma donde Daniel viene guardando los suyos
# El archivo del 27-ago pesó 16,7 MB con 29.827 filas. El piso va bien abajo: lo que tiene
# que delatar es una búsqueda mal filtrada de unos KB, no un domingo flojo.
MINIMO_KB = 400
# El WMS tarda 10 a 12 minutos en esta pantalla. Se le dan 20 de margen.
ESPERA_SEG = 1200

# Los dias que Oracle contesto sin una sola fila. No son fallas: son domingos sin
# operacion. Se anotan aca para que el resumen final los liste aparte de los bajados.
SIN_MOVIMIENTO = set()
# Y TREINTA MINUTOS PARA ARMAR EL CSV, no los 15 de los otros reportes. Pedido por Daniel
# el 29-ago-2026 viendo la corrida de las 04:16: Oracle seguía armando el archivo cuando el
# robot se rindió y no descargó nada. Este es el más pesado de los cuatro, 11 a 16 MB.
MINUTOS_ARMADO = 30


def etiqueta_que_exista(page, candidatas, prefijo="dijit_form_DateTextBox_"):
    """La primera de las candidatas que de verdad esté en el panel.

    Devuelve None si no hay ninguna, y en ese caso deja anotado en el log qué etiquetas
    ofrece el panel: sin eso, un cambio de nombre en el WMS obliga a volver a grabar.
    """
    for etq in candidatas:
        try:
            po._campo(page, etq, prefijo)
            return etq
        except Exception:
            continue
    try:
        vistas = page.locator("xpath=//td[.//input[starts-with(@id,'%s')]]"
                              "/preceding-sibling::td[1]" % prefijo).all_inner_texts()
        po.log("   El panel ofrece estas etiquetas de fecha: %s"
               % " | ".join(t.strip() for t in vistas if t.strip())[:400], "WARN")
    except Exception:
        pass
    return None


def dias_pedidos():
    """Los días que hay que bajar, en orden.

    Sin nada, uno solo: el que decide `dia_pedido()` de picking_y_orden —ayer, o el que
    diga `--dia`—. Con `--desde` y `--hasta` se bajan todos los de ese tramo.

    Daniel, 29-ago-2026: *"no puedes hacer un solo comando para todos los días, del 24 al
    28. Primero bajas uno, de ahí termina y comienza de nuevo con el otro"*. Se hacen
    seguidos y EN LA MISMA SESION: entrar al WMS cuesta unos 20 segundos, y repetirlo
    cinco veces es un minuto y medio tirado además de cinco veces la chance de que el
    login falle.
    """
    def leer(bandera):
        for i, a in enumerate(sys.argv):
            if a.startswith(bandera + "="):
                return a.split("=", 1)[1]
            if a == bandera and i + 1 < len(sys.argv):
                return sys.argv[i + 1]
        return None

    # EL AVANCE DEL DIA, cada 2 horas. Daniel, 31-ago-2026: *"el avance de picking, el
    # avance de embalaje tiene que ser cada dos horas. Necesitamos un estatus cada dos
    # horas"*. Con `--hoy` se baja el dia en curso, que es lo que mira el turno; sin
    # nada se baja AYER, que es la salida de emergencia para recuperar un dia perdido.
    #
    # El archivo se llama igual —OBLPN DD-MM.csv— y se pisa en cada pase: siempre queda
    # el ultimo estado del dia, que es lo que se quiere de un avance.
    if "--hoy" in sys.argv:
        return [datetime.now()]

    d1, d2 = leer("--desde"), leer("--hasta")
    if not d1 and not d2:
        return [po.dia_pedido()]
    if not (d1 and d2):
        po.log("--desde y --hasta van juntos. Se baja un solo día.", "WARN")
        return [po.dia_pedido()]
    try:
        a = datetime.strptime(d1, "%d-%m-%Y").date()
        b = datetime.strptime(d2, "%d-%m-%Y").date()
    except ValueError:
        po.log("Las fechas van como 24-08-2026. Se baja un solo día.", "WARN")
        return [po.dia_pedido()]
    if b < a:
        a, b = b, a
    return [a + timedelta(days=k) for k in range((b - a).days + 1)]


def descargar_oblpn(page, destino, dia, sin_exportar=False, con_fotos=False):
    """El OBLPN de UN día, con todos sus estados.

    NO SE FILTRA POR ESTADO A PROPOSITO. El archivo tiene que traer Empaquetado, Cargado y
    Enviado juntos: la gracia del reporte es justamente comparar cuánto se quedó en cada
    escalón. Filtrar por uno solo tapa el que interesa.

    Las filas en `Cancelado` vienen igual y hay que descartarlas al leer, no acá: son
    copias de la tarea con cero unidades —14.988 de las 29.827 del 27-ago—, la misma
    trampa que tiene el archivo de picking.
    """
    import wms_automation_final as wms
    po.log("=" * 58)
    po.log("OBLPN / EMBALAJE · %s" % dia.strftime("%d-%m-%Y"))
    po.log("=" * 58)

    po.abrir_pantalla(page, PANTALLA_OBLPN)
    po.abrir_panel(page)
    po.limpiar_panel(page)

    mod_d = etiqueta_que_exista(page, ETQ_MOD_DESDE)
    mod_h = etiqueta_que_exista(page, ETQ_MOD_HASTA)
    if not mod_d or not mod_h:
        po.log("No estan los campos de fecha de MODIFICACION en el panel. Son los que "
               "eligen el dia: sin ellos no se baja.", "ERROR")
        wms.captura(page, "oblpn_sin_campos_de_fecha")
        return False

    # El piso de creación va primero: si la pantalla dispara una búsqueda por su cuenta al
    # tocar un campo, que salga con el piso puesto y no con el histórico entero.
    # SOLO EL "DE". El "hasta" de creación se deja vacío, tal como lo hace Daniel.
    cre_d = etiqueta_que_exista(page, ETQ_CRE_DESDE)
    if cre_d:
        po.poner_fecha_y_hora(page, cre_d, PISO_CREACION, "0:00:00")
    else:
        po.log("   El panel no tiene fecha de creación; se filtra solo por modificación")

    # LA QUE ELIGE EL DIA: del día a las 00:00 al mismo día a las 23:59.
    po.poner_fecha_y_hora(page, mod_d, dia.strftime("%d/%m/%Y"), "0:00:00")
    po.poner_fecha_y_hora(page, mod_h, dia.strftime("%d/%m/%Y"), "23:59:00")
    if con_fotos:
        po.foto(page, "oblpn_filtros_puestos")

    _, pie_antes = po.total_paginas(page)
    po.ejecutar_busqueda(page)
    po.log("Esperando a que Oracle traiga las filas... (hasta %d min; despues, hasta %d "
           "min mas para armar el archivo)" % (ESPERA_SEG // 60, MINUTOS_ARMADO))
    paginas = po.esperar_resultado(page, timeout_seg=ESPERA_SEG, distinto_de=pie_antes)
    if not paginas:
        wms.captura(page, "oblpn_sin_datos")
        raise TimeoutError("El OBLPN no trajo ninguna fila en %d minutos" % (ESPERA_SEG // 60))
    if con_fotos:
        po.foto(page, "oblpn_resultado")

    if sin_exportar:
        po.log("MODO PRUEBA: no se exporta")
        return True
    # UN DIA SIN MOVIMIENTO NO ES UN ERROR: ES UN DOMINGO O UN FERIADO.
    #
    # NO SE PUEDE MIRAR EL PIE DE LA GRILLA. En esta pantalla viene PELADO siempre
    # —"/ 192 Paginas"—, sin el "Recuperados <fecha> <hora>" que traen las otras. Lo
    # probe el 30-ago-2026 y marque seis dias buenos como vacios: el 03-08 trajo 192
    # paginas de data y lo di por domingo.
    #
    # LA SENAL DE VERDAD es que el boton "Exportar a CSV" NO APARECE cuando no hay
    # filas, porque no hay nada que exportar. Cuesta 15 segundos descubrirlo, contra
    # los 40 minutos que costaba antes reintentando tres veces.
    #
    # Se exigen las DOS cosas —una sola pagina Y sin boton— para no confundir un dia
    # flojo con uno vacio: un dia con pocas filas igual exporta sin problema.
    try:
        return po.exportar_csv(page, destino, MINIMO_KB, minutos_armado=MINUTOS_ARMADO)
    except Exception as e:
        if paginas <= 1 and "Exportar" in str(e):
            po.log("El %s no tiene movimiento: una sola pagina y sin boton de exportar. "
                   "No se reintenta." % dia.strftime("%d-%m-%Y"), "WARN")
            SIN_MOVIMIENTO.add(dia.strftime("%d-%m-%Y"))
            return True
        raise


def run():
    import bloqueo_wms
    import wms_automation_final as wms
    from playwright.sync_api import sync_playwright

    po.abrir_log()
    wms.log = po.log
    t0 = time.time()

    a_la_vista = "--ver" in sys.argv
    sin_exportar = "--sin-exportar" in sys.argv
    dias = dias_pedidos()

    po.log("=" * 58)
    if len(dias) == 1:
        po.log("OBLPN / EMBALAJE — %s" % dias[0].strftime("%d-%m-%Y"))
    else:
        po.log("OBLPN / EMBALAJE — %d días, del %s al %s"
               % (len(dias), dias[0].strftime("%d-%m-%Y"), dias[-1].strftime("%d-%m-%Y")))
    po.log("=" * 58)

    base = base_onedrive()
    if not base or not os.path.isdir(base):
        po.log("No se encontró la carpeta de OneDrive en ninguna de las rutas conocidas. "
               "Corriendo como SYSTEM el perfil es otro; ver base_onedrive().", "ERROR")
        return 1
    po.log("Carpeta de OneDrive: %s" % base)
    carpeta = os.path.join(base, CARPETA)
    if not os.path.isdir(carpeta):
        os.makedirs(carpeta)
        po.log("Se creó la carpeta %s" % carpeta)
    # El mismo formato que viene usando Daniel a mano: "OBLPN 27-08.csv"
    destino_de = lambda d: os.path.join(carpeta, "OBLPN %s.csv" % d.strftime("%d-%m"))
    po.log("Van a quedar en -> %s" % carpeta)

    # ESTE ROBOT CEDE EL PASO. Tarda 12 minutos y corre una vez al día; si el del picking
    # o el de los stocks está adentro, conviene esperarlos a que terminen antes que
    # pelearse la sesión: Oracle no admite dos del mismo usuario.
    libre = bloqueo_wms.esperar_turno(po.log, minutos_max=25, quien="OBLPN de embalaje")
    if not libre:
        po.log("Otro robot lleva mucho rato en el WMS. Se deja para la próxima.", "WARN")
        return 2
    bloqueo_wms.tomar("OBLPN de embalaje")

    hechos = []
    try:
        with sync_playwright() as p:
            # SIN channel="chrome". En el servidor no hay Chrome instalado y se usa el
            # Chromium que trae Playwright, igual que los otros cinco robots. El
            # channel="chrome" hace falta SOLO en la laptop de Daniel, donde Windows
            # bloquea ese Chromium con una directiva de control de aplicaciones.
            navegador = p.chromium.launch(headless=not a_la_vista,
                                          slow_mo=300 if a_la_vista else 0)
            page = navegador.new_context().new_page()
            url = "https://a10.wms.ocs.oraclecloud.com/bata/index/"
            po.log("Entrando a %s" % url)
            page.goto(url)
            page.wait_for_selector("input[name='username']", timeout=20000)
            page.fill("input[name='username']", wms.WMS_USER)
            page.fill("input[name='password']", wms.WMS_PASSWORD)
            page.locator("button[type='submit'], input[type='submit'], "
                         "input[value='Sign In']").first.click()
            po.log("Sesión iniciada como %s" % wms.WMS_USER)
            time.sleep(15)

            # UN DIA POR VEZ, uno detrás del otro y sin salir de la sesión.
            #
            # SI UN DIA FALLA NO SE CORTAN LOS DEMAS. Bajando cinco de una, que el tercero
            # se caiga y arrastrara al cuarto y al quinto sería peor que el problema: se
            # sigue con los que quedan y al final se dice cuáles salieron y cuáles no.
            for d in dias:
                try:
                    r = wms.con_reintentos(
                        "OBLPN %s" % d.strftime("%d-%m"),
                        lambda dd=d: descargar_oblpn(page, destino_de(dd), dd,
                                                     sin_exportar=sin_exportar,
                                                     con_fotos=sin_exportar),
                        page)
                except Exception as e:
                    po.log("El %s no se pudo bajar: %s: %s"
                           % (d.strftime("%d-%m"), type(e).__name__, str(e)[:160]), "WARN")
                    r = False
                hechos.append((d, bool(r)))
            navegador.close()
    finally:
        bloqueo_wms.soltar()

    ok = bool(hechos) and all(r for _, r in hechos) and len(hechos) == len(dias)
    po.log("=" * 58)
    for d, r in hechos:
        clave = d.strftime("%d-%m-%Y")
        if clave in SIN_MOVIMIENTO:
            estado = "sin movimiento (no se embalo ese dia)"
        elif r:
            estado = "bajado"
        else:
            estado = "NO se bajo"
        po.log("   %s  %s" % (clave, estado))
    po.log("LISTO en %.1f minutos — %d de %d"
           % ((time.time() - t0) / 60.0, sum(1 for _, r in hechos if r), len(dias)))
    po.log("=" * 58)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run())
