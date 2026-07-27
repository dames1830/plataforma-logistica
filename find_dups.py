import sys
import re

# Read the file
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Function boundaries
func_starts = []
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('async function ') or stripped.startswith('function '):
        func_starts.append(i)

func_starts.append(len(lines))  # sentinel

# For each function, collect declarations and check for duplicates
print('=== DUPLICADOS POR FUNCION (solo dentro del mismo scope) ===\n')

for fi in range(len(func_starts) - 1):
    start = func_starts[fi]
    end = func_starts[fi + 1]
    func_name = lines[start].strip()[:70]
    
    declarations = {}
    for i in range(start, end):
        line = lines[i].strip()
        for kw in ['const ', 'let ']:
            if line.startswith(kw):
                rest = line[len(kw):]
                name = re.split(r'[=\s\(\[{]', rest)[0].strip()
                if name and re.match(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$', name):
                    if name in declarations:
                        print(f'  DUPLICADO: "{name}" en {func_name}')
                        print(f'    Primera: linea {declarations[name]+1}')
                        print(f'    Segunda: linea {i+1}')
                    else:
                        declarations[name] = i
