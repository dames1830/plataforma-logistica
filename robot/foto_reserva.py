# -*- coding: utf-8 -*-
"""GUARDA LA FOTO DEL DIA DE LA RESERVA, sin que nadie tenga que abrir la pantalla.

Lo pidio Daniel el 22-ago-2026. Hasta hoy la foto de cada dia se guardaba **cuando
alguien entraba a Analisis SKU -> Analisis Reserva**: el navegador calculaba y la
subia. Consecuencia: un dia que nadie abriera esa pantalla quedaba como un agujero
en el calendario, y no se recuperaba nunca, porque el stock de ese dia ya lo habia
pisado el del dia siguiente. *"Que el robot guarde la foto al terminar el ancla. Se
tiene que guardar eso."*

EL ROBOT NO RECALCULA NADA: CORRE EL CODIGO DE LA PLATAFORMA.

Abre `deam1830.com` en un navegador sin ventana, importa
`js/reportes/reserva_consolidacion.js` -el MISMO archivo que usa la pantalla- y le
pasa los datos. Reescribir estas reglas en Python seria tener dos verdades, y el dia
que una cambie la otra queda mintiendo. Es el mismo camino que ya usa
`picking_por_hora.py` con `picking.js`.

    python foto_reserva.py            calcula y guarda si falta
    python foto_reserva.py --probar   calcula y muestra, sin guardar nada
    python foto_reserva.py --ver      con la ventana del navegador a la vista
    python foto_reserva.py --sitio http://127.0.0.1:5599/    contra el de pruebas

EL `--sitio` NO ES UN ADORNO: mientras un cambio esta solo en beta, produccion todavia
no tiene el archivo y el robot bajaria un 404 con cara de modulo. Con eso se prueba
contra el sitio local ANTES de publicar. Los DATOS salen igual del servidor de verdad.

CUANDO CORRE. Al final del ancla de la noche, encadenado desde `generar_slotting.py`,
que es donde ya se disparan Evolucion y Rotacion. Tiene que ser DESPUES de que el
stock de reserva quede publicado: si corriera antes, guardaria la foto de anoche con
la fecha de hoy — el defecto de [[stock-viejo-publicado-como-nuevo]] por otro camino.
Por eso comprueba el sello antes de escribir.

NO PISA UNA FOTO QUE YA ESTE. Si el dia ya tiene la suya —porque alguien abrio la
pantalla antes— no hace nada y lo dice. Una sola foto por dia, la del ancla.
"""

import io
import json
import os
import sys
import time
import traceback
import urllib.request
from datetime import datetime

SITIO = 'https://deam1830.com/'
MODULO = 'https://deam1830.com/js/reportes/reserva_consolidacion.js'
API = 'https://logistics-backend-wv0x.onrender.com/api/logistics'

AREA_RESERVA = 'analisis_sku_reserva'
AREA_MAESTRO = 'articulos'
AREA_CONFIG = 'config'
AREA_FOTOS = 'reserva_fotos'

# Cuanto tiene que traer cada cosa para darla por buena. Una reserva de 200 filas o un
# Maestro de 500 no son un dia flojo: son un archivo a medio publicar, y con eso la foto
# saldria mintiendo para siempre.
MINIMO_RESERVA = 500
MINIMO_MAESTRO = 5000
# Tres meses de colchon, igual que la pantalla: a ~36 KB por dia son unos 3 MB.
DIAS_GUARDADOS = 92

AQUI = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(AQUI, 'logs', 'foto_reserva.log')


def log(t, nivel='INFO'):
    linea = '[%s] [%-5s] %s' % (datetime.now().strftime('%H:%M:%S'), nivel, t)
    try:
        print(linea)
    except UnicodeEncodeError:
        print(linea.encode('ascii', 'replace').decode('ascii'))
    try:
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with io.open(LOG, 'a', encoding='utf-8') as fh:
            fh.write(linea + '\n')
    except Exception:
        pass


def traer(area, date=None, timeout=180):
    """Un area del servidor. Render puede estar dormido y tardar en despertar."""
    url = '%s/%s%s%st=%d' % (API, area, ('?date=' + date) if date else '?',
                             '&' if date else '', int(time.time()))
    p = urllib.request.Request(url, headers={'User-Agent': 'robot-foto-reserva'})
    with urllib.request.urlopen(p, timeout=timeout) as r:
        j = json.loads(r.read().decode('utf-8'))
    return j.get('data', j) if isinstance(j, dict) else j


