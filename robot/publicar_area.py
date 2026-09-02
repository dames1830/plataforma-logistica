# -*- coding: utf-8 -*-
"""
SUBIR UN DATO A LA PLATAFORMA, EN LOS DOS ENTORNOS.

Lo usan los tres robots de la produccion del dia. Estaba repetido en cada uno y
es la misma media pagina: se saca aca para que el dia que cambie la direccion del
servidor o el token se cambie en un solo sitio.

VA A PRODUCCION Y A BETA. Las tres pantallas nacieron en beta el 02-sep-2026 y
todavia se estan probando; si el robot publicara solo en produccion, beta se
quedaria con el dia suelto que se subio a mano y no habria como probar nada. Y
cuando Daniel de la orden de pasar a produccion, el dato ya va a estar puesto.
La cabecera `X-Environment: beta` es la que hace que el servidor escriba en
`database_beta.db`; sin ella cae en produccion.

QUE BETA FALLE NO PUEDE TUMBAR LA CORRIDA. Produccion es la que importa: si beta
no contesta se avisa y se sigue. Al reves no: si falla produccion, la funcion
devuelve False y el robot lo registra como error.
"""
import json
import os
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'
# EL TOKEN DEL ROBOT. Desde v29.0415 el servidor puede EXIGIR credencial para
# escribir (ver EXIGIR_TOKEN_ESCRITURA en backend/main.py). Se lee del entorno:
# la clave NUNCA se escribe en el codigo ni viaja por el chat.
TOKEN = os.environ.get('ROBOT_TOKEN', '')

ENTORNOS = (('produccion', None), ('beta', 'beta'))


def _enviar(area, datos, fecha, entorno, intentos):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    url = '%s/%s?date=%s' % (API, area, fecha) if fecha else '%s/%s' % (API, area)
    for i in range(1, intentos + 1):
        try:
            p = urllib.request.Request(url, data=cuerpo, method='POST')
            p.add_header('Content-Type', 'application/json')
            if entorno:
                p.add_header('X-Environment', entorno)
            if TOKEN:
                p.add_header('X-Robot-Token', TOKEN)
            with urllib.request.urlopen(p, timeout=300) as r:
                json.loads(r.read().decode('utf-8'))
            return True, len(cuerpo)
        except Exception as e:
            if i >= intentos:
                return '%s: %s' % (type(e).__name__, str(e)[:160]), len(cuerpo)
    return 'sin intentos', len(cuerpo)


def publicar(area, datos, fecha, log=print, intentos=3):
    """Sube `datos` al area, en produccion y en beta. True si produccion entro."""
    ok_prod = False
    for nombre, cabecera in ENTORNOS:
        res, peso = _enviar(area, datos, fecha, cabecera, intentos)
        if res is True:
            log('Publicado en %s: %s del %s, %.0f KB'
                % (nombre, area, fecha, peso / 1024.0))
            if nombre == 'produccion':
                ok_prod = True
        else:
            log('No se pudo publicar en %s: %s' % (nombre, res),
                'ERROR' if nombre == 'produccion' else 'AVISO')
    return ok_prod
