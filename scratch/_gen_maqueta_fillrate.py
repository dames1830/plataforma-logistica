# -*- coding: utf-8 -*-
"""Arma la maqueta del Fill Rate. Lee `_fr27.json`, que produce `_datos_fillrate.py`.

EL CSS VA PEGADO ADENTRO, no enlazado. Con <link> a `../css/...` la maqueta se ve sin
colores ni tipografia: quien la abre desde el visor de archivos no alcanza la carpeta de
al lado, y `var(--bg-dark)` se queda sin valor. Daniel, 28-ago-2026: *"no veo, le doy
claro y no agarra"* — el boton no fallaba, el tema no existia.
"""
import io, json

D = json.load(io.open('scratch/_fr27.json', encoding='utf-8'))
mil = lambda n: format(int(round(n)), ',d').replace(',', '.')
fr = lambda a, b: (100.0 * a / b) if b else None
def color(v):
    if v is None: return 'var(--text-muted)'
    return 'var(--success)' if v >= 99.5 else ('var(--warning)' if v >= 98 else 'var(--danger)')
def pct(v): return '&mdash;' if v is None else ('%.1f%%' % v)

TD = 'padding:8px 14px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;'
BORDE = 'border-left:1px solid rgba(var(--ink-rgb),.08);'

def fila(nom, uni, l, o, e, tipo='normal'):
    """tipo: cabeza | normal | cursiva | total"""
    v = fr(e, o); falta = o - e
    izq = {'cabeza':  'font-weight:900;color:var(--text-strong);letter-spacing:.4px;',
           'normal':  'padding-left:26px;color:var(--text-pale);',
           'cursiva': 'padding-left:46px;color:var(--text-muted);font-size:var(--t-xs);font-style:italic;',
           'total':   'padding-left:26px;font-weight:800;color:var(--text-strong);'}[tipo]
    fondo = {'cabeza': 'background:rgba(var(--ink-rgb),.05);',
             'total': 'background:rgba(var(--ink-rgb),.03);'}.get(tipo, '')
    uu = (' <span style="color:var(--text-muted);font-weight:600;font-size:var(--t-xs)">%s</span>' % uni) if uni else ''
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.06);%s">'
            '<td style="padding:8px 14px;%s">%s%s</td>'
            '<td style="%scolor:var(--text-muted)">%s</td>'
            '<td style="%sfont-weight:700">%s</td>'
            '<td style="%sfont-weight:700">%s</td>'
            '<td style="%scolor:%s">%s</td>'
            '<td style="%sfont-weight:900;color:%s">%s</td></tr>') % (
        fondo, izq, nom, uu,
        TD, mil(l) if l else '', TD, mil(o) if o else '&mdash;', TD, mil(e) if o else '&mdash;',
        TD, 'var(--danger)' if falta else 'rgba(var(--ink-rgb),.25)', mil(falta) if falta else '&mdash;',
        TD, color(v), '' if tipo == 'cursiva' else pct(v))

def bloque(titulo, uni, g, conPrepack=True):
    """Un grupo: el titulo VA SIN NUMEROS y el subtotal los pone una sola vez.

    Ponerlos en los dos sitios se lee como si el grupo contara dos veces, y Daniel suma
    las filas con la calculadora."""
    s, p = g['S'], g['P']
    t = ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.06);background:rgba(var(--ink-rgb),.05)">'
         '<td colspan="6" style="padding:9px 14px;font-weight:900;color:var(--text-strong);'
         'letter-spacing:.5px;font-size:var(--t-xs)">%s <span style="color:var(--text-muted);'
         'font-weight:600;text-transform:none;letter-spacing:0">&middot; en %s</span></td></tr>'
         % (titulo, uni))
    t += fila('Solid', uni, s['l'], s['o'], s['e'])
    if conPrepack and p['l']:
        t += fila('Prepack', 'cajas', p['l'], p['o'], p['e'])
        t += fila('esas cajas, en ' + uni, '', 0, p['op'], p['ep'], 'cursiva')
        t += fila('Subtotal', uni, s['l'] + p['l'], s['o'] + p['op'], s['e'] + p['ep'], 'total')
    return t

