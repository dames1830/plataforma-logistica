import json
import urllib.request

BASE_URL = "https://logistics-backend-wv0x.onrender.com/api/logistics"

# 1. Recuperar Datos de Asistencia
attendance_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24131\content.md"
with open(attendance_file, "r", encoding="utf-8") as f:
    content = f.read()
    json_data = json.loads(content.split("---")[1].strip())

attendance_dict = json_data.get("data", {}).get("data", {}).get("data", {})
if not attendance_dict:
    attendance_dict = json_data.get("data", {})

# 2. Recuperar Tareas
tasks_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24140\content.md"
with open(tasks_file, "r", encoding="utf-8") as f:
    content = f.read()
    tasks_data = json.loads(content.split("---")[1].strip())["data"]

# 3. Recuperar LISTA MAESTRA DE TRABAJADORES (Puesto y Turno Noche)
workers_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24290\content.md"
with open(workers_file, "r", encoding="utf-8") as f:
    content = f.read()
    workers_full_data = json.loads(content.split("---")[1].strip())["data"]

# 4. Recuperar USUARIOS (Los 4 originales)
users_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24260\content.md"
with open(users_file, "r", encoding="utf-8") as f:
    content = f.read()
    users_data = json.loads(content.split("---")[1].strip())["data"]

# 5. Recuperar PERMISOS (Matriz completa)
perms_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24272\content.md"
with open(perms_file, "r", encoding="utf-8") as f:
    content = f.read()
    perms_data = json.loads(content.split("---")[1].strip())["data"]

# 6. Recuperar PERFORMANCE (KPIs y Analítica)
perf_kpi_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24296\content.md"
with open(perf_kpi_file, "r", encoding="utf-8") as f:
    content = f.read()
    perf_kpi_data = json.loads(content.split("---")[1].strip())["data"]

# 7. Recuperar PERFORMANCE LOG (Historial de Notas)
perf_log_file = r"C:\Users\dames\.gemini\antigravity\brain\2cded809-00ac-4257-9cc0-67790600ea9d\.system_generated\steps\24206\content.md"
with open(perf_log_file, "r", encoding="utf-8") as f:
    content = f.read()
    perf_log_data = json.loads(content.split("---")[1].strip())["data"]

# 8. Preparar inyección total
payloads = {
    "workers": workers_full_data,
    "users": users_data,
    "permissions": perms_data,
    "performance": perf_kpi_data,
    "performance_log": perf_log_data,
    "attendance": attendance_dict,
    "almacenaje_tasks": tasks_data
}

# 9. Inyectar
for area, data in payloads.items():
    print(f"Inyectando {area} ({len(data) if isinstance(data, list) else 'objeto'} registros)...")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/{area}",
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as response:
            print(f"Resultado {area}: {response.getcode()}")
    except Exception as e:
        print(f"Error inyectando {area}: {e}")

print("--- INYECCIÓN MAESTRA COMPLETADA AL 100% ---")
