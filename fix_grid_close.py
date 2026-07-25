# -*- coding: utf-8 -*-
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

target = """                })()}
            </div>
            
            ${renderHourlyProductionReport(tasks)}"""

replacement = """                })()}
            </div>
            </div>
            
            ${renderHourlyProductionReport(tasks)}"""

if target in text:
    text = text.replace(target, replacement)
    with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
        f.write(text)
    print("SUCCESS: Inserted closing div for 3-column grid.")
else:
    print("ERROR: Target not found.")
