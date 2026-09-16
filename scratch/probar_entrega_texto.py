"""
EL SERVIDOR ENTREGA EL TEXTO GUARDADO Y YA NO HACE VACUUM EN CADA GUARDADO — PROBADO SIN SERVIDOR.

Carga DOS copias de backend/main.py sobre la misma base de prueba: la de antes (la que esté
en git, o la que se pase con VIEJO=ruta) y la de ahora. A cada una le pide lo mismo y compara
lo que un navegador recibiría, armando la respuesta igual que FastAPI:

    un dict devuelto  ->  jsonable_encoder + JSONResponse
    un Response       ->  su cuerpo tal cual

    python scratch/probar_entrega_texto.py

Con DATOS=carpeta usa también archivos JSON reales de esa carpeta (almacenaje_activo.json,
analisis_sku_reserva.json, articulos.json, tareas_prod_*.json). Sin ella prueba solo los casos
armados a mano.
"""
import glob
import importlib.util
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import tracemalloc

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)
BACKEND = os.path.join(REPO, 'backend')

tmp = tempfile.mkdtemp(prefix='entrega_texto_')
os.environ['DB_PATH'] = os.path.join(tmp, 'database.db')
sys.path.insert(0, BACKEND)

viejo_ruta = os.environ.get('VIEJO')
if not viejo_ruta:
    viejo_ruta = os.path.join(tmp, 'main_viejo.py')
    fuente = subprocess.run(['git', 'show', 'HEAD:backend/main.py'], cwd=REPO, capture_output=True, check=True).stdout
    open(viejo_ruta, 'wb').write(fuente)


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


viejo = cargar('main_viejo', viejo_ruta)
nuevo = cargar('main_nuevo', os.path.join(BACKEND, 'main.py'))

from fastapi.encoders import jsonable_encoder
from starlette.responses import JSONResponse, Response

fallos = 0
total = 0


def chk(ok, texto):
    global fallos, total
    total += 1
    if not ok:
        fallos += 1
    print(('OK    ' if ok else 'FALLA ') + texto)


def lo_que_recibe_el_navegador(mod, area, date=None):
    """(estado, cuerpo en bytes, cabeceras) o ('error', mensaje, {})"""
    try:
        r = mod.get_area_data(area, date)
        if isinstance(r, Response):
            return 'ok', r.body, dict(r.headers)
        resp = JSONResponse(content=jsonable_encoder(r))
        return 'ok', resp.body, dict(resp.headers)
    except Exception as e:
        return 'error', type(e).__name__, {}


def guardar(area, fecha, dato):
    """Igual que el POST: el texto sale de json.dumps."""
    conn = sqlite3.connect(os.environ['DB_PATH'])
    conn.execute("""INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                    VALUES (?, ?, ?, ?) ON CONFLICT(area_id, snapshot_date)
                    DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at""",
                 (area, fecha, dato if isinstance(dato, str) else json.dumps(dato), '2026-09-16 07:30:00'))
    conn.commit()
    conn.close()


def comparar(area, date=None, rotulo=None, debe_ir_crudo=True):
    ev, bv, hv = lo_que_recibe_el_navegador(viejo, area, date)
    en, bn, hn = lo_que_recibe_el_navegador(nuevo, area, date)
    nombre = rotulo or f'{area}{"?date=" + date if date else ""}'
    if ev == 'error' or en == 'error':
        chk(ev == en and bv == bn, f'{nombre}: los dos fallan igual ({bv} / {bn})')
        return
    iguales = json.loads(bv) == json.loads(bn)
    chk(iguales, f'{nombre}: lo que recibe el navegador es IDÉNTICO ({len(bn) / 1048576:.2f} MB)')
    crudo = hn.get('x-entrega') == 'texto-guardado'
    if debe_ir_crudo:
        chk(crudo and hn.get('content-type', '').startswith('application/json'),
            f'{nombre}: sale por el camino nuevo, como JSON')
    else:
        chk(not crudo, f'{nombre}: sigue por el camino de antes, a propósito')


