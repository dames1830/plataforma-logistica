# -*- coding: utf-8 -*-
"""
generar_respaldo.py  -  La copia de seguridad de los datos de produccion.

  Hasta el 18-ago-2026 el respaldo se hacia a mano, creando carpetas
  `Punto_Restauracion_*`. Dos problemas se vieron al revisarlos:

  1. Dependian de acordarse. El ritmo se apago solo: 50 puntos en junio,
     14 en julio, 2 en agosto. El ultimo tenia 12 dias y 150 versiones de atraso.

  2. Guardaban la base LOCAL, no la de produccion. La local tenia 24 areas con
     datos hasta el 26-may; produccion tiene 69 areas al dia. O sea que el
     respaldo del codigo servia y el de los datos no.

  Este script arregla las dos cosas: lo corre el robot todas las noches y baja
  los datos del servidor de verdad, area por area, por la misma API que usa la
  web.

  El codigo NO se respalda aca a proposito: ya vive en GitHub, que es mejor
  respaldo que cualquier copia. Lo que no esta en ningun otro lado son los datos.

  Uso:
    python generar_respaldo.py                 -> respaldo normal
    python generar_respaldo.py --probar        -> solo dice que haria
    python generar_respaldo.py --dias 60       -> conserva 60 dias en vez de 30
    python generar_respaldo.py --salida D:\\x   -> guarda en otra carpeta
"""

import io
import json
import os
import sys
import time
import urllib.request
import zipfile
from datetime import datetime, timedelta

API = 'https://logistics-backend-wv0x.onrender.com'
SALIDA = r'C:\wms_scraping\respaldos'
DIAS_QUE_SE_CONSERVAN = 30
REINTENTOS = 3
TIMEOUT = 120

# Areas que no vale la pena guardar: son pruebas que quedaron dando vueltas en el
# servidor. Si manana aparece otra, se agrega aca y listo.
SE_SALTAN = {'__prueba_hora__', 'layout_activo__histtest__',
             'layout_activo__histtest___ANT', 'layout_activo__selftest__'}


