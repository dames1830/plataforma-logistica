# -*- coding: utf-8 -*-
"""
atender_ordenes.py  -  Relanzar un robot desde el celular, sin entrar al servidor.

  Daniel, 15-sep-2026: *"ya, me manda el robot se ejecuto mal, que hago si no tengo la
  laptop a la mano? Desde el celular, yo puedo hacer algo, puedo mandar un comando, algo
  para que el robot lo vuelva a procesar"*.

  COMO FUNCIONA, Y POR QUE ASI. El celular no habla con el servidor: **deja el pedido en
  la plataforma** -el area `robot_ordenes`- y esta tarea, que corre cada pocos minutos en
  el Contabo, lo recoge y lo ejecuta. Nadie abre un puerto ni pone una clave en el
  telefono; el servidor sigue sin aceptar ordenes de fuera, solo va a buscarlas.

  LAS CINCO REGLAS QUE LO HACEN SEGURO. Esto lanza procesos de verdad sobre el almacen,
  asi que cada una esta por algo:

    1. SOLO LOS ROBOTS DE LA LISTA. Lo que no este en ROBOTS no se ejecuta, aunque el
       pedido lo diga. El Robot Oracle WMS queda FUERA a proposito: tarda veinte minutos,
       maneja Excel y Playwright y es el que deja el stock del turno. Relanzarlo a ciegas
       desde un telefono es justo lo que no hay que poder hacer.
    2. SI YA ESTA CORRIENDO, NO SE LANZA. Es el error que costo la noche del 14-sep: dos
       robots arrancaron a la vez y uno murio. Un boton que lo repita seria peor que no
       tener boton.
    3. LA ORDEN CADUCA. Pasados TOPE_MIN minutos no se ejecuta: un pedido de anoche que
       se atiende a las seis de la manana hace algo que ya nadie espera.
    4. UNA ORDEN SE ATIENDE UNA VEZ. Se marca antes de lanzar, no despues: si el robot
       tarda y la tarea vuelve a pasar, no arranca un segundo.
    5. QUEDA ESCRITO QUIEN LO PIDIO. En el Log, con nombre y hora.

  TAMBIEN SILENCIA. El otro boton -*"lo reviso yo, no avises mas hoy"*- no lanza nada:
  marca el dia como hecho para que el aviso del cierre no vuelva a sonar. Ver
  avisar_push.py.
"""

import io
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import anotar_log

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics/robot_ordenes?date=MASTER'
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')
TOPE_MIN = 30
NOVEDADES = os.path.join(AQUI, 'novedades')

# CLAVE -> (tarea de Windows, lanzador). Lo que no este aca no se puede relanzar.
ROBOTS = {
    'despacho_potencial': ('Robot despacho potencial', 'ejecutar_potencial.bat'),
    'correo_citas':       ('Robot correo citas',       'ejecutar_correo_citas.bat'),
    'distribucion':       ('Robot distribucion',       'ejecutar_distribucion.bat'),
    'cruce_wms':          ('Robot cruce WMS',          'ejecutar_cruce_wms.bat'),
    'corte_turno':        ('Robot corte de turno',     'ejecutar_corte_turno.bat'),
    'asn_web':            ('Robot ASN',                'ejecutar_asn.bat'),
    'oblpn_hora':         ('Robot embalaje por hora',  'ejecutar_oblpn_hora.bat'),
    'cierre_dia':         ('Robot cierre dia',         'ejecutar_cierre_dia.bat'),
}


# SU PROPIO REGISTRO, sin un .bat de por medio. La tarea de Windows llama a Python
# directo: un lanzador solo para redirigir la salida es una pieza mas que se puede
# romper -y los .bat de aca ya dieron guerra con los acentos-.
REGISTRO = os.path.join(AQUI, 'logs', 'atender_ordenes.txt')


def log(t):
    linea = '[%s] %s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), t)
    print(linea)
    sys.stdout.flush()
    try:
        carpeta = os.path.dirname(REGISTRO)
        if not os.path.isdir(carpeta):
            os.makedirs(carpeta)
        # Se recorta solo: son dos lineas cada tres minutos, o sea ~960 al dia.
        if os.path.exists(REGISTRO) and os.path.getsize(REGISTRO) > 400000:
            with io.open(REGISTRO, encoding='utf-8', errors='replace') as fh:
                cola = fh.read()[-120000:]
            with io.open(REGISTRO, 'w', encoding='utf-8') as fh:
                fh.write(cola)
        with io.open(REGISTRO, 'a', encoding='utf-8') as fh:
            fh.write(linea + chr(10))
    except Exception:
        pass


def _pedir(datos=None):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8') if datos is not None else None
    req = urllib.request.Request(API, data=cuerpo,
                                 method='POST' if datos is not None else 'GET',
                                 headers={'Content-Type': 'application/json'})
    if ROBOT_TOKEN:
        req.add_header('X-Robot-Token', ROBOT_TOKEN)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r) if datos is None else r.status


def leer_ordenes():
    try:
        env = _pedir()
        d = env.get('data', env) if isinstance(env, dict) else env
        if isinstance(d, dict) and isinstance(d.get('ordenes'), list):
            return d['ordenes']
        return []
    except Exception as e:
        log('no se pudo leer el area de ordenes: %s' % str(e)[:90])
        return None          # None = no se pudo preguntar; [] = no hay ninguna


