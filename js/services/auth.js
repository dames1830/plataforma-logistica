// URL del servidor backend para autenticación y datos
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";
const PREFIX = 'logistics_admin_v11_';

// Fallback local en caso de que el servidor esté caído
const FALLBACK_USERS = [
  { id: 1, username: 'dames', password: 'Bata1830', role: 'admin', name: 'Gerente Logística (Dames)' }
];

export const login = async (username, password) => {
  // 1. Intento vía API de Autenticación Central (Seguridad)
  try {
    const response = await fetch(`${AUTH_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const sessionData = { id: result.user.id, username: result.user.username, role: result.user.role, name: result.user.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      }
    }
  } catch (err) {
    console.warn("API de Autenticación no disponible, usando base de datos distribuida...");
  }

  // 2. Maestro / Emergencia
  const masterUser = FALLBACK_USERS.find(u => u.username === username && u.password === password);
  if (masterUser) {
    const sessionData = { id: masterUser.id, username: masterUser.username, role: masterUser.role, name: masterUser.name };
    localStorage.setItem('logistics_session', JSON.stringify(sessionData));
    return { success: true, user: sessionData };
  }

  // 3. Usuarios Dinámicos (Base de Datos Distribuida de Usuarios)
  // Paso A: Verificar localmente primero
  let dynamicUsers = [];
  try {
    const raw = localStorage.getItem(PREFIX + 'users');
    if (raw) dynamicUsers = JSON.parse(raw);
  } catch(e) {}

  let user = dynamicUsers.find(u => u.username === username && u.password === password);

  // Paso B: Si no está local, SINCRONIZAR con la nube inmediatamente
  if (!user) {
    try {
        console.log("Usuario no encontrado localmente. Sincronizando con la nube...");
        const res = await fetch(`${AUTH_API}/logistics/users`);
        if (res.ok) {
            const result = await res.json();
            if (result.data && Array.isArray(result.data)) {
                dynamicUsers = result.data;
                localStorage.setItem(PREFIX + 'users', JSON.stringify(dynamicUsers));
                user = dynamicUsers.find(u => u.username === username && u.password === password);
            }
        }
    } catch(err) {
        console.warn("Fallo de sincronización de usuarios:", err);
    }
  }

  if (user) {
    if (user.active === false) return { success: false, message: 'Cuenta desactivada.' };
    const sessionData = { id: Date.now(), username: user.username, role: user.role, name: user.name };
    localStorage.setItem('logistics_session', JSON.stringify(sessionData));
    return { success: true, user: sessionData };
  }

  return { success: false, message: 'Credenciales inválidas' };
};

export const logout = () => {
  localStorage.removeItem('logistics_session');
};

export const getSession = () => {
  const session = localStorage.getItem('logistics_session');
  return session ? JSON.parse(session) : null;
};
