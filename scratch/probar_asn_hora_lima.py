# Corre construir() del robot del ASN VIEJO y del NUEVO sobre los mismos archivos, sin publicar nada,
# y compara: la fecha y la hora de recepcion tienen que correrse 5 horas y NADA MAS puede cambiar.
import importlib.util, os, sys, json, datetime
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r'C:\Users\dames\.gemini\antigravity\scratch\wt-asn-lima\robot')

def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(AQUI, nombre + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    m.CARPETA_ASN = os.path.join(AQUI, 'asn')
    m.log = lambda *a, **k: None
    return m

res = {}
for n in ('asn_resumen_viejo', 'asn_resumen_nuevo'):
    m = cargar(n); p = m.construir(); tabla, meta = p.pop('_tabla', (None, None))
    res[n] = (p, tabla, meta)
    print(n, 'listo:', len(meta), 'ASN en la tabla', flush=True)
(pv, tv, mv), (pn, tn, mn) = res['asn_resumen_viejo'], res['asn_resumen_nuevo']
fallos = 0
def chk(ok, t):
    global fallos
    if not ok: fallos += 1
    print(('  OK   ' if ok else '  FALLA ') + t)

# 1) la tabla de articulos por ASN es identica (cantidades, descripciones)
chk(tv == tn, 'la tabla (cantidades por ASN y articulo) no cambia')
# 2) en la ficha de cada ASN solo cambian fecha y hora de recepcion, y son 5 horas antes
cambian, bien, otros = 0, 0, 0
for asn in mv:
    a, b = mv[asn], mn[asn]
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y and i not in (6, 7): otros += 1
    if a[6] and a[7]:
        dv = datetime.datetime.strptime(a[6] + ' ' + a[7], '%Y-%m-%d %H:%M:%S')
        dn = datetime.datetime.strptime(b[6] + ' ' + b[7], '%Y-%m-%d %H:%M:%S')
        cambian += 1; bien += (dv - dn) == datetime.timedelta(hours=5)
chk(otros == 0, 'en la ficha del ASN no cambia nada fuera de la fecha y la hora de recepcion (%d)' % otros)
chk(cambian and bien == cambian, 'fecha+hora de recepcion: %d de %d quedan exactamente 5 horas antes' % (bien, cambian))
# 3) el paquete: igual salvo las recepciones por mes
kv = {k for k in pv if json.dumps(pv[k], sort_keys=True, default=str) != json.dumps(pn[k], sort_keys=True, default=str)}
chk(kv <= {'recepciones', 'generado', 'recibido_sin_fecha'}, 'en el paquete solo cambia lo recibido por mes: %s' % sorted(kv))
suma = lambda p: sum(x.get('unid', 0) for x in (p.get('recepciones') or {}).values()) if isinstance(p.get('recepciones'), dict) else sum(x.get('unid', 0) for x in (p.get('recepciones') or []))
chk(abs(suma(pv) - suma(pn)) < 0.5, 'lo recibido total es el mismo (%.0f y %.0f), solo se reparte distinto entre meses' % (suma(pv), suma(pn)))
# 4) la guia que miro Daniel
for asn in ('T60900000406', 'T72700001106'):
    if asn in mn: print('   %s: antes %s %s -> ahora %s %s' % (asn, mv[asn][6], mv[asn][7], mn[asn][6], mn[asn][7]))
hs = sorted({int(v[7][:2]) for v in mn.values() if v[7] and v[0] and False} )
from collections import Counter
hv = Counter(int(v[7][:2]) for a, v in mv.items() if v[7] and a.startswith('T'))
hn = Counter(int(v[7][:2]) for a, v in mn.items() if v[7] and a.startswith('T'))
print('   horas de ingreso de las T, antes:', sorted(hv.items()))
print('   horas de ingreso de las T, ahora:', sorted(hn.items()))
print('FALLAS:', fallos)
