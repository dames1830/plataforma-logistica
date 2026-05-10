import { login } from '../services/auth.js?v=12.6.0';

export const renderLogin = (container, onLoginSuccess) => {
  container.className = 'login-container';
  
  container.innerHTML = `
    <div class="login-box glass-panel animate-fade-in" style="background:rgba(30, 41, 59, 0.98) !important; border:1px solid var(--primary); box-shadow: 0 0 40px rgba(0,0,0,0.5); pointer-events: auto !important;">
      <div class="login-header">
        <h1>DEAM1830 <span style="font-size:16px; opacity:0.5; vertical-align:middle; margin-left:8px;">v13.0.2</span></h1>
        <p>Inicia sesión para acceder a tu área</p>
      </div>
      <form id="loginForm" style="pointer-events: auto !important;">
        <div class="input-group" style="pointer-events: auto !important;">
          <label for="username">Usuario</label>
          <input type="text" id="username" placeholder="Ingresa tu usuario" required autocomplete="off" style="pointer-events: auto !important; position:relative; z-index:1000; background:#0f172a !important; color:#fff !important;">
        </div>
        <div class="input-group" style="pointer-events: auto !important;">
          <label for="password">Contraseña</label>
          <input type="password" id="password" placeholder="Ingresa tu contraseña" required style="pointer-events: auto !important; position:relative; z-index:1000; background:#0f172a !important; color:#fff !important;">
        </div>
        <div id="loginError" class="error-message"></div>
        <button type="submit" class="btn" style="margin-top: 1rem; position:relative; z-index:1000;" id="loginBtn">Ingresar al Sistema</button>
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
