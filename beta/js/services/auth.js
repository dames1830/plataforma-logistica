// URL del servidor backend para autenticación
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";

// Fallback local en caso de que el servidor esté caído
const FALLBACK_USERS = [
  { id: 1, username: 'dames', password: 'Bata1830', role: 'admin', name: 'Gerente Logística (Dames)' }
];

export const login = async (username, password) => {
  console.log(`[PULSE] Intento de login: ${username} (v12.5.12)`);
  
  try {
    // [NIVEL 0] ACCESO MAESTRO ABSOLUTO (DAMES)
    // Tú siempre tienes prioridad y no dependes de ninguna lista local o externa.
    if (username === 'dames' && password === 'Bata1830') {
        const sessionData = { id: 1, username: 'dames', role: 'admin', name: 'Gerente Logística (Dames)' };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
    }

    // [NIVEL 1] SINCRONIZACIÓN DE LISTA DE ADMINISTRACIÓN
    let dynamicUsers = [];
    try {
        const cloudRes = await fetch(`${AUTH_API}/logistics/users`);
        if (cloudRes.ok) {
            const result = await cloudRes.json();
            if (result.data && Array.isArray(result.data)) {
                dynamicUsers = result.data;
                localStorage.setItem('logistics_admin_v11_users', JSON.stringify(dynamicUsers));
            }
        } else {
            // Fallback a local si la nube no responde
            const local = localStorage.getItem('logistics_admin_v11_users');
            if (local) dynamicUsers = JSON.parse(local);
        }
    } catch(e) { 
        console.warn("Error de red, usando caché local.");
        const local = localStorage.getItem('logistics_admin_v11_users');
        if (local) dynamicUsers = JSON.parse(local);
    }

    // [NIVEL 2] VALIDACIÓN DE OPERARIOS AUTORIZADOS
    const dUser = dynamicUsers.find(u => u && u.username === username);
    if (dUser) {
        if (dUser.active === false) return { success: false, message: 'Cuenta desactivada por administración.' };
        if (dUser.password === password) {
            const sessionData = { id: Date.now(), username: dUser.username, role: dUser.role, name: dUser.name };
            localStorage.setItem('logistics_session', JSON.stringify(sessionData));
            return { success: true, user: sessionData };
        } else {
            return { success: false, message: 'Contraseña incorrecta.' };
        }
    }

    // [NIVEL 3] VALIDACIÓN CONTRA BACKEND (LEGACY)
    const response = await fetch(`${AUTH_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        // Solo dejamos entrar si el servidor confirma, pero para operarios 
        // ya debió pasar por el Nivel 2. Esto es un respaldo.
        const sessionData = { id: result.user.id, username: result.user.username, role: result.user.role, name: result.user.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      }
    }
  } catch (err) {
    console.error("Error crítico en proceso de login:", err);
  }

  return { success: false, message: 'Credenciales inválidas o acceso no autorizado' };
};

export const logout = () => {
  localStorage.removeItem('logistics_session');
};

export const getSession = () => {
  const session = localStorage.getItem('logistics_session');
  if (!session) return null;
  const user = JSON.parse(session);
  
  // [SEGURIDAD GOLD] Si el usuario no es 'dames', verificar que siga activo en la lista oficial
  if (user.username !== 'dames') {
      const dynamicUsersRaw = localStorage.getItem('logistics_admin_v11_users');
      if (dynamicUsersRaw) {
          try {
              const dynamicUsers = JSON.parse(dynamicUsersRaw);
              if (Array.isArray(dynamicUsers)) {
                  const activeUser = dynamicUsers.find(u => u.username === user.username && u.active !== false);
                  if (!activeUser) {
                      console.warn("🚨 Sesión revocada: Usuario no autorizado.");
                      logout();
                      return null;
                  }
              }
          } catch(e) { console.warn("Error validando sesión:", e); }
      } else {
          // Si no hay lista de usuarios, nadie excepto dames puede estar logueado
          logout();
          return null;
      }
  }
  return user;
};
