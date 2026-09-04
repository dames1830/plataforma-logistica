# -*- coding: utf-8 -*-
"""CAPTURA EL CORREO DE PROGRAMACION DE RECEPCION (las citas de nacional).

Daniel, 03-sep-2026: *"arranca con el robot de correo de citas, programalo de una
vez. Ojo que el correo lo mandan a partir de las cuatro de la tarde, mas o menos,
o sea que entre cuatro y seis tienes que capturar ese correo"*.

PARA QUE SIRVE
--------------
Es la primera columna del reporte de recepcion que pidio: *"lo que se programo en
citas por el correo, lo que llego, lo que se verifico, y lo que se matriculo en el
buffer"*. Sin este correo no hay contra que comparar lo recibido.

SOLO LO NACIONAL SE PROGRAMA. La importacion depende del contenedor y de aduana,
asi que ahi no hay cita: se mide contra lo que anuncia el ASN.

EL PUENTE CON EL ASN ES LA O/C, NO EL PROVEEDOR
-----------------------------------------------
El correo escribe la orden como `2026-09057` y el ASN la lleva adentro del numero:

    20260905701BA.8817454   ->   orden 2026-09057-01, sociedad BA

Comprobado el 03-sep-2026 sobre las 8 citas del correo del dia 4: cinco cruzaron.
Las tres que faltaban son coherentes con que lo nacional registra su ASN DESPUES
de llegar, asi que al momento de la cita todavia no existe.

**El proveedor NO sirve para cruzar**: la columna `Proveedor` del ASN trae el
expediente, no el nombre.

**Y las cantidades no tienen por que coincidir**: el correo trae lo de ESA cita y
el ASN la orden completa. Daniel: *"no necesariamente tiene que cuadrar la cita
con lo que trae el proveedor, a veces lo trae parcial"*.

NUNCA SE FILTRA POR REMITENTE
-----------------------------
Daniel, 03-sep-2026: *"recuerda que no solo ella puede enviarlo, ya te paso una
vez con el correo de pedidos de comercial"*. Se busca SOLO por asunto. Hoy lo
manda Cynthia Farronay (Operador de Citas, Adecco Peru), pero manana puede ser
otra persona y el dia no se puede perder por eso.

QUE TOCA Y QUE NO
-----------------
Lee la Bandeja de entrada y nada mas. **No marca como leido, no mueve, no borra y
no responde.** Para no repetir un correo lleva su propia lista en
`correo_citas_vistos.json`; el buzon queda igual que estaba.

LA FECHA SALE DEL ASUNTO, no de cuando llego el correo. El asunto dice
"PROGRAMACION DE RECEPCION DEL DIA 04/09/2026" y se manda la tarde ANTERIOR: si se
usara la fecha de llegada, toda la programacion quedaria corrida un dia.

USO
    python correo_citas.py --listar    muestra los correos que encajan y NO guarda
                                       nada. ES EL PRIMER PASO.
    python correo_citas.py --ver       abre los correos que encajan y dice QUE
                                       TRAEN: adjuntos, tablas, y el arranque del
                                       texto. Para cuando salen cero citas.
    python correo_citas.py --probar    dice que guardaria, sin publicar
    python correo_citas.py             captura y publica
    python correo_citas.py --dias 7    mira 7 dias atras (por defecto 3)
    python correo_citas.py --igual     lo corre aunque hoy ya se haya capturado
"""
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

API = 'https://logistics-backend-wv0x.onrender.com/api/logistics/'
AREA = 'citas_recepcion'
ROBOT_TOKEN = os.environ.get('ROBOT_TOKEN', '')

# EL ASUNTO, SIN LA FECHA. El correo se llama "PROGRAMACION DE RECEPCION DEL DIA
# 04/09/2026": la parte estable es la de adelante.
ASUNTO = 'programacion de recepcion'
REMITENTE = ''          # VACIO A PROPOSITO. Ver arriba.

