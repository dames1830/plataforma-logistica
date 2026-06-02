import { parseFile, parseBufferFiles, getAreaData, clearAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, fetchBufferHistory, dataStore, setDateFilter, currentDateFilter, getUploadMeta, initPersistentData, updateTablaTallas, getCol } from '../services/csvHub_v6.js?v=17.4.5';
// PULSE_ENGINE_V18_2_0_CLEAN_BUILD
import * as adminService from '../services/adminService.js?v=17.2.4';


const VERSION = '18.6.0';
const CACHE_KEY = `logistics_v18_6_prod_`;
const DB_TASKS_KEY = 'almacenaje_tasks_history_v1';
console.log(`[PULSE] Engine v${VERSION} Initialized`);

// --- LOGICA DE FECHA OPERATIVA (Turno Noche) ---
const getLogicalDate = () => {
    const now = new Date();
    const hrs = now.getHours();
    let target = now;
    // Si son entre las 00:00 y las 06:00 AM, la fecha lógica es el día anterior
    if (hrs >= 0 && hrs < 6) {
        target = new Date(now);
        target.setDate(now.getDate() - 1);
    }
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// --- PERSISTENCIA TAREAS ALMACENAJE ---
let almacenajeTaskMode = localStorage.getItem('almacenajeTaskMode') || 'resumen';
let selectedTaskDate = null; // Filtro de fecha seleccionado
let expandedWeeks = []; // Semanas expandidas en el historial
let almacenajeTasksCache = [];
try {
    const stored = localStorage.getItem('logistics_admin_v11_almacenaje_tasks');
    if (stored) almacenajeTasksCache = JSON.parse(stored);
} catch(e) { almacenajeTasksCache = []; }
if (!Array.isArray(almacenajeTasksCache)) almacenajeTasksCache = [];

// --- PERSISTENCIA AVANZADA (IndexedDB vía csvHub) ---
const saveAlmacenajeTasks = async () => {
  try {
      // 1. Persistencia LOCAL inmediata (Seguridad total)
      // 1. Persistencia LOCAL inmediata
      localStorage.setItem('logistics_admin_v11_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
      adminService.adminStore.almacenaje_tasks = almacenajeTasksCache;

      // 2. Sincronización Global INMEDIATA
      const success = await adminService.saveAlmacenajeTasks(almacenajeTasksCache);
      if (success) {
          console.log("✅ [PULSE] Sincronización Global de Almacenaje completada.");
      } else {
          console.warn("⚠️ Falló la sincronización con la nube.");
      }
  } catch (e) { 
      console.error("[PULSE] Error crítico al guardar en la nube:", e);
      alert("🚨 Error crítico al conectar con el servidor.");
  }
};

const loadAlmacenajeTasks = async () => {
  try {
      // 1. Carga inmediata desde LocalStorage (Sin esperas)
      const stored = localStorage.getItem('logistics_admin_v11_almacenaje_tasks');
      if (stored) {
          const localTasks = JSON.parse(stored);
          if (Array.isArray(localTasks) && localTasks.length > 0) {
              almacenajeTasksCache = localTasks;
          }
      }
      
      // 2. Sincronización pasiva con la administración (Solo si hay datos nuevos reales)
      const syncedTasks = adminService.adminStore.almacenaje_tasks;
      if (Array.isArray(syncedTasks) && syncedTasks.length > 0) {
          almacenajeTasksCache = syncedTasks;
          localStorage.setItem('logistics_admin_v11_almacenaje_tasks', JSON.stringify(syncedTasks));
      }
      
      console.log(`[PULSE] Persistencia v13.0.4 Activa: ${almacenajeTasksCache.length} tareas.`);
  } catch (e) { console.error("[PULSE] Error en persistencia:", e); }
};

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'inventario', label: 'Inventario', icon: '📋', roles: ['admin', 'jefe', 'supervisor'], subTabs: [
    { id: 'archivo_inventario', label: 'Archivo Inventario', icon: '🗂️' },
    { id: 'kpi_inventarios', label: 'KPI Inventarios', icon: '📊' },
    { id: 'analisis_inventarios', label: 'Análisis Inventario', icon: '🔍' },
    { id: 'modulo_inventarios', label: 'Inventarios', icon: '📦' }
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
    { id: 'archivo_no_retail', label: 'Archivo NO RETAIL', icon: '🗂️' },
    { id: 'despacho_no_retail', label: 'Despacho de NO RETAIL', icon: '🚚' }
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
let currentChart = null;
let lastBufferKPI = null;
let bufferConfigCached = null;
let lastBufferResult = null;
let activeAnalisisSub = 'articulo_temp';
let activeConfigSub = 'parametros';

window.downloadExcelDetail = async () => {
    if (!lastBufferResult) return;
    const data = lastBufferResult;
    const workbook = new ExcelJS.Workbook();

    // --- PESTAÑA 1: MONTACARGA (FORMATO PREMIUM) ---
    const wsMonta = workbook.addWorksheet('Montacarga', { 
        properties: { tabColor: { argb: 'FFADD8E6' } },
        pageSetup: { printTitlesRow: '1:4', orientation: 'portrait' } 
    });
    
    wsMonta.columns = [
        { key: 'n', width: 12 }, { key: 'ubi', width: 21.3 }, { key: 'lpn', width: 30 }, { key: 'qty', width: 18 }
    ];

    wsMonta.mergeCells('A1:D1');
    const row1 = wsMonta.getRow(1);
    row1.getCell(1).value = 'MONTACARGA';
    row1.getCell(1).font = { size: 48, bold: true, name: 'Calibri' };
    row1.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    wsMonta.mergeCells('A2:D2');
    const row2 = wsMonta.getRow(2);
    row2.getCell(1).value = data.timestamp || new Date().toLocaleString();
    row2.getCell(1).font = { size: 10, name: 'Calibri' };
    row2.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const row4M = wsMonta.getRow(4);
    row4M.values = ["N° Paletas", "UBICACIÓN", "LPN", "QTY RESERVA"];
    row4M.font = { bold: true, size: 14, name: 'Calibri' };
    row4M.eachCell((cell, colNumber) => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        if (colNumber === 1 || colNumber === 4) cell.alignment = { horizontal: 'center' };
    });

    const physicalDetalle = (data.detalle || [])
        .filter(d => String(d.UBICACIONES || '').startsWith('SEL-'))
        .sort((a, b) => a.UBICACIONES.localeCompare(b.UBICACIONES));

    const montacargaMap = new Map();
    physicalDetalle.forEach(d => {
        const lpn = d.LPN;
        if (!montacargaMap.has(lpn)) montacargaMap.set(lpn, { ubi: d.UBICACIONES, lpn: lpn, qty: 0 });
        montacargaMap.get(lpn).qty += d['QTY RESERVA'];
    });

    const montacargaRows = Array.from(montacargaMap.values()).sort((a, b) => a.ubi.localeCompare(b.ubi));
    montacargaRows.forEach((r, idx) => {
        const row = wsMonta.addRow([idx + 1, r.ubi, r.lpn, r.qty]);
        row.font = { size: 14, name: 'Calibri' };
        row.eachCell((cell, colNumber) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            if (colNumber === 1 || colNumber === 4) cell.alignment = { horizontal: 'center' };
        });
    });

    // --- PESTAÑA 2: ANÁLISIS BUFFER (FORMATO PREMIUM) ---
    const wsAnalisis = workbook.addWorksheet('Análisis Buffer', {
        properties: { tabColor: { argb: 'FF22C55E' } }, // VERDE SOLICITADO
        pageSetup: { printTitlesRow: '1:4' }
    });
    // Re-ajuste de anchos para precisión de píxeles reales (Pixels / 7.0 aprox)
    wsAnalisis.columns = [
        { key: 'ubi', width: 27.5 }, // 193px
        { key: 'lpn', width: 28.5 }, // 200px
        { key: 'sku', width: 23.5 }, // 165px
        { key: 'talla', width: 10 },   // 70px
        { key: 'marca', width: 20 },   // 140px
        { key: 'gender', width: 23.5 }, // 165px
        { key: 'act', width: 16.4 },   // 115px
        { key: 'res', width: 17.8 },   // 125px
        { key: 'buf', width: 15.7 }    // 110px
    ];

    wsAnalisis.mergeCells('A1:I1');
    const row1A = wsAnalisis.getRow(1);
    row1A.height = 60;
    row1A.getCell(1).value = 'ANÁLISIS BUFFER';
    row1A.getCell(1).font = { size: 48, bold: true, name: 'Calibri' };
    row1A.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    wsAnalisis.mergeCells('A2:I2');
    const row2A = wsAnalisis.getRow(2);
    row2A.getCell(1).value = data.timestamp || new Date().toLocaleString();
    row2A.getCell(1).font = { size: 10, name: 'Calibri' };
    row2A.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const row4A = wsAnalisis.getRow(4);
    row4A.values = ["UBICACIÓN", "LPN", "SKU", "TALLAS", "MARCAS", "GENDER RIMS", "QTY ACTIVO", "QTY RESERVA", "QTY BUFFER"];
    row4A.height = 25;
    row4A.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14, name: 'Calibri' };
    row4A.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: 'middle' };
    });
    [7, 8, 9].forEach(c => row4A.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });

    const maestroMap = new Map();
    if (dataStore.articulos) {
        dataStore.articulos.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const art7 = String(raw[1] || '').trim().substring(0, 7);
            if (art7 && !maestroMap.has(art7)) maestroMap.set(art7, { marca: String(raw[13] || 'OTROS').trim(), gender: String(raw[3] || '').trim() });
        });
    }
    const tallasMap = dataStore.tabla_tallas || {};

    let lastUbi = "", uSumA = 0, uSumR = 0, uSumB = 0;
    let gSumA = 0, gSumR = 0, gSumB = 0;

    physicalDetalle.forEach((d) => {
        if (lastUbi !== "" && d.UBICACIONES !== lastUbi) {
            const totalRow = wsAnalisis.addRow([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB]);
            totalRow.font = { bold: true, size: 14, name: 'Calibri' };
            totalRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } }; // Gris 35%
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
            [7, 8, 9].forEach(c => totalRow.getCell(c).alignment = { horizontal: 'center' });
            uSumA = 0; uSumR = 0; uSumB = 0;
        }

        const sku = d.SKU;
        const art7 = sku.substring(0, 7);
        const maestro = maestroMap.get(art7) || { marca: '-', gender: '-' };
        const talla = tallasMap[sku] || '-';

        const dataRow = wsAnalisis.addRow([
            d.UBICACIONES !== lastUbi ? d.UBICACIONES : "",
            d.LPN, sku, talla, maestro.marca, maestro.gender,
            d['QTY ACTIVO'], d['QTY RESERVA'], d['QTY BUFFER']
        ]);
        dataRow.font = { size: 14, name: 'Calibri' };
        dataRow.eachCell((cell, colNumber) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            if (colNumber >= 7) cell.alignment = { horizontal: 'center' };
        });

        uSumA += (d['QTY ACTIVO'] || 0); uSumR += (d['QTY RESERVA'] || 0); uSumB += (d['QTY BUFFER'] || 0);
        gSumA += (d['QTY ACTIVO'] || 0); gSumR += (d['QTY RESERVA'] || 0); gSumB += (d['QTY BUFFER'] || 0);
        lastUbi = d.UBICACIONES;
    });

    if (lastUbi !== "") {
        const lastTotal = wsAnalisis.addRow([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB]);
        lastTotal.font = { bold: true, size: 14, name: 'Calibri' };
        lastTotal.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
        [7, 8, 9].forEach(c => lastTotal.getCell(c).alignment = { horizontal: 'center' });
    }
    wsAnalisis.addRow([]);
    const gtRow = wsAnalisis.addRow(["TOTAL GENERAL", "", "", "", "", "", gSumA, gSumR, gSumB]);
    gtRow.height = 25;
    gtRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    gtRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: 'middle' };
    });
    [7, 8, 9].forEach(c => gtRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });

    // --- OTRAS PESTAÑAS ---
    const addStandardSheet = (name, jsonData, tabColor = null) => {
        if (!jsonData || jsonData.length === 0) return;
        const ws = workbook.addWorksheet(name, { properties: { tabColor: tabColor ? { argb: tabColor } : undefined } });
        const keys = Object.keys(jsonData[0] || {});
        ws.columns = keys.map(k => ({ header: k, key: k, width: 20 }));
        ws.addRows(jsonData);
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    };

    addStandardSheet('Detalle', data.resumenSKUDetalle);
    addStandardSheet('Sku Bajar', (data.resumenSKUDetalle || []).filter(s => s.Diferencia > 0));
    addStandardSheet('LPN Selecionados', physicalDetalle.map(d => ({
        'Ubicacion': d.UBICACIONES, 'LPN': d.LPN, 'Sku': d.SKU, 'Stock Activo': d['QTY ACTIVO'],
        'Stock Reserva': d['QTY RESERVA'], 'Qty Buffer': d['QTY BUFFER'], 'Articulo': d.Articulo
    }))); // Sin color para evitar confusión

    addStandardSheet('Tallas', Object.entries(tallasMap).map(([sku, talla]) => ({ 'SKU': sku, 'TALLA': talla })));
    addStandardSheet('Detalle Zonas', (data.detalleZonas || []).filter(d => d['NIVEL/AREA'] !== '7. SIN STOCK'));
    addStandardSheet('Sin Stock', (data.detalleZonas || []).filter(d => d['NIVEL/AREA'] === '7. SIN STOCK').map(d => ({
        'NIVEL/AREA': d['NIVEL/AREA'], 'ARTÍCULO': d['ARTÍCULO'], 'SKU': d['SKU'], 'ATD RQ': d['ATD RQ']
    })));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Detalle_Buffer_Completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
};

window.downloadExcelZonas = () => {
    alert("⚠️ Este reporte ahora está integrado en 'EXCEL DETALLE'.");
};

