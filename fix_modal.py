import re

with open("js/views/dashboard_v24.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Save globalLayoutData and articulosRaw for the modal
search_layout_data = """        let localLayoutData = {};"""
replace_layout_data = """        let localLayoutData = {};
        window.globalLayoutData = window.globalLayoutData || {};
        window.globalArticulosRaw = articulosRaw;"""

content = content.replace(search_layout_data, replace_layout_data)

# 2. Store layout data in globalLayoutData at the end of Activo logic
search_activo_end = """            let ACTUAL_TOTAL_CELLS = 14 * 22;"""
replace_activo_end = """            window.globalLayoutData[currentLayoutZona] = localLayoutData;
            let ACTUAL_TOTAL_CELLS = 14 * 22;"""

content = content.replace(search_activo_end, replace_activo_end)

# 3. Store layout data in globalLayoutData at the end of Reserva logic
search_reserva_end = """            let RESERVA_TOTAL_CELLS = 12 * 22;"""
replace_reserva_end = """            window.globalLayoutData['SEL'] = localLayoutDataRes;
            let RESERVA_TOTAL_CELLS = 12 * 22;"""

content = content.replace(search_reserva_end, replace_reserva_end)

# 4. Change the onclick handler in the layout generation
search_html = """                             onclick="window.showCellModal(this.getAttribute('data-full-tooltip'))"
                             data-tooltip="${tooltipHTML.replace(/\"/g, '&quot;')}"
                             data-full-tooltip="${fullTooltipHTML.replace(/\"/g, '&quot;')}">"""

replace_html = """                             onclick="window.showCellModal('${zonaLabel}', ${c}, ${r}, ${isReserva})"
                             data-tooltip="${tooltipHTML.replace(/\"/g, '&quot;')}">"""

content = content.replace(search_html, replace_html)

# 5. Rewrite window.showCellModal
search_modal = re.compile(r"window\.showCellModal = function\(htmlContent\) \{.+?document\.body\.insertAdjacentHTML\('beforeend', modalHtml\);\n\s+\};", re.DOTALL)

replace_modal = """window.showCellModal = function(zonaLabel, c, r, isReserva) {
      const layoutData = window.globalLayoutData[zonaLabel];
      if (!layoutData || !layoutData[c] || !layoutData[c][r]) return;
      const cellData = layoutData[c][r];
      
      let tableRows = '';
      let headersHTML = '';
      let hasHeaders = false;

      // Extract original row data for each SKU
      const articulos = window.globalArticulosRaw || [];
      const isArrayFormat = articulos.length > 0 && Array.isArray(articulos[0]);
      
      let idxSku = 1;
      let realHeaders = [];
      if (isArrayFormat) {
          realHeaders = articulos[0].map(h => String(h).trim());
          const foundSku = realHeaders.findIndex(h => h.toUpperCase().includes('ARTICULO') || h.toUpperCase().includes('ARTÍCULO') || h.toUpperCase().includes('SKU'));
          if (foundSku >= 0) idxSku = foundSku;
      } else if (articulos.length > 0) {
          realHeaders = Object.keys(articulos[0]);
      }

      headersHTML = realHeaders.map(h => `<th style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-weight:600; white-space:nowrap; position:sticky; top:0; background:#1e293b;">${h}</th>`).join('');
      headersHTML += `<th style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:#94a3b8; font-weight:600; white-space:nowrap; position:sticky; top:0; background:#1e293b;">CANT.</th>`;

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
                      tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0; white-space:nowrap;">${rowData[i] || ''}</td>`;
                  }
              } else {
                  for (const key of realHeaders) {
                      tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0; white-space:nowrap;">${rowData[key] || ''}</td>`;
                  }
              }
              tds += `<td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#3b82f6; font-weight:800;">${s.cant}</td>`;
              tableRows += `<tr>${tds}</tr>`;
          } else {
              tableRows += `<tr><td colspan="${realHeaders.length}" style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0;">${s.sku}</td><td style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05); color:#3b82f6; font-weight:800;">${s.cant}</td></tr>`;
          }
      });

      const modalHtml = `
          <div id="custom-cell-modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
              <div style="background:#0f172a; border:1px solid rgba(59, 130, 246, 0.3); border-radius:12px; min-width:600px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.8); position:relative; overflow:hidden;">
                  
                  <div style="padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%);">
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

content = search_modal.sub(replace_modal, content)

with open("js/views/dashboard_v24.js", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
