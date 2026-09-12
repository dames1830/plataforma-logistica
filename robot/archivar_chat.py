# -*- coding: utf-8 -*-
"""
archivar_chat.py  -  Se lleva a OneDrive lo que el chat ya tiene mas de 30 dias.

  Daniel, 12-sep-2026: *"que se aguante 30 dias en el servidor y de ahi se elimine
  del servidor pero que todo pase al OneDrive"*.

  EL ORDEN IMPORTA Y NO SE NEGOCIA. Primero COPIA a OneDrive, despues COMPRUEBA
  releyendo del disco lo que acaba de escribir, y SOLO ENTONCES recorta el
  servidor. Al reves, un corte de red en el medio perderia mensajes y fotos que
  no estan en ningun otro lado: el chat es lo unico de la plataforma que no se
  puede volver a bajar del WMS.

  SI ONEDRIVE NO ESTA, NO BORRA NADA. Ni una carpeta que no existe, ni un disco
  lleno, ni un archivo que quedo a medias: en cualquiera de esos casos el robot
  avisa y deja el servidor intacto. Prefiere que el chat pese de mas antes que
  perder una conversacion.

  DONDE LO DEJA, tal como lo pidio:

      ...\\OneDrive\\danielames.bata\\Proyecto web Logistico\\chats\\
          conversaciones\\<con quien>\\2026-06.txt    para leer
          conversaciones\\<con quien>\\2026-06.json   los mensajes tal cual
          imagenes\\2026-06\\...                      las fotos, de verdad
          videos\\2026-06\\...
          archivos\\2026-06\\...                      pdf, excel, lo que sea
          _indice.json                                que carpeta es que conversacion

  EN EL CHAT NO QUEDA NINGUNA LEYENDA. Se probo dejar una linea avisando donde
  estaba lo archivado y Daniel la saco el mismo dia: el archivo esta en OneDrive
  y ahi se busca; en la conversacion solo van los mensajes.

  LOS ARCHIVOS SUELTOS tambien se limpian. Si alguien adjunto una foto y despues
  el administrador borro el mensaje, la foto seguia ocupando el servidor para
  siempre porque ya nadie la nombraba. El robot las reconoce por la fecha que
  llevan en el nombre, las guarda igual en OneDrive y recien despues las suelta.

  Uso:
    python archivar_chat.py                  -> dice que haria, no toca nada
    python archivar_chat.py --ejecutar       -> lo hace de verdad
    python archivar_chat.py --dias 60        -> conservar 60 dias en vez de 30
    python archivar_chat.py --beta           -> contra la base de pruebas
    python archivar_chat.py --carpeta RUTA   -> dejarlo en otro sitio (para probar)
"""

import base64
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

API = 'https://logistics-backend-wv0x.onrender.com'
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')
TIMEOUT = 180

# 30 dias: lo que pidio Daniel. Es lo que se mira de verdad en un chat de trabajo
# -"la foto que te mande la semana pasada"- y lo que mas pesa, las fotos, se va
# justo cuando deja de consultarse.
DIAS_QUE_SE_QUEDAN = 30

# TODAS las areas del chat viven bajo la foto MASTER, no bajo la del dia. Si se
# pide o se guarda sin decirlo, se cae en la foto de hoy: leeria vacio y
# escribiria en un sitio que el chat no mira. Es la misma regla que aplica js/chat.js.
FOTO = 'date=MASTER'

# OneDrive del servidor. El nombre de la carpeta cambia segun como se haya
# enganchado la cuenta, asi que se prueban las dos formas que existen en el Contabo.
BASES = [
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive',
                 'danielames.bata', 'Proyecto web Logistico'),
    os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive - Bata',
                 'danielames.bata', 'Proyecto web Logistico'),
]

CARPETAS = {'imagen': 'imagenes', 'video': 'videos', 'archivo': 'archivos'}
DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

USAR_BETA = False


# ── EL SERVIDOR ─────────────────────────────────────────────────────────────────────

