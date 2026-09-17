# -*- coding: utf-8 -*-
"""
EL MAESTRO DE ARTICULOS ES UNO SOLO: EL QUE DANIEL PUBLICA EN LA WEB
====================================================================

Daniel, 16-sep-2026: *"como los reportes usan maestros distintos? entonces para que
cuelgo un maestro unico en la web?"*. Tenia razon.

Hasta ese dia solo tres robots leian el Maestro de la web -el avance del picking y las
dos fotos de la reserva-. Otros ocho abrian un Excel del OneDrive del servidor, y ni
siquiera era el mismo Excel:

    danielames.bata\\Maestro_Articulos.xlsx                  30.211 articulos (el del 05-sep)
        Picking por dia, Embalaje por dia, Pendiente, ASN, Cruce WMS, Distribucion
    danielames.bata\\scraping Stock\\Archivos\\Maestro_Articulos.xlsx   29.465 (el del 30-jul)
        Slotting (el robot principal) y Evolucion del articulo

Contra el de la web (W38, 30.370) al primero le faltaban 159 articulos y al segundo 905,
y la Coleccion PO no coincidia en 320 y 431. Ese dia dos modelos Puma que no estaban en
el Excel dejaron 212 pares de calzado como "sin tipo", y el Picking por dia no cuadro
con la tabla del supervisor.

AHORA TODOS LEEN ESTE. La tabla llega tal como la publico la web: la primera fila son
los titulos (CodCanal, CodArticulo, G. Gender, ... Marcas, Temporada) y cada robot sigue
buscando sus columnas por nombre, igual que hacia con el Excel.

SI LA WEB NO CONTESTA se usa la ultima copia que se bajo DE LA WEB -nunca un Excel-, y
`aviso()` lo dice para que el robot lo anote. Sin web y sin copia se lanza
`MaestroNoDisponible`: cada robot decide si se detiene o sigue sin Maestro, como ya
decidia cuando el Excel no estaba.

    import maestro_web
    tabla = maestro_web.filas()          # [titulos, fila, fila, ...]
    log(maestro_web.descripcion())       # de donde salio y de cuando es
"""
import gzip
import json
import os
import time
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'
AREA = 'articulos'
AQUI = os.path.dirname(os.path.abspath(__file__))
COPIA = os.path.join(AQUI, 'cache', 'maestro_web.json')

# UN MAESTRO CORTADO NO ROMPE NADA DE FORMA VISIBLE: deja articulos sin tipo, sin marca y
# sin coleccion, y los cuadros salen igual. El publicado tiene 30.370; la web ya no deja
# publicar uno con menos del 80% del anterior.
MINIMO_FILAS = 20000

# Las que usan los robots. Si falta alguna, la tabla no es el Maestro.
COLUMNAS = ('CodArticulo', 'G. Gender', 'Gender RIMS', 'MarcaStd', 'Coleccion PO',
            'Marcas', 'Temporada')


class MaestroNoDisponible(RuntimeError):
    """Ni la web ni la copia: no hay Maestro con que trabajar."""


_tabla = None
_descripcion = ''
_aviso = None


def _bajar(intentos=3):
    """La tabla y la fecha en que se publico. Render puede estar despertando."""
    error = None
    for n in range(1, intentos + 1):
        try:
            url = '%s/%s?date=MASTER&t=%d' % (API, AREA, int(time.time()))
            p = urllib.request.Request(url, headers={'User-Agent': 'robot-maestro-web',
                                                     'Accept-Encoding': 'gzip'})
            with urllib.request.urlopen(p, timeout=180) as r:
                cuerpo = r.read()
                if (r.headers.get('Content-Encoding') or '').lower() == 'gzip':
                    cuerpo = gzip.decompress(cuerpo)
            j = json.loads(cuerpo.decode('utf-8'))
            return j.get('data'), j.get('updated_at') or '?'
        except Exception as e:
            error = e
            if n < intentos:
                time.sleep(10 * n)
    raise error


def _motivo(tabla):
    """Por que la tabla no sirve, o None si sirve."""
    if not isinstance(tabla, list) or len(tabla) < MINIMO_FILAS + 1:
        return 'trae %s filas y se esperaban mas de %s' % (
            len(tabla) - 1 if isinstance(tabla, list) and tabla else 0, MINIMO_FILAS)
    titulos = tabla[0]
    if not isinstance(titulos, list):
        return 'la primera fila no son los titulos'
    faltan = [c for c in COLUMNAS if c not in titulos]
    if faltan:
        return 'le faltan las columnas ' + ', '.join(faltan)
    i = titulos.index('CodArticulo')
    sin_codigo = sum(1 for f in tabla[1:]
                     if not (isinstance(f, list) and i < len(f) and str(f[i]).strip().isdigit()))
    if sin_codigo > len(tabla) // 50:
        return '%d filas no traen codigo de articulo' % sin_codigo
    return None


def _guardar_copia(tabla, publicado):
    """La copia se escribe entera o no se escribe: aparte y despues se reemplaza."""
    temporal = '%s.%d.tmp' % (COPIA, os.getpid())
    try:
        os.makedirs(os.path.dirname(COPIA), exist_ok=True)
        with open(temporal, 'w', encoding='utf-8') as f:
            json.dump({'publicado': publicado, 'bajado': time.strftime('%Y-%m-%d %H:%M:%S'),
                       'data': tabla}, f, ensure_ascii=False)
        os.replace(temporal, COPIA)
    except Exception:
        # Otro robot la estaba escribiendo al mismo tiempo: la de el sirve igual.
        try:
            os.remove(temporal)
        except Exception:
            pass


def _leer_copia():
    try:
        with open(COPIA, encoding='utf-8') as f:
            c = json.load(f)
        return c['data'], c.get('publicado') or '?', c.get('bajado') or '?'
    except Exception:
        return None


def filas():
    """[titulos, fila, fila, ...] del Maestro de la web. Se baja una sola vez por corrida."""
    global _tabla, _descripcion, _aviso
    if _tabla is not None:
        return _tabla
    try:
        tabla, publicado = _bajar()
        motivo = _motivo(tabla)
        if motivo:
            raise ValueError('el Maestro de la web ' + motivo)
        _guardar_copia(tabla, publicado)
        _tabla = tabla
        _descripcion = 'Maestro de la web, publicado el %s: %s articulos' % (
            publicado, format(len(tabla) - 1, ',d'))
        return _tabla
    except Exception as e:
        falla = '%s: %s' % (type(e).__name__, str(e)[:160])
    copia = _leer_copia()
    if copia and not _motivo(copia[0]):
        tabla, publicado, bajado = copia
        _tabla = tabla
        _descripcion = 'COPIA del Maestro de la web, bajada el %s (publicado el %s): %s articulos' % (
            bajado, publicado, format(len(tabla) - 1, ',d'))
        _aviso = ('No se pudo leer el Maestro de la web (%s). Se usa la ultima copia bajada '
                  'de la web, del %s.' % (falla, bajado))
        return _tabla
    raise MaestroNoDisponible('No se pudo leer el Maestro de la web (%s) y no hay copia guardada.'
                              % falla)


def descripcion():
    """De donde salio el Maestro y de cuando es, para el log."""
    return _descripcion


def aviso():
    """El texto para anotar como aviso si se uso la copia; None si vino de la web."""
    return _aviso
