import os
import json
import sqlite3
import urllib.request
import urllib.parse

BACKUP_DIR = r"C:\Users\dames\.gemini\antigravity\scratch\restauracion\Punto_Restauracion_260526_0301\BBDD"
API_BASE = "https://logistics-backend-wv0x.onrender.com/api/logistics"

SINGLETON_AREAS = [
    'attendance', 'workers', 'users', 'permissions', 'config', 
    'performance_log', 'almacenaje_tasks', 'rfs', 'rf_assignments', 
    'rfs_batteries', 'rfs_chargers'
]

LOCAL_DB_PATHS = [
    r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\database.db",
    r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\backend\database.db"
]

def restore_local_db(area, date, data_json):
    for db_path in LOCAL_DB_PATHS:
        if not os.path.exists(db_path):
            continue
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            # Insert into snapshot
            cursor.execute("""
                INSERT INTO logistics_snapshots (area_id, snapshot_date, data_json, updated_at)
                VALUES (?, ?, ?, datetime('now', 'localtime'))
                ON CONFLICT(area_id, snapshot_date) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """, (area, date, json.dumps(data_json)))
            
            # Special user synchronization
            if area == 'users' and isinstance(data_json, list):
                sent_usernames = [u.get('username') for u in data_json if u.get('username')]
                if sent_usernames:
                    cursor.execute("DELETE FROM users WHERE username NOT IN ({})".format(','.join(['?']*len(sent_usernames))), sent_usernames)
                else:
                    cursor.execute("DELETE FROM users")
                for u in data_json:
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
            conn.close()
            print(f"[{os.path.basename(db_path)}] Local DB restore for '{area}' ({date}) succeeded.")
        except Exception as e:
            print(f"[{os.path.basename(db_path)}] Local DB restore for '{area}' failed: {e}")

def restore_remote_api(area, date, data_json):
    # Determine the target endpoint
    if area in SINGLETON_AREAS:
        url = f"{API_BASE}/{area}"
    else:
        url = f"{API_BASE}/{area}?date={date}"
        
    payload = json.dumps(data_json).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            resp = res.read().decode("utf-8")
            print(f"[Remote API] Upload '{area}' ({date}) succeeded: {resp}")
            return True
    except Exception as e:
        print(f"[Remote API] Upload '{area}' ({date}) failed: {e}")
        return False

def main():
    print("Starting Restore Process from May 26 Backup...")
    
    files = os.listdir(BACKUP_DIR)
    for filename in files:
        if not filename.endswith(".json"):
            continue
            
        area = filename[:-5] # remove '.json'
        file_path = os.path.join(BACKUP_DIR, filename)
        
        print(f"\nProcessing file: {filename} (area: {area})")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data_json = json.load(f)
        except Exception as e:
            print(f"Failed to read/parse {filename}: {e}")
            continue
            
        # Determine the snapshot date
        if area in SINGLETON_AREAS:
            target_date = "MASTER"
        else:
            target_date = "2026-05-26"
            
        # Special parsing check (like permissions has nested structure or similar)
        # Note: we should post the exact contents as they are saved in the JSON backup.
        
        # Restore local DBs
        restore_local_db(area, target_date, data_json)
        
        # Restore remote Render server
        restore_remote_api(area, target_date, data_json)

if __name__ == "__main__":
    main()