C, N, M = D['calzado'], D['nocalzado'], D['material']
t1 = bloque('CALZADO', 'pares', C) + bloque('NO CALZADO', 'unidades', N) \
     + bloque('MATERIAL', 'unidades', M, conPrepack=False)

def filaM(m, s, q, fuerte=False):
    to, te = s['o'] + q['op'], s['e'] + q['ep']
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05);%s">'
            '<td style="padding:8px 14px;font-weight:%s;color:var(--text-strong)">%s</td>'
            '<td style="%s">%s</td><td style="%s">%s</td>'
            '<td style="%sfont-weight:800;color:%s">%s</td>'
            '<td style="%s%s">%s</td><td style="%s">%s</td>'
            '<td style="%sfont-weight:800;color:%s">%s</td>'
            '<td style="%s%sfont-weight:800">%s</td>'
            '<td style="%sfont-weight:900;color:%s">%s</td></tr>') % (
        'background:rgba(var(--ink-rgb),.035);' if fuerte else '', '900' if fuerte else '700', m,
        TD, mil(s['o']), TD, mil(s['e']),
        TD, color(fr(s['e'], s['o'])), pct(fr(s['e'], s['o'])),
        TD, BORDE, mil(q['o']) if q['o'] else '&mdash;', TD, mil(q['e']) if q['o'] else '&mdash;',
        TD, color(fr(q['e'], q['o'])), pct(fr(q['e'], q['o'])),
        TD, BORDE, mil(te), TD, color(fr(te, to)), pct(fr(te, to)))

t2 = ''.join(filaM(x['m'], x['S'], x['P']) for x in D['marcas']) + filaM('TOTAL', C['S'], C['P'], True)
# El mismo cuadro, pero por canal. Se reutiliza filaM: son las mismas columnas.
t6 = ''.join(filaM(x['m'], x['S'], x['P']) for x in D['canales']) + filaM('TOTAL', C['S'], C['P'], True)
t7 = ''.join(filaM(x['m'], x['S'], x['P']) for x in D['zonas']) + filaM('TOTAL', C['S'], C['P'], True)
# Las rutas van ordenadas por el fill rate mas flojo: lo que interesa es donde se cae,
# no cual mueve mas. Las que mueven menos de 200 pares quedan fuera del orden -con 3
# pares, uno que falte ya es un 33%- pero igual se listan al final.
_gr = lambda x: (x['S']['e'] + x['P']['ep'], x['S']['o'] + x['P']['op'])
_ru = sorted(D['rutas'], key=lambda x: (_gr(x)[0] / _gr(x)[1]) if _gr(x)[1] > 200 else 9)
t8 = ''.join(filaM(x['m'], x['S'], x['P']) for x in _ru) + filaM('TOTAL', C['S'], C['P'], True)
# Por dia de despacho. El de dias sueltos NO lleva fila TOTAL a proposito: no suma el
# total, y poner una fila TOTAL ahi seria mentir con un numero que Daniel va a sumar.
t9 = ''.join(filaM(x['m'], x['S'], x['P']) for x in D['diasSueltos'])
t10 = ''.join(filaM(x['m'], x['S'], x['P']) for x in D['patrones']) + filaM('TOTAL', C['S'], C['P'], True)
_sumaDias = sum(x['S']['e'] + x['P']['ep'] for x in D['diasSueltos'])

# ── LO QUE SE PICA Y SE QUEDA EN EL PATIO ────────────────────────────────────────
_totEsp = sum(x['pares'] for x in D['espera'])
def _colorEsp(d):
    return 'var(--success)' if d <= 1 else ('var(--warning)' if d <= 2 else 'var(--danger)')