def _pedir(ruta, datos=None, metodo=None):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8') if datos is not None else None
    cab = {'Content-Type': 'application/json', 'User-Agent': 'archivar-chat'}
    if ROBOT_TOKEN:
        cab['X-Robot-Token'] = ROBOT_TOKEN
    if USAR_BETA:
        cab['X-Environment'] = 'beta'
    req = urllib.request.Request('%s%s' % (API, ruta), data=cuerpo,
                                 method=metodo or ('POST' if datos is not None else 'GET'),
                                 headers=cab)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode('utf-8'))


def leer(area):
    c = _pedir('/api/logistics/%s?%s&z=%d' % (area, FOTO, int(time.time())))
    d = c.get('data', c) if isinstance(c, dict) else c
    return d if isinstance(d, list) else []


def guardar(area, lista):
    return _pedir('/api/logistics/%s?%s' % (area, FOTO), lista)


def areas_de_chat():
    """Todas las areas que empiezan con chat_, para encontrar tambien las sueltas."""
    c = _pedir('/api/sync/versiones?z=%d' % int(time.time()))
    v = (c or {}).get('versiones') or {}
    return sorted([k for k in v if k.startswith('chat_')])


# ── NOMBRES Y FECHAS ────────────────────────────────────────────────────────────────

def log(t, nivel='INFO'):
    print('[%s] %-5s %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t))
    sys.stdout.flush()


def limpiar(nombre):
    """Un nombre de carpeta que Windows acepte, sin dejarlo irreconocible."""
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', str(nombre or '').strip())
    s = re.sub(r'\s+', ' ', s).strip(' .')
    return s[:80] or 'sin nombre'


def dia_largo(dia):
    """'2026-06-01' -> 'lunes 1 de junio de 2026'. La fecha se calcula, no se copia."""
    try:
        d = datetime.strptime(dia, '%Y-%m-%d')
        return '%s %d de %s de %d' % (DIAS_SEMANA[d.weekday()], d.day, MESES[d.month - 1], d.year)
    except Exception:
        return dia


def bonita(dia):
    """'2026-06-01' -> '01-06-2026', que es como las lee Daniel."""
    p = str(dia or '')[:10].split('-')
    return '-'.join(reversed(p)) if len(p) == 3 else dia


def fecha_del_adjunto(id_adj):
    """El id lo arma el navegador con la hora de ese momento en base 36. De ahi sale
    la fecha de una foto suelta, que es lo unico que queda cuando ya no hay mensaje."""
    try:
        ms = int(str(id_adj).split('_')[0], 36)
        d = datetime.fromtimestamp(ms / 1000.0)
        if 2020 <= d.year <= 2100:
            return d
    except Exception:
        pass
    return None


def peso(x):
    return len(json.dumps(x, ensure_ascii=False).encode('utf-8')) / 1024.0


def legible(n):
    n = float(n or 0)
    if n < 1024:
        return '%d B' % n
    if n < 1024 * 1024:
        return '%.0f KB' % (n / 1024)
    return '%.1f MB' % (n / 1024 / 1024)


# ── ONEDRIVE ────────────────────────────────────────────────────────────────────────

def encontrar_onedrive(a_mano=None):
    """Devuelve la carpeta `chats` lista para escribir, o None si no se puede.

    No alcanza con que exista: hay que PODER ESCRIBIR. Un OneDrive desconectado
    deja la carpeta visible pero falla al grabar, y ese es justo el caso en el que
    no hay que borrar nada del servidor."""
    for b in ([a_mano] if a_mano else BASES):
        if not os.path.isdir(b):
            continue
        chats = os.path.join(b, 'chats')
        try:
            for sub in ['conversaciones', 'imagenes', 'videos', 'archivos']:
                os.makedirs(os.path.join(chats, sub), exist_ok=True)
            prueba = os.path.join(chats, '_prueba_de_escritura.tmp')
            with open(prueba, 'w', encoding='utf-8') as f:
                f.write('ok')
            os.remove(prueba)
            return chats
        except Exception as e:
            log('la carpeta existe pero no deja escribir: %s (%s)' % (chats, str(e)[:80]), 'ERROR')
            return None
    return None


def leer_indice(chats):
    """El cuaderno del robot: que carpeta es cada conversacion y donde quedo cada
    archivo. Lo segundo es lo que impide guardar dos veces lo mismo y, sobre todo,
    lo que impide dar por guardado un archivo que en realidad piso a otro."""
    p = os.path.join(chats, '_indice.json')
    vacio = {'salas': {}, 'adjuntos': {}}
    try:
        with open(p, encoding='utf-8') as f:
            d = json.load(f)
        if not isinstance(d, dict):
            return vacio
        return {'salas': d.get('salas') or {}, 'adjuntos': d.get('adjuntos') or {}}
    except Exception:
        return vacio


def guardar_indice(chats, indice):
    with open(os.path.join(chats, '_indice.json'), 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)


def carpeta_de_sala(chats, sala, nombres, indice):
    """Una carpeta por conversacion, con un nombre que se entienda al abrirlo.

    Si dos conversaciones distintas piden el mismo nombre -y los grupos repiten
    nombre todo el tiempo- a la segunda se le pega el id, y el indice deja
    anotado cual es cual."""
    idsala = sala.get('id')
    salas = indice['salas']
    if salas.get(idsala, {}).get('carpeta'):
        return salas[idsala]['carpeta']

    if sala.get('tipo') == 'grupo':
        base = limpiar(sala.get('nombre') or 'Grupo')
    else:
        quienes = [nombres.get(u, u) for u in (sala.get('miembros') or [])]
        base = limpiar(' y '.join(quienes) or idsala)

    tomadas = set(v.get('carpeta') for v in salas.values())
    carpeta = base
    if carpeta in tomadas:
        carpeta = limpiar('%s (%s)' % (base, idsala))
    salas[idsala] = {'carpeta': carpeta, 'tipo': sala.get('tipo'),
                     'nombre': sala.get('nombre') or '',
                     'miembros': sala.get('miembros') or []}
    return carpeta


# ── EL ARCHIVO DE UN MES ────────────────────────────────────────────────────────────

def escribir_mes(chats, carpeta, mes, sala, nombres, nuevos, donde_quedo):
    """Junta lo que ya habia de ese mes con lo nuevo y reescribe las dos vistas.

    Se mezcla POR ID: correr el robot dos veces el mismo dia no duplica nada, y una
    corrida cortada a la mitad se completa sola en la siguiente."""
    destino = os.path.join(chats, 'conversaciones', carpeta)
    os.makedirs(destino, exist_ok=True)
    pj = os.path.join(destino, '%s.json' % mes)
    pt = os.path.join(destino, '%s.txt' % mes)

    viejos = []
    if os.path.exists(pj):
        try:
            with open(pj, encoding='utf-8') as f:
                d = json.load(f)
                viejos = d.get('mensajes', []) if isinstance(d, dict) else (d if isinstance(d, list) else [])
        except Exception:
            viejos = []

    porid = {}
    for m in viejos + nuevos:
        if isinstance(m, dict) and m.get('id'):
            porid[m['id']] = m
    todos = sorted(porid.values(), key=lambda m: str(m.get('cuando') or ''))

    ficha = {'conversacion': sala.get('nombre') or carpeta,
             'id': sala.get('id'), 'tipo': sala.get('tipo'),
             'miembros': sala.get('miembros') or [],
             'mes': mes,
             'archivado': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
             'mensajes': todos}
    with open(pj, 'w', encoding='utf-8') as f:
        json.dump(ficha, f, ensure_ascii=False, indent=1)

    # La version para leer. Esta es la que va a abrir Daniel.
    lineas = []
    titulo = sala.get('nombre') if sala.get('tipo') == 'grupo' else \
        ' y '.join(nombres.get(u, u) for u in (sala.get('miembros') or []))
    lineas.append('CONVERSACION: %s' % (titulo or carpeta))
    lineas.append('TIPO:         %s' % ('grupo' if sala.get('tipo') == 'grupo' else 'entre dos'))
    if sala.get('miembros'):
        lineas.append('PARTICIPAN:   %s' % ', '.join(nombres.get(u, u) for u in sala['miembros']))
    lineas.append('MES:          %s' % mes)
    lineas.append('MENSAJES:     %d' % len(todos))
    lineas.append('GUARDADO:     %s por el robot de la web' % datetime.now().strftime('%d-%m-%Y %H:%M'))
    lineas.append('=' * 78)

    dia_puesto = ''
    for m in todos:
        dia = str(m.get('cuando') or '')[:10]
        if dia and dia != dia_puesto:
            dia_puesto = dia
            lineas.append('')
            lineas.append('--- %s ---' % dia_largo(dia))
        hora = str(m.get('cuando') or '')[11:16]
        quien = nombres.get(m.get('de'), m.get('de') or '')
        if m.get('borrado'):
            lineas.append('%s  %s: (mensaje borrado por %s)' % (hora, quien, m.get('borradoPor') or 'el administrador'))
            continue
        texto = str(m.get('texto') or '')
        adj = m.get('adjunto') or None
        if adj:
            # De esta corrida, o la que quedo anotada dentro del mensaje en una anterior.
            ruta = donde_quedo.get(adj.get('id')) or adj.get('archivado') or ''
            etiqueta = {'imagen': 'FOTO', 'video': 'VIDEO'}.get(adj.get('tipo'), 'ARCHIVO')
            marca = '[%s: %s' % (etiqueta, adj.get('nombre') or '')
            marca += ('  ->  %s]' % ruta) if ruta else '  (no se pudo guardar)]'
            texto = (texto + '  ' + marca).strip()
        lineas.append('%s  %s: %s' % (hora, quien, texto))
    lineas.append('')
    with open(pt, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas))

    return pj, pt, len(todos)


