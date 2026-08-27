# -*- coding: utf-8 -*-
"""¿QUÉ NÚMERO AGUANTA CADA TOPE DEL REPLENISHMENT?

Repite, tal cual, la cuenta que ya hace la pantalla de Factores (`topeDeFactor`):
el cuerpo guarda el artículo ENTERO, así que lo que entra se reparte entre las tallas
de su rango. Contra el cubicaje MEDIDO y el stock de verdad, bajados del servidor.
"""
import io, json, re, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

cfg = json.load(io.open('scratch/_config.json', encoding='utf-8'))['data']
act = json.load(io.open('scratch/_activo.json', encoding='utf-8'))['data']
art = json.load(io.open('scratch/_art.json', encoding='utf-8'))['data']
TOPES = cfg['factoresRepl']['marcaGeneroTalla']
dMT   = cfg['zonas'].get('densidadMarcaTipo') or {}

TALLAS_POR_RANGO = {'18-25': 8, '26-30': 5, '31-35': 5, '36-39': 4, '40-44': 5, '45+': 3}
def rango_de_talla(t):
    try: n = float(t)
    except Exception: return None
    if n <= 0: return None
    return ('18-25' if n < 26 else '26-30' if n < 31 else '31-35' if n < 36
            else '36-39' if n < 40 else '40-44' if n < 45 else '45+')

def tipo_de_calzado(sub, cat):
    u = (str(sub or '') + ' ' + str(cat or '')).upper()
    if not u.strip(): return None
    if 'BOOT' in u or 'BOTA' in u or 'HEIGHT CUT' in u: return 'BOTA'
    if 'THONG' in u or 'SANDAL' in u or 'PLASTIC' in u: return 'SANDALIA'
    for p in ('SPORT', 'TENNIS', 'TRAINING', 'CANVAS', 'GYMNAST'):
        if p in u: return 'DEPORTIVO'
    return 'ZAPATO'

RX = re.compile(r'-([1-9])-([A-Z0-9.]+)$', re.I)
def extract_talla(desc):
    d = str(desc or '').strip()
    if not d: return None
    m = RX.search(d)
    if m: return m.group(2).strip()
    p = d.split('-')
    if len(p) >= 3 and len(p[-2].strip()) == 1 and '1' <= p[-2].strip() <= '9':
        return p[-1].strip()
    return None

# ── La ficha del artículo ───────────────────────────────────────────────────
cab = {n: i for i, n in enumerate(art[0])}
def col(f, n):
    i = cab.get(n)
    return str(f[i]).strip() if i is not None and i < len(f) else ''
ficha = {}
for a in art[1:]:
    s7 = col(a, 'CodArticulo').split('-')[0][:7]
    g = col(a, 'Gender RIMS')
    if s7 and s7 not in ficha and g and g != '-':
        ficha[s7] = (g, col(a, 'Marcas') or 'SIN MARCA',
                     col(a, 'Subcategory RIMS').upper(), col(a, 'Category RIMS').upper())

# ── Los grupos marca+género+talla, igual que la pantalla ────────────────────
AREAS = ['MZN01','MZN02','MZN03','MZN04','SEL','AND','PARED','BUFFERCD','CDBUFFER']
grupos = defaultdict(lambda: {'skus': set(), 'piso': 0.0, 'tipos': defaultdict(float), 'marca': ''})
for f in act:
    area = re.sub(r'[^A-Z0-9]', '', str(f.get('Área') or '').upper())
    if not any(a in area for a in AREAS): continue
    sku = str(f.get('Artículo') or '').strip()
    try: q = float(f.get('Cantidad actual') or 0)
    except Exception: continue
    if not sku or q <= 0: continue
    fi = ficha.get(sku[:7])
    t = extract_talla(f.get('Descripción de artículo'))
    if not fi or not t: continue
    g = grupos[(fi[1].upper(), fi[0].upper(), t)]
    g['skus'].add(sku); g['piso'] += q; g['marca'] = fi[1]
    tp = tipo_de_calzado(fi[2], fi[3])
    if tp: g['tipos'][tp] += q

# ── El tope que aguanta cada grupo ──────────────────────────────────────────
def tope_de(marca, talla, tipos):
    r = rango_de_talla(talla)
    if not r or not tipos: return None
    tipo = max(tipos.items(), key=lambda kv: kv[1])[0]
    cap = dMT.get('%s|%s|%s' % (marca, tipo, r)) or dMT.get('%s|%s' % (tipo, r)) or dMT.get('%s|%s' % (marca, tipo))
    if not cap or cap <= 0: return None
    n = TALLAS_POR_RANGO.get(r, 4)
    return {'cap': cap, 'tipo': tipo, 'rango': r, 'tallas': n, 'tope': int(cap // n)}

print('LOS TOPES QUE HAY CARGADOS HOY')
print('   combinaciones marca+género+talla : %s' % format(len(TOPES), ','))
print('   todas en 60                      : %s' % ('sí' if set(TOPES.values()) == {60} else 'no — %s' % sorted(set(TOPES.values()))))
print('   medidas de cubicaje disponibles  : %s' % format(len(dMT), ','))

pasados, dentro, sinMedida, exceso = [], 0, 0, 0
for clave, val in TOPES.items():
    marca, genero, talla = clave.split('|')
    g = grupos.get((marca, genero, talla))
    lim = tope_de(g['marca'], talla, g['tipos']) if g else None
    if not lim: sinMedida += 1; continue
    if val > lim['tope']:
        pasados.append((marca, genero, talla, val, lim))
        exceso += (val - lim['tope']) * (len(g['skus']) if g else 0)
    else: dentro += 1

print('\nCONTRA EL CUBICAJE MEDIDO')
print('   se pasan del cuerpo   : %s' % format(len(pasados), ','))
print('   entran                : %s' % format(dentro, ','))
print('   sin medida (no se puede decir) : %s' % format(sinMedida, ','))
if pasados:
    tops = sorted(pasados, key=lambda p: p[4]['tope'])[:12]
    print('\n   LOS DOCE MÁS APRETADOS')
    print('   %-18s %-11s %-6s %5s %6s   %s' % ('MARCA', 'GÉNERO', 'TALLA', 'HOY', 'ENTRA', 'PORQUÉ'))
    for m, g, t, v, l in tops:
        print('   %-18s %-11s %-6s %5d %6d   cuerpo %d ÷ %d tallas del rango %s (%s)'
              % (m[:18], g[:11], t, v, l['tope'], l['cap'], l['tallas'], l['rango'], l['tipo'].lower()))
    ts = sorted(p[4]['tope'] for p in pasados)
    print('\n   de los que se pasan, el que más aguanta son %d pares y el que menos, %d.'
          % (ts[-1], ts[0]))
