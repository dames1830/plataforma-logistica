# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("RENDIMIENTO DE OPERARIOS")
if idx != -1:
    print(text[max(0, idx + 4000) : min(len(text), idx + 8000)])
