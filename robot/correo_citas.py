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
import subprocess
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


def _uno_por_uno(coleccion):
    """Recorre una coleccion de Outlook con GetFirst/GetNext.

    Es como Outlook quiere que se recorra. El `for` de Python le pide un
    enumerador, y sobre una coleccion ORDENADA Y FILTRADA a la vez ese enumerador
    es donde se traba: el 03-sep-2026 el robot quedo ocho minutos sin avanzar del
    primer correo. Si el metodo no existe -no todas las colecciones lo tienen- se
    cae al recorrido normal.
    """
    try:
        it = coleccion.GetFirst()
    except Exception:
        for x in coleccion:
            yield x
        return
    while it is not None:
        yield it
        try:
            it = coleccion.GetNext()
        except Exception:
            return


def _por_asunto(items, diag):
    """Los correos cuyo asunto contiene lo que se busca, PREGUNTANDOSELO A OUTLOOK.

    Es una consulta @SQL sobre el buzon: devuelve cuatro correos en vez de ciento
    nueve y el robot no toca los demas. Mirar el asunto de cada correo desde
    Python es una llamada COM por correo, y con ciento nueve se cuelga.
    """
    consulta = ("@SQL=\"urn:schemas:httpmail:subject\" LIKE '%" +
                ASUNTO.upper().replace("'", "") + "%'")
    try:
        sel = items.Restrict(consulta)
        n = sel.Count
    except Exception as e:
        if diag:
            log("      la busqueda por asunto no anduvo (%s); se busca por fecha"
                % type(e).__name__, "WARN")
        return None
    if not n:
        if diag:
            log("      la busqueda por asunto devolvio cero; se busca por fecha", "WARN")
        return None
    if diag:
        log("      buscando por asunto: %d correo(s)" % n)
    # DEL MAS NUEVO AL MAS VIEJO. Buscar por asunto no filtra por fecha y devuelve
    # todo el historial; sin ordenar, el primero que sale es de hace meses.
    try:
        sel.Sort("[ReceivedTime]", True)
    except Exception:
        pass
    return sel


def correos(dias, diag=False):
    """Los correos que interesan, de todas las bandejas.

    TRES CAMINOS, EN ORDEN, y el primero que devuelva algo gana:
      1. que Outlook busque por ASUNTO -cuatro correos en vez de ciento nueve-
      2. que Outlook filtre por FECHA
      3. recorrerlos a mano de mas nuevo a mas viejo

    EL FILTRO DE OUTLOOK ES QUISQUILLOSO: con un formato que no le gusta devuelve
    CERO EN SILENCIO, sin quejarse. Por eso hay tres caminos y ninguno es de fiar
    por si solo. Le costo dos dias a correo_guias.py.
    """
    mapi = outlook()
    desde = datetime.now() - timedelta(days=dias)
    for nombre, bandeja in bandejas(mapi):
        items = bandeja.Items
        try:
            items.Sort("[ReceivedTime]", True)
        except Exception:
            pass
        try:
            total = items.Count
        except Exception:
            total = 0
        if diag:
            log("   bandeja \"%s\": %s correos" % (nombre, format(total, ",d")))
        if not total:
            continue

        sel = _por_asunto(items, diag)
        if sel is None:
            try:
                sel = items.Restrict("[ReceivedTime] >= '%s'" % desde.strftime("%m/%d/%Y"))
                if not sel.Count:
                    sel = None
                elif diag:
                    log("      por fecha, ultimos %d dias: %s" % (dias, format(sel.Count, ",d")))
            except Exception:
                sel = None

        # EL TOPE NO ES ADORNO. Si los dos filtros fallan se recorre a mano, y sin
        # tope eso es tocar el buzon entero por COM: es lo que colgo al robot ocho
        # minutos el 03-sep-2026.
        fuente = sel if sel is not None else items
        if sel is None and diag:
            log("      ningun filtro sirvio; se recorren los mas nuevos a mano", "WARN")
        mirados = 0
        for it in _uno_por_uno(fuente):
            mirados += 1
            if mirados > 300:
                log("      se llego al tope de 300 correos mirados", "WARN")
                break
            # SE ANOTA ANTES DE TOCARLE NADA. Con pocos correos un aviso cada
            # cincuenta no salta nunca, y un cuelgue en el primero parece silencio.
            if diag:
                log("      correo %d de la lista" % mirados)
            try:
                # 43 = correo. Una convocatoria de reunion o un aviso de entrega no
                # tienen las propiedades que se leen despues y pueden trabar la
                # llamada COM.
                if int(it.Class) != 43:
                    continue
            except Exception:
                continue
            # SE CORTA AL PASARSE DE FECHA, venga de donde venga la lista. Vienen
            # del mas nuevo al mas viejo, asi que el primero viejo termina el
            # recorrido. Sin esto, buscar por asunto trae el historial entero y
            # serian dieciseis lecturas de imagen en cada pase.
            try:
                if it.ReceivedTime.replace(tzinfo=None) < desde:
                    if diag:
                        log("      el resto ya es de antes del corte; se para aca")
                    break
            except Exception:
                continue
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


