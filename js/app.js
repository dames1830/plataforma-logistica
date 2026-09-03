/**
 * App Entry Point v24.5.8 - SECURE SYNC
 */
import { getSession, logout } from './services_v245/auth.js?v=29.0583';
import * as adminService from './services_v245/adminService.js?v=29.0583';
import { observarTablas } from './services_v245/tablasOrdenables.js?v=29.0583';
import { aplicarTemaDeUsuario } from './services_v245/temaService.js?v=29.0583';
import { instalarSalidaConEsc } from './services_v245/salidas.js?v=29.0583';
import { registrar } from './services_v245/eventosService.js?v=29.0583';


/* ── LO QUE SE ROMPE, SE ANOTA ──────────────────────────────────────────────────
 *
 * Daniel, 28-ago-2026, con la Zona Buffer clavada en "CARGANDO MODULO": no habia forma
 * de saber que habia fallado sin abrir la consola del navegador, y el la usa para
 * trabajar, no para depurar. Un error que solo se ve apretando F12 es un error que nadie
 * ve.
 *
 * Ahora cae en Configuracion -> LOG con el mensaje y el archivo, igual que los avisos del
 * robot. Anotar no puede romper nada: `registrar` falla callado.
 *
 * NO SE REPITE. Un error dentro de un dibujado puede dispararse cientos de veces por
 * segundo; sin este freno, un solo problema llenaria la semana entera de anotaciones y
 * taparia todo lo demas. Se anota una vez por mensaje y como mucho 20 por sesion. */
const _yaAnotados = new Set();
const anotarFalla = (que, detalle) => {
    const clave = que + '|' + detalle;
    if (_yaAnotados.has(clave) || _yaAnotados.size >= 20) return;
    _yaAnotados.add(clave);
    try { registrar(que, String(detalle || '').slice(0, 300), 'error'); } catch (e) {}
};

window.addEventListener('error', (e) => {
    const d = (e && e.filename)
        ? `${e.message} — ${String(e.filename).split('/').pop()}:${e.lineno}`
        : (e && e.message) || 'sin detalle';
    anotarFalla('Se rompió la pantalla', d);
});

/* Una promesa que falla y nadie atrapa no dispara 'error': es el caso tipico de una
   pantalla que se queda cargando para siempre, que es justo lo que hay que cazar. */
window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    anotarFalla('Quedó algo a medias', (r && (r.message || r.name)) || String(r || '').slice(0, 200));
});


/**
 * LA PANTALLA DE CARGA
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Va en una capa aparte -no dentro de #app- a proposito. Antes ocupaba el mismo
 * sitio donde despues se dibuja la plataforma, asi que desaparecia en el instante
 * en que el dashboard escribia: la barra nunca llegaba al final porque la pantalla
 * ya no estaba. Siendo una capa encima, el dashboard se dibuja DEBAJO y la barra
 * puede terminar su recorrido antes de destaparlo.
 *
 * LA BARRA MARCA AVANCE DE VERDAD. Antes daba una vuelta infinita que crecia hasta
 * la mitad y se devolvia, y parecia trabada siempre en el mismo punto. Ahora cada
 * paso real del arranque -sincronizar con la nube, bajar el modulo, dibujar- sube
 * un techo, y entre paso y paso la barra se acerca a ese techo sin alcanzarlo. Asi
 * nunca retrocede, nunca se planta del todo, y el 100% coincide con que la
 * plataforma esta lista.
 */
