/**
 * NO RETAIL -> PORTAL DE DESPACHO
 *
 * Vivia adentro de `renderDashboard`, en `dashboard_v28.js`. Se saco el
 * 02-sep-2026, cuarta de las cinco pantallas que Daniel pidio mover: ese archivo
 * son 40.700 lineas que el navegador baja y compila ENTERAS aunque solo se abra
 * Inicio. Ahora llega con `await import(...)` al entrar a la pestana.
 *
 * TIENE DOS PUERTAS, y las dos tienen que pasarle el entorno:
 *
 *   · No Retail > Despacho, en el tablero de siempre
 *   · la VISTA MOVIL DEL TRANSPORTISTA, que entra directo y ni siquiera dibuja
 *     el tablero alrededor -por eso `updateMobileDriverClass` viene de afuera:
 *     lo que hace es ponerle al `body` la clase que cambia toda la pantalla-
 *
 * Solo se redibuja a si misma UNA vez -al volver de la ficha de un cliente- y esa
 * llamada lleva `ENT` explicito. Con una sola no hacia falta atar el entorno como
 * en Inventarios, donde eran dieciseis.
 *
 * LO QUE ANTES LE LLEGABA GRATIS AHORA VA EN `ENT`:
 *
 *   fetchAndParseNoRetailClients()  baja y lee el maestro de clientes
 *   showNRPhotoLoader()             el visor de las fotos de entrega
 *   renderTabContent()              volver al tablero desde la vista movil
 *   updateMobileDriverClass()       prende y apaga el modo transportista
 *   rolePermissions                 que puede ver cada rol
 *   showPremiumAlert()              los carteles; 144 sitios mas los usan
 *   showPremiumConfirm()
 *   user                            quien entro: la pantalla mira su rol y su
 *                                   nombre. NO era una variable de
 *                                   `renderDashboard` sino un PARAMETRO suyo, y
 *                                   por eso el detector de amarras no lo vio: la
 *                                   pantalla cargaba, la comparacion de texto
 *                                   daba cero diferencias, y reventaba con
 *                                   "user is not defined" al EJECUTARLA. La cazó
 *                                   la prueba de dibujo en vacio
 *   onLogout()                      cerrar sesion desde la vista movil
 */

import { getUploadMeta } from '../services_v245/csvHub_v6.js?v=29.0607';

