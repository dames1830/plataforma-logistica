import os
import re

files_to_update = [
    "index.html",
    "js/app.js",
    "js/views/dashboard_v27.js",
    "js/views/login.js"
]

for file_path in files_to_update:
    if not os.path.exists(file_path): continue
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    
    # Replace anything matching 26.5.4xx with 26.5.464
    new_text = re.sub(r'26\.5\.4\d+', '26.5.464', text)
    
    if new_text != text:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_text)
        print(f"Updated {file_path}")
    else:
        print(f"No changes in {file_path}")
