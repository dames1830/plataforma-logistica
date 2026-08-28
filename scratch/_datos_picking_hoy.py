# -*- coding: utf-8 -*-
"""LOS DATOS DE "PICKING HOY".

LA BASE ES EL PENDIENTE POR DESPACHAR, EL MISMO QUE MUESTRA ZONA BUFFER.

Daniel, 27-ago-2026: *"pueden haber un millon de pedidos en el WMS, pero solamente vamos a
tener lo que dice el correo de comercial. El pendiente de despacho ya esta filtrando los
correos, entonces son 95.372 por despachar; ese numero deberia estar en una tarjeta, y en
base a eso se hace el calculo"*.

    solicitada 150.455  -  asignada 55.083  =  PENDIENTE 95.372   <- la base

De ahi para abajo, una sola resta y solo dos preguntas:

    a picar = min( pendiente , lo que hay en ZONA ACTIVA )

...porque un picker no sube al rack alto. Lo que no esta abajo no se pica: se baja primero.

NO SE VUELVE A RESTAR LO ASIGNADO DEL PISO. La foto de las 07:00 ya muestra lo que hay
FISICAMENTE despues de lo que el turno noche se llevo; descontar otra vez la asignacion
seria contarla dos veces.

Lo que no esta abajo NO se pica. Se parte segun donde este, porque cada uno se resuelve
distinto, y lo que ya esta comprometido con una guia va primero.

LA JERARQUIA DE ZONAS la dicto Daniel el 27-ago-2026:

    buffer -> selectivo -> mezzanine 1 -> 2 -> 3 -> 4 -> andamios

Se busca en ese orden y se toma de cada zona lo que tenga, hasta cubrir la asignacion. No
es a prorrata --eso fue el primer intento y no es como se camina el almacen--.
"""
import io, json, re, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# EL PEDIDO SALE DEL MISMO DETALLE QUE LA SECCION DE PEDIDOS POR ZONA.
#
# Antes leia el area `buffer` del servidor, armada a las 19:18 de anoche, mientras la
# seccion de abajo leia el Detalle Orden de las 06:59 de hoy. Dos totales distintos en una
# sola pantalla se leen como un error. Ahora las dos salen del mismo archivo y del mismo
# momento: lo arma `_datos_pedidos_por_zona.py`, que corre ANTES que este.
ped = json.load(io.open('scratch/_pedido_del_detalle.json', encoding='utf-8'))
# EL STOCK ES EL DEL ANCLA DE LAS 07:00, NO EL DE LA WEB.
#
# Daniel, 27-ago-2026: *"el stock ancla de la manana no se publica, pero si se guarda;
# ve a buscar ese y con eso calculas la ola"*. Y es cierto: el ancla de las 07:00 corre
# igual que la de las 19:00 -misma tarea de Windows, dos horarios- pero solo la de la
# noche publica en la web junto con el Slotting. La de la manana deja el CSV en OneDrive.
#
# Lo arma scratch/_leer_ancla_manana.py, que lo convierte al mismo formato.
_ancla = json.load(io.open('scratch/_activo_ancla_manana.json', encoding='utf-8'))
act = _ancla['data']
art = json.load(io.open('scratch/_art.json', encoding='utf-8'))['data']
res = json.load(io.open('scratch/_analisis_sku_reserva.json', encoding='utf-8'))['data']

# EL ORDEN EN QUE SE BUSCA, dictado por Daniel el 27-ago-2026.
#
# EL BUFFER VA PARTIDO EN DOS, y en este orden: primero A+B, despues C. *"Los separo asi
# porque el A y el B son solid y el C es prepack. No me vayas a poner solid y prepack: pon
# buffer A mas B, y en otra jerarquia el buffer C"*. Por eso los rotulos son las letras.
#
# La letra sale de la UBICACION -CDBUFFER-B-00-012-, no del area. Cualquier otra letra que
# aparezca (la D del catalogo, por ejemplo) cae en su propio renglon, para que nada se
# pierda sin que se note.
#
# PARED va al final y no la nombro: se deja para que nada quede sin contar.
ORDEN = ['CDBUF_AB', 'CDBUF_C', 'CDBUF_X', 'SEL', 'MZN01', 'MZN02', 'MZN03', 'MZN04',
         'AND', 'PARED']
