/**
 * PORTAL DE REPORTES PÚBLICOS — DEAM1830
 * Acceso via token en URL: reportes.html?token=XXXX
 * Solo lectura — sin login requerido
 * Dinámico vía Backend / LocalStorage (Configurable desde Módulo Configuración)
 * v26.5.476
 */

import {
  getAreaData, fetchBufferHistory, loadBufferReport,
  dataStore, initPersistentData, fetchKPIDates,
  loadKPIResultsRange, fetchReservaHistory
} from '../services_v245/csvHub_v6.js?v=26.5.476';

import * as adminService from '../services_v245/adminService.js?v=26.5.476';

// Catálogo Maestro de Módulos
const ALL_MODULES = [
  { id: 'inventario',  label: 'Inventario',   icon: '📦' },
  { id: 'picking',     label: 'Picking',       icon: '🧺' },
  { id: 'packing',     label: 'Packing',       icon: '📦' },
  { id: 'despacho',    label: 'Despacho',      icon: '🚚' },
  { id: 'no_retail',   label: 'NO RETAIL',     icon: '🚫' },
  { id: 'recepcion',   label: 'Recepción',     icon: '📥' },
  { id: 'almacenaje',  label: 'Almacenaje',    icon: '🗄️', subTabs: [
    { id: 'reporte_marcas',    label: '📊 Reporte Marcas' },
    { id: 'rendimiento_ops',   label: '👷 Rendimiento Operarios' },
    { id: 'produccion_hora',   label: '⏱️ Producción por Hora' },
    { id: 'almacenado_semana', label: '📅 Almacenado por Semana' },
    { id: 'grafico_rendimiento',label: '📈 Gráfico Rendimiento' },
  ]},
  { id: 'buffer',      label: 'Zona Buffer',   icon: '📊', subTabs: [
    { id: 'historial_buffer', label: '📋 Historial Buffer' },
    { id: 'analisis_buffer',  label: '🔍 Análisis Buffer' },
  ]},
  { id: 'analisis_sku', label: 'Análisis SKU', icon: '🔍' },
];

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentTab    = null;
let currentSubTab = null;
let groupInfo     = null;
let modulos       = [];
let filterStart   = '';
let filterEnd     = '';

// ============================================================
// INIT
// ============================================================
async function init() {
  const app = document.getElementById('app');

  // 1. Leer token de la URL
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token') || '';

  // Cargar datos persistentes
  try {
    await initPersistentData();
  } catch(e) {
    console.warn('[Reportes] initPersistentData falló, continuando...', e);
  }

  // 2. Cargar configuración dinámica desde Backend / LocalStorage
  const configList = adminService.getPublicReportsConfig() || [];
  groupInfo = configList.find(g => g.token === token);

  if (!groupInfo) {
    renderAccessDenied(app);
    return;
  }

  // 3. Filtrar módulos según los permisos dinámicos del grupo
  const allowedModIds = new Set(groupInfo.modulos || []);
  const allowedAlmIds = new Set(groupInfo.reportesAlmacenaje || []);
  const allowedBufIds = new Set(groupInfo.reportesBuffer || []);

  modulos = ALL_MODULES.filter(m => allowedModIds.has(m.id)).map(m => {
    const clone = { ...m };
    if (clone.id === 'almacenaje' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedAlmIds.has(s.id));
    }
    if (clone.id === 'buffer' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedBufIds.has(s.id));
    }
    return clone;
  }).filter(m => {
    if ((m.id === 'almacenaje' || m.id === 'buffer') && (!m.subTabs || m.subTabs.length === 0)) {
      return false;
    }
    return true;
  });

  if (modulos.length === 0) {
    renderAccessDenied(app, "Este enlace no tiene módulos autorizados asignados.");
    return;
  }

  // 4. Establecer fechas de filtro por defecto (semana actual)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  filterStart = weekAgo;
  filterEnd   = today;

  // 5. Tab inicial
  currentTab    = modulos[0].id;
  currentSubTab = modulos[0].subTabs ? modulos[0].subTabs[0].id : null;

  // 6. Renderizar shell
  renderShell(app);
  renderContent();
}

