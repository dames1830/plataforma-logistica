  const renderLayoutActivo = (container) => {
      const activoRaw = dataStore.buffer_activo || dataStore.analisis_sku_activo || [];
      const articulosRaw = dataStore.analisis_sku_maestro || dataStore.articulos || [];

      if (!activoRaw.length || !articulosRaw.length) {
          container.innerHTML = `
              <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                  <div style="font-size:3rem; margin-bottom:1rem; opacity:0.1;">🗺️</div>
                  <h4>Faltan Datos Base</h4>
                  <p>Para ver el Layout, por favor carga tu <b>Archivo de Stock Activo</b> y el <b>Maestro de Artículos</b> (para las temporadas).</p>
              </div>`;
          return;
      }

      const getColSafe = (row, possibleNames) => {
          if (!row) return '';
          for (const key of Object.keys(row)) {
              const upperKey = key.toUpperCase().trim();
              if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
          }
          const raw = Array.isArray(row) ? row : Object.values(row);
          for (const name of possibleNames) {
              if (name === 'IDX0') return String(raw[0] || '');
              if (name === 'IDX1') return String(raw[1] || '');
              if (name === 'IDX2') return String(raw[2] || '');
              if (name === 'IDX3') return String(raw[3] || '');
              if (name === 'IDX5') return String(raw[5] || '');
          }
          return '';
      };

      const skuTemporada = {};
      articulosRaw.forEach(row => {
          const sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO', 'IDX0']).trim();
          const temp = getColSafe(row, ['TEMPORADA', 'SEASON', 'IDX2']).trim();
          if (sku) skuTemporada[sku] = temp ? temp.toUpperCase() : 'DESCONOCIDA';
      });

      const layoutData = {};
      
      activoRaw.forEach(row => {
          const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
          const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
          const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;
          
          if (!ubi || !ubi.startsWith('SEL') || cant <= 0 || !skuFull) return;
          
          const sku7 = skuFull.substring(0, 7);
          
          const match = ubi.match(/SEL[- ]?(\d+).*?(\d+)(?:\D*)$/);
          if (match) {
              const col = parseInt(match[1], 10);
              const rackRow = parseInt(match[2], 10);
              
              if (col >= 1 && col <= 14 && rackRow >= 1 && rackRow <= 22) {
                  if (!layoutData[col]) layoutData[col] = {};
                  if (!layoutData[col][rackRow]) layoutData[col][rackRow] = { totalQty: 0, skus: [], seasons: {} };
                  
                  const cell = layoutData[col][rackRow];
                  cell.totalQty += cant;
                  
                  let temporadaRaw = skuTemporada[sku7] || skuTemporada[skuFull] || 'DESCONOCIDA';
                  let temporadaClean = 'OTRA';
                  if (temporadaRaw.includes('ACTUAL')) temporadaClean = 'ACTUAL';
                  else if (temporadaRaw.includes('ANTERIOR') || temporadaRaw.includes('PASADA')) temporadaClean = 'ANTERIOR';
                  
                  if (!cell.seasons[temporadaClean]) cell.seasons[temporadaClean] = 0;
                  cell.seasons[temporadaClean] += cant;
                  
                  const existingSku = cell.skus.find(s => s.sku === skuFull);
                  if (existingSku) existingSku.cant += cant;
                  else cell.skus.push({ sku: skuFull, cant, temporada: temporadaRaw });
              }
          }
      });

      let gridHtml = `<div style="display:flex; justify-content:space-between; gap:10px; width:100%; overflow-x:auto; padding-bottom:15px;">`;
      
      for (let c = 1; c <= 14; c++) {
          gridHtml += `<div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:40px;">`;
          
          for (let r = 22; r >= 1; r--) {
              const cellData = layoutData[c] && layoutData[c][r] ? layoutData[c][r] : null;
              
              let bgColor = 'rgba(255,255,255,0.02)';
              let tooltipHTML = `<b>SEL ${String(c).padStart(2,'0')} - Nivel ${r}</b><br/>Vacío`;
              
              if (cellData) {
                  const seasons = Object.keys(cellData.seasons);
                  if (seasons.length > 1) {
                      bgColor = 'linear-gradient(135deg, #fbbf24 0%, #ec4899 100%)'; 
                  } else if (seasons[0] === 'ACTUAL') {
                      bgColor = '#3b82f6'; 
                  } else if (seasons[0] === 'ANTERIOR') {
                      bgColor = '#ef4444'; 
                  } else {
                      bgColor = '#10b981'; // OTRA
                  }
                  
                  tooltipHTML = `<b>SEL ${String(c).padStart(2,'0')} - Nivel ${r}</b><br/>
                                 Total Unid: ${cellData.totalQty}<br/>
                                 SKUs: ${cellData.skus.length}<br/><hr style='border-color:rgba(255,255,255,0.1); margin:4px 0;'/>`;
                  cellData.skus.slice(0,5).forEach(s => {
                      tooltipHTML += `<span style='font-size:0.75rem; color:#ccc;'>${s.sku} (${s.cant}) - ${s.temporada}</span><br/>`;
                  });
                  if(cellData.skus.length > 5) tooltipHTML += `<span style='font-size:0.75rem; color:#ccc;'>...y ${cellData.skus.length-5} más</span>`;
              }
              
              gridHtml += `
                  <div class="layout-cell" 
                       style="height:15px; border:1px solid rgba(255,255,255,0.1); background:${bgColor}; cursor:pointer; position:relative;"
                       onmouseover="window.showTooltip(event, this.getAttribute('data-tooltip'))"
                       onmouseout="window.hideTooltip()"
                       data-tooltip="${tooltipHTML.replace(/"/g, '&quot;')}">
                  </div>
              `;
          }
          gridHtml += `<div style="text-align:center; font-size:0.65rem; color:var(--text-muted); font-weight:800; margin-top:5px; border:1px solid rgba(255,255,255,0.2); padding:2px;">SEL ${String(c).padStart(2,'0')}</div>`;
          gridHtml += `</div>`;
      }
      gridHtml += `</div>`;

      container.innerHTML = `
          <div class="glass-panel" style="padding:20px; position:relative;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                  <h3 style="color:#fff; margin:0; font-size:1.2rem; display:flex; align-items:center; gap:10px;">
                      <span style="font-size:1.5rem;">🗺️</span> LAYOUT DINÁMICO DE STOCK ACTIVO
                  </h3>
                  <div style="display:flex; gap:15px; font-size:0.8rem; font-weight:800;">
                      <div style="display:flex; align-items:center; gap:5px;"><div style="width:15px; height:15px; background:#ef4444; border:1px solid rgba(255,255,255,0.2);"></div> T. Anterior</div>
                      <div style="display:flex; align-items:center; gap:5px;"><div style="width:15px; height:15px; background:#3b82f6; border:1px solid rgba(255,255,255,0.2);"></div> T. Actual</div>
                      <div style="display:flex; align-items:center; gap:5px;"><div style="width:15px; height:15px; background:linear-gradient(135deg, #fbbf24 0%, #ec4899 100%); border:1px solid rgba(255,255,255,0.2);"></div> Mixto</div>
                      <div style="display:flex; align-items:center; gap:5px;"><div style="width:15px; height:15px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1);"></div> Vacío</div>
                  </div>
              </div>
              
              <div style="display:flex; gap:10px;">
                  <div style="display:flex; flex-direction:column; justify-content:space-between; padding-bottom:25px; padding-right:5px; font-size:0.65rem; color:var(--text-muted); font-weight:800; text-align:right;">
                      ${Array.from({length:22}, (_,i) => 22-i).map(n => `<div style="height:15px; display:flex; align-items:center;">${n}</div>`).join('')}
                  </div>
                  ${gridHtml}
              </div>
          </div>
      `;
