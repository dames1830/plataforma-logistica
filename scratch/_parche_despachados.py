# -*- coding: utf-8 -*-
"""Agrega a `robot/picking_y_orden.py` la bajada de LO DESPACHADO."""
import io

P = 'robot/picking_y_orden.py'
t = io.open(P, encoding='utf-8', newline='').read()
if 'ESTADO_DESP_DESDE' in t:
    print('ya estaba puesto, no se toca'); raise SystemExit

CONSTANTES = '''ARCHIVO_PENDIENTES = "Detalle Orden Pendientes.csv"

# ══ LO DESPACHADO ══════════════════════════════════════════════════════════════
#
# Daniel, 28-ago-2026: *"cuando la orden es enviada, ya se despachó"*. El fill rate del
# picking no lo sabe: mide lo que salió del RACK, no lo que salió del ALMACÉN.
#
# CÓMO ES EL CIRCUITO DE VERDAD, dictado por Daniel:
#
#   Cargado  →  están pistoleando caja por caja por ruta. Está en el camión, PERO
#               TODAVÍA SIN GUÍA. Ese "cargado" se le manda por interfaz a otro
#               sistema, el CIS.
#   Enviado  →  el CIS emitió la guía —el WMS no guía— y le devuelve una interfaz al
#               WMS que le cambia el estado. Esto sí es despachado.
#
# POR ESO ENTRAN LOS DOS Y NO SE MEZCLAN. Una orden parada en "Cargado" no es un
# problema del almacén: el almacén ya hizo su parte y está esperando la guía del CIS.
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
MINIMO_KB_DESPACHADOS = 200'''

assert 'ARCHIVO_PENDIENTES = "Detalle Orden Pendientes.csv"' in t
t = t.replace('ARCHIVO_PENDIENTES = "Detalle Orden Pendientes.csv"', CONSTANTES, 1)

FUNCION = '''def descargar_despachados(page, destino, hasta_dia, dias=DIAS_DESPACHADOS,
                          sin_exportar=False, con_fotos=False):
    """El Detalle de Orden de lo que ya salio del almacen, hasta %d dias atras.

    POR QUE EXISTE. El fill rate del picking dice cuanto salio del rack; no dice si eso
    llego al camion. Con este archivo se puede preguntar, para cada orden que se pico,
    si termino en "Enviado" -guiada por el CIS y despachada- o si sigue en el patio.

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


def run():'''

assert '\ndef run():' in t
t = t.replace('\ndef run():', '\n' + FUNCION, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(t)
print('constantes y funcion escritas')
