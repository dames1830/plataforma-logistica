# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("targetContainer.innerHTML = `")
if idx != -1:
    end_idx = text.find("`;", idx)
    print(text[idx : min(len(text), end_idx + 100)])
