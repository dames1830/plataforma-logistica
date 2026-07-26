# -*- coding: utf-8 -*-
with open("js/views/dashboard_v28.js", "r", encoding="utf-8") as f:
    text = f.read()

# ============================================================
# PART 1: Replace the MARCAS table header + data logic
# Only the tbody IIFE and thead - surgical replacement
# ============================================================

OLD_THEAD = """                                <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                                    <th style="padding:6px 8px; text-align:left; width: 120px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">AVANCE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 100px;">PENDIENTE</th>
                                </tr>"""

NEW_THEAD = """                                <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                                    <th style="padding:6px 8px; text-align:left; width: 110px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 70px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px; color:#facc15;">D\u00cdA</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px; color:#818cf8;">NOCHE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 60px;">TOTAL</th>
                                    <th style="padding:6px 8px; text-align:center; width: 55px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px;">PENDIENTE</th>
                                </tr>"""

count_thead = text.count(OLD_THEAD)
print(f"THEAD found: {count_thead}")
if count_thead == 1:
    text = text.replace(OLD_THEAD, NEW_THEAD)
    print("THEAD replaced OK")

# ============================================================
# PART 2: Replace the data-building IIFE inside MARCAS tbody
# ============================================================

OLD_TBODY = """                                ${(() => {
                                    const brandGroups = {};
                                    const filteredTasks = tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate);

                                    filteredTasks.forEach(t => {
                                        (t.items || []).forEach(art => {
                                            const brand = String(art.marca || 'S/M').trim();
                                            const bufferItems = art.items || [];
                                            
                                            bufferItems.forEach(i => {
                                                const ubi = String(i.ubi || '').toUpperCase().trim();
                                                if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                                                    let area = 'CDBUFFER-A';
                                                    if (ubi.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
                                                    else if (ubi.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
                                                    else {
                                                        const parts = ubi.split('-');
                                                        area = parts.length > 1 ? `${parts[0]}-${parts[1]}` : parts[0];
                                                    }
                                                    
                                                    const qty = parseFloat(i.qty) || 0;
                                                    
                                                    if (!brandGroups[area]) brandGroups[area] = {};
                                                    if (!brandGroups[area][brand]) {
                                                        brandGroups[area][brand] = { buffer: 0, avance: 0 };
                                                    }
                                                    
                                                    brandGroups[area][brand].buffer += qty;
                                                    if (t.status === 'Finalizado') {
                                                        const avanceVal = (i.avance !== undefined && i.avance !== null) ? (parseFloat(i.avance) || 0) : qty;
                                                        brandGroups[area][brand].avance += avanceVal;
                                                    }
                                                }
                                            });
                                        });
                                    });

                                    const areas = Object.keys(brandGroups).sort((a, b) => b.localeCompare(a));
                                    let brandTableRows = '';
                                    let grandBuffer = 0;
                                    let grandAvance = 0;

                                    if (areas.length === 0) {
                                        return `<tr><td colspan="6" style="padding:4rem; text-align:center; color:rgba(0, 229, 255, 0.3); font-weight:700;">No hay datos de almac\xe9n para mostrar en esta selecci\xf3n.</td></tr>`;
                                    }

                                    areas.forEach(area => {
                                        const brands = Object.keys(brandGroups[area]).sort((a, b) => a.localeCompare(b));
                                        let areaBufferSum = 0;
                                        let areaAvanceSum = 0;

                                        brands.forEach(brand => {
                                            const data = brandGroups[area][brand];
                                            const pct = data.buffer > 0 ? Math.round((data.avance / data.buffer) * 100) : 0;
                                            const pendiente = data.buffer - data.avance;
                                            
                                            areaBufferSum += data.buffer;
                                            areaAvanceSum += data.avance;
                                            grandBuffer += data.buffer;
                                            grandAvance += data.avance;

                                            brandTableRows += `
                                                <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                                    <td style="padding:5px 6px; color:#a1a1aa; font-size: 0.78rem; font-weight:600;">${area}</td>
                                                    <td style="padding:5px 6px;"><b style="color:#ffffff; font-weight:800; font-size:0.8rem; font-family:'Outfit', sans-serif;">${brand}</b></td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${data.buffer.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${data.avance.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem;">
                                                        ${getPctHtml(data.avance, data.buffer, true)}
                                                    </td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; color:#00E5FF;  font-size:0.8rem;">${pendiente.toLocaleString()}</td>
                                                </tr>
                                            `;
                                        });

                                        const areaPendiente = areaBufferSum - areaAvanceSum;

                                        brandTableRows += `
                                            <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(15, 23, 42, 0.5) 100%); border-top: 1.5px solid rgba(0, 229, 255, 0.6); border-bottom: 1.5px solid rgba(0, 229, 255, 0.6); font-weight: 900;">
                                                <td colspan="2" style="padding:7px 8px; color:#00E5FF; font-weight:900; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; border-left: 4px solid #00E5FF;">Total ${area}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaBufferSum.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaAvanceSum.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800;">
                                                    ${getPctHtml(areaAvanceSum, areaBufferSum, false)}
                                                </td>
                                                <td style="padding:7px 8px; text-align:center; color:#00E5FF; font-size:0.82rem; font-weight:900;">${areaPendiente.toLocaleString()}</td>
                                            </tr>
                                        `;
                                    });

                                    const grandPendiente = grandBuffer - grandAvance;
                                    
                                    brandTableRows += `
                                        <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #00E5FF; border-bottom: 2px solid #00E5FF; font-weight: 900;">
                                            <td colspan="2" style="padding:9px 8px; color:#ffffff; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; font-family:'Outfit', sans-serif; font-weight:900; border-left: 6px solid #00E5FF;">TOTAL GENERAL CDBUFFER</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandBuffer.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandAvance.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900;">
                                                ${getPctHtml(grandAvance, grandBuffer, false)}
                                            </td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900; text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);">${grandPendiente.toLocaleString()}</td>
                                        </tr>
                                    `;

                                    return brandTableRows;
                                })()}"""

