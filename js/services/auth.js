const USERS = [
  { id: 1, username: 'admin', password: '123', role: 'admin', name: 'Administrador' },
  { id: 2, username: 'inventario', password: '123', role: 'inventario', name: 'Encargado Inventario' },
  { id: 3, username: 'picking', password: '123', role: 'picking', name: 'Picker 1' },
  { id: 4, username: 'packing', password: '123', role: 'packing', name: 'Empacador Principal' },
  { id: 5, username: 'despacho', password: '123', role: 'despacho', name: 'Logística Despacho' },
  { id: 6, username: 'recepcion', password: '123', role: 'recepcion', name: 'Recepcionista Bodega' },
  { id: 7, username: 'almacenaje', password: '123', role: 'almacenaje', name: 'Almacenista' },
  { id: 8, username: 'buffer', password: '123', role: 'buffer', name: 'Gestor de Buffer' }
];

export const login = async (username, password) => {
  await new Promise(resolve => setTimeout(resolve, 800));

  const user = USERS.find(u => u.username === username && u.password === password);
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
