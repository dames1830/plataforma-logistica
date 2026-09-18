# -*- coding: utf-8 -*-
"""GUARDA SOLO EL EXCEL DE GUÍAS QUE MANDA COMERCIAL, DESDE OUTLOOK.

Lo pidió Daniel el 20-ago-2026: *"tengo en mi correo el Excel que me manda
comercial con los pedidos. Quiero que un robot entre a mi correo, cuando detecte
ese adjunto lo guarde en la carpeta destinada y lo procese"*.

CÓMO ENTRA AL CORREO. Le habla al Outlook de escritorio que ya está abierto, por
COM. No pide contraseña, no guarda credenciales y no necesita que sistemas
autorice nada: usa la sesión que ya está iniciada. A cambio, **tiene que correr
en la máquina donde está Outlook con ese buzón**.

QUÉ TOCA Y QUÉ NO. Lee la Bandeja de entrada y guarda adjuntos. **No marca como
leído, no mueve, no borra y no responde nada.** Para no repetir un correo lleva su
propia lista de procesados en `correo_guias_vistos.json`; el buzón queda igual que
estaba.

NO SE FÍA DEL NOMBRE DEL ADJUNTO. Los archivos vienen con dos formatos —
`Guías 15.07.xlsx` con punto y `Guías 15-06.xlsx` con guion— y alguno trae los
datos en la segunda hoja. Antes de guardar nada, el script ABRE el adjunto y
comprueba que tenga una columna GUIA con filas debajo. Si no la tiene, no lo
guarda y lo dice: es preferible un día que falta a un archivo que ensucia.

LA FECHA SALE DEL NOMBRE DEL ADJUNTO, y si no la trae, del día en que llegó. El
archivo se guarda como `Guías DD.MM.xlsx`; si el adjunto dice algo más -"B CARAZ
guias 17.09.xlsx", la tienda nueva del 17-sep-2026-, como `Guías 17.09 B
CARAZ.xlsx`. Un día puede traer más de un correo y ninguno pisa a otro: ver
`nombre_del_archivo` y `destino_para`.

    python correo_guias.py --listar     mira los últimos correos con .xlsx y no
                                        guarda nada. ES EL PRIMER PASO: sirve
                                        para saber qué remitente y qué asunto
                                        poner en la configuración de abajo.
    python correo_guias.py --probar     dice qué guardaría, sin escribir
    python correo_guias.py              guarda de verdad
    python correo_guias.py --dias 7     mira 7 días hacia atrás (por defecto 3)

NO CORRE SOLO TODAVÍA. Primero hay que llenar REMITENTE y ASUNTO con lo que
devuelva `--listar`; con los dos vacíos no guarda nada y avisa.
"""
import io
import json
import os
import re
import subprocess
import sys
import traceback
import zipfile
from datetime import datetime, timedelta
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET


