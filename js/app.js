/**
 * App Entry Point v24.5.8 - SECURE SYNC
 */
import { getSession, logout } from './services_v245/auth.js?v=25.1.96';
import * as adminService from './services_v245/adminService.js?v=25.1.96';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.APP_VERSION = 'v25.1.96';
    
    // --- LIMPIEZA DE CACHÉ FORZADA v25.1.13 ---
    const lastVer = localStorage.getItem('PULSE_INSTALLED_VERSION');
    if (lastVer !== this.APP_VERSION) {
        console.warn("🧹 [PULSE] Detectada versión nueva. Limpiando caché de scripts...");
        localStorage.setItem('PULSE_INSTALLED_VERSION', this.APP_VERSION);
    }
    this.isRendered = false;
    
    // Timer de inactividad
    this.inactivityTimeout = null;
    this.setupActivityListeners();
    this.startInactivityTimer();

    this.init();
  }

  setupActivityListeners() {
      const resetTimer = () => this.startInactivityTimer();
      window.addEventListener('mousemove', resetTimer, { passive: true });
      window.addEventListener('keydown', resetTimer, { passive: true });
      window.addEventListener('click', resetTimer, { passive: true });
      window.addEventListener('scroll', resetTimer, { passive: true });
      window.addEventListener('touchstart', resetTimer, { passive: true });
  }

  startInactivityTimer() {
      if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
      // 20 minutos = 20 * 60 * 1000 = 1200000 ms
      this.inactivityTimeout = setTimeout(() => {
          if (getSession()) {
              console.warn("⏳ [PULSE] Sesión expirada por inactividad (20 min).");
              logout();
              window.location.reload();
          }
      }, 1200000);
  }

  async init() {
    try {
        if (this.root) {
            // [CRÍTICO] Limpiar clases heredadas para evitar bugs de desbordamiento de scroll y franjas horizontales
            this.root.className = 'app-loading-layout';
            this.root.innerHTML = `
            <div style="text-align: center; max-width: 420px; width: 90%; display: flex; flex-direction: column; align-items: center;">
                <h2 style="margin:0; font-weight: 300; letter-spacing: 4px; font-size: 1.8rem; color: #fff; text-shadow: 0 0 20px rgba(255,255,255,0.1);">
                    LOGÍSTICA <span style="font-weight: 900; background: linear-gradient(to right, #0ea5e9, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DEAM1830</span>
                </h2>
                <div class="premium-progress-bar">
                    <div class="premium-progress-fill"></div>
                </div>
                <p style="margin-top: 1.5rem; font-size: 0.85rem; opacity: 0.6; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; color: #94a3b8; animation: pulseLoadingText 1.5s infinite alternate;">
                    Iniciando entorno v${this.APP_VERSION}...
                </p>
            </div>
            <style>
              @keyframes pulseLoadingText {
                0% { opacity: 0.4; }
                100% { opacity: 0.8; }
              }
            </style>`;
        }
        
        // 1. Sincronización proactiva con la nube
        await adminService.initializeAdminData().catch(e => console.warn("Sync error:", e));
        
        const user = getSession();
        this.render(user);

    } catch (err) {
        console.error("[BOOT] Error Crítico:", err);
    }
  }

  async render(user) {
    if (this.isRendered) return;
    this.isRendered = true;
    
    try {
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v24.js?v=${this.APP_VERSION}`);
            this.root.innerHTML = '';
            await renderDashboard(this.root, user, () => {
                this.isRendered = false;
                logout();
                this.init();
            });
        } else {
            const { renderLogin } = await import(`./views/login.js?v=${this.APP_VERSION}`);
            this.root.innerHTML = '';
            renderLogin(this.root, () => {
                this.isRendered = false;
                this.init();
            });
        }
    } catch (err) {
        console.error("[RENDER] Error:", err);
        this.isRendered = false;
    }
  }
}

// Inicialización
new App('app');
