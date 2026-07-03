import json
import os

backups_dir = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\backups_v24"

with open(os.path.join(backups_dir, "attendance_data.json"), "r", encoding="utf-8") as f:
    att = json.load(f)

# Find all keys matching YYYY-MM-DD
import re
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

dates_found = find_all_dates(att)
print(f"Total dates found: {len(dates_found)}")
print(f"Dates: {sorted(list(dates_found.keys()))[:10]} ... {sorted(list(dates_found.keys()))[-10:]}")
