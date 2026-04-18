import { logout } from '../services/auth.js';
import { parseFile, parseBufferFiles, getAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, dataStore, setDateFilter, currentDateFilter } from '../services/csvHub_v6.js?v=6.2';

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

// UTIL: Exportador XLSX universal
const exportToExcel = (data, filename) => {
    if(!data || !data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
};

export const renderDashboard = async (container, user, onLogout) => {
  // Despertar el servidor en background inmediatamente
  pingServer();

  container.className = 'dashboard-layout animate-fade-in';

  // OBTENER PERMISOS DINÁMICOS DESDE EL BACKEND
  let rolePermissions = {};
  if (user.role !== 'admin') {
    try {
      const res = await fetch(`${API_BASE}/permissions/${user.role}`);
      if (res.ok) {
        const data = await res.json();
        rolePermissions = data.modules || {};
      }
    } catch (e) {
      console.error("Error cargando permisos:", e);
    }
  }

  // FILTRAR PESTAÑAS: Solo 'inicio' es fijo, el resto depende de la BD (o ser admin)
  const allowedTabs = TABS.filter(tab => {
    if (user.role === 'admin') return true;
    if (tab.id === 'inicio') return true;
    return rolePermissions[tab.id] === 1;
  });

  let currentTab = allowedTabs[0]?.id;

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <h2>Logística Dames1830</h2>
      </div>
      <div class="user-profile">
        <div class="date-filter-container" style="margin-right: 1.5rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.3rem 0.8rem; border-radius: 8px; border: 1px solid var(--border);">
          <i class="fas fa-calendar-alt" style="color: var(--primary);"></i>
          <input type="date" id="globalDatePicker" title="Viajar a una fecha pasada" style="background: transparent; border: none; color: var(--text-main); color-scheme: dark; font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer;">
        </div>
        <div class="user-details">
          <span class="user-name">${user.name}</span>
          <span class="user-role">${user.role.toUpperCase()} Área</span>
        </div>
        <button id="logoutBtn" class="btn-logout" title="Cerrar Sesión">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
        </button>
      </div>
    </header>
    
    <nav class="top-nav-links" id="navLinks"></nav>
    
    <main class="main-wrapper">
      <div class="glass-panel" style="padding: 2rem; min-height:80vh;">
        <div class="tab-header">
          <div>
            <h1 id="contentTitle" style="color: var(--primary)">Cargando...</h1>
            <p id="contentSubtitle" style="color:var(--text-muted)">Visualización de métricas</p>
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
  
  if (currentDateFilter) {
      datePicker.value = currentDateFilter;
  }
  
  datePicker.addEventListener('change', (e) => {
      const selected = e.target.value;
      setDateFilter(selected || null); // null if cleared
      renderTabContent();
  });

  const renderNav = () => {
    navContainer.innerHTML = allowedTabs.map(tab => `
      <a class="nav-item ${tab.id === currentTab ? 'active' : ''}" data-id="${tab.id}">
        <span style="margin-right: 8px; font-size:1.1rem">${tab.icon}</span>
        ${tab.label}
      </a>
    `).join('');

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        currentTab = e.currentTarget.getAttribute('data-id');
        renderNav();
        renderTabContent();
      });
    });
  };

  const renderTabContent = async () => {
    const activeTabObj = allowedTabs.find(t => t.id === currentTab);
    contentTitle.textContent = activeTabObj.label;
    
    if(currentChart) { currentChart.destroy(); currentChart = null; }

    // Indicador UI para carga de datos (Solo si es la primera vez o forzamos recarga)
    if (currentTab !== 'inicio') {
        contentArea.innerHTML = `
          <div style="text-align:center; padding: 4rem; color: var(--text-muted); opacity: 0.8;">
             <i class="fas fa-circle-notch fa-spin fa-3x" style="color: var(--primary); margin-bottom: 1.5rem;"></i>
             <h3 style="color: var(--text-main); font-weight: 500;">Sincronizando con Servidor Elite...</h3>
             <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--success);">Infraestructura Nivel Producción</p>
          </div>
        `;
    }

    // Si hay una fecha seleccionada, anclamos el indicador visual!
    const dateTitleTag = currentDateFilter ? `<span style="font-size:0.75rem; background: var(--warning); color:#000; padding:2px 8px; border-radius:12px; margin-left:10px; vertical-align:middle;">⏳ Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = activeTabObj.label + dateTitleTag;

    if (currentTab === 'inicio') {
      contentSubtitle.textContent = "Control Maestro de Operaciones";
      await renderHomeTab();
    } else if (currentTab === 'stock') {
      contentSubtitle.textContent = "Control de Inventario y Disponibilidad";
      await renderStockTab();
    } else if (currentTab === 'almacenaje') {
      contentSubtitle.textContent = "Gestión de Ubicaciones y Tareas";
      await renderAlmacenajeTab();
    } else if (currentTab === 'buffer') {
      contentSubtitle.textContent = "Zona Transicional y Reposición";
      await renderBufferTab();
    } else if (currentTab === 'admin_pers') {
      contentSubtitle.textContent = "Administración de Personal y Recursos";
      await renderAdminPersTab();
    } else if (currentTab === 'config') {
      contentSubtitle.textContent = "Panel de Administración del Sistema";
      await renderConfigTab();
    } else {
      contentSubtitle.textContent = "Vista Analítica Operativa";
      const savedData = await getAreaData(currentTab);
      if (!savedData) renderUploadArea();
      else renderDashboardView(savedData);
    }
  };

  // VISTA INICIO: MACRO DASHBOARD (Optimización Asíncrona)
  const renderHomeTab = async () => {
    let html = `
      <div style="text-align:center; padding-bottom: 2rem;">
         <h2 style="font-weight:400;">Bienvenido, ${user.name}</h2>
         <p style="color:var(--text-muted); font-size:0.9rem;">Visión global de memorias maestras alojadas en Base de Datos</p>
      </div>
      <div class="kpi-grid" id="homeKpiGrid">
    `;

    const areasValidas = ['stockActivo', 'stockReserva', 'inventario', 'picking', 'packing', 'despacho', 'recepcion'];
    
    areasValidas.forEach((a) => {
        const titleName = a === 'stockActivo'? 'Stock Activo': a === 'stockReserva'? 'Stock Reserva': a.toUpperCase();
        html += `
             <div class="kpi-card" id="card_${a}" style="border-left: 4px solid var(--primary); min-height:120px; transition: all 0.3s ease;">
                <div class="kpi-title">${titleName}</div>
                <div class="kpi-value" id="val_${a}"><i class="fas fa-spinner fa-spin" style="font-size:1.2rem; opacity:0.3;"></i></div>
                <div class="kpi-subtitle" style="color:var(--text-muted)">Consultando...</div>
             </div>
        `;
    });
    
    html += `</div>`;
    contentArea.innerHTML = html;

    // Disparo asíncrono e independiente para cada una (No bloquea la página!)
    areasValidas.forEach(a => {
        getAreaData(a).then(rows => {
            const valEl = document.getElementById(`val_${a}`);
            const cardEl = document.getElementById(`card_${a}`);
            if (valEl && rows) {
                valEl.textContent = rows.length.toLocaleString();
                valEl.style.color = 'var(--primary)';
                const subEl = valEl.nextElementSibling;
                if(subEl) subEl.textContent = 'Registros en DB';
                if(cardEl) cardEl.style.background = 'rgba(79, 70, 229, 0.03)';
            } else if (valEl) {
                valEl.textContent = '0';
                valEl.style.opacity = '0.5';
                const subEl = valEl.nextElementSibling;
                if(subEl) subEl.textContent = 'Sin datos';
            }
        }).catch(err => {
            const valEl = document.getElementById(`val_${a}`);
            if(valEl) valEl.innerHTML = '<span style="color:var(--danger); font-size:0.8rem;">Error</span>';
        });
    });
  };

  // VISTA STOCK CARGA - acepta un contenedor opcional (para sub-tabs)
  const renderStockUploads = async (targetContainer = null) => {
    const container = targetContainer || contentArea;
    // Optimización: Carga múltiple en paralelo
    const [actData, resData] = await Promise.all([
       getAreaData('stockActivo'),
       getAreaData('stockReserva')
    ]);
    container.innerHTML = '';
    htmlStockUpload(`Stock Activo (.csv)`, 'stockActivo', actData, '.csv', container);
    htmlStockUpload(`Stock Reserva (.xlsx)`, 'stockReserva', resData, '.xlsx', container);
  };

  const htmlStockUpload = (title, areaKey, hasData, ext, targetContainer = null) => {
    const container = targetContainer || contentArea;
    let div = document.createElement('div');
    div.style.marginBottom = '2rem';
    
    if (hasData) {
      div.innerHTML = `
        <div style="padding:1.5rem; background:rgba(34, 197, 94, 0.1); border:1px solid var(--success); border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
           <div>
              <h3 style="color:var(--success)">✅ ${title} Cargado y Activo</h3>
              <p style="font-size:0.875rem; color:var(--text-muted)">${hasData.length} registros listos para lectura.</p>
           </div>
           <div style="display:flex; gap:0.5rem">
              <label class="btn" style="width: auto; background: var(--bg-card); color:var(--text-main); border:1px solid var(--border); font-size:0.8rem; cursor:pointer; padding:0.5rem 1rem">
                ↻ Re-subir (Reemplaza DB)
                <input type="file" id="update_${areaKey}" accept="${ext}" style="display:none;">
              </label>
              <button class="btn" id="export_${areaKey}" style="width:auto; padding:0.5rem 1rem; border:1px solid var(--primary); font-size:0.8rem;">
                ↓ Exportar DB
              </button>
           </div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="upload-area" id="drop_${areaKey}">
          <h3>Archivos de ${title}</h3>
          <p>Sube el archivo ${ext} diario para alojarlo en el servidor backend.</p>
          <label class="upload-btn">
            Cargar al Servidor Local
            <input type="file" id="input_${areaKey}" accept="${ext}" style="display:none;">
          </label>
          <div id="err_${areaKey}" style="color:var(--danger); margin-top:1rem;"></div>
        </div>
      `;
    }

    container.appendChild(div);
    attachUploadEvent(hasData ? `update_${areaKey}` : `input_${areaKey}`, areaKey, ext);

    if (hasData) {
        setTimeout(() => {
            document.getElementById(`export_${areaKey}`)?.addEventListener('click', () => {
                exportToExcel(hasData, areaKey);
            });
        }, 50);
    }
  };

  const attachUploadEvent = (inputId, targetType, acceptType) => {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.accept = acceptType;
      
      const lbl = input.parentElement;
      
      input.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files);
          if (!files || files.length === 0) return;
          
          const ogText = lbl.innerHTML;
          lbl.style.opacity = '0.5';
          lbl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
          
          try {
              if (targetType === 'buffer') {
                  await parseBufferFiles(files);
              } else {
                  await parseFile(files[0], targetType);
              }
              
              if (TABS.find(t => t.id === 'inicio').roles.includes('admin')) { 
                 if(targetType === 'buffer') {
                     renderBufferTab();
                 } else {
                     renderTabContent();
                 }
              }
          } catch(err) {
              console.error(err);
              const errMsg = (err && err.message) ? err.message : String(err);
              alert('Error procesando archivo: ' + errMsg);
          } finally {
              lbl.style.opacity = '1';
              lbl.innerHTML = ogText;
          }
      });
  };

  let activeBufferSubTab = 'maestros';
  const renderBufferTab = async (forceReload = false) => {
      // 1. Solo esperamos si necesitamos descargar algo que no esté en memoria cache
      if (!bufferConfigCached || forceReload) {
          if (!forceReload && (!dataStore.stockActivo || !dataStore.stockReserva)) {
              contentArea.innerHTML = `
                <div style="text-align:center; padding:5rem; color:var(--primary);">
                  <i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:1.5rem;"></i>
                  <h3 style="color:#fff;">Sincronizando con el servidor...</h3>
                  <p style="color:var(--text-muted); font-size:0.9rem;">Esto solo ocurrirá la primera vez que entres a esta zona.</p>
                </div>
              `;
          }

          const [bConfig] = await Promise.all([
              fetchBufferConfig(),
              getAreaData('buffer'),
              getAreaData('stockActivo'),
              getAreaData('stockReserva')
          ]);
          bufferConfigCached = bConfig;
      }

      // Intentar recuperar de localStorage si la memoria RAM está vacía
      if (!lastBufferKPI) {
          const localStored = localStorage.getItem('lastBufferKPI');
          if (localStored) {
              try {
                  lastBufferKPI = JSON.parse(localStored);
                  console.log('📦 Reporte Buffer recuperado de memoria local.');
              } catch(e) { /* corrupto, ignorar */ }
          }
      }

      let bufferKPIObj = lastBufferKPI;

      // ── SINCRONIZACIÓN ENTRE PCs (Carga inicial si está vacío) ──
      if (!bufferKPIObj) {
          const serverReport = await loadBufferReport();
          if (serverReport) {
              bufferKPIObj = serverReport;
              lastBufferKPI = serverReport;
          }
      }

      let html = `
        <nav class="sub-nav" style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
          <a class="sub-nav-item ${activeBufferSubTab === 'maestros' ? 'active' : ''}" data-sub="maestros" style="cursor:pointer; padding:0.5rem 1rem; color:${activeBufferSubTab === 'maestros' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeBufferSubTab === 'maestros' ? 'var(--primary)' : 'transparent'}">📚 Archivos Maestros</a>
          <a class="sub-nav-item ${activeBufferSubTab === 'reportes' ? 'active' : ''}" data-sub="reportes" style="cursor:pointer; padding:0.5rem 1rem; color:${activeBufferSubTab === 'reportes' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeBufferSubTab === 'reportes' ? 'var(--primary)' : 'transparent'}">📊 Reportes</a>
          <a class="sub-nav-item ${activeBufferSubTab === 'dashboard' ? 'active' : ''}" data-sub="dashboard" style="cursor:pointer; padding:0.5rem 1rem; color:${activeBufferSubTab === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeBufferSubTab === 'dashboard' ? 'var(--primary)' : 'transparent'}">📈 Dashboard</a>
          <a class="sub-nav-item ${activeBufferSubTab === 'config' ? 'active' : ''}" data-sub="config" style="cursor:pointer; padding:0.5rem 1rem; color:${activeBufferSubTab === 'config' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeBufferSubTab === 'config' ? 'var(--primary)' : 'transparent'}">⚙️ Configuración</a>
        </nav>
        <div id="bufferSubContent"></div>
      `;

      contentArea.innerHTML = html;

      const subContent = document.getElementById('bufferSubContent');

      // ACCIÓN: Cambio de Sub-Pestaña
      document.querySelectorAll('.sub-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          activeBufferSubTab = e.target.dataset.sub;
          renderBufferTab();
        });
      });

      if (activeBufferSubTab === 'maestros') {
          // ... (keep existing maestros UI)
          subContent.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1.5rem;">
              <div class="kpi-card" style="text-align:center; padding:2rem; border:1px dashed var(--border);">
                 <i class="fas fa-file-invoice-dollar fa-2x" style="color:var(--primary); margin-bottom:1rem;"></i>
                 <h4>Pedidos</h4>
                 <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 1rem;">Archivo de demanda por SKU</p>
                 <label class="btn" style="padding:0.4rem; font-size:0.8rem;">Cargar Pedidos <input type="file" id="up_pedidos" accept=".csv" style="display:none;"></label>
              </div>
              <div class="kpi-card" style="text-align:center; padding:2rem; border:1px dashed var(--border);">
                 <i class="fas fa-clipboard-list fa-2x" style="color:var(--warning); margin-bottom:1rem;"></i>
                 <h4>Solicitud</h4>
                 <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 1rem;">Consolidado de reposición</p>
                 <label class="btn" style="padding:0.4rem; font-size:0.8rem; background:var(--warning); color:black;">Cargar Solicitud <input type="file" id="up_solicitud" accept=".csv" style="display:none;"></label>
              </div>
              <div class="kpi-card" style="text-align:center; padding:2rem; border:1px dashed var(--border);">
                 <i class="fas fa-boxes fa-2x" style="color:var(--success); margin-bottom:1rem;"></i>
                 <h4>Maestro Artículos</h4>
                 <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 1rem;">Data maestra (reemplaza anterior)</p>
                 <label class="btn" style="padding:0.4rem; font-size:0.8rem; background:var(--success);">Cargar Maestro <input type="file" id="up_articulos" accept=".csv" style="display:none;"></label>
              </div>
              <div class="kpi-card" style="text-align:center; padding:2rem; border:1px dashed var(--border);">
                 <i class="fas fa-ruler fa-2x" style="color:var(--danger); margin-bottom:1rem;"></i>
                 <h4>Tallas</h4>
                 <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 1rem;">Relación Códigos / Tallas</p>
                 <label class="btn" style="padding:0.4rem; font-size:0.8rem; background:var(--danger);">Cargar Tallas <input type="file" id="up_tallas" accept=".csv" style="display:none;"></label>
              </div>
            </div>
          `;
          attachUploadEvent('up_pedidos', 'buffer', '.csv');
          attachUploadEvent('up_solicitud', 'solicitud', '.csv');
          attachUploadEvent('up_articulos', 'articulos', '.csv');
          attachUploadEvent('up_tallas', 'tallas', '.csv');

      } else if (activeBufferSubTab === 'reportes') {
          let rhtml = `
            <div style="background:rgba(219,39,119,0.1); padding:1.5rem; border-radius:12px; border:3px solid #db2777; margin-bottom:2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; box-shadow:0 0 20px rgba(219,39,119,0.2);">
              <div>
                <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.3rem;">
                  <h4 style="color:#db2777; margin:0; font-weight:800;">Análisis Stock (NUCLEAR FIX V6)</h4>
                  <span style="background:#db2777; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:900; letter-spacing:1px;">FORZADO FINAL</span>
                </div>
                <p style="font-size:0.8rem; color:#fff; margin:0; opacity:0.9;">¡Atención! Si ves este borde FUCSIA, los cambios se cargaron correctamente.</p>
              </div>
              <button id="btn_procesar_buffer" class="btn" style="width:auto; padding:0.8rem 2.5rem; background:#db2777; color:#fff; font-weight:800; font-size:1rem; box-shadow:0 4px 15px rgba(219,39,119,0.4); border:none;">
                ⚡ PROCESAR CON NUEVA LÓGICA
              </button>
            </div>
          `;

          if (!bufferKPIObj) {
            const hasActivo  = dataStore.stockActivo && dataStore.stockActivo.length > 0;
            const hasReserva = dataStore.stockReserva && dataStore.stockReserva.length > 0;
            const hasPedidos = dataStore.buffer && dataStore.buffer.length > 0;

            const mkStatus = (ok, name) => `<div style="display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0;">
              <span style="font-size:1.2rem;">${ok ? '✅' : '❌'}</span>
              <span style="color:${ok ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${name}</span>
              <span style="color:var(--text-muted); font-size:0.8rem;">${ok ? '— Cargado' : '— Falta subir'}</span>
            </div>`;

            rhtml += `
              <div style="text-align:left; padding:2rem; background:rgba(255,165,0,0.06); border:1px solid var(--warning); border-radius:12px; margin-bottom:1.5rem; max-width:500px;">
                <div style="text-align:center; margin-bottom:1rem;">
                  <i class="fas fa-exclamation-triangle fa-2x" style="color:var(--warning); margin-bottom:0.7rem;"></i>
                  <h4 style="color:var(--warning);">Preparado para el análisis</h4>
                </div>
                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Asegúrate de tener estos archivos cargados:</p>
                ${mkStatus(hasActivo, 'Stock Activo (.csv)')}
                ${mkStatus(hasReserva, 'Stock Reserva (.xlsx)')}
                ${mkStatus(hasPedidos, 'Pedidos (.csv)')}
              </div>
            `;
            // IMPORTANTE: we don't return here anymore, we continue to attach the listener at the end
          } else {
            // Si el reporte existe, procedemos con las tablas pero de forma segura
            try {
              // FORZADO DE DISEÑO V3 - BLOQUE VERTICAL PURO
              rhtml += `<div style="display:block !important; width:100% !important; border:0 !important; background:transparent !important;">`;
              
              const containerStyle = `display:block !important; width:100% !important; max-width:100% !important; border-radius:12px; overflow:hidden; margin-bottom:2.5rem; box-shadow:0 8px 32px rgba(0,0,0,0.3); clear:both;`;

              // ── CUADRO 1: ANÁLISIS BUFFER ZONAS ──
              if (bufferKPIObj.waterfall) {
                rhtml += `
                  <div style="${containerStyle} border:2px solid var(--primary);">
                    <div style="padding:0.8rem 1rem; background:rgba(79,70,229,0.14); border-bottom:1px solid var(--border); text-align:center;">
                      <h3 style="color:#fff; font-weight:700; letter-spacing:1px; font-size:1rem;">ANÁLISIS BUFFER ZONAS</h3>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                      <thead>
                        <tr style="background:rgba(15,23,42,0.6);">
                          <th style="padding:0.4rem 0.8rem; text-align:left; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--border); width:40%;">NIVEL/AREA</th>
                          <th style="padding:0.4rem 0.5rem; text-align:center; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--border); width:20%;">RQ</th>
                          <th style="padding:0.4rem 0.5rem; text-align:center; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--border); width:20%;">ATD RQ</th>
                          <th style="padding:0.4rem 0.8rem; text-align:center; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid var(--border); width:20%;">% ATD</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${bufferKPIObj.waterfall.map(row => {
                          const isTotal = row.nivel === 'Total';
                          return `<tr style="${isTotal ? 'font-weight:700; background:rgba(34,197,94,0.1);' : 'border-bottom:1px solid var(--border);'}">
                            <td style="padding:0.45rem 0.8rem; text-align:left;">${row.nivel}</td>
                            <td style="padding:0.45rem 0.5rem; text-align:center;">${Number(row.rq).toLocaleString()}</td>
                            <td style="padding:0.45rem 0.5rem; text-align:center; ${isTotal ? 'color:#22c55e;' : ''}">${Number(row.atd).toLocaleString()}</td>
                            <td style="padding:0.45rem 0.8rem; text-align:center; ${isTotal ? 'color:#22c55e;' : ''}">${row.pct}</td>
                          </tr>`;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                `;
              }

              // ── CUADRO 2: ANÁLISIS BUFFER SKU ──
              const resumen = bufferKPIObj.resumenSKU || [];
              rhtml += `
                <div style="${containerStyle} border:4px solid #db2777; background:rgba(0,0,0,0.4);">
                  <div style="padding:1.2rem; background:#db2777; border-bottom:1px solid #db2777; text-align:center;">
                    <h2 style="color:#fff; font-weight:900; letter-spacing:3px; font-size:1.3rem; margin:0; text-transform:uppercase;">ANÁLISIS BUFFER SKU (VERSIÓN 6.0)</h2>
                  </div>
                  <table style="width:100%; border-collapse:collapse; font-size:1.1rem; background:rgba(15,23,42,0.6);">
                    <thead>
                      <tr style="background:rgba(15,23,42,0.9); height:4rem;">
                        <th style="padding:0 1.2rem; text-align:left; color:#fff; font-size:0.85rem; text-transform:uppercase; border-bottom:2px solid #db2777;">TIPO DE EMPAQUE</th>
                        <th style="padding:0; text-align:center; color:#fff; font-size:0.85rem; text-transform:uppercase; border-bottom:2px solid #db2777;">PALETAS</th>
                        <th style="padding:0; text-align:center; color:#fff; font-size:0.85rem; text-transform:uppercase; border-bottom:2px solid #db2777;">SKUS</th>
                        <th style="padding:0; text-align:center; color:#fff; font-size:0.85rem; text-transform:uppercase; border-bottom:2px solid #db2777;">PAR/CAJA</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${resumen.map(r => `
                        <tr style="border-bottom:1px solid #db2777; height:4.5rem;">
                          <td style="padding:0 1.2rem; font-weight:900; color:${r.tipo==='TOTAL'?'#22c55e':'#fff'}; font-size:1.1rem; border-right:1px solid rgba(219,39,119,0.2);">${r.tipo}</td>
                          <td style="padding:0; text-align:center; font-size:1.1rem; color:#fff; border-right:1px solid rgba(219,39,119,0.2);">${r.paletas}</td>
                          <td style="padding:0; text-align:center; font-size:1.1rem; color:#fff; border-right:1px solid rgba(219,39,119,0.2);">${r.skus}</td>
                          <td style="padding:0; text-align:center; font-weight:900; color:${r.tipo==='TOTAL'?'#22c55e':'#db2777'}; font-size:1.4rem;">
                            ${Number(r.parcaja).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                </div> <!-- CIERRE NUCLEAR V6 -->
              `;

              // ── CUADRO 3: DETALLE REPOSICIÓN MUESTRA (Tabla Detalle) ──
              const detalleArr = bufferKPIObj.detalle || [];
              if (detalleArr.length > 0) {
                rhtml += `
                  <div style="margin-top:2rem; background:var(--bg-card); border-radius:12px; border:1px solid var(--border); overflow:hidden;">
                    <div style="padding:1rem; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;">
                      <h4 style="margin:0; color:#fff;">Detalle del Análisis (SKU/Ubicaciones)</h4>
                      <span style="font-size:0.75rem; color:var(--text-muted);">Mostrando ${Math.min(detalleArr.length, 100)} de ${detalleArr.length} registros</span>
                    </div>
                    <div class="data-table-container" style="max-height:400px; overflow-y:auto;">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>UBICACIÓN</th>
                            <th>LPN</th>
                            <th>SKU</th>
                            <th style="text-align:center;">STOCK ACT.</th>
                            <th style="text-align:center;">STOCK RES.</th>
                            <th style="text-align:center; color:var(--primary);">QTY BUFFER</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${detalleArr.slice(0, 100).map(row => `
                            <tr>
                              <td style="font-weight:600; color:var(--primary);">${row.UBICACIONES}</td>
                              <td style="font-size:0.8rem;">${row.LPN}</td>
                              <td>${row.SKU}</td>
                              <td style="text-align:center; color:var(--text-muted);">${row['QTY ACTIVO']}</td>
                              <td style="text-align:center; color:var(--text-muted);">${row['QTY RESERVA']}</td>
                              <td style="text-align:center; font-weight:700; color:var(--primary);">${Number(row['QTY BUFFER']).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style="text-align:center; margin-top:1.5rem; display:flex; gap:1rem; justify-content:center;">
                    <button class="btn" id="export_pallets" style="width:auto; background:var(--success); color:#fff; padding:0.75rem 2rem;">
                      <i class="fas fa-file-excel" style="margin-right:0.5rem;"></i> Descargar Orden de Extracción (.xlsx)
                    </button>
                  </div>
                `;
              }
            } catch (err) {
              console.error("Error renderizando tablas de buffer:", err);
              rhtml += `<div style="padding:1.5rem; background:rgba(239,68,68,0.1); color:var(--danger); border-radius:8px; border:1px dashed var(--danger); margin-top:1rem;">
                ⚠️ El reporte guardado tiene un formato incompatible. Por favor, pulsa el botón superior para recalcularlo.
              </div>`;
            }
          }

          subContent.innerHTML = rhtml;

          // Listeners
          document.getElementById('btn_procesar_buffer').addEventListener('click', async () => {
              const btn = document.getElementById('btn_procesar_buffer');
              const originalHTML = btn.innerHTML;
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
              btn.disabled = true;

              setTimeout(async () => {
                  try {
                      const config = await fetchBufferConfig();
                      const result = calculateBufferPallets(config);
                      
                      if (result) {
                          lastBufferKPI = result;
                          localStorage.setItem('lastBufferKPI', JSON.stringify(lastBufferKPI));
                          await logSystemAction(user.username, 'PROCESAR_BUFFER', 'Análisis manual completado con éxito');
                          saveBufferReport(lastBufferKPI, user.username);
                          renderBufferTab(); // Refrescar vista
                      } else {
                          alert('No se pudo generar el reporte. Verifica que los archivos maestros tengan datos válidos.');
                          btn.innerHTML = originalHTML;
                          btn.disabled = false;
                      }
                  } catch (err) {
                      console.error("Error crítico en procesamiento buffer:", err);
                      alert('Error crítico durante el análisis. Revisa la consola para más detalles.');
                      btn.innerHTML = originalHTML;
                      btn.disabled = false;
                  } finally {
                      // El renderBufferTab() ya se encarga de redibujar si hubo éxito
                      // de lo contrario, el catch/else resetea el botón.
                  }
              }, 100);
          });

          if (document.getElementById('export_pallets')) {
              document.getElementById('export_pallets').addEventListener('click', () => 
                exportToExcel(bufferKPIObj.detalle, 'Detalle_Buffer_Completo')
              );
          }

      } else if (activeBufferSubTab === 'dashboard') {
          subContent.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fas fa-chart-line fa-3x" style="margin-bottom:1rem;"></i><br>Dashboard de desempeño Buffer (Próximamente)</div>`;

      } else if (activeBufferSubTab === 'config') {
          subContent.innerHTML = `
            <div class="glass-panel" style="max-width:500px; margin:0 auto; padding:2rem;">
              <h3 style="color:var(--primary); margin-bottom:1.5rem;">Lógica de Análisis Buffer</h3>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">Activa o desactiva las zonas de stock que deben considerarse al calcular el buffer.</p>
              <div style="display:flex; flex-direction:column; gap:1rem;">
                ${Object.entries({
                  include_reserva: 'Incluir Stock Reserva (Zonas Bajas)',
                  include_alto: 'Incluir Nivel ALTO (Paletas)',
                  include_piso: 'Incluir Stock en PISO / CROSS',
                  include_aereo: 'Incluir Stock AEREO',
                  include_logico: 'Incluir Stock Lógico (DIS / MZM-TR)'
                }).map(([key, label]) => `
                  <label style="display:flex; justify-content:space-between; align-items:center; padding:1rem; background:rgba(255,255,255,0.03); border-radius:8px; cursor:pointer; border:1px solid ${bufferConfig[key] === '1' ? 'var(--primary)' : 'var(--border)'}">
                    <span style="font-size:0.9rem;">${label}</span>
                    <input type="checkbox" class="buffer-toggle" data-key="${key}" ${bufferConfig[key] === '1' ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary);">
                  </label>
                `).join('')}
              </div>
              <button id="saveBufferConfig" class="btn" style="margin-top:2rem; background:var(--success);">💾 Guardar Cambios</button>
            </div>
          `;
          document.getElementById('saveBufferConfig').addEventListener('click', async () => {
             const newConfig = {};
             document.querySelectorAll('.buffer-toggle').forEach(chk => {
               newConfig[chk.dataset.key] = chk.checked ? '1' : '0';
             });
             try {
                const res = await fetch(`${API_BASE.replace('/api', '/api/buffer/config')}`, {
                   method: 'PUT',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(newConfig)
                });
                if(res.ok) {
                   await logSystemAction(user.username, 'CONFIG_BUFFER', `Actualizada lógica de análisis buffer`);
                   alert('Configuración guardada. El análisis se actualizará automáticamente.');
                }
                renderBufferTab();
             } catch(e) { alert('Error al guardar.'); }
          });
      }
  };

  // ---- SUB-PESTAÑA: LOGS DE AUDITORÍA (AUDIT) ----
  let logUserFilter = '';
  let logDateFilter = '';

  const renderLogsSubTab = async (container) => {
    container.innerHTML = `
      <div style="background:var(--bg-main); padding:1.5rem; border-radius:12px; border:1px solid var(--border); margin-bottom:1.5rem;">
        <h4 style="margin-bottom:1rem; color:var(--primary);">Filtrar Registros</h4>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <input type="text" id="logUserFilter" placeholder="Usuario (ej: dames)" value="${logUserFilter}" style="padding:0.6rem; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; color:#fff; font-family:inherit; flex:1; min-width:150px;">
          <input type="date" id="logDateFilter" value="${logDateFilter}" style="padding:0.6rem; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; color:#fff; font-family:inherit; flex:1; min-width:150px; color-scheme:dark;">
          <button id="btnFilterLogs" class="btn" style="width: auto; padding:0 2rem;">🔍 Buscar</button>
          <button id="btnClearLogs" class="btn" style="width: auto; padding:0 1.5rem; background:var(--border);">🧹 Limpiar</button>
        </div>
      </div>
      <div id="logsTableArea"></div>
    `;

    const tableArea = document.getElementById('logsTableArea');
    const fetchLogs = async () => {
      tableArea.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>';
      try {
        let url = `${API_BASE}/logs?`;
        if (logUserFilter) url += `username=${logUserFilter}&`;
        if (logDateFilter) url += `date=${logDateFilter}&`;
        
        const res = await fetch(url);
        const logs = await res.json();
        
        // El backend ya los ordena por fecha descendente, pero nos aseguramos aquí también
        logs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        if (!logs.length) {
          tableArea.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted);">No se encontraron registros con los filtros aplicados.</div>';
          return;
        }

        tableArea.innerHTML = `
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>FECHA/HORA</th>
                  <th>USUARIO</th>
                  <th>ACCIÓN</th>
                  <th>DETALLES</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(l.created_at).toLocaleString()}</td>
                    <td style="font-weight:600; color:var(--primary);">${l.username}</td>
                    <td><span style="padding:2px 8px; background:rgba(255,255,255,0.05); border-radius:4px; font-size:0.75rem;">${l.action}</span></td>
                    <td style="font-size:0.85rem;">${l.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (e) { tableArea.innerHTML = '<div style="color:var(--danger);">Error cargando logs.</div>'; }
    };

    fetchLogs();

    document.getElementById('btnFilterLogs').addEventListener('click', () => {
      logUserFilter = document.getElementById('logUserFilter').value;
      logDateFilter = document.getElementById('logDateFilter').value;
      fetchLogs();
    });
    document.getElementById('btnClearLogs').addEventListener('click', () => {
      logUserFilter = '';
      logDateFilter = '';
      document.getElementById('logUserFilter').value = '';
      document.getElementById('logDateFilter').value = '';
      fetchLogs();
    });
  };

  // --- SUB-TABS STOCK GENERAL ---
  let activeStockSubTab = 'stock_dia';
  const renderStockTab = async () => {
    contentArea.innerHTML = `
      <nav style="display:flex; gap:0; margin-bottom:1.5rem; border-bottom:2px solid var(--border);">
        <button class="stock-sub-btn" data-sub="stock_dia" style="padding:0.7rem 1.5rem; background:${activeStockSubTab === 'stock_dia' ? 'var(--primary)' : 'transparent'}; color:${activeStockSubTab === 'stock_dia' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${activeStockSubTab === 'stock_dia' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500;">📊 Stock Día</button>
        <button class="stock-sub-btn" data-sub="stock_kpi" style="padding:0.7rem 1.5rem; background:${activeStockSubTab === 'stock_kpi' ? 'var(--primary)' : 'transparent'}; color:${activeStockSubTab === 'stock_kpi' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${activeStockSubTab === 'stock_kpi' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500;">📈 KPI Stock</button>
      </nav>
      <div id="stockSubContent"></div>
    `;
    document.querySelectorAll('.stock-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeStockSubTab = btn.dataset.sub; renderStockTab(); });
    });
    const sub = document.getElementById('stockSubContent');
    if (activeStockSubTab === 'stock_dia') {
      // Renderiza directamente dentro del sub-contenedor
      await renderStockUploads(sub);
    } else {
      sub.innerHTML = '<div style="padding:4rem; text-align:center; color:var(--text-muted);"><i class="fas fa-chart-bar fa-3x" style="margin-bottom:1rem;"></i><br>Módulo KPI Stock en desarrollo.</div>';
    }
  };

  let activeAlmacenSubTab = 'tareas';
  const renderAlmacenajeTab = async () => {
    contentArea.innerHTML = `
      <nav class="sub-nav" style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
        <a class="sub-nav-item ${activeAlmacenSubTab === 'tareas' ? 'active' : ''}" data-sub="tareas" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAlmacenSubTab === 'tareas' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAlmacenSubTab === 'tareas' ? 'var(--primary)' : 'transparent'}">📝 Tareas</a>
        <a class="sub-nav-item ${activeAlmacenSubTab === 'detalle' ? 'active' : ''}" data-sub="detalle" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAlmacenSubTab === 'detalle' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAlmacenSubTab === 'detalle' ? 'var(--primary)' : 'transparent'}">🔍 Detalle Tareas</a>
        <a class="sub-nav-item ${activeAlmacenSubTab === 'kpi' ? 'active' : ''}" data-sub="kpi" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAlmacenSubTab === 'kpi' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAlmacenSubTab === 'kpi' ? 'var(--primary)' : 'transparent'}">📈 KPI Almacenaje</a>
      </nav>
      <div id="almacenSubContent"></div>
    `;
    document.querySelectorAll('.sub-nav-item').forEach(item => { item.addEventListener('click', (e) => { activeAlmacenSubTab = e.target.dataset.sub; renderAlmacenajeTab(); }); });
    const sub = document.getElementById('almacenSubContent');
    if (activeAlmacenSubTab === 'tareas') {
      const data = await getAreaData('almacenaje');
      if (!data) {
        sub.innerHTML = '<div id="localUploadArea"></div>';
        const localArea = document.getElementById('localUploadArea');
        renderUploadAreaInto(localArea, 'almacenaje');
      } else {
        renderDashboardViewInto(sub, data, 'almacenaje');
      }
    } else {
      sub.innerHTML = `<div style="padding:4rem; text-align:center; color:var(--text-muted);">Módulo ${activeAlmacenSubTab.toUpperCase()} en desarrollo.</div>`;
    }
  };

  // Ayudantes para renderizar dentro de contenedores específicos
  const renderUploadAreaInto = (target, area) => {
    target.innerHTML = `
      <div class="upload-area">
        <h3>Sube tu archivo CSV de ${area.toUpperCase()}</h3>
        <label class="upload-btn">Seleccionar Archivo<input type="file" id="input_${area}" accept=".csv" style="display:none;"></label>
        <div id="err_${area}" style="color:var(--danger); margin-top:1rem;"></div>
      </div>
    `;
    attachUploadEvent(`input_${area}`, area, '.csv');
  };

  const renderDashboardViewInto = (target, data, area) => {
    const kpis = generateKPIs(data, area);
    target.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-title">Registros Locales</div><div class="kpi-value">${kpis.totalRecords}</div></div>
        <div class="kpi-card"><div class="kpi-title">Administrar</div><label class="btn" style="cursor:pointer; margin-top:0.5rem;">↻ Re-subir CSV<input type="file" id="update_${area}" accept=".csv" style="display:none;"></label></div>
      </div>
      <div class="data-table-container" style="margin-top:2rem;">
        <table class="data-table">
          <thead><tr>${Object.keys(data[0] || {}).slice(0, 5).map(k => `<th>${k}</th>`).join('')}</tr></thead>
          <tbody>${data.slice(0, 10).map(row => `<tr>${Object.values(row).slice(0, 5).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    attachUploadEvent(`update_${area}`, area, '.csv');
  };

  let activeAdminSubTab = 'perf';
  const renderAdminPersTab = async () => {
    contentArea.innerHTML = `
      <nav class="sub-nav" style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
        <a class="sub-nav-item ${activeAdminSubTab === 'perf' ? 'active' : ''}" data-sub="perf" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAdminSubTab === 'perf' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAdminSubTab === 'perf' ? 'var(--primary)' : 'transparent'}">⚡ Performance Personal</a>
        <a class="sub-nav-item ${activeAdminSubTab === 'asist' ? 'active' : ''}" data-sub="asist" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAdminSubTab === 'asist' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAdminSubTab === 'asist' ? 'var(--primary)' : 'transparent'}">🆔 Asistencia</a>
        <a class="sub-nav-item ${activeAdminSubTab === 'kpi' ? 'active' : ''}" data-sub="kpi" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAdminSubTab === 'kpi' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAdminSubTab === 'kpi' ? 'var(--primary)' : 'transparent'}">📈 KPI Personal</a>
        <a class="sub-nav-item ${activeAdminSubTab === 'rf' ? 'active' : ''}" data-sub="rf" style="cursor:pointer; padding:0.5rem 1rem; color:${activeAdminSubTab === 'rf' ? 'var(--primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeAdminSubTab === 'rf' ? 'var(--primary)' : 'transparent'}">📟 Asignación RF´s</a>
      </nav>
      <div id="adminSubContent"></div>
    `;
    document.querySelectorAll('.sub-nav-item').forEach(item => { item.addEventListener('click', (e) => { activeAdminSubTab = e.target.dataset.sub; renderAdminPersTab(); }); });
    const sub = document.getElementById('adminSubContent');
    sub.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);"><i class="fas fa-users-cog fa-3x" style="margin-bottom:1rem;"></i><br>Módulo ${activeAdminSubTab.toUpperCase()} (Vista informativa - Sin carga de archivos)</div>`;
  };

  const renderDashboardView = (data, customCardHTML = '', detailsBufferData = null) => {
    const kpis = generateKPIs(data, currentTab);
    let html = '';
    
    if(kpis || customCardHTML) {
      html += `<div class="kpi-grid">${customCardHTML}`;
      if(kpis) {
         html += `
          <div class="kpi-card">
            <div class="kpi-title">Registros Locales</div>
            <div class="kpi-value">${kpis.totalRecords}</div>
          </div>
         `;
      }
      
      html += `
          <div class="kpi-card">
            <div class="kpi-title">Administrar</div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem">
              <label class="btn" style="width: auto; padding: 0.3rem 0.6rem; height: 35px; background: rgba(255,255,255,0.1); color:var(--text-main); border:1px solid var(--border); font-size:0.75rem; cursor:pointer;">
                ↻ Re-subir CSV
                <input type="file" id="update_${currentTab}" accept=".csv" style="display:none;">
              </label>
              <button class="btn" id="export_${currentTab}" style="width: auto; padding: 0.3rem 0.6rem; height: 35px; background: var(--primary); font-size:0.75rem; cursor:pointer;">
                ↓ Bajar Plantilla Actual
              </button>
               ${detailsBufferData ? `<button class="btn" id="export_details_buffer" style="width: auto; padding: 0.3rem 0.6rem; height: 35px; background: var(--warning); font-size:0.75rem; cursor:pointer; color:black;">↓ Reporte Pallets</button>` : ''}
            </div>
          </div>
      `;
      html += `</div>`;
    }

    html += `
      <div class="dashboard-body">
         <div class="chart-container">
            <canvas id="mainChart"></canvas>
         </div>
         <div class="data-table-container">
    `;

    const columns = Object.keys(data[0] || {});
    html += `<table class="data-table"><thead><tr>`;
    columns.forEach(col => { html += `<th>${col.substring(0,25)}</th>`; });
    html += `</tr></thead><tbody>`;

    const renderData = data.slice(0, 40);
    renderData.forEach(row => {
      html += `<tr>`;
      columns.forEach(col => {
        let cellValue = row[col];
        html += `<td>${cellValue !== undefined ? cellValue : ''}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    html += `</div>`; 

    contentArea.innerHTML = html;

    attachUploadEvent(`update_${currentTab}`, currentTab, '.csv');

    setTimeout(() => {
        document.getElementById(`export_${currentTab}`)?.addEventListener('click', () => {
            exportToExcel(data, currentTab);
        });

        // Boton exclusivo para descargar el detalle de los pallets en Buffer
        if(detailsBufferData) {
           document.getElementById(`export_details_buffer`)?.addEventListener('click', () => {
              exportToExcel(detailsBufferData, 'pallets_a_bajar_buffer');
           });
        }
    }, 50);

    if(kpis) {
       setTimeout(() => {
         const canvas = document.getElementById('mainChart');
         if(canvas) {
           const ctx = canvas.getContext('2d');
           currentChart = new Chart(ctx, {
              type: 'bar',
              data: {
                 labels: ['Exitosos/Completos', 'Pendientes', 'Mermas/Otros'],
                 datasets: [{
                    label: 'Volumen',
                    data: [kpis.completed, kpis.pending, kpis.totalRecords - kpis.completed - kpis.pending],
                    backgroundColor: ['#22c55e', '#ef4444', '#94a3b8']
                 }]
              },
              options: {
                 responsive: true, maintainAspectRatio: false,
                 plugins: { legend: { labels: { color: '#f8fafc' } } }
              }
           });
         }
       }, 100);
    }
  };

  // =============================================
  // VISTA CONFIGURACIÓN (Solo Admin) - Sub-Pestañas
  // =============================================
  const AVAILABLE_ROLES = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'];
  const MODULE_LABELS = {
    stock: '🏦 Stock General',
    inventario: '📋 Inventario (Ciclo)',
    picking: '🛒 Picking',
    packing: '📦 Packing',
    despacho: '🚚 Despacho',
    recepcion: '📥 Recepción',
    almacenaje: '🏭 Almacenaje',
    buffer: '⏳ Zona Buffer'
  };

  let configSubTab = 'usuarios';

  const renderConfigTab = async () => {
    contentArea.innerHTML = `
      <div style="margin-bottom:1.5rem; display:flex; gap:0; border-bottom: 2px solid var(--border);">
        <button class="config-sub-btn ${configSubTab === 'usuarios' ? 'active' : ''}" data-sub="usuarios" style="padding:0.7rem 1.5rem; background:${configSubTab === 'usuarios' ? 'var(--primary)' : 'transparent'}; color:${configSubTab === 'usuarios' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${configSubTab === 'usuarios' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500; transition: all 0.2s;">
          👥 Usuarios
        </button>
        <button class="config-sub-btn ${configSubTab === 'permisos' ? 'active' : ''}" data-sub="permisos" style="padding:0.7rem 1.5rem; background:${configSubTab === 'permisos' ? 'var(--primary)' : 'transparent'}; color:${configSubTab === 'permisos' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${configSubTab === 'permisos' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500; transition: all 0.2s;">
          🛡️ Permisos
        </button>
        <button class="config-sub-btn ${configSubTab === 'logs' ? 'active' : ''}" data-sub="logs" style="padding:0.7rem 1.5rem; background:${configSubTab === 'logs' ? 'var(--primary)' : 'transparent'}; color:${configSubTab === 'logs' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${configSubTab === 'logs' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500; transition: all 0.2s;">
          📋 LOG de Auditoría
        </button>
        <button class="config-sub-btn ${configSubTab === 'mantenimiento' ? 'active' : ''}" data-sub="mantenimiento" style="padding:0.7rem 1.5rem; background:${configSubTab === 'mantenimiento' ? 'var(--primary)' : 'transparent'}; color:${configSubTab === 'mantenimiento' ? '#fff' : 'var(--text-muted)'}; border:none; border-bottom:${configSubTab === 'mantenimiento' ? '3px solid var(--primary)' : 'none'}; cursor:pointer; font-family:inherit; font-size:0.9rem; font-weight:500; transition: all 0.2s;">
          🛠️ Mantenimiento
        </button>
      </div>
      <div id="configContent"></div>
    `;

    document.querySelectorAll('.config-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        configSubTab = btn.dataset.sub;
        renderConfigTab();
      });
    });

    const configContent = document.getElementById('configContent');
    if (configSubTab === 'usuarios') {
      await renderUsersSubTab(configContent);
    } else if (configSubTab === 'permisos') {
      await renderPermissionsSubTab(configContent);
    } else if (configSubTab === 'logs') {
      await renderLogsSubTab(configContent);
    } else {
      renderMaintenanceSubTab(configContent);
    }
  };

  // ---- SUB-PESTAÑA: MANTENIMIENTO ----
  const renderMaintenanceSubTab = (container) => {
    container.innerHTML = `
      <div class="glass-panel" style="max-width:600px; margin:2rem auto; padding:2rem; border:1px solid var(--border);">
        <h3 style="color:var(--primary); margin-bottom:1.2rem; display:flex; align-items:center; gap:0.5rem;">
           <i class="fas fa-tools"></i> Mantenimiento del Sistema
        </h3>
        
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
          <h4 style="color:#fff; margin-bottom:0.5rem;">Limpieza de Navegador (Caché)</h4>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">
            Esto borrará todos los archivos temporales y datos de stock guardados localmente en este equipo. 
            Útil si la página se siente pesada o si los datos no se actualizan correctamente.
          </p>
          <button id="btn_clear_cache" class="btn" style="background:var(--danger); width:auto; padding:0.6rem 1.5rem;">
            🗑️ BORRAR CACHÉ Y REINICIAR
          </button>
        </div>

        <div style="background:rgba(34,197,94,0.05); border:1px solid var(--success); border-radius:12px; padding:1.5rem;">
          <h4 style="color:var(--success); margin-bottom:0.5rem;">Refresco Forzado (Código Nuevo)</h4>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.8rem;">
            Para asegurar que estás usando la versión más reciente del sistema con todas las optimizaciones, presiona:
          </p>
          <div style="background:var(--bg-main); padding:0.8rem; border-radius:8px; text-align:center; font-family:monospace; border:1px solid var(--border); font-weight:700; color:var(--primary); font-size:1.2rem; letter-spacing:2px;">
            CTRL + SHIFT + R
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.8rem; text-align:center;">(O mantén presionado CTRL mientras haces clic en el botón de Recargar del navegador)</p>
        </div>
      </div>
    `;

    document.getElementById('btn_clear_cache').addEventListener('click', () => {
      if (confirm('¿Estás seguro de borrar toda la caché local? Deberás volver a iniciar sesión.')) {
        localStorage.clear();
        window.location.reload();
      }
    });
  };

  // ---- SUB-PESTAÑA: USUARIOS ----
  const renderUsersSubTab = async (container) => {
    container.innerHTML = `
      <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
        <i class="fas fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i>
        <p style="margin-top:1rem;">Cargando usuarios desde el servidor...</p>
      </div>
    `;

    let users = [];
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) {
        const data = await res.json();
        users = data.users || [];
      }
    } catch (e) {
      container.innerHTML = '<div style="color:var(--danger); padding:2rem; text-align:center;">⚠️ No se pudo conectar al servidor.</div>';
      return;
    }

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <span style="color:var(--text-muted); font-size:0.9rem;">Total: <strong style="color:var(--text-main)">${users.length}</strong> usuarios registrados</span>
        <button id="btnAddUser" class="btn" style="width:auto; padding:0.5rem 1.2rem; background: var(--success); font-size:0.85rem;">➕ Crear Nuevo Usuario</button>
      </div>
      <div id="userFormArea" style="display:none; margin-bottom:1.5rem;"></div>
      <div class="data-table-container" style="border: 1px solid var(--border);">
        <table class="data-table" id="usersTable">
          <thead><tr><th>ID</th><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Creado</th><th style="text-align:center;">Acciones</th></tr></thead>
          <tbody>
    `;

    users.forEach(u => {
      const isActive = u.active === 1;
      const statusColor = isActive ? 'var(--success)' : 'var(--danger)';
      const statusText = isActive ? '✅ Activo' : '🚫 Inactivo';
      const isAdmin = u.role === 'admin';
      html += `
        <tr style="${!isActive ? 'opacity: 0.5;' : ''}">
          <td style="color:var(--text-muted); font-size:0.8rem;">${u.id}</td>
          <td style="font-weight:600; color:var(--primary);">${u.username}</td>
          <td>${u.name}</td>
          <td><span style="background:${isAdmin ? 'rgba(239,68,68,0.2)' : 'rgba(79,70,229,0.2)'}; color:${isAdmin ? 'var(--danger)' : 'var(--primary)'}; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:500;">${u.role.toUpperCase()}</span></td>
          <td style="color:${statusColor}; font-size:0.85rem;">${statusText}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${u.created_at ? u.created_at.split(' ')[0] : '-'}</td>
          <td style="text-align:center;">
            <div style="display:flex; gap:0.4rem; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-edit-user" data-id="${u.id}" data-username="${u.username}" data-name="${u.name}" data-role="${u.role}" style="width:auto; padding:0.25rem 0.6rem; font-size:0.75rem; background:var(--primary);">✏️ Editar</button>
              <button class="btn btn-toggle-user" data-id="${u.id}" data-active="${u.active}" style="width:auto; padding:0.25rem 0.6rem; font-size:0.75rem; background:${isActive ? 'var(--warning)' : 'var(--success)'}; color:${isActive ? '#000' : '#fff'};">${isActive ? '⏸ Desactivar' : '▶ Activar'}</button>
              ${!isAdmin ? `<button class="btn btn-delete-user" data-id="${u.id}" data-name="${u.name}" style="width:auto; padding:0.25rem 0.6rem; font-size:0.75rem; background:var(--danger);">🗑️</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Wiring
    document.getElementById('btnAddUser')?.addEventListener('click', () => showUserForm(null, container));
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => showUserForm({ id: btn.dataset.id, username: btn.dataset.username, name: btn.dataset.name, role: btn.dataset.role }, container));
    });
    document.querySelectorAll('.btn-toggle-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const newActive = btn.dataset.active === '1' ? 0 : 1;
          await fetch(`${API_BASE}/users/${btn.dataset.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ active: newActive }) });
          await logSystemAction(user.username, 'USUARIO_ESTADO', `${newActive ? 'Activado' : 'Desactivado'} usuario ID: ${btn.dataset.id}`);
          await renderUsersSubTab(container);
        } catch(e) { alert('Error al cambiar estado.'); }
      });
    });
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar permanentemente al usuario "${btn.dataset.name}"?`)) return;
        try {
          await fetch(`${API_BASE}/users/${btn.dataset.id}`, { method: 'DELETE' });
          await logSystemAction(user.username, 'USUARIO_ELIMINAR', `Eliminado usuario: ${btn.dataset.name}`);
          await renderUsersSubTab(container);
        } catch(e) { alert('Error al eliminar.'); }
      });
    });
  };

  const showUserForm = (editUser, container) => {
    const formArea = document.getElementById('userFormArea');
    if (!formArea) return;
    const isEdit = editUser && editUser.id;
    const title = isEdit ? '✏️ Editar Usuario' : '➕ Nuevo Usuario';
    const roleOptions = AVAILABLE_ROLES.map(r => `<option value="${r}" ${isEdit && editUser.role === r ? 'selected' : ''}>${r.toUpperCase()}</option>`).join('');

    formArea.style.display = 'block';
    
    let selectedRole = isEdit ? editUser.role : 'asistente';

    const updateCustomSelect = () => {
      const trigger = document.getElementById('customRoleTrigger');
      if (trigger) trigger.textContent = selectedRole.toUpperCase();
      document.querySelectorAll('.custom-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === selectedRole);
      });
    };

    formArea.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--primary); border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(79,70,229,0.15);">
        <h3 style="color:var(--primary); margin-bottom:1rem;">${title}</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
          <div><label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.3rem;">Usuario (login)</label><input type="text" id="formUsername" value="${isEdit ? editUser.username : ''}" placeholder="ej: picker2" style="width:100%; padding:0.5rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border); border-radius:8px; font-family:inherit;"></div>
          <div><label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.3rem;">Nombre Completo</label><input type="text" id="formName" value="${isEdit ? editUser.name : ''}" placeholder="ej: Juan Pérez" style="width:100%; padding:0.5rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border); border-radius:8px; font-family:inherit;"></div>
          <div><label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.3rem;">Contraseña ${isEdit ? '(vacío = no cambiar)' : ''}</label><input type="text" id="formPassword" placeholder="${isEdit ? '••••••' : 'Contraseña'}" style="width:100%; padding:0.5rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border); border-radius:8px; font-family:inherit;"></div>
          
          <div>
            <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.3rem;">Rol / Privilegio</label>
            <div class="custom-select-container" id="roleSelector" style="width:100%;">
              <div class="custom-select-trigger" id="customRoleTrigger" style="padding:0.5rem; background:var(--bg-main); border-radius:8px;">${selectedRole.toUpperCase()}</div>
              <div class="custom-select-options">
                ${AVAILABLE_ROLES.map(r => `
                  <div class="custom-option ${r === selectedRole ? 'selected' : ''}" data-value="${r}">${r.toUpperCase()}</div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:1rem; display:flex; gap:0.7rem;">
          <button id="btnSubmitUser" class="btn" style="width:auto; padding:0.5rem 1.5rem; background:var(--success); font-size:0.85rem;">💾 Guardar</button>
          <button id="btnCancelUser" class="btn" style="width:auto; padding:0.5rem 1.5rem; background:rgba(255,255,255,0.1); color:var(--text-muted); border:1px solid var(--border); font-size:0.85rem;">Cancelar</button>
        </div>
        <div id="formError" style="color:var(--danger); margin-top:0.7rem; font-size:0.85rem;"></div>
      </div>
    `;

    // Lógica del Custom Select
    const selector = document.getElementById('roleSelector');
    selector.addEventListener('click', (e) => {
      selector.classList.toggle('open');
      e.stopPropagation();
    });

    document.querySelectorAll('.custom-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        selectedRole = e.target.dataset.value;
        updateCustomSelect();
        selector.classList.remove('open');
        e.stopPropagation();
      });
    });

    window.addEventListener('click', () => selector.classList.remove('open'));

    document.getElementById('btnCancelUser').addEventListener('click', () => { formArea.style.display = 'none'; formArea.innerHTML = ''; });
    document.getElementById('btnSubmitUser').addEventListener('click', async () => {
      const username = document.getElementById('formUsername').value.trim();
      const name = document.getElementById('formName').value.trim();
      const password = document.getElementById('formPassword').value.trim();
      const role = selectedRole;
      const errDiv = document.getElementById('formError');
      if (!username || !name) { errDiv.textContent = 'Usuario y Nombre son obligatorios.'; return; }
      if (!isEdit && !password) { errDiv.textContent = 'La contraseña es obligatoria para nuevos.'; return; }
      try {
        let res;
        if (isEdit) {
          const body = { username, name, role };
          if (password) body.password = password;
          res = await fetch(`${API_BASE}/users/${editUser.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
        } else {
          res = await fetch(`${API_BASE}/users`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username, password, name, role }) });
        }
        const result = await res.json();
        if (result.status === 'error') { errDiv.textContent = result.message; return; }
        await logSystemAction(user.username, isEdit ? 'USUARIO_EDITAR' : 'USUARIO_CREAR', `Usuario: ${username}`);
        formArea.style.display = 'none'; formArea.innerHTML = '';
        await renderUsersSubTab(container);
      } catch (e) { errDiv.textContent = 'Error de red al guardar.'; }
    });
  };

  // ---- SUB-PESTAÑA: ZONA DE PERMISOS ----
  const renderPermissionsSubTab = async (container) => {
    container.innerHTML = `
      <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
        <i class="fas fa-circle-notch fa-spin fa-2x" style="color: var(--primary);"></i>
        <p style="margin-top:1rem;">Cargando matriz de permisos...</p>
      </div>
    `;

    let permissions = {};
    try {
      const res = await fetch(`${API_BASE}/permissions`);
      if (res.ok) {
        const data = await res.json();
        permissions = data.permissions || {};
      }
    } catch (e) {
      container.innerHTML = '<div style="color:var(--danger); padding:2rem; text-align:center;">⚠️ No se pudo conectar al servidor.</div>';
      return;
    }

    const modules = Object.keys(MODULE_LABELS);
    const roles = AVAILABLE_ROLES.filter(r => r !== 'admin'); // Admin siempre ve todo

    let html = `
      <div style="margin-bottom:1.5rem;">
        <p style="color:var(--text-muted); font-size:0.9rem;">
          🛡️ Controla qué módulos puede ver cada rol. El rol <strong style="color:var(--danger)">ADMIN</strong> siempre tiene acceso completo.
        </p>
      </div>
      <div id="permSaveStatus" style="display:none; margin-bottom:1rem;"></div>
    `;

    // Crear una tarjeta por cada rol
    roles.forEach(role => {
      const rolePerms = permissions[role] || {};
      html += `
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; transition: box-shadow 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; flex-wrap:wrap; gap:0.5rem;">
            <h3 style="margin:0; font-size:1rem; color:var(--primary); font-weight:600;">👤 ${role.toUpperCase()}</h3>
            <button class="btn btn-save-perms" data-role="${role}" style="width:auto; padding:0.3rem 1rem; font-size:0.8rem; background:var(--primary);">💾 Guardar Cambios</button>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:0.6rem;">
      `;

      modules.forEach(mod => {
        const isAllowed = rolePerms[mod] === 1;
        html += `
          <label style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.8rem; background:${isAllowed ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${isAllowed ? 'rgba(34,197,94,0.3)' : 'var(--border)'}; border-radius:8px; cursor:pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(79,70,229,0.1)'" onmouseout="this.style.background='${isAllowed ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)'}'">
            <input type="checkbox" class="perm-check" data-role="${role}" data-module="${mod}" ${isAllowed ? 'checked' : ''}
              style="width:18px; height:18px; accent-color: var(--success); cursor:pointer;">
            <span style="font-size:0.85rem; color:var(--text-main);">${MODULE_LABELS[mod]}</span>
          </label>
        `;
      });

      html += '</div></div>';
    });

    container.innerHTML = html;

    // Wiring: Guardar permisos por rol
    document.querySelectorAll('.btn-save-perms').forEach(btn => {
      btn.addEventListener('click', async () => {
        const role = btn.dataset.role;
        const checkboxes = document.querySelectorAll(`.perm-check[data-role="${role}"]`);
        const modulesPayload = {};
        checkboxes.forEach(cb => {
          modulesPayload[cb.dataset.module] = cb.checked ? 1 : 0;
        });

        btn.textContent = '⏳ Guardando...';
        btn.style.opacity = '0.6';

        try {
          const res = await fetch(`${API_BASE}/permissions/${role}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ modules: modulesPayload })
          });
          const result = await res.json();
          if (result.status === 'success') {
            await logSystemAction(user.username, 'PERMISOS_GUARDAR', `Actualizados permisos para el rol: ${role.toUpperCase()}`);
            btn.textContent = '✅ Guardado!';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
              btn.textContent = '💾 Guardar Cambios';
              btn.style.background = 'var(--primary)';
              btn.style.opacity = '1';
            }, 2000);
          }
        } catch (e) {
          btn.textContent = '❌ Error';
          btn.style.background = 'var(--danger)';
          setTimeout(() => {
            btn.textContent = '💾 Guardar Cambios';
            btn.style.background = 'var(--primary)';
            btn.style.opacity = '1';
          }, 2000);
        }
      });
    });
  };

  document.getElementById('logoutBtn').addEventListener('click', () => { logout(); onLogout(); });
  renderNav();
  renderTabContent();
};
