# -*- coding: utf-8 -*-
"""Los numeros del Fill Rate desde el archivo REAL del WMS, para la maqueta.

Aplica las mismas reglas que `js/reportes/picking.js`:
  · solo `Estado = Finalizada`  -la fila Cancelado es una copia de la tarea-
  · calzado vs no calzado por `G. Gender` del Maestro
  · el prepack se reconoce por la FORMA del codigo y cuenta CAJAS, no pares
  · se excluyen los niveles D a H del selectivo -reserva-
"""
import csv, io, re, json, urllib.request, collections, datetime

MAE = 'https://logistics-backend-wv0x.onrender.com/api/logistics/articulos?date=MASTER'
import glob, os, datetime
CARPETA = r"C:/Users/dames/OneDrive/danielames.bata/scraping Stock/Picking"

c = json.loads(urllib.request.urlopen(MAE, timeout=180).read())
mae = c.get('data', c)
INFO = {}
for f in mae[1:]:
    if isinstance(f, list) and len(f) > 13:
        s = str(f[1] or '').strip()[:7]
        if s and s not in INFO:
            INFO[s] = (str(f[13] or '').strip() or 'Sin marca',
                       str(f[2] or '').strip().upper(),
                       str(f[4] or '').strip())

def diaDeArchivo(nom):
    # "Picking 27-8.csv" -> 2026-08-27. Del NOMBRE no: los archivos ordenan mal
    # -"Picking 1-8" va antes que "Picking 30-7"-, pero para armar el rango sirve.
    m = re.search(r'(\d{1,2})-(\d{1,2})', os.path.basename(nom))
    return '2026-%02d-%02d' % (int(m.group(2)), int(m.group(1))) if m else None

# EL CANAL SALE DEL DETALLE DE ORDEN, no del archivo de picking.
# El picking no dice si una orden es de tienda, de ecommerce o de catalogo: eso vive en
# la columna `Tipo de orden` del Detalle de Orden, que el robot ya baja todos los dias.
# Se cruzan por `Numero de orden`. Con 14 dias de Detalle cruza el 100% de las lineas:
# el picking de hoy trabaja ordenes creadas dias antes, asi que un solo dia no alcanza.
ORDENES = r"C:/Users/dames/OneDrive/danielames.bata/scraping Stock/Detalle Orden"
TIPO = {}
for ruta in sorted(glob.glob(os.path.join(ORDENES, 'Detalle Orden *.csv')), key=os.path.getmtime)[-14:]:
    with io.open(ruta, encoding='utf-8-sig', newline='') as f:
        for x in csv.DictReader(f, delimiter=';'):
            o = re.sub(r'^="|"$', '', str(x.get('Número de orden') or '').strip())
            tp = (x.get('Tipo de orden') or '').strip()
            if o and tp and o not in TIPO: TIPO[o] = tp

# LA RUTA SALE DEL MAESTRO DE RUTAS, que Daniel mantiene en OneDrive. El picking trae
# el codigo de la tienda en `Instalacion de destino`; ese archivo lo traduce a ruta, zona,
# turno y dia de reparto. Las 274 tiendas cubren el 89% de las lineas: el 11% restante son
# destinos que NO son tienda -ecommerce, despacho directo- y por eso no tienen ruta.
import openpyxl
RUTAS_XLSX = r"C:/Users/dames/OneDrive/danielames.bata/Proyecto web Logistico/RUTAS -  TURNOS.xlsx"
RUTA = {}
_ws = openpyxl.load_workbook(RUTAS_XLSX, read_only=True, data_only=True)['Hoja1']
for _i, _f in enumerate(_ws.iter_rows(values_only=True)):
    if _i == 0: continue
    _c = str(_f[0] or '').strip()
    if _c:
        RUTA[_c] = dict(tienda=str(_f[1] or '').strip(), zona=str(_f[2] or '').strip(),
                        turno=str(_f[5] or '').strip(), ruta=str(_f[6] or '').strip(),
                        dia=str(_f[7] or '').strip())