def filaEsp(x):
    et = 'Sale esa misma noche' if x['dias'] == 0 else (
         '1 día esperando' if x['dias'] == 1 else '%d días esperando' % x['dias'])
    p = 100 * x['pares'] / _totEsp if _totEsp else 0
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05)">'
            '<td style="padding:8px 14px;font-weight:700;color:%s">%s</td>'
            '<td style="%s">%s</td><td style="%scolor:var(--text-muted)">%s</td>'
            '<td style="%s"><div style="background:rgba(var(--ink-rgb),.07);border-radius:3px;height:9px">'
            '<div style="width:%.1f%%;height:9px;border-radius:3px;background:%s"></div></div></td>'
            '<td style="%sfont-weight:900;color:%s">%.1f%%</td></tr>') % (
        _colorEsp(x['dias']), et, TD, mil(x['pares']), TD, mil(x['lineas']),
        'padding:8px 14px;width:38%;', p, _colorEsp(x['dias']), TD, _colorEsp(x['dias']), p)
t11 = ''.join(filaEsp(x) for x in D['espera'])

def filaEspDia(x):
    tt = x['pares']
    c = 'var(--danger)' if x['prom'] >= 2 else ('var(--warning)' if x['prom'] >= 1.2 else 'var(--success)')
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05)">'
            '<td style="padding:8px 14px;font-weight:700;color:var(--text-strong)">%s <span '
            'style="color:var(--text-muted);font-weight:600;font-size:var(--t-xs)">%s</span></td>'
            '<td style="%s">%s</td><td style="%s">%s</td><td style="%s">%s</td>'
            '<td style="%s">%s</td>'
            '<td style="%sfont-weight:800;color:%s">%s</td>'
            '<td style="%sfont-weight:900;color:%s">%.1f</td></tr>') % (
        x['sem'], x['dia'][8:] + '/' + x['dia'][5:7],
        TD, mil(tt), TD, mil(x['d0']), TD, mil(x['d1']), TD, mil(x['d2']),
        TD, 'var(--danger)' if x['d4'] else 'rgba(var(--ink-rgb),.25)',
        mil(x['d4']) if x['d4'] else '&mdash;', TD, c, x['prom'])
t12 = ''.join(filaEspDia(x) for x in D['esperaPorDia'])
_peor = max(D['esperaPorDia'], key=lambda x: x['prom'])
_d4 = sum(x['pares'] for x in D['espera'] if x['dias'] >= 3)

def filaF(x):
    tipo = 'PREPACK' if x['p'] else 'SOLID'
    rgb, txt = ('warning', 'warning-soft') if x['p'] else ('primary2', 'brand-pale')
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05)">'
            '<td style="padding:8px 14px;font-size:var(--t-xs);color:var(--text-muted)">%s</td>'
            '<td style="padding:8px 14px;font-family:monospace;font-size:var(--t-xs)">%s</td>'
            '<td style="padding:8px 14px;font-size:var(--t-xs);color:var(--text-muted)">%s</td>'
            '<td style="padding:8px 14px;font-size:var(--t-xs);font-weight:700">%s</td>'
            '<td style="padding:8px 14px;text-align:center"><span style="font-size:10px;font-weight:800;'
            'padding:2px 7px;border-radius:5px;background:rgba(var(--%s-rgb),.16);color:var(--%s)">%s</span></td>'
            '<td style="%sfont-weight:800;color:var(--danger)">%s%s</td>'
            '<td style="%scolor:var(--text-muted)">%s</td></tr>') % (
        x['o'], x['sku'], x['d'], x['m'], rgb, txt, tipo,
        TD, mil(x['f']), ' cajas' if x['p'] else '', TD, mil(x['fp']))

t3 = ''.join(filaF(x) for x in D['falt'])
t4 = ''.join('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05)">'
             '<td style="padding:7px 14px;font-size:var(--t-xs);color:var(--text-muted)">%s</td>'
             '<td style="padding:7px 14px;font-size:var(--t-xs);color:var(--text-muted)">%s</td>'
             '<td style="%sfont-weight:800">%s</td></tr>'
             % (x['d'], x['cat'] or '&mdash;', TD, mil(x['q'])) for x in D['mat'])

