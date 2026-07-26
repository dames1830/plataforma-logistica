import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash = f.read()

m_history = re.search(r'const renderBufferHistory = async \(container\) => \{(.*?)\}\n\s*const render', dash, re.DOTALL)
history_body = m_history.group(1).strip() if m_history else ''

m_results = re.search(r'const renderBufferResults = \(container, data\) => \{(.*?)\}\n\s*const render', dash, re.DOTALL)
results_body = m_results.group(1).strip() if m_results else ''

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    rp = f.read()

history_code = f"""async function renderHistorialBuffer() {{
  const container = document.getElementById('contentArea');
  {history_body}
}}

"""

results_code = f"""async function renderAnalisisBuffer() {{
  const container = document.getElementById('contentArea');
  
  container.innerHTML = `<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
  let data;
  try {{
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
}}

"""

start_idx = rp.find('async function renderHistorialBuffer() {')
end_idx = rp.find('// START', start_idx)
end_idx = rp.rfind('// ============================================================', start_idx, end_idx)

if start_idx != -1 and end_idx != -1:
    rp = rp[:start_idx] + history_code + results_code + rp[end_idx:]
    with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
        f.write(rp)
    print("Buffer correctly injected using absolute boundaries!")
else:
    print("Failed to find boundaries.")
