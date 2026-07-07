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
      return 'http://localhost:8000/api';
  }
  return defaultUrl;
};
const AUTH_API = getApiBase("https://logistics-backend-wv0x.onrender.com/api");
const VERSION = '24.8.0';

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

  let dynamicUsers = [];
  let isCloudSuccess = false;

  try {
      // 2. SINCRONIZACIÓN FORZADA (Intentar siempre traer base de datos fresca del servidor)
      console.log("[ULTRA] Consultando base de datos del servidor para validación...");
      const cloudRes = await fetch(`${AUTH_API}/logistics/users?z=${Date.now()}`, { 
          cache: 'no-store',
          headers: { 
            'Cache-Control': 'no-cache',
            'X-Environment': 'production'
          }
      });
      
      if (cloudRes.ok) {
          const result = await cloudRes.json();
          let serverList = [];
          if (Array.isArray(result)) {
              serverList = result;
          } else if (result && result.data) {
              serverList = Array.isArray(result.data) ? result.data : (result.data.data || []);
          } else if (result) {
              serverList = result;
          }

          if (Array.isArray(serverList)) {
              dynamicUsers = serverList;
              localStorage.setItem('logistics_admin_v11_users', JSON.stringify(dynamicUsers));
              isCloudSuccess = true;
              console.log("[ULTRA] Base de usuarios actualizada desde el servidor.");
          }
      }
  } catch (err) {
      console.warn("[ULTRA] Error de conexión al servidor durante el login:", err);
  }

  // Si falló la red, rechazar el login inmediatamente (Plan B Eliminado)
  if (!isCloudSuccess) {
      return { success: false, message: 'Error de conexión. Se requiere internet para iniciar sesión.' };
  }

  // 4. VALIDACIÓN DE CREDENCIALES
  const u = dynamicUsers.find(x => x && (x.username || '').toLowerCase() === targetUsername);
  if (u) {
      if (u.active === false) {
          console.warn(`🚨 Acceso denegado: El usuario ${targetUsername} está desactivado.`);
          return { success: false, message: 'Usuario inactivo o desactivado' };
      }
      if (String(u.password) === String(password)) {
          console.log(`[ULTRA] Acceso concedido para ${targetUsername} (NUBE).`);
          const sessionData = { id: Date.now(), username: u.username, role: u.role, name: u.name };
          localStorage.setItem('logistics_session', JSON.stringify(sessionData));
          return { success: true, user: sessionData };
      }
  }

  return { success: false, message: 'Usuario no reconocido o contraseña incorrecta' };
};

export const logout = () => {
  localStorage.removeItem('logistics_session');
  sessionStorage.removeItem('buffer_hist_date_from');
  sessionStorage.removeItem('buffer_hist_date_to');
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
