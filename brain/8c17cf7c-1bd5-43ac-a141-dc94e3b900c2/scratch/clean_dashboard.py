
import sys

file_path = r'C:\Users\dames\.gemini\antigravity\scratch\logistics-web-app\js\views\dashboard_v6.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line numbers in editor are 1-based.
# Python list is 0-based.
# Delete lines 932 to 2416 (indices 931 to 2415)
start_idx = 931
end_idx = 2415

new_lines = lines[:start_idx] + ["  // --- SECCIONES ADMINISTRATIVAS CENTRALIZADAS (v18.9.8) ---\n"] + lines[end_idx+1:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Successfully deleted {end_idx - start_idx + 1} lines.")
