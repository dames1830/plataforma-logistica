# -*- coding: utf-8 -*-
"""
================================================================================
 FILL RATE DEL CORREO DE COMERCIAL  -  Picking -> Picking por dia, al pie
================================================================================

Daniel, 17-sep-2026: *"todas las fechas en que comercial ha mandado pedidos,
desde julio hasta ayer, expandible: la fecha, las tiendas, los pedidos. Cuanto
solicito segun el correo, cuanto se pico, cuanto se embalo, cuanto esta en
staging y cuanto se despacho, para cerrar todo el ciclo"*. Aprobo la maqueta el
18-sep-2026: *"la maqueta me parece bien, pasalo a beta y de frente a
produccion, en el modulo de picking por dia, abajo"*.

Publica UN area, `fill_rate_correo` (MASTER), con cada guia del correo y sus
cinco numeros. La pantalla (`js/reportes/fill_rate.js`) solo dibuja y suma.

NO TOCA EL WMS. Lee lo que ya bajaron los otros robots:

    scraping Stock/Correos Picking/Guias DD.MM.xlsx     lo que mando comercial
    scraping Stock/Picking/Picking D-M.csv              lo picado (Finalizada)
    scraping Stock/OBLPN Embalaje/OBLPN DD-MM.csv       los bultos, TODOS los dias
    scraping Stock/Detalle Orden/Detalle Orden Pendientes.csv   el tipo de lo no picado

Es el mismo calculo de la maqueta (`scratch/fillrate_correo/fr1_datos.py` y
`fr2_maqueta.py`), pasado a robot sin cambiar una regla. Comprobado guia por guia
contra lo que dibujaba la maqueta antes de publicar.

--------------------------------------------------------------------------------
 LAS REGLAS (las de robot/distribucion.py, que ya estan en produccion)
--------------------------------------------------------------------------------
  - La caja de prepack se abre en pares, tambien en el accesorio (tope 24).
  - PATIO = picado que sigue en un contenedor PRE Empaquetado / En empaquetado.
  - STAGING = bulto real (no PRE) Empaquetado / En empaquetado: embalado y sin cargar.
  - CARGADO = estado Cargado.  DESPACHADO = estado Enviado. EL ESTADO MANDA, NO EL
    NOMBRE: un PRE Enviado salio.
  - EMBALADO = staging + cargado + despachado, y PICADO = patio + embalado.

--------------------------------------------------------------------------------
 LO QUE SE AGREGA
--------------------------------------------------------------------------------
  - LA GUIA CUENTA EN EL PRIMER CORREO donde aparece, y el DOBLE TRAMO no entra
    (el WMS nunca lo abre como orden). SOLICITADO = la suma de sus filas en ese
    correo. CALZADO / NO CALZADO / INSUMOS por la Etiqueta del correo.
  - EL PICK ES LA UNIDAD, NO EL BULTO: (orden, articulo, hora del pick, ubicacion)
    se sigue por todos los bultos donde aparece. Si esta en un bulto real, el PRE
    no cuenta -el PRE a veces queda "Empaquetado" en su ultima foto aunque ya se
    embalo, y contado por bulto el par salia en patio Y en despachado-.
  - SOLID O PREPACK: la guia entera va a lo que mas pares tiene. Del picking; si
    no esta en el picking, de sus bultos; si tampoco, del pendiente del WMS; sin
    nada, SOLID.
  - EL CORREO EN CAJAS: una guia PREPACK cuyo correo coincide con las CAJAS que
    se armaron y no con los pares (la donacion RA01405: 60 en el correo, 60 cajas
    de 8 pares) se pasa a pares con su propia caja.
  - PICADO = el mayor entre el archivo de picking y lo metido en bultos: lo que
    esta en un bulto se pico (las RA de donacion no salen en el picking).

    python fill_rate_correo.py            calcula y publica (produccion y beta)
    python fill_rate_correo.py --probar   calcula y deja el JSON en logs/, sin publicar
"""

import collections
import csv
import datetime
import io
import json
import os
import re
import sys
import time
import traceback

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import publicar_area

