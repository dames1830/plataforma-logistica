/**
 * ZONA BUFFER
 *
 * Vivia adentro de `renderDashboard`, en `dashboard_v28.js`. Se saco el
 * 02-sep-2026, ULTIMA de las cinco pantallas que Daniel pidio mover, y a
 * proposito la ultima: es la mas enganchada de todas.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LO QUE HACE DIFICIL A ESTA: NO SOLO LEE DEL TABLERO, LE ESCRIBE          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Las otras cuatro pantallas solo necesitaban que les pasaran cosas. Esta ademas
 * GUARDA resultados que despues lee medio tablero: el KPI del buffer, el
 * resultado del ultimo analisis, la configuracion, en que sub-pestana se quedo.
 * Si esas variables se copiaran al mudarse, la pantalla escribiria en su copia y
 * el resto del tablero seguiria mirando la vieja: los cuadros de abajo se
 * quedarian con los numeros de antes y nadie sabria por que.
 *
 * Por eso viajan como `ENT.estado`, que NO es una copia sino una ventana con
 * getters y setters a las variables que siguen viviendo en el tablero:
 *
 *     ENT.estado.kpi = x        escribe de verdad en `lastBufferKPI`
 *     ENT.estado.kpi            lee de verdad `lastBufferKPI`
 *
 * Asi el codigo mudado quedo IGUAL de leerse -`ENT.estado.kpi` donde antes decia
 * `lastBufferKPI`, tanto para leer como para escribir- y el cambio de un lado se
 * ve del otro, como siempre.
 *
 * Las cinco que van por esa ventana:
 *     kpi         lastBufferKPI       el KPI del buffer
 *     resultado   lastBufferResult    el ultimo analisis
 *     config      bufferConfigCached  la configuracion en memoria
 *     urlBajado   _urlBufferBajado    de donde se bajo el archivo
 *     sub         activeBufferSub     en que sub-pestana esta. La lee tambien el
 *                                     Pendiente, para no dibujar si ya cambiaste
 *
 * EL ENTORNO SE ATA UNA VEZ, en `montarZonaBuffer`, igual que en Inventarios: la
 * pantalla se llama a si misma al cambiar de sub-pestana y esa llamada quedo
 * intacta.
 *
 * LO DEMAS QUE VA EN `ENT`: las seis pantallas hermanas que dibuja adentro
 * -resultados, historial, config, KPI, maestro y replenishment-, el Pendiente,
 * `pintarCuadrosAbajo`, `traerDatosBuffer`, `renderUploadArea`,
 * `_traerFactoresPublicados`, `contentArea`, `user`, `TABS`, `API_BASE`,
 * `DIAS_REPL_GUARDADOS`, `getLogicalDate`, `rescatarMaestro`, `selloLocalTarea`
 * y `showPremiumAlert`.
 *
 * `user` es PARAMETRO de `renderDashboard`, no variable suya. En la mudanza de
 * No Retail eso se paso por alto y la pantalla reventaba con "user is not
 * defined" recien al ejecutarla; aca ya se tuvo en cuenta.
 *
 * `ponerSubtitulo()` MERECE UNA EXPLICACION. El codigo original decia
 * `contentSubtitle.textContent = ...` a secas, sin declarar `contentSubtitle` en
 * ningun lado. Funcionaba por una rareza del navegador: un elemento con
 * `id="contentSubtitle"` se convierte solo en variable global. En el tablero
 * andaba y aca tambien andaria, pero es de esas cosas que se rompen sin ruido el
 * dia que alguien le cambia el `id` al HTML. Asi que la pantalla ya no lo toca
 * directo: pide que se lo pongan, y el tablero -que es el dueno de ese HTML- lo
 * pone. Lo encontro la prueba de dibujo en vacio.
 */

import { dataStore, getUploadMeta, calculateBufferPallets, fetchBufferConfig,
         saveBufferConfig, fetchBufferHistory, saveBufferHistoryRecord,
         updateBufferHistoryRecord, loadLastBufferKPI, saveLastBufferKPI,
         traerAnalisisBuffer, publicarAnalisisBuffer, bajarFactores,
         traerFactoresCalculados } from '../services_v245/csvHub_v6.js?v=29.0632';
import * as adminService from '../services_v245/adminService.js?v=29.0632';
import * as eventosService from '../services_v245/eventosService.js?v=29.0632';
import * as jornadaService from '../services_v245/jornadaService.js?v=29.0632';
import { marca, fin, resumen } from '../services_v245/medir.js?v=29.0632';

/* EL ENTORNO, ATADO UNA SOLA VEZ. La pantalla se llama a si misma al cambiar de
   sub-pestana; atandolo aca esa llamada no hubo que tocarla. */
let ENT = {};

/** La puerta de entrada. Es lo unico que llama el tablero. */
export const montarZonaBuffer = (entorno) => {
    if (entorno) ENT = entorno;
    return renderBufferTab();
};