def bajar_adjunto(chats, adj, cuando, autor, indice, de_verdad):
    """Trae el archivo del servidor y lo deja en OneDrive de verdad, no en base64.

    Devuelve la ruta relativa donde quedo, o None si no se pudo. NO borra nada:
    de eso se encarga quien llama, y solo si esto salio bien."""
    ident = adj.get('id')
    if not ident:
        return None

    # YA GUARDADO. Se cree solo si el archivo esta de verdad en el disco: un
    # apunte sin archivo -OneDrive que se limpio, carpeta movida- se rehace.
    ya = indice['adjuntos'].get(ident)
    if ya and os.path.exists(os.path.join(chats, ya)) and os.path.getsize(os.path.join(chats, ya)) > 0:
        return ya

    tipo = adj.get('tipo') or 'archivo'
    sub = CARPETAS.get(tipo, 'archivos')
    mes = str(cuando or '')[:7] or datetime.now().strftime('%Y-%m')
    quien = limpiar(autor or '')
    base = '%s %s%s - %s' % (
        str(cuando or '')[:10], str(cuando or '')[11:16].replace(':', ''),
        (' ' + quien) if quien else '',
        limpiar(adj.get('nombre') or ('archivo_' + ident)))

    # UN NOMBRE LIBRE. Dos fotos distintas del mismo minuto con el mismo nombre
    # daban la misma ruta: la segunda se daba por guardada sin escribirse y
    # despues se borraba del servidor. Ahora la segunda se llama "(2)".
    raiz, ext = os.path.splitext(base)
    rel = os.path.join(sub, mes, base)
    n = 2
    while os.path.exists(os.path.join(chats, rel)):
        rel = os.path.join(sub, mes, '%s (%d)%s' % (raiz, n, ext))
        n += 1
    entero = os.path.join(chats, rel)

    if not de_verdad:
        return rel

    try:
        guardado = leer('chat_adj_%s' % ident)
    except Exception as e:
        log('   no se pudo traer el adjunto %s: %s' % (ident, str(e)[:70]), 'ERROR')
        return None
    datos = (guardado[0].get('datos') if guardado else '') or ''
    if ',' not in datos:
        log('   el adjunto %s ya no esta en el servidor' % ident, 'AVISO')
        return None
    try:
        crudo = base64.b64decode(datos.split(',', 1)[1])
    except Exception as e:
        log('   el adjunto %s no se pudo descifrar: %s' % (ident, str(e)[:60]), 'ERROR')
        return None

    os.makedirs(os.path.dirname(entero), exist_ok=True)
    with open(entero, 'wb') as f:
        f.write(crudo)

    # COMPROBAR EN EL DISCO, no en la memoria: se relee lo que quedo grabado.
    if not os.path.exists(entero) or os.path.getsize(entero) != len(crudo):
        log('   el archivo no quedo entero en OneDrive: %s' % rel, 'ERROR')
        return None
    indice['adjuntos'][ident] = rel
    return rel


