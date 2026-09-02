"""
================================================================================
 EL HORARIO LO MANDA LA WEB, NO EL PROGRAMADOR DE TAREAS
================================================================================

Daniel, 18-ago-2026: *"yo cambio en la web y el robot se tiene que adaptar a lo
que yo digo"*.

Hasta hoy la hora vivia en el Programador de tareas de Windows del servidor, asi
que cambiarla era entrar con un `.bat` -el ancla paso de 06:00 a 07:00 el 13-ago
y hubo que hacerlo a mano-. Ahora Windows solo DESPIERTA al robot cada 10 minutos
y este modulo dice si le toca.

    Programador de Windows            este modulo                el robot
    "despierta cada 10 min"   ->   "¿me toca ahora?"    ->   corre o no corre

COMO SE USA, desde un .bat:

    python horario_robot.py ancla_noche && python wms_automation_final.py

El codigo de salida es lo que decide: 0 = te toca, 1 = no te toca. Asi el `&&`
del .bat hace todo el trabajo y no hay que tocar los scripts que ya andan.

TRES COSAS QUE NO SE PUEDEN ROMPER
----------------------------------
1. SI LA WEB NO CONTESTA, EL ROBOT IGUAL CORRE. Se guarda la ultima
   configuracion leida en `horario_cache.json` y se trabaja con esa. Un problema
   de internet no puede dejar al almacen sin foto de stock: seria cambiar un
   problema chico por uno grande. Y si tampoco hay cache, mandan los valores de
   fabrica, que son los horarios que el servidor tenia el 18-ago-2026.

2. NO SE CORRE DOS VECES. Despertarse cada 10 minutos y tener una ventana de 10
   significa que una corrida podria dispararse dos veces si algo se demora. Cada
   corrida deja su marca en `horario_corridas.json` y no se repite dentro de la
   misma franja.

3. LA HORA ES LA DEL SERVIDOR. No se pasa por UTC ni por `toISOString()`: en Peru
   eso adelanta el dia a las 19:00, justo cuando entra el turno noche.
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config'
AQUI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(AQUI, 'horario_cache.json')
CORRIDAS = os.path.join(AQUI, 'horario_corridas.json')

VENTANA_MIN = 10          # cuanto abarca cada despertar; igual que en robotsService.js
DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

# Lo que el servidor hacia al 18-ago-2026. Es el ultimo respaldo: si no hay web ni
# cache, el robot sigue con los horarios de siempre en vez de quedarse quieto.
DE_FABRICA = {
    'ancla_noche':  {'activa': True, 'hora': '19:00', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
    'ancla_manana': {'activa': True, 'hora': '07:00', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
    'stock_hora':   {'activa': True, 'minuto': 0, 'cadaMin': 120, 'dias': {d: True for d in DIAS}, 'desde': '22:00', 'hasta': '06:00'},
    'picking_hora': {'activa': True, 'minuto': 0, 'cadaMin': 120, 'dias': {d: True for d in DIAS}, 'desde': '10:00', 'hasta': '21:00'},
    # EL TRIO PASO DE CADA HORA A CADA 2 HORAS el 30-ago-2026, medido: entre stock (9,2
    # min) y picking (16,9) tenian el WMS ocupado 10,4 horas al dia, y el picking de las
    # 06:50 terminaba 07:07 pisando al ancla de las 07:00. Ahora son 5,2 horas y ningun
    # choque. Van como bloque y en punto, que se recuerda de memoria a las 3 de la manana.
    # El mapa se dibuja con el stock que `stock_hora` acaba de publicar y esa corrida
    # tarda hasta 9,2 minutos: por eso va 15 despues, no antes. El picking, 20.
    'mapa_hora':    {'activa': True, 'minuto': 15, 'cadaMin': 120, 'dias': {d: True for d in DIAS}, 'desde': '22:00', 'hasta': '06:15'},
    # A las 06:45: el turno noche cierra 06:30 y el de la manana entra 08:00, asi que
    # el almacen esta quieto y el dia de ayer ya cerro. Estaba a las 08:00 y eso
    # empujaba a SKUs sin salida fuera de la manana.
    # DOS VECES AL DIA, DETRAS DE CADA ANCLA. Daniel, 31-ago-2026: *"el detalle de orden
    # se necesita para ver las ordenes pendientes, no para avance. Puede ser dos veces al
    # dia nada mas [...] tiene que ser despues del stock ancla, porque se necesita para
    # empezar el turno dia, y para tener una vision el turno noche"*.
    #
    # minuto 440 = 07:20, y cada 720 min cae la segunda en 19:20. Sale de DIARIAS y pasa
    # a repetirse, que es la unica forma de tener dos horas fijas en el dia.
    #
    # ESTABA A LAS 06:45 Y ERA EL QUE ROMPIA EL ANCLA: tarda hasta 40 minutos, asi que
    # seguia adentro del WMS a las 07:00. El 31-ago el ancla espero 12 minutos, entro
    # igual encima, y el Stock Reserva fallo sus tres intentos.
    'reportes':     {'activa': True, 'minuto': 440, 'cadaMin': 720, 'dias': {d: True for d in DIAS}},
    # El respaldo va al final del dia, cuando la corrida de las 19:00 ya termino
    # y nadie esta escribiendo. La hora se cambia desde la web como las demas.
    'respaldo':     {'activa': True, 'hora': '23:00', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
    # El archivado reescribe el area entera de tareas: si alguien guarda una en el
    # medio, se pierde. A la 01:00 todavia hay movimiento del turno noche cada pocos
    # minutos, por eso va a las 03:00 y todos los dias, domingo incluido.
    'archivado':    {'activa': True, 'hora': '03:00', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': True}},
    # SKUs sin salida va DESPUES de los reportes diarios y DESPUES del ancla de la
    # manana: necesita el Detalle de Orden del dia que cerro y la foto de stock de
    # hoy. Con los reportes a las 06:45 y el ancla a las 07:00, a las 07:30 ya estan
    # los dos. Antes de esa hora el cuadro saldria con la demanda de anteayer.
    # A LAS 09:00, no a las 07:30: necesita el Detalle de Orden del dia que cerro, y
    # ahora ese archivo llega recien a las 08:00. A las 07:30 leeria el de anteayer.
    'sin_salida':   {'activa': True, 'hora': '09:00', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
    # EL AVANCE DE EMBALAJE, cada 2 horas como el de picking. Daniel, 31-ago-2026:
    # *"el avance de picking, el avance de embalaje tiene que ser cada dos horas.
    # Necesitamos un estatus cada dos horas"*.
    #
    # Va al minuto 40, DETRAS del picking que entra al :20 y tarda unos 19 minutos. Los
    # dos entran al WMS y solo cabe uno; si arrancara antes, uno perderia la vuelta.
    # Baja el dia EN CURSO (--hoy) y pisa el archivo en cada pase: siempre queda el
    # ultimo estado. El ultimo pase del dia es a las 22:40.
    'oblpn_hora':   {'activa': True, 'minuto': 20, 'cadaMin': 120, 'dias': {d: True for d in DIAS}, 'desde': '10:00', 'hasta': '21:00'},
    # EL CRUCE CONTRA EL WMS, una vez al dia y al final. Baja los dos web reports
    # -PRODUCCION PICKING / EMBALAJE ALDEAS X HORA- y los compara contra lo que
    # calculo la plataforma. Va a las 21:30 porque el ultimo pase del avance de
    # picking es 20:20 y el de embalaje 20:40: antes compararia medio dia. Y es
    # hueco: el stock por hora entra 22:00 y el respaldo 23:00.
    # EL CIERRE DEL DIA ANTERIOR, de 00:00 a 23:59. Baja el OBLPN de ayer entero
    # y recalcula los dos cuadros; lo que queda en el historial es esto y no el
    # ultimo avance. A las 08:30 porque el robot de las 07:20 tarda hasta 40
    # minutos y el primer avance no entra hasta las 10:00.
    'cierre_dia':   {'activa': True, 'hora': '08:30', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': True}},
    'cruce_wms':    {'activa': True, 'hora': '21:30', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
}
DIARIAS = ('ancla_noche', 'ancla_manana', 'respaldo', 'archivado', 'sin_salida', 'cruce_wms', 'cierre_dia')


def _leer_web(timeout=20):
    """Trae la configuracion publicada. Devuelve None si no se pudo."""
    try:
        with urllib.request.urlopen(f'{API}?t=robot', timeout=timeout) as r:
            cuerpo = json.load(r)
        datos = cuerpo.get('data', cuerpo) if isinstance(cuerpo, dict) else cuerpo
        robots = (datos or {}).get('robots')
        if isinstance(robots, dict) and robots:
            return robots
    except Exception as e:
        print(f'[HORARIO] no se pudo leer la web: {e}')
    return None


def _guardar_cache(cfg):
    try:
        with open(CACHE, 'w', encoding='utf-8') as f:
            json.dump({'cuando': datetime.now().isoformat(timespec='seconds'), 'robots': cfg}, f,
                      ensure_ascii=False, indent=1)
    except Exception as e:
        print(f'[HORARIO] no se pudo guardar el cache: {e}')


def _leer_cache():
    try:
        with open(CACHE, encoding='utf-8') as f:
            d = json.load(f)
        return d.get('robots')
    except Exception:
        return None


def configuracion():
    """La configuracion vigente, con la cascada: web -> cache -> fabrica."""
    web = _leer_web()
    if web:
        _guardar_cache(web)
        return web, 'la web'
    guardada = _leer_cache()
    if guardada:
        return guardada, 'el cache (la web no contesto)'
    return DE_FABRICA, 'los valores de fabrica (sin web ni cache)'


def _de(cfg, tarea):
    """La tarea, completando con lo de fabrica lo que falte. Nada se da por presente."""
    base = dict(DE_FABRICA.get(tarea, {}))
    v = cfg.get(tarea) if isinstance(cfg, dict) else None
    if isinstance(v, dict):
        base.update({k: v[k] for k in v if v[k] is not None})
        dias = dict(DE_FABRICA.get(tarea, {}).get('dias', {}))
        if isinstance(v.get('dias'), dict):
            dias.update({k: bool(v['dias'][k]) for k in v['dias'] if k in dias})
        base['dias'] = dias
    return base


def _minutos_de(hhmm):
    """'10:00' -> 600. None si no viene o no se entiende, que significa 'sin limite'."""
    if not hhmm:
        return None
    try:
        h, m = str(hhmm).split(':')
        return int(h) * 60 + int(m)
    except Exception:
        return None


def _en_ventana(base, desde, hasta):
    """Si ese minuto del dia cae dentro de la ventana. Sin ventana, siempre.

    LA VENTANA PUEDE CRUZAR LA MEDIANOCHE, y hace falta: el avance del turno noche va de
    22:00 a 06:00, o sea que `hasta` es MENOR que `desde`. Cuando pasa eso, dentro es
    "de las 22:00 en adelante O hasta las 06:00", no el tramo entre las dos.
    """
    if desde is None and hasta is None:
        return True
    if desde is not None and hasta is not None:
        if desde <= hasta:
            return desde <= base <= hasta
        return base >= desde or base <= hasta
    if desde is not None:
        return base >= desde
    return base <= hasta


def franja_actual(tarea, cfg, ahora=None):
    """
    En que franja horaria cae este momento, o None si no le toca.

    La franja es la marca que se guarda para no repetir: para una diaria es
    'AAAA-MM-DD 19:00', y para una que se repite, la hora de arranque del tramo.
    """
    ahora = ahora or datetime.now()
    c = _de(cfg, tarea)
    if not c.get('activa', True):
        return None
    if not c.get('dias', {}).get(DIAS[ahora.weekday()], False):
        return None

    minutos = ahora.hour * 60 + ahora.minute

    if tarea in DIARIAS:
        try:
            h, m = str(c.get('hora', '')).split(':')
            objetivo = int(h) * 60 + int(m)
        except Exception:
            return None
        if objetivo <= minutos < objetivo + VENTANA_MIN:
            return f'{ahora:%Y-%m-%d} {int(h):02d}:{int(m):02d}'
        return None

    cada = max(1, int(c.get('cadaMin') or 60))
    arranque = int(c.get('minuto') or 0)

    # LA VENTANA DE HORAS: `desde` y `hasta`, en HH:MM. Sin ellas corre las 24 horas.
    #
    # Daniel, 31-ago-2026: *"el avance de picking y el avance de embalaje a partir de las
    # nueve de la noche ya no lo pongas. El 95% de ese flujo se saca del turno dia, de las
    # ocho de la manana a las siete de la noche. Es en vano que le pongas a las doce de la
    # noche un avance cuando solo se va a hacer un par de pares. Ahi nos ahorramos
    # interfaz. Y a las ocho recien entra el turno dia: que avance vamos a dar si recien
    # esta entrando"*.
    #
    # No se pierde lo del turno noche: el archivo del avance trae el dia entero desde las
    # 00:00, asi que el primer pase de la manana ya lo incluye.
    lim_i, lim_f = _minutos_de(c.get('desde')), _minutos_de(c.get('hasta'))

    # PASES SUELTOS QUE SE SALTAN. Daniel, 31-ago-2026: el avance de las 18:40 terminaba
    # 18:55 y el ancla entra a las 19:00 —cinco minutos—. Sacarlo no pierde nada: el pase
    # de las 20:40, ya despues del ancla, cierra el turno dia entero.
    #
    # Va como lista de horas y no como otra ventana porque es UN pase, no un tramo:
    # 'saltar': ['18:20'] se lee de un vistazo y se cambia desde la web.
    saltar = {m for m in (_minutos_de(x) for x in (c.get('saltar') or [])) if m is not None}

    base = arranque
    while base < 24 * 60:
        if base <= minutos < base + VENTANA_MIN:
            if not _en_ventana(base, lim_i, lim_f):
                return None
            if base in saltar:
                return None
            return f'{ahora:%Y-%m-%d} {base // 60:02d}:{base % 60:02d}'
        base += cada
    return None


def _corridas():
    try:
        with open(CORRIDAS, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _anotar(tarea, franja):
    """Deja la marca y limpia lo de hace mas de tres dias, para que no crezca."""
    d = _corridas()
    d[tarea] = franja
    corte = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
    d = {k: v for k, v in d.items() if str(v)[:10] >= corte}
    try:
        with open(CORRIDAS, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
    except Exception as e:
        print(f'[HORARIO] no se pudo anotar la corrida: {e}')


def le_toca(tarea, ahora=None, anotar=True):
    cfg, fuente = configuracion()
    franja = franja_actual(tarea, cfg, ahora)
    if not franja:
        return False, f'no le toca (horario segun {fuente})'
    if _corridas().get(tarea) == franja:
        return False, f'ya corrio en esta franja ({franja})'
    if anotar:
        _anotar(tarea, franja)
    return True, f'le toca: franja {franja}, horario segun {fuente}'


def main():
    if len(sys.argv) < 2:
        print('Uso: python horario_robot.py <tarea>[,<tarea>...] [--probar]')
        print('Tareas:', ', '.join(DE_FABRICA))
        return 2

    tareas = [t.strip() for t in sys.argv[1].split(',') if t.strip()]
    desconocidas = [t for t in tareas if t not in DE_FABRICA]
    if desconocidas:
        print(f'No conozco: {", ".join(desconocidas)}. Son: {", ".join(DE_FABRICA)}')
        return 2

    # VARIAS TAREAS EN UNA LLAMADA, y hace falta: el ancla es UNA sola tarea de Windows con
    # dos horarios -07:00 y 19:00-, que acá son `ancla_manana` y `ancla_noche`. Corre si a
    # cualquiera de las dos le toca, y la marca la deja SOLO la que disparó.
    solo_probar = '--probar' in sys.argv
    alguna = False
    for t in tareas:
        toca, motivo = le_toca(t, anotar=not solo_probar)
        print(f'[HORARIO] {datetime.now():%Y-%m-%d %H:%M} · {t} · {motivo}')
        if toca:
            alguna = True
            break            # con una que toque alcanza; no se gastan las marcas de las otras
    return 0 if alguna else 1


if __name__ == '__main__':
    sys.exit(main())
