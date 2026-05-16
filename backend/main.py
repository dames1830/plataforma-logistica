from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# Permitir conexiones del Front-End en localhost o prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En productivo aquí va la URL del Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Configuración de múltiples entornos
BASE_DB = os.environ.get("DB_PATH", "database.db")
PROD_DB = BASE_DB.replace(".db", "_prod.db")
BETA_DB = BASE_DB.replace(".db", "_beta.db")

def get_db_path(request: Request = None):
    if not request:
        return PROD_DB # Default para init_db
    env = request.headers.get("X-Environment", "beta").lower()
    return PROD_DB if env == "production" else BETA_DB

def init_db(db_path: str):
    print(f"Inicializando Base de Datos: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # [Resto del esquema se mantiene igual...]
    cursor.execute('CREATE TABLE IF NOT EXISTS logistics_data (area_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (area_id, snapshot_date))')
    cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    cursor.execute('CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, module TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY (role, module))')
    cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS shared_data (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    
    # Seed Usuarios
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [('dames', 'Bata1830', 'Daniel Ames', 'admin')]
        cursor.executemany("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", default_users)
    
    conn.commit()
    conn.close()

# Inicializar AMBAS nubes al arrancar
if not os.path.exists(PROD_DB):
    import shutil
    if os.path.exists(BASE_DB):
        shutil.copy(BASE_DB, PROD_DB)
        print("Clonada base de datos actual a PRODUCCIÓN")
    else:
        init_db(PROD_DB)

if not os.path.exists(BETA_DB):
    import shutil
    if os.path.exists(BASE_DB):
        shutil.copy(BASE_DB, BETA_DB)
        print("Clonada base de datos actual a BETA")
    else:
        init_db(BETA_DB)

@app.get("/api/logistics/dates")
def get_available_dates(request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT snapshot_date FROM logistics_snapshots ORDER BY snapshot_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"dates": [r[0] for r in rows]}

@app.get("/api/logistics/{area}")
def get_area_data(area: str, request: Request, date: Optional[str] = None):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    if date:
        cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, date))
    else:
        cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC LIMIT 1", (area,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"area": area, "data": json.loads(row[0]), "updated_at": row[1]}
    return {"area": area, "data": None}

@app.post("/api/logistics/{area}")
async def save_area_data(area: str, request: Request):
    payload_data = await request.json()
    json_string = json.dumps(payload_data)
    today_date = datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
    """, (area, today_date, json_string, current_time))
    conn.commit()
    conn.close()
    return {"status": "success", "rows": len(payload_data)}

# =============================================
# API DE USUARIOS Y PRIVILEGIOS
# =============================================

class UserPayload(BaseModel):
    username: str
    password: str
    name: str
    role: str

@app.post("/api/auth/login")
async def api_login(request: Request):
    body = await request.json()
    username = body.get("username", "")
    password = body.get("password", "")
    
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, name, role FROM users WHERE username = ? AND password = ? AND active = 1", (username, password))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"success": True, "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
    return {"success": False, "message": "Credenciales inválidas"}

@app.get("/api/users")
def list_users(request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, name, role, active, created_at FROM users ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    return {"users": [{"id": r[0], "username": r[1], "name": r[2], "role": r[3], "active": r[4], "created_at": r[5]} for r in rows]}

@app.post("/api/users")
async def create_user(payload: UserPayload, request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
                       (payload.username, payload.password, payload.name, payload.role))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"status": "success", "id": new_id}
    except sqlite3.IntegrityError:
        conn.close()
        return {"status": "error", "message": "El nombre de usuario ya existe."}

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, request: Request):
    body = await request.json()
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    
    fields = []
    values = []
    for key in ['username', 'password', 'name', 'role', 'active']:
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    
    if not fields:
        conn.close()
        return {"status": "error", "message": "No hay campos para actualizar."}
    
    values.append(user_id)
    try:
        cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return {"status": "success"}
    except sqlite3.IntegrityError:
        conn.close()
        return {"status": "error", "message": "El nombre de usuario ya está en uso."}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# =============================================
# API DE PERMISOS POR ROL
# =============================================

@app.get("/api/permissions")
def get_all_permissions(request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT role, module, allowed FROM role_permissions ORDER BY role, module")
    rows = cursor.fetchall()
    conn.close()
    
    # Agrupar por rol
    perms = {}
    for r in rows:
        role, module, allowed = r[0], r[1], r[2]
        if role not in perms:
            perms[role] = {}
        perms[role][module] = allowed
    return {"permissions": perms}

@app.get("/api/permissions/{role}")
def get_role_permissions(role: str, request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT module, allowed FROM role_permissions WHERE role = ?", (role,))
    rows = cursor.fetchall()
    conn.close()
    return {"role": role, "modules": {r[0]: r[1] for r in rows}}

@app.put("/api/permissions/{role}")
async def update_role_permissions(role: str, request: Request):
    body = await request.json()
    modules = body.get("modules", {})
    
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    
    for module, allowed in modules.items():
        cursor.execute("""
            INSERT INTO role_permissions (role, module, allowed)
            VALUES (?, ?, ?)
            ON CONFLICT(role, module) DO UPDATE SET allowed=excluded.allowed
        """, (role, module, int(allowed)))
    
    conn.commit()
    conn.close()
    return {"status": "success"}
# =============================================
# API DE LOGS DE AUDITORÍA
# =============================================

@app.get("/api/logs")
def get_logs(request: Request, username: Optional[str] = None, date: Optional[str] = None):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    query = "SELECT username, action, details, created_at FROM audit_logs WHERE 1=1"
    params = []
    
    if username:
        query += " AND username = ?"
        params.append(username)
    if date:
        # Asumiendo formato YYYY-MM-DD
        query += " AND date(created_at) = ?"
        params.append(date)
        
    query += " ORDER BY created_at DESC LIMIT 500"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [{"username": r[0], "action": r[1], "details": r[2], "created_at": r[3]} for r in rows]

@app.post("/api/logs")
async def add_log(request: Request):
    body = await request.json()
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_logs (username, action, details)
        VALUES (?, ?, ?)
    """, (body.get("username"), body.get("action"), body.get("details")))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/buffer/config")
def get_buffer_config(request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM buffer_config")
    rows = cursor.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}

@app.put("/api/buffer/config")
async def update_buffer_config(request: Request):
    body = await request.json()
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    for key, value in body.items():
        cursor.execute("""
            INSERT INTO buffer_config (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """, (key, str(value)))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ── DATOS COMPARTIDOS (sincronización entre PCs) ──
@app.get("/api/shared/{key}")
def get_shared_data(key: str, request: Request):
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("SELECT value_json, updated_by, updated_at FROM shared_data WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"status": "empty", "data": None}
    return {"status": "ok", "data": json.loads(row[0]), "updated_by": row[1], "updated_at": row[2]}

@app.post("/api/shared/{key}")
async def save_shared_data(key: str, request: Request):
    body = await request.json()
    conn = sqlite3.connect(get_db_path(request))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO shared_data (key, value_json, updated_by, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
    """, (key, json.dumps(body.get("data")), body.get("updated_by", "system"), datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {"status": "success"}
