  let reservaState = { page: 1, query: '', skusArray: [], view: 'resumen' };
  let ubicacionState = { page: 1, query: '', ubisArray: [] };

  const renderAnalisisReserva = async (container) => {
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

        // Sub-SubNavegación UI
        container.innerHTML = `
            <div style="display:flex; justify-content:center; gap:10px; margin-bottom:1.5rem;">
                <button id="btn_view_resumen" class="btn-primary" style="padding:8px 20px; font-weight:800; font-size:0.9rem; border-radius:20px; transition:all 0.3s; ${reservaState.view === 'resumen' ? 'background:rgba(236,72,153,0.2); border:1px solid #ec4899; color:#ec4899; text-shadow:0 0 10px rgba(236,72,153,0.5); box-shadow:0 0 15px rgba(236,72,153,0.2);' : 'background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid transparent;'}">
                    📊 Resumen Reserva
                </button>
                <button id="btn_view_detalle" class="btn-primary" style="padding:8px 20px; font-weight:800; font-size:0.9rem; border-radius:20px; transition:all 0.3s; ${reservaState.view === 'detalle' ? 'background:rgba(16,185,129,0.2); border:1px solid #10b981; color:#10b981; text-shadow:0 0 10px rgba(16,185,129,0.5); box-shadow:0 0 15px rgba(16,185,129,0.2);' : 'background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid transparent;'}">
                    📑 Detalle Reserva
                </button>
            </div>
            <div id="reserva_view_content" style="width:100%; animation: fadeIn 0.3s ease;">
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">Cargando vista...</div>
            </div>
        `;

        document.getElementById('btn_view_resumen').onclick = () => {
            reservaState.view = 'resumen';
            renderAnalisisReserva(container);
        };
        document.getElementById('btn_view_detalle').onclick = () => {
            reservaState.view = 'detalle';
            renderAnalisisReserva(container);
        };

        const viewContainer = document.getElementById('reserva_view_content');
  
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
            if (!skuGroups[sku]) skuGroups[sku] = { totalQty: 0, paletas: [] };
            skuGroups[sku].totalQty += cantidad;
            let existingPaleta = skuGroups[sku].paletas.find(p => p.key === paletaKey);
            if (existingPaleta) {
                existingPaleta.cantidad += cantidad;
            } else {
                skuGroups[sku].paletas.push({ key: paletaKey, lpn, ubicacion, cantidad });
            }

            const skuKey = lpn ? `LPN: ${lpn} (${sku})` : `SKU: ${sku}`;
            if (!ubiGroups[ubicacion]) ubiGroups[ubicacion] = { totalQty: 0, skus: [] };
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
            return { sku, totalQty: skuGroups[sku].totalQty, numPaletas: skuGroups[sku].paletas.length, paletas: skuGroups[sku].paletas };
        });
        reservaState.skusArray.sort((a, b) => b.numPaletas - a.numPaletas);

        ubicacionState.ubisArray = Object.keys(ubiGroups).map(ubi => {
            const uniqueSkus = new Set(ubiGroups[ubi].skus.map(s => s.sku));
            return { ubicacion: ubi, totalQty: ubiGroups[ubi].totalQty, numSkus: uniqueSkus.size, skus: ubiGroups[ubi].skus };
        });
        ubicacionState.ubisArray.sort((a, b) => b.numSkus - a.numSkus);

        // --- RENDERIZAR DETALLE ---
        if (reservaState.view === 'detalle') {
            viewContainer.innerHTML = `
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
                            <div style="font-size:0.8rem; color:var(--text-muted);">Filtrados: ${filtered.length} SKUs</div>
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
                        reservaState.query = e.target.value; reservaState.page = 1; drawSku();
                        const newSearch = document.getElementById('reserva_sku_search');
                        if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length); }
                    });
                }
                const btnPrev = document.getElementById('reserva_sku_prev');
                if(btnPrev && reservaState.page > 1) { btnPrev.onclick = () => { reservaState.page--; drawSku(); }; }
                const btnNext = document.getElementById('reserva_sku_next');
                if(btnNext && reservaState.page < totalPages) { btnNext.onclick = () => { reservaState.page++; drawSku(); }; }
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
                            <div style="font-size:0.8rem; color:var(--text-muted);">Filtrados: ${filtered.length} Ubicaciones</div>
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
                        ubicacionState.query = e.target.value; ubicacionState.page = 1; drawUbi();
                        const newSearch = document.getElementById('reserva_ubi_search');
                        if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length); }
                    });
                }
                const btnPrev = document.getElementById('reserva_ubi_prev');
                if(btnPrev && ubicacionState.page > 1) { btnPrev.onclick = () => { ubicacionState.page--; drawUbi(); }; }
                const btnNext = document.getElementById('reserva_ubi_next');
                if(btnNext && ubicacionState.page < totalPages) { btnNext.onclick = () => { ubicacionState.page++; drawUbi(); }; }
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
        } 
        
        // --- RENDERIZAR RESUMEN (DASHBOARD) ---
        else if (reservaState.view === 'resumen') {
            // Fetch history data for charts
            let historyData = [];
            if (typeof fetchReservaHistory === 'function') {
                historyData = await fetchReservaHistory();
            }

            // Calculate current KPIs for top cards
            const totalSkus = reservaState.skusArray.length;
            const fragmentadosCount = reservaState.skusArray.filter(s => s.numPaletas > 1).length;
            const pctFragmentados = totalSkus > 0 ? ((fragmentadosCount / totalSkus) * 100).toFixed(1) : 0;

            const totalUbis = ubicacionState.ubisArray.length;
            const mixtasCount = ubicacionState.ubisArray.filter(u => u.numSkus > 1).length;
            const pctMixtas = totalUbis > 0 ? ((mixtasCount / totalUbis) * 100).toFixed(1) : 0;

            viewContainer.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">
                    <div class="glass-panel" style="flex:1; min-width:250px; padding:20px; border-left:4px solid #ec4899; box-shadow:0 0 15px rgba(236,72,153,0.1);">
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:800; letter-spacing:1px; margin-bottom:5px;">SKUS FRAGMENTADOS</div>
                        <div style="font-size:2rem; font-weight:900; color:#ec4899; text-shadow:0 0 10px rgba(236,72,153,0.3);">${fragmentadosCount} <span style="font-size:1rem; color:var(--text-muted);">de ${totalSkus}</span></div>
                        <div style="font-size:0.85rem; color:#fff; margin-top:5px; display:flex; align-items:center; gap:5px;">
                            <div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${pctFragmentados}%; background:#ec4899; height:100%; box-shadow:0 0 5px #ec4899;"></div>
                            </div>
                            <span>${pctFragmentados}%</span>
                        </div>
                    </div>

                    <div class="glass-panel" style="flex:1; min-width:250px; padding:20px; border-left:4px solid #f43f5e; box-shadow:0 0 15px rgba(244,63,94,0.1);">
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:800; letter-spacing:1px; margin-bottom:5px;">UBICACIONES MIXTAS</div>
                        <div style="font-size:2rem; font-weight:900; color:#f43f5e; text-shadow:0 0 10px rgba(244,63,94,0.3);">${mixtasCount} <span style="font-size:1rem; color:var(--text-muted);">de ${totalUbis}</span></div>
                        <div style="font-size:0.85rem; color:#fff; margin-top:5px; display:flex; align-items:center; gap:5px;">
                            <div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${pctMixtas}%; background:#f43f5e; height:100%; box-shadow:0 0 5px #f43f5e;"></div>
                            </div>
                            <span>${pctMixtas}%</span>
                        </div>
                    </div>

                    <div class="glass-panel" style="flex:1; min-width:250px; padding:20px; border-left:4px solid #10b981; box-shadow:0 0 15px rgba(16,185,129,0.1);">
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:800; letter-spacing:1px; margin-bottom:5px;">TOTAL PALETAS ALTAS</div>
                        <div style="font-size:2rem; font-weight:900; color:#10b981; text-shadow:0 0 10px rgba(16,185,129,0.3);">${processedCount}</div>
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
                            Paletas analizadas en la matriz
                        </div>
                    </div>
                </div>

                <div class="glass-panel" style="margin-bottom:20px; padding:20px; position:relative; min-height:300px; border:1px solid rgba(236,72,153,0.2); box-shadow:inset 0 0 20px rgba(236,72,153,0.05);">
                    <h3 style="color:#fff; margin-top:0; font-size:1rem; margin-bottom:1rem; display:flex; align-items:center; gap:10px;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ec4899; box-shadow:0 0 10px #ec4899;"></span>
                        EVOLUCIÓN HISTÓRICA POR DÍA
                    </h3>
                    <div style="height:250px; width:100%;">
                        <canvas id="reservaHistoryChart"></canvas>
                    </div>
                    ${historyData.length === 0 ? '<div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); color:var(--text-muted); font-weight:800;">No hay datos históricos disponibles aún. Sube un archivo hoy.</div>' : ''}
                </div>

                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div class="glass-panel" style="flex:1; min-width:400px; padding:20px; border:1px solid rgba(251,191,36,0.2);">
                        <h3 style="color:#fff; margin-top:0; font-size:1rem; margin-bottom:1rem;">Top 10 SKUs Fragmentados</h3>
                        <div style="height:250px; width:100%;">
                            <canvas id="topSkusChart"></canvas>
                        </div>
                    </div>
                    <div class="glass-panel" style="flex:1; min-width:400px; padding:20px; border:1px solid rgba(244,63,94,0.2);">
                        <h3 style="color:#fff; margin-top:0; font-size:1rem; margin-bottom:1rem;">Top 10 Ubicaciones Mixtas</h3>
                        <div style="height:250px; width:100%;">
                            <canvas id="topUbisChart"></canvas>
                        </div>
                    </div>
                </div>
            `;

            // Draw History Line Chart
            if (historyData.length > 0) {
                const ctxHist = document.getElementById('reservaHistoryChart');
                if (ctxHist) {
                    // Sort history by date ascending
                    historyData.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                    
                    const labels = historyData.map(d => {
                        const date = new Date(d.created_at);
                        return date.toLocaleDateString('es-ES', {month:'short', day:'numeric'});
                    });
                    
                    const skusFragData = historyData.map(d => d.skus_fragmentados || 0);
                    const ubisMixtasData = historyData.map(d => d.ubicaciones_mixtas || 0);

                    new Chart(ctxHist, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'SKUs Fragmentados',
                                    data: skusFragData,
                                    borderColor: '#ec4899',
                                    backgroundColor: 'rgba(236,72,153,0.1)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: true,
                                    pointBackgroundColor: '#ec4899',
                                    pointBorderColor: '#fff',
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                },
                                {
                                    label: 'Ubicaciones Mixtas',
                                    data: ubisMixtasData,
                                    borderColor: '#f43f5e',
                                    backgroundColor: 'rgba(244,63,94,0.1)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: true,
                                    pointBackgroundColor: '#f43f5e',
                                    pointBorderColor: '#fff',
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { labels: { color: '#fff', font: { family: "'Inter', sans-serif" } } }
                            },
                            scales: {
                                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true },
                                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                            }
                        }
                    });
                }
            }

            // Draw Top 10 SKUs Bar Chart
            const topSkus = reservaState.skusArray.slice(0, 10);
            const ctxSkus = document.getElementById('topSkusChart');
            if (ctxSkus && topSkus.length > 0) {
                new Chart(ctxSkus, {
                    type: 'bar',
                    data: {
                        labels: topSkus.map(s => s.sku),
                        datasets: [{
                            label: 'Cant. Paletas',
                            data: topSkus.map(s => s.numPaletas),
                            backgroundColor: 'rgba(251,191,36,0.6)',
                            borderColor: '#fbbf24',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } }
                        }
                    }
                });
            }

            // Draw Top 10 Ubicaciones Bar Chart
            const topUbis = ubicacionState.ubisArray.slice(0, 10);
            const ctxUbis = document.getElementById('topUbisChart');
            if (ctxUbis && topUbis.length > 0) {
                new Chart(ctxUbis, {
                    type: 'bar',
                    data: {
                        labels: topUbis.map(u => u.ubicacion),
                        datasets: [{
                            label: 'Cant. SKUs',
                            data: topUbis.map(u => u.numSkus),
                            backgroundColor: 'rgba(244,63,94,0.6)',
                            borderColor: '#f43f5e',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } }
                        }
                    }
                });
            }
        }
    };
