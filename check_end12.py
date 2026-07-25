# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("gridHtml")
while idx != -1:
    end_idx = text.find(";", idx)
    line = text[max(0, text.rfind("\n", 0, idx)) : min(len(text), end_idx + 1)].strip()
    if line.startswith("targetContainer.innerHTML +=") or "innerHTML" in line:
        print("MATCH:", line)
    idx = text.find("gridHtml", idx + 1)
