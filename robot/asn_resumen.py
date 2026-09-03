# -*- coding: utf-8 -*-
"""
EL RESUMEN DEL ASN PARA LA PANTALLA DE RECEPCION.

Lee los seis archivos que dejo `asn_web_report.py` -uno por mes, 64 MB en
total- y publica a la plataforma solo lo que la pantalla necesita: unos pocos
KB. Daniel no abre los Excel; abre la web.

QUE PUBLICA (area `asn_recepcion`)
    · enviado contra recibido, con el calzado separado del resto
    · el cumplimiento mes a mes
    · el estado de los ASN, con los cancelados
    · si llego lo que dijo el ASN: completo, parcial, sin recibir, de mas
    · la lista de los ASN parciales, que son los que hay que perseguir

COMO SEPARA EL CALZADO
    Cruzando con el Maestro por la columna `G. Gender`: Footwear es calzado y
    todo lo demas no. No alcanza con "estar en el Maestro": ahi adentro tambien
    hay Non Footwear, Non Commercial y Promotions. La `Caja H30`, que es el
    articulo con mas pendiente de todos, esta en el Maestro marcada como
    Non Commercial.

CORRE DETRAS DEL ROBOT DEL ASN, a las 04:30.
"""
import os
import sys
import json
import time
import urllib.request
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

API = "https://logistics-backend-wv0x.onrender.com/api/logistics"
AREA = "asn_recepcion"
# Cuantas filas de detalle se publican. Medido: 500 articulos son 89 KB y todos
# los 11.307 serian 1.117 KB. Ver el comentario del paquete.
TOPE_ARTICULOS = 500
TOPE_POR_MES = 50
# La credencial del robot vive en el entorno del Contabo y en Render, NUNCA en el repo.
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")

CARPETA_ASN = None          # se resuelve con wms_automation_final
MAESTRO = None

_LOG_EXTERNO = None


def log(mensaje, nivel="INFO"):
    if _LOG_EXTERNO:
        _LOG_EXTERNO(mensaje, nivel)
        return
    print("[%s] [%-5s] %s" % (datetime.now().strftime("%H:%M:%S"), nivel, mensaje))


def rutas():
    global CARPETA_ASN, MAESTRO
    import wms_automation_final as wms
    base = wms._base_onedrive()                     # ...\scraping Stock
    CARPETA_ASN = os.path.join(base, "ASN")
    MAESTRO = os.path.join(os.path.dirname(base), "Maestro_Articulos.xlsx")
    if not os.path.isfile(MAESTRO):
        alterno = os.path.join(base, "Archivos", "Maestro_Articulos.xlsx")
        if os.path.isfile(alterno):
            MAESTRO = alterno


def af(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def fecha_de(v):
    if isinstance(v, datetime):
        return v
    s = str(v or "").strip()
    for f in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, f)
        except ValueError:
            continue
    return None


def leer_maestro():
    """Los codigos que son calzado, y ademas la MARCA y el gender de cada uno.

    LA COLUMNA DE LA MARCA SE LLAMA `Marcas`, EN PLURAL. Buscarla como "Marca" no
    la encuentra y la pantalla sale con todo en "(sin marca)": paso en la primera
    medicion. Es la misma que usa el robot de picking.
    """
    from openpyxl import load_workbook
    wb = load_workbook(MAESTRO, read_only=True, data_only=True)
    h = wb[wb.sheetnames[0]]
    it = h.iter_rows(values_only=True)
    enc = [str(c).strip() if c is not None else "" for c in next(it)]

    def col(*nombres):
        for n in nombres:
            for i, c in enumerate(enc):
                if c.lower().replace(".", "").replace(" ", "") == n.lower().replace(".", "").replace(" ", ""):
                    return i
        return None

    iC, iG = enc.index("CodArticulo"), enc.index("G. Gender")
    iM = col("Marcas", "MarcaStd")
    calzado = set()
    ficha = {}
    total = 0
    for f in it:
        if iC >= len(f) or f[iC] is None:
            continue
        total += 1
        cod = str(f[iC]).strip()
        gen = str(f[iG]).strip() if iG < len(f) and f[iG] else ""
        if gen == "Footwear":
            calzado.add(cod.lstrip("0"))
        ficha[cod[:7]] = (gen or "(sin gender)",
                          (str(f[iM]).strip() if iM is not None and iM < len(f) and f[iM] else "")
                          or "(sin marca)")
    wb.close()
    log("Maestro: %s articulos, %s de calzado, marca en la columna %s"
        % ("{:,}".format(total), "{:,}".format(len(calzado)), enc[iM] if iM is not None else "?"))
    return calzado, ficha


