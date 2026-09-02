# -*- coding: utf-8 -*-
"""
ROBOT: EL CIERRE DEL DIA ANTERIOR, DE 00:00 A 23:59.

Daniel, 02-sep-2026: *"tambien hay otro reporte que me tienes que bajar, que
tiene que ser desde el primero de agosto desde las cero cero horas hasta el
primero de agosto veintitres cincuenta y nueve. Ese es el que se debe de quedar"*.
Y: *"el robot de las siete y veinte baja el picking del dia anterior completo,
pero tambien deberia bajar el de embalaje completo. Los dos van de la mano"*.

POR QUE NO SE PUEDE CERRAR A LAS 20:00. El avance de cada 2 horas termina a las
20:20 y el dia sigue: medido en cuatro dias de agosto hay hasta 275 lineas de
picking despues de las 20:00 y 71 antes de las 08:00. Un reporte de 00:00 a 23:59
solo esta completo DESPUES de medianoche, asi que el cierre va a la manana
siguiente.

QUE HACE, EN ORDEN
------------------
1. Baja el OBLPN del dia anterior ENTERO -`oblpn_embalaje.py` sin `--hoy`-. El
   picking de ayer ya lo baja el robot de las 07:20, asi que ese no se repite.
2. Recalcula los dos cuadros de ese dia con los archivos completos y los publica.
   Lo que queda en el historial es esto, no el ultimo avance.

VA DESPUES DEL ROBOT DE LAS 07:20, que tarda hasta 40 minutos. Por eso 08:30: a
esa hora el picking de ayer ya esta en OneDrive y el WMS esta libre hasta el
primer avance de las 10:00.
"""
import io
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, r"C:\wms_scraping")

PY = sys.executable or os.path.join(
    os.environ.get('ProgramFiles', r'C:\Program Files'), 'Python313', 'python.exe')

BASE_CAND = [
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive',
                 'danielames.bata', 'scraping Stock'),
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive - Bata',
                 'danielames.bata', 'scraping Stock'),
]
BASE = next((b for b in BASE_CAND if os.path.isdir(b)), BASE_CAND[0])


def log(t, nivel='INFO'):
    print('[%s] %-5s %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t))
    sys.stdout.flush()


def correr(nombre, args, minutos=45):
    log('--- %s' % nombre)
    try:
        r = subprocess.run([PY, '-u'] + args, capture_output=True, text=True,
                           encoding='utf-8', errors='replace', timeout=minutos * 60)
    except subprocess.TimeoutExpired:
        log('%s se paso de %d minutos' % (nombre, minutos), 'ERROR')
        return False, ''
    salida = r.stdout or ''
    for l in salida.splitlines():
        if any(x in l for x in ('Publicado', 'ERROR', 'AVISO', 'BAJADO', 'DIA ', 'HISTORICO')):
            log('   ' + l.strip()[:150])
    if r.returncode != 0:
        for l in (r.stderr or salida).strip().splitlines()[-3:]:
            log('   ' + l.strip()[:150], 'ERROR')
    return r.returncode == 0, salida


def buscar(carpeta, plantillas, d):
    """El archivo de ese dia, probando las dos formas de escribir la fecha."""
    for pl in plantillas:
        ruta = os.path.join(carpeta, pl % (d.day, d.month))
        if os.path.isfile(ruta):
            return ruta
    return None


def main():
    args = sys.argv[1:]
    if '--dia' in args and len(args) > args.index('--dia') + 1:
        v = args[args.index('--dia') + 1]
        if not re.match(r'^\d{2}-\d{2}-\d{4}$', v):
            log('el dia va como DD-MM-AAAA, llego %r' % v, 'ERROR')
            return 1
        dd, mm, aa = v.split('-')
        ayer = datetime(int(aa), int(mm), int(dd))
    else:
        ayer = datetime.now() - timedelta(days=1)
    iso = ayer.strftime('%Y-%m-%d')

    log('=' * 64)
    log('CIERRE DEL %s  (de 00:00 a 23:59)' % ayer.strftime('%d-%m-%Y'))
    log('=' * 64)

    # ── 1. el OBLPN de ayer, entero ─────────────────────────────────────
    # Sin `--hoy` baja el dia anterior. Es la unica descarga que hace este
    # robot: el picking de ayer lo dejo el de las 07:20 y repetirlo serian
    # trece minutos mas de WMS ocupado para el mismo archivo.
    if '--sin-bajar' not in args:
        correr('bajando el OBLPN de ayer entero',
               [os.path.join(AQUI, 'oblpn_embalaje.py')], minutos=45)

    # ── 2. los dos cuadros, con los archivos completos ──────────────────
    hechos = 0
    for nombre, script, carpeta, plantillas in (
            ('PICKING', 'produccion_picking.py', os.path.join(BASE, 'Picking'),
             ['Picking %d-%d.csv', 'Picking %02d-%02d.csv']),
            ('EMBALAJE', 'produccion_embalaje.py', os.path.join(BASE, 'OBLPN Embalaje'),
             ['OBLPN %02d-%02d.csv', 'OBLPN %d-%d.csv'])):
        ruta = buscar(carpeta, plantillas, ayer)
        if not ruta:
            log('no encuentro el archivo de %s del %s; ese lado se salta'
                % (nombre, iso), 'ERROR')
            continue
        ok, _ = correr('%s: %s' % (nombre, os.path.basename(ruta)),
                       [os.path.join(AQUI, script), ruta, '--dia', iso], minutos=20)
        hechos += 1 if ok else 0

    log('')
    log('cierre del %s: %d de 2 cuadros publicados' % (iso, hechos))
    return 0 if hechos == 2 else 1


if __name__ == '__main__':
    sys.exit(main())
