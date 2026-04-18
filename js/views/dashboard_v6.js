import { logout } from '../services/auth.js';
import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter } from '../services/csvHub_v6.js?v=6.9';

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
          <div>
            <h1 id="contentTitle" style="color:var(--primary); font-size:2rem; font-weight:800;">Cargando...</h1>
            <p id="contentSubtitle" style="color:var(--text-muted); font-size:0.9rem;">Analizando base de datos centralizada</p>
          </div>
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
    navContainer.innerHTML = allowedTabs.map(t => `
      <a class="nav-item ${t.id === currentTab ? 'active' : ''}" data-id="${t.id}">
        <span style="font-size:1.2rem; margin-right:8px;">${t.icon}</span> ${t.label}
      </a>
    `).join('');
    
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.id;
      renderNav(); renderTabContent();
    }));
  };

  const renderTabContent = async () => {
    const tabObj = allowedTabs.find(t => t.id === currentTab);
    const dateTag = currentDateFilter ? ` <span style="font-size:0.8rem; background:var(--warning); color:#000; padding:2px 10px; border-radius:12px; font-weight:600;">Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = tabObj.label + dateTag;
    
    if(currentChart) { currentChart.destroy(); currentChart = null; }
    
    // Espaciado animado
    contentArea.innerHTML = `
      <div style="text-align:center; padding:5rem; color:var(--text-muted); opacity:0.7;">
         <i class="fas fa-circle-notch fa-spin fa-3x" style="color:var(--primary); margin-bottom:1rem;"></i>
         <p>Sincronizando con Servidor Maestro...</p>
      </div>
    `;

    if (currentTab === 'inicio') await renderHomeTab();
    else if (currentTab === 'stock') await renderStockTab();
    else if (currentTab === 'buffer') await renderBufferTab();
    else if (currentTab === 'config') await renderConfigTab();
    else {
      contentSubtitle.textContent = `Visualización Analítica del Área ${tabObj.label}`;
      const data = await getAreaData(currentTab);
      if (!data) renderUploadArea(contentArea, currentTab);
      else renderDashboardView(contentArea, data);
    }
  };

  const renderHomeTab = async () => {
    contentSubtitle.textContent = "Control Global de Operaciones Logísticas";
    contentArea.innerHTML = `<div class="kpi-grid" id="homeKpiGrid"></div>`;
    const areas = ['stockActivo', 'stockReserva', 'buffer', 'picking', 'packing', 'despacho'];
    
    areas.forEach(a => {
        getAreaData(a).then(rows => {
            const grid = document.getElementById('homeKpiGrid');
            if(!grid) return;
            const count = rows ? rows.length : 0;
            grid.innerHTML += `
               <div class="kpi-card" style="border-left: 4px solid var(--primary); background:rgba(255,255,255,0.02);">
                  <div class="kpi-title">${a.replace('stock', 'STOCK ').toUpperCase()}</div>
                  <div class="kpi-value" style="color:${count>0?'var(--primary)':'var(--text-muted)'};">${count.toLocaleString()}</div>
                  <div class="kpi-subtitle">Registros en Tiempo Real</div>
               </div>
            `;
        }).catch(e => console.error(e));
    });
  };

  const renderStockTab = async () => {
    contentSubtitle.textContent = "Gestión de Existencias Físicas y de Reserva";
    contentArea.innerHTML = `<div id="stockSub" style="display:flex; flex-direction:column; gap:2rem;"></div>`;
    const sub = document.getElementById('stockSub');
    const [act, res] = await Promise.all([getAreaData('stockActivo'), getAreaData('stockReserva')]);
    renderUploadArea(sub, 'stockActivo', act, '.csv');
    renderUploadArea(sub, 'stockReserva', res, '.xlsx');
    
    // Si tenemos ambos, mostrar botón de "Ir a Buffer"
    if(act && res) {
        sub.innerHTML += `
          <div style="padding:2rem; background:rgba(79,70,229,0.05); border-radius:12px; text-align:center; border:1px dashed var(--primary);">
            <p style="margin-bottom:1rem; color:var(--text-muted);">Stock físico indexado correctamente. ¿Deseas analizar la reposición?</p>
            <button class="btn" style="width:auto; padding:0.8rem 3rem;" onclick="document.querySelector('[data-id=buffer]').click()">⚡ IR A ZONA BUFFER</button>
          </div>
        `;
    }
  };

  const renderUploadArea = (container, area, hasData = null, ext = '.csv') => {
    const div = document.createElement('div');
    div.style.width = '100%';
    
    if (hasData) {
      div.innerHTML = `
        <div style="padding:1.5rem; background:rgba(34, 197, 94, 0.08); border:1px solid var(--success); border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
           <div>
              <h4 style="color:var(--success); font-weight:700;">✅ ${area.toUpperCase()} CARGADO</h4>
              <p style="font-size:0.8rem; color:var(--text-muted);">${hasData.length.toLocaleString()} registros en el servidor.</p>
           </div>
           <label class="btn" style="width:auto; background:transparent; border:1px solid var(--border); color:var(--text-main); font-size:0.75rem; padding:0.4rem 1rem; cursor:pointer;">
             RE-SUBIR <input type="file" id="up_${area}" accept="${ext}" style="display:none;">
           </label>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="upload-area" id="drop_${area}">
           <i class="fas fa-cloud-upload-alt fa-2x" style="color:var(--primary); margin-bottom:1rem;"></i>
           <h3 style="margin-bottom:0.5rem; color:#fff;">Carga de ${area.toUpperCase()}</h3>
           <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">Sube el archivo ${ext} diario para alojarlo en la base de datos nacional.</p>
           <label class="btn" style="width:auto; padding:0.6rem 2rem; cursor:pointer;">
             CARGAR ARCHIVO <input type="file" id="up_${area}" accept="${ext}" style="display:none;">
           </label>
        </div>
      `;
    }
    container.appendChild(div);
    const input = document.getElementById(`up_${area}`);
    if(input) input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const ogText = input.parentElement.innerText;
        input.parentElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
        try {
            await parseFile(file, area);
            renderTabContent();
        } catch(err) { alert('Error: ' + err); renderTabContent(); }
    });
  };

  let activeBufferSub = 'reportes';
  const renderBufferTab = async () => {
    contentSubtitle.textContent = "Análisis de Reposición y Sincronización de Stock";
    if(!bufferConfigCached) bufferConfigCached = await fetchBufferConfig();
    
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.5rem; margin-bottom:2rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
          <a class="sub-nav-item ${activeBufferSub==='maestros'?'active':''}" data-s="maestros" style="color:${activeBufferSub==='maestros'?'var(--primary)':'var(--text-muted)'}; font-weight:600; cursor:pointer; padding-bottom:0.5rem; border-bottom:2px solid ${activeBufferSub==='maestros'?'var(--primary)':'transparent'}">🗂️ ARCHIVOS MAESTROS</a>
          <a class="sub-nav-item ${activeBufferSub==='reportes'?'active':''}" data-s="reportes" style="color:${activeBufferSub==='reportes'?'var(--primary)':'var(--text-muted)'}; font-weight:600; cursor:pointer; padding-bottom:0.5rem; border-bottom:2px solid ${activeBufferSub==='reportes'?'var(--primary)':'transparent'}">📉 ANÁLISIS BUFFER</a>
        </nav>
        <div id="bufContent"></div>`;
    
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => {
        activeBufferSub = e.target.dataset.s; renderBufferTab();
    }));

    const buf = document.getElementById('bufContent');
    if (activeBufferSub === 'maestros') {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex'; wrap.style.direction = 'column'; wrap.style.gap = '1.5rem';
        buf.appendChild(wrap);
        renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv');
        // También mostrar estados de Activo y Reserva
        const stAct = await getAreaData('stockActivo');
        const stRes = await getAreaData('stockReserva');
        if(!stAct || !stRes) {
            wrap.innerHTML += `<div style="padding:1.5rem; background:rgba(239,68,68,0.1); color:var(--danger); border-radius:12px; border:1px dashed var(--danger);">⚠️ ADVERTENCIA: Debes cargar el Stock Activo y Reserva en la pestaña "Stock General" antes de procesar el Buffer.</div>`;
        }
    } else {
        buf.innerHTML = `
            <div style="background:rgba(219,39,119,0.08); padding:2rem; border-radius:16px; border:3px solid #db2777; box-shadow:0 0 40px rgba(219,39,119,0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:2rem;">
                    <div>
                        <h2 style="color:#db2777; font-weight:900; font-size:1.6rem; letter-spacing:1px; margin:0;">ANÁLISIS BUFFER NUCLEAR V6.9</h2>
                        <p style="color:#fff; opacity:0.8; font-size:0.85rem; margin-top:0.3rem;">Algoritmo de Priorización de Paletas Global</p>
                    </div>
                    <button id="btn_calc" class="btn" style="background:#db2777; width:auto; padding:1rem 3rem; font-weight:800; font-size:1.1rem; box-shadow: 0 4px 15px rgba(219,39,119,0.4);">
                        ⚡ PROCESAR ANÁLISIS
                    </button>
                </div>
                <div id="resultsArea"></div>
            </div>`;
        
        const results = document.getElementById('resultsArea');
        if (lastBufferKPI) renderBufferResults(results, lastBufferKPI);

        document.getElementById('btn_calc').addEventListener('click', async () => {
            const btn = document.getElementById('btn_calc');
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CALCULANDO...';
            
            // Simular carga para UI
            setTimeout(async () => {
                const res = calculateBufferPallets(bufferConfigCached);
                if(res) {
                    lastBufferKPI = res;
                    localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                    await logSystemAction(user.username, 'CALC_BUFFER', 'Ejecución del análisis manual nuclear');
                    saveBufferReport(res, user.username);
                    renderBufferResults(results, res);
                } else alert('ERROR: Faltan archivos maestros (Activo + Reserva + Pedidos)');
                btn.disabled = false; btn.innerHTML = '⚡ PROCESAR ANÁLISIS';
            }, 500);
        });
    }
  };

  const renderBufferResults = (container, data) => {
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:2rem;">
            <!-- CUADRO 1: ZONIFICACION -->
            <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden;">
                <div style="padding:1rem; background:rgba(79,70,229,0.15); border-bottom:1px solid var(--border); text-align:center;">
                    <h3 style="color:#fff; font-weight:700; font-size:1rem; margin:0;">DETALLE POR ZONIFICACIÓN</h3>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.3);">
                            <th style="padding:1rem; text-align:left; color:var(--text-muted); font-size:0.75rem;">NIVEL / ÁREA</th>
                            <th style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">ATENDIDO (RQ)</th>
                            <th style="padding:1rem; text-align:right; color:var(--text-muted); font-size:0.75rem;">% ATEND.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.waterfall.map(r => `
                            <tr style="border-bottom:1px solid var(--border); ${r.nivel === 'Total' ? 'background:rgba(34,197,94,0.1); font-weight:700;' : ''}">
                                <td style="padding:0.8rem 1rem;">${r.nivel}</td>
                                <td style="padding:0.8rem 1rem; text-align:center; color:${r.atd > 0 ? 'var(--success)' : 'var(--text-muted)'};">${r.atd.toLocaleString()}</td>
                                <td style="padding:0.8rem 1rem; text-align:right; color:var(--success);">${r.pct}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- CUADRO 2: RESUMEN SKU -->
            <div style="background:rgba(15,23,42,0.6); border:1px solid #db2777; border-radius:12px; overflow:hidden;">
                <div style="padding:1rem; background:rgba(219,39,119,0.2); border-bottom:1px solid #db2777; text-align:center;">
                    <h3 style="color:#fff; font-weight:700; font-size:1rem; margin:0;">RESUMEN DE EMPAQUE (V6.9)</h3>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:1.1rem;">
                    <thead>
                        <tr>
                            <th style="padding:1rem; text-align:left; color:#fff; font-size:0.8rem;">TIPO</th>
                            <th style="padding:1rem; text-align:center; color:#fff; font-size:0.8rem;">PALETAS</th>
                            <th style="padding:1rem; text-align:right; color:#fff; font-size:0.8rem;">CAJAS/PAR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.resumenSKU.map(r => `
                            <tr style="border-bottom:1px solid rgba(219,39,119,0.2); ${r.tipo === 'TOTAL' ? 'font-weight:900; background:rgba(219,39,119,0.1); height:4rem;' : ''}">
                                <td style="padding:1rem; color:${r.tipo==='TOTAL'?'#22c55e':'#fff'}">${r.tipo}</td>
                                <td style="padding:1rem; text-align:center; color:#fff;">${r.paletas}</td>
                                <td style="padding:1rem; text-align:right; font-weight:800; color:${r.tipo==='TOTAL'?'#22c55e':'#db2777'}; font-size:${r.tipo==='TOTAL'?'1.4rem':'1.1rem'};">
                                    ${Number(r.parcaja).toLocaleString()}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-top:2.5rem; display:flex; justify-content:center; gap:1.5rem;">
            <button id="btn_exp_buffer" class="btn" style="width:auto; background:var(--success); padding:0.8rem 2.5rem; display:flex; align-items:center; gap:0.5rem;">
                <i class="fas fa-file-excel"></i> DESCARGAR DETALLE (.xlsx)
            </button>
            <button class="btn" style="width:auto; background:var(--border); padding:0.8rem 2rem; border-radius:12px; font-size:0.85rem;" onclick="location.reload()">
                ↻ LIMPIAR PARA NUEVO ANÁLISIS
            </button>
        </div>
    `;
    document.getElementById('btn_exp_buffer').addEventListener('click', () => exportToExcel(data.detalle, 'Análisis_Buffer_V69'));
  };

  const renderConfigTab = async () => {
    contentSubtitle.textContent = "Parámetros del Sistema y Panel de Control";
    contentArea.innerHTML = `
        <div class="glass-panel" style="max-width:600px; margin:0 auto; padding:2rem; border:1px solid var(--border);">
            <h3 style="color:var(--primary); font-weight:800; margin-bottom:1.5rem;">⚙️ Configuración del Analizador</h3>
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
               <div style="padding:1.5rem; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid var(--border);">
                  <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">Zonas que el algoritmo considerará para asignar stock libre:</p>
                  ${['include_reserva', 'include_alto', 'include_piso', 'include_aereo', 'include_logico'].map(k => `
                    <label style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.02);">
                      <span style="font-size:0.9rem;">${k.replace('include_', 'INCLUIR ').toUpperCase()}</span>
                      <input type="checkbox" class="config-chk" data-k="${k}" ${bufferConfigCached[k]==='1'?'checked':''} style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
                    </label>
                  `).join('')}
               </div>
               <button id="save_conf" class="btn" style="background:var(--success);">💾 GUARDAR CONFIGURACIÓN</button>
            </div>
        </div>`;
    
    document.getElementById('save_conf').addEventListener('click', async () => {
        const conf = {};
        document.querySelectorAll('.config-chk').forEach(c => conf[c.dataset.k] = c.checked ? '1' : '0');
        bufferConfigCached = conf;
        alert('Configuración maestros actualizada (Local).');
    });
  };

  document.getElementById('logoutBtn').addEventListener('click', onLogout);
  renderNav();
  renderTabContent();
};

const renderDashboardView = (container, data) => {
    container.innerHTML = `
        <div style="padding:3rem; text-align:center; background:rgba(30,41,59,0.3); border:1px dashed var(--border); border-radius:16px;">
            <i class="fas fa-database fa-3x" style="color:var(--primary); opacity:0.3; margin-bottom:1.5rem;"></i>
            <h3 style="color:#fff; font-weight:700;">Base de Datos Indexada</h3>
            <p style="color:var(--text-muted);">Registros cargados para esta área: <strong style="color:var(--success); font-size:1.2rem;">${data.length.toLocaleString()}</strong></p>
            <button class="btn" style="width:auto; margin-top:2rem; padding:0.6rem 2rem;" onclick="location.reload()">ACTUALIZAR DATOS</button>
        </div>
    `;
};
