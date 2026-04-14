import { logout } from '../services/auth.js';
import { parseFile, getAreaData, generateKPIs, calculateBufferPallets, dataStore } from '../services/csvHub.js';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'inventario', 'picking', 'packing', 'despacho', 'recepcion', 'almacenaje', 'buffer'] },
  { id: 'stock', label: 'Stock General', icon: '🏦', roles: ['admin', 'inventario'] },
  { id: 'inventario', label: 'Inventario (Ciclo)', icon: '📋', roles: ['admin', 'inventario'] },
  { id: 'picking', label: 'Picking', icon: '🛒', roles: ['admin', 'picking'] },
  { id: 'packing', label: 'Packing', icon: '📦', roles: ['admin', 'packing'] },
  { id: 'despacho', label: 'Despacho', icon: '🚚', roles: ['admin', 'despacho'] },
  { id: 'recepcion', label: 'Recepción', icon: '📥', roles: ['admin', 'recepcion'] },
  { id: 'almacenaje', label: 'Almacenaje', icon: '🏭', roles: ['admin', 'almacenaje'] },
  { id: 'buffer', label: 'Zona Buffer', icon: '⏳', roles: ['admin', 'buffer'] }
];

let currentChart = null;

// UTIL: Exportador XLSX universal
const exportToExcel = (data, filename) => {
    if(!data || !data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
};

export const renderDashboard = (container, user, onLogout) => {
  container.className = 'dashboard-layout animate-fade-in';

  const allowedTabs = TABS.filter(tab => tab.roles.includes(user.role) || tab.roles.includes('admin') && user.role === 'admin');
  let currentTab = allowedTabs[0]?.id;

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <h2>Panel Logístico Elite</h2>
      </div>
      <div class="user-profile">
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

    if (currentTab === 'inicio') {
      contentSubtitle.textContent = "Control Maestro de Operaciones";
      renderHomeTab(); // Will await inside
    } else if (currentTab === 'stock') {
      contentSubtitle.textContent = "Centro de Carga Maestro (Kardex)";
      await renderStockUploads();
    } else if (currentTab === 'buffer') {
      contentSubtitle.textContent = "Zona Transicional y Reposición";
      await renderBufferTab();
    } else {
      contentSubtitle.textContent = "Vista Analítica Operativa";
      const savedData = await getAreaData(currentTab);
      if (!savedData) renderUploadArea();
      else renderDashboardView(savedData);
    }
  };

  // VISTA INICIO: MACRO DASHBOARD
  const renderHomeTab = async () => {
    let html = `
      <div style="text-align:center; padding-bottom: 2rem;">
         <h2 style="font-weight:400;">Bienvenido, ${user.name}</h2>
         <p style="color:var(--text-muted); font-size:0.9rem;">Visión global de memorias maestras alojadas en Base de Datos</p>
      </div>
      <div class="kpi-grid">
    `;

    const areasValidas = ['stockActivo', 'stockReserva', 'inventario', 'picking', 'packing', 'despacho', 'recepcion'];
    
    let totalCargas = 0;
    // Debemos recorrer con for...of para permitir await
    for (let a of areasValidas) {
        const rows = await getAreaData(a);
        if(rows && rows.length > 0) {
           totalCargas++;
           const titleName = a === 'stockActivo'? 'Stock Activo': a === 'stockReserva'? 'Stock Reserva': a.toUpperCase();
           html += `
             <div class="kpi-card" style="border-left: 4px solid var(--primary);">
                <div class="kpi-title">${titleName}</div>
                <div class="kpi-value">${rows.length}</div>
                <div class="kpi-subtitle" style="color:var(--text-muted)">Registros en DB</div>
             </div>
           `;
        }
    }

    if (totalCargas === 0) {
        html += `
          <div class="kpi-card" style="grid-column: 1 / -1; text-align:center; padding: 3rem;">
             La Base de Datos está vacía. 
             <br><br>Ve a las pestañas individuales y sube tus Excel/CSV para ver las analíticas globales aquí.
          </div>
        `;
    }
    
    html += `</div>`;
    contentArea.innerHTML = html;
  };

  // VISTA STOCK CARGA
  const renderStockUploads = async () => {
    const actData = await getAreaData('stockActivo');
    const resData = await getAreaData('stockReserva');

    contentArea.innerHTML = ''; 
    htmlStockUpload(`Stock Activo (.csv)`, 'stockActivo', actData, '.csv');
    htmlStockUpload(`Stock Reserva (.xlsx)`, 'stockReserva', resData, '.xlsx');
  };

  const htmlStockUpload = (title, areaKey, hasData, ext) => {
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

    contentArea.appendChild(div);

    attachUploadEvent(hasData ? `update_${areaKey}` : `input_${areaKey}`, areaKey, ext);

    if (hasData) {
        setTimeout(() => {
            document.getElementById(`export_${areaKey}`)?.addEventListener('click', () => {
                exportToExcel(hasData, areaKey);
            });
        }, 50);
    }
  };

  const attachUploadEvent = (domId, areaKey, ext) => {
      setTimeout(() => {
          const input = document.getElementById(domId);
          const err = document.getElementById(domId.replace('input_', 'err_').replace('update_','err_')); // fallback
          if(!input) return;
          input.addEventListener('change', async (e) => {
              const file = e.target.files[0];
              if(!file || !file.name.endsWith(ext)) {
                  if(err) err.innerText = `Requerido formato ${ext}`; return;
              }
              if(err) { err.style.color = "var(--text-main)"; err.innerText = "Subiendo a Base de Datos..."; }
              try {
                  await parseFile(file, areaKey);
                  // Refresh via state load
                  renderTabContent();
              } catch(error) {
                  if(err) { err.style.color = "var(--danger)"; err.innerText = `Error DB: ${error.message || 'Corrupto'}`; }
                  else alert("Error analizando el archivo: Formato incorrecto.");
              }
          });
      }, 50);
  };

  // VISTA BUFFER
  const renderBufferTab = async () => {
     const bufferData = await getAreaData('buffer');
     await getAreaData('stockActivo'); // Forzar hidratar antes
     await getAreaData('stockReserva'); // Forzar hidratar antes
     
     const bufferKPIObj = calculateBufferPallets(); 

     let kpiExtraHTML = '';
     if (bufferKPIObj && bufferKPIObj.totalPallets >= 0) {
         kpiExtraHTML = `
           <div class="kpi-card" style="border: 2px solid var(--primary); background:rgba(79, 70, 229, 0.2);">
             <div class="kpi-title" style="color:var(--text-main)">ESTIBAS (LPN) A REPOner</div>
             <div class="kpi-value">${bufferKPIObj.totalPallets}</div>
             <div class="kpi-subtitle" style="color:var(--text-main)">Listas para descender (Revisa en Descargar Reporte)</div>
           </div>
         `;
     } else {
         kpiExtraHTML = `
           <div class="kpi-card" style="border: 1px dashed var(--warning)">
             <div class="kpi-title">MÉTRICA RELACIONAL NO DISPONIBLE</div>
             <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem">Sube Stock Activo y Reserva en la pestaña "Stock" para calcular.</div>
           </div>
         `;
     }

     if (!bufferData) {
         contentArea.innerHTML = `
           <div style="margin-bottom:2rem">${kpiExtraHTML}</div>
           <div class="upload-area" id="drop_buffer">
             <h3>Aquí sube tu archivo de pedidos (.csv)</h3>
             <label class="upload-btn">Cargar CSV<input type="file" id="input_buffer" accept=".csv" style="display:none;"></label>
             <div id="err_buffer" style="color:var(--danger); margin-top:1rem;"></div>
           </div>
         `;
         attachUploadEvent('input_buffer', 'buffer', '.csv');
     } else {
         renderDashboardView(bufferData, kpiExtraHTML, bufferKPIObj?.detalle);
     }
  };

  const renderUploadArea = () => {
    contentArea.innerHTML = `
      <div class="upload-area">
        <h3>Sube tu archivo CSV de ${currentTab.toUpperCase()}</h3>
        <label class="upload-btn">
          Seleccionar Archivo
          <input type="file" id="input_${currentTab}" accept=".csv" style="display:none;">
        </label>
        <div id="err_${currentTab}" style="color:var(--danger); margin-top:1rem;"></div>
      </div>
    `;
    attachUploadEvent(`input_${currentTab}`, currentTab, '.csv');
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

  document.getElementById('logoutBtn').addEventListener('click', () => { logout(); onLogout(); });
  renderNav();
  renderTabContent();
};
