            // Calculate current KPIs for top cards
            const totalSkus = reservaState.skusArray.length;
            const skusMas5Paletas = reservaState.skusArray.filter(s => s.numPaletas > 5).length;
            const pctSkusMas5 = totalSkus > 0 ? ((skusMas5Paletas / totalSkus) * 100).toFixed(1) : 0;

            const totalUbis = ubicacionState.ubisArray.length;
            const ubisMenos50 = ubicacionState.ubisArray.filter(u => u.totalQty < 50).length;
            const pctUbisMenos50 = totalUbis > 0 ? ((ubisMenos50 / totalUbis) * 100).toFixed(1) : 0;

            viewContainer.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">
                    <div class="glass-panel" style="flex:1; min-width:250px; padding:20px; border-left:4px solid #fbbf24; box-shadow:0 0 15px rgba(251,191,36,0.1);">
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:800; letter-spacing:1px; margin-bottom:5px;">SKUS CON > 5 PALETAS</div>
                        <div style="font-size:2rem; font-weight:900; color:#fbbf24; text-shadow:0 0 10px rgba(251,191,36,0.3);">${skusMas5Paletas} <span style="font-size:1rem; color:var(--text-muted);">de ${totalSkus}</span></div>
                        <div style="font-size:0.85rem; color:#fff; margin-top:5px; display:flex; align-items:center; gap:5px;">
                            <div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${pctSkusMas5}%; background:#fbbf24; height:100%; box-shadow:0 0 5px #fbbf24;"></div>
                            </div>
                            <span>${pctSkusMas5}%</span>
                        </div>
                    </div>

                    <div class="glass-panel" style="flex:1; min-width:250px; padding:20px; border-left:4px solid #60a5fa; box-shadow:0 0 15px rgba(96,165,250,0.1);">
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:800; letter-spacing:1px; margin-bottom:5px;">UBICACIONES CON < 50 UNID</div>
                        <div style="font-size:2rem; font-weight:900; color:#60a5fa; text-shadow:0 0 10px rgba(96,165,250,0.3);">${ubisMenos50} <span style="font-size:1rem; color:var(--text-muted);">de ${totalUbis}</span></div>
                        <div style="font-size:0.85rem; color:#fff; margin-top:5px; display:flex; align-items:center; gap:5px;">
                            <div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
                                <div style="width:${pctUbisMenos50}%; background:#60a5fa; height:100%; box-shadow:0 0 5px #60a5fa;"></div>
                            </div>
                            <span>${pctUbisMenos50}%</span>
                        </div>
                    </div>
                </div>

                <div class="glass-panel" style="margin-bottom:20px; padding:20px; position:relative; min-height:300px; border:1px solid rgba(236,72,153,0.2); box-shadow:inset 0 0 20px rgba(236,72,153,0.05);">
