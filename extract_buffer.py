import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash = f.read()

m_history = re.search(r'const renderBufferHistory = async \(container\) => \{(.*?)\}\n\s*const render', dash, re.DOTALL)
history_body = m_history.group(1).strip() if m_history else ''

m_results = re.search(r'const renderBufferResults = \(container, data\) => \{(.*?)\}\n\s*const render', dash, re.DOTALL)
results_body = m_results.group(1).strip() if m_results else ''

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    rp = f.read()

def replace_func(func_name, code):
    global rp
    start = rp.find(f'async function {func_name}() {{')
    if start == -1: return
    end = rp.find('}\n\n', start)
    if end == -1: end = rp.find('}\n', start)
    if end != -1:
        rp = rp[:start] + code + rp[end+2:]

history_code = f"""async function renderHistorialBuffer() {{
  const container = document.getElementById('contentArea');
  {history_body}
}}"""

results_code = f"""async function renderAnalisisBuffer() {{
  const container = document.getElementById('contentArea');
  
  // Need to get data!
  container.innerHTML = `<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
  let data;
  try {{
    // Use the loadBufferReport from csvHub
    data = await loadBufferReport();
  }} catch(e) {{
    console.error(e);
    container.innerHTML = `<div style="padding:2rem; color:#ef4444;">Error cargando Buffer Report: ${{e.message}}</div>`;
    return;
  }}
  
  if (!data) {{
    container.innerHTML = `<div style="padding:2rem; color:var(--text-muted);">No hay datos de an&aacute;lisis disponibles.</div>`;
    return;
  }}
  
  {results_body}
}}"""

replace_func('renderHistorialBuffer', history_code)
replace_func('renderAnalisisBuffer', results_code)

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(rp)

print("Buffer reports injected!")
