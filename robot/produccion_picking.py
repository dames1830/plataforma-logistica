# -*- coding: utf-8 -*-
"""
ROBOT: el cuadro de PICKING POR DIA (persona x hora, canal y efectividad)

Va ENGANCHADO DETRAS del robot que ya baja el archivo de picking del WMS cada 2 horas
-`ejecutar_picking_hora.bat`-, asi que NO entra al WMS ni descarga nada: lee el archivo
que ese acaba de dejar y publica el cuadro. Daniel, 02-sep-2026: *"ese picking por
hora es el que tienes que agarrar para el modulo de picking dia"*.

Por eso no pide turno al candado del WMS y no puede chocar con ninguna otra
corrida: lo unico que hace es leer un CSV de OneDrive y mandar un JSON.

SE LLAMA `produccion_picking.py` Y NO `picking_por_hora.py` A PROPOSITO: en el servidor ya
existe un `picking_por_hora.py` -el que baja del WMS-, y dos archivos con el
mismo nombre en la carpeta del robot se pisan. El AREA de la plataforma si se llama
`picking_por_hora`, que es lo que leen las pantallas.

Publica en el area `picking_por_hora`, fechada con el DIA DEL ARCHIVO -no con la
fecha de hoy-: el ultimo pase del dia es a las 20:20 y con la hora de la maquina
quedaria estampado el dia siguiente.

PERSONA x HORA DEL PICKING: volumen, efectividad y CANAL.

SIN LA EQUIVALENCIA DEL PREPACK. Daniel, 01-sep-2026: *"no quiero que utilices
la equivalencia del prepack todavia, eso todavia lo veo por comite"*. El suelto y
el prepack se miden POR SEPARADO, cada uno con sus propias lineas y su tiempo.

EL RITMO NO ES EL VOLUMEN. A quien le dan nueve tareas pica mas que quien recibio
una, y eso no dice quien es mas rapido. La efectividad divide los pares por el
tiempo que esa persona estuvo trabajando EN ESA CLASE -ver `tiempo_de_cada_par`-,
asi que no depende de cuanto trabajo le tocara.

EL CANAL, con la regla que valido Daniel el 01-sep-2026:
  · SI EL DESTINO ESTA EN EL MAESTRO DE RUTAS, ES TIENDA RETAIL. Sale del propio
    archivo de picking -`Instalacion de destino`-, sin cruzar nada, y cubre el
    100% de las lineas. El codigo pega TAL CUAL: el "50 delante" es para el
    `TIEND` del correo de comercial, no para esto.
  · SI NO ESTA, el canal fino sale del `Tipo de orden` del Detalle de Orden.
    Medido el 31-08: las dos formas coinciden en 99,4%, y donde no coinciden gana
    el maestro de rutas -las 68 lineas sin canal SI eran tienda-.
  · Cada canal que no es tienda tiene su destino fijo: 91891 catalogo, 91890
    tienda virtual, 93173/92458 ecommerce, 81439 industrial, 0019620xx mayorista.

EL CANAL FINO NECESITA TRES FUENTES. `Detalle Orden DD-MM.csv` trae las ordenes
NACIDAS ese dia, no las picadas: pegaba 171 de 1.166. Juntando Pendientes +
Despachados + los diarios se llega al 99,4%.

LAS CUATRO TRAMPAS DEL ARCHIVO, iguales a js/reportes/picking.js:
  1. Estado 'Cancelado' es una COPIA de la linea buena. Solo cuenta 'Finalizada'.
  2. No todo lo que sale son pares: lo corta el Maestro con G. Gender=Footwear.
  3. El prepack cuenta CAJAS: los pares salen de la curva del propio SKU.
  4. El dia sale del CONTENIDO, no del nombre del archivo.
"""
import csv
import io
import json
import os
import re
import shutil
import sys
from collections import defaultdict

import openpyxl

import maestro_web

csv.field_size_limit(10 ** 7)

FORMA_PREPACK = re.compile(r'^\d{7}-\d-\d{5}$')
# LAS VEINTICUATRO HORAS, no solo el turno.
#
# Estaba en 8..19 y lo que se movia fuera de ahi se contaba en el total pero NO
# tenia columna donde aparecer: el 28-ago quedaron 275 lineas de picking y 217 de
# embalaje sin fila que las mostrara, y la suma de las horas no daba el total.
#
# Daniel, 02-sep-2026: *"el noventa y cinco por ciento se mueve entre ocho de la
# manana y las siete de la noche, pero hay un minimo que se mueve en la madrugada.
# Necesito las veinticuatro horas"*.
#
# La pantalla no dibuja las 24 siempre: muestra el turno completo y agrega solo
# las horas de afuera que ese dia tuvieron movimiento.
HORAS = list(range(0, 24))
CL = ('cal_suelto', 'cal_prepack', 'no_cal', 'materiales', 'sin_tipo')
TODOS = 'TODOS'
ORDEN_CANAL = ['RETAIL', 'MAYORISTA', 'CATALOGO', 'ECOMMERCE', 'INDUSTRIAL',
               'OTROS', 'SIN CANAL']

# CON DOS PICKS NO SE MIDE UN RITMO, y tampoco alcanza con contar lineas:
# karteaga cerro 37 lineas en 36 SEGUNDOS el 31-08 y salia primero con 4.667
# lineas/hora. Eso no es alguien picando, es una confirmacion en bloque del WMS.
LINEAS_MIN_CELDA = 8
LINEAS_MIN_DIA = 20
SEG_MIN_CELDA = 5 * 60
SEG_MIN_DIA = 15 * 60
SEG_LINEA_MIN = 5
SEG_MUESTRA_CORTA = 60 * 60
# LA PAUSA Y EL REFRIGERIO, con los numeros de Daniel (17-sep-2026): menos de 30
# minutos sin picar es trabajo; 30 o mas es el refrigerio, y se descuentan hasta 60
# minutos en el dia. Ver `tiempo_de_cada_par`.
PAUSA_SEG = 30 * 60
REFRIGERIO_SEG = 60 * 60


