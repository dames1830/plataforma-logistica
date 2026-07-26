import re
from extracted_blocks import hourly, weekly, chart, marcas, operarios

get_week_number_fn = """
    const getWeekNumber = (d) => {
        const date = new Date(d);
        const dUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        dUTC.setUTCDate(dUTC.getUTCDate() + 4 - (dUTC.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1));
        return Math.ceil((((dUTC - yearStart) / 86400000) + 1) / 7);
    };
"""

# Modify return `...` to area.innerHTML = `...`
chart = re.sub(r'return\s+`', 'area.innerHTML = `', chart, count=1)
hourly = re.sub(r'return\s+`', 'area.innerHTML = `', hourly, count=1)
weekly = re.sub(r'return\s+`', 'area.innerHTML = `', weekly, count=1)

fn_chart = f"""function renderGraficoRendimiento() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__chartStartDate = filterStart;
  window.__chartEndDate = filterEnd;
  
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 GRÁFICO DE RENDIMIENTO</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  {get_week_number_fn}
  {chart}
}}
"""

fn_hourly = f"""function renderProduccionHora() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__kpiStartDate = filterStart;
  window.__kpiEndDate = filterEnd;
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 PRODUCCIÓN POR HORA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  {hourly}
}}
"""

fn_weekly = f"""function renderAlmacenadoSemana() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__kpiStartDate = filterStart;
  window.__kpiEndDate = filterEnd;
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 ALMACENADO POR SEMANA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  {get_week_number_fn}
  {weekly}
}}
"""

fn_marcas = f"""function renderMarcasReport() {{
  const area = document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  window.__kpiStartDate = filterStart;
  window.__kpiEndDate = filterEnd;
  area.innerHTML = `{marcas}`;
}}
"""

fn_operarios = f"""function renderRendimientoOperarios() {{
  const area = document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  const filteredTasks = tasks.filter(t => t.fecha >= filterStart && t.fecha <= filterEnd);
  const weeklyDailyTasks = tasks;
  window.__kpiStartDate = filterStart;
  window.__kpiEndDate = filterEnd;
  area.innerHTML = `{operarios}`;
}}
"""

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    publicos = f.read()

# Replace from function renderMarcasReport to EOF
pattern = r'function renderMarcasReport\(\).*'
repl = f"{fn_marcas}\n{fn_operarios}\n{fn_hourly}\n{fn_weekly}\n{fn_chart}\n\n// ============================================================\n// MÓDULO ZONA BUFFER\n// ============================================================"

# We actually want to replace everything from `function renderMarcasReport() {` up to `// MÓDULO ZONA BUFFER`
pattern = r'function renderMarcasReport\(\)\s*\{.*?(?=\n// ============================================================\n// MÓDULO ZONA BUFFER)'
publicos = re.sub(pattern, lambda m: f"{fn_marcas}\n{fn_operarios}\n{fn_hourly}\n{fn_weekly}\n{fn_chart}\n\n", publicos, flags=re.DOTALL)

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(publicos)

print('Injection completed.')
