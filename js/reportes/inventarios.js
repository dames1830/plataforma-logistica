/**
 * INVENTARIOS
 *
 * Vivia adentro de `renderDashboard`, en `dashboard_v28.js`. Se saco el
 * 02-sep-2026, tercera de las cinco pantallas que Daniel pidio mover: ese
 * archivo son 40.700 lineas que el navegador baja y compila ENTERAS aunque solo
 * se abra Inicio. Ahora esto llega con `await import(...)` al entrar al modulo.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ POR QUE `ENT` SE ATA UNA VEZ Y NO VIAJA EN CADA LLAMADA                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Esta pantalla SE REDIBUJA A SI MISMA DIECISEIS VECES —cada boton, cada
 * pestana de adentro, cada guardado vuelven a llamarla— y no siempre igual: unas
 * con `container`, otras buscando el destino con `getElementById(...)`. Meterle
 * el parametro a las dieciseis a mano es dieciseis oportunidades de saltarse una,
 * y la que se salte anda en la primera vuelta y revienta en la segunda.
 *
 * Asi que la puerta de entrada es `montarInventarios`, que guarda el entorno una
 * sola vez, y las dieciseis llamadas de adentro quedaron EXACTAMENTE como
 * estaban. Es estado de modulo, si: uno solo, escrito en un unico sitio, y a
 * cambio el resto del archivo no se toco ni una linea.
 *
 * LO QUE ANTES LE LLEGABA GRATIS AHORA VA EN `ENT`:
 *
 *   renderUploadArea()      el recuadro de "suelta el archivo aca", que usan
 *                           veintidos sitios mas del tablero
 *   showPremiumConfirm()    el cartel de confirmar
 *   updateERIUI_Unified()   refresca el resumen del ERI
 *   processERIAnalysis()    muele el archivo del ERI
 *   processReporteUCA()     y el del reporte UCA
 *   displayReporteUCA()     lo dibuja
 *
 * SE MUDO CON ELLA `activeModuloInvSub`, que se acuerda de en que pestana de
 * adentro se esta. Se usaba SOLO aca —se comprobo antes de tocarla— y sigue
 * siendo variable de modulo, asi que se acuerda entre un dibujo y otro igual que
 * antes.
 */

import { getAreaData, getCol, parseFile } from '../services_v245/csvHub_v6.js?v=29.0644';
import * as cyclicService from '../services_v245/cyclicCountService.js?v=29.0644';
import { getSession } from '../services_v245/auth.js?v=29.0644';

/* EL ENTORNO, ATADO UNA SOLA VEZ. Ver el porque en la cabecera: son dieciseis
   llamadas de la pantalla a si misma y no se le quiso poner el parametro a cada
   una. Se escribe en `montarInventarios` y en ningun otro sitio. */
let ENT = {};

/** La puerta de entrada. Es lo unico que llama el tablero. */
export const montarInventarios = (container, entorno) => {
    if (entorno) ENT = entorno;
    return renderModuloInventarios(container);
};

/* En que pestana de adentro esta parado el modulo. Venia de `renderDashboard`,
   donde se usaba solo aca. */
let activeModuloInvSub = 'general';

