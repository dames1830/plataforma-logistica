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
          if (sku && temp) skuTemporada[sku] = temp.toUpperCase();
      });

      const layoutData = {};
      
      activoRaw.forEach(row => {
          const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
          const sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
          const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;
          
          if (!ubi || !ubi.startsWith('SEL') || cant <= 0) return;
          
          const match = ubi.match(/SEL[- ]?(\d+).*?(\d+)(?:\D*)$/);
          if (match) {
              const col = parseInt(match[1], 10);
              const rackRow = parseInt(match[2], 10);
              
              if (col >= 1 && col <= 14 && rackRow >= 1 && rackRow <= 22) {
                  if (!layoutData[col]) layoutData[col] = {};
                  if (!layoutData[col][rackRow]) layoutData[col][rackRow] = { totalQty: 0, skus: [], seasons: {} };
                  
                  const cell = layoutData[col][rackRow];
                  cell.totalQty += cant;
                  
                  let temporadaRaw = skuTemporada[sku] || 'DESCONOCIDA';
                  let temporadaClean = 'OTRA';
                  if (temporadaRaw.includes('ACTUAL')) temporadaClean = 'ACTUAL';
                  else if (temporadaRaw.includes('ANTERIOR') || temporadaRaw.includes('PASADA')) temporadaClean = 'ANTERIOR';
                  
                  if (!cell.seasons[temporadaClean]) cell.seasons[temporadaClean] = 0;
                  cell.seasons[temporadaClean] += cant;
                  
                  const existingSku = cell.skus.find(s => s.sku === sku);
                  if (existingSku) existingSku.cant += cant;
                  else cell.skus.push({ sku, cant, temporada: temporadaRaw });
              }
          }
      });
