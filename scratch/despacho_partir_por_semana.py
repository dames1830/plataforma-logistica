# -*- coding: utf-8 -*-
"""
PARTIR EL DESPACHO DE CATALOGO EN SEMANAS

Por que existe. El area `despacho_catalogo` guardaba las 3.129 guias en un solo
paquete de 1,03 MB. La web y el celular se lo bajaban ENTERO para mostrar el dia
de hoy. Daniel, 15-sep-2026: *"no es necesario que tengas los 3.000 y tantos
registros... no es mejor tener un rango de fechas y que se actualice a la fecha
actual, por ejemplo hoy dia lunes, o el lunes hasta el sabado"*.

Tiene razon y el numero lo confirma: julio 462 KB, agosto 435 KB, setiembre 224 KB.
Van ~450 KB por mes, asi que en un ano serian 5,4 MB en cada apertura, en un
celular, con datos moviles.

Como queda. Una area por SEMANA, que empieza el lunes:

    despacho_catalogo_indice          el mapa: que semanas hay y cuantas guias
    despacho_catalogo_sem_2026-09-14  la semana del lunes 14 de setiembre
    despacho_catalogo_sem_2026-09-07  la del lunes 7, y asi

Cada semana se basta a si misma -trae su propio catalogo de agencias y destinos-,
asi que se puede bajar una sola sin depender de ninguna otra. Una semana pesa
unos 110 KB: la decima parte de lo que se bajaba antes para ver el mismo dia.

El paquete original NO SE BORRA. Queda como respaldo de la importacion; si algo
sale mal se vuelve a partir desde ahi sin tener que pedirle el Excel a nadie.

    python despacho_partir_por_semana.py            # solo muestra que haria
    python despacho_partir_por_semana.py --subir    # lo sube a beta
    python despacho_partir_por_semana.py --subir --produccion
"""
import json
import sys
import datetime
import urllib.request
import collections

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'
AREA_ORIGEN = 'despacho_catalogo'
AREA_INDICE = 'despacho_catalogo_indice'
AREA_SEMANA = 'despacho_catalogo_sem_'

# Los campos que se repiten mucho viajan como numero y se resuelven contra un
# catalogo. Son los mismos que uso la importacion: agencia, destino, asesor...
CAMPOS_CATALOGO = ('ase', 'lider', 'age', 'dest', 'est', 'decl', 'flete', 'factA', 'obs')

BETA = {'X-Environment': 'beta'}


def pedir(area, cabeceras):
    url = '%s/%s?date=MASTER' % (API, area)
    pet = urllib.request.Request(url, headers=cabeceras)
    with urllib.request.urlopen(pet, timeout=180) as r:
        crudo = json.loads(r.read().decode('utf-8'))
    return crudo.get('data', crudo) if isinstance(crudo, dict) else crudo


def guardar(area, datos, cabeceras):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    cab = {'Content-Type': 'application/json'}
    cab.update(cabeceras)
    pet = urllib.request.Request('%s/%s?date=MASTER' % (API, area), data=cuerpo,
                                 headers=cab, method='POST')
    with urllib.request.urlopen(pet, timeout=180) as r:
        r.read()
    return len(cuerpo)


def abrir(paquete):
    """Deshace la compactacion: devuelve las filas con los textos puestos."""
    cat = paquete.get('cat') or {}
    sueltas = []
    for f in paquete.get('filas') or []:
        g = {}
        for k in f:
            v = f[k]
            g[k] = cat[k][v] if (k in cat and isinstance(v, int) and v < len(cat[k])) else v
        sueltas.append(g)
    return sueltas


def compactar(filas):
    """Arma el catalogo de esta semana y cambia los textos repetidos por su numero."""
    cat = {}
    for campo in CAMPOS_CATALOGO:
        vistos = []
        indice = {}
        for f in filas:
            if campo in f and isinstance(f[campo], str):
                if f[campo] not in indice:
                    indice[f[campo]] = len(vistos)
                    vistos.append(f[campo])
        # Un catalogo de una sola entrada no ahorra nada y estorba al leer.
        if len(vistos) > 1:
            cat[campo] = vistos
    apretadas = []
    for f in filas:
        g = {}
        for k in f:
            g[k] = cat[k].index(f[k]) if (k in cat and isinstance(f[k], str)) else f[k]
        apretadas.append(g)
    return cat, apretadas


def lunes_de(texto):
    """El lunes de la semana de esa fecha. '' si la fecha no sirve."""
    try:
        d = datetime.date(int(texto[0:4]), int(texto[5:7]), int(texto[8:10]))
    except Exception:
        return ''
    return (d - datetime.timedelta(days=d.weekday())).isoformat()


