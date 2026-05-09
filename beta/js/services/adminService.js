/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v12.4.65)
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
        
        const fetchWithTimeout = (url, options, timeout = 10000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de Sincronización (10s)')), timeout))
            ]);
        };

        await Promise.all(areas.map(async (area) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}/${area}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        adminStore[area] = result.data;
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
                        if (s.subTabs) {
                           s.subTabs.forEach(ss => {
                               p[`${s.id}_${ss.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                           });
                        }
                    });
                }
            });
            adminStore.permissions[role] = p;
        }
    });
};

export const togglePermission = (role, tabId) => {
    const p = getPermissions(role);
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    savePermissions(role, p);
};

export const saveWorker = async (worker) => {
    const workers = getWorkers();
    const idx = workers.findIndex(w => w.dni === worker.dni);
    if (idx >= 0) workers[idx] = { ...workers[idx], ...worker };
    else workers.push({ ...worker, active: true });
    return await save('workers', workers);
};

export const saveWorkers = async (newWorkers) => {
    const workers = getWorkers();
    newWorkers.forEach(nw => {
        const idx = workers.findIndex(w => w.dni === nw.dni);
        if (idx >= 0) workers[idx] = { ...workers[idx], ...nw };
        else workers.push({ ...nw, active: true });
    });
    return await save('workers', workers);
};

export const toggleWorkerStatus = (dni) => {
    const workers = getWorkers();
    const idx = workers.findIndex(w => w.dni === dni);
    if (idx >= 0) {
        workers[idx].active = workers[idx].active === false ? true : false;
        save('workers', workers);
    }
};

export const saveUser = async (user) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === user.username);
    if (idx >= 0) users[idx] = { ...users[idx], ...user };
    else users.push({ ...user, active: true });
    return await save('users', users);
};

export const toggleUserStatus = (username) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx >= 0) {
        users[idx].active = users[idx].active === false ? true : false;
        save('users', users);
    }
};

export const deleteUser = (username) => {
    const users = getUsers().filter(u => u.username !== username);
    save('users', users);
};

export const savePermissions = async (role, perms) => {
    adminStore.permissions[role] = perms;
    return await save('permissions', adminStore.permissions);
};

// --- ASISTENCIA ---
export const saveAttendance = async (date, data) => {
    adminStore.attendance[date] = data;
    
    // Al cerrar asistencia, generamos log de performance si no existe
    if (data.finalized) {
        const perfLog = adminStore.performance_log;
        data.data.forEach(att => {
            const exists = perfLog.find(l => l.date === date && l.dni === att.dni);
            if (!exists) {
                perfLog.push({
                    date: date,
                    dni: att.dni,
                    nombre: att.nombre,
                    apellidos: att.apellidos,
                    asistencia: att.present ? 'P' : 'F',
                    puntualidad: att.onTime ? 'SÍ' : 'NO',
                    produccion: att.present ? 10 : 0,
                    bpa: att.present ? 10 : 0,
                    supervisor: att.present ? 10 : 0,
                    justification: att.justification || '',
                    rendimiento: att.present ? '100%' : '0%'
                });
            }
        });
        save('performance_log', perfLog);
    }

    return await save('attendance', adminStore.attendance);
};
export const getAttendance = (date) => adminStore.attendance[date] || null;

// --- PERFORMANCE ---
export const getPerformanceLog = () => adminStore.performance_log;

export const updatePerformanceLogEntry = (date, dni, fields) => {
    const log = adminStore.performance_log;
    const idx = log.findIndex(l => l.date === date && l.dni === dni);
    if (idx >= 0) {
        log[idx] = { ...log[idx], ...fields };
        
        // Recalcular rendimiento % (Producción + BPA + Supervisor) / 30
        const p = parseFloat(log[idx].produccion) || 0;
        const b = parseFloat(log[idx].bpa) || 0;
        const s = parseFloat(log[idx].supervisor) || 0;
        const rend = Math.round(((p + b + s) / 30) * 100);
        log[idx].rendimiento = rend + '%';
        
        save('performance_log', log);
    }
};

// --- REINICIO DE DATOS ---
export const resetProductionData = async () => {
    console.log("⚠️ [PULSE] Iniciando reinicio maestro de datos de producción...");
    await save('attendance', {});
    await save('performance_log', []);
    console.log("✅ [PULSE] Datos reiniciados satisfactoriamente.");
};

export const saveAlmacenajeTasks = async (tasks) => {
    try {
        adminStore.almacenaje_tasks = tasks;
        localStorage.setItem(PREFIX + 'almacenaje_tasks', JSON.stringify(tasks));
        const success = await save('almacenaje_tasks', tasks);
        return success;
    } catch (e) {
        console.warn("⚠️ Error guardando tareas en servidor:", e);
        return false;
    }
};
export const loadAlmacenajeTasks = async () => {
    try {
        console.log("🔍 [PULSE] Solicitando tareas al servidor...");
        const res = await fetch(`${API_URL}/almacenaje_tasks`);
        if (res.ok) {
            const result = await res.json();
            const data = result.data || [];
            adminStore.almacenaje_tasks = data;
            localStorage.setItem(PREFIX + 'almacenaje_tasks', JSON.stringify(data));
            alert(`🔍 RADAR: El servidor informa ${data.length} tareas activas.`);
            return data;
        }
        alert("❌ RADAR: El servidor no respondió correctamente.");
        return adminStore.almacenaje_tasks;
    } catch (e) {
        alert("❌ RADAR: Error de conexión con la nube.");
        return adminStore.almacenaje_tasks;
    }
};
