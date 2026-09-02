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
# Donde se deja la copia local cuando OneDrive tiene el archivo en la nube.
ESTACION = os.path.join(LOGS, 'fuente')
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


def bajar_de_la_nube(ruta, destino):
    """TRAE EL ARCHIVO SI ONEDRIVE LO TIENE SOLO EN LA NUBE.

    Los archivos viejos quedan como marcador: se ven en la carpeta y pesan lo que
    corresponde, pero abrirlos revienta con `OSError: [Errno 22] Invalid
    argument`. Le paso a los tres primeros del relleno.

    Copiarlo es lo que obliga a OneDrive a bajarlo de verdad. Es la misma trampa
    del maestro de rutas, que como .xlsx se veia como un zip roto.
    """
    import shutil
    try:
        with io.open(ruta, 'rb') as f:
            f.read(1)
        return ruta                      # ya estaba en disco
    except OSError:
        pass

    # NI SIQUIERA COPIARLO LO BAJA: la tarea corre como SYSTEM y quien sabe
    # traerse un archivo de OneDrive es el cliente que corre en la sesion de
    # Administrator. Lo unico que funciona desde aca es MARCARLO como "tener
    # siempre en este equipo" -attrib +P- y esperar a que ese cliente lo baje.
    log('     esta solo en la nube; lo marco para que OneDrive lo baje...')
    os.system('attrib +P -U "%s" >nul 2>&1' % ruta)
    for _ in range(30):                  # hasta 2 minutos por archivo
        time.sleep(4)
        try:
            with io.open(ruta, 'rb') as f:
                f.read(1)
            log('     ya bajo')
            return ruta
        except OSError:
            continue
    raise IOError('OneDrive no lo bajo en 2 minutos; sigue solo en la nube')


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
            # SE LE PASA LA RUTA ENTERA, no el nombre: puede terminar siendo la
            # copia local si OneDrive lo tenia en la nube.
            os.makedirs(ESTACION, exist_ok=True)
            fuente = os.path.join(cfg['carpeta'], n)
            local = os.path.join(ESTACION, n)
            try:
                usar = bajar_de_la_nube(fuente, local)
            except Exception as e:
                log('     FALLO al bajarlo de la nube: %s' % e)
                fallados += 1
                continue
            # EL DIA SALE DEL NOMBRE. Los archivos traen el ano solo en la carpeta,
            # asi que se toma 2026 —es todo lo que hay bajado— y se comprueba
            # contra la fecha del propio archivo mas abajo.
            g = cfg['patron'].match(n)
            dia_arch = '2026-%02d-%02d' % (int(g.group(2)), int(g.group(1)))
            r = subprocess.run([PY, '-u', os.path.join(AQUI, cfg['script']), usar,
                                '--historico', '--dia', dia_arch],
                               capture_output=True, text=True, encoding='utf-8',
                               errors='replace')
            if usar == local:
                try:
                    os.remove(local)     # no se acumulan copias de 20 MB
                except Exception:
                    pass
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