# Dia por dia, para ver donde se cae el fill rate dentro del rango
def filaD(x):
    s, p = x['S'], x['P']
    o, e = s['o'] + p['op'], s['e'] + p['ep']
    dd = x['dia'][8:] + '/' + x['dia'][5:7]
    return ('<tr style="border-bottom:1px solid rgba(var(--ink-rgb),.05)">'
            '<td style="padding:7px 14px;font-weight:700;color:var(--text-strong)">%s</td>'
            '<td style="%scolor:var(--text-muted)">%s</td>'
            '<td style="%s">%s</td><td style="%s">%s</td>'
            '<td style="%scolor:%s">%s</td>'
            '<td style="%sfont-weight:900;color:%s">%s</td></tr>') % (
        dd, TD, mil(s['l'] + p['l']), TD, mil(o), TD, mil(e),
        TD, 'var(--danger)' if o - e else 'rgba(var(--ink-rgb),.25)',
        mil(o - e) if o - e else '&mdash;', TD, color(fr(e, o)), pct(fr(e, o)))

t5 = ''.join(filaD(x) for x in D['porDia'])
RANGO = io.open('scratch/_rango.js', encoding='utf-8').read()

TH = ('padding:9px 14px;text-align:right;font-size:var(--t-xs);font-weight:800;'
      'letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase')
CSS = (io.open('css/temas.css', encoding='utf-8').read() + '\n'
       + io.open('css/main.css', encoding='utf-8').read())

