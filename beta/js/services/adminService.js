/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v17.1.1 - RESTAURACIÓN TOTAL)
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                const res = await fetch(`${API_URL}/${area}?z=${Date.now()}`, { 
                    signal: controller.signal,
                    headers: { 'X-Environment': 'production' }
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const result = await res.json();
                    let serverData = result.data !== undefined ? result.data : result;
                    if (serverData === undefined || serverData === null) return;
                    
                    if (serverData && typeof serverData === 'object' && serverData.data !== undefined && !Array.isArray(serverData)) {
                        const nested = serverData.data;
                        delete serverData.data;
                        if (typeof nested === 'object' && !Array.isArray(nested)) {
                            serverData = { ...serverData, ...nested };
                        } else {
                            serverData = nested; 
                        }
                    }

                    if (area === 'attendance' || area === 'permissions') {
                        const newObj = (typeof serverData === 'object' && !Array.isArray(serverData)) ? serverData : {};
                        if (area === 'permissions' && Object.keys(newObj).length === 0 && Object.keys(adminStore.permissions).length > 0) {
                            console.warn("[PULSE] Ignoring empty permissions from cloud");
                        } else {
                            adminStore[area] = { ...adminStore[area], ...newObj };
                        }
                    } else {
                        adminStore[area] = Array.isArray(serverData) ? serverData : [];
                    }
                    localStorage.setItem(PREFIX + area, JSON.stringify(adminStore[area]));
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
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify(data),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
            console.error(`[PULSE] Error saving ${area}: ${res.status}`);
            return false;
        }
        
        return true;
    } catch (e) { 
        console.error(`[PULSE] Critical Save Error:`, e);
        return false; 
    }
};

// --- GETTERS ---
export const getWorkers = () => adminStore.workers;
export const getUsers = () => adminStore.users;
export const getPermissions = (role) => adminStore.permissions[role] || {};
export const getAttendance = (dateStr) => adminStore.attendance[dateStr];
export const getPerformance = () => adminStore.performance;
export const getPerformanceLog = () => adminStore.performance_log;
export const getAlmacenajeTasks = () => adminStore.almacenaje_tasks;

// --- ASISTENCIA Y PERFORMANCE ---
export const closeAttendanceAndSyncPerformance = async (date, attendanceData) => {
    const newState = { data: attendanceData, ts: Date.now(), finalized: true };
    adminStore.attendance[date] = newState;
    const ok1 = await save('attendance', adminStore.attendance);
    if (!ok1) return false;

    const newLogs = attendanceData.map(a => {
        let score = 0;
        if (a.present) score += 30; 
        if (a.present && a.onTime) score += 10;
        
        const isP = a.present;
        const prod = isP ? 10 : 0;
        const bpa = isP ? 10 : 0;
        const sup = isP ? 9 : 0;
        
        if (isP) {
            score += (prod / 10) * 30; 
            score += (bpa / 10) * 15; 
            score += (sup / 10) * 15; 
        }
        
        return {
            date,
            dni: a.dni,
            nombre: a.nombre,
            apellidos: a.apellidos,
            asistencia: a.present ? 'P' : 'F',
            puntualidad: a.onTime ? 'SÍ' : 'NO',
            produccion: prod,
            bpa: bpa,
            supervisor: sup,
            justification: a.justification || '',
            rendimiento: Math.round(score) + '%'
        };
    });
    
    adminStore.performance_log = [...adminStore.performance_log.filter(l => l.date !== date), ...newLogs];
    const ok2 = await save('performance_log', adminStore.performance_log);
    return ok1 && ok2;
};

export const reopenAttendance = async (date) => {
    const currentUser = JSON.parse(localStorage.getItem('logistics_session') || '{}');
    const username = (currentUser.username || '').toLowerCase();
    
    if (username !== 'dames' && currentUser.role !== 'admin') {
        alert("⛔ ACCESO DENEGADO");
        return false;
    }

    if (adminStore.attendance[date]) {
        adminStore.attendance[date].finalized = false;
        adminStore.attendance[date].ts = Date.now();
        await save('attendance', adminStore.attendance);
    }
    adminStore.performance_log = adminStore.performance_log.filter(l => l.date !== date);
    await save('performance_log', adminStore.performance_log);
    return true;
};

export const saveAttendance = async (date, state) => {
    if (adminStore.attendance[date]?.finalized && state.finalized === false) return false;
    adminStore.attendance[date] = state;
    return await save('attendance', adminStore.attendance);
};

export const updatePerformanceLogEntry = async (date, dni, updates) => {
    const entry = adminStore.performance_log.find(p => String(p.dni) === String(dni) && p.date === date);
    if (entry) {
        Object.assign(entry, updates);
        let score = 0;
        if (entry.asistencia === 'P') score += 30;
        if (entry.asistencia === 'P' && entry.puntualidad === 'SÍ') score += 10;
        const prod = parseFloat(entry.produccion) || 0;
        const bpa = parseFloat(entry.bpa) || 0;
        const sup = parseFloat(entry.supervisor) || 0;
        score += (prod / 10) * 30;
        score += (bpa / 10) * 15;
        score += (sup / 10) * 15;
        entry.rendimiento = Math.round(score) + '%';
        await save('performance_log', adminStore.performance_log);
        return true;
    }
    return false;
};

export const saveWorkers = (data) => save('workers', data);
export const saveWorker = async (worker) => {
    const idx = adminStore.workers.findIndex(w => String(w.dni) === String(worker.dni));
    if (idx !== -1) adminStore.workers[idx] = { ...adminStore.workers[idx], ...worker };
    else adminStore.workers.push({ ...worker, active: true });
    return await save('workers', adminStore.workers);
};

export const deleteWorker = async (dni) => {
    adminStore.workers = adminStore.workers.filter(w => String(w.dni) !== String(dni));
    return await save('workers', adminStore.workers);
};

export const toggleWorkerStatus = async (dni) => {
    const worker = adminStore.workers.find(w => String(w.dni) === String(dni));
    if (worker) {
        worker.active = worker.active !== false ? false : true;
        return await save('workers', adminStore.workers);
    }
    return false;
};

export const saveUsers = (data) => save('users', data);
export const saveUser = async (user) => {
    const idx = adminStore.users.findIndex(u => u.username === user.username);
    if (idx !== -1) adminStore.users[idx] = { ...adminStore.users[idx], ...user };
    else adminStore.users.push({ ...user, active: true });
    return await save('users', adminStore.users);
};

export const deleteUser = async (username) => {
    adminStore.users = adminStore.users.filter(u => u.username !== username);
    return await save('users', adminStore.users);
};

export const toggleUserStatus = async (username) => {
    const user = adminStore.users.find(u => u.username === username);
    if (user) {
        user.active = user.active !== false ? false : true;
        return await save('users', adminStore.users);
    }
    return false;
};

export const savePermissions = (role, data) => {
    adminStore.permissions[role] = data;
    return save('permissions', adminStore.permissions);
};
export const savePerformance = (data) => save('performance', data);
export const savePerformanceLog = (data) => save('performance_log', data);
export const saveAlmacenajeTasks = (data) => save('almacenaje_tasks', data);

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
    const p = adminStore.permissions[role] || {};
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    save('permissions', adminStore.permissions);
};
