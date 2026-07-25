# -*- coding: utf-8 -*-
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("if (activoRaw.length && articulosRaw.length)")
b = 0
found_end = -1
for i in range(idx, len(text)):
    if text[i] == '{': b += 1
    elif text[i] == '}':
        b -= 1
        if b == 0:
            found_end = i
            break

lines_before = text[:found_end].count("\n")
print("Ends at line:", lines_before + 1)
