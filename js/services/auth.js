// URL del servidor backend para autenticación
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";

// Fallback local en caso de que el servidor esté caído
const FALLBACK_USERS = [
  { id: 1, username: 'dames', password: 'Bata1830', role: 'admin', name: 'Gerente Logística (Dames)' }
];

export const login = async (username, password) => {
  try {
    const response = await fetch(`${AUTH_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // [PULSE] Sesión iniciada correctamente vía Servidor
        const sessionData = { id: result.user.id, username: result.user.username, role: result.user.role, name: result.user.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      } else if (result.message) {
        // [IMPORTANTE] Mostrar el error real del servidor para diagnosticar
        console.warn("Servidor rechazó el login:", result.message);
        return { success: false, message: `Servidor: ${result.message}` };
      }
    }
    console.warn("Respuesta de red OK pero sin éxito, intentando local...");
  } catch (err) {
    console.warn("Error de conexión al servidor, intentando login local...");
  }

  // 2. Fallback: login local solo para admin de emergencia (Maestro)
  const masterUser = FALLBACK_USERS.find(u => u.username === username && u.password === password);
  if (masterUser) {
    const sessionData = { id: masterUser.id, username: masterUser.username, role: masterUser.role, name: masterUser.name };
    localStorage.setItem('logistics_session', JSON.stringify(sessionData));
    return { success: true, user: sessionData };
  }

  // 3. Fallback: Usuarios dinámicos creados en el módulo de Administración
  try {
    const dynamicUsersRaw = localStorage.getItem('logistics_admin_v11_users');
    if (dynamicUsersRaw) {
      const dynamicUsers = JSON.parse(dynamicUsersRaw);
      const dUser = dynamicUsers.find(u => u.username === username && u.password === password);
      
      if (dUser) {
        if (dUser.active === false) {
           return { success: false, message: 'Cuenta desactivada. Contacte al administrador.' };
        }
        const sessionData = { id: Date.now(), username: dUser.username, role: dUser.role, name: dUser.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      }
    }
  } catch (err) {
    console.error("Error leyendo usuarios dinámicos:", err);
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
