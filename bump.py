# -*- coding: utf-8 -*-
"""
bump.py  -  Subir / unificar la version de la plataforma logistica.

Que hace distinto al viejo:
  - El viejo cambiaba UN numero exacto a la vez, asi que los archivos que
    estaban en otra version se quedaban atras y todo se desincronizaba.
  - Este busca CUALQUIER version 26.5.NNN en todos los archivos y los pone
    TODOS en el mismo numero. Imposible que queden distintos.

Uso (abre una terminal en la carpeta logistics-web-app):

  python bump.py            -> sube la version +1 (toma la mas alta y le suma 1)
  python bump.py 26.5.510   -> pone TODO exactamente en 26.5.510
  python bump.py check      -> solo revisa, NO cambia nada (dice si estan iguales)

Nota: NO toca los comentarios historicos del CSS (v26.5.58, v26.5.60) porque
esos son de 2 digitos; las versiones reales son de 3 o mas (501, 502, ...).
"""

import os
import io
import re
import sys

# ---- Configuracion ----
PREFIX = "26.5."                       # familia de version actual (si algun dia pasas a 26.6, cambia esto)
VER_RE = re.compile(r"26\.5\.(\d{3,})")  # versiones reales: 3+ digitos (ignora los comentarios 58 / 60)
EXTS = (".js", ".html", ".css")
EXCLUDE_DIR = ("beta_backup", "__pycache__", "brain", ".git", "Punto_Restaur", "Documentacion")
EXCLUDE_FILE = ("diff.txt", "diff2.txt")

ROOT = os.path.dirname(os.path.abspath(__file__))


def iter_files():
    """Recorre los archivos fuente reales (ignora respaldos, git, etc.)."""
    for dirpath, _dirs, files in os.walk(ROOT):
        if any(x in dirpath for x in EXCLUDE_DIR):
            continue
        for fn in files:
            if fn.endswith(EXTS) and fn not in EXCLUDE_FILE:
                yield os.path.join(dirpath, fn)


def leer(fp):
    try:
        with io.open(fp, "r", encoding="utf-8") as f:
            return f.read()
    except (UnicodeDecodeError, OSError):
        return None  # archivo de depuracion con codificacion rara -> se ignora


def escanear():
    """Devuelve {version: cantidad} de todo lo encontrado."""
    conteo = {}
    for fp in iter_files():
        c = leer(fp)
        if c is None:
            continue
        for m in VER_RE.findall(c):
            conteo[m] = conteo.get(m, 0) + 1
    return conteo


def version_mas_alta(conteo):
    if not conteo:
        return None
    return max(int(v) for v in conteo.keys())


def aplicar(destino):
    """Pone TODOS los archivos en PREFIX+destino. Devuelve lista de cambios."""
    nueva = PREFIX + str(destino)
    cambios = []
    saltados = []
    for fp in iter_files():
        c = leer(fp)
        if c is None:
            saltados.append(os.path.relpath(fp, ROOT))
            continue
        nuevo = VER_RE.sub(nueva, c)
        if nuevo != c:
            with io.open(fp, "w", encoding="utf-8") as f:
                f.write(nuevo)
            cambios.append(os.path.relpath(fp, ROOT).replace("\\", "/"))
    return nueva, cambios, saltados


def modo_check():
    conteo = escanear()
    if not conteo:
        print("No se encontro ninguna version 26.5.NNN.")
        return
    print("=== Versiones encontradas ===")
    for v in sorted(conteo, key=lambda x: int(x)):
        print(f"  26.5.{v}  ->  {conteo[v]} veces")
    if len(conteo) == 1:
        print("\nOK: todas las paginas estan en la MISMA version. :)")
    else:
        print(f"\nATENCION: hay {len(conteo)} versiones distintas (desincronizadas).")
        print("Corre 'python bump.py' para subir +1, o 'python bump.py 26.5.NNN' para igualarlas.")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "check":
        modo_check()
        return

    conteo = escanear()
    alta = version_mas_alta(conteo)

    if arg:  # version explicita, ej: 26.5.510  o  510
        destino = arg.replace(PREFIX, "").strip()
        if not destino.isdigit():
            print(f"Version invalida: '{arg}'. Ejemplo valido: python bump.py 26.5.510")
            return
        destino = int(destino)
    else:  # auto +1
        if alta is None:
            print("No se encontro ninguna version para subir.")
            return
        destino = alta + 1

    if alta is not None:
        print(f"Version mas alta actual: 26.5.{alta}")
    print(f"Poniendo TODO en: {PREFIX}{destino}\n")

    nueva, cambios, saltados = aplicar(destino)

    print(f"=== {len(cambios)} archivos actualizados a {nueva} ===")
    for c in cambios:
        print(f"  {c}")
    if saltados:
        print(f"\n(Se ignoraron {len(saltados)} archivos con codificacion rara, no son parte de la app: {', '.join(saltados)})")

    # Verificacion final
    conteo2 = escanear()
    if len(conteo2) == 1 and str(destino) in conteo2:
        print(f"\nOK: TODAS las paginas quedaron en {nueva}. :)")
    else:
        print(f"\nATENCION: quedaron versiones mezcladas: {sorted(conteo2)}")


if __name__ == "__main__":
    main()
