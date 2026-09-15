# -*- coding: utf-8 -*-
"""
anotar_log.py  -  El Log de la web, con la CONSECUENCIA en palabras.

  Daniel, 15-sep-2026: *"que me llegue la notificacion de no se proceso y al abrirlo
  que me de el detalle. Que me diga: sabe que Daniel, no se proceso el activo,
  tenemos el stock anterior todavia, no se ha actualizado porque hubo un robot
  pisandose, por X motivo, el servidor se ha apagado, pero que me explique"*.

  POR QUE UN MODULO APARTE. Hasta hoy cada robot se escribia su propio `anotar()`
  -generar_slotting.py tiene uno- y la mayoria no anotaba nada: el correo de
  comercial, el de citas, la distribucion y el despacho potencial no dejaban una
  sola linea. Por eso la noche del 14-sep, cuando el despacho potencial murio, no
  habia donde mirar que le habia pasado.

  LAS TRES PARTES DE UNA ANOTACION, y por que no es una sola:

      accion        que paso, en una linea      "No llego el correo de comercial"
      consecuencia  QUE SIGNIFICA PARA DANIEL   "El potencial sigue con el del
                                                 viernes: sin el correo de hoy no
                                                 se puede analizar el buffer"
      tecnico       para arreglarlo             las lineas del registro del robot

  La del medio es la que pidio y la que no existia. "Fallo" no le dice si puede
  seguir trabajando; "seguimos con el stock de las 07:00" si.

  DONDE VIVE. En la tabla `eventos` que ya existe, sin tocar el backend: la
  consecuencia y lo tecnico viajan dentro de `detalle` como JSON. Quien lo lea y
  no entienda el JSON ve el texto igual -abajo se deja una version plana-, asi que
  las pantallas viejas no se rompen.

  FALLA CALLADO, SIEMPRE. Anotar no puede tumbar una corrida del turno: si el Log
  no contesta, el robot sigue su camino. Es la misma regla que tiene el endpoint
  del lado del servidor.
"""

import json
import os
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com/api/eventos'
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')
TIMEOUT = 20

