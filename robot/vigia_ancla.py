# -*- coding: utf-8 -*-
"""VIGIA DEL ANCLA: avisa cuando el stock NO se publicó.

Daniel, 29-ago-2026, después de una mañana entera sin stock y con el Log mudo:
*"un vigía que revise a las 08:00 si el ancla publicó, y que avise cuando NO hay dato"*.

POR QUÉ HACE FALTA, Y POR QUÉ ES UN SCRIPT APARTE:

  `avisar_log.py` cuenta cómo le fue a la corrida, pero corre DESPUÉS del robot. El
  29-ago el robot no arrancó siquiera —el Programador rechazaba todas las tareas
  `Interactive`— y entonces nadie avisó nada. El silencio se confundió con "todo bien"
  y Daniel se enteró mirando Zona Buffer a las 09:00.

  Un robot que no arranca no puede avisar que no arrancó. Por eso este vigía:

    - NO depende del robot: le pregunta a la plataforma si el dato llegó.
    - NO toca el WMS, ni Excel, ni OneDrive. Solo una llamada de 3 KB.
    - Corre como SYSTEM, que es el ÚNICO tipo de tarea que sobrevivió al fallo del
      29-ago. Si hubiera sido `Interactive`, se habría callado igual que el robot.

  Y avisa SIEMPRE, salga bien o mal. Si solo hablara cuando algo falla, un vigía muerto
  y un almacén sano se verían exactamente igual: en silencio.

Uso:

    python vigia_ancla.py manana      # revisa el ancla de las 07:00
    python vigia_ancla.py noche       # revisa la de las 19:00
    python vigia_ancla.py manana --solo-ver    # no manda nada, solo imprime

Nunca devuelve error: si el vigía se rompe, no puede tumbar nada.
"""
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime

BASE = os.environ.get("API_BASE", "https://logistics-backend-wv0x.onrender.com")
VERSIONES = BASE + "/api/sync/versiones"
EVENTOS = BASE + "/api/eventos"
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")
REGISTRO = os.path.join(os.environ.get("WMS_LOGS", r"C:\wms_scraping\logs"), "vigia.log")

# WhatsApp por CallMeBot. Las dos variables se ponen a mano en el servidor, como
# variables de MAQUINA, porque las tareas corren como SYSTEM y no ven las del usuario.
# Si faltan, el vigia sigue funcionando igual: avisa al Log y no manda WhatsApp.
CALLMEBOT = "https://api.callmebot.com/whatsapp.php"
WA_KEY = os.environ.get("CALLMEBOT_KEY", "")
WA_TEL = os.environ.get("CALLMEBOT_TEL", "")

# Las áreas que el ancla reescribe SIEMPRE que corre, una por cada archivo que baja.
# Se miran las dos y no una sola: el 28-ago bajó el Stock Activo pero no la Reserva, y
# mirar solo `almacenaje_activo` habría dado "todo bien" con media corrida.
AREAS = {
    "almacenaje_activo": "el stock del piso",
    "analisis_sku_reserva": "el stock de reserva",
}

# `tabla_tallas` NO va acá. El robot la republica solo cuando cambió —"Tabla de tallas sin
# novedades: 24,726 SKU, no se vuelve a publicar"—, así que un día normal queda con la
# fecha del día anterior. Exigirla dio una falsa alarma el 30-ago, con la corrida perfecta.
# Un vigía que grita en falso se termina ignorando, que es justo lo que vino a evitar.

ANCLAS = {
    "manana": {"hora": 7, "nombre": "ancla_manana", "texto": "de las 07:00"},
    "noche": {"hora": 19, "nombre": "ancla_noche", "texto": "de las 19:00"},
}