def publicar(area, datos, intentos=3):
    cuerpo = json.dumps(datos, ensure_ascii=False).encode('utf-8')
    for i in range(1, intentos + 1):
        try:
            p = urllib.request.Request('%s/%s' % (API, area), data=cuerpo, method='POST')
            p.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(p, timeout=300) as r:
                json.loads(r.read().decode('utf-8'))
            return True
        except Exception as e:
            if i < intentos:
                log('Intento %d: no se pudo publicar (%s), se reintenta'
                    % (i, type(e).__name__), 'AVISO')
                time.sleep(5)
            else:
                log('No se pudo publicar en %s (%s: %s)'
                    % (area, type(e).__name__, str(e)[:140]), 'ERROR')
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  EL CALCULO — el codigo de la plataforma, corriendo en el navegador
# ══════════════════════════════════════════════════════════════════════════════

CALCULAR_JS = """
async ([urlModulo, filasReserva, maestro, anclaNoche, fotos]) => {
    let mod;
    try {
        mod = await import(urlModulo);
    } catch (e) {
        return { error: 'No se pudo cargar reserva_consolidacion.js: ' + (e && e.message ? e.message : e) };
    }
    for (const f of ['indicePorSku', 'consolidacionDeReserva', 'fotoChicaDeReserva',
                     'selloDeLaFoto', 'cierreDeFragmentados']) {
        if (typeof mod[f] !== 'function') return { error: 'El modulo cargo pero no exporta ' + f };
    }
    try {
        // El sello dice de que DIA es la foto que hay ahora en la reserva. Si hoy no toca
        // ancla de noche -esta apagada, o el dia esta destildado- devuelve null y no hay
        // nada que guardar: es la verdad, no un error.
        const sello = mod.selloDeLaFoto(new Date(), anclaNoche);
        if (!sello) return { ok: true, sello: null };

        const porSku = mod.indicePorSku(maestro);
        const datos = mod.consolidacionDeReserva(filasReserva, { porSku });
        if (!datos) return { error: 'La consolidacion devolvio null (Maestro vacio o sin indexar)' };

        const foto = mod.fotoChicaDeReserva(datos, sello);
        if (!foto) return { error: 'No se pudo armar la foto' };

        /* EL CIERRE DEL TURNO. Si ya hay una foto de ese dia -la de las 19:20- y todavia
           no tiene cierre, esta corrida es la de la mañana: se miden LOS MISMOS padres que
           se guardaron anoche contra el stock de ahora. Ver cierreDeFragmentados. */
        const guardada = (fotos || []).find(f => f && f.fecha === sello.fecha);
        let cierre = null;
        if (guardada && !guardada.cierre && (guardada.fragmentados || []).length) {
            cierre = mod.cierreDeFragmentados(guardada.fragmentados, datos.padresTodos);
        }

        return { ok: true, sello: sello, foto: foto, skus: porSku.size,
                 footwear: datos.matriz.reduce((s, c) => s + c.fw, 0),
                 reducen: datos.fragTotal, ubicFrag: datos.fragUbic,
                 yaEstaba: !!guardada, cierre: cierre,
                 metaGuardada: guardada ? (guardada.fragmentados || []).reduce((s, p) => s + (p.reduce || 0), 0) : 0 };
    } catch (e) {
        return { error: 'El calculo fallo: ' + (e && e.message ? e.message : e) };
    }
}
"""