def base_onedrive():
    for c in (os.environ.get('OneDrive'),
              'C:' + os.sep + os.path.join('Users', 'Administrator', 'OneDrive'),
              'C:' + os.sep + os.path.join('Users', 'dames', 'OneDrive')):
        if c:
            r = os.path.join(c, 'danielames.bata', 'scraping Stock')
            if os.path.isdir(r):
                return r
    raise SystemExit('no encuentro OneDrive')


def dia_pedido():
    """El dia que vino por `--dia AAAA-MM-DD`, o None.

    EN EL RELLENO EL DIA LO MANDA QUIEN LLAMA. Los archivos viejos del OBLPN
    mezclan hasta doce fechas —el WMS mete lineas empaquetadas antes— y la
    mayoria no siempre es la del archivo: el `OBLPN 01-08.csv` daba 30 de julio.
    El que rellena si sabe de que dia es cada archivo, porque lo dice el nombre.

    En la corrida normal de cada 2 horas no se pasa nada y sigue mandando la
    mayoria de las filas, que ahi es lo correcto.
    """
    a = sys.argv[1:]
    if '--dia' in a:
        i = a.index('--dia')
        if len(a) > i + 1 and re.match(r'^\d{4}-\d{2}-\d{2}$', a[i + 1]):
            return a[i + 1]
    return None


def dia_mayoritario(ruta, columna):
    """EL DIA DEL ARCHIVO ES EL DE LA MAYORIA DE SUS FILAS, no el de la primera.

    Salia de la primera fila con hora valida, y eso es fragil: el OBLPN del
    01-09 traia arriba una linea empaquetada el 31-08 y el cuadro entero quedo
    fechado el 31, tirando las 39.000 filas del dia bueno a `sin hora`. Se vio el
    02-sep-2026 en la primera corrida del robot.

    Se cuenta con una pasada liviana -solo esa columna, sin armar diccionarios-
    y gana la fecha que mas veces aparece. Devuelve AAAA-MM-DD, o None si el
    archivo no tiene ni una fecha legible.
    """
    from collections import Counter
    try:
        f = io.open(ruta, encoding='utf-8-sig', newline='', errors='replace')
        cabeza = f.read(4000)
        f.seek(0)
        r = csv.reader(f, delimiter=';' if cabeza.count(';') > cabeza.count(',') else ',')
        cab = [c.strip() for c in next(r)]
        try:
            i = cab.index(columna)
        except ValueError:
            f.close()
            return None
        cuenta = Counter()
        for x in r:
            if i < len(x):
                mm = re.match(r'^(\d{2})/(\d{2})/(\d{4})\s', str(x[i]).strip().strip('"'))
                if mm:
                    cuenta['%s-%s-%s' % (mm.group(3), mm.group(2), mm.group(1))] += 1
        f.close()
        if not cuenta:
            return None
        gana, veces = cuenta.most_common(1)[0]
        if len(cuenta) > 1:
            print('[AVISO] el archivo mezcla %d fechas; gana %s con %d filas de %d'
                  % (len(cuenta), gana, veces, sum(cuenta.values())))
        return gana
    except Exception as e:
        print('[AVISO] no se pudo mirar la fecha del archivo: %s' % e)
        return None


def elegir_archivo(carpetas, plantillas):
    """QUE ARCHIVO LE TOCA A ESTA CORRIDA.

    Se puede pasar el nombre a mano -util para rehacer un dia viejo-. Sin eso,
    se busca el de HOY, que es el que el robot de la hora acaba de dejar.

    EL NOMBRE DEL DIA NO ES UNO SOLO: el picking lo escribe sin cero adelante
    ("Picking 3-9.csv") y el OBLPN con cero ("OBLPN 03-09.csv"). Se prueban las
    dos formas antes de rendirse.

    Si el de hoy no esta -el WMS no contesto, o es de madrugada y todavia no
    corrio ningun pase- se toma EL MAS NUEVO de la carpeta y se avisa. Es mejor
    republicar el cuadro de ayer que dejar la pantalla sin nada.
    """
    if isinstance(carpetas, str):
        carpetas = [carpetas]
    if len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        for c in carpetas:
            r = os.path.join(c, sys.argv[1])
            if os.path.isfile(r):
                return r
        return os.path.join(carpetas[0], sys.argv[1])
    hoy = __import__('datetime').datetime.now()
    for c in carpetas:
        for pl in plantillas:
            r = os.path.join(c, pl % (hoy.day, hoy.month))
            if os.path.isfile(r):
                return r
    cand = []
    for c in carpetas:
        try:
            cand += [os.path.join(c, n) for n in os.listdir(c)
                     if n.lower().endswith('.csv')]
        except Exception:
            pass
    if cand:
        nuevo = max(cand, key=os.path.getmtime)
        print('[AVISO] no hay archivo de hoy; se usa el mas nuevo: %s'
              % os.path.basename(nuevo))
        return nuevo
    return os.path.join(carpetas[0], plantillas[0] % (hoy.day, hoy.month))

