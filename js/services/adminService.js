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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                const res = await fetch(`${API_URL}/${area}?z=${Date.now()}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const result = await res.json();
                    let serverData = result.data !== undefined ? result.data : result;
                    if (serverData === undefined || serverData === null) return;
                    
                    // AUTO-CLEAN RECURSIVO: Eliminar cualquier nivel de anidamiento {"data": {"data": ...}}
                    while (serverData && typeof serverData === 'object' && serverData.data !== undefined && !Array.isArray(serverData)) {
                        console.warn(`[PULSE] Deep cleaning nested data for ${area}`);
                        serverData = serverData.data;
                    }

                    if (area === 'attendance' || area === 'permissions') {
                        const newObj = (typeof serverData === 'object' && !Array.isArray(serverData)) ? serverData : {};
                        
                        // PROTECCIÓN PARA PERMISOS: No sobrescribir con objeto vacío si ya tenemos datos locales
                        if (area === 'permissions' && Object.keys(newObj).length === 0 && Object.keys(adminStore.permissions).length > 0) {
                            console.warn("[PULSE] Ignoring empty permissions from cloud to protect UI");
                        } else {
                            // MEZCLA INTELIGENTE: No reemplazamos, sumamos lo nuevo a lo que ya tenemos
                            adminStore[area] = { ...adminStore[area], ...newObj };
                        }
                    } else {
                        // Para arrays, intentamos mezclar por ID o simplemente concatenar si es necesario, 
                        // pero por ahora mantenemos el reemplazo para evitar duplicados infinitos en listas simples.
                        adminStore[area] = Array.isArray(serverData) ? serverData : [];
                    }
                    localStorage.setItem(PREFIX + area, JSON.stringify(adminStore[area]));
                    console.log(`[PULSE] Cloud Sync OK (Merged): ${area}`);
                }
            } catch (err) { 
                console.warn(`[PULSE] Sync Timeout/Error for ${area}`);
            }
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
        
        // NO ENVOLVER EN {data: ...} para evitar anidamiento infinito
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`${API_URL}/${area}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data), // ENVIAR DATA DIRECTAMENTE
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

// --- ASISTENCIA Y PERFORMANCE (RESTAURADO) ---
export const closeAttendanceAndSyncPerformance = async (date, attendanceData) => {
    // 1. Marcar como cerrada
    const newState = { data: attendanceData, ts: Date.now(), finalized: true };
    adminStore.attendance[date] = newState;
    const ok1 = await save('attendance', adminStore.attendance);
    if (!ok1) return false;

    // 2. Generar logs para el historial con valores fijos (10, 10, 9)
    const newLogs = attendanceData.map(a => {
        let score = 0;
        if (a.present) score += 30; 
        if (a.present && a.onTime) score += 10;
        
        // Precarga de valores fijos si está presente
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
    // BLINDAJE DE SEGURIDAD TOTAL: Solo 'dames' puede ejecutar esto
    const currentUser = JSON.parse(localStorage.getItem('logistics_session') || '{}');
    const username = (currentUser.username || '').toLowerCase();
    
    if (username !== 'dames' && currentUser.role !== 'admin') {
        alert("⛔ ACCESO DENEGADO: Solo el administrador central puede reabrir asistencias.");
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
    // BLINDAJE: No permitir sobrescribir si ya está finalizado en memoria, 
    // a menos que el nuevo estado sea explícitamente una reapertura.
    if (adminStore.attendance[date]?.finalized && state.finalized === false) {
        console.warn(`[PULSE] Intento de sobrescribir fecha cerrada: ${date}`);
        return false;
    }
    adminStore.attendance[date] = state;
    return await save('attendance', adminStore.attendance);
};

export const updatePerformanceLogEntry = async (date, dni, updates) => {
    const entry = adminStore.performance_log.find(p => String(p.dni) === String(dni) && p.date === date);
    if (entry) {
        Object.assign(entry, updates);
        
        // RECALCULO AUTOMATICO DE RENDIMIENTO
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
