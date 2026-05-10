/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v14.5.5 - RESTAURACIÓN TOTAL)
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
                    if (serverData === undefined || serverData === null) return;
                    if (area === 'permissions' || area === 'attendance') {
                        serverData = (typeof serverData === 'object' && !Array.isArray(serverData)) ? serverData : {};
                    } else {
                        serverData = Array.isArray(serverData) ? serverData : (serverData.data || []);
                    }
                    adminStore[area] = serverData;
                    localStorage.setItem(PREFIX + area, JSON.stringify(serverData));
                }
            } catch (err) { }
        }));
    } catch (e) { }
};

export const loadAlmacenajeTasks = async () => {
    await initializeAdminData();
    return adminStore.almacenaje_tasks;
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

// --- ASISTENCIA Y PERFORMANCE (RESTAURADO) ---
export const closeAttendanceAndSyncPerformance = async (date, attendanceData) => {
    // 1. Marcar como cerrada
    adminStore.attendance[date] = { data: attendanceData, ts: Date.now(), closed: true };
    await save('attendance', adminStore.attendance);

    // 2. Generar logs para el historial
    const newLogs = attendanceData.map(a => ({
        date,
        dni: a.dni,
        nombre: a.nombre,
        apellidos: a.apellidos,
        asistencia: a.present ? 'P' : 'F',
        puntualidad: a.onTime ? 'SÍ' : 'NO',
        justificacion: a.justification || '',
        rendimiento: a.present ? '40%' : '0%' 
    }));
    
    adminStore.performance_log = [...adminStore.performance_log.filter(l => l.date !== date), ...newLogs];
    await save('performance_log', adminStore.performance_log);
    return true;
};

export const reopenAttendance = async (date) => {
    if (adminStore.attendance[date]) {
        delete adminStore.attendance[date];
        await save('attendance', adminStore.attendance);
    }
    adminStore.performance_log = adminStore.performance_log.filter(l => l.date !== date);
    await save('performance_log', adminStore.performance_log);
    return true;
};

// --- OTROS SETTERS ---
export const saveWorkers = (data) => save('workers', data);
export const saveUsers = (data) => save('users', data);
export const savePermissions = (role, data) => {
    adminStore.permissions[role] = data;
    return save('permissions', adminStore.permissions);
};
export const savePerformance = (data) => save('performance', data);
export const savePerformanceLog = (data) => save('performance_log', data);
export const saveAlmacenajeTasks = (data) => save('almacenaje_tasks', data);

// --- LISTA DE HIERRO ---
export const FORCED_ASISTENTE = [
    'inicio',
    'almacenaje', 'almacenaje_archivo_almacenaje', 'almacenaje_tareas_dia', 'almacenaje_kpi_tareas',
    'buffer', 'buffer_maestros', 'buffer_reportes', 'buffer_historial_buffer', 'buffer_kpi_buffer',
    'admin_pers', 'admin_pers_asistencia', 'admin_pers_performance', 'admin_pers_rfs',
    'performance_historial', 'performance_graficos', 'performance_reporte'
];

export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente', 'analista'];
    roles.forEach(role => {
        if (!adminStore.permissions[role]) adminStore.permissions[role] = {};
        const p = adminStore.permissions[role];
        tabs.forEach(t => {
            if (role === 'asistente' && FORCED_ASISTENTE.includes(t.id)) p[t.id] = 1;
            if (p[t.id] === undefined) p[t.id] = (role === 'admin' || role === 'jefe') ? 1 : 0;
            if (t.subTabs) {
                t.subTabs.forEach(s => {
                    const subKey = `${t.id}_${s.id}`;
                    if (role === 'asistente' && FORCED_ASISTENTE.includes(subKey)) p[subKey] = 1;
                    if (p[subKey] === undefined) p[subKey] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                    if (s.subTabs) {
                        s.subTabs.forEach(ss => {
                            const ssKey = `${s.id}_${ss.id}`;
                            if (role === 'asistente' && FORCED_ASISTENTE.includes(ssKey)) p[ssKey] = 1;
                            if (p[ssKey] === undefined) p[ssKey] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                        });
                    }
                });
            }
        });
    });
};

export const togglePermission = (role, tabId) => {
    if (role === 'asistente' && FORCED_ASISTENTE.includes(tabId)) return;
    const p = getPermissions(role);
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    save('permissions', adminStore.permissions);
};
