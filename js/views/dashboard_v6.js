/**
 * Dashboard View Module v17.4.7 - PRODUCTION
 * Centralized Logic for Logistics, Performance, and Almacenaje
 * CLEANED FROM BETA BRANDING
 */

import { adminService } from '../services/adminService.js?v=17.4.7';
import { 
  dataStore, 
  getAreaData, 
  calculateBufferPallets, 
  fetchBufferHistory, 
  saveBufferReport, 
  updateTablaTallas 
} from '../services/csvHub_v6.js?v=17.4.7';

export const renderDashboard = async (container, user, onLogout) => {
  if (!container) return;

  // State Management
  let currentTab = localStorage.getItem('pulse_current_tab') || 'inicio';
  let activeAdminSub = localStorage.getItem('pulse_admin_sub') || 'asistencia';
  let activeBufferSub = localStorage.getItem('pulse_buffer_sub') || 'configuracion';
  let activeConfigSub = 'parametros';
  let activeAnalisisSub = 'articulo_temp';
  let activePerfSub = 'historial';
  let almacenajeTaskMode = localStorage.getItem('almacenajeTaskMode') || 'resumen';
  let expandedWeeks = [];

  const CACHE_KEY = 'logistics_admin_v11_';
  let lastBufferKPI = JSON.parse(localStorage.getItem('lastBufferKPI')) || null;

  // --- PERMISSION SYSTEM ---
  const TABS = [
    { id: 'inicio', label: 'Inicio', icon: '🏠', role: 'all' },
    { id: 'zona_buffer', label: 'Zona Buffer', icon: '📦', role: 'all', subTabs: [
        { id: 'configuracion', label: 'Carga de Datos', icon: '📥' },
        { id: 'procesamiento', label: 'Procesamiento', icon: '⚙️' },
        { id: 'reportes', label: 'Reportes', icon: '📊' },
        { id: 'historial', label: 'Historial', icon: '📅' },
        { id: 'kpi', label: 'Indicadores', icon: '📈' }
    ]},
    { id: 'almacenaje', label: 'Almacenaje', icon: '🏗️', role: 'all', subTabs: [
        { id: 'archivo_almacenaje', label: 'Archivo', icon: '📂' },
        { id: 'tareas_dia', label: 'Tareas del Día', icon: '📋' },
        { id: 'kpi_tareas', label: 'Rendimiento', icon: '📊' }
    ]},
    { id: 'analisis_sku', label: 'Análisis SKU', icon: '🔍', role: 'admin', subTabs: [
        { id: 'archivo_analisis', label: 'Archivo', icon: '📂' },
        { id: 'articulo_temp', label: 'Art. x Temporada', icon: '🏷️' }
    ]},
    { id: 'admin_pers', label: 'Administración', icon: '🔐', role: 'admin', subTabs: [
        { id: 'asistencia', label: 'Asistencia', icon: '👥' },
        { id: 'performance', label: 'Performance', icon: '📈', subTabs: [
            { id: 'historial', label: 'Historial', icon: '📅' },
            { id: 'graficos', label: 'Gráficos', icon: '📊' },
            { id: 'reporte', label: 'Reporte', icon: '📋' }
        ]},
        { id: 'usuarios', label: 'Usuarios', icon: '👤' },
        { id: 'rf_management', label: 'Equipos RF', icon: '🔋' }
    ]},
    { id: 'config', label: 'Configuración', icon: '⚙️', role: 'admin' }
  ];

  // Helper Functions
  const getLogicalDate = () => {
      const now = new Date();
      const hours = now.getHours();
      if (hours < 6) {
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return yesterday.toISOString().split('T')[0];
      }
      return now.toISOString().split('T')[0];
  };

  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  };

  // --- RENDER BASE LAYOUT ---
  container.innerHTML = `
    <div class="dashboard-layout">
        <header class="topbar">
            <div class="topbar-brand">
                <h2>LOGÍSTICA <span style="color:var(--primary); font-weight:800;">DEAM1830</span></h2>
            </div>
            <div class="user-profile">
                <div class="user-details">
                    <span class="user-name">${user.name}</span>
                    <span class="user-role">${user.role.toUpperCase()}</span>
                </div>
                <button id="logoutBtn" class="btn-logout" title="Cerrar Sesión">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </header>

        <nav class="top-nav-links" id="topNavLinks"></nav>

        <main class="main-wrapper">
            <header class="tab-header">
                <div class="header-titles">
                    <h1 id="tabTitle">Bienvenido</h1>
                </div>
                <div id="headerActions"></div>
            </header>
            <div id="tabContent" class="tab-content"></div>
        </main>
    </div>
  `;

  const topNavLinks = document.getElementById('topNavLinks');
  const tabTitle = document.getElementById('tabTitle');
  const tabContent = document.getElementById('tabContent');

  const renderNav = () => {
    topNavLinks.innerHTML = TABS
      .filter(tab => {
          if (tab.role === 'all') return true;
          return tab.role === user.role || user.role === 'admin';
      })
      .map(tab => `
        <a class="nav-item ${currentTab === tab.id ? 'active' : ''}" data-id="${tab.id}">
            ${tab.icon} ${tab.label}
        </a>
      `).join('');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            currentTab = item.dataset.id;
            localStorage.setItem('pulse_current_tab', currentTab);
            renderNav();
            renderTabContent();
        };
    });
  };

  const renderTabContent = async (isRefresh = false) => {
    const tab = TABS.find(t => t.id === currentTab);
    if (!tab) return;
    
    tabTitle.textContent = tab.label;
    
    if (currentTab === 'inicio') {
        renderInicioTab();
    } else if (currentTab === 'zona_buffer') {
        renderBufferTab();
    } else if (currentTab === 'almacenaje') {
        renderGenericAreaTab('almacenaje', 'Control de Ubicaciones y Tareas');
    } else if (currentTab === 'analisis_sku') {
        renderAnalisisSKUTab();
    } else if (currentTab === 'admin_pers') {
        renderAdminTab();
    } else if (currentTab === 'config') {
        renderConfigTab();
    }
  };

  // --- TAB: INICIO ---
  const renderInicioTab = () => {
    const workers = adminService.getWorkers();
    const activeWorkers = workers.filter(w => w.active).length;
    
    tabContent.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">OPERARIOS EN TURNO</span>
                <span class="kpi-value">${activeWorkers}</span>
                <span class="kpi-subtitle">Personal activo hoy</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">FECHA DE OPERACIÓN</span>
                <span class="kpi-value">${new Date().toLocaleDateString('es-PE')}</span>
                <span class="kpi-subtitle">Sistema v17.4.7</span>
            </div>
        </div>
        <div class="dashboard-body">
            <div class="chart-container">
                <canvas id="mainChart"></canvas>
            </div>
            <div class="glass-panel" style="padding:1.5rem;">
                <h4>Accesos Rápidos</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:1rem;">
                    <button class="btn secondary" onclick="document.querySelector('[data-id=admin_pers]').click()">ASISTENCIA</button>
                    <button class="btn secondary" onclick="document.querySelector('[data-id=zona_buffer]').click()">BUFFER</button>
                    <button class="btn secondary" onclick="document.querySelector('[data-id=almacenaje]').click()">ALMACENAJE</button>
                    <button class="btn secondary" onclick="document.querySelector('[data-id=analisis_sku]').click()">ANALÍTICA</button>
                </div>
            </div>
        </div>
    `;
  };

  // --- TAB: ZONA BUFFER ---
  const renderBufferTab = () => {
    contentSubtitle.textContent = "Cálculo de Palletización y Eficiencia de Llenado";
    const tabDef = TABS.find(t => t.id === 'zona_buffer');
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`zona_buffer_${sub.id}`] === 1);

    if (!allowedSubTabs.find(s => s.id === activeBufferSub)) activeBufferSub = allowedSubTabs[0]?.id;

    tabContent.innerHTML = `
        <nav class="sub-nav">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeBufferSub === sub.id ? 'active' : ''}" data-id="${sub.id}">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav>
        <div id="bufferContent" class="buffer-content"></div>
    `;

    document.querySelectorAll('.sub-nav-item').forEach(item => {
        item.onclick = () => {
            activeBufferSub = item.dataset.id;
            localStorage.setItem('pulse_buffer_sub', activeBufferSub);
            renderBufferTab();
        };
    });

    const bufContent = document.getElementById('bufferContent');
    if (activeBufferSub === 'configuracion') {
        const wrap = document.createElement('div'); wrap.className = 'upload-stack';
        renderUploadArea(wrap, 'buffer_activo', dataStore.buffer_activo, '.csv', 'STOCK ACTIVO (BUFFER)');
        renderUploadArea(wrap, 'buffer_reserva', dataStore.buffer_reserva, '.xlsx', 'STOCK RESERVA (BUFFER)');
        renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv', 'PEDIDOS / DEMANDA');
        renderUploadArea(wrap, 'solicitud', dataStore.solicitud, '.xlsx', 'OTRAS SOLICITUDES');
        renderUploadArea(wrap, 'tallas', dataStore.tallas, '.xlsx', 'REPLENISHMENT');
        renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx', 'MAESTRO ARTÍCULOS');
        bufContent.appendChild(wrap);
    } else if (activeBufferSub === 'procesamiento') {
        renderBufferProcess(bufContent);
    } else if (activeBufferSub === 'reportes') {
        renderBufferReport(bufContent);
    } else if (activeBufferSub === 'historial') {
        renderBufferHistory(bufContent);
    } else if (activeBufferSub === 'kpi') {
        renderBufferKPI(bufContent);
    }
  };

  const renderBufferProcess = (container) => {
    container.innerHTML = `
        <div class="glass-panel process-panel animate-fade-in">
            <div class="process-header">
                <div class="process-icon">⚡</div>
                <h4>Motor de Cálculo Logístico</h4>
                <p>Presione el botón para procesar los datos cargados y generar el plan de palletización.</p>
            </div>
            <div class="process-actions">
                <button id="btnRunBuffer" class="btn primary-gradient">PROCESAR REPORTE BUFFER</button>
            </div>
            <div id="processStatus" class="process-status"></div>
        </div>
    `;
    
    document.getElementById('btnRunBuffer').onclick = async () => {
        const status = document.getElementById('processStatus');
        const btn = document.getElementById('btnRunBuffer');
        
        if (!dataStore.buffer_activo || !dataStore.buffer_reserva || !dataStore.articulos) {
            alert("⚠️ Faltan archivos críticos: Asegúrese de cargar Stock Activo, Reserva y Maestro de Artículos.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '⚙️ CALCULANDO...';
        status.innerHTML = '<div class="spinner-small"></div> Analizando ubicaciones y prioridades...';

        setTimeout(async () => {
            try {
                const result = await calculateBufferPallets();
                if (result) {
                    lastBufferKPI = result;
                    localStorage.setItem('lastBufferKPI', JSON.stringify(result));
                    // Guardar en historial en la nube
                    await saveBufferReport(result, user.name);
                    alert("✅ Cálculo completado exitosamente.");
                    activeBufferSub = 'reportes';
                    renderBufferTab();
                } else {
                    alert("❌ El cálculo no generó resultados. Verifique la integridad de los datos.");
                    btn.disabled = false;
                    btn.innerHTML = 'PROCESAR REPORTE BUFFER';
                    status.innerHTML = '';
                }
            } catch (err) {
                console.error(err);
                alert("❌ Error crítico: " + err.message);
                btn.disabled = false;
                btn.innerHTML = 'PROCESAR REPORTE BUFFER';
            }
        }, 500);
    };
  };

  const renderBufferReport = (container) => {
    if (!lastBufferKPI) {
        container.innerHTML = `<div class="glass-panel empty-state"><h4>No hay reportes procesados</h4><p>Vaya a la pestaña Procesamiento para generar uno.</p></div>`;
        return;
    }

    const waterfall = lastBufferKPI.waterfall || [];
    const resumenSKU = lastBufferKPI.resumenSKU || [];

    container.innerHTML = `
        <div class="report-header-actions">
            <button id="btnExportBuffer" class="btn success"><i class="fas fa-file-excel"></i> EXPORTAR EXCEL</button>
        </div>
        <div class="report-grid">
            <div class="glass-panel report-card animate-slide-up">
                <h5>Eficiencia por Niveles (Waterfall)</h5>
                <table class="data-table">
                    <thead>
                        <tr class="yellow-header">
                            <th>NIVEL</th>
                            <th>RQ</th>
                            <th>ATD</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${waterfall.map(w => `
                            <tr class="${w.nivel === 'Total' ? 'total-row' : ''}">
                                <td>${w.nivel}</td>
                                <td>${w.rq.toLocaleString()}</td>
                                <td>${w.atd.toLocaleString()}</td>
                                <td><b>${w.pct}</b></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="glass-panel report-card animate-slide-up" style="animation-delay: 0.1s;">
                <h5>Resumen de Empaque (PAL/SKU)</h5>
                <table class="data-table">
                    <thead>
                        <tr class="yellow-header">
                            <th>FUENTE</th>
                            <th>TIPO</th>
                            <th>PAL</th>
                            <th>SKU</th>
                            <th>UNID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resumenSKU.map(r => `
                            <tr class="${r.isSubTotal ? 'subtotal-row' : ''}">
                                <td>${r.fuente}</td>
                                <td>${r.tipo}</td>
                                <td>${r.paletas}</td>
                                <td>${r.skus}</td>
                                <td>${r.parcaja.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('btnExportBuffer').onclick = () => {
        const detail = lastBufferKPI.detallePallets || [];
        if (!detail.length) return alert("No hay detalles para exportar.");
        const ws = XLSX.utils.json_to_sheet(detail);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Detalle_Palletizacion");
        XLSX.writeFile(wb, `Reporte_Buffer_${new Date().toISOString().split('T')[0]}.xlsx`);
    };
  };

  const renderBufferHistory = async (container) => {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando historial...</p></div>`;
    const history = await fetchBufferHistory();
    
    if (!history || history.length === 0) {
        container.innerHTML = `<div class="glass-panel empty-state"><h4>Sin historial</h4></div>`;
        return;
    }

    const sorted = [...history].sort((a,b) => new Date(b.created_at || b.ts) - new Date(a.created_at || a.ts));

    container.innerHTML = `
        <div class="glass-panel history-panel animate-fade-in">
            <h3 style="color:var(--primary); margin:0 0 1rem 0; font-size:1.1rem; font-weight:600;">Reporte de Buffer día</h3>
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr class="yellow-header">
                            <th>Semana</th>
                            <th>FECHA</th>
                            <th>FUENTE</th>
                            <th>NIVEL/AREA</th>
                            <th>PAL</th>
                            <th>SKU</th>
                            <th>ACCION</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((report, idx) => {
                            const ts = report.created_at || report.ts;
                            const dObj = new Date(ts);
                            const sem = getWeekNumber(dObj);
                            const dateStr = dObj.toLocaleDateString();
                            const data = report.data || {};
                            const totalUnits = data.totalReserva || 0;
                            return `
                                <tr>
                                    <td align="center">${sem}</td>
                                    <td>${dateStr}</td>
                                    <td>${data.sourceName || 'VARIOS'}</td>
                                    <td>CONSOLIDADO</td>
                                    <td align="center">---</td>
                                    <td align="center">---</td>
                                    <td align="center"><button class="btn-restore" data-idx="${idx}">👁️</button></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.querySelectorAll('.btn-restore').forEach(btn => {
        btn.onclick = () => {
            lastBufferKPI = sorted[btn.dataset.idx].data;
            activeBufferSub = 'reportes';
            renderBufferTab();
        };
    });
  };

  const renderBufferKPI = async (container) => {
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Generando visualizaciones...</p></div>`;
    const history = await fetchBufferHistory();
    
    if (!history || history.length < 2) {
        container.innerHTML = `<div class="glass-panel empty-state"><h4>Se necesitan al menos 2 reportes para mostrar tendencias.</h4></div>`;
        return;
    }

    container.innerHTML = `
        <div class="kpi-grid">
            <div class="glass-panel kpi-card">
                <h5>Tendencia de Eficiencia %</h5>
                <canvas id="chartTrend"></canvas>
            </div>
            <div class="glass-panel kpi-card">
                <h5>Volumen RQ vs ATD</h5>
                <canvas id="chartVolume"></canvas>
            </div>
        </div>
    `;

    setTimeout(() => {
        const sorted = [...history].sort((a,b) => new Date(a.created_at || a.ts) - new Date(b.created_at || b.ts)).slice(-10);
        const labels = sorted.map(h => new Date(h.created_at || h.ts).toLocaleDateString());
        
        const ctxTrend = document.getElementById('chartTrend')?.getContext('2d');
        if (ctxTrend) {
            new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Eficiencia %',
                        data: sorted.map(h => parseFloat(h.data?.waterfall?.find(w => w.nivel === 'Total')?.pct || 0)),
                        borderColor: '#4f46e5',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(79, 70, 229, 0.1)'
                    }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }
    }, 100);
  };

  // --- TAB: ADMINISTRACIÓN ---
  const renderAdminTab = () => {
    const tabDef = TABS.find(t => t.id === 'admin_pers');
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`admin_${sub.id}`] === 1);

    if (!allowedSubTabs.find(s => s.id === activeAdminSub)) activeAdminSub = allowedSubTabs[0]?.id;

    tabContent.innerHTML = `
        <nav class="sub-nav">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAdminSub === sub.id ? 'active' : ''}" data-id="${sub.id}">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav>
        <div id="adminContent" class="admin-content"></div>
    `;

    document.querySelectorAll('.sub-nav-item').forEach(item => {
        item.onclick = () => {
            activeAdminSub = item.dataset.id;
            localStorage.setItem('pulse_admin_sub', activeAdminSub);
            renderAdminTab();
        };
    });

    const adminContent = document.getElementById('adminContent');
    if (activeAdminSub === 'asistencia') renderAsistenciaSection(adminContent);
    else if (activeAdminSub === 'performance') renderPerformanceSection(adminContent);
    else if (activeAdminSub === 'usuarios') renderUsuariosSection(adminContent);
    else if (activeAdminSub === 'rf_management') renderRFSection(adminContent);
  };

  const renderAsistenciaSection = async (container) => {
    let forcedDate = getLogicalDate();
    let workers = adminService.getWorkers().filter(w => w.active);
    let attendance = adminService.getAttendanceForDate(forcedDate);

    container.innerHTML = `
        <div class="glass-panel attendance-panel animate-fade-in">
            <div class="panel-header">
                <h4>Control de Asistencia Diaria</h4>
                <div class="header-tools">
                    <input type="date" id="asist_date_picker" value="${forcedDate}" class="date-input">
                    <div id="topActions"></div>
                </div>
            </div>
            <div class="table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>DNI</th>
                            <th>NOMBRE COMPLETO</th>
                            <th align="center">ASISTENCIA</th>
                            <th align="center">PUNTUALIDAD</th>
                        </tr>
                    </thead>
                    <tbody id="attendanceBody"></tbody>
                </table>
            </div>
        </div>
    `;

    const body = document.getElementById('attendanceBody');
    const topActions = document.getElementById('topActions');

    const renderRows = () => {
        body.innerHTML = workers.map(w => {
            const att = attendance[w.dni] || { asistencia: 'P', puntualidad: 'SÍ' };
            return `
                <tr>
                    <td style="font-weight:700; opacity:0.6;">${w.dni}</td>
                    <td>${w.apellidos}, ${w.nombre}</td>
                    <td align="center">
                        <select class="att-select" data-dni="${w.dni}" data-field="asistencia" style="color:${att.asistencia==='P'?'var(--success)':'var(--danger)'}">
                            <option value="P" ${att.asistencia === 'P' ? 'selected' : ''}>PRESENTE (P)</option>
                            <option value="F" ${att.asistencia === 'F' ? 'selected' : ''}>FALTA (F)</option>
                        </select>
                    </td>
                    <td align="center">
                        <select class="att-select" data-dni="${w.dni}" data-field="puntualidad" style="color:${att.puntualidad==='SÍ'?'var(--success)':'var(--warning)'}">
                            <option value="SÍ" ${att.puntualidad === 'SÍ' ? 'selected' : ''}>SÍ (A Tiempo)</option>
                            <option value="NO" ${att.puntualidad === 'NO' ? 'selected' : ''}>NO (Tardanza)</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.att-select').forEach(sel => {
            sel.onchange = (e) => {
                const { dni, field } = e.target.dataset;
                if (!attendance[dni]) attendance[dni] = { asistencia: 'P', puntualidad: 'SÍ' };
                attendance[dni][field] = e.target.value;
                e.target.style.color = (e.target.value === 'P' || e.target.value === 'SÍ') ? 'var(--success)' : 'var(--danger)';
                adminService.saveAttendanceLocal(forcedDate, attendance);
            };
        });
    };

    renderRows();

    // Admin Actions
    const btnSync = document.createElement('button');
    btnSync.className = "btn secondary";
    btnSync.innerHTML = "🔄 SINCRONIZAR";
    btnSync.onclick = async () => {
        btnSync.disabled = true;
        await adminService.initializeAdminData();
        renderAsistenciaSection(container);
    };

    const btnClose = document.createElement('button');
    btnClose.className = "btn success";
    btnClose.textContent = "💾 CERRAR DÍA";
    btnClose.onclick = async () => {
        if (confirm("¿Cerrar asistencia para hoy?")) {
            btnClose.disabled = true;
            btnClose.textContent = "⌛ ENVIANDO...";
            const ok = await adminService.closeAttendanceAndSyncPerformance(forcedDate, attendance);
            if (ok) {
                alert("✅ Día finalizado y sincronizado con éxito.");
                renderAsistenciaSection(container);
            } else {
                alert("❌ Error de comunicación. Verifique su conexión.");
                btnClose.disabled = false;
                btnClose.textContent = "💾 CERRAR DÍA";
            }
        }
    };

    topActions.appendChild(btnSync);
    topActions.appendChild(btnClose);

    document.getElementById('asist_date_picker').onchange = (e) => {
        forcedDate = e.target.value;
        renderAsistenciaSection(container);
    };
  };

  const renderPerformanceSection = (container) => {
    const subTabs = TABS.find(t => t.id === 'admin_pers').subTabs.find(s => s.id === 'performance').subTabs;
    
    container.innerHTML = `
        <nav class="sub-nav mini">
          ${subTabs.map(ss => `
            <a class="sub-nav-item ${activePerfSub === ss.id ? 'active' : ''}" data-id="${ss.id}">
                ${ss.icon} ${ss.label}
            </a>
          `).join('')}
        </nav>
        <div id="perfContent"></div>
    `;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.onclick = (e) => { 
        activePerfSub = e.currentTarget.dataset.id; 
        renderPerformanceSection(container); 
    });

    const perfContent = document.getElementById('perfContent');
    if (activePerfSub === 'historial') renderPerformanceHistory(perfContent);
    else if (activePerfSub === 'graficos') renderKPIGraphsSection(perfContent);
    else if (activePerfSub === 'reporte') renderKPIReportSection(perfContent);
  };

  const renderPerformanceHistory = (container) => {
    const log = adminService.getPerformanceLog();
    const grouped = log.reduce((acc, p) => {
        if (!acc[p.date]) acc[p.date] = [];
        acc[p.date].push(p);
        return acc;
    }, {});
    const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

    container.innerHTML = `
        <div class="perf-history-container animate-fade-in">
            <div class="panel-header">
                <h4>Historial de Desempeño Diario</h4>
                <button id="btnExpPerf" class="btn success">📊 EXPORTAR</button>
            </div>
            <div class="table-scroll" style="max-height: calc(100vh - 350px);">
                <table class="data-table small-text">
                    <thead>
                        <tr>
                            <th>OPERARIO / DNI</th>
                            <th align="center">ASIST.</th>
                            <th align="center">PUNT.</th>
                            <th align="center">PROD.</th>
                            <th align="center">BPA</th>
                            <th align="center">SUP.</th>
                            <th align="center">JUSTIFICACIÓN</th>
                            <th align="center" style="background:rgba(79,70,229,0.1);">REND %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedDates.map(date => {
                            const entries = grouped[date];
                            return `
                                <tr class="date-row-header"><td colspan="8">📅 ${date} (${entries.length} registros)</td></tr>
                                ${entries.map(p => `
                                    <tr>
                                        <td>${p.apellidos}, ${p.nombre} <small style="opacity:0.4;">${p.dni}</small></td>
                                        <td align="center">
                                            <select class="edit-perf" data-date="${p.date}" data-dni="${p.dni}" data-f="asistencia" style="color:${p.asistencia==='P'?'var(--success)':'var(--danger)'}">
                                                <option value="P" ${p.asistencia==='P'?'selected':''}>P</option>
                                                <option value="F" ${p.asistencia==='F'?'selected':''}>F</option>
                                            </select>
                                        </td>
                                        <td align="center">
                                            <select class="edit-perf" data-date="${p.date}" data-dni="${p.dni}" data-f="puntualidad" style="color:${p.puntualidad==='SÍ'?'var(--success)':'var(--warning)'}">
                                                <option value="SÍ" ${p.puntualidad==='SÍ'?'selected':''}>SÍ</option>
                                                <option value="NO" ${p.puntualidad==='NO'?'selected':''}>NO</option>
                                            </select>
                                        </td>
                                        <td align="center"><input type="number" class="edit-perf inline-input" value="${p.produccion}" data-date="${p.date}" data-dni="${p.dni}" data-f="produccion"></td>
                                        <td align="center"><input type="number" class="edit-perf inline-input" value="${p.bpa}" data-date="${p.date}" data-dni="${p.dni}" data-f="bpa"></td>
                                        <td align="center"><input type="number" class="edit-perf inline-input" value="${p.supervisor}" data-date="${p.date}" data-dni="${p.dni}" data-f="supervisor"></td>
                                        <td align="center"><input type="text" class="edit-perf inline-input" value="${p.justification || ''}" placeholder="---" data-date="${p.date}" data-dni="${p.dni}" data-f="justification" style="width:100px;"></td>
                                        <td align="center" style="font-weight:900; color:#fcd34d;" id="rend-${p.dni}-${p.date}">${p.rendimiento}</td>
                                    </tr>
                                `).join('')}
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.querySelectorAll('.edit-perf').forEach(el => {
        el.onchange = async (e) => {
            const { date, dni, f } = e.target.dataset;
            let val = e.target.value;
            if (f === 'produccion' || f === 'bpa' || f === 'supervisor') val = parseFloat(val) || 0;
            
            await adminService.updatePerformanceLogEntry(date, dni, { [f]: val });
            const entry = adminService.getPerformanceLog().find(x => x.date === date && x.dni === dni);
            if (entry) document.getElementById(`rend-${dni}-${date}`).textContent = entry.rendimiento;
            if (e.target.tagName === 'SELECT') e.target.style.color = (val === 'P' || val === 'SÍ') ? 'var(--success)' : 'var(--danger)';
        };
    });

    document.getElementById('btnExpPerf').onclick = () => {
        const ws = XLSX.utils.json_to_sheet(log);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Performance");
        XLSX.writeFile(wb, "Historial_Performance.xlsx");
    };
  };

  const renderKPIGraphsSection = (container) => {
    container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;"><h4>Análisis de Tendencias Operativas</h4><p>Cargando visualizaciones de rendimiento...</p></div>`;
  };

  const renderKPIReportSection = (container) => {
    container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;"><h4>Reportes de Productividad Acumulada</h4><p>Módulo de auditoría en desarrollo.</p></div>`;
  };

  const renderUsuariosSection = (container) => {
    container.innerHTML = `<div class="glass-panel animate-fade-in" style="padding:2rem;"><h4>Gestión de Personal y Cuentas</h4><p>Administre trabajadores activos y sus niveles de acceso.</p></div>`;
  };

  const renderRFSection = (container) => {
    container.innerHTML = `<div class="glass-panel animate-fade-in" style="padding:2rem; text-align:center;"><h4>Equipos RF</h4><span style="font-size:3rem; opacity:0.1;">🔋</span></div>`;
  };

  // --- TAB: ALMACENAJE ---
  const renderGenericAreaTab = async (tabId, subtitle) => {
    const tabDef = TABS.find(t => t.id === tabId);
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`${tabId}_${sub.id}`] === 1);

    let activeSub = localStorage.getItem(`activeSub_${tabId}`) || allowedSubTabs[0]?.id;
    if (!allowedSubTabs.find(s => s.id === activeSub)) activeSub = allowedSubTabs[0]?.id;

    tabContent.innerHTML = `
        <nav class="sub-nav">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeSub===sub.id?'active':''}" data-id="${sub.id}">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="areaContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.onclick = (e) => { 
        const s = e.currentTarget.dataset.id;
        localStorage.setItem(`activeSub_${tabId}`, s);
        renderGenericAreaTab(tabId, subtitle);
    });

    const areaContent = document.getElementById('areaContent');
    if (activeSub === 'archivo_almacenaje') {
        const wrap = document.createElement('div'); wrap.className = 'upload-stack';
        renderUploadArea(wrap, 'almacenaje_activo', dataStore.almacenaje_activo, '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, 'almacenaje_reserva', dataStore.almacenaje_reserva, '.xlsx', 'STOCK RESERVA');
        renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx', 'MAESTRO ARTÍCULOS');
        areaContent.appendChild(wrap);
    } else if (activeSub === 'tareas_dia' || activeSub === 'kpi_tareas') {
        const mod = await import('./almacenaje_module.js?v=17.4.6');
        await mod.loadAlmacenajeTasks();
        mod.renderAlmacenajeTareas(areaContent);
    }
  };

  // --- TAB: ANALISIS SKU ---
  const renderAnalisisSKUTab = () => {
    const tabDef = TABS.find(t => t.id === 'analisis_sku');
    const allowedSubTabs = tabDef.subTabs;
    
    tabContent.innerHTML = `
        <nav class="sub-nav">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAnalisisSub === sub.id ? 'active' : ''}" data-id="${sub.id}">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav>
        <div id="skuContent"></div>
    `;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.onclick = (e) => { 
        activeAnalisisSub = e.currentTarget.dataset.id; 
        renderAnalisisSKUTab(); 
    });

    const skuBuf = document.getElementById('skuContent');
    if (activeAnalisisSub === 'archivo_analisis') {
        const wrap = document.createElement('div'); wrap.className = 'upload-stack';
        renderUploadArea(wrap, 'stockActivo', dataStore.stockActivo, '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, 'stockReserva', dataStore.stockReserva, '.xlsx', 'STOCK RESERVA');
        skuBuf.appendChild(wrap);
    } else {
        skuBuf.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center;"><h4>Consultor de Artículos</h4><p>Utilice esta sección para auditorías rápidas de SKU.</p></div>`;
    }
  };

  // --- TAB: CONFIGURACIÓN ---
  const renderConfigTab = () => {
    tabContent.innerHTML = `
        <div class="glass-panel animate-fade-in" style="max-width:600px; padding:2rem;">
            <h4>Configuración del Sistema</h4>
            <div class="config-list">
                <div class="config-item"><span>Versión del Core</span><span class="badge primary">v17.4.7</span></div>
                <div class="config-item"><span>Conectividad</span><span class="badge success">ONLINE</span></div>
                <div class="config-item"><span>Entorno</span><span style="color:var(--primary); font-weight:800;">PROD</span></div>
            </div>
            <div style="margin-top:2rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.5rem;">
                <button id="resetApp" class="btn danger-outline">⚠️ LIMPIAR CACHÉ</button>
                <button id="resetProdData" class="btn danger" style="margin-left:1rem;">☢️ REINICIAR DATOS GLOBALES</button>
            </div>
        </div>
    `;
    document.getElementById('resetApp').onclick = () => { if (confirm("¿Limpiar caché local?")) { localStorage.clear(); window.location.reload(); } };
    document.getElementById('resetProdData').onclick = async () => {
        if (confirm("🚨 ¡ALERTA! Se borrarán todos los registros de Asistencia y Performance en la nube. ¿Continuar?")) {
            await adminService.resetProductionData();
            alert("Datos reiniciados.");
            window.location.reload();
        }
    };
  };

  // --- UPLOAD COMPONENT ---
  const renderUploadArea = (container, key, data, accept, label) => {
    const area = document.createElement('div');
    area.className = 'upload-item glass-panel';
    const hasData = data && data.length > 0;
    
    area.innerHTML = `
        <div class="upload-info">
            <div class="upload-icon ${hasData ? 'success' : ''}">${hasData ? '✅' : '📂'}</div>
            <div class="upload-text"><span class="upload-label">${label}</span><span class="upload-status">${hasData ? data.length + ' registros' : 'Vacío'}</span></div>
        </div>
        <div class="upload-actions">
            <input type="file" id="file_${key}" accept="${accept}" style="display:none"><label for="file_${key}" class="btn-upload">SUBIR</label>
            ${hasData ? `<button class="btn-clear" data-key="${key}">🗑️</button>` : ''}
        </div>
    `;
    container.appendChild(area);
    area.querySelector(`#file_${key}`).onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const { parseFile } = await import('../services/csvHub_v6.js?v=17.4.6');
        await parseFile(file, key);
        renderTabContent();
    };
    if (hasData) area.querySelector('.btn-clear').onclick = async () => {
        if (confirm("¿Borrar datos?")) {
            const { clearAreaData } = await import('../services/csvHub_v6.js?v=17.4.6');
            await clearAreaData(key, user.name);
            renderTabContent();
        }
    };
  };

  // --- SYNC ENGINE ---
  const startRealTimeSync = () => {
      if (window._pulseSyncInterval) clearInterval(window._pulseSyncInterval);
      window._pulseSyncInterval = setInterval(async () => {
          if (document.visibilityState === 'visible' && !document.querySelector('.modal')) {
              await adminService.initializeAdminData();
          }
      }, 30000); 
  };

  // --- INIT ---
  document.getElementById('logoutBtn').onclick = () => onLogout();
  renderNav();
  renderTabContent();
  startRealTimeSync();
  console.log("[PULSE] Dashboard v17.4.6 Online");
};
