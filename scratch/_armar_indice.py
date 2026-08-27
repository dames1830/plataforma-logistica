# -*- coding: utf-8 -*-
"""Arma scratch/index.html: UN solo enlace con todas las maquetas y pruebas.

Daniel, 27-ago-2026: *"no me puedes mandar un solo link para todas las maquetas; a cada
rato estoy abriendo otra pestana"*. Tiene razon.

La descripcion de cada pagina sale del PRIMER COMENTARIO del archivo, asi que no hay una
lista escrita a mano que se desactualice: se agrega una maqueta, se corre esto, y aparece.

    python scratch/_armar_indice.py
"""
import io, os, re, glob, html, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

AQUI = os.path.dirname(os.path.abspath(__file__))

def limpiar(txt):
    txt = re.sub(r'<[^>]+>', ' ', txt)
    txt = html.unescape(' '.join(txt.split()))
    txt = re.sub(r'^[\*\s]+', '', txt)
    return txt

def descripcion(ruta):
    """De donde sale la linea que explica cada pagina, en este orden:
       1. El <div class="sub"> que la maqueta ya muestra arriba: es lo que Daniel lee.
       2. El comentario de arriba del archivo, ANTES del <style>: el de adentro del CSS
          habla de colores y no de para que sirve la pagina.
    """
    try:
        t = io.open(ruta, encoding='utf-8', errors='replace').read(12000)   # el <div class="sub"> suele venir despues de un <style> largo
    except Exception:
        return ''
    m = re.search(r'<div class="sub"[^>]*>(.*?)</div>', t, re.S)
    if m:
        txt = limpiar(m.group(1))
        if txt: return txt[:210] + ('…' if len(txt) > 210 else '')
    # Las maquetas viejas no tienen `.sub`: sirve el primer titulo o parrafo del cuerpo.
    cuerpo_ = t.split('<body')[-1]
    for patron in (r'<h1[^>]*>(.*?)</h1>', r'<h2[^>]*>(.*?)</h2>', r'<p[^>]*>(.*?)</p>'):
        m = re.search(patron, cuerpo_, re.S)
        if m:
            txt = limpiar(m.group(1))
            if len(txt) > 12: return txt[:210] + ('…' if len(txt) > 210 else '')
    antes = t.split('<style')[0]
    for patron in (r'<!--(.*?)-->', r'/\*(.*?)\*/', r'^\s*//(.*)$'):
        m = re.search(patron, antes, re.S | re.M)
        if m:
            txt = limpiar(m.group(1))
            if txt: return txt[:210] + ('…' if len(txt) > 210 else '')
    return ''

def titulo(ruta):
    try:
        t = io.open(ruta, encoding='utf-8', errors='replace').read(2600)
    except Exception:
        return ''
    m = re.search(r'<title>(.*?)</title>', t, re.S)
    return html.unescape(' '.join(m.group(1).split())) if m else ''

filas = []
for f in sorted(glob.glob(os.path.join(AQUI, '*.html'))):
    nombre = os.path.basename(f)
    if nombre == 'index.html':
        continue
    if nombre.startswith('maqueta'):   grupo, orden = 'maqueta', 0
    elif nombre.startswith('prueba'):  grupo, orden = 'prueba', 1
    else:                              grupo, orden = 'medicion', 2
    filas.append((orden, grupo, nombre, titulo(f) or nombre, descripcion(f),
                  os.path.getmtime(f)))
filas.sort(key=lambda x: (x[0], -x[5]))

GRUPOS = {
    'maqueta':  ('Maquetas', 'Lo que todavía no está en la plataforma. Míralas y dime qué cambiar.'),
    'prueba':   ('Pruebas', 'Se corren solas contra el servidor. Verde = está bien; rojo = algo se rompió.'),
    'medicion': ('Mediciones', 'Números sueltos que sacamos para decidir algo. Quedan como respaldo.'),
}

secciones, visto = [], set()
for orden, grupo, nombre, tit, desc, mt in filas:
    if grupo not in visto:
        visto.add(grupo)
        et, sub = GRUPOS[grupo]
        secciones.append('<h2>%s<span>%s</span></h2><div class="lista">' % (html.escape(et), html.escape(sub)))
    secciones.append(
        '<a href="%s"><b>%s</b><span class="arch">%s</span><p>%s</p></a>'
        % (html.escape(nombre), html.escape(tit), html.escape(nombre), html.escape(desc)))
    # cierra el grupo cuando cambia
for i, (orden, grupo, *_r) in enumerate(filas):
    pass
# cerrar todos los <div class="lista"> abiertos
abiertos = len(visto)
cuerpo = '\n'.join(secciones)
for g in GRUPOS:
    pass
cuerpo = re.sub(r'(<div class="lista">)(?=.*?<h2>)', r'\1', cuerpo, flags=re.S)
# se cierra cada lista antes del siguiente h2, y la ultima al final
cuerpo = cuerpo.replace('<h2>', '</div><h2>', abiertos)
if cuerpo.startswith('</div>'):
    cuerpo = cuerpo[6:]
cuerpo += '</div>'

PAGINA = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Maquetas y pruebas · Deam1830</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--linea:rgba(255,255,255,.09);--txt:#e6edf3;
 --txt2:#8b949e;--txt3:#57606a;--acento:#58a6ff;--verde:#3fb950}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt2);font:14px/1.6 'Segoe UI',system-ui,sans-serif;padding:26px 22px 60px}
.marco{max-width:960px;margin:0 auto}
h1{color:var(--txt);font-size:21px;font-weight:800;margin-bottom:3px}
.sub{font-size:13px;color:var(--txt3);margin-bottom:26px}
h2{color:var(--txt);font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.9px;
   margin:26px 0 10px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
h2 span{font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--txt3)}
.lista{display:flex;flex-direction:column;gap:8px}
a{display:block;text-decoration:none;background:var(--panel);border:1px solid var(--linea);
  border-radius:10px;padding:11px 14px;transition:border-color .15s,background .15s}
a:hover{border-color:var(--acento);background:#1c2230}
a b{color:var(--txt);font-size:14.5px;font-weight:700}
a .arch{color:var(--txt3);font-size:11px;margin-left:9px;font-family:ui-monospace,monospace}
a p{color:var(--txt2);font-size:12.5px;margin-top:3px;line-height:1.65}
.pie{margin-top:34px;padding-top:16px;border-top:1px solid var(--linea);font-size:12px;color:var(--txt3);line-height:1.85}
.pie b{color:var(--txt2)}
</style></head><body><div class="marco">
<h1>Maquetas y pruebas</h1>
<div class="sub">Guarda esta página en favoritos: es la única que hace falta. Cuando agregue algo nuevo, aparece acá solo.</div>
%s
<div class="pie">
  <b>Maquetas:</b> son dibujos, no la plataforma. Tocarlas no cambia nada del almacén.<br>
  <b>Pruebas:</b> se corren solas al abrirlas y tardan unos segundos, porque le preguntan al servidor de verdad.<br>
  Si una queda a medias o sale en rojo, mándame la foto.
</div>
</div></body></html>
""" % cuerpo

io.open(os.path.join(AQUI, 'index.html'), 'w', encoding='utf-8', newline='').write(PAGINA)
print('index.html armado con %d paginas' % len(filas))
for _o, g, n, t, d, _m in filas:
    print('   %-10s %-34s %s' % (g, n, t[:46]))
