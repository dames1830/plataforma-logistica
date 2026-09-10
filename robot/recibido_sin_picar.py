# -*- coding: utf-8 -*-
"""RECIBIDO Y SIN PICAR  ->  Analisis SKU > Articulo, al pie.

Lo que entro por recepcion, ya esta en el sistema y NO SALE A TIENDA. Lo pidio
Daniel el 10-sep-2026. Responde una pregunta que no tenia respuesta en ninguna
pantalla: *que compre, ya lo tengo, y no se esta moviendo*.

  recibido   = el ASN del WMS -numero de ASN, LPN de entrada, fecha de recepcion-
  picado     = los archivos de picking, SOLO lo que fue a una tienda retail
  embalado   = el OBLPN, tambien solo retail

SOLO CANAL RETAIL, con las DOS condiciones: destino que empieza con 50 Y esta en
el maestro de rutas. Ver el skill `una-guia-un-lugar`, seccion 0-ter.

TRES COSAS QUE MEDI Y QUE NO SE VEN EN EL CODIGO:

  1. La columna "Numero de LPN de entrada" del picking esta VACIA -6.000 de
     6.000 filas-. El LPN de entrada sale del ASN, no de ahi.
  2. El LPN DEL PICK es "Numero de contenedor" -5.128 de 6.000 empiezan con PRE-.
  3. El archivo OBLPN MEZCLA DOS CLASES: los de "Tipo de LPN" vacio son PRE
     -contenedores de pick- y los que traen tipo (PP, H30, CE1, TE2) son los
     cartones. El carton sale SOLO de los que tienen tipo.

Se corre a mano o desde el horario del servidor:

    python recibido_sin_picar.py            publica lo de hoy
    python recibido_sin_picar.py --probar   calcula y muestra, sin publicar
    python recibido_sin_picar.py --beta     publica en la base de pruebas
"""
import io, os, csv, re, glob, json, sys, collections, datetime
import openpyxl

B = None   # se toma de `armar_pendiente.BASE`, que la BUSCA y no la escribe
HOY = (datetime.datetime.strptime(sys.argv[sys.argv.index('--fecha') + 1],
                                  '%Y-%m-%d').date()
       if '--fecha' in sys.argv else datetime.date.today())

def fecha_de(t):
    t = str(t or '').strip()
    for f in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
              '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.datetime.strptime(t[:19], f)
        except Exception:
            pass
    return None

# ── EL MAESTRO: marca y modelo ──────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_ARGV = list(sys.argv)
sys.argv = ['x', '--probar']
import armar_pendiente as A
B = A.BASE
gen, rims, colec = A.leer_maestro()
rutas = A.leer_rutas()


def limpio(t):
    """El WMS escribe los codigos como formula: ="508003940451".
    Sin limpiarlos se ven asi en la pantalla y no cruzan contra nada."""
    return A.limpio(t) if t is not None else ''


def es_retail(dest):
    """CANAL RETAIL = va a una tienda. Las DOS condiciones, como las
    fijo Daniel: empieza con 50 Y esta en el maestro de rutas. El 50
    solo deja entrar almacenes internos; el maestro solo dejaria fuera
    una tienda recien abierta."""
    d = str(dest or '').strip()
    return d.startswith('50') and d in rutas

# ── LO RECIBIDO ─────────────────────────────────────────────────────────────
# De donde viene la mercaderia, por el codigo de `cust_field_1` del ASN.
ORIGEN = {'23': 'Nacional', '24': 'Importación'}

rec = collections.defaultdict(lambda: {'pares': 0.0, 'fecha': None, 'asn': '',
                                       'lpn': '', 'desc': '', 'origen': ''})
