with open(r"C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v24.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "export const renderDashboard" in line:
        print(f"Line {i}: {line.strip()}")