ARCHIVOS = sorted(glob.glob(os.path.join(CARPETA, '*.csv')), key=os.path.getmtime)[-8:]
fil = []
for ruta in ARCHIVOS:
    d = diaDeArchivo(ruta)
    with io.open(ruta, encoding='utf-8-sig', newline='') as f:
        for x in csv.DictReader(f, delimiter=';'):
            if x.get('Estado') == 'Finalizada':
                x['_dia'] = d
                fil.append(x)
DIAS = sorted(set(x['_dia'] for x in fil if x['_dia']))

FORMA = re.compile(r'^\d{7}-\d-\d{5}$')
def caja(s):
    if not FORMA.match(s): return 1
    n = int(s[-5:-3]);  return n if 0 < n <= 24 else 1
def num(v):
    try: return float(str(v).replace(',', '.') or 0)
    except Exception: return 0.0
lim = lambda s: re.sub(r'^="|"$', '', str(s or '').strip())
RESERVA = set('DEFGH')
def esReserva(u):
    u = str(u or '').strip().upper()
    if not u.startswith('SEL'): return False
    pz = u.split('-');  return len(pz) > 3 and pz[3] in RESERVA

g, fuera = {}, 0
for r in fil:
    if esReserva(r['De ubicación']): fuera += 1; continue
    sku = r['Código de artículo'].strip()
    marca, fam, cat = INFO.get(sku[:7], ('S/Maestro', '', ''))
    # Lo que no es calzado se parte en dos: la mercaderia que se vende -carteras,
    # mochilas, calcetines- y el MATERIAL -bolsas, hang tags, cajas-. Juntarlos
    # esconde que el 95% del "no calzado" es empaque, no venta.
    if fam == 'FOOTWEAR':          grupo = 'calzado'
    elif fam == 'NON FOOTWEAR':    grupo = 'nocalzado'
    else:                          grupo = 'material'
    k = (r['_dia'], lim(r['Número de orden']), sku)
    a = g.setdefault(k, {'o': 0, 'e': 0, 'p': bool(FORMA.match(sku)), 'f': caja(sku),
                         'm': marca, 'g': grupo, 'sku': sku, 'ord': lim(r['Número de orden']),
                         'd': r['Descripción de artículo'][:44], 'cat': cat, 'dia': r['_dia'],
                         'canal': TIPO.get(lim(r['Número de orden']), 'Sin tipo'),
                         'ruta': RUTA.get(lim(r['Instalación de destino'])),
                         'dest': lim(r['Instalación de destino'])})
    a['o'] = max(a['o'], num(r['Cantidad de orden original']))
    a['e'] += num(r['Cantidad empaquetada'])

def bl(v):
    return dict(l=len(v), o=sum(a['o'] for a in v), e=sum(a['e'] for a in v),
                op=sum(a['o'] * a['f'] for a in v), ep=sum(a['e'] * a['f'] for a in v),
                inc=sum(1 for a in v if a['o'] - a['e'] > 0))

def grupo(nom):
    v = [a for a in g.values() if a['g'] == nom]
    return dict(S=bl([a for a in v if not a['p']]), P=bl([a for a in v if a['p']]))

D = {k: grupo(k) for k in ('calzado', 'nocalzado', 'material')}

# El corte por marca es SOLO del calzado: una bolsa no tiene marca comercial.
por = {}
for a in g.values():
    if a['g'] != 'calzado': continue
    d = por.setdefault(a['m'], {'S': [], 'P': []})
    d['P' if a['p'] else 'S'].append(a)
marcas = sorted(((m, bl(d['S']), bl(d['P'])) for m, d in por.items()),
                key=lambda t: -(t[1]['ep'] + t[2]['ep']))

# Lo que no salio, solo calzado y ordenado por pares
falt = sorted([a for a in g.values() if a['g'] == 'calzado' and a['o'] - a['e'] > 0],
              key=lambda a: -(a['o'] - a['e']) * a['f'])[:10]
