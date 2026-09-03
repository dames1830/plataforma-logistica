# -*- coding: utf-8 -*-
"""
EL CRUCE DEL 1 Y EL 2 DE SETIEMBRE, UNO DETRAS DEL OTRO.

Daniel, 02-sep-2026: *"bajate el web report de embalaje y picking por hora y
crúzalo contra lo que tienes tú. Ahorita solamente tengo el treinta y uno; quiero
que cruces también el primero de septiembre y el dos"*.

POR QUE UN GUION Y NO DOS COMANDOS: cada corrida entra al WMS, y entrar dos veces
seguidas a mano es la forma de dejar una pestaña abierta. Ya paso: once pestañas
abiertas tumbaron ocho dias de OBLPN. Asi el segundo dia arranca solo cuando el
primero cerro de verdad.

VA COMO TAREA PROGRAMADA. Son dos corridas con dos informes cada una; como
comando suelto se muere al cerrarse la sesion.

NO SE TOCA EL DISENO DE LOS INFORMES. Lo mismo que ya hace `cruce_wms.py`: se
corren, se exportan y se sale con Cancelar. Eso lo maneja `prodhora_web.py`, que
viene probado; aca solo se le pide el dia.
"""
import io
import os
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
LOG = os.path.join(AQUI, 'logs', 'cruce_dos_dias.log')
DIAS = ['01-09-2026', '02-09-2026']
TOPE_MINUTOS = 45          # por dia; una corrida sana son unos 10

# CON `--sin-bajar` NO SE VUELVE A ENTRAR AL WMS: se rehace el cruce con los Excel
# que la corrida anterior ya dejo en disco. Se usa cuando lo que fallo fue la
# cuenta y no la bajada — entrar de nuevo seria pasear por el WMS sin necesidad, y
# cada paseo es una oportunidad de dejar una pestaña abierta.
SIN_BAJAR = '--sin-bajar' in sys.argv


def log(t):
    linea = '[%s] %s' % (time.strftime('%H:%M:%S'), t)
    print(linea, flush=True)
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with io.open(LOG, 'a', encoding='utf-8') as f:
            f.write(linea + '\n')
    except Exception:
        pass


log('')
log('#############################################################')
log('CRUCE DEL WMS - %s%s' % (' y '.join(DIAS),
    '   (con los Excel ya bajados, sin entrar al WMS)' if SIN_BAJAR else ''))
log('#############################################################')

for dia in DIAS:
    log('')
    log('=== %s ===' % dia)
    t0 = time.time()
    try:
        cmd = [PY, '-u', os.path.join(AQUI, 'cruce_wms.py'), '--dia', dia]
        if SIN_BAJAR:
            cmd.append('--sin-bajar')
        r = subprocess.run(cmd,
                           cwd=AQUI, capture_output=True, text=True,
                           encoding='utf-8', errors='replace',
                           timeout=TOPE_MINUTOS * 60)
    except subprocess.TimeoutExpired:
        log('    SE PASO DE %d MINUTOS. Se corta este dia y se sigue con el otro.'
            % TOPE_MINUTOS)
        continue

    # De la salida larga interesa lo que informa y lo que grita
    for l in (r.stdout or '').split('\n'):
        if any(p in l for p in ('ERROR', 'FALL', 'no se pudo', 'Publicado', 'CUADRA',
                                'DIFEREN', 'lineas', 'coinciden', 'celdas', 'OK')):
            log('    ' + l.strip()[:190])
    if r.returncode != 0:
        log('    TERMINO MAL (codigo %s)' % r.returncode)
        for l in (r.stderr or '').split('\n')[-10:]:
            if l.strip():
                log('    ! ' + l.strip()[:190])
    log('    %s en %.1f minutos'
        % ('listo' if r.returncode == 0 else 'con fallos', (time.time() - t0) / 60.0))

    # UN RESPIRO ENTRE LOS DOS. El navegador tarda en soltar del todo, y arrancar
    # el siguiente encima es como dejar dos sesiones abiertas en el WMS.
    if dia != DIAS[-1]:
        log('    esperando 30 s a que el navegador cierre del todo...')
        time.sleep(30)

log('')
log('TERMINADO. El detalle esta en %s' % LOG)
