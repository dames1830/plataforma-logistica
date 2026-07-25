# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("window.__buildLayoutHTML")
if idx != -1:
    end_idx = text.find("`;", idx)
    print("Found it!")
