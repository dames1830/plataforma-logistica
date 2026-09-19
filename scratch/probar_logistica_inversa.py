# -*- coding: utf-8 -*-
"""PRUEBA del robot de Logística inversa contra la maqueta del 19-sep-2026.

Le pasa al robot las MISMAS entradas con que se armó la maqueta -las líneas T ya en hora de Lima (T.pkl), el
Maestro (maestro.pkl) y las rutas (rutas_local2.xlsx)- y compara lo que arma contra los JSON de la maqueta,
pestaña por pestaña. Los OBLPN y los correos se leen de verdad de la carpeta del OneDrive (no cambiaron desde la
maqueta). Tiene que dar IGUAL en todo lo que la maqueta ya tenía; lo nuevo (meses, previo, corte) no se compara.

    python scratch/probar_logistica_inversa.py
"""
import json, os, pickle, sys
import openpyxl

MAQ = r'C:\Users\dames\.gemini\antigravity\scratch\maqueta_logistica_inversa'
sys.argv = ['x', '--corte', '2026-09-18', '--probar']
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'robot'))
import logistica_inversa as LI

U = pickle.load(open(os.path.join(MAQ, 'T.pkl'), 'rb'))
MA = pickle.load(open(os.path.join(MAQ, 'maestro.pkl'), 'rb'))
wb = openpyxl.load_workbook(os.path.join(MAQ, 'rutas_local2.xlsx'), read_only=True, data_only=True)
it = wb.worksheets[0].iter_rows(values_only=True); next(it)
RUT = {str(f[0]).strip().split('.')[0]: [str(f[1] or '').strip(), str(f[2] or '').strip()] for f in it if f[0] is not None}
U = [list(r) for r in U]

fallas = 0
def igual(nombre, a, b):
    global fallas
    a = json.loads(json.dumps(a, ensure_ascii=False)); b = json.loads(json.dumps(b, ensure_ascii=False))
    ok = a == b
    if not ok:
        fallas += 1
        if isinstance(a, list) and isinstance(b, list):
            dif = next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
            extra = ' | largo %d vs %d | primera diferencia en %d: %s  vs  %s' % (len(a), len(b), dif, str(a[dif] if dif < len(a) else '-')[:200], str(b[dif] if dif < len(b) else '-')[:200])
        elif isinstance(a, dict) and isinstance(b, dict):
            ks = [k for k in set(a) | set(b) if a.get(k) != b.get(k)]
            extra = ' | %d claves distintas, p. ej. %s: %s  vs  %s' % (len(ks), ks[:1], str(a.get(ks[0]))[:200] if ks else '', str(b.get(ks[0]))[:200] if ks else '')
        else:
            extra = ' | %s vs %s' % (str(a)[:200], str(b)[:200])
    print(('  OK    ' if ok else '  FALLA ') + nombre + ('' if ok else extra), flush=True)

leer = lambda n: json.load(open(os.path.join(MAQ, n), encoding='utf-8'))
print('1) Lo que vuelve')
d, m = LI.lo_que_vuelve(U, MA, RUT), leer('datos.json')
for k in ('corte', 'asn', 'tiendas', 'arts'): igual('li_vuelve.' + k, d[k], m[k])
print('2) Producción L.I')
d, m = LI.produccion(U, MA), leer('produccion_li.json')
for k in ('ev', 'res'): igual('li_produccion.' + k, d[k], m[k])
print('3) Despachado y devuelto')
d, det = LI.despachado_y_devuelto(U, MA, RUT)
m = leer('retorno.json')
for k in ('meses', 'arbol', 'sin', 'sinDesc', 'abril'): igual('li_retorno.' + k, d[k], m[k])
igual('li_retorno_det.det', det['det'], m['det'])
igual('li_retorno.tiendas', d['tiendas'], m['tiendas'])
print('4) Doble tramo')
d, m = LI.doble_tramo(RUT), leer('doble_tramo.json')
igual('li_doble_tramo.guias', sorted(d['guias']), sorted(m['guias']))
igual('li_doble_tramo.tiendas', d['tiendas'], m['tiendas'])
print('FALLAS:', fallas)
