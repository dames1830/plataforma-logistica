import { 
    dataStore, 
    fetchBufferConfig, 
    calculateBufferPallets, 
    saveBufferReport, 
    fetchBufferHistory, 
    getUploadMeta, 
    clearAreaData,
    parseFile,
    parseBufferFiles,
    getAreaData
} from '../services/csvHub_v6.js?v=12.4.36';
import * as adminService from '../services/adminService.js?v=12.4.60';

let activeBufferSub = 'reportes';
let lastBufferKPI = null;
let lastBufferResult = null;
let bufferConfigCached = null;

export const getActiveBufferSub = () => activeBufferSub;

export const renderBufferTab = async (contentArea, user, TABS, renderTabContent) => {
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    const stored = localStorage.getItem('logistics_v24_prod_lastBufferKPI') || localStorage.getItem('lastBufferKPI');
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
        renderBufferUploadArea(wrap, 'validar_reserva', dataStore.validar_reserva, '.xlsx', 'VALIDAR RESERVA', renderTabContent);
        renderBufferUploadArea(wrap, 'validar_activo', dataStore.validar_activo, '.csv', 'VALIDAR ACTIVO', renderTabContent);
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
                <div style="width: 100%; padding:5rem 2rem; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); border-radius:16px; border:1px solid rgba(255,255,255,0.05); min-height:300px; box-shadow: inset 0 0 50px rgba(0,0,0,0.5);">
                    <h3 style="font-size:1.4rem; margin:0 0 2.5rem 0; color:#fff; font-weight:800; letter-spacing:2px; text-shadow: 0 0 10px rgba(56,189,248,0.5);">PROCESANDO ANÁLISIS BUFFER</h3>
                    <div style="width: 80%; max-width: 900px; height: 34px; background: #0b1120; border-radius: 20px; box-shadow: inset 0 5px 15px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.5); padding: 4px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 4px; left: 4px; height: 26px; border-radius: 14px; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%); box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.3), 0 0 25px rgba(56,189,248,0.7); animation: thick-progress 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;">
                            <div style="position: absolute; top:0; left:0; width:100%; height:100%; border-radius:14px; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px); opacity:0.5;"></div>
                        </div>
                    </div>
                    <p style="margin-top:2.5rem; font-size:0.9rem; color:#94a3b8; font-weight:600; letter-spacing:1px; text-transform:uppercase; animation: pulse-text 1.5s infinite;">Sincronizando maestros y cruzando datos...</p>
                    <style>
                        @keyframes thick-progress { 0% { width: 0%; left: 4px; } 100% { width: calc(100% - 8px); left: 4px; } }
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
                            localStorage.setItem('logistics_v24_prod_lastBufferKPI', JSON.stringify(res)); localStorage.setItem('lastBufferKPI', JSON.stringify(res));
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
    container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div><p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">Sincronizando datos de validación...</p></div>`;
    
    const [validarActivo, validarReserva, originalReserva] = await Promise.all([
        getAreaData('validar_activo'),
        getAreaData('validar_reserva'),
        getAreaData('buffer_reserva')
    ]);

    const hasActivo = validarActivo && validarActivo.length > 0;
    const hasReserva = validarReserva && validarReserva.length > 0;

    if (!hasActivo && !hasReserva) {
        alert("⚠️ ATENCIÓN: Debes cargar al menos uno de los archivos actualizados (VALIDAR RESERVA o VALIDAR ACTIVO) en la pestaña Maestros para poder realizar la conciliación.");
        container.innerHTML = `
            <div class="glass-panel" style="padding:2.5rem; text-align:center; max-width:650px; margin:2rem auto; border-radius:16px; border:1px dashed rgba(255,255,255,0.15);">
                <div style="font-size:2.5rem; margin-bottom:1rem;">📋</div>
                <h3 style="color:#fff; font-weight:800; margin-bottom:0.8rem; font-size:1.1rem;">CONCILIACIÓN PENDIENTE</h3>
                <p style="color:var(--text-muted); font-size:0.85rem; line-height:1.6; margin-bottom:1.5rem;">
                    Para auditar y validar el trabajo de los operarios, primero debes subir al menos uno de los archivos actualizados del WMS posterior a la bajada en la pestaña <b>🗂️ ARCHIVO ZONA BUFFER</b>:
                </p>
                <div style="display:flex; justify-content:center; gap:1.5rem; font-size:0.8rem; font-weight:700; color:var(--primary); background:rgba(255,255,255,0.02); padding:1rem; border-radius:8px;">
                    <span style="color:#ef4444">❌ VALIDAR RESERVA (.xlsx)</span>
                    <span style="color:#ef4444">❌ VALIDAR ACTIVO (.csv)</span>
                </div>
            </div>`;
        return;
    }

    const stored = localStorage.getItem('logistics_v24_prod_lastBufferKPI') || localStorage.getItem('lastBufferKPI');
    let plan = null;
    if (stored) {
        try { plan = JSON.parse(stored); } catch(e){}
    }

    // Si no hay plan, o el plan no tiene pallets, usaremos el modo de comparación directa
    const plannedPallets = plan && plan.detallePallets ? plan.detallePallets.filter(p => p.ES_ALTO === undefined || p.ES_ALTO || String(p.NIVEL || '').toUpperCase().includes('ALTO') || String(p.NIVEL || '').toUpperCase() === 'A') : [];

    const isPlannedMode = plannedPallets.length > 0;

    // 1. Mapeo de Reserva Final
    const finalReservaLPNs = {};
    const finalReservaSkuUbi = {};
    if (hasReserva) {
        validarReserva.forEach(r => {
            if (r.ES_ALTO === false) return;
            const lpn = String(r.LPN || '').trim().toUpperCase();
            const sku = String(r.PRODUCTO || '').trim();
            const ubi = String(r.UBICACION || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const qty = parseFloat(r.CANTIDAD) || 0;
            if (lpn) finalReservaLPNs[lpn] = (finalReservaLPNs[lpn] || 0) + qty;
            const key = `${sku}|${ubi}`;
            finalReservaSkuUbi[key] = (finalReservaSkuUbi[key] || 0) + qty;
        });
    }

    // 2. Mapeo de Activo Final
    const finalActivoSkuTotal = {};
    if (hasActivo) {
        const activeWhitelist = ['MZN01', 'MZN04', 'CDBUFFER', 'MZN03', 'MZN02', 'SEL', 'AND', 'PARED'];
        validarActivo.forEach(r => {
            const raw = Array.isArray(r) ? r : Object.values(r);
            const area = String(raw[0] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (area === 'MATE') return;
            const isLevel1 = activeWhitelist.some(w => area.includes(w));
            if (!isLevel1) return;

            const sku = String(raw[1] || '').trim();
            const qty = parseFloat(raw[4]) || 0;
            finalActivoSkuTotal[sku] = (finalActivoSkuTotal[sku] || 0) + qty;
        });
    }

    const results = [];
    let completedCount = 0;
    let partialCount = 0;
    let pendingCount = 0;

    if (isPlannedMode) {
        // --- MODO PLANIFICADO ---
        plannedPallets.forEach(p => {
            const sku = p.SKU;
            const lpn = String(p.LPN || '').trim().toUpperCase();
            const ubiRes = String(p.UBICACIONES || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const plannedQty = p['QTY BUFFER'] || 0;
            const origResQty = p['QTY RESERVA'] || 0;
            const origActQty = p['QTY ACTIVO'] || 0;

            // Comprobación Reserva (Origen)
            let finalResQty = 0;
            let unitsLowered = 0;
            let resState = "S/D";
            let resStatusClass = "color:var(--text-muted);";

            if (hasReserva) {
                if (lpn && finalReservaLPNs[lpn] !== undefined) {
                    finalResQty = finalReservaLPNs[lpn];
                } else {
                    const key = `${sku}|${ubiRes}`;
                    finalResQty = finalReservaSkuUbi[key] || 0;
                }

                unitsLowered = Math.max(0, origResQty - finalResQty);
                resState = "BAJADO (100%)";
                resStatusClass = "color:#22c55e;";
                if (finalResQty >= origResQty) {
                    resState = "NO BAJADO (0%)";
                    resStatusClass = "color:#ef4444;";
                } else if (finalResQty > 0) {
                    resState = `PARCIAL (Quedan ${finalResQty})`;
                    resStatusClass = "color:#fbbf24;";
                }
            }

            // Comprobación Activo (Destino)
            let actFinalQty = 0;
            let actDiff = 0;
            let actState = "S/D";
            let actStatusClass = "color:var(--text-muted);";

            if (hasActivo) {
                actFinalQty = finalActivoSkuTotal[sku] || 0;
                actDiff = actFinalQty - origActQty;
                
                actState = "SIN REGISTRO";
                actStatusClass = "color:#ef4444;";
                if (actDiff >= plannedQty) {
                    actState = "RECIBIDO (100%)";
                    actStatusClass = "color:#22c55e;";
                } else if (actDiff > 0) {
                    actState = `PARCIAL (+${actDiff})`;
                    actStatusClass = "color:#fbbf24;";
                }
            }

            // Estado General
            let generalState = "PENDIENTE";
            let colorDot = "#ef4444";
            let statusTag = "🔴 PENDIENTE";

            if (hasReserva && hasActivo) {
                if (unitsLowered >= plannedQty && actDiff >= plannedQty) {
                    generalState = "COMPLETADO";
                    statusTag = "🟢 COMPLETADO";
                    completedCount++;
                } else if (unitsLowered > 0 || actDiff > 0) {
                    generalState = "INCOMPLETO";
                    statusTag = "🟡 INCOMPLETO";
                    partialCount++;
                } else {
                    pendingCount++;
                }
            } else if (hasReserva) {
                if (unitsLowered >= plannedQty) {
                    generalState = "COMPLETADO";
                    statusTag = "🟢 COMPLETADO";
                    completedCount++;
                } else if (unitsLowered > 0) {
                    generalState = "INCOMPLETO";
                    statusTag = "🟡 INCOMPLETO";
                    partialCount++;
                } else {
                    pendingCount++;
                }
            } else if (hasActivo) {
                if (actDiff >= plannedQty) {
                    generalState = "COMPLETADO";
                    statusTag = "🟢 COMPLETADO";
                    completedCount++;
                } else if (actDiff > 0) {
                    generalState = "INCOMPLETO";
                    statusTag = "🟡 INCOMPLETO";
                    partialCount++;
                } else {
                    pendingCount++;
                }
            }

            results.push({
                lpn,
                sku,
                ubiRes,
                plannedQty,
                origResQty,
                finalResQty,
                origActQty,
                actFinalQty,
                resState,
                resStatusClass,
                actState,
                actStatusClass,
                statusTag,
                generalState,
                colorDot
            });
        });
    } else {
        // --- MODO COMPARACIÓN DIRECTA (STOCK INICIAL VS STOCK FINAL) ---
        const initialRes = originalReserva || [];
        initialRes.forEach(item => {
            const isAlto = item.ES_ALTO || String(item.NIVEL || '').toUpperCase().includes('ALTO') || String(item.NIVEL || '').toUpperCase() === 'A';
            if (!isAlto) return;

            const sku = item.PRODUCTO;
            const lpn = String(item.LPN || '').trim().toUpperCase();
            const ubiRes = String(item.UBICACION || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const origResQty = parseFloat(item.CANTIDAD) || 0;

            let finalResQty = 0;
            if (hasReserva) {
                if (lpn && finalReservaLPNs[lpn] !== undefined) {
                    finalResQty = finalReservaLPNs[lpn];
                } else {
                    const key = `${sku}|${ubiRes}`;
                    finalResQty = finalReservaSkuUbi[key] || 0;
                }
            }

            const unitsLowered = Math.max(0, origResQty - finalResQty);
            if (unitsLowered === 0 && hasReserva) {
                // Si no bajó nada y hay archivo de validación, está pendiente
                pendingCount++;
                results.push({
                    lpn,
                    sku,
                    ubiRes,
                    plannedQty: 0,
                    origResQty,
                    finalResQty,
                    origActQty: 0,
                    actFinalQty: 0,
                    resState: "NO BAJADO (0%)",
                    resStatusClass: "color:#ef4444;",
                    actState: "S/D",
                    actStatusClass: "color:var(--text-muted);",
                    statusTag: "🔴 PENDIENTE",
                    generalState: "PENDIENTE",
                    colorDot: "#ef4444"
                });
            } else if (unitsLowered >= origResQty) {
                completedCount++;
                results.push({
                    lpn,
                    sku,
                    ubiRes,
                    plannedQty: origResQty,
                    origResQty,
                    finalResQty,
                    origActQty: 0,
                    actFinalQty: 0,
                    resState: "BAJADO (100%)",
                    resStatusClass: "color:#22c55e;",
                    actState: "S/D",
                    actStatusClass: "color:var(--text-muted);",
                    statusTag: "🟢 COMPLETADO",
                    generalState: "COMPLETADO",
                    colorDot: "#22c55e"
                });
            } else {
                partialCount++;
                results.push({
                    lpn,
                    sku,
                    ubiRes,
                    plannedQty: origResQty,
                    origResQty,
                    finalResQty,
                    origActQty: 0,
                    actFinalQty: 0,
                    resState: `PARCIAL (Quedan ${finalResQty})`,
                    resStatusClass: "color:#fbbf24;",
                    actState: "S/D",
                    actStatusClass: "color:var(--text-muted);",
                    statusTag: "🟡 INCOMPLETO",
                    generalState: "INCOMPLETO",
                    colorDot: "#fbbf24"
                });
            }
        });
    }

    const totalTasks = results.length;
    const efficiency = totalTasks > 0 ? ((completedCount / totalTasks) * 100).toFixed(1) : 0;

    container.innerHTML = `
        <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:1.2rem; width:100%;">
            <!-- TARJETAS KPI -->
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:1rem;">
                <div class="glass-panel" style="padding:1rem; border-left:4px solid #6366f1; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">EFICIENCIA DE CONCILIACIÓN</div>
                    <div style="font-size:1.8rem; color:#fff; font-weight:900; margin-top:5px;">\${efficiency}%</div>
                </div>
                <div class="glass-panel" style="padding:1rem; border-left:4px solid #22c55e; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TAREAS COMPLETADAS</div>
                    <div style="font-size:1.8rem; color:#22c55e; font-weight:900; margin-top:5px;">\${completedCount}</div>
                </div>
                <div class="glass-panel" style="padding:1rem; border-left:4px solid #fbbf24; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TAREAS INCOMPLETAS</div>
                    <div style="font-size:1.8rem; color:#fbbf24; font-weight:900; margin-top:5px;">\${partialCount}</div>
                </div>
                <div class="glass-panel" style="padding:1rem; border-left:4px solid #ef4444; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TAREAS PENDIENTES</div>
                    <div style="font-size:1.8rem; color:#ef4444; font-weight:900; margin-top:5px;">\${pendingCount}</div>
                </div>
            </div>

            <!-- CONTROLES FILTRADO -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:0.6rem 1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; gap:0.5rem;" id="filter_buttons_val">
                    <button class="btn active" data-f="TODOS" style="padding:0.35rem 0.8rem; font-size:0.75rem; border-radius:6px; font-weight:700; width:auto; background:var(--primary);">MOSTRAR TODO (\${totalTasks})</button>
                    <button class="btn" data-f="PENDIENTE" style="padding:0.35rem 0.8rem; font-size:0.75rem; border-radius:6px; font-weight:700; width:auto; background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444;">🔴 PENDIENTES (\${pendingCount})</button>
                    <button class="btn" data-f="INCOMPLETO" style="padding:0.35rem 0.8rem; font-size:0.75rem; border-radius:6px; font-weight:700; width:auto; background:rgba(245,158,11,0.15); border:1px solid #f59e0b; color:#f59e0b;">🟡 INCOMPLETOS (\${partialCount})</button>
                    <button class="btn" data-f="COMPLETADO" style="padding:0.35rem 0.8rem; font-size:0.75rem; border-radius:6px; font-weight:700; width:auto; background:rgba(34,197,94,0.15); border:1px solid #22c55e; color:#22c55e;">🟢 COMPLETADOS (\${completedCount})</button>
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); font-weight:700; background:rgba(255,255,255,0.03); padding:0.3rem 0.6rem; border-radius:4px;">
                        \${isPlannedMode ? '📋 AUDITORÍA PLAN' : '⚡ COMPARACIÓN DIRECTA STOCK'}
                    </div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:flex; gap:10px; margin-left:10px;">
                        <span>\${hasReserva ? '🟢 RES' : '⚪ RES'}</span>
                        <span>\${hasActivo ? '🟢 ACT' : '⚪ ACT'}</span>
                    </div>
                    <button id="btn_excel_val" class="btn" style="background:#22c55e; width:auto; padding:0.4rem 1rem; border-radius:6px; font-size:0.75rem; font-weight:700; margin-left:10px;">📥 EXPORTAR CONCILIACIÓN</button>
                </div>
            </div>

            <!-- TABLA DE DETALLE -->
            <div class="glass-panel" style="padding:0; overflow:hidden; border:1px solid var(--border);">
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem; color:#eee; text-align:left;">
                        <thead>
                            <tr style="background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.08); color:var(--text-muted);">
                                <th style="padding:0.8rem 1rem;">LPN</th>
                                <th style="padding:0.8rem 1rem;">SKU</th>
                                <th style="padding:0.8rem 1rem;">UBICACIÓN</th>
                                <th style="padding:0.8rem 1rem; text-align:center;">\${isPlannedMode ? 'CANT. BUFFER' : 'CANT. INICIAL'}</th>
                                <th style="padding:0.8rem 1rem;">ESTADO RESERVA</th>
                                <th style="padding:0.8rem 1rem;">\${isPlannedMode ? 'ESTADO DESTINO (ACT)' : 'DIFERENCIA (BAJADO)'}</th>
                                <th style="padding:0.8rem 1rem; text-align:center;">ESTADO GENERAL</th>
                            </tr>
                        </thead>
                        <tbody id="val_rows_tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const tbody = document.getElementById('val_rows_tbody');
    const renderRows = (filterValue) => {
        tbody.innerHTML = '';
        const filtered = results.filter(r => filterValue === 'TODOS' || r.generalState === filterValue);
        
        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted);">No se encontraron registros con este filtro.</td></tr>`;
            return;
        }

        filtered.forEach(r => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            
            // Si es modo directo, mostramos la diferencia numérica en lugar de estado del activo
            const diffDisplay = isPlannedMode ? r.actState : (r.origResQty - r.finalResQty);
            const plannedQtyDisplay = isPlannedMode ? r.plannedQty : r.origResQty;

            tr.innerHTML = `
                <td style="padding:0.6rem 1rem; font-weight:700;">\${r.lpn || 'S/L'}</td>
                <td style="padding:0.6rem 1rem;">\${r.sku}</td>
                <td style="padding:0.6rem 1rem;">\${r.ubiRes}</td>
                <td style="padding:0.6rem 1rem; text-align:center; font-weight:800;">\${plannedQtyDisplay}</td>
                <td style="padding:0.6rem 1rem; \${r.resStatusClass}; font-weight:700;">\${r.resState}</td>
                <td style="padding:0.6rem 1rem; \${isPlannedMode ? r.actStatusClass : ''}; font-weight:700;">\${diffDisplay}</td>
                <td style="padding:0.6rem 1rem; text-align:center; font-weight:800;">\${r.statusTag}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    renderRows('TODOS');

    document.querySelectorAll('#filter_buttons_val button').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#filter_buttons_val button').forEach(b => {
                b.className = 'btn';
                b.style.background = b.dataset.f === 'TODOS' ? '' : 'rgba(255,255,255,0.02)';
            });
            e.currentTarget.className = 'btn active';
            e.currentTarget.style.background = 'var(--primary)';
            renderRows(e.currentTarget.dataset.f);
        };
    });

    document.getElementById('btn_excel_val').onclick = () => {
        const dataRows = [
            ["LPN", "SKU", "ORIGEN (RESERVA)", "CANTIDAD INICIAL RESERVA", "CANTIDAD FINAL RESERVA", "CANTIDAD BAJADA", "ESTADO RESERVA", "ESTADO GENERAL"]
        ];
        results.forEach(r => {
            dataRows.push([
                r.lpn,
                r.sku,
                r.ubiRes,
                r.origResQty,
                r.finalResQty,
                r.origResQty - r.finalResQty,
                r.resState,
                r.generalState
            ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Conciliacion");
        XLSX.writeFile(wb, `Reporte_Conciliacion_Buffer_	ext{new Date().getTime()}.xlsx`);
    };
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
