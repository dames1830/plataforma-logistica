# -*- coding: utf-8 -*-
"""
EL SERVIDOR DE LA PLATAFORMA, CORRIENDO EN ESTA PC, CON UNA BASE DE PRUEBA APARTE
================================================================================

Para probar que lo leido en un aparato se apaga en el otro SIN tocar Render ni ninguna base
de verdad. La base se crea vacia en la carpeta temporal cada vez que arranca, con dos
personas y una conversacion. No hay llave de avisos: no sale ningun aviso a ningun telefono.

    python scratch/servidor_prueba_leidos.py          -> http://127.0.0.1:8021
"""
import json
import os
import sqlite3
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
CARPETA = os.path.join(tempfile.gettempdir(), 'deam_prueba_leidos')
os.makedirs(CARPETA, exist_ok=True)
DB = os.path.join(CARPETA, 'database.db')
for f in (DB, os.path.join(CARPETA, 'database_beta.db')):
    if os.path.exists(f):
        os.remove(f)

os.environ['DB_PATH'] = DB
os.environ.pop('VAPID_PRIVADA', None)          # que ningun aviso salga de aca
sys.path.insert(0, os.path.join(AQUI, '..', 'backend'))
os.chdir(os.path.join(AQUI, '..', 'backend'))

import main  # noqa: E402  (crea las tablas en la base de prueba)

conn = sqlite3.connect(DB)
for area, datos in (
    ('users', [{'username': 'dames', 'name': 'DANIEL AMES', 'role': 'admin'},
               {'username': 'msosa', 'name': 'MARIA SOSA', 'role': 'user'}]),
    ('chat_salas', [{'id': 'pru_leidos', 'tipo': 'directa', 'miembros': ['dames', 'msosa'],
                     'creador': 'msosa', 'creada': '2026-09-17T09:00:00'}]),
    ('chat_pru_leidos', [{'id': 'p1', 'de': 'msosa', 'texto': 'buenos dias', 'cuando': '2026-09-17T09:00:00'}]),
    ('chat_leidos', [{'id': 'dames', 'salas': {'pru_leidos': '2026-09-17T09:00:00'},
                      'salasMs': {'pru_leidos': 0}, 'ids': {'pru_leidos': 'p1'}}]),
):
    conn.execute('INSERT OR REPLACE INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at) '
                 'VALUES (?, ?, ?, datetime("now"))', (area, 'MASTER', json.dumps(datos)))
conn.commit()
conn.close()
print('[PRUEBA] base de prueba en', DB)

import uvicorn  # noqa: E402
uvicorn.run(main.app, host='127.0.0.1', port=8021, log_level='warning')