# EL ARCHIVO DEL ASN TRAE LA MISMA FILA REPETIDA, y sumarlas infla todo.
#
# Lo caza Daniel el 10-sep-2026 mirando un LPN: la web decia 900 pares y el WMS
# 15. Medido en el ASN 20261052701CA: 3.600 filas y solo 60 ENTERAS DISTINTAS
# -cada una repetida 60 veces, que es justo el numero de SKU del ASN: la
# exportacion cruza-. Sumando todo daban 21.600; sumando una por fila, 360.
#
# Es la MISMA trampa que ya tenia documentada `armar_pendiente.py` con el Detalle
# de Orden, y volvi a caer en ella en otro archivo.
vistas_asn = set()
for ruta in sorted(glob.glob(os.path.join(B, 'ASN', 'ASN 2026-0[89].xlsx'))):
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    it = wb.worksheets[0].iter_rows(values_only=True)
    cab = None
    for r in it:
        vals = [str(x).strip() if x is not None else '' for x in r]
        if cab is None:
            if any(v.startswith('N') and 'ASN' in v for v in vals):
                cab = vals
                iasn = next(i for i, v in enumerate(cab) if 'ASN' in v)
                ilpn = next(i for i, v in enumerate(cab) if 'LPN' in v)
                irec = next(i for i, v in enumerate(cab) if 'recib' in v.lower())
                iart = next(i for i, v in enumerate(cab) if v.lower().startswith('art'))
                ifec = next(i for i, v in enumerate(cab) if 'recepci' in v.lower())
                ides = next(i for i, v in enumerate(cab) if 'escrip' in v)
                # EL TIPO DE ASN. `cust_field_1` dice de donde viene la mercaderia,
                # y calza exacto con la moneda de `cust_field_2`.
                ityp = next((i for i, v in enumerate(cab)
                             if v.strip().lower() == 'cust_field_1'), None)
            continue
        sku = str(r[iart] or '').strip()
        if not sku:
            continue
        # LA FILA ENTERA es la llave: dos filas identicas son la misma, y el
        # archivo las trae por decenas.
        clave = tuple(str(x) for x in r)
        if clave in vistas_asn:
            continue
        vistas_asn.add(clave)
        try:
            q = float(r[irec] or 0)
        except Exception:
            q = 0.0
        if q <= 0:
            continue
        # ── SOLO IMPORTACION Y NACIONAL ────────────────────────────────────
        #
        # Daniel, 10-sep-2026: *"esta trayendo del canal de devolucion, de nota de
        # credito... yo lo que quiero que figuren solamente son los que vienen de
        # importacion o nacional"*. Y tiene razon: si algo llega de logistica
        # inversa, que no salga NO es una noticia, es lo esperado.
        #
        # Medido sobre el ASN de setiembre -118.005 filas-:
        #   23  PEN  nacional ....... 338.339 recibidos
        #   24  USD  importacion .... 227.811
        #   56, 89, 16, 30 ..........   2.452  <- inversa, notas, traslados
        # Los dos primeros son el 99,6% de lo que de verdad entro al CD.
        tipo = str(r[ityp] or '').strip() if ityp is not None else ''
        if tipo not in ORIGEN:
            continue
        f = fecha_de(r[ifec])
        v = rec[sku]
        v['origen'] = ORIGEN[tipo]
        v['pares'] += q
        v['desc'] = str(r[ides] or '').strip()
        if f and (v['fecha'] is None or f > v['fecha']):
            v['fecha'] = f
            v['asn'] = str(r[iasn] or '').strip()
            v['lpn'] = str(r[ilpn] or '').strip()
    wb.close()

# ── LO PICADO ───────────────────────────────────────────────────────────────
pic = collections.defaultdict(lambda: {'pares': 0.0, 'ultima': None, 'usuario': '',
                                       'lpn': '', 'cont': '', 'orden': ''})
# LOS PICKS A OTRO CANAL, aparte. Sin esto no se puede distinguir "no salio a
# tienda" de "nadie lo toco", y son dos numeros muy distintos: medido el 09-09
# sobre 250 SKU, 191 SI se habian picado, solo que a otro canal.
pic_otro = collections.defaultdict(float)
for ruta in glob.glob(os.path.join(B, 'Picking', '*.csv')):
    f = io.open(ruta, encoding='utf-8-sig', newline='', errors='replace')
    rd = csv.reader(f, delimiter=';')
    try:
        cab = next(rd)
    except StopIteration:
        f.close(); continue
    ix = dict((c.strip(), i) for i, c in enumerate(cab))
    iA, iQ = ix.get('C\xf3digo de art\xedculo'), ix.get('Cantidad empaquetada')
    iH, iU = ix.get('Hora de selecci\xf3n'), ix.get('Usuario de selecci\xf3n')
    iL, iC = ix.get('N\xfamero de LPN de entrada'), ix.get('N\xfamero de contenedor')
    iD = ix.get('Instalaci' + chr(0xf3) + 'n de destino')
    iO = ix.get('N\xfamero de orden')
    if iA is None or iQ is None:
        f.close(); continue
    dame = lambda r, i: (str(r[i]).strip() if i is not None and i < len(r) and r[i] else '')
    for r in rd:
        if len(r) <= iQ:
            continue
        sku = dame(r, iA)
        if not sku:
            continue
        try:
            q = float(str(r[iQ] or 0).replace(',', ''))
        except Exception:
            q = 0.0
        if q <= 0:
            continue
        if not es_retail(limpio(dame(r, iD))):
            pic_otro[sku] += q
            continue
        v = pic[sku]
        v['pares'] += q
        h = fecha_de(dame(r, iH))
        if h and (v['ultima'] is None or h > v['ultima']):
            v.update(ultima=h, usuario=dame(r, iU),
                     lpn=limpio(dame(r, iC)),
                     cont=limpio(dame(r, iC)),
                     orden=limpio(dame(r, iO)))
    f.close()