# ══════════════════════════════════════════════════════════════════════════════
#  DE LA IMAGEN A LAS CITAS
# ══════════════════════════════════════════════════════════════════════════════
PS51 = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32",
                    "WindowsPowerShell", "v1.0", "powershell.exe")

RE_OC = re.compile(r"(\d{4})\s*[-]\s*(\d{4,6})")
# La forma COMPLETA: cuatro digitos, guion y CINCO. Sirve para descartar una
# lectura a la que el motor le comio un digito -"2026-0905"- sin tener que
# saber cual de las tres formas de leer anda mejor ese dia.
RE_OC_COMPLETA = re.compile(r"\d{4}\s*[-]\s*\d{5}(?!\d)")
RE_HORA = re.compile(r"(\d{1,2})\s*[:.\"]\s*(\d{2})\s*([AP])\.?\s*M", re.I)


def leer_la_imagen(ruta):
    """Llama al lector y devuelve lo que vio, o None.

    VA CON WINDOWS POWERSHELL 5.1, no con pwsh 7: el puente a WinRT que necesita
    el OCR no existe en .NET Core y falla con "Operation is not supported on this
    platform". Con la ruta completa no depende de cual este primero en el PATH.
    """
    if not os.path.isfile(LECTOR):
        log("no encuentro el lector de imagenes: %s" % LECTOR, "ERROR")
        return None
    try:
        r = subprocess.run([PS51, "-NoProfile", "-ExecutionPolicy", "Bypass",
                            "-File", LECTOR, "-Ruta", ruta, "-PorCeldas"],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=600)
    except subprocess.TimeoutExpired:
        log("el lector de imagenes se paso de 10 minutos", "ERROR")
        return None
    salida = (r.stdout or "").strip()
    if not salida:
        log("el lector no devolvio nada: %s" % (r.stderr or "")[:200], "ERROR")
        return None
    try:
        # strict=False aguanta un caracter de control suelto adentro de un texto.
        # El lector ya los aplana, pero si uno se escapa es peor perder la
        # captura entera que aceptarlo.
        d = json.loads(salida.splitlines()[-1], strict=False)
    except Exception as e:
        log("no se entendio lo que devolvio el lector (%s): %s" % (e, salida[:200]), "ERROR")
        return None
    if d.get("error"):
        log("el lector fallo: %s" % d["error"], "ERROR")
        return None
    return d


def _dos_lecturas(celda_x0, celda_x1, ya, yb, columnas, sueltas):
    """Lo que dijo CADA forma de leer esa celda: (por celda, por tabla entera).

    Las dos hacen falta y ninguna manda siempre. El motor descarta un numero de
    tres cifras cuando esta solo en su recuadro -134, 560, 762, 840- y lo lee sin
    dudar cuando viene pegado a su orden de compra; al reves, el total de la
    ultima fila solo sale leyendo esa celda sola.

    Devolver las dos deja comparar: si dicen lo mismo, es seguro; si difieren, hay
    que elegir con una regla y dejar constancia.
    """
    porCelda = ""
    for c in columnas:
        if c["x0"] != celda_x0:
            continue
        for t in c.get("trozos") or []:
            if t["y0"] <= ya and t["y1"] >= yb - 1 and (t.get("t") or "").strip():
                porCelda = t["t"].strip()
    dentro = []
    for p in sueltas:
        cx = p["x"] + p["w"] / 2.0
        cy = p["y"] + p["h"] / 2.0
        if celda_x0 <= cx < celda_x1 and ya <= cy < yb:
            dentro.append((p["x"], p["t"]))
    return porCelda, " ".join(t for _, t in sorted(dentro)).strip()


