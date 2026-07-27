import sys

# Read the file
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')

# The second toISO at line 1671 (index 1670) is more complete (handles "24 jun" format)
# The first toISO at line 1551 (index 1550) is simpler
# We should:
# 1. Remove the first (simpler) toISO declaration at lines 1551-1557
# 2. Keep the second (more complete) one at lines 1671-1684

# Let's check what lines 1550-1558 look like
print('\n--- First toISO (to be removed) ---')
for i in range(1549, 1559):
    print(f'{i+1}: {lines[i].rstrip()}')

# Replace the first simpler toISO with a comment
# Lines 1551-1557 (index 1550-1556) contain the first toISO
new_lines = lines.copy()

# Remove lines 1551-1557 (index 1550-1556) - the first toISO declaration
# by replacing them with empty lines (to preserve line numbers for debugging)
for i in range(1550, 1557):
    new_lines[i] = '\n'  # blank line

print('\n--- After removal ---')
for i in range(1549, 1560):
    print(f'{i+1}: {new_lines[i].rstrip()}')

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('\nDone! First toISO removed.')
