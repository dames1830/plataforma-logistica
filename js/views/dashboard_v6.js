import { parseFile, parseBufferFiles, getAreaData, clearAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, fetchBufferHistory, dataStore, setDateFilter, currentDateFilter, getUploadMeta, initPersistentData, updateTablaTallas } from '../services/csvHub_v6.js?v=12.4.36';
import * as adminService from '../services/adminService.js?v=12.4.60';
import * as adminModule from './admin_module.js?v=12.4.66';
import * as bufferModule from './buffer_module.js?v=12.4.66';
import * as almacenajeModule from './almacenaje_module.js?v=12.4.66';
import * as analisisSkuModule from './analisis_sku_module.js?v=12.4.66';

const VERSION = '12.4.66-BETA';
const CACHE_KEY = `logistics_v12_4_66_beta_`;
const DB_TASKS_KEY = 'almacenaje_tasks_history_v1';
console.log(`[PULSE] Engine v${VERSION} Initialized (Production)`);

// --- LOGICA DE FECHA OPERATIVA (Turno Noche) ---
const getLogicalDate = () => {
    const now = new Date();
    const hrs = now.getHours();
    // Si son entre las 00:00 y las 06:00 AM, la fecha lógica es el día anterior
    if (hrs >= 0 && hrs < 6) {
        const d = new Date(now);
        d.setDate(now.getDate() - 1);
        return d.toISOString().split('T')[0];
    }
    return now.toISOString().split('T')[0];
};

// --- PERSISTENCIA TAREAS ALMACENAJE (Delegado a módulo) ---
// --- PERSISTENCIA AVANZADA (IndexedDB vía csvHub) ---

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'inventario', label: 'Inventario (Ciclo)', icon: '📋', roles: ['admin', 'jefe', 'supervisor'], subTabs: [
    { id: 'archivo_inventario', label: 'Archivo Inventario', icon: '🗂️' }
  ]},
  { id: 'picking', label: 'Picking', icon: '🛒', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_picking', label: 'Archivo Picking', icon: '🗂️' }
  ]},
  { id: 'packing', label: 'Packing', icon: '📦', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_packing', label: 'Archivo Packing', icon: '🗂️' }
  ]},
  { id: 'despacho', label: 'Despacho', icon: '🚚', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_despacho', label: 'Archivo Despacho', icon: '🗂️' }
  ]},
  { id: 'no_retail', label: 'NO RETAIL', icon: '🏬', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_no_retail', label: 'Archivo NO RETAIL', icon: '🗂️' }
  ]},
  { id: 'recepcion', label: 'Recepción', icon: '📥', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_recepcion', label: 'Archivo Recepción', icon: '🗂️' }
  ]},
  { id: 'almacenaje', label: 'Almacenaje', icon: '🏭', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_almacenaje', label: 'Archivo Almacenaje', icon: '🗂️' },
    { id: 'tareas_dia', label: 'Tareas Día', icon: '📋' },
    { id: 'kpi_tareas', label: 'KPI Tareas', icon: '📊' }
  ]},
  { id: 'buffer', label: 'Zona Buffer', icon: '⏳', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'maestros', label: 'Archivo Zona Buffer', icon: '🗂️' },
    { id: 'reportes', label: 'Análisis Buffer', icon: '📉' },
    { id: 'historial_buffer', label: 'Historial Buffer', icon: '📅' },
    { id: 'kpi_buffer', label: 'Buffer KPI', icon: '📊' }
  ] },
  { id: 'analisis_sku', label: 'Análisis SKU', icon: '🔍', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_analisis', label: 'Archivo Análisis SKU', icon: '🗂️' },
    { id: 'articulo_temp', label: 'Artículo', icon: '👕' }
  ] },
  { id: 'admin_pers', label: 'Administración', icon: '👥', roles: ['admin', 'jefe'], subTabs: [
    { id: 'trabajadores', label: 'Trabajadores', icon: '👷' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'permisos', label: 'Permisos', icon: '🛡️' },
    { id: 'asistencia', label: 'Asistencia', icon: '📅' },
    { id: 'performance', label: 'Performance', icon: '📈', subTabs: [
        { id: 'historial', label: 'Historial', icon: '📅' },
        { id: 'graficos', label: 'KPI Gráficos', icon: '📊' },
        { id: 'reporte', label: 'KPI Reporte', icon: '📋' }
    ]},
    { id: 'rfs', label: 'RF´s', icon: '🔋' }
  ] },
  { id: 'config', label: 'Configuración', icon: '⚙️', roles: ['admin'] }
];

