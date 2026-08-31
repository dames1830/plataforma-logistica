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
    'stock_hora':   {'activa': True, 'minuto': 30, 'cadaMin': 60, 'dias': {d: True for d in DIAS}},
    'picking_hora': {'activa': True, 'minuto': 50, 'cadaMin': 60, 'dias': {d: True for d in DIAS}},
    # El mapa de calor se dibuja con el stock que publica `stock_hora` al minuto 30, y
    # esa corrida tarda unos 8 minutos. Por eso va al 45: ya esta el stock nuevo y no se
    # cruza con el picking, que entra al 50.
    'mapa_hora':    {'activa': True, 'minuto': 45, 'cadaMin': 60, 'dias': {d: True for d in DIAS}},
    # A las 06:45: el turno noche cierra 06:30 y el de la manana entra 08:00, asi que
    # el almacen esta quieto y el dia de ayer ya cerro. Estaba a las 08:00 y eso
    # empujaba a SKUs sin salida fuera de la manana.
    'reportes':     {'activa': True, 'hora': '06:45', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
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
    'sin_salida':   {'activa': True, 'hora': '07:30', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
    # El OBLPN del embalaje va a la MISMA hora y los MISMOS dias que `reportes`, que es
    # el Detalle de Orden. Lo pidio Daniel el 30-ago-2026 y tiene sentido: los dos bajan
    # el DIA DE AYER ya cerrado, asi que tienen que mirar la misma jornada. Si uno
    # corriera a otra hora, un dia cualquiera cruzarian jornadas distintas.
    # Los dos entran al WMS, y el candado los ordena: el segundo espera su turno.
    'oblpn':        {'activa': True, 'hora': '06:45', 'dias': {'lun': True, 'mar': True, 'mie': True,
                                                               'jue': True, 'vie': True, 'sab': True, 'dom': False}},
}
DIARIAS = ('ancla_noche', 'ancla_manana', 'reportes', 'respaldo', 'archivado', 'sin_salida', 'oblpn')


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
    desde = int(c.get('minuto') or 0)
    base = desde
    while base < 24 * 60:
        if base <= minutos < base + VENTANA_MIN:
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
