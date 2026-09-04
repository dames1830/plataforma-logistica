# LOGISTICS BACKEND v26.5.208 - buffer_history + buffer_kpi_results + range endpoint + layout global
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.gzip import GZipMiddleware
import sqlite3
import json
import os
import re
import shutil
import hashlib
import hmac
import secrets
import time
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone


# ─────────────────────────────────────────────────────────────────────────────
# LA HORA ES LA DE LIMA, NO LA DEL SERVIDOR
#
# Render corre en UTC y Perú está cinco horas atrás. Con datetime.now() a secas todo
# quedaba estampado cinco horas adelantado, y eso no era solo un número feo en pantalla:
#
#   - El robot corre a las 19:00 de Lima, que en UTC ya son las 00:00 del DÍA SIGUIENTE.
#     La fecha por defecto de un área subida a esa hora salía con el día equivocado, y la
#     rotación de Descargas borra por fecha.
#   - Un archivo subido a las 19:05 aparecía fechado mañana.
#
# Perú no cambia de hora en todo el año, así que el desfase fijo de cinco horas alcanza y
# evita depender de que el contenedor tenga instalada la base de zonas horarias.
#
# Devuelve un datetime SIN zona para que .isoformat() y .strftime() sigan dando
# exactamente el mismo formato de siempre: cambia la hora, no la forma.
# ─────────────────────────────────────────────────────────────────────────────
_LIMA = timezone(timedelta(hours=-5))


def ahora():
    """La hora de Lima, con el mismo formato que devolvía datetime.now()."""
    return datetime.now(timezone.utc).astimezone(_LIMA).replace(tzinfo=None)
from typing import Optional
from urllib.parse import quote

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# =============================================================================
# ÁREAS SINGLETON
# -----------------------------------------------------------------------------
# Un área normal guarda una foto por fecha: sirve para el stock de cada día. Un área
# singleton guarda UNA sola fila, siempre bajo la fecha 'MASTER', y cada envío pisa
# al anterior. Es lo que corresponde cuando el dato no es "cómo estaba tal día" sino
# "cómo es ahora": los usuarios, los permisos, el Maestro de Artículos.
#
# La lista estaba copiada en 5 funciones distintas. Agregar un área y olvidarse de
# una copia da un comportamiento partido -se guarda de una forma y se lee de otra-
# muy difícil de encontrar. Va una sola vez.
# =============================================================================
SINGLETON_AREAS = [
    'attendance', 'workers', 'users', 'permissions', 'config', 'performance_log',
    'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers',
    'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva',
    # El Maestro de Artículos: se publica desde Configuración > Archivos Nube y todas
    # las PC lo bajan de acá. Sin esto, cada publicación dejaría otra copia de ~4 MB
    # en el disco del servidor en vez de reemplazar la anterior.
    'articulos',
    # Ficha chica del Maestro (filas, fecha, quién lo subió). Se consulta para saber
    # si hay que bajar el archivo grande o alcanza con el que ya está en el navegador.
    'articulos_meta',
]


# =============================================================================
# ENTORNOS: PRODUCCIÓN y PRUEBAS (beta)
# -----------------------------------------------------------------------------
# El mismo servidor atiende los dos entornos, pero cada uno escribe en SU PROPIO
# archivo de base de datos:
#
#     producción -> /data/database.db        (la de verdad)
#     pruebas    -> /data/database_beta.db   (la desechable)
#
# ¿Cómo se elige? La web de pruebas manda la cabecera "X-Environment: beta"
# (también sirve ?env=beta en la URL). Si NO viene nada, se usa producción,
# exactamente igual que antes de que existiera esta separación.
# =============================================================================

DB_PATH = os.environ.get("DB_PATH", "database.db")   # producción (nombre histórico)


def _ruta_beta(ruta_produccion: str) -> str:
    base, ext = os.path.splitext(ruta_produccion)
    return base + "_beta" + (ext or ".db")


DB_PATH_BETA = _ruta_beta(DB_PATH)

_entorno = ContextVar("pulse_entorno", default="production")


def db_path() -> str:
    """La base de datos que le toca a la petición que se está atendiendo."""
    return DB_PATH_BETA if _entorno.get() == "beta" else DB_PATH


def entorno_actual() -> str:
    return _entorno.get()


@app.middleware("http")
async def detectar_entorno(request: Request, call_next):
    valor = (request.headers.get("X-Environment")
             or request.query_params.get("env")
             or "").strip().lower()
    es_beta = (valor == "beta")

    # Si la base de pruebas no existe todavía (primer uso, o se borró por
    # emergencia de disco), se crea vacía al vuelo.
    if es_beta and not os.path.exists(DB_PATH_BETA):
        try:
            init_db(DB_PATH_BETA)
        except Exception as e:
            print(f"[PULSE] No se pudo crear la base de pruebas: {e}")

    token = _entorno.set("beta" if es_beta else "production")
    try:
        respuesta = await call_next(request)
    finally:
        _entorno.reset(token)
    respuesta.headers["X-Environment-Used"] = "beta" if es_beta else "production"
    return respuesta


# =============================================================================
# CONTRASEÑAS
# -----------------------------------------------------------------------------
# Nunca se guardan ni se devuelven en texto plano. Se guarda una huella
# irreversible (PBKDF2-SHA256, con sal única por usuario y 200.000 vueltas):
#
#     pbkdf2$200000$<sal>$<huella>
#
# De la huella no se puede volver a la contraseña. Ni yo, ni el servidor, ni
# quien se robe la base de datos puede leerlas: solo se puede comprobar si una
# contraseña que alguien escribe coincide.
#
# Las contraseñas viejas en texto plano se siguen aceptando al iniciar sesión
# (para no dejar a nadie afuera) y se convierten solas al arrancar el servidor.
# =============================================================================

PBKDF2_VUELTAS = 200_000


def hashear_password(plano: str) -> str:
    sal = secrets.token_bytes(16)
    huella = hashlib.pbkdf2_hmac("sha256", str(plano).encode("utf-8"), sal, PBKDF2_VUELTAS)
    return f"pbkdf2${PBKDF2_VUELTAS}${sal.hex()}${huella.hex()}"


def es_hash(valor) -> bool:
    return isinstance(valor, str) and valor.startswith("pbkdf2$")


def verificar_password(plano, guardado) -> bool:
    """Compara sin filtrar información por el tiempo de respuesta."""
    if not guardado or plano is None:
        return False
    if not es_hash(guardado):
        # Contraseña antigua en texto plano: se acepta, pero está en la lista para migrar.
        return hmac.compare_digest(str(plano), str(guardado))
    try:
        _, vueltas, sal_hex, huella_hex = guardado.split("$")
        huella = hashlib.pbkdf2_hmac("sha256", str(plano).encode("utf-8"),
                                     bytes.fromhex(sal_hex), int(vueltas))
        return hmac.compare_digest(huella.hex(), huella_hex)
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# QUIEN PUEDE TOCAR LOS USUARIOS
#
# Hasta el 26-ago-2026 NINGUN endpoint pedia credenciales, y `POST /logistics/users`
# empieza borrando a todo el que no venga en la lista. Con UNA sola peticion anonima
# se podia borrar a los siete usuarios reales y crearse uno con rol admin y la clave
# que uno quisiera: la plataforma entera, sin adivinar nada. La direccion del
# servidor esta en el JavaScript publico.
#
# El arreglo es a proposito ESTRECHO: solo se exige token para ESCRIBIR usuarios.
# Leer sigue libre -si no, no arranca ni la pantalla de entrada- y el resto de areas
# tambien, para no dejar sin trabajar a los robots ni a los reportes publicos. Esos
# huecos siguen abiertos y hay que cerrarlos despues; este es el que te deja fuera de
# tu propia plataforma.
# ══════════════════════════════════════════════════════════════════════════════
DIAS_DE_SESION = 30

def crear_sesion(username: str, role: str) -> str:
    """Devuelve un token nuevo y lo guarda. De paso limpia los vencidos."""
    token = secrets.token_urlsafe(32)
    vence = (ahora() + timedelta(days=DIAS_DE_SESION)).isoformat()
    conn = sqlite3.connect(db_path()); cur = conn.cursor()
    try:
        cur.execute("DELETE FROM sessions WHERE expires_at < ?", (ahora().isoformat(),))
        cur.execute("INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)",
                    (token, username, role, vence))
        conn.commit()
    finally:
        conn.close()
    return token

def usuario_del_token(request: Request):
    """El usuario dueno del token, o None. Se relee el ROL DE LA TABLA `users` y no
    el que quedo grabado en la sesion: si a alguien le bajan el rol, deja de poder
    en el acto y no cuando venza su token."""
    token = request.headers.get('X-Auth-Token') or ''
    if not token:
        return None
    conn = sqlite3.connect(db_path()); cur = conn.cursor()
    try:
        cur.execute("SELECT username, expires_at FROM sessions WHERE token = ?", (token,))
        fila = cur.fetchone()
        if not fila or str(fila[1]) < ahora().isoformat():
            return None
        cur.execute("SELECT username, role, active FROM users WHERE username = ?", (fila[0],))
        u = cur.fetchone()
        if not u or not u[2]:
            return None
        return {"username": u[0], "role": u[1]}
    except Exception:
        return None
    finally:
        conn.close()

# ══════════════════════════════════════════════════════════════════════════════
# ESCRIBIR DATOS: QUIEN PUEDE (fase 3 del cierre de la API abierta, 26-ago-2026)
#
# `POST/PATCH /logistics/{area}` deja escribir CUALQUIER area sin credenciales. Lo
# usan dos escritores legitimos, con credenciales distintas:
#   - Las PC de operarios, que YA tienen token de sesion desde v29.0413 (el login lo
#     entrega). Solo faltaba que la web lo mandara en TODAS las escrituras, no solo
#     en las de usuarios.
#   - Los robots del Contabo, que corren sin sesion. Llevan un ROBOT_TOKEN propio,
#     una variable de entorno que vive en el Contabo y en Render -NUNCA en el repo-.
#
# EL INTERRUPTOR. Encender esto de golpe romperia la operacion: toda PC con sesion
# vieja y todo robot que aun no mande token dejaria de escribir. Por eso hay un
# interruptor, apagado por defecto:
#   EXIGIR_TOKEN_ESCRITURA=false (o sin poner)  -> se acepta todo, pero se CUENTAN
#       las escrituras anonimas. Se despliega asi, se mira el contador bajar a cero
#       -robots y PC ya mandan token- y recien ahi se enciende.
#   EXIGIR_TOKEN_ESCRITURA=true                 -> escribir datos exige token.
#
# Seguro de fabrica: si se enciende SIN haber puesto ROBOT_TOKEN, se ignora y se
# sigue en modo aviso. Nunca se deja el servidor exigiendo un token que no existe.
ROBOT_TOKEN = (os.environ.get("ROBOT_TOKEN") or "").strip()

def _exigir_token_escritura() -> bool:
    if (os.environ.get("EXIGIR_TOKEN_ESCRITURA") or "").strip().lower() not in ("1", "true", "si", "yes"):
        return False
    if not ROBOT_TOKEN:
        print("[SEGURIDAD] EXIGIR_TOKEN_ESCRITURA esta encendido pero falta ROBOT_TOKEN: "
              "se sigue en modo aviso para no romper los robots.")
        return False
    return True

# Cuantas escrituras llegan sin credencial mientras el interruptor esta apagado.
# Se mira en /health para saber si ya se puede encender sin dejar a nadie fuera.
#
# GUARDA EL DESGLOSE, no solo la ultima. Con solo `ultima_area` no se puede saber
# QUIENES faltan: el 28-ago-2026 el contador marcaba 1.547 y lo unico que se sabia
# era que la ultima habia sido `tabla_tallas`. Hubo que auditar el codigo entero para
# descubrir que la web escribia desde ~30 sitios sin credencial. Con el desglose, la
# proxima vez la respuesta esta en /health.
#
# `quien` sale del User-Agent: distingue un navegador de un robot de Python sin
# guardar nada de la persona -ni IP, ni usuario, ni sesion-.
_escrituras_anonimas = {"total": 0, "ultima_area": None, "ultima_hora": None,
                        "por_area": {}, "por_quien": {}, "por_motivo": {}}
# Tope de nombres distintos que se guardan. Las areas son ~77; el tope es un freno
# por si alguna vez llega basura, para que el diccionario no crezca sin fin.
_TOPE_DESGLOSE = 200


