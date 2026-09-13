# -*- coding: utf-8 -*-
"""
vigia_robots.py  -  El que avisa cuando un robot NO corrio.

  Daniel, 12-sep-2026: *"cada dia me sacas que el stock reserva esta mal, que el despacho
  esta mal, ahora que el slotting esta mal. A ver, cual es el problema de fondo"*.

  EL PROBLEMA DE FONDO ES EL SILENCIO. Un robot que se cae no hace ruido: escribe su queja
  en un archivo de texto del servidor que nadie abre, y Windows encima lo marca como
  "ejecutado correctamente" aunque el proceso se haya muerto al segundo. Todo PARECE normal.
  Distribucion estuvo cuatro dias caida; el Stock Reserva de las 07:00 estuvo seis; el
  picking de dos sabados, diecisiete.

  LOS AVISOS DEL CELULAR NO ALCANZAN, y hay que verlo claro: saltan cuando el robot CORRE.
  Si la tarea esta apagada, o Windows no la dispara, o el servidor estaba reiniciandose, no
  hay aviso — hay silencio. Y el silencio se parece demasiado a que todo va bien.

  ESTE CIERRA ESE HUECO. Una vez al dia pregunta *quien tenia que correr y no reporto*, y
  manda UN solo aviso con la lista. Si no manda nada, es que todo corrio: ese es el trato.

  DOS PREGUNTAS POR ROBOT, que fallan distinto:

      ¿ARRANCO?   `horario_corridas.json` guarda cada pase que el horario autorizo. Si el
                  ultimo pase que le tocaba no esta ahi, la tarea no se disparo.

      ¿PUBLICO?   El area que deja cada robot lleva su fecha de publicacion en
                  `/api/sync/versiones`. Si arranco pero el area sigue vieja, se murio a
                  mitad de camino. ESTA es la que habria cazado a Distribucion el dia 9.

  EL HORARIO NO SE COPIA, SE IMPORTA. Este vigia usa `franja_actual()` de
  `horario_robot.py`, la misma funcion con la que cada robot decide si le toca. Si tuviera
  su propia copia, el dia que se cambie una hora desde la web el aviso mentiria — y un
  vigia que miente es peor que no tenerlo.

  Uso:
    python vigia_robots.py --probar     el cuadro completo, sin mandar nada
    python vigia_robots.py              revisa y avisa solo si falta alguno
    python vigia_robots.py --beta       contra la base de pruebas
"""

import importlib.util
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

API = 'https://logistics-backend-wv0x.onrender.com'
VERSIONES = API + '/api/sync/versiones'
CORRIDAS = os.path.join(AQUI, 'horario_corridas.json')

# CUANTO SE MIRA HACIA ATRAS. 26 horas y no 24: el vigia corre una vez al dia, y con dos
# horas de solape ningun pase se queda sin revisar por haber caido entre dos corridas.
HORAS_ATRAS = 26

# CUANTO SE LE PERDONA AL FINAL. Un robot que arranco hace veinte minutos puede estar
# corriendo todavia: el ASN tarda 63 minutos y el ancla 20. Nada de las ultimas DOS HORAS
# se denuncia; se revisa manana. Sin este margen el vigia acusaria al que esta trabajando.
GRACIA_MIN = 120


