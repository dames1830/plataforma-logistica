// Las columnas bloqueadas y la forma real de cada zona salen de la misma configuración que
// usan las tareas. El reporte público tenía su propia copia escrita a mano y por eso seguía
// mostrando como ubicaciones vacías columnas que ya no existen.
import * as zonasService from '../services_v245/zonasService.js';

let currentLayoutZona = 'SEL';

/** El WMS escribe el mezzanine de dos formas —MZN01 y MZ01—: se aceptan las dos. */
const prefijosDeZona = (zona) => {
  const z = String(zona || '').toUpperCase();
  const m = /^MZN(\d+)$/.exec(z);
  return m ? [z, 'MZ' + m[1]] : [z];
};

export const renderLayoutActivo = async (container) => {
      // Se pide una vez; si el servidor no contesta, quedan los valores de fábrica, que ya
      // traen las columnas bloqueadas.
      try { await zonasService.cargarZonas(); } catch (e) { /* con lo de fábrica alcanza */ }
      // Indicador de carga mientras se consulta el servidor (el backend puede tardar si estaba dormido)
      if (container) container.innerHTML = `<div class="glass-panel" style="padding:4rem 2rem; text-align:center; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:1.2rem;">
          <div style="width:48px; height:48px; border:4px solid rgba(28,43,58,0.1); border-top-color:#B45309; border-radius:50%; animation:spin 1s linear infinite;"></div>
          <div><h4 style="color:var(--primary); margin:0;">Cargando mapa de calor...</h4><p style="margin:6px 0 0; font-size:0.85rem;">Obteniendo la última versión del servidor.</p></div>
      </div>`;
      let activoRaw = []; let articulosRaw = [];
      let padreStock = {};

      if (typeof window.__verLayoutAnterior === 'undefined') window.__verLayoutAnterior = false;
      // Handlers del visor de versiones (definidos temprano para que funcionen aun en el estado vacío)
      window.__toggleVerLayout = () => { window.__verLayoutAnterior = !window.__verLayoutAnterior; renderLayoutActivo(container); };

      let globalPayload = null;
      try {
          const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
          const __suf = window.__verLayoutAnterior ? '_ANT' : '';
          const res = await fetch(`${base}/api/logistics/layout_activo_${currentLayoutZona || 'SEL'}${__suf}?date=MASTER&t=${Date.now()}`);
          if (res.ok) {
              const payload = await res.json();
              if (payload && payload.data && payload.data.type === 'processed') {
                  globalPayload = payload.data;
                  window.__layoutDisplayedUpdatedAt = payload.updated_at || null;
              }
          }
      } catch(e) {}

      if (!activoRaw.length || !articulosRaw.length) {
          if (!globalPayload || globalPayload.totalUnits === 0) {
              container.innerHTML = window.__verLayoutAnterior ? `
                  <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                      <div style="font-size:3rem; margin-bottom:1rem; opacity:0.3;">🕘</div>
                      <h4 style="color:var(--primary);">Aún no hay una versión anterior de esta zona</h4>
                      <p style="max-width:600px; margin:0 auto;">La versión anterior es el mapa <b>publicado</b> previo. Aparece cuando un administrador publica esta zona por <b>segunda vez</b> (el mapa que estaba pasa a ser el anterior).</p>
                      <button onclick="window.__toggleVerLayout()" style="margin-top:1rem; background:#F4F1EC; border:1px solid #DDD8CF; color:#1C2B3A; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700;">🔵 Ver mapa actual</button>
                  </div>` : `
                  <div class="glass-panel" style="padding:3rem; text-align:center; color:var(--text-muted);">
                      <div style="font-size:3rem; margin-bottom:1rem; opacity:0.2;">🗺️</div>
                      <h4 style="color:var(--primary);">Aún no hay un mapa publicado para esta zona</h4>
                      <p>Un administrador debe procesarlo y publicarlo desde la web principal (botón <b>⚡ PROCESAR Y PUBLICAR</b>). En cuanto se publique, aparecerá aquí automáticamente.</p>
                  </div>`;
              return;
          }
      }

      const getColSafe = (row, possibleNames) => {
          if (!row) return '';
          for (const key of Object.keys(row)) {
              const upperKey = key.toUpperCase().trim();
              if (possibleNames.some(name => upperKey.includes(name.toUpperCase()))) return String(row[key]);
          }
          const raw = Array.isArray(row) ? row : Object.values(row);
          for (const name of possibleNames) {
              if (name === 'IDX0') return String(raw[0] || '');
              if (name === 'IDX1') return String(raw[1] || '');
              if (name === 'IDX2') return String(raw[2] || '');
              if (name === 'IDX3') return String(raw[3] || '');
              if (name === 'IDX4') return String(raw[4] || '');
              if (name === 'IDX5') return String(raw[5] || '');
              if (name === 'IDX7') return String(raw[7] || '');
              if (name === 'IDX10') return String(raw[10] || '');
              if (name === 'IDX13') return String(raw[13] || '');
              if (name === 'IDX14') return String(raw[14] || '');
          }
          return '';
      };

      let localLayoutData = {};
        window.globalLayoutData = window.globalLayoutData || {};
        window.globalArticulosRaw = articulosRaw;
      let localStats = { 'ACTUAL': { units: 0, bad_placed: 0, padres: new Set() }, 'ANTERIOR': { units: 0, bad_placed: 0, padres: new Set() } };
      let localTotalUnits = 0;
      let localUniquePadres = new Set();
      let localPayload = null;

      if (activoRaw.length && articulosRaw.length) {
            const skuTemporada = {};
            const skuGender = {};
            
            const idxSku = 1; // Columna B
            const idxGender = 3; // Columna D
            const idxTemp = 14; // Columna O

            articulosRaw.forEach((row, i) => {
                if (i === 0 && Array.isArray(row) && String(row[0]).toUpperCase().includes('COD')) return;
                let sku = '', temp = '', gender = '';
                if (Array.isArray(row)) {
                    sku = String(row[idxSku] || '').trim();
                    temp = String(row[idxTemp] || row[13] || '').trim();
                    gender = String(row[idxGender] || '').trim();
                } else {
                    const rawValues = Object.values(row);
                    sku = getColSafe(row, ['ARTICULO', 'ARTCULO', 'PRODUCTO', 'SKU', 'CODIGO']).trim();
                    temp = getColSafe(row, ['TEMPORADA', 'SEASON']).trim() || String(rawValues[14] || rawValues[13] || '').trim();
                    gender = getColSafe(row, ['GENDER RIMS', 'RIMS']).trim();
                }

                if (String(sku).trim().includes('6646806')) {
                    console.log("[TRACKER 6646806] Fila completa:", row);
                    console.log("[TRACKER 6646806] SKU extraído:", sku);
                    console.log("[TRACKER 6646806] Temp extraído:", temp);
                    console.log("[TRACKER 6646806] Es Array:", Array.isArray(row));
                    console.log("[TRACKER 6646806] idxTemp:", idxTemp, "Valor idxTemp:", Array.isArray(row) ? row[idxTemp] : null);
                }

                if (sku) {
                    const sku7 = sku.substring(0, 7);
                    const tUpper = temp ? temp.toUpperCase() : 'DESCONOCIDA';
                    if (!skuTemporada[sku7] || !skuTemporada[sku7].includes('ACTUAL')) skuTemporada[sku7] = tUpper;
                    if (!skuTemporada[sku] || !skuTemporada[sku].includes('ACTUAL')) skuTemporada[sku] = tUpper;
                    
                    if (!skuGender[sku7]) skuGender[sku7] = gender ? gender.toUpperCase() : '';
                    if (!skuGender[sku]) skuGender[sku] = gender ? gender.toUpperCase() : '';
                }
            });
          window.DEBUG_SKU_GENDER = skuGender;

          padreStock = {};
          activoRaw.forEach(row => {
              const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
              const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
              const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;
              if (!ubi || cant <= 0 || !skuFull) return;
              const sku7 = skuFull.substring(0, 7);
              padreStock[sku7] = (padreStock[sku7] || 0) + cant;
          });

          activoRaw.forEach(row => {
              const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX3']).trim().toUpperCase();
              const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX1']).trim();
              const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX5'])) || 0;
              
              // Sirve para cualquier zona: el prefijo sale de la zona que se está mirando.
              if (!ubi || cant <= 0 || !skuFull) return;
              const prefijos = prefijosDeZona(currentLayoutZona);
              if (!prefijos.some(p => ubi.startsWith(p))) return;

              const sku7 = skuFull.substring(0, 7);
              const totalStockForPadre = padreStock[sku7] || 0;
              const _zc = zonasService.zonasActual().zonas[currentLayoutZona];
              const isSaldo = totalStockForPadre < ((_zc && _zc.saldoMenorA) || 20);

              let col = 0;
              let rackRow = 0;

              {
                  let ubiClean = ubi;
                  prefijos.forEach(p => { ubiClean = ubiClean.split(p).join(''); });

                  const numMatches = ubiClean.match(/\d+/g);
                  if (numMatches) {
                      const allNums = numMatches.join('');
                      if (allNums.length >= 4) {
                          col = parseInt(allNums.substring(0, 2), 10);
                          rackRow = parseInt(allNums.substring(2, 4), 10);
                      } else if (numMatches.length >= 2) {
                          col = parseInt(numMatches[0], 10);
                          rackRow = parseInt(numMatches[1], 10);
                      }
                  }
              }

              if (col !== 0 && rackRow !== 0) {

                  const maxCols = (_zc && _zc.columnas) || 14;
                  const maxCue  = (_zc && _zc.cuerpos)  || 22;
                  if (col >= 1 && col <= maxCols && rackRow >= 1 && rackRow <= maxCue) {
                      if (currentLayoutZona === 'SEL' && col >= 2 && col <= 13 && (rackRow === 22 || rackRow === 11)) return;

                      if (!localLayoutData[col]) localLayoutData[col] = {};
                      if (!localLayoutData[col][rackRow]) localLayoutData[col][rackRow] = { totalQty: 0, skus: [], seasons: {} };
                      
                      const cell = localLayoutData[col][rackRow];
                      cell.totalQty += cant;
                      
                      let temporadaRaw = skuTemporada[sku7] || skuTemporada[skuFull] || 'DESCONOCIDA';
                      let temporadaClean = 'ANTERIOR'; 
                      const actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL'];
                      if (actuales.some(act => temporadaRaw.includes(act))) {
                          temporadaClean = 'ACTUAL';
                      }
                      
                      if (!cell.seasons[temporadaClean]) cell.seasons[temporadaClean] = 0;
                      cell.seasons[temporadaClean] += cant;
                      
                      const existingSku = cell.skus.find(s => s.sku === skuFull);
                      if (existingSku) existingSku.cant += cant;
                      else cell.skus.push({ sku: skuFull, cant, temporada: temporadaClean === 'ACTUAL' ? 'T. Actual' : 'T. Anterior' });

                      localUniquePadres.add(sku7);
                      localTotalUnits += cant;
                      localStats[temporadaClean].units += cant;
                      localStats[temporadaClean].padres.add(sku7);

                      // Si está bien ubicado sale de Zonas de Almacenaje, igual que en la web
                      // principal. Antes acá estaban las columnas del selectivo escritas a
                      // mano —5 a 13 actual, 3 a 4 anterior— y ya no coincidían con la
                      // configuración publicada, así que los dos reportes se contradecían.
                      const genderRaw = skuGender[skuFull] || skuGender[sku7] || '';
                      const isSchool = genderRaw.includes('SCHOOL');
                      const franjaCol = zonasService.franjaDeColumna(currentLayoutZona, col);

                      let isValid;
                      if (!_zc || !_zc.franjas || !Object.keys(_zc.franjas).length) {
                          isValid = true;                        // zona sin reglas: no se acusa a nadie
                      } else if (franjaCol === 'escolar')  isValid = isSchool;
                      else if (franjaCol === 'saldos')     isValid = isSaldo;
                      else if (franjaCol === 'catalogo')   isValid = true;   // la 8 de MZN03 acepta todo
                      else if (franjaCol === 'actual')     isValid = (temporadaClean === 'ACTUAL');
                      else if (franjaCol === 'anterior')   isValid = (temporadaClean === 'ANTERIOR');
                      else                                 isValid = false;  // columna sin uso

                      if (!isValid) {
                          localStats[temporadaClean].bad_placed += cant;
                      }
                  }
              }
          });
          
          localStats['ACTUAL'].padres = Array.from(localStats['ACTUAL'].padres);
          localStats['ANTERIOR'].padres = Array.from(localStats['ANTERIOR'].padres);

          localPayload = {
              type: 'processed',
              layoutData: localLayoutData,
              stats: localStats,
              totalUnits: localTotalUnits,
              uniquePadresSize: localUniquePadres.size
          };
      }

      let reservaPayload = null;
      let reservaRaw = [];
      let globalPayloadReserva = null;
      try {
          const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
          const res = await fetch(`${base}/api/logistics/layout_reserva?t=${Date.now()}`);
          if (res.ok) {
              const payload = await res.json();
              if (payload && payload.data && payload.data.type === 'processed') {
                  globalPayloadReserva = payload.data;
              }
          }
      } catch(e) {}

      if (reservaRaw.length > 2 && articulosRaw.length) {
          let localLayoutDataRes = {};
          let localStatsRes = { 'ACTUAL': { units: 0, bad_placed: 0, padres: new Set() }, 'ANTERIOR': { units: 0, bad_placed: 0, padres: new Set() } };
          let localTotalUnitsRes = 0;
          let localUniquePadresRes = new Set();
          
          const skuTemporada = {};
          const skuGender = window.DEBUG_SKU_GENDER || {};
            const idxSku = 1; // Columna B
            const idxTemp = 14; // Columna O

            articulosRaw.forEach((row, i) => {
                if (i === 0 && Array.isArray(row) && String(row[0]).toUpperCase().includes('COD')) return;
                
                let sku = '', temp = '';
                if (Array.isArray(row)) {
                    sku = String(row[idxSku] || '').trim();
                    temp = String(row[idxTemp] || '').trim();
                } else {
                    sku = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'CODIGO']).trim();
                    temp = getColSafe(row, ['TEMPORADA', 'SEASON']).trim();
                }

                if (sku) {
                    const sku7 = sku.substring(0, 7);
                    const tUpper = temp ? temp.toUpperCase() : 'DESCONOCIDA';
                    if (!skuTemporada[sku7] || !skuTemporada[sku7].includes('ACTUAL')) skuTemporada[sku7] = tUpper;
                    if (!skuTemporada[sku] || !skuTemporada[sku].includes('ACTUAL')) skuTemporada[sku] = tUpper;
                }
            });

          const usableReserva = reservaRaw.slice(2);
          
          usableReserva.forEach(row => {
              const nivel = getColSafe(row, ['NIVEL', 'IDX1']).trim().toUpperCase();
              const ubi = getColSafe(row, ['UBICACI', 'LOCATION', 'UBI', 'IDX4']).trim().toUpperCase();
              const skuFull = getColSafe(row, ['ARTICULO', 'ARTÍCULO', 'PRODUCTO', 'SKU', 'ITEM', 'IDX7']).trim();
              const cant = parseFloat(getColSafe(row, ['CANTIDAD', 'QTY', 'STOCK', 'IDX10'])) || 0;
              
              if (nivel !== 'ALTO') return;
              if (!ubi || !ubi.startsWith('SEL') || cant <= 0 || !skuFull) return;
              
              const sku7 = skuFull.substring(0, 7);
              const match = ubi.match(/SEL[- ]?(\d+)\D+(\d+)/);
              if (match) {
                  const col = parseInt(match[1], 10);
                  const rackRow = parseInt(match[2], 10);
                  
                  const totalStockForPadreRes = padreStock[sku7] || 0;
                  const isSaldo = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? totalStockForPadreRes < 80 : totalStockForPadreRes < 20;
                  
                  let maxColsRes = (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') ? 24 : 14;
                  if (col >= 1 && col <= maxColsRes && rackRow >= 1 && rackRow <= 22) {
                      if (!localLayoutDataRes[col]) localLayoutDataRes[col] = {};
                      if (!localLayoutDataRes[col][rackRow]) localLayoutDataRes[col][rackRow] = { totalQty: 0, skus: [], seasons: {} };
                      
                      const cell = localLayoutDataRes[col][rackRow];
                      cell.totalQty += cant;
                      
                      let temporadaRaw = skuTemporada[sku7] || skuTemporada[skuFull] || 'DESCONOCIDA';
                      let temporadaClean = 'ANTERIOR'; 
                      const actuales = ['2026-Q3', '2026-Q4', '2027-Q1', '2027-Q2', 'ACTUAL'];
                      if (actuales.some(act => temporadaRaw.includes(act))) {
                          temporadaClean = 'ACTUAL';
                      }
                      
                      if (!cell.seasons[temporadaClean]) cell.seasons[temporadaClean] = 0;
                      cell.seasons[temporadaClean] += cant;
                      
                      const existingSku = cell.skus.find(s => s.sku === skuFull);
                      if (existingSku) existingSku.cant += cant;
                      else cell.skus.push({ sku: skuFull, cant, temporada: temporadaClean === 'ACTUAL' ? 'T. Actual' : 'T. Anterior' });

                      localUniquePadresRes.add(sku7);
                      localTotalUnitsRes += cant;
                      localStatsRes[temporadaClean].units += cant;
                      localStatsRes[temporadaClean].padres.add(sku7);

                      let isValid = false;
                      const genderRaw = skuGender[skuFull] || skuGender[sku7] || '';
                      const isSchool = genderRaw.includes('SCHOOL');

                      if (currentLayoutZona === 'SEL') {
                          if (col === 14) {
                              if (isSchool) isValid = true;
                          } else if (temporadaClean === 'ACTUAL') {
                              if (col >= 5 && col <= 13) isValid = true;
                              else if (isSaldo && [1, 2].includes(col)) isValid = true;
                          } else if (temporadaClean === 'ANTERIOR') {
                              if (col >= 3 && col <= 4) isValid = true;
                              else if (isSaldo && [1, 2].includes(col)) isValid = true;
                          }
                      } else if (currentLayoutZona === 'MZN01' || currentLayoutZona === 'MZN02') {
                            isValid = true;
                      } else {
                          isValid = true;
                      }

                      if (!isValid) {
                          localStatsRes[temporadaClean].bad_placed += cant;
                      }
                  }
              }
          });
          
          localStatsRes['ACTUAL'].padres = Array.from(localStatsRes['ACTUAL'].padres);
          localStatsRes['ANTERIOR'].padres = Array.from(localStatsRes['ANTERIOR'].padres);

          reservaPayload = {
              type: 'processed',
              layoutData: localLayoutDataRes,
              stats: localStatsRes,
              totalUnits: localTotalUnitsRes,
              uniquePadresSize: localUniquePadresRes.size
          };
      }

      const buildLayoutHTML = (layoutData, stats, totalUnits, uniquePadresSize, targetContainer, isGlobal = false, isReserva = false, hasLocalPayload = false) => {
          const zonaLabel = isReserva ? 'SEL' : currentLayoutZona;
          
          window.__buildLayoutHTML = buildLayoutHTML;
          let occupiedCells = 0;
          // OJO CON EL ORDEN: las barras van ANTES de abrir la fila del mapa, no adentro.
          // Adentro se convierten en una columna más y, como la fila estira a sus hijos, se
          // pintan de arriba abajo y tapan el mapa de calor entero.
          let gridHtml = '';
          
          // La forma de la zona sale de la configuración, igual que en la web principal.
          const _zCfg = zonasService.zonasActual().zonas[currentLayoutZona];
          const esMezzanine = /^MZN/.test(currentLayoutZona);
          const totalCols = (!isReserva && _zCfg) ? _zCfg.columnas : 14;
          const maxRows   = (!isReserva && _zCfg) ? _zCfg.cuerpos  : 22;
          let colsArray = [];
          if (esMezzanine) {
              for (let i = totalCols; i >= 1; i--) colsArray.push(i);
          } else {
              for (let i = 1; i <= totalCols; i++) colsArray.push(i);
          }

          // De quién es cada columna. Solo en las zonas que comparten marcas —hoy MZN01 y
          // MZN03—; mismo criterio que en la web principal.
          const escP = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
          const marcasZona = (!isReserva && _zCfg) ? zonasService.marcasDeZona(currentLayoutZona) : [];
          const hayVariasMarcas = marcasZona.length > 1;
          const duenoDe = (c) => hayVariasMarcas
              ? zonasService.duenoDeColumna(currentLayoutZona, c) : null;

          // El scroll envuelve a las barras y al mapa: si lo tuviera solo el mapa, al
          // desplazarlo las barras se quedarían quietas y dejarían de coincidir.
          gridHtml += `<div style="width:100%; overflow-x:auto; padding-bottom:15px;"><div style="min-width:100%;">`;

          // Arriba, la temporada de cada columna. En todas las zonas.
          const FR = zonasService.FRANJAS;
          const hayFranjas = !isReserva && _zCfg && Object.keys(_zCfg.franjas || {}).length > 0;

          // Las columnas bloqueadas se achican a una tira fina y las buenas se reparten el
          // espacio que sobra. Mismo criterio que la web principal, y la MISMA funcion para
          // la barra y para el mapa: si no, dejarian de coincidir columna con columna.
          const anchoDe = (c) => (!isReserva && zonasService.esColumnaBloqueada(currentLayoutZona, c))
              ? 'flex:0 0 13px; min-width:13px; max-width:13px;'
              : 'flex:1 1 0; min-width:40px;';
          if (hayFranjas) {
              gridHtml += `<div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:5px;">`;
              colsArray.forEach(c => {
                  const bloq = zonasService.esColumnaBloqueada(currentLayoutZona, c);
                  const f = zonasService.franjaDeColumna(currentLayoutZona, c);
                  const d = FR[f] || FR.ninguna;
                  const vale = !bloq && f !== 'ninguna';
                  gridHtml += `<div title="${escP(d.etiqueta)}" style="${anchoDe(c)}
                      height:15px; line-height:15px; box-sizing:border-box; border-radius:4px 4px 0 0;
                      background:${vale ? d.color : 'rgba(0,0,0,0.06)'}; text-align:center;
                      font-size:8px; font-weight:900; color:#1C2B3A; letter-spacing:-0.2px;
                      white-space:nowrap; overflow:hidden; ${bloq ? 'opacity:0.25;' : ''}">${
                      vale ? escP(d.corta) : ''}</div>`;
              });
              gridHtml += `</div>`;
          }

          gridHtml += `<div style="display:flex; justify-content:space-between; gap:10px; width:100%;">`;

          for (let c of colsArray) {
              // Columna bloqueada: no existe. Mismo criterio que en la web principal.
              if (!isReserva && zonasService.esColumnaBloqueada(currentLayoutZona, c)) {
                  gridHtml += `<div title="Columna ${String(c).padStart(2,'0')} · bloqueada" style="display:flex; flex-direction:column; gap:2px; ${anchoDe(c)} opacity:0.28;">`;
                  for (let r = maxRows; r >= 1; r--) {
                      gridHtml += `<div style="height:15px; border:1px dashed rgba(255,255,255,0.10); background:repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0 3px,transparent 3px 6px);"></div>`;
                  }
                  gridHtml += `<div style="text-align:center; font-size:0.75rem; color:#64748b; font-weight:900; margin-top:8px; text-decoration:line-through;">${String(c).padStart(2,'0')}</div>`;
                  gridHtml += `</div>`;
                  continue;
              }
              // Los macizos arrancan más arriba: los cuerpos que le faltan a la columna van
              // ABAJO, así que el que se dibuja en la posición 4 es el cuerpo 1.
              const topeCol = (!isReserva && _zCfg)
                  ? zonasService.cuerposDeColumna(currentLayoutZona, c) : maxRows;
              const faltanAbajo = Math.max(0, maxRows - topeCol);

              gridHtml += `<div style="display:flex; flex-direction:column; gap:2px; ${anchoDe(c)}">`;
              for (let r = maxRows; r >= 1; r--) {
                  let cellExists = true;
                  if (!isReserva && r <= faltanAbajo) cellExists = false;

                  const logicalR = r - faltanAbajo;
                  if (cellExists && !isReserva && _zCfg
                      && zonasService.esPasillo(currentLayoutZona, c, logicalR)) {
                      cellExists = false;
                  }

                  if (!cellExists) {
                      gridHtml += `<div style="height:15px; visibility:hidden;"></div>`;
                      continue;
                  }

                  const cellData = layoutData[c] && layoutData[c][logicalR] ? layoutData[c][logicalR] : null;
                  let bgColor = '#EEE9E3';
                  let tooltipHTML = `<b>${zonaLabel} ${String(c).padStart(2,'0')} - Cuerpo ${logicalR}</b><br/>Vacío`;
                  let fullTooltipHTML = tooltipHTML;
                  
                  if (cellData) {
                      occupiedCells++;
                      const seasons = Object.keys(cellData.seasons);
                      if (seasons.length > 1) {
                          bgColor = 'linear-gradient(135deg, #fbbf24 0%, #ec4899 100%)'; 
                      } else if (seasons[0] === 'ACTUAL') {
                          bgColor = '#3b82f6'; 
                      } else {
                          bgColor = '#ef4444'; 
                      }
                      
                      tooltipHTML = `<b>${zonaLabel} ${String(c).padStart(2,'0')} - Cuerpo ${logicalR}</b><br/>
                                     Total Unid: ${cellData.totalQty}<br/>
                                     SKUs: ${cellData.skus.length}<br/><hr style='border-color:rgba(255,255,255,0.1); margin:4px 0;'/>`;
                      fullTooltipHTML = tooltipHTML;
                      cellData.skus.forEach((s, idx) => {
                          const s7 = s.sku.substring(0, 7);
                          const g = window.DEBUG_SKU_GENDER ? (window.DEBUG_SKU_GENDER[s.sku] || window.DEBUG_SKU_GENDER[s7] || 'VACÍO') : 'N/A';
                          const itemHTML = `<span style='font-size:0.75rem; color:#ccc;'>${s.sku} (${s.cant}) - ${s.temporada} [${g}]</span><br/>`;
                          if (idx < 5) tooltipHTML += itemHTML;
                          fullTooltipHTML += itemHTML;
                      });
                      if(cellData.skus.length > 5) tooltipHTML += `<span style='font-size:0.75rem; color:#ccc;'>...y ${cellData.skus.length-5} más</span>`;
                  }
                  
                  gridHtml += `
                      <div class="layout-cell" 
                           style="height:15px; border:1px solid rgba(28,43,58,0.08); background:${bgColor}; cursor:pointer; position:relative;"
                           onmouseover="window.showTooltip(event, this.getAttribute('data-tooltip'))"
                           onmouseout="window.hideTooltip()"
                           onclick="window.showCellModal(this.getAttribute('data-full-tooltip'))"
                           data-tooltip="${tooltipHTML.replace(/"/g, '&quot;')}"
                           data-full-tooltip="${fullTooltipHTML.replace(/"/g, '&quot;')}">
                      </div>
                  `;
              }
              gridHtml += `<div style="text-align:center; font-size:0.68rem; color:#1C2B3A; font-weight:700; margin-top:8px;">${String(c).padStart(2,'0')}</div>`;
              if (hayVariasMarcas) {
                  const d = duenoDe(c);
                  gridHtml += `<div style="height:4px; border-radius:2px; margin-top:5px;
                      background:${d ? d.color : 'rgba(0,0,0,0.08)'};"></div>`;
                  gridHtml += `<div title="${d ? escP(d.marca) : ''}" style="text-align:center;
                      font-size:9.5px; font-weight:900; margin-top:3px; letter-spacing:0.3px;
                      color:${d ? d.color : 'rgba(0,0,0,0.25)'};">${d ? escP(d.sigla) : ''}</div>`;
              }
              gridHtml += `</div>`;
          }
          gridHtml += `</div></div></div>`;   // fila del mapa · ancho mínimo · scroll

          window.globalLayoutData[currentLayoutZona] = localLayoutData;
            let ACTUAL_TOTAL_CELLS = 14 * 22;
          if (!isReserva && zonasService.zonasActual().zonas[currentLayoutZona]) {
              // Misma fuente que la web principal, para que los dos números coincidan.
              ACTUAL_TOTAL_CELLS = zonasService.cuerposDe(currentLayoutZona).length;
          }
          const emptyCellsCount = ACTUAL_TOTAL_CELLS - occupiedCells;
          const densidad = occupiedCells > 0 ? (totalUnits / occupiedCells).toFixed(1) : '0';

          const calcPerc = (s) => s.units > 0 ? (((s.units - s.bad_placed) / s.units) * 100).toFixed(1) : '0.0';
          const actualPerc = calcPerc(stats['ACTUAL']);
          const anteriorPerc = calcPerc(stats['ANTERIOR']);
          
          const statsGeneral = {
              units: stats['ACTUAL'].units + stats['ANTERIOR'].units,
              bad_placed: stats['ACTUAL'].bad_placed + stats['ANTERIOR'].bad_placed
          };
          const generalPerc = calcPerc(statsGeneral);

          const now = new Date();
          const timestampStr = window.__layoutHeaderTs || `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
          
          const statsActualPadresSize = Array.isArray(stats['ACTUAL'].padres) ? stats['ACTUAL'].padres.length : (stats['ACTUAL'].padres ? stats['ACTUAL'].padres.size : 0);
          const statsAnteriorPadresSize = Array.isArray(stats['ANTERIOR'].padres) ? stats['ANTERIOR'].padres.length : (stats['ANTERIOR'].padres ? stats['ANTERIOR'].padres.size : 0);
          
          const percArtActual = uniquePadresSize > 0 ? Math.round((statsActualPadresSize / uniquePadresSize) * 100) : 0;
          const percArtAnterior = uniquePadresSize > 0 ? Math.round((statsAnteriorPadresSize / uniquePadresSize) * 100) : 0;
          const percUnidActual = totalUnits > 0 ? Math.round((stats['ACTUAL'].units / totalUnits) * 100) : 0;
          const percUnidAnterior = totalUnits > 0 ? Math.round((stats['ANTERIOR'].units / totalUnits) * 100) : 0;

          const btnCompartir = '';

          const btnVerVersion = (!isReserva) ? `
              <button title="Alterna entre el mapa ACTUAL y el ANTERIOR" onclick="window.__toggleVerLayout()" style="background:${window.__verLayoutAnterior ? 'rgba(180,83,9,0.08)' : '#F4F1EC'}; border:1px solid ${window.__verLayoutAnterior ? '#B45309' : '#DDD8CF'}; color:${window.__verLayoutAnterior ? '#B45309' : '#1C2B3A'}; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:5px;">
                  ${window.__verLayoutAnterior ? '🔵 Ver mapa actual' : '🕘 Ver mapa anterior'}
              </button>
          ` : '';

          const btnSincronizar = '';

          const brandTitle = currentLayoutZona === 'MZN01' ? 'BG Y POWER' : (currentLayoutZona === 'MZN02' ? 'NORTH STAR' : 'BATA');
          const isMZN = currentLayoutZona.startsWith('MZN');
          
          targetContainer.innerHTML = `
                <div style="display:flex; width:100%; gap:20px; flex-direction:row; align-items:flex-start;">
                    <div class="glass-panel" style="padding:20px; position:relative; flex: 0 0 70%; max-width: 70%; min-width:0; overflow-x:auto; background:#FFFFFF; border:1px solid #DDD8CF; min-height:500px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                          <h3 style="color:#1C2B3A; margin:0; font-size:1.2rem; display:flex; align-items:center; gap:10px;">
                              <span style="font-size:1.5rem;">🗺️</span>
                              ${isReserva ? `LAYOUT RESERVA - ${brandTitle}` : `LAYOUT ${zonaLabel} - ${brandTitle}`}
                              ${isGlobal ? '<span style="font-size:0.65rem; background:rgba(180,83,9,0.1); color:#B45309; border:1px solid rgba(180,83,9,0.4); padding:2px 8px; border-radius:3px; font-weight:800; letter-spacing:1px;">GLOBAL</span>' : ''}
                              ${(!isReserva && window.__verLayoutAnterior) ? '<span style="font-size:0.65rem; background:rgba(180,83,9,0.1); color:#B45309; border:1px solid rgba(180,83,9,0.4); padding:2px 8px; border-radius:3px; font-weight:800; letter-spacing:1px;">VERSIÓN ANTERIOR</span>' : ''}
                          </h3>
                          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                              <div style="text-align:right; font-size:0.8rem; color:#9C9590; font-weight:600; border:1px solid #DDD8CF; padding:4px 10px; border-radius:4px; background:#F4F1EC;">
                                  🕒 ${timestampStr}
                              </div>
                              ${btnVerVersion}
                              ${btnCompartir}
                              ${btnSincronizar}
                          </div>
                      </div>
                      
                      <div style="display:flex; gap:15px; font-size:0.8rem; font-weight:800; justify-content:center; margin-bottom:20px;">
                          <div style="display:flex; align-items:center; gap:5px; color:#4A4540;"><div style="width:15px; height:15px; background:#ef4444; border:1px solid rgba(0,0,0,0.1);"></div> T. Anterior</div>
                          <div style="display:flex; align-items:center; gap:5px; color:#4A4540;"><div style="width:15px; height:15px; background:#3b82f6; border:1px solid rgba(0,0,0,0.1);"></div> T. Actual</div>
                          <div style="display:flex; align-items:center; gap:5px; color:#4A4540;"><div style="width:15px; height:15px; background:linear-gradient(135deg, #fbbf24 0%, #ec4899 100%); border:1px solid rgba(0,0,0,0.1);"></div> Mixto</div>
                          <div style="display:flex; align-items:center; gap:5px; color:#4A4540;"><div style="width:15px; height:15px; background:#EEE9E3; border:1px solid #DDD8CF;"></div> Vacío</div>
                      </div>
                      
                      <div style="display:flex; gap:10px;">
                          <div style="display:flex; flex-direction:column; gap:2px; padding-right:5px; font-size:0.65rem; color:var(--text-muted); font-weight:800; text-align:right; padding-top:1px;">
                              ${Array.from({length:maxRows}, (_,i) => maxRows-i).map(n => `<div style="height:15px; display:flex; align-items:center; justify-content:flex-end;">${n}</div>`).join('')}
                          </div>
                          ${gridHtml}
                      </div>
                  </div>

                  <div style="flex: 0 0 calc(30% - 20px); max-width: calc(30% - 20px); display:flex; flex-direction:column; gap:20px;">
                      
                      <div class="glass-panel" style="padding:20px; display:flex; flex-direction:column; gap:20px; border:1px solid #DDD8CF;">
                          <div>
                              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #DDD8CF; padding-bottom:8px; margin-bottom:15px;">
                                  <h4 style="color:#1C2B3A; font-weight:800; font-size:0.95rem; margin:0;">📊 RESUMEN GLOBAL ${zonaLabel}</h4>
                                  <span style="font-size:0.75rem; color:var(--text-muted);">🕒 ${timestampStr}</span>
                              </div>

                              <div style="margin-bottom:15px; background:#F4F1EC; padding:12px; border-radius:6px; border:1px solid #DDD8CF;">
                                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                      <span style="color:var(--text-muted); font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Artículos (Padres)</span>
                                      <span style="font-weight:800; color:#1C2B3A; font-size:1.1rem;">${uniquePadresSize.toLocaleString()}</span>
                                  </div>

                                  <div style="width:100%; height:6px; background:#EEE9E3; border-radius:3px; display:flex; overflow:hidden; margin-bottom:6px;">
                                      <div style="width:${percArtActual}%; background:#3b82f6; height:100%; transition:width 1s ease;"></div>
                                      <div style="width:${percArtAnterior}%; background:#ef4444; height:100%; transition:width 1s ease;"></div>
                                  </div>
                                  
                                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800;">
                                      <span style="color:#3b82f6; display:flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#3b82f6;"></div> Actual ${percArtActual}%</span>
                                      <span style="color:#ef4444; display:flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#ef4444;"></div> Anterior ${percArtAnterior}%</span>
                                  </div>
                              </div>
                              
                              <div style="margin-bottom:15px; background:#F4F1EC; padding:12px; border-radius:6px; border:1px solid #DDD8CF;">
                                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                      <span style="color:var(--text-muted); font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Unidades Totales</span>
                                      <span style="font-weight:800; color:#1C2B3A; font-size:1.1rem;">${totalUnits.toLocaleString()}</span>
                                  </div>

                                  <div style="width:100%; height:6px; background:#EEE9E3; border-radius:3px; display:flex; overflow:hidden; margin-bottom:6px;">
                                      <div style="width:${percUnidActual}%; background:#3b82f6; height:100%; transition:width 1s ease;"></div>
                                      <div style="width:${percUnidAnterior}%; background:#ef4444; height:100%; transition:width 1s ease;"></div>
                                  </div>
                                  
                                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800;">
                                      <span style="color:#3b82f6; display:flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#3b82f6;"></div> Actual ${percUnidActual}%</span>
                                      <span style="color:#ef4444; display:flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#ef4444;"></div> Anterior ${percUnidAnterior}%</span>
                                  </div>
                              </div>
                              
                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                                  <div style="background:#F4F1EC; padding:12px; border-radius:6px; border:1px solid #DDD8CF; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                                      <span style="color:var(--text-muted); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:4px; text-align:center;">Ubicaciones Vacías</span>
                                      <span style="font-weight:800; color:#1C2B3A; font-size:1.2rem;">${emptyCellsCount.toLocaleString()}</span>
                                  </div>
                                  <div style="background:#F4F1EC; padding:12px; border-radius:6px; border:1px solid #DDD8CF; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                                      <span style="color:var(--text-muted); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:4px; text-align:center;">Densidad (Unid/Ubi)</span>
                                      <span style="font-weight:800; color:#1C2B3A; font-size:1.2rem;">${densidad}</span>
                                  </div>
                              </div>
                          </div>
                          
                          ${isMZN ? `
                      </div>
                      
                      <div class="glass-panel" style="width: 100%; max-width: 1450px; padding:20px; display:flex; flex-direction:row; gap:20px; justify-content: space-between; border:1px solid #DDD8CF;">
                          ` : ''}
                          
                          <div style="flex: 1;">
                              <h4 style="color:#1C2B3A; font-weight:800; border-bottom:1px solid #DDD8CF; padding-bottom:8px; margin-bottom:10px; font-size:0.95rem;">🎯 CUMPLIMIENTO POR TEMPORADA ${zonaLabel}</h4>
                              
                              <div style="background:rgba(59,130,246,0.1); border-left:3px solid #3b82f6; padding:10px; margin-bottom:15px; border-radius:4px;">
                                  <div style="display:flex; justify-content:space-between; font-weight:800; color:#3b82f6; margin-bottom:8px; font-size:0.95rem;">
                                      <span>T. Actual</span>
                                      <span>${actualPerc}%</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Artículos (Padre)</span>
                                      <span style="color:#1C2B3A;">${statsActualPadresSize.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Unidades</span>
                                      <span style="color:#1C2B3A;">${stats['ACTUAL'].units.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                      <span style="cursor:help;" onmouseover="window.showTooltip(event, 'Unidades >= 20 que NO están en SEL 6-13')" onmouseout="window.hideTooltip()">Desviación (>20u) ℹ️</span>
                                      <span style="color:#ef4444;">${stats['ACTUAL'].bad_placed.toLocaleString()} mal ubicadas</span>
                                  </div>
                              </div>

                              <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:10px; border-radius:4px;">
                                  <div style="display:flex; justify-content:space-between; font-weight:800; color:#ef4444; margin-bottom:8px; font-size:0.95rem;">
                                      <span>T. Anterior</span>
                                      <span>${anteriorPerc}%</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Artículos (Padre)</span>
                                      <span style="color:#1C2B3A;">${statsAnteriorPadresSize.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Unidades</span>
                                      <span style="color:#1C2B3A;">${stats['ANTERIOR'].units.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                      <span style="cursor:help;" onmouseover="window.showTooltip(event, 'Unidades >= 20 que NO están en SEL 3-5')" onmouseout="window.hideTooltip()">Desviación (>20u) ℹ️</span>
                                      <span style="color:#ef4444;">${stats['ANTERIOR'].bad_placed.toLocaleString()} mal ubicadas</span>
                                  </div>
                              </div>

                              <div style="background:rgba(139,92,246,0.1); border-left:3px solid #8b5cf6; padding:10px; border-radius:4px; margin-top:15px;">
                                  <div style="display:flex; justify-content:space-between; font-weight:800; color:#8b5cf6; margin-bottom:8px; font-size:0.95rem;">
                                      <span>TOTAL GENERAL</span>
                                      <span>${generalPerc}%</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Artículos (Padre)</span>
                                      <span style="color:#1C2B3A;">${uniquePadresSize.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">
                                      <span>Unidades</span>
                                      <span style="color:#1C2B3A;">${statsGeneral.units.toLocaleString()}</span>
                                  </div>
                                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
                                      <span style="cursor:help;" onmouseover="window.showTooltip(event, 'Desviación general total')" onmouseout="window.hideTooltip()">Desviación (>20u) ℹ️</span>
                                      <span style="color:#ef4444;">${statsGeneral.bad_placed.toLocaleString()} mal ubicadas</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div class="glass-panel" style="flex: 1; padding:20px; border:1px solid #DDD8CF;">
                          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #DDD8CF; padding-bottom:8px; margin-bottom:15px;">
                              <h4 style="color:#1C2B3A; font-weight:800; font-size:0.95rem; margin:0;">REPORTE ${zonaLabel} - ${brandTitle}</h4>
                              <span style="font-size:0.75rem; color:var(--text-muted);">🕒 ${timestampStr}</span>
                          </div>
                          <div style="display:flex; justify-content:space-around; align-items:center; gap:10px;">
                              
                              <div style="display:flex; flex-direction:column; align-items:center;">
                                  <div style="position:relative; width:120px; height:120px;">
                                      <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                          <path stroke="rgba(28,43,58,0.1)" fill="none" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#ef4444" fill="none" stroke-width="4" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#3b82f6" fill="none" stroke-width="4" stroke-dasharray="${actualPerc}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                      </svg>
                                      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                          <span style="font-size:1.2rem; font-weight:800; color:#1C2B3A;">${actualPerc}%</span>
                                          <span style="font-size:0.55rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Avance</span>
                                      </div>
                                  </div>
                                  <div style="margin-top:10px; font-size:0.75rem; font-weight:800; color:#3b82f6;">T. ACTUAL</div>
                              </div>

                              <div style="display:flex; flex-direction:column; align-items:center;">
                                  <div style="position:relative; width:120px; height:120px;">
                                      <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                          <path stroke="rgba(28,43,58,0.1)" fill="none" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#ef4444" fill="none" stroke-width="4" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#10b981" fill="none" stroke-width="4" stroke-dasharray="${anteriorPerc}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                      </svg>
                                      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                          <span style="font-size:1.2rem; font-weight:800; color:#1C2B3A;">${anteriorPerc}%</span>
                                          <span style="font-size:0.55rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Avance</span>
                                      </div>
                                  </div>
                                  <div style="margin-top:10px; font-size:0.75rem; font-weight:800; color:#10b981;">T. ANTERIOR</div>
                              </div>

                              <div style="display:flex; flex-direction:column; align-items:center;">
                                  <div style="position:relative; width:120px; height:120px;">
                                      <svg viewBox="0 0 36 36" style="width:100%; height:100%; transform: rotate(-90deg);">
                                          <path stroke="rgba(28,43,58,0.1)" fill="none" stroke-width="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#ef4444" fill="none" stroke-width="4" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          <path stroke="#8b5cf6" fill="none" stroke-width="4" stroke-dasharray="${generalPerc}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                      </svg>
                                      <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                                          <span style="font-size:1.2rem; font-weight:800; color:#1C2B3A;">${generalPerc}%</span>
                                          <span style="font-size:0.55rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Avance</span>
                                      </div>
                                  </div>
                                  <div style="margin-top:10px; font-size:0.75rem; font-weight:800; color:#8b5cf6;">GENERAL</div>
                              </div>

                          </div>
                          
                          <div style="display:flex; justify-content:center; gap:15px; margin-top:15px; font-size:0.7rem; font-weight:800; color:var(--text-muted);">
                              <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#ef4444;"></div> Desviación</div>
                              <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#3b82f6;"></div> T. Actual</div>
                              <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#10b981;"></div> T. Anterior</div>
                              <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:#8b5cf6;"></div> General</div>
                          </div>

                      </div>
                  </div>
              </div>
          `;

          if (!window._layoutTooltipSetup) {
              window._layoutTooltipSetup = true;
              let tt = document.getElementById('layout-tooltip');
              if (!tt) {
                  tt = document.createElement('div');
                  tt.id = 'layout-tooltip';
                  tt.style.position = 'fixed';
                  tt.style.background = 'rgba(0,0,0,0.85)';
                  tt.style.color = '#fff';
                  tt.style.padding = '10px 15px';
                  tt.style.borderRadius = '8px';
                  tt.style.pointerEvents = 'none';
                  tt.style.fontSize = '0.8rem';
                  tt.style.zIndex = '99999';
                  tt.style.display = 'none';
                  tt.style.border = '1px solid rgba(255,255,255,0.1)';
                  tt.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
                  tt.style.backdropFilter = 'blur(4px)';
                  document.body.appendChild(tt);
              }

window.showCellModal = function(htmlContent) {
    const modalHtml = `
        <div id="custom-cell-modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:99999; display:flex; justify-content:center; align-items:center;">
            <div style="background:#FFFFFF; border:1px solid #DDD8CF; border-radius:6px; padding:20px; min-width:300px; max-width:90vw; max-height:80vh; overflow-y:auto; box-shadow:0 4px 16px rgba(28,43,58,0.12); position:relative;">
                <button onclick="document.getElementById('custom-cell-modal-overlay').remove()" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:#9C9590; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
                <div style="color:#1C2B3A; font-family:sans-serif; line-height:1.5; margin-top:10px;">
                    ${htmlContent}
                </div>
            </div>
        </div>
    `;
    const oldModal = document.getElementById('custom-cell-modal-overlay');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

              window.showTooltip = (e, html) => {
                  if(!html) return;
                  tt.innerHTML = html;
                  tt.style.display = 'block';
                  tt.style.left = (e.clientX + 15) + 'px';
                  tt.style.top = (e.clientY + 15) + 'px';
              };
              window.hideTooltip = () => {
                  tt.style.display = 'none';
              };
              document.addEventListener('mousemove', (e) => {
                  if (tt.style.display === 'block') {
                      tt.style.left = (e.clientX + 15) + 'px';
                      tt.style.top = (e.clientY + 15) + 'px';
                  }
              });
          }
      };

      let targetContainer = container;
      targetContainer.innerHTML = '';
      
      const filterWrap = document.createElement('div');
      filterWrap.style.marginBottom = '20px';
      filterWrap.style.display = 'flex';
      filterWrap.style.alignItems = 'center';
      filterWrap.style.gap = '15px';
      filterWrap.style.padding = '15px';
      filterWrap.style.background = '#F4F1EC';
      filterWrap.style.border = '1px solid #DDD8CF';
      filterWrap.style.borderRadius = '6px';
      
      filterWrap.innerHTML = `
          <h3 style="color:#1C2B3A; margin:0; font-size:1rem; display:flex; align-items:center; gap:8px; font-weight:700;">
              <span style="font-size:1.1rem;">🎯</span> ZONA DE VISUALIZACIÓN:
          </h3>
          <select id="zonaFilterSelect" style="
              background: #FFFFFF;
              color: #1C2B3A;
              border: 1px solid #DDD8CF;
              border-radius: 4px;
              padding: 6px 15px;
              font-size: 0.9rem;
              font-weight: 700;
              outline: none;
              cursor: pointer;
          ">
              <option value="SEL" ${currentLayoutZona === 'SEL' ? 'selected' : ''}>LAYOUT SELECTIVO</option>
              <option value="MZN01" ${currentLayoutZona === 'MZN01' ? 'selected' : ''}>LAYOUT MZN01</option>
              <option value="MZN02" ${currentLayoutZona === 'MZN02' ? 'selected' : ''}>LAYOUT MZN02</option>
              <option value="MZN03" ${currentLayoutZona === 'MZN03' ? 'selected' : ''}>LAYOUT MZN03</option>
          </select>
      `;
      targetContainer.appendChild(filterWrap);
      
      const activoWrap = document.createElement('div');
      activoWrap.id = 'layout-activo-wrap';
      targetContainer.appendChild(activoWrap);
      
      setTimeout(() => {
          const select = document.getElementById('zonaFilterSelect');
          if (select) {
              select.addEventListener('change', (e) => {
                  currentLayoutZona = e.target.value;
                  window.__verLayoutAnterior = false;
                  renderLayoutActivo(container);
              });
          }
      }, 100);

      /* ── EL MAPA SE ACTUALIZA SOLO ───────────────────────────────────────────────
       *
       * Acá había un cartel —"Hay un mapa nuevo disponible"— con un botón Actualizar y una
       * X para cerrarlo. Existía porque el mapa se publicaba a mano y cambiaba de golpe:
       * la idea era no moverle la pantalla a nadie sin avisar.
       *
       * Daniel lo sacó el 23-ago-2026, al decidir que el robot publique el mapa cada hora:
       * *"el robot tiene que bajar el stock, cargar el mapa y el mapa se actualiza, ya está.
       * No sé para qué tantos botones. Si no es necesario, sácalo"*. Y tiene razón: con el
       * mapa actualizándose cada hora, el cartel saldría cada hora para pedir permiso de
       * hacer justo lo que se espera que pase.
       *
       * Ahora se redibuja solo. Dos excepciones, que no son botones sino sentido común:
       * si el reporte ya no está en pantalla, el reloj se apaga; y si alguien está mirando
       * el mapa ANTERIOR a propósito, no se le cambia debajo de la mano.
       *
       * SE PREGUNTA POR `/api/sync/versiones`, QUE PESA 3 KB. El chequeo viejo se bajaba el
       * mapa entero —entre 150 y 255 KB según la zona— una vez por minuto solo para mirarle
       * la fecha: 15 MB por hora en cada pantalla abierta, para enterarse de un cambio que
       * ocurre una vez por hora. */
      if (window.__layoutAvisoInterval) clearInterval(window.__layoutAvisoInterval);
      window.__layoutAvisoInterval = setInterval(async () => {
          try {
              if (!document.body.contains(container)) { clearInterval(window.__layoutAvisoInterval); return; }
              if (window.__verLayoutAnterior) return; // viendo el anterior a propósito: no molestar
              const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
              const zona = currentLayoutZona || 'SEL';
              const res = await fetch(`${base}/api/sync/versiones?t=${Date.now()}`);
              if (!res.ok) return;
              const p = await res.json();
              const serverUpd = p && p.versiones && p.versiones[`layout_activo_${zona}`];
              if (serverUpd && window.__layoutDisplayedUpdatedAt && serverUpd !== window.__layoutDisplayedUpdatedAt) {
                  window.__layoutDisplayedUpdatedAt = serverUpd;   // o el redibujado vuelve a entrar acá
                  renderLayoutActivo(container);
              }
          } catch(e) {}
      }, 60000);

      let payloadToRender = localPayload || globalPayload;
      let isGlobal = !localPayload && globalPayload;

      // Fecha del encabezado = momento real de publicación del mapa que se muestra
      if (globalPayload && globalPayload.publishedAt) {
          window.__layoutHeaderTs = 'Publicado: ' + new Date(globalPayload.publishedAt).toLocaleString('es-PE');
      } else if (globalPayload && window.__layoutDisplayedUpdatedAt) {
          window.__layoutHeaderTs = 'Publicado: ' + window.__layoutDisplayedUpdatedAt;
      } else {
          window.__layoutHeaderTs = null;
      }
      
      // Mismo criterio que la web principal: tiene mapa la zona con reglas cargadas.
      if (!zonasService.zonasActivas().includes(currentLayoutZona)) {
          activoWrap.innerHTML = `
              <div class="glass-panel" style="padding:4rem 2rem; text-align:center; color:var(--text-muted); border:1px solid #DDD8CF;">
                  <div style="font-size:4rem; margin-bottom:1.5rem; opacity:0.25;">🚧</div>
                  <h4 style="color:#1C2B3A; font-size:1.5rem; margin-bottom:10px;">Zona en Construcción</h4>
                  <p style="font-size:1rem;">La zona <b>${currentLayoutZona}</b> todavía no tiene reglas cargadas.</p>
              </div>
          `;
      } else if (payloadToRender) {
          
          buildLayoutHTML(payloadToRender.layoutData, payloadToRender.stats, payloadToRender.totalUnits, payloadToRender.uniquePadresSize, activoWrap, isGlobal, false, localPayload != null);
      }

      // DESACTIVADO TEMPORALMENTE A PETICIÓN DEL USUARIO
      /*
      if (reservaPayload || globalPayloadReserva) {
          const reservaWrap = document.createElement('div');
          reservaWrap.id = 'layout-reserva-wrap';
          reservaWrap.style.marginTop = '40px';
          targetContainer.appendChild(reservaWrap);
          
          let resPayloadToRender = reservaPayload || globalPayloadReserva;
          let isGlobalRes = !reservaPayload && globalPayloadReserva;
          
          
          buildLayoutHTML(resPayloadToRender.layoutData, resPayloadToRender.stats, resPayloadToRender.totalUnits, resPayloadToRender.uniquePadresSize, reservaWrap, isGlobalRes, true, reservaPayload != null);
      }
      */
    }
