import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter, getUploadMeta } from '../services/csvHub_v6.js?v=11.1.25-pulse';
import * as adminService from '../services/adminService.js?v=11.1.25-pulse';

const VERSION = '11.1.25-pulse';
const CACHE_KEY = `logistics_v11_1_25_`;
console.log(`[PULSE] Engine v${VERSION} Initialized (Beta / Cache Force)`);

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'stock', label: 'Stock General', icon: '🏦', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'], subTabs: [
    { id: 'stockActivo', label: 'Stock Activo', icon: '⚡' },
    { id: 'stockReserva', label: 'Stock Reserva', icon: '📦' }
  ] },
  { id: 'inventario', label: 'Inventario (Ciclo)', icon: '📋', roles: ['admin', 'jefe', 'supervisor'] },
  { id: 'picking', label: 'Picking', icon: '🛒', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'packing', label: 'Packing', icon: '📦', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'despacho', label: 'Despacho', icon: '🚚', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'recepcion', label: 'Recepción', icon: '📥', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'almacenaje', label: 'Almacenaje', icon: '🏭', roles: ['admin', 'jefe', 'supervisor', 'encargado'] },
  { id: 'buffer', label: 'Zona Buffer', icon: '⏳', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'reportes', label: 'Análisis Buffer', icon: '📉' },
    { id: 'maestros', label: 'Recursos Maestros', icon: '🗂️' }
  ] },
  { id: 'admin_pers', label: 'Administración', icon: '👥', roles: ['admin', 'jefe'], subTabs: [
    { id: 'trabajadores', label: 'Trabajadores', icon: '👷' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'permisos', label: 'Permisos', icon: '🛡️' },
    { id: 'asistencia', label: 'Asistencia', icon: '📅' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'rfs', label: 'RF´s', icon: '🔋' }
  ] },
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
  adminService.initPermissions(TABS);
  container.className = 'dashboard-layout animate-fade-in';
  
  let rolePermissions = adminService.getPermissions(user.role) || {};
  // Si no hay locales para este rol (raro por init), intentar API como fallback secundario
  if (user.role !== 'admin' && Object.keys(rolePermissions).length === 0) {
    try {
      const res = await fetch(`${API_BASE}/permissions/${user.role}`);
      if (res.ok) {
          const apiPerms = (await res.json()).modules || {};
          rolePermissions = apiPerms;
          // Opcional: Sincronizar localmente
          adminService.savePermissions(user.role, apiPerms);
      }
    } catch (e) { console.error("Error permisos API:", e); }
  }

  const allowedTabs = TABS.filter(t => user.role === 'admin' || t.id === 'inicio' || rolePermissions[t.id] === 1);
  let currentTab = allowedTabs[0]?.id;

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <h2 style="font-weight:700; color:#fff;">LOGÍSTICA <span style="color:var(--primary)">DAMES1830 v11.1.25 [BETA]</span></h2>
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
    const perms = adminService.getPermissions(user.role) || {};
    
    contentArea.innerHTML = `<div id="stockSub" style="display:flex; flex-direction:column; gap:1.2rem;"></div>`;
    const sub = document.getElementById('stockSub');
    const [act, res] = await Promise.all([getAreaData('stockActivo'), getAreaData('stockReserva')]);
    
    if (user.role === 'admin' || perms['stock_stockActivo'] === 1) renderUploadArea(sub, 'stockActivo', act, '.csv');
    if (user.role === 'admin' || perms['stock_stockReserva'] === 1) renderUploadArea(sub, 'stockReserva', res, '.xlsx');

    if (sub.children.length === 0) {
        sub.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No tienes permisos para ver las áreas de Stock.</div>`;
    }
  };

  const renderUploadArea = (container, area, hasData = null, ext = '.csv') => {
    const meta = getUploadMeta(area);
    const dateStr = meta ? new Date(meta.ts).toLocaleString() : 'Nunca';
    const div = document.createElement('div');
    div.id = `wrap_${area}`;
    div.style.width = '100%';
    const label = area.toUpperCase();
    
    if (hasData) {
      div.innerHTML = `
        <div style="padding:1rem; background:rgba(34, 197, 94, 0.05); border:1px solid rgba(34, 197, 94, 0.3); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="color:var(--success); margin:0; font-size:0.95rem; font-weight:700;">✅ ${label} CARGADO</h4>
            <p style="font-size:0.8rem; margin:4px 0 0 0; color:var(--text-muted); font-weight:500;">
                ${hasData.length.toLocaleString()} registros. 
                <span style="color:#fff; background:#d97706; padding:2px 10px; border-radius:6px; margin-left:10px; font-weight:800; border:1px solid #fbbf24; display:inline-block; box-shadow:0 0 10px rgba(251,191,36,0.3);">📅 Subido: ${dateStr}</span>
            </p>
          </div>
          <label class="btn" style="width:auto; padding:0.4rem 1rem; font-size:0.8rem;"><input type="file" id="up_${area}" accept="${ext}" style="display:none;">REUBICAR</label>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="upload-area" style="padding:1.5rem; text-align:center; border: 1px dashed var(--border); border-radius:10px; background:rgba(255,255,255,0.02); display:flex; flex-direction:column; align-items:center; gap:0.6rem;">
          <h3 style="margin:0; font-size:1rem; color:var(--text-main); font-weight:700;">${label}</h3>
          <p style="font-size:0.75rem; color:#f87171; font-weight:600; margin:0;">⚠️ Sin datos en memoria</p>
          <p style="font-size:0.8rem; color:var(--text-muted); font-weight:600; margin-top:4px;">Última carga detectada: <span style="color:#fbbf24; font-weight:800; text-decoration:underline;">${dateStr}</span></p>
          <label class="btn" style="width:auto; padding:0.5rem 1.5rem; cursor:pointer; font-size:0.85rem;">SUBIR ARCHIVO <input type="file" id="up_${area}" accept="${ext}" style="display:none;"></label>
        </div>`;
    }
    container.appendChild(div);

    const input = document.getElementById(`up_${area}`);
    if(input) input.addEventListener('change', async (e) => { 
        if(e.target.files[0]) { 
            const wrap = document.getElementById(`wrap_${area}`);
            const originalContent = wrap.innerHTML;
            wrap.innerHTML = `<div style="padding:1.5rem; text-align:center; background:rgba(255,255,255,0.05); border-radius:10px; border:1px dashed var(--primary);"><div class="spinner" style="margin:0 auto 0.5rem auto; width:20px; height:20px; border:2px solid rgba(79,70,229,0.1); border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div><h4 style="margin:0; font-size:0.9rem; color:var(--primary);">⌛ PROCESANDO...</h4></div>`;
            try { 
                await parseFile(e.target.files[0], area); 
                renderTabContent(); 
            } catch(err) { 
                alert(err); 
                wrap.innerHTML = originalContent;
                renderTabContent(); 
            } 
        } 
    });
  };

  let activeBufferSub = 'reportes';
  const renderBufferTab = async () => {
    contentSubtitle.textContent = "Análisis de Reposición";
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    const stored = localStorage.getItem('lastBufferKPI');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (!parsed.detalleZonas) {
                localStorage.removeItem('lastBufferKPI');
                lastBufferKPI = null;
            } else {
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
        renderBufferTab(); 
    }));
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
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; background:rgba(255,255,255,0.03); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
              <div>
                <h4 style="color:var(--text-muted); font-weight:600; font-size:0.75rem; margin:0 0 0.5rem 0;">ESTADO DE ARCHIVOS MAESTROS:</h4>
                <div style="display:flex; gap:1rem; font-size:0.7rem; align-items:center;">
                    <span>${dataStore.buffer ? '✅' : '❌'} PEDIDOS</span>
                    <span>${dataStore.stockActivo ? '✅' : '❌'} ACTIVO</span>
                    <span>${dataStore.stockReserva ? '✅' : '❌'} RESERVA</span>
                    <button id="btn_reset_cache" title="Limpiar Memoria Si el Botón no responde" style="background:none; border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); font-size:0.65rem; padding:0.2rem 0.5rem; cursor:pointer; margin-left:1rem; border-radius:4px;">🧹 REINICIAR MEMORIA</button>
                </div>
              </div>
              <div style="text-align:right;">
                <h4 style="color:var(--text-muted); font-weight:600; font-size:0.75rem; margin:0;">Generado el: <span style="color:var(--primary);">${timeStr}</span></h4>
                <button id="btn_calc" class="btn" style="background:var(--primary); margin-top:0.5rem; width:auto; padding:0.5rem 1.2rem; border-radius:6px; font-size:0.8rem;">⚡ PROCESAR ANÁLISIS</button>
              </div>
            </div>
            <div id="resultsArea" style="display:grid; grid-template-columns: repeat(2, auto); gap:0.8rem; align-items:start; margin-left:0.5rem;"></div>
          </div>`;
        const results = document.getElementById('resultsArea');
        
        console.log("[PULSE] Vinculando botones de acción...");
        
        // ACTIVAR BOTONES PRIMERO (Prioridad Máxima)
        const btnCalc = document.getElementById('btn_calc');
        const btnReset = document.getElementById('btn_reset_cache');

        if (btnCalc) {
            btnCalc.onclick = async () => {
                console.log("[PULSE] Click Procesar Análisis");
                btnCalc.disabled = true; btnCalc.innerHTML = '⚙️ CALCULANDO...';
                results.innerHTML = `<div style="grid-column: span 2; padding:3rem; text-align:center; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:12px; border:1px dashed var(--border);"><div class="spinner" style="margin:0 auto 1rem auto; width:30px; height:30px; border:3px solid rgba(79,70,229,0.1); border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div><h3 style="font-size:0.9rem; margin:0;">Iniciando Motor de Análisis...</h3><p style="font-size:0.75rem; margin-top:0.5rem;">Cargando archivos maestros desde memoria local.</p></div>`;

                setTimeout(async () => {
                    try {
                        const config = await fetchBufferConfig().catch(() => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' }));
                        const res = calculateBufferPallets(config);
                        if (res) {
                            lastBufferKPI = res;
                            localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                            renderBufferResults(results, res); 
                            const saved = await saveBufferReport(res, user.username);
                            console.log(saved ? '✅ Sincronizado' : '⚠️ Solo Local');
                        } else {
                            alert('⚠️ ERROR: Faltan archivos maestros.');
                        }
                    } catch (err) {
                        console.error("Error en proceso:", err);
                        alert("Error crítico: " + err.message);
                    } finally {
                        btnCalc.disabled = false; btnCalc.innerHTML = '⚡ PROCESAR ANÁLISIS';
                    }
                }, 500);
            };
        }

        if (btnReset) {
            btnReset.onclick = () => {
                if(confirm('¿REINICIAR TODA LA MEMORIA?\n\nEsto borrará todos los archivos cargados localmente para solucionar bloqueos.')) {
                    Object.keys(localStorage).forEach(k => { if(k.startsWith('logistics_')) localStorage.removeItem(k); });
                    localStorage.removeItem('lastBufferKPI');
                    window.location.reload();
                }
            };
        }

        // CARGAR RESULTADOS CACHEADOS AL FINAL (Protección contra fallos)
        if (lastBufferKPI) {
            try {
                renderBufferResults(results, lastBufferKPI);
            } catch (err) {
                console.warn("[PULSE] Error cargando caché de resultados (incompatible), ignorando...", err);
                localStorage.removeItem('lastBufferKPI');
                results.innerHTML = '';
            }
        }
    }
  };

  const renderBufferResults = (container, data) => {
    const tableWidth = '450px';
    container.innerHTML = `
        <!-- FILA 1: ZONAS + GENDER -->
        <div style="background:rgba(15,23,42,0.9); border:2px solid #4f46e5; border-radius:12px; overflow:hidden; width:${tableWidth}; max-width:100%; box-shadow: 0 0 15px rgba(79,70,229,0.4);">
            <div style="padding:0.7rem; background:rgba(79,70,229,0.1); border-bottom:1px solid rgba(79,70,229,0.3); text-align:center;"><h3 style="color:#fff; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px;">ANÁLISIS BUFFER ZONAS</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.8rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(79,70,229,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">NIVEL/AREA</th><th style="padding:0.6rem 1rem; text-align:center;">RQ</th><th style="padding:0.6rem 1rem; text-align:center;">ATD</th><th style="padding:0.6rem 1rem; text-align:center;">%</th></tr></thead>
                <tbody style="color:#eee;">${data.waterfall.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.nivel==='Total'?'background:rgba(79,70,229,0.08); font-weight:900;':''}">
                    <td style="padding:0.5rem 1rem; color:${r.nivel==='Total'?'#22c55e':'inherit'};">${r.nivel}</td>
                    <td style="padding:0.5rem 1rem; text-align:center;">${r.rq.toLocaleString()}</td>
                    <td style="padding:0.5rem 1rem; text-align:center; color:${r.atd > 0 ? '#fff' : '#64748b'};">${r.atd.toLocaleString()}</td>
                    <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e;">${r.pct}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>

        <div style="background:rgba(15,23,42,0.9); border:2px solid #ec4899; border-radius:12px; overflow:hidden; width:${tableWidth}; max-width:100%; box-shadow: 0 0 15px rgba(236,72,153,0.3);">
            <div style="padding:0.7rem; background:rgba(236,72,153,0.1); border-bottom:1px solid rgba(236,72,153,0.3); text-align:center;"><h3 style="color:#ec4899; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px;">DISCREPANCIAS GENDER (Zonas 3,4,5)</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.8rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(236,72,153,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">GENDER</th><th style="padding:0.6rem 1rem; text-align:center;">RQ</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenGender.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.key==='TOTAL'?'background:rgba(236,72,153,0.08); font-weight:900;':''}">
                    <td style="padding:0.5rem 1rem;">${r.key}</td>
                    <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e; font-weight:900;">${r.rq.toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>

        <!-- FILA 2: SKU + MARCAS -->
        <div style="background:rgba(15,23,42,0.9); border:2px solid #f59e0b; border-radius:12px; overflow:hidden; width:${tableWidth}; max-width:100%; box-shadow: 0 0 15px rgba(245,158,11,0.3);">
            <div style="padding:0.7rem; background:rgba(245,158,11,0.1); border-bottom:1px solid rgba(245,158,11,0.3); text-align:center;"><h3 style="color:#f59e0b; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px;">ANÁLISIS BUFFER SKU</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.8rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(245,158,11,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">TIPO</th><th style="padding:0.6rem 1rem; text-align:center;">PAL</th><th style="padding:0.6rem 1rem; text-align:center;">SKU</th><th style="padding:0.6rem 1rem; text-align:center;">PAR</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenSKU.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.tipo==='TOTAL'?'background:rgba(245,158,11,0.08); font-weight:900;':''}">
                    <td style="padding:0.5rem 1rem;">${r.tipo}</td>
                    <td style="padding:0.5rem 1rem; text-align:center;">${r.paletas}</td>
                    <td style="padding:0.5rem 1rem; text-align:center;">${r.skus}</td>
                    <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e;">${Number(r.parcaja).toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>

        <div style="background:rgba(15,23,42,0.9); border:2px solid #06b6d4; border-radius:12px; overflow:hidden; width:${tableWidth}; max-width:100%; box-shadow: 0 0 15px rgba(6,182,212,0.3);">
            <div style="padding:0.7rem; background:rgba(6,182,212,0.1); border-bottom:1px solid rgba(6,182,212,0.3); text-align:center;"><h3 style="color:#06b6d4; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px;">DISCREPANCIAS MARCAS (Zonas 3,4,5)</h3></div>
            <table style="border-collapse:collapse; width:100%; font-size:0.8rem;">
                <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(6,182,212,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">MARCA</th><th style="padding:0.6rem 1rem; text-align:center;">RQ</th></tr></thead>
                <tbody style="color:#eee;">${data.resumenMarca.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.key==='TOTAL'?'background:rgba(6,182,212,0.08); font-weight:900;':''}">
                    <td style="padding:0.5rem 1rem;">${r.key}</td>
                    <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e; font-weight:900;">${r.rq.toLocaleString()}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>

        <div style="grid-column: span 2; display:flex; gap:1rem; margin-top:0.5rem;">
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
            exportToExcel(data.detalle, 'Analisis_SKU_V82');
        }
    });
  };

  let activeAdminSub = 'trabajadores';  const renderAdminTab = () => {
    const adminTabDef = TABS.find(t => t.id === 'admin_pers');
    const rolePerms = adminService.getPermissions(user.role) || {};
    
    // Filtrar sub-pestañas permitidas
    const allowedSubTabs = adminTabDef.subTabs.filter(sub => {
        if (user.role === 'admin') return true;
        const key = `admin_pers_${sub.id}`;
        return rolePerms[key] === 1;
    });

    // Si la sub-pestaña actual no está permitida, ir a la primera disponible
    if (!allowedSubTabs.find(s => s.id === activeAdminSub)) {
        activeAdminSub = allowedSubTabs[0]?.id || '';
    }

    if (!activeAdminSub) {
        contentArea.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No tienes permisos para acceder a las secciones de Administración.</div>`;
        return;
    }

    contentArea.innerHTML = `
        <nav class="sub-nav" style="display:flex; gap:1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem; overflow-x:auto;">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAdminSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; white-space:nowrap; cursor:pointer;">
              ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="adminContent"></div>`;
    
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeAdminSub = e.currentTarget.dataset.s; 
        renderAdminTab(); 
    }));

    const adminContainer = document.getElementById('adminContent');
    
    if (activeAdminSub === 'trabajadores') renderTrabajadoresSection(adminContainer);
    else if (activeAdminSub === 'usuarios') renderUsuariosSection(adminContainer);
    else if (activeAdminSub === 'permisos') renderPermisosSection(adminContainer);
    else if (activeAdminSub === 'asistencia') renderAsistenciaSection(adminContainer);
    else if (activeAdminSub === 'performance') renderPerformanceSection(adminContainer);
    else if (activeAdminSub === 'rfs') renderRFSection(adminContainer);
  };

  const renderTrabajadoresSection = (container) => {
    const workers = adminService.getWorkers();
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 300px; gap:1.5rem;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem;">
                    <h3 style="color:var(--primary); margin:0;">Base de Datos de Trabajadores</h3>
                    <label class="btn" style="width:auto; background:var(--success); font-size:0.75rem; padding:0.4rem 0.8rem;">
                        📥 IMPORTAR EXCEL <input type="file" id="import_workers" accept=".xlsx,.xls" style="display:none;">
                    </label>
                </div>
                <div class="glass-panel" style="padding:0; overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                        <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                            <tr>
                                <th style="padding:0.7rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                                <th style="padding:0.7rem; text-align:left;">Estado</th>
                                <th style="padding:0.7rem; text-align:left;">DNI</th>
                                <th style="padding:0.7rem; text-align:left;">Nombre</th>
                                <th style="padding:0.7rem; text-align:left;">Apellidos</th>
                                <th style="padding:0.7rem; text-align:left;">Puesto</th>
                                <th style="padding:0.7rem; text-align:left;">Turno</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workers.length ? workers.map((w, idx) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); opacity: ${w.active === false ? '0.5' : '1'}">
                                    <td style="padding:0.7rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                                    <td style="padding:0.7rem; text-align:center;">
                                        <button class="btn-worker-status" data-dni="${w.dni || w.Dni}" title="${w.active === false ? 'Activar' : 'Desactivar'}" style="background:none; border:none; cursor:pointer; font-size:1rem;">
                                            ${w.active === false ? '❌' : '✅'}
                                        </button>
                                    </td>
                                    <td style="padding:0.7rem; font-weight:800; color:#fff;">${w.dni || w.Dni || ''}</td>
                                    <td style="padding:0.7rem;">${w.nombre || w.Nombre || ''}</td>
                                    <td style="padding:0.7rem;">${w.apellidos || w.Apellidos || ''}</td>
                                    <td style="padding:0.7rem;">${w.puesto || w.Puesto || ''}</td>
                                    <td style="padding:0.7rem;"><span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.65rem;">${w.turno || w.Turno || ''}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">No hay trabajadores cargados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="glass-panel" style="background:rgba(79, 70, 229, 0.05); border-color:rgba(79, 70, 229, 0.2);">
                <h4 style="margin:0 0 1rem 0; color:#fff; font-size:0.9rem;">➕ Nuevo Trabajador</h4>
                <form id="form_new_worker" style="display:flex; flex-direction:column; gap:0.8rem;">
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">DNI</label>
                        <input type="text" id="nw_dni" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">NOMBRE</label>
                        <input type="text" id="nw_nombre" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">APELLIDOS</label>
                        <input type="text" id="nw_apellidos" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">PUESTO</label>
                        <input type="text" id="nw_puesto" required style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.3rem;">
                        <label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TURNO</label>
                        <select id="nw_turno" style="background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; color:#fff; padding:0.5rem; outline:none; font-size:0.8rem;">
                            <option value="DIA" style="background:#0f172a;">DIA</option>
                            <option value="NOCHE" style="background:#0f172a;">NOCHE</option>
                        </select>
                    </div>
                    <button type="submit" class="btn" style="background:var(--primary); margin-top:0.5rem; padding:0.6rem; font-size:0.8rem; font-weight:800;">GUARDAR TRABAJADOR</button>
                </form>
            </div>
        </div>
    `;

    // Listeners
    document.getElementById('form_new_worker').onsubmit = (e) => {
        e.preventDefault();
        const nw = {
            dni: document.getElementById('nw_dni').value.trim(),
            nombre: document.getElementById('nw_nombre').value.toUpperCase().trim(),
            apellidos: document.getElementById('nw_apellidos').value.toUpperCase().trim(),
            puesto: document.getElementById('nw_puesto').value.toUpperCase().trim(),
            turno: document.getElementById('nw_turno').value
        };
        adminService.saveWorker(nw);
        renderAdminTab();
    };

    document.querySelectorAll('.btn-worker-status').forEach(btn => {
        btn.onclick = () => {
            adminService.toggleWorkerStatus(btn.dataset.dni);
            renderAdminTab();
        };
    });

    document.getElementById('import_workers').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            // Normalizar las llaves a minúsculas para consistencia (DNI/Dni/dni -> dni)
            const normalized = json.map(row => {
                const newRow = {};
                for (let key in row) {
                    newRow[key.toLowerCase().trim()] = row[key];
                }
                return newRow;
            });

            adminService.saveWorkers(normalized);
            renderAdminTab();
        };
        reader.readAsArrayBuffer(file);
    });
  };

  const renderUsuariosSection = (container) => {
    const users = adminService.getUsers();
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 300px; gap:1.5rem;">
            <div>
                <h3 style="color:var(--primary); margin-bottom:1rem;">Usuarios de la Plataforma</h3>
                <div class="glass-panel" style="padding:0; overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead style="background:rgba(255,255,255,0.05);">
                            <tr>
                                <th style="padding:0.8rem; text-align:left;">Estado</th>
                                <th style="padding:0.8rem; text-align:left;">Nombre</th>
                                <th style="padding:0.8rem; text-align:left;">Usuario</th>
                                <th style="padding:0.8rem; text-align:left;">Rol</th>
                                <th style="padding:0.8rem; text-align:center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.length ? users.map(u => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.02); opacity: ${u.active === false ? '0.5' : '1'}">
                                    <td style="padding:0.8rem; text-align:center;">
                                        <button class="btn-status" data-user="${u.username}" title="${u.active === false ? 'Activar' : 'Desactivar'}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">
                                            ${u.active === false ? '❌' : '✅'}
                                        </button>
                                    </td>
                                    <td style="padding:0.8rem; font-weight:600;">${u.name}</td>
                                    <td style="padding:0.8rem; color:var(--text-muted);">${u.username}</td>
                                    <td style="padding:0.8rem;"><span style="background:rgba(79,70,229,0.2); color:#a5b4fc; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">${u.role.toUpperCase()}</span></td>
                                    <td style="padding:0.8rem; text-align:center;">
                                        <div style="display:flex; gap:0.8rem; justify-content:center;">
                                            <button class="btn-edit" data-user='${JSON.stringify(u)}' title="Editar" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:1rem;">✏️</button>
                                            <button class="btn-del" data-user="${u.username}" title="Eliminar" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:1rem;">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="padding:1rem; text-align:center; color:var(--text-muted);">No hay usuarios adicionales creados.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h3 style="color:var(--primary); margin-bottom:1rem;" id="form_title">Nuevo Usuario</h3>
                <div class="glass-panel" style="padding:1.2rem; border-color:rgba(255,255,255,0.1);">
                    <form id="form_user" style="display:flex; flex-direction:column; gap:0.8rem;" autocomplete="off">
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">NOMBRE COMPLETO:</label>
                            <input type="text" id="u_name" placeholder="Ej: Juan Pérez" autocomplete="off" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">USUARIO (LOGIN):</label>
                            <input type="text" id="u_username" placeholder="Ej: jperez" autocomplete="one-time-code" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">CONTRASEÑA:</label>
                            <input type="password" id="u_pass" placeholder="••••••••" autocomplete="new-password" style="width:100%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:0.6rem; border-radius:6px; outline:none;" required>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px; display:block;">ROL ASIGNADO:</label>
                            <select id="u_role" style="width:100%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3); color:#fff; padding:0.6rem; border-radius:6px; outline:none; cursor:pointer;">
                                <option value="admin" style="background:#1e293b;">ADMIN</option>
                                <option value="jefe" style="background:#1e293b;">JEFE</option>
                                <option value="supervisor" style="background:#1e293b;">SUPERVISOR</option>
                                <option value="encargado" style="background:#1e293b;">ENCARGADO</option>
                                <option value="asistente" style="background:#1e293b;">ASISTENTE</option>
                            </select>
                        </div>
                        <button type="submit" id="btn_submit_user" class="btn" style="padding:0.7rem; font-weight:700; margin-top:0.5rem;">GUARDAR USUARIO</button>
                        <button type="button" id="btn_cancel_edit" style="display:none; background:none; border:none; color:var(--text-muted); font-size:0.75rem; cursor:pointer; text-decoration:underline;">Cancelar edición</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById('form_user');
    const uName = document.getElementById('u_name');
    const uUser = document.getElementById('u_username');
    const uPass = document.getElementById('u_pass');
    const uRole = document.getElementById('u_role');
    const uTitle = document.getElementById('form_title');
    const btnSubmit = document.getElementById('btn_submit_user');
    const btnCancel = document.getElementById('btn_cancel_edit');

    let isEditing = false;

    form.onsubmit = (e) => {
        e.preventDefault();
        const newUser = {
            name: uName.value,
            username: uUser.value,
            password: uPass.value,
            role: uRole.value
        };
        adminService.saveUser(newUser);
        alert(isEditing ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
        form.reset();
        if (isEditing) {
            uUser.readOnly = false;
            uUser.style.opacity = '1';
            uTitle.textContent = "Nuevo Usuario";
            btnSubmit.textContent = "GUARDAR USUARIO";
            btnCancel.style.display = 'none';
            isEditing = false;
        }
        renderAdminTab();
    };

    document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = (e) => {
        const u = JSON.parse(e.currentTarget.dataset.user);
        uName.value = u.name;
        uUser.value = u.username;
        uUser.readOnly = true; // No permitir cambiar el login
        uUser.style.opacity = '0.5';
        uPass.value = u.password;
        uRole.value = u.role;
        
        uTitle.textContent = "Editar Usuario";
        btnSubmit.textContent = "ACTUALIZAR DATOS";
        btnCancel.style.display = 'block';
        isEditing = true;
    });

    btnCancel.onclick = () => {
        form.reset();
        uUser.readOnly = false;
        uUser.style.opacity = '1';
        uTitle.textContent = "Nuevo Usuario";
        btnSubmit.textContent = "GUARDAR USUARIO";
        btnCancel.style.display = 'none';
        isEditing = false;
    };

    document.querySelectorAll('.btn-status').forEach(btn => btn.onclick = () => {
        adminService.toggleUserStatus(btn.dataset.user);
        renderAdminTab();
    });

    document.querySelectorAll('.btn-del').forEach(btn => btn.onclick = () => {
        if (confirm('¿Estás seguro de eliminar permanentemente este usuario?')) {
            adminService.deleteUser(btn.dataset.user);
            renderAdminTab();
        }
    });
  };

  const renderPermisosSection = (container) => {
    const roles = ['jefe', 'supervisor', 'encargado', 'asistente'];
    const allRoles = ['admin', ...roles];
    
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="color:var(--primary); margin:0;">Matriz de Permisos Dinámica</h3>
            <span style="font-size:0.7rem; color:var(--success); font-weight:600;">✨ Haz clic en un módulo para expandir sus sub-pestañas</span>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">
                        <th style="padding:1rem; text-align:left; border-right:1px solid var(--border);">MÓDULO / SECCIÓN</th>
                        ${allRoles.map(r => `<th style="padding:1rem; text-align:center;">${r.toUpperCase()}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${TABS.map(t => {
                        let rows = [];
                        const hasSub = t.subTabs && t.subTabs.length > 0;
                        
                        // Fila principal
                        rows.push(`
                        <tr class="main-tab-row" data-tab-id="${t.id}" style="border-bottom:1px solid rgba(255,255,255,0.02); background:rgba(255,255,255,0.02); cursor:${hasSub ? 'pointer' : 'default'};">
                            <td style="padding:0.8rem; font-weight:700; border-right:1px solid var(--border); color:#fff; display:flex; align-items:center; gap:8px;">
                                ${hasSub ? '<span class="toggle-icon">▶</span>' : ''}
                                ${t.icon} ${t.label}
                            </td>
                            ${allRoles.map(r => {
                                let hasAccess = false;
                                if (r === 'admin') hasAccess = true;
                                else {
                                    const perms = adminService.getPermissions(r);
                                    hasAccess = perms ? perms[t.id] === 1 : t.roles.includes(r);
                                }
                                const isFixed = r === 'admin' || t.id === 'inicio';
                                return `
                                <td style="padding:0.8rem; text-align:center;">
                                    <input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${t.id}" ${hasAccess ? 'checked' : ''} ${isFixed ? 'disabled title="Protegido"' : 'style="cursor:pointer;"'}>
                                </td>`;
                            }).join('')}
                        </tr>`);

                        // Filas de sub-pestañas
                        if (hasSub) {
                            t.subTabs.forEach(sub => {
                                const subKey = `${t.id}_${sub.id}`;
                                rows.push(`
                                <tr class="sub-row-${t.id}" style="border-bottom:1px solid rgba(255,255,255,0.01); display:none; background:rgba(255,255,255,0.01);">
                                    <td style="padding:0.6rem 0.8rem 0.6rem 2.5rem; font-style:italic; color:var(--text-muted); border-right:1px solid var(--border);">${sub.icon} ${sub.label}</td>
                                    ${allRoles.map(r => {
                                        let hasSubAccess = false;
                                        if (r === 'admin') hasSubAccess = true;
                                        else {
                                            const perms = adminService.getPermissions(r);
                                            hasSubAccess = perms ? perms[subKey] === 1 : t.roles.includes(r);
                                        }
                                        const isFixed = r === 'admin';
                                        return `
                                        <td style="padding:0.6rem; text-align:center;">
                                            <input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${subKey}" ${hasSubAccess ? 'checked' : ''} ${isFixed ? 'disabled' : 'style="cursor:pointer; opacity:0.7;"'}>
                                        </td>`;
                                    }).join('')}
                                </tr>`);
                            });
                        }
                        return rows.join('');
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:1rem; padding:1rem; background:rgba(79,70,229,0.05); border-radius:8px; border:1px solid rgba(79,70,229,0.2);">
            <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">
                <b>Tip:</b> Haz clic en los módulos con el icono ▶ para ver y restringir sus secciones internas. 
                Los cambios se guardan automáticamente y afectan la visibilidad de los menús al instante.
            </p>
        </div>
    `;

    // Lógica de Acordeón
    document.querySelectorAll('.main-tab-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return; // No colapsar si hace clic en checkbox
            
            const tabId = row.dataset.tabId;
            const subRows = document.querySelectorAll(`.sub-row-${tabId}`);
            if (subRows.length === 0) return;
            
            const icon = row.querySelector('.toggle-icon');
            const isVisible = subRows[0].style.display !== 'none';
            
            subRows.forEach(sr => sr.style.display = isVisible ? 'none' : 'table-row');
            if(icon) icon.textContent = isVisible ? '▶' : '▼';
            row.style.background = isVisible ? 'rgba(255,255,255,0.02)' : 'rgba(79,70,229,0.05)';
        });
    });

    document.querySelectorAll('.perm-toggle:not(:disabled)').forEach(cb => {
        cb.onchange = (e) => {
            const { role, tab } = e.target.dataset;
            adminService.togglePermission(role, tab);
            console.log(`[PULSE] Permiso actualizado: ${role} -> ${tab}`);
        };
    });
  };

  const renderAsistenciaSection = (container) => {
    const workers = adminService.getWorkers().filter(w => w.active !== false);
    const today = new Date().toISOString().split('T')[0];
    const existing = adminService.getAttendance(today);
    
    // Formatear fecha legible con nombre del día
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = new Date().toLocaleDateString('es-ES', dateOptions);

    if (!workers.length) {
        container.innerHTML = `<div style="padding:3rem; text-align:center;"><p style="color:var(--text-muted);">Debes importar o registrar <b>Trabajadores Activos</b> antes de tomar asistencia.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div style="background:rgba(255,255,255,0.03); padding:0.8rem 1.2rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05); box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                <h3 style="color:var(--primary); margin:0; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px;">Asistencia Diaria</h3>
                <p style="font-size:0.85rem; color:#fff; margin:4px 0 0 0; font-weight:600; text-transform:capitalize;">🗓️ ${dateFormatted}</p>
            </div>
            ${existing?.finalized ? '<span style="background:var(--success); color:#000; padding:0.6rem 1.2rem; border-radius:8px; font-weight:900; font-size:0.85rem; box-shadow:0 0 15px rgba(34,197,94,0.3);">✅ ASISTENCIA CERRADA</span>' : `
                <button id="btn_close_asist" class="btn" style="width:auto; background:var(--primary); padding:0.6rem 1.5rem; font-size:0.85rem; font-weight:800; border-radius:8px; box-shadow:0 0 15px rgba(79,70,229,0.4);">💾 CERRAR ASISTENCIA DEL DÍA</button>
            `}
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                    <tr>
                        <th style="padding:0.8rem; text-align:center; width:50px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                        <th style="padding:0.8rem; text-align:left;">DNI</th>
                        <th style="padding:0.8rem; text-align:left;">Apellidos y Nombres</th>
                        <th style="padding:0.8rem; text-align:center;">Estado</th>
                        <th style="padding:0.8rem; text-align:center;">Puntualidad</th>
                    </tr>
                </thead>
                <tbody>
                    ${workers.map((w, idx) => {
                        const rec = existing?.data?.find(d => d.dni === (w.dni || w.Dni));
                        const isPresent = rec ? rec.present : true;
                        const isOnTime = rec ? rec.onTime : true;
                        return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                            <td style="padding:0.8rem; color:#fff; font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">${w.dni || w.Dni || ''}</td>
                            <td style="padding:0.8rem; font-weight:600;">${w.apellidos || w.Apellidos || ''}, ${w.nombre || w.Nombre || ''}</td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button class="btn-att ${isPresent ? 'active' : ''}" data-dni="${w.dni || w.Dni}" data-v="true" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isPresent?'var(--success)':'none'}; color:${isPresent?'#000':'#fff'}; font-size:0.7rem; cursor:pointer;" ${existing?.finalized ? 'disabled' : ''}>P</button>
                                    <button class="btn-att ${!isPresent ? 'active' : ''}" data-dni="${w.dni || w.Dni}" data-v="false" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isPresent?'#ef4444':'none'}; color:${!isPresent?'#fff':'#fff'}; font-size:0.7rem; cursor:pointer;" ${existing?.finalized ? 'disabled' : ''}>F</button>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button class="btn-ontime ${isOnTime ? 'active' : ''}" data-dni="${w.dni || w.Dni}" data-v="true" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isOnTime?'#06b6d4':'none'}; color:#fff; font-size:0.7rem; cursor:pointer; opacity:${isPresent?'1':'0.3'}; pointer-events:${isPresent?'auto':'none'}" ${existing?.finalized ? 'disabled' : ''}>SÍ</button>
                                    <button class="btn-ontime ${!isOnTime ? 'active' : ''}" data-dni="${w.dni || w.Dni}" data-v="false" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isOnTime?'#f97316':'none'}; color:#fff; font-size:0.7rem; cursor:pointer; opacity:${isPresent?'1':'0.3'}; pointer-events:${isPresent?'auto':'none'}" ${existing?.finalized ? 'disabled' : ''}>NO</button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (!existing?.finalized) {
        let localState = workers.map(w => ({ 
            dni: (w.dni || w.Dni), 
            nombre: (w.nombre || w.Nombre), 
            apellidos: (w.apellidos || w.Apellidos), 
            present: true,
            onTime: true
        }));

        document.querySelectorAll('.btn-att').forEach(btn => btn.onclick = (e) => {
            const dni = e.target.dataset.dni;
            const val = e.target.dataset.v === 'true';
            const node = localState.find(s => s.dni === dni);
            if (node) {
                node.present = val;
                if (!val) node.onTime = false; // Si falta, no es puntual
            }
            
            // UI Toggle
            renderAsistenciaUI(dni, localState);
        });

        document.querySelectorAll('.btn-ontime').forEach(btn => btn.onclick = (e) => {
            const dni = e.target.dataset.dni;
            const val = e.target.dataset.v === 'true';
            const node = localState.find(s => s.dni === dni);
            if (node && node.present) node.onTime = val;
            
            renderAsistenciaUI(dni, localState);
        });

        const renderAsistenciaUI = (dni, state) => {
            const node = state.find(s => s.dni === dni);
            const attBtns = document.querySelectorAll(`.btn-att[data-dni="${dni}"]`);
            const otBtns = document.querySelectorAll(`.btn-ontime[data-dni="${dni}"]`);

            attBtns.forEach(b => {
                const isP = b.dataset.v === 'true';
                b.style.background = (isP === node.present && node.present) ? 'var(--success)' : (isP === node.present && !node.present) ? '#ef4444' : 'none';
                b.style.color = (isP === node.present && node.present) ? '#000' : '#fff';
            });

            otBtns.forEach(b => {
                const isT = b.dataset.v === 'true';
                b.style.opacity = node.present ? '1' : '0.3';
                b.style.pointerEvents = node.present ? 'auto' : 'none';
                b.style.background = (isT === node.onTime && node.onTime) ? '#06b6d4' : (isT === node.onTime && !node.onTime) ? '#f97316' : 'none';
            });
        };

        document.getElementById('btn_close_asist').onclick = () => {
            if (confirm('¿Cerrar asistencia? Estos datos se enviarán a Performance.')) {
                adminService.closeAttendanceAndSyncPerformance(today, localState);
                renderAdminTab();
            }
        };
    }
  };

  const renderPerformanceSection = (container) => {
    const perf = adminService.getPerformance();
    container.innerHTML = `
        <h3 style="color:var(--primary); margin-bottom:1rem;">Reporte de Performance</h3>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                    <tr>
                        <th style="padding:0.8rem; text-align:center; width:45px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                        <th style="padding:0.8rem; text-align:left;">TRABAJADOR / DNI</th>
                        <th style="padding:0.8rem; text-align:center;">ASISTENCIAS</th>
                        <th style="padding:0.8rem; text-align:center;">PUNTUALIDAD</th>
                        <th style="padding:0.8rem; text-align:center;">PRODUCCIÓN</th>
                        <th style="padding:0.8rem; text-align:center;">BPA</th>
                        <th style="padding:0.8rem; text-align:center;">SUPERVISOR</th>
                    </tr>
                </thead>
                <tbody>
                    ${perf.length ? perf.map((p, idx) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                            <td style="padding:0.8rem;"><b>${p.apellidos}, ${p.nombre}</b><br><small style="color:#fff; font-weight:800;">${p.dni}</small></td>
                            <td style="padding:0.8rem; text-align:center; color:var(--success); font-weight:700;">${p.asistencia}</td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);"><input type="text" value="${p.puntualidad}" data-dni="${p.dni}" data-f="puntualidad" class="edit-perf" style="width:60px; background:none; border:none; color:#fff; text-align:center; font-weight:700;"></td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);"><input type="text" value="${p.produccion}" data-dni="${p.dni}" data-f="produccion" class="edit-perf" style="width:60px; background:none; border:none; color:#fff; text-align:center;"></td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);"><input type="text" value="${p.bpa}" data-dni="${p.dni}" data-f="bpa" class="edit-perf" style="width:60px; background:none; border:none; color:#fff; text-align:center;"></td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);"><input type="text" value="${p.supervisor}" data-dni="${p.dni}" data-f="supervisor" class="edit-perf" style="width:80px; background:none; border:none; color:#fff; text-align:center;"></td>
                        </tr>
                    `).join('') : '<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted);">No hay datos de performance registrados aún. Cierra una asistencia para empezar.</td></tr>'}
                </tbody>
            </table>
        </div>
        <p style="font-size:0.7rem; color:var(--text-muted); margin-top:0.8rem;">* Los campos en las celdas blancas son editables manualmente. El DNI ahora es más visible.</p>
    `;

    document.querySelectorAll('.edit-perf').forEach(input => input.onchange = (e) => {
        const dni = e.target.dataset.dni;
        const field = e.target.dataset.f;
        const val = e.target.value;
        adminService.updatePerformanceEntry(dni, { [field]: val });
    });
  };

  const renderRFSection = (container) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3 style="color:var(--primary); margin:0;">Gestión de Equipos RF</h3>
            <button class="btn" style="width:auto; background:var(--primary); padding:0.5rem 1.2rem; font-size:0.8rem;">➕ REGISTRAR EQUIPO</button>
        </div>
        <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
            <div style="margin-bottom:1.5rem;">
                 <span style="font-size:3rem; opacity:0.3;">🔋</span>
            </div>
            <h4 style="color:#fff;">Módulo de Equipos RF (Mantenimiento)</h4>
            <p style="font-size:0.85rem; max-width:400px; margin:0.5rem auto;">Próximamente podrás gestionar números de serie, asignaciones diarias y estado de baterías de los terminales RF.</p>
        </div>
    `;
  };

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
