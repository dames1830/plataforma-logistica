# -*- coding: utf-8 -*-
"""¿EL CUBICAJE CAMBIA CON LA TALLA?

La tabla que hay hoy (`densidadMarcaTipo`) es por MARCA + TIPO y no mira la talla, así
que un cuerpo de Bata zapato "aguanta 520" lo mismo en talla 20 que en talla 44. La
pantalla de Factores intenta primero una clave `marca|tipo|rango` que NO EXISTE en la
configuración, y recién después cae en la de marca+tipo.

Acá se mide el rango de verdad, con los 1.087 artículos que ya tienen cubicaje medido.
"""
import io, json, re, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

cfg = json.load(io.open('scratch/_config.json', encoding='utf-8'))['data']['zonas']
act = json.load(io.open('scratch/_activo.json', encoding='utf-8'))['data']
art = json.load(io.open('scratch/_art.json', encoding='utf-8'))['data']
dArt = cfg.get('densidadArticulo') or {}

def rango(t):
    try: n = float(t)
    except Exception: return None
    if n <= 0: return None
    return ('18-25' if n < 26 else '26-30' if n < 31 else '31-35' if n < 36
            else '36-39' if n < 40 else '40-44' if n < 45 else '45+')
def tipo_de(sub, cat):
    u = (str(sub or '') + ' ' + str(cat or '')).upper()
    if not u.strip(): return None
    if 'BOOT' in u or 'BOTA' in u or 'HEIGHT CUT' in u: return 'BOTA'
    if 'THONG' in u or 'SANDAL' in u or 'PLASTIC' in u: return 'SANDALIA'
    for p in ('SPORT','TENNIS','TRAINING','CANVAS','GYMNAST'):
        if p in u: return 'DEPORTIVO'
    return 'ZAPATO'
RX = re.compile(r'-([1-9])-([A-Z0-9.]+)$', re.I)
def talla_de(d):
    d = str(d or '').strip()
    m = RX.search(d)
    if m: return m.group(2).strip()
    p = d.split('-')
    if len(p) >= 3 and len(p[-2].strip()) == 1 and '1' <= p[-2].strip() <= '9': return p[-1].strip()
    return None

cab = {n: i for i, n in enumerate(art[0])}
col = lambda f, n: (str(f[cab[n]]).strip() if n in cab and cab[n] < len(f) else '')
ficha = {}
for a in art[1:]:
    s7 = col(a, 'CodArticulo').split('-')[0][:7]
    if s7 and s7 not in ficha:
        ficha[s7] = (col(a,'Marcas') or 'SIN MARCA', tipo_de(col(a,'Subcategory RIMS'), col(a,'Category RIMS')))

# El rango del articulo: el que mas pares tiene en el piso
paresPorRango = defaultdict(lambda: defaultdict(float))
for f in act:
    sku = str(f.get('Artículo') or '').strip()
    try: q = float(f.get('Cantidad actual') or 0)
    except Exception: continue
    if not sku or q <= 0: continue
    r = rango(talla_de(f.get('Descripción de artículo')))
    if r: paresPorRango[sku[:7]][r] += q

med = defaultdict(list)
for clave, cap in dArt.items():
    if '|' not in clave: continue
    s7 = clave.split('|')[1][:7]
    fi, rr = ficha.get(s7), paresPorRango.get(s7)
    if not fi or not rr or not fi[1] or not cap or cap <= 0: continue
    r = max(rr.items(), key=lambda kv: kv[1])[0]
    med[(fi[1], r)].append(cap)

RANGOS = ['18-25','26-30','31-35','36-39','40-44','45+']
print('LO QUE ENTRA EN UN CUERPO, MEDIDO, SEGÚN EL TIPO Y LA TALLA')
print('   (mediana de los artículos medidos; entre paréntesis, cuántos artículos)\n')
print('   %-11s %s' % ('TIPO', ''.join('%12s' % r for r in RANGOS)))
for tipo in ['ZAPATO','DEPORTIVO','BOTA','SANDALIA']:
    fila = ''
    for r in RANGOS:
        v = sorted(med.get((tipo, r), []))
        fila += '%12s' % ('%d (%d)' % (v[len(v)//2], len(v)) if len(v) >= 3 else '·')
    print('   %-11s %s' % (tipo, fila))

print('\nCUÁNTO CAMBIA DE PUNTA A PUNTA')
for tipo in ['ZAPATO','DEPORTIVO','BOTA','SANDALIA']:
    vs = [(r, sorted(med.get((tipo, r), []))) for r in RANGOS]
    vs = [(r, v[len(v)//2]) for r, v in vs if len(v) >= 3]
    if len(vs) < 2: continue
    a, b = min(vs, key=lambda x: x[1]), max(vs, key=lambda x: x[1])
    print('   %-11s de %d pares (%s) a %d pares (%s)  ->  %.1f veces'
          % (tipo, a[1], a[0], b[1], b[0], b[1] / a[1]))

print('\nLO QUE DICE LA TABLA QUE SE USA HOY (marca+tipo, sin talla)')
d = cfg.get('densidadMarcaTipo') or {}
for k in sorted(d, key=lambda k: -d[k])[:6]:
    print('   %-32s %s' % (k, d[k]))