def log(t, nivel='INFO'):
    print('[%s] %-5s %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t))
    sys.stdout.flush()


def _cargar(nombre):
    """Trae un modulo hermano por ruta, sin depender de como se llamo al script."""
    ruta = os.path.join(AQUI, nombre + '.py')
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ─────────────────────────────────────────────────────────────────────────────────────
#  QUE AREA DEJA CADA ROBOT AL CORRER
#
#  Espejo de la lista de `robotsService.js`, que es la que dibuja la pantalla de Robots y
#  donde se decide. Aca van SOLO los que publican SIEMPRE que corren, porque de esos si se
#  puede exigir el area.
#
#  LOS QUE FALTAN NO SON UN OLVIDO, y meterlos convertiria al vigia en uno que grita en
#  falso — que es peor que no tenerlo:
#
#    correo_citas         se corta apenas encuentra el correo; el dia que no llega, corre
#    despacho_potencial   bien y no publica nada. Es lo normal, no una falla.
#    cierre_dia           solo hace algo SI el Corte del turno dia fallo. Casi nunca.
#    oblpn_hora           bajan archivos o respaldan; no tienen area propia que mirar.
#    reportes, respaldo,
#    archivado, asn_web
#
#  De todos ellos se comprueba igual que ARRANCARON, que es la mitad que si aplica.
# ─────────────────────────────────────────────────────────────────────────────────────
PUBLICA = {
    'ancla_noche': 'almacenaje_activo',
    'ancla_manana': 'almacenaje_activo',
    'stock_hora': 'layout_stock_hora',
    'picking_hora': 'picking_dias',
    'mapa_hora': 'layout_activo_SEL',
    'cruce_wms': 'cruce_wms',
    'distribucion': 'distribucion_dia',
}


def sellos(usar_beta=False):
    """Cuando se publico cada area por ultima vez. Viene 'AAAA-MM-DD HH:MM:SS', hora de
       Lima y sin zona, igual que lo lee el sello de los reportes en la web."""
    cab = {'User-Agent': 'vigia-robots'}
    if usar_beta:
        cab['X-Environment'] = 'beta'
    req = urllib.request.Request('%s?z=%d' % (VERSIONES, int(time.time())), headers=cab)
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode('utf-8'))
    return (d or {}).get('versiones', {}) or {}


def fecha_de(sello):
    for f in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(str(sello)[:19], f)
        except ValueError:
            continue
    return None


