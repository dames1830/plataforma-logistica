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
    
    # Migración: Pasar datos antiguos al nuevo formato
    cursor.execute("SELECT area_id, data_json, updated_at FROM logistics_data")
    rows = cursor.fetchall()
    for row in rows:
        a_id, d_json, u_at = row[0], row[1], row[2]
        # Extraer dia YYYY-MM-DD
        snap_date = u_at.split(' ')[0] if ' ' in u_at else datetime.now().strftime("%Y-%m-%d")
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, ?)
            """, (a_id, snap_date, d_json, u_at))
        except Exception:
            pass
            
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
