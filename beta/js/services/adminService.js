/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (Beta v11.1.13)
 */
const PREFIX = 'logistics_admin_v11_';

export const adminStore = {
    workers: JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]'),
    users: JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]'),
    permissions: JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}'),
    attendance: JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}'), // Keyed by date YYYY-MM-DD
    performance: JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]'),
    performance_log: JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]')
};

const save = (key, data) => {
    adminStore[key] = data;
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
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
export const closeAttendanceAndSyncPerformance = (date, attendanceData) => {
    const currentPerf = getPerformance();
    const log = adminStore.performance_log;
    
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
        // Evitar duplicados para el mismo día si se re-cierra (sobrescribir)
        const existingLogIdx = log.findIndex(l => l.date === date && l.dni === att.dni);
        const newLogEntry = {
            date,
            dni: att.dni,
            nombre: att.nombre,
            apellidos: att.apellidos,
            asistencia: att.present ? 'P' : 'F',
            puntualidad: att.onTime ? 'SÍ' : 'NO',
            rendimiento: '0%', // Inicializado para edición manual o cálculo futuro
            produccion: entry.produccion || 0,
            bpa: entry.bpa || 0,
            supervisor: entry.supervisor || '-'
        };

        if (existingLogIdx >= 0) {
            log[existingLogIdx] = newLogEntry;
        } else {
            log.push(newLogEntry);
        }
    });

    save('performance', currentPerf);
    save('performance_log', log);
    saveAttendance(date, { finalized: true, data: attendanceData });
};

export const getPerformanceLog = () => adminStore.performance_log;

export const updatePerformanceLogEntry = (date, dni, fields) => {
    const log = getPerformanceLog();
    const idx = log.findIndex(l => l.date === date && l.dni === dni);
    if (idx >= 0) {
        log[idx] = { ...log[idx], ...fields };
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
