/**
 * ANALISIS DE SKU -> ANALISIS DE RESERVA
 *
 * Vivia adentro de `renderDashboard`, en `dashboard_v28.js`. Se saco el
 * 02-sep-2026, segunda de las cinco pantallas que Daniel pidio mover: ese
 * archivo son 40.700 lineas que el navegador baja y compila ENTERAS aunque solo
 * se abra Inicio. Ahora esto llega con `await import(...)` recien al entrar a la
 * pestana.
 *
 * SE MUDARON CON ELLA SUS DOS ESTADOS. `reservaState` y `ubicacionState` -que
 * pagina y filtro va mirando cada tabla- se usaban SOLO aca; se comprobo antes de
 * tocarlos. Siguen siendo variables de modulo, asi que se acuerdan de la pagina
 * entre un dibujo y otro igual que antes: un modulo cargado con `import()` se
 * carga una sola vez y se queda.
 *
 * LO QUE ANTES LE LLEGABA GRATIS AHORA VA POR PARAMETRO, en `ENT`:
 *
 *   htmlConsolidacionReserva()    el cuadro de consolidacion, 300 lineas que se
 *                                 quedaron en el tablero
 *   engancharClicConsolidacion()  los clics de ese cuadro
 *   diaDeLaFotoDeReserva()        de que dia es la foto que se esta mirando
 *   indexarMaestro()              el Maestro por codigo, que usan diez sitios mas
 *   guardarReservaCruda(filas)    deja el stock con el que despues se arma el
 *                                 plan del Excel. Va como FUNCION porque del otro
 *                                 lado es un `let` que se lee en dos sitios: si se
 *                                 pasara el valor, el de alla nunca se enteraria
 *   TURNO_API                     la direccion de la API
 *   AREA_RESERVA_DE_LA_HORA       el area que publica el robot cada hora
 *
 * Las dos ultimas van por parametro y NO copiadas aca: una direccion escrita dos
 * veces es una direccion que un dia queda a medio cambiar.
 *
 * LA PANTALLA SE VUELVE A DIBUJAR A SI MISMA en tres sitios -al cambiar de vista,
 * de pagina y al cerrar el modal-, y esas llamadas tienen que pasarse `ENT` otra
 * vez. Sin eso la primera vuelta anda y la segunda se cae, que es la forma mas
 * fea de romper algo.
 */

import { dataStore, fetchBaseReserva, fetchFotosReserva, fetchReservaHistory,
         guardarFotoReserva, textoFechaServidor } from '../services_v245/csvHub_v6.js?v=29.0592';
import { colorTema, veloTema, resolverColoresChart } from '../services_v245/temaService.js?v=29.0592';
import { icono } from '../services_v245/iconos.js?v=29.0592';
import { consolidacionDeReserva, cierreDeFragmentados,
         fotoChicaDeReserva } from '../reportes/reserva_consolidacion.js?v=29.0592';

/* LOS DOS ESTADOS DE LAS TABLAS: que pagina y que filtro se esta mirando.
   Vinieron de `renderDashboard`, donde se usaban solo aca. Al ser de modulo se
   acuerdan entre un dibujo y otro, que es como se portaban antes. */
let reservaState = { page: 1, query: '', skusArray: [], view: 'resumen' };
let ubicacionState = { page: 1, query: '', ubisArray: [] };

