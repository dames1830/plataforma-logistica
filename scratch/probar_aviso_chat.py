# -*- coding: utf-8 -*-
"""
EL AVISO DEL CHAT AL CELULAR, PROBADO SIN MANDAR NINGUNO.

El 16-sep-2026 el chat no avisaba al telefono de Daniel y no habia forma de saber por que:
el envio solo dejaba un `print` en el log de Render. Ahora deja constancia en `push_ultimo`,
y esto comprueba que esa constancia dice la verdad en los tres casos que importan.

`pywebpush` se cambia por uno de mentira -la funcion lo importa por dentro, asi que basta con
ponerlo en sys.modules-: no sale ningun aviso de verdad y se pueden forzar los rechazos.

    python scratch/probar_aviso_chat.py
"""
import datetime
import json
import os
import sqlite3
import sys
import tempfile
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "backend"))

fallos = []


def chk(cond, texto):
    print(("OK    " if cond else "FALLA ") + texto)
    if not cond:
        fallos.append(texto)


# ── El pywebpush de mentira ──────────────────────────────────────────────────────────────
class WebPushException(Exception):
    def __init__(self, msg, codigo=0):
        super().__init__(msg)
        self.response = types.SimpleNamespace(status_code=codigo)


_comportamiento = {"modo": "ok"}


def webpush(**kw):
    if _comportamiento["modo"] == "410":
        raise WebPushException("gone", 410)
    if _comportamiento["modo"] == "boom":
        raise RuntimeError("se cayo la red")
    return True


falso = types.ModuleType("pywebpush")
falso.webpush = webpush
falso.WebPushException = WebPushException
sys.modules["pywebpush"] = falso

import avisos_chat  # noqa: E402


# ── Una base de juguete con una sala y un telefono ───────────────────────────────────────
def base_de_juguete():
    ruta = os.path.join(tempfile.mkdtemp(), "prueba.db")
    conn = sqlite3.connect(ruta)
    conn.execute("CREATE TABLE logistics_snapshots (area_id TEXT, snapshot_date TEXT, "
                 "data_json TEXT, updated_at TEXT, PRIMARY KEY (area_id, snapshot_date))")
    poner = lambda area, datos: conn.execute(
        "INSERT INTO logistics_snapshots VALUES (?,?,?,?)",
        (area, "MASTER", json.dumps(datos, ensure_ascii=False), "x"))
    poner("chat_salas", [{"id": "du_Prueba__dames", "tipo": "directa",
                          "miembros": ["dames", "Prueba"]}])
    poner("users", [{"username": "dames", "name": "DANIEL AMES"}])
    poner("push_suscripciones", [{"id": "dames|telefono1", "usuario": "dames",
                                  "endpoint": "https://fcm.googleapis.com/x",
                                  "claves": {"p256dh": "a", "auth": "b"}}])
    conn.commit()
    conn.close()
    return ruta


def ultimo(ruta):
    conn = sqlite3.connect(ruta)
    f = conn.execute("SELECT data_json FROM logistics_snapshots WHERE area_id='push_ultimo'").fetchone()
    conn.close()
    return json.loads(f[0])[0] if f else None


MSG = {"id": "m1", "de": "Prueba", "texto": "hola", "cuando": "2026-09-16T02:00:00"}
os.environ["VAPID_PRIVADA"] = "llave-de-mentira"

print("\nEL AVISO DEL CHAT AL CELULAR")
print("-" * 76)

# 1. Todo bien: sale
_comportamiento["modo"] = "ok"
ruta = base_de_juguete()
n = avisos_chat.avisar_del_mensaje(ruta, "chat_du_Prueba__dames", MSG)
u = ultimo(ruta)
chk(n == 1, "con todo en orden, sale a 1 telefono (salio a %s)" % n)
chk(u and u.get("enviados") == 1, "y queda anotado: %s" % (u or {}).get("resumen"))
chk(u and u.get("para") == ["dames"], "anota a quien iba: %s" % (u or {}).get("para"))
chk(u and u.get("de") == "Prueba", "y de parte de quien: %s" % (u or {}).get("de"))

# 2. El telefono ya no existe: 410
_comportamiento["modo"] = "410"
ruta = base_de_juguete()
n = avisos_chat.avisar_del_mensaje(ruta, "chat_du_Prueba__dames", MSG)
u = ultimo(ruta)
chk(n == 0, "si el telefono ya no existe, no sale ninguno")
d = (u or {}).get("detalle") or [{}]
chk(d[0].get("codigo") == 410, "y queda anotado el codigo: %s" % d[0].get("codigo"))
chk("volver a activar los avisos" in (d[0].get("significa") or ""),
    "explicado en castellano: \"%s\"" % d[0].get("significa"))
chk((u or {}).get("resumen") == "ninguno lo acepto", "resumen: %s" % (u or {}).get("resumen"))

# 3. Nadie suscrito
_comportamiento["modo"] = "ok"
ruta = base_de_juguete()
conn = sqlite3.connect(ruta)
conn.execute("UPDATE logistics_snapshots SET data_json='[]' WHERE area_id='push_suscripciones'")
conn.commit(); conn.close()
avisos_chat.avisar_del_mensaje(ruta, "chat_du_Prueba__dames", MSG)
u = ultimo(ruta)
chk((u or {}).get("resumen") == "nadie tiene avisos activados",
    "sin nadie suscrito lo dice: %s" % (u or {}).get("resumen"))

# 4. La seña del robot de archivado NO despierta a nadie
_comportamiento["modo"] = "ok"
ruta = base_de_juguete()
n = avisos_chat.avisar_del_mensaje(ruta, "chat_du_Prueba__dames",
                                   {"id": "m2", "de": "", "aviso": True, "texto": "archivado"})
chk(n == 0, "la seña del robot de archivado sigue sin avisar a nadie")

# 5. El rastro no crece: siempre UN registro
_comportamiento["modo"] = "ok"
ruta = base_de_juguete()
for i in range(4):
    avisos_chat.avisar_del_mensaje(ruta, "chat_du_Prueba__dames", dict(MSG, id="m%d" % i))
conn = sqlite3.connect(ruta)
cuantos = len(json.loads(conn.execute(
    "SELECT data_json FROM logistics_snapshots WHERE area_id='push_ultimo'").fetchone()[0]))
conn.close()
chk(cuantos == 1, "tras 4 avisos el rastro sigue siendo UN registro (hay %d)" % cuantos)

print("-" * 76)
print("TODO BIEN" if not fallos else "FALLARON %d" % len(fallos))
sys.exit(1 if fallos else 0)
