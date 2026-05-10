/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v14.2.0 - BLINDADO)
 */
const PREFIX = 'logistics_admin_v11_';
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const API_URL = `${API_BASE}/logistics`;

export const adminStore = {
    workers: [],
    users: [],
    permissions: {},
    attendance: {}, 
    performance: [],
    performance_log: [],
    almacenaje_tasks: []
};

// --- CARGA Y SINCRONIZACIÓN ---
export const initializeAdminData = async () => {
    try {
        adminStore.workers = JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]');
        adminStore.users = JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]');
        adminStore.permissions = JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}');
        adminStore.attendance = JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}');
        adminStore.performance = JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]');
        adminStore.performance_log = JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]');
        adminStore.almacenaje_tasks = JSON.parse(localStorage.getItem(PREFIX + 'almacenaje_tasks') || '[]');
    } catch (e) { console.warn("Error local:", e); }

    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log', 'almacenaje_tasks'];
        await Promise.all(areas.map(async (area) => {
            try {
                const res = await fetch(`${API_URL}/${area}?z=${Date.now()}`);
                if (res.ok) {
                    const result = await res.json();
                    let serverData = result.data;
                    if (!serverData) return;

                    // Normalización de datos
                    if (area === 'permissions' || area === 'attendance') {
                        serverData = (typeof serverData === 'object' && !Array.isArray(serverData)) ? serverData : {};
                    } else {
                        serverData = Array.isArray(serverData) ? serverData : (serverData.data || []);
                    }

                    // [BLINDAJE] No sobrescribir si el servidor viene vacío y nosotros tenemos datos
                    const localData = adminStore[area];
                    const serverIsEmpty = (Array.isArray(serverData) && serverData.length === 0) || (typeof serverData === 'object' && Object.keys(serverData).length === 0);
                    const localIsNotEmpty = (Array.isArray(localData) && localData.length > 0) || (typeof localData === 'object' && Object.keys(localData).length > 0);

                    if (serverIsEmpty && localIsNotEmpty) {
                        console.log(`[PULSE] Manteniendo datos locales para ${area} (servidor vacío).`);
                        return;
                    }

                    adminStore[area] = serverData;
                    localStorage.setItem(PREFIX + area, JSON.stringify(serverData));
                }
            } catch (err) { console.warn(`Sync failed for ${area}`); }
        }));
    } catch (e) { }
};

export const save = async (area, data) => {
    try {
        adminStore[area] = data;
        localStorage.setItem(PREFIX + area, JSON.stringify(data));
        const res = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });
        return res.ok;
    } catch (e) { return false; }
};

// --- GETTERS COMPLETOS (REPARADOS) ---
export const getWorkers = () => adminStore.workers;
export const getUsers = () => adminStore.users;
export const getPermissions = (role) => adminStore.permissions[role] || {};
export const getAttendance = (dateStr) => adminStore.attendance[dateStr];
export const getPerformance = () => adminStore.performance;
export const getPerformanceLog = () => adminStore.performance_log;
export const getAlmacenajeTasks = () => adminStore.almacenaje_tasks;

// --- SETTERS ---
export const saveWorkers = (data) => save('workers', data);
export const saveUsers = (data) => save('users', data);
export const savePermissions = (role, data) => {
    adminStore.permissions[role] = data;
    return save('permissions', adminStore.permissions);
};
export const savePerformance = (data) => save('performance', data);
export const savePerformanceLog = (data) => save('performance_log', data);
export const saveAlmacenajeTasks = (data) => save('almacenaje_tasks', data);

// --- LÓGICA DE PERMISOS BLINDADA ---
export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente', 'analista'];
    roles.forEach(role => {
        if (!adminStore.permissions[role]) adminStore.permissions[role] = {};
        const p = adminStore.permissions[role];
        
        tabs.forEach(t => {
            // [HARD LOCK] Lista de Hierro para Asistente (Imagen Daniel)
            if (role === 'asistente') {
                const forced = [
                    'inicio',
                    'almacenaje', 'almacenaje_archivo_almacenaje', 'almacenaje_tareas_dia', 'almacenaje_kpi_tareas',
                    'buffer', 'buffer_maestros', 'buffer_reportes', 'buffer_historial_buffer', 'buffer_kpi_buffer',
                    'admin_pers', 'admin_pers_asistencia', 'admin_pers_performance', 'admin_pers_rfs',
                    'performance_historial', 'performance_graficos', 'performance_reporte'
                ];
                if (forced.includes(t.id)) p[t.id] = 1;
            }

            if (p[t.id] === undefined) {
                p[t.id] = (role === 'admin' || role === 'jefe') ? 1 : 0;
            }
            
            if (t.subTabs) {
                t.subTabs.forEach(s => {
                    if (p[`${t.id}_${s.id}`] === undefined) {
                        p[`${t.id}_${s.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                    }
                    if (s.subTabs) {
                        s.subTabs.forEach(ss => {
                            if (p[`${s.id}_${ss.id}`] === undefined) {
                                p[`${s.id}_${ss.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                            }
                        });
                    }
                });
            }
        });
    });
};

export const togglePermission = (role, tabId) => {
    const p = getPermissions(role);
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    save('permissions', adminStore.permissions);
};