# ── EL EMBALAJE ─────────────────────────────────────────────────────────────
emb = {}
for ruta in glob.glob(os.path.join(B, 'OBLPN Embalaje', '*.csv')):
    f = io.open(ruta, encoding='utf-8-sig', newline='', errors='replace')
    rd = csv.reader(f, delimiter=';')
    try:
        cab = next(rd)
    except StopIteration:
        f.close(); continue
    ix = dict((c.strip(), i) for i, c in enumerate(cab))
    iA, iL = ix.get('C\xf3digo de art\xedculo'), ix.get('N\xfamero de LPN')
    iU = ix.get('Usuario de modificaci\xf3n de LPN')
    iP = ix.get('Registro de hora de empaquetado')
    iDe = ix.get('Instalaci' + chr(0xf3) + 'n de destino')
    iT = ix.get('Tipo de LPN')
    if iA is None:
        f.close(); continue
    dame = lambda r, i: (str(r[i]).strip() if i is not None and i < len(r) and r[i] else '')
    for r in rd:
        sku = dame(r, iA)
        if not sku:
            continue
        # EL EMBALAJE TAMBIEN VA FILTRADO. Si el pick a otro canal no cuenta,
        # el usuario que lo embalo tampoco puede salir en el cuadro.
        if not es_retail(limpio(dame(r, iDe))):
            continue
        # EL CARTON ES EL QUE TIENE TIPO DE LPN. El archivo mezcla dos clases:
        # los de tipo vacio son PRE -contenedores de pick, no cartones- y los que
        # traen tipo (PP, H30, CE1, TE2) son los cartones de embalaje, numericos.
        if not dame(r, iT):
            continue
        h = fecha_de(dame(r, iP))
        if sku not in emb or (h and emb[sku]['h'] and h > emb[sku]['h']):
            emb[sku] = {'h': h, 'carton': limpio(dame(r, iL)),
                        'usuario': dame(r, iU)}
    f.close()

# ── EL CRUCE ────────────────────────────────────────────────────────────────
def arma(dias, tope_pares):
    corte = HOY - datetime.timedelta(days=dias)
    filas = []
    for sku, v in rec.items():
        if not v['fecha'] or v['fecha'].date() > corte:
            continue
        p = pic.get(sku) or {}
        picados = p.get('pares', 0.0)
        if picados > tope_pares:
            continue
        e = emb.get(sku) or {}
        base = sku.split('-')[0]
        filas.append({
            'sku': sku,
            'desc': v['desc'][:40],
            'marca': rims.get(sku) or rims.get(base) or '',
            'colec': colec.get(sku) or colec.get(base) or '',
            'gen': gen.get(sku) or gen.get(base) or '',
            'origen': v['origen'],
            'asn': v['asn'],
            'lpnEntrada': limpio(v['lpn']),
            'recibido': v['fecha'].strftime('%Y-%m-%d'),
            'dias': (HOY - v['fecha'].date()).days,
            'pares': int(round(v['pares'])),
            'picados': int(round(picados)),
            # Lo que SI se pico, pero a otro canal. Es la diferencia entre "no
            # salio a tienda" y "nadie lo toco".
            'otroCanal': int(round(pic_otro.get(sku, 0.0))),
            'picadoEl': p['ultima'].strftime('%Y-%m-%d %H:%M') if p.get('ultima') else '',
            'lpnPick': p.get('lpn', ''),
            # SIN RESPALDO: si no hay OBLPN, el carton va VACIO. Cayendo al
            # contenedor del pick salian las dos columnas con el mismo valor y
            # parecia un dato cuando era una copia.
            'carton': e.get('carton', ''),
            'uPick': p.get('usuario', ''),
            'uEmb': e.get('usuario', ''),
        })
    filas.sort(key=lambda x: (-x['dias'], -x['pares']))
    return filas

