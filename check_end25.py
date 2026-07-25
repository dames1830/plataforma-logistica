# -*- coding: utf-8 -*-
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

# Let's find "RENDIMIENTO DE OPERARIOS"
idx = text.find("RENDIMIENTO DE OPERARIOS")
if idx != -1:
    # find where this string ends and look for `</div>`
    end_idx = text.find("`;", idx)
    if end_idx != -1:
        print(text[end_idx - 1000: end_idx+500])
