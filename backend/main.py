from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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

init_db()

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

@app.get("/api/logistics/{area}")
def get_area_data(area: str, date: Optional[str] = None):
    try:
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        if date:
            cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = ?", (area, date))
        else:
            cursor.execute("SELECT data_json, updated_at FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC LIMIT 1", (area,))
        row = cursor.fetchone(); conn.close()
        if row: return {"area": area, "data": json.loads(row[0]), "updated_at": row[1]}
        return {"area": area, "data": [] if area == 'workers' else None}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.post("/api/logistics/{area}")
async def save_area_data(area: str, request: Request):
    try:
        payload_data = await request.json()
        json_string = json.dumps(payload_data)
        today_date = datetime.now().strftime("%Y-%m-%d")
        
        conn = sqlite3.connect(DB_PATH); cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (area, today_date, json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit(); conn.close()
        return {"status": "success", "rows": len(payload_data)}
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
