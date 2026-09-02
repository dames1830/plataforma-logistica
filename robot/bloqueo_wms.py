# -*- coding: utf-8 -*-
"""
EL TURNO DEL ROBOT — para que dos corridas no entren a Oracle al mismo tiempo.

Desde el 12-ago-2026 hay DOS robots que se conectan al WMS con el mismo usuario:

  * el de siempre (`wms_automation_final.py`), 06:00 y 19:00, que además arma el
    Slotting y publica el stock del turno;
  * el liviano (`stock_por_hora.py`), cada hora al minuto 30, que solo baja los dos
    stocks y los publica en el cajón de la hora.

**Oracle no admite dos sesiones del mismo usuario sin pelearse**: la segunda invalida
a la primera y la que estaba a mitad de una descarga se queda esperando un archivo que
ya nadie va a generar. En el horario normal no se cruzan —el de la hora arranca al
minuto 30 y termina en unos 8 minutos, el principal arranca en punto— pero sí se cruzan
cuando:

  * el principal se atrasa (Windows Update, servidor lento) y sigue corriendo al :30;
  * Stock Activo reintenta: cada intento espera hasta 15 minutos a que Oracle genere
    el archivo, y tres intentos pasan holgadamente del :30;
  * Daniel corre el robot a mano a cualquier hora.

La regla es simple y está pensada para que NUNCA se pierda la corrida importante:

  * **El principal manda.** Espera un rato a que el de la hora termine y, si no
    termina, entra igual. Perder el stock del turno es mucho peor que un cruce.
  * **El de la hora cede.** Si el principal está adentro, se saltea esa hora y lo
    dice en el log. En 60 minutos vuelve a intentar y no se perdió nada.

EL CANDADO SE VENCE SOLO. Si un robot se muere de mala manera —se corta la luz, lo
mata Windows Update— el archivo queda ahí. Sin vencimiento, el robot no volvería a
correr nunca más y nadie sabría por qué. Pasada `MINUTOS_VENCIMIENTO` se lo trata
como si no existiera.
"""

import io
import os
import time
from datetime import datetime

CARPETA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
ARCHIVO = os.path.join(CARPETA, "wms_ocupado.lock")

# Cuánto vale un candado antes de darlo por abandonado. La corrida más larga que se
# vio son 25 minutos (Stock Activo con reintentos), así que 45 deja margen de sobra
# sin dejar el robot trabado media jornada.
MINUTOS_VENCIMIENTO = 150


def _leer():
    """Quién tiene el candado y hace cuánto. None si está libre o vencido."""
    try:
        if not os.path.exists(ARCHIVO):
            return None
        edad = (time.time() - os.path.getmtime(ARCHIVO)) / 60.0
        if edad > MINUTOS_VENCIMIENTO:
            return None
        with io.open(ARCHIVO, encoding="utf-8", errors="replace") as fh:
            quien = fh.readline().strip() or "otro robot"
        return {"quien": quien, "minutos": edad}
    except Exception:
        # Ante la duda, libre: preferimos un cruce raro a un robot trabado para siempre.
        return None


def quien_esta():
    return _leer()


def tomar(quien):
    """Deja la marca de que este robot está adentro. Nunca falla: si no puede escribir
    el archivo, el robot igual tiene que correr."""
    try:
        os.makedirs(CARPETA, exist_ok=True)
        with io.open(ARCHIVO, "w", encoding="utf-8") as fh:
            fh.write("%s\n%s\n" % (quien, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        return True
    except Exception:
        return False


def soltar():
    """Saca la marca. Se llama SIEMPRE, pase lo que pase (va en un finally)."""
    try:
        if os.path.exists(ARCHIVO):
            os.remove(ARCHIVO)
    except Exception:
        pass


def esperar_turno(log, minutos_max=12, quien="robot"):
    """
    Para el robot PRINCIPAL: espera a que el de la hora termine y entra igual si se
    pasa del tiempo. Devuelve True si esperó a que se liberara, False si entró por
    encima. En los dos casos el robot sigue: el que manda es él.
    """
    esperado = 0
    while esperado < minutos_max * 60:
        duenio = _leer()
        if not duenio:
            if esperado:
                log("El otro robot terminó, se sigue")
            return True
        if not esperado:
            log("Hay otro robot adentro (%s, hace %.0f min). Se espera hasta %d minutos..."
                % (duenio["quien"], duenio["minutos"], minutos_max))
        time.sleep(30)
        esperado += 30

    log("El otro robot sigue adentro después de %d minutos. Se entra igual: la corrida "
        "del turno no se puede perder." % minutos_max, "WARN")
    return False

