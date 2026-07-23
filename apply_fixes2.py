import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    content = f.read()

# Replace showCellModal
start_marker = "window.showCellModal = function(htmlContent) {"
end_marker = "document.body.insertAdjacentHTML('beforeend', modalHtml);\n  };"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker) + len(end_marker)
    
    old_modal = content[start_idx:end_idx]
    
    replace_modal = """window.showCellModal = function(zonaLabel, c, r, isReserva) {
      if (!window.globalLayoutData) return;
      const layoutData = window.globalLayoutData[zonaLabel];
      if (!layoutData || !layoutData[c] || !layoutData[c][r]) return;
      const cellData = layoutData[c][r];
      
      let tableRows = '';
      let headersHTML = '';

      const articulos = window.globalArticulosRaw || [];
      const isArrayFormat = articulos.length > 0 && Array.isArray(articulos[0]);
      
      const idxSku = 1; // Columna B
      let realHeaders = [];
      if (isArrayFormat) {
          realHeaders = articulos[0].map(h => String(h).trim());
      } else if (articulos.length > 0) {
          realHeaders = Object.keys(articulos[0]);
      }

      headersHTML = realHeaders.map(h => `<th style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-weight:600; white-space:nowrap; position:sticky; top:0; background:#1e293b; z-index:1;">${h}</th>`).join('');
      headersHTML += `<th style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-weight:600; white-space:nowrap; position:sticky; top:0; background:#1e293b; z-index:1;">CANT.</th>`;

      cellData.skus.forEach(s => {
          let rowData = null;
          const targetSku7 = String(s.sku).substring(0, 7);
          
          for (let i = (isArrayFormat ? 1 : 0); i < articulos.length; i++) {
              const aRow = articulos[i];
              let aSku = '';
              if (isArrayFormat) {
                  aSku = String(aRow[idxSku] || '').trim();
              } else {
                  aSku = String(aRow['CodArticulo -T'] || aRow['ARTICULO'] || aRow['SKU'] || aRow['CodArticulo'] || Object.values(aRow)[1] || '').trim();
              }
              if (aSku && aSku.substring(0, 7) === targetSku7) {
                  rowData = aRow;
                  break;
              }
          }

          if (rowData) {
              let tds = '';
              if (isArrayFormat) {
                  for (let i = 0; i < realHeaders.length; i++) {
                      let val = rowData[i];
                      if (val === undefined || val === null) val = '';
                      tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0; white-space:nowrap;">${val}</td>`;
                  }
              } else {
                  for (const key of realHeaders) {
                      let val = rowData[key];
                      if (val === undefined || val === null) val = '';
                      tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0; white-space:nowrap;">${val}</td>`;
                  }
              }
              tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#3b82f6; font-weight:800;">${s.cant}</td>`;
              tableRows += `<tr>${tds}</tr>`;
          } else {
              tableRows += `<tr><td colspan="${realHeaders.length}" style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0;">No se encontró ${s.sku} en Maestro</td><td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#3b82f6; font-weight:800;">${s.cant}</td></tr>`;
          }
      });

      const modalHtml = `
          <div id="custom-cell-modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
              <div style="background:#0f172a; border:1px solid rgba(59, 130, 246, 0.3); border-radius:12px; min-width:600px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.8); position:relative; overflow:hidden;">
                  
                  <div style="padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%); flex-shrink: 0;">
                      <div>
                          <h3 style="color:#fff; margin:0; font-weight:800; font-size:1.2rem;">${zonaLabel} ${String(c).padStart(2,'0')} - Cuerpo ${r}</h3>
                          <p style="color:#94a3b8; margin:5px 0 0 0; font-size:0.85rem;">Total Unidades: <b style="color:#3b82f6;">${cellData.totalQty}</b> | SKUs Diferentes: <b style="color:#10b981;">${cellData.skus.length}</b></p>
                      </div>
                      <button onclick="document.getElementById('custom-cell-modal-overlay').remove()" style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.2rem; transition:0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">&times;</button>
                  </div>

                  <div style="padding:0; overflow:auto; flex:1;">
                      <table style="width:100%; border-collapse:collapse; font-size:0.85rem; font-family:sans-serif;">
                          <thead>
                              <tr>${headersHTML}</tr>
                          </thead>
                          <tbody>
                              ${tableRows}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      `;
      const oldModal = document.getElementById('custom-cell-modal-overlay');
      if (oldModal) oldModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
  };"""
    content = content.replace(old_modal, replace_modal)
    print("SUCCESS: showCellModal replaced")
else:
    print("FAILED: Start or end marker not found")

# Replace onclick
search_onclick = "onclick=\"window.showCellModal(this.getAttribute('data-full-tooltip'))\""
replace_onclick = "onclick=\"window.showCellModal(zonaLabel, c, r, isReserva)\""

if search_onclick in content:
    content = content.replace(search_onclick, replace_onclick)
    print("SUCCESS: onclick replaced")
else:
    print("FAILED: onclick not found")
    
# Replace globalLayoutData storage if not present
if "window.globalLayoutData = window.globalLayoutData || {};" not in content:
    content = content.replace("let localLayoutData = {};", "let localLayoutData = {};\n        window.globalLayoutData = window.globalLayoutData || {};\n        window.globalArticulosRaw = articulosRaw;")
    print("SUCCESS: globalLayoutData init added")

if "window.globalLayoutData[currentLayoutZona] = localLayoutData;" not in content:
    content = content.replace("let ACTUAL_TOTAL_CELLS = 14 * 22;", "window.globalLayoutData[currentLayoutZona] = localLayoutData;\n            let ACTUAL_TOTAL_CELLS = 14 * 22;")
    print("SUCCESS: globalLayoutData ACTIVO save added")

if "window.globalLayoutData['SEL'] = localLayoutDataRes;" not in content:
    content = content.replace("let RESERVA_TOTAL_CELLS = 12 * 22;", "window.globalLayoutData['SEL'] = localLayoutDataRes;\n            let RESERVA_TOTAL_CELLS = 12 * 22;")
    print("SUCCESS: globalLayoutData RESERVA save added")

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(content)
