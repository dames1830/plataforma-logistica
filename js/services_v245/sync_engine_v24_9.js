/**
 * Motor de Sincronización Daniel v25.1.3 (Ultimate Stabilization)
 * Restaurada área de WORKERS y fijado error de iteración.
 */

const getApiBase = (defaultUrl) => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('local')) {
      const val = urlParams.get('local');
      if (val === '1' || val === 'true') {
          localStorage.setItem('PULSE_USE_LOCAL', 'true');
      } else {
          localStorage.removeItem('PULSE_USE_LOCAL');
      }
  }
  if (localStorage.getItem('PULSE_USE_LOCAL') === 'true') {
      return 'http://localhost:8000/api/logistics';
  }
  return defaultUrl;
};
const API_BASE = getApiBase('https://logistics-backend-wv0x.onrender.com/api/logistics');
// --- CENTRALIZAR STATE GLOBAL PARA EVITAR DUPLICADOS POR CACHE QUERY STRINGS ---
if (!window._pulseSyncState) {
    window._pulseSyncState = {
        isFirstPullDone: false,
        lastPushTimes: {},
        syncStore: {
            almacenaje_tasks: [],
            attendance: {},
            permissions: {},
            workers: [], 
            users: [], 
            performance: {}, 
            performance_log: [], 
            config: {},
            rfs: [],
            rf_assignments: [],
            rfs_batteries: [],
            rfs_chargers: []
        }
    };
}
if (!window._pulseSyncState.lastPushTimes) {
    window._pulseSyncState.lastPushTimes = {};
}

export const syncStore = window._pulseSyncState.syncStore;

// --- LOGICA DE SINCRONIZACION ---

export let isFirstPullDone = window._pulseSyncState.isFirstPullDone;

// Mantener la variable exportada en sincronía con el estado global (live binding)
setInterval(() => {
    if (window._pulseSyncState.isFirstPullDone && !isFirstPullDone) {
        isFirstPullDone = true;
    }
}, 100);

export async function initSync() {
    console.log("🚀 [PULSE] Inicializando Motor v25.1.44...");
    try {
        await pullGlobal();
    } catch (e) {
        console.warn("⚠️ [PULSE] Error en carga inicial, pero activando motor:", e);
    }
    window._pulseSyncState.isFirstPullDone = true;
    isFirstPullDone = true;
    console.log("✅ [PULSE] Primera sincronización completada.");
    setInterval(pullGlobal, 30000);
    return syncStore;
}

export async function pullGlobal(requestedAreas = null, force = false) {
    console.log(`📥 [PULSE] Sincronización: Descargando ${requestedAreas ? requestedAreas.join(', ') : 'Todo'}...`);
    const allAreas = ['almacenaje_tasks', 'attendance', 'permissions', 'workers', 'users', 'performance', 'performance_log', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'buffer_history'];
    const areas = requestedAreas || allAreas;

    const results = await Promise.all(areas.map(async (area) => {
        try {
            const res = await fetch(`${API_BASE}/${area}?z=${Date.now()}`);
            if (res.ok) {
                const result = await res.json();
                if (result.status === 'error') throw new Error(result.message);
                let data = result.data !== undefined ? result.data : result;

                if (area === 'almacenaje_tasks' && Array.isArray(data)) {
                    data = data.map(t => {
                        if (t._comp && Array.isArray(t.items)) {
                            const restoredItems = t.items.map(artArr => {
                                const [sku7, marca, gender, coleccion, bQty, zQty, cItems] = artArr;
                                return {
                                    sku7, marca, gender, coleccion, bufferQty: bQty, zonaQty: zQty,
                                    items: cItems.map(i => { const itemObj = { skuFull: i[0], ubi: i[1], qty: i[2], talla: i[3] }; if (i[4] !== undefined && i[4] !== null) { itemObj.avance = i[4]; } if (i[5] !== undefined && i[5] !== null) { itemObj.qtyInitial = i[5]; } return itemObj; })
                                };
                            });
                            return { ...t, items: restoredItems, _comp: false };
                        }
                        return t;
                    });
                }
                return { area, data };
            }
            return { area, data: null };
        } catch (err) {
            console.error(`❌ Pull error ${area}:`, err);
            return { area, data: null };
        }
    }));

    results.forEach(r => {
        if (r.data) {
            // [BETA] Evitar sobrescrituras por colisiones si se realizó un push local reciente
            const lastPush = window._pulseSyncState.lastPushTimes && window._pulseSyncState.lastPushTimes[r.area];
            if (lastPush && (Date.now() - lastPush < 15000)) {
                console.log(`[PULSE] Omitiendo sobrescritura por Pull en ${r.area} debido a Push local reciente.`);
                return;
            }
            const current = syncStore[r.area];
            const incoming = r.data;
            
            // Si el área es un objeto (como attendance), verificamos compatibilidad
            if (current && typeof current === 'object' && !Array.isArray(current)) {
                if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
                    syncStore[r.area] = { ...syncStore[r.area], ...incoming };
                }
            } else {
                syncStore[r.area] = incoming;
            }
        }
    });
    window._pulseSyncState.isFirstPullDone = true;
    isFirstPullDone = true;
    console.log("✅ [PULSE] Nube sincronizada.");
    return syncStore;
}

export async function pushChange(area, data, date = null) {
    if (!data) return;
    try {
        let payload = data;
        if (area === 'almacenaje_tasks' && Array.isArray(data)) {
            payload = data.map(t => {
                const compactItems = (t.items || []).map(art => {
                    const cArtItems = (art.items || []).map(i => [i.skuFull || i.sku || '---', i.ubi, i.qty, i.talla || 'S/TALLA', i.avance !== undefined ? i.avance : null, i.qtyInitial !== undefined ? i.qtyInitial : null]);
                    return [art.sku7, art.marca, art.gender, art.coleccion, art.bufferQty, art.zonaQty, cArtItems];
                });
                return { ...t, items: compactItems, _comp: true };
            });
        }

        const url = date ? `${API_BASE}/${area}?date=${date}` : `${API_BASE}/${area}`;
        if (window._pulseSyncState.lastPushTimes) {
            window._pulseSyncState.lastPushTimes[area] = Date.now();
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok || result.status === 'error') throw new Error(result.message || 'Error en servidor');
        return true;
    } catch (err) {
        console.error(`❌ Push error ${area}:`, err);
        throw err;
    }
}
