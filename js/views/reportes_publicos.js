/**
 * PORTAL DE REPORTES PÚBLICOS — DEAM1830
 * Acceso via token en URL: reportes.html?token=XXXX
 * Solo lectura — sin login requerido
 * Dinámico vía Backend / LocalStorage (Configurable desde Módulo Configuración)
 * v26.5.572
 */

import {
  getAreaData, fetchBufferHistory, loadBufferReport,
  dataStore, initPersistentData, fetchKPIDates,
  loadKPIResultsRange, fetchReservaHistory,
  getCol, updateBufferHistoryRecord, deleteBufferHistoryRecord
} from '../services_v245/csvHub_v6.js?v=29.0399';

import * as adminService from '../services_v245/adminService.js?v=29.0399';
import { marcaNormalizada, marcaCorta, rotuloRango, selectorRango, diaOperativoDeTarea as diaOperativoCompartido } from '../services_v245/reportesComunes.js?v=29.0399';
import { datosMarcas, filasMarcas, cabeceraMarcas, armarTurnoDe, TEMA_CLARO } from '../reportes/marcas.js?v=29.0399';
import { renderLayoutActivo } from './public_layout_activo.js?v=29.0399';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0399';

/**
 * El día operativo, no el del calendario.
 *
 * Antes se usaba new Date().toISOString(), que devuelve UTC: desde las 19:00 de Perú —justo
 * cuando entra el turno noche— UTC ya está en el día siguiente, así que el reporte abría en
 * mañana y los archivos bajaban con la fecha corrida. Va por la misma jornada que la web
 * principal, para que los dos digan lo mismo.
 */
const getLogicalDate = () => jornadaService.fechaLogicaDe();

/**
 * EN QUE DIA CUENTA UNA TAREA. La misma regla que usa el dashboard, importada del archivo
 * compartido para que las dos pantallas no vuelvan a separarse: una FINALIZADA cuenta en la
 * jornada en que se trabajo, una pendiente en el dia en que nacio.
 */
const diaOperativoDeTarea = (t) => diaOperativoCompartido(t, (m) => jornadaService.fechaLogicaDe(m));

