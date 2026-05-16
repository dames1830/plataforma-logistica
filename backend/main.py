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

def init_db():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # LIMPIEZA QUIRÚRGICA EN ARRANQUE PARA RECUPERAR ESPACIO
    try:
        # Modo de emergencia para liberar espacio
        cursor.execute("PRAGMA journal_mode = OFF") # Desactivar journal temporalmente para ahorrar espacio
        cursor.execute("DELETE FROM audit_logs WHERE created_at < date('now', '-3 days')")
        cursor.execute("DELETE FROM logistics_snapshots WHERE updated_at < date('now', '-7 days')")
        cursor.execute("VACUUM")
        cursor.execute("PRAGMA journal_mode = DELETE") # Volver a modo normal
    except Exception as e:
        print(f"Error en limpieza inicial: {e}")
    
    cursor.execute('CREATE TABLE IF NOT EXISTS logistics_snapshots (area_id TEXT, snapshot_date TEXT, data_json TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (area_id, snapshot_date))')
    cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, module TEXT NOT NULL, allowed INTEGER DEFAULT 1, PRIMARY KEY (role, module))')
    cursor.execute('CREATE TABLE IF NOT EXISTS buffer_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    cursor.execute('CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    cursor.execute('CREATE TABLE IF NOT EXISTS shared_data (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    
    if cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        cursor.execute("INSERT INTO users (username, password, name, role) VALUES ('dames', 'Bata1830', 'Daniel Ames', 'admin')")
    
    conn.commit()
    conn.close()

init_db()

@app.get("/api/health")
def health():
    try:
        db_dir = os.path.dirname(DB_PATH) or "."
        files = []
        if os.path.exists(db_dir):
            for f in os.listdir(db_dir):
                fpath = os.path.join(db_dir, f)
                files.append({"name": f, "size_mb": os.path.getsize(fpath) / (1024*1024)})
        
        import shutil
        total, used, free = shutil.disk_usage(db_dir)
        
        return {
            "status": "ok",
            "db_size_kb": os.path.getsize(DB_PATH) // 1024 if os.path.exists(DB_PATH) else 0,
            "disk_free_mb": free / (1024*1024),
            "files": files,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"status": "diag_error", "message": str(e)}

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
        if row: return {"area": area, "data": json.loads(row[0]), "updated_at": row[1]}
        return {"area": area, "data": [] if area == 'workers' else None}
    except Exception as e: return {"status": "error", "message": str(e)}

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
        # REINTENTAR LIMPIEZA SI FALLA POR DISCO
        if "full" in str(e).lower():
            try:
                c = sqlite3.connect(DB_PATH)
                c.execute("PRAGMA journal_mode = OFF")
                c.execute("DELETE FROM audit_logs WHERE created_at < date('now', '-1 day')")
                c.execute("VACUUM")
                c.close()
            except: pass
        return {"status": "error", "message": str(e)}
