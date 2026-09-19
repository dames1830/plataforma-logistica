"""
EL SERVIDOR DEVUELVE LA MEMORIA DESPUÉS DE CADA GUARDADO GRANDE — PROBADO SIN SERVIDOR.

Carga DOS copias de backend/main.py sobre la misma base de prueba: la de git (antes) y la de
ahora. A las dos les pasa las mismas peticiones por la pila ASGI COMPLETA —con los
middleware, que es donde vive el cambio— y compara lo que recibe el navegador.

En Windows no existe malloc_trim: para ver que el middleware lo llama cuando corresponde se
le pone una libc de mentira que cuenta las llamadas.

    python scratch/probar_devolver_memoria.py
"""
import asyncio
import importlib.util
import json
import os
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)
BACKEND = os.path.join(REPO, 'backend')
tmp = tempfile.mkdtemp(prefix='devolver_memoria_')
os.environ['DB_PATH'] = os.path.join(tmp, 'database.db')
sys.path.insert(0, BACKEND)

viejo_ruta = os.path.join(tmp, 'main_viejo.py')
open(viejo_ruta, 'wb').write(subprocess.run(['git', 'show', 'HEAD:backend/main.py'], cwd=REPO,
                                            capture_output=True, check=True).stdout)


def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


viejo = cargar('main_viejo', viejo_ruta)
nuevo = cargar('main_nuevo', os.path.join(BACKEND, 'main.py'))
for m in (viejo, nuevo):
    try:
        m.init_db(os.environ['DB_PATH'])
    except Exception as e:
        print('init_db:', e)

fallos = total = 0


def chk(ok, texto):
    global fallos, total
    total += 1
    if not ok:
        fallos += 1
    print(('  OK   ' if ok else '  FALLA') + ' ' + texto)


async def pedir(app, metodo, ruta, cuerpo=b'', cabeceras=None):
    """Una petición HTTP por la pila ASGI entera, sin httpx."""
    ruta, _, query = ruta.partition('?')
    heads = [(b'content-type', b'application/json'), (b'content-length', str(len(cuerpo)).encode())]
    for k, v in (cabeceras or {}).items():
        heads.append((k.lower().encode(), v.encode()))
    scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': metodo,
             'scheme': 'http', 'path': ruta, 'raw_path': ruta.encode(), 'query_string': query.encode(),
             'root_path': '', 'headers': heads, 'client': ('127.0.0.1', 5000), 'server': ('prueba', 80)}
    enviado = {'listo': False}

    async def receive():
        if not enviado['listo']:
            enviado['listo'] = True
            return {'type': 'http.request', 'body': cuerpo, 'more_body': False}
        await asyncio.sleep(3600)

    salida = {'status': None, 'headers': {}, 'body': b''}

    async def send(msg):
        if msg['type'] == 'http.response.start':
            salida['status'] = msg['status']
            salida['headers'] = {k.decode().lower(): v.decode() for k, v in msg['headers']}
        elif msg['type'] == 'http.response.body':
            salida['body'] += msg.get('body', b'')

    await app(scope, receive, send)
    return salida


class LibcDeMentira:
    def __init__(self):
        self.llamadas = 0

    def malloc_trim(self, n):
        self.llamadas += 1
        return 1