export const renderAnalisisReserva = async (container, ENT = {}) => {
      const rawReserva = dataStore.analisis_sku_reserva;
      if (!rawReserva || rawReserva.length === 0) {
          container.innerHTML = `
              <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                  <div style="font-size:var(--t-2xl); margin-bottom:1rem; opacity:0.1;">📦</div>
                  <h4>Datos Incompletos</h4>
                  <p>Por favor carga el archivo <b>STOCK RESERVA</b> en la pestaña <b>ARCHIVO ANÁLISIS SKU</b>.</p>
              </div>`;
          return;
      }

      // Sub-SubNavegación UI
      container.innerHTML = `
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:1.5rem;">
              <button id="btn_view_resumen" class="btn-primary" style="padding:8px 20px; font-weight:800; font-size:var(--t-md); border-radius:20px; transition:all 0.3s; ${reservaState.view === 'resumen' ? 'background:rgba(var(--pink-rgb), 0.2); border:1px solid var(--pink); color:var(--pink); text-shadow:0 0 10px rgba(var(--pink-rgb), 0.5); box-shadow:0 0 15px rgba(var(--pink-rgb), 0.2);' : 'background:rgba(var(--ink-rgb), 0.05); color:var(--text-muted); border:1px solid transparent;'}">
                  📊 Resumen Reserva
              </button>
              <button id="btn_view_detalle" class="btn-primary" style="padding:8px 20px; font-weight:800; font-size:var(--t-md); border-radius:20px; transition:all 0.3s; ${reservaState.view === 'detalle' ? 'background:rgba(var(--success-alt-rgb), 0.2); border:1px solid var(--success-alt); color:var(--success-alt); text-shadow:0 0 10px rgba(var(--success-alt-rgb), 0.5); box-shadow:0 0 15px rgba(var(--success-alt-rgb), 0.2);' : 'background:rgba(var(--ink-rgb), 0.05); color:var(--text-muted); border:1px solid transparent;'}">
                  📑 Detalle Reserva
              </button>
          </div>
          <div id="reserva_view_content" style="width:100%; animation: fadeIn 0.3s ease;">
              <div style="text-align:center; padding:3rem; color:var(--text-muted);">Cargando vista...</div>
          </div>
      `;

      document.getElementById('btn_view_resumen').onclick = () => {
          reservaState.view = 'resumen';
          renderAnalisisReserva(container, ENT);
      };
      document.getElementById('btn_view_detalle').onclick = () => {
          reservaState.view = 'detalle';
          renderAnalisisReserva(container, ENT);
      };

      const viewContainer = document.getElementById('reserva_view_content');

      const skuGroups = {};
      const ubiGroups = {};
      let processedCount = 0;

      for (let i = 0; i < rawReserva.length; i++) {
          const row = rawReserva[i];
          if (!row) continue;
          if (!row.ES_ALTO && !String(row.NIVEL).toUpperCase().includes('AL')) continue;

          const ubicacion = String(row.UBICACION || '').trim();
          const lpn = String(row.LPN || '').trim();
          const sku = String(row.PRODUCTO || '').trim();
          const cantidad = parseFloat(row.CANTIDAD) || 0;

          if (!sku || cantidad <= 0 || !ubicacion) continue;

          const paletaKey = lpn ? `LPN: ${lpn} (${ubicacion})` : `UBI: ${ubicacion}`;
          if (!skuGroups[sku]) skuGroups[sku] = { totalQty: 0, paletas: [] };
          skuGroups[sku].totalQty += cantidad;
          let existingPaleta = skuGroups[sku].paletas.find(p => p.key === paletaKey);
          if (existingPaleta) {
              existingPaleta.cantidad += cantidad;
          } else {
              skuGroups[sku].paletas.push({ key: paletaKey, lpn, ubicacion, cantidad });
          }

          const skuKey = lpn ? `LPN: ${lpn} (${sku})` : `SKU: ${sku}`;
          if (!ubiGroups[ubicacion]) ubiGroups[ubicacion] = { totalQty: 0, skus: [] };
          ubiGroups[ubicacion].totalQty += cantidad;
          let existingSku = ubiGroups[ubicacion].skus.find(s => s.key === skuKey);
          if (existingSku) {
              existingSku.cantidad += cantidad;
          } else {
              ubiGroups[ubicacion].skus.push({ key: skuKey, lpn, sku, cantidad });
          }

          processedCount++;
      }

      reservaState.skusArray = Object.keys(skuGroups).map(sku => {
          return { sku, totalQty: skuGroups[sku].totalQty, numPaletas: skuGroups[sku].paletas.length, paletas: skuGroups[sku].paletas };
      });
      reservaState.skusArray.sort((a, b) => b.numPaletas - a.numPaletas);

      ubicacionState.ubisArray = Object.keys(ubiGroups).map(ubi => {
          const uniqueSkus = new Set(ubiGroups[ubi].skus.map(s => s.sku));
          return { ubicacion: ubi, totalQty: ubiGroups[ubi].totalQty, numSkus: uniqueSkus.size, skus: ubiGroups[ubi].skus };
      });
      ubicacionState.ubisArray.sort((a, b) => b.numSkus - a.numSkus);

      // --- RENDERIZAR DETALLE ---
      if (reservaState.view === 'detalle') {
          viewContainer.innerHTML = `
              <div style="display:flex; width:100%; gap:20px; align-items:flex-start;">
                  <div id="reserva_sku_col" style="flex:1; min-width:0; overflow:hidden;"></div>
                  <div id="reserva_ubi_col" style="flex:1; min-width:0; overflow:hidden;"></div>
              </div>
          `;

          const skuContainer = document.getElementById('reserva_sku_col');
          const ubiContainer = document.getElementById('reserva_ubi_col');

          const drawSku = () => {
              const filtered = reservaState.skusArray.filter(item => {
                  if(!reservaState.query) return true;
                  const q = reservaState.query.toLowerCase();
                  if(item.sku.toLowerCase().includes(q)) return true;
                  return item.paletas.some(p => p.lpn.toLowerCase().includes(q) || p.ubicacion.toLowerCase().includes(q));
              });
              const ITEMS_PER_PAGE = 40;
              const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
              if (reservaState.page > totalPages) reservaState.page = totalPages;
              const startIdx = (reservaState.page - 1) * ITEMS_PER_PAGE;
              const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

              let rowsHtml = '';
              pageItems.forEach(item => {
                  const p0 = item.paletas[0] || {lpn: '-', ubicacion: '-', cantidad: 0};
                  rowsHtml += `
                      <tr style="border-top:1px solid rgba(var(--ink-rgb), 0.05); background:rgba(var(--shadow-rgb), 0.2);">
                          <td style="padding:10px; font-weight:700; color:var(--text-strong);">${item.sku}</td>
                          <td style="padding:10px; text-align:center; color:var(--success-alt); font-weight:800;">${item.totalQty.toLocaleString('es-PE')}</td>
                          <td style="padding:10px; text-align:center; color:${item.numPaletas > 2 ? 'var(--danger)' : item.numPaletas > 1 ? 'var(--warning-soft)' : 'var(--text-strong)'}; font-weight:800;">${item.numPaletas}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm); border-left:1px solid rgba(var(--ink-rgb), 0.02);">${p0.lpn}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm);">${p0.ubicacion}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm); text-align:right;">${p0.cantidad.toLocaleString('es-PE')}</td>
                      </tr>
                  `;
                  for(let i=1; i<item.paletas.length; i++) {
                      const pi = item.paletas[i];
                      rowsHtml += `
                          <tr style="border-bottom:none;">
                              <td colspan="3"></td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm); border-left:1px solid rgba(var(--ink-rgb), 0.02);">${pi.lpn}</td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm);">${pi.ubicacion}</td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm); text-align:right;">${pi.cantidad.toLocaleString('es-PE')}</td>
                          </tr>
                      `;
                  }
              });

              skuContainer.innerHTML = `
                  <div style="width: 100%;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                          <h3 style="color:var(--brand-light); font-weight:800; margin:0; font-size:var(--t-lg);">ANÁLISIS DE FRAGMENTACIÓN DE RESERVA</h3>
                          <button id="btn_export_reserva_sku" class="btn-icono btn-excel btn-primary" title="Exportar a Excel">${icono('excel', 18)}</button>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                          <input type="text" id="reserva_sku_search" placeholder="🔍 Buscar SKU o LPN..." value="${reservaState.query}" style="padding:8px 12px; border-radius:5px; border:1px solid rgba(var(--ink-rgb), 0.1); background:rgba(var(--shadow-rgb), 0.2); color:var(--text-strong); width:60%; outline:none;">
                          <div style="font-size:var(--t-sm); color:var(--text-muted);">Filtrados: ${filtered.length} SKUs</div>
                      </div>
                      <div style="background:rgba(var(--bg-rgb), 0.4); border:1px solid rgba(var(--ink-rgb), 0.05); border-radius:10px; overflow-x:auto;">
                          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:var(--t-sm);">
                              <thead>
                                  <tr style="background:rgba(var(--ink-rgb), 0.05); color:var(--text-muted); border-bottom:1px solid rgba(var(--ink-rgb), 0.1);">
                                      <th style="padding:10px;">PRODUCTO (SKU)</th>
                                      <th style="padding:10px; text-align:center;">TOTAL UNID</th>
                                      <th style="padding:10px; text-align:center;">CANT. PALETAS</th>
                                      <th style="padding:10px; border-left:1px solid rgba(var(--ink-rgb), 0.02);">LPN</th>
                                      <th style="padding:10px;">UBICACIÓN</th>
                                      <th style="padding:10px; text-align:right;">CANTIDAD</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${rowsHtml}
                                  ${filtered.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron resultados.</td></tr>' : ''}
                              </tbody>
                          </table>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                          <button id="reserva_sku_prev" class="btn-secondary" style="padding:5px 10px; font-size:var(--t-sm);" ${reservaState.page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>◀ Ant</button>
                          <span style="color:var(--text-muted); font-size:var(--t-sm); font-weight:700;">Página ${reservaState.page} de ${totalPages}</span>
                          <button id="reserva_sku_next" class="btn-secondary" style="padding:5px 10px; font-size:var(--t-sm);" ${reservaState.page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Sig ▶</button>
                      </div>
                  </div>
              `;

              const searchInput = document.getElementById('reserva_sku_search');
              if(searchInput) {
                  searchInput.addEventListener('input', (e) => {
                      reservaState.query = e.target.value; reservaState.page = 1; drawSku();
                      const newSearch = document.getElementById('reserva_sku_search');
                      if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length); }
                  });
              }
              const btnPrev = document.getElementById('reserva_sku_prev');
              if(btnPrev && reservaState.page > 1) { btnPrev.onclick = () => { reservaState.page--; drawSku(); }; }
              const btnNext = document.getElementById('reserva_sku_next');
              if(btnNext && reservaState.page < totalPages) { btnNext.onclick = () => { reservaState.page++; drawSku(); }; }
              const btnExport = document.getElementById('btn_export_reserva_sku');
              if (btnExport) {
                  btnExport.onclick = () => {
                      const wsData = [['PRODUCTO (SKU)', 'TOTAL UNIDADES', 'CANTIDAD PALETAS', 'LPN', 'UBICACIÓN', 'CANTIDAD']];
                      filtered.forEach(item => {
                          item.paletas.forEach((p, idx) => {
                              if (idx === 0) wsData.push([item.sku, item.totalQty, item.numPaletas, p.lpn, p.ubicacion, p.cantidad]);
                              else wsData.push(['', '', '', p.lpn, p.ubicacion, p.cantidad]);
                          });
                      });
                      const ws = XLSX.utils.aoa_to_sheet(wsData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Analisis_SKU");
                      XLSX.writeFile(wb, "Analisis_Fragmentacion_Reserva.xlsx");
                  };
              }
          };

          const drawUbi = () => {
              const filtered = ubicacionState.ubisArray.filter(item => {
                  if(!ubicacionState.query) return true;
                  const q = ubicacionState.query.toLowerCase();
                  if(item.ubicacion.toLowerCase().includes(q)) return true;
                  return item.skus.some(s => s.lpn.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q));
              });
              const ITEMS_PER_PAGE = 40;
              const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
              if (ubicacionState.page > totalPages) ubicacionState.page = totalPages;
              const startIdx = (ubicacionState.page - 1) * ITEMS_PER_PAGE;
              const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

              let rowsHtml = '';
              pageItems.forEach(item => {
                  const s0 = item.skus[0] || {lpn: '-', sku: '-', cantidad: 0};
                  rowsHtml += `
                      <tr style="border-top:1px solid rgba(var(--ink-rgb), 0.05); background:rgba(var(--shadow-rgb), 0.2);">
                          <td style="padding:10px; font-weight:700; color:var(--text-strong);">${item.ubicacion}</td>
                          <td style="padding:10px; text-align:center; color:var(--success-alt); font-weight:800;">${item.totalQty.toLocaleString('es-PE')}</td>
                          <td style="padding:10px; text-align:center; color:${item.numSkus > 2 ? 'var(--danger)' : item.numSkus > 1 ? 'var(--warning-soft)' : 'var(--text-strong)'}; font-weight:800;">${item.numSkus}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm); border-left:1px solid rgba(var(--ink-rgb), 0.02);">${s0.lpn}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm);">${s0.sku}</td>
                          <td style="padding:10px; color:var(--text-muted); font-size:var(--t-sm); text-align:right;">${s0.cantidad.toLocaleString('es-PE')}</td>
                      </tr>
                  `;
                  for(let i=1; i<item.skus.length; i++) {
                      const si = item.skus[i];
                      rowsHtml += `
                          <tr style="border-bottom:none;">
                              <td colspan="3"></td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm); border-left:1px solid rgba(var(--ink-rgb), 0.02);">${si.lpn}</td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm);">${si.sku}</td>
                              <td style="padding:4px 10px; color:var(--text-muted); font-size:var(--t-sm); text-align:right;">${si.cantidad.toLocaleString('es-PE')}</td>
                          </tr>
                      `;
                  }
              });

              ubiContainer.innerHTML = `
                  <div style="width: 100%;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                          <h3 style="color:var(--danger); font-weight:800; margin:0; font-size:var(--t-lg);">REPORTE UBICACIÓN RESERVA</h3>
                          <button id="btn_export_reserva_ubi" class="btn-icono btn-excel btn-primary" title="Exportar a Excel">${icono('excel', 18)}</button>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                          <input type="text" id="reserva_ubi_search" placeholder="🔍 Buscar Ubicación, LPN o SKU..." value="${ubicacionState.query}" style="padding:8px 12px; border-radius:5px; border:1px solid rgba(var(--ink-rgb), 0.1); background:rgba(var(--shadow-rgb), 0.2); color:var(--text-strong); width:60%; outline:none;">
                          <div style="font-size:var(--t-sm); color:var(--text-muted);">Filtrados: ${filtered.length} Ubicaciones</div>
                      </div>
                      <div style="background:rgba(var(--bg-rgb), 0.4); border:1px solid rgba(var(--ink-rgb), 0.05); border-radius:10px; overflow-x:auto;">
                          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:var(--t-sm);">
                              <thead>
                                  <tr style="background:rgba(var(--ink-rgb), 0.05); color:var(--text-muted); border-bottom:1px solid rgba(var(--ink-rgb), 0.1);">
                                      <th style="padding:10px;">UBICACIÓN</th>
                                      <th style="padding:10px; text-align:center;">TOTAL UNID</th>
                                      <th style="padding:10px; text-align:center;">CANT. SKUs</th>
                                      <th style="padding:10px; border-left:1px solid rgba(var(--ink-rgb), 0.02);">LPN</th>
                                      <th style="padding:10px;">PRODUCTO (SKU)</th>
                                      <th style="padding:10px; text-align:right;">CANTIDAD</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${rowsHtml}
                                  ${filtered.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No se encontraron resultados.</td></tr>' : ''}
                              </tbody>
                          </table>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                          <button id="reserva_ubi_prev" class="btn-secondary" style="padding:5px 10px; font-size:var(--t-sm);" ${ubicacionState.page <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>◀ Ant</button>
                          <span style="color:var(--text-muted); font-size:var(--t-sm); font-weight:700;">Página ${ubicacionState.page} de ${totalPages}</span>
                          <button id="reserva_ubi_next" class="btn-secondary" style="padding:5px 10px; font-size:var(--t-sm);" ${ubicacionState.page >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Sig ▶</button>
                      </div>
                  </div>
              `;

              const searchInput = document.getElementById('reserva_ubi_search');
              if(searchInput) {
                  searchInput.addEventListener('input', (e) => {
                      ubicacionState.query = e.target.value; ubicacionState.page = 1; drawUbi();
                      const newSearch = document.getElementById('reserva_ubi_search');
                      if (newSearch) { newSearch.focus(); newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length); }
                  });
              }
              const btnPrev = document.getElementById('reserva_ubi_prev');
              if(btnPrev && ubicacionState.page > 1) { btnPrev.onclick = () => { ubicacionState.page--; drawUbi(); }; }
              const btnNext = document.getElementById('reserva_ubi_next');
              if(btnNext && ubicacionState.page < totalPages) { btnNext.onclick = () => { ubicacionState.page++; drawUbi(); }; }
              const btnExport = document.getElementById('btn_export_reserva_ubi');
              if (btnExport) {
                  btnExport.onclick = () => {
                      const wsData = [['UBICACIÓN', 'TOTAL UNIDADES', 'CANTIDAD SKU', 'LPN', 'PRODUCTO (SKU)', 'CANTIDAD']];
                      filtered.forEach(item => {
                          item.skus.forEach((s, idx) => {
                              if (idx === 0) wsData.push([item.ubicacion, item.totalQty, item.numSkus, s.lpn, s.sku, s.cantidad]);
                              else wsData.push(['', '', '', s.lpn, s.sku, s.cantidad]);
                          });
                      });
                      const ws = XLSX.utils.aoa_to_sheet(wsData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Reporte_Ubicacion");
                      XLSX.writeFile(wb, "Reporte_Ubicacion_Reserva.xlsx");
                  };
              }
          };

          drawSku();
          drawUbi();
      } 

      // --- RENDERIZAR RESUMEN (DASHBOARD) ---
      else if (reservaState.view === 'resumen') {
          // Fetch history data for charts
          let historyData = [];
          if (typeof fetchReservaHistory === 'function') {
              historyData = await fetchReservaHistory();
          }

          // Calculate current KPIs for top cards
          const totalSkus = reservaState.skusArray.length;
          let skuDist = { '1':0, '2_5':0, '6_8':0, '9_12':0, '13_plus':0 };
          reservaState.skusArray.forEach(s => {
              if(s.numPaletas === 1) skuDist['1']++;
              else if(s.numPaletas <= 5) skuDist['2_5']++;
              else if(s.numPaletas <= 8) skuDist['6_8']++;
              else if(s.numPaletas <= 12) skuDist['9_12']++;
              else skuDist['13_plus']++;
          });

          const totalUbis = ubicacionState.ubisArray.length;
          let ubiDist = { '1':0, '2_5':0, '6_10':0, '11_plus':0 };
          ubicacionState.ubisArray.forEach(u => {
              if(u.numSkus === 1) ubiDist['1']++;
              else if(u.numSkus <= 5) ubiDist['2_5']++;
              else if(u.numSkus <= 10) ubiDist['6_10']++;
              else ubiDist['11_plus']++;
          });

          const renderBar = (count, total, color) => {
              const pct = total > 0 ? ((count/total)*100).toFixed(1) : 0;
              return `
                  <div style="width:100px; text-align:right;">
                      <div style="font-size:var(--t-lg); font-weight:800; color:${color};">${count} <span style="font-size:var(--t-sm); color:var(--text-muted); font-weight:400;">(${pct}%)</span></div>
                      <div style="width:100%; background:rgba(var(--ink-rgb), 0.05); height:4px; border-radius:2px; margin-top:2px; overflow:hidden; position:relative;">
                          <div style="position:absolute; right:0; width:${pct}%; background:${color}; height:100%; box-shadow:0 0 5px ${color};"></div>
                      </div>
                  </div>
              `;
          };

          const rowStyle = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(var(--ink-rgb), 0.05);";

          // ─────────────────────────────────────────────────────────────────────
          // LOS DOS CUADROS, CON SU CALENDARIO.
          //
          // Se guarda UNA foto por dia —la del ancla de la NOCHE, a la hora que diga
          // Configuracion → Parametros— y el calendario deja abrir cualquiera de las
          // guardadas. Al elegir un dia pasado los cuadros se redibujan desde esa foto,
          // clic en las celdas incluido: la foto lleva el detalle de cada ubicacion.
          //
          // Se calcula ANTES y se mete DENTRO de la plantilla con ${_htmlConsol}: agregarlo
          // despues con insertAdjacentHTML no se dibujaba nunca, y costo cuatro intentos.
          // ─────────────────────────────────────────────────────────────────────
          let _htmlConsol = '', _consol = null, _baseInfo = null;
          try {
              let _fotos = [];
              try { _fotos = await fetchFotosReserva(); } catch (e) { _fotos = []; }
              if (!Array.isArray(_fotos)) _fotos = [];
              let _base = null;
              try { _base = await fetchBaseReserva(); } catch (e) { _base = null; }

              const _sello = ENT.diaDeLaFotoDeReserva(new Date());
              const _hoy = _sello ? _sello.fecha : null;
              const _elegida = window.__reservaFotoFecha || _hoy;
              const _viendoHoy = !_hoy || _elegida === _hoy;

              /* ══════════════════════════════════════════════════════════════════════
               * LA FOTO DEL DIA MANDA. EL REPORTE NO SE RECALCULA.
               *
               * Hasta la v29.0339 esta pantalla, mirando HOY, volvia a calcular todo con el
               * stock que hubiera en ese momento. Consecuencia: cuando entraba el ancla de la
               * mañana, los 30 articulos cambiaban, las 571 ubicaciones cambiaban y los 183 a
               * reducir cambiaban. Daniel, 22-ago-2026: *"ese reporte no se debe mover por mas
               * que se actualice el stock... yo tengo que dar un estatus todos los dias de
               * estos treinta articulos que ya le estoy dando a mi jefe"*.
               *
               * Y tiene razon de fondo: **un compromiso con una meta que se mueve sola no es
               * un compromiso.** Si el reporte se rearma con el stock de las 07:00, el numero
               * contra el que se mide el avance ya no es el que se prometio anoche.
               *
               * ASI QUEDA: si el dia ya tiene su foto, se muestra LA FOTO —los 30, la matriz,
               * los totales, todo—. Lo unico que se mueve es el AVANCE DEL TURNO, que lo mide
               * el robot a las 07:00 sobre esos mismos padres y viene guardado en `cierre`.
               * Se recalcula solo cuando el dia todavia no tiene foto.
               *
               * QUE TODO VENGA DE LA FOTO ADEMAS EVITA UNA CONTRADICCION: la firma de arriba
               * dice "21/08/2026 · 19:00" y el grafico termina en el punto de esa noche. Si la
               * tabla mostrara el stock de ahora, el mismo cuadro tendria dos fechas.
               * ══════════════════════════════════════════════════════════════════════ */
              /* ── EL AVANCE MIRA EL STOCK DE LA HORA; LA FOTO DEL DÍA, NO ────────────
               *
               * Regla de Daniel, 24-ago-2026: *"si lo hacemos por hora, tendría visibilidad
               * durante el turno"*. Hasta acá el cuadro entero salía de `analisis_sku_reserva`
               * —la foto del ancla—, así que lo que su gente consolidaba a las 21:00 no se veía
               * hasta que corría el ancla de la mañana. Su corte era uno al día y llegaba tarde.
               *
               * SON DOS COSAS DISTINTAS Y AHORA SE MIDEN CON DOS FOTOS DISTINTAS:
               *
               *   LA FOTO DEL DÍA —los 30 artículos, la matriz, los totales— sigue saliendo del
               *   ANCLA y no se mueve. Es el compromiso, y un compromiso con una meta que se
               *   mueve sola no es un compromiso.
               *
               *   EL AVANCE contra la base, y el detalle de ubicaciones que va al papel, salen
               *   del STOCK DE LA HORA, que el robot publica al minuto :30. Así a las 21:00 se
               *   ve lo que se lleva hecho, y a las 06:35 el turno cierra con su número.
               *
               * Es la misma solución del mapa de calor: si hay stock de la hora se usa, y si no
               * —el robot no corrió, no hay internet— se cae al del ancla y no se rompe nada. */
              const _frescoAncla = consolidacionDeReserva(rawReserva, ENT.indexarMaestro());
              let _rawHora = null, _horaSello = null;
              try {
                  const _rh = await fetch(`${ENT.TURNO_API}/${ENT.AREA_RESERVA_DE_LA_HORA}?date=MASTER&t=${Date.now()}`);
                  if (_rh.ok) {
                      const _c = await _rh.json();
                      const _d = (_c && _c.data !== undefined) ? _c.data : _c;
                      if (Array.isArray(_d) && _d.length) { _rawHora = _d; _horaSello = _c.updated_at || null; }
                  }
              } catch (e) { console.warn('[RESERVA] sin stock de la hora, se usa el del ancla:', e && e.message); }
              const _fresco = _rawHora ? consolidacionDeReserva(_rawHora, ENT.indexarMaestro()) : _frescoAncla;
              window.__reservaHoraSello = _rawHora ? (textoFechaServidor(_horaSello) || null) : null;
              /* LA FECHA CON LA QUE SE MIDIO, para poder compararla contra la de la base.
                 El rotulo de arriba es texto y no sirve para comparar. */
              window.__reservaMedidoEn = _rawHora
                  ? String(_horaSello || '').slice(0, 10)
                  : (_sello ? _sello.fecha : null);
              ENT.guardarReservaCruda(_rawHora || rawReserva);
              if (_viendoHoy) {
                  /* SE COMPARA FECHA **Y** HORA. Con los dos anclas hay dos cortes en el
                     mismo dia, asi que buscar solo por fecha haria que a las 19:00 se
                     encontrara la foto de las 07:00 y el reporte no se actualizara nunca
                     mas ese dia. La de la noche pisa a la de la mañana al guardarse. */
                  const _guardada = _fotos.find(f => f && _sello && f.fecha === _sello.fecha
                                                && String(f.hora || '') === String(_sello.hora));
                  if (_guardada) {
                      /* Lo unico que se toma del stock de ahora es el DETALLE DE UBICACIONES
                         para el Excel: la foto no lo guarda -son ~570 filas- y de nada sirve
                         mandar al montacarguista a una ubicacion de anoche. Los numeros que se
                         ven sigue poniendolos la foto; esto solo dice donde estan hoy. Si un
                         padre ya no aparece entre los fragmentados de ahora es porque se
                         consolido: no tiene paletas que bajar, y por eso va vacio. */
                      const _porPadre = new Map(((_fresco || {}).fragmentados || [])
                          .map(p => [p.padre, p.ubic]));
                      _consol = Object.assign({}, _guardada, {
                          fragmentados: (_guardada.fragmentados || []).map(
                              p => Object.assign({}, p, { ubic: _porPadre.get(p.padre) || [] }))
                      });
                  } else {
                      /* El dia todavia no tiene foto: se calcula y se guarda, una sola vez.
                         Asi el calendario se llena sin que nadie tenga que abrir nada.
                         VA CON EL ANCLA, NO CON LA DE LA HORA: la foto del dia es el
                         compromiso, y tiene que ser la misma sin importar a que hora la
                         haya abierto el primero que entro. */
                      _consol = _frescoAncla;
                      if (_consol && _sello) {
                          const _f = fotoChicaDeReserva(_consol, _sello);
                          if (_f) { guardarFotoReserva(_f).catch(() => {}); _fotos = [_f, ..._fotos]; }
                      }
                  }
              } else {
                  _consol = _fotos.find(f => f && f.fecha === _elegida) || null;
              }

              /* ══════════════════════════════════════════════════════════════════════
               * LA BASE: LOS 30 QUE NO SE MUEVEN, Y CUANTO SE LLEVA HECHO
               *
               * `reserva_base` guarda UNA fecha, no los datos: los datos ya estan en la foto
               * de ese dia. El avance se mide con el stock DE AHORA contra esos mismos
               * padres —no contra los 30 mas fragmentados de hoy, que son otros: si un
               * articulo se consolido bien, hoy ya no esta en la lista justamente porque se
               * arreglo, y buscarlo ahi lo daria por no hecho.
               *
               * EN VIVO, no esperando al robot. El robot igual mide y sella el cierre de
               * cada turno en la foto del dia; esto es el acumulado contra la base, que es
               * el numero que Daniel reporta.
               *
               * Sin base fijada, el cuadro sigue mostrando el dia, como antes. */
              if (_base && _base.fecha) {
                  const _bf = _fotos.find(f => f && f.fecha === _base.fecha);
                  if (_bf && Array.isArray(_bf.fragmentados) && _bf.fragmentados.length) {
                      const _hoyPorPadre = new Map(((_fresco || {}).fragmentados || [])
                          .map(p => [p.padre, p.ubic]));
                      _baseInfo = {
                          fecha: _bf.fecha,
                          fragmentados: _bf.fragmentados.map(
                              p => Object.assign({}, p, { ubic: _hoyPorPadre.get(p.padre) || [] })),
                          cierre: (_fresco && _fresco.padresTodos)
                              ? cierreDeFragmentados(_bf.fragmentados, _fresco.padresTodos)
                              : null
                      };
                  }
              }

              window.setReservaFotoFecha = (f) => {
                  window.__reservaFotoFecha = f || null;
                  renderAnalisisReserva(container, ENT);
              };

              /* `_guardadas` ya NO se muestra: sirve para los topes del calendario -no se
                 puede elegir un dia del que no haya foto-. El rotulo *"10 dias guardados,
                 del ... al ..."* lo hizo sacar Daniel el 22-ago-2026: *"solo deja la fecha
                 y hora en el que se proceso el reporte"*. Cuantos dias hay atras lo dice el
                 grafico, y de cuando es el dato lo dice la firma. Repetirlo era ruido. */
              const _guardadas = _fotos.map(f => f && f.fecha).filter(Boolean).sort();

              const _cal = '<div class="glass-panel" style="padding:12px 16px;margin-bottom:18px;display:flex;'
                  + 'align-items:center;gap:14px;flex-wrap:wrap;border:1px solid rgba(var(--cyan-neon-rgb), .25)">'
                  + '<div style="display:flex;align-items:center;background:rgba(var(--shadow-rgb), .45);border:1px solid #00E5FF59;'
                  + 'border-radius:8px;padding:3px 10px;gap:8px">'
                  + '<span style="font-size:var(--t-xs);color:var(--cyan-neon);font-weight:800;letter-spacing:.5px">DÍA</span>'
                  + `<input type="date" value="${_elegida || ''}" ${_guardadas.length ? `min="${_guardadas[0]}"` : ''} `
                  + `${_hoy ? `max="${_hoy}"` : ''} onchange="window.setReservaFotoFecha(this.value)" `
                  + 'style="background:transparent;border:none;color:var(--text-strong);font-size:var(--t-xs);font-weight:700;'
                  + 'outline:none;cursor:pointer;color-scheme: var(--scheme)"></div>'
                  /* LA FIRMA DE LA FOTO. Antes decia "HOY - foto de las 19:20" en verde y en
                     negrita, y competia con los numeros del cuadro. Daniel, 22-ago-2026:
                     *"en vez que pongas HOY, ponle la fecha, y que no se vea tanto: solamente
                     como una firma nada mas"*. Va en gris, sin negrita y chica: dice de cuando
                     es el dato para el que lo busque, y no le grita a nadie. */
                  + (_viendoHoy
                      ? `<span style="font-size:var(--t-xs);color:var(--text-muted);font-weight:400;letter-spacing:.3px">${
                          _sello ? _sello.fecha.split('-').reverse().join('/') : ''}${
                          _sello && _sello.hora ? ' · ' + _sello.hora : ''}</span>`
                      : `<span style="font-size:var(--t-xs);color:var(--text-muted);font-weight:400;letter-spacing:.3px">${
                          (_elegida || '').split('-').reverse().join('/')} · foto guardada</span>`
                        + ' <span onclick="window.setReservaFotoFecha(null)" style="cursor:pointer;font-size:var(--t-xs);'
                        + 'color:var(--cyan-neon);text-decoration:underline">volver a hoy</span>')
                  + '</div>';

              if (_consol) {
                  /* LA SERIE DE LA TENDENCIA sale de las fotos guardadas, no del calculo:
                     cada foto trae su matriz y de ahi se suman las ocupadas de ese dia.
                     DIEZ DIAS, que es lo que pidio Daniel: con mas, los numeros se pisan
                     entre ellos y hay que agrandar el cuadro. No se rellenan huecos ni se
                     inventan dias -si un dia no tiene foto, no aparece-, y se corta en el
                     dia que se esta mirando: mirando el 20 la curva termina el 20, no
                     adelanta lo que paso despues. */
                  const _serie = _fotos
                      .filter(f => f && f.fecha && Array.isArray(f.matriz)
                                   && (!_elegida || f.fecha <= _elegida))
                      .map(f => [f.fecha, f.matriz.reduce((s, c) => s + (c.ocupadas || 0), 0)])
                      .sort((a, b) => a[0] < b[0] ? -1 : 1)
                      .slice(-10);
                  _htmlConsol = _cal + ENT.htmlConsolidacionReserva(_consol, _serie, _baseInfo);
              } else if (!_viendoHoy) {
                  _htmlConsol = _cal + '<div class="glass-panel" style="padding:16px 18px;border:1px solid rgba(var(--warning-soft-rgb), .35)">'
                      + `<b style="color:var(--warning-soft)">No hay foto guardada del ${_elegida}.</b>`
                      + '<div style="color:var(--text-muted);font-size:var(--t-sm);margin-top:6px;line-height:1.6">'
                      + 'Se guarda una por día, en el ancla. Los días anteriores a que esto empezara '
                      + 'a funcionar no tienen foto y no se pueden reconstruir.</div></div>';
              } else {
                  const _n = ((ENT.indexarMaestro() || {}).porSku || new Map()).size;
                  _htmlConsol = _cal + '<div class="glass-panel" style="padding:16px 18px;border:1px solid rgba(var(--warning-soft-rgb), .35)">'
                      + '<b style="color:var(--warning-soft)">Los cuadros de consolidacion no se pueden armar.</b>'
                      + '<div style="color:var(--text-muted);font-size:var(--t-sm);margin-top:6px;line-height:1.6">'
                      + `Filas de reserva leidas: <b style="color:var(--text-strong)">${(rawReserva || []).length}</b><br>`
                      + `Articulos en el Maestro: <b style="color:var(--text-strong)">${_n}</b> — sin Maestro no se separa el calzado de las bolsas.`
                      + '</div></div>';
              }
          } catch (e) {
              console.error('[consolidacion reserva]', e);
              _htmlConsol = '<div class="glass-panel" style="padding:16px 18px;margin-bottom:18px;border:1px solid rgba(var(--danger-rgb), .45)">'
                + '<b style="color:var(--danger)">Los cuadros de consolidacion fallaron.</b>'
                + '<div style="color:var(--text-muted);font-size:var(--t-sm);margin-top:6px;line-height:1.6"><b style="color:var(--danger-pale)">'
                + ((e && e.name) || 'Error') + ':</b> ' + ((e && e.message) || String(e)) + '</div></div>';
          }

          viewContainer.innerHTML = `
              <!-- Las tarjetas de SKUs/Ubicaciones, la evolucion historica y los dos
                   graficos de Top 10 se quitaron el 21-ago-2026: Daniel se queda con
                   los dos cuadros de consolidacion y nada mas. El codigo que dibuja
                   esos graficos sigue abajo, protegido con if(ctx...), asi que no
                   revienta al no encontrar sus canvas; volver atras es reponer el HTML. -->
              <div style="width:70%; margin:0 auto;">
                  ${_htmlConsol}
              </div>
          `;

          ENT.engancharClicConsolidacion(viewContainer, _consol, _baseInfo);


          // Draw History Line Chart
          if (historyData.length > 0) {
              const ctxHist = document.getElementById('reservaHistoryChart');
              if (ctxHist) {
                  // Sort history by date ascending
                  historyData.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

                  const labels = historyData.map(d => {
                      const date = new Date(d.created_at);
                      return date.toLocaleDateString('es-PE', {month:'short', day:'numeric'});
                  });

                  const skusFragData = historyData.map(d => d.skus_fragmentados || 0);
                  const ubisMixtasData = historyData.map(d => d.ubicaciones_mixtas || 0);

                  new Chart(ctxHist, resolverColoresChart({
                      type: 'line',
                      data: {
                          labels: labels,
                          datasets: [
                              {
                                  label: 'SKUs Fragmentados',
                                  data: skusFragData,
                                  borderColor: '#ec4899',
                                  backgroundColor: 'rgba(236,72,153,0.1)',
                                  borderWidth: 3,
                                  tension: 0.4,
                                  fill: true,
                                  pointBackgroundColor: '#ec4899',
                                  pointBorderColor: '#fff',
                                  pointRadius: 4,
                                  pointHoverRadius: 6
                              },
                              {
                                  label: 'Ubicaciones Mixtas',
                                  data: ubisMixtasData,
                                  borderColor: '#f43f5e',
                                  backgroundColor: 'rgba(244,63,94,0.1)',
                                  borderWidth: 3,
                                  tension: 0.4,
                                  fill: true,
                                  pointBackgroundColor: '#f43f5e',
                                  pointBorderColor: '#fff',
                                  pointRadius: 4,
                                  pointHoverRadius: 6
                              }
                          ]
                      },
                      options: {
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                              legend: { labels: { color: colorTema('--text-strong'), font: { family: "'Inter', sans-serif" } } }
                          },
                          scales: {
                              y: { grid: { color: veloTema(0.05) }, ticks: { color: colorTema('--text-muted') }, beginAtZero: true },
                              x: { grid: { display: false }, ticks: { color: colorTema('--text-muted') } }
                          }
                      }
                  }));
              }
          }

          // Draw Top 10 SKUs Bar Chart
          const topSkus = reservaState.skusArray.slice(0, 10);
          const ctxSkus = document.getElementById('topSkusChart');
          if (ctxSkus && topSkus.length > 0) {
              new Chart(ctxSkus, resolverColoresChart({
                  type: 'bar',
                  data: {
                      labels: topSkus.map(s => s.sku),
                      datasets: [{
                          label: 'Cant. Paletas',
                          data: topSkus.map(s => s.numPaletas),
                          backgroundColor: 'rgba(251,191,36,0.6)',
                          borderColor: '#fbbf24',
                          borderWidth: 1,
                          borderRadius: 4
                      }]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                          y: { grid: { color: veloTema(0.05) }, ticks: { color: colorTema('--text-muted') }, beginAtZero: true },
                          x: { grid: { display: false }, ticks: { color: colorTema('--text-muted'), maxRotation: 45, minRotation: 45 } }
                      }
                  }
              }));
          }

          // Draw Top 10 Ubicaciones Bar Chart
          const topUbis = ubicacionState.ubisArray.slice(0, 10);
          const ctxUbis = document.getElementById('topUbisChart');
          if (ctxUbis && topUbis.length > 0) {
              new Chart(ctxUbis, resolverColoresChart({
                  type: 'bar',
                  data: {
                      labels: topUbis.map(u => u.ubicacion),
                      datasets: [{
                          label: 'Cant. SKUs',
                          data: topUbis.map(u => u.numSkus),
                          backgroundColor: 'rgba(244,63,94,0.6)',
                          borderColor: '#f43f5e',
                          borderWidth: 1,
                          borderRadius: 4
                      }]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                          y: { grid: { color: veloTema(0.05) }, ticks: { color: colorTema('--text-muted') }, beginAtZero: true },
                          x: { grid: { display: false }, ticks: { color: colorTema('--text-muted'), maxRotation: 45, minRotation: 45 } }
                      }
                  }
              }));
          }
      }
  };
