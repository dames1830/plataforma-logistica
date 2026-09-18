# -*- coding: utf-8 -*-
"""
LOS LINKS DE LOS REPORTES PÚBLICOS: QUE NINGÚN TOKEN SALGA NI SE GUARDE EN CLARO.

Daniel, 18-sep-2026: *"¿está bien, está hasheado?"*. No lo estaba: la lista de grupos con
sus tokens se le entregaba a cualquiera y la revisión la hacía el navegador. Esta prueba
levanta el servidor DE VERDAD (backend/main.py) en esta PC, con una base aparte, y mira:

  1. que al arrancar los tokens en claro pasen a huella
  2. que la lista que sale no tenga tokens ni huellas, y marque los inseguros
  3. que el link bueno entre, y el malo o vacío no
  4. que cambiar la lista pida un admin con sesión, y que al guardar la huella se conserve
     y el token nuevo se guarde solo como huella
  5. que por PATCH no se pueda tocar

    python scratch/probar_reportes_publicos.py
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(AQUI, '..', 'backend')
TMP = tempfile.mkdtemp(prefix='prueba_reportes_')
DB = os.path.join(TMP, 'database.db')
os.environ['DB_PATH'] = DB
PUERTO = 8016

# Los grupos como estaban guardados antes del arreglo: con el token en claro.
VIEJOS = [
    {'id': 'grp_gerencial', 'nombre': 'GERENCIAL', 'token': 'GERENCIAL-Deam2026',
     'modulos': ['almacenaje'], 'reportesAlmacenaje': ['reporte_marcas']},
    {'id': 'grp_supervisores', 'nombre': 'SUPERVISORES', 'token': 'SUPERVISORES-Deam2026',
     'modulos': ['analisis_sku'], 'submodulos': ['layout_activo'], 'reportesAnalisis': ['layout_activo']},
    {'id': 'grp_1', 'nombre': 'COORDINADORES', 'token': 'tok_sec_AbCdEfGhIjKlMnOp',
     'modulos': ['despacho'], 'submodulos': ['distribucion']},
]

# 1. Una base con los grupos viejos y un admin, ANTES de que arranque el servidor
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
fallos = []


def chk(cond, texto):
    print(('OK    ' if cond else 'FALLA ') + texto)
    if not cond:
        fallos.append(texto)


# init_db crea las tablas; se importa main recién después de sembrar, para que la
# migración del arranque encuentre los tokens en claro.
conn = sqlite3.connect(DB)
conn.execute("CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, "
             "data_json TEXT, updated_at TEXT, PRIMARY KEY(area_id, snapshot_date))")
conn.execute("INSERT INTO logistics_snapshots VALUES (?, 'MASTER', ?, '2026-09-18 03:00:00')",
             ('public_reports_config', json.dumps(VIEJOS)))
conn.commit()
conn.close()

import main  # noqa: E402  (arranca: init_db + migraciones)

conn = sqlite3.connect(DB)
conn.execute("INSERT OR REPLACE INTO users (username, password, name, role, active) VALUES (?, ?, ?, ?, 1)",
             ('prueba_admin', main.hashear_password('clave-de-prueba'), 'Prueba', 'admin'))
conn.execute("INSERT OR REPLACE INTO users (username, password, name, role, active) VALUES (?, ?, ?, ?, 1)",
             ('prueba_op', main.hashear_password('clave-de-prueba'), 'Operario', 'operario'))
conn.commit()
guardado = json.loads(conn.execute("SELECT data_json FROM logistics_snapshots WHERE area_id='public_reports_config' "
                                   "AND snapshot_date='MASTER'").fetchone()[0])
conn.close()

print('\n1. Al arrancar, los tokens pasan a huella')
print('-' * 74)
chk(all('token' not in g for g in guardado), 'en la base no queda ningún token en claro')
chk(all(str(g.get('token_hash', '')).startswith('sha256$') for g in guardado), 'cada grupo quedó con su huella')
chk(guardado[1]['token_hash'] == main.huella_token('SUPERVISORES-Deam2026'), 'la huella de SUPERVISORES es la de su token')

# 2. El servidor de verdad, escuchando en esta PC
import uvicorn  # noqa: E402
servidor = uvicorn.Server(uvicorn.Config(main.app, host='127.0.0.1', port=PUERTO, log_level='warning'))
threading.Thread(target=servidor.run, daemon=True).start()
for _ in range(50):
    if servidor.started:
        break
    time.sleep(0.1)
BASE = 'http://127.0.0.1:%d' % PUERTO


def pedir(metodo, ruta, cuerpo=None, cabeceras=None):
    datos = json.dumps(cuerpo).encode('utf-8') if cuerpo is not None else None
    p = urllib.request.Request(BASE + ruta, data=datos, method=metodo)
    p.add_header('Content-Type', 'application/json')
    for k, v in (cabeceras or {}).items():
        p.add_header(k, v)
    try:
        with urllib.request.urlopen(p, timeout=20) as r:
            return r.status, json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8') or '{}')


print('\n2. La lista que sale no trae ni tokens ni huellas')
print('-' * 74)
st, j = pedir('GET', '/api/logistics/public_reports_config?date=MASTER')
lista = j.get('data') or []
texto = json.dumps(j)
chk(st == 200 and len(lista) == 3, 'responde la lista de 3 grupos')
chk('Deam2026' not in texto and 'tok_sec_' not in texto and 'sha256$' not in texto,
    'no aparece ningún token ni ninguna huella en la respuesta')
chk(all(g.get('tiene_link') for g in lista), 'cada grupo dice que tiene link')
chk([g['link_inseguro'] for g in lista] == [True, True, False],
    'GERENCIAL y SUPERVISORES salen marcados como inseguros; COORDINADORES no')

print('\n3. El link bueno entra; el malo y el vacío no')
print('-' * 74)
st, j = pedir('POST', '/api/reportes-publicos/acceso', {'token': 'SUPERVISORES-Deam2026'})
g = j.get('grupo') or {}
chk(st == 200 and g.get('nombre') == 'SUPERVISORES', 'el link de SUPERVISORES entra')
chk(g.get('submodulos') == ['layout_activo'] and 'token' not in g and 'token_hash' not in g,
    'y recibe solo sus permisos, sin token ni huella')
st, j = pedir('POST', '/api/reportes-publicos/acceso', {'token': 'tok_sec_AbCdEfGhIjKlMnOp'})
chk(st == 200 and (j.get('grupo') or {}).get('nombre') == 'COORDINADORES', 'el link de COORDINADORES entra')
for malo in ('SUPERVISORES-Deam2027', '', 'x' * 500):
    st, j = pedir('POST', '/api/reportes-publicos/acceso', {'token': malo})
    chk(st == 403 and 'grupo' not in j, 'un link malo (%d caracteres) no entra' % len(malo))
st, j = pedir('POST', '/api/reportes-publicos/acceso', ['no es un objeto'])
chk(st == 403, 'un cuerpo raro no entra')

print('\n4. Cambiar la lista pide un admin con sesión')
print('-' * 74)
nueva = [dict(x) for x in lista]
st, j = pedir('POST', '/api/logistics/public_reports_config?date=MASTER', nueva)
chk(st == 403, 'sin sesión: 403')
st, j = pedir('POST', '/api/auth/login', {'username': 'prueba_op', 'password': 'clave-de-prueba'})
tok_op = j.get('token')
st, j = pedir('POST', '/api/logistics/public_reports_config?date=MASTER', nueva, {'X-Auth-Token': tok_op or ''})
chk(st == 403, 'con sesión de operario: 403')
st, j = pedir('POST', '/api/auth/login', {'username': 'prueba_admin', 'password': 'clave-de-prueba'})
tok_admin = j.get('token')
chk(bool(tok_admin), 'el admin de prueba inicia sesión')
# Como hace la pantalla: la lista SIN tokens (la que le dio el servidor), un permiso cambiado,
# un token nuevo para COORDINADORES y un grupo nuevo.
nueva[0]['modulos'] = ['almacenaje', 'buffer']
nueva[2]['token'] = 'tok_' + 'N' * 32
nueva.append({'id': 'grp_nuevo', 'nombre': 'AUDITORES', 'token': 'tok_' + 'A' * 32, 'modulos': ['picking']})
st, j = pedir('POST', '/api/logistics/public_reports_config?date=MASTER', nueva, {'X-Auth-Token': tok_admin})
chk(st == 200 and j.get('status') == 'success', 'con sesión de admin: se guarda')
conn = sqlite3.connect(DB)
g2 = json.loads(conn.execute("SELECT data_json FROM logistics_snapshots WHERE area_id='public_reports_config' "
                             "AND snapshot_date='MASTER'").fetchone()[0])
conn.close()
chk(all('token' not in x for x in g2), 'en la base sigue sin haber ningún token en claro')
chk(all('tiene_link' not in x and 'link_inseguro' not in x for x in g2), 'las marcas de la pantalla no se guardan')
chk(g2[0]['token_hash'] == main.huella_token('GERENCIAL-Deam2026') and g2[0]['modulos'] == ['almacenaje', 'buffer'],
    'GERENCIAL cambió sus permisos y conservó su huella (su link sigue andando)')
chk(g2[2]['token_hash'] == main.huella_token('tok_' + 'N' * 32), 'COORDINADORES quedó con la huella del token nuevo')
st, _ = pedir('POST', '/api/reportes-publicos/acceso', {'token': 'tok_sec_AbCdEfGhIjKlMnOp'})
chk(st == 403, 'el link viejo de COORDINADORES ya no entra')
st, j = pedir('POST', '/api/reportes-publicos/acceso', {'token': 'tok_' + 'N' * 32})
chk(st == 200, 'el link nuevo de COORDINADORES entra')
st, j = pedir('POST', '/api/reportes-publicos/acceso', {'token': 'tok_' + 'A' * 32})
chk(st == 200 and (j.get('grupo') or {}).get('nombre') == 'AUDITORES', 'el grupo nuevo entra con su link')
st, j = pedir('POST', '/api/logistics/public_reports_config?date=MASTER', {'no': 'lista'}, {'X-Auth-Token': tok_admin})
chk(st == 400, 'algo que no es una lista no se guarda')

print('\n5. Por PATCH no se puede tocar, y lo demás sigue igual')
print('-' * 74)
st, j = pedir('PATCH', '/api/logistics/public_reports_config?date=MASTER', {'id': 'grp_gerencial', 'token': 'x'},
              {'X-Auth-Token': tok_admin})
chk(st == 400, 'PATCH: 400')
st, j = pedir('GET', '/api/health')
chk(st == 200 and j.get('status') == 'ok', '/api/health responde')
st, j = pedir('POST', '/api/logistics/fill_rate_correo?date=MASTER', {'f': []})
chk(st == 200, 'las demás áreas se siguen guardando igual')

servidor.should_exit = True
time.sleep(0.5)
shutil.rmtree(TMP, ignore_errors=True)
print('\n' + ('TODO BIEN' if not fallos else '%d FALLAS' % len(fallos)))
sys.exit(1 if fallos else 0)
