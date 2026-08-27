# -*- coding: utf-8 -*-
"""LOS DATOS DE VERDAD PARA LA MAQUETA DEL MÓDULO CAPACIDAD.

Junta en un solo archivo lo que hoy vive en seis pantallas distintas, medido contra el
stock y la configuración bajados del servidor. La maqueta solo dibuja; los números salen
de acá, para que lo que Daniel vea sea lo que hay.
"""
import io, json, re, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

C   = json.load(io.open('scratch/_config.json', encoding='utf-8'))['data']
act = json.load(io.open('scratch/_activo.json', encoding='utf-8'))['data']
art = json.load(io.open('scratch/_art.json', encoding='utf-8'))['data']
Z, T = C['zonas'], C['tallas']
dArt  = Z.get('densidadArticulo') or {}
dMT   = Z.get('densidadMarcaTipo') or {}
dTipo = Z.get('densidadTipo') or {}
TOPES = C['factoresRepl']['marcaGeneroTalla']

RANGOS = ['18-25', '26-30', '31-35', '36-39', '40-44', '45+']
TALLAS_POR_RANGO = {'18-25': 8, '26-30': 5, '31-35': 5, '36-39': 4, '40-44': 5, '45+': 3}
ZONAS_PISO = ['SEL', 'MZN01', 'MZN02', 'MZN03']
CUERPOS_ZONA = {'SEL': 284, 'MZN01': 408, 'MZN02': 271, 'MZN03': 480}


def rango(t):
    try:
        n = float(t)
    except Exception:
        return None
    if n <= 0:
        return None
    return ('18-25' if n < 26 else '26-30' if n < 31 else '31-35' if n < 36
            else '36-39' if n < 40 else '40-44' if n < 45 else '45+')


def tipo_de(sub, cat):
    u = (str(sub or '') + ' ' + str(cat or '')).upper()
    if not u.strip():
        return None
    if 'BOOT' in u or 'BOTA' in u or 'HEIGHT CUT' in u:
        return 'BOTA'
    if 'THONG' in u or 'SANDAL' in u or 'PLASTIC' in u:
        return 'SANDALIA'
    for p in ('SPORT', 'TENNIS', 'TRAINING', 'CANVAS', 'GYMNAST'):
        if p in u:
            return 'DEPORTIVO'
    return 'ZAPATO'


RX = re.compile(r'-([1-9])-([A-Z0-9.]+)$', re.I)
NUM = re.compile(r'^\d+\.?\d*$')


def talla_de(d):
    d = str(d or '').strip()
    m = RX.search(d)
    if m:
        return m.group(2).strip()
    p = d.split('-')
    if len(p) >= 3 and len(p[-2].strip()) == 1 and '1' <= p[-2].strip() <= '9':
        return p[-1].strip()
    return None


def es_prepack(s):
    return bool(re.match(r'^\d{7}-\d-\d{5}$', str(s)))


cab = {n: i for i, n in enumerate(art[0])}


def col(f, n):
    i = cab.get(n)
    return str(f[i]).strip() if i is not None and i < len(f) else ''


ficha = {}
for a in art[1:]:
    s7 = col(a, 'CodArticulo').split('-')[0][:7]
    g = col(a, 'Gender RIMS')
    if s7 and s7 not in ficha and g and g != '-':
        ficha[s7] = {'gen': g, 'marca': col(a, 'Marcas') or 'SIN MARCA',
                     'tipo': tipo_de(col(a, 'Subcategory RIMS'), col(a, 'Category RIMS'))}

# ── El piso: pares, cuerpos y el rango de cada artículo ─────────────────────
grupos = defaultdict(lambda: {'skus': set(), 'piso': 0.0, 'tipos': defaultdict(float), 'marca': ''})
cuerpos = defaultdict(lambda: {'pares': 0.0, 'porSku': defaultdict(float), 'zona': ''})
rangoArt = defaultdict(lambda: defaultdict(float))

