import { getSession, logout } from './services/auth.js?v=11.1.115';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.init();
  }

  init() {
    this.navigate();
  }

  async navigate() {
    const user = getSession();
    this.root.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; color:white;">⚡ Sincronizando Pulse v11.1.115 (Beta / Cache Force)...</div>';

    try {
        const timestamp = new Date().getTime();
        console.log(`[PULSE] Beta App v11.1.115 navigate - ts: ${timestamp}`);
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v6.js?v=11.1.115_${timestamp}`);
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
        console.error("Critical Load Error v11.1.115:", err);
        this.root.innerHTML = `<div style="color:red; padding:2rem;">Fallo al cargar versión 11.1.115 Beta. Error: ${err.message}</div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App('app');
});
