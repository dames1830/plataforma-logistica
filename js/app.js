
// ENGINE v14.4.0 - SAFE BOOT
console.log("🚀 [PULSE] Safe Engine Loading...");

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.version = "14.4.0";
    this.isRendered = false;
    console.log(`[PULSE] App initialized on #${rootId}`);
    this.init();
  }

  async init() {
    try {
        // Escribir mensaje inicial de inmediato
        if (this.root) {
            this.root.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; color:white; font-family:sans-serif;">
                <div class="spinner" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:#4f46e5; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:20px;"></div>
                <h2 style="margin:0; font-weight:300; letter-spacing:2px;">LOGÍSTICA <span style="font-weight:800; color:#4f46e5;">DEAM1830</span></h2>
                <p style="margin-top:10px; font-size:0.8rem; opacity:0.5;">Iniciando motor v${this.version}...</p>
            </div>`;
        }
        
        // Carga diferida de dependencias para evitar bloqueos
        const { getSession, logout } = await import('./services/auth.js?v=' + this.version);
        const adminService = await import('./services/adminService.js?v=' + this.version);
        
        const user = getSession();
        console.log("[PULSE] Session loaded:", user ? user.username : 'No user');

        // Sincronización en segundo plano (No bloquea el render)
        adminService.initializeAdminData().catch(e => console.warn("Sync error:", e));

        // Renderizado
        this.render(user, getSession, logout);

    } catch (err) {
        console.error("[PULSE] Critical Boot Error:", err);
        if (this.root) {
            this.root.innerHTML = `<div style="color:#ef4444; padding:2rem; background:#1e1e1e; border:1px solid #ef4444; margin:2rem; border-radius:10px; font-family:monospace;">
                <h2 style="margin-top:0;">🚨 ERROR DE ARRANQUE v${this.version}</h2>
                <p>El sistema no pudo iniciar los módulos básicos.</p>
                <div style="background:#000; padding:10px; border-radius:5px; margin-top:10px; font-size:0.8rem;">${err.message}</div>
                <button onclick="location.reload()" style="margin-top:15px; padding:8px 20px; cursor:pointer; background:#ef4444; border:none; color:white; border-radius:5px; font-weight:bold;">REINTENTAR</button>
            </div>`;
        }
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
        this.root.innerHTML = `<div style="color:white; padding:2rem;">Error al renderizar vista: ${err.message}</div>`;
    }
  }
}

// ARRANQUE FORZADO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App('app'));
} else {
    new App('app');
}
