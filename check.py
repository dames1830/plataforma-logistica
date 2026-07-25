import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

match = re.search(r'(<div[^>]*?>\s*<!-- REPORTE ALMACENAJE - (MARCAS|GENDER)[^<]*?</div>)', text)
if match:
    # Just print a window around the match
    start = max(0, match.start() - 500)
    end = min(len(text), match.end() + 500)
    print(text[start:end])
