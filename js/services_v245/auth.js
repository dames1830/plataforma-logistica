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
const VERSION = '29.0080';

/**
 * [SEGURIDAD v26.5.572] La validación la hace EL SERVIDOR.
 *
 * Antes este archivo se descargaba la lista completa de usuarios CON sus
 * contraseñas y las comparaba aquí — cualquiera podía leerlas abriendo el
 * archivo o llamando a la API. Además tenía una clave maestra escrita a mano.
 *
 * Ahora solo se mandan usuario y contraseña al servidor, que responde sí o no.
 * Las contraseñas nunca llegan al navegador.
 */
export const login = async (username, password) => {
  const targetUsername = (username || '').trim().toLowerCase();
  console.log(`[AUTH] Intento de login: ${targetUsername}`);

  if (!targetUsername || !password) {
      return { success: false, message: 'Escribe tu usuario y tu contraseña' };
  }

  let respuesta;
  try {
      const res = await fetch(`${AUTH_API}/auth/login`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ username: targetUsername, password })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      respuesta = await res.json();
  } catch (err) {
      console.warn('[AUTH] Error de conexión durante el login:', err);
      return { success: false, message: 'Error de conexión. Se requiere internet para iniciar sesión.' };
  }

  if (!respuesta || !respuesta.success) {
      return { success: false, message: (respuesta && respuesta.message) || 'Usuario o contraseña incorrectos' };
  }

  const u = respuesta.user || {};
  const sessionData = { id: u.id, username: u.username, role: u.role, name: u.name };
  localStorage.setItem('logistics_session', JSON.stringify(sessionData));
  console.log(`[AUTH] Acceso concedido para ${sessionData.username}.`);

  // La lista de usuarios (ya SIN contraseñas) se guarda solo para poder revocar
  // sesiones de usuarios desactivados. Si falla, el login igual es válido.
  try {
      const lista = await fetch(`${AUTH_API}/logistics/users?z=${Date.now()}`, {
          cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }
      });
      if (lista.ok) {
          const result = await lista.json();
          const serverList = Array.isArray(result) ? result
                           : (result && Array.isArray(result.data)) ? result.data : [];
          if (serverList.length) {
              localStorage.setItem('logistics_admin_v11_users', JSON.stringify(serverList));
          }
      }
  } catch (err) {
      console.warn('[AUTH] No se pudo refrescar la lista de usuarios:', err);
  }

  return { success: true, user: sessionData };
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