const renderModuloInventarios = async (container) => {
  const l3Tabs = [
      { id: 'general', label: 'General', icon: '📝' },
      { id: 'ciclicos', label: 'Cíclicos', icon: '🔄' },
      { id: 'reportes', label: 'Reportes', icon: '📊' }
  ];

  container.innerHTML = `
      <div style="background:rgba(var(--bg-rgb), 0.3); border-radius:12px; padding:1rem; border:1px solid rgba(var(--ink-rgb), 0.05);">
          <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(var(--ink-rgb), 0.05);">
              ${l3Tabs.map(t => `
                  <a class="l3-nav-item ${activeModuloInvSub===t.id?'active':''}" data-id="${t.id}" style="padding: 0.5rem 0.2rem; font-size:var(--t-sm); cursor:pointer; color:${activeModuloInvSub===t.id?'var(--brand-light)':'var(--text-muted)'}; font-weight:${activeModuloInvSub===t.id?'800':'400'}; border-bottom:${activeModuloInvSub===t.id?'2px solid var(--brand-light)':'none'};">
                      ${t.icon} ${t.label.toUpperCase()}
                  </a>
              `).join('')}
          </nav>
          <div id="moduloInvContent"></div>
      </div>
  `;

  document.querySelectorAll('.l3-nav-item').forEach(b => b.addEventListener('click', (e) => { 
      activeModuloInvSub = e.currentTarget.dataset.id; 
      renderModuloInventarios(container); 
  }));

  const content = document.getElementById('moduloInvContent');
  const [matriz, reserva, stock, articulos, serverConteos] = await Promise.all([
      getAreaData('matriz_ubicaciones'),
      getAreaData('stockReserva'),
      getAreaData('inventario'),
      getAreaData('articulos'),
      getAreaData('inventario_conteos', true)
  ]);
  if (!content.isConnected) return;

  // Mapa de conteos cerrados del servidor para sincronización global
  const serverConteoMap = new Map();
  if (serverConteos && Array.isArray(serverConteos)) {
      serverConteos.forEach(r => { if (r.location) serverConteoMap.set(r.location, r); });
  }

  // Función helper para sincronizar conteos cerrados al servidor
  const syncConteoToServer = () => {
      try {
          const allScans = cyclicService.getScans();
          const allTasks = cyclicService.getTasks();
          const allClosed = cyclicService.getClosedLocations();
          const payload = allTasks
              .filter(t => allClosed.includes(t.location))
              .map(t => ({
                  location: t.location,
                  scans: allScans.filter(s => s.location === t.location),
                  closedAt: Date.now(),
                  closedBy: t.user || 'operario'
              }));
          if (payload.length > 0) {
              fetch('https://logistics-backend-wv0x.onrender.com/api/logistics/inventario_conteos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Environment': 'production' },
                  body: JSON.stringify(payload)
              }).catch(err => console.warn('[CONTEO] Sync falló:', err));
          }
      } catch(err) { console.warn('[CONTEO] Error al preparar sync:', err); }
  };

  // Construir mapa de Código de Barras a SKU para traducción instantánea en el escaneo
  const barcodeToSkuMap = new Map();
  if (articulos && articulos.length > 0) {
      articulos.forEach(a => {
          const raw = Array.isArray(a) ? a : Object.values(a);
          if (raw.length >= 2) {
              const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || raw[1] || '').toString().trim().toUpperCase();
              const possibleBarcode = String(raw[0] || '').trim().toUpperCase();
              if (mSku && possibleBarcode) {
                  barcodeToSkuMap.set(possibleBarcode, mSku);
              }

              // Inspeccionar otras celdas por si acaso (ej. si la columna de código de barras está en otra posición)
              raw.forEach(cell => {
                  const cellStr = String(cell || '').trim();
                  if (/^\d{8,15}$/.test(cellStr) && mSku) {
                      barcodeToSkuMap.set(cellStr, mSku);
                  }
              });
          }
      });
      console.log(`[PULSE] Mapeo de códigos de barra cargado. Total códigos registrados: ${barcodeToSkuMap.size}`);
  }

  if (activeModuloInvSub === 'general') {
      const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; content.appendChild(wrap);
      // Agregamos info visual de que se nutre de Archivo Inventario
      wrap.innerHTML += `<div style="margin-top:1rem; padding:0.8rem; background:rgba(var(--brand-rgb), 0.05); border-radius:8px; border:1px dashed rgba(var(--brand-rgb), 0.2); font-size:var(--t-xs); color:var(--brand-light); text-align:center;">ℹ️ Este módulo utiliza automáticamente la Matriz, Stock y Artículos cargados en 'ARCHIVO INVENTARIO'.</div>`;
  } 
  else if (activeModuloInvSub === 'ciclicos') {
      const session = getSession();
      const isAdmin = session && (session.role === 'admin' || session.role === 'jefe');
      const activeLocation = localStorage.getItem('eru_active_location');

      // MODO ESCANEO (Compartido para Admin y Operario)
      if (activeLocation) {
          const scans = cyclicService.getScansByLocation(activeLocation);
          const totalScans = scans.reduce((acc, curr) => acc + curr.qty, 0);

          content.innerHTML = `
              <div style="padding:0.5rem; text-align:center;">
                  <button id="btn_back_locs" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--t-sm); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">< Volver a lista</button>

                  <div style="background:rgba(var(--sky-rgb), 0.1); border:1px solid rgba(var(--sky-rgb), 0.3); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem;">
                      <h2 style="color:var(--sky); margin:0 0 0.5rem 0; font-size:var(--t-2xl); font-weight:900;">${activeLocation}</h2>
                      <p style="margin:0; font-size:var(--t-sm); color:var(--text-strong);">Pistolee los SKUs físicos ahora</p>
                      <h1 style="color:var(--text-strong); font-size:var(--t-2xl); margin:1rem 0 0 0;" id="scan_counter">${totalScans}</h1>
                      <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted); text-transform:uppercase;">Artículos leídos</p>
                  </div>

                  <div style="display:flex; flex-direction:column; gap:1rem;">
                      <button id="btn_close_loc" class="btn-premium-pulse" style="padding:15px; font-size:var(--t-lg); background:linear-gradient(135deg, var(--success-deep), var(--success-alt)); color:var(--text-strong); border:none; border-radius:8px; font-weight:800; cursor:pointer;">🔒 CERRAR UBICACIÓN</button>
                  </div>
                  <input type="text" id="sku_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
              </div>
          `;

          document.getElementById('btn_back_locs').onclick = () => {
              localStorage.removeItem('eru_active_location');
              renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
          };

          document.getElementById('btn_close_loc').onclick = async () => {
              if(await ENT.showPremiumConfirm('CERRAR UBICACIÓN', '¿Seguro que deseas cerrar esta ubicación? Ya no podrás pistolear más SKUs aquí.', 'warning')) {
                  cyclicService.closeLocation(activeLocation);
                  syncConteoToServer();
                  localStorage.removeItem('eru_active_location');
                  renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
              }
          };

          const playBeep = () => {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.connect(gainNode);
              gainNode.connect(ctx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(800, ctx.currentTime);
              gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
              osc.start();
              osc.stop(ctx.currentTime + 0.1);
          };

          const skuInput = document.getElementById('sku_scanner_input');
          if(skuInput) {
              skuInput.focus({ preventScroll: true });
              const focusHandler = () => {
                  if (document.getElementById('sku_scanner_input')) {
                      skuInput.focus({ preventScroll: true });
                  } else {
                      document.removeEventListener('click', focusHandler);
                  }
              };
              document.addEventListener('click', focusHandler);
              skuInput.addEventListener('keydown', (e) => {
                  if(e.key === 'Enter') {
                      const code = skuInput.value.trim();
                      skuInput.value = '';
                      if(code) {
                          playBeep();

                          // Traducir código de barras a SKU real si existe en el maestro
                          let translatedCode = code;
                          if (barcodeToSkuMap && barcodeToSkuMap.has(code.toUpperCase())) {
                              translatedCode = barcodeToSkuMap.get(code.toUpperCase());
                              console.log(`[ESCANER] Traduciendo código de barras ${code} a SKU ${translatedCode}`);
                          }

                          cyclicService.saveScan(activeLocation, translatedCode);
                          const currentCount = parseInt(document.getElementById('scan_counter').innerText) || 0;
                          document.getElementById('scan_counter').innerText = currentCount + 1;
                      }
                  }
              });
          }
      } 
      else if (isAdmin) {
          // VISTA ADMINISTRADOR (Panel Central)
          const currentTasks = cyclicService.getTasks();
          const activeCount = currentTasks.length;
          const statusHtml = activeCount > 0 
              ? `<div style="margin-top:1rem; padding:0.8rem; background:rgba(var(--success-alt-rgb), 0.1); border:1px solid rgba(var(--success-alt-rgb), 0.3); border-radius:8px; color:var(--success-alt); font-size:var(--t-md); font-weight:bold; text-align:center;">🟢 TAREA ACTIVA EN PISO: ${activeCount} ubicaciones pendientes</div>` 
              : `<div style="margin-top:1rem; padding:0.8rem; background:rgba(var(--ink-rgb), 0.05); border-radius:8px; color:var(--text-muted); font-size:var(--t-md); text-align:center;">No hay tareas activas.</div>`;

          // Construir mapa de Stock de Sistema por ubicación para cálculo en vivo del Monitor
          const systemStockMap = new Map();
          if (stock && stock.length > 0) {
              stock.forEach(row => {
                  const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
                  const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;
                  if (ubi) {
                      systemStockMap.set(ubi, (systemStockMap.get(ubi) || 0) + qty);
                  }
              });
          }

          content.innerHTML = `
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                  <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(var(--ink-rgb), 0.05); background:rgba(var(--bg-rgb), 0.2);">
                      <h3 style="color:var(--text-strong); margin:0 0 1rem 0; font-size:var(--t-lg);">📂 1. Asignar Tarea Cíclica</h3>
                      <div id="ciclico_upload_area"></div>
                      <div id="admin_task_status">${statusHtml}</div>
                  </div>

                  <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(var(--success-alt-rgb), 0.2); background:rgba(var(--bg-rgb), 0.2); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                      <h3 style="color:var(--success-alt); margin:0 0 1rem 0; font-size:var(--t-lg);">⚡ 2. Ejecutar Cruce (ERU)</h3>
                      <p style="font-size:var(--t-sm); color:var(--text-muted); margin-bottom:1.5rem;">Cruza las lecturas en vivo de los operarios contra los archivos maestros.</p>
                      <button id="btn_sync_eru" class="btn-premium-pulse" style="width:100%; max-width:300px; padding:12px 20px; font-size:var(--t-md); background:linear-gradient(135deg, var(--success-deep), var(--success-alt)); color:var(--text-strong); border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(var(--success-alt-rgb), 0.3);">🔄 SINCRONIZAR Y CRUZAR</button>
                  </div>
              </div>

              <div class="glass-panel" style="margin-top:1.5rem; padding:1.5rem; border-radius:15px; border:1px solid rgba(var(--ink-rgb), 0.05); background:rgba(var(--bg-rgb), 0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                      <h3 style="color:var(--text-strong); margin:0; font-size:var(--t-lg);">📋 Monitor de Tareas en Vivo</h3>
                      <button id="btn_refresh_live_monitor" class="btn-premium-pulse" style="padding:6px 15px; font-size:var(--t-sm); background:rgba(var(--ink-rgb), 0.1); color:var(--text-strong); border:1px solid rgba(var(--ink-rgb), 0.2); border-radius:8px; cursor:pointer;">🔄 Actualizar Estado</button>
                  </div>
                  <div id="admin_live_monitor" style="overflow-x:auto;">
                      ${activeCount > 0 ? `
                          <table class="modern-table" style="width:100%; text-align:left; border-collapse:collapse;">
                              <thead>
                                  <tr style="border-bottom:1px solid rgba(var(--ink-rgb), 0.1); color:var(--brand-light);">
                                      <th style="padding:10px; text-align:center;">#</th>
                                      <th style="padding:10px;">Ubicación</th>
                                      <th style="padding:10px; text-align:center;">Estado</th>
                                      <th style="padding:10px; text-align:center; color:var(--yellow-deep);">Qty Sistema</th>
                                      <th style="padding:10px; text-align:center; color:var(--sky);">Qty Conteo</th>
                                      <th style="padding:10px; text-align:center;">Diferencia</th>
                                      <th style="padding:10px; text-align:center; color:var(--success-alt);">% Exactitud</th>
                                      <th style="padding:10px; text-align:center;">Usuario</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${currentTasks.map((t, i) => {
                                      const isClosed = cyclicService.isLocationClosed(t.location) || serverConteoMap.has(t.location);
                                      const badge = isClosed
                                          ? '<span style="background:rgba(var(--success-alt-rgb), 0.2); color:var(--success-alt); padding:3px 8px; border-radius:12px; font-size:var(--t-xs); font-weight:bold;">CERRADA 🔒</span>'
                                          : '<span style="background:rgba(var(--warning-rgb), 0.2); color:var(--warning); padding:3px 8px; border-radius:12px; font-size:var(--t-xs); font-weight:bold;">EN PROCESO ⏳</span>';

                                      // 1. Qty Sistema
                                      const qSis = systemStockMap.get(t.location.toUpperCase()) || 0;

                                      // 2. Qty Conteo (local si está cerrado localmente, servidor si está cerrado remotamente)
                                      const locationScans = !cyclicService.isLocationClosed(t.location) && serverConteoMap.has(t.location)
                                          ? (serverConteoMap.get(t.location).scans || [])
                                          : cyclicService.getScansByLocation(t.location);
                                      const scansCount = locationScans.reduce((acc, curr) => acc + curr.qty, 0);

                                      // 3. Qty Diferencia
                                      const diff = scansCount - qSis;
                                      let diffBadge = '-';
                                      if (diff > 0) {
                                          diffBadge = `<span style="color:var(--success-alt); font-weight:bold;">+${diff}</span>`;
                                      } else if (diff < 0) {
                                          diffBadge = `<span style="color:var(--danger); font-weight:bold;">${diff}</span>`;
                                      } else {
                                          diffBadge = `<span class="txt-suave">0</span>`;
                                      }

                                      // 4. % Exactitud
                                      const acc = qSis === scansCount ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, scansCount || 1))) * 100;
                                      const accFormatted = Math.max(0, acc).toFixed(1) + '%';
                                      let accColor = 'var(--danger)'; // Red for low
                                      if (acc >= 95) accColor = 'var(--success-alt)'; // Green for high
                                      else if (acc >= 75) accColor = 'var(--warning)'; // Amber for mid

                                      // 5. Usuario
                                      const lastScanner = locationScans.length > 0 ? (locationScans[locationScans.length - 1].user || 'operario') : '-';
                                      const userDisplay = isClosed 
                                          ? `<span style="color:var(--success-alt); font-weight:bold;">👤 ${t.user || lastScanner}</span>`
                                          : (locationScans.length > 0 ? `<span style="color:var(--warning);">👤 ${lastScanner} ✍️</span>` : '<span style="color:var(--text-dim);">-</span>');

                                      return `
                                      <tr class="admin-loc-row" data-loc="${t.location}" data-closed="${isClosed}" style="border-bottom:1px solid rgba(var(--ink-rgb), 0.05); cursor:pointer;" title="Clic para entrar a Modo Escáner">
                                          <td style="padding:10px; text-align:center; color:var(--text-muted);">${i + 1}</td>
                                          <td style="padding:10px; color:var(--text-strong); font-weight:bold;">${t.location}</td>
                                          <td style="padding:10px; text-align:center;">${badge}</td>
                                          <td style="padding:10px; text-align:center; color:var(--yellow-deep); font-weight:bold;">${qSis}</td>
                                          <td style="padding:10px; text-align:center; color:var(--sky); font-weight:bold;">${scansCount}</td>
                                          <td style="padding:10px; text-align:center;">${diffBadge}</td>
                                          <td style="padding:10px; text-align:center; color:${accColor}; font-weight:bold;">${accFormatted}</td>
                                          <td style="padding:10px; text-align:center;">${userDisplay}</td>
                                      </tr>
                                      `;
                                  }).join('')}
                              </tbody>
                          </table>
                      ` : `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:var(--t-sm); font-style:italic;">No hay ubicaciones asignadas. Sube un archivo para comenzar.</div>`}
                  </div>
              </div>
              <!-- Scanner oculto para que la pistola despierte el modo escaner desde el Admin Panel -->
              <input type="text" id="zebra_scanner_input_admin" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
          `;

          ENT.renderUploadArea(document.getElementById('ciclico_upload_area'), 'conteo_ciclico_tarea', null, '.csv, .xlsx', 'SUBIR UBICACIONES (TAREA)');

          const input = document.getElementById('up_conteo_ciclico_tarea');
          if (input) {
              input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  try {
                      const data = await parseFile(file, 'conteo_ciclico_tarea');
                      if (data && data.length > 0) {
                          let locations = [];
                          if (Array.isArray(data[0])) {
                              const headerRow = data[0].map(h => String(h).toUpperCase().trim());
                              const ubiIndex = headerRow.findIndex(h => h === 'UBICACION' || h === 'UBICACIÓN');
                              if (ubiIndex === -1) { alert('❌ Error: No se encontró la columna "UBICACION" en la fila 1.'); return; }
                              for (let i = 1; i < data.length; i++) {
                                  if (data[i] && data[i][ubiIndex]) locations.push(String(data[i][ubiIndex]).trim());
                              }
                          } else {
                              locations = data.map(d => String(d.ubicacion || d.Ubicacion || d.UBICACION || d.UBICACIÓN || '').trim()).filter(Boolean);
                          }
                          const uniqueLocs = [...new Set(locations)];
                          if (uniqueLocs.length === 0) { alert('⚠️ No se encontraron ubicaciones válidas.'); return; }
                          const tasks = uniqueLocs.map(loc => ({ location: loc, status: 'pending' }));
                          cyclicService.saveTasks(tasks);
                          document.getElementById('admin_task_status').innerHTML = `<div style="margin-top:1rem; padding:0.8rem; background:rgba(var(--success-alt-rgb), 0.1); border:1px solid rgba(var(--success-alt-rgb), 0.3); border-radius:8px; color:var(--success-alt); font-size:var(--t-md); font-weight:bold; text-align:center;">🟢 TAREA ACTIVA EN PISO: ${tasks.length} ubicaciones pendientes</div>`;
                          alert('✅ Tarea de ' + tasks.length + ' ubicaciones asignada con éxito.');
                          renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                      }
                  } catch(err) { alert(err); }
              };
          }

          // Click listener for Admin table rows
          document.querySelectorAll('.admin-loc-row').forEach(el => {
              el.onclick = () => {
                  if(el.dataset.closed === 'true') {
                      alert('Esta ubicación ya está cerrada.');
                      return;
                  }
                  localStorage.setItem('eru_active_location', el.dataset.loc);
                  renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
              };
          });

          // Auto-detect scanner input from Admin view
          const adminScannerInput = document.getElementById('zebra_scanner_input_admin');
          if(adminScannerInput) {
              adminScannerInput.focus({ preventScroll: true });
              const focusHandler = () => {
                  if (document.getElementById('zebra_scanner_input_admin')) {
                      adminScannerInput.focus({ preventScroll: true });
                  } else {
                      document.removeEventListener('click', focusHandler);
                  }
              };
              document.addEventListener('click', focusHandler);
              adminScannerInput.addEventListener('keydown', (e) => {
                  if(e.key === 'Enter') {
                      const code = adminScannerInput.value.trim();
                      adminScannerInput.value = '';
                      const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
                      const t = currentTasks.find(x => x.location.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase() === cleanCode);
                      if(t) {
                          if(cyclicService.isLocationClosed(t.location) || serverConteoMap.has(t.location)) {
                              alert('Ubicación Cerrada.');
                          } else {
                              localStorage.setItem('eru_active_location', t.location);
                              renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                          }
                      } else {
                          alert('Ubicación no encontrada en la tarea actual.');
                      }
                  }
              });
          }

          const refreshBtn = document.getElementById('btn_refresh_live_monitor');
          if (refreshBtn) {
              refreshBtn.onclick = () => {
                  renderModuloInventarios(container);
              };
          }

          const syncBtn = document.getElementById('btn_sync_eru');
          if (syncBtn) {
              syncBtn.onclick = async () => {
                  // El cruce arranca yendo al servidor por el inventario: sin esto el boton
                  // se quedaba mudo ese rato y parecia colgado.
                  const textoOriginal = syncBtn.innerHTML;
                  syncBtn.disabled = true;
                  syncBtn.style.opacity = '0.7';
                  syncBtn.innerHTML = '⏳ CRUZANDO...';
                  try {
                      // 1. Obtener datos
                      const stockActivo = await getAreaData('inventario') || [];
                      const tasks = cyclicService.getTasks();
                      const scans = cyclicService.getScans();

                      if (tasks.length === 0) {
                          alert("⚠️ No hay tareas asignadas en el Monitor en Vivo para cruzar.");
                          return;
                      }

                      if (scans.length === 0) {
                          alert("⚠️ Los operarios no han realizado lecturas físicas aún.");
                          return;
                      }

                      // 2. Obtener maestro para descripciones
                      const maestro = await getAreaData('articulos') || [];
                      const maestroMap = new Map();
                      maestro.forEach(a => {
                          const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || '').toString().trim().toUpperCase();
                          const mDesc = (getCol(a, ['Descripcion', 'Descripción', 'Description', 'Desc']) || 'S/D').toString().trim();
                          if (mSku) maestroMap.set(mSku, mDesc);
                      });

                      // 3. Crear sets y mapas
                      const taskLocations = new Set(tasks.map(t => t.location.toUpperCase()));
                      const sistemaMap = new Map();
                      const descMap = new Map();

                      stockActivo.forEach(row => {
                          const sku = (getCol(row, ['SKU', 'Articulo', 'Artículo', 'Product', 'Producto']) || (Array.isArray(row) ? row[1] : '')).toString().trim().toUpperCase();
                          const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
                          const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;

                          // Escaneo inteligente de descripción
                          let desc = 'S/D';
                          if (typeof row === 'object' && !Array.isArray(row)) {
                              desc = getCol(row, ['Descripcion', 'Descripción', 'Description', 'DESCRIPCION', 'Articulo', 'Nombre']) || 'S/D';
                          } else if (Array.isArray(row)) {
                              desc = row[2] || row[4] || row[6] || row[7] || 'S/D';
                          }
                          desc = desc.toString().trim();

                          if (sku && taskLocations.has(ubi)) {
                              const key = `${sku}|${ubi}`;
                              sistemaMap.set(key, (sistemaMap.get(key) || 0) + qty);
                              if (desc && desc !== 'S/D') descMap.set(sku, desc);
                          }
                      });

                      const fisicoMap = new Map();
                      scans.forEach(s => {
                          let sku = s.sku.toString().trim().toUpperCase();

                          // Traducir código de barras a SKU real si existe en el maestro (para lecturas históricas)
                          if (barcodeToSkuMap && barcodeToSkuMap.has(sku)) {
                              sku = barcodeToSkuMap.get(sku);
                          }

                          const ubi = s.location.toString().trim().toUpperCase();
                          const qty = parseFloat(s.qty) || 0;

                          if (sku && taskLocations.has(ubi)) {
                              const key = `${sku}|${ubi}`;
                              fisicoMap.set(key, (fisicoMap.get(key) || 0) + qty);
                          }
                      });

                      // 4. Cruzar keys
                      const allKeys = new Set([...sistemaMap.keys(), ...fisicoMap.keys()]);
                      const eruResults = [];
                      let totalItems = 0;
                      let correctItems = 0;

                      allKeys.forEach(key => {
                          const [sku, ubi] = key.split('|');
                          const qSis = sistemaMap.get(key) || 0;
                          const qFis = fisicoMap.get(key) || 0;
                          const diff = qFis - qSis;

                          // Exactitud de Registro de Ubicación (ERU) por línea
                          const acc = qSis === qFis ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, qFis || 1))) * 100;

                          totalItems++;
                          if (diff === 0) correctItems++;

                          const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';

                          eruResults.push({
                              sku,
                              ubi,
                              desc: finalDesc,
                              sis: qSis,
                              fis: qFis,
                              diff,
                              eri: Math.max(0, acc).toFixed(1)
                          });
                      });

                      // Ordenar eruResults por ubicación
                      eruResults.sort((a, b) => a.ubi.localeCompare(b.ubi));

                      // 5. Cruzar por SKU (ERI)
                      const countedSkus = new Set(eruResults.map(r => r.sku));
                      const eriBySku = new Map();
                      countedSkus.forEach(sku => eriBySku.set(sku, { sis: 0, fis: 0 }));

                      eruResults.forEach(r => {
                          const entry = eriBySku.get(r.sku);
                          entry.sis += r.sis;
                          entry.fis += r.fis;
                      });

                      const eriResults = [];
                      let eriCorrect = 0;

                      eriBySku.forEach((vals, sku) => {
                          const diff = vals.fis - vals.sis;
                          if (diff === 0) eriCorrect++;
                          const acc = vals.sis === vals.fis ? 100 : (1 - (Math.abs(diff) / Math.max(vals.sis, vals.fis || 1))) * 100;

                          // Buscar ubicaciones de este SKU
                          const ubis = eruResults.filter(r => r.sku === sku).map(r => r.ubi);
                          const ubiText = ubis.length > 1 ? "VARIAS" : (ubis[0] || 'N/A');
                          const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';

                          eriResults.push({
                              sku,
                              ubi: ubiText,
                              desc: finalDesc,
                              sis: vals.sis,
                              fis: vals.fis,
                              diff,
                              eri: Math.max(0, acc).toFixed(1)
                          });
                      });

                      // Calcular consolidados globales
                      const finalERU = eruResults.length > 0 ? (eruResults.reduce((acc, r) => acc + parseFloat(r.eri || 0), 0) / eruResults.length).toFixed(1) : 0;
                      const finalERI = eriResults.length > 0 ? ((eriCorrect / eriResults.length) * 100).toFixed(1) : 0;

                      // 6. Guardar en global
                      window._lastERI = { eriResults, finalERI, eruResults, finalERU };

                      // 7. Cambiar de pestaña y re-renderizar
                      activeModuloInvSub = 'reportes';
                      renderModuloInventarios(container);

                      alert(`✅ ¡Cruce ERU / ERI realizado con éxito!\nERU: ${finalERU}%\nERI: ${finalERI}%`);

                  } catch(err) {
                      console.error("Error en cruce cíclico ERU:", err);
                      alert("❌ Error al procesar el cruce cíclico: " + err);
                  } finally {
                      syncBtn.disabled = false;
                      syncBtn.style.opacity = '';
                      syncBtn.innerHTML = textoOriginal;
                  }
              };
          }
      } else {
          // VISTA OPERARIO
          const activeLocation = localStorage.getItem('eru_active_location');
          const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+'A'.repeat(100)); // Short placeholder beep. In real env, we can synthesize one using Web Audio API

          if (!activeLocation) {
              // LISTA DE UBICACIONES
              content.innerHTML = `
                  <div style="padding:0.5rem;">
                      <div style="background:rgba(var(--success-alt-rgb), 0.1); border:1px solid rgba(var(--success-alt-rgb), 0.3); padding:1rem; border-radius:10px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                          <div>
                              <h2 style="color:var(--success-alt); margin:0; font-size:var(--t-lg);">🟢 MODO PISTOLEO ACTIVO</h2>
                              <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted);">Pistolea el código de una ubicación de la lista para empezar.</p>
                          </div>
                          <span style="font-size:var(--t-2xl);">🔫</span>
                      </div>

                      <h3 style="color:var(--text-strong); font-size:var(--t-lg); margin-bottom:1rem;">Ubicaciones Pendientes</h3>
                      <div id="operario_tasks_container" style="display:flex; flex-direction:column; gap:0.8rem;"></div>

                      <input type="text" id="zebra_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
                  </div>
              `;

              const tasks = cyclicService.getTasks();
              const container = document.getElementById('operario_tasks_container');
              if (tasks.length === 0) {
                  container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem; font-style:italic;">No hay ubicaciones asignadas por el Administrador.</div>';
              } else {
                  tasks.forEach(t => {
                      const isClosed = cyclicService.isLocationClosed(t.location) || serverConteoMap.has(t.location);
                      const color = isClosed ? 'var(--success-alt)' : 'var(--text-muted)';
                      const bg = isClosed ? 'rgba(var(--success-alt-rgb), 0.1)' : 'rgba(var(--ink-rgb), 0.05)';
                      const statusText = isClosed ? 'CERRADA 🔒' : 'PENDIENTE';
                      container.innerHTML += `
                          <div class="loc-item" data-loc="${t.location}" data-closed="${isClosed}" style="padding:1rem; background:${bg}; border-radius:8px; border:1px solid rgba(var(--ink-rgb), 0.05); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                              <span style="color:var(--text-strong); font-weight:bold; font-size:var(--t-lg);">${t.location}</span>
                              <span style="color:${color}; font-size:var(--t-sm); font-weight:800; letter-spacing:1px;">${statusText}</span>
                          </div>
                      `;
                  });
              }

              document.querySelectorAll('.loc-item').forEach(el => {
                  el.onclick = () => {
                      if(el.dataset.closed === 'true') {
                          alert('Esta ubicación ya fue contada y está cerrada. Solicite desbloqueo a Administración.');
                          return;
                      }
                      localStorage.setItem('eru_active_location', el.dataset.loc);
                      renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                  };
              });

              const scannerInput = document.getElementById('zebra_scanner_input');
              if(scannerInput) {
                  scannerInput.focus({ preventScroll: true });
                  const focusHandler = () => {
                      if (document.getElementById('zebra_scanner_input')) {
                          scannerInput.focus({ preventScroll: true });
                      } else {
                          document.removeEventListener('click', focusHandler);
                      }
                  };
                  document.addEventListener('click', focusHandler);
                  scannerInput.addEventListener('keydown', (e) => {
                      if(e.key === 'Enter') {
                          const code = scannerInput.value.trim();
                          scannerInput.value = '';
                          const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
                          const t = tasks.find(x => x.location.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase() === cleanCode);
                          if(t) {
                              if(cyclicService.isLocationClosed(t.location) || serverConteoMap.has(t.location)) {
                                  alert('Ubicación Cerrada.');
                              } else {
                                  localStorage.setItem('eru_active_location', t.location);
                                  renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                              }
                          } else {
                              alert('Ubicación no encontrada en la tarea actual.');
                          }
                      }
                  });
              }
          } else {
              // MODO ESCANEO (Ubicación Abierta)
              const scans = cyclicService.getScansByLocation(activeLocation);
              const totalScans = scans.reduce((acc, curr) => acc + curr.qty, 0);

              content.innerHTML = `
                  <div style="padding:0.5rem; text-align:center;">
                      <button id="btn_back_locs" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:var(--t-sm); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">< Volver a lista</button>

                      <div style="background:rgba(var(--sky-rgb), 0.1); border:1px solid rgba(var(--sky-rgb), 0.3); padding:1.5rem; border-radius:10px; margin-bottom:1.5rem;">
                          <h2 style="color:var(--sky); margin:0 0 0.5rem 0; font-size:var(--t-2xl); font-weight:900;">${activeLocation}</h2>
                          <p style="margin:0; font-size:var(--t-sm); color:var(--text-strong);">Pistolee los SKUs físicos ahora</p>
                          <h1 style="color:var(--text-strong); font-size:var(--t-2xl); margin:1rem 0 0 0;" id="scan_counter">${totalScans}</h1>
                          <p style="margin:0; font-size:var(--t-sm); color:var(--text-muted); text-transform:uppercase;">Artículos leídos</p>
                      </div>

                      <div style="display:flex; flex-direction:column; gap:1rem;">
                          <button id="btn_close_loc" class="btn-premium-pulse" style="padding:15px; font-size:var(--t-lg); background:linear-gradient(135deg, var(--success-deep), var(--success-alt)); color:var(--text-strong); border:none; border-radius:8px; font-weight:800; cursor:pointer;">🔒 CERRAR UBICACIÓN</button>
                      </div>
                      <input type="text" id="sku_scanner_input" style="position:fixed; top:0; left:0; width:0; height:0; opacity:0; border:none; overflow:hidden; pointer-events:none;" autocomplete="off">
                  </div>
              `;

              document.getElementById('btn_back_locs').onclick = () => {
                  localStorage.removeItem('eru_active_location');
                  renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
              };

              document.getElementById('btn_close_loc').onclick = async () => {
                  if(await ENT.showPremiumConfirm('CERRAR UBICACIÓN', '¿Seguro que deseas cerrar esta ubicación? Ya no podrás pistolear más SKUs aquí.', 'warning')) {
                      cyclicService.closeLocation(activeLocation);
                      syncConteoToServer();
                      localStorage.removeItem('eru_active_location');
                      renderModuloInventarios(document.getElementById('inventarioLevel2Content') || document.querySelector('.main-content'));
                  }
              };

              // Play beep using Web Audio API for guaranteed cross-browser sound without external files
              const playBeep = () => {
                  const ctx = new (window.AudioContext || window.webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gainNode = ctx.createGain();
                  osc.connect(gainNode);
                  gainNode.connect(ctx.destination);
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(800, ctx.currentTime);
                  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.1);
              };

              const skuInput = document.getElementById('sku_scanner_input');
              if(skuInput) {
                  skuInput.focus({ preventScroll: true });
                  const focusHandler = () => {
                      if (document.getElementById('sku_scanner_input')) {
                          skuInput.focus({ preventScroll: true });
                      } else {
                          document.removeEventListener('click', focusHandler);
                      }
                  };
                  document.addEventListener('click', focusHandler);
                  skuInput.addEventListener('keydown', (e) => {
                      if(e.key === 'Enter') {
                          const code = skuInput.value.trim();
                          skuInput.value = '';
                          if(code) {
                              playBeep();

                              // Traducir código de barras a SKU real si existe en el maestro
                              let translatedCode = code;
                              if (barcodeToSkuMap && barcodeToSkuMap.has(code.toUpperCase())) {
                                  translatedCode = barcodeToSkuMap.get(code.toUpperCase());
                                  console.log(`[ESCANER] Traduciendo código de barras ${code} a SKU ${translatedCode}`);
                              }

                              cyclicService.saveScan(activeLocation, translatedCode);
                              // Update counter immediately
                              const currentCount = parseInt(document.getElementById('scan_counter').innerText) || 0;
                              document.getElementById('scan_counter').innerText = currentCount + 1;
                          }
                      }
                  });
              }
          }
      }
  }
  else if (activeModuloInvSub === 'reportes') {
      // Lógica de auto-cruce en background si no se ha hecho aún pero hay tareas
      const runAutoCruceBackground = async () => {
          if (window._lastERI) return;
          const stockActivo = await getAreaData('inventario') || [];
          const tasks = cyclicService.getTasks();
          const scans = cyclicService.getScans();
          if (tasks.length === 0 || scans.length === 0) return;

          console.log("[PULSE] Auto-cruzando datos en background para Reporte Gerencial...");

          const maestro = await getAreaData('articulos') || [];
          const maestroMap = new Map();
          maestro.forEach(a => {
              const mSku = (getCol(a, ['SKU', 'Articulo', 'Artículo', 'Product']) || '').toString().trim().toUpperCase();
              const mDesc = (getCol(a, ['Descripcion', 'Descripción', 'Description', 'Desc']) || 'S/D').toString().trim();
              if (mSku) maestroMap.set(mSku, mDesc);
          });

          const taskLocations = new Set(tasks.map(t => t.location.toUpperCase()));
          const sistemaMap = new Map();
          const descMap = new Map();

          stockActivo.forEach(row => {
              const sku = (getCol(row, ['SKU', 'Articulo', 'Artículo', 'Product', 'Producto']) || (Array.isArray(row) ? row[1] : '')).toString().trim().toUpperCase();
              const ubi = (getCol(row, ['Ubicacion', 'Ubicación', 'Location', 'Ubi']) || (Array.isArray(row) ? row[3] : '')).toString().trim().toUpperCase();
              const qty = parseFloat(getCol(row, ['Cantidad', 'Qty', 'Stock', 'Cantidad actual']) || (Array.isArray(row) ? row[5] : 0)) || 0;

              let desc = 'S/D';
              if (typeof row === 'object' && !Array.isArray(row)) {
                  desc = getCol(row, ['Descripcion', 'Descripción', 'Description', 'DESCRIPCION', 'Articulo', 'Nombre']) || 'S/D';
              } else if (Array.isArray(row)) {
                  desc = row[2] || row[4] || row[6] || row[7] || 'S/D';
              }
              desc = desc.toString().trim();

              if (sku && taskLocations.has(ubi)) {
                  const key = `${sku}|${ubi}`;
                  sistemaMap.set(key, (sistemaMap.get(key) || 0) + qty);
                  if (desc && desc !== 'S/D') descMap.set(sku, desc);
              }
          });

          const fisicoMap = new Map();
          scans.forEach(s => {
              let sku = s.sku.toString().trim().toUpperCase();
              if (barcodeToSkuMap && barcodeToSkuMap.has(sku)) {
                  sku = barcodeToSkuMap.get(sku);
              }
              const ubi = s.location.toString().trim().toUpperCase();
              const qty = parseFloat(s.qty) || 0;

              if (sku && taskLocations.has(ubi)) {
                  const key = `${sku}|${ubi}`;
                  fisicoMap.set(key, (fisicoMap.get(key) || 0) + qty);
              }
          });

          const allKeys = new Set([...sistemaMap.keys(), ...fisicoMap.keys()]);
          const eruResults = [];
          let totalItems = 0;
          let correctItems = 0;

          allKeys.forEach(key => {
              const [sku, ubi] = key.split('|');
              const qSis = sistemaMap.get(key) || 0;
              const qFis = fisicoMap.get(key) || 0;
              const diff = qFis - qSis;
              const acc = qSis === qFis ? 100 : (1 - (Math.abs(diff) / Math.max(qSis, qFis || 1))) * 100;

              totalItems++;
              if (diff === 0) correctItems++;

              const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';
              eruResults.push({
                  sku, ubi, desc: finalDesc, sis: qSis, fis: qFis, diff, eri: Math.max(0, acc).toFixed(1)
              });
          });

          eruResults.sort((a, b) => a.ubi.localeCompare(b.ubi));

          const countedSkus = new Set(eruResults.map(r => r.sku));
          const eriBySku = new Map();
          countedSkus.forEach(sku => eriBySku.set(sku, { sis: 0, fis: 0 }));
          eruResults.forEach(r => {
              const entry = eriBySku.get(r.sku);
              entry.sis += r.sis;
              entry.fis += r.fis;
          });

          const eriResults = [];
          let eriCorrect = 0;
          eriBySku.forEach((vals, sku) => {
              const diff = vals.fis - vals.sis;
              if (diff === 0) eriCorrect++;
              const acc = vals.sis === vals.fis ? 100 : (1 - (Math.abs(diff) / Math.max(vals.sis, vals.fis || 1))) * 100;

              const ubis = eruResults.filter(r => r.sku === sku).map(r => r.ubi);
              const ubiText = ubis.length > 1 ? "VARIAS" : (ubis[0] || 'N/A');
              const finalDesc = descMap.get(sku) || maestroMap.get(sku) || 'N/A';

              eriResults.push({
                  sku, ubi: ubiText, desc: finalDesc, sis: vals.sis, fis: vals.fis, diff, eri: Math.max(0, acc).toFixed(1)
              });
          });

          const finalERU = eruResults.length > 0 ? (eruResults.reduce((acc, r) => acc + parseFloat(r.eri || 0), 0) / eruResults.length).toFixed(1) : 0;
          const finalERI = eriResults.length > 0 ? ((eriCorrect / eriResults.length) * 100).toFixed(1) : 0;

          window._lastERI = { eriResults, finalERI, eruResults, finalERU };

          // Re-render
          renderModuloInventarios(container);
      };

      // Ejecutar en background si es necesario
      if (!window._lastERI) {
          runAutoCruceBackground();
      }

      // Recuperar y procesar datos gerenciales
      const scans = cyclicService.getScans() || [];
      const tasks = cyclicService.getTasks() || [];
      const closedLocations = cyclicService.getClosedLocations() || [];

      // Calcular KPIs gerenciales rápidos
      const totalClosed = closedLocations.length;
      const totalAssigned = tasks.length;
      const uniqueSkusCount = new Set(scans.map(s => s.sku.toUpperCase())).size;
      const totalFisQty = scans.reduce((acc, curr) => acc + (parseFloat(curr.qty) || 0), 0);

      let totalSisQty = 0;
      let avgERU = 0;
      if (window._lastERI && window._lastERI.eruResults) {
          totalSisQty = window._lastERI.eruResults.reduce((acc, curr) => acc + parseFloat(curr.sis || 0), 0);
          avgERU = window._lastERI.finalERU;
      }

      // Lógica de pestañas gerenciales
      window._activeGerTab = window._activeGerTab || 'cronologico';

      // Pre-calcular desglose por Semana y Día
      const getWeekNumber = (d) => {
          const date = new Date(d.getTime());
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
          const week1 = new Date(date.getFullYear(), 0, 4);
          return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      };

      const dateGroups = {};
      scans.forEach(s => {
          const timestamp = s.last_scan || Date.now();
          const d = new Date(timestamp);
          const dateStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

          if (!dateGroups[dateStr]) {
              dateGroups[dateStr] = {
                  date: d,
                  locations: new Set(),
                  skus: new Set(),
                  qtyFis: 0,
                  qtySis: 0,
                  diff: 0,
                  eruSum: 0,
                  eruCount: 0
              };
          }
          dateGroups[dateStr].locations.add(s.location.toUpperCase());
          dateGroups[dateStr].skus.add(s.sku.toUpperCase());
          dateGroups[dateStr].qtyFis += parseFloat(s.qty) || 0;
      });

      if (window._lastERI && window._lastERI.eruResults) {
          Object.keys(dateGroups).forEach(dateStr => {
              const group = dateGroups[dateStr];
              const locsOnDate = group.locations;
              const matchingResults = window._lastERI.eruResults.filter(r => locsOnDate.has(r.ubi.toUpperCase()));

              let sisSum = 0;
              let eruSum = 0;
              matchingResults.forEach(r => {
                  sisSum += parseFloat(r.sis) || 0;
                  eruSum += parseFloat(r.eri) || 0;
              });

              group.qtySis = sisSum;
              group.diff = group.qtyFis - group.qtySis;
              group.accuracy = matchingResults.length > 0 ? (eruSum / matchingResults.length) : 100;
          });
      }

      const weekGroups = {};
      Object.keys(dateGroups).forEach(dateStr => {
          const group = dateGroups[dateStr];
          const d = group.date;
          const weekNo = getWeekNumber(d);
          const year = d.getFullYear();
          const weekKey = `Semana ${weekNo} (${year})`;

          if (!weekGroups[weekKey]) {
              weekGroups[weekKey] = {
                  weekName: weekKey,
                  days: []
              };
          }

          weekGroups[weekKey].days.push({
              dateStr,
              dayName: d.toLocaleDateString('es-PE', { weekday: 'long' }),
              locsCount: group.locations.size,
              skusCount: group.skus.size,
              qtyFis: group.qtyFis,
              qtySis: group.qtySis,
              diff: group.diff,
              accuracy: group.accuracy || 100
          });
      });

      const sortedWeeks = Object.values(weekGroups).sort((a, b) => b.weekName.localeCompare(a.weekName));
      sortedWeeks.forEach(w => {
          w.days.sort((a, b) => {
              const dateA = new Date(a.dateStr.split('/').reverse().join('-'));
              const dateB = new Date(b.dateStr.split('/').reverse().join('-'));
              return dateB - dateA;
          });
      });

      let htmlWeeks = '';
      if (sortedWeeks.length === 0) {
          htmlWeeks = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay lecturas registradas para agrupar cronológicamente.</td></tr>`;
      } else {
          sortedWeeks.forEach(w => {
              htmlWeeks += `
                  <tr style="background:rgba(var(--ink-rgb), 0.02); font-weight:800; color:var(--sky);">
                      <td colspan="7" style="padding:10px 15px; font-size:var(--t-md); border-left:4px solid var(--sky);">
                          📅 ${w.weekName.toUpperCase()}
                      </td>
                  </tr>
              `;
              w.days.forEach(d => {
                  const dayCapitalized = d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1);
                  const accColor = d.accuracy >= 90 ? 'var(--success-alt)' : (d.accuracy >= 80 ? 'var(--warning)' : 'var(--danger)');
                  htmlWeeks += `
                      <tr>
                          <td style="padding:10px 15px; font-weight:600; padding-left:25px;">${dayCapitalized} <span style="font-size:var(--t-xs); color:var(--text-muted); margin-left:8px;">(${d.dateStr})</span></td>
                          <td style="text-align:center; font-weight:700;">${d.locsCount}</td>
                          <td class="centrado">${d.skusCount}</td>
                          <td style="text-align:center; font-weight:700; color:var(--text-strong);">${d.qtyFis} u.</td>
                          <td style="text-align:center; opacity:0.8;">${d.qtySis} u.</td>
                          <td style="text-align:center; color:${d.diff===0?'var(--success-alt)':(d.diff>0?'var(--sky)':'var(--danger)')}; font-weight:900;">
                              ${d.diff > 0 ? '+' : ''}${d.diff}
                          </td>
                          <td class="centrado">
                              <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                  ${parseFloat(d.accuracy).toFixed(1)}%
                              </span>
                          </td>
                      </tr>
                  `;
              });
          });
      }

      content.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:2rem;">

              <!-- TABLERO GERENCIAL (MANDO Y CONTROL) -->
              <div class="glass-panel" style="padding:2rem; border-radius:15px; border:1px solid rgba(var(--sky-rgb), 0.2); background:radial-gradient(circle at top right, rgba(var(--sky-rgb), 0.03), transparent);">
                  <h3 style="color:var(--text-strong); margin:0 0 1.5rem 0; font-size:var(--t-lg); font-weight:900; letter-spacing:1px; display:flex; align-items:center; gap:10px;">
                      📈 TABLERO Y REPORTE GERENCIAL (MANDO Y CONTROL)
                  </h3>

                  <!-- KPI CARDS -->
                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1.2rem; margin-bottom:2rem;">
                      <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid var(--sky); background:rgba(var(--ink-rgb), 0.01);">
                          <h4 style="margin:0; font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Ubicaciones Contadas</h4>
                          <h2 style="margin:0.5rem 0; font-size:var(--t-2xl); color:var(--text-strong); font-weight:800;">${totalClosed} / ${totalAssigned}</h2>
                          <span style="font-size:var(--t-xs); background:rgba(var(--sky-rgb), 0.1); color:var(--sky); padding:2px 8px; border-radius:10px; font-weight:700;">
                              ${totalAssigned > 0 ? ((totalClosed/totalAssigned)*100).toFixed(0) : 0}% COMPLETADO
                          </span>
                      </div>
                      <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid var(--violet); background:rgba(var(--ink-rgb), 0.01);">
                          <h4 style="margin:0; font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">SKUs Únicos</h4>
                          <h2 style="margin:0.5rem 0; font-size:var(--t-2xl); color:var(--text-strong); font-weight:800;">${uniqueSkusCount}</h2>
                          <span class="txt-chico">Sobrantes o asignados</span>
                      </div>
                      <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid var(--success-alt); background:rgba(var(--ink-rgb), 0.01);">
                          <h4 style="margin:0; font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Qty Total Conteo</h4>
                          <h2 style="margin:0.5rem 0; font-size:var(--t-2xl); color:var(--success-alt); font-weight:800;">${totalFisQty} u.</h2>
                          <span class="txt-chico">Unidades físicas</span>
                      </div>
                      <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid var(--warning); background:rgba(var(--ink-rgb), 0.01);">
                          <h4 style="margin:0; font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Qty Total Sistema</h4>
                          <h2 style="margin:0.5rem 0; font-size:var(--t-2xl); color:var(--text-strong); font-weight:800;">${totalSisQty} u.</h2>
                          <span style="font-size:var(--t-xs); color:${totalFisQty - totalSisQty === 0 ? 'var(--success-alt)' : 'var(--danger)'}; font-weight:800;">
                              DIF: ${totalFisQty - totalSisQty > 0 ? '+' : ''}${totalFisQty - totalSisQty} u.
                          </span>
                      </div>
                      <div class="glass-panel" style="padding:1.2rem; text-align:center; border-left:4px solid ${avgERU >= 90 ? 'var(--success-alt)' : (avgERU >= 80 ? 'var(--warning)' : 'var(--danger)')}; background:rgba(var(--ink-rgb), 0.01);">
                          <h4 style="margin:0; font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Exactitud ERU</h4>
                          <h2 style="margin:0.5rem 0; font-size:var(--t-2xl); color:${avgERU >= 90 ? 'var(--success-alt)' : (avgERU >= 80 ? 'var(--warning)' : 'var(--danger)')}; font-weight:800;">${avgERU}%</h2>
                          <span style="font-size:var(--t-xs); background:${avgERU >= 90 ? 'var(--success-alt)' : (avgERU >= 80 ? 'var(--warning)' : 'var(--danger)')}22; color:${avgERU >= 90 ? 'var(--success-alt)' : (avgERU >= 80 ? 'var(--warning)' : 'var(--danger)')}; padding:2px 8px; border-radius:10px; font-weight:700;">
                              ${avgERU >= 90 ? 'EXCELENTE' : (avgERU >= 80 ? 'REGULAR' : 'CRÍTICO')}
                          </span>
                      </div>
                  </div>

                  <!-- INNER NAVIGATION TABS -->
                  <div style="display:flex; gap:1rem; border-bottom:1px solid rgba(var(--ink-rgb), 0.1); margin-bottom:1.5rem;">
                      <button class="ger-tab-btn ${window._activeGerTab === 'cronologico' ? 'active' : ''}" data-tab="cronologico" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'cronologico' ? 'var(--sky)' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'cronologico' ? 'var(--sky)' : 'transparent'}; font-weight:800; font-size:var(--t-sm); cursor:pointer; transition:all 0.2s;">
                          📅 RESUMEN POR SEMANA Y DÍA
                      </button>
                      <button class="ger-tab-btn ${window._activeGerTab === 'ubicacion' ? 'active' : ''}" data-tab="ubicacion" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'ubicacion' ? 'var(--sky)' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'ubicacion' ? 'var(--sky)' : 'transparent'}; font-weight:800; font-size:var(--t-sm); cursor:pointer; transition:all 0.2s;">
                          📍 ACUMULADO POR UBICACIÓN
                      </button>
                      <button class="ger-tab-btn ${window._activeGerTab === 'sku' ? 'active' : ''}" data-tab="sku" style="background:none; border:none; padding:10px 15px; color:${window._activeGerTab === 'sku' ? 'var(--sky)' : 'var(--text-muted)'}; border-bottom:2px solid ${window._activeGerTab === 'sku' ? 'var(--sky)' : 'transparent'}; font-weight:800; font-size:var(--t-sm); cursor:pointer; transition:all 0.2s;">
                          🏷️ ACUMULADO POR SKU
                      </button>
                  </div>

                  <!-- TAB CONTENT AREA -->
                  <div id="ger_tab_content"></div>
              </div>

              <!-- SECTION 1: REPORTE UCA (BOTTOM - FULL WIDTH) -->
              <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(var(--primary2-rgb), 0.2); background:rgba(var(--bg-rgb), 0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                      <h3 style="color:var(--text-strong); margin:0; font-size:var(--t-lg); font-weight:900; letter-spacing:1px;">📊 REPORTE UCA (DISPONIBILIDAD)</h3>
                      <button id="btn_run_uca" class="btn-premium-pulse" style="width:auto; padding:8px 20px; font-size:var(--t-sm); background:linear-gradient(135deg, var(--primary), var(--violet)); color:var(--text-strong); border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(var(--primary-rgb), 0.3);">⚡ GENERAR UCA</button>
                  </div>
                  <div id="uca_results_area"></div>
              </div>

              <!-- SECTION 2: INDICADORES DE EXACTITUD (BOTTOM - SPLIT) -->
              <div class="glass-panel" style="padding:1.5rem; border-radius:15px; border:1px solid rgba(var(--success-alt-rgb), 0.2); background:rgba(var(--bg-rgb), 0.2);">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                      <h3 style="color:var(--text-strong); margin:0; font-size:var(--t-lg); font-weight:900; letter-spacing:1px;">🎯 INDICADORES DE EXACTITUD (AUDITORÍA)</h3>
                      <div style="display:flex; gap:10px;">
                          <input type="file" id="up_conteo_unificado" accept=".csv, .xlsx" style="display:none;">
                          <button onclick="document.getElementById('up_conteo_unificado').click()" class="btn-premium-pulse" style="width:auto; padding:8px 20px; font-size:var(--t-sm); background:linear-gradient(135deg, var(--success-deep), var(--success-alt)); color:var(--text-strong); border:none; border-radius:8px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(var(--success-alt-rgb), 0.3);">📉 PROCESAR ERI / ERU</button>
                      </div>
                  </div>

                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                      <!-- ERU (IZQUIERDA) -->
                      <div id="eru_results_area_unif">
                          <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:var(--t-sm); font-style:italic; background:rgba(var(--ink-rgb), 0.02); border-radius:10px; border:1px dashed rgba(var(--ink-rgb), 0.05);">Esperando Auditoría ERU...</div>
                      </div>

                      <!-- ERI (DERECHA) -->
                      <div id="eri_results_area_unif">
                          <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:var(--t-sm); font-style:italic; background:rgba(var(--ink-rgb), 0.02); border-radius:10px; border:1px dashed rgba(var(--ink-rgb), 0.05);">Esperando Auditoría ERI...</div>
                      </div>
                  </div>
              </div>

          </div>
      `;

      // Renderizar pestaña gerencial activa
      const gerContent = document.getElementById('ger_tab_content');
      if (window._activeGerTab === 'cronologico') {
          gerContent.innerHTML = `
              <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(var(--ink-rgb), 0.05); overflow-x:auto;">
                  <table class="data-table" style="font-size:var(--t-sm);">
                      <thead>
                          <tr>
                              <th style="padding:12px 15px;">DÍA / SEMANA</th>
                              <th class="centrado">UBICACIONES CONTADAS</th>
                              <th class="centrado">SKUs ÚNICOS</th>
                              <th class="centrado">FISICO (QTY)</th>
                              <th class="centrado">SISTEMA (QTY)</th>
                              <th class="centrado">DIFERENCIA</th>
                              <th class="centrado">EXACTITUD ERU</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${htmlWeeks}
                      </tbody>
                  </table>
              </div>
          `;
      } else if (window._activeGerTab === 'ubicacion') {
          const cleanERU = (window._lastERI && window._lastERI.eruResults) ? window._lastERI.eruResults.filter(r => r.ubi && !r.ubi.toString().toUpperCase().includes('UBICAC')) : [];
          let htmlRows = '';
          if (cleanERU.length === 0) {
              htmlRows = `<tr><td colspan="7" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay datos de ubicación acumulados. Realiza el cruce para cargar.</td></tr>`;
          } else {
              htmlRows = cleanERU.map(r => {
                  const accColor = r.eri >= 90 ? 'var(--success-alt)' : (r.eri >= 80 ? 'var(--warning)' : 'var(--danger)');
                  // Buscar el usuario del conteo
                  const t = tasks.find(x => x.location.toUpperCase() === r.ubi.toUpperCase());
                  const operarioName = t ? (t.user || 'S/D') : 'S/D';
                  return `
                      <tr>
                          <td style="font-weight:700; color:var(--success-alt); padding:10px 15px;">📍 ${r.ubi}</td>
                          <td>${r.sku}</td>
                          <td class="centrado">${r.sis}</td>
                          <td style="text-align:center; font-weight:700; color:var(--text-strong);">${r.fis}</td>
                          <td style="text-align:center; color:${r.diff===0?'var(--success-alt)':(r.diff>0?'var(--sky)':'var(--danger)')}; font-weight:900;">
                              ${r.diff > 0 ? '+' : ''}${r.diff}
                          </td>
                          <td class="centrado">
                              <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                  ${parseFloat(r.eri).toFixed(1)}%
                              </span>
                          </td>
                          <td style="font-size:var(--t-xs); color:var(--text-muted); font-weight:600;">${operarioName.toUpperCase()}</td>
                      </tr>
                  `;
              }).join('');
          }
          gerContent.innerHTML = `
              <div style="margin-bottom:1rem; display:flex; justify-content:flex-end;">
                  <input type="text" id="search_ger_loc" placeholder="🔍 Buscar ubicación..." style="background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:6px 12px; border-radius:6px; font-size:var(--t-sm); width:200px;">
              </div>
              <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(var(--ink-rgb), 0.05); max-height:400px; overflow-y:auto;">
                  <table class="data-table" style="font-size:var(--t-sm);" id="table_ger_loc">
                      <thead style="position:sticky; top:0; z-index:10; background:var(--panel-alt);">
                          <tr>
                              <th style="padding:12px 15px;">UBICACIÓN</th>
                              <th>SKU</th>
                              <th class="centrado">SISTEMA</th>
                              <th class="centrado">FÍSICO</th>
                              <th class="centrado">DIF</th>
                              <th class="centrado">EXACTITUD ERU</th>
                              <th>OPERARIO</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${htmlRows}
                      </tbody>
                  </table>
              </div>
          `;
          const searchInput = document.getElementById('search_ger_loc');
          if (searchInput) {
              searchInput.oninput = () => {
                  const term = searchInput.value.toUpperCase();
                  const rows = document.querySelectorAll('#table_ger_loc tbody tr');
                  rows.forEach(row => {
                      const txt = row.innerText.toUpperCase();
                      row.style.display = txt.includes(term) ? '' : 'none';
                  });
              };
          }
      } else if (window._activeGerTab === 'sku') {
          const cleanERI = (window._lastERI && window._lastERI.eriResults) ? window._lastERI.eriResults.filter(r => r.sku && !r.sku.toString().toUpperCase().includes('SKU')) : [];
          let htmlRows = '';
          if (cleanERI.length === 0) {
              htmlRows = `<tr><td colspan="6" style="padding:3rem; text-align:center; color:var(--text-muted); font-style:italic;">No hay datos de SKU acumulados. Realiza el cruce para cargar.</td></tr>`;
          } else {
              htmlRows = cleanERI.map(r => {
                  const accColor = r.eri >= 90 ? 'var(--success-alt)' : (r.eri >= 80 ? 'var(--warning)' : 'var(--danger)');
                  return `
                      <tr>
                          <td style="font-weight:700; color:var(--brand-light); padding:10px 15px;">🏷️ ${r.sku}</td>
                          <td class="txt-chico">${r.ubi}</td>
                          <td class="centrado">${r.sis}</td>
                          <td style="text-align:center; font-weight:700; color:var(--text-strong);">${r.fis}</td>
                          <td style="text-align:center; color:${r.diff===0?'var(--success-alt)':(r.diff>0?'var(--sky)':'var(--danger)')}; font-weight:900;">
                              ${r.diff > 0 ? '+' : ''}${r.diff}
                          </td>
                          <td class="centrado">
                              <span style="background:${accColor}15; color:${accColor}; padding:2px 8px; border-radius:6px; font-weight:800;">
                                  ${parseFloat(r.eri).toFixed(1)}%
                              </span>
                          </td>
                      </tr>
                  `;
              }).join('');
          }
          gerContent.innerHTML = `
              <div style="margin-bottom:1rem; display:flex; justify-content:flex-end;">
                  <input type="text" id="search_ger_sku" placeholder="🔍 Buscar SKU..." style="background:rgba(var(--ink-rgb), 0.03); border:1px solid rgba(var(--ink-rgb), 0.1); color:var(--text-strong); padding:6px 12px; border-radius:6px; font-size:var(--t-sm); width:200px;">
              </div>
              <div class="data-table-container" style="border-radius:10px; border:1px solid rgba(var(--ink-rgb), 0.05); max-height:400px; overflow-y:auto;">
                  <table class="data-table" style="font-size:var(--t-sm);" id="table_ger_sku">
                      <thead style="position:sticky; top:0; z-index:10; background:var(--panel-alt);">
                          <tr>
                              <th style="padding:12px 15px;">SKU</th>
                              <th>UBICACIÓN</th>
                              <th class="centrado">SISTEMA</th>
                              <th class="centrado">FÍSICO</th>
                              <th class="centrado">DIF</th>
                              <th class="centrado">EXACTITUD ERI</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${htmlRows}
                      </tbody>
                  </table>
              </div>
          `;
          const searchInput = document.getElementById('search_ger_sku');
          if (searchInput) {
              searchInput.oninput = () => {
                  const term = searchInput.value.toUpperCase();
                  const rows = document.querySelectorAll('#table_ger_sku tbody tr');
                  rows.forEach(row => {
                      const txt = row.innerText.toUpperCase();
                      row.style.display = txt.includes(term) ? '' : 'none';
                  });
              };
          }
      }

      // Vincular clics de botones gerenciales
      document.querySelectorAll('.ger-tab-btn').forEach(btn => {
          btn.onclick = (e) => {
              window._activeGerTab = e.currentTarget.dataset.tab;
              renderModuloInventarios(container);
          };
      });

      // Lógica UCA original
      document.getElementById('btn_run_uca').onclick = () => {
          if (matriz && reserva) {
              const res = ENT.processReporteUCA(matriz, reserva);
              ENT.displayReporteUCA(res);
          } else {
              alert("⚠️ Datos insuficientes en 'ARCHIVO INVENTARIO' para UCA.");
          }
      };

      // Lógica ERI/ERU original
      const inputUnif = document.getElementById('up_conteo_unificado');
      if (inputUnif) {
          inputUnif.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;

              const btn = document.querySelector('button[onclick*="up_conteo_unificado"]');
              const originalHTML = btn ? btn.innerHTML : '';
              if (btn) {
                  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
                  btn.disabled = true;
                  btn.style.opacity = '0.7';
              }

              try {
                  const data = await parseFile(file, 'inventario_eri');
                  if (data && data.length > 0) {
                      await ENT.processERIAnalysis(data);
                      renderERI_ERU_Unified();
                  }
              } catch(err) { 
                  alert("Error al procesar el archivo: " + err); 
              } finally {
                  if (btn) {
                      btn.innerHTML = originalHTML;
                      btn.disabled = false;
                      btn.style.opacity = '1';
                  }
                  inputUnif.value = '';
              }
          };
      }

      // Función interna para renderizar ERI/ERU uno al lado del otro
      const renderERI_ERU_Unified = () => {
          if (!window._lastERI) return;
          const eriArea = document.getElementById('eri_results_area_unif');
          const eruArea = document.getElementById('eru_results_area_unif');

          // Bloque ERU (IZQUIERDA)
          eruArea.innerHTML = `
              <div class="glass-panel" style="padding:1.2rem; border:1px solid rgba(var(--success-alt-rgb), 0.3); background:radial-gradient(circle at top right, rgba(var(--success-alt-rgb), 0.05), transparent);">
                  <div style="display:flex; align-items:center; gap:15px; margin-bottom:1.2rem;">
                      <div style="position:relative; width:65px; height:65px;">
                          <svg viewBox="0 0 36 36" style="transform: rotate(-90deg); width:65px; height:65px;">
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(var(--ink-rgb), 0.05)" stroke-width="3" />
                              <path id="eru_circle_unif" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--success-alt)" stroke-width="3" stroke-dasharray="0, 100" />
                          </svg>
                          <div id="eru_val_unif" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:var(--t-md); font-weight:900; color:var(--text-strong);">0%</div>
                      </div>
                      <div>
                          <div style="font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:1px;">
                              EXACTITUD <span id="eru_timestamp" style="margin-left:10px; color:rgba(var(--ink-rgb), 0.3); font-weight:400;"></span>
                          </div>
                          <div style="font-size:var(--t-md); font-weight:900; color:var(--success-alt);">DE REGISTRO DE UBICACIÓN (ERU)</div>
                      </div>
                  </div>
                  <div class="data-table-container" style="max-height:280px; overflow-y:auto; border-radius:10px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                      <table class="data-table" style="font-size:var(--t-sm);">
                          <thead id="eru_head_unif" style="position:sticky; top:0; z-index:10; background:var(--panel-alt);"></thead>
                          <tbody id="eru_body_unif"></tbody>
                      </table>
                  </div>
              </div>
          `;

          // Bloque ERI (DERECHA)
          eriArea.innerHTML = `
              <div class="glass-panel" style="padding:1.2rem; border:1px solid rgba(var(--brand-rgb), 0.3); background:radial-gradient(circle at top right, rgba(var(--brand-rgb), 0.05), transparent);">
                  <div style="display:flex; align-items:center; gap:15px; margin-bottom:1.2rem;">
                      <div style="position:relative; width:65px; height:65px;">
                          <svg viewBox="0 0 36 36" style="transform: rotate(-90deg); width:65px; height:65px;">
                              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(var(--ink-rgb), 0.05)" stroke-width="3" />
                              <path id="eri_circle_unif" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--brand-light)" stroke-width="3" stroke-dasharray="0, 100" />
                          </svg>
                          <div id="eri_val_unif" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:var(--t-md); font-weight:900; color:var(--text-strong);">0%</div>
                      </div>
                      <div>
                          <div style="font-size:var(--t-xs); color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:1px;">
                              EXACTITUD <span id="eri_timestamp" style="margin-left:10px; color:rgba(var(--ink-rgb), 0.3); font-weight:400;"></span>
                          </div>
                          <div style="font-size:var(--t-md); font-weight:900; color:var(--brand-light);">DE REGISTRO DE INVENTARIO (ERI)</div>
                      </div>
                  </div>
                  <div class="data-table-container" style="max-height:280px; overflow-y:auto; border-radius:10px; border:1px solid rgba(var(--ink-rgb), 0.05);">
                      <table class="data-table" style="font-size:var(--t-sm);">
                          <thead id="eri_head_unif" style="position:sticky; top:0; z-index:10; background:var(--panel-alt);"></thead>
                          <tbody id="eri_body_unif"></tbody>
                      </table>
                  </div>
              </div>
          `;

          ENT.updateERIUI_Unified();
      };

      window.renderERI_ERU_Unified_Global = () => renderERI_ERU_Unified();

      if (window._lastERI) renderERI_ERU_Unified();
  }
};