def corridas():
    try:
        with open(CORRIDAS, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def fichar():
    """Deja constancia de que el vigia paso, y dice si le faltó alguna vuelta.

       ES LA PREGUNTA INCOMODA: si el vigia no corre, hay silencio — y el trato es
       justamente que el silencio significa que todo va bien. Sin esto, apagar esta
       tarea apagaria el aviso de que todo lo demas esta apagado.

       No se puede cerrar del todo -alguien tiene que ser el ultimo de la fila-, pero
       con esto la vuelta siguiente lo canta: si la anterior fue hace mas de 30 horas,
       el aviso lo dice."""
    yo = os.path.join(AQUI, 'vigia_ultima.json')
    antes = None
    try:
        with open(yo, encoding='utf-8') as f:
            antes = fecha_de(json.load(f).get('cuando'))
    except Exception:
        pass
    try:
        with open(yo, 'w', encoding='utf-8') as f:
            json.dump({'cuando': datetime.now().strftime('%Y-%m-%d %H:%M:%S')}, f)
    except Exception as e:
        log('no se pudo fichar: %s' % str(e)[:60], 'AVISO')
    if antes and (datetime.now() - antes) > timedelta(hours=30):
        return 'el vigía no corrió desde el %s' % antes.strftime('%d-%m %H:%M')
    return None


def ultimo_pase(hr, clave, cfg, hasta):
    """El ultimo pase que le tocaba a este robot antes de `hasta`.

       Se camina hacia atras minuto a minuto preguntandole a `franja_actual()`, que es la
       misma funcion con la que el robot decide si le toca. Asi el vigia no tiene ni una
       linea de horario propio: cambiar una hora desde la web lo cambia aca tambien."""
    t = hasta.replace(second=0, microsecond=0)
    tope = hasta - timedelta(hours=HORAS_ATRAS)
    while t >= tope:
        franja = hr.franja_actual(clave, cfg, t)
        if franja:
            return franja
        t -= timedelta(minutes=1)
    return None


def revisar(usar_beta=False):
    """Devuelve (problemas, revisados). Cada problema es (clave, pase, que_paso)."""
    hr = _cargar('horario_robot')
    cfg, fuente = hr.configuracion()
    log('horario segun %s' % fuente)

    ya = corridas()
    try:
        marcas = sellos(usar_beta)
    except Exception as e:
        log('no se pudieron traer las versiones: %s' % str(e)[:70], 'AVISO')
        marcas = {}

    # El corte: nada de las ultimas dos horas se juzga, puede estar corriendo.
    hasta = datetime.now() - timedelta(minutes=GRACIA_MIN)

    problemas, revisados = [], []
    for clave in sorted(cfg.keys()):
        c = cfg.get(clave) or {}
        if not isinstance(c, dict) or not c.get('activa', True):
            continue
        pase = ultimo_pase(hr, clave, cfg, hasta)
        if not pase:
            continue                      # no le tocaba en la ventana: no hay nada que pedirle
        esperado = datetime.strptime(pase, '%Y-%m-%d %H:%M')

        # SE COMPARA "DESDE CUANDO", NO EL PASE EXACTO. `horario_corridas.json` guarda solo
        # el ULTIMO pase de cada robot, asi que exigir que coincida con el que estoy mirando
        # marcaria como caido a todo el que haya vuelto a correr despues -que es justo lo que
        # hace un robot sano-. Lo que importa es que arrancara DE ESE PASE EN ADELANTE.
        arranco = fecha_de(str(ya.get(clave, '')) + ':00')
        if arranco is None or arranco < esperado:
            problemas.append((clave, pase, 'no arrancó'))
            revisados.append((clave, pase, 'NO ARRANCO',
                              'última vez: %s' % (ya.get(clave) or 'nunca')))
            continue

        area = PUBLICA.get(clave)
        if not area:
            revisados.append((clave, pase, 'arrancó', None))
            continue

        cuando = fecha_de(marcas.get(area))
        if cuando is None:
            problemas.append((clave, pase, 'nunca publicó'))
            revisados.append((clave, pase, 'SIN PUBLICAR', area))
        elif cuando < esperado:
            problemas.append((clave, pase, 'arrancó y no publicó'))
            revisados.append((clave, pase, 'NO PUBLICO', '%s: %s' % (area, cuando)))
        else:
            revisados.append((clave, pase, 'ok', '%s: %s' % (area, cuando.strftime('%d-%m %H:%M'))))

    return problemas, revisados


def main():
    args = sys.argv[1:]
    usar_beta = '--beta' in args
    probar = '--probar' in args

    ap = _cargar('avisar_push')
    if usar_beta:
        ap.USAR_BETA = True

    problemas, revisados = revisar(usar_beta)
    salto = None if probar else fichar()

    log('')
    log('%-22s %-18s %-14s %s' % ('robot', 'le tocaba', 'que paso', 'detalle'))
    for clave, pase, estado, detalle in revisados:
        log('%-22s %-18s %-14s %s' % (ap.bonito(clave), pase, estado, detalle or ''))
    log('')

    if not problemas and not salto:
        log('los %d robots que tenían pase reportaron. No se manda nada.' % len(revisados))
        return 0

    if not problemas:
        log(salto)
        ap.avisar('vigia', '⚠️ El vigía se saltó un día', salto, etiqueta='vigia',
                  de_verdad=True)
        return 0

    # UN SOLO AVISO CON LA LISTA, no uno por robot: si fallaron cinco, cinco notificaciones
    # se leen como cinco sustos sueltos y ninguna dice que el problema es mas grande.
    nombres = [ap.bonito(c) for c, _, _ in problemas]
    titulo = ('⚠️ Un robot no reportó' if len(problemas) == 1
              else '⚠️ %d robots no reportaron' % len(problemas))
    partes = ['%s (%s, %s)' % (ap.bonito(c), p[11:], q) for c, p, q in problemas[:3]]
    if len(problemas) > 3:
        partes.append('y %d más' % (len(problemas) - 3))
    if salto:
        partes.append(salto)
    cuerpo = ' · '.join(partes)

    log('%s  ->  %s' % (titulo, cuerpo))
    if probar:
        log('   (simulación: no se manda nada)')
        return 0

    # Va solo al admin: es informacion de mantenimiento, no del almacen.
    ap.avisar('vigia', titulo, cuerpo, etiqueta='vigia', de_verdad=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
