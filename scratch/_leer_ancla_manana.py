# -*- coding: utf-8 -*-
"""EL STOCK ANCLA DE LA MANANA: se guarda, pero no se publica.

Daniel, 27-ago-2026: *"una cosa es que no publique y otra que no lo publique en la web.
Solamente el stock ancla de la noche se publica en la web, junto con el Slotting. El de la
manana no se publica, pero si se guarda"*.

Y es asi. La tarea de Windows "Robot Oracle WMS" tiene DOS horarios -07:00 y 19:00- y
`horario_robot.py` los distingue como `ancla_manana` y `ancla_noche`. Las dos bajan el
stock del WMS; solo la de la noche lo publica en el servidor. La de la manana deja el CSV
en OneDrive y ahi se queda.

    OneDrive\\danielames.bata\\scraping Stock\\Stock Activo\\Stock Activo DD-MM-AA 0700.csv

Esto lo lee y lo deja en el mismo formato que trae el area `almacenaje_activo`, para que la
ola de Picking Hoy no note la diferencia.

OJO CON LA RESERVA: a las 07:00 dejo de bajarse el 22-ago-2026. El ultimo archivo
`Stock Reserva ... 0700.xlsx` es de ese dia; desde entonces solo hay de las 1900. Por eso
la reserva sigue saliendo del servidor y es de la noche anterior. Para lo que se usa
-clasificar lo que NO esta abajo- alcanza, pero conviene saberlo.

    python scratch/_leer_ancla_manana.py            # el mas nuevo que haya
    python scratch/_leer_ancla_manana.py 27-08-26   # uno en particular
"""
import csv, datetime, glob, io, json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CARPETA = os.path.join(os.path.expanduser('~'), 'OneDrive', 'danielames.bata',
                       'scraping Stock', 'Stock Activo')
COLS = ['Área', 'Artículo', 'Descripción de artículo', 'Ubicación',
        'Cantidad actual', 'Cantidad asignada']
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_activo_ancla_manana.json')


def elegir(dia=None):
    """El CSV de las 0700 que toca. Sin dia, el mas nuevo por fecha DEL NOMBRE.

    No por fecha de archivo: OneDrive re-sincroniza y le cambia la fecha a un archivo
    viejo, y entonces 'el mas nuevo' seria el equivocado.
    """
    patron = os.path.join(CARPETA, 'Stock Activo *0700.csv')
    todos = glob.glob(patron)
    if not todos:
        raise SystemExit('No hay ningun "Stock Activo ... 0700.csv" en:\n  ' + CARPETA)
    if dia:
        cual = [f for f in todos if dia in os.path.basename(f)]
        if not cual:
            raise SystemExit('No hay archivo de las 0700 para %s' % dia)
        return cual[0]

    def clave(f):
        m = re.search(r'(\d{2})-(\d{2})-(\d{2}) 0700', os.path.basename(f))
        return (m.group(3), m.group(2), m.group(1)) if m else ('00', '00', '00')
    return max(todos, key=clave)


def codificacion(ruta):
    """No se adivina: se prueba y se comprueba que los acentos salgan bien."""
    for cod in ('utf-8-sig', 'utf-8', 'cp1252', 'latin-1'):
        try:
            with io.open(ruta, encoding=cod, newline='') as f:
                cab = f.readline()
            if 'Área' in cab and 'Descripción' in cab:
                return cod
        except Exception:
            continue
    raise SystemExit('No se pudo leer la cabecera de:\n  ' + ruta)


def main():
    ruta = elegir(sys.argv[1] if len(sys.argv) > 1 else None)
    cod = codificacion(ruta)
    filas = []
    with io.open(ruta, encoding=cod, newline='') as f:
        for r in csv.DictReader(f, delimiter=';'):
            d = {c: (r.get(c) or '').strip() for c in COLS}
            if d['Artículo']:
                filas.append(d)
    if not filas:
        raise SystemExit('El archivo no trajo ninguna fila con artículo:\n  ' + ruta)

    sello = datetime.datetime.fromtimestamp(os.path.getmtime(ruta)).strftime('%Y-%m-%d %H:%M:%S')
    io.open(SALIDA, 'w', encoding='utf-8', newline='').write(json.dumps(
        {'area': 'almacenaje_activo', 'updated_at': sello,
         'origen': os.path.basename(ruta), 'data': filas}, ensure_ascii=False))

    pares = 0.0
    for r in filas:
        try:
            pares += float(str(r['Cantidad actual']).replace(',', '') or 0)
        except Exception:
            pass
    print('%s' % os.path.basename(ruta))
    print('   guardado el %s · %s filas · %s pares'
          % (sello, format(len(filas), ','), format(int(pares), ',')))
    print('   -> %s' % os.path.basename(SALIDA))


if __name__ == '__main__':
    main()
