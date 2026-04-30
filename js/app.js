import { getSession, logout } from './services/auth.js?v=11.6.1';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
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
        alert("Tu sesión ha expirado (5 min de inactividad).");
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
    const versionStr = "v12.1.24";
    
    // [SEGURIDAD] Reiniciar contador de inactividad al navegar/entrar
    if (user) {
      localStorage.setItem('pulse_last_activity', Date.now().toString());
    }
    
    this.root.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:white;">⚡ Sincronizando Pulse ${versionStr}...</div>`;

    try {
        const timestamp = new Date().getTime();
        console.log(`[PULSE] App ${versionStr} navigate - ts: ${timestamp}`);
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v6.js?v=${versionStr}_${timestamp}`);
            this.root.innerHTML = '';
            await renderDashboard(this.root, user, () => {
                logout();
                this.navigate();
            });
        } else {
            const { renderLogin } = await import(`./views/login.js?v=${versionStr}_${timestamp}`);
            this.root.innerHTML = '';
            renderLogin(this.root, () => this.navigate());
        }
    } catch (err) {
        console.error(`Critical Load Error ${versionStr}:`, err);
        this.root.innerHTML = `<div style="color:red; padding:2rem;">Fallo al cargar versión ${versionStr}. Error: ${err.message}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App('app');
});
