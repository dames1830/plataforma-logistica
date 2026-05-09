// URL del servidor backend para autenticación
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";

// Fallback local en caso de que el servidor esté caído
const FALLBACK_USERS = [
  { id: 1, username: 'dames', password: 'Bata1830', role: 'admin', name: 'Gerente Logística (Dames)' }
];

export const login = async (username, password) => {
  // [ESTRATEGIA GOLD v12.5.11] Prioridad Absoluta a la Lista de Administración
  try {
    let dynamicUsersRaw = localStorage.getItem('logistics_admin_v11_users');
    let dynamicUsers = dynamicUsersRaw ? JSON.parse(dynamicUsersRaw) : [];

    // 1. Sincronización obligatoria para asegurar que nuevos usuarios entren en cualquier PC
    console.log(`[PULSE] Sincronizando credenciales para ${username}...`);
    try {
        const cloudRes = await fetch(`${AUTH_API}/logistics/users`);
        if (cloudRes.ok) {
            const result = await cloudRes.json();
            if (result.data && Array.isArray(result.data)) {
                dynamicUsers = result.data;
                localStorage.setItem('logistics_admin_v11_users', JSON.stringify(dynamicUsers));
            }
        }
    } catch(e) { console.warn("Sincronización de nube fallida, usando caché local."); }

    // 2. Validación contra la lista de Administración (Nube + Local)
    // Buscamos al usuario en la lista que TÚ manejas
    const dUser = dynamicUsers.find(u => u && u.username === username);
    
    if (dUser) {
        if (dUser.active === false) return { success: false, message: 'Cuenta desactivada por administración.' };
        
        // Si la contraseña coincide con lo que pusiste en el módulo de usuarios
        if (dUser.password === password) {
            const sessionData = { 
                id: Date.now(), 
                username: dUser.username, 
                role: dUser.role, 
                name: dUser.name 
            };
            localStorage.setItem('logistics_session', JSON.stringify(sessionData));
            console.log(`[PULSE] Acceso concedido via AdminList: ${username}`);
            return { success: true, user: sessionData };
        } else {
            return { success: false, message: 'Contraseña incorrecta.' };
        }
    }

    // 3. Acceso Maestro Directo (dames)
    if (username === 'dames' && password === 'Bata1830') {
        const sessionData = { id: 1, username: 'dames', role: 'admin', name: 'Gerente Logística (Dames)' };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
    }

    // 4. Intento contra el servidor de autenticación (Legacy/Otros sistemas)
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
    console.error("Error crítico en login:", err);
  }

  return { success: false, message: 'Credenciales inválidas' };
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
