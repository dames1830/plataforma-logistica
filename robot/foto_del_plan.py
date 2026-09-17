# -*- coding: utf-8 -*-
"""
================================================================================
 LA FOTO DEL PLAN: EL AVANCE SE CUENTA DESDE QUE SE PROCESA EL ANALISIS
================================================================================

Daniel, 17-sep-2026 00:50:

    *"Si yo proceso el analisis buffer a las 8 y me dicen que yo tengo que bajar de
    la paleta 1 hasta la paleta 100, desde las 8 yo comienzo a ver si hay algun
    avance. ¿Como me vas a decir que ya van 4 de avance y que esas paletas se
    bajaron antes de las 8? Si antes de las 8 yo no he procesado nada."*

Hasta aca la Bajada de paletas y la Separacion se median contra la foto de reserva
de las 19:09, la del ancla. Pero la lista de paletas NACE cuando se procesa el
Analisis de Buffer -la noche del 16-sep fue a las 20:11:45- y todo lo que paso entre
las 19:09 y ese momento contaba como avance de una lista que todavia no existia.
Esa noche fueron 4 pares que salieron por e-commerce a las 19:17 y a las 19:30.

LO QUE HACE ESTE MODULO: una foto de la reserva y del buffer tomada DESPUES de
procesar, que queda como punto de partida de esa jornada.

    reserva_plan?date=J   las paletas altas, abiertas por codigo (igual que reserva_arranque)
    buffer_plan?date=J    lo matriculado en el buffer de los codigos del plan

QUIEN LA TOMA: el robot del stock de la hora, en su corrida de siempre. Lo unico
nuevo es que `horario_robot.py` le dice "te toca" apenas aparece el proceso en el
registro de eventos, sin esperar a las 22:00. Windows lo despierta cada 10 minutos,
asi que la foto queda entre 10 y 20 minutos despues de procesar.

SOLO DENTRO DE LA HORA SIGUIENTE AL PROCESO. Una foto de tres horas despues dejaria
afuera el trabajo de esas tres horas, que es el error al reves. Si en esa hora no se
pudo -el WMS ocupado, una falla-, no se saca y la pantalla sigue midiendo desde la
foto de las 19:09, que es como funcionaba hasta hoy.

LA HORA DEL PROCESO sale del registro de eventos: la web anota "Corrio el Analisis de
Buffer · jornada AAAA-MM-DD" con la hora exacta. Vale el PRIMER proceso de esa jornada
hecho despues de publicar el stock de las 19:00:
  * uno anterior al ancla trabaja con el stock de la manana y es otra lista (paso el
    11-sep a las 07:29);
  * reprocesar mas tarde la misma noche no mueve el punto de partida: el equipo ya
    estaba trabajando con la primera lista (el 15-sep se proceso 20:06 y 20:42).

ESTE ARCHIVO NO IMPORTA NADA PESADO arriba: lo llama `horario_robot.py` cada 10
minutos, y ese no puede tardar ni romperse por un Excel. Lo que lee stocks se importa
recien adentro de `guardar()`.
"""

import json
import os
import time
import unicodedata
import urllib.request
from datetime import datetime, timedelta

API_EVENTOS = 'https://logistics-backend-wv0x.onrender.com/api/eventos'
AQUI = os.path.dirname(os.path.abspath(__file__))
MARCA = os.path.join(AQUI, 'foto_del_plan.json')

AREA_RESERVA = 'reserva_plan'
AREA_BUFFER = 'buffer_plan'

# Cuanto despues de procesar todavia sirve la foto. Ver arriba: mas tarde deja afuera
# trabajo de verdad.
MINUTOS_VENTANA = 60


def jornada_de(ahora):
    """La noche en curso. Empieza a las 19:00: antes del mediodia todavia es la de ayer."""
    dia = ahora.date() if ahora.hour >= 12 else ahora.date() - timedelta(days=1)
    return dia.strftime('%Y-%m-%d')


def _sin_acentos(txt):
    t = unicodedata.normalize('NFKD', str(txt or ''))
    return ''.join(c for c in t if not unicodedata.combining(c)).lower()


