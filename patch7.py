import io

with io.open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = 'onmouseout="window.hideTooltip()"\n                           data-tooltip="${tooltipHTML.replace(/\"/g, \'&quot;\')}">'
repl = 'onmouseout="window.hideTooltip()"\n                           onclick="window.showCellModal(this.getAttribute(\'data-full-tooltip\'))"\n                           data-tooltip="${tooltipHTML.replace(/\"/g, \'&quot;\')}"\n                           data-full-tooltip="${fullTooltipHTML.replace(/\"/g, \'&quot;\')}">'

if target in content:
    content = content.replace(target, repl)
else:
    print("Target not found! Attempting fallback...")
    target2 = 'onmouseout="window.hideTooltip()"'
    repl2 = 'onmouseout="window.hideTooltip()"\n                           onclick="window.showCellModal(this.getAttribute(\'data-full-tooltip\'))"'
    content = content.replace(target2, repl2)
    
    target3 = 'data-tooltip="${tooltipHTML.replace(/"/g, \'&quot;\')}">'
    repl3 = 'data-tooltip="${tooltipHTML.replace(/"/g, \'&quot;\')}"\n                           data-full-tooltip="${fullTooltipHTML.replace(/"/g, \'&quot;\')}">'
    content = content.replace(target3, repl3)

with io.open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(content)
