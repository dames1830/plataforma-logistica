# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "const baseUrl =" in line:
        lines[idx] = "            const baseUrl = window.location.origin + '/reportes.html';\n"
        print(f"Fixed line {idx+1}: {lines[idx]}")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Saved cleanly.")
