# -*- coding: utf-8 -*-
"""
================================================================================
 EL PARTE DEL CIERRE  -  que bajo y que no, al Log y por WhatsApp
================================================================================

Daniel, 06-sep-2026: *"me debería llegar el mensaje, dos mensajes por día, uno de
las siete de la mañana y otro de las siete de la noche, donde me diga: corrida de
interfaces, cambio de turno. Primera línea picking visto bueno —que significa
corrido—, embalaje visto bueno, todo lo que se... los archivos que se descargaron
visto bueno, y el que no se descargó, pues que le ponga una x"*.

EL CASO QUE LO MOTIVO. El sabado 05-sep el Detalle de Orden no bajo, y la cadena
siguio de largo publicando dos cuadros incompletos. Nadie aviso. Se supo el lunes
de madrugada porque Daniel pregunto.

--------------------------------------------------------------------------------
 POR QUE MIRA EL RESULTADO Y NO INSTRUMENTA CADA ROBOT
--------------------------------------------------------------------------------
Es la misma razon que hizo nacer a `avisar_log.py`: **cuando un paso falla, el
robot que lo ejecuta se rinde**, y un aviso metido adentro se calla justo el dia
que hace falta. Este corre DESPUES, aparte, y mira lo que quedo:

    el archivo esta en disco y con cuantas filas   ->  se bajo
    el area esta publicada despues del corte       ->  se publico

Las dos cosas, no una: el 28-ago bajo el Stock Activo pero no la Reserva, y mirar
una sola habria dado "todo bien" con media corrida.

--------------------------------------------------------------------------------
 LO QUE SE MIRA
--------------------------------------------------------------------------------
 SEIS: los CINCO ARCHIVOS del cierre -Stock Activo, Stock Reserva, Picking,
OBLPN Embalaje y Detalle Orden del dia- mas el Slotting.

La RECEPCION no entra: el cierre corre `corte_turno.py --sin-recepcion` y el ASN
va en su propia tarea de las 02:30. Una X que sale todos los dias no avisa de
nada y ensena a no mirar el mensaje.

--------------------------------------------------------------------------------
 USO
--------------------------------------------------------------------------------
    python resumen_turno.py            el turno sale del reloj
    python resumen_turno.py noche      fuerza el cierre de las 19:00
    python resumen_turno.py manana     fuerza el de las 07:00
    python resumen_turno.py --solo-ver muestra el parte sin mandar nada

NUNCA DEVUELVE ERROR NI SE CAE. Si el Log no contesta o WhatsApp esta caido, el
cierre ya esta hecho: esto solo lo cuenta.
"""

import io
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

# LA CONSOLA DE WINDOWS NO ESCRIBE EMOJI si no se le pide. Sin esto el parte
# revienta con UnicodeEncodeError al imprimir el primer visto bueno, y el mensaje
# nunca sale. Se arregla aca y no en el .bat, para que valga lo ejecute quien lo
# ejecute.
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE = "https://logistics-backend-wv0x.onrender.com"
VERSIONES = BASE + "/api/sync/versiones"
EVENTOS = BASE + "/api/eventos"
ROBOT_TOKEN = os.environ.get("ROBOT_TOKEN", "")

# WhatsApp por CallMeBot, igual que el vigia. Las dos variables se ponen a mano en
# el servidor, como variables de MAQUINA: las tareas corren como SYSTEM y no ven
# las del usuario. Si faltan, el parte igual queda en el Log.
CALLMEBOT = "https://api.callmebot.com/whatsapp.php"
WA_KEY = os.environ.get("CALLMEBOT_KEY", "")
WA_TEL = os.environ.get("CALLMEBOT_TEL", "")
TOPE_WA = 350                      # lo que admite CallMeBot de una

AQUI = os.path.dirname(os.path.abspath(__file__))

CIERRES = {
    "noche":  {"hora": 19, "titulo": "CIERRE TURNO DIA"},
    "manana": {"hora": 7,  "titulo": "CIERRE TURNO NOCHE"},
}


def base_onedrive():
    """Corriendo como tarea el usuario no siempre es el mismo, asi que las rutas
       fijas van tambien. Igual que en oblpn_embalaje.py."""
    for c in (os.environ.get("OneDrive"), os.environ.get("OneDriveCommercial"),
              os.path.join(os.path.expanduser("~"), "OneDrive"),
              os.path.join("C:", os.sep, "Users", "Administrator", "OneDrive"),
              os.path.join("C:", os.sep, "Users", "dames", "OneDrive")):
        if not c:
            continue
        r = os.path.join(c, "danielames.bata")
        if os.path.isdir(r):
            return r
    return None