csv.field_size_limit(10 ** 9)

AQUI = os.path.dirname(os.path.abspath(__file__))
AREA = 'fill_rate_correo'
# EL PRIMER CORREO DEL REPORTE. Daniel pidio "desde julio"; la guia igual se busca en
# TODOS los correos para saber cual fue su primera vez.
DESDE = '2026-07-01'
TIPOS = ['SOLID', 'PREPACK', 'NO CALZADO', 'INSUMOS']
ETIQ_CLASE = {'CALZADO': 'CALZADO', 'INSUMOS': 'INSUMOS'}      # el resto: NO CALZADO
PARADO = ('Empaquetado', 'En empaquetado')
FORMA_PREPACK = re.compile(r'^\d{7}-\d-\d{5}$')
PROBAR = '--probar' in sys.argv

CARPETA_LOGS = os.path.join(AQUI, 'logs')

# LOS ARCHIVOS QUE NO SE PUDIERON LEER. Un correo, un picking o un OBLPN que no se lee
# no es un dia sin trabajo: es un agujero, y publicar con agujeros da numeros creibles y
# falsos. Si hay alguno, no se publica y el log dice cual. En el servidor la causa tipica
# es OneDrive dejando un archivo "solo en la nube" (Errno 22 corriendo como SYSTEM); se
# arregla anclandolo:  attrib +P -U "<carpeta>\*"
FALLIDOS = []
_ARCHIVO_LOG = os.path.join(CARPETA_LOGS, 'fillrate_%s.log'
                            % datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S'))


def log(msg, nivel=''):
    # `publicar_area.publicar` llama al log con un segundo argumento (ERROR o AVISO).
    linea = '[%s] %s%s' % (datetime.datetime.now().strftime('%H:%M:%S'),
                           (nivel + ' ') if nivel else '', msg)
    print(linea)
    sys.stdout.flush()
    try:
        if not os.path.isdir(CARPETA_LOGS):
            os.makedirs(CARPETA_LOGS)
        with io.open(_ARCHIVO_LOG, 'a', encoding='utf-8') as fh:
            fh.write(linea + '\n')
    except Exception:
        pass


def limpiar_logs(dias=30):
    try:
        corte = time.time() - dias * 86400
        for n in os.listdir(CARPETA_LOGS):
            if n.startswith('fillrate_') and n.endswith('.log'):
                p = os.path.join(CARPETA_LOGS, n)
                if os.path.getmtime(p) < corte:
                    os.remove(p)
    except Exception:
        pass


def base_onedrive():
    """`scraping Stock` de OneDrive. SE BUSCA, NO SE ESCRIBE A MANO: en la laptop el
    usuario es 'dames' y en el servidor 'Administrator', y como tarea puede correr
    como SYSTEM. El perfil de SYSTEM NUNCA es OneDrive aunque tenga una carpeta con
    ese nombre -la carpeta fantasma del 08-sep-2026, ver distribucion.py-."""
    for c in (os.environ.get('OneDrive'), os.environ.get('OneDriveCommercial'),
              os.path.join(os.path.expanduser('~'), 'OneDrive'),
              os.path.join('C:', os.sep, 'Users', 'Administrator', 'OneDrive'),
              os.path.join('C:', os.sep, 'Users', 'dames', 'OneDrive')):
        if not c or 'systemprofile' in c.lower():
            continue
        ruta = os.path.join(c, 'danielames.bata', 'scraping Stock')
        if os.path.isdir(ruta):
            return ruta
    return None


def L(v):
    """El WMS exporta envuelto como formula: ="7997215". Se limpia en un solo sitio."""
    s = str(v if v is not None else '').strip()
    if s.startswith('="') and s.endswith('"'):
        s = s[2:-1]
    return s.strip()


def num(v):
    try:
        return float(str(v).replace(',', '.'))
    except Exception:
        return 0.0


def cuando(s):
    try:
        return datetime.datetime.strptime(str(s).strip(), '%d/%m/%Y %H:%M:%S')
    except Exception:
        return None


def pares_de_la_caja(sku):
    """Cuantos pares trae una caja de prepack: los dos primeros digitos del sufijo de
    cinco (5614468-1-06006 son 6). El suelto y lo que no tiene esa forma valen 1."""
    s = str(sku or '').strip()
    if not FORMA_PREPACK.match(s):
        return 1
    try:
        n = int(s[-5:][:2])
    except ValueError:
        return 1
    return n if 0 < n <= 24 else 1


def iso(mes, dia):
    """El correo y el OBLPN traen dia y mes, sin año. Va el de hoy, salvo que la
    fecha caiga mas de un mes adelante: eso es de diciembre leido en enero."""
    hoy = datetime.date.today()
    try:
        f = datetime.date(hoy.year, mes, dia)
    except ValueError:
        return None
    if f > hoy + datetime.timedelta(days=31):
        f = datetime.date(hoy.year - 1, mes, dia)
    return f.isoformat()


# ══ 1. LAS GUIAS DE CADA CORREO ══════════════════════════════════════════════

def fecha_del_correo(nombre):
    """`Guias 15.07.xlsx` y `Guias 15-06.xlsx`: mismo formato, distinto separador."""
    m = re.search(r'(\d{2})[.\-](\d{2})(?!\d)', nombre)
    if not m:
        return None
    dia, mes = int(m.group(1)), int(m.group(2))
    if not (1 <= dia <= 31 and 1 <= mes <= 12):
        return None
    return iso(mes, dia)


def limpio_correo(v):
    if v is None:
        return ''
    s = str(v).strip()
    if s.startswith('="') and s.endswith('"'):
        s = s[2:-1]
    if s.endswith('.0'):
        s = s[:-2]
    return s.strip()


def leer_correos(base):
    """Todas las filas de todos los correos. LA HOJA BUENA NO ES SIEMPRE LA PRIMERA:
    se busca la que trae la columna GUIA (`Guias 07.07.xlsx` la trae en la segunda)."""
    carpeta = os.path.join(base, 'Correos Picking')
    archivos = sorted((fecha_del_correo(n), n) for n in os.listdir(carpeta)
                      if n.lower().endswith('.xlsx') and not n.startswith('~$')
                      and fecha_del_correo(n))

    def col(cab, *nombres):
        for n in nombres:
            for i, c in enumerate(cab):
                if c.upper().startswith(n.upper()):
                    return i
        return None

    filas, leidos = [], 0
    for fecha, nombre in archivos:
        try:
            wb = openpyxl.load_workbook(os.path.join(carpeta, nombre), read_only=True, data_only=True)
        except Exception as e:
            log('No se pudo abrir %s (%s: %s)' % (nombre, type(e).__name__, str(e)[:80]), 'ERROR')
            FALLIDOS.append(nombre)
            continue
        ok = False
        for ws in wb.worksheets:
            it = ws.iter_rows(values_only=True)
            try:
                cab = [str(c).strip() if c is not None else '' for c in next(it)]
            except StopIteration:
                continue
            if 'GUIA' not in cab:
                continue
            ig = cab.index('GUIA')
            iq = next((i for i, c in enumerate(cab) if 'CANTI' in c.upper()), None)
            ip, ie = col(cab, 'Prioridad'), col(cab, 'Etiqueta')
            it_, inm = col(cab, 'TIEND'), col(cab, 'NOMBR')
            for r in it:
                g = limpio_correo(r[ig] if ig < len(r) else None)
                if not g:
                    continue
                try:
                    q = float(str(r[iq]).replace(',', '') or 0)
                except Exception:
                    q = 0.0

                def v(i):
                    return '' if i is None or i >= len(r) or r[i] is None else str(r[i]).strip()
                filas.append({'fecha': fecha, 'archivo': nombre, 'tienda': limpio_correo(v(it_)),
                              'nombre': v(inm), 'prioridad': v(ip).upper(),
                              'etiqueta': v(ie).upper(), 'guia': g, 'cantidad': q})
            ok = True
            break
        wb.close()
        leidos += ok
    if leidos < len(archivos):
        log('Se reconocieron %d de %d correos. Revisar los nombres.' % (leidos, len(archivos)), 'AVISO')
    return filas, leidos


def armar_guias(correos, hasta):
    """Una guia, un lugar: la PRIMERA vez que aparece. Sin DOBLE TRAMO.

    LA PRIMERA VEZ ES UN ARCHIVO, NO SOLO UNA FECHA. Desde el 18-sep-2026 un dia puede
    traer dos correos -el de siempre y el de una tienda nueva, como "B CARAZ guias
    17.09"-, y si el mismo archivo quedara guardado dos veces con distinto nombre, sumar
    las filas de los dos le doblaria lo solicitado a esa guia. Cuenta el primer archivo
    donde aparece (por fecha y despues por nombre); con un archivo por dia da lo mismo
    que la maqueta."""
    primera = {}
    for r in sorted(correos, key=lambda x: (x['fecha'], x['archivo'])):
        primera.setdefault(r['guia'], (r['fecha'], r['archivo']))
    guias = {}
    for r in correos:
        if (r['fecha'], r['archivo']) != primera[r['guia']] or not (DESDE <= r['fecha'] <= hasta):
            continue
        if r['prioridad'] == 'DOBLE TRAMO':
            continue
        g = guias.setdefault(r['guia'], {'fecha': r['fecha'], 'tienda': r['tienda'],
                                         'nombre': r['nombre'], 'etiqueta': r['etiqueta'],
                                         'prioridad': r['prioridad'], 'sol': 0.0})
        g['sol'] += r['cantidad']
        if r['etiqueta'] != g['etiqueta']:
            log('La guia %s trae dos etiquetas (%s y %s)' % (r['guia'], g['etiqueta'], r['etiqueta']), 'AVISO')
    for g in guias.values():
        g['clase'] = ETIQ_CLASE.get(g['etiqueta'], 'NO CALZADO')
    return guias


# ══ 2. LO PICADO ═════════════════════════════════════════════════════════════

NECESARIAS = ['Número de orden', 'Estado', 'Código de artículo', 'Cantidad empaquetada',
              'Hora de selección', 'Cantidad de orden original']


def leer_picking(base, guias):
    """Las lineas Finalizada de las guias del correo, de TODOS los archivos de picking."""
    carpeta = os.path.join(base, 'Picking')
    picado, picado_pp = collections.defaultdict(float), collections.defaultdict(float)
    # LO QUE PEDIA LA ORDEN, por (orden, articulo). `Cantidad de orden original` SE REPITE
    # en cada linea del mismo articulo -una por ubicacion, una por dia-: se toma una vez,
    # con max, que es la regla de distribucion.py. El prepack viene en cajas: a pares.
    orden_wms = {}
    pk_art = collections.defaultdict(float)
    ult, leidos = None, 0
    for n in sorted(x for x in os.listdir(carpeta) if x.lower().endswith('.csv')):
        try:
            with io.open(os.path.join(carpeta, n), encoding='utf-8-sig', newline='', errors='replace') as f:
                cabeza = f.read(4000)
                f.seek(0)
                sep = ';' if cabeza.count(';') > cabeza.count(',') else ','
                rd = csv.reader(f, delimiter=sep)
                cab = [c.strip() for c in next(rd)]
                ix = {c: i for i, c in enumerate(cab)}
                falta = [c for c in NECESARIAS if c not in ix]
                if falta:
                    log('%s: faltan columnas %s' % (n, falta), 'AVISO')
                    continue
                iO, iE, iA, iQ, iH, iOr = (ix[c] for c in NECESARIAS)
                for r in rd:
                    if len(r) < len(cab) or r[iE].strip() != 'Finalizada':
                        continue
                    o = L(r[iO]).strip('"').strip()
                    if o not in guias:
                        continue
                    sku = L(r[iA]).strip('"').strip()
                    k = (o, sku)
                    pk_art[k] += num(r[iQ]) * pares_de_la_caja(sku)
                    orden_wms[k] = max(orden_wms.get(k, 0.0), num(r[iOr]) * pares_de_la_caja(sku))
                    h = cuando(r[iH])
                    if h and (ult is None or h > ult):
                        ult = h
            leidos += 1
        except StopIteration:
            log('%s: esta vacio' % n, 'AVISO')
        except OSError as e:
            log('%s: no se pudo leer (%s: %s)' % (n, type(e).__name__, str(e)[:80]), 'ERROR')
            FALLIDOS.append(n)
    # UN ARTICULO NO SE PICA MAS DE LO QUE PEDIA LA ORDEN. Daniel, 18-sep-2026, al barrer
    # los pedidos que pasaban del 100%: el picking a veces anota el mismo pick dos veces -en
    # el coche PRE y en la caja, o un re-pick de lo mismo- y la guia 8007205 sumaba 137
    # pares de una orden de 135. Por articulo, lo picado se corta en lo que pedia la orden.
    for k, p in pk_art.items():
        o, sku = k
        pedia = orden_wms.get(k, 0.0)
        q = min(p, pedia) if pedia > 0 else p
        picado[o] += q
        if pares_de_la_caja(sku) > 1:
            picado_pp[o] += q
    por_orden = collections.defaultdict(float)
    for (o, sku), q in orden_wms.items():
        por_orden[o] += q
    return picado, picado_pp, ult, leidos, por_orden, orden_wms


# ══ 2b. EL TIPO DE LO QUE TODAVIA NO SE PICO ═════════════════════════════════

def leer_pendientes(base, sin_pick):
    """Del pendiente del WMS, cuantos pares de cada guia son prepack."""
    pend_pp, pend_tot = collections.defaultdict(float), collections.defaultdict(float)
    ruta = os.path.join(base, 'Detalle Orden', 'Detalle Orden Pendientes.csv')
    if not sin_pick or not os.path.isfile(ruta):
        return pend_pp, pend_tot
    try:
        fh = io.open(ruta, encoding='utf-8-sig', newline='', errors='replace')
    except OSError as e:
        log('Detalle Orden Pendientes.csv: no se pudo leer (%s: %s)' % (type(e).__name__, str(e)[:80]), 'ERROR')
        FALLIDOS.append('Detalle Orden Pendientes.csv')
        return pend_pp, pend_tot
    with fh:
        rd = csv.reader(fh, delimiter=';')
        cab = [c.strip() for c in next(rd)]
        ix = {c: i for i, c in enumerate(cab)}
        iO, iA, iQ = ix['Número de orden'], ix['Código de artículo'], ix['Cantidad solicitada']
        for r in rd:
            if len(r) <= max(iO, iA, iQ):
                continue
            o = L(r[iO])
            if o not in sin_pick:
                continue
            sku = L(r[iA])
            q = num(r[iQ]) * pares_de_la_caja(sku)
            pend_tot[o] += q
            if pares_de_la_caja(sku) > 1:
                pend_pp[o] += q
    return pend_pp, pend_tot


# ══ 3. EL OBLPN: LA ULTIMA FOTO DE CADA PICK ═════════════════════════════════

def leer_oblpn(base, guias, topes):
    carpeta = os.path.join(base, 'OBLPN Embalaje')
    archivos = []
    for n in os.listdir(carpeta):
        m = re.match(r'^OBLPN (\d{2})-(\d{2})\.csv$', n)
        if m:
            f = iso(int(m.group(2)), int(m.group(1)))
            if f and f >= DESDE:
                archivos.append((f, n))
    archivos.sort()
    # pick -> lpn -> (momento, estado, pares, es_pre, cajas, es_prepack)
    picks = collections.defaultdict(dict)
    for f, n in archivos:
        vistas = set()
        try:
            fh = io.open(os.path.join(carpeta, n), encoding='utf-8-sig', newline='', errors='replace')
        except OSError as e:
            log('%s: no se pudo leer (%s: %s)' % (n, type(e).__name__, str(e)[:80]), 'ERROR')
            FALLIDOS.append(n)
            continue
        with fh:
            rd = csv.reader(fh, delimiter=';')
            cab = [c.strip() for c in next(rd)]
            ix = {c: i for i, c in enumerate(cab)}
            iO, iL, iC = ix['Número de orden'], ix['Número de LPN'], ix['Código de artículo']
            iE, iQ = ix['Estado de LPN'], ix['Cantidad empaquetada']
            iDP, iU = ix['Detail Picked Time'], ix['Ubicación de selección']
            iM = ix['Registro de hora de modificación de LPN']
            tope = max(iO, iL, iC, iE, iQ, iDP, iU, iM)
            for r in rd:
                if len(r) <= tope:
                    continue
                o = L(r[iO])
                if o not in guias:
                    continue
                lpn, c = L(r[iL]), L(r[iC])
                dp = r[iDP].strip()
                # UN ARTICULO DE UN BULTO VIENE EN DOS FILAS si se pico dos veces (misma
                # hora de empaquetado, distinta hora de pick): son pares distintos.
                pick = (o, c, dp, L(r[iU])) if dp else (o, c, '', L(r[iU]), lpn)
                if (pick, lpn) in vistas:
                    continue
                vistas.add((pick, lpn))
                momento = (f, cuando(r[iM]) or datetime.datetime.min)
                prev = picks[pick].get(lpn)
                if prev is None or momento >= prev[0]:
                    caja = pares_de_la_caja(c)
                    picks[pick][lpn] = (momento, r[iE].strip(), num(r[iQ]) * caja,
                                        lpn.startswith('PRE'), num(r[iQ]), caja > 1)
    # UN ARTICULO NO SE EMBALA MAS DE LO QUE PEDIA LA ORDEN. El mismo pick aparece a veces
    # en dos bultos reales vivos: la guia 7999159 tenia 1 unidad y figuraba en el bulto
    # 508004072676 y otra vez como 508004072676-26747924, los dos Enviado. Por articulo se
    # toma primero la foto mas nueva y se corta en lo que pedia la orden (`topes`, del
    # picking); lo que no esta en el picking -las RA de donacion- no tiene tope.
    por_art = collections.defaultdict(list)
    for pick, por_lpn in picks.items():
        vivos = [x for x in por_lpn.values() if x[1] != 'Cancelado' and x[2] > 0]
        reales = [x for x in vivos if not x[3]]
        por_art[(pick[0], pick[1])].extend(reales if reales else vivos)
    est = collections.defaultdict(collections.Counter)
    otros = collections.Counter()
    for (o, c), xs in por_art.items():
        resto = topes.get((o, c)) or float('inf')
        for momento, e, p, pre, cajas, es_pp in sorted(xs, key=lambda x: x[0], reverse=True):
            if resto <= 0:
                break
            usar = min(p, resto)
            resto -= usar
            est[o]['tot'] += usar
            if es_pp:
                est[o]['pp_pares'] += usar
                est[o]['pp_cajas'] += cajas * usar / p
            if e == 'Enviado':
                est[o]['desp'] += usar
            elif e == 'Cargado':
                est[o]['carg'] += usar
            elif e in PARADO:
                est[o]['patio' if pre else 'stag'] += usar
            else:
                otros[e] += usar
    if otros:
        log('Estados del OBLPN sin columna: %s' % dict(otros), 'AVISO')
    return est, (archivos[-1][0] if archivos else None), len(archivos), len(picks)


# ══ 4. TODO JUNTO ════════════════════════════════════════════════════════════

def calcular(base):
    t0 = time.time()
    correos, leidos = leer_correos(base)
    hasta = max((r['fecha'] for r in correos), default=DESDE)
    guias = armar_guias(correos, hasta)
    log('Correos: %d archivos, %d guias del %s al %s (%.0f s)'
        % (leidos, len(guias), DESDE, hasta, time.time() - t0))

    picado, picado_pp, ult_pick, n_pick, orden_wms, orden_art = leer_picking(base, guias)
    log('Picking: %d archivos, %d guias con picking, ultimo pick %s (%.0f s)'
        % (n_pick, len(picado), ult_pick, time.time() - t0))

    sin_pick = {gid for gid, g in guias.items() if g['clase'] == 'CALZADO' and not picado.get(gid)}
    pend_pp, pend_tot = leer_pendientes(base, sin_pick)

    est, ultimo_oblpn, n_oblpn, n_picks = leer_oblpn(base, guias, orden_art)
    log('OBLPN: %d archivos hasta el %s, %d picks seguidos (%.0f s)'
        % (n_oblpn, ultimo_oblpn, n_picks, time.time() - t0))

    # SOLID O PREPACK: del picking, si no de los bultos, si no del pendiente; sin nada, SOLID.
    origen = collections.Counter()
    for gid, g in guias.items():
        if g['clase'] != 'CALZADO':
            g['tipo'] = g['clase']
            continue
        e = est.get(gid, {})
        if picado.get(gid):
            pp, tt, de = picado_pp.get(gid, 0.0), picado[gid], 'picking'
        elif e.get('tot'):
            pp, tt, de = e.get('pp_pares', 0.0), e['tot'], 'oblpn'
        elif pend_tot.get(gid):
            pp, tt, de = pend_pp.get(gid, 0.0), pend_tot[gid], 'pendiente'
        else:
            pp, tt, de = 0.0, 0.0, 'sin dato'
        g['tipo'] = 'PREPACK' if tt and pp * 2 >= tt else 'SOLID'
        origen[(de, g['tipo'])] += 1
    log('Solid o prepack, de donde sale: %s'
        % ', '.join('%s %s %d' % (k[0], k[1], n) for k, n in sorted(origen.items())))

    # EL CORREO EN CAJAS: la guia prepack cuyo correo dice las cajas y no los pares.
    for gid, g in guias.items():
        if g['tipo'] != 'PREPACK' or not g['sol']:
            continue
        e = est.get(gid, {})
        pp_pares, pp_cajas = e.get('pp_pares', 0.0), e.get('pp_cajas', 0.0)
        if pp_cajas and pp_pares / g['sol'] >= 3 and pp_cajas <= g['sol'] * 1.2:
            factor = pp_pares / pp_cajas
            log('Correo en cajas: %s %s, %s cajas de %.1f pares' % (gid, g['nombre'], g['sol'], factor))
            g['sol'] = g['sol'] * factor

    # EL CORREO QUE DICE MENOS DE LO QUE TRAIA LA ORDEN. Daniel, 18-sep-2026, viendo la guia
    # 8000069 de B3 Chorrillos al 550%: el correo del 26-08 dice 200, pero la orden del WMS
    # nacio el 19-08 con 1,100 bolsas de e-commerce -700 grandes, 200 medianas y 200 chicas-
    # y el CD pico las tres lineas enteras. El CD pica la orden, no el numero del correo:
    # lo solicitado es lo que pedia la orden. Se mide con `Cantidad de orden original` del
    # picking. Al 18-sep le pasaba a 1 guia de 23.399 con picking.
    for gid, g in guias.items():
        pedia = orden_wms.get(gid, 0.0)
        if pedia > g['sol']:
            log('La orden trae mas que el correo: %s %s %s, correo %s, orden %s'
                % (gid, g['tienda'], g['nombre'], g['sol'], pedia))
            g['sol'] = pedia

    # ── lo que viaja a la pantalla, compacto ──
    tiendas, prioridades, ti, pi = [], [], {}, {}
    por_fecha = collections.defaultdict(lambda: collections.defaultdict(list))
    tot = collections.defaultdict(collections.Counter)
    ajustadas = 0
    for gid, g in guias.items():
        # LA Ñ DE ALGUNOS CORREOS viene en otra codificacion: "BRE¥A", "CA¥ETE". Sin
        # esto la misma tienda sale en dos filas.
        nombre = ('%s %s' % (g['tienda'], g['nombre'])).strip() \
            .replace('¥', 'Ñ').replace('¤', 'ñ') or '(sin tienda)'
        if nombre not in ti:
            ti[nombre] = len(tiendas)
            tiendas.append(nombre)
        if g['prioridad'] not in pi:
            pi[g['prioridad']] = len(prioridades)
            prioridades.append(g['prioridad'])
        e = est.get(gid, {})
        sol = int(round(g['sol']))
        pic0 = int(round(picado.get(gid, 0.0)))
        patio, stag = int(round(e.get('patio', 0))), int(round(e.get('stag', 0)))
        carg, desp = int(round(e.get('carg', 0))), int(round(e.get('desp', 0)))
        emb = stag + carg + desp
        pic = max(pic0, emb + patio)
        ajustadas += pic != pic0
        por_fecha[g['fecha']][ti[nombre]].append([gid, pi[g['prioridad']], TIPOS.index(g['tipo']),
                                                  sol, pic, stag, carg, desp])
        t = tot[g['clase']]
        t['sol'] += sol
        t['pic'] += pic
        t['emb'] += emb
        t['desp'] += desp
    fechas = []
    for f in sorted(por_fecha, reverse=True):
        fechas.append([f, [[t, sorted(gs, key=lambda x: -x[3])] for t, gs in por_fecha[f].items()]])
    for c in ('CALZADO', 'NO CALZADO', 'INSUMOS'):
        t = tot[c]
        if t['sol']:
            log('%-10s solicitado %9d  picado %5.1f%%  embalado %5.1f%%  despachado %5.1f%%'
                % (c, t['sol'], 100.0 * t['pic'] / t['sol'], 100.0 * t['emb'] / t['sol'],
                   100.0 * t['desp'] / t['sol']))
    log('Picado ajustado con los bultos en %d guias' % ajustadas)

    ahora = datetime.datetime.now()
    datos = {'desde': DESDE, 'hasta': hasta, 'tipos': TIPOS, 't': tiendas, 'p': prioridades,
             'f': fechas, 'guias': len(guias),
             'generado': ahora.strftime('%Y-%m-%d %H:%M'),
             'ultimo_oblpn': ultimo_oblpn,
             'ultimo_pick': ult_pick.strftime('%Y-%m-%d %H:%M') if ult_pick else None}
    return datos, tot


def main():
    limpiar_logs()
    log('=' * 70)
    log('FILL RATE DEL CORREO DE COMERCIAL%s' % ('  (PRUEBA: no se publica)' if PROBAR else ''))
    base = base_onedrive()
    if not base:
        log('No se encontro la carpeta "scraping Stock" de OneDrive.', 'ERROR')
        return 1
    log('Lee de: %s' % base)
    datos, tot = calcular(base)
    if FALLIDOS:
        log('No se publica: %d archivo(s) no se pudieron leer y los numeros saldrian con '
            'agujeros: %s' % (len(FALLIDOS), ', '.join(FALLIDOS[:12])), 'ERROR')
        return 1

    # UN CUADRO VACIO NO SE PUBLICA: pisaria el bueno. Este almacen nunca tiene cero
    # guias ni cero picado en dos meses y medio de correos.
    sol = sum(t['sol'] for t in tot.values())
    pic = sum(t['pic'] for t in tot.values())
    if not datos['f'] or not sol or not pic:
        log('No se publica: %d correos, solicitado %d, picado %d. Algo no se leyo.'
            % (len(datos['f']), sol, pic), 'ERROR')
        return 1

    cuerpo = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    log('Listo para publicar: %d correos, %d tiendas, %d guias, %.0f KB'
        % (len(datos['f']), len(datos['t']), datos['guias'], len(cuerpo.encode('utf-8')) / 1024.0))
    if PROBAR:
        ruta = os.path.join(CARPETA_LOGS, AREA + '.json')
        with io.open(ruta, 'w', encoding='utf-8') as fh:
            fh.write(cuerpo)
        log('PRUEBA: quedo en %s, no se publico nada.' % ruta)
        return 0
    if not publicar_area.publicar(AREA, datos, 'MASTER', log):
        return 1
    log('LISTO')
    return 0


if __name__ == '__main__':
    try:
        codigo = main()
    except SystemExit as e:
        codigo = e.code
        if isinstance(codigo, str):
            log(codigo, 'ERROR')
            codigo = 1
    except Exception:
        log('SE CAYO SIN AVISAR:', 'ERROR')
        for linea in traceback.format_exc().rstrip().splitlines():
            log('   ' + linea, 'ERROR')
        codigo = 1
    sys.exit(codigo)
