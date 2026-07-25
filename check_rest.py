# -*- coding: utf-8 -*-
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("if (activoRaw.length && articulosRaw.length)")
block_start = idx
braces = 0
for i in range(idx, len(text)):
    if text[i] == '{': braces += 1
    elif text[i] == '}':
        braces -= 1
        if braces == 0:
            print("Block ends at:", i)
            print(text[i:i+500])
            break
