import io

with io.open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if "BATA" in lines[i] and "h3 class=\"text-lg font-bold uppercase" in lines[i]:
        lines[i] = lines[i].replace("BATA", "${brandTitle}")
    if "let headerHtml = " in lines[i]:
        lines[i] = "                  let brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : 'BATA';\n" + lines[i]

    if "BATA" in lines[i] and "h2 class=\"text-sm font-bold uppercase text-gray-400" in lines[i]:
        lines[i] = lines[i].replace("BATA", "${brandTitle}")
    if "let asideHtml = " in lines[i]:
        lines[i] = "                  let brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : 'BATA';\n" + lines[i]

    if "let tooltipHTML = `<b>${zonaLabel} ${String(c).padStart(2,'0')} - Cuerpo ${r}</b><br/>Vac" in lines[i]:
        lines[i] = lines[i].rstrip() + "\n                  let fullTooltipHTML = tooltipHTML;\n"
        
    if "cellData.skus.slice(0,5).forEach(s => {" in lines[i]:
        lines[i-1] = lines[i-1].rstrip() + "\n                      fullTooltipHTML = tooltipHTML;\n"
        lines[i] = lines[i].replace(".slice(0,5)", "")
        lines[i] = lines[i].replace("s => {", "(s, idx) => {")
        
        item_html_line = lines[i+3].replace("tooltipHTML += ", "const itemHTML = ")
        lines[i+3] = item_html_line + "                          if (idx < 5) tooltipHTML += itemHTML;\n                          fullTooltipHTML += itemHTML;\n"

    if "onclick=\"window.showCellModal(this.getAttribute('data-tooltip'))\"" in lines[i]:
        lines[i] = lines[i].replace('data-tooltip', 'data-full-tooltip')
    elif "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\">" in lines[i]:
        lines[i] = lines[i].replace(
            "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\">",
            "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\"\n                           data-full-tooltip=\"${fullTooltipHTML.replace(/\\\"/g, '&quot;')}\">"
        )
        
    if "window.showTooltip = function" in lines[i]:
        modal_fn = """
window.showCellModal = function(htmlContent) {
    const modalHtml = `
        <div id="custom-cell-modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:99999; display:flex; justify-content:center; align-items:center;">
            <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:20px; min-width:300px; max-width:90vw; max-height:80vh; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.5); position:relative;">
                <button onclick="document.getElementById('custom-cell-modal-overlay').remove()" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
                <div style="color:#e2e8f0; font-family:sans-serif; line-height:1.5; margin-top:10px;">
                    ${htmlContent}
                </div>
            </div>
        </div>
    `;
    const oldModal = document.getElementById('custom-cell-modal-overlay');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};
"""
        lines[i] = modal_fn + "\n" + lines[i]

with io.open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
