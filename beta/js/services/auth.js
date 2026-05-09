// URL del servidor backend para autenticación
const AUTH_API = "https://logistics-backend-wv0x.onrender.com/api";

// Fallback local en caso de que el servidor esté caído
const FALLBACK_USERS = [
  { id: 1, username: 'dames', password: 'Bata1830', role: 'admin', name: 'Gerente Logística (Dames)' }
];export const login = async (username, password) => {
  // [ESTRATEGIA GOLD v12.5.16] Lógica Simplificada: Lo que tú creas, manda.
  const targetUsername = (username || '').toLowerCase();

  // 1. Acceso Maestro Directo (dames)
  if (targetUsername === 'dames' && password === 'Bata1830') {
      const sessionData = { id: 1, username: 'dames', role: 'admin', name: 'Gerente Logística (Dames)' };
      localStorage.setItem('logistics_session', JSON.stringify(sessionData));
      return { success: true, user: sessionData };
  }

  // 2. Validación contra lo que TÚ has creado en el módulo de Administración
  try {
      const localRaw = localStorage.getItem('logistics_admin_v11_users');
      const dynamicUsers = localRaw ? JSON.parse(localRaw) : [];

      if (Array.isArray(dynamicUsers)) {
          const dUser = dynamicUsers.find(u => u && (u.username || '').toLowerCase() === targetUsername);
          
          if (dUser) {
              if (dUser.active === false) return { success: false, message: 'Cuenta desactivada por administración.' };
              
              if (dUser.password === password) {
                  const sessionData = { 
                      id: Date.now(), 
                      username: dUser.username, 
                      role: dUser.role, 
                      name: dUser.name 
                  };
                  localStorage.setItem('logistics_session', JSON.stringify(sessionData));
                  return { success: true, user: sessionData };
              } else {
                  return { success: false, message: 'Contraseña incorrecta.' };
              }
          }
      }
  } catch (err) {
      console.error("Error leyendo lista local:", err);
  }

  return { success: false, message: 'Usuario no registrado o credenciales inválidas' };
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