# ── UNA CONVERSACION ────────────────────────────────────────────────────────────────

def trabajar_sala(chats, sala, corte, nombres, indice, de_verdad):
    """Devuelve (mensajes archivados, adjuntos guardados, ids de adjuntos a soltar)."""
    idsala = sala.get('id')
    area = 'chat_%s' % idsala
    todos = leer(area)
    if not todos:
        return 0, 0, []

    viejos = [m for m in todos
              if str(m.get('cuando') or '')[:10] and str(m.get('cuando'))[:10] < corte
              and m.get('id') != 'nota_archivo']
    if not viejos:
        return 0, 0, []

    carpeta = carpeta_de_sala(chats, sala, nombres, indice)
    titulo = sala.get('nombre') if sala.get('tipo') == 'grupo' else \
        ' y '.join(nombres.get(u, u) for u in (sala.get('miembros') or []))
    log('  %s  ->  %s' % (titulo or idsala, carpeta))
    log('     %d mensajes de mas de %s; %d se quedan' % (len(viejos), bonita(corte), len(todos) - len(viejos)))

    # 1) LOS ARCHIVOS PRIMERO: si alguno falla, ese mensaje no se archiva y no se borra.
    donde_quedo = {}
    fallaron = set()
    for m in viejos:
        adj = m.get('adjunto')
        if not adj:
            continue
        rel = bajar_adjunto(chats, adj, m.get('cuando'), nombres.get(m.get('de'), m.get('de')),
                            indice, de_verdad)
        if rel:
            donde_quedo[adj.get('id')] = rel
        else:
            fallaron.add(m.get('id'))

    if fallaron:
        log('     %d mensajes con archivo no se pudieron guardar: se quedan donde estan' % len(fallaron), 'AVISO')
        viejos = [m for m in viejos if m.get('id') not in fallaron]
        if not viejos:
            return 0, 0, []

    if not de_verdad:
        return len(viejos), len(donde_quedo), []

    # 2) LA CONVERSACION, un archivo por mes
    # CADA MENSAJE SE LLEVA ANOTADO DONDE QUEDO SU ARCHIVO. Asi el .json del mes se
    # basta solo: el .txt se rehace de ahi sin depender de que esta corrida lo sepa.
    por_mes = {}
    for m in viejos:
        copia = dict(m)
        adj = copia.get('adjunto')
        if adj and donde_quedo.get(adj.get('id')):
            copia['adjunto'] = dict(adj)
            copia['adjunto']['archivado'] = donde_quedo[adj['id']]
        por_mes.setdefault(str(m.get('cuando'))[:7], []).append(copia)
    escritos = []
    for mes, lista in sorted(por_mes.items()):
        pj, pt, cuantos = escribir_mes(chats, carpeta, mes, sala, nombres, lista, donde_quedo)
        escritos.append((mes, pj, [m.get('id') for m in lista]))
        log('     %s: %d mensajes en el archivo (%s)' % (mes, cuantos, os.path.basename(pt)))

    # 3) COMPROBAR RELEYENDO EL DISCO. Sin esto, un disco lleno o un OneDrive que
    #    rechaza el archivo pasarian inadvertidos y el paso 4 borraria los mensajes.
    for mes, pj, ids in escritos:
        try:
            with open(pj, encoding='utf-8') as f:
                dentro = set(m.get('id') for m in (json.load(f).get('mensajes') or []))
        except Exception as e:
            log('     NO se pudo releer %s: %s. No se borra nada.' % (pj, str(e)[:60]), 'ERROR')
            return 0, 0, []
        faltan = [i for i in ids if i not in dentro]
        if faltan:
            log('     faltan %d mensajes en %s. No se borra nada.' % (len(faltan), pj), 'ERROR')
            return 0, 0, []

    # 4) RECIEN AHORA SE RECORTA, y sobre una lectura fresca: entre el paso 1 y este
    #    pasan segundos, y alguien puede haber escrito. Se quita SOLO lo archivado.
    archivados = set(m.get('id') for m in viejos)
    frescos = leer(area)
    quedan = [m for m in frescos if m.get('id') not in archivados and m.get('id') != 'nota_archivo']
    # `sistema` le dice al chat que no suene ni ponga globo rojo por esta linea.
    # SIN LEYENDA EN LA CONVERSACION. Se probo dejar una linea ("lo anterior al ... esta en
    # OneDrive") y Daniel la saco el mismo dia: *"esa leyenda borrala, que no este"*. El
    # archivo esta en OneDrive y ahi se busca; en el chat solo van los mensajes.
    guardar(area, quedan)
    time.sleep(1)
    final = leer(area)
    if len(final) != len(quedan):
        log('     ATENCION: se esperaban %d mensajes y quedaron %d' % (len(quedan), len(final)), 'AVISO')
    log('     recortada: %d -> %d mensajes' % (len(frescos), len(final)))

    sueltos = [m['adjunto']['id'] for m in viejos if m.get('adjunto') and m['adjunto'].get('id')
               and m['adjunto']['id'] in donde_quedo]
    return len(viejos), len(donde_quedo), sueltos