export const renderDashboard = async (container, user, onLogout) => {
  pingServer();
  await initPersistentData();
  await adminService.initializeAdminData();
  
  // [FIX] Sincronización proactiva de Maestros y Tabla Virtual
  await Promise.all([
      getAreaData('tabla_tallas'),
      getAreaData('tallas'),
      getAreaData('articulos')
  ]);
  
  await loadAlmacenajeTasks();
  
  // Heartbeat de Sincronización Global (Desactivado a petición del usuario v17.4.2)
  /* 
  setInterval(async () => {
      await adminService.initializeAdminData();
      if (currentTab === 'almacenaje') {
          const synced = adminService.adminStore.almacenaje_tasks;
          if (Array.isArray(synced) && synced.length > 0) {
              almacenajeTasksCache = synced;
              const container = document.getElementById('areaContent');
              if (container && (localStorage.getItem('activeSub_almacenaje') === 'tareas_dia' || localStorage.getItem('activeSub_almacenaje') === 'kpi_tareas')) {
                  renderAlmacenajeTareas(container);
              }
          }
      }
  }, 30000);
  */
  
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
  
  // [CRÍTICO] Los permisos ya vienen sincronizados desde app.js (adminService.initializeAdminData)
  const rolePermissions = adminService.getPermissions(user.role) || {};

  // [PROTECCIÓN] Evitar crash si no hay pestañas permitidas
  const allowedTabs = TABS.filter(t => {
      if (user.role === 'admin') return true;
      if (t.id === 'inicio') return true;
      return rolePermissions[t.id] === 1;
  });
  
  if (allowedTabs.length === 0) {
      container.innerHTML = `<div style="color:white; padding:2rem; text-align:center;"><h2>No tienes permisos asignados.</h2><p>Contacta con Daniel Ames.</p><button onclick="location.reload()" class="btn">Reintentar</button></div>`;
      return;
  }
  let currentTab = allowedTabs[0]?.id;

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
            LOGÍSTICA <span style="color:#818cf8">DEAM1830</span> 
            <span style="font-size:12px; color:rgba(255,255,255,0.4); font-weight:400; margin-left:5px;">v18.6.0</span>
          </h2>
        </div>
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
    if (!tabObj) return; // Evitar crash
    const dateTag = currentDateFilter ? ` <span style="background:var(--warning); color:#000; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:600;">Snapshot: ${currentDateFilter}</span>` : '';
    contentTitle.innerHTML = tabObj.label + dateTag;
    
    if (!silent) {
        contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p>Sincronizando...</p></div>`;
    }

    if (currentTab === 'inicio') await renderHomeTab();
    else if (currentTab === 'buffer') await renderBufferTab();
    else if (currentTab === 'analisis_sku') await renderAnalisisSKUTab();
    else if (currentTab === 'inventario') await renderInventarioTab();
    else if (currentTab === 'picking') await renderGenericAreaTab('picking', 'Gestión de Picking');
    else if (currentTab === 'packing') await renderGenericAreaTab('packing', 'Gestión de Packing');
    else if (currentTab === 'despacho') await renderGenericAreaTab('despacho', 'Gestión de Despacho');
    else if (currentTab === 'no_retail') await renderGenericAreaTab('no_retail', 'Gestión NO RETAIL');
    else if (currentTab === 'recepcion') await renderGenericAreaTab('recepcion', 'Gestión de Recepción');
    else if (currentTab === 'almacenaje') await renderGenericAreaTab('almacenaje', 'Gestión de Almacenaje');
    else if (currentTab === 'admin_pers') await renderAdminTab();
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
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; buf.appendChild(wrap);
        renderUploadArea(wrap, 'buffer_activo', dataStore.buffer_activo, '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, 'buffer_reserva', dataStore.buffer_reserva, '.xlsx', 'STOCK RESERVA');
        renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv', 'PEDIDOS');
        renderUploadArea(wrap, 'solicitud', dataStore.solicitud, '.xlsx', 'OTRAS SOLICITUDES');
        renderUploadArea(wrap, 'articulos', dataStore.articulos, '.xlsx', 'MAESTRO');
        renderUploadArea(wrap, 'tallas', dataStore.tallas, '.xlsx', 'REPLENISHMENT');
    } else if (activeBufferSub === 'historial_buffer') {
        renderBufferHistory(buf);
    } else if (activeBufferSub === 'kpi_buffer') {
        renderBufferKPI(buf);
    } else {
        const now = new Date();
        const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        buf.innerHTML = `
          <div style="background:rgba(30, 41, 59, 0.3); padding:1rem 1.5rem; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:rgba(255,255,255,0.03); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
              <div style="display:flex; align-items:center; gap:1rem;">
                  <button id="btn_calc" class="btn" style="background:var(--primary); width:auto; padding:0.5rem 1.5rem; border-radius:8px; font-size:0.8rem; font-weight:800; box-shadow:0 0 15px rgba(79,70,229,0.3);">⚡ PROCESAR ANÁLISIS</button>
                  <button id="btn_reset_cache" title="Reiniciar Memoria" style="background:none; border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); font-size:0.65rem; padding:0.4rem 0.8rem; cursor:pointer; border-radius:6px; transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.3)'; this.style.color='#fff';" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='var(--text-muted)';">🧹 REINICIAR MEMORIA</button>
              </div>
              <div id="export_actions" style="display:flex; gap:0.5rem;"></div>
            </div>
            <div id="resultsArea" style="display:flex; gap:0.6rem; align-items:start;"></div>
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
                        // VALIDACIÓN EXPLÍCITA DE ARCHIVOS
                        if (!dataStore.buffer_activo) throw new Error("Falta cargar el archivo STOCK ACTIVO.");
                        if (!dataStore.buffer_reserva) throw new Error("Falta cargar el archivo STOCK RESERVA.");
                        if (!dataStore.articulos) throw new Error("Falta cargar el archivo MAESTRO.");

                        const config = await fetchBufferConfig().catch(() => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' }));
                        const res = calculateBufferPallets(config);
                        if (res) {
                            lastBufferKPI = res;
                            lastBufferResult = res;
                            try {
                                localStorage.setItem('lastBufferKPI', JSON.stringify(res));
                            } catch(e) { console.warn("[PULSE] Quota Full en Zona Buffer", e); }
                            renderBufferResults(results, res); 
                            
                            // NUEVO: Guardar 3 registros (uno por cada fuente) en el historial
                            setTimeout(async () => {
                                if (confirm("¿Deseas guardar este análisis desglosado por FUENTE en el Historial?")) {
                                    const sources = ['PEDIDO', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
                                    let successCount = 0;
                                    for (const s of sources) {
                                        const sourceRows = res.resumenNiveles.filter(n => n.fuente === s);
                                        if (sourceRows.length > 0) {
                                            const saved = await saveBufferReport({ resumenNiveles: sourceRows, sourceName: s }, user.username);
                                            if (saved) successCount++;
                                        }
                                    }
                                    if (successCount > 0) alert(`✅ Se guardaron ${successCount} reportes en el historial.`);
                                }
                            }, 300);
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

  const createMatrixHTML = (matrix, title, timestamp = '') => {
    const hasData = matrix && matrix.rows && matrix.rows.length > 0;
    
    const brandAlias = (name) => {
        if (name === 'Bubblegummers Licenses') return 'BG Licenses';
        if (name === 'Bubblegummers') return 'BG';
        if (name === 'Bata Industrials') return 'Industrials';
        return name;
    };
    const genderAlias = (name) => {
        if (name === '11 NON COMMERCIAL COMPLEMENTS') return '11 COMPLEMENTS';
        return name;
    };

    return `
        <div style="background:rgba(15,23,42,0.9); border:2px solid #06b6d4; border-radius:12px; overflow:hidden; box-shadow: 0 0 15px rgba(6,182,212,0.3); margin-bottom:0.6rem; min-height: 150px;">
            <div style="padding:0.7rem; background:rgba(6,182,212,0.1); border-bottom:1px solid rgba(6,182,212,0.3); text-align:center;">
                <h3 style="color:#06b6d4; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px; white-space:nowrap;">
                    ${title} ${timestamp ? `<span style="font-size:0.7rem; opacity:0.4; margin-left:8px; font-weight:400; vertical-align:middle;">(${timestamp})</span>` : ''}
                </h3>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead style="background:rgba(0,0,0,0.5);">
                        <tr style="color:var(--text-muted); border-bottom:1px solid rgba(6,182,212,0.2);">
                            <th style="padding:0.6rem 0.8rem; text-align:left; background:rgba(6,182,212,0.05); color:#fff;">MARCA</th>
                            ${hasData ? matrix.columns.map(c => `<th style="padding:0.6rem 0.3rem; text-align:center; min-width:70px;">${genderAlias(c)}</th>`).join('') : '<th style="padding:0.6rem 0.3rem; text-align:center;">ESTADO</th>'}
                            <th style="padding:0.6rem 0.8rem; text-align:center; background:rgba(236,72,153,0.1); color:#ec4899; font-weight:900;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody style="color:#eee;">
                        ${hasData ? matrix.rows.map(r => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.marca==='TOTAL'?'background:rgba(6,182,212,0.15); font-weight:900;':''}">
                                <td style="padding:0.4rem 0.8rem; font-weight:700; ${r.marca==='TOTAL'?'color:#22c55e':''}">${brandAlias(r.marca)}</td>
                                ${matrix.columns.map(c => {
                                    const val = r.breakdown[c] || 0;
                                    return `<td style="padding:0.4rem 0.3rem; text-align:center; color:${val > 0 ? '#fff' : 'rgba(255,255,255,0.1)'}; font-weight:${val > 0 ? '700' : 'normal'}">${val > 0 ? val.toLocaleString() : '0'}</td>`;
                                }).join('')}
                                <td style="padding:0.4rem 0.8rem; text-align:center; background:rgba(236,72,153,0.05); color:#22c55e; font-weight:900; border-left:1px solid rgba(255,255,255,0.05);">${r.total.toLocaleString()}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="padding:2rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay datos para procesar en este reporte.</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  };

  const renderBufferResults = (container, data) => {
    lastBufferResult = data; // [MOD v12.4.1] Sincronizar estado global para permitir exportación inmediata
    const ts = data.timestamp || new Date().toLocaleString();
    const tsHtml = `<span style="font-size:0.7rem; opacity:0.4; margin-left:8px; font-weight:400; vertical-align:middle;">(${ts})</span>`;
    const widthLeft = '580px';
    const widthRight = '1200px';

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.6rem; width:${widthLeft};">
            <!-- COLUMNA IZQUIERDA: ZONAS + SKU -->
            <div style="background:rgba(15,23,42,0.9); border:2px solid #4f46e5; border-radius:12px; overflow:hidden; box-shadow: 0 0 15px rgba(79,70,229,0.3);">
                <div style="padding:0.7rem; background:rgba(79,70,229,0.1); border-bottom:1px solid rgba(79,70,229,0.3); text-align:center;"><h3 style="color:#fff; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px; white-space:nowrap;">ANÁLISIS BUFFER ZONAS ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.82rem; white-space:nowrap;">
                    <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(79,70,229,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">NIVEL/AREA</th><th style="padding:0.6rem 1rem; text-align:center;">RQ</th><th style="padding:0.6rem 1rem; text-align:center;">ATD</th><th style="padding:0.6rem 1rem; text-align:center;">ATD %</th></tr></thead>
                    <tbody style="color:#eee;">${data.waterfall.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.nivel==='Total'?'background:rgba(79,70,229,0.08); font-weight:900;':''}">
                        <td style="padding:0.5rem 1rem; color:${r.nivel==='Total'?'#22c55e':'inherit'};">${r.nivel}</td>
                        <td style="padding:0.5rem 1rem; text-align:center;">${r.rq.toLocaleString()}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:${r.atd > 0 ? '#fff' : '#64748b'};">${r.atd.toLocaleString()}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e;">${r.pct}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>

            <div style="background:rgba(15,23,42,0.9); border:2px solid #f59e0b; border-radius:12px; overflow:hidden; box-shadow: 0 0 15px rgba(245,158,11,0.3);">
                <div style="padding:0.7rem; background:rgba(245,158,11,0.1); border-bottom:1px solid rgba(245,158,11,0.3); text-align:center;"><h3 style="color:#f59e0b; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px; white-space:nowrap;">ANÁLISIS BUFFER SKU ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.82rem; white-space:nowrap;">
                    <thead style="background:rgba(0,0,0,0.5);"><tr style="color:var(--text-muted); border-bottom:1px solid rgba(245,158,11,0.2);"><th style="padding:0.6rem 1rem; text-align:left;">FUENTE</th><th style="padding:0.6rem 1rem; text-align:left;">TIPO</th><th style="padding:0.6rem 1rem; text-align:center;">PALETAS</th><th style="padding:0.6rem 1rem; text-align:center;">SKU</th><th style="padding:0.6rem 1rem; text-align:center;">PAR/CAJA</th></tr></thead>
                    <tbody style="color:#eee;">${data.resumenSKU.map(r => `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); ${r.fuente.includes('TOTAL') ? 'background:rgba(255,255,255,0.04); font-weight:700;' : ''}">
                        <td style="padding:0.5rem 1rem; color:${r.fuente.includes('TOTAL') ? '#d1d5db' : 'var(--primary)'}; font-weight:700;">${r.fuente}</td>
                        <td style="padding:0.5rem 1rem; color:#94a3b8;">${r.tipo}</td>
                        <td style="padding:0.5rem 1rem; text-align:center;">${r.paletas}</td>
                        <td style="padding:0.5rem 1rem; text-align:center;">${r.skus}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#22c55e;">${Number(r.parcaja).toLocaleString()}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>

            <div style="background:rgba(15,23,42,0.9); border:2px solid #ef4444; border-radius:12px; overflow:hidden; box-shadow: 0 0 15px rgba(239,68,68,0.3);">
                <div style="padding:0.7rem; background:rgba(239,68,68,0.1); border-bottom:1px solid rgba(239,68,68,0.3); text-align:center;"><h3 style="color:#ef4444; font-weight:800; margin:0; font-size:0.85rem; letter-spacing:1px; white-space:nowrap;">RESUMEN 7. SIN STOCK ${tsHtml}</h3></div>
                <div style="display:flex; justify-content:space-around; padding:1.2rem; color:#eee;">
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad Artículos</div>
                        <div style="font-size:1.6rem; font-weight:900; color:#fff;">${(data.sinStockSummary?.articulos || 0).toLocaleString()}</div>
                    </div>
                    <div style="text-align:center; border-left:1px solid rgba(255,255,255,0.1); padding-left:0.5rem;">
                        <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad SKUs</div>
                        <div style="font-size:1.6rem; font-weight:900; color:#fff;">${(data.sinStockSummary?.skus || 0).toLocaleString()}</div>
                    </div>
                    <div style="text-align:center; border-left:1px solid rgba(255,255,255,0.1); padding-left:0.5rem;">
                        <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad Unidades (RQ)</div>
                        <div style="font-size:1.6rem; font-weight:900; color:#ef4444;">${(data.sinStockSummary?.qty || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.6rem; width:${widthRight};">
            ${createMatrixHTML(data.resumenMatrix, 'DISCREPANCIA BUFFER | ZONAS 3, 4, 5, 6', ts)}
            ${createMatrixHTML(data.resumenMatrixSinStock, 'ANÁLISIS BUFFER | SIN STOCK (ZONA 7)', ts)}
        </div>
    `;

    const exportArea = document.getElementById('export_actions');
    if (exportArea) {
        exportArea.innerHTML = `
            <button id="btn_exp_buffer" class="btn" style="width:auto; background:var(--success); padding:0.5rem 1.5rem; border-radius:8px; font-size:0.8rem; font-weight:800; box-shadow:0 0 15px rgba(34,197,94,0.3);">📥 EXCEL DETALLE</button>
        `;
        document.getElementById('btn_exp_buffer').onclick = () => {
            if(!data.detalle || !data.detalle.length) alert('⚠️ ERROR: Datos no disponibles.');
            else window.downloadExcelDetail();
        };
    }
  };

  let activeAdminSub = 'trabajadores';
  const renderAdminTab = () => {
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
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="dni" contenteditable="true" style="padding:0.7rem; font-weight:800; color:#fff; outline:none;">${w.dni || w.Dni || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="nombre" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.nombre || w.Nombre || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="apellidos" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.apellidos || w.Apellidos || ''}</td>
                                    <td class="edit-worker" data-dni="${w.dni || w.Dni}" data-f="puesto" contenteditable="true" style="padding:0.7rem; outline:none; text-transform:uppercase;">${w.puesto || w.Puesto || ''}</td>
                                    <td style="padding:0.7rem;">
                                        <select class="edit-worker-select" data-dni="${w.dni || w.Dni}" data-f="turno" style="background:rgba(255,255,255,0.05); border:none; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.65rem; outline:none; cursor:pointer;">
                                            <option value="DIA" ${ (w.turno||w.Turno)==='DIA'?'selected':'' }>DIA</option>
                                            <option value="NOCHE" ${ (w.turno||w.Turno)==='NOCHE'?'selected':'' }>NOCHE</option>
                                        </select>
                                    </td>
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
    document.getElementById('form_new_worker').onsubmit = async (e) => {
        e.preventDefault();
        const nw = {
            dni: document.getElementById('nw_dni').value.trim(),
            nombre: document.getElementById('nw_nombre').value.toUpperCase().trim(),
            apellidos: document.getElementById('nw_apellidos').value.toUpperCase().trim(),
            puesto: document.getElementById('nw_puesto').value.toUpperCase().trim(),
            turno: document.getElementById('nw_turno').value
        };
        await adminService.saveWorker(nw);
        renderAdminTab();
    };

    document.querySelectorAll('.btn-worker-status').forEach(btn => {
        btn.onclick = async () => {
            await adminService.toggleWorkerStatus(btn.dataset.dni);
            renderAdminTab();
        };
    });

    // Eventos para Edición Directa
    document.querySelectorAll('.edit-worker').forEach(cell => {
        cell.onblur = (e) => {
            const dni = e.target.dataset.dni;
            const field = e.target.dataset.f;
            const val = e.target.innerText.trim();
            const updates = {};
            updates[field] = (field === 'dni') ? val : val.toUpperCase();
            adminService.saveWorker({ dni, ...updates });
            // Si cambió el DNI, necesitamos refrescar para que los IDs de las celdas se actualicen
            if (field === 'dni') renderAdminTab();
        };
    });

    document.querySelectorAll('.edit-worker-select').forEach(sel => {
        sel.onchange = (e) => {
            const dni = e.target.dataset.dni;
            const field = e.target.dataset.f;
            const val = e.target.value;
            const updates = {};
            updates[field] = val;
            adminService.saveWorker({ dni, ...updates });
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
                                <th style="padding:0.8rem; text-align:left;">Contraseña</th>
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
                                    <td style="padding:0.8rem; font-family:monospace;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <span id="pass_${u.username}" data-p="${u.password}" style="color:#fcd34d;">••••••••</span>
                                            <button class="btn-toggle-pass" data-target="pass_${u.username}" style="background:none; border:none; cursor:pointer; font-size:0.9rem; padding:0;">👁️</button>
                                        </div>
                                    </td>
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

    // LÓGICA DE USUARIO AUTOMÁTICO: 1ra Letra Nombre + Todo el Apellido
    uName.addEventListener('input', () => {
        if (!isEditing) {
            const raw = uName.value.trim().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar tildes
            const parts = raw.split(/\s+/);
            if (parts.length >= 2) {
                const firstInitial = parts[0].charAt(0);
                // "Todo el apellido" = El resto de palabras juntas
                const lastNamePart = parts.slice(1).join('');
                uUser.value = (firstInitial + lastNamePart).replace(/[^a-z0-9]/g, ''); // Solo letras y números
            } else {
                uUser.value = raw.replace(/[^a-z0-9]/g, '');
            }
        }
    });

    // LÓGICA DE MOSTRAR/OCULTAR CONTRASEÑA
    container.querySelectorAll('.btn-toggle-pass').forEach(btn => {
        btn.onclick = (e) => {
            const targetId = e.currentTarget.dataset.target;
            const span = document.getElementById(targetId);
            const realPass = span.dataset.p;
            if (span.textContent === '••••••••') {
                span.textContent = realPass;
                e.currentTarget.textContent = '🙈';
            } else {
                span.textContent = '••••••••';
                e.currentTarget.textContent = '👁️';
            }
        };
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        try {
            console.log("[PULSE] Guardando usuario...", { name: uName.value, username: uUser.value });
            const newUser = {
                name: uName.value,
                username: uUser.value,
                password: uPass.value,
                role: uRole.value
            };
            
            // Deshabilitar botón durante el proceso
            btnSubmit.disabled = true;
            btnSubmit.textContent = "⏳ GUARDANDO...";

            const success = await adminService.saveUser(newUser);
            
            if (success) {
                alert(isEditing ? '🚀 Usuario actualizado con éxito' : '🚀 Usuario creado con éxito');
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
            } else {
                alert('⚠️ El usuario se guardó localmente pero falló la sincronización con el servidor.');
                renderAdminTab();
            }
        } catch (err) {
            console.error("[PULSE] Error al guardar usuario:", err);
            alert("❌ Error crítico: " + err.message);
        } finally {
            btnSubmit.disabled = false;
            if (!isEditing) btnSubmit.textContent = "GUARDAR USUARIO";
            else btnSubmit.textContent = "ACTUALIZAR DATOS";
        }
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

    document.querySelectorAll('.btn-status').forEach(btn => btn.onclick = async () => {
        await adminService.toggleUserStatus(btn.dataset.user);
        renderAdminTab();
    });

    document.querySelectorAll('.btn-del').forEach(btn => btn.onclick = async () => {
        if (confirm('¿Estás seguro de eliminar permanentemente este usuario?')) {
            await adminService.deleteUser(btn.dataset.user);
            renderAdminTab();
        }
    });
  };

  const renderPermisosSection = (container) => {
    const roles = ['jefe', 'coordinador', 'supervisor', 'encargado', 'asistente'];
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
                        ${allRoles.map(r => `<th style="padding:1rem; text-align:center; min-width:80px; border-left:1px solid rgba(255,255,255,0.05);">${r.toUpperCase()}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${TABS.map(t => {
                        let rows = [];
                        const hasSub = t.subTabs && t.subTabs.length > 0;
                        
                        // Nivel 1: Fila principal
                        rows.push(`
                        <tr class="main-tab-row" data-tab-id="${t.id}" style="border-bottom:1px solid rgba(255,255,255,0.02); background:rgba(255,255,255,0.02); cursor:${hasSub ? 'pointer' : 'default'};">
                            <td style="padding:0.8rem; font-weight:700; border-right:1px solid var(--border); color:#fff; display:flex; align-items:center; gap:8px;">
                                ${hasSub ? '<span class="toggle-icon">▶</span>' : ''}
                                ${t.icon} ${t.label}
                            </td>
                            ${allRoles.map(r => {
                                let hasAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[t.id] === 1 || t.roles.includes(r));
                                if (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(t.id)) hasAccess = true;
                                const isFixed = r === 'admin' || (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(t.id));
                                return `<td style="padding:0.8rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${t.id}" ${hasAccess ? 'checked' : ''} ${isFixed ? 'disabled' : 'style="cursor:pointer;"'}></td>`;
                            }).join('')}
                        </tr>`);

                        // Nivel 2: Filas de sub-pestañas
                        if (hasSub) {
                            t.subTabs.forEach(sub => {
                                const subKey = `${t.id}_${sub.id}`;
                                const hasSubSub = sub.subTabs && sub.subTabs.length > 0;
                                rows.push(`
                                <tr class="sub-row-${t.id} ${hasSubSub ? 'main-tab-row' : ''}" data-tab-id="${subKey}" style="border-bottom:1px solid rgba(255,255,255,0.01); display:none; background:rgba(255,255,255,0.01); cursor:${hasSubSub ? 'pointer' : 'default'};">
                                    <td style="padding:0.6rem 0.8rem 0.6rem 2.5rem; font-style:italic; color:var(--text-muted); border-right:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                                        ${hasSubSub ? '<span class="toggle-icon">▶</span>' : ''}
                                        ${sub.icon} ${sub.label}
                                    </td>
                                    ${allRoles.map(r => {
                                        let hasSubAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[subKey] === 1 || t.roles.includes(r));
                                        if (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(subKey)) hasSubAccess = true;
                                        const isFixedSub = r === 'admin' || (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(subKey));
                                        return `<td style="padding:0.6rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${subKey}" ${hasSubAccess ? 'checked' : ''} ${isFixedSub ? 'disabled' : 'style="cursor:pointer; opacity:0.7;"'}></td>`;
                                    }).join('')}
                                </tr>`);

                                // Nivel 3: Filas de sub-sub-pestañas (Performance -> Historial/Graficos/Reporte)
                                if (hasSubSub) {
                                    sub.subTabs.forEach(ss => {
                                        const ssKey = `${sub.id}_${ss.id}`;
                                        rows.push(`
                                        <tr class="sub-row-${subKey}" style="border-bottom:1px solid rgba(255,255,255,0.005); display:none; background:rgba(0,0,0,0.2);">
                                            <td style="padding:0.5rem 0.8rem 0.5rem 4.5rem; font-size:0.7rem; color:var(--primary); border-right:1px solid var(--border);">${ss.icon} ${ss.label}</td>
                                            ${allRoles.map(r => {
                                                let hasSSAccess = r === 'admin' ? true : (adminService.getPermissions(r)?.[ssKey] === 1 || t.roles.includes(r));
                                                if (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(ssKey)) hasSSAccess = true;
                                                const isFixedSS = r === 'admin' || (r === 'asistente' && adminService.FORCED_ASISTENTE.includes(ssKey));
                                                return `<td style="padding:0.5rem; text-align:center;"><input type="checkbox" class="perm-toggle" data-role="${r}" data-tab="${ssKey}" ${hasSSAccess ? 'checked' : ''} ${isFixedSS ? 'disabled' : 'style="cursor:pointer; opacity:0.6;"'}></td>`;
                                            }).join('')}
                                        </tr>`);
                                    });
                                }
                            });
                        }
                        return rows.join('');
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:1rem; padding:1rem; background:rgba(79,70,229,0.05); border-radius:8px; border:1px solid rgba(79,70,229,0.2);">
            <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">
                <b>Tip:</b> Haz clic en los módulos con el icono ▶ para expandir sus secciones. El anidamiento permite un control quirúrgico de lo que cada rol puede ver.
            </p>
        </div>
    `;

    // Lógica de Acordeón (Universal por data-tab-id)
    document.querySelectorAll('.main-tab-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
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

  const getLocalDateStr = () => {
      const d = new Date();
      return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  };
  let forcedDate = getLocalDateStr(); // Default hoy (Local)
  let localState = [];

  const renderAsistenciaSection = (container) => {
    const workers = adminService.getWorkers().filter(w => w.active !== false && (w.turno === 'NOCHE' || w.Turno === 'NOCHE'));
    
    const loadAttendanceState = (dateStr) => {
        const existing = adminService.getAttendance(dateStr);
        if (existing) {
            localState = existing.data.map(d => ({ ...d }));
            workers.forEach(w => {
                const wDni = String(w.dni || w.Dni || '');
                if (!localState.find(d => String(d.dni) === wDni)) {
                    localState.push({
                        dni: wDni,
                        nombre: (w.nombre || w.Nombre),
                        apellidos: (w.apellidos || w.Apellidos),
                        present: true,
                        onTime: true,
                        justification: ''
                    });
                }
            });
            return existing;
        }
        localState = workers.map(w => ({ 
            dni: String(w.dni || w.Dni || ''), 
            nombre: (w.nombre || w.Nombre), 
            apellidos: (w.apellidos || w.Apellidos), 
            present: true,
            onTime: true,
            justification: ''
        }));
        return null;
    };

    const existing = loadAttendanceState(forcedDate);
    const dateFormatted = new Date(forcedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    if (!workers.length) {
        container.innerHTML = `<div style="padding:3rem; text-align:center;"><p style="color:var(--text-muted);">Debes importar o registrar <b>Trabajadores Activos</b> antes de tomar asistencia.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap;">
            <div style="background:rgba(255,255,255,0.03); padding:0.8rem 1.2rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05); box-shadow:0 4px 15px rgba(0,0,0,0.2); display:flex; align-items:center; gap:15px;">
                <div>
                    <h3 style="color:var(--primary); margin:0; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px;">Asistencia Diaria</h3>
                    <p style="font-size:0.85rem; color:#fff; margin:4px 0 0 0; font-weight:600; text-transform:capitalize;">🗓️ ${dateFormatted}</p>
                </div>
                <input type="date" id="asist_date_picker" value="${forcedDate}" style="background:rgba(255,255,255,0.1); border:1px solid var(--border); color:#fff; padding:0.4rem; border-radius:6px; font-size:0.8rem; outline:none;">
            </div>
            <div id="attendance_top_actions" style="display:flex; gap:1rem; align-items:center;"></div>
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
                        <th style="padding:0.8rem; text-align:center;">Justificación</th>
                    </tr>
                </thead>
                <tbody>
                    ${workers.map((w, idx) => {
                        const dni = String(w.dni || w.Dni || '');
                        const rec = localState.find(d => String(d.dni) === dni);
                        const isPresent = rec ? rec.present : true;
                        const isOnTime = rec ? rec.onTime : true;
                        const displayName = `${w.apellidos || w.Apellidos || ''}, ${w.nombre || w.Nombre || ''}`;
                        const isFinalized = existing?.finalized || false;
                        
                        return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                            <td style="padding:0.8rem; color:#fff; font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">${dni}</td>
                            <td style="padding:0.8rem; font-weight:600;">${displayName}</td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button ${isFinalized ? 'disabled' : ''} onclick="window.updateAsist('${dni}', true)" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isPresent?'var(--success)':'none'}; color:${isPresent?'#000':'#fff'}; font-size:0.7rem; cursor:${isFinalized?'default':'pointer'}; opacity:${isFinalized?0.5:1};">P</button>
                                    <button ${isFinalized ? 'disabled' : ''} onclick="window.updateAsist('${dni}', false)" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isPresent?'#ef4444':'none'}; color:#fff; font-size:0.7rem; cursor:${isFinalized?'default':'pointer'}; opacity:${isFinalized?0.5:1};">F</button>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <div style="display:flex; gap:0.5rem; justify-content:center;">
                                    <button ${isFinalized ? 'disabled' : ''} onclick="window.updateOnTime('${dni}', true)" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${isOnTime?'#06b6d4':'none'}; color:#fff; font-size:0.7rem; cursor:${isFinalized?'default':'pointer'}; opacity:${isFinalized?0.5:1};">SÍ</button>
                                    <button ${isFinalized ? 'disabled' : ''} onclick="window.updateOnTime('${dni}', false)" style="padding:0.3rem 0.8rem; border-radius:4px; border:1px solid var(--border); background:${!isOnTime?'#f97316':'none'}; color:#fff; font-size:0.7rem; cursor:${isFinalized?'default':'pointer'}; opacity:${isFinalized?0.5:1};">NO</button>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select ${isFinalized ? 'disabled' : ''} onchange="window.updateJust('${dni}', this.value)" style="background:rgba(255,255,255,0.1); border:1px solid var(--border); color:#fff; padding:0.3rem 0.5rem; border-radius:6px; font-size:0.7rem; outline:none; cursor:${isFinalized?'default':'pointer'}; opacity:${isFinalized?0.5:1};">
                                    <option value="" style="background:#1e293b;">- SELECCIONE -</option>
                                    <option value="Descanso Médico" ${rec?.justification==='Descanso Médico'?'selected':'' } style="background:#1e293b;">DESCANSO MÉDICO</option>
                                    <option value="Vacaciones" ${rec?.justification==='Vacaciones'?'selected':'' } style="background:#1e293b;">VACACIONES</option>
                                    <option value="Otros" ${rec?.justification==='Otros'?'selected':'' } style="background:#1e293b;">OTROS</option>
                                </select>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // --- ACCIONES DINÁMICAS (WINDOW SCOPE) ---
    window.updateAsist = (dni, val) => {
        const node = localState.find(s => String(s.dni) === String(dni));
        if (node) {
            node.present = val;
            if (!val) node.onTime = false;
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
            renderAsistenciaSection(container);
        }
    };

    window.updateOnTime = (dni, val) => {
        const node = localState.find(s => String(s.dni) === String(dni));
        if (node) {
            node.onTime = val;
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
            renderAsistenciaSection(container);
        }
    };

    window.updateJust = (dni, val) => {
        const node = localState.find(s => String(s.dni) === String(dni));
        if (node) {
            node.justification = val;
            adminService.saveAttendance(forcedDate, { finalized: false, data: localState });
        }
    };

    // --- RENDERIZADO DE BOTONES DE ACCIÓN (PARTE SUPERIOR) ---
    const topActions = document.getElementById('attendance_top_actions');
    if (topActions) {
        const btnSync = document.createElement('button');
        btnSync.className = 'btn-secondary';
        btnSync.title = 'Sincronizar con la Nube';
        btnSync.style = 'padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); cursor:pointer; font-size:1rem; border:1px solid rgba(255,255,255,0.1); color:#fff;';
        btnSync.innerHTML = '🔄 Sincronizar';
        btnSync.onclick = async () => {
            btnSync.innerHTML = '⌛...';
            btnSync.disabled = true;
            await adminService.initializeAdminData();
            renderAsistenciaSection(container);
            alert("☁️ Nube sincronizada correctamente");
        };

        const btnClose = document.createElement('button');
        btnClose.className = 'btn-primary';
        btnClose.style = 'background:var(--primary); padding:0.6rem 1.5rem; border-radius:8px; font-weight:800; cursor:pointer; font-size:0.85rem;';
        btnClose.innerHTML = '💾 CERRAR ASISTENCIA';

        if (existing?.finalized) {
            btnClose.innerHTML = '✅ ASISTENCIA CERRADA';
            btnClose.style.background = 'var(--success)';
            btnClose.style.color = '#000';
            btnClose.disabled = true;
            btnClose.style.cursor = 'default';
            
            // Usamos la sesión de auth.js para verificar al usuario
            const session = JSON.parse(localStorage.getItem('logistics_session') || '{}');
            if (session.username === 'dames') {
                const btnReopen = document.createElement('button');
                btnReopen.className = 'btn-danger';
                btnReopen.innerHTML = '🔓 REABRIR';
                btnReopen.style = 'padding:0.6rem 1.2rem; border-radius:8px; font-weight:800; cursor:pointer; background:#ef4444; font-size:0.85rem;';
                btnReopen.onclick = async () => {
                    if (confirm("¿Seguro que deseas REABRIR esta fecha? Se podrá editar nuevamente.")) {
                        btnReopen.disabled = true;
                        btnReopen.textContent = "⌛ ABRIENDO...";
                        await adminService.reopenAttendance(forcedDate);
                        renderAsistenciaSection(container);
                    }
                };
                topActions.appendChild(btnReopen);
            }
        } else {
            btnClose.onclick = async () => {
                if (confirm(`¿Confirmas cerrar la asistencia para el día ${forcedDate}?`)) {
                    try {
                        btnClose.disabled = true;
                        btnClose.textContent = "⌛ ENVIANDO...";
                        const success = await adminService.closeAttendanceAndSyncPerformance(forcedDate, localState);
                        if (success) {
                            alert("✅ Información enviada a la nube");
                            renderAsistenciaSection(container);
                        } else {
                            alert("❌ Error de envío - Intente nuevamente");
                            btnClose.disabled = false;
                            btnClose.textContent = "💾 CERRAR ASISTENCIA";
                        }
                    } catch (err) {
                        console.error("Critical Send Error:", err);
                        alert("❌ Error fatal en el envío. Se ha reiniciado el botón.");
                        btnClose.disabled = false;
                        btnClose.textContent = "💾 CERRAR ASISTENCIA";
                    }
                }
            };
        }
        topActions.appendChild(btnSync);
        topActions.appendChild(btnClose);
    }

    const picker = document.getElementById('asist_date_picker');
    if (picker) {
        picker.onchange = (e) => {
            forcedDate = e.target.value;
            renderAsistenciaSection(container);
        };
    }
  };

  const calculateRendimiento = (p) => {
      let score = 0;
      if (p.asistencia === 'P') score += 30;
      if (p.puntualidad === 'SÍ') score += 10;
      
      const prod = parseFloat(p.produccion) || 0;
      const bpa = parseFloat(p.bpa) || 0;
      const sup = parseFloat(p.supervisor) || 0;
      
      score += (prod / 10) * 30;
      score += (bpa / 10) * 15;
      score += (sup / 10) * 15;
      
      return Math.round(score) + '%';
  };

  let kpiStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let kpiEnd = new Date().toISOString().split('T')[0];
  let kpiSearch = '';

  const renderKPIGraphsSection = (container) => {
    let rawLog = adminService.getPerformanceLog();
    if (!Array.isArray(rawLog)) rawLog = [];
    if (rawLog.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
            <i class="fas fa-chart-line fa-3x" style="opacity:0.2; margin-bottom:1rem;"></i>
            <h4>Sin datos de Performance</h4>
            <p style="font-size:0.85rem;">Es necesario cerrar la asistencia de uno o más días para generar estadísticas.</p>
        </div>`;
        return;
    }

    const parsePct = (str) => parseFloat(str.replace('%', '')) || 0;
    
    // Filtro de SEMANAS para el Ranking de Tardanzas (v11.4.2)
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    };
    
    // [MOD v17.1.7] Obtener todas las semanas disponibles en los datos (orden descendente)
    const availableWeeks = [...new Set(rawLog.map(e => getWeekNumber(new Date(e.date + 'T12:00:00'))))].sort((a,b) => b-a);
    
    const currentWeekNum = getWeekNumber(new Date());
    // Por defecto, seleccionar la semana actual SI hay datos, sino la última disponible
    if (!window._selectedWeeks) {
        if (availableWeeks.includes(currentWeekNum)) {
            window._selectedWeeks = [currentWeekNum];
        } else if (availableWeeks.length > 0) {
            window._selectedWeeks = [availableWeeks[0]];
        } else {
            window._selectedWeeks = [currentWeekNum];
        }
    }
    const selectedWeeks = window._selectedWeeks;
    const datesMap = {};
    rawLog.forEach(entry => {
        if (!datesMap[entry.date]) datesMap[entry.date] = { sum: 0, count: 0 };
        datesMap[entry.date].sum += parsePct(entry.rendimiento);
        datesMap[entry.date].count++;
    });
    const sortedDates = Object.keys(datesMap).sort();
    const evolutionLabels = sortedDates;
    const evolutionData = sortedDates.map(d => Math.round(datesMap[d].sum / datesMap[d].count));


    const globalWorkerMap = {};
    rawLog.forEach(entry => {
        const entryDate = new Date(entry.date + 'T12:00:00');
        const wNum = getWeekNumber(entryDate);
        if (!selectedWeeks.includes(wNum)) return;

        const key = (entry.dni || '').toString().trim();
        if (!globalWorkerMap[key]) {
            const worker = adminService.getWorkers().find(w => (w.dni || w.Dni || '').toString().trim() === key);
            const currentName = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${entry.apellidos}, ${entry.nombre}`;
            globalWorkerMap[key] = { name: currentName, sum: 0, count: 0, tardanzas: 0, diasTrabajados: 0, faltas: 0, faltasJustificadas: 0 };
        }
        
        if (entry.asistencia === 'P') {
            globalWorkerMap[key].sum += parsePct(entry.rendimiento);
            globalWorkerMap[key].count++;
            globalWorkerMap[key].diasTrabajados++;
            if (entry.puntualidad === 'NO') globalWorkerMap[key].tardanzas++;
        } else {
            const hasJustification = entry.justification && 
                                   entry.justification.trim() !== '' && 
                                   entry.justification.toUpperCase() !== 'NO';
            if (!hasJustification) globalWorkerMap[key].faltas++;
            else globalWorkerMap[key].faltasJustificadas++;
        }
    });

    const workerRanking = Object.values(globalWorkerMap)
        .filter(w => w.count > 0)
        .map(w => ({ name: w.name, avg: Math.round(w.sum / w.count), tardanzas: w.tardanzas }))
        .sort((a,b) => b.avg - a.avg).slice(0,5);

    const tardanzasRanking = Object.values(globalWorkerMap)
        .filter(w => w.tardanzas > 0)
        .sort((a,b) => b.tardanzas - a.tardanzas);

    const faltasRanking = Object.values(globalWorkerMap)
        .filter(w => w.faltas > 0)
        .sort((a,b) => b.faltas - a.faltas);

    const faltasJustificadasRanking = Object.values(globalWorkerMap)
        .filter(w => w.faltasJustificadas > 0)
        .sort((a,b) => b.faltasJustificadas - a.faltasJustificadas);

    const globalAvg = Math.round(evolutionData.reduce((a, b) => a + b, 0) / evolutionData.length);
    const getStatusColor = (val) => {
        if (val >= 90) return '#22c55e';
        if (val >= 80) return '#f59e0b';
        return '#ef4444';
    };

    container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
            <div class="glass-panel" style="padding:1.5rem; text-align:center; border-left:4px solid ${getStatusColor(globalAvg)};">
                <h4 style="margin:0; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Rendimiento General</h4>
                <h2 style="margin:0.5rem 0; font-size:2.2rem; color:${getStatusColor(globalAvg)}; font-weight:800;">${globalAvg}%</h2>
                <span style="font-size:0.7rem; background:${getStatusColor(globalAvg)}22; color:${getStatusColor(globalAvg)}; padding:2px 8px; border-radius:10px; font-weight:700;">
                    ${globalAvg >= 90 ? 'EXCELENTE' : (globalAvg >= 80 ? 'REGULAR' : 'CRÍTICO')}
                </span>
            </div>
            <div class="glass-panel" style="padding:1.5rem; text-align:center; border-left:4px solid var(--primary);">
                <h4 style="margin:0; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Días Registrados</h4>
                <h2 style="margin:0.5rem 0; font-size:2.2rem; color:#fff; font-weight:800;">${sortedDates.length}</h2>
                <span style="font-size:0.7rem; color:var(--text-muted);">Historial acumulado</span>
            </div>
            <div class="glass-panel" style="padding:1.5rem; text-align:center; border-left:4px solid #fcd34d;">
                <h4 style="margin:0; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Top Operario</h4>
                <h2 style="margin:0.5rem 0; font-size:1.1rem; color:#fff; line-height:1.2; font-weight:700;">${workerRanking[0]?.name || '-'}</h2>
                <span style="font-size:0.8rem; color:#fcd34d; font-weight:800;">⭐ ${workerRanking[0]?.avg || 0}%</span>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
            <div class="glass-panel" style="padding:1.5rem; display:flex; flex-direction:column;">
                <h4 style="margin:0 0 1rem 0; color:#fff; font-size:0.9rem;">📈 Evolución de Rendimiento</h4>
                <div style="height:300px; position:relative; overflow:hidden;">
                    <canvas id="chartEvolution"></canvas>
                </div>
            </div>
            <div class="glass-panel" style="padding:1.5rem; display:flex; flex-direction:column;">
                <h4 style="margin:0 0 1rem 0; color:#fff; font-size:0.9rem;">🏆 Top 5 Operarios</h4>
                <div style="height:300px; position:relative; overflow:hidden;">
                    <canvas id="chartRanking"></canvas>
                </div>
            </div>
        </div>

        <div class="glass-panel animate-fade-in" style="padding:1.5rem; margin-bottom:2rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:1rem;">
                <div>
                    <h4 style="margin:0; color:#fff; font-size:1.1rem; font-weight:800; letter-spacing:0.5px;">📉 ANALÍTICA DE INCIDENCIAS</h4>
                    <span style="font-size:0.75rem; color:#94a3b8; font-style:italic;">* Análisis consolidado de puntualidad y asistencia</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                     <span style="font-size:0.75rem; color:#fff; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Semanas:</span>
                     ${availableWeeks.map(wn => `
                        <button class="week-tag ${selectedWeeks.includes(wn) ? 'active' : ''}" data-wn="${wn}" style="padding:5px 14px; border-radius:14px; font-size:0.75rem; font-weight:900; border:1px solid ${selectedWeeks.includes(wn) ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}; background:${selectedWeeks.includes(wn) ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; color:${selectedWeeks.includes(wn) ? '#fff' : '#cbd5e1'}; cursor:pointer; transition:all 0.2s ease;">
                            SEM ${wn}
                        </button>
                     `).join('')}
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.2rem;">
                <!-- COLUMNA IZQUIERDA: TARDANZAS -->
                <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:1rem; border:2px solid #fb923c; box-shadow: 0 0 15px rgba(251, 146, 60, 0.3), inset 0 0 10px rgba(251, 146, 60, 0.1);">
                    <h5 style="margin:0 0 1rem 0; color:#fb923c; font-size:0.85rem; font-weight:900; display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="font-size:1.1rem;">🚫</span> TARDANZAS - SEM ${selectedWeeks.join(', ')}
                    </h5>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.72rem;">
                            <thead>
                                <tr style="border-bottom:2px solid rgba(251, 146, 60, 0.3); color:#cbd5e1;">
                                    <th style="padding:0.4rem 0.2rem; text-align:center; width:20px;">N°</th>
                                    <th style="padding:0.4rem; text-align:left;">OPERARIO</th>
                                    <th style="padding:0.4rem; text-align:center;">DÍAS</th>
                                    <th style="padding:0.4rem; text-align:center; background:rgba(251, 146, 60, 0.1); color:#fb923c; font-weight:900;">TARD.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tardanzasRanking.length ? tardanzasRanking.map((w, idx) => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                        <td style="padding:0.3rem 0.2rem; text-align:center; color:#94a3b8; font-weight:700;">${idx + 1}</td>
                                        <td style="padding:0.3rem 0.4rem; color:#f8fafc; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${w.name}</td>
                                        <td style="padding:0.3rem; text-align:center; color:#38bdf8; font-weight:700;">${w.diasTrabajados}d</td>
                                        <td style="padding:0.3rem; text-align:center; font-weight:950; color:#fb923c; background:rgba(251, 146, 60, 0.05);">${w.tardanzas}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="padding:2rem; text-align:center; color:#64748b;">Sin incidencias</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- COLUMNA CENTRAL: FALTAS INJUSTIFICADAS -->
                <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:1rem; border:2px solid #f87171; box-shadow: 0 0 15px rgba(248, 113, 113, 0.3), inset 0 0 10px rgba(248, 113, 113, 0.1);">
                    <h5 style="margin:0 0 1rem 0; color:#f87171; font-size:0.85rem; font-weight:900; display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="font-size:1.1rem;">⚠️</span> FALTAS INJUSTIFICADAS - SEM ${selectedWeeks.join(', ')}
                    </h5>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.72rem;">
                            <thead>
                                <tr style="border-bottom:2px solid rgba(248, 113, 113, 0.3); color:#cbd5e1;">
                                    <th style="padding:0.4rem 0.2rem; text-align:center; width:20px;">N°</th>
                                    <th style="padding:0.4rem; text-align:left;">OPERARIO</th>
                                    <th style="padding:0.4rem; text-align:center;">DÍAS</th>
                                    <th style="padding:0.4rem; text-align:center; background:rgba(248, 113, 113, 0.1); color:#f87171; font-weight:900;">FALTAS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${faltasRanking.length ? faltasRanking.map((w, idx) => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                        <td style="padding:0.3rem 0.2rem; text-align:center; color:#94a3b8; font-weight:700;">${idx + 1}</td>
                                        <td style="padding:0.3rem 0.4rem; color:#f8fafc; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${w.name}</td>
                                        <td style="padding:0.3rem; text-align:center; color:#38bdf8; font-weight:700;">${w.diasTrabajados}d</td>
                                        <td style="padding:0.3rem; text-align:center; font-weight:950; color:#f87171; background:rgba(248, 113, 113, 0.05);">${w.faltas}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="padding:2rem; text-align:center; color:#64748b;">Sin faltas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: FALTAS JUSTIFICADAS -->
                <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:1rem; border:2px solid #06b6d4; box-shadow: 0 0 15px rgba(6, 182, 212, 0.3), inset 0 0 10px rgba(6, 182, 212, 0.1);">
                    <h5 style="margin:0 0 1rem 0; color:#06b6d4; font-size:0.85rem; font-weight:900; display:flex; align-items:center; gap:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        <span style="font-size:1.1rem;">✅</span> FALTAS JUSTIFICADAS - SEM ${selectedWeeks.join(', ')}
                    </h5>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.72rem;">
                            <thead>
                                <tr style="border-bottom:2px solid rgba(6, 182, 212, 0.3); color:#cbd5e1;">
                                    <th style="padding:0.4rem 0.2rem; text-align:center; width:20px;">N°</th>
                                    <th style="padding:0.4rem; text-align:left;">OPERARIO</th>
                                    <th style="padding:0.4rem; text-align:center;">DÍAS</th>
                                    <th style="padding:0.4rem; text-align:center; background:rgba(6, 182, 212, 0.1); color:#06b6d4; font-weight:900;">FALTAS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${faltasJustificadasRanking.length ? faltasJustificadasRanking.map((w, idx) => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                        <td style="padding:0.3rem 0.2rem; text-align:center; color:#94a3b8; font-weight:700;">${idx + 1}</td>
                                        <td style="padding:0.3rem 0.4rem; color:#f8fafc; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${w.name}</td>
                                        <td style="padding:0.3rem; text-align:center; color:#38bdf8; font-weight:700;">${w.diasTrabajados}d</td>
                                        <td style="padding:0.3rem; text-align:center; font-weight:950; color:#06b6d4; background:rgba(6, 182, 212, 0.05);">${w.faltasJustificadas}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="padding:2rem; text-align:center; color:#64748b;">Sin faltas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        document.querySelectorAll('.week-tag').forEach(tag => {
            tag.onclick = () => {
                const wn = parseInt(tag.dataset.wn);
                if (window._selectedWeeks.includes(wn)) {
                    // Evitar deseleccionar todo
                    if (window._selectedWeeks.length > 1) {
                        window._selectedWeeks = window._selectedWeeks.filter(w => w !== wn);
                    }
                } else {
                    window._selectedWeeks.push(wn);
                }
                renderKPIGraphsSection(container);
            };
        });

        const ctxEvo = document.getElementById('chartEvolution')?.getContext('2d');
        const ctxRank = document.getElementById('chartRanking')?.getContext('2d');
        if (!ctxEvo || !ctxRank) return;
        if (window.evoChart instanceof Chart) window.evoChart.destroy();
        if (window.rankChart instanceof Chart) window.rankChart.destroy();
        window.evoChart = new Chart(ctxEvo, { type: 'line', data: { labels: evolutionLabels, datasets: [{ label: 'Promedio %', data: evolutionData, borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 3, tension: 0.1, fill: true, pointBackgroundColor: '#fff', pointRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } } });
        window.rankChart = new Chart(ctxRank, { type: 'bar', data: { labels: workerRanking.map(w => w.name.split(' ')[0]), datasets: [{ data: workerRanking.map(w => w.avg), backgroundColor: workerRanking.map(w => getStatusColor(w.avg)), borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, indexAxis: 'y', scales: { x: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#fff', font: { weight: 'bold' } } } }, plugins: { legend: { display: false } } } });
    }, 50);
  };

  const renderKPIReportSection = (container) => {
    let rawLog = adminService.getPerformanceLog();
    if (!Array.isArray(rawLog)) rawLog = [];
    if (!rawLog || rawLog.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);"><h4>Sin datos para el reporte</h4></div>`;
        return;
    }

    const parsePct = (str) => parseFloat(str.replace('%', '')) || 0;
    const getStatusColor = (val) => {
        if (val >= 90) return '#22c55e';
        if (val >= 80) return '#f59e0b';
        return '#ef4444';
    };

    window.exportKPIConsolidado = (data) => {
        const exportData = data.map(d => ({ 
            'Periodo': `${kpiStart} al ${kpiEnd}`,
            'Operario': d.name, 
            'Días Trabajados': d.diasTrabajados, 
            'Justificaciones': d.justificaciones, 
            'Faltas': d.faltas, 
            'Tardanzas': d.tardanzas, 
            'Promedio Rendimiento %': d.avg + '%' 
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consolidado_KPI");
        XLSX.writeFile(wb, `Consolidado_KPI_${kpiStart}_a_${kpiEnd}.xlsx`);
    };

    const filtered = rawLog.filter(e => e.date >= kpiStart && e.date <= kpiEnd);
    const workerMap = {};
    filtered.forEach(entry => {
        const key = (entry.dni || '').toString().trim();
        if (!workerMap[key]) {
            const worker = adminService.getWorkers().find(w => (w.dni || w.Dni || '').toString().trim() === key);
            const currentName = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${entry.apellidos}, ${entry.nombre}`;
            workerMap[key] = { name: currentName, sum: 0, count: 0, diasTrabajados: 0, justificaciones: 0, faltas: 0, tardanzas: 0 };
        }
        const w = workerMap[key];
        const rend = parsePct(entry.rendimiento);
        if (entry.asistencia === 'P') {
            w.diasTrabajados++; w.sum += rend; w.count++;
            if (entry.puntualidad === 'NO') w.tardanzas++;
        } else {
            const hasJustification = entry.justification && 
                                   entry.justification.trim() !== '' && 
                                   entry.justification.toUpperCase() !== 'NO';
            
            if (hasJustification) {
                w.justificaciones++;
                // Los días con justificación NO se cuentan en el promedio (se divide entre menos días)
            } else {
                w.faltas++; 
                w.sum += rend; 
                w.count++; 
                // Sin justificación: se suma rindi (0%) y aumenta el divisor (penaliza el promedio)
            }
        }
    });

    const consolidado = Object.values(workerMap).map(w => ({ ...w, avg: w.count > 0 ? Math.round(w.sum / w.count) : 0 }))
        .filter(w => w.name.toLowerCase().includes(kpiSearch.toLowerCase())).sort((a,b) => b.avg - a.avg);

    container.innerHTML = `
        <div class="glass-panel" style="padding:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1.5rem; flex-wrap:wrap;">
                <h4 style="margin:0; color:var(--primary); font-size:1rem; font-weight:800;">📊 CONSOLIDADO KPI</h4>
                <div style="display:flex; gap:0.8rem; align-items:center; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:4px 10px; border-radius:8px;">
                         <span style="font-size:0.7rem; color:var(--text-muted);">DESDE:</span>
                         <input type="date" id="kpi_start" value="${kpiStart}" style="background:none; border:none; color:#fff; font-size:0.75rem; outline:none;">
                         <span style="font-size:0.7rem; color:var(--text-muted);">HASTA:</span>
                         <input type="date" id="kpi_end" value="${kpiEnd}" style="background:none; border:none; color:#fff; font-size:0.75rem; outline:none;">
                    </div>
                    <input type="text" id="kpi_search" placeholder="🔍 Buscar operario..." value="${kpiSearch}" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); color:#fff; padding:6px 12px; border-radius:8px; font-size:0.8rem; outline:none; width:200px;">
                    <button onclick='exportKPIConsolidado(${JSON.stringify(consolidado).replace(/'/g, "&apos;")})' class="btn" style="width:auto; font-size:0.75rem; padding:0.5rem 1rem; background:#10b981; border-radius:8px;">📥 EXPORTAR</button>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead><tr style="border-bottom:2px solid rgba(255,255,255,0.05); color:var(--text-muted);"><th style="padding:0.8rem; text-align:left;">OPERARIO</th><th style="padding:0.8rem; text-align:center;">DÍAS TRAB.</th><th style="padding:0.8rem; text-align:center;">JUSTIFICACIÓN</th><th style="padding:0.8rem; text-align:center;">FALTAS</th><th style="padding:0.8rem; text-align:center;">TARDANZAS</th><th style="padding:0.8rem; text-align:center;">PROM. RENDIMIENTO</th></tr></thead>
                    <tbody>${consolidado.map(w => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);"><td style="padding:0.8rem; color:#fff; font-weight:600;">${w.name}</td><td style="padding:0.8rem; text-align:center; font-weight:700; color:#60a5fa;">${w.diasTrabajados}</td><td style="padding:0.8rem; text-align:center; color:#fcd34d;">${w.justificaciones}</td><td style="padding:0.8rem; text-align:center; color:${w.faltas > 0 ? '#ef4444' : 'var(--text-muted)'};">${w.faltas}</td><td style="padding:0.8rem; text-align:center; color:${w.tardanzas > 0 ? '#f97316' : 'var(--text-muted)'};">${w.tardanzas}</td><td style="padding:0.8rem; text-align:center;"><div style="display:inline-block; padding:4px 12px; border-radius:12px; background:${getStatusColor(w.avg)}22; color:${getStatusColor(w.avg)}; font-weight:900;">${w.avg}%</div></td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;

    setTimeout(() => {
        const iStart = document.getElementById('kpi_start');
        const iEnd = document.getElementById('kpi_end');
        const iSearch = document.getElementById('kpi_search');
        if (kpiSearch && iSearch) { iSearch.focus(); iSearch.selectionStart = iSearch.selectionEnd = iSearch.value.length; }
        if (iStart) iStart.onchange = (e) => { kpiStart = e.target.value; renderKPIReportSection(container); };
        if (iEnd) iEnd.onchange = (e) => { kpiEnd = e.target.value; renderKPIReportSection(container); };
        if (iSearch) iSearch.oninput = (e) => { kpiSearch = e.target.value; renderKPIReportSection(container); };
    }, 50);
  };

  let activePerfSub = 'historial';
  const renderPerformanceSection = (container) => {
    const perfTabDef = TABS.find(t => t.id === 'admin_pers').subTabs.find(s => s.id === 'performance');
    const perms = adminService.getPermissions(user.role) || {};
    
    // Triple anidamiento: Administración -> Performance -> (Historial/Graficos/Reporte)
    const allowedSubSubs = perfTabDef.subTabs.filter(ss => {
        if (user.role === 'admin') return true;
        return perms[`performance_${ss.id}`] === 1 || perms['performance'] === 1; // Fallback a permiso general
    });

    if (!allowedSubSubs.find(s => s.id === activePerfSub)) {
        activePerfSub = allowedSubSubs[0]?.id || '';
    }

    container.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05);">
          ${allowedSubSubs.map(ss => `
            <a class="perf-sub-item ${activePerfSub===ss.id?'active':''}" data-ss="${ss.id}" style="padding: 0.5rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${activePerfSub===ss.id?'var(--primary)':'var(--text-muted)'}; font-weight:${activePerfSub===ss.id?'800':'500'}; text-decoration:none; border-bottom:${activePerfSub===ss.id?'2px solid var(--primary)':'none'};">
                ${ss.icon} ${ss.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="perfContent"></div>`;

    document.querySelectorAll('.perf-sub-item').forEach(b => b.addEventListener('click', (e) => { 
        activePerfSub = e.currentTarget.dataset.ss; 
        renderPerformanceSection(container); 
    }));

    const perfContent = document.getElementById('perfContent');
    if (activePerfSub === 'historial') renderPerformanceHistory(perfContent);
    else if (activePerfSub === 'graficos') renderKPIGraphsSection(perfContent);
    else if (activePerfSub === 'reporte') renderKPIReportSection(perfContent);
  };

  const renderPerformanceHistory = (container) => {
    let log = adminService.getPerformanceLog();
    if (!Array.isArray(log)) {
        console.warn("[PULSE] Performance log was not an array, fixing...");
        log = [];
    }
    
    // Función para exportar a Excel
    window.exportPerformanceToExcel = () => {
        if (!log.length) return alert('No hay datos para exportar.');
        try {
            const dataToExport = log.map(p => {
                const worker = adminService.getWorkers().find(w => (w.dni || w.Dni) === p.dni);
                const nombreCompleto = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${p.apellidos}, ${p.nombre}`;
                return {
                    'Fecha': p.date,
                    'DNI': p.dni,
                    'Nombre Completo': nombreCompleto,
                    'Asistencia': p.asistencia,
                    'Puntualidad': p.puntualidad,
                    'Producción (1-10)': p.produccion,
                    'BPA (1-10)': p.bpa,
                    'Supervisor (1-10)': p.supervisor,
                    'Justificación': (p.justification && p.justification !== '') ? 'SI' : 'NO',
                    'Rendimiento %': p.rendimiento
                };
            });

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Performance_Log");
            XLSX.writeFile(wb, `Reporte_Performance_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (e) { alert("Error al generar el archivo Excel."); }
    };

    // Lógica de agrupamiento y Promedio
    const grouped = log.reduce((acc, p) => {
        if (!acc[p.date]) acc[p.date] = [];
        acc[p.date].push(p);
        return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a)); // Recientes primero

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3 style="color:var(--primary); margin:0;">Historial de Performance Diaria</h3>
            <button onclick="exportPerformanceToExcel()" class="btn" style="width:auto; background:#10b981; padding:0.6rem 1.2rem; font-size:0.8rem; font-weight:800; border-radius:8px; display:flex; align-items:center; gap:8px;">
                <span>📊</span> EXPORTAR A EXCEL
            </button>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                    <tr>
                        <th style="padding:0.8rem; text-align:center; width:45px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                        <th style="padding:0.8rem; text-align:left;">TRABAJADOR / DNI</th>
                        <th style="padding:0.8rem; text-align:center;">ASISTENCIA</th>
                        <th style="padding:0.8rem; text-align:center;">PUNTUALIDAD</th>
                        <th style="padding:0.8rem; text-align:center;">PRODUCCIÓN</th>
                        <th style="padding:0.8rem; text-align:center;">BPA</th>
                        <th style="padding:0.8rem; text-align:center;">SUPERVISOR</th>
                        <th style="padding:0.8rem; text-align:center;">JUSTIFICACIÓN</th>
                        <th style="padding:0.8rem; text-align:center; background:rgba(79,70,229,0.1);">RENDIMIENTO %</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedDates.length ? sortedDates.map(date => {
                        const entries = grouped[date];
                        const avgRend = Math.round(entries.reduce((sum, e) => sum + (parseInt(e.rendimiento) || 0), 0) / entries.length);
                        return `
                        <!-- CABECERA DE FECHA -->
                        <tr class="perf-date-header" data-date="${date}" style="cursor:pointer; background:rgba(79,70,229,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td colspan="8" style="padding:0.8rem; text-align:left; color:#fff; font-weight:800;">
                                <span style="margin-right:10px; color:var(--primary); font-size:1rem;">📅</span> 
                                <span style="color:#60a5fa;">${date}</span> 
                                <small style="margin-left:15px; color:rgba(255,255,255,0.3); font-weight:400;">(${entries.length} registros)</small>
                            </td>
                            <td style="padding:0.8rem; text-align:center; background:rgba(79,70,229,0.1); color:var(--primary); font-weight:900;">
                                <span style="font-size:0.65rem; color:var(--text-muted);">Prom:</span> <span id="avg-${date}">${avgRend}%</span>
                            </td>
                        </tr>
                        <!-- FILAS DE TRABAJADORES -->
                        ${entries.map((p, idx) => {
                            // Búsqueda robusta por DNI (sin espacios y como string)
                            const worker = adminService.getWorkers().find(w => {
                                const wDni = (w.dni || w.Dni || '').toString().trim();
                                const pDni = (p.dni || '').toString().trim();
                                return wDni === pDni;
                            });
                            const displayName = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${p.apellidos}, ${p.nombre}`;
                            return `
                        <tr class="perf-row-${date}" style="display:none; border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                            <td style="padding:0.8rem;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <b style="color:#fff;">${displayName}</b>
                                    <span style="font-size:0.75rem; color:rgba(255,255,255,0.4); font-weight:700; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${p.dni}</span>
                                </div>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select class="edit-perf-log" data-date="${p.date}" data-dni="${p.dni}" data-f="asistencia" style="background:none; border:none; color:${p.asistencia==='P'?'var(--success)':'#ef4444'}; font-weight:900; outline:none; cursor:pointer;">
                                    <option value="P" ${p.asistencia==='P'?'selected':''}>P</option>
                                    <option value="F" ${p.asistencia==='F'?'selected':''}>F</option>
                                </select>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select class="edit-perf-log" data-date="${p.date}" data-dni="${p.dni}" data-f="puntualidad" style="background:none; border:none; color:${p.puntualidad==='SÍ'?'var(--success)':'#ef4444'}; font-weight:700; outline:none; cursor:pointer;">
                                    <option value="SÍ" ${p.puntualidad==='SÍ'?'selected':''}>SÍ</option>
                                    <option value="NO" ${p.puntualidad==='NO'?'selected':''}>NO</option>
                                </select>
                            </td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                <input type="number" min="0" max="10" value="${p.produccion || 0}" data-date="${p.date}" data-dni="${p.dni}" data-f="produccion" class="edit-perf-log" style="width:50px; background:none; border:none; color:#fff; text-align:center; outline:none;">
                            </td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                <input type="number" min="0" max="10" value="${p.bpa || 0}" data-date="${p.date}" data-dni="${p.dni}" data-f="bpa" class="edit-perf-log" style="width:50px; background:none; border:none; color:#fff; text-align:center; outline:none;">
                            </td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                <input type="number" min="0" max="10" value="${p.supervisor !== undefined ? p.supervisor : 0}" data-date="${p.date}" data-dni="${p.dni}" data-f="supervisor" class="edit-perf-log" style="width:50px; background:none; border:none; color:#fff; text-align:center; outline:none;">
                            </td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                <input type="text" id="just-${p.dni}-${p.date}" value="${p.justification || ''}" placeholder="NO" data-date="${p.date}" data-dni="${p.dni}" data-f="justification" class="edit-perf-log" style="width:100%; background:none; border:none; color:${p.justification ? '#fcd34d' : 'rgba(255,255,255,0.2)'}; text-align:center; outline:none; font-weight:800; font-size:0.75rem;">
                            </td>
                            <td style="padding:0.8rem; text-align:center; border:1px solid rgba(79,70,229,0.2); background:rgba(79,70,229,0.05); font-weight:900; color:#fcd34d;" id="rend-${p.dni}-${p.date}">
                                ${p.rendimiento}
                            </td>
                        </tr>`; }).join('')}
                        `;
                    }).join('') : '<tr><td colspan="9" style="padding:3rem; text-align:center; color:var(--text-muted);">No hay registros en el historial. Cierra la asistencia del día para generar datos.</td></tr>'}
                </tbody>
            </table>
        </div>
        <p style="font-size:0.7rem; color:var(--text-muted); margin-top:0.8rem;">* Haz clic en una fecha para expandir/contraer. Los campos de producción, BPA y supervisor (escala 1-10) actualizan el % de rendimiento automáticamente.</p>
    `;

    // Event listeners para Colapsar/Expandir
    document.querySelectorAll('.perf-date-header').forEach(header => {
        header.onclick = () => {
            const date = header.dataset.date;
            const rows = document.querySelectorAll(`.perf-row-${date}`);
            const isHidden = rows[0].style.display === 'none';
            rows.forEach(r => r.style.display = isHidden ? 'table-row' : 'none');
        };
    });

    // Mejorar edición y navegación (Keyboard Friendly)
    document.querySelectorAll('.edit-perf-log').forEach((input, index, all) => {
        // Auto-selección al enfocar
        input.onfocus = () => { if(input.select) input.select(); };

        // Navegación por flechas o TAB
        input.onkeydown = (e) => {
            const rowsInTable = Array.from(document.querySelectorAll('.edit-perf-log'));
            const currentIndex = rowsInTable.indexOf(e.target);
            const colsPerRow = 6; // select(att), select(pun), produccion, bpa, supervisor, justificacion

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = rowsInTable[currentIndex + colsPerRow];
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = rowsInTable[currentIndex - colsPerRow];
                if (prev) prev.focus();
            } else if (e.key === 'ArrowRight' && (e.target.type !== 'number' || e.target.selectionEnd === e.target.value.length)) {
                // Navegar derecha si no es número o si el cursor está al final
                const next = rowsInTable[currentIndex + 1];
                if (next) next.focus();
            } else if (e.key === 'ArrowLeft' && (e.target.type !== 'number' || e.target.selectionStart === 0)) {
                const prev = rowsInTable[currentIndex - 1];
                if (prev) prev.focus();
            }
        };

        // Cambio y cálculo instantáneo (Sin re-render total para no perder foco)
        input.onchange = (e) => {
            const { date, dni, f: field } = e.target.dataset;
            let val = e.target.value;

            if (field === 'produccion' || field === 'bpa' || field === 'supervisor') {
                val = parseFloat(val) || 0;
                if (val > 10) val = 10;
                if (val < 0) val = 0;
                e.target.value = val;
            }

            // Actualizar datos en memoria
            adminService.updatePerformanceLogEntry(date, dni, { [field]: val });

            // Recalcular rendimiento de la FILA localmente para la UI
            const entry = adminService.getPerformanceLog().find(p => p.dni === dni && p.date === date);
            if (entry) {
                const cellRend = document.getElementById(`rend-${dni}-${date}`);
                if (cellRend) cellRend.textContent = entry.rendimiento;
                
                // Actualizar color si es select
                if (field === 'asistencia') e.target.style.color = val === 'P' ? 'var(--success)' : '#ef4444';
                if (field === 'puntualidad') e.target.style.color = val === 'SÍ' ? 'var(--success)' : '#ef4444';
                
                // Actualizar indicador de Justificación
                const cellJust = document.getElementById(`just-${dni}-${date}`);
                if (cellJust) {
                    const hasJ = (entry.justification && entry.justification !== '');
                    if (cellJust.tagName === 'INPUT') {
                        cellJust.style.color = hasJ ? '#fcd34d' : 'rgba(255,255,255,0.2)';
                    } else {
                        cellJust.textContent = hasJ ? 'SI' : 'NO';
                        cellJust.style.color = hasJ ? '#fcd34d' : 'rgba(255,255,255,0.2)';
                    }
                }

                // Recalcular PROMEDIO DE LA FECHA en la cabecera
                const allForDate = adminService.getPerformanceLog().filter(p => p.date === date);
                const sum = allForDate.reduce((acc, curr) => acc + parseInt(curr.rendimiento || 0), 0);
                const avgText = Math.round(sum / allForDate.length) + '%';
                const cellAvg = document.getElementById(`avg-${date}`);
                if (cellAvg) cellAvg.textContent = avgText;
            }
        };
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
                 <p style="margin:0; font-size:0.75rem; opacity:0.8;">Versión v12.4.36 | © 2026 Pulse Logística</p>
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
          if (currentTab === 'admin_pers' && activeAdminSub === 'asistencia') return;

          const isIdle = !document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA');
          
          if (document.visibilityState === 'visible' && isIdle) {
              console.log("🔄 [PULSE] Sincronización automática de datos...");
              await adminService.initializeAdminData();
              if (currentTab === 'inicio') renderTabContent(true); 
          }
      }, 20000); 
  };



  let activeInventarioSub = localStorage.getItem('activeSub_inventario') || 'archivo_inventario';
  let activeModuloInvSub = 'general'; // Nivel 3

  const renderInventarioTab = async () => {
    const invTabDef = TABS.find(t => t.id === 'inventario');
    const allowedSubTabs = invTabDef.subTabs;
    
    if (!allowedSubTabs.find(s => s.id === activeInventarioSub)) {
        activeInventarioSub = allowedSubTabs[0].id;
    }

    contentArea.innerHTML = `
        <nav class="sub-nav" style="display:flex; gap:1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem; overflow-x:auto;">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeInventarioSub===sub.id?'active':''}" data-id="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; white-space:nowrap; cursor:pointer;">
              ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="inventarioLevel2Content"></div>`;
    
    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeInventarioSub = e.currentTarget.dataset.id; 
        localStorage.setItem('activeSub_inventario', activeInventarioSub);
        renderInventarioTab(); 
    }));

    const l2Container = document.getElementById('inventarioLevel2Content');
    
    if (activeInventarioSub === 'archivo_inventario') {
       const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '1rem'; l2Container.appendChild(wrap);
       const [matriz, reserva, stock] = await Promise.all([
           getAreaData('matriz_ubicaciones'),
           getAreaData('stockReserva'),
           getAreaData('inventario')
       ]);
       renderUploadArea(wrap, 'matriz_ubicaciones', matriz, '.xlsx', 'MATRIZ UBICACIONES (Col A)');
       renderUploadArea(wrap, 'stockReserva', reserva, '.xlsx', 'STOCK RESERVA (Col E, Col I)');
       renderUploadArea(wrap, 'inventario', stock, '.csv', 'STOCK GENERAL');

    } else if (activeInventarioSub === 'kpi_inventarios') {
       l2Container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">📊 KPI Inventarios en desarrollo.</div>`;
    } else if (activeInventarioSub === 'analisis_inventarios') {
       l2Container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">🔍 Análisis Inventario en desarrollo.</div>`;
    } else if (activeInventarioSub === 'modulo_inventarios') {
       renderModuloInventarios(l2Container);
    }
  };

  const renderModuloInventarios = async (container) => {
    const l3Tabs = [
        { id: 'general', label: 'General', icon: '📝' },
        { id: 'ciclicos', label: 'Cíclicos', icon: '🔄' },
        { id: 'reportes', label: 'Reportes', icon: '📊' }
    ];

    container.innerHTML = `
        <div style="background:rgba(15,23,42,0.3); border-radius:12px; padding:1rem; border:1px solid rgba(255,255,255,0.05);">
            <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05);">
                ${l3Tabs.map(t => `
                    <a class="l3-nav-item ${activeModuloInvSub===t.id?'active':''}" data-id="${t.id}" style="padding: 0.5rem 0.2rem; font-size: 0.75rem; cursor:pointer; color:${activeModuloInvSub===t.id?'#818cf8':'var(--text-muted)'}; font-weight:${activeModuloInvSub===t.id?'800':'400'}; border-bottom:${activeModuloInvSub===t.id?'2px solid #818cf8':'none'};">
                        ${t.icon} ${t.label.toUpperCase()}
                    </a>
                `).join('')}
            </nav>
            <div id="moduloInvContent"></div>
        </div>
    `;

    document.querySelectorAll('.l3-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeModuloInvSub = e.currentTarget.dataset.id; 
        renderModuloInventarios(container); 
    }));

    const content = document.getElementById('moduloInvContent');
    const [matriz, reserva, stock, articulos] = await Promise.all([
        getAreaData('matriz_ubicaciones'),
        getAreaData('stockReserva'),
        getAreaData('inventario'),
        getAreaData('articulos')
    ]);

    if (activeModuloInvSub === 'general') {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; content.appendChild(wrap);
        renderUploadArea(wrap, 'articulos', articulos, '.xlsx', 'MAESTRO ARTÍCULOS');
        // Agregamos info visual de que se nutre de Archivo Inventario
        wrap.innerHTML += `<div style="margin-top:1rem; padding:0.8rem; background:rgba(129, 140, 248, 0.05); border-radius:8px; border:1px dashed rgba(129, 140, 248, 0.2); font-size:0.7rem; color:#818cf8; text-align:center;">ℹ️ Este módulo utiliza automáticamente la Matriz y Stock cargados en 'ARCHIVO INVENTARIO'.</div>`;
    } 
    else if (activeModuloInvSub === 'ciclicos') {
        content.innerHTML = `
            <div style="max-width:500px; margin:0 auto;" id="ciclico_upload_area"></div>
        `;
        renderUploadArea(document.getElementById('ciclico_upload_area'), 'conteo_ciclico', null, '.csv, .xlsx', 'CARGAR CONTEO FÍSICO');
        
        const input = document.getElementById('up_conteo_ciclico');
        if (input) {
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const data = await parseFile(file, 'inventario_eri');
                    if (data && data.length > 0) {
                        await processERIAnalysis(data);
                        activeModuloInvSub = 'reportes';
                        renderModuloInventarios(container);
                    }
                } catch(err) { alert(err); }
            };
        }
    }
    else if (activeModuloInvSub === 'reportes') {
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2.5rem;">
                
                <!-- SECTION 1: REPORTE UCA (TOP - FULL WIDTH) -->
                <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(99, 102, 241, 0.2); background:rgba(15, 23, 42, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="color:#fff; margin:0; font-size:1rem; font-weight:900; letter-spacing:1px;">📊 REPORTE UCA (DISPONIBILIDAD)</h3>
                        <button id="btn_run_uca" class="btn-premium-pulse" style="width:auto; padding:8px 20px; font-size:0.75rem; background:linear-gradient(135deg, #4f46e5, #7c3aed); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(79, 70, 229, 0.3);">⚡ GENERAR UCA</button>
                    </div>
                    <div id="uca_results_area"></div>
                </div>

                <!-- SECTION 2: INDICADORES DE EXACTITUD (BOTTOM - SPLIT) -->
                <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(16, 185, 129, 0.2); background:rgba(15, 23, 42, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                        <h3 style="color:#fff; margin:0; font-size:1rem; font-weight:900; letter-spacing:1px;">🎯 INDICADORES DE EXACTITUD (AUDITORÍA)</h3>
                        <div style="display:flex; gap:10px;">
                            <input type="file" id="up_conteo_unificado" accept=".csv, .xlsx" style="display:none;">
                            <button onclick="document.getElementById('up_conteo_unificado').click()" class="btn-premium-pulse" style="width:auto; padding:8px 20px; font-size:0.75rem; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);">📉 PROCESAR ERI / ERU</button>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                        <!-- ERU (IZQUIERDA) -->
                        <div id="eru_results_area_unif">
                            <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.75rem; font-style:italic; background:rgba(255,255,255,0.02); border-radius:10px; border:1px dashed rgba(255,255,255,0.05);">Esperando Auditoría ERU...</div>
                        </div>

                        <!-- ERI (DERECHA) -->
                        <div id="eri_results_area_unif">
                            <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.75rem; font-style:italic; background:rgba(255,255,255,0.02); border-radius:10px; border:1px dashed rgba(255,255,255,0.05);">Esperando Auditoría ERI...</div>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Lógica UCA
        document.getElementById('btn_run_uca').onclick = () => {
            if (matriz && reserva) {
                const res = processReporteUCA(matriz, reserva);
                displayReporteUCA(res);
            } else {
                alert("⚠️ Datos insuficientes en 'ARCHIVO INVENTARIO' para UCA.");
            }
        };

        // Lógica ERI/ERU
        const inputUnif = document.getElementById('up_conteo_unificado');
        if (inputUnif) {
            inputUnif.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const btn = document.querySelector('button[onclick*="up_conteo_unificado"]');
                const originalHTML = btn ? btn.innerHTML : '';
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                }

                try {
                    const data = await parseFile(file, 'inventario_eri');
                    if (data && data.length > 0) {
                        await processERIAnalysis(data);
                        renderERI_ERU_Unified();
                    }
                } catch(err) { 
                    alert("Error al procesar el archivo: " + err); 
                } finally {
                    if (btn) {
                        btn.innerHTML = originalHTML;
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    }
                    inputUnif.value = ''; // Limpiar para permitir re-subir el mismo archivo
                }
            };
        }

        // Función interna para renderizar ERI/ERU uno al lado del otro
        const renderERI_ERU_Unified = () => {
            if (!window._lastERI) return;
            const eriArea = document.getElementById('eri_results_area_unif');
            const eruArea = document.getElementById('eru_results_area_unif');
            
            // Bloque ERU (IZQUIERDA)
            eruArea.innerHTML = `
                <div class="glass-panel" style="padding:1.2rem; border:1px solid rgba(16, 185, 129, 0.3); background:radial-gradient(circle at top right, rgba(16, 185, 129, 0.05), transparent);">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:1.2rem;">
                        <div style="position:relative; width:65px; height:65px;">
                            <svg viewBox="0 0 36 36" style="transform: rotate(-90deg); width:65px; height:65px;">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
                                <path id="eru_circle_unif" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="3" stroke-dasharray="0, 100" />
                            </svg>
                            <div id="eru_val_unif" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:0.85rem; font-weight:900; color:#fff;">0%</div>
                        </div>
                        <div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:1px;">
                                EXACTITUD <span id="eru_timestamp" style="margin-left:10px; color:rgba(255,255,255,0.3); font-weight:400;"></span>
                            </div>
                            <div style="font-size:0.9rem; font-weight:900; color:#10b981;">DE REGISTRO DE UBICACIÓN (ERU)</div>
                        </div>
                    </div>
                    <div class="data-table-container" style="max-height:280px; overflow-y:auto; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                        <table class="data-table" style="font-size:0.75rem;">
                            <thead id="eru_head_unif" style="position:sticky; top:0; z-index:10; background:#1a1d21;"></thead>
                            <tbody id="eru_body_unif"></tbody>
                        </table>
                    </div>
                </div>
            `;

            // Bloque ERI (DERECHA)
            eriArea.innerHTML = `
                <div class="glass-panel" style="padding:1.2rem; border:1px solid rgba(129, 140, 248, 0.3); background:radial-gradient(circle at top right, rgba(129, 140, 248, 0.05), transparent);">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:1.2rem;">
                        <div style="position:relative; width:65px; height:65px;">
                            <svg viewBox="0 0 36 36" style="transform: rotate(-90deg); width:65px; height:65px;">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
                                <path id="eri_circle_unif" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#818cf8" stroke-width="3" stroke-dasharray="0, 100" />
                            </svg>
                            <div id="eri_val_unif" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:0.85rem; font-weight:900; color:#fff;">0%</div>
                        </div>
                        <div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:1px;">
                                EXACTITUD <span id="eri_timestamp" style="margin-left:10px; color:rgba(255,255,255,0.3); font-weight:400;"></span>
                            </div>
                            <div style="font-size:0.9rem; font-weight:900; color:#818cf8;">DE REGISTRO DE INVENTARIO (ERI)</div>
                        </div>
                    </div>
                    <div class="data-table-container" style="max-height:280px; overflow-y:auto; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                        <table class="data-table" style="font-size:0.75rem;">
                            <thead id="eri_head_unif" style="position:sticky; top:0; z-index:10; background:#1a1d21;"></thead>
                            <tbody id="eri_body_unif"></tbody>
                        </table>
                    </div>
                </div>
            `;
            
            // Inyectamos los datos reales usando la lógica existente
            updateERIUI_Unified();
        };

        // Exportamos la función de refresco al ámbito global/superior temporalmente
        window.renderERI_ERU_Unified_Global = () => renderERI_ERU_Unified();

        if (window._lastERI) renderERI_ERU_Unified();
    }
  };

  const updateERIUI_Unified = () => {
    const data = window._lastERI;
    if (!data) return;

    // Actualizar ERI (SKUs)
    const eriVal = document.getElementById('eri_val_unif');
    const eriCircle = document.getElementById('eri_circle_unif');
    const eriHead = document.getElementById('eri_head_unif');
    const eriBody = document.getElementById('eri_body_unif');
    
    if (eriVal) eriVal.innerText = `${data.finalERI}%`;
    if (eriCircle) eriCircle.setAttribute('stroke-dasharray', `${data.finalERI}, 100`);
    if (eriHead) eriHead.innerHTML = `<tr><th style="padding:10px;">SKU</th><th>UBICACIÓN</th><th style="text-align:center;">SISTEMA</th><th style="text-align:center;">FÍSICO</th><th style="text-align:center;">DIF</th><th style="text-align:center;">CUMPLIMIENTO (%)</th></tr>`;
    
    if (eriBody && Array.isArray(data.eriResults)) {
        // Filtrar encabezados residuales
        const cleanERI = data.eriResults.filter(r => r.sku && !r.sku.toString().toUpperCase().includes('SKU'));
        eriBody.innerHTML = cleanERI.map(r => `
            <tr>
                <td style="font-weight:700; color:#818cf8; padding:8px;">${r.sku}</td>
                <td style="font-size:0.65rem; color:rgba(255,255,255,0.6);">${r.ubi}</td>
                <td style="text-align:center; opacity:0.8;">${r.sis}</td>
                <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                <td style="text-align:center; color:${r.diff===0?'#10b981':'#ef4444'}; font-weight:900;">${r.diff > 0 ? '+' : ''}${r.diff}</td>
                <td style="text-align:center;">
                    <span style="background:rgba(129,140,248,0.1); color:#818cf8; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.65rem;">${r.eri}%</span>
                </td>
            </tr>
        `).join('');
    }

    // Actualizar ERU (Ubicaciones)
    const eruVal = document.getElementById('eru_val_unif');
    const eruCircle = document.getElementById('eru_circle_unif');
    const eruHead = document.getElementById('eru_head_unif');
    const eruBody = document.getElementById('eru_body_unif');
    const eruTime = document.getElementById('eru_timestamp');
    const eriTime = document.getElementById('eri_timestamp');
    
    const now = new Date().toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    if (eruTime) eruTime.innerText = now;
    if (eriTime) eriTime.innerText = now;

    if (eruVal) eruVal.innerText = `${data.finalERU}%`;
    if (eruCircle) eruCircle.setAttribute('stroke-dasharray', `${data.finalERU}, 100`);
    if (eruHead) eruHead.innerHTML = `<tr><th style="padding:10px;">UBICACIÓN</th><th>SKU</th><th style="text-align:center;">SISTEMA</th><th style="text-align:center;">FÍSICO</th><th style="text-align:center;">DIF</th><th style="text-align:center;">CUMPLIMIENTO (%)</th></tr>`;
    
    if (eruBody && Array.isArray(data.eruResults)) {
        // Filtrar encabezados residuales
        const cleanERU = data.eruResults.filter(r => r.ubi && !r.ubi.toString().toUpperCase().includes('UBICAC'));
        eruBody.innerHTML = cleanERU.map(r => `
            <tr>
                <td style="font-weight:600; color:#10b981; padding:8px;">${r.ubi}</td>
                <td style="font-size:0.65rem; color:rgba(255,255,255,0.6);">${r.sku}</td>
                <td style="text-align:center; opacity:0.8;">${r.sis}</td>
                <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                <td style="text-align:center; color:${r.diff===0?'#10b981':'#ef4444'}; font-weight:900;">${r.diff > 0 ? '+' : ''}${r.diff}</td>
                <td style="text-align:center;">
                    <span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.65rem;">${r.eri}%</span>
                </td>
            </tr>
        `).join('');
    }
  };

  const renderERIERULayout = (container) => {
      // Función obsoleta - Eliminada para evitar duplicados en el dashboard unificado
      console.log("[PULSE] renderERIERULayout llamado pero desactivado por v18.5.20");
  };

  const processReporteUCA = (matriz, reserva) => {
    const reservaMap = new Map();
    // Solo procesar registros de nivel ALTO (usando el flag pre-calculado)
    const filteredReserva = reserva.filter(r => r.ES_ALTO === true || String(r.NIVEL || '').toUpperCase().includes('ALTO'));
    
    filteredReserva.forEach(r => {
      const ubiRaw = String(r.UBICACION || '').toUpperCase();
      if (ubiRaw.includes('UBICAC')) return; // Failsafe para Stock Reserva

      const key = r.UBI_KEY || ubiRaw.replace(/[^A-Z0-9]/g, '');
      if (!key) return;
      if (!reservaMap.has(key)) reservaMap.set(key, []);
      reservaMap.get(key).push(r);
    });

    const results = [];
    matriz.forEach(m => {
      const ubiOriginal = m.UBICACION || '-';
      const ubiUpper = ubiOriginal.toUpperCase();
      
      // FILTRO DEFINITIVO: Si la ubicación es el encabezado, ignorar
      if (ubiUpper.includes('UBICAC') || ubiUpper.includes('MATRIZ')) return;

      const key = m.UBI_KEY || ubiUpper.replace(/[^A-Z0-9]/g, '');
      if (!key) return;

      const stockRes = reservaMap.get(key);
      const hasStock = stockRes && stockRes.length > 0;
      
      const uniqueLPNs = hasStock ? [...new Set(stockRes.map(s => String(s.LPN || '').trim()))].filter(l => l !== '') : [];
      const uniqueSKUs = hasStock ? [...new Set(stockRes.map(s => String(s.PRODUCTO || s.SKU || s.Sku || '').trim()))].filter(sk => sk !== '') : [];
      const totalQty = hasStock ? stockRes.reduce((acc, curr) => acc + (parseFloat(curr.CANTIDAD || 0)), 0) : 0;

      results.push({
        ubicacion: ubiOriginal,
        estado: hasStock ? 'OCUPADA' : 'VACÍA',
        lpns: uniqueLPNs.length,
        skus: uniqueSKUs.length,
        qty: totalQty,
        detalle: uniqueLPNs.length > 0 ? uniqueLPNs.join(', ') : '-'
      });
    });

    return results;
  };

  const exportUCAtoExcel = async (results) => {
    if (!results || results.length === 0) return;
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte UCA');
        
        sheet.columns = [
          { header: 'N°', key: 'num', width: 6 },
          { header: 'UBICACIÓN', key: 'ubicacion', width: 20 },
          { header: 'ESTADO EN SISTEMA', key: 'estado', width: 20 },
          { header: 'LPNs (ÚNICOS)', key: 'lpns', width: 18 },
          { header: 'DETALLE LPNs', key: 'detalle', width: 50 },
          { header: 'OBSERVACIONES', key: 'obs', width: 20 },
          { header: 'CHECK', key: 'check', width: 10 }
        ];

        results.forEach((r, idx) => {
            sheet.addRow({
                num: idx + 1,
                ubicacion: r.ubicacion,
                estado: r.estado,
                lpns: r.lpns,
                detalle: r.detalle,
                obs: '',
                check: '☐'
            });
        });

        // Estilo de encabezado (Azul PREMIUM)
        sheet.getRow(1).height = 25;
        sheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF4F46E5'} };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        // Estilo de celdas
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.height = 20;
                row.eachCell((cell, colNumber) => {
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    const isCenter = [1, 3, 4, 7].includes(colNumber);
                    cell.alignment = { vertical: 'middle', horizontal: isCenter ? 'center' : 'left' };
                    if (colNumber === 3) {
                        if (cell.value === 'OCUPADA') cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
                        else cell.font = { color: { argb: 'FF15803D' }, bold: true };
                    }
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_UCA_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Error al exportar Excel:", err);
        alert("❌ Error al generar el Excel.");
    }
  };

  // --- MOTOR DE ANALISIS ERI ---
  const processERIAnalysis = async (conteoData) => {
    try {
        // [MOD V18.5.5] Buscamos primero en 'inventario' (Llave de la pestaña Archivo Inventario)
        let stockActivo = await getAreaData('inventario');
        
        // Si no hay en 'inventario', probamos con 'inventario_activo' por si acaso
        if (!stockActivo || stockActivo.length === 0) {
            stockActivo = await getAreaData('inventario_activo');
        }

        if (!stockActivo || stockActivo.length === 0) {
            alert("⚠️ No hay datos de 'STOCK ACTIVO' cargados. Cárgalos primero para realizar el cruce.");
            return;
        }

        const maestro = await getAreaData('articulos') || [];
        const maestroMap = new Map();
        maestro.forEach(a => {
            const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || '').toString().trim();
            const mDesc = (getCol(a, ['Descripcion', 'Descripción', 'Description', 'Desc']) || 'S/D').toString();
            if (mSku) maestroMap.set(mSku, mDesc);
        });

        // [MOD V18.5.7] Mapa de descripciones extraído directamente del Stock Activo (Col C)
        const descMap = new Map();

        // Mapa de Sistema: [SKU + UBI] -> QTY
        const sistemaMap = new Map();
        stockActivo.forEach(row => {
            const sku = (getCol(row, ['SKU', 'Articulo', 'Artículo', 'Product', 'Producto']) || (Array.isArray(row) ? row[1] : '')).toString().trim();
            const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim();
            const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;
            
            // [MOD V18.5.13] Escaneo inteligente de descripción
            let desc = 'S/D';
            if (typeof row === 'object' && !Array.isArray(row)) {
                desc = getCol(row, ['Descripcion', 'Descripción', 'Description', 'DESCRIPCION', 'Articulo', 'Nombre']) || 'S/D';
            } else if (Array.isArray(row)) {
                // Si la Col C (2) falla, buscamos en otras columnas probables (E, G, H...)
                desc = row[2] || row[4] || row[6] || row[7] || 'S/D';
            }
            desc = desc.toString().trim();

            if (sku) {
                const key = `${sku.toUpperCase()}|${ubi.toUpperCase()}`;
                sistemaMap.set(key, (sistemaMap.get(key) || 0) + qty);
                if (desc) descMap.set(sku.toUpperCase(), desc);
            }
        });

        // Mapa de Fisico: [SKU + UBI] -> QTY
        const fisicoMap = new Map();
        conteoData.forEach(row => {
            const sku = (row[0] || '').toString().trim(); // Col A
            const qty = parseFloat(row[1]) || 0;           // Col B
            const ubi = (row[2] || '').toString().trim(); // Col C
            if (sku) {
                const key = `${sku.toUpperCase()}|${ubi.toUpperCase()}`;
                fisicoMap.set(key, (fisicoMap.get(key) || 0) + qty);
            }
        });

        // Cruce de Datos - [MOD V18.5.7] Solo mostramos lo que está en el CONTEO FISICO
        const countKeys = Array.from(fisicoMap.keys());
        const results = [];
        let totalItems = 0;
        let correctItems = 0;

        countKeys.forEach(key => {
            const [sku, ubi] = key.split('|');
            const qSis = sistemaMap.get(key) || 0;
            const qFis = fisicoMap.get(key) || 0;
            const diff = qFis - qSis;
            
            // ERI por item: Proporción de acierto
            const eri = qSis === qFis ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, qFis || 1))) * 100;

            totalItems++;
            if (diff === 0) correctItems++;

            results.push({
                sku,
                ubi,
                desc: descMap.get(sku.toUpperCase()) || 'N/A',
                sis: qSis,
                fis: qFis,
                diff,
                eri: Math.max(0, eri).toFixed(1)
            });
        });

        const globalERI_Val = totalItems > 0 ? ((correctItems / totalItems) * 100).toFixed(1) : 0;

        // --- [MOD V18.5.11] LOGICA ERI (POR SKU TOTAL - SOLO LO CONTADO) ---
        const countedSkus = new Set();
        fisicoMap.forEach((qty, key) => countedSkus.add(key.split('|')[0].toUpperCase()));

        const eriBySku = new Map();
        countedSkus.forEach(sku => eriBySku.set(sku, { sis: 0, fis: 0 }));

        // Sumar todo el sistema por SKU pero SOLO de lo contado
        sistemaMap.forEach((qty, key) => {
            const sku = key.split('|')[0].toUpperCase();
            if (countedSkus.has(sku)) {
                eriBySku.get(sku).sis += qty;
            }
        });
        // Sumar todo el fisico por SKU
        fisicoMap.forEach((qty, key) => {
            const sku = key.split('|')[0].toUpperCase();
            if (countedSkus.has(sku)) {
                eriBySku.get(sku).fis += qty;
            }
        });

        const eriResults = [];
        let eriCorrect = 0;
        eriBySku.forEach((vals, sku) => {
            const diff = vals.fis - vals.sis;
            if (diff === 0) eriCorrect++;
            const acc = vals.sis === vals.fis ? 100 : (1 - (Math.abs(diff) / Math.max(vals.sis, vals.fis || 1))) * 100;
            
            // Buscar ubicaciones donde aparece este SKU en el conteo
            const ubis = results.filter(r => r.sku === sku).map(r => r.ubi);
            const ubiText = ubis.length > 1 ? "VARIAS" : (ubis[0] || 'N/A');

            eriResults.push({
                sku,
                ubi: ubiText,
                desc: descMap.get(sku.toUpperCase()) || 'N/A',
                sis: vals.sis,
                fis: vals.fis,
                diff,
                eri: Math.max(0, acc).toFixed(1)
            });
        });
        const finalERI = eriResults.length > 0 ? ((eriCorrect / eriResults.length) * 100).toFixed(1) : 0;

        // --- [MOD V18.5.11] LOGICA ERU (POR UBICACION) ---
        const eruResults = results.map(r => ({
            ...r,
            desc: descMap.get(r.sku.toUpperCase()) || 'N/A'
        })); 
        // [MOD V18.5.13] ERU Global ahora es el PROMEDIO de acierto para que sea más visual
        const eruAccSum = eruResults.reduce((acc, r) => acc + parseFloat(r.eri || 0), 0);
        const finalERU = eruResults.length > 0 ? (eruAccSum / eruResults.length).toFixed(1) : 0;

        // Guardar para toggles
        window._lastERI = { eriResults, finalERI, eruResults, finalERU };
        
        // [MOD V18.5.19] Si estamos en el dashboard unificado, usamos la nueva renderización
        if (document.getElementById('eri_results_area_unif')) {
            // Esta función suele estar definida dentro de renderModuloInventarios, 
            // pero podemos disparar un evento o simplemente llamar si es accesible.
            // Para asegurar compatibilidad, buscamos si existe la función de refresco.
            if (typeof renderERI_ERU_Unified_Global === 'function') {
                renderERI_ERU_Unified_Global();
            } else {
                // Failsafe
                updateERIUI('ERI');
            }
        } else {
            updateERIUI('ERI');
        }

    } catch (err) {
        console.error("Error en analisis ERI/ERU:", err);
        alert("Ocurrió un error al procesar el análisis.");
    }
  };

  const updateERIUI = (mode) => {
    const data = window._lastERI;
    if (!data) return;

    const tableBody = document.querySelector('#eri_eru_table_body');
    const tableHead = document.querySelector('#eri_eru_table_head');
    const eriLabel = document.querySelector('#eri_global_val');
    const eruLabel = document.querySelector('#eru_global_val');
    const eriCircle = document.querySelector('#eri_circle_path');
    const eruCircle = document.querySelector('#eru_circle_path');

    // Actualizar circulos siempre
    if (eriLabel) eriLabel.textContent = `${data.finalERI}%`;
    if (eruLabel) eruLabel.textContent = `${data.finalERU}%`;
    if (eriCircle) eriCircle.setAttribute('stroke-dasharray', `${data.finalERI}, 100`);
    if (eruCircle) eruCircle.setAttribute('stroke-dasharray', `${data.finalERU}, 100`);

    if (!tableBody || !tableHead) return;

    if (mode === 'ERI') {
        tableHead.innerHTML = `<tr><th>SKU</th><th>DESCRIPCIÓN</th><th style="text-align:center;">SISTEMA TOTAL</th><th style="text-align:center;">FÍSICO TOTAL</th><th style="text-align:center;">DIF.</th><th style="text-align:center;">% ERI</th></tr>`;
        tableBody.innerHTML = data.eriResults.map(r => `
            <tr>
                <td style="font-weight:700; color:#818cf8;">${r.sku}</td>
                <td style="font-size:0.7rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.desc}</td>
                <td style="text-align:center;">${r.sis}</td>
                <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                <td style="text-align:center; font-weight:800; color:${r.diff === 0 ? '#4ade80' : '#f87171'};">${r.diff > 0 ? '+' : ''}${r.diff}</td>
                <td style="text-align:center;"><span style="background:rgba(129,140,248,0.1); color:#818cf8; padding:2px 6px; border-radius:4px; font-weight:700;">${r.eri}%</span></td>
            </tr>
        `).join('');
    } else {
        tableHead.innerHTML = `<tr><th>SKU / UBICACIÓN</th><th>DESCRIPCIÓN</th><th style="text-align:center;">SISTEMA</th><th style="text-align:center;">FÍSICO</th><th style="text-align:center;">DIF.</th><th style="text-align:center;">% ERU</th></tr>`;
        tableBody.innerHTML = data.eruResults.map(r => `
            <tr>
                <td style="font-weight:700;">${r.sku}<br><span style="font-size:0.6rem; color:#10b981;">${r.ubi}</span></td>
                <td style="font-size:0.7rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.desc}</td>
                <td style="text-align:center;">${r.sis}</td>
                <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                <td style="text-align:center; font-weight:800; color:${r.diff === 0 ? '#4ade80' : '#f87171'};">${r.diff > 0 ? '+' : ''}${r.diff}</td>
                <td style="text-align:center;"><span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 6px; border-radius:4px; font-weight:700;">${r.eri}%</span></td>
            </tr>
        `).join('');
    }
  };

  const displayReporteUCA = (results) => {
    const container = document.getElementById('uca_results_area');
    if (!container) return;

    const total = results.length;
    const vacias = results.filter(r => r.estado === 'VACÍA').length;
    const ocupadas = total - vacias;
    const accuracy = total > 0 ? ((vacias / total) * 100).toFixed(2) : 0;
    const discrepancias = results.filter(r => r.lpns > 1);
    const now = new Date();
    const ts = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    const tsSpan = `<span style="font-size: 0.65rem; color: rgba(255,255,255,0.25); font-weight: 400; margin-left: 10px; letter-spacing: 0.5px; vertical-align: middle;">[ ${ts} ]</span>`;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="glass-panel" style="padding:1rem; border-left:4px solid var(--primary);">
          <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Analizadas</div>
          <div style="font-size:1.5rem; font-weight:700;">${total}</div>
        </div>
        <div class="glass-panel" style="padding:1rem; border-left:4px solid var(--success);">
          <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Vacías (UCA)</div>
          <div style="font-size:1.5rem; font-weight:700; color:var(--success);">${vacias}</div>
        </div>
        <div class="glass-panel" style="padding:1rem; border-left:4px solid #f59e0b;">
          <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Ocupadas</div>
          <div style="font-size:1.5rem; font-weight:700; color:#f59e0b;">${ocupadas}</div>
        </div>
        <div class="glass-panel" style="padding:1rem; border-left:4px solid #818cf8;">
          <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">% Disponibilidad</div>
          <div style="font-size:1.5rem; font-weight:700; color:#818cf8;">${accuracy}%</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:1rem; align-items: start; margin-bottom: 2rem;">
        <!-- TABLA GENERAL -->
        <div class="glass-panel" style="padding:1rem; overflow:hidden; display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
            <h3 style="font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#fff; display:flex; align-items:center;">
              REPORTE UCA GENERAL ${tsSpan}
            </h3>
            <button id="btnExportUCA" class="btn" style="width:auto; padding:5px 12px; font-size:0.7rem; background:#059669;">📊 EXPORTAR UCA</button>
          </div>
          
          <div class="data-table-container" style="max-height:400px; border-radius:8px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="font-size:0.65rem; padding:8px;">UBICACIÓN</th>
                  <th style="font-size:0.65rem; padding:8px;">ESTADO</th>
                  <th style="font-size:0.65rem; padding:8px; text-align:center;">LPNS</th>
                  <th style="font-size:0.65rem; padding:8px; text-align:center;">SKU´S</th>
                  <th style="font-size:0.65rem; padding:8px; text-align:center;">QTY</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(r => `
                  <tr>
                    <td style="font-weight:600; font-size:0.8rem; padding:6px 8px;">${r.ubicacion}</td>
                    <td style="padding:6px 8px;">
                      <span class="status-badge" style="background:${r.estado === 'VACÍA' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'}; color:${r.estado === 'VACÍA' ? '#4ade80' : '#fbbf24'}; font-size:0.6rem; padding:2px 6px;">
                        ${r.estado}
                      </span>
                    </td>
                    <td style="text-align:center; font-weight:700; font-size:0.8rem; padding:6px 8px;">${r.lpns}</td>
                    <td style="text-align:center; font-weight:700; font-size:0.8rem; padding:6px 8px;">${r.skus}</td>
                    <td style="text-align:center; font-weight:700; color:#818cf8; font-size:0.8rem; padding:6px 8px;">${r.qty}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- DISCREPANCIAS -->
        <div class="glass-panel" style="padding:1rem; border:1px solid rgba(239,68,68,0.2);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:#f87171; display:flex; align-items:center;">
              DISCREPANCIA UBICACIONES ${tsSpan}
            </h3>
            <span style="background:rgba(239,68,68,0.2); color:#f87171; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:700;">${discrepancias.length} CASOS</span>
          </div>
          <div class="data-table-container" style="max-height:400px; border-radius:8px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="color:#f87171; font-size:0.65rem; padding:8px;">UBICACIÓN</th>
                  <th style="color:#f87171; font-size:0.65rem; padding:8px; text-align:center;">LPNS</th>
                  <th style="color:#f87171; font-size:0.65rem; padding:8px; text-align:center;">SKU´S</th>
                  <th style="color:#f87171; font-size:0.65rem; padding:8px; text-align:center;">QTY</th>
                  <th style="color:#f87171; font-size:0.65rem; padding:8px;">DETALLE</th>
                </tr>
              </thead>
              <tbody>
                ${discrepancias.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem; font-size:0.8rem;">No se encontraron discrepancias</td></tr>' : 
                  discrepancias.map(r => `
                  <tr>
                    <td style="color:#f87171; font-weight:600; font-size:0.8rem; padding:6px 8px;">${r.ubicacion}</td>
                    <td style="text-align:center; font-weight:700; font-size:0.8rem; padding:6px 8px;">${r.lpns}</td>
                    <td style="text-align:center; font-weight:700; font-size:0.8rem; padding:6px 8px;">${r.skus}</td>
                    <td style="text-align:center; font-weight:700; font-size:0.8rem; padding:6px 8px;">${r.qty}</td>
                    <td style="font-size:0.65rem; color:#e2e8f0; padding:6px 8px; word-break: break-all; opacity:0.9;">${r.detalle}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Vincular exportación
    document.getElementById('btnExportUCA')?.addEventListener('click', () => exportUCAtoExcel(results));
  };

  const renderGenericAreaTab = async (tabId, subtitle) => {
    contentSubtitle.textContent = subtitle;
    const tabDef = TABS.find(t => t.id === tabId);
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`${tabId}_${sub.id}`] === 1);

    let activeSub = localStorage.getItem(`activeSub_${tabId}`) || allowedSubTabs[0]?.id;
    if (!allowedSubTabs.find(s => s.id === activeSub)) activeSub = allowedSubTabs[0]?.id;

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:0.8rem; border-bottom:1px solid var(--border);">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.4rem 0.2rem; font-size: 0.85rem; cursor:pointer;">
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
        if (tabId === 'inventario') {
            renderUploadArea(wrap, 'matriz_ubicaciones', dataStore.matriz_ubicaciones, '.xlsx', 'MATRIZ UBICACIONES ALTO');
        }
        if (tabId === 'no_retail') {
            renderUploadArea(wrap, `${tabId}_pedidos`, dataStore[`${tabId}_pedidos`], '.xlsx', 'PEDIDOS CATÁLOGO');
        }
    } else if (tabId === 'inventario' && activeSub === 'inventarios_main') {
        const activeSubObj = allowedSubTabs.find(s => s.id === 'inventarios_main');
        let activeSubSub = localStorage.getItem('activeSubSub_inventario_main') || 'general';
        
        container.innerHTML = `
            <nav style="display:flex; gap:1.2rem; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.05);">
                ${activeSubObj.subTabs.map(ss => `
                    <a class="sub-sub-nav-item ${activeSubSub===ss.id?'active':''}" data-ss="${ss.id}" style="padding: 0.5rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${activeSubSub===ss.id?'var(--primary)':'var(--text-muted)'}; font-weight:${activeSubSub===ss.id?'800':'500'}; border-bottom:${activeSubSub===ss.id?'2px solid var(--primary)':'none'};">
                        ${ss.icon} ${ss.label.toUpperCase()}
                    </a>
                `).join('')}
            </nav>
            <div id="subSubContent"></div>
        `;
        
        document.querySelectorAll('.sub-sub-nav-item').forEach(b => b.addEventListener('click', (e) => {
            activeSubSub = e.currentTarget.dataset.ss;
            localStorage.setItem('activeSubSub_inventario_main', activeSubSub);
            renderGenericAreaTab(tabId, subtitle);
        }));

        const subSubContent = document.getElementById('subSubContent');
        subSubContent.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);"><h4>Contenido de ${activeSubSub.toUpperCase()} en desarrollo</h4></div>`;
        
    } else if (tabId === 'almacenaje' && (activeSub === 'tareas_dia' || activeSub === 'kpi_tareas')) {
        // [MOD v15.8.8] Sincronizar el modo interno de Almacenaje con la sub-pestaña seleccionada
        if (activeSub === 'kpi_tareas') {
            almacenajeTaskMode = 'kpi';
            localStorage.setItem('almacenajeTaskMode', 'kpi');
        } else {
            // Si viene de tareas_dia, asegurar que no esté en modo KPI
            if (almacenajeTaskMode === 'kpi') {
                almacenajeTaskMode = 'resumen';
                localStorage.setItem('almacenajeTaskMode', 'resumen');
            }
        }
        renderAlmacenajeTareas(container);
    } else if (tabId === 'inventario' && activeSub === 'reportes_inventario') {
        container.innerHTML = `
            <div class="glass-panel" style="padding:3rem; text-align:center;">
                <h3 style="margin-bottom:1rem; color:var(--primary); font-weight:800;">ANÁLISIS DE DISCREPANCIAS (UCA)</h3>
                <p style="color:var(--text-muted); margin-bottom:2rem; max-width:600px; margin-left:auto; margin-right:auto;">
                    Cruce inteligente entre <strong>Stock Reserva</strong> y <strong>Matriz de Ubicaciones</strong> para determinar la efectividad del vaciado en ubicaciones de alto nivel.
                </p>
                <button id="btn_procesar_uca" class="btn" style="max-width:300px; margin:0 auto; padding:1rem 2rem; border-radius:12px; box-shadow: 0 10px 20px rgba(79,70,229,0.2);">
                    ⚡ PROCESAR REPORTE UCA
                </button>
                <div id="ucaResultsArea" style="margin-top:3rem;"></div>
            </div>
        `;
        document.getElementById('btn_procesar_uca').addEventListener('click', () => {
            processReporteUCA(document.getElementById('ucaResultsArea'));
        });
    } else {
        const data = await getAreaData(tabId);
        if (!data) renderUploadArea(container, tabId);
        else renderDashboardView(container, data);
    }
  };

  const renderAnalisisSKUTab = async () => {
    contentSubtitle.textContent = "Consulta profunda de Artículos";
    const tabDef = TABS.find(t => t.id === 'analisis_sku');
    const perms = adminService.getPermissions(user.role) || {};
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || perms[`analisis_sku_${sub.id}`] === 1);

    if (!allowedSubTabs.find(s => s.id === activeAnalisisSub)) activeAnalisisSub = allowedSubTabs[0]?.id;

    contentArea.innerHTML = `
        <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
          ${allowedSubTabs.map(sub => `
            <a class="sub-nav-item ${activeAnalisisSub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size: 0.85rem; cursor:pointer;">
                ${sub.icon} ${sub.label.toUpperCase()}
            </a>
          `).join('')}
        </nav><div id="skuContent"></div>`;

    document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
        activeAnalisisSub = e.currentTarget.dataset.s; 
        renderAnalisisSKUTab(); 
    }));

    const skuBuf = document.getElementById('skuContent');
    if (activeAnalisisSub === 'archivo_analisis') {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; skuBuf.appendChild(wrap);
        renderUploadArea(wrap, 'analisis_sku_activo', dataStore.analisis_sku_activo, '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, 'analisis_sku_reserva', dataStore.analisis_sku_reserva, '.xlsx', 'STOCK RESERVA');
        return;
    }

    if (activeAnalisisSub !== 'articulo_temp') {
        skuBuf.innerHTML = `
            <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                <div style="font-size:3rem; margin-bottom:1rem; opacity:0.1;">🚧</div>
                <h4>Módulo en Desarrollo</h4>
                <p>Esta sección estará disponible próximamente.</p>
            </div>`;
        return;
    }

    const runGlobalAnalysis = async () => {
      const btn = document.getElementById('btn_run_global') || document.getElementById('btn_refresh_global');
      const oldHtml = btn ? btn.innerHTML : '⚡ PROCESAR REPORTE ARTÍCULO';

      if (!dataStore.stockActivo || !dataStore.stockReserva) {
          alert('⚠️ ATENCIÓN: Primero debes cargar "STOCK ACTIVO" y "STOCK RESERVA" en el módulo correspondiente.');
          return;
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '⚙️ PROCESANDO...'; }
      
      setTimeout(async () => {
        try {
          const res = await calculateBufferPallets();
          if (res) {
                  lastBufferResult = {
                      reporteTemporadasQ: res.reporteTemporadasQ,
                      reporteGender: res.reporteGender,
                      reporteObsolencia: res.reporteObsolencia,
                      detalleObsGen: res.detalleObsGen || [],
                      detalleTemporadas: res.detalleTemporadas || [],
                      timestamp: res.timestamp || new Date().toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
                  };
              try {
                  // Limpiar claves antiguas de logistics_ para liberar espacio
                  Object.keys(localStorage).forEach(key => {
                      if (key.startsWith('logistics_') && !key.startsWith(CACHE_KEY)) {
                          localStorage.removeItem(key);
                      }
                  });
                  localStorage.setItem(CACHE_KEY + 'lastBufferKPI', JSON.stringify(lastBufferResult));
              } catch(e) {
                  console.warn("[PULSE] LocalStorage lleno. Los datos solo persistirán en esta sesión.", e);
              }
              renderAnalisisSKUTab();
          } else {
              alert('⚠️ ERROR: El análisis no generó datos.');
              if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
          }
        } catch (err) {
          console.error(err);
          alert('❌ Error crítico: ' + err.message);
          if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
        }
      }, 100);
    };

    if (!lastBufferResult) {
        contentArea.innerHTML = subNavHtml + `
            <div class="glass-panel animate-fade-in" style="padding:4rem 2rem; text-align:center; border: 1px dashed rgba(255,255,255,0.1);">
                <div style="margin-bottom:2rem;">
                    <img src="https://img.icons8.com/fluency/96/000000/search-property.png" style="opacity:0.6; filter:grayscale(0.5);"/>
                </div>
                <h3 style="color:#fff; font-weight:700; margin-bottom:1rem;">ARTICULO POR TEMPORADA</h3>
                <p style="color:var(--text-muted); max-width:500px; margin:0 auto 2.5rem;">
                    Presiona el botón para consolidar el Stock Activo y Reserva por Artículo y Temporada.
                </p>
                <button id="btn_run_global" class="btn" style="max-width:400px; padding:1.2rem; font-weight:800; font-size:1rem; letter-spacing:1px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);">
                    ⚡ PROCESAR REPORTE ARTÍCULO
                </button>
            </div>
        `;
        const btn = document.getElementById('btn_run_global');
        if (btn) btn.onclick = runGlobalAnalysis;
        return;
    }

    const data = lastBufferResult || {};
    const tQ = data.reporteTemporadasQ || [];
    const tG = data.reporteGender || [];
    const tO = data.reporteObsolencia || [];
    const tDetalle = data.detalleObsGen || [];

    contentArea.innerHTML = subNavHtml + `
      <div class="animate-fade-in" style="width:100%; max-width:1450px; margin:0 auto;">
        
        <!-- BOTONES ARRIBA (FUERA DEL MARGEN) -->
        <div style="display:flex; gap:1rem; margin-bottom:1.5rem; padding-left:0.5rem;">
            <button id="btn_refresh_global" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(79,70,229,0.05); border:1px solid var(--primary); font-weight:800; border-radius:8px; color:#fff; cursor:pointer; transition:all 0.3s;" onmouseover="this.style.background='var(--primary)'" onmouseout="this.style.background='rgba(79,70,229,0.05)'">
                🔄 RE-PROCESAR TODO
            </button>
            <button id="btn_export_analisis" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(16,185,129,0.05); border:1px solid #10b981; font-weight:800; border-radius:8px; color:#fff; cursor:pointer; transition:all 0.3s;" onmouseover="this.style.background='#10b981'" onmouseout="this.style.background='rgba(16,185,129,0.05)'">
                📥 EXPORTAR TEMPORADA
            </button>
            <button id="btn_export_obsgen" class="btn" style="width:auto; padding:0.8rem 1.5rem; font-size:0.75rem; background:rgba(251,191,36,0.05); border:1px solid #fbbf24; font-weight:800; border-radius:8px; color:#fff; cursor:pointer; transition:all 0.3s;" onmouseover="this.style.background='#fbbf24'" onmouseout="this.style.background='rgba(251,191,36,0.05)'">
                📊 DETALLE OBS.GEN
            </button>
        </div>

        <div style="display:flex; gap:1.5rem; align-items: stretch;">
            
            <!-- REPORTE ARTICULO POR TEMPORADA (IZQUIERDA) -->
            <div style="flex:2.2; display:flex;">
                <div class="glass-panel" style="flex:1; padding:1.5rem; border:1px solid rgba(79,70,229,0.5); box-shadow:0 0 25px rgba(79,70,229,0.2); background:rgba(15,23,42,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.8rem;">
                        <h3 style="color:#fff; font-weight:900; margin:0; font-size:1.1rem; letter-spacing:1px; text-transform:uppercase;">ARTICULO POR TEMPORADA</h3>
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; background:rgba(0,0,0,0.3); padding:4px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.05);">
                            📅 ${data.timestamp || '00/00/0000, 00:00:00'}
                        </span>
                    </div>

                    <div style="overflow-x:auto;">
                        <table class="data-table" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
                            <thead>
                                <tr style="color:var(--primary); font-weight:900; text-transform:uppercase; font-size:0.7rem; border-bottom:2px solid var(--border);">
                                    <th style="text-align:left; padding:1rem 0.5rem; width:130px;">AÑO/TEMPORADA</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q1</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q2</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q3</th>
                                    <th style="text-align:center; padding:1rem 0.5rem;">Q4</th>
                                    <th style="text-align:center; padding:1rem 0.5rem; background:rgba(79,70,229,0.05); color:#fff;">CANTIDAD</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tQ.map(row => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                        <td style="padding:0.7rem 0.5rem; font-weight:800; color:#fff;">${row.Año}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:600; opacity: ${row.Q1 === 0 ? '0.15' : '1'}">${(row.Q1 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:600; opacity: ${row.Q2 === 0 ? '0.15' : '1'}">${(row.Q2 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:600; opacity: ${row.Q3 === 0 ? '0.15' : '1'}">${(row.Q3 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:600; opacity: ${row.Q4 === 0 ? '0.15' : '1'}">${(row.Q4 || 0).toLocaleString()}</td>
                                        <td style="padding:0.7rem 0.5rem; text-align:center; font-weight:900; color:var(--primary); background:rgba(79,70,229,0.02); opacity: ${row.TOTAL === 0 ? '0.15' : '1'}">${(row.TOTAL || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot style="border-top:2px solid var(--border); background:rgba(79,70,229,0.05);">
                                <tr style="font-weight:900; color:#fff; font-size:0.85rem;">
                                    <td style="padding:1rem 0.5rem;">TOTAL GENERAL</td>
                                    <td style="padding:1rem 0.5rem; text-align:center;">${tQ.reduce((s,r)=>s+(r.Q1||0),0).toLocaleString()}</td>
                                    <td style="padding:1rem 0.5rem; text-align:center;">${tQ.reduce((s,r)=>s+(r.Q2||0),0).toLocaleString()}</td>
                                    <td style="padding:1rem 0.5rem; text-align:center;">${tQ.reduce((s,r)=>s+(r.Q3||0),0).toLocaleString()}</td>
                                    <td style="padding:1rem 0.5rem; text-align:center;">${tQ.reduce((s,r)=>s+(r.Q4||0),0).toLocaleString()}</td>
                                    <td style="padding:1rem 0.5rem; text-align:center; color:#fbbf24; background:rgba(0,0,0,0.2);">${tQ.reduce((s,r)=>s+(r.TOTAL||0),0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA (OBS + GENDER) -->
            <div style="flex:1; display:flex; flex-direction:column; gap:1.5rem;">
                
                <!-- REPORTE OBSOLESCENCIA -->
                <div class="glass-panel" style="flex:1; padding:1.2rem; background:rgba(15,23,42,0.4); border:1px solid rgba(16,185,129,0.5); box-shadow:0 0 15px rgba(16,185,129,0.15); display:flex; flex-direction:column;">
                    <h4 style="color:#10b981; font-weight:900; margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(16,185,129,0.1); padding-bottom:0.5rem;">⏳ OBSOLESCENCIA</h4>
                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                        <thead><tr style="color:var(--text-muted); font-weight:800; border-bottom:1px solid #333;"><th style="text-align:left; padding:0.5rem;">TIPO OBSOLENCIA</th><th style="text-align:center; padding:0.5rem;">CANTIDAD</th></tr></thead>
                        <tbody>
                            ${tO.length ? tO.map(row => `<tr style="border-bottom:1px solid rgba(255,255,255,0.02);"><td style="padding:0.6rem 0.5rem; color:#fff;">${row.label}</td><td style="text-align:center; padding:0.6rem 0.5rem; font-weight:800; color:#10b981; opacity:${row.qty===0?'0.15':'1'}">${(row.qty || 0).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center; padding:1rem; opacity:0.3;">Sin datos</td></tr>'}
                        </tbody>
                        ${tO.length ? `<tfoot><tr style="background:rgba(16,185,129,0.1); color:#10b981; font-weight:900;"><td style="padding:0.6rem 0.5rem;">TOTAL GENERAL</td><td style="text-align:center;">${tO.reduce((a,b)=>a+b.qty,0).toLocaleString()}</td></tr></tfoot>` : ''}
                    </table>
                </div>

                <!-- REPORTE G. GENDER -->
                <div class="glass-panel" style="flex:1; padding:1.2rem; background:rgba(15,23,42,0.4); border:1px solid rgba(251,191,36,0.5); box-shadow:0 0 15px rgba(251,191,36,0.15); display:flex; flex-direction:column;">
                    <h4 style="color:#fbbf24; font-weight:900; margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(251,191,36,0.1); padding-bottom:0.5rem;">👥 G. GENDER</h4>
                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                        <thead><tr style="color:var(--text-muted); font-weight:800; border-bottom:1px solid #333;"><th style="text-align:left; padding:0.5rem;">G. GENDER</th><th style="text-align:center; padding:0.5rem;">CANTIDAD</th></tr></thead>
                        <tbody>
                            ${tG.length ? tG.map(row => `<tr style="border-bottom:1px solid rgba(255,255,255,0.02);"><td style="padding:0.6rem 0.5rem; color:#fff;">${row.label}</td><td style="text-align:center; padding:0.6rem 0.5rem; font-weight:800; color:#fbbf24; opacity:${row.qty===0?'0.15':'1'}">${(row.qty || 0).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center; padding:1rem; opacity:0.3;">Sin datos</td></tr>'}
                        </tbody>
                        ${tG.length ? `<tfoot><tr style="background:rgba(251,191,36,0.1); color:#fbbf24; font-weight:900;"><td style="padding:0.6rem 0.5rem;">TOTAL GENERAL</td><td style="text-align:center;">${tG.reduce((a,b)=>a+b.qty,0).toLocaleString()}</td></tr></tfoot>` : ''}
                    </table>
                </div>

            </div>

        </div>
      </div>
    `;

    const refreshBtn = document.getElementById('btn_refresh_global');
    if (refreshBtn) refreshBtn.onclick = runGlobalAnalysis;

    const exportBtn = document.getElementById('btn_export_analisis');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const detail = data.detalleTemporadas || [];
            if (!detail.length) return alert('No hay datos detallados de temporadas para exportar. Pulsa Procesar.');
            
            const ws = XLSX.utils.json_to_sheet(detail);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Revision_Temporadas");
            XLSX.writeFile(wb, `Reporte_Revision_Temporadas_${new Date().getTime()}.xlsx`);
        };
    }

    const exportObsGenBtn = document.getElementById('btn_export_obsgen');
    if (exportObsGenBtn) {
        exportObsGenBtn.onclick = () => {
            if (!tDetalle.length) return alert('No hay datos detallados para exportar.');
            const ws = XLSX.utils.json_to_sheet(tDetalle);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Detalle_OBS_GEN");
            XLSX.writeFile(wb, `Detalle_OBS_GEN_${new Date().getTime()}.xlsx`);
        };
    }
  };

  const processAlmacenajeTasks = async (mode = 'update', manualDate = null) => {
    try {
        const stock = await getAreaData('almacenaje_activo');
        const maestro = dataStore.articulos;
        if (!stock || !stock.length) { alert("⚠️ Primero debes cargar el 'Stock Activo' en la pestaña Archivo."); return; }
        if (!maestro || !maestro.length) { alert("⚠️ Falta cargar el Maestro de Artículos."); return; }

        const logicalDate = manualDate || getLogicalDate();
        almacenajeTasksCache = Array.isArray(almacenajeTasksCache) ? almacenajeTasksCache.filter(t => 
            t && (t.fecha !== logicalDate || t.status === 'Asignado' || t.status === 'Finalizado')
        ) : [];

        const allowedAreas = ['MZN01', 'MZN02', 'MZN03', 'MZN04', 'SEL', 'CDBUFFER'];
        const filtered = stock.filter(row => {
            const area = String(row['Ãrea'] || row['Area'] || row['Área'] || '').trim().toUpperCase();
            const ubi = String(row['Ubicación actual'] || row['Ubicacion'] || row['Ubicación'] || '').trim().toUpperCase();
            
            // [REGLA CRÍTICA] Omitir ubicaciones de PreePack (15 dígitos)
            if (ubi.startsWith('CDBUFFER-C')) return false;

            return allowedAreas.some(a => area.includes(a));
        });

        const artMap = new Map();
        maestro.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const sku7 = String(raw[1] || '').trim().substring(0, 7);
            if (sku7 && !artMap.has(sku7)) {
                artMap.set(sku7, {
                    marca: String(raw[13] || 'S/M').trim(),
                    gender: String(raw[3] || '').trim().toUpperCase(), 
                    coleccion: String(raw[9] || 'S/C').trim()
                });
            }
        });

        const groups = {};
        filtered.forEach(row => {
            const skuFull = String(row['ArtÃculo'] || row['Articulo'] || row['Artículo'] || row['Sku'] || '').trim();
            const sku7 = skuFull.substring(0, 7);
            const area = String(row['Ãrea'] || row['Area'] || row['Área'] || '').trim().toUpperCase();
            const qty = parseFloat(row['Cantidad actual'] || row['Cantidad'] || row['Cant.']) || 0;
            const ubi = String(row['Ubicación actual'] || row['Ubicacion'] || row['Ubicación'] || '').trim();
            const info = artMap.get(sku7) || { marca: 'S/M', gender: 'S/G', coleccion: 'S/C' };

            if (!groups[sku7]) groups[sku7] = { sku7, marca: info.marca, gender: info.gender, coleccion: info.coleccion, items: [], bufferQty: 0, zonaQty: 0 };
            const item = { ...row, skuFull, ubi, qty, area };
            groups[sku7].items.push(item);
            if (area.includes('CDBUFFER')) groups[sku7].bufferQty += qty;
            else groups[sku7].zonaQty += qty;
        });

        const eligibleArticulos = Object.values(groups).filter(g => g.bufferQty > 0);
        const byMarca = {};
        eligibleArticulos.forEach(art => {
            if (!byMarca[art.marca]) byMarca[art.marca] = [];
            byMarca[art.marca].push(art);
        });

        const finalTasks = [];
        
        // --- [NUEVA LÓGICA DE HUECOS] ---
        // 1. Mapear qué números de "TareaX" ya están ocupados hoy
        const usedNumbers = new Set();
        almacenajeTasksCache.forEach(t => {
            if (t.fecha === logicalDate) {
                const num = parseInt(t.id.replace('Tarea', ''));
                if (!isNaN(num)) usedNumbers.add(num);
            }
        });

        // 2. Función para obtener el siguiente ID libre
        const getNextFreeId = () => {
            let n = 1;
            while (usedNumbers.has(n)) n++;
            usedNumbers.add(n); // Reservarlo de inmediato
            return `Tarea${n}`;
        };

        Object.keys(byMarca).forEach(marca => {
            const arts = byMarca[marca];
            const accs = arts.filter(a => a.gender.includes('ACCESORIES'));
            const normals = arts.filter(a => !a.gender.includes('ACCESORIES'));
            accs.forEach(a => {
                finalTasks.push({ id: getNextFreeId(), marca: marca, qty: a.bufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [a] });
            });
            const bigNormals = normals.filter(a => a.bufferQty >= 300);
            const smallNormals = normals.filter(a => a.bufferQty < 300);
            bigNormals.forEach(a => {
                finalTasks.push({ id: getNextFreeId(), marca: marca, qty: a.bufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [a] });
            });
            let currentGroup = [];
            let currentBufferQty = 0;
            smallNormals.forEach((art, index) => {
                currentGroup.push(art);
                currentBufferQty += art.bufferQty;
                if (currentBufferQty >= 300 || index === smallNormals.length - 1) {
                    finalTasks.push({ id: getNextFreeId(), marca: marca, qty: currentBufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [...currentGroup] });
                    currentGroup = [];
                    currentBufferQty = 0;
                }
            });
        });

        const tasksWithDate = finalTasks.map(t => ({...t, fecha: logicalDate}));
        almacenajeTasksCache = [...almacenajeTasksCache, ...tasksWithDate];
        await saveAlmacenajeTasks(); 
        renderAlmacenajeTareas(document.getElementById('areaContent') || document.querySelector('.main-content') || document.body);
    } catch (e) {
        alert("🚨 Error de Cálculo: " + e.message);
    }
  };

  const exportAlmacenajeExcel = async () => {
    if (!almacenajeTasksCache.length) { alert("No hay tareas para exportar."); return; }
    
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Tareas Día', {
        properties: { tabColor: { argb: 'FF4F46E5' } },
        pageSetup: { 
            margins: { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0 },
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            printTitlesRow: '1:6'
        }
    });

    // 7. Configurar anchos de columna
    ws.columns = [
        { key: 'articulo', width: 20.50 }, // A
        { key: 'ubicacion', width: 26.00 }, // B
        { key: 'sku', width: 20.50 },      // C
        { key: 'tallas', width: 7.00 },     // D
        { key: 'marcas', width: 20.50 },    // E
        { key: 'gender', width: 18.00 },    // F
        { key: 'coleccion', width: 16.00 }, // G
        { key: 'qty_buffer', width: 13.60 },// H
        { key: 'qty_zona', width: 14.29 },  // I
        { key: 'tareas', width: 14.29 }     // J
    ];

    // 3. Toda la pestaña en fuente 16
    ws.eachRow((row) => {
        row.font = { size: 16, name: 'Calibri' };
    });

    // 1. Crear 5 filas (implícito al empezar en la 6 para el header)
    // 5. En la celda A2 escribir Nombres, A3 Hora Inicio, A4 Hora Inicio
    ws.getCell('A2').value = 'Nombres';
    ws.getCell('A3').value = 'Hora Inicio';
    ws.getCell('A4').value = 'Hora Inicio';
    ws.getCell('A5').value = new Date().toLocaleString('es-ES');

    // Estilo para las etiquetas de cabecera
    ['A2', 'A3', 'A4'].forEach(cellId => {
        const cell = ws.getCell(cellId);
        cell.font = { size: 16, bold: true, name: 'Calibri' };
    });
    
    // A5: Solo fecha/hora, fuente 10, gris oscuro
    const cellA5 = ws.getCell('A5');
    cellA5.font = { size: 10, color: { argb: 'FF555555' }, name: 'Calibri' };

    // 2. Fila 6 Columnas A hasta la J, Fondo Negro, texto blanco en negrita
    const headerRow = ws.getRow(6);
    headerRow.values = ["Articulo", "UBICACION", "SKU", "Tallas", "Marcas", "Gender RIMS", "Colección", "Qty Buffer", "Qty Zona", "Tareas"];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Calibri' };
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Preparar datos
    const dataRows = [];
    almacenajeTasksCache.forEach(task => {
        // Filtrar tareas por fecha seleccionada si existe
        if (selectedTaskDate && task.fecha !== selectedTaskDate) return;

        task.items.forEach(art => {
            const getTalla = (sku) => (dataStore.tabla_tallas && dataStore.tabla_tallas[sku]) || sku.split('-').pop();
            
            // CDBUFFER Rows
            art.items.filter(i => i.area.includes('CDBUFFER')).forEach(i => {
                dataRows.push([art.sku7, i.ubi, i.skuFull, getTalla(i.skuFull), art.marca, art.gender, art.coleccion, i.qty, "", task.id]);
            });
            // ZONA Rows
            art.items.filter(i => !i.area.includes('CDBUFFER')).forEach(i => {
                dataRows.push([art.sku7, i.ubi, i.skuFull, getTalla(i.skuFull), art.marca, art.gender, art.coleccion, "", i.qty, task.id]);
            });
            // Subtotal
            dataRows.push([`Total ${art.sku7}`, "", "", "", art.marca, "", "", art.bufferQty, art.zonaQty, task.id]);
        });
    });

    // Agregar filas de datos a partir de la fila 7
    dataRows.forEach((rowData) => {
        const row = ws.addRow(rowData);
        row.font = { size: 16, name: 'Calibri' };
        
        // 4. Centras las columnas H, I y J
        [8, 9, 10].forEach(colIdx => {
            row.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // 6. Todas las celdas que comiencen con Total, Blanco, Fondo 1 , 35 %. de la columna A hasta la J y en negrita
        if (String(rowData[0]).startsWith('Total')) {
            row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Calibri' };
            row.eachCell((cell) => {
                cell.fill = { 
                    type: 'pattern', 
                    pattern: 'solid', 
                    fgColor: { argb: 'FFA6A6A6' } // Gris 35% (Aprox)
                };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
        } else {
            row.eachCell((cell) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
        }
    });

    // Escribir archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Plan_Almacenaje_v13.0.2_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderAlmacenajeTareas = (container) => {
    const isDetail = almacenajeTaskMode === 'detalle';
    const isKpi = almacenajeTaskMode === 'kpi';
    
    // [OPTIMIZACIÓN] Pre-calcular mapa de stock para evitar bloqueos en el renderizado
    const otherZonesStockMap = new Map();
    if (isDetail) {
        const zoneAreas = ['almacenaje_activo', 'stockActivo', 'picking_activo', 'rack_activo'];
        
        // Helper para encontrar claves reales una sola vez por área
        const findActualKey = (row, names) => {
            if (!row) return null;
            const keys = Object.keys(row);
            const normalize = (s) => String(s || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, '');
            for (let n of names) {
                if (row[n] !== undefined) return n;
                const target = normalize(n);
                const found = keys.find(k => normalize(k) === target);
                if (found) return found;
            }
            return null;
        };

        zoneAreas.forEach(areaKey => {
            const data = dataStore[areaKey];
            if (data && data.length > 0) {
                const firstRow = data[0];
                const skuKey = findActualKey(firstRow, ['Articulo', 'Artículo', 'Sku', 'ArtÃculo', 'PRODUCTO']);
                const ubiKey = findActualKey(firstRow, ['Ubicación actual', 'Ubicacion', 'Ubicación', 'UBICACION']);
                const qtyKey = findActualKey(firstRow, ['Cantidad actual', 'Cantidad', 'Cant.', 'CANTIDAD']);

                if (skuKey) {
                    data.forEach(row => {
                        const rowSku = row[skuKey];
                        if (rowSku) {
                            if (!otherZonesStockMap.has(rowSku)) otherZonesStockMap.set(rowSku, []);
                            const ubi = (ubiKey && row[ubiKey]) || '---';
                            const qty = (qtyKey && parseFloat(row[qtyKey])) || 0;
                            otherZonesStockMap.get(rowSku).push({
                                ...row,
                                ubi: ubi,
                                qty: qty,
                                areaDisplay: areaKey.replace('_activo','').toUpperCase(),
                                skuFull: rowSku
                            });
                        }
                    });
                }
            }
        });
    }
    
    // SINCRONIZACIÓN CRÍTICA: Asegurar que el cache local tenga lo que el radar encontró
    if (adminService.adminStore.almacenaje_tasks) {
        almacenajeTasksCache = adminService.adminStore.almacenaje_tasks;
    }
    const tasks = Array.isArray(almacenajeTasksCache) ? [...almacenajeTasksCache] : [];
    
    // [ORDENAMIENTO JERÁRQUICO] 1. Fecha Descendente (Más reciente arriba), 2. Tarea Ascendente (1, 2, 3...)
    tasks.sort((a, b) => {
        if (!a || !b) return 0;
        // Primero comparar fechas
        const dateA = a.fecha || '';
        const dateB = b.fecha || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA); // Más reciente primero

        // Si la fecha es igual, comparar número de tarea
        const numA = parseInt(String(a.id || '').replace('Tarea', '')) || 0;
        const numB = parseInt(String(b.id || '').replace('Tarea', '')) || 0;
        return numA - numB;
    });

    // Lógica de Agrupación para Historial
    const getWeekNumber = (d) => {
        const date = new Date(d);
        const dUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        dUTC.setUTCDate(dUTC.getUTCDate() + 4 - (dUTC.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1));
        return Math.ceil((((dUTC - yearStart) / 86400000) + 1) / 7);
    };

    const groups = {};
    tasks.forEach(t => {
        if (!t || typeof t !== 'object') return;
        if (!t.fecha) t.fecha = new Date().toISOString().split('T')[0];
        const dateObj = new Date(t.fecha + 'T00:00:00');
        if (isNaN(dateObj.getTime())) return;

        const w = `Semana ${getWeekNumber(dateObj)}`;
        if (!groups[w]) groups[w] = {};
        if (!groups[w][t.fecha]) groups[w][t.fecha] = 0;
        groups[w][t.fecha]++;
    });

    const sidebarHtml = Object.keys(groups).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numB - numA;
    }).map(w => {
        const isExpanded = expandedWeeks.includes(w);
        const days = groups[w];
        return `
            <div style="margin-bottom:8px;">
                <div onclick="window.toggleWeek('${w}')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:rgba(255,255,255,0.03); border-radius:10px; cursor:pointer; font-size:0.8rem; font-weight:700; color:#fff;">
                    <span>📅 ${w}</span>
                    <span>${isExpanded ? '▼' : '▶'}</span>
                </div>
                ${isExpanded ? Object.keys(days).sort().reverse().map(d => {
                    const [y, m, day] = d.split('-');
                    const dDisplay = `${day}/${m}/${y}`;
                    return `
                    <div onclick="window.setSelectedDate('${d}')" style="padding:8px 15px 8px 35px; cursor:pointer; font-size:0.75rem; color:${selectedTaskDate === d ? 'var(--primary)' : 'var(--text-muted)'}; font-weight:${selectedTaskDate === d ? '800' : '500'}; background:${selectedTaskDate === d ? 'rgba(79,70,229,0.1)' : 'transparent'};" onmouseover="this.style.color='#fff'" onmouseout="if('${selectedTaskDate}'!=='${d}') this.style.color='var(--text-muted)'">
                        ${dDisplay} <span style="opacity:0.5; font-size:0.6rem;">(${days[d]})</span>
                    </div>
                    `;
                }).join('') : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.4rem;">
            ${!isKpi ? `
            <nav style="display:flex; gap:1.5rem;">
                <a class="sub-sub-nav-item ${!isDetail ?'active':''}" onclick="window.setTaskMode('resumen')" style="padding: 0.4rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${!isDetail?'var(--primary)':'var(--text-muted)'}; font-weight:${!isDetail?'800':'500'}; border-bottom:${!isDetail?'2px solid var(--primary)':'none'}; text-decoration:none;">📊 RESUMEN</a>
                <a class="sub-sub-nav-item ${isDetail?'active':''}" onclick="window.setTaskMode('detalle')" style="padding: 0.4rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${isDetail?'var(--primary)':'var(--text-muted)'}; font-weight:${isDetail?'800':'500'}; border-bottom:${isDetail?'2px solid var(--primary)':'none'}; text-decoration:none;">🔍 DETALLE</a>
            </nav>
            <div style="display:${isDetail ? 'none' : 'flex'}; gap:12px; align-items:center;">
                <button id="btn_refresh_almacenaje" title="Refrescar Datos" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--primary)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.1)'">
                    🔄
                </button>
                <button id="btn_open_shift_new" class="btn" style="width:auto; background:rgba(34, 197, 94, 0.1); color:#22c55e; border:1px solid rgba(34, 197, 94, 0.3); padding:6px 12px; font-size:0.7rem; font-weight:700;">⚙️ PROCESAR TAREAS</button>
                <button onclick="window.clearCurrentShiftTasks()" class="btn" style="width:auto; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); padding:6px 10px; font-size:0.7rem;" title="Limpiar Tareas Pendientes">🗑️</button>
                <button onclick="window.exportAlmacenajeExcel()" class="btn" style="width:auto; padding:6px 14px; font-size:0.7rem; background:var(--primary); color:#fff; font-weight:800; border:none; box-shadow:0 4px 12px rgba(79,70,229,0.3);">📥 EXCEL TAREAS</button>
            </div>
            ` : `
            <div style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; color:var(--primary); font-size:0.8rem; font-weight:800; letter-spacing:1px; text-transform:uppercase;">📊 Panel de Rendimiento Individual</h4>
                <div style="font-size:0.75rem; color:var(--text-muted);">Módulo de Analítica Avanzada</div>
            </div>
            `}
        </div>

        <div style="display:grid; grid-template-columns: 240px 1fr; gap:1.5rem; height:calc(100vh - 280px);">
            <!-- SIDEBAR UNIFICADO -->
            <div style="background:rgba(15, 23, 42, 0.4); border-radius:12px; padding:1.2rem; border:1px solid rgba(255,255,255,0.05); border-left: 3px solid var(--primary); box-shadow: 0 4px 20px rgba(0,0,0,0.3); overflow-y:auto;">
                <h4 style="margin:0 0 1.2rem 0; font-size:0.85rem; color:#fff; font-weight:800; letter-spacing:1px;">Historial</h4>
                <div style="font-size:0.8rem;">
                    <div onclick="window.setSelectedDate(null)" style="padding:10px 15px; background:${!selectedTaskDate ? 'var(--primary)' : 'rgba(255,255,255,0.03)'}; color:#fff; border-radius:10px; font-weight:700; margin-bottom:15px; cursor:pointer; font-size:0.75rem; text-align:center;">Todas las Tareas</div>
                    ${sidebarHtml}
                </div>
            </div>

            <!-- CONTENIDO PRINCIPAL -->
            <div style="display:flex; flex-direction:column; gap:1rem; overflow-y:auto;">
                ${isKpi ? `
        <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:1.5rem;">
            <!-- REPORTE PRODUCTIVIDAD INDIVIDUAL (ESTILO NEON) -->
            <div style="background:rgba(15,23,42,0.9); border:2px solid var(--primary); border-radius:12px; overflow:hidden; box-shadow: 0 0 25px rgba(79,70,229,0.2);">
                <div style="padding:1rem; background:rgba(79,70,229,0.1); border-bottom:1px solid rgba(79,70,229,0.3); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="color:#fff; font-weight:800; margin:0; font-size:1rem; letter-spacing:1px; text-transform:uppercase;">
                        📊 PRODUCTIVIDAD <span style="font-size:0.7rem; opacity:0.6; margin-left:10px;">${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</span>
                    </h3>
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.5); font-weight:600;">FILTRO: ${selectedTaskDate || 'TODAS'}</div>
                </div>
                
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; color:#eee;">
                        <thead style="background:rgba(0,0,0,0.8); position:sticky; top:0; z-index:10;">
                            <tr style="color:rgba(255,255,255,0.7); text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; border-bottom:1px solid rgba(79,70,229,0.3);">
                                <th style="padding:1rem; text-align:left;">Fecha</th>
                                <th style="padding:1rem; text-align:left;">Usuario</th>
                                <th style="padding:1rem; text-align:center;">Unid. Indiv.</th>
                                <th style="padding:1rem; text-align:left;">Inicio</th>
                                <th style="padding:1rem; text-align:left;">Termino</th>
                                <th style="padding:1rem; text-align:center;">Tiempo</th>
                                <th style="padding:1rem; text-align:center;">Rendimiento %</th>
                                <th style="padding:1rem; text-align:center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const indRows = [];
                                tasks.filter(t => !selectedTaskDate || t.fecha === selectedTaskDate).forEach(t => {
                                    if (!t.inicio || !t.termino || t.status !== 'Finalizado') return;

                                    const s = new Date(t.inicio);
                                    const e = new Date(t.termino);
                                    let ms = e - s;

                                    // Descontar break si aplica
                                    const shiftDate = (s.getHours() < 12) ? new Date(s.getTime() - 12*60*60*1000) : s;
                                    const bStart = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 0, 0);
                                    const bEnd = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 50, 0);
                                    const overlapStart = Math.max(s, bStart);
                                    const overlapEnd = Math.min(e, bEnd);
                                    const overlap = Math.max(0, overlapEnd - overlapStart);
                                    ms = ms - overlap;

                                    const totalMinutes = Math.floor(ms / (1000 * 60));
                                    if (totalMinutes <= 0) return;

                                    const timeStr = `${Math.floor(totalMinutes/60).toString().padStart(2,'0')}:${(totalMinutes%60).toString().padStart(2,'0')}`;
                                    const uList = [t.u1, t.u2].filter(u => u && u !== '---');
                                    
                                    if (uList.length === 2) {
                                        const q1 = Math.ceil(t.qty / 2);
                                        const q2 = Math.floor(t.qty / 2);
                                        [ {u:t.u1, q:q1}, {u:t.u2, q:q2} ].forEach(entry => {
                                            const uph = (entry.q / totalMinutes) * 60;
                                            const pct = Math.round((uph / 150) * 100);
                                            indRows.push({
                                                fecha: t.fecha,
                                                user: entry.u,
                                                qty: entry.q,
                                                inicio: t.inicio,
                                                termino: t.termino,
                                                time: timeStr,
                                                pct: pct,
                                                ok: uph >= 150
                                            });
                                        });
                                    } else if (uList.length === 1) {
                                        const uph = (t.qty / totalMinutes) * 60;
                                        const pct = Math.round((uph / 150) * 100);
                                        indRows.push({
                                            fecha: t.fecha,
                                            user: uList[0],
                                            qty: t.qty,
                                            inicio: t.inicio,
                                            termino: t.termino,
                                            time: timeStr,
                                            pct: pct,
                                            ok: uph >= 150
                                        });
                                    }
                                });

                                if (indRows.length === 0) return `<tr><td colspan="8" style="padding:4rem; text-align:center; color:rgba(255,255,255,0.2);">No hay datos de productividad finalizados para mostrar.</td></tr>`;

                                // [MOD v17.1.5] Ordenar alfabéticamente por usuario para fácil localización
                                indRows.sort((a, b) => a.user.localeCompare(b.user));

                                return indRows.map(r => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02); transition: all 0.2s;">
                                        <td style="padding:0.8rem 1rem; opacity:0.6;">${r.fecha.split('-').reverse().join('/')}</td>
                                        <td style="padding:0.8rem 1rem;"><b style="color:#fff; text-transform:uppercase;">${r.user}</b></td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:var(--primary); font-weight:800;">${r.qty.toLocaleString()}</td>
                                        <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${new Date(r.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                        <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${new Date(r.termino).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                        <td style="padding:0.8rem 1rem; text-align:center; font-weight:700; color:#fff;">${r.time}</td>
                                        <td style="padding:0.8rem 1rem; text-align:center;">
                                            <div style="width:100%; height:4px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:4px;">
                                                <div style="width:${Math.min(r.pct, 100)}%; height:100%; background:${r.ok?'#22c55e':'#ef4444'}; border-radius:10px; box-shadow: 0 0 10px ${r.ok?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'}"></div>
                                            </div>
                                            <span style="font-size:0.7rem; font-weight:800; color:${r.ok?'#22c55e':'#ef4444'};">${r.pct}%</span>
                                        </td>
                                        <td style="padding:0.8rem 1rem; text-align:center;">
                                            <span style="background:${r.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color:${r.ok ? '#22c55e' : '#ef4444'}; padding:4px 10px; border-radius:10px; font-weight:900; font-size:0.65rem; border:1px solid ${r.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}">
                                                ${r.ok ? 'CUMPLIÓ' : 'BAJO PROMEDIO'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
                
                <div style="padding:1rem; background:rgba(0,0,0,0.3); border-top:1px solid rgba(79,70,229,0.2); display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.4);">* Base de medición: 150 Unid/Hora por usuario (Equivalente a 300 Unid/Hora grupal)</div>
                    <button class="btn" style="width:auto; padding:6px 12px; font-size:0.7rem; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid #10b981;">📥 EXPORTAR KPI</button>
                </div>
                </div>
            ` : `


                <div class="glass-panel" style="padding:0; overflow:auto; flex:1; border:1px solid rgba(79, 70, 229, 0.3); background:rgba(15, 23, 42, 0.4); border-radius:12px; box-shadow: 0 0 20px rgba(79, 70, 229, 0.15);">
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem; color:#d1d5db;">
                        <thead style="position:sticky; top:0; background:#1e293b; z-index:10; border-bottom:1px solid rgba(255,255,255,0.1);">
                            ${!isDetail ? `
                                <tr>
                                    <th style="padding:1rem; text-align:left;">Fecha</th>
                                    <th style="padding:1rem; text-align:left;">IdTarea</th>
                                    <th style="padding:1rem; text-align:center;">Qty</th>
                                    <th style="padding:1rem; text-align:left;">Marca</th>
                                    <th style="padding:1rem; text-align:left;">Usuario1</th>
                                    <th style="padding:1rem; text-align:left;">Usuario2</th>
                                    <th style="padding:1rem; text-align:left;">Hora Inicio</th>
                                    <th style="padding:1rem; text-align:left;">Hora Termino</th>
                                    <th style="padding:1rem; text-align:center;">Productividad</th>
                                    <th style="padding:1rem; text-align:center;">Objetivo</th>
                                    <th style="padding:1rem; text-align:center;">Status</th>
                                    <th style="padding:1rem; text-align:center;">Acción</th>
                                </tr>
                            ` : `
                                <tr>
                                    <th style="padding:1rem; text-align:left;">Articulo</th>
                                    <th style="padding:1rem; text-align:left;">UBICACION</th>
                                    <th style="padding:1rem; text-align:left;">SKU</th>
                                    <th style="padding:1rem; text-align:center;">Tallas</th>
                                    <th style="padding:1rem; text-align:center;">Qty Buffer</th>
                                    <th style="padding:1rem; text-align:center;">Qty Zona</th>
                                    <th style="padding:1rem; text-align:left;">ID Tareas</th>
                                    <th style="padding:1rem; text-align:center;">Status</th>
                                </tr>
                            `}
                        </thead>
                        <tbody>
                            ${tasks.length === 0 ? `<tr><td colspan="12" style="padding:3rem; text-align:center; color:var(--text-muted);">No hay tareas registradas en este periodo.</td></tr>` : ''}
                            ${!isDetail ? tasks.filter(t => !selectedTaskDate || t.fecha === selectedTaskDate).map(t => {
                                let productividad = '---';
                                let objetivo = '---';
                                let objStyle = 'color:var(--text-muted);';

                                if (t.inicio && t.termino) {
                                    const s = new Date(t.inicio);
                                    const e = new Date(t.termino);
                                    let ms = e - s;

                                    const shiftDate = (s.getHours() < 12) ? new Date(s.getTime() - 12*60*60*1000) : s;
                                    const bStart = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 0, 0);
                                    const bEnd = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 50, 0);

                                    const overlapStart = Math.max(s, bStart);
                                    const overlapEnd = Math.min(e, bEnd);
                                    const overlap = Math.max(0, overlapEnd - overlapStart);
                                    
                                    ms = ms - overlap;

                                    const totalMinutes = Math.floor(ms / (1000 * 60));
                                    const h = Math.floor(totalMinutes / 60);
                                    const m = totalMinutes % 60;
                                    productividad = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                                    if (totalMinutes > 0) {
                                        const unitsPerHour = (t.qty / totalMinutes) * 60;
                                        if (unitsPerHour >= 300) {
                                            objetivo = 'CUMPLIÓ';
                                            objStyle = 'color:#22c55e; font-weight:900; background:rgba(34,197,94,0.1); padding:4px 10px; border-radius:10px;';
                                        } else {
                                            objetivo = 'NO CUMPLIÓ';
                                            objStyle = 'color:#ef4444; font-weight:900; background:rgba(239,68,68,0.1); padding:4px 10px; border-radius:10px;';
                                        }
                                    }
                                }
                                return `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer;" onclick="window.assignTask('${t.id}')">
                                    <td style="padding:0.8rem 1rem;">${t.fecha.split('-').reverse().join('/')}</td>
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:600;">${t.id}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center;">${t.qty.toLocaleString()}</td>
                                    <td style="padding:0.8rem 1rem;">${t.marca}</td>
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:800; background:rgba(79,70,229,0.05);">${t.u1 || '---'}</td>
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:800; opacity:0.8;">${t.u2 || '---'}</td>
                                    <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${t.inicio ? new Date(t.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                                    <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${t.termino ? new Date(t.termino).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center; color:#fff; font-weight:900; font-size:1rem;">${productividad}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center; font-size:0.7rem;"><span style="${objStyle}">${objetivo}</span></td>
                                    <td style="padding:0.8rem 1rem; text-align:center;">
                                        <span style="background:${t.status === 'Finalizado' ? 'rgba(34,197,94,0.1)' : t.status === 'Asignado' ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.05)'}; color:${t.status === 'Finalizado' ? '#22c55e' : t.status === 'Asignado' ? '#eab308' : 'var(--text-muted)'}; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.7rem;">
                                            ${t.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style="padding:0.8rem 1rem; text-align:center; display:flex; gap:8px; justify-content:center;" onclick="event.stopPropagation()">
                                        <button onclick="window.resetTask('${t.id}')" title="Reiniciar Tarea" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#60a5fa;">🔄</button>
                                        <button onclick="window.deleteTask('${t.id}')" title="Eliminar Tarea" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#ef4444;">🗑️</button>
                                    </td>
                                </tr>`;
                            }).join('') : tasks.filter(t => !selectedTaskDate || t.fecha === selectedTaskDate).flatMap(t => t.items.flatMap(art => {
                                // [STABLE] Recuperar información optimizada del mapa pre-calculado
                                const bufferItems = art.items;
                                const bufferUbis = new Set(bufferItems.map(bi => bi.ubi));
                                const uniqueSkus = [...new Set(bufferItems.map(i => i.skuFull))];
                                const otherZoneItems = [];
                                
                                uniqueSkus.forEach(sku => {
                                    const stockItems = otherZonesStockMap.get(sku) || [];
                                    stockItems.forEach(item => {
                                        if (!bufferUbis.has(item.ubi)) {
                                            otherZoneItems.push(item);
                                        }
                                    });
                                });

                                const allItems = [...bufferItems, ...otherZoneItems]
                                    .filter(i => {
                                        const ubi = String(i.ubi || '').toUpperCase();
                                        // 1. REGLA CDBUFFER: Solo si es CDBUFFER pero NO CDBUFFER-C
                                        if (ubi.startsWith('CDBUFFER')) {
                                            return !ubi.startsWith('CDBUFFER-C');
                                        }
                                        // 2. REGLA ZONAS PERMITIDAS: SEL, MZN01, MZN02, MZN03, MZN04
                                        const allowedPrefixes = ['SEL-', 'MZN01-', 'MZN02-', 'MZN03-', 'MZN04-'];
                                        return allowedPrefixes.some(p => ubi.startsWith(p));
                                    })
                                    .sort((a, b) => {
                                        // PRIORIDAD: CDBUFFER PRIMERO
                                        const isABuffer = a.ubi.startsWith('CDBUFFER');
                                        const isBBuffer = b.ubi.startsWith('CDBUFFER');
                                        if (isABuffer && !isBBuffer) return -1;
                                        if (!isABuffer && isBBuffer) return 1;
                                        return 0;
                                    });

                                return allItems.map(i => {
                                    const isBuffer = i.ubi.startsWith('CDBUFFER');
                                    return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                        <td style="padding:0.6rem 1rem;">${art.sku7}</td>
                                        <td style="padding:0.6rem 1rem; color:#fff !important; font-weight:${isBuffer ? '800' : '500'};">
                                            ${i.ubi}
                                        </td>
                                        <td style="padding:0.6rem 1rem;">${i.skuFull}</td>
                                        <td style="padding:0.6rem 1rem; text-align:center;">${(dataStore.tabla_tallas && dataStore.tabla_tallas[i.skuFull]) || (i.skuFull && i.skuFull.split('-').pop()) || '<span style="color:#ef4444; font-size:0.7rem;">S/TALLA</span>'}</td>
                                        <td style="padding:0.6rem 1rem; text-align:center; font-weight:700; color:${isBuffer ? '#fff' : 'transparent'};">${isBuffer ? i.qty : ''}</td>
                                        <td style="padding:0.6rem 1rem; text-align:center; font-weight:800; color:${!isBuffer ? '#fbbf24' : 'rgba(255,255,255,0.05)'};">${!isBuffer ? i.qty : '---'}</td>
                                        <td style="padding:0.6rem 1rem; color:#fff; font-weight:600;">${t.id}</td>
                                        <td style="padding:0.6rem 1rem; text-align:center;">
                                            <span style="background:${t.status === 'Finalizado' ? 'rgba(34,197,94,0.1)' : t.status === 'Asignado' ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.05)'}; color:${t.status === 'Finalizado' ? '#22c55e' : t.status === 'Asignado' ? '#eab308' : 'var(--text-muted)'}; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.7rem;">
                                                ${t.status.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>`;
                                });
                            })).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 1rem; background:rgba(15, 23, 42, 0.4); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; gap:1.5rem; font-size:0.75rem;">
                        <span style="color:var(--text-muted);">Tareas: <b style="color:#fff;">${tasks.length}</b></span>
                        <span style="color:var(--text-muted);">Pares Totales: <b style="color:#fff;">${tasks.reduce((s,t) => s+t.qty, 0).toLocaleString()}</b></span>
                    </div>
                </div>
            </div>
        `}
    </div>
</div>
    `;

    window.setTaskMode = (mode) => { almacenajeTaskMode = mode; localStorage.setItem('almacenajeTaskMode', mode); renderAlmacenajeTareas(container); };
    window.processAlmacenajeTasks = () => { if (confirm("¿Deseas procesar el stock actual para generar tareas? Esto se acumulará en el historial.")) processAlmacenajeTasks(); };
    window.exportAlmacenajeExcel = () => { exportAlmacenajeExcel(); };
    window.resetTask = (id) => {
        if (confirm(`¿Reiniciar la tarea ${id}? Se borrarán los usuarios y horas asignadas.`)) {
            const t = almacenajeTasksCache.find(x => x.id === id);
            if (t) {
                t.u1 = ''; t.u2 = ''; t.inicio = ''; t.termino = ''; t.status = 'Creada';
                saveAlmacenajeTasks();
                renderAlmacenajeTareas(container);
            }
        }
    };
    window.deleteTask = (id) => {
        if (confirm(`¿ESTÁS SEGURO DE ELIMINAR LA TAREA ${id}?\n\nEsta acción es permanente y se borrará de todos los terminales.`)) {
            almacenajeTasksCache = almacenajeTasksCache.filter(x => x.id !== id);
            saveAlmacenajeTasks();
            renderAlmacenajeTareas(container);
        }
    };
    window.assignTask = (id) => {
        // [ORDENAMIENTO A-Z] Ordenar operarios alfabéticamente
        const workers = adminService.getWorkers()
            .filter(w => w.active)
            .sort((a, b) => (a.nombre || a.Nombre || '').localeCompare(b.nombre || b.Nombre || ''));
        const formatUser = (w) => {
            const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
            const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
            return nom ? `${nom[0]}${ape}` : 's/n';
        };

        const options = workers.map(w => `<option value="${formatUser(w)}" ${formatUser(w) === 'dames' ? 'selected' : ''}>${formatUser(w)} (${w.nombre})</option>`).join('');
        const t = almacenajeTasksCache.find(x => x.id === id);

        const modal = document.createElement('div');
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
        modal.innerHTML = `
            <div class="glass-panel" style="width:380px; padding:2rem; border:1px solid var(--primary); border-radius:16px;">
                <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; text-align:center;">Asignar Tarea: <span style="color:var(--primary);">${id}</span></h3>
                <div style="display:flex; flex-direction:column; gap:1.2rem;">
                    <div>
                        <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:6px;">Usuario 1 (Obligatorio)</label>
                        <select id="m_u1" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2); padding:0.8rem; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.9rem;">
                            <option value="" style="background:#0f172a;">Seleccionar operario...</option>
                            ${options}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:6px;">Usuario 2 (Opcional)</label>
                        <select id="m_u2" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2); padding:0.8rem; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.9rem;">
                            <option value="" style="background:#0f172a;">Ninguno</option>
                            ${options}
                        </select>
                    </div>
                    <div style="margin-top:1rem; display:flex; gap:10px;">
                        <button id="m_save" class="btn" style="flex:1; padding:0.8rem; font-size:0.75rem; font-weight:800;">ASIGNAR E INICIAR</button>
                        ${t.status === 'Asignado' ? `<button id="m_finish" class="btn" style="flex:1; background:#22c55e; padding:0.8rem; font-size:0.75rem; font-weight:800;">FINALIZAR</button>` : ''}
                    </div>
                    <button id="m_close" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.7rem; margin-top:0.5rem; width:100%;">Cerrar sin cambios</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Cargar valores previos si existen
        if (t.u1) document.getElementById('m_u1').value = t.u1;
        if (t.u2) document.getElementById('m_u2').value = t.u2;

        document.getElementById('m_save').onclick = () => {
            const u1 = document.getElementById('m_u1').value;
            if (!u1) { alert("Usuario 1 es obligatorio."); return; }
            t.u1 = u1;
            t.u2 = document.getElementById('m_u2').value;
            t.status = 'Asignado';
            if (!t.inicio) t.inicio = new Date().toISOString();
            saveAlmacenajeTasks(); 
            document.body.removeChild(modal);
            renderAlmacenajeTareas(container);
        };
        if (document.getElementById('m_finish')) {
            document.getElementById('m_finish').onclick = () => {
                t.status = 'Finalizado';
                t.termino = new Date().toISOString();
                saveAlmacenajeTasks().then(() => {
                    document.body.removeChild(modal);
                    renderAlmacenajeTareas(container);
                });
            };
        }
        document.getElementById('m_close').onclick = () => document.body.removeChild(modal);
    };

    window.toggleWeek = (w) => {
        if (expandedWeeks.includes(w)) {
            expandedWeeks = expandedWeeks.filter(x => x !== w);
        } else {
            expandedWeeks.push(w);
        }
        renderAlmacenajeTareas(container);
    };

    window.setSelectedDate = (d) => {
        selectedTaskDate = d;
        renderAlmacenajeTareas(container);
    };

    window.openShiftModal = () => {
        try {
            const logicalDate = getLogicalDate();
            const modal = document.createElement('div');
            modal.id = "modal_fecha_operativa";
            modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
            modal.innerHTML = `
                <div class="glass-panel" style="width:450px; padding:2.5rem; border:1px solid var(--primary); border-radius:20px; box-shadow: 0 0 50px rgba(79, 70, 229, 0.4); pointer-events:auto !important;">
                    <div style="text-align:center; margin-bottom:2rem;">
                        <h2 style="color:#fff; margin:0; font-size:1.5rem; font-weight:800;">Fecha Operativa</h2>
                        <p style="color:var(--text-muted); font-size:0.9rem; margin-top:8px;">Indica la fecha para este procesamiento de tareas</p>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px;">
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <label style="color:var(--primary); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Seleccionar Fecha del Calendario:</label>
                            <input type="date" id="manual_op_date" value="${logicalDate}" 
                                style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px; border-radius:10px; font-size:1.1rem; font-weight:700; outline:none; color-scheme:dark;">
                        </div>

                        <button id="optUpdate" class="btn" style="padding:1.2rem; font-weight:800; background:linear-gradient(135deg, var(--primary), #6366f1); border:none; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3); margin-top:10px;">
                            PROCESAR TAREAS
                        </button>
                        
                        <button id="optCancel" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; text-decoration:underline;">
                            Cerrar ventana
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#optUpdate').onclick = () => {
                const selectedDate = modal.querySelector('#manual_op_date').value;
                if (!selectedDate) { alert("⚠️ Por favor selecciona una fecha."); return; }
                document.body.removeChild(modal);
                window.processAlmacenajeTasks('update', selectedDate);
            };
            modal.querySelector('#optCancel').onclick = () => document.body.removeChild(modal);
        } catch (err) {
            alert("❌ Error crítico al abrir calendario: " + err.message);
            console.error(err);
        }
    };

    window.processAlmacenajeTasks = processAlmacenajeTasks;

    window.clearCurrentShiftTasks = () => {
        if (confirm(`⚠️ ¿Borrar TODAS las tareas con status "CREADA" de todo el historial?\n\n(Esta acción es global y no importa la fecha. No se borrarán tareas asignadas o finalizadas)`)) {
            almacenajeTasksCache = almacenajeTasksCache.filter(t => t.status !== 'Creada');
            saveAlmacenajeTasks();
            renderAlmacenajeTareas(container);
        }
    };

    window.setTaskMode = (mode) => {
        almacenajeTaskMode = mode;
        localStorage.setItem('almacenajeTaskMode', mode);
        renderAlmacenajeTareas(container);
    };

    // --- Lógica del Botón de Procesar Tareas (NUEVO VÍNCULO) ---
    const btnOpen = document.getElementById('btn_open_shift_new');
    if (btnOpen) {
        btnOpen.onclick = () => {
            if (window.openShiftModal) window.openShiftModal();
            else alert("❌ Error: Función no cargada.");
        };
    }

    // --- Lógica del Botón de Refresco Local ---
    const btnRef = document.getElementById('btn_refresh_almacenaje');
    if (btnRef) {
        btnRef.onclick = async () => {
            const oldInner = btnRef.innerHTML;
            btnRef.innerHTML = '⌛';
            btnRef.style.pointerEvents = 'none';
            btnRef.style.opacity = '0.5';
            
            try {
                console.log("🔄 [PULSE] Forzando descarga limpia desde la nube...");
                // 1. Limpiar rastro local para forzar lectura de servidor
                localStorage.removeItem('logistics_admin_v11_almacenaje_tasks');
                
                // 2. Sincronizar con el servidor (PULL GLOBAL DIRECTO)
                await adminService.initializeAdminData();
                const serverTasks = adminService.adminStore.almacenaje_tasks;
                
                if (Array.isArray(serverTasks)) {
                    almacenajeTasksCache = [...serverTasks];
                    localStorage.setItem('logistics_admin_v11_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
                    console.log(`✅ [PULSE] ${serverTasks.length} tareas sincronizadas.`);
                }
                
                renderAlmacenajeTareas(container);
                
                // Feedback de éxito
                btnRef.innerHTML = '✅';
                setTimeout(() => { 
                    btnRef.innerHTML = '🔄';
                    btnRef.style.pointerEvents = 'auto';
                    btnRef.style.opacity = '1';
                }, 1500);

            } catch (e) {
                console.error("❌ Error en refresco:", e);
                btnRef.innerHTML = '❌';
                setTimeout(() => { 
                    btnRef.innerHTML = '🔄';
                    btnRef.style.pointerEvents = 'auto';
                    btnRef.style.opacity = '1';
                }, 1500);
            }
        };
    }
  };

  renderNav();
  renderTabContent();
  startRealTimeSync();
};