def _de_la_tira(columnas, x0, ya, yb):
    """Lo que dijo la tira de esa columna para esa franja de altura."""
    for c in columnas:
        if c["x0"] != x0:
            continue
        partes = []
        for w in c.get("tira") or []:
            centro = w["y"] + w.get("h", 0) / 2.0
            if ya <= centro < yb:
                partes.append(w["t"])
        return " ".join(partes).strip()
    return ""


def _valor(celda_x0, celda_x1, ya, yb, columnas, sueltas):
    a, b = _dos_lecturas(celda_x0, celda_x1, ya, yb, columnas, sueltas)
    return a or b


def _num(t):
    """'1,138' -> 1138. Vacio o ilegible -> None, que NO es cero."""
    s = re.sub(r"[^\d]", "", str(t or ""))
    return int(s) if s else None


def citas_de_la_imagen(ruta):
    """Las filas de cita que trae la captura.

    LAS COLUMNAS SE RECONOCEN POR LO QUE TIENEN, no por su posicion: el encabezado
    es azul con letra blanca y al pasar a blanco y negro se pierde entero. La
    columna de las ordenes es la que trae AAAA-NNNNN, la de la hora la que trae
    HH:MM AM, y las cantidades son las dos columnas numericas que siguen a la de
    las ordenes.
    """
    d = leer_la_imagen(ruta)
    if not d:
        return [], {}
    ver = d.get("ver") or []
    sueltas = d.get("sueltas") or []
    columnas = []
    for t in d.get("tablas") or []:
        columnas.extend(t.get("columnas") or [])
    if len(ver) < 4 or not columnas:
        log("la imagen no parece una tabla (%d rayas verticales)" % len(ver), "ERROR")
        return [], {}

    # Todas las alturas donde alguna columna corta, ordenadas: son las filas
    # posibles. La columna de las ordenes es la que mas cortes tiene, porque es la
    # unica que se subdivide.
    alturas = set()
    for c in columnas:
        for y in c.get("limites") or []:
            alturas.add(int(y))
    alturas = sorted(alturas)

    # Que columna es cada una
    idx_oc = idx_hora = None
    puntajes = {}
    for k, c in enumerate(columnas):
        texto = " ".join((t.get("t") or "") for t in (c.get("trozos") or []))
        for p in sueltas:
            if c["x0"] <= p["x"] + p["w"] / 2.0 < c["x1"]:
                texto += " " + p["t"]
        puntajes[k] = (len(RE_OC.findall(texto)), len(RE_HORA.findall(texto)))
    if puntajes:
        idx_oc = max(puntajes, key=lambda k: puntajes[k][0])
        if puntajes[idx_oc][0] == 0:
            idx_oc = None
        idx_hora = max(puntajes, key=lambda k: puntajes[k][1])
        if puntajes[idx_hora][1] == 0:
            idx_hora = None
    if idx_oc is None:
        log("no se encontro la columna de las ordenes de compra", "ERROR")
        return [], {}

    col_tipo  = columnas[0] if columnas else None
    col_hora  = columnas[idx_hora] if idx_hora is not None else None
    col_prov  = columnas[idx_oc - 1] if idx_oc >= 1 else None
    col_oc    = columnas[idx_oc]
    col_cant  = columnas[idx_oc + 1] if idx_oc + 1 < len(columnas) else None
    col_und   = columnas[idx_oc + 2] if idx_oc + 2 < len(columnas) else None
    col_obs   = columnas[idx_oc + 3] if idx_oc + 3 < len(columnas) else None

    def leer(col, ya, yb):
        if not col:
            return ""
        return (_valor(col["x0"], col["x1"], ya, yb, columnas, sueltas)
                or _de_la_tira(columnas, col["x0"], ya, yb))

    filas = []
    for i in range(1, len(alturas)):
        ya, yb = alturas[i - 1], alturas[i]
        if yb - ya < 7:
            continue
        # LA ORDEN DE COMPRA SE ELIGE POR SU FORMA, no por que lectura llego
        # primero. Son cuatro digitos, guion y CINCO digitos. Leyendo la celda
        # sola salio "2026-0905" -se comio el ultimo- y leyendo la tabla entera
        # salio completa: con la forma se descarta la mala sin tener que saber
        # cual de las dos anda mejor ese dia.
        a, b = _dos_lecturas(col_oc["x0"], col_oc["x1"], ya, yb, columnas, sueltas)
        c3 = _de_la_tira(columnas, col_oc["x0"], ya, yb)
        # LA TIRA PRIMERO: medido sobre la captura real saca 7 de 7 ordenes, contra
        # 5 de 7 leyendo celda por celda y 6 de 7 leyendo la tabla entera.
        buenos = [x for x in (c3, b, a) if RE_OC_COMPLETA.search(x or "")]
        dudoso = len(buenos) == 2 and RE_OC.search(buenos[0]).group(0).replace(" ", "") != RE_OC.search(buenos[1]).group(0).replace(" ", "")
        bruto = buenos[0] if buenos else (a or b)
        m = RE_OC.search(bruto)
        tipo = leer(col_tipo, ya, yb)
        if not m:
            # Una fila sin orden de compra igual puede ser una cita: las de CAJAS y
            # ETIQUETAS no la traen, y su codigo va en Observacion.
            if not tipo or tipo.upper().startswith("TOTAL"):
                continue
            oc, pegada = "", ""
        else:
            oc, pegada = "%s-%s" % (m.group(1), m.group(2)), m.group(1) + m.group(2)
        hm = RE_HORA.search(leer(col_hora, ya, yb) or "")
        filas.append({
            "y0": ya, "y1": yb,
            "tipo": tipo,
            "hora": ("%02d:%s %sM" % (int(hm.group(1)), hm.group(2), hm.group(3).upper())) if hm else "",
            "proveedor": leer(col_prov, ya, yb),
            "oc": oc, "ocPegada": pegada,
            "cantidad": _num(leer(col_cant, ya, yb)),
            "und": _num(leer(col_und, ya, yb)),
            "nota": leer(col_obs, ya, yb),
            "dudoso": bool(dudoso),
        })

    # El TOTAL, para poder comprobar
    total = None
    for i in range(1, len(alturas)):
        ya, yb = alturas[i - 1], alturas[i]
        if (leer(col_tipo, ya, yb) or "").upper().startswith("TOTAL"):
            total = _num(leer(col_und, ya, yb))
    avisos = cuadrar(filas, total)
    return filas, {"total": total, "celdas": d.get("celdasLeidas"),
                   "palabras": len(sueltas), "avisos": avisos,
                   "cuadra": not avisos}


