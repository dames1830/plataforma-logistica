import json
import os
import urllib.request
import re

backups_dir = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\backups_v24"
API_BASE = "https://logistics-backend-wv0x.onrender.com/api/logistics"

def post_data(area, payload):
    url = f"{API_BASE}/{area}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            resp_body = res.read().decode("utf-8")
            print(f"POST {area} succeeded: {resp_body}")
            return True
    except Exception as e:
        print(f"POST {area} failed: {e}")
        return False

# 1. Restore Users
print("--- RESTORING USERS ---")
users_file = os.path.join(backups_dir, "users_data.json")
with open(users_file, "r", encoding="utf-8") as f:
    users_raw = json.load(f)
users_payload = users_raw.get("data", users_raw)
post_data("users", users_payload)

# 2. Restore Permissions
print("\n--- RESTORING PERMISSIONS ---")
permissions_file = os.path.join(backups_dir, "permissions_data.json")
with open(permissions_file, "r", encoding="utf-8") as f:
    perms_raw = json.load(f)

# Extract permsMatrix matching frontend: (rawPerms.data && rawPerms.data.data) ? rawPerms.data.data : (rawPerms.data || rawPerms)
if isinstance(perms_raw, dict) and "data" in perms_raw:
    d = perms_raw["data"]
    if isinstance(d, dict) and "data" in d:
        perms_matrix = d["data"]
    else:
        perms_matrix = d
else:
    perms_matrix = perms_raw

post_data("permissions", perms_matrix)

# 3. Restore Workers
print("\n--- RESTORING WORKERS ---")
workers_file = os.path.join(backups_dir, "workers_data.json")
with open(workers_file, "r", encoding="utf-8") as f:
    workers_raw = json.load(f)
workers_payload = workers_raw.get("data", workers_raw)
post_data("workers", workers_payload)

# 4. Restore Attendance
print("\n--- RESTORING ATTENDANCE ---")
attendance_file = os.path.join(backups_dir, "attendance_data.json")
with open(attendance_file, "r", encoding="utf-8") as f:
    att_raw = json.load(f)

date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
def find_all_dates(obj, results=None):
    if results is None:
        results = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if date_pattern.match(k):
                results[k] = v
            elif k == "data":
                find_all_dates(v, results)
    return results

attendance_payload = find_all_dates(att_raw)
post_data("attendance", attendance_payload)

# 5. Restore Performance Log
print("\n--- RESTORING PERFORMANCE LOG ---")
performance_file = os.path.join(backups_dir, "performance_log_data.json")
with open(performance_file, "r", encoding="utf-8") as f:
    perf_payload = json.load(f)
if isinstance(perf_payload, dict) and "data" in perf_payload:
    perf_payload = perf_payload["data"]
post_data("performance_log", perf_payload)

print("\n--- RESTORATION FINISHED ---")
