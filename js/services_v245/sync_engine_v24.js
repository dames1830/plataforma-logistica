/**
 * SYNC ENGINE v24 - Motor de Sincronización Global (Cero Fallos)
 * Este motor centraliza toda la comunicación con la nube y garantiza la integridad de datos entre múltiples PCs.
 */

const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
const SYNC_PREFIX = 'logistics_sync_v24_';
const TIMEOUT_MS = 60000; // 60 segundos de paciencia

export const syncStore = {
    workers: [],
    users: [],
    permissions: {},
    attendance: {},
    performance_log: [],
    almacenaje_tasks: [],
    lastSync: null
};

/**
 * PULL GLOBAL: Trae toda la verdad de la nube y actualiza el estado local.
 */
export const pullGlobal = async (areas = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks']) => {
    console.log("🔄 [SYNC v24] Iniciando Pull Global...");
    
    const results = await Promise.all(areas.map(async (area) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const res = await fetch(`${API_BASE}/${area}?cb=${Date.now()}`, {
                method: 'GET',
                headers: { 'X-Environment': 'production' },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            if (res.ok) {
                const result = await res.json();
                let data = result.data !== undefined ? result.data : result;
                
                // Limpieza de datos anidados si existen
                if (data && typeof data === 'object' && data.data !== undefined && !Array.isArray(data)) {
                    data = data.data;
                }

                syncStore[area] = Array.isArray(data) ? data : (data || (area === 'permissions' || area === 'attendance' ? {} : []));
                localStorage.setItem(SYNC_PREFIX + area, JSON.stringify(syncStore[area]));
                return true;
            }
        } catch (e) {
            console.warn(`⚠️ [SYNC v24] Fallo en Pull de "${area}":`, e.message);
        }
        
        // Fallback a localStorage si la nube falla
        const local = localStorage.getItem(SYNC_PREFIX + area);
        if (local) syncStore[area] = JSON.parse(local);
        return false;
    }));

    syncStore.lastSync = new Date().toISOString();
    return results.every(r => r === true);
};

/**
 * PUSH INDIVIDUAL: Guarda localmente y empuja a la nube de inmediato.
 */
export const pushChange = async (area, data) => {
    // 1. Guardado Local Inmediato (Supervivencia)
    syncStore[area] = data;
    localStorage.setItem(SYNC_PREFIX + area, JSON.stringify(data));
    
    console.log(`📡 [SYNC v24] Empujando "${area}" a la nube...`);

    // 2. Intento de subida
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const res = await fetch(`${API_BASE}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify({ data: data }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
            console.log(`✅ [SYNC v24] "${area}" guardado en la nube.`);
            return true;
        } else {
            const errorMsg = `ERROR NUBE: ${res.status} ${res.statusText || ''}`;
            console.error(`❌ [SYNC v24] ${errorMsg} en "${area}"`);
            const indicatorText = document.getElementById('sync-text');
            if (indicatorText) indicatorText.innerText = errorMsg;
            return false;
        }
    } catch (e) {
        const errorMsg = `FALLO CONEXIÓN: ${e.message}`;
        console.error(`🚨 [SYNC v24] ${errorMsg} al empujar "${area}"`);
        const indicatorText = document.getElementById('sync-text');
        if (indicatorText) indicatorText.innerText = errorMsg;
        return false;
    }
};

/**
 * INITIALIZE: Carga inicial y primer pull.
 */
export const initSync = async () => {
    // Carga local rápida
    const areas = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks'];
    areas.forEach(area => {
        const local = localStorage.getItem(SYNC_PREFIX + area);
        if (local) syncStore[area] = JSON.parse(local);
    });

    // Pull de la nube en segundo plano para actualizar
    return await pullGlobal(areas);
};
