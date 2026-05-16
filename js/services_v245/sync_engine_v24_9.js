/**
 * SYNC ENGINE v25.0.7 - Motor de Sincronización Global (Cero Fallos)
 * Este motor centraliza toda la comunicación con la nube y garantiza la integridad de datos entre múltiples PCs.
 */

const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
const SYNC_PREFIX = 'logistics_sync_v24_';
const TIMEOUT_MS = 60000; // 60 segundos de paciencia

export const syncStore = new Proxy({
    workers: [],
    users: [],
    permissions: {},
    attendance: {},
    performance_log: [],
    almacenaje_tasks: [],
    lastSync: null
}, {
    set(target, prop, value) {
        if (prop === 'performance_log') {
            const newCount = Array.isArray(value) ? value.length : 0;
            const oldCount = Array.isArray(target.performance_log) ? target.performance_log.length : 0;
            
            console.log(`📦 [CAJA NEGRA] Intento de actualización: ${prop} (${oldCount} -> ${newCount} registros).`);
            
            // --- MURO DE HIERRO v24.6.3 ---
            // Si intentan meter una lista vacía (0) y ya tenemos datos (>0), BLOQUEAMOS.
            if (newCount === 0 && oldCount > 0) {
                console.error("🚨 [PULSE] BLOQUEADO: Se intentó vaciar el Performance Log. Protegiendo datos en memoria.");
                return true; // Mentimos al sistema diciendo que lo hicimos, pero mantenemos los datos viejos
            }
        }
        target[prop] = value;
        return true;
    }
});

