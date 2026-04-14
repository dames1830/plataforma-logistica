from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import os
from datetime import datetime

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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logistics_data (
            area_id TEXT PRIMARY KEY,
            data_json TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Inicializar tablas si no existen
init_db()

@app.get("/api/logistics/{area}")
def get_area_data(area: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT data_json, updated_at FROM logistics_data WHERE area_id = ?", (area,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {"area": area, "data": json.loads(row[0]), "updated_at": row[1]}
    return {"area": area, "data": None}

@app.post("/api/logistics/{area}")
async def save_area_data(area: str, request: Request):
    payload_data = await request.json()
    json_string = json.dumps(payload_data)
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Insertar o Reemplazar el registro maestro del área
    cursor.execute("""
        INSERT INTO logistics_data (area_id, data_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(area_id) DO UPDATE SET 
            data_json=excluded.data_json,
            updated_at=excluded.updated_at
    """, (area, json_string, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": f"Data for {area} updated securely in SQLite.", "rows": len(payload_data)}
