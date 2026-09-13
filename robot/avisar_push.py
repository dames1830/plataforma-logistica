# -*- coding: utf-8 -*-
"""
avisar_push.py  -  Le avisa al celular, con la pantalla apagada y la app cerrada.

  Daniel, 12-sep-2026: *"al admin que le lleguen todos los cortes de los robots, y a
  todos los demas solamente el chat y los cortes de stock de las siete de la mañana
  y las siete de la noche"*.

  POR QUE HACE FALTA. La plataforma se entera de las cosas PREGUNTANDO: el radar
  consulta cada 20 segundos. Eso sirve en una PC encendida, pero un celular en el
  bolsillo no pregunta nada -el navegador congela la pagina al apagar la pantalla-.
  Con esto es al reves: el servidor avisa.

  QUIEN RECIBE QUE
      admin (dames)   cada robot que corre, los cortes de stock y el chat
      los demas       los cortes de stock de 07:00 y 19:00, y el chat

  DE DONDE SALEN LOS TELEFONOS. Del area `push_suscripciones`, que escribe la propia
  app cuando la persona activa los avisos. **No hace falta tocar el servidor de
  Render**: es un area mas, como las del chat.

  LA LLAVE PRIVADA NO ESTA ACA. Vive en el entorno del Contabo como variable de
  MAQUINA (`VAPID_PRIVADA`), igual que `ROBOT_TOKEN`. Una vez se subio una credencial
  al repositorio por error y hubo que cambiarla; no se repite.

  SE LIMPIA SOLO. Cuando un servicio contesta 404 o 410, ese telefono ya no existe
  -desinstalaron la app, borraron los datos- y la suscripcion se da de baja. Sin eso,
  la lista crece con destinatarios muertos y cada corrida tarda mas en fallar.

  Uso:
    python avisar_push.py --robot "Robot ASN" --resultado 0     avisa como le fue
    python avisar_push.py --texto "prueba" --a dames            un aviso suelto
    python avisar_push.py --probar                              dice a quien le llegaria
    python avisar_push.py --listar                              los telefonos suscritos
    python avisar_push.py --beta --texto "hola" --a dames        contra la base de PRUEBAS
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

API = 'https://logistics-backend-wv0x.onrender.com'
AREA = 'push_suscripciones'
FOTO = 'date=MASTER'          # las areas del celular viven en MASTER, no en la foto del dia
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')
VAPID_PRIVADA = os.environ.get('VAPID_PRIVADA', '')
VAPID_CORREO = os.environ.get('VAPID_CORREO', 'mailto:dames1830@gmail.com')
TIMEOUT = 60

ADMIN = 'dames'
USAR_BETA = False

# QUE ROBOT ES CADA COSA, con el nombre que se entiende en un aviso de dos lineas. La
# clave es el nombre de la tarea programada, tal como la escribe `correr_si_toca.bat`.
NOMBRES = {
    'asn_web': 'ASN',
    'ancla_noche': 'Corte de stock de las 19:00',
    'ancla_manana': 'Corte de stock de las 07:00',
    'stock_hora': 'Stock por hora',
    'picking_hora': 'Picking por hora',
    'oblpn_hora': 'Embalaje por hora',
    'mapa_hora': 'Mapa de calor',
    'reportes': 'Pendientes y Despachados',
    'respaldo': 'Respaldo',
    'archivado': 'Archivado',
    'cierre_dia': 'Cierre del día',
    'cruce_wms': 'Cruce del WMS',
    'correo_citas': 'Correo de citas',
    'corte_turno': 'Corte de turno',
    'distribucion': 'Distribución',
    'despacho_potencial': 'Despacho potencial',
}

# LOS DOS CORTES QUE LE INTERESAN A TODO EL MUNDO. Del resto solo se entera el admin.
PARA_TODOS = ('ancla_manana', 'ancla_noche')


def log(t, nivel='INFO'):
    print('[%s] %-5s %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t))
    sys.stdout.flush()


def _pedir(ruta, datos=None, metodo=None):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8') if datos is not None else None
    cab = {'Content-Type': 'application/json', 'User-Agent': 'avisar-push'}
    if ROBOT_TOKEN:
        cab['X-Robot-Token'] = ROBOT_TOKEN
    if USAR_BETA:
        cab['X-Environment'] = 'beta'
    req = urllib.request.Request('%s%s' % (API, ruta), data=cuerpo,
                                 method=metodo or ('POST' if datos is not None else 'GET'),
                                 headers=cab)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode('utf-8'))


def telefonos():
    """Los que de verdad pueden recibir: con endpoint y sin baja."""
    c = _pedir('/api/logistics/%s?%s&z=%d' % (AREA, FOTO, int(time.time())))
    d = c.get('data', c) if isinstance(c, dict) else c
    lista = d if isinstance(d, list) else []
    return [s for s in lista if s and s.get('endpoint') and not s.get('baja')]


def guardar_telefonos(lista):
    return _pedir('/api/logistics/%s?%s' % (AREA, FOTO), lista)


def a_quien(clave):
    """A quien le toca este aviso. El admin recibe todo; los demas, solo los dos cortes."""
    todos = telefonos()
    if clave in PARA_TODOS or clave == 'chat':
        return todos
    return [t for t in todos if str(t.get('usuario')) == ADMIN]


def mandar(suscripcion, titulo, cuerpo, url='./index.html', etiqueta='deam'):
    """Devuelve (ok, codigo). El codigo sirve para saber si hay que darla de baja."""
    from pywebpush import webpush, WebPushException
    datos = json.dumps({'titulo': titulo, 'cuerpo': cuerpo, 'url': url, 'etiqueta': etiqueta},
                       ensure_ascii=False)
    try:
        webpush(
            subscription_info={'endpoint': suscripcion['endpoint'], 'keys': suscripcion['claves']},
            data=datos,
            vapid_private_key=VAPID_PRIVADA,
            vapid_claims={'sub': VAPID_CORREO},
            ttl=3600)          # una hora: un aviso de anoche ya no le sirve a nadie
        return True, 201
    except WebPushException as e:
        codigo = getattr(getattr(e, 'response', None), 'status_code', 0)
        return False, codigo


def avisar(clave, titulo, cuerpo, url='./index.html', etiqueta=None, de_verdad=True):
    destinos = a_quien(clave)
    if not destinos:
        log('nadie tiene los avisos activados para "%s"' % clave, 'AVISO')
        return 0
    log('%s  ->  %d telefono(s): %s' % (titulo, len(destinos),
                                        ', '.join(sorted(set(str(t.get('usuario')) for t in destinos)))))
    if not de_verdad:
        log('   (simulacion: no se manda nada)')
        return 0

    if not VAPID_PRIVADA:
        log('falta VAPID_PRIVADA en el entorno del servidor: no se puede mandar', 'ERROR')
        return 1

    caidos, mandados = [], 0
    for t in destinos:
        ok, codigo = mandar(t, titulo, cuerpo, url, etiqueta or clave)
        if ok:
            mandados += 1
        elif codigo in (404, 410):
            # Ese telefono ya no existe: desinstalaron la app o borraron los datos.
            caidos.append(t.get('id'))
            log('   %s: ya no existe (%s), se da de baja' % (t.get('usuario'), codigo), 'AVISO')
        else:
            log('   %s: no se pudo (%s)' % (t.get('usuario'), codigo or 'sin respuesta'), 'AVISO')

    if caidos:
        vivos = [s for s in telefonos() if s.get('id') not in caidos]
        try:
            guardar_telefonos(vivos)
        except Exception as e:
            log('no se pudo limpiar la lista: %s' % str(e)[:80], 'AVISO')

    log('avisados: %d de %d' % (mandados, len(destinos)))
    return 0


def main():
    global USAR_BETA
    args = sys.argv[1:]
    USAR_BETA = '--beta' in args
    if USAR_BETA:
        log('contra la base de PRUEBAS (beta)')
    def valor(bandera, porDefecto=None):
        return args[args.index(bandera) + 1] if bandera in args else porDefecto

    probar = '--probar' in args

    if '--listar' in args:
        for t in telefonos():
            log('%-12s %s  (%s)' % (t.get('usuario'), str(t.get('id'))[-8:], str(t.get('telefono'))[:50]))
        return 0

    if '--texto' in args:
        texto = valor('--texto', 'Prueba')
        quien = valor('--a', ADMIN)
        destinos = [t for t in telefonos() if str(t.get('usuario')) == quien]
        if not destinos:
            log('%s no tiene ningun telefono con avisos activados' % quien, 'AVISO')
            return 0
        if probar:
            log('le llegaria a %s en %d telefono(s)' % (quien, len(destinos)))
            return 0
        for t in destinos:
            ok, codigo = mandar(t, 'Logística Deam1830', texto)
            log('   %s: %s' % (quien, 'listo' if ok else 'falló (%s)' % codigo))
        return 0

    robot = valor('--robot')
    if not robot:
        log('falta --robot o --texto. Ver el encabezado del archivo.', 'ERROR')
        return 2

    resultado = valor('--resultado', '0')
    clave = robot.strip().strip('"')
    nombre = NOMBRES.get(clave, clave)
    bien = str(resultado).strip() in ('0', '')

    titulo = ('✅ ' if bien else '⚠️ ') + nombre
    cuerpo = ('Terminó bien · %s' % datetime.now().strftime('%H:%M')) if bien \
        else ('Terminó con problema (código %s) · %s' % (resultado, datetime.now().strftime('%H:%M')))

    return avisar(clave, titulo, cuerpo, etiqueta=clave, de_verdad=not probar)


if __name__ == '__main__':
    sys.exit(main())
