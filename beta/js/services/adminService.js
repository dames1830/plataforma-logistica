/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (Beta v11.1.28)
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
    performance_log: []
};

// Carga inicial híbrida (Local + Servidor)
export const initializeAdminData = async () => {
    // 1. Carga rápida desde LocalStorage
    adminStore.workers = JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]');
    adminStore.users = JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]');
    adminStore.permissions = JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}');
    adminStore.attendance = JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}');
    adminStore.performance = JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]');
    adminStore.performance_log = JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]');

    // 2. Sincronización con Servidor (Sobrescribe si hay datos nuevos)
    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log'];
        await Promise.all(areas.map(async (area) => {
            const res = await fetch(`${API_URL}/${area}`);
            if (res.ok) {
                const result = await res.json();
                if (result.data) {
                    adminStore[area] = result.data;
                    // Intentar guardar localmente, pero no fallar si el almacenamiento está lleno
                    try {
                        localStorage.setItem(PREFIX + area, JSON.stringify(result.data));
                    } catch(e) { console.warn(`Quota full while syncing ${area}`); }
                }
            }
        }));
        console.log("✅ Datos de Administración sincronizados con la BD.");
        
        // 3. Limpieza de claves antiguas si ya estamos sincronizados
        flushOldKeys();
    } catch (e) {
        console.warn("⚠️ Error sincronizando con BD: Operando en modo local.", e);
    }
};

// Limpia claves de versiones muy antiguas para liberar espacio
const flushOldKeys = () => {
    const activePrefix = 'logistics_admin_v11_';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('logistics_') && !key.startsWith(activePrefix)) {
            localStorage.removeItem(key);
        }
    }
    console.log("🧹 Almacenamiento optimizado.");
};

