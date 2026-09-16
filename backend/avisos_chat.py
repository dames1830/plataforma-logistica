# -*- coding: utf-8 -*-
"""
EL AVISO DEL CHAT AL CELULAR, EN EL MISMO INSTANTE
==================================================

Daniel, 15-sep-2026: *"al momento que me envían un chat debería llegarme una
notificación... me mandaron un chat y solo registró una notificación dentro de la
App. Lo que quiero es que llegue una notificación al celular"*.

Y al preguntar cómo lo hace WhatsApp: *"¿cómo es que les llega al instante?"*.

POR QUE VIVE ACA Y NO EN UN ROBOT
---------------------------------
La primera idea fue un robot en el Contabo que mirara los mensajes sin leer cada
minuto. Es un parche: el aviso llegaría tarde y habría que darle cuerda todo el
día. WhatsApp no mira nada — su servidor empuja el aviso en el mismo momento en
que recibe el mensaje.

**Todos los mensajes del chat pasan por `PATCH /api/logistics/chat_<sala>`**, o
sea por un solo punto de este archivo. Mandar el aviso ahí mismo es instantáneo y
no necesita robot.

NUNCA PUEDE TUMBAR EL MENSAJE
-----------------------------
Va en una tarea de fondo y envuelto en `try`. Si no hay llave, si falta la
librería, si Google no contesta: el mensaje ya se guardó y el chat sigue igual.
Un aviso que no llega es molesto; un mensaje que se pierde es grave.

LA LLAVE
--------
`VAPID_PRIVADA` como variable de entorno de este servidor. Hasta el 15-sep vivía
solo en el Contabo —para que no entrara nunca al repositorio— y sigue sin entrar:
acá se lee del entorno, igual que allá. Si no está puesta, este archivo no hace
nada y lo dice una vez en el log.

QUIEN RECIBE
------------
Los de la sala MENOS el que escribió. Eso sale de `chat_salas`, que es donde el
chat guarda quiénes son. Una persona puede tener varios teléfonos: se le manda a
todos los suyos.
"""

import datetime
import json
import os
import sqlite3

# La barra invertida seguida de 'n': asi quedan los saltos de linea cuando alguien pega
# un PEM en el panel de un servicio web. Se arma con chr() para que no la toque nadie.
ESCAPE_SALTO = chr(92) + 'n'

AREA_SUS = 'push_suscripciones'
AREA_SALAS = 'chat_salas'

# A donde lleva el aviso al tocarlo: al chat, no al inicio.
DESTINO = './index.html#chat'

# Las areas que empiezan con chat_ y NO son una sala de conversacion.
NO_SON_SALAS = ('chat_salas', 'chat_leidos', 'chat_presencia')

_ya_avise_que_falta = False


def forma_de_la_llave(bruto=None):
    """En que formato esta guardada la llave. NUNCA devuelve su valor.

    Sirve para contestar "¿por que no sale el aviso?" sin tener que ver la contrasena.
    """
    b = (bruto if bruto is not None else os.environ.get('VAPID_PRIVADA', '')) or ''
    limpio = b.strip().strip('"').strip("'").strip()
    return {
        'largo': len(limpio),
        'es_pem': 'BEGIN' in limpio,
        'saltos_escapados': ESCAPE_SALTO in limpio,
        'tenia_comillas': b.strip() != limpio,
        'parece_base64url': len(limpio) in (42, 43, 44) and 'BEGIN' not in limpio,
    }


def _llave_usable():
    """La llave privada en el formato que pywebpush entiende, venga como venga.

    EL 16-sep-2026 EL AVISO AL CELULAR MORIA EXACTAMENTE ACA. La llave estaba puesta en Render
    -el chequeo decia `puede_avisar: true`- pero en formato **PEM**, el bloque
    "-----BEGIN PRIVATE KEY-----" que es como lo deja el generador. Y `py_vapid.from_string()`
    NO acepta PEM: revienta con "Could not deserialize key data" y el aviso se perdia sin que
    nadie se enterara.

    MEDIDO, NO SUPUESTO (`scratch/probar_llave_vapid.py`): `from_string` acepta el base64url
    crudo, el base64 estandar con mas y barras, uno con espacios de sobra y hasta uno entre
    comillas. Con el PEM falla, venga en una linea o en varias.

    Se normaliza TODO al base64url de 43 caracteres, que es el que acepta cualquier version.
    Asi da igual como este guardada y da igual quien la pegue.
    """
    bruto = (os.environ.get('VAPID_PRIVADA', '') or '').strip().strip('"').strip("'").strip()
    if not bruto or 'BEGIN' not in bruto:
        return bruto
    # Es un PEM. Al pegarlo en un panel web los saltos suelen quedar escritos, no dados.
    pem = bruto.replace(ESCAPE_SALTO, '\n')
    try:
        import base64
        from py_vapid import Vapid01 as Vapid
        v = Vapid.from_pem(pem.encode())
        num = v.private_key.private_numbers().private_value
        return base64.urlsafe_b64encode(num.to_bytes(32, 'big')).decode().rstrip('=')
    except Exception:
        return bruto      # que falle con su error de siempre, pero ya queda anotado