def _base_onedrive():
    """La carpeta de OneDrive. SE BUSCA, NO SE ESCRIBE A MANO: en la laptop el
    usuario de Windows es 'dames' y en el servidor 'Administrator'. Una ruta fija
    sirve en una maquina y revienta en la otra -le paso a correo_guias.py el
    20-ago-2026: bajo el correo bien y murio al guardarlo-."""
    for c in (os.environ.get('OneDrive'), os.environ.get('OneDriveCommercial'),
              os.path.join(os.path.expanduser('~'), 'OneDrive'),
              os.path.join('C:' + os.sep, 'Users', 'Administrator', 'OneDrive'),
              os.path.join('C:' + os.sep, 'Users', 'dames', 'OneDrive')):
        if not c:
            continue
        ruta = os.path.join(c, 'danielames.bata', 'scraping Stock')
        if os.path.isdir(ruta):
            return ruta
    return os.path.join(os.path.expanduser('~'), 'OneDrive', 'danielames.bata',
                        'scraping Stock')


# LA IMAGEN SE GUARDA SIEMPRE, lea bien el OCR o no. Es el original contra el que
# Daniel puede comprobar cualquier numero, y sin ella un error de lectura seria
# imposible de descubrir.
CARPETA_IMG = os.path.join(_base_onedrive(), 'Citas Recepcion')
LECTOR = os.path.join(AQUI, 'leer_imagen.ps1')

VISTOS = os.path.join(AQUI, 'correo_citas_vistos.json')
# LA MARCA DEL DIA. Daniel, 03-sep-2026: *"una vez que encuentre la tarea, las tres
# de la tarde, ya que ese dia aborte: que no vaya consultando a las tres y diez,
# tres y veinte. Si ya lo encontro, ya"*.
#
# No alcanza con la lista de vistos: esa evita PROCESAR dos veces, pero el robot
# igual abre Outlook y recorre el buzon, y eso tarda DOS MINUTOS medidos. De 12:00
# a 19:00 son 43 pases: hora y media de Outlook trabajando para nada.
ESTADO = os.path.join(AQUI, 'correo_citas_estado.json')
LOG = os.path.join(AQUI, 'logs', 'correo_citas.log')

# La fecha del asunto: "DEL DIA 04/09/2026" y tambien "DEL 04-09-2026".
FECHA_ASUNTO = re.compile(r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})')
# La orden de compra tal como la escribe el correo: 2026-09057
OC = re.compile(r'\b(\d{4})\s*[-]\s*(\d{4,6})\b')


