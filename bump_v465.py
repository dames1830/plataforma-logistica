import os, re

files = [
    "index.html",
    "js/app.js",
    "js/views/dashboard_v28.js",
    "js/views/login.js",
    "js/views/almacenaje_module.js",
    "js/services_v245/adminService.js",
    "js/services_v245/csvHub_v6.js",
    "js/services_v245/auth.js"
]

for fp in files:
    if not os.path.exists(fp):
        print(f"SKIP (not found): {fp}")
        continue
    with open(fp, "r", encoding="utf-8") as f:
        text = f.read()
    new_text = re.sub(r'26\.5\.4\d+', '26.5.465', text)
    if new_text != text:
        with open(fp, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"Updated: {fp}")
    else:
        print(f"No changes: {fp}")