# Lo que mas pesa del material, para explicar el numero grande
mat = {}
for a in g.values():
    if a['g'] == 'material':
        mat[a['sku']] = mat.get(a['sku'], {'d': a['d'], 'q': 0, 'cat': a['cat']})
        mat[a['sku']]['q'] += a['e'] * a['f']
mat = sorted(mat.values(), key=lambda x: -x['q'])[:4]

# Por canal, solo calzado: es lo que Daniel pregunto -tienda, ecommerce, catalogo-
porCanal = {}
for a in g.values():
    if a['g'] != 'calzado': continue
    d = porCanal.setdefault(a['canal'], {'S': [], 'P': []})
    d['P' if a['p'] else 'S'].append(a)
canales = sorted(((k, bl(v['S']), bl(v['P'])) for k, v in porCanal.items()),
                 key=lambda t: -(t[1]['ep'] + t[2]['ep']))

# Por RUTA y por ZONA, solo calzado. Lo que no es tienda queda aparte: mezclarlo con las
# rutas daria una fila gigante "sin ruta" que no se puede repartir a nadie.
def cortar(clave):
    d = {}
    for a in g.values():
        if a['g'] != 'calzado': continue
        d.setdefault(clave(a), {'S': [], 'P': []})['P' if a['p'] else 'S'].append(a)
    return sorted(((k, bl(v['S']), bl(v['P'])) for k, v in d.items()),
                  key=lambda t: -(t[1]['ep'] + t[2]['ep']))
rutas = cortar(lambda a: (a['ruta'] or {}).get('ruta') or 'Sin ruta')

# POR DIA DE DESPACHO. El maestro de rutas dice que dia se reparte cada tienda, y hay
# tiendas con DOS o TRES dias -"MARTES - JUEVES" son 75 tiendas-. Por eso van dos cortes
# distintos y NO se pueden mezclar:
#   · por PATRON  -"MARTES - JUEVES" como una fila-: suma exacto el total.
#   · por DIA SUELTO: una tienda de dos dias entra en los dos, asi que la suma PASA del
#     total. Sirve para ver que peso tiene cada dia de la semana, no para cuadrar.
patrones = cortar(lambda a: (a['ruta'] or {}).get('dia') or 'Sin dia')

ORDEN_DIA = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
sueltos = {}
for a in g.values():
    if a['g'] != 'calzado': continue
    txt = (a['ruta'] or {}).get('dia') or ''
    ds = [d.strip() for d in txt.split('-') if d.strip()] or ['Sin dia']
    for d in ds:
        sueltos.setdefault(d, {'S': [], 'P': []})['P' if a['p'] else 'S'].append(a)
dias_sueltos = sorted(((k, bl(v['S']), bl(v['P'])) for k, v in sueltos.items()),
                      key=lambda t: ORDEN_DIA.index(t[0]) if t[0] in ORDEN_DIA else 99)
zonas = cortar(lambda a: (a['ruta'] or {}).get('zona') or 'Sin ruta')

# ── CUANTO ESPERA EN EL PATIO LO QUE SE PICA ──────────────────────────────────
#
# Daniel, 28-ago-2026: *"el martes tiene que picar para el jueves, pero de repente esta
# picando para el viernes y sabado. Entonces esta acumulando en el patio mucha mercaderia
# de picking que no se va a despachar en dos, tres dias"*.
#
# No hace falta pedirle nada al WMS: el archivo de picking trae el dia en que se pico y el
# maestro de rutas dice que dia se reparte cada tienda. La resta es la anticipacion.
SEM = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']

def esperaHasta(diaSemanaPick, diasReparto):
    """Dias del pick al PROXIMO reparto de esa tienda.

    Picar el mismo dia que se reparte cuenta 0: sale esa noche. Si el reparto de esta
    semana ya paso, se toma el de la que viene -de ahi el modulo 7-."""
    if not diasReparto: return None
    return min((d - diaSemanaPick) % 7 for d in diasReparto)

