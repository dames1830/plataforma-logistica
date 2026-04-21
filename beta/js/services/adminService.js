/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (Beta v11.1.13)
 */
const PREFIX = 'logistics_admin_v11_';

export const adminStore = {
    workers: JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]'),
    users: JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]'),
    permissions: JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}'),
    attendance: JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}'), // Keyed by date YYYY-MM-DD
    performance: JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]')
};

const save = (key, data) => {
    adminStore[key] = data;
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
};

// --- TRABAJADORES ---
export const saveWorkers = (workers) => save('workers', workers);
export const getWorkers = () => adminStore.workers;

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
    // Si ya hay permisos, no sobreescribir, pero asegurar que los nuevos módulos existan
    const perms = adminStore.permissions;
    const roles = ['jefe', 'supervisor', 'encargado', 'asistente']; // admin es siempre full
    
    tabs.forEach(tab => {
        roles.forEach(role => {
            if (!perms[role]) perms[role] = {};
            if (perms[role][tab.id] === undefined) {
                perms[role][tab.id] = tab.roles.includes(role) ? 1 : 0;
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
    // attendanceData: [{dni, present, ...}]
    const currentPerf = adminStore.performance;
    
    attendanceData.forEach(att => {
        let entry = currentPerf.find(p => p.dni === att.dni);
        if (!entry) {
            entry = { 
                dni: att.dni, 
                nombre: att.nombre, 
                apellidos: att.apellidos,
                asistencia: 0, 
                puntualidad: '0%', 
                produccion: 0, 
                bpa: 0, 
                supervisor: '-' 
            };
            currentPerf.push(entry);
        }
        if (att.present) {
            entry.asistencia += 1;
        }
    });

    save('performance', currentPerf);
    // Marcamos la asistencia como CERRADA
    saveAttendance(date, { finalized: true, data: attendanceData });
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
