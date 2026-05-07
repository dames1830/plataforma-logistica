/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (Beta v11.1.115)
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
    try {
        adminStore.workers = JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]');
        adminStore.users = JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]');
        adminStore.permissions = JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}');
        adminStore.attendance = JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}');
        adminStore.performance = JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]');
        adminStore.performance_log = JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]');
    } catch (e) {
        console.warn("⚠️ Error cargando datos locales (posible corrupción):", e);
    }

    // 2. Sincronización con Servidor (Sincronización Inteligente)
    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log'];
        
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
                        try {
                            localStorage.setItem(PREFIX + area, JSON.stringify(result.data));
                        } catch(e) { 
                            console.warn(`Quota full while syncing ${area}. Clearing old keys...`);
                            flushOldKeys(true); // Limpieza agresiva
                            try {
                                localStorage.setItem(PREFIX + area, JSON.stringify(result.data));
                            } catch(e2) { console.error("Still no space after cleanup."); }
                        }
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Fallo parcial en área ${area}: ${err.message}`);
            }
        }));
        
        console.log("✅ Sincronización Pulse completada.");
        // Clean old keys occasionally
        flushOldKeys();
    } catch (e) {
        console.warn("⚠️ Sincronización fallida: Operando en modo local (off-line).", e);
    }
};

// Limpia claves de versiones muy antiguas para liberar espacio
const flushOldKeys = (aggressive = false) => {
    try {
        const activePrefix = 'logistics_admin_v11_';
        const keysToRemove = [];
        const whiteList = ['logistics_session', 'logistics_cache_', 'logistics_meta_'];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            // Si la clave es de logística pero no es la versión actual y no está en la lista blanca
            if (key.startsWith('logistics_')) {
                const isInWhiteList = whiteList.some(w => key.startsWith(w));
                const isCurrentVersion = key.startsWith(activePrefix);
                
                if (!isCurrentVersion && !isInWhiteList) {
                    keysToRemove.push(key);
                }
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        if (keysToRemove.length > 0) {
            console.log(`🧹 Almacenamiento: ${keysToRemove.length} claves antiguas eliminadas.`);
        }
    } catch (e) { console.error("Error in flushOldKeys:", e); }
};

const save = async (key, data) => {
    adminStore[key] = data;
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(data));
    } catch (e) {
        console.warn(`⚠️ [PULSE] Quota Full Local. El dato se guardará solo en la base de datos.`);
        flushOldKeys(true);
    }
    
    // Persistencia en el servidor
    try {
        await fetch(`${API_URL}/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error(`❌ Error persistiendo ${key} en los servidores de Pulse:`, e);
    }
};

// --- TRABAJADORES ---
export const saveWorkers = (workers) => {
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
        const currentActive = users[idx].active !== undefined ? users[idx].active : true;
        users[idx] = { active: currentActive, ...user };
    } else {
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
            if (perms[role][tab.id] === undefined) {
                perms[role][tab.id] = (tab.roles && tab.roles.includes(role)) ? 1 : 0;
            }
            if (tab.subTabs) {
                tab.subTabs.forEach(sub => {
                    const subKey = `${tab.id}_${sub.id}`;
                    if (perms[role][subKey] === undefined) {
                        perms[role][subKey] = (tab.roles && tab.roles.includes(role)) ? 1 : 0;
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
const calculateRendimientoValue = (entry) => {
    let score = 0;
    if (entry.asistencia === 'P') score += 30;
    if (entry.puntualidad === 'SÍ') score += 10;
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
        let entry = currentPerf.find(p => p.dni === att.dni);
        if (!entry) {
            entry = { 
                dni: att.dni, nombre: att.nombre, apellidos: att.apellidos,
                asistencia: 0, puntualidad_count: 0, puntualidad: '0%', 
                produccion: 0, bpa: 0, supervisor: '-' 
            };
            currentPerf.push(entry);
        }
        if (att.present) {
            entry.asistencia += 1;
            if (att.onTime) entry.puntualidad_count = (entry.puntualidad_count || 0) + 1;
            const pct = Math.round((entry.puntualidad_count / entry.asistencia) * 100);
            entry.puntualidad = `${pct}%`;
        }
        const existingLogIdx = log.findIndex(l => l.date === date && l.dni === att.dni);
        const isPresent = att.present;
        
        const baseValues = {
            asistencia: isPresent ? 'P' : 'F',
            puntualidad: isPresent ? (att.onTime ? 'SÍ' : 'NO') : 'NO',
            justification: att.justification || ''
        };

        if (existingLogIdx >= 0) {
            // CASO REAPERTURA: Mezcla inteligente
            const old = log[existingLogIdx];
            const updated = { ...old, ...baseValues };

            // Si antes era Falta y ahora es Presente -> Dar puntos base
            if (old.asistencia === 'F' && isPresent) {
                updated.produccion = 10;
                updated.bpa = 10;
                updated.supervisor = 9;
            }
            // Si antes era Presente y ahora es Falta -> Quitar puntos
            else if (old.asistencia === 'P' && !isPresent) {
                updated.produccion = 0;
                updated.bpa = 0;
                updated.supervisor = 0;
            }
            // Si sigue presente -> PRESERVAR lo que ya tenía (manual o default)
            else if (isPresent) {
                updated.produccion = old.produccion !== undefined ? old.produccion : 10;
                updated.bpa = old.bpa !== undefined ? old.bpa : 10;
                updated.supervisor = (old.supervisor !== undefined && old.supervisor !== '-') ? old.supervisor : 9;
            }

            updated.rendimiento = calculateRendimientoValue(updated);
            log[existingLogIdx] = updated;
        } else {
            // CASO NUEVO: Valores por defecto
            const newEntry = {
                date, dni: att.dni, nombre: att.nombre, apellidos: att.apellidos,
                ...baseValues,
                produccion: isPresent ? 10 : 0,
                bpa: isPresent ? 10 : 0,
                supervisor: isPresent ? 9 : 0
            };
            newEntry.rendimiento = calculateRendimientoValue(newEntry);
            log.push(newEntry);
        }
    });

    await save('performance', currentPerf);
    await save('performance_log', log);
    await saveAttendance(date, { finalized: true, data: attendanceData });
};

export const reopenAttendance = async (date) => {
    const all = adminStore.attendance;
    if (!all[date] || !all[date].finalized) return;

    // 1. Revertir cambios en currentPerf (Acumulado)
    const currentPerf = getPerformance();
    const log = getPerformanceLog();
    const dailyLog = log.filter(l => l.date === date);

    dailyLog.forEach(l => {
        const entry = currentPerf.find(p => p.dni === l.dni);
        if (entry) {
            if (l.asistencia === 'P') {
                entry.asistencia = Math.max(0, entry.asistencia - 1);
                if (l.puntualidad === 'SÍ') {
                    entry.puntualidad_count = Math.max(0, (entry.puntualidad_count || 0) - 1);
                }
                const pct = entry.asistencia > 0 ? Math.round((entry.puntualidad_count / entry.asistencia) * 100) : 0;
                entry.puntualidad = `${pct}%`;
            }
        }
    });

    // 2. Marcar como no finalizado
    all[date].finalized = false;

    // 3. Guardar cambios
    await save('performance', currentPerf);
    await save('attendance', all);
};

export const getPerformanceLog = () => adminStore.performance_log;

export const updatePerformanceLogEntry = (date, dni, fields) => {
    const log = getPerformanceLog();
    const idx = log.findIndex(l => l.date === date && l.dni === dni);
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
\nwindow.adminService = { initializeAdminData, getPermissions, initPermissions, savePermissions, resetProductionData };\n