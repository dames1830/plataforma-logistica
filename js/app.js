import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { getSession } from './services/auth.js';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.init();
  }

  init() {
    this.navigate();
  }

  navigate() {
    const user = getSession();
    this.root.innerHTML = ''; // Clear current view

    if (user) {
      renderDashboard(this.root, user, () => this.navigate());
    } else {
      renderLogin(this.root, () => this.navigate());
    }
  }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App('app');
});
