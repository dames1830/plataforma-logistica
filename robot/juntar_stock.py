# -*- coding: utf-8 -*-
"""JUNTAR LAS CARPETAS DE STOCK EN UNA SOLA.

Lo pidio Daniel el 10-sep-2026: *"agarra todo lo que esta en la carpeta stock
activo copia y lo mandas todo a la carpeta de stock activo"*, y lo mismo con
reserva. Hasta hoy el historial vivia partido en cuatro carpetas.

    Stock Activo  - copia   ->   Stock Activo
    Stock Reserva - copia   ->   Stock Reserva

SE MUEVE, NO SE COPIA, y eso no es un detalle: las carpetas "copia" estan
**enteras en la nube** -140 de 140 archivos son solo-nube, 1.214 MB-. Copiar
obligaria a OneDrive a bajarlos todos; mover es un renombrado dentro del mismo
disco, no baja nada y OneDrive lo resuelve del lado del servidor.

EL REPETIDO NO SE MANDA Y NO SE BORRA. Daniel, el mismo dia: *"si hay algun
archivo repetido que estan en las carpetas de copia y las vas a mandar al stock
activo, ya no los copias, ya no los mandes"*. De los 140 de cada carpeta, 40
tienen un archivo con el MISMO NOMBRE esperandolos alla.

    ya existe alla   ->  SE OMITE. Se queda en la copia, intacto. Este script
                         no borra un solo archivo: si algun dia hay que sacar
                         los repetidos, esa es una orden aparte.
    no existe alla   ->  se mueve

NUNCA SE PISA UN ARCHIVO DEL DESTINO, que es la otra cara de lo mismo: lo que
ya esta en la carpeta buena manda, y nada de la copia lo puede reemplazar.

    python juntar_stock.py --probar    dice que haria, sin tocar nada
    python juntar_stock.py             lo hace
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_ARGV = list(sys.argv)
sys.argv = ['x', '--probar']
import armar_pendiente as A          # noqa: E402  -- por BASE y log()
sys.argv = _ARGV

BASE = A.BASE
PARES = [('Stock Activo - copia', 'Stock Activo'),
         ('Stock Reserva - copia', 'Stock Reserva')]
PROBAR = '--probar' in sys.argv


def main():
    if PROBAR:
        A.log('MODO PROBAR: no se mueve nada.')
    A.log('Los que ya existen en el destino se OMITEN: se quedan en la copia.')
    total = {'movidos': 0, 'omitidos': 0, 'fallaron': 0}

    for origen, destino in PARES:
        po = os.path.join(BASE, origen)
        pd = os.path.join(BASE, destino)
        A.log('')
        A.log('=' * 62)
        A.log('%s  ->  %s' % (origen, destino))
        A.log('=' * 62)
        if not os.path.isdir(po):
            A.log('No existe la carpeta origen: %s' % po, 'AVISO')
            continue
        if not os.path.isdir(pd):
            A.log('No existe la carpeta destino: %s' % pd, 'ERROR')
            continue

        archivos = sorted(n for n in os.listdir(po)
                          if os.path.isfile(os.path.join(po, n)))
        A.log('%d archivos en la copia' % len(archivos))
        movidos = omitidos = fallaron = 0
        distinto_peso = []

        for n in archivos:
            ro = os.path.join(po, n)
            rd = os.path.join(pd, n)
            try:
                if os.path.exists(rd):
                    omitidos += 1
                    # Mismo nombre pero distinto tamano: no es el mismo archivo.
                    # Igual se omite -esa es la orden-, pero se avisa: alguien
                    # tiene que decidir cual de los dos vale.
                    if os.path.getsize(ro) != os.path.getsize(rd):
                        distinto_peso.append(n)
                    continue
                if not PROBAR:
                    os.rename(ro, rd)
                movidos += 1
            except Exception as e:
                A.log('   no se pudo con %s (%s: %s)'
                      % (n, type(e).__name__, str(e)[:90]), 'ERROR')
                fallaron += 1

        A.log('')
        A.log('   movidos ................... %s' % format(movidos, ',d'))
        A.log('   omitidos, ya estaban alla . %s  (quedan en la copia)'
              % format(omitidos, ',d'))
        if fallaron:
            A.log('   FALLARON .................. %s' % format(fallaron, ',d'), 'ERROR')
        for k, v in (('movidos', movidos), ('omitidos', omitidos),
                     ('fallaron', fallaron)):
            total[k] += v

        for n in distinto_peso:
            A.log('   OJO: "%s" se llama igual pero NO pesa lo mismo que el del '
                  'destino. No se toco.' % n, 'AVISO')

        quedan_c = len([n for n in os.listdir(po)
                        if os.path.isfile(os.path.join(po, n))])
        quedan_d = len([n for n in os.listdir(pd)
                        if os.path.isfile(os.path.join(pd, n))])
        A.log('   "%s" queda con %s archivos' % (destino, format(quedan_d, ',d')))
        A.log('   "%s" queda con %s' % (origen, format(quedan_c, ',d')))

    A.log('')
    A.log('TOTAL: %s movidos - %s omitidos - %s fallaron'
          % (format(total['movidos'], ',d'), format(total['omitidos'], ',d'),
             format(total['fallaron'], ',d')))
    A.log('No se borro ningun archivo.')
    return 1 if total['fallaron'] else 0


if __name__ == '__main__':
    sys.exit(main())
