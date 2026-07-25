# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("GENDER")
while idx != -1:
    snip = text[max(0, idx - 100) : min(len(text), idx + 100)]
    if "REPORTE" in snip and "background:#000000" in snip:
        print(text[max(0, idx - 500) : min(len(text), idx + 200)])
        break
    idx = text.find("GENDER", idx + 1)