for f in act:
    zona = str(f.get('Área') or '').strip().upper()
    sku = str(f.get('Artículo') or '').strip()
    try:
        q = float(f.get('Cantidad actual') or 0)
    except Exception:
        continue
    if not sku or q <= 0 or es_prepack(sku):
        continue
    s7 = sku[:7]
    fi = ficha.get(s7)
    t = talla_de(f.get('Descripción de artículo'))
    r = rango(t) if t else None
    if r:
        rangoArt[s7][r] += q
    if zona not in ZONAS_PISO or not fi or not t:
        continue
    c = '-'.join(str(f.get('Ubicación') or '').split('-')[:3])
    cuerpos[c]['pares'] += q
    cuerpos[c]['porSku'][s7] += q
    cuerpos[c]['zona'] = zona
    g = grupos[(fi['marca'].upper(), fi['gen'].upper(), t)]
    g['skus'].add(sku)
    g['piso'] += q
    g['marca'] = fi['marca']
    if fi['tipo']:
        g['tipos'][fi['tipo']] += q

# ── 1. CUÁNTO ENTRA: el cubicaje medido por tipo y rango ────────────────────
med = defaultdict(list)
for clave, cap in dArt.items():
    if '|' not in clave or not cap or cap <= 0:
        continue
    s7 = clave.split('|')[1][:7]
    fi = ficha.get(s7)
    rr = rangoArt.get(s7)
    if not fi or not fi['tipo'] or not rr:
        continue
    med[(fi['tipo'], max(rr.items(), key=lambda kv: kv[1])[0])].append(cap)