def cuadrar(filas, total):
    """Comprueba la tabla contra sus totales y rellena lo que se pueda.

    DOS CUENTAS, las mismas que hace Daniel:
      1. Las filas que comparten el mismo UND son una sola cita con varias
         ordenes: sus cantidades tienen que sumar ese UND.
      2. Los UND distintos tienen que sumar el TOTAL de la ultima fila.

    Si a una cuenta le falta UN solo valor, se despeja y se marca como deducido
    -no leido-. Si faltan dos o mas, no se inventa: se avisa.
    """
    avisos = []

    # ── 1. cada grupo contra su UND ────────────────────────────────────────
    grupos = {}
    for f in filas:
        if f.get("und"):
            grupos.setdefault(f["und"], []).append(f)
    for und, gs in grupos.items():
        faltan = [f for f in gs if f.get("cantidad") is None]
        suma = sum(f["cantidad"] for f in gs if f.get("cantidad") is not None)
        if len(gs) == 1 and faltan:
            # Una sola orden en la cita: su cantidad ES el UND.
            faltan[0]["cantidad"] = und
            faltan[0]["deducido"] = True
        elif len(faltan) == 1 and suma < und:
            faltan[0]["cantidad"] = und - suma
            faltan[0]["deducido"] = True
        elif not faltan and suma != und:
            avisos.append("las %d ordenes de %s suman %s y la fila dice %s"
                          % (len(gs), gs[0].get("proveedor") or "?",
                             format(suma, ","), format(und, ",")))
        elif len(faltan) > 1:
            avisos.append("a la cita de %s le faltan %d cantidades y no se pueden "
                          "despejar de una sola cuenta"
                          % (gs[0].get("proveedor") or "?", len(faltan)))

    # ── 2. los UND contra el TOTAL ─────────────────────────────────────────
    if total:
        # SOLO EL CALZADO. En la captura real el TOTAL dice 4.011 y es
        # 2.799 + 840 + 372: las filas de CAJAS y de ETIQUETAS no traen cantidad
        # -su codigo va en Observacion- y meterlas en la cuenta haria que nunca
        # cuadre.
        vistos = {}
        for f in filas:
            if "CALZ" not in (f.get("tipo") or "").upper():
                continue
            clave = (f.get("proveedor") or "") + "|" + (f.get("hora") or "")
            if f.get("und"):
                vistos[clave] = f["und"]
            elif clave not in vistos:
                vistos[clave] = None
        sinUnd = [k for k, v in vistos.items() if v is None]
        suma = sum(v for v in vistos.values() if v)
        if len(sinUnd) == 1 and suma < total:
            falta = total - suma
            for f in filas:
                clave = (f.get("proveedor") or "") + "|" + (f.get("hora") or "")
                if "CALZ" in (f.get("tipo") or "").upper() and clave == sinUnd[0]:
                    f["und"] = falta
                    if f.get("cantidad") is None:
                        f["cantidad"] = falta
                    f["deducido"] = True
        elif not sinUnd and suma != total:
            avisos.append("las citas suman %s y el TOTAL de la tabla dice %s"
                          % (format(suma, ","), format(total, ",")))
        elif len(sinUnd) > 1:
            avisos.append("%d citas quedaron sin cantidad y el TOTAL solo permite "
                          "despejar una" % len(sinUnd))

    for f in filas:
        if f.get("dudoso"):
            avisos.append("la orden %s se leyo distinto de las dos formas" % f.get("oc"))
    return avisos


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
        log('')
        log('CORREO: %s' % asunto[:80])
        log('   llego el %s · programa el dia %s'
            % (llegada.strftime('%d/%m %H:%M'), fecha))

        # EL CUERPO SE PIDE SOLO SI HACE FALTA, y casi nunca hace falta.
        #
        # `it.HTMLBody` de un correo que no esta en el cache local hace que Outlook
        # se lo vaya a buscar al servidor, y esa llamada puede quedarse esperando
        # para siempre: es lo que colgo al robot en el primer correo de la lista.
        # La tabla viene como imagen adjunta y los adjuntos SI estan cacheados.
        html = ''
        if '--ver' in sys.argv or '--cuerpo' in sys.argv:
            try:
                html = str(it.HTMLBody or '')
            except Exception as e:
                log('   no se pudo leer el cuerpo (%s); se sigue con la imagen'
                    % type(e).__name__, 'WARN')

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

        # LA TABLA VIENE COMO IMAGEN. Comprobado sobre los cuatro correos del
        # buzon el 03-sep-2026: cero tablas en el HTML del cuerpo, que solo trae
        # el saludo. Se intenta igual por si algun dia la mandan como tabla de
        # verdad -seria mejor- y si no, se lee la captura.
        filas = leer_citas(html) if html else []
        meta = {}
        if filas:
            log('   la tabla vino en el cuerpo del correo: %d citas' % len(filas))
        else:
            ruta = guardar_imagen(it, fecha)
            if not ruta:
                log('   NO HAY NI TABLA NI IMAGEN en este correo. Se deja SIN MARCAR '
                    'para volver a intentarlo.', 'ERROR')
                continue
            filas, meta = citas_de_la_imagen(ruta)
            if not filas:
                log('   NO SE PUDO LEER LA IMAGEN. Queda guardada en %s para mirarla '
                    'a mano; el correo se deja SIN MARCAR.' % os.path.basename(ruta), 'ERROR')
                continue

        total = sum(f['cantidad'] or 0 for f in filas
                    if 'CALZ' in (f.get('tipo') or '').upper()) or                 sum(f['cantidad'] or 0 for f in filas)
        for f in filas[:25]:
            log('     %-10s %-9s %-13s %-26s %8s %s'
                % ((f.get('tipo') or '')[:10], f.get('hora', ''), f.get('oc', ''),
                   (f.get('proveedor') or '')[:26],
                   format(f['cantidad'], ',') if f.get('cantidad') is not None else '-',
                   '(deducido)' if f.get('deducido') else ''))
        if len(filas) > 25:
            log('     ... y %d citas mas' % (len(filas) - 25))
        log('   TOTAL PROGRAMADO: %s pares en %d citas' % (format(total, ','), len(filas)))

        # EL CUADRO TIENE QUE CUADRAR, y si no, se dice. Daniel suma las filas con
        # la calculadora: publicar un numero que no cierra lo manda a perseguir un
        # descuadre que no existe.
        if meta.get('total'):
            if meta.get('cuadra'):
                log('   CUADRA: las citas suman %s y la tabla dice %s'
                    % (format(total, ','), format(meta['total'], ',')))
            else:
                for av in meta.get('avisos') or []:
                    log('   NO CUADRA: %s' % av, 'ERROR')

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
            'totalDeLaTabla': meta.get('total'),
            'cuadra': meta.get('cuadra'),
            'avisos': meta.get('avisos') or [],
            'imagen': 'Citas %s.png' % fecha,
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
