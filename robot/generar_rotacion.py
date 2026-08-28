# -*- coding: utf-8 -*-
"""
ROTACIÓN Y PERMANENCIA — el análisis FSN del almacén, calculado acá y publicado a la web.

Son DOS análisis estándar y distintos, y el nombre que eligió Daniel los traduce a los dos:

  ROTACIÓN    el FSN de siempre: Fast / Slow / Non-moving. Qué tan rápido se mueve cada
              artículo, medido en una ventana FIJA E IGUAL PARA TODOS.
  PERMANENCIA el aging de inventario: cuánto tiempo lleva la mercadería en el CD.

CORRE ACÁ Y NO EN LA WEB, y no es un capricho. El cálculo necesita las ~180 fotos diarias
de stock, que son 1,3 GB y viven en OneDrive: el navegador no las tiene ni las va a tener.
Es el mismo reparto que ya usan `sku_sin_salida` y `evolucion_articulo` — el robot muele,
la web dibuja.

LOS LECTORES NO SE COPIAN, SE IMPORTAN de generar_evolucion.py. Leer una foto tiene sus
mañas —el csv va con punto y coma, el xlsx se abre como zip porque la PC no tiene openpyxl,
el encabezado de la reserva está en la fila 3, la MERMA no es stock vendible— y tener dos
copias de eso es garantía de que un día digan cosas distintas.

╔══════════════════════════════════════════════════════════════════════════════════════╗
║ LAS DECISIONES DE FONDO, que son de Daniel y conviene no "mejorar" sin preguntar     ║
╚══════════════════════════════════════════════════════════════════════════════════════╝

· SE MIDE POR ARTÍCULO, no por SKU: se suman todas las tallas del código. El artículo es
  el padre; el SKU, con talla, es el hijo.

· LA VENTANA ES FIJA E IGUAL PARA TODOS: 3 meses. Es lo que hace comparable a un artículo
  que llegó hace dos semanas con uno que lleva ocho meses. La primera versión medía el %
  acumulado desde que cada artículo llegó, y eso NO mide rotación: los "medio" se movían a
  107 unidades por semana y los "fast" a 39 —o sea al revés—, porque el que lleva más
  tiempo tuvo más tiempo para vaciarse.

· EL CORTE ENTRE FAST Y SLOW SON LAS 10 SEMANAS DE DANIEL: fast es el que a este ritmo NO
  llega a las 10 semanas en el CD; slow es el que las va a pasar.

· NON MOVER es el que no tuvo NINGUNA salida en esos 3 meses. No es "nunca en su vida".

· NO HAY ABC POR VALOR: no tenemos el costo del artículo en ninguna fuente.

· SE MIRA ACTIVO + RESERVA, las dos. Sin la reserva, la mitad que sube a reserva se ve
  igual que una venta y todo sale al doble.

· LOS TRES GRUPOS salen del `G. Gender` del Maestro. Los insumos y materiales —etiquetas,
  hang tags, cartones— van aparte: un rollo de 10.000 etiquetas cuenta como 10.000
  unidades e inflaría el stock sin decir nada de la rotación de la mercadería.
"""
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_evolucion as ev          # los lectores de fotos y del Maestro

API = "https://logistics-backend-wv0x.onrender.com/api/logistics"

# LA CREDENCIAL DEL ROBOT. Vive en el entorno del Contabo y en Render, NUNCA en el
# repo: una vez se subio por error y hubo que cambiarla. Si falta, el robot escribe
# igual mientras el candado del servidor este en modo aviso.
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")
AREA = "rotacion_permanencia"

# ── LO QUE SE PUEDE TOCAR ────────────────────────────────────────────────────────────
MESES_VENTANA = 3        # la ventana fija con la que se mide a todos
TOPE_SEMANAS = 10        # el corte entre fast y slow, en semanas de cobertura
NUEVO_SEMANAS = 4        # menos que esto y el ritmo todavía no significa nada
TRAMOS = [(0, 4), (5, 10), (11, 20), (21, 9999)]   # la permanencia, en semanas


