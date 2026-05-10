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
        const localTasks = JSON.parse(localStorage.getItem(PREFIX + 'almacenaje_tasks') || '[]');
        adminStore.almacenaje_tasks = Array.isArray(localTasks) ? localTasks : [];
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
                        // [CORRECCIÓN] Manejo inteligente de tipos: Objetos vs Arrays
                        let serverData;
                        if (area === 'permissions' || area === 'attendance') {
                            serverData = (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) ? result.data : (adminStore[area] || {});
                        } else {
                            serverData = Array.isArray(result.data) ? result.data : (result.data.data || []);
                        }

                        if (area === 'users' || area === 'workers') {
                            // Fusión inteligente: No borrar lo que no está en el servidor aún
                            const local = JSON.parse(localStorage.getItem(PREFIX + area) || '[]');
                            const server = serverData;
                            const merged = Array.isArray(server) ? [...server] : [];
                            
                            if (Array.isArray(local)) {
                                local.forEach(item => {
                                    const key = area === 'users' ? 'username' : 'dni';
                                    if (!merged.find(m => m[key] === item[key])) {
                                        merged.push(item);
                                    }
                                });
                            }
                            adminStore[area] = merged;
                            localStorage.setItem(PREFIX + area, JSON.stringify(merged));
                        } else {
                            // [SEGURIDAD] Evitar sobrescribir con datos inválidos o vacíos si ya existe info local
                            if (Object.keys(serverData).length === 0 && Object.keys(adminStore[area]).length > 0) {
                                console.log(`[PULSE] Ignorando sincronización vacía del servidor para ${area}.`);
                                return;
                            }
                            adminStore[area] = serverData;
                            localStorage.setItem(PREFIX + area, JSON.stringify(serverData));
                        }
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
        
        // Intento de guardado con reintento (Fuerza Bruta)
        let success = false;
        for (let i = 0; i < 2; i++) {
            try {
                const res = await fetch(`${API_URL}/${area}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data })
                });
                if (res.ok) {
                    success = true;
                    console.log(`[PULSE] Sincronización exitosa: ${area}`);
                    break;
                }
            } catch (err) { console.warn(`Intento ${i+1} fallido para ${area}`); }
        }
        return success;
    } catch (e) {
        console.warn(`⚠️ Error crítico guardando ${area}:`, e);
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
    let users = getUsers();
    if (!Array.isArray(users)) {
        console.warn("⚠️ adminStore.users no es un array, reseteando...");
        users = [];
    }
    const targetUsername = (user.username || '').toLowerCase();
    const idx = users.findIndex(u => u && (u.username || '').toLowerCase() === targetUsername);
    
    const preparedUser = { ...user, username: targetUsername };
    
    if (idx >= 0) users[idx] = { ...users[idx], ...preparedUser };
    else users.push({ ...preparedUser, active: true });
    return await save('users', users);
};

export const toggleUserStatus = (username) => {
    let users = getUsers();
    if (!Array.isArray(users)) return;
    const idx = users.findIndex(u => u && u.username === username);
    if (idx >= 0) {
        users[idx].active = users[idx].active === false ? true : false;
        save('users', users);
    }
};

export const deleteUser = (username) => {
    let users = getUsers();
    if (!Array.isArray(users)) return;
    const filtered = users.filter(u => u && u.username !== username);
    save('users', filtered);
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

export const closeAttendanceAndSyncPerformance = async (date, localState) => {
    const attendanceData = {
        finalized: true,
        data: localState.map(s => ({
            dni: s.dni,
            nombre: s.nombre,
            apellidos: s.apellidos,
            present: s.present,
            onTime: s.onTime,
            justification: s.justification || ''
        }))
    };
    
    // 1. Guardar Asistencia como Finalizada
    await saveAttendance(date, attendanceData);
    
    // 2. Sincronizar Performance Log (Evitar duplicados)
    const perfLog = adminStore.performance_log.filter(l => l.date !== date);
    attendanceData.data.forEach(att => {
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
    });
    
    return await save('performance_log', perfLog);
};

export const reopenAttendance = async (date) => {
    if (adminStore.attendance[date]) {
        adminStore.attendance[date].finalized = false;
        await save('attendance', adminStore.attendance);
        
        // Opcional: Limpiar el log de ese día para evitar duplicados al volver a cerrar
        const filteredPerf = adminStore.performance_log.filter(l => l.date !== date);
        return await save('performance_log', filteredPerf);
    }
    return false;
};

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
        const resumen = tasks.map(t => t.marca || 'S/M').join(', ');
        const res = await fetch(`${API_URL}/almacenaje_tasks_beta_final`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tasks) // Envío redundante: array puro
        });
        if (res.ok) {
            console.log(`✅ Sincronización Exitosa (Array Puro)`);
            return true;
        }
        return false;
    } catch (e) {
        console.warn("⚠️ Error guardando tareas en servidor:", e);
        return false;
    }
};
export const loadAlmacenajeTasks = async () => {
    try {
        console.log("🔍 [PULSE] Solicitando con X-RAY...");
        const res = await fetch(`${API_URL}/almacenaje_tasks_beta_final`);
        if (res.ok) {
            const result = await res.json();
            let data = [];
            
            // DIAGNÓSTICO X-RAY
            const type = Array.isArray(result) ? "ARRAY" : typeof result;
            const keys = result ? Object.keys(Array.isArray(result) ? (result[0] || {}) : result).join(',') : "N/A";
            
            if (Array.isArray(result)) {
                if (result[0] && Array.isArray(result[0].data)) data = result[0].data;
                else if (result[0] && typeof result[0] === 'object' && result.length > 1) data = result;
                else if (result[0] && result[0].tasks) data = result[0].tasks;
                else data = result;
            } else if (result && result.data) {
                data = Array.isArray(result.data) ? result.data : [result.data];
            }

            adminStore.almacenaje_tasks = data;
            console.log(`🔍 [PULSE] Radar X-RAY: Sincronizadas ${data.length} tareas.`);
            return data;
        }
        return adminStore.almacenaje_tasks;
    } catch (e) {
        return adminStore.almacenaje_tasks;
    }
};