NEW_TBODY = """                                ${(() => {
                                    // Build worker shift lookup once
                                    const marcasWorkers = adminService.getWorkers() || [];
                                    const getWorkerShift = (username) => {
                                        if (!username || username === '---' || username === '') return null;
                                        const clean = String(username).trim().toLowerCase();
                                        const w = marcasWorkers.find(w => {
                                            const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
                                            const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
                                            return nom ? (`${nom[0]}${ape}` === clean) : false;
                                        });
                                        if (!w) return null;
                                        return String(w.turno || w.Turno || '').trim().toUpperCase() === 'NOCHE' ? 'NOCHE' : 'DIA';
                                    };

                                    const brandGroups = {};
                                    const filteredTasks = tasks.filter(t => t.fecha >= window.__kpiStartDate && t.fecha <= window.__kpiEndDate);

                                    filteredTasks.forEach(t => {
                                        const shift1 = getWorkerShift(t.u1);
                                        const shift2 = t.u2 ? getWorkerShift(t.u2) : null;
                                        const taskShift = shift1 || shift2 || 'DIA';

                                        (t.items || []).forEach(art => {
                                            const brand = String(art.marca || 'S/M').trim();
                                            const bufferItems = art.items || [];
                                            bufferItems.forEach(i => {
                                                const ubi = String(i.ubi || '').toUpperCase().trim();
                                                if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                                                    let area = 'CDBUFFER-A';
                                                    if (ubi.startsWith('CDBUFFER-B')) area = 'CDBUFFER-B';
                                                    else if (ubi.startsWith('CDBUFFER-A')) area = 'CDBUFFER-A';
                                                    else { const parts = ubi.split('-'); area = parts.length > 1 ? `${parts[0]}-${parts[1]}` : parts[0]; }
                                                    const qty = parseFloat(i.qty) || 0;
                                                    if (!brandGroups[area]) brandGroups[area] = {};
                                                    if (!brandGroups[area][brand]) brandGroups[area][brand] = { buffer: 0, dia: 0, noche: 0 };
                                                    brandGroups[area][brand].buffer += qty;
                                                    if (t.status === 'Finalizado') {
                                                        const avanceVal = (i.avance !== undefined && i.avance !== null) ? (parseFloat(i.avance) || 0) : qty;
                                                        if (taskShift === 'NOCHE') brandGroups[area][brand].noche += avanceVal;
                                                        else brandGroups[area][brand].dia += avanceVal;
                                                    }
                                                }
                                            });
                                        });
                                    });

                                    const areas = Object.keys(brandGroups).sort((a, b) => b.localeCompare(a));
                                    let brandTableRows = '';
                                    let grandBuffer = 0, grandDia = 0, grandNoche = 0;

                                    if (areas.length === 0) {
                                        return `<tr><td colspan="8" style="padding:4rem; text-align:center; color:rgba(0, 229, 255, 0.3); font-weight:700;">No hay datos de almac\xe9n para mostrar en esta selecci\xf3n.</td></tr>`;
                                    }

                                    areas.forEach(area => {
                                        const brands = Object.keys(brandGroups[area]).sort((a, b) => a.localeCompare(b));
                                        let areaBuffer = 0, areaDia = 0, areaNoche = 0;

                                        brands.forEach(brand => {
                                            const data = brandGroups[area][brand];
                                            const total = data.dia + data.noche;
                                            const pendiente = data.buffer - total;
                                            areaBuffer += data.buffer; areaDia += data.dia; areaNoche += data.noche;
                                            grandBuffer += data.buffer; grandDia += data.dia; grandNoche += data.noche;

                                            brandTableRows += `
                                                <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                                    <td style="padding:5px 6px; color:#a1a1aa; font-size:0.78rem; font-weight:600;">${area}</td>
                                                    <td style="padding:5px 6px;"><b style="color:#ffffff; font-weight:800; font-size:0.8rem; font-family:'Outfit', sans-serif;">${brand}</b></td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${data.buffer.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#facc15; font-size:0.8rem;">${data.dia.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#818cf8; font-size:0.8rem;">${data.noche.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:700; color:#ffffff; font-size:0.8rem;">${total.toLocaleString()}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem;">${getPctHtml(total, data.buffer, true)}</td>
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; color:#00E5FF; font-size:0.8rem;">${pendiente.toLocaleString()}</td>
                                                </tr>
                                            `;
                                        });

                                        const areaTotal = areaDia + areaNoche;
                                        const areaPendiente = areaBuffer - areaTotal;
                                        brandTableRows += `
                                            <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(15, 23, 42, 0.5) 100%); border-top: 1.5px solid rgba(0, 229, 255, 0.6); border-bottom: 1.5px solid rgba(0, 229, 255, 0.6); font-weight: 900;">
                                                <td colspan="2" style="padding:7px 8px; color:#00E5FF; font-weight:900; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; border-left: 4px solid #00E5FF;">Total ${area}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaBuffer.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#facc15; font-size:0.82rem; font-weight:800;">${areaDia.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#818cf8; font-size:0.82rem; font-weight:800;">${areaNoche.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#ffffff; font-size:0.82rem; font-weight:800;">${areaTotal.toLocaleString()}</td>
                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800;">${getPctHtml(areaTotal, areaBuffer, false)}</td>
                                                <td style="padding:7px 8px; text-align:center; color:#00E5FF; font-size:0.82rem; font-weight:900;">${areaPendiente.toLocaleString()}</td>
                                            </tr>
                                        `;
                                    });

                                    const grandTotal = grandDia + grandNoche;
                                    const grandPendiente = grandBuffer - grandTotal;
                                    brandTableRows += `
                                        <tr style="background: linear-gradient(90deg, rgba(0, 229, 255, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #00E5FF; border-bottom: 2px solid #00E5FF; font-weight: 900;">
                                            <td colspan="2" style="padding:9px 8px; color:#ffffff; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; font-family:'Outfit', sans-serif; font-weight:900; border-left: 6px solid #00E5FF;">TOTAL GENERAL CDBUFFER</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandBuffer.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#facc15; font-size:0.85rem; font-weight:900;">${grandDia.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#818cf8; font-size:0.85rem; font-weight:900;">${grandNoche.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900;">${grandTotal.toLocaleString()}</td>
                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900;">${getPctHtml(grandTotal, grandBuffer, false)}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900; text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);">${grandPendiente.toLocaleString()}</td>
                                        </tr>
                                    `;

                                    return brandTableRows;
                                })()}"""

