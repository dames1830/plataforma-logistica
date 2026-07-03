import os
import re

root = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app"
pattern = "nr_cache_v1"

for dirpath, _, filenames in os.walk(root):
    if "node_modules" in dirpath or ".git" in dirpath or "venv" in dirpath:
        continue
    for f in filenames:
        if f.endswith(".js") or f.endswith(".html"):
            path = os.path.join(dirpath, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    for i, line in enumerate(file, 1):
                        if pattern in line:
                            print(f"{f}:{i}: {line.strip()}")
            except Exception as e:
                pass
