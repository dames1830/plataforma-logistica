# -*- coding: utf-8 -*-
"""
ENCENDER LOS DOS MODULOS DEL DESPACHO EN LA MATRIZ DE PERMISOS

Una sub-pestana nueva no tiene fila en la matriz, y sin fila `valor === undefined`:
solo pasa admin. Por eso Daniel era el unico que veia los dos modulos.

Se copia EL MISMO REPARTO que ya tiene la sub-pestana hermana -Tracking, en el mismo
modulo NO RETAIL-, en vez de inventar uno: quien ya podia mirar el tracking de no retail
es exactamente quien tiene que poder mirar el despacho. Si hay que darle acceso a
transporte o a los choferes, se decide aparte y a proposito.

    python encender_permisos.py                 # muestra que haria
    python encender_permisos.py --subir         # beta
    python encender_permisos.py --subir --produccion
"""
import sys
import json
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'
AREA = 'permissions'
MODELO = 'no_retail_tracking_no_retail'      # de quien se copia el reparto
NUEVOS = ['no_retail_catalogo_despacho', 'despacho_tracking_retail']


def pedir(cab):
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, AREA), headers=cab)
    with urllib.request.urlopen(pet, timeout=120) as r:
        c = json.loads(r.read().decode('utf-8'))
    return c.get('data', c) if isinstance(c, dict) else c


def guardar(datos, cab):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    h = {'Content-Type': 'application/json'}
    h.update(cab)
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, AREA), data=cuerpo,
                                 headers=h, method='POST')
    with urllib.request.urlopen(pet, timeout=120) as r:
        r.read()


def main():
    prod = '--produccion' in sys.argv
    cab = {} if prod else {'X-Environment': 'beta'}
    donde = 'PRODUCCION' if prod else 'beta'
    subir = '--subir' in sys.argv

    p = pedir(cab)
    print('%s   %d roles' % (donde, len(p)))
    cambios = 0
    for rol in p:
        base = p[rol].get(MODELO)
        if base is None:
            print('   %-14s el modelo no tiene fila: se deja en cero' % rol)
            base = 0
        for k in NUEVOS:
            antes = p[rol].get(k, '(sin fila)')
            if antes != base:
                cambios += 1
            p[rol][k] = base
        print('   %-14s %s -> %s' % (rol, MODELO + '=' + str(base),
                                     ', '.join('%s=%s' % (k.split('_', 1)[1], base) for k in NUEVOS)))

    print('\n   filas que cambian: %d' % cambios)
    if not subir:
        print('\nPrueba en seco. Para hacerlo: --subir')
        return 0
    guardar(p, cab)
    print('\nGuardado en %s.' % donde)

    # Se vuelve a leer, porque guardar no es lo mismo que quedar guardado.
    v = pedir(cab)
    malos = [rol for rol in v if any(v[rol].get(k) != v[rol].get(MODELO, 0) for k in NUEVOS)]
    print('comprobado: %s' % ('todos los roles quedaron igual que %s' % MODELO if not malos
                              else 'NO cuadran: %s' % malos))
    return 0


if __name__ == '__main__':
    sys.exit(main())