def filas(ruta):
    """Cuantas filas trae, sin la cabecera. Devuelve None si no se puede leer.

       SE CUENTAN FILAS Y NO BYTES, por lo mismo que en picking_y_orden.py: un dia
       flojo pesa poco y esta completo."""
    try:
        n = 0
        with io.open(ruta, encoding="utf-8-sig", errors="replace") as fh:
            for _ in fh:
                n += 1
        return max(0, n - 1)
    except OSError:
        return None


def leer_versiones():
    try:
        p = urllib.request.Request(VERSIONES, headers={"Accept": "application/json"})
        with urllib.request.urlopen(p, timeout=60) as r:
            return json.loads(r.read().decode("utf-8")).get("versiones", {})
    except Exception:
        return None


def publicada_despues(versiones, area, limite):
    """True si esa area se publico despues del corte. None si no se pudo saber."""
    if versiones is None:
        return None
    sello = versiones.get(area)
    if not sello:
        return False
    try:
        return datetime.strptime(str(sello)[:19], "%Y-%m-%d %H:%M:%S") >= limite
    except ValueError:
        return False


def revisar(turno, cuando=None):
    """Devuelve la lista de pasos: (nombre, ok, detalle)."""
    cfg = CIERRES[turno]
    ahora = cuando or datetime.now()
    limite = ahora.replace(hour=cfg["hora"], minute=0, second=0, microsecond=0)
    # EL CIERRE DE LA MANANA MIRA DESDE LAS 07:00 DE HOY; el de la noche, desde las
    # 19:00 de hoy. Si el parte sale antes de esa hora -una corrida a mano-, se
    # toma el corte del dia anterior para no exigir lo que todavia no paso.
    if limite > ahora:
        limite = limite - timedelta(days=1)

    base = base_onedrive()
    ss = os.path.join(base, "scraping Stock") if base else None
    ver = leer_versiones()
    # LOS ARCHIVOS SON LOS DEL DIA DEL CORTE, NO LOS DE HOY. El parte de las 19:42
    # y el que se corre a las 02:19 hablan del mismo cierre: el del 5, no el del 6.
    d, m, a2 = limite.day, limite.month, limite.strftime("%y")
    pasos = []

    def area(nombre, clave):
        ok = publicada_despues(ver, clave, limite)
        pasos.append((nombre, bool(ok),
                      "no contesta la plataforma" if ok is None
                      else ("publicado" if ok else "no se publicó desde el corte")))

    def archivo(nombre, ruta, area_clave=None):
        """El archivo Y su area: uno de los dos puede fallar solo."""
        if not ruta or not os.path.exists(ruta):
            pasos.append((nombre, False, "no bajó el archivo"))
            return
        n = filas(ruta)
        pub = publicada_despues(ver, area_clave, limite) if area_clave else True
        detalle = "%s filas" % format(n, ",d") if n is not None else "sin leer"
        if area_clave and not pub:
            pasos.append((nombre, False, detalle + ", pero el cuadro no se publicó"))
        else:
            pasos.append((nombre, True, detalle))

    area("Stock activo", "almacenaje_activo")
    area("Stock reserva", "analisis_sku_reserva")

    if ss:
        slot = os.path.join(ss, "Slotting", "Slotting %02d-%02d-%s.xlsx" % (d, m, a2))
        pasos.append(("Slotting", os.path.exists(slot),
                      "armado" if os.path.exists(slot) else "no se armó"))
        archivo("Picking", os.path.join(ss, "Picking", "Picking %d-%d.csv" % (d, m)),
                "picking_por_hora")
        archivo("OBLPN embalaje",
                os.path.join(ss, "OBLPN Embalaje", "OBLPN %02d-%02d.csv" % (d, m)),
                "embalaje_por_hora")
        archivo("Detalle Orden",
                os.path.join(ss, "Detalle Orden", "Detalle Orden %02d-%02d.csv" % (d, m)))
    else:
        for n in ("Slotting", "Picking", "OBLPN embalaje", "Detalle Orden"):
            pasos.append((n, False, "no encuentro la carpeta de OneDrive"))

    # LA RECEPCION NO VA. El cierre corre `corte_turno.py --sin-recepcion`: el ASN
    # tiene su propia tarea a las 02:30. Ponerla aca seria una X todos los dias.
    return pasos


