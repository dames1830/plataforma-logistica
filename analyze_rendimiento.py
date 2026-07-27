import sys
import re

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# KEY INSIGHT:
# fromVal (1693) is inside const renderHistTable = async () => {   (arrow function = own scope)
# fromVal (1941) is inside document.getElementById(...).onclick = () => {  (arrow function = own scope)
# These are DIFFERENT scopes so they're OK!
# 
# Same for: toVal, d, filtered, rows, data, ws, wb
# They're all inside different arrow functions, so no real duplicates at runtime.
#
# The ones that ARE truly problematic (same level scope):
# - raw at 1547 (try block) and 1767 (inside forEach callback - different scope) -> OK
# - art7 at 1770 and 1784 (both inside same forEach callback?) -> check
# - recordId at 1842 and 1904 (inside two different onclick handlers) -> OK (different scopes)
#
# The REAL remaining problem is renderRendimientoOperarios which has many 
# duplicates that appear to be at the same function level.
# Let's check if those are in nested arrow functions too.

# Check renderRendimientoOperarios structure
func_start = 529 - 1  # line 529, 0-indexed

print("=== Structure of renderRendimientoOperarios (lines 529-1498) ===")
print("Looking for arrow function / nested function declarations...")
for i in range(func_start, min(func_start + 1000, len(lines))):
    line = lines[i].strip()
    # Look for arrow functions and nested functions
    if '=>' in line and ('const ' in line or 'let ' in line):
        if 'render' in line or 'build' in line or 'generate' in line or 'get' in line.lower():
            print(f'{i+1}: {line[:100]}')
    if line.startswith('async function ') or line.startswith('function '):
        if i > func_start:
            print(f'!!! NEXT FUNCTION at {i+1}: {line[:60]}')
            break

# Check duplicate "hrs" at 673 and 691
print()
print("--- hrs at 673 and 691 ---")
for i in range(670, 695):
    print(f'{i+1}: {lines[i].rstrip()}')
