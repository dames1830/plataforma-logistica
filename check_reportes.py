import re

with open('reportes.html', 'r', encoding='utf-8') as f:
    text = f.read()

versions = set(re.findall(r'v26\.5\.\d+', text))
print('Versiones en reportes.html:', versions)

scripts = re.findall(r'src="[^"]*"', text)
for s in scripts:
    print('Script:', s)
