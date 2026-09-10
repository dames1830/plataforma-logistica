# -*- coding: utf-8 -*-
"""CAZA LA TRAMPA QUE ME MORDIO DOS VECES ESTA NOCHE: una comilla invertida dentro
de un bloque de CSS que vive en una plantilla de JavaScript corta la cadena y la
pantalla sale EN BLANCO, sin que `node --check` diga nada."""
import io, re, sys, glob
malos = []
for f in glob.glob('js/**/*.js', recursive=True):
    s = io.open(f, encoding='utf-8').read()
    # Los bloques de estilo: desde `<style> hasta </style>`
    for m in re.finditer(r'<style>(.*?)</style>', s, re.S):
        if '`' in m.group(1):
            malos.append((f, s[:m.start()].count('\n') + 1))
    # Y el CSS suelto en una constante de plantilla -`const CSS = ...`-, que es
    # como lo escriben varios reportes.
    for m in re.finditer(r'const CSS\s*=\s*' + chr(96) + '(.*?)' + chr(96) + ';', s, re.S):
        if chr(96) in m.group(1):
            malos.append((f, s[:m.start()].count(chr(10)) + 1))
print('bloques de estilo con comilla invertida adentro:', len(malos))
for f, l in malos:
    print('   %s:%d' % (f, l))
sys.exit(1 if malos else 0)
