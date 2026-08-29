# -*- coding: utf-8 -*-
"""De lo que se pico, cuanto llego a estado Enviado.

OJO CON EL ORDEN: los Detalle de Orden son FOTOS de un dia. Una orden aparece en varios
archivos con estados distintos segun cuando se saco la foto. Para saber como quedo hay
que tomar la ULTIMA aparicion, no la primera.
"""
import csv, io, glob, os, re, collections
D = r"C:/Users/dames/OneDrive/danielames.bata/scraping Stock"
lim = lambda s: re.sub(r'^="|"$', '', str(s or '').strip())

ESTADO = {}          # orden -> ultimo estado visto
for p in sorted(glob.glob(os.path.join(D, 'Detalle Orden', 'Detalle Orden *.csv')),
                key=os.path.getmtime)[-14:]:
    with io.open(p, encoding='utf-8-sig', newline='') as f:
        for x in csv.DictReader(f, delimiter=';'):
            o = lim(x.get('Número de orden')); e = (x.get('Estado de orden') or '').strip()
            if o and e: ESTADO[o] = e          # pisa: gana la foto mas nueva
print('ordenes con estado conocido:', format(len(ESTADO), ',d'))

with io.open(os.path.join(D, 'Picking', 'Picking 27-8.csv'), encoding='utf-8-sig', newline='') as f:
    pick = [x for x in csv.DictReader(f, delimiter=';') if x['Estado'] == 'Finalizada']
FORMA = re.compile(r'^\d{7}-\d-\d{5}$')
caja = lambda s: (int(s[-5:-3]) if FORMA.match(s) and 0 < int(s[-5:-3]) <= 24 else 1)
def num(v):
    try: return float(str(v).replace(',', '.') or 0)
    except Exception: return 0.0

c = collections.Counter(); q = collections.Counter()
for x in pick:
    e = ESTADO.get(lim(x['Número de orden']), '(no esta en el Detalle)')
    c[e] += 1
    q[e] += num(x['Cantidad empaquetada']) * caja(x['Código de artículo'].strip())
mil = lambda n: format(int(round(n)), ',d').replace(',', '.')
tot = sum(q.values())
print('')
print('LO PICADO EL 27, por el estado en que quedo la orden:')
for k, v in q.most_common():
    print('   %-28s %6s lineas  %9s unidades  (%.1f%%)' % (k, mil(c[k]), mil(v), 100 * v / tot))
