# -*- coding: utf-8 -*-
"""
archivar_historicos.py  -  Saca del arranque de la web la historia que nadie mira.

  Hermano de `archivar_tareas.py`, con el mismo metodo y para las otras dos areas
  que crecen sin techo:

      performance_log   630 KB   3.161 registros   56% de mas de 60 dias
      rf_assignments    433 KB   1.159 registros   46% de mas de 60 dias

  Las dos se bajan ENTERAS en cada sesion. Daniel, 03-sep-2026: *"no miro tareas
  hacia atras. Lo unico que necesito es guardarla para cualquier emergencia"*.
  Por eso NO SE BORRA NADA: se copia al historico y recien despues se recorta.

  EL ORDEN IMPORTA, igual que en las tareas. Primero copia, despues COMPRUEBA
  leyendo el area de vuelta, y solo entonces recorta. Al reves, un corte de red
  en el medio perderia los registros.

  COMO GUARDA EL HISTORICO. Las areas que no son `SINGLETON_AREAS` guardan un
  snapshot por dia y el servidor conserva los 2 mas recientes. Eso NO pierde
  nada porque cada snapshot es ACUMULATIVO: se lee el ultimo -un GET sin fecha
  devuelve ese-, se le agrega lo nuevo y se guarda todo junto. Es exactamente lo
  que ya hace `almacenaje_tasks_history`, que hoy tiene 4.430 tareas.

  Por defecto NO TOCA NADA: hay que pasarle --ejecutar a proposito.

  Uso:
    python archivar_historicos.py                    -> dice que haria
    python archivar_historicos.py --dias 90          -> conservar 90 dias
    python archivar_historicos.py --area rf          -> solo una de las dos
    python archivar_historicos.py --ejecutar         -> lo hace de verdad
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta

API = 'https://logistics-backend-wv0x.onrender.com'
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')
TIMEOUT = 180

# 60 dias: dos meses cubren cualquier revision que se haga de verdad, y las dos
# pantallas que leen estas areas ya arrancan en la semana en curso.
DIAS_QUE_SE_QUEDAN = 60

AREAS = {
    'performance': {
        'viva': 'performance_log',
        'historico': 'performance_log_history',
        'fecha': lambda r: str(r.get('date') or '')[:10],
        # fecha + dni: no hay dos registros del mismo dia para la misma persona
        'clave': lambda r: '%s|%s' % (r.get('date'), r.get('dni')),
        'nombre': 'Historial de performance',
    },
    'rf': {
        'viva': 'rf_assignments',
        'historico': 'rf_assignments_history',
        # `assigned_at` viene en UTC. Para un corte de 60 dias la diferencia de
        # 5 horas con Lima no mueve a nadie de lado, asi que se compara directo.
        'fecha': lambda r: str(r.get('assigned_at') or '')[:10],
        'clave': lambda r: str(r.get('id')),
        'nombre': 'Bitacora de RF',
    },
}


def _pedir(ruta, datos=None, metodo=None):
    cuerpo = json.dumps(datos).encode('utf-8') if datos is not None else None
    cab = {'Content-Type': 'application/json', 'User-Agent': 'archivar-historicos'}
    if ROBOT_TOKEN:
        cab['X-Robot-Token'] = ROBOT_TOKEN
    req = urllib.request.Request(
        '%s%s' % (API, ruta), data=cuerpo, method=metodo or ('POST' if datos else 'GET'),
        headers=cab)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode('utf-8'))


def leer(area):
    """El GET sin fecha devuelve el ultimo snapshot, que es el acumulado."""
    c = _pedir('/api/logistics/%s?z=%d' % (area, int(time.time())))
    d = c.get('data', c) if isinstance(c, dict) else c
    return d if isinstance(d, list) else []


def peso(x):
    return len(json.dumps(x, ensure_ascii=False).encode('utf-8')) / 1024.0


def trabajar(cfg, corte, de_verdad):
    print('')
    print('=' * 66)
    print('  %s  (%s)' % (cfg['nombre'], cfg['viva']))
    print('=' * 66)

    vivos = leer(cfg['viva'])
    historico = leer(cfg['historico'])
    print('  vivos: %s   |   historico: %s' % ('{:,}'.format(len(vivos)), '{:,}'.format(len(historico))))

    viejos = [r for r in vivos if cfg['fecha'](r) and cfg['fecha'](r) < corte]
    quedan = [r for r in vivos if r not in viejos]

    # SIN FECHA NO SE ARCHIVA. Un registro al que no se le puede leer la fecha no
    # se puede fechar para el corte, y en la duda se queda donde esta.
    sin_fecha = [r for r in vivos if not cfg['fecha'](r)]
    if sin_fecha:
        print('  %d registros sin fecha: se quedan donde estan' % len(sin_fecha))

    yaEstan = set(cfg['clave'](r) for r in historico)
    a_copiar = [r for r in viejos if cfg['clave'](r) not in yaEstan]
    repetidos = len(viejos) - len(a_copiar)

    print('')
    print('  se archivan:      %6s   (%6.0f KB)' % ('{:,}'.format(len(viejos)), peso(viejos)))
    if repetidos:
        print('  ya en historico:  %6s   (no se copian de nuevo)' % '{:,}'.format(repetidos))
    print('  se quedan:        %6s   (%6.0f KB)' % ('{:,}'.format(len(quedan)), peso(quedan)))
    print('  el arranque baja: %6.0f KB  ->  %.0f KB' % (peso(vivos), peso(quedan)))
    print('  historico queda:  %6s registros' % '{:,}'.format(len(historico) + len(a_copiar)))

    if not de_verdad:
        return 0
    if not a_copiar and len(quedan) == len(vivos):
        print('  nada que mover.')
        return 0

    # 1) COPIAR, acumulando sobre lo que ya habia
    if a_copiar:
        print('  1/3 copiando %s al historico...' % '{:,}'.format(len(a_copiar)))
        _pedir('/api/logistics/%s' % cfg['historico'], historico + a_copiar)

        # 2) COMPROBAR. Sin esto, un error del servidor pasaria inadvertido y el
        #    paso 3 recortaria registros que no quedaron guardados en ningun lado.
        print('  2/3 comprobando que llegaron...')
        time.sleep(2)
        verif = leer(cfg['historico'])
        ahora = set(cfg['clave'](r) for r in verif)
        faltan = [r for r in a_copiar if cfg['clave'](r) not in ahora]
        if faltan:
            print('  ERROR: %d registros no llegaron al historico.' % len(faltan))
            print('         NO se recorta nada. El area viva queda intacta.')
            return 1
        print('      ok: el historico tiene %s registros' % '{:,}'.format(len(verif)))

    # 3) Recien ahora se recorta, PERO SOBRE UNA LECTURA FRESCA.
    #
    #    Entre el paso 1 y este pasan varios segundos, y el turno noche sigue
    #    trabajando: una devolucion de RF guardada en el medio desaparecia al
    #    escribir la lista vieja. Se relee y se quita SOLO lo que se archivo, asi
    #    lo que haya entrado mientras tanto se conserva.
    archivados = set(cfg['clave'](r) for r in viejos)
    frescos = leer(cfg['viva'])
    quedan2 = [r for r in frescos if cfg['clave'](r) not in archivados]
    nuevos = len(frescos) - len(vivos)
    if nuevos:
        print('  ojo: entraron %d registros mientras se archivaba; se conservan' % nuevos)
    print('  3/3 dejando %s en el area viva...' % '{:,}'.format(len(quedan2)))
    _pedir('/api/logistics/%s' % cfg['viva'], quedan2)
    quedan = quedan2
    time.sleep(2)
    final = leer(cfg['viva'])
    print('      %s -> %s registros   (%.0f KB -> %.0f KB)'
          % ('{:,}'.format(len(vivos)), '{:,}'.format(len(final)), peso(vivos), peso(final)))
    if len(final) != len(quedan):
        print('  ATENCION: se esperaban %d y quedaron %d.' % (len(quedan), len(final)))
        return 2
    return 0


def main():
    args = sys.argv[1:]
    de_verdad = '--ejecutar' in args
    dias = int(args[args.index('--dias') + 1]) if '--dias' in args else DIAS_QUE_SE_QUEDAN
    corte = (datetime.now() - timedelta(days=dias)).strftime('%Y-%m-%d')
    cuales = [args[args.index('--area') + 1]] if '--area' in args else list(AREAS)

    print('[HISTORICOS] corte: se archiva lo anterior al %s  (se conservan %d dias)'
          % (corte, dias))
    if not de_verdad:
        print('[HISTORICOS] SIMULACION: no se mueve nada. Para hacerlo: --ejecutar')

    salida = 0
    for k in cuales:
        if k not in AREAS:
            print('  no conozco el area "%s". Son: %s' % (k, ', '.join(AREAS)))
            salida = 3
            continue
        try:
            r = trabajar(AREAS[k], corte, de_verdad)
            salida = salida or r
        except Exception as e:
            print('  FALLO en %s: %s' % (k, str(e)[:120]))
            salida = 4

    if not de_verdad:
        print('')
        print('  Esto fue solo la simulacion: NO se movio nada.')
    return salida


if __name__ == '__main__':
    sys.exit(main())
