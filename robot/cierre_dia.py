# -*- coding: utf-8 -*-
"""
ROBOT: EL RESCATE DEL DIA ANTERIOR  (antes: el cierre).

DESDE EL 04-sep-2026 SOLO CORRE SI EL CORTE DE LAS 20:00 FALLO.

Daniel: *"entonces cambia de nombre, que se llame algo como Backup del dia
anterior"*. Tiene razon: el corte le saco el trabajo.

MEDIDO sobre los archivos completos que baja este mismo robot:

    02-sep   26.025 lineas   ultima actividad 18:00   despues de las 20:00: CERO
    01-sep   27.951 lineas   ultima actividad 19:00   despues de las 20:00: CERO

El embalaje termina a las 18:00 y el picking a las 17:00. El corte de las 20:00 ya
trae el dia entero, asi que esto bajaba lo mismo, calculaba lo mismo y publicaba
ENCIMA: 25 minutos de WMS para el mismo resultado, y a la hora en que el ancla de
la manana puede estar estirandose.

NO SE BORRA. Un dia el corte va a fallar -el WMS ocupado, un archivo que no baja- y
ese dia esto es lo unico que queda. Con `--igual` se fuerza a correr.

--- lo que decia antes, y sigue valiendo cuando SI corre ---

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
import json
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


API_CORTE = 'https://logistics-backend-wv0x.onrender.com/api/logistics/corte_turno'


def el_corte_ya_cerro(iso):
    """Si el corte de las 20:00 cerro COMPLETO ese dia.

    El corte publica su marca al terminar: la fecha, cuanto tardo y si los tres
    pasos salieron bien. Si dice que si, este robot no tiene nada que hacer.

    ANTE LA DUDA, SE CORRE. Si no se puede leer la marca -sin internet, el
    servidor dormido- se devuelve False y el rescate entra igual: perder 25
    minutos de WMS es barato, perder el dia no.
    """
    try:
        import urllib.request
        with urllib.request.urlopen(API_CORTE + '?t=cierre', timeout=45) as r:
            d = json.load(r)
        m = d.get('data') or {}
        return bool(m.get('completo')) and m.get('dia') == iso, m
    except Exception as e:
        log('no se pudo leer la marca del corte (%s); se corre igual' % type(e).__name__, 'WARN')
        return False, {}


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
    log('RESCATE DEL %s  (el dia entero, de 00:00 a 23:59)' % ayer.strftime('%d-%m-%Y'))
    log('=' * 64)

    # ── ¿HACE FALTA? ────────────────────────────────────────────────────────
    # Desde el 04-sep-2026 esto es un rescate, no el cierre. El corte de las 20:00
    # ya trae el dia entero -medido: el embalaje termina a las 18:00 y el picking a
    # las 17:00, y despues de las 20:00 no pasa nada-. Correr igual seria bajar lo
    # mismo, calcular lo mismo y publicar encima, gastando 25 minutos de WMS a la
    # hora en que el ancla de la manana puede estar estirandose.
    if '--igual' not in args:
        cerro, marca = el_corte_ya_cerro(iso)
        if cerro:
            log('el corte de turno ya cerro el %s a las %s en %s minutos, con sus %d '
                'pasos en orden. NO SE ENTRA AL WMS.'
                % (iso, str(marca.get('cuando', ''))[11:19], marca.get('minutos', '?'),
                   len(marca.get('pasos') or [])))
            return 0
        log('el corte no cerro ese dia: se rescata.')

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
    log('rescate del %s: %d de 2 cuadros publicados' % (iso, hechos))
    return 0 if hechos == 2 else 1


if __name__ == '__main__':
    sys.exit(main())
