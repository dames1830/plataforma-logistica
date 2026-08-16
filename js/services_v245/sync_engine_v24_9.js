/**
 * Motor de Sincronización Daniel v25.1.3 (Ultimate Stabilization)
 * Restaurada área de WORKERS y fijado error de iteración.
 */

const getApiBase = (defaultUrl) => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('local')) {
      const val = urlParams.get('local');
      if (val === '1' || val === 'true') {
          localStorage.setItem('PULSE_USE_LOCAL', 'true');
      } else {
          localStorage.removeItem('PULSE_USE_LOCAL');
      }
  }
  if (localStorage.getItem('PULSE_USE_LOCAL') === 'true') {
      return 'http://localhost:8000/api/logistics';
  }
  return defaultUrl;
};
const API_BASE = getApiBase('https://logistics-backend-wv0x.onrender.com/api/logistics');
const API_SYNC = API_BASE.replace(/\/logistics$/, '/sync');
// --- CENTRALIZAR STATE GLOBAL PARA EVITAR DUPLICADOS POR CACHE QUERY STRINGS ---
if (!window._pulseSyncState) {
    window._pulseSyncState = {
        isFirstPullDone: false,
        lastPushTimes: {},
        versiones: {},   // ultima marca de cambio conocida de cada area
        cargadas: {},    // areas que ya se descargaron al menos una vez
        syncStore: {
            almacenaje_tasks: [],
            almacenaje_tasks_history: [],
            attendance: {},
            permissions: {},
            workers: [], 
            users: [], 
            performance: {}, 
            performance_log: [], 
            config: {},
            rfs: [],
            rf_assignments: [],
            rfs_batteries: [],
            rfs_chargers: []
        }
    };
}
if (!window._pulseSyncState.lastPushTimes) {
    window._pulseSyncState.lastPushTimes = {};
}
if (!window._pulseSyncState.versiones) window._pulseSyncState.versiones = {};
if (!window._pulseSyncState.cargadas) window._pulseSyncState.cargadas = {};

/**
 * Pregunta al servidor cuándo cambió por última vez cada área. Es una sola
 * llamada de menos de 1 KB.
 *
 * Devuelve null si no se pudo consultar: en ese caso quien llama debe descargar
 * todo, porque es preferible gastar datos de más que trabajar con datos viejos.
 */