BASE = base_onedrive()
# PRIMERO LA COPIA DEL ROBOT DE LA HORA, DESPUES LA DE ONEDRIVE.
#
# `picking_por_hora.py` baja el picking del dia cada 2 horas y deja una copia en
# `logs\picking_hora`. Esa es la de HOY y la que hay que mirar.
#
# La carpeta de OneDrive la escribe otro robot -el de las 19:20- y trae el
# picking de AYER: sirve de respaldo, para que la pantalla no quede vacia si el
# pase de la hora no salio, pero no es la primera opcion.
ARCHIVO = elegir_archivo(
    [os.path.join('C:' + os.sep, 'wms_scraping', 'logs', 'picking_hora'),
     os.path.join(BASE, 'Picking')],
    ['Picking %d-%d.csv', 'Picking %02d-%02d.csv'])
CARPETA_ORD = os.path.join(BASE, 'Detalle Orden')
RUTAS_CAND = [os.path.join(os.path.dirname(BASE), 'Proyecto web Logistico',
                           'RUTAS -  TURNOS.xlsx'),
              os.path.join('C:' + os.sep, 'wms_scraping', '_rutas.xlsx')]
# EL AREA Y EL ARCHIVO SON LO MISMO, escrito una sola vez. Estuvieron sueltos y
# el robot de embalaje quedo escribiendo en el JSON del picking: el cruce comparo
# el web report de picking contra los numeros del embalaje y dio 3.480 de
# diferencia sin que nada pareciera roto.
AREA = 'picking_por_hora'
SALIDA = os.path.join('C:' + os.sep, 'wms_scraping', 'logs', AREA + '.json')


def limpio(v):
    s = str(v if v is not None else '').strip()
    if s.startswith('="') and s.endswith('"'):
        s = s[2:-1].strip()
    return s.strip('"').strip()


def entero(v):
    try:
        return int(float(str(v).replace(',', '.')))
    except (TypeError, ValueError):
        return 0


def es_prepack(sku):
    return bool(FORMA_PREPACK.match(str(sku or '').strip()))


# ── LOS TIPOS QUE PIDIO DANIEL ───────────────────────────────────────────────
#
# Daniel, 02-sep-2026: *"solamente calzado y no calzado. En no calzado entra todo
# lo que son bolsas, etiquetas, etcetera"*. Y aparte, para lo que el Maestro no
# conoce: *"ponle materiales porque si son solamente cinco digitos, es material,
# si no me equivoco. Revisa la descripcion que es"*.
#
# SE REVISO ANTES DE CREER LA CORAZONADA, leyendo la descripcion que trae el
# propio archivo del WMS. Los 25 codigos que no estaban en el Maestro son TODOS
# de cinco digitos y TODOS material:
#
#     70104   74.768 u   TISSUE PAPER BATA N 4
#     69050   18.695 u   HANG TAG ORTHOLITE BATA ROJO
#     70103   16.795 u   TISSUE PAPER BATA N 3
#     88424    2.575 u   CAJA MICROC. KRAFT BATA N.24
#     26036      540 u   PLANT LAURA C/GEL ROJO N. 36
#
# Papel de seda, etiquetas colgantes, cajas de carton y plantillas. Tenia razon.
#
# LA REGLA EXIGE LAS DOS COSAS -cinco digitos Y no estar en el Maestro- y no solo
# la primera. Si manana falta en el Maestro un articulo de calzado de verdad, cae
# en "sin tipo" y se ve; llamarlo "materiales" sin conocerlo seria inventar.
# `sin_tipo` es la respuesta honesta de "no se que es esto", y ademas es la lista
# de lo que hay que agregarle al Maestro.
CINCO_DIGITOS = re.compile(r'^\d{5}$')


def tipo_de(sku, gender, esta_en_el_maestro):
    """calzado suelto / calzado prepack / no calzado / materiales / sin tipo."""
    if not esta_en_el_maestro:
        return 'materiales' if CINCO_DIGITOS.match((sku or '')[:7]) else 'sin_tipo'
    if not gender or gender == 'Sin dato':
        return 'sin_tipo'
    if gender != 'Footwear':
        return 'no_cal'
    return 'cal_prepack' if es_prepack(sku) else 'cal_suelto'


def pares_de_la_caja(sku):
    s = str(sku or '').strip()
    if not FORMA_PREPACK.match(s):
        return 1
    try:
        n = int(s[-5:][:2])
    except ValueError:
        return 1
    return n if 0 < n <= 24 else 1


def abrir(ruta):
    f = io.open(ruta, encoding='utf-8-sig', newline='', errors='replace')
    cabeza = f.read(4000)
    f.seek(0)
    sep = ';' if cabeza.count(';') > cabeza.count(',') else ','
    return f, csv.DictReader(f, delimiter=sep)


# ── el Maestro de articulos: EL DE LA WEB ───────────────────────────────
# Hasta el 16-sep-2026 salia de un Excel del OneDrive del servidor, el del 05-sep:
# dos modelos Puma que no estaban dejaron 212 pares de calzado como "sin tipo" y el
# cuadro no cuadro con el del supervisor. Ver `maestro_web.py`.
it = iter(maestro_web.filas())
cab = [str(c).strip() if c is not None else '' for c in next(it)]


def col(*nombres):
    # EL ORDEN DE LOS NOMBRES ES LA PREFERENCIA. Antes se recorrian los titulos y
    # ganaba el que venia primero en la tabla: `MarcaStd` esta antes que `Marcas`, y
    # la pantalla decia "Bata Comfit" y "Bubblegummers/Marvel" donde el KPI Picking
    # decia "Bata" y "B.G Licenses".
    bajos = [c.lower() for c in cab]
    for n in nombres:
        if n.lower() in bajos:
            return bajos.index(n.lower())
    return -1


