import { renderLogin } from './views/login.js?v=7.7';
import { renderDashboard } from './views/dashboard_v6.js?v=7.7';
import { getSession } from './services/auth.js?v=7.7';

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
    this.root.innerHTML = ''; // Clear current view

    if (user) {
      await renderDashboard(this.root, user, () => this.navigate());
    } else {
      renderLogin(this.root, () => this.navigate());
    }
  }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App('app');
});