def guardar_ordenes(ordenes):
    try:
        _pedir({'ordenes': ordenes[-40:]})       # las ultimas 40, no hace falta mas
        return True
    except Exception as e:
        log('no se pudo guardar el area de ordenes: %s' % str(e)[:90])
        return False


def esta_corriendo(tarea):
    """True si la tarea de Windows esta en marcha. ANTE LA DUDA, True: no lanzar."""
    try:
        r = subprocess.run(
            ['powershell', '-NoProfile', '-Command',
             "(Get-ScheduledTask -TaskName '%s').State" % tarea.replace("'", "''")],
            capture_output=True, text=True, timeout=45)
        return 'Running' in (r.stdout or '')
    except Exception as e:
        log('   no se pudo comprobar si %s esta corriendo (%s): no se lanza' % (tarea, str(e)[:50]))
        return True


def marcar_hecho(clave):
    """El dia queda por hecho: el aviso del cierre no vuelve a sonar hoy."""
    try:
        if not os.path.isdir(NOVEDADES):
            os.makedirs(NOVEDADES)
        with io.open(os.path.join(NOVEDADES, clave + '.hecho'), 'w', encoding='utf-8') as fh:
            fh.write(datetime.now().strftime('%Y-%m-%d'))
        return True
    except Exception:
        return False


def relanzar(clave, quien):
    tarea, bat = ROBOTS[clave]
    if esta_corriendo(tarea):
        log('   %s YA ESTA CORRIENDO: no se lanza otro encima' % tarea)
        anotar_log.anotar(clave, 'No se relanzó: ya estaba corriendo', tipo='aviso',
                          consecuencia='Lo pidió %s desde el celular. El robot ya estaba '
                                       'trabajando, así que se dejó terminar en vez de '
                                       'arrancar un segundo encima.' % quien)
        return False

    ruta = os.path.join(AQUI, bat)
    if not os.path.exists(ruta):
        log('   no existe el lanzador %s' % bat)
        anotar_log.anotar(clave, 'No se pudo relanzar', tipo='error',
                          consecuencia='Falta el lanzador %s en el servidor.' % bat)
        return False

    log('   lanzando %s ...' % bat)
    anotar_log.anotar(clave, 'Relanzado a mano desde el celular', tipo='ok',
                      consecuencia='Lo pidió %s. Se está ejecutando ahora; cuando termine '
                                   'llega el aviso con el resultado.' % quien)
    try:
        r = subprocess.run([ruta], cwd=AQUI, capture_output=True, text=True, timeout=55 * 60)
        codigo = r.returncode
    except Exception as e:
        log('   se cayó al ejecutar: %s' % str(e)[:90])
        anotar_log.anotar(clave, 'Falló al relanzarlo', tipo='error',
                          consecuencia=anotar_log.consecuencia_de(clave),
                          tecnico=str(e)[:800])
        return False

    log('   %s terminó con código %s' % (bat, codigo))
    # El aviso al celular sale por el camino de siempre, para que diga lo mismo que
    # cuando el robot corre solo.
    try:
        subprocess.run([sys.executable, os.path.join(AQUI, 'avisar_push.py'),
                        '--robot', clave, '--resultado', str(codigo)],
                       cwd=AQUI, capture_output=True, text=True, timeout=180)
    except Exception:
        pass
    return codigo == 0


def main():
    ordenes = leer_ordenes()
    if ordenes is None:
        return 1
    pendientes = [o for o in ordenes if isinstance(o, dict) and o.get('estado') == 'pendiente']
    if not pendientes:
        log('no hay ninguna orden pendiente')
        return 0

    log('%d orden(es) pendiente(s)' % len(pendientes))
    corte = datetime.now() - timedelta(minutes=TOPE_MIN)
    cambio = False

    for o in pendientes:
        clave = str(o.get('robot') or '')
        quien = str(o.get('pedidoPor') or 'alguien')
        que = str(o.get('que') or 'relanzar')
        log('orden: %s · %s · pedida por %s' % (que, clave, quien))

        # 3. caducada
        try:
            cuando = datetime.strptime(str(o.get('cuando'))[:19], '%Y-%m-%d %H:%M:%S')
        except Exception:
            cuando = datetime.now()
        if cuando < corte:
            log('   caducada (de las %s): no se ejecuta' % cuando.strftime('%H:%M'))
            o['estado'] = 'caducada'
            cambio = True
            continue

        # 1. lista blanca
        if que == 'relanzar' and clave not in ROBOTS:
            log('   %s no está en la lista de los que se pueden relanzar' % clave)
            o['estado'] = 'no permitido'
            cambio = True
            continue

        # 4. se marca ANTES de lanzar
        o['estado'] = 'atendida'
        o['atendidaEl'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cambio = True
        guardar_ordenes(ordenes)

        if que == 'silenciar':
            marcar_hecho(clave)
            log('   %s queda por hecho hoy: no vuelve a avisar' % clave)
            anotar_log.anotar(clave, 'Lo revisa %s · no avisa más hoy' % quien, tipo='aviso',
                              consecuencia='Se marcó a mano desde el celular. Mañana '
                                           'vuelve a avisar como siempre.')
        else:
            relanzar(clave, quien)

    if cambio:
        guardar_ordenes(ordenes)
    return 0


if __name__ == '__main__':
    sys.exit(main())