TIPOS = ['ZAPATO', 'DEPORTIVO', 'BOTA', 'SANDALIA']
medido = {}
for tipo in TIPOS:
    for r in RANGOS:
        v = sorted(med.get((tipo, r), []))
        if len(v) >= 3:
            medido[(tipo, r)] = {'cap': v[len(v) // 2], 'n': len(v)}

# ── LO QUE NO ESTÁ MEDIDO NO SE HEREDA DE UNA TABLA PLANA ───────────────────
# Daniel, 27-ago-2026, mirando la columna 45+: *"le estás poniendo por defecto 500 a
# zapatos, y eso está mal"*. Tenía razón, y no era un casillero suelto: la tabla de
# respaldo (`densidadTipo`) da UN número por tipo sin mirar la talla —500 para todo
# zapato—, así que los cinco casilleros sin medir salían con el número del zapato más
# chico. Un 45 no puede entrar más que un 42.
#
# Se estima bajando desde el vecino medido, con el encogimiento que muestran los propios
# datos: de un rango al siguiente entra menos. Queda marcado como ESTIMADO —no como
# medido ni como heredado— para que se vea que a ese casillero le falta cubicar.
razones = []
for tipo in TIPOS:
    for a, b in zip(RANGOS, RANGOS[1:]):
        if (tipo, a) in medido and (tipo, b) in medido:
            razones.append(medido[(tipo, b)]['cap'] / medido[(tipo, a)]['cap'])
razones.sort()
ENCOGE = razones[len(razones) // 2] if razones else 0.8

cubicaje = []
for tipo in TIPOS:
    fila = {'tipo': tipo, 'rangos': {}}
    for j, r in enumerate(RANGOS):
        if (tipo, r) in medido:
            m = medido[(tipo, r)]
            fila['rangos'][r] = {'cap': m['cap'], 'n': m['n'], 'fuente': 'medido'}
            continue
        # Se busca el rango medido más cercano y se encoge (o se agranda) hasta acá.
        cerca = [(abs(j - RANGOS.index(rr)), RANGOS.index(rr))
                 for (tt, rr) in medido if tt == tipo]
        if cerca:
            _, k = min(cerca)
            cap = medido[(tipo, RANGOS[k])]['cap'] * (ENCOGE ** (j - k))
            fila['rangos'][r] = {'cap': int(round(cap)), 'n': 0, 'fuente': 'estimado',
                                 'desde': RANGOS[k]}
        else:
            fila['rangos'][r] = {'cap': None, 'n': 0, 'fuente': 'sin'}
    cubicaje.append(fila)
capMedida = {(f['tipo'], r): f['rangos'][r]['cap']
             for f in cubicaje for r in RANGOS if f['rangos'][r]['cap']}


def cap_de(marca, tipo, r):
    """La misma escalera que usa el almacenaje: de lo más fino a lo más grueso."""
    return (dMT.get('%s|%s|%s' % (marca, tipo, r)) or dMT.get('%s|%s' % (tipo, r))
            or capMedida.get((tipo, r)) or dMT.get('%s|%s' % (marca, tipo)) or dTipo.get(tipo))


# ── 5. HASTA CUÁNTO: el tope que propone el cubicaje, contra el cargado ─────
#
# NO TODAS LAS FILAS SE REPARTEN. Daniel, 27-ago-2026. Se preguntan EN ESTE ORDEN:
#
#   TODO       -> Adidas, Puma, Skechers y Marie Claire: *"todo lo que llega se almacena,
#                 nada queda para reserva; así sea mil o dos mil"*. No tienen tope: lo que
#                 hay abajo no es una decisión, es lo que llegó. Y le gana al escolar:
#                 *"no importa si es escolar, en esas marcas todos se almacenan"*.
#   ESCOLAR    -> 50 pares por talla, así sea nuevo, reposición o lo que sea. Le gana a
#                 todo lo de abajo: un Power escolar son 50, no un cuerpo.
#   UN CUERPO  -> Power, Weinbrenner y Bata Industrials: el artículo entero ocupa un
#                 cuerpo, o sea el 100% de lo que entra repartido entre sus tallas.
#   PERILLA    -> el resto. Se reparte lo que queda de piso.
#
# OJO CON EL ORDEN: en el código de hoy el escolar se pregunta ANTES que la marca, así que
# un Adidas escolar queda capado en 50 por talla cuando debería bajar entero.
PARES_ESCOLAR = 50
TODO_AL_PISO = ['Adidas', 'Puma', 'Skechers', 'Marie Claire']
UN_CUERPO = ['Power', 'Weinbrenner', 'Bata Industrials']

topes, pide, seLoPasan, sinMedida = [], 0.0, 0, 0
for clave, val in TOPES.items():
    marca, genero, talla = clave.split('|')
    g = grupos.get((marca, genero, talla))
    if not g:
        continue
    r = rango(talla)
    tipo = max(g['tipos'].items(), key=lambda kv: kv[1])[0] if g['tipos'] else None
    cap = cap_de(g['marca'], tipo, r) if (r and tipo) else None
    propone = int(cap // TALLAS_POR_RANGO.get(r, 4)) if cap else None
    n = len(g['skus'])
    pide += n * val
    if propone is None:
        sinMedida += 1
    elif val > propone:
        seLoPasan += 1
    # El orden importa: 'todo' le gana al escolar, y el escolar le gana a un cuerpo.
    if g['marca'] in TODO_AL_PISO:
        # No tienen tope. Lo que ocupan del piso es lo que tienen hoy, no una decisión.
        regimen, fijo = 'todo', round(g['piso'] / n) if n else 0
    elif 'SCHOOL' in genero.upper():
        regimen, fijo = 'escolar', PARES_ESCOLAR
    elif g['marca'] in UN_CUERPO:
        regimen, fijo = 'un-cuerpo', propone
    else:
        regimen, fijo = 'perilla', None
    topes.append({'marca': g['marca'], 'genero': genero, 'talla': talla, 'rango': r,
                  'tipo': tipo, 'skus': n, 'piso': round(g['piso']), 'tuyo': val,
                  'propone': propone, 'cap': cap, 'regimen': regimen, 'fijo': fijo})

# ── El semáforo: ¿aguanta el piso? ──────────────────────────────────────────
hay = sum(v['pares'] for v in cuerpos.values())
capTotal = libre = 0.0
for c, v in cuerpos.items():
    s7 = max(v['porSku'], key=v['porSku'].get)
    fi = ficha.get(s7) or {}
    rr = rangoArt.get(s7) or {}
    r = max(rr.items(), key=lambda kv: kv[1])[0] if rr else None
    cap = dArt.get('%s|%s' % (v['zona'], s7)) or cap_de(fi.get('marca', ''), fi.get('tipo'), r) or 300
    capTotal += cap
    if cap > v['pares']:
        libre += cap - v['pares']
capProm = capTotal / max(1, len(cuerpos))
vacios = max(0, sum(CUERPOS_ZONA.values()) - len(cuerpos))
libreTot = libre + vacios * capProm
falta = max(0, pide - hay - libreTot)


def ordenTope(t):
    dentro = t['propone'] is not None and t['tuyo'] <= t['propone']
    n = float(t['talla']) if NUM.match(t['talla']) else 0
    return (dentro, t['marca'], t['genero'], n)


datos = {
    'semaforo': {'hay': round(hay), 'pide': round(pide), 'libre': round(libreTot),
                 'cuerpos': len(cuerpos), 'vacios': vacios, 'capProm': round(capProm),
                 'falta': round(falta), 'cuerposFalta': round(falta / capProm)},
    'cubicaje': cubicaje, 'rangos': RANGOS, 'tallasPorRango': TALLAS_POR_RANGO,
    'zonasMarca': Z.get('marcas') or {},
    'cuantoBaja': T.get('marcas') or {},
    'encoge': round(ENCOGE, 3),
    'sinCubicar': {r: len(set(s7 for s7, rr in rangoArt.items()
                              if rr and max(rr.items(), key=lambda kv: kv[1])[0] == r
                              and not any(k.endswith('|' + s7) for k in dArt)))
                   for r in RANGOS},
    # ── LO QUE DE VERDAD DECIDE CUÁNTO BAJA ────────────────────────────────
    # Sale de `casoDelItem` en dashboard_v28.js, no de la tabla por marca. Se pregunta en
    # este orden y el primero que da SÍ manda; el de abajo ni se consulta.
    'casos': [
        {'n': 'Escolar', 'q': '50 pares de CADA talla',
         'p': 'cualquier marca, así sea nuevo o reposición'},
        {'n': 'Catálogo (buffer D)', 'q': 'todo', 'p': 'va al MZN03 columna 8'},
        {'n': 'Bajó de reserva o lo pidió Replenishment', 'q': 'todo',
         'p': 'vuelve a sus mismos cuerpos'},
        {'n': 'No es calzado', 'q': 'todo', 'p': 'MZN04, sin cuerpo exacto'},
        {'n': 'Adidas · Puma · Skechers', 'q': 'todo',
         'p': 'la única fila de la tabla de marcas que todavía se lee'},
        {'n': 'REPOSICIÓN — 20 pares o más en el almacén', 'q': 'se completa 1 cuerpo',
         'p': 'activo + reserva, sin contar lo que llega'},
        {'n': 'CÓDIGO NUEVO — menos de 20, o cero', 'q': 'baja el 60%',
         'p': 'es lo que se vende en las dos primeras semanas'},
    ],
    'tallasComerciales': T.get('categorias') or {},
    'topes': sorted(topes, key=ordenTope),
    'resumenTopes': {'total': len(topes), 'pasan': seLoPasan, 'sinMedida': sinMedida,
                     'entran': len(topes) - seLoPasan - sinMedida,
                     'todo': sum(1 for t in topes if t['regimen'] == 'todo'),
                     'escolar': sum(1 for t in topes if t['regimen'] == 'escolar'),
                     'unCuerpo': sum(1 for t in topes if t['regimen'] == 'un-cuerpo'),
                     'perilla': sum(1 for t in topes if t['regimen'] == 'perilla')},
    'paresEscolar': PARES_ESCOLAR, 'unCuerpo': UN_CUERPO, 'todoAlPiso': TODO_AL_PISO,
}
io.open('scratch/_capacidad.json', 'w', encoding='utf-8', newline='').write(
    json.dumps(datos, ensure_ascii=False))

s = datos['semaforo']
print('hay %s | pide %s | libre %s | falta %s (%s cuerpos)'
      % tuple(format(s[k], ',') for k in ('hay', 'pide', 'libre', 'falta', 'cuerposFalta')))
r = datos['resumenTopes']
print('topes %s | se pasan %s | entran %s | sin medida %s'
      % tuple(format(r[k], ',') for k in ('total', 'pasan', 'entran', 'sinMedida')))
