import { logout } from '../services/auth.js';
import { 
  parseFile, 
  getAreaData, 
  generateKPIs,
  calculateBufferPallets, 
  fetchBufferConfig, 
  saveBufferReport, 
  dataStore, 
  setDateFilter, 
  currentDateFilter, 
  pingServer 
} from '../services/csvHub_v6.js?v=10.8.1-beta';

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

const exportToExcel = (data, filename) => {
    if (!data || !data.length) {
        alert('⚠️ ERROR: Los datos para este reporte no están disponibles.');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
};

export const renderDashboard = async (container, user, onLogout) => {
  pingServer();
  container.className = 'dashboard-layout animate-fade-in';
  
  let currentTab = 'inicio'; 

  const renderNav = () => {
    container.innerHTML = `
      <header class="topbar">
        <div class="topbar-brand">
          <h2 style="font-weight:700; color:#fff;">LOGÍSTICA <span style="color:var(--primary)">DAMES1830 <span style="text-transform:lowercase">v</span>10.8 <span style="font-size:0.6rem; color:#ef4444; vertical-align:middle;">BETA (DEV)</span></span></h2>
        </div>
        <div class="user-profile">
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
          <div class="tab-header" style="margin-bottom:1.5rem;"><h1 id="contentTitle" style="color:var(--primary); font-size:1.8rem; font-weight:800;">Inicio</h1><p id="contentSubtitle" style="color:var(--text-muted); font-size:0.85rem;"></p></div>
          <div id="contentArea"></div>
        </div>
      </main>
    `;

    const navContainer = document.getElementById('navLinks');
    navContainer.innerHTML = TABS
      .filter(t => t.roles.includes(user.role))
      .map(t => `<a class="nav-item ${t.id === currentTab ? 'active' : ''}" data-id="${t.id}">${t.icon} ${t.label}</a>`).join('');
    
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', (e) => { 
        currentTab = e.currentTarget.dataset.id; 
        renderNav(); 
        renderTabContent(); 
    }));
    document.getElementById('logoutBtn').addEventListener('click', onLogout);
  };

  const renderTabContent = async () => {
    const area = document.getElementById('contentArea');
    const title = document.getElementById('contentTitle');
    const subtitle = document.getElementById('contentSubtitle');
    const tabObj = TABS.find(t => t.id === currentTab);
    if (!tabObj) return;
    title.textContent = tabObj.label;

    if (currentTab === 'inicio') renderHomeTab(area, subtitle);
    else if (currentTab === 'stock') renderStockTab(area, subtitle);
    else if (currentTab === 'buffer') await renderBufferTab(area, subtitle);
    else if (currentTab === 'admin_pers') renderAdminTab(area, subtitle);
    else if (currentTab === 'config') renderConfigTab(area, subtitle);
    else renderGenericTab(area, subtitle, currentTab, tabObj.label);
  };

  const renderHomeTab = (container, subtitle) => {
    subtitle.textContent = "Resumen General Operativo (Tiempo Real)";
    const kpis = generateKPIs();
    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
        ${kpis.map(k => `
          <div class="glass-panel animate-fade-in" style="padding:1.5rem; border:1px solid ${k.color}33;">
            <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.8rem; display:flex; justify-content:space-between;">
              <span>${k.title}</span><span style="color:${k.color}">${k.icon}</span>
            </div>
            <div style="font-size:2.2rem; font-weight:800; color:#fff;">${k.value}</div>
            <div style="font-size:0.75rem; color:${k.color}; margin-top:0.5rem; font-weight:600;">${k.subtitle}</div>
          </div>
        `).join('')}
      </div>`;
  };

  const renderStockTab = (container, subtitle) => {
    subtitle.textContent = "Gestión de Archivos de Inventario";
    container.innerHTML = `<div class="upload-grid" id="stockGrid"></div>`;
    const grid = document.getElementById('stockGrid');
    renderUploadArea(grid, 'stockActivo', dataStore.stockActivo, '.csv', 'Activo');
    renderUploadArea(grid, 'stockReserva', dataStore.stockReserva, '.xlsx', 'Reserva');
  };

  let activeBufferSub = 'reportes';
  let bufferConfigCached = null;
  let lastBufferKPI = null;

  const renderBufferTab = async (container, subtitle) => {
    subtitle.textContent = "Análisis de Reposición (V10.8 Precision)";
    if (!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();

    container.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeBufferSub==='maestros'?'active':''}" data-s="maestros">🗂️ ARCHIVOS MAESTROS</a>
          <a class="sub-nav-item ${activeBufferSub==='reportes'?'active':''}" data-s="reportes">📉 ANÁLISIS BUFFER</a>
        </nav><div id="bufContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeBufferSub = e.target.dataset.s; 
        renderBufferTab(container, subtitle); 
    }));

    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        buf.innerHTML = `<div class="upload-grid" id="mastersGrid"></div>`;
        const grid = document.getElementById('mastersGrid');
        renderUploadArea(grid, 'buffer', dataStore.buffer, '.csv,.xlsx', 'PEDIDOS / ZONA BUFFER');
        renderUploadArea(grid, 'articulos', dataStore.articulos, '.xlsx', 'Artículos (XLSX)');
        renderUploadArea(grid, 'tallas', dataStore.tallas, '.xlsx', 'Tallas (XLSX)');
    } else {
        buf.innerHTML = `
          <div style="background:rgba(30, 41, 59, 0.3); padding:1.2rem; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
              <h4 style="color:var(--text-muted); font-size:0.8rem; margin:0;">Análisis Forense V10.8 (Precision Pulse)</h4>
              <button id="btn_calc" class="btn" style="width:auto; padding:0.5rem 1.5rem;">⚡ PROCESAR ANÁLISIS</button>
            </div>
            <div id="resultsArea"></div>
          </div>`;
        const results = document.getElementById('resultsArea');
        if (lastBufferKPI) renderBufferResults(results, lastBufferKPI);
        document.getElementById('btn_calc').addEventListener('click', () => {
            const btn = document.getElementById('btn_calc'); btn.disabled = true; btn.innerHTML = 'PROCESANDO...';
            setTimeout(() => {
                const res = calculateBufferPallets(bufferConfigCached);
                if (res) { lastBufferKPI = res; renderBufferResults(results, res); }
                else alert('ERROR: Faltan archivos maestros.');
                btn.disabled = false; btn.innerHTML = '⚡ PROCESAR ANÁLISIS';
            }, 400);
        });
    }
  };

  const renderGenericTab = (container, subtitle, id, label) => {
    subtitle.textContent = `Operativa: ${label}`;
    container.innerHTML = `<div class="upload-grid" id="genGrid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem;"></div>`;
    renderUploadArea(document.getElementById('genGrid'), id, dataStore[id], '.csv', label);
  };

  const renderAdminTab = (container, subtitle) => {
    subtitle.textContent = "Control de Usuarios y Accesos";
    container.innerHTML = `
      <div style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
        <a class="sub-nav-item active">👤 USUARIOS</a>
        <a class="sub-nav-item">🔑 PERMISOS</a>
        <a class="sub-nav-item">📜 LOGS</a>
      </div>
      <div style="padding:2rem; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:12px;">
        Este módulo utiliza los privilegios de tu cuenta: <strong>${user.role.toUpperCase()}</strong>.
      </div>`;
  };

  const renderConfigTab = (container, subtitle) => {
    subtitle.textContent = "Parámetros del Motor Lógico";
    container.innerHTML = `
      <div style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
        <a class="sub-nav-item active">⚙️ PARÁMETROS</a>
        <a class="sub-nav-item">🔌 CONEXIONES</a>
      </div>
      <div style="padding:2rem; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:12px;">
        Configuración activa para optimización distribuida.
      </div>`;
  };

  const renderUploadArea = (container, area, data, ext, label) => {
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'upload-area';
    div.innerHTML = `
        <h3 style="margin:0; font-size:0.85rem;">${label.toUpperCase()}</h3>
        <p style="font-size:0.7rem; color:${data?'var(--success)':'var(--text-muted)'}">${data ? '✅ '+data.length.toLocaleString()+' Filas' : 'Sin datos'}</p>
        <label class="btn" style="width:auto; padding:0.4rem 1rem; font-size:0.75rem; cursor:pointer;">${data?'REPLACING':'UPLOAD'} <input type="file" id="up_input_${area}" accept="${ext}" style="display:none;"></label>`;
    container.appendChild(div);
    const input = div.querySelector('input');
    if(input) input.addEventListener('change', async (e) => { 
        if(e.target.files[0]) { try { await parseFile(e.target.files[0], area); renderTabContent(); } catch(err){ alert(err); } } 
    });
  };

  const renderBufferResults = (container, data) => {
    const leanGender = (data.resumenGender || []).map(r => ({ key: r.key, rq: r.atd }));
    const leanMarca = (data.resumenMarca || []).map(r => ({ key: r.key, rq: r.atd }));

    container.innerHTML = `
        <div style="display:flex; gap:1.2rem; justify-content:center;">
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
                ${renderTable('ANÁLISIS BUFFER ZONAS', ['AREA', 'RQ', 'ATD', '%'], data.waterfall, '#6366f1')}
                ${renderSKUTable(data.resumenSKU)}
            </div>
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
                ${renderTable('DISCREPANCIAS GENDER (Zonas 3,4,5)', ['GENDER', 'RQ'], leanGender, '#ec4899')}
                ${renderTable('DISCREPANCIAS MARCAS (Zonas 3,4,5)', ['MARCA', 'RQ'], leanMarca, '#06b6d4')}
            </div>
        </div>
        <div style="display:flex; gap:1.5rem; width:100%; margin-top:2rem; justify-content:center;">
            <button id="btn_exp_zonas" class="btn" style="width:auto; min-width:215px; background:#4f46e5;">Exportar Reporte Zona</button>
            <button id="btn_exp_sku" class="btn" style="width:auto; min-width:215px; background:var(--success);">Exportar Reporte Detallado</button>
        </div>`;
    document.getElementById('btn_exp_zonas').addEventListener('click', () => exportToExcel(data.detalleZonas, 'Analisis_Zonas_V10'));
    document.getElementById('btn_exp_sku').addEventListener('click', () => exportToExcel(data.detalle, 'Analisis_SKU_V10'));
  };

  const renderTable = (title, cols, rows, color) => {
    if(!rows) return '';
    return `
    <div class="neon-table-container" style="border:1px solid ${color}; box-shadow:0 0 10px ${color}11; width:460px;">
        <div style="padding:0.6rem; background:${color}08; border-bottom:1px solid ${color}22; text-align:center;"><h3 style="margin:0; font-size:0.75rem; color:${color}; font-weight:700;">${title}</h3></div>
        <table style="width:100%; border-collapse:collapse; font-size:0.7rem;">
            <thead style="background:rgba(0,0,0,0.2);"><tr style="border-bottom:1px solid ${color}22;">${cols.map(c=>`<th style="padding:0.4rem; text-align:center; color:var(--text-muted);">${c}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); ${(r.nivel && r.nivel.includes('Total')) || r.key==='TOTAL' || r.key==='Total'?'background:'+color+'11; font-weight:bold;':''}">
                    ${Object.values(r).map((v,idx) => {
                        const isResult = (r.nivel && r.nivel.includes('Total')) || r.key==='TOTAL' || r.key==='Total';
                        const isLast = idx === Object.values(r).length - 1;
                        return `<td style="padding:0.35rem 0.8rem; text-align:${isResult?'center':'left'}; color:${isLast?'#22c55e':(isResult?'#22c55e':'#fff')};">${typeof v==='number'?v.toLocaleString():v}</td>`;
                    }).join('')}
                </tr>`).join('')}</tbody>
        </table>
    </div>`;
  };

  const renderSKUTable = (rows) => {
    if(!rows) return '';
    return `
    <div class="neon-table-container" style="border:1px solid #f59e0b; box-shadow:0 0 10px rgba(245,158,11,0.08); width:460px;">
        <div style="padding:0.6rem; background:rgba(245,158,11,0.05); border-bottom:1px solid rgba(245,158,11,0.2); text-align:center;"><h3 style="margin:0; font-size:0.75rem; color:#f59e0b; font-weight:700;">ANÁLISIS BUFFER SKU</h3></div>
        <table style="width:100%; border-collapse:collapse; font-size:0.7rem;">
            <thead style="background:rgba(0,0,0,0.2);"><tr style="border-bottom:1px solid rgba(245,158,11,0.1);"><th style="padding:0.4rem;">EMPAQUE</th><th style="padding:0.4rem;">PALETAS</th><th style="padding:0.4rem;">SKUS</th><th style="padding:0.4rem;">PAR/CAJA</th></tr></thead>
            <tbody>${rows.map(r => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); ${r.tipo==='TOTAL'?'background:rgba(245,158,11,0.1); font-weight:bold;':''}">
                    <td style="padding:0.35rem 0.8rem; text-align:${r.tipo==='TOTAL'?'center':'left'}; color:${r.tipo==='SolidPack'?'#22c55e':r.tipo==='PreePack'?'#f59e0b':'#fff'}">${r.tipo}</td>
                    <td style="padding:0.35rem; text-align:${r.tipo==='TOTAL'?'center':'left'};">${r.paletas}</td>
                    <td style="padding:0.35rem; text-align:${r.tipo==='TOTAL'?'center':'left'};">${r.skus}</td>
                    <td style="padding:0.35rem; text-align:${r.tipo==='TOTAL'?'center':'left'}; color:#22c55e; font-weight:bold;">${r.parcaja.toLocaleString()}</td>
                </tr>`).join('')}</tbody>
        </table>
    </div>`;
  };

  renderNav();
  renderTabContent();
};
