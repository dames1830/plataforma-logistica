import io
with io.open('js/views/dashboard_v24.js', 'r', encoding='latin-1') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if "let tooltipHTML = `<b>${zonaLabel} ${String(c).padStart(2,'0')} - Cuerpo ${r}</b><br/>" in lines[i]:
        if "Vac" in lines[i]:
            lines[i] = lines[i].rstrip() + "\n                  let fullTooltipHTML = tooltipHTML;\n"
            
    if "cellData.skus.slice(0,5).forEach(s => {" in lines[i]:
        # found the loop
        lines[i-2] = lines[i-2].rstrip() + "\n                      fullTooltipHTML = tooltipHTML;\n"
        lines[i] = lines[i].replace(".slice(0,5)", "")
        lines[i] = lines[i].replace("s => {", "(s, idx) => {")
        
        # Now change the line that appends to tooltipHTML
        # It's at i+3: tooltipHTML += `<span...
        item_html_line = lines[i+3].replace("tooltipHTML += ", "const itemHTML = ")
        lines[i+3] = item_html_line + "                          if (idx < 5) tooltipHTML += itemHTML;\n                          fullTooltipHTML += itemHTML;\n"

    if "onclick=\"window.showCellModal(this.getAttribute('data-tooltip'))\"" in lines[i]:
        lines[i] = lines[i].replace('data-tooltip', 'data-full-tooltip')
        
    if "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\">" in lines[i]:
        lines[i] = lines[i].replace(
            "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\">",
            "data-tooltip=\"${tooltipHTML.replace(/\\\"/g, '&quot;')}\"\n                           data-full-tooltip=\"${fullTooltipHTML.replace(/\\\"/g, '&quot;')}\">"
        )

with io.open('js/views/dashboard_v24.js', 'w', encoding='latin-1') as f:
    f.writelines(lines)