iS = col('CodArticulo', 'CodigoArticulo')
iG, iM, iC = col('G. Gender', 'G Gender'), col('Marcas', 'MarcaStd'), col('Coleccion PO')
maestro = {}
for f in it:
    if iS < 0 or iS >= len(f) or f[iS] is None:
        continue
    k = limpio(f[iS])[:7]
    if k and k not in maestro:
        def d(i):
            v = limpio(f[i]) if 0 <= i < len(f) else ''
            return v if v and v != '(en blanco)' else 'Sin dato'
        maestro[k] = (d(iG), d(iM), d(iC))
print('maestro de articulos: %d codigos (%s)' % (len(maestro), maestro_web.descripcion()))
if maestro_web.aviso():
    print('AVISO: ' + maestro_web.aviso())

# ── el maestro de RUTAS: quien es tienda ────────────────────────────────
# SE COPIA ANTES DE ABRIRLO: en OneDrive esta solo en la nube y openpyxl lo ve
# como un zip roto. Copiarlo lo baja.
ruta_r = next((r for r in RUTAS_CAND if os.path.isfile(r)), None)
copia = os.path.join('C:' + os.sep, 'wms_scraping', 'logs', '_rutas_pph.xlsx')
try:
    shutil.copyfile(ruta_r, copia)
except Exception:
    copia = ruta_r
wb = openpyxl.load_workbook(copia, read_only=True, data_only=True)
it = wb.worksheets[0].iter_rows(values_only=True)
cr = [str(c).strip() if c is not None else '' for c in next(it)]
kC = cr.index('CDG')
tiendas = {str(f[kC]).strip() for f in it if kC < len(f) and f[kC] is not None}
wb.close()
print('maestro de rutas: %d tiendas' % len(tiendas))

# ── el canal fino, de las tres fuentes ──────────────────────────────────
tipo_orden = {}


def tragar(ruta2):
    if not os.path.isfile(ruta2):
        return
    try:
        f3, r3 = abrir(ruta2)
    except OSError:
        return                      # solo en la nube: OneDrive no lo bajo
    for x in r3:
        o = limpio(x.get('Número de orden'))
        if o and o not in tipo_orden:
            tipo_orden[o] = limpio(x.get('Tipo de orden'))
    f3.close()


tragar(os.path.join(CARPETA_ORD, 'Detalle Orden Pendientes.csv'))
tragar(os.path.join(CARPETA_ORD, 'Detalle Orden Despachados.csv'))
for n in sorted((n for n in os.listdir(CARPETA_ORD)
                 if re.match(r'^Detalle Orden \d{2}-\d{2}\.csv$', n)), reverse=True):
    tragar(os.path.join(CARPETA_ORD, n))
print('tipo de orden conocido para %s ordenes' % '{:,}'.format(len(tipo_orden)))


# LOS TIPOS DE ORDEN QUE SON TIENDA, la tabla del 04-sep-2026 (memoria
# canal-de-la-orden). Hacen falta para la tienda que todavia no esta en el maestro
# de rutas: el 18-sep-2026 B CARAZ (50644) llego como "Aldeas Bata" y cayo en OTROS,
# 2.627 lineas y 6.875 pares que la pantalla en RETAIL no mostraba y el supervisor si.
TIPOS_RETAIL = {'ALDEAS BATA', 'ALDEAS BUBBLEGUMMERS', 'ALDEAS NORTHSTAR',
                'WEINBRENNER ALDEAS', 'ALDEAS INSUMOS'}


def canal_de(destino, orden):
    """EL MAESTRO DE RUTAS MANDA. Si el destino es tienda, es retail y no se
    consulta nada mas; el Tipo de orden solo afina lo que NO es tienda.

    Y un Tipo de orden de tienda es retail AUNQUE el destino falte en el maestro:
    una tienda recien abierta tarda en entrar al archivo de rutas."""
    if destino in tiendas:
        return 'RETAIL'
    t = (tipo_orden.get(orden) or '').upper()
    if not t:
        return 'SIN CANAL'
    if t in TIPOS_RETAIL:
        return 'RETAIL'
    if 'MAYOR' in t:
        return 'MAYORISTA'
    if 'CATALOGO' in t:
        return 'CATALOGO'
    if 'ECOMMERCE' in t or 'VIRTUAL' in t:
        return 'ECOMMERCE'
    if 'INDUSTRIAL' in t:
        return 'INDUSTRIAL'
    return 'OTROS'


# ── el archivo de picking ───────────────────────────────────────────────
f, r = abrir(ARCHIVO)
# (canal, persona, hora, clase). El canal TODOS se llena a la par, para no tener
# que sumar seis diccionarios despues.
cel = defaultdict(lambda: defaultdict(float))
# persona -> [(segundo, canal, clase, hora)]: cada pick de esa persona, de TODOS los
# canales y clases. El refrigerio se busca sobre esta lista entera, porque la persona
# esta parada solo cuando no pica NADA; ver `tiempo_de_cada_par`.
eventos = defaultdict(list)

