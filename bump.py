# -*- coding: utf-8 -*-
"""
bump.py  -  Subir / unificar la version de la plataforma logistica.

  - La version viaja en ~34 sitios: los `?v=` de cada import, el `const VERSION`
    y los textos "SYSTEM BUILD". Si quedan desincronizados, el navegador sirve
    unos archivos viejos y otros nuevos, y la web se rompe de formas raras.
  - Este script los pone TODOS en el mismo numero de una sola pasada.

  Desde v27 (31-jul-2026) la version es un ENTERO: 27, 28, 29...  Un numero por
  lanzamiento a produccion, no uno por cada ajuste suelto. Antes era 26.5.NNN y
  subia decenas de veces entre dos lanzamientos reales.

  Uso:
    python bump.py            -> sube la version +1
    python bump.py 30         -> fija la version 30
    python bump.py check      -> solo revisa si estan todas iguales

  Los comentarios que citan una version ("[SEGURIDAD v26.5.572] ...") NO se tocan:
  son notas historicas de cuando algo cambio. Reescribirlas en cada bump las volvia
  mentira, porque siempre acababan diciendo la version del dia.
"""
import os
import io
import re
import sys

# ---- Configuracion ----
EXTS = (".js", ".html", ".css")
# Los respaldos quedan congelados en la version con la que se guardaron: son la foto de
# como estaba la app ese dia. Antes se salvaban de casualidad, porque el patron viejo solo
# reconocia 26.5.NNN y ellos estaban en 12.4 / 17.x. Con el patron nuevo hay que excluirlos
# a proposito o se reescriben enteros.
EXCLUDE_DIR = ("beta_backup", "backup", "backups", "__pycache__", "brain", ".git",
               "Punto_Restaur", "Documentacion", "node_modules", "restauracion")
EXCLUDE_FILE = ("diff.txt", "diff2.txt")

# La version SOLO se reconoce en los sitios donde de verdad cumple una funcion.
# Asi un numero suelto del codigo nunca se confunde con una version.
PATRONES = [
    re.compile(r"(\?v=)(\d+(?:\.\d+)*)"),                       # ...js?v=27
    re.compile(r"(const VERSION\s*=\s*['\"])(\d+(?:\.\d+)*)"),  # const VERSION = '27'
    re.compile(r"(SYSTEM BUILD:\s*v)(\d+(?:\.\d+)*)"),          # SYSTEM BUILD: v27
    re.compile(r"(SISTEMA\s+v)(\d+(?:\.\d+)*)"),                # SISTEMA v27 ONLINE
    re.compile(r"(weight:500;\">v)(\d+(?:\.\d+)*)"),            # el numerito de la cabecera
    # APP_VERSION guarda la 'v' DENTRO del texto, y con el arma la ruta del dashboard y del
    # login: `login.js?v=${this.APP_VERSION}` daba `?v=v26.5.572`. Como no empezaba por
    # digito, ningun patron lo reconocia: se quedo en 26.5.572 mientras todo lo demas subia,
    # y el navegador seguia sirviendo el login viejo de cache lanzamiento tras lanzamiento.
    re.compile(r"(APP_VERSION\s*=\s*['\"]v)(\d+(?:\.\d+)*)"),    # APP_VERSION = 'v27'
]

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
    """Devuelve {version: cantidad} de todo lo encontrado en sitios funcionales."""
    conteo = {}
    for fp in iter_files():
        c = leer(fp)
        if c is None:
            continue
        for rx in PATRONES:
            for _pre, ver in rx.findall(c):
                conteo[ver] = conteo.get(ver, 0) + 1
    return conteo


def como_numero(v):
    """'27' -> 27 ; '26.5.572' -> 26 (para poder comparar entre esquemas)."""
    try:
        return int(str(v).split(".")[0])
    except ValueError:
        return 0


def aplicar(destino):
    """Pone TODOS los archivos en la version destino. Devuelve lista de cambios."""
    nueva = str(destino)
    cambios, saltados = [], []
    for fp in iter_files():
        c = leer(fp)
        if c is None:
            saltados.append(os.path.relpath(fp, ROOT))
            continue
        nuevo = c
        for rx in PATRONES:
            nuevo = rx.sub(lambda m: m.group(1) + nueva, nuevo)
        if nuevo != c:
            with io.open(fp, "w", encoding="utf-8") as f:
                f.write(nuevo)
            cambios.append(os.path.relpath(fp, ROOT).replace("\\", "/"))
    return nueva, cambios, saltados


def modo_check():
    conteo = escanear()
    if not conteo:
        print("No se encontro ninguna version.")
        return
    print("=== Versiones encontradas ===")
    for v in sorted(conteo, key=como_numero):
        print(f"  v{v}  ->  {conteo[v]} veces")
    if len(conteo) == 1:
        print("\nOK: todas las paginas estan en la MISMA version. :)")
    else:
        print(f"\nATENCION: hay {len(conteo)} versiones distintas (desincronizadas).")
        print("Corre 'python bump.py' para subir +1, o 'python bump.py 30' para igualarlas.")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "check":
        modo_check()
        return

    conteo = escanear()
    alta = max((como_numero(v) for v in conteo), default=None)

    if arg:
        destino = arg.lstrip("vV").strip()
        if not destino.isdigit():
            print(f"Version invalida: '{arg}'. Ejemplo valido: python bump.py 30")
            return
        destino = int(destino)
    else:
        if alta is None:
            print("No se encontro ninguna version para subir.")
            return
        destino = alta + 1

    if alta is not None:
        print(f"Version mas alta actual: v{alta}")
    print(f"Poniendo TODO en: v{destino}\n")

    nueva, cambios, saltados = aplicar(destino)

    print(f"=== {len(cambios)} archivos actualizados a v{nueva} ===")
    for c in cambios:
        print(f"  {c}")
    if saltados:
        print(f"\n(Se ignoraron {len(saltados)} archivos con codificacion rara, no son parte de la app: {', '.join(saltados)})")

    conteo2 = escanear()
    if len(conteo2) == 1 and nueva in conteo2:
        print(f"\nOK: TODAS las paginas quedaron en v{nueva}. :)")
    else:
        print(f"\nATENCION: quedaron versiones mezcladas: {sorted(conteo2)}")


if __name__ == "__main__":
    main()
