import sys
import re

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 2. Fix the syntax error
text = text.replace('mod?.subTabs', '(mod && mod.subTabs)')
text = text.replace('v26.5.477', 'v26.5.485')
text = text.replace('v26.5.483', 'v26.5.485')

# 3. Get the extracted functions
with open('almacenaje_funcs.js', 'r', encoding='utf-8') as f:
    funcs = f.read()

get_week_number = """
const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};
"""

start = text.find('function renderProduccionHora() {')
end = text.find('// ============================================================', start)

new_stubs = """
function renderProduccionHora() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">⏱️ PRODUCCIÓN POR HORA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderHourlyProductionReport(tasksList);
}

function renderAlmacenadoSemana() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📅 ALMACENADO POR SEMANA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderWeeklyStorageReport(tasksList);
}

function renderGraficoRendimiento() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📈 GRÁFICO RENDIMIENTO</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderWeeklyDailyChartSection(tasksList);
}
"""

new_text = text[:start] + funcs + "\n" + get_week_number + "\n" + new_stubs + "\n" + text[end:]

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

with open('reportes.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = re.sub(r'v26\.5\.\d+', 'v26.5.485', html)
with open('reportes.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Success rewriting the files!')