const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
let lastBufferKPI = null;
let lastBufferResult = null;
let activeAnalisisSub = 'articulo_temp';
let activeConfigSub = 'parametros';

window.downloadExcelDetail = () => {
    if (!lastBufferResult) return;
    const data = lastBufferResult;
    
    // 1. Pestaña DETALLE (Resumen de todos los SKUs)
    const sheetDetalle = XLSX.utils.json_to_sheet(data.resumenSKUDetalle || []);
    
    // 2. Pestaña SKU BAJAR (Solo SKUs con Diferencia > 0)
    const skusBajarData = (data.resumenSKUDetalle || []).filter(s => s.Diferencia > 0);
    const sheetSkuBajar = XLSX.utils.json_to_sheet(skusBajarData);
    
    // [FILTRO v12.4.2] Filtrar solo ubicaciones Físicas (SEL-) y ordenar
    const physicalDetalle = (data.detalle || [])
        .filter(d => String(d.UBICACIONES || '').startsWith('SEL-'))
        .sort((a, b) => a.UBICACIONES.localeCompare(b.UBICACIONES));

    // 3. Pestaña LPN SELECIONADOS
    const lpnData = physicalDetalle.map(d => ({
        'Ubicacion': d.UBICACIONES,
        'LPN': d.LPN,
        'Sku': d.SKU,
        'Stock Activo': d['QTY ACTIVO'],
        'Stock Reserva': d['QTY RESERVA'],
        'Qty Buffer': d['QTY BUFFER'],
        'Articulo': d.Articulo
    }));
    const sheetLPN = XLSX.utils.json_to_sheet(lpnData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetDetalle, "Detalle");
    XLSX.utils.book_append_sheet(wb, sheetSkuBajar, "Sku Bajar");
    XLSX.utils.book_append_sheet(wb, sheetLPN, "LPN Selecionados");

    // 4. Pestaña MONTACARGA (Para operario, lista para imprimir)
    const montacargaMap = new Map();
    physicalDetalle.forEach(d => {
        const lpn = d.LPN;
        if (!montacargaMap.has(lpn)) {
            montacargaMap.set(lpn, {
                'UBICACIÓN': d.UBICACIONES,
                'LPN': lpn,
                'QTY RESERVA': 0
            });
        }
        montacargaMap.get(lpn)['QTY RESERVA'] += d['QTY RESERVA'];
    });
    // Convertir a Array y volver a ordenar por Ubicación (por si acaso el Map alteró el orden)
    const montacargaRows = Array.from(montacargaMap.values()).sort((a, b) => a.UBICACIÓN.localeCompare(b.UBICACIÓN));
    
    const aoa = [
        ["MONTACARGA"],
        [`${data.timestamp || new Date().toLocaleString()}`],
        [],
        ["N° Paletas", "UBICACIÓN", "LPN", "QTY RESERVA"]
    ];
    montacargaRows.forEach((row, idx) => {
        aoa.push([idx + 1, row.UBICACIÓN, row.LPN, row['QTY RESERVA']]);
    });
    const sheetMontacarga = XLSX.utils.aoa_to_sheet(aoa);
    
    // Configuración de impresión y celdas
    if (!sheetMontacarga['!merges']) sheetMontacarga['!merges'] = [];
    sheetMontacarga['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }); // Título centrado (4 cols)
    sheetMontacarga['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }); // Fecha (4 cols)
    
    // Ancho de columnas (200px aprox = 28 caracteres, y el N° algo más corto)
    sheetMontacarga['!cols'] = [
        { wch: 12 }, // N° Paletas
        { wch: 28 },
        { wch: 28 },
        { wch: 28 }
    ];

    XLSX.utils.book_append_sheet(wb, sheetMontacarga, "Montacarga");

    // 5. Pestaña ANÁLISIS BUFFER (Cruce con Maestro y Tallas)
    const maestroMap = new Map();
    if (dataStore.articulos) {
        dataStore.articulos.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const art7 = String(raw[1] || '').trim().substring(0, 7);
            if (art7 && !maestroMap.has(art7)) {
                maestroMap.set(art7, {
                    marca: String(raw[13] || 'OTROS').trim(),
                    gender: String(raw[3] || '').trim() // Columna D (Índice 3) para Gender Rims
                });
            }
        });
    }

    const tallasMap = dataStore.tabla_tallas || {};

    const aoaAnalisis = [
        ["ANÁLISIS BUFFER"],
        [`${data.timestamp || new Date().toLocaleString()}`],
        [],
        ["UBICACIÓN", "LPN", "SKU", "TALLAS", "MARCAS", "GENDER RIMS", "QTY ACTIVO", "QTY RESERVA", "QTY BUFFER"]
    ];

    // Ordenar y agrupar datos (Filtrado solo SEL-)
    const sorted = physicalDetalle;

    let lastUbi = "", lastLPN = "";
    let uSumA = 0, uSumR = 0, uSumB = 0;
    let gSumA = 0, gSumR = 0, gSumB = 0;

    sorted.forEach((d, i) => {
        // Cambio de ubicación -> Insertar Total anterior
        if (lastUbi !== "" && d.UBICACIONES !== lastUbi) {
            aoaAnalisis.push([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB]);
            uSumA = 0; uSumR = 0; uSumB = 0; // Reiniciar
        }

        const sku = d.SKU;
        const art7 = sku.substring(0, 7);
        const maestro = maestroMap.get(art7) || { marca: '-', gender: '-' };
        const talla = tallasMap[sku] || '-';
        
        const showUbi = (d.UBICACIONES !== lastUbi) ? d.UBICACIONES : "";
        const showLPN = (d.LPN !== lastLPN || d.UBICACIONES !== lastUbi) ? d.LPN : "";

        aoaAnalisis.push([
            showUbi,
            showLPN,
            sku,
            talla,
            maestro.marca,
            maestro.gender,
            d['QTY ACTIVO'],
            d['QTY RESERVA'],
            d['QTY BUFFER']
        ]);

        uSumA += (d['QTY ACTIVO'] || 0);
        uSumR += (d['QTY RESERVA'] || 0);
        uSumB += (d['QTY BUFFER'] || 0);
        gSumA += (d['QTY ACTIVO'] || 0);
        gSumR += (d['QTY RESERVA'] || 0);
        gSumB += (d['QTY BUFFER'] || 0);

        lastUbi = d.UBICACIONES;
        lastLPN = d.LPN;
    });

    // Último total por ubicación
    if (lastUbi !== "") {
        aoaAnalisis.push([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB]);
    }

    // Fila de Total General
    aoaAnalisis.push([]);
    aoaAnalisis.push(["TOTAL GENERAL", "", "", "", "", "", gSumA, gSumR, gSumB]);

    const sheetAnalisis = XLSX.utils.aoa_to_sheet(aoaAnalisis);
    
    // Formato y anchos para Análisis Buffer
    if (!sheetAnalisis['!merges']) sheetAnalisis['!merges'] = [];
    sheetAnalisis['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }); // Título
    sheetAnalisis['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }); // Fecha
    
    sheetAnalisis['!cols'] = [
        { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, sheetAnalisis, "Análisis Buffer");

    // 6. Pestaña TALLAS (Auditoría de Tabla Virtual)
    const aoaTallas = [
        ["REPORTE DE TALLAS EXTRAÍDAS"],
        [`Generado: ${new Date().toLocaleString()}`],
        [],
        ["SKU", "TALLA EXTRAÍDA"]
    ];
    
    Object.entries(tallasMap).sort().forEach(([sku, talla]) => {
        aoaTallas.push([sku, talla]);
    });

    const sheetTallas = XLSX.utils.aoa_to_sheet(aoaTallas);
    sheetTallas['!cols'] = [{ wch: 25 }, { wch: 15 }];
    if (!sheetTallas['!merges']) sheetTallas['!merges'] = [];
    sheetTallas['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
    
    XLSX.utils.book_append_sheet(wb, sheetTallas, "Tallas");
    
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Detalle_Buffer_${date}.xlsx`);
};

window.downloadExcelZonas = () => {
    if (!lastBufferResult) return;
    const data = lastBufferResult;
    
    // 1. Pestaña Detalle Zonas (SOLO lo físico, como antes)
    const zonasFisicas = (data.detalleZonas || []).filter(d => d['NIVEL/AREA'] !== '7. SIN STOCK');
    const sheetZonas = XLSX.utils.json_to_sheet(zonasFisicas);
    
    // 2. Pestaña Sin Stock (EXCLUSIVO lo faltante)
    const sinStockData = (data.detalleZonas || [])
        .filter(d => d['NIVEL/AREA'] === '7. SIN STOCK')
        .map(d => ({
            'NIVEL/AREA': d['NIVEL/AREA'],
            'ARTÍCULO': d['ARTÍCULO'],
            'SKU': d['SKU'],
            'ATD RQ': d['ATD RQ']
        }));
    const sheetOOS = XLSX.utils.json_to_sheet(sinStockData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetZonas, "Detalle Zonas");
    XLSX.utils.book_append_sheet(wb, sheetOOS, "Sin Stock");
    
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Analisis_Zonas_${date}.xlsx`);
};

export const renderDashboard = async (container, user, onLogout) => {
  pingServer();
  await initPersistentData(); // [MOD V12.1.48] Esperar a IndexedDB antes de renderizar
  await adminService.initializeAdminData();
  await almacenajeModule.loadAlmacenajeTasks();
  
  // Heartbeat de Sincronización Global (Cada 30 seg)
  setInterval(async () => {
      await adminService.initializeAdminData();
      if (currentTab === 'almacenaje') {
          const synced = adminService.adminStore.almacenaje_tasks;
          // SOLO actualizamos si el servidor tiene datos para no borrar lo local por error
          if (Array.isArray(synced) && synced.length > 0) {
              almacenajeTasksCache = synced;
              const container = document.getElementById('areaContent');
              if (container && (localStorage.getItem('activeSub_almacenaje') === 'tareas_dia' || localStorage.getItem('activeSub_almacenaje') === 'kpi_tareas')) {
                  renderAlmacenajeTareas(container);
              }
          }
      }
  }, 30000);
  
  // Soporte para Reinicio Forzado vía URL (?forceReset=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('forceReset') === '1' && user.role === 'admin') {
      console.log("🚀 [PULSE] Detectado parámetro forceReset. Ejecutando limpieza maestro...");
      await adminService.resetProductionData();
      alert("✅ Limpieza de datos de prueba completada con éxito vía URL.");
      // Limpiar el parámetro de la URL sin recargar para no entrar en bucle
      window.history.replaceState({}, document.title, window.location.pathname);
  }

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
        <h2 style="font-weight:700; color:#fff;">LOGÍSTICA <span style="color:var(--primary)">DAMES1830</span> <span style="font-size:15px; color:rgba(255,255,255,0.5); vertical-align:middle; margin-left:10px;">v${VERSION}</span></h2>
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
        <div class="tab-header" style="margin-bottom:1.5rem;"><h1 id="contentTitle" style="color:var(--primary); font-size:1.8rem; font-weight:800;">Cargando...</h1><p id="contentSubtitle" style="color:var(--text-muted); font-size:0.85rem;"></p></div>
        <div id="contentArea"></div>
      </div>
    </main>
  `;

  const navContainer = document.getElementById('navLinks');
  const contentArea = document.getElementById('contentArea');
  
  if (currentDateFilter) setDateFilter(null); // Limpiar filtro al quitar el picker

  const renderNav = () => {
    navContainer.innerHTML = allowedTabs.map(t => `<a class="nav-item ${t.id === currentTab ? 'active' : ''}" data-id="${t.id}">${t.icon} ${t.label}</a>`).join('');
    document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', (e) => { 
        currentTab = e.currentTarget.dataset.id; 
        activeAdminSub = null; // Resetear sub-pestaña al cambiar de sección
        renderNav(); 
        renderTabContent(); 
    }));
  };

  const renderTabContent = async (silent = false) => {
    const tabObj = allowedTabs.find(t => t.id === currentTab);
    const dateTag = currentDateFilter ? ` <span style="background:var(--warning); color:#000; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = tabObj.label + dateTag;
    
    if (!silent) {
        contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p>Sincronizando...</p></div>`;
    }

    if (currentTab === 'inicio') await renderHomeTab();
    else if (currentTab === 'buffer') await bufferModule.renderBufferTab(contentArea, user, TABS, renderTabContent);
    else if (currentTab === 'almacenaje') await almacenajeModule.renderAlmacenajeTareas(contentArea);
    else if (currentTab === 'analisis_sku') await analisisSkuModule.renderAnalisisSKUTab(contentArea, user, TABS, '');
    else if (currentTab === 'inventario') await renderGenericAreaTab('inventario', 'Gestión de Inventario');
    else if (currentTab === 'picking') await renderGenericAreaTab('picking', 'Gestión de Picking');
    else if (currentTab === 'packing') await renderGenericAreaTab('packing', 'Gestión de Packing');
    else if (currentTab === 'despacho') await renderGenericAreaTab('despacho', 'Gestión de Despacho');
    else if (currentTab === 'no_retail') await renderGenericAreaTab('no_retail', 'Gestión NO RETAIL');
    else if (currentTab === 'recepcion') await renderGenericAreaTab('recepcion', 'Gestión de Recepción');
    else if (currentTab === 'admin_pers') await adminModule.renderAdminTab(contentArea, user, TABS);
    else if (currentTab === 'config') await renderConfigTab();
    else {
      const data = await getAreaData(currentTab);
      if (!data) renderUploadArea(contentArea, currentTab);
      else renderDashboardView(contentArea, data);
    }
  };

  const renderHomeTab = async () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const now = new Date();
    
    contentTitle.style.display = 'none'; // Ocultar título estándar para el Home
    contentSubtitle.style.display = 'none';

    contentArea.innerHTML = `
        <div class="animate-fade-in" style="margin-bottom:2.5rem;">
            <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(30, 41, 59, 0.2) 100%); padding:2.5rem; border-radius:20px; border:1px solid rgba(79, 70, 229, 0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.2); position:relative; overflow:hidden;">
                <div style="position:absolute; top:-50px; right:-50px; width:150px; height:150px; background:var(--primary); filter:blur(100px); opacity:0.2;"></div>
                <h1 style="margin:0; font-size:2.8rem; font-weight:900; letter-spacing:-1px; color:#fff;">¡Hola, <span style="background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${user.name}</span>!</h1>
                <div style="margin-top:0.8rem; display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                    <p style="margin:0; color:#cbd5e1; font-size:1.1rem; font-weight:500;">Bienvenido al centro de control operativo.</p>
                    <div id="homeClock" style="background:rgba(255,255,255,0.05); padding:6px 15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); color:var(--primary); font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">
                        ${now.toLocaleDateString('es-ES', options)} | ${now.toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </div>
        <div class="kpi-grid" id="homeKpiGrid"></div>
    `;

    // Reloj dinámico
    if (window.homeClockInterval) clearInterval(window.homeClockInterval);
    window.homeClockInterval = setInterval(() => {
        const clockEl = document.getElementById('homeClock');
        if (clockEl) {
            const d = new Date();
            clockEl.textContent = `${d.toLocaleDateString('es-ES', options)} | ${d.toLocaleTimeString()}`;
        } else {
            clearInterval(window.homeClockInterval);
        }
    }, 1000);

    ['stockActivo', 'stockReserva', 'buffer', 'picking'].forEach(a => {
        getAreaData(a).then(rows => {
            const grid = document.getElementById('homeKpiGrid');
            if(!grid) return;
            grid.innerHTML += `
                <div class="kpi-card" style="transition:transform 0.3s ease; cursor:pointer;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    <h4 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem;">${a.replace('stock', 'STOCK ')}</h4>
                    <h2 style="font-size:2.2rem; font-weight:800; color:#fff; margin:0;">${rows ? rows.length.toLocaleString() : 0}</h2>
                    <div style="height:4px; width:40px; background:var(--primary); margin-top:1rem; border-radius:2px;"></div>
                </div>`;
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

  const renderUploadArea = (container, area, hasData = null, ext = '.csv', customLabel = null) => {
    const meta = getUploadMeta(area);
    const dateStr = meta ? new Date(meta.ts).toLocaleString() : 'NUNCA';
    const div = document.createElement('div');
    div.id = `wrap_${area}`;
    div.style.width = '100%';
    const label = customLabel || area.toUpperCase();
    
    const isLoaded = hasData && hasData.length > 0;
    
    div.innerHTML = `
      <div style="background:rgba(15, 23, 42, 0.4); border:1px solid ${isLoaded ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border-radius:10px; padding:0.6rem 1.2rem; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s; border-left:4px solid ${isLoaded ? '#22c55e' : '#64748b'};">
          <div style="display:flex; align-items:center; gap:1.2rem;">
              <div style="width:36px; height:36px; background:${isLoaded ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:${isLoaded ? '#22c55e' : 'var(--text-muted)'}; border:1px solid ${isLoaded ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'};">
                  ${ext === '.csv' ? '📄' : '📊'}
              </div>
              <div style="display:flex; flex-direction:column;">
                  <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${label}</span>
                  <div style="display:flex; align-items:center; gap:10px; margin-top:2px;">
                      <span style="color:${isLoaded ? '#fff' : 'var(--text-muted)'}; font-weight:700; font-size:0.85rem;">${isLoaded ? 'LISTO' : 'VACÍO'}</span>
                      ${isLoaded ? `<span style="width:4px; height:4px; background:rgba(255,255,255,0.2); border-radius:50%;"></span>
                                    <span style="color:var(--text-muted); font-size:0.75rem;">${hasData.length.toLocaleString()} regs</span>` : ''}
                  </div>
              </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:1.5rem;">
              <div style="text-align:right; min-width:180px;">
                  <div style="font-size:0.65rem; color:var(--text-muted); font-weight:600;">ÚLTIMA CARGA</div>
                  <div style="font-size:0.75rem; color:${isLoaded ? '#fbbf24' : 'rgba(255,255,255,0.2)'}; font-weight:700;">${dateStr}</div>
              </div>
              
              <div style="display:flex; gap:0.4rem;">
                  <label title="Subir Nuevo Archivo" style="background:${isLoaded ? 'rgba(79, 70, 229, 0.1)' : 'var(--primary)'}; color:${isLoaded ? 'var(--primary)' : '#fff'}; border:1px solid ${isLoaded ? 'var(--primary)' : 'transparent'}; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9rem; transition:all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                      <input type="file" id="up_${area}" accept="${ext}" style="display:none;">
                      ${isLoaded ? '🔄' : '📤'}
                  </label>
                  ${isLoaded ? `
                    <button id="del_${area}" title="Quitar Archivo" style="background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid #ef4444; width:32px; height:32px; border-radius:6px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444'">
                        🗑️
                    </button>
                  ` : ''}
              </div>
          </div>
      </div>`;
    
    container.appendChild(div);

    const input = document.getElementById(`up_${area}`);
    if(input) input.addEventListener('change', async (e) => { 
        if(e.target.files[0]) { 
            const wrap = document.getElementById(`wrap_${area}`);
            const originalContent = wrap.innerHTML;
            wrap.innerHTML = `<div style="background:rgba(79, 70, 229, 0.05); border:1px dashed var(--primary); border-radius:10px; padding:0.6rem 1.2rem; display:flex; align-items:center; justify-content:center; gap:1rem; height:54px;">
                <div class="spinner" style="width:16px; height:16px; border:2px solid rgba(79,70,229,0.1); border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
                <span style="font-size:0.8rem; color:var(--primary); font-weight:800; letter-spacing:1px;">PROCESANDO ARCHIVO...</span>
            </div>`;
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

    const delBtn = document.getElementById(`del_${area}`);
    if(delBtn) delBtn.addEventListener('click', async () => {
        if(confirm(`¿Estás seguro de que quieres quitar el archivo de ${label}?`)) {
            delBtn.disabled = true;
            delBtn.innerHTML = '...';
            await clearAreaData(area, user.username);
            renderTabContent();
        }
    });
  };

















  const renderConfigTab = async () => {
    contentSubtitle.textContent = "Panel de Control Técnico";
    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          <a class="sub-nav-item ${activeConfigSub==='parametros'?'active':''}" data-s="parametros" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">⚙️ PARÁMETROS</a>
          <a class="sub-nav-item ${activeConfigSub==='conexion'?'active':''}" data-s="conexion" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🌐 CONEXIÓN</a>
          <a class="sub-nav-item ${activeConfigSub==='mantenimiento'?'active':''}" data-s="mantenimiento" style="padding: 0.5rem 0.2rem; font-size: 0.85rem;">🛠️ MANTENIMIENTO</a>
        </nav><div id="configContent"></div>`;
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { activeConfigSub = e.target.dataset.s; renderConfigTab(); }));
    
    if (activeConfigSub === 'parametros') {
        document.getElementById('configContent').innerHTML = `<div class="glass-panel" style="max-width:450px; padding:1.5rem;"><h4 style="font-size:0.95rem; margin-top:0;">Configuración de Motor</h4>${['include_reserva', 'include_alto'].map(k => `<label style="display:flex; justify-content:space-between; margin:0.8rem 0; font-size:0.85rem;">${k.toUpperCase().replace('_', ' ')} <input type="checkbox" checked></label>`).join('')}<button class="btn" style="font-size:0.85rem; padding:0.6rem;">GUARDAR CAMBIOS</button></div>`;
    } else if (activeConfigSub === 'mantenimiento') {
        document.getElementById('configContent').innerHTML = `
            <div class="glass-panel" style="max-width:450px; padding:1.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                <h4 style="color:#f87171; font-size:0.95rem; margin-top:0;">Zona de Peligro</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">Utiliza estas opciones para limpiar la base de datos de pruebas. Esta acción no se puede deshacer.</p>
                <button id="resetDataBtn" class="btn" style="background:#ef4444; font-size:0.85rem; padding:0.7rem; font-weight:700;">⚠️ REINICIAR ASISTENCIA Y PERFORMANCE</button>
            </div>
        `;
        document.getElementById('resetDataBtn').onclick = async () => {
            if (confirm("🚨 ¿ESTÁS SEGURO? Se borrará TODO el historial de asistencia y performance de forma permanente. Los trabajadores NO se borrarán.")) {
                await adminService.resetProductionData();
                alert("✅ Se han reiniciado los datos. La aplicación se recargará.");
                window.location.reload();
            }
        };
    } else {
        document.getElementById('configContent').innerHTML = `<div style="padding:1.5rem; font-size:0.85rem;">Estado de API: <span style="color:var(--success); font-weight:bold;">CONECTADO</span></div>`;
    }
  };

  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  };

  const renderBufferHistory = async (container) => {
    container.innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <div class="spinner"></div>
            <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">Sincronizando Reporte de Buffer día...</p>
        </div>`;
    
    const history = await fetchBufferHistory();
    
    if (!history || history.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:var(--text-muted);">No se encontraron reportes previos en el historial.</p></div>`;
        return;
    }

    const sorted = [...history].sort((a,b) => new Date(b.created_at || b.ts) - new Date(a.created_at || a.ts));

    container.innerHTML = `
        <div class="animate-fade-in" style="padding:0.5rem;">
            <h3 style="color:var(--primary); margin:0 0 1rem 0; font-size:1.1rem; font-weight:600;">Reporte de Buffer día</h3>
            <div class="glass-panel" style="padding:0; overflow-x:auto; border: 1px solid rgba(255,255,255,0.1);">
                <table class="history-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; color:white;">
                    <thead>
                        <tr style="background:#facc15; color:#000;">
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">Semana</th>
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">FECHA</th>
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">FUENTE</th>
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">NIVEL/AREA</th>
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">PAL</th>
                            <th style="padding:0.8rem; border:1px solid rgba(0,0,0,0.1); text-align:center;">SKU</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((report, rIdx) => {
                            const ts = report.created_at || report.ts || Date.now();
                            const dObj = new Date(ts);
                            const semana = getWeekNumber(dObj);
                            const dateStr = dObj.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
                            const repData = report.data || {};
                            const niveles = repData.resumenNiveles || [];
                            
                            if (niveles.length === 0) {
                                return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                    <td style="padding:1rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${semana}</td>
                                    <td style="padding:1rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${dateStr}</td>
                                    <td colspan="3" style="padding:1rem; text-align:center; opacity:0.5; border:1px solid rgba(255,255,255,0.05);">Datos no disponibles o formato antiguo</td>
                                    <td style="padding:1rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                        <button class="btn-restore" data-idx="${rIdx}" style="background:var(--primary); border:none; color:white; padding:0.3rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.75rem;">👁️</button>
                                    </td>
                                </tr>`;
                            }

                            return `
                                ${niveles.map((n, nIdx) => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                        <td style="padding:0.5rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${semana}</td>
                                        <td style="padding:0.5rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${dateStr}</td>
                                        <td style="padding:0.5rem 0.8rem; border:1px solid rgba(255,255,255,0.05); color:var(--primary); font-weight:800;">${n.fuente || report.data.sourceName || 'PEDIDO'}</td>
                                        <td style="padding:0.5rem 0.8rem; border:1px solid rgba(255,255,255,0.05); text-align:left;">${n.nivel}</td>
                                        <td style="padding:0.5rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${(n.pal || 0)}</td>
                                        <td style="padding:0.5rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">${(n.sku || 0)}</td>
                                    </tr>
                                `).join('')}
                                <tr style="height:4px; background:rgba(255,255,255,0.01);"><td colspan="6"></td></tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.querySelectorAll('.btn-restore').forEach(btn => {
        btn.onclick = () => {
            const item = sorted[parseInt(btn.dataset.idx)];
            lastBufferKPI = item.data;
            try {
                localStorage.setItem('lastBufferKPI', JSON.stringify(item.data));
            } catch(e) { console.warn("[PULSE] Quota Full en Historial", e); }
            activeBufferSub = 'reportes';
            renderBufferTab();
        };
    });
  };

  const renderBufferKPI = async (container) => {
    container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div><p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">Generando indicadores...</p></div>`;
    const history = await fetchBufferHistory();
    
    if (!history || history.length < 2) {
        container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:var(--text-muted);">Se requieren al menos 2 reportes para generar comparativas y gráficos de tendencia.</p></div>`;
        return;
    }

    const sorted = [...history].sort((a,b) => new Date(a.created_at || a.ts) - new Date(b.created_at || b.ts));
    const labels = sorted.map(item => new Date(item.created_at || item.ts).toLocaleDateString());
    const effData = sorted.map(item => {
        const pctStr = item.data?.waterfall?.find(w => w.nivel === 'Total')?.pct || '0%';
        return parseFloat(pctStr);
    });

    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <div class="glass-panel animate-fade-in" style="padding:1.5rem;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem;">TENDENCIA DE EFICIENCIA (%)</h4>
                <canvas id="bufferTrendChart" style="max-height:250px;"></canvas>
            </div>
            <div class="glass-panel animate-fade-in" style="padding:1.5rem;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem;">VOLUMEN RQ vs ATD</h4>
                <canvas id="bufferVolumeChart" style="max-height:250px;"></canvas>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctxTrend = document.getElementById('bufferTrendChart')?.getContext('2d');
        if (ctxTrend) {
            new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Eficiencia de Llenado %',
                        data: effData,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        }

        const ctxVol = document.getElementById('bufferVolumeChart')?.getContext('2d');
        if (ctxVol) {
            new Chart(ctxVol, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'RQ (Demanda)', data: sorted.map(i => i.data?.waterfall?.find(w=>w.nivel==='Total')?.rq || 0), backgroundColor: '#fbbf24' },
                        { label: 'ATD (Atendido)', data: sorted.map(i => i.data?.waterfall?.find(w=>w.nivel==='Total')?.atd || 0), backgroundColor: '#10b981' }
                    ]
                },
                options: {
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }, 100);
  };

  if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').addEventListener('click', onLogout);
  }
  // =============================================
  // MOTOR DE SINCRONIZACIÓN EN TIEMPO REAL (v11.3.6)
  // =============================================
  const startRealTimeSync = () => {
      // Evitar múltiples intervalos si se re-renderiza el dashboard
      if (window._pulseSyncInterval) clearInterval(window._pulseSyncInterval);
      
      window._pulseSyncInterval = setInterval(async () => {
          // No sincronizar si el usuario está en Asistencia (Evita el "parpadeo" reportado)
          if (currentTab === 'admin_pers' && adminModule.getActiveAdminSub() === 'asistencia') return;

          const isIdle = !document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA');
          
          if (document.visibilityState === 'visible' && isIdle) {
              console.log("🔄 [PULSE] Sincronización automática de datos...");
              await adminService.initializeAdminData();
              if (currentTab === 'inicio') renderTabContent(true); 
          }
      }, 20000); 
  };

  const renderGenericAreaTab = async (tabId, subtitle) => {
    contentSubtitle.textContent = subtitle;
    const tabDef = TABS.find(t => t.id === tabId);
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`${tabId}_${sub.id}`] === 1);

    let activeSub = localStorage.getItem(`activeSub_${tabId}`) || allowedSubTabs[0]?.id;
    if (!allowedSubTabs.find(s => s.id === activeSub)) activeSub = allowedSubTabs[0]?.id;

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; cursor:pointer;">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="areaContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        const s = e.currentTarget.dataset.s;
        localStorage.setItem(`activeSub_${tabId}`, s);
        renderGenericAreaTab(tabId, subtitle);
    }));

    const container = document.getElementById('areaContent');
    if (activeSub && activeSub.startsWith('archivo_')) {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; container.appendChild(wrap);
        const actKey = `${tabId}_activo`;
        const resKey = `${tabId}_reserva`;
        renderUploadArea(wrap, actKey, dataStore[actKey], '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, resKey, dataStore[resKey], '.xlsx', 'STOCK RESERVA');
        if (tabId === 'almacenaje') {
            renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx', 'MAESTRO ARTÍCULOS');
        }
    } else if (tabId === 'almacenaje' && activeSub === 'tareas_dia') {
        almacenajeModule.renderAlmacenajeTareas(container);
    } else {
        const data = await getAreaData(tabId);
        if (!data) renderUploadArea(container, tabId);
        else renderDashboardView(container, data);
    }
    window.renderUploadArea = renderUploadArea;
  };

  const renderAnalisisSKUTab = async () => {
    analisisSkuModule.render(contentArea);
  };

  renderNav();
  renderTabContent();
  startRealTimeSync();
};
