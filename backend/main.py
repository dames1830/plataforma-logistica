from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional

app = FastAPI()

# Permitir conexiones del Front-End en localhost o prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RUTA ÚNICA Y SEGURA PARA LA BASE DE DATOS
DB_PATH = os.environ.get("DB_PATH", "database.db")

def init_db():
    print(f"Inicializando Base de Datos: {DB_PATH}")
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (area_id, snapshot_date))')
    cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, module TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY (role, module))')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS shared_data (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    
    # Seed Usuario Admin
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (username, password, name, role) VALUES ('dames', 'Bata1830', 'Daniel Ames', 'admin')")
    
    conn.commit()
    conn.close()

# Inicializar al arrancar
init_db()

@app.get("/api/health")
def health():
    return {"status": "ok", "db": DB_PATH, "timestamp": datetime.now().isoformat()}

@app.get("/api/logistics/{area}")
def get_area_data(area: str, date: Optional[str] = None):
    try:
        conn = sqlite3.connect(DB_PATH)
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
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/logistics/{area}")
async def save_area_data(area: str, request: Request):
    try:
        payload_data = await request.json()
        json_string = json.dumps(payload_data)
        today_date = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (area, today_date, json_string, current_time))
        conn.commit()
        conn.close()
        return {"status": "success", "rows": len(payload_data)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/auth/login")
async def api_login(request: Request):
    try:
        body = await request.json()
        username = body.get("username", "")
        password = body.get("password", "")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, name, role FROM users WHERE username = ? AND password = ? AND active = 1", (username, password))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"success": True, "user": {"id": row[0], "username": row[1], "name": row[2], "role": row[3]}}
        return {"success": False, "message": "Credenciales inválidas"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/permissions")
def get_all_permissions():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT role, module, allowed FROM role_permissions ORDER BY role, module")
        rows = cursor.fetchall()
        conn.close()
        perms = {}
        for r in rows:
            role, module, allowed = r[0], r[1], r[2]
            if role not in perms: perms[role] = {}
            perms[role][module] = allowed
        return {"permissions": perms}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/users")
def list_users():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, name, role, active, created_at FROM users ORDER BY id")
        rows = cursor.fetchall()
        conn.close()
        return {"users": [{"id": r[0], "username": r[1], "name": r[2], "role": r[3], "active": r[4], "created_at": r[5]} for r in rows]}
    except Exception as e:
        return {"status": "error", "message": str(e)}