count_tbody = text.count(OLD_TBODY)
print(f"TBODY found: {count_tbody}")
if count_tbody == 1:
    text = text.replace(OLD_TBODY, NEW_TBODY)
    print("TBODY replaced OK")
else:
    print("ERROR: TBODY block not found or found multiple times")

# ============================================================
# PART 3: Add shift validation on m_save onclick
# ============================================================

OLD_SAVE = """        document.getElementById('m_save').onclick = () => {
            const u1 = document.getElementById('m_u1').value;
            if (!u1) { showPremiumAlert("ASIGNAR TAREA", "Usuario 1 es obligatorio.", "error"); return; }
            t.u1 = u1;
            t.u2 = document.getElementById('m_u2').value;
            t.status = 'Asignado';
            if (!t.inicio) t.inicio = new Date().toISOString();
            t._dirty = true;
            saveAlmacenajeTasks(t); 
            document.body.removeChild(modal);
            renderAlmacenajeTareas(container);
        };"""

NEW_SAVE = """        document.getElementById('m_save').onclick = () => {
            const u1 = document.getElementById('m_u1').value;
            const u2 = document.getElementById('m_u2').value;
            if (!u1) { showPremiumAlert("ASIGNAR TAREA", "Usuario 1 es obligatorio.", "error"); return; }

            // Validate: U1 and U2 cannot be from different shifts
            if (u1 && u2 && u2 !== '') {
                const allWorkers = adminService.getWorkers() || [];
                const getShiftForUser = (username) => {
                    const clean = String(username).trim().toLowerCase();
                    const w = allWorkers.find(w => {
                        const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
                        const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
                        return nom ? (`${nom[0]}${ape}` === clean) : false;
                    });
                    if (!w) return null;
                    return String(w.turno || w.Turno || '').trim().toUpperCase() === 'NOCHE' ? 'NOCHE' : 'D\\u00cdA';
                };
                const shift1 = getShiftForUser(u1);
                const shift2 = getShiftForUser(u2);
                if (shift1 && shift2 && shift1 !== shift2) {
                    showPremiumAlert(
                        "\\u26a0\\ufe0f CONFLICTO DE TURNO",
                        "No se puede asignar esta tarea: Usuario 1 es de turno " + shift1 + " y Usuario 2 es de turno " + shift2 + ". Ambos operarios deben pertenecer al mismo turno.",
                        "error"
                    );
                    return;
                }
            }

            t.u1 = u1;
            t.u2 = u2;
            t.status = 'Asignado';
            if (!t.inicio) t.inicio = new Date().toISOString();
            t._dirty = true;
            saveAlmacenajeTasks(t); 
            document.body.removeChild(modal);
            renderAlmacenajeTareas(container);
        };"""

count_save = text.count(OLD_SAVE)
print(f"OLD_SAVE found: {count_save}")
if count_save == 1:
    text = text.replace(OLD_SAVE, NEW_SAVE)
    print("m_save validation replaced OK")
else:
    print("ERROR: m_save block not found or found multiple times")

with open("js/views/dashboard_v28.js", "w", encoding="utf-8") as f:
    f.write(text)
print("File saved.")