# COMO SE LLAMA CADA ROBOT PARA QUIEN LEE. La misma lista que usa el celular:
# si el aviso dice "Cambio de turno", el Log no puede decir "ancla_noche".
NOMBRES = {
    'ancla_noche': 'Cierre del turno día',
    'ancla_manana': 'Cierre del turno noche',
    'ancla_noche,ancla_manana': 'Cambio de turno',
    'asn_web': 'ASN',
    'stock_hora': 'Stock por hora',
    'picking_hora': 'Avance de picking',
    'oblpn_hora': 'Avance de embalaje',
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

# QUE SE PIERDE CUANDO ESTE ROBOT NO CORRE.
#
# Escrito para que se entienda a las once de la noche y sin la laptop: dice con
# que datos se queda trabajando el almacen, no que subrutina fallo. Un robot que
# no este en esta lista igual anota; solo que sin esta linea.
CONSECUENCIA = {
    'ancla_noche':
        'No se actualizó el stock del cierre del turno día. La plataforma sigue '
        'mostrando la última foto buena, así que los números del buffer y del '
        'slotting son los de antes.',
    'ancla_manana':
        'No se actualizó el stock del cierre del turno noche. La plataforma sigue '
        'con la foto anterior: lo que entró o salió en el turno no está contado.',
    'ancla_noche,ancla_manana':
        'No se actualizó el stock del cambio de turno. La plataforma sigue con la '
        'foto anterior.',
    'despacho_potencial':
        'El despacho potencial se quedó con el del último correo que sí llegó. Sin '
        'el de hoy no se puede analizar el buffer.',
    'correo_citas':
        'La programación de recepción de mañana no está publicada. El reporte de '
        'recepción no tiene con qué comparar lo que llegue.',
    'distribucion':
        'No se actualizó la distribución del día: los bultos de patio y staging y '
        'los varados siguen con el corte anterior.',
    'reportes':
        'El pendiente de despacho y el detalle de orden no se actualizaron. Se está '
        'mirando el corte anterior.',
    'cruce_wms':
        'No se pudo cruzar contra el WMS, así que hoy no hay comprobación de '
        'diferencias de LPN.',
    'corte_turno':
        'No se cerró el número de picking y embalaje del turno. La producción del '
        'día queda sin su cierre.',
    'cierre_dia':
        'No se pudo dejar el respaldo total del día.',
    'picking_hora':
        'El avance de picking se quedó en la hora anterior.',
    'oblpn_hora':
        'El avance de embalaje se quedó en la hora anterior.',
    'stock_hora':
        'Las actividades del turno noche no se actualizaron.',
    'asn_web':
        'El ASN no se actualizó: las recepciones nuevas todavía no aparecen.',
    'respaldo':
        'No se pudo guardar el respaldo de los datos de hoy.',
}


def bonito(clave):
    """El nombre que se puede leer. Un robot nuevo sin nombre no escupe jerga."""
    if clave in NOMBRES:
        return NOMBRES[clave]
    partes = [p.strip() for p in str(clave).split(',') if p.strip()]
    legibles, vistos = [], set()
    for p in partes:
        t = NOMBRES.get(p, p.replace('_', ' ').strip().capitalize())
        if t.lower() not in vistos:
            vistos.add(t.lower())
            legibles.append(t)
    return ' y '.join(legibles) if legibles else 'Robot'


def consecuencia_de(clave):
    """Qué se pierde si este robot no corrió. Vacío si no está en la lista."""
    return CONSECUENCIA.get(clave, '')


def primera_frase(texto, tope=105):
    """La consecuencia recortada para que quepa en la notificacion del celular.

    EL AVISO TIENE QUE DECIR QUE SE PIERDE, no solo que fallo. Pero un push no es una
    pantalla: se corta a las dos lineas y lo que sobra no se lee. Se manda la primera
    frase -que es donde esta lo importante, por como estan escritas- y el resto queda
    en el detalle, a un toque."""
    t = ' '.join(str(texto or '').split())
    if not t:
        return ''
    punto = t.find('. ')
    if 0 < punto <= tope:
        return t[:punto + 1]
    return t if len(t) <= tope else (t[:tope].rsplit(' ', 1)[0] + '…')


def anotar(robot, accion, consecuencia='', tecnico='', tipo='ok', origen='robot'):
    """Deja una línea en el Log de la web. Devuelve True si se pudo.

    `tipo` es 'ok', 'aviso' o 'error', que es lo que pinta el semáforo de la
    pantalla. `tecnico` son las líneas del registro del robot, para quien tenga
    que arreglarlo; van plegadas y nunca sustituyen a la consecuencia.
    """
    try:
        # LA CLAVE VIAJA CON EL DATO. El Log guarda el nombre bonito -"Despacho
        # potencial"-, que es lo que hay que leer; pero el boton de relanzar necesita
        # la clave de verdad. Sin esto, la app tendria que adivinarla del nombre, y el
        # dia que se cambie un nombre el boton llamaria al robot equivocado.
        detalle = {'robot': str(robot)}
        if consecuencia:
            detalle['consecuencia'] = str(consecuencia)[:900]
        if tecnico:
            detalle['tecnico'] = str(tecnico)[:1600]
        # SIN NADA QUE ESTRUCTURAR, TEXTO PLANO. Asi una anotacion simple se sigue
        # leyendo igual en cualquier pantalla que no sepa de este JSON.
        cuerpo = json.dumps({
            'origen': origen,
            'quien': bonito(robot),
            'tipo': tipo,
            'accion': str(accion)[:300],
            'detalle': json.dumps(detalle, ensure_ascii=False),
        }, ensure_ascii=False).encode('utf-8')
        p = urllib.request.Request(API, data=cuerpo, method='POST',
                                   headers={'Content-Type': 'application/json'})
        if ROBOT_TOKEN:
            p.add_header('X-Robot-Token', ROBOT_TOKEN)
        urllib.request.urlopen(p, timeout=TIMEOUT).read()
        return True
    except Exception:
        # A PROPOSITO. Ver el encabezado: el Log nunca puede tumbar una corrida.
        return False


def ultimas_lineas(ruta, cuantas=12):
    """Las últimas líneas de un registro, para el detalle técnico. '' si no se puede."""
    try:
        with open(ruta, encoding='utf-8', errors='replace') as fh:
            lineas = fh.read().rstrip().split('\n')
        return '\n'.join(lineas[-cuantas:])
    except Exception:
        return ''


if __name__ == '__main__':
    import sys
    ok = anotar(sys.argv[1] if len(sys.argv) > 1 else 'prueba',
                'Prueba de anotación desde la consola',
                consecuencia='Ninguna: es una prueba.',
                tecnico='sin detalle', tipo='aviso')
    print('anotado' if ok else 'no se pudo anotar')
