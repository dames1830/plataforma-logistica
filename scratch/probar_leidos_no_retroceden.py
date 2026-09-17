# -*- coding: utf-8 -*-
"""
PRUEBA: LA MARCA DE LEIDO DEL CHAT NO RETROCEDE, Y SE BORRA EN LOS OTROS APARATOS
================================================================================

Corre sin servidor:      python scratch/probar_leidos_no_retroceden.py

Arma a mano los casos de `avisos_chat.mezclar_leidos` y `avisos_chat.avisar_leido` -este
ultimo con un `webpush` falso, para ver a quien le mandaria y que-. Devuelve 1 si algo falla.
"""
import json
import os
import sqlite3
import sys
import tempfile
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'backend'))
import avisos_chat as ac  # noqa: E402

fallas = 0


def comprobar(titulo, obtenido, esperado):
    global fallas
    ok = obtenido == esperado
    if not ok:
        fallas += 1
    print(('  ok   ' if ok else '  MAL  ') + titulo)
    if not ok:
        print('        esperado:', esperado)
        print('        obtenido:', obtenido)


# La sala `a`, TAL COMO LA GUARDA EL SERVIDOR: por orden de llegada. m4 llego DESPUES que m3
# pero desde una PC con el reloj atrasado, y su hora es ANTERIOR. Es el caso que rompia la
# comparacion por hora.
SALA_A = [
    {'id': 'm1', 'de': 'msosa', 'texto': 'hola', 'cuando': '2026-09-17T10:01:00'},
    {'id': 'm2', 'de': 'dames', 'texto': 'hola', 'cuando': '2026-09-17T10:02:00'},
    {'id': 'm3', 'de': 'msosa', 'texto': 'llego el camion', 'cuando': '2026-09-17T10:05:00'},
    {'id': 'm4', 'de': 'vmoron', 'texto': 'reloj atrasado', 'cuando': '2026-09-17T10:03:00'},
    {'id': 'g1', 'de': 'msosa', 'texto': 'agrego a', 'cuando': '2026-09-17T10:06:00', 'aviso': True},
    {'id': 'm5', 'de': 'msosa', 'texto': 'otro', 'cuando': '2026-09-17T10:09:00'},
]
lista_de = lambda sala: SALA_A if sala == 'a' else []  # noqa: E731


print('\nLA MEZCLA, POR ORDEN DE LLEGADA')

# El celular leyo hasta m3; la PC, que no se entero, sube su marca vieja (m2).
vieja = {'id': 'dames', 'ids': {'a': 'm3'}, 'salas': {'a': '2026-09-17T10:05:00'}, 'salasMs': {'a': 500}}
nueva = {'id': 'dames', 'ids': {'a': 'm2', 'b': 'x9'}, 'salas': {'a': '2026-09-17T10:02:00', 'b': '2026-09-17T09:00:00'},
         'salasMs': {'a': 900, 'b': 800}, 'aparato': 'pc1'}
fila, av = ac.mezclar_leidos(vieja, nueva, lista_de)
comprobar('la marca vieja no pisa a la nueva', fila['ids']['a'], 'm3')
comprobar('la hora tampoco retrocede', fila['salas']['a'], '2026-09-17T10:05:00')
comprobar('y su hora de lectura viaja con ella, no la de la PC', fila['salasMs']['a'], 500)
comprobar('la sala que solo trae la PC entra', (fila['ids']['b'], fila['salas']['b']), ('x9', '2026-09-17T09:00:00'))
comprobar('avanzo solo la sala b', [x[0] for x in av], ['b'])
comprobar('se queda el aparato que escribio', fila.get('aparato'), 'pc1')

# EL CASO DEL RELOJ ATRASADO: leer hasta m4 es avanzar, aunque m4 tenga hora anterior a m3.
fila, av = ac.mezclar_leidos(vieja, {'id': 'dames', 'ids': {'a': 'm4'}, 'salas': {'a': '2026-09-17T10:05:00'},
                                     'salasMs': {'a': 1000}}, lista_de)
comprobar('reloj atrasado: m4 llego despues, la marca avanza', fila['ids']['a'], 'm4')
comprobar('reloj atrasado: se informa el avance', av, [('a', 'm3', 'm4', '2026-09-17T10:05:00', '2026-09-17T10:05:00')])

# Y al reves: una marca en m3 no tapa a m4, aunque la hora de m4 sea anterior.
fila, av = ac.mezclar_leidos({'id': 'dames', 'ids': {'a': 'm4'}}, {'id': 'dames', 'ids': {'a': 'm3'}}, lista_de)
comprobar('m3 no le gana a m4 aunque tenga hora posterior', (fila['ids']['a'], av), ('m4', []))

# Una sala que la fila nueva no nombra no se borra.
fila, av = ac.mezclar_leidos(vieja, {'id': 'dames', 'salas': {}, 'salasMs': {}, 'ids': {}}, lista_de)
comprobar('la sala que no se nombra se conserva', (fila['ids'], fila['salas']), ({'a': 'm3'}, {'a': '2026-09-17T10:05:00'}))
comprobar('sin avanzar nada', av, [])

# La marca que se llevo el robot de archivado cuenta como anterior a todas.
fila, av = ac.mezclar_leidos({'id': 'dames', 'ids': {'a': 'archivado'}}, {'id': 'dames', 'ids': {'a': 'm1'}}, lista_de)
comprobar('una marca archivada queda atras', (fila['ids']['a'], [x[2] for x in av]), ('m1', ['m1']))

