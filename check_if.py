# -*- coding: utf-8 -*-
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("if (activoRaw.length && articulosRaw.length)")
print(text[idx:idx+15000].count("} else {")) # Just roughly see how the code flows
