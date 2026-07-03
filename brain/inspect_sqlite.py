import sqlite3
import json

conn = sqlite3.connect("backend/database.db")
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in c.fetchall()]
print("Tables:", tables)

for t in tables:
    try:
        c.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"Table {t} row count: {c.fetchone()[0]}")
    except Exception as e:
        print(f"Error counting {t}: {e}")

# Let's see some keys in logistics_snapshots
try:
    c.execute("SELECT area_id, snapshot_date, length(data_json) FROM logistics_snapshots")
    rows = c.fetchall()
    print("Snapshots rows:")
    for r in rows:
        print(f"  area_id: {r[0]}, date: {r[1]}, size: {r[2]}")
except Exception as e:
    print("Error querying snapshots:", e)

# Let's see if there is any 'no_retail' or 'no_retail_cache' in logistics_snapshots
try:
    c.execute("SELECT area_id, snapshot_date FROM logistics_snapshots WHERE area_id LIKE '%retail%'")
    rows = c.fetchall()
    print("Retail snapshots rows:")
    for r in rows:
        print(f"  area_id: {r[0]}, date: {r[1]}")
except Exception as e:
    print("Error querying retail snapshots:", e)

conn.close()
