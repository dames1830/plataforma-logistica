import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash_lines = f.readlines()

# Extract createMatrixHTML (lines 1578 to 1629, 0-indexed)
create_matrix_code = "".join(dash_lines[1578:1629])

# Extract renderBufferResults body (lines 1632 to 1702)
buffer_results_body = "".join(dash_lines[1631:1702])

# Extract renderBufferHistory body (lines 5575 to 5988)
buffer_history_body = "".join(dash_lines[5575:5988])

# Build the injected code for renderAnalisisBuffer
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

# Build the injected code for renderHistorialBuffer
# We can't use the exact body because it relies on kpiHistory and syncReportHistoryToLocal.
# We will adapt it slightly.
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

# Replace the mock renderHistorialBuffer
rp_text = re.sub(
    r'async function renderHistorialBuffer\(\) \{.*?\}\n',
    historial_code,
    rp_text,
    flags=re.DOTALL
)

# Replace the mock renderAnalisisBuffer
rp_text = re.sub(
    r'async function renderAnalisisBuffer\(\) \{.*?\}\n',
    analisis_code,
    rp_text,
    flags=re.DOTALL
)

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(rp_text)

print("INJECTION COMPLETE!")