def quitar_leyenda(idsala):
    """Se lleva la leyenda que dejaban las primeras corridas, alla donde haya quedado."""
    area = 'chat_%s' % idsala
    try:
        lista = leer(area)
    except Exception:
        return
    limpia = [m for m in lista if m.get('id') != 'nota_archivo']
    if len(limpia) != len(lista):
        guardar(area, limpia)
        log('  %s: se quito la leyenda del archivado' % idsala)


# ── LOS ADJUNTOS QUE YA NO NOMBRA NADIE ─────────────────────────────────────────────

def archivar_huerfanos(chats, corte, vivos, indice, de_verdad):
    """Fotos de mensajes que el administrador borro: nadie las nombra y se quedaban
    ocupando el servidor para siempre. Se guardan igual antes de soltarlas."""
    todas = [a[len('chat_adj_'):] for a in areas_de_chat() if a.startswith('chat_adj_')]
    huerfanos = []
    for ident in todas:
        if ident in vivos:
            continue
        d = fecha_del_adjunto(ident)
        if not d or d.strftime('%Y-%m-%d') >= corte:
            continue          # sin fecha legible no se toca; y lo reciente tampoco
        huerfanos.append((ident, d))
    if not huerfanos:
        return 0, []

    log('  %d archivos sueltos (su mensaje ya no existe)' % len(huerfanos))
    guardados = []
    for ident, d in huerfanos:
        try:
            guardado = leer('chat_adj_%s' % ident)
        except Exception:
            continue
        if not guardado:
            continue
        a = guardado[0]
        ficha = {'id': ident, 'nombre': a.get('nombre') or ('suelto_' + ident),
                 'tipo': a.get('tipo') or 'archivo'}
        rel = bajar_adjunto(chats, ficha, d.strftime('%Y-%m-%dT%H:%M:%S'), a.get('de') or '',
                            indice, de_verdad)
        if rel:
            guardados.append(ident)
    return len(huerfanos), guardados


