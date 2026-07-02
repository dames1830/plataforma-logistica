/**
 * Admin Service v24 - BRIDGE EDITION
 * Este archivo actúa como puente entre la UI y el nuevo Motor de Sincronización v24.
 */
import * as syncEngine from './sync_engine_v24_9.js?v=26.5.276';

export const adminStore = syncEngine.syncStore;

export const initializeAdminData = async (force = false) => {
    return await syncEngine.initSync(force);
};

let saveQueue = Promise.resolve();
export const save = async (area, data, date = null) => {
    const nextSave = () => syncEngine.pushChange(area, data, date);
    saveQueue = saveQueue.then(nextSave).catch(err => {
        console.error(`❌ Queue save error on ${area}:`, err);
        return nextSave(); // Reintentar una vez
    });
    return saveQueue;
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

export const toggleWorkerStatus = async (dni) => {
    const worker = adminStore.workers.find(w => String(w.dni || w.Dni || '') === String(dni));
    if (worker) {
        worker.active = worker.active === false;
        return await save('workers', adminStore.workers);
    }
};

export const toggleUserStatus = async (username) => {
    const user = adminStore.users.find(u => u.username === username);
    if (user) {
        user.active = user.active === false;
        return await save('users', adminStore.users);
    }
};

export const saveAttendance = async (dateStr, data) => {
    if (data && data.data) {
        const uniqueMap = new Map();
        data.data.forEach(d => {
            if (!uniqueMap.has(String(d.dni))) uniqueMap.set(String(d.dni), d);
        });
        data.data = Array.from(uniqueMap.values());
    }
    adminStore.attendance[dateStr] = data;
    
    if (data.finalized) {
        // [MOD v25.1.27] Sincronización selectiva y normalización de DNI
        await syncEngine.pullGlobal(['performance_log'], true); 
        if (!adminStore.performance_log) adminStore.performance_log = [];
        
        data.data.forEach(asist => {
            const asistDni = String(asist.dni || '').trim();
            const isPresent = asist.present || asist.asistencia === 'P';
            const isOnTime = asist.onTime !== false;
            const existingIdx = adminStore.performance_log.findIndex(p => p.date === dateStr && String(p.dni || '').trim() === asistDni);

            let pVal = isPresent ? 10 : 0;
            let bVal = isPresent ? 10 : 0;
            let sVal = isPresent ? 9 : 0;

            if (existingIdx !== -1) {
                const ex = adminStore.performance_log[existingIdx];
                pVal = ex.produccion !== undefined && ex.produccion !== '' ? parseFloat(ex.produccion) : pVal;
                bVal = ex.bpa !== undefined && ex.bpa !== '' ? parseFloat(ex.bpa) : bVal;
                sVal = ex.supervisor !== undefined && ex.supervisor !== '' ? parseFloat(ex.supervisor) : sVal;
            }

            const asisScore = isPresent ? 30 : 0;
            const puntScore = (isPresent && isOnTime) ? 10 : 0;
            const prodScore = pVal * 3;
            const bpaScore = bVal * 1.5;
            const supScore = sVal * 1.5;
            const totalScore = isPresent ? (asisScore + puntScore + prodScore + bpaScore + supScore) : 0;

            const perfEntry = {
                date: dateStr,
                dni: asistDni,
                nombre: asist.nombre || '',
                apellidos: asist.apellidos || '',
                asistencia: isPresent ? 'P' : 'F',
                puntualidad: isPresent ? (isOnTime ? 'SÍ' : 'NO') : 'NO',
                produccion: pVal,
                bpa: bVal,
                supervisor: sVal,
                justification: asist.justification || '',
                rendimiento: Math.round(totalScore) + '%'
            };

            if (existingIdx !== -1) {
                adminStore.performance_log[existingIdx] = { ...adminStore.performance_log[existingIdx], ...perfEntry };
            } else {
                adminStore.performance_log.push(perfEntry);
            }
        });
        console.log(`🚀 [PULSE] Guardando historial: ${adminStore.performance_log.length} registros totales.`);
        await save('performance_log', adminStore.performance_log);
    }
    return await save('attendance', adminStore.attendance);
};

export const reopenAttendance = async (dateStr) => {
    if (!adminStore.attendance[dateStr]) return;
    adminStore.attendance[dateStr].finalized = false;
    return await save('attendance', adminStore.attendance, dateStr);
};

export const updatePerformanceLogEntry = async (date, dni, updates) => {
    const entry = adminStore.performance_log.find(p => p.date === date && p.dni === dni);
    if (entry) {
        Object.assign(entry, updates);
        
        const isPresent = entry.asistencia === 'P';
        const isOnTime = entry.puntualidad === 'SÍ';

        const asisScore = isPresent ? 30 : 0;
        const puntScore = (isPresent && isOnTime) ? 10 : 0;
        
        const p = parseFloat(entry.produccion || 0);
        const b = parseFloat(entry.bpa || 0);
        const s = parseFloat(entry.supervisor || 0);
        
        const prodScore = p * 3;
        const bpaScore = b * 1.5;
        const supScore = s * 1.5;
        
        const rend = isPresent ? (asisScore + puntScore + prodScore + bpaScore + supScore) : 0;
        entry.rendimiento = Math.round(rend) + '%';
        
        await save('performance_log', adminStore.performance_log);
        return entry;
    }
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
export const savePerformance = (data) => save('performance', data);
export const savePerformanceLog = (data) => save('performance_log', data);

// --- GESTIÓN DE PERMISOS (RESTAURADO v24.3) ---
export const FORCED_ASISTENTE = [
    'inicio',
    'almacenaje', 'almacenaje_archivo_almacenaje', 'almacenaje_tareas_dia', 'almacenaje_kpi_tareas',
    'buffer', 'buffer_maestros', 'buffer_reportes', 'buffer_historial_buffer', 'buffer_kpi_buffer', 'buffer_config_buffer',
    'admin_pers', 'admin_pers_asistencia', 'admin_pers_performance', 'admin_pers_rfs',
    'performance_historial', 'performance_graficos', 'performance_reporte'
];

export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'coordinador', 'supervisor', 'encargado', 'asistente', 'transporte', 'transportista', 'chofer'];
    roles.forEach(role => {
        if (!adminStore.permissions[role]) adminStore.permissions[role] = {};
        const p = adminStore.permissions[role];
        tabs.forEach(t => {
            if (role === 'asistente' && FORCED_ASISTENTE.includes(t.id)) p[t.id] = 1;
            if (p[t.id] === undefined) p[t.id] = (role === 'admin' || role === 'jefe' || (t.roles && t.roles.includes(role))) ? 1 : 0;
            if (t.subTabs) {
                t.subTabs.forEach(s => {
                    const subKey = `${t.id}_${s.id}`;
                    if (role === 'asistente' && FORCED_ASISTENTE.includes(subKey)) p[subKey] = 1;
                    if (p[subKey] === undefined) p[subKey] = (role === 'admin' || role === 'jefe' || (t.roles && t.roles.includes(role))) ? 1 : 0;
                    if (s.subTabs) {
                        s.subTabs.forEach(ss => {
                            const ssKey = `${s.id}_${ss.id}`;
                            if (role === 'asistente' && FORCED_ASISTENTE.includes(ssKey)) p[ssKey] = 1;
                            if (p[ssKey] === undefined) p[ssKey] = (role === 'admin' || role === 'jefe' || (t.roles && t.roles.includes(role))) ? 1 : 0;
                        });
                    }
                });
            }
        });
    });
};