ETIQUETA = {'CDBUF_AB': 'Buffer A + B', 'CDBUF_C': 'Buffer C', 'CDBUF_X': 'Buffer (otras letras)',
            'SEL': 'Selectivo', 'MZN01': 'Mezzanine 1', 'MZN02': 'Mezzanine 2',
            'MZN03': 'Mezzanine 3', 'MZN04': 'Mezzanine 4',
            'AND': 'Andamios', 'PARED': 'Pared'}


def zona_de(fila):
    """La zona a la que pertenece una fila del stock. El buffer se parte por su letra."""
    a = str(fila.get('Área') or '').strip().upper()
    if a != 'CDBUFFER':
        return a
    partes = str(fila.get('Ubicación') or '').strip().upper().split('-')
    letra = partes[1] if len(partes) > 1 else ''
    if letra in ('A', 'B'):
        return 'CDBUF_AB'
    if letra == 'C':
        return 'CDBUF_C'
    return 'CDBUF_X'

cab = {n: i for i, n in enumerate(art[0])}


def col(f, n):
    i = cab.get(n)
    return str(f[i]).strip() if i is not None and i < len(f) else ''


ficha = {}
for a in art[1:]:
    s7 = col(a, 'CodArticulo').split('-')[0][:7]
    if s7 and s7 not in ficha:
        ficha[s7] = {'marca': col(a, 'Marcas') or 'SIN MARCA',
                     'gender': col(a, 'Gender RIMS') or '(sin gender)',
                     'coleccion': col(a, 'Coleccion PO') or '(sin coleccion)',
                     # 'G. Gender' es la que dice si es calzado. NO es 'Gender RIMS'.
                     'esCalzado': col(a, 'G. Gender') == 'Footwear'}
SIN_FICHA = {'marca': 'SIN MARCA', 'gender': '(sin gender)', 'coleccion': '(sin coleccion)',
             'esCalzado': False}


RX_PREPACK = re.compile(r'^\d{7}-\d-(\d{5})$')


def es_prepack(s):
    return bool(RX_PREPACK.match(str(s)))


def pares_por_caja(sku):
    """CUANTOS PARES TRAE UNA CAJA DE PREPACK.

    Los DOS PRIMEROS digitos del sufijo son los pares. Confirmado por Daniel el
    27-ago-2026 sobre casos reales del Buffer C:

        5898515-1-**04**042  ->  caja de 4 pares   (WOMEN HIGH PLUS LAS VEGAS)
        1615489-1-**06**014  ->  caja de 6 pares   (SANDALS GIRLS WHEEL)

    Los ULTIMOS TRES son el codigo de la CURVA -que tallas trae-, y esa tabla todavia no
    la tenemos. Por eso hoy se desglosa el CUANTO y no el DE QUE TALLA: Daniel,
    27-ago-2026, *"por el momento ponle cuatro pares, de ahi ya lo resuelvo"*.

    Devuelve 1 si no es prepack o si el numero no tiene sentido: nunca se inventa.
    """
    m = RX_PREPACK.match(str(sku))
    if not m:
        return 1
    try:
        n = int(m.group(1)[:2])
    except Exception:
        return 1
    return n if n > 0 else 1


# -- EL PEDIDO --------------------------------------------------------------
# NO TODO LO QUE PIDE UNA GUIA SON PARES: el pedido del 26-ago traia 47.238 unidades de
# BOLSAS BATA GRANDE en un solo codigo. El corte es el mismo del Reporte Picking.
pedido = defaultdict(lambda: {'sol': 0.0, 'asig': 0.0})
for f in ped['data']:
    sku = str(f.get('Código de artículo') or '').strip()
    if not sku:
        continue
    try:
        pedido[sku]['sol'] += float(f.get('Cantidad solicitada') or 0)
        pedido[sku]['asig'] += float(f.get('Cantidad asignada') or 0)
    except Exception:
        pass

# -- DONDE VIVE CADA SKU ----------------------------------------------------
donde = defaultdict(lambda: defaultdict(float))
stockZonaMarca = defaultdict(lambda: defaultdict(float))
stockZonaMarcaPares = defaultdict(lambda: defaultdict(float))
enOtraArea = defaultdict(float)
for f in act:
    zona = zona_de(f)
    sku = str(f.get('Artículo') or '').strip()
    try:
        q = float(f.get('Cantidad actual') or 0)
    except Exception:
        continue
    if not sku or q <= 0:
        continue
    if zona not in ORDEN:
        enOtraArea[sku] += q
        continue
    donde[sku][zona] += q
    _m = ficha.get(sku[:7], SIN_FICHA)['marca']
    stockZonaMarca[zona][_m] += q
    stockZonaMarcaPares[zona][_m] += q * pares_por_caja(sku)

