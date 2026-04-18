import { logout } from '../services/auth.js';
import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter } from '../services/csvHub_v6.js?v=6.8';

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
      <div class="topbar-brand"><h2>Logística Dames1830</h2></div>
      <div class="user-profile">
        <div class="date-filter-container">
          <input type="date" id="globalDatePicker" title="Historial">
        </div>
        <div class="user-details"><span class="user-name">${user.name}</span></div>
        <button id="logoutBtn" class="btn-logout">SALIR</button>
      </div>
    </header>
    <nav class="top-nav-links" id="navLinks"></nav>
    <main class="main-wrapper">
      <div class="glass-panel">
        <div class="tab-header"><div><h1 id="contentTitle">Cargando...</h1><p id="contentSubtitle"></p></div></div>
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
    contentTitle.textContent = tabObj.label;
    if(currentChart) { currentChart.destroy(); currentChart = null; }
    contentArea.innerHTML = `<div class="loading-state">Sincronizando...</div>`;

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
    contentArea.innerHTML = `<div class="kpi-grid" id="homeKpiGrid"></div>`;
    ['stockActivo', 'stockReserva', 'buffer', 'picking', 'packing'].forEach(a => {
        getAreaData(a).then(rows => {
            const grid = document.getElementById('homeKpiGrid');
            if(!grid) return;
            grid.innerHTML += `<div class="kpi-card"><h4>${a.toUpperCase()}</h4><h2>${rows ? rows.length : 0}</h2></div>`;
        });
    });
  };

  const renderStockTab = async () => {
    contentArea.innerHTML = `<div id="stockSub"></div>`;
    const sub = document.getElementById('stockSub');
    const [act, res] = await Promise.all([getAreaData('stockActivo'), getAreaData('stockReserva')]);
    renderUploadArea(sub, 'stockActivo', act, '.csv');
    renderUploadArea(sub, 'stockReserva', res, '.xlsx');
  };

  const renderUploadArea = (container, area, hasData = null, ext = '.csv') => {
    const div = document.createElement('div');
    div.className = 'upload-card';
    div.innerHTML = hasData 
        ? `<div class="status-ok">✅ ${area} OK (${hasData.length} registros) <button id="btn_up_${area}">Actualizar</button></div>`
        : `<div class="status-empty">Subir ${area} (${ext}) <input type="file" id="up_${area}" accept="${ext}"></div>`;
    container.appendChild(div);
    const input = document.getElementById(hasData ? `btn_up_${area}` : `up_${area}`);
    if(input) input.addEventListener('change', async (e) => {
        await parseFile(e.target.files[0], area);
        renderTabContent();
    });
  };

  let activeBufferSub = 'reportes';
  const renderBufferTab = async () => {
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    contentArea.innerHTML = `
        <nav class="sub-nav">
          <button class="sub-nav-btn ${activeBufferSub==='maestros'?'active':''}" data-s="maestros">ARCHIVOS</button>
          <button class="sub-nav-btn ${activeBufferSub==='reportes'?'active':''}" data-s="reportes">ANALISIS</button>
        </nav>
        <div id="bufContent"></div>`;
    
    document.querySelectorAll('.sub-nav-btn').forEach(b => b.addEventListener('click', (e) => {
        activeBufferSub = e.target.dataset.s; renderBufferTab();
    }));

    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        renderUploadArea(buf, 'buffer', dataStore.buffer, '.csv');
    } else {
        buf.innerHTML = `
            <div class="nuclear-panel" style="border:4px solid #db2777; padding:2rem; border-radius:12px; background:rgba(219,39,119,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="color:#db2777;">ANALISIS BUFFER NUCLEAR V6.8</h2>
                    <button id="btn_calc" class="btn-primary" style="background:#db2777; padding:1rem 2rem;">⚡ PROCESAR ANALISIS</button>
                </div>
                <div id="resultsArea" style="margin-top:2rem;"></div>
            </div>`;
        
        const results = document.getElementById('resultsArea');
        if (lastBufferKPI) renderBufferResults(results, lastBufferKPI);

        document.getElementById('btn_calc').addEventListener('click', async () => {
            const btn = document.getElementById('btn_calc');
            btn.disabled = true; btn.textContent = 'PROCESANDO...';
            const res = calculateBufferPallets(bufferConfigCached);
            if(res) {
                lastBufferKPI = res;
                localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                saveBufferReport(res, user.username);
                renderBufferResults(results, res);
            } else alert('Faltan datos maestros (Stock Activo/Reserva/Pedidos)');
            btn.disabled = false; btn.textContent = '⚡ PROCESAR ANALISIS';
        });
    }
  };

  const renderBufferResults = (container, data) => {
    container.innerHTML = `
        <div class="results-grid">
            <div class="table-card">
                <h3>ZONIFICACION</h3>
                <table>${data.waterfall.map(r => `<tr><td>${r.nivel}</td><td>${r.atd}</td><td>${r.pct}</td></tr>`).join('')}</table>
            </div>
            <div class="table-card">
                <h3>EMPAQUE</h3>
                <table>${data.resumenSKU.map(r => `<tr><td>${r.tipo}</td><td>${r.paletas} pal</td><td>${r.parcaja} un</td></tr>`).join('')}</table>
            </div>
        </div>
        <button id="btn_exp_buffer" class="btn-success">Exportar Detalle</button>`;
    document.getElementById('btn_exp_buffer').addEventListener('click', () => exportToExcel(data.detalle, 'Buffer_Detalle'));
  };

  document.getElementById('logoutBtn').addEventListener('click', onLogout);
  renderNav();
  renderTabContent();
};

const renderDashboardView = (container, data) => {
    container.innerHTML = `<div class="info-card">Registros cargados: ${data.length}</div>`;
};
