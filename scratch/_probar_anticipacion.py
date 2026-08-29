# -*- coding: utf-8 -*-
"""CUANTOS DIAS SE QUEDA EN EL PATIO LO QUE SE PICA.

Daniel, 28-ago-2026: *"el martes tiene que picar para el jueves, pero de repente esta
picando para el viernes y sabado. Entonces esta acumulando en el patio mucha mercaderia
de picking que no se va a despachar en dos, tres dias"*.

No hace falta pedirle nada al WMS: el archivo de picking trae el DIA en que se pico, y el
maestro de rutas dice que dia se reparte cada tienda. La resta es la anticipacion.
"""
import openpyxl, csv, io, glob, os, re, collections, datetime, json, urllib.request

D = r"C:/Users/dames/OneDrive/danielames.bata/scraping Stock"
lim = lambda s: re.sub(r'^="|"$', '', str(s or '').strip())
SEM = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']

ws = openpyxl.load_workbook(
    r"C:/Users/dames/OneDrive/danielames.bata/Proyecto web Logistico/RUTAS -  TURNOS.xlsx",
    read_only=True, data_only=True)['Hoja1']
RUTA = {}
for i, f in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    c = str(f[0] or '').strip()
    if not c: continue
    dias = [d.strip().upper() for d in str(f[7] or '').split('-') if d.strip()]
    RUTA[c] = {'ruta': str(f[6] or '').strip(), 'zona': str(f[2] or '').strip(),
               'dias': [SEM.index(d) for d in dias if d in SEM]}

# Solo calzado, igual que el resto del reporte: una bolsa que espera en el patio no es
# el problema del que habla Daniel.
_c = json.loads(urllib.request.urlopen(
    'https://logistics-backend-wv0x.onrender.com/api/logistics/articulos?date=MASTER', timeout=180).read())
FAM = {}
for _f in _c.get('data', _c)[1:]:
    if isinstance(_f, list) and len(_f) > 2:
        _s = str(_f[1] or '').strip()[:7]
        if _s and _s not in FAM: FAM[_s] = str(_f[2] or '').strip().upper()

FORMA = re.compile(r'^\d{7}-\d-\d{5}$')
caja = lambda s: (int(s[-5:-3]) if FORMA.match(s) and 0 < int(s[-5:-3]) <= 24 else 1)
def num(v):
    try: return float(str(v).replace(',', '.') or 0)
    except Exception: return 0.0

def esperaHasta(diaSemanaPick, diasReparto):
    """Cuantos dias faltan del pick al PROXIMO reparto de esa tienda.

    Si se pica el mismo dia que se reparte, cuenta 0: sale esa noche. Si el proximo
    reparto ya paso esta semana, se va al de la semana que viene -de ahi el +7-."""
    if not diasReparto: return None
    return min((d - diaSemanaPick) % 7 for d in diasReparto)

filas = []
for ruta in sorted(glob.glob(os.path.join(D, 'Picking', '*.csv')), key=os.path.getmtime)[-8:]:
    m = re.search(r'(\d{1,2})-(\d{1,2})', os.path.basename(ruta))
    if not m: continue
    fecha = datetime.date(2026, int(m.group(2)), int(m.group(1)))
    with io.open(ruta, encoding='utf-8-sig', newline='') as f:
        for x in csv.DictReader(f, delimiter=';'):
            if x.get('Estado') != 'Finalizada': continue
            sku = x['Código de artículo'].strip()
            if FAM.get(sku[:7]) != 'FOOTWEAR': continue
            r = RUTA.get(lim(x['Instalación de destino']))
            if not r: continue
            e = esperaHasta(fecha.weekday(), r['dias'])
            if e is None: continue
            filas.append((e, num(x['Cantidad empaquetada']) * caja(sku), fecha, r['zona']))

mil = lambda n: format(int(round(n)), ',d').replace(',', '.')
tot = sum(q for _, q, _, _ in filas)
print('lineas con dia de reparto conocido:', mil(len(filas)), '·', mil(tot), 'pares')
print('')
print('CUANTO ESPERA EN EL PATIO LO QUE SE PICA:')
c = collections.Counter(); qq = collections.Counter()
for e, q, _, _ in filas: c[e] += 1; qq[e] += q
for e in sorted(qq):
    et = 'sale esa misma noche' if e == 0 else ('%d día%s esperando' % (e, '' if e == 1 else 's'))
    print('   %-24s %8s pares  (%4.1f%%)  %7s líneas' % (et, mil(qq[e]), 100*qq[e]/tot, mil(c[e])))
print('')
print('QUE DIA SE PICA PARA CUANDO  (pares, solo calzado):')
porDia = collections.defaultdict(collections.Counter)
for e, q, f, _ in filas: porDia[f.weekday()][e] += q
print('   %-11s %9s %9s %9s %9s %9s   %s' % ('SE PICA EL','misma','+1 dia','+2 dias','+3 dias','+4 o mas','espera prom.'))
for d in sorted(porDia):
    c2 = porDia[d]; t2 = sum(c2.values())
    if not t2: continue
    prom = sum(k*v for k, v in c2.items()) / t2
    cuatro = sum(v for k, v in c2.items() if k >= 4)
    print('   %-11s %9s %9s %9s %9s %9s   %.1f dias'
          % (SEM[d].capitalize(), mil(c2[0]), mil(c2[1]), mil(c2[2]), mil(c2[3]), mil(cuatro), prom))
print('')
print('POR ZONA:')
for z in ('LIMA', 'PROVINCIA'):
    sub = [(e, q) for e, q, _, zz in filas if zz == z]
    t = sum(q for _, q in sub)
    if not t: continue
    prom = sum(e*q for e, q in sub) / t
    tarde = sum(q for e, q in sub if e >= 3)
    print('   %-12s %9s pares · espera promedio %.1f días · %s pares (%.0f%%) esperan 3 o más'
          % (z, mil(t), prom, mil(tarde), 100*tarde/t))