enReserva = defaultdict(float)
for f in res:
    sku = str(f.get('PRODUCTO') or '').strip()
    try:
        q = float(f.get('CANTIDAD') or 0)
    except Exception:
        continue
    if sku and q > 0:
        enReserva[sku] += q

# -- LA OLA -----------------------------------------------------------------
# CALZADO Y NO CALZADO VAN EN COLUMNAS SEPARADAS. Daniel, 27-ago-2026: *"me pones Bata a
# picar 46.840 pares y eso es irreal, porque esas son bolsas. En vez de pares ponme calzado,
# y en otra columna no calzado"*. Tiene razon: sumarlos en una sola cifra dice que Bata tiene
# 46 mil pares de zapatos en el buffer, y son bolsas.
#
# Los dos van DESGLOSADOS -las cajas de prepack ya abiertas en pares-; `picar` queda como la
# unidad del WMS, para el encabezado de la zona.
porZonaMarca = defaultdict(lambda: defaultdict(
    lambda: {'picar': 0, 'pares': 0, 'calzado': 0, 'noCalzado': 0, 'skus': set()}))
porColeccion = defaultdict(lambda: {'picar': 0, 'skus': set()})
porGender = defaultdict(lambda: {'picar': 0, 'skus': set()})
porMarca = defaultdict(int)
porTipo = defaultdict(lambda: {'picar': 0, 'skus': set()})
tot = {'sol': 0.0, 'asig': 0.0, 'falta': 0.0, 'picar': 0, 'skus': 0}
noCalzado = {'pedido': 0.0, 'picar': 0, 'skus': set()}
sinRespaldo = []
SALDOS = ['reserva', 'prepack', 'otra', 'noEsta']
saldo = {k: {'pares': 0.0, 'skus': [], 'total': 0} for k in SALDOS}


def a_saldo(k, sku, pares, marca, extra=0):
    saldo[k]['pares'] += pares
    saldo[k]['total'] += 1
    saldo[k]['skus'].append({'sku': sku, 'pares': round(pares), 'marca': marca,
                             'extra': round(extra)})


for sku, p in pedido.items():
    tot['sol'] += p['sol']
    tot['asig'] += p['asig']
    falta = max(0.0, p['sol'] - p['asig'])
    tot['falta'] += falta
    fi = ficha.get(sku[:7]) or SIN_FICHA
    # LAS BOLSAS TAMBIEN SE PICAN. Daniel, 27-ago-2026: *"por que no se estan midiendo las
    # bolsas aca? Se supone que es un pedido que comercial esta mandando, y debe estar en el
    # numero"*. Tiene razon: si comercial lo pidio, alguien lo tiene que levantar. Entran a
    # la ola como todo lo demas; lo unico que se hace es contarlas aparte, porque no es lo
    # mismo picar cien pares que cinco mil bolsas y mezclarlas deja la productividad sin
    # significado -- ese corte ya lo hace el Reporte Picking y se respeta el mismo.
    if not fi['esCalzado']:
        noCalzado['pedido'] += falta
        noCalzado['skus'].add(sku)

    # -- SE VA A BUSCAR EL PENDIENTE, EN EL ORDEN QUE DIJO DANIEL --
    queda = int(round(falta))
    pedia = queda
    if pedia > 0:
        tot['skus'] += 1
        zs = donde.get(sku) or {}
        for z in ORDEN:
            if queda <= 0:
                break
            hay = int(zs.get(z, 0))
            if hay <= 0:
                continue
            toma = min(queda, hay)
            g = porZonaMarca[z][fi['marca']]
            g['picar'] += toma
            _p = toma * pares_por_caja(sku)
            g['pares'] += _p
            g['calzado' if fi['esCalzado'] else 'noCalzado'] += _p
            g['skus'].add(sku)
            queda -= toma
        tomado = pedia - queda
        tot['picar'] += tomado
        if not fi['esCalzado']:
            noCalzado['picar'] += tomado
        porTipo['Calzado' if fi['esCalzado'] else 'Bolsas y complementos']['picar'] += tomado
        porTipo['Calzado' if fi['esCalzado'] else 'Bolsas y complementos']['skus'].add(sku)
        porMarca[fi['marca']] += tomado
        porColeccion[fi['coleccion']]['picar'] += tomado
        porColeccion[fi['coleccion']]['skus'].add(sku)
        porGender[fi['gender']]['picar'] += tomado
        porGender[fi['gender']]['skus'].add(sku)
        if queda > 0:
            # LO QUE NO ESTA ABAJO. Va al saldo que le toca, pero lo que YA ESTA COMPROMETIDO
            # con una guia se separa: es lo mas urgente de bajar, porque el picker ya tiene la
            # orden. Medido sobre el 26-ago: el 98% de eso tiene stock en reserva, o sea que
            # el WMS asigna tambien contra el rack alto.
            if es_prepack(sku):
                a_saldo('prepack', sku, queda, fi['marca'])
            elif enReserva.get(sku, 0) > 0:
                a_saldo('reserva', sku, queda, fi['marca'], enReserva[sku])
            elif enOtraArea.get(sku, 0) > 0:
                a_saldo('otra', sku, queda, fi['marca'], enOtraArea[sku])
            else:
                a_saldo('noEsta', sku, queda, fi['marca'])


