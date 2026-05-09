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
        // [PULSE SECURITY OVERRIDE] Blindaje Maestro - Sincronizado
        if (username !== 'dames') {
            let dynamicUsersRaw = localStorage.getItem('logistics_admin_v11_users');
            
            // Si no hay lista local, intentar descarga de emergencia antes de rechazar
            if (!dynamicUsersRaw) {
                console.log("🔍 Nueva terminal detectada, sincronizando lista de autorizados...");
                try {
                    const cloudRes = await fetch(`${AUTH_API}/logistics/users`);
                    if (cloudRes.ok) {
                        const cloudData = await cloudRes.json();
                        if (cloudData.data && Array.isArray(cloudData.data)) {
                            localStorage.setItem('logistics_admin_v11_users', JSON.stringify(cloudData.data));
                            dynamicUsersRaw = JSON.stringify(cloudData.data);
                        }
                    }
                } catch(e) { console.error("Error sincronizando nube en login:", e); }
            }

            if (dynamicUsersRaw) {
                try {
                    const dynamicUsers = JSON.parse(dynamicUsersRaw);
                    if (Array.isArray(dynamicUsers)) {
                        const dUser = dynamicUsers.find(u => u.username === username);
                        if (!dUser) {
                            console.warn("🚨 Acceso denegado: No figura en la base de datos oficial.");
                            return { success: false, message: 'Acceso denegado. No está registrado en el sistema.' };
                        }
                        if (dUser.active === false) return { success: false, message: 'Cuenta desactivada por administración.' };
                        // Si el login fue exitoso en el servidor, no necesitamos re-validar la contraseña aquí
                    }
                } catch(e) { console.error("Error en validación de seguridad:", e); }
            } else {
                console.warn("🚨 RECHAZO: No se pudo sincronizar la lista de autorizados.");
                return { success: false, message: 'Seguridad activa: No se pudo validar su autorización.' };
            }
        }

        const sessionData = { id: result.user.id, username: result.user.username, role: result.user.role, name: result.user.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      }
      // Si el servidor falla (ej: credenciales no están en el backend),
      // dejamos que baje a los fallbacks locales de la Beta.
    }
    // Si llegamos aquí, el servidor respondió con error (ej: 404 o 500)
    console.warn("Servidor respondió con error, intentando login local...");
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
    let dynamicUsersRaw = localStorage.getItem('logistics_admin_v11_users');
    let dynamicUsers = dynamicUsersRaw ? JSON.parse(dynamicUsersRaw) : [];

    // [NUEVO] Si no está local, intentar descarga rápida de emergencia desde la nube
    const dUserLocal = dynamicUsers.find(u => u.username === username && u.password === password);
    
    if (!dUserLocal) {
        console.log("🔍 Usuario no encontrado localmente, consultando nube...");
        const cloudRes = await fetch(`${AUTH_API}/logistics/users`);
        if (cloudRes.ok) {
            const result = await cloudRes.json();
            if (result.data && Array.isArray(result.data)) {
                dynamicUsers = result.data;
                localStorage.setItem('logistics_admin_v11_users', JSON.stringify(dynamicUsers));
            }
        }
    }

    const dUser = dynamicUsers.find(u => u.username === username && u.password === password);
    if (dUser) {
        if (dUser.active === false) {
            return { success: false, message: 'Cuenta desactivada. Contacte al administrador.' };
        }
        const sessionData = { id: Date.now(), username: dUser.username, role: dUser.role, name: dUser.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
    }
  } catch (err) {
    console.error("Error en autenticación extendida:", err);
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