SIN_CERRAR = ('PENDIENTE', 'REPROGRAMAR', '')

# Los canales de la plataforma. Hoy TODO lo importado es catalogo -viene de no retail-
# y el campo ni siquiera viaja en el dato: se asume. Retail entra cuando alguien liquide
# una guia marcandola asi desde el celular. El cero explicito importa: sin el, el modulo
# de Retail leeria "no se" y caeria al total, y dirla "3 por liquidar" con cero adentro.
CANALES = ('catalogo', 'retail')


def main():
    subir = '--subir' in sys.argv
    cabeceras = {} if '--produccion' in sys.argv else dict(BETA)
    donde = 'PRODUCCION' if '--produccion' in sys.argv else 'beta'

    print('Leyendo %s de %s...' % (AREA_ORIGEN, donde))
    paquete = pedir(AREA_ORIGEN, cabeceras)
    if not paquete or not paquete.get('filas'):
        print('No hay nada en %s. Nada que partir.' % AREA_ORIGEN)
        return 1
    filas = abrir(paquete)
    patron = paquete.get('fotoPatron') or 'STATUS_Images/{id}.FOTO.{foto}'
    print('  %d guias' % len(filas))

    # Lo liquidado desde la plataforma pesa en el conteo de "sin liquidar" del
    # indice: si no se mira, el celular se bajaria semanas viejas ya cerradas.
    cambios = (pedir('despacho_catalogo_cambios', cabeceras) or {}).get('porId') or {}
    if cambios:
        print('  %d guias ya liquidadas desde la plataforma' % len(cambios))

    por_semana = collections.OrderedDict()
    for f in filas:
        clave = lunes_de(str(f.get('desp') or '')) or 'sin-fecha'
        por_semana.setdefault(clave, []).append(f)

    indice = {'version': 2, 'fotoPatron': patron, 'semanas': {},
              'total': len(filas), 'importado': paquete.get('importado') or '',
              'origen': paquete.get('origen') or '',
              'partido': datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}
    fechas = [str(f.get('desp') or '') for f in filas if f.get('desp')]
    indice['desde'] = min(fechas) if fechas else ''
    indice['hasta'] = max(fechas) if fechas else ''

    paquetes = []
    for lunes in sorted(por_semana):
        semana = por_semana[lunes]
        cat, apretadas = compactar(semana)
        cuerpo = {'version': 2, 'fotoPatron': patron, 'lunes': lunes,
                  'cat': cat, 'filas': apretadas}
        peso = len(json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'))

        # "Sin liquidar" con lo de la plataforma ya aplicado encima.
        sin = 0
        por_canal = dict((c, 0) for c in CANALES)
        n_canal = dict((c, 0) for c in CANALES)
        for f in semana:
            cambio = cambios.get(str(f.get('id'))) or {}
            est = str(cambio.get('est', f.get('est') or '')).upper()
            c = str(cambio.get('canal') or f.get('canal') or 'catalogo').lower()
            n_canal[c] = n_canal.get(c, 0) + 1
            if est in SIN_CERRAR:
                sin += 1
                por_canal[c] = por_canal.get(c, 0) + 1
        dias = sorted(set(str(f.get('desp') or '')[:10] for f in semana if f.get('desp')))
        indice['semanas'][lunes] = {'n': len(semana), 'sin': sin,
                                    'sinPorCanal': por_canal, 'porCanal': n_canal,
                                    'd0': dias[0] if dias else '',
                                    'd1': dias[-1] if dias else '',
                                    'kb': int(round(peso / 1024.0))}
        paquetes.append((AREA_SEMANA + lunes, cuerpo, peso))
        print('   %-12s %4d guias  %6.1f KB  %d sin liquidar'
              % (lunes, len(semana), peso / 1024.0, sin))

    peso_indice = len(json.dumps(indice, ensure_ascii=False).encode('utf-8'))
    print('\n   %-12s %4d semanas %6.1f KB   <- esto es lo unico que se baja siempre'
          % ('el indice', len(paquetes), peso_indice / 1024.0))
    print('   antes se bajaba %6.1f KB para ver el dia de hoy'
          % (len(json.dumps(paquete, ensure_ascii=False).encode('utf-8')) / 1024.0))

    if not subir:
        print('\nPrueba en seco. Para subirlo de verdad: --subir')
        return 0

    print('\nSubiendo a %s...' % donde)
    for area, cuerpo, _ in paquetes:
        guardar(area, cuerpo, cabeceras)
        print('   ok  %s' % area)
    guardar(AREA_INDICE, indice, cabeceras)
    print('   ok  %s' % AREA_INDICE)
    print('\nListo. El paquete original queda donde estaba, como respaldo.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
