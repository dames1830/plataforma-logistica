import { getSession, logout } from './services/auth.js?v=11.2.6';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.idleTimer = null;
    this.IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutos en milisegundos
    this.init();
  }

  init() {
    this.navigate();
    this.setupInactivityTracker();
  }

  setupInactivityTracker() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const resetTimer = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      
      const user = getSession();
      if (user) {
        this.idleTimer = setTimeout(() => {
          console.warn("[PULSE] Sesión cerrada por inactividad (5 min)");
          alert("Tu sesión ha expirado por inactividad. Serás redirigido al inicio.");
          this.handleInactivityLogout();
        }, this.IDLE_TIMEOUT);
      }
    };

    events.forEach(name => {
      window.addEventListener(name, resetTimer, true);
    });

    // Iniciar el contador si ya hay sesión al cargar
    resetTimer();
  }

  handleInactivityLogout() {
    logout();
    this.navigate();
  }

  async navigate() {
    const user = getSession();
    const versionStr = "v11.2.6-dev [BETA]";
    this.root.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:white;">⚡ Sincronizando Pulse ${versionStr}...</div>`;

    try {
        const timestamp = new Date().getTime();
        console.log(`[PULSE] App ${versionStr} navigate - ts: ${timestamp}`);
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v6.js?v=11.2.6_${timestamp}`);
            this.root.innerHTML = '';
            await renderDashboard(this.root, user, () => {
                logout();
                this.navigate();
            });
        } else {
            const { renderLogin } = await import(`./views/login.js?v=11.1.101_${timestamp}`);
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
