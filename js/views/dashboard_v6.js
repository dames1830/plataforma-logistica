import { logout } from '../services/auth.js';
import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter } from '../services/csvHub_v6.js?v=7.0';

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
    if(!data || !data.length) return;
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
        <h2 style="font-weight:700; letter-spacing:1px; color:#fff;">LOGÍSTICA <span style="color:var(--primary)">DAMES1830</span></h2>
      </div>
      <div class="user-profile">
        <div class="date-filter-container" style="background:rgba(255,255,255,0.05); padding:0.4rem 0.8rem; border-radius:10px; border:1px solid var(--border); display:flex; align-items:center; gap:0.5rem;">
          <input type="date" id="globalDatePicker" style="background:transparent; border:none; color:var(--text-main); font-family:inherit; outline:none; cursor:pointer; color-scheme:dark;">
        </div>
        <div class="user-details" style="text-align:right;">
          <span class="user-name" style="color:#fff; font-weight:600;">${user.name}</span>
          <span class="user-role" style="color:var(--text-muted); font-size:0.75rem;">${user.role.toUpperCase()} MASTER</span>
        </div>
        <button id="logoutBtn" class="btn-logout" title="Cerrar Sesión">
           <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
        </button>
      </div>
    </header>
    <nav class="top-nav-links" id="navLinks"></nav>
    <main class="main-wrapper">
      <div class="glass-panel" style="padding:2rem; min-height:80vh;">
        <div class="tab-header" style="margin-bottom:2rem; display:flex; justify-content:space-between; align-items:flex-end;">
          <div><h1 id="contentTitle" style="color:var(--primary); font-size:2rem; font-weight:800;">Cargando...</h1><p id="contentSubtitle" style="color:var(--text-muted); font-size:0.9rem;">Analizando base de datos centralizada</p></div>
        </div>
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
  datePicker.addEventListener('change', (e) => {
      setDateFilter(e.target.value || null);
      renderTabContent();
  });

  const renderNav = () => {
    navContainer.innerHTML = allowedTabs.map(t => `<a class="nav-item ${t.id === currentTab ? 'active' : ''}" data-id="${t.id}">${t.icon} ${t.label}</a>`).join('');
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.id;
      renderNav(); renderTabContent();
    }));
  };

  const renderTabContent = async () => {
    const tabObj = allowedTabs.find(t => t.id === currentTab);
    const dateTag = currentDateFilter ? ` <span style="background:var(--warning); color:#000; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = tabObj.label + dateTag;
    if(currentChart) { currentChart.destroy(); currentChart = null; }
    contentArea.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p>Sincronizando...</p></div>`;

    if (currentTab === 'inicio') await renderHomeTab();
    else if (currentTab === 'stock') await renderStockTab();
    else if (currentTab === 'buffer') await renderBufferTab();
    else if (currentTab === 'config') await renderConfigTab();
    else {
      const data = await getAreaData(currentTab);
      if (!data) renderUploadArea(contentArea, currentTab);
      else renderDashboardView(contentArea, data);
    }
  };

  const renderHomeTab = async () => {
    contentSubtitle.textContent = "Control Global de Operaciones Logísticas";
    contentArea.innerHTML = `<div class="kpi-grid" id="homeKpiGrid"></div>`;
    ['stockActivo', 'stockReserva', 'buffer', 'picking', 'packing'].forEach(a => {
        getAreaData(a).then(rows => {
            const grid = document.getElementById('homeKpiGrid');
            if(!grid) return;
            grid.innerHTML += `<div class="kpi-card"><h4>${a.toUpperCase()}</h4><h2>${rows ? rows.length.toLocaleString() : 0}</h2></div>`;
        });
    });
  };

  const renderStockTab = async () => {
    contentSubtitle.textContent = "Gestión de Existencias Físicas y de Reserva";
    contentArea.innerHTML = `<div id="stockSub" style="display:flex; flex-direction:column; gap:1.5rem;"></div>`;
    const sub = document.getElementById('stockSub');
    const [act, res] = await Promise.all([getAreaData('stockActivo'), getAreaData('stockReserva')]);
    renderUploadArea(sub, 'stockActivo', act, '.csv');
    renderUploadArea(sub, 'stockReserva', res, '.xlsx');
  };

  const renderUploadArea = (container, area, hasData = null, ext = '.csv') => {
    const div = document.createElement('div');
    div.style.width = '100%';
    const label = area.replace('solicitud', 'OTRAS SOLICITUDES').replace('articulos', 'MAESTRO ARTÍCULOS').replace('tallas', 'TALLAS').toUpperCase();
    
    if (hasData) {
      div.innerHTML = `<div style="padding:1.5rem; background:rgba(34, 197, 94, 0.1); border:1px solid var(--success); border-radius:12px; display:flex; justify-content:space-between; align-items:center;"><div><h4 style="color:var(--success);">✅ ${label} OK</h4><p style="font-size:0.8rem;">${hasData.length.toLocaleString()} registros.</p></div><label class="btn" style="width:auto; padding:0.5rem 1rem;"><input type="file" id="up_${area}" accept="${ext}" style="display:none;">ACTUALIZAR</label></div>`;
    } else {
      div.innerHTML = `<div class="upload-area" style="padding:2rem;"><h3 style="margin-bottom:1rem;">${label}</h3><label class="btn" style="width:auto; padding:0.6rem 2rem; cursor:pointer;">SUBIR ${ext} <input type="file" id="up_${area}" accept="${ext}" style="display:none;"></label></div>`;
    }
    container.appendChild(div);
    const input = document.getElementById(`up_${area}`);
    if(input) input.addEventListener('change', async (e) => {
        if(!e.target.files[0]) return;
        try { await parseFile(e.target.files[0], area); renderTabContent(); } catch(err) { alert(err); renderTabContent(); }
    });
  };

  let activeBufferSub = 'reportes';
  const renderBufferTab = async () => {
    contentSubtitle.textContent = "Análisis de Reposición y Sincronización de Stock";
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.5rem; margin-bottom:2rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeBufferSub==='maestros'?'active':''}" data-s="maestros">🗂️ ARCHIVOS MAESTROS</a>
          <a class="sub-nav-item ${activeBufferSub==='reportes'?'active':''}" data-s="reportes">📉 ANÁLISIS BUFFER</a>
        </nav>
        <div id="bufContent"></div>`;
    
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => {
        activeBufferSub = e.target.dataset.s; renderBufferTab();
    }));

    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid'; wrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))'; wrap.style.gap = '1.5rem';
        buf.appendChild(wrap);
        renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv');
        renderUploadArea(wrap, 'solicitud', dataStore.solicitud, '.csv');
        renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx');
        renderUploadArea(wrap, 'tallas', dataStore.tallas, '.xlsx');
    } else {
        buf.innerHTML = `
            <div style="background:rgba(219,39,119,0.08); padding:2rem; border-radius:16px; border:3px solid #db2777;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                    <h2 style="color:#db2777; font-weight:900; margin:0;">ANÁLISIS BUFFER NUCLEAR V7.0</h2>
                    <button id="btn_calc" class="btn" style="background:#db2777; width:auto; padding:1rem 3rem; font-weight:800;">⚡ PROCESAR ANÁLISIS</button>
                </div>
                <div id="resultsArea"></div>
            </div>`;
        
        const results = document.getElementById('resultsArea');
        if (lastBufferKPI) renderBufferResults(results, lastBufferKPI);

        document.getElementById('btn_calc').addEventListener('click', async () => {
            const btn = document.getElementById('btn_calc');
            btn.disabled = true; btn.innerHTML = 'PROCESANDO...';
            setTimeout(async () => {
                const res = calculateBufferPallets(bufferConfigCached);
                if(res) {
                    lastBufferKPI = res;
                    localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                    saveBufferReport(res, user.username);
                    renderBufferResults(results, res);
                } else alert('ERROR: Faltan archivos maestros.');
                btn.disabled = false; btn.innerHTML = '⚡ PROCESAR ANÁLISIS';
            }, 500);
        });
    }
  };

  const renderBufferResults = (container, data) => {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2rem;">
            <!-- BLOQUE 1: ZONAS -->
            <div style="background:rgba(15,23,42,0.8); border:2px solid #4f46e5; border-radius:12px; overflow:hidden;">
                <div style="padding:1.2rem; background:rgba(79,70,229,0.2); border-bottom:1px solid #4f46e5; text-align:center;">
                    <h3 style="color:#fff; font-weight:700; margin:0; letter-spacing:1px;">ANÁLISIS BUFFER ZONAS</h3>
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.5); border-bottom:1px solid rgba(255,255,255,0.1);">
                            <th style="padding:1.2rem; text-align:left; color:var(--text-muted); font-size:0.8rem;">NIVEL/AREA</th>
                            <th style="padding:1.2rem; text-align:right; color:var(--text-muted); font-size:0.8rem;">RQ</th>
                            <th style="padding:1.2rem; text-align:right; color:var(--text-muted); font-size:0.8rem;">ATD RQ</th>
                            <th style="padding:1.2rem; text-align:right; color:var(--text-muted); font-size:0.8rem;">% ATD</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.waterfall.map(r => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${r.nivel === 'Total' ? 'background:rgba(255,255,255,0.05); font-weight:800;' : ''}">
                                <td style="padding:1rem 1.2rem;">${r.nivel}</td>
                                <td style="padding:1rem 1.2rem; text-align:right;">${r.rq.toLocaleString()}</td>
                                <td style="padding:1rem 1.2rem; text-align:right; color:${r.nivel==='Total'?'#22c55e':'#fff'};">${r.atd.toLocaleString()}</td>
                                <td style="padding:1rem 1.2rem; text-align:right; color:${r.nivel==='Total'?'#22c55e':'#fff'};">${r.pct}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- BLOQUE 2: SKU -->
            <div style="background:rgba(15,23,42,0.8); border:2px solid #f59e0b; border-radius:12px; overflow:hidden;">
                <div style="padding:1.2rem; background:rgba(245,158,11,0.1); border-bottom:1px solid #f59e0b; text-align:center;">
                    <h3 style="color:#f59e0b; font-weight:700; margin:0; letter-spacing:1px;">ANÁLISIS BUFFER SKU</h3>
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.5); border-bottom:1px solid rgba(255,255,255,0.1);">
                            <th style="padding:1.2rem; text-align:left; color:var(--text-muted); font-size:0.8rem;">TIPO DE EMPAQUE</th>
                            <th style="padding:1.2rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">PALETAS A BAJAR</th>
                            <th style="padding:1.2rem; text-align:center; color:var(--text-muted); font-size:0.8rem;">SKUS</th>
                            <th style="padding:1.2rem; text-align:right; color:var(--text-muted); font-size:0.8rem;">PAR/CAJA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.resumenSKU.map(r => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${r.tipo === 'TOTAL' ? 'background:rgba(255,255,255,0.05); font-weight:800;' : ''}">
                                <td style="padding:1rem 1.2rem; color:${r.tipo==='SolidPack'?'#22c55e':r.tipo==='PreePack'?'#f59e0b':'#fff'};">${r.tipo}</td>
                                <td style="padding:1rem 1.2rem; text-align:center;">${r.paletas}</td>
                                <td style="padding:1rem 1.2rem; text-align:center;">${r.skus}</td>
                                <td style="padding:1rem 1.2rem; text-align:right; color:${r.tipo==='TOTAL'?'#22c55e':'#fff'}; font-size:${r.tipo==='TOTAL'?'1.2rem':'1rem'};">${Number(r.parcaja).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        <div style="margin-top:2rem; display:flex; justify-content:center; gap:2rem;">
            <button id="btn_exp_buffer" class="btn" style="width:auto; background:var(--success); padding:1rem 3rem;">📥 EXPORTAR DETALLE EXCEL</button>
        </div>
    `;
    document.getElementById('btn_exp_buffer').addEventListener('click', () => exportToExcel(data.detalle, 'Buffer_V7'));
  };

  const renderConfigTab = async () => {
    contentArea.innerHTML = `<div class="glass-panel" style="max-width:500px; margin:2rem auto; padding:2rem;"><h3>Configuración</h3><button id="save_conf" class="btn">Guardar</button></div>`;
  };

  document.getElementById('logoutBtn').addEventListener('click', onLogout);
  renderNav();
  renderTabContent();
};

const renderDashboardView = (container, data) => {
    container.innerHTML = `<div style="padding:3rem; text-align:center;"><h3>Datos Cargados</h3><p>${data.length.toLocaleString()} registros.</p></div>`;
};