const pantallaCarga = {
  valor: 0,
  techo: 0,
  timer: null,
  capa: null,

  mostrar(version) {
    if (this.capa) return;
    const capa = document.createElement('div');
    capa.id = 'bootScreen';
    capa.className = 'app-loading-layout';
    capa.innerHTML = `
      <div style="text-align:center; max-width:420px; width:90%; display:flex; flex-direction:column; align-items:center;">
        <img src="favicon.svg" alt="" class="boot-icono">
        <h2 style="margin:0; font-weight:300; letter-spacing:4px; font-size:var(--t-2xl); color:var(--text-strong);">
          LOGÍSTICA <span style="font-weight:900; background:linear-gradient(to right, var(--sky-deep), var(--primary-2)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;">DEAM1830</span>
        </h2>
        <div class="premium-progress-bar"><div class="premium-progress-fill"></div></div>
        <p style="margin-top:1.5rem; font-size:var(--t-md); opacity:0.6; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; color:var(--text-muted);">
          INICIANDO ENTORNO ${version}...
        </p>
      </div>`;
    document.body.appendChild(capa);
    this.capa = capa;
    this.hasta(12);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      // Se acerca al techo sin llegar: siempre se mueve, pero no promete de mas.
      if (this.valor < this.techo) {
        this.valor += Math.max(0.25, (this.techo - this.valor) * 0.07);
        this.pintar();
      }
    }, 110);
  },

  pintar() {
    const f = this.capa && this.capa.querySelector('.premium-progress-fill');
    if (f) f.style.width = Math.min(100, this.valor).toFixed(1) + '%';
  },

  /** Un paso del arranque termino: sube el techo hasta donde puede llegar ahora. */
  hasta(pct) {
    if (pct > this.techo) this.techo = pct;
    this.pintar();
  },

  /**
   * Todo listo. La barra completa el recorrido y RECIEN AHI se destapa la
   * plataforma: la pausa es corta pero suficiente para ver que llego al final,
   * que es lo que le faltaba.
   */
  async cerrar() {
    if (!this.capa) return;
    clearInterval(this.timer);
    this.valor = 100;
    this.techo = 100;
    this.pintar();
    await new Promise(r => setTimeout(r, 380));
    // Se quita de golpe, sin desvanecer. El desvanecido dejaba ver el login POR
    // DEBAJO mientras la capa todavia estaba encima, y como los dos tienen el
    // logo centrado en el mismo sitio se veia el titulo duplicado y en fantasma:
    // parecia que la pantalla se hubiera roto.
    if (this.capa && this.capa.parentNode) this.capa.parentNode.removeChild(this.capa);
    this.capa = null;
  }
};