# ── EL PARTE ────────────────────────────────────────────────────────────────────────

def main():
    global USAR_BETA
    args = sys.argv[1:]
    de_verdad = '--ejecutar' in args
    USAR_BETA = '--beta' in args
    dias = int(args[args.index('--dias') + 1]) if '--dias' in args else DIAS_QUE_SE_QUEDAN
    corte = (datetime.now() - timedelta(days=dias)).strftime('%Y-%m-%d')

    log('=' * 70)
    log('ARCHIVAR CHAT  ·  %s  ·  se conservan %d dias (lo anterior al %s se va a OneDrive)'
        % ('PRUEBAS' if USAR_BETA else 'PRODUCCION', dias, bonita(corte)))
    if not de_verdad:
        log('SIMULACION: no se mueve ni se borra nada. Para hacerlo: --ejecutar')

    a_mano = args[args.index('--carpeta') + 1] if '--carpeta' in args else None
    chats = encontrar_onedrive(a_mano)
    if not chats:
        log('NO ENCUENTRO ONEDRIVE. No se borra nada del servidor.', 'ERROR')
        log('Buscaba en:', 'ERROR')
        for b in ([a_mano] if a_mano else BASES):
            log('   %s' % os.path.join(b, 'chats'), 'ERROR')
        return 1
    log('OneDrive: %s' % chats)

    try:
        salas = leer('chat_salas')
        usuarios = _pedir('/api/logistics/users').get('data') or []
    except Exception as e:
        log('no se pudo leer el chat del servidor: %s' % str(e)[:120], 'ERROR')
        return 2
    nombres = {u.get('username'): (u.get('name') or u.get('username')) for u in usuarios}
    log('%d conversaciones' % len(salas))

    indice = leer_indice(chats)
    total_msg = total_adj = 0
    a_soltar = []
    vivos = set()

    for sala in salas:
        try:
            if de_verdad:
                quitar_leyenda(sala.get('id'))
            m, a, sueltos = trabajar_sala(chats, sala, corte, nombres, indice, de_verdad)
            total_msg += m
            total_adj += a
            a_soltar.extend(sueltos)
            if de_verdad:
                guardar_indice(chats, indice)
        except Exception as e:
            log('  FALLO en %s: %s' % (sala.get('id'), str(e)[:120]), 'ERROR')

    # Los adjuntos que SIGUEN nombrados por algun mensaje: esos no se sueltan nunca.
    for sala in salas:
        try:
            for m in leer('chat_%s' % sala.get('id')):
                if m.get('adjunto') and m['adjunto'].get('id'):
                    vivos.add(m['adjunto']['id'])
        except Exception:
            pass

    try:
        cuantos, sueltos = archivar_huerfanos(chats, corte, vivos, indice, de_verdad)
        a_soltar.extend(sueltos)
        if de_verdad:
            guardar_indice(chats, indice)
    except Exception as e:
        log('  no se pudieron revisar los archivos sueltos: %s' % str(e)[:100], 'AVISO')

    if de_verdad:
        guardar_indice(chats, indice)

    # SOLTAR EL ESPACIO DEL SERVIDOR, al final y solo de lo que quedo comprobado en disco.
    soltados = 0
    if de_verdad:
        # Uno por uno y sin repetir: el barrido de sueltos vuelve a encontrar los que
        # se acaban de archivar, porque su mensaje ya no esta en la conversacion.
        for ident in sorted(set(a_soltar)):
            if ident in vivos:
                continue
            try:
                guardar('chat_adj_%s' % ident, [])
                soltados += 1
            except Exception as e:
                log('  no se pudo soltar el adjunto %s: %s' % (ident, str(e)[:60]), 'AVISO')

    log('-' * 70)
    if de_verdad:
        log('LISTO: %d mensajes y %d archivos guardados en OneDrive; %d adjuntos soltados del servidor'
            % (total_msg, total_adj, soltados))
    else:
        log('SIMULACION: se archivarian %d mensajes y %d archivos. No se movio nada.'
            % (total_msg, total_adj))
    return 0


if __name__ == '__main__':
    sys.exit(main())
