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
    """Los codigos que son calzado, por la columna `G. Gender`."""
    from openpyxl import load_workbook
    wb = load_workbook(MAESTRO, read_only=True, data_only=True)
    h = wb[wb.sheetnames[0]]
    it = h.iter_rows(values_only=True)
    enc = [str(c).strip() if c is not None else "" for c in next(it)]
    iC, iG = enc.index("CodArticulo"), enc.index("G. Gender")
    calzado = set()
    total = 0
    for f in it:
        if iC >= len(f) or f[iC] is None:
            continue
        total += 1
        if iG < len(f) and f[iG] and str(f[iG]).strip() == "Footwear":
            calzado.add(str(f[iC]).strip().lstrip("0"))
    wb.close()
    log("Maestro: %s articulos, %s de calzado" % ("{:,}".format(total), "{:,}".format(len(calzado))))
    return calzado


def construir():
    from openpyxl import load_workbook
    calzado = leer_maestro()

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
        "parciales": parciales[:60],
        "parciales_total": len(parciales),
        "parciales_falta": sum(p["falta"] for p in parciales),
    }
    return paquete


def subir(paquete, intentos=3):
    """VA CON `?date=MASTER`, y no es opcional: el area guarda un OBJETO, no filas
    sueltas. Sin ese parametro el servidor responde 200 igual y lo guarda como
    lista vacia -la pantalla queda en blanco y nada avisa-."""
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
            log("intento %d/%d fallo: %s" % (i, intentos, str(e)[:140]), "WARN")
            time.sleep(5 * i)
    return False


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
