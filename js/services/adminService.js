/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v14.3.0 - APISONADORA)
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
    } catch (e) { }

    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log', 'almacenaje_tasks'];
        await Promise.all(areas.map(async (area) => {
            try {
                const res = await fetch(`${API_URL}/${area}?z=${Date.now()}`);
                if (res.ok) {
                    const result = await res.json();
                    let serverData = result.data;
                    if (!serverData) return;
                    if (area === 'permissions' || area === 'attendance') {
                        serverData = (typeof serverData === 'object' && !Array.isArray(serverData)) ? serverData : {};
                    } else {
                        serverData = Array.isArray(serverData) ? serverData : (serverData.data || []);
                    }
                    const localData = adminStore[area];
                    const serverIsEmpty = (Array.isArray(serverData) && serverData.length === 0) || (typeof serverData === 'object' && Object.keys(serverData).length === 0);
                    const localIsNotEmpty = (Array.isArray(localData) && localData.length > 0) || (typeof localData === 'object' && Object.keys(localData).length > 0);
                    if (serverIsEmpty && localIsNotEmpty) return;
                    adminStore[area] = serverData;
                    localStorage.setItem(PREFIX + area, JSON.stringify(serverData));
                }
            } catch (err) { }
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

// --- GETTERS ---
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
export const saveAttendance = async (dateStr, data, username) => {
    adminStore.attendance[dateStr] = { data, ts: Date.now(), user: username };
    return await save('attendance', adminStore.attendance);
};

// --- APISONADORA DE PERMISOS BLINDADA ---
export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente', 'analista'];
    
    // Lista de Hierro (IDs exactos de Daniel)
    const forcedAsistente = [
        'inicio',
        'almacenaje', 'almacenaje_archivo_almacenaje', 'almacenaje_tareas_dia', 'almacenaje_kpi_tareas',
        'buffer', 'buffer_maestros', 'buffer_reportes', 'buffer_historial_buffer', 'buffer_kpi_buffer',
        'admin_pers', 'admin_pers_asistencia', 'admin_pers_performance', 'admin_pers_rfs',
        'performance_historial', 'performance_graficos', 'performance_reporte'
    ];

    roles.forEach(role => {
        if (!adminStore.permissions[role]) adminStore.permissions[role] = {};
        const p = adminStore.permissions[role];
        
        tabs.forEach(t => {
            // Nivel 1: Pestañas Principales
            if (role === 'asistente' && forcedAsistente.includes(t.id)) p[t.id] = 1;
            if (p[t.id] === undefined) p[t.id] = (role === 'admin' || role === 'jefe') ? 1 : 0;
            
            if (t.subTabs) {
                t.subTabs.forEach(s => {
                    const subKey = `${t.id}_${s.id}`;
                    // Nivel 2: Sub-pestañas
                    if (role === 'asistente' && forcedAsistente.includes(subKey)) p[subKey] = 1;
                    if (p[subKey] === undefined) p[subKey] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                    
                    if (s.subTabs) {
                        s.subTabs.forEach(ss => {
                            const ssKey = `${s.id}_${ss.id}`;
                            // Nivel 3: Sub-sub-pestañas (Performance)
                            if (role === 'asistente' && forcedAsistente.includes(ssKey)) p[ssKey] = 1;
                            if (p[ssKey] === undefined) p[ssKey] = (role === 'admin' || role === 'jefe') ? 1 : 0;
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