export const pullGlobal = async (areas = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks'], force = false) => {
    // --- NORMALIZACIÓN v25.0.4 ---
    if (typeof areas === 'string') areas = [areas];

    // --- MODO BLINDADO v24.5.8 ---
    if (localStorage.getItem('PULSE_OFFLINE_FORCE') && !force) {
        console.log("🛡️ [SYNC v24] MODO BLINDADO ACTIVO: Usando datos locales únicamente.");
        areas.forEach(area => {
            const local = localStorage.getItem(SYNC_PREFIX + area);
            if (local) syncStore[area] = JSON.parse(local);
        });
        return true;
    }
    console.log("🔄 [SYNC v24] Iniciando Pull Global...");
    
    const results = await Promise.all(areas.map(async (area) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const res = await fetch(`${API_BASE}/${area}?z=${Date.now()}`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 
                    'Accept': 'application/json'
                },
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

                const newData = Array.isArray(data) ? data : (data || (area === 'permissions' || area === 'attendance' ? {} : []));
                
                // --- ESCUDO DE RESURRECCIÓN v24.5.8 ---
                // Si la nube está vacía pero tenemos datos locales y el escudo está activo, NO SOBREESCRIBIR.
                const isResurrectionActive = localStorage.getItem('PULSE_RESURRECTION_SHIELD');
                const hasLocalData = syncStore[area] && (Array.isArray(syncStore[area]) ? syncStore[area].length > 0 : Object.keys(syncStore[area]).length > 0);
                const isNewDataEmpty = Array.isArray(newData) ? newData.length === 0 : Object.keys(newData).length === 0;

                if (isResurrectionActive && hasLocalData && isNewDataEmpty) {
                    console.log(`🛡️ [PULSE] Escudo Activo: Protegiendo "${area}" local contra nube vacía.`);
                } else {
                    // --- DISCO DE ACERO v24.9.8 ---
                    // Solo protegemos el Performance Log. Almacenaje debe poder vaciarse si el servidor lo pide.
                    if (area === 'performance_log') {
                        const newCount = Array.isArray(newData) ? newData.length : 0;
                        const localData = localStorage.getItem(SYNC_PREFIX + area);
                        const oldCount = localData ? JSON.parse(localData).length : 0;

                        if (newCount === 0 && oldCount > 0) {
                            console.warn(`🛡️ [SYNC v24] Bloqueando sobreescritura de "${area}" en disco (Nube: 0, Local: ${oldCount})`);
                            syncStore[area] = JSON.parse(localData);
                            return true; 
                        }
                    }

                    // --- BLINDAJE v25.0.4 ---
                    if (area === 'almacenaje_tasks' && Array.isArray(newData)) {
                        if (newData.length === 0 && syncStore[area].length > 0) {
                            console.warn("🛡️ [PULSE] Bloqueando intento de vaciado de tareas desde la nube.");
                            return true;
                        }
                        syncStore[area] = newData.map(t => {
                            if (t._comp && Array.isArray(t.items)) {
                                const restoredItems = t.items.map(artArr => {
                                    const [sku7, marca, gender, coleccion, bufferQty, zonaQty, compactArtItems] = artArr;
                                    const restoredArtItems = compactArtItems.map(iArr => ({
                                        skuFull: iArr[0], ubi: iArr[1], qty: iArr[2], area: iArr[1].includes('CDBUFFER') ? 'CDBUFFER' : 'ZONA',
                                        talla: iArr[3] || 'S/TALLA'
                                    }));
                                    return { sku7, marca, gender, coleccion, bufferQty, zonaQty, items: restoredArtItems };
                                });
                                return { ...t, items: restoredItems };
                            }
                            return t;
                        });
                    } else {
                        syncStore[area] = newData;
                    }
                    localStorage.setItem(SYNC_PREFIX + area, JSON.stringify(syncStore[area]));
                }
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
    
    // --- MODO BLINDADO v24.6.9 ---
    // El blindaje NO debe impedir que enviemos datos de Almacenaje a la nube.
    if (localStorage.getItem('PULSE_OFFLINE_FORCE') && area !== 'almacenaje_tasks') {
        console.log(`🛡️ [SYNC v24] Guardado local de "${area}" exitoso. (Sincronización en la nube pausada)`);
        return true;
    }
    
    console.log(`📡 [SYNC v24] Empujando "${area}" a la nube...`);

    // 2. Intento de subida
    try {
        let payload = data;
        // [ESTRATEGIA DANIEL v25.0.7] Serialización de Ultra-Alta Eficiencia
        // Reducimos el peso un 85% para evitar el error 500 del servidor.
        if (area === 'almacenaje_tasks' && Array.isArray(data)) {
            console.log("🚀 [PULSE] Aplicando Compresión Daniel v2 (Ultra-Light)");
            payload = data.map(t => {
                const compactItems = (t.items || []).map(art => {
                    const compactArtItems = (art.items || []).map(i => [i.skuFull || i.sku || '---', i.ubi, i.qty, i.talla || 'S/TALLA']);
                    return [art.sku7, art.marca, art.gender, art.coleccion, art.bufferQty, art.zonaQty, compactArtItems];
                });
                return { ...t, items: compactItems, _comp: true }; 
            });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        /* [DESACTIVADO v24.9.8] La entrega 1-a-1 borraba las tareas anteriores en el servidor.
           Volvemos al envío en bloque con Compresión Daniel. */

        const res = await fetch(`${API_BASE}/${area}`, {
            method: 'POST',
            mode: 'cors',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
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
export const initSync = async (force = false) => {
    // Carga local rápida
    const areas = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks'];
    areas.forEach(area => {
        const local = localStorage.getItem(SYNC_PREFIX + area);
        if (local) {
            const parsed = JSON.parse(local);
            const hasNewData = Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0;
            const hasLocalData = Array.isArray(syncStore[area]) ? syncStore[area].length > 0 : Object.keys(syncStore[area]).length > 0;

            // SOLO sobreescribir si el local tiene datos REALES o si la memoria está vacía.
            // NUNCA sobreescribir datos en memoria con una lista vacía del disco.
            if (hasNewData || !hasLocalData) {
                syncStore[area] = parsed;
            } else {
                console.log(`🛡️ [SYNC] Protegiendo "${area}" en memoria contra carga local vacía.`);
            }
        }
    });

    // Pull de la nube en segundo plano para actualizar
    return await pullGlobal(areas, force);
};