def parte(turno, pasos, ahora=None):
    """El mensaje, tal cual sale al celular. Corto a proposito: CallMeBot admite
       350 y en el telefono se lee de un vistazo."""
    ahora = ahora or datetime.now()
    buenos = sum(1 for _, ok, _ in pasos if ok)
    lineas = ["%s · %s" % (CIERRES[turno]["titulo"], ahora.strftime("%d-%m %H:%M"))]
    for nombre, ok, detalle in pasos:
        # El numero solo cuando aporta: "Picking 5.621" dice mas que "Picking OK".
        n = detalle.replace(" filas", "") if ok and detalle.endswith("filas") else ""
        lineas.append("%s %s%s" % ("✅" if ok else "❌", nombre,
                                   (" " + n) if n else ""))
    lineas.append("%d de %d" % (buenos, len(pasos)))
    # LO QUE FALLO SE EXPLICA. Un ❌ sin motivo obliga a entrar al servidor.
    malos = [f"{n}: {d}" for n, ok, d in pasos if not ok]
    if malos:
        lineas.append("· " + " · ".join(malos))
    return "\n".join(lineas)[:TOPE_WA]


def whatsapp(texto):
    if not (WA_KEY and WA_TEL):
        return "sin WhatsApp (faltan CALLMEBOT_KEY o CALLMEBOT_TEL)"
    url = "%s?%s" % (CALLMEBOT, urllib.parse.urlencode(
        {"phone": WA_TEL, "text": texto[:TOPE_WA], "apikey": WA_KEY}))
    try:
        with urllib.request.urlopen(url, timeout=40) as r:
            cuerpo = r.read().decode("utf-8", "replace")
    except Exception as e:
        return "WhatsApp NO salió: %s" % type(e).__name__
    # EL CODIGO HTTP NO ALCANZA: con una apikey mala CallMeBot contesta 203 y mete
    # el motivo en el HTML. Lo aprendio el vigia el 29-ago.
    limpio = " ".join(cuerpo.split())
    if "queued" in limpio.lower() or "sent" in limpio.lower():
        return "WhatsApp enviado"
    return "WhatsApp RECHAZADO: %s" % limpio[:140]


def avisar_log(turno, pasos):
    buenos = sum(1 for _, ok, _ in pasos if ok)
    malos = [n for n, ok, _ in pasos if not ok]
    ev = [{
        "origen": "robot",
        "quien": "cierre_" + turno,
        "tipo": "ok" if not malos else "error",
        "accion": ("%s completo: %d de %d" % (CIERRES[turno]["titulo"], buenos, len(pasos)))
                  if not malos else
                  ("%s incompleto: falta %s" % (CIERRES[turno]["titulo"], ", ".join(malos))),
        "detalle": " · ".join("%s %s (%s)" % ("OK" if ok else "FALLO", n, d)
                              for n, ok, d in pasos)[:400],
    }]
    try:
        cuerpo = json.dumps(ev, ensure_ascii=False).encode("utf-8")
        p = urllib.request.Request(EVENTOS, data=cuerpo, method="POST",
                                   headers={"Content-Type": "application/json"})
        if ROBOT_TOKEN:
            p.add_header("X-Robot-Token", ROBOT_TOKEN)
        with urllib.request.urlopen(p, timeout=30) as r:
            return "Log avisado (%s)" % r.status
    except Exception as e:
        return "el Log no contestó: %s" % type(e).__name__


def main():
    # EL TURNO SALE DEL RELOJ. `ejecutar_robot_wms.bat` es el mismo a las 07:00 y
    # a las 19:00, asi que no puede pasar la bandera: antes de mediodia informa
    # del cierre de la noche, despues del cierre del dia.
    turno = "manana" if datetime.now().hour < 12 else "noche"
    for a in sys.argv[1:]:
        if a in CIERRES:
            turno = a
    pasos = revisar(turno)
    texto = parte(turno, pasos)

    print(texto)
    print()
    if "--solo-ver" in sys.argv:
        print("(--solo-ver: no se manda nada)")
        return 0
    print(avisar_log(turno, pasos))
    print(whatsapp(texto))
    return 0


if __name__ == "__main__":
    # NUNCA TUMBA NADA. El cierre ya esta hecho; esto solo lo cuenta.
    try:
        sys.exit(main())
    except Exception as e:
        print("el parte falló: %s: %s" % (type(e).__name__, e))
        sys.exit(0)
