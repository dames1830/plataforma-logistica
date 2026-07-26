import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash_lines = f.readlines()

# renderBufferResults body is lines 1632-1702 (0-indexed 1631 to 1702)
# Wait, let's just make sure.
# In python, 1-indexed 1632 is dash_lines[1631].
results_body_lines = dash_lines[1631:1702]
results_body = "".join(results_body_lines)

# renderBufferHistory body is lines 5576-5988 (0-indexed 5575 to 5988)
history_body_lines = dash_lines[5575:5988]
history_body = "".join(history_body_lines)

# Now we need to wrap them in the correct async function headers for reportes_publicos.js
history_code = f"""async function renderHistorialBuffer() {{
  const container = document.getElementById('contentArea');
{history_body}
}}
"""

# For results code, we need to wrap it. But wait, renderBufferResults takes `data`.
# Where does it get `data` from?
# It must fetch it!
# In the original mock for renderAnalisisBuffer, what did it do?
# let history = []; try {{ history = await fetchBufferHistory(); }} catch(e) {{}}
# Actually, the original renderAnalisisBuffer in reportes_publicos.js did this:
# async function renderAnalisisBuffer() {
#   const area = document.getElementById('contentArea');
#   let buffer = [];
#   try { buffer = await adminService.getAlmacenajeTasks(); } catch(e) {}
# ...
# Wait, dashboard_v28.js has fetchBufferReportData()!
results_code = f"""async function renderAnalisisBuffer() {{
  const container = document.getElementById('contentArea');
  
  container.innerHTML = `<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
  let data;
  try {{
    // Re-use the existing data fetching logic for the public portal
    data = await adminService.fetchBufferReportData();
  }} catch (e) {{
    console.error(e);
    container.innerHTML = `<div style="padding:2rem; color:#ef4444; text-align:center;">Error al cargar datos del buffer.</div>`;
    return;
  }}

  if (!data) {{
     container.innerHTML = `<div style="padding:2rem; color:#ef4444; text-align:center;">Error al cargar datos del buffer.</div>`;
     return;
  }}

{results_body}
}}
"""

with open('js/views/reportes_publicos.js', 'r', encoding='utf-8') as f:
    rp_text = f.read()

# Replace the two mock functions
# They start at `async function renderHistorialBuffer() {` and end before `// ============================================================ // START`
# Wait, `// START` might not exist in .477!
# Let's use re.sub with carefully targeted replacements.

# Replace renderHistorialBuffer
new_rp = re.sub(
    r'async function renderHistorialBuffer\(\) \{.*?\}\n', 
    history_code + '\n', 
    rp_text, 
    flags=re.DOTALL
)

# Replace renderAnalisisBuffer
new_rp = re.sub(
    r'async function renderAnalisisBuffer\(\) \{.*?\}\n', 
    results_code + '\n', 
    new_rp, 
    flags=re.DOTALL
)

with open('js/views/reportes_publicos.js', 'w', encoding='utf-8') as f:
    f.write(new_rp)

print("INJECTION COMPLETE!")
