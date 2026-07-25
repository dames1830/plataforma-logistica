import os
import re

files_to_update = [
    "index.html",
    "js/app.js",
    "js/views/dashboard_v26.js",
    "js/views/login.js"
]

for file_path in files_to_update:
    if not os.path.exists(file_path): continue
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    
    # We want to replace any v26.5.459, v26.5.460, v26.5.461 with v26.5.462
    new_text = re.sub(r'v26\.5\.459|v26\.5\.460|v26\.5\.461', 'v26.5.462', text)
    
    if new_text != text:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"Updated {file_path}")
    else:
        print(f"No changes in {file_path}")