def anotar(linea):
    """Deja rastro en el disco del servidor. Si la plataforma no contesta, este archivo
    es lo único que queda para saber que el vigía sí corrió."""
    sello = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(linea)
    try:
        with io.open(REGISTRO, "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (sello, linea))
    except Exception:
        pass


def leer_versiones():
    p = urllib.request.Request(VERSIONES, headers={"Accept": "application/json"})
    with urllib.request.urlopen(p, timeout=60) as r:
        return json.loads(r.read().decode("utf-8")).get("versiones", {})


def revisar(turno):
    """Devuelve (todo_bien, lista_de_hallazgos). Un hallazgo por área que falta."""
    cfg = ANCLAS[turno]
    ahora = datetime.now()
    limite = ahora.replace(hour=cfg["hora"], minute=0, second=0, microsecond=0)

    try:
        versiones = leer_versiones()
    except Exception as e:
        return False, [("SIN RESPUESTA", "la plataforma no contesta: %s" % type(e).__name__)]

    malas = []
    for area, comose_llama in AREAS.items():
        sello = versiones.get(area)
        if not sello:
            malas.append((comose_llama, "el área %s no existe en la plataforma" % area))
            continue
        try:
            f = datetime.strptime(str(sello)[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            malas.append((comose_llama, "fecha ilegible: %s" % sello))
            continue
        if f < limite:
            horas = (ahora - f).total_seconds() / 3600.0
            malas.append((comose_llama,
                          "última vez %s, hace %.1f horas" % (f.strftime("%d/%m %H:%M"), horas)))
    return (len(malas) == 0), malas


def whatsapp(texto):
    """Le escribe a Daniel al celular. Devuelve un texto corto para el registro.

    El mensaje lleva SOLO estados y numeros: nunca la clave del WMS ni datos de stock.
    El texto pasa por el servidor de CallMeBot, que es un tercero gratuito.
    """
    if not (WA_KEY and WA_TEL):
        return "sin WhatsApp (faltan CALLMEBOT_KEY o CALLMEBOT_TEL)"
    url = "%s?%s" % (CALLMEBOT, urllib.parse.urlencode(
        {"phone": WA_TEL, "text": texto[:350], "apikey": WA_KEY}))
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            cuerpo = r.read().decode("utf-8", "replace")
    except Exception as e:
        # Nunca revienta: si CallMeBot esta caido, el aviso del Log ya salio igual.
        return "WhatsApp NO salio: %s" % type(e).__name__

    # EL CODIGO HTTP NO ALCANZA. Con una apikey invalida CallMeBot contesta 203 y mete el
    # motivo en el HTML: "APIKey is invalid". Mirando solo el codigo, el 29-ago di por
    # enviado un mensaje que nunca salio. El exito de verdad dice "Message queued".
    limpio = re.sub("<[^>]+>", " ", cuerpo)
    limpio = " ".join(limpio.split())
    if "queued" in limpio.lower():
        return "WhatsApp enviado"
    # La clave no se registra nunca; el cuerpo que devuelve CallMeBot no la trae.
    return "WhatsApp RECHAZADO: %s" % limpio[:160]


def avisar(eventos):
    cuerpo = json.dumps(eventos, ensure_ascii=False).encode("utf-8")
    p = urllib.request.Request(EVENTOS, data=cuerpo, method="POST",
                               headers={"Content-Type": "application/json"})
    if ROBOT_TOKEN:
        p.add_header("X-Robot-Token", ROBOT_TOKEN)
    with urllib.request.urlopen(p, timeout=30) as r:
        return r.status


def main():
    turno = "manana"
    for a in sys.argv[1:]:
        if a in ANCLAS:
            turno = a
    cfg = ANCLAS[turno]

    bien, malas = revisar(turno)

    if bien:
        ev = [{"origen": "robot", "quien": "vigia_" + turno, "tipo": "ok",
               "accion": "El stock %s se publicó" % cfg["texto"],
               "detalle": "las 2 áreas del ancla están al día"}]
        wa = "Stock %s OK. Piso y reserva publicados." % cfg["texto"]
        anotar("[%s] OK - las 2 areas al dia" % turno)
    else:
        detalle = " · ".join("%s: %s" % (q, p) for q, p in malas)
        ev = [{"origen": "robot", "quien": "vigia_" + turno, "tipo": "error",
               "accion": "NO se publicó el stock %s" % cfg["texto"],
               "detalle": detalle[:400]}]
        wa = "FALTA el stock %s. %s" % (cfg["texto"], detalle)
        anotar("[%s] FALTA - %s" % (turno, detalle))

    if "--solo-ver" in sys.argv:
        print(json.dumps(ev, ensure_ascii=False, indent=1))
        print("WhatsApp que se mandaria: %s" % wa)
        print("(sin enviar)")
        return 0

    try:
        anotar("aviso enviado: %s" % avisar(ev))
    except Exception as e:
        anotar("NO se pudo avisar a la plataforma: %s: %s" % (type(e).__name__, str(e)[:120]))

    # El WhatsApp va DESPUES del Log, y a proposito: si CallMeBot esta caido —es un
    # servicio gratuito de terceros—, el aviso de la plataforma ya quedo guardado.
    # Con `--solo-fallas` solo escribe cuando algo falta, por si los OK diarios molestan.
    if bien and "--solo-fallas" in sys.argv:
        anotar("WhatsApp omitido (--solo-fallas y esta todo bien)")
    else:
        anotar(whatsapp(wa))
    return 0


if __name__ == "__main__":
    sys.exit(main())
