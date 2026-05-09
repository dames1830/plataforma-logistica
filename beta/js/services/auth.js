// URL del servidor backend para autenticación
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";

// Fallback local en caso de que el servidor esté caído
export const login = async (username, password) => {
  const targetUsername = (username || '').toLowerCase();
  console.log(`[ULTRA] Intento de login: ${targetUsername}`);

  // 1. PRIORIDAD MAESTRO (Siempre entra, no depende de nada)
  if (targetUsername === 'dames' && password === 'Bata1830') {
      const sessionData = { id: 1, username: 'dames', role: 'admin', name: 'Daniel Ames' };
      localStorage.setItem('logistics_session', JSON.stringify(sessionData));
      return { success: true, user: sessionData };
  }

  try {
      // 2. CARGA INICIAL (Rápida)
      let localRaw = localStorage.getItem('logistics_admin_v11_users');
      let dynamicUsers = localRaw ? JSON.parse(localRaw) : [];

      // 3. VALIDACIÓN INSTANTÁNEA (Si ya lo conocemos localmente, no esperamos a la nube)
      const checkLocal = () => {
          const u = dynamicUsers.find(x => x && (x.username || '').toLowerCase() === targetUsername);
          if (u && u.password === password && u.active !== false) return u;
          return null;
      };

      const userFound = checkLocal();
      if (userFound) {
          console.log("[ULTRA] Acceso concedido vía Local.");
          const sessionData = { id: Date.now(), username: userFound.username, role: userFound.role, name: userFound.name };
          localStorage.setItem('logistics_session', JSON.stringify(sessionData));
          return { success: true, user: sessionData };
      }

      // 4. SINCRONIZACIÓN FORZADA (Solo si no entró por local)
      console.log("[ULTRA] Usuario no encontrado local, consultando nube...");
      const cloudRes = await fetch(`${AUTH_API}/logistics/users?z=${Date.now()}`, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (cloudRes.ok) {
          const result = await cloudRes.json();
          // [AJUSTE ESTRUCTURAL] Soporte para datos anidados { data: { data: [] } }
          const serverList = (result && result.data) 
              ? (Array.isArray(result.data) ? result.data : (result.data.data || []))
              : [];

          if (Array.isArray(serverList)) {
              dynamicUsers = serverList;
              localStorage.setItem('logistics_admin_v11_users', JSON.stringify(dynamicUsers));
              
              const uCloud = dynamicUsers.find(x => x && (x.username || '').toLowerCase() === targetUsername);
              if (uCloud && uCloud.password === password && uCloud.active !== false) {
                  console.log("[ULTRA] Acceso concedido vía Nube.");
                  const sessionData = { id: Date.now(), username: uCloud.username, role: uCloud.role, name: uCloud.name };
                  localStorage.setItem('logistics_session', JSON.stringify(sessionData));
                  return { success: true, user: sessionData };
              }
          }
      }
  } catch (err) {
      console.error("[ULTRA] Error en proceso de login:", err);
  }

  return { success: false, message: 'Usuario no reconocido o contraseña incorrecta' };
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
