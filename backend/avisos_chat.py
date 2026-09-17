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
# A donde lleva el aviso al tocarlo. Lleva la SALA, no solo la seccion: Daniel,
# 16-sep-2026: *"lo abri pero no me mando de frente al chat, solo me abrio la
# aplicacion"*. Con `#chat` a secas la app no sabia cual conversacion abrir.
DESTINO = './index.html#chat'


def _destino_de(id_sala):
    return DESTINO + '=' + str(id_sala or '')

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


def _anotar_intento(ruta_db, resumen, area='push_ultimo'):
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
                    (area, 'MASTER', json.dumps([resumen], ensure_ascii=False),
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
            'url': _destino_de(id_sala),
            # MISMA ETIQUETA POR SALA: dos mensajes seguidos de la misma persona
            # se reemplazan en vez de apilarse. Es lo mismo que hacen los robots.
            'etiqueta': 'chat_' + id_sala,
            # DE QUE MENSAJE ES EL AVISO. Con esto el telefono sabe si el aviso que
            # tiene en la bandeja es de algo que ya se leyo en la PC -ver `avisar_leido`-.
            'sala': id_sala,
            'msg': str(msg.get('id') or ''),
            'cuando': str(msg.get('cuando') or ''),
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


# ══════════════════════════════════════════════════════════════════════════════════
#  LO QUE SE LEYO EN UN APARATO, SE BORRA EN LOS OTROS
# ══════════════════════════════════════════════════════════════════════════════════
#
# Daniel, 17-sep-2026: *"me llega un mensaje a los dos, tanto a la web como al
# aplicativo, y si lo veo en el móvil ya debería quitar ese aviso en la web, y
# viceversa... ahorita lo veo en el aplicativo y en la web me sigue marcando como
# una conversación que todavía no lo veo"*.
#
# Son dos arreglos y los dos viven acá:
#
#   1. LA MARCA DE LEIDO NUNCA RETROCEDE (`mezclar_leidos`). Cada aparato sube su
#      fila entera, y el servidor la reemplazaba tal cual: un celular que todavía no
#      había bajado lo leído en la PC la pisaba con su marca vieja, y la conversación
#      volvía a figurar como no leída en todos lados.
#
#   2. EL AVISO DE LA BANDEJA SE RETIRA (`avisar_leido`). El celular no pregunta
#      nada con la pantalla apagada: hay que avisarle, igual que con el mensaje.

AREA_LEIDOS = 'chat_leidos'

# QUE TIENE QUE SABER EL AYUDANTE DEL APARATO (`sw.js`) para recibir el aviso de
# "ya lo viste". Lo escribe la pagina en su suscripcion -campo `sabe`- DESPUES de
# preguntarselo al ayudante. Un ayudante viejo no entiende este aviso y lo pintaria
# como un mensaje: a ese no se le manda nada.
SABE_BORRAR_LO_LEIDO = 2

# Un dia: si el telefono estuvo sin senal, al volver igual tiene que enterarse.
TTL_LEIDO = 86400


def _numero(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def mezclar_leidos(vieja, nueva, lista_de=None):
    """Junta la fila guardada con la que llega, sala por sala. NUNCA levanta una excepcion.

    Devuelve `(fila, avanzadas)`: la fila que hay que guardar y las salas en las que la
    persona leyo algo nuevo, como `(sala, id_antes, id_ahora, hora_antes, hora_ahora)`.

    `lista_de(sala)` devuelve los mensajes de esa sala TAL COMO ESTAN GUARDADOS.

    LA MARCA QUE MANDA ES `ids`: el ultimo mensaje que ese aparato tenia, POR ORDEN DE LLEGADA.
    El servidor agrega cada mensaje al final de la lista, asi que la posicion en la lista es el
    orden real en que llegaron, y no depende del reloj de nadie. La hora del mensaje -la que
    usaba la marca vieja, `salas`- la escribe el reloj de quien lo mando, y en el almacen hay
    PCs con minutos de diferencia: un mensaje que llega DESPUES puede traer una hora ANTERIOR.
    Comparando por hora, ese mensaje quedaba como ya leido sin que nadie lo viera.

    GANA LA MARCA MAS ADELANTADA, NO LA ULTIMA QUE LLEGO. Un celular que todavia no bajo lo
    leido en la PC sube su fila con la marca vieja; antes la pisaba.

    `salas` y `salasMs` se siguen guardando -las usan las marcas de entregado y leido de los
    demas- y tampoco retroceden: gana la hora mas adelantada, con su hora de lectura pegada.
    Separarlas haria figurar como leido algo que no se vio.

    Un id que ya no esta en la lista es un mensaje que se llevo el robot de archivado: cuenta
    como anterior a todos.
    """
    try:
        if not isinstance(nueva, dict):
            return nueva, []

        def mapa(fila, campo):
            if isinstance(fila, dict) and isinstance(fila.get(campo), dict):
                return fila.get(campo)
            return {}

        n_salas, n_ms, n_ids = mapa(nueva, 'salas'), mapa(nueva, 'salasMs'), mapa(nueva, 'ids')
        v_salas, v_ms, v_ids = mapa(vieja, 'salas'), mapa(vieja, 'salasMs'), mapa(vieja, 'ids')

        memo = {}

        def posiciones(sala):
            if sala not in memo:
                pos = {}
                try:
                    for i, m in enumerate((lista_de(sala) if lista_de else None) or []):
                        if isinstance(m, dict) and m.get('id') is not None:
                            pos[str(m.get('id'))] = i
                except Exception:
                    pos = {}
                memo[sala] = pos
            return memo[sala]

        salas, salas_ms, ids, avanzadas = {}, {}, {}, []
        for sala in set(v_salas) | set(n_salas) | set(v_ids) | set(n_ids) | set(v_ms) | set(n_ms):
            v, n = str(v_salas.get(sala) or ''), str(n_salas.get(sala) or '')
            vm, nm = v_ms.get(sala), n_ms.get(sala)
            vi, ni = str(v_ids.get(sala) or ''), str(n_ids.get(sala) or '')

            # LA HORA Y SU HORA DE LECTURA, en pareja.
            if n > v:
                hora, ms = n, (nm if nm is not None else vm)
            elif v > n:
                hora, ms = v, (vm if vm is not None else nm)
            else:
                hora = n
                a, b = _numero(vm), _numero(nm)
                ms = nm if (a is None or (b is not None and b >= a)) else vm
            if hora:
                salas[sala] = hora
            if ms is not None:
                salas_ms[sala] = ms

            # EL ORDEN DE LLEGADA.
            avanzo, por_id = False, False
            if ni and vi and ni != vi:
                pos = posiciones(sala)
                pn, pv = pos.get(ni, -1), pos.get(vi, -1)
                if pn > pv:
                    ids[sala], avanzo, por_id = ni, True, True
                elif pv > pn:
                    ids[sala] = vi
                else:
                    # Ninguno de los dos esta en la lista: se decide por la hora, como antes.
                    ids[sala] = ni if n >= v else vi
                    avanzo = n > v
            elif ni:
                ids[sala] = ni
                avanzo, por_id = ni != vi, True
            elif vi:
                ids[sala] = vi
                # Un aparato con la version de antes no manda `ids`: vale su hora.
                avanzo = n > v
            else:
                avanzo = n > v
            if avanzo:
                # Si avanzo por la hora, sin id nuevo, lo leido se busca por la hora.
                avanzadas.append((str(sala), vi, ids[sala] if por_id else '', v, n))

        fila = dict(nueva)
        fila['salas'] = salas
        fila['salasMs'] = salas_ms
        fila['ids'] = ids
        return fila, avanzadas
    except Exception:
        return nueva, []


def _sabe_borrar(s):
    try:
        return int(s.get('sabe') or 0) >= SABE_BORRAR_LO_LEIDO
    except (TypeError, ValueError):
        return False


def _es_de_otro(m, usuario):
    """Un mensaje que pudo haber dejado un aviso en la bandeja de `usuario`: de otra persona, y
    ni borrado ni renglon gris. Es la misma regla con la que `avisar_del_mensaje` decide avisar."""
    return (isinstance(m, dict) and m.get('id') is not None
            and str(m.get('de') or '') != str(usuario)
            and not m.get('aviso') and not m.get('sistema') and not m.get('borrado'))


def mensajes_leidos(lista, usuario, id_antes, id_ahora, hora_antes, hora_ahora):
    """Los mensajes de otros que la persona acaba de leer: los que llegaron DESPUES de su marca
    anterior y hasta la nueva, por orden de llegada. Si la marca nueva no esta en la lista
    -aparato con la version de antes-, por la hora."""
    lista = [m for m in (lista or []) if isinstance(m, dict)]
    pos = {str(m.get('id')): i for i, m in enumerate(lista) if m.get('id') is not None}
    if id_ahora and id_ahora in pos:
        hasta = pos[id_ahora]
        if id_antes:
            desde = pos.get(id_antes, -1)
            return [m for i, m in enumerate(lista) if desde < i <= hasta and _es_de_otro(m, usuario)]
        # La primera marca por orden de llegada: lo anterior se leyo con la marca por hora.
        return [m for i, m in enumerate(lista) if i <= hasta and _es_de_otro(m, usuario)
                and str(m.get('cuando') or '') > str(hora_antes or '')]
    return sorted([m for m in lista if _es_de_otro(m, usuario)
                   and str(hora_antes or '') < str(m.get('cuando') or '') <= str(hora_ahora or '')],
                  key=lambda m: str(m.get('cuando') or ''))


def avisar_leido(ruta_db, usuario, aparato, avanzadas, log=None):
    """Les dice a los OTROS aparatos de la persona que ya leyo. NUNCA levanta una excepcion.

    A QUIEN: a los aparatos de ESA persona, menos el que leyo -ese ya lo sabe- y menos los
    que tengan el ayudante viejo.

    SOLO SI HAY ALGO QUE BORRAR: si entre la marca anterior y la nueva no hay ningun mensaje
    de otra persona, ningun telefono tiene un aviso de eso en la bandeja y no se manda nada.

    CUALES: los ids de esos mensajes (`cubiertos`). El aviso de la bandeja lleva el id de su
    mensaje, y el telefono borra solo el que figure aca. Si mientras tanto entro un mensaje
    NUEVO a esa conversacion, su aviso no esta en la lista y se queda.
    """
    def apuntar(t):
        if log:
            try:
                log(t)
            except Exception:
                pass

    try:
        if not avanzadas or not usuario:
            return 0
        clave = _clave()
        if not clave:
            return 0
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            return 0

        propio = '%s|%s' % (usuario, aparato or '')
        suyos = [s for s in _leer_area(ruta_db, AREA_SUS)
                 if isinstance(s, dict) and str(s.get('usuario')) == str(usuario)
                 and s.get('endpoint') and s.get('claves') and not s.get('baja')
                 and _sabe_borrar(s) and str(s.get('id')) != propio]
        if not suyos:
            return 0

        salas = None
        enviados = 0
        detalle = []
        for id_sala, id_antes, id_ahora, hora_antes, hora_ahora in avanzadas:
            tapados = mensajes_leidos(_leer_area(ruta_db, 'chat_' + id_sala), usuario,
                                      id_antes, id_ahora, hora_antes, hora_ahora)
            if not tapados:
                continue
            if salas is None:
                salas = _leer_area(ruta_db, AREA_SALAS)
            datos = json.dumps({
                'tipo': 'leido',
                'sala': id_sala,
                # Los ultimos 40 alcanzan: el aviso de la bandeja es del ultimo mensaje, y un
                # aviso de Google no puede pesar mas de 4 KB.
                'cubiertos': [str(m.get('id')) for m in tapados][-40:],
                # SI LO RECIBE UN AYUDANTE VIEJO -no deberia, ver `sabe`- que al menos diga
                # algo con sentido y reemplace al aviso de esa conversacion.
                'titulo': _titulo(ruta_db, salas, id_sala, tapados[-1].get('de')),
                'cuerpo': '✓ Ya lo viste en otro dispositivo',
                'etiqueta': 'chat_' + id_sala,
                'url': _destino_de(id_sala),
            }, ensure_ascii=False)
            for s in suyos:
                try:
                    webpush(subscription_info={'endpoint': s['endpoint'], 'keys': s['claves']},
                            data=datos, vapid_private_key=clave,
                            vapid_claims={'sub': _correo()}, ttl=TTL_LEIDO)
                    enviados += 1
                    detalle.append({'aparato': str(s.get('id')), 'sala': id_sala,
                                    'mensajes': len(tapados), 'resultado': 'entregado a Google'})
                except WebPushException as e:
                    codigo = getattr(getattr(e, 'response', None), 'status_code', 0)
                    apuntar('[CHAT LEIDO] %s no recibio (codigo %s)' % (s.get('id'), codigo))
                    detalle.append({'aparato': str(s.get('id')), 'sala': id_sala,
                                    'resultado': 'rechazado', 'codigo': codigo})
                except Exception as e:
                    apuntar('[CHAT LEIDO] fallo con %s: %s' % (s.get('id'), str(e)[:120]))
                    detalle.append({'aparato': str(s.get('id')), 'sala': id_sala,
                                    'resultado': 'error', 'significa': str(e)[:160]})
        if detalle:
            # Aparte del de los mensajes: si compartieran el registro, cada lectura taparia
            # la constancia del ultimo aviso de mensaje, que es la que se mira cuando algo
            # no llega.
            _anotar_intento(ruta_db, {
                'id': 'ultimo',
                'cuando': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'usuario': str(usuario),
                'leyo_en': str(aparato or ''),
                'enviados': enviados,
                'detalle': detalle,
            }, area='push_ultimo_leido')
        if enviados:
            apuntar('[CHAT LEIDO] %s leyo: aviso a %d aparato(s)' % (usuario, enviados))
        return enviados
    except Exception as e:
        apuntar('[CHAT LEIDO] no se pudo avisar: %s' % str(e)[:160])
        return 0