def construir():
    from openpyxl import load_workbook
    calzado, ficha = leer_maestro()

    clase = defaultdict(lambda: {"lineas": 0, "env": 0.0, "rec": 0.0})
    mes = defaultdict(lambda: {"env": 0.0, "rec": 0.0})
    estado = defaultdict(lambda: {"asn": set(), "env": 0.0, "rec": 0.0})
    asn_env, asn_rec, asn_info = defaultdict(float), defaultdict(float), {}
    # Lo RECIBIDO, por el mes en que entro de verdad al sistema. Es la unica
    # fecha que responde 'que se recibio entre tal y tal dia': ni la de envio
    # ni la de creacion sirven para eso.
    recep = defaultdict(lambda: {'unid': 0.0, 'asn': set(), 'lineas': 0})
    sin_fecha_rec = {'unid': 0.0, 'lineas': 0}
    archivos = []

    # ══════════════════════════════════════════════════════════════════════════
    # EL DETALLE QUE PIDIO DANIEL EL 03-sep-2026
    # ══════════════════════════════════════════════════════════════════════════
    #
    # *"necesito un reporte que me diga que articulo esta llegando, que marca esta
    # llegando... en el mes a mes, darle clic y ver que es lo que esta faltando.
    # Esa es la idea de tener el ASN"*.
    #
    # Todo esto ya estaba en los archivos —traen `Articulo` y `Descripcion`— y se
    # tiraba: hasta hoy solo se publicaban totales.
    #
    # SE ACUMULA TODO Y SE RECORTA AL FINAL, no al vuelo: recortar mientras se lee
    # obligaria a decidir con la mitad de los datos y el que mas falta puede
    # aparecer en el ultimo archivo.
    art = defaultdict(lambda: {"e": 0.0, "r": 0.0, "n": 0, "d": "", "m": "", "g": ""})
    marca = defaultdict(lambda: {"e": 0.0, "r": 0.0, "n": 0})
    por_mes_art = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))

    for nombre in sorted(f for f in os.listdir(CARPETA_ASN) if f.lower().endswith(".xlsx")):
        etiqueta = nombre.replace("ASN ", "").replace(".xlsx", "")
        ruta = os.path.join(CARPETA_ASN, nombre)
        wb = load_workbook(ruta, read_only=True, data_only=True)
        hh = wb[wb.sheetnames[0]]
        it = hh.iter_rows(values_only=True)
        idx = None
        for fila in it:
            if fila and any(c is not None for c in fila):
                txt = [str(c).strip() if c is not None else "" for c in fila]
                if "Número de ASN" in txt:
                    idx = {n: i for i, n in enumerate(txt) if n}
                    break
        if idx is None:
            log("%s sin encabezado; se salta" % nombre, "WARN")
            wb.close()
            continue

        iN, iA = idx.get("Número de ASN"), idx.get("Artículo")
        iE, iR = idx.get("Cantidad enviada"), idx.get("Cantidad recibida")
        iS, iF, iD = idx.get("Estado"), idx.get("Fecha de envío"), idx.get("Descripción")
        # La columna se agrego el 01-sep-2026. Los archivos bajados antes no la
        # traen: se acepta que falte y el bloque queda vacio hasta la proxima bajada.
        iV = idx.get("Fecha de recepción") or idx.get("verified_ts")

        n = 0
        for fila in it:
            if not fila or iN is None or iN >= len(fila) or fila[iN] is None:
                continue
            asn = str(fila[iN]).strip()
            if not asn:
                continue
            n += 1
            env, rec = af(fila[iE]), af(fila[iR])
            cod = str(fila[iA]).strip() if iA is not None and iA < len(fila) and fila[iA] else ""
            cl = "calzado" if cod.split("-")[0].lstrip("0") in calzado else "no_calzado"

            c = clase[cl]
            c["lineas"] += 1
            c["env"] += env
            c["rec"] += rec

            mes[etiqueta]["env"] += env
            mes[etiqueta]["rec"] += rec

            # el detalle por articulo, por marca y por mes
            if cod:
                gen, mk = ficha.get(cod[:7], ("(no esta en el Maestro)", "(sin marca)"))
                a = art[cod]
                a["e"] += env
                a["r"] += rec
                a["n"] += 1
                if not a["d"]:
                    a["d"] = (str(fila[iD]).strip()[:70]
                              if iD is not None and iD < len(fila) and fila[iD] else "")
                    a["m"] = mk
                    a["g"] = gen
                k = marca[mk]
                k["e"] += env
                k["r"] += rec
                k["n"] += 1
                x = por_mes_art[etiqueta][cod]
                x[0] += env
                x[1] += rec

            est = str(fila[iS]).strip() if iS is not None and iS < len(fila) and fila[iS] else "(sin estado)"
            e = estado[est]
            e["asn"].add(asn)
            e["env"] += env
            e["rec"] += rec

            asn_env[asn] += env
            asn_rec[asn] += rec

            if rec > 0:
                fv = fecha_de(fila[iV]) if iV is not None and iV < len(fila) else None
                if fv is None:
                    sin_fecha_rec["unid"] += rec
                    sin_fecha_rec["lineas"] += 1
                else:
                    r = recep["%04d-%02d" % (fv.year, fv.month)]
                    r["unid"] += rec
                    r["asn"].add(asn)
                    r["lineas"] += 1
            if asn not in asn_info:
                fe = fecha_de(fila[iF]) if iF is not None and iF < len(fila) else None
                asn_info[asn] = {
                    "estado": est,
                    "envio": fe.strftime("%d/%m/%Y") if fe else "",
                }
        wb.close()
        archivos.append({"mes": etiqueta, "lineas": n,
                         "mb": round(os.path.getsize(ruta) / 1048576.0, 1)})
        log("%s: %s lineas" % (nombre, "{:,}".format(n)))

    # ── llego lo que dijo el ASN ────────────────────────────────────────
    cumpl = {k: {"asn": 0, "env": 0.0, "rec": 0.0}
             for k in ("completo", "parcial", "sin_recibir", "de_mas")}
    parciales = []
    for asn, env in asn_env.items():
        rec = asn_rec[asn]
        if rec == 0 and env > 0:
            k = "sin_recibir"
        elif rec > env:
            k = "de_mas"
        elif rec == env and env > 0:
            k = "completo"
        else:
            k = "parcial"
        cumpl[k]["asn"] += 1
        cumpl[k]["env"] += env
        cumpl[k]["rec"] += rec
        if k == "parcial":
            info = asn_info.get(asn, {})
            parciales.append({
                "asn": asn, "envio": info.get("envio", ""), "estado": info.get("estado", ""),
                "enviado": env, "recibido": rec, "falta": env - rec,
                "cumple": round(100.0 * rec / env, 1) if env else 0,
            })
    parciales.sort(key=lambda p: -p["falta"])

    # ── el detalle, ya recortado ─────────────────────────────────────────────
    con_falta = sorted(((c, v) for c, v in art.items() if v["e"] - v["r"] > 0.5),
                       key=lambda x: -(x[1]["e"] - x[1]["r"]))
    # ── EL MES TIENE QUE DECIR LO MISMO QUE EL CUADRO DE ARRIBA ──────────────
    #
    # Daniel, 03-sep-2026: *"en el mes a mes, el 26 del cuatro dice que falta 160
    # mil: necesito darle clic y ver que es lo que esta faltando"*. Ese 160.773 es
    # el NETO de abril -enviado menos recibido- del cuadro "meses", que es el que
    # el esta mirando cuando lo dice.
    #
    # Sumando solo los faltantes se obtiene 187.691, porque deja fuera los 26.918
    # que llegaron DE MAS. Dos filas pegadas diciendo 160 mil y 187 mil del mismo
    # abril es exactamente lo que el detecta con la calculadora, y con razon: no
    # hay forma de saber cual de las dos es la buena.
    #
    # Asi que el mes publica las tres, y las tres cierran entre si:
    #
    #     falta (neto)  =  faltaBruta  -  sobra
    #     160.773       =  187.691     -  26.918
    #
    # `falta` es la que cuadra con el cuadro de arriba y con el de marcas.
    por_mes = {}
    for m in sorted(por_mes_art):
        todos = list(por_mes_art[m].items())
        arts = [(c, v) for c, v in todos if v[0] - v[1] > 0.5]
        if not arts:
            continue
        arts.sort(key=lambda x: -(x[1][0] - x[1][1]))
        bruta = sum(v[0] - v[1] for _, v in arts)
        sobra = sum(v[1] - v[0] for _, v in todos if v[1] - v[0] > 0.5)
        por_mes[m] = {
            "articulos": len(arts),
            "falta": round(bruta - sobra),
            "faltaBruta": round(bruta),
            "sobra": round(sobra),
            "sobraArticulos": sum(1 for _, v in todos if v[1] - v[0] > 0.5),
            "top": [{"cod": c, "desc": art[c]["d"], "marca": art[c]["m"],
                     "env": round(v[0]), "rec": round(v[1]), "falta": round(v[0] - v[1])}
                    for c, v in arts[:TOPE_POR_MES]],
        }

    paquete = {
        "generado": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "archivos": archivos,
        "totales": {
            "lineas": sum(c["lineas"] for c in clase.values()),
            "asn": len(asn_env),
            "enviado": sum(c["env"] for c in clase.values()),
            "recibido": sum(c["rec"] for c in clase.values()),
        },
        "clase": {k: {"lineas": v["lineas"], "enviado": v["env"], "recibido": v["rec"]}
                  for k, v in clase.items()},
        "meses": [{"mes": m, "enviado": d["env"], "recibido": d["rec"]}
                  for m, d in sorted(mes.items())],
        "recepciones": [{"mes": m, "unidades": d["unid"], "asn": len(d["asn"]),
                         "lineas": d["lineas"]}
                        for m, d in sorted(recep.items())],
        "recibido_sin_fecha": sin_fecha_rec,
        "estados": sorted(
            [{"estado": k, "asn": len(v["asn"]), "enviado": v["env"], "recibido": v["rec"]}
             for k, v in estado.items()],
            key=lambda x: -x["enviado"]),
        "cumplimiento": cumpl,
        # LOS PARCIALES, TODOS. Antes se publicaban 60 de 122 y Daniel pidio un
        # filtro sobre ellos: filtrar la mitad de la lista no sirve. Son chicos
        # -18 KB los 139- y son justo los que hay que perseguir.
        "parciales": parciales,
        "parciales_total": len(parciales),
        "parciales_falta": sum(p["falta"] for p in parciales),

        # ── EL DETALLE ────────────────────────────────────────────────────────
        #
        # LOS TOPES SALEN DE UNA MEDICION. Son 23.533 articulos distintos y 11.307
        # con algo pendiente: publicarlos todos son 1.117 KB al navegador, y eso
        # es lo que ya hizo lenta la web una vez. Cortando por los que mas faltan,
        # 500 articulos + 50 por mes + las 13 marcas dan 183 KB, que Daniel aprobo
        # mirando la maqueta.
        #
        # LA PANTALLA DICE SIEMPRE CUANTOS QUEDARON FUERA. Una tabla recortada que
        # no avisa se lee como la lista completa.
        "articulosDistintos": len(art),
        "articulosConFalta": len(con_falta),
        "articulos": [{
            "cod": c, "desc": v["d"], "marca": v["m"], "gender": v["g"],
            "env": round(v["e"]), "rec": round(v["r"]),
            "falta": round(v["e"] - v["r"]), "lineas": v["n"],
        } for c, v in con_falta[:TOPE_ARTICULOS]],
        "marcas": sorted([{
            "marca": m, "env": round(v["e"]), "rec": round(v["r"]),
            "falta": round(v["e"] - v["r"]), "lineas": v["n"],
            "cumple": round(100.0 * v["r"] / v["e"], 1) if v["e"] else 0,
        } for m, v in marca.items()], key=lambda x: -x["env"]),
        "porMes": por_mes,
    }
    return paquete


