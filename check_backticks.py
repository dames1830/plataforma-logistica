# -*- coding: utf-8 -*-
with open("js/views/dashboard_v6.js", "r", encoding="utf-8") as f:
    text6 = f.read()
with open("js/views/dashboard_v25.js", "r", encoding="utf-8") as f:
    text25 = f.read()

print("v6 backticks:", text6.count("`"))
print("v25 backticks:", text25.count("`"))