// ============================================================
// PANTALLA DE ACCESO DENEGADO
// ============================================================
function renderAccessDenied(app, customMsg = null) {
  document.title = 'Acceso Restringido | DEAM1830';
  app.innerHTML = `
    <div class="access-denied">
      <div class="icon">🔒</div>
      <h1>ACCESO RESTRINGIDO</h1>
      <p>${customMsg || 'Este enlace no es válido o ha sido revocado. Contacta al administrador para obtener un enlace actualizado.'}</p>
      <div class="contact">📧 Contactar al administrador del sistema</div>
    </div>`;
}

// ============================================================
// SHELL PRINCIPAL (Topbar + Tabs + Filtros + Content)
// ============================================================
function renderShell(app) {
  document.title = `Reportes ${groupInfo.nombre} | LOGÍSTICA DEAM1830`;

  app.innerHTML = `
    <!-- TOPBAR -->
    <div class="topbar">
      <div class="topbar-brand">
        <h2>LOGÍSTICA <span style="color:#818cf8">DEAM1830</span>
          <span style="font-size:11px; color:#fbbf24; font-weight:900; margin-left:4px">v26.5.476</span>
        </h2>
        <span class="topbar-badge">👁️ SOLO LECTURA</span>
      </div>
      <div class="topbar-right">
        <span class="group-badge">${groupInfo.nombre}</span>
      </div>
    </div>

    <!-- TAB NAV -->
    <div class="tab-nav" id="tabNav"></div>

    <!-- SUBTAB NAV -->
    <div class="subtab-nav" id="subTabNav" style="display:none;"></div>

    <!-- FILTER BAR -->
    <div class="filter-bar" id="filterBar">
      <label>DESDE</label>
      <input type="date" id="f_start" value="${filterStart}" />
      <label>HASTA</label>
      <input type="date" id="f_end" value="${filterEnd}" />
      <button class="btn-filter" id="btnApply">🔍 APLICAR</button>
      <button class="btn-filter" id="btnToday" style="background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.4);color:#fbbf24;">📅 HOY</button>
    </div>

    <!-- CONTENT -->
    <div class="content-area" id="contentArea">
      <div style="color:var(--text-muted); text-align:center; padding:4rem;">Cargando...</div>
    </div>`;

  buildTabNav();
  attachFilterEvents();
}

function buildTabNav() {
  const nav = document.getElementById('tabNav');
  nav.innerHTML = modulos.map(m => `
    <button class="tab-btn ${m.id === currentTab ? 'active' : ''}"
      data-tab="${m.id}">
      ${m.icon} ${m.label}
    </button>`).join('');

  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      const mod  = modulos.find(m => m.id === currentTab);
      currentSubTab = mod?.subTabs ? mod.subTabs[0].id : null;
      nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildSubTabNav();
      renderContent();
    };
  });

  buildSubTabNav();
}

function buildSubTabNav() {
  const nav  = document.getElementById('subTabNav');
  const mod  = modulos.find(m => m.id === currentTab);
  if (!mod?.subTabs || mod.subTabs.length === 0) {
    nav.style.display = 'none';
    return;
  }
  nav.style.display = 'flex';
  nav.innerHTML = mod.subTabs.map(s => `
    <button class="subtab-btn ${s.id === currentSubTab ? 'active' : ''}"
      data-sub="${s.id}">
      ${s.label}
    </button>`).join('');

  nav.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.onclick = () => {
      currentSubTab = btn.dataset.sub;
      nav.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContent();
    };
  });
}

function attachFilterEvents() {
  document.getElementById('btnApply').onclick = () => {
    filterStart = document.getElementById('f_start').value;
    filterEnd   = document.getElementById('f_end').value;
    renderContent();
  };
  document.getElementById('btnToday').onclick = () => {
    const today = new Date().toISOString().split('T')[0];
    filterStart = today;
    filterEnd   = today;
    document.getElementById('f_start').value = today;
    document.getElementById('f_end').value   = today;
    renderContent();
  };
}

