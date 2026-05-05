import { login } from '../services/auth.js';

export const renderLogin = (container, onLoginSuccess) => {
  container.className = 'login-container';
  
  container.innerHTML = `
    <div class="login-box glass-panel animate-fade-in" style="backdrop-filter:none !important; background:rgba(30, 41, 59, 0.95) !important;">
      <div class="login-header">
        <h1>DAMES1830 <span style="font-size:16px; opacity:0.5; vertical-align:middle; margin-left:8px;">v12.1.47-BETA</span></h1>
        <p>Inicia sesión para acceder a tu área</p>
      </div>
      <form id="loginForm">
        <div class="input-group">
          <label for="username">Usuario</label>
          <input type="text" id="username" placeholder="Ingresa tu usuario" required autofocus autocomplete="off" style="pointer-events: auto !important; position:relative; z-index:100;">
        </div>
        <div class="input-group">
          <label for="password">Contraseña</label>
          <input type="password" id="password" placeholder="Ingresa tu contraseña" required style="pointer-events: auto !important; position:relative; z-index:100;">
        </div>
        <div id="loginError" class="error-message"></div>
        <button type="submit" class="btn" style="margin-top: 1rem; position:relative; z-index:100;" id="loginBtn">Ingresar al Sistema</button>
      </form>
    </div>
  `;

  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    const userVal = document.getElementById('username').value.trim();
    const passVal = document.getElementById('password').value;

    const result = await login(userVal, passVal);

    if (result.success) {
      btn.textContent = 'Conectado!';
      btn.style.background = 'var(--success)';
      setTimeout(() => {
        onLoginSuccess();
      }, 500);
    } else {
      errorDiv.textContent = result.message;
      btn.disabled = false;
      btn.textContent = 'Ingresar al Sistema';
    }
  });
};