print('\n── Casos armados a mano ──')
raro = [
    {'marca': 'Bata Comfit', 'descripcion': 'Zapatilla niño – talla 35½ ñandú «ok»', 'emoji': '👟',
     'comillas': 'dice "hola" y \\ barra', 'saltos': 'uno\ndos\ttab', 'vacio': '', 'nulo': None,
     'si': True, 'no': False, 'entero': 1234567890123456789, 'real': 1.5, 'chico': 1e-7, 'negativo': -42,
     'lista': [], 'objeto': {}, 'anidado': {'a': [1, {'b': 'c'}]}},
    ['0011321', 'Footwear', 12, None],
]
guardar('prueba_varios', '2026-09-15', raro)
guardar('prueba_varios', '2026-09-16', raro + [{'extra': 'día nuevo'}])
comparar('prueba_varios', rotulo='área con fecha, sin pedir fecha (la más nueva)')
comparar('prueba_varios', '2026-09-15', rotulo='área con fecha, pidiendo una fecha')
comparar('prueba_varios', '2026-01-01', rotulo='fecha que no existe (lista vacía)', debe_ir_crudo=False)
comparar('area_que_no_existe', rotulo='área que no existe', debe_ir_crudo=False)
_c = sqlite3.connect(os.environ['DB_PATH']); _c.execute("DELETE FROM logistics_snapshots WHERE area_id='config'"); _c.commit(); _c.close()
comparar('config', rotulo='config sin datos (objeto vacío)', debe_ir_crudo=False)
guardar('config', 'MASTER', {'robots': {'ancla_noche': {'hora': '19:00'}}, 'tema': 'pbi'})
comparar('config', rotulo='config con datos (singleton por ?date=MASTER)', date='MASTER')
guardar('articulos', 'MASTER', [['CodCanal', 'CodArticulo'], ['5', '0011321']])
comparar('articulos', rotulo='singleton (articulos, MASTER)')
guardar('marcas_maestro', 'MASTER', [{'MarcaStd': 'Bata 3d', 'Marcas': 'Bata'}])
comparar('marcas_maestro', 'MASTER', rotulo='no singleton con ?date=MASTER (tabla de marcas)')
guardar('no_retail_cache', 'MASTER', {'LPN1': {'fotoCargo': 'data:image/png;base64,AAAA', 'fotoLocal': '', 'estado': 'ok'}})
comparar('no_retail_cache', rotulo='no_retail_cache (le tapa las fotos)', debe_ir_crudo=False)
ev, bv, _ = lo_que_recibe_el_navegador(nuevo, 'no_retail_cache')
chk(json.loads(bv)['data']['LPN1']['fotoCargo'] == 'present', 'no_retail_cache: la foto sigue saliendo como "present"')
guardar('permissions', 'MASTER', {'admin': {'todo': True}})
comparar('permissions', rotulo='permissions (camino propio, no cambia)', debe_ir_crudo=False)
comparar('users', rotulo='users (camino propio, no cambia)', debe_ir_crudo=False)
guardar('prueba_nan', '2026-09-16', '[1.5, NaN, Infinity]')
comparar('prueba_nan', rotulo='un NaN guardado: sigue por el camino de antes', debe_ir_crudo=False)
guardar('prueba_nan_texto', '2026-09-16', ['NaNdo', 'Infinity y más allá'])
comparar('prueba_nan_texto', rotulo='"NaN" dentro de un texto: sale igual, por el camino de antes', debe_ir_crudo=False)

print('\n── Con datos reales ──')
carpeta = os.environ.get('DATOS')
medidos = []
if not carpeta:
    print('(sin DATOS=carpeta no se prueban archivos reales)')
else:
    reales = [('almacenaje_activo', 'almacenaje_activo.json'), ('analisis_sku_reserva', 'analisis_sku_reserva.json'),
              ('articulos', 'articulos.json')]
    tareas = sorted(glob.glob(os.path.join(carpeta, 'tareas_prod_antes_correccion_*.json')))
    for area, archivo in reales + ([('almacenaje_tasks', os.path.basename(tareas[-1]))] if tareas else []):
        ruta = os.path.join(carpeta, archivo)
        if not os.path.exists(ruta):
            print(f'(no está {archivo})')
            continue
        obj = json.load(open(ruta, encoding='utf-8'))
        dato = obj.get('data', obj) if isinstance(obj, dict) and 'data' in obj else obj
        fecha = 'MASTER' if area in ('articulos', 'almacenaje_tasks') else '2026-09-16'
        guardar(area, fecha, dato)
        comparar(area, rotulo=f'{area} real')
        medidos.append(area)

    print('\n── Memoria y tiempo de una descarga (mismo dato, misma PC) ──')
    for area in medidos:
        for rotulo, mod in (('antes', viejo), ('ahora', nuevo)):
            import gc
            gc.collect()
            tracemalloc.start()
            t0 = time.time()
            estado, cuerpo, _ = lo_que_recibe_el_navegador(mod, area)
            seg = time.time() - t0
            pico = tracemalloc.get_traced_memory()[1]
            tracemalloc.stop()
            print(f'   {area:22s} {rotulo:5s}  pico {pico / 1048576:6.1f} MB   {seg:5.2f} s')
            del cuerpo

