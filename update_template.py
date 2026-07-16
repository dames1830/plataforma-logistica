import re

with open('js/views/dashboard_v24.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add general card
card_anterior = '''                              <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:10px; border-radius:4px;">
                                  <div style="display:flex; justify-content:space-between; font-weight:800; color:#ef4444; margin-bottom:8px; font-size:0.95rem;">
                                      <span>T. Anterior</span>
                                      <span>%</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Artículos (Padre)</span>
                                      <span style="color:#fff;"></span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Unidades</span>
                                      <span style="color:#fff;"></span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                      <span style="cursor:help;" onmouseover="window.showTooltip(event, 'Unidades >= 20 que NO están en SEL 3-5')" onmouseout="window.hideTooltip()">Desviación (>20u) ??</span>
                                      <span style="color:#ef4444;"> mal ubicadas</span>
                                  </div>
                              </div>'''

card_general = '''
                              <div style="background:rgba(139,92,246,0.1); border-left:3px solid #8b5cf6; padding:10px; border-radius:4px; margin-top:15px;">
                                  <div style="display:flex; justify-content:space-between; font-weight:800; color:#8b5cf6; margin-bottom:8px; font-size:0.95rem;">
                                      <span>TOTAL GENERAL</span>
                                      <span>%</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Artículos (Padre)</span>
                                      <span style="color:#fff;"></span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Unidades</span>
                                      <span style="color:#fff;"></span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                      <span style="cursor:help;" onmouseover="window.showTooltip(event, 'Desviación general total')" onmouseout="window.hideTooltip()">Desviación (>20u) ??</span>
                                      <span style="color:#ef4444;"> mal ubicadas</span>
                                  </div>
                              </div>'''

content = content.replace(card_anterior, card_anterior + card_general)

# Rename DISTRIBUCIÓN DE DESVIACIÓN
content = content.replace('DISTRIBUCIÓN DE DESVIACIÓN', 'REPORTE AVANCE')

# Add general chart
chart_anterior = '''                              <div style="display:flex; flex-direction:column; align-items:center;">
                                  <div style="position:relative; width:120px; height:120px;">
                                      <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                          <path stroke="rgba(255,255,255,0.1)" fill="none" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#ef4444" fill="none" stroke-width="4" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#10b981" fill="none" stroke-width="4" stroke-dasharray=", 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                      </svg>
                                      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                          <span style="font-size:1.2rem; font-weight:800; color:#fff;">%</span>
                                          <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800;">CORRECTO</span>
                                      </div>
                                  </div>
                                  <div style="margin-top:10px; font-size:0.75rem; font-weight:800; color:#10b981;">T. ANTERIOR</div>
                              </div>'''

chart_general = '''
                              <div style="display:flex; flex-direction:column; align-items:center;">
                                  <div style="position:relative; width:120px; height:120px;">
                                      <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                          <path stroke="rgba(255,255,255,0.1)" fill="none" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#ef4444" fill="none" stroke-width="4" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#8b5cf6" fill="none" stroke-width="4" stroke-dasharray=", 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                      </svg>
                                      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                          <span style="font-size:1.2rem; font-weight:800; color:#fff;">%</span>
                                          <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800;">CORRECTO</span>
                                      </div>
                                  </div>
                                  <div style="margin-top:10px; font-size:0.75rem; font-weight:800; color:#8b5cf6;">GENERAL</div>
                              </div>'''

content = content.replace(chart_anterior, chart_anterior + chart_general)

# Add legend
legend_anterior = '''<div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#10b981;"></div> Correcto (Anterior)</div>'''
legend_general = '''\n                              <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#8b5cf6;"></div> Correcto (General)</div>'''

content = content.replace(legend_anterior, legend_anterior + legend_general)

# Bump version to v26.5.410
content = re.sub(r'DASH_VERSION = \'v26\.5\.\d+\'', 'DASH_VERSION = \\'v26.5.410\\'', content)

with open('js/views/dashboard_v24.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated dashboard_v24.js successfully')