// --- SISTEMA GLOBAL DE ALERTAS PREMIUM GLASSMÓRFICAS ---
window.showPremiumAlert = (title, message, type = 'error') => {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100vw';
        backdrop.style.height = '100vh';
        backdrop.style.backgroundColor = 'rgba(var(--bg-rgb), 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        let accentColor = 'var(--danger)'; // Red
        let icon = '❌';
        let glowColor = 'rgba(var(--danger-rgb), 0.3)';
        
        if (type === 'success') {
            accentColor = 'var(--success-alt)'; // Green
            icon = '✅';
            glowColor = 'rgba(var(--success-alt-rgb), 0.3)';
        } else if (type === 'warning') {
            accentColor = 'var(--warning)'; // Amber
            icon = '⚠️';
            glowColor = 'rgba(var(--warning-rgb), 0.3)';
        } else if (type === 'info') {
            accentColor = 'var(--blue)'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(var(--blue-rgb), 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(var(--card-rgb), 0.85) 0%, rgba(var(--bg-rgb), 0.95) 100%);
                border: 1px solid rgba(var(--ink-rgb), 0.08);
                box-shadow: 0 25px 50px -12px rgba(var(--shadow-rgb), 0.5), 0 0 40px ${glowColor};
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
                    background: rgba(var(--ink-rgb), 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size:var(--t-2xl);
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: var(--text-strong);
                    font-size:var(--t-xl);
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-family: 'Outfit', sans-serif;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: var(--text-muted);
                    font-size:var(--t-md);
                    line-height: 1.6;
                    font-weight: 500;
                    font-family: var(--font-ui);
                ">
                    ${message}
                </p>
                
                <button id="premium-alert-btn" style="
                    width: 100%;
                    padding: 0.8rem;
                    border: none;
                    border-radius: 12px;
                    background: linear-gradient(135deg, ${accentColor} 0%, var(--on-accent) 150%);
                    color: var(--text-strong);
                    font-size:var(--t-md);
                    font-weight: 700;
                    letter-spacing: 1px;
                    cursor: pointer;
                    box-shadow: 0 4px 12px ${glowColor};
                    transition: all 0.2s ease;
                    font-family: var(--font-ui);
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
        backdrop.style.backgroundColor = 'rgba(var(--bg-rgb), 0.75)';
        backdrop.style.backdropFilter = 'blur(12px)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '999999';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        
        let accentColor = 'var(--warning)'; // Amber
        let icon = '❓';
        let glowColor = 'rgba(var(--warning-rgb), 0.3)';
        
        if (type === 'danger') {
            accentColor = 'var(--danger)'; // Red
            icon = '🚨';
            glowColor = 'rgba(var(--danger-rgb), 0.3)';
        } else if (type === 'info') {
            accentColor = 'var(--blue)'; // Blue
            icon = 'ℹ️';
            glowColor = 'rgba(var(--blue-rgb), 0.3)';
        } else if (type === 'success') {
            accentColor = 'var(--success-alt)'; // Green
            icon = '✅';
            glowColor = 'rgba(var(--success-alt-rgb), 0.3)';
        }

        backdrop.innerHTML = `
            <div class="glass-panel" style="
                width: 90%;
                max-width: 450px;
                padding: 2.5rem 2rem;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(var(--card-rgb), 0.85) 0%, rgba(var(--bg-rgb), 0.95) 100%);
                border: 1px solid rgba(var(--ink-rgb), 0.08);
                box-shadow: 0 25px 50px -12px rgba(var(--shadow-rgb), 0.5), 0 0 40px ${glowColor};
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
                    background: rgba(var(--ink-rgb), 0.03);
                    border: 2px solid ${accentColor};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size:var(--t-2xl);
                    margin-bottom: 1.5rem;
                    box-shadow: 0 0 20px ${glowColor};
                    animation: pulse-icon-confirm 2s infinite;
                ">
                    ${icon}
                </div>
                
                <h3 style="
                    margin: 0 0 0.8rem 0;
                    color: var(--text-strong);
                    font-size:var(--t-xl);
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    font-family: 'Outfit', sans-serif;
                ">
                    ${title}
                </h3>
                
                <p style="
                    margin: 0 0 2rem 0;
                    color: var(--text-muted);
                    font-size:var(--t-md);
                    line-height: 1.6;
                    font-weight: 500;
                    font-family: var(--font-ui);
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
                        border: 1px solid rgba(var(--ink-rgb), 0.15);
                        border-radius: 12px;
                        background: rgba(var(--ink-rgb), 0.05);
                        color: var(--text-soft);
                        font-size:var(--t-md);
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-family: var(--font-ui);
                    " onmouseover="this.style.background='rgba(var(--ink-rgb), 0.1)'; this.style.color='var(--text-strong)';" 
                      onmouseout="this.style.background='rgba(var(--ink-rgb), 0.05)'; this.style.color='var(--text-soft)';">
                        CANCELAR
                    </button>
                    
                    <button id="premium-confirm-ok" style="
                        flex: 1;
                        padding: 0.8rem;
                        border: none;
                        border-radius: 12px;
                        background: linear-gradient(135deg, ${accentColor} 0%, var(--on-accent) 150%);
                        color: var(--text-strong);
                        font-size:var(--t-md);
                        font-weight: 700;
                        letter-spacing: 1px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px ${glowColor};
                        transition: all 0.2s ease;
                        font-family: var(--font-ui);
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
      this.APP_VERSION = 'v29.0583';
    
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
          1: { borde: 'rgba(var(--primary-rgb), .5)',  chipBg: 'rgba(var(--primary-rgb), .16)',  chipCol: 'var(--brand-pale)', chipBor: 'rgba(var(--brand-rgb), .4)',
               icoBg: 'rgba(var(--primary-rgb), .15)', icoBor: 'rgba(var(--brand-rgb), .45)', ico: '⟳',
               chip: 'PRIMER AVISO', titulo: 'Hay una versión nueva',
               texto: 'Estás viendo una versión anterior de la plataforma. Actualiza para trabajar con los últimos cambios.',
               pie: 'Si estás a mitad de algo, presiona «Después».' },
          2: { borde: 'rgba(var(--warning-soft-rgb), .55)', chipBg: 'rgba(var(--warning-soft-rgb), .14)', chipCol: 'var(--warning-soft)', chipBor: 'rgba(var(--warning-soft-rgb), .4)',
               icoBg: 'rgba(var(--warning-soft-rgb), .12)', icoBor: 'rgba(var(--warning-soft-rgb), .45)', ico: '⚠',
               chip: 'SEGUNDO AVISO', titulo: 'Sigues con la versión anterior',
               texto: 'En el <b style="color:var(--warning-soft);">próximo aviso la actualización será obligatoria</b>. Conviene actualizar ahora.',
               pie: 'Última vez que se puede postergar.' },
          3: { borde: 'rgba(var(--danger-rgb), .6)',  chipBg: 'rgba(var(--danger-rgb), .14)',  chipCol: 'var(--danger-pale)', chipBor: 'rgba(var(--danger-rgb), .45)',
               icoBg: 'rgba(var(--danger-rgb), .12)', icoBor: 'rgba(var(--danger-rgb), .5)',  ico: '⟳',
               chip: 'ACTUALIZACIÓN OBLIGATORIA', titulo: 'Actualizando la plataforma',
               texto: 'Guarda lo que estés haciendo. La página se va a recargar sola.',
               pie: 'Ya no se puede postergar.' }
      };
      const e = ESTILOS[paso] || ESTILOS[1];
      const obligatorio = paso >= 3;

      const capa = document.createElement('div');
      capa.id = 'pulse-aviso-version';
      capa.style.cssText = 'position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(var(--bg-rgb), .72); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);';
      capa.innerHTML = `
        <div style="width:100%; max-width:400px; text-align:center; background:rgba(var(--bg-rgb), .98); border:1px solid ${e.borde}; border-radius:16px; padding:28px 26px 22px; box-shadow:0 20px 60px rgba(var(--shadow-rgb), .6); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <span style="display:inline-block; font-size:var(--t-xs); font-weight:800; letter-spacing:.09em; padding:3px 10px; border-radius:12px; margin-bottom:12px; background:${e.chipBg}; color:${e.chipCol}; border:1px solid ${e.chipBor};">${e.chip}</span>
          <div style="width:44px; height:44px; margin:0 auto 14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:var(--t-xl); background:${e.icoBg}; border:1px solid ${e.icoBor}; color:${e.chipCol};">${e.ico}</div>
          <h3 style="color:var(--text-main); font-size:var(--t-lg); font-weight:700; margin:0 0 8px;">${e.titulo}</h3>
          ${obligatorio ? `<div style="font-size:var(--t-2xl); font-weight:800; color:var(--danger-pale); margin:2px 0 12px; font-variant-numeric:tabular-nums;"><span id="pulse-cuenta">20</span> <span style="font-size:var(--t-md); color:var(--text-muted); font-weight:600;">segundos</span></div>` : ''}
          <p style="color:var(--text-muted); font-size:var(--t-sm); line-height:1.6; margin:0 0 14px;">${e.texto}</p>
          <div style="display:inline-flex; align-items:center; gap:9px; margin-bottom:20px; background:rgba(var(--ink-rgb), .04); border:1px solid rgba(var(--ink-rgb), .1); border-radius:20px; padding:5px 14px; font-size:var(--t-sm); color:var(--text-dim);">
            ${this.APP_VERSION} &nbsp;→&nbsp; <b style="color:var(--brand-pale);">${publicada}</b>
          </div>
          <div style="display:flex; gap:10px;">
            ${obligatorio ? '' : '<button id="pulse-despues" style="flex:1; background:transparent; border:1px solid rgba(var(--ink-rgb), .18); color:var(--text-muted); padding:11px; border-radius:9px; font-size:var(--t-md); font-weight:600; cursor:pointer;">Después</button>'}
            <button id="pulse-ahora" style="flex:1; background:${obligatorio ? 'var(--danger)' : 'var(--btn-fill)'}; border:1px solid ${obligatorio ? 'var(--danger)' : 'var(--btn-fill)'}; color:${obligatorio ? 'var(--on-accent)' : 'var(--on-primary)'}; padding:11px; border-radius:9px; font-size:var(--t-md); font-weight:700; cursor:pointer;">Actualizar ahora</button>
          </div>
          <div style="margin-top:13px; font-size:11.5px; color:var(--text-dim);">${e.pie}</div>
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
    // Deja ordenables las 79 tablas de la plataforma. Va aqui y no en cada vista
    // porque las tablas se insertan con innerHTML desde 312 sitios distintos.
    observarTablas();
    /* LA TECLA Esc CIERRA CUALQUIER VENTANA QUE TENGA SU PROPIA SALIDA.
       Una sola vez, al arrancar: vale para las 43 de hoy y para las que se hagan manana.
       El porque y el candado —solo cierra lo que ya tiene boton de Cerrar o Cancelar—
       estan en services_v245/salidas.js. */
    instalarSalidaConEsc();
    try {
        // La pantalla de carga va en su propia capa (ver pantallaCarga): asi el
        // dashboard se dibuja debajo y la barra alcanza a llegar al final.
        if (this.root) this.root.className = '';
        pantallaCarga.mostrar(this.APP_VERSION);

        // 1. Sincronización proactiva con la nube
        await adminService.initializeAdminData().catch(e => console.warn("Sync error:", e));
        pantallaCarga.hasta(45);          // la nube ya contesto

        const user = getSession();

        // El tema de ESTA persona. El <script> de arranque de index.html ya puso
        // uno, pero adivinando con la sesion que hubiera guardada antes: si en
        // esta PC entra otro usuario, el suyo es otro. Aca ya se sabe quien es.
        // El tema que el administrador le dejo puesto en Administracion > Usuarios.
        // Viaja con la persona: entra desde cualquier PC y lo trae. Si ella ya
        // eligio otro en esta maquina, manda el suyo.
        let temaAsignado = null;
        try {
            const ficha = (adminService.getUsers() || []).find(u => u && user && u.username === user.username);
            temaAsignado = ficha && ficha.tema;
        } catch (e) { /* sin lista de usuarios: se sigue sin tema asignado */ }
        aplicarTemaDeUsuario(user && user.username, temaAsignado);

        await this.render(user);
        await pantallaCarga.cerrar();     // la barra llega al 100 y recien ahi se destapa

    } catch (err) {
        console.error("[BOOT] Error Crítico:", err);
        // Pase lo que pase la capa se va: si se quedara puesta taparia la
        // plataforma entera y no habria forma de usar nada.
        await pantallaCarga.cerrar();
    }
  }

  /**
   * LA DIRECCIÓN DEL DASHBOARD SE ARMA EN UN SOLO SITIO, Y ES ESTE.
   *
   * La usan los dos que tienen que coincidir: la precarga de acá abajo y el import de
   * render(). Si se escribieran por separado y una quedara distinta de la otra —aunque sea
   * en un carácter— el navegador las trataría como dos archivos y bajaría 1,78 MB dos veces,
   * que es peor que no precargar nada. Por eso hay una sola función: no se pueden separar.
   *
   * VA CON `new URL(..., import.meta.url)` Y NO CON './views/...' A SECAS. Es la trampa que
   * rompió esto del 01-ago al 10-ago-2026 (v29.0011 a v29.0142), diez días sin funcionar:
   *
   *   · En un `import('./views/x.js')` el './' se resuelve contra ESTE ARCHIVO, o sea
   *     `/js/views/x.js`. Correcto.
   *   · En el `href` de un `<link>` el './' se resuelve contra LA PÁGINA, o sea
   *     `/views/x.js`. Esa carpeta no existe: el navegador pedía, recibía un 404, lo anotaba
   *     en la consola y seguía. Nadie lo veía porque la web funcionaba igual —el import de
   *     render() sí usaba el camino bueno—, pero la precarga no adelantaba nada y entrar
   *     seguía tardando lo mismo que antes de escribirla.
   *
   * `new URL()` devuelve la dirección completa y no depende de desde dónde se la mire, así
   * que las dos apuntan al mismo archivo siempre.
   */
  urlDashboard() {
    return new URL(`./views/dashboard_v28.js?v=${this.APP_VERSION}`, import.meta.url).href;
  }

  /**
   * Le pide al navegador que vaya bajando y compilando el dashboard MIENTRAS la persona
   * escribe su usuario y su contraseña.
   *
   * Son ~1,8 MB y unas 22.000 líneas: cerca de medio segundo en bajar y otro medio en
   * compilar. Esto no acorta ese tiempo, lo corre a un momento en el que nadie está mirando
   * la pantalla en blanco. Cuando se aprieta ENTRAR, el archivo ya está listo.
   *
   * No ejecuta nada: 'modulepreload' descarga y compila, pero el módulo recién corre cuando
   * lo importa render().
   */
  adelantarDashboard() {
    try {
      const href = this.urlDashboard();
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
            // La MISMA dirección que precargó adelantarDashboard(), o se baja dos veces.
            const { renderDashboard } = await import(this.urlDashboard());
            pantallaCarga.hasta(78);      // el modulo del panel ya esta compilado

            // NO se borra la pantalla de carga antes de llamar al dashboard.
            //
            // renderDashboard() recien escribe en el contenedor despues de cuatro esperas
            // al servidor -initPersistentData, initializeAdminData, los maestros y las
            // tareas de almacenaje-, que juntas son cinco o seis segundos. Vaciarlo antes
            // dejaba ese rato la pantalla en negro, sin barra ni mensaje, y parecia que la
            // web se hubiera colgado justo despues de escribir la contrasena.
            //
            // Dejandola puesta, la barra sigue girando hasta que el dashboard la reemplaza
            // de una sola vez con su propio innerHTML.
            await renderDashboard(this.root, user, () => {
                this.isRendered = false;
                logout();
                this.init();
            });
        } else {
            const { renderLogin } = await import(`./views/login.js?v=${this.APP_VERSION}`);
            pantallaCarga.hasta(85);      // el login ya esta listo para dibujarse
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

