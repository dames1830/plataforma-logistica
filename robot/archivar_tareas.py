# -*- coding: utf-8 -*-
"""
archivar_tareas.py  -  Mueve las tareas de almacenaje viejas al historico.

  En cada arranque de la web se bajan TODAS las tareas de almacenaje, y el 60%
  son de meses ya cerrados que nadie consulta desde ahi: 795 de mayo, junio y
  julio contra 490 de agosto. Son 1.206 KB de los 2.025 que la pagina espera
  antes de mostrarse.

  El area `almacenaje_tasks_history` existe justo para eso, pero el archivado se
  dejo de hacer en julio: hoy tiene 3.555 tareas y ninguna de agosto.

  EL ORDEN IMPORTA. Primero copia al historico, despues COMPRUEBA que llegaron
  leyendo el area de vuelta, y solo entonces las saca de las activas. Al reves
  -borrar y despues copiar- un corte de red en el medio las perderia.

  Por defecto NO TOCA NADA: hay que pasarle --ejecutar a proposito.

  Uso:
    python archivar_tareas.py                      -> dice que haria
    python archivar_tareas.py --corte 2026-08-01   -> otra fecha de corte
    python archivar_tareas.py --ejecutar           -> lo hace de verdad
"""

import json
import sys
import time
import urllib.error
import urllib.request

API = 'https://logistics-backend-wv0x.onrender.com'
CORTE = '2026-08-01'          # se archiva lo ANTERIOR a esta fecha
TIMEOUT = 180

# Una tarea sin cerrar no se archiva aunque sea vieja: alguien podria estar
# trabajandola todavia.
ESTADOS_CERRADOS = {'finalizado', 'vencida'}


def _pedir(ruta, datos=None, metodo=None):
    cuerpo = json.dumps(datos).encode('utf-8') if datos is not None else None
    req = urllib.request.Request(
        f'{API}{ruta}', data=cuerpo, method=metodo or ('POST' if datos else 'GET'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'archivar-tareas'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode('utf-8'))


def leer(area):
    c = _pedir(f'/api/logistics/{area}?z={int(time.time())}')
    d = c.get('data', c) if isinstance(c, dict) else c
    return d if isinstance(d, list) else []


def clave(t):
    return f"{t.get('fecha')}|{t.get('id')}"


def main():
    args = sys.argv[1:]
    de_verdad = '--ejecutar' in args
    corte = args[args.index('--corte') + 1] if '--corte' in args else CORTE

    print(f'[ARCHIVAR] corte: se archiva lo anterior al {corte}')
    print('[ARCHIVAR] leyendo produccion...')
    activas = leer('almacenaje_tasks')
    historico = leer('almacenaje_tasks_history')
    print(f'[ARCHIVAR] activas: {len(activas)}  |  historico: {len(historico)}')

    viejas = [t for t in activas if str(t.get('fecha') or '') < corte]
    quedan = [t for t in activas if str(t.get('fecha') or '') >= corte]

    # Las que siguen vivas no se tocan aunque sean viejas
    abiertas = [t for t in viejas if str(t.get('status') or '').strip().lower() not in ESTADOS_CERRADOS]
    if abiertas:
        print(f'[ARCHIVAR] {len(abiertas)} tareas viejas NO estan cerradas: se quedan donde estan.')
        for t in abiertas[:10]:
            print(f'           {t.get("fecha")}  {t.get("id")}  estado={t.get("status")}')
        viejas = [t for t in viejas if t not in abiertas]
        quedan = quedan + abiertas

    yaEstan = {clave(t) for t in historico}
    a_copiar = [t for t in viejas if clave(t) not in yaEstan]
    duplicadas = len(viejas) - len(a_copiar)

    porMes = {}
    for t in viejas:
        m = str(t.get('fecha') or '?')[:7]
        porMes[m] = porMes.get(m, 0) + 1

    peso = lambda x: len(json.dumps(x, ensure_ascii=False)) / 1024
    print()
    print('=' * 58)
    print(f'  se archivan:      {len(viejas):>5} tareas   ({peso(viejas):.0f} KB)')
    for m in sorted(porMes):
        print(f'      {m}:        {porMes[m]:>5}')
    if duplicadas:
        print(f'  ya en historico:  {duplicadas:>5} (no se copian de nuevo)')
    print(f'  se quedan:        {len(quedan):>5} tareas   ({peso(quedan):.0f} KB)')
    print(f'  historico queda:  {len(historico) + len(a_copiar):>5} tareas')
    print('=' * 58)

    if not de_verdad:
        print()
        print('  Esto fue solo la simulacion: NO se movio nada.')
        print('  Para hacerlo de verdad: python archivar_tareas.py --ejecutar')
        return 0

    if not a_copiar:
        print('\n[ARCHIVAR] no hay nada que mover.')
        return 0

    # 1) COPIAR al historico. Se manda el historico entero con lo nuevo agregado,
    #    que es como funciona el POST de estas areas.
    print(f'\n[ARCHIVAR] 1/3 copiando {len(a_copiar)} tareas al historico...')
    nuevoHistorico = historico + a_copiar
    _pedir('/api/logistics/almacenaje_tasks_history', nuevoHistorico)

    # 2) COMPROBAR leyendo de vuelta. Sin esto, un error del servidor pasaria
    #    inadvertido y el paso 3 borraria tareas que no se guardaron en ningun lado.
    print('[ARCHIVAR] 2/3 comprobando que llegaron...')
    time.sleep(2)
    verificacion = leer('almacenaje_tasks_history')
    ahora = {clave(t) for t in verificacion}
    faltantes = [t for t in a_copiar if clave(t) not in ahora]
    if faltantes:
        print(f'[ARCHIVAR] ERROR: {len(faltantes)} tareas no llegaron al historico.')
        print('           NO se borra nada. Las activas quedan intactas.')
        return 1
    print(f'[ARCHIVAR]     ok: el historico tiene {len(verificacion)} tareas')

    # 3) Recien ahora se sacan de las activas
    print(f'[ARCHIVAR] 3/3 dejando {len(quedan)} tareas en activas...')
    _pedir('/api/logistics/almacenaje_tasks', quedan)

    time.sleep(2)
    final = leer('almacenaje_tasks')
    print()
    print(f'[ARCHIVAR] listo. activas: {len(activas)} -> {len(final)}')
    print(f'[ARCHIVAR] el arranque de la web baja de {peso(activas):.0f} KB a {peso(final):.0f} KB')
    if len(final) != len(quedan):
        print(f'[ARCHIVAR] ATENCION: se esperaban {len(quedan)} y quedaron {len(final)}.')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
