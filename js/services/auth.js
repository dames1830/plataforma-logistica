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
        const sessionData = { id: result.user.id, username: result.user.username, role: result.user.role, name: result.user.name };
        localStorage.setItem('logistics_session', JSON.stringify(sessionData));
        return { success: true, user: sessionData };
      }
      // Si el servidor dice que las credenciales son inválidas, pero es el admin, permitimos fallback local
      if (username !== 'admin') {
        return { success: false, message: result.message || 'Credenciales inválidas' };
      }
    }
    // Si llegamos aquí, el servidor respondió con error (ej: 404 o 500)
    console.warn("Servidor respondió con error, intentando login local...");
  } catch (err) {
    console.warn("Error de conexión al servidor, intentando login local...");
  }

  // Fallback: login local solo para admin de emergencia
  const user = FALLBACK_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    const sessionData = { id: user.id, username: user.username, role: user.role, name: user.name };
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
