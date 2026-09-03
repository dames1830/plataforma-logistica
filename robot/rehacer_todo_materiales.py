# -*- coding: utf-8 -*-
"""
REHACER EL HISTORIAL ENTERO CON LOS TIPOS NUEVOS (materiales y sin tipo).

Daniel, 02-sep-2026, despues de que se comprobara que los codigos de cinco
digitos que no estan en el Maestro son papel de seda, etiquetas y cajas:
*"ponle materiales"*. Los robots ya clasifican asi; falta que los dias VIEJOS
—que se calcularon cuando todo eso caia en "no calzado"— digan lo mismo.

SI NO SE REHACE, EL CUADRO MIENTE POR PARTIDA DOBLE: los dias nuevos tendrian
materiales aparte y los viejos no, asi que "no calzado" bajaria de golpe el dia
del cambio y pareceria que el CD dejo de mover cosas.

CADA LADO CON SU HERRAMIENTA, Y NO ES UN CAPRICHO
-------------------------------------------------
· PICKING   -> `rellenar_historico.py`. Cada archivo del WMS trae SU dia
               completo: comprobado, 0 de 32 mezclan dias.
· EMBALAJE  -> `rehacer_embalaje.py`. Un archivo del OBLPN NO es un dia: el del
               31-08 trae 12.497 lineas del 31 pero tambien 3.536 del 27 y 1.525
               del 28. Hay que juntarlos todos y quedarse con una linea por
               huella (LPN + articulo + hora).
               `rellenar_historico.py --embalaje` NO sirve: llama al robot
               archivo por archivo, que es justo el error que ya se pago una vez
               —dias viejos con el 92% de las lineas faltando—.

VA COMO TAREA PROGRAMADA. Es mas de media hora: como comando suelto se muere con
la sesion, y ya se corto una vez a los siete minutos.
"""
import io
import os
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
LOG = os.path.join(AQUI, 'logs', 'rehacer_materiales.log')


def log(t):
    linea = '[%s] %s' % (time.strftime('%H:%M:%S'), t)
    print(linea, flush=True)
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with io.open(LOG, 'a', encoding='utf-8') as f:
            f.write(linea + '\n')
    except Exception:
        pass


def correr(titulo, args, minutos):
    log('')
    log('=== %s ===' % titulo)
    log('    %s' % ' '.join(os.path.basename(a) for a in args[1:]))
    t0 = time.time()
    try:
        r = subprocess.run(args, cwd=AQUI, capture_output=True, text=True,
                           encoding='utf-8', errors='replace',
                           timeout=minutos * 60)
    except subprocess.TimeoutExpired:
        log('    SE PASO DE %d MINUTOS: se corta y se sigue con lo demas.' % minutos)
        return False
    # de la salida larga solo interesan las ultimas lineas y lo que grite
    for l in (r.stdout or '').split('\n'):
        if any(p in l for p in ('ERROR', 'FALL', 'no se pudo', 'CUADRA', 'Publicado',
                                'calculados', 'dias', 'OK')):
            log('    ' + l.strip()[:200])
    if r.returncode != 0:
        log('    TERMINO MAL (codigo %s)' % r.returncode)
        for l in (r.stderr or '').split('\n')[-8:]:
            if l.strip():
                log('    ! ' + l.strip()[:200])
    log('    %s en %.1f minutos' % ('listo' if r.returncode == 0 else 'con fallos',
                                    (time.time() - t0) / 60.0))
    return r.returncode == 0


log('')
log('#################################################################')
log('REHACER EL HISTORIAL CON materiales Y sin_tipo')
log('#################################################################')

correr('PICKING - recalcular todos los dias',
       [PY, '-u', os.path.join(AQUI, 'rellenar_historico.py'),
        '--picking', '--calcular', '--rehacer'], 90)

correr('PICKING - publicar',
       [PY, '-u', os.path.join(AQUI, 'rellenar_historico.py'),
        '--picking', '--publicar'], 40)

correr('EMBALAJE - juntar por dia, calcular y publicar',
       [PY, '-u', os.path.join(AQUI, 'rehacer_embalaje.py')], 90)

log('')
log('TERMINADO. El detalle completo quedo en %s' % LOG)
