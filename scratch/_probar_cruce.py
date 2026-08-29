# -*- coding: utf-8 -*-
"""Cuanto se puede etiquetar el picking con el Tipo de orden del Detalle de Orden."""
import csv, io, glob, os, re, collections, sys
D = r"C:/Users/dames/OneDrive/danielames.bata/scraping Stock"
lim = lambda s: re.sub(r'^="|"$', '', str(s or '').strip())
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10

fs = sorted(glob.glob(os.path.join(D, 'Detalle Orden', 'Detalle Orden *.csv')),
            key=os.path.getmtime)[-N:]
TIPO = {}
for p in fs:
    with io.open(p, encoding='utf-8-sig', newline='') as f:
        for x in csv.DictReader(f, delimiter=';'):
            o = lim(x.get('Número de orden'))
            t = (x.get('Tipo de orden') or '').strip()
            if o and t and o not in TIPO:
                TIPO[o] = (t, (x.get('Contenido') or '').strip())
print('%d archivos de Detalle -> %s ordenes con tipo' % (len(fs), format(len(TIPO), ',d')))

with io.open(os.path.join(D, 'Picking', 'Picking 27-8.csv'), encoding='utf-8-sig', newline='') as f:
    pick = [x for x in csv.DictReader(f, delimiter=';') if x['Estado'] == 'Finalizada']
ords = set(lim(x['Número de orden']) for x in pick)
hit = sum(1 for o in ords if o in TIPO)
lin = sum(1 for x in pick if lim(x['Número de orden']) in TIPO)
print('cruzan: %d de %d ordenes (%.1f%%) · %d de %d lineas (%.1f%%)'
      % (hit, len(ords), 100 * hit / len(ords), lin, len(pick), 100 * lin / len(pick)))
c = collections.Counter(TIPO[lim(x['Número de orden'])][0]
                        for x in pick if lim(x['Número de orden']) in TIPO)
for k, v in c.most_common(10):
    print('   %-26s %6d lineas' % (k, v))