# ══════════════════════════════════════════════════════════════════════════════
# EL TIEMPO PARA MEDIR PRODUCTIVIDAD: LO QUE DICE EL WMS, SUMADO Y NADA MAS
# ══════════════════════════════════════════════════════════════════════════════
#
# Daniel, 02-sep-2026: *"tu deberias sacar lo que dice el WMS, no te debieras de
# inventar nada. La tarea uno se hizo de nueve a diez, ahi son sesenta minutos. La
# segunda de diez y diez a las once, cincuenta. En total ciento diez"*. Y sobre
# las que se pisan: *"si la otra tarea esta dentro de esa tarea, tu sigue
# acumulando el dato nada mas. Seis minutos, sumale. No importa si esta dentro o
# afuera"*.
#
# LA REGLA, entonces, es la mas simple que hay:
#   cada tarea aporta (ultimo pick - primer pick), y se suman todas.
#   Sin puente de 15 minutos -eso me lo habia inventado yo- y sin descontar los
#   solapes.
#
# SOLO LAS LINEAS CON `Numero de tarea` DE VERDAD. El 34,4% de las lineas no lo
# trae y hasta hoy se les ponia el numero de contenedor como apaño; eso partia una
# tarea en varias y hacia que el 48,7% "se pisara" — un solape inventado por mi
# manera de agrupar, no del almacen. Con los numeros de tarea reales solo se pisa
# el 1,6%. Daniel: *"dejalas fuera"*.
#
# POR ESO VAN PARES APARTE (`_q`): si se descartan esas lineas del tiempo hay que
# descartarlas TAMBIEN de los pares, o el ritmo sale inflado. Son el 20,4% de los
# pares. Los totales del dia -los que ve Picking por dia- NO se tocan: siguen
# contando todo.
sellos_tarea = defaultdict(lambda: defaultdict(list))   # (k,usr,h,clase) -> tarea -> [seg]
pares_tarea = defaultdict(float)                        # (k,usr,h,clase) -> pares
lineas_ph = defaultdict(lambda: defaultdict(float))
marcas = defaultdict(lambda: defaultdict(float))
colec = defaultdict(lambda: defaultdict(float))
zonas = defaultdict(lambda: defaultdict(float))
zonas_ubi = defaultdict(set)
# PRODUCTIVIDAD POR ZONA. Mismo criterio que `sellos_tarea`, pero la tarea se
# parte POR ZONA: el tiempo de la zona Z dentro de la tarea T es su ultimo pick
# en Z menos el primero.
#
# EL VIAJE ENTRE ZONAS NO CAE EN NINGUNA, y eso es a proposito: lo que se quiere
# saber es el ritmo DENTRO de la zona, sin el camino. El 21,6% de las tareas toca
# mas de una zona, asi que la suma de las zonas da ~5% menos horas que la tarea
# entera; esa diferencia ES el traslado.
sellos_zona = defaultdict(lambda: defaultdict(list))    # (k,z,clase) -> tarea -> [seg]
pares_zona = defaultdict(float)                         # (k,z,clase) -> pares
totales = defaultdict(lambda: defaultdict(float))
personas = defaultdict(set)
tipos_vistos = defaultdict(lambda: defaultdict(float))
destinos = defaultdict(lambda: defaultdict(float))
dia = dia_pedido() or dia_mayoritario(ARCHIVO, 'Hora de selección')
leidas = descartadas = 0

for row in r:
    if limpio(row.get('Estado')) != 'Finalizada':
        descartadas += 1
        continue
    leidas += 1
    sku = limpio(row.get('Código de artículo'))
    usr = limpio(row.get('Usuario de selección')) or '(sin usuario)'
    ubi = limpio(row.get('De ubicación')) or '?'
    orden = limpio(row.get('Número de orden'))
    destino = limpio(row.get('Instalación de destino'))
    hs = limpio(row.get('Hora de selección'))
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$', hs)
    if not m:
        continue
    if dia is None:
        dia = '%s-%s-%s' % (m.group(3), m.group(2), m.group(1))
    elif not hs.startswith('%s/%s/%s' % (dia[8:], dia[5:7], dia[:4])):
        # UN CUADRO, UN SOLO DIA. Si el archivo mezcla dos fechas, las del otro
        # dia se van: sumarlas daria un turno de 24 horas que nadie trabajo.
        descartadas += 1
        continue
    h = int(m.group(4))
    seg = h * 3600 + int(m.group(5)) * 60 + int(m.group(6))

    pares = entero(row.get('Cantidad empaquetada')) * pares_de_la_caja(sku)
    g, mar, cl = maestro.get(sku[:7], ('Sin dato', 'Sin dato', 'Sin dato'))
    clase = tipo_de(sku, g, sku[:7] in maestro)
    can = canal_de(destino, orden)
    z = ubi.split('-')[0]
    tipos_vistos[can][tipo_orden.get(orden) or '(sin dato)'] += 1
    destinos[can][destino] += 1

    # el numero de tarea DE VERDAD, sin apaño: solo lo usan `_s` y `_q`
    tarea_real = limpio(row.get('Número de tarea'))
    eventos[usr].append((seg, can, clase, h))

    for k in (can, TODOS):
        personas[k].add(usr)
        cel[(k, usr, h, clase)]['pares'] += pares
        cel[(k, usr, h, clase)]['lineas'] += 1
        if tarea_real:
            sellos_tarea[(k, usr, h, clase)][tarea_real].append(seg)
            sellos_tarea[(k, usr, None, clase)][tarea_real].append(seg)
            pares_tarea[(k, usr, h, clase)] += pares
            pares_tarea[(k, usr, None, clase)] += pares
        lineas_ph[(k, h)][clase] += pares
        lineas_ph[(k, h)]['lineas'] += 1
        marcas[(k, mar)][clase] += pares
        marcas[(k, mar)]['lineas'] += 1
        colec[(k, cl)][clase] += pares
        colec[(k, cl)]['lineas'] += 1
        zonas[(k, z)][clase] += pares
        zonas[(k, z)]['lineas'] += 1
        zonas_ubi[(k, z)].add(ubi)
        if tarea_real:
            sellos_zona[(k, z, clase)][tarea_real].append(seg)
            pares_zona[(k, z, clase)] += pares
        totales[k][clase] += pares
        totales[k]['lineas'] += 1
