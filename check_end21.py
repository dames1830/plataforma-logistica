# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = 0
while True:
    idx = text.find("targetContainer.innerHTML =", idx)
    if idx == -1:
        break
    
    # Only print if we are somewhat close to "glass-panel" or "gap:20px"
    snip = text[idx : min(len(text), idx + 200)]
    if "isMZN" in snip or "flex-direction" in snip or "glass-panel" in snip:
        print("MATCH AT:", idx)
        print(text[idx : min(len(text), idx + 2000)])
    idx += 1
