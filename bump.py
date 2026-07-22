import os
import io

def bump_file(path, old_v, new_v):
    with io.open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old_v in content:
        content = content.replace(old_v, new_v)
        with io.open(path, 'w', encoding='utf-8') as f:
            f.write(content)

for root, _, files in os.walk('.'):
    if '.git' in root: continue
    for file in files:
        if file.endswith('.html') or file.endswith('.js'):
            bump_file(os.path.join(root, file), '26.5.440', '26.5.441')
