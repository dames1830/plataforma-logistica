import re

with open('js/views/dashboard_v28.js', 'r', encoding='utf-8') as f:
    dash = f.read()

def extract_function_body(text, func_decl):
    start = text.find(func_decl)
    if start == -1: return None
    
    # find the first '{' after start
    brace_start = text.find('{', start)
    if brace_start == -1: return None
    
    stack = []
    for i in range(brace_start, len(text)):
        if text[i] == '{':
            stack.append('{')
        elif text[i] == '}':
            stack.pop()
            if len(stack) == 0:
                # return the body WITHOUT the outer braces
                return text[brace_start+1:i].strip()
    return None

history_body = extract_function_body(dash, 'const renderBufferHistory = async (container) =>')
results_body = extract_function_body(dash, 'const renderBufferResults = (container, data) =>')

if not history_body or not results_body:
    print("Could not extract properly!")
    exit(1)

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
    print("Buffer correctly injected using bracket matching!")
else:
    print("Failed to find boundaries in reportes_publicos.js")
