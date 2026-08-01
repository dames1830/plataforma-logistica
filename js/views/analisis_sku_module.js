import { calculateBufferPallets, dataStore } from '../services/csvHub_v6.js?v=29.0004';

let lastBufferResult = null;
const CACHE_KEY = `logistics_v13_0_0_prod_`;

export const renderAnalisisSKUTab = async (contentArea, user, TABS, subNavHtml) => {
    let activeAnalisisSub = 'articulo_temp';
    
    const tabDef = TABS.find(t => t.id === 'analisis_sku');
    const perms = (window.adminService && window.adminService.getPermissions(user.role)) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`analisis_sku_${sub.id}`] === 1);

    if (!allowedSubTabs.find(s => s.id === activeAnalisisSub)) activeAnalisisSub = allowedSubTabs[0]?.id;

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAnalisisSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; cursor:pointer;">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="skuContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        const s = e.currentTarget.dataset.s; 
        renderAnalisisSKUTab(contentArea, user, TABS, subNavHtml); 
    }));

    const skuBuf = document.getElementById('skuContent');
    if (activeAnalisisSub === 'archivo_analisis') {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; skuBuf.appendChild(wrap);
        if (window.renderUploadArea) {
            window.renderUploadArea(wrap, 'analisis_sku_activo', dataStore.analisis_sku_activo, '.csv', 'STOCK ACTIVO');
            window.renderUploadArea(wrap, 'analisis_sku_reserva', dataStore.analisis_sku_reserva, '.xlsx', 'STOCK RESERVA');
        }
        return;
    }

    if (activeAnalisisSub !== 'articulo_temp') {
        skuBuf.innerHTML = `
            <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                <div style="font-size:3rem; margin-bottom:1rem; opacity:0.1;">🚧</div>
                <h4>Module in Development</h4>
                <p>This section will be available soon.</p>
            </div>`;
        return;
    }

    const runGlobalAnalysis = async () => {
      const btn = document.getElementById('btn_run_global') || document.getElementById('btn_refresh_global');
      const oldHtml = btn ? btn.innerHTML : '⚡ PROCESAR REPORTE ARTÍCULO';

      if (!dataStore.stockActivo || !dataStore.stockReserva) {
          alert('⚠️ ATENCIÓN: Primero debes cargar "STOCK ACTIVO" y "STOCK RESERVA" en el módulo correspondiente.');
          return;
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '⚙️ PROCESANDO...'; }
      
      setTimeout(async () => {
        try {
          const res = await calculateBufferPallets();
          if (res) {
                  lastBufferResult = {
                      reporteTemporadasQ: res.reporteTemporadasQ,
                      reporteGender: res.reporteGender,
                      reporteObsolencia: res.reporteObsolencia,
                      detalleObsGen: res.detalleObsGen || [],
                      detalleTemporadas: res.detalleTemporadas || [],
                      timestamp: res.timestamp || new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
                  };
              try {
                  localStorage.setItem(CACHE_KEY + 'lastBufferKPI', JSON.stringify(lastBufferResult));
              } catch(e) { console.warn("[PULSE] LocalStorage lleno.", e); }
              renderAnalisisSKUTab(contentArea, user, TABS, subNavHtml);
          } else {
              alert('⚠️ ERROR: El análisis no generó datos.');
              if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
          }
        } catch (err) {
          console.error(err);
          alert('❌ Error crítico: ' + err.message);
          if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
        }
      }, 100);
    };

    if (!lastBufferResult) {
        const stored = localStorage.getItem(CACHE_KEY + 'lastBufferKPI');
        if (stored) {
            try { lastBufferResult = JSON.parse(stored); } catch(e) {}
        }
    }

    if (!lastBufferResult) {
        skuBuf.innerHTML = `
            <div class="glass-panel animate-fade-in" style="padding:4rem 2rem; text-align:center; border: 1px dashed rgba(255,255,255,0.1);">
                <div style="margin-bottom:2rem;">
                    <img src="https://img.icons8.com/fluency/96/000000/search-property.png" style="opacity:0.6; filter:grayscale(0.5);"/>
                </div>
                <h3 style="color:#fff; font-weight:700; margin-bottom:1rem;">ARTICULO POR TEMPORADA</h3>
                <p style="color:var(--text-muted); max-width:500px; margin:0 auto 2.5rem;">
                    Presiona el botón para consolidar el Stock Activo y Reserva por Artículo y Temporada.
                </p>
                <button id="btn_run_global" class="btn" style="max-width:400px; padding:1.2rem; font-weight:800; font-size:1rem; letter-spacing:1px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);">
                    ⚡ PROCESAR REPORTE ARTÍCULO
                </button>
            </div>
        `;
        const btn = document.getElementById('btn_run_global');
        if (btn) btn.onclick = runGlobalAnalysis;
        return;
    }

    const data = lastBufferResult || {};
    const tQ = data.reporteTemporadasQ || [];
    const tG = data.reporteGender || [];
    const tO = data.reporteObsolencia || [];

    skuBuf.innerHTML = `
      <div class="animate-fade-in" style="width:100%; max-width:1450px; margin:0 auto;">
        <div style="display:flex; gap:1rem; margin-bottom:1.5rem; padding-left:0.5rem;">
            <button id="btn_refresh_global" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(79,70,229,0.05); border:1px solid var(--primary); font-weight:800; border-radius:8px; color:#fff; cursor:pointer;">
                🔄 RE-PROCESAR TODO
            </button>
            <button id="btn_export_analisis" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(16,185,129,0.05); border:1px solid #10b981; font-weight:800; border-radius:8px; color:#fff; cursor:pointer;">
                📥 EXPORTAR TEMPORADA
            </button>
            <button id="btn_export_obsgen" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(251,191,36,0.05); border:1px solid #fbbf24; font-weight:800; border-radius:8px; color:#fff; cursor:pointer;">
                📊 DETALLE OBS.GEN
            </button>
        </div>

        <div style="display:flex; gap:1.5rem; align-items: stretch;">
            <div style="flex:2.2; display:flex;">
                <div class="glass-panel" style="flex:1; padding:1.5rem; border:1px solid rgba(79,70,229,0.5); box-shadow:0 0 25px rgba(79,70,229,0.2); background:rgba(15,23,42,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.8rem;">
                        <h3 style="color:#fff; font-weight:900; margin:0; font-size:1.1rem; letter-spacing:1px; text-transform:uppercase;">ARTICULO POR TEMPORADA</h3>
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; background:rgba(0,0,0,0.3); padding:4px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.05);">
                            📅 ${data.timestamp || '00/00/0000, 00:00:00'}
                        </span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
                            <thead>
                                <tr style="color:var(--primary); font-weight:900; text-transform:uppercase; font-size:0.7rem; border-bottom:2px solid var(--border);">
                                    <th style="text-align:left; padding:1rem 0.5rem; width:130px;">AÑO/TEMPORADA</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q1</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q2</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q3</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q4</th>
                                    <th style="text-align:center; padding:1rem 0.5rem; background:rgba(79,70,229,0.05); color:#fff;">CANTIDAD</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tQ.map(row => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                        <td style="padding:0.7rem 0.5rem; font-weight:800; color:#fff;">${row.Año}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center;">${(row.Q1 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center;">${(row.Q2 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center;">${(row.Q3 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center;">${(row.Q4 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:900; color:var(--primary);">${(row.TOTAL || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:1.5rem;">
                <div class="glass-panel" style="flex:1; padding:1.2rem; background:rgba(15,23,42,0.4); border:1px solid rgba(16,185,129,0.5);">
                    <h4 style="color:#10b981; font-weight:900; margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase;">⏳ OBSOLESCENCIA</h4>
                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                        <tbody>
                            ${tO.map(row => `<tr><td style="padding:0.5rem; color:#fff;">${row.label}</td><td style="text-align:right; font-weight:800; color:#10b981;">${(row.qty || 0).toLocaleString()}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="glass-panel" style="flex:1; padding:1.2rem; background:rgba(15,23,42,0.4); border:1px solid rgba(251,191,36,0.5);">
                    <h4 style="color:#fbbf24; font-weight:900; margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase;">👥 G. GENDER</h4>
                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                        <tbody>
                            ${tG.map(row => `<tr><td style="padding:0.5rem; color:#fff;">${row.label}</td><td style="text-align:right; font-weight:800; color:#fbbf24;">${(row.qty || 0).toLocaleString()}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    `;

    if (document.getElementById('btn_refresh_global')) document.getElementById('btn_refresh_global').onclick = runGlobalAnalysis;
    
    if (document.getElementById('btn_export_analisis')) {
        document.getElementById('btn_export_analisis').onclick = () => {
            const detail = data.detalleTemporadas || [];
            if (!detail.length) return alert('No hay datos detallados.');
            const ws = XLSX.utils.json_to_sheet(detail);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Revision_Temporadas");
            XLSX.writeFile(wb, `Reporte_Temporadas_${Date.now()}.xlsx`);
        };
    }
};