# Cuando lo llama el robot de las 19:00 le presta su log, así todo queda en el parte de
# la corrida. Suelto, escribe por pantalla. Mismo contrato que la evolución del artículo.
_LOG_EXTERNO = None


def log(m, n="INFO"):
    if _LOG_EXTERNO:
        _LOG_EXTERNO("[rotación] " + m, n)
        return
    print("[%s] %-5s %s" % (time.strftime("%H:%M:%S"), n, m), flush=True)


def _dia(s):
    from datetime import date
    a, m, d = (int(x) for x in s.split("-"))
    return date(a, m, d)


"""LO QUE SE IMPORTA DE generar_evolucion Y LO QUE NO.

Se le piden los LECTORES —las fotos y el Maestro—, que son los que tienen las mañas y no
conviene tener por duplicado. Todo lo demás se resuelve acá.

EL SERVIDOR PUEDE TENER UNA VERSIÓN MÁS VIEJA de generar_evolucion.py que la laptop, y de
hecho la tenía: el 15-ago-2026 la primera corrida en el servidor murió con
`module 'generar_evolucion' has no attribute 'primero_de_mes'`. Depender de funciones
chicas de otro archivo hace que este estudio se caiga por un cambio que no es suyo. Las
chicas se copian; los lectores se importan y, si faltaran, se avisa con nombre y apellido
en vez de reventar con un AttributeError."""
FALTAN = [n for n in ("_base_onedrive", "fechas_disponibles", "leer_activo",
                      "leer_reserva", "leer_maestro") if not hasattr(ev, n)]


def primero_de_mes(hasta, meses):
    """El día 1 del mes que abre la ventana, contando `meses` hacia atrás e incluyendo el
    mes de `hasta`. Con 3 y estando en agosto devuelve el 1 de junio; al llegar septiembre
    devuelve el 1 de julio sin que nadie toque nada, que es lo que corre la ventana sola.

    Va por MESES ENTEROS y no por 90 días corridos: con días el corte cae cualquier fecha
    —el 9 de mayo, por ejemplo— y parte un mes al medio, así que un filtro por mes mostraría
    medio mes sin decirlo."""
    from datetime import date
    a, m = hasta.year, hasta.month - (meses - 1)
    while m <= 0:
        m += 12
        a -= 1
    return date(a, m, 1)


def modelo_de(desc):
    """'... - THIAGO - BLACK/NEGRO - BATA-1-38' -> 'Thiago · Black/Negro'."""
    fn = getattr(ev, "modelo_de", None)
    if fn:
        return fn(desc)
    p = str(desc or "").split("-1-")[0].split(" - ")
    return " · ".join(x.strip().title() for x in p[:2]) if len(p) > 1 else str(desc or "")[:40]


def marca_de(desc):
    fn = getattr(ev, "marca_de", None)
    return fn(desc) if fn else ""


def grupo_de(gg):
    """Los tres grupos, del `G. Gender` del Maestro.

    'Footwear' es calzado; 'Non Footwear', 'Non Commercial' y 'Promotions' son accesorios,
    ropa y promociones. Lo que no está en el Maestro cae en insumos, que es donde de hecho
    están las etiquetas y los cartones: no tienen ficha porque no son mercadería."""
    g = (gg or "").strip().upper()
    if g.startswith("FOOTWEAR"):
        return "CALZ"
    if g:
        return "NOCALZ"
    return "SINM"


