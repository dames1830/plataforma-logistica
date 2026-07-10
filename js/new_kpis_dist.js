            // Calculate current KPIs for top cards
            const totalSkus = reservaState.skusArray.length;
            let skuDist = { '1':0, '2_5':0, '6_8':0, '9_12':0, '13_plus':0 };
            reservaState.skusArray.forEach(s => {
                if(s.numPaletas === 1) skuDist['1']++;
                else if(s.numPaletas <= 5) skuDist['2_5']++;
                else if(s.numPaletas <= 8) skuDist['6_8']++;
                else if(s.numPaletas <= 12) skuDist['9_12']++;
                else skuDist['13_plus']++;
            });

            const totalUbis = ubicacionState.ubisArray.length;
            let ubiDist = { '1':0, '2_5':0, '6_10':0, '11_plus':0 };
            ubicacionState.ubisArray.forEach(u => {
                if(u.numSkus === 1) ubiDist['1']++;
                else if(u.numSkus <= 5) ubiDist['2_5']++;
                else if(u.numSkus <= 10) ubiDist['6_10']++;
                else ubiDist['11_plus']++;
            });

            const renderBar = (count, total, color) => {
                const pct = total > 0 ? ((count/total)*100).toFixed(1) : 0;
                return `
                    <div style="width:100px; text-align:right;">
                        <div style="font-size:1.1rem; font-weight:800; color:${color};">${count} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">(${pct}%)</span></div>
                        <div style="width:100%; background:rgba(255,255,255,0.05); height:4px; border-radius:2px; margin-top:2px; overflow:hidden; position:relative;">
                            <div style="position:absolute; right:0; width:${pct}%; background:${color}; height:100%; box-shadow:0 0 5px ${color};"></div>
                        </div>
                    </div>
                `;
            };

            const rowStyle = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);";

            viewContainer.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">
                    <!-- TARJETA 1: DISTRIBUCIÓN DE SKUS -->
                    <div class="glass-panel" style="flex:1; min-width:300px; padding:20px; border-top:4px solid #fbbf24; box-shadow:0 0 15px rgba(251,191,36,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <div style="font-size:0.9rem; color:var(--text-muted); font-weight:800; letter-spacing:1px;">DISTRIBUCIÓN DE SKUS POR PALETAS</div>
                            <div style="font-size:0.8rem; color:rgba(255,255,255,0.3);">Total: ${totalSkus}</div>
                        </div>
                        
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">SKU con 1 Paleta</div>
                            ${renderBar(skuDist['1'], totalSkus, '#10b981')}
                        </div>
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">SKU con 2 a 5 paletas</div>
                            ${renderBar(skuDist['2_5'], totalSkus, '#fbbf24')}
                        </div>
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">SKU con 6 a 8 paletas</div>
                            ${renderBar(skuDist['6_8'], totalSkus, '#f97316')}
                        </div>
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">SKU con 9 a 12 paletas</div>
                            ${renderBar(skuDist['9_12'], totalSkus, '#ef4444')}
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px;">
                            <div style="font-size:0.85rem; color:#fff;">SKU con mayor a 13 paletas</div>
                            ${renderBar(skuDist['13_plus'], totalSkus, '#b91c1c')}
                        </div>
                    </div>

                    <!-- TARJETA 2: DISTRIBUCIÓN DE UBICACIONES -->
                    <div class="glass-panel" style="flex:1; min-width:300px; padding:20px; border-top:4px solid #60a5fa; box-shadow:0 0 15px rgba(96,165,250,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <div style="font-size:0.9rem; color:var(--text-muted); font-weight:800; letter-spacing:1px;">DISTRIBUCIÓN DE UBICACIONES POR SKUS</div>
                            <div style="font-size:0.8rem; color:rgba(255,255,255,0.3);">Total: ${totalUbis}</div>
                        </div>
                        
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">Ubicación con 1 SKU</div>
                            ${renderBar(ubiDist['1'], totalUbis, '#10b981')}
                        </div>
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">Ubicación con 2 a 5 SKUs</div>
                            ${renderBar(ubiDist['2_5'], totalUbis, '#fbbf24')}
                        </div>
                        <div style="${rowStyle}">
                            <div style="font-size:0.85rem; color:#fff;">Ubicación con 6 a 10 SKUs</div>
                            ${renderBar(ubiDist['6_10'], totalUbis, '#f97316')}
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px;">
                            <div style="font-size:0.85rem; color:#fff;">Ubicación con mayor a 11 SKUs</div>
                            ${renderBar(ubiDist['11_plus'], totalUbis, '#ef4444')}
                        </div>
                    </div>
                </div>

                <div class="glass-panel" style="margin-bottom:20px; padding:20px; position:relative; min-height:300px; border:1px solid rgba(236,72,153,0.2); box-shadow:inset 0 0 20px rgba(236,72,153,0.05);">
