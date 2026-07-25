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
    end_idx = text.find("`;", idx)
    print("MATCH AT:", idx)
    if "gridHtml" in text[idx : min(len(text), end_idx + 10)]:
        print(text[idx : min(len(text), end_idx + 100)])
    idx += 1