espera = collections.Counter()          # dias de espera -> pares
esperaLin = collections.Counter()
esperaDia = {}                          # dia que se pica -> {dias de espera: pares}
esperaZona = {}
for a in g.values():
    if a['g'] != 'calzado' or not a['ruta']: continue
    ds = [d.strip().upper() for d in (a['ruta'].get('dia') or '').split('-') if d.strip()]
    idx = [SEM.index(d) for d in ds if d in SEM]
    e = esperaHasta(datetime.date(*[int(v) for v in a['dia'].split('-')]).weekday(), idx)
    if e is None: continue
    q = a['e'] * a['f']
    espera[e] += q; esperaLin[e] += 1
    esperaDia.setdefault(a['dia'], collections.Counter())[e] += q
    z = a['ruta'].get('zona') or 'Sin zona'
    esperaZona.setdefault(z, collections.Counter())[e] += q

def _resumen(c):
    tt = sum(c.values())
    return dict(pares=tt, prom=(sum(k * v for k, v in c.items()) / tt) if tt else 0,
                d0=c[0], d1=c[1], d2=c[2], d3=c[3],
                d4=sum(v for k, v in c.items() if k >= 4))

esperaTotal = [dict(dias=k, pares=espera[k], lineas=esperaLin[k]) for k in sorted(espera)]
esperaPorDia = [dict(dia=d, sem=SEM[datetime.date(*[int(v) for v in d.split('-')]).weekday()].capitalize(),
                     **_resumen(c)) for d, c in sorted(esperaDia.items())]
esperaPorZona = [dict(zona=z, **_resumen(c)) for z, c in
                 sorted(esperaZona.items(), key=lambda kv: -sum(kv[1].values()))]

# El mismo corte, dia por dia, para ver como se mueve dentro del rango
porDia = []
for d in DIAS:
    v = [a for a in g.values() if a['dia'] == d and a['g'] == 'calzado']
    s, p = bl([a for a in v if not a['p']]), bl([a for a in v if a['p']])
    porDia.append(dict(dia=d, S=s, P=p))

json.dump(dict(desde=DIAS[0], hasta=DIAS[-1], dias=DIAS, porDia=porDia, fuera=fuera, **D,
               marcas=[dict(m=m, S=s, P=q) for m, s, q in marcas],
               canales=[dict(m=m, S=s, P=q) for m, s, q in canales],
               rutas=[dict(m=m, S=s, P=q) for m, s, q in rutas],
               patrones=[dict(m=m, S=s, P=q) for m, s, q in patrones],
               espera=esperaTotal, esperaPorDia=esperaPorDia, esperaPorZona=esperaPorZona,
               diasSueltos=[dict(m=m, S=s, P=q) for m, s, q in dias_sueltos],
               zonas=[dict(m=m, S=s, P=q) for m, s, q in zonas],
               falt=[dict(o=a['ord'], sku=a['sku'], d=a['d'], p=a['p'], m=a['m'],
                          f=a['o'] - a['e'], fp=(a['o'] - a['e']) * a['f']) for a in falt],
               mat=mat),
          io.open('scratch/_fr27.json', 'w', encoding='utf-8'), ensure_ascii=False)

mil = lambda n: format(int(round(n)), ',d').replace(',', '.')
for k in ('calzado', 'nocalzado', 'material'):
    s, p = D[k]['S'], D[k]['P']
    print('%-11s solid %6s lin %9s/%-9s   prepack %5s cajas = %8s pares' %
          (k, mil(s['l']), mil(s['e']), mil(s['o']), mil(p['e']), mil(p['ep'])))
print('rango:', DIAS[0], 'a', DIAS[-1], '·', len(DIAS), 'jornadas')
sinTipo = sum(1 for a in g.values() if a['canal'] == 'Sin tipo')
print('rutas:', len(rutas), '· zonas:', len(zonas))
print('canales:', len(canales), '· lineas sin tipo:', sinTipo, 'de', len(g))
print('fuera por reserva:', fuera, '· marcas de calzado:', len(marcas))
