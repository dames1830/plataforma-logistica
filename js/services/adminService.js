/**
 * Admin Service v24 - BRIDGE EDITION
 * Este archivo actúa como puente entre la UI y el nuevo Motor de Sincronización v24.
 */
import * as syncEngine from './sync_engine_v24.js';

export const adminStore = syncEngine.syncStore;

export const initializeAdminData = async () => {
    return await syncEngine.initSync();
};

export const save = async (area, data) => {
    return await syncEngine.pushChange(area, data);
};

// --- GETTERS (Ahora usan el syncStore centralizado) ---
export const getWorkers = () => {
    return [...adminStore.workers].sort((a, b) => {
        const nameA = `${a.apellidos || a.Apellidos || ''} ${a.nombre || a.Nombre || ''}`.trim().toUpperCase();
        const nameB = `${b.apellidos || b.Apellidos || ''} ${b.nombre || b.Nombre || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });
};
export const getUsers = () => adminStore.users;
export const getPermissions = (role) => adminStore.permissions[role] || {};
export const getAttendance = (dateStr) => adminStore.attendance[dateStr];
export const getPerformance = () => adminStore.performance;
export const getPerformanceLog = () => adminStore.performance_log;
export const getAlmacenajeTasks = () => adminStore.almacenaje_tasks;

// --- FUNCIONES DE NEGOCIO ---
export const saveWorkers = (data) => save('workers', data);
export const saveWorker = async (worker) => {
    const workerDni = String(worker.dni || worker.Dni || '');
    const idx = adminStore.workers.findIndex(w => String(w.dni || w.Dni || '') === workerDni);
    if (idx !== -1) adminStore.workers[idx] = { ...adminStore.workers[idx], ...worker };
    else adminStore.workers.push({ ...worker, active: true });
    return await save('workers', adminStore.workers);
};

export const deleteWorker = async (dni) => {
    const targetDni = String(dni);
    adminStore.workers = adminStore.workers.filter(w => String(w.dni || w.Dni || '') !== targetDni);
    return await save('workers', adminStore.workers);
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

export const savePermissions = (role, data) => {
    adminStore.permissions[role] = data;
    return save('permissions', adminStore.permissions);
};

export const saveAlmacenajeTasks = (data) => save('almacenaje_tasks', data);

// --- COMPATIBILIDAD CON PROCESAR TAREAS ---
export const loadAlmacenajeTasks = async () => {
    await syncEngine.pullGlobal(['almacenaje_tasks']);
    return adminStore.almacenaje_tasks;
};

// Re-exportar funciones necesarias para el Dashboard
export const closeAttendanceAndSyncPerformance = async (date, attendanceData) => {
    adminStore.attendance[date] = { data: attendanceData, ts: Date.now(), finalized: true };
    const ok = await save('attendance', adminStore.attendance);
    // Aquí podrías añadir lógica de performance si es necesario
    return ok;
};