def subir(paquete, intentos=3):
    """Sube el paquete a PRODUCCION Y A BETA.

    ANTES SOLO IBA A PRODUCCION, y por eso beta decia "todavia no hay ASN
    publicado" — Daniel, 03-sep-2026: *"no veo nada"*. No era que el robot
    fallara: es que nunca le habia mandado nada a beta, asi que no habia forma de
    probar ningun cambio de esta pantalla antes de soltarlo a produccion.

    Se usa `publicar_area.publicar`, que es el que ya sabe mandar a los dos y que
    usan los demas robots. Escribirlo otra vez aca es como se separan las dos
    verdades.

    VA CON `date=MASTER`, y no es opcional: el area guarda un OBJETO y no filas
    sueltas. Sin ese parametro el servidor responde 200 igual y lo guarda como
    lista vacia — la pantalla queda en blanco y nada avisa.
    """
    from publicar_area import publicar
    return publicar(AREA, paquete, "MASTER",
                    log=lambda t, n="INFO": log(t, n), intentos=intentos)


def main(log_externo=None):
    global _LOG_EXTERNO
    if log_externo:
        _LOG_EXTERNO = log_externo
    log("=" * 58)
    log("RESUMEN DEL ASN PARA LA WEB")
    log("=" * 58)
    rutas()
    if not os.path.isdir(CARPETA_ASN):
        log("no existe la carpeta %s" % CARPETA_ASN, "ERROR")
        return 2
    p = construir()
    t = p["totales"]
    log("%s lineas · %s ASN · enviado %s · recibido %s"
        % ("{:,}".format(t["lineas"]), "{:,}".format(t["asn"]),
           "{:,.0f}".format(t["enviado"]), "{:,.0f}".format(t["recibido"])))
    if p.get("recepciones"):
        log("recepciones: %d meses con fecha; %s unidades sin fecha de recepcion"
            % (len(p["recepciones"]), "{:,.0f}".format(p["recibido_sin_fecha"]["unid"])))
    else:
        log("los archivos todavia no traen la fecha de recepcion", "WARN")
    log("parciales: %s ASN, faltan %s unidades"
        % ("{:,}".format(p["parciales_total"]), "{:,.0f}".format(p["parciales_falta"])))
    if "--solo-calcular" in sys.argv:
        destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "asn_resumen.json")
        with open(destino, "w", encoding="utf-8") as f:
            json.dump(p, f, ensure_ascii=False, indent=1)
        log("guardado en %s (no se publico)" % destino)
        return 0
    return 0 if subir(p) else 3


if __name__ == "__main__":
    sys.exit(main())