def _motivo_anonima(request: Request) -> str:
    """POR QUE esta escritura no tiene permiso. Es lo que decide si se puede
    encender el candado o no, y no se puede adivinar.

    Al 02-sep-2026 el contador llevaba 16 escrituras anonimas, todas del
    NAVEGADOR, en tres areas: tabla_tallas 10, archivos 5, evolucion_articulo 1.
    Con eso solo no se sabe si son:

      · SESION VENCIDA O DESCONOCIDA -> encender el candado deja a gente de
        verdad sin poder trabajar, y hay que arreglar antes la sesion
      · SIN NINGUN TOKEN -> hay codigo que escribe saltandose el sellado de
        `env.js`; se busca y se arregla, y el candado se puede encender

    Son dos mundos distintos y el contador viejo no los distinguia. Esto no
    cambia NADA del comportamiento: solo anota el motivo.
    """
    auth = request.headers.get('X-Auth-Token') or ''
    robot = request.headers.get('X-Robot-Token') or ''
    if auth and robot:
        return 'los dos tokens, y ninguno vale'
    if robot:
        return 'token de robot que no coincide'
    if auth:
        return 'sesion vencida o desconocida'
    return 'sin token'


def _quien_escribe(request: Request) -> str:
    ua = (request.headers.get('user-agent') or '').lower()
    if not ua:
        return 'sin user-agent'
    if 'mozilla' in ua or 'chrome' in ua or 'safari' in ua or 'edg' in ua:
        return 'navegador'
    if 'python' in ua or 'urllib' in ua or 'curl' in ua:
        return 'script/robot'
    return ua[:40]

def token_de_robot_valido(request: Request) -> bool:
    t = request.headers.get('X-Robot-Token') or ''
    return bool(ROBOT_TOKEN) and secrets.compare_digest(t, ROBOT_TOKEN)

def puede_escribir_datos(request: Request) -> bool:
    """Un robot con su token, o cualquier usuario activo con sesion iniciada."""
    return token_de_robot_valido(request) or (usuario_del_token(request) is not None)

def _control_escritura(request: Request, area: str):
    """Devuelve una respuesta 403 si hay que frenar, o None si se puede seguir.
    En modo aviso nunca frena: solo cuenta las anonimas para el /health."""
    if puede_escribir_datos(request):
        return None
    if _exigir_token_escritura():
        return JSONResponse(status_code=403, content={
            "status": "error",
            "message": "Escribir datos necesita una sesion iniciada o el token del robot."})
    _escrituras_anonimas["total"] += 1
    _escrituras_anonimas["ultima_area"] = area
    _escrituras_anonimas["ultima_hora"] = ahora().isoformat()
    for casilla, clave in (("por_area", str(area)),
                           ("por_quien", _quien_escribe(request)),
                           ("por_motivo", _motivo_anonima(request))):
        d = _escrituras_anonimas[casilla]
        if clave in d or len(d) < _TOPE_DESGLOSE:
            d[clave] = d.get(clave, 0) + 1
    return None


def es_admin(request: Request) -> bool:
    u = usuario_del_token(request)
    return bool(u and u.get('role') == 'admin')


def migrar_passwords(ruta: str) -> int:
    """Convierte a huella las contraseñas que todavía estén en texto plano."""
    convertidas = 0
    try:
        conn = sqlite3.connect(ruta)
        cur = conn.cursor()
        for usuario, clave in cur.execute("SELECT username, password FROM users").fetchall():
            if clave and not es_hash(clave):
                cur.execute("UPDATE users SET password = ? WHERE username = ?",
                            (hashear_password(clave), usuario))
                convertidas += 1
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[SEGURIDAD] No se pudieron migrar las contraseñas de {ruta}: {e}")
    return convertidas


def limpiar_passwords_del_snapshot(ruta: str) -> bool:
    """
    El snapshot 'users' guardaba también las contraseñas en texto plano.
    Aquí se las quitamos: las claves solo viven (con huella) en la tabla users.
    """
    try:
        conn = sqlite3.connect(ruta)
        cur = conn.cursor()
        fila = cur.execute(
            "SELECT data_json FROM logistics_snapshots WHERE area_id='users' AND snapshot_date='MASTER'"
        ).fetchone()
        if not fila:
            conn.close()
            return False

        usuarios = json.loads(fila[0])
        if not isinstance(usuarios, list):
            conn.close()
            return False

        habia = any(isinstance(u, dict) and u.get("password") for u in usuarios)
        if habia:
            limpios = [{k: v for k, v in u.items() if k != "password"}
                       for u in usuarios if isinstance(u, dict)]
            cur.execute(
                "UPDATE logistics_snapshots SET data_json=? WHERE area_id='users' AND snapshot_date='MASTER'",
                (json.dumps(limpios),))
            conn.commit()
        conn.close()
        return habia
    except Exception as e:
        print(f"[SEGURIDAD] No se pudo limpiar el snapshot de usuarios de {ruta}: {e}")
        return False


def hard_reset_if_full():
    """
    Si el disco está totalmente bloqueado (0MB libres), liberamos espacio.

    Orden de sacrificio: PRIMERO la base de pruebas (es desechable y se puede
    volver a llenar con un clic). Solo si el disco sigue agotado después de eso
    se toca la de producción, que era el comportamiento histórico.
    """
    try:
        db_dir = os.path.dirname(DB_PATH) or "."
        _, _, free = shutil.disk_usage(db_dir)
        free_mb = free / (1024*1024)

        if free_mb >= 5:   # Menos de 5MB libres es CRÍTICO
            return

        print(f"🚨 DISCO AGOTADO ({free_mb}MB). Liberando espacio de emergencia...")

        # 1) La base de PRUEBAS va primero: es sacrificable.
        if os.path.exists(DB_PATH_BETA):
            os.remove(DB_PATH_BETA)
            print("✅ Base de PRUEBAS eliminada (se recupera con un clic).")
            _, _, free = shutil.disk_usage(db_dir)
            if free / (1024*1024) >= 5:
                print("✅ Espacio recuperado SIN tocar producción.")
                return

        # 2) Último recurso: la de producción.
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
            print("✅ Base de datos inflada eliminada. Espacio recuperado.")
    except Exception as e:
        print(f"Error en hard reset: {e}")

def init_db(ruta: Optional[str] = None):
    ruta = ruta or DB_PATH

    if ruta == DB_PATH:          # la limpieza de emergencia solo aplica a producción
        hard_reset_if_full()

    db_dir = os.path.dirname(ruta)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(ruta)
    cursor = conn.cursor()
    
    # Tablas con estructura optimizada (sin campos pesados innecesarios)
    cursor.execute('CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (area_id, snapshot_date))')
    cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, module TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY (role, module))')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS shared_data (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_history (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, paletas_solicitadas INTEGER NOT NULL, paletas_bajadas INTEGER NOT NULL, diferencias INTEGER NOT NULL, fill_rate TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_kpi_results (fecha TEXT PRIMARY KEY, results_json TEXT NOT NULL, row_count INTEGER DEFAULT 0, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')

    # Archivos Nube: el archivo entero, tal cual lo dejó el robot. Ver la sección
    # ARCHIVOS NUBE más abajo para por qué se guarda el archivo y no sus filas.
    cursor.execute('CREATE TABLE IF NOT EXISTS archivos_nube (id INTEGER PRIMARY KEY AUTOINCREMENT, modulo TEXT NOT NULL, nombre TEXT NOT NULL, fecha TEXT NOT NULL, tamano INTEGER NOT NULL, contenido BLOB NOT NULL, subido_por TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_archivos_nube ON archivos_nube (modulo, fecha DESC)')

    # SESIONES. Nacen al entrar y son lo unico que autoriza tocar los usuarios.
    # Van en la base y no en memoria porque el servidor se duerme y al despertar
    # todas las sesiones vivas se perderian: cada quien tendria que volver a entrar
    # sin saber por que.
    cursor.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions (expires_at)')

    # ── EL REGISTRO DE LO QUE PASA ──────────────────────────────────────────────
    #
    # Daniel, 28-ago-2026: *"¿como me doy cuenta de que el robot no esta corriendo?
    # Creame un modulo en la web que se llame log [...] ahi ponme todo lo que pasa, lo
    # que el robot haga, lo que descargue, lo que el usuario haga con nombre"*.
    #
    # Nacio de que el Stock Reserva de las 07:00 llevaba SEIS DIAS sin bajar y nadie se
    # entero: el robot lo dejaba escrito en un log del servidor que nadie abre.
    #
    # TABLA PROPIA Y NO UN AREA. Las areas guardan un bloque entero por fecha y se
    # reescriben completas; esto son miles de renglones que solo se agregan al final.
    # Con una tabla, escribir es una fila y leer es un filtro.
    #
    # SIETE DIAS. Regla suya: *"un historial de una semana nada mas, para que no consuma
    # tantos recursos"*. Se limpia al escribir, no con una tarea aparte: asi no hay nada
    # mas que se pueda quedar dormido.
    #
    # `cuando` va en HORA DE LIMA y como texto ordenable. No se usa CURRENT_TIMESTAMP
    # porque SQLite lo escribe en UTC y a las 19:00 -justo cuando entra el turno noche-
    # ya seria el dia siguiente.
    cursor.execute('CREATE TABLE IF NOT EXISTS eventos ('
                   'id INTEGER PRIMARY KEY AUTOINCREMENT, '
                   'cuando TEXT NOT NULL, '        # 'AAAA-MM-DD HH:MM:SS', hora de Lima
                   'origen TEXT NOT NULL, '        # 'robot' | 'web' | 'servidor'
                   'quien TEXT, '                  # usuario o nombre del robot
                   'tipo TEXT NOT NULL, '          # 'ok' | 'aviso' | 'error'
                   'accion TEXT NOT NULL, '        # que paso, en una linea
                   'detalle TEXT)')                # lo que haga falta para entenderlo
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_eventos_cuando ON eventos (cuando)')

    # ── EL ASN, EN UNA TABLA DE VERDAD ────────────────────────────────────────
    #
    # Una fila por ARTICULO DENTRO DE CADA ASN: 76.658 filas de 1.579.884 lineas,
    # 22 MB con indices. Es el nivel al que se consulta -"que trae el expediente
    # 2026-178", "que paso con este ASN", "donde esta este articulo"-. El LPN y la
    # talla no se guardan: nadie los busca desde la web y serian ~250 MB.
    cursor.execute('CREATE TABLE IF NOT EXISTS asn ('
                   'asn TEXT NOT NULL, '            # 20260720801BA.3811903
                   'articulo TEXT NOT NULL, '       # 3811903-1-32
                   'descripcion TEXT, '
                   'marca TEXT, '
                   'expediente TEXT, '              # 2026000178 <- por aca busca Daniel
                   'orden TEXT, '                   # 2026-07208-01
                   'sociedad TEXT, '                # BA, CA, CE, VM, BG
                   'tipo TEXT, '                    # importacion, nacional, inversa...
                   'estado TEXT, '                  # In Transit, Verified...
                   'fecha_envio TEXT, '             # AAAA-MM-DD
                   'fecha_recepcion TEXT, '
                   # LA HORA VA APARTE Y NO PEGADA A LA FECHA: si se guardara
                   # "2026-09-02 19:53" en fecha_recepcion, el filtro rec_hasta
                   # <= "2026-09-02" dejaria fuera todo lo de ese dia despues de
                   # medianoche. Separadas, los dos filtros siguen siendo simples.
                   'hora_recepcion TEXT, '         # HH:MM:SS
                   'usuario TEXT, '                # quien recibio (verified_user)
                   'enviado INTEGER, '
                   'recibido INTEGER, '
                   'lineas INTEGER, '
                   'PRIMARY KEY (asn, articulo))')
    # SIN INDICE, buscar recorre las 76.658 filas. Con ellos, 1 a 24 ms.
    for _col in ('expediente', 'articulo', 'orden', 'tipo', 'fecha_envio', 'estado',
                 'fecha_recepcion', 'usuario'):
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_asn_%s ON asn (%s)' % (_col, _col))

    # 'tema' llego despues: el administrador le deja puesto un tema a cada usuario y ese
    # es con el que abre la primera vez, en la PC que sea. Antes el tema vivia solo en el
    # navegador, asi que cada maquina era un mundo y una persona nueva siempre arrancaba
    # en el de fabrica. Queda NULL en los que ya estaban: eso significa 'sin asignar', y
    # entonces manda el ultimo tema que se haya usado en esa computadora.
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN tema TEXT')
    except sqlite3.OperationalError:
        pass          # ya existia: no es un error, es que la base ya estaba al dia

    # 'tipo' llegó después: en un mismo módulo conviven Slotting, Stock Activo y Stock
    # Reserva, y cada uno tiene que guardar SUS días. Sin esto los tres se repartían el
    # mismo cupo y agregar dos archivos dejaba el historial del Slotting en dos días.
    # A las filas que ya estaban se les pone el tipo por su nombre, que hasta ahora
    # siempre fue "Slotting DD-MM-AA.xlsx".
    try:
        cursor.execute('ALTER TABLE archivos_nube ADD COLUMN tipo TEXT')
        cursor.execute("UPDATE archivos_nube SET tipo = TRIM(REPLACE(REPLACE(nombre, '.xlsx', ''), '.csv', ''))")
        cursor.execute("UPDATE archivos_nube SET tipo = 'Slotting' WHERE nombre LIKE 'Slotting%'")
    except sqlite3.OperationalError:
        pass          # ya existía: no es un error, es que la base ya estaba al día
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_archivos_nube_tipo ON archivos_nube (modulo, tipo, fecha DESC)')

    # 'hora_recepcion' y 'usuario' llegaron el 03-sep-2026, para poder decir QUIEN
    # recibio y A QUE HORA -la productividad de recepcion por hora-.
    #
    # HACEN FALTA ACA aunque la tabla se rehaga cada madrugada. El endpoint arma su
    # consulta nombrando las columnas una por una, asi que en cuanto se despliega y
    # antes de que el robot de las 04:30 rehaga la tabla, CUALQUIER consulta al ASN
    # se cae con "no such column". Con esto, las filas viejas quedan con la columna
    # vacia -que es la verdad: esos archivos se bajaron antes de que existiera- y
    # la pantalla sigue andando.
    for _c in ('hora_recepcion', 'usuario'):
        try:
            cursor.execute('ALTER TABLE asn ADD COLUMN %s TEXT' % _c)
        except sqlite3.OperationalError:
            pass      # ya existia, o la tabla todavia no se creo: las dos estan bien

    # El Slotting vivía en el módulo 'inventario'. Ahora todo lo descargable está junto en
    # 'descargas', así que los que quedaron se mudan y no se pierde el historial.
    cursor.execute("UPDATE archivos_nube SET modulo = 'descargas' WHERE modulo = 'inventario'")

    # ── Áreas que pasaron a ser singleton después de haberse usado ──────────────
    # Un área normal guarda su dato bajo la fecha del día; una singleton lo guarda
    # bajo 'MASTER'. Cuando un área cambia de categoría, lo que ya estaba guardado
    # queda bajo una fecha y las lecturas nuevas buscan en 'MASTER': el dato sigue
    # ahí pero deja de encontrarse, y el área aparece vacía de un día para el otro.
    #
    # Esto le pasó al Maestro de Artículos, guardado bajo 2026-06-02.
    #
    # Se MUEVE la copia más reciente a 'MASTER' (no se copia: no tiene sentido tener
    # dos veces el mismo archivo de varios MB). Solo actúa si 'MASTER' todavía no
    # existe, así que correrlo mil veces da el mismo resultado que correrlo una.
    for area in SINGLETON_AREAS:
        try:
            ya_esta = cursor.execute(
                "SELECT 1 FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = 'MASTER'",
                (area,)).fetchone()
            if ya_esta:
                continue
            fila = cursor.execute(
                "SELECT snapshot_date FROM logistics_snapshots WHERE area_id = ? "
                "ORDER BY snapshot_date DESC LIMIT 1", (area,)).fetchone()
            if not fila:
                continue
            cursor.execute(
                "UPDATE logistics_snapshots SET snapshot_date = 'MASTER' "
                "WHERE area_id = ? AND snapshot_date = ?", (area, fila[0]))
            print(f"[PULSE] '{area}': la copia del {fila[0]} se movió a MASTER (ahora es un área singleton).")
        except Exception as e:
            print(f"[PULSE] No se pudo mover '{area}' a MASTER: {e}")

    # Base recién creada: se siembra UN administrador para poder entrar.
    # La contraseña NO está escrita en el código: sale de la variable de entorno
    # ADMIN_INITIAL_PASSWORD y, si no existe, se inventa una al azar y se anota
    # en el log del servidor. Así este archivo no revela ninguna credencial.
    if cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        clave_inicial = os.environ.get("ADMIN_INITIAL_PASSWORD") or secrets.token_urlsafe(12)
        cursor.execute(
            "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
            ("dames", hashear_password(clave_inicial), "Daniel Ames", "admin"))
        origen_clave = "ADMIN_INITIAL_PASSWORD" if os.environ.get("ADMIN_INITIAL_PASSWORD") else "generada al azar"
        print(f"[SEGURIDAD] Base nueva en {ruta}. Admin 'dames' creado. "
              f"Contraseña ({origen_clave}): {clave_inicial}")

    conn.commit()
    conn.close()
    prune_old_snapshots(ruta)

