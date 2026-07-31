# LOGISTICS BACKEND v26.5.208 - buffer_history + buffer_kpi_results + range endpoint + layout global
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
import sqlite3
import json
import os
import shutil
import hashlib
import hmac
import secrets
import time
from contextvars import ContextVar
from datetime import datetime
from typing import Optional

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

def prune_old_snapshots(ruta: Optional[str] = None):
    """
    Conserva solo los 2 snapshots más recientes para cada área que no sea singleton
    para evitar que el tamaño de la base de datos sature el disco del servidor.
    """
    try:
        conn = sqlite3.connect(ruta or db_path())
        cursor = conn.cursor()
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva']
        
        cursor.execute("SELECT DISTINCT area_id FROM logistics_snapshots")
        areas = [r[0] for r in cursor.fetchall()]
        
        for area in areas:
            if area in SINGLETON_AREAS:
                continue
            
            cursor.execute("SELECT snapshot_date FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
            dates = [r[0] for r in cursor.fetchall()]
            
            # Conservar solo los últimos 2 snapshots
            if len(dates) > 2:
                to_delete = dates[2:]
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
            "timestamp": datetime.now().isoformat()
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
def estado_entornos(detalle: bool = False):
    """
    Radiografía de los dos entornos: qué tan grandes son y cuánto disco queda.

    Con ?detalle=true agrega el desglose de qué áreas están ocupando el espacio
    en producción (útil para saber qué conviene limpiar).
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
                    LIMIT 25
                """).fetchall()
            finally:
                conn.close()
            respuesta["areas_mas_pesadas"] = [
                {"area": f[0], "copias_guardadas": f[1], "peso_mb": round((f[2] or 0) / (1024*1024), 2)}
                for f in filas
            ]

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
def clonar_produccion_a_beta(confirmar: str = "", modo: str = "ligera",
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
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"status": "error", "message": f"No se pudo copiar: {e}"}


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
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva']
        
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

                if db_usernames != snap_usernames:
                    if snap_usernames:
                        cursor.execute("DELETE FROM users WHERE username NOT IN ({})".format(','.join(['?']*len(snap_usernames))), list(snap_usernames))
                    else:
                        cursor.execute("DELETE FROM users")

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
                                "UPDATE users SET name=?, role=?, active=? WHERE username=?",
                                (name, role, active, username))
                        else:
                            # Usuario nuevo que solo aparece en el snapshot: se crea con una
                            # contraseña imposible de adivinar. Hay que asignarle una desde
                            # el panel para que pueda entrar.
                            cursor.execute("""
                                INSERT INTO users (username, password, name, role, active)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(username) DO UPDATE SET
                                    name=excluded.name,
                                    role=excluded.role,
                                    active=excluded.active
                            """, (username, hashear_password(secrets.token_urlsafe(24)), name, role, active))
                    conn.commit()

            # IMPORTANTE: la contraseña NO se devuelve nunca. Solo se informa si el
            # usuario tiene una asignada, para que el panel pueda mostrarlo.
            cursor.execute("SELECT username, name, role, active, password FROM users")
            rows = cursor.fetchall()
            data = [{"username": r[0], "name": r[1], "role": r[2],
                     "active": bool(r[3]), "tiene_password": bool(r[4])} for r in rows]
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
        payload_data = await request.json()

        # Las contraseñas que lleguen se procesan aparte y JAMÁS se escriben en el
        # snapshot: ahí solo van los datos públicos del usuario.
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
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva']
        
        target_date = "MASTER" if area in SINGLETON_AREAS else (date if date else datetime.now().strftime("%Y-%m-%d"))
        
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
            """, (area, "MASTER", json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit(); conn.close()
        else:
            conn = sqlite3.connect(db_path()); cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """, (area, target_date, json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
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
        partial_data = await request.json()
        
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva']
        target_date = "MASTER" if area in SINGLETON_AREAS else (date if date else datetime.now().strftime("%Y-%m-%d"))
        
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
        """, (area, target_date, json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
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
        return {"success": True,
                "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
    except Exception as e:
        return {"success": False, "message": "No se pudo validar el acceso", "detalle": str(e)}

@app.post("/api/admin/db_cleanup")
def force_db_cleanup():
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
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history', 'layout_activo', 'layout_reserva']
        
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
    try:
        body = await request.json()
        fecha               = body.get("fecha", datetime.now().strftime("%Y-%m-%d"))
        paletas_solicitadas = int(body.get("paletasSolicitadas", 0))
        paletas_bajadas     = int(body.get("paletasBajadas", 0))
        diferencias         = int(body.get("diferencias", 0))
        fill_rate           = str(body.get("fillRate", "0.00%"))

        conn = sqlite3.connect(db_path())
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO buffer_history (fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (fecha, paletas_solicitadas, paletas_bajadas, diferencias, fill_rate, datetime.now().isoformat()))
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
def delete_buffer_history(record_id: int):
    """Elimina un registro del historial de Buffer KPI por su id."""
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
    try:
        body = await request.json()
        fecha   = body.get("fecha", datetime.now().strftime("%Y-%m-%d"))
        results = body.get("results", [])

        if not isinstance(results, list):
            return {"status": "error", "message": "results debe ser un array"}

        results_json = json.dumps(results)
        row_count    = len(results)
        now_str      = datetime.now().isoformat()

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