export const renderDespachoNoRetailPortal = async (container, ENT = {}) => {
  const isMobile = window.innerWidth <= 768;
  const isDriverRole = ENT.user.role === 'transporte' || ENT.user.role === 'transportista' || ENT.user.role === 'chofer' || 
                       ((ENT.user.role !== 'admin' && ENT.user.role !== 'jefe') && (ENT.rolePermissions['transporte'] === 1 || ENT.rolePermissions['Transporte'] === 1));
  const hideFrame = isMobile || isDriverRole;
  const showBackToOffice = hideFrame && !isDriverRole;

  if (hideFrame) {
      document.body.classList.add('mobile-driver-active');
  } else {
      document.body.classList.remove('mobile-driver-active');
  }

  // Sincronizar caché de No Retail desde el servidor en el móvil antes de pintar
  try {
      const cacheRes = await fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache?t=' + Date.now());
      if (cacheRes.ok) {
          const serverData = await cacheRes.json();
          let serverCache = serverData.data || {};
          if (Array.isArray(serverCache)) serverCache = {};
          localStorage.setItem('nr_cache_v1', JSON.stringify(serverCache));
          console.log("📡 [PORTAL MÓVIL] Caché de liquidaciones sincronizada desde el servidor.");
      }
  } catch (e) {
      console.warn("⚠️ [PORTAL MÓVIL] Error al sincronizar caché desde el servidor, usando fallback local:", e);
  }

  if (!window._noRetailHistorialDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      window._noRetailHistorialDate = `${yyyy}-${mm}-${dd}`;
  }

  const clientsData = await ENT.fetchAndParseNoRetailClients(false, true);

  // Remove old debug div if exists
  const oldDebug = document.getElementById('nr_debug_floater');
  if (oldDebug) oldDebug.remove();

  if (!window._noRetailActiveTab) window._noRetailActiveTab = 'inicio';
  if (!window._noRetailSearchQuery) window._noRetailSearchQuery = '';
  if (!window._noRetailExpandedAgencies) window._noRetailExpandedAgencies = {};

  const refreshNoRetailUI = () => {
      if (!container.isConnected) return;
      const activeTab = window._noRetailActiveTab;
      const today = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const capitalizedToday = today.charAt(0).toUpperCase() + today.slice(1);

      let clients = window._noRetailClients || [];
      if (window._noRetailHistorialDate) {
          clients = clients.filter(c => c.fechaCargaStr === window._noRetailHistorialDate);
      }

      const totalCount = clients.length;
      const pendingCount = clients.filter(c => c.status === 'PENDIENTE').length;

      container.innerHTML = `
          ${showBackToOffice ? `
          <!-- Simulation back to office bar for admin testing -->
          <div style="background: rgba(var(--bg-rgb), 0.95); padding: 0.6rem 1rem; width:100%; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(var(--ink-rgb), 0.08); position: sticky; top: 0; z-index:999999; box-shadow:0 4px 10px rgba(var(--shadow-rgb), 0.3);">
              <span style="font-size:var(--t-xs); color:var(--warning); font-weight:800; letter-spacing:0.5px;">📲 VISTA PORTAL MÓVIL NO RETAIL</span>
              <button id="btn_back_to_office" style="background:var(--btn-fill); color:var(--on-primary); border:none; padding:4px 10px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='var(--primary-hover)'" onmouseout="this.style.background='var(--primary)'">
                  🏢 VOLVER A OFICINA
              </button>
          </div>
          ` : ''}

          <div style="display:flex; flex-direction:column; align-items:center; width:100%; padding:${hideFrame ? '0' : '1rem 0'};">
              ${hideFrame ? '' : `
              <!-- Simulation info -->
              <div style="max-width:380px; width:100%; text-align:center; color:var(--text-muted); font-size:var(--t-sm); margin-bottom:1.5rem; line-height:1.4;">
                  <span style="color:var(--yellow-deep); font-weight:800;">⚡ PORTAL MÓVIL NO RETAIL 📲</span><br>
                  Usa este portal móvil para actuar como transportista. Los cambios realizados aquí se verán reflejados de inmediato.
              </div>
              `}

              <!-- Smartphone Mock Frame / Mobile Direct Screen -->
              <div style="${hideFrame ? `
                  width: 100%;
                  background: var(--bg-dark);
                  position: relative;
                  min-height: 100vh;
                  display: flex;
                  flex-direction: column;
              ` : `
                  max-width: 380px;
                  width: 100%;
                  background: var(--bg-dark);
                  border: 10px solid var(--panel-solid);
                  border-radius: 36px;
                  padding: 1.25rem 1rem;
                  box-shadow: 0 25px 60px rgba(var(--shadow-rgb), 0.6);
                  position: relative;
                  overflow: hidden;
                  border-bottom-width: 14px;
                  display: flex;
                  flex-direction: column;
                  min-height: 720px;
              `}">

                  <!-- Top Bar of portal -->
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.2rem 0.5rem 0.6rem; background:var(--bg-dark); border-bottom:1px solid rgba(var(--ink-rgb), 0.03); margin-bottom:0.5rem;">
                      <div style="display:flex; align-items:center; gap:0.8rem;">
                          <span style="font-size:var(--t-lg); cursor:pointer; color:var(--primary); font-weight:800;" id="btn_nr_menu">☰</span>
                          <div style="display:flex; flex-direction:column;">
                              <span style="font-size:var(--t-lg); font-weight:900; color:var(--text-strong); letter-spacing:0.5px;" id="nr_top_title">
                                  Deam1830
                              </span>
                              <span style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.45); font-weight:700;">👤 ${ENT.user.name}</span>
                          </div>
                      </div>
                      <div style="display:flex; gap:0.8rem; align-items:center;">
                          <div style="position:relative; width:24px; height:24px; display:flex; justify-content:center; align-items:center;">
                              <span style="font-size:var(--t-lg); cursor:pointer;" id="btn_nr_cal">📅</span>
                              <input type="date" id="nr_date_filter" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
                          </div>
                          <div style="position:relative; width:24px; height:24px; display:flex; justify-content:center; align-items:center;" id="btn_nr_logout" title="Cerrar Sesión">
                              <span style="cursor:pointer; color:var(--danger); display:flex; align-items:center; justify-content:center;">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                                  </svg>
                              </span>
                          </div>
                      </div>
                  </div>

                  <div style="flex-grow:1; overflow-y:auto; padding-bottom: 4.5rem;" id="nr_content_wrapper">
                      ${renderActiveTabContent(activeTab, capitalizedToday, pendingCount, totalCount)}
                          <div style="text-align: center; margin-top: 2rem; margin-bottom: 1.5rem; font-size:var(--t-xs); color: rgba(var(--ink-rgb), 0.25); font-weight: 700; letter-spacing: 0.05em;">
                              SYSTEM BUILD: v29.0607 | MOBILE PORTAL
                          </div>
                  </div>

                  <!-- Glass Bottom Bar Navigation -->
                  <div style="
                      position: absolute;
                      bottom: 0;
                      left: 0;
                      width: 100%;
                      background: rgba(var(--bg-rgb), 0.95);
                      backdrop-filter: blur(16px);
                      border-top: 1.5px solid rgba(var(--ink-rgb), 0.08);
                      display: grid;
                      grid-template-columns: 1fr 1fr 1fr;
                      padding: 0.6rem 0.5rem;
                      z-index: 10010;
                      box-sizing: border-box;
                  ">
                      <div class="nr-nav-item" data-tab="inicio" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'inicio' ? 1 : 0.4};">
                          <div style="
                              background: ${activeTab === 'inicio' ? 'var(--primary)' : 'transparent'};
                              width: ${activeTab === 'inicio' ? '46px' : 'auto'};
                              height: 28px;
                              border-radius: 14px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                          ">
                              <span style="font-size:var(--t-lg); color:${activeTab === 'inicio' ? 'var(--text-strong)' : 'var(--text-soft)'};">🏠</span>
                          </div>
                          <span style="font-size:var(--t-xs); font-weight:800; color:${activeTab === 'inicio' ? 'var(--text-strong)' : 'var(--text-soft)'};">Inicio</span>
                      </div>

                      <div class="nr-nav-item" data-tab="historial" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'historial' ? 1 : 0.4};">
                          <div style="
                              background: ${activeTab === 'historial' ? 'var(--primary)' : 'transparent'};
                              width: ${activeTab === 'historial' ? '46px' : 'auto'};
                              height: 28px;
                              border-radius: 14px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                          ">
                              <span style="font-size:var(--t-lg); color:${activeTab === 'historial' ? 'var(--text-strong)' : 'var(--text-soft)'};">🔄</span>
                          </div>
                          <span style="font-size:var(--t-xs); font-weight:800; color:${activeTab === 'historial' ? 'var(--text-strong)' : 'var(--text-soft)'};">Historial</span>
                      </div>

                      <div class="nr-nav-item" data-tab="en_ruta" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; gap:4px; opacity: ${activeTab === 'en_ruta' ? 1 : 0.4};">
                          <div style="
                              background: ${activeTab === 'en_ruta' ? 'var(--primary)' : 'transparent'};
                              width: ${activeTab === 'en_ruta' ? '46px' : 'auto'};
                              height: 28px;
                              border-radius: 14px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                          ">
                              <span style="font-size:var(--t-lg); color:${activeTab === 'en_ruta' ? 'var(--text-strong)' : 'var(--text-soft)'};">🚚</span>
                          </div>
                          <span style="font-size:var(--t-xs); font-weight:800; color:${activeTab === 'en_ruta' ? 'var(--text-strong)' : 'var(--text-soft)'};">En Ruta</span>
                      </div>
                  </div>
              </div>
          </div>
      `;

      // Wire bottom navigation events
      document.querySelectorAll('.nr-nav-item').forEach(item => {
          item.addEventListener('click', (e) => {
              window._noRetailActiveTab = e.currentTarget.dataset.tab;
              refreshNoRetailUI();
          });
      });

      // Search action
      const searchInput = document.getElementById('nr_search_input');
      if (searchInput) {
          searchInput.value = window._noRetailSearchQuery;
          searchInput.addEventListener('input', (e) => {
              window._noRetailSearchQuery = e.target.value.toLowerCase();
              filterHistoryItems();
          });
      }

      // Accordion expand/collapse
      document.querySelectorAll('.nr-accordion-header').forEach(header => {
          header.addEventListener('click', (e) => {
              const body = e.currentTarget.nextElementSibling;
              const icon = e.currentTarget.querySelector('.nr-chevron');
              if (body.style.display === 'none' || !body.style.display) {
                  body.style.display = 'block';
                  icon.style.transform = 'rotate(180deg)';
              } else {
                  body.style.display = 'none';
                  icon.style.transform = 'rotate(0deg)';
              }
          });
      });

      // En Ruta Agency Card click to desglosar clientes
      document.querySelectorAll('.nr-agency-card-header').forEach(card => {
          card.addEventListener('click', (e) => {
              const agencyName = e.currentTarget.dataset.agency;
              window._noRetailExpandedAgencies[agencyName] = !window._noRetailExpandedAgencies[agencyName];
              refreshNoRetailUI();
          });
      });

      // Cobro Flete option toggles
      document.querySelectorAll('.nr-flete-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const cId = e.currentTarget.dataset.client;
              const val = e.currentTarget.dataset.val;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c.cobroFlete = val;
                  refreshNoRetailUI();
              }
          });
      });

      // Status selection buttons
      document.querySelectorAll('.nr-status-select-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const cId = e.currentTarget.dataset.client;
              const status = e.currentTarget.dataset.status;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c._tempStatus = status;
                  refreshNoRetailUI();
              }
          });
      });

      // Gasto input listener
      document.querySelectorAll('.nr-gasto-input').forEach(input => {
          input.addEventListener('input', (e) => {
              const cId = e.currentTarget.dataset.client;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c._tempGasto = e.currentTarget.value;
              }
          });
      });

      // Factura input listener
      document.querySelectorAll('.nr-factura-input').forEach(input => {
          input.addEventListener('input', (e) => {
              const cId = e.currentTarget.dataset.client;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c._tempFactura = e.currentTarget.value;
              }
          });
      });

      // Incidencia button toggles
      document.querySelectorAll('.nr-incidencia-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const cId = e.currentTarget.dataset.client;
              const val = e.currentTarget.dataset.val;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c._tempIncidencia = val;
                  refreshNoRetailUI();
              }
          });
      });

      // Incidencia observaciones textarea listener
      document.querySelectorAll('.nr-incidencia-obs').forEach(textarea => {
          textarea.addEventListener('input', (e) => {
              const cId = e.currentTarget.dataset.client;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  c._tempIncidenciaObs = e.currentTarget.value;
              }
          });
      });

      // Date filter
      const dateInput = document.getElementById('nr_date_filter');
      if (dateInput) {
          if (window._noRetailHistorialDate) dateInput.value = window._noRetailHistorialDate;
          dateInput.addEventListener('change', async (e) => {
              window._noRetailHistorialDate = e.target.value;
              await renderDespachoNoRetailPortal(container, ENT);
          });
      }

      // Photo file input change handlers
      document.querySelectorAll('.nr-photo-input').forEach(input => {
          input.addEventListener('change', (e) => {
              const cId = e.currentTarget.dataset.client;
              const type = e.currentTarget.dataset.type; // 'cargo' or 'local'
              const file = e.target.files[0];
              if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                          // Compress image using canvas
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 1024;
                          const MAX_HEIGHT = 1024;
                          let width = img.width;
                          let height = img.height;

                          if (width > height) {
                              if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                              }
                          } else {
                              if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                              }
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, width, height);

                          // Convert to jpeg with 0.7 quality for sharp readability (~70-120KB)
                          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                          const c = window._noRetailClients.find(x => x.id === cId);
                          if (c) {
                              if (type === 'cargo') c.fotoCargo = compressedDataUrl;
                              else c.fotoLocal = compressedDataUrl;
                              refreshNoRetailUI();
                          }
                      };
                      img.src = event.target.result;
                  };
                  reader.readAsDataURL(file);
              }
          });
      });

      // Liquidar button
      document.querySelectorAll('.btn-nr-liquidar-client').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const cId = e.currentTarget.dataset.client;
              const c = window._noRetailClients.find(x => x.id === cId);
              if (c) {
                  const currentStatus = c._tempStatus || c.status;
                  if (currentStatus === 'PENDIENTE') {
                      ENT.showPremiumAlert('SELECCIONA UN ESTADO', 'Debes seleccionar un estado diferente de PENDIENTE para liquidar (ATENDIDO, NO ATENDIDO o REPROGRAMAR).', 'warning');
                      return;
                  }
                  if (currentStatus === 'ATENDIDO' && !c.fotoCargo) {
                      ENT.showPremiumAlert('FOTO OBLIGATORIA', 'Es obligatorio tomar la foto de los cargos para poder liquidar el cliente en estado ATENDIDO.', 'warning');
                      return;
                  }
                  // Liquidate successfully
                  c.status = currentStatus;
                  c.statusDate = new Date().toISOString();
                  c.liquidated = true;
                  c.gasto = c._tempGasto !== undefined ? c._tempGasto : (c.gasto || '');
                  c.factura = c._tempFactura !== undefined ? c._tempFactura : (c.factura || '');
                  c.incidencia = c._tempIncidencia || c.incidencia || 'NO';
                  c.incidenciaObs = c._tempIncidenciaObs !== undefined ? c._tempIncidenciaObs : (c.incidenciaObs || '');

                  let finalCache = {};
                  try {
                       let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                       if (Array.isArray(cache)) cache = {};
                       cache[c.id] = { 
                           status: c.status, 
                           date: c.statusDate, 
                           liquidated: true,
                           cobroFlete: c.cobroFlete,
                           factura: c.factura,
                           gasto: c.gasto,
                           incidencia: c.incidencia,
                           incidenciaObs: c.incidenciaObs,
                           fotoCargo: c.fotoCargo,
                           fotoLocal: c.fotoLocal
                       };
                       localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
                       finalCache = cache;
                  } catch(err) {
                       console.error("Cache storage limit reached, saving without photos in local storage:", err);
                       try {
                           let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                           if (Array.isArray(cache)) cache = {};
                           cache[c.id] = { 
                               status: c.status, 
                               date: c.statusDate, 
                               liquidated: true,
                               cobroFlete: c.cobroFlete,
                               factura: c.factura
                           };
                           localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
                           finalCache = cache;
                       } catch(err2) {
                           console.error("Could not write even status to localStorage:", err2);
                       }
                  }

                  // Construct delta for the current client to keep request payload small
                  const delta = {};
                  delta[c.id] = { 
                      status: c.status, 
                      date: c.statusDate, 
                      liquidated: true,
                      cobroFlete: c.cobroFlete,
                      factura: c.factura,
                      gasto: c.gasto,
                      incidenciaObs: c.incidenciaObs,
                      fotoCargo: c.fotoCargo,
                      fotoLocal: c.fotoLocal
                  };

                  // Push tracking updates to backend server (delta merge on backend)
                  fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify(delta)
                  })
                  .then(res => {
                       if (!res.ok) console.error("Server cache sync failed:", res.statusText);
                  })
                  .catch(err => console.error("Sync to server failed:", err));

                  ENT.showPremiumAlert('CLIENTE LIQUIDADO', `El cliente ${c.clientName} ha sido liquidado correctamente.`, 'success');
                  refreshNoRetailUI();
              }
          });
      });

      // Back to Office simulator button
      if (document.getElementById('btn_back_to_office')) document.getElementById('btn_back_to_office').addEventListener('click', () => {
          localStorage.setItem(`activeSub_no_retail`, 'archivo_no_retail');
          ENT.updateMobileDriverClass();
          ENT.renderTabContent();
      });

      // Menu icon back to office
              document.getElementById('btn_nr_menu').addEventListener('click', async () => {
          if (await ENT.showPremiumConfirm('VOLVER AL PANEL', '¿Estás seguro de regresar al panel general?', 'info')) {
              document.body.classList.remove('mobile-driver-active');
              window.location.reload();
          }
      });

      // Logout
      if (document.getElementById('btn_nr_logout')) document.getElementById('btn_nr_logout').addEventListener('click', async () => {
          if (await ENT.showPremiumConfirm('CERRAR SESIÓN', '¿Estás seguro que deseas cerrar sesión?', 'warning')) {
              ENT.onLogout();
          }
      });


  };

  const renderActiveTabContent = (tab, dateStr, pendingCount, totalCount) => {
      const clients = window._noRetailClients || [];
      const pendingAgenciesCount = [...new Set(clients.filter(c => c.status === 'PENDIENTE').map(c => c.agencia))].length;

      const liquidatedCount = clients.filter(c => c.status !== 'PENDIENTE').length;

      if (tab === 'inicio') {
          return `
              <div style="font-size:var(--t-xl); font-weight: 800; color: var(--text-strong); margin-bottom: 0.2rem;">Panel de Control</div>
              <div style="font-size:var(--t-sm); color: var(--text-muted); margin-bottom: 1.5rem;">${dateStr}</div>

              <!-- Stats Grid (Hoy vs Liquidados vs Total) -->
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.6rem; margin-bottom:1.5rem;">
                  <!-- Hoy Card -->
                  <div style="background:linear-gradient(135deg, var(--blue-deep) 0%, var(--blue-deep) 100%); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative; box-shadow: 0 4px 15px rgba(var(--blue-rgb), 0.2);">
                      <span style="font-size:var(--t-xs); color:var(--blue-soft); font-weight:800; letter-spacing:0.5px;">HOY (PEND.)</span>
                      <span style="font-size:var(--t-2xl); font-weight:900; color:var(--text-strong); line-height:1; margin: 0.2rem 0;">${pendingAgenciesCount}</span>
                      <span style="font-size:var(--t-xs); color:var(--blue-soft); font-weight:600; line-height:1.2;">Agencias</span>
                      <span style="position:absolute; right:8px; top:8px; font-size:var(--t-lg); opacity:0.15; user-select:none;">🚚</span>
                  </div>

                  <!-- Liquidados Card -->
                  <div style="background:linear-gradient(135deg, var(--success-alt) 0%, var(--success-deep) 100%); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative; box-shadow: 0 4px 15px rgba(var(--success-alt-rgb), 0.2);">
                      <span style="font-size:var(--t-xs); color:var(--success-pale); font-weight:800; letter-spacing:0.5px;">LIQUIDADOS</span>
                      <span style="font-size:var(--t-2xl); font-weight:900; color:var(--text-strong); line-height:1; margin: 0.2rem 0;">${liquidatedCount}</span>
                      <span style="font-size:var(--t-xs); color:var(--success-pale); font-weight:600; line-height:1.2;">Firmados</span>
                      <span style="position:absolute; right:8px; top:8px; font-size:var(--t-lg); opacity:0.15; user-select:none;">✍️</span>
                  </div>

                  <!-- Acumulado Card -->
                  <div style="background:rgba(var(--ink-rgb), 0.02); border:1px solid rgba(var(--ink-rgb), 0.05); border-radius:12px; padding:0.8rem; display:flex; flex-direction:column; position:relative;">
                      <span style="font-size:var(--t-xs); color:var(--text-muted); font-weight:800; letter-spacing:0.5px;">TOTAL</span>
                      <span style="font-size:var(--t-2xl); font-weight:900; color:var(--text-strong); line-height:1; margin: 0.2rem 0;">${totalCount}</span>
                      <span style="font-size:var(--t-xs); color:var(--text-muted); font-weight:600; line-height:1.2;">Pedidos</span>
                      <span style="position:absolute; right:8px; top:8px; font-size:var(--t-lg); opacity:0.05; user-select:none;">📋</span>
                  </div>
              </div>
          `;
      }

      if (tab === 'historial') {
          const filterDate = window._noRetailHistorialDate;
          const now = new Date();
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);

          // Filter clients
          const validStatuses = ['ATENDIDO', 'NO ATENDIDO', 'REPROGRAMAR'];
          const historyClients = clients.filter(c => validStatuses.includes(c.status) && c.statusDate);

          // Group dynamically by Day -> Agency -> Clients
          const grouped = {};

          historyClients.forEach(c => {
              const cDate = new Date(c.statusDate);
              let include = false;
              if (filterDate) {
                  if (c.fechaCargaStr === filterDate) {
                      include = true;
                  }
              } else {
                  if (cDate >= sevenDaysAgo) {
                      include = true;
                  }
              }

              if (include) {
                  const dayStr = cDate.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                  const capDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
                  if (!grouped[capDay]) grouped[capDay] = {};
                  if (!grouped[capDay][c.agencia]) grouped[capDay][c.agencia] = [];
                  grouped[capDay][c.agencia].push(c);
              }
          });

          return `
              <div style="position:relative; margin-bottom:1.5rem;">
                  <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:var(--t-md); color:rgba(var(--ink-rgb), 0.3);">🔍</span>
                  <input type="text" id="nr_search_input" placeholder="Buscar por fecha o agencia" value="${window._noRetailSearchQuery || ''}" style="width:100%; background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.08); border-radius:10px; color:var(--text-strong); padding:0.65rem 0.65rem 0.65rem 2.2rem; font-size:var(--t-sm); outline:none; box-sizing:border-box;">
              </div>

              <div style="font-size:var(--t-sm); color:var(--text-muted); font-weight:800; letter-spacing:0.5px; margin-bottom:0.8rem;">
                  HISTORIAL DE ACTIVIDAD ${filterDate ? `(Filtrado: ${filterDate})` : '(Últimos 7 días)'}
              </div>

              <div style="display:flex; flex-direction:column; gap:0.8rem; margin-bottom:1.5rem;" id="nr_history_accordion_list">
                  ${Object.keys(grouped).length === 0 ? `<div style="text-align:center; color:rgba(var(--ink-rgb), 0.4); font-size:var(--t-sm); padding: 2rem 0;">No hay registros para este periodo.</div>` : ''}
                  ${Object.entries(grouped).map(([day, agencies]) => `
                      <div class="nr-history-row" style="background:rgba(var(--ink-rgb), 0.02); border:1px solid rgba(var(--ink-rgb), 0.04); border-radius:16px; overflow:hidden; margin-bottom:0.5rem;">
                          <div class="nr-accordion-header" style="padding:1rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                              <div>
                                  <div style="font-size:var(--t-md); font-weight:800; color:var(--text-strong);">${day}</div>
                              </div>
                              <span class="nr-chevron" style="font-size:var(--t-sm); color:rgba(var(--ink-rgb), 0.3); transition:transform 0.2s;">▼</span>
                          </div>
                          <div class="nr-accordion-body" style="display:none; padding:0.5rem 1rem 1rem; border-top:1px solid rgba(var(--ink-rgb), 0.03); background:rgba(var(--shadow-rgb), 0.15);">
                              ${Object.entries(agencies).map(([agency, cList]) => `
                                  <div style="margin-left:0.5rem; margin-bottom:0.6rem; border-left:2px solid rgba(var(--ink-rgb), 0.05); padding-left:0.6rem;">
                                      <div style="font-size:var(--t-xs); font-weight:700; color:var(--text-strong); display:flex; justify-content:space-between;">
                                          <span>🏢 ${agency}</span>
                                          <span class="txt-suave">${cList.length} Clientes</span>
                                      </div>

                                      <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.2rem;">
                                          ${cList.map(c => `
                                              <div class="nr-history-client-row" data-client="${c.id}" style="font-size:var(--t-xs); color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; padding: 6px 8px; border-bottom: 1px solid rgba(var(--ink-rgb), 0.02); cursor:pointer; border-radius:6px; transition:background 0.2s;" onmouseover="this.style.background='rgba(var(--ink-rgb), 0.03)'" onmouseout="this.style.background='transparent'">
                                                  <span>👤 ${c.clientName} (${c.pedido})</span>
                                                  <span style="color:${c.status === 'ATENDIDO' ? 'var(--success)' : c.status === 'PENDIENTE' ? 'var(--yellow-deep)' : 'var(--danger)'}; font-weight:700;">
                                                      ${c.status}
                                                  </span>
                                              </div>
                                          `).join('')}
                                      </div>
                                  </div>
                              `).join('')}
                          </div>
                      </div>
                  `).join('')}
              </div>
          `;
      }

      if (tab === 'en_ruta') {
          const pendingClients = clients.filter(c => c.status === 'PENDIENTE');

          // Group dynamically by Agency -> Clients
          const groupedAgencies = {};
          pendingClients.forEach(c => {
              const ag = c.agencia || 'Sin Agencia';
              if (!groupedAgencies[ag]) groupedAgencies[ag] = [];
              groupedAgencies[ag].push(c);
          });

          const activeAgenciesCount = Object.keys(groupedAgencies).length;
          const agPendingCount = pendingClients.length;

          const selectedDate = window._noRetailHistorialDate;
          const meta = getUploadMeta('no_retail') || {};
          let uploadDate = '';
          if (selectedDate) {
              const parts = selectedDate.split('-');
              if (parts.length === 3) {
                  uploadDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
              } else {
                  uploadDate = selectedDate;
              }
          } else {
              const today = new Date();
              const dd = String(today.getDate()).padStart(2, '0');
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const yyyy = today.getFullYear();
              uploadDate = meta.timestamp || (meta.ts ? new Date(meta.ts).toLocaleString('es-PE') : `${dd}/${mm}/${yyyy}`);
          }

          return `
              <!-- Top stats -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:1.5rem;">
                  <div style="background:rgba(var(--ink-rgb), 0.02); border:1px solid rgba(var(--ink-rgb), 0.04); border-radius:12px; padding:0.8rem 1rem; display:flex; flex-direction:column; justify-content:center;">
                      <span style="font-size:var(--t-xs); color:var(--text-muted); font-weight:700;">Agencias Activas</span>
                      <span style="font-size:var(--t-xl); font-weight:900; color:var(--blue); margin-top:2px;">
                          ${activeAgenciesCount.toString().padStart(2, '0')}
                      </span>
                  </div>

                  <div style="background:rgba(var(--ink-rgb), 0.02); border:1px solid rgba(var(--ink-rgb), 0.04); border-radius:12px; padding:0.8rem 1rem; display:flex; flex-direction:column; justify-content:center;">
                      <span style="font-size:var(--t-xs); color:var(--text-muted); font-weight:700;">Total Pendientes</span>
                      <span style="font-size:var(--t-xl); font-weight:900; color:var(--success-alt); margin-top:2px;">${agPendingCount}</span>
                  </div>
              </div>

              <div style="font-size:var(--t-sm); color:var(--text-muted); font-weight:800; letter-spacing:0.5px; margin-bottom:0.8rem; border-bottom:1px solid rgba(var(--ink-rgb), 0.05); padding-bottom:0.4rem;">AGENCIAS EN RUTA (PENDIENTES)</div>
              <div style="font-size:var(--t-md); font-weight:800; color:var(--yellow-deep); margin-bottom:1rem;">
                  📅 FECHA DE CARGA: ${uploadDate}
              </div>

              <div style="display:flex; flex-direction:column; gap:1.5rem;">
                  ${Object.keys(groupedAgencies).length === 0 ? `<div style="text-align:center; color:rgba(var(--ink-rgb), 0.4); font-size:var(--t-sm); padding: 2rem 0;">No hay pedidos pendientes en ruta.</div>` : ''}
                  <div style="display:flex; flex-direction:column; gap:1rem;">
                      ${Object.entries(groupedAgencies).map(([agName, agClients]) => {
                          const agPending = agClients.length;
                          const expandedKey = agName.replace(/\W/g, '');
                          const isExpanded = !!window._noRetailExpandedAgencies[expandedKey];

                          return `
                              <div style="
                                  background: rgba(var(--ink-rgb), 0.02);
                                  border: 1px solid ${isExpanded ? 'rgba(var(--blue-rgb), 0.4)' : 'rgba(var(--ink-rgb), 0.04)'};
                                  border-radius: 18px;
                                  padding: 1.2rem;
                                  display: flex;
                                  flex-direction: column;
                                  gap: 0.8rem;
                              ">
                                  <!-- Agency Header (Click to toggle desglosar) -->
                                  <div class="nr-agency-card-header" data-agency="${expandedKey}" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                      <div>
                                          <span style="font-size:var(--t-md); font-weight:900; color:var(--text-strong); display:block;">${agName}</span>
                                          <span style="font-size:var(--t-xs); color:var(--text-muted); margin-top:2px;">📍 Clic para desglosar clientes</span>
                                      </div>
                                      <span class="badge status-warning" style="font-size:var(--t-xs); padding:3px 10px; border-radius:12px;">
                                          ${agPending} Pendientes
                                      </span>
                                  </div>

                                  <!-- Clients list (desglosado) -->
                                  ${isExpanded ? `
                                      <div style="display:flex; flex-direction:column; gap:1rem; margin-top:0.8rem; border-top:1px solid rgba(var(--ink-rgb), 0.05); padding-top:1rem;">
                                          <div style="font-size:var(--t-xs); font-weight:800; color:var(--yellow-deep); margin-bottom:0.2rem;">👤 LISTADO DE CLIENTES A LIQUIDAR:</div>

                                          ${agClients.map(c => `
                                              <div class="${c.liquidated ? 'nr-liquidated-client-card' : ''}" data-client="${c.id}" style="
                                                  background: rgba(var(--shadow-rgb), 0.2);
                                                  border: 1px solid ${c.liquidated ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--ink-rgb), 0.03)'};
                                                  border-radius: 12px;
                                                  padding: 0.9rem;
                                                  ${c.liquidated ? 'cursor:pointer; transition:border-color 0.2s;' : ''}
                                              " ${c.liquidated ? `onmouseover="this.style.borderColor='rgba(var(--blue-rgb), 0.4)'" onmouseout="this.style.borderColor='rgba(var(--success-rgb), 0.2)'"` : ''}>
                                                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                      <div>
                                                          <span style="font-size:var(--t-sm); font-weight:800; color:var(--text-strong); display:block;">${c.clientName}</span>
                                                          <span class="txt-chico">Pedido: ${c.pedido} | 📍 ${c.address}</span>
                                                      </div>
                                                      <span class="badge ${c.liquidated ? 'status-success' : 'status-warning'}" style="font-size:var(--t-xs); padding:1px 6px;">
                                                          ${c.liquidated ? c.status : 'PENDIENTE'}
                                                      </span>
                                                  </div>

                                                  ${!c.liquidated ? `
                                                      <!-- Liquidation Form -->
                                                      <div style="display:flex; flex-direction:column; gap:0.8rem; margin-top:0.8rem; border-top:1px dashed rgba(var(--ink-rgb), 0.05); padding-top:0.8rem;">
                                                          <!-- Cobro Flete (SI/NO) selector -->
                                                          <div class="fila-entre">
                                                              <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">💰 COBRO FLETE:</span>
                                                              <div style="display:flex; background:rgba(var(--ink-rgb), 0.03); border-radius:8px; padding:2px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                                                                  <button class="nr-flete-btn" data-client="${c.id}" data-val="SI" style="background:${c.cobroFlete === 'SI' ? 'var(--blue-deep)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 10px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">SI</button>
                                                                  <button class="nr-flete-btn" data-client="${c.id}" data-val="NO" style="background:${c.cobroFlete === 'NO' ? 'var(--blue-deep)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 10px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO</button>
                                                              </div>
                                                          </div>

                                                          <!-- Campo Gasto -->
                                                          <div class="fila-entre">
                                                              <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">💸 GASTO:</span>
                                                              <input type="number" step="0.01" min="0" placeholder="S/ 0.00" class="nr-gasto-input" data-client="${c.id}" value="${c._tempGasto !== undefined ? c._tempGasto : (c.gasto || '')}" style="background:rgba(var(--shadow-rgb), 0.3); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:4px 8px; border-radius:6px; outline:none; font-size:var(--t-xs); font-family:inherit; width:80px; text-align:right;">
                                                          </div>

                                                          <!-- Campo Factura -->
                                                          <div class="fila-entre">
                                                              <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">📄 FACTURA:</span>
                                                              <input type="text" placeholder="Factura" class="nr-factura-input" data-client="${c.id}" value="${c._tempFactura !== undefined ? c._tempFactura : (c.factura || '')}" style="background:rgba(var(--shadow-rgb), 0.3); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:4px 8px; border-radius:6px; outline:none; font-size:var(--t-xs); font-family:inherit; width:100px; text-align:right;">
                                                          </div>

                                                          <!-- Status Buttons selection -->
                                                          <div>
                                                              <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700; margin-bottom:0.3rem;">📋 ESTADO DE ENTREGA:</div>
                                                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                                                  <button class="nr-status-select-btn" data-client="${c.id}" data-status="ATENDIDO" style="background:${(c._tempStatus || c.status) === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${(c._tempStatus || c.status) === 'ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:5px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">ATENDIDO</button>
                                                                  <button class="nr-status-select-btn" data-client="${c.id}" data-status="NO ATENDIDO" style="background:${(c._tempStatus || c.status) === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${(c._tempStatus || c.status) === 'NO ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:5px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO ATENDIDO</button>
                                                                  <button class="nr-status-select-btn" data-client="${c.id}" data-status="REPROGRAMAR" style="background:${(c._tempStatus || c.status) === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${(c._tempStatus || c.status) === 'REPROGRAMAR' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${(c._tempStatus || c.status) === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:5px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer; grid-column: span 2;">REPROGRAMAR</button>
                                                              </div>
                                                          </div>

                                                          <!-- Campo Incidencia -->
                                                          <div class="fila-entre">
                                                              <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">⚠️ ¿TIENE INCIDENCIA?</span>
                                                              <div style="display:flex; background:rgba(var(--ink-rgb), 0.03); border-radius:8px; padding:2px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                                                                  <button class="nr-incidencia-btn" data-client="${c.id}" data-val="SI" style="background:${(c._tempIncidencia || c.incidencia || 'NO') === 'SI' ? 'var(--danger)' : 'transparent'}; color:${(c._tempIncidencia || c.incidencia || 'NO') === 'SI' ? 'var(--on-accent)' : 'var(--text-strong)'}; border:none; padding:3px 10px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">SI</button>
                                                                  <button class="nr-incidencia-btn" data-client="${c.id}" data-val="NO" style="background:${(c._tempIncidencia || c.incidencia || 'NO') === 'NO' ? 'var(--text-faint)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 10px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO</button>
                                                              </div>
                                                          </div>

                                                          <!-- Observaciones de transporte -->
                                                          <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                                              <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">📝 OBSERVACIONES DE TRANSPORTE:</div>
                                                              <textarea class="nr-incidencia-obs" data-client="${c.id}" rows="2" placeholder="Describa aquí observaciones del transporte..." style="background:rgba(var(--shadow-rgb), 0.3); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:6px 10px; border-radius:8px; outline:none; font-size:var(--t-sm); font-family:inherit; width:100%; box-sizing:border-box; resize:none;">${c._tempIncidenciaObs !== undefined ? c._tempIncidenciaObs : (c.incidenciaObs || '')}</textarea>
                                                          </div>

                                                          <!-- Two Photo Slots -->
                                                          <div>
                                                              <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700; margin-bottom:0.4rem;">📸 FOTOS OBLIGATORIAS DE CARGO Y FACHADA:</div>
                                                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                                                                  <!-- Photo Cargo -->
                                                                  <label style="background:rgba(var(--ink-rgb), 0.02); border:1px dashed rgba(var(--ink-rgb), 0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
                                                                      ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); font-weight:700;">📸 FOTO CARGO</span>`}
                                                                      <input type="file" accept="image/*" capture="environment" class="nr-photo-input" data-client="${c.id}" data-type="cargo" style="display:none;">
                                                                  </label>

                                                                  <!-- Photo Fachada -->
                                                                  <label style="background:rgba(var(--ink-rgb), 0.02); border:1px dashed rgba(var(--ink-rgb), 0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
                                                                      ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); font-weight:700;">📸 FOTO FACHADA</span>`}
                                                                      <input type="file" accept="image/*" capture="environment" class="nr-photo-input" data-client="${c.id}" data-type="local" style="display:none;">
                                                                  </label>
                                                              </div>
                                                          </div>

                                                          <!-- Save Button -->
                                                          <button class="btn btn-nr-liquidar-client" data-client="${c.id}" style="width:100%; background:var(--success-alt); border:none; padding:0.6rem; border-radius:8px; font-size:var(--t-xs); font-weight:800; color:var(--on-accent); cursor:pointer; transition:background 0.2s;">
                                                              ✅ LIQUIDAR CLIENTE
                                                          </button>
                                                      </div>
                                                  ` : `
                                                      <!-- Summary of liquidated client -->
                                                      <div style="margin-top:0.6rem; border-top:1px solid rgba(var(--ink-rgb), 0.05); padding-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem; font-size:var(--t-xs); color:var(--text-muted);">
                                                          <div>💰 Cobro Flete: <strong style="color:var(--text-strong);">${c.cobroFlete}</strong></div>
                                                          ${c.gasto ? `<div>💸 Gasto: <strong style="color:var(--text-strong);">S/ ${parseFloat(c.gasto).toFixed(2)}</strong></div>` : ''}
                                                          <div>⚠️ Incidencia: <strong style="color:${c.incidencia === 'SI' ? 'var(--danger)' : 'var(--text-strong)'};">${c.incidencia || 'NO'}</strong></div>
                                                          ${c.incidenciaObs ? `<div style="word-break: break-word;">📝 Obs: <strong style="color:var(--text-strong);">${c.incidenciaObs}</strong></div>` : ''}
                                                          <div style="display:flex; gap:0.4rem; margin-top:0.2rem;">
                                                              ${c.fotoCargo ? `<img src="${c.fotoCargo}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(var(--ink-rgb), 0.1);">` : ''}
                                                              ${c.fotoLocal ? `<img src="${c.fotoLocal}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(var(--ink-rgb), 0.1);">` : ''}
                                                          </div>
                                                      </div>
                                                  `}
                                              </div>
                                          `).join('')}
                                      </div>
                                  ` : ''}
                              </div>
                          `;
                      }).join('')}
                  </div>
              </div>
          `;
      }

  };

  const filterHistoryItems = () => {
      const query = window._noRetailSearchQuery;
      document.querySelectorAll('.nr-history-row').forEach(row => {
          const text = row.textContent.toLowerCase();
          if (text.includes(query)) {
              row.style.display = 'block';
          } else {
              row.style.display = 'none';
          }
      });
  };


      // Dedicated Edit Modal Dialog for Liquidated Clients
      const openEditClientModal = (c) => {
          const backdrop = document.createElement('div');
          backdrop.className = 'nr-modal-backdrop';
          backdrop.style.position = 'fixed';
          backdrop.style.top = '0';
          backdrop.style.left = '0';
          backdrop.style.width = '100vw';
          backdrop.style.height = '100vh';
          backdrop.style.backgroundColor = 'rgba(var(--bg-rgb), 0.85)';
          backdrop.style.backdropFilter = 'blur(12px)';
          backdrop.style.display = 'flex';
          backdrop.style.justifyContent = 'center';
          backdrop.style.alignItems = 'center';
          backdrop.style.zIndex = '999999';
          backdrop.style.opacity = '0';
          backdrop.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

          // Temp states for modal inputs
          let tempCobroFlete = c.cobroFlete || 'NO';
          let tempGasto = c.gasto || '';
          let tempStatus = c.status || 'PENDIENTE';
          let tempIncidencia = c.incidencia || 'NO';
          let tempIncidenciaObs = c.incidenciaObs || '';
          let tempFotoCargo = c.fotoCargo || null;
          let tempFotoLocal = c.fotoLocal || null;

          backdrop.innerHTML = `
              <div class="glass-panel" style="
                  width: 92%;
                  max-width: 450px;
                  max-height: 90vh;
                  overflow-y: auto;
                  padding: 1.5rem;
                  border-radius: 20px;
                  background: linear-gradient(135deg, rgba(var(--card-rgb), 0.95) 0%, rgba(var(--bg-rgb), 0.98) 100%);
                  border: 1px solid rgba(var(--ink-rgb), 0.08);
                  box-shadow: 0 25px 50px -12px rgba(var(--shadow-rgb), 0.5), 0 0 30px rgba(var(--blue-rgb), 0.2);
                  display: flex;
                  flex-direction: column;
                  gap: 1.2rem;
                  transform: scale(0.9);
                  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                  box-sizing: border-box;
              ">
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(var(--ink-rgb), 0.08); padding-bottom:0.6rem;">
                      <h3 style="margin:0; color:var(--text-strong); font-size:var(--t-lg); font-weight:900;">✏️ CORREGIR LIQUIDACIÓN</h3>
                      <span id="btn_modal_close" style="color:rgba(var(--ink-rgb), 0.4); font-size:var(--t-lg); cursor:pointer; font-weight:bold;">&times;</span>
                  </div>

                  <div style="font-size:var(--t-xs); color:var(--text-muted); display:flex; flex-direction:column; gap:2px;">
                      <div>Cliente: <strong style="color:var(--text-strong);">${c.clientName}</strong></div>
                      <div>Pedido: <strong style="color:var(--text-strong);">${c.pedido}</strong> | Agencia: <strong style="color:var(--text-strong);">${c.agencia}</strong></div>
                  </div>

                  <!-- Cobro Flete -->
                  <div class="fila-entre">
                      <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">💰 COBRO FLETE:</span>
                      <div style="display:flex; background:rgba(var(--ink-rgb), 0.03); border-radius:8px; padding:2px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                          <button id="modal-flete-si" style="background:${tempCobroFlete === 'SI' ? 'var(--blue-deep)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 12px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">SI</button>
                          <button id="modal-flete-no" style="background:${tempCobroFlete === 'NO' ? 'var(--blue-deep)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 12px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO</button>
                      </div>
                  </div>

                  <!-- Gasto -->
                  <div class="fila-entre">
                      <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">💸 GASTO:</span>
                      <input type="number" step="0.01" min="0" id="modal-gasto-input" placeholder="S/ 0.00" value="${tempGasto}" style="background:rgba(var(--shadow-rgb), 0.3); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:6px 10px; border-radius:6px; outline:none; font-size:var(--t-xs); font-family:inherit; width:100px; text-align:right;">
                  </div>

                  <!-- Estado -->
                  <div>
                      <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700; margin-bottom:0.4rem;">📋 ESTADO DE ENTREGA:</div>
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                          <button id="modal-status-atendido" style="background:${tempStatus === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${tempStatus === 'ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${tempStatus === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:6px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">ATENDIDO</button>
                          <button id="modal-status-no-atendido" style="background:${tempStatus === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${tempStatus === 'NO ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${tempStatus === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:6px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO ATENDIDO</button>
                          <button id="modal-status-reprogramar" style="background:${tempStatus === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.03)'}; color:${tempStatus === 'REPROGRAMAR' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)'}; border:1px solid ${tempStatus === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.08)'}; padding:6px 0; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer; grid-column: span 2;">REPROGRAMAR</button>
                      </div>
                  </div>

                  <!-- Incidencia -->
                  <div class="fila-entre">
                      <span style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">⚠️ ¿TIENE INCIDENCIA?</span>
                      <div style="display:flex; background:rgba(var(--ink-rgb), 0.03); border-radius:8px; padding:2px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                          <button id="modal-incidencia-si" style="background:${tempIncidencia === 'SI' ? 'var(--danger)' : 'transparent'}; color:${tempIncidencia === 'SI' ? 'var(--on-accent)' : 'var(--text-strong)'}; border:none; padding:3px 12px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">SI</button>
                          <button id="modal-incidencia-no" style="background:${tempIncidencia === 'NO' ? 'var(--text-faint)' : 'transparent'}; color:var(--text-strong); border:none; padding:3px 12px; border-radius:6px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">NO</button>
                      </div>
                  </div>

                  <!-- Observaciones -->
                  <div style="display:flex; flex-direction:column; gap:0.3rem;">
                      <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700;">📝 OBSERVACIONES DE TRANSPORTE:</div>
                      <textarea id="modal-obs-textarea" rows="2" placeholder="Describa aquí observaciones..." style="background:rgba(var(--shadow-rgb), 0.3); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:6px 10px; border-radius:8px; outline:none; font-size:var(--t-sm); font-family:inherit; width:100%; box-sizing:border-box; resize:none;">${tempIncidenciaObs}</textarea>
                  </div>

                  <!-- Fotos -->
                  <div>
                      <div style="font-size:var(--t-xs); color:var(--text-strong); font-weight:700; margin-bottom:0.4rem;">📸 FOTOS OBLIGATORIAS:</div>
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                          <!-- Photo Cargo -->
                          <label style="background:rgba(var(--ink-rgb), 0.02); border:1px dashed rgba(var(--ink-rgb), 0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; position:relative;">
                              <div id="modal-cargo-preview" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                                  ${tempFotoCargo ? `<img src="${tempFotoCargo}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); font-weight:700;">📸 FOTO CARGO</span>`}
                              </div>
                              <input type="file" id="modal-cargo-input" accept="image/*" capture="environment" style="display:none;">
                          </label>

                          <!-- Photo Fachada -->
                          <label style="background:rgba(var(--ink-rgb), 0.02); border:1px dashed rgba(var(--ink-rgb), 0.1); border-radius:8px; padding:0.5rem; text-align:center; cursor:pointer; min-height:80px; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; position:relative;">
                              <div id="modal-local-preview" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                                  ${tempFotoLocal ? `<img src="${tempFotoLocal}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">` : `<span style="font-size:var(--t-xs); color:rgba(var(--ink-rgb), 0.4); font-weight:700;">📸 FOTO FACHADA</span>`}
                              </div>
                              <input type="file" id="modal-local-input" accept="image/*" capture="environment" style="display:none;">
                          </label>
                      </div>
                  </div>

                  <!-- Acciones del Modal -->
                  <div style="display:flex; gap:0.6rem; border-top:1px solid rgba(var(--ink-rgb), 0.08); padding-top:0.8rem; margin-top:0.4rem;">
                      <button id="btn_modal_cancel" style="flex:1; background:rgba(var(--ink-rgb), 0.05); color:var(--text-soft); border:1px solid rgba(var(--ink-rgb), 0.15); padding:0.6rem; border-radius:8px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">CANCELAR</button>
                      <button id="btn_modal_save" style="flex:1; background:var(--success-alt); color:var(--on-accent); border:none; padding:0.6rem; border-radius:8px; font-size:var(--t-xs); font-weight:800; cursor:pointer;">GUARDAR CAMBIOS</button>
                  </div>
              </div>
          `;

          document.body.appendChild(backdrop);
          setTimeout(() => {
              backdrop.style.opacity = '1';
              backdrop.querySelector('.glass-panel').style.transform = 'scale(1)';
          }, 10);

          // Event: Close / Cancel
          const closeModal = () => {
              backdrop.style.opacity = '0';
              backdrop.querySelector('.glass-panel').style.transform = 'scale(0.9)';
              setTimeout(() => { backdrop.remove(); }, 250);
          };
          backdrop.querySelector('#btn_modal_close').onclick = closeModal;
          backdrop.querySelector('#btn_modal_cancel').onclick = closeModal;

          // Event: Flete SI/NO
          const fleteSi = backdrop.querySelector('#modal-flete-si');
          const fleteNo = backdrop.querySelector('#modal-flete-no');
          fleteSi.onclick = () => {
              tempCobroFlete = 'SI';
              fleteSi.style.background = 'var(--blue-deep)';
              fleteNo.style.background = 'transparent';
          };
          fleteNo.onclick = () => {
              tempCobroFlete = 'NO';
              fleteNo.style.background = 'var(--blue-deep)';
              fleteSi.style.background = 'transparent';
          };

          // Event: Status selector buttons
          const btnAtendido = backdrop.querySelector('#modal-status-atendido');
          const btnNoAtendido = backdrop.querySelector('#modal-status-no-atendido');
          const btnReprogramar = backdrop.querySelector('#modal-status-reprogramar');

          const setStatus = (status) => {
              tempStatus = status;
              btnAtendido.style.background = status === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.03)';
              btnAtendido.style.color = status === 'ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)';
              btnAtendido.style.borderColor = status === 'ATENDIDO' ? 'var(--success)' : 'rgba(var(--ink-rgb), 0.08)';

              btnNoAtendido.style.background = status === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.03)';
              btnNoAtendido.style.color = status === 'NO ATENDIDO' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)';
              btnNoAtendido.style.borderColor = status === 'NO ATENDIDO' ? 'var(--danger)' : 'rgba(var(--ink-rgb), 0.08)';

              btnReprogramar.style.background = status === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.03)';
              btnReprogramar.style.color = status === 'REPROGRAMAR' ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.6)';
              btnReprogramar.style.borderColor = status === 'REPROGRAMAR' ? 'var(--yellow-deep)' : 'rgba(var(--ink-rgb), 0.08)';
          };
          btnAtendido.onclick = () => setStatus('ATENDIDO');
          btnNoAtendido.onclick = () => setStatus('NO ATENDIDO');
          btnReprogramar.onclick = () => setStatus('REPROGRAMAR');

          // Event: Incidencia SI/NO
          const incSi = backdrop.querySelector('#modal-incidencia-si');
          const incNo = backdrop.querySelector('#modal-incidencia-no');
          incSi.onclick = () => {
              tempIncidencia = 'SI';
              incSi.style.background = 'var(--danger)';
              incNo.style.background = 'transparent';
          };
          incNo.onclick = () => {
              tempIncidencia = 'NO';
              incNo.style.background = 'var(--text-faint)';
              incSi.style.background = 'transparent';
          };

          // Events: File inputs (Photos)
          const handlePhotoInput = (inputEl, previewId, type) => {
              inputEl.onchange = (event) => {
                  const file = event.target.files[0];
                  if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                          const img = new Image();
                          img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 600;
                              const MAX_HEIGHT = 600;
                              let width = img.width;
                              let height = img.height;
                              if (width > height) {
                                  if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                              } else {
                                  if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);

                              if (type === 'cargo') tempFotoCargo = compressedBase64;
                              else tempFotoLocal = compressedBase64;

                              backdrop.querySelector('#' + previewId).innerHTML = `<img src="${compressedBase64}" style="width:100%; height:80px; object-fit:cover; border-radius:6px;">`;
                          };
                          img.src = e.target.result;
                      };
                      reader.readAsDataURL(file);
                  }
              };
          };
          handlePhotoInput(backdrop.querySelector('#modal-cargo-input'), 'modal-cargo-preview', 'cargo');
          handlePhotoInput(backdrop.querySelector('#modal-local-input'), 'modal-local-preview', 'local');

          // Event: Save Changes
          backdrop.querySelector('#btn_modal_save').onclick = async () => {
              tempGasto = backdrop.querySelector('#modal-gasto-input').value;
              tempIncidenciaObs = backdrop.querySelector('#modal-obs-textarea').value;

              if (tempStatus === 'PENDIENTE') {
                  showPremiumAlert('SELECCIONA UN ESTADO', 'Debes seleccionar un estado (ATENDIDO, NO ATENDIDO o REPROGRAMAR) para guardar la liquidación.', 'warning');
                  return;
              }
              if (tempStatus === 'ATENDIDO' && !tempFotoCargo) {
                  showPremiumAlert('FOTO OBLIGATORIA', 'Es obligatorio tomar la foto de los cargos para guardar en estado ATENDIDO.', 'warning');
                  return;
              }

              // Apply changes to client object
              c.status = tempStatus;
              c.statusDate = c.statusDate || new Date().toISOString();
              c.liquidated = true;
              c.cobroFlete = tempCobroFlete;
              c.gasto = tempGasto;
              c.incidencia = tempIncidencia;
              c.incidenciaObs = tempIncidenciaObs;
              c.fotoCargo = tempFotoCargo;
              c.fotoLocal = tempFotoLocal;

              // Save to local cache
              try {
                  let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                  cache[c.id] = { 
                      status: c.status, 
                      date: c.statusDate, 
                      liquidated: true,
                      cobroFlete: c.cobroFlete,
                      gasto: c.gasto,
                      incidencia: c.incidencia,
                      incidenciaObs: c.incidenciaObs,
                      fotoCargo: c.fotoCargo,
                      fotoLocal: c.fotoLocal
                  };
                  localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
              } catch(err) {
                  console.error("Cache limit, saving without images:", err);
                  try {
                      let cache = JSON.parse(localStorage.getItem('nr_cache_v1') || '{}');
                      cache[c.id] = { 
                          status: c.status, 
                          date: c.statusDate, 
                          liquidated: true,
                          cobroFlete: c.cobroFlete
                      };
                      localStorage.setItem('nr_cache_v1', JSON.stringify(cache));
                  } catch(e) {}
              }

              // Sync delta to server
              const delta = {};
              delta[c.id] = { 
                  status: c.status, 
                  date: c.statusDate, 
                  liquidated: true,
                  cobroFlete: c.cobroFlete,
                  gasto: c.gasto,
                  incidencia: c.incidencia,
                  incidenciaObs: c.incidenciaObs,
                  fotoCargo: c.fotoCargo,
                  fotoLocal: c.fotoLocal
              };
              fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(delta)
              }).catch(err => console.error("Sync edit to server failed:", err));

              closeModal();
              showPremiumAlert('LIQUIDACIÓN ACTUALIZADA', `Se corrigió la liquidación del cliente ${c.clientName} con éxito.`, 'success');
              refreshNoRetailUI();
          };
      };

      // Event delegation to capture clicks on liquidated client cards (Inicio) or history rows (Historial) - Bind only once!
      if (!container._hasClickEditListener) {
          container._hasClickEditListener = true;
          container.addEventListener('click', async (e) => {
              const historyRow = e.target.closest('.nr-history-client-row');
              const liquidatedCard = e.target.closest('.nr-liquidated-client-card');
              const targetEl = historyRow || liquidatedCard;
              if (targetEl) {
                  const cId = targetEl.dataset.client;
                  const c = window._noRetailClients.find(x => x.id === cId);
                  if (c) {
                      if (c.fotoCargo === 'present' || c.fotoLocal === 'present') {
                          showNRPhotoLoader(true);
                          try {
                              const fetchPhoto = async (type) => {
                                  const res = await fetch(`https://logistics-backend-wv0x.onrender.com/api/logistics/no_retail_cache/photo?client_id=${cId}&photo_type=${type}`);
                                  if (res.ok) {
                                      const json = await res.json();
                                      if (json.status === 'success') return json.photo;
                                  }
                                  return null;
                              };
                              const [cargo, local] = await Promise.all([
                                  c.fotoCargo === 'present' ? fetchPhoto('fotoCargo') : Promise.resolve(c.fotoCargo),
                                  c.fotoLocal === 'present' ? fetchPhoto('fotoLocal') : Promise.resolve(c.fotoLocal)
                              ]);
                              if (cargo) c.fotoCargo = cargo;
                              if (local) c.fotoLocal = local;
                          } catch (err) {
                              console.error(err);
                          } finally {
                              showNRPhotoLoader(false);
                          }
                      }
                      openEditClientModal(c);
                  }
              }
          });
      }

  refreshNoRetailUI();
};