# CUÁNTOS DÍAS GUARDA CADA ÁREA CON FECHA.
#
# Por defecto son 2, que alcanza para lo que solo se mira en el momento. Pero hay
# cuadros que valen como historia y ahí 2 días no sirven.
#
# `pendiente_despacho` guarda UN MES por pedido de Daniel (21-ago-2026): *"que cada
# vez que se procese el pendiente se quede guardado en el servidor por un mes, y
# cada mes lo vas chancando"*. Y no cuesta nada: un día pesa 12 KB, así que el mes
# entero son 372 KB contra el disco de 1 GB del servidor —el 0,03%—.
# Las tres de la produccion del dia guardan un mes por la misma razon: la pantalla
# tiene filtro DE FECHA A FECHA y con dos dias no hay rango que elegir. Cuestan mas
# que el pendiente -picking 369 KB al dia, embalaje 199 y el cruce 57-, asi que el
# mes entero son unos 19 MB. Si el disco aprieta, el primero que hay que bajar es
# picking_por_hora, que es el mas gordo de los tres.
RETENCION_SNAPSHOTS = {
    'pendiente_despacho': 31,
    'picking_por_hora': 31,
    'embalaje_por_hora': 31,
    'cruce_wms': 31,
}
RETENCION_POR_DEFECTO = 2


