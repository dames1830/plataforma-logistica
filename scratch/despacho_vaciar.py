# -*- coding: utf-8 -*-
"""
DEJAR EL DESPACHO EN CERO, PARA CARGARLO DE NUEVO DESDE EL CELULAR

Daniel, 15-sep-2026: *"voy a hacer una prueba cargando lo del 15 del 9, asi que elimina
todo y voy a volver a cargarlo yo desde WhatsApp a la aplicacion movil"*.

ANTES DE BORRAR SE GUARDA TODO EN UN ARCHIVO LOCAL, con nombre y hora. Borrar sin
respaldo es de las pocas cosas que no se pueden deshacer, y el respaldo cuesta un
segundo. Se comprueba que el respaldo tenga las filas ANTES de tocar nada: un respaldo
que no se verifico no es un respaldo.

    python vaciar_despacho.py                      # muestra que borraria
    python vaciar_despacho.py --subir              # beta
    python vaciar_despacho.py --subir --produccion
"""
import sys
import io
import json
import datetime
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'
BASE = 'despacho_catalogo'
INDICE = 'despacho_catalogo_indice'
CAMBIOS = 'despacho_catalogo_cambios'
SEMANA = 'despacho_catalogo_sem_'


def pedir(area, cab):
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, area), headers=cab)
    with urllib.request.urlopen(pet, timeout=180) as r:
        c = json.loads(r.read().decode('utf-8'))
    return c.get('data', c) if isinstance(c, dict) else c


def guardar(area, datos, cab):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    h = {'Content-Type': 'application/json'}
    h.update(cab)
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, area), data=cuerpo,
                                 headers=h, method='POST')
    with urllib.request.urlopen(pet, timeout=180) as r:
        r.read()


def main():
    prod = '--produccion' in sys.argv
    cab = {} if prod else {'X-Environment': 'beta'}
    donde = 'PRODUCCION' if prod else 'beta'
    subir = '--subir' in sys.argv

    indice = pedir(INDICE, cab) or {}
    semanas = list((indice.get('semanas') or {}).keys())
    areas = [BASE, CAMBIOS, INDICE] + [SEMANA + l for l in semanas]

    print('EN %s HAY:' % donde)
    todo = {}
    filas = 0
    for a in areas:
        try:
            d = pedir(a, cab)
        except Exception as e:
            print('   %-36s no se pudo leer: %s' % (a, e))
            continue
        todo[a] = d
        n = len(((d or {}).get('filas')) or ((d or {}).get('porId')) or [])
        filas += n if a.startswith(SEMANA) else 0
        print('   %-36s %s' % (a, ('%d filas' % n) if n else 'vacia'))
    print('   %d guias repartidas en %d semanas' % (filas, len(semanas)))

    if not subir:
        print('\nPrueba en seco. Para borrarlo de verdad: --subir')
        return 0

    sello = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    nombre = 'respaldo_%s_despacho_%s.json' % (donde.lower(), sello)
    io.open(nombre, 'w', encoding='utf-8').write(json.dumps(todo, ensure_ascii=False))

    # UN RESPALDO QUE NO SE VERIFICO NO ES UN RESPALDO.
    leido = json.load(io.open(nombre, encoding='utf-8'))
    vuelta = sum(len((leido.get(a) or {}).get('filas') or []) for a in leido if a.startswith(SEMANA))
    assert vuelta == filas, 'el respaldo tiene %d filas y habia %d: NO se borra nada' % (vuelta, filas)
    print('\nRespaldo verificado: %s  (%d guias, %d areas)' % (nombre, vuelta, len(todo)))

    print('\nBorrando...')
    for a in areas:
        guardar(a, {}, cab)
        print('   vacia  %s' % a)

    q = pedir(INDICE, cab) or {}
    print('\n%s queda en cero. El indice dice: %s' % (donde, q if q else 'vacio'))
    print('Para devolverlo: python devolver_respaldo.py %s' % nombre)
    return 0


if __name__ == '__main__':
    sys.exit(main())
