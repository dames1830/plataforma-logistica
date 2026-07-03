import os

root = r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app"

for dirpath, _, filenames in os.walk(root):
    if "node_modules" in dirpath or ".git" in dirpath or "venv" in dirpath:
        continue
    for f in filenames:
        if f.endswith(".js") or f.endswith(".html"):
            path = os.path.join(dirpath, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read()
                    if "executeResurrection" in content:
                        print(f"Found in {f}")
                        lines = content.splitlines()
                        for i, line in enumerate(lines, 1):
                            if "executeResurrection" in line:
                                start = max(0, i-5)
                                end = min(len(lines), i+60)
                                for idx in range(start, end):
                                    print(f"{idx+1}: {lines[idx]}")
            except Exception as e:
                pass