export const togglePermission = (role, tabId) => {
    if (role === 'asistente' && FORCED_ASISTENTE.includes(tabId)) return;
    if (!adminStore.permissions[role]) adminStore.permissions[role] = {};
    const p = adminStore.permissions[role];
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    save('permissions', adminStore.permissions);
};

// --- COMPATIBILIDAD CON PROCESAR TAREAS ---
export const loadAlmacenajeTasks = async (force = false) => {
    await syncEngine.pullGlobal(['almacenaje_tasks'], force);
    return adminStore.almacenaje_tasks;
};

// --- PROTOCOLO DE LIMPIEZA TOTAL (v24.4.9) ---
export const resetProductionData = async () => {
    console.warn("⚠️ [PULSE] Iniciando purga total de datos en la nube...");
    
    // 1. Áreas de Administración (syncEngine)
    const adminAreas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log', 'almacenaje_tasks'];
    for (const area of adminAreas) {
        await syncEngine.pushChange(area, area === 'permissions' ? {} : []);
    }

    // 2. Áreas de Operación (csvHub)
    const opAreas = [
        'stockActivo', 'stockReserva', 'buffer', 'picking', 'packing', 
        'despacho', 'no_retail', 'recepcion', 'almacenaje', 
        'matriz_ubicaciones', 'inventario', 'tallas', 'articulos', 
        'solicitud', 'buffer_activo', 'buffer_reserva', 'tabla_tallas'
    ];

    const API_URL = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
    for (const area of opAreas) {
        try {
            await fetch(`${API_URL}/${area}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
                body: JSON.stringify([])
            });
            console.log(`✅ Área ${area} fulminada.`);
        } catch (e) { console.error(`❌ Fallo al fulminar ${area}:`, e); }
    }

    // 3. Limpieza de Memoria Local
    localStorage.clear();
    const db = await indexedDB.open('LogisticsPulseDB');
    db.onsuccess = (e) => {
        const database = e.target.result;
        const tx = database.transaction(['DataCache'], 'readwrite');
        tx.objectStore('DataCache').clear();
    };

    console.log("🌪️ [PULSE] Purga completada. La nube está vacía.");
    return true;
};

// --- GESTIÓN DE EQUIPOS RF & ASIGNACIONES ---
export const getRfs = () => adminStore.rfs || [];
export const saveRfs = async (data) => {
    adminStore.rfs = data;
    return await save('rfs', data, 'MASTER');
};

export const getRfAssignments = () => adminStore.rf_assignments || [];
export const saveRfAssignments = async (data) => {
    adminStore.rf_assignments = data;
    return await save('rf_assignments', data, 'MASTER');
};

// --- GESTIÓN DE BATERÍAS & CARGADORES ---
export const getRfsBatteries = () => adminStore.rfs_batteries || [];
export const saveRfsBatteries = async (data) => {
    adminStore.rfs_batteries = data;
    return await save('rfs_batteries', data, 'MASTER');
};

export const getRfsChargers = () => adminStore.rfs_chargers || [];
export const saveRfsChargers = async (data) => {
    adminStore.rfs_chargers = data;
    return await save('rfs_chargers', data, 'MASTER');
};

// --- GESTIÓN DE HISTORIAL BUFFER (Mapeado al Sync Engine como Almacenaje) ---
export const getBufferHistory = () => adminStore.buffer_history || [];
export const saveBufferHistory = async (data) => {
    adminStore.buffer_history = data;
    return await save('buffer_history', data);
};


