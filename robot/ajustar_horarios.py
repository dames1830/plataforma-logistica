# -*- coding: utf-8 -*-
"""
CAMBIA EL HORARIO PUBLICADO DE TRES ROBOTS.

El horario lo manda la web: lo que hay en `horario_robot.py` es solo el respaldo
para cuando el servidor no contesta. Asi que cambiar los valores de fabrica no
cambia nada mientras haya una configuracion publicada, y hay.

Lo que se cambia, aprobado por Daniel el 02-sep-2026:
  · avance de picking   minuto 20 -> 0    (10:00, 12:00, 14:00, 16:00, 18:00, 20:00)
  · avance de embalaje  minuto 40 -> 20   (10:20, 12:20, ... 18:20, 20:20)
  · se quitan los saltos de las 18: existian porque el embalaje terminaba 18:59 y
    pisaba el ancla de las 19:00. Adelantados veinte minutos, el pase de las 18
    cierra 18:39 y el ancla entra libre.
  · se agrega `cierre_dia` a las 08:30.

SE TOCAN SOLO ESAS CLAVES. La configuracion trae mucho mas -zonas, factores,
permisos- y se vuelve a publicar entera: cualquier otra cosa se copia tal cual.
Antes de escribir se deja una copia de lo que habia.
"""
import io
import json
import os
import urllib.request
from datetime import datetime

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config'
LOGS = os.path.join('C:' + os.sep, 'wms_scraping', 'logs')
TOKEN = os.environ.get('ROBOT_TOKEN', '')

CAMBIOS = {
    'picking_hora': {'minuto': 0, 'saltar': None},
    'oblpn_hora': {'minuto': 20, 'saltar': None},
}
NUEVOS = {
    'cierre_dia': {'activa': True, 'hora': '08:30',
                   'dias': {'lun': True, 'mar': True, 'mie': True, 'jue': True,
                            'vie': True, 'sab': True, 'dom': True}},
}


def traer():
    with urllib.request.urlopen('%s?t=ajuste' % API, timeout=60) as r:
        cuerpo = json.load(r)
    return cuerpo.get('data', cuerpo) if isinstance(cuerpo, dict) else cuerpo


def guardar(cfg):
    cuerpo = json.dumps(cfg, ensure_ascii=False).encode('utf-8')
    p = urllib.request.Request(API, data=cuerpo, method='POST')
    p.add_header('Content-Type', 'application/json')
    if TOKEN:
        p.add_header('X-Robot-Token', TOKEN)
    with urllib.request.urlopen(p, timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    cfg = traer()
    robots = (cfg or {}).get('robots')
    if not isinstance(robots, dict) or not robots:
        print('la configuracion publicada no trae robots; no se toca nada')
        return 1

    resp = os.path.join(LOGS, 'config_antes_%s.json'
                        % datetime.now().strftime('%Y%m%d_%H%M%S'))
    io.open(resp, 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=1))
    print('copia de lo que habia: %s' % os.path.basename(resp))
    print('')

    print('ANTES')
    for k in list(CAMBIOS) + list(NUEVOS):
        print('  %-14s %s' % (k, json.dumps(robots.get(k), ensure_ascii=False)))

    for k, campos in CAMBIOS.items():
        if k not in robots:
            print('  OJO: %s no estaba publicado; se deja como esta' % k)
            continue
        for campo, valor in campos.items():
            if valor is None:
                robots[k].pop(campo, None)
            else:
                robots[k][campo] = valor
    for k, v in NUEVOS.items():
        robots.setdefault(k, v)

    print('')
    print('DESPUES')
    for k in list(CAMBIOS) + list(NUEVOS):
        print('  %-14s %s' % (k, json.dumps(robots.get(k), ensure_ascii=False)))

    cfg['robots'] = robots
    r = guardar(cfg)
    print('')
    print('publicado: %s' % json.dumps(r, ensure_ascii=False)[:120])

    # SE COMPRUEBA LEYENDO. Que el POST conteste bien no prueba que quedo guardado.
    de_vuelta = (traer() or {}).get('robots') or {}
    ok = all(de_vuelta.get(k, {}).get('minuto') == v['minuto'] for k, v in CAMBIOS.items()) \
        and 'cierre_dia' in de_vuelta
    print('comprobado leyendo el servidor: %s' % ('QUEDO BIEN' if ok else 'NO COINCIDE'))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