// ============================================================
// ROUTER DE CONTENIDO
// ============================================================
async function renderContent() {
  const area = document.getElementById('contentArea');
  area.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:3rem;">
    <div class="spinner" style="margin:0 auto 1rem;"></div>Cargando datos...
  </div>`;

  try {
    switch(currentTab) {
      case 'inventario':  await renderAreaModule('stockActivo', 'Inventario');   break;
      case 'picking':     await renderAreaModule('picking',     'Picking');      break;
      case 'packing':     await renderAreaModule('packing',     'Packing');      break;
      case 'despacho':    await renderAreaModule('despacho',    'Despacho');     break;
      case 'no_retail':   await renderAreaModule('no_retail',   'NO RETAIL');    break;
      case 'recepcion':   await renderAreaModule('recepcion',   'Recepción');    break;
      case 'almacenaje':  await renderAlmacenajeModule(); break;
      case 'buffer':      await renderBufferModule();     break;
      case 'analisis_sku':await renderSkuModule();        break;
      default:
        area.innerHTML = `<div class="empty-msg">Módulo no disponible.</div>`;
    }
  } catch(e) {
    area.innerHTML = `<div class="empty-msg">⚠️ Error al cargar los datos: ${e.message}</div>`;
    console.error(e);
  }
}

// ============================================================
// MÓDULOS GENÉRICOS (Inventario, Picking, Packing, etc.)
// ============================================================
async function renderAreaModule(areaKey, title) {
  const area = document.getElementById('contentArea');
  const data = await getAreaData(areaKey);

  if (!data || !data.rows || data.rows.length === 0) {
    area.innerHTML = `
      <div class="report-card">
        <div class="report-title">📦 ${title}</div>
        <div class="empty-msg">No hay datos cargados para este módulo.</div>
      </div>`;
    return;
  }

  const headers = data.headers || [];
  const dateCol = headers.findIndex(h =>
    /fecha/i.test(String(h)) || /date/i.test(String(h))
  );

  let rows = data.rows || [];
  if (dateCol >= 0 && filterStart && filterEnd) {
    rows = rows.filter(r => {
      const v = String(r[dateCol] || '').substring(0, 10);
      return v >= filterStart && v <= filterEnd;
    });
  }

  const PAGE = 100;
  const total = rows.length;
  const displayed = rows.slice(0, PAGE);

  area.innerHTML = `
    <div class="report-card">
      <div class="report-title">📦 ${title.toUpperCase()}</div>
      <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.8rem;">
        Mostrando ${displayed.length} de ${total} registros
        ${filterStart === filterEnd
          ? `· Fecha: ${filterStart}`
          : `· Rango: ${filterStart} → ${filterEnd}`}
      </div>
      <div style="overflow-x:auto;">
        <table class="rpt">
          <thead>
            <tr>
              ${headers.map(h => `<th style="text-align:left; padding:6px 8px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${displayed.map(row => `
              <tr>
                ${headers.map((_, i) => `<td>${row[i] ?? ''}</td>`).join('')}
              </tr>`).join('')}
            ${total > PAGE ? `
              <tr>
                <td colspan="${headers.length}" style="padding:1rem; text-align:center; color:var(--amber); font-weight:700; font-size:0.75rem;">
                  ⚠️ Se muestran los primeros ${PAGE} registros. Aplica un filtro de fecha para reducir el rango.
                </td>
              </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
// MÓDULO ALMACENAJE
// ============================================================
async function renderAlmacenajeModule() {
  switch(currentSubTab) {
    case 'reporte_marcas':     renderMarcasReport();    break;
    case 'rendimiento_ops':    renderRendimientoOps();  break;
    case 'produccion_hora':    renderProduccionHora();  break;
    case 'almacenado_semana':  renderAlmacenadoSemana(); break;
    case 'grafico_rendimiento': renderGraficoRendimiento(); break;
    default:                   renderMarcasReport();
  }
}

function getAlmacenajeTasks() {
  const fromStore = adminService.adminStore?.almacenaje_tasks;
  if (Array.isArray(fromStore) && fromStore.length > 0) return fromStore;
  try {
    const raw = localStorage.getItem('logistics_sync_v24_almacenaje_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getFilteredTasks() {
  return getAlmacenajeTasks().filter(t =>
    (!filterStart || t.fecha >= filterStart) &&
    (!filterEnd   || t.fecha <= filterEnd)
  );
}

function getPctHtml(avance, buffer) {
  const p   = buffer > 0 ? Math.round((avance / buffer) * 100) : 0;
  const col = p === 0 ? '#ef4444' : (avance < buffer ? '#fbbf24' : '#22c55e');
  const ic  = p === 0 ? '●' : '▲';
  return `<span style="color:${col};font-weight:800;font-size:0.75rem;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;">
    <span>${ic}</span><span>${p}%</span></span>`;
}

function renderMarcasReport() {
  const area = document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  window.__kpiStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__kpiEndDate = filterEnd || new Date().toISOString().split('T')[0];
  area.innerHTML = `console.error("marcas not found");`;
}

function renderRendimientoOperarios() {
  const area = document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  const filteredTasks = tasks.filter(t => t.fecha >= filterStart && t.fecha <= filterEnd);
  const weeklyDailyTasks = tasks;
  window.__kpiStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__kpiEndDate = filterEnd || new Date().toISOString().split('T')[0];
  area.innerHTML = `console.error("operarios not found");`;
}

function renderProduccionHora() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__kpiStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__kpiEndDate = filterEnd || new Date().toISOString().split('T')[0];
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 PRODUCCIÓN POR HORA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  console.error("hourly not found");
}

function renderAlmacenadoSemana() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__kpiStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__kpiEndDate = filterEnd || new Date().toISOString().split('T')[0];
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 ALMACENADO POR SEMANA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  
    const getWeekNumber = (d) => {
        const date = new Date(d);
        const dUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        dUTC.setUTCDate(dUTC.getUTCDate() + 4 - (dUTC.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1));
        return Math.ceil((((dUTC - yearStart) / 86400000) + 1) / 7);
    };

  console.error("weekly not found");
}

function renderGraficoRendimiento() {
  const area = document.getElementById('contentArea');
  const tasksList = getFilteredTasks().filter(t => t.status === 'Finalizado');
  window.__chartStartDate = filterStart || new Date().toISOString().split('T')[0];
  window.__chartEndDate = filterEnd || new Date().toISOString().split('T')[0];
  
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📊 GRÁFICO DE RENDIMIENTO</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  
    const getWeekNumber = (d) => {
        const date = new Date(d);
        const dUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        dUTC.setUTCDate(dUTC.getUTCDate() + 4 - (dUTC.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(), 0, 1));
        return Math.ceil((((dUTC - yearStart) / 86400000) + 1) / 7);
    };

  
        const chartWeeksData = {};

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            area.innerHTML = `Semana ${weekNo} (${parts[0]})`;
        };

        const getDayIndex = (dateStr) => {
            if (!dateStr) return -1;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return -1;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const day = d.getDay();
            return day === 0 ? 6 : day - 1;
        };

        const getActiveDayIndices = (startStr, endStr) => {
            if (!startStr || !endStr) return [0, 1, 2, 3, 4, 5];
            const startParts = startStr.split('-');
            const endParts = endStr.split('-');
            if (startParts.length !== 3 || endParts.length !== 3) return [0, 1, 2, 3, 4, 5];
            
            const startObj = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
            const endObj = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
            
            if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) return [0, 1, 2, 3, 4, 5];
            
            // Si el rango es de 7 días o más, mostramos la semana completa
            const diffTime = Math.abs(endObj - startObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 6) {
                return [0, 1, 2, 3, 4, 5];
            }
            
            const active = new Set();
            let current = new Date(startObj.getTime());
            while (current <= endObj) {
                const day = current.getDay();
                const idx = day === 0 ? 6 : day - 1;
                if (idx !== 6) active.add(idx);
                current.setDate(current.getDate() + 1);
            }
            return Array.from(active).sort((a, b) => a - b);
        };

        const getTaskMetrics = (t) => {
            let qtyBuffer = 0;
            let avance = 0;
            (t.items || []).forEach(art => {
                const bufferItems = art.items || [];
                const cdbufferItems = bufferItems.filter(i => {
                    const ubi = String(i.ubi || '').toUpperCase();
                    return ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C');
                });

                cdbufferItems.forEach(i => {
                    const qty = parseFloat(i.qty) || 0;
                    qtyBuffer += qty;
                    if (t.status === 'Finalizado') {
                        avance += (i.avance !== undefined && i.avance !== null) ? parseFloat(i.avance) : qty;
                    }
                });
            });
            return { qtyBuffer, avance };
        };

        // dynamic default dates
        let minDate = '';
        let maxDate = '';
        tasksList.forEach(t => {
            if (t.status === 'Finalizado' && t.fecha) {
                if (!minDate || t.fecha < minDate) minDate = t.fecha;
                if (!maxDate || t.fecha > maxDate) maxDate = t.fecha;
            }
        });

        if (!window.__chartStartDate || !window.__chartEndDate) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.getTime());
            monday.setDate(diff);
            monday.setHours(0,0,0,0);
            const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
            
            const toYYYYMMDD = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            
            window.__chartStartDate = toYYYYMMDD(monday);
            window.__chartEndDate = toYYYYMMDD(sunday);
        }

        const startDate = window.__chartStartDate || '';
        const endDate = window.__chartEndDate || '';

        const chartTasks = tasksList.filter(t => {
            if (!t.fecha) return false;
            if (startDate && t.fecha < startDate) return false;
            if (endDate && t.fecha > endDate) return false;
            return true;
        });

        chartTasks.forEach(t => {
            const weekStr = getWeekStr(t.fecha);
            const dayIdx = getDayIndex(t.fecha);
            if (weekStr === '---' || dayIdx === -1) return;
            
            if (!chartWeeksData[weekStr]) {
                chartWeeksData[weekStr] = {
                    qtyBuffer: [0, 0, 0, 0, 0, 0, 0],
                    avance: [0, 0, 0, 0, 0, 0, 0]
                };
            }
            const metrics = getTaskMetrics(t);
            chartWeeksData[weekStr].qtyBuffer[dayIdx] += metrics.qtyBuffer;
            chartWeeksData[weekStr].avance[dayIdx] += metrics.avance;
        });

        const activeWeeks = Object.keys(chartWeeksData).sort((a, b) => {
            const getVal = (s) => {
                const m = s.match(/Semana (\d+) \((\d+)\)/);
                if (!m) return 0;
                return parseInt(m[2]) * 100 + parseInt(m[1]);
            };
            return getVal(a) - getVal(b);
        });

        const displayWeeks = activeWeeks;

        setTimeout(() => {
            const ctx = document.getElementById('weeklyDailyChartCanvas');
            if (!ctx) {
                console.warn("⚠️ Canvas element 'weeklyDailyChartCanvas' not found in DOM yet.");
                return;
            }
            
            if (window.weeklyDailyChartInstance) {
                try {
                    window.weeklyDailyChartInstance.destroy();
                } catch(e) {
                    console.error("Error destroying chart instance:", e);
                }
            }
            
            if (typeof Chart === 'undefined') {
                console.error("❌ Chart.js is not loaded.");
                return;
            }
            
            const activeIndices = getActiveDayIndices(startDate, endDate);
            const allLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const chartLabels = allLabels.filter((_, idx) => activeIndices.includes(idx));

            const datasets = [];
            displayWeeks.forEach((week, idx) => {
                const labelSuffix = displayWeeks.length > 1 ? ` (${week})` : '';
                
                // Qty Buffer dataset
                const bufferColor = { border: '#00E5FF', bg: 'rgba(0, 229, 255, 0.05)' };
                const filteredBufferData = chartWeeksData[week].qtyBuffer.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Qty Buffer${labelSuffix}`,
                    data: filteredBufferData,
                    borderColor: bufferColor.border,
                    backgroundColor: bufferColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: bufferColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });

                // Avance dataset
                const avanceColor = { border: '#eab308', bg: 'rgba(234, 179, 8, 0.05)' };
                const filteredAvanceData = chartWeeksData[week].avance.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Avance${labelSuffix}`,
                    data: filteredAvanceData,
                    borderColor: avanceColor.border,
                    backgroundColor: avanceColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: avanceColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });
            });

            if (displayWeeks.length > 0) {
                let totalSum = 0;
                let totalDays = 0;
                displayWeeks.forEach(week => {
                    activeIndices.forEach(idx => {
                        totalSum += chartWeeksData[week].qtyBuffer[idx] || 0;
                        totalDays++;
                    });
                });
                const overallAverage = totalDays > 0 ? Math.round(totalSum / totalDays) : 0;
                const averageData = activeIndices.map(() => overallAverage);
                
                datasets.push({
                    label: 'Promedio',
                    data: averageData,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false
                });
            }
            
            const datalabelsPlugin = {
                id: 'datalabels',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                        if (dataset.label === 'Promedio') return;
                        const meta = chart.getDatasetMeta(i);
                        if (meta.hidden) return;
                        meta.data.forEach((point, index) => {
                            const val = dataset.data[index];
                            if (val === undefined || val === null) return;
                            
                            ctx.save();
                            ctx.fillStyle = dataset.borderColor || '#ffffff';
                            ctx.font = 'bold 11px "Inter", sans-serif';
                            let yOffset = -8;
                            ctx.textBaseline = 'bottom';
                            if (i % 2 !== 0) {
                                ctx.textBaseline = 'top';
                                yOffset = 8;
                            }
                            
                            // Sombra negra para máxima legibilidad sobre cualquier cuadrícula o fondo
                            ctx.shadowColor = '#000000';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 1;
                            
                            ctx.fillText(val.toLocaleString(), point.x, point.y + yOffset);
                            ctx.restore();
                        });
                    });
                }
            };
            
            window.weeklyDailyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                            position: 'top',
                            labels: {
                                color: '#e2e8f0',
                                font: {
                                    family: "'Outfit', sans-serif",
                                    weight: 'bold',
                                    size: 11
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fef08a',
                            bodyColor: '#ffffff',
                            borderColor: '#eab308',
                            borderWidth: 1.5,
                            titleFont: { family: "'Outfit', sans-serif", weight: '900', size: 13 },
                            bodyFont: { family: "'Inter', sans-serif", size: 12 },
                            padding: 12,
                            cornerRadius: 10,
                            boxPadding: 8,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    const val = context.parsed.y;
                                    if (val !== null && val !== undefined) {
                                        return ` ${label}: ${val.toLocaleString()}`;
                                    }
                                    return ` ${label}`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 25,
                            right: 25,
                            top: 20,
                            bottom: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            },
                            beginAtZero: true
                        }
                    }
                },
                plugins: [datalabelsPlugin]
            });
        }, 100);

        return `
        <!-- GRÁFICO POR SEMANA Y DÍA -->
        <div style="background:#000000; border:2px solid #eab308; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(234,179,8,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid rgba(234,179,8,0.15); padding-bottom:8px;">
                <div style="border-left: 4px solid #eab308; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                    <h3 style="color:#fef08a; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                        GRÁFICO DE RENDIMIENTO SEMANA Y DÍA
                    </h3>
                    <div style="font-size:0.68rem; color:rgba(234, 179, 8, 0.6); font-weight:700; letter-spacing:0.5px;">
                        TENDENCIAS DIARIAS COMPARADAS POR SEMANAS (LUNES A SÁBADO)
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-family:'Inter', sans-serif;">
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Desde:</span>
                        <input type="date" id="chartStartDateInput" value="${window.__chartStartDate}" onchange="window.setChartDateRange(this.value, null)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Hasta:</span>
                        <input type="date" id="chartEndDateInput" value="${window.__chartEndDate}" onchange="window.setChartDateRange(null, this.value)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                </div>
            </div>
            <div style="position:relative; width:100%; height:250px; margin-top:0.5rem;">
                <canvas id="weeklyDailyChartCanvas" style="width:100%; height:100%; max-height:250px;"></canvas>
            </div>
        </div>
        `;
}