def sin_tildes(t):
    """Para comparar textos que a veces vienen con tilde y a veces no.

    Un asunto que llega como "PROGRAMACIÓN" y un filtro que busca "PROGRAMACION"
    no se encuentran, y el dia se pierde sin que nadie se entere."""
    t = unicodedata.normalize('NFD', str(t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')


def log(t, nivel='INFO'):
    linea = '[%s] [%-5s] %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t)
    print(linea)
    sys.stdout.flush()
    try:
        if not os.path.isdir(os.path.dirname(LOG)):
            os.makedirs(os.path.dirname(LOG))
        with io.open(LOG, 'a', encoding='utf-8') as fh:
            fh.write(datetime.now().strftime('%Y-%m-%d ') + linea + chr(10))
    except Exception:
        pass


def arg(nombre, por_defecto=None):
    for i, a in enumerate(sys.argv):
        if a == nombre and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return por_defecto


# ══════════════════════════════════════════════════════════════════════════════
#  OUTLOOK
# ══════════════════════════════════════════════════════════════════════════════
def outlook():
    """Le habla al Outlook de escritorio que ya esta abierto, por COM.

    No pide contrasena, no guarda credenciales y no necesita que sistemas
    autorice nada: usa la sesion iniciada. A cambio, tiene que correr en la
    maquina donde esta Outlook con ese buzon -hoy, el servidor-."""
    try:
        import win32com.client
    except ImportError:
        raise SystemExit('Falta pywin32. Se instala con:  pip install pywin32')
    try:
        return win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
    except Exception as e:
        raise SystemExit('No se pudo hablar con Outlook (%s: %s). Tiene que estar '
                         'instalado y abierto en ESTA maquina, con la cuenta que '
                         'recibe el correo.' % (type(e).__name__, str(e)[:120]))


def bandejas(mapi):
    """Las Bandejas de entrada de TODAS las cuentas, no solo la predeterminada:
    si el buzon que importa no es el primero, buscar solo en el default deja al
    robot mudo. Misma leccion que correo_guias.py."""
    out = []
    try:
        for st in mapi.Stores:
            try:
                out.append((st.DisplayName, st.GetDefaultFolder(6)))   # 6 = Inbox
            except Exception:
                continue
    except Exception:
        pass
    if not out:
        try:
            out.append(('(cuenta predeterminada)', mapi.GetDefaultFolder(6)))
        except Exception as e:
            raise SystemExit('Outlook no devolvio ninguna Bandeja de entrada (%s). '
                             'Lo mas probable: todavia no tiene la cuenta configurada.'
                             % type(e).__name__)
    return out


def correos(dias, diag=False):
    """Los correos de los ultimos N dias, de todas las bandejas.

    EL FILTRO DE FECHA DE OUTLOOK ES QUISQUILLOSO: con un formato que no le gusta
    devuelve CERO correos EN SILENCIO, sin quejarse. Por eso va solo la fecha, sin
    hora; y si aun asi no devuelve nada, se recorren los ultimos a mano y se
    compara en Python. Le costo dos dias a correo_guias.py."""
    mapi = outlook()
    desde = datetime.now() - timedelta(days=dias)
    for nombre, bandeja in bandejas(mapi):
        items = bandeja.Items
        try:
            items.Sort('[ReceivedTime]', True)
        except Exception:
            pass
        try:
            total = items.Count
        except Exception:
            total = 0
        if diag:
            log('   bandeja "%s": %s correos' % (nombre, format(total, ',d')))
        if not total:
            continue
        sel = None
        try:
            sel = items.Restrict("[ReceivedTime] >= '%s'" % desde.strftime('%m/%d/%Y'))
            if not sel.Count:
                sel = None
            elif diag:
                log('      de los ultimos %d dias: %s' % (dias, format(sel.Count, ',d')))
        except Exception:
            sel = None
        if sel is None:
            if diag:
                log('      el filtro de fecha no sirvio; se recorren a mano', 'WARN')
            leidos = 0
            for it in items:
                leidos += 1
                if leidos > 400:
                    break
                try:
                    if it.ReceivedTime.replace(tzinfo=None) < desde:
                        break
                except Exception:
                    continue
                yield nombre, it
        else:
            for it in sel:
                yield nombre, it


# ══════════════════════════════════════════════════════════════════════════════
#  LEER LAS TABLAS DEL CUERPO
# ══════════════════════════════════════════════════════════════════════════════
class Tablas(HTMLParser):
    """Saca las tablas del HTML del correo, como listas de listas de texto.

    Se usa el parser de la libreria estandar y no BeautifulSoup: en el servidor no
    hay forma de garantizar que un paquete de fuera este instalado, y este robot
    tiene que poder correr el dia que lo instalen sin pedir nada mas.

    OUTLOOK ANIDA TABLAS. Una celda puede traer otra tabla adentro; se lleva una
    pila para que las filas caigan en la tabla que corresponde.
    """

    def __init__(self):
        HTMLParser.__init__(self)
        self.tablas = []
        # Cada tabla abierta guarda SU PROPIO estado: la tabla, la fila y la celda
        # que tenia a medio armar. Sin esto, una tabla adentro de una celda pisa la
        # fila de afuera y la cita se pierde entera -probado: Outlook lo hace-.
        self._pila = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._pila.append({'t': [], 'fila': None, 'celda': None})
        elif not self._pila:
            return
        elif tag == 'tr':
            self._pila[-1]['fila'] = []
        elif tag in ('td', 'th') and self._pila[-1]['fila'] is not None:
            self._pila[-1]['celda'] = []
        elif tag == 'br' and self._pila[-1]['celda'] is not None:
            self._pila[-1]['celda'].append(' ')

    def handle_endtag(self, tag):
        if not self._pila:
            return
        c = self._pila[-1]
        if tag == 'table':
            self._pila.pop()
            if c['t']:
                self.tablas.append(c['t'])
            # El texto de la tabla de adentro se suma a la celda que la contiene:
            # "CARTONES DEL NORTE" partido en dos tablas sigue siendo un proveedor.
            if self._pila and self._pila[-1]['celda'] is not None:
                for f in c['t']:
                    self._pila[-1]['celda'].extend(f)
        elif tag == 'tr' and c['fila'] is not None:
            c['t'].append(c['fila'])
            c['fila'] = None
        elif tag in ('td', 'th') and c['celda'] is not None and c['fila'] is not None:
            c['fila'].append(re.sub(r'\s+', ' ', ' '.join(c['celda'])).strip())
            c['celda'] = None

    def handle_data(self, d):
        if self._pila and self._pila[-1]['celda'] is not None:
            self._pila[-1]['celda'].append(d)


def guardar_imagen(it, fecha):
    """Guarda la captura de la tabla y devuelve su ruta.

    CUAL DE LOS ADJUNTOS ES LA TABLA. Los correos traen dos: la captura y el logo
    de la firma. Medido sobre los cuatro del buzon el 03-sep-2026, el logo pesa
    6.994 bytes EXACTOS en los cuatro, y la tabla cambia -26.386, 25.438, 13.759,
    15.400-. Se toma el mas grande, y el orden no sirve: en el correo del 02/09 la
    tabla era `image002` y no `image001`.
    """
    try:
        n = it.Attachments.Count
    except Exception:
        return None
    mejor, mejor_tam = None, 0
    for i in range(1, n + 1):
        try:
            a = it.Attachments.Item(i)
            nombre = str(a.FileName or '').lower()
            if not nombre.endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
                continue
            tam = int(a.Size or 0)
            if tam > mejor_tam:
                mejor, mejor_tam = a, tam
        except Exception:
            continue
    if mejor is None or mejor_tam < 8000:
        return None
    try:
        if not os.path.isdir(CARPETA_IMG):
            os.makedirs(CARPETA_IMG)
        destino = os.path.join(CARPETA_IMG, 'Citas %s.png' % fecha)
        mejor.SaveAsFile(destino)
        log('   imagen guardada: %s (%s bytes)' % (os.path.basename(destino),
                                                   format(mejor_tam, ',')))
        return destino
    except Exception as e:
        log('   no se pudo guardar la imagen: %s' % e, 'ERROR')
        return None


def limpio(t):
    """El texto de una celda, sin el espacio duro que mete Outlook."""
    return re.sub(r'\s+', ' ', str(t or '').replace('\xa0', ' ')).strip()


# Como se llama cada columna en el correo, y como la vamos a llamar nosotros.
# Se busca por TROZO y sin tildes: el encabezado cambia de mayusculas y de acentos
# segun quien arme el correo ese dia.
# HAY DOS COLUMNAS LLAMADAS "Observacion" Y NO SIGNIFICAN LO MISMO:
#   la PRIMERA, antes de la hora, dice QUE es -CALZADO, CAJAS, ETIQUETAS-
#   la SEGUNDA, despues de Und, es la nota suelta -"parcial", "urgente"-
# Guardarlas con el mismo nombre pisa una con la otra y se pierde el tipo, que es
# justo lo que separa el calzado de los materiales.
COLUMNAS = [
    ('hora',        ('hora de cita', 'hora cita')),
    ('proveedor',   ('proveedor',)),
    ('oc',          ('o/c', 'oc', 'orden de compra')),
    ('cantidad',    ('cant. por oc', 'cant por oc', 'cantidad')),
    ('unidad',      ('und', 'unidad')),
    ('inicio',      ('hora inicio',)),
    ('fin',         ('hora fin',)),
    ('rampa',       ('rampa',)),
    ('cuadrilla',   ('cuadrilla',)),
]


def mapear(cabecera):
    """De la fila de encabezado a {nuestro_nombre: indice}. None si no es una
    tabla de citas: sin O/C y sin cantidad, no hay nada que cruzar."""
    limp = [sin_tildes(limpio(c)) for c in cabecera]
    idx = {}
    for nuestro, trozos in COLUMNAS:
        for i, c in enumerate(limp):
            if any(t in c for t in trozos) and i not in idx.values():
                idx[nuestro] = i
                break
    if 'oc' not in idx or 'cantidad' not in idx:
        return None
    # Las dos "Observacion", por orden: la primera es el TIPO, la segunda la NOTA.
    obs = [i for i, c in enumerate(limp) if 'observacion' in c]
    if obs:
        idx['tipo'] = obs[0]
    if len(obs) > 1:
        idx['nota'] = obs[1]
    return idx


def numero(t):
    """'1,138' o '1.138' -> 1138. Vacio -> None, que NO es lo mismo que cero."""
    s = re.sub(r'[^\d,.\-]', '', limpio(t))
    if not s:
        return None
    # Se quitan los separadores de miles; el correo no trae decimales en cantidades.
    s = s.replace(',', '').replace('.', '')
    try:
        return int(s)
    except ValueError:
        return None


def normalizar_oc(t):
    """La O/C como la escribe el correo: 2026-09057. Devuelve tambien la forma
    pegada -202609057- que es como aparece adentro del numero de ASN."""
    m = OC.search(limpio(t))
    if not m:
        return '', ''
    return '%s-%s' % (m.group(1), m.group(2)), m.group(1) + m.group(2)


def leer_citas(html):
    """Todas las filas de cita del correo, vengan en una tabla o en dos.

    EL CORREO TRAE DOS TABLAS: citas de mercaderia y citas de materiales. Las dos
    se guardan, marcadas con `tabla`, porque las dos ocupan rampa y cuadrilla; el
    reporte despues decide cual mira.
    """
    p = Tablas()
    try:
        p.feed(html or '')
    except Exception as e:
        log('el cuerpo del correo no se pudo leer como HTML: %s' % e, 'WARN')
    filas = []
    for n, t in enumerate(p.tablas):
        idx = None
        for f in t:
            if idx is None:
                idx = mapear(f)
                continue
            if len(f) <= max(idx.values()):
                continue
            oc, pegada = normalizar_oc(f[idx['oc']])
            cant = numero(f[idx['cantidad']])
            if not oc and cant is None:
                continue                      # fila de totales o separador
            fila = {'tabla': n, 'oc': oc, 'ocPegada': pegada, 'cantidad': cant}
            for k, i in idx.items():
                if k not in ('oc', 'cantidad'):
                    fila[k] = limpio(f[i])
            filas.append(fila)
    return filas


def fecha_del_asunto(asunto, llegada):
    """El dia que programa el correo.

    SALE DEL ASUNTO Y NO DE CUANDO LLEGO. El correo se manda la tarde anterior:
    usar la fecha de llegada correría toda la programacion un dia."""
    m = FECHA_ASUNTO.search(asunto or '')
    if m:
        d, mes, a = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a < 100:
            a += 2000
        try:
            return datetime(a, mes, d).strftime('%Y-%m-%d')
        except ValueError:
            pass
    # Sin fecha en el asunto, el dia siguiente al de llegada: es lo que significa
    # una programacion mandada por la tarde.
    return (llegada + timedelta(days=1)).strftime('%Y-%m-%d')


# ══════════════════════════════════════════════════════════════════════════════
def ya_se_capturo_hoy():
    """Si el correo de hoy ya se capturo. Se guarda la FECHA DE CALENDARIO en que
    se capturo, no el dia que programa: la regla es "uno por dia y listo"."""
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            d = json.load(f)
        return d.get('capturadoEnLaFecha') == datetime.now().strftime('%Y-%m-%d'), d
    except Exception:
        return False, {}


def marcar_capturado(fecha_programada, total, citas):
    try:
        with io.open(ESTADO, 'w', encoding='utf-8') as f:
            json.dump({'capturadoEnLaFecha': datetime.now().strftime('%Y-%m-%d'),
                       'capturadoALas': datetime.now().strftime('%H:%M:%S'),
                       'programaElDia': fecha_programada,
                       'citas': citas,
                       'totalProgramado': total}, f, ensure_ascii=False, indent=1)
    except Exception as e:
        log('no se pudo dejar la marca del dia: %s' % e, 'WARN')


def leer_vistos():
    try:
        with io.open(VISTOS, encoding='utf-8') as f:
            return set(json.load(f))
    except Exception:
        return set()


def guardar_vistos(v):
    try:
        with io.open(VISTOS, 'w', encoding='utf-8') as f:
            json.dump(sorted(v)[-500:], f)
    except Exception as e:
        log('no se pudo guardar la lista de vistos: %s' % e, 'WARN')


def publicar(fecha, datos):
    # PELADO: el servidor lo envuelve solo. Envolverlo aca deja `data.data`.
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    pet = urllib.request.Request(API + AREA + '?date=' + fecha, data=cuerpo,
                                 method='POST',
                                 headers={'Content-Type': 'application/json'})
    if ROBOT_TOKEN:
        pet.add_header('X-Robot-Token', ROBOT_TOKEN)
    with urllib.request.urlopen(pet, timeout=90) as r:
        return r.status


def main():
    dias = int(arg('--dias', '3'))
    listar = '--listar' in sys.argv
    probar = '--probar' in sys.argv

    # SE SALE ANTES DE ABRIR OUTLOOK, que es lo que tarda. Si se comprobara despues,
    # el ahorro seria cero.
    hecho, marca = ya_se_capturo_hoy()
    if hecho and not (listar or probar or '--ver' in sys.argv or '--igual' in sys.argv):
        log('hoy ya se capturo a las %s (programa el %s, %s citas). No se abre Outlook.'
            % (marca.get('capturadoALas', '?'), marca.get('programaElDia', '?'),
               marca.get('citas', '?')))
        return 0

    log('=' * 62)
    log('CORREO DE PROGRAMACION DE RECEPCION  ·  %s'
        % datetime.now().strftime('%d-%m-%Y %H:%M'))
    log('=' * 62)
    log('busca por asunto "%s"; el remitente va vacio a proposito' % ASUNTO)

    vistos = leer_vistos()
    encontrados = 0
    publicados = 0

    for bandeja, it in correos(dias, diag=True):
        try:
            asunto = str(it.Subject or '')
            llegada = it.ReceivedTime.replace(tzinfo=None)
        except Exception:
            continue

        if listar:
            # Sin filtro: se muestran todos para poder ver como llega el asunto.
            try:
                de = str(it.SenderName or '')
            except Exception:
                de = '?'
            log('   %s  %-32s  %s' % (llegada.strftime('%d/%m %H:%M'), de[:32], asunto[:70]))
            continue

        if ASUNTO not in sin_tildes(asunto):
            continue
        encontrados += 1

        try:
            id_correo = str(it.EntryID)
        except Exception:
            id_correo = asunto + llegada.isoformat()
        if id_correo in vistos and not probar:
            log('ya estaba procesado: %s' % asunto[:60])
            continue

        fecha = fecha_del_asunto(asunto, llegada)
        try:
            html = str(it.HTMLBody or '')
        except Exception:
            html = ''

        if '--ver' in sys.argv:
            log('')
            log('CORREO: %s' % asunto[:80])
            log('   llego el %s · programa el %s' % (llegada.strftime('%d/%m %H:%M'), fecha))
            try:
                n_adj = it.Attachments.Count
            except Exception:
                n_adj = 0
            log('   adjuntos: %d' % n_adj)
            for i in range(1, n_adj + 1):
                try:
                    a = it.Attachments.Item(i)
                    log('      %-46s %s bytes' % (str(a.FileName)[:46], format(int(a.Size or 0), ',')))
                except Exception as e:
                    log('      (no se pudo leer el adjunto %d: %s)' % (i, e))
            pp = Tablas()
            try:
                pp.feed(html)
            except Exception:
                pass
            log('   cuerpo HTML: %s caracteres · %d tabla(s)' % (format(len(html), ','), len(pp.tablas)))
            for k, t in enumerate(pp.tablas[:6]):
                cab = ' | '.join(limpio(c)[:16] for c in (t[0] if t else []))[:150]
                log('      tabla %d: %d filas · primera fila: %s' % (k, len(t), cab))
            try:
                cuerpo = str(it.Body or '')
            except Exception:
                cuerpo = ''
            log('   texto plano, primeros 400: %s' % re.sub(r'\s+', ' ', cuerpo)[:400])
            guardar_imagen(it, fecha)
            continue

        filas = leer_citas(html)

        log('')
        log('CORREO: %s' % asunto[:80])
        log('   llego el %s · programa el dia %s · %d citas'
            % (llegada.strftime('%d/%m %H:%M'), fecha, len(filas)))
        if not filas:
            log('   NO SE ENCONTRO NINGUNA TABLA DE CITAS en el cuerpo. El correo se '
                'deja SIN MARCAR para volver a intentarlo.', 'ERROR')
            continue

        total = sum(f['cantidad'] or 0 for f in filas)
        for f in filas[:20]:
            log('     %-6s %-10s %-28s %8s %s'
                % (f.get('hora', ''), f.get('oc', ''), (f.get('proveedor') or '')[:28],
                   format(f['cantidad'], ',') if f['cantidad'] is not None else '-',
                   f.get('observacion', '')[:22]))
        if len(filas) > 20:
            log('     ... y %d citas mas' % (len(filas) - 20))
        log('   TOTAL PROGRAMADO: %s unidades en %d citas' % (format(total, ','), len(filas)))

        if probar:
            log('   --probar: no se publica nada')
            continue

        datos = {
            'fecha': fecha,
            'asunto': asunto,
            'llegoEl': llegada.strftime('%Y-%m-%d %H:%M:%S'),
            'capturadoEl': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'citas': filas,
            'totalProgramado': total,
        }
        try:
            estado = publicar(fecha, datos)
            log('   publicado en %s del %s (%s)' % (AREA, fecha, estado))
            publicados += 1
            vistos.add(id_correo)
            # SOLO SE MARCA EL DIA CUANDO ALGO SE PUBLICO DE VERDAD. Marcar al
            # encontrar el correo dejaria el dia cerrado con las manos vacias.
            marcar_capturado(fecha, total, len(filas))
            guardar_vistos(vistos)
            log('   marcado: hoy ya no se vuelve a abrir Outlook')
            return 0
        except Exception as e:
            log('   NO SE PUDO PUBLICAR: %s' % e, 'ERROR')

    if listar:
        log('')
        log('--listar: no se guardo nada. Con esto se ve como llega el asunto.')
        return 0

    guardar_vistos(vistos)
    log('')
    if not encontrados:
        log('ningun correo con ese asunto en los ultimos %d dias' % dias, 'WARN')
        return 1
    log('%d correo(s) con ese asunto, %d publicado(s)' % (encontrados, publicados))
    return 0 if publicados or probar else 1


if __name__ == '__main__':
    sys.exit(main())