f.close()


def vol(d):
    o = {c: int(round(d.get(c, 0))) for c in CL}
    o['lineas'] = int(d.get('lineas', 0))
    # EL TOTAL SE SUMA SOBRE `CL`, no sobre tres nombres escritos a mano. Al
    # agregar `materiales` y `sin_tipo` la suma vieja los dejaba afuera y el
    # cuadro no cuadraba, sin una sola queja.
    o['total'] = sum(o[c] for c in CL)
    return o


def ritmo(marcas_t, lineas, minimo, span_min):
    """Lineas por hora sobre el tiempo REALMENTE trabajado en esa clase.

    None NO es cero: es "no alcanza la muestra", y en pantalla va como una raya.
    """
    if not marcas_t or len(marcas_t) < 2:
        return None, None, None, False
    span = max(marcas_t) - min(marcas_t)
    mins = round(span / 60.0, 1)
    if lineas < minimo or span < span_min:
        return None, None, mins, False
    sl = span / float(lineas - 1)
    if sl < SEG_LINEA_MIN:
        return None, None, mins, False      # confirmacion en bloque, no una persona
    return (int(round(lineas / (span / 3600.0))), int(round(sl)), mins,
            span < SEG_MUESTRA_CORTA)


def minutos_sumados(por_tarea):
    """Los minutos de trabajo: (ultimo pick - primer pick) de CADA tarea, sumados.

    LA REGLA QUE PIDIO DANIEL, y no tiene vuelta: cada tarea aporta lo suyo y se
    suman todas. Si dos se pisan, se suman igual — *"no importa si esta dentro o
    afuera de la tarea"*.

    UNA TAREA DE UN SOLO PICK APORTA CERO, y eso es fiel al dato: el WMS no dice
    cuanto duro, dice cuando se pico. Inventarle una duracion seria volver a lo
    que se acaba de sacar.
    """
    if not por_tarea:
        return 0
    return sum(max(v) - min(v) for v in por_tarea.values() if len(v) > 1)


def tiempo_de_cada_par(picks):
    """EL TIEMPO TRABAJADO DE UNA PERSONA EN EL DIA, repartido entre lo que pico.

    LA REGLA ES DE DANIEL, 17-sep-2026:
      1. El reloj arranca en el primer pick del dia y para en el ultimo. Cuando se abrio
         o se cerro la tarea no cuenta: el archivo del WMS solo trae la hora de cada pick.
      2. UNA PAUSA DE MENOS DE 30 MINUTOS ES TRABAJO. *"el picker no la encuentra, o le
         piden la talla 43, va a la ubicacion y ahi hay 42, se va a consultar..."*.
      3. UNA PAUSA DE 30 MINUTOS O MAS ES EL REFRIGERIO, y de ella se descuentan HASTA
         60 MINUTOS: *"si hay inactividad por 80 minutos, tu descuentale 60 ... esos 20
         minutos tienen que estar dentro de su produccion"*. Los 60 son del dia: si hay
         dos pausas largas, entre las dos no se descuenta mas de 60, empezando por la
         mas larga.

    Hasta ese dia el tiempo salia de las tareas, de su primer a su ultimo pick, unidas
    con un puente de 15 minutos: quien se iba a almorzar sin cerrar la tarea se llevaba
    el refrigerio entero como trabajo -13 de 20 personas el 16-sep-, y quien la cerraba
    se lo descontaba entero aunque durara 78 minutos.

    CADA RATO SE LO LLEVA EL PAR QUE VIENE. Lo que pasa entre un pick y el siguiente es
    lo que costo llegar a esa ubicacion y sacar ese siguiente -la misma medida con la que
    se saco el costo del prepack-. Si despues viene un prepack, ese rato es del prepack y
    no del suelto. Asi los minutos de suelto, prepack y no calzado suman justo los de
    Todo; antes cada clase llevaba su propio reloj y el mismo minuto contaba en las dos.
    Si varios picks caen en el mismo segundo -una confirmacion en bloque- el rato se
    reparte entre ellos en partes iguales.

    `picks` son [(segundo, canal, clase, hora)] de UNA persona, de todos los canales:
    la persona esta parada solo cuando no pica NADA. Devuelve
    {(canal, hora, clase): [[desde, hasta], ...]}, con intervalos que no se pisan.
    """
    if not picks:
        return {}
    en = defaultdict(list)
    for s, can, clase, h in picks:
        en[s].append((can, clase, h))
    tiempos = sorted(en)
    huecos = [(tiempos[i] - tiempos[i - 1], i) for i in range(1, len(tiempos))]

    descuento = {}
    resto = REFRIGERIO_SEG
    for d, i in sorted((x for x in huecos if x[0] >= PAUSA_SEG), reverse=True):
        if resto <= 0:
            break
        descuento[i] = min(d, resto)
        resto -= descuento[i]

    out = defaultdict(list)
    for d, i in huecos:
        # lo que se descuenta va al principio de la pausa: lo que sobra del refrigerio
        # es la vuelta, y se lo lleva el primer par despues de almorzar
        desde, hasta = tiempos[i - 1] + descuento.get(i, 0), tiempos[i]
        quienes = sorted(en[hasta])
        for j, (can, clase, h) in enumerate(quienes):
            a = desde + (hasta - desde) * j // len(quienes)
            b = desde + (hasta - desde) * (j + 1) // len(quienes)
            if b > a:
                out[(can, h, clase)].append([a, b])
    return out


