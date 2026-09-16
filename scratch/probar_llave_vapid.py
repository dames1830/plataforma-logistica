# -*- coding: utf-8 -*-
"""
LA LLAVE DE LOS AVISOS, VENGA COMO VENGA.

El 16-sep-2026 el aviso al celular de Daniel moria con "Could not deserialize key data". La
llave ESTABA puesta en Render -el chequeo decia `puede_avisar: true`- pero en formato PEM, que
es como la deja el generador, y `py_vapid.from_string()` no lo acepta.

Esto genera llaves de verdad y comprueba que `_llave_usable()` las deja utilizables en todos
los formatos en que se pueden haber guardado. No manda ningun aviso.

    python scratch/probar_llave_vapid.py

Si falta la libreria, se instala aparte sin tocar el Python del sistema:
    python -m pip install --target scratch/_libs pywebpush
"""
import base64
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "_libs"))
sys.path.insert(0, os.path.join(AQUI, "..", "backend"))

try:
    from py_vapid import Vapid01 as Vapid
    from cryptography.hazmat.primitives import serialization
except ImportError:
    print("Falta py_vapid. Instalalo aparte:")
    print("    python -m pip install --target scratch/_libs pywebpush")
    sys.exit(0)

import avisos_chat  # noqa: E402

fallos = []


def chk(cond, texto):
    print(("OK    " if cond else "FALLA ") + texto)
    if not cond:
        fallos.append(texto)


# Una llave de verdad, generada aca. No es la de produccion.
v = Vapid()
v.generate_keys()
pem = v.private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()).decode()
crudo = v.private_key.private_numbers().private_value.to_bytes(32, "big")
b64url = base64.urlsafe_b64encode(crudo).decode().rstrip("=")
ESC = chr(92) + "n"

FORMAS = [
    ("base64url crudo, como lo guarda el robot", b64url),
    ("base64 estandar (con mas y barras)", base64.b64encode(crudo).decode()),
    ("PEM entero, como lo deja el generador", pem),
    ("PEM con los saltos escritos, como al pegarlo en un panel web", pem.replace("\n", ESC)),
    ("con espacios de sobra alrededor", "   " + b64url + "  \n"),
    ("entre comillas, como al copiar de un .env", '"' + b64url + '"'),
]

print("\nLA LLAVE DE LOS AVISOS, VENGA COMO VENGA")
print("-" * 78)

for nombre, valor in FORMAS:
    os.environ["VAPID_PRIVADA"] = valor
    usable = avisos_chat._llave_usable()
    try:
        Vapid.from_string(usable)
        sirve = True
    except Exception:
        sirve = False
    chk(sirve, "%-58s -> %s" % (nombre, "sirve" if sirve else "NO sirve"))
    if sirve:
        # Y tiene que ser LA MISMA llave, no otra cualquiera.
        misma = Vapid.from_string(usable).private_key.private_numbers().private_value == \
            v.private_key.private_numbers().private_value
        chk(misma, "%-58s    y es la misma llave" % "")

# Sin llave, no se inventa nada.
os.environ.pop("VAPID_PRIVADA", None)
chk(avisos_chat._llave_usable() == "", "sin llave puesta, devuelve vacio y no inventa nada")

# La forma se puede mirar SIN ver la llave.
os.environ["VAPID_PRIVADA"] = pem
f = avisos_chat.forma_de_la_llave()
chk(f["es_pem"] is True, "la forma detecta que es un PEM: %s" % f)
chk(str(f).find(b64url[:12]) < 0, "y al mirar la forma NO se ve nada de la llave")
os.environ["VAPID_PRIVADA"] = b64url
f2 = avisos_chat.forma_de_la_llave()
chk(f2["parece_base64url"] is True and f2["es_pem"] is False,
    "y reconoce el base64url: %s" % f2)
os.environ.pop("VAPID_PRIVADA", None)

print("-" * 78)
print("TODO BIEN" if not fallos else "FALLARON %d" % len(fallos))
sys.exit(1 if fallos else 0)
