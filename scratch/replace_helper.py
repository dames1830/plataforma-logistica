import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = 'js/views/dashboard_v24.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Exact spaces count check: target has 56 spaces for lines inside div
target = """                                                     ` : `
                                                         <!-- Summary of liquidated client -->
                                                         <div style="margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:0.65rem; color:var(--text-muted);">
                                                             <div>💰 Cobro Flete: <strong style="color:#fff;">${c.cobroFlete}</strong></div>
                                                             <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                                                                 ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                                 ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                             </div>
                                                         </div>
                                                     `}"""

# Let's count the indentation spaces:
# The line containing: "                                                        <!-- Summary of liquidated client -->" has 56 spaces.
# In target variable I used 57 spaces in some and 56 in others. Let's make it match the printout:
# printout has:
# "                                                    ` : `" (52 spaces)
# "                                                        <!-- Summary of liquidated client -->" (56 spaces)
# "                                                        <div style=\"margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:0.65rem; color:var(--text-muted);\">" (56 spaces)
# "                                                            <div>💰 Cobro Flete: <strong style=\"color:#fff;\">${c.cobroFlete}</strong></div>" (60 spaces)
# "                                                            <div style=\"display:f" (60 spaces)

target_fixed = """                                                    ` : `
                                                        <!-- Summary of liquidated client -->
                                                        <div style="margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:0.65rem; color:var(--text-muted);">
                                                            <div>💰 Cobro Flete: <strong style="color:#fff;">${c.cobroFlete}</strong></div>
                                                            <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                                                                ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                                ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                            </div>
                                                        </div>
                                                    `}"""

replacement_fixed = """                                                    ` : `
                                                        <!-- Summary of liquidated client -->
                                                        <div style="margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:0.65rem; color:var(--text-muted);">
                                                            <div>💰 Cobro Flete: <strong style="color:#fff;">${c.cobroFlete}</strong></div>
                                                            ${c.gasto ? `<div>💸 Gasto: <strong style="color:#fff;">S/ ${parseFloat(c.gasto).toFixed(2)}</strong></div>` : ''}
                                                            <div>⚠️ Incidencia: <strong style="color:${c.incidencia === 'SI' ? '#ef4444' : '#fff'};">${c.incidencia || 'NO'}</strong></div>
                                                            ${c.incidenciaObs ? `<div style="word-break: break-word;">📝 Obs: <strong style="color:#fff;">${c.incidenciaObs}</strong></div>` : ''}
                                                            <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                                                                ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                                ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                            </div>
                                                        </div>
                                                    `}"""

normalized_target = target_fixed.replace('\r\n', '\n')
normalized_content = content.replace('\r\n', '\n')

if normalized_target in normalized_content:
    normalized_content = normalized_content.replace(normalized_target, replacement_fixed.replace('\r\n', '\n'))
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(normalized_content)
    print("Replaced successfully with correct indentation!")
else:
    print("Failed to replace. Indentation is still different.")
