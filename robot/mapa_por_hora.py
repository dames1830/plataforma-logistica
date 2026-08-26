"""
================================================================================
 EL MAPA DE CALOR, CADA HORA Y SOLO
================================================================================

Daniel, 23-ago-2026: *"quiero que el mapa de calor se actualice cada vez que se
actualice el avance. A cada hora quiero que se actualice el mapa en automatico,
con ese stock que se va actualizando"*.

QUE PASABA ANTES. El mapa que se ve DENTRO de la plataforma ya se actualizaba
solo: lee `layout_stock_hora`, que el robot de las :30 publica cada hora. El que
se quedaba viejo era el mapa PUBLICADO -el del reporte publico-, porque solo se
escribia cuando alguien entraba y apretaba "PROCESAR Y PUBLICAR". El 23-ago-2026
las cuatro zonas llevaban cuatro dias sin tocarse.

ESTE ROBOT NO CALCULA NADA POR SU CUENTA. Abre la web publicada, importa
`js/reportes/layout_calculo.js` de PRODUCCION y llama a la misma funcion que
llama la pantalla. Es la receta del robot del picking: una sola copia del
calculo, y si manana se corrige una regla, el robot la toma sola. Traducirlo a
Python daria dos calculos que tienen que coincidir, y se separan.

NO ENTRA A ORACLE. No necesita usuario del WMS, ni Playwright para navegar, ni
el candado `bloqueo_wms`: todo lo que lee -el stock de la hora y el Maestro- ya
esta publicado en la API. Por eso puede correr al lado de cualquier otro robot
sin pelearse por la sesion.

TAMPOCO NECESITA USUARIO DE LA PLATAFORMA. Publica igual que los demas: un POST
con `Content-Type: application/json` y nada mas.

    Robot de las :30            este robot (:45)             el reporte publico
    publica el stock     ->    calcula y publica       ->    se redibuja solo
    de la hora                 las cuatro zonas              (v29.0352)

EL "MAPA ANTERIOR" SE GUARDA UNA VEZ AL DIA
-------------------------------------------
Al publicar a mano, el mapa actual se copiaba a `_ANT` en cada publicacion. Con
el mapa publicandose cada hora eso convertiria "anterior" en "hace una hora", que
no sirve para comparar nada.

Regla de Daniel: el anterior sigue siendo la foto de ayer. Se guarda **una sola
vez al dia, en la primera corrida despues de las 07:00**, asi que durante todo el
dia "anterior" es el mapa con el que cerro el turno noche. La marca de la ultima
rotacion vive en `mapa_ant_ultimo.json`, al lado de este archivo.

USO
---
    python mapa_por_hora.py                  corre y publica
    python mapa_por_hora.py --sin-publicar   calcula y muestra, sin escribir nada
    python mapa_por_hora.py --forzar-anterior  rota el _ANT aunque ya se roto hoy
    python mapa_por_hora.py --zonas SEL,MZN01  solo esas

CODIGOS DE SALIDA
-----------------
    0  se publico al menos una zona (o --sin-publicar termino bien)
    1  no se pudo abrir la web o falto el stock/Maestro
    2  se calculo pero ninguna zona se pudo publicar
================================================================================
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

SITIO = 'https://deam1830.com'
ZONAS_POR_DEFECTO = ['SEL', 'MZN01', 'MZN02', 'MZN03']   # el MZN04 no tiene mapa: no esta construido
AQUI = os.path.dirname(os.path.abspath(__file__))
MARCA_ANT = os.path.join(AQUI, 'mapa_ant_ultimo.json')

# La hora a partir de la cual una corrida ya cuenta como "el dia de hoy". Antes de
# esa hora seguimos dentro del turno noche, que pertenece al dia anterior.
CORTE_DIA = 7


def dia_logico(ahora=None):
    """El dia al que pertenece esta corrida. Antes de las 07:00 todavia es ayer."""
    ahora = ahora or datetime.now()
    if ahora.hour < CORTE_DIA:
        ahora = ahora - timedelta(days=1)
    return ahora.strftime('%Y-%m-%d')


def toca_rotar_anterior(forzar=False):
    """True si a esta corrida le toca guardar el mapa actual como ANTERIOR."""
    hoy = dia_logico()
    if forzar:
        return True, hoy
    try:
        with open(MARCA_ANT, encoding='utf-8') as f:
            ultimo = (json.load(f) or {}).get('dia')
    except Exception:
        ultimo = None
    return (ultimo != hoy), hoy


def anotar_rotacion(dia):
    try:
        with open(MARCA_ANT, 'w', encoding='utf-8') as f:
            json.dump({'dia': dia, 'cuando': datetime.now().isoformat(timespec='seconds')},
                      f, ensure_ascii=False, indent=1)
    except Exception as e:
        print(f'[MAPA] no se pudo anotar la rotacion del anterior: {e}')


# ─────────────────────────────────────────────────────────────────────────────
# TODO EL TRABAJO PASA DENTRO DE LA PAGINA
#
# El stock de la hora son unos 6 MB. Traerlo a Python para volver a mandarlo al
# navegador seria moverlo dos veces por el puente de Playwright sin ninguna razon:
# la pagina puede pedirlo, calcular y publicar sin que salga de ahi. Python solo
# lee el resumen que devuelve.
# ─────────────────────────────────────────────────────────────────────────────
JS = r"""
async ({ zonas, rotarAnterior, publicar, base, robotToken }) => {
  // La cabecera con el token del robot para los POST. En los GET no hace falta.
  const cabPost = { 'Content-Type': 'application/json' };
  if (robotToken) cabPost['X-Robot-Token'] = robotToken;
  const API = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
  const t = () => '?t=' + Date.now();
  const pasos = [];

  // El calculo y las zonas salen del MISMO archivo, a proposito: importar
  // zonasService por su cuenta traeria otra copia del modulo y cargarZonas()
  // llenaria la equivocada. Ver el comentario de cargarZonas en layout_calculo.js.
  const M = await import((base || '') + '/js/reportes/layout_calculo.js');
  await M.cargarZonas();

  const traer = async (area, conMaster) => {
    const url = API + '/' + area + (conMaster ? '?date=MASTER&' : '?') + 't=' + Date.now();
    const r = await fetch(url);
    if (!r.ok) throw new Error(area + ' respondio ' + r.status);
    const c = await r.json();
    const d = (c && c.data !== undefined) ? c.data : c;
    return { filas: Array.isArray(d) ? d : [], sello: (c && c.updated_at) || null };
  };

  const stock = await traer('layout_stock_hora', true);
  const maestro = await traer('articulos', false);
  if (!stock.filas.length)   throw new Error('el stock de la hora vino vacio');
  if (!maestro.filas.length) throw new Error('el Maestro vino vacio');

  for (const zona of zonas) {
    const paso = { zona, pares: 0, publicado: false, anterior: false, motivo: '' };
    try {
      const { payload } = M.procesarLayout({ stock: stock.filas, maestro: maestro.filas, zona });
      if (!payload || !(payload.totalUnits > 0)) { paso.motivo = 'sin unidades en esa zona'; pasos.push(paso); continue; }
      paso.pares = payload.totalUnits;
      paso.padres = payload.uniquePadresSize;

      if (!publicar) { paso.motivo = 'calculado, no se publico (--sin-publicar)'; pasos.push(paso); continue; }

      // 1) El ANTERIOR, una sola vez al dia: se guarda el que estaba publicado.
      if (rotarAnterior) {
        try {
          const r = await fetch(API + '/layout_activo_' + zona + '?date=MASTER&' + t().slice(1));
          if (r.ok) {
            const c = await r.json();
            if (c && c.data && c.data.type === 'processed' && c.data.totalUnits > 0) {
              const g = await fetch(API + '/layout_activo_' + zona + '_ANT?date=MASTER', {
                method: 'POST', headers: cabPost,
                body: JSON.stringify(c.data) });
              paso.anterior = g.ok;
            }
          }
        } catch (e) { /* si no se pudo respaldar, igual publicamos el nuevo */ }
      }

      // 2) El mapa nuevo como ACTUAL. Los dos campos extra son los mismos que
      //    escribe la pantalla al publicar a mano.
      payload.zona = zona;
      payload.publishedAt = Date.now();
      const res = await fetch(API + '/layout_activo_' + zona + '?date=MASTER', {
        method: 'POST', headers: cabPost,
        body: JSON.stringify(payload) });
      paso.publicado = res.ok;
      if (!res.ok) paso.motivo = 'el servidor respondio ' + res.status;
    } catch (e) {
      paso.motivo = String((e && e.message) || e);
    }
    pasos.push(paso);
  }

  return { selloStock: stock.sello, filasStock: stock.filas.length,
           filasMaestro: maestro.filas.length, pasos };
}
"""


def correr(zonas, publicar=True, forzar_anterior=False, headless=True, sitio=SITIO, base=''):
    """`sitio` y `base` existen para poder probar contra una copia local antes de que el
    cambio este en produccion: el robot de verdad no los usa. Ver --sitio y --base."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('[MAPA] falta Playwright. Instalar con: pip install playwright && playwright install chromium')
        return 1

    rotar, hoy = toca_rotar_anterior(forzar_anterior)
    print(f'[MAPA] {datetime.now():%d-%m-%Y %H:%M:%S} · zonas: {", ".join(zonas)}')
    print(f'[MAPA] dia logico {hoy} · guardar el ANTERIOR: {"si" if rotar else "no, ya se guardo hoy"}')

    with sync_playwright() as p:
        nav = p.chromium.launch(headless=headless)
        pag = nav.new_page()
        try:
            # Se abre el sitio para tener el ORIGEN correcto: desde ahi el import y los
            # fetch a la API salen como si los hiciera la propia plataforma.
            pag.goto(sitio, wait_until='domcontentloaded', timeout=90000)
            # El token del robot -del entorno del Contabo, nunca escrito aca- viaja
            # al JS inyectado, que lo pone en la cabecera de sus POST. Ver v29.0415.
            r = pag.evaluate(JS, {'zonas': zonas, 'rotarAnterior': rotar,
                                 'publicar': publicar, 'base': base,
                                 'robotToken': os.environ.get('ROBOT_TOKEN', '')})
        except Exception as e:
            print(f'[MAPA] ERROR: {e}')
            nav.close()
            return 1
        nav.close()

    print(f'[MAPA] stock de la hora: {r["filasStock"]:,} filas (publicado {r["selloStock"]}) · '
          f'Maestro: {r["filasMaestro"]:,} filas')

    ok = 0
    for paso in r['pasos']:
        marca = 'OK ' if paso['publicado'] else '-- '
        extra = f' · anterior guardado' if paso.get('anterior') else ''
        motivo = f' · {paso["motivo"]}' if paso.get('motivo') else ''
        print(f'[MAPA] {marca}{paso["zona"]:<6} {paso["pares"]:>8,} pares'
              f'{" · " + str(paso.get("padres", "")) + " codigos" if paso.get("padres") else ""}'
              f'{extra}{motivo}')
        if paso['publicado']:
            ok += 1

    if not publicar:
        print('[MAPA] --sin-publicar: no se escribio nada.')
        return 0

    if ok:
        if rotar:
            anotar_rotacion(hoy)
        print(f'[MAPA] listo: {ok} de {len(zonas)} zonas publicadas.')
        return 0

    print('[MAPA] no se pudo publicar ninguna zona.')
    return 2


def main():
    ap = argparse.ArgumentParser(description='Publica el mapa de calor de las zonas activas.')
    ap.add_argument('--sin-publicar', action='store_true', help='calcula y muestra, sin escribir nada')
    ap.add_argument('--forzar-anterior', action='store_true', help='guarda el ANTERIOR aunque ya se haya guardado hoy')
    ap.add_argument('--zonas', default=','.join(ZONAS_POR_DEFECTO), help='lista separada por comas')
    ap.add_argument('--ver', action='store_true', help='abre el navegador a la vista, para mirar')
    ap.add_argument('--sitio', default=SITIO, help='de donde se importa el calculo (solo para probar)')
    ap.add_argument('--base', default='', help='prefijo del sitio, si la web no cuelga de la raiz (solo para probar)')
    a = ap.parse_args()

    zonas = [z.strip().upper() for z in a.zonas.split(',') if z.strip()]
    if not zonas:
        print('[MAPA] no se indico ninguna zona.')
        return 1

    return correr(zonas, publicar=not a.sin_publicar,
                  forzar_anterior=a.forzar_anterior, headless=not a.ver,
                  sitio=a.sitio, base=a.base)


if __name__ == '__main__':
    sys.exit(main())
