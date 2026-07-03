import os
import re

root = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app"
api_calls = []

for dirpath, _, filenames in os.walk(root):
    if "node_modules" in dirpath or ".git" in dirpath or "venv" in dirpath:
        continue
    for f in filenames:
        if f.endswith(".js") or f.endswith(".html"):
            path = os.path.join(dirpath, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read()
                    matches = re.findall(r"['\"`]/api/[^'\"`]+['\"`]", content)
                    if matches:
                        api_calls.append((f, matches))
            except Exception as e:
                pass

for f, matches in api_calls:
    print(f"File: {f}")
    for m in set(matches):
        print(f"  {m}")
