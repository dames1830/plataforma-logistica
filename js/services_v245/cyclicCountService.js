/**
 * Cyclic Count Service (ERU) - Modelo Ciego Total
 * Maneja la lógica de tareas, bolsa temporal de escaneos y cruce de datos.
 */

const STORAGE_KEY_TASKS = 'eru_tasks_v1';
const STORAGE_KEY_SCANS = 'eru_scans_v1';
const STORAGE_KEY_CLOSED = 'eru_closed_locs_v1';
const ADMIN_PIN = '1830'; // PIN de seguridad para desbloqueo

// --- GESTIÓN DE TAREAS ---
export const saveTasks = (tasksArray) => {
    // tasksArray = [{ location: "A-01-01", status: "pending" }, ...]
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasksArray));
};

export const getTasks = () => {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    return raw ? JSON.parse(raw) : [];
};

export const clearTasks = () => {
    localStorage.removeItem(STORAGE_KEY_TASKS);
    localStorage.removeItem(STORAGE_KEY_SCANS);
    localStorage.removeItem(STORAGE_KEY_CLOSED);
};

// --- GESTIÓN DE ESCANEOS (BOLSA TEMPORAL) ---
export const saveScan = (location, sku) => {
    const raw = localStorage.getItem(STORAGE_KEY_SCANS);
    const scans = raw ? JSON.parse(raw) : [];
    
    // Obtener usuario de la sesión actual
    const sessionRaw = localStorage.getItem('logistics_session');
    const session = sessionRaw ? JSON.parse(sessionRaw) : {};
    const username = session.username || 'operario';
    
    // Si ya existe el SKU en esa ubicación, sumar 1. Si no, crearlo.
    const existing = scans.find(s => s.location === location && s.sku === sku);
    if (existing) {
        existing.qty += 1;
        existing.last_scan = Date.now();
        existing.user = username;
    } else {
        scans.push({ location, sku, qty: 1, last_scan: Date.now(), user: username });
    }
    
    localStorage.setItem(STORAGE_KEY_SCANS, JSON.stringify(scans));
    return getScansByLocation(location);
};

export const getScans = () => {
    const raw = localStorage.getItem(STORAGE_KEY_SCANS);
    return raw ? JSON.parse(raw) : [];
};

export const getScansByLocation = (location) => {
    return getScans().filter(s => s.location === location);
};

// --- BLOQUEO Y CIERRE DE UBICACIÓN ---
export const getClosedLocations = () => {
    const raw = localStorage.getItem(STORAGE_KEY_CLOSED);
    return raw ? JSON.parse(raw) : [];
};

export const closeLocation = (location) => {
    const closed = getClosedLocations();
    if (!closed.includes(location)) {
        closed.push(location);
        localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(closed));
    }
    
    // Obtener usuario de la sesión actual
    const sessionRaw = localStorage.getItem('logistics_session');
    const session = sessionRaw ? JSON.parse(sessionRaw) : {};
    const username = session.username || 'operario';
    
    // Actualizar estado en la tarea principal
    const tasks = getTasks();
    const task = tasks.find(t => t.location === location);
    if (task) {
        task.status = 'closed';
        task.user = username;
        saveTasks(tasks);
    }
};

export const unlockLocation = (location, pin) => {
    if (pin !== ADMIN_PIN) {
        return { success: false, message: 'PIN incorrecto. Acceso denegado.' };
    }
    
    let closed = getClosedLocations();
    closed = closed.filter(l => l !== location);
    localStorage.setItem(STORAGE_KEY_CLOSED, JSON.stringify(closed));
    
    // Actualizar estado en la tarea
    const tasks = getTasks();
    const task = tasks.find(t => t.location === location);
    if (task) {
        task.status = 'pending';
        saveTasks(tasks);
    }
    return { success: true, message: 'Ubicación desbloqueada.' };
};

export const isLocationClosed = (location) => {
    const closed = getClosedLocations();
    return closed.includes(location);
};

// --- CRUCE GERENCIAL ---
export const generateCrossReference = (stockGeneral, stockReserva) => {
    // Aquí implementaremos el cruce pesado
    // Por ahora retornamos una maqueta básica
    const scans = getScans();
    const closed = getClosedLocations();
    
    return {
        totalScans: scans.reduce((acc, curr) => acc + curr.qty, 0),
        totalLocationsClosed: closed.length,
        discrepancies: [] // Aquí irán los sobrantes/faltantes en el futuro
    };
};
