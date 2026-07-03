with open(r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\services_v245\csvHub_v6.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "DataCache" in line:
        print(f"Line {i}: {line.strip()}")
