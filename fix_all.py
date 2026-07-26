import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash = f.read()

# 1. Marcas (already extracted but needs grid wrapper)
m_marcas = re.search(r'<!-- REPORTE ALMACENAJE - MARCAS \(IZQUIERDA\) -->(.*?)<!-- REPORTE ALMACENAJE - GENDER RIMS \(DERECHA\) -->', dash, re.DOTALL)
marcas = m_marcas.group(1).strip() if m_marcas else ''
marcas = '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.5rem;"><div style="grid-column: 1;">' + marcas + '</div></div>'

# 2. Operarios
m_operarios = re.search(r'<!-- REPORTE RENDIMIENTO DE OPERARIOS \(ANCHO COMPLETO\) -->(.*?)\$\{renderHourlyProductionReport', dash, re.DOTALL)
operarios = m_operarios.group(1).strip() if m_operarios else ''

# 3. Hourly
m_hourly = re.search(r'const renderHourlyProductionReport = \(tasksList\) => \{(.*?)\s*};\s*\n\s*const renderWeeklyStorageReport =', dash, re.DOTALL)
hourly = m_hourly.group(1).strip() if m_hourly else ''
def replace_last_return(text):
    parts = text.rsplit('return `', 1)
    if len(parts) == 2: return parts[0] + 'area.innerHTML = `' + parts[1]
    parts = text.rsplit('return\n', 1)
    if len(parts) == 2: return parts[0] + 'area.innerHTML = \n' + parts[1]
    parts = text.rsplit('return', 1)
    if len(parts) == 2: return parts[0] + 'area.innerHTML = ' + parts[1]
    return text
hourly = replace_last_return(hourly)

# 4. Weekly
m_weekly = re.search(r'const renderWeeklyStorageReport = \(tasksList\) => \{(.*?)\s*};\s*\n\s*const renderWeeklyDailyChartSection =', dash, re.DOTALL)
weekly = m_weekly.group(1).strip() if m_weekly else ''
weekly = replace_last_return(weekly)

# 5. Chart
m_chart = re.search(r'const renderWeeklyDailyChartSection = \(tasksList\) => \{(.*?)\s*};\s*\n\s*const render', dash, re.DOTALL)
chart = m_chart.group(1).strip() if m_chart else ''
chart = replace_last_return(chart)


with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    rp = f.read()

get_week_number_fn = '''
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
        return weekNo;
    };
'''

# Use manual splitting to replace blocks
def replace_func(func_name, code):
    global rp
    start = rp.find(f'function {func_name}() {{')
    if start == -1: return
    end = rp.find('}\n\n', start)
    if end == -1: end = rp.find('}\n', start)
    if end != -1:
        rp = rp[:start] + code + rp[end+2:]

replace_func('renderMarcasReport', f"""function renderMarcasReport() {{
  const area = document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  window.__kpiStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__kpiEndDate = filterEnd || new Date().toISOString().split('T')[0];
  area.innerHTML = `{marcas}`;
}}""")

# Replace old names in case it's named renderRendimientoOperarios
old_op = rp.find('function renderRendimientoOperarios() {')
if old_op != -1:
    end = rp.find('}\n\n', old_op)
    if end == -1: end = rp.find('}\n', old_op)
    rp = rp[:old_op] + rp[end+2:]

replace_func('renderRendimientoOps', f"""function renderRendimientoOps() {{
  const area = document.getElementById('contentArea');
  const container = area; 
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  const tasks = tasksList;

  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card" style="text-align:center; padding:3rem; color:var(--text-muted);">No hay tareas finalizadas en este periodo.</div>`;
    return;
  }}
  {get_week_number_fn}
  
  area.innerHTML = `{operarios}`;
}}""")

replace_func('renderProduccionHora', f"""function renderProduccionHora() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card" style="text-align:center; padding:3rem; color:var(--text-muted);">No hay datos en este periodo.</div>`;
    return;
  }}
  
  {hourly}
}}""")

replace_func('renderAlmacenadoSemana', f"""function renderAlmacenadoSemana() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card" style="text-align:center; padding:3rem; color:var(--text-muted);">No hay datos en este periodo.</div>`;
    return;
  }}
  
  {weekly}
}}""")

replace_func('renderGraficoRendimiento', f"""function renderGraficoRendimiento() {{
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  
  if (tasksList.length === 0) {{
    area.innerHTML = `<div class="report-card" style="text-align:center; padding:3rem; color:var(--text-muted);">No hay datos en este periodo.</div>`;
    return;
  }}
  {get_week_number_fn}
  
  {chart}
}}""")

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(rp)

print("All reports fixed and injected successfully!")