def _cuando(txt):
    try:
        return datetime.strptime(str(txt or '')[:19], '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return None


def traer_eventos(timeout=20):
    """Los eventos de los dos ultimos dias, lo mas nuevo primero. Lanza si no contesta."""
    url = '%s?dias=2&limite=2000&t=%d' % (API_EVENTOS, int(time.time()))
    with urllib.request.urlopen(url, timeout=timeout) as r:
        cuerpo = json.loads(r.read().decode('utf-8'))
    return cuerpo.get('eventos', []) if isinstance(cuerpo, dict) else []


def hora_del_proceso(jornada, eventos):
    """
    El primer "Corrio el Analisis de Buffer" de esa jornada hecho despues del ancla de
    la noche. None si todavia no se proceso.
    """
    anclas = []
    for e in eventos:
        c = _cuando(e.get('cuando'))
        if (c and c.strftime('%Y-%m-%d') == jornada and c.hour >= 12
                and str(e.get('quien') or '') == 'ancla_noche'
                and 'stocks publicados' in _sin_acentos(e.get('accion'))):
            anclas.append(c)
    # El PRIMER stock publicado de la noche: si el ancla se relanza mas tarde, un proceso
    # hecho con el primero sigue siendo de esta noche.
    desde = min(anclas) if anclas else datetime.strptime(jornada + ' 19:00', '%Y-%m-%d %H:%M')

    procesos = []
    for e in eventos:
        if 'analisis de buffer' not in _sin_acentos(e.get('accion')):
            continue
        if str(e.get('detalle') or '').strip() != 'jornada ' + jornada:
            continue
        c = _cuando(e.get('cuando'))
        if c and c >= desde:
            procesos.append(c)
    return min(procesos) if procesos else None


def _marcas():
    try:
        with open(MARCA, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def ya_tomada(jornada):
    return jornada in _marcas()


def anotar(jornada, hora):
    """Deja constancia local de que esa jornada ya tiene su foto. Guarda diez dias."""
    d = _marcas()
    d[jornada] = hora
    corte = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
    d = {k: v for k, v in d.items() if k >= corte}
    try:
        with open(MARCA, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
    except Exception as e:
        print('[FOTO DEL PLAN] no se pudo anotar la marca: %s' % e)


def _publicada(jornada, timeout=30):
    """Si el servidor ya tiene la foto de esa jornada. None si no se pudo preguntar."""
    url = ('https://logistics-backend-wv0x.onrender.com/api/logistics/%s?date=%s&t=%d'
           % (AREA_RESERVA, jornada, int(time.time())))
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            cuerpo = json.loads(r.read().decode('utf-8'))
        datos = cuerpo.get('data') if isinstance(cuerpo, dict) else None
        return bool(isinstance(datos, dict) and datos.get('detalle'))
    except Exception:
        return None


def pendiente(ahora=None, eventos=None, preguntar_al_servidor=True):
    """
    (jornada, hora del proceso) si ahora hay que sacar la foto del plan; None si no.

    Toca cuando la jornada ya se proceso, todavia no tiene foto y no paso mas de una hora
    desde el proceso. `eventos` se pasa en las pruebas; en la vida real se bajan.
    """
    ahora = ahora or datetime.now()
    jornada = jornada_de(ahora)
    if ya_tomada(jornada):
        return None
    if eventos is None:
        eventos = traer_eventos()
    proceso = hora_del_proceso(jornada, eventos)
    if not proceso:
        return None
    if not (proceso <= ahora <= proceso + timedelta(minutes=MINUTOS_VENTANA)):
        return None
    # La marca local se pudo perder aunque la foto este publicada: no se saca dos veces.
    if preguntar_al_servidor and _publicada(jornada):
        anotar(jornada, 'ya estaba publicada')
        return None
    return jornada, proceso


def buffer_por_codigo(filas_activo, codigos=None):
    """
    Lo matriculado en el buffer, por articulo: todas las ubicaciones CDBUFFER.

    La misma cuenta que `enBufferDe` en dashboard_v28.js. Si se separan, la pantalla
    restaria dos cosas distintas.
    """
    por = {}
    for f in filas_activo:
        ubi = str(f.get('Ubicación') or f.get('Ubicacion') or '').strip().upper()
        if not ubi.startswith('CDBUFFER'):
            continue
        art = str(f.get('Artículo') or '').strip()
        if not art or (codigos and art not in codigos):
            continue
        try:
            q = float(str(f.get('Cantidad actual') or 0).replace(',', ''))
        except ValueError:
            continue
        if q <= 0:
            continue
        por[art] = por.get(art, 0) + q
    return {a: int(round(q)) for a, q in por.items()}


def guardar(jornada, proceso, ruta_act, ruta_res, hora_foto, log):
    """
    Publica las dos fotos del plan con la fecha de la jornada. Devuelve si quedo la de
    reserva, que es la que decide el punto de partida.

    La marca local se deja solo si la de reserva salio: si fallo, el robot vuelve a
    intentar en el proximo despertar mientras siga dentro de la hora.
    """
    import generar_slotting as gs
    gs.log = log

    if not ruta_res:
        log('La foto del plan necesita el Stock Reserva y no bajo: se intenta en el '
            'proximo despertar', 'WARN')
        return False

    res = gs.datos_reserva_web(ruta_res)
    if len(res) < 1000:
        log('El Stock Reserva trajo solo %s filas: la foto del plan no se guarda'
            % format(len(res), ',d'), 'ERROR')
        return False

    procesado = proceso.strftime('%H:%M:%S')
    foto = gs.foto_reserva(res)
    foto.update({'fecha': jornada, 'hora': hora_foto, 'procesado': procesado})
    log('FOTO DEL PLAN %s: se proceso a las %s y la foto es de las %s · %s paletas altas'
        % (jornada, procesado, hora_foto, format(foto['paletas'], ',d')))
    if not gs.subir_datos(AREA_RESERVA, foto, fecha=jornada):
        return False

    # El buffer va aparte y no frena: sin el, la Separacion sigue con la base de las 19:09.
    if ruta_act:
        try:
            plan = gs.bajar_area('plan_buffer', jornada) or {}
            cods = plan.get('codigos') if isinstance(plan, dict) else None
            codigos = set(str((c or {}).get('sku') or '').strip() for c in (cods or []))
            codigos.discard('')
            detalle = buffer_por_codigo(gs.datos_activo_web(ruta_act), codigos or None)
            log('Buffer del plan: %s articulos matriculados' % format(len(detalle), ',d'))
            gs.subir_datos(AREA_BUFFER, {'fecha': jornada, 'hora': hora_foto,
                                         'procesado': procesado, 'detalle': detalle},
                           fecha=jornada)
        except Exception as e:
            log('No se pudo guardar el buffer del plan: %s: %s'
                % (type(e).__name__, str(e)[:150]), 'WARN')

    anotar(jornada, hora_foto)
    return True