def construir():
    if FALTAN:
        raise RuntimeError(
            "generar_evolucion.py no tiene: %s. Es una versión vieja: copiá también ese "
            "archivo desde la laptop a C:\\wms_scraping." % ", ".join(FALTAN))
    base = ev._base_onedrive()
    log("OneDrive: %s" % base)

    fotos = ev.fechas_disponibles(base)
    if not fotos:
        raise RuntimeError("No hay fotos de stock (activo + reserva) para trabajar.")
    dias = sorted(fotos)
    hasta = dias[-1]
    desde = primero_de_mes(_dia(hasta), MESES_VENTANA).isoformat()
    # LA VENTANA VA POR MESES ENTEROS, igual que en el estudio del código nuevo: si el
    # corte cayera cualquier día partiría un mes al medio y el filtro de la pantalla
    # mostraría medio mes sin decirlo.
    enVentana = [d for d in dias if d >= desde]
    if len(enVentana) < 2:
        raise RuntimeError("La ventana de %d meses tiene %d fotos: hacen falta al menos 2."
                           % (MESES_VENTANA, len(enVentana)))
    log("ventana %s → %s · %d fotos de %d en total" % (desde, hasta, len(enVentana), len(dias)))

    maestro = ev.leer_maestro(base)

    # ── Se recorren las fotos de la ventana, una por una ────────────────────────────
    #
    # DE CADA FOTO SOLO SE GUARDA EL TOTAL POR ARTÍCULO. Guardar el detalle de las 90
    # fotos serían millones de filas en memoria para nada: lo único que hace falta es
    # cuánto había cada día, y cuándo se movió por última vez.
    stock = {}          # cod -> {fecha: unidades}
    catalogo = {}       # cod -> [descripcion, sku]
    for i, d in enumerate(enVentana, 1):
        act, res = fotos[d]
        try:
            ta, ca = ev.leer_activo(act)
            tr, _mal, cr = ev.leer_reserva(res)
        except Exception as e:                      # una foto rota no tumba el estudio
            log("foto %s ilegible (%s): se saltea" % (d, e), "WARN")
            continue
        catalogo.update(ca)
        catalogo.update(cr)
        for c in set(list(ta) + list(tr)):
            stock.setdefault(c, {})[d] = ta.get(c, 0) + tr.get(c, 0)
        if i % 20 == 0 or i == len(enVentana):
            log("  %d/%d fotos leídas" % (i, len(enVentana)))

    # ── La primera foto de todas, para saber desde cuándo está cada artículo ────────
    #
    # LA PERMANENCIA SE MIDE CON EL HISTÓRICO COMPLETO, no con la ventana. Un artículo
    # que está hace ocho meses tiene que decir 34 semanas, no 13: si se midiera dentro de
    # la ventana, todos los viejos empatarían en el tope y el aging no serviría de nada.
    primera = {}
    for d in dias:
        act, res = fotos[d]
        try:
            ta, _ = ev.leer_activo(act)
            tr, _m, _c = ev.leer_reserva(res)
        except Exception:
            continue
        for c in set(list(ta) + list(tr)):
            if (ta.get(c, 0) + tr.get(c, 0)) > 0:
                primera.setdefault(c, d)
        if d >= desde:
            break     # de la ventana en adelante ya se sabe todo por el paso anterior
    for c, h in stock.items():
        conStock = [f for f, v in sorted(h.items()) if v > 0]
        if conStock:
            primera.setdefault(c, conStock[0])

    hoyD = _dia(hasta)
    filas = []
    for cod, hist in stock.items():
        fechas = sorted(hist)
        hoy = hist[fechas[-1]]
        if hoy <= 0:
            continue          # se fue del almacén: no es permanencia de nadie

        # LO QUE SALIÓ ES LA SUMA DE LAS BAJADAS, no `entró − queda`. Un artículo que
        # bajó 300 y después le repusieron 500 movió 300, no −200. Mirando solo las
        # puntas, la reposición tapa la venta y el artículo parece quieto.
        salio = entro = 0
        ultMov = None
        for a, b in zip(fechas, fechas[1:]):
            dif = hist[b] - hist[a]
            if dif < 0:
                salio += -dif
                ultMov = b
            elif dif > 0:
                entro += dif
        semanasVentana = max(1.0, (hoyD - _dia(fechas[0])).days / 7.0)
        vel = round(salio / semanasVentana, 1)

        llegada = primera.get(cod, fechas[0])
        sem = int((hoyD - _dia(llegada)).days / 7)
        parado = (hoyD - _dia(ultMov)).days if ultMov else (hoyD - _dia(fechas[0])).days

        if salio <= 0:
            clase, cob = "NON", None
        else:
            cob = round(hoy / vel, 1) if vel > 0 else None
            clase = "FAST" if (cob is not None and cob <= TOPE_SEMANAS) else "SLOW"

        desc, sku = (catalogo.get(cod) or ["", ""])
        m = maestro.get(cod) or ("", "", "")
        marca = (m[0] or marca_de(desc) or "?").strip()
        filas.append({
            "cod": cod, "marca": marca, "col": (m[1] or "ND").strip(),
            "mod": modelo_de(desc), "lleg": llegada, "sem": sem,
            "hoy": hoy, "salio_v": salio, "entro_v": entro, "vel": vel,
            "cob": cob, "par": parado, "clase": clase,
            "gr": grupo_de(m[2] if len(m) > 2 else ""),
            "nuevo": sem < NUEVO_SEMANAS
        })

    filas.sort(key=lambda f: (-f["hoy"]))
    porGrupo = {}
    for f in filas:
        g = porGrupo.setdefault(f["gr"], {"articulos": 0, "unidades": 0})
        g["articulos"] += 1
        g["unidades"] += f["hoy"]
    log("%d artículos · %s" % (len(filas), " · ".join(
        "%s %d art/%d u" % (k, v["articulos"], v["unidades"]) for k, v in sorted(porGrupo.items()))))

    return {
        "generado": time.strftime("%Y-%m-%d %H:%M"),
        "desde": desde, "hasta": hasta,
        # Desde cuándo hay historia: las semanas en el CD se cuentan desde acá, así que lo
        # que ya estaba antes marca el tope. La pantalla lo dice para que nadie lea "32
        # semanas" como exacto.
        "desdeHistoria": dias[0],
        "fotos": len(enVentana), "fotosTotales": len(dias),
        "mesesVentana": MESES_VENTANA, "topeSemanas": TOPE_SEMANAS,
        "nuevoSemanas": NUEVO_SEMANAS,
        "tramos": [list(t) for t in TRAMOS],
        "porGrupo": porGrupo,
        "articulos": filas
    }


