# -*- coding: utf-8 -*-
"""¿UN TOPE DE 60 PARA TODO CABE EN EL PISO?

Cruza tres cosas que hoy no se hablan entre ellas:
  · los TOPES de reposicion — cuantos pares tiene que haber de cada SKU abajo
  · el CUBICAJE medido      — cuantos pares entran en un cuerpo, y eso cambia con la talla
  · el ESPACIO del piso     — cuantos cuerpos hay y cuanto les queda libre

Contra el stock y la configuracion de verdad, bajados del servidor.
"""
import io, json, sys, re
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TOPE = 60
ZONAS = ['SEL', 'MZN01', 'MZN02', 'MZN03']   # MZN04 es no-calzado y no entra a reposicion

cfg = json.load(io.open('scratch/_config.json', encoding='utf-8'))['data']['zonas']
act = json.load(io.open('scratch/_activo.json', encoding='utf-8'))['data']
art = json.load(io.open('scratch/_art.json', encoding='utf-8'))['data']

cab = {n: i for i, n in enumerate(art[0])}
def col(f, n):
    i = cab.get(n)
    return str(f[i]).strip() if i is not None and i < len(f) else ''
M = {}
for a in art[1:]:
    s7 = col(a, 'CodArticulo').split('-')[0][:7]
    if s7 and s7 not in M:
        M[s7] = {'gender': col(a, 'Gender RIMS'), 'marca': col(a, 'Marcas'),
                 'cat': col(a, 'Category RIMS'), 'sub': col(a, 'Subcategory RIMS')}

def talla_de(s):
    p = str(s).split('-')
    return p[2] if len(p) >= 3 and len(p[2]) <= 2 else None
def es_prepack(s):
    return bool(re.match(r'^\d{7}-\d-\d{5}$', str(s)))

# ── EL CUBICAJE, la misma escalera que usa la plataforma ────────────────────
def tipo_de(sub, cat):
    t = (str(sub) + ' ' + str(cat)).upper()
    if 'HEIGHT CUT' in t or 'BOOT' in t: return 'BOTA'
    if 'SANDAL' in t or 'FLIP' in t or 'CHANCLE' in t: return 'SANDALIA'
    if 'SPORT' in t or 'SNEAKER' in t or 'RUNNING' in t: return 'DEPORTIVO'
    return 'ZAPATO'

dArt = cfg.get('densidadArticulo') or {}
dMT  = cfg.get('densidadMarcaTipo') or {}
dTipo = cfg.get('densidadTipo') or {}
dZona = cfg.get('densidad') or {}
dResp = cfg.get('densidadRespaldo') or {}

def capacidad(zona, s7, marca, tipo):
    v = dArt.get('%s|%s' % (zona, s7))                     # 1. el articulo medido
    if v: return v, 'articulo'
    v = dMT.get('%s|%s' % (marca, tipo))                   # 2. marca + tipo
    if v: return v, 'marca+tipo'
    v = dTipo.get(tipo)                                    # 3. el tipo
    if v: return v, 'tipo'
    serie = (s7 or '0')[0]
    v = (dZona.get(zona) or {}).get(serie)                 # 4. la serie
    if v: return v, 'serie'
    return dResp.get(zona, 300), 'respaldo'

# ── El piso ────────────────────────────────────────────────────────────────
porCombo = defaultdict(lambda: {'skus': set(), 'pares': 0})
cuerpos = defaultdict(lambda: {'pares': 0, 'porSku': defaultdict(float), 'zona': ''})

for f in act:
    zona = str(f.get('Área') or '')
    if zona not in ZONAS: continue
    sku = str(f.get('Artículo') or '')
    if es_prepack(sku): continue
    q = float(f.get('Cantidad actual') or 0)
    if q <= 0: continue
    s7 = sku.split('-')[0][:7]
    t = talla_de(sku)
    g = (M.get(s7) or {}).get('gender') or '(sin gender)'
    ubi = str(f.get('Ubicación') or '')
    c = '-'.join(ubi.split('-')[:3])
    if t:
        porCombo[(g, t)]['skus'].add(s7); porCombo[(g, t)]['pares'] += q
    cuerpos[c]['pares'] += q; cuerpos[c]['porSku'][s7] += q; cuerpos[c]['zona'] = zona

# ── Cuanto le queda libre a cada cuerpo ────────────────────────────────────
libre_total = 0; cap_total = 0; lleno = 0; fuentes = defaultdict(int)
for c, v in cuerpos.items():
    s7 = max(v['porSku'], key=v['porSku'].get)             # el que mas pesa adentro
    m = M.get(s7) or {}
    cap, fuente = capacidad(v['zona'], s7, m.get('marca', ''), tipo_de(m.get('sub',''), m.get('cat','')))
    fuentes[fuente] += 1
    cap_total += cap
    libre = cap - v['pares']
    if libre > 0: libre_total += libre
    else: lleno += 1

