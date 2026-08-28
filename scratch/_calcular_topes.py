# -*- coding: utf-8 -*-
"""EL TOPE DE CADA COMBINACION, CALCULADO. No 60 para todo.

Daniel, 27-ago-2026, mirando el Replenishment: *"por que en tope todos tienen sesenta? Si
te estoy diciendo que lo calcules tu. Como va a tener de tope sesenta un NO COMMERCIAL?
Calculalo en base a la necesidad, con el modulo de cubicaje"*.

Los 60 los puso el mismo Daniel *"para sacar un dato"*; nunca fueron una decision. Esto los
reemplaza por el numero que sale del cubicaje MEDIDO, con las reglas que el mismo dicto.

LAS CINCO REGLAS, en el orden en que se preguntan. La primera que dice que si, manda:

  1. NO ES CALZADO           -> SIN TOPE. No se repone por quiebre de talla: baja por
     (G. Gender != Footwear)    pedido de comercial. Es el caso del NO COMMERCIAL.
  2. MARCA QUE NO USA RESERVA-> SIN TOPE. Adidas, Puma, Skechers y Marie Claire no mandan
                                nada arriba, asi que no hay de donde reponer.
  3. ESCOLAR                 -> 50 pares por talla, a rajatabla.
  4. MARCA DE UN CUERPO      -> el cuerpo entero repartido entre las tallas de su rango.
     (Power, Weinbrenner,       Power, Weinbrenner y Bata Industrials ocupan un cuerpo por
      Bata Industrials)         articulo.
  5. EL RESTO                -> ese mismo reparto, por el PORCENTAJE que eligio Daniel.
                                Con 100% no entra en el almacen; el porcentaje es lo que
                                hace que la suma quepa en el piso.

SIN CUBICAJE MEDIDO NO SE INVENTA NADA: esa fila se deja como esta y sale marcada.

    python scratch/_calcular_topes.py              # solo calcula y muestra
    python scratch/_calcular_topes.py --publicar   # ademas lo escribe EN BETA
"""
import io, json, os, re, sys, urllib.request
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
AQUI = os.path.dirname(os.path.abspath(__file__))

PCT = 45                 # lo eligio Daniel el 27-ago-2026
PARES_ESCOLAR = 50
SIN_RESERVA = ('Adidas', 'Puma', 'Skechers', 'Marie Claire')
UN_CUERPO = ('Power', 'Weinbrenner', 'Bata Industrials')
RANGOS = ['18-25', '26-30', '31-35', '36-39', '40-44', '45+']
TALLAS_POR_RANGO = {'18-25': 8, '26-30': 5, '31-35': 5, '36-39': 4, '40-44': 5, '45+': 3}

C = json.load(io.open(os.path.join(AQUI, '_config.json'), encoding='utf-8'))['data']
art = json.load(io.open(os.path.join(AQUI, '_art.json'), encoding='utf-8'))['data']
cap = json.load(io.open(os.path.join(AQUI, '_capacidad.json'), encoding='utf-8'))
TOPES = C['factoresRepl']['marcaGeneroTalla']
Z = C['zonas']
dMT, dTipo = Z.get('densidadMarcaTipo') or {}, Z.get('densidadTipo') or {}
# El cubicaje por tipo y rango que midio la maqueta de Capacidad: medido donde se pudo,
# estimado desde el vecino donde no. Es la misma tabla que ve Daniel en el paso 1.
capMedida = {(f['tipo'], r): f['rangos'][r]['cap']
             for f in cap['cubicaje'] for r in RANGOS if f['rangos'][r]['cap']}


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


# ── EL MAESTRO manda: el tipo y si es calzado salen de ahi, no del stock ────
cab = {n: i for i, n in enumerate(art[0])}
col = lambda f, n: (str(f[cab[n]]).strip() if n in cab and cab[n] < len(f) else '')
# marca|genero -> los tipos de sus articulos, para saber cual manda
tipos = defaultdict(Counter)
calzado = defaultdict(Counter)
marcaReal = {}
for a in art[1:]:
    m, g = col(a, 'Marcas'), col(a, 'Gender RIMS')
    if not m or not g or g == '-':
        continue
    k = (m.upper(), g.upper())
    marcaReal[k[0]] = m
    t = tipo_de(col(a, 'Subcategory RIMS'), col(a, 'Category RIMS'))
    if t:
        tipos[k][t] += 1
    calzado[k][col(a, 'G. Gender') == 'Footwear'] += 1


def cap_de(marca, tipo, r):
    """La misma escalera del almacenaje: de lo mas fino a lo mas grueso."""
    return (dMT.get('%s|%s|%s' % (marca, tipo, r)) or dMT.get('%s|%s' % (tipo, r))
            or capMedida.get((tipo, r)) or dMT.get('%s|%s' % (marca, tipo)) or dTipo.get(tipo))


