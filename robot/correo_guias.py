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

LA FECHA SALE DEL CORREO, no del nombre del adjunto. El correo llega entre las
19:00 y las 20:00 con las guías de ese mismo día, así que el archivo se guarda
como `Guías DD.MM.xlsx` con la fecha en que llegó el correo.

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
import sys
import zipfile
from datetime import datetime, timedelta
import unicodedata
import xml.etree.ElementTree as ET


def sin_tildes(t):
    """Para comparar textos que a veces vienen con tilde y a veces no.

    El asunto llega como "Guías de Prescripciones" pero nadie lo escribe siempre
    igual, y un filtro que falla por una tilde deja el correo sin bajar sin que
    nadie se entere."""
    t = unicodedata.normalize('NFD', str(t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')

# ── Qué correo es el bueno ───────────────────────────────────────────────────
# Se llenan con lo que devuelva `--listar`. Van en minúsculas y basta con que el
# texto esté CONTENIDO: "comercial" alcanza para "Comercial Bata <...>".
# El asunto lo dijo Daniel el 20-ago: "Guias de Prescripciones". Se compara SIN
# TILDES y en minusculas, asi que da igual como venga escrito: "Guías de
# Prescripciones", "GUIAS DE PRESCRIPCIONES" o con la tilde puesta o no.
REMITENTE = ''                          # vacio = no se mira quien lo manda
ASUNTO = 'guias de prescripciones'

DESTINO = r'C:\Users\dames\OneDrive\danielames.bata\scraping Stock\Correos Picking'
AQUI = os.path.dirname(os.path.abspath(__file__))
VISTOS = os.path.join(AQUI, 'correo_guias_vistos.json')
LOG = os.path.join(AQUI, 'logs', 'correo_guias.log')

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DIAS_ATRAS = 3
MINIMO_FILAS = 20       # un correo de guías nunca trae cuatro filas


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
    """¿Este .xlsx es de verdad un correo de guías?

    Abre el archivo en memoria y busca una hoja cuya cabecera tenga la columna
    GUIA. Se miran TODAS las hojas porque la buena no siempre es la primera:
    `Guías 07.07.xlsx` trae Hoja2 adelante con 51 filas y los datos detrás.
    """
    try:
        z = zipfile.ZipFile(io.BytesIO(datos))
    except Exception:
        return False, 'no se pudo abrir como Excel'
    sh = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            sh.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    for hoja in sorted(n for n in z.namelist() if n.startswith('xl/worksheets/sheet')):
        filas = list(ET.fromstring(z.read(hoja)).iter(NS + 'row'))
        if not filas:
            continue
        cab = []
        for c in filas[0].iter(NS + 'c'):
            v = c.find(NS + 'v')
            val = v.text if v is not None else ''
            if c.get('t') == 's' and val:
                val = sh[int(val)]
            cab.append(str(val or '').strip().lower())
        if any('guia' in x or 'guía' in x for x in cab):
            if len(filas) - 1 < MINIMO_FILAS:
                return False, 'tiene columna GUIA pero solo %d filas' % (len(filas) - 1)
            return True, '%d filas' % (len(filas) - 1)
    return False, 'ninguna hoja tiene columna GUIA'


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


def correos(dias):
    """Los correos de la Bandeja de entrada de los ultimos N dias, con adjuntos."""
    mapi = outlook()
    bandeja = mapi.GetDefaultFolder(6)          # 6 = olFolderInbox
    items = bandeja.Items
    items.Sort('[ReceivedTime]', True)
    desde = datetime.now() - timedelta(days=dias)
    # El filtro va del lado de Outlook: recorrer miles de correos en Python es
    # lentisimo porque cada propiedad cruza el puente COM.
    try:
        items = items.Restrict("[ReceivedTime] >= '%s'"
                               % desde.strftime('%m/%d/%Y %H:%M %p'))
    except Exception:
        pass
    for it in items:
        try:
            if it.Class != 43:                  # 43 = MailItem
                continue
            if it.Attachments.Count == 0:
                continue
            yield it
        except Exception:
            continue


def main():
    dias = int(arg('--dias', DIAS_ATRAS))
    listar = '--listar' in sys.argv
    probar = '--probar' in sys.argv

    log('=' * 58)
    log('CORREO DE GUIAS · mirando %d dias hacia atras' % dias)
    log('=' * 58)

    if listar:
        log('MODO LISTAR: no se guarda nada. Elegi de aca el remitente y el')
        log('asunto, y ponelos arriba del script en REMITENTE y ASUNTO.')
        log('')
        n = 0
        for it in correos(dias):
            adj = [a.FileName for a in it.Attachments
                   if str(a.FileName).lower().endswith(('.xlsx', '.xls'))]
            if not adj:
                continue
            n += 1
            log('%-16s | %-38s | %s'
                % (it.ReceivedTime.strftime('%d-%m %H:%M'),
                   str(it.SenderName)[:38], str(it.Subject)[:60]))
            log('%16s   adjuntos: %s' % ('', ', '.join(adj)))
        log('')
        log('%d correos con Excel en %d dias' % (n, dias))
        return 0

    if not REMITENTE and not ASUNTO:
        log('REMITENTE y ASUNTO estan vacios: no se guarda nada.', 'ERROR')
        log('Corre primero:  python correo_guias.py --listar', 'ERROR')
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
        de = sin_tildes(str(it.SenderName or '') + ' ' +
                        str(getattr(it, 'SenderEmailAddress', '') or ''))
        asunto = sin_tildes(it.Subject)
        if REMITENTE and sin_tildes(REMITENTE) not in de:
            continue
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
            nombre = 'Guías %02d.%02d.xlsx' % (dia_, mes_)
            ruta = os.path.join(DESTINO, nombre)
            tmp = os.path.join(os.environ.get('TEMP', AQUI), '_guias_tmp.xlsx')
            a.SaveAsFile(tmp)
            datos = io.open(tmp, 'rb').read()
            os.remove(tmp)

            ok, detalle = tiene_guias(datos)
            if not ok:
                log('   %s de "%s": NO es un correo de guias (%s)'
                    % (a.FileName, str(it.Subject)[:40], detalle), 'WARN')
                saltados += 1
                continue

            if os.path.exists(ruta) and not probar:
                log('   %s ya existe, no se pisa' % nombre, 'WARN')
                saltados += 1
                continue
            if probar:
                log('   (prueba) guardaria %s  ·  %s' % (nombre, detalle))
            else:
                io.open(ruta, 'wb').write(datos)
                log('   guardado %s  ·  %s' % (nombre, detalle))
            guardados += 1
            vistos[eid] = {'fecha': it.ReceivedTime.strftime('%Y-%m-%d %H:%M'),
                           'asunto': str(it.Subject)[:80], 'archivo': nombre}

    if not probar:
        json.dump(vistos, io.open(VISTOS, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
    log('')
    log('LISTO · %d guardados · %d salteados' % (guardados, saltados))
    return 0


if __name__ == '__main__':
    sys.exit(main())
