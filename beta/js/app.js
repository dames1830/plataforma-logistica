// ENGINE v17.1.3-REUNITED - SHARED CLOUD ENVIRONMENT
console.log("🚀 [PULSE] Reconnecting to Unified Cloud...");

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.version = '18.5.7-BETA';
    this.isRendered = false;
    console.log(`[PULSE] App initialized on #${rootId}`);
    this.init();
  }

  async init() {
    try {
        if (this.root) {
            this.root.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; color:white; font-family:sans-serif;">
                <div class="spinner" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:#4f46e5; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:20px;"></div>
                <h2 style="margin:0; font-weight:300; letter-spacing:2px;">LOGÍSTICA <span style="font-weight:800; color:#4f46e5;">DEAM1830</span></h2>
                <p style="margin-top:10px; font-size:0.8rem; opacity:0.5;">Iniciando motor blindado v${this.version}...</p>
            </div>`;
        }
        
        const { getSession, logout } = await import('./services/auth.js?v=' + this.version);
        const adminService = await import('./services/adminService.js?v=' + this.version);
        
        const user = getSession();
        adminService.initializeAdminData().catch(e => console.warn("Sync error:", e));
        this.render(user, getSession, logout);

    } catch (err) {
        console.error("[PULSE] Critical Boot Error:", err);
    }
  }

  async render(user, getSession, logout) {
    if (this.isRendered) return;
    this.isRendered = true;
    
    const timestamp = new Date().getTime();
    try {
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v6.js?v=${this.version}_${timestamp}`);
            this.root.innerHTML = '';
            await renderDashboard(this.root, user, () => {
                this.isRendered = false;
                logout();
                this.init();
            });
        } else {
            const { renderLogin } = await import(`./views/login.js?v=${this.version}_${timestamp}`);
            this.root.innerHTML = '';
            renderLogin(this.root, () => {
                this.isRendered = false;
                this.init();
            });
        }
    } catch (err) {
        console.error("[PULSE] Render Error:", err);
        this.isRendered = false;
    }
  }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App('app'));
} else {
    new App('app');
}