// ============================================================
// MÓDULO ZONA BUFFER
// ============================================================
async function renderBufferModule() {
  switch(currentSubTab) {
    case 'historial_buffer': await renderHistorialBuffer(); break;
    case 'analisis_buffer':  await renderAnalisisBuffer();  break;
    default: await renderHistorialBuffer();
  }
}

async function renderHistorialBuffer() {
  const area = document.getElementById('contentArea');
  let history = [];
  try { history = await fetchBufferHistory(); } catch(e) { console.warn(e); }

  const filtered = history.filter(r => {
    const d = (r.fecha || r.date || '').substring(0, 10);
    return (!filterStart || d >= filterStart) && (!filterEnd || d <= filterEnd);
  });

  const rows = filtered.length === 0
    ? `<tr><td colspan="6" class="empty-msg">Sin registros de historial buffer en el rango.</td></tr>`
    : filtered.map(r => `
      <tr style="border-bottom:1px solid rgba(0,229,255,0.08);">
        <td style="padding:6px 8px;color:#a1a1aa;">${r.fecha || r.date || '—'}</td>
        <td style="padding:6px 8px;color:#fff;font-weight:700;">${r.area || r.zona || '—'}</td>
        <td style="padding:6px 8px;text-align:center;color:#fff;">${(r.stock || r.stockInicial || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;color:#facc15;">${(r.ingresado || r.entradas || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;color:#818cf8;">${(r.salidas || r.egresado || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;color:#00E5FF;font-weight:800;">${(r.stockFinal || r.saldo || 0).toLocaleString()}</td>
      </tr>`).join('');

  area.innerHTML = `
    <div class="report-card">
      <div class="report-title">📋 HISTORIAL BUFFER</div>
      <div style="overflow-x:auto;">
        <table class="rpt">
          <thead><tr>
            <th style="text-align:left;width:110px;">FECHA</th>
            <th style="text-align:left;">ÁREA / ZONA</th>
            <th style="text-align:center;width:90px;">STOCK INICIAL</th>
            <th style="text-align:center;width:90px;">INGRESADO</th>
            <th style="text-align:center;width:90px;">SALIDAS</th>
            <th style="text-align:center;width:100px;">STOCK FINAL</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function renderAnalisisBuffer() {
  const area = document.getElementById('contentArea');
  let report = null;
  try { report = await loadBufferReport(); } catch(e) { console.warn(e); }

  if (!report || !report.areas || report.areas.length === 0) {
    area.innerHTML = `
      <div class="report-card">
        <div class="report-title">🔍 ANÁLISIS BUFFER</div>
        <div class="empty-msg">No hay análisis de buffer disponible para el rango seleccionado.</div>
      </div>`;
    return;
  }

  const rows = report.areas.map(a => {
    const pct  = a.capacidad > 0 ? Math.round((a.ocupado / a.capacidad) * 100) : 0;
    const col  = pct > 90 ? '#ef4444' : pct > 70 ? '#fbbf24' : '#22c55e';
    return `
      <tr style="border-bottom:1px solid rgba(0,229,255,0.08);">
        <td style="padding:6px 8px;color:#fff;font-weight:700;">${a.nombre || a.area || '—'}</td>
        <td style="padding:6px 8px;text-align:center;color:#fff;">${(a.capacidad || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;color:#facc15;">${(a.ocupado || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;color:#818cf8;">${((a.capacidad||0) - (a.ocupado||0)).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:center;">
          <span style="color:${col};font-weight:800;font-size:0.78rem;">${pct}%</span>
        </td>
      </tr>`;
  }).join('');

  area.innerHTML = `
    <div class="report-card">
      <div class="report-title">🔍 ANÁLISIS BUFFER</div>
      <div style="overflow-x:auto;">
        <table class="rpt">
          <thead><tr>
            <th style="text-align:left;">ÁREA</th>
            <th style="text-align:center;width:100px;">CAPACIDAD</th>
            <th style="text-align:center;width:90px;">OCUPADO</th>
            <th style="text-align:center;width:90px;">DISPONIBLE</th>
            <th style="text-align:center;width:80px;">OCUPACIÓN</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
// MÓDULO ANÁLISIS SKU
// ============================================================
async function renderSkuModule() {
  const area = document.getElementById('contentArea');
  let reserva = [];
  try { reserva = await fetchReservaHistory(); } catch(e) { console.warn(e); }

  const filtered = reserva.filter(r => {
    const d = (r.fecha || '').substring(0, 10);
    return (!filterStart || d >= filterStart) && (!filterEnd || d <= filterEnd);
  }).slice(0, 200);

  if (filtered.length === 0) {
    area.innerHTML = `
      <div class="report-card">
        <div class="report-title">🔍 ANÁLISIS SKU</div>
        <div class="empty-msg">Sin datos de Análisis SKU en el rango seleccionado.</div>
      </div>`;
    return;
  }

  const headers = Object.keys(filtered[0]);
  const rows = filtered.map(r => `
    <tr style="border-bottom:1px solid rgba(0,229,255,0.08);">
      ${headers.map(h => `<td style="padding:5px 8px;color:#fff;font-size:0.75rem;">${r[h] ?? ''}</td>`).join('')}
    </tr>`).join('');

  area.innerHTML = `
    <div class="report-card">
      <div class="report-title">🔍 ANÁLISIS SKU</div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.8rem;">
        Mostrando ${filtered.length} registros
      </div>
      <div style="overflow-x:auto;">
        <table class="rpt">
          <thead><tr>
            ${headers.map(h => `<th style="text-align:left;padding:6px 8px;">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================================
// START
// ============================================================
init();
