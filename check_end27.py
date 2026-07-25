# -*- coding: utf-8 -*-
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("RENDIMIENTO DE OPERARIOS")
if idx != -1:
    end_idx = text.find("</table>", idx)
    if end_idx != -1:
        print(text[end_idx : end_idx + 1000])