hay = sum(v['pares'] for v in porCombo.values())
pide = sum(len(v['skus']) * TOPE for v in porCombo.values())

print('EL PISO DE ALMACENAJE (SEL + los tres mezzanines de calzado)')
print('   %s pares en %s cuerpos ocupados' % (format(int(hay), ','), format(len(cuerpos), ',')))
print('   capacidad medida de esos cuerpos : %s pares' % format(int(cap_total), ','))
print('   les queda libre                  : %s pares' % format(int(libre_total), ','))
print('   cuerpos ya llenos o pasados      : %s de %s' % (format(lleno, ','), format(len(cuerpos), ',')))
print('   de donde sale la capacidad       : ' + ' · '.join('%s %d' % (k, n) for k, n in sorted(fuentes.items(), key=lambda x: -x[1])))

print('\nUN TOPE DE %d PARA TODAS LAS COMBINACIONES' % TOPE)
print('   combinaciones genero+talla : %d' % len(porCombo))
print('   SKUs en el piso            : %s' % format(len(set(s for v in porCombo.values() for s in v['skus'])), ','))
print('   pares que HAY hoy          : %s' % format(int(hay), ','))
print('   pares que PEDIRIA          : %s' % format(int(pide), ','))
print('   habria que BAJAR           : %s' % format(int(pide - hay), ','))
print('   y en el piso solo entran   : %s  ->  %s' % (
      format(int(libre_total), ','),
      'ENTRA' if pide - hay <= libre_total else 'NO ENTRA: faltan %s pares de sitio' % format(int(pide - hay - libre_total), ',')))

# ── Cuanto se puede pedir de verdad ────────────────────────────────────────
# EL TOPE ES POR SKU **Y TALLA**: un artículo de seis tallas necesita seis topes abajo.
# Contarlo por SKU distinto da seis veces menos y hace parecer que 60 sobra de largo.
combos_sku = sum(len(v['skus']) for v in porCombo.values())
skus = len(set(s for v in porCombo.values() for s in v['skus']))
capMedia = cap_total / len(cuerpos)
print('\n   %s SKUs distintos, que con sus tallas son %s combinaciones SKU+talla.'
      % (format(skus, ','), format(combos_sku, ',')))
print('   Con el sitio que hay, el tope PAREJO que entraría es de %d pares.'
      % int((hay + libre_total) / combos_sku))
print('   Con 60 harían falta unos %s cuerpos más de los que hay (a %d pares cada uno).'
      % (format(int((pide - hay - libre_total) / capMedia), ','), int(capMedia)))

# ── Y LOS CUERPOS VACÍOS, QUE NO APARECEN EN EL STOCK ──────────────────────
# El stock solo trae lo que TIENE algo. Los vacíos hay que contarlos del layout.
# Números ya con las columnas bloqueadas y el paso del elevador descontados. Es una
# estimación: sirve para saber si la conclusión aguanta, no como dato fino.
CUERPOS = {'SEL': 284, 'MZN01': 408, 'MZN02': 271, 'MZN03': 480}
totalCuerpos = sum(CUERPOS.values())
vacios = max(0, totalCuerpos - len(cuerpos))
libreConVacios = libre_total + vacios * capMedia
print('\n   Y ADEMÁS LOS CUERPOS VACÍOS, que no salen en el stock:')
print('   el almacén tiene unos %s cuerpos y hay %s ocupados  ->  ~%s vacíos'
      % (format(totalCuerpos, ','), format(len(cuerpos), ','), format(vacios, ',')))
print('   contándolos, el sitio libre sube a ~%s pares' % format(int(libreConVacios), ','))
print('   con el tope en 60 harían falta %s  ->  %s' % (
      format(int(pide - hay), ','),
      'entra' if pide - hay <= libreConVacios else
      'SIGUE SIN ENTRAR: faltan ~%s pares' % format(int(pide - hay - libreConVacios), ',')))
print('   el tope parejo que sí entra, contando los vacíos: %d pares'
      % int((hay + libreConVacios) / combos_sku))

print('\nLAS DIEZ COMBINACIONES QUE MAS PESAN')
print('   %-20s %6s %10s %11s %11s' % ('GENERO · TALLA', 'SKUS', 'HAY HOY', 'PEDIRIA', 'A BAJAR'))
for (g, t), v in sorted(porCombo.items(), key=lambda kv: -len(kv[1]['skus']))[:10]:
    p = len(v['skus']) * TOPE
    print('   %-20s %6d %10s %11s %11s' % ((g + ' · ' + t)[:20], len(v['skus']),
          format(int(v['pares']), ','), format(p, ','), format(int(p - v['pares']), ',')))
