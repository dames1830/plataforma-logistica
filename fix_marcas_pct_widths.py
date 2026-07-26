# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

# ==============================================================
# FIX 1: Column widths - give numeric cols more space, cap MARCAS
# ==============================================================
OLD_THEAD = """                                    <th style="padding:6px 8px; text-align:left; width: 110px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 70px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px; color:#facc15;">D\u00cdA</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px; color:#818cf8;">NOCHE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px;">TOTAL</th>
                                    <th style="padding:6px 8px; text-align:center; width: 55px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px;">PENDIENTE</th>"""

NEW_THEAD = """                                    <th style="padding:6px 8px; text-align:left; width: 100px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left; max-width:130px; width:130px;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 85px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px; color:#facc15;">D\u00cdA</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px; color:#818cf8;">NOCHE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px;">TOTAL</th>
                                    <th style="padding:6px 8px; text-align:center; width: 70px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">PENDIENTE</th>"""

# ==============================================================
# FIX 2: % detail rows — restore semaphore color, keep inline
# ==============================================================
OLD_PCT_DETAIL = """                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem; white-space:nowrap;">${(() => { const _p = data.buffer > 0 ? Math.round((total/data.buffer)*100) : 0; const _ic = _p === 0 ? '\u25cf' : '\u25b2'; return `<span style="color:#fff; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:3px;"><span>${_ic}</span><span>${_p}%</span></span>`; })()}</td>"""

NEW_PCT_DETAIL = """                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem; white-space:nowrap;">${(() => { const _p = data.buffer > 0 ? Math.round((total/data.buffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (total < data.buffer ? '#fbbf24' : '#22c55e'); const _ic = _p === 0 ? '\u25cf' : '\u25b2'; return `<span style="color:${_col}; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:3px;"><span>${_ic}</span><span>${_p}%</span></span>`; })()}</td>"""

# ==============================================================
# FIX 3: % area subtotals — restore semaphore color, keep inline
# ==============================================================
OLD_PCT_AREA = """                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800; white-space:nowrap;">${(() => { const _p = areaBuffer > 0 ? Math.round((areaTotal/areaBuffer)*100) : 0; return `<span style="color:#fff; font-weight:800; font-size:0.82rem;">${_p}%</span>`; })()}</td>"""

NEW_PCT_AREA = """                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800; white-space:nowrap;">${(() => { const _p = areaBuffer > 0 ? Math.round((areaTotal/areaBuffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (areaTotal < areaBuffer ? '#fbbf24' : '#22c55e'); return `<span style="color:${_col}; font-weight:800; font-size:0.82rem;">${_p}%</span>`; })()}</td>"""

# ==============================================================
# FIX 4: % grand total — restore semaphore color, keep inline
# ==============================================================
OLD_PCT_GRAND = """                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900; white-space:nowrap;">${(() => { const _p = grandBuffer > 0 ? Math.round((grandTotal/grandBuffer)*100) : 0; return `<span style="color:#fff; font-weight:900; font-size:0.85rem;">${_p}%</span>`; })()}</td>"""

NEW_PCT_GRAND = """                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900; white-space:nowrap;">${(() => { const _p = grandBuffer > 0 ? Math.round((grandTotal/grandBuffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (grandTotal < grandBuffer ? '#fbbf24' : '#22c55e'); return `<span style="color:${_col}; font-weight:900; font-size:0.85rem;">${_p}%</span>`; })()}</td>"""

c1 = text.count(OLD_THEAD)
c2 = text.count(OLD_PCT_DETAIL)
c3 = text.count(OLD_PCT_AREA)
c4 = text.count(OLD_PCT_GRAND)
print(f"THEAD: {c1}, PCT_DETAIL: {c2}, PCT_AREA: {c3}, PCT_GRAND: {c4}")

if c1 == 1: text = text.replace(OLD_THEAD, NEW_THEAD); print("THEAD OK")
else: print("ERROR THEAD")
if c2 == 1: text = text.replace(OLD_PCT_DETAIL, NEW_PCT_DETAIL); print("PCT_DETAIL OK")
else: print("ERROR PCT_DETAIL")
if c3 == 1: text = text.replace(OLD_PCT_AREA, NEW_PCT_AREA); print("PCT_AREA OK")
else: print("ERROR PCT_AREA")
if c4 == 1: text = text.replace(OLD_PCT_GRAND, NEW_PCT_GRAND); print("PCT_GRAND OK")
else: print("ERROR PCT_GRAND")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
print("Done.")
