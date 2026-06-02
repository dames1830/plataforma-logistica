/**
 * App Entry Point v24.5.8 - SECURE SYNC
 */
import { getSession, logout } from './services_v245/auth.js?v=26.5.98';
import * as adminService from './services_v245/adminService.js?v=26.5.98';

// --- SISTEMA GLOBAL DE ALERTAS PREMIUM GLASSMÓRFICAS ---
window.showPremiumAlert = (title, message, type = 'error') => {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        let accentColor = '#ef4444'; // Red
        let icon = '❌';
        let glowColor = 'rgba(239, 68, 68, 0.3)';
        
        if (type === 'success') {
            accentColor = '#10b981'; // Green
            icon = '✅';
            glowColor = 'rgba(16, 185, 129, 0.3)';
        } else if (type === 'warning') {
            accentColor = '#f59e0b'; // Amber
            icon = '⚠️';
            glowColor = 'rgba(245, 158, 11, 0.3)';
        } else if (type === 'info') {
            accentColor = '#3b82f6'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(59, 130, 246, 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${glowColor};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            ">
                <div style="
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.2rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: #fff;
                    font-size: 1.3rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-family: 'Outfit', sans-serif;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    font-weight: 500;
                    font-family: 'Inter', sans-serif;
                ">
                    ${message}
                </p>
                
                <button id="premium-alert-btn" style="
                    width: 100%;
                    padding: 0.8rem;
                    border: none;
                    border-radius: 12px;
                    background: linear-gradient(135deg, ${accentColor} 0%, #000 150%);
                    color: #fff;
                    font-size: 0.9rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px ${glowColor};
                    transition: all 0.2s ease;
                    font-family: 'Inter', sans-serif;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${glowColor}';" 
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${glowColor}';">
                    ACEPTAR
                </button>
            </div>
            <style>
                @keyframes pulse-icon {
                    0% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px ${accentColor}; }
                    100% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                }
            </style>
        `;
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(1)';
        }, 10);
        
        const closeAlert = () => {
            backdrop.style.opacity = '0';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(0.9)';
            setTimeout(() => {
                backdrop.remove();
                resolve();
            }, 250);
        };
        
        backdrop.querySelector('#premium-alert-btn').onclick = closeAlert;
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeAlert();
        };
    });
};

// --- SISTEMA GLOBAL DE CONFIRMACIONES PREMIUM GLASSMÓRFICAS ---
window.showPremiumConfirm = (title, message, type = 'warning') => {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        let accentColor = '#f59e0b'; // Amber
        let icon = '❓';
        let glowColor = 'rgba(245, 158, 11, 0.3)';
        
        if (type === 'danger') {
            accentColor = '#ef4444'; // Red
            icon = '🚨';
            glowColor = 'rgba(239, 68, 68, 0.3)';
        } else if (type === 'info') {
            accentColor = '#3b82f6'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(59, 130, 246, 0.3)';
        } else if (type === 'success') {
            accentColor = '#10b981'; // Green
            icon = '✅';
            glowColor = 'rgba(16, 185, 129, 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${glowColor};
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            ">
                <div style="
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 2.2rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon-confirm 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: #fff;
                    font-size: 1.3rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-family: 'Outfit', sans-serif;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    line-height: 1.6;
                    font-weight: 500;
                    font-family: 'Inter', sans-serif;
                ">
                    ${message}
                </p>
                
                <div style="
                    display: flex;
                    gap: 1rem;
                    width: 100%;
                ">
                    <button id="premium-confirm-cancel" style="
                        flex: 1;
                        padding: 0.8rem;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        border-radius: 12px;
                        background: rgba(255, 255, 255, 0.05);
                        color: #cbd5e1;
                        font-size: 0.9rem;
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-family: 'Inter', sans-serif;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.color='#fff';" 
                      onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.color='#cbd5e1';">
                        CANCELAR
                    </button>
                    
                    <button id="premium-confirm-ok" style="
                        flex: 1;
                        padding: 0.8rem;
                        border: none;
                        border-radius: 12px;
                        background: linear-gradient(135deg, ${accentColor} 0%, #000 150%);
                        color: #fff;
                        font-size: 0.9rem;
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px ${glowColor};
                        transition: all 0.2s ease;
                        font-family: 'Inter', sans-serif;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${glowColor}';" 
                      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${glowColor}';">
                        ACEPTAR
                    </button>
                </div>
            </div>
            <style>
                @keyframes pulse-icon-confirm {
                    0% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                    50% { transform: scale(1.05); box-shadow: 0 0 30px ${accentColor}; }
                    100% { transform: scale(1); box-shadow: 0 0 20px ${glowColor}; }
                }
            </style>
        `;
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(1)';
        }, 10);
        
        const resolveConfirm = (value) => {
            backdrop.style.opacity = '0';
            backdrop.querySelector('.glass-panel').style.transform = 'scale(0.9)';
            setTimeout(() => {
                backdrop.remove();
                resolve(value);
            }, 250);
        };
        
        backdrop.querySelector('#premium-confirm-ok').onclick = () => resolveConfirm(true);
        backdrop.querySelector('#premium-confirm-cancel').onclick = () => resolveConfirm(false);
        backdrop.onclick = (e) => {
            if (e.target === backdrop) resolveConfirm(false);
        };
    });
};

window.alert = function(message) {
    let type = 'warning';
    let title = 'ATENCIÓN';
    let cleanMessage = String(message || '');

    if (cleanMessage.includes('✅')) {
        type = 'success';
        title = '¡ÉXITO!';
        cleanMessage = cleanMessage.replace(/✅/g, '').trim();
    } else if (cleanMessage.includes('❌') || cleanMessage.includes('🚨') || cleanMessage.toLowerCase().includes('error')) {
        type = 'error';
        title = 'ERROR';
        cleanMessage = cleanMessage.replace(/[❌🚨]/g, '').trim();
    } else if (cleanMessage.includes('⚠️') || cleanMessage.includes('ðŸš§') || cleanMessage.includes('ðŸ—ï¸')) {
        type = 'warning';
        title = 'ADVERTENCIA';
        cleanMessage = cleanMessage.replace(/[⚠️ðŸš§ðŸ—ï¸]/g, '').trim();
    } else if (cleanMessage.includes('ðŸ“¦') || cleanMessage.includes('ðŸ“¡') || cleanMessage.includes('â˜ï¸') || cleanMessage.includes('ðŸ”’')) {
        type = 'info';
        title = 'INFORMACIÓN';
        cleanMessage = cleanMessage.replace(/[ðŸ“¦ðŸ“¡â˜ï¸ðŸ”’]/g, '').trim();
    }

    cleanMessage = cleanMessage.replace(/^[:!\s\-]+/, '');
    window.showPremiumAlert(title, cleanMessage, type);
};

class App {
  constructor(rootId) {
    this.root = document.getElementById(rootId);
    this.APP_VERSION = 'v26.5.98';
    
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
              console.warn("â³ [PULSE] Sesión expirada por inactividad (20 min).");
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
