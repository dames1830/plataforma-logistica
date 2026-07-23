import os
import io
import re

def bump_file(path, old_v, new_v):
    with io.open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old_v in content:
        content = content.replace(old_v, new_v)
        with io.open(path, 'w', encoding='utf-8') as f:
            f.write(content)

with io.open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()
match = re.search(r'v=26\.5\.(\d+)', content)
if match:
    old_build = match.group(1)
    new_build = str(int(old_build) + 1)
    old_v = '26.5.' + old_build
    new_v = '26.5.' + new_build
    print(f"Bumping {old_v} to {new_v}")
    
    for root, _, files in os.walk('.'):
        if '.git' in root: continue
        for file in files:
            if file.endswith('.html') or file.endswith('.js'):
                bump_file(os.path.join(root, file), old_v, new_v)