async function consultarVersiones() {
    try {
        const res = await fetch(`${API_SYNC}/versiones?z=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const j = await res.json();
        return (j && j.status === 'ok' && j.versiones) ? j.versiones : null;
    } catch (err) {
        console.warn('[PULSE] No se pudieron consultar las versiones, se descargará todo:', err);
        return null;
    }
}

export const syncStore = window._pulseSyncState.syncStore;

// --- LOGICA DE SINCRONIZACION ---

export let isFirstPullDone = window._pulseSyncState.isFirstPullDone;

// Mantener la variable exportada en sincronía con el estado global (live binding)
setInterval(() => {
    if (window._pulseSyncState.isFirstPullDone && !isFirstPullDone) {
        isFirstPullDone = true;
    }
}, 100);

let initPromise = null;
export async function initSync(force = false) {
    if (isFirstPullDone && !force) return syncStore;
    if (initPromise && !force) return initPromise;
    
    initPromise = (async () => {
        console.log("🚀 [PULSE] Inicializando Motor v25.1.44...");
        try {
            await pullGlobal(null, force);
        } catch (e) {
            console.warn("⚠️ [PULSE] Error en carga inicial, pero activando motor:", e);
        }
        window._pulseSyncState.isFirstPullDone = true;
        isFirstPullDone = true;
        console.log("✅ [PULSE] Primera sincronización completada.");
        if (!window._pulseSyncIntervalSet) {
            setInterval(pullGlobal, 30000);
            window._pulseSyncIntervalSet = true;
        }
        return syncStore;
    })();
    return initPromise;
}
/* ══════════════════════════════════════════════════════════════════════════════
 * EL CANDADO DE SUBIDA, Y POR QUÉ NECESITA DOS SEGUROS
 *
 * Mientras hay algo subiendo no se baja nada: sería pisar lo que esta PC está por mandar.
 * La idea es sana. Lo que faltaba era una forma de soltar el candado si la subida nunca
 * termina.
 *
 * El 14-ago-2026 Daniel reportó que los cambios de estado de las tareas no le llegaban: el
 * asistente finalizó la Tarea 2 del 13-ago, el servidor la tenía Finalizada a las 06:35, y su
 * pantalla seguía mostrando lo viejo. Recargar la página lo arreglaba.
 *
 * La causa: `fetch` no tenía tiempo límite. Con Render dormido, la red cortada un segundo o
 * la laptop suspendida, una sola subida se quedaba esperando para siempre; el contador nunca
 * volvía a cero y ESA PC NO DESCARGABA NADA MÁS hasta recargar. Y encima el radar seguía
 * corriendo cada 30 segundos, entrando y saliendo al instante: de ahí el ícono parpadeando en
 * amarillo y verde que Daniel veía abajo a la derecha.
 *
 *   TIEMPO LÍMITE   la subida se aborta a los 30 s. El `finally` corre igual, así que el
 *                   contador baja y la PC vuelve a sincronizar.
 *   SEGURO DE FONDO  si el candado lleva más de 2 minutos puesto —por un camino que nadie
 *                   previó— se suelta solo. Ninguna subida legítima tarda eso, y una PC que
 *                   no sincroniza es mucho peor que una subida perdida.
 * ══════════════════════════════════════════════════════════════════════════════ */
export let pendingPushes = 0;
let candadoDesde = 0;
const TIMEOUT_PUSH = 30000;
const CANDADO_MAX  = 120000;

/** true si el candado está puesto de verdad. Si estaba trabado, lo suelta y devuelve false. */
export function candadoPuesto() {
    if (pendingPushes <= 0) return false;
    if (candadoDesde && Date.now() - candadoDesde > CANDADO_MAX) {
        console.warn(`⚠️ [PULSE] El candado de subida llevaba `
            + `${Math.round((Date.now() - candadoDesde) / 1000)} s puesto: se suelta para poder sincronizar.`);
        pendingPushes = 0;
        candadoDesde = 0;
        return false;
    }
    return true;
}

/** Devuelve las tareas con sus items expandidos. Las que ya vienen sueltas se dejan igual. */
function descomprimirTareas(data) {
    if (!Array.isArray(data)) return data;
    return data.map(t => {
        if (!t || !t._comp || !Array.isArray(t.items)) return t;
        const restoredItems = t.items.map(artArr => {
            // genderRims va al final: las tareas guardadas antes de que existiera traen 7
            // campos y ahí llega undefined, que es justo lo que corresponde.
            // `traba` va en el índice 8: por qué el artículo no se pudo guardar. Las tareas
            // anteriores a la v29.0231 no lo traen y llega undefined, que es lo correcto.
            const [sku7, marca, gender, coleccion, bQty, zQty, cItems, genderRims, traba] = artArr;
            return {
                sku7, marca, gender, coleccion, bufferQty: bQty, zonaQty: zQty,
                ...(genderRims ? { genderRims } : {}),
                ...(traba && typeof traba === 'object' ? { traba } : {}),
                items: (cItems || []).map(i => {
                    const itemObj = { skuFull: i[0], ubi: i[1], qty: i[2], talla: i[3] };
                    if (i[4] !== undefined && i[4] !== null) { itemObj.avance = i[4]; }
                    if (i[5] !== undefined && i[5] !== null) { itemObj.qtyInitial = i[5]; }
                    // EL PAPEL, GRABADO. Se calcula una vez al generar la tarea y no se vuelve
                    // a tocar: una tarea de ayer no puede cambiar porque el stock de hoy sea
                    // otro. Las tareas anteriores a v29.0087 no lo traen y quedan sin estos
                    // tres campos, que es lo correcto — su cálculo se perdió y no se inventa.
                    if (i[6] !== undefined && i[6] !== null) { itemObj.almacenar = i[6]; }
                    if (i[7] !== undefined && i[7] !== null) { itemObj.paletizar = i[7]; }
                    if (i[8] !== undefined && i[8] !== null && i[8] !== '') { itemObj.destino = i[8]; }
                    // LA PALETA PARTIDA. Desde la v29.0228 una talla puede ir a dos cuerpos, y
                    // entonces la paleta sale en dos renglones del papel. Va al final para no
                    // mover los índices ya guardados: las tareas anteriores no lo traen y
                    // siguen leyéndose igual, con su destino único.
                    if (Array.isArray(i[9]) && i[9].length > 1) { itemObj.reparto = i[9]; }
                    return itemObj;
                })
            };
        });
        return { ...t, items: restoredItems, _comp: false };
    });
}

/**
 * Lee un área del servidor y la devuelve, SIN tocar el syncStore.
 *
 * Existe para releer justo antes de reescribir el bloque completo -procesar, auditar,
 * borrar-, que son las operaciones que siguen mandando todas las tareas juntas. Si se
 * subiera el bloque que la PC tiene en memoria, se pisaría lo que otra PC haya hecho desde
 * que se abrió la pantalla: por ejemplo las asignaciones del asistente.
 *
 * No pasa por pullGlobal a propósito: ahí hay un guard que omite la descarga si esta PC
 * empujó algo en los últimos 15 segundos, y para fusionar hace falta el dato fresco sí o sí.
 */
export async function traerAreaFresca(area) {
    const res = await fetch(`${API_BASE}/${area}?z=${Date.now()}`);
    if (!res.ok) throw new Error('El servidor respondió ' + res.status);
    const result = await res.json();
    if (result && result.status === 'error') throw new Error(result.message);
    const data = (result && result.data !== undefined) ? result.data : result;
    if (area === 'almacenaje_tasks' || area === 'almacenaje_tasks_history') return descomprimirTareas(data);
    return data;
}

export async function pullGlobal(requestedAreas = null, force = false) {
    if (!force && candadoPuesto()) {
        console.log("🚫 [PULSE] Sincronización omitida por empuje pendiente.");
        return syncStore;
    }
    console.log(`📥 [PULSE] Sincronización: Descargando ${requestedAreas ? requestedAreas.join(', ') : 'Todo'}...`);
    
    const criticalAreas = ['almacenaje_tasks', 'attendance', 'users', 'permissions', 'config'];
    const heavyAreas = ['almacenaje_tasks_history', 'workers', 'performance', 'performance_log', 'rfs', 'rf_assignments', 'rfs_batteries', 'rfs_chargers', 'buffer_history'];
    const allAreas = [...criticalAreas, ...heavyAreas];
    
    let areas = requestedAreas || allAreas;
    
    // [LAZY LOADING] Si es la primera vez y pidieron todo, solo descargar críticos para que la página cargue en 2 segundos
    if (!isFirstPullDone && !requestedAreas) {
        console.log("⚡ [LAZY LOAD] Descargando solo módulos críticos para arranque rápido...");
        areas = criticalAreas;
        // Lanzar la descarga pesada en segundo plano 3 segundos después
        setTimeout(() => {
            console.log("🐢 [LAZY LOAD] Iniciando descarga diferida de módulos pesados en background...");
            pullGlobal(heavyAreas, true).catch(e => console.error("Error en lazy load pesado:", e));
        }, 3000);
    }

    // [SOLO LO QUE CAMBIÓ] Antes se bajaban las 14 áreas completas cada 30 segundos
    // (unos 930 KB comprimidos, 7.4 MB reales) hubiera cambios o no. Ahora una
    // llamada de menos de 1 KB dice qué cambió y se descarga únicamente eso.
    const versionesNuevas = await consultarVersiones();
    if (versionesNuevas) {
        const conocidas = window._pulseSyncState.versiones;
        const cargadas = window._pulseSyncState.cargadas;
        const antes = areas.length;
        areas = areas.filter(a => !cargadas[a] || conocidas[a] !== versionesNuevas[a]);
        const omitidas = antes - areas.length;
        if (omitidas > 0) console.log(`⚡ [PULSE] ${omitidas} de ${antes} áreas sin cambios: no se descargan.`);
        if (areas.length === 0) {
            console.log('✅ [PULSE] Nada cambió en la nube.');
            window._pulseSyncState.isFirstPullDone = true;
            isFirstPullDone = true;
            return syncStore;
        }
    }

    const results = await Promise.all(areas.map(async (area) => {
        try {
            const res = await fetch(`${API_BASE}/${area}?z=${Date.now()}`);
            if (res.ok) {
                const result = await res.json();
                if (result.status === 'error') throw new Error(result.message);
                let data = result.data !== undefined ? result.data : result;

                if (area === 'almacenaje_tasks' || area === 'almacenaje_tasks_history') data = descomprimirTareas(data);
                return { area, data };
            }
            return { area, data: null };
        } catch (err) {
            console.error(`❌ Pull error ${area}:`, err);
            return { area, data: null };
        }
    }));

    results.forEach(r => {
        if (r.data) {
            // [BETA] Evitar sobrescrituras por colisiones si se realizó un push local reciente
            const lastPush = window._pulseSyncState.lastPushTimes && window._pulseSyncState.lastPushTimes[r.area];
            if (lastPush && (Date.now() - lastPush < 15000)) {
                console.log(`[PULSE] Omitiendo sobrescritura por Pull en ${r.area} debido a Push local reciente.`);
                // Ojo: al no aplicarse, TAMPOCO se registra la versión. Si se registrara,
                // el área quedaría marcada como al día sin haberla aplicado nunca.
                return;
            }
            const current = syncStore[r.area];
            const incoming = r.data;

            // Si el área es un objeto (como attendance), verificamos compatibilidad
            if (current && typeof current === 'object' && !Array.isArray(current)) {
                if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
                    syncStore[r.area] = { ...syncStore[r.area], ...incoming };
                }
            } else {
                syncStore[r.area] = incoming;
            }

            // Solo se marca como al día lo que de verdad se aplicó.
            window._pulseSyncState.cargadas[r.area] = true;
            if (versionesNuevas) window._pulseSyncState.versiones[r.area] = versionesNuevas[r.area];
        }
    });
    window._pulseSyncState.isFirstPullDone = true;
    isFirstPullDone = true;
    console.log("✅ [PULSE] Nube sincronizada.");
    return syncStore;
}

export async function pushChange(area, data, date = null) {
    if (!data) return;
    pendingPushes++;
    if (pendingPushes === 1) candadoDesde = Date.now();
    // El reloj que evita que una subida colgada deje a esta PC sin sincronizar
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TIMEOUT_PUSH);
    try {
        let payload = data;
        if (area === 'almacenaje_tasks' || area === 'almacenaje_tasks_history') {
            const comprimir = (t) => {
                const compactItems = (t.items || []).map(art => {
                    const cArtItems = (art.items || []).map(i => {
                        const base = [i.skuFull || i.sku || '---', i.ubi, i.qty, i.talla || 'S/TALLA',
                                      i.avance !== undefined ? i.avance : null,
                                      i.qtyInitial !== undefined ? i.qtyInitial : null];
                        // El papel grabado va al final, y solo si existe: una tarea sin calcular
                        // sigue viajando con seis campos, igual que siempre.
                        if (i.almacenar !== undefined || i.paletizar !== undefined || i.destino !== undefined) {
                            base.push(i.almacenar !== undefined ? i.almacenar : null,
                                      i.paletizar !== undefined ? i.paletizar : null,
                                      i.destino !== undefined ? i.destino : '');
                            // El corte de la paleta partida, solo si existe. Una paleta con un
                            // destino sigue viajando con nueve campos, igual que siempre.
                            if (Array.isArray(i.reparto) && i.reparto.length > 1) base.push(i.reparto);
                        }
                        return base;
                    });
                    // El Gender RIMS se agrega al final para no mover los índices ya guardados.
                    // Sin él, las metas por detalle (01 MEN, 08 ACCESORIES...) no pueden aplicarse.
                    const base = [art.sku7, art.marca, art.gender, art.coleccion,
                                  art.bufferQty, art.zonaQty, cArtItems, art.genderRims || ''];
                    // El motivo de la traba viaja solo si existe: una tarea que salió bien
                    // sigue pesando ocho campos, igual que siempre.
                    if (art.traba && typeof art.traba === 'object') base.push(art.traba);
                    return base;
                });
                return { ...t, items: compactItems, _comp: true };
            };
            // Una tarea suelta se comprime igual que si viajara dentro del array. Si no, la
            // fila que escribe el PATCH quedaría con los items expandidos mientras el resto
            // del día está comprimido: pesa de más y deja la base con dos formatos mezclados.
            if (Array.isArray(data)) payload = data.map(comprimir);
            else if (data && typeof data === 'object' && data.id) payload = comprimir(data);
        }

        const url = date ? `${API_BASE}/${area}?date=${date}` : `${API_BASE}/${area}`;
        if (window._pulseSyncState.lastPushTimes) {
            window._pulseSyncState.lastPushTimes[area] = Date.now();
        }
        
        // [FIX]: Solo usar PATCH para actualizaciones parciales que contengan un 'id' (ej. tareas individuales).
        // Objetos maestros completos como 'attendance' o 'config' deben enviarse por POST.
        const method = (!Array.isArray(payload) && typeof payload === 'object' && payload.hasOwnProperty('id')) ? 'PATCH' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: corte.signal
        });

        const result = await res.json();
        if (!res.ok || result.status === 'error') throw new Error(result.message || 'Error en servidor');
        return true;
    } catch (err) {
        if (err && err.name === 'AbortError') {
            console.error(`❌ [PULSE] ${area}: el servidor no contestó en ${TIMEOUT_PUSH / 1000} s. `
                + `El cambio quedó guardado en esta PC y se reintenta en la próxima subida.`);
            throw new Error('El servidor no contestó a tiempo');
        }
        console.error(`❌ Push error ${area}:`, err);
        throw err;
    } finally {
        clearTimeout(reloj);
        // Nunca por debajo de cero: si alguna vez se descontara de más, el candado quedaría
        // suelto para siempre y dos PC podrían pisarse.
        pendingPushes = Math.max(0, pendingPushes - 1);
        if (pendingPushes === 0) candadoDesde = 0;
    }
}
