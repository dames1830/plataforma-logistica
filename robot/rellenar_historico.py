# -*- coding: utf-8 -*-
"""
RELLENAR EL HISTORIAL DE PICKING POR DIA Y EMBALAJE POR DIA.

Daniel, 02-sep-2026: *"esos treinta y cuatro archivos de picking deben estar en
la data del modulo de picking. Cuando yo filtre el tres de agosto, me debe jalar
la data del tres de agosto. Quiero tener ese historial e ir acumulando"*.

Los archivos del WMS estan todos en OneDrive —34 de picking y 30 de embalaje—,
pero el cuadro de cada dia nunca se calculo: el robot arranco el 02-sep. Esto
recorre TODOS los archivos y deja el cuadro de cada dia listo.

DOS PASOS, Y A PROPOSITO
------------------------
1. `--calcular`  lee cada CSV y guarda el cuadro en `logs\\historico`. Tarda,
   pero no toca el servidor ni el WMS: se puede correr cuando sea.
2. `--publicar`  sube al servidor lo que quedo guardado.

Van separados porque hoy el servidor guarda **2 dias por area**. Subir treinta
dias ahora dejaria solo los dos ultimos —esta comprobado: el embalaje del 28 se
publico y se borro en el acto—. Cuando el tope suba a un mes, el paso 2 los sube
todos sin volver a calcular nada.

SE PUEDE CORRER DE NUEVO SIN MIEDO. El paso 1 saltea los dias que ya estan
calculados, salvo que se le pase `--rehacer`. Asi una corrida cortada se retoma
donde iba.
"""
import io
import json
import os
import re
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

LOGS = os.path.join('C:' + os.sep, 'wms_scraping', 'logs')
HIST = os.path.join(LOGS, 'historico')
PY = os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'),
                  'Python313', 'python.exe')

BASE_CAND = [
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive',
                 'danielames.bata', 'scraping Stock'),
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive - Bata',
                 'danielames.bata', 'scraping Stock'),
]
BASE = next((b for b in BASE_CAND if os.path.isdir(b)), BASE_CAND[0])

LADOS = {
    'picking': {'area': 'picking_por_hora', 'script': 'produccion_picking.py',
                'carpeta': os.path.join(BASE, 'Picking'),
                'patron': re.compile(r'^Picking (\d{1,2})-(\d{1,2})\.csv$', re.I)},
    'embalaje': {'area': 'embalaje_por_hora', 'script': 'produccion_embalaje.py',
                 'carpeta': os.path.join(BASE, 'OBLPN Embalaje'),
                 'patron': re.compile(r'^OBLPN (\d{1,2})-(\d{1,2})\.csv$', re.I)},
}

# LOS DOMINGOS BAJAN UN ARCHIVO CASI VACIO —100 bytes— y no hay nada que calcular.
MINIMO_KB = 200


def log(t):
    print('[%s] %s' % (time.strftime('%H:%M:%S'), t))
    sys.stdout.flush()


def archivos_de(clave):
    """Los CSV de esa carpeta que valen la pena, del mas viejo al mas nuevo."""
    cfg = LADOS[clave]
    out = []
    try:
        nombres = os.listdir(cfg['carpeta'])
    except Exception as e:
        log('no puedo leer %s: %s' % (cfg['carpeta'], e))
        return out
    for n in sorted(nombres):
        m = cfg['patron'].match(n)
        if not m:
            continue
        ruta = os.path.join(cfg['carpeta'], n)
        kb = os.path.getsize(ruta) / 1024.0
        if kb < MINIMO_KB:
            log('  %-22s %6.0f KB  se saltea, esta vacio (domingo)' % (n, kb))
            continue
        out.append(n)
    return out


def calcular(claves, rehacer):
    os.makedirs(HIST, exist_ok=True)
    ya = set(os.listdir(HIST))
    for clave in claves:
        cfg = LADOS[clave]
        nombres = archivos_de(clave)
        log('')
        log('=' * 66)
        log('%s: %d archivos con datos' % (clave.upper(), len(nombres)))
        log('=' * 66)
        hechos = saltados = fallados = 0
        for i, n in enumerate(nombres, 1):
            # el dia no se sabe hasta abrir el archivo, asi que para saltear se
            # mira si YA hay un json de ese mismo archivo; se apunta en un indice
            marca = '_hecho_%s_%s.txt' % (cfg['area'], n.replace(' ', '_'))
            if not rehacer and marca in ya:
                saltados += 1
                continue
            log('%d/%d  %s' % (i, len(nombres), n))
            r = subprocess.run([PY, '-u', os.path.join(AQUI, cfg['script']), n, '--historico'],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace')
            linea = [l for l in (r.stdout or '').splitlines()
                     if 'HISTORICO' in l or 'ERROR' in l or 'AVISO' in l]
            for l in linea[-2:]:
                log('     ' + l.strip())
            if r.returncode == 0 and 'HISTORICO' in (r.stdout or ''):
                hechos += 1
                io.open(os.path.join(HIST, marca), 'w', encoding='utf-8').write(n)
            else:
                fallados += 1
                cola = (r.stderr or r.stdout or '').strip().splitlines()[-2:]
                for l in cola:
                    log('     FALLO: ' + l.strip()[:160])
        log('%s: %d calculados, %d ya estaban, %d fallaron'
            % (clave.upper(), hechos, saltados, fallados))


def publicar(claves):
    from publicar_area import publicar as subir
    for clave in claves:
        area = LADOS[clave]['area']
        archivos = sorted(n for n in os.listdir(HIST)
                          if n.startswith(area + '_') and n.endswith('.json'))
        log('')
        log('%s: %d dias para subir' % (clave.upper(), len(archivos)))
        for n in archivos:
            dia = n[len(area) + 1:-5]
            datos = json.load(io.open(os.path.join(HIST, n), encoding='utf-8'))
            subir(area, datos, dia, lambda t, nivel='INFO': log('  ' + t))


def main():
    args = sys.argv[1:]
    claves = [c for c in LADOS if '--' + c in args] or list(LADOS)
    if '--publicar' in args:
        publicar(claves)
    else:
        calcular(claves, '--rehacer' in args)
    # QUE HAY GUARDADO, siempre al final: es lo que dice si falta algo.
    if os.path.isdir(HIST):
        for clave in claves:
            area = LADOS[clave]['area']
            dias = sorted(n[len(area) + 1:-5] for n in os.listdir(HIST)
                          if n.startswith(area + '_') and n.endswith('.json'))
            log('')
            log('%s: %d dias listos en disco%s'
                % (clave.upper(), len(dias),
                   (' — del %s al %s' % (dias[0], dias[-1])) if dias else ''))
            log('  ' + ', '.join(dias))
    return 0


if __name__ == '__main__':
    sys.exit(main())