async def main():
    grande = {'filas': [{'sku': '%07d-1-%02d' % (i, i % 40), 'ubic': 'MZN01-%02d-01-A-01' % (i % 60),
                         'pares': i % 17, 'nota': 'x' * 20} for i in range(40000)]}
    cuerpo = json.dumps(grande).encode()
    print('cuerpo de prueba: %.1f MB' % (len(cuerpo) / 1048576))

    print('\n1. Guardar y leer un área grande: igual antes y ahora')
    r = {}
    for nombre, m in (('viejo', viejo), ('nuevo', nuevo)):
        p = await pedir(m.app, 'POST', '/api/logistics/__prueba_memoria_%s__?date=2026-09-19' % nombre, cuerpo)
        g = await pedir(m.app, 'GET', '/api/logistics/__prueba_memoria_%s__?date=2026-09-19' % nombre)
        r[nombre] = (p, g)
        chk(p['status'] == 200, '%s: POST devuelve 200 (%s)' % (nombre, p['body'][:80]))
        chk(g['status'] == 200, '%s: GET devuelve 200' % nombre)
    chk(json.loads(r['viejo'][1]['body'])['data'] == json.loads(r['nuevo'][1]['body'])['data'] == grande,
        'lo guardado y releído es idéntico en las dos versiones y al original')
    chk(r['viejo'][1]['headers'].get('x-environment-used') == r['nuevo'][1]['headers'].get('x-environment-used') == 'production',
        'la cabecera de entorno sigue saliendo (el middleware nuevo no la tapa)')
    chk(json.loads(r['viejo'][0]['body']).keys() == json.loads(r['nuevo'][0]['body']).keys(),
        'la respuesta del POST tiene los mismos campos')

    print('\n2. Beta sigue separado')
    b = await pedir(nuevo.app, 'POST', '/api/logistics/__prueba_beta__?date=2026-09-19', b'{"a":1}', {'X-Environment': 'beta'})
    gb = await pedir(nuevo.app, 'GET', '/api/logistics/__prueba_beta__?date=2026-09-19', b'', {'X-Environment': 'beta'})
    gp = await pedir(nuevo.app, 'GET', '/api/logistics/__prueba_beta__?date=2026-09-19')
    chk(b['status'] == 200 and json.loads(gb['body'])['data'] == {'a': 1}, 'beta guarda y lee lo suyo')
    chk(gb['headers'].get('x-environment-used') == 'beta', 'beta se marca beta')
    chk(json.loads(gp['body']).get('data') in ({}, [], None), 'producción no ve lo de beta')

    print('\n3. /api/health')
    hv = json.loads((await pedir(viejo.app, 'GET', '/api/health'))['body'])
    hn = json.loads((await pedir(nuevo.app, 'GET', '/api/health'))['body'])
    chk(hn.get('status') == 'ok', 'contesta ok')
    chk(set(hn) - set(hv) == {'memoria'} and set(hv) - set(hn) == set(), 'solo agrega el campo "memoria"')
    chk(hn['memoria']['devuelve'] is False and hn['memoria']['rss_mb'] is None,
        'en Windows queda apagado sin error: %s' % hn['memoria'])

    print('\n4. Cuándo devuelve memoria (con una libc de mentira)')
    falsa = LibcDeMentira()
    nuevo._LIBC = falsa
    await pedir(nuevo.app, 'POST', '/api/logistics/__prueba_memoria_nuevo__?date=2026-09-19', cuerpo)
    chk(falsa.llamadas == 1, 'después de un POST: devuelve (%d)' % falsa.llamadas)
    await pedir(nuevo.app, 'GET', '/api/logistics/__prueba_memoria_nuevo__?date=2026-09-19')
    chk(falsa.llamadas == 2, 'después de entregar un área de más de 1 MB: devuelve (%d)' % falsa.llamadas)
    await pedir(nuevo.app, 'GET', '/api/logistics/__prueba_beta__?date=2026-09-19', b'', {'X-Environment': 'beta'})
    await pedir(nuevo.app, 'GET', '/api/sync/versiones')
    await pedir(nuevo.app, 'GET', '/api/health')
    chk(falsa.llamadas == 2, 'las consultas chicas no pagan nada (%d)' % falsa.llamadas)
    gz = await pedir(nuevo.app, 'GET', '/api/logistics/__prueba_memoria_nuevo__?date=2026-09-19', b'',
                     {'Accept-Encoding': 'gzip'})
    chk(gz['headers'].get('content-encoding') == 'gzip', 'con gzip sigue comprimiendo (%s)' % gz['headers'].get('content-encoding'))
    chk(falsa.llamadas == 3, 'y también devuelve después de un área grande comprimida (%d)' % falsa.llamadas)
    hn = json.loads((await pedir(nuevo.app, 'GET', '/api/health'))['body'])
    chk(hn['memoria']['devoluciones'] == 3 and hn['memoria']['ultima_ruta'].startswith('GET /api/logistics/'),
        'health cuenta las devoluciones: %s' % {k: hn['memoria'][k] for k in ('devoluciones', 'ultima_ruta')})

    print('\n%d de %d bien' % (total - fallos, total))
    sys.exit(1 if fallos else 0)


asyncio.run(main())
