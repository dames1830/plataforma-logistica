import os
import shutil
import sqlite3
import json
from datetime import datetime

# Path Configuration
SRC_DIR = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app"
RESTORE_ROOT = r"C:\Users\dames\.gemini\antigravity\scratch\restauracion"
DB_PATH = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\backend\database.db"
SYSTEM_VERSION = "v26.5.176"

def get_timestamp_folder_name():
    # format: DDMMYY_HHMM
    now = datetime.now()
    return f"Punto_Restauracion_{now.strftime('%d%m%y_%H%M')}"

def copy_src_code(dest_main):
    print("Copying source code to MAIN...")
    # List of directories/files to ignore
    ignore_patterns = shutil.ignore_patterns(
        '.git', 'venv', '__pycache__', 'node_modules', '.gemini', 
        'database.db', 'logistics.db'
    )
    if os.path.exists(dest_main):
        shutil.rmtree(dest_main)
    shutil.copytree(SRC_DIR, dest_main, ignore=ignore_patterns)
    print("Source code copied successfully.")

def export_database_json(dest_bbdd):
    print("Exporting database snapshot to BBDD JSON files...")
    if not os.path.exists(DB_PATH):
        print(f"Warning: Database file not found at {DB_PATH}. Skipping JSON export.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create destination BBDD folder if not exists
    os.makedirs(dest_bbdd, exist_ok=True)
    
    # 1. Export Users
    try:
        cursor.execute("SELECT username, password, name, role, active FROM users")
        users = []
        for r in cursor.fetchall():
            users.append({
                "username": r[0],
                "password": r[1],
                "name": r[2],
                "role": r[3],
                "active": bool(r[4])
            })
        with open(os.path.join(dest_bbdd, "users.json"), "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
        print("Exported users.json")
    except Exception as e:
        print(f"Failed to export users: {e}")
        
    # 2. Export Snapshots
    try:
        cursor.execute("SELECT DISTINCT area_id FROM logistics_snapshots")
        areas = [r[0] for r in cursor.fetchall()]
        
        for area in areas:
            # Check if this area has a MASTER snapshot
            cursor.execute("SELECT data_json FROM logistics_snapshots WHERE area_id = ? AND snapshot_date = 'MASTER'", (area,))
            master_row = cursor.fetchone()
            
            if master_row:
                # Singleton area
                data = json.loads(master_row[0])
            else:
                # Date-based area or history. Export all snapshot dates as a dict or the latest one.
                # To match previous backup formats, let's export all dates as a dictionary of {date: data}
                cursor.execute("SELECT snapshot_date, data_json FROM logistics_snapshots WHERE area_id = ? ORDER BY snapshot_date DESC", (area,))
                rows = cursor.fetchall()
                if len(rows) == 1:
                    data = json.loads(rows[0][1])
                else:
                    data = {}
                    for r_date, r_json in rows:
                        data[r_date] = json.loads(r_json)
                        
            with open(os.path.join(dest_bbdd, f"{area}.json"), "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Exported {area}.json")
    except Exception as e:
        print(f"Failed to export snapshots: {e}")
        
    # 3. Copy database.db file as well
    try:
        shutil.copy2(DB_PATH, os.path.join(dest_bbdd, "database.db"))
        print("Copied database.db file to BBDD.")
    except Exception as e:
        print(f"Failed to copy database.db: {e}")
        
    conn.close()

def write_readme(dest_folder, folder_name):
    readme_path = os.path.join(dest_folder, "LEEME_RESTAURACION.txt")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    content = f"""PUNTO DE RESTAURACIÓN INTEGRAL - LOGÍSTICA DEAM1830
===================================================
Fecha: {now_str}
Versión del Sistema: {SYSTEM_VERSION}

ESTRUCTURA DEL RESPALDO:
------------------------
/restauracion/{folder_name}
    /MAIN: Contiene el código fuente íntegro, diseño y lógica del sistema.
    /BBDD: Contiene los datos reales extraídos en formato JSON y SQLite (database.db).

Este punto de restauración permite recuperar tanto el programa como la información
exacta que existía en este momento.

No modificar para preservar la integridad del respaldo.
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("LEEME_RESTAURACION.txt written.")

def main():
    folder_name = get_timestamp_folder_name()
    dest_folder = os.path.join(RESTORE_ROOT, folder_name)
    
    print(f"Creating Restoration Point: {folder_name}...")
    os.makedirs(dest_folder, exist_ok=True)
    
    dest_main = os.path.join(dest_folder, "MAIN")
    dest_bbdd = os.path.join(dest_folder, "BBDD")
    
    # 1. Copy source code
    copy_src_code(dest_main)
    
    # 2. Export database
    export_database_json(dest_bbdd)
    
    # 3. Write README
    write_readme(dest_folder, folder_name)
    
    print(f"\nSuccessfully created restoration point at {dest_folder}")

if __name__ == "__main__":
    main()
