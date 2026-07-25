# -*- coding: utf-8 -*-
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines[12938:13235]):
    if "if (activoRaw.length" in line:
        pass # ignore
print("Done")