def prune_old_snapshots(ruta: Optional[str] = None):
    """
    Conserva los snapshots más recientes de cada área que no sea singleton, para que
    el tamaño de la base no sature el disco del servidor. Cuántos, lo dice
    RETENCION_SNAPSHOTS; el resto se queda con los 2 de siempre.
    """
    try:
        conn = sqlite3.connect(ruta or db_path())
        cursor = conn.cursor()
        
        cursor.execute("SELECT DISTINCT area_id FROM logistics_snapshots")
        areas = [r[0] for r in cursor.fetchall()]
        
        for area in areas:
            if area in SINGLETON_AREAS:
                continue
            
            cursor.execute("SELECT snapshot_date FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
            dates = [r[0] for r in cursor.fetchall()]
            
            tope = RETENCION_SNAPSHOTS.get(area, RETENCION_POR_DEFECTO)
            if len(dates) > tope:
                to_delete = dates[tope:]
                placeholders = ','.join(['?'] * len(to_delete))
                cursor.execute(f"DELETE FROM logistics_snapshots WHERE area_id = ? AND snapshot_date IN ({placeholders})", [area] + to_delete)
                print(f"[PULSE] Borrados {len(to_delete)} snapshots antiguos del área {area}")
        conn.commit()
        # Intentar ejecutar VACUUM para liberar espacio. Si falla por falta de espacio temporal, se ignora
        # pero SQLite de todas formas reutilizará las páginas liberadas para futuras inserciones.
        try:
            cursor.execute("VACUUM")
            conn.commit()
            print("[PULSE] Base de datos optimizada (VACUUM completado).")
        except sqlite3.Error as ve:
            print(f"[PULSE] Omitido VACUUM (espacio insuficiente en disco), pero páginas liberadas: {ve}")
        conn.close()
    except Exception as e:
        print(f"[PULSE] Error al podar snapshots antiguos: {e}")

try:
    init_db()                       # producción
except Exception as startup_db_err:
    print(f"🚨 CRITICAL STARTUP ERROR INITIALIZING DB: {startup_db_err}")

try:
    init_db(DB_PATH_BETA)           # pruebas (vacía si es la primera vez)
    print(f"[PULSE] Entorno de PRUEBAS listo en: {DB_PATH_BETA}")
except Exception as beta_db_err:
    print(f"[PULSE] Aviso: no se pudo preparar la base de pruebas: {beta_db_err}")

# Seguridad: ninguna contraseña puede quedar en texto plano, en ninguna de las
# dos bases. Se ejecuta en cada arranque; si ya está todo migrado no hace nada.
for _ruta_db in (DB_PATH, DB_PATH_BETA):
    if os.path.exists(_ruta_db):
        _n = migrar_passwords(_ruta_db)
        _limpio = limpiar_passwords_del_snapshot(_ruta_db)
        if _n or _limpio:
            print(f"[SEGURIDAD] {_ruta_db}: {_n} contraseña(s) cifrada(s)"
                  + (", snapshot de usuarios limpiado" if _limpio else ""))


DIAS_QUE_SE_GUARDAN = 7


@app.post("/api/eventos")
async def registrar_eventos(request: Request):
    """Anota lo que pasa. Acepta uno o varios de una vez.

    NO PIDE CREDENCIAL, a proposito: el robot escribe desde el Contabo sin sesion, y un
    registro que se pierde por un candado no sirve de nada. Lo que se guarda no es
    sensible —quien, que y cuando— y `quien` lo manda el que escribe.

    NUNCA DEVUELVE ERROR AL QUE ESCRIBE. Si anotar falla, falla callado: que el registro
    se caiga no puede tumbar una tarea del turno.

    EL 02-sep-2026 SE LE PUSO EL CANDADO DE ESCRITURA Y SE LE VOLVIO A SACAR. Al cerrar
    los ocho endpoints que estaban abiertos, este entro en el lote por descuido: es el
    unico de los diecisiete que va sin candado A PROPOSITO, y esta escrito arriba. Lo
    que se guarda aca no es sensible y el robot no tiene sesion.
    """
    try:
        cuerpo = await request.json()
        filas = cuerpo if isinstance(cuerpo, list) else [cuerpo]
        ahora_txt = ahora().strftime("%Y-%m-%d %H:%M:%S")
        conn = sqlite3.connect(db_path())
        cur = conn.cursor()
        n = 0
        for e in filas[:500]:                       # tope por peticion, por las dudas
            if not isinstance(e, dict) or not e.get('accion'):
                continue
            cur.execute('INSERT INTO eventos (cuando, origen, quien, tipo, accion, detalle) '
                        'VALUES (?, ?, ?, ?, ?, ?)',
                        (str(e.get('cuando') or ahora_txt)[:19],
                         str(e.get('origen') or 'web')[:20],
                         str(e.get('quien') or '')[:60],
                         str(e.get('tipo') or 'ok')[:10],
                         str(e.get('accion'))[:200],
                         str(e.get('detalle') or '')[:2000]))
            n += 1
        # La limpieza va acá y no en una tarea aparte: una tarea mas es una cosa mas que
        # se puede quedar dormida sin que nadie lo note.
        corte = (ahora() - timedelta(days=DIAS_QUE_SE_GUARDAN)).strftime("%Y-%m-%d %H:%M:%S")
        cur.execute('DELETE FROM eventos WHERE cuando < ?', (corte,))
        borrados = cur.rowcount
        conn.commit()
        conn.close()
        return {"status": "ok", "guardados": n, "borrados": max(0, borrados)}
    except Exception as e:
        print(f"[EVENTOS] no se pudo anotar: {e}")
        return {"status": "ok", "guardados": 0}     # callado a proposito


@app.get("/api/eventos")
async def leer_eventos(dias: int = 7, origen: Optional[str] = None,
                       tipo: Optional[str] = None, q: Optional[str] = None,
                       limite: int = 1000):
    """Lo anotado, lo mas nuevo primero."""
    try:
        corte = (ahora() - timedelta(days=max(1, min(dias, DIAS_QUE_SE_GUARDAN)))
                 ).strftime("%Y-%m-%d %H:%M:%S")
        sql = 'SELECT cuando, origen, quien, tipo, accion, detalle FROM eventos WHERE cuando >= ?'
        args = [corte]
        if origen:
            sql += ' AND origen = ?'; args.append(origen)
        if tipo:
            sql += ' AND tipo = ?'; args.append(tipo)
        if q:
            sql += ' AND (accion LIKE ? OR detalle LIKE ? OR quien LIKE ?)'
            args += [f'%{q}%'] * 3
        sql += ' ORDER BY cuando DESC, id DESC LIMIT ?'
        args.append(max(1, min(limite, 5000)))
        conn = sqlite3.connect(db_path())
        cur = conn.cursor()
        filas = cur.execute(sql, args).fetchall()
        total = cur.execute('SELECT COUNT(*) FROM eventos').fetchone()[0]
        conn.close()
        return {"status": "ok", "total": total, "eventos": [
            {"cuando": f[0], "origen": f[1], "quien": f[2], "tipo": f[3],
             "accion": f[4], "detalle": f[5]} for f in filas]}
    except Exception as e:
        return {"status": "error", "message": str(e), "eventos": []}


# ══════════════════════════════════════════════════════════════════════════════
#  EL ASN: cargar y consultar
# ══════════════════════════════════════════════════════════════════════════════

ASN_COLS = ('asn', 'articulo', 'descripcion', 'marca', 'expediente', 'orden',
            'sociedad', 'tipo', 'estado', 'fecha_envio', 'fecha_recepcion',
            'hora_recepcion', 'usuario', 'enviado', 'recibido', 'lineas')


@app.post("/api/asn/carga")
async def cargar_asn(request: Request):
    """La carga del robot, en tres pasos.

    ESCRIBIR ACA EXIGE EL TOKEN DEL ROBOT SIEMPRE, sin importar como este el
    interruptor general: esta tabla la escribe un robot y nadie mas, asi que no
    hay motivo para dejarla abierta ni en modo aviso.

        {"paso": "inicio"}                  vacia la tabla de trabajo
        {"paso": "lote", "filas": [[...]]}  agrega un lote
        {"paso": "fin"}                     recien aca reemplaza la tabla buena

    Se escribe en `asn_cargando` y se cambia al final: si el robot se corta a la
    mitad, la tabla vieja sigue entera y la web sigue contestando.
    """
    if not token_de_robot_valido(request):
        return JSONResponse(status_code=403, content={
            "status": "error",
            "message": "Cargar el ASN necesita el token del robot."})
    try:
        cuerpo = await request.json()
        paso = str(cuerpo.get("paso") or "").strip()
        conn = sqlite3.connect(db_path())
        cur = conn.cursor()

        if paso == "inicio":
            cur.execute('DROP TABLE IF EXISTS asn_cargando')
            cur.execute('CREATE TABLE asn_cargando ('
                        'asn TEXT NOT NULL, articulo TEXT NOT NULL, descripcion TEXT, '
                        'marca TEXT, expediente TEXT, orden TEXT, sociedad TEXT, '
                        'tipo TEXT, estado TEXT, fecha_envio TEXT, fecha_recepcion TEXT, '
                        'hora_recepcion TEXT, usuario TEXT, '
                        'enviado INTEGER, recibido INTEGER, lineas INTEGER, '
                        'PRIMARY KEY (asn, articulo))')
            conn.commit(); conn.close()
            return {"status": "ok", "paso": "inicio"}

        if paso == "lote":
            filas = cuerpo.get("filas") or []
            if not isinstance(filas, list):
                conn.close()
                return {"status": "error", "message": "filas tiene que ser una lista"}
            cur.executemany(
                'INSERT OR REPLACE INTO asn_cargando VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [tuple(f)[:16] for f in filas if isinstance(f, (list, tuple)) and len(f) >= 16])
            conn.commit()
            n = cur.execute('SELECT COUNT(*) FROM asn_cargando').fetchone()[0]
            conn.close()
            return {"status": "ok", "paso": "lote", "recibidas": len(filas), "van": n}

        if paso == "fin":
            n = cur.execute('SELECT COUNT(*) FROM asn_cargando').fetchone()[0]
            # NO SE CAMBIA POR UNA TABLA VACIA. Si la carga fallo, quedarse con la
            # vieja es mucho mejor que quedarse sin nada.
            if n < 1000:
                conn.close()
                return JSONResponse(status_code=400, content={
                    "status": "error",
                    "message": "la carga trajo %d filas: son muy pocas, no se reemplaza" % n})
            cur.execute('DROP TABLE IF EXISTS asn')
            cur.execute('ALTER TABLE asn_cargando RENAME TO asn')
            for c in ('expediente', 'articulo', 'orden', 'tipo', 'fecha_envio', 'estado',
                      'fecha_recepcion', 'usuario'):
                cur.execute('CREATE INDEX IF NOT EXISTS idx_asn_%s ON asn (%s)' % (c, c))
            conn.commit(); conn.close()
            return {"status": "ok", "paso": "fin", "filas": n}

        conn.close()
        return {"status": "error", "message": "paso desconocido: %s" % paso}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/asn")
async def consultar_asn(expediente: Optional[str] = None, asn: Optional[str] = None,
                        articulo: Optional[str] = None, orden: Optional[str] = None,
                        tipo: Optional[str] = None, estado: Optional[str] = None,
                        marca: Optional[str] = None, usuario: Optional[str] = None,
                        desde: Optional[str] = None, hasta: Optional[str] = None,
                        rec_desde: Optional[str] = None, rec_hasta: Optional[str] = None,
                        pendiente: int = 0, recibido: int = 0, q: Optional[str] = None,
                        agrupar: Optional[str] = None,
                        limite: int = 200, pagina: int = 0):
    """Busca en los seis meses y devuelve SOLO lo que coincide.

    `q` busca en el ASN, el expediente, el articulo y la descripcion a la vez: es
    lo que se escribe en la caja cuando comercial avisa "va a entrar el 2026-178".
    Se aceptan las dos formas -2026-178 y 2026000178- porque el correo usa una y
    el WMS la otra.

    `agrupar` devuelve el resumen en vez del detalle: por expediente, por asn,
    por articulo, por tipo o por marca.
    """
    try:
        cond, args = [], []

        def like(campo, valor):
            cond.append('%s LIKE ?' % campo)
            args.append('%' + valor.strip() + '%')

        if expediente:
            # "2026-178" en el correo es "2026000178" en el WMS
            e = expediente.strip().replace('.', '-')
            m = re.match(r'^(\d{4})-0*(\d{1,6})$', e)
            if m:
                e = '%s%06d' % (m.group(1), int(m.group(2)))
            like('expediente', e)
        if asn:
            like('asn', asn)
        if articulo:
            like('articulo', articulo.strip().replace('-', ''))
        if orden:
            like('orden', orden)
        if tipo:
            cond.append('tipo = ?'); args.append(tipo.strip())
        if estado:
            cond.append('estado = ?'); args.append(estado.strip())
        if marca:
            cond.append('marca = ?'); args.append(marca.strip())
        if usuario:
            cond.append('usuario = ?'); args.append(usuario.strip())
        if desde:
            cond.append('fecha_envio >= ?'); args.append(desde.strip()[:10])
        if hasta:
            cond.append('fecha_envio <= ?'); args.append(hasta.strip()[:10])
        # POR FECHA DE RECEPCION, que es otra pregunta: `desde`/`hasta` filtran por
        # lo ANUNCIADO y esto por lo que ENTRO DE VERDAD. Daniel, 03-sep-2026:
        # *"quiero un reporte donde me digas lo que entro el dia de hoy, lo que se
        # recibio, tanto en importado como en nacional"*.
        if rec_desde:
            cond.append("fecha_recepcion <> '' AND fecha_recepcion >= ?")
            args.append(rec_desde.strip()[:10])
        if rec_hasta:
            cond.append("fecha_recepcion <> '' AND fecha_recepcion <= ?")
            args.append(rec_hasta.strip()[:10])
        if pendiente:
            cond.append('enviado > recibido')
        # Solo lo que trajo algo: sirve para "que entro" sin arrastrar las filas
        # que figuran en el mismo ASN pero no recibieron nada.
        if recibido:
            cond.append('recibido > 0')
        if q:
            t = q.strip()
            # el mismo truco del expediente, para que sirva escribir 2026-178
            m = re.match(r'^(\d{4})[-.]0*(\d{1,6})$', t)
            alt = '%s%06d' % (m.group(1), int(m.group(2))) if m else t
            cond.append('(asn LIKE ? OR expediente LIKE ? OR articulo LIKE ? '
                        'OR descripcion LIKE ? OR orden LIKE ?)')
            args += ['%' + t + '%', '%' + alt + '%',
                     '%' + t.replace('-', '') + '%', '%' + t + '%', '%' + t + '%']

        donde = (' WHERE ' + ' AND '.join(cond)) if cond else ''
        conn = sqlite3.connect(db_path())
        cur = conn.cursor()

        # el resumen SIEMPRE viaja: es barato y evita una segunda consulta
        tot = cur.execute(
            'SELECT COUNT(*), COALESCE(SUM(enviado),0), COALESCE(SUM(recibido),0), '
            'COUNT(DISTINCT asn), COUNT(DISTINCT expediente) FROM asn' + donde, args).fetchone()

        if agrupar in ('expediente', 'asn', 'articulo', 'tipo', 'marca', 'orden',
                       'usuario', 'hora_recepcion', 'fecha_recepcion'):
            lim = max(1, min(int(limite or 200), 2000))
            filas = cur.execute(
                'SELECT %s, COUNT(*), SUM(enviado), SUM(recibido), COUNT(DISTINCT asn), '
                'MIN(fecha_envio), MAX(fecha_envio) FROM asn%s GROUP BY %s '
                'ORDER BY SUM(enviado-recibido) DESC LIMIT ?'
                % (agrupar, donde, agrupar), args + [lim]).fetchall()
            conn.close()
            return {"status": "ok", "agrupado": agrupar,
                    "total": {"filas": tot[0], "enviado": tot[1], "recibido": tot[2],
                              "asn": tot[3], "expedientes": tot[4]},
                    "grupos": [{"clave": f[0], "filas": f[1], "enviado": f[2],
                                "recibido": f[3], "falta": (f[2] or 0) - (f[3] or 0),
                                "asn": f[4], "desde": f[5], "hasta": f[6]} for f in filas]}

        lim = max(1, min(int(limite or 200), 1000))
        off = max(0, int(pagina or 0)) * lim
        filas = cur.execute(
            'SELECT ' + ', '.join(ASN_COLS) + ' FROM asn' + donde +
            ' ORDER BY fecha_envio DESC, asn LIMIT ? OFFSET ?', args + [lim, off]).fetchall()
        conn.close()
        return {"status": "ok",
                "total": {"filas": tot[0], "enviado": tot[1], "recibido": tot[2],
                          "asn": tot[3], "expedientes": tot[4]},
                "pagina": off // lim, "limite": lim,
                "datos": [dict(zip(ASN_COLS, f)) for f in filas]}
    except Exception as e:
        return {"status": "error", "message": str(e), "datos": []}


@app.get("/api/health")
def health():
    try:
        db_size = os.path.getsize(db_path()) if os.path.exists(db_path()) else 0
        import shutil
        _, _, free = shutil.disk_usage(os.path.dirname(db_path()) or ".")
        return {
            "status": "ok",
            "entorno": entorno_actual(),
            "db_size_mb": db_size / (1024*1024),
            "disk_free_mb": free / (1024*1024),
            "timestamp": ahora().isoformat(),
            # Estado del candado de escritura -fase 3-. Sirve para saber si ya se puede
            # encender sin dejar a nadie fuera: cuando `escrituras_anonimas` deje de subir,
            # es que todos los robots y PC ya mandan token.
            "candado_escritura": {
                "exigiendo": _exigir_token_escritura(),
                "robot_token_puesto": bool(ROBOT_TOKEN),
                # El desglose va ordenado de mayor a menor: lo primero de la lista es
                # lo que hay que arreglar antes de encender.
                "escrituras_anonimas": {
                    **{k: v for k, v in _escrituras_anonimas.items()
                       if k not in ("por_area", "por_quien")},
                    "por_area": dict(sorted(_escrituras_anonimas["por_area"].items(),
                                            key=lambda p: -p[1])),
                    "por_quien": dict(sorted(_escrituras_anonimas["por_quien"].items(),
                                             key=lambda p: -p[1])),
                }
            }
        }
    except Exception as e: return {"status": "error", "message": str(e)}


# -----------------------------------------------------------------------------
# ENTORNOS: consulta y copia de datos producción -> pruebas
# -----------------------------------------------------------------------------

def _mb(ruta: str) -> float:
    try:
        return round(os.path.getsize(ruta) / (1024*1024), 2) if os.path.exists(ruta) else 0.0
    except OSError:
        return 0.0


@app.get("/api/admin/entornos")
def estado_entornos(detalle: bool = False, top: int = 25):
    """
    Radiografía de los dos entornos: qué tan grandes son y cuánto disco queda.

    Con ?detalle=true agrega el desglose de qué áreas están ocupando el espacio
    en producción, y `en_que_se_va`, que cierra la cuenta del archivo entero:
    cuánto son datos, cuánto son páginas libres que recuperaría un VACUUM, y
    cuánto queda sin explicar.

    ?top=N cambia cuántas áreas trae el desglose (25 por defecto, 500 como tope).
    Con top=25 la suma NO cuadra con el tamaño del archivo, y no es un error: son
    las 25 más pesadas de 77.
    """
    try:
        _, _, libre = shutil.disk_usage(os.path.dirname(DB_PATH) or ".")
        respuesta = {
            "status": "ok",
            "atendiendo_como": entorno_actual(),
            "produccion": {"archivo": DB_PATH, "existe": os.path.exists(DB_PATH), "tamano_mb": _mb(DB_PATH)},
            "pruebas": {"archivo": DB_PATH_BETA, "existe": os.path.exists(DB_PATH_BETA), "tamano_mb": _mb(DB_PATH_BETA)},
            "disco_libre_mb": round(libre / (1024*1024), 2),
        }

        if detalle and os.path.exists(DB_PATH):
            conn = sqlite3.connect(DB_PATH)
            try:
                filas = conn.execute("""
                    SELECT area_id,
                           COUNT(*)               AS copias,
                           SUM(LENGTH(data_json)) AS bytes
                    FROM logistics_snapshots
                    GROUP BY area_id
                    ORDER BY bytes DESC
                    LIMIT :tope
                """, {"tope": max(1, min(int(top or 25), 500))}).fetchall()

                # ── EN QUÉ SE VA EL ARCHIVO, SIN SUPONER NADA ────────────────────
                #
                # El detalle de arriba trae solo las áreas más pesadas, así que su
                # suma NUNCA cuadra con el tamaño del archivo. El 26-ago-2026 esa
                # resta —347 MB de archivo contra 295 MB de las 25 listadas— se leyó
                # como "50 MB de espacio desperdiciado", y era una conjetura: había
                # 77 áreas, no 25. Estas tres cifras cierran la cuenta de verdad.
                #
                # OJO CON LENGTH(): sobre TEXT cuenta CARACTERES, no bytes. Una tilde
                # ocupa 2 bytes en UTF-8 y cuenta como 1. Por eso se mide aparte con
                # LENGTH(CAST(... AS BLOB)), que sí devuelve bytes.
                total_areas, copias, chars, bytes_reales = conn.execute("""
                    SELECT COUNT(DISTINCT area_id), COUNT(*),
                           SUM(LENGTH(data_json)),
                           SUM(LENGTH(CAST(data_json AS BLOB)))
                    FROM logistics_snapshots
                """).fetchone()

                # Páginas que SQLite ya no usa y no devolvió al disco: esto es lo que
                # un VACUUM recupera de verdad. Ni más ni menos.
                libres = conn.execute("PRAGMA freelist_count").fetchone()[0]
                pagina = conn.execute("PRAGMA page_size").fetchone()[0]

                # Todo lo que no son snapshots: usuarios, permisos, auditoría, KPIs...
                otras = {}
                for t in ('users', 'role_permissions', 'buffer_config', 'audit_logs',
                          'shared_data', 'buffer_history', 'buffer_kpi_results'):
                    try:
                        n = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                        if n:
                            otras[t] = n
                    except Exception:
                        pass   # la tabla puede no existir en bases viejas
            finally:
                conn.close()

            respuesta["areas_mas_pesadas"] = [
                {"area": f[0], "copias_guardadas": f[1], "peso_mb": round((f[2] or 0) / (1024*1024), 2)}
                for f in filas
            ]
            archivo_mb = respuesta["produccion"]["tamano_mb"]
            datos_mb = round((bytes_reales or 0) / (1024*1024), 2)
            libres_mb = round((libres * pagina) / (1024*1024), 2)
            respuesta["en_que_se_va"] = {
                "areas_distintas": total_areas,
                "copias_guardadas": copias,
                "datos_mb": datos_mb,
                "datos_mb_sin_contar_tildes": round((chars or 0) / (1024*1024), 2),
                "paginas_libres_mb": libres_mb,
                "recupera_un_vacuum_mb": libres_mb,
                "sin_explicar_mb": round(archivo_mb - datos_mb - libres_mb, 2),
                "otras_tablas_filas": otras,
            }

        return respuesta
    except Exception as e:
        return {"status": "error", "message": str(e)}


# Tablas chicas (usuarios, permisos, configuración...): se copian enteras.
TABLAS_LIGERAS = ['users', 'role_permissions', 'buffer_config', 'shared_data',
                  'buffer_history', 'buffer_kpi_results']

# En la copia ligera, un snapshot más pesado que esto se deja fuera (suelen ser
# cachés de fotos: no aportan nada a una prueba y se llevan casi todo el disco).
LIMITE_SNAPSHOT_MB = 8.0


def _clonar_ligera(limite_mb: float) -> dict:
    """
    Arma la base de PRUEBAS desde cero copiando de producción solo lo útil:
      - las tablas chicas completas (usuarios, permisos, configuración, ...)
      - de cada área, únicamente su versión más reciente
      - saltando las áreas cuyo contenido pese más que el límite

    Nunca escribe en producción: la abre solo para leer.
    """
    resumen = {"tablas_copiadas": {}, "areas_copiadas": 0, "areas_omitidas": []}

    if os.path.exists(DB_PATH_BETA):
        os.remove(DB_PATH_BETA)
    init_db(DB_PATH_BETA)                      # crea la estructura vacía

    origen = sqlite3.connect(DB_PATH)
    destino = sqlite3.connect(DB_PATH_BETA)
    try:
        cur_o, cur_d = origen.cursor(), destino.cursor()

        # 1) Tablas chicas, completas
        for tabla in TABLAS_LIGERAS:
            try:
                filas = cur_o.execute(f"SELECT * FROM {tabla}").fetchall()
            except sqlite3.Error:
                continue                        # esa tabla no existe en el origen
            cur_d.execute(f"DELETE FROM {tabla}")
            if filas:
                marcadores = ",".join(["?"] * len(filas[0]))
                cur_d.executemany(f"INSERT INTO {tabla} VALUES ({marcadores})", filas)
            resumen["tablas_copiadas"][tabla] = len(filas)

        # 2) Áreas: solo la versión más reciente de cada una, y solo si no pesa demasiado
        cur_d.execute("DELETE FROM logistics_snapshots")
        limite_bytes = int(limite_mb * 1024 * 1024)
        areas = [r[0] for r in cur_o.execute("SELECT DISTINCT area_id FROM logistics_snapshots")]

        for area in areas:
            fila = cur_o.execute("""
                SELECT area_id, snapshot_date, data_json, updated_at, LENGTH(data_json)
                FROM logistics_snapshots
                WHERE area_id = ?
                ORDER BY snapshot_date DESC
                LIMIT 1
            """, (area,)).fetchone()
            if not fila:
                continue

            peso = fila[4] or 0
            if peso > limite_bytes:
                resumen["areas_omitidas"].append(
                    {"area": area, "peso_mb": round(peso / (1024*1024), 2)})
                continue

            cur_d.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
            """, fila[:4])
            resumen["areas_copiadas"] += 1

        destino.commit()
    finally:
        destino.close()
        origen.close()

    return resumen


@app.post("/api/admin/clonar-a-beta")
def clonar_produccion_a_beta(request: Request, confirmar: str = "", modo: str = "ligera",
                             limite_mb: float = LIMITE_SNAPSHOT_MB):
    """
    Copia datos de PRODUCCIÓN al entorno de PRUEBAS.

    La dirección es SIEMPRE producción -> pruebas. Nunca al revés: este endpoint
    abre producción en modo lectura y jamás le escribe.

      modo=ligera   (por defecto) solo lo útil para probar; ocupa poco disco
      modo=completa  copia byte por byte; necesita tanto espacio como la base real

    Hay que confirmar a propósito:
      POST /api/admin/clonar-a-beta?confirmar=COPIAR-A-BETA
    """
    # CANDADO DE ADMIN. No toca produccion -solo copia hacia beta-, pero igual queda
    # detras del token: no hay razon para que un anonimo lo dispare. El ?confirmar=
    # sigue siendo un segundo freno contra el descuido, no contra un atacante.
    if not es_admin(request):
        return JSONResponse(status_code=403, content={
            "status": "error", "message": "Solo un administrador con la sesion iniciada puede hacer esto."})

    if confirmar != "COPIAR-A-BETA":
        return {"status": "error",
                "message": "Falta la confirmación. Agrega ?confirmar=COPIAR-A-BETA a la URL."}

    if not os.path.exists(DB_PATH):
        return {"status": "error", "message": "No existe la base de producción; no hay nada que copiar."}

    modo = (modo or "ligera").strip().lower()
    if modo not in ("ligera", "completa"):
        return {"status": "error", "message": "El modo debe ser 'ligera' o 'completa'."}

    try:
        carpeta = os.path.dirname(DB_PATH) or "."
        tamano_origen = os.path.getsize(DB_PATH)

        # El archivo viejo de pruebas se borra primero: libera su espacio y evita
        # que la copia tenga que convivir con la versión anterior.
        if os.path.exists(DB_PATH_BETA):
            os.remove(DB_PATH_BETA)

        _, _, libre = shutil.disk_usage(carpeta)

        if modo == "completa":
            necesario = tamano_origen * 1.15 + (20 * 1024 * 1024)   # 15% de holgura + 20MB
        else:
            necesario = 50 * 1024 * 1024                            # a la ligera le sobra con esto

        if libre < necesario:
            return {"status": "error",
                    "message": (f"Espacio insuficiente. La copia '{modo}' necesita ~{necesario/(1024*1024):.0f}MB "
                                f"y solo hay {libre/(1024*1024):.0f}MB libres. No se copió nada.")}

        if modo == "completa":
            # backup() de SQLite: copia consistente aunque el servidor esté atendiendo.
            origen = sqlite3.connect(DB_PATH)
            destino = sqlite3.connect(DB_PATH_BETA)
            try:
                origen.backup(destino)
            finally:
                destino.close()
                origen.close()
            detalle = {"modo": "completa"}
        else:
            detalle = _clonar_ligera(limite_mb)
            detalle["modo"] = "ligera"
            detalle["limite_por_area_mb"] = limite_mb

        _, _, libre_despues = shutil.disk_usage(carpeta)

        return {
            "status": "ok",
            "message": f"Datos de producción copiados al entorno de pruebas (copia {modo}).",
            "copiado_mb": _mb(DB_PATH_BETA),
            "produccion_mb": _mb(DB_PATH),
            "disco_libre_mb": round(libre_despues / (1024*1024), 2),
            "produccion_intacta": True,
            "detalle": detalle,
            "timestamp": ahora().isoformat(),
        }
    except Exception as e:
        return {"status": "error", "message": f"No se pudo copiar: {e}"}


@app.get("/api/sync/versiones")
def versiones_de_areas():
    """
    Cuándo cambió por última vez cada área, todo en una sola llamada diminuta.

    La web la consulta antes de sincronizar y descarga SOLO las áreas cuya marca
    cambió. Antes bajaba las 14 áreas completas cada 30 segundos (unos 930 KB
    comprimidos), hubiera habido cambios o no.

    Solo interesa saber si la marca es distinta a la que ya tiene el navegador,
    no compararlas entre sí, así que da igual el formato exacto de la fecha.
    """
    try:
        conn = sqlite3.connect(db_path())
        filas = conn.execute(
            "SELECT area_id, MAX(updated_at) FROM logistics_snapshots GROUP BY area_id"
        ).fetchall()
        conn.close()
        return {"status": "ok",
                "entorno": entorno_actual(),
                "versiones": {f[0]: f[1] for f in filas}}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/api/logistics/{area}/{snapshot_date}")
def borrar_snapshot(area: str, snapshot_date: str, request: Request):
    """Borra UN dia de UN area. Para quitar una jornada mal metida -una fecha
    tecleada mal, o un dato de prueba-. Exige admin: es destructivo y no lo llama
    ningun robot. Nunca toca 'MASTER' -los datos singleton- ni el area 'users'."""
    if not es_admin(request):
        return JSONResponse(status_code=403, content={
            "status": "error", "message": "Solo un administrador con la sesion iniciada puede borrar un dia."})
    if snapshot_date == "MASTER" or area == "users":
        return JSONResponse(status_code=400, content={
            "status": "error", "message": "No se puede borrar por aca un dato maestro ni los usuarios."})
    try:
        conn = sqlite3.connect(db_path()); cur = conn.cursor()
        cur.execute("DELETE FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?",
                    (area, snapshot_date))
        n = cur.rowcount
        conn.commit(); conn.close()
        return {"status": "success", "area": area, "date": snapshot_date, "borrados": n}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/logistics/{area}/dates")
def list_area_dates(area: str):
    try:
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT snapshot_date FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
        dates = [r[0] for r in cursor.fetchall()]
        conn.close()
        return {"area": area, "dates": dates}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/logistics/{area}")
def get_area_data(area: str, date: Optional[str] = None):
    try:
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        
        # ÁREAS SINGLETON (Siempre un solo registro maestro)
        
        if area == 'users':
            # Auto-saneamiento: si el snapshot y la tabla 'users' no coinciden, manda
            # el snapshot para ALTAS/BAJAS y datos, pero NUNCA toca las contraseñas
            # (el snapshot ya no las guarda; viven solo aquí, cifradas).
            cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = 'users' AND snapshot_date = 'MASTER'")
            snap_row = cursor.fetchone()
            if snap_row:
                snap_users = json.loads(snap_row[0])
                cursor.execute("SELECT username FROM users")
                db_usernames = {r[0] for r in cursor.fetchall()}
                snap_usernames = {u.get('username') for u in snap_users if u.get('username')}

                # LAS BAJAS solo si de verdad cambio el conjunto de usuarios: borrar
                # es irreversible y no se hace por un cambio de rol.
                if db_usernames != snap_usernames:
                    if snap_usernames:
                        cursor.execute("DELETE FROM users WHERE username NOT IN ({})".format(','.join(['?']*len(snap_usernames))), list(snap_usernames))
                    else:
                        cursor.execute("DELETE FROM users")

                # LOS DATOS se copian SIEMPRE, no solo cuando hay altas o bajas.
                # El comentario de arriba decia "y datos", pero el bucle estaba dentro
                # del if: cambiarle el rol o el tema a alguien que ya existia no altera
                # el conjunto de usuarios, asi que no se escribia nunca y el cambio se
                # perdia en silencio. Aparecio al guardar el tema de un usuario: el
                # panel lo mostraba puesto y el servidor seguia sin saberlo.
                for u in snap_users:
                    username = u.get('username')
                    name = u.get('name')
                    role = u.get('role')
                    active = 1 if u.get('active', True) else 0
                    if not (username and name and role):
                        continue

                    if username in db_usernames:
                        # Ya existía: se actualizan sus datos, su contraseña queda como está.
                        cursor.execute(
                            "UPDATE users SET name=?, role=?, active=?, tema=? WHERE username=?",
                            (name, role, active, u.get('tema') or None, username))
                    else:
                        # Usuario nuevo que solo aparece en el snapshot: se crea con una
                        # contraseña imposible de adivinar. Hay que asignarle una desde
                        # el panel para que pueda entrar.
                        cursor.execute("""
                            INSERT INTO users (username, password, name, role, active, tema)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(username) DO UPDATE SET
                                name=excluded.name,
                                role=excluded.role,
                                active=excluded.active,
                                tema=excluded.tema
                        """, (username, hashear_password(secrets.token_urlsafe(24)), name, role, active,
                              u.get('tema') or None))
                conn.commit()

            # IMPORTANTE: la contraseña NO se devuelve nunca. Solo se informa si el
            # usuario tiene una asignada, para que el panel pueda mostrarlo.
            cursor.execute("SELECT username, name, role, active, password, tema FROM users")
            rows = cursor.fetchall()
            data = [{"username": r[0], "name": r[1], "role": r[2],
                     "active": bool(r[3]), "tiene_password": bool(r[4]),
                     "tema": r[5]} for r in rows]
            conn.close()
            return {"area": "users", "data": data}
            
        if area == 'permissions':
            # Intentar primero cargar desde el snapshot JSON (donde escribe POST)
            cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", ("permissions", "MASTER"))
            row = cursor.fetchone()
            if row:
                data = json.loads(row[0])
                conn.close()
                return {"area": "permissions", "data": data}
            
            # Si no hay snapshot guardado, usar la tabla de fallback role_permissions
            cursor.execute("SELECT role, module, allowed FROM role_permissions")
            rows = cursor.fetchall()
            data = {}
            for r in rows:
                if r[0] not in data: data[r[0]] = {}
                data[r[0]][r[1]] = bool(r[2])
            conn.close()
            return {"area": "permissions", "data": data}

        # Lógica de búsqueda optimizada
        if area in SINGLETON_AREAS:
            cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, "MASTER"))
        elif date:
            cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, date))
        else:
            cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC LIMIT 1", (area,))
        
        row = cursor.fetchone(); conn.close()
        if row:
            data = json.loads(row[0])
            if area == 'no_retail_cache' and isinstance(data, dict):
                for key, val in data.items():
                    if isinstance(val, dict):
                        if val.get('fotoCargo'):
                            val['fotoCargo'] = 'present'
                        if val.get('fotoLocal'):
                            val['fotoLocal'] = 'present'
            return {"area": area, "data": data, "updated_at": row[1]}
        
        # Valor por defecto según el área
        DEFAULT_OBJECTS = ['attendance', 'permissions', 'config', 'no_retail_cache']
        return {"area": area, "data": {} if area in DEFAULT_OBJECTS else []}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/logistics/{area}")
async def save_area_data(area: str, request: Request, date: Optional[str] = None):
    try:
        # 'users' tiene su propio candado de admin mas abajo. Las demas areas pasan por
        # el control de escritura: en modo aviso no frena, con el interruptor encendido
        # exige token de robot o de sesion.
        if area != 'users':
            _bloqueo = _control_escritura(request, area)
            if _bloqueo is not None:
                return _bloqueo
        payload_data = await request.json()

        # Las contraseñas que lleguen se procesan aparte y JAMÁS se escriben en el
        # snapshot: ahí solo van los datos públicos del usuario.
        # ESCRIBIR USUARIOS EXIGE SER ADMIN. Es la unica area con candado: mas abajo
        # esta operacion BORRA a todo el que no venga en la lista, asi que sin esto una
        # peticion anonima deja a Daniel fuera y se crea un admin propio.
        if area == 'users':
            if not es_admin(request):
                return JSONResponse(status_code=403, content={
                    "status": "error",
                    "message": "Solo un administrador con la sesion iniciada puede cambiar usuarios."})

            # NUNCA DEJAR LA PLATAFORMA SIN ADMINISTRADOR ACTIVO. Esta operacion borra a
            # todo el que no venga en la lista, asi que un envio incompleto -o un descuido
            # en la pantalla- deja cero admins y a nadie con que volver a entrar.
            #
            # VA ACA ARRIBA, ANTES DE ESCRIBIR NADA. Puesto mas abajo -junto al DELETE de la
            # tabla- ya era tarde: el snapshot se escribe primero, y al LEER /logistics/users
            # la auto-sanitizacion copia ese snapshot a la tabla. El 400 llegaba, pero el
            # dato malo ya estaba puesto. Comprobado: dejaba la base en un solo asistente.
            if isinstance(payload_data, list):
                hay_admin = any(isinstance(u, dict) and u.get('role') == 'admin'
                                and u.get('active', True) for u in payload_data)
                if not hay_admin:
                    return JSONResponse(status_code=400, content={
                        "status": "error",
                        "message": "La operacion dejaria la plataforma sin ningun administrador "
                                   "activo. Tiene que quedar al menos uno."})

        passwords_recibidas = {}
        if area == 'users' and isinstance(payload_data, list):
            limpio = []
            for u in payload_data:
                if not isinstance(u, dict):
                    continue
                usuario = u.get('username')
                clave = u.get('password')
                if usuario and clave:
                    passwords_recibidas[usuario] = clave
                limpio.append({k: v for k, v in u.items() if k != 'password'})
            payload_data = limpio

        json_string = json.dumps(payload_data)

        # ÁREAS SINGLETON (Ignoran fecha y usan 'MASTER')
        
        target_date = "MASTER" if area in SINGLETON_AREAS else (date if date else ahora().strftime("%Y-%m-%d"))
        
        if area == 'no_retail_cache' and isinstance(payload_data, dict):
            conn = sqlite3.connect(db_path()); cursor = conn.cursor()
            cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = 'no_retail_cache' AND snapshot_date = 'MASTER'")
            row = cursor.fetchone()
            existing_cache = {}
            if row:
                try:
                    existing_cache = json.loads(row[0])
                    if not isinstance(existing_cache, dict):
                        existing_cache = {}
                except Exception:
                    existing_cache = {}
            existing_cache.update(payload_data)
            json_string = json.dumps(existing_cache)
            cursor.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """, (area, "MASTER", json_string, ahora().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit(); conn.close()
        else:
            conn = sqlite3.connect(db_path()); cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """, (area, target_date, json_string, ahora().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit(); conn.close()

        # [MOD v25.1.28] Sincronización explícita con la tabla 'users' para mantener el login operativo
        # [SEGURIDAD] Si un usuario llega SIN contraseña, se conserva la que ya tenía.
        # Antes esto borraba la clave de todos, porque la web ya no las descarga.
        if area == 'users' and isinstance(payload_data, list):
            conn = sqlite3.connect(db_path()); cursor = conn.cursor()

            existentes = {r[0] for r in cursor.execute("SELECT username FROM users").fetchall()}

            sent_usernames = [u.get('username') for u in payload_data if u.get('username')]
            if sent_usernames:
                cursor.execute("DELETE FROM users WHERE username NOT IN ({})".format(','.join(['?']*len(sent_usernames))), sent_usernames)
            else:
                cursor.execute("DELETE FROM users")

            for u in payload_data:
                username = u.get('username')
                name = u.get('name')
                role = u.get('role')
                active = 1 if u.get('active', True) else 0
                if not (username and name and role):
                    continue

                clave_nueva = passwords_recibidas.get(username)

                if clave_nueva:
                    # Llegó contraseña: se guarda su huella (nunca el texto).
                    guardada = clave_nueva if es_hash(clave_nueva) else hashear_password(clave_nueva)
                    cursor.execute("""
                        INSERT INTO users (username, password, name, role, active)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(username) DO UPDATE SET
                            password=excluded.password,
                            name=excluded.name,
                            role=excluded.role,
                            active=excluded.active
                    """, (username, guardada, name, role, active))
                elif username in existentes:
                    # Sin contraseña y ya existía: se respeta la que tiene.
                    cursor.execute(
                        "UPDATE users SET name=?, role=?, active=? WHERE username=?",
                        (name, role, active, username))
                else:
                    # Usuario nuevo sin contraseña: se crea bloqueado hasta que se le
                    # asigne una desde el panel (no puede entrar con clave vacía).
                    cursor.execute("""
                        INSERT INTO users (username, password, name, role, active)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(username) DO UPDATE SET
                            name=excluded.name,
                            role=excluded.role,
                            active=excluded.active
                    """, (username, hashear_password(secrets.token_urlsafe(24)), name, role, active))

            conn.commit(); conn.close()
        
        # Podar snapshots antiguos si el área guardada no es singleton para liberar espacio
        if area not in SINGLETON_AREAS:
            prune_old_snapshots()
        
        return {"status": "success", "area": area, "date": target_date}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/workers")
async def restore_workers(request: Request):
    try:
        # CANDADO DE ADMIN. Este endpoint puede rehacer o borrar datos y NADIE lo llama
        # desde el codigo -ni la web ni los robots-: es una operacion manual. Sin token de
        # admin, una peticion anonima podia dispararlo. Ver `es_admin` en este mismo archivo.
        if not es_admin(request):
            return JSONResponse(status_code=403, content={
                "status": "error", "message": "Solo un administrador con la sesion iniciada puede hacer esto."})
        data = await request.json()
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        # Los trabajadores se guardan como un snapshot especial 'workers' con fecha 'MASTER'
        cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json) VALUES (?, ?, ?) ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json", ("workers", "MASTER", json.dumps(data)))
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{len(data)} trabajadores restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/users")
async def restore_users(request: Request):
    try:
        # Mismo candado que la escritura normal: esta ruta puede sobrescribir la
        # contrasena de cualquiera, incluida la del administrador.
        if not es_admin(request):
            return JSONResponse(status_code=403, content={
                "status": "error",
                "message": "Solo un administrador con la sesion iniciada puede restaurar usuarios."})
        data = await request.json()
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        for u in data:
            # La contraseña se guarda siempre como huella, nunca en texto plano.
            clave = u.get('password')
            guardada = clave if es_hash(clave) else hashear_password(clave or secrets.token_urlsafe(24))
            cursor.execute("INSERT INTO users (username, password, name, role, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET password=excluded.password, name=excluded.name, role=excluded.role, active=excluded.active", (u['username'], guardada, u['name'], u['role'], u.get('active', 1)))
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{len(data)} usuarios restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/permissions")
async def restore_permissions(request: Request):
    try:
        # CANDADO DE ADMIN. Este endpoint puede rehacer o borrar datos y NADIE lo llama
        # desde el codigo -ni la web ni los robots-: es una operacion manual. Sin token de
        # admin, una peticion anonima podia dispararlo. Ver `es_admin` en este mismo archivo.
        if not es_admin(request):
            return JSONResponse(status_code=403, content={
                "status": "error", "message": "Solo un administrador con la sesion iniciada puede hacer esto."})
        data = await request.json()
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        for p in data:
            cursor.execute("INSERT INTO role_permissions (role, module, allowed) VALUES (?, ?, ?) ON CONFLICT(role, module) DO UPDATE SET allowed=excluded.allowed", (p['role'], p['module'], p['allowed']))
        conn.commit(); conn.close()
        return {"status": "success", "message": "Permisos restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/performance_history")
async def restore_performance(request: Request):
    try:
        # CANDADO DE ADMIN. Este endpoint puede rehacer o borrar datos y NADIE lo llama
        # desde el codigo -ni la web ni los robots-: es una operacion manual. Sin token de
        # admin, una peticion anonima podia dispararlo. Ver `es_admin` en este mismo archivo.
        if not es_admin(request):
            return JSONResponse(status_code=403, content={
                "status": "error", "message": "Solo un administrador con la sesion iniciada puede hacer esto."})
        data = await request.json() # Esperamos un objeto { "YYYY-MM-DD": [records], ... }
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        count = 0
        for date, records in data.items():
            cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json) VALUES (?, ?, ?) ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json", ("performance", date, json.dumps(records)))
            count += 1
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{count} días de historial restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.patch("/api/logistics/{area}")
async def patch_area_data(area: str, request: Request, date: Optional[str] = None):
    try:
        if area != 'users':
            _bloqueo = _control_escritura(request, area)
            if _bloqueo is not None:
                return _bloqueo
        partial_data = await request.json()
        
        target_date = "MASTER" if area in SINGLETON_AREAS else (date if date else ahora().strftime("%Y-%m-%d"))
        
        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        
        cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, target_date))
        row = cursor.fetchone()
        
        existing_data = []
        if row:
            try:
                existing_data = json.loads(row[0])
            except:
                pass
                
        if not isinstance(existing_data, list):
            existing_data = []
            
        if 'id' in partial_data:
            task_id = partial_data['id']
            found = False
            for i, item in enumerate(existing_data):
                if isinstance(item, dict) and item.get('id') == task_id:
                    existing_data[i] = partial_data
                    found = True
                    break
            if not found:
                existing_data.append(partial_data)
        else:
            existing_data.append(partial_data)
            
        json_string = json.dumps(existing_data)
        cursor.execute("""
            INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (area, target_date, json_string, ahora().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close()
        
        return {"status": "success", "area": area, "date": target_date, "message": "Parcialmente actualizado"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/buffer/config")
def get_buffer_config():
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM buffer_config")
        rows = cursor.fetchall()
        conn.close()
        
        config = {r[0]: r[1] for r in rows}
        
        # Default values if keys aren't set yet
        defaults = {
            "include_reserva": "1",
            "include_alto": "1",
            "include_piso": "1",
            "include_aereo": "1",
            "include_logico": "1",
            "include_merma": "1"
        }
        
        for k, v in defaults.items():
            if k not in config:
                config[k] = v
                
        return {"status": "success", "data": config}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/buffer/config")
async def save_buffer_config(request: Request):
    # CANDADO DE ESCRITURA. En modo aviso no frena: cuenta las anonimas para el
    # /health. Con EXIGIR_TOKEN_ESCRITURA=true exige sesion o token del robot.
    _bloqueo = _control_escritura(request, "buffer_config")
    if _bloqueo is not None:
        return _bloqueo
    try:
        data = await request.json()  # Expecting dictionary of key-value configurations
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        for k, v in data.items():
            cursor.execute("""
                INSERT INTO buffer_config (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
            """, (k, str(v)))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Configuración de Buffer guardada"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Intentos fallidos recientes por usuario, para frenar el probar-claves-a-lo-loco.
_intentos_fallidos = {}


@app.post("/api/auth/login")
async def api_login(request: Request):
    """
    Verifica usuario y contraseña EN EL SERVIDOR contra la huella guardada.
    La contraseña nunca sale de aquí ni se devuelve en ninguna respuesta.
    """
    try:
        body = await request.json()
        usuario = str(body.get("username") or "").strip()
        clave = body.get("password")

        if not usuario or not clave:
            return {"success": False, "message": "Faltan usuario o contraseña"}

        # Freno progresivo: cada fallo reciente añade espera, hasta 2 segundos.
        fallos = _intentos_fallidos.get(usuario.lower(), 0)
        if fallos:
            time.sleep(min(0.25 * fallos, 2.0))

        conn = sqlite3.connect(db_path()); cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, name, role, password, active FROM users WHERE LOWER(username) = LOWER(?)",
            (usuario,))
        row = cursor.fetchone()
        conn.close()

        # Mensaje único para usuario inexistente y contraseña mala: no le decimos
        # a nadie cuáles usuarios existen.
        if not row or not verificar_password(clave, row[4]):
            _intentos_fallidos[usuario.lower()] = min(fallos + 1, 20)
            return {"success": False, "message": "Usuario o contraseña incorrectos"}

        if not row[5]:
            return {"success": False, "message": "Usuario inactivo o desactivado"}

        _intentos_fallidos.pop(usuario.lower(), None)
        # El token es lo unico que autoriza tocar los usuarios. Se entrega SOLO aca,
        # despues de comprobar la contrasena contra la huella guardada.
        token = crear_sesion(row[1], row[3])
        return {"success": True, "token": token,
                "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
    except Exception as e:
        return {"success": False, "message": "No se pudo validar el acceso", "detalle": str(e)}

@app.post("/api/admin/db_cleanup")
def force_db_cleanup(request: Request):
    # CANDADO DE ADMIN: reconstruye la base entera; jamas debe correr anonimo.
    if not es_admin(request):
        return JSONResponse(status_code=403, content={
            "status": "error", "message": "Solo un administrador con la sesion iniciada puede hacer esto."})
    temp_db_path = "/tmp/temp_database.db"
    try:
        import shutil
        db_size_before = os.path.getsize(db_path()) if os.path.exists(db_path()) else 0
        _, _, free_before = shutil.disk_usage(os.path.dirname(db_path()) or ".")
        
        # Remove any leftover temp database from previous failed attempts
        if os.path.exists(temp_db_path):
            try: os.remove(temp_db_path)
            except: pass
            
        # Connect to both databases
        src_conn = sqlite3.connect(db_path())
        src_cursor = src_conn.cursor()
        
        dst_conn = sqlite3.connect(temp_db_path)
        dst_cursor = dst_conn.cursor()
        
        # Create schema in the temp database
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (area_id, snapshot_date))')
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, module TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY (role, module))')
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS buffer_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        dst_cursor.execute('CREATE TABLE IF NOT EXISTS shared_data (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        
        # Copy users
        try:
            src_cursor.execute("SELECT id, username, password, name, role, active, created_at FROM users")
            for row in src_cursor.fetchall():
                dst_cursor.execute("INSERT INTO users (id, username, password, name, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", row)
        except Exception as ue: print(f"Copy users err: {ue}")
            
        # Copy role_permissions
        try:
            src_cursor.execute("SELECT role, module, allowed FROM role_permissions")
            for row in src_cursor.fetchall():
                dst_cursor.execute("INSERT INTO role_permissions (role, module, allowed) VALUES (?, ?, ?)", row)
        except Exception as pe: print(f"Copy permissions err: {pe}")
            
        # Copy buffer_config
        try:
            src_cursor.execute("SELECT key, value FROM buffer_config")
            for row in src_cursor.fetchall():
                dst_cursor.execute("INSERT INTO buffer_config (key, value) VALUES (?, ?)", row)
        except Exception as ce: print(f"Copy config err: {ce}")
            
        # Copy audit_logs
        try:
            src_cursor.execute("SELECT id, username, action, created_at FROM audit_logs")
            for row in src_cursor.fetchall():
                dst_cursor.execute("INSERT INTO audit_logs (id, username, action, created_at) VALUES (?, ?, ?, ?)", row)
        except Exception as ae: print(f"Copy audit_logs err: {ae}")
            
        # Copy shared_data
        try:
            src_cursor.execute("SELECT key, value_json, updated_by, updated_at FROM shared_data")
            for row in src_cursor.fetchall():
                dst_cursor.execute("INSERT INTO shared_data (key, value_json, updated_by, updated_at) VALUES (?, ?, ?, ?)", row)
        except Exception as se: print(f"Copy shared_data err: {se}")
            
        # Copy snapshots (pruned)
        
        src_cursor.execute("SELECT DISTINCT area_id FROM logistics_snapshots")
        areas = [row[0] for row in src_cursor.fetchall()]
        
        copied_snapshots = {}
        
        for area in areas:
            if area in SINGLETON_AREAS:
                # Copy directly
                src_cursor.execute("SELECT area_id, snapshot_date, data_json, updated_at FROM logistics_snapshots WHERE area_id = ?", (area,))
                for row in src_cursor.fetchall():
                    dst_cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at) VALUES (?, ?, ?, ?)", row)
                copied_snapshots[area] = ["MASTER"]
            else:
                # Get the 2 latest dates
                src_cursor.execute("SELECT snapshot_date FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
                dates = [r[0] for r in src_cursor.fetchall()]
                keep_dates = dates[:2]
                
                for d in keep_dates:
                    src_cursor.execute("SELECT area_id, snapshot_date, data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, d))
                    row = src_cursor.fetchone()
                    if row:
                        dst_cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at) VALUES (?, ?, ?, ?)", row)
                copied_snapshots[area] = keep_dates
                
        dst_conn.commit()
        
        # Close database connections
        src_conn.close()
        dst_conn.close()
        
        # Overwrite full database file with clean compacted version
        shutil.copy2(temp_db_path, db_path())
        
        # Clean up temp file
        if os.path.exists(temp_db_path):
            try: os.remove(temp_db_path)
            except: pass
            
        db_size_after = os.path.getsize(db_path()) if os.path.exists(db_path()) else 0
        _, _, free_after = shutil.disk_usage(os.path.dirname(db_path()) or ".")
        
        return {
            "status": "success",
            "message": "Reconstrucción y compactación de la base de datos completada con éxito.",
            "db_size_before_mb": db_size_before / (1024*1024),
            "db_size_after_mb": db_size_after / (1024*1024),
            "disk_free_before_mb": free_before / (1024*1024),
            "disk_free_after_mb": free_after / (1024*1024),
            "copied_snapshots": copied_snapshots
        }
    except Exception as e:
        # Clean up temp file in case of error
        try:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)
        except:
            pass
        return {"status": "error", "message": str(e)}

@app.get("/api/logistics/no_retail_cache/photo")
def get_no_retail_photo(client_id: str, photo_type: str):
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = 'no_retail_cache' AND snapshot_date = 'MASTER'")
        row = cursor.fetchone()
        conn.close()
        if row:
            cache = json.loads(row[0])
            client_data = cache.get(client_id, {})
            photo_data = client_data.get(photo_type)
            return {"status": "success", "photo": photo_data}
        return {"status": "error", "message": "Cache not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# ARCHIVOS NUBE — el robot deja archivos y la web los descarga
#
# A diferencia de todo el resto de la aplicación, acá NO se guardan datos: se
# guarda el archivo tal cual. El Slotting es un .xlsx con tabla dinámica, y la
# dinámica es de Excel: si se guardaran las filas sueltas, el asistente se
# bajaría una tabla plana, que es justo lo que no sirve.
#
# De cada TIPO se conservan los ARCHIVOS_POR_TIPO más recientes y el resto
# se borra solo. Sin esa rotación, 3,5 MB por día llenan el disco del servidor
# en unos meses, y cuando el disco se llena hay una rutina de emergencia
# (hard_reset_if_full) que borra la base de PRODUCCIÓN para recuperar espacio.
#
# El archivo se sube como cuerpo binario crudo, no como formulario: los
# formularios de FastAPI necesitan el paquete python-multipart, que no está
# instalado en el servidor. Así no hace falta agregar ninguna dependencia.
#
# Esta tabla NO se copia a pruebas al clonar (no está en TABLAS_LIGERAS): son
# varios MB por archivo y en pruebas no hacen falta. La tabla igual se crea
# vacía, porque init_db() corre también sobre la base de pruebas.
# ─────────────────────────────────────────────────────────────────────────────

# Siete días de cada TIPO, no del módulo. En Descargas conviven el Slotting, el Stock
# Activo y el de Reserva, y cada uno guarda su propia semana: el lunes que entra pisa al
# lunes que sale. Si el cupo fuera del módulo, los tres se lo repartirían y quedarían dos
# días de cada cosa.
ARCHIVOS_POR_TIPO = 7
ARCHIVO_MAX_MB = 25


def _limpiar_nombre(nombre: str) -> str:
    """El nombre viaja por la URL y termina en una cabecera de descarga: se deja
    solo el nombre del archivo, sin ruta y sin caracteres que rompan la cabecera."""
    nombre = os.path.basename((nombre or "").replace("\\", "/").strip())
    nombre = re.sub(r'[\r\n"]+', "", nombre)
    return nombre[:120] or "archivo.xlsx"


def _tipo_de(nombre: str, tipo: str) -> str:
    """
    El tipo agrupa las versiones del mismo archivo a lo largo de los días. Si no viene, se
    deduce quitándole la fecha al nombre: "Stock Activo 02-08-26.xlsx" -> "Stock Activo".
    Así los archivos que ya estaban y los que suba alguien a mano también rotan bien.
    """
    t = (tipo or "").strip()
    if not t:
        t = re.sub(r"\.[A-Za-z0-9]+$", "", (nombre or "").strip())      # la extensión
        t = re.sub(r"[\s_-]*\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\s*$", "", t)  # la fecha del final
        t = t.strip(" -_") or "Otros"
    return t[:60]


@app.post("/api/archivos/{modulo}")
async def subir_archivo(modulo: str, request: Request, nombre: str = "",
                        fecha: str = "", usuario: str = "robot", tipo: str = "",
                        guardar: int = 0):
    """
    Recibe el archivo en el cuerpo de la petición y lo guarda.

    `guardar` es cuántas versiones conservar de ESTE tipo. Si no viene, se usan las siete de
    siempre. Existe porque no todos los archivos valen lo mismo: la Tabla de Tallas se
    publica solo cuando cambia, y Daniel la quiere con seis.
    """
    # CANDADO DE ESCRITURA. En modo aviso no frena: cuenta las anonimas para el
    # /health. Con EXIGIR_TOKEN_ESCRITURA=true exige sesion o token del robot.
    _bloqueo = _control_escritura(request, "archivos")
    if _bloqueo is not None:
        return _bloqueo
    try:
        contenido = await request.body()
        if not contenido:
            return {"status": "error", "message": "No llegó ningún archivo"}

        if len(contenido) > ARCHIVO_MAX_MB * 1024 * 1024:
            return {"status": "error",
                    "message": "El archivo pesa %.1f MB y el máximo es %d MB"
                               % (len(contenido) / 1024.0 / 1024.0, ARCHIVO_MAX_MB)}

        nombre = _limpiar_nombre(nombre)
        fecha = (fecha or ahora().strftime("%Y-%m-%d")).strip()[:20]
        tipo = _tipo_de(nombre, tipo)

        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()

        # Si el robot corre dos veces el mismo día, la segunda reemplaza a la primera en
        # vez de ocupar dos lugares. Va por TIPO: que se rehaga el Slotting no tiene por
        # qué borrar el Stock Activo de esa misma fecha.
        cursor.execute("DELETE FROM archivos_nube WHERE modulo = ? AND fecha = ? AND tipo = ?",
                       (modulo, fecha, tipo))
        cursor.execute("""
            INSERT INTO archivos_nube (modulo, tipo, nombre, fecha, tamano, contenido, subido_por, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (modulo, tipo, nombre, fecha, len(contenido), sqlite3.Binary(contenido),
              (usuario or "robot")[:60], ahora().strftime("%Y-%m-%d %H:%M:%S")))

        # Rotación POR TIPO: cada archivo guarda su propia semana.
        limite = guardar if 1 <= guardar <= 60 else ARCHIVOS_POR_TIPO
        cursor.execute("""
            DELETE FROM archivos_nube
             WHERE modulo = ? AND tipo = ?
               AND id NOT IN (SELECT id FROM archivos_nube
                               WHERE modulo = ? AND tipo = ?
                            ORDER BY fecha DESC, id DESC
                               LIMIT ?)
        """, (modulo, tipo, modulo, tipo, limite))
        borrados = max(cursor.rowcount, 0)
        conn.commit()

        quedan = cursor.execute("SELECT COUNT(*) FROM archivos_nube WHERE modulo = ? AND tipo = ?",
                                (modulo, tipo)).fetchone()[0]
        conn.close()

        return {"status": "success", "nombre": nombre, "fecha": fecha, "tipo": tipo,
                "mb": round(len(contenido) / 1024.0 / 1024.0, 2),
                "guardados": quedan, "borrados": borrados,
                "entorno": entorno_actual()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/archivos/{modulo}")
def listar_archivos(modulo: str):
    """La ficha de cada archivo, sin el contenido: es lo que pinta la pantalla."""
    try:
        conn = sqlite3.connect(db_path())
        filas = conn.execute("""
            SELECT id, nombre, fecha, tamano, subido_por, created_at, COALESCE(tipo, '')
              FROM archivos_nube WHERE modulo = ?
          ORDER BY fecha DESC, tipo ASC, id DESC
        """, (modulo,)).fetchall()
        conn.close()
        return {"status": "success", "modulo": modulo, "maximo": ARCHIVOS_POR_TIPO,
                "archivos": [{"id": f[0], "nombre": f[1], "fecha": f[2],
                              "tamano": f[3], "mb": round((f[3] or 0) / 1024.0 / 1024.0, 2),
                              "subido_por": f[4], "subido_el": f[5],
                              "tipo": f[6] or _tipo_de(f[1], "")} for f in filas]}
    except Exception as e:
        return {"status": "error", "message": str(e), "archivos": []}


@app.get("/api/archivos/{modulo}/{archivo_id}")
def descargar_archivo(modulo: str, archivo_id: int):
    """Devuelve el archivo tal cual se subió, para que el navegador lo baje."""
    try:
        conn = sqlite3.connect(db_path())
        fila = conn.execute("SELECT nombre, contenido FROM archivos_nube WHERE id = ? AND modulo = ?",
                            (archivo_id, modulo)).fetchone()
        conn.close()
        if not fila:
            return JSONResponse({"status": "error", "message": "Ese archivo ya no está"},
                                status_code=404)

        nombre = _limpiar_nombre(fila[0])
        # filename* además de filename: sin eso, un nombre con acentos llega roto.
        disposicion = "attachment; filename=\"%s\"; filename*=UTF-8''%s" % (
            nombre.encode("ascii", "replace").decode("ascii"), quote(nombre))
        return Response(
            content=bytes(fila[1]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": disposicion},
        )
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


@app.delete("/api/archivos/{modulo}/{archivo_id}")
def borrar_archivo(modulo: str, archivo_id: int, request: Request = None):
    # CANDADO DE ESCRITURA, igual que los demas. `request` es opcional para no
    # romper a quien la llame desde dentro; sin ella no se cuenta y no se frena.
    if request is not None:
        _bloqueo = _control_escritura(request, "archivos")
        if _bloqueo is not None:
            return _bloqueo
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("DELETE FROM archivos_nube WHERE id = ? AND modulo = ?", (archivo_id, modulo))
        conn.commit()
        borrado = cursor.rowcount
        conn.close()
        return {"status": "success" if borrado else "error",
                "message": "Archivo borrado" if borrado else "Ese archivo ya no está"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# BUFFER HISTORY — Endpoints dedicados para Historial Buffer sincronizado
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/buffer/history")
def get_buffer_history():
    """Devuelve todos los registros del historial de Buffer KPI, del más reciente al más antiguo."""
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, created_at
            FROM buffer_history
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        records = []
        for r in rows:
            records.append({
                "id":                  r[0],
                "fecha":               r[1],
                "paletasSolicitadas":  r[2],
                "paletasBajadas":      r[3],
                "diferencias":         r[4],
                "fillRate":            r[5],
                "created_at":          r[6]
            })
        return {"status": "success", "data": records}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/buffer/history")
async def add_buffer_history(request: Request):
    """Agrega un nuevo registro al historial de Buffer KPI."""
    # CANDADO DE ESCRITURA. En modo aviso no frena: cuenta las anonimas para el
    # /health. Con EXIGIR_TOKEN_ESCRITURA=true exige sesion o token del robot.
    _bloqueo = _control_escritura(request, "buffer_history")
    if _bloqueo is not None:
        return _bloqueo
    try:
        body = await request.json()
        fecha               = body.get("fecha", ahora().strftime("%Y-%m-%d"))
        paletas_solicitadas = int(body.get("paletasSolicitadas", 0))
        paletas_bajadas     = int(body.get("paletasBajadas", 0))
        diferencias         = int(body.get("diferencias", 0))
        fill_rate           = str(body.get("fillRate", "0.00%"))

        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO buffer_history (fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, ahora().isoformat()))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        print(f"[BUFFER_HIST] Registro añadido id={new_id} fecha={fecha} sol={paletas_solicitadas} baj={paletas_bajadas}")
        return {"status": "success", "id": new_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.put("/api/buffer/history/{record_id}")
async def update_buffer_history(record_id: int, request: Request):
    """Actualiza un registro existente del historial de Buffer KPI por su id."""
    # CANDADO DE ESCRITURA. En modo aviso no frena: cuenta las anonimas para el
    # /health. Con EXIGIR_TOKEN_ESCRITURA=true exige sesion o token del robot.
    _bloqueo = _control_escritura(request, "buffer_history")
    if _bloqueo is not None:
        return _bloqueo
    try:
        body = await request.json()
        fecha               = body.get("fecha")
        paletas_solicitadas = int(body.get("paletasSolicitadas", 0))
        paletas_bajadas     = int(body.get("paletasBajadas", 0))
        diferencias         = int(body.get("diferencias", 0))
        fill_rate           = str(body.get("fillRate", "0.00%"))

        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE buffer_history
            SET fecha=?, paletas_solicitadas=?, paletas_bajadas=?, diferencias=?, fill_rate=?
            WHERE id=?
        """, (fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, record_id))
        updated = cursor.rowcount
        conn.commit()
        conn.close()
        if updated == 0:
            return {"status": "error", "message": f"Registro id={record_id} no encontrado"}
        return {"status": "success", "id": record_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.delete("/api/buffer/history/{record_id}")
def delete_buffer_history(record_id: int, request: Request = None):
    """Elimina un registro del historial de Buffer KPI por su id."""
    # CANDADO DE ESCRITURA, igual que los demas. `request` es opcional para no
    # romper a quien la llame desde dentro; sin ella no se cuenta y no se frena.
    if request is not None:
        _bloqueo = _control_escritura(request, "buffer_history")
        if _bloqueo is not None:
            return _bloqueo
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("DELETE FROM buffer_history WHERE id=?", (record_id,))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        if deleted == 0:
            return {"status": "error", "message": f"Registro id={record_id} no encontrado"}
        print(f"[BUFFER_HIST] Registro eliminado id={record_id}")
        return {"status": "success", "id": record_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# BUFFER KPI RESULTS — Guarda y recupera resultados de conciliación por fecha
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/buffer/kpi/results")
async def save_kpi_results(request: Request):
    """
    Guarda o reemplaza los resultados del Buffer KPI para una fecha específica.
    Si ya existe un resultado para esa fecha, lo sobreescribe (UPSERT).
    Body: { "fecha": "YYYY-MM-DD", "results": [...] }
    """
    # CANDADO DE ESCRITURA. En modo aviso no frena: cuenta las anonimas para el
    # /health. Con EXIGIR_TOKEN_ESCRITURA=true exige sesion o token del robot.
    _bloqueo = _control_escritura(request, "buffer_kpi")
    if _bloqueo is not None:
        return _bloqueo
    try:
        body = await request.json()
        fecha   = body.get("fecha", ahora().strftime("%Y-%m-%d"))
        results = body.get("results", [])

        if not isinstance(results, list):
            return {"status": "error", "message": "results debe ser un array"}

        results_json = json.dumps(results)
        row_count    = len(results)
        now_str      = ahora().isoformat()

        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO buffer_kpi_results (fecha, results_json, row_count, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(fecha) DO UPDATE SET
                results_json = excluded.results_json,
                row_count    = excluded.row_count,
                updated_at   = excluded.updated_at
        """, (fecha, results_json, row_count, now_str))
        conn.commit()
        conn.close()
        print(f"[KPI_RESULTS] Guardado fecha={fecha} rows={row_count}")
        return {"status": "success", "fecha": fecha, "row_count": row_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/buffer/kpi/results")
def get_kpi_results(fecha: Optional[str] = None):
    """
    Devuelve los resultados del Buffer KPI para una fecha específica.
    Si no se pasa fecha, devuelve el más reciente.
    Query param: ?fecha=YYYY-MM-DD
    """
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        if fecha:
            cursor.execute("""
                SELECT fecha, results_json, row_count, updated_at
                FROM buffer_kpi_results WHERE fecha = ?
            """, (fecha,))
        else:
            cursor.execute("""
                SELECT fecha, results_json, row_count, updated_at
                FROM buffer_kpi_results ORDER BY fecha DESC LIMIT 1
            """)
        row = cursor.fetchone()
        conn.close()
        if not row:
            return {"status": "not_found", "data": [], "fecha": fecha}
        return {
            "status":     "success",
            "fecha":      row[0],
            "data":       json.loads(row[1]),
            "row_count":  row[2],
            "updated_at": row[3]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/buffer/kpi/dates")
def get_kpi_dates():
    """Devuelve todas las fechas disponibles con resultados de Buffer KPI."""
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            SELECT fecha, row_count, updated_at
            FROM buffer_kpi_results
            ORDER BY fecha DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return {
            "status": "success",
            "dates": [{"fecha": r[0], "row_count": r[1], "updated_at": r[2]} for r in rows]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/buffer/kpi/results/range")
def get_kpi_results_range(fecha_from: Optional[str] = None, fecha_to: Optional[str] = None):
    """
    Devuelve los resultados del Buffer KPI para un rango de fechas.
    Combina las filas de todos los días en ese rango.
    Query params: ?fecha_from=YYYY-MM-DD&fecha_to=YYYY-MM-DD
    """
    try:
        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()

        if fecha_from and fecha_to:
            cursor.execute("""
                SELECT fecha, results_json FROM buffer_kpi_results
                WHERE fecha >= ? AND fecha <= ?
                ORDER BY fecha ASC
            """, (fecha_from, fecha_to))
        elif fecha_from:
            cursor.execute("""
                SELECT fecha, results_json FROM buffer_kpi_results
                WHERE fecha >= ? ORDER BY fecha ASC
            """, (fecha_from,))
        elif fecha_to:
            cursor.execute("""
                SELECT fecha, results_json FROM buffer_kpi_results
                WHERE fecha <= ? ORDER BY fecha DESC LIMIT 30
            """, (fecha_to,))
        else:
            cursor.execute("""
                SELECT fecha, results_json FROM buffer_kpi_results
                ORDER BY fecha DESC LIMIT 30
            """)

        rows = cursor.fetchall()
        conn.close()

        combined = []
        for row in rows:
            try:
                combined.extend(json.loads(row[1]))
            except Exception:
                pass

        return {
            "status":    "success",
            "row_count": len(combined),
            "dates":     [r[0] for r in rows],
            "data":      combined
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