def main():
    probar = '--probar' in sys.argv
    a_la_vista = '--ver' in sys.argv
    sitio, modulo = SITIO, MODULO
    for i, a in enumerate(sys.argv):
        if a == '--sitio' and i + 1 < len(sys.argv):
            sitio = sys.argv[i + 1].rstrip('/') + '/'
            modulo = sitio + 'js/reportes/reserva_consolidacion.js'
            log('Contra %s (modo prueba de sitio)' % sitio, 'AVISO')

    log('=' * 62)
    log('FOTO DEL DIA DE LA RESERVA%s' % ('  (MODO PROBAR, no guarda)' if probar else ''))
    log('=' * 62)

    # ── Los datos, del servidor ───────────────────────────────────────────────
    reserva = traer(AREA_RESERVA)
    if not isinstance(reserva, list) or len(reserva) < MINIMO_RESERVA:
        raise SystemExit('El stock de reserva publicado trae %s filas; se esperaban mas de %d. '
                         'No se guarda nada: una foto con datos a medias queda mal para siempre.'
                         % (len(reserva) if isinstance(reserva, list) else '0', MINIMO_RESERVA))
    maestro = traer(AREA_MAESTRO, date='MASTER')
    if not isinstance(maestro, list) or len(maestro) < MINIMO_MAESTRO:
        raise SystemExit('El Maestro trae %s filas; se esperaban mas de %d. Sin Maestro no se '
                         'puede separar el calzado de las bolsas, y una paleta de bolsas de '
                         '12.000 unidades taparia cualquier reparto.'
                         % (len(maestro) if isinstance(maestro, list) else '0', MINIMO_MAESTRO))
    fotos = traer(AREA_FOTOS)
    if not isinstance(fotos, list):
        fotos = []
    cfg = traer(AREA_CONFIG) or {}
    ancla = (cfg.get('robots') or {}).get('ancla_noche') or {}
    log('reserva %s filas  ·  Maestro %s articulos  ·  ancla de la noche %s'
        % (format(len(reserva), ',d'), format(len(maestro), ',d'),
           ancla.get('hora') or '(de fabrica)'))

    # ── El calculo, con el codigo de la plataforma ────────────────────────────
    from playwright.sync_api import sync_playwright
    t0 = time.time()
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=not a_la_vista)
        page = nav.new_page()
        page.goto(sitio, wait_until='domcontentloaded', timeout=120000)
        r = page.evaluate(CALCULAR_JS, [modulo, reserva, maestro, ancla,
                                        [{'fecha': f.get('fecha'),
                                          'fragmentados': f.get('fragmentados') or [],
                                          'cierre': f.get('cierre')} for f in fotos if f]])
        nav.close()
    if not r or r.get('error'):
        raise SystemExit((r or {}).get('error', 'el calculo no devolvio nada'))
    log('Calculado en %.0f s con el codigo de la plataforma' % (time.time() - t0))

    sello = r.get('sello')
    if not sello:
        log('Hoy no toca ancla de noche: no hay foto que guardar.', 'AVISO')
        return 0

    log('')
    log('   foto del      %s a las %s' % (sello['fecha'], sello['hora']))
    log('   Maestro       %s articulos' % format(r.get('skus', 0), ',d'))
    log('   footwear      %s ubicaciones' % format(r.get('footwear', 0), ',d'))
    log('   se reducen    %s articulos en %s ubicaciones'
        % (format(r.get('reducen', 0), ',d'), format(r.get('ubicFrag', 0), ',d')))
    log('')

    # ── EL CIERRE DEL TURNO, si esta es la corrida de la mañana ───────────────
    #
    # La foto del dia ya existe -la guardo el ancla de la noche- y todavia no tiene cierre:
    # entonces esta corrida es la de las 07:00 y lo que se mide es cuanto consolido el turno.
    # La foto en si NO se toca: el detalle que se ve en pantalla sigue siendo el de las 19:20,
    # como pidio Daniel. Lo unico que se agrega es la cabecera.
    if r.get('yaEstaba'):
        cierre = r.get('cierre')
        if not cierre:
            log('El %s ya tiene su foto y su cierre: no hay nada que hacer.' % sello['fecha'])
            return 0
        meta = r.get('metaGuardada') or 0
        hechas = max(0, meta - (cierre.get('reduce') or 0))
        cierre['hora'] = datetime.now().strftime('%H:%M')
        cierre['medido'] = datetime.now().isoformat(timespec='seconds')
        log('   cierre del turno   %s de %s ubicaciones liberadas (%d%%)'
            % (format(hechas, ',d'), format(meta, ',d'),
               round(100.0 * hechas / meta) if meta else 0))
        if probar:
            log('MODO PROBAR: aca se habria guardado el cierre del %s.' % sello['fecha'])
            return 0
        lista = []
        for f in fotos:
            if f and f.get('fecha') == sello['fecha']:
                f = dict(f)
                f['cierre'] = cierre
            lista.append(f)
        if not publicar(AREA_FOTOS, lista):
            return 1
        log('Cierre guardado en la foto del %s' % sello['fecha'])
        log('LISTO')
        return 0

    if probar:
        log('MODO PROBAR: aca se habria guardado la foto del %s.' % sello['fecha'])
        return 0

    foto = dict(r['foto'])
    foto['guardado'] = datetime.now().isoformat(timespec='seconds')
    foto['origen'] = 'robot'
    # Igual que la pantalla: la nueva adelante, ordenadas por fecha y con el tope de dias.
    lista = [f for f in fotos if f and f.get('fecha') != sello['fecha']]
    lista.insert(0, foto)
    lista.sort(key=lambda f: str(f.get('fecha') or ''), reverse=True)
    lista = lista[:DIAS_GUARDADOS]

    if not publicar(AREA_FOTOS, lista):
        return 1
    log('Guardada la foto del %s · %d dias en el calendario · %.1f KB'
        % (sello['fecha'], len(lista), len(json.dumps(lista)) / 1024.0))
    log('LISTO')
    return 0


if __name__ == '__main__':
    """NADA SE MUERE EN SILENCIO. Corriendo como tarea, un `raise SystemExit('mensaje')`
    no lo ve nadie: el mensaje sale por stderr y el Programador solo guarda el codigo."""
    try:
        codigo = main()
    except SystemExit as e:
        codigo = e.code
        if isinstance(codigo, str):
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
