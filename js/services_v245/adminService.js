/**
 * Admin Service v24 - BRIDGE EDITION
 * Este archivo actúa como puente entre la UI y el nuevo Motor de Sincronización v24.
 */
import * as syncEngine from './sync_engine_v24_9.js?v=29.0240';

export const adminStore = syncEngine.syncStore;

export const initializeAdminData = async (force = false) => {
    const res = await syncEngine.initSync(force);
    return res;
};

let saveQueue = Promise.resolve();
export const save = async (area, data, date = null) => {
    saveQueue = saveQueue.then(async () => {
        try {
            await syncEngine.pushChange(area, data, date);
            return true;
        } catch (err) {
            console.error(`Primer intento fallido en ${area}:`, err);
            try {
                await syncEngine.pushChange(area, data, date);
                return true;
            } catch (err2) {
                console.error(`Segundo intento fallido en ${area}. Se descarta para no trabar la cola.`, err2);
                return false;
            }
        }
    }).catch(err => {
        console.error(`Error crítico en la cola de ${area}:`, err);
        return false;
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
export const getAlmacenajeTasks = () => adminStore.almacenaje_tasks || [];

export const getAlmacenajeTasksHistory = () => adminStore.almacenaje_tasks_history || [];

/**
 * Las tareas tal como están AHORA en el servidor, sin tocar lo que hay en memoria.
 * Se usa para fusionar antes de reescribir el bloque entero (procesar, auditar, borrar).
 */
export const traerTareasFrescas = () => syncEngine.traerAreaFresca('almacenaje_tasks');

export const saveAlmacenajeTasksHistory = async (data) => {
    adminStore.almacenaje_tasks_history = data;
    return await save('almacenaje_tasks_history', data);
};

export const archiveOldAlmacenajeTasks = async () => {
    const tasks = getAlmacenajeTasks();
    if (!tasks || tasks.length === 0) return false;

    const now = new Date();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    
    let needsArchiving = false;
    const activeTasks = [];
    const tasksToArchive = [];

    tasks.forEach(t => {
        // Only archive completed tasks older than 3 days
        if (t.status === 'Finalizado' && t.termino) {
            const termDate = new Date(t.termino);
            if (!isNaN(termDate) && (now - termDate) > THREE_DAYS_MS) {
                tasksToArchive.push(t);
                needsArchiving = true;
                return;
            }
        }
        activeTasks.push(t);
    });

    if (needsArchiving) {
        console.log(`[PULSE] Auto-archiving ${tasksToArchive.length} old tasks...`);
        // Save history first
        const currentHistory = getAlmacenajeTasksHistory();
        const mergedHistory = [...currentHistory, ...tasksToArchive];
        await saveAlmacenajeTasksHistory(mergedHistory);
        
        // Then update active tasks
        adminStore.almacenaje_tasks = activeTasks;
        await saveAlmacenajeTasks(activeTasks);
        console.log(`[PULSE] Auto-archive complete. Active tasks left: ${activeTasks.length}`);
        return true;
    }
    return false;
};

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

let almacenajeDebounceTimer = null;
let almacenajeDebouncePromise = null;
let almacenajeDebounceResolve = null;

export const saveAlmacenajeTasks = (data) => {
    // Una tarea suelta viaja sola y sin demora: el motor la manda por PATCH y el servidor la
    // reemplaza por id sin tocar las demás. Es lo que permite que dos PC trabajen el mismo día
    // sin pisarse.
    //
    // Tampoco entra al debounce, y eso es a propósito: el debounce CANCELA el envío anterior,
    // así que finalizar dos tareas en menos de segundo y medio dejaba la primera sin mandar
    // nunca. Con el array completo no se notaba -el array llevaba las dos-, pero mandando
    // tareas sueltas ese cambio se perdía. save() ya las encola y respeta el orden.
    if (data && !Array.isArray(data) && typeof data === 'object' && data.id) {
        return save('almacenaje_tasks', data);
    }

    if (!almacenajeDebouncePromise) {
        almacenajeDebouncePromise = new Promise(resolve => {
            almacenajeDebounceResolve = resolve;
        });
    }

    clearTimeout(almacenajeDebounceTimer);
    
    almacenajeDebounceTimer = setTimeout(async () => {
        // Capture resolve locally before clearing, to avoid race condition
        const resolveNow = almacenajeDebounceResolve;
        almacenajeDebouncePromise = null;
        almacenajeDebounceResolve = null;
        try {
            const result = await save('almacenaje_tasks', data);
            if (typeof resolveNow === 'function') resolveNow(result);
        } catch (e) {
            if (typeof resolveNow === 'function') resolveNow(false);
        }
    }, 1500);

    return almacenajeDebouncePromise;
};
export const savePerformance = (data) => save('performance', data);
export const savePerformanceLog = (data) => save('performance_log', data);

// --- GESTIÓN DE PERMISOS (RESTAURADO v24.3) ---
export const FORCED_ASISTENTE = [
    'inicio',
    'almacenaje', 'almacenaje_archivo_almacenaje', 'almacenaje_tareas_dia', 'almacenaje_kpi_tareas',
    // 'almacenaje_config_tareas' queda fuera a propósito: solo se habilita desde la matriz.
    'buffer', 'buffer_maestros', 'buffer_reportes', 'buffer_historial_buffer', 'buffer_kpi_buffer', 'buffer_config_buffer',
    'admin_pers', 'admin_pers_asistencia', 'admin_pers_performance', 'admin_pers_rfs',
    'performance_historial', 'performance_graficos', 'performance_reporte'
];

/**
 * Sub-pestañas que arrancan APAGADAS para todo el mundo menos admin, aunque el rol
 * tenga acceso al módulo que las contiene.
 *
 * Hace falta porque el valor por defecto de más abajo le da acceso a 'jefe' a todo
 * lo que exista. Estas secciones cambian datos para TODA la empresa, así que quién
 * las usa se decide a mano en la matriz de permisos, no por un valor por defecto.
 */
export const SOLO_ADMIN_POR_DEFECTO = ['config_archivos_nube'];

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
                    if (SOLO_ADMIN_POR_DEFECTO.includes(subKey)) {
                        if (p[subKey] === undefined) p[subKey] = (role === 'admin') ? 1 : 0;
                        return;   // no se le aplica el valor por defecto general
                    }
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

export const loadAlmacenajeTasksHistory = async (force = false) => {
    await syncEngine.pullGlobal(['almacenaje_tasks_history'], force);
    return adminStore.almacenaje_tasks_history || [];
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
// --- GESTIÓN DINÁMICA DE REPORTES PÚBLICOS & PERMISOS ---
export const getPublicReportsConfig = () => {
    if (!adminStore.public_reports_config) {
        try {
            const local = localStorage.getItem('deam_public_reports_config');
            if (local) adminStore.public_reports_config = JSON.parse(local);
        } catch(e) {}
    }
    if (!adminStore.public_reports_config || !Array.isArray(adminStore.public_reports_config)) {
        // Estructura por defecto inicial
        adminStore.public_reports_config = [
            {
                id: 'grp_gerencial',
                nombre: 'GERENCIAL',
                token: 'GERENCIAL-Deam2026',
                modulos: ['inventario', 'picking', 'packing', 'despacho', 'no_retail', 'recepcion', 'almacenaje', 'buffer', 'analisis_sku'],
                reportesAlmacenaje: ['reporte_marcas', 'rendimiento_ops', 'produccion_hora', 'almacenado_semana', 'grafico_rendimiento'],
                reportesBuffer: ['historial_buffer', 'analisis_buffer']
            },
            {
                id: 'grp_analistas',
                nombre: 'ANALISTAS',
                token: 'ANALISTAS-Deam2026',
                modulos: ['inventario', 'picking', 'packing', 'despacho', 'no_retail', 'recepcion', 'almacenaje', 'buffer', 'analisis_sku'],
                reportesAlmacenaje: ['reporte_marcas', 'rendimiento_ops', 'produccion_hora', 'almacenado_semana', 'grafico_rendimiento'],
                reportesBuffer: ['historial_buffer', 'analisis_buffer']
            },
            {
                id: 'grp_supervisores',
                nombre: 'SUPERVISORES',
                token: 'SUPERVISORES-Deam2026',
                modulos: ['inventario', 'picking', 'packing', 'despacho', 'no_retail', 'recepcion', 'almacenaje', 'buffer', 'analisis_sku'],
                reportesAlmacenaje: ['reporte_marcas', 'rendimiento_ops', 'produccion_hora', 'almacenado_semana', 'grafico_rendimiento'],
                reportesBuffer: ['historial_buffer', 'analisis_buffer']
            },
            {
                id: 'grp_proveedores',
                nombre: 'PROVEEDORES',
                token: 'PROVEEDORES-Deam2026',
                modulos: ['inventario', 'picking', 'packing', 'despacho', 'no_retail', 'recepcion'],
                reportesAlmacenaje: [],
                reportesBuffer: []
            }
        ];
    }
    return adminStore.public_reports_config;
};

export const savePublicReportsConfig = async (data) => {
    adminStore.public_reports_config = data;
    try {
        localStorage.setItem('deam_public_reports_config', JSON.stringify(data));
    } catch(e) {}
    return await save('public_reports_config', data, 'MASTER');
};

