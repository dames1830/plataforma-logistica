import { 
    dataStore, 
    fetchBufferConfig, 
    calculateBufferPallets, 
    saveBufferReport, 
    fetchBufferHistory, 
    getUploadMeta, 
    clearAreaData,
    parseFile,
    parseBufferFiles
} from '../services/csvHub_v6.js?v=12.4.36';
import * as adminService from '../services/adminService.js?v=12.4.60';

let activeBufferSub = 'reportes';
let lastBufferKPI = null;
let lastBufferResult = null;
let bufferConfigCached = null;

export const getActiveBufferSub = () => activeBufferSub;

export const renderBufferTab = async (contentArea, user, TABS, renderTabContent) => {
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    const stored = localStorage.getItem('lastBufferKPI');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.waterfall) { // Basic validation
                lastBufferKPI = parsed;
            }
        } catch(e) { localStorage.removeItem('lastBufferKPI'); }
    }

    const bufferTabDef = TABS.find(t => t.id === 'buffer');
    const perms = adminService.getPermissions(user.role) || {};
    
    const allowedSubTabs = bufferTabDef.subTabs.filter(sub => {
        if (user.role === 'admin') return true;
        return perms[`buffer_${sub.id}`] === 1;
    });

    if (!allowedSubTabs.find(s => s.id === activeBufferSub)) {
        activeBufferSub = allowedSubTabs[0]?.id || '';
    }

    if (!activeBufferSub) {
        contentArea.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No tienes permisos para acceder a la Zona Buffer.</div>`;
        return;
    }

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeBufferSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; cursor:pointer;">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="bufContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeBufferSub = e.currentTarget.dataset.s; 
        renderBufferTab(contentArea, user, TABS, renderTabContent); 
    }));

    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; buf.appendChild(wrap);
        renderBufferUploadArea(wrap, 'buffer_activo', dataStore.buffer_activo, '.csv', 'STOCK ACTIVO', renderTabContent);
        renderBufferUploadArea(wrap, 'buffer_reserva', dataStore.buffer_reserva, '.xlsx', 'STOCK RESERVA', renderTabContent);
        renderBufferUploadArea(wrap, 'buffer', dataStore.buffer, '.csv', 'PEDIDOS', renderTabContent);
        renderBufferUploadArea(wrap, 'solicitud', dataStore.solicitud, '.xlsx', 'OTRAS SOLICITUDES', renderTabContent);
        renderBufferUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx', 'MAESTRO', renderTabContent);
        renderBufferUploadArea(wrap, 'tallas', dataStore.tallas, '.xlsx', 'REPLENISHMENT', renderTabContent);
    } else if (activeBufferSub === 'historial_buffer') {
        renderBufferHistory(buf);
    } else if (activeBufferSub === 'kpi_buffer') {
        renderBufferKPI(buf);
    } else {
        buf.innerHTML = `
          <div style="background:rgba(30, 41, 59, 0.3); padding:1rem 1.5rem; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; background:rgba(255,255,255,0.03); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
              <div>
                <h4 style="color:var(--text-muted); font-weight:600; font-size:0.75rem; margin:0 0 0.5rem 0;">ESTADO DE ARCHIVOS MAESTROS:</h4>
                <div style="display:flex; gap:1rem; font-size:0.7rem; align-items:center; flex-wrap:wrap;">
                    <span>${dataStore.buffer_activo ? '✅' : '❌'} ACTIVO</span>
                    <span>${dataStore.buffer_reserva ? '✅' : '❌'} RESERVA</span>
                    <span>${dataStore.articulos ? '✅' : '❌'} MAESTRO</span>
                    <div style="display:flex; align-items:center;">
                        <button id="btn_reset_cache" title="Limpiar Memoria" style="background:none; border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); font-size:0.65rem; padding:0.2rem 0.5rem; cursor:pointer; margin-left:1rem; border-radius:4px;">🧹 REINICIAR MEMORIA</button>
                        <button id="btn_calc" class="btn" style="background:var(--primary); width:auto; padding:0.35rem 1rem; border-radius:6px; font-size:0.75rem; margin-left:1rem; font-weight:700;">⚡ PROCESAR ANÁLISIS</button>
                    </div>
                </div>
              </div>
              <div style="text-align:right;">
                <div id="export_actions" style="display:flex; gap:0.5rem; justify-content:flex-end;"></div>
              </div>
            </div>
            <div id="resultsArea" style="display:flex; gap:0.6rem; align-items:start;"></div>
          </div>`;
        
        const results = document.getElementById('resultsArea');
        const btnCalc = document.getElementById('btn_calc');
        const btnReset = document.getElementById('btn_reset_cache');

        if (btnCalc) {
            btnCalc.onclick = async () => {
                btnCalc.disabled = true; btnCalc.innerHTML = '⚙️ CALCULANDO...';
                results.innerHTML = `
                <div style="grid-column: span 2; padding:5rem 2rem; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); border-radius:16px; border:1px solid rgba(255,255,255,0.05); min-height:300px; box-shadow: inset 0 0 50px rgba(0,0,0,0.5);">
                    <h3 style="font-size:1.4rem; margin:0 0 2.5rem 0; color:#fff; font-weight:800; letter-spacing:2px; text-shadow: 0 0 10px rgba(56,189,248,0.5);">PROCESANDO ANÁLISIS BUFFER</h3>
                    <div style="width: 100%; max-width: 600px; height: 34px; background: #0b1120; border-radius: 20px; box-shadow: inset 0 5px 15px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.5); padding: 4px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 4px; left: 4px; height: 26px; border-radius: 14px; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%); box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.3), 0 0 25px rgba(56,189,248,0.7); animation: thick-progress 1.5s infinite ease-in-out;">
                            <div style="position: absolute; top:0; left:0; width:100%; height:100%; border-radius:14px; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px); opacity:0.5;"></div>
                        </div>
                    </div>
                    <p style="margin-top:2.5rem; font-size:0.9rem; color:#94a3b8; font-weight:600; letter-spacing:1px; text-transform:uppercase; animation: pulse-text 1.5s infinite;">Sincronizando maestros y cruzando datos...</p>
                    <style>
                        @keyframes thick-progress { 0% { left: -40%; width: 40%; } 50% { left: 100%; width: 40%; } 100% { left: -40%; width: 40%; } }
                        @keyframes pulse-text { 0% { opacity:0.5; } 50% { opacity:1; } 100% { opacity:0.5; } }
                    </style>
                </div>`;

                setTimeout(async () => {
                    try {
                        const config = await fetchBufferConfig().catch(() => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' }));
                        const res = calculateBufferPallets(config);
                        if (res) {
                            lastBufferKPI = res;
                            lastBufferResult = res;
                            localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                            renderBufferResults(results, res); 
                            
                            setTimeout(async () => {
                                if (confirm("¿Deseas guardar este análisis desglosado por FUENTE en el Historial?")) {
                                    const sources = ['PEDIDOS', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
                                    let successCount = 0;
                                    for (const s of sources) {
                                        const sourceRows = res.resumenNiveles.filter(n => n.fuente === s);
                                        if (sourceRows.length > 0) {
                                            const saved = await saveBufferReport({ resumenNiveles: sourceRows, sourceName: s }, user.username);
                                            if (saved) successCount++;
                                        }
                                    }
                                    if (successCount > 0) alert(`✅ Se guardaron ${successCount} reportes en el historial.`);
                                }
                            }, 300);
                        } else {
                            alert('⚠️ ERROR: Faltan archivos maestros.');
                        }
                    } catch (err) {
                        alert("Error crítico: " + err.message);
                    } finally {
                        btnCalc.disabled = false; btnCalc.innerHTML = '⚡ PROCESAR ANÁLISIS';
                    }
                }, 500);
            };
        }

        if (btnReset) {
            btnReset.onclick = () => {
                if(confirm('¿REINICIAR TODA LA MEMORIA?')) {
                    Object.keys(localStorage).forEach(k => { if(k.startsWith('logistics_')) localStorage.removeItem(k); });
                    localStorage.removeItem('lastBufferKPI');
                    window.location.reload();
                }
            };
        }

        if (lastBufferKPI) {
            renderBufferResults(results, lastBufferKPI);
        }
    }
};

const renderBufferUploadArea = (container, area, hasData, ext, label, renderTabContent) => {
    const meta = getUploadMeta(area);
    const dateStr = meta ? new Date(meta.ts).toLocaleString() : 'NUNCA';
    const div = document.createElement('div');
    div.style.width = '100%';
    const isLoaded = hasData && hasData.length > 0;
    
    div.innerHTML = `
      <div style="background:rgba(15, 23, 42, 0.4); border:1px solid ${isLoaded ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border-radius:10px; padding:0.6rem 1.2rem; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s; border-left:4px solid ${isLoaded ? '#22c55e' : '#64748b'};">
          <div style="display:flex; align-items:center; gap:1.2rem;">
              <div style="width:36px; height:36px; background:${isLoaded ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:${isLoaded ? '#22c55e' : 'var(--text-muted)'};">
                  ${ext === '.csv' ? '📄' : '📊'}
              </div>
              <div style="display:flex; flex-direction:column;">
                  <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">${label}</span>
                  <div style="display:flex; align-items:center; gap:10px;">
                      <span style="color:${isLoaded ? '#fff' : 'var(--text-muted)'}; font-weight:700; font-size:0.85rem;">${isLoaded ? 'LISTO' : 'VACÍO'}</span>
                      ${isLoaded ? `<span style="color:var(--text-muted); font-size:0.75rem;">${hasData.length.toLocaleString()} regs</span>` : ''}
                      ${isLoaded ? `<span style="color:var(--text-muted); font-size:0.65rem; opacity:0.6;">(Actualizado: ${dateStr})</span>` : ''}
                  </div>
              </div>
          </div>
          <div style="display:flex; gap:0.4rem;">
              <label style="background:var(--primary); color:#fff; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                  <input type="file" id="up_${area}" accept="${ext}" style="display:none;" ${area === 'buffer' ? 'multiple' : ''}>
                  ${isLoaded ? '🔄' : '📤'}
              </label>
              ${isLoaded ? `<button id="del_${area}" style="background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid #ef4444; width:32px; height:32px; border-radius:6px; cursor:pointer;">🗑️</button>` : ''}
          </div>
      </div>`;
    
    container.appendChild(div);

    const fileInput = document.getElementById(`up_${area}`);
    fileInput?.addEventListener('change', async (e) => {
        if(e.target.files.length > 0) {
            try {
                if (area === 'buffer') await parseBufferFiles(e.target.files);
                else await parseFile(e.target.files[0], area);
                renderTabContent(true); 
            } catch(err) { alert('Error: ' + err); }
        }
    });

    document.getElementById(`del_${area}`)?.addEventListener('click', async () => {
        if(confirm(`¿Borrar datos de ${label}?`)) {
            await clearAreaData(area);
            renderTabContent(true);
        }
    });
};

const renderBufferResults = (container, data) => {
    lastBufferResult = data;
    const ts = data.timestamp || new Date().toLocaleString();
    const tsHtml = `<span style="font-size:0.7rem; opacity:0.4; margin-left:8px;">(${ts})</span>`;

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.6rem; width:580px;">
            <div style="background:rgba(15,23,42,0.9); border:2px solid #4f46e5; border-radius:12px; overflow:hidden;">
                <div style="padding:0.7rem; background:rgba(79,70,229,0.1); text-align:center;"><h3 style="color:#fff; font-weight:800; margin:0; font-size:0.85rem;">ANÁLISIS BUFFER ZONAS ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.82rem; color:#eee;">
                    <thead><tr style="color:var(--text-muted); border-bottom:1px solid rgba(79,70,229,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">NIVEL/AREA</th><th style="padding:0.6rem 1rem; text-align:center;">RQ</th><th style="padding:0.6rem 1rem; text-align:center;">ATD</th><th style="padding:0.6rem 1rem; text-align:center;">ATD %</th></tr></thead>
                    <tbody>${data.waterfall.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.nivel==='Total'?'background:rgba(79,70,229,0.08); font-weight:900;':''}">
                        <td style="padding:0.5rem 1rem;">${r.nivel}</td>
                        <td style="padding:0.5rem 1rem; text-align:center;">${r.rq.toLocaleString()}</td>
                        <td style="padding:0.5rem 1rem; text-align:center;">${r.atd.toLocaleString()}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e;">${r.pct}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
            <div style="background:rgba(15,23,42,0.9); border:2px solid #f59e0b; border-radius:12px; overflow:hidden;">
                <div style="padding:0.7rem; background:rgba(245,158,11,0.1); text-align:center;"><h3 style="color:#f59e0b; font-weight:800; margin:0; font-size:0.85rem;">ANÁLISIS BUFFER SKU ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.82rem; color:#eee;">
                    <thead><tr style="color:var(--text-muted); border-bottom:1px solid rgba(245,158,11,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">FUENTE</th><th style="padding:0.6rem 1rem; text-align:center;">PALETAS</th><th style="padding:0.6rem 1rem; text-align:center;">SKU</th></tr></thead>
                    <tbody>${data.resumenSKU.map(r => `<tr><td style="padding:0.5rem 1rem; color:var(--primary); font-weight:700;">${r.fuente}</td><td style="padding:0.5rem 1rem; text-align:center;">${r.paletas}</td><td style="padding:0.5rem 1rem; text-align:center;">${r.skus}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.6rem; width:1200px;">
            ${createMatrixHTML(data.resumenMatrix, 'DISCREPANCIA BUFFER | ZONAS 3, 4, 5, 6', ts)}
            ${createMatrixHTML(data.resumenMatrixSinStock, 'ANÁLISIS BUFFER | SIN STOCK (ZONA 7)', ts)}
        </div>
    `;

    const exportArea = document.getElementById('export_actions');
    if (exportArea) {
        exportArea.innerHTML = `
            <button id="btn_exp_zonas" class="btn" style="width:auto; background:#4f46e5; padding:0.4rem 1rem; border-radius:6px; font-size:0.75rem;">📊 EXPORTAR ZONAS</button>
            <button id="btn_exp_buffer" class="btn" style="width:auto; background:var(--success); padding:0.4rem 1rem; border-radius:6px; font-size:0.75rem;">📥 EXCEL DETALLE</button>
        `;
        document.getElementById('btn_exp_zonas').onclick = () => downloadExcelZonas();
        document.getElementById('btn_exp_buffer').onclick = () => downloadExcelDetail();
    }
};

const createMatrixHTML = (matrix, title, timestamp = '') => {
    if (!matrix || !matrix.rows || !matrix.rows.length) return '';
    return `
        <div style="background:rgba(15,23,42,0.9); border:2px solid #06b6d4; border-radius:12px; overflow:hidden; margin-bottom:0.6rem;">
            <div style="padding:0.7rem; background:rgba(6,182,212,0.1); text-align:center;"><h3 style="color:#06b6d4; font-weight:800; margin:0; font-size:0.85rem;">${title} <span style="font-size:0.7rem; opacity:0.4;">(${timestamp})</span></h3></div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#eee;">
                    <thead><tr style="color:var(--text-muted); border-bottom:1px solid rgba(6,182,212,0.2);"><th style="padding:0.6rem 0.8rem; text-align:left;">MARCA</th>${matrix.columns.map(c => `<th style="padding:0.6rem 0.3rem; text-align:center;">${c}</th>`).join('')}<th style="padding:0.6rem 0.8rem; text-align:center;">TOTAL</th></tr></thead>
                    <tbody>${matrix.rows.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.marca==='TOTAL'?'background:rgba(6,182,212,0.15); font-weight:900;':''}">
                        <td style="padding:0.4rem 0.8rem;">${r.marca}</td>
                        ${matrix.columns.map(c => `<td style="padding:0.4rem 0.3rem; text-align:center;">${(r.breakdown[c] || 0).toLocaleString()}</td>`).join('')}
                        <td style="padding:0.4rem 0.8rem; text-align:center; color:#22c55e;">${r.total.toLocaleString()}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>`;
};

const renderBufferHistory = async (container) => {
    container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div><p>Sincronizando Historial...</p></div>`;
    const history = await fetchBufferHistory();
    if (!history || history.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:var(--text-muted);">No se encontraron reportes previos.</p></div>`;
        return;
    }

    const sorted = [...history].sort((a,b) => new Date(b.created_at || b.ts) - new Date(a.created_at || a.ts));
    container.innerHTML = `
        <div class="animate-fade-in" style="padding:0.5rem;">
            <h3 style="color:var(--primary); margin-bottom:1rem;">Reporte de Buffer día</h3>
            <div class="glass-panel" style="padding:0; overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem; color:white;">
                    <thead><tr style="background:#facc15; color:#000;"><th style="padding:0.8rem;">FECHA</th><th style="padding:0.8rem;">FUENTE</th><th style="padding:0.8rem;">NIVEL/AREA</th><th style="padding:0.8rem;">PAL</th><th style="padding:0.8rem;">SKU</th></tr></thead>
                    <tbody>${sorted.flatMap((report) => {
                        const dObj = new Date(report.created_at || report.ts);
                        const levels = report.data?.resumenNiveles || [];
                        return levels.map(n => `<tr><td style="padding:0.5rem; text-align:center;">${dObj.toLocaleDateString()}</td><td style="padding:0.5rem;">${report.sourceName || n.fuente || '---'}</td><td style="padding:0.5rem;">${n.nivel}</td><td style="padding:0.5rem; text-align:center;">${n.pal}</td><td style="padding:0.5rem; text-align:center;">${n.sku}</td></tr>`);
                    }).join('')}</tbody>
                </table>
            </div>
        </div>`;
};

