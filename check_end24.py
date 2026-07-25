# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = 0
found = 0
while True:
    idx = text.find("activoWrap.innerHTML =", idx)
    if idx == -1:
        break
    found += 1
    if found == 2:
        end_idx = text.find("`;", idx)
        print(text[max(0, end_idx - 1000) : min(len(text), end_idx + 10)])
    idx += 1
