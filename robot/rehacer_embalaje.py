# -*- coding: utf-8 -*-
"""
REHACE EL HISTORIAL DE EMBALAJE, JUNTANDO TODOS LOS ARCHIVOS.

URGENTE, 02-sep-2026. El historial que se publico de madrugada quedo mal: se
armo tomando UN ARCHIVO COMO UN DIA, y un archivo del OBLPN no es un dia.

Medido sobre los 28 que hay: `OBLPN 31-08.csv` trae 12.497 lineas del 31 pero
tambien 3.536 del 27, 1.525 del 28 y 1.458 del 26. Y al reves, las lineas de un
dia quedan repartidas entre los archivos de los dias que siguen. Comprobado
contra lo publicado:

    13-08   publicado  1.121   real 13.040   faltaba el 91%
    20-08   publicado    940   real 11.929   faltaba el 92%
    27-08   publicado  5.653   real 14.010   faltaba el 60%
    31-08   publicado 12.497   real 12.411   bien
    01-09   publicado 12.919   real 12.843   bien

Los ultimos dias estaban bien porque el archivo del propio dia si trae el dia
completo; el destrozo es de los dias viejos.

EL PICKING NO TIENE ESTE PROBLEMA: 0 de 32 archivos mezclan dias. No se toca.

Corre `produccion_embalaje.py --dia X --juntando` para cada dia, que es el que
sabe juntar y ya publica. Se puede correr de nuevo sin miedo.
"""
import csv
import io
import os
import re
import subprocess
import sys

csv.field_size_limit(10 ** 7)

AQUI = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable or os.path.join(
    os.environ.get('ProgramFiles', r'C:\Program Files'), 'Python313', 'python.exe')

BASE_CAND = [
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive',
                 'danielames.bata', 'scraping Stock'),
]
BASE = next((b for b in BASE_CAND if os.path.isdir(b)), BASE_CAND[0])
CARPETA = os.path.join(BASE, 'OBLPN Embalaje')
PATRON = re.compile(r'^OBLPN (\d{1,2})-(\d{1,2})\.csv$', re.I)
ANIO = 2026


def repartir_por_dia(destino):
    """UNA SOLA PASADA por los 30 archivos, escribiendo un CSV por dia.

    La primera version pedia dia por dia y cada uno volvia a leer los treinta
    archivos: 1.020 lecturas y mas de cuatro horas. Asi se lee cada archivo UNA
    vez y las filas caen en el dia que les toca.

    La huella de una linea es LPN + articulo + hora de empaquetado: la misma
    linea aparece en varios archivos y se escribe una sola vez.
    """
    os.makedirs(destino, exist_ok=True)
    nombres = sorted(n for n in os.listdir(CARPETA)
                     if PATRON.match(n)
                     and os.path.getsize(os.path.join(CARPETA, n)) > 200 * 1024)
    cab = None
    iH = iL = iS = -1
    vistas = set()
    salidas = {}          # dia -> (archivo, writer)
    cuenta = {}
    try:
        for k, n in enumerate(nombres, 1):
            f = io.open(os.path.join(CARPETA, n), encoding='utf-8-sig',
                        newline='', errors='replace')
            cabeza = f.read(4000)
            f.seek(0)
            delim = ';' if cabeza.count(';') > cabeza.count(',') else ','
            r = csv.reader(f, delimiter=delim)
            c = [x.strip() for x in next(r)]
            if cab is None:
                cab = c
                iH = c.index('Registro de hora de empaquetado')
                iL = c.index('Número de LPN')
                iS = c.index('Código de artículo')
            elif c != cab:
                print('  %s tiene otras columnas: se saltea' % n)
                f.close()
                continue
            nuevas = 0
            for x in r:
                if iH >= len(x):
                    continue
                hs = x[iH].strip().strip('"')
                m = re.match(r'^(\d{2})/(\d{2})/(\d{4})\s', hs)
                if not m:
                    continue
                huella = (x[iL] if iL < len(x) else '', x[iS] if iS < len(x) else '', hs)
                if huella in vistas:
                    continue
                vistas.add(huella)
                dia = '%s-%s-%s' % (m.group(3), m.group(2), m.group(1))
                if dia not in salidas:
                    ruta = os.path.join(destino, 'OBLPN %s-%s.csv' % (m.group(1), m.group(2)))
                    fo = io.open(ruta, 'w', encoding='utf-8-sig', newline='')
                    w = csv.writer(fo, delimiter=delim)
                    w.writerow(cab)
                    salidas[dia] = (fo, w, ruta)
                    cuenta[dia] = 0
                salidas[dia][1].writerow(x)
                cuenta[dia] += 1
                nuevas += 1
            f.close()
            print('  %2d/%d  %-18s %s filas nuevas' % (k, len(nombres), n, '{:,}'.format(nuevas)))
            sys.stdout.flush()
    finally:
        for fo, _, _ in salidas.values():
            try:
                fo.close()
            except Exception:
                pass
    return {d: (salidas[d][2], cuenta[d]) for d in salidas}


def main():
    destino = os.path.join('C:' + os.sep, 'wms_scraping', 'logs', 'embalaje_por_dia')
    print('PASO 1 - se reparten las filas por dia, leyendo cada archivo una sola vez')
    print('')
    porDia = repartir_por_dia(destino)
    dias = sorted(porDia)
    print('')
    print('  %d dias distintos, %s filas unicas'
          % (len(dias), '{:,}'.format(sum(c for _, c in porDia.values()))))
    print('')

    # LOS DIAS DE UNA SOLA LINEA SON RESTOS, no jornadas. Aparecen porque una foto
    # trae un LPN empaquetado hace meses. No se publican: ensucian la serie.
    MINIMO = 200
    buenos = [d for d in dias if porDia[d][1] >= MINIMO]
    flacos = [d for d in dias if porDia[d][1] < MINIMO]
    if flacos:
        print('  se saltean %d dias con menos de %d lineas -restos de fotos viejas-: %s'
              % (len(flacos), MINIMO, ', '.join(flacos)))
        print('')

    print('PASO 2 - se calcula y publica cada dia')
    print('')
    hechos = fallados = 0
    for i, d in enumerate(buenos, 1):
        ruta = porDia[d][0]
        r = subprocess.run([PY, '-u', os.path.join(AQUI, 'produccion_embalaje.py'),
                            ruta, '--dia', d],
                           capture_output=True, text=True, encoding='utf-8',
                           errors='replace', timeout=30 * 60)
        salida = r.stdout or ''
        ok = 'Publicado en produccion' in salida
        hechos += 1 if ok else 0
        fallados += 0 if ok else 1
        linea = next((l.strip() for l in salida.splitlines() if l.startswith('DIA ')), '')
        print('  %2d/%d  %s  %-6s  %s' % (i, len(buenos), d, 'OK' if ok else 'FALLO', linea[:96]))
        if not ok:
            for l in (r.stderr or salida).strip().splitlines()[-2:]:
                print('        ' + l.strip()[:130])
        sys.stdout.flush()
    print('')
    print('%d dias publicados, %d fallaron' % (hechos, fallados))
    return 0 if not fallados else 1


if __name__ == '__main__':
    sys.exit(main())