html = """<!doctype html><html data-tema="pbi"><head><meta charset="utf-8">
<title>Fill rate del picking</title>
<style>__CSS__</style>
<style>
body{margin:0;padding:24px;background:var(--bg-dark);color:var(--text-pale);font-family:var(--font-ui)}
th{__TH__} th:first-child,td:first-child{text-align:left}
.pan{margin-bottom:18px;padding:0;overflow:hidden}
.cab{padding:13px 18px;border-bottom:1px solid rgba(var(--ink-rgb),.07)}
.cab h3{margin:0;font-size:var(--t-md);font-weight:900;color:var(--text-strong);letter-spacing:.4px}
.cab p{font-size:var(--t-xs);color:var(--text-muted);margin:3px 0 0}
.pie{padding:10px 18px;font-size:var(--t-xs);color:var(--text-muted);
     border-top:1px solid rgba(var(--ink-rgb),.06);line-height:1.7}
table{width:100%;border-collapse:collapse}

/* DOS CUADROS POR FILA. Daniel, 28-ago-2026: *"que entren dos reportes de forma
   horizontal"*. `align-items:start` para que un cuadro corto no se estire hasta la
   altura del de al lado y quede con un hueco blanco abajo. En pantalla angosta vuelven
   a apilarse solos: con menos de 1100 px, dos cuadros de nueve columnas no se leen. */
.rej{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
.rej > .ancho{grid-column:1 / -1}
/* EL CORTE VA EN 1400, no en 1100. Medido: dos tablas de nueve columnas necesitan unos
   700 px cada una; a 1280 la mitad queda en 620 y aparece el scroll horizontal. Debajo
   de eso se apilan de a una y se leen enteras. */
@media (max-width:1400px){ .rej{grid-template-columns:1fr} }
.pan{margin-bottom:0}
/* Los de nueve columnas van con menos relleno: a media pantalla el numero manda y el
   aire de los costados es lo primero que sobra. */
.ancho9 td,.ancho9 th{padding-left:6px;padding-right:6px}
.ancho9 th{letter-spacing:.02em}
.ancho9 td:first-child,.ancho9 th:first-child{font-size:var(--t-xs);padding-left:14px;padding-right:10px}
/* SIN SCROLL HORIZONTAL. Daniel, 28-ago-2026: *"por que ese reporte tiene scroll
   horizontal cuando hay espacio en los laterales"*. Eran dos cosas a la vez: la pagina
   topada en 1.480 px con pantalla mas ancha, y la tabla pidiendo mas de lo que cabia.
   `table-layout:fixed` obliga a la tabla a caber en su recuadro y repartir el sobrante,
   en vez de crecer hasta lo que pida la celda mas larga. */
.ancho9 table{table-layout:fixed}
</style></head><body>
<div style="max-width:1900px;margin:0 auto">
 <div style="margin-bottom:8px;font-size:var(--t-xs);color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase">
   Maqueta &middot; Picking &rarr; Reporte Picking
   <span style="float:right;text-transform:none;letter-spacing:0">
     <button onclick="document.documentElement.dataset.tema='pbi'" style="font-size:11px;padding:3px 9px">claro</button>
     <button onclick="document.documentElement.dataset.tema='indigo'" style="font-size:11px;padding:3px 9px">oscuro</button>
   </span></div>

 <!-- EL MISMO SELECTOR QUE EL RESTO DE LA PLATAFORMA. No es una copia parecida: el
      codigo de `selectorRango` va recortado de `reportesComunes.js` y se llama aca. -->
 <div id="rango" style="margin-bottom:14px"></div>

 <div class="rej">

 <div class="glass-panel pan"><div class="cab"><h3>FILL RATE DEL PICKING</h3>
   <p>De lo que el WMS puso a picar, cu&aacute;nto sali&oacute; &middot;
   <b style="color:var(--text-strong)">solo zona activa</b> &middot;
   __NDIAS__ jornadas, del __RDESDE__ al __RHASTA__</p></div>
  <table><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>&nbsp;</th><th>L&iacute;neas</th><th>Solicitado</th><th>Picado</th><th>Falt&oacute;</th><th>Fill rate</th>
  </tr></thead><tbody>__T1__</tbody></table>
  <div class="pie">
   <b style="color:var(--text-strong)">No hay un total de los tres.</b> Los pares de un zapato, las unidades
   de una cartera y las bolsas de empaque no se suman: dar&iacute;a un n&uacute;mero que no significa nada.<br>
   El prepack va en <b style="color:var(--text-strong)">cajas</b>, que es como se pica &mdash; o sale la caja o
   no sale &mdash;, y la fila en cursiva las pasa a pares para que el subtotal cuadre.<br>
   <b style="color:var(--text-strong)">No entra nada de reserva</b>: se excluyen los niveles D a H del selectivo.
   Comprobado sobre 8 jornadas, <b style="color:var(--success)">cero l&iacute;neas desde reserva</b>
   (en las __NDIAS__ jornadas: __FUERA__).</div></div>

 <div class="glass-panel pan"><div class="cab"><h3>CALZADO, D&Iacute;A POR D&Iacute;A</h3>
   <p>D&oacute;nde se cae el fill rate dentro del rango</p></div>
  <table><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th style="text-align:left">D&iacute;a</th><th>L&iacute;neas</th><th>Solicitado</th>
    <th>Picado</th><th>Falt&oacute;</th><th>Fill rate</th></tr></thead>
   <tbody>__T5__</tbody></table></div>

 <div class="glass-panel pan"><div class="cab"><h3>QU&Eacute; ES ESE &quot;MATERIAL&quot;</h3>
   <p>__MATTOT__ unidades en __MATL__ l&iacute;neas del rango &mdash; no es mercader&iacute;a, es empaque</p></div>
  <table><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th style="text-align:left">Art&iacute;culo</th><th style="text-align:left">Categor&iacute;a</th><th>Unidades</th>
  </tr></thead><tbody>__T4__</tbody></table>
  <div class="pie">Si esto se contara como pares, el reporte dir&iacute;a
   <b style="color:var(--danger)">__FALSO__ pares</b> cuando el calzado de verdad fueron
   <b style="color:var(--success)">__CALZ__</b>.</div></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>CALZADO POR ZONA DE REPARTO</h3>
   <p>Sale del maestro de rutas &mdash; la tienda de destino dice a qu&eacute; zona pertenece</p></div>
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>Zona</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.02)"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T7__</tbody></table></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>CALZADO POR RUTA</h3>
   <p>__NRUTAS__ rutas, ordenadas de peor a mejor fill rate &mdash; las que mueven menos de
   200 pares van al final, porque ah&iacute; un par que falte ya es un porcentaje enorme</p></div>
  <div style="max-height:420px;overflow-y:auto">
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04);position:sticky;top:0">
    <th>Ruta</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.04);position:sticky;top:33px"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T8__</tbody></table></div>
  <div class="pie"><b style="color:var(--warning-soft)">Sin ruta</b> son ecommerce y
   despacho directo: no van por ruta de reparto, as&iacute; que no se les puede asignar una.</div></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>LO QUE SE PICA Y SE QUEDA EN EL PATIO</h3>
   <p>Del pick al reparto de esa tienda &mdash; cruza la fecha del picking con el d&iacute;a
   de reparto del maestro de rutas</p></div>
  <table><colgroup><col style="width:24%"><col style="width:14%"><col style="width:12%"><col style="width:38%"><col style="width:12%"></colgroup>
   <thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th style="text-align:left">Espera</th><th>Pares</th><th>L&iacute;neas</th><th style="text-align:left">&nbsp;</th><th>%</th></tr></thead>
   <tbody>__T11__</tbody></table>
  <div class="pie"><b style="color:var(--danger)">__PARADO__ pares</b> se picaron con tres d&iacute;as
   o m&aacute;s de anticipaci&oacute;n: eso es lo que se queda en el patio.</div></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>QU&Eacute; D&Iacute;A SE PICA PARA CU&Aacute;NDO</h3>
   <p>El d&iacute;a que peor anticipa es <b style="color:var(--danger)">__PEOR__</b>, con __PEORPROM__
   d&iacute;as de espera promedio</p></div>
  <table><colgroup><col style="width:22%"><col span="6" style="width:13%"></colgroup>
   <thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th style="text-align:left">Se pica el</th><th>Pares</th><th>Misma noche</th><th>+1 d&iacute;a</th>
    <th>+2 d&iacute;as</th><th>+4 o m&aacute;s</th><th>Espera</th></tr></thead>
   <tbody>__T12__</tbody></table></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>CALZADO POR D&Iacute;A DE DESPACHO</h3>
   <p>Qu&eacute; d&iacute;a de la semana se reparte cada tienda &mdash; sale de la columna
   <b style="color:var(--text-strong)">D&Iacute;A</b> del maestro de rutas</p></div>
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>D&iacute;a</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.02)"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T9__</tbody></table>
  <div class="pie"><b style="color:var(--warning-soft)">Estas filas no suman el total</b>, y es
   correcto: hay tiendas que se reparten dos o tres d&iacute;as &mdash;75 son de
   &quot;MARTES - JUEVES&quot;&mdash; y esas entran en cada uno de sus d&iacute;as. Sumadas dan
   __SUMADIAS__ contra los __TOTCALZ__ reales. Para el n&uacute;mero que cuadra, el cuadro de
   al lado.</div></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>POR PATR&Oacute;N DE REPARTO</h3>
   <p>Lo mismo, pero cada tienda en una sola fila &mdash; este s&iacute; suma el total</p></div>
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>Patr&oacute;n</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.02)"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T10__</tbody></table></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>CALZADO POR CANAL</h3>
   <p>De d&oacute;nde viene el pedido &mdash; sale del <b style="color:var(--text-strong)">Tipo de orden</b>
   del Detalle de Orden, cruzado por n&uacute;mero de orden</p></div>
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>Canal</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.02)"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T6__</tbody></table>
  <div class="pie"><b style="color:var(--warning-soft)">Sin tipo</b> son las &oacute;rdenes que no
   aparecen en los 14 d&iacute;as de Detalle de Orden que se leyeron: se picaron, pero su orden se
   cre&oacute; antes de esa ventana.</div></div>

 <div class="glass-panel pan ancho9"><div class="cab"><h3>CALZADO POR MARCA</h3>
   <p>Solid en pares, prepack en cajas, y el total de las dos cosas en pares</p></div>
  <table><colgroup><col style="width:17%"><col span="8" style="width:10.375%"></colgroup><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th>Marca</th>
    <th colspan="3" style="text-align:center;color:var(--brand-pale)">SOLID &middot; pares</th>
    <th colspan="3" style="text-align:center;color:var(--warning-soft);__B__">PREPACK &middot; cajas</th>
    <th colspan="2" style="text-align:center;__B__">TOTAL &middot; pares</th></tr>
   <tr style="background:rgba(var(--ink-rgb),.02)"><th></th>
    <th>Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Solic.</th><th>Picado</th><th>Fill</th>
    <th style="__B__">Picado</th><th>Fill</th></tr></thead>
   <tbody>__T2__</tbody></table></div>

 <div class="glass-panel pan"><div class="cab"><h3>CALZADO QUE NO SALI&Oacute;</h3>
   <p>__INC__ l&iacute;neas quedaron cortas &middot; las 10 que m&aacute;s pesan</p></div>
  <table><thead><tr style="background:rgba(var(--ink-rgb),.04)">
    <th style="text-align:left">Orden</th><th style="text-align:left">SKU</th>
    <th style="text-align:left">Descripci&oacute;n</th><th style="text-align:left">Marca</th>
    <th style="text-align:center">Tipo</th><th>Falt&oacute;</th><th>En pares</th></tr></thead>
   <tbody>__T3__</tbody></table></div>
</div>
</div>
<script>
__RANGO__
document.getElementById('rango').innerHTML = selectorRango('__DESDE__', '__HASTA__', 'nada', { rotulo: 'var(--text-muted)' });
function nada() { /* en la maqueta no recalcula: los numeros ya vienen del rango entero */ }
</script></body></html>"""

