# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("const buildLayoutHTML =")
if idx != -1:
    end_idx = text.find("const processReporteRecepcion =", idx)
    content = text[end_idx - 1000 : end_idx]
    print(content)
