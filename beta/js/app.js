import { getSession, logout } from './services/auth.js?v=13.1.2';
import * as adminService from './services/adminService.js?v=13.1.2';

const VERSION = '13.0.7';
const CACHE_KEY = `logistics_v13_0_7_prod_final_perms_`;

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.isRendered = false;
    
    // [PARCHE DE IDENTIDAD] Corregir nombre de sesión antiguo automáticamente
    const session = localStorage.getItem('logistics_session');
    if (session) {
        try {
            const user = JSON.parse(session);
            if (user.name === 'Gerente Logística (Dames)') {
                user.name = 'Daniel Ames';
                localStorage.setItem('logistics_session', JSON.stringify(user));
                console.log("✅ [IDENTIDAD] Nombre de usuario actualizado a Daniel Ames.");
            }
        } catch(e) {}
    }
    this.IDLE_TIMEOUT = 20 * 60 * 1000; // 20 minutos
    this.init();
  }

  init() {
    this.navigate();
    this.setupInactivityTracker();
  }

  setupInactivityTracker() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateLastActivity = () => {
      if (getSession()) {
        localStorage.setItem('pulse_last_activity', Date.now().toString());
      }
    };

    const checkInactivity = () => {
      const user = getSession();
      if (!user) return;

      const lastActivity = parseInt(localStorage.getItem('pulse_last_activity') || '0');
      const now = Date.now();

      if (lastActivity > 0 && (now - lastActivity) > this.IDLE_TIMEOUT) {
        console.warn("[PULSE] Sesión expirada por inactividad detectada.");
        alert("Tu sesión ha expirado (20 min de inactividad).");
        this.handleInactivityLogout();
      }
    };

    events.forEach(name => {
      window.addEventListener(name, () => {
        updateLastActivity();
        checkInactivity();
      }, true);
    });

    setInterval(checkInactivity, 30000); // Chequeo cada 30 segundos en background
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkInactivity();
    });

    updateLastActivity();
    checkInactivity();
  }

  handleInactivityLogout() {
    logout();
    this.navigate();
  }

  async navigate() {
    const user = getSession();
    const versionStr = "13.7.0-BETA";
    
    // [SEGURIDAD] Reiniciar contador de inactividad al navegar/entrar
    if (user) {
      localStorage.setItem('pulse_last_activity', Date.now().toString());
    }
    
    this.root.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:white;">⚡ Sincronizando Sistema v${versionStr}...</div>`;

    try {
        // [MODO EMERGENCIA] Timeout de seguridad: Si en 2 seg no arranca, forzamos
        const forceLoad = setTimeout(() => {
            console.warn("⚠️ Bypass de emergencia activado.");
            this.render(user, versionStr);
        }, 2500);

        // [IMPORTANTE] No esperamos a la nube para arrancar. Sincronización en background.
        adminService.initializeAdminData().then(() => {
            clearTimeout(forceLoad);
            this.render(user, versionStr);
        });
    } catch (err) {
        console.error(`Critical Load Error ${versionStr}:`, err);
        this.root.innerHTML = `<div style="color:red; padding:2rem;">Fallo crítico v${versionStr}. Error: ${err.message}</div>`;
    }
  }

  async render(user, versionStr) {
    if (this.isRendered) return;
    this.isRendered = true;
    const timestamp = new Date().getTime();
    this.root.innerHTML = '';
    if (user) {
        const { renderDashboard } = await import(`./views/dashboard_v6.js?v=${versionStr}_${timestamp}`);
        await renderDashboard(this.root, user, () => {
            logout();
            this.isRendered = false;
            this.navigate();
        });
    } else {
        const { renderLogin } = await import(`./views/login.js?v=${versionStr}_${timestamp}`);
        renderLogin(this.root, () => {
            this.isRendered = false;
            this.navigate();
        });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App('app');
});