# Un aparato con la version de antes, sin `ids`: vale la hora, y no se pierde el id guardado.
fila, av = ac.mezclar_leidos(vieja, {'id': 'dames', 'salas': {'a': '2026-09-17T10:09:00'}, 'salasMs': {'a': 2000}}, lista_de)
comprobar('version de antes: la hora avanza', fila['salas']['a'], '2026-09-17T10:09:00')
comprobar('version de antes: el id guardado se queda', fila['ids']['a'], 'm3')
comprobar('version de antes: se informa por hora', av, [('a', 'm3', '', '2026-09-17T10:05:00', '2026-09-17T10:09:00')])

# Fila rota: se guarda tal cual, sin tumbar nada.
fila, av = ac.mezclar_leidos(vieja, {'id': 'dames', 'salas': 'roto'}, lista_de)
comprobar('una fila rota no revienta', av, [])

# Primera vez que la persona lee algo.
fila, av = ac.mezclar_leidos(None, {'id': 'dames', 'ids': {'a': 'm1'}, 'salas': {'a': '2026-09-17T10:01:00'}}, lista_de)
comprobar('primera vez: avanza desde nada', av, [('a', '', 'm1', '', '2026-09-17T10:01:00')])


print('\nLOS MENSAJES QUE SE ACABAN DE LEER')

leidos = ac.mensajes_leidos(SALA_A, 'dames', 'm2', 'm4', '', '')
comprobar('de m2 a m4: m3 y m4, aunque m4 tenga hora anterior', [m['id'] for m in leidos], ['m3', 'm4'])
leidos = ac.mensajes_leidos(SALA_A, 'dames', '', 'm5', '', '')
comprobar('sin marca anterior: todo lo de otros, sin mis mensajes ni el renglon gris',
          [m['id'] for m in leidos], ['m1', 'm3', 'm4', 'm5'])
leidos = ac.mensajes_leidos(SALA_A, 'dames', '', 'm5', '2026-09-17T10:04:00', '')
comprobar('primera marca por orden: lo anterior a la marca por hora ya se habia leido',
          [m['id'] for m in leidos], ['m3', 'm5'])
leidos = ac.mensajes_leidos(SALA_A, 'dames', '', 'no-esta', '2026-09-17T10:02:30', '2026-09-17T10:05:00')
comprobar('sin id que sirva: por la hora', [m['id'] for m in leidos], ['m4', 'm3'])


print('\nA QUIEN SE LE AVISA')

tmp = tempfile.mkdtemp()
db = os.path.join(tmp, 'prueba.db')
conn = sqlite3.connect(db)
conn.execute('CREATE TABLE logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT, '
             'updated_at TEXT, PRIMARY KEY(area_id, snapshot_date))')


def poner(area, datos):
    conn.execute('INSERT OR REPLACE INTO logistics_snapshots VALUES (?, ?, ?, ?)',
                 (area, 'MASTER', json.dumps(datos), '2026-09-17 10:00:00'))
    conn.commit()


poner('users', [{'username': 'msosa', 'name': 'MARIA SOSA'}, {'username': 'vmoron', 'name': 'VICENTE MORON'}])
poner('chat_salas', [{'id': 'a', 'tipo': 'directa', 'miembros': ['dames', 'msosa']}])
poner('chat_a', SALA_A)
poner('push_suscripciones', [
    {'id': 'dames|cel', 'usuario': 'dames', 'endpoint': 'https://fcm/1', 'claves': {'k': 1}, 'sabe': 2},
    {'id': 'dames|pc1', 'usuario': 'dames', 'endpoint': 'https://fcm/2', 'claves': {'k': 1}, 'sabe': 2},
    {'id': 'dames|viejo', 'usuario': 'dames', 'endpoint': 'https://fcm/3', 'claves': {'k': 1}},
    {'id': 'dames|apagado', 'usuario': 'dames', 'baja': True, 'sabe': 2},
    {'id': 'msosa|cel', 'usuario': 'msosa', 'endpoint': 'https://fcm/4', 'claves': {'k': 1}, 'sabe': 2},
])
conn.close()

mandados = []


class _Excepcion(Exception):
    pass


def _webpush_falso(subscription_info, data, **k):
    mandados.append((subscription_info['endpoint'], json.loads(data), k.get('ttl')))


falso = types.ModuleType('pywebpush')
falso.webpush = _webpush_falso
falso.WebPushException = _Excepcion
sys.modules['pywebpush'] = falso
os.environ['VAPID_PRIVADA'] = 'x' * 43

# Leyo en la PC, de m2 a m4.
n = ac.avisar_leido(db, 'dames', 'pc1', [('a', 'm2', 'm4', '2026-09-17T10:02:00', '2026-09-17T10:05:00')])
comprobar('sale a un solo aparato', n, 1)
comprobar('al celular: ni a la PC que leyo, ni al del ayudante viejo, ni al apagado, ni a otra persona',
          [m[0] for m in mandados], ['https://fcm/1'])
d = mandados[0][1] if mandados else {}
comprobar('borra m3 y m4', d.get('cubiertos'), ['m3', 'm4'])
comprobar('el m5 llego despues: su aviso se queda', 'm5' in (d.get('cubiertos') or []), False)
comprobar('es un aviso de leido de esa sala', (d.get('tipo'), d.get('sala'), d.get('etiqueta')), ('leido', 'a', 'chat_a'))
comprobar('con el nombre de quien escribio el ultimo', d.get('titulo'), 'Vicente Moron')
comprobar('dura un dia', mandados[0][2] if mandados else None, 86400)

# Si entre las dos marcas solo hay mensajes mios, no hay aviso que borrar.
mandados.clear()
n = ac.avisar_leido(db, 'dames', 'pc1', [('a', 'm1', 'm2', '', '')])
comprobar('sin mensajes de otros no se manda nada', (n, mandados), (0, []))

sys.exit(1 if fallas else 0)
