/**
 * App Entry Point v24.5.8 - SECURE SYNC
 */
import { getSession, logout } from './services_v245/auth.js?v=24.7.8';
import * as adminService from './services_v245/adminService.js?v=25.1.9';

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.APP_VERSION = 'v25.1.11';
    
    // --- LIMPIEZA DE CACHÉ FORZADA v25.1.11 ---
    const lastVer = localStorage.getItem('PULSE_INSTALLED_VERSION');
    if (lastVer !== this.APP_VERSION) {
        console.warn("🧹 [PULSE] Detectada versión nueva. Limpiando caché de scripts...");
        localStorage.setItem('PULSE_INSTALLED_VERSION', this.APP_VERSION);
    }
    this.isRendered = false;
    this.init();
  }

  async init() {
    try {
        if (this.root) {
            this.root.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; color:white; font-family:sans-serif; background:#0f172a;">
                <div class="spinner" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:#4f46e5; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:20px;"></div>
                <h2 style="margin:0; font-weight:300; letter-spacing:2px;">LOGÍSTICA <span style="font-weight:800; color:#4f46e5;">DEAM1830</span></h2>
                <p style="margin-top:10px; font-size:0.8rem; opacity:0.5;">Iniciando motor ${this.APP_VERSION}...</p>
            </div>`;
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
