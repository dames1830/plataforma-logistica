import * as adminService from '../services_v245/adminService.js?v=26.5.560';
import { getAreaData, dataStore } from '../services_v245/csvHub_v6.js?v=26.5.560';

let almacenajeTaskMode = localStorage.getItem('almacenajeTaskMode') || 'resumen';
let selectedTaskDate = null;
let expandedWeeks = [];
let almacenajeTasksCache = [];
let currentPage = 1;
const itemsPerPage = 50;

export const getAlmacenajeTasks = () => almacenajeTasksCache;

const getLogicalDate = () => {
    const now = new Date();
    const hrs = now.getHours();
    let target = now;
    if (hrs >= 0 && hrs < 6) {
        target = new Date(now);
        target.setDate(now.getDate() - 1);
    }
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getTaskTotalAvance = (t) => {
    if (!t) return 0;
    let sum = 0;
    (t.items || []).forEach(art => {
        (art.items || []).forEach(i => {
            const ubi = String(i.ubi || '').toUpperCase().trim();
            const isBuffer = ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C');
            if (isBuffer) {
                if (i.avance !== undefined && i.avance !== null) {
                    sum += parseFloat(i.avance) || 0;
                } else if (t.status === 'Finalizado') {
                    sum += parseFloat(i.qty) || 0;
                }
            }
        });
    });
    return sum;
};

const saveAlmacenajeTasksLocal = async () => {
  try {
      localStorage.setItem('pulse_almacenaje_tasks_v1', JSON.stringify(almacenajeTasksCache));
      adminService.adminStore.almacenaje_tasks = almacenajeTasksCache;
      adminService.saveAlmacenajeTasks(almacenajeTasksCache)
          .then(ok => console.log(ok ? "✅ Sync Global OK" : "⚠️ Server no respondió, reteniendo local"))
          .catch(e => console.warn("⚠️ Error Sync:", e));
  } catch (e) { console.error("[PULSE] Error crítico al guardar:", e); }
};

export const loadAlmacenajeTasks = async () => {
  try {
      const stored = localStorage.getItem('pulse_almacenaje_tasks_v1');
      const localTasks = stored ? JSON.parse(stored) : [];
      const syncedTasks = adminService.adminStore.almacenaje_tasks;
      if (Array.isArray(syncedTasks) && syncedTasks.length > 0) {
          almacenajeTasksCache = syncedTasks;
          localStorage.setItem('pulse_almacenaje_tasks_v1', JSON.stringify(syncedTasks));
      } else {
          almacenajeTasksCache = localTasks;
      }
  } catch (e) { console.error("[PULSE] Error crítico al cargar:", e); }
};

export const renderAlmacenajeTareas = (container) => {
    const isDetail = almacenajeTaskMode === 'detalle';
    const isKpi = almacenajeTaskMode === 'kpi';
    const tasks = Array.isArray(almacenajeTasksCache) ? almacenajeTasksCache : [];

    // Helper: Week Number
    const getWeekNumber = (d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    const groups = {};
    tasks.forEach(t => {
        if (!t || typeof t !== 'object') return;
        if (!t.fecha) t.fecha = new Date().toISOString().split('T')[0];
        const dateObj = new Date(t.fecha + 'T00:00:00');
        if (isNaN(dateObj.getTime())) return;
        const w = `Semana ${getWeekNumber(dateObj)}`;
        if (!groups[w]) groups[w] = {};
        if (!groups[w][t.fecha]) groups[w][t.fecha] = 0;
        groups[w][t.fecha]++;
    });

    const sidebarHtml = Object.keys(groups).sort().reverse().map(w => {
        const isExpanded = expandedWeeks.includes(w);
        const days = groups[w];
        return `
            <div style="margin-bottom:8px;">
                <div onclick="window.toggleWeek('${w}')" style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:rgba(255,255,255,0.03); border-radius:10px; cursor:pointer; font-size:0.8rem; font-weight:700; color:#fff;">
                    <span>📅 ${w}</span>
                    <span>${isExpanded ? '▼' : '▶'}</span>
                </div>
                ${isExpanded ? Object.keys(days).sort().reverse().map(d => {
                    const [y, m, day] = d.split('-');
                    const dDisplay = `${day}/${m}/${y}`;
                    return `
                    <div onclick="window.setSelectedDate('${d}')" style="padding:8px 15px 8px 35px; cursor:pointer; font-size:0.75rem; color:${selectedTaskDate === d ? 'var(--primary)' : 'var(--text-muted)'}; font-weight:${selectedTaskDate === d ? '800' : '500'}; background:${selectedTaskDate === d ? 'rgba(79,70,229,0.1)' : 'transparent'};">
                        ${dDisplay} <span style="opacity:0.5; font-size:0.6rem;">(${days[d]})</span>
                    </div>`;
                }).join('') : ''}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div>
                <!-- Títulos eliminados por solicitud del usuario -->
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
                <button id="btn_open_shift" class="btn" style="width:auto; background:rgba(34, 197, 94, 0.1); color:#22c55e; border:1px solid rgba(34, 197, 94, 0.3); padding:8px 16px; font-size:0.75rem; font-weight:700;">⚙️ PROCESAR TAREAS</button>
                <button id="btn_clear_tasks" class="btn" style="width:auto; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); padding:8px 12px; font-size:0.75rem;" title="Limpiar Tareas Pendientes">🗑️</button>
                <button id="btn_exp_almacenaje" class="btn" style="width:auto; padding:8px 16px; font-size:0.75rem; background:var(--primary); color:#fff; font-weight:800; border:none; box-shadow:0 4px 12px rgba(79,70,229,0.3);">📥 EXCEL TAREAS</button>
            </div>
        </div>
        <nav style="display:flex; gap:1.5rem; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05);">
            <a class="t-nav ${!isDetail && !isKpi ?'active':''}" data-m="resumen">📊 RESUMEN</a>
            <a class="t-nav ${isDetail?'active':''}" data-m="detalle">🔍 DETALLE</a>
        </nav>
        <div style="display:grid; grid-template-columns: 240px 1fr; gap:1.5rem; height:calc(100vh - 280px);">
            <div style="background:rgba(15, 23, 42, 0.4); border-radius:12px; padding:1.2rem; border:1px solid rgba(255,255,255,0.05); overflow-y:auto;">
                <h4 style="margin:0 0 1.2rem 0; font-size:0.85rem; color:#fff; font-weight:800;">Historial</h4>
                ${sidebarHtml}
            </div>
            <div id="taskTableArea" style="overflow:auto;">
                <!-- Table rendered here -->
            </div>
        </div>`;

    renderTaskTable(container.querySelector('#taskTableArea'), tasks, isDetail);

    // Events
    container.querySelectorAll('.t-nav').forEach(a => a.onclick = () => { almacenajeTaskMode = a.dataset.m; localStorage.setItem('almacenajeTaskMode', almacenajeTaskMode); renderAlmacenajeTareas(container); });
    container.querySelector('#btn_open_shift').onclick = () => openShiftModal(container);
    container.querySelector('#btn_clear_tasks').onclick = () => clearCurrentShiftTasks(container);
    container.querySelector('#btn_exp_almacenaje').onclick = () => exportAlmacenajeExcel();

    window.toggleWeek = (w) => {
        if (expandedWeeks.includes(w)) expandedWeeks = expandedWeeks.filter(x => x !== w);
        else expandedWeeks.push(w);
        renderAlmacenajeTareas(container);
    };
    window.setSelectedDate = (d) => {
        selectedTaskDate = d;
        currentPage = 1;
        renderAlmacenajeTareas(container);
    };
};

const renderTaskTable = (container, tasks, isDetail) => {
    const filtered = tasks.filter(t => !selectedTaskDate || t.fecha === selectedTaskDate);
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:8px;">
            <div style="font-size:0.75rem; color:var(--text-muted);">
                Mostrando <b>${startIndex + 1}-${Math.min(startIndex + itemsPerPage, totalItems)}</b> de <b>${totalItems}</b> registros
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button id="prevPage" class="btn" style="width:auto; padding:4px 8px; font-size:0.7rem; background:${currentPage===1?'rgba(255,255,255,0.05)':'var(--primary)'}; cursor:${currentPage===1?'not-allowed':'pointer'};" ${currentPage===1?'disabled':''}>Anterior</button>
                <span style="font-size:0.75rem; color:#fff; font-weight:700;">${currentPage} / ${totalPages}</span>
                <button id="nextPage" class="btn" style="width:auto; padding:4px 8px; font-size:0.7rem; background:${currentPage===totalPages?'rgba(255,255,255,0.05)':'var(--primary)'}; cursor:${currentPage===totalPages?'not-allowed':'pointer'};" ${currentPage===totalPages?'disabled':''}>Siguiente</button>
            </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; color:#d1d5db;">
            <thead style="position:sticky; top:0; background:#1e293b; z-index:10; border-bottom:1px solid rgba(255,255,255,0.1);">
                ${!isDetail ? `
                    <tr><th>Fecha</th><th>ID</th><th>Qty</th><th>Marca</th><th>U1</th><th>U2</th><th>Inicio</th><th>Termino</th><th>Prod.</th><th>Obj.</th><th>Status</th><th>Acción</th></tr>
                ` : `
                    <tr><th>Articulo</th><th>Ubicación</th><th>SKU</th><th>Talla</th><th>Buffer</th><th>Zona</th><th>ID</th><th>Status</th></tr>
                `}
            </thead>
            <tbody>
                ${paginated.length === 0 ? '<tr><td colspan="12" style="padding:2rem; text-align:center;">Sin datos</td></tr>' : ''}
                ${!isDetail ? paginated.map(t => `
                    <tr onclick="window.assignTask('${t.id}')">
                        <td>${t.fecha.split('-').reverse().join('/')}</td>
                        <td>${t.id}</td>
                        <td style="text-align:center;">${(t.status === 'Finalizado' ? getTaskTotalAvance(t) : t.qty).toLocaleString()}</td>
                        <td>${t.marca}</td>
                        <td>${t.u1 || '---'}</td>
                        <td>${t.u2 || '---'}</td>
                        <td>${t.inicio ? new Date(t.inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                        <td>${t.termino ? new Date(t.termino).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'}</td>
                        <td style="text-align:center;">${calculateProductivity(t)}</td>
                        <td style="text-align:center;">${calculateGoal(t)}</td>
                        <td>${t.status}</td>
                        <td style="text-align:center; display:flex; gap:6px; justify-content:center;" onclick="event.stopPropagation()">
                            <button onclick="window.resetTask('${t.id}')" title="Reiniciar" style="background:none; border:none; cursor:pointer;">🔄</button>
                            <button onclick="window.deleteTask('${t.id}')" title="Eliminar" style="background:none; border:none; cursor:pointer; color:#ef4444;">🗑️</button>
                        </td>
                    </tr>
                `).join('') : paginated.flatMap(t => t.items.flatMap(art => art.items.map(i => `
                    <tr>
                        <td>${art.sku7}</td>
                        <td style="color:#fff;">${i.ubi}</td>
                        <td>${i.skuFull}</td>
                        <td>${(dataStore.tabla_tallas && dataStore.tabla_tallas[i.skuFull]) || i.skuFull.split('-').pop()}</td>
                        <td style="text-align:center;">${i.area.includes('CDBUFFER') ? i.qty : ''}</td>
                        <td style="text-align:center;">${!i.area.includes('CDBUFFER') ? i.qty : ''}</td>
                        <td>${t.id}</td>
                        <td>${t.status}</td>
                    </tr>
                `))).join('')}
            </tbody>
        </table>`;

    container.querySelector('#prevPage').onclick = () => { if (currentPage > 1) { currentPage--; renderTaskTable(container, tasks, isDetail); } };
    container.querySelector('#nextPage').onclick = () => { if (currentPage < totalPages) { currentPage++; renderTaskTable(container, tasks, isDetail); } };
};

const calculateProductivity = (t) => {
    if (!t.inicio || !t.termino) return '---';
    const s = new Date(t.inicio);
    const e = new Date(t.termino);
    let ms = e - s;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const calculateGoal = (t) => {
    if (!t.inicio || !t.termino) return '---';
    const s = new Date(t.inicio);
    const e = new Date(t.termino);
    const ms = e - s;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    if (totalMinutes > 0) {
        const totalAvance = getTaskTotalAvance(t);
        const unitsPerHour = (totalAvance / totalMinutes) * 60;
        return unitsPerHour >= 300 ? '<span style="color:#22c55e;">CUMPLIÓ</span>' : '<span style="color:#ef4444;">NO CUMPLIÓ</span>';
    }
    return '---';
};

const openShiftModal = (container) => {
    const logicalDate = getLogicalDate();
    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);";
    modal.innerHTML = `
        <div class="glass-panel" style="width:400px; padding:2rem; text-align:center;">
            <h2>Control de Jornada</h2>
            <p>Fecha Operativa: ${logicalDate}</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                <button id="optUpdate" class="btn">CONTINUAR TURNO (Actualizar)</button>
                <button id="optNew" class="btn" style="background:#ef4444;">REINICIAR JORNADA</button>
                <button id="optCancel" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#optUpdate').onclick = () => { document.body.removeChild(modal); processAlmacenajeTasks('update', container); };
    modal.querySelector('#optNew').onclick = () => { if(confirm("¿Borrar todo lo anterior del día?")) { document.body.removeChild(modal); processAlmacenajeTasks('new', container); } };
    modal.querySelector('#optCancel').onclick = () => document.body.removeChild(modal);
};

const processAlmacenajeTasks = async (mode = 'update', container) => {
    const stock = await getAreaData('almacenaje_activo');
    const maestro = dataStore.articulos;
    if (!stock || !stock.length || !maestro) return alert("Faltan archivos (Activo o Maestro)");

    const logicalDate = getLogicalDate();
    almacenajeTasksCache = almacenajeTasksCache.filter(t => t.fecha !== logicalDate || t.status === 'Asignado' || t.status === 'Finalizado');

    const allowedAreas = ['MZN01', 'MZN02', 'MZN03', 'MZN04', 'SEL', 'CDBUFFER'];
    const artMap = new Map();
    maestro.forEach(row => {
        const raw = Array.isArray(row) ? row : Object.values(row);
        const sku7 = String(raw[1] || '').trim().substring(0, 7);
        if (sku7 && !artMap.has(sku7)) {
            artMap.set(sku7, { 
                marca: String(raw[13] || 'S/M').trim(), 
                gender: String(raw[2] || '').trim().toUpperCase(),
                genderRims: String(raw[3] || '').trim().toUpperCase()
            });
        }
    });

    const groups = {};
    stock.forEach(row => {
        const area = String(row['Ãrea'] || row['Area'] || row['Área'] || '').trim().toUpperCase();
        if (!allowedAreas.some(a => area.includes(a))) return;
        const skuFull = String(row['ArtÃculo'] || row['Articulo'] || row['Artículo'] || row['Sku'] || '').trim();
        const sku7 = skuFull.substring(0, 7);
        const qty = parseFloat(row['Cantidad actual'] || row['Cantidad'] || row['Cant.']) || 0;
        const info = artMap.get(sku7) || { marca: 'S/M', gender: 'S/G', genderRims: 'S/GR' };
        if (!groups[sku7]) groups[sku7] = { sku7, marca: info.marca, gender: info.gender, genderRims: info.genderRims, items: [], bufferQty: 0, zonaQty: 0 };
        groups[sku7].items.push({ ...row, skuFull, qty, area });
        if (area.includes('CDBUFFER')) groups[sku7].bufferQty += qty;
        else groups[sku7].zonaQty += qty;
    });

    const eligible = Object.values(groups).filter(g => g.bufferQty > 0);
    const byMarca = {};
    eligible.forEach(art => { if (!byMarca[art.marca]) byMarca[art.marca] = []; byMarca[art.marca].push(art); });

    const specialCategories = [
        '11 NON COMMERCIAL COMPLEMENTS',
        '08 ACCESORIES',
        '09 CLOTHING',
        '06 OTHERS',
        '10 PROMOTIONS'
    ];
    const isSpecialCategory = (gr) => {
        if (!gr) return false;
        const clean = String(gr).trim().toUpperCase();
        return specialCategories.some(cat => clean.includes(cat));
    };

    const finalTasks = [];
    let taskCounter = 1;
    Object.keys(byMarca).forEach(marca => {
        const arts = byMarca[marca];
        
        // Separate special category articles and normal articles
        const specialArts = arts.filter(a => isSpecialCategory(a.genderRims));
        const normalArts = arts.filter(a => !isSpecialCategory(a.genderRims));

        // Group special articles by genderRims
        const specialGroups = {};
        specialArts.forEach(a => {
            const cat = String(a.genderRims || 'OTHER_SPECIAL').trim().toUpperCase();
            if (!specialGroups[cat]) specialGroups[cat] = [];
            specialGroups[cat].push(a);
        });

        // Create a single task for each special category group
        Object.keys(specialGroups).forEach(cat => {
            const groupArts = specialGroups[cat];
            const totalQty = groupArts.reduce((sum, a) => sum + a.bufferQty, 0);
            finalTasks.push({ id: `Tarea${taskCounter++}`, marca, qty: totalQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: groupArts, fecha: logicalDate });
        });

        const bigNormals = normalArts.filter(a => a.bufferQty >= 300);
        const smallNormals = normalArts.filter(a => a.bufferQty < 300);

        bigNormals.forEach(a => {
            finalTasks.push({ id: `Tarea${taskCounter++}`, marca, qty: a.bufferQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [a], fecha: logicalDate });
        });
        
        // Group smalls
        let currentGroup = []; let currentQty = 0;
        smallNormals.forEach((art, idx, arr) => {
            currentGroup.push(art); currentQty += art.bufferQty;
            if (currentQty >= 300 || idx === arr.length - 1) {
                finalTasks.push({ id: `Tarea${taskCounter++}`, marca, qty: currentQty, status: 'Creada', u1: '', u2: '', inicio: '', termino: '', items: [...currentGroup], fecha: logicalDate });
                currentGroup = []; currentQty = 0;
            }
        });
    });

    almacenajeTasksCache = [...almacenajeTasksCache, ...finalTasks];
    saveAlmacenajeTasksLocal();
    renderAlmacenajeTareas(container);
};

const clearCurrentShiftTasks = (container) => {
    const targetDate = selectedTaskDate || getLogicalDate();
    if (confirm(`¿Borrar tareas pendientes de ${targetDate}?`)) {
        almacenajeTasksCache = almacenajeTasksCache.filter(t => t.fecha !== targetDate || t.status === 'Asignado' || t.status === 'Finalizado');
        saveAlmacenajeTasksLocal();
        renderAlmacenajeTareas(container);
    }
};

const exportAlmacenajeExcel = () => {
    if (!almacenajeTasksCache.length) return alert("No hay tareas.");
    const dataRows = [["Articulo", "UBICACION", "SKU", "Tallas", "Marcas", "Qty Buffer", "Qty Zona", "Tarea"]];
    almacenajeTasksCache.forEach(t => t.items.forEach(art => art.items.forEach(i => {
        dataRows.push([art.sku7, i.ubi, i.skuFull, "", art.marca, i.area.includes('CDBUFFER')?i.qty:'', !i.area.includes('CDBUFFER')?i.qty:'', t.id]);
    })));
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tareas");
    XLSX.writeFile(wb, "Plan_Almacenaje.xlsx");
};

window.assignTask = (id) => {
    const t = almacenajeTasksCache.find(x => x.id === id);
    if (!t) return;
    const workers = adminService.getWorkers().filter(w => w.active);
    const options = workers.map(w => `<option value="${w.nombre}">${w.nombre}</option>`).join('');
    const modal = document.createElement('div');
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:3000; display:flex; align-items:center; justify-content:center;";
    modal.innerHTML = `
        <div class="glass-panel" style="width:300px; padding:1.5rem;">
            <h3>Asignar ${id}</h3>
            <select id="m_u1">${options}</select>
            <button id="m_save">Iniciar</button>
            <button id="m_finish">Finalizar</button>
            <button onclick="document.body.removeChild(this.parentNode.parentNode)">Cerrar</button>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#m_save').onclick = () => { t.u1 = modal.querySelector('#m_u1').value; t.status = 'Asignado'; t.inicio = new Date().toISOString(); saveAlmacenajeTasksLocal(); document.body.removeChild(modal); renderAlmacenajeTareas(document.getElementById('areaContent')); };
    modal.querySelector('#m_finish').onclick = () => { t.status = 'Finalizado'; t.termino = new Date().toISOString(); saveAlmacenajeTasksLocal(); document.body.removeChild(modal); renderAlmacenajeTareas(document.getElementById('areaContent')); };
};

window.resetTask = (id) => {
    const t = almacenajeTasksCache.find(x => x.id === id);
    if (t) { t.u1 = ''; t.u2 = ''; t.inicio = ''; t.termino = ''; t.status = 'Creada'; saveAlmacenajeTasksLocal(); renderAlmacenajeTareas(document.getElementById('areaContent')); }
};
window.deleteTask = (id) => {
    if (confirm(`¿Eliminar tarea ${id}?`)) {
        almacenajeTasksCache = almacenajeTasksCache.filter(x => x.id !== id);
        saveAlmacenajeTasksLocal();
        renderAlmacenajeTareas(document.getElementById('areaContent'));
    }
};
