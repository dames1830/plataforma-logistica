# -*- coding: utf-8 -*-
"""IMPORTAR EL EXCEL DE COMERCIAL AL AREA despacho_catalogo.

Es el PRIMER paso de dos. El segundo es `despacho_partir_por_semana.py`, que corta lo
que deja este en un area por semana; sin correrlo, la web y el celular no ven lo nuevo,
porque ya no leen el paquete entero -leen el indice y las semanas-.

    python despacho_importar_excel.py            # deja el paquete en despacho_catalogo
    python despacho_partir_por_semana.py --subir # lo corta en semanas y arma el indice

Deja el area lo bastante liviana para que la baje un celular.

EL PROBLEMA. Las 3.129 filas tal cual pesan 1.497 KB, y esta area se descarga ENTERA
al navegador. Un megabyte y medio en un celular del almacen es medio minuto de espera
la primera vez.

LAS TRES COSAS QUE LA ADELGAZAN, sin perder un solo dato:

  1. CATALOGO PARA LO QUE SE REPITE. "Transporte y Logistica TEX S.A" esta escrito
     3.129 veces; las agencias son 102 valores para 3.129 filas. Se guarda la lista una
     vez y cada fila lleva el numero.
  2. LA FOTO ES UN PATRON. Todas son STATUS_Images/<id>.FOTO.<hora>.jpg, y el id ya
     esta en la fila: se guarda solo la hora.
  3. FUERA EL SELLO DE REGISTRO. Es la hora en que AppSheet grabo la fila; no se muestra
     en ninguna pantalla y pesa 83 KB.
"""
import collections
import io
import json
import re

ENTRADA = 'despacho_catalogo.json'
SALIDA = 'despacho_catalogo_listo.json'

# Campos con pocos valores distintos: van a catalogo.
CATALOGO = ('ase', 'age', 'dest', 'est', 'lider', 'factA', 'decl', 'flete', 'obs')
FOTO = re.compile(r'^STATUS_Images/(\d+)\.FOTO\.(.+)$')

filas = json.load(io.open(ENTRADA, encoding='utf-8'))['filas']

cat, idx = {}, {}
for c in CATALOGO:
    vistos = []
    pos = {}
    for f in filas:
        v = f.get(c)
        if v not in (None, '') and v not in pos:
            pos[v] = len(vistos)
            vistos.append(v)
    cat[c] = vistos
    idx[c] = pos

compactas = []
fotos_raras = 0
for f in filas:
    g = {}
    for k, v in f.items():
        if k == 'reg':
            continue                       # 3
        if k in CATALOGO:
            g[k] = idx[k][v]               # 1
        elif k == 'foto':
            m = FOTO.match(v)              # 2
            if m and m.group(1) == str(f.get('id')):
                g['foto'] = m.group(2)
            else:
                g['fotoX'] = v             # la que no sigue el patron, entera
                fotos_raras += 1
        else:
            g[k] = v
    compactas.append(g)

paquete = {
    'version': 1,
    'origen': 'BBDD Catalogo.xlsx · pestaña Status',
    'importado': '2026-09-15',
    # Como se rearma la ruta de la foto, para que no haya que adivinarlo despues.
    'fotoPatron': 'STATUS_Images/{id}.FOTO.{foto}',
    'cat': cat,
    'filas': compactas,
}
crudo = json.dumps(paquete, ensure_ascii=False, separators=(',', ':'))
io.open(SALIDA, 'w', encoding='utf-8').write(crudo)

kb = len(crudo.encode('utf-8')) / 1024
print('filas        : %s' % format(len(compactas), ','))
print('fotos fuera del patron: %d' % fotos_raras)
print('catalogos    : %s' % ', '.join('%s=%d' % (c, len(cat[c])) for c in CATALOGO))
print()
print('%s : %s KB   (antes 1,497 KB)' % (SALIDA, format(round(kb), ',')))

# COMPROBACION: que no se haya perdido nada por el camino.
rearmada = 0
for o, g in zip(filas, compactas):
    for k, v in o.items():
        if k == 'reg':
            continue
        if k in CATALOGO:
            assert cat[k][g[k]] == v, 'catalogo roto en %s' % k
        elif k == 'foto':
            vuelta = ('STATUS_Images/%s.FOTO.%s' % (g.get('id'), g['foto'])) if 'foto' in g else g.get('fotoX')
            assert vuelta == v, 'la foto no se rearma: %s -> %s' % (v, vuelta)
            rearmada += 1
        else:
            assert g.get(k) == v, 'se perdio %s' % k
print('comprobado   : las %s filas se rearman iguales, %s fotos incluidas'
      % (format(len(filas), ','), format(rearmada, ',')))
