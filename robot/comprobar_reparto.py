# -*- coding: utf-8 -*-
"""Las tres comprobaciones del skill `una-guia-un-lugar`, contra datos reales.

Usa las funciones del propio armador: si el reparto cambia, esto cambia con el.
"""
import sys, io, csv, collections, datetime
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SALIDA = []
_pedida = sys.argv[1] if len(sys.argv) > 1 else None
sys.argv = ['armar_pendiente.py', '--probar']
import armar_pendiente as A

HOY = (datetime.datetime.strptime(_pedida, '%Y-%m-%d').date()
       if _pedida and _pedida[:2] == '20'
       else datetime.date.today())
guias, cab, IQ, IG = A.leer_correos()

pedido = {}
for g, (fila, m, d) in guias.items():
    try:
        pedido[g] = float(str(fila[IQ]).replace(',', '') or 0)
    except Exception:
        pedido[g] = 0.0

vistas = set()
g_pend = collections.defaultdict(float)     # pendiente: correo anterior a hoy
g_hoy = collections.defaultdict(float)      # el correo de hoy
g_nunca = collections.defaultdict(float)    # el WMS lo abre y nadie lo pidio
todas = set()

f = io.open(A.PENDIENTES, encoding='utf-8-sig', newline='', errors='replace')
r = csv.reader(f, delimiter=';')
next(r)
for row in r:
    if len(row) < 14 or row[4].strip() not in A.ESTADOS:
        continue
    o, sku, dest = A.limpio(row[1]), A.limpio(row[5]), A.limpio(row[13])
    if (o, sku, dest) in vistas:
        continue
    vistas.add((o, sku, dest))
    todas.add(o)
    # EN PARES, con la funcion del propio armador: comparar cajas contra el
    # correo -que viene en pares- es comparar peras con manzanas.
    caja = A.pares_de_la_caja(sku)
    pend = max(0.0, (A.num(row[6]) - A.num(row[9])) * caja)
    if o not in guias:
        g_nunca[o] += pend
    elif (guias[o][1], guias[o][2]) == (HOY.month, HOY.day):
        g_hoy[o] += pend
    else:
        g_pend[o] += pend
f.close()

def linea(t):
    print(t)
    SALIDA.append(t)

linea('')
linea('  Pendiente de Despacho   %7s guias   %11s unidades'
      % (format(len(g_pend), ',d'), format(int(sum(g_pend.values())), ',d')))
linea('  Nunca liberado          %7s guias   %11s unidades'
      % (format(len(g_nunca), ',d'), format(int(sum(g_nunca.values())), ',d')))
linea('  Correo de Hoy           %7s guias   %11s unidades'
      % (format(len(g_hoy), ',d'), format(int(sum(g_hoy.values())), ',d')))
linea('  ' + '-' * 56)
linea('  suma de los tres        %7s guias   %11s unidades'
      % (format(len(g_pend) + len(g_nunca) + len(g_hoy), ',d'),
         format(int(sum(g_pend.values()) + sum(g_nunca.values())
                    + sum(g_hoy.values())), ',d')))
linea('  el WMS tiene abiertas   %7s guias' % format(len(todas), ',d'))
linea('')

fallos = []

# 1. NINGUNA GUIA REPETIDA ENTRE GRUPOS
for a, b, na, nb in (('pend', 'hoy', 'Pendiente', 'Correo de Hoy'),
                     ('pend', 'nunca', 'Pendiente', 'Nunca liberado'),
                     ('hoy', 'nunca', 'Correo de Hoy', 'Nunca liberado')):
    ga = {'pend': g_pend, 'hoy': g_hoy, 'nunca': g_nunca}[a]
    gb = {'pend': g_pend, 'hoy': g_hoy, 'nunca': g_nunca}[b]
    repes = set(ga) & set(gb)
    ok = not repes
    linea('  [%s] %-42s %s' % ('OK' if ok else 'FALLA',
                               'ninguna guia en %s y %s' % (na, nb),
                               '' if ok else '%d repetidas' % len(repes)))
    if not ok:
        fallos.append('%s / %s' % (na, nb))

# 2. LOS TRES SUMAN LO QUE EL WMS ABRE
suma = len(g_pend) + len(g_nunca) + len(g_hoy)
ok = suma == len(todas)
linea('  [%s] los tres suman las guias abiertas del WMS   %s'
      % ('OK' if ok else 'FALLA', '' if ok else '%d contra %d' % (suma, len(todas))))
if not ok:
    fallos.append('la suma no da')

# 3. EL WMS NUNCA PIDE MAS QUE EL CORREO
mas = [g for g, q in g_pend.items() if q > pedido.get(g, 0) + 0.5]
ok = not mas
linea('  [%s] el WMS no pide mas que el correo            %s'
      % ('OK' if ok else 'FALLA', '' if ok else '%d guias' % len(mas)))
if not ok:
    fallos.append('el WMS pide de mas')

linea('')
linea('  ' + ('TODO CUADRA' if not fallos else 'FALLA: ' + ', '.join(fallos)))
sys.exit(1 if fallos else 0)
