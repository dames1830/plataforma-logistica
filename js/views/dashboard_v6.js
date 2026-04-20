import { logout } from '../services/auth.js';
import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter } from '../services/csvHub_v6.js?v=10.5.3-pulse';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'stock', label: 'Stock General', icon: '🏦', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'inventario', label: 'Inventario (Ciclo)', icon: '📋', roles: ['admin', 'jefe', 'supervisor'] },
  { id: 'picking', label: 'Picking', icon: '🛒', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'packing', label: 'Packing', icon: '📦', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'despacho', label: 'Despacho', icon: '🚚', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'recepcion', label: 'Recepción', icon: '📥', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'almacenaje', label: 'Almacenaje', icon: '🏭', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'buffer', label: 'Zona Buffer', icon: '⏳', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'admin_pers', label: 'Administración', icon: '👥', roles: ['admin', 'jefe'] },
  { id: 'config', label: 'Configuración', icon: '⚙️', roles: ['admin'] }
];

const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
let currentChart = null;
let lastBufferKPI = null;
let bufferConfigCached = null;

const exportToExcel = (data, filename) => {
    if(!data || !data.length) {
        alert('⚠️ ERROR: Los datos para este reporte no están disponibles en la memoria actual. Por favor, haz clic en el botón "PROCESAR ANÁLISIS" nuevamente para regenerar el detalle completo.');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
};

export const renderDashboard = async (container, user, onLogout) => {
  pingServer();
  container.className = 'dashboard-layout animate-fade-in';
  
  let rolePermissions = {};
  if (user.role !== 'admin') {
    try {
      const res = await fetch(`${API_BASE}/permissions/${user.role}`);
      if (res.ok) rolePermissions = (await res.json()).modules || {};
    } catch (e) { console.error("Error permisos:", e); }
  }

  const allowedTabs = TABS.filter(t => user.role === 'admin' || t.id === 'inicio' || rolePermissions[t.id] === 1);
  let currentTab = allowedTabs[0]?.id;

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <h2 style="font-weight:700; color:#fff;">LOGÍSTICA <span style="color:var(--primary)">DAMES1830 v10.5.5 (Pulse)</span></h2>
      </div>
      <div class="user-profile">
        <div class="date-filter-container" style="background:rgba(255,255,255,0.05); padding:0.4rem 0.8rem; border-radius:10px; border:1px solid var(--border); display:flex; align-items:center;">
          <input type="date" id="globalDatePicker" style="background:transparent; border:none; color:var(--text-main); color-scheme:dark; outline:none; cursor:pointer;">
        </div>
        <div class="user-details" style="text-align:right;">
          <span class="user-name" style="color:#fff; font-weight:600;">${user.name}</span>
          <span class="user-role" style="color:var(--text-muted); font-size:0.75rem;">${user.role.toUpperCase()} MASTER</span>
        </div>
        <button id="logoutBtn" class="btn-logout"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg></button>
      </div>
    </header>
    <nav class="top-nav-links" id="navLinks"></nav>
    <main class="main-wrapper">
      <div class="glass-panel" style="padding:1.5rem; min-height:80vh;">
        <div class="tab-header" style="margin-bottom:1.5rem;"><h1 id="contentTitle" style="color:var(--primary); font-size:1.8rem; font-weight:800;">Cargando...</h1><p id="contentSubtitle" style="color:var(--text-muted); font-size:0.85rem;"></p></div>
        <div id="contentArea"></div>
      </div>
    </main>
  `;

  const navContainer = document.getElementById('navLinks');
  const contentTitle = document.getElementById('contentTitle');
  const contentSubtitle = document.getElementById('contentSubtitle');
  const contentArea = document.getElementById('contentArea');
  const datePicker = document.getElementById('globalDatePicker');
  
  if (currentDateFilter) datePicker.value = currentDateFilter;
  datePicker.addEventListener('change', (e) => { setDateFilter(e.target.value || null); renderTabContent(); });

  const renderNav = () => {
    navContainer.innerHTML = allowedTabs.map(t => `<a class="nav-item ${t.id === currentTab ? 'active' : ''}" data-id="${t.id}">${t.icon} ${t.label}</a>`).join('');
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', (e) => { currentTab = e.currentTarget.dataset.id; renderNav(); renderTabContent(); }));
  };

  const renderTabContent = async () => {
    const tabObj = allowedTabs.find(t => t.id === currentTab);
    const dateTag = currentDateFilter ? ` <span style="background:var(--warning); color:#000; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = tabObj.label + dateTag;
    contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p>Sincronizando...</p></div>`;

    if (currentTab === 'inicio') await renderHomeTab();
    else if (currentTab === 'stock') await renderStockTab();
    else if (currentTab === 'buffer') await renderBufferTab();
    else if (currentTab === 'admin_pers') await renderAdminTab();
    else if (currentTab === 'config') await renderConfigTab();
    else {
      const data = await getAreaData(currentTab);
      if (!data) renderUploadArea(contentArea, currentTab);
      else renderDashboardView(contentArea, data);
    }
  };

  const renderHomeTab = async () => {
    contentSubtitle.textContent = "Control Global de Operaciones";
    contentArea.innerHTML = `<div class="kpi-grid" id="homeKpiGrid"></div>`;
    ['stockActivo', 'stockReserva', 'buffer', 'picking'].forEach(a => {
        getAreaData(a).then(rows => {
            const grid = document.getElementById('homeKpiGrid');
            if(!grid) return;
            grid.innerHTML += `<div class="kpi-card"><h4>${a.toUpperCase()}</h4><h2>${rows ? rows.length.toLocaleString() : 0}</h2></div>`;
        });
    });
  };

  const renderStockTab = async () => {
    contentSubtitle.textContent = "Existencias Físicas";
    contentArea.innerHTML = `<div id="stockSub" style="display:flex; flex-direction:column; gap:1.2rem;"></div>`;
    const sub = document.getElementById('stockSub');
    const [act, res] = await Promise.all([getAreaData('stockActivo'), getAreaData('stockReserva')]);
    renderUploadArea(sub, 'stockActivo', act, '.csv');
    renderUploadArea(sub, 'stockReserva', res, '.xlsx');
  };

  const renderUploadArea = (container, area, hasData = null, ext = '.csv') => {
    const div = document.createElement('div');
    div.style.width = '100%';
    const label = area.toUpperCase();
    if (hasData) {
      div.innerHTML = `
        <div style="padding:1rem; background:rgba(34, 197, 94, 0.05); border:1px solid rgba(34, 197, 94, 0.3); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="color:var(--success); margin:0; font-size:0.9rem;">✅ ${label} CARGADO</h4>
            <p style="font-size:0.75rem; margin:2px 0 0 0; color:var(--text-muted);">${hasData.length.toLocaleString()} registros.</p>
          </div>
          <label class="btn" style="width:auto; padding:0.4rem 1rem; font-size:0.8rem;"><input type="file" id="up_${area}" accept="${ext}" style="display:none;">REUBICAR</label>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="upload-area" style="padding:1.5rem; text-align:center; border: 1px dashed var(--border); border-radius:10px; background:rgba(255,255,255,0.02); display:flex; flex-direction:column; align-items:center; gap:0.8rem;">
          <h3 style="margin:0; font-size:1rem; color:var(--text-main);">${label}</h3>
          <label class="btn" style="width:auto; padding:0.5rem 1.5rem; cursor:pointer; font-size:0.85rem;">SUBIR ARCHIVO <input type="file" id="up_${area}" accept="${ext}" style="display:none;"></label>
        </div>`;
    }
    container.appendChild(div);
    const input = document.getElementById(`up_${area}`);
    if(input) input.addEventListener('change', async (e) => { if(e.target.files[0]) { try { await parseFile(e.target.files[0], area); renderTabContent(); } catch(err) { alert(err); renderTabContent(); } } });
  };

  let activeBufferSub = 'reportes';
  const renderBufferTab = async () => {
    contentSubtitle.textContent = "Análisis de Reposición";
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    // VERIFICACIÓN DE CACHÉ PARA V8.1 (Invalida si falta detalleZonas)
    const stored = localStorage.getItem('lastBufferKPI');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (!parsed.detalleZonas) {
                console.warn("Removiendo caché Buffer antigua...");
                localStorage.removeItem('lastBufferKPI');
                lastBufferKPI = null;
            } else {
                lastBufferKPI = parsed;
            }
        } catch(e) { localStorage.removeItem('lastBufferKPI'); }
    }

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeBufferSub==='maestros'?'active':''}" data-s="maestros" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🗂️ ARCHIVOS MAESTROS</a>
          <a class="sub-nav-item ${activeBufferSub==='reportes'?'active':''}" data-s="reportes" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">📉 ANÁLISIS BUFFER</a>
        </nav><div id="bufContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeBufferSub = e.target.dataset.s; renderBufferTab(); }));
    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        const wrap = document.createElement('div'); wrap.style.display = 'grid'; wrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(240px, 1fr))'; wrap.style.gap = '1rem'; buf.appendChild(wrap);
        renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv');
        renderUploadArea(wrap, 'solicitud', dataStore.solicitud, '.csv');
        renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx');
        renderUploadArea(wrap, 'tallas', dataStore.tallas, '.xlsx');
    } else {
        const now = new Date();
        const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        buf.innerHTML = `
          <div style="background:rgba(30, 41, 59, 0.3); padding:1rem 1.5rem; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
              <h4 style="color:var(--text-muted); font-weight:600; font-size:0.8rem; margin:0;">Generado el: <span style="color:var(--primary);">${timeStr}</span></h4>
              <button id="btn_calc" class="btn" style="background:var(--primary); width:auto; padding:0.6rem 1.5rem; border-radius:6px; font-size:0.85rem;">⚡ PROCESAR ANÁLISIS</button>
            </div>
            <div id="resultsArea" style="display:flex; flex-direction:column; align-items:flex-start; gap:1.5rem; margin-left:1rem;"></div>
          </div>`;
        const results = document.getElementById('resultsArea');
        if (lastBufferKPI) renderBufferResults(results, lastBufferKPI);
        document.getElementById('btn_calc').addEventListener('click', async () => {
            const btn = document.getElementById('btn_calc'); btn.disabled = true; btn.innerHTML = 'PROCESANDO...';
            setTimeout(async () => {
                try {
                    const config = await fetchBufferConfig().catch(() => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' }));
                    const res = calculateBufferPallets(config);
                    if(res) { 
                        lastBufferKPI = res; 
                        localStorage.setItem('lastBufferKPI', JSON.stringify(res)); 
                        await saveBufferReport(res, user.username).catch(() => console.warn("Save failed, continuing...")); 
                        renderBufferResults(results, res); 
                    }
                    else alert('ERROR: Faltan archivos maestros.');
                } catch (err) {
                    console.error("Error en proceso:", err);
                    alert("Error al procesar: " + err.message);
                } finally {
                    btn.disabled = false; btn.innerHTML = '⚡ PROCESAR ANÁLISIS';
                }
            }, 500);
        });
    }
  };

  const renderBufferResults = (container, data) => {
    container.innerHTML = `
        <div style="background:rgba(15,23,42,0.9); border:2px solid #4f46e5; border-radius:12px; overflow:hidden; width:500px; max-width:100%; box-shadow: 0 0 15px rgba(79,70,229,0.4);">
            <div style="padding:0.8rem; background:rgba(79,70,229,0.1); border-bottom:1px solid rgba(79,70,229,0.3); text-align:center;"><h3 style="color:#fff; font-weight:800; margin:0; font-size:0.9rem; letter-spacing:1px;">ANÁLISIS BUFFER ZONAS</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.85rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(79,70,229,0.2);"><th style="padding:0.7rem 1.2rem; text-align:left; font-weight:700; font-size:0.75rem;">NIVEL/AREA</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">RQ</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">ATD RQ</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">% ATD</th></tr></thead>
                <tbody style="color:#eee;">${data.waterfall.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.nivel==='Total'?'background:rgba(79,70,229,0.08); font-weight:900;':''}">
                    <td style="padding:0.6rem 1.2rem; color:${r.nivel==='Total'?'#22c55e':'inherit'};">${r.nivel}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:${r.nivel==='Total'?'#22c55e':'inherit'};">${r.rq.toLocaleString()}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:${r.nivel==='Total'?'#22c55e' : (r.atd > 0 ? '#fff' : '#64748b')};">${r.atd.toLocaleString()}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:#22c55e; font-weight:900;">${r.pct}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <div style="background:rgba(15,23,42,0.9); border:2px solid #f59e0b; border-radius:12px; overflow:hidden; width:500px; max-width:100%; box-shadow: 0 0 15px rgba(245,158,11,0.3);">
            <div style="padding:0.8rem; background:rgba(245,158,11,0.1); border-bottom:1px solid rgba(245,158,11,0.3); text-align:center;"><h3 style="color:#f59e0b; font-weight:800; margin:0; font-size:0.9rem; letter-spacing:1px;">ANÁLISIS BUFFER SKU</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.85rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(245,158,11,0.2);"><th style="padding:0.7rem 1.2rem; text-align:left; font-weight:700; font-size:0.75rem;">TIPO DE EMPAQUE</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">PALETAS A BAJAR</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">SKUS</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">PAR/CAJA</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenSKU.map(r => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.tipo==='TOTAL'?'background:rgba(245,158,11,0.08); font-weight:900;':''}">
                    <td style="padding:0.6rem 1.2rem; color:${r.tipo==='SolidPack'?'#22c55e':r.tipo==='PreePack'?'#f59e0b':'#fff'};">${r.tipo}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; font-weight:bold; color:${r.tipo==='TOTAL'?'#fff':'inherit'};">${r.paletas}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:${r.tipo==='TOTAL'?'#fff':'inherit'};">${r.skus}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:#22c55e; font-weight:900;">${Number(r.parcaja).toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <div style="background:rgba(15,23,42,0.9); border:2px solid #ec4899; border-radius:12px; overflow:hidden; width:500px; max-width:100%; box-shadow: 0 0 15px rgba(236,72,153,0.3);">
            <div style="padding:0.8rem; background:rgba(236,72,153,0.1); border-bottom:1px solid rgba(236,72,153,0.3); text-align:center;"><h3 style="color:#ec4899; font-weight:800; margin:0; font-size:0.9rem; letter-spacing:1px;">DISCREPANCIAS GENDER (Zones 3,4,5)</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.85rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(236,72,153,0.2);"><th style="padding:0.7rem 1.2rem; text-align:left; font-weight:700; font-size:0.75rem;">GENDER</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">RQ</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenGender.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.key==='TOTAL'?'background:rgba(236,72,153,0.08); font-weight:900;':''}">
                    <td style="padding:0.6rem 1.2rem; text-align:left;">${r.key}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:#22c55e; font-weight:900;">${r.rq.toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <div style="background:rgba(15,23,42,0.9); border:2px solid #06b6d4; border-radius:12px; overflow:hidden; width:500px; max-width:100%; box-shadow: 0 0 15px rgba(6,182,212,0.3);">
            <div style="padding:0.8rem; background:rgba(6,182,212,0.1); border-bottom:1px solid rgba(6,182,212,0.3); text-align:center;"><h3 style="color:#06b6d4; font-weight:800; margin:0; font-size:0.9rem; letter-spacing:1px;">DISCREPANCIAS MARCAS (Zones 3,4,5)</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.85rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(6,182,212,0.2);"><th style="padding:0.7rem 1.2rem; text-align:left; font-weight:700; font-size:0.75rem;">MARCA</th><th style="padding:0.7rem 1.2rem; text-align:center; font-weight:700; font-size:0.75rem;">RQ</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenMarca.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.key==='TOTAL'?'background:rgba(6,182,212,0.08); font-weight:900;':''}">
                    <td style="padding:0.6rem 1.2rem; text-align:left;">${r.key}</td>
                    <td style="padding:0.6rem 1.2rem; text-align:center; color:#22c55e; font-weight:900;">${r.rq.toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <div style="display:flex; gap:1rem;">
            <button id="btn_exp_zonas" class="btn" style="width:auto; background:#4f46e5; padding:0.6rem 1.5rem; border-radius:6px; font-size:0.82rem;">📊 EXPORTAR ANÁLISIS ZONA</button>
            <button id="btn_exp_buffer" class="btn" style="width:auto; background:var(--success); padding:0.6rem 1.5rem; border-radius:6px; font-size:0.82rem;">📥 EXCEL DETALLADO SKU</button>
        </div>
    `;

    document.getElementById('btn_exp_zonas').addEventListener('click', () => {
        if(!data.detalleZonas || !data.detalleZonas.length) {
            alert('⚠️ ERROR: Los datos detallados de Zonas no están disponibles. Por favor haz clic en "PROCESAR ANÁLISIS" nuevamente.');
        } else {
            exportToExcel(data.detalleZonas, 'Analisis_Zonas_V81');
        }
    });
    document.getElementById('btn_exp_buffer').addEventListener('click', () => {
        if(!data.detalle || !data.detalle.length) {
            alert('⚠️ ERROR: El detalle de SKU no está disponible. Por favor haz clic en "PROCESAR ANÁLISIS" nuevamente.');
        } else {
            exportToExcel(data.detalle, 'Analisis_SKU_V81');
        }
    });
  };

  let activeAdminSub = 'usuarios';
  const renderAdminTab = async () => {
    contentSubtitle.textContent = "Gestión de Personal y Auditoría";
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeAdminSub==='usuarios'?'active':''}" data-s="usuarios" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">👥 USUARIOS</a>
          <a class="sub-nav-item ${activeAdminSub==='permisos'?'active':''}" data-s="permisos" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🛡️ PERMISOS</a>
          <a class="sub-nav-item ${activeAdminSub==='logs'?'active':''}" data-s="logs" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">📜 REGISTRO LOG</a>
        </nav><div id="adminContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeAdminSub = e.target.dataset.s; renderAdminTab(); }));
    document.getElementById('adminContent').innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size: 0.85rem;">Módulo en desarrollo: ${activeAdminSub.toUpperCase()}</div>`;
  };

  let activeConfigSub = 'parametros';
  const renderConfigTab = async () => {
    contentSubtitle.textContent = "Panel de Control Técnico";
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeConfigSub==='parametros'?'active':''}" data-s="parametros" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">⚙️ PARÁMETROS</a>
          <a class="sub-nav-item ${activeConfigSub==='conexion'?'active':''}" data-s="conexion" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🌐 CONEXIÓN</a>
        </nav><div id="configContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeConfigSub = e.target.dataset.s; renderConfigTab(); }));
    
    if (activeConfigSub === 'parametros') {
        document.getElementById('configContent').innerHTML = `<div class="glass-panel" style="max-width:450px; padding:1.5rem;"><h4 style="font-size:0.95rem; margin-top:0;">Configuración de Motor</h4>${['include_reserva', 'include_alto'].map(k => `<label style="display:flex; justify-content:space-between; margin:0.8rem 0; font-size:0.85rem;">${k.toUpperCase().replace('_', ' ')} <input type="checkbox" checked></label>`).join('')}<button class="btn" style="font-size:0.85rem; padding:0.6rem;">GUARDAR CAMBIOS</button></div>`;
    } else {
        document.getElementById('configContent').innerHTML = `<div style="padding:1.5rem; font-size:0.85rem;">Estado de API: <span style="color:var(--success); font-weight:bold;">CONECTADO</span></div>`;
    }
  };

  document.getElementById('logoutBtn').addEventListener('click', onLogout);
  renderNav();
  renderTabContent();
};

const renderDashboardView = (container, data) => { container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);"><h3 style="font-size:1rem; margin:0;">Visualización de Datos</h3><p style="font-size:0.85rem;">${data.length.toLocaleString()} registros detectados.</p></div>`; };
