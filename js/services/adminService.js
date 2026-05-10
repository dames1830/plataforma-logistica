/**
 * Admin Service - Gestión de Personal, Usuarios y Performance (v13.2.7)
 */
const PREFIX = 'logistics_admin_v11_';
const API_BASE = 'https://logistics-backend-wv0x.onrender.com/api';
const API_URL = `${API_BASE}/logistics`;

export const adminStore = {
    workers: [],
    users: [],
    permissions: {},
    attendance: {}, 
    performance: [],
    performance_log: [],
    almacenaje_tasks: []
};

export const initializeAdminData = async () => {
    try {
        adminStore.workers = JSON.parse(localStorage.getItem(PREFIX + 'workers') || '[]');
        adminStore.users = JSON.parse(localStorage.getItem(PREFIX + 'users') || '[]');
        adminStore.permissions = JSON.parse(localStorage.getItem(PREFIX + 'permissions') || '{}');
        adminStore.attendance = JSON.parse(localStorage.getItem(PREFIX + 'attendance') || '{}');
        adminStore.performance = JSON.parse(localStorage.getItem(PREFIX + 'performance') || '[]');
        adminStore.performance_log = JSON.parse(localStorage.getItem(PREFIX + 'performance_log') || '[]');
        const localTasks = JSON.parse(localStorage.getItem(PREFIX + 'almacenaje_tasks') || '[]');
        adminStore.almacenaje_tasks = Array.isArray(localTasks) ? localTasks : [];
    } catch (e) {
        console.warn("⚠️ Error cargando datos locales:", e);
    }

    try {
        const areas = ['workers', 'users', 'permissions', 'attendance', 'performance', 'performance_log', 'almacenaje_tasks'];
        const fetchWithTimeout = (url, options, timeout = 10000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
            ]);
        };

        await Promise.all(areas.map(async (area) => {
            try {
                const res = await fetchWithTimeout(`${API_URL}/${area}`);
                if (res.ok) {
                    const result = await res.json();
                    let serverData;
                    if (area === 'permissions' || area === 'attendance') {
                        serverData = (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) ? result.data : (adminStore[area] || {});
                    } else {
                        serverData = Array.isArray(result.data) ? result.data : (result.data.data || []);
                    }

                    if (area === 'users' || area === 'workers') {
                        const local = JSON.parse(localStorage.getItem(PREFIX + area) || '[]');
                        const merged = Array.isArray(serverData) ? [...serverData] : [];
                        if (Array.isArray(local)) {
                            local.forEach(item => {
                                const key = area === 'users' ? 'username' : 'dni';
                                if (!merged.find(m => m[key] === item[key])) merged.push(item);
                            });
                        }
                        adminStore[area] = merged;
                        localStorage.setItem(PREFIX + area, JSON.stringify(merged));
                    } else {
                        if (!(Object.keys(serverData).length === 0 && Object.keys(adminStore[area]).length > 0)) {
                            adminStore[area] = serverData;
                            localStorage.setItem(PREFIX + area, JSON.stringify(serverData));
                        }
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Sync fallida para ${area}:`, err.message);
            }
        }));
    } catch (e) {
        console.warn("⚠️ Error general sync:", e);
    }
};

export const save = async (area, data) => {
    try {
        adminStore[area] = data;
        localStorage.setItem(PREFIX + area, JSON.stringify(data));
        let success = false;
        for (let i = 0; i < 2; i++) {
            try {
                const res = await fetch(`${API_URL}/${area}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data })
                });
                if (res.ok) { success = true; break; }
            } catch (err) { }
        }
        return success;
    } catch (e) {
        return false;
    }
};

export const getWorkers = () => adminStore.workers;
export const getUsers = () => adminStore.users;
export const getPermissions = (role) => adminStore.permissions[role] || {};

export const initPermissions = (tabs) => {
    const roles = ['admin', 'jefe', 'supervisor', 'encargado', 'asistente', 'analista'];
    roles.forEach(role => {
        if (!adminStore.permissions[role]) {
            const p = {};
            tabs.forEach(t => {
                p[t.id] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                if (t.subTabs) {
                    t.subTabs.forEach(s => {
                        p[`${t.id}_${s.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                        if (s.subTabs) {
                           s.subTabs.forEach(ss => {
                               p[`${s.id}_${ss.id}`] = (role === 'admin' || role === 'jefe') ? 1 : 0;
                           });
                        }
                    });
                }
            });
            adminStore.permissions[role] = p;
        }
    });
};

export const togglePermission = (role, tabId) => {
    const p = getPermissions(role);
    p[tabId] = p[tabId] === 1 ? 0 : 1;
    save('permissions', adminStore.permissions);
};

export const getAttendance = (dateStr) => adminStore.attendance[dateStr];
export const saveAttendance = async (dateStr, data, username) => {
    adminStore.attendance[dateStr] = { data, ts: Date.now(), user: username };
    return await save('attendance', adminStore.attendance);
};
