# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

# Replace getPctHtml in detail rows of MARCAS (uses true/inline icon)
OLD1 = """                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem;">${getPctHtml(total, data.buffer, true)}</td>"""
NEW1 = """                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem; white-space:nowrap;">${(() => { const _p = data.buffer > 0 ? Math.round((total/data.buffer)*100) : 0; const _ic = _p === 0 ? '\u25cf' : '\u25b2'; return `<span style="color:#fff; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:3px;"><span>${_ic}</span><span>${_p}%</span></span>`; })()}</td>"""

# Replace getPctHtml in area subtotal rows
OLD2 = """                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800;">${getPctHtml(areaTotal, areaBuffer, false)}</td>"""
NEW2 = """                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800; white-space:nowrap;">${(() => { const _p = areaBuffer > 0 ? Math.round((areaTotal/areaBuffer)*100) : 0; return `<span style="color:#fff; font-weight:800; font-size:0.82rem;">${_p}%</span>`; })()}</td>"""

# Replace getPctHtml in grand total row
OLD3 = """                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900;">${getPctHtml(grandTotal, grandBuffer, false)}</td>"""
NEW3 = """                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900; white-space:nowrap;">${(() => { const _p = grandBuffer > 0 ? Math.round((grandTotal/grandBuffer)*100) : 0; return `<span style="color:#fff; font-weight:900; font-size:0.85rem;">${_p}%</span>`; })()}</td>"""

c1 = text.count(OLD1)
c2 = text.count(OLD2)
c3 = text.count(OLD3)
print(f"OLD1 found: {c1}, OLD2 found: {c2}, OLD3 found: {c3}")

if c1 == 1:
    text = text.replace(OLD1, NEW1)
    print("Detail row % replaced OK")
else:
    print("ERROR: detail row not found")

if c2 == 1:
    text = text.replace(OLD2, NEW2)
    print("Area subtotal % replaced OK")
else:
    print("ERROR: area subtotal not found")

if c3 == 1:
    text = text.replace(OLD3, NEW3)
    print("Grand total % replaced OK")
else:
    print("ERROR: grand total not found")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
print("File saved.")