filas = arma(3, 5)
sin_picar = [f for f in filas if f['picados'] == 0]
datos = {
    'fecha': HOY.isoformat(), 'hora': '05:10',
    'dias': 3, 'tope': 5,
    'tarjetas': {
        'skus': len(filas),
        'sinPicar': len(sin_picar),
        # EL NUMERO DURO: ni a tienda ni a ningun otro canal. Nadie lo toco.
        'nadieLoToco': len([f for f in filas
                            if not f['picados'] and not f['otroCanal']]),
        'conPocos': len(filas) - len(sin_picar),
        'paresParados': sum(f['pares'] - f['picados'] for f in filas),
        'masViejo': max(f['dias'] for f in filas) if filas else 0,
    },
    'porOrigen': sorted(collections.Counter(f['origen'] for f in filas).items(),
                        key=lambda x: -x[1]),
    'porMarca': sorted(collections.Counter(f['marca'] or '(sin Maestro)'
                                           for f in filas).items(),
                       key=lambda x: -x[1])[:8],
    'porColeccion': sorted(collections.Counter(f['colec'] or '(sin colección)'
                                               for f in filas).items(),
                           key=lambda x: -x[1])[:8],
    # LOS DOS GRUPOS POR SEPARADO. Guardando solo las 400 primeras por antiguedad
    # salian casi todas de cero picados y el segundo cuadro quedaba vacio.
    # VAN TODAS. Publicando 250 de cada grupo, los cuadros decian "250 SKU" y las
    # tarjetas 1.707 y 296: no cuadraban, y ademas el Excel bajaba una lista
    # recortada sin avisar. Daniel: *"entonces deberia cuadrar con estos
    # reportes"*. Son unos 740 KB, y el area se trae solo al abrir la pestana.
    'filas': filas,
    'total': len(filas),
}
# ── PUBLICAR ────────────────────────────────────────────────────────────────
AREA = 'recibido_sin_picar'
sys.argv = _ARGV

cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
t = datos['tarjetas']
A.log('ASN: %s filas distintas despues de descartar las repetidas'
      % format(len(vistas_asn), ',d'))
A.log('Recibido y sin picar: %s SKU  ·  no salieron a tienda %s  ·  de esos, NADIE '
      'los toco %s  ·  con 5 o menos %s  ·  %s pares parados  ·  el mas viejo %s dias'
      % (format(t['skus'], ',d'), format(t['sinPicar'], ',d'),
         format(t['nadieLoToco'], ',d'), format(t['conPocos'], ',d'),
         format(int(t['paresParados']), ',d'), t['masViejo']))

if '--probar' in sys.argv:
    A.log('MODO PROBAR: no se publica nada. Serian %.0f KB.' % (len(cuerpo) / 1024.0))
    sys.exit(0)

import urllib.request
url = '%s/%s?date=MASTER' % (A.WEB_DATOS_API, AREA)
for intento in range(1, 4):
    try:
        p = urllib.request.Request(url, data=cuerpo, method='POST')
        p.add_header('Content-Type', 'application/json')
        p.add_header('X-Robot-Token', A.ROBOT_TOKEN)
        # `--beta` publica en la base de pruebas, para ensenar una pantalla nueva
        # sin tocar lo que el almacen esta usando.
        if '--beta' in sys.argv:
            p.add_header('X-Environment', 'beta')
        with urllib.request.urlopen(p, timeout=300) as resp:
            json.loads(resp.read().decode('utf-8'))
        A.log('Publicado en %s: %.0f KB' % (AREA, len(cuerpo) / 1024.0))
        break
    except Exception as e:
        if intento < 3:
            A.log('Intento %d: no se pudo publicar (%s), se reintenta'
                  % (intento, type(e).__name__), 'AVISO')
        else:
            A.log('No se pudo publicar: %s: %s' % (type(e).__name__, str(e)[:160]),
                  'ERROR')
            sys.exit(1)