# -- SE ARMA LA SALIDA ------------------------------------------------------
zonas = []
for z in ORDEN:            # EN EL ORDEN DE BUSQUEDA, para que se lea como se camina
    marcas = {m: v for m, v in (porZonaMarca.get(z) or {}).items() if v['picar'] > 0}
    if not marcas:
        continue
    filas = sorted(({'marca': m, 'picar': v['picar'], 'pares': v['pares'],
                     'calzado': v['calzado'], 'noCalzado': v['noCalzado'],
                     'skus': len(v['skus']),
                     'stock': round(stockZonaMarca[z].get(m, 0)),
                     'stockPares': round(stockZonaMarcaPares[z].get(m, 0))}
                    for m, v in marcas.items()), key=lambda r: -r['pares'])
    # SOLO SE MUESTRAN LAS DOS UNIDADES DONDE DE VERDAD SE DIFERENCIAN. En el Buffer C todo
    # es prepack y una caja no es un par; en las demas zonas las dos columnas darian el
    # mismo numero y serian ruido.
    zonas.append({'zona': z, 'etiqueta': ETIQUETA.get(z, z), 'marcas': filas,
                  'picar': sum(f['picar'] for f in filas),
                  'pares': sum(f['pares'] for f in filas),
                  'calzado': sum(f['calzado'] for f in filas),
                  'noCalzado': sum(f['noCalzado'] for f in filas),
                  'stock': round(sum(stockZonaMarca[z].values())),
                  'stockPares': round(sum(stockZonaMarcaPares[z].values())),
                  # EL AVISO DE CAJAS SOLO DONDE DE VERDAD HAY CAJAS. En el Buffer A+B
                  # hay dos lineas sueltas de prepack -11 pares de diferencia sobre 49.727-
                  # y decir "49.727 cajas" ahi seria mentira. Se pide una diferencia real.
                  'enCajas': sum(f['pares'] for f in filas) > sum(f['picar'] for f in filas) * 1.05,
                  'skus': len(set().union(*(v['skus'] for v in marcas.values())))})

chico = lambda d: sorted(({'nombre': k, 'picar': v['picar'], 'skus': len(v['skus'])}
                          for k, v in d.items() if v['picar'] > 0), key=lambda r: -r['picar'])