// Catálogo Maestro de Módulos
const ALL_MODULES = [
  { id: 'inventario',  label: 'Inventario',   icon: '📦', subTabs: [
    { id: 'archivo_inventario', label: '📄 Archivo Inventario' },
    { id: 'kpi_inventarios', label: '📊 KPI Inventarios' },
    { id: 'analisis_inventarios', label: '🔍 Análisis Inventarios' },
    { id: 'modulo_inventarios', label: '📦 Módulo Inventarios' }
  ]},
  { id: 'picking',     label: 'Picking',       icon: '🛒' },
  { id: 'packing',     label: 'Packing',       icon: '📦' },
  { id: 'despacho',    label: 'Despacho',      icon: '🚚' },
  { id: 'no_retail',   label: 'NO RETAIL',     icon: '🚫' },
  { id: 'recepcion',   label: 'Recepción',     icon: '📥' },
  { id: 'almacenaje',  label: 'Almacenaje',    icon: '🏗️', subTabs: [
    { id: 'reporte_marcas',    label: '🏷️ Reporte Marcas' },
    { id: 'rendimiento_ops',   label: '👷 Rendimiento Operarios' },
    { id: 'produccion_hora',   label: '⏱️ Producción por Hora' },
    { id: 'almacenado_semana', label: '📅 Almacenado por Semana' },
    { id: 'grafico_rendimiento',label: '📈 Gráfico Rendimiento' },
  ]},
  { id: 'buffer',      label: 'Zona Buffer',   icon: '🔄', subTabs: [
    { id: 'historial_buffer', label: '📑 Historial Buffer' },
    { id: 'analisis_buffer',  label: '🔍 Análisis Buffer' },
  ]},
  { id: 'analisis_sku', label: 'Análisis SKU', icon: '🔍', subTabs: [
    { id: 'archivo_analisis', label: '📄 Archivo Análisis' },
    { id: 'replenishment', label: '🔄 Replenishment' },
    { id: 'configuracion_analisis', label: '⚙️ Configuración Análisis' },
    { id: 'analisis_reserva', label: '🔍 Análisis Reserva' },
    { id: 'layout_activo', label: '🗺️ Layout Activo' },
    { id: 'articulo_temp', label: '👕 Artículo Temp' }
  ]},
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
// FUNCIONES AUXILIARES (no disponibles en contexto público)
// ============================================================

/**
 * showPremiumAlert — versión local para el portal público.
 * En el dashboard principal se define en app.js, que no se carga aquí.
 */
function showPremiumAlert(title, message, type = 'info') {
  const colors = {
    success: { bg: 'rgba(34,197,94,0.15)', border: '#22c55e', icon: '✅' },
    error:   { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', icon: '❌' },
    info:    { bg: 'rgba(28,43,58,0.08)', border: '#1C2B3A', icon: 'ℹ️' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', icon: '⚠️' }
  };
  const c = colors[type] || colors.info;

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
    display:flex; align-items:center; justify-content:center; z-index:99999; animation:fadeInOverlay 0.15s ease;`;
  overlay.innerHTML = `
    <style>
      @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
      @keyframes slideUpModal { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    </style>
    <div style="
      background:#FFFFFF;
      border:1px solid #DDD8CF;
      border-radius:8px;
      padding:2rem 2.2rem;
      max-width:380px; width:90%;
      box-shadow:0 4px 24px rgba(28,43,58,0.15);
      text-align:center;
      animation:slideUpModal 0.2s cubic-bezier(0.4,0,0.2,1);
    ">
      <div style="font-size:2.5rem; margin-bottom:0.8rem;">${c.icon}</div>
      <h3 style="margin:0 0 0.5rem; color:#1C2B3A; font-size:1.05rem; font-weight:800; font-family:'Outfit',sans-serif;">${title}</h3>
      <p style="margin:0 0 1.4rem; color:#9C9590; font-size:0.82rem; line-height:1.55;">${message}</p>
      <button style="
        padding:0.6rem 2rem; border-radius:6px;
        background:${c.bg}; border:1px solid ${c.border}55;
        color:#1C2B3A; font-size:0.82rem; font-weight:700; cursor:pointer;
      ">Cerrar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('button').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

/**
 * window.setChartDateRange — controla los inputs de fecha del gráfico de rendimiento.
 * En el dashboard se define dentro de renderAlmacenajeTareas.
 */
window.setChartDateRange = (start, end) => {
  if (start !== null) window.__chartStartDate = start;
  if (end !== null) window.__chartEndDate = end;
  // Re-renderizar el gráfico
  const area = document.getElementById('contentArea');
  if (area && currentSubTab === 'grafico_rendimiento') {
    renderGraficoRendimiento();
  }
};

/**
 * window.downloadExcelDetail — placeholder para exportación de buffer.
 * La implementación completa depende del estado de lastBufferResult del dashboard.
 */
window.downloadExcelDetail = () => {
  showPremiumAlert('Exportación', 'La exportación detallada de Excel no está disponible en el portal público. Utilice el dashboard principal para esta función.', 'info');
};

// ============================================================
// INIT
// ============================================================
async function init() {
  const app = document.getElementById('app');

  // 1. Leer token de la URL
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token') || '';

  // La jornada publicada, para que el corte del día sea el mismo que en la web principal.
  // Si no responde se sigue igual: el servicio cae a lo último guardado o a los valores base.
  try {
    await jornadaService.cargarJornada();
  } catch(e) {
    console.warn('[Reportes] no se pudo traer la jornada, se usa la de esta PC:', e);
  }

  // Cargar datos persistentes
  try {
    await initPersistentData();
  } catch(e) {
    console.warn('[Reportes] initPersistentData falló, continuando...', e);
  }

  // Sincronizar con el servidor para obtener tareas activas e historial
  try {
    await adminService.initializeAdminData();
    await adminService.loadAlmacenajeTasksHistory(true);
  } catch(e) {
    console.warn('[Reportes] Sincronización parcial con servidor:', e);
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
  const allowedInvIds = new Set(groupInfo.reportesInventario || []);
  const allowedAnaIds = new Set(groupInfo.reportesAnalisis || []);

  modulos = ALL_MODULES.filter(m => allowedModIds.has(m.id)).map(m => {
    const clone = { ...m };
    if (clone.id === 'almacenaje' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedAlmIds.has(s.id));
    }
    if (clone.id === 'buffer' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedBufIds.has(s.id));
    }
    if (clone.id === 'inventario' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedInvIds.has(s.id));
    }
    if (clone.id === 'analisis_sku' && clone.subTabs) {
      clone.subTabs = clone.subTabs.filter(s => allowedAnaIds.has(s.id));
    }
    return clone;
  }).filter(m => {
    if ((m.id === 'almacenaje' || m.id === 'buffer' || m.id === 'inventario' || m.id === 'analisis_sku') && (!m.subTabs || m.subTabs.length === 0)) {
      return false;
    }
    return true;
  });

  if (modulos.length === 0) {
    renderAccessDenied(app, "Este enlace no tiene módulos autorizados asignados.");
    return;
  }

  // 4. Establecer fechas de filtro (persistir desde localStorage, o hoy por defecto)
  const today = getLogicalDate();
  filterStart = localStorage.getItem('rpt_filterStart') || today;
  filterEnd   = localStorage.getItem('rpt_filterEnd')   || today;

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
      <div class="contact">📧 Contactar con Daniel Ames</div>
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
        <h2>LOGÍSTICA <span style="color:var(--accent)">DEAM1830</span></h2>
      </div>
      <div class="topbar-right">
        <span class="group-badge">${groupInfo.nombre}</span>
      </div>
    </div>

    <!-- TAB NAV -->
    <div class="tab-nav" id="tabNav"></div>

    <!-- SUBTAB NAV -->
    <div class="subtab-nav" id="subTabNav" style="display:none;"></div>

    <!-- CONTENT -->
    <div class="content-area" id="contentArea">
      <div style="color:var(--text-muted); text-align:center; padding:4rem;">Cargando...</div>
    </div>

    <!-- FOOTER -->
    <div style="border-top:1px solid var(--border); background:var(--surface); padding:0.75rem 1.5rem; text-align:center; color:var(--text-muted); font-size:0.68rem; font-weight:600; letter-spacing:0.5px;">
      Creado por <span style="color:var(--primary); font-weight:700;">Daniel Ames</span>
      <span style="color:var(--border); margin:0 8px;">·</span>
      <span style="color:var(--text-muted); font-weight:500;">v29.0399</span>
    </div>`;

  buildTabNav();
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
      currentSubTab = (mod && mod.subTabs) ? mod.subTabs[0].id : null;
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
  if (!(mod && mod.subTabs) || mod.subTabs.length === 0) {
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
      case 'inventario':  await renderInventarioModule();   break;
      case 'picking':     await renderAreaModule('picking', 'Picking');           break;
      case 'packing':     await renderAreaModule('packing', 'Packing');           break;
      case 'despacho':    await renderAreaModule('despacho', 'Despacho');         break;
      case 'no_retail':   await renderAreaModule('noRetail', 'NO RETAIL');        break;
      case 'recepcion':   await renderAreaModule('recepcion', 'Recepción');       break;
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
                ${headers.map((_, i) => `<td>${row[i] || ''}</td>`).join('')}
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
window.__almacenajeDateChange = function(field, value) {
  if (field === 'start') { filterStart = value; localStorage.setItem('rpt_filterStart', value); }
  if (field === 'end')   { filterEnd   = value; localStorage.setItem('rpt_filterEnd',   value); }
  // El filtro de arriba vuelve a alinear a los dos reportes: es el que manda cuando
  // alguien quiere ver todo el mismo período.
  window.__repMarcasStart = filterStart; window.__repMarcasEnd = filterEnd;
  window.__repGenderStart = filterStart; window.__repGenderEnd = filterEnd;
  renderContent();
};

/* Cada reporte lleva ADEMÁS su propio rango, igual que en el dashboard desde v27:
   sirve para comparar Marcas de una semana contra Gender RIMS de otra sin tener
   que mover el filtro general y perder lo que se estaba mirando. */
window.setRepMarcasRange = function(desde, hasta) {
  if (desde !== null) window.__repMarcasStart = desde;
  if (hasta !== null) window.__repMarcasEnd = hasta;
  renderContent();
};

window.setRepGenderRange = function(desde, hasta) {
  if (desde !== null) window.__repGenderStart = desde;
  if (hasta !== null) window.__repGenderEnd = hasta;
  renderContent();
};

async function renderAlmacenajeModule() {
  const area = document.getElementById('contentArea');

  // El gráfico de rendimiento tiene su propio selector de fechas interno; los demás usan este filtro global
  const filterHtml = currentSubTab === 'grafico_rendimiento' ? '' : `<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
    <label style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">DE</label>
    <input type="date" value="${filterStart}"
      onchange="window.__almacenajeDateChange('start', this.value)"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:5px 10px;font-size:0.75rem;font-weight:600;outline:none;" />
    <label style="font-size:0.72rem;font-weight:700;color:var(--text-muted);">HASTA</label>
    <input type="date" value="${filterEnd}"
      onchange="window.__almacenajeDateChange('end', this.value)"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:5px 10px;font-size:0.75rem;font-weight:600;outline:none;" />
  </div>`;

  area.innerHTML = filterHtml + `<div id="almacenajeContent"></div>`;

  switch(currentSubTab) {
    case 'reporte_marcas':     renderMarcasReport();    break;
    case 'rendimiento_ops':    renderRendimientoOperarios();  break;
    case 'produccion_hora':    renderProduccionHora();  break;
    case 'almacenado_semana':  renderAlmacenadoSemana(); break;
    case 'grafico_rendimiento': renderGraficoRendimiento(); break;
    default:                   renderMarcasReport();
  }
}

function getAlmacenajeTasks() {
  const fromStore = adminService.adminStore.almacenaje_tasks;
  const historyStore = adminService.adminStore.almacenaje_tasks_history || [];

  let active = [];
  if (Array.isArray(fromStore) && fromStore.length > 0) {
    active = fromStore;
  } else {
    try {
      const raw = localStorage.getItem('logistics_sync_v24_almacenaje_tasks');
      active = raw ? JSON.parse(raw) : [];
    } catch(e) { active = []; }
  }

  if (historyStore.length === 0) return active;
  const seen = new Set();
  return [...active, ...historyStore].filter(t => {
    const key = t.id || JSON.stringify(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const getTaskTotalAvance = (t) => {
    if (!t) return 0;
    let sum = 0;
    (t.items || []).forEach(art => {
        (art.items || []).forEach(i => {
            const ubi = String(i.ubi || '').toUpperCase().trim();
            const isBuffer = ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C');
            if (isBuffer) {
                if (i.avance !== undefined && i.avance !== null) {
                    sum += parseFloat(i.avance) || 0;
                } else if (t.status === 'Finalizado') {
                    sum += parseFloat(i.qty) || 0;
                }
            }
        });
    });
    return sum;
};

function getFilteredTasks() {
  return getAlmacenajeTasks().filter(t => {
    // Por la jornada en que se trabajo. De esta funcion cuelga TODO el portal publico.
    const d = diaOperativoDeTarea(t);
    return (!filterStart || d >= filterStart) && (!filterEnd || d <= filterEnd);
  });
}

function getPctHtml(avance, buffer) {
  const p   = buffer > 0 ? Math.round((avance / buffer) * 100) : 0;
  const col = p === 0 ? '#ef4444' : (avance < buffer ? '#fbbf24' : '#22c55e');
  const ic  = p === 0 ? '●' : '▲';
  return `<span style="color:${col};font-weight:800;font-size:0.75rem;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;">
    <span>${ic}</span><span>${p}%</span></span>`;
}

window.__refreshMarcasReport = () => renderMarcasReport();

function renderMarcasReport() {
  const area = document.getElementById('almacenajeContent') || document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  window.__kpiStartDate = filterStart || getLogicalDate();
  window.__kpiEndDate = filterEnd || getLogicalDate();
  // La primera vez cada reporte arranca con el rango del filtro de arriba; a partir
  // de ahí cada uno se mueve por su cuenta hasta que se toque el filtro general.
  if (!window.__repMarcasStart) window.__repMarcasStart = window.__kpiStartDate;
  if (!window.__repMarcasEnd) window.__repMarcasEnd = window.__kpiEndDate;
  if (!window.__repGenderStart) window.__repGenderStart = window.__kpiStartDate;
  if (!window.__repGenderEnd) window.__repGenderEnd = window.__kpiEndDate;
  area.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start;"><div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                            <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                                REPORTE ALMACENAJE - MARCAS
                            </h3>
                            <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
Período: ${rotuloRango(window.__repMarcasStart, window.__repMarcasEnd, '#9C9590')}
                            </div>
                        </div>
                        ${selectorRango(window.__repMarcasStart, window.__repMarcasEnd, 'window.setRepMarcasRange', { color:'#B45309', fondo:'#F4F1EC', texto:'#1C2B3A', esquema:'light' })}
                        <button onclick="window.__refreshMarcasReport && window.__refreshMarcasReport()" title="Actualizar Reporte" style="background:transparent; border:1px solid #DDD8CF; color:#9C9590; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.85rem; transition:all 0.2s;" onmouseover="this.style.background='#F4F1EC'; this.style.borderColor='#B45309'; this.style.color='#B45309'" onmouseout="this.style.background='transparent'; this.style.borderColor='#DDD8CF'; this.style.color='#9C9590'">
                            🔄
                        </button>
                    </div>
                    
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                            <thead>
                                ${cabeceraMarcas(TEMA_CLARO)}
                            </thead>
                            <tbody>
                                ${filasMarcas(datosMarcas(tasks, window.__repMarcasStart, window.__repMarcasEnd, armarTurnoDe(adminService.getWorkers())), TEMA_CLARO)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- REPORTE ALMACENAJE - GENDER RIMS (DERECHA) -->
                <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                            <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                                REPORTE ALMACENAJE - GENDER RIMS
                            </h3>
                            <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
Período: ${rotuloRango(window.__repGenderStart, window.__repGenderEnd, '#9C9590')}
                            </div>
                        </div>
                        ${selectorRango(window.__repGenderStart, window.__repGenderEnd, 'window.setRepGenderRange', { color:'#B45309', fondo:'#F4F1EC', texto:'#1C2B3A', esquema:'light' })}
                        <button onclick="window.__refreshMarcasReport && window.__refreshMarcasReport()" title="Actualizar Reporte" style="background:transparent; border:1px solid #DDD8CF; color:#9C9590; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.85rem; transition:all 0.2s;" onmouseover="this.style.background='#F4F1EC'; this.style.borderColor='#B45309'; this.style.color='#B45309'" onmouseout="this.style.background='transparent'; this.style.borderColor='#DDD8CF'; this.style.color='#9C9590'">
                            🔄
                        </button>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                            <thead>
                                <tr style="background:#1C2B3A; color:#fff; text-transform:uppercase; font-size:0.67rem; font-weight:700; letter-spacing:0.04em;">
                                    <th style="padding:6px 8px; text-align:left; width:120px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left;">GENDER RIMS</th>
                                    <th style="padding:6px 8px; text-align:center; width:90px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width:90px;">AVANCE</th>
                                    <th style="padding:6px 8px; text-align:center; width:90px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width:100px;">PENDIENTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const liveGenderRimsMap = new Map();
                                    const activeMaestro = dataStore.articulos || [];
                                    if (activeMaestro.length === 0) {
                                        fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/articulos')
                                            .then(r => r.json())
                                            .then(rd => {
                                                if (rd && rd.data) {
                                                    dataStore.articulos = rd.data;
                                                    if (window.__refreshMarcasReport) window.__refreshMarcasReport();
                                                }
                                            }).catch(() => {});
                                    }
                                    if (activeMaestro.length > 0) {
                                        const isArray = Array.isArray(activeMaestro[0]);
                                        if (isArray) {
                                            const headers = activeMaestro[0].map(h => String(h || '').trim().toUpperCase());
                                            let skuIdx = headers.indexOf('CODARTICULO'); if (skuIdx === -1) skuIdx = headers.indexOf('SKU'); if (skuIdx === -1) skuIdx = 1;
                                            let grIdx = headers.findIndex(h => h.includes('GENDER') && h.includes('RIMS')); if (grIdx === -1) grIdx = 3;
                                            for (let i = 1; i < activeMaestro.length; i++) {
                                                const row = activeMaestro[i]; if (!row) continue;
                                                const sku7 = String(row[skuIdx] || '').trim().substring(0, 7);
                                                if (sku7 && !liveGenderRimsMap.has(sku7)) liveGenderRimsMap.set(sku7, String(row[grIdx] || '').trim().toUpperCase());
                                            }
                                        } else {
                                            activeMaestro.forEach(row => {
                                                if (!row) return;
                                                const keys = Object.keys(row);
                                                const skuKey = keys.find(k => ['CODARTICULO','SKU','ARTICULO'].includes(k.trim().toUpperCase())) || keys[1] || 'CodArticulo';
                                                const grKey = keys.find(k => k.toUpperCase().includes('GENDER') && k.toUpperCase().includes('RIMS')) || 'Gender RIMS';
                                                const sku7 = String(row[skuKey] || '').trim().substring(0, 7);
                                                if (sku7 && !liveGenderRimsMap.has(sku7)) liveGenderRimsMap.set(sku7, String(row[grKey] || '').trim().toUpperCase());
                                            });
                                        }
                                    }
                                    const genderGroups = {};
                                    const filteredTasksGR = tasks.filter(t => { const d = diaOperativoDeTarea(t); return d >= window.__repGenderStart && d <= window.__repGenderEnd; });
                                    filteredTasksGR.forEach(t => {
                                        (t.items || []).forEach(art => {
                                            const sku7 = String(art.sku7 || '').trim().substring(0, 7);
                                            const genderRims = String(liveGenderRimsMap.get(sku7) || art.genderRims || art.gender || 'S/GR').trim();
                                            (art.items || []).forEach(i => {
                                                const ubi = String(i.ubi || '').toUpperCase().trim();
                                                if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                                                    let area = 'CDBUFFER-A';
                                                    if (ubi.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
                                                    else if (ubi.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
                                                    else { const parts = ubi.split('-'); area = parts.length > 1 ? `${parts[0]}-${parts[1]}` : parts[0]; }
                                                    const qty = parseFloat(i.qty) || 0;
                                                    if (!genderGroups[area]) genderGroups[area] = {};
                                                    if (!genderGroups[area][genderRims]) genderGroups[area][genderRims] = { buffer: 0, avance: 0 };
                                                    genderGroups[area][genderRims].buffer += qty;
                                                    if (t.status === 'Finalizado') {
                                                        const avanceVal = (i.avance !== undefined && i.avance !== null) ? (parseFloat(i.avance) || 0) : qty;
                                                        genderGroups[area][genderRims].avance += avanceVal;
                                                    }
                                                }
                                            });
                                        });
                                    });
                                    const areas = Object.keys(genderGroups).sort((a, b) => b.localeCompare(a));
                                    if (areas.length === 0) return `<tr><td colspan="6" style="padding:4rem; text-align:center; color:#9C9590; font-weight:600;">No hay datos de almacén para mostrar en esta selección.</td></tr>`;
                                    let genderTableRows = '';
                                    let grandBuffer = 0, grandAvance = 0;
                                    areas.forEach(area => {
                                        const genders = Object.keys(genderGroups[area]).sort((a, b) => a.localeCompare(b));
                                        let areaBufferSum = 0, areaAvanceSum = 0;
                                        genders.forEach(gender => {
                                            const data = genderGroups[area][gender];
                                            const pendiente = data.buffer - data.avance;
                                            areaBufferSum += data.buffer; areaAvanceSum += data.avance;
                                            grandBuffer += data.buffer; grandAvance += data.avance;
                                            genderTableRows += `<tr style="border-bottom:1px solid #EEE9E3; background:#fff;">
                                                <td style="padding:5px 6px; color:#9C9590; font-size:0.78rem; font-weight:600;">${area}</td>
                                                <td style="padding:5px 6px;"><b style="color:#1C2B3A; font-weight:800; font-size:0.8rem; font-family:'Outfit',sans-serif;">${gender}</b></td>
                                                <td style="padding:5px 6px; text-align:center; font-weight:700; color:#1C2B3A; font-size:0.8rem;">${data.buffer.toLocaleString('es-PE')}</td>
                                                <td style="padding:5px 6px; text-align:center; font-weight:700; color:#1C2B3A; font-size:0.8rem;">${data.avance.toLocaleString('es-PE')}</td>
                                                <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem;">${getPctHtml(data.avance, data.buffer)}</td>
                                                <td style="padding:5px 6px; text-align:center; font-weight:700; color:#B45309; font-size:0.8rem;">${pendiente.toLocaleString('es-PE')}</td>
                                            </tr>`;
                                        });
                                        const areaPendiente = areaBufferSum - areaAvanceSum;
                                        genderTableRows += `<tr style="background:#F4F1EC; border-top:1px solid #DDD8CF; border-bottom:1px solid #DDD8CF; font-weight:700;">
                                            <td colspan="2" style="padding:7px 8px; color:#1C2B3A; font-weight:700; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit',sans-serif; border-left:3px solid #B45309;">Total ${area}</td>
                                            <td style="padding:7px 8px; text-align:center; color:#1C2B3A; font-size:0.78rem; font-weight:700;">${areaBufferSum.toLocaleString('es-PE')}</td>
                                            <td style="padding:7px 8px; text-align:center; color:#1C2B3A; font-size:0.78rem; font-weight:700;">${areaAvanceSum.toLocaleString('es-PE')}</td>
                                            <td style="padding:7px 8px; text-align:center; font-size:0.78rem; font-weight:700;">${getPctHtml(areaAvanceSum, areaBufferSum)}</td>
                                            <td style="padding:7px 8px; text-align:center; color:#B45309; font-size:0.78rem; font-weight:700;">${areaPendiente.toLocaleString('es-PE')}</td>
                                        </tr>`;
                                    });
                                    const grandPendiente = grandBuffer - grandAvance;
                                    genderTableRows += `<tr style="background:#1C2B3A; font-weight:700;">
                                        <td colspan="2" style="padding:9px 8px; color:#fff; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.8px; font-family:'Outfit',sans-serif; font-weight:700; border-left:4px solid #B45309;">TOTAL GENERAL CDBUFFER</td>
                                        <td style="padding:9px 8px; text-align:center; color:#fff; font-size:0.8rem; font-weight:700;">${grandBuffer.toLocaleString('es-PE')}</td>
                                        <td style="padding:9px 8px; text-align:center; color:#fff; font-size:0.8rem; font-weight:700;">${grandAvance.toLocaleString('es-PE')}</td>
                                        <td style="padding:9px 8px; text-align:center; font-size:0.8rem; font-weight:700;">${getPctHtml(grandAvance, grandBuffer)}</td>
                                        <td style="padding:9px 8px; text-align:center; color:#F5C97A; font-size:0.8rem; font-weight:700;">${grandPendiente.toLocaleString('es-PE')}</td>
                                    </tr>`;
                                    return genderTableRows;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
}

function renderRendimientoOperarios() {
  const area = document.getElementById('almacenajeContent') || document.getElementById('contentArea');
  const tasks = getFilteredTasks();
  const filteredTasks = tasks.filter(t => { const d = diaOperativoDeTarea(t); return d >= filterStart && d <= filterEnd; });
  const weeklyDailyTasks = tasks;
  window.__kpiStartDate = filterStart || getLogicalDate();
  window.__kpiEndDate = filterEnd || getLogicalDate();
  area.innerHTML = `<div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                        <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                            RENDIMIENTO DE OPERARIOS
                        </h3>
                        <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
                            MEDICIÓN DE TAREAS FINALIZADAS
                        </div>
                    </div>
                </div>
                
                <div style="overflow-x:auto; margin-top:0.4rem;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead>
                            <tr style="background:#1C2B3A; color:#fff; text-transform:uppercase; font-size:0.67rem; font-weight:700; letter-spacing:0.04em;">
                                <th style="padding:6px 4px; text-align:left; width:70px; white-space:nowrap;">FECHA</th>
                                <th style="padding:6px 4px; text-align:center; width:65px; white-space:nowrap;">TURNO</th>
                                <th style="padding:6px 8px; text-align:center; width: 90px; white-space:nowrap;">N° OPERARIOS</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">QTY TOTAL</th>
                                <th style="padding:6px 8px; text-align:center; width: 90px; white-space:nowrap;">QTY TAREAS</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">PRIMERA TAREA</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">ÚLTIMA TAREA</th>
                                <th style="padding:6px 8px; text-align:center; width: 110px; white-space:nowrap;">TRANSCURRIDO</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">QTY/HORA</th>
                                <th style="padding:6px 8px; text-align:center; width: 110px; white-space:nowrap;">QTY/TAREA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const shiftStats = {};
                                const workers = adminService.getWorkers() || [];

                                const findWorkerByUsername = (username) => {
                                    if (!username || username === '---') return null;
                                    const cleanUsername = String(username).trim().toLowerCase();
                                    return workers.find(w => {
                                        const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
                                        const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
                                        const formatStr = nom ? `${nom[0]}${ape}` : '';
                                        return formatStr === cleanUsername;
                                    });
                                };

                                const getTaskLogicalDate = (task, shiftVal) => {
                                    return task.fecha || '---';
                                };

                                const getBreakOverlapMs = (start, end) => {
                                    if (!start || !end || start >= end) return 0;
                                    let overlap = 0;
                                    let current = new Date(start.getTime());
                                    current.setHours(0, 0, 0, 0);
                                    
                                    const endLimit = new Date(end.getTime());
                                    endLimit.setHours(23, 59, 59, 999);
                                    
                                    while (current <= endLimit) {
                                        const bStart = new Date(current.getTime());
                                        bStart.setHours(23, 0, 0, 0); // 11:00 PM
                                        const bEnd = new Date(current.getTime());
                                        bEnd.setHours(23, 50, 0, 0); // 11:50 PM
                                        
                                        const oStart = start > bStart ? start : bStart;
                                        const oEnd = end < bEnd ? end : bEnd;
                                        
                                        if (oStart < oEnd) {
                                            overlap += (oEnd - oStart);
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }
                                    return overlap;
                                };

                                // Procesar tareas y calcular su fecha lógica antes de agrupar y filtrar
                                const processedTasks = [];
                                tasks.forEach(t => {
                                    if (t.status !== 'Finalizado') return;

                                    const uList = [t.u1, t.u2].filter(u => u && u !== '---');
                                    if (uList.length > 0) {
                                        uList.forEach((user, idx) => {
                                            const username = String(user).trim().toLowerCase();
                                            const worker = findWorkerByUsername(username);
                                            
                                            let shift = 'DÍA';
                                            if (worker) {
                                                const wTurno = String(worker.turno || worker.Turno || '').trim().toUpperCase();
                                                if (wTurno === 'NOCHE') shift = 'NOCHE';
                                                else if (wTurno === 'DIA' || wTurno === 'DÍA') shift = 'DÍA';
                                            }
                                            
                                            const logicalDate = getTaskLogicalDate(t, shift);
                                            
                                            // [DECOUPLED] RENDIMIENTO DE OPERARIOS ya no es afectado por filtros de fecha del historial
                                            // if (selectedTaskDate && logicalDate !== selectedTaskDate) return;

                                            processedTasks.push({
                                                task: t,
                                                username,
                                                shift,
                                                logicalDate,
                                                qtyForUser: (uList.length === 2) 
                                                    ? (idx === 0 ? Math.ceil(getTaskTotalAvance(t) / 2) : Math.floor(getTaskTotalAvance(t) / 2)) 
                                                    : getTaskTotalAvance(t)
                                            });
                                        });
                                    }
                                });

                                processedTasks.forEach(pt => {
                                    const groupKey = `${pt.logicalDate}_${pt.shift}`;
                                    if (!shiftStats[groupKey]) {
                                        shiftStats[groupKey] = {
                                            fecha: pt.logicalDate,
                                            turno: pt.shift,
                                            operators: new Set(),
                                            tasks: new Set(),
                                            totalQty: 0,
                                            taskCount: 0,
                                            firstStart: null,
                                            lastEnd: null
                                        };
                                    }
                                    
                                    shiftStats[groupKey].operators.add(pt.username);
                                    shiftStats[groupKey].totalQty += pt.qtyForUser;
                                    
                                    const taskId = pt.task.id || pt.task.Id || JSON.stringify(pt.task);
                                    if (!shiftStats[groupKey].tasks.has(taskId)) {
                                        shiftStats[groupKey].tasks.add(taskId);
                                        shiftStats[groupKey].taskCount += 1;
                                    }
                                    
                                    if (pt.task.inicio) {
                                        let sTime = new Date(pt.task.inicio);
                                        if (pt.shift === 'NOCHE') {
                                            const hrs = sTime.getHours();
                                            if (hrs >= 0 && hrs < 7) {
                                                const sYear = sTime.getFullYear();
                                                const sMonth = String(sTime.getMonth() + 1).padStart(2, '0');
                                                const sDay = String(sTime.getDate()).padStart(2, '0');
                                                const sDateStr = `${sYear}-${sMonth}-${sDay}`;
                                                if (sDateStr === pt.logicalDate) {
                                                    sTime.setDate(sTime.getDate() + 1);
                                                }
                                            }
                                        }
                                        if (!shiftStats[groupKey].firstStart || sTime < shiftStats[groupKey].firstStart) {
                                            shiftStats[groupKey].firstStart = sTime;
                                        }
                                    }
                                    if (pt.task.termino) {
                                        let eTime = new Date(pt.task.termino);
                                        if (pt.shift === 'NOCHE') {
                                            const hrs = eTime.getHours();
                                            if (hrs >= 0 && hrs < 7) {
                                                const eYear = eTime.getFullYear();
                                                const eMonth = String(eTime.getMonth() + 1).padStart(2, '0');
                                                const eDay = String(eTime.getDate()).padStart(2, '0');
                                                const eDateStr = `${eYear}-${eMonth}-${eDay}`;
                                                if (eDateStr === pt.logicalDate) {
                                                    eTime.setDate(eTime.getDate() + 1);
                                                }
                                            }
                                        }
                                        if (!shiftStats[groupKey].lastEnd || eTime > shiftStats[groupKey].lastEnd) {
                                            shiftStats[groupKey].lastEnd = eTime;
                                        }
                                    }
                                });

                                const sortedGroupRows = Object.values(shiftStats)
                                    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.turno.localeCompare(b.turno));

                                if (sortedGroupRows.length === 0) {
                                    window.__perfTotalPages = 0;
                                    window.__perfTotalRows = 0;
                                    return `<tr><td colspan="10" style="padding:3rem; text-align:center; color:rgba(0, 229, 255, 0.4); font-weight:700;">No hay datos de desempeño para mostrar en este periodo.</td></tr>`;
                                }

                                if (!window.__perfSetPage) window.__perfSetPage = (p) => { const _sy=window.scrollY; window.__perfPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); else renderAlmacenajeModule(); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
                                const _perfPage = window.__perfPage || 0;
                                const _perfTotalPages = Math.ceil(sortedGroupRows.length / 25);
                                window.__perfTotalPages = _perfTotalPages;
                                window.__perfTotalRows = sortedGroupRows.length;
                                const activePerfPage = _perfPage >= _perfTotalPages ? 0 : _perfPage;
                                window.__perfPage = activePerfPage;
                                const pagedPerfRows = sortedGroupRows.slice(activePerfPage * 25, (activePerfPage + 1) * 25);

                                return pagedPerfRows.map(row => {
                                    const startStr = row.firstStart ? row.firstStart.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    const endStr = row.lastEnd ? row.lastEnd.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    
                                    // 1. Duración Transcurrida (TRANSCURRIDO)
                                    let durationStr = '---';
                                    let breakOverlapMs = 0;
                                    let activeHours = 0;
                                    if (row.firstStart && row.lastEnd) {
                                        const totalMs = row.lastEnd - row.firstStart;
                                        if (totalMs > 0) {
                                            const totalMin = Math.round(totalMs / 60000);
                                            const hours = Math.floor(totalMin / 60);
                                            const mins = totalMin % 60;
                                            durationStr = `${hours}h ${mins}m`;
                                            
                                            breakOverlapMs = getBreakOverlapMs(row.firstStart, row.lastEnd);
                                            const activeMs = totalMs - breakOverlapMs;
                                            activeHours = activeMs / 3600000;
                                        }
                                    }

                                    // 2. QTY/HORA
                                    let qtyPerHourStr = '---';
                                    if (activeHours > 0.08) { // Mínimo 5 minutos para evitar anomalías
                                        const qtyPerHour = Math.round(row.totalQty / activeHours);
                                        qtyPerHourStr = qtyPerHour.toLocaleString('es-PE');
                                    }

                                    const avgQty = row.taskCount > 0 ? Math.round(row.totalQty / row.taskCount) : 0;
                                    const displayDate = (() => {
                                        if (!row.fecha) return '---';
                                        const parts = row.fecha.split('-');
                                        if (parts.length !== 3) return row.fecha;
                                        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                        const monthIdx = parseInt(parts[1], 10) - 1;
                                        if (monthIdx >= 0 && monthIdx < 12) {
                                            return `${parts[2]}-${months[monthIdx]}`;
                                        }
                                        return `${parts[2]}/${parts[1]}`;
                                    })();
                                    return `
                                        <tr style="border-bottom:1px solid #EEE9E3; background:#fff;">
                                            <td style="padding:6px 4px; color:#1C2B3A; font-weight:700; width:70px; white-space:nowrap;">${displayDate}</td>
                                            <td style="padding:6px 4px; text-align:center; width:65px; white-space:nowrap;"><span style="background:${row.turno === 'NOCHE' ? 'rgba(28,43,58,0.1)' : 'rgba(180,83,9,0.1)'}; color:${row.turno === 'NOCHE' ? '#1C2B3A' : '#B45309'}; padding:2px 6px; border-radius:3px; font-size:0.68rem; font-weight:700;">${row.turno}</span></td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#1C2B3A;">${row.operators.size}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#1C2B3A;">${row.totalQty.toLocaleString('es-PE')}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#B45309;">${row.taskCount}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#9C9590; font-size:0.75rem;">${startStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#9C9590; font-size:0.75rem;">${endStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#4A4540; font-weight:700;">${durationStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#1A6336; font-weight:700;">${qtyPerHourStr}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#B45309;">${avgQty.toLocaleString('es-PE')}</td>
                                        </tr>
                                    `;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
                ${(() => {
                    const tp = window.__perfTotalPages || 1;
                    const cp = window.__perfPage || 0;
                    if (tp <= 1) return '';
                    const btnStyle = (active, dis) => `padding:4px 9px; border-radius:3px; border:1px solid ${active?'#1C2B3A':'#DDD8CF'}; background:${active?'#1C2B3A':'#fff'}; color:${dis?'#DDD8CF':active?'#fff':'#4A4540'}; cursor:${dis?'default':'pointer'}; font-size:0.68rem; font-weight:${active?700:500};`;
                    const pages = Array.from({length: tp}, (_, i) => i);
                    return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid #EEE9E3; margin-top:0.4rem;">
                        <button onclick="window.__perfSetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                        ${pages.map(p=>`<button onclick="window.__perfSetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                        <button onclick="window.__perfSetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                        <span style="font-size:0.68rem; color:#9C9590; margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__perfTotalRows || 0} registros)</span>
                    </div>`;
                })()}
            </div>`;
}



const renderHourlyProductionReport = (tasksList) => {
        const targetHours = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
        const hourlyData = {};
        
        tasksList.forEach(t => {
            if (t.status !== 'Finalizado') return;
            if (!t.termino) return;
            
            const dateObj = new Date(t.termino);
            const hr = dateObj.getHours();
            if (!targetHours.includes(hr)) return;
            
            const dateKey = t.fecha || '---';
            if (dateKey === '---') return;
            
            if (!hourlyData[dateKey]) {
                hourlyData[dateKey] = {};
                targetHours.forEach(h => hourlyData[dateKey][h] = 0);
            }
            
            hourlyData[dateKey][hr] += getTaskTotalAvance(t);
        });

        const activeDates = Object.keys(hourlyData).filter(dateKey => {
            const total = targetHours.reduce((sum, hr) => sum + hourlyData[dateKey][hr], 0);
            return total > 0;
        });

        activeDates.sort((a, b) => b.localeCompare(a));

        if (!window.__hourlySetPage) window.__hourlySetPage = (p) => { const _sy=window.scrollY; window.__hourlyPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); else renderAlmacenajeModule(); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
        const _hourlyPage = window.__hourlyPage || 0;
        const _hourlyTotalPages = Math.ceil(activeDates.length / 25);
        window.__hourlyTotalPages = _hourlyTotalPages;
        window.__hourlyTotalRows = activeDates.length;
        const activeHourlyPage = _hourlyPage >= _hourlyTotalPages ? 0 : _hourlyPage;
        window.__hourlyPage = activeHourlyPage;
        const pagedActiveDates = activeDates.slice(activeHourlyPage * 25, (activeHourlyPage + 1) * 25);

        const formatLogicalDate = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            return `${day}-${months[monthIdx] || parts[1]}`;
        };

        return `
        <!-- REPORTE DE PRODUCCIÓN POR HORA (ANCHO COMPLETO) -->
        <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE PRODUCCIÓN POR HORA
                </h3>
                <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
                    CANTIDAD DE UNIDADES PROCESADAS POR RANGO HORARIO (TAREA FINALIZADA)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="background:#1C2B3A; color:#fff; text-transform:uppercase; font-size:0.67rem; font-weight:700; letter-spacing:0.04em;">
                            <th style="padding:6px 8px; text-align:left; width:80px;">FECHA</th>
                            ${targetHours.map(hr => `<th style="padding:6px 4px; text-align:center;">${hr.toString().padStart(2, '0')}:00</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:90px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedActiveDates.length === 0 ? `<tr><td colspan="${targetHours.length + 2}" style="padding:3rem; text-align:center; color:#9C9590; font-weight:600;">No hay producción por hora registrada.</td></tr>` : pagedActiveDates.map(dateKey => {
                            const rowData = hourlyData[dateKey];
                            const rowTotal = targetHours.reduce((sum, hr) => sum + rowData[hr], 0);
                            return `
                                <tr style="border-bottom:1px solid #EEE9E3; background:#fff;">
                                    <td style="padding:6px 8px; color:#1C2B3A; font-weight:700;">${formatLogicalDate(dateKey)}</td>
                                    ${targetHours.map(hr => {
                                        const qty = rowData[hr];
                                        return `<td style="padding:6px 4px; text-align:center; color:${qty > 0 ? '#1C2B3A' : '#DDD8CF'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString('es-PE') : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#B45309; font-weight:700; background:#FFF8F0;">${rowTotal.toLocaleString('es-PE')}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ${(() => {
                const tp = window.__hourlyTotalPages || 1;
                const cp = window.__hourlyPage || 0;
                if (tp <= 1) return '';
                const btnStyle = (active, dis) => `padding:4px 9px; border-radius:3px; border:1px solid ${active?'#1C2B3A':'#DDD8CF'}; background:${active?'#1C2B3A':'#fff'}; color:${dis?'#DDD8CF':active?'#fff':'#4A4540'}; cursor:${dis?'default':'pointer'}; font-size:0.68rem; font-weight:${active?700:500};`;
                const pages = Array.from({length: tp}, (_, i) => i);
                return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid #EEE9E3; margin-top:0.4rem;">
                    <button onclick="window.__hourlySetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                    ${pages.map(p=>`<button onclick="window.__hourlySetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                    <button onclick="window.__hourlySetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                    <span style="font-size:0.68rem; color:#9C9590; margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__hourlyTotalRows || 0} registros)</span>
                </div>`;
            })()}
        </div>
        `;
    }

const renderWeeklyStorageReport = (tasksList) => {
        const weeklyBrandData = {};
        const weeklyBrandGenderData = {};
        const allBrandsSet = new Set();
        const allGendersPerWeek = {};

        // Build a dynamic map of sku7 to live Column C (G. Gender) from the current maestro dataStore.articulos
        const liveGenderMap = new Map();
        const activeMaestro = dataStore.articulos || [];
        activeMaestro.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const sku7 = String(raw[1] || '').trim().substring(0, 7);
            if (sku7 && !liveGenderMap.has(sku7)) {
                // Column C (index 2) is G. Gender
                liveGenderMap.set(sku7, String(raw[2] || '').trim().toUpperCase());
            }
        });

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            return `Semana ${weekNo} (${parts[0]})`;
        };

        tasksList.forEach(t => {
            if (t.status !== 'Finalizado') return;
            // Por la jornada trabajada: una tarea de ayer cerrada hoy es avance de hoy.
            const weekStr = getWeekStr(diaOperativoDeTarea(t));
            if (weekStr === '---') return;
            
            let brand = marcaCorta(t.marca) || 'S/M';
            if (brand === 'Bubblegummers Licenses') brand = 'BG. Licenses';
            if (brand === 'Bubblegummers') brand = 'BG';
            
            allBrandsSet.add(brand);
            
            if (!weeklyBrandData[weekStr]) {
                weeklyBrandData[weekStr] = {};
            }
            if (!weeklyBrandData[weekStr][brand]) {
                weeklyBrandData[weekStr][brand] = 0;
            }
            weeklyBrandData[weekStr][brand] += getTaskTotalAvance(t);

            // Group by gender for drilldown
            if (!weeklyBrandGenderData[weekStr]) {
                weeklyBrandGenderData[weekStr] = {};
                allGendersPerWeek[weekStr] = new Set();
            }
            (t.items || []).forEach(art => {
                const liveGender = liveGenderMap.get(art.sku7);
                const gender = (liveGender && liveGender !== '') ? liveGender : (String(art.gender || 'S/G').trim().toUpperCase() || 'S/G');
                allGendersPerWeek[weekStr].add(gender);
                if (!weeklyBrandGenderData[weekStr][gender]) {
                    weeklyBrandGenderData[weekStr][gender] = {};
                }
                if (!weeklyBrandGenderData[weekStr][gender][brand]) {
                    weeklyBrandGenderData[weekStr][gender][brand] = 0;
                }
                let artQty = 0;
                (art.items || []).forEach(i => {
                    const ubi = String(i.ubi || '').toUpperCase();
                    if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                        artQty += (i.avance !== undefined && i.avance !== null) ? parseFloat(i.avance) : (parseFloat(i.qty) || 0);
                    }
                });
                if (artQty === 0) {
                    const hasAvanceInfo = (t.items || []).some(a => (a.items || []).some(item => item.avance !== undefined && item.avance !== null));
                    if (!hasAvanceInfo) {
                        artQty = parseFloat(art.bufferQty) || 0;
                    }
                }
                weeklyBrandGenderData[weekStr][gender][brand] += artQty;
            });
        });

        const predefinedBrands = ['Bata', 'North Star', 'Adidas', 'Puma'];
        const otherBrands = Array.from(allBrandsSet)
            .filter(b => !predefinedBrands.includes(b))
            .sort((a, b) => a.localeCompare(b));
        
        const sortedBrands = [
            ...predefinedBrands.filter(b => allBrandsSet.has(b)),
            ...otherBrands
        ];

        const sortedWeeks = Object.keys(weeklyBrandData).sort((a, b) => {
            const getVal = (s) => {
                const m = s.match(/Semana (\d+) \((\d+)\)/);
                if (!m) return 0;
                return parseInt(m[2]) * 100 + parseInt(m[1]);
            };
            return getVal(a) - getVal(b);
        });

        if (!window.__weeklySetPage) window.__weeklySetPage = (p) => { const _sy=window.scrollY; window.__weeklyPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); else renderAlmacenajeModule(); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
        if (!window.toggleStorageReportWeek) window.toggleStorageReportWeek = (week) => {
            if (!window.__expandedStorageReportWeeks) window.__expandedStorageReportWeeks = [];
            const idx = window.__expandedStorageReportWeeks.indexOf(week);
            if (idx > -1) window.__expandedStorageReportWeeks.splice(idx, 1);
            else window.__expandedStorageReportWeeks.push(week);
            const _sy = window.scrollY;
            if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(document.getElementById('contentArea') || document.body); else renderAlmacenajeModule();
            requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'}));
        };
        const _weeklyPage = window.__weeklyPage || 0;
        const _weeklyTotalPages = Math.ceil(sortedWeeks.length / 25);
        window.__weeklyTotalPages = _weeklyTotalPages;
        window.__weeklyTotalRows = sortedWeeks.length;
        const activeWeeklyPage = _weeklyPage >= _weeklyTotalPages ? 0 : _weeklyPage;
        window.__weeklyPage = activeWeeklyPage;
        const pagedSortedWeeks = sortedWeeks.slice(activeWeeklyPage * 25, (activeWeeklyPage + 1) * 25);

        const colTotals = {};
        sortedBrands.forEach(b => colTotals[b] = 0);
        let grandTotal = 0;

        sortedWeeks.forEach(w => {
            sortedBrands.forEach(b => {
                const qty = weeklyBrandData[w][b] || 0;
                colTotals[b] += qty;
                grandTotal += qty;
            });
        });

        return `
        <!-- REPORTE DE ALMACENADO POR SEMANA (ANCHO COMPLETO) -->
        <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE ALMACENADO POR SEMANA Y MARCA
                </h3>
                <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
                    DISTRIBUCIÓN DE CANTIDADES ALMACENADAS POR SEMANA E ISO Y MARCAS PRINCIPALES (HAGA CLIC EN UNA SEMANA PARA EXPANDIR POR GÉNERO)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="background:#1C2B3A; color:#fff; text-transform:uppercase; font-size:0.67rem; font-weight:700; letter-spacing:0.04em;">
                            <th style="padding:6px 8px; text-align:left; width:120px;">SEMANA</th>
                            ${sortedBrands.map(b => `<th style="padding:6px 8px; text-align:center;">${b}</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:100px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedSortedWeeks.length === 0 ? `<tr><td colspan="${sortedBrands.length + 2}" style="padding:3rem; text-align:center; color:#9C9590; font-weight:600;">No hay datos semanales registrados.</td></tr>` : pagedSortedWeeks.map(w => {
                            const rowData = weeklyBrandData[w];
                            const rowTotal = sortedBrands.reduce((sum, b) => sum + (rowData[b] || 0), 0);
                            const isExpanded = window.__expandedStorageReportWeeks && window.__expandedStorageReportWeeks.includes(w);

                            const genderRowsHtml = isExpanded ? Array.from(allGendersPerWeek[w] || []).sort().map(gender => {
                                const genderData = weeklyBrandGenderData[w][gender] || {};
                                const genderRowTotal = sortedBrands.reduce((sum, b) => sum + (genderData[b] || 0), 0);
                                return `
                                    <tr style="background:#F4F1EC; border-bottom:1px solid #EEE9E3; font-size:0.74rem;">
                                        <td style="padding:5px 8px 5px 24px; color:#9C9590; font-weight:600; font-style:italic; white-space:nowrap;">${gender}</td>
                                        ${sortedBrands.map(b => {
                                            const qty = genderData[b] || 0;
                                            return `<td style="padding:5px 8px; text-align:center; color:#4A4540;">${qty > 0 ? qty.toLocaleString('es-PE') : '-'}</td>`;
                                        }).join('')}
                                        <td style="padding:5px 8px; text-align:center; color:#B45309; font-weight:700; background:#FFF8F0;">${genderRowTotal.toLocaleString('es-PE')}</td>
                                    </tr>
                                `;
                            }).join('') : '';

                            return `
                                <tr onclick="window.toggleStorageReportWeek('${w}')" style="border-bottom:1px solid #EEE9E3; background:#fff; cursor:pointer;" onmouseover="this.style.background='#F4F1EC'" onmouseout="this.style.background='#fff'">
                                    <td style="padding:6px 8px; color:#1C2B3A; font-weight:700; white-space:nowrap;">
                                        <span style="color:#B45309; margin-right:6px; display:inline-block; transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}">▶</span>
                                        ${w}
                                    </td>
                                    ${sortedBrands.map(b => {
                                        const qty = rowData[b] || 0;
                                        return `<td style="padding:6px 8px; text-align:center; color:${qty > 0 ? '#1C2B3A' : '#DDD8CF'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString('es-PE') : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#B45309; font-weight:700; background:#FFF8F0;">${rowTotal.toLocaleString('es-PE')}</td>
                                </tr>
                                ${genderRowsHtml}
                            `;
                        }).join('')}
                        ${sortedWeeks.length > 0 ? `
                            <tr style="background:#1C2B3A; font-weight:700;">
                                <td style="padding:8px 8px; color:#fff; font-weight:700; border-left:4px solid #B45309;">TOTAL GENERAL</td>
                                ${sortedBrands.map(b => {
                                    const qty = colTotals[b];
                                    return `<td style="padding:8px 8px; text-align:center; color:#fff; font-weight:700;">${qty.toLocaleString('es-PE')}</td>`;
                                }).join('')}
                                <td style="padding:8px 8px; text-align:center; color:#F5C97A; font-weight:700;">${grandTotal.toLocaleString('es-PE')}</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            ${(() => {
                const tp = window.__weeklyTotalPages || 1;
                const cp = window.__weeklyPage || 0;
                if (tp <= 1) return '';
                const btnStyle = (active, dis) => `padding:4px 9px; border-radius:3px; border:1px solid ${active?'#1C2B3A':'#DDD8CF'}; background:${active?'#1C2B3A':'#fff'}; color:${dis?'#DDD8CF':active?'#fff':'#4A4540'}; cursor:${dis?'default':'pointer'}; font-size:0.68rem; font-weight:${active?700:500};`;
                const pages = Array.from({length: tp}, (_, i) => i);
                return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid #EEE9E3; margin-top:0.4rem;">
                    <button onclick="window.__weeklySetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                    ${pages.map(p=>`<button onclick="window.__weeklySetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                    <button onclick="window.__weeklySetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                    <span style="font-size:0.68rem; color:#9C9590; margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__weeklyTotalRows || 0} registros)</span>
                </div>`;
            })()}
        </div>
        `;
    }

const renderWeeklyDailyChartSection = (tasksList) => {
        const chartWeeksData = {};

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            return `Semana ${weekNo} (${parts[0]})`;
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
                const dT = diaOperativoDeTarea(t);
                if (!minDate || dT < minDate) minDate = dT;
                if (!maxDate || dT > maxDate) maxDate = dT;
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
            const dT = diaOperativoDeTarea(t);
            if (startDate && dT < startDate) return false;
            if (endDate && dT > endDate) return false;
            return true;
        });

        chartTasks.forEach(t => {
            const dOper = diaOperativoDeTarea(t);
            const weekStr = getWeekStr(dOper);
            const dayIdx = getDayIndex(dOper);
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
                const bufferColor = { border: '#1C2B3A', bg: 'rgba(28,43,58,0.05)' };
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
                            ctx.shadowColor = 'rgba(255,255,255,0.8)';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 1;
                            
                            ctx.fillText(val.toLocaleString('es-PE'), point.x, point.y + yOffset);
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
                            backgroundColor: 'rgba(255,255,255,0.98)',
                            titleColor: '#1C2B3A',
                            bodyColor: '#4A4540',
                            borderColor: '#DDD8CF',
                            borderWidth: 1,
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
                                        return ` ${label}: ${val.toLocaleString('es-PE')}`;
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
                                color: 'rgba(28,43,58,0.06)',
                                borderColor: '#DDD8CF'
                            },
                            ticks: {
                                color: '#9C9590',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(28,43,58,0.06)',
                                borderColor: '#DDD8CF'
                            },
                            ticks: {
                                color: '#9C9590',
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
        <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:0.8rem 1.2rem; font-family:var(--font-sans, 'Inter', sans-serif); color:#1C2B3A; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid #DDD8CF; padding-bottom:8px;">
                <div style="border-left: 3px solid #B45309; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                    <h3 style="color:#1C2B3A; font-weight:700; margin:0; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                        GRÁFICO DE RENDIMIENTO SEMANA Y DÍA
                    </h3>
                    <div style="font-size:0.68rem; color:#9C9590; font-weight:600; letter-spacing:0.3px;">
                        TENDENCIAS DIARIAS COMPARADAS POR SEMANAS (LUNES A SÁBADO)
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-family:'Inter', sans-serif;">
                    <div style="display:flex; align-items:center; background:#F4F1EC; border:1px solid #DDD8CF; border-radius:4px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.68rem; color:#9C9590; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Desde:</span>
                        <input type="date" id="chartStartDateInput" value="${window.__chartStartDate}" onchange="window.setChartDateRange(this.value, null)" style="background:transparent; border:none; color:#1C2B3A; font-size:0.75rem; font-weight:600; outline:none; cursor:pointer; font-family:'Inter', sans-serif;" />
                    </div>
                    <div style="display:flex; align-items:center; background:#F4F1EC; border:1px solid #DDD8CF; border-radius:4px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.68rem; color:#9C9590; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Hasta:</span>
                        <input type="date" id="chartEndDateInput" value="${window.__chartEndDate}" onchange="window.setChartDateRange(null, this.value)" style="background:transparent; border:none; color:#1C2B3A; font-size:0.75rem; font-weight:600; outline:none; cursor:pointer; font-family:'Inter', sans-serif;" />
                    </div>
                </div>
            </div>
            <div style="position:relative; width:100%; height:250px; margin-top:0.5rem;">
                <canvas id="weeklyDailyChartCanvas" style="width:100%; height:100%; max-height:250px;"></canvas>
            </div>
        </div>
        `;
    }



const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};


function renderProduccionHora() {
  const area = document.getElementById('almacenajeContent') || document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">⏱️ PRODUCCIÓN POR HORA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderHourlyProductionReport(tasksList);
}

function renderAlmacenadoSemana() {
  const area = document.getElementById('almacenajeContent') || document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📅 ALMACENADO POR SEMANA</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderWeeklyStorageReport(tasksList);
}

function renderGraficoRendimiento() {
  const area = document.getElementById('almacenajeContent') || document.getElementById('contentArea');
  const tasksList = getFilteredTasks();
  if (tasksList.length === 0) {
    area.innerHTML = `<div class="report-card"><div class="report-title">📈 GRÁFICO RENDIMIENTO</div><div class="empty-msg">Sin datos.</div></div>`;
    return;
  }
  area.innerHTML = renderWeeklyDailyChartSection(tasksList);
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
  const container = document.getElementById('contentArea');
  container.innerHTML = `<div style="text-align:center; padding:2rem;"><div class="spinner"></div></div>`;

  let kpiHistory = [];
  try {
    const raw = localStorage.getItem('logistics_buffer_history_v2');
    if (raw) kpiHistory = JSON.parse(raw);
  } catch(e) {}









    container.innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <div class="spinner"></div>
            <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">Sincronizando Reporte de Historial...</p>
        </div>`;
    
    // ── Cargar desde servidor (con fallback a localStorage) ───────────────────
    kpiHistory = [];
    let serverOnline = false;
    try {
        kpiHistory = await fetchBufferHistory();
        serverOnline = true;
    } catch(e) {
        console.warn('[BH] Fallback a localStorage:', e);
        try {
            const localData = JSON.parse(localStorage.getItem('logistics_buffer_kpi_history_local') || '[]');
            kpiHistory = Array.isArray(localData) ? localData : [];
        } catch(_) { kpiHistory = []; }
    }
    
    if (!Array.isArray(kpiHistory)) {
        try {
            const localData = JSON.parse(localStorage.getItem('logistics_buffer_kpi_history_local') || '[]');
            kpiHistory = Array.isArray(localData) ? localData : [];
        } catch(_) { kpiHistory = []; }
    }

    try {
        kpiHistory.sort((a, b) => {
            const dateA = a && (a.created_at || a.fecha) ? new Date(a.created_at || a.fecha) : new Date(0);
            const dateB = b && (b.created_at || b.fecha) ? new Date(b.created_at || b.fecha) : new Date(0);
            return dateB - dateA;
        });
    } catch(e) {
        console.warn('[BH] Error ordenando historial:', e);
    }



    const savedFrom = sessionStorage.getItem('buffer_hist_date_from') || getLogicalDate();
    const savedTo   = sessionStorage.getItem('buffer_hist_date_to')   || getLogicalDate();

    container.innerHTML = `
        <div class="animate-fade-in" style="padding:0.5rem; display:flex; flex-direction:column; gap:1.5rem; width:100%;">
            <!-- TOOLBAR: filtros + exportar (100% ANCHO) -->
            <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap; margin-bottom:0.8rem; background:#F4F1EC; padding:0.6rem 1rem; border-radius:4px; border:1px solid #DDD8CF; width:100%;">
                <!-- Rango de fecha -->
                <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.72rem; font-weight:600; color:#4A4540;">
                    <span>📅 DE:</span>
                    <input type="date" id="hist_date_from" value="${savedFrom}" style="background:#fff; color:#1C2B3A; border:1px solid #DDD8CF; padding:0.3rem 0.5rem; border-radius:4px; font-size:0.72rem; outline:none; cursor:pointer;" />
                    <span>HASTA:</span>
                    <input type="date" id="hist_date_to" value="${savedTo}" style="background:#fff; color:#1C2B3A; border:1px solid #DDD8CF; padding:0.3rem 0.5rem; border-radius:4px; font-size:0.72rem; outline:none; cursor:pointer;" />
                </div>
                <div style="margin-left:auto; display:flex; gap:0.5rem; align-items:center;">
                    <button id="btn_hist_sync" title="Sincronizar Historial" style="background:#1C2B3A; color:#fff; border:none; width:28px; height:28px; border-radius:4px; font-size:0.9rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                        🔄
                    </button>
                    <button id="btn_hist_export" style="background:#1A6336; color:#fff; border:none; padding:0.35rem 0.8rem; border-radius:4px; font-size:0.72rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.4rem; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                        📥 EXPORTAR
                    </button>
                </div>
            </div>

            <!-- CONTENIDO DE REPORTES EN DOS COLUMNAS -->
            <div style="display:flex; gap:1rem; width:100%; align-items:start;">
                <!-- COLUMNA IZQUIERDA: REPORTE DE CONCILIACIÓN DE PALETAS (50%) -->
                <div style="flex:1; min-width:0; background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden;">
                    <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-bottom:none; border-left:3px solid #B45309;">
                        <h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">Reporte de Paletas</h3>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#4A4540; text-align:center;">
                            <thead>
                                <tr style="background:#1C2B3A; color:#fff; border-bottom:none;">
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Fecha</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Paletas Solicitadas</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Paletas Bajadas</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Diferencias</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Fill Rate</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="hist_concil_tbody"></tbody>
                        </table>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: REPORTE DE BUFFER TEMPORADA (50%) -->
                <div style="flex:1; min-width:0; background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden;">
                    <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-left:3px solid #B45309; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">Buffer Temporada</h3>
                        <button id="btn_temp_export" style="background:#1A6336; color:#fff; border:none; padding:0.3rem 0.7rem; border-radius:4px; font-size:0.68rem; font-weight:700; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            📥 EXPORTAR TEMPORADA
                        </button>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; color:#4A4540; text-align:center;">
                            <thead>
                                <tr style="background:#1C2B3A; color:#fff;">
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Temporada</th>
                                    <th style="padding:0.4rem 0.5rem; text-align:center;">Cant. Bajada</th>
                                </tr>
                            </thead>
                            <tbody id="hist_temp_tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ── Helpers de fecha ──────────────────────────────────────────────────────
    const toISO = (fechaStr) => {
        // Acepta "24 jun", "24/06/2025", "2025-06-24"
        if (!fechaStr) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
            const [d, m, y] = fechaStr.split('/');
            return `${y}-${m}-${d}`;
        }
        // "24 jun" → intenta parsear con el año actual
        const currentYear = new Date().getFullYear();
        const parsed = new Date(fechaStr + ' ' + currentYear);
        if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
        return fechaStr;
    };

    // ── Estado edición ────────────────────────────────────────────────────────
    let editingIdx = null;

    const renderHistTable = async () => {
        const tbody = document.getElementById('hist_concil_tbody');
        const tbodyTemp = document.getElementById('hist_temp_tbody');
        if (!tbody) return;
        const fromVal = document.getElementById('hist_date_from').value;
        const toVal   = document.getElementById('hist_date_to').value;

        // Persistir rango de fechas seleccionado en sessionStorage
        sessionStorage.setItem('buffer_hist_date_from', fromVal);
        sessionStorage.setItem('buffer_hist_date_to', toVal);

        const filtered = kpiHistory.map((row, idx) => ({ row, idx })).filter(({ row }) => {
            if (!fromVal && !toVal) return true;
            const d = toISO(row.fecha || '');
            return (!fromVal || d >= fromVal) && (!toVal || d <= toVal);
        });

        if (!filtered.length) {
            const emptyMsg = (!kpiHistory || kpiHistory.length === 0)
                ? "No hay registros en el historial. Procesa un Buffer KPI para generar el primero."
                : "No hay registros en ese rango de fechas.";
            tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">${emptyMsg}</td></tr>`;
            if (tbodyTemp) {
                tbodyTemp.innerHTML = `<tr><td colspan="4" style="padding:2rem; text-align:center; color:var(--text-muted);">No hay movimientos.</td></tr>`;
            }
            return;
        }

        tbody.innerHTML = filtered.map(({ row, idx }) => {
            if (editingIdx === idx) {
                // Fila en modo edición
                return `
                <tr style="border-bottom:1px solid #EEE9E3; background:#F4F1EC;">
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3;">
                        <input id="ed_fecha_${idx}" value="${row.fecha || ''}" style="width:90px; background:#fff; color:#1C2B3A; border:1px solid #B45309; border-radius:4px; padding:0.2rem 0.3rem; font-size:0.75rem; text-align:center;" />
                    </td>
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3;">
                        <input id="ed_sol_${idx}" value="${row.paletasSolicitadas || 0}" type="number" style="width:70px; background:#fff; color:#1C2B3A; border:1px solid #B45309; border-radius:4px; padding:0.2rem 0.3rem; font-size:0.75rem; text-align:center;" />
                    </td>
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3;">
                        <input id="ed_baj_${idx}" value="${row.paletasBajadas || 0}" type="number" style="width:70px; background:#fff; color:#1C2B3A; border:1px solid #B45309; border-radius:4px; padding:0.2rem 0.3rem; font-size:0.75rem; text-align:center;" />
                    </td>
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3; color:#991B1B; font-weight:700;">${row.diferencias}</td>
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3; font-weight:700;">${row.fillRate}</td>
                    <td style="padding:0.3rem 0.4rem; border:1px solid #EEE9E3;">
                        <div style="display:flex; gap:0.4rem; justify-content:center;">
                            <button title="Guardar" onclick="window._histSave(${idx})" style="background:#1A6336; border:none; border-radius:4px; padding:0.2rem 0.4rem; cursor:pointer; font-size:0.8rem; color:#fff; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">💾</button>
                            <button title="Cancelar" onclick="window._histCancelEdit()" style="background:#F4F1EC; border:1px solid #DDD8CF; border-radius:4px; padding:0.2rem 0.4rem; cursor:pointer; font-size:0.8rem; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">✖</button>
                        </div>
                    </td>
                </tr>`;
            }
            return `
            <tr style="border-bottom:1px solid #EEE9E3;">
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3; font-weight:700; color:#1C2B3A;">${row.fecha}</td>
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3; font-weight:700; color:#1C2B3A;">${row.paletasSolicitadas}</td>
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3; font-weight:700; color:#1A6336;">${row.paletasBajadas}</td>
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3; font-weight:700; color:#991B1B;">${row.diferencias}</td>
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3; font-weight:700; font-size:0.85rem; color:#1C2B3A;">${row.fillRate}</td>
                <td style="padding:0.35rem 0.5rem; border:1px solid #EEE9E3;">
                    <div style="display:flex; gap:0.5rem; justify-content:center;">
                        <button title="Editar" onclick="window._histEdit(${idx})" style="background:transparent; border:1px solid #DDD8CF; border-radius:4px; padding:0.2rem 0.45rem; cursor:pointer; font-size:0.8rem; transition:all 0.2s;" onmouseover="this.style.background='#F4F1EC'" onmouseout="this.style.background='transparent'">✏️</button>
                        <button title="Eliminar" onclick="window._histDelete(${idx})" style="background:transparent; border:1px solid rgba(153,27,27,0.25); border-radius:4px; padding:0.2rem 0.45rem; cursor:pointer; font-size:0.8rem; transition:all 0.2s;" onmouseover="this.style.background='rgba(153,27,27,0.08)'" onmouseout="this.style.background='transparent'">🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Cargar y procesar "Buffer Temporada"
        if (tbodyTemp) {
            tbodyTemp.innerHTML = `<tr><td colspan="2" style="padding:1rem; text-align:center; color:var(--text-muted);">Cargando análisis de temporadas...</td></tr>`;
            try {
                if (!dataStore.analisis_sku_maestro || dataStore.analisis_sku_maestro.length === 0) {
                    await getAreaData('analisis_sku_maestro');
                }
                const maestroData = dataStore.analisis_sku_maestro || [];
                const maestroMap = new Map();
                maestroData.forEach(mRow => {
                    const raw = Array.isArray(mRow) ? mRow : Object.values(mRow);
                    const cod = String(getCol(mRow, ['CodArticulo','Cod Articulo','CODARTICULO','Articulo','ARTICULO','CODIGO']) || raw[1] || '').trim();
                    if (!cod) return;
                    const art7 = cod.length >= 7 ? cod.substring(0, 7) : cod;
                    if (!maestroMap.has(art7)) {
                        maestroMap.set(art7, {
                            temporada: String(getCol(mRow, ['Temporada','TEMPORADA','Season','SEASON']) || raw[14] || raw[13] || '-').trim()
                        });
                    }
                });

                const kpiDetails = await loadKPIResultsRange(fromVal, toVal);
                const kpiRows = kpiDetails.data || [];

                const aggr = {};
                kpiRows.forEach(r => {
                    const codArt = String(r.sku || '');
                    const art7 = codArt.length >= 7 ? codArt.substring(0, 7) : codArt;
                    const maest = maestroMap.get(art7) || { temporada: '-' };
                    const qty = Math.max(0, (r.origResQty || 0) - (r.finalResQty || 0));
                    if (qty <= 0) return;

                    const temp = maest.temporada || '-';
                    if (!aggr[temp]) {
                        aggr[temp] = {
                            temporada: temp,
                            cantidad: 0
                        };
                    }
                    aggr[temp].cantidad += qty;
                });

                const sortedRows = Object.values(aggr).sort((a, b) => b.cantidad - a.cantidad);
                window._lastBufferTemporadaData = sortedRows;

                if (sortedRows.length === 0) {
                    tbodyTemp.innerHTML = `<tr><td colspan="2" style="padding:2rem; text-align:center; color:var(--text-muted);">No hay paletas bajadas en el rango seleccionado.</td></tr>`;
                } else {
                    tbodyTemp.innerHTML = sortedRows.map(r => `
                        <tr style="border-bottom:1px solid #EEE9E3;">
                            <td style="padding:0.35rem 0.5rem; color:#1C2B3A; font-weight:700;">${r.temporada}</td>
                            <td style="padding:0.35rem 0.5rem; font-weight:700; color:#1A6336;">${r.cantidad}</td>
                        </tr>
                    `).join('');
                }
            } catch(e) {
                console.error('[BH] Error agrupando temporadas:', e);
                tbodyTemp.innerHTML = `<tr><td colspan="2" style="padding:2rem; text-align:center; color:#ef4444;">Error al analizar temporadas.</td></tr>`;
            }
        }
    };

    // ── Acciones globales ─────────────────────────────────────────────────────
    window._histEdit = (idx) => { editingIdx = idx; renderHistTable(); };
    window._histCancelEdit = () => { editingIdx = null; renderHistTable(); };

    window._histSave = async (idx) => {
        const newFecha = document.getElementById(`ed_fecha_${idx}`).value;
        const newSol   = parseInt(document.getElementById(`ed_sol_${idx}`).value) || 0;
        const newBaj   = parseInt(document.getElementById(`ed_baj_${idx}`).value) || 0;
        const newDif   = newSol - newBaj;
        const newFill  = newSol > 0 ? ((newBaj / newSol) * 100).toFixed(2) + '%' : '0.00%';

        const updatedRecord = {
            fecha:              newFecha,
            paletasSolicitadas: newSol,
            paletasBajadas:     newBaj,
            diferencias:        newDif,
            fillRate:           newFill
        };

        // Actualizar array local
        kpiHistory[idx] = { ...kpiHistory[idx], ...updatedRecord };

        // Sincronizar con servidor si tiene id
        const recordId = kpiHistory[idx].id;
        if (recordId) {
            updateBufferHistoryRecord(recordId, updatedRecord).then(ok => {
                console.log(ok ? `[BH] ✅ Registro ${recordId} actualizado en servidor.` : `[BH] ⚠️ Error actualizando registro ${recordId}.`);
            });
        }

        // Actualizar localStorage
        localStorage.setItem('logistics_buffer_kpi_history_local', JSON.stringify(kpiHistory));
        editingIdx = null;
        renderHistTable();
    };

    window._histDelete = (idx) => {
        // Modal premium de confirmación
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center; z-index:99999;
            animation: fadeInOverlay 0.15s ease;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
                @keyframes slideUpModal   { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
            </style>
            <div style="
                background:#FFFFFF;
                border:1px solid #DDD8CF;
                border-radius:8px;
                padding:2rem 2.2rem;
                max-width:380px;
                width:90%;
                box-shadow:0 4px 24px rgba(28,43,58,0.15);
                text-align:center;
                animation: slideUpModal 0.2s cubic-bezier(0.4,0,0.2,1);
            ">
                <div style="font-size:2.5rem; margin-bottom:0.8rem;">🗑️</div>
                <h3 style="margin:0 0 0.5rem 0; color:#1C2B3A; font-size:1.05rem; font-weight:700; font-family:'Outfit',sans-serif;">Eliminar Registro</h3>
                <p style="margin:0 0 1.6rem 0; color:#9C9590; font-size:0.82rem; line-height:1.55;">¿Estás seguro de que deseas eliminar este registro del historial? Esta acción no se puede deshacer.</p>
                <div style="display:flex; gap:0.8rem; justify-content:center;">
                    <button id="modal_hist_cancel" style="
                        flex:1; padding:0.6rem 1rem; border-radius:5px;
                        background:#F4F1EC; border:1px solid #DDD8CF;
                        color:#4A4540; font-size:0.82rem; font-weight:600; cursor:pointer;
                        transition:all 0.2s;
                    " onmouseover="this.style.background='#EEE9E3'" onmouseout="this.style.background='#F4F1EC'">Cancelar</button>
                    <button id="modal_hist_confirm" style="
                        flex:1; padding:0.6rem 1rem; border-radius:5px;
                        background:#991B1B; border:none;
                        color:#fff; font-size:0.82rem; font-weight:700; cursor:pointer;
                        transition:all 0.2s;
                    " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">Sí, eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('modal_hist_cancel').onclick = () => overlay.remove();
        document.getElementById('modal_hist_confirm').onclick = async () => {
            overlay.remove();
            const recordId = kpiHistory[idx].id;
            // Eliminar del servidor si tiene id
            if (recordId) {
                deleteBufferHistoryRecord(recordId).then(ok => {
                    console.log(ok ? `[BH] ✅ Registro ${recordId} eliminado del servidor.` : `[BH] ⚠️ Error eliminando registro ${recordId}.`);
                });
            }
            kpiHistory.splice(idx, 1);
            localStorage.setItem('logistics_buffer_kpi_history_local', JSON.stringify(kpiHistory));
            editingIdx = null;
            renderHistTable();
        };
    };

    // ── Sincronizar ────────────────────────────────────────────────────────────
    document.getElementById('btn_hist_sync').onclick = async () => {
        const btnSync = document.getElementById('btn_hist_sync');
        btnSync.disabled = true;
        btnSync.style.opacity = '0.5';
        btnSync.innerHTML = '⏳';
        
        try {
            kpiHistory = await fetchBufferHistory(true);
            renderHistTable();
            showPremiumAlert("¡ÉXITO!", "Historial sincronizado con el servidor correctamente.", "success");
        } catch(err) {
            console.error('[BH] Error sincronizando:', err);
            showPremiumAlert("Error", "No se pudo conectar con el servidor.", "error");
        } finally {
            btnSync.disabled = false;
            btnSync.style.opacity = '1';
            btnSync.innerHTML = '🔄';
        }
    };

    // ── Exportar ──────────────────────────────────────────────────────────────
    document.getElementById('btn_hist_export').onclick = () => {
        const fromVal = document.getElementById('hist_date_from').value;
        const toVal   = document.getElementById('hist_date_to').value;
        const rows = kpiHistory.filter(row => {
            const d = toISO(row.fecha || '');
            return (!fromVal || d >= fromVal) && (!toVal || d <= toVal);
        });
        const data = [['Fecha','Paletas Solicitadas','Paletas Bajadas','Diferencias','Fill Rate']];
        rows.forEach(r => data.push([r.fecha, r.paletasSolicitadas, r.paletasBajadas, r.diferencias, r.fillRate]));
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Conciliacion Paletas');
        XLSX.writeFile(wb, `Historial_Conciliacion_${getLogicalDate()}.xlsx`);
    };

    // ── Exportar Temporadas ───────────────────────────────────────────────────
    document.getElementById('btn_temp_export').onclick = () => {
        const data = window._lastBufferTemporadaData || [];
        if (!data.length) return alert('No hay datos de temporada para exportar.');
        const formatted = [['Temporada', 'Cantidad Bajada']];
        data.forEach(r => formatted.push([r.temporada, r.cantidad]));
        const ws = XLSX.utils.aoa_to_sheet(formatted);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buffer Temporada');
        XLSX.writeFile(wb, `Reporte_Buffer_Temporada_${getLogicalDate()}.xlsx`);
    };

    // ── Filtros de fecha ──────────────────────────────────────────────────────
    document.getElementById('hist_date_from').addEventListener('change', renderHistTable);
    document.getElementById('hist_date_to').addEventListener('change', renderHistTable);

    renderHistTable();

}



// INJECTED FROM DASHBOARD
  const createMatrixHTML = (matrix, title, timestamp = '') => {
    const hasData = matrix && matrix.rows && matrix.rows.length > 0;
    
    const brandAlias = (name) => {
        if (name === 'Bubblegummers Licenses') return 'BG. Licenses';
        if (name === 'Bubblegummers') return 'BG';
        if (name === 'Bata Industrials') return 'Industrials';
        return name;
    };
    const genderAlias = (name) => {
        if (name === '11 NON COMMERCIAL COMPLEMENTS') return '11 COMPLEMENTS';
        return name;
    };

    return `
        <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden; margin-bottom:0.6rem; min-height: 150px;">
            <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-left:3px solid #B45309;">
                <h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">
                    ${title} ${timestamp ? `<span style="font-size:0.68rem; opacity:0.5; margin-left:8px; font-weight:400; vertical-align:middle;">(${timestamp})</span>` : ''}
                </h3>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="background:#1C2B3A; color:#fff;">
                            <th style="padding:0.5rem 0.8rem; text-align:left;">MARCA</th>
                            ${hasData ? matrix.columns.map(c => `<th style="padding:0.5rem 0.3rem; text-align:center; min-width:70px;">${genderAlias(c)}</th>`).join('') : '<th style="padding:0.5rem 0.3rem; text-align:center;">ESTADO</th>'}
                            <th style="padding:0.5rem 0.8rem; text-align:center; color:#F5C97A; font-weight:700;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hasData ? matrix.rows.map(r => `
                            <tr style="border-bottom:1px solid #EEE9E3; ${r.marca==='TOTAL'?'background:#F4F1EC; font-weight:700;':'background:#fff;'}">
                                <td style="padding:0.4rem 0.8rem; font-weight:700; color:${r.marca==='TOTAL'?'#1C2B3A':'#4A4540'};">${brandAlias(r.marca)}</td>
                                ${matrix.columns.map(c => {
                                    const val = r.breakdown[c] || 0;
                                    return `<td style="padding:0.4rem 0.3rem; text-align:center; color:${val > 0 ? '#1C2B3A' : '#DDD8CF'}; font-weight:${val > 0 ? '700' : 'normal'}">${val > 0 ? val.toLocaleString('es-PE') : '0'}</td>`;
                                }).join('')}
                                <td style="padding:0.4rem 0.8rem; text-align:center; background:#FFF8F0; color:#B45309; font-weight:700; border-left:1px solid #EEE9E3;">${r.total.toLocaleString('es-PE')}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="padding:2rem; text-align:center; color:#9C9590; font-style:italic;">No hay datos para procesar en este reporte.</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
  };


let lastBufferResult = null;
async function renderAnalisisBuffer() {
  const container = document.getElementById('contentArea');
  container.innerHTML = `<div style="text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
  
  let data = null;
  try {
    const raw = localStorage.getItem('lastBufferKPI');
    if (raw) data = JSON.parse(raw);
  } catch(e) { console.warn(e); }

  if (!data) {
     container.innerHTML = `<div style="padding:2rem; color:#ef4444; text-align:center;">Error al cargar datos del buffer o no hay datos recientes.</div>`;
     return;
  }

    lastBufferResult = data; // [MOD v12.4.1] Sincronizar estado global para permitir exportación inmediata
    const ts = data.timestamp || new Date().toLocaleString('es-PE');
    const tsHtml = `<span style="font-size:0.7rem; opacity:0.4; margin-left:8px; font-weight:400; vertical-align:middle;">(${ts})</span>`;
    const widthLeft = 'minmax(400px, 1fr)';
    const widthRight = 'minmax(600px, 2fr)';

    container.innerHTML = `
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:start;">
        <div style="display:flex; flex-direction:column; gap:0.6rem; flex:1; min-width:380px;">
            <!-- COLUMNA IZQUIERDA: ZONAS + SKU -->
            <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden;">
                <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-left:3px solid #B45309;"><h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">ANÁLISIS BUFFER ZONAS ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.78rem; white-space:nowrap;">
                    <thead><tr style="background:#1C2B3A; color:#fff;"><th style="padding:0.5rem 1rem; text-align:left;">NIVEL/AREA</th><th style="padding:0.5rem 1rem; text-align:center;">RQ</th><th style="padding:0.5rem 1rem; text-align:center;">ATD</th><th style="padding:0.5rem 1rem; text-align:center;">ATD %</th></tr></thead>
                    <tbody>${data.waterfall.map(r => `<tr style="border-bottom:1px solid #EEE9E3; ${r.nivel==='Total'?'background:#F4F1EC; font-weight:700;':'background:#fff;'}">
                        <td style="padding:0.5rem 1rem; color:${r.nivel==='Total'?'#1C2B3A':'#4A4540'}; font-weight:${r.nivel==='Total'?'700':'500'};">${r.nivel}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#4A4540;">${r.rq.toLocaleString('es-PE')}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:${r.atd > 0 ? '#1C2B3A' : '#DDD8CF'};">${r.atd.toLocaleString('es-PE')}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#1A6336; font-weight:700;">${r.pct}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>

            <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden;">
                <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-left:3px solid #B45309;"><h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">ANÁLISIS BUFFER SKU ${tsHtml}</h3></div>
                <table style="border-collapse:collapse; width:100%; font-size:0.78rem; white-space:nowrap;">
                    <thead><tr style="background:#1C2B3A; color:#fff;"><th style="padding:0.5rem 1rem; text-align:left;">FUENTE</th><th style="padding:0.5rem 1rem; text-align:left;">TIPO</th><th style="padding:0.5rem 1rem; text-align:center;">PALETAS</th><th style="padding:0.5rem 1rem; text-align:center;">SKU</th><th style="padding:0.5rem 1rem; text-align:center;">PAR/CAJA</th></tr></thead>
                    <tbody>${data.resumenSKU.map(r => `<tr style="border-bottom:1px solid #EEE9E3; ${r.fuente.includes('TOTAL') ? 'background:#F4F1EC; font-weight:700;' : 'background:#fff;'}">
                        <td style="padding:0.5rem 1rem; color:#1C2B3A; font-weight:700;">${r.fuente}</td>
                        <td style="padding:0.5rem 1rem; color:#9C9590;">${r.tipo}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#4A4540;">${r.paletas}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#4A4540;">${r.skus}</td>
                        <td style="padding:0.5rem 1rem; text-align:center; color:#1A6336; font-weight:700;">${Number(r.parcaja).toLocaleString('es-PE')}</td>
                    </tr>`).join('')}</tbody>
                </table>
            </div>

            <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; overflow:hidden;">
                <div style="padding:0.5rem 0.8rem; background:#1C2B3A; border-left:3px solid #991B1B;"><h3 style="color:#fff; font-weight:700; margin:0; font-size:0.78rem; letter-spacing:1px; white-space:nowrap; text-transform:uppercase;">RESUMEN 7. SIN STOCK ${tsHtml}</h3></div>
                <div style="display:flex; justify-content:space-around; padding:1.2rem; color:#4A4540;">
                    <div style="text-align:center;">
                        <div style="font-size:0.68rem; color:#9C9590; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad Artículos</div>
                        <div style="font-size:1.6rem; font-weight:700; color:#1C2B3A; font-variant-numeric:tabular-nums;">${(data.sinStockSummary.articulos || 0).toLocaleString('es-PE')}</div>
                    </div>
                    <div style="text-align:center; border-left:1px solid #DDD8CF; padding-left:0.5rem;">
                        <div style="font-size:0.68rem; color:#9C9590; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad SKUs</div>
                        <div style="font-size:1.6rem; font-weight:700; color:#1C2B3A; font-variant-numeric:tabular-nums;">${(data.sinStockSummary.skus || 0).toLocaleString('es-PE')}</div>
                    </div>
                    <div style="text-align:center; border-left:1px solid #DDD8CF; padding-left:0.5rem;">
                        <div style="font-size:0.68rem; color:#9C9590; text-transform:uppercase; margin-bottom:0.3rem;">Cantidad Unidades (RQ)</div>
                        <div style="font-size:1.6rem; font-weight:700; color:#991B1B; font-variant-numeric:tabular-nums;">${(data.sinStockSummary.qty || 0).toLocaleString('es-PE')}</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.6rem; flex:2; min-width:500px;">
            ${createMatrixHTML(data.resumenMatrix, 'DISCREPANCIA BUFFER | ZONAS 3, 4, 5, 6', ts)}
            ${createMatrixHTML(data.resumenMatrixSinStock, 'ANÁLISIS BUFFER | SIN STOCK (ZONA 7)', ts)}
        </div>
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

}


// ============================================================
// MÓDULO ANÁLISIS SKU
// ============================================================
async function renderSkuModule() {
  const area = document.getElementById('contentArea');
  switch(currentSubTab) {
    case 'layout_activo':
      window.__verLayoutAnterior = false; // al entrar al módulo, siempre arranca en "Actual"
      await renderLayoutActivo(area);
      break;
    default:
      renderUnderConstruction(area, 'Análisis SKU');
      break;
  }
}

async function renderInventarioModule() {
  const area = document.getElementById('contentArea');
  switch(currentSubTab) {
    default:
      renderUnderConstruction(area, 'Inventario');
      break;
  }
}

function renderUnderConstruction(container, moduleName) {
  container.innerHTML = `
    <div class="glass-panel" style="padding:4rem; text-align:center; color:#94a3b8; border:1px dashed var(--border);">
      <div style="font-size:3rem; margin-bottom:1rem; opacity:0.3;">🏗️</div>
      <h3 style="color:#fff; margin-bottom:0.5rem;">Reporte en Migración</h3>
      <p style="font-size:0.9rem;">El sub-módulo seleccionado de <b>${moduleName}</b> se encuentra en proceso de adaptación para la vista pública.<br>Estará disponible muy pronto.</p>
    </div>
  `;
}

// ============================================================
// START
// ============================================================
init();
