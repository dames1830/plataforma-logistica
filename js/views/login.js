import { login as authLogin } from '../services_v245/auth.js?v=25.1.96';

export const renderLogin = (container, onLoginSuccess) => {
  container.className = 'login-container';
  
  container.innerHTML = `
    <div class="login-wrapper" style="width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; position: relative;">
      
      <!-- Bloque de Login Principal -->
      <div id="loginCard" class="login-box glass-panel animate-fade-in" style="background: rgba(15, 23, 42, 0.7) !important; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8); padding: 3.5rem 3rem; border-radius: 24px; backdrop-filter: blur(24px); width: 100%; max-width: 460px; pointer-events: auto !important; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); position: relative; z-index: 10;">
        
        <div class="login-header" style="text-align: center; margin-bottom: 2.5rem;">
          <h1 style="font-size: 2.4rem; font-weight: 900; margin-bottom: 0.5rem; letter-spacing: -1px; display: flex; align-items: center; justify-content: center; gap: 12px; color: #fff;">
            DEAM<span style="color: var(--primary);">1830</span> 
            <span style="font-size: 0.85rem; font-weight: 700; background: rgba(79,70,229,0.2); color: #818cf8; padding: 4px 12px; border-radius: 20px; vertical-align: middle; letter-spacing: 0;">v25.1.96</span>
          </h1>
          <p style="color: #94a3b8; font-size: 1.1rem; letter-spacing: 0.5px; font-weight: 500;">Centro de Control Operativo</p>
        </div>

        <form id="loginForm" style="pointer-events: auto !important; display: flex; flex-direction: column; gap: 1.75rem;">
          
          <div class="input-group" style="margin: 0; pointer-events: auto !important;">
            <label for="username" style="font-size: 0.95rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.6rem; display: block;">Usuario</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 1.1rem;">👤</span>
              <input type="text" id="username" placeholder="Ingresa tu usuario" required autocomplete="off" style="pointer-events: auto !important; position:relative; z-index:1000; background: rgba(0,0,0,0.25) !important; color: #fff !important; padding: 1.1rem 1.25rem 1.1rem 3.5rem; font-size: 1.15rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); width: 100%; transition: all 0.3s ease; outline: none;">
            </div>
          </div>

          <div class="input-group" style="margin: 0; pointer-events: auto !important;">
            <label for="password" style="font-size: 0.95rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.6rem; display: block;">Contraseña</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 1.1rem;">🔒</span>
              <input type="password" id="password" placeholder="Ingresa tu contraseña" required style="pointer-events: auto !important; position:relative; z-index:1000; background: rgba(0,0,0,0.25) !important; color: #fff !important; padding: 1.1rem 1.25rem 1.1rem 3.5rem; font-size: 1.15rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); width: 100%; transition: all 0.3s ease; outline: none;">
            </div>
          </div>
          
          <div id="loginError" class="error-message" style="font-size: 0.95rem; min-height: 1.4rem; text-align: center; margin-top: 0; color: #f87171; font-weight: 500;"></div>
          
          <button type="submit" class="btn" style="margin-top: 0.5rem; position:relative; z-index:1000; padding: 1.1rem; font-size: 1.15rem; font-weight: 700; letter-spacing: 1.5px; border-radius: 14px; background: linear-gradient(135deg, var(--primary), #6366f1); border: none; box-shadow: 0 4px 20px rgba(79,70,229,0.3); text-transform: uppercase; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #fff;" id="loginBtn">INGRESAR AL SISTEMA</button>
        
        </form>
      </div>
    </div>

    <style>
      #username:focus, #password:focus {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 4px rgba(79,70,229,0.15) !important;
        background: rgba(0,0,0,0.4) !important;
      }
      #loginBtn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(79,70,229,0.5);
        background: linear-gradient(135deg, #4338ca, #4f46e5);
      }
      #loginBtn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .fade-out-up {
        opacity: 0 !important;
        transform: translateY(-30px) scale(0.98) !important;
        pointer-events: none !important;
      }
    </style>
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

    const result = await authLogin(userVal, passVal);

    if (result.success) {
      btn.innerHTML = '¡ACCESO CONCEDIDO! <span style="font-size: 1.2rem; vertical-align: middle;">🚀</span>';
      btn.style.background = 'linear-gradient(135deg, var(--success), #16a34a)';
      btn.style.boxShadow = '0 4px 20px rgba(34,197,94,0.4)';
      
      // Añadir la animación suave de salida
      setTimeout(() => {
        document.getElementById('loginCard').classList.add('fade-out-up');
        // Redirigir al panel después de la animación (400ms)
        setTimeout(() => {
          onLoginSuccess();
        }, 400);
      }, 500);
    } else {
      errorDiv.textContent = result.message;
      btn.disabled = false;
      btn.textContent = 'INGRESAR AL SISTEMA';
    }
  });
};
