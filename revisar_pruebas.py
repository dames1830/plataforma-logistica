# -*- coding: utf-8 -*-
"""
revisar_pruebas.py  -  Revisa si el entorno de PRUEBAS (beta) esta listo.

Uso:  doble clic en revisar_pruebas.bat
      o desde una terminal:  python revisar_pruebas.py

No modifica nada. Solo mira y avisa.
Si tienes un sitio de pruebas en internet, escribe su direccion en un archivo
llamado sitio_beta.txt junto a este script y tambien lo revisara.
"""

import json
import os
import subprocess
import urllib.error
import urllib.request

API = "https://logistics-backend-wv0x.onrender.com/api"
RAIZ = os.path.dirname(os.path.abspath(__file__))
ANCHO = 62

problemas = []
avisos = []


def titulo(txt):
    print("\n" + "=" * ANCHO)
    print("  " + txt)
    print("=" * ANCHO)


def paso(n, total, txt):
    print(f"\n[{n}/{total}] {txt}")


def ok(txt):
    print(f"      OK     {txt}")


def falla(txt):
    print(f"      FALLA  {txt}")
    problemas.append(txt)


def aviso(txt):
    print(f"      AVISO  {txt}")
    avisos.append(txt)


def pedir(ruta, beta=False, timeout=90):
    req = urllib.request.Request(API + ruta)
    if beta:
        req.add_header("X-Environment", "beta")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def git(*args):
    try:
        return subprocess.run(["git", "-C", RAIZ, *args], capture_output=True,
                              text=True, timeout=30).stdout.strip()
    except Exception:
        return ""


titulo("REVISION DEL ENTORNO DE PRUEBAS")
print("  (el servidor puede tardar unos segundos en despertar)")

# ---------------------------------------------------------------- 1
paso(1, 5, "El servidor distingue produccion y pruebas")
try:
    prod = pedir("/health").get("entorno")
    beta = pedir("/health", beta=True).get("entorno")
    if prod == "production" and beta == "beta":
        ok("sin sello responde 'produccion', con sello responde 'pruebas'")
    else:
        falla(f"responde mal: sin sello='{prod}', con sello='{beta}'")
except Exception as e:
    falla(f"no se pudo hablar con el servidor ({e})")

# ---------------------------------------------------------------- 2
paso(2, 5, "La base de pruebas esta separada y tiene datos")
try:
    est = pedir("/admin/entornos")
    p_mb = est["produccion"]["tamano_mb"]
    b_mb = est["pruebas"]["tamano_mb"]

    if est["produccion"]["archivo"] != est["pruebas"]["archivo"]:
        ok(f"son dos archivos distintos  (pruebas {b_mb} MB | produccion {p_mb} MB)")
    else:
        falla("produccion y pruebas apuntan al MISMO archivo")

    usuarios = pedir("/logistics/users", beta=True)["data"]
    tareas = pedir("/logistics/almacenaje_tasks", beta=True)["data"]

    if usuarios:
        ok(f"{len(usuarios)} usuarios en pruebas: {', '.join(u['username'] for u in usuarios)}")
    else:
        aviso("no hay usuarios en pruebas: pide una copia de datos")

    if tareas:
        ok(f"{len(tareas)} tareas cargadas")
    else:
        aviso("no hay tareas cargadas en pruebas")

    if b_mb < 0.2:
        aviso("la base de pruebas esta casi vacia: pide una copia de datos")
except Exception as e:
    falla(f"no se pudo revisar la base de pruebas ({e})")

# ---------------------------------------------------------------- 3
paso(3, 5, "Espacio en el disco del servidor")
try:
    libre = pedir("/admin/entornos")["disco_libre_mb"]
    if libre > 150:
        ok(f"{libre} MB libres")
    elif libre > 60:
        aviso(f"solo quedan {libre} MB libres: conviene revisarlo")
    else:
        falla(f"quedan {libre} MB libres: el disco esta por llenarse")
except Exception as e:
    falla(f"no se pudo consultar el disco ({e})")

# ---------------------------------------------------------------- 4
paso(4, 5, "Tu codigo")
rama = git("rev-parse", "--abbrev-ref", "HEAD")
if rama == "beta":
    ok("estas parado en la rama 'beta' (la de trabajo)")
elif rama == "main":
    falla("estas en 'main', que es PRODUCCION. Cambia a beta antes de tocar nada.")
elif rama:
    aviso(f"estas en la rama '{rama}', ni beta ni main")
else:
    aviso("no se pudo leer la rama (git no responde)")

sucio = git("status", "--porcelain")
if sucio:
    n = len([l for l in sucio.splitlines() if l.strip()])
    aviso(f"tienes {n} archivo(s) con cambios sin guardar en git")
else:
    ok("no hay cambios sueltos sin guardar")

estado = git("status", "-sb")
if "[ahead" in estado:
    aviso("tienes cambios hechos que todavia no subiste a GitHub")
elif "[behind" in estado:
    aviso("GitHub tiene cambios que tu copia no tiene")
elif estado:
    ok("tu copia esta al dia con GitHub")

# ---------------------------------------------------------------- 5
paso(5, 5, "Sitio de pruebas en internet")
archivo_sitio = os.path.join(RAIZ, "sitio_beta.txt")
if os.path.exists(archivo_sitio):
    try:
        with open(archivo_sitio, "r", encoding="utf-8") as f:
            url = f.read().strip()
    except OSError:
        url = ""
    if url:
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                cuerpo = r.read().decode("utf-8", errors="ignore")
            if "env.js" in cuerpo:
                ok(f"responde y trae el detector de entorno: {url}")
            else:
                aviso(f"responde pero no parece la web correcta: {url}")
        except Exception as e:
            falla(f"no responde: {url} ({e})")
    else:
        aviso("sitio_beta.txt esta vacio")
else:
    aviso("no configurado (opcional). Puedes probar en tu PC con abrir_pruebas.bat")

# ---------------------------------------------------------------- veredicto
print("\n" + "-" * ANCHO)
if problemas:
    print("  VEREDICTO: NO trabajes todavia. Hay algo roto:")
    for p in problemas:
        print(f"    - {p}")
    print("\n  Pasale esta pantalla a Claude y lo revisamos.")
elif avisos:
    print("  VEREDICTO: LISTO PARA TRABAJAR.")
    print("  Solo estos detalles menores, ninguno te bloquea:")
    for a in avisos:
        print(f"    - {a}")
else:
    print("  VEREDICTO: TODO EN ORDEN. Puedes trabajar tranquilo.")
print("-" * ANCHO)
print("\n  Recuerda: en pruebas se rompe lo que sea. Nada toca lo real.\n")
