import re

# Update reportes.html
with open('reportes.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'v=26\.5\.\d+', 'v=26.5.483', text)

with open('reportes.html', 'w', encoding='utf-8') as f:
    f.write(text)

# Update reportes_publicos.js
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

js_text = re.sub(r'v=26\.5\.\d+', 'v=26.5.483', js_text)

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("Version bumped to 26.5.483")
