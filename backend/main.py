# LOGISTICS BACKEND v26.5.206 - buffer_history + buffer_kpi_results + range endpoint
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
import sqlite3
import json
import os
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

DB_PATH = os.environ.get("DB_PATH", "database.db")

def hard_reset_if_full():
    """
    Si el disco está totalmente bloqueado (0MB libres), borramos la DB inflada
    para permitir que el sistema vuelva a operar.
    """
    try:
        db_dir = os.path.dirname(DB_PATH) or "."
        import shutil
        _, _, free = shutil.disk_usage(db_dir)
        free_mb = free / (1024*1024)
        
        if free_mb < 5: # Menos de 5MB libres es CRÍTICO
            print(f"🚨 DISCO AGOTADO ({free_mb}MB). Ejecutando Hard Reset de emergencia...")
            if os.path.exists(DB_PATH):
                os.remove(DB_PATH)
                print("✅ Base de datos inflada eliminada. Espacio recuperado.")
    except Exception as e:
        print(f"Error en hard reset: {e}")

def init_db():
    hard_reset_if_full()
    
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(DB_PATH)
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
    
    # Sembrar Usuarios Base (Recuperados de Captura)
    if cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (username, password, name, role) VALUES ('dames', 'Bata1830', 'Daniel Ames', 'admin')")
        # Sembrar otros usuarios detectados
        users = [
            ('eleon', 'Bata1830', 'E. Leon', 'supervisor'),
            ('jgarcia', 'Bata1830', 'J. Garcia', 'supervisor'),
            ('jcuevas', 'Bata1830', 'J. Cuevas', 'supervisor'),
            ('emayuri', 'Bata1830', 'E. Mayuri', 'supervisor'),
            ('jpelaez', 'Bata1830', 'J. Pelaez', 'supervisor')
        ]
        for u in users:
            try: cursor.execute("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", u)
            except: pass

    conn.commit()
    conn.close()
    prune_old_snapshots()

def prune_old_snapshots():
    """
    Conserva solo los 2 snapshots más recientes para cada área que no sea singleton
    para evitar que el tamaño de la base de datos sature el disco del servidor.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history']
        
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
    init_db()
except Exception as startup_db_err:
    print(f"🚨 CRITICAL STARTUP ERROR INITIALIZING DB: {startup_db_err}")


@app.get("/api/health")
def health():
    try:
        db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        import shutil
        _, _, free = shutil.disk_usage(os.path.dirname(DB_PATH) or ".")
        return {
            "status": "ok",
            "db_size_mb": db_size / (1024*1024),
            "disk_free_mb": free / (1024*1024),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/logistics/{area}/dates")
def list_area_dates(area: str):
    try:
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT snapshot_date FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
        dates = [r[0] for r in cursor.fetchall()]
        conn.close()
        return {"area": area, "dates": dates}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/logistics/{area}")
def get_area_data(area: str, date: Optional[str] = None):
    try:
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        
        # ÁREAS SINGLETON (Siempre un solo registro maestro)
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history']
        
        if area == 'users':
            # Auto-saneamiento/sincronización en el GET si la tabla 'users' no coincide con el snapshot guardado
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
                        password = u.get('password')
                        name = u.get('name')
                        role = u.get('role')
                        active = 1 if u.get('active', True) else 0
                        if username and password and name and role:
                            cursor.execute("""
                                INSERT INTO users (username, password, name, role, active)
                                VALUES (?, ?, ?, ?, ?)
                                ON CONFLICT(username) DO UPDATE SET 
                                    password=excluded.password,
                                    name=excluded.name,
                                    role=excluded.role,
                                    active=excluded.active
                            """, (username, password, name, role, active))
                    conn.commit()
            
            cursor.execute("SELECT username, password, name, role, active FROM users")
            rows = cursor.fetchall()
            data = [{"username": r[0], "password": r[1], "name": r[2], "role": r[3], "active": bool(r[4])} for r in rows]
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
        json_string = json.dumps(payload_data)
        
        # ÁREAS SINGLETON (Ignoran fecha y usan 'MASTER')
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache', 'buffer_history']
        
        target_date = "MASTER" if area in SINGLETON_AREAS else (date if date else datetime.now().strftime("%Y-%m-%d"))
        
        if area == 'no_retail_cache' and isinstance(payload_data, dict):
            conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
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
            conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """, (area, target_date, json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit(); conn.close()

        # [MOD v25.1.28] Sincronización explícita con la tabla 'users' para mantener el login operativo
        if area == 'users' and isinstance(payload_data, list):
            conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
            sent_usernames = [u.get('username') for u in payload_data if u.get('username')]
            if sent_usernames:
                cursor.execute("DELETE FROM users WHERE username NOT IN ({})".format(','.join(['?']*len(sent_usernames))), sent_usernames)
            else:
                cursor.execute("DELETE FROM users")
            
            for u in payload_data:
                username = u.get('username')
                password = u.get('password')
                name = u.get('name')
                role = u.get('role')
                active = 1 if u.get('active', True) else 0
                
                if username and password and name and role:
                    cursor.execute("""
                        INSERT INTO users (username, password, name, role, active)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(username) DO UPDATE SET 
                            password=excluded.password,
                            name=excluded.name,
                            role=excluded.role,
                            active=excluded.active
                    """, (username, password, name, role, active))
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
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        # Los trabajadores se guardan como un snapshot especial 'workers' con fecha 'MASTER'
        cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json) VALUES (?, ?, ?) ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json", ("workers", "MASTER", json.dumps(data)))
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{len(data)} trabajadores restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/users")
async def restore_users(request: Request):
    try:
        data = await request.json()
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        for u in data:
            cursor.execute("INSERT INTO users (username, password, name, role, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET password=excluded.password, name=excluded.name, role=excluded.role, active=excluded.active", (u['username'], u['password'], u['name'], u['role'], u.get('active', 1)))
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{len(data)} usuarios restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/permissions")
async def restore_permissions(request: Request):
    try:
        data = await request.json()
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        for p in data:
            cursor.execute("INSERT INTO role_permissions (role, module, allowed) VALUES (?, ?, ?) ON CONFLICT(role, module) DO UPDATE SET allowed=excluded.allowed", (p['role'], p['module'], p['allowed']))
        conn.commit(); conn.close()
        return {"status": "success", "message": "Permisos restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/restore/performance_history")
