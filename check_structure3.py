# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("display:grid; grid-template-columns:repeat(3, 1fr)")
if idx != -1:
    print(text[max(0, idx - 400) : min(len(text), idx + 200)])
