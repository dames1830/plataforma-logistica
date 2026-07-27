import sys

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('function renderRendimientoOperarios() {')
end = text.find('// ============================================================', start)
if start == -1 or end == -1:
    print('Failed to find bounds')
    sys.exit(1)

with open('almacenaje_funcs.js', 'r', encoding='utf-8') as f:
    funcs = f.read()

new_logic = f"""
{funcs}

function renderRendimientoOperarios() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">👷 RENDIMIENTO OPERARIOS</div><div class="empty-msg">Sin datos en el rango seleccionado.</div></div>`;
    return;
  }}
  area.innerHTML = renderWorkerPerformanceReport(tasksList);
}}

function renderProduccionHora() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">⏱️ PRODUCCIÓN POR HORA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  area.innerHTML = renderHourlyProductionReport(tasksList);
}}

function renderAlmacenadoSemana() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">📅 ALMACENADO POR SEMANA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  area.innerHTML = renderWeeklyStorageReport(tasksList);
}}

function renderGraficoRendimiento() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card"><div class="report-title">📈 GRÁFICO RENDIMIENTO</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }}
  area.innerHTML = renderWeeklyDailyChartSection(tasksList);
}}

"""

new_text = text[:start] + new_logic + text[end:]

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Success!')