async def restore_performance(request: Request):
    try:
        data = await request.json() # Esperamos un objeto { "YYYY-MM-DD": [records], ... }
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        count = 0
        for date, records in data.items():
            cursor.execute("INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json) VALUES (?, ?, ?) ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json", ("performance", date, json.dumps(records)))
            count += 1
        conn.commit(); conn.close()
        return {"status": "success", "message": f"{count} días de historial restaurados"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/buffer/config")
def get_buffer_config():
    try:
        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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

@app.post("/api/auth/login")
async def api_login(request: Request):
    try:
        body = await request.json()
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        cursor.execute("SELECT id, username, name, role FROM users WHERE username = ? AND password = ? AND active = 1", (body.get("username"), body.get("password")))
        row = cursor.fetchone(); conn.close()
        if row: return {"success": True, "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
        return {"success": False, "message": "Credenciales inválidas"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/admin/db_cleanup")
def force_db_cleanup():
    temp_db_path = "/tmp/temp_database.db"
    try:
        import shutil
        db_size_before = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        _, _, free_before = shutil.disk_usage(os.path.dirname(DB_PATH) or ".")
        
        # Remove any leftover temp database from previous failed attempts
        if os.path.exists(temp_db_path):
            try: os.remove(temp_db_path)
            except: pass
            
        # Connect to both databases
        src_conn = sqlite3.connect(DB_PATH)
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
        SINGLETON_AREAS = ['attendance', 'workers', 'users', 'permissions', 'config', 'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'no_retail_cache']
        
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
        shutil.copy2(temp_db_path, DB_PATH)
        
        # Clean up temp file
        if os.path.exists(temp_db_path):
            try: os.remove(temp_db_path)
            except: pass
            
        db_size_after = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        _, _, free_after = shutil.disk_usage(os.path.dirname(DB_PATH) or ".")
        
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
        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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

        conn = sqlite3.connect(DB_PATH)
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

        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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

        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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
        conn = sqlite3.connect(DB_PATH)
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