def pegar(intervalos):
    """Ordena y junta los intervalos que se tocan. No se pisan nunca -cada segundo es de
    un solo par-, asi que juntarlos no cambia la suma: solo achica el archivo."""
    fus = []
    for a, b in sorted(intervalos or []):
        if fus and a <= fus[-1][1]:
            fus[-1][1] = max(fus[-1][1], b)
        else:
            fus.append([a, b])
    return fus


# (canal, persona, hora o None, clase o 'total') -> los ratos trabajados. TODOS y el dia
# entero salen de sumar los mismos intervalos: un canal, una hora y una clase nunca
# comparten un segundo.
iv_trabajo = defaultdict(list)
for _usr, _picks in eventos.items():
    for (_can, _h, _clase), _ivs in tiempo_de_cada_par(_picks).items():
        for _k in (_can, TODOS):
            for _hh in (_h, None):
                for _c in (_clase, 'total'):
                    iv_trabajo[(_k, _usr, _hh, _c)].extend(_ivs)


def ritmo_zona(clave):
    """Segundos y pares de cada clase en esa zona, para el ritmo.

    Se devuelve crudo -`<clase>_s` y `<clase>_q`-, sin dividir. La pantalla deja
    juntar canales y los ritmos NO se suman: hay que rehacerlos sobre el
    conjunto, igual que en `celda`.
    """
    k, z = clave
    o = {}
    for c in CL:
        o[c + '_s'] = minutos_sumados(sellos_zona.get((k, z, c)))
        o[c + '_q'] = int(round(pares_zona.get((k, z, c), 0)))
    return o


def celda(can, usr, h):
    """Una celda: el volumen de las tres clases y LOS RATOS TRABAJADOS de cada una.

    NO SE PUBLICA EL RITMO YA CALCULADO. La pantalla deja elegir varios canales a
    la vez, y los ritmos no se suman: hay que rehacerlos sobre el conjunto. Como los
    ratos de dos canales nunca comparten un segundo, la pantalla los junta, suma
    los pares y saca exactamente el mismo numero que sacaria aca.
    """
    o = {}
    tot_l = 0
    for c in CL + ('total',):
        if c == 'total':
            o['total'] = sum(o[c] for c in CL)
            o['lineas'] = tot_l
            o['total_l'] = tot_l
        else:
            if h is None:
                d = {'pares': sum(cel.get((can, usr, y, c), {}).get('pares', 0)
                                  for y in HORAS),
                     'lineas': sum(cel.get((can, usr, y, c), {}).get('lineas', 0)
                                   for y in HORAS)}
            else:
                d = cel.get((can, usr, h, c), {})
            n = int(d.get('lineas', 0))
            tot_l += n
            o[c] = int(round(d.get('pares', 0)))
            o[c + '_l'] = n
        o[c + '_iv'] = pegar(iv_trabajo.get((can, usr, h, c)))
        # PARA LA PRODUCTIVIDAD: segundos sumados y pares, solo de las lineas con
        # numero de tarea de verdad. Ver el comentario de `sellos_tarea`.
        if c != 'total':
            o[c + '_s'] = minutos_sumados(sellos_tarea.get((can, usr, h, c)))
            o[c + '_q'] = int(round(pares_tarea.get((can, usr, h, c), 0)))
    return o


def vista(can):
    ph = {}
    for h in HORAS:
        v = vol(lineas_ph.get((can, h), {}))
        v['personas'] = sum(1 for u in personas[can]
                            if any((can, u, h, c) in cel for c in CL))
        ph[str(h)] = v
    return {
        'totales': vol(totales[can]),
        'por_hora': ph,
        'gente': sorted([{'usuario': u, 'total': celda(can, u, None),
                          # SOLO LAS HORAS EN QUE ESA PERSONA MOVIO ALGO.
                          # Con las 24 completas el archivo del dia pasaba de 368
                          # a 585 KB —un mes serian 35 MB y bajar un rango de
                          # treinta dias, 17 MB al navegador— y veinte de esas
                          # veinticuatro celdas venian en cero. La pantalla trata
                          # la hora que falta como vacia.
                          'horas': {str(h): c for h, c in
                                    ((h, celda(can, u, h)) for h in HORAS)
                                    if c.get('total')}}
                         for u in personas[can]],
                        key=lambda x: -x['total']['total']),
        'marcas': sorted([dict(nom=k[1], **vol(v)) for k, v in marcas.items()
                          if k[0] == can], key=lambda x: -x['total'])[:14],
        'coleccion': sorted([dict(nom=k[1], **vol(v)) for k, v in colec.items()
                             if k[0] == can], key=lambda x: -x['total'])[:14],
        # LAS UBICACIONES VAN COMO LISTA, no solo contadas: al juntar dos canales
        # en la pantalla hay que UNIRLAS, y sumar los conteos las cuenta doble
        # -la misma ubicacion la visitan los dos-.
        'zonas': sorted([dict(nom=k[1], ubicaciones=len(zonas_ubi[k]),
                              ubis=sorted(zonas_ubi[k]),
                              **dict(vol(v), **ritmo_zona(k)))
                         for k, v in zonas.items() if k[0] == can],
                        key=lambda x: -x['total']),
    }


