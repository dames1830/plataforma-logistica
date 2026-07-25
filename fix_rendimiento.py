# -*- coding: utf-8 -*-
with open("js/views/dashboard_v27.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Change 3-column to 2-column
text = text.replace("<!-- FILA INFERIOR DE REPORTES (3 COLUMNAS) -->\n            <div style=\"display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem; align-items:start;\">", "<!-- FILA INFERIOR DE REPORTES (2 COLUMNAS) -->\n            <div style=\"display:grid; grid-template-columns:repeat(2, 1fr); gap:1.5rem; align-items:start;\">")

# 2. Close the 2-column grid BEFORE RENDIMIENTO
target_rendimiento = """                <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO -> TERCERA COLUMNA) -->"""
replacement_rendimiento = """            </div>\n\n            <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO) -->"""
text = text.replace(target_rendimiento, replacement_rendimiento)

# 3. Remove the extra </div> at the end of RENDIMIENTO
target_end = """                    </div>`;
                })()}
            </div>
            </div>
            
            ${renderHourlyProductionReport(tasks)}"""
replacement_end = """                    </div>`;
                })()}
            </div>
            
            ${renderHourlyProductionReport(tasks)}"""
text = text.replace(target_end, replacement_end)

with open("js/views/dashboard_v27.js", "w", encoding="utf-8") as f:
    f.write(text)

print("Fixed KPI TAREAS layout")
