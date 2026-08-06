/**
 * App Entry Point v24.5.8 - SECURE SYNC
 */
import { getSession, logout } from './services_v245/auth.js?v=29.0088';
import * as adminService from './services_v245/adminService.js?v=29.0088';

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
      this.APP_VERSION = 'v29.0088';
    
    // Solo deja constancia de con qué versión se arrancó. La detección de una versión
    // nueva se hace contra el servidor —ver vigilarVersion()—, porque este número está
    // dentro de este mismo archivo: si el navegador lo tiene cacheado, compararlo contra
    // lo guardado es comparar la versión vieja contra sí misma.
    localStorage.setItem('PULSE_INSTALLED_VERSION', this.APP_VERSION);

    this.isRendered = false;

    // Timer de inactividad
    this.inactivityTimeout = null;
    this.ultimaActividad = Date.now();
    this.setupActivityListeners();
    this.startInactivityTimer();
    this.vigilarVersion();

    this.init();
  }

  setupActivityListeners() {
      const resetTimer = () => { this.ultimaActividad = Date.now(); this.startInactivityTimer(); };
      window.addEventListener('mousemove', resetTimer, { passive: true });
      window.addEventListener('keydown', resetTimer, { passive: true });
      window.addEventListener('click', resetTimer, { passive: true });
      window.addEventListener('scroll', resetTimer, { passive: true });
      window.addEventListener('touchstart', resetTimer, { passive: true });
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // DETECTOR DE VERSIÓN NUEVA
  //
  // Antes había un chequeo acá mismo que no podía funcionar: comparaba APP_VERSION
  // —que está escrita DENTRO de este archivo— contra lo guardado en localStorage. Si el
  // navegador tenía app.js cacheado leía la versión vieja y la comparaba contra la vieja,
  // así que jamás detectaba nada. Y aunque lo hubiera hecho, solo escribía en la consola:
  // no recargaba. El resultado era gente trabajando media tarde con código viejo sin
  // enterarse, viendo datos que en la máquina de al lado ya estaban.
  //
  // Ahora se le pregunta al SERVIDOR. El index.html se pide con 'no-store' para que el
  // navegador no pueda contestar de su caché, y de ahí sale el ?v= que está publicado de
  // verdad. No hace falta ningún archivo nuevo: bump.py ya deja ese número ahí.
  //
  // Los avisos van subiendo de tono, porque interrumpir a alguien a mitad de una carga es
  // peor que esperar cinco minutos:
  //     1º  se avisa y se puede postergar
  //     2º  a los 5 min, se avisa que el próximo es obligatorio
  //     3º  a los 10 min, cuenta regresiva de 20 s y se recarga
  //
  // Y si no hay nadie mirando —pestaña en segundo plano, o más de un minuto sin tocar
  // nada— no se muestra nada: se recarga y listo.
  // ════════════════════════════════════════════════════════════════════════════════

  /** La versión que está publicada en el servidor, o null si no se pudo saber. */
  async versionPublicada() {
      try {
          const res = await fetch(`./index.html?_chk=${Date.now()}`, { cache: 'no-store' });
          if (!res.ok) return null;
          const txt = await res.text();
          const m = txt.match(/\?v=(\d+(?:\.\d+)+)/);
          return m ? 'v' + m[1] : null;
      } catch (e) {
          return null;   // sin internet se sigue trabajando igual
      }
  }

  /** ¿Hay alguien mirando la pantalla en este momento? */
  estaAtendida() {
      if (document.hidden) return false;
      return (Date.now() - (this.ultimaActividad || 0)) < 60000;
  }

  vigilarVersion() {
      this.avisosVersion = 0;
      this.proximoAviso = 0;
      this.versionNueva = null;
      this.ultimaActividad = Date.now();

      const revisar = () => this.revisarVersion();
      // Cada dos minutos, y también al volver a la pestaña: si estuvo abierta toda la
      // mañana en segundo plano, conviene enterarse al primer vistazo y no dos minutos
      // después.
      setInterval(revisar, 120000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
      setTimeout(revisar, 30000);
  }

  async revisarVersion() {
      // UN AVISO QUE NADIE CONTESTA NO PUEDE QUEDAR AHÍ PARA SIEMPRE.
      //
      // El caso: alguien estaba trabajando, salta el aviso, y justo se va. El modal queda
      // abierto sin que nadie apriete nada. Antes eso dejaba la pestaña colgada con la
      // versión vieja para siempre —el único caso que este detector venía a resolver—,
      // porque mientras hubiera un modal a la vista la revisión no hacía nada más.
      //
      // Dos minutos sin tocar nada, o la pestaña en segundo plano, y se recarga igual. El
      // tercero no necesita esto: tiene su propia cuenta regresiva.
      if (document.getElementById('pulse-aviso-version')) {
          const abandonado = document.hidden || (Date.now() - (this.ultimaActividad || 0)) > 120000;
          if (abandonado) this.recargarPorVersion();
          return;
      }

      const publicada = this.versionNueva || await this.versionPublicada();
      if (!publicada || publicada === this.APP_VERSION) return;
      this.versionNueva = publicada;

      // SI PIDIÓ ESPERAR, SE ESPERA. Quien aprieta «Después» está a mitad de algo, y a mitad
      // de algo se está quieto —leyendo, mirando un papel, atendiendo el teléfono—. Con este
      // chequeo debajo del de actividad, un minuto sin mover el mouse alcanzaba para que se
      // recargara igual, que es justo lo que había pedido que no pasara.
      if (Date.now() < (this.proximoAviso || 0)) return;

      // A QUIEN YA SE LE AVISÓ, SE LE SIGUE AVISANDO.
      //
      // La recarga en silencio es para el que NO se enteró de nada: la pestaña olvidada en
      // segundo plano, la máquina que quedó prendida. Pero alguien que ya apretó «Después»
      // está presente y espera el aviso siguiente. Si en el momento en que vence el plazo
      // llevaba un minuto sin mover el mouse, se le recargaba encima sin mostrarle nada, y
      // el segundo y el tercer aviso no aparecían nunca. Se le prometió una escalera de
      // tres, y se la salteaba entera.
      if ((this.avisosVersion || 0) > 0) {
          this.avisosVersion += 1;
          this.mostrarAvisoVersion(Math.min(this.avisosVersion, 3), publicada);
          return;
      }

      // Nadie mirando, o todavía sin entrar: se recarga sin molestar a nadie.
      if (!this.estaAtendida() || !getSession()) { this.recargarPorVersion(); return; }

      this.avisosVersion = 1;
      this.mostrarAvisoVersion(1, publicada);
  }

  /** Recarga pidiendo el index de nuevo, no el que el navegador tenga guardado. */
  recargarPorVersion() {
      try {
          const u = new URL(window.location.href);
          u.searchParams.set('_v', String(Date.now()));
          window.location.replace(u.toString());
      } catch (e) {
          window.location.reload();
      }
  }

  mostrarAvisoVersion(paso, publicada) {
      const ESTILOS = {
          1: { borde: 'rgba(79,70,229,.5)',  chipBg: 'rgba(79,70,229,.16)',  chipCol: '#a5b4fc', chipBor: 'rgba(129,140,248,.4)',
               icoBg: 'rgba(79,70,229,.15)', icoBor: 'rgba(129,140,248,.45)', ico: '⟳',
               chip: 'PRIMER AVISO', titulo: 'Hay una versión nueva',
               texto: 'Estás viendo una versión anterior de la plataforma. Actualiza para trabajar con los últimos cambios.',
               pie: 'Si estás a mitad de algo, presiona «Después».' },
          2: { borde: 'rgba(251,191,36,.55)', chipBg: 'rgba(251,191,36,.14)', chipCol: '#fbbf24', chipBor: 'rgba(251,191,36,.4)',
               icoBg: 'rgba(251,191,36,.12)', icoBor: 'rgba(251,191,36,.45)', ico: '⚠',
               chip: 'SEGUNDO AVISO', titulo: 'Sigues con la versión anterior',
               texto: 'En el <b style="color:#fbbf24;">próximo aviso la actualización será obligatoria</b>. Conviene actualizar ahora.',
               pie: 'Última vez que se puede postergar.' },
          3: { borde: 'rgba(239,68,68,.6)',  chipBg: 'rgba(239,68,68,.14)',  chipCol: '#fca5a5', chipBor: 'rgba(239,68,68,.45)',
               icoBg: 'rgba(239,68,68,.12)', icoBor: 'rgba(239,68,68,.5)',  ico: '⟳',
               chip: 'ACTUALIZACIÓN OBLIGATORIA', titulo: 'Actualizando la plataforma',
               texto: 'Guarda lo que estés haciendo. La página se va a recargar sola.',
               pie: 'Ya no se puede postergar.' }
      };
      const e = ESTILOS[paso] || ESTILOS[1];
      const obligatorio = paso >= 3;

      const capa = document.createElement('div');
      capa.id = 'pulse-aviso-version';
      capa.style.cssText = 'position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(2,6,23,.72); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);';
      capa.innerHTML = `
        <div style="width:100%; max-width:400px; text-align:center; background:rgba(15,23,42,.98); border:1px solid ${e.borde}; border-radius:16px; padding:28px 26px 22px; box-shadow:0 20px 60px rgba(0,0,0,.6); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <span style="display:inline-block; font-size:10px; font-weight:800; letter-spacing:.09em; padding:3px 10px; border-radius:12px; margin-bottom:12px; background:${e.chipBg}; color:${e.chipCol}; border:1px solid ${e.chipBor};">${e.chip}</span>
          <div style="width:44px; height:44px; margin:0 auto 14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; background:${e.icoBg}; border:1px solid ${e.icoBor}; color:${e.chipCol};">${e.ico}</div>
          <h3 style="color:#f8fafc; font-size:16.5px; font-weight:700; margin:0 0 8px;">${e.titulo}</h3>
          ${obligatorio ? `<div style="font-size:30px; font-weight:800; color:#fca5a5; margin:2px 0 12px; font-variant-numeric:tabular-nums;"><span id="pulse-cuenta">20</span> <span style="font-size:14px; color:#94a3b8; font-weight:600;">segundos</span></div>` : ''}
          <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0 0 14px;">${e.texto}</p>
          <div style="display:inline-flex; align-items:center; gap:9px; margin-bottom:20px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:20px; padding:5px 14px; font-size:12px; color:#64748b;">
            ${this.APP_VERSION} &nbsp;→&nbsp; <b style="color:#a5b4fc;">${publicada}</b>
          </div>
          <div style="display:flex; gap:10px;">
            ${obligatorio ? '' : '<button id="pulse-despues" style="flex:1; background:transparent; border:1px solid rgba(255,255,255,.18); color:#94a3b8; padding:11px; border-radius:9px; font-size:13.5px; font-weight:600; cursor:pointer;">Después</button>'}
            <button id="pulse-ahora" style="flex:1; background:${obligatorio ? '#dc2626' : '#4f46e5'}; border:1px solid ${obligatorio ? '#dc2626' : '#4f46e5'}; color:#fff; padding:11px; border-radius:9px; font-size:13.5px; font-weight:700; cursor:pointer;">Actualizar ahora</button>
          </div>
          <div style="margin-top:13px; font-size:11.5px; color:#64748b;">${e.pie}</div>
        </div>`;
      document.body.appendChild(capa);

      capa.querySelector('#pulse-ahora').addEventListener('click', () => this.recargarPorVersion());

      const btnDespues = capa.querySelector('#pulse-despues');
      if (btnDespues) btnDespues.addEventListener('click', () => {
          capa.remove();
          this.proximoAviso = Date.now() + 300000;   // vuelve a los 5 minutos
      });

      if (obligatorio) {
          let quedan = 20;
          const reloj = setInterval(() => {
              quedan--;
              const n = document.getElementById('pulse-cuenta');
              if (!n) { clearInterval(reloj); return; }
              n.textContent = String(Math.max(0, quedan));
              if (quedan <= 0) { clearInterval(reloj); this.recargarPorVersion(); }
          }, 1000);
      }
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
    // Cuanto antes arranque, mejor: si se dejara para cuando aparece el login, recién
    // empezaría después de toda la sincronización con la nube, y se perdería la mitad del
    // tiempo que la persona tarda en escribir. Va también cuando hay sesión guardada, porque
    // en ese caso el dashboard se importa igual apenas termina de sincronizar.
    this.adelantarDashboard();
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
                    INICIANDO ENTORNO ${this.APP_VERSION}...
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

  /**
   * Le pide al navegador que vaya bajando y compilando el dashboard MIENTRAS la persona
   * escribe su usuario y su contraseña.
   *
   * Son ~1,4 MB y unas 22.000 líneas: cerca de medio segundo en bajar y otro medio en
   * compilar. Esto no acorta ese tiempo, lo corre a un momento en el que nadie está mirando
   * la pantalla en blanco. Cuando se aprieta ENTRAR, el archivo ya está listo.
   *
   * No ejecuta nada: 'modulepreload' descarga y compila, pero el módulo recién corre cuando
   * lo importa render(). Y la URL se arma con la MISMA constante que usa el import de abajo:
   * si la versión no coincidiera al carácter, el navegador lo trataría como otro archivo y
   * lo bajaría dos veces, que es peor que no precargar nada.
   */
  adelantarDashboard() {
    try {
      const href = `./views/dashboard_v28.js?v=${this.APP_VERSION}`;
      if (document.head.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = href;
      document.head.appendChild(link);
    } catch (e) { /* si el navegador no lo soporta, todo sigue igual que antes */ }
  }

  async render(user) {
    if (this.isRendered) return;
    this.isRendered = true;
    
    try {
        if (user) {
            const { renderDashboard } = await import(`./views/dashboard_v28.js?v=${this.APP_VERSION}`);
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