const renderBufferKPI = async (container) => {
    container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div><p>Generando KPIs...</p></div>`;
    const history = await fetchBufferHistory();
    if (!history || history.length < 2) {
        container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;">Se requieren al menos 2 reportes para generar gráficos de tendencia.</div>`;
        return;
    }

    const sorted = [...history].sort((a,b) => new Date(a.created_at || a.ts) - new Date(b.created_at || b.ts));
    const labels = sorted.map(item => new Date(item.created_at || item.ts).toLocaleDateString());
    
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <div class="glass-panel animate-fade-in" style="padding:1.5rem;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem;">TENDENCIA DE REPOSICIÓN (PAL)</h4>
                <canvas id="bufferTrendChart" style="max-height:250px;"></canvas>
            </div>
            <div class="glass-panel animate-fade-in" style="padding:1.5rem;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem;">SKUS POR FUENTE</h4>
                <canvas id="bufferVolumeChart" style="max-height:250px;"></canvas>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctxTrend = document.getElementById('bufferTrendChart')?.getContext('2d');
        if (ctxTrend && window.Chart) {
            new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Paletas Totales',
                        data: sorted.map(item => (item.data?.resumenNiveles || []).reduce((s,n)=>s+n.pal,0)),
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }
    }, 100);
};

const downloadExcelZonas = () => {
    if (!lastBufferResult) return;
    const dataRows = [["NIVEL/AREA", "UBICACION", "ARTÍCULO", "SKU", "ATD RQ"]];
    lastBufferResult.detalleZonas.forEach(row => {
        dataRows.push([row['NIVEL/AREA'], row['UBICACION'], row['ARTÍCULO'], row['SKU'], row['ATD RQ']]);
    });
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zonas");
    XLSX.writeFile(wb, `Reporte_Zonas_${new Date().getTime()}.xlsx`);
};

const downloadExcelDetail = () => {
    if (!lastBufferResult) return;
    const detail = lastBufferResult.resumenSKUDetalle || [];
    const ws = XLSX.utils.json_to_sheet(detail);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle SKU");
    XLSX.writeFile(wb, `Reporte_Detalle_SKU_${new Date().getTime()}.xlsx`);
};
