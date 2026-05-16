/**
 * SYNC ENGINE v25.0.8 - Motor de Sincronización Global (Estable)
 */

const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api/logistics';
const SYNC_PREFIX = 'logistics_sync_v24_';
const TIMEOUT_MS = 60000;

export const syncStore = {
    workers: [],
    users: [],
    permissions: {},
    attendance: {},
    performance_log: [],
    almacenaje_tasks: [],
    lastSync: null
};

export const pullGlobal = async (areasInput = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks'], force = false) => {
    let areas = Array.isArray(areasInput) ? areasInput : [areasInput];

    if (localStorage.getItem('PULSE_OFFLINE_FORCE') && !force) {
        areas.forEach(area => {
            const local = localStorage.getItem(SYNC_PREFIX + area);
            if (local) syncStore[area] = JSON.parse(local);
        });
        return true;
    }

    const results = await Promise.all(areas.map(async (area) => {
        try {
            const res = await fetch(`${API_BASE}/${area}?z=${Date.now()}`, {
                headers: { 'X-Environment': 'production' }
            });
            if (res.ok) {
                const result = await res.json();
                let data = result.data !== undefined ? result.data : result;
                if (data && typeof data === 'object' && data.data !== undefined && !Array.isArray(data)) data = data.data;

                let newData = Array.isArray(data) ? data : (data || (area === 'permissions' || area === 'attendance' ? {} : []));

                // Decompress almacenaje_tasks if needed
                if (area === 'almacenaje_tasks' && Array.isArray(newData)) {
                    syncStore[area] = newData.map(t => {
                        if (t._comp && Array.isArray(t.items)) {
                            const restoredItems = t.items.map(artArr => {
                                const [sku7, marca, gender, coleccion, bufferQty, zonaQty, compactArtItems] = artArr;
                                const restoredArtItems = compactArtItems.map(iArr => ({
                                    skuFull: iArr[0], ubi: iArr[1], qty: iArr[2], talla: iArr[3] || 'S/TALLA'
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
                return true;
            }
        } catch (e) { console.warn(`Pull error ${area}:`, e); }
        const local = localStorage.getItem(SYNC_PREFIX + area);
        if (local) syncStore[area] = JSON.parse(local);
        return false;
    }));
    return results.every(r => r === true);
};

export const pushChange = async (area, data) => {
    syncStore[area] = data;
    localStorage.setItem(SYNC_PREFIX + area, JSON.stringify(data));

    if (localStorage.getItem('PULSE_OFFLINE_FORCE') && area !== 'almacenaje_tasks') return true;

    try {
        let payload = data;
        if (area === 'almacenaje_tasks' && Array.isArray(data)) {
            payload = data.map(t => {
                const compactItems = (t.items || []).map(art => {
                    const compactArtItems = (art.items || []).map(i => [i.skuFull || i.sku || '---', i.ubi, i.qty, i.talla || 'S/TALLA']);
                    return [art.sku7, art.marca, art.gender, art.coleccion, art.bufferQty, art.zonaQty, compactArtItems];
                });
                return { ...t, items: compactItems, _comp: true };
            });
        }

        const res = await fetch(`${API_BASE}/${area}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Environment': 'production'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) return true;
    } catch (e) { console.error(`Push error ${area}:`, e); }
    return false;
};

export const initSync = async (force = false) => {
    const areas = ['workers', 'users', 'permissions', 'attendance', 'performance_log', 'almacenaje_tasks'];
    areas.forEach(area => {
        const local = localStorage.getItem(SYNC_PREFIX + area);
        if (local) syncStore[area] = JSON.parse(local);
    });
    return await pullGlobal(areas, force);
};
