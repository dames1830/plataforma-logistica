import { login as authLogin } from '../services_v245/auth.js?v=29.0548';

export const renderLogin = (container, onLoginSuccess) => {
  /* Si venimos de una sesion vieja invalidada por falta de token, se avisa por que
     hay que entrar de nuevo -si no, parece que el sistema echo al usuario sin razon-. */
  let _porToken = false;
  try { _porToken = sessionStorage.getItem('deam_relogin_por_token') === '1';
        sessionStorage.removeItem('deam_relogin_por_token'); } catch (e) {}
  // Establecer clase para el diseño degradado premium claro (inspirado en la referencia)
  container.className = 'login-view-wrapper';
  
  container.innerHTML = `
    <!-- Bloque de Login Principal -->
    <div id="loginCard" class="login-box-premium animate-fade-in">
      
      <!-- SVG Vectorial de los 3 Avatares Superpuestos con Recorte 3D (Máxima Nitidez) -->
      <div style="display: flex; justify-content: center; margin-bottom: 2.25rem;">
        <svg viewBox="0 0 120 100" class="login-avatar-svg" style="width: 120px; height: 100px; color: var(--sky-deep); fill: currentColor;">
          <!-- Avatar Izquierda -->
          <circle cx="32" cy="48" r="14" />
          <path d="M8,80 C8,66 20,60 32,60 C44,60 56,66 56,80 Z" />
          
          <!-- Avatar Derecha -->
          <circle cx="88" cy="48" r="14" />
          <path d="M64,80 C64,66 76,60 88,60 C100,60 112,66 112,80 Z" />
          
          <!-- Avatar Centro (Con contorno para lograr el efecto 3D exacto de la referencia) -->
          <circle cx="60" cy="36" r="18" stroke="var(--avatar-stroke, var(--text-strong))" stroke-width="4" stroke-linejoin="round" />
          <path d="M28,80 C28,62 42,56 60,56 C78,56 92,62 92,80 Z" stroke="var(--avatar-stroke, var(--text-strong))" stroke-width="4" stroke-linejoin="round" />
        </svg>
      </div>

      <div id="aviso_relogin" style="display:none; margin:0 0 14px; padding:9px 13px; border-radius:9px;
                  background:rgba(var(--warning-soft-rgb), 0.14); border:1px solid rgba(var(--warning-soft-rgb), 0.4);
                  color:var(--warning-soft); font-size:var(--t-sm); font-weight:700; text-align:center;">
        Por seguridad, vuelve a ingresar. Es solo esta vez.
      </div>

      <form id="loginForm" style="display: flex; flex-direction: column;">
        
        <!-- Campo Usuario Tipo Píldora -->
        <div class="pill-input-group">
          <div class="pill-input-wrapper">
            <span class="pill-input-icon">👤</span>
            <span class="pill-input-separator"></span>
            <input type="text" id="username" placeholder="USUARIO" required autocomplete="off">
          </div>
        </div>

        <!-- Campo Contraseña Tipo Píldora -->
        <div class="pill-input-group">
          <div class="pill-input-wrapper">
            <span class="pill-input-icon">🔑</span>
            <span class="pill-input-separator"></span>
            <input type="password" id="password" placeholder="CONTRASEÑA" required>
          </div>
        </div>
        
        <!-- Acciones: Recordar y Olvidaste -->
        <div class="login-extra-actions">
          <label class="remember-me-label" for="rememberMe">
            <input type="checkbox" id="rememberMe" class="remember-me-checkbox" checked>
            Recordarme
          </label>
          <a href="#" class="forgot-password-link" id="forgotPass">¿Olvidaste tu contraseña?</a>
        </div>
        
        <div id="loginError" class="error-message"></div>
        
        <!-- Botón Píldora de Envío -->
        <button type="submit" class="btn-pill" id="loginBtn">LOGIN</button>
      
      </form>
      <div style="text-align: center; margin-top: 1.5rem; font-size:var(--t-xs); color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em;">
        SYSTEM BUILD: v29.0548 | SECURE SYNC
      </div>
    </div>
  `;

  const form = document.getElementById('loginForm');
  if (_porToken) {
    const av = document.getElementById('aviso_relogin');
    if (av) av.style.display = 'block';
  }
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const forgotLink = document.getElementById('forgotPass');

  // Funcionalidad de Olvidó Contraseña
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert("🔑 Por seguridad de la plataforma, solicita la restauración o cambio de tu contraseña directamente con el Administrador de Sistemas (Daniel Ames).");
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'VERIFICANDO...';

    const userVal = document.getElementById('username').value.trim();
    const passVal = document.getElementById('password').value;

    const result = await authLogin(userVal, passVal);

    if (result.success) {
      btn.innerHTML = '¡ACCESO CONCEDIDO! 🚀';
      btn.style.background = 'linear-gradient(135deg, var(--success), var(--success-deep))';
      btn.style.boxShadow = '0 4px 15px rgba(var(--success-rgb), 0.4)';
      
      // Animación premium y desvanecimiento de salida conjunta
      setTimeout(() => {
        container.classList.add('fade-out');
        document.getElementById('loginCard').classList.add('fade-out-up');
        
        // Cargar el Dashboard / Entorno
        setTimeout(() => {
          onLoginSuccess();
        }, 400);
      }, 500);
    } else {
      errorDiv.textContent = result.message;
      btn.disabled = false;
      btn.textContent = 'LOGIN';
    }
  });
};
