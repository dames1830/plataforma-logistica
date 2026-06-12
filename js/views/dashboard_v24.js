import { parseFile, parseBufferFiles, getAreaData, clearAreaData, generateKPIs, calculateBufferPallets, fetchBufferConfig, saveBufferConfig, logSystemAction, pingServer, saveBufferReport, loadBufferReport, fetchBufferHistory, dataStore, setDateFilter, currentDateFilter, getUploadMeta, initPersistentData, updateTablaTallas, getCol } from '../services_v245/csvHub_v6.js?v=26.5.121';
// PULSE_ENGINE_V18_2_0_CLEAN_BUILD
import * as adminService from '../services_v245/adminService.js?v=26.5.53';
import { login as authLogin, getSession } from '../services_v245/auth.js?v=26.5.53';
import * as syncEngine from '../services_v245/sync_engine_v24_9.js?v=26.5.53';
import * as cyclicService from '../services_v245/cyclicCountService.js?v=26.5.53';

export const showPremiumAlert = (title, message, type = 'error') => {
    return new Promise((resolve) => {
        // Create backdrop container
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Define colors and icon based on type
        let accentColor = '#ef4444'; // Red for error
        let icon = '❌';
        let glowColor = 'rgba(239, 68, 68, 0.3)';
        
        if (type === 'success') {
            accentColor = '#10b981'; // Green
            icon = '✅';
            glowColor = 'rgba(16, 185, 129, 0.3)';
        } else if (type === 'warning') {
            accentColor = '#f59e0b'; // Amber
            icon = '⚠️';
            glowColor = 'rgba(245, 158, 11, 0.3)';
        } else if (type === 'info') {
            accentColor = '#3b82f6'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(59, 130, 246, 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${glowColor};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            ">
                <div style="
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.2rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: #fff;
                    font-size: 1.3rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    font-weight: 500;
                ">
                    ${message}
                </p>
                
                <button id="premium-alert-btn" style="
                    width: 100%;
                    padding: 0.8rem;
                    border: none;
                    border-radius: 12px;
                    background: linear-gradient(135deg, ${accentColor} 0%, #000 150%);
                    color: #fff;
                    font-size: 0.9rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px ${glowColor};
                    transition: all 0.2s ease;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${glowColor}';" 
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${glowColor}';">
                    ACEPTAR
                </button>
            </div>
            <style>
                @keyframes pulse-icon {
                    0% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px ${accentColor}; }
                    100% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                }
            </style>
        `;
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(1)';
        }, 10);
        
        const closeAlert = () => {
            backdrop.style.opacity = '0';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(0.9)';
            setTimeout(() => {
                backdrop.remove();
                resolve();
            }, 250);
        };
        
        backdrop.querySelector('#premium-alert-btn').onclick = closeAlert;
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeAlert();
        };
    });
};
window.showPremiumAlert = showPremiumAlert;

export const showPremiumConfirm = (title, message, type = 'warning') => {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        let accentColor = '#f59e0b'; // Amber
        let icon = '❓';
        let glowColor = 'rgba(245, 158, 11, 0.3)';
        
        if (type === 'danger') {
            accentColor = '#ef4444'; // Red
            icon = '🚨';
            glowColor = 'rgba(239, 68, 68, 0.3)';
        } else if (type === 'info') {
            accentColor = '#3b82f6'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(59, 130, 246, 0.3)';
        } else if (type === 'success') {
            accentColor = '#10b981'; // Green
            icon = '✅';
            glowColor = 'rgba(16, 185, 129, 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${glowColor};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            ">
                <div style="
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.2rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon-confirm-dash 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: #fff;
                    font-size: 1.3rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-family: 'Outfit', sans-serif;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    font-weight: 500;
                    font-family: 'Inter', sans-serif;
                ">
                    ${message}
                </p>
                
                <div style="
                    display: flex;
                    gap: 1rem;
                    width: 100%;
                ">
                    <button id="premium-confirm-cancel" style="
                        flex: 1;
                        padding: 0.8rem;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        border-radius: 12px;
                        background: rgba(255, 255, 255, 0.05);
                        color: #cbd5e1;
                        font-size: 0.9rem;
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-family: 'Inter', sans-serif;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.color='#fff';" 
                      onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.color='#cbd5e1';">
                        CANCELAR
                    </button>
                    
                    <button id="premium-confirm-ok" style="
                        flex: 1;
                        padding: 0.8rem;
                        border: none;
                        border-radius: 12px;
                        background: linear-gradient(135deg, ${accentColor} 0%, #000 150%);
                        color: #fff;
                        font-size: 0.9rem;
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px ${glowColor};
                        transition: all 0.2s ease;
                        font-family: 'Inter', sans-serif;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${glowColor}';" 
                      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${glowColor}';">
                        ACEPTAR
                    </button>
                </div>
            </div>
            <style>
                @keyframes pulse-icon-confirm-dash {
                    0% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px ${accentColor}; }
                    100% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                }
            </style>
        `;
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(1)';
        }, 10);
        
        const resolveConfirm = (value) => {
            backdrop.style.opacity = '0';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(0.9)';
            setTimeout(() => {
                backdrop.remove();
                resolve(value);
            }, 250);
        };
        
        backdrop.querySelector('#premium-confirm-ok').onclick = () => resolveConfirm(true);
        backdrop.querySelector('#premium-confirm-cancel').onclick = () => resolveConfirm(false);
        backdrop.onclick = (e) => {
            if (e.target === backdrop) resolveConfirm(false);
        };
    });
};
window.showPremiumConfirm = showPremiumConfirm;


// --- SOBREESCRITURA GLOBAL DE ALERTA PARA USAR EL MODAL PREMIUM ---
window.alert = function(message) {
    let type = 'warning';
    let title = 'ATENCIÓN';
    let cleanMessage = String(message || '');

    if (cleanMessage.includes('✅')) {
        type = 'success';
        title = '¡ÉXITO!';
        cleanMessage = cleanMessage.replace(/✅/g, '').trim();
    } else if (cleanMessage.includes('❌') || cleanMessage.includes('🚨') || cleanMessage.toLowerCase().includes('error')) {
        type = 'error';
        title = 'ERROR';
        cleanMessage = cleanMessage.replace(/[❌🚨]/g, '').trim();
    } else if (cleanMessage.includes('⚠️') || cleanMessage.includes('🚧') || cleanMessage.includes('🏗️')) {
        type = 'warning';
        title = 'ADVERTENCIA';
        cleanMessage = cleanMessage.replace(/[⚠️🚧🏗️]/g, '').trim();
    } else if (cleanMessage.includes('📦') || cleanMessage.includes('📡') || cleanMessage.includes('☁️') || cleanMessage.includes('🔒')) {
        type = 'info';
        title = 'INFORMACIÓN';
        cleanMessage = cleanMessage.replace(/[📦📡☁️🔒]/g, '').trim();
    }

    cleanMessage = cleanMessage.replace(/^[:!\s\-]+/, '');
    showPremiumAlert(title, cleanMessage, type);
};

const VERSION = '26.5.121';
const CACHE_KEY = `logistics_v24_prod_`;
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
if (!window.__almacenajeStartDate) window.__almacenajeStartDate = getLogicalDate();
if (!window.__almacenajeEndDate) window.__almacenajeEndDate = getLogicalDate();
if (!window.__kpiStartDate) window.__kpiStartDate = getLogicalDate();
if (!window.__kpiEndDate) window.__kpiEndDate = getLogicalDate();
let expandedWeeks = []; // Semanas expandidas en el historial
let almacenajeTasksCache = [];
try {
    const stored = localStorage.getItem('logistics_sync_v24_almacenaje_tasks');
    if (stored) almacenajeTasksCache = JSON.parse(stored);
} catch(e) { almacenajeTasksCache = []; }
if (!Array.isArray(almacenajeTasksCache)) almacenajeTasksCache = [];

// [MIGRACIÓN DE IDENTIFICADORES] Migrar tareas antiguas sin prefijo de fecha a formato único
let migratedInit = false;
almacenajeTasksCache = almacenajeTasksCache.map(t => {
    if (t && t.id && !t.id.includes('_')) {
        t.id = `${t.fecha}_${t.id}`;
        migratedInit = true;
    }
    return t;
});
if (migratedInit) {
    try {
        localStorage.setItem('logistics_sync_v24_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
    } catch(e){}
}

// --- PERSISTENCIA AVANZADA (IndexedDB vía csvHub) ---
const updateSyncIndicator = (status, text) => {
  const el = document.getElementById('sync-indicator');
  const icon = document.getElementById('sync-icon');
  const txt = document.getElementById('sync-text');
  if (!el) return;
  el.className = `sync-${status}`;
  if (icon) icon.innerText = status === 'online' ? '✅' : (status === 'working' ? '⏳' : '❌');
  if (txt) txt.innerText = text;
};

const saveAlmacenajeTasks = async () => {
  try {
      updateSyncIndicator('working', 'GUARDANDO EN LA NUBE...');
      
      // 1. Persistencia LOCAL inmediata
      localStorage.setItem('logistics_sync_v24_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
      adminService.adminStore.almacenaje_tasks = almacenajeTasksCache;

        // [SIN LÍMITES] Sincronización Completa: Ahora se envía la lista total de tareas sin recortes.
        console.log(`🚀 [PULSE] Sincronización Total: Enviando ${almacenajeTasksCache.length} tareas a la nube.`);
        const success = await adminService.saveAlmacenajeTasks(almacenajeTasksCache);
        
        if (success) {
            updateSyncIndicator('online', 'NUBE ACTUALIZADA ✅');
            setTimeout(() => updateSyncIndicator('online', `SISTEMA v${VERSION} ONLINE`), 3000);
        } else {
            console.warn("⚠️ [SYNC] Error de sincronización. Los datos permanecen seguros en tu PC.");
            updateSyncIndicator('offline', 'PENDIENTE DE SINCRONIZACIÓN');
        }
    } catch (e) { 
        console.error("[SYNC] Error crítico:", e);
        updateSyncIndicator('offline', 'FALLO CRÍTICO DE CONEXIÓN');
    }
};

const loadAlmacenajeTasks = async () => {
  try {
      updateSyncIndicator('working', 'SINCRONIZANDO CON LA NUBE...');
      // Carga desde el puente v24 (que ya hizo el pull)
      const syncedTasks = await adminService.loadAlmacenajeTasks();
      if (Array.isArray(syncedTasks)) {
          // [SINCRONIZACIÓN TOTAL] Ahora permite que la nube limpie los datos locales si se borraron allá.
          if (Array.isArray(syncedTasks)) {
              almacenajeTasksCache = syncedTasks.map(newTask => {
                  const cleanTaskId = (id) => id.includes('_') ? id.split('_')[1] : id;
                  const localTask = almacenajeTasksCache.find(lt => lt.fecha === newTask.fecha && cleanTaskId(lt.id) === cleanTaskId(newTask.id));
                  if (localTask && (!newTask.items || newTask.items.length === 0) && localTask.items && localTask.items.length > 0) {
                      return { ...newTask, items: localTask.items }; // Preservar detalle local
                  }
                  return newTask;
              });
              
              let migratedSynced = false;
              almacenajeTasksCache = almacenajeTasksCache.map(t => {
                  if (t && t.id && !t.id.includes('_')) {
                      t.id = `${t.fecha}_${t.id}`;
                      migratedSynced = true;
                  }
                  return t;
              });
              if (migratedSynced) {
                  setTimeout(() => saveAlmacenajeTasks(), 200);
              }
              
              if (syncedTasks.length === 0 && almacenajeTasksCache.length > 0) {
                  console.log("🧹 [PULL] Sincronización de borrado total desde la nube.");
                  almacenajeTasksCache = [];
              }
          }
          localStorage.setItem('logistics_sync_v24_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
      }
      updateSyncIndicator('online', `SISTEMA v${VERSION} ONLINE`);
  } catch (e) { 
      console.error("[SYNC] Error al cargar:", e);
      updateSyncIndicator('offline', 'MODO OFFLINE ACTIVO');
  }
};

// Radar de sincronización automática (cada 60s)
setInterval(async () => {
    if (document.visibilityState === 'visible') {
        console.log("📡 [RADAR v24] Buscando actualizaciones en la nube...");
        await adminService.initializeAdminData();
        // Solo refrescar si estamos en la pestaña de almacenaje y no hay cambios pendientes locales
        const currentTab = document.querySelector('.nav-item.active')?.dataset.id;
        if (currentTab === 'almacenaje') {
            const synced = adminService.adminStore.almacenaje_tasks;
            if (synced && JSON.stringify(synced) !== JSON.stringify(almacenajeTasksCache)) {
                console.log("✨ [RADAR v24] Datos nuevos detectados. Aplicando Fusión Híbrida.");
                
                // [INTELIGENCIA HÍBRIDA v25.0.0] Blindaje de Hierro: Solo actualizar si la nube tiene DATOS y son IGUAL O MÁS que el PC
                if (synced && synced.length > 0 && synced.length >= almacenajeTasksCache.length) {
                    almacenajeTasksCache = synced.map(newTask => {
                        const localTask = almacenajeTasksCache.find(lt => lt.id === newTask.id);
                        if (localTask && (!newTask.items || newTask.items.length === 0) && localTask.items && localTask.items.length > 0) {
                            return { ...newTask, items: localTask.items };
                        }
                        return newTask;
                    });
                } else {
                    console.log("📡 [RADAR] Nube sin datos. Manteniendo PC local como fuente de verdad.");
                }

                const areaContent = document.getElementById('areaContent');
                if (areaContent) renderAlmacenajeTareas(areaContent);
            }
        }
    }
}, 60000);
    
const restoreAdminDataFromLocal = async () => {
    try {
        updateSyncIndicator('working', 'RESTAURANDO DATOS...');
        const keys = ['workers', 'permissions', 'users', 'attendance'];
        let count = 0;
        for (const key of keys) {
            const stored = localStorage.getItem(`logistics_sync_v24_${key}`);
            if (stored) {
                const data = JSON.parse(stored);
                if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
                    await adminService.save(key, data);
                    count++;
                }
            }
        }
        alert(`✅ ¡Éxito! Se han restaurado ${count} módulos de administración desde tu PC.`);
        location.reload();
    } catch (e) {
        alert("❌ Error al restaurar: " + e.message);
        updateSyncIndicator('online', `SISTEMA v${VERSION} ONLINE`);
    }
};
window.restoreAdminDataFromLocal = restoreAdminDataFromLocal;

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', roles: ['admin', 'jefe', 'supervisor', 'encargado', 'asistente'] },
  { id: 'inventario', label: 'Inventario', icon: '📋', roles: ['admin', 'jefe', 'supervisor'], subTabs: [
    { id: 'archivo_inventario', label: 'Archivo Inventario', icon: '🗂️' },
    { id: 'kpi_inventarios', label: 'KPI Inventarios', icon: '📊' },
    { id: 'analisis_inventarios', label: 'Análisis Inventario', icon: '🔍' },
    { id: 'modulo_inventarios', label: 'Inventarios', icon: '📦', subTabs: [
        { id: 'general', label: 'General', icon: '📝' },
        { id: 'ciclicos', label: 'Cíclicos', icon: '🔄' },
        { id: 'reportes', label: 'Reportes', icon: '📊' }
    ] }
  ]},
  { id: 'picking', label: 'Picking', icon: '🛒', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_picking', label: 'Archivo Picking', icon: '🗂️' }
  ]},
  { id: 'packing', label: 'Packing', icon: '📦', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_packing', label: 'Archivo Packing', icon: '🗂️' }
  ]},
  { id: 'despacho', label: 'Despacho', icon: '🚚', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_despacho', label: 'Archivo Despacho', icon: '🗂️' },
    { id: 'monitoreo_despacho', label: 'Monitoreo de Rutas', icon: '🗺️' },
    { id: 'chofer_despacho', label: 'Portal Chofer', icon: '📱' }
  ]},
  { id: 'no_retail', label: 'NO RETAIL', icon: '🏬', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_no_retail', label: 'Archivo NO RETAIL', icon: '🗂️' },
    { id: 'despacho_no_retail', label: 'Despacho de NO RETAIL', icon: '🚚' },
      { id: 'tracking_no_retail', label: 'Tracking', icon: '📍' }
  ]},
  { id: 'recepcion', label: 'Recepción', icon: '📥', roles: ['admin', 'jefe', 'supervisor', 'encargado'], subTabs: [
    { id: 'archivo_recepcion', label: 'Archivo Recepción', icon: '🗂️' },
    { id: 'reportes_recepcion', label: 'Reportes Recepción', icon: '📊' }
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
    { id: 'kpi_buffer', label: 'Buffer KPI', icon: '📊' },
    { id: 'config_buffer', label: 'Configuración Buffer', icon: '⚙️' }
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
    
    // 0. Copia profunda para evitar mutaciones de estado en sucesivas descargas
    const data = JSON.parse(JSON.stringify(lastBufferResult));

    // 1. Obtener la configuración del buffer guardada
    let savedQtys = {};
    try {
        const config = await fetchBufferConfig();
        if (config && config.brand_gender_qtys) {
            savedQtys = JSON.parse(config.brand_gender_qtys) || {};
        }
    } catch (e) {
        console.warn("[PULSE] Error fetching/parsing buffer config for excel:", e);
    }

    // 2. Construir maestroMap con detección robusta de columnas
    const maestroMap = new Map();
    if (dataStore.articulos) {
        let brandIdx = 13;
        let genderIdx = 3;
        const firstRow = dataStore.articulos[0];
        if (firstRow && Array.isArray(firstRow)) {
            firstRow.forEach((cell, idx) => {
                const cellStr = String(cell || '').trim().toUpperCase();
                if (cellStr === 'MARCA' || cellStr === 'BRAND') {
                    brandIdx = idx;
                } else if (cellStr === 'GENDER RIMS' || cellStr === 'GENDER' || cellStr === 'GENDERRIMS' || cellStr === 'DEPARTAMENTO' || cellStr === 'GENERO') {
                    genderIdx = idx;
                }
            });
        }
        
        let startIndex = 0;
        if (Array.isArray(dataStore.articulos[0])) {
            const firstCell = String(dataStore.articulos[0][0] || '').trim().toUpperCase();
            if (firstCell.includes('SKU') || firstCell.includes('ARTICULO') || firstCell.includes('BARCODE') || firstCell.includes('CODIGO') || firstCell.includes('GENDER') || firstCell.includes('GENERO') || firstCell.includes('MARCA') || firstCell.includes('BRAND')) {
                startIndex = 1;
            }
        }

        for (let i = startIndex; i < dataStore.articulos.length; i++) {
            const row = dataStore.articulos[i];
            if (!row) continue;
            const raw = Array.isArray(row) ? row : Object.values(row);
            if (raw.length <= Math.max(brandIdx, genderIdx)) continue;
            
            const art7 = String(raw[1] || '').trim().substring(0, 7);
            const marca = String(raw[brandIdx] || 'OTROS').trim().toUpperCase();
            const gender = String(raw[genderIdx] || 'OTROS').trim().toUpperCase();
            
            if (art7 && !maestroMap.has(art7)) {
                maestroMap.set(art7, { marca, gender });
            }
        }
    }

    // [OPTIMIZACIÓN SOLUCIÓN 1]
    // La redistribución manual y ad-hoc que se hacía aquí ha sido eliminada por completo.
    // Ahora las cantidades de buffer extra configuradas se integran directamente en el motor 
    // de cálculo central (calculateBufferPallets), garantizando que las LPNs en reserva se
    // busquen, seleccionen y descuenten con absoluta precisión matemática desde el origen.
    // Esto asegura coherencia total entre la interfaz de usuario, las alertas de stock y los reportes descargados.

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

    // Crear un conjunto de LPNs válidos con demanda real (QTY BUFFER > 0)
    const lpnsWithDemand = new Set();
    if (Array.isArray(data.detalle)) {
        data.detalle.forEach(d => {
            if ((d['QTY BUFFER'] || 0) > 0 && d.LPN) {
                lpnsWithDemand.add(d.LPN);
            }
        });
    }

    // Filtrar physicalDetalle para incluir únicamente LPNs que tienen demanda real asignada
    const physicalDetalle = (data.detalle || [])
        .filter(d => String(d.UBICACIONES || '').startsWith('SEL-') && lpnsWithDemand.has(d.LPN))
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
        pageSetup: { 
            printTitlesRow: '1:4',
            margins: { left: 0, right: 0, top: 0.5, bottom: 0, header: 0.3, footer: 0 },
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0
        }
    });

    // Poner N° página en el centro de la cabecera
    wsAnalisis.headerFooter = {
        oddHeader: "&C Página &P de &N",
        evenHeader: "&C Página &P de &N"
    };
    // Re-ajuste de anchos para precisión de píxeles reales con fuente 16
    wsAnalisis.columns = [
        { key: 'ubi', width: 32 },
        { key: 'lpn', width: 30 },
        { key: 'sku', width: 25 },
        { key: 'talla', width: 12 },
        { key: 'marca', width: 22 },
        { key: 'gender', width: 25 },
        { key: 'act', width: 18 },
        { key: 'res', width: 18 },
        { key: 'buf', width: 18 },
        { key: 'extra', width: 18 }
    ];

    wsAnalisis.mergeCells('A1:J1');
    const row1A = wsAnalisis.getRow(1);
    row1A.height = 60;
    row1A.getCell(1).value = 'ANÁLISIS BUFFER';
    row1A.getCell(1).font = { size: 48, bold: true, name: 'Calibri' };
    row1A.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    wsAnalisis.mergeCells('A2:J2');
    const row2A = wsAnalisis.getRow(2);
    row2A.height = 30;
    row2A.getCell(1).value = data.timestamp || new Date().toLocaleString();
    row2A.getCell(1).font = { size: 10, name: 'Calibri' };
    row2A.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const row3A = wsAnalisis.getRow(3);
    row3A.height = 30;

    const row4A = wsAnalisis.getRow(4);
    row4A.values = ["UBICACIÓN", "LPN", "SKU", "TALLAS", "MARCAS", "GENDER RIMS", "QTY ACTIVO", "QTY RESERVA", "QTY BUFFER", "QTY EXTRA"];
    row4A.height = 21;
    row4A.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Calibri' };
    row4A.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    [7, 8, 9, 10].forEach(c => row4A.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });

    // maestroMap ya fue construido robustamente al inicio de la función
    const tallasMap = dataStore.tabla_tallas || {};

    let lastUbi = "", uSumA = 0, uSumR = 0, uSumB = 0, uSumE = 0;
    let gSumA = 0, gSumR = 0, gSumB = 0, gSumE = 0;

    physicalDetalle.forEach((d) => {
        if (lastUbi !== "" && d.UBICACIONES !== lastUbi) {
            const totalRow = wsAnalisis.addRow([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB, uSumE]);
            totalRow.height = 21;
            totalRow.font = { bold: true, size: 16, name: 'Calibri' };
            totalRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } }; // Gris 35%
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { vertical: 'middle' };
            });
            [7, 8, 9, 10].forEach(c => totalRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });
            uSumA = 0; uSumR = 0; uSumB = 0; uSumE = 0;
        }

        const sku = d.SKU;
        const art7 = sku.substring(0, 7);
        const maestro = maestroMap.get(art7) || { marca: '-', gender: '-' };
        const talla = tallasMap[sku] || '-';

        const dataRow = wsAnalisis.addRow([
            d.UBICACIONES !== lastUbi ? d.UBICACIONES : "",
            d.LPN, sku, talla, maestro.marca, maestro.gender,
            d['QTY ACTIVO'], d['QTY RESERVA'], d['QTY BUFFER'],
            d['QTY EXTRA'] || 0
        ]);
        dataRow.height = 21;
        dataRow.font = { size: 16, name: 'Calibri' };
        dataRow.eachCell((cell, colNumber) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'middle' };
            if (colNumber >= 7) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        uSumA += (d['QTY ACTIVO'] || 0); uSumR += (d['QTY RESERVA'] || 0); uSumB += (d['QTY BUFFER'] || 0); uSumE += (d['QTY EXTRA'] || 0);
        gSumA += (d['QTY ACTIVO'] || 0); gSumR += (d['QTY RESERVA'] || 0); gSumB += (d['QTY BUFFER'] || 0); gSumE += (d['QTY EXTRA'] || 0);
        lastUbi = d.UBICACIONES;
    });

    if (lastUbi !== "") {
        const lastTotal = wsAnalisis.addRow([`TOTAL ${lastUbi}`, "", "", "", "", "", uSumA, uSumR, uSumB, uSumE]);
        lastTotal.height = 21;
        lastTotal.font = { bold: true, size: 16, name: 'Calibri' };
        lastTotal.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'middle' };
        });
        [7, 8, 9, 10].forEach(c => lastTotal.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });
    }
    wsAnalisis.addRow([]);
    const gtRow = wsAnalisis.addRow(["TOTAL GENERAL", "", "", "", "", "", gSumA, gSumR, gSumB, gSumE]);
    gtRow.height = 21;
    gtRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    gtRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { vertical: 'middle' };
    });
    [7, 8, 9, 10].forEach(c => gtRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' });

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

const formatDateTime = (isoStr) => {
    if (!isoStr || isoStr === '---' || isoStr === 'null') return '---';
    try {
        const date = new Date(isoStr);
        if (isNaN(date.getTime())) return isoStr;
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    } catch (e) {
        return isoStr;
    }
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

  const isDriverRole = user.role === 'transporte' || user.role === 'transportista' || user.role === 'chofer' || 
                       ((user.role !== 'admin' && user.role !== 'jefe') && (rolePermissions['transporte'] === 1 || rolePermissions['Transporte'] === 1));

  // [PROTECCIÓN] Evitar crash si no hay pestañas permitidas
  const allowedTabs = TABS.filter(t => {
      if (user.role === 'admin') return true;
      if (t.id === 'inicio') return true;
      const dbPerm = rolePermissions[t.id];
      if (dbPerm !== undefined) {
          return dbPerm === 1 || dbPerm === true;
      }
      return t.roles && t.roles.includes(user.role);
  });
  
  if (allowedTabs.length === 0) {
      container.innerHTML = `<div style="color:white; padding:2rem; text-align:center;"><h2>No tienes permisos asignados.</h2><p>Contacta con Daniel Ames.</p><button onclick="location.reload()" class="btn">Reintentar</button></div>`;
      return;
  }
  let currentTab = allowedTabs[0]?.id;

  const updateMobileDriverClass = () => {
    const isMobile = window.innerWidth <= 768;
    const activeSub = localStorage.getItem('activeSub_' + currentTab);
    const isDriverView = (currentTab === 'despacho' && activeSub === 'chofer_despacho') || 
                         (currentTab === 'no_retail' && activeSub === 'despacho_no_retail') ||
                         user.role === 'transporte' || user.role === 'transportista' || user.role === 'chofer' || 
                         ((user.role !== 'admin' && user.role !== 'jefe') && (rolePermissions['transporte'] === 1 || rolePermissions['Transporte'] === 1));
    if (isMobile && isDriverView) {
        document.body.classList.add('mobile-driver-active');
    } else {
        document.body.classList.remove('mobile-driver-active');
    }
  };
  window.addEventListener('resize', updateMobileDriverClass);

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
            LOGÍSTICA <span style="color:#818cf8">DEAM1830</span> 
            <span style="font-size:12px; color:#fbbf24; font-weight:900; margin-left:5px;">v${VERSION}</span>
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
        <div class="tab-header" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h1 id="contentTitle" style="color:var(--primary); font-size:1.8rem; font-weight:800;">Cargando...</h1>
                <p id="contentSubtitle" style="color:var(--text-muted); font-size:0.85rem;"></p>
            </div>
        </div>
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
    updateMobileDriverClass();
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
        if(await showPremiumConfirm("QUITAR ARCHIVO", `¿Estás seguro de que quieres quitar el archivo de ${label}?`, 'danger')) {
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
    } else if (activeBufferSub === 'config_buffer') {
        await renderBufferConfig(buf);
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
                
                // VALIDACIÓN EXPLÍCITA DE ARCHIVOS (Antes de mostrar la barra de progreso)
                if (!dataStore.buffer_activo) {
                    showPremiumAlert("Archivo Faltante", "Falta cargar el archivo de <b>STOCK ACTIVO</b> para poder realizar el análisis.", "error");
                    return;
                }
                if (!dataStore.buffer_reserva) {
                    showPremiumAlert("Archivo Faltante", "Falta cargar el archivo de <b>STOCK RESERVA</b> para poder realizar el análisis.", "error");
                    return;
                }
                if (!dataStore.articulos) {
                    showPremiumAlert("Archivo Faltante", "Falta cargar el archivo <b>MAESTRO</b> para poder realizar el análisis.", "error");
                    return;
                }

                btnCalc.disabled = true; btnCalc.innerHTML = '⚙️ CALCULANDO...';
                results.innerHTML = `
                <div style="width: 100%; padding:5rem 2rem; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); border-radius:16px; border:1px solid rgba(255,255,255,0.05); min-height:300px; box-shadow: inset 0 0 50px rgba(0,0,0,0.5);">
                    <h3 style="font-size:1.4rem; margin:0 0 2.5rem 0; color:#fff; font-weight:800; letter-spacing:2px; text-shadow: 0 0 10px rgba(56,189,248,0.5);">PROCESANDO ANÁLISIS BUFFER</h3>
                    <div style="width: 80%; max-width: 900px; height: 34px; background: #0b1120; border-radius: 20px; box-shadow: inset 0 5px 15px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.1), 0 -1px 0 rgba(0,0,0,0.5); padding: 4px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 4px; left: 4px; height: 26px; border-radius: 14px; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%); box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.3), 0 0 25px rgba(56,189,248,0.7); animation: thick-progress 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;">
                            <div style="position: absolute; top:0; left:0; width:100%; height:100%; border-radius:14px; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px); opacity:0.5;"></div>
                        </div>
                    </div>
                    <p style="margin-top:2.5rem; font-size:0.9rem; color:#94a3b8; font-weight:600; letter-spacing:1px; text-transform:uppercase; animation: pulse-text 1.5s infinite;">Sincronizando maestros y cruzando datos...</p>
                    <style>
                        @keyframes thick-progress { 0% { width: 0%; left: 4px; } 100% { width: calc(100% - 8px); left: 4px; } }
                        @keyframes pulse-text { 0% { opacity:0.5; } 50% { opacity:1; } 100% { opacity:0.5; } }
                    </style>
                </div>`;

                setTimeout(async () => {
                    try {
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
                                if (await showPremiumConfirm("GUARDAR EN HISTORIAL", "¿Deseas guardar este análisis desglosado por FUENTE en el Historial?", "info")) {
                                    const sources = ['PEDIDO', 'OTRAS SOLICITUDES', 'REPLENISHMENT'];
                                    let successCount = 0;
                                    for (const s of sources) {
                                        const sourceRows = res.resumenNiveles.filter(n => n.fuente === s);
                                        if (sourceRows.length > 0) {
                                            const saved = await saveBufferReport({ resumenNiveles: sourceRows, sourceName: s }, user.username);
                                            if (saved) successCount++;
                                        }
                                    }
                                    if (successCount > 0) {
                                        showPremiumAlert("¡Éxito!", `Se guardaron ${successCount} reportes de buffer en el historial de forma segura.`, "success");
                                    }
                                }
                            }, 300);
                        } else {
                            showPremiumAlert("Error de Maestros", "No se pudo realizar el análisis porque faltan los archivos maestros.", "error");
                        }
                    } catch (err) {
                        console.error("Error en proceso:", err);
                        showPremiumAlert("Error Crítico", err.message, "error");
                    } finally {
                        btnCalc.disabled = false; btnCalc.innerHTML = '⚡ PROCESAR ANÁLISIS';
                    }
                }, 2000);
            };
        }

        if (btnReset) {
            btnReset.onclick = async () => {
                if(await showPremiumConfirm('REINICIAR MEMORIA', '¿REINICIAR TODA LA MEMORIA?\n\nEsto borrará todos los archivos cargados localmente para solucionar bloqueos.', 'danger')) {
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
  let activeRFTab = 'inventario';
  let activeInventorySubTab = 'rfs';
  let rfSearchQuery = '';
  let rfStatusFilter = 'todos';
  let scannedRfs = [];
  let revisionDate = new Date().toISOString().split('T')[0];
  let revisionTurn = 'NOCHE';

  const playBeep = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.error("Web Audio beep failed:", e);
    }
  };
  const renderAdminTab = () => {
    // [SUPER PULL v25.0.4] Forzamos descarga REAL de historial reciente al entrar
    syncEngine.pullGlobal(['performance_log', 'almacenaje_tasks'], true);
    
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
    
    window.executeResurrection = async () => {
        console.log("🚀 [PULSE] Iniciando Ejecución Maestra de Resurrección...");
        const btn = document.getElementById('btn_master_resurrection');
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = '⏳ PROCESANDO...';
        
        try {
            const { saveUsers, savePermissions, save, savePerformanceLog } = await import('../services_v245/adminService.js?v=25.2.02');
            
            const extractData = (json) => (json && json.data) ? json.data : json;

            console.log("📡 [1/5] Restaurando Usuarios...");
            const rUsers = await fetch('js/backups_v24/users_data.json');
            const dUsers = extractData(await rUsers.json());
            await saveUsers(dUsers); 
            console.log("✅ Usuarios OK.");

            console.log("📡 [2/5] Restaurando Permisos...");
            const rPerms = await fetch('js/backups_v24/permissions_data.json');
            const rawPerms = await rPerms.json();
            const permsMatrix = (rawPerms.data && rawPerms.data.data) ? rawPerms.data.data : (rawPerms.data || rawPerms);
            for (let role in permsMatrix) {
                await savePermissions(role, permsMatrix[role]);
            }
            console.log("✅ Permisos OK.");

            console.log("📡 [3/5] Restaurando Trabajadores...");
            const rWorkers = await fetch('js/backups_v24/workers_data.json');
            const dWorkers = extractData(await rWorkers.json());
            await save('workers', dWorkers);
            console.log("✅ Trabajadores OK.");

            console.log("📡 [4/5] Restaurando Asistencia...");
            const rAtt = await fetch('js/backups_v24/attendance_data.json');
            const dAtt = extractData(await rAtt.json());
            await save('attendance', dAtt);
            console.log("✅ Asistencia OK.");

            console.log("📡 [5/5] Restaurando Performance...");
            const rPerf = await fetch('js/backups_v24/performance_log_data.json');
            const dPerf = extractData(await rPerf.json());
            await savePerformanceLog(dPerf);
            console.log("✅ Performance OK.");

            // ACTIVAR MODO BLINDADO (10 minutos de paz)
            localStorage.setItem('PULSE_OFFLINE_FORCE', 'true');
            setTimeout(() => localStorage.removeItem('PULSE_OFFLINE_FORCE'), 600000);

            alert("🏗️ MODO BLINDADO ACTIVADO v25.1.98 🏗️\n\nLos datos se han bloqueado localmente por 10 min para evitar errores de sincronización.\n\nYa puedes revisar PERFORMANCE.");
            location.reload();
        } catch (e) {
            console.error("❌ ERROR CRÍTICO EN RESURRECCIÓN:", e);
            alert("❌ Fallo en la restauración: " + e.message);
            btn.disabled = false;
            btn.innerHTML = '🚀 RE-INTENTAR';
        }
    };
    
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
                            ${!syncEngine.isFirstPullDone ? 
                                '<tr><td colspan="6" style="padding:3rem; text-align:center;"><div class="spinner-small" style="display:inline-block; margin-bottom:10px;"></div><br><span style="color:var(--primary); font-weight:700;">Sincronizando con la nube...</span></td></tr>' :
                                (users.length ? users.map(u => `
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
                            `).join('') : '<tr><td colspan="6" style="padding:1rem; text-align:center; color:var(--text-muted);">No hay usuarios adicionales creados.</td></tr>')}
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
                                <option value="transportista" style="background:#1e293b;">TRANSPORTISTA</option>
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
        if (await showPremiumConfirm('ELIMINAR USUARIO', '¿Estás seguro de eliminar permanentemente este usuario?', 'danger')) {
            await adminService.deleteUser(btn.dataset.user);
            renderAdminTab();
        }
    });
  };

  const renderPermisosSection = (container) => {
    const roles = ['jefe', 'coordinador', 'supervisor', 'encargado', 'asistente', 'transportista'];
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
                                const dbVal = adminService.getPermissions(r)?.[t.id];
                                let hasAccess = r === 'admin' ? true : (dbVal !== undefined ? (dbVal === 1 || dbVal === true) : t.roles.includes(r));
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
                                        const dbSubVal = adminService.getPermissions(r)?.[subKey];
                                        let hasSubAccess = r === 'admin' ? true : (dbSubVal !== undefined ? (dbSubVal === 1 || dbSubVal === true) : t.roles.includes(r));
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
                                                const dbSSVal = adminService.getPermissions(r)?.[ssKey];
                                                let hasSSAccess = r === 'admin' ? true : (dbSSVal !== undefined ? (dbSSVal === 1 || dbSSVal === true) : t.roles.includes(r));
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
    const workers = adminService.getWorkers().filter(w => w.active !== false && (w.turno === 'NOCHE' || w.Turno === 'NOCHE') && String(w.puesto || w.Puesto || '').trim().toUpperCase() === 'AYUDANTE DE ALMACEN');
    
    const loadAttendanceState = (dateStr) => {
        const existing = adminService.getAttendance(dateStr);
        if (existing) {
            const uniqueMap = new Map();
            existing.data.forEach(d => {
                if (!uniqueMap.has(String(d.dni))) uniqueMap.set(String(d.dni), { ...d });
            });
            localState = Array.from(uniqueMap.values());
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
                    if (await showPremiumConfirm("REABRIR FECHA", "¿Seguro que deseas REABRIR esta fecha? Se podrá editar nuevamente.", "warning")) {
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
                if (await showPremiumConfirm("CERRAR ASISTENCIA", `¿Confirmas cerrar la asistencia para el día ${forcedDate}?`, "info")) {
                    try {
                        btnClose.disabled = true;
                        btnClose.textContent = "⌛ ENVIANDO...";
                        const success = await adminService.saveAttendance(forcedDate, { finalized: true, data: localState });
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
    if (!syncEngine.isFirstPullDone) {
        container.innerHTML = `<div class="glass-panel" style="padding:5rem; text-align:center;">
            <div class="spinner" style="margin:0 auto 1.5rem auto;"></div>
            <h4 style="color:var(--primary); font-weight:800;">Sincronizando Performance...</h4>
            <p style="color:var(--text-muted); font-size:0.85rem;">Obteniendo últimos registros de la nube.</p>
        </div>`;
        return;
    }
    if (rawLog.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
            <i class="fas fa-chart-line fa-3x" style="opacity:0.2; margin-bottom:1rem;"></i>
            <h4>Sin datos de Performance</h4>
            <p style="font-size:0.85rem;">Es necesario cerrar la asistencia de uno o más días para generar estadísticas.</p>
            <button id="btn_retry_sync_perf" class="btn-secondary" style="margin-top:1.5rem; padding:0.5rem 1rem;">🔄 Reintentar Sincronización</button>
        </div>`;
        const btnRetry = document.getElementById('btn_retry_sync_perf');
        if (btnRetry) btnRetry.onclick = async () => {
            btnRetry.disabled = true;
            btnRetry.innerHTML = '⌛ Sincronizando...';
            await adminService.initializeAdminData(true);
            renderKPIGraphsSection(container);
        };
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
    if (!syncEngine.isFirstPullDone) {
        container.innerHTML = `<div class="glass-panel" style="padding:5rem; text-align:center;"><div class="spinner" style="margin:0 auto 1rem auto;"></div><h4 style="color:var(--primary);">Calculando Reporte...</h4></div>`;
        return;
    }
    if (!rawLog || rawLog.length === 0) {
        container.innerHTML = `<div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
            <h4>Sin datos para el reporte</h4>
            <button id="btn_retry_report" class="btn-secondary" style="margin-top:1rem; padding:0.5rem 1rem;">🔄 Refrescar Datos</button>
        </div>`;
        const btn = document.getElementById('btn_retry_report');
        if (btn) btn.onclick = async () => {
            btn.disabled = true;
            await adminService.initializeAdminData(true);
            renderKPIReportSection(container);
        };
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; gap:1rem;">
            <nav style="display:flex; gap:1.2rem;">
              ${allowedSubSubs.map(ss => `
                <a class="perf-sub-item ${activePerfSub===ss.id?'active':''}" data-ss="${ss.id}" style="padding: 0.5rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${activePerfSub===ss.id?'var(--primary)':'var(--text-muted)'}; font-weight:${activePerfSub===ss.id?'800':'500'}; text-decoration:none; border-bottom:${activePerfSub===ss.id?'2px solid var(--primary)':'none'};">
                    ${ss.icon} ${ss.label.toUpperCase()}
                </a>
              `).join('')}
            </nav>
            <button id="btn_sync_performance_cloud" class="btn-primary" style="font-size:0.75rem; padding:0.5rem 1rem; border-radius:8px; background:var(--primary); color:#fff; font-weight:800; cursor:pointer; box-shadow: 0 4px 10px rgba(79,70,229,0.4); border:none; display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.1rem;">🔄</span> SINCRONIZAR CLOUD
            </button>
        </div>
        <div id="perfContent"></div>`;
    
    console.log("🛠️ [PULSE] Renderizando Sección Performance con Botón Sincronizar");
    
    const btnSync = document.getElementById('btn_sync_performance_cloud');
    if (btnSync) {
        btnSync.onclick = async () => {
            btnSync.innerHTML = '⌛ SINCRONIZANDO...';
            btnSync.style.opacity = '0.5';
            btnSync.disabled = true;
            await adminService.initializeAdminData(true);
            btnSync.innerHTML = '✅ ACTUALIZADO';
            setTimeout(() => {
                btnSync.innerHTML = '🔄 SINCRONIZAR CLOUD';
                btnSync.style.opacity = '1';
                btnSync.disabled = false;
            }, 2000);
            renderPerformanceSection(container);
        };
    }

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
    if (!Array.isArray(log)) log = [];
    
    window.exportPerformanceToExcel = () => {
        if (!log.length) return alert('No hay datos para exportar.');
        const dataToExport = log.map(p => {
            const worker = adminService.getWorkers().find(w => (w.dni || w.Dni) === p.dni);
            const displayName = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${p.apellidos}, ${p.nombre}`;
            return {
                'Fecha': p.date,
                'DNI': p.dni,
                'Nombre': displayName,
                'Asistencia': p.asistencia,
                'Puntualidad': p.puntualidad,
                'Producción': p.produccion,
                'BPA': p.bpa,
                'Supervisor': p.supervisor,
                'Rendimiento %': p.rendimiento
            };
        });
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Performance");
        XLSX.writeFile(wb, `Performance_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const grouped = log.reduce((acc, p) => {
        if (!acc[p.date]) acc[p.date] = [];
        acc[p.date].push(p);
        return acc;
    }, {});

    const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3 style="color:var(--primary); margin:0;">Historial de Performance Diaria</h3>
            <button onclick="exportPerformanceToExcel()" class="btn" style="width:auto; background:#10b981; padding:0.6rem 1.2rem; font-size:0.8rem; font-weight:800;">📊 EXPORTAR A EXCEL</button>
        </div>
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                    <tr>
                        <th style="padding:0.8rem; text-align:center; width:45px;">#</th>
                        <th style="padding:0.8rem; text-align:left;">TRABAJADOR / DNI</th>
                        <th style="padding:0.8rem; text-align:center;">ASIST.</th>
                        <th style="padding:0.8rem; text-align:center;">PUNT.</th>
                        <th style="padding:0.8rem; text-align:center;">PROD.</th>
                        <th style="padding:0.8rem; text-align:center;">BPA</th>
                        <th style="padding:0.8rem; text-align:center;">SUP.</th>
                        <th style="padding:0.8rem; text-align:center;">JUST.</th>
                        <th style="padding:0.8rem; text-align:center; background:rgba(79,70,229,0.1);">RENDIMIENTO %</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedDates.length ? sortedDates.map(date => {
                        const entries = grouped[date];
                        const avgRend = Math.round(entries.reduce((sum, e) => sum + (parseInt(e.rendimiento) || 0), 0) / entries.length);
                        return `
                        <tr class="perf-date-header" data-date="${date}" style="cursor:pointer; background:rgba(79,70,229,0.05); border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td colspan="8" style="padding:0.8rem; text-align:left; color:#fff; font-weight:800;">📅 ${date} <small style="margin-left:15px; color:rgba(255,255,255,0.3);">(${entries.length} registros)</small></td>
                            <td style="padding:0.8rem; text-align:center; background:rgba(79,70,229,0.1); color:var(--primary); font-weight:900;"><span id="avg-${date}">${avgRend}%</span></td>
                        </tr>
                        ${entries.sort((a, b) => {
                            const workerA = adminService.getWorkers().find(w => (w.dni || w.Dni || '').toString().trim() === (a.dni || '').toString().trim());
                            const workerB = adminService.getWorkers().find(w => (w.dni || w.Dni || '').toString().trim() === (b.dni || '').toString().trim());
                            const nameA = workerA ? `${workerA.apellidos || workerA.Apellidos || ''}, ${workerA.nombre || workerA.Nombre || ''}` : `${a.apellidos || ''}, ${a.nombre || ''}`;
                            const nameB = workerB ? `${workerB.apellidos || workerB.Apellidos || ''}, ${workerB.nombre || workerB.Nombre || ''}` : `${b.apellidos || ''}, ${b.nombre || ''}`;
                            return nameA.localeCompare(nameB);
                        }).map((p, idx) => {
                            const pDni = (p.dni || '').toString().trim();
                            const worker = adminService.getWorkers().find(w => {
                                const wDni = (w.dni || w.Dni || '').toString().trim();
                                return wDni === pDni && wDni !== '';
                            });
                            const displayName = worker ? `${worker.apellidos || worker.Apellidos || ''}, ${worker.nombre || worker.Nombre || ''}` : `${p.apellidos || ''}, ${p.nombre || ''}`;
                            return `
                        <tr class="perf-row-${date}" style="display:none; border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:0.8rem; text-align:center; color:var(--text-muted);">${idx + 1}</td>
                            <td style="padding:0.8rem; display:flex; align-items:center;"><b>${displayName}</b> <span style="background:#fcd34d; color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:800; margin-left:8px;">${p.dni}</span></td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select class="edit-perf-log" data-date="${p.date}" data-dni="${p.dni}" data-f="asistencia" style="background:none; border:none; color:${p.asistencia==='P'?'var(--success)':'#ef4444'}; font-weight:900;">
                                    <option value="P" ${p.asistencia==='P'?'selected':''}>P</option>
                                    <option value="F" ${p.asistencia==='F'?'selected':''}>F</option>
                                </select>
                            </td>
                            <td style="padding:0.8rem; text-align:center;">
                                <select class="edit-perf-log" data-date="${p.date}" data-dni="${p.dni}" data-f="puntualidad" style="background:none; border:none; color:${p.puntualidad==='SÍ'?'var(--success)':'#ef4444'}; font-weight:700;">
                                    <option value="SÍ" ${p.puntualidad==='SÍ'?'selected':''}>SÍ</option>
                                    <option value="NO" ${p.puntualidad==='NO'?'selected':''}>NO</option>
                                </select>
                            </td>
                            <td style="padding:0.8rem; text-align:center;"><input type="number" step="0.1" value="${p.produccion}" data-date="${p.date}" data-dni="${p.dni}" data-f="produccion" class="edit-perf-log" style="width:35px; background:none; border:none; color:#fff; text-align:center;"></td>
                            <td style="padding:0.8rem; text-align:center;"><input type="number" step="0.1" value="${p.bpa}" data-date="${p.date}" data-dni="${p.dni}" data-f="bpa" class="edit-perf-log" style="width:35px; background:none; border:none; color:#fff; text-align:center;"></td>
                            <td style="padding:0.8rem; text-align:center;"><input type="number" step="0.1" value="${p.supervisor}" data-date="${p.date}" data-dni="${p.dni}" data-f="supervisor" class="edit-perf-log" style="width:35px; background:none; border:none; color:#fff; text-align:center;"></td>
                            <td style="padding:0.8rem; text-align:center;"><input type="text" value="${p.justification || ''}" data-date="${p.date}" data-dni="${p.dni}" data-f="justification" class="edit-perf-log" placeholder="---" style="width:100%; background:none; border:none; color:${p.justification?'#06b6d4':'rgba(255,255,255,0.1)'}; text-align:center; font-size:0.7rem; outline:none;"></td>
                            <td style="padding:0.8rem; text-align:center; background:rgba(79,70,229,0.1); font-weight:900; color:#fff;" id="rend-${p.dni}-${p.date}">${p.rendimiento}</td>
                        </tr>`;
                        }).join('')}`;
                    }).join('') : '<tr><td colspan="9" style="padding:2rem; text-align:center; color:var(--text-muted);">Sin registros.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.perf-date-header').forEach(header => {
        header.onclick = () => {
            const rows = document.querySelectorAll(`.perf-row-${header.dataset.date}`);
            rows.forEach(r => r.style.display = r.style.display === 'none' ? 'table-row' : 'none');
        };
    });

    document.querySelectorAll('.edit-perf-log').forEach(input => {
        input.onchange = async (e) => {
            const { date, dni, f } = e.target.dataset;
            const updatedEntry = await adminService.updatePerformanceLogEntry(date, dni, { [f]: e.target.value });
            
            // Actualización local del DOM para evitar pantallazos
            if (updatedEntry) {
                const rendCell = document.getElementById(`rend-${dni}-${date}`);
                if (rendCell) {
                    rendCell.textContent = updatedEntry.rendimiento;
                }
                
                if (f === 'asistencia') {
                    e.target.style.color = e.target.value === 'P' ? 'var(--success)' : '#ef4444';
                }
                if (f === 'puntualidad') {
                    e.target.style.color = e.target.value === 'SÍ' ? 'var(--success)' : '#ef4444';
                }
                if (f === 'justification') {
                    e.target.style.color = e.target.value ? '#06b6d4' : 'rgba(255,255,255,0.1)';
                }
                
                // Recalcular promedio de la fecha
                const dateRows = document.querySelectorAll(`.perf-row-${date}`);
                let sumRend = 0;
                let count = 0;
                dateRows.forEach(row => {
                    const rendText = row.querySelector(`[id^="rend-"]`)?.textContent;
                    if (rendText) {
                        sumRend += parseInt(rendText) || 0;
                        count++;
                    }
                });
                if (count > 0) {
                    const avgSpan = document.getElementById(`avg-${date}`);
                    if (avgSpan) {
                        avgSpan.textContent = Math.round(sumRend / count) + '%';
                    }
                }
            }
        };
    });
  };


const renderRFSection = (container) => {
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

        const expectedRFSerials = [];
    const expectedRFDetails = {};
    
    rfs.forEach(r => {
      if (r.estado === 'Operativo') {
        expectedRFSerials.push(r.serie);
        // Buscar la última asignación de este equipo para mostrar detalles de quién lo usó por última vez
        const rfAsigs = assignments.filter(a => a.rf_serial === r.serie);
        if (rfAsigs.length > 0) {
          rfAsigs.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));
          expectedRFDetails[r.serie] = rfAsigs[0];
        }
      }
    });

    const totalExpected = expectedRFSerials.length;
    const foundExpectedSerials = scannedRfs.filter(s => expectedRFSerials.includes(s.serial)).map(s => s.serial);
    const uniqueFoundExpected = [...new Set(foundExpectedSerials)].length;
    const pendingCount = totalExpected - uniqueFoundExpected;
    
    const unexpectedScans = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
    const uniqueUnexpected = [...new Set(unexpectedScans.map(s => s.serial))].length;

    // Auto-sanear inconsistencias de RFs de forma bidireccional
    let rfsChanged = false;
    
    // 1. Limpiar RFs que figuran como asignados pero no tienen asignación activa en la bitácora
    rfs.forEach(r => {
      if (r.asignadoDni) {
        const hasActive = assignments.some(a => a.rf_serial === r.serie && !a.returned_at);
        if (!hasActive) {
          console.warn(`[PULSE] Auto-saneando RF ${r.serie}: figuraba como asignado pero no tiene asignación activa en bitácora.`);
          r.asignadoDni = null;
          r.asignadoNombre = null;
          r.asignadoTurno = null;
          rfsChanged = true;
        }
      }
    });

    // 2. Asignar RFs que tienen asignación activa en la bitácora pero figuran como disponibles en inventario
    assignments.forEach(a => {
      if (!a.returned_at) {
        const rf = rfs.find(r => r.serie === a.rf_serial);
        if (rf && !rf.asignadoDni) {
          console.warn(`[PULSE] Auto-saneando RF ${rf.serie}: tiene asignación activa para ${a.worker_name} pero figuraba como disponible.`);
          rf.asignadoDni = a.worker_dni;
          rf.asignadoNombre = a.worker_name;
          rf.asignadoTurno = a.turn;
          rfsChanged = true;
        }
      }
    });

    if (rfsChanged) {
      adminService.saveRfs(rfs);
    }
    const workers = adminService.getWorkers() || [];
    const batteries = adminService.getRfsBatteries() || [];
    const chargers = adminService.getRfsChargers() || [];

    // Calcular métricas dinámicas según pestaña
    let metricsHtml = '';
    if (activeRFTab === 'revision') {
      metricsHtml = `
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">📋</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Esperados</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalExpected}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✔️</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Coincidentes OK</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${uniqueFoundExpected}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #ef4444; background:rgba(239,68,68,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(239,68,68,0.4));">⏳</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Pendientes</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#ef4444;">${pendingCount}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">❌</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Inesperados</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${uniqueUnexpected}</p>
          </div>
        </div>
      `;
    } else if (activeRFTab === 'inventario') {
      if (activeInventorySubTab === 'rfs') {
        const totalRFs = rfs.length;
        const availableRFs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni).length;
        const assignedRFs = rfs.filter(r => r.asignadoDni).length;
        const maintenanceRFs = rfs.filter(r => r.estado === 'En Mantenimiento').length;
        const avgBattery = totalRFs ? Math.round(rfs.reduce((sum, r) => sum + parseInt(r.bateria || 0), 0) / totalRFs) : 0;
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--primary); background:rgba(79,70,229,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(79,70,229,0.4));">📡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Equipos RF</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Disponibles</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${availableRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">👷</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Uso</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#06b6d4;">${assignedRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintenanceRFs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Batería</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${avgBattery}%</p>
            </div>
          </div>
        `;
      } else if (activeInventorySubTab === 'baterias') {
        const totalBats = batteries.length;
        const opBats = batteries.filter(b => b.estado === 'Operativo').length;
        const maintBats = batteries.filter(b => b.estado === 'En Mantenimiento').length;
        const bajaBats = batteries.filter(b => b.estado === 'De Baja').length;
        const avgHealth = totalBats ? Math.round(batteries.reduce((sum, b) => sum + parseInt(b.salud || 0), 0) / totalBats) : 0;
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Baterías</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Operativas</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${opBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #ef4444; background:rgba(239,68,68,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(239,68,68,0.4));">🚨</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">De Baja</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#ef4444;">${bajaBats}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">❤️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Salud</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${avgHealth}%</p>
            </div>
          </div>
        `;
      } else {
        const totalChgs = chargers.length;
        const opChgs = chargers.filter(c => c.estado === 'Operativo').length;
        const maintChgs = chargers.filter(c => c.estado === 'En Mantenimiento').length;
        const totalSlots = chargers.reduce((sum, c) => sum + parseInt(c.capacidad || 0), 0);
        const totalSlotsOk = chargers.reduce((sum, c) => sum + parseInt(c.ranuras_ok || 0), 0);
        
        metricsHtml = `
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">🔌</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Cargadores</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Cargadores OK</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${opChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Cargadores Taller</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintChgs}</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #3b82f6; background:rgba(59,130,246,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(59,130,246,0.4));">⚡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Ranuras Totales</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#3b82f6;">${totalSlots} ranuras</p>
            </div>
          </div>
          <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
            <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">⚡</span>
            <div>
              <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Ranuras OK</h5>
              <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${totalSlotsOk} / ${totalSlots}</p>
            </div>
          </div>
        `;
      }
    } else {
      const totalRFs = rfs.length;
      const availableRFs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni).length;
      const assignedRFs = rfs.filter(r => r.asignadoDni).length;
      const maintenanceRFs = rfs.filter(r => r.estado === 'En Mantenimiento').length;
      const avgBattery = totalRFs ? Math.round(rfs.reduce((sum, r) => sum + parseInt(r.bateria || 0), 0) / totalRFs) : 0;
      
      metricsHtml = `
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--primary); background:rgba(79,70,229,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(79,70,229,0.4));">📡</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Total Equipos RF</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#fff;">${totalRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid var(--success); background:rgba(34,197,94,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(34,197,94,0.4));">✅</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Disponibles</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:var(--success);">${availableRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #06b6d4; background:rgba(6,182,212,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(6,182,212,0.4));">👷</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Uso</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#06b6d4;">${assignedRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #f59e0b; background:rgba(245,158,11,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(245,158,11,0.4));">🛠️</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">En Taller</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#f59e0b;">${maintenanceRFs}</p>
          </div>
        </div>
        <div class="glass-panel" style="padding:1.2rem; display:flex; align-items:center; gap:12px; border-left:4px solid #10b981; background:rgba(16,185,129,0.03);">
          <span style="font-size:2rem; filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));">🔋</span>
          <div>
            <h5 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Promedio Batería</h5>
            <p style="margin:4px 0 0 0; font-size:1.6rem; font-weight:900; color:#10b981;">${avgBattery}%</p>
          </div>
        </div>
      `;
    }

    // Filtrar equipos
    let filteredRfs = [...rfs];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredRfs = filteredRfs.filter(r => 
        (r.serie || '').toLowerCase().includes(q) || 
        (r.marca || '').toLowerCase().includes(q) || 
        (r.modelo || '').toLowerCase().includes(q) ||
        (r.asignadoNombre || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredRfs = filteredRfs.filter(r => r.estado === rfStatusFilter);
    }

    // Filtrar baterías
    let filteredBatteries = [...batteries];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredBatteries = filteredBatteries.filter(b => 
        (b.codigo || '').toLowerCase().includes(q) || 
        (b.modelo || '').toLowerCase().includes(q) || 
        (b.ubicacion || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredBatteries = filteredBatteries.filter(b => b.estado === rfStatusFilter);
    }

    // Filtrar cargadores
    let filteredChargers = [...chargers];
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredChargers = filteredChargers.filter(c => 
        (c.codigo || '').toLowerCase().includes(q) || 
        (c.marca || '').toLowerCase().includes(q) || 
        (c.modelo || '').toLowerCase().includes(q) || 
        (c.ubicacion || '').toLowerCase().includes(q)
      );
    }
    if (rfStatusFilter && rfStatusFilter !== 'todos') {
      filteredChargers = filteredChargers.filter(c => c.estado === rfStatusFilter);
    }

    // Filtrar asignaciones
    let filteredAssignments = [...assignments].sort((a,b) => new Date(b.assigned_at) - new Date(a.assigned_at));
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase().trim();
      filteredAssignments = filteredAssignments.filter(a => 
        (a.rf_serial || '').toLowerCase().includes(q) || 
        (a.worker_name || '').toLowerCase().includes(q) || 
        (a.worker_dni || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      );
    }

    // Listado para pestaña ASIGNAR RF
    const availableOperativeRfs = rfs.filter(r => r.estado === 'Operativo' && !r.asignadoDni).sort((a, b) => {
      const numA = parseInt(a.numero) || 0;
      const numB = parseInt(b.numero) || 0;
      return numA - numB;
    });
    const activeWorkers = workers.filter(w => w.active !== false);
    let activeAssignments = assignments.filter(a => !a.returned_at);
    
    if (rfSearchQuery) {
      const q = rfSearchQuery.toLowerCase();
      activeAssignments = activeAssignments.filter(a => {
        const rfInfo = rfs.find(r => r.serie === a.rf_serial);
        const numero = rfInfo && rfInfo.numero ? rfInfo.numero : '';
        return (
          (a.rf_serial || '').toLowerCase().includes(q) || 
          (a.worker_name || '').toLowerCase().includes(q) || 
          (a.worker_dni || '').toLowerCase().includes(q) ||
          (a.notes || '').toLowerCase().includes(q) ||
          numero.toLowerCase().includes(q)
        );
      });
    }

    activeAssignments.sort((a, b) => {
      const rfA = rfs.find(r => r.serie === a.rf_serial);
      const rfB = rfs.find(r => r.serie === b.rf_serial);
      const numA = parseInt(rfA && rfA.numero ? rfA.numero : 0) || 0;
      const numB = parseInt(rfB && rfB.numero ? rfB.numero : 0) || 0;
      return numA - numB;
    });

    container.innerHTML = `
      <!-- METRICS CARDS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        ${metricsHtml}
      </div>

      <!-- HEADER ACTION BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; width:100%;">
        <!-- TAB SELECTOR -->
        <nav style="display:flex; gap:1.2rem;">
          <a class="perf-sub-item ${activeRFTab==='inventario'?'active':''}" id="rf_tab_inventario">📁 INVENTARIO</a>
          <a class="perf-sub-item ${activeRFTab==='asignar'?'active':''}" id="rf_tab_asignar">🔑 ASIGNAR RF</a>
          <a class="perf-sub-item ${activeRFTab==='asignaciones'?'active':''}" id="rf_tab_asignaciones">📝 BITÁCORA</a>
          <a class="perf-sub-item ${activeRFTab==='revision'?'active':''}" id="rf_tab_revision">🔍 REVISIÓN RF</a>
        </nav>

        <!-- SEARCH AND ADD -->
        ${activeRFTab !== 'revision' ? `
        <div style="display:flex; gap:0.8rem; align-items:center; flex-wrap:wrap; padding-bottom:0.3rem;">
          <div style="display:flex; gap:0.4rem; align-items:center;">
            <input type="text" id="rf_search_input" placeholder="🔍 Buscar..." value="${rfSearchQuery}" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); color:#fff; padding:0.5rem 1rem; border-radius:8px; font-size:0.8rem; outline:none; width:220px;">
            <button id="rf_btn_sync" class="btn" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; padding:0.5rem; border-radius:8px; cursor:pointer;" title="Sincronizar">🔄</button>
          </div>
          ${activeRFTab === 'inventario' ? `
            <select id="rf_status_filter" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; padding:0.5rem; border-radius:8px; font-size:0.8rem; outline:none; cursor:pointer;">
              <option value="todos" ${rfStatusFilter==='todos'?'selected':''}>- TODOS LOS ESTADOS -</option>
              <option value="Operativo" ${rfStatusFilter==='Operativo'?'selected':''}>OPERATIVO</option>
              <option value="En Mantenimiento" ${rfStatusFilter==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
              <option value="De Baja" ${rfStatusFilter==='De Baja'?'selected':''}>DE BAJA</option>
            </select>
            ${activeInventorySubTab === 'rfs' ? `
              <button id="btn_new_rf" class="btn" style="width:auto; background:var(--primary); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px;">📡 REGISTRAR EQUIPO</button>
            ` : activeInventorySubTab === 'baterias' ? `
              <button id="btn_new_battery" class="btn" style="width:auto; background:linear-gradient(135deg, #10b981 0%, #064e3b 150%); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px; border:none; color:#fff; cursor:pointer; box-shadow:0 4px 10px rgba(16,185,129,0.3);">🔋 REGISTRAR BATERÍA</button>
            ` : `
              <button id="btn_new_charger" class="btn" style="width:auto; background:linear-gradient(135deg, #06b6d4 0%, #083344 150%); font-size:0.78rem; padding:0.5rem 1.2rem; font-weight:800; border-radius:8px; border:none; color:#fff; cursor:pointer; box-shadow:0 4px 10px rgba(6,182,212,0.3);">🔌 REGISTRAR CARGADOR</button>
            `}
          ` : ''}
        </div>
        ` : `
        <div style="font-size:0.75rem; color:#818cf8; font-weight:800; background:rgba(129,140,248,0.1); border:1px solid rgba(129,140,248,0.2); padding:5px 12px; border-radius:20px; letter-spacing:0.5px;">
          🖥️ MÓDULO DE VERIFICACIÓN AUTOMÁTICO
        </div>
        `}
      </div>

      <!-- MAIN CONTENT -->
      ${activeRFTab === 'inventario' ? `
        <!-- SUB-TAB SELECTOR -->
        <div style="display:flex; margin-bottom:1.2rem; width:100%; gap:1.2rem;">
          <a class="perf-sub-item ${activeInventorySubTab==='rfs'?'active':''}" id="rf_sub_tab_rfs">📡 EQUIPOS RF</a>
          <a class="perf-sub-item ${activeInventorySubTab==='baterias'?'active':''}" id="rf_sub_tab_baterias">🔋 BATERÍAS</a>
          <a class="perf-sub-item ${activeInventorySubTab==='cargadores'?'active':''}" id="rf_sub_tab_cargadores">🔌 CARGADORES</a>
        </div>
        
        ${activeInventorySubTab === 'rfs' ? `
          <!-- TABLE INVENTARIO EQUIPOS RF -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Serie</th>
                  <th style="padding:0.8rem; text-align:left;">Marca / Modelo</th>
                  <th style="padding:0.8rem; text-align:left;">Número</th>
                  <th style="padding:0.8rem; text-align:left;">Batería</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:left;">Observación</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRfs.length ? filteredRfs.map((r, idx) => {
                  const bat = parseInt(r.bateria || 0);
                  const batColor = bat >= 70 ? '#10b981' : (bat >= 30 ? '#f59e0b' : '#ef4444');
                  const isPulsing = bat < 30 ? 'animation: pulse-bat 1.2s infinite alternate;' : '';
                  
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (r.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (r.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${r.serie}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        <span style="font-weight:600; color:#cbd5e1;">${r.marca || ''}</span> 
                        <span style="color:var(--text-muted); font-size:0.7rem;">${r.modelo || ''}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        ${r.numero ? `<span style="background:rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.3); color:#a5b4fc; padding:3px 9px; border-radius:6px; font-family:monospace; font-size:0.8rem; font-weight:700;">${r.numero}</span>` : `<span style="color:rgba(255,255,255,0.2); font-size:0.75rem;">—</span>`}
                      </td>
                      <td style="padding:0.8rem;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:38px; height:18px; border:1.5px solid rgba(255,255,255,0.3); border-radius:4px; padding:2px; position:relative; display:flex; ${isPulsing}">
                            <div style="width:${bat}%; height:100%; background:${batColor}; border-radius:2px; transition: width 0.3s ease;"></div>
                            <div style="width:3px; height:6px; background:rgba(255,255,255,0.3); position:absolute; right:-4.5px; top:4.5px; border-radius: 0 1px 1px 0;"></div>
                          </div>
                          <span style="font-weight:800; color:#fff; font-size:0.75rem;">${bat}%</span>
                        </div>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${r.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; font-size:0.75rem; color:var(--text-muted); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.comentarios || ''}">
                        ${r.comentarios || '—'}
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-rf" data-rf='${JSON.stringify(r).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-rf" data-serie="${r.serie}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron equipos registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        ` : activeInventorySubTab === 'baterias' ? `
          <!-- TABLE INVENTARIO BATERÍAS -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Código de Batería</th>
                  <th style="padding:0.8rem; text-align:left;">Compatibilidad (Modelo)</th>
                  <th style="padding:0.8rem; text-align:left;">Salud / Vida Útil</th>
                  <th style="padding:0.8rem; text-align:left;">Ubicación / Ranura</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredBatteries.length ? filteredBatteries.map((b, idx) => {
                  const salud = parseInt(b.salud || 100);
                  const saludColor = salud >= 80 ? '#10b981' : (salud >= 60 ? '#f59e0b' : '#ef4444');
                  
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (b.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (b.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${b.codigo}</span>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">${b.modelo || 'Universal'}</td>
                      <td style="padding:0.8rem;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="font-weight:900; color:${saludColor};">${salud}%</div>
                          <div style="font-size:0.65rem; color:var(--text-muted);">
                            (${salud >= 80 ? 'Excelente' : (salud >= 60 ? 'Bueno' : 'Desgastada')})
                          </div>
                        </div>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">📍 ${b.ubicacion || 'Estante Principal'}</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${b.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-battery" data-battery='${JSON.stringify(b).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-battery" data-codigo="${b.codigo}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="7" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron baterías registradas.</td></tr>'}
              </tbody>
            </table>
          </div>
        ` : `
          <!-- TABLE INVENTARIO CARGADORES -->
          <div class="glass-panel" style="padding:0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
              <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                  <th style="padding:0.8rem; text-align:left;">Código de Cargador</th>
                  <th style="padding:0.8rem; text-align:left;">Marca / Modelo</th>
                  <th style="padding:0.8rem; text-align:center;">Capacidad (Ranuras)</th>
                  <th style="padding:0.8rem; text-align:center;">Ranuras Operativas</th>
                  <th style="padding:0.8rem; text-align:left;">Ubicación de Carga</th>
                  <th style="padding:0.8rem; text-align:center;">Estado Físico</th>
                  <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filteredChargers.length ? filteredChargers.map((c, idx) => {
                  let stateColor = '#10b981';
                  let stateGlow = 'rgba(16, 185, 129, 0.2)';
                  if (c.estado === 'En Mantenimiento') {
                    stateColor = '#f59e0b';
                    stateGlow = 'rgba(245, 158, 11, 0.2)';
                  } else if (c.estado === 'De Baja') {
                    stateColor = '#ef4444';
                    stateGlow = 'rgba(239, 68, 68, 0.2)';
                  }

                  const slotsOk = parseInt(c.ranuras_ok || c.capacidad || 4);
                  const slotsTotal = parseInt(c.capacidad || 4);

                  return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                      <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                      <td style="padding:0.8rem; font-weight:900; color:#fff; font-size:0.85rem; letter-spacing:0.5px;">
                        <span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-family:monospace;">${c.codigo}</span>
                      </td>
                      <td style="padding:0.8rem;">
                        <span style="font-weight:600; color:#cbd5e1;">${c.marca || ''}</span> 
                        <span style="color:var(--text-muted); font-size:0.7rem;">${c.modelo || ''}</span>
                      </td>
                      <td style="padding:0.8rem; text-align:center; font-weight:700; color:#fff;">${slotsTotal} slots</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="color:${slotsOk === slotsTotal ? '#10b981' : '#f59e0b'}; font-weight:800;">
                          ${slotsOk} / ${slotsTotal} OK
                        </span>
                      </td>
                      <td style="padding:0.8rem; font-weight:600; color:#cbd5e1;">⚡ ${c.ubicacion || 'Zona de Carga Principal'}</td>
                      <td style="padding:0.8rem; text-align:center;">
                        <span style="background:${stateGlow}; color:${stateColor}; border:1px solid ${stateColor}44; padding:3px 10px; border-radius:20px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                          ${c.estado || 'Operativo'}
                        </span>
                      </td>
                      <td style="padding:0.8rem; text-align:center;">
                        <div style="display:flex; gap:0.8rem; justify-content:center; align-items:center;">
                          <button class="btn-edit-charger" data-charger='${JSON.stringify(c).replace(/'/g, "&apos;")}' style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">✏️</button>
                          <button class="btn-delete-charger" data-codigo="${c.codigo}" style="background:none; border:none; cursor:pointer; font-size:0.95rem; filter:grayscale(0.3) brightness(1.2); padding:2px; outline:none;">🗑️</button>
                        </div>
                      </td>
                    </tr>`;
                }) : '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se encontraron cargadores registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        `}
      ` : activeRFTab === 'asignar' ? `
        <!-- SUB-MÓDULO DE ASIGNACIÓN Y CONTROL RÁPIDO -->
        <div style="display:grid; grid-template-columns: 350px 1fr; gap:1.5rem; align-items:start;">
          <!-- COLUMNA IZQUIERDA: REGISTRO ENTREGA -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:var(--primary); font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">🔑 Entrega de Turno</h4>
            <form id="form_fast_assign" style="display:flex; flex-direction:column; gap:0.9rem;">
              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">1. SELECCIONAR OPERARIO ACTIVO:</label>
                <select id="rf_fast_worker" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="" style="background:#0f172a;">-- Seleccionar operario --</option>
                  ${activeWorkers.map(w => `<option value="${w.dni}" style="background:#0f172a;">${w.apellidos}, ${w.nombre} (${w.dni})</option>`).join('')}
                </select>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">2. SELECCIONAR TERMINAL DISPONIBLE:</label>
                <select id="rf_fast_device" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-family:monospace; font-size:0.8rem;">
                  <option value="" style="background:#0f172a;">-- Seleccionar serie RF --</option>
                  ${availableOperativeRfs.map(r => `<option value="${r.serie}" style="background:#0f172a;">${r.numero ? `N° ${r.numero} | ` : ''}${r.serie} - ${r.marca} (${r.bateria}% bat)</option>`).join('')}
                </select>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">3. TURNO:</label>
                <select id="rf_fast_turn" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="DIA" style="background:#0f172a;">DIA</option>
                  <option value="NOCHE" style="background:#0f172a;" selected>NOCHE</option>
                </select>
              </div>

              <!-- CRITERIOS DE VERIFICACIÓN -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (ENTREGA):</span>
                
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
                  <span>🖥️ Pantalla en buen estado</span>
                  <input type="checkbox" id="rf_fast_pantalla" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
                </label>
                
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
                  <span>🏷️ Numeración legible / OK</span>
                  <input type="checkbox" id="rf_fast_numeracion" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
                </label>
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
                <textarea id="rf_fast_notes" rows="2" placeholder="Ej: Sin arañazos, incluye lápiz..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;"></textarea>
              </div>

              <button type="submit" class="btn" style="background:linear-gradient(135deg, var(--primary) 0%, #1e1b4b 150%); padding:0.7rem; font-weight:800; font-size:0.75rem; width:100%; border-radius:10px; box-shadow:0 4px 12px rgba(79,70,229,0.3); margin-top:0.3rem;">⚡ ENTREGAR Y ASIGNAR RF</button>
            </form>
          </div>

          <!-- COLUMNA DERECHA: EQUIPOS ACTUALMENTE EN USO -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:#06b6d4; font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📥 Equipos en uso (Retornos de Turno)</h4>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border);">
                  <tr>
                    <th style="padding:0.7rem; text-align:left;">Equipo RF</th>
                    <th style="padding:0.7rem; text-align:left;">Trabajador</th>
                    <th style="padding:0.7rem; text-align:center;">Turno</th>
                    <th style="padding:0.7rem; text-align:left;">Entrega</th>
                    <th style="padding:0.7rem; text-align:center;">Estado Inicial</th>
                    <th style="padding:0.7rem; text-align:center; width:130px;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeAssignments.length ? activeAssignments.map(a => {
                    const activeTime = new Date(a.assigned_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
                    const screenStyle = a.pantalla_ok !== false ? 'color:#10b981; font-weight:800;' : 'color:#ef4444; font-weight:800; text-decoration:line-through;';
                    const numStyle = a.numeracion_ok !== false ? 'color:#10b981; font-weight:800;' : 'color:#ef4444; font-weight:800; text-decoration:line-through;';
                    const rfInfo = rfs.find(r => r.serie === a.rf_serial);
                    const rfNumero = rfInfo && rfInfo.numero ? `N° ${rfInfo.numero} | ` : '';

                    return `
                      <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                        <td style="padding:0.7rem; font-weight:900; color:#fff;"><span style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:monospace;">${rfNumero}${a.rf_serial}</span></td>
                        <td style="padding:0.7rem;">
                          <div style="font-weight:700; color:#fff;">${a.worker_name}</div>
                          <div style="font-size:0.6rem; color:var(--text-muted);">DNI: ${a.worker_dni}</div>
                        </td>
                        <td style="padding:0.7rem; text-align:center;">
                          <span style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-weight:800;">${a.turn}</span>
                        </td>
                        <td style="padding:0.7rem; color:#cbd5e1;">🕒 ${activeTime}</td>
                         <td style="padding:0.7rem; text-align:center;">
                           <div style="display:flex; flex-direction:column; gap:2px; font-size:0.65rem;">
                             <span style="${screenStyle}">🖥️ ${a.pantalla_ok !== false ? 'PANTALLA OK' : 'PANTALLA MAL'}</span>
                             <span style="${numStyle}">🏷️ ${a.numeracion_ok !== false ? 'NUMERACIÓN OK' : 'NUMERACIÓN MAL'}</span>
                           </div>
                         </td>
                         <td style="padding:0.7rem; text-align:center;">
                           <button class="btn-recibir-asignar" data-serie="${a.rf_serial}" style="background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); border:none; color:#fff; font-weight:800; font-size:0.65rem; padding:4px 12px; border-radius:6px; cursor:pointer; box-shadow:0 3px 8px rgba(234,88,12,0.3); outline:none; transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">📥 RECIBIR RF</button>
                         </td>
                      </tr>`;
                  }).join('') : '<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600;">No hay terminales asignados en uso en este turno.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : activeRFTab === 'asignaciones' ? `
        <!-- TABLE BITÁCORA ASIGNACIONES -->
        <div class="glass-panel" style="padding:0; overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
            <thead style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border);">
              <tr>
                <th style="padding:0.8rem; text-align:center; width:40px; border-right:1px solid rgba(255,255,255,0.05);">#</th>
                <th style="padding:0.8rem; text-align:left;">Equipo RF</th>
                <th style="padding:0.8rem; text-align:left;">Trabajador</th>
                <th style="padding:0.8rem; text-align:center;">Turno</th>
                <th style="padding:0.8rem; text-align:left;">Asignación (Entrega)</th>
                <th style="padding:0.8rem; text-align:left;">Devolución (Retorno)</th>
                <th style="padding:0.8rem; text-align:left;">Bitácora de Control y Observaciones</th>
                <th style="padding:0.8rem; text-align:center; width:120px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAssignments.length ? filteredAssignments.map((a, idx) => {
                const assignedTime = new Date(a.assigned_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
                const returnedTime = a.returned_at ? new Date(a.returned_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : null;
                
                const isDamaged = a.returned_at && (a.retorno_pantalla_ok === false || a.retorno_numeracion_ok === false);
                const isPending = !a.returned_at;
                
                let rowBg = '';
                let rowOpacity = '1';
                let rowBorder = 'border-bottom:1px solid rgba(255,255,255,0.03);';
                
                if (isDamaged) {
                  rowBg = 'background: rgba(239, 68, 68, 0.08);';
                  rowBorder += ' border-left: 4px solid #ef4444;';
                } else if (isPending) {
                  rowBg = 'background: rgba(245, 158, 11, 0.03);';
                  rowBorder += ' border-left: 4px solid #ea580c;';
                } else {
                  rowOpacity = '0.55';
                  rowBg = 'background: rgba(255, 255, 255, 0.01);';
                }
                
                let returnStatusHtml = '';
                if (returnedTime) {
                  if (a.retorno_pantalla_ok !== false && a.retorno_numeracion_ok !== false) {
                    returnStatusHtml = `
                      <div style="margin-bottom:6px;"><span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">✅ CONFORME</span></div>
                      <div style="color:#10b981; font-weight:700; font-size:0.75rem;">${returnedTime}</div>
                      <div style="font-size:0.65rem; color:rgba(16,185,129,0.7); margin-top:2px;">
                        🖥️ Pantalla: OK | 🏷️ Num: OK
                      </div>
                    `;
                  } else {
                    returnStatusHtml = `
                      <div style="margin-bottom:6px;"><span style="background:rgba(239,68,68,0.25); color:#f87171; border:1px solid rgba(239,68,68,0.5); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px; box-shadow:0 0 10px rgba(239,68,68,0.25);">🚨 DAÑADO / TALLER</span></div>
                      <div style="color:#ef4444; font-weight:800; font-size:0.75rem;">${returnedTime}</div>
                      <div style="font-size:0.65rem; color:#f87171; font-weight:700; margin-top:2px; display:flex; flex-direction:column; gap:2px;">
                        <span>${a.retorno_pantalla_ok !== false ? '🖥️ Pantalla: OK' : '🖥️ Pantalla: DAÑADA'}</span>
                        <span>${a.retorno_numeracion_ok !== false ? '🏷️ Num: OK' : '🏷️ Num: BORRADA'}</span>
                      </div>
                    `;
                  }
                } else {
                  returnStatusHtml = `
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
                      <span class="pulse-pendiente-dot" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); padding:3px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; letter-spacing:0.5px; box-shadow:0 0 8px rgba(245,158,11,0.2); display:inline-block;">⏳ EN USO</span>
                      <button class="btn-recibir-rf" data-serie="${a.rf_serial}" style="background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%); border:none; color:#fff; font-size:0.62rem; padding:4px 10px; border-radius:6px; cursor:pointer; font-weight:800; outline:none; box-shadow:0 2px 6px rgba(234,88,12,0.35); transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">📥 RECIBIR RF</button>
                    </div>
                  `;
                }
                const rfInfo = rfs.find(r => r.serie === a.rf_serial);
                const rfNumero = rfInfo && rfInfo.numero ? `N° ${rfInfo.numero} | ` : '';

                return `
                  <tr style="${rowBg} ${rowBorder} opacity:${rowOpacity}; transition: all 0.3s ease;">
                    <td style="padding:0.8rem; text-align:center; color:var(--text-muted); font-weight:700; border-right:1px solid rgba(255,255,255,0.05);">${idx + 1}</td>
                    <td style="padding:0.8rem; font-weight:900; color:#fff;"><span style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:4px 8px; border-radius:6px; font-family:monospace; font-size:0.85rem; letter-spacing:0.5px;">${rfNumero}${a.rf_serial}</span></td>
                    <td style="padding:0.8rem;">
                      <div style="font-weight:700; color:#fff; font-size:0.8rem;">${a.worker_name}</div>
                      <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">DNI: ${a.worker_dni}</div>
                    </td>
                    <td style="padding:0.8rem; text-align:center;">
                      <span style="background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; font-size:0.65rem; font-weight:800; color:#cbd5e1;">${a.turn}</span>
                    </td>
                    <td style="padding:0.8rem; color:#cbd5e1; font-weight:500;">
                      <div style="font-weight:700; color:#fff; margin-bottom:4px;">📅 ${assignedTime}</div>
                      <div style="font-size:0.65rem; color:rgba(255,255,255,0.45); display:flex; flex-direction:column; gap:2px;">
                        <span style="${a.pantalla_ok !== false ? 'color:#10b981;' : 'color:#ef4444; font-weight:800;'}">🖥️ Pantalla: ${a.pantalla_ok !== false ? 'OK' : 'DAÑADA'}</span>
                        <span style="${a.numeracion_ok !== false ? 'color:#10b981;' : 'color:#ef4444; font-weight:800;'}">🏷️ Num: ${a.numeracion_ok !== false ? 'OK' : 'DAÑADA'}</span>
                      </div>
                    </td>
                    <td style="padding:0.8rem;">
                      ${returnStatusHtml}
                    </td>
                    <td style="padding:0.8rem; color:#cbd5e1; font-size:0.72rem; line-height:1.4; max-width:320px; overflow:visible; word-break:break-word; white-space:normal;">
                      ${a.notes ? `<div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:5px 8px; border-radius:6px; margin-bottom:4px; color:rgba(255,255,255,0.65);">🗣️ <b>Entrega:</b> ${a.notes}</div>` : ''}
                      ${a.return_notes ? `
                        <div style="background:${isDamaged ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)'}; border:1px solid ${isDamaged ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; padding:5px 8px; border-radius:6px; color:${isDamaged ? '#f87171; font-weight:700;' : '#34d399;'};">
                          📥 <b>Retorno:</b> ${a.return_notes}
                        </div>
                      ` : ''}
                    </td>
                    <td style="padding:0.8rem; text-align:center; border-left:1px solid rgba(255,255,255,0.02);">
                      <div style="display:flex; gap:0.5rem; justify-content:center; align-items:center;">
                        <button class="btn-edit-assignment" data-id="${a.id}" title="Editar registro" style="background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; font-size:0.85rem; padding:5px 9px; border-radius:7px; cursor:pointer; outline:none; transition:all 0.2s; font-weight:700;" onmouseover="this.style.background='rgba(99,102,241,0.3)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(99,102,241,0.15)'; this.style.color='#a5b4fc';">✏️</button>
                        <button class="btn-delete-assignment" data-id="${a.id}" data-serial="${a.rf_serial}" data-pending="${isPending}" title="Eliminar registro" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.85rem; padding:5px 9px; border-radius:7px; cursor:pointer; outline:none; transition:all 0.2s; font-weight:700;" onmouseover="this.style.background='rgba(239,68,68,0.28)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239,68,68,0.12)'; this.style.color='#fca5a5';">🗑️</button>
                      </div>
                    </td>
                  </tr>`;
              }) : '<tr><td colspan="8" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-size:0.85rem;">No se registran asignaciones en la bitácora.</td></tr>'}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- REVISIÓN RF SECTION -->
        <div style="display:grid; grid-template-columns: 380px 1fr; gap:1.5rem; align-items:start;">
          <!-- COLUMNA IZQUIERDA: CONTROL Y ESCANEO -->
          <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08);">
            <h4 style="margin:0 0 1.2rem 0; color:var(--primary); font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">🔍 Panel de Validación</h4>
            
            <div style="display:flex; flex-direction:column; gap:0.9rem;">
              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">1. FECHA DEL TURNO REFERENCIA (FIN DE TURNO):</label>
                <input type="date" id="rf_rev_date" value="${revisionDate}" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">
              </div>

              <div>
                <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">2. TURNO A REVISAR (ANTERIOR):</label>
                <select id="rf_rev_turn" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                  <option value="NOCHE" ${revisionTurn==='NOCHE'?'selected':''}>NOCHE (Salida: 6:00 AM)</option>
                  <option value="DIA" ${revisionTurn==='DIA'?'selected':''}>DIA (Salida: 6:00 PM)</option>
                </select>
              </div>

              <!-- LECTORA DE BARRAS DE RF -->
              <div style="background:rgba(0, 0, 0, 0.25); border:2px dashed rgba(99,102,241,0.4); padding:1.2rem; border-radius:12px; margin-top:0.5rem; text-align:center; position:relative; box-shadow:inset 0 0 15px rgba(99,102,241,0.05);">
                <div style="position:absolute; top:8px; right:12px; display:flex; align-items:center; gap:5px;">
                  <span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981; animation:pulse-bat 1s infinite alternate;"></span>
                  <span style="font-size:0.6rem; color:#10b981; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Listo</span>
                </div>

                <label style="font-size:0.75rem; color:#fff; display:block; margin-bottom:10px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;">⚡ Escanear Terminal RF:</label>
                <input type="text" id="rf_rev_scanner_input" placeholder="Pistolear Código..." autofocus autocomplete="off" style="width:100%; background:rgba(15,23,42,0.9); border:2px solid rgba(99,102,241,0.6); color:#fff; font-size:1.1rem; font-weight:900; letter-spacing:1px; outline:none; padding:0.7rem; border-radius:8px; text-align:center; box-shadow:0 0 10px rgba(99,102,241,0.25); transition:all 0.2s;" onfocus="this.style.borderColor='#818cf8'; this.style.boxShadow='0 0 15px rgba(129,140,248,0.4)';" onblur="this.style.borderColor='rgba(99,102,241,0.6)';">
                
                <span style="font-size:0.6rem; color:var(--text-muted); display:block; margin-top:8px;">Haga clic en la caja si pierde el foco para seguir pistoleando.</span>
              </div>

              <!-- BOTONES AUXILIARES -->
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:0.5rem;">
                <button id="btn_generate_summary" class="btn" style="width:100%; background:linear-gradient(135deg, var(--primary) 0%, #1e1b4b 150%); color:#fff; font-size:0.8rem; padding:0.7rem; font-weight:800; border-radius:8px; box-shadow:0 4px 12px rgba(79,70,229,0.35); border:none; cursor:pointer;">📊 Generar Resumen</button>
                <div style="display:flex; gap:10px;">
                  <button id="btn_clear_revision" class="btn" style="flex:1; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; font-size:0.75rem; padding:0.6rem; font-weight:700; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)';" onmouseout="this.style.background='rgba(239,68,68,0.1)';">🗑️ Limpiar Lecturas</button>
                  <button id="btn_export_revision" class="btn" style="flex:1; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#a7f3d0; font-size:0.75rem; padding:0.6rem; font-weight:700; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.2)';" onmouseout="this.style.background='rgba(16,185,129,0.1)';">📥 Exportar Reporte</button>
                </div>
              </div>

              <!-- ULTIMO ESCANEO DETALLE -->
              ${scannedRfs.length ? (() => {
                const last = scannedRfs[0];
                const isExpected = expectedRFSerials.includes(last.serial);
                const bg = isExpected ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
                const border = isExpected ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)';
                const color = isExpected ? '#34d399' : '#f87171';
                
                return `
                  <div style="background:${bg}; border:${border}; border-radius:10px; padding:0.8rem; margin-top:0.3rem;">
                    <span style="font-size:0.6rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Última RF Escaneada:</span>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size:1.1rem; font-weight:900; color:#fff; font-family:monospace;">${last.serial}</span>
                      <span style="background:${isExpected?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}; color:${color}; font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid ${color}44;">
                        ${isExpected ? '✔️ CONFORME' : '❌ NO ESPERADO'}
                      </span>
                    </div>
                  </div>
                `;
              })() : ''}
            </div>
          </div>

          <!-- COLUMNA DERECHA: COMPARACIÓN Y LISTAS -->
          <div style="display:flex; flex-direction:column; gap:1.5rem; flex:1; width:100%; overflow:hidden;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
              <!-- EQUIPOS LEÍDOS / HISTORIAL -->
              <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08); display:flex; flex-direction:column; min-height:420px;">
                <h4 style="margin:0 0 1rem 0; color:#06b6d4; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                  📋 Equipos Escaneados (${scannedRfs.length})
                </h4>
                
                <div style="overflow-y:auto; max-height:350px; flex:1;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                    <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;">
                      <tr>
                        <th style="padding:0.6rem; text-align:left;">Equipo RF</th>
                        <th style="padding:0.6rem; text-align:left;">Estado anterior / Operario</th>
                        <th style="padding:0.6rem; text-align:center; width:90px;">Validación</th>
                        <th style="padding:0.6rem; text-align:center; width:40px;"></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${scannedRfs.length ? scannedRfs.map((s, sIdx) => {
                        const isExpected = expectedRFSerials.includes(s.serial);
                        const detail = expectedRFDetails[s.serial];
                        
                        return `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.02); background:${isExpected?'rgba(16,185,129,0.02)':'rgba(239,68,68,0.02)'};">
                            <td style="padding:0.7rem; font-weight:900; color:#fff; font-family:monospace;">${s.serial}</td>
                            <td style="padding:0.7rem;">
                              ${isExpected && detail ? `
                                <div style="font-weight:700; color:#cbd5e1;">${detail.worker_name}</div>
                                <div style="font-size:0.6rem; color:var(--text-muted);">Turno anterior: ${detail.turn}</div>
                              ` : `
                                <div style="color:var(--text-muted); font-style:italic;">No estuvo en uso en el turno</div>
                              `}
                            </td>
                            <td style="padding:0.7rem; text-align:center;">
                              ${isExpected ? `
                                <span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">✔️ BIEN</span>
                              ` : `
                                <span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:12px; font-weight:800; font-size:0.65rem; display:inline-block; letter-spacing:0.5px;">❌ X</span>
                              `}
                            </td>
                            <td style="padding:0.7rem; text-align:center;">
                              <button class="btn-delete-scan" data-idx="${sIdx}" style="background:none; border:none; cursor:pointer; font-size:0.8rem; filter:grayscale(0.5); outline:none;">🗑️</button>
                            </td>
                          </tr>
                        `;
                      }).join('') : '<tr><td colspan="4" style="padding:3rem; text-align:center; color:var(--text-muted); font-weight:600; font-style:italic;">Use su lectora para escanear los equipos.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- EQUIPOS PENDIENTES / FALTANTES -->
              <div class="glass-panel" style="padding:1.5rem; background:rgba(30, 41, 59, 0.4); border-color:rgba(255,255,255,0.08); display:flex; flex-direction:column; min-height:420px;">
                <h4 style="margin:0 0 1rem 0; color:#ef4444; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">
                  ⏳ Pendientes por Encontrar (${pendingCount})
                </h4>
                
                <div style="overflow-y:auto; max-height:350px; flex:1;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
                    <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1;">
                      <tr>
                        <th style="padding:0.6rem; text-align:left;">Equipo RF</th>
                        <th style="padding:0.6rem; text-align:left;">Operario Turno Anterior</th>
                        <th style="padding:0.6rem; text-align:center; width:90px;">Turno anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser)).length ? 
                        expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser)).map(ser => {
                          const detail = expectedRFDetails[ser];
                          return `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                              <td style="padding:0.7rem; font-weight:900; color:#fff; font-family:monospace;">${ser}</td>
                              <td style="padding:0.7rem;">
                                <div style="font-weight:700; color:#cbd5e1;">${detail ? detail.worker_name : '—'}</div>
                              </td>
                              <td style="padding:0.7rem; text-align:center; color:var(--text-muted);">
                                ${detail ? detail.turn : '—'}
                              </td>
                            </tr>
                          `;
                        }).join('') : '<tr><td colspan="3" style="padding:3rem; text-align:center; color:#10b981; font-weight:800; font-size:0.85rem;">🎉 ¡Todos los equipos esperados han sido validados!</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `}
    `;

    // AÑADIR LISTENERS DE EVENTOS
    setTimeout(() => {
      // TAB CLICKS
      const tabInv = document.getElementById('rf_tab_inventario');
      const tabAsig = document.getElementById('rf_tab_asignaciones');
      const tabAsigar = document.getElementById('rf_tab_asignar');
      const tabRev = document.getElementById('rf_tab_revision');
      if (tabInv) tabInv.onclick = () => { activeRFTab = 'inventario'; renderRFSection(container); };
      if (tabAsig) tabAsig.onclick = () => { activeRFTab = 'asignaciones'; renderRFSection(container); };
      if (tabAsigar) tabAsigar.onclick = () => { activeRFTab = 'asignar'; renderRFSection(container); };
      if (tabRev) tabRev.onclick = () => { activeRFTab = 'revision'; renderRFSection(container); };

      // REVISION SUB-TAB LISTENERS
      const revDateInput = document.getElementById('rf_rev_date');
      if (revDateInput) {
        revDateInput.onchange = (e) => {
          revisionDate = e.target.value;
          renderRFSection(container);
        };
      }

      const revTurnInput = document.getElementById('rf_rev_turn');
      if (revTurnInput) {
        revTurnInput.onchange = (e) => {
          revisionTurn = e.target.value;
          renderRFSection(container);
        };
      }

      const scannerInput = document.getElementById('rf_rev_scanner_input');
      if (scannerInput) {
        scannerInput.focus();
        scannerInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (val) {
              if (scannedRfs.some(s => s.serial === val)) {
                alert(`⚠️ El equipo ${val} ya fue escaneado en esta sesión.`);
                e.target.value = '';
                return;
              }
              const isExpected = expectedRFSerials.includes(val);
              playBeep(isExpected ? 'success' : 'error');
              scannedRfs.unshift({
                serial: val,
                timestamp: new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
              });
              renderRFSection(container);
            }
            e.target.value = '';
          }
        };
      }

      const btnClearRev = document.getElementById('btn_clear_revision');
      if (btnClearRev) {
        btnClearRev.onclick = () => {
          if (confirm("¿Está seguro de limpiar todas las lecturas de la sesión de validación actual?")) {
            scannedRfs = [];
            renderRFSection(container);
          }
        };
      }

      const btnGenSummary = document.getElementById('btn_generate_summary');
      if (btnGenSummary) {
        btnGenSummary.onclick = () => {
          const missing = expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser));
          const unexpected = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
          
          const modal = document.createElement('div');
          modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
          modal.innerHTML = `
            <div class="glass-panel" style="width:580px; max-height:85vh; display:flex; flex-direction:column; padding:2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.25); overflow:hidden;">
              <h3 style="margin:0 0 1.2rem 0; color:#fff; font-size:1.15rem; font-weight:800; text-align:center; letter-spacing:0.5px;">
                📊 RESUMEN DE VALIDACIÓN RF
              </h3>
              
              <!-- METRICS GRID -->
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:1.5rem;">
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:var(--text-muted); font-weight:800; text-transform:uppercase;">Esperados</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#fff; margin-top:4px;">${totalExpected}</div>
                </div>
                <div style="background:rgba(34,197,94,0.05); border:1px solid rgba(34,197,94,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#86efac; font-weight:800; text-transform:uppercase;">Coincidentes</div>
                  <div style="font-size:1.2rem; font-weight:900; color:var(--success); margin-top:4px;">${uniqueFoundExpected}</div>
                </div>
                <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#fca5a5; font-weight:800; text-transform:uppercase;">Faltantes</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#ef4444; margin-top:4px;">${pendingCount}</div>
                </div>
                <div style="background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); padding:10px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.6rem; color:#93c5fd; font-weight:800; text-transform:uppercase;">Inesperados</div>
                  <div style="font-size:1.2rem; font-weight:900; color:#3b82f6; margin-top:4px;">${uniqueUnexpected}</div>
                </div>
              </div>

              <!-- DETAILS CONTAINER -->
              <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:1.2rem; margin-bottom:1.5rem; padding-right:5px;">
                <!-- SECCIÓN FALTANTES -->
                <div>
                  <h4 style="margin:0 0 8px 0; color:#ef4444; font-size:0.78rem; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                    ⏳ FALTANTES POR ENCONTRAR (${missing.length})
                  </h4>
                  <div style="background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.04); border-radius:8px; padding:8px; font-size:0.72rem; max-height:180px; overflow-y:auto;">
                    ${missing.length ? missing.map(ser => {
                      const detail = expectedRFDetails[ser];
                      return `<div style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; justify-content:space-between;">
                        <span style="font-family:monospace; font-weight:800; color:#fff;">${ser}</span>
                        <span style="color:var(--text-muted); font-size:0.68rem;">Anterior: ${detail ? detail.worker_name : '—'} (${detail ? detail.turn : '—'})</span>
                      </div>`;
                    }).join('') : '<div style="color:var(--success); text-align:center; padding:8px; font-weight:700;">¡Ningún equipo faltante! Todos fueron validados.</div>'}
                  </div>
                </div>

                <!-- SECCIÓN INESPERADOS -->
                <div>
                  <h4 style="margin:0 0 8px 0; color:#3b82f6; font-size:0.78rem; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
                    ❌ INESPERADOS / NUEVOS DETECTADOS (${unexpected.length})
                  </h4>
                  <div style="background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.04); border-radius:8px; padding:8px; font-size:0.72rem; max-height:180px; overflow-y:auto;">
                    ${unexpected.length ? unexpected.map(s => {
                      return `<div style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.02); display:flex; justify-content:space-between;">
                        <span style="font-family:monospace; font-weight:800; color:#fff;">${s.serial}</span>
                        <span style="color:#93c5fd; font-size:0.65rem; font-weight:700;">[${s.timestamp}] -> NO ESPERADO</span>
                      </div>`;
                    }).join('') : '<div style="color:var(--text-muted); text-align:center; padding:8px;">No se detectaron equipos fuera de turno.</div>'}
                  </div>
                </div>
              </div>

              <!-- BUTTONS -->
              <div style="display:flex; justify-content:flex-end;">
                <button id="btn_close_summary_modal" class="btn" style="width:120px; background:rgba(255,255,255,0.08); border:1px solid var(--border); color:#fff; font-weight:800; font-size:0.78rem; border-radius:8px; padding:0.6rem;">Cerrar</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          
          document.getElementById('btn_close_summary_modal').onclick = () => {
            document.body.removeChild(modal);
          };
        };
      }

      const btnExportRev = document.getElementById('btn_export_revision');
      if (btnExportRev) {
        btnExportRev.onclick = () => {
          const missing = expectedRFSerials.filter(ser => !scannedRfs.some(s => s.serial === ser));
          const unexpected = scannedRfs.filter(s => !expectedRFSerials.includes(s.serial));
          
          if (!scannedRfs.length && !missing.length) {
            alert("⚠️ No hay lecturas escaneadas ni faltantes para exportar.");
            return;
          }
          
          let reportContent = `REPORTE DE VALIDACIÓN Y REVISIÓN DE RF\n`;
          reportContent += `========================================\n`;
          reportContent += `Fecha Referencia: ${revisionDate}\n`;
          reportContent += `Turno Referencia: ${revisionTurn}\n`;
          reportContent += `Fecha de Generación: ${new Date().toLocaleString('es-ES')}\n`;
          reportContent += `----------------------------------------\n\n`;
          reportContent += `RESUMEN DE EQUIPOS:\n`;
          reportContent += `Esperados: ${totalExpected}\n`;
          reportContent += `Coincidentes OK: ${uniqueFoundExpected}\n`;
          reportContent += `Faltantes: ${pendingCount}\n`;
          reportContent += `Inesperados: ${uniqueUnexpected}\n\n`;
          
          reportContent += `DETALLE DE EQUIPOS FALTANTES E INESPERADOS (NUEVOS):\n`;
          reportContent += `----------------------------------------\n`;
          reportContent += `FALTANTES POR ENCONTRAR:\n`;
          if (missing.length) {
            missing.forEach(ser => {
              const detail = expectedRFDetails[ser];
              const workerName = detail ? detail.worker_name : 'Sin registro';
              const turnName = detail ? detail.turn : '—';
              reportContent += `- Serial: ${ser} - Anterior: ${workerName} (${turnName})\n`;
            });
          } else {
            reportContent += `¡Ningún equipo faltante! Todos fueron encontrados.\n`;
          }
          
          reportContent += `\nINESPERADOS / NUEVOS DETECTADOS:\n`;
          if (unexpected.length) {
            unexpected.forEach(s => {
              reportContent += `- [${s.timestamp}] Serial: ${s.serial} -> NO ESPERADO\n`;
            });
          } else {
            reportContent += `Ninguno.\n`;
          }
          
          const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Reporte_Revision_RF_${revisionDate}_${revisionTurn}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
      }

      container.querySelectorAll('.btn-delete-scan').forEach(btn => {
        btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.dataset.idx);
          scannedRfs.splice(idx, 1);
          renderRFSection(container);
        };
      });

      // SUB-TABS CLICKS
      const subTabRfs = document.getElementById('rf_sub_tab_rfs');
      const subTabBats = document.getElementById('rf_sub_tab_baterias');
      const subTabChgs = document.getElementById('rf_sub_tab_cargadores');
      if (subTabRfs) subTabRfs.onclick = () => { activeInventorySubTab = 'rfs'; renderRFSection(container); };
      if (subTabBats) subTabBats.onclick = () => { activeInventorySubTab = 'baterias'; renderRFSection(container); };
      if (subTabChgs) subTabChgs.onclick = () => { activeInventorySubTab = 'cargadores'; renderRFSection(container); };

      // SEARCH & FILTER INPUTS
      const searchInput = document.getElementById('rf_search_input');
      if (searchInput) {
        searchInput.oninput = (e) => {
          rfSearchQuery = e.target.value;
          renderRFSection(container);
          document.getElementById('rf_search_input').focus();
          document.getElementById('rf_search_input').selectionStart = document.getElementById('rf_search_input').selectionEnd = rfSearchQuery.length;
        };
      }

      const statusFilter = document.getElementById('rf_status_filter');
      if (statusFilter) {
        statusFilter.onchange = (e) => {
          rfStatusFilter = e.target.value;
          renderRFSection(container);
        };
      }

      // SUBMIT FORM FAST ASSIGN
      const formFast = document.getElementById('form_fast_assign');
      if (formFast) {
        formFast.onsubmit = async (e) => {
          e.preventDefault();
          const workerDni = document.getElementById('rf_fast_worker').value;
          const rfSerie = document.getElementById('rf_fast_device').value;
          const turnVal = document.getElementById('rf_fast_turn').value;
          const pantallaOk = document.getElementById('rf_fast_pantalla').checked;
          const numeracionOk = document.getElementById('rf_fast_numeracion').checked;
          const notesVal = document.getElementById('rf_fast_notes').value.trim();

          const worker = activeWorkers.find(w => w.dni === workerDni);
          const rfDevice = rfs.find(r => r.serie === rfSerie);

          if (!worker || !rfDevice) return alert("Operario o Terminal RF no seleccionado.");

          // Validar asignaciones existentes
          const workerActiveRf = rfs.find(r => r.asignadoDni === workerDni);
          if (workerActiveRf) {
            if (!confirm(`⚠️ El operario ${worker.nombre} ya tiene asignado el equipo ${workerActiveRf.serie}. ¿Deseas asignarle este nuevo equipo adicional?`)) {
              return;
            }
          }

          // Actualizar RF
          const listRfs = [...rfs];
          const rfIdx = listRfs.findIndex(r => r.serie === rfSerie);
          if (rfIdx !== -1) {
            listRfs[rfIdx].asignadoDni = workerDni;
            listRfs[rfIdx].asignadoNombre = `${worker.apellidos}, ${worker.nombre}`;
            listRfs[rfIdx].asignadoTurno = turnVal;
          }

          // Crear Asignación
          const listAssignments = [...assignments];
          listAssignments.push({
            id: 'ASIG_' + Date.now(),
            rf_serial: rfSerie,
            worker_dni: workerDni,
            worker_name: `${worker.apellidos}, ${worker.nombre}`,
            turn: turnVal,
            assigned_at: new Date().toISOString(),
            returned_at: null,
            pantalla_ok: pantallaOk,
            numeracion_ok: numeracionOk,
            notes: notesVal,
            return_notes: null
          });

          await adminService.saveRfs(listRfs);
          await adminService.saveRfAssignments(listAssignments);

          alert(`✅ Asignación rápida exitosa: RF ${rfSerie} entregada a ${worker.nombre}.`);
          renderRFSection(container);
        };
      }

      // BOTÓN SINCRONIZAR
      const btnSyncRf = document.getElementById('rf_btn_sync');
      if (btnSyncRf) btnSyncRf.onclick = () => renderRFSection(container);

      // NUEVO REGISTRO EQUIPO RF
      const btnNewRf = document.getElementById('btn_new_rf');
      if (btnNewRf) btnNewRf.onclick = () => abrirModalRF(container);

      // NUEVA BATERÍA
      const btnNewBattery = document.getElementById('btn_new_battery');
      if (btnNewBattery) btnNewBattery.onclick = () => abrirModalBattery(container);

      // NUEVO CARGADOR
      const btnNewCharger = document.getElementById('btn_new_charger');
      if (btnNewCharger) btnNewCharger.onclick = () => abrirModalCharger(container);

      // ACCIONES INDIVIDUALES EQUIPOS RF
      container.querySelectorAll('.btn-edit-rf').forEach(btn => {
        btn.onclick = (e) => {
          const rf = JSON.parse(e.currentTarget.dataset.rf);
          abrirModalRF(container, rf);
        };
      });

      container.querySelectorAll('.btn-delete-rf').forEach(btn => {
        btn.onclick = async (e) => {
          const serie = e.currentTarget.dataset.serie;
          if (confirm(`¿Estás seguro de eliminar el terminal RF ${serie} de forma permanente?`)) {
            const list = adminService.getRfs().filter(r => r.serie !== serie);
            await adminService.saveRfs(list);
            alert("✅ Equipo eliminado con éxito.");
            renderRFSection(container);
          }
        };
      });

      // ACCIONES INDIVIDUALES BATERÍAS
      container.querySelectorAll('.btn-edit-battery').forEach(btn => {
        btn.onclick = (e) => {
          const bat = JSON.parse(e.currentTarget.dataset.battery);
          abrirModalBattery(container, bat);
        };
      });

      container.querySelectorAll('.btn-delete-battery').forEach(btn => {
        btn.onclick = async (e) => {
          const codigo = e.currentTarget.dataset.codigo;
          if (confirm(`¿Estás seguro de eliminar la batería ${codigo} de forma permanente?`)) {
            const list = adminService.getRfsBatteries().filter(b => b.codigo !== codigo);
            await adminService.saveRfsBatteries(list);
            alert("✅ Batería eliminada con éxito.");
            renderRFSection(container);
          }
        };
      });

      // ACCIONES INDIVIDUALES CARGADORES
      container.querySelectorAll('.btn-edit-charger').forEach(btn => {
        btn.onclick = (e) => {
          const chg = JSON.parse(e.currentTarget.dataset.charger);
          abrirModalCharger(container, chg);
        };
      });

      container.querySelectorAll('.btn-delete-charger').forEach(btn => {
        btn.onclick = async (e) => {
          const codigo = e.currentTarget.dataset.codigo;
          if (confirm(`¿Estás seguro de eliminar el cargador ${codigo} de forma permanente?`)) {
            const list = adminService.getRfsChargers().filter(c => c.codigo !== codigo);
            await adminService.saveRfsChargers(list);
            alert("✅ Cargador eliminado con éxito.");
            renderRFSection(container);
          }
        };
      });

      // BOTÓN DE RECIBIR en la tabla ASIGNAR RF
      container.querySelectorAll('.btn-recibir-asignar').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const serie = e.currentTarget.dataset.serie;
          abrirModalRecibir(container, serie);
        };
      });

      // BOTÓN DE RECIBIR en Bitácora (dentro de celda Devolución)
      container.querySelectorAll('.btn-recibir-rf').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const serie = e.currentTarget.dataset.serie;
          abrirModalRecibir(container, serie);
        };
      });

      // EDITAR ASIGNACIÓN EN BITÁCORA
      container.querySelectorAll('.btn-edit-assignment').forEach(btn => {
        btn.onclick = (e) => {
          const id = e.currentTarget.dataset.id;
          abrirModalEditarAsignacion(container, id);
        };
      });

      // BORRAR ASIGNACIÓN EN BITÁCORA
      container.querySelectorAll('.btn-delete-assignment').forEach(btn => {
        btn.onclick = async (e) => {
          const id = e.currentTarget.dataset.id;
          const serial = e.currentTarget.dataset.serial;
          const isPendingDel = e.currentTarget.dataset.pending === 'true';
          if (!confirm(`¿Eliminar este registro de asignación del equipo ${serial}?\nEsta acción no se puede deshacer.`)) return;
          let listAsig = adminService.getRfAssignments().filter(a => a.id !== id);
          await adminService.saveRfAssignments(listAsig);
          // Si estaba activa (en uso), liberar el RF
          if (isPendingDel) {
            const listRfs = adminService.getRfs();
            const rfIdx = listRfs.findIndex(r => r.serie === serial);
            if (rfIdx !== -1) {
              listRfs[rfIdx].asignadoDni = null;
              listRfs[rfIdx].asignadoNombre = null;
              listRfs[rfIdx].asignadoTurno = null;
              await adminService.saveRfs(listRfs);
            }
          }
          alert('✅ Registro eliminado correctamente.');
          renderRFSection(container);
        };
      });

    }, 10);
  };

  const abrirModalEditarAsignacion = (container, asigId) => {
    const allAssignments = adminService.getRfAssignments() || [];
    const allWorkers = adminService.getWorkers() || [];
    const a = allAssignments.find(x => x.id === asigId);
    if (!a) return alert('No se encontró el registro.');

    const toLocalDT = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(12px); overflow-y:auto; padding:2rem 0;";
    modal.innerHTML = `
      <div class="glass-panel" style="width:min(600px,96vw); padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(99,102,241,0.25); background:linear-gradient(135deg, rgba(30,41,59,0.97) 0%, rgba(15,23,42,0.99) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.15); position:relative; max-height:90vh; overflow-y:auto;">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit',sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ✏️ EDITAR REGISTRO DE ASIGNACIÓN
        </h3>
        <div style="font-size:0.7rem; color:rgba(255,255,255,0.35); text-align:center; margin-bottom:1.5rem; font-family:monospace;">ID: ${a.id}</div>

        <form id="form_edit_asig" style="display:flex; flex-direction:column; gap:1.2rem;">

          <!-- TRABAJADOR -->
          <div>
            <label style="font-size:0.72rem; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">👷 TRABAJADOR:</label>
            <select id="ea_worker" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.78rem;">
              ${allWorkers.filter(w => w.active !== false).map(w =>
                `<option value="${w.dni}|${w.apellidos}, ${w.nombre}" style="background:#0f172a;" ${a.worker_dni === w.dni ? 'selected' : ''}>${w.apellidos}, ${w.nombre} (${w.dni})</option>`
              ).join('')}
            </select>
          </div>

          <!-- TURNO -->
          <div>
            <label style="font-size:0.72rem; color:#94a3b8; display:block; margin-bottom:6px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">🔄 TURNO:</label>
            <select id="ea_turn" style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.78rem;">
              <option value="DIA" style="background:#0f172a;" ${a.turn === 'DIA' ? 'selected' : ''}>DIA</option>
              <option value="NOCHE" style="background:#0f172a;" ${a.turn === 'NOCHE' ? 'selected' : ''}>NOCHE</option>
            </select>
          </div>

          <!-- SEPARADOR: ASIGNACIÓN (ENTREGA) -->
          <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:1rem;">
            <p style="margin:0 0 0.8rem 0; font-size:0.72rem; color:#818cf8; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📦 ASIGNACIÓN (ENTREGA):</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.8rem;">
              <div>
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">FECHA / HORA:</label>
                <input type="datetime-local" id="ea_assigned_at" value="${toLocalDT(a.assigned_at)}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; font-weight:600;">
              </div>
              <div style="display:flex; flex-direction:column; gap:0.6rem; padding-top:0.3rem;">
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🖥️ Pantalla OK</span>
                  <input type="checkbox" id="ea_pantalla_ok" ${a.pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🏷️ Numeración OK</span>
                  <input type="checkbox" id="ea_numeracion_ok" ${a.numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#6366f1;">
                </label>
              </div>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES ENTREGA:</label>
              <textarea id="ea_notes" rows="2" placeholder="Observaciones al momento de la entrega..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;">${a.notes || ''}</textarea>
            </div>
          </div>

          <!-- SEPARADOR: DEVOLUCIÓN (RETORNO) -->
          <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:1rem;">
            <p style="margin:0 0 0.8rem 0; font-size:0.72rem; color:#34d399; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">📥 DEVOLUCIÓN (RETORNO):</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:0.8rem;">
              <div>
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">FECHA / HORA:</label>
                <input type="datetime-local" id="ea_returned_at" value="${toLocalDT(a.returned_at)}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; font-weight:600;">
              </div>
              <div style="display:flex; flex-direction:column; gap:0.6rem; padding-top:0.3rem;">
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🖥️ Pantalla OK</span>
                  <input type="checkbox" id="ea_ret_pantalla_ok" ${a.retorno_pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#10b981;">
                </label>
                <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.73rem;">
                  <span>🏷️ Numeración OK</span>
                  <input type="checkbox" id="ea_ret_numeracion_ok" ${a.retorno_numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:#10b981;">
                </label>
              </div>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES RETORNO (Bitácora):</label>
              <textarea id="ea_return_notes" rows="2" placeholder="Observaciones al momento del retorno..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.5rem; border-radius:8px; font-size:0.75rem; resize:none;">${a.return_notes || ''}</textarea>
            </div>
          </div>

          <!-- BOTONES -->
          <div style="display:flex; gap:10px; margin-top:0.8rem;">
            <button type="button" id="ea_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:2; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(99,102,241,0.35); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">💾 GUARDAR CAMBIOS</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#ea_cancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#form_edit_asig').onsubmit = async (e) => {
      e.preventDefault();
      const workerRaw = modal.querySelector('#ea_worker').value.split('|');
      const newDni = workerRaw[0];
      const newName = workerRaw.slice(1).join('|');
      const newTurn = modal.querySelector('#ea_turn').value;
      const newAssignedAt = modal.querySelector('#ea_assigned_at').value;
      const newReturnedAt = modal.querySelector('#ea_returned_at').value;
      const newPantallaOk = modal.querySelector('#ea_pantalla_ok').checked;
      const newNumOk = modal.querySelector('#ea_numeracion_ok').checked;
      const newNotes = modal.querySelector('#ea_notes').value.trim();
      const newRetPantallaOk = modal.querySelector('#ea_ret_pantalla_ok').checked;
      const newRetNumOk = modal.querySelector('#ea_ret_numeracion_ok').checked;
      const newRetNotes = modal.querySelector('#ea_return_notes').value.trim();

      const wasActive = !a.returned_at;
      const nowActive = !newReturnedAt;

      const updatedList = allAssignments.map(x => {
        if (x.id !== asigId) return x;
        return {
          ...x,
          worker_dni: newDni,
          worker_name: newName,
          turn: newTurn,
          assigned_at: newAssignedAt ? new Date(newAssignedAt).toISOString() : x.assigned_at,
          returned_at: newReturnedAt ? new Date(newReturnedAt).toISOString() : null,
          pantalla_ok: newPantallaOk,
          numeracion_ok: newNumOk,
          notes: newNotes,
          retorno_pantalla_ok: newRetPantallaOk,
          retorno_numeracion_ok: newRetNumOk,
          return_notes: newRetNotes || null
        };
      });
      await adminService.saveRfAssignments(updatedList);

      // Sincronizar estado del RF si cambió de activo a devuelto o viceversa
      const listRfs = adminService.getRfs();
      const rfIdx = listRfs.findIndex(r => r.serie === a.rf_serial);
      if (rfIdx !== -1) {
        if (wasActive && !nowActive) {
          // Era activo, ahora fue devuelto → liberar RF
          listRfs[rfIdx].asignadoDni = null;
          listRfs[rfIdx].asignadoNombre = null;
          listRfs[rfIdx].asignadoTurno = null;
          await adminService.saveRfs(listRfs);
        } else if (!wasActive && nowActive) {
          // Era devuelto, ahora vuelve a estar activo → re-asignar RF
          listRfs[rfIdx].asignadoDni = newDni;
          listRfs[rfIdx].asignadoNombre = newName;
          listRfs[rfIdx].asignadoTurno = newTurn;
          await adminService.saveRfs(listRfs);
        } else if (wasActive && nowActive) {
          // Sigue activo, actualizar nombre/turno si cambió
          listRfs[rfIdx].asignadoDni = newDni;
          listRfs[rfIdx].asignadoNombre = newName;
          listRfs[rfIdx].asignadoTurno = newTurn;
          await adminService.saveRfs(listRfs);
        }
      }

      alert('✅ Registro de asignación actualizado correctamente.');
      modal.remove();
      renderRFSection(container);
    };
  };

  const abrirModalRF = (container, rf = null) => {
    const isEdit = !!rf;
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR EQUIPO RF' : '📡 REGISTRAR EQUIPO RF'}
        </h3>
        
        <form id="form_rf_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SERIE / IDENTIFICADOR:</label>
            <input type="text" id="rf_m_serie" required value="${rf ? rf.serie : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MARCA:</label>
              <input type="text" id="rf_m_marca" required placeholder="Ej: Zebra" value="${rf ? rf.marca : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MODELO:</label>
              <input type="text" id="rf_m_modelo" required placeholder="Ej: MC3300" value="${rf ? rf.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">NÚMERO:</label>
            <input type="text" id="rf_m_numero" placeholder="Ej: 001, A-12, RF-05..." value="${rf ? (rf.numero || '') : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:700; font-size:0.85rem;">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">BATERÍA (%):</label>
              <input type="number" id="rf_m_bateria" min="0" max="100" required value="${rf ? rf.bateria : '100'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="rf_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${rf && rf.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${rf && rf.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${rf && rf.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMENTARIOS / NOTAS:</label>
            <textarea id="rf_m_comentarios" rows="3" placeholder="Detalles de estado del terminal..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${rf ? (rf.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, var(--primary) 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_modal').onsubmit = async (e) => {
      e.preventDefault();
      const serieVal = modal.querySelector('#rf_m_serie').value.trim().toUpperCase();
      const marcaVal = modal.querySelector('#rf_m_marca').value.trim();
      const modeloVal = modal.querySelector('#rf_m_modelo').value.trim();
      const numeroVal = modal.querySelector('#rf_m_numero').value.trim();
      const bateriaVal = modal.querySelector('#rf_m_bateria').value;
      const estadoVal = modal.querySelector('#rf_m_estado').value;
      const comentariosVal = modal.querySelector('#rf_m_comentarios').value.trim();

      if (!isEdit) {
        if (rfs.find(r => r.serie === serieVal)) {
          return alert(`❌ Error: El equipo con Serie ${serieVal} ya se encuentra registrado.`);
        }
      }

      const list = [...rfs];
      if (isEdit) {
        const idx = list.findIndex(r => r.serie === serieVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], marca: marcaVal, modelo: modeloVal, numero: numeroVal, bateria: bateriaVal, estado: estadoVal, comentarios: comentariosVal };
          if (estadoVal !== 'Operativo' && list[idx].asignadoDni) {
            const activeAssignment = assignments.find(a => a.rf_serial === serieVal && !a.returned_at);
            if (activeAssignment) {
              activeAssignment.returned_at = new Date().toISOString();
              activeAssignment.return_notes = `Retorno forzado: El equipo pasó a estado ${estadoVal}.`;
              await adminService.saveRfAssignments(assignments);
            }
            list[idx].asignadoDni = null;
            list[idx].asignadoNombre = null;
            list[idx].asignadoTurno = null;
          }
        }
      } else {
        list.push({ serie: serieVal, marca: marcaVal, modelo: modeloVal, numero: numeroVal, bateria: bateriaVal, estado: estadoVal, comentarios: comentariosVal, asignadoDni: null });
      }

      await adminService.saveRfs(list);
      alert(isEdit ? "✅ Datos del equipo actualizados." : "✅ Equipo RF registrado con éxito.");
      modal.remove();
      renderRFSection(container);
    };
  };

  const abrirModalBattery = (container, bat = null) => {
    const isEdit = !!bat;
    const batteries = adminService.getRfsBatteries() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(16,185,129,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR BATERÍA' : '🔋 REGISTRAR BATERÍA'}
        </h3>
        
        <form id="form_battery_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CÓDIGO DE BATERÍA:</label>
            <input type="text" id="bat_m_codigo" required value="${bat ? bat.codigo : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMPATIBILIDAD (MODELO RFS):</label>
            <input type="text" id="bat_m_modelo" required placeholder="Ej: Zebra MC3300" value="${bat ? bat.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SALUD CELDA (%):</label>
              <input type="number" id="bat_m_salud" min="0" max="100" required value="${bat ? bat.salud : '100'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="bat_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${bat && bat.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${bat && bat.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${bat && bat.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">UBICACIÓN / RANURA DE CARGA:</label>
            <input type="text" id="bat_m_ubicacion" required placeholder="Ej: Cargador 1, Ranura 3" value="${bat ? bat.ubicacion : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
            <textarea id="bat_m_comentarios" rows="3" placeholder="Comentarios sobre el estado de la batería..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${bat ? (bat.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="bat_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #10b981 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(16,185,129,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#bat_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_battery_modal').onsubmit = async (e) => {
      e.preventDefault();
      const codigoVal = modal.querySelector('#bat_m_codigo').value.trim().toUpperCase();
      const modeloVal = modal.querySelector('#bat_m_modelo').value.trim();
      const saludVal = modal.querySelector('#bat_m_salud').value;
      const estadoVal = modal.querySelector('#bat_m_estado').value;
      const ubicacionVal = modal.querySelector('#bat_m_ubicacion').value.trim();
      const comentariosVal = modal.querySelector('#bat_m_comentarios').value.trim();

      if (!isEdit) {
        if (batteries.find(b => b.codigo === codigoVal)) {
          return alert(`❌ Error: La batería con Código ${codigoVal} ya se encuentra registrada.`);
        }
      }

      const list = [...batteries];
      if (isEdit) {
        const idx = list.findIndex(b => b.codigo === codigoVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], modelo: modeloVal, salud: saludVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal };
        }
      } else {
        list.push({ codigo: codigoVal, modelo: modeloVal, salud: saludVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal });
      }

      await adminService.saveRfsBatteries(list);
      alert(isEdit ? "✅ Datos de la batería actualizados." : "✅ Batería registrada con éxito.");
      modal.remove();
      renderRFSection(container);
    };
  };

  const abrirModalCharger = (container, chg = null) => {
    const isEdit = !!chg;
    const chargers = adminService.getRfsChargers() || [];

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(6, 182, 212, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(6,182,212,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.2rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          ${isEdit ? '✏️ EDITAR CARGADOR' : '🔌 REGISTRAR CARGADOR'}
        </h3>
        
        <form id="form_charger_modal" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CÓDIGO DE CARGADOR:</label>
            <input type="text" id="chg_m_codigo" required value="${chg ? chg.codigo : ''}" ${isEdit ? 'readonly style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); cursor:not-allowed; width:100%; outline:none; padding:0.6rem; border-radius:8px;"' : 'style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-family:monospace; font-weight:800;"'}>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MARCA:</label>
              <input type="text" id="chg_m_marca" required placeholder="Ej: Zebra" value="${chg ? chg.marca : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">MODELO:</label>
              <input type="text" id="chg_m_modelo" required placeholder="Ej: 4 Slots Stand" value="${chg ? chg.modelo : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">CAPACIDAD (RANURAS):</label>
              <input type="number" id="chg_m_capacidad" min="1" max="24" required value="${chg ? chg.capacidad : '4'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">RANURAS OPERATIVAS:</label>
              <input type="number" id="chg_m_ranuras_ok" min="0" max="24" required value="${chg ? chg.ranuras_ok : '4'}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">UBICACIÓN / MESA:</label>
              <input type="text" id="chg_m_ubicacion" required placeholder="Ej: Mesa de Carga 1" value="${chg ? chg.ubicacion : ''}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:600;">
            </div>
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">ESTADO FÍSICO:</label>
              <select id="chg_m_estado" style="background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:700; cursor:pointer;">
                <option value="Operativo" ${chg && chg.estado==='Operativo'?'selected':''}>OPERATIVO</option>
                <option value="En Mantenimiento" ${chg && chg.estado==='En Mantenimiento'?'selected':''}>EN MANTENIMIENTO</option>
                <option value="De Baja" ${chg && chg.estado==='De Baja'?'selected':''}>DE BAJA</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">COMENTARIOS / NOTAS:</label>
            <textarea id="chg_m_comentarios" rows="3" placeholder="Comentarios sobre el estado del cargador..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;">${chg ? (chg.comentarios || '') : ''}</textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="chg_m_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #06b6d4 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(6,182,212,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#chg_m_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_charger_modal').onsubmit = async (e) => {
      e.preventDefault();
      const codigoVal = modal.querySelector('#chg_m_codigo').value.trim().toUpperCase();
      const marcaVal = modal.querySelector('#chg_m_marca').value.trim();
      const modeloVal = modal.querySelector('#chg_m_modelo').value.trim();
      const capacidadVal = modal.querySelector('#chg_m_capacidad').value;
      const ranurasOkVal = modal.querySelector('#chg_m_ranuras_ok').value;
      const estadoVal = modal.querySelector('#chg_m_estado').value;
      const ubicacionVal = modal.querySelector('#chg_m_ubicacion').value.trim();
      const comentariosVal = modal.querySelector('#chg_m_comentarios').value.trim();

      if (parseInt(ranurasOkVal) > parseInt(capacidadVal)) {
        return alert("❌ Error: Las ranuras operativas no pueden exceder la capacidad total.");
      }

      if (!isEdit) {
        if (chargers.find(c => c.codigo === codigoVal)) {
          return alert(`❌ Error: El cargador con Código ${codigoVal} ya se encuentra registrado.`);
        }
      }

      const list = [...chargers];
      if (isEdit) {
        const idx = list.findIndex(c => c.codigo === codigoVal);
        if (idx !== -1) {
          list[idx] = { ...list[idx], marca: marcaVal, modelo: modeloVal, capacidad: capacidadVal, ranuras_ok: ranurasOkVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal };
        }
      } else {
        list.push({ codigo: codigoVal, marca: marcaVal, modelo: modeloVal, capacidad: capacidadVal, ranuras_ok: ranurasOkVal, estado: estadoVal, ubicacion: ubicacionVal, comentarios: comentariosVal });
      }

      await adminService.saveRfsChargers(list);
      alert(isEdit ? "✅ Datos del cargador actualizados." : "✅ Cargador registrado con éxito.");
      modal.remove();
      renderRFSection(container);
    };
  };

  const abrirModalAsignar = (container, serie) => {
    const workers = adminService.getWorkers() || [];
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const activeWorkers = workers.filter(w => w.active !== false);

    const workerOptions = activeWorkers.map(w => `
      <option value="${w.dni}" style="background:#0f172a;">${w.apellidos}, ${w.nombre} (DNI: ${w.dni})</option>
    `).join('');

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          👷 ASIGNAR EQUIPO RF
        </h3>
        <p style="margin:-1rem 0 1.5rem 0; text-align:center; color:var(--primary); font-family:monospace; font-weight:800; font-size:0.9rem;">SERIE: ${serie}</p>
        
        <form id="form_rf_assign" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">SELECCIONAR TRABAJADOR:</label>
            <select id="rf_a_worker" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.65rem; border-radius:8px; font-weight:700; cursor:pointer;">
              <option value="" style="background:#0f172a;">-- Seleccionar operario activo --</option>
              ${workerOptions}
            </select>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">TURNO DE TRABAJO:</label>
            <select id="rf_a_turn" required style="width:100%; background:rgba(15,23,42,0.9); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none; padding:0.65rem; border-radius:8px; font-weight:700; cursor:pointer;">
              <option value="DIA" style="background:#0f172a;">DIA</option>
              <option value="NOCHE" style="background:#0f172a;">NOCHE</option>
            </select>
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (ENTREGA):</span>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🖥️ Pantalla en buen estado</span>
              <input type="checkbox" id="rf_a_pantalla" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🏷️ Numeración legible / OK</span>
              <input type="checkbox" id="rf_a_numeracion" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / COMENTARIOS:</label>
            <textarea id="rf_a_notes" rows="2" placeholder="Ej: Sin arañazos, incluye lápiz..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_a_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, var(--primary) 0%, #000 150%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">ASIGNAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_a_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_assign').onsubmit = async (e) => {
      e.preventDefault();
      const workerDni = modal.querySelector('#rf_a_worker').value;
      const turnVal = modal.querySelector('#rf_a_turn').value;
      const pantallaOk = modal.querySelector('#rf_a_pantalla').checked;
      const numeracionOk = modal.querySelector('#rf_a_numeracion').checked;
      const notesVal = modal.querySelector('#rf_a_notes').value.trim();

      const worker = activeWorkers.find(w => w.dni === workerDni);
      if (!worker) return;

      // Obtener el estado local más actualizado justo en el momento del submit para evitar sobreescrituras en clics rápidos
      const currentRfs = adminService.getRfs() || [];
      const currentAssignments = adminService.getRfAssignments() || [];

      const workerActiveRf = currentRfs.find(r => r.asignadoDni === workerDni);
      if (workerActiveRf) {
        if (!confirm(`⚠️ El operario ${worker.nombre} ya tiene asignado el equipo ${workerActiveRf.serie}. ¿Deseas asignarle este nuevo equipo adicional?`)) {
          return;
        }
      }

      const listRfs = [...currentRfs];
      const rfIdx = listRfs.findIndex(r => r.serie === serie);
      if (rfIdx !== -1) {
        listRfs[rfIdx].asignadoDni = workerDni;
        listRfs[rfIdx].asignadoNombre = `${worker.apellidos}, ${worker.nombre}`;
        listRfs[rfIdx].asignadoTurno = turnVal;
      }

      const listAssignments = [...currentAssignments];
      listAssignments.push({
        id: 'ASIG_' + Date.now(),
        rf_serial: serie,
        worker_dni: workerDni,
        worker_name: `${worker.apellidos}, ${worker.nombre}`,
        turn: turnVal,
        assigned_at: new Date().toISOString(),
        returned_at: null,
        pantalla_ok: pantallaOk,
        numeracion_ok: numeracionOk,
        notes: notesVal,
        return_notes: null
      });

      await adminService.saveRfs(listRfs);
      await adminService.saveRfAssignments(listAssignments);

      alert(`✅ Equipo RF ${serie} asignado correctamente.`);
      modal.remove();
      renderRFSection(container);
    };
  };

  const abrirModalRecibir = (container, serie) => {
    const rfs = adminService.getRfs() || [];
    const assignments = adminService.getRfAssignments() || [];

    const rf = rfs.find(r => r.serie === serie);
    if (!rf) return;

    const activeAssignment = assignments.find(a => a.rf_serial === serie && !a.returned_at);

    const pantallaInicialText = activeAssignment && activeAssignment.pantalla_ok !== false ? '🖥️ OK' : '🖥️ FALLO / MAL';
    const numeracionInicialText = activeAssignment && activeAssignment.numeracion_ok !== false ? '🏷️ OK' : '🏷️ FALLO / MAL';

    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
    modal.innerHTML = `
      <div class="glass-panel" style="width:400px; padding:2.5rem 2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2);">
        <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">
          📥 RECIBIR EQUIPO RF (DEVOLUCIÓN)
        </h3>
        <p style="margin:-1rem 0 0.5rem 0; text-align:center; color:#f97316; font-family:monospace; font-weight:800; font-size:0.9rem;">SERIE: ${serie}</p>
        <div style="background:rgba(255,255,255,0.02); padding:0.5rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05); margin-bottom:1.2rem; font-size:0.7rem; text-align:center; color:var(--text-muted);">
          Operario: <b style="color:#fff;">${rf.asignadoNombre || 'Operario'}</b><br>
          <span style="display:inline-block; margin-top:3px;">
            Condición inicial: <span style="color:#38bdf8;">${pantallaInicialText}</span> | <span style="color:#38bdf8;">${numeracionInicialText}</span>
          </span>
        </div>
        
        <form id="form_rf_receive" style="display:flex; flex-direction:column; gap:1.2rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">BATERÍA DE RETORNO (%):</label>
            <input type="number" id="rf_r_bateria" min="0" max="100" required value="${rf.bateria}" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-weight:800; text-align:center;">
          </div>

          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.8rem; border-radius:8px; display:flex; flex-direction:column; gap:0.6rem;">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700; display:block;">📝 CRITERIOS DE CONTROL (DEVOLUCIÓN):</span>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🖥️ Pantalla devuelta OK / Sin daños</span>
              <input type="checkbox" id="rf_r_pantalla" ${!activeAssignment || activeAssignment.pantalla_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
            
            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:600; color:#fff; font-size:0.75rem;">
              <span>🏷️ Numeración devuelta legible / OK</span>
              <input type="checkbox" id="rf_r_numeracion" ${!activeAssignment || activeAssignment.numeracion_ok !== false ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
            </label>
          </div>

          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:5px; font-weight:700;">OBSERVACIONES / NOTAS DE RETORNO:</label>
            <textarea id="rf_r_notes" rows="2" placeholder="Ej: Todo conforme, devuelto operativo..." style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.15); color:#fff; width:100%; outline:none; padding:0.6rem; border-radius:8px; font-size:0.8rem; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px; margin-top:1rem;">
            <button type="button" id="rf_r_cancel" style="flex:1; padding:0.8rem; border:1px solid rgba(255,255,255,0.15); border-radius:12px; background:rgba(255,255,255,0.05); color:#cbd5e1; font-size:0.85rem; font-weight:700; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#cbd5e1';">CANCELAR</button>
            <button type="submit" style="flex:1; padding:0.8rem; border:none; border-radius:12px; background:linear-gradient(135deg, #f97316 0%, #ea580c 100%); color:#fff; font-size:0.85rem; font-weight:800; cursor:pointer; box-shadow:0 4px 15px rgba(234,88,12,0.3); transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">GUARDAR</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#rf_r_cancel').onclick = () => modal.remove();
    modal.querySelector('#form_rf_receive').onsubmit = async (e) => {
      e.preventDefault();
      const batVal = modal.querySelector('#rf_r_bateria').value;
      const pantallaDevuelta = modal.querySelector('#rf_r_pantalla').checked;
      const numeracionDevuelta = modal.querySelector('#rf_r_numeracion').checked;
      const notesVal = modal.querySelector('#rf_r_notes').value.trim();

      const nuevoEstado = (!pantallaDevuelta || !numeracionDevuelta) ? 'En Mantenimiento' : 'Operativo';

      const listRfs = [...rfs];
      const rfIdx = listRfs.findIndex(r => r.serie === serie);
      if (rfIdx !== -1) {
        listRfs[rfIdx].asignadoDni = null;
        listRfs[rfIdx].asignadoNombre = null;
        listRfs[rfIdx].asignadoTurno = null;
        listRfs[rfIdx].bateria = batVal;
        listRfs[rfIdx].estado = nuevoEstado;
        if (nuevoEstado === 'En Mantenimiento') {
          listRfs[rfIdx].comentarios = `Devuelto con daños. Pantalla: ${pantallaDevuelta?'OK':'DAÑADA'} | Numeración: ${numeracionDevuelta?'OK':'DAÑADA'}. Observaciones: ${notesVal}`;
        }
      }

      const listAssignments = [...assignments];
      if (activeAssignment) {
        const asigIdx = listAssignments.findIndex(a => a.id === activeAssignment.id);
        if (asigIdx !== -1) {
          listAssignments[asigIdx].returned_at = new Date().toISOString();
          listAssignments[asigIdx].retorno_pantalla_ok = pantallaDevuelta;
          listAssignments[asigIdx].retorno_numeracion_ok = numeracionDevuelta;
          
          let alertDetails = `Devolución Conforme con ${batVal}% bat.`;
          if (nuevoEstado === 'En Mantenimiento') {
             alertDetails = `⚠️ DEVOLUCIÓN REGISTRADA CON DAÑOS. El terminal ha sido enviado automáticamente a Taller/Mantenimiento.`;
          }
          listAssignments[asigIdx].return_notes = `${alertDetails} ${notesVal ? '- ' + notesVal : ''}`;
        }
      }

      await adminService.saveRfs(listRfs);
      await adminService.saveRfAssignments(listAssignments);

      const successMsg = nuevoEstado === 'En Mantenimiento' 
        ? `⚠️ Equipo RF ${serie} devuelto CON DAÑOS. Se envió automáticamente al taller.`
        : `✅ Equipo RF ${serie} devuelto conforme y disponible.`;
      
      alert(successMsg);
      modal.remove();
      renderRFSection(container);
    };
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
            if (await showPremiumConfirm("ZONA DE PELIGRO - REINICIAR DATOS", "¿ESTÁS SEGURO? Se borrará TODO el historial de asistencia y performance de forma permanente. Los trabajadores NO se borrarán.", "danger")) {
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

  const renderBufferConfig = async (container) => {
      container.innerHTML = `
        <div style="display:flex; justify-content:center; padding:1.5rem 0.5rem; width:100%;">
          <div class="glass-panel animate-fade-in" style="
              width: 100%;
              max-width: 800px;
              padding: 2.5rem;
              border-radius: 20px;
              background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.75) 100%);
              border: 1px solid rgba(255, 255, 255, 0.08);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.02);
              font-family: 'Inter', sans-serif;
          ">
              <!-- Header Section -->
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2rem; padding-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.08); flex-wrap:wrap; gap:1rem;">
                  <div style="display:flex; align-items:center; gap:1rem;">
                      <div style="font-size:2.2rem; filter: drop-shadow(0 0 10px rgba(99,102,241,0.5));">⚙️</div>
                      <div>
                          <h3 style="margin:0; color:#fff; font-size:1.3rem; font-weight:800; letter-spacing:1px; font-family:'Outfit', sans-serif; text-transform: uppercase;">CONFIGURACIÓN DEL BUFFER</h3>
                          <p style="margin:0.2rem 0 0 0; color:#94a3b8; font-size:0.78rem; font-weight:500;">Configura las cantidades de buffer para cada Marca y Gender Rims.</p>
                      </div>
                  </div>
              </div>
              
              <!-- Workspace Area -->
              <div id="buffer-config-workspace">
                  <div style="display:flex; justify-content:center; padding:3rem;"><div class="spinner"></div><div style="font-size:0.9rem; color:#94a3b8; margin-left:1rem;">Cargando combinaciones...</div></div>
              </div>
              
              <!-- Save Button -->
              <button id="btn-save-buffer-config" class="btn" style="
                  width: 100%;
                  padding: 0.9rem;
                  border: none;
                  border-radius: 12px;
                  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 150%);
                  color: #fff;
                  font-size: 0.9rem;
                  font-weight: 800;
                  letter-spacing: 1px;
                  cursor: pointer;
                  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  gap: 0.8rem;
              ">
                  <span>💾 GUARDAR CONFIGURACIÓN</span>
              </button>
          </div>
        </div>
        <style>
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.1);
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.25);
            }
            .buffer-config-row {
                border-bottom: 1px solid rgba(255,255,255,0.03);
                transition: all 0.2s ease;
            }
            .buffer-config-row:hover {
                background: rgba(255, 255, 255, 0.02);
            }
            .buffer-config-input {
                width: 120px;
                padding: 0.4rem 0.6rem;
                background: rgba(15, 23, 42, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #fff;
                text-align: right;
                font-weight: 700;
                transition: all 0.25s ease;
            }
            .buffer-config-input:focus {
                border-color: #6366f1;
                background: rgba(99, 102, 241, 0.1);
                box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
                outline: none;
            }
        </style>
      `;
      
      const workspace = document.getElementById('buffer-config-workspace');
      const btnSave = document.getElementById('btn-save-buffer-config');
      
      try {
          // 2. Fetch maestro articulos
          const maestro = await getAreaData('articulos') || [];
          if (maestro.length === 0) {
              workspace.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; background: rgba(239, 68, 68, 0.04); border: 1px dashed rgba(239, 68, 68, 0.2); border-radius: 12px; margin-bottom: 2rem;">
                    <div style="font-size: 2.8rem; margin-bottom: 1rem; filter: drop-shadow(0 0 10px rgba(239,68,68,0.2));">⚠️</div>
                    <h4 style="margin:0 0 0.5rem 0; color:#fff; font-size:1.1rem; font-weight:800; font-family:'Outfit', sans-serif;">Maestro de Artículos no cargado</h4>
                    <p style="margin:0 0 1.5rem 0; color:#94a3b8; font-size:0.8rem; line-height:1.5;">
                        No se encontraron registros en el Maestro de Artículos. Por favor, sube el archivo Maestro primero en la sección de Archivos del Buffer.
                    </p>
                    <button onclick="activeBufferSub = 'maestros'; renderBufferTab();" class="btn" style="
                        padding: 0.6rem 1.5rem;
                        background: rgba(239, 68, 68, 0.15);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 8px;
                        color: #ff8b8b;
                        font-weight: 700;
                        font-size: 0.78rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(239,68,68,0.25)';" onmouseout="this.style.background='rgba(239,68,68,0.15)';">
                        📁 Cargar Maestro
                    </button>
                </div>
              `;
              btnSave.style.display = 'none';
              return;
          }
          
          // 3. Extract unique combinations of MARCA & GENDER RIMS with robust index detection
          let brandIdx = 13;
          let genderIdx = 3;
          
          const firstRow = maestro[0];
          if (firstRow && Array.isArray(firstRow)) {
              firstRow.forEach((cell, idx) => {
                  const cellStr = String(cell || '').trim().toUpperCase();
                  if (cellStr === 'MARCA' || cellStr === 'BRAND') {
                      brandIdx = idx;
                  } else if (cellStr === 'GENDER RIMS' || cellStr === 'GENDER' || cellStr === 'GENDERRIMS' || cellStr === 'DEPARTAMENTO' || cellStr === 'GENERO') {
                      genderIdx = idx;
                  }
              });
          }
          
          let startIndex = 0;
          if (Array.isArray(maestro[0])) {
              const firstCell = String(maestro[0][0] || '').trim().toUpperCase();
              if (firstCell.includes('SKU') || firstCell.includes('ARTICULO') || firstCell.includes('BARCODE') || firstCell.includes('CODIGO') || firstCell.includes('GENDER') || firstCell.includes('GENERO') || firstCell.includes('MARCA') || firstCell.includes('BRAND')) {
                  startIndex = 1;
              }
          }
          
          const uniqueCombinations = [];
          const seen = new Set();
          
          for (let i = startIndex; i < maestro.length; i++) {
              const row = maestro[i];
              if (!row) continue;
              const raw = Array.isArray(row) ? row : Object.values(row);
              if (raw.length <= Math.max(brandIdx, genderIdx)) continue;
              
              const marca = String(raw[brandIdx] || 'OTROS').trim().toUpperCase();
              const gender = String(raw[genderIdx] || 'OTROS').trim().toUpperCase();
              
              if (!marca || marca === 'MARCA' || marca === 'BRAND' || gender === 'GENDER' || gender === 'GENDER RIMS') continue;
              
              const key = `${marca}|${gender}`;
              if (!seen.has(key)) {
                  seen.add(key);
                  uniqueCombinations.push({ marca, gender });
              }
          }
          
          uniqueCombinations.sort((a, b) => {
              if (a.marca !== b.marca) return a.marca.localeCompare(b.marca);
              return a.gender.localeCompare(b.gender);
          });
          
          // 4. Fetch existing configs
          let savedQtys = {};
          const config = await fetchBufferConfig();
          bufferConfigCached = config;
          
          if (config && config.brand_gender_qtys) {
              try {
                  savedQtys = JSON.parse(config.brand_gender_qtys) || {};
              } catch (e) {
                  console.warn("[PULSE] Error parsing brand_gender_qtys:", e);
              }
          }
          
          // 5. Render active workspace HTML
          workspace.innerHTML = `
              <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; align-items:center;">
                  <!-- Search Filter -->
                  <div style="position:relative; width:100%;">
                      <span style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:#64748b; font-size:0.9rem;">🔍</span>
                      <input type="text" id="buffer-config-search" placeholder="Buscar por marca o género..." style="
                          width: 100%;
                          padding: 0.65rem 1rem 0.65rem 2.5rem;
                          background: rgba(15, 23, 42, 0.6);
                          border: 1px solid rgba(255, 255, 255, 0.08);
                          border-radius: 10px;
                          color: #fff;
                          font-size: 0.82rem;
                          outline: none;
                          transition: all 0.3s ease;
                      " onfocus="this.style.borderColor='rgba(99, 102, 241, 0.4)'; this.style.boxShadow='0 0 10px rgba(99, 102, 241, 0.1)';" onblur="this.style.borderColor='rgba(255, 255, 255, 0.08)'; this.style.boxShadow='none';" />
                  </div>
                  <!-- Stats Panel -->
                  <div style="display:flex; justify-content:space-around; align-items:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:0.45rem 1rem;">
                      <div style="text-align:center;">
                          <div style="font-size:0.6rem; color:#64748b; font-weight:700; letter-spacing:0.5px;">TOTAL FILAS</div>
                          <div id="stats-total-rows" style="font-size:0.9rem; color:#38bdf8; font-weight:800; font-family:'Outfit', sans-serif;">0</div>
                      </div>
                      <div style="width:1px; height:18px; background:rgba(255,255,255,0.1);"></div>
                      <div style="text-align:center;">
                          <div style="font-size:0.6rem; color:#64748b; font-weight:700; letter-spacing:0.5px;">CONFIGURADOS</div>
                          <div id="stats-configured" style="font-size:0.9rem; color:#34d399; font-weight:800; font-family:'Outfit', sans-serif;">0</div>
                      </div>
                  </div>
              </div>
              
              <!-- Combinations Table -->
              <div style="max-height:400px; overflow-y:auto; border-radius:12px; border:1px solid rgba(255,255,255,0.06); background:rgba(15, 23, 42, 0.3); margin-bottom:2rem;" class="custom-scrollbar">
                  <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem;">
                      <thead>
                          <tr style="background:rgba(30, 41, 59, 0.75); border-bottom:1px solid rgba(255,255,255,0.08); position:sticky; top:0; z-index:10;">
                              <th style="padding:0.85rem 1rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif;">Marca</th>
                              <th style="padding:0.85rem 1rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif;">Gender Rims</th>
                              <th style="padding:0.85rem 1rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; width:150px; text-align:right;">Cantidad (Qty)</th>
                          </tr>
                      </thead>
                      <tbody id="buffer-config-tbody"></tbody>
                  </table>
              </div>
          `;
          
          const tbody = document.getElementById('buffer-config-tbody');
          
          const renderRows = (filteredList) => {
              if (filteredList.length === 0) {
                  return `<tr><td colspan="3" style="text-align:center; padding:2rem; color:#64748b; font-size:0.8rem;">No se encontraron combinaciones.</td></tr>`;
              }
              return filteredList.map(comb => {
                  const key = `${comb.marca}|${comb.gender}`;
                  const qtyVal = savedQtys[key] !== undefined ? savedQtys[key] : "";
                  return `
                      <tr class="buffer-config-row">
                          <td style="padding:0.8rem 1rem; color:#fff; font-weight:600; font-family:'Outfit', sans-serif; font-size:0.82rem;">${comb.marca}</td>
                          <td style="padding:0.8rem 1rem; color:#94a3b8; font-weight:500; font-size:0.82rem;">${comb.gender}</td>
                          <td style="padding:0.8rem 1rem; text-align:right;">
                              <input type="text" class="buffer-config-input" data-key="${key}" value="${qtyVal}" placeholder="0" oninput="this.value = this.value.replace(/[^0-9]/g, '')" />
                          </td>
                      </tr>
                  `;
              }).join('');
          };
          
          const refreshStats = () => {
              let total = uniqueCombinations.length;
              let configured = 0;
              uniqueCombinations.forEach(comb => {
                  const key = `${comb.marca}|${comb.gender}`;
                  const val = savedQtys[key];
                  if (val !== undefined && val !== "" && parseInt(val) > 0) {
                      configured++;
                  }
              });
              document.getElementById('stats-total-rows').textContent = total;
              document.getElementById('stats-configured').textContent = configured;
          };
          
          // Initial populate
          tbody.innerHTML = renderRows(uniqueCombinations);
          refreshStats();
          
          // Input change handler via delegation
          tbody.addEventListener('input', (e) => {
              if (e.target.classList.contains('buffer-config-input')) {
                  const key = e.target.dataset.key;
                  const rawVal = e.target.value.trim();
                  if (rawVal === "") {
                      delete savedQtys[key];
                  } else {
                      savedQtys[key] = parseInt(rawVal) || 0;
                  }
                  refreshStats();
              }
          });
          
          // Search input handler
          const searchInput = document.getElementById('buffer-config-search');
          searchInput.addEventListener('input', (e) => {
              const term = e.target.value.trim().toUpperCase();
              const filtered = uniqueCombinations.filter(comb => 
                  comb.marca.includes(term) || comb.gender.includes(term)
              );
              tbody.innerHTML = renderRows(filtered);
          });
          
          // Bind save button click
          btnSave.onclick = async () => {
              btnSave.disabled = true;
              btnSave.style.opacity = '0.7';
              btnSave.innerHTML = `<span>⏳ GUARDANDO...</span>`;
              
              const payload = {
                  ...bufferConfigCached,
                  brand_gender_qtys: JSON.stringify(savedQtys)
              };
              
              const res = await saveBufferConfig(payload);
              btnSave.disabled = false;
              btnSave.style.opacity = '1';
              btnSave.innerHTML = `<span>💾 GUARDAR CONFIGURACIÓN</span>`;
              
              if (res && res.status === 'success') {
                  bufferConfigCached = payload;
                  showPremiumAlert("¡ÉXITO!", "La configuración de buffer por Marca y Género se ha guardado y aplicado correctamente.", "success");
                  await logSystemAction(user.username, 'CONFIG_BUFFER_ACTUALIZADA', `Combinaciones guardadas: ${Object.keys(savedQtys).length}`);
              } else {
                  showPremiumAlert("Error", res?.message || "No se pudo guardar la configuración en el servidor.", "error");
              }
          };
          
      } catch (err) {
          workspace.innerHTML = `<div style="padding:2rem; text-align:center; color:#ef4444;">Fallo al cargar la configuración: ${err.message}</div>`;
      }
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
              // --- MODO BLINDADO v24.6.0 ---
              if (localStorage.getItem('PULSE_OFFLINE_FORCE')) {
                  console.log("🛡️ [PULSE] Radar en pausa por Modo Blindado.");
                  return;
              }

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

    // Construir mapa de Código de Barras a SKU para traducción instantánea en el escaneo
    const barcodeToSkuMap = new Map();
    if (articulos && articulos.length > 0) {
        articulos.forEach(a => {
            const raw = Array.isArray(a) ? a : Object.values(a);
            if (raw.length >= 2) {
                const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || raw[1] || '').toString().trim().toUpperCase();
                const possibleBarcode = String(raw[0] || '').trim().toUpperCase();
                if (mSku && possibleBarcode) {
                    barcodeToSkuMap.set(possibleBarcode, mSku);
                }
                
                // Inspeccionar otras celdas por si acaso (ej. si la columna de código de barras está en otra posición)
                raw.forEach(cell => {
                    const cellStr = String(cell || '').trim();
                    if (/^\d{8,15}$/.test(cellStr) && mSku) {
                        barcodeToSkuMap.set(cellStr, mSku);
                    }
                });
            }
        });
        console.log(`[PULSE] Mapeo de códigos de barra cargado. Total códigos registrados: ${barcodeToSkuMap.size}`);
    }

    if (activeModuloInvSub === 'general') {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; content.appendChild(wrap);
        renderUploadArea(wrap, 'articulos', articulos, '.xlsx', 'MAESTRO ARTÍCULOS');
        // Agregamos info visual de que se nutre de Archivo Inventario
        wrap.innerHTML += `<div style="margin-top:1rem; padding:0.8rem; background:rgba(129, 140, 248, 0.05); border-radius:8px; border:1px dashed rgba(129, 140, 248, 0.2); font-size:0.7rem; color:#818cf8; text-align:center;">ℹ️ Este módulo utiliza automáticamente la Matriz y Stock cargados en 'ARCHIVO INVENTARIO'.</div>`;
    } 
    else if (activeModuloInvSub === 'ciclicos') {
        const session = getSession();
        const isAdmin = session && (session.role === 'admin' || session.role === 'jefe');
        const activeLocation = localStorage.getItem('eru_active_location');

        // MODO ESCANEO (Compartido para Admin y Operario)
        if (activeLocation) {
            const scans = cyclicService.getScansByLocation(activeLocation);
            const totalScans = scans.reduce((acc, curr) => acc + curr.qty, 0);

            content.innerHTML = `
                <div style="padding:0.5rem; text-align:center;">
                    <button id="btn_back_locs" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">< Volver a lista</button>
                    
                    <div style="background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.3); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem;">
                        <h2 style="color:#38bdf8; margin:0 0 0.5rem 0; font-size:1.8rem; font-weight:900;">${activeLocation}</h2>
                        <p style="margin:0; font-size:0.8rem; color:#fff;">Pistolee los SKUs físicos ahora</p>
                        <h1 style="color:#fff; font-size:3rem; margin:1rem 0 0 0;" id="scan_counter">${totalScans}</h1>
                        <p style="margin:0; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Artículos leídos</p>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:1rem;">
                        <button id="btn_close_loc" class="btn-premium-pulse" style="padding:15px; font-size:1rem; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer;">🔒 CERRAR UBICACIÓN</button>
                    </div>
                    <input type="text" id="sku_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
                </div>
            `;

            document.getElementById('btn_back_locs').onclick = () => {
                localStorage.removeItem('eru_active_location');
                renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
            };

            document.getElementById('btn_close_loc').onclick = async () => {
                if(await showPremiumConfirm('CERRAR UBICACIÓN', '¿Seguro que deseas cerrar esta ubicación? Ya no podrás pistolear más SKUs aquí.', 'warning')) {
                    cyclicService.closeLocation(activeLocation);
                    localStorage.removeItem('eru_active_location');
                    renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                }
            };

            const playBeep = () => {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            };

            const skuInput = document.getElementById('sku_scanner_input');
            if(skuInput) {
                skuInput.focus({ preventScroll: true });
                const focusHandler = () => {
                    if (document.getElementById('sku_scanner_input')) {
                        skuInput.focus({ preventScroll: true });
                    } else {
                        document.removeEventListener('click', focusHandler);
                    }
                };
                document.addEventListener('click', focusHandler);
                skuInput.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter') {
                        const code = skuInput.value.trim();
                        skuInput.value = '';
                        if(code) {
                            playBeep();
                            
                            // Traducir código de barras a SKU real si existe en el maestro
                            let translatedCode = code;
                            if (barcodeToSkuMap && barcodeToSkuMap.has(code.toUpperCase())) {
                                translatedCode = barcodeToSkuMap.get(code.toUpperCase());
                                console.log(`[ESCANER] Traduciendo código de barras ${code} a SKU ${translatedCode}`);
                            }
                            
                            cyclicService.saveScan(activeLocation, translatedCode);
                            const currentCount = parseInt(document.getElementById('scan_counter').innerText) || 0;
                            document.getElementById('scan_counter').innerText = currentCount + 1;
                        }
                    }
                });
            }
        } 
        else if (isAdmin) {
            // VISTA ADMINISTRADOR (Panel Central)
            const currentTasks = cyclicService.getTasks();
            const activeCount = currentTasks.length;
            const statusHtml = activeCount > 0 
                ? `<div style="margin-top:1rem; padding:0.8rem; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; color:#10b981; font-size:0.85rem; font-weight:bold; text-align:center;">🟢 TAREA ACTIVA EN PISO: ${activeCount} ubicaciones pendientes</div>` 
                : `<div style="margin-top:1rem; padding:0.8rem; background:rgba(255,255,255,0.05); border-radius:8px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No hay tareas activas.</div>`;

            // Construir mapa de Stock de Sistema por ubicación para cálculo en vivo del Monitor
            const systemStockMap = new Map();
            if (stock && stock.length > 0) {
                stock.forEach(row => {
                    const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
                    const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;
                    if (ubi) {
                        systemStockMap.set(ubi, (systemStockMap.get(ubi) || 0) + qty);
                    }
                });
            }

            content.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                    <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(255,255,255,0.05); background:rgba(15, 23, 42, 0.2);">
                        <h3 style="color:#fff; margin:0 0 1rem 0; font-size:1rem;">📂 1. Asignar Tarea Cíclica</h3>
                        <div id="ciclico_upload_area"></div>
                        <div id="admin_task_status">${statusHtml}</div>
                    </div>
                    
                    <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(16, 185, 129, 0.2); background:rgba(15, 23, 42, 0.2); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                        <h3 style="color:#10b981; margin:0 0 1rem 0; font-size:1rem;">⚡ 2. Ejecutar Cruce (ERU)</h3>
                        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem;">Cruza las lecturas en vivo de los operarios contra los archivos maestros.</p>
                        <button id="btn_sync_eru" class="btn-premium-pulse" style="width:100%; max-width:300px; padding:12px 20px; font-size:0.85rem; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);">🔄 SINCRONIZAR Y CRUZAR</button>
                    </div>
                </div>
                
                <div class="glass-panel" style="margin-top:1.5rem; padding:1.5rem; border-radius:15px; border:1px solid rgba(255,255,255,0.05); background:rgba(15, 23, 42, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="color:#fff; margin:0; font-size:1rem;">📋 Monitor de Tareas en Vivo</h3>
                        <button id="btn_refresh_live_monitor" class="btn-premium-pulse" style="padding:6px 15px; font-size:0.75rem; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px; cursor:pointer;">🔄 Actualizar Estado</button>
                    </div>
                    <div id="admin_live_monitor" style="overflow-x:auto;">
                        ${activeCount > 0 ? `
                            <table class="modern-table" style="width:100%; text-align:left; border-collapse:collapse;">
                                <thead>
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#818cf8;">
                                        <th style="padding:10px; text-align:center;">#</th>
                                        <th style="padding:10px;">Ubicación</th>
                                        <th style="padding:10px; text-align:center;">Estado</th>
                                        <th style="padding:10px; text-align:center; color:#eab308;">Qty Sistema</th>
                                        <th style="padding:10px; text-align:center; color:#38bdf8;">Qty Conteo</th>
                                        <th style="padding:10px; text-align:center;">Diferencia</th>
                                        <th style="padding:10px; text-align:center; color:#10b981;">% Exactitud</th>
                                        <th style="padding:10px; text-align:center;">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${currentTasks.map((t, i) => {
                                        const isClosed = cyclicService.isLocationClosed(t.location);
                                        const badge = isClosed 
                                            ? '<span style="background:rgba(16,185,129,0.2); color:#10b981; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">CERRADA 🔒</span>'
                                            : '<span style="background:rgba(245,158,11,0.2); color:#f59e0b; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">EN PROCESO ⏳</span>';
                                        
                                        // 1. Qty Sistema
                                        const qSis = systemStockMap.get(t.location.toUpperCase()) || 0;
                                        
                                        // 2. Qty Conteo
                                        const locationScans = cyclicService.getScansByLocation(t.location);
                                        const scansCount = locationScans.reduce((acc, curr) => acc + curr.qty, 0);
                                        
                                        // 3. Qty Diferencia
                                        const diff = scansCount - qSis;
                                        let diffBadge = '-';
                                        if (diff > 0) {
                                            diffBadge = `<span style="color:#10b981; font-weight:bold;">+${diff}</span>`;
                                        } else if (diff < 0) {
                                            diffBadge = `<span style="color:#ef4444; font-weight:bold;">${diff}</span>`;
                                        } else {
                                            diffBadge = `<span style="color:#94a3b8;">0</span>`;
                                        }
                                        
                                        // 4. % Exactitud
                                        const acc = qSis === scansCount ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, scansCount || 1))) * 100;
                                        const accFormatted = Math.max(0, acc).toFixed(1) + '%';
                                        let accColor = '#ef4444'; // Red for low
                                        if (acc >= 95) accColor = '#10b981'; // Green for high
                                        else if (acc >= 75) accColor = '#f59e0b'; // Amber for mid
                                        
                                        // 5. Usuario
                                        const lastScanner = locationScans.length > 0 ? (locationScans[locationScans.length - 1].user || 'operario') : '-';
                                        const userDisplay = isClosed 
                                            ? `<span style="color:#10b981; font-weight:bold;">👤 ${t.user || lastScanner}</span>`
                                            : (locationScans.length > 0 ? `<span style="color:#f59e0b;">👤 ${lastScanner} ✍️</span>` : '<span style="color:#64748b;">-</span>');
                                        
                                        return `
                                        <tr class="admin-loc-row" data-loc="${t.location}" data-closed="${isClosed}" style="border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;" title="Clic para entrar a Modo Escáner">
                                            <td style="padding:10px; text-align:center; color:var(--text-muted);">${i + 1}</td>
                                            <td style="padding:10px; color:#fff; font-weight:bold;">${t.location}</td>
                                            <td style="padding:10px; text-align:center;">${badge}</td>
                                            <td style="padding:10px; text-align:center; color:#eab308; font-weight:bold;">${qSis}</td>
                                            <td style="padding:10px; text-align:center; color:#38bdf8; font-weight:bold;">${scansCount}</td>
                                            <td style="padding:10px; text-align:center;">${diffBadge}</td>
                                            <td style="padding:10px; text-align:center; color:${accColor}; font-weight:bold;">${accFormatted}</td>
                                            <td style="padding:10px; text-align:center;">${userDisplay}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.75rem; font-style:italic;">No hay ubicaciones asignadas. Sube un archivo para comenzar.</div>`}
                    </div>
                </div>
                <!-- Scanner oculto para que la pistola despierte el modo escaner desde el Admin Panel -->
                <input type="text" id="zebra_scanner_input_admin" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
            `;
            
            renderUploadArea(document.getElementById('ciclico_upload_area'), 'conteo_ciclico_tarea', null, '.csv, .xlsx', 'SUBIR UBICACIONES (TAREA)');
            
            const input = document.getElementById('up_conteo_ciclico_tarea');
            if (input) {
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                        const data = await parseFile(file, 'conteo_ciclico_tarea');
                        if (data && data.length > 0) {
                            let locations = [];
                            if (Array.isArray(data[0])) {
                                const headerRow = data[0].map(h => String(h).toUpperCase().trim());
                                const ubiIndex = headerRow.findIndex(h => h === 'UBICACION' || h === 'UBICACIÓN');
                                if (ubiIndex === -1) { alert('❌ Error: No se encontró la columna "UBICACION" en la fila 1.'); return; }
                                for (let i = 1; i < data.length; i++) {
                                    if (data[i] && data[i][ubiIndex]) locations.push(String(data[i][ubiIndex]).trim());
                                }
                            } else {
                                locations = data.map(d => String(d.ubicacion || d.Ubicacion || d.UBICACION || d.UBICACIÓN || '').trim()).filter(Boolean);
                            }
                            const uniqueLocs = [...new Set(locations)];
                            if (uniqueLocs.length === 0) { alert('⚠️ No se encontraron ubicaciones válidas.'); return; }
                            const tasks = uniqueLocs.map(loc => ({ location: loc, status: 'pending' }));
                            cyclicService.saveTasks(tasks);
                            document.getElementById('admin_task_status').innerHTML = `<div style="margin-top:1rem; padding:0.8rem; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; color:#10b981; font-size:0.85rem; font-weight:bold; text-align:center;">🟢 TAREA ACTIVA EN PISO: ${tasks.length} ubicaciones pendientes</div>`;
                            alert('✅ Tarea de ' + tasks.length + ' ubicaciones asignada con éxito.');
                            renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                        }
                    } catch(err) { alert(err); }
                };
            }

            // Click listener for Admin table rows
            document.querySelectorAll('.admin-loc-row').forEach(el => {
                el.onclick = () => {
                    if(el.dataset.closed === 'true') {
                        alert('Esta ubicación ya está cerrada.');
                        return;
                    }
                    localStorage.setItem('eru_active_location', el.dataset.loc);
                    renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                };
            });

            // Auto-detect scanner input from Admin view
            const adminScannerInput = document.getElementById('zebra_scanner_input_admin');
            if(adminScannerInput) {
                adminScannerInput.focus({ preventScroll: true });
                const focusHandler = () => {
                    if (document.getElementById('zebra_scanner_input_admin')) {
                        adminScannerInput.focus({ preventScroll: true });
                    } else {
                        document.removeEventListener('click', focusHandler);
                    }
                };
                document.addEventListener('click', focusHandler);
                adminScannerInput.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter') {
                        const code = adminScannerInput.value.trim();
                        adminScannerInput.value = '';
                        const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
                        const t = currentTasks.find(x => x.location.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase() === cleanCode);
                        if(t) {
                            if(cyclicService.isLocationClosed(t.location)) {
                                alert('Ubicación Cerrada.');
                            } else {
                                localStorage.setItem('eru_active_location', t.location);
                                renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                            }
                        } else {
                            alert('Ubicación no encontrada en la tarea actual.');
                        }
                    }
                });
            }

            const refreshBtn = document.getElementById('btn_refresh_live_monitor');
            if (refreshBtn) {
                refreshBtn.onclick = () => {
                    renderModuloInventarios(container);
                };
            }

            const syncBtn = document.getElementById('btn_sync_eru');
            if (syncBtn) {
                syncBtn.onclick = async () => {
                    try {
                        // 1. Obtener datos
                        const stockActivo = await getAreaData('inventario') || [];
                        const tasks = cyclicService.getTasks();
                        const scans = cyclicService.getScans();

                        if (tasks.length === 0) {
                            alert("⚠️ No hay tareas asignadas en el Monitor en Vivo para cruzar.");
                            return;
                        }

                        if (scans.length === 0) {
                            alert("⚠️ Los operarios no han realizado lecturas físicas aún.");
                            return;
                        }

                        // 2. Obtener maestro para descripciones
                        const maestro = await getAreaData('articulos') || [];
                        const maestroMap = new Map();
                        maestro.forEach(a => {
                            const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || '').toString().trim().toUpperCase();
                            const mDesc = (getCol(a, ['Descripcion', 'Descripción', 'Description', 'Desc']) || 'S/D').toString().trim();
                            if (mSku) maestroMap.set(mSku, mDesc);
                        });

                        // 3. Crear sets y mapas
                        const taskLocations = new Set(tasks.map(t => t.location.toUpperCase()));
                        const sistemaMap = new Map();
                        const descMap = new Map();

                        stockActivo.forEach(row => {
                            const sku = (getCol(row, ['SKU', 'Articulo', 'Artículo', 'Product', 'Producto']) || (Array.isArray(row) ? row[1] : '')).toString().trim().toUpperCase();
                            const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
                            const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;
                            
                            // Escaneo inteligente de descripción
                            let desc = 'S/D';
                            if (typeof row === 'object' && !Array.isArray(row)) {
                                desc = getCol(row, ['Descripcion', 'Descripción', 'Description', 'DESCRIPCION', 'Articulo', 'Nombre']) || 'S/D';
                            } else if (Array.isArray(row)) {
                                desc = row[2] || row[4] || row[6] || row[7] || 'S/D';
                            }
                            desc = desc.toString().trim();

                            if (sku && taskLocations.has(ubi)) {
                                const key = `${sku}|${ubi}`;
                                sistemaMap.set(key, (sistemaMap.get(key) || 0) + qty);
                                if (desc && desc !== 'S/D') descMap.set(sku, desc);
                            }
                        });

                        const fisicoMap = new Map();
                        scans.forEach(s => {
                            let sku = s.sku.toString().trim().toUpperCase();
                            
                            // Traducir código de barras a SKU real si existe en el maestro (para lecturas históricas)
                            if (barcodeToSkuMap && barcodeToSkuMap.has(sku)) {
                                sku = barcodeToSkuMap.get(sku);
                            }

                            const ubi = s.location.toString().trim().toUpperCase();
                            const qty = parseFloat(s.qty) || 0;

                            if (sku && taskLocations.has(ubi)) {
                                const key = `${sku}|${ubi}`;
                                fisicoMap.set(key, (fisicoMap.get(key) || 0) + qty);
                            }
                        });

                        // 4. Cruzar keys
                        const allKeys = new Set([...sistemaMap.keys(), ...fisicoMap.keys()]);
                        const eruResults = [];
                        let totalItems = 0;
                        let correctItems = 0;

                        allKeys.forEach(key => {
                            const [sku, ubi] = key.split('|');
                            const qSis = sistemaMap.get(key) || 0;
                            const qFis = fisicoMap.get(key) || 0;
                            const diff = qFis - qSis;

                            // Exactitud de Registro de Ubicación (ERU) por línea
                            const acc = qSis === qFis ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, qFis || 1))) * 100;

                            totalItems++;
                            if (diff === 0) correctItems++;

                            const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';

                            eruResults.push({
                                sku,
                                ubi,
                                desc: finalDesc,
                                sis: qSis,
                                fis: qFis,
                                diff,
                                eri: Math.max(0, acc).toFixed(1)
                            });
                        });

                        // Ordenar eruResults por ubicación
                        eruResults.sort((a, b) => a.ubi.localeCompare(b.ubi));

                        // 5. Cruzar por SKU (ERI)
                        const countedSkus = new Set(eruResults.map(r => r.sku));
                        const eriBySku = new Map();
                        countedSkus.forEach(sku => eriBySku.set(sku, { sis: 0, fis: 0 }));

                        eruResults.forEach(r => {
                            const entry = eriBySku.get(r.sku);
                            entry.sis += r.sis;
                            entry.fis += r.fis;
                        });

                        const eriResults = [];
                        let eriCorrect = 0;

                        eriBySku.forEach((vals, sku) => {
                            const diff = vals.fis - vals.sis;
                            if (diff === 0) eriCorrect++;
                            const acc = vals.sis === vals.fis ? 100 : (1 - (Math.abs(diff) / Math.max(vals.sis, vals.fis || 1))) * 100;

                            // Buscar ubicaciones de este SKU
                            const ubis = eruResults.filter(r => r.sku === sku).map(r => r.ubi);
                            const ubiText = ubis.length > 1 ? "VARIAS" : (ubis[0] || 'N/A');
                            const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';

                            eriResults.push({
                                sku,
                                ubi: ubiText,
                                desc: finalDesc,
                                sis: vals.sis,
                                fis: vals.fis,
                                diff,
                                eri: Math.max(0, acc).toFixed(1)
                            });
                        });

                        // Calcular consolidados globales
                        const finalERU = eruResults.length > 0 ? (eruResults.reduce((acc, r) => acc + parseFloat(r.eri || 0), 0) / eruResults.length).toFixed(1) : 0;
                        const finalERI = eriResults.length > 0 ? ((eriCorrect / eriResults.length) * 100).toFixed(1) : 0;

                        // 6. Guardar en global
                        window._lastERI = { eriResults, finalERI, eruResults, finalERU };

                        // 7. Cambiar de pestaña y re-renderizar
                        activeModuloInvSub = 'reportes';
                        renderModuloInventarios(container);

                        alert(`✅ ¡Cruce ERU / ERI realizado con éxito!\nERU: ${finalERU}%\nERI: ${finalERI}%`);

                    } catch(err) {
                        console.error("Error en cruce cíclico ERU:", err);
                        alert("❌ Error al procesar el cruce cíclico: " + err);
                    }
                };
            }
        } else {
            // VISTA OPERARIO
            const activeLocation = localStorage.getItem('eru_active_location');
            const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+'A'.repeat(100)); // Short placeholder beep. In real env, we can synthesize one using Web Audio API

            if (!activeLocation) {
                // LISTA DE UBICACIONES
                content.innerHTML = `
                    <div style="padding:0.5rem;">
                        <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:1rem; border-radius:10px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h2 style="color:#10b981; margin:0; font-size:1.1rem;">🟢 MODO PISTOLEO ACTIVO</h2>
                                <p style="margin:0; font-size:0.75rem; color:var(--text-muted);">Pistolea el código de una ubicación de la lista para empezar.</p>
                            </div>
                            <span style="font-size:2rem;">🔫</span>
                        </div>
                        
                        <h3 style="color:#fff; font-size:1rem; margin-bottom:1rem;">Ubicaciones Pendientes</h3>
                        <div id="operario_tasks_container" style="display:flex; flex-direction:column; gap:0.8rem;"></div>
                        
                        <input type="text" id="zebra_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
                    </div>
                `;
                
                const tasks = cyclicService.getTasks();
                const container = document.getElementById('operario_tasks_container');
                if (tasks.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem; font-style:italic;">No hay ubicaciones asignadas por el Administrador.</div>';
                } else {
                    tasks.forEach(t => {
                        const isClosed = cyclicService.isLocationClosed(t.location);
                        const color = isClosed ? '#10b981' : 'var(--text-muted)';
                        const bg = isClosed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)';
                        const statusText = isClosed ? 'CERRADA 🔒' : 'PENDIENTE';
                        container.innerHTML += `
                            <div class="loc-item" data-loc="${t.location}" data-closed="${isClosed}" style="padding:1rem; background:${bg}; border-radius:8px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                <span style="color:#fff; font-weight:bold; font-size:1.1rem;">${t.location}</span>
                                <span style="color:${color}; font-size:0.75rem; font-weight:800; letter-spacing:1px;">${statusText}</span>
                            </div>
                        `;
                    });
                }

                document.querySelectorAll('.loc-item').forEach(el => {
                    el.onclick = () => {
                        if(el.dataset.closed === 'true') {
                            alert('Esta ubicación ya fue contada y está cerrada. Solicite desbloqueo a Administración.');
                            return;
                        }
                        localStorage.setItem('eru_active_location', el.dataset.loc);
                        renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                    };
                });

                const scannerInput = document.getElementById('zebra_scanner_input');
                if(scannerInput) {
                    scannerInput.focus({ preventScroll: true });
                    const focusHandler = () => {
                        if (document.getElementById('zebra_scanner_input')) {
                            scannerInput.focus({ preventScroll: true });
                        } else {
                            document.removeEventListener('click', focusHandler);
                        }
                    };
                    document.addEventListener('click', focusHandler);
                    scannerInput.addEventListener('keydown', (e) => {
                        if(e.key === 'Enter') {
                            const code = scannerInput.value.trim();
                            scannerInput.value = '';
                            const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
                            const t = tasks.find(x => x.location.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase() === cleanCode);
                            if(t) {
                                if(cyclicService.isLocationClosed(t.location)) {
                                    alert('Ubicación Cerrada.');
                                } else {
                                    localStorage.setItem('eru_active_location', t.location);
                                    renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                                }
                            } else {
                                alert('Ubicación no encontrada en la tarea actual.');
                            }
                        }
                    });
                }
            } else {
                // MODO ESCANEO (Ubicación Abierta)
                const scans = cyclicService.getScansByLocation(activeLocation);
                const totalScans = scans.reduce((acc, curr) => acc + curr.qty, 0);

                content.innerHTML = `
                    <div style="padding:0.5rem; text-align:center;">
                        <button id="btn_back_locs" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.8rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">< Volver a lista</button>
                        
                        <div style="background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.3); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem;">
                            <h2 style="color:#38bdf8; margin:0 0 0.5rem 0; font-size:1.8rem; font-weight:900;">${activeLocation}</h2>
                            <p style="margin:0; font-size:0.8rem; color:#fff;">Pistolee los SKUs físicos ahora</p>
                            <h1 style="color:#fff; font-size:3rem; margin:1rem 0 0 0;" id="scan_counter">${totalScans}</h1>
                            <p style="margin:0; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Artículos leídos</p>
                        </div>
                        
                        <div style="display:flex; flex-direction:column; gap:1rem;">
                            <button id="btn_close_loc" class="btn-premium-pulse" style="padding:15px; font-size:1rem; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none; border-radius:8px; font-weight:800; cursor:pointer;">🔒 CERRAR UBICACIÓN</button>
                        </div>
                        <input type="text" id="sku_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
                    </div>
                `;

                document.getElementById('btn_back_locs').onclick = () => {
                    localStorage.removeItem('eru_active_location');
                    renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                };

                document.getElementById('btn_close_loc').onclick = async () => {
                    if(await showPremiumConfirm('CERRAR UBICACIÓN', '¿Seguro que deseas cerrar esta ubicación? Ya no podrás pistolear más SKUs aquí.', 'warning')) {
                        cyclicService.closeLocation(activeLocation);
                        localStorage.removeItem('eru_active_location');
                        renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                    }
                };

                // Play beep using Web Audio API for guaranteed cross-browser sound without external files
                const playBeep = () => {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    osc.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.1);
                };

                const skuInput = document.getElementById('sku_scanner_input');
                if(skuInput) {
                    skuInput.focus({ preventScroll: true });
                    const focusHandler = () => {
                        if (document.getElementById('sku_scanner_input')) {
                            skuInput.focus({ preventScroll: true });
                        } else {
                            document.removeEventListener('click', focusHandler);
                        }
                    };
                    document.addEventListener('click', focusHandler);
                    skuInput.addEventListener('keydown', (e) => {
                        if(e.key === 'Enter') {
                            const code = skuInput.value.trim();
                            skuInput.value = '';
                            if(code) {
                                playBeep();
                                
                                // Traducir código de barras a SKU real si existe en el maestro
                                let translatedCode = code;
                                if (barcodeToSkuMap && barcodeToSkuMap.has(code.toUpperCase())) {
                                    translatedCode = barcodeToSkuMap.get(code.toUpperCase());
                                    console.log(`[ESCANER] Traduciendo código de barras ${code} a SKU ${translatedCode}`);
                                }
                                
                                cyclicService.saveScan(activeLocation, translatedCode);
                                // Update counter immediately
                                const currentCount = parseInt(document.getElementById('scan_counter').innerText) || 0;
                                document.getElementById('scan_counter').innerText = currentCount + 1;
                            }
                        }
                    });
                }
            }
        }
    }
    else if (activeModuloInvSub === 'reportes') {
        // Lógica de auto-cruce en background si no se ha hecho aún pero hay tareas
        const runAutoCruceBackground = async () => {
            if (window._lastERI) return;
            const stockActivo = await getAreaData('inventario') || [];
            const tasks = cyclicService.getTasks();
            const scans = cyclicService.getScans();
            if (tasks.length === 0 || scans.length === 0) return;
            
            console.log("[PULSE] Auto-cruzando datos en background para Reporte Gerencial...");
            
            const maestro = await getAreaData('articulos') || [];
            const maestroMap = new Map();
            maestro.forEach(a => {
                const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || '').toString().trim().toUpperCase();
                const mDesc = (getCol(a, ['Descripcion', 'Descripción', 'Description', 'Desc']) || 'S/D').toString().trim();
                if (mSku) maestroMap.set(mSku, mDesc);
            });
            
            const taskLocations = new Set(tasks.map(t => t.location.toUpperCase()));
            const sistemaMap = new Map();
            const descMap = new Map();
            
            stockActivo.forEach(row => {
                const sku = (getCol(row, ['SKU', 'Articulo', 'Artículo', 'Product', 'Producto']) || (Array.isArray(row) ? row[1] : '')).toString().trim().toUpperCase();
                const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
                const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;
                
                let desc = 'S/D';
                if (typeof row === 'object' && !Array.isArray(row)) {
                    desc = getCol(row, ['Descripcion', 'Descripción', 'Description', 'DESCRIPCION', 'Articulo', 'Nombre']) || 'S/D';
                } else if (Array.isArray(row)) {
                    desc = row[2] || row[4] || row[6] || row[7] || 'S/D';
                }
                desc = desc.toString().trim();
                
                if (sku && taskLocations.has(ubi)) {
                    const key = `${sku}|${ubi}`;
                    sistemaMap.set(key, (sistemaMap.get(key) || 0) + qty);
                    if (desc && desc !== 'S/D') descMap.set(sku, desc);
                }
            });
            
            const fisicoMap = new Map();
            scans.forEach(s => {
                let sku = s.sku.toString().trim().toUpperCase();
                if (barcodeToSkuMap && barcodeToSkuMap.has(sku)) {
                    sku = barcodeToSkuMap.get(sku);
                }
                const ubi = s.location.toString().trim().toUpperCase();
                const qty = parseFloat(s.qty) || 0;
                
                if (sku && taskLocations.has(ubi)) {
                    const key = `${sku}|${ubi}`;
                    fisicoMap.set(key, (fisicoMap.get(key) || 0) + qty);
                }
            });
            
            const allKeys = new Set([...sistemaMap.keys(), ...fisicoMap.keys()]);
            const eruResults = [];
            let totalItems = 0;
            let correctItems = 0;
            
            allKeys.forEach(key => {
                const [sku, ubi] = key.split('|');
                const qSis = sistemaMap.get(key) || 0;
                const qFis = fisicoMap.get(key) || 0;
                const diff = qFis - qSis;
                const acc = qSis === qFis ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, qFis || 1))) * 100;
                
                totalItems++;
                if (diff === 0) correctItems++;
                
                const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';
                eruResults.push({
                    sku, ubi, desc: finalDesc, sis: qSis, fis: qFis, diff, eri: Math.max(0, acc).toFixed(1)
                });
            });
            
            eruResults.sort((a, b) => a.ubi.localeCompare(b.ubi));
            
            const countedSkus = new Set(eruResults.map(r => r.sku));
            const eriBySku = new Map();
            countedSkus.forEach(sku => eriBySku.set(sku, { sis: 0, fis: 0 }));
            eruResults.forEach(r => {
                const entry = eriBySku.get(r.sku);
                entry.sis += r.sis;
                entry.fis += r.fis;
            });
            
            const eriResults = [];
            let eriCorrect = 0;
            eriBySku.forEach((vals, sku) => {
                const diff = vals.fis - vals.sis;
                if (diff === 0) eriCorrect++;
                const acc = vals.sis === vals.fis ? 100 : (1 - (Math.abs(diff) / Math.max(vals.sis, vals.fis || 1))) * 100;
                
                const ubis = eruResults.filter(r => r.sku === sku).map(r => r.ubi);
                const ubiText = ubis.length > 1 ? "VARIAS" : (ubis[0] || 'N/A');
                const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';
                
                eriResults.push({
                    sku, ubi: ubiText, desc: finalDesc, sis: vals.sis, fis: vals.fis, diff, eri: Math.max(0, acc).toFixed(1)
                });
            });
            
            const finalERU = eruResults.length > 0 ? (eruResults.reduce((acc, r) => acc + parseFloat(r.eri || 0), 0) / eruResults.length).toFixed(1) : 0;
            const finalERI = eriResults.length > 0 ? ((eriCorrect / eriResults.length) * 100).toFixed(1) : 0;
            
            window._lastERI = { eriResults, finalERI, eruResults, finalERU };
            
            // Re-render
            renderModuloInventarios(container);
        };
        
        // Ejecutar en background si es necesario
        if (!window._lastERI) {
            runAutoCruceBackground();
        }

        // Recuperar y procesar datos gerenciales
        const scans = cyclicService.getScans() || [];
        const tasks = cyclicService.getTasks() || [];
        const closedLocations = cyclicService.getClosedLocations() || [];
        
        // Calcular KPIs gerenciales rápidos
        const totalClosed = closedLocations.length;
        const totalAssigned = tasks.length;
        const uniqueSkusCount = new Set(scans.map(s => s.sku.toUpperCase())).size;
        const totalFisQty = scans.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);
        
        let totalSisQty = 0;
        let avgERU = 0;
        if (window._lastERI && window._lastERI.eruResults) {
            totalSisQty = window._lastERI.eruResults.reduce((acc, curr) => acc + parseFloat(curr.sis || 0), 0);
            avgERU = window._lastERI.finalERU;
        }

        // Lógica de pestañas gerenciales
        window._activeGerTab = window._activeGerTab || 'cronologico';

        // Pre-calcular desglose por Semana y Día
        const getWeekNumber = (d) => {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        };

        const dateGroups = {};
        scans.forEach(s => {
            const timestamp = s.last_scan || Date.now();
            const d = new Date(timestamp);
            const dateStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            if (!dateGroups[dateStr]) {
                dateGroups[dateStr] = {
                    date: d,
                    locations: new Set(),
                    skus: new Set(),
                    qtyFis: 0,
                    qtySis: 0,
                    diff: 0,
                    eruSum: 0,
                    eruCount: 0
                };
            }
            dateGroups[dateStr].locations.add(s.location.toUpperCase());
            dateGroups[dateStr].skus.add(s.sku.toUpperCase());
            dateGroups[dateStr].qtyFis += parseFloat(s.qty) || 0;
        });

        if (window._lastERI && window._lastERI.eruResults) {
            Object.keys(dateGroups).forEach(dateStr => {
                const group = dateGroups[dateStr];
                const locsOnDate = group.locations;
                const matchingResults = window._lastERI.eruResults.filter(r => locsOnDate.has(r.ubi.toUpperCase()));
                
                let sisSum = 0;
                let eruSum = 0;
                matchingResults.forEach(r => {
                    sisSum += parseFloat(r.sis) || 0;
                    eruSum += parseFloat(r.eri) || 0;
                });
                
                group.qtySis = sisSum;
                group.diff = group.qtyFis - group.qtySis;
                group.accuracy = matchingResults.length > 0 ? (eruSum / matchingResults.length) : 100;
            });
        }

        const weekGroups = {};
        Object.keys(dateGroups).forEach(dateStr => {
            const group = dateGroups[dateStr];
            const d = group.date;
            const weekNo = getWeekNumber(d);
            const year = d.getFullYear();
            const weekKey = `Semana ${weekNo} (${year})`;
            
            if (!weekGroups[weekKey]) {
                weekGroups[weekKey] = {
                    weekName: weekKey,
                    days: []
                };
            }
            
            weekGroups[weekKey].days.push({
                dateStr,
                dayName: d.toLocaleDateString('es-PE', { weekday: 'long' }),
                locsCount: group.locations.size,
                skusCount: group.skus.size,
                qtyFis: group.qtyFis,
                qtySis: group.qtySis,
                diff: group.diff,
                accuracy: group.accuracy || 100
            });
        });

        const sortedWeeks = Object.values(weekGroups).sort((a, b) => b.weekName.localeCompare(a.weekName));
        sortedWeeks.forEach(w => {
            w.days.sort((a, b) => {
                const dateA = new Date(a.dateStr.split('/').reverse().join('-'));
                const dateB = new Date(b.dateStr.split('/').reverse().join('-'));
                return dateB - dateA;
            });
        });

        let htmlWeeks = '';
        if (sortedWeeks.length === 0) {
            htmlWeeks = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay lecturas registradas para agrupar cronológicamente.</td></tr>`;
        } else {
            sortedWeeks.forEach(w => {
                htmlWeeks += `
                    <tr style="background:rgba(255,255,255,0.02); font-weight:800; color:#38bdf8;">
                        <td colspan="7" style="padding:10px 15px; font-size:0.85rem; border-left:4px solid #38bdf8;">
                            📅 ${w.weekName.toUpperCase()}
                        </td>
                    </tr>
                `;
                w.days.forEach(d => {
                    const dayCapitalized = d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1);
                    const accColor = d.accuracy >= 90 ? '#10b981' : (d.accuracy >= 80 ? '#f59e0b' : '#ef4444');
                    htmlWeeks += `
                        <tr>
                            <td style="padding:10px 15px; font-weight:600; padding-left:25px;">${dayCapitalized} <span style="font-size:0.7rem; color:var(--text-muted); margin-left:8px;">(${d.dateStr})</span></td>
                            <td style="text-align:center; font-weight:700;">${d.locsCount}</td>
                            <td style="text-align:center;">${d.skusCount}</td>
                            <td style="text-align:center; font-weight:700; color:#fff;">${d.qtyFis} u.</td>
                            <td style="text-align:center; opacity:0.8;">${d.qtySis} u.</td>
                            <td style="text-align:center; color:${d.diff===0?'#10b981':(d.diff>0?'#38bdf8':'#ef4444')}; font-weight:900;">
                                ${d.diff > 0 ? '+' : ''}${d.diff}
                            </td>
                            <td style="text-align:center;">
                                <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                    ${parseFloat(d.accuracy).toFixed(1)}%
                                </span>
                            </td>
                        </tr>
                    `;
                });
            });
        }

        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:2rem;">
                
                <!-- TABLERO GERENCIAL (MANDO Y CONTROL) -->
                <div class="glass-panel" style="padding:2rem; border-radius:15px; border:1px solid rgba(56, 189, 248, 0.2); background:radial-gradient(circle at top right, rgba(56,189,248,0.03), transparent);">
                    <h3 style="color:#fff; margin:0 0 1.5rem 0; font-size:1.2rem; font-weight:900; letter-spacing:1px; display:flex; align-items:center; gap:10px;">
                        📈 TABLERO Y REPORTE GERENCIAL (MANDO Y CONTROL)
                    </h3>
                    
                    <!-- KPI CARDS -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1.2rem; margin-bottom:2rem;">
                        <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid #38bdf8; background:rgba(255,255,255,0.01);">
                            <h4 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Ubicaciones Contadas</h4>
                            <h2 style="margin:0.5rem 0; font-size:1.8rem; color:#fff; font-weight:800;">${totalClosed} / ${totalAssigned}</h2>
                            <span style="font-size:0.65rem; background:rgba(56, 189, 248, 0.1); color:#38bdf8; padding:2px 8px; border-radius:10px; font-weight:700;">
                                ${totalAssigned > 0 ? ((totalClosed/totalAssigned)*100).toFixed(0) : 0}% COMPLETADO
                            </span>
                        </div>
                        <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid #a855f7; background:rgba(255,255,255,0.01);">
                            <h4 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">SKUs Únicos</h4>
                            <h2 style="margin:0.5rem 0; font-size:1.8rem; color:#fff; font-weight:800;">${uniqueSkusCount}</h2>
                            <span style="font-size:0.65rem; color:var(--text-muted);">Sobrantes o asignados</span>
                        </div>
                        <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid #10b981; background:rgba(255,255,255,0.01);">
                            <h4 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Qty Total Conteo</h4>
                            <h2 style="margin:0.5rem 0; font-size:1.8rem; color:#10b981; font-weight:800;">${totalFisQty} u.</h2>
                            <span style="font-size:0.65rem; color:var(--text-muted);">Unidades físicas</span>
                        </div>
                        <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid #f59e0b; background:rgba(255,255,255,0.01);">
                            <h4 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Qty Total Sistema</h4>
                            <h2 style="margin:0.5rem 0; font-size:1.8rem; color:#fff; font-weight:800;">${totalSisQty} u.</h2>
                            <span style="font-size:0.65rem; color:${totalFisQty - totalSisQty === 0 ? '#10b981' : '#ef4444'}; font-weight:800;">
                                DIF: ${totalFisQty - totalSisQty > 0 ? '+' : ''}${totalFisQty - totalSisQty} u.
                            </span>
                        </div>
                        <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid ${avgERU >= 90 ? '#10b981' : (avgERU >= 80 ? '#f59e0b' : '#ef4444')}; background:rgba(255,255,255,0.01);">
                            <h4 style="margin:0; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Exactitud ERU</h4>
                            <h2 style="margin:0.5rem 0; font-size:1.8rem; color:${avgERU >= 90 ? '#10b981' : (avgERU >= 80 ? '#f59e0b' : '#ef4444')}; font-weight:800;">${avgERU}%</h2>
                            <span style="font-size:0.65rem; background:${avgERU >= 90 ? '#10b981' : (avgERU >= 80 ? '#f59e0b' : '#ef4444')}22; color:${avgERU >= 90 ? '#10b981' : (avgERU >= 80 ? '#f59e0b' : '#ef4444')}; padding:2px 8px; border-radius:10px; font-weight:700;">
                                ${avgERU >= 90 ? 'EXCELENTE' : (avgERU >= 80 ? 'REGULAR' : 'CRÍTICO')}
                            </span>
                        </div>
                    </div>

                    <!-- INNER NAVIGATION TABS -->
                    <div style="display:flex; gap:1rem; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:1.5rem;">
                        <button class="ger-tab-btn ${window._activeGerTab === 'cronologico' ? 'active' : ''}" data-tab="cronologico" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'cronologico' ? '#38bdf8' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'cronologico' ? '#38bdf8' : 'transparent'}; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">
                            📅 RESUMEN POR SEMANA Y DÍA
                        </button>
                        <button class="ger-tab-btn ${window._activeGerTab === 'ubicacion' ? 'active' : ''}" data-tab="ubicacion" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'ubicacion' ? '#38bdf8' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'ubicacion' ? '#38bdf8' : 'transparent'}; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">
                            📍 ACUMULADO POR UBICACIÓN
                        </button>
                        <button class="ger-tab-btn ${window._activeGerTab === 'sku' ? 'active' : ''}" data-tab="sku" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'sku' ? '#38bdf8' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'sku' ? '#38bdf8' : 'transparent'}; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">
                            🏷️ ACUMULADO POR SKU
                        </button>
                    </div>

                    <!-- TAB CONTENT AREA -->
                    <div id="ger_tab_content"></div>
                </div>

                <!-- SECTION 1: REPORTE UCA (BOTTOM - FULL WIDTH) -->
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

        // Renderizar pestaña gerencial activa
        const gerContent = document.getElementById('ger_tab_content');
        if (window._activeGerTab === 'cronologico') {
            gerContent.innerHTML = `
                <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(255,255,255,0.05); overflow-x:auto;">
                    <table class="data-table" style="font-size:0.75rem;">
                        <thead>
                            <tr>
                                <th style="padding:12px 15px;">DÍA / SEMANA</th>
                                <th style="text-align:center;">UBICACIONES CONTADAS</th>
                                <th style="text-align:center;">SKUs ÚNICOS</th>
                                <th style="text-align:center;">FISICO (QTY)</th>
                                <th style="text-align:center;">SISTEMA (QTY)</th>
                                <th style="text-align:center;">DIFERENCIA</th>
                                <th style="text-align:center;">EXACTITUD ERU</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlWeeks}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (window._activeGerTab === 'ubicacion') {
            const cleanERU = (window._lastERI && window._lastERI.eruResults) ? window._lastERI.eruResults.filter(r => r.ubi && !r.ubi.toString().toUpperCase().includes('UBICAC')) : [];
            let htmlRows = '';
            if (cleanERU.length === 0) {
                htmlRows = `<tr><td colspan="7" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay datos de ubicación acumulados. Realiza el cruce para cargar.</td></tr>`;
            } else {
                htmlRows = cleanERU.map(r => {
                    const accColor = r.eri >= 90 ? '#10b981' : (r.eri >= 80 ? '#f59e0b' : '#ef4444');
                    // Buscar el usuario del conteo
                    const t = tasks.find(x => x.location.toUpperCase() === r.ubi.toUpperCase());
                    const operarioName = t ? (t.user || 'S/D') : 'S/D';
                    return `
                        <tr>
                            <td style="font-weight:700; color:#10b981; padding:10px 15px;">📍 ${r.ubi}</td>
                            <td>${r.sku}</td>
                            <td style="text-align:center;">${r.sis}</td>
                            <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                            <td style="text-align:center; color:${r.diff===0?'#10b981':(r.diff>0?'#38bdf8':'#ef4444')}; font-weight:900;">
                                ${r.diff > 0 ? '+' : ''}${r.diff}
                            </td>
                            <td style="text-align:center;">
                                <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                    ${parseFloat(r.eri).toFixed(1)}%
                                </span>
                            </td>
                            <td style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${operarioName.toUpperCase()}</td>
                        </tr>
                    `;
                }).join('');
            }
            gerContent.innerHTML = `
                <div style="margin-bottom:1rem; display:flex; justify-content:flex-end;">
                    <input type="text" id="search_ger_loc" placeholder="🔍 Buscar ubicación..." style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 12px; border-radius:6px; font-size:0.75rem; width:200px;">
                </div>
                <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(255,255,255,0.05); max-height:400px; overflow-y:auto;">
                    <table class="data-table" style="font-size:0.75rem;" id="table_ger_loc">
                        <thead style="position:sticky; top:0; z-index:10; background:#1a1d21;">
                            <tr>
                                <th style="padding:12px 15px;">UBICACIÓN</th>
                                <th>SKU</th>
                                <th style="text-align:center;">SISTEMA</th>
                                <th style="text-align:center;">FÍSICO</th>
                                <th style="text-align:center;">DIF</th>
                                <th style="text-align:center;">EXACTITUD ERU</th>
                                <th>OPERARIO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlRows}
                        </tbody>
                    </table>
                </div>
            `;
            const searchInput = document.getElementById('search_ger_loc');
            if (searchInput) {
                searchInput.oninput = () => {
                    const term = searchInput.value.toUpperCase();
                    const rows = document.querySelectorAll('#table_ger_loc tbody tr');
                    rows.forEach(row => {
                        const txt = row.innerText.toUpperCase();
                        row.style.display = txt.includes(term) ? '' : 'none';
                    });
                };
            }
        } else if (window._activeGerTab === 'sku') {
            const cleanERI = (window._lastERI && window._lastERI.eriResults) ? window._lastERI.eriResults.filter(r => r.sku && !r.sku.toString().toUpperCase().includes('SKU')) : [];
            let htmlRows = '';
            if (cleanERI.length === 0) {
                htmlRows = `<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay datos de SKU acumulados. Realiza el cruce para cargar.</td></tr>`;
            } else {
                htmlRows = cleanERI.map(r => {
                    const accColor = r.eri >= 90 ? '#10b981' : (r.eri >= 80 ? '#f59e0b' : '#ef4444');
                    return `
                        <tr>
                            <td style="font-weight:700; color:#818cf8; padding:10px 15px;">🏷️ ${r.sku}</td>
                            <td style="font-size:0.7rem; color:var(--text-muted);">${r.ubi}</td>
                            <td style="text-align:center;">${r.sis}</td>
                            <td style="text-align:center; font-weight:700; color:#fff;">${r.fis}</td>
                            <td style="text-align:center; color:${r.diff===0?'#10b981':(r.diff>0?'#38bdf8':'#ef4444')}; font-weight:900;">
                                ${r.diff > 0 ? '+' : ''}${r.diff}
                            </td>
                            <td style="text-align:center;">
                                <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                    ${parseFloat(r.eri).toFixed(1)}%
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
            gerContent.innerHTML = `
                <div style="margin-bottom:1rem; display:flex; justify-content:flex-end;">
                    <input type="text" id="search_ger_sku" placeholder="🔍 Buscar SKU..." style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:6px 12px; border-radius:6px; font-size:0.75rem; width:200px;">
                </div>
                <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(255,255,255,0.05); max-height:400px; overflow-y:auto;">
                    <table class="data-table" style="font-size:0.75rem;" id="table_ger_sku">
                        <thead style="position:sticky; top:0; z-index:10; background:#1a1d21;">
                            <tr>
                                <th style="padding:12px 15px;">SKU</th>
                                <th>UBICACIÓN</th>
                                <th style="text-align:center;">SISTEMA</th>
                                <th style="text-align:center;">FÍSICO</th>
                                <th style="text-align:center;">DIF</th>
                                <th style="text-align:center;">EXACTITUD ERI</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${htmlRows}
                        </tbody>
                    </table>
                </div>
            `;
            const searchInput = document.getElementById('search_ger_sku');
            if (searchInput) {
                searchInput.oninput = () => {
                    const term = searchInput.value.toUpperCase();
                    const rows = document.querySelectorAll('#table_ger_sku tbody tr');
                    rows.forEach(row => {
                        const txt = row.innerText.toUpperCase();
                        row.style.display = txt.includes(term) ? '' : 'none';
                    });
                };
            }
        }

        // Vincular clics de botones gerenciales
        document.querySelectorAll('.ger-tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                window._activeGerTab = e.currentTarget.dataset.tab;
                renderModuloInventarios(container);
            };
        });

        // Lógica UCA original
        document.getElementById('btn_run_uca').onclick = () => {
            if (matriz && reserva) {
                const res = processReporteUCA(matriz, reserva);
                displayReporteUCA(res);
            } else {
                alert("⚠️ Datos insuficientes en 'ARCHIVO INVENTARIO' para UCA.");
            }
        };

        // Lógica ERI/ERU original
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
                    inputUnif.value = '';
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
            
            updateERIUI_Unified();
        };

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

  const runProcessingAnimation = (container) => {
      // 1. Validaciones de archivos
      if (!dataStore.recepcion_activo || dataStore.recepcion_activo.length === 0 || !dataStore.articulos || dataStore.articulos.length === 0) {
          showPremiumAlert(
              'Faltan Cargar Archivos',
              'No se puede procesar el reporte porque falta cargar los archivos requeridos en la pestaña <strong>ARCHIVO RECEPCIÓN</strong>.<br><br>Por favor, asegúrate de subir: <br>• <strong>Stock Activo</strong> (CSV)<br>• <strong>Maestro Artículos</strong> (XLSX)',
              'error'
          );
          return;
      }

      container.innerHTML = `
        <div class="glass-panel" style="padding: 4rem 3rem; text-align: center; border-radius: 16px; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); max-width: 900px; margin: 4rem auto; animation: fadeIn 0.3s ease;">
            <div style="max-width: 700px; margin: 0 auto; text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; align-items: flex-end;">
                    <span id="recepcionProgressText" style="font-size: 1rem; color: #a1a1aa; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Iniciando análisis...</span>
                    <span id="recepcionProgressPct" style="font-size: 1.5rem; color: #22d3ee; font-weight: 900; font-family: monospace;">0%</span>
                </div>
                <div class="progress-bar-container" style="background: rgba(255,255,255,0.03); border-radius: 999px; height: 24px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
                    <div id="recepcionProgressBar" style="background: linear-gradient(90deg, #4f46e5 0%, #22d3ee 50%, #10b981 100%); height: 100%; width: 0%; transition: width 0.1s linear; box-shadow: 0 0 25px rgba(34,211,238,0.6); border-radius: 999px;"></div>
                </div>
            </div>
        </div>
      `;

      const progressBar = document.getElementById('recepcionProgressBar');
      const progressText = document.getElementById('recepcionProgressText');
      const progressPct = document.getElementById('recepcionProgressPct');

      let pct = 0;
      const steps = [
          { threshold: 10, text: 'Leyendo Stock Activo de Recepción...' },
          { threshold: 40, text: 'Filtrando ubicaciones CDBUFFER-A y CDBUFFER-D...' },
          { threshold: 70, text: 'Cruzando con Maestro de Artículos...' },
          { threshold: 90, text: 'Tabulando marcas y departamentos...' },
          { threshold: 100, text: '¡Procesamiento completado con éxito!' }
      ];

      const interval = setInterval(() => {
          pct += 5;
          if (pct > 100) pct = 100;

          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressPct) progressPct.textContent = `${pct}%`;

          const currentStep = steps.find(s => pct <= s.threshold);
          if (currentStep && progressText) {
              progressText.textContent = currentStep.text;
          }

          if (pct === 100) {
              clearInterval(interval);
              setTimeout(() => {
                  try {
                      localStorage.setItem('recepcion_report_processed', 'true');
                      renderRecepcionReportTab(container);
                  } catch (err) {
                      console.error(err);
                      showPremiumAlert('Error de Análisis', 'Ocurrió un error inesperado al procesar la matriz del reporte: ' + err.message, 'error');
                  }
              }, 500);
          }
      }, 100);
  };

  const renderRecepcionReportTab = (container) => {
    const hasDataFiles = dataStore.recepcion_activo && dataStore.recepcion_activo.length > 0 && dataStore.articulos && dataStore.articulos.length > 0;

    if (!hasDataFiles) {
        container.innerHTML = `
          <div class="glass-panel" style="padding: 3rem; text-align: center; border-radius: 16px; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); max-width: 800px; margin: 2rem auto; animation: fadeIn 0.3s ease;">
              <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">⚠️</div>
              <h3 style="margin-bottom: 1rem; color: #ff6b6b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                  FALTAN ARCHIVOS DE RECEPCIÓN
              </h3>
              <p style="color: var(--text-muted); margin-bottom: 1rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6; font-size: 0.95rem;">
                  No se puede generar el reporte porque aún no has cargado los archivos requeridos en la pestaña <strong>ARCHIVO RECEPCIÓN</strong>.
                  <br><br>Por favor, asegúrate de subir:
                  <br>• <strong>Stock Activo</strong> (CSV)
                  <br>• <strong>Maestro Artículos</strong> (XLSX)
              </p>
          </div>
        `;
        return;
    }

    const isProcessed = localStorage.getItem('recepcion_report_processed') === 'true';
    if (!isProcessed) {
        container.innerHTML = `
          <div class="glass-panel" style="padding: 4rem 3rem; text-align: center; border-radius: 16px; background: rgba(10, 15, 30, 0.7); border: 2px solid #22d3ee; box-shadow: 0 0 25px rgba(34, 211, 238, 0.15); max-width: 800px; margin: 4rem auto; animation: fadeIn 0.3s ease;">
              <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">📊</div>
              <h3 style="margin-bottom: 1rem; color: #22d3ee; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                  REPORTE DE RECEPCIÓN - CDBUFFER
              </h3>
              <p style="color: var(--text-muted); margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6; font-size: 0.95rem;">
                  Los archivos de stock y maestro se han cargado correctamente. Haz clic en el botón de abajo para procesar el reporte y generar el análisis de las matrices.
              </p>
              <button id="btn_procesar_recepcion_inicial" class="btn" style="background: linear-gradient(135deg, #4f46e5 0%, #22d3ee 100%); color: #fff; border: none; font-weight: 800; padding: 0.8rem 2.5rem; border-radius: 8px; font-size: 0.95rem; cursor: pointer; transition: all 0.3s; box-shadow: 0 0 15px rgba(34,211,238,0.3);">
                  📊 PROCESAR REPORTE
              </button>
          </div>
        `;
        document.getElementById('btn_procesar_recepcion_inicial').addEventListener('click', () => {
            runProcessingAnimation(container);
        });
        return;
    }

    container.innerHTML = `
      <div style="max-width: 900px; margin: 1.5rem auto; text-align: right; margin-bottom: 1rem; animation: fadeIn 0.3s ease;">
          <button id="btn_reprocesar_recepcion" class="btn" style="background: rgba(34, 211, 238, 0.1); color: #22d3ee; border: 1px solid #22d3ee; font-weight: 700; padding: 0.6rem 1.5rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s;">
              🔄 REPROCESAR REPORTE
          </button>
      </div>
      <div id="recepcionResultsArea"></div>
    `;
    
    try {
        const resultsArea = document.getElementById('recepcionResultsArea');
        generateAndRenderRecepcionReport(resultsArea);
    } catch (err) {
        console.error(err);
        showPremiumAlert('Error de Análisis', 'Ocurrió un error inesperado al procesar la matriz del reporte: ' + err.message, 'error');
        return;
    }

    document.getElementById('btn_reprocesar_recepcion').addEventListener('click', () => {
        runProcessingAnimation(container);
    });
  };

  const generateAndRenderRecepcionReport = (targetContainer) => {
      const activeRows = dataStore.recepcion_activo || [];
      const reserveRows = dataStore.recepcion_reserva || [];
      const articulos = dataStore.articulos || [];

      // 1. Construir articulosMap
      const articulosMap = new Map();
      articulos.forEach((row) => {
          const raw = Array.isArray(row) ? row : Object.values(row);
          const skuVal = String(raw[1] || '').trim();
          const sku7 = skuVal.substring(0, 7);
          
          if (sku7 && !articulosMap.has(sku7)) {
              articulosMap.set(sku7, {
                  gGender: String(raw[2] || '').trim().toUpperCase(),
                  marca: String(raw[13] || 'OTROS').trim()
              });
          }
      });

      const formatBrandName = (str) => {
          if (!str) return 'OTROS';
          const u = str.toUpperCase().trim();
          if (u.includes('BATA')) return 'Bata';
          if (u.includes('BUBBLEGUMMERS') || u.includes('BUBBLE GUMMERS')) return 'Bubblegummers';
          if (u.includes('NORTH STAR') || u.includes('NORTHSTAR')) return 'North Star';
          if (u.includes('POWER')) return 'Power';
          if (u.includes('PUMA')) return 'Puma';
          if (u.includes('WEINBRENNER')) return 'Weinbrenner';
          
          return str.trim();
      };

      // ==========================================
      // REPORTE 1: REPORTE RECEPCIÓN - CDBUFFER (Izquierda)
      // ==========================================
      const cdbufferRows = activeRows.filter(row => {
          const location = String(getCol(row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '').trim().toUpperCase();
          return location.startsWith('CDBUFFER-A') || location.startsWith('CDBUFFER-D');
      });

      let reporte1HTML = '';
      
      const matrix = {}; // { brand: { dept: sum } }
      const deptOrder = ['03 KIDS', '01 MEN', '05 SCHOOL', '04 SPORT', '02 WOMEN'];
      const brandOrder = ['Bata', 'Bubblegummers', 'North Star', 'Power', 'Puma', 'Weinbrenner'];

      const uniqueDepts = new Set(deptOrder);
      const uniqueBrands = new Set(brandOrder);
      let totalSum = 0;

      // Inicializar matriz con 0 para que siempre muestre la estructura vacía con ceros
      brandOrder.forEach(brand => {
          matrix[brand] = {};
          deptOrder.forEach(dept => {
              matrix[brand][dept] = 0;
          });
      });

      cdbufferRows.forEach(row => {
          const sku = String(getCol(row, ['Articulo', 'Artículo', 'Sku', 'SKU', 'PRODUCTO']) || '').trim();
          const qty = parseFloat(getCol(row, ['Cantidad actual', 'Cantidad', 'Cant.', 'CANTIDAD'])) || 0;
          if (qty <= 0) return;

          const sku7 = sku.substring(0, 7);
          const info = articulosMap.get(sku7);
          
          const rawBrand = info ? info.marca : 'OTROS';
          const brand = formatBrandName(rawBrand);
          const dept = info && info.gGender ? info.gGender.trim().toUpperCase() : 'S/D';

          uniqueDepts.add(dept);
          uniqueBrands.add(brand);

          if (!matrix[brand]) matrix[brand] = {};
          matrix[brand][dept] = (matrix[brand][dept] || 0) + qty;
          totalSum += qty;
      });

      const sortedDepts = Array.from(uniqueDepts).sort((a, b) => {
          const idxA = deptOrder.indexOf(a);
          const idxB = deptOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
      });

      let brandsToDisplay = [];
      if (totalSum === 0) {
          brandsToDisplay = [...brandOrder];
      } else {
          brandsToDisplay = Array.from(uniqueBrands).filter(brand => {
              let brandTotal = 0;
              sortedDepts.forEach(dept => {
                  brandTotal += (matrix[brand] && matrix[brand][dept]) || 0;
              });
              return brandTotal > 0;
          });
      }

      const sortedBrands = brandsToDisplay.sort((a, b) => {
          const idxA = brandOrder.indexOf(a);
          const idxB = brandOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
      });

      const meta = getUploadMeta('recepcion_activo') || {};
      const timeStr = meta.timestamp || new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');

      reporte1HTML = `
          <div class="glass-panel" style="border: 2px solid #22d3ee; border-radius: 12px; padding: 0.8rem 1.2rem; background: rgba(10, 15, 30, 0.7); backdrop-filter: blur(12px); box-shadow: 0 0 25px rgba(34, 211, 238, 0.15); text-align: left; position: relative; overflow: hidden; height: fit-content;">
              <!-- Left accented title block -->
              <div style="display: flex; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem;">
                  <div style="width: 4px; height: 26px; background-color: #22d3ee; border-radius: 2px; box-shadow: 0 0 10px #22d3ee;"></div>
                  <div>
                      <h2 style="font-size: 1.05rem; font-weight: 800; color: #22d3ee; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 8px rgba(34,211,238,0.3);">
                          REPORTE RECEPCIÓN - CDBUFFER
                      </h2>
                      <div style="font-size: 0.7rem; font-weight: 600; color: #64748b; margin-top: 1px; letter-spacing: 0.5px;">
                          DATA_SYNC: <span style="color: #94a3b8;">${timeStr}</span>
                      </div>
                  </div>
              </div>

              <!-- Table Matrix -->
              <div style="overflow-x: auto; border-radius: 8px; border: 1px solid rgba(34, 211, 238, 0.1); background: rgba(0, 0, 0, 0.2);">
                  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
                      <thead>
                          <tr style="border-bottom: 2px solid #22d3ee; background: rgba(34, 211, 238, 0.03);">
                              <th style="color: #64748b; font-weight: 700; padding: 6px 10px; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px;">MARCAS</th>
                              ${sortedDepts.map(dept => `
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-align: center; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px;">${dept}</th>
                              `).join('')}
                              <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-align: center; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px;">TOTAL</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${sortedBrands.map(brand => {
                              let rowTotal = 0;
                              return `
                                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(34,211,238,0.02)'" onmouseout="this.style.background='none'">
                                      <td style="color: #ffffff; font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">${brand}</td>
                                      ${sortedDepts.map(dept => {
                                          const val = matrix[brand][dept] || 0;
                                          rowTotal += val;
                                          return `
                                              <td style="color: #ffffff; font-weight: 500; padding: 5px 10px; text-align: center; font-size: 0.8rem;">
                                                  ${val.toLocaleString('en-US')}
                                              </td>
                                          `;
                                      }).join('')}
                                      <td style="color: #22d3ee; font-weight: 700; padding: 5px 10px; text-align: center; background: rgba(34,211,238,0.01); font-size: 0.8rem;">
                                          ${rowTotal.toLocaleString('en-US')}
                                      </td>
                                  </tr>
                              `;
                          }).join('')}
                      </tbody>
                      <tfoot>
                          <tr style="background: rgba(34, 211, 238, 0.04); border-top: 2px solid #22d3ee; font-weight: 800;">
                              <td style="color: #ffffff; font-weight: 800; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.82rem;">TOTAL GENERAL</td>
                              ${sortedDepts.map(dept => {
                                  let deptTotal = 0;
                                  sortedBrands.forEach(brand => {
                                      deptTotal += matrix[brand][dept] || 0;
                                  });
                                  return `
                                      <td style="color: #22d3ee; font-weight: 800; padding: 6px 10px; text-align: center; font-size: 0.82rem;">
                                          ${deptTotal.toLocaleString('en-US')}
                                      </td>
                                  `;
                              }).join('')}
                              <td style="color: #22d3ee; font-weight: 900; padding: 6px 10px; text-align: center; background: rgba(34, 211, 238, 0.08); font-size: 0.85rem; text-shadow: 0 0 5px rgba(34,211,238,0.5);">
                                  ${totalSum.toLocaleString('en-US')}
                              </td>
                          </tr>
                      </tfoot>
                  </table>
              </div>
          </div>
      `;

      // ==========================================
      // REPORTE 2: REPORTE ALMACENAJE - GENDER & MARCA (Derecha)
      // ==========================================
      const secondMatrix = {}; // { area: { dept: { buffer: 0 } } }
      const thirdMatrix = {};  // { area: { brand: { buffer: 0 } } }

      // Llenar buffer a partir de Stock Activo (activeRows) únicamente
      activeRows.forEach(row => {
          const location = String(getCol(row, ['UBICACION', 'Ubicación', 'Ubicación actual']) || '').trim().toUpperCase();
          let area = '';
          if (location.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
          else if (location.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
          else if (location.startsWith('CDBUFFER-D')) area = 'CDBUFFER-D';
          else return;

          const sku = String(getCol(row, ['Articulo', 'Artículo', 'Sku', 'SKU', 'PRODUCTO']) || '').trim();
          const qty = parseFloat(getCol(row, ['Cantidad actual', 'Cantidad', 'Cant.', 'CANTIDAD'])) || 0;
          if (qty <= 0) return;

          const sku7 = sku.substring(0, 7);
          const info = articulosMap.get(sku7);
          const dept = info && info.gGender ? info.gGender.trim().toUpperCase() : 'S/D';
          const rawBrand = info ? info.marca : 'OTROS';
          const brand = formatBrandName(rawBrand);

          if (!secondMatrix[area]) secondMatrix[area] = {};
          if (!secondMatrix[area][dept]) secondMatrix[area][dept] = { buffer: 0 };
          secondMatrix[area][dept].buffer += qty;

          if (!thirdMatrix[area]) thirdMatrix[area] = {};
          if (!thirdMatrix[area][brand]) thirdMatrix[area][brand] = { buffer: 0 };
          thirdMatrix[area][brand].buffer += qty;
      });

      let reporte2HTML = '';
      let reporte3HTML = '';
      const sortedAreas = Object.keys(secondMatrix).sort((a, b) => b.localeCompare(a));

      if (sortedAreas.length === 0) {
          reporte2HTML = `
              <div class="glass-panel" style="padding: 2.5rem; text-align: center; border: 1px solid rgba(255,100,100,0.2); background: rgba(10,5,5,0.4); border-radius: 12px; height: 100%;">
                  <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
                  <h4 style="color: #ff6b6b; font-weight: 700; margin-bottom: 0.5rem;">Sin Ubicaciones CDBUFFER-A/B/D</h4>
                  <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 500px; margin: 0 auto;">
                      No se encontraron ubicaciones de tipo CDBUFFER en Stock Activo ni Stock Reserva para generar el reporte de Almacenaje.
                  </p>
              </div>
          `;
          reporte3HTML = reporte2HTML;
      } else {
          const secondDeptOrder = ['03 KIDS', '06 OTHERS', '01 MEN', '05 SCHOOL', '04 SPORT', '02 WOMEN', '08 ACCESORIES', ''];
          let grandBuffer = 0;

          const tableRowsHTML = sortedAreas.map(area => {
              let areaBuffer = 0;

              const areaGenders = Object.keys(secondMatrix[area]);
              const sortedGenders = areaGenders.sort((a, b) => {
                  const idxA = secondDeptOrder.indexOf(a);
                  const idxB = secondDeptOrder.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
              });

              const genderRows = sortedGenders.map(gender => {
                  const data = secondMatrix[area][gender];
                  const buffer = data.buffer;

                  areaBuffer += buffer;

                  return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(34,211,238,0.02)'" onmouseout="this.style.background='none'">
                          <td style="color: #64748b; font-weight: 600; padding: 5px 10px; font-size: 0.8rem;">${area}</td>
                          <td style="color: #ffffff; font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">${gender || '<span style="color: #334155;">-</span>'}</td>
                          <td style="color: #ffffff; font-weight: 500; padding: 5px 10px; text-align: center; font-size: 0.8rem;">${buffer.toLocaleString('en-US')}</td>
                      </tr>
                  `;
              }).join('');

              grandBuffer += areaBuffer;

              const subtotalRow = `
                  <tr style="border-bottom: 2px solid rgba(34,211,238,0.3); background: rgba(34, 211, 238, 0.02); font-weight: 700;">
                      <td colspan="2" style="color: #22d3ee; font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">Total ${area}</td>
                      <td style="color: #22d3ee; font-weight: 700; padding: 5px 10px; text-align: center; font-size: 0.8rem;">${areaBuffer.toLocaleString('en-US')}</td>
                  </tr>
              `;

              return genderRows + subtotalRow;
          }).join('');

          const meta = getUploadMeta('recepcion_activo') || {};
          const timeStr = meta.timestamp || new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');

          reporte2HTML = `
              <div class="glass-panel" style="border: 2px solid #22d3ee; border-radius: 12px; padding: 0.8rem 1.2rem; background: rgba(10, 15, 30, 0.7); backdrop-filter: blur(12px); box-shadow: 0 0 25px rgba(34, 211, 238, 0.15); text-align: left; position: relative; overflow: hidden; height: fit-content;">
                  <!-- Title Block -->
                  <div style="display: flex; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem;">
                      <div style="width: 4px; height: 26px; background-color: #22d3ee; border-radius: 2px; box-shadow: 0 0 10px #22d3ee;"></div>
                      <div>
                          <h2 style="font-size: 1.05rem; font-weight: 800; color: #22d3ee; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 8px rgba(34,211,238,0.3);">
                              REPORTE ALMACENAJE - GENDER
                          </h2>
                          <div style="font-size: 0.7rem; font-weight: 600; color: #64748b; margin-top: 1px; letter-spacing: 0.5px;">
                              SYNC_ID: <span style="color: #94a3b8;">${timeStr}</span>
                          </div>
                      </div>
                  </div>

                  <!-- Table Matrix -->
                  <div style="overflow-x: auto; border-radius: 8px; border: 1px solid rgba(34, 211, 238, 0.1); background: rgba(0, 0, 0, 0.2);">
                      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
                          <thead>
                              <tr style="border-bottom: 2px solid #22d3ee; background: rgba(34, 211, 238, 0.03);">
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 35%;">AREA</th>
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 45%;">GENDER</th>
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-align: center; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 20%;">BUFFER</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${tableRowsHTML}
                              <tr style="background: rgba(34, 211, 238, 0.08); border-top: 2px solid #22d3ee; font-weight: 800;">
                                  <td colspan="2" style="color: #ffffff; font-weight: 800; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.82rem;">TOTAL GENERAL CDBUFFER</td>
                                  <td style="color: #22d3ee; font-weight: 800; padding: 6px 10px; text-align: center; font-size: 0.85rem;">${grandBuffer.toLocaleString('en-US')}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          `;

          // ==========================================
          // REPORTE 3: REPORTE ALMACENAJE - MARCA (Derecha Inferior)
          // ==========================================
          const secondBrandOrder = ['Bata', 'Bubblegummers', 'North Star', 'Power', 'Puma', 'Weinbrenner', 'Otros', ''];
          let grandBrandBuffer = 0;

          const tableBrandRowsHTML = sortedAreas.map(area => {
              let areaBuffer = 0;

              const areaBrands = thirdMatrix[area] ? Object.keys(thirdMatrix[area]) : [];
              const sortedBrands = areaBrands.sort((a, b) => {
                  const idxA = secondBrandOrder.indexOf(a);
                  const idxB = secondBrandOrder.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
              });

              const brandRows = sortedBrands.map(brand => {
                  const data = thirdMatrix[area][brand];
                  const buffer = data.buffer;

                  areaBuffer += buffer;

                  return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(34,211,238,0.02)'" onmouseout="this.style.background='none'">
                          <td style="color: #64748b; font-weight: 600; padding: 5px 10px; font-size: 0.8rem;">${area}</td>
                          <td style="color: #ffffff; font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">${brand || '<span style="color: #334155;">-</span>'}</td>
                          <td style="color: #ffffff; font-weight: 500; padding: 5px 10px; text-align: center; font-size: 0.8rem;">${buffer.toLocaleString('en-US')}</td>
                      </tr>
                  `;
              }).join('');

              grandBrandBuffer += areaBuffer;

              const subtotalRow = `
                  <tr style="border-bottom: 2px solid rgba(34,211,238,0.3); background: rgba(34, 211, 238, 0.02); font-weight: 700;">
                      <td colspan="2" style="color: #22d3ee; font-weight: 700; padding: 5px 10px; font-size: 0.8rem;">Total ${area}</td>
                      <td style="color: #22d3ee; font-weight: 700; padding: 5px 10px; text-align: center; font-size: 0.8rem;">${areaBuffer.toLocaleString('en-US')}</td>
                  </tr>
              `;

              return brandRows + subtotalRow;
          }).join('');

          reporte3HTML = `
              <div class="glass-panel" style="border: 2px solid #22d3ee; border-radius: 12px; padding: 0.8rem 1.2rem; background: rgba(10, 15, 30, 0.7); backdrop-filter: blur(12px); box-shadow: 0 0 25px rgba(34, 211, 238, 0.15); text-align: left; position: relative; overflow: hidden; height: fit-content;">
                  <!-- Title Block -->
                  <div style="display: flex; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.8rem;">
                      <div style="width: 4px; height: 26px; background-color: #22d3ee; border-radius: 2px; box-shadow: 0 0 10px #22d3ee;"></div>
                      <div>
                          <h2 style="font-size: 1.05rem; font-weight: 800; color: #22d3ee; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 8px rgba(34,211,238,0.3);">
                              REPORTE ALMACENAJE - MARCA
                          </h2>
                          <div style="font-size: 0.7rem; font-weight: 600; color: #64748b; margin-top: 1px; letter-spacing: 0.5px;">
                              SYNC_ID: <span style="color: #94a3b8;">${timeStr}</span>
                          </div>
                      </div>
                  </div>

                  <!-- Table Matrix -->
                  <div style="overflow-x: auto; border-radius: 8px; border: 1px solid rgba(34, 211, 238, 0.1); background: rgba(0, 0, 0, 0.2);">
                      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.78rem;">
                          <thead>
                              <tr style="border-bottom: 2px solid #22d3ee; background: rgba(34, 211, 238, 0.03);">
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 35%;">AREA</th>
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 45%;">MARCA</th>
                                  <th style="color: #22d3ee; font-weight: 700; padding: 6px 10px; text-align: center; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px; width: 20%;">BUFFER</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${tableBrandRowsHTML}
                              <tr style="background: rgba(34, 211, 238, 0.08); border-top: 2px solid #22d3ee; font-weight: 800;">
                                  <td colspan="2" style="color: #ffffff; font-weight: 800; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.82rem;">TOTAL GENERAL CDBUFFER</td>
                                  <td style="color: #22d3ee; font-weight: 800; padding: 6px 10px; text-align: center; font-size: 0.85rem;">${grandBrandBuffer.toLocaleString('en-US')}</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
          `;
      }

      // Renderizar lado a lado de manera elegante y fluida
      targetContainer.innerHTML = `
        <div style="display: flex; flex-direction: row; gap: 1.5rem; justify-content: center; align-items: flex-start; max-width: 1700px; margin: 0 auto; flex-wrap: wrap; padding: 0 1rem; animation: fadeInUp 0.4s ease;">
            <!-- Reporte Izquierdo: Recepción CDBUFFER (Más ancho para evitar huecos en la matriz) -->
            <div style="flex: 1.6; min-width: 780px; max-width: 1080px;">
                ${reporte1HTML}
            </div>
            <!-- Columna Derecha: Reportes de Almacenaje (Más compacta para evitar ancho excesivo) -->
            <div style="flex: 0.7; min-width: 350px; max-width: 440px; display: flex; flex-direction: column; gap: 1.5rem;">
                <!-- Reporte Derecho Superior: Almacenaje GENDER -->
                ${reporte2HTML}
                <!-- Reporte Derecho Inferior: Almacenaje MARCA -->
                ${reporte3HTML}
            </div>
        </div>
      `;
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
    const allowedSubTabs = tabDef.subTabs.filter(sub => user.role === 'admin' || sub.id === 'reportes_recepcion' || perms[`${tabId}_${sub.id}`] === 1);

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
        updateMobileDriverClass();
        renderGenericAreaTab(tabId, subtitle);
    }));

    const container = document.getElementById('areaContent');
    if (activeSub && activeSub.startsWith('archivo_')) {
        const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; container.appendChild(wrap);
        const actKey = `${tabId}_activo`;
        const resKey = `${tabId}_reserva`;

        // Cargar asíncronamente de la base de datos local IndexedDB antes de renderizar
        const [activoData, reservaData, articulosData, matrizData, pedidosData] = await Promise.all([
            getAreaData(actKey),
            getAreaData(resKey),
            (tabId === 'almacenaje' || tabId === 'recepcion') ? getAreaData('articulos') : Promise.resolve(null),
            (tabId === 'inventario') ? getAreaData('matriz_ubicaciones') : Promise.resolve(null),
            (tabId === 'no_retail') ? getAreaData(`${tabId}`) : Promise.resolve(null)
        ]);

        renderUploadArea(wrap, actKey, activoData, '.csv', 'STOCK ACTIVO');
        renderUploadArea(wrap, resKey, reservaData, '.xlsx', 'STOCK RESERVA');
        if (tabId === 'almacenaje' || tabId === 'recepcion') {
            renderUploadArea(wrap, 'articulos', articulosData, '.xlsx', 'MAESTRO ARTÍCULOS');
        }
        if (tabId === 'inventario') {
            renderUploadArea(wrap, 'matriz_ubicaciones', matrizData, '.xlsx', 'MATRIZ UBICACIONES ALTO');
        }
        if (tabId === 'no_retail') {
            renderUploadArea(wrap, `${tabId}`, pedidosData, '.xlsx', 'PEDIDOS CATÁLOGO');
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
    } else if (tabId === 'recepcion' && activeSub === 'reportes_recepcion') {
        renderRecepcionReportTab(container);
    } else if (tabId === 'despacho' && activeSub === 'monitoreo_despacho') {
        renderDespachoMonitoreo(container);
    } else if (tabId === 'despacho' && activeSub === 'chofer_despacho') {
        renderDespachoChoferPortal(container);
    } else if (tabId === 'no_retail' && activeSub === 'despacho_no_retail') {
        renderDespachoNoRetailPortal(container);
    } else if (tabId === 'no_retail' && activeSub === 'tracking_no_retail') {
        renderTrackingNoRetailPortal(container);
    } else {
        const data = await getAreaData(tabId);
        if (!data) renderUploadArea(container, tabId);
        else renderDashboardView(container, data);
    }
  };

  // --- INICIO MÓDULO TRACKING DESPACHO (v25.1.98) ---
  const MOCK_DESCARGA_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><line x1="50" y1="50" x2="350" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="2"/><line x1="50" y1="50" x2="50" y2="250" stroke="rgba(255,255,255,0.1)" stroke-width="2"/><line x1="350" y1="50" x2="350" y2="250" stroke="rgba(255,255,255,0.1)" stroke-width="2"/><path d="M 200,100 L 260,130 L 260,200 L 200,230 L 140,200 L 140,130 Z" fill="%23f59e0b" opacity="0.95"/><path d="M 200,100 L 200,230" stroke="%2378350f" stroke-width="2"/><path d="M 200,100 L 260,130 M 200,100 L 140,130" stroke="%2378350f" stroke-width="2"/><path d="M 140,130 L 200,160 L 260,130" stroke="%2378350f" stroke-width="2"/><polygon points="170,155 190,165 190,175 170,165" fill="%23fff" opacity="0.9"/><rect x="110" y="240" width="180" height="35" rx="8" fill="rgba(16,185,129,0.2)" stroke="%2310b981" stroke-width="1"/><text x="200" y="262" fill="%2310b981" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">📦 DESCARGA TIENDA OK</text></svg>`;

  const MOCK_CARGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><rect x="120" y="40" width="160" height="220" rx="4" fill="%23f8fafc" stroke="%23e2e8f0" stroke-width="2"/><line x1="140" y1="70" x2="260" y2="70" stroke="%233b82f6" stroke-width="4"/><line x1="140" y1="100" x2="260" y2="100" stroke="%2394a3b8" stroke-width="2"/><line x1="140" y1="120" x2="240" y2="120" stroke="%2394a3b8" stroke-width="2"/><line x1="140" y1="140" x2="250" y2="140" stroke="%2394a3b8" stroke-width="2"/><circle cx="230" cy="190" r="22" fill="none" stroke="%23ef4444" stroke-width="3" stroke-dasharray="3,1"/><text x="230" y="194" fill="%23ef4444" font-family="sans-serif" font-size="8" font-weight="900" text-anchor="middle">RECIBIDO</text><path d="M 140,210 Q 155,190 170,210 T 200,210" fill="none" stroke="%231e3a8a" stroke-width="2" stroke-linecap="round"/><line x1="135" y1="215" x2="205" y2="215" stroke="%23475569" stroke-width="1"/><rect x="110" y="240" width="180" height="35" rx="8" fill="rgba(16,185,129,0.2)" stroke="%2310b981" stroke-width="1"/><text x="200" y="262" fill="%2310b981" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">✍️ CARGO FIRMADO OK</text></svg>`;

  const getDispatchRoutes = () => {
    const defaultRoutes = [
      {
        id: 'RUTA-01',
        driver: 'Carlos Mendoza',
        plate: 'F3G-894',
        status: 'Creada',
        progress: 0,
        startTime: null,
        endTime: null,
        stops: [
          {
            id: 'S-01',
            storeName: 'Saga Falabella - Jockey Plaza',
            address: 'Av. Javier Prado Este 4200, Surco',
            guides: ['GR-99210', 'GR-99211'],
            status: 'Pendiente',
            deliveredTime: null,
            photoDescarga: null,
            photoCargo: null
          },
          {
            id: 'S-02',
            storeName: 'Ripley - San Isidro',
            address: 'Av. Las Begonias 545, San Isidro',
            guides: ['GR-99215'],
            status: 'Pendiente',
            deliveredTime: null,
            photoDescarga: null,
            photoCargo: null
          }
        ],
        gpsHistory: [
          { lat: -12.0864, lng: -77.0125, time: '12:00:00', x: 150, y: 250 }
        ]
      },
      {
        id: 'RUTA-02',
        driver: 'Luis Fuentes',
        plate: 'B2U-105',
        status: 'En Tránsito',
        progress: 50,
        startTime: '10:15:30',
        endTime: null,
        stops: [
          {
            id: 'S-03',
            storeName: 'Saga Falabella - San Miguel',
            address: 'Av. La Marina 2000, San Miguel',
            guides: ['GR-99301', 'GR-99302'],
            status: 'Entregado',
            deliveredTime: '11:20:15',
            photoDescarga: MOCK_DESCARGA_SVG,
            photoCargo: MOCK_CARGO_SVG
          },
          {
            id: 'S-04',
            storeName: 'Ripley - Plaza San Miguel',
            address: 'Av. La Marina 2100, San Miguel',
            guides: ['GR-99305'],
            status: 'Pendiente',
            deliveredTime: null,
            photoDescarga: null,
            photoCargo: null
          }
        ],
        gpsHistory: [
          { lat: -12.0864, lng: -77.0125, time: '10:15:00', x: 150, y: 250 },
          { lat: -12.0792, lng: -77.0812, time: '11:20:00', x: 60, y: 180 }
        ]
      }
    ];
    let routes = localStorage.getItem('logistics_dispatch_routes_v1');
    if (!routes) {
        localStorage.setItem('logistics_dispatch_routes_v1', JSON.stringify(defaultRoutes));
        return defaultRoutes;
    }
    try {
        return JSON.parse(routes);
    } catch(e) {
        return defaultRoutes;
    }
  };

  const saveDispatchRoutes = (routes) => {
    localStorage.setItem('logistics_dispatch_routes_v1', JSON.stringify(routes));
  };

  const renderDespachoMonitoreo = (container) => {
    const routes = getDispatchRoutes();
    let selectedRouteId = localStorage.getItem('selected_dispatch_route') || routes[0]?.id;
    let selectedRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

    const getStatusClass = (status) => {
        if (status === 'Entregada' || status === 'Entregado') return 'status-success';
        if (status === 'En Tránsito') return 'status-warning';
        if (status === 'En Tienda') return 'status-primary';
        if (status === 'Incidencia') return 'status-danger';
        return 'status-muted';
    };

    const drawSVGMap = (route) => {
        const warehouse = { name: "Almacén Central (Lince)", x: 150, y: 250 };
        const stopsMap = {
            'S-01': { x: 400, y: 150 }, // SF Jockey Plaza
            'S-02': { x: 280, y: 300 }, // R San Isidro
            'S-03': { x: 60, y: 180 },  // SF San Miguel
            'S-04': { x: 70, y: 120 }   // R Plaza San Miguel
        };

        // Get truck coordinates
        let truckPos = { ...warehouse };
        if (route.gpsHistory && route.gpsHistory.length > 0) {
            const lastPoint = route.gpsHistory[route.gpsHistory.length - 1];
            if (lastPoint.x !== undefined && lastPoint.y !== undefined) {
                truckPos.x = lastPoint.x;
                truckPos.y = lastPoint.y;
            }
        }

        // Draw street grids
        let streetLines = `
            <line x1="20" y1="200" x2="480" y2="200" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
            <text x="30" y="195" fill="rgba(255,255,255,0.2)" font-size="8" font-weight="600">AV. JAVIER PRADO</text>
            
            <line x1="250" y1="20" x2="250" y2="380" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
            <text x="255" y="30" fill="rgba(255,255,255,0.2)" font-size="8" font-weight="600" transform="rotate(90,255,30)">VÍA EXPRESA</text>

            <line x1="20" y1="140" x2="250" y2="140" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
            <text x="30" y="135" fill="rgba(255,255,255,0.2)" font-size="8" font-weight="600">AV. LA MARINA</text>
        `;

        // Path between stops
        let routePaths = '';
        if (route && route.stops) {
            let lastX = warehouse.x;
            let lastY = warehouse.y;
            route.stops.forEach(s => {
                const stopPt = stopsMap[s.id] || warehouse;
                routePaths += `
                    <line x1="${lastX}" y1="${lastY}" x2="${stopPt.x}" y2="${stopPt.y}" stroke="${route.status==='En Tránsito'?'#eab308':'#10b981'}" stroke-width="2.5" stroke-dasharray="6,4" opacity="0.8" />
                `;
                lastX = stopPt.x;
                lastY = stopPt.y;
            });
        }

        // Targets for stops
        let stopMarkers = '';
        route.stops.forEach(s => {
            const pt = stopsMap[s.id];
            if (!pt) return;
            const isDelivered = s.status === 'Entregado';
            const markerColor = isDelivered ? '#10b981' : '#f59e0b';
            stopMarkers += `
                <g style="cursor:pointer;" class="map-marker" data-stop-id="${s.id}">
                    <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="${markerColor}" opacity="0.2" class="pulse-marker" />
                    <circle cx="${pt.x}" cy="${pt.y}" r="6" fill="${markerColor}" stroke="#fff" stroke-width="1.5" />
                    <text x="${pt.x}" y="${pt.y - 12}" fill="#fff" font-size="8.5" font-weight="800" text-anchor="middle">${s.storeName.split(' - ')[0]}</text>
                </g>
            `;
        });

        // Warehouse marker
        const warehouseMarker = `
            <g>
                <circle cx="${warehouse.x}" cy="${warehouse.y}" r="8" fill="#3b82f6" stroke="#fff" stroke-width="2" />
                <rect x="${warehouse.x - 4}" y="${warehouse.y - 4}" width="8" height="8" fill="#fff" />
                <text x="${warehouse.x}" y="${warehouse.y + 18}" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">ALMACÉN LINCE</text>
            </g>
        `;

        // Pulse vehicle
        let vehicleMarker = '';
        if (route.status === 'En Tránsito' || route.status === 'En Tienda') {
            vehicleMarker = `
                <g class="truck-marker">
                    <circle cx="${truckPos.x}" cy="${truckPos.y}" r="16" fill="#3b82f6" opacity="0.3" class="pulse-marker" />
                    <circle cx="${truckPos.x}" cy="${truckPos.y}" r="9" fill="#2563eb" stroke="#fff" stroke-width="2" />
                    <text x="${truckPos.x}" y="${truckPos.y + 4}" font-size="8" text-anchor="middle">🚚</text>
                </g>
            `;
        }

        return `
            <svg viewBox="0 0 500 400" style="width:100%; height:100%; display:block; background:#0f172a;">
                <style>
                    .pulse-marker {
                        animation: mapPulse 2s infinite alternate;
                    }
                    @keyframes mapPulse {
                        0% { transform: scale(0.9); opacity: 0.2; }
                        100% { transform: scale(1.3); opacity: 0.4; }
                    }
                </style>
                <rect width="500" height="400" fill="#0f172a" />
                ${streetLines}
                ${routePaths}
                ${warehouseMarker}
                ${stopMarkers}
                ${vehicleMarker}
            </svg>
        `;
    };

    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <!-- Left Side: Route list -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div class="glass-panel" style="padding:1.2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="margin:0; font-weight:800; color:var(--primary);">MONITOREO DE DESPACHOS</h4>
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${routes.length} RUTAS ACTIVAS</span>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:0.8rem;">
                        ${routes.map(r => `
                            <div class="route-card ${r.id === selectedRouteId ? 'active' : ''}" data-route-id="${r.id}" style="
                                padding: 1rem;
                                border-radius: 12px;
                                background: ${r.id === selectedRouteId ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.02)'};
                                border: 1px solid ${r.id === selectedRouteId ? 'var(--primary)' : 'rgba(255,255,255,0.05)'};
                                cursor: pointer;
                                transition: all 0.2s ease;
                            ">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                    <span style="font-weight:900; font-size:0.9rem; color:#fff;">${r.id} (${r.plate})</span>
                                    <span class="badge ${getStatusClass(r.status)}">${r.status.toUpperCase()}</span>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">
                                    <div>👨🏻‍✈️ ${r.driver}</div>
                                    <div style="text-align:right;">🕒 Salida: ${r.startTime || '--:--'}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.8rem;">
                                    <div style="flex-grow:1; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
                                        <div style="width:${r.progress}%; height:100%; background:var(--primary); transition:width 0.3s;"></div>
                                    </div>
                                    <span style="font-size:0.75rem; font-weight:800; color:#fff;">${r.progress}%</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Stops for selected route -->
                <div class="glass-panel" style="padding:1.2rem;">
                    <h5 style="margin:0 0 1rem 0; font-weight:800;">PROGRAMACIÓN DE PARADAS: ${selectedRoute.id}</h5>
                    <div style="display:flex; flex-direction:column; gap:0.8rem;">
                        ${selectedRoute.stops.map((s, index) => {
                            const isDelivered = s.status === 'Entregado';
                            return `
                                <div style="
                                    display: flex; 
                                    gap: 1rem; 
                                    align-items: flex-start;
                                    padding: 0.8rem;
                                    background: rgba(255,255,255,0.01);
                                    border-radius: 8px;
                                    border-left: 4px solid ${isDelivered ? 'var(--success)' : 'var(--warning)'};
                                ">
                                    <div style="
                                        width: 22px; 
                                        height: 22px; 
                                        border-radius: 50%; 
                                        background: ${isDelivered ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'};
                                        color: ${isDelivered ? 'var(--success)' : 'var(--warning)'};
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        font-size: 0.75rem;
                                        font-weight: 800;
                                    ">
                                        ${index + 1}
                                    </div>
                                    <div style="flex-grow:1;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="font-weight:700; font-size:0.8rem; color:#fff;">${s.storeName}</span>
                                            <span class="badge ${isDelivered ? 'status-success' : 'status-warning'}" style="font-size:0.6rem;">${s.status.toUpperCase()}</span>
                                        </div>
                                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">📍 ${s.address}</div>
                                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.3); margin-top:2px;">📑 Guías: ${s.guides.join(', ')}</div>
                                    </div>
                                    ${isDelivered ? `
                                        <button class="btn btn-view-evidence" data-stop-id="${s.id}" style="padding:0.3rem 0.6rem; font-size:0.65rem; border-radius:6px; border:1px solid var(--success); background:none; color:var(--success);">
                                            📄 VER EVIDENCIAS
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- Right Side: SVG map and Telemetry -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div class="glass-panel" style="padding:0; overflow:hidden; border-radius:16px; border:1px solid rgba(255,255,255,0.06); height:320px; position:relative;">
                    <div style="position:absolute; top:12px; left:12px; z-index:10; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.08); padding:6px 12px; border-radius:8px;">
                        <span style="font-size:0.7rem; font-weight:800; color:#fff;">📍 MAPA SATELITAL DE VIAJE (MOCK)</span>
                    </div>
                    <div id="svgMapContainer" style="width:100%; height:100%;">
                        ${drawSVGMap(selectedRoute)}
                    </div>
                </div>

                <!-- Live Telemetry -->
                <div class="glass-panel" style="padding:1.2rem; background:linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%);">
                    <h5 style="margin:0 0 1rem 0; font-weight:800; color:#3b82f6;">📡 TELEMETRÍA EN VIVO (SIMULADA)</h5>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; text-align:center;">
                        <div style="background:rgba(255,255,255,0.02); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">VELOCIDAD PROMEDIO</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#fff; margin-top:4px;">${selectedRoute.status === 'En Tránsito' ? '45 km/h' : '0 km/h'}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.02); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">PRECISIÓN GPS</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#10b981; margin-top:4px;">± 3 metros</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.02); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">LATENCIA DE RED</div>
                            <div style="font-size:1.2rem; font-weight:900; color:#3b82f6; margin-top:4px;">120 ms</div>
                        </div>
                    </div>
                    <div style="font-size:0.65rem; color:var(--text-muted); margin-top:1rem; text-align:center;">
                        Último ping GPS reportado: <strong>hace 18 segundos</strong>.
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add click listeners to cards
    document.querySelectorAll('.route-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const rid = e.currentTarget.dataset.routeId;
            localStorage.setItem('selected_dispatch_route', rid);
            renderDespachoMonitoreo(container);
        });
    });

    // Add click listeners to ver evidencias
    document.querySelectorAll('.btn-view-evidence').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stopId = e.currentTarget.dataset.stopId;
            const stop = selectedRoute.stops.find(s => s.id === stopId);
            if (stop) {
                openEvidenceModal(stop);
            }
        });
    });
  };

  const openEvidenceModal = (stop) => {
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100vw';
    backdrop.style.height = '100vh';
    backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
    backdrop.style.backdropFilter = 'blur(10px)';
    backdrop.style.display = 'flex';
    backdrop.style.justifyContent = 'center';
    backdrop.style.alignItems = 'center';
    backdrop.style.zIndex = '99999';

    backdrop.innerHTML = `
        <div class="glass-panel" style="width:90%; max-width:800px; padding:2rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.98) 100%); position:relative;">
            <button id="close_evidence_modal" style="position:absolute; top:15px; right:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
            
            <h4 style="margin:0 0 0.5rem 0; font-weight:900; color:#fff;">📄 EVIDENCIA DE ENTREGA DIGITAL (POD)</h4>
            <p style="margin:0 0 1.5rem 0; color:var(--text-muted); font-size:0.8rem;">Tienda: <strong>${stop.storeName}</strong> | Hora de entrega: <strong>${stop.deliveredTime || '--:--'}</strong></p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div>
                    <h5 style="margin:0 0 0.8rem 0; font-size:0.85rem; color:#f59e0b; font-weight:700;">📸 EVIDENCIA DE DESCARGA FÍSICA</h5>
                    <div style="aspect-ratio:4/3; border-radius:12px; background:rgba(0,0,0,0.4); overflow:hidden; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center;">
                        <img src="${stop.photoDescarga}" style="width:100%; height:100%; object-fit:contain;" />
                    </div>
                </div>
                <div>
                    <h5 style="margin:0 0 0.8rem 0; font-size:0.85rem; color:#3b82f6; font-weight:700;">✍️ FOTO CARGO G.R. FIRMADO</h5>
                    <div style="aspect-ratio:4/3; border-radius:12px; background:rgba(0,0,0,0.4); overflow:hidden; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center;">
                        <img src="${stop.photoCargo}" style="width:100%; height:100%; object-fit:contain;" />
                    </div>
                </div>
            </div>
            
            <div style="margin-top:1.5rem; display:flex; justify-content:flex-end;">
                <button id="btn_approve_evidence" class="btn" style="max-width:180px; padding:0.6rem 1.2rem; font-size:0.8rem; border-radius:8px;">
                    ✅ APROBAR ENTREGA
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.getElementById('close_evidence_modal').onclick = () => backdrop.remove();
    document.getElementById('btn_approve_evidence').onclick = () => {
        alert("✅ Entrega Auditada y Aprobada Correctamente.");
        backdrop.remove();
    };
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  };

  function renderDespachoChoferPortal(container) {
    const routes = getDispatchRoutes();
    let selectedDriverId = localStorage.getItem('selected_dispatch_driver') || routes[0]?.id;
    let activeRoute = routes.find(r => r.id === selectedDriverId) || routes[0];

    let currentPhotoDescarga = null;
    let currentPhotoCargo = null;

    const refreshDriverUI = () => {
        renderDespachoChoferPortal(container);
    };

    const isMobile = window.innerWidth <= 768;
    const isDriverRole = user.role === 'transporte' || user.role === 'transportista' || user.role === 'chofer' || 
                         ((user.role !== 'admin' && user.role !== 'jefe') && (rolePermissions['transporte'] === 1 || rolePermissions['Transporte'] === 1));
    const hideFrame = isMobile || isDriverRole;
    const showBackToOffice = hideFrame && !isDriverRole;

    container.innerHTML = `
        ${showBackToOffice ? `
        <!-- Simulation back to office bar for admin testing -->
        <div style="background: rgba(15,23,42,0.95); padding: 0.6rem 1rem; width:100%; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index:999999; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
            <span style="font-size:0.65rem; color:#f59e0b; font-weight:800; letter-spacing:0.5px;">📲 VISTA CHOFER (SIMULADO)</span>
            <button id="btn_back_to_office" style="background:#4f46e5; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.65rem; font-weight:800; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#4338ca'" onmouseout="this.style.background='#4f46e5'">
                🏢 VOLVER A OFICINA
            </button>
        </div>
        ` : ''}
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; padding:${hideFrame ? '0' : '1rem 0'};">
            ${hideFrame ? '' : `
            <!-- Simulation info -->
            <div style="max-width:380px; width:100%; text-align:center; color:var(--text-muted); font-size:0.75rem; margin-bottom:1.5rem; line-height:1.4;">
                <span style="color:#eab308; font-weight:800;">⚡ SIMULADOR DE TRANSPORTISTA 📲</span><br>
                Usa este portal móvil para actuar como chofer. Los cambios realizados aquí se verán reflejados de inmediato en la pantalla de <strong>Monitoreo de Rutas</strong> de la oficina.
            </div>

            <!-- Driver selector -->
            <div style="max-width:380px; width:100%; margin-bottom:1rem; display:flex; gap:0.5rem; align-items:center;">
                <span style="font-size:0.75rem; color:#fff; font-weight:700; white-space:nowrap;">👨🏻‍✈️ ELEGIR CHOFER:</span>
                <select id="driver_selector" style="flex-grow:1; padding:0.4rem; border-radius:8px; background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); font-size:0.75rem;">
                    ${routes.map(r => `<option value="${r.id}" ${r.id === selectedDriverId ? 'selected' : ''}>${r.driver} (${r.id})</option>`).join('')}
                </select>
            </div>
            `}

            <!-- Smartphone Mock Frame / Mobile Direct Screen -->
            <div style="${hideFrame ? `
                width: 100%;
                background: #0b1329;
                padding: 1.25rem;
                position: relative;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            ` : `
                max-width: 380px;
                width: 100%;
                background: #0b1329;
                border: 10px solid #1e293b;
                border-radius: 36px;
                padding: 1rem;
                box-shadow: 0 25px 60px rgba(0,0,0,0.6);
                position: relative;
                overflow: hidden;
                border-bottom-width: 14px;
            `}">
                ${hideFrame ? '' : `
                <!-- Status Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.65rem; color:#64748b; font-weight:bold; margin-bottom:1rem;">
                    <div>12:45</div>
                    <div style="width:40px; height:12px; background:#000; border-radius:6px; margin:0 auto; position:absolute; left:50%; transform:translateX(-50%); top:8px;"></div>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <span>📶 4G</span>
                        <span>🔋 88%</span>
                    </div>
                </div>
                `}

                <!-- Driver App Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.8rem; margin-bottom:1rem;">
                    <div>
                        <div style="font-size:0.8rem; font-weight:800; color:#fff;">PULSE CONDUCTOR</div>
                        <div style="font-size:0.6rem; color:var(--text-muted);">Camión: ${activeRoute.plate} | ${activeRoute.id}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span class="badge ${activeRoute.status === 'Creada' ? 'status-muted' : 'status-warning'}" style="font-size:0.6rem; margin: 0;">
                            ${activeRoute.status.toUpperCase()}
                        </span>
                        <button id="btn_driver_logout" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:0.6rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:2px; padding:2px; margin-top:2px; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">
                            🚪 CERRAR SESIÓN
                        </button>
                    </div>
                </div>

                <!-- Active Route Actions -->
                ${activeRoute.status === 'Creada' ? `
                    <div style="text-align:center; padding:1.5rem 0;">
                        <div style="font-size:3rem; margin-bottom:1rem;">🚚</div>
                        <h4 style="margin:0 0 0.5rem 0; color:#fff; font-weight:800;">VIAJE NO INICIADO</h4>
                        <p style="color:var(--text-muted); font-size:0.7rem; margin-bottom:1.5rem;">Presiona el botón para iniciar la ruta y registrar el despacho del camión con GPS.</p>
                        <button id="btn_driver_start" class="btn" style="padding:0.8rem; border-radius:12px; font-size:0.8rem; font-weight:bold; width:100%;">
                            🚚 INICIAR VIAJE A TIENDA
                        </button>
                    </div>
                ` : `
                    <!-- Active Stops list -->
                    <div style="display:flex; flex-direction:column; gap:0.8rem;">
                        <div style="font-size:0.7rem; font-weight:800; color:#eab308; margin-bottom:0.2rem;">📌 PRÓXIMAS PARADAS:</div>
                        
                        ${activeRoute.stops.map((stop, index) => {
                            const isDelivered = stop.status === 'Entregado';
                            const isNext = activeRoute.stops.findIndex(s => s.status !== 'Entregado') === index;
                            
                            return `
                                <div style="
                                    background: rgba(255,255,255,0.02);
                                    border: 1px solid ${isNext ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.03)'};
                                    border-radius: 12px;
                                    padding: 0.8rem;
                                    opacity: ${isDelivered ? 0.6 : 1};
                                    position: relative;
                                ">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.3rem;">
                                        <div style="font-size:0.75rem; font-weight:800; color:#fff;">${index + 1}. ${stop.storeName}</div>
                                        <span class="badge ${isDelivered ? 'status-success' : (isNext ? 'status-warning' : 'status-muted')}" style="font-size:0.55rem; padding:1px 6px;">
                                            ${stop.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:0.5rem;">📍 ${stop.address}</div>

                                    <!-- Actions for the NEXT pending stop -->
                                    ${isNext ? `
                                        <div style="display:flex; flex-direction:column; gap:0.6rem; margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.8rem;">
                                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                                                <button id="btn_upload_descarga" class="btn" style="background:#1e293b; border:1px dashed #f59e0b; color:#fff; font-size:0.65rem; padding:0.5rem 0; border-radius:6px;">
                                                    📷 FOTO DESCARGA ${stop.photoDescarga ? '✅' : ''}
                                                </button>
                                                <button id="btn_upload_cargo" class="btn" style="background:#1e293b; border:1px dashed #3b82f6; color:#fff; font-size:0.65rem; padding:0.5rem 0; border-radius:6px;">
                                                    📷 FOTO CARGO ${stop.photoCargo ? '✅' : ''}
                                                </button>
                                            </div>

                                            <div id="evidence_status" style="font-size:0.6rem; text-align:center; color:var(--text-muted);">
                                                ${(stop.photoDescarga && stop.photoCargo) ? '<span style="color:var(--success); font-weight:800;">¡Evidencias cargadas!</span>' : 'Sube las fotos obligatorias para entregar.'}
                                            </div>

                                            <button id="btn_deliver_stop" class="btn" style="font-size:0.75rem; padding:0.6rem; border-radius:8px; font-weight:bold; width:100%;" ${(stop.photoDescarga && stop.photoCargo) ? '' : 'disabled'}>
                                                📦 ENTREGAR PEDIDO Y FIRMAR
                                            </button>

                                            <!-- GPS Telemetry simulation -->
                                            <button id="btn_simulate_gps" class="btn" style="background:none; border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:0.6rem; padding:0.4rem 0; border-radius:6px; margin-top:0.2rem;">
                                                🚀 Simular Avance GPS (Camión en Ruta)
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>
    `;

    // Return to office simulator button
    document.getElementById('btn_back_to_office')?.addEventListener('click', () => {
        const targetSub = currentTab === 'no_retail' ? 'archivo_no_retail' : 'archivo_despacho';
        localStorage.setItem(`activeSub_${currentTab}`, targetSub);
        updateMobileDriverClass();
        renderTabContent();
    });

    // Listen to driver selector
    document.getElementById('driver_selector')?.addEventListener('change', (e) => {
        const did = e.target.value;
        localStorage.setItem('selected_dispatch_driver', did);
        refreshDriverUI();
    });

    // Start Voyage button
    document.getElementById('btn_driver_start')?.addEventListener('click', () => {
        activeRoute.status = 'En Tránsito';
        activeRoute.startTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const allRoutes = getDispatchRoutes();
        const idx = allRoutes.findIndex(r => r.id === activeRoute.id);
        if (idx !== -1) {
            allRoutes[idx] = activeRoute;
            saveDispatchRoutes(allRoutes);
        }
        refreshDriverUI();
    });

    // Upload Mock Descarga
    document.getElementById('btn_upload_descarga')?.addEventListener('click', () => {
        const allRoutes = getDispatchRoutes();
        const rIdx = allRoutes.findIndex(r => r.id === activeRoute.id);
        if (rIdx !== -1) {
            const nextStop = allRoutes[rIdx].stops.find(s => s.status !== 'Entregado');
            if (nextStop) {
                nextStop.photoDescarga = MOCK_DESCARGA_SVG;
                saveDispatchRoutes(allRoutes);
                activeRoute = allRoutes[rIdx];
            }
        }
        refreshDriverUI();
    });

    // Upload Mock Cargo
    document.getElementById('btn_upload_cargo')?.addEventListener('click', () => {
        const allRoutes = getDispatchRoutes();
        const rIdx = allRoutes.findIndex(r => r.id === activeRoute.id);
        if (rIdx !== -1) {
            const nextStop = allRoutes[rIdx].stops.find(s => s.status !== 'Entregado');
            if (nextStop) {
                nextStop.photoCargo = MOCK_CARGO_SVG;
                saveDispatchRoutes(allRoutes);
                activeRoute = allRoutes[rIdx];
            }
        }
        refreshDriverUI();
    });

    // Deliver stop button
    document.getElementById('btn_deliver_stop')?.addEventListener('click', () => {
        const allRoutes = getDispatchRoutes();
        const rIdx = allRoutes.findIndex(r => r.id === activeRoute.id);
        if (rIdx !== -1) {
            const nextStopIdx = allRoutes[rIdx].stops.findIndex(s => s.status !== 'Entregado');
            if (nextStopIdx !== -1) {
                allRoutes[rIdx].stops[nextStopIdx].status = 'Entregado';
                allRoutes[rIdx].stops[nextStopIdx].deliveredTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                // Calculate progress
                const totalStops = allRoutes[rIdx].stops.length;
                const deliveredStops = allRoutes[rIdx].stops.filter(s => s.status === 'Entregado').length;
                allRoutes[rIdx].progress = Math.round((deliveredStops / totalStops) * 100);

                if (deliveredStops === totalStops) {
                    allRoutes[rIdx].status = 'Entregada';
                    allRoutes[rIdx].endTime = allRoutes[rIdx].stops[nextStopIdx].deliveredTime;
                }

                saveDispatchRoutes(allRoutes);
                activeRoute = allRoutes[rIdx];
            }
        }
        alert("📦 ¡Entrega completada con éxito!");
        refreshDriverUI();
    });
    // Simulate GPS movement (removed - was incomplete from previous version)
  }


  
  
  const fetchAndParseNoRetailClients = async () => {
      let catalogData = [];
      try {
          catalogData = await getAreaData('no_retail') || [];
      } catch(e) { console.warn("No retail catalog loading failed:", e); }

      let clientsData = [];

      if (catalogData && catalogData.length > 0) {
          const rows = catalogData;
          const validRows = rows.filter(r => {
              if (!r || !Array.isArray(r)) return false;
              const hasData = r.some(cell => String(cell).trim() !== '');
              if (!hasData) return false;
              const cleanText = (str) => String(str || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, '');
              const textAgencia = cleanText(r[4]);
              if (textAgencia === 'AGENCIA') return false;
              if (!String(r[6]).trim() && !String(r[4]).trim()) return false;
              return true;
          });

          let cachedStatuses = {};
          try {
              const cacheRes = await fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache');
              if (cacheRes.ok) {
                  const serverCache = await cacheRes.json();
                  cachedStatuses = serverCache.data || {};
                  if (Array.isArray(cachedStatuses)) cachedStatuses = {};
                  localStorage.setItem('nr_cache_v1', JSON.stringify(cachedStatuses));
              } else {
                  cachedStatuses = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                  if (Array.isArray(cachedStatuses)) cachedStatuses = {};
              }
          } catch(e) {
              console.warn("Could not load tracking cache from server, using local storage fallback:", e);
              cachedStatuses = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
              if (Array.isArray(cachedStatuses)) cachedStatuses = {};
          }

          clientsData = validRows.map((r, idx) => {
              const id = String(r[0] || `PED-${10000 + idx}`).trim() + '-' + idx;
              return {
                  id,
                  fecha: String(r[1] || 'Sin Fecha').trim(),
                  pedido: String(r[6] || `PED-${10000 + idx}`).trim(),
                  clientName: String(r[3] || `Cliente #${idx + 1}`).trim().toUpperCase(),
                  agencia: String(r[4] || 'Agencia General').trim().toUpperCase(),
                  address: String(r[5] || 'Dirección de Entrega').trim(),
                  status: cachedStatuses[id]?.status || 'PENDIENTE',
                  statusDate: cachedStatuses[id]?.date || null,
                  liquidated: cachedStatuses[id]?.liquidated || false,
                  cobroFlete: cachedStatuses[id]?.cobroFlete || 'NO',
                  fotoCargo: cachedStatuses[id]?.fotoCargo || null,
                  fotoLocal: cachedStatuses[id]?.fotoLocal || null
              };
          });
      }
      window._noRetailClients = clientsData;
      return clientsData;
  };

  const openImageModal = (src, title = 'Visualización de Imagen') => {
      const backdrop = document.createElement('div');
      backdrop.style.position = 'fixed';
      backdrop.style.top = '0';
      backdrop.style.left = '0';
      backdrop.style.width = '100vw';
      backdrop.style.height = '100vh';
      backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
      backdrop.style.backdropFilter = 'blur(10px)';
      backdrop.style.display = 'flex';
      backdrop.style.justifyContent = 'center';
      backdrop.style.alignItems = 'center';
      backdrop.style.zIndex = '99999';

      backdrop.innerHTML = `
          <div class="glass-panel" style="width:90%; max-width:600px; padding:1.5rem; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.98) 100%); position:relative;">
              <button id="close_image_modal" style="position:absolute; top:15px; right:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
              
              <h4 style="margin:0 0 1rem 0; font-weight:900; color:#fff; font-size: 1rem; text-align: center;">${title}</h4>
              
              <div style="border-radius:12px; background:rgba(0,0,0,0.4); overflow:hidden; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center; max-height: 60vh;">
                  <img src="${src}" style="max-width:100%; max-height:60vh; object-fit:contain;" />
              </div>
          </div>
      `;

      document.body.appendChild(backdrop);
      document.getElementById('close_image_modal').onclick = () => backdrop.remove();
      backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  };

  const renderTrackingNoRetailPortal = async (container) => {
      let cache = {};
      try {
          const res = await fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache');
          if (res.ok) {
              const serverData = await res.json();
              cache = serverData.data || {};
              if (Array.isArray(cache)) cache = {};
              localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
          } else {
              cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
              if (Array.isArray(cache)) cache = {};
          }
      } catch (e) {
          console.warn("Could not load tracking cache from server, using local storage fallback:", e);
          cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
          if (Array.isArray(cache)) cache = {};
      }

      if (!window._noRetailClients || window._noRetailClients.length === 0) {
          await fetchAndParseNoRetailClients();
      }

      let clients = window._noRetailClients || [];
      clients = clients.map(c => {
          if(cache[c.id]) {
              return { ...c, ...cache[c.id] };
          }
          return c;
      });

      // Filter logic
      const dateDesde = window._trackingFilterDesde || '';
      const dateHasta = window._trackingFilterHasta || '';

      if (dateDesde) {
          clients = clients.filter(c => {
              const cDate = c.statusDate ? new Date(c.statusDate) : null;
              const fDesde = new Date(dateDesde);
              return cDate && cDate >= fDesde;
          });
      }
      if (dateHasta) {
          clients = clients.filter(c => {
              const cDate = c.statusDate ? new Date(c.statusDate) : null;
              const fHasta = new Date(dateHasta);
              return cDate && cDate <= fHasta;
          });
      }

      // Metadata de subida del archivo NO RETAIL (Pedidos Catálogo)
      const meta = getUploadMeta('no_retail') || {};
      const uploadDateRaw = meta.timestamp || (meta.ts ? new Date(meta.ts).toLocaleString() : 'Desconocida');
      const uploadDate = uploadDateRaw.includes(',') ? uploadDateRaw.split(',')[0].trim() : uploadDateRaw;

      // Pagination
      const limit = 25;
      const currentPage = window._trackingPage || 0;
      const totalPages = Math.ceil(clients.length / limit);
      const paginatedClients = clients.slice(currentPage * limit, (currentPage + 1) * limit);

      window.exportTrackingToExcel = () => {
          if (clients.length === 0) return alert('No hay datos para exportar');
          let csvContent = "data:text/csv;charset=utf-8,";
          csvContent += "Fecha Carga,Fecha Entrega,Agencia,Cliente,Pedido,Estado,Cobro Flete\n";
          
          clients.forEach(c => {
              const fechaEnt = c.statusDate ? new Date(c.statusDate).toLocaleDateString('es-ES') : '';
              const row = `\"${uploadDate}\",\"${fechaEnt}\",\"${c.agencia}\",\"${c.clientName}\",\"${c.pedido}\",\"${c.status}\",\"${c.cobroFlete}\"`;
              csvContent += row + "\n";
          });
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Tracking_NoRetail_${new Date().toISOString().slice(0,10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      };

      container.innerHTML = `
        <div style="padding: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
              <div style="display:flex; gap:1rem;">
                  <button onclick="exportTrackingToExcel()" style="background:#10b981; color:white; border:none; padding:0.5rem 1rem; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.5rem; transition:0.2s;">
                      <i class="fas fa-file-excel"></i> Exportar a Excel
                  </button>
              </div>
              
              <div style="display:flex; gap:0.5rem; align-items:center;">
                  <div style="display:flex; gap:1rem; align-items:center; background:rgba(255,255,255,0.02); padding:0.5rem 1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                          <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
                          <span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">De:</span>
                          <input type="date" id="tracking_desde" value="${dateDesde}" style="background:transparent; border:none; color:#fff; font-size:0.8rem; outline:none; font-family:inherit; cursor:pointer; color-scheme:dark;">
                      </div>
                      <div style="width:1px; height:20px; background:rgba(255,255,255,0.1);"></div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                          <i class="fas fa-calendar-alt" style="color:var(--primary);"></i>
                          <span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">Hasta:</span>
                          <input type="date" id="tracking_hasta" value="${dateHasta}" style="background:transparent; border:none; color:#fff; font-size:0.8rem; outline:none; font-family:inherit; cursor:pointer; color-scheme:dark;">
                      </div>
                  </div>
                  <button id="btn_sync_tracking" style="background:#4f46e5; color:white; border:none; padding:0.5rem; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s; height: 38px; width: 38px;" title="Sincronizar de Servidor">
                      <i class="fas fa-sync-alt"></i>
                  </button>
              </div>
          </div>
          
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse; color:#e2e8f0; font-size:0.85rem; text-align:left;">
                  <thead>
                      <tr style="background:rgba(255,255,255,0.05); text-transform:uppercase; font-size:0.7rem; color:#94a3b8;">
                          <th style="padding:1rem;">Fecha Carga</th>
                          <th style="padding:1rem;">Fecha Entrega</th>
                          <th style="padding:1rem;">Agencia</th>
                          <th style="padding:1rem;">Cliente / Pedido</th>
                          <th style="padding:1rem;">Estado</th>
                          <th style="padding:1rem;">Cobro Flete</th>
                          <th style="padding:1rem; text-align:center;">Fotos</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${paginatedClients.length === 0 ? `<tr><td colspan="7" style="padding:2rem; text-align:center; color:#64748b;">No hay clientes en seguimiento.</td></tr>` : 
                      paginatedClients.map(c => `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                              <td style="padding:1rem;">
                                  <div style="font-weight:900; color:#fff; font-size:0.8rem;">${uploadDate}</div>
                              </td>
                              <td style="padding:1rem;">
                                  <div style="font-weight:700; color:#38bdf8;">${c.statusDate ? new Date(c.statusDate).toLocaleDateString('es-ES') : '-'}</div>
                              </td>
                              <td style="padding:1rem;">
                                  <div style="font-size:0.8rem; font-weight:800; color:#94a3b8;">${c.agencia || '-'}</div>
                              </td>
                              <td style="padding:1rem;">
                                  <div style="font-weight:700; color:#bfdbfe;">${c.clientName}</div>
                                  <div style="font-size:0.75rem; color:#94a3b8;">Pedido: ${c.pedido}</div>
                              </td>
                              <td style="padding:1rem;">
                                  <span style="padding:0.3rem 0.6rem; border-radius:4px; font-size:0.7rem; font-weight:800; background:${c.status === 'ATENDIDO' ? 'rgba(34,197,94,0.15)' : c.status === 'NO ATENDIDO' ? 'rgba(239,68,68,0.15)' : c.status === 'REPROGRAMAR' ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)'}; color:${c.status === 'ATENDIDO' ? '#4ade80' : c.status === 'NO ATENDIDO' ? '#f87171' : c.status === 'REPROGRAMAR' ? '#facc15' : '#94a3b8'}; border:1px solid ${c.status === 'ATENDIDO' ? 'rgba(34,197,94,0.3)' : c.status === 'NO ATENDIDO' ? 'rgba(239,68,68,0.3)' : c.status === 'REPROGRAMAR' ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.1)'};">
                                      ${c.status}
                                  </span>
                              </td>
                              <td style="padding:1rem;">
                                  ${c.cobroFlete === 'SI' ? '<span style="color:#10b981; font-weight:800;"><i class="fas fa-check"></i> SI</span>' : '<span style="color:#64748b;">NO</span>'}
                              </td>
                              <td style="padding:1rem; text-align:center;">
                                  <div style="display:flex; justify-content:center; gap:0.5rem;">
                                      ${c.fotoCargo ? `<img src="${c.fotoCargo}" class="btn-preview-tracking-photo" data-title="FOTO CARGO G.R. FIRMADO" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" title="Ver Foto Cargo">` : '<div style="width:36px; height:36px; border-radius:4px; border:1px dashed rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.1); font-size:0.6rem;" title="Sin Cargo"><i class="fas fa-camera"></i></div>'}
                                      ${c.fotoLocal ? `<img src="${c.fotoLocal}" class="btn-preview-tracking-photo" data-title="FOTO FACHADA LOCAL" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" title="Ver Foto Fachada">` : '<div style="width:36px; height:36px; border-radius:4px; border:1px dashed rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.1); font-size:0.6rem;" title="Sin Fachada"><i class="fas fa-camera"></i></div>'}
                                  </div>
                              </td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
              
              <!-- Paginación -->
              ${totalPages > 1 ? `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; background:rgba(0,0,0,0.2); border-top:1px solid rgba(255,255,255,0.05);">
                  <div style="color:var(--text-muted); font-size:0.8rem;">
                      Mostrando ${currentPage * limit + 1} - ${Math.min((currentPage + 1) * limit, clients.length)} de ${clients.length} registros
                  </div>
                  <div style="display:flex; gap:0.5rem;">
                      <button id="btn_track_prev" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:0.4rem 0.8rem; border-radius:4px; cursor:${currentPage === 0 ? 'not-allowed' : 'pointer'}; opacity:${currentPage === 0 ? '0.5' : '1'};">
                          <i class="fas fa-chevron-left"></i> Anterior
                      </button>
                      <button id="btn_track_next" style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); padding:0.4rem 0.8rem; border-radius:4px; cursor:${currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer'}; opacity:${currentPage >= totalPages - 1 ? '0.5' : '1'};">
                          Siguiente <i class="fas fa-chevron-right"></i>
                      </button>
                  </div>
              </div>` : ''}
          </div>
        </div>
      `;

      document.getElementById('tracking_desde')?.addEventListener('change', (e) => {
          window._trackingFilterDesde = e.target.value;
          window._trackingPage = 0; // Reset page on filter
          renderTrackingNoRetailPortal(container);
      });
      document.getElementById('tracking_hasta')?.addEventListener('change', (e) => {
          window._trackingFilterHasta = e.target.value;
          window._trackingPage = 0; // Reset page on filter
          renderTrackingNoRetailPortal(container);
      });
      
      document.getElementById('btn_sync_tracking')?.addEventListener('click', async () => {
          window._noRetailClients = null;
          await renderTrackingNoRetailPortal(container);
      });

      container.querySelectorAll('.btn-preview-tracking-photo').forEach(img => {
          img.addEventListener('click', () => {
              openImageModal(img.src, img.getAttribute('data-title'));
          });
      });
      
      document.getElementById('btn_track_prev')?.addEventListener('click', () => {
          if (currentPage > 0) {
              window._trackingPage = currentPage - 1;
              renderTrackingNoRetailPortal(container);
          }
      });
      document.getElementById('btn_track_next')?.addEventListener('click', () => {
          if (currentPage < totalPages - 1) {
              window._trackingPage = currentPage + 1;
              renderTrackingNoRetailPortal(container);
          }
      });
  };
  const renderDespachoNoRetailPortal = async (container) => {
    const isMobile = window.innerWidth <= 768;
    const isDriverRole = user.role === 'transporte' || user.role === 'transportista' || user.role === 'chofer' || 
                         ((user.role !== 'admin' && user.role !== 'jefe') && (rolePermissions['transporte'] === 1 || rolePermissions['Transporte'] === 1));
    const hideFrame = isMobile || isDriverRole;
    const showBackToOffice = hideFrame && !isDriverRole;

    if (hideFrame) {
        document.body.classList.add('mobile-driver-active');
    } else {
        document.body.classList.remove('mobile-driver-active');
    }

    const clientsData = await fetchAndParseNoRetailClients();

    // Remove old debug div if exists
    const oldDebug = document.getElementById('nr_debug_floater');
    if (oldDebug) oldDebug.remove();

    if (!window._noRetailActiveTab) window._noRetailActiveTab = 'inicio';
    if (!window._noRetailSearchQuery) window._noRetailSearchQuery = '';
    if (!window._noRetailExpandedAgencies) window._noRetailExpandedAgencies = {};

    const refreshNoRetailUI = () => {
        const activeTab = window._noRetailActiveTab;
        const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const capitalizedToday = today.charAt(0).toUpperCase() + today.slice(1);

        const clients = window._noRetailClients || [];
        
        const countRealPedidos = (arr) => arr.reduce((acc, c) => {
            const pStr = String(c.pedido || '').trim();
            if (!pStr) return acc + 1;
            const count = pStr.split(';').map(s => s.trim()).filter(s => s).length;
            return acc + (count > 0 ? count : 1);
        }, 0);

        const totalCount = countRealPedidos(clients);
        const pendingCount = countRealPedidos(clients.filter(c => c.status === 'PENDIENTE'));

        container.innerHTML = `
            ${showBackToOffice ? `
            <!-- Simulation back to office bar for admin testing -->
            <div style="background: rgba(15,23,42,0.95); padding: 0.6rem 1rem; width:100%; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index:999999; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                <span style="font-size:0.65rem; color:#f59e0b; font-weight:800; letter-spacing:0.5px;">📲 VISTA PORTAL MÓVIL NO RETAIL</span>
                <button id="btn_back_to_office" style="background:#4f46e5; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.65rem; font-weight:800; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#4338ca'" onmouseout="this.style.background='#4f46e5'">
                    🏢 VOLVER A OFICINA
                </button>
            </div>
            ` : ''}

            <div style="display:flex; flex-direction:column; align-items:center; width:100%; padding:${hideFrame ? '0' : '1rem 0'};">
                ${hideFrame ? '' : `
                <!-- Simulation info -->
                <div style="max-width:380px; width:100%; text-align:center; color:var(--text-muted); font-size:0.75rem; margin-bottom:1.5rem; line-height:1.4;">
                    <span style="color:#eab308; font-weight:800;">⚡ PORTAL MÓVIL NO RETAIL 📲</span><br>
                    Usa este portal móvil para actuar como transportista. Los cambios realizados aquí se verán reflejados de inmediato.
                </div>
                `}

                <!-- Smartphone Mock Frame / Mobile Direct Screen -->
                <div style="${hideFrame ? `
                    width: 100%;
                    background: #0b1329;
                    position: relative;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                ` : `
                    max-width: 380px;
                    width: 100%;
                    background: #0b1329;
                    border: 10px solid #1e293b;
                    border-radius: 36px;
                    padding: 1.25rem 1rem;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
                    position: relative;
                    overflow: hidden;
                    border-bottom-width: 14px;
                    display: flex;
                    flex-direction: column;
                    min-height: 720px;
                `}">
                    
                    <!-- Top Bar of portal -->
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.2rem 0.5rem 0.6rem; background:#0b1329; border-bottom:1px solid rgba(255,255,255,0.03); margin-bottom:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.8rem;">
                            <span style="font-size:1.2rem; cursor:pointer; color:var(--primary); font-weight:800;" id="btn_nr_menu">☰</span>
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-size:1rem; font-weight:900; color:#fff; letter-spacing:0.5px;" id="nr_top_title">
                                    Deam1830
                                </span>
                                <span style="font-size:0.6rem; color:rgba(255,255,255,0.45); font-weight:700;">👤 ${user.name}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.8rem; align-items:center;">
                            <div style="position:relative; width:24px; height:24px; display:flex; justify-content:center; align-items:center;">
                                <span style="font-size:1.2rem; cursor:pointer;" id="btn_nr_cal">📅</span>
                                <input type="date" id="nr_date_filter" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
                            </div>
                            <div style="position:relative; width:24px; height:24px; display:flex; justify-content:center; align-items:center;" id="btn_nr_logout" title="Cerrar Sesión">
                                <span style="font-size:1.2rem; cursor:pointer; color:#ef4444;">🚪</span>
                            </div>
                        </div>
                    </div>

                    <div style="flex-grow:1; overflow-y:auto; padding-bottom: 4.5rem;" id="nr_content_wrapper">
                        ${renderActiveTabContent(activeTab, capitalizedToday, pendingCount, totalCount)}
                        <div style="text-align: center; margin-top: 2rem; margin-bottom: 1.5rem; font-size: 0.65rem; color: rgba(255,255,255,0.25); font-weight: 700; letter-spacing: 0.05em;">
                            SYSTEM BUILD: v26.5.121 | MOBILE PORTAL
                        </div>
                    </div>

                    <!-- Glass Bottom Bar Navigation -->
                    <div style="
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        background: rgba(15, 23, 42, 0.95);
                        backdrop-filter: blur(16px);
                        border-top: 1.5px solid rgba(255, 255, 255, 0.08);
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        padding: 0.6rem 0.5rem;
                        z-index: 10010;
                        box-sizing: border-box;
                    ">
                        <div class="nr-nav-item" data-tab="inicio" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'inicio' ? 1 : 0.4};">
                            <div style="
                                background: ${activeTab === 'inicio' ? 'var(--primary)' : 'transparent'};
                                width: ${activeTab === 'inicio' ? '46px' : 'auto'};
                                height: 28px;
                                border-radius: 14px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            ">
                                <span style="font-size:1.2rem; color:${activeTab === 'inicio' ? '#fff' : '#cbd5e1'};">🏠</span>
                            </div>
                            <span style="font-size:0.65rem; font-weight:800; color:${activeTab === 'inicio' ? '#fff' : '#cbd5e1'};">Inicio</span>
                        </div>

                        <div class="nr-nav-item" data-tab="historial" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'historial' ? 1 : 0.4};">
                            <div style="
                                background: ${activeTab === 'historial' ? 'var(--primary)' : 'transparent'};
                                width: ${activeTab === 'historial' ? '46px' : 'auto'};
                                height: 28px;
                                border-radius: 14px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            ">
                                <span style="font-size:1.2rem; color:${activeTab === 'historial' ? '#fff' : '#cbd5e1'};">🔄</span>
                            </div>
                            <span style="font-size:0.65rem; font-weight:800; color:${activeTab === 'historial' ? '#fff' : '#cbd5e1'};">Historial</span>
                        </div>

                        <div class="nr-nav-item" data-tab="en_ruta" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'en_ruta' ? 1 : 0.4};">
                            <div style="
                                background: ${activeTab === 'en_ruta' ? 'var(--primary)' : 'transparent'};
                                width: ${activeTab === 'en_ruta' ? '46px' : 'auto'};
                                height: 28px;
                                border-radius: 14px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            ">
                                <span style="font-size:1.2rem; color:${activeTab === 'en_ruta' ? '#fff' : '#cbd5e1'};">🚚</span>
                            </div>
                            <span style="font-size:0.65rem; font-weight:800; color:${activeTab === 'en_ruta' ? '#fff' : '#cbd5e1'};">En Ruta</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire bottom navigation events
        document.querySelectorAll('.nr-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                window._noRetailActiveTab = e.currentTarget.dataset.tab;
                refreshNoRetailUI();
            });
        });

        // Search action
        const searchInput = document.getElementById('nr_search_input');
        if (searchInput) {
            searchInput.value = window._noRetailSearchQuery;
            searchInput.addEventListener('input', (e) => {
                window._noRetailSearchQuery = e.target.value.toLowerCase();
                filterHistoryItems();
            });
        }

        // Accordion expand/collapse
        document.querySelectorAll('.nr-accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const body = e.currentTarget.nextElementSibling;
                const icon = e.currentTarget.querySelector('.nr-chevron');
                if (body.style.display === 'none' || !body.style.display) {
                    body.style.display = 'block';
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    body.style.display = 'none';
                    icon.style.transform = 'rotate(0deg)';
                }
            });
        });

        // En Ruta Agency Card click to desglosar clientes
        document.querySelectorAll('.nr-agency-card-header').forEach(card => {
            card.addEventListener('click', (e) => {
                const agencyName = e.currentTarget.dataset.agency;
                window._noRetailExpandedAgencies[agencyName] = !window._noRetailExpandedAgencies[agencyName];
                refreshNoRetailUI();
            });
        });

        // Cobro Flete option toggles
        document.querySelectorAll('.nr-flete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cId = e.currentTarget.dataset.client;
                const val = e.currentTarget.dataset.val;
                const c = window._noRetailClients.find(x => x.id === cId);
                if (c) {
                    c.cobroFlete = val;
                    refreshNoRetailUI();
                }
            });
        });

        // Status selection buttons
        document.querySelectorAll('.nr-status-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cId = e.currentTarget.dataset.client;
                const status = e.currentTarget.dataset.status;
                const c = window._noRetailClients.find(x => x.id === cId);
                if (c) {
                    c._tempStatus = status;
                    refreshNoRetailUI();
                }
            });
        });
        
        // Date filter
        const dateInput = document.getElementById('nr_date_filter');
        if (dateInput) {
            if (window._noRetailHistorialDate) dateInput.value = window._noRetailHistorialDate;
            dateInput.addEventListener('change', (e) => {
                window._noRetailHistorialDate = e.target.value;
                if (window._noRetailActiveTab !== 'historial') {
                    window._noRetailActiveTab = 'historial';
                }
                refreshNoRetailUI();
            });
        }

        // Photo file input change handlers
        document.querySelectorAll('.nr-photo-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const cId = e.currentTarget.dataset.client;
                const type = e.currentTarget.dataset.type; // 'cargo' or 'local'
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            // Compress image using canvas
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 1024;
                            const MAX_HEIGHT = 1024;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > height) {
                                if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                }
                            } else {
                                if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // Convert to jpeg with 0.7 quality for sharp readability (~70-120KB)
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            
                            const c = window._noRetailClients.find(x => x.id === cId);
                            if (c) {
                                if (type === 'cargo') c.fotoCargo = compressedDataUrl;
                                else c.fotoLocal = compressedDataUrl;
                                refreshNoRetailUI();
                            }
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        });

        // Liquidar button
        document.querySelectorAll('.btn-nr-liquidar-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cId = e.currentTarget.dataset.client;
                const c = window._noRetailClients.find(x => x.id === cId);
                if (c) {
                    const currentStatus = c._tempStatus || c.status;
                    if (currentStatus === 'PENDIENTE') {
                        showPremiumAlert('SELECCIONA UN ESTADO', 'Debes seleccionar un estado diferente de PENDIENTE para liquidar (ATENDIDO, NO ATENDIDO o REPROGRAMAR).', 'warning');
                        return;
                    }
                    if (!c.fotoCargo) {
                        showPremiumAlert('FOTO OBLIGATORIA', 'Es obligatorio tomar la foto de los cargos para poder liquidar el cliente.', 'warning');
                        return;
                    }
                    // Liquidate successfully
                    c.status = currentStatus;
                    c.statusDate = new Date().toISOString();
                    c.liquidated = true;
                    
                    let finalCache = {};
                    try {
                         let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                         if (Array.isArray(cache)) cache = {};
                         cache[c.id] = { 
                             status: c.status, 
                             date: c.statusDate, 
                             liquidated: true,
                             cobroFlete: c.cobroFlete,
                             fotoCargo: c.fotoCargo,
                             fotoLocal: c.fotoLocal
                         };
                         localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
                         finalCache = cache;
                    } catch(err) {
                         console.error("Cache storage limit reached, saving without photos in local storage:", err);
                         try {
                             let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                             if (Array.isArray(cache)) cache = {};
                             cache[c.id] = { 
                                 status: c.status, 
                                 date: c.statusDate, 
                                 liquidated: true,
                                 cobroFlete: c.cobroFlete
                             };
                             localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
                             finalCache = cache;
                         } catch(err2) {
                             console.error("Could not write even status to localStorage:", err2);
                         }
                    }

                    // Construct delta for the current client to keep request payload small
                    const delta = {};
                    delta[c.id] = { 
                        status: c.status, 
                        date: c.statusDate, 
                        liquidated: true,
                        cobroFlete: c.cobroFlete,
                        fotoCargo: c.fotoCargo,
                        fotoLocal: c.fotoLocal
                    };

                    // Push tracking updates to backend server (delta merge on backend)
                    fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify(delta)
                    })
                    .then(res => {
                         if (!res.ok) console.error("Server cache sync failed:", res.statusText);
                    })
                    .catch(err => console.error("Sync to server failed:", err));
                    
                    showPremiumAlert('CLIENTE LIQUIDADO', `El cliente ${c.clientName} ha sido liquidado correctamente.`, 'success');
                    refreshNoRetailUI();
                }
            });
        });

        // Back to Office simulator button
        document.getElementById('btn_back_to_office')?.addEventListener('click', () => {
            localStorage.setItem(`activeSub_no_retail`, 'archivo_no_retail');
            updateMobileDriverClass();
            renderTabContent();
        });

        // Menu icon back to office
                document.getElementById('btn_nr_menu').addEventListener('click', async () => {
            if (await showPremiumConfirm('VOLVER AL PANEL', '¿Estás seguro de regresar al panel general?', 'info')) {
                document.body.classList.remove('mobile-driver-active');
                window.location.reload();
            }
        });

        // Logout
        document.getElementById('btn_nr_logout')?.addEventListener('click', async () => {
            if (await showPremiumConfirm('CERRAR SESIÓN', '¿Estás seguro que deseas cerrar sesión?', 'warning')) {
                onLogout();
            }
        });
    };

    const renderActiveTabContent = (tab, dateStr, pendingCount, totalCount) => {
        const clients = window._noRetailClients || [];
        const pendingAgenciesCount = [...new Set(clients.filter(c => c.status === 'PENDIENTE').map(c => c.agencia))].length;

        const countRealPedidos = (arr) => arr.reduce((acc, c) => {
            const pStr = String(c.pedido || '').trim();
            if (!pStr) return acc + 1;
            const count = pStr.split(';').map(s => s.trim()).filter(s => s).length;
            return acc + (count > 0 ? count : 1);
        }, 0);
        const liquidatedCount = countRealPedidos(clients.filter(c => c.status !== 'PENDIENTE'));

        if (tab === 'inicio') {
            return `
                <div style="font-size: 1.5rem; font-weight: 800; color: #fff; margin-bottom: 0.2rem;">Panel de Control</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">${dateStr}</div>

                <!-- Stats Grid (Hoy vs Liquidados vs Total) -->
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.6rem; margin-bottom:1.5rem;">
                    <!-- Hoy Card -->
                    <div style="background:linear-gradient(135deg, #024dbd 0%, #00368a 100%); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative; box-shadow: 0 4px 15px rgba(2, 77, 189, 0.2);">
                        <span style="font-size:0.55rem; color:#93c5fd; font-weight:800; letter-spacing:0.5px;">HOY (PEND.)</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#fff; line-height:1; margin: 0.2rem 0;">${pendingAgenciesCount}</span>
                        <span style="font-size:0.55rem; color:#bfdbfe; font-weight:600; line-height:1.2;">Agencias</span>
                        <span style="position:absolute; right:8px; top:8px; font-size:1.2rem; opacity:0.15; user-select:none;">🚚</span>
                    </div>

                    <!-- Liquidados Card -->
                    <div style="background:linear-gradient(135deg, #10b981 0%, #047857 100%); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);">
                        <span style="font-size:0.55rem; color:#a7f3d0; font-weight:800; letter-spacing:0.5px;">LIQUIDADOS</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#fff; line-height:1; margin: 0.2rem 0;">${liquidatedCount}</span>
                        <span style="font-size:0.55rem; color:#d1fae5; font-weight:600; line-height:1.2;">Firmados</span>
                        <span style="position:absolute; right:8px; top:8px; font-size:1.2rem; opacity:0.15; user-select:none;">✍️</span>
                    </div>

                    <!-- Acumulado Card -->
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative;">
                        <span style="font-size:0.55rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px;">TOTAL</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#fff; line-height:1; margin: 0.2rem 0;">${totalCount}</span>
                        <span style="font-size:0.55rem; color:var(--text-muted); font-weight:600; line-height:1.2;">Pedidos</span>
                        <span style="position:absolute; right:8px; top:8px; font-size:1.2rem; opacity:0.05; user-select:none;">📋</span>
                    </div>
                </div>
            `;
        }

        if (tab === 'historial') {
            const filterDate = window._noRetailHistorialDate;
            const now = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            
            // Filter clients
            const validStatuses = ['ATENDIDO', 'NO ATENDIDO', 'REPROGRAMAR'];
            const historyClients = clients.filter(c => validStatuses.includes(c.status) && c.statusDate);

            // Group dynamically by Day -> Agency -> Clients
            const grouped = {};
            
            historyClients.forEach(c => {
                const cDate = new Date(c.statusDate);
                let include = false;
                if (filterDate) {
                    const fD = new Date(filterDate + 'T00:00:00');
                    if (cDate.getFullYear() === fD.getFullYear() && cDate.getMonth() === fD.getMonth() && cDate.getDate() === fD.getDate()) {
                        include = true;
                    }
                } else {
                    if (cDate >= sevenDaysAgo) {
                        include = true;
                    }
                }

                if (include) {
                    const dayStr = cDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    const capDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
                    if (!grouped[capDay]) grouped[capDay] = {};
                    if (!grouped[capDay][c.agencia]) grouped[capDay][c.agencia] = [];
                    grouped[capDay][c.agencia].push(c);
                }
            });

            return `
                <div style="position:relative; margin-bottom:1.5rem;">
                    <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:0.9rem; color:rgba(255,255,255,0.3);">🔍</span>
                    <input type="text" id="nr_search_input" placeholder="Buscar por fecha o agencia" value="${window._noRetailSearchQuery || ''}" style="width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#fff; padding:0.65rem 0.65rem 0.65rem 2.2rem; font-size:0.8rem; outline:none; box-sizing:border-box;">
                </div>

                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px; margin-bottom:0.8rem;">
                    HISTORIAL DE ACTIVIDAD ${filterDate ? `(Filtrado: ${filterDate})` : '(Últimos 7 días)'}
                </div>

                <div style="display:flex; flex-direction:column; gap:0.8rem; margin-bottom:1.5rem;" id="nr_history_accordion_list">
                    ${Object.keys(grouped).length === 0 ? `<div style="text-align:center; color:rgba(255,255,255,0.4); font-size:0.8rem; padding: 2rem 0;">No hay registros para este periodo.</div>` : ''}
                    ${Object.entries(grouped).map(([day, agencies]) => `
                        <div class="nr-history-row" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:16px; overflow:hidden; margin-bottom:0.5rem;">
                            <div class="nr-accordion-header" style="padding:1rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                <div>
                                    <div style="font-size:0.85rem; font-weight:800; color:#fff;">${day}</div>
                                </div>
                                <span class="nr-chevron" style="font-size:0.8rem; color:rgba(255,255,255,0.3); transition:transform 0.2s;">▼</span>
                            </div>
                            <div class="nr-accordion-body" style="display:none; padding:0.5rem 1rem 1rem; border-top:1px solid rgba(255,255,255,0.03); background:rgba(0,0,0,0.15);">
                                ${Object.entries(agencies).map(([agency, cList]) => `
                                    <div style="margin-left:0.5rem; margin-bottom:0.6rem; border-left:2px solid rgba(255,255,255,0.05); padding-left:0.6rem;">
                                        <div style="font-size:0.7rem; font-weight:700; color:#fff; display:flex; justify-content:space-between;">
                                            <span>🏢 ${agency}</span>
                                            <span style="color:var(--text-muted);">${cList.length} Clientes</span>
                                        </div>
                                        
                                        <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.2rem;">
                                            ${cList.map(c => `
                                                <div style="font-size:0.65rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                                                    <span>👤 ${c.clientName} (${c.pedido})</span>
                                                    <span style="color:${c.status === 'ATENDIDO' ? '#22c55e' : c.status === 'PENDIENTE' ? '#eab308' : '#ef4444'}; font-weight:700;">
                                                        ${c.status}
                                                    </span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (tab === 'en_ruta') {
            const countRealPedidos = (arr) => arr.reduce((acc, c) => {
                const pStr = String(c.pedido || '').trim();
                if (!pStr) return acc + 1;
                const count = pStr.split(';').map(s => s.trim()).filter(s => s).length;
                return acc + (count > 0 ? count : 1);
            }, 0);

            const pendingClients = clients.filter(c => c.status === 'PENDIENTE');
            
            // Group dynamically by Agency -> Clients
            const groupedAgencies = {};
            pendingClients.forEach(c => {
                const ag = c.agencia || 'Sin Agencia';
                if (!groupedAgencies[ag]) groupedAgencies[ag] = [];
                groupedAgencies[ag].push(c);
            });
            
            const activeAgenciesCount = Object.keys(groupedAgencies).length;
            const agPendingCount = pendingClients.length;

            const meta = getUploadMeta('archivo_no_retail') || {};
            const uploadDate = meta.timestamp || (meta.ts ? new Date(meta.ts).toLocaleString() : 'Fecha Desconocida');
            
            return `
                <!-- Top stats -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:1.5rem;">
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:0.8rem 1rem; display:flex; flex-direction:column; justify-content:center;">
                        <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">Agencias Activas</span>
                        <span style="font-size:1.4rem; font-weight:900; color:#3b82f6; margin-top:2px;">
                            ${activeAgenciesCount.toString().padStart(2, '0')}
                        </span>
                    </div>

                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:0.8rem 1rem; display:flex; flex-direction:column; justify-content:center;">
                        <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">Total Pendientes</span>
                        <span style="font-size:1.4rem; font-weight:900; color:#10b981; margin-top:2px;">${agPendingCount}</span>
                    </div>
                </div>

                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:800; letter-spacing:0.5px; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.4rem;">AGENCIAS EN RUTA (PENDIENTES)</div>
                <div style="font-size:0.85rem; font-weight:800; color:#eab308; margin-bottom:1rem;">
                    📅 FECHA DE CARGA: ${uploadDate}
                </div>

                <div style="display:flex; flex-direction:column; gap:1.5rem;">
                    ${Object.keys(groupedAgencies).length === 0 ? `<div style="text-align:center; color:rgba(255,255,255,0.4); font-size:0.8rem; padding: 2rem 0;">No hay pedidos pendientes en ruta.</div>` : ''}
                    <div style="display:flex; flex-direction:column; gap:1rem;">
                        ${Object.entries(groupedAgencies).map(([agName, agClients]) => {
                            const agPending = countRealPedidos(agClients);
                            const expandedKey = agName.replace(/\W/g, '');
                            const isExpanded = !!window._noRetailExpandedAgencies[expandedKey];
                            
                            return `
                                <div style="
                                    background: rgba(255,255,255,0.02);
                                    border: 1px solid ${isExpanded ? 'rgba(2, 77, 189, 0.4)' : 'rgba(255, 255, 255, 0.04)'};
                                    border-radius: 18px;
                                    padding: 1.2rem;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 0.8rem;
                                ">
                                    <!-- Agency Header (Click to toggle desglosar) -->
                                    <div class="nr-agency-card-header" data-agency="${expandedKey}" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                        <div>
                                            <span style="font-size:0.95rem; font-weight:900; color:#fff; display:block;">${agName}</span>
                                            <span style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">📍 Clic para desglosar clientes</span>
                                        </div>
                                        <span class="badge status-warning" style="font-size:0.6rem; padding:3px 10px; border-radius:12px;">
                                            ${agPending} Pendientes
                                        </span>
                                    </div>

                                    <!-- Clients list (desglosado) -->
                                    ${isExpanded ? `
                                        <div style="display:flex; flex-direction:column; gap:1rem; margin-top:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1rem;">
                                            <div style="font-size:0.7rem; font-weight:800; color:#eab308; margin-bottom:0.2rem;">👤 LISTADO DE CLIENTES A LIQUIDAR:</div>
                                            
                                            ${agClients.map(c => `
                                                <div style="
                                                    background: rgba(0, 0, 0, 0.2);
                                                    border: 1px solid ${c.liquidated ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.03)'};
                                                    border-radius: 12px;
                                                    padding: 0.9rem;
                                                ">
                                                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                        <div>
                                                            <span style="font-size:0.75rem; font-weight:800; color:#fff; display:block;">${c.clientName}</span>
                                                            <span style="font-size:0.6rem; color:var(--text-muted);">Pedido: ${c.pedido} | 📍 ${c.address}</span>
                                                        </div>
                                                        <span class="badge ${c.liquidated ? 'status-success' : 'status-warning'}" style="font-size:0.55rem; padding:1px 6px;">
                                                            ${c.liquidated ? c.status : 'PENDIENTE'}
                                                        </span>
                                                    </div>

                                                    ${!c.liquidated ? `
                                                        <!-- Liquidation Form -->
                                                        <div style="display:flex; flex-direction:column; gap:0.8rem; margin-top:0.8rem; border-top:1px dashed rgba(255,255,255,0.05); padding-top:0.8rem;">
                                                            <!-- Cobro Flete (SI/NO) selector -->
                                                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                                                <span style="font-size:0.65rem; color:#fff; font-weight:700;">💰 COBRO FLETE:</span>
                                                                <div style="display:flex; background:rgba(255,255,255,0.03); border-radius:8px; padding:2px; border:1px solid rgba(255,255,255,0.05);">
                                                                    <button class="nr-flete-btn" data-client="${c.id}" data-val="SI" style="background:${c.cobroFlete === 'SI' ? '#024dbd' : 'transparent'}; color:#fff; border:none; padding:3px 10px; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">SI</button>
                                                                    <button class="nr-flete-btn" data-client="${c.id}" data-val="NO" style="background:${c.cobroFlete === 'NO' ? '#024dbd' : 'transparent'}; color:#fff; border:none; padding:3px 10px; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">NO</button>
                                                                </div>
                                                            </div>

                                                            <!-- Status Buttons selection -->
                                                            <div>
                                                                <div style="font-size:0.65rem; color:#fff; font-weight:700; margin-bottom:0.3rem;">📋 ESTADO DE ENTREGA:</div>
                                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                                                    <button class="nr-status-select-btn" data-client="${c.id}" data-status="ATENDIDO" style="background:${(c._tempStatus || c.status) === 'ATENDIDO' ? '#22c55e' : 'rgba(255,255,255,0.03)'}; color:${(c._tempStatus || c.status) === 'ATENDIDO' ? '#fff' : 'rgba(255,255,255,0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'ATENDIDO' ? '#22c55e' : 'rgba(255,255,255,0.08)'}; padding:5px 0; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">ATENDIDO</button>
                                                                    <button class="nr-status-select-btn" data-client="${c.id}" data-status="NO ATENDIDO" style="background:${(c._tempStatus || c.status) === 'NO ATENDIDO' ? '#ef4444' : 'rgba(255,255,255,0.03)'}; color:${(c._tempStatus || c.status) === 'NO ATENDIDO' ? '#fff' : 'rgba(255,255,255,0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'NO ATENDIDO' ? '#ef4444' : 'rgba(255,255,255,0.08)'}; padding:5px 0; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer;">NO ATENDIDO</button>
                                                                    <button class="nr-status-select-btn" data-client="${c.id}" data-status="REPROGRAMAR" style="background:${(c._tempStatus || c.status) === 'REPROGRAMAR' ? '#eab308' : 'rgba(255,255,255,0.03)'}; color:${(c._tempStatus || c.status) === 'REPROGRAMAR' ? '#fff' : 'rgba(255,255,255,0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'REPROGRAMAR' ? '#eab308' : 'rgba(255,255,255,0.08)'}; padding:5px 0; border-radius:6px; font-size:0.6rem; font-weight:800; cursor:pointer; grid-column: span 2;">REPROGRAMAR</button>
                                                                </div>
                                                            </div>

                                                            <!-- Two Photo Slots -->
                                                            <div>
                                                                <div style="font-size:0.65rem; color:#fff; font-weight:700; margin-bottom:0.4rem;">📸 FOTOS OBLIGATORIAS DE CARGO Y FACHADA:</div>
                                                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                                                                    <!-- Photo Cargo -->
                                                                    <label style="background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
                                                                        ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:0.6rem; color:rgba(255,255,255,0.4); font-weight:700;">📸 FOTO CARGO</span>`}
                                                                        <input type="file" accept="image/*" capture="environment" class="nr-photo-input" data-client="${c.id}" data-type="cargo" style="display:none;">
                                                                    </label>

                                                                    <!-- Photo Fachada -->
                                                                    <label style="background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
                                                                        ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:0.6rem; color:rgba(255,255,255,0.4); font-weight:700;">📸 FOTO FACHADA</span>`}
                                                                        <input type="file" accept="image/*" capture="environment" class="nr-photo-input" data-client="${c.id}" data-type="local" style="display:none;">
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <!-- Save Button -->
                                                            <button class="btn btn-nr-liquidar-client" data-client="${c.id}" style="width:100%; background:#10b981; border:none; padding:0.6rem; border-radius:8px; font-size:0.7rem; font-weight:800; color:#fff; cursor:pointer; transition:background 0.2s;">
                                                                ✅ LIQUIDAR CLIENTE
                                                            </button>
                                                        </div>
                                                    ` : `
                                                        <!-- Summary of liquidated client -->
                                                        <div style="margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:0.65rem; color:var(--text-muted);">
                                                            <div>💰 Cobro Flete: <strong style="color:#fff;">${c.cobroFlete}</strong></div>
                                                            <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                                                                ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                                ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                                                            </div>
                                                        </div>
                                                    `}
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

    };

    const filterHistoryItems = () => {
        const query = window._noRetailSearchQuery;
        document.querySelectorAll('.nr-history-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(query)) {
                row.style.display = 'block';
            } else {
                row.style.display = 'none';
            }
        });
    };

    refreshNoRetailUI();
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
    let progressModal;
    try {
        const stock = await getAreaData('almacenaje_activo');
        const maestro = dataStore.articulos;
        if (!stock || !stock.length) { alert("⚠️ Primero debes cargar el 'Stock Activo' en la pestaña Archivo."); return; }
        if (!maestro || !maestro.length) { alert("⚠️ Falta cargar el Maestro de Artículos."); return; }

        // --- BARRA DE PROGRESO DE PROCESAMIENTO ---
        progressModal = document.createElement('div');
        progressModal.id = "progress_processing_modal";
        progressModal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 15, 25, 0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);";
        progressModal.innerHTML = `
            <div class="glass-panel" style="width:360px; padding:2rem; border:1px solid rgba(255,255,255,0.1); border-radius:16px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); text-align:center; background: rgba(15, 23, 42, 0.85); pointer-events:auto !important;">
                <h3 style="color:#fff; margin:0 0 1.5rem 0; font-size:1.1rem; font-weight:700; letter-spacing:0.5px; font-family:'Inter', sans-serif;">Procesando Tareas</h3>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-bottom:1rem; position:relative; border: 1px solid rgba(255,255,255,0.05);">
                    <div id="progress_bar_fill" style="width:0%; height:100%; background:linear-gradient(90deg, #22c55e, #4ade80); border-radius:10px; box-shadow: 0 0 12px rgba(34, 197, 94, 0.5); transition: width 0.1s ease-out;"></div>
                </div>
                <div id="progress_percentage" style="color:#22c55e; font-weight:800; font-size:1.1rem; margin-bottom:0.5rem; font-family:'Outfit', sans-serif;">0%</div>
                <p style="color:#94a3b8; font-size:0.8rem; margin:0; letter-spacing:0.5px; font-family:'Inter', sans-serif;">Generando lote de almacenamiento...</p>
            </div>
        `;
        document.body.appendChild(progressModal);

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
                    gender: String(raw[2] || '').trim().toUpperCase(), 
                    genderRims: String(raw[3] || '').trim().toUpperCase(), 
                    coleccion: String(raw[9] || 'S/C').trim()
                });
            }
        });

        const groups = {};
        filtered.forEach(row => {
            // [COORDENADAS DANIEL v24.9.6] Ignorar nombres, usar índices directos: Col B=1, Col C=2
            const raw = Array.isArray(row) ? row : Object.values(row);
            const skuFull = String(raw[1] || '').trim(); // Columna B
            const sku7 = skuFull.substring(0, 7);
            const area = String(row['Ãrea'] || row['Area'] || row['Área'] || '').trim().toUpperCase();
            const qty = parseFloat(row['Cantidad actual'] || row['Cantidad'] || row['Cant.']) || 0;
            const ubi = String(row['Ubicación actual'] || row['Ubicacion'] || row['Ubicación'] || '').trim();
            
            // [LOGICA DANIEL v24.9.6] Extraer Talla de la Columna C (Índice 2)
            const desc = String(raw[2] || '').trim(); // Columna C
            let tallaExtraida = 'S/TALLA';
            const tallaMatch = desc.match(/-[0-9]-(.+)$/);
            if (tallaMatch) {
                tallaExtraida = tallaMatch[1].trim();
            }

            const info = artMap.get(sku7) || { marca: 'S/M', gender: 'S/G', genderRims: 'S/GR', coleccion: 'S/C' };

            if (!groups[sku7]) groups[sku7] = { sku7, marca: info.marca, gender: info.gender, genderRims: info.genderRims, coleccion: info.coleccion, items: [], bufferQty: 0, zonaQty: 0 };
            // [FIX v24.9.7] Usar skuFull para que la pantalla lo reconozca
            const item = { ubi: ubi, qty: qty, area: area, skuFull: skuFull, talla: tallaExtraida }; 
            groups[sku7].items.push(item);
            const isUbiBuffer = ubi && String(ubi).trim().toUpperCase().startsWith('CDBUFFER');
            if (area.toUpperCase().includes('CDBUFFER') || isUbiBuffer) groups[sku7].bufferQty += qty;
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
                const cleanId = t.id.includes('_') ? t.id.split('_')[1] : t.id;
                const num = parseInt(cleanId.replace('Tarea', ''));
                if (!isNaN(num)) usedNumbers.add(num);
            }
        });

        // 2. Función para obtener el siguiente ID libre
        const getNextFreeId = () => {
            let n = 1;
            while (usedNumbers.has(n)) n++;
            usedNumbers.add(n); // Reservarlo de inmediato
            return `${logicalDate}_Tarea${n}`;
        };

        const specialCategories = [
            '11 NON COMMERCIAL COMPLEMENTS',
            '08 ACCESORIES',
            '09 CLOTHING',
            '06 OTHERS',
            '10 PROMOTIONS'
        ];
        const isSpecialCategory = (gr) => {
            if (!gr) return false;
            const clean = String(gr).trim().toUpperCase();
            return specialCategories.some(cat => clean.includes(cat));
        };

        Object.keys(byMarca).forEach(marca => {
            const arts = byMarca[marca];
            
            // Separate special category articles and normal articles
            const specialArts = arts.filter(a => isSpecialCategory(a.genderRims));
            const normalArts = arts.filter(a => !isSpecialCategory(a.genderRims));

            // Group special articles by genderRims
            const specialGroups = {};
            specialArts.forEach(a => {
                const cat = String(a.genderRims || 'OTHER_SPECIAL').trim().toUpperCase();
                if (!specialGroups[cat]) specialGroups[cat] = [];
                specialGroups[cat].push(a);
            });

            // Create a single task for each special category group (just group by brand + category, no qty limit)
            Object.keys(specialGroups).forEach(cat => {
                const groupArts = specialGroups[cat];
                const totalQty = groupArts.reduce((sum, a) => sum + a.bufferQty, 0);
                finalTasks.push({ 
                    id: getNextFreeId(), 
                    marca: marca, 
                    qty: totalQty, 
                    status: 'Creada', 
                    u1: '', 
                    u2: '', 
                    inicio: '', 
                    termino: '', 
                    items: groupArts, 
                    creador: user.username, 
                    fechaProcesado: new Date().toISOString() 
                });
            });

            const bigNormals = normalArts.filter(a => a.bufferQty >= 300);
            const smallNormals = normalArts.filter(a => a.bufferQty < 300);
            
            bigNormals.forEach(a => {
                finalTasks.push({ id: getNextFreeId(), marca: marca, qty: a.bufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [a], creador: user.username, fechaProcesado: new Date().toISOString() });
            });
            
            let currentGroup = [];
            let currentBufferQty = 0;
            smallNormals.forEach((art, index) => {
                currentGroup.push(art);
                currentBufferQty += art.bufferQty;
                if (currentBufferQty >= 300 || index === smallNormals.length - 1) {
                    finalTasks.push({ id: getNextFreeId(), marca: marca, qty: currentBufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [...currentGroup], creador: user.username, fechaProcesado: new Date().toISOString() });
                    currentGroup = [];
                    currentBufferQty = 0;
                }
            });
        });

        const tasksWithDate = finalTasks.map(t => ({...t, fecha: logicalDate}));
        almacenajeTasksCache = [...almacenajeTasksCache, ...tasksWithDate];
        await saveAlmacenajeTasks(); 

        // Animar la barra de progreso de 0% a 100% de manera fluida y mostrar el mensaje final
        let currentPct = 0;
        const progressFill = progressModal.querySelector('#progress_bar_fill');
        const progressLabel = progressModal.querySelector('#progress_percentage');
        
        const interval = setInterval(() => {
            currentPct += Math.floor(Math.random() * 15) + 5;
            if (currentPct >= 100) {
                currentPct = 100;
                clearInterval(interval);
                
                setTimeout(() => {
                    if (progressModal && document.body.contains(progressModal)) {
                        document.body.removeChild(progressModal);
                    }
                    
                    // Renderizar las tareas en la tabla del fondo
                    const container = document.getElementById('areaContent') || document.querySelector('.main-content') || document.body;
                    renderAlmacenajeTareas(container);
                    
                    // Mostrar modal de éxito
                    const successModal = document.createElement('div');
                    successModal.id = "success_processing_modal";
                    successModal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11, 15, 25, 0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);";
                    successModal.innerHTML = `
                        <div class="glass-panel" style="width:400px; padding:2.5rem; border:1px solid rgba(34, 197, 94, 0.3); border-radius:20px; box-shadow: 0 0 40px rgba(34, 197, 94, 0.2); text-align:center; background: rgba(15, 23, 42, 0.95); animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); pointer-events:auto !important;">
                            <div style="width:70px; height:70px; background:rgba(34, 197, 94, 0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem auto; border:2px solid rgba(34, 197, 94, 0.3); box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h3 style="color:#fff; margin:0 0 0.5rem 0; font-size:1.4rem; font-weight:800; letter-spacing:0.5px; font-family:'Outfit', sans-serif;">Proceso Finalizado</h3>
                            <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.5rem; line-height:1.5; letter-spacing:0.3px; font-family:'Inter', sans-serif;">
                                Se ha finalizado el proceso de las tareas correctamente.<br>
                                <b style="color:#22c55e; font-size:1rem; display:block; margin-top:8px;">${tasksWithDate.length} tareas creadas</b>
                            </p>
                            <button id="btn_success_ok" class="btn" style="width:100%; padding:1rem; font-weight:800; background:linear-gradient(135deg, #22c55e, #10b981); border:none; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3); border-radius:12px; color:#fff; cursor:pointer; font-size:0.95rem; letter-spacing:0.5px; transition: all 0.2s; font-family:'Inter', sans-serif;">
                                ENTENDIDO
                            </button>
                        </div>
                        <style>
                            @keyframes zoomIn {
                                from { opacity: 0; transform: scale(0.9); }
                                to { opacity: 1; transform: scale(1); }
                            }
                        </style>
                    `;
                    document.body.appendChild(successModal);
                    successModal.querySelector('#btn_success_ok').onclick = () => {
                        if (document.body.contains(successModal)) {
                            document.body.removeChild(successModal);
                        }
                    };
                }, 300);
            }
            if (progressFill) progressFill.style.width = currentPct + '%';
            if (progressLabel) progressLabel.textContent = currentPct + '%';
        }, 80);

    } catch (e) {
        if (progressModal && document.body.contains(progressModal)) {
            document.body.removeChild(progressModal);
        }
        alert("🚨 Error de Cálculo: " + e.message);
    }
  };

  const exportAlmacenajeExcel = async () => {
    console.log("📥 [PULSE] Iniciando exportación a Excel...");
    if (!almacenajeTasksCache.length) { 
        alert("⚠️ No hay tareas en el historial para exportar."); 
        return; 
    }
    
    try {
        if (typeof ExcelJS === 'undefined') {
            throw new Error("La librería ExcelJS no está cargada. Por favor, recarga la página (Ctrl+F5).");
        }
        
        updateSyncIndicator('working', 'GENERANDO EXCEL...');
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Tareas Día', {
            properties: { tabColor: { argb: 'FF4F46E5' } },
            pageSetup: { 
                margins: { left: 0, right: 0, top: 0.5, bottom: 0, header: 0.3, footer: 0 },
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                printTitlesRow: '1:6'
            }
        });

        // Poner N° página en el centro de la cabecera
        ws.headerFooter = {
            oddHeader: "&C Página &P de &N",
            evenHeader: "&C Página &P de &N"
        };

        // 7. Configurar anchos de columna (10 columnas en total: A a J)
        ws.columns = [
            { key: 'articulo', width: 20.50 }, // A
            { key: 'ubicacion', width: 26.00 }, // B
            { key: 'sku', width: 20.50 },      // C
            { key: 'tallas', width: 10.00 },    // D
            { key: 'marcas', width: 20.50 },    // E
            { key: 'gender', width: 18.00 },    // F
            { key: 'coleccion', width: 16.00 }, // G
            { key: 'qty_buffer', width: 13.60 },// H
            { key: 'qty_zona', width: 14.29 },  // I
            { key: 'tareas', width: 15.00 }     // J (Tareas / ID)
        ];

        // 3. Toda la pestaña en fuente 16
        ws.eachRow((row) => {
            row.font = { size: 16, name: 'Calibri' };
        });

        // 1. Crear 5 filas (implícito al empezar en la 6 para el header)
        ws.getCell('A2').value = 'Nombres';
        ws.getCell('A3').value = 'Hora Inicio';
        ws.getCell('A4').value = 'Hora Término';
        ws.getCell('A5').value = new Date().toLocaleString('es-ES');

        // Altura 30.00 y alineación en el medio para filas 2, 3, 4
        [2, 3, 4].forEach(rowNum => {
            const row = ws.getRow(rowNum);
            row.height = 30.00;
            for (let col = 1; col <= 10; col++) {
                row.getCell(col).alignment = { vertical: 'middle', horizontal: 'left' };
            }
        });

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
        headerRow.values = [
            "Articulo", "UBICACION", "SKU", "Tallas", "Marcas", "Gender RIMS", "Colección", 
            "Qty Buffer", "Qty Zona", "Tareas"
        ];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Calibri' };
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Preparar datos
        const dataRows = [];
        
        // Build dynamic map of sku7 to live Column D (Gender RIMS) from maestro
        const liveGenderRimsMap = new Map();
        const activeMaestro = dataStore.articulos || [];
        activeMaestro.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const sku7 = String(raw[1] || '').trim().substring(0, 7);
            if (sku7 && !liveGenderRimsMap.has(sku7)) {
                // Column D (index 3) is Gender RIMS
                liveGenderRimsMap.set(sku7, String(raw[3] || '').trim().toUpperCase());
            }
        });

        almacenajeTasksCache.forEach(task => {
            // Filtrar tareas por rango de fechas
            if (task.fecha < window.__almacenajeStartDate || task.fecha > window.__almacenajeEndDate) return;
            if (!task.items || !Array.isArray(task.items)) return;

            task.items.forEach(art => {
                const getTalla = (sku) => (dataStore.tabla_tallas && dataStore.tabla_tallas[sku]) || sku.split('-').pop();
                
                // CDBUFFER Rows (Buffer)
                const bufferRows = (art.items || []).filter(i => i.ubi && String(i.ubi).trim().toUpperCase().startsWith('CDBUFFER'));
                // ZONA Rows (Picking, Rack, etc.)
                const zonaRows = (art.items || []).filter(i => !i.ubi || !String(i.ubi).trim().toUpperCase().startsWith('CDBUFFER'));

                // Ordenamiento por SKU / Talla para mantener consistencia visual
                const sortBySku = (a, b) => {
                    const skuA = String(a.skuFull || a.sku || '');
                    const skuB = String(b.skuFull || b.sku || '');
                    return skuA.localeCompare(skuB);
                };
                bufferRows.sort(sortBySku);
                zonaRows.sort(sortBySku);

                // Fechas formateadas
                // Agregar primero los CDBUFFER (Qty Buffer se muestra, Qty Zona vacía, Avance según estado)
                bufferRows.forEach(i => {
                    const grValue = liveGenderRimsMap.get(art.sku7) || art.genderRims || art.gender || "";
                    dataRows.push([
                        art.sku7, i.ubi, i.skuFull, getTalla(i.skuFull), art.marca, grValue, art.coleccion, 
                        i.qty, "", task.id.includes('_') ? task.id.split('_')[1] : task.id
                    ]);
                });
                // Agregar segundo las Zonas (Qty Buffer vacía, Qty Zona se muestra, Avance es "---")
                zonaRows.forEach(i => {
                    const grValue = liveGenderRimsMap.get(art.sku7) || art.genderRims || art.gender || "";
                    dataRows.push([
                        art.sku7, i.ubi, i.skuFull, getTalla(i.skuFull), art.marca, grValue, art.coleccion, 
                        "", i.qty, task.id.includes('_') ? task.id.split('_')[1] : task.id
                    ]);
                });
                // Subtotal
                dataRows.push([
                    `Total ${art.sku7}`, "", "", "", art.marca, "", "", art.bufferQty, art.zonaQty, 
                    task.id.includes('_') ? task.id.split('_')[1] : task.id
                ]);
            });
        });

        // Agregar filas de datos a partir de la fila 7
        dataRows.forEach((rowData) => {
            const row = ws.addRow(rowData);
            row.font = { size: 16, name: 'Calibri' };
            
            // Centrar columnas numéricas, de fechas y estado (H a J / 8 a 10)
            [8, 9, 10].forEach(colIdx => {
                row.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // 6. Todas las celdas que comiencen con Total, Blanco, Fondo 1 , 35 %. de la columna A hasta la P y en negrita
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
        
        updateSyncIndicator('online', 'EXCEL GENERADO ✅');
        console.log("✅ [PULSE] Excel generado con éxito.");
        setTimeout(() => updateSyncIndicator('online', `SISTEMA v${VERSION} ONLINE`), 3000);

    } catch (err) {
        console.error("❌ [PULSE] Error en exportAlmacenajeExcel:", err);
        alert("❌ Error al generar el Excel: " + err.message);
        updateSyncIndicator('offline', 'ERROR EXCEL');
    }
  };

  window.renderAlmacenajeTareas = (container) => {
    window.__almacenajeContainer = container;
    
    // Global helper for toggling chart weeks
    window.toggleChartWeek = (week) => {
        if (!window.__chartSelectedWeeks) window.__chartSelectedWeeks = [];
        const idx = window.__chartSelectedWeeks.indexOf(week);
        if (idx > -1) {
            if (window.__chartSelectedWeeks.length > 1) {
                window.__chartSelectedWeeks.splice(idx, 1);
            } else {
                window.showPremiumAlert("MÍNIMO DE SELECCIÓN", "Debe haber al menos una semana seleccionada.", "warning");
                return;
            }
        } else {
            window.__chartSelectedWeeks.push(week);
        }
        if (window.__almacenajeContainer) {
            window.renderAlmacenajeTareas(window.__almacenajeContainer);
        }
    };

    window.toggleStorageReportWeek = (week) => {
        if (!window.__expandedStorageReportWeeks) window.__expandedStorageReportWeeks = [];
        const idx = window.__expandedStorageReportWeeks.indexOf(week);
        if (idx > -1) {
            window.__expandedStorageReportWeeks.splice(idx, 1);
        } else {
            window.__expandedStorageReportWeeks.push(week);
        }
        if (window.__almacenajeContainer) {
            window.renderAlmacenajeTareas(window.__almacenajeContainer);
        }
    };

    window.setChartDateRange = (start, end) => {
        if (start !== null) window.__chartStartDate = start;
        if (end !== null) window.__chartEndDate = end;
        if (window.__almacenajeContainer) {
            window.renderAlmacenajeTareas(window.__almacenajeContainer);
        }
    };

    window.setAlmacenajeDateRange = (start, end) => {
        if (start !== null) window.__almacenajeStartDate = start;
        if (end !== null) window.__almacenajeEndDate = end;
        if (window.__almacenajeContainer) {
            window.renderAlmacenajeTareas(window.__almacenajeContainer);
        }
    };

    window.setKpiDateRange = (start, end) => {
        if (start !== null) window.__kpiStartDate = start;
        if (end !== null) window.__kpiEndDate = end;
        if (window.__almacenajeContainer) {
            window.renderAlmacenajeTareas(window.__almacenajeContainer);
        }
    };

    const renderAlmacenajeTareas = window.renderAlmacenajeTareas; // Local alias for internal calls
    const isDetail = almacenajeTaskMode === 'detalle';
    const isKpi = almacenajeTaskMode === 'kpi';
    
    const getPctHtml = (avance, buffer, withIcon = true) => {
        const pct = buffer > 0 ? Math.round((avance / buffer) * 100) : 0;
        let color = '';
        let icon = '';
        if (pct === 0) {
            color = '#ef4444'; // Rojo
            icon = '●';
        } else if (avance < buffer) {
            color = '#fbbf24'; // Ámbar / Amarillo
            icon = '▲';
        } else {
            color = '#22c55e'; // Verde
            icon = '▲';
        }
        if (withIcon) {
            return `
                <span style="color:${color}; margin-right:4px;">${icon}</span>
                <span style="color:${color}; font-size:0.75rem; font-weight:800;">${pct}%</span>
            `;
        } else {
            return `<span style="color:${color}; font-size:0.85rem; font-weight:900;">${pct}%</span>`;
        }
    };
    
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
            
            hourlyData[dateKey][hr] += parseFloat(t.qty) || 0;
        });

        const activeDates = Object.keys(hourlyData).filter(dateKey => {
            const total = targetHours.reduce((sum, hr) => sum + hourlyData[dateKey][hr], 0);
            return total > 0;
        });

        activeDates.sort((a, b) => b.localeCompare(a));

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
        <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE PRODUCCIÓN POR HORA
                </h3>
                <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                    CANTIDAD DE UNIDADES PROCESADAS POR RANGO HORARIO (TAREA FINALIZADA)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                            <th style="padding:6px 8px; text-align:left; width:80px;">FECHA</th>
                            ${targetHours.map(hr => `<th style="padding:6px 4px; text-align:center;">${hr.toString().padStart(2, '0')}:00</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:90px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activeDates.length === 0 ? `<tr><td colspan="${targetHours.length + 2}" style="padding:3rem; text-align:center; color:rgba(0, 229, 255, 0.4); font-weight:700;">No hay producción por hora registrada.</td></tr>` : activeDates.map(dateKey => {
                            const rowData = hourlyData[dateKey];
                            const rowTotal = targetHours.reduce((sum, hr) => sum + rowData[hr], 0);
                            return `
                                <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                    <td style="padding:6px 8px; color:#ffffff; font-weight:700;">${formatLogicalDate(dateKey)}</td>
                                    ${targetHours.map(hr => {
                                        const qty = rowData[hr];
                                        return `<td style="padding:6px 4px; text-align:center; color:${qty > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString() : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#00E5FF; font-weight:900; background:rgba(0, 229, 255, 0.05);">${rowTotal.toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    };

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
            const weekStr = getWeekStr(t.fecha);
            if (weekStr === '---') return;
            
            let brand = String(t.marca || 'S/M').trim();
            if (brand === 'Bubblegummers Licenses') brand = 'BG. Licenses';
            if (brand === 'Bubblegummers') brand = 'BG';
            
            allBrandsSet.add(brand);
            
            if (!weeklyBrandData[weekStr]) {
                weeklyBrandData[weekStr] = {};
            }
            if (!weeklyBrandData[weekStr][brand]) {
                weeklyBrandData[weekStr][brand] = 0;
            }
            weeklyBrandData[weekStr][brand] += parseFloat(t.qty) || 0;

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
                        artQty += parseFloat(i.qty) || 0;
                    }
                });
                if (artQty === 0) {
                    artQty = parseFloat(art.bufferQty) || 0;
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
        <div style="background:#000000; border:2px solid #8b5cf6; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(139,92,246,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 4px solid #8b5cf6; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#a78bfa; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE ALMACENADO POR SEMANA Y MARCA
                </h3>
                <div style="font-size:0.68rem; color:rgba(167, 139, 250, 0.6); font-weight:700; letter-spacing:0.5px;">
                    DISTRIBUCIÓN DE CANTIDADES ALMACENADAS POR SEMANA E ISO Y MARCAS PRINCIPALES (HAGA CLIC EN UNA SEMANA PARA EXPANDIR POR GÉNERO)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="color:#a78bfa; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #8b5cf6;">
                            <th style="padding:6px 8px; text-align:left; width:120px;">SEMANA</th>
                            ${sortedBrands.map(b => `<th style="padding:6px 8px; text-align:center;">${b}</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:100px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedWeeks.length === 0 ? `<tr><td colspan="${sortedBrands.length + 2}" style="padding:3rem; text-align:center; color:rgba(167, 139, 250, 0.4); font-weight:700;">No hay datos semanales registrados.</td></tr>` : sortedWeeks.map(w => {
                            const rowData = weeklyBrandData[w];
                            const rowTotal = sortedBrands.reduce((sum, b) => sum + (rowData[b] || 0), 0);
                            const isExpanded = window.__expandedStorageReportWeeks && window.__expandedStorageReportWeeks.includes(w);
                            
                            const genderRowsHtml = isExpanded ? Array.from(allGendersPerWeek[w] || []).sort().map(gender => {
                                const genderData = weeklyBrandGenderData[w][gender] || {};
                                const genderRowTotal = sortedBrands.reduce((sum, b) => sum + (genderData[b] || 0), 0);
                                return `
                                    <tr style="background: rgba(139, 92, 246, 0.04); border-bottom: 1px solid rgba(139,92,246,0.06); font-size:0.74rem;">
                                        <td style="padding:5px 8px 5px 24px; color:rgba(255,255,255,0.7); font-weight:600; font-style:italic; white-space:nowrap;">↳ ${gender}</td>
                                        ${sortedBrands.map(b => {
                                            const qty = genderData[b] || 0;
                                            return `<td style="padding:5px 8px; text-align:center; color:rgba(255,255,255,0.65);">${qty > 0 ? qty.toLocaleString() : '-'}</td>`;
                                        }).join('')}
                                        <td style="padding:5px 8px; text-align:center; color:#a78bfa; font-weight:700; background:rgba(139,92,246,0.04);">${genderRowTotal.toLocaleString()}</td>
                                    </tr>
                                `;
                            }).join('') : '';

                            return `
                                <tr onclick="window.toggleStorageReportWeek('${w}')" style="border-bottom: 1px solid rgba(139,92,246,0.08); background:#000000; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='#000000'">
                                    <td style="padding:6px 8px; color:#ffffff; font-weight:700; white-space:nowrap;">
                                        <span style="color:#8b5cf6; margin-right:6px; display:inline-block; transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}">▶</span>
                                        ${w}
                                    </td>
                                    ${sortedBrands.map(b => {
                                        const qty = rowData[b] || 0;
                                        return `<td style="padding:6px 8px; text-align:center; color:${qty > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString() : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#a78bfa; font-weight:900; background:rgba(139,92,246,0.05);">${rowTotal.toLocaleString()}</td>
                                </tr>
                                ${genderRowsHtml}
                            `;
                        }).join('')}
                        ${sortedWeeks.length > 0 ? `
                            <tr style="background: linear-gradient(90deg, rgba(139,92,246,0.2) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #8b5cf6; font-weight:900;">
                                <td style="padding:8px 8px; color:#ffffff; font-weight:900;">TOTAL GENERAL</td>
                                ${sortedBrands.map(b => {
                                    const qty = colTotals[b];
                                    return `<td style="padding:8px 8px; text-align:center; color:#a78bfa; font-weight:900;">${qty.toLocaleString()}</td>`;
                                }).join('')}
                                <td style="padding:8px 8px; text-align:center; color:#a78bfa; font-weight:900; background:rgba(139,92,246,0.1); text-shadow:0 0 8px rgba(167,139,250,0.5);">${grandTotal.toLocaleString()}</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    };

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
                        avance += qty;
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
    };

    // Pre-calcular listado plano de ítems detallados para paginación de 25 en 25
    const detailedItems = [];
    if (isDetail) {
        tasks.filter(t => t.fecha >= window.__almacenajeStartDate && t.fecha <= window.__almacenajeEndDate).forEach(t => {
            (t.items || []).forEach(art => {
                const bufferItems = art.items || [];
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
                        if (ubi.startsWith('CDBUFFER')) {
                            return !ubi.startsWith('CDBUFFER-C');
                        }
                        const allowedPrefixes = ['SEL-', 'MZN01-', 'MZN02-', 'MZN03-', 'MZN04-'];
                        return allowedPrefixes.some(p => ubi.startsWith(p));
                    })
                    .sort((a, b) => {
                        const isABuffer = a.ubi.startsWith('CDBUFFER');
                        const isBBuffer = b.ubi.startsWith('CDBUFFER');
                        if (isABuffer && !isBBuffer) return -1;
                        if (!isABuffer && isBBuffer) return 1;
                        return 0;
                    });

                allItems.forEach(i => {
                    const isBuffer = i.ubi.startsWith('CDBUFFER');
                    detailedItems.push({
                        task: t,
                        art: art,
                        item: i,
                        isBuffer: isBuffer
                    });
                });
            });
        });

        // --- FILTRADO BÚSQUEDA DETALLE ---
        if (window.__almacenajeDetailSearchQuery) {
            const query = String(window.__almacenajeDetailSearchQuery).trim().toLowerCase();
            const filteredDetailedItems = detailedItems.filter(di => {
                const artSku = String(di.art.sku7 || '').toLowerCase();
                const ubi = String(di.item.ubi || '').toLowerCase();
                const skuFull = String(di.item.skuFull || di.item.sku || '').toLowerCase();
                const talla = String(di.item.talla || (dataStore.tabla_tallas && dataStore.tabla_tallas[di.item.skuFull]) || (di.item.skuFull && di.item.skuFull.split('-').pop()) || '').toLowerCase();
                const taskId = String(di.task.id || '').toLowerCase();
                const taskCleanId = taskId.includes('_') ? taskId.split('_')[1] : taskId;
                const creator = String(di.task.creador || '').toLowerCase();
                const status = String(di.task.status || '').toLowerCase();
                const u1 = String(di.task.u1 || '').toLowerCase();
                const u2 = String(di.task.u2 || '').toLowerCase();
                
                return artSku.includes(query) ||
                       ubi.includes(query) ||
                       skuFull.includes(query) ||
                       talla.includes(query) ||
                       taskId.includes(query) ||
                       taskCleanId.includes(query) ||
                       creator.includes(query) ||
                       status.includes(query) ||
                       u1.includes(query) ||
                       u2.includes(query);
            });
            detailedItems.length = 0;
            detailedItems.push(...filteredDetailedItems);
        }
    }

    // Inicializar o ajustar variables de paginación
    const rangeKey = `${window.__almacenajeStartDate}|${window.__almacenajeEndDate}`;
    if (typeof window.__detailCurrentPage === 'undefined' || window.__detailLastDate !== rangeKey) {
        window.__detailCurrentPage = 1;
        window.__detailLastDate = rangeKey;
    }
    const totalPages = Math.ceil(detailedItems.length / 25) || 1;
    if (window.__detailCurrentPage > totalPages) window.__detailCurrentPage = totalPages;
    if (window.__detailCurrentPage < 1) window.__detailCurrentPage = 1;

    const startIndex = (window.__detailCurrentPage - 1) * 25;
    const pageItems = detailedItems.slice(startIndex, startIndex + 25);

    // Helper global para cambiar página
    window.__setDetailPage = (p) => {
        const maxPage = Math.ceil(detailedItems.length / 25) || 1;
        if (p < 1) p = 1;
        if (p > maxPage) p = maxPage;
        window.__detailCurrentPage = p;
        renderAlmacenajeTareas(container);
    };

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.4rem; gap:1rem; flex-wrap:wrap;">
            ${!isKpi ? `
            <nav style="display:flex; gap:1.5rem; align-items:center;">
                <a class="sub-sub-nav-item ${!isDetail ?'active':''}" onclick="window.setTaskMode('resumen')" style="padding: 0.4rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${!isDetail?'var(--primary)':'var(--text-muted)'}; font-weight:${!isDetail?'800':'500'}; border-bottom:${!isDetail?'2px solid var(--primary)':'none'}; text-decoration:none;">📊 RESUMEN</a>
                <a class="sub-sub-nav-item ${isDetail?'active':''}" onclick="window.setTaskMode('detalle')" style="padding: 0.4rem 0.2rem; font-size: 0.8rem; cursor:pointer; color:${isDetail?'var(--primary)':'var(--text-muted)'}; font-weight:${isDetail?'800':'500'}; border-bottom:${isDetail?'2px solid var(--primary)':'none'}; text-decoration:none;">🔍 DETALLE</a>
            </nav>
            <div style="display:flex; align-items:center; gap:15px; margin-left:auto; flex-wrap:wrap;">
                <!-- BOTONES DE ACCIÓN PRINCIPALES -->
                <div style="display:flex; gap:10px; align-items:center;">
                    ${!isDetail ? `<button id="btn_open_shift_new" class="btn" style="width:auto; background:rgba(34, 197, 94, 0.1); color:#22c55e; border:1px solid rgba(34, 197, 94, 0.3); padding:6px 12px; font-size:0.7rem; font-weight:700;">⚙️ PROCESAR TAREAS</button>` : ''}
                    ${!isDetail ? `<button onclick="window.exportAlmacenajeExcel()" class="btn" style="width:auto; padding:6px 14px; font-size:0.7rem; background:var(--primary); color:#fff; font-weight:800; border:none; box-shadow:0 4px 12px rgba(79,70,229,0.3);">📥 EXCEL TAREAS</button>` : ''}
                </div>

                ${isDetail ? `
                <!-- BUSCADOR DETALLE -->
                <div style="position:relative; display:flex; align-items:center;">
                    <span style="position:absolute; left:12px; color:rgba(255,255,255,0.4); pointer-events:none; font-size:0.75rem;">🔍</span>
                    <input type="text" id="almacenaje_detail_search" placeholder="Filtrar por código, ubi, sku, creador..." 
                           value="${window.__almacenajeDetailSearchQuery || ''}"
                           style="background:rgba(255, 255, 255, 0.03); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:5px 12px 5px 32px; color:#fff; font-size:0.75rem; width:220px; outline:none; transition:all 0.3s ease; font-family:'Inter', sans-serif;"
                           onfocus="this.style.borderColor='var(--primary)'; this.style.background='rgba(255,255,255,0.06)';"
                           onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.03)';"
                           oninput="window.setAlmacenajeDetailSearch(this.value)">
                </div>
                ` : ''}

                <!-- RANGO DE FECHAS DE : HASTA -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:var(--primary);">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">DE:</span>
                        <input type="date" id="almacenajeStartDateInput" value="${window.__almacenajeStartDate}" onchange="window.setAlmacenajeDateRange(this.value, null)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:var(--primary);">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">HASTA:</span>
                        <input type="date" id="almacenajeEndDateInput" value="${window.__almacenajeEndDate}" onchange="window.setAlmacenajeDateRange(null, this.value)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                </div>

                <!-- BOTONES CIRCULARES (REFRESCO Y BASURA) -->
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="btn_refresh_almacenaje" title="Refrescar Datos" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--primary)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.1)'">
                        🔄
                    </button>
                    ${!isDetail ? `
                    <button onclick="window.clearCurrentShiftTasks()" title="Limpiar Tareas Pendientes" style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); color:#ef4444; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.15)'; this.style.borderColor='#ef4444'" onmouseout="this.style.background='rgba(239,68,68,0.05)'; this.style.borderColor='rgba(239,68,68,0.2)'">
                        🗑️
                    </button>
                    ` : ''}
                </div>
            </div>
            ` : `
            <div style="flex:1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <h4 style="margin:0; color:var(--primary); font-size:0.8rem; font-weight:800; letter-spacing:1px; text-transform:uppercase;">📊 Panel de Rendimiento Individual</h4>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <!-- RANGO DE FECHAS DE : HASTA PARA KPI -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                            <span style="font-size:0.85rem; color:var(--primary);">📅</span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">DE:</span>
                            <input type="date" id="kpiStartDateInput" value="${window.__kpiStartDate}" onchange="window.setKpiDateRange(this.value, null)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                        </div>
                        <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                            <span style="font-size:0.85rem; color:var(--primary);">📅</span>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">HASTA:</span>
                            <input type="date" id="kpiEndDateInput" value="${window.__kpiEndDate}" onchange="window.setKpiDateRange(null, this.value)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                        </div>
                    </div>
                    <button id="btn_refresh_almacenaje" title="Refrescar Datos" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1rem; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--primary)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.1)'">
                        🔄
                    </button>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Módulo de Analítica Avanzada</div>
                </div>
            </div>
            `}
        </div>

        <div style="display:flex; flex-direction:column; gap:1.5rem; height:calc(100vh - 280px); width:100%;">
            <!-- CONTENIDO PRINCIPAL -->
            <div style="display:flex; flex-direction:column; gap:1rem; overflow-y:auto; width:100%; flex:1;">
                ${isKpi ? `
        <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:1.5rem;">
            <!-- REPORTE PRODUCTIVIDAD INDIVIDUAL (ESTILO NEON) -->
            <div style="background:rgba(15,23,42,0.9); border:2px solid var(--primary); border-radius:12px; overflow:hidden; box-shadow: 0 0 25px rgba(79,70,229,0.2);">
                <div style="padding:1rem; background:rgba(79,70,229,0.1); border-bottom:1px solid rgba(79,70,229,0.3); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="color:#fff; font-weight:800; margin:0; font-size:1rem; letter-spacing:1px; text-transform:uppercase;">
                        📊 PRODUCTIVIDAD <span style="font-size:0.7rem; opacity:0.6; margin-left:10px;">${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</span>
                    </h3>
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.5); font-weight:600;">FILTRO: ${window.__kpiStartDate.split('-').reverse().join('/')} AL ${window.__kpiEndDate.split('-').reverse().join('/')}</div>
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
                                tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate).forEach(t => {
                                    if (t.status !== 'Finalizado') return;

                                    let timeStr = '--:--';
                                    let totalMinutes = 0;
                                    
                                    if (t.inicio && t.termino) {
                                        const s = new Date(t.inicio);
                                        let e = new Date(t.termino);
                                        if (e < s) {
                                            e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
                                        }
                                        let ms = e - s;

                                        // Descontar break si aplica
                                        const shiftDate = (s.getHours() < 12) ? new Date(s.getTime() - 12*60*60*1000) : s;
                                        const bStart = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 0, 0);
                                        const bEnd = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 23, 50, 0);
                                        const overlapStart = Math.max(s, bStart);
                                        const overlapEnd = Math.min(e, bEnd);
                                        const overlap = Math.max(0, overlapEnd - overlapStart);
                                        ms = ms - overlap;

                                        totalMinutes = Math.floor(ms / (1000 * 60));
                                        if (totalMinutes > 0) {
                                            timeStr = `${Math.floor(totalMinutes/60).toString().padStart(2,'0')}:${(totalMinutes%60).toString().padStart(2,'0')}`;
                                        }
                                    }

                                    const uList = [t.u1, t.u2].filter(u => u && u !== '---');
                                    
                                    if (uList.length > 0) {
                                        uList.forEach((user, idx) => {
                                            const qtyForThisUser = (uList.length === 2) 
                                                ? (idx === 0 ? Math.ceil(t.qty / 2) : Math.floor(t.qty / 2)) 
                                                : t.qty;
                                                
                                            let uph = 0;
                                            let pct = 0;
                                            let ok = false;
                                            
                                            if (totalMinutes > 0) {
                                                uph = (qtyForThisUser / totalMinutes) * 60;
                                                pct = Math.round((uph / 150) * 100);
                                                ok = uph >= 150;
                                            }

                                            indRows.push({
                                                fecha: t.fecha,
                                                user: user,
                                                qty: qtyForThisUser,
                                                inicio: t.inicio,
                                                termino: t.termino,
                                                time: timeStr,
                                                pct: pct,
                                                ok: ok
                                            });
                                        });
                                    }
                                });

                                if (indRows.length === 0) return `<tr><td colspan="8" style="padding:4rem; text-align:center; color:rgba(255,255,255,0.2);">No hay datos de productividad finalizados para mostrar.</td></tr>`;

                                indRows.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || a.user.localeCompare(b.user));

                                // --- PAGINACIÓN 10 por página ---
                                const rangeKey = `${window.__kpiStartDate}|${window.__kpiEndDate}`;
                                if (window.__kpiLastDate !== rangeKey) { window.__kpiPage = 0; window.__kpiLastDate = rangeKey; }
                                if (!window.__kpiSetPage) window.__kpiSetPage = (p) => { const _sy=window.scrollY; window.__kpiPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
                                const _pg = window.__kpiPage || 0;
                                const _ptot = Math.ceil(indRows.length / 10);
                                window.__kpiTotalPages = _ptot;
                                window.__kpiTotalRows = indRows.length;
                                const pagedRows = indRows.slice(_pg * 10, (_pg + 1) * 10);

                                return pagedRows.map(r => `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.02); transition: all 0.2s;">
                                        <td style="padding:0.8rem 1rem; opacity:0.6;">${r.fecha.split('-').reverse().join('/')}</td>
                                        <td style="padding:0.8rem 1rem;"><b style="color:#fff; text-transform:uppercase;">${r.user}</b></td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:var(--primary); font-weight:800;">${r.qty.toLocaleString()}</td>
                                        <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${r.inicio ? new Date(r.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                                        <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${r.termino ? new Date(r.termino).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
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
                
                <div style="padding:1rem; background:rgba(0,0,0,0.3); border-top:1px solid rgba(79,70,229,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                        <div style="font-size:0.7rem; color:rgba(255,255,255,0.4);">* Base: 150 Unid/Hr por usuario &nbsp;|&nbsp; <span style="color:rgba(255,255,255,0.6);">${window.__kpiTotalRows||0} registros totales</span></div>
                        <button class="btn" style="width:auto; padding:6px 12px; font-size:0.7rem; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid #10b981;">📥 EXPORTAR KPI</button>
                    </div>
                    ${(() => {
                        const tp = window.__kpiTotalPages || 1;
                        const cp = window.__kpiPage || 0;
                        if (tp <= 1) return '';
                        const btnStyle = (active, dis) => `padding:5px 11px; border-radius:8px; border:1px solid ${active?'#6366f1':'rgba(255,255,255,0.1)'}; background:${active?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.03)'}; color:${dis?'rgba(255,255,255,0.2)':active?'#fff':'#a5b4fc'}; cursor:${dis?'default':'pointer'}; font-size:0.75rem; font-weight:${active?900:500};`;
                        const pages = Array.from({length: tp}, (_, i) => i);
                        return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05);">
                            <button onclick="window.__kpiSetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                            ${pages.map(p=>`<button onclick="window.__kpiSetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                            <button onclick="window.__kpiSetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                            <span style="font-size:0.7rem; color:rgba(255,255,255,0.3); margin-left:6px;">Pág ${cp+1} / ${tp}</span>
                        </div>`;
                    })()}
                </div>
            </div>

            <!-- REPORTE: ACUMULADO DÍA × USUARIO -->
            <div style="background:rgba(10,15,30,0.95); border:2px solid #f59e0b; border-radius:14px; overflow:hidden; box-shadow: 0 0 30px rgba(245,158,11,0.15);">
                <div style="padding:1rem 1.2rem; background:rgba(245,158,11,0.08); border-bottom:1px solid rgba(245,158,11,0.25); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:#f59e0b; font-weight:900; margin:0 0 2px 0; font-size:1rem; letter-spacing:1px; text-transform:uppercase;">📅 ACUMULADO POR DÍA × USUARIO</h3>
                        <div style="font-size:0.68rem; color:rgba(245,158,11,0.55); font-weight:600;">Suma de unidades por operador por jornada — incluye todas las tareas del día</div>
                    </div>
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:600;">FILTRO: ${window.__kpiStartDate.split('-').reverse().join('/')} AL ${window.__kpiEndDate.split('-').reverse().join('/')}</div>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.82rem; color:#eee;">
                        <thead style="background:rgba(0,0,0,0.6);">
                            <tr style="color:rgba(245,158,11,0.8); text-transform:uppercase; font-size:0.68rem; letter-spacing:0.06em; border-bottom:2px solid rgba(245,158,11,0.25);">
                                <th style="padding:0.85rem 1rem; text-align:left;">Fecha</th>
                                <th style="padding:0.85rem 1rem; text-align:left;">Usuario</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Tareas</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Unid. Acumuladas</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Tiempo Total</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Unid/Hr</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Progreso</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const accMap = new Map();
                                tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate && t.status === 'Finalizado').forEach(t => {
                                    let mins = 0;
                                    if (t.inicio && t.termino) {
                                        const s = new Date(t.inicio); let e = new Date(t.termino);
                                        if (e < s) e = new Date(e.getTime() + 86400000);
                                        const sd = s.getHours() < 12 ? new Date(s.getTime()-43200000) : s;
                                        const bS = new Date(sd.getFullYear(),sd.getMonth(),sd.getDate(),23,0,0);
                                        const bE = new Date(sd.getFullYear(),sd.getMonth(),sd.getDate(),23,50,0);
                                        mins = Math.max(0,Math.floor(((e-s)-Math.max(0,Math.min(e,bE)-Math.max(s,bS)))/60000));
                                    }
                                    const uList = [t.u1,t.u2].filter(u=>u&&u!=='---');
                                    uList.forEach((user,idx) => {
                                        const qty = uList.length===2?(idx===0?Math.ceil(t.qty/2):Math.floor(t.qty/2)):t.qty;
                                        const key = t.fecha+'|'+user;
                                        const cur = accMap.get(key)||{fecha:t.fecha,user,qty:0,mins:0,tasks:0};
                                        cur.qty+=qty; cur.mins+=mins; cur.tasks++;
                                        accMap.set(key,cur);
                                    });
                                });
                                const rows = [...accMap.values()].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)||a.user.localeCompare(b.user));
                                if (!rows.length) return `<tr><td colspan="8" style="padding:3rem; text-align:center; color:rgba(255,255,255,0.2);">Sin datos acumulados para mostrar.</td></tr>`;
                                // --- PAGINACIÓN ACUMULADO ---
                                const rangeKey = `${window.__kpiStartDate}|${window.__kpiEndDate}`;
                                if (window.__accLastDate !== rangeKey) { window.__accPage=0; window.__accLastDate=rangeKey; }
                                if (!window.__accSetPage) window.__accSetPage = (p) => { const _sy=window.scrollY; window.__accPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
                                const _apg = window.__accPage||0;
                                const _aptot = Math.ceil(rows.length/10);
                                window.__accTotalPages = _aptot;
                                window.__accTotalRows = rows.length;
                                const accPagedRows = rows.slice(_apg*10, (_apg+1)*10);
                                const maxQty = Math.max(...rows.map(r=>r.qty),1);
                                return accPagedRows.map(r => {
                                    const uph = r.mins>0?(r.qty/r.mins*60):0;
                                    const uphColor = uph>=150?'#22c55e':uph>=100?'#f59e0b':'#ef4444';
                                    const uphOk = uph>=150;
                                    const bar = Math.round(r.qty/maxQty*100);
                                    const hh = Math.floor(r.mins/60).toString().padStart(2,'0');
                                    const mm = (r.mins%60).toString().padStart(2,'0');
                                    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); transition:background 0.2s;" onmouseover="this.style.background='rgba(245,158,11,0.04)'" onmouseout="this.style.background=''">
                                        <td style="padding:0.8rem 1rem; opacity:0.65; font-size:0.78rem;">${r.fecha.split('-').reverse().join('/')}</td>
                                        <td style="padding:0.8rem 1rem;"><b style="color:#fff; text-transform:uppercase; font-size:0.85rem;">${r.user}</b></td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:rgba(255,255,255,0.5); font-weight:700;">${r.tasks}</td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="color:#f59e0b; font-weight:900; font-size:1.05rem;">${r.qty.toLocaleString()}</span></td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:rgba(255,255,255,0.6); font-weight:700; font-size:0.82rem;">${hh}:${mm}</td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="color:${uphColor}; font-weight:900; font-size:0.95rem;">${uph>0?Math.round(uph):'---'}</span><span style="font-size:0.65rem; color:rgba(255,255,255,0.3); margin-left:3px;">u/h</span></td>
                                        <td style="padding:0.8rem 1.2rem;">
                                            <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;"><div style="width:${bar}%; height:100%; background:linear-gradient(90deg,#f59e0b,#fbbf24); border-radius:6px; box-shadow:0 0 8px rgba(245,158,11,0.4);"></div></div>
                                            <div style="font-size:0.62rem; color:rgba(255,255,255,0.3); margin-top:3px; text-align:right;">${bar}%</div>
                                        </td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="background:${uphOk?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)'}; color:${uphOk?'#22c55e':'#ef4444'}; padding:3px 9px; border-radius:8px; font-weight:900; font-size:0.62rem; border:1px solid ${uphOk?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}">${uphOk?'✅ META':'⚠️ BAJO'}</span></td>
                                    </tr>`;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
                <div style="padding:0.75rem 1rem; background:rgba(0,0,0,0.3); border-top:1px solid rgba(245,158,11,0.15);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <div style="font-size:0.68rem; color:rgba(255,255,255,0.3);">💡 3 tareas × 100 unid = <b style="color:#f59e0b;">300 acumuladas</b> &nbsp;|&nbsp; <span style="color:rgba(255,255,255,0.5);">${window.__accTotalRows||0} registros</span></div>
                    </div>
                    ${(()=>{ const tp=window.__accTotalPages||1; const cp=window.__accPage||0; if(tp<=1) return ''; const bs=(a,d)=>`padding:5px 11px;border-radius:8px;border:1px solid ${a?'#f59e0b':'rgba(255,255,255,0.1)'};background:${a?'rgba(245,158,11,0.25)':'rgba(255,255,255,0.03)'};color:${d?'rgba(255,255,255,0.2)':a?'#fff':'#fbbf24'};cursor:${d?'default':'pointer'};font-size:0.75rem;font-weight:${a?900:500};`; return `<div style="display:flex;align-items:center;justify-content:center;gap:5px;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.05);"><button onclick="window.__accSetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${bs(false,cp===0)}">← Ant</button>${Array.from({length:tp},(_,i)=>i).map(p=>`<button onclick="window.__accSetPage(${p})" style="${bs(p===cp,false)}">${p+1}</button>`).join('')}<button onclick="window.__accSetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${bs(false,cp===tp-1)}">Sig →</button><span style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin-left:6px;">Pág ${cp+1}/${tp}</span></div>`; })()}
                </div>
            </div>

            <!-- REPORTE: RANKING VELOCIDAD (UNID/HR) -->
            <div style="background:rgba(10,15,30,0.95); border:2px solid #8b5cf6; border-radius:14px; overflow:hidden; box-shadow: 0 0 30px rgba(139,92,246,0.15);">
                <div style="padding:1rem 1.2rem; background:rgba(139,92,246,0.08); border-bottom:1px solid rgba(139,92,246,0.25); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:#a78bfa; font-weight:900; margin:0 0 2px 0; font-size:1rem; letter-spacing:1px; text-transform:uppercase;">⚡ RANKING DE VELOCIDAD — UNID/HORA</h3>
                        <div style="font-size:0.68rem; color:rgba(167,139,250,0.55); font-weight:600;">Eficiencia promedio por operador · Ordenado de mayor a menor velocidad</div>
                    </div>
                    <div style="font-size:0.7rem; color:rgba(255,255,255,0.4);">BASE: 150 U/Hr = 100%</div>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.82rem; color:#eee;">
                        <thead style="background:rgba(0,0,0,0.6);">
                            <tr style="color:rgba(167,139,250,0.8); text-transform:uppercase; font-size:0.68rem; letter-spacing:0.06em; border-bottom:2px solid rgba(139,92,246,0.25);">
                                <th style="padding:0.85rem 1rem; text-align:center; width:50px;">#</th>
                                <th style="padding:0.85rem 1rem; text-align:left;">Operador</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Unid/Hr Prom</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Mejor Unid/Hr</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Total Unid</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Horas Trab.</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Eficiencia</th>
                                <th style="padding:0.85rem 1rem; text-align:center;">Rango</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const uMap = new Map();
                                tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate && t.status === 'Finalizado').forEach(t => {
                                    let mins = 0;
                                    if (t.inicio && t.termino) {
                                        const s = new Date(t.inicio); let e = new Date(t.termino);
                                        if (e < s) e = new Date(e.getTime() + 86400000);
                                        const sd = s.getHours() < 12 ? new Date(s.getTime()-43200000) : s;
                                        const bS = new Date(sd.getFullYear(),sd.getMonth(),sd.getDate(),23,0,0);
                                        const bE = new Date(sd.getFullYear(),sd.getMonth(),sd.getDate(),23,50,0);
                                        mins = Math.max(0,Math.floor(((e-s)-Math.max(0,Math.min(e,bE)-Math.max(s,bS)))/60000));
                                    }
                                    const uList = [t.u1,t.u2].filter(u=>u&&u!=='---');
                                    uList.forEach((user,idx) => {
                                        const qty = uList.length===2?(idx===0?Math.ceil(t.qty/2):Math.floor(t.qty/2)):t.qty;
                                        const taskUph = mins>0?(qty/mins*60):0;
                                        const cur = uMap.get(user)||{user,qty:0,mins:0,bestUph:0,tasks:0};
                                        cur.qty+=qty; cur.mins+=mins; cur.tasks++;
                                        if (taskUph>cur.bestUph) cur.bestUph=taskUph;
                                        uMap.set(user,cur);
                                    });
                                });
                                const rows = [...uMap.values()].map(r=>({...r, avgUph:r.mins>0?(r.qty/r.mins*60):0}))
                                    .sort((a,b)=>b.avgUph-a.avgUph);
                                if (!rows.length) return `<tr><td colspan="8" style="padding:3rem; text-align:center; color:rgba(255,255,255,0.2);">Sin datos de velocidad para mostrar.</td></tr>`;
                                // --- PAGINACIÓN RANKING ---
                                const rangeKey = `${window.__kpiStartDate}|${window.__kpiEndDate}`;
                                if (window.__rkLastDate !== rangeKey) { window.__rkPage=0; window.__rkLastDate = rangeKey; }
                                if (!window.__rkSetPage) window.__rkSetPage = (p) => { const _sy=window.scrollY; window.__rkPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
                                const _rpg = window.__rkPage||0;
                                const _rptot = Math.ceil(rows.length/10);
                                window.__rkTotalPages = _rptot;
                                window.__rkTotalRows = rows.length;
                                const rkPagedRows = rows.slice(_rpg*10, (_rpg+1)*10);
                                const maxUph = Math.max(...rows.map(r=>r.avgUph),1);
                                const medals = ['🥇','🥈','🥉'];
                                return rkPagedRows.map((r,i) => {
                                    const globalIdx = _rpg*10+i;
                                    const pct = Math.round(r.avgUph/150*100);
                                    const uphColor = r.avgUph>=150?'#22c55e':r.avgUph>=100?'#f59e0b':'#ef4444';
                                    const barPct = Math.min(Math.round(r.avgUph/maxUph*100),100);
                                    const hh = Math.floor(r.mins/60); const mm = r.mins%60;
                                    const rangeLabel = r.avgUph>=150?'ELITE':r.avgUph>=120?'ALTO':r.avgUph>=90?'MEDIO':'BAJO';
                                    const rangeColor = r.avgUph>=150?'#22c55e':r.avgUph>=120?'#a78bfa':r.avgUph>=90?'#f59e0b':'#ef4444';
                                    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.03); transition:background 0.2s;" onmouseover="this.style.background='rgba(139,92,246,0.05)'" onmouseout="this.style.background=''">
                                        <td style="padding:0.8rem 1rem; text-align:center; font-size:1.1rem;">${medals[globalIdx]||`<span style='color:rgba(255,255,255,0.4);font-weight:700;'>${globalIdx+1}</span>`}</td>
                                        <td style="padding:0.8rem 1rem;"><b style="color:#fff; text-transform:uppercase; font-size:0.88rem;">${r.user}</b><div style="font-size:0.65rem; color:rgba(255,255,255,0.3); margin-top:2px;">${r.tasks} tarea${r.tasks!==1?'s':''} realizadas</div></td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="color:${uphColor}; font-weight:900; font-size:1.15rem;">${Math.round(r.avgUph)}</span><span style="font-size:0.65rem; color:rgba(255,255,255,0.3);"> u/h</span></td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="color:#a78bfa; font-weight:800;">${Math.round(r.bestUph)}</span><span style="font-size:0.65rem; color:rgba(255,255,255,0.3);"> u/h</span></td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:#e2e8f0; font-weight:700;">${r.qty.toLocaleString()}</td>
                                        <td style="padding:0.8rem 1rem; text-align:center; color:rgba(255,255,255,0.5); font-size:0.82rem;">${hh}h ${mm.toString().padStart(2,'0')}m</td>
                                        <td style="padding:0.8rem 1.2rem;"><div style="height:6px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;"><div style="width:${barPct}%; height:100%; background:linear-gradient(90deg,${uphColor},${globalIdx===0?'#86efac':'rgba(255,255,255,0.3)'}); border-radius:6px; box-shadow:0 0 8px ${uphColor}44;"></div></div><div style="font-size:0.62rem; color:${uphColor}; margin-top:3px; text-align:right; font-weight:700;">${pct}% de meta</div></td>
                                        <td style="padding:0.8rem 1rem; text-align:center;"><span style="background:${rangeColor}22; color:${rangeColor}; padding:3px 10px; border-radius:8px; font-weight:900; font-size:0.65rem; border:1px solid ${rangeColor}55; letter-spacing:0.5px;">${rangeLabel}</span></td>
                                    </tr>`;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
                <div style="padding:0.75rem 1rem; background:rgba(0,0,0,0.3); border-top:1px solid rgba(139,92,246,0.15);">
                    <div style="display:flex; gap:1.5rem; font-size:0.68rem; color:rgba(255,255,255,0.3); margin-bottom:0.5rem; flex-wrap:wrap;">
                        <span>🟢 ELITE ≥ 150 u/h</span>
                        <span>🟣 ALTO ≥ 120 u/h</span>
                        <span>🟡 MEDIO ≥ 90 u/h</span>
                        <span>🔴 BAJO &lt; 90 u/h</span>
                        <span style="margin-left:auto; color:rgba(255,255,255,0.5);">${window.__rkTotalRows||0} operadores</span>
                    </div>
                    ${(()=>{ const tp=window.__rkTotalPages||1; const cp=window.__rkPage||0; if(tp<=1) return ''; const bs=(a,d)=>`padding:5px 11px;border-radius:8px;border:1px solid ${a?'#8b5cf6':'rgba(255,255,255,0.1)'};background:${a?'rgba(139,92,246,0.25)':'rgba(255,255,255,0.03)'};color:${d?'rgba(255,255,255,0.2)':a?'#fff':'#a78bfa'};cursor:${d?'default':'pointer'};font-size:0.75rem;font-weight:${a?900:500};`; return `<div style="display:flex;align-items:center;justify-content:center;gap:5px;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.05);"><button onclick="window.__rkSetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${bs(false,cp===0)}">← Ant</button>${Array.from({length:tp},(_,i)=>i).map(p=>`<button onclick="window.__rkSetPage(${p})" style="${bs(p===cp,false)}">${p+1}</button>`).join('')}<button onclick="window.__rkSetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${bs(false,cp===tp-1)}">Sig →</button><span style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin-left:6px;">Pág ${cp+1}/${tp}</span></div>`; })()}
                </div>
            </div>

            <!-- FILA INFERIOR DE REPORTES (50% / 50%) -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start;">
                
                <!-- REPORTE ALMACENAJE - MARCAS (IZQUIERDA) -->
                <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                            <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                                REPORTE ALMACENAJE - MARCAS
                            </h3>
                            <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                                SYNC_ID: ${(() => {
                                    const syncTimeStr = new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
                                    const startStr = window.__kpiStartDate.split('-').reverse().join('/');
                                    const endStr = window.__kpiEndDate.split('-').reverse().join('/');
                                    const syncDateStr = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
                                    return `${syncDateStr} ${syncTimeStr}`;
                                })()}
                            </div>
                        </div>
                        <button onclick="document.getElementById('btn_refresh_almacenaje').click()" title="Actualizar Reporte" style="background:rgba(0, 229, 255, 0.1); border:1px solid #00E5FF; color:#00E5FF; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9rem; transition:all 0.2s; box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);" onmouseover="this.style.background='rgba(0, 229, 255, 0.2)'; this.style.boxShadow='0 0 15px rgba(0, 229, 255, 0.4)'" onmouseout="this.style.background='rgba(0, 229, 255, 0.1)'; this.style.boxShadow='0 0 10px rgba(0, 229, 255, 0.2)'">
                            🔄
                        </button>
                    </div>
                    
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                            <thead>
                                <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                                    <th style="padding:6px 8px; text-align:left; width: 120px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">AVANCE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 100px;">PENDIENTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const brandGroups = {};
                                    const filteredTasks = tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate);

                                    filteredTasks.forEach(t => {
                                        (t.items || []).forEach(art => {
                                            const brand = String(art.marca || 'S/M').trim();
                                            const bufferItems = art.items || [];
                                            
                                            bufferItems.forEach(i => {
                                                const ubi = String(i.ubi || '').toUpperCase().trim();
                                                if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                                                    let area = 'CDBUFFER-A';
                                                    if (ubi.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
                                                    else if (ubi.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
                                                    else {
                                                        const parts = ubi.split('-');
                                                        area = parts.length > 1 ? `${parts[0]}-${parts[1]}` : parts[0];
                                                    }
                                                    
                                                    const qty = parseFloat(i.qty) || 0;
                                                    
                                                    if (!brandGroups[area]) brandGroups[area] = {};
                                                    if (!brandGroups[area][brand]) {
                                                        brandGroups[area][brand] = { buffer: 0, avance: 0 };
                                                    }
                                                    
                                                    brandGroups[area][brand].buffer += qty;
                                                    if (t.status === 'Finalizado') {
                                                        brandGroups[area][brand].avance += qty;
                                                    }
                                                }
                                            });
                                        });
                                    });

                                    const areas = Object.keys(brandGroups).sort((a, b) => b.localeCompare(a));
                                    let brandTableRows = '';
                                    let grandBuffer = 0;
                                    let grandAvance = 0;

                                    if (areas.length === 0) {
                                        return `<tr><td colspan="6" style="padding:4rem; text-align:center; color:rgba(0, 229, 255, 0.3); font-weight:700;">No hay datos de almacén para mostrar en esta selección.</td></tr>`;
                                    }

                                    areas.forEach(area => {
                                        const brands = Object.keys(brandGroups[area]).sort((a, b) => a.localeCompare(b));
                                        let areaBufferSum = 0;
                                        let areaAvanceSum = 0;

                                        brands.forEach(brand => {
                                            const data = brandGroups[area][brand];
                                            const pct = data.buffer > 0 ? Math.round((data.avance / data.buffer) * 100) : 0;
                                            const pendiente = data.buffer - data.avance;
                                            
                                            areaBufferSum += data.buffer;
                                            areaAvanceSum += data.avance;
                                            grandBuffer += data.buffer;
                                            grandAvance += data.avance;

                                            brandTableRows += `
                                                <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                                    <td style="padding:5px 6px; color:#a1a1aa; font-size: 0.78rem; font-weight:600;">${area}</td>
                                                    <td style="padding:5px 6px;"><b style="color:#ffffff; font-weight:800; font-size:0.8rem; font-family:'Outfit', sans-serif;">${brand}</b></td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${data.buffer.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${data.avance.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem;">
                                                        ${getPctHtml(data.avance, data.buffer, true)}
                                                    </td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; color:#00E5FF;  font-size:0.8rem;">${pendiente.toLocaleString()}</td>
                                                </tr>
                                            `;
                                        });

                                        const areaPendiente = areaBufferSum - areaAvanceSum;

                                        brandTableRows += `
                                            <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(15, 23, 42, 0.5) 100%); border-top: 1.5px solid rgba(0, 229, 255, 0.6); border-bottom: 1.5px solid rgba(0, 229, 255, 0.6); font-weight: 900;">
                                                <td colspan="2" style="padding:7px 8px; color:#00E5FF; font-weight:900; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; border-left: 4px solid #00E5FF;">Total ${area}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaBufferSum.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaAvanceSum.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800;">
                                                    ${getPctHtml(areaAvanceSum, areaBufferSum, false)}
                                                </td>
                                                <td style="padding:7px 8px; text-align:center; color:#00E5FF; font-size:0.82rem; font-weight:900;">${areaPendiente.toLocaleString()}</td>
                                            </tr>
                                        `;
                                    });

                                    const grandPendiente = grandBuffer - grandAvance;
                                    
                                    brandTableRows += `
                                        <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #00E5FF; border-bottom: 2px solid #00E5FF; font-weight: 900;">
                                            <td colspan="2" style="padding:9px 8px; color:#ffffff; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; font-family:'Outfit', sans-serif; font-weight:900; border-left: 6px solid #00E5FF;">TOTAL GENERAL CDBUFFER</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandBuffer.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandAvance.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900;">
                                                ${getPctHtml(grandAvance, grandBuffer, false)}
                                            </td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900; text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);">${grandPendiente.toLocaleString()}</td>
                                        </tr>
                                    `;

                                    return brandTableRows;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ESPACIO PARA OTRO REPORTE (DERECHA) -->
                <div class="glass-panel" style="border:1px dashed rgba(255,255,255,0.1); display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:280px; border-radius:12px; background:rgba(15,23,42,0.3); box-shadow: 0 0 25px rgba(0,0,0,0.2);">
                    <div style="font-size:2.8rem; margin-bottom:1rem; opacity:0.15;">📊</div>
                    <span style="color:var(--text-muted); font-size:0.85rem; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">Reporte Futuro</span>
                    <span style="color:rgba(255,255,255,0.2); font-size:0.7rem; margin-top:0.3rem;">Espacio reservado para reportes adicionales</span>
                </div>

            </div>

            <!-- REPORTE RENDIMIENTO DE OPERARIOS (ANCHO COMPLETO) -->
            <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                        <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                            RENDIMIENTO DE OPERARIOS
                        </h3>
                        <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                            MEDICIÓN DE TAREAS FINALIZADAS
                        </div>
                    </div>
                </div>
                
                <div style="overflow-x:auto; margin-top:0.4rem;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead>
                            <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
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
                                                    ? (idx === 0 ? Math.ceil(t.qty / 2) : Math.floor(t.qty / 2)) 
                                                    : t.qty
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
                                    return `<tr><td colspan="10" style="padding:3rem; text-align:center; color:rgba(0, 229, 255, 0.4); font-weight:700;">No hay datos de desempeño para mostrar en este periodo.</td></tr>`;
                                }

                                return sortedGroupRows.map(row => {
                                    const startStr = row.firstStart ? row.firstStart.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    const endStr = row.lastEnd ? row.lastEnd.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    
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
                                        qtyPerHourStr = qtyPerHour.toLocaleString();
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
                                        <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                            <td style="padding:6px 4px; color:#ffffff; font-weight:700; width:70px; white-space:nowrap;">${displayDate}</td>
                                            <td style="padding:6px 4px; text-align:center; width:65px; white-space:nowrap;"><span style="background:${row.turno === 'NOCHE' ? 'rgba(0,229,255,0.2)' : 'rgba(234,179,8,0.2)'}; color:${row.turno === 'NOCHE' ? '#00E5FF' : '#fef08a'}; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:800;">${row.turno}</span></td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:800; color:#ffffff;">${row.operators.size}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#ffffff;">${row.totalQty.toLocaleString()}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#00E5FF;">${row.taskCount}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#a1a1aa; font-size:0.75rem;">${startStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#a1a1aa; font-size:0.75rem;">${endStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#38bdf8; font-weight:700;">${durationStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#22c55e; font-weight:800;">${qtyPerHourStr}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:800; color:#eab308;">${avgQty.toLocaleString()}</td>
                                        </tr>
                                    `;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
            
            ${renderHourlyProductionReport(tasks)}
            
            ${renderWeeklyStorageReport(tasks)}
            
            ${renderWeeklyDailyChartSection(tasks)}
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
                                    <th style="padding:1rem; text-align:center;">Avance</th>
                                    <th style="padding:1rem; text-align:left;">ID Tareas</th>
                                    <th style="padding:1rem; text-align:left;">Usuario Creación</th>
                                    <th style="padding:1rem; text-align:center;">F. Procesado</th>
                                    <th style="padding:1rem; text-align:center;">F. Asignado</th>
                                    <th style="padding:1rem; text-align:center;">F. Finalizado</th>
                                    <th style="padding:1rem; text-align:center;">Status</th>
                                </tr>
                            `}
                        </thead>
                        <tbody>
                            ${(isDetail ? detailedItems.length === 0 : tasks.length === 0) ? `<tr><td colspan="${isDetail ? 13 : 12}" style="padding:3rem; text-align:center; color:var(--text-muted);">No hay registros en este periodo.</td></tr>` : ''}
                            ${!isDetail ? tasks.filter(t => t.fecha >= window.__almacenajeStartDate && t.fecha <= window.__almacenajeEndDate).map(t => {
                                let productividad = '---';
                                let objetivo = '---';
                                let objStyle = 'color:var(--text-muted);';

                                if (t.inicio && t.termino) {
                                    const s = new Date(t.inicio);
                                    let e = new Date(t.termino);
                                    if (e < s) {
                                        e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
                                    }
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
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:600;">${t.id.includes('_') ? t.id.split('_')[1] : t.id}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center;">${t.qty.toLocaleString()}</td>
                                    <td style="padding:0.8rem 1rem;">${t.marca}</td>
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:800; background:rgba(79,70,229,0.05);">${t.u1 || '---'}</td>
                                    <td style="padding:0.8rem 1rem; color:#fff; font-weight:800; opacity:0.8;">${t.u2 || '---'}</td>
                                    <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${t.inicio ? new Date(t.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                                    <td style="padding:0.8rem 1rem; font-size:0.75rem; opacity:0.6;">${t.termino ? new Date(t.termino).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center; color:#fff; font-weight:900; font-size:1rem;">${productividad}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center; font-size:0.7rem;"><span style="${objStyle}">${objetivo}</span></td>
                                    <td style="padding:0.8rem 1rem; text-align:center;">
                                        <span style="background:${t.status === 'Finalizado' ? 'rgba(34,197,94,0.1)' : t.status === 'Asignado' ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.05)'}; color:${t.status === 'Finalizado' ? '#22c55e' : t.status === 'Asignado' ? '#eab308' : 'var(--text-muted)'}; padding:4px 10px; border-radius:20px; font-weight:900; font-size:0.7rem; border:1px solid ${t.status === 'Finalizado' ? 'rgba(34,197,94,0.3)' : 'transparent'}">
                                            ${t.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style="padding:0.8rem 1rem; text-align:center; display:flex; gap:8px; justify-content:center;" onclick="event.stopPropagation()">
                                        <button onclick="window.editTaskTimes('${t.id}')" title="Editar Horas" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#facc15;">✏️</button>
                                        <button onclick="window.resetTask('${t.id}')" title="Reiniciar Tarea" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#60a5fa;">🔄</button>
                                        <button onclick="window.deleteTask('${t.id}')" title="Eliminar Tarea" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#ef4444;">🗑️</button>
                                    </td>
                                </tr>`;
                            }).join('') : pageItems.map(di => {
                                const t = di.task;
                                const art = di.art;
                                const i = di.item;
                                const isBuffer = di.isBuffer;
                                
                                // Logic for Avance
                                let avanceVal = '---';
                                let avanceColor = 'var(--text-muted)';
                                let avanceFontWeight = '500';
                                if (isBuffer) {
                                    if (t.status === 'Finalizado') {
                                        avanceVal = i.qty.toString();
                                        avanceColor = '#22c55e'; // Bold Green
                                        avanceFontWeight = '800';
                                    } else {
                                        avanceVal = '0';
                                        avanceColor = '#9ca3af'; // Bold Gray/Muted
                                        avanceFontWeight = '600';
                                    }
                                }

                                const userCreacion = t.creador || '---';
                                const fProcesado = formatDateTime(t.fechaProcesado || (t.fecha + 'T00:00:00'));
                                const fAsignado = formatDateTime(t.inicio);
                                const fFinalizado = formatDateTime(t.termino);

                                return `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                    <td style="padding:0.6rem 1rem;">${art.sku7}</td>
                                    <td style="padding:0.6rem 1rem; color:#fff !important; font-weight:${isBuffer ? '800' : '500'};">
                                        ${i.ubi}
                                    </td>
                                    <td style="padding:0.6rem 1rem;">${i.skuFull || i.sku || '---'}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center;">${i.talla || (dataStore.tabla_tallas && dataStore.tabla_tallas[i.skuFull]) || (i.skuFull && i.skuFull.split('-').pop()) || '<span style="color:#ef4444; font-size:0.7rem;">S/TALLA</span>'}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-weight:700; color:${isBuffer ? '#fff' : 'transparent'};">${isBuffer ? i.qty : ''}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-weight:800; color:${!isBuffer ? '#fbbf24' : 'rgba(255,255,255,0.05)'};">${!isBuffer ? i.qty : '---'}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-weight:${avanceFontWeight}; color:${avanceColor};">${avanceVal}</td>
                                    <td style="padding:0.6rem 1rem; color:#fff; font-weight:600;">${t.id.includes('_') ? t.id.split('_')[1] : t.id}</td>
                                    <td style="padding:0.6rem 1rem; color:#fff; opacity:0.8;">${userCreacion}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-size:0.75rem; opacity:0.6;">${fProcesado}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-size:0.75rem; opacity:0.6;">${fAsignado}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center; font-size:0.75rem; opacity:0.6;">${fFinalizado}</td>
                                    <td style="padding:0.6rem 1rem; text-align:center;">
                                        <span style="background:${t.status === 'Finalizado' ? 'rgba(34,197,94,0.1)' : t.status === 'Asignado' ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.05)'}; color:${t.status === 'Finalizado' ? '#22c55e' : t.status === 'Asignado' ? '#eab308' : 'var(--text-muted)'}; padding:4px 10px; border-radius:20px; font-weight:700; font-size:0.7rem;">
                                            ${t.status.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 1rem; background:rgba(15, 23, 42, 0.4); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; gap:1.5rem; font-size:0.75rem; align-items:center;">
                        <span style="color:var(--text-muted);">Tareas: <b style="color:#fff;">${tasks.length}</b></span>
                        <span style="color:var(--text-muted);">Registros Totales: <b style="color:#fff;">${detailedItems.length}</b></span>
                        <span style="color:var(--text-muted);">Pares Totales: <b style="color:#fff;">${tasks.reduce((s,t) => s+t.qty, 0).toLocaleString()}</b></span>
                    </div>
                    
                    <!-- Paginación Glassmorphic -->
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="window.__setDetailPage(${window.__detailCurrentPage - 1})" 
                                ${window.__detailCurrentPage <= 1 ? 'disabled' : ''} 
                                style="background:${window.__detailCurrentPage <= 1 ? 'rgba(255,255,255,0.02)' : 'rgba(79, 70, 229, 0.15)'}; 
                                       color:${window.__detailCurrentPage <= 1 ? '#6b7280' : '#fff'}; 
                                       border:1px solid ${window.__detailCurrentPage <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(79, 70, 229, 0.3)'}; 
                                       padding:5px 12px; border-radius:8px; cursor:${window.__detailCurrentPage <= 1 ? 'not-allowed' : 'pointer'}; 
                                       font-size:0.75rem; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:4px;" 
                                onmouseover="if(this.disabled !== true) { this.style.background='rgba(79, 70, 229, 0.3)'; this.style.borderColor='var(--primary)'; }" 
                                onmouseout="if(this.disabled !== true) { this.style.background='rgba(79, 70, 229, 0.15)'; this.style.borderColor='rgba(79, 70, 229, 0.3)'; }">
                            ◀ Anterior
                        </button>
                        
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; padding:0 8px;">
                            Página <span style="color:#fff; font-weight:800;">${window.__detailCurrentPage}</span> de <span style="color:#fff; font-weight:800;">${totalPages}</span>
                        </span>
                        
                        <button onclick="window.__setDetailPage(${window.__detailCurrentPage + 1})" 
                                ${window.__detailCurrentPage >= totalPages ? 'disabled' : ''} 
                                style="background:${window.__detailCurrentPage >= totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(79, 70, 229, 0.15)'}; 
                                       color:${window.__detailCurrentPage >= totalPages ? '#6b7280' : '#fff'}; 
                                       border:1px solid ${window.__detailCurrentPage >= totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(79, 70, 229, 0.3)'}; 
                                       padding:5px 12px; border-radius:8px; cursor:${window.__detailCurrentPage >= totalPages ? 'not-allowed' : 'pointer'}; 
                                       font-size:0.75rem; font-weight:700; transition:all 0.2s; display:flex; align-items:center; gap:4px;" 
                                onmouseover="if(this.disabled !== true) { this.style.background='rgba(79, 70, 229, 0.3)'; this.style.borderColor='var(--primary)'; }" 
                                onmouseout="if(this.disabled !== true) { this.style.background='rgba(79, 70, 229, 0.15)'; this.style.borderColor='rgba(79, 70, 229, 0.3)'; }">
                            Siguiente ▶
                        </button>
                    </div>
                </div>
            </div>
        `}
    </div>
</div>
    `;

    window.setTaskMode = (mode) => { 
        almacenajeTaskMode = mode; 
        localStorage.setItem('almacenajeTaskMode', mode); 
        window.__almacenajeDetailSearchQuery = ''; // Reset filter when switching tabs
        renderAlmacenajeTareas(container); 
    };
    window.setAlmacenajeDetailSearch = (query) => {
        window.__almacenajeDetailSearchQuery = query;
        window.__detailCurrentPage = 1; // Reset page
        renderAlmacenajeTareas(container);
        
        // Restore focus to input element
        const searchInput = document.getElementById('almacenaje_detail_search');
        if (searchInput) {
            searchInput.focus();
            const len = searchInput.value.length;
            searchInput.setSelectionRange(len, len);
        }
    };
    window.processAlmacenajeTasks = async () => { if (await showPremiumConfirm("PROCESAR TAREAS", "¿Deseas procesar el stock actual para generar tareas? Esto se acumulará en el historial.", "warning")) processAlmacenajeTasks(); };
    window.exportAlmacenajeExcel = () => { exportAlmacenajeExcel(); };
    window.resetTask = async (id) => {
        if (user.username !== 'dames') {
            showPremiumAlert("ACCESO DENEGADO", "Solo el usuario 'dames' tiene permisos para reiniciar tareas.", "error");
            return;
        }
        const cleanId = id.includes('_') ? id.split('_')[1] : id;
        if (await showPremiumConfirm("REINICIAR TAREA", `¿Reiniciar la tarea ${cleanId}? Se borrarán los usuarios y horas asignadas.`, "warning")) {
            const t = almacenajeTasksCache.find(x => x.id === id);
            if (t) {
                t.u1 = null; t.u2 = null; t.inicio = null; t.termino = null; t.status = 'Creada';
                await saveAlmacenajeTasks();
                renderAlmacenajeTareas(container);
            }
        }
    };
    window.deleteTask = async (id) => {
        if (user.username !== 'dames') {
            showPremiumAlert("ACCESO DENEGADO", "Solo el usuario 'dames' tiene permisos para eliminar tareas.", "error");
            return;
        }
        const cleanId = id.includes('_') ? id.split('_')[1] : id;
        if (await showPremiumConfirm("ELIMINAR TAREA", `¿ESTÁS SEGURO DE ELIMINAR LA TAREA ${cleanId}?\n\nEsta acción es permanente y se borrará de todos los terminales.`, "danger")) {
            almacenajeTasksCache = almacenajeTasksCache.filter(x => x.id !== id);
            saveAlmacenajeTasks();
            renderAlmacenajeTareas(container);
        }
    };
    window.assignTask = (id) => {
        const t = almacenajeTasksCache.find(x => x.id === id);
        if (t && t.status === 'Finalizado') {
            showPremiumAlert("TAREA BLOQUEADA", "Esta tarea ya está finalizada y bloqueada. Para realizar cualquier cambio, utiliza el botón de edición (✏️).", "warning");
            return;
        }
        const cleanId = id.includes('_') ? id.split('_')[1] : id;
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

        const modal = document.createElement('div');
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
        modal.innerHTML = `
            <div class="glass-panel" style="width:380px; padding:2rem; border:1px solid var(--primary); border-radius:16px;">
                <h3 style="margin:0 0 1.5rem 0; color:#fff; font-size:1.1rem; text-align:center;">Asignar Tarea: <span style="color:var(--primary);">${cleanId}</span></h3>
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
            if (!u1) { showPremiumAlert("ASIGNAR TAREA", "Usuario 1 es obligatorio.", "error"); return; }
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
        if (d === null) {
            window.__almacenajeStartDate = getLogicalDate();
            window.__almacenajeEndDate = getLogicalDate();
        } else {
            window.__almacenajeStartDate = d;
            window.__almacenajeEndDate = d;
        }
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
                if (!selectedDate) { showPremiumAlert("FECHA OPERATIVA", "Por favor selecciona una fecha.", "warning"); return; }
                document.body.removeChild(modal);
                window.processAlmacenajeTasks('update', selectedDate);
            };
            modal.querySelector('#optCancel').onclick = () => document.body.removeChild(modal);
        } catch (err) {
            showPremiumAlert("ERROR CRÍTICO", "Error crítico al abrir calendario: " + err.message, "error");
            console.error(err);
        }
    };

    window.editTaskTimes = async (taskId) => {
        const task = almacenajeTasksCache.find(t => t.id === taskId);
        if (!task) return;

        if (task.status === 'Finalizado') {
            const proceed = await showPremiumConfirm(
                "TAREA FINALIZADA",
                "⚠️ Estás intentando editar una tarea que ya está FINALIZADA.\n\nRecuerda que una tarea finalizada NO se puede REINICIAR ni BORRAR, solo se permite editar sus datos.\n\n¿Deseas continuar con la edición?",
                "warning"
            );
            if (!proceed) return;
        }

        const modal = document.createElement('div');
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);";
        
        // Helper para formatear ISO a input time (HH:mm)
        const toTimeInput = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '';
        
        const cleanTaskId = taskId.includes('_') ? taskId.split('_')[1] : taskId;

        // Obtener operarios ordenados alfabéticamente
        const workers = adminService.getWorkers()
            .filter(w => w.active)
            .sort((a, b) => (a.nombre || a.Nombre || '').localeCompare(b.nombre || b.Nombre || ''));
        const formatUser = (w) => {
            const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
            const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
            return nom ? `${nom[0]}${ape}` : 's/n';
        };

        const u1Options = workers.map(w => `<option value="${formatUser(w)}" ${formatUser(w) === task.u1 ? 'selected' : ''}>${formatUser(w)} (${w.nombre})</option>`).join('');
        const u2Options = workers.map(w => `<option value="${formatUser(w)}" ${formatUser(w) === task.u2 ? 'selected' : ''}>${formatUser(w)} (${w.nombre})</option>`).join('');

        modal.innerHTML = `
            <div class="glass-panel" style="width:400px; padding:2rem; border:1px solid var(--primary); border-radius:15px; box-shadow: 0 0 30px rgba(79,70,229,0.3); max-height:90vh; overflow-y:auto; pointer-events:auto !important;">
                <h3 style="color:#fff; margin-bottom:1.5rem; text-align:center;">✏️ Editar Tarea - ${cleanTaskId}</h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    <div>
                        <label style="color:var(--text-muted); font-size:0.75rem; display:block; margin-bottom:5px;">USUARIO 1 (Obligatorio):</label>
                        <select id="edit_u1" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2); padding:10px; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.95rem;">
                            <option value="" style="background:#0f172a;">Seleccionar operario...</option>
                            ${u1Options}
                        </select>
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.75rem; display:block; margin-bottom:5px;">USUARIO 2 (Opcional):</label>
                        <select id="edit_u2" style="width:100%; background:#0f172a; border:1px solid rgba(255,255,255,0.2); padding:10px; border-radius:8px; color:#fff; outline:none; font-weight:700; font-size:0.95rem;">
                            <option value="" style="background:#0f172a;">Ninguno</option>
                            ${u2Options}
                        </select>
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.75rem; display:block; margin-bottom:5px;">HORA INICIO:</label>
                        <input type="time" id="edit_start" value="${toTimeInput(task.inicio)}" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:1.2rem; font-weight:800; outline:none; color-scheme:dark;">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.75rem; display:block; margin-bottom:5px;">HORA TÉRMINO:</label>
                        <input type="time" id="edit_end" value="${toTimeInput(task.termino)}" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; font-size:1.2rem; font-weight:800; outline:none; color-scheme:dark;">
                    </div>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button id="save_times" class="btn" style="flex:1; background:var(--primary); font-weight:800;">GUARDAR CAMBIOS</button>
                        <button id="close_edit" class="btn" style="flex:1; background:rgba(255,255,255,0.05); color:var(--text-muted);">CANCELAR</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#save_times').onclick = () => {
            const u1 = modal.querySelector('#edit_u1').value;
            const u2 = modal.querySelector('#edit_u2').value;
            const newStart = modal.querySelector('#edit_start').value;
            const newEnd = modal.querySelector('#edit_end').value;
            
            if (!u1) { showPremiumAlert("EDITAR TAREA", "El Usuario 1 es obligatorio.", "error"); return; }
            if (newEnd && !newStart) {
                showPremiumAlert("EDITAR TAREA", "Si ingresas la Hora de Término, también debes ingresar la Hora de Inicio.", "warning");
                return;
            }

            // Re-construir ISO conservando la fecha original de la tarea
            const baseDate = task.fecha || new Date().toISOString().split('T')[0];
            
            task.u1 = u1;
            task.u2 = u2 || '';

            if (newStart) {
                task.inicio = `${baseDate}T${newStart}:00`;
            } else {
                task.inicio = null;
            }

            if (newEnd) {
                task.termino = `${baseDate}T${newEnd}:00`;
            } else {
                task.termino = null;
            }
            
            // Recalcular Status
            if (task.inicio && task.termino) {
                task.status = 'Finalizado';
            } else if (task.inicio) {
                task.status = 'Asignado';
            } else {
                task.status = 'Creada';
            }

            saveAlmacenajeTasks().then(() => {
                document.body.removeChild(modal);
                renderAlmacenajeTareas(container);
            });
        };
        modal.querySelector('#close_edit').onclick = () => document.body.removeChild(modal);
    };

    window.processAlmacenajeTasks = processAlmacenajeTasks;

    window.clearCurrentShiftTasks = async () => {
        const startDisplay = window.__almacenajeStartDate.split('-').reverse().join('/');
        const endDisplay = window.__almacenajeEndDate.split('-').reverse().join('/');
        
        if (await showPremiumConfirm(
            "BORRAR TAREAS CREADAS", 
            `¿Borrar TODAS las tareas con status "CREADA" del rango seleccionado (${startDisplay} al ${endDisplay})?\n\n(No se borrarán tareas asignadas o finalizadas, ni tareas fuera de estas fechas)`, 
            "danger"
        )) {
            almacenajeTasksCache = almacenajeTasksCache.filter(t => {
                if (t.status !== 'Creada') return true;
                if (t.fecha < window.__almacenajeStartDate || t.fecha > window.__almacenajeEndDate) return true;
                return false;
            });
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
                console.log("🔄 [PULSE] Sincronizando con la nube (Fusión Híbrida)...");
                
                // 1. Sincronizar con el servidor (PULL GLOBAL)
                await adminService.initializeAdminData(true);
                const serverTasks = adminService.adminStore.almacenaje_tasks;
                
                if (Array.isArray(serverTasks)) {
                    // [FUSIÓN HÍBRIDA] No permitir que la nube borre detalles locales
                    almacenajeTasksCache = serverTasks.map(newTask => {
                        const localTask = almacenajeTasksCache.find(lt => lt.id === newTask.id);
                        if (localTask && (!newTask.items || newTask.items.length === 0) && localTask.items && localTask.items.length > 0) {
                            return { ...newTask, items: localTask.items };
                        }
                        return newTask;
                    });
                    localStorage.setItem('logistics_sync_v24_almacenaje_tasks', JSON.stringify(almacenajeTasksCache));
                    console.log(`✅ [PULSE] ${serverTasks.length} tareas fusionadas.`);
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

  if (isDriverRole) {
      container.className = 'animate-fade-in';
      container.innerHTML = `<div id="contentArea" style="width:100%; min-height:100vh; background:#0b1329;"></div>`;
      const contentArea = document.getElementById('contentArea');
      document.body.classList.add('mobile-driver-active');
      renderDespachoNoRetailPortal(contentArea);
      return;
  }

  renderNav();
  renderTabContent();
  startRealTimeSync();
};