const renderBufferTab = async () => {
  ENT.ponerSubtitulo("Análisis de Reposición");

  /* Solo la pestaña Archivo los necesita para dibujarse; las demás arrancan y
     los reciben cuando lleguen. */
  if (ENT.estado.sub === 'maestros') {
      marca('0 · esperar los nueve archivos (solo en Archivo)');
      await ENT.traerDatosBuffer().catch(() => {});
      fin('0 · esperar los nueve archivos (solo en Archivo)');
  } else {
      ENT.traerDatosBuffer().catch(() => { /* se avisa donde se usan */ });
  }

  if(!ENT.estado.config) ENT.estado.config = await fetchBufferConfig();

/* EL ANÁLISIS GUARDADO SE RESUELVE DESPUÉS DE DIBUJAR, NO ANTES.
 *
 * Daniel, 02-sep-2026, después del primer arreglo: *"ahora son 5 a 6 segundos"*.
 * Lo que quedaba era esto: buscar cuál análisis mostrar —leerlo del navegador,
 * preguntarle al servidor si hay uno más nuevo y, si lo hay, bajarlo— se hacía
 * ANTES de pintar una sola línea, así que la pantalla se quedaba en el spinner
 * todo ese rato.
 *
 * Nada de lo que se dibuja primero lo necesita: ni la barra de sub-pestañas ni
 * el panel con PROCESAR. El análisis solo hace falta para las tablas del final,
 * que ya se pintaban aparte con su propio "Restaurando último análisis...".
 *
 * Así que ahora la pantalla sale enseguida y las tablas se llenan cuando el
 * análisis esté. Se pide UNA sola vez por vuelta.
 */
let _analisisResuelto = null;
const resolverAnalisisGuardado = () => {
  if (!_analisisResuelto) _analisisResuelto = (async () => {
      if (!ENT.estado.kpi) {
          /* CUAL ANALISIS SE MUESTRA: EL MAS NUEVO, NO EL DE ESTA PC.
             -------------------------------------------------------------------
             Antes ganaba siempre la cache local, sin mirar la fecha. Una PC que
             alguna vez corrio un analisis se quedaba mostrando el suyo para
             siempre, aunque otra hubiera publicado uno mas nuevo: los numeros no
             coincidian entre maquinas y no habia forma de saber cual valia.

             Ahora se comparan las dos marcas y gana la mas nueva. La del servidor
             se consulta por `/api/sync/versiones`, que pesa 3 KB; el analisis
             entero pesa casi 3 MB y solo se baja si de verdad hay uno mas nuevo. */
          const selloDelAnalisis = (txt) => {          // '25/08/2026, 20:26:08'
              const m = /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
                  .exec(String(txt || ''));
              return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).getTime() : 0;
          };
          const selloDelServidor = (txt) => {          // '2026-08-25 20:26:12' (hora de Lima)
              const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
                  .exec(String(txt || ''));
              return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : 0;
          };

          let local = null;
          marca('1 · leer el analisis guardado (IndexedDB)');
          try {
              const dbVal = await loadLastBufferKPI();
              if (dbVal && (dbVal.detalle || dbVal.detalleZonas)) local = dbVal;
          } catch (e) {
              console.warn("[PULSE] Error leyendo caché IndexedDB:", e);
          }
          fin('1 · leer el analisis guardado (IndexedDB)');

          /* Sin nada local, el del servidor va si o si. Con algo local, primero se
             pregunta la marca -3 KB- y recien se baja si hay uno mas nuevo.
             LOS 60 SEGUNDOS: entre que el analisis se sella y termina de subir
             pasan unos segundos (medido: sellado 20:26:08, subido 20:26:12). Sin
             esa gracia, la misma PC que lo corrio se bajaria 3 MB en cada recarga. */
          let traerElDelServidor = !local;
          if (local) {
              marca('2 · preguntar si hay uno mas nuevo');
              try {
                  const r = await fetch(`${ENT.API_BASE}/sync/versiones?t=${Date.now()}`);
                  if (r.ok) {
                      const j = await r.json();
                      const tServidor = selloDelServidor(
                          j && j.versiones ? j.versiones.analisis_buffer : null);
                      const tLocal = selloDelAnalisis(local.timestamp);
                      if (tServidor && (!tLocal || tServidor > tLocal + 60000)) {
                          traerElDelServidor = true;
                          console.log('[AB] Hay un análisis más nuevo en el servidor; se baja.');
                      }
                  }
              } catch (e) {
                  console.warn('[AB] No se pudo consultar la marca del servidor:', e);
              }
              fin('2 · preguntar si hay uno mas nuevo');
          }

          if (traerElDelServidor) {
              marca('3 · bajar el analisis del servidor');
              try {
                  const delServidor = await traerAnalisisBuffer(ENT.getLogicalDate());
                  if (delServidor) {
                      ENT.estado.kpi = delServidor;
                      ENT.estado.resultado = delServidor;
                      console.log('[AB] Análisis traído del servidor: lo procesó otra PC.');
                  }
              } catch (e) { console.warn('[AB] No se pudo traer el análisis:', e); }
              fin('3 · bajar el analisis del servidor');
          }
          if (!ENT.estado.kpi && local) {              // el del servidor fallo o es mas viejo
              ENT.estado.kpi = local;
              ENT.estado.resultado = local;
          }

          // 3. Fallback tradicional si no se cargó de IndexedDB ni del servidor
          if (!ENT.estado.kpi) {
              marca('4 · respaldo de localStorage (JSON.parse)');
              const stored = localStorage.getItem('logistics_v24_prod_lastBufferKPI')
                           || localStorage.getItem('ENT.estado.kpi')
                           || sessionStorage.getItem('lastBufferKPI_session');
              if (stored) {
                  try {
                      const parsed = JSON.parse(stored);
                      if (parsed && (parsed.detalle || parsed.detalleZonas)) {
                          ENT.estado.kpi = parsed;
                          ENT.estado.resultado = parsed;
                      } else {
                          localStorage.removeItem('logistics_v24_prod_lastBufferKPI');
                          localStorage.removeItem('ENT.estado.kpi');
                          sessionStorage.removeItem('lastBufferKPI_session');
                      }
                  } catch(e) {
                      localStorage.removeItem('logistics_v24_prod_lastBufferKPI');
                      localStorage.removeItem('ENT.estado.kpi');
                      sessionStorage.removeItem('lastBufferKPI_session');
                  }
              }
              fin('4 · respaldo de localStorage (JSON.parse)');
          }
      }
  })().finally(() => { _analisisResuelto = null; });
  return _analisisResuelto;
};

  marca('5 · permisos y armado de la barra');
  const bufferTabDef = ENT.TABS.find(t => t.id === 'buffer');
  const perms = adminService.getPermissions(ENT.user.role) || {};

  const allowedSubTabs = bufferTabDef.subTabs.filter(sub => {
      if (ENT.user.role === 'admin') return true;
      return perms[`buffer_${sub.id}`] === 1;
  });

  if (!allowedSubTabs.find(s => s.id === ENT.estado.sub)) {
      ENT.estado.sub = (allowedSubTabs[0] ? allowedSubTabs[0].id : undefined) || '';
  }

  if (!ENT.estado.sub) {
      ENT.contentArea.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No tienes permisos para acceder a la Zona Buffer.</div>`;
      return;
  }

  ENT.contentArea.innerHTML = `
      <nav style="display:flex; gap:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
        ${allowedSubTabs.map(sub => `
          <a class="sub-nav-item ${ENT.estado.sub===sub.id?'active':''}" data-s="${sub.id}" style="padding: 0.5rem 0.2rem; font-size:var(--t-md); cursor:pointer;">
              <span class="ic">${sub.icon}</span> ${sub.label.toUpperCase()}
          </a>
        `).join('')}
      </nav><div id="bufContent"></div>`;
  document.querySelectorAll('.sub-nav-item').forEach(b => b.addEventListener('click', (e) => { 
      ENT.estado.sub = e.currentTarget.dataset.s; 
      const buf = document.getElementById('bufContent');
      if (buf) {
          buf.innerHTML = `
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem; gap:1rem;">
                  <div style="width:30px; height:30px; border:2px solid rgba(var(--brand-rgb), 0.1); border-top:2px solid var(--brand-light); border-radius:50%; animation:spin 1s linear infinite;"></div>
                  <span style="color:var(--text-muted); font-size:var(--t-md);">Cargando...</span>
              </div>`;
      }
      renderBufferTab(); 
  }));
  const buf = document.getElementById('bufContent');
  fin('5 · permisos y armado de la barra');
  marca('6 · dibujar "' + ENT.estado.sub + '"');
  if (ENT.estado.sub === 'maestros') {
      const wrap = document.createElement('div'); wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.gap = '0.5rem'; buf.appendChild(wrap);
      ENT.renderUploadArea(wrap, 'buffer_activo', dataStore.buffer_activo, '.csv', 'STOCK ACTIVO');
      ENT.renderUploadArea(wrap, 'buffer_reserva', dataStore.buffer_reserva, '.xlsx', 'STOCK RESERVA');
      ENT.renderUploadArea(wrap, 'buffer', dataStore.buffer, '.csv', 'PEDIDOS');
      ENT.renderUploadArea(wrap, 'solicitud', dataStore.solicitud, '.xlsx', 'OTRAS SOLICITUDES');
      ENT.renderMaestroNube(wrap);
      // El Replenishment ya no se sube: se trae del servidor. Ver renderReplenishmentNube.
      ENT.renderReplenishmentNube(wrap);
      ENT.renderUploadArea(wrap, 'validar_reserva', dataStore.validar_reserva, '.xlsx', 'VALIDAR RESERVA');
      ENT.renderUploadArea(wrap, 'validar_activo', dataStore.validar_activo, '.csv', 'VALIDAR ACTIVO');
      ENT.renderUploadArea(wrap, 'validar_lpn', dataStore.validar_lpn, '.csv', 'VALIDAR LPN');
  } else if (ENT.estado.sub === 'pendiente') {
      await ENT.renderPendienteSection(buf);
  } else if (ENT.estado.sub === 'historial_buffer') {
      ENT.renderBufferHistory(buf);
  } else if (ENT.estado.sub === 'kpi_buffer') {
      ENT.renderBufferKPI(buf);
  } else if (ENT.estado.sub === 'config_buffer') {
      await ENT.renderBufferConfig(buf);
  } else {
      const now = new Date();
      const timeStr = `${now.toLocaleDateString('es-PE')} ${now.toLocaleTimeString('es-PE')}`;
      buf.innerHTML = `
        <div style="background:rgba(var(--card-rgb), 0.3); padding:1rem 1.5rem; border-radius:12px; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:rgba(var(--ink-rgb), 0.03); padding:0.8rem; border-radius:8px; border:1px solid rgba(var(--ink-rgb), 0.05);">
            <div style="display:flex; align-items:center; gap:1rem;">
                <button id="btn_calc" class="btn" style="background:var(--btn-fill); width:auto; padding:0.38rem 1rem; border-radius:7px; font-size:var(--t-xs); font-weight:800; box-shadow:0 0 12px rgba(var(--primary-rgb), 0.28);">⚡ PROCESAR</button>
                <!-- EL BARRIDO DE SALDOS. Daniel, 25-ago-2026: la paleta que ya baja
                     por el pedido y volveria con muy poco, se baja entera y la ubicacion
                     queda libre. Medido sobre el pedido del 24: de 35 ubicaciones a 129,
                     bajando 1.524 pares que nadie pidio. VA APAGADO: esos pares hay que
                     acomodarlos en el activo, y la noche que no hay sitio no se corre. -->
                <label id="lbl_m1" title="Buffer de menor a mayor"
                       style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;
                              font-size:var(--t-xs); font-weight:800; letter-spacing:.4px;
                              color:var(--text-muted); border:1px solid rgba(var(--ink-rgb), 0.1);
                              padding:0.4rem 0.8rem; border-radius:6px; user-select:none;">
                    <input type="checkbox" id="chk_m1" style="accent-color:var(--success-alt); cursor:pointer; margin:0;">
                    ⏳ MODELO 1
                </label>
                <label id="lbl_m2" title="Buffer paleta completa"
                       style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;
                              font-size:var(--t-xs); font-weight:800; letter-spacing:.4px;
                              color:var(--text-muted); border:1px solid rgba(var(--ink-rgb), 0.1);
                              padding:0.4rem 0.8rem; border-radius:6px; user-select:none;">
                    <input type="checkbox" id="chk_m2" style="accent-color:var(--success-alt); cursor:pointer; margin:0;">
                    ⏳ MODELO 2
                </label>
                <label id="lbl_m3" title="Mayor paleta por pasillo"
                       style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;
                              font-size:var(--t-xs); font-weight:800; letter-spacing:.4px;
                              color:var(--text-muted); border:1px solid rgba(var(--ink-rgb), 0.1);
                              padding:0.4rem 0.8rem; border-radius:6px; user-select:none;">
                    <input type="checkbox" id="chk_m3" style="accent-color:var(--success-alt); cursor:pointer; margin:0;">
                    ⏳ MODELO 3
                </label>
                <!-- EL FACTOR es UNO DE TRES, no se combina: por eso va en combo y no en
                     check. Los numeros salen de 29 dias de picking, con la mediana diaria
                     y cortados al cubicaje del cuerpo. -->
                <span style="width:1px; height:26px; background:var(--border);"></span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span style="font-size:var(--t-xs); font-weight:800; letter-spacing:.5px;
                               color:var(--text-muted); text-transform:uppercase;">FACTOR</span>
                  <select id="sel_factor" title="Cuánto se baja de más para dejar piso"
                          style="background:var(--panel-deep); border:1px solid rgba(var(--ink-rgb), 0.14);
                                 color:var(--text-strong); padding:0.38rem 0.7rem; border-radius:6px;
                                 font-size:var(--t-xs); font-weight:700; cursor:pointer; outline:none;">
                    <option value="config">Como está configurado</option>
                    <option value="sin">Sin factores</option>
                    <option value="d1">Factor 1 día</option>
                    <option value="d2">Factor 2 días</option>
                  </select>
                </div>

            </div>
            <div id="export_actions" style="display:flex; gap:0.5rem;"></div>
          </div>
          <div id="resultsArea" style="display:flex; gap:0.6rem; align-items:start;"></div>
          <div id="cuadrosAbajo" style="margin-top:0.6rem;"></div>
        </div>`;
      const results = document.getElementById('resultsArea');

  /**
   * LO QUE EL ANÁLISIS MANDA BAJAR, AL SERVIDOR Y EN EL ACTO.
   *
   * PROCESAR ANÁLISIS guardaba **solo en esta PC** —IndexedDB y localStorage— y el
   * único que escribía en el servidor era el Buffer KPI, que corre al final de la
   * noche cuando se valida. Consecuencia: durante todo el turno el reporte de
   * Actividades no tenía meta para Bajada de paletas ni para Separación, y Daniel
   * llegó a correr el análisis dos veces esperando que apareciera.
   *
   * Lo pidió así el 12-ago-2026: *"al buffer lo tenemos que poner de forma global,
   * para que vaya al servidor y de ahí lo puedas bajar y leer"*.
   *
   * SE GUARDA LA META, NUNCA EL AVANCE. Si ya hay registro de la jornada —porque la
   * validación corrió— se actualizan solo estos dos campos y lo demás queda intacto:
   * volver a procesar el análisis no puede borrar lo que ya se midió.
   *
   * Y se cuenta con EL MISMO FILTRO que usa la validación (paletas altas, con algo
   * que bajar). Si acá se contara distinto, la meta y el avance hablarían de cosas
   * distintas y el porcentaje sería mentira.
   */
  /**
   * A qué jornada pertenece un análisis, según la hora en que se calculó.
   *
   * `calculateBufferPallets` sella el resultado con `toLocaleString('es-ES')`, o sea
   * "12/08/2026, 03:22:15". De ahí sale la fecha, y la jornada la decide
   * `jornadaService`, LA MISMA función que usa todo lo demás. Copiar la regla acá
   * —"antes de las 06:30 cuenta el día anterior"— sería tener dos verdades: el día
   * que alguien mueva el horario del turno, una de las dos se queda vieja.
   */
  const jornadaDelAnalisis = (res) => {
    const m = String((res && res.timestamp) || '').match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
    return isNaN(d.getTime()) ? null : jornadaService.fechaLogicaDe(d);
  };

  /**
   * @param {boolean} desdeCache  true cuando el análisis viene del guardado de esta
   *   PC y no de una corrida recién hecha. Ahí HAY QUE COMPROBAR LA JORNADA: el
   *   análisis del martes sigue en el navegador el jueves, y publicarlo como meta de
   *   hoy pondría a medir el turno contra lo que se pidió bajar hace dos días.
   */
  /* ══════════════════════════════════════════════════════════════════════════════
   * LA LISTA DE LO QUE EL ANÁLISIS MANDÓ BAJAR, AL SERVIDOR.
   *
   * Es la pieza que le faltaba a la cadena. `publicarMetaDelBuffer` —acá abajo— manda los
   * TOTALES para el reporte del turno; esto manda QUIÉNES, que es lo que la sugerencia de
   * almacenaje necesita para no devolver al rack algo que el buffer acaba de bajar.
   *
   * MISMO FILTRO QUE LA META: solo las líneas de nivel ALTO con `QTY BUFFER` > 0. Son las
   * que de verdad bajan de reserva; el resto ya estaba abajo.
   *
   * SE GUARDA LA FUENTE, y no es adorno: son las tres del análisis —el pedido de comercial,
   * el Replenishment y otras solicitudes— y saber por cuál bajó un artículo es lo que
   * permite explicar la decisión en el papel y en el motivo de la sugerencia.
   *
   * Sin `await` y sin romper nada si el servidor no contesta: el análisis ya está en
   * pantalla y esto no puede retrasarlo. Si falla, la sugerencia se queda con la prueba
   * vieja, que es como venía trabajando.
   * ══════════════════════════════════════════════════════════════════════════════ */
  const publicarBajadaDelBuffer = async (res) => {
    try {
      const detalle = res && (res.detalle || res.detallePallets);
      if (!Array.isArray(detalle) || !detalle.length) return false;

      const porSku = new Map();
      detalle.forEach(p => {
        if (!p) return;
        const nivel = String(p.NIVEL || '').toUpperCase();
        const q = Number(p['QTY BUFFER']) || 0;
        if (!(p.ES_ALTO === true || nivel.includes('ALTO')) || q <= 0) return;
        const s7 = String(p.Articulo || p.SKU || '').trim().substring(0, 7);
        if (!s7) return;
        const fuente = String(p.FUENTE || '').trim();
        const y = porSku.get(s7) || { q: 0, fuentes: new Set() };
        y.q += q;
        if (fuente) y.fuentes.add(fuente);
        porSku.set(s7, y);
      });
      if (!porSku.size) {
        console.log('[BUFFER] El análisis no mandó bajar nada de reserva: no se publica.');
        return false;
      }

      const lista = [...porSku.entries()]
        .map(([s7, y]) => [s7, Math.round(y.q), [...y.fuentes].join(' + ')]);

      const porFuente = {};
      detalle.forEach(p => {
        if (!p) return;
        const nivel = String(p.NIVEL || '').toUpperCase();
        const q = Number(p['QTY BUFFER']) || 0;
        if (!(p.ES_ALTO === true || nivel.includes('ALTO')) || q <= 0) return;
        const f = String(p.FUENTE || '(sin fuente)').trim();
        porFuente[f] = (porFuente[f] || 0) + Math.round(q);
      });

      const fecha = ENT.getLogicalDate();
      const corrida = { fecha, generado: ENT.selloLocalTarea(),
                        skus: lista.length,
                        pares: lista.reduce((a, p) => a + p[1], 0),
                        porFuente, lista };

      /* Se relee el cajón entero antes de escribir: guarda una corrida por día y no puede
         pisar las de los otros días. Misma mecánica que publicarCorridaReplenishment. */
      let cajon = {};
      try {
        const r = await fetch(`${ENT.estado.urlBajado()}&t=${Date.now()}`);
        if (r.ok) {
          const cuerpo = await r.json();
          const datos = (cuerpo && cuerpo.data !== undefined) ? cuerpo.data : cuerpo;
          if (datos && typeof datos === 'object' && !Array.isArray(datos)) cajon = datos;
        }
      } catch (e) { /* se sigue con el cajón vacío */ }
      cajon[fecha] = corrida;

      const recortado = {};
      Object.keys(cajon).sort().slice(-ENT.DIAS_REPL_GUARDADOS).forEach(k => { recortado[k] = cajon[k]; });

      const envio = await fetch(ENT.estado.urlBajado(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recortado)
      });
      if (!envio.ok) throw new Error('El servidor respondió ' + envio.status);

      console.log(`[BUFFER] ✅ Bajada del ${fecha} publicada: ${corrida.skus} SKU, `
                + `${corrida.pares.toLocaleString('es-PE')} pares · `
                + Object.entries(porFuente).map(([f, q]) => `${f}: ${q.toLocaleString('es-PE')}`).join(' · '));
      return true;
    } catch (e) {
      console.warn('[BUFFER] ⚠️ No se pudo publicar lo que se mandó bajar; la sugerencia '
                 + 'de almacenaje se queda con la prueba vieja:', e && e.message);
      return false;
    }
  };

  const publicarMetaDelBuffer = async (res, desdeCache) => {
    try {
      if (desdeCache) {
        const j = jornadaDelAnalisis(res);
        if (!j || j !== ENT.getLogicalDate()) {
          console.log(`[BH] El análisis guardado es de la jornada ${j || 'desconocida'}, ` +
                      `no de la de hoy (${ENT.getLogicalDate()}). No se publica como meta.`);
          return;
        }
      }
      const detalle = res && (res.detalle || res.detallePallets);
      if (!Array.isArray(detalle) || !detalle.length) return;

      const planificadas = detalle.filter(p => {
        if (!p) return false;
        const nivel = String(p.NIVEL || '').toUpperCase();
        return (p.ES_ALTO === true || nivel.includes('ALTO')) && (Number(p['QTY BUFFER']) || 0) > 0;
      });
      if (!planificadas.length) return;

      /* Las paletas se cuentan por LPN ÚNICO: una paleta trae varios artículos y
         sería varias filas. Es la misma cuenta que hace uniquePlannedLPNs. */
      const lpns = new Set();
      let unidades = 0;
      planificadas.forEach(p => {
        const lpn = String(p.LPN || '').trim().toUpperCase();
        if (lpn) lpns.add(lpn);
        unidades += Number(p['QTY BUFFER']) || 0;
      });
      if (!lpns.size) return;

      const fecha = ENT.getLogicalDate();
      const meta = {
        fecha,
        paletasSolicitadas: lpns.size,
        unidadesASeparar: Math.round(unidades)
      };

      const hist = await fetchBufferHistory();
      const previo = (hist || []).find(r => r && r.fecha === fecha);
      const ok = (previo && previo.id)
        ? await updateBufferHistoryRecord(previo.id, meta)
        : await saveBufferHistoryRecord({
            ...meta,
            /* El avance arranca en cero porque todavía no bajó nada, y es la
               verdad a esta hora. Lo reemplaza la validación cuando corra. */
            paletasBajadas: 0, paletasCompletas: 0, paletasIncompletas: 0,
            diferencias: lpns.size, fillRate: '0.00%', unidadesSeparadas: 0
          });

      console.log(ok
        ? `[BH] ✅ Meta del análisis publicada (${fecha}): ${meta.paletasSolicitadas} paletas, ${meta.unidadesASeparar} unidades.`
        : `[BH] ⚠️ La meta del análisis no llegó al servidor; el reporte del turno va a quedar sin meta.`);

      /* ── Y EL DETALLE POR CÓDIGO, que es lo que permite medir la separación
       *    DURANTE la noche en vez de esperar a la validación.
       *
       * De cada código se guardan dos cosas: cuánto hay que bajar y cuánto había
       * en la zona activa al planificar. Con el stock de la hora, lo separado es
       * lo que subió en el activo, con tope en lo planificado:
       *
       *     min( lo que había que bajar , lo que subió en la zona activa )
       *
       * El tope es regla de Daniel: *"me puedes pedir ochenta pero yo puedo bajar
       * cien; la cosa es tener igual o más, nunca menos"*.
       *
       * SE AGRUPA POR CÓDIGO, no por fila. Un mismo código puede venir en varias
       * paletas —22 de las 151 filas del plan del 07-ago— y sumar el tope de cada
       * fila contaría dos veces lo mismo. `QTY ACTIVO` es el stock de ESE código,
       * así que se asigna, no se suma. */
      /* SE GUARDAN LAS DOS BASES. `ini` es el código en todas las zonas de picking
       * —el buffer incluido— y queda por compatibilidad; `iniDestino` es el mismo
       * código SIN el buffer, y es con el que se mide de verdad.
       *
       * El 17-ago-2026 el turno abrió mostrando 268 unidades separadas sin que nadie
       * hubiera movido nada: el plan anotaba el stock de las zonas de picking y el
       * reporte lo medía en TODAS las ubicaciones, así que un código con 3 pares
       * quietos en DIS-OPE aparecía como 3 separados. Eran 211 de esas 268; las
       * otras 57 eran mercadería recién llegada al buffer. Ver `esZonaDeDestino`. */
      const porSku = {};
      planificadas.forEach(p => {
        const sku = String(p.SKU || '').trim();
        if (!sku) return;
        if (!porSku[sku]) porSku[sku] = {
          sku, plan: 0,
          ini: Number(p['QTY ACTIVO']) || 0,
          iniDestino: Number(p['QTY DESTINO']) || 0
        };
        porSku[sku].plan += Number(p['QTY BUFFER']) || 0;
      });
      const codigos = Object.values(porSku);

      /* ── Y LAS PALETAS QUE HAY QUE BAJAR, UNA POR UNA ─────────────────────
       *
       * Lo planteó Daniel el 12-ago-2026: *"en el análisis del buffer están las
       * ubicaciones que tienes que bajar; si en el stock de las siete te aparecía
       * la ubicación 1 hasta la 102 y después de una hora ya no aparecen dos de
       * las que te pedían, quiere decir que ya bajaste esas dos"*.
       *
       * Y tiene razón en algo que yo tenía mal: el avance se mide contra LAS QUE
       * PIDIÓ EL ANÁLISIS, no contra todas las paletas altas del almacén. Midiendo
       * contra todas, la meta hablaba de 112 paletas y el avance de otras 1.592, así
       * que una paleta que alguien bajó sin que nadie la pidiera contaba igual y el
       * porcentaje no significaba nada.
       *
       * Se guardan las dos llaves. El LPN es la buena —identifica la paleta aunque
       * la muevan de sitio— y la ubicación queda de respaldo para las filas que no
       * traen LPN, igual que hace la validación del Buffer KPI. */
      const vistas = new Set();
      const paletas = [];
      /* QUÉ CÓDIGO TRAE CADA PALETA, que es lo que faltaba para medir bien la separación.
       *
       * Daniel, 18-ago-2026: *"la separación de mercadería viene de lo que baja el buffer.
       * Si en el buffer C moví el código X a otro sitio, ya me lo estás tomando como
       * separación porque justo hay ese código en el plan. Deberías hacer un doble filtro:
       * que sea el código X, pero que BAJE DE RESERVA"*.
       *
       * Hasta acá el plan guardaba los códigos por un lado y las paletas por otro, sin
       * decir qué paleta traía qué código, así que no había forma de cruzarlos. Con esta
       * lista sí: de las paletas pedidas para un código, las que ya no están arriba son
       * las que bajaron, y esos son los pares que pueden contar como separados.
       *
       * Va aparte de `paletas` y no adentro: aquella cuenta LPN ÚNICOS —una paleta trae
       * varios códigos— y es lo que mide la Bajada de paletas. Mezclarlas rompería esa. */
      const porPaleta = [];
      planificadas.forEach(p => {
        const lpn = String(p.LPN || '').trim().toUpperCase();
        const ubi = String(p.UBICACIONES || '').trim().toUpperCase();
        const sku = String(p.SKU || '').trim();
        const q = Number(p['QTY BUFFER']) || 0;
        if (lpn && sku && q > 0) porPaleta.push({ lpn, sku, q: Math.round(q) });
        const llave = lpn || ubi;
        if (!llave || vistas.has(llave)) return;
        vistas.add(llave);
        paletas.push({ lpn, ubi });
      });

      if (codigos.length) {
        /* UN OBJETO, NO UNA LISTA. Hasta v29.0179 acá iba el arreglo de códigos a
           secas; quien lo lea tiene que aguantar las dos formas, porque en el
           servidor puede haber planes guardados con la vieja. */
        const base = window.API_BASE_URL || 'https://logistics-backend-wv0x.onrender.com';
        const r = await fetch(`${base}/api/logistics/plan_buffer?date=${fecha}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha, codigos, paletas, porPaleta })
        });
        console.log(r.ok
          ? `[BH] ✅ Plan del buffer publicado (${fecha}): ${codigos.length} códigos, ${paletas.length} paletas, `
            + `${porPaleta.length} líneas paleta-código.`
          : `[BH] ⚠️ El plan del buffer no se pudo publicar (${r.status}).`);
      }
    } catch (e) {
      console.warn('[BH] No se pudo publicar la meta del análisis:', e);
    }
  };


      console.log("[PULSE] Vinculando botones de acción...");

      // ACTIVAR BOTONES PRIMERO (Prioridad Máxima)
      const btnCalc = document.getElementById('btn_calc');
      /* LOS DOS CHECKS. Se recuerdan entre corridas —viven en la config del buffer— pero
         nacen APAGADOS: son una decisión de cada noche, no una regla. Cuando uno está
         prendido su recuadro se pone verde, para que no se pase por alto. */
      const chkM1 = document.getElementById('chk_m1');
      const chkM2 = document.getElementById('chk_m2');
      const chkM3 = document.getElementById('chk_m3');
      const lblM1 = document.getElementById('lbl_m1');
      const lblM2 = document.getElementById('lbl_m2');
      const lblM3 = document.getElementById('lbl_m3');
      const pintarChk = (chk, lbl) => {
          if (!chk || !lbl) return;
          const on = chk.checked;
          lbl.style.borderColor = on ? 'rgba(var(--success-alt-rgb), .55)' : 'rgba(var(--ink-rgb), 0.1)';
          lbl.style.color = on ? 'var(--success-alt)' : 'var(--text-muted)';
          lbl.style.background = on ? 'rgba(var(--success-alt-rgb), .10)' : 'transparent';
      };
      if (chkM1 || chkM2 || chkM3) {
          let cfgChk = {};
          try { cfgChk = (await fetchBufferConfig()) || {}; } catch (e) { cfgChk = {}; }
          if (chkM1) chkM1.checked = !!cfgChk.modelo1;
          /* `barrido` es el nombre viejo del modelo 2: se sigue leyendo por si quedó
             guardado antes de que existiera el modelo 1. */
          if (chkM2) chkM2.checked = !!(cfgChk.modelo2 !== undefined ? cfgChk.modelo2 : cfgChk.barrido);
          if (chkM3) chkM3.checked = !!cfgChk.modelo3;
          const selF = document.getElementById('sel_factor');
          if (selF && cfgChk.factorModo) selF.value = cfgChk.factorModo;
          if (selF) selF.addEventListener('change', async () => {
              try {
                  const c = (await fetchBufferConfig()) || {};
                  c.factorModo = selF.value;
                  await saveBufferConfig(c);
              } catch (e) { console.warn('[FACTOR] no se pudo guardar el combo:', e); }
          });
          pintarChk(chkM1, lblM1); pintarChk(chkM2, lblM2); pintarChk(chkM3, lblM3);
          const guardar = async () => {
              try {
                  const cfg = (await fetchBufferConfig()) || {};
                  if (chkM1) cfg.modelo1 = chkM1.checked;
                  if (chkM2) cfg.modelo2 = chkM2.checked;
                  if (chkM3) cfg.modelo3 = chkM3.checked;
                  if (!cfg.modelo2Corte) cfg.modelo2Corte = 40;
                  await saveBufferConfig(cfg);
              } catch (e) { console.warn('[MODELOS] no se pudo guardar el check:', e); }
          };
          if (chkM1) chkM1.addEventListener('change', () => { pintarChk(chkM1, lblM1); guardar(); });
          if (chkM2) chkM2.addEventListener('change', () => { pintarChk(chkM2, lblM2); guardar(); });
          if (chkM3) chkM3.addEventListener('change', () => { pintarChk(chkM3, lblM3); guardar(); });
      }

      if (btnCalc) {
          btnCalc.onclick = async () => {
              console.log("[PULSE] Click Procesar Análisis");

              // EL BOTON AVISA ANTES DE IRSE AL SERVIDOR.
              // Antes lo primero era rescatarMaestro() -1,6 s de espera- y la barra de
              // progreso recien se pintaba despues de validar los archivos. En esos
              // segundos el boton se veia igual que sin tocarlo, y el usuario creia que
              // la web se habia colgado y volvia a apretar.
              const textoOriginal = btnCalc.innerHTML;
              const soltarBoton = () => {
                  btnCalc.disabled = false;
                  btnCalc.style.opacity = '';
                  btnCalc.innerHTML = textoOriginal;
              };
              btnCalc.disabled = true;
              btnCalc.style.opacity = '0.7';
              btnCalc.innerHTML = '⏳ PREPARANDO...';

              /* LOS FACTORES, DEL SERVIDOR Y ANTES DE CALCULAR. `calculateBufferPallets`
                 los lee del localStorage y es sincrona, asi que hay que dejarlos puestos
                 antes. Si el servidor no contesta se sigue con los de esta PC. */
              try { await bajarFactores(); } catch (e) { /* se sigue con los locales */ }

              /* ACÁ SÍ SE ESPERAN LOS NUEVE. La pantalla se dibuja sin ellos
                 —por eso abre en menos de un segundo— pero procesar los usa,
                 así que este es el sitio donde toca aguardarlos. */
              await ENT.traerDatosBuffer().catch(() => {});

              // El Maestro se baja del publicado en la nube: acá solo hay que
              // cargar los dos stocks.
              await ENT.rescatarMaestro();

              // VALIDACIÓN EXPLÍCITA DE ARCHIVOS (Antes de mostrar la barra de progreso)
              if (!dataStore.buffer_activo) {
                  ENT.showPremiumAlert("Archivo Faltante", "Falta cargar el archivo de <b>STOCK ACTIVO</b> para poder realizar el análisis.", "error");
                  soltarBoton();
                  return;
              }
              if (!dataStore.buffer_reserva) {
                  ENT.showPremiumAlert("Archivo Faltante", "Falta cargar el archivo de <b>STOCK RESERVA</b> para poder realizar el análisis.", "error");
                  soltarBoton();
                  return;
              }
              if (!dataStore.articulos) {
                  ENT.showPremiumAlert("Falta el Maestro", "No hay ningún <b>Maestro de Artículos</b> publicado en la nube ni cargado en esta PC.<br><br>Publícalo desde <b>Configuración → Archivos Nube</b>.", "error");
                  soltarBoton();
                  return;
              }

              /* ANTES QUE NADA: QUE EL STOCK NO SEA VIEJO.
                 -----------------------------------------------------------
                 El motor corre con la foto que tiene CARGADA esta PC. Si el
                 robot publico una mas nueva, el analisis sale con ubicaciones
                 que ya no existen y el montacarguista camina al vacio: paso el
                 25-ago, con 237 pares mandados a una recepcion vacia.
                 Se bloquea y no se procesa. Avisar no alcanza: el que no lo
                 ve, igual manda a bajar. */
              btnCalc.disabled = true; btnCalc.innerHTML = '⚙️ COMPROBANDO...';
              /* Cada stock se guarda bajo su nombre canonico, pero hay pantallas viejas
                 que lo dejaron con otros nombres. Se miran todos y vale el primero que
                 traiga sello: si ninguno lo trae, esta PC no puede probar que su foto
                 sea la ultima, y entonces tampoco procesa. */
              const STOCKS_DEL_ROBOT = [
                  { area: 'analisis_sku_reserva', nombre: 'STOCK RESERVA',
                    alias: ['analisis_sku_reserva','buffer_reserva','almacenaje_reserva',
                            'inventario_reserva','recepcion_reserva','stockReserva'] },
                  { area: 'almacenaje_activo',    nombre: 'STOCK ACTIVO',
                    alias: ['almacenaje_activo','buffer_activo','analisis_sku_activo',
                            'inventario_activo','recepcion_activo','stockActivo','inventario'] }
              ];
              try {
                  const rV = await fetch(`${ENT.API_BASE}/sync/versiones?t=${Date.now()}`);
                  if (rV.ok) {
                      const jV = await rV.json();
                      const pub = (jV && jV.versiones) ? jV.versiones : {};
                      const viejos = [];
                      STOCKS_DEL_ROBOT.forEach(st => {
                          const enServidor = pub[st.area];
                          if (!enServidor) return;                 // el robot no publico: no hay con que comparar
                          let enPC = null;
                          for (const nom of st.alias) {
                              const m = getUploadMeta(nom);
                              if (m && m.timestamp) { enPC = m.timestamp; break; }
                          }
                          /* Se comparan los dos sellos de publicacion, no la hora
                             en que se bajo: `meta_` guarda el `updated_at` de la
                             foto, asi que si son iguales es LA MISMA foto. */
                          if (!enPC || String(enPC).trim() !== String(enServidor).trim()) {
                              viejos.push({ nombre: st.nombre, enPC: enPC, enServidor: enServidor });
                          }
                      });
                      if (viejos.length) {
                          const filas = viejos.map(v =>
                              `<tr>
                                 <td style="padding:.35rem .8rem; font-weight:800;">${v.nombre}</td>
                                 <td style="padding:.35rem .8rem; color:var(--danger-soft);">${v.enPC || 'no hay foto cargada'}</td>
                                 <td style="padding:.35rem .8rem; color:var(--success);">${v.enServidor}</td>
                               </tr>`).join('');
                          ENT.showPremiumAlert('Stock desactualizado',
                              'Esta PC tiene una foto de stock <b>m&aacute;s vieja</b> que la que public&oacute; el robot. '
                              + 'No se puede procesar: el an&aacute;lisis saldr&iacute;a con ubicaciones que ya no existen '
                              + 'y el montacarguista ir&iacute;a a buscar mercader&iacute;a que no est&aacute;.'
                              + '<br><br><table style="width:100%; border-collapse:collapse; font-size:var(--t-sm);">'
                              + '<tr style="color:var(--text-muted); font-size:var(--t-xs); text-transform:uppercase;">'
                              + '<th style="padding:.35rem .8rem; text-align:left;">Archivo</th>'
                              + '<th style="padding:.35rem .8rem; text-align:left;">En esta PC</th>'
                              + '<th style="padding:.35rem .8rem; text-align:left;">El del robot</th></tr>'
                              + filas + '</table>'
                              + '<br><b>Recarga la p&aacute;gina con Ctrl+F5</b> y vuelve a procesar.',
                              'error');
                          soltarBoton();
                          return;
                      }
                  }
              } catch (e) {
                  /* Sin red no se bloquea: dejar sin analisis a todo el turno por un
                     servidor caido seria peor que el problema que esto evita. */
                  console.warn('[STOCK] No se pudo comprobar si la foto es la ultima:', e);
              }

              btnCalc.innerHTML = '⚙️ CALCULANDO...';
              results.innerHTML = `
              <div style="width: 100%; padding:5rem 2rem; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at center, var(--panel-solid) 0%, var(--bg-dark) 100%); border-radius:16px; border:1px solid rgba(var(--ink-rgb), 0.05); min-height:300px; box-shadow: inset 0 0 50px rgba(var(--shadow-rgb), 0.5);">
                  <h3 style="font-size:var(--t-xl); margin:0 0 2.5rem 0; color:var(--text-strong); font-weight:800; letter-spacing:2px; text-shadow: 0 0 10px rgba(var(--sky-rgb), 0.5);">PROCESANDO ANÁLISIS BUFFER</h3>
                  <div style="width: 80%; max-width: 900px; height: 34px; background: var(--panel-deep); border-radius: 20px; box-shadow: inset 0 5px 15px rgba(var(--shadow-rgb), 0.8), 0 1px 0 rgba(var(--ink-rgb), 0.1), 0 -1px 0 rgba(var(--shadow-rgb), 0.5); padding: 4px; position: relative; overflow: hidden;">
                      <div style="position: absolute; top: 4px; left: 4px; height: 26px; border-radius: 14px; background: linear-gradient(180deg, var(--sky) 0%, var(--sky-deep) 50%, var(--blue-deep) 100%); box-shadow: inset 0 2px 4px rgba(var(--ink-rgb), 0.5), inset 0 -3px 6px rgba(var(--shadow-rgb), 0.3), 0 0 25px rgba(var(--sky-rgb), 0.7); animation: thick-progress 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;">
                          <div style="position: absolute; top:0; left:0; width:100%; height:100%; border-radius:14px; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(var(--ink-rgb), 0.1) 10px, rgba(var(--ink-rgb), 0.1) 20px); opacity:0.5;"></div>
                      </div>
                  </div>
                  <div id="pasos_analisis" style="margin-top:2rem; text-align:left; display:inline-block; min-width:340px; font-size:var(--t-sm); color:var(--text-muted);"><div style="display:flex;align-items:center;gap:9px;padding:4px 0;color:var(--text-strong);font-weight:700"><span style="width:15px;text-align:center;color:var(--sky)">●</span>Leyendo la configuración del buffer</div></div>
                  <style>
                      @keyframes thick-progress { 0% { width: 0%; left: 4px; } 100% { width: calc(100% - 8px); left: 4px; } }
                      @keyframes pulse-text { 0% { opacity:0.5; } 50% { opacity:1; } 100% { opacity:0.5; } }
                  </style>
              </div>`;

              /* LOS PASOS. Cada uno se marca al terminar, con lo que tardó: con el
                 factor prendido esto pasa de 369 a 800 paletas y una barra muda se lee
                 como colgada. */
              const _cajaPasos = document.getElementById('pasos_analisis');
              const _pasos = [];
              let _t0 = Date.now();
              const paso = (txt) => {
                  if (_pasos.length) {
                      _pasos[_pasos.length - 1].seg = ((Date.now() - _t0) / 1000).toFixed(1);
                      _pasos[_pasos.length - 1].fin = true;
                  }
                  _t0 = Date.now();
                  if (txt) _pasos.push({ txt: txt, fin: false, seg: null });
                  if (!_cajaPasos) return;
                  _cajaPasos.innerHTML = _pasos.map(x =>
                      '<div style="display:flex;align-items:center;gap:9px;padding:4px 0;'
                      + (x.fin ? 'color:var(--text-dim)' : 'color:var(--text-strong);font-weight:700') + '">'
                      + '<span style="width:15px;text-align:center;color:'
                      + (x.fin ? 'var(--success-mid)' : 'var(--sky)') + '">' + (x.fin ? '\u2713' : '\u25CF') + '</span>'
                      + x.txt
                      + (x.seg ? '<span style="margin-left:auto;font-size:var(--t-xs);color:var(--text-dim)">'
                                 + x.seg + ' s</span>' : '')
                      + '</div>').join('');
              };
              /* El primer renglon, YA: antes de cualquier espera. */
              paso('Preparando el análisis');

              setTimeout(async () => {
                  try {
                      paso('Leyendo la configuración del buffer');
                      const config = await fetchBufferConfig().catch(() => ({ include_reserva: '1', include_alto: '1', include_piso: '1', include_aereo: '1', include_logico: '1' }));
                      /* EL COMBO MANDA sobre lo guardado: es lo que el usuario acaba de
                         elegir en la pantalla, y puede no haberse guardado todavía. */
                      const _selF = document.getElementById('sel_factor');
                      if (_selF) config.factorModo = _selF.value;
                      if (config.factorModo === 'd1' || config.factorModo === 'd2') {
                          paso('Trayendo la tabla de factores del servidor');
                          try { await traerFactoresCalculados(); }
                          catch (e) { console.warn('[FACTOR] no se pudo traer la tabla:', e); }
                      }
                      // Los objetivos de piso se traen del servidor ANTES de calcular. El motor
                      // los lee del localStorage, y una PC que nunca abrió la pantalla de
                      // factores los tenía vacíos: el colchón quedaba en cero sin avisar.
                      paso('Leyendo los objetivos de piso publicados');
                      await ENT._traerFactoresPublicados();
                      const _nomModelo = [config.modelo1 ? 'Modelo 1' : '',
                                          config.modelo2 ? 'Modelo 2' : '',
                                          config.modelo3 ? 'Modelo 3' : ''].filter(Boolean).join(' + ')
                                         || 'Por defecto';
                      paso('Calculando y eligiendo las paletas · ' + _nomModelo);
                      const res = calculateBufferPallets(config);
                      paso('Armando el reporte');
                      if (res) {
                          ENT.estado.kpi = res;
                          ENT.estado.resultado = res;
                          // Guardar en IndexedDB de forma persistente y segura
                          /* SOLO A INDEXEDDB. El analisis pesa ~2,2 MB y antes se guardaba
                             ADEMAS en dos claves de localStorage y en sessionStorage: cuatro
                             copias del mismo dato, y localStorage -que da 5 MB en total- se
                             llenaba solo con esto. IndexedDB tiene cientos de MB y ya lo
                             restaura al abrir; el servidor tambien lo tiene. Las copias en
                             localStorage no aportaban nada y ahogaban el disco. */
                          saveLastBufferKPI(res).catch(err => console.warn("[PULSE] Error saving to IndexedDB:", err));
                          ENT.renderBufferResults(results, res);
                          /* LOS DOS CUADROS DE ABAJO. Van despues de pintar el reporte
                             para no retrasarlo, y sin await por la misma razon. */
                          ENT.pintarCuadrosAbajo(config, res).catch(e =>
                              console.warn('[CUADROS] No se pudieron armar:', e));

                          /* Y LA META AL SERVIDOR, para que el reporte del turno la tenga
                             desde que arranca la noche y no recién al validar. Va sin
                             await: el análisis ya está en pantalla y esto no debe
                             retrasarlo ni romperlo si el servidor no contesta. */
                          publicarMetaDelBuffer(res);
                          /* Y QUIÉNES, no solo cuántos. Sin esta lista el almacenaje no
                             puede saber que el buffer bajó ese artículo, y termina
                             mandándole a reserva el 40% de algo que acaba de bajar. */
                          publicarBajadaDelBuffer(res);
                          /* Y EL REPORTE ENTERO, para que se vea desde cualquier PC.
                             Daniel, 25-ago-2026: *"súbelo al servidor, que sea global
                             para que otros lo vean"*. Sin await, igual que los dos de
                             arriba: el análisis ya está en pantalla. */
                          publicarAnalisisBuffer(res, ENT.getLogicalDate());
                          eventosService.registrar('Corrió el Análisis de Buffer',
                            `jornada ${ENT.getLogicalDate()}`);

                      } else {
                          ENT.showPremiumAlert("Error de Maestros", "No se pudo realizar el análisis porque faltan los archivos maestros.", "error");
                      }
                  } catch (err) {
                      console.error("Error en proceso:", err);
                      ENT.showPremiumAlert("Error Crítico", err.message, "error");
                  } finally {
                      btnCalc.disabled = false; btnCalc.innerHTML = '⚡ PROCESAR ANÁLISIS';
                  }
              }, 400);
          };
      }


      /* CARGAR RESULTADOS CACHEADOS AL FINAL.
         ACÁ se busca cuál análisis mostrar, no arriba: la pantalla ya está
         dibujada y el cartel de "Restaurando..." se ve mientras tanto, en vez
         de dejar cinco segundos de spinner en blanco. */
      results.innerHTML = `<div style="text-align:center;padding:1rem;color:rgba(var(--ink-rgb), 0.4);font-size:var(--t-sm);">⏳ Restaurando último análisis...</div>`;
      marca('8 · buscar cual analisis mostrar');
      await resolverAnalisisGuardado().catch(e =>
          console.warn('[AB] No se pudo resolver el análisis guardado:', e));
      fin('8 · buscar cual analisis mostrar');
      if (!ENT.estado.kpi) results.innerHTML = '';
      if (ENT.estado.kpi) {
          setTimeout(() => {
              try {
                  marca('7 · dibujar las tablas del analisis guardado');
                  ENT.renderBufferResults(results, ENT.estado.kpi);
                  fin('7 · dibujar las tablas del analisis guardado');
                  /* LOS DOS CUADROS TAMBIEN ACA. Al abrir la pantalla se restaura el
                     ultimo analisis: sin esto, quien entraba a mirarlo no veia nada
                     abajo y parecia que los cuadros no existieran.
                     Los otros cinco modelos solo se corren si los archivos estan en
                     esta PC; si no, salen en raya en vez de con numeros a medias. */
                  /* ABRIR LA PANTALLA NO CORRE EL MOTOR.
                   *
                   * Daniel, 02-sep-2026: *"el único módulo que demora en abrir es
                   * Zona Buffer"*, y su consola lo mostró: cuatro veces seguidas
                   * `Analisis Finalizado: 7742 items` solo por entrar. Era esto:
                   * el cuadro de comparación corre los OTROS CINCO modelos, cada
                   * uno sobre 7.742 artículos, y el motor es síncrono.
                   *
                   * Al abrir se dibuja el modelo elegido —que ya está calculado— y
                   * los otros cinco quedan en raya con un botón para correrlos.
                   * Después de PROCESAR sí se corren solos: ahí el usuario está
                   * esperando un análisis y la comparación es parte de eso.
                   */
                  fetchBufferConfig().catch(() => ({}))
                      .then(cfg => ENT.pintarCuadrosAbajo(cfg || {}, ENT.estado.kpi, false))
                      .catch(e => console.warn('[CUADROS] No se pudieron armar al abrir:', e));
                  /* Y SI ESE ANÁLISIS ES DE ESTA JORNADA, se publica al abrir la
                     pantalla. Si no, el análisis que se corrió antes de que esto
                     existiera —o desde una PC con la versión vieja— se quedaba
                     guardado acá adentro y el reporte del turno seguía sin meta,
                     aunque el trabajo ya estuviera hecho. Con la comprobación de
                     jornada adentro, un análisis viejo no se publica. */
                  publicarMetaDelBuffer(ENT.estado.kpi, true);
              } catch (err) {
                  console.warn("[PULSE] Error cargando caché de resultados (incompatible), ignorando...", err);
                  localStorage.removeItem('ENT.estado.kpi');
                  localStorage.removeItem('logistics_v24_prod_lastBufferKPI');
                  sessionStorage.removeItem('lastBufferKPI_session');
                  saveLastBufferKPI(null).catch(() => {});
                  results.innerHTML = '';
              }
          }, 50);
      }
  }
  fin('6 · dibujar "' + ENT.estado.sub + '"');
  /* EL CUADRO CON TODO LO MEDIDO. Solo sale con `?medir=1` en la direccion.
     Va en un setTimeout porque parte del dibujo se completa despues de que
     esta funcion termina, y si se imprimiera aca faltarian esos tramos. */
  setTimeout(() => resumen('Zona Buffer · ' + ENT.estado.sub), 1200);
};
