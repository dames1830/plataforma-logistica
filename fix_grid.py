import sys

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Change grid-template-columns:1fr 1fr; to repeat(3, 1fr)
old_grid = "<!-- FILA INFERIOR DE REPORTES (50% / 50%) -->\n            <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start;\">"
new_grid = "<!-- FILA INFERIOR DE REPORTES (3 COLUMNAS) -->\n            <div style=\"display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem; align-items:start;\">"
if old_grid in text:
    text = text.replace(old_grid, new_grid)
    print("Grid modified")
else:
    print("Grid not found")

# 2. Remove the closing </div> of the grid and the <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO) --> separation,
#    and remove margin-top:1.5rem; width:100%; from RENDIMIENTO so it fits in the grid cleanly.
old_sep = """                    </div>
                </div>

            </div>

            <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO) -->
            <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">"""

new_sep = """                    </div>
                </div>

                <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO -> TERCERA COLUMNA) -->
                <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; min-width:0;">"""

if old_sep in text:
    text = text.replace(old_sep, new_sep)
    
    # We also need to add a closing </div> for the grid after RENDIMIENTO finishes!
    # Let's find where RENDIMIENTO finishes.
    
    rendimiento_end = text.find("<!-- ESTILOS INTERNOS -->")
    # Actually, we can just insert it before <!-- ESTILOS INTERNOS -->?
    # No, RENDIMIENTO ends at `targetContainer.appendChild(activoWrap);` ?
    # Let's check what's right after RENDIMIENTO DE OPERARIOS table.
else:
    print("Separator not found")

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(text)

