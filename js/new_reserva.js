  let reservaState = { page: 1, query: '', skusArray: [] };
  let ubicacionState = { page: 1, query: '', ubisArray: [] };

  const renderAnalisisReserva = (container) => {
        const rawReserva = dataStore.analisis_sku_reserva;
        if (!rawReserva || rawReserva.length === 0) {
            container.innerHTML = `
                <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                    <div style="font-size:3rem; margin-bottom:1rem; opacity:0.1;">📦</div>
                    <h4>Datos Incompletos</h4>
                    <p>Por favor carga el archivo <b>STOCK RESERVA</b> en la pestaña <b>ARCHIVO ANÁLISIS SKU</b>.</p>
                </div>`;
            return;
        }
  
        const skuGroups = {};
        const ubiGroups = {};
        let processedCount = 0;
  
        for (let i = 0; i < rawReserva.length; i++) {
            const row = rawReserva[i];
            if (!row) continue;
            
            if (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL')) continue;
  
            const ubicacion = String(row.UBICACION || '').trim();
            const lpn = String(row.LPN || '').trim();
            const sku = String(row.PRODUCTO || '').trim();
            const cantidad = parseFloat(row.CANTIDAD) || 0;
  
            if (!sku || cantidad <= 0 || !ubicacion) continue;
  
            const paletaKey = lpn ? `LPN: ${lpn} (${ubicacion})` : `UBI: ${ubicacion}`;
            if (!skuGroups[sku]) {
                skuGroups[sku] = { totalQty: 0, paletas: [] };
            }
            skuGroups[sku].totalQty += cantidad;
            let existingPaleta = skuGroups[sku].paletas.find(p => p.key === paletaKey);
            if (existingPaleta) {
                existingPaleta.cantidad += cantidad;
            } else {
                skuGroups[sku].paletas.push({ key: paletaKey, lpn, ubicacion, cantidad });
            }

            const skuKey = lpn ? `LPN: ${lpn} (${sku})` : `SKU: ${sku}`;
            if (!ubiGroups[ubicacion]) {
                ubiGroups[ubicacion] = { totalQty: 0, skus: [] };
            }
            ubiGroups[ubicacion].totalQty += cantidad;
            let existingSku = ubiGroups[ubicacion].skus.find(s => s.key === skuKey);
            if (existingSku) {
                existingSku.cantidad += cantidad;
            } else {
                ubiGroups[ubicacion].skus.push({ key: skuKey, lpn, sku, cantidad });
            }

            processedCount++;
        }
  
        reservaState.skusArray = Object.keys(skuGroups).map(sku => {
            const data = skuGroups[sku];
            return {
                sku,
                totalQty: data.totalQty,
                numPaletas: data.paletas.length,
                paletas: data.paletas
            };
        });
        reservaState.skusArray.sort((a, b) => b.numPaletas - a.numPaletas);
        reservaState.page = 1;

        ubicacionState.ubisArray = Object.keys(ubiGroups).map(ubi => {
            const data = ubiGroups[ubi];
            const uniqueSkus = new Set(data.skus.map(s => s.sku));
            return {
                ubicacion: ubi,
                totalQty: data.totalQty,
                numSkus: uniqueSkus.size,
                skus: data.skus
            };
        });
        ubicacionState.ubisArray.sort((a, b) => b.numSkus - a.numSkus);
        ubicacionState.page = 1;

        container.innerHTML = `
            <div style="display:flex; width:100%; gap:20px; align-items:flex-start;">
                <div id="reserva_sku_col" style="flex:1; min-width:0; overflow:hidden;"></div>
                <div id="reserva_ubi_col" style="flex:1; min-width:0; overflow:hidden;"></div>
            </div>
        `;

        const skuContainer = document.getElementById('reserva_sku_col');
        const ubiContainer = document.getElementById('reserva_ubi_col');

        const drawSku = () => {
            const filtered = reservaState.skusArray.filter(item => {
                if(!reservaState.query) return true;
                const q = reservaState.query.toLowerCase();
                if(item.sku.toLowerCase().includes(q)) return true;
                return item.paletas.some(p => p.lpn.toLowerCase().includes(q) || p.ubicacion.toLowerCase().includes(q));
            });

            const ITEMS_PER_PAGE = 40;
            const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
            if (reservaState.page > totalPages) reservaState.page = totalPages;
            
            const startIdx = (reservaState.page - 1) * ITEMS_PER_PAGE;
            const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            let rowsHtml = '';
            pageItems.forEach(item => {
                const p0 = item.paletas[0] || {lpn: '-', ubicacion: '-', cantidad: 0};
                rowsHtml += `
                    <tr style="border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2);">
                        <td style="padding:10px; font-weight:700; color:#fff;">${item.sku}</td>
                        <td style="padding:10px; text-align:center; color:#10b981; font-weight:800;">${item.totalQty.toLocaleString()}</td>
                        <td style="padding:10px; text-align:center; color:${item.numPaletas > 2 ? '#ef4444' : item.numPaletas > 1 ? '#fbbf24' : '#fff'}; font-weight:800;">${item.numPaletas}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem; border-left:1px solid rgba(255,255,255,0.02);">${p0.lpn}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem;">${p0.ubicacion}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem; text-align:right;">${p0.cantidad.toLocaleString()}</td>
                    </tr>
                `;
                for(let i=1; i<item.paletas.length; i++) {
                    const pi = item.paletas[i];
                    rowsHtml += `
                        <tr style="border-bottom:none;">
                            <td colspan="3"></td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem; border-left:1px solid rgba(255,255,255,0.02);">${pi.lpn}</td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem;">${pi.ubicacion}</td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem; text-align:right;">${pi.cantidad.toLocaleString()}</td>
                        </tr>
                    `;
                }
            });

            skuContainer.innerHTML = `
                <div style="width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="color:#818cf8; font-weight:800; margin:0; font-size:1.1rem;">ANÁLISIS DE FRAGMENTACIÓN DE RESERVA</h3>
                        <button id="btn_export_reserva_sku" class="btn-primary" style="display:flex; align-items:center; gap:0.5rem; background:#10b981; padding:5px 10px; font-size:0.8rem;">
                            <span>📊</span> Exportar
                        </button>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <input type="text" id="reserva_sku_search" placeholder="🔍 Buscar SKU o LPN..." value="${reservaState.query}" style="padding:8px 12px; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:#fff; width:60%; outline:none;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">
                            Filtrados: ${filtered.length} SKUs
                        </div>
                    </div>

                    <div style="background:rgba(15, 23, 42, 0.4); border:1px solid rgba(255,255,255,0.05); border-radius:10px; overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem;">
                            <thead>
                                <tr style="background:rgba(255,255,255,0.05); color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.1);">
                                    <th style="padding:10px;">PRODUCTO (SKU)</th>
                                    <th style="padding:10px; text-align:center;">TOTAL UNID</th>
                                    <th style="padding:10px; text-align:center;">CANT. PALETAS</th>
                                    <th style="padding:10px; border-left:1px solid rgba(255,255,255,0.02);">LPN</th>
                                    <th style="padding:10px;">UBICACIÓN</th>
                                    <th style="padding:10px; text-align:right;">CANTIDAD</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${filtered.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron resultados.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                        <button id="reserva_sku_prev" class="btn-secondary" style="padding:5px 10px; font-size:0.8rem;" ${reservaState.page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>◀ Ant</button>
                        <span style="color:var(--text-muted); font-size:0.8rem; font-weight:700;">Página ${reservaState.page} de ${totalPages}</span>
                        <button id="reserva_sku_next" class="btn-secondary" style="padding:5px 10px; font-size:0.8rem;" ${reservaState.page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Sig ▶</button>
                    </div>
                </div>
            `;

            const searchInput = document.getElementById('reserva_sku_search');
            if(searchInput) {
                searchInput.addEventListener('input', (e) => {
                    reservaState.query = e.target.value;
                    reservaState.page = 1;
                    drawSku();
                    const newSearch = document.getElementById('reserva_sku_search');
                    if (newSearch) {
                        newSearch.focus();
                        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                    }
                });
            }

            const btnPrev = document.getElementById('reserva_sku_prev');
            if(btnPrev && reservaState.page > 1) {
                btnPrev.onclick = () => { reservaState.page--; drawSku(); };
            }

            const btnNext = document.getElementById('reserva_sku_next');
            if(btnNext && reservaState.page < totalPages) {
                btnNext.onclick = () => { reservaState.page++; drawSku(); };
            }

            const btnExport = document.getElementById('btn_export_reserva_sku');
            if (btnExport) {
                btnExport.onclick = () => {
                    const wsData = [['PRODUCTO (SKU)', 'TOTAL UNIDADES', 'CANTIDAD PALETAS', 'LPN', 'UBICACIÓN', 'CANTIDAD']];
                    filtered.forEach(item => {
                        item.paletas.forEach((p, idx) => {
                            if (idx === 0) wsData.push([item.sku, item.totalQty, item.numPaletas, p.lpn, p.ubicacion, p.cantidad]);
                            else wsData.push(['', '', '', p.lpn, p.ubicacion, p.cantidad]);
                        });
                    });
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Analisis_SKU");
                    XLSX.writeFile(wb, "Analisis_Fragmentacion_Reserva.xlsx");
                };
            }
        };

        const drawUbi = () => {
            const filtered = ubicacionState.ubisArray.filter(item => {
                if(!ubicacionState.query) return true;
                const q = ubicacionState.query.toLowerCase();
                if(item.ubicacion.toLowerCase().includes(q)) return true;
                return item.skus.some(s => s.lpn.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q));
            });

            const ITEMS_PER_PAGE = 40;
            const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
            if (ubicacionState.page > totalPages) ubicacionState.page = totalPages;
            
            const startIdx = (ubicacionState.page - 1) * ITEMS_PER_PAGE;
            const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            let rowsHtml = '';
            pageItems.forEach(item => {
                const s0 = item.skus[0] || {lpn: '-', sku: '-', cantidad: 0};
                rowsHtml += `
                    <tr style="border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2);">
                        <td style="padding:10px; font-weight:700; color:#fff;">${item.ubicacion}</td>
                        <td style="padding:10px; text-align:center; color:#10b981; font-weight:800;">${item.totalQty.toLocaleString()}</td>
                        <td style="padding:10px; text-align:center; color:${item.numSkus > 2 ? '#ef4444' : item.numSkus > 1 ? '#fbbf24' : '#fff'}; font-weight:800;">${item.numSkus}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem; border-left:1px solid rgba(255,255,255,0.02);">${s0.lpn}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem;">${s0.sku}</td>
                        <td style="padding:10px; color:var(--text-muted); font-size:0.8rem; text-align:right;">${s0.cantidad.toLocaleString()}</td>
                    </tr>
                `;
                for(let i=1; i<item.skus.length; i++) {
                    const si = item.skus[i];
                    rowsHtml += `
                        <tr style="border-bottom:none;">
                            <td colspan="3"></td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem; border-left:1px solid rgba(255,255,255,0.02);">${si.lpn}</td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem;">${si.sku}</td>
                            <td style="padding:4px 10px; color:var(--text-muted); font-size:0.8rem; text-align:right;">${si.cantidad.toLocaleString()}</td>
                        </tr>
                    `;
                }
            });

            ubiContainer.innerHTML = `
                <div style="width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="color:#f43f5e; font-weight:800; margin:0; font-size:1.1rem;">REPORTE UBICACIÓN RESERVA</h3>
                        <button id="btn_export_reserva_ubi" class="btn-primary" style="display:flex; align-items:center; gap:0.5rem; background:#10b981; padding:5px 10px; font-size:0.8rem;">
                            <span>📊</span> Exportar
                        </button>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <input type="text" id="reserva_ubi_search" placeholder="🔍 Buscar Ubicación, LPN o SKU..." value="${ubicacionState.query}" style="padding:8px 12px; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:#fff; width:60%; outline:none;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">
                            Filtrados: ${filtered.length} Ubicaciones
                        </div>
                    </div>

                    <div style="background:rgba(15, 23, 42, 0.4); border:1px solid rgba(255,255,255,0.05); border-radius:10px; overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem;">
                            <thead>
                                <tr style="background:rgba(255,255,255,0.05); color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.1);">
                                    <th style="padding:10px;">UBICACIÓN</th>
                                    <th style="padding:10px; text-align:center;">TOTAL UNID</th>
                                    <th style="padding:10px; text-align:center;">CANT. SKUs</th>
                                    <th style="padding:10px; border-left:1px solid rgba(255,255,255,0.02);">LPN</th>
                                    <th style="padding:10px;">PRODUCTO (SKU)</th>
                                    <th style="padding:10px; text-align:right;">CANTIDAD</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${filtered.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron resultados.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                        <button id="reserva_ubi_prev" class="btn-secondary" style="padding:5px 10px; font-size:0.8rem;" ${ubicacionState.page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>◀ Ant</button>
                        <span style="color:var(--text-muted); font-size:0.8rem; font-weight:700;">Página ${ubicacionState.page} de ${totalPages}</span>
                        <button id="reserva_ubi_next" class="btn-secondary" style="padding:5px 10px; font-size:0.8rem;" ${ubicacionState.page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Sig ▶</button>
                    </div>
                </div>
            `;

            const searchInput = document.getElementById('reserva_ubi_search');
            if(searchInput) {
                searchInput.addEventListener('input', (e) => {
                    ubicacionState.query = e.target.value;
                    ubicacionState.page = 1;
                    drawUbi();
                    const newSearch = document.getElementById('reserva_ubi_search');
                    if (newSearch) {
                        newSearch.focus();
                        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                    }
                });
            }

            const btnPrev = document.getElementById('reserva_ubi_prev');
            if(btnPrev && ubicacionState.page > 1) {
                btnPrev.onclick = () => { ubicacionState.page--; drawUbi(); };
            }

            const btnNext = document.getElementById('reserva_ubi_next');
            if(btnNext && ubicacionState.page < totalPages) {
                btnNext.onclick = () => { ubicacionState.page++; drawUbi(); };
            }

            const btnExport = document.getElementById('btn_export_reserva_ubi');
            if (btnExport) {
                btnExport.onclick = () => {
                    const wsData = [['UBICACIÓN', 'TOTAL UNIDADES', 'CANTIDAD SKU', 'LPN', 'PRODUCTO (SKU)', 'CANTIDAD']];
                    filtered.forEach(item => {
                        item.skus.forEach((s, idx) => {
                            if (idx === 0) wsData.push([item.ubicacion, item.totalQty, item.numSkus, s.lpn, s.sku, s.cantidad]);
                            else wsData.push(['', '', '', s.lpn, s.sku, s.cantidad]);
                        });
                    });
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Ubicacion");
                    XLSX.writeFile(wb, "Reporte_Ubicacion_Reserva.xlsx");
                };
            }
        };

        drawSku();
        drawUbi();
    };