calz = C['S']['e'] + C['P']['ep']
falso = calz + N['S']['e'] + N['P']['ep'] + M['S']['e']
dmy = lambda s: s[8:] + '/' + s[5:7] + '/' + s[:4]
for k, v in [('__CSS__', CSS), ('__TH__', TH), ('__T1__', t1), ('__T2__', t2),
             ('__T5__', t5), ('__T6__', t6), ('__T7__', t7), ('__T8__', t8),
             ('__NRUTAS__', str(len(D['rutas']))), ('__T9__', t9), ('__T10__', t10),
             ('__SUMADIAS__', mil(_sumaDias)), ('__T11__', t11), ('__T12__', t12),
             ('__PARADO__', mil(_d4)), ('__PEOR__', _peor['sem']),
             ('__PEORPROM__', '%.1f' % _peor['prom']), ('__TOTCALZ__', mil(C['S']['e'] + C['P']['ep'])), ('__RANGO__', RANGO), ('__DESDE__', D['desde']),
             ('__HASTA__', D['hasta']), ('__NDIAS__', str(len(D['dias']))),
             ('__RDESDE__', dmy(D['desde'])), ('__RHASTA__', dmy(D['hasta'])),
             ('__T3__', t3), ('__T4__', t4), ('__B__', BORDE),
             ('__FUERA__', str(D['fuera'])), ('__MATTOT__', mil(M['S']['e'])),
             ('__MATL__', mil(M['S']['l'])), ('__FALSO__', mil(falso)), ('__CALZ__', mil(calz)),
             ('__INC__', str(C['S']['inc'] + C['P']['inc']))]:
    html = html.replace(k, v)

io.open('scratch/maqueta_fillrate_picking.html', 'w', encoding='utf-8').write(html)
print('maqueta lista')
print('  calzado    :', mil(C['S']['e']), 'pares solid +', mil(C['P']['ep']), 'de prepack =', mil(calz))
print('  no calzado :', mil(N['S']['e'] + N['P']['ep']), 'unidades')
print('  material   :', mil(M['S']['e']), 'unidades')
print('  si se mezclara todo saldria:', mil(falso))