def sin_tildes(t):
    """Para comparar textos que a veces vienen con tilde y a veces no.

    El asunto llega como "Guías de Prescripciones" pero nadie lo escribe siempre
    igual, y un filtro que falla por una tilde deja el correo sin bajar sin que
    nadie se entere."""
    t = unicodedata.normalize('NFD', str(t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')

# ── LO QUE BUSCA Y CUANDO LO BUSCA LO MANDA LA WEB ──────────────────
# Daniel, 20-ago-2026: *"si comercial me llama y me dice que hoy lo manda a las
# nueve, yo lo tengo que cambiar en el modulo de parametros"*. Un horario escrito
# en el script obliga a entrar al servidor cada vez que cambia algo alla afuera.
#
# La cascada es la misma que la de los horarios de los robots: **la web manda, el
# cache salva y los valores de fabrica son el ultimo respaldo**. Si no hay
# internet el robot NO se queda quieto: trabaja con lo ultimo que leyo.
API = 'https://logistics-backend-wv0x.onrender.com/api/logistics/config'
CLAVE = 'correoGuias'          # dentro del area `config`, al lado de `robots`

DIAS_SEM = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

# Lo que hacia falta al 20-ago-2026. El asunto es el que dijo Daniel; el
# remitente va VACIO A PROPOSITO, porque el mismo archivo llega dos veces -el
# original de Oscar Martinez Tejada y un reenvio "RV:" de Milagros Quijaite
# Nieto- y filtrar por persona dejaria el dia sin bajar si un dia lo manda otro.
DE_FABRICA = {
    'activa': True,
    'asunto': 'guias de prescripciones',
    'remitente': '',
    'desde': '18:00',           # el correo llega entre las 19:00 y las 20:00
    'hasta': '23:00',
    # LA HORA MAS TEMPRANA A LA QUE SE PUEDE ARMAR EL PENDIENTE. La eligio Daniel el
    # 21-ago-2026: *"por mas que el correo te llegue a las seis y media, normal, tu
    # lo capturas, esperas a las siete de la noche y corres interfaz de WMS"*. El
    # correo se guarda igual a la hora que llegue; lo que espera es el cruce, porque
    # la foto del WMS tiene que traer los pedidos nacidos durante el dia.
    'pendienteDesde': '19:00',
    'diasAtras': 3,
    'dias': {'lun': True, 'mar': True, 'mie': True, 'jue': True,
             'vie': True, 'sab': True, 'dom': False},
}

REMITENTE = DE_FABRICA['remitente']
ASUNTO = DE_FABRICA['asunto']


def _base_onedrive():
    """La carpeta de OneDrive. SE BUSCA, NO SE ESCRIBE A MANO.

    En la laptop el usuario de Windows es 'dames' y en el servidor
    'Administrator'. Una ruta fija sirve en una maquina y revienta en la otra: el
    20-ago-2026 este robot bajo el correo bien y murio al guardarlo, con "No such
    file or directory" apuntando a C:\\Users\\dames\\... Es el mismo error que ya se
    habia pagado el 05-ago con generar_slotting.py, de donde sale esta funcion.
    """
    for c in (os.environ.get('OneDrive'), os.environ.get('OneDriveCommercial'),
              os.path.join(os.path.expanduser('~'), 'OneDrive'),
              r'C:\Users\Administrator\OneDrive', r'C:\Users\dames\OneDrive'):
        # El perfil de SYSTEM no es OneDrive: el 08-sep-2026 se fabrico ahi una carpeta
        # fantasma y esta busqueda la elegia primero. La historia, en `distribucion.py`.
        if not c or 'systemprofile' in c.lower():
            continue
        ruta = os.path.join(c, 'danielames.bata', 'scraping Stock')
        if os.path.isdir(ruta):
            return ruta
    return os.path.join(os.path.expanduser('~'), 'OneDrive', 'danielames.bata',
                        'scraping Stock')


DESTINO = os.path.join(_base_onedrive(), 'Correos Picking')
AQUI = os.path.dirname(os.path.abspath(__file__))
VISTOS = os.path.join(AQUI, 'correo_guias_vistos.json')
LOG = os.path.join(AQUI, 'logs', 'correo_guias.log')

CACHE = os.path.join(AQUI, 'correo_guias_cache.json')
# El sello que deja `armar_pendiente.py` cuando publica: adentro va la fecha del
# pendiente que quedo armado. Sin el, este robot no tendria como saber si el de hoy
# ya salio y solo reintentaria cuando entrara OTRO correo.
SELLO_PENDIENTE = os.path.join(AQUI, 'logs', 'pendiente_armado.txt')
# Ahora el armador baja tambien una foto del WMS de 365 dias -unos 8 minutos, y
# hasta 20 mas si tiene que esperar al robot del stock-. La media hora de antes
# lo mataba a mitad de la bajada.
ESPERA_ARMADO = 60 * 60
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
# NO HAY UN MINIMO DE FILAS. Hasta el 17-sep-2026 habia uno de 20 -"un correo de guias
# nunca trae cuatro filas"- y era falso: esa noche comercial mando las guias de una
# tienda nueva en un correo aparte, "B CARAZ guias 17.09.xlsx", con 5 filas, y el robot
# lo descarto dos veces. Lo que comercial manda por correo es lo que se pica, sea una
# guia o mil: basta con que el archivo tenga la columna GUIA y alguna guia debajo.


def log(t, nivel='INFO'):
    linea = '[%s] [%-5s] %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t)
    print(linea)
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with io.open(LOG, 'a', encoding='utf-8') as fh:
            fh.write(datetime.now().strftime('%Y-%m-%d ') + linea + '\n')
    except Exception:
        pass


def arg(nombre, por_defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return por_defecto


def tiene_guias(datos):
    """¿Este .xlsx es de verdad un correo de guías? -> (si_o_no, detalle, guias).

    Abre el archivo en memoria y busca una hoja cuya cabecera tenga la columna
    GUIA. Se miran TODAS las hojas porque la buena no siempre es la primera:
    `Guías 07.07.xlsx` trae Hoja2 adelante con 51 filas y los datos detrás.

    Devuelve tambien EL CONJUNTO DE GUIAS: con eso se sabe si dos archivos del mismo
    dia son el mismo correo -un reenvio "RV:"- o dos correos distintos.

    LA COLUMNA SE BUSCA POR SU LETRA, no por el orden de las celdas: una celda vacia
    no viene en el archivo y correria la cuenta.
    """
    try:
        z = zipfile.ZipFile(io.BytesIO(datos))
    except Exception:
        return False, 'no se pudo abrir como Excel', set()
    sh = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            sh.append(''.join(t.text or '' for t in si.iter(NS + 't')))

    def valor(c):
        v = c.find(NS + 'v')
        val = v.text if v is not None else ''
        if c.get('t') == 's' and val:
            val = sh[int(val)]
        elif c.get('t') == 'inlineStr':
            val = ''.join(t.text or '' for t in c.iter(NS + 't'))
        return str(val or '').strip()

    def letra(c):
        return ''.join(ch for ch in (c.get('r') or '') if ch.isalpha())

    for hoja in sorted(n for n in z.namelist() if n.startswith('xl/worksheets/sheet')):
        filas = list(ET.fromstring(z.read(hoja)).iter(NS + 'row'))
        if not filas:
            continue
        col = None
        for c in filas[0].iter(NS + 'c'):
            x = sin_tildes(valor(c))
            if x == 'guia' or (col is None and 'guia' in x):
                col = letra(c)
        if not col:
            continue
        guias = set()
        for f in filas[1:]:
            for c in f.iter(NS + 'c'):
                if letra(c) == col:
                    g = valor(c)
                    if g.endswith('.0'):
                        g = g[:-2]
                    if g:
                        guias.add(g)
                    break
        if not guias:
            return False, 'tiene columna GUIA pero ninguna guia debajo', set()
        return True, '%d guias' % len(guias), guias
    return False, 'ninguna hoja tiene columna GUIA', set()


def fecha_del_nombre(nombre):
    """(dia, mes) de `Guías 17.09.xlsx` o `Guías 17.09 B CARAZ.xlsx`. None si no trae."""
    m = re.search(r'(\d{2})[.\-](\d{2})(?!\d)', nombre)
    if not m:
        return None
    dia, mes = int(m.group(1)), int(m.group(2))
    if not (1 <= dia <= 31 and 1 <= mes <= 12):
        return None
    return dia, mes


def etiqueta_del_adjunto(adjunto):
    """Lo que el nombre del adjunto dice ADEMAS de la fecha y de la palabra guias.

    El correo de siempre llega como `Guías 17.09.xlsx` y no dice nada mas: etiqueta
    vacia. El de la tienda nueva llego como `B CARAZ guias 17.09.xlsx`: etiqueta
    "B CARAZ". Con eso cada correo del dia tiene su propio archivo.
    """
    base = os.path.splitext(os.path.basename(str(adjunto)))[0]
    m = re.search(r'(\d{1,2})[.\-/](\d{1,2})(?!\d)', base)
    if m:
        base = base[:m.start()] + ' ' + base[m.end():]
    base = re.sub(r'(?i)gu[ií]as?', ' ', base)
    base = re.sub(r'[<>:"/\\|?*]', ' ', base)          # lo que Windows no acepta
    return ' '.join(base.split()).strip(' ._-()')[:60]


def nombre_del_archivo(adjunto, dia, mes):
    """UN DIA PUEDE TRAER MAS DE UN CORREO, y cada uno va a su archivo.

    Hasta el 17-sep-2026 todo adjunto se guardaba como `Guías DD.MM.xlsx`, y con
    "gana el mas nuevo" un segundo correo del dia pisaba al primero: el de una tienda
    nueva habria borrado las guias del correo de siempre, o al reves.

        Guías 17.09.xlsx            -> Guías 17.09.xlsx           el de siempre
        B CARAZ guias 17.09.xlsx    -> Guías 17.09 B CARAZ.xlsx   uno adicional

    El reenvio "RV:" trae el MISMO adjunto, asi que cae en el mismo archivo y lo
    reemplaza como siempre. Los que leen la carpeta -`armar_pendiente.py`,
    `distribucion.py`, el Fill Rate- toman todos los archivos del dia.
    """
    et = etiqueta_del_adjunto(adjunto)
    return 'Guías %02d.%02d%s.xlsx' % (dia, mes, (' ' + et) if et else '')


def guias_de(ruta):
    """Las guias de un archivo ya guardado. Vacio si no se puede leer."""
    try:
        with io.open(ruta, 'rb') as fh:
            return tiene_guias(fh.read())[2]
    except Exception:
        return set()


def destino_para(nombre, guias):
    """(nombre, ruta) donde va este adjunto SIN PISAR OTRO CORREO.

    Si ya hay un archivo con ese nombre y comparte guias con este, es el mismo correo
    -el reenvio o una correccion-: se devuelve ese, y afuera decide el mas nuevo, como
    siempre. Si NO comparte ninguna guia, es otro correo que vino con el mismo nombre de
    adjunto, y va a `Guías 17.09 (2).xlsx`: pisarlo borraria las guias de uno de los dos.
    """
    base, ext = os.path.splitext(nombre)
    for n in range(1, 20):
        cand = nombre if n == 1 else '%s (%d)%s' % (base, n, ext)
        ruta = os.path.join(DESTINO, cand)
        if not os.path.exists(ruta):
            return cand, ruta
        previas = guias_de(ruta)
        if not previas or previas & guias:
            return cand, ruta
        log('   %s ya tiene OTRO correo (ninguna guia en comun): este no lo pisa'
            % cand, 'WARN')
    return cand, ruta


def correos_de_hoy(ahora):
    """Las rutas de TODOS los correos guardados con la fecha de hoy: el de siempre y
    los adicionales."""
    out = []
    try:
        for n in os.listdir(DESTINO):
            if n.startswith('~$') or not n.lower().endswith('.xlsx'):
                continue
            if fecha_del_nombre(n) == (ahora.day, ahora.month):
                out.append(os.path.join(DESTINO, n))
    except OSError:
        pass
    return out


def outlook():
    try:
        import win32com.client
    except ImportError:
        raise SystemExit('Falta pywin32. Instalalo con:  pip install pywin32')
    try:
        return win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
    except Exception as e:
        raise SystemExit('No se pudo hablar con Outlook (%s: %s).\n'
                         'Tiene que estar instalado y abierto en ESTA maquina, '
                         'con la cuenta que recibe el correo.'
                         % (type(e).__name__, str(e)[:120]))


def bandejas(mapi):
    """Las Bandejas de entrada de TODAS las cuentas configuradas, no solo la
    predeterminada. En el servidor puede haber mas de un buzon, o el que importa
    puede no ser el primero, y buscar solo en el default deja el robot mudo."""
    out = []
    try:
        for st in mapi.Stores:
            try:
                b = st.GetDefaultFolder(6)      # 6 = olFolderInbox
                out.append((st.DisplayName, b))
            except Exception:
                continue
    except Exception:
        pass
    if not out:
        try:
            b = mapi.GetDefaultFolder(6)
            out.append(('(cuenta predeterminada)', b))
        except Exception as e:
            raise SystemExit('Outlook no devolvio ninguna Bandeja de entrada '
                             '(%s: %s). Lo mas probable es que todavia no tenga '
                             'la cuenta configurada.' % (type(e).__name__, str(e)[:120]))
    return out


def correos(dias, diag=False):
    """Los correos con adjunto de los ultimos N dias, de todas las bandejas.

    EL FILTRO DE FECHA DE OUTLOOK ES QUISQUILLOSO. La primera version armaba la
    fecha con "%H:%M %p" -hora de 24 con AM/PM pegado, o sea "16:46 PM"- y Outlook,
    en vez de quejarse, devolvia CERO correos en silencio. Ahora va solo la fecha,
    sin hora, que es lo que no falla; y si aun asi el Restrict no devuelve nada, se
    recorren los ultimos correos a mano y se compara la fecha en Python.
    """
    mapi = outlook()
    for nombre, bandeja in bandejas(mapi):
        items = bandeja.Items
        try:
            items.Sort('[ReceivedTime]', True)
        except Exception:
            pass
        total = 0
        try:
            total = items.Count
        except Exception:
            pass
        if diag:
            log('   bandeja "%s": %s correos' % (nombre, format(total, ',d')))
        if not total:
            continue

        desde = datetime.now() - timedelta(days=dias)
        sel = None
        try:
            sel = items.Restrict("[ReceivedTime] >= '%s'" % desde.strftime('%m/%d/%Y'))
            n = sel.Count
            if diag:
                log('      del ultimo %d dias: %s' % (dias, format(n, ',d')))
            if not n:
                sel = None
        except Exception as e:
            if diag:
                log('      el filtro de fecha fallo (%s), se recorre a mano'
                    % type(e).__name__, 'WARN')
            sel = None

        # Sin filtro se recorren los mas nuevos y se corta al pasarse de fecha:
        # estan ordenados por fecha descendente, asi que no hace falta leerlos todos.
        recorrido = sel if sel is not None else items
        mirados = 0
        for it in recorrido:
            mirados += 1
            if sel is None and mirados > 500:
                break
            try:
                if it.Class != 43:                  # 43 = MailItem
                    continue
                if sel is None and it.ReceivedTime.replace(tzinfo=None) < desde:
                    break
                if it.Attachments.Count == 0:
                    continue
                yield it
            except Exception:
                continue


def _hhmm(v, sino):
    """Una hora valida o la de siempre. Un "25:99" escrito a mano no puede dejar
    al robot sin correr, ni corriendo todo el dia."""
    try:
        h, m = str(v).split(':')
        if 0 <= int(h) <= 23 and 0 <= int(m) <= 59:
            return '%02d:%02d' % (int(h), int(m))
    except Exception:
        pass
    return sino


def configuracion():
    """La configuracion vigente: web -> cache -> fabrica. Nunca devuelve vacio."""
    cfg, de_donde = None, ''
    try:
        with urllib.request.urlopen('%s?t=correo' % API, timeout=20) as r:
            cuerpo = json.load(r)
        datos = cuerpo.get('data', cuerpo) if isinstance(cuerpo, dict) else cuerpo
        v = (datos or {}).get(CLAVE)
        if isinstance(v, dict) and v:
            cfg, de_donde = v, 'la web'
            try:
                json.dump({'cuando': datetime.now().isoformat(timespec='seconds'),
                           CLAVE: v}, io.open(CACHE, 'w', encoding='utf-8'),
                          ensure_ascii=False, indent=1)
            except Exception:
                pass
    except Exception as e:
        log('no se pudo leer la web (%s): se usa lo guardado' % type(e).__name__,
            'WARN')
    if cfg is None:
        try:
            cfg = json.load(io.open(CACHE, encoding='utf-8')).get(CLAVE)
            de_donde = 'el cache (la web no contesto)'
        except Exception:
            cfg = None
    if not isinstance(cfg, dict) or not cfg:
        cfg, de_donde = dict(DE_FABRICA), 'los valores de fabrica'

    # Nada se da por presente: lo que falte se completa con lo de fabrica.
    out = dict(DE_FABRICA)
    out.update({k: v for k, v in cfg.items() if v is not None})
    out['desde'] = _hhmm(out.get('desde'), DE_FABRICA['desde'])
    out['hasta'] = _hhmm(out.get('hasta'), DE_FABRICA['hasta'])
    out['pendienteDesde'] = _hhmm(out.get('pendienteDesde'),
                                  DE_FABRICA['pendienteDesde'])
    try:
        out['diasAtras'] = max(1, min(30, int(out.get('diasAtras'))))
    except Exception:
        out['diasAtras'] = DE_FABRICA['diasAtras']
    d = dict(DE_FABRICA['dias'])
    if isinstance(cfg.get('dias'), dict):
        d.update({k: bool(v) for k, v in cfg['dias'].items() if k in DIAS_SEM})
    out['dias'] = d
    return out, de_donde


def paso_la_hora(cfg, ahora=None):
    """Ya se puede armar el pendiente? Es un PISO, no un horario.

    El correo se guarda a la hora que llegue. Lo que espera es el cruce: si comercial
    manda a las 18:30, la foto del WMS de esa hora todavia no trae los pedidos de la
    tarde. Si manda a las 20:15, se arma a las 20:15 y no espera a nada.

    Si la ventana del correo cruza la medianoche -de 22:00 a 02:00-, pasada la
    medianoche cualquier piso de la tarde anterior ya quedo atras.
    """
    ahora = ahora or datetime.now()
    hm = ahora.strftime('%H:%M')
    piso = cfg.get('pendienteDesde') or DE_FABRICA['pendienteDesde']
    if cfg['desde'] <= cfg['hasta']:
        return hm >= piso
    return hm >= piso or hm <= cfg['hasta']


def le_toca(cfg, ahora=None):
    """Corresponde mirar el correo ahora? Devuelve (si_o_no, por_que).

    LA HORA ES LA DEL SERVIDOR, sin pasar por UTC: en Peru eso adelanta el dia a
    las 19:00, justo en la franja en que llega este correo.
    """
    ahora = ahora or datetime.now()
    if not cfg.get('activa', True):
        return False, 'esta apagado en la web'
    dia = DIAS_SEM[ahora.weekday()]
    if not cfg['dias'].get(dia, True):
        return False, 'los %s no corre' % dia
    hm = ahora.strftime('%H:%M')
    if cfg['desde'] <= cfg['hasta']:
        dentro = cfg['desde'] <= hm <= cfg['hasta']
    else:
        # Una ventana que cruza la medianoche -de 22:00 a 02:00- son dos tramos.
        dentro = hm >= cfg['desde'] or hm <= cfg['hasta']
    if not dentro:
        return False, 'son las %s y la ventana es de %s a %s' % (
            hm, cfg['desde'], cfg['hasta'])
    return True, 'dentro de la ventana de %s a %s' % (cfg['desde'], cfg['hasta'])


def main():
    cfg, de_donde = configuracion()
    global REMITENTE, ASUNTO
    REMITENTE = str(cfg.get('remitente') or '')
    ASUNTO = str(cfg.get('asunto') or '')
    dias = int(arg('--dias', cfg['diasAtras']))
    listar = '--listar' in sys.argv
    probar = '--probar' in sys.argv

    log('=' * 58)
    log('CORREO DE GUIAS · mirando %d dias hacia atras' % dias)
    log('=' * 58)
    log('Se guarda en: %s%s' % (DESTINO, '' if os.path.isdir(DESTINO)
                                else '   <-- ESA CARPETA NO EXISTE'))
    log('Configuracion: de %s' % de_donde)
    log('   asunto "%s"%s' % (ASUNTO,
        (' \u00b7 remitente "%s"' % REMITENTE) if REMITENTE else ''))
    if REMITENTE:
        # Leer el remitente cuelga al robot con un cartel de Outlook: ver mas abajo.
        log('   el filtro de remitente NO se usa: para leer el remitente Outlook pide '
            'permiso con un cartel y el robot se queda colgado. Solo manda el asunto.',
            'WARN')
        REMITENTE = ''
    log('   ventana de %s a %s \u00b7 dias: %s'
        % (cfg['desde'], cfg['hasta'],
           ', '.join(d for d in DIAS_SEM if cfg['dias'].get(d))))
    # --listar y --probar se miran cuando uno quiere, sin esperar a la hora.
    if not listar and not probar and '--ahora' not in sys.argv:
        toca, por = le_toca(cfg)
        if not toca:
            log('No toca ahora: %s' % por)
            return 1

    if listar:
        log('MODO LISTAR: no se guarda nada. Elige de aqui el asunto y ponlo en la')
        log('web, en Administracion > Configuracion > Parametros.')
        log('')
        log('Cuentas y bandejas que ve Outlook:')
        n = con_excel = 0
        for it in correos(dias, diag=True):
            n += 1
            adj = [a.FileName for a in it.Attachments
                   if str(a.FileName).lower().endswith(('.xlsx', '.xls'))]
            if not adj:
                continue
            con_excel += 1
            # SIN EL REMITENTE: ver el comentario de `SenderName` mas abajo.
            log('%-16s | %s' % (it.ReceivedTime.strftime('%d-%m %H:%M'),
                                str(it.Subject)[:80]))
            log('%16s   adjuntos: %s' % ('', ', '.join(adj)))
        log('')
        log('%d correos con adjunto en %d dias · %d de ellos con Excel'
            % (n, dias, con_excel))
        if not n:
            log('')
            log('NINGUN correo con adjunto. Lo mas probable, en orden:', 'WARN')
            log('  1. Outlook todavia no termino de bajar el buzon.', 'WARN')
            log('  2. La cuenta no esta configurada en ESTE Outlook.', 'WARN')
            log('  3. El correo no cae en la Bandeja de entrada sino en una', 'WARN')
            log('     subcarpeta o en otra cuenta.', 'WARN')
        return 0

    if not REMITENTE and not ASUNTO:
        log('El asunto y el remitente estan vacios en la configuracion: no se',
            'ERROR')
        log('guarda nada, porque entraria cualquier Excel. Ponelos en la web.',
            'ERROR')
        return 1

    vistos = {}
    if os.path.exists(VISTOS):
        try:
            vistos = json.load(io.open(VISTOS, encoding='utf-8'))
        except Exception:
            vistos = {}

    guardados = saltados = 0
    for it in correos(dias):
        eid = str(it.EntryID)
        if eid in vistos:
            continue
        # EL REMITENTE NO SE LEE. Ni `SenderEmailAddress` ni `SenderName`: en el
        # Outlook del servidor LAS DOS abren el cartel "Un programa intenta obtener
        # acceso a direcciones de correo de Outlook", que espera un clic y deja al
        # robot colgado. Aca decia que `SenderName` no estaba protegida; el
        # 18-sep-2026 dos lecturas que la pedian quedaron colgadas con el antivirus
        # al dia, y hubo que cerrar los carteles con "Denegar". Por eso el filtro de
        # remitente se apaga arriba y solo manda el asunto.
        asunto = sin_tildes(it.Subject)
        if ASUNTO and sin_tildes(ASUNTO) not in asunto:
            continue

        for a in it.Attachments:
            if not str(a.FileName).lower().endswith('.xlsx'):
                continue
            # LA FECHA SALE DEL NOMBRE DEL ADJUNTO, que ya la trae -"Guias 18.08"-,
            # y solo si no se puede leer se cae a la del correo. Es mas fiel: si
            # comercial manda el lunes las guias del viernes, el nombre lo dice y
            # la hora de recepcion no.
            m = re.search(r'(\d{1,2})[.\-/](\d{1,2})(?!\d)', str(a.FileName))
            if m and 1 <= int(m.group(1)) <= 31 and 1 <= int(m.group(2)) <= 12:
                dia_, mes_ = int(m.group(1)), int(m.group(2))
            else:
                dia_, mes_ = it.ReceivedTime.day, it.ReceivedTime.month
                log('   "%s" no trae fecha en el nombre: se usa la del correo'
                    % a.FileName, 'WARN')
            tmp = os.path.join(os.environ.get('TEMP', AQUI), '_guias_tmp.xlsx')
            a.SaveAsFile(tmp)
            datos = io.open(tmp, 'rb').read()
            os.remove(tmp)

            ok, detalle, guias = tiene_guias(datos)
            if not ok:
                log('   %s de "%s": NO es un correo de guias (%s)'
                    % (a.FileName, str(it.Subject)[:40], detalle), 'WARN')
                saltados += 1
                continue
            # CADA CORREO DEL DIA A SU ARCHIVO, y ninguno pisa a otro distinto.
            nombre, ruta = destino_para(nombre_del_archivo(a.FileName, dia_, mes_),
                                        guias)

            # SI YA HAY ARCHIVO, GANA EL MAS NUEVO. El mismo dia llega dos veces
            # -el original y un reenvio "RV:"- y con quedarse con uno alcanza. Pero
            # si comercial manda MANANA una correccion de las guias de hoy, esa
            # tiene que pisar: con un "no se pisa" a secas, la correccion no
            # entraba nunca y el dia quedaba con la lista vieja. `destino_para` ya
            # separo lo que es OTRO correo: aca solo llega el mismo.
            if os.path.exists(ruta):
                nace = it.ReceivedTime.replace(tzinfo=None)
                tiene = datetime.fromtimestamp(os.path.getmtime(ruta))
                if nace <= tiene:
                    log('   %s ya esta y es mas nuevo que este correo (%s): se deja'
                        % (nombre, nace.strftime('%d-%m %H:%M')))
                    saltados += 1
                    continue
                log('   %s se reemplaza: llego una version mas nueva (%s)'
                    % (nombre, nace.strftime('%d-%m %H:%M')), 'WARN')
            if probar:
                log('   (prueba) guardaria %s  ·  %s' % (nombre, detalle))
            else:
                os.makedirs(DESTINO, exist_ok=True)
                io.open(ruta, 'wb').write(datos)
                log('   guardado %s  ·  %s' % (nombre, detalle))
            guardados += 1
            vistos[eid] = {'fecha': it.ReceivedTime.strftime('%Y-%m-%d %H:%M'),
                           'asunto': str(it.Subject)[:80], 'archivo': nombre}

    if not probar:
        """La lista de vistos es CONTABILIDAD, no el trabajo. Si no se puede
        escribir, se avisa y se sigue: el correo ya se guardo y tirar la corrida
        entera por esto seria perder el dia. La noche del 20-ago-2026 un
        PermissionError aca mataba la tarea DESPUES de haber hecho todo bien
        -la carpeta habia quedado de cuando la tarea corria como SYSTEM-."""
        try:
            json.dump(vistos, io.open(VISTOS, 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)
        except Exception as e:
            log('No se pudo guardar la lista de vistos (%s: %s). El correo SI se '
                'guardo; la proxima corrida volvera a mirar los mismos mensajes. '
                'Se arregla con:  icacls %s /grant "%%USERNAME%%:(OI)(CI)F" /T'
                % (type(e).__name__, str(e)[:90], AQUI), 'AVISO')
    log('')
    log('LISTO · %d guardados · %d salteados' % (guardados, saltados))

    """Y SI ENTRO UN CORREO NUEVO, SE ARMA EL PENDIENTE.

    Va disparado por el correo y no por una hora fija, y eso es a proposito: la
    foto del WMS tiene que ser POSTERIOR al correo. El 20-ago-2026 se midio que el
    robot baja el pendiente a las 06:57 y el correo llega a las 19:00; con la foto
    de la mañana faltaban 277 ordenes -las nacidas durante el dia, entre ellas las
    del correo de esa misma tarde- y sobraban 492 ya cerradas. Desde el 21-ago el
    armador baja su propia foto antes de cruzar, y si no lo consigue NO publica.

    Y POR ESO ACA SE REINTENTA. Si la bajada no salio -porque el robot del stock
    estaba adentro del WMS, porque Oracle andaba lento- el pendiente de hoy queda
    sin armar, y sin reintento se quedaria asi hasta mañana: este robot solo
    despierta al armador cuando entra un correo, y el correo del dia ya entro. El
    sello dice que dia quedo publicado; mientras haya correo de hoy y el sello no
    lo diga, cada media hora se vuelve a probar hasta las 23:00.

    Va en un proceso aparte para que una caida de aquel NO se lleve puesto a este:
    el correo ya quedo guardado, que es lo que no se puede perder. Su salida se
    lee en `logs/armar_pendiente.log`.
    """
    ahora = datetime.now()
    # TODOS LOS CORREOS DE HOY, no solo `Guías DD.MM.xlsx`: el dia que solo llega uno
    # adicional -como el de B CARAZ el 17-09- tambien hay correo, y el pendiente se
    # rehace con el mas nuevo de todos.
    de_hoy = correos_de_hoy(ahora)
    hay_correo_de_hoy = bool(de_hoy)
    correo_hoy = max(de_hoy, key=os.path.getmtime) if de_hoy else None

    # NO ALCANZA CON QUE EL SELLO DIGA HOY: TIENE QUE SER POSTERIOR AL CORREO.
    #
    # El 01-sep-2026 se armo el pendiente A MANO a las 09:47 y eso sello el dia.
    # El correo entro a las 18:02, y a las 19:02 y 19:32 el robot vio "ya esta
    # armado" y no lo rehizo: la pantalla se quedo con la foto de la manana, sin
    # los pedidos que comercial acababa de mandar. Daniel lo cazo mirando la hora
    # del archivo PEDIDOS: *"tiene fecha de hoy pero 9:47, y el correo llego a
    # las 5:27; algo no me cuadra"*.
    #
    # Cualquier corrida -a mano o del robot- anterior al correo del dia deja de
    # contar como armada.
    ya_armado = False
    try:
        sellado = io.open(SELLO_PENDIENTE, encoding='utf-8').read().strip()
        if sellado == ahora.strftime('%Y-%m-%d'):
            ya_armado = True
            viejo = (hay_correo_de_hoy and os.path.getmtime(SELLO_PENDIENTE)
                     < os.path.getmtime(correo_hoy))
            if viejo:
                ya_armado = False
                log('El sello dice hoy pero es ANTERIOR al correo de las %s: el '
                    'pendiente se rehace.'
                    % datetime.fromtimestamp(
                        os.path.getmtime(correo_hoy)).strftime('%H:%M'))
    except Exception:
        ya_armado = False

    if (guardados or (hay_correo_de_hoy and not ya_armado)) and not probar \
            and not paso_la_hora(cfg, ahora):
        log('')
        log('El correo esta guardado, pero todavia no son las %s: el pendiente se '
            'arma despues, cuando la foto del WMS ya traiga los pedidos del dia.'
            % cfg['pendienteDesde'])
    elif (guardados or (hay_correo_de_hoy and not ya_armado)) and not probar:
        armador = os.path.join(AQUI, 'armar_pendiente.py')
        if not os.path.isfile(armador):
            log('No esta armar_pendiente.py, no se arma el pendiente.', 'AVISO')
        else:
            log('')
            log('Entro correo nuevo: se arma el pendiente de despacho...' if guardados
                else 'El pendiente de hoy todavia no se publico: se reintenta...')
            try:
                cod = subprocess.run([sys.executable, armador],
                                     timeout=ESPERA_ARMADO).returncode
                if cod == 0:
                    log('Pendiente de despacho: armado')
                elif cod == 2:
                    log('Pendiente de despacho: NO se publico. No se pudo bajar del '
                        'WMS una foto posterior al correo, asi que queda el del dia '
                        'anterior. Se reintenta en la proxima vuelta.', 'AVISO')
                else:
                    log('Pendiente de despacho: FALLO (codigo %s), ver '
                        'logs/armar_pendiente.log' % cod, 'ERROR')
            except Exception as e:
                log('No se pudo arrancar armar_pendiente.py (%s: %s)'
                    % (type(e).__name__, str(e)[:120]), 'ERROR')

    return 0


if __name__ == '__main__':
    """NADA SE MUERE EN SILENCIO.

    `raise SystemExit('mensaje')` escribe el mensaje por *stderr* y sale con
    codigo 1. Corriendo a mano se ve en pantalla; corriendo como TAREA no lo ve
    NADIE: la noche del 20-ago-2026 la tarea termino con `Last Result: 1` y
    `correo_guias.log` sin una sola linea nueva, y costo horas encontrar que el
    problema era que no podia hablar con Outlook.

    Ahora todo -el mensaje de SystemExit y cualquier error no previsto- queda
    escrito en el log antes de salir. Un robot que falla tiene que dejar dicho
    por que.
    """
    try:
        codigo = main()
    except SystemExit as e:
        codigo = e.code
        if isinstance(codigo, str):        # SystemExit('mensaje')
            log(codigo, 'ERROR')
            codigo = 1
    except KeyboardInterrupt:
        log('Cortado a mano.', 'AVISO')
        codigo = 1
    except Exception:
        log('SE CAYO SIN AVISAR:', 'ERROR')
        for linea in traceback.format_exc().rstrip().splitlines():
            log('   ' + linea, 'ERROR')
        codigo = 1
    sys.exit(codigo)
