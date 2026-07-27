import sys
import re

# Read the file
with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The issue is: variables declared with const/let in block scopes inside a function are fine
# UNLESS they're in the same block scope level.
# The browser error means strict mode duplicate in same scope.
# The safest fix: change all duplicate declarations from const/let to just assignment (remove the keyword)
# BUT only for the SECOND occurrence onwards.

# Key duplicates causing real errors (those in the SAME level, not nested blocks):
# These are in renderRendimientoOperarios and renderHistorialBuffer

# Strategy: for all confirmed duplicates in same function,
# replace the second+ occurrence's "const " or "let " with just ""
# We need to be careful - only when the variable is truly redeclared (not in a nested inner block)

# Known problematic ones from the browser errors:
# - toISO: already fixed (line 1551-1557 removed)
# - kpiHistory: already fixed  
# - localData at 1581: both in try/catch blocks inside renderHistorialBuffer - this is fine (different block scopes)

# The really dangerous ones are those at the TOP LEVEL of a function (not inside sub-blocks)
# Let's fix the ones in renderHistorialBuffer that are NOT in sub-blocks

# Looking at the output:
# localData 1574 and 1581 - both inside catch blocks (different blocks) -> OK
# raw 1547 and 1767 - these need checking
# art7 1770 and 1784 - need checking  
# recordId 1842 and 1904 - need checking (likely different if/else blocks -> OK)
# fromVal 1693 and 1941 - need checking
# toVal 1694 and 1942 - need checking
# d 1702 and 1944 - need checking
# data 1947 and 1957 - need checking
# ws 1949 and 1961 - need checking
# wb 1950 and 1962 - need checking

# For renderRendimientoOperarios - MANY duplicates - likely in different sub-functions
# Let's check if the variables in renderRendimientoOperarios are in nested arrow functions

# Show context around suspicious duplicates
print("=== Checking renderHistorialBuffer suspicious duplicates ===\n")

# raw at 1547 and 1767
print("--- raw at 1547 ---")
for i in range(1544, 1550):
    print(f'{i+1}: {lines[i].rstrip()}')

print()
print("--- raw at 1767 ---")
for i in range(1764, 1772):
    print(f'{i+1}: {lines[i].rstrip()}')

print()
print("--- fromVal 1693 and 1941 ---")
print("First (1693):")
for i in range(1690, 1697):
    print(f'{i+1}: {lines[i].rstrip()}')
print("Second (1941):")
for i in range(1938, 1945):
    print(f'{i+1}: {lines[i].rstrip()}')

print()
print("--- d at 1702 and 1944 ---")
print("First (1702):")
for i in range(1699, 1706):
    print(f'{i+1}: {lines[i].rstrip()}')
print("Second (1944):")
for i in range(1941, 1948):
    print(f'{i+1}: {lines[i].rstrip()}')

print()
print("--- data at 1947 and 1957 ---")
for i in range(1944, 1965):
    print(f'{i+1}: {lines[i].rstrip()}')
