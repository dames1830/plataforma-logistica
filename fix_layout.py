# -*- coding: utf-8 -*-
import re

with open("js/views/dashboard_v26.js", "r", encoding="utf-8") as f:
    text = f.read()

# Fix 1: Change flex-direction and width of map container
# Regex to match the flex-direction:column and the map container width:100%
pattern1 = r'targetContainer\.innerHTML = `\s*<div style="display:flex; width:100%; gap:20px; flex-direction:column; align-items:flex-start;">\s*<div class="glass-panel" style="padding:20px; position:relative; width:100%; min-width:0; overflow:hidden;'

replace1 = r'''targetContainer.innerHTML = `
                <div style="display:flex; width:100%; gap:20px; flex-direction:${isMZN ? 'column' : 'row'}; align-items:flex-start;">
                    <div class="glass-panel" style="padding:20px; position:relative; ${isMZN ? 'width:100%;' : 'flex: 0 0 70%; max-width: 70%;'} min-width:0; overflow-x:auto;'''

text, count = re.subn(pattern1, replace1, text)
print("Replaced wrapper:", count)

# Fix 2: Change reports container width
pattern2 = r'<div style="\$\{isMZN \? \'width:100%; display:grid; grid-template-columns: repeat\(3, 1fr\);\' : \'flex:1; min-width:320px; display:flex; flex-direction:column;\'\} gap:20px;">'

replace2 = r'''<div style="${isMZN ? 'width:100%; display:grid; grid-template-columns: repeat(3, 1fr);' : 'flex: 0 0 calc(30% - 20px); max-width: calc(30% - 20px); display:flex; flex-direction:column;'} gap:20px;">'''

text, count2 = re.subn(pattern2, replace2, text)
print("Replaced reports wrapper:", count2)

with open("js/views/dashboard_v26.js", "w", encoding="utf-8") as f:
    f.write(text)