def _clave():
    return _llave_usable()


def _correo():
    return os.environ.get('VAPID_CORREO', 'mailto:dames1830@gmail.com')


def es_sala(area):
    """¿Ese área es una conversación del chat?"""
    a = str(area or '')
    if not a.startswith('chat_') or a in NO_SON_SALAS:
        return False
    # Los adjuntos se guardan aparte (`chat_adj_<id>`) y no son mensajes.
    return not a.startswith('chat_adj_')


def _leer_area(ruta_db, area):
    """La lista de un área en MASTER. Lista vacía si no está o si no se puede leer."""
    try:
        conn = sqlite3.connect(ruta_db)
        cur = conn.cursor()
        cur.execute("SELECT data_json FROM logistics_snapshots "
                    "WHERE area_id = ? AND snapshot_date = ?", (area, 'MASTER'))
        fila = cur.fetchone()
        conn.close()
        if not fila:
            return []
        datos = json.loads(fila[0])
        return datos if isinstance(datos, list) else []
    except Exception:
        return []


def _anotar_intento(ruta_db, resumen):
    """Deja constancia del ULTIMO intento de aviso, para poder mirarlo desde fuera.

    EL AVISO QUE NO LLEGA FALLA EN SILENCIO. Hasta hoy lo unico que quedaba era un `print` en
    el log de Render: quien no tiene ese panel abierto no puede saber si el aviso salio, si el
    telefono lo rechazo o si no habia a quien mandarselo. El 16-sep-2026 hubo que adivinar
    entre cuatro causas sin poder mirar ninguna.

    Es la misma leccion del vigia de los robots: el silencio se parece a que todo va bien.

    Se guarda UN solo registro, siempre el ultimo, en `push_ultimo`. No crece.
    """
    try:
        conn = sqlite3.connect(ruta_db)
        cur = conn.cursor()
        cur.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at) "
                    "VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(area_id, snapshot_date) DO UPDATE SET "
                    "data_json=excluded.data_json, updated_at=excluded.updated_at",
                    ('push_ultimo', 'MASTER', json.dumps([resumen], ensure_ascii=False),
                     datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        conn.commit()
        conn.close()
    except Exception:
        pass      # dejar constancia NUNCA puede tumbar el aviso


def _bonito(nombre):
    """"daniel ames" -> "Daniel Ames". La misma regla que usa el chat en pantalla."""
    partes = [p for p in str(nombre or '').replace('.', ' ').split() if p]
    return ' '.join(p[:1].upper() + p[1:].lower() for p in partes)


def _como_se_llama(ruta_db, usuario):
    """El nombre de la persona, no su usuario: en el teléfono se lee "Daniel Ames"."""
    for u in _leer_area(ruta_db, 'users'):
        if isinstance(u, dict) and str(u.get('username')) == str(usuario):
            return _bonito(u.get('name')) or str(usuario)
    return str(usuario or 'Alguien')


def _sala_de(salas, id_sala):
    for s in salas:
        if isinstance(s, dict) and str(s.get('id')) == id_sala:
            return s
    return None


def _titulo(ruta_db, salas, id_sala, autor):
    """Un grupo se anuncia por su nombre; una conversación directa, por quien escribe."""
    s = _sala_de(salas, id_sala)
    if s and str(s.get('tipo')) == 'grupo':
        # En el grupo hace falta saber QUIEN hablo, si no el aviso no dice nada.
        return '%s · %s' % (str(s.get('nombre') or 'Grupo'),
                            _como_se_llama(ruta_db, autor))
    return _como_se_llama(ruta_db, autor)


def _destinatarios(salas, id_sala, autor):
    """Los de la sala menos el que escribió. Si no se encuentra la sala, nadie."""
    s = _sala_de(salas, id_sala)
    if not s:
        return []
    gente = s.get('miembros') or s.get('gente') or s.get('integrantes') or []
    return [str(u) for u in gente if str(u) and str(u) != str(autor)]


def _resumen(msg):
    """Una línea para el teléfono. El adjunto se nombra, no se describe."""
    texto = str((msg or {}).get('texto') or '').strip()
    if texto:
        return texto[:120]
    adj = (msg or {}).get('adjunto') or {}
    nombre = str(adj.get('nombre') or '').strip()
    tipo = str(adj.get('tipo') or '')
    if tipo.startswith('image/'):
        return '\U0001f4f7 Foto'
    return ('\U0001f4ce ' + nombre) if nombre else '\U0001f4ce Archivo'


def avisar_del_mensaje(ruta_db, area, msg, log=None):
    """Manda el aviso a los de la sala. NUNCA levanta una excepción."""
    global _ya_avise_que_falta

    def apuntar(t):
        if log:
            try:
                log(t)
            except Exception:
                pass

    try:
        if not es_sala(area) or not isinstance(msg, dict):
            return 0
        # Los mensajes de sistema -"fulano creó el grupo"- no despiertan a nadie.
        if msg.get('aviso') or msg.get('borrado'):
            return 0
        clave = _clave()
        if not clave:
            if not _ya_avise_que_falta:
                _ya_avise_que_falta = True
                apuntar('[CHAT PUSH] sin VAPID_PRIVADA: no se manda nada')
            return 0
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            if not _ya_avise_que_falta:
                _ya_avise_que_falta = True
                apuntar('[CHAT PUSH] falta la libreria pywebpush')
            return 0

        id_sala = area[len('chat_'):]
        autor = str(msg.get('de') or '')
        salas = _leer_area(ruta_db, AREA_SALAS)
        para = _destinatarios(salas, id_sala, autor)
        if not para:
            return 0

        titulo = _titulo(ruta_db, salas, id_sala, autor)
        cuerpo = _resumen(msg)
        datos = json.dumps({
            'titulo': titulo,
            'cuerpo': cuerpo,
            'url': DESTINO,
            # MISMA ETIQUETA POR SALA: dos mensajes seguidos de la misma persona
            # se reemplazan en vez de apilarse. Es lo mismo que hacen los robots.
            'etiqueta': 'chat_' + id_sala,
        }, ensure_ascii=False)

        enviados = 0
        detalle = []
        mirados = 0
        for s in _leer_area(ruta_db, AREA_SUS):
            mirados += 1
            if not isinstance(s, dict) or str(s.get('usuario')) not in para:
                continue
            if not s.get('endpoint') or not s.get('claves'):
                detalle.append({'aparato': str(s.get('id')), 'resultado': 'sin endpoint o sin claves'})
                continue
            try:
                webpush(
                    subscription_info={'endpoint': s['endpoint'], 'keys': s['claves']},
                    data=datos,
                    vapid_private_key=clave,
                    vapid_claims={'sub': _correo()},
                    # UNA HORA. Un mensaje de hace dos horas ya lo vio por la app;
                    # que el telefono suene de madrugada por eso no ayuda a nadie.
                    ttl=3600)
                enviados += 1
                detalle.append({'aparato': str(s.get('id')), 'resultado': 'entregado a Google'})
            except WebPushException as e:
                codigo = getattr(getattr(e, 'response', None), 'status_code', 0)
                # 404/410 = ese telefono ya no existe. Lo da de baja el robot, que
                # es quien escribe en esa area; aca solo se anota.
                apuntar('[CHAT PUSH] %s no recibio (codigo %s)' % (s.get('id'), codigo))
                detalle.append({'aparato': str(s.get('id')), 'resultado': 'rechazado',
                                'codigo': codigo,
                                'significa': ('el telefono ya no existe: hay que volver a '
                                              'activar los avisos en la app'
                                              if codigo in (404, 410) else
                                              'la llave no le sirve a este telefono'
                                              if codigo in (401, 403) else
                                              'lo rechazo el servicio de Google')})
            except Exception as e:
                apuntar('[CHAT PUSH] fallo con %s: %s' % (s.get('id'), str(e)[:120]))
                detalle.append({'aparato': str(s.get('id')), 'resultado': 'error',
                                'significa': str(e)[:160]})
        if enviados:
            apuntar('[CHAT PUSH] %s -> %d telefono(s)' % (titulo, enviados))
        _anotar_intento(ruta_db, {
            'id': 'ultimo',
            'cuando': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'sala': id_sala,
            'de': autor,
            'para': para,
            'aparatos_en_la_lista': mirados,
            'enviados': enviados,
            'detalle': detalle,
            'resumen': ('salio a %d telefono(s)' % enviados) if enviados
                       else ('nadie tiene avisos activados' if not detalle
                             else 'ninguno lo acepto'),
        })
        return enviados
    except Exception as e:
        apuntar('[CHAT PUSH] no se pudo avisar: %s' % str(e)[:160])
        return 0