def _pedir(ruta, timeout=TIMEOUT):
    """Una lectura de la API, con reintentos. Devuelve el objeto o lanza."""
    ultimo = None
    for intento in range(1, REINTENTOS + 1):
        try:
            req = urllib.request.Request(f'{API}{ruta}',
                                         headers={'User-Agent': 'robot-respaldo'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            ultimo = e
            if intento < REINTENTOS:
                # Render duerme el servicio cuando no lo usan: el primer intento
                # puede tardar lo que tarda en despertar.
                time.sleep(5 * intento)
    raise ultimo


def listar_areas():
    """Las areas vivas en produccion, con la fecha de su ultimo cambio."""
    cuerpo = _pedir('/api/sync/versiones')
    versiones = cuerpo.get('versiones', cuerpo) if isinstance(cuerpo, dict) else {}
    return {a: v for a, v in versiones.items() if a not in SE_SALTAN}


def _tamano_legible(n):
    for unidad in ('B', 'KB', 'MB', 'GB'):
        if n < 1024 or unidad == 'GB':
            return f'{n:.1f} {unidad}' if unidad != 'B' else f'{n} B'
        n /= 1024


def hacer_respaldo(carpeta_salida, solo_probar=False):
    """Baja cada area y las deja en un zip fechado. Devuelve (ruta, resumen)."""
    areas = listar_areas()
    print(f'[RESPALDO] {len(areas)} areas en produccion')

    if solo_probar:
        for a, v in sorted(areas.items()):
            print(f'           bajaria  {a}  (ultimo cambio {v})')
        return None, {'areas': len(areas), 'probado': True}

    os.makedirs(carpeta_salida, exist_ok=True)
    sello = datetime.now().strftime('%Y%m%d_%H%M')
    destino = os.path.join(carpeta_salida, f'Respaldo_{sello}.zip')
    # Se escribe en .parcial y se renombra al final: un zip a medio escribir no
    # debe parecer un respaldo bueno si el robot se corta en el medio.
    parcial = destino + '.parcial'

    logrados, fallados, bytes_crudos = [], [], 0

    with zipfile.ZipFile(parcial, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for i, (area, version) in enumerate(sorted(areas.items()), 1):
            try:
                cuerpo = _pedir(f'/api/logistics/{area}')
                datos = cuerpo.get('data', cuerpo) if isinstance(cuerpo, dict) else cuerpo
                crudo = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
                z.writestr(f'BBDD/{area}.json', crudo)
                bytes_crudos += len(crudo.encode('utf-8'))
                logrados.append(area)
                print(f'[RESPALDO] {i:>2}/{len(areas)}  ok    {area}  '
                      f'({_tamano_legible(len(crudo))})')
            except Exception as e:
                fallados.append((area, str(e)[:120]))
                print(f'[RESPALDO] {i:>2}/{len(areas)}  FALLO {area}: {str(e)[:120]}')

        z.writestr('LEEME_RESTAURACION.txt', _leeme(sello, logrados, fallados, bytes_crudos))

    if not logrados:
        os.remove(parcial)
        raise RuntimeError('No se pudo bajar ni una sola area. No se deja un zip vacio.')

    os.replace(parcial, destino)
    comprimido = os.path.getsize(destino)
    print(f'[RESPALDO] listo: {destino}')
    print(f'[RESPALDO] {len(logrados)} areas | {_tamano_legible(bytes_crudos)} '
          f'-> {_tamano_legible(comprimido)} comprimido')
    if fallados:
        print(f'[RESPALDO] ATENCION: {len(fallados)} areas quedaron fuera: '
              f'{", ".join(a for a, _ in fallados)}')

    return destino, {'areas_ok': len(logrados), 'areas_falladas': len(fallados),
                     'bytes': comprimido}


def _leeme(sello, logrados, fallados, bytes_crudos):
    lineas = [
        'RESPALDO AUTOMATICO DE DATOS - LOGISTICA DEAM1830',
        '=' * 50,
        f'Fecha: {datetime.now():%d/%m/%Y %H:%M:%S}',
        f'Origen: {API}  (PRODUCCION, la que usa el almacen)',
        '',
        'QUE HAY ACA',
        '-' * 11,
        f'/BBDD: {len(logrados)} areas, una por archivo .json.',
        f'       {_tamano_legible(bytes_crudos)} sin comprimir.',
        '',
        'El CODIGO no esta en este respaldo, y es a proposito: vive en GitHub',
        '(dames1830/plataforma-logistica), que lo guarda mejor y con historial.',
        'Lo que no esta en ningun otro lado son los datos, y eso es esto.',
        '',
        'COMO SE RESTAURA UNA AREA',
        '-' * 25,
        'Cada .json es lo mismo que devuelve GET /api/logistics/<area>.',
        'Para devolverla al servidor se manda con POST a esa misma ruta.',
        'Conviene restaurar de a una y mirando, no todas de golpe.',
        '',
    ]
    if fallados:
        lineas += ['AREAS QUE NO SE PUDIERON BAJAR', '-' * 30]
        lineas += [f'  {a}: {motivo}' for a, motivo in fallados]
        lineas += ['', 'Estas areas NO estan en este respaldo.', '']
    lineas += ['No modificar: se pierde la validez de la copia.', '']
    return '\r\n'.join(lineas)


def rotar(carpeta_salida, dias):
    """Borra los respaldos mas viejos que N dias. Devuelve cuantos borro."""
    if not os.path.isdir(carpeta_salida):
        return 0
    limite = datetime.now() - timedelta(days=dias)
    borrados = 0
    for nombre in os.listdir(carpeta_salida):
        if not (nombre.startswith('Respaldo_') and nombre.endswith('.zip')):
            continue
        ruta = os.path.join(carpeta_salida, nombre)
        try:
            # La fecha sale del nombre, no de la fecha del archivo: copiar la
            # carpeta a otro disco cambia las fechas y borraria lo que no toca.
            sello = nombre[len('Respaldo_'):-len('.zip')]
            cuando = datetime.strptime(sello, '%Y%m%d_%H%M')
        except ValueError:
            continue
        if cuando < limite:
            os.remove(ruta)
            borrados += 1
            print(f'[RESPALDO] rotado (mas de {dias} dias): {nombre}')
    return borrados


def main():
    args = sys.argv[1:]
    solo_probar = '--probar' in args
    salida = SALIDA
    dias = DIAS_QUE_SE_CONSERVAN
    if '--salida' in args:
        salida = args[args.index('--salida') + 1]
    if '--dias' in args:
        dias = int(args[args.index('--dias') + 1])

    inicio = time.time()
    try:
        destino, resumen = hacer_respaldo(salida, solo_probar)
    except Exception as e:
        print(f'[RESPALDO] ERROR: {e}')
        return 1

    if not solo_probar:
        rotar(salida, dias)
        quedan = [n for n in os.listdir(salida)
                  if n.startswith('Respaldo_') and n.endswith('.zip')]
        ocupa = sum(os.path.getsize(os.path.join(salida, n)) for n in quedan)
        print(f'[RESPALDO] quedan {len(quedan)} respaldos, {_tamano_legible(ocupa)} en total')

    print(f'[RESPALDO] termino en {time.time() - inicio:.0f} s')
    # Si alguna area quedo fuera se avisa con codigo 2: el respaldo existe pero
    # esta incompleto, y eso no es lo mismo que haber salido bien.
    return 2 if resumen.get('areas_falladas') else 0


if __name__ == '__main__':
    sys.exit(main())