# Los rótulos SÍ van con tilde: los lee Daniel en pantalla, no son nombres de variable.
ROTULO = {
    'reserva': ('Está en reserva',
                'Hay que bajarlo igual, pero después de lo que ya está comprometido con una guía.'),
    'prepack': ('Prepack', 'Se pica por caja, no por par: no entra en esta cuenta.'),
    'otra': ('En un área que no es de picking', 'Está en MATE, DIS o PISO.'),
    'noEsta': ('No está en ningún lado', 'Esto sí es quiebre.'),
}
datos = {
    'fecha': (ped.get('updated_at') or '')[:16],
    'origenPedido': ped.get('origen') or '',
    'fechaStock': (_ancla.get('updated_at') or '')[:16],
    'origenStock': _ancla.get('origen') or '',
    'fechaReserva': '2026-08-26 19:07',   # la reserva no baja a las 07:00 desde el 22-ago
    # El renglon del recorrido muestra solo las zonas que hoy tienen algo. 'Buffer (otras
    # letras)' existe por seguridad -para que una D no se pierda en silencio- pero si esta
    # vacio no vale la pena nombrarlo.
    'orden': [ETIQUETA[z] for z in ORDEN
              if z != 'CDBUF_X' or any(x['zona'] == 'CDBUF_X' for x in zonas)],
    'totales': {'sol': round(tot['sol']), 'asig': round(tot['asig']),
                'falta': round(tot['falta']), 'picar': tot['picar'], 'skus': tot['skus']},
    'noCalzado': {'pedido': round(noCalzado['pedido']), 'picar': noCalzado['picar'],
                  'skus': len(noCalzado['skus'])},
    'porTipo': chico(porTipo),
    'sinRespaldo': {'pares': sum(x['pares'] for x in sinRespaldo), 'skus': len(sinRespaldo),
                    'enReserva': sum(x['pares'] for x in sinRespaldo if x['arriba']),
                    'skusEnReserva': sum(1 for x in sinRespaldo if x['arriba']),
                    'top': sorted(sinRespaldo, key=lambda x: -x['pares'])[:25]},
    'zonas': zonas,
    'porMarca': sorted(({'nombre': m, 'picar': v} for m, v in porMarca.items() if v > 0),
                       key=lambda r: -r['picar']),
    'porColeccion': chico(porColeccion),
    'porGender': chico(porGender),
    'saldos': [{'clave': k, 'titulo': ROTULO[k][0], 'dice': ROTULO[k][1],
                'pares': round(saldo[k]['pares']), 'skus': saldo[k]['total'],
                'top': sorted(saldo[k]['skus'], key=lambda x: -x['pares'])[:25]}
               for k in SALDOS if saldo[k]['pares'] > 0],
}
io.open('scratch/_picking_hoy.json', 'w', encoding='utf-8', newline='').write(
    json.dumps(datos, ensure_ascii=False))

t = datos['totales']
NC = datos['noCalzado']
F = lambda x: format(int(x), ',')
print('PEDIDO   %s   (el correo de comercial, ya filtrado)' % datos['fecha'])
print('STOCK    %s   (%s)' % (datos['fechaStock'], datos['origenStock']))
print('RESERVA  %s' % datos['fechaReserva'])
print()
print('   comercial pidio %s  -  el WMS ya asigno %s' % (F(t['sol']), F(t['asig'])))
print('   POR DESPACHAR (Zona Buffer -> Pendiente):  %s' % F(t['falta']))
print()
print('DE ESOS %s POR DESPACHAR' % F(t['falta']))
print('   %-40s %10s   %s SKUs' % ('ESTA EN ZONA ACTIVA -> se pica hoy', F(t['picar']), F(t['skus'])))
for x in datos['saldos']:
    print('   %-40s %10s   %s SKUs' % (x['titulo'].lower(), F(x['pares']), F(x['skus'])))
suma = t['picar'] + sum(x['pares'] for x in datos['saldos'])
print('   %-40s %10s   %s' % ('SUMA', F(suma),
      'cuadra con lo por despachar' if abs(suma - t['falta']) <= 2
      else 'NO CUADRA (dif %d)' % (suma - t['falta'])))
print()
print('LO QUE SE PICA, PARTIDO POR TIPO')
for x in datos['porTipo']:
    print('   %-40s %10s   %s SKUs' % (x['nombre'], F(x['picar']), F(x['skus'])))
print('   %-40s %10s' % ('(de los que piden, las bolsas eran)', F(NC['pedido'])))
print()
print('%-24s %10s %10s %11s %10s %7s' % ('ZONA (orden de busqueda)', 'A PICAR',
      '= PARES', 'STOCK HOY', '= PARES', 'SKUS'))
for z in zonas:
    print('%-24s %10s %10s %11s %10s %7s' % (z['etiqueta'], F(z['picar']),
          F(z['pares']) if z['enCajas'] else '', F(z['stock']),
          F(z['stockPares']) if z['enCajas'] else '', F(z['skus'])))
print('%-24s %10s %10s' % ('TOTAL', F(sum(z['picar'] for z in zonas)),
      F(sum(z['pares'] for z in zonas))))
print()
print('   El Buffer C va en CAJAS: sus %s cajas son %s pares de verdad.'
      % (F(next(z['picar'] for z in zonas if z['zona'] == 'CDBUF_C')),
         F(next(z['pares'] for z in zonas if z['zona'] == 'CDBUF_C'))))
