/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v12.4.2)
 */
const PREFIX = 'logistics_admin_v11_';
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const API_URL = `${API_BASE}/logistics`;

export const adminStore = {
    workers: [],
    users: [],
    permissions: {},
    attendance: {}, // Keyed by date YYYY-MM-DD
    performance: [],
    performance_log: [],
    almacenaje_tasks: []
};

// Carga inicial híbrida (Local + Servidor)
export const initializeAdminData = async () => {
    // 1. Carga rápida desde LocalStorage
    try {
        adminStore.workers = JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]');
        adminStore.users = JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]');
        adminStore.permissions = JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}');
        adminStore.attendance = JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}');
        adminStore.performance = JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]');
        adminStore.performance_log = JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]');
        adminStore.almacenaje_tasks = JSON.parse(localStorage.getItem(PREFIX + 'almacenaje_tasks') || '[]');
    } catch (e) {
        console.warn("⚠️ Error cargando datos locales (posible corrupción):", e);
    }

    // 2. Sincronización con Servidor (Sincronización Inteligente)
    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log', 'almacenaje_tasks'];
        
        // Función con Timeout de 4s para no bloquear la UI
        const fetchWithTimeout = (url, options, timeout = 4000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de Sincronización')), timeout))
            ]);
        };

        await Promise.all(areas.map(async (area) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}/${area}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        adminStore[area] = result.data;
                        // Intentar guardar localmente
                        localStorage.setItem(PREFIX + area, JSON.stringify(result.data));
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Sincronización de ${area} fallida (usando local):`, err.message);
            }
        }));
    } catch (e) {
        console.warn("⚠️ Error general de sincronización:", e);
    }
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
    } catch (e) {
        console.warn(`⚠️ Error guardando ${area} en servidor:`, e);
        return false;
    }
};

export const getWorkers = () => adminStore.workers;
export const getUsers = () => adminStore.users;
export const getPermissions = (role) => adminStore.permissions[role] || {};

export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente', 'analista'];
    roles.forEach(role => {
        if (!adminStore.permissions[role]) {
            const p = {};
            tabs.forEach(t => {
                p[t.id] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                if (t.subTabs) {
                    t.subTabs.forEach(s => {
                        p[`${t.id}_${s.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                    });
                }
            });
            adminStore.permissions[role] = p;
        }
    });
};

export const saveWorker = async (worker) => {
    const workers = getWorkers();
    const idx = workers.findIndex(w => w.dni === worker.dni);
    if (idx >= 0) workers[idx] = worker;
    else workers.push(worker);
    return await save('workers', workers);
};

export const saveUser = async (user) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === user.username);
    if (idx >= 0) users[idx] = user;
    else users.push(user);
    return await save('users', users);
};

export const savePermissions = async (role, perms) => {
    adminStore.permissions[role] = perms;
    return await save('permissions', adminStore.permissions);
};

// --- ASISTENCIA ---
export const saveAttendance = async (date, data) => {
    adminStore.attendance[date] = data;
    return await save('attendance', adminStore.attendance);
};
export const getAttendance = (date) => adminStore.attendance[date] || [];

// --- PERFORMANCE ---
const calculateRendimientoValue = (entry) => {
    const qty = parseFloat(entry.cantidad) || 0;
    const meta = parseFloat(entry.meta) || 1;
    const tiempo = parseFloat(entry.tiempo) || 1;
    return (qty / (meta * tiempo)) * 100;
};

export const savePerformanceLog = async (entry) => {
    const log = adminStore.performance_log;
    log.push({
        ...entry,
        id: Date.now().toString(),
        ts: new Date().toISOString(),
        rendimiento: calculateRendimientoValue(entry)
    });
    return await save('performance_log', log);
};

export const updatePerformanceLog = (id, fields) => {
    const log = adminStore.performance_log;
    const idx = log.findIndex(l => l.id === id);
    if (idx >= 0) {
        log[idx] = { ...log[idx], ...fields };
        log[idx].rendimiento = calculateRendimientoValue(log[idx]);
        save('performance_log', log);
    }
};

export const getPerformance = () => adminStore.performance;
export const updatePerformanceEntry = (dni, fields) => {
    const perf = getPerformance();
    const idx = perf.findIndex(p => p.dni === dni);
    if (idx >= 0) {
        perf[idx] = { ...perf[idx], ...fields };
        save('performance', perf);
    }
};

// --- REINICIO DE DATOS ---
export const resetProductionData = async () => {
    console.log("⚠️ [PULSE] Iniciando reinicio maestro de datos de producción...");
    await save('attendance', {});
    await save('performance', []);
    await save('performance_log', []);
    console.log("✅ [PULSE] Datos reiniciados satisfactoriamente.");
};

export const saveAlmacenajeTasks = async (tasks) => {
    try {
        adminStore.almacenaje_tasks = tasks;
        localStorage.setItem(PREFIX + 'almacenaje_tasks', JSON.stringify(tasks));

        const res = await fetch(`${API_URL}/almacenaje_tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: tasks })
        });
        return res.ok;
    } catch (e) {
        console.warn("⚠️ Error guardando tareas en servidor:", e);
        return false;
    }
};
