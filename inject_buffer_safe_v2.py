import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash_lines = f.readlines()

create_matrix_code = "".join(dash_lines[1578:1629])
buffer_results_body = "".join(dash_lines[1631:1702])
buffer_history_body = "".join(dash_lines[5575:5988])

analisis_code = f"""
// INJECTED FROM DASHBOARD
{create_matrix_code}

async function renderAnalisisBuffer() {{
  const container = document.getElementById('contentArea');
  container.innerHTML = `<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
  
  let data = null;
  try {{
    const raw = localStorage.getItem('lastBufferKPI');
    if (raw) data = JSON.parse(raw);
  }} catch(e) {{ console.warn(e); }}

  if (!data) {{
     container.innerHTML = `<div style="padding:2rem; color:#ef4444; text-align:center;">Error al cargar datos del buffer o no hay datos recientes.</div>`;
     return;
  }}

{buffer_results_body}
}}
"""

historial_code = f"""
async function renderHistorialBuffer() {{
  const container = document.getElementById('contentArea');
  container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div></div>`;

  let kpiHistory = [];
  try {{
    const raw = localStorage.getItem('logistics_buffer_history_v2');
    if (raw) kpiHistory = JSON.parse(raw);
  }} catch(e) {{}}

  const toISO = (dStr) => {{
      if(!dStr) return '';
      if(dStr.includes('T')) return dStr.split('T')[0];
      const parts = dStr.split('/');
      if(parts.length === 3) return `${{parts[2]}}-${{parts[1].padStart(2,'0')}}-${{parts[0].padStart(2,'0')}}`;
      return dStr;
  }};

{buffer_history_body.replace('await adminService.syncReportHistoryToLocal();', '// removed sync')}
}}
"""

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    rp_text = f.read()

# Manual find and replace
start_historial = rp_text.find('async function renderHistorialBuffer() {')
start_analisis = rp_text.find('async function renderAnalisisBuffer() {')
end_analisis = rp_text.find('// ============================================================', start_analisis)

if start_historial != -1 and end_analisis != -1:
    new_rp_text = rp_text[:start_historial] + historial_code + "\n\n" + analisis_code + "\n\n" + rp_text[end_analisis:]
    with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
        f.write(new_rp_text)
    print("INJECTION COMPLETE!")
else:
    print("COULD NOT FIND BOUNDARIES")
