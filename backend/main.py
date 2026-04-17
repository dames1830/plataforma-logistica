from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

# Permitir conexiones del Front-End en localhost o prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En productivo aquí va la URL del Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variable inteligente: usa el disco montado de la Nube si existe, si no, lo crea en su carpeta local
DB_FILE = os.environ.get("DB_PATH", "database.db")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Viejo schema (mantenemos por si acaso)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logistics_data (
            area_id TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # NUEVO SCHEMA: Snapshots Históricos Acumulables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logistics_snapshots (
            area_id TEXT,
            snapshot_date TEXT,
            data_json TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (area_id, snapshot_date)
        )
    ''')
    
    # TABLA DE USUARIOS Y PRIVILEGIOS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Seed: Insertar usuarios por defecto si la tabla está vacía
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [
            ('admin', '123', 'Administrador Global', 'admin'),
            ('jefe', '123', 'Jefe de Operaciones', 'jefe'),
            ('supervisor', '123', 'Supervisor de Turno', 'supervisor'),
            ('encargado', '123', 'Encargado de Área', 'encargado'),
            ('asistente', '123', 'Asistente de Bodega', 'asistente')
        ]
        cursor.executemany("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", default_users)
    
    # TABLA DE PERMISOS POR ROL
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT NOT NULL,
            module TEXT NOT NULL,
            allowed INTEGER DEFAULT 1,
            PRIMARY KEY (role, module)
        )
    ''')
    
    # Seed: Permisos por defecto si la tabla está vacía
    cursor.execute("SELECT COUNT(*) FROM role_permissions")
    if cursor.fetchone()[0] == 0:
        all_modules = ['stock', 'inventario', 'picking', 'packing', 'despacho', 'recepcion', 'almacenaje', 'buffer']
        all_roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente']
        default_perms = []
        for role in all_roles:
            for mod in all_modules:
                # Admin ve todo; Jefe/Supervisor ven todo; otros solo stock por defecto
                if role in ['admin', 'jefe', 'supervisor']:
                    default_perms.append((role, mod, 1))
                elif mod == 'stock':
                    default_perms.append((role, mod, 1))
                else:
                    default_perms.append((role, mod, 0))
        cursor.executemany("INSERT INTO role_permissions (role, module, allowed) VALUES (?, ?, ?)", default_perms)
    
    # Migración: Pasar datos antiguos al nuevo formato
    cursor.execute("SELECT area_id, data_json, updated_at FROM logistics_data")
    rows = cursor.fetchall()
    for row in rows:
        a_id, d_json, u_at = row[0], row[1], row[2]
        snap_date = u_at.split(' ')[0] if ' ' in u_at else datetime.now().strftime("%Y-%m-%d")
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
            """, (a_id, snap_date, d_json, u_at))
        except Exception:
            pass
            
    # MIGRACIÓN ELITE: Renombrar roles antiguos a nuevos rangos
    # Si existen roles viejos, los mapeamos a 'encargado' por defecto
    old_roles = ['inventario', 'picking', 'packing', 'despacho', 'recepcion', 'almacenaje', 'buffer']
    for old in old_roles:
        cursor.execute("UPDATE users SET role = 'encargado' WHERE role = ?", (old,))
        cursor.execute("UPDATE role_permissions SET role = 'encargado' WHERE role = ?", (old,))
            
    conn.commit()
    conn.close()

# Inicializar tablas si no existen
init_db()

@app.get("/api/logistics/dates")
def get_available_dates():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT snapshot_date FROM logistics_snapshots ORDER BY snapshot_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"dates": [r[0] for r in rows]}

@app.get("/api/logistics/{area}")
def get_area_data(area: str, date: Optional[str] = None):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    if date:
        cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, date))
    else:
        # Si no piden fecha, traemos la más reciente (Hoy o el último día disponible)
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
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Insertar o Reemplazar el registro del área para la FECHA DE HOY
    cursor.execute("""
        INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(area_id, snapshot_date) DO UPDATE SET 
            data_json=excluded.data_json,
            updated_at=excluded.updated_at
    """, (area, today_date, json_string, current_time))
    
    # También guardamos en la tabla legacy en caso de rollbacks
    cursor.execute("""
        INSERT INTO logistics_data (area_id, data_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(area_id) DO UPDATE SET 
            data_json=excluded.data_json,
            updated_at=excluded.updated_at
    """, (area, json_string, current_time))
    
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": f"Data for {area} updated securely in SQLite.", "rows": len(payload_data)}

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
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, name, role FROM users WHERE username = ? AND password = ? AND active = 1", (username, password))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"success": True, "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
    return {"success": False, "message": "Credenciales inválidas"}

@app.get("/api/users")
def list_users():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, name, role, active, created_at FROM users ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    return {"users": [{"id": r[0], "username": r[1], "name": r[2], "role": r[3], "active": r[4], "created_at": r[5]} for r in rows]}

@app.post("/api/users")
async def create_user(payload: UserPayload):
    conn = sqlite3.connect(DB_FILE)
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
    conn = sqlite3.connect(DB_FILE)
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
def delete_user(user_id: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# =============================================
# API DE PERMISOS POR ROL
# =============================================

@app.get("/api/permissions")
def get_all_permissions():
    conn = sqlite3.connect(DB_FILE)
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
def get_role_permissions(role: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT module, allowed FROM role_permissions WHERE role = ?", (role,))
    rows = cursor.fetchall()
    conn.close()
    return {"role": role, "modules": {r[0]: r[1] for r in rows}}

@app.put("/api/permissions/{role}")
async def update_role_permissions(role: str, request: Request):
    body = await request.json()
    modules = body.get("modules", {})
    
    conn = sqlite3.connect(DB_FILE)
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
