# -*- coding: utf-8 -*-
"""
QUE /api/health SIGA SIENDO /api/health.

El 16-sep-2026 se metio una funcion nueva ENTRE el decorador `@app.get("/api/health")` y su
`def health()`. Python aplica el decorador a lo que viene justo debajo, asi que la ruta quedo
apuntando a la funcion nueva y el endpoint empezo a devolver otra cosa. Nadie lo noto al subir
porque el codigo compilaba y la ruta seguia contestando 200.

NO ES UN DETALLE: de `timestamp` sale la hora del servidor con la que el chat calcula la
presencia -la bolita verde- y las marcas de entregado y leido. Sin ella, dos PC con relojes
distintos dejan de entenderse.

    python scratch/probar_health.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

import main  # noqa: E402

fallos = []


def chk(cond, texto):
    print(("OK    " if cond else "FALLA ") + texto)
    if not cond:
        fallos.append(texto)


print("\n/api/health  -  que siga trayendo lo que trae")
print("-" * 74)

rutas = [(r.path, getattr(r, "name", "")) for r in main.app.routes
         if getattr(r, "path", "") == "/api/health"]
chk(len(rutas) == 1, "hay UNA sola ruta /api/health: %s" % len(rutas))
chk(rutas and rutas[0][1] == "health",
    "y apunta a health(), no a otra funcion: %s" % (rutas[0][1] if rutas else "-"))

h = main.health()
for clave in ("status", "entorno", "db_size_mb", "disk_free_mb", "timestamp",
              "avisos_push", "candado_escritura"):
    chk(clave in h, "trae '%s'" % clave)

chk(bool(h.get("timestamp")) and "T" in str(h.get("timestamp")),
    "el timestamp viene con fecha y hora: %s  (de aca sale la hora del servidor "
    "para la presencia y las marcas de leido)" % h.get("timestamp"))

ap = h.get("avisos_push") or {}
for clave in ("llave_puesta", "libreria_instalada", "aparatos_suscritos",
              "puede_avisar", "que_falta"):
    chk(clave in ap, "avisos_push trae '%s'" % clave)

# LA LLAVE NUNCA SE PUBLICA. Es una contrasena.
os.environ["VAPID_PRIVADA"] = "ESTO-NO-PUEDE-SALIR-NUNCA"
try:
    entero = json.dumps(main.health(), default=str)
    chk("ESTO-NO-PUEDE-SALIR-NUNCA" not in entero,
        "con la llave puesta, su valor NO aparece en la respuesta")
    chk((main.health().get("avisos_push") or {}).get("llave_puesta") is True,
        "pero si se avisa que esta puesta")
finally:
    os.environ.pop("VAPID_PRIVADA", None)

print("-" * 74)
print("%d comprobaciones  -  FALLARON: %d" % (len(fallos) + 0, len(fallos)) if fallos
      else "TODO BIEN")
sys.exit(1 if fallos else 0)