def subir(paquete, intentos=3):
    """VA CON `?date=MASTER`, y no es opcional.

    El área guarda un OBJETO —cabecera más la lista de artículos—, no filas sueltas. Sin ese
    parámetro el servidor responde 200 igual y lo guarda como lista vacía: la pantalla queda
    en blanco y nada avisa. Es el mismo contrato que usan la evolución del artículo y los
    layouts."""
    cuerpo = json.dumps(paquete, ensure_ascii=False).encode("utf-8")
    url = "%s/%s?date=MASTER" % (API, AREA)
    for i in range(1, intentos + 1):
        try:
            cab = {"Content-Type": "application/json"}
            if ROBOT_TOKEN:
                cab["X-Robot-Token"] = ROBOT_TOKEN
            req = urllib.request.Request(url, data=cuerpo, headers=cab, method="POST")
            with urllib.request.urlopen(req, timeout=300) as r:
                if r.status < 300:
                    log("publicado en '%s' (%d KB)" % (AREA, len(cuerpo) // 1024))
                    return True
        except Exception as e:
            log("intento %d/%d falló: %s" % (i, intentos, e), "WARN")
            time.sleep(5 * i)
    return False


def main(solo_calcular=None, log_externo=None):
    """`solo_calcular` deja el resultado en disco sin publicarlo.

    Cuando lo llama el robot se le pasa EXPLÍCITO: leer sys.argv desde adentro tomaría los
    argumentos del robot —que son la fecha y las rutas de los stocks— y con un `--solo-calcular`
    ajeno el estudio se calcularía todas las noches sin publicarse nunca. Es la misma trampa que
    ya había resuelto la evolución del artículo."""
    global _LOG_EXTERNO
    if log_externo:
        _LOG_EXTERNO = log_externo
    if solo_calcular is None:
        solo_calcular = "--solo-calcular" in sys.argv

    try:
        p = construir()
    except Exception as e:
        log("%s: %s" % (type(e).__name__, str(e)[:200]), "ERROR")
        return 1

    salida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rotacion.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False)
    log("resultado en %s (%.2f MB)" % (salida, os.path.getsize(salida) / 1048576.0))

    if solo_calcular:
        log("--solo-calcular: no se publica")
        return 0
    return 0 if subir(p) else 3


if __name__ == "__main__":
    sys.exit(main())