con_datos = [c for c in ORDEN_CANAL if totales.get(c, {}).get('lineas')]
salida = {
    'dia': dia,
    'archivo': os.path.basename(ARCHIVO),
    'lineas_buenas': leidas,
    'lineas_descartadas': descartadas,
    'horas': HORAS,
    'cortes': {'lineasCelda': LINEAS_MIN_CELDA, 'lineasDia': LINEAS_MIN_DIA,
               'minutosCelda': SEG_MIN_CELDA // 60, 'minutosDia': SEG_MIN_DIA // 60,
               'segLineaMin': SEG_LINEA_MIN, 'muestraCortaMin': SEG_MUESTRA_CORTA // 60,
               # PUENTE EN CERO: los ratos ya traen cada pausa corta adentro. Con puente,
               # la pantalla le pegaria a una clase el rato que se llevo la otra.
               'puenteMin': 0,
               'pausaMin': PAUSA_SEG // 60, 'refrigerioMin': REFRIGERIO_SEG // 60},
    'canales': [TODOS] + con_datos,
    'gentePorCanal': {c: len(personas[c]) for c in [TODOS] + con_datos},
    'tiposPorCanal': {c: sorted([[k, int(v)] for k, v in tipos_vistos[c].items()],
                                key=lambda x: -x[1])[:6] for c in con_datos},
    'destinosPorCanal': {c: sorted([[k, int(v)] for k, v in destinos[c].items()],
                                   key=lambda x: -x[1])[:6] for c in con_datos},
    'vistas': {c: vista(c) for c in [TODOS] + con_datos},
}

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
io.open(SALIDA, 'w', encoding='utf-8').write(json.dumps(salida, ensure_ascii=False))


def mm(n):
    return '{:,}'.format(int(n))


T = salida['vistas'][TODOS]['totales']
print('')
print('DIA %s  -  %s lineas buenas  -  %s copias descartadas'
      % (dia, mm(leidas), mm(descartadas)))
print('TOTAL  suelto %s  -  prepack %s  -  no calzado %s  =  %s pares'
      % (mm(T['cal_suelto']), mm(T['cal_prepack']), mm(T['no_cal']), mm(T['total'])))
print('')
print('POR CANAL')
print('  %-12s %9s %9s %10s %10s %9s %7s'
      % ('CANAL', 'LINEAS', 'PARES', 'SUELTO', 'PREPACK', 'NO CALZ', 'GENTE'))
suma_l = 0
for c in con_datos:
    v = salida['vistas'][c]['totales']
    suma_l += v['lineas']
    print('  %-12s %9s %9s %10s %10s %9s %7d'
          % (c, mm(v['lineas']), mm(v['total']), mm(v['cal_suelto']),
             mm(v['cal_prepack']), mm(v['no_cal']), len(personas[c])))
print('  %-12s %9s %9s %10s %10s %9s %7d'
      % ('TODOS', mm(T['lineas']), mm(T['total']), mm(T['cal_suelto']),
         mm(T['cal_prepack']), mm(T['no_cal']), len(personas[TODOS])))
print('  los canales suman %s lineas y el total dice %s  ->  %s'
      % (mm(suma_l), mm(T['lineas']), 'CUADRA' if suma_l == T['lineas'] else 'NO CUADRA'))
print('')
print('  QUE TIPO DE ORDEN Y QUE DESTINO CAYO EN CADA CANAL')
for c in con_datos:
    tt = salida['tiposPorCanal'][c][:3]
    dd = salida['destinosPorCanal'][c][:3]
    print('  %-12s tipo: %-52s dest: %s'
          % (c, ' | '.join('%s' % k for k, v in tt)[:52],
             ' | '.join('%s' % k for k, v in dd)[:40]))
print('')
print('json en %s  (%.0f KB)' % (SALIDA, os.path.getsize(SALIDA) / 1024.0))


# ── SE PUBLICA LO QUE SE ACABA DE CALCULAR ──────────────────────────────
# Va al final y no antes: si el calculo se cae, no se pisa el cuadro bueno que
# quedo del pase anterior.
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from publicar_area import publicar

    def _log(t, nivel='INFO'):
        print('[%s] %s' % (nivel, t))

    # MODO HISTORICO: se calcula y se guarda aparte, SIN publicar.
    #
    # Sirve para rellenar agosto entero de una sola vez. No se publica en el
    # momento porque el servidor hoy guarda solo 2 dias por area: subir treinta
    # dias haria que se pisaran entre ellos y quedarian los dos ultimos. Se dejan
    # calculados y se suben todos juntos cuando el tope este arriba.
    if '--historico' in sys.argv:
        _dir = os.path.join(os.path.dirname(SALIDA), 'historico')
        os.makedirs(_dir, exist_ok=True)
        _f = os.path.join(_dir, '%s_%s.json' % (AREA, dia))
        io.open(_f, 'w', encoding='utf-8').write(json.dumps(salida, ensure_ascii=False))
        print('[HISTORICO] guardado %s (%.0f KB), sin publicar'
              % (os.path.basename(_f), os.path.getsize(_f) / 1024.0))
        raise SystemExit(0)

    # UN CUADRO VACIO NO SE PUBLICA NUNCA.
    #
    # El 02-sep-2026 una corrida leyo el archivo equivocado, saco cero lineas y
    # sin fecha, y piso en el servidor el cuadro bueno del dia anterior. Que el
    # calculo salga mal no puede borrar lo que ya estaba: si no hay dia o no hay
    # ni una linea, se avisa y no se manda nada.
    _T = salida['vistas'][TODOS]['totales']
    if not dia or not _T.get('lineas'):
        print('[AVISO] el cuadro salio vacio (dia=%s, lineas=%s): NO se publica, '
              'se deja el que ya estaba' % (dia, _T.get('lineas')))
        raise SystemExit(1)

    publicar(AREA, salida, dia, _log)
except Exception as _e:
    print('[ERROR] no se pudo publicar: %s: %s' % (type(_e).__name__, _e))
