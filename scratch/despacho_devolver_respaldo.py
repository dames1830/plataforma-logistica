# -*- coding: utf-8 -*-
"""
DEVOLVER UN RESPALDO DEL DESPACHO

El compañero de `vaciar_despacho.py`. Existe porque un borrado sin vuelta atras no es
una decision, es una apuesta: el respaldo se escribe y se verifica ANTES de borrar, y
esto lo devuelve tal cual estaba.

    python devolver_respaldo.py respaldo_produccion_despacho_20260915_0730.json
    python devolver_respaldo.py <archivo> --produccion
"""
import sys
import io
import json
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'


def guardar(area, datos, cab):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    h = {'Content-Type': 'application/json'}
    h.update(cab)
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, area), data=cuerpo,
                                 headers=h, method='POST')
    with urllib.request.urlopen(pet, timeout=180) as r:
        r.read()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        return 1
    prod = '--produccion' in sys.argv
    cab = {} if prod else {'X-Environment': 'beta'}
    donde = 'PRODUCCION' if prod else 'beta'

    todo = json.load(io.open(args[0], encoding='utf-8'))
    guias = sum(len((todo.get(a) or {}).get('filas') or [])
                for a in todo if 'despacho_catalogo_sem_' in a)
    print('Devolviendo a %s: %d areas, %d guias' % (donde, len(todo), guias))
    for a in todo:
        if todo[a] is None:
            continue
        guardar(a, todo[a], cab)
        print('   ok  %s' % a)
    print('\nListo.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
