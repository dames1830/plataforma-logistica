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

# COMO SE LLAMA CADA ROBOT EN EL TELEFONO.
#
#   Daniel, 12-sep, al ver el primero: *"eso lo ve un gerente, un jefe de logistica. Que
#   es eso? Esta bien para un tecnico"*.
#
# A la izquierda va el nombre de la tarea -jerga nuestra, la escribe `correr_si_toca.bat`-.
# A la derecha, lo que se dice en el almacen. NUNCA sale al telefono lo de la izquierda:
# si alguna clave faltara, `bonito()` la arregla antes de que nadie la lea.
NOMBRES = {
    'asn_web': 'ASN',
    # EL ANCLA SE LLAMA CAMBIO DE TURNO. "Ancla" es como le decimos entre nosotros a la
    # foto de stock que parte el dia; para quien recibe el aviso, es el cambio de turno.
    'ancla_noche': 'Cambio de turno de la noche',
    'ancla_manana': 'Cambio de turno de la mañana',
    # La tarea del WMS vigila los DOS horarios, asi que el lanzador pasa las dos claves
    # juntas. Sin esta linea el telefono decia "ancla_noche,ancla_manana".
    'ancla_noche,ancla_manana': 'Cambio de turno',
    'stock_hora': 'Stock por hora',
    'picking_hora': 'Picking por hora',
    'oblpn_hora': 'Embalaje por hora',
    'mapa_hora': 'Mapa de calor',
    'reportes': 'Pendientes y Despachados',
    'respaldo': 'Respaldo de los datos',
    'archivado': 'Archivado',
    'cierre_dia': 'Cierre del día',
    'cruce_wms': 'Cruce del WMS',
    'correo_citas': 'Correo de citas',
    'corte_turno': 'Corte de turno',
    'distribucion': 'Distribución',
    'despacho_potencial': 'Despacho potencial',
}

# LOS CAMBIOS DE TURNO, QUE LE INTERESAN A TODO EL MUNDO -son los cortes de stock de las
# 07:00 y las 19:00-. Del resto solo se entera el admin.
PARA_TODOS = ('ancla_manana', 'ancla_noche', 'ancla_noche,ancla_manana')

# CADA CUANTO PUEDE REPETIRSE EL MISMO AVISO, en minutos.
#
#   Daniel, 14-sep-2026, despues de recibir 36 avisos iguales de "Correo de citas" en
#   una tarde: *"recibir avisos cada dos horas en el rango de 12:00 a 19:00"*.
#
# HAY ROBOTS QUE MIRAN MUCHAS VECES PARA CAZAR ALGO QUE PASA UNA SOLA VEZ AL DIA: el
# correo de citas revisa el buzon cada 10 minutos de 12:00 a 19:00 -36 pases- y el
# despacho potencial hace lo suyo 11 veces. Que miren seguido esta bien: el correo
# llega cuando llega y hay que cazarlo enseguida. Lo que no puede es sonar el telefono
# cada vez.
#
# Aca se separan las dos cosas: el robot sigue mirando cada 10 minutos y el telefono
# suena cada dos horas.
#
# NO ES UN FILTRO CIEGO, y eso es lo que lo hace de fiar: si el resultado CAMBIA
# -venia bien y fallo, o venia fallando y se arreglo- el aviso sale AL MOMENTO, porque
# eso si es noticia. Lo unico que se calla es la repeticion de lo mismo. Un filtro que
# tambien se tragara los cambios seria peor que no tener aviso.
ESPACIADO = {
    'correo_citas': 120,
    'despacho_potencial': 120,
}

# Donde se apunta el ultimo aviso de cada robot, al lado del script como las demas
# marcas.
MARCAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'avisos_ultimo.json')


def _marcas():
    try:
        with open(MARCAS, encoding='utf-8') as f:
            return json.load(f) or {}
    except Exception:
        return {}


def _apuntar(clave, bien):
    """Deja constancia de este aviso.

    FALLA CALLADO A PROPOSITO. Si no se puede escribir la marca, el aviso ya salio; lo
    unico que se pierde es el espaciado del siguiente, que saldra antes de tiempo.
    Nunca al reves: un error aca no puede tragarse un aviso."""
    try:
        d = _marcas()
        d[clave] = {'cuando': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'bien': bool(bien)}
        with open(MARCAS, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
    except Exception as e:
        log('no se pudo apuntar la marca del aviso: %s' % str(e)[:80], 'AVISO')


def toca_avisar(clave, bien):
    """(si_toca, por_que). Ver ESPACIADO: solo frena la REPETICION de lo mismo."""
    minutos = ESPACIADO.get(clave)
    if not minutos:
        return True, ''
    m = _marcas().get(clave)
    if not m:
        return True, 'es el primer aviso de este robot'
    if bool(m.get('bien')) != bool(bien):
        return True, 'cambio respecto al ultimo aviso, que es justo lo que hay que contar'
    try:
        antes = datetime.strptime(str(m.get('cuando')), '%Y-%m-%d %H:%M:%S')
    except Exception:
        return True, 'la marca anterior no se entiende'
    pasados = (datetime.now() - antes).total_seconds() / 60.0
    # Si el reloj fue hacia atras, se avisa. Callar por una marca del futuro dejaria el
    # telefono mudo hasta que el reloj la alcanzara.
    if pasados < 0 or pasados >= minutos:
        return True, 'el anterior fue hace %d min y el espaciado es de %d' % (pasados, minutos)
    return False, ('se repite lo mismo de hace %d min; el espaciado de este robot es de '
                   '%d min' % (pasados, minutos))


def bonito(clave):
    """El nombre que se puede leer. Si la clave esta en la lista, el suyo; y si no -un
    robot nuevo que nadie agrego-, se la arregla: fuera los guiones bajos, una sola
    mayuscula al principio. Es la red que evita que a un jefe le llegue `foo_bar` al
    telefono, que fue exactamente el defecto de la primera noche."""
    if clave in NOMBRES:
        return NOMBRES[clave]
    partes = [p.strip() for p in clave.split(',') if p.strip()]
    legibles = [NOMBRES.get(p, p.replace('_', ' ').strip().capitalize()) for p in partes]
    # Sin repetir: "Cambio de turno, Cambio de turno" no se le manda a nadie.
    vistos, salida = set(), []
    for t in legibles:
        if t.lower() not in vistos:
            vistos.add(t.lower())
            salida.append(t)
    return ' y '.join(salida) if salida else 'Robot'


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
    nombre = bonito(clave)
    bien = str(resultado).strip() in ('0', '')
    hora = datetime.now().strftime('%H:%M')

    # EL CODIGO DE ERROR SE QUEDA ACA, en el log, que es donde sirve para arreglarlo. En el
    # telefono no dice nada: quien lo lee no puede hacer nada con un "codigo 1".
    if not bien:
        log('%s devolvió el código %s' % (clave, resultado), 'AVISO')

    titulo = ('✅ ' if bien else '⚠️ ') + nombre
    cuerpo = ('Terminó bien · %s' % hora) if bien else ('No pudo terminar · %s' % hora)

    toca, porque = toca_avisar(clave, bien)
    if not toca:
        log('no se manda: %s' % porque)
        return 0
    if porque:
        log('se manda: %s' % porque)

    salida = avisar(clave, titulo, cuerpo, etiqueta=clave, de_verdad=not probar)
    # Se apunta DESPUES de mandarlo, y solo cuando va de verdad: un --probar no puede
    # dejar callado al aviso siguiente.
    if not probar:
        _apuntar(clave, bien)
    return salida


if __name__ == '__main__':
    sys.exit(main())