const save = async (key, data) => {
    adminStore[key] = data;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(data));
    } catch (e) {
        console.warn(`⚠️ [PULSE] Quota Full. El dato se guardará solo en la base de datos.`);
    }
    
    // Persistencia en el servidor
    try {
        await fetch(`${API_URL}/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error(`❌ Error persistiendo ${key} en el servidor:`, e);
    }
};

// --- TRABAJADORES ---
export const saveWorkers = (workers) => {
    // Asegurar que cada trabajador tenga un estado activo si no existe
    const normalized = workers.map(w => ({ active: true, ...w }));
    save('workers', normalized);
};
export const getWorkers = () => adminStore.workers;

export const saveWorker = (worker) => {
    const workers = getWorkers();
    const idx = workers.findIndex(w => (w.dni || w.Dni) === (worker.dni || worker.Dni));
    if (idx >= 0) {
        workers[idx] = { ...workers[idx], ...worker };
    } else {
        workers.push({ active: true, ...worker });
    }
    save('workers', workers);
};

export const toggleWorkerStatus = (dni) => {
    const workers = getWorkers();
    const idx = workers.findIndex(w => (w.dni || w.Dni) === dni);
    if (idx >= 0) {
        workers[idx].active = !workers[idx].active;
        save('workers', workers);
    }
};

// --- USUARIOS ---
export const saveUser = (user) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === user.username);
    if (idx >= 0) {
        // Preservar el estado si no se envía en el nuevo objeto de usuario
        const currentActive = users[idx].active !== undefined ? users[idx].active : true;
        users[idx] = { active: currentActive, ...user };
    } else {
        // Usuario nuevo: por defecto activo
        users.push({ active: true, ...user });
    }
    save('users', users);
};
export const getUsers = () => adminStore.users;
export const deleteUser = (username) => {
    const filtered = getUsers().filter(u => u.username !== username);
    save('users', filtered);
};

export const toggleUserStatus = (username) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx >= 0) {
        users[idx].active = !users[idx].active;
        save('users', users);
    }
};

// --- PERMISOS ---
export const initPermissions = (tabs) => {
    const perms = adminStore.permissions;
    const roles = ['jefe', 'supervisor', 'encargado', 'asistente'];
    
    tabs.forEach(tab => {
        roles.forEach(role => {
            if (!perms[role]) perms[role] = {};
            // Permiso principal
            if (perms[role][tab.id] === undefined) {
                perms[role][tab.id] = tab.roles.includes(role) ? 1 : 0;
            }
            // Permisos de sub-pestañas
            if (tab.subTabs) {
                tab.subTabs.forEach(sub => {
                    const subKey = `${tab.id}_${sub.id}`;
                    if (perms[role][subKey] === undefined) {
                        perms[role][subKey] = tab.roles.includes(role) ? 1 : 0;
                    }
                });
            }
        });
    });
    save('permissions', perms);
};

export const savePermissions = (role, mods) => {
    const perms = adminStore.permissions;
    perms[role] = mods;
    save('permissions', perms);
};

export const getPermissions = (role) => adminStore.permissions[role] || null;

export const togglePermission = (role, tabId) => {
    const perms = adminStore.permissions;
    if (!perms[role]) perms[role] = {};
    perms[role][tabId] = perms[role][tabId] === 1 ? 0 : 1;
    save('permissions', perms);
};

// --- ASISTENCIA ---
export const saveAttendance = (date, records) => {
    const all = adminStore.attendance;
    all[date] = records;
    save('attendance', all);
};
export const getAttendance = (date) => adminStore.attendance[date] || null;

// --- PERFORMANCE ---
// Helper para calcular el porcentaje de rendimiento basado en los pesos oficiales
const calculateRendimientoValue = (entry) => {
    let score = 0;
    if (entry.asistencia === 'P') score += 30;
    if (entry.puntualidad === 'SÍ') score += 10;
    
    // Escala 1-10 para los otros 3
    const prod = parseInt(entry.produccion) || 0;
    const bpa = parseInt(entry.bpa) || 0;
    const sup = parseInt(entry.supervisor) || 0;

    score += (prod / 10) * 30;
    score += (bpa / 10) * 15;
    score += (sup / 10) * 15;

    return Math.round(score) + '%';
};

export const closeAttendanceAndSyncPerformance = async (date, attendanceData) => {
    const currentPerf = getPerformance();
    const log = getPerformanceLog();
    
    attendanceData.forEach(att => {
        // 1. Actualizar Totales (Existente)
        let entry = currentPerf.find(p => p.dni === att.dni);
        if (!entry) {
            entry = { 
                dni: att.dni, 
                nombre: att.nombre, 
                apellidos: att.apellidos,
                asistencia: 0, 
                puntualidad_count: 0,
                puntualidad: '0%', 
                produccion: 0, 
                bpa: 0, 
                supervisor: '-' 
            };
            currentPerf.push(entry);
        }
        
        if (att.present) {
            entry.asistencia += 1;
            if (att.onTime) {
                entry.puntualidad_count = (entry.puntualidad_count || 0) + 1;
            }
            const pct = Math.round((entry.puntualidad_count / entry.asistencia) * 100);
            entry.puntualidad = `${pct}%`;
        }

        // 2. Guardar en Historial Diario (Nuevo)
        const existingLogIdx = log.findIndex(l => l.date === date && l.dni === att.dni);
        const isPresent = att.present;
        const tempEntry = {
            asistencia: isPresent ? 'P' : 'F',
            puntualidad: isPresent ? (att.onTime ? 'SÍ' : 'NO') : 'NO',
            produccion: 0,
            bpa: 0,
            supervisor: 0
        };

        const newLogEntry = {
            date,
            dni: att.dni,
            nombre: att.nombre,
            apellidos: att.apellidos,
            ...tempEntry,
            justification: att.justification || '',
            rendimiento: calculateRendimientoValue(tempEntry)
        };

        if (existingLogIdx >= 0) {
            log[existingLogIdx] = { ...log[existingLogIdx], ...newLogEntry, rendimiento: log[existingLogIdx].rendimiento };
        } else {
            log.push(newLogEntry);
        }
    });

    await save('performance', currentPerf);
    await save('performance_log', log);
    await saveAttendance(date, { finalized: true, data: attendanceData });
};

export const getPerformanceLog = () => adminStore.performance_log;

export const updatePerformanceLogEntry = (date, dni, fields) => {
    const log = getPerformanceLog();
    const idx = log.findIndex(l => l.date === date && l.dni === dni);
    if (idx >= 0) {
        // Actualizar campos
        log[idx] = { ...log[idx], ...fields };
        // Recalcular rendimiento tras cualquier cambio
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