print('\n── Podar sin VACUUM ──')
for f in ('2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'):
    guardar('prueba_poda', f, [f])


def sentencias_de_poda(mod):
    vistas = []
    original = mod.sqlite3.connect

    def conectar(*a, **k):
        c = original(*a, **k)
        c.set_trace_callback(vistas.append)
        return c
    mod.sqlite3.connect = conectar
    try:
        mod.prune_old_snapshots(os.environ['DB_PATH'])
    finally:
        mod.sqlite3.connect = original
    return vistas


antes = sentencias_de_poda(viejo)
if 'cursor.execute("VACUUM")' in open(viejo_ruta, encoding='utf-8').read():
    chk(any(s.strip().upper().startswith('VACUUM') for s in antes), 'la versión de antes SÍ hacía VACUUM al podar (la prueba lo ve)')
else:
    print('(la versión con la que se compara ya no hace VACUUM: para verlo, VIEJO= con la de git 09c4c3c6~1)')
for f in ('2026-09-10', '2026-09-11'):
    guardar('prueba_poda', f, [f])
ahora = sentencias_de_poda(nuevo)
chk(not any(s.strip().upper().startswith('VACUUM') for s in ahora), 'la de ahora NO hace VACUUM')
conn = sqlite3.connect(os.environ['DB_PATH'])
quedan = [r[0] for r in conn.execute("SELECT snapshot_date FROM logistics_snapshots WHERE area_id='prueba_poda' ORDER BY snapshot_date")]
conn.close()
chk(quedan == ['2026-09-12', '2026-09-13'], f'y sigue podando: quedan las 2 más nuevas {quedan}')

print('\n── Cuántos días guarda cada área (16-sep-2026) ──')
conn = sqlite3.connect(os.environ['DB_PATH'])
conn.execute("DELETE FROM logistics_snapshots WHERE area_id IN ('turno_actividades','reserva_arranque','prueba_dos')")
conn.commit()
conn.close()
guardar('turno_actividades', '2099-01-01', {'ini': '19:00', 'fin': '06:30', 'procs': []})
for d in range(1, 16):
    guardar('turno_actividades', f'2026-09-{d:02d}', {'dia': f'2026-09-{d:02d}', 'procs': [{'n': 'Almacenamiento'}]})
for d in range(1, 36):
    guardar('reserva_arranque', f'2026-08-{d:02d}' if d <= 31 else f'2026-09-{d - 31:02d}', [d])
for d in range(1, 5):
    guardar('prueba_dos', f'2026-09-{d:02d}', [d])
nuevo.prune_old_snapshots(os.environ['DB_PATH'])
conn = sqlite3.connect(os.environ['DB_PATH'])
fechas = lambda a: [r[0] for r in conn.execute("SELECT snapshot_date FROM logistics_snapshots WHERE area_id=? ORDER BY snapshot_date", (a,))]
turno = fechas('turno_actividades')
chk('2026-09-14' in turno and '2026-09-15' in turno and len(turno) == 16,
    f'turno_actividades guarda todas sus jornadas, aunque esté la de prueba 2099 ({len(turno)} fechas)')
reserva = fechas('reserva_arranque')
chk(len(reserva) == 31 and reserva[-1] == '2026-09-04', f'reserva_arranque guarda un mes: las 31 más nuevas ({len(reserva)})')
dos = fechas('prueba_dos')
chk(dos == ['2026-09-03', '2026-09-04'], f'un área sin regla sigue guardando 2 ({dos})')
conn.close()

print('\n' + (f'FALLARON {fallos} de {total}' if fallos else f'TODO BIEN ({total} de {total})'))
sys.exit(1 if fallos else 0)