filas = []
for clave, viejo in sorted(TOPES.items()):
    mU, gU, talla = clave.split('|')
    marca = marcaReal.get(mU, mU.title())
    k = (mU, gU)
    esCalzado = calzado[k].most_common(1)[0][0] if calzado.get(k) else False
    r = rango(talla)
    tipo = tipos[k].most_common(1)[0][0] if tipos.get(k) else None
    cuerpo = cap_de(marca, tipo, r) if (r and tipo) else None
    porTalla = int(cuerpo // TALLAS_POR_RANGO.get(r, 4)) if cuerpo else None

    if not esCalzado:
        regla, nuevo = 'no es calzado', None
    elif marca in SIN_RESERVA:
        regla, nuevo = 'no usa reserva', None
    elif 'SCHOOL' in gU:
        regla, nuevo = 'escolar', PARES_ESCOLAR
    elif porTalla is None:
        regla, nuevo = 'SIN CUBICAJE', viejo
    elif marca in UN_CUERPO:
        regla, nuevo = 'un cuerpo', porTalla
    else:
        regla, nuevo = 'se reparte', max(1, round(porTalla * PCT / 100))

    filas.append({'clave': clave, 'marca': marca, 'genero': gU, 'talla': talla,
                  'rango': r, 'tipo': tipo, 'cuerpo': cuerpo, 'porTalla': porTalla,
                  'regla': regla, 'viejo': viejo, 'nuevo': nuevo})

F = lambda x: format(int(x), ',')
print('LOS %s TOPES, RECALCULADOS   (el reparto va al %d%%)' % (F(len(filas)), PCT))
print()
print('   %-16s %6s   %s' % ('REGLA', 'FILAS', 'QUE TOPE LES QUEDA'))
for regla in ('no es calzado', 'no usa reserva', 'escolar', 'un cuerpo', 'se reparte', 'SIN CUBICAJE'):
    g = [f for f in filas if f['regla'] == regla]
    if not g:
        continue
    vs = sorted(f['nuevo'] for f in g if f['nuevo'] is not None)
    que = 'SIN TOPE — se quitan' if vs == [] else (
        'todos %d' % vs[0] if vs[0] == vs[-1] else 'de %d a %d (mediana %d)' % (vs[0], vs[-1], vs[len(vs) // 2]))
    print('   %-16s %6s   %s' % (regla, F(len(g)), que))

quedan = [f for f in filas if f['nuevo'] is not None]
print()
print('   quedan con tope : %s   ·   se quitan : %s'
      % (F(len(quedan)), F(len(filas) - len(quedan))))
print('   los 60 de hoy   : %s de %s eran 60' % (F(sum(1 for f in filas if f['viejo'] == 60)), F(len(filas))))
suben = [f for f in quedan if f['nuevo'] > f['viejo']]
bajan = [f for f in quedan if f['nuevo'] < f['viejo']]
print('   suben %s · bajan %s · quedan igual %s'
      % (F(len(suben)), F(len(bajan)), F(len(quedan) - len(suben) - len(bajan))))

print('\n   ALGUNOS EJEMPLOS')
print('   %-18s %-24s %-5s %-14s %5s %5s   %s' % ('MARCA', 'GENERO', 'TALLA', 'REGLA', 'HOY', 'NUEVO', 'DE DONDE SALE'))
muestra = []
for regla in ('no es calzado', 'no usa reserva', 'escolar', 'un cuerpo', 'se reparte'):
    muestra += [f for f in filas if f['regla'] == regla][:2]
for f in muestra:
    de = ('cuerpo %s ÷ %d tallas del %s' % (f['cuerpo'], TALLAS_POR_RANGO.get(f['rango'], 4), f['rango'])
          if f['porTalla'] else '—')
    print('   %-18s %-24s %-5s %-14s %5s %5s   %s' % (f['marca'][:18], f['genero'][:24], f['talla'],
          f['regla'], f['viejo'], f['nuevo'] if f['nuevo'] is not None else 'quitar', de))

io.open(os.path.join(AQUI, '_topes_calculados.json'), 'w', encoding='utf-8', newline='').write(
    json.dumps({'pct': PCT, 'filas': filas}, ensure_ascii=False))

# ── PUBLICAR EN BETA ────────────────────────────────────────────────────────
if '--publicar' in sys.argv:
    U = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config'
    req = urllib.request.Request(U)
    req.add_header('X-Environment', 'beta')
    with urllib.request.urlopen(req, timeout=90) as fh:
        c = json.load(fh)
    cajon = (c.get('data') if 'data' in c else c) or {}
    io.open(os.path.join(AQUI, '_respaldo_factores_beta.json'), 'w', encoding='utf-8',
            newline='').write(json.dumps(cajon['factoresRepl'], ensure_ascii=False, indent=1))
    cajon['factoresRepl']['marcaGeneroTalla'] = {
        f['clave']: f['nuevo'] for f in filas if f['nuevo'] is not None}
    r2 = urllib.request.Request(U, data=json.dumps(cajon, ensure_ascii=False).encode('utf-8'),
                                method='POST')
    r2.add_header('Content-Type', 'application/json')
    r2.add_header('X-Environment', 'beta')
    with urllib.request.urlopen(r2, timeout=90) as fh:
        print('\n   publicado EN BETA · servidor %s' % fh.status)
    req3 = urllib.request.Request(U)
    req3.add_header('X-Environment', 'beta')
    with urllib.request.urlopen(req3, timeout=90) as fh:
        d = json.load(fh)
    m = ((d.get('data') or d)['factoresRepl']['marcaGeneroTalla'])
    print('   leido de vuelta: %s combinaciones · valores distintos: %s'
          % (F(len(m)), F(len(set(m.values())))))
