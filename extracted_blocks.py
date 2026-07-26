hourly = """console.error("hourly not found");"""
weekly = """console.error("weekly not found");"""
chart = """
        const chartWeeksData = {};

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            return `Semana ${weekNo} (${parts[0]})`;
        };

        const getDayIndex = (dateStr) => {
            if (!dateStr) return -1;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return -1;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const day = d.getDay();
            return day === 0 ? 6 : day - 1;
        };

        const getActiveDayIndices = (startStr, endStr) => {
            if (!startStr || !endStr) return [0, 1, 2, 3, 4, 5];
            const startParts = startStr.split('-');
            const endParts = endStr.split('-');
            if (startParts.length !== 3 || endParts.length !== 3) return [0, 1, 2, 3, 4, 5];
            
            const startObj = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
            const endObj = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
            
            if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) return [0, 1, 2, 3, 4, 5];
            
            // Si el rango es de 7 días o más, mostramos la semana completa
            const diffTime = Math.abs(endObj - startObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 6) {
                return [0, 1, 2, 3, 4, 5];
            }
            
            const active = new Set();
            let current = new Date(startObj.getTime());
            while (current <= endObj) {
                const day = current.getDay();
                const idx = day === 0 ? 6 : day - 1;
                if (idx !== 6) active.add(idx);
                current.setDate(current.getDate() + 1);
            }
            return Array.from(active).sort((a, b) => a - b);
        };

        const getTaskMetrics = (t) => {
            let qtyBuffer = 0;
            let avance = 0;
            (t.items || []).forEach(art => {
                const bufferItems = art.items || [];
                const cdbufferItems = bufferItems.filter(i => {
                    const ubi = String(i.ubi || '').toUpperCase();
                    return ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C');
                });

                cdbufferItems.forEach(i => {
                    const qty = parseFloat(i.qty) || 0;
                    qtyBuffer += qty;
                    if (t.status === 'Finalizado') {
                        avance += (i.avance !== undefined && i.avance !== null) ? parseFloat(i.avance) : qty;
                    }
                });
            });
            return { qtyBuffer, avance };
        };

        // dynamic default dates
        let minDate = '';
        let maxDate = '';
        tasksList.forEach(t => {
            if (t.status === 'Finalizado' && t.fecha) {
                if (!minDate || t.fecha < minDate) minDate = t.fecha;
                if (!maxDate || t.fecha > maxDate) maxDate = t.fecha;
            }
        });

        if (!window.__chartStartDate || !window.__chartEndDate) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.getTime());
            monday.setDate(diff);
            monday.setHours(0,0,0,0);
            const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
            
            const toYYYYMMDD = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            
            window.__chartStartDate = toYYYYMMDD(monday);
            window.__chartEndDate = toYYYYMMDD(sunday);
        }

        const startDate = window.__chartStartDate || '';
        const endDate = window.__chartEndDate || '';

        const chartTasks = tasksList.filter(t => {
            if (!t.fecha) return false;
            if (startDate && t.fecha < startDate) return false;
            if (endDate && t.fecha > endDate) return false;
            return true;
        });

        chartTasks.forEach(t => {
            const weekStr = getWeekStr(t.fecha);
            const dayIdx = getDayIndex(t.fecha);
            if (weekStr === '---' || dayIdx === -1) return;
            
            if (!chartWeeksData[weekStr]) {
                chartWeeksData[weekStr] = {
                    qtyBuffer: [0, 0, 0, 0, 0, 0, 0],
                    avance: [0, 0, 0, 0, 0, 0, 0]
                };
            }
            const metrics = getTaskMetrics(t);
            chartWeeksData[weekStr].qtyBuffer[dayIdx] += metrics.qtyBuffer;
            chartWeeksData[weekStr].avance[dayIdx] += metrics.avance;
        });

        const activeWeeks = Object.keys(chartWeeksData).sort((a, b) => {
            const getVal = (s) => {
                const m = s.match(/Semana (\d+) \((\d+)\)/);
                if (!m) return 0;
                return parseInt(m[2]) * 100 + parseInt(m[1]);
            };
            return getVal(a) - getVal(b);
        });

        const displayWeeks = activeWeeks;

        setTimeout(() => {
            const ctx = document.getElementById('weeklyDailyChartCanvas');
            if (!ctx) {
                console.warn("⚠️ Canvas element 'weeklyDailyChartCanvas' not found in DOM yet.");
                return;
            }
            
            if (window.weeklyDailyChartInstance) {
                try {
                    window.weeklyDailyChartInstance.destroy();
                } catch(e) {
                    console.error("Error destroying chart instance:", e);
                }
            }
            
            if (typeof Chart === 'undefined') {
                console.error("❌ Chart.js is not loaded.");
                return;
            }
            
            const activeIndices = getActiveDayIndices(startDate, endDate);
            const allLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const chartLabels = allLabels.filter((_, idx) => activeIndices.includes(idx));

            const datasets = [];
            displayWeeks.forEach((week, idx) => {
                const labelSuffix = displayWeeks.length > 1 ? ` (${week})` : '';
                
                // Qty Buffer dataset
                const bufferColor = { border: '#00E5FF', bg: 'rgba(0, 229, 255, 0.05)' };
                const filteredBufferData = chartWeeksData[week].qtyBuffer.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Qty Buffer${labelSuffix}`,
                    data: filteredBufferData,
                    borderColor: bufferColor.border,
                    backgroundColor: bufferColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: bufferColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });

                // Avance dataset
                const avanceColor = { border: '#eab308', bg: 'rgba(234, 179, 8, 0.05)' };
                const filteredAvanceData = chartWeeksData[week].avance.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Avance${labelSuffix}`,
                    data: filteredAvanceData,
                    borderColor: avanceColor.border,
                    backgroundColor: avanceColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: avanceColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });
            });

            if (displayWeeks.length > 0) {
                let totalSum = 0;
                let totalDays = 0;
                displayWeeks.forEach(week => {
                    activeIndices.forEach(idx => {
                        totalSum += chartWeeksData[week].qtyBuffer[idx] || 0;
                        totalDays++;
                    });
                });
                const overallAverage = totalDays > 0 ? Math.round(totalSum / totalDays) : 0;
                const averageData = activeIndices.map(() => overallAverage);
                
                datasets.push({
                    label: 'Promedio',
                    data: averageData,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false
                });
            }
            
            const datalabelsPlugin = {
                id: 'datalabels',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                        if (dataset.label === 'Promedio') return;
                        const meta = chart.getDatasetMeta(i);
                        if (meta.hidden) return;
                        meta.data.forEach((point, index) => {
                            const val = dataset.data[index];
                            if (val === undefined || val === null) return;
                            
                            ctx.save();
                            ctx.fillStyle = dataset.borderColor || '#ffffff';
                            ctx.font = 'bold 11px "Inter", sans-serif';
                            let yOffset = -8;
                            ctx.textBaseline = 'bottom';
                            if (i % 2 !== 0) {
                                ctx.textBaseline = 'top';
                                yOffset = 8;
                            }
                            
                            // Sombra negra para máxima legibilidad sobre cualquier cuadrícula o fondo
                            ctx.shadowColor = '#000000';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 1;
                            
                            ctx.fillText(val.toLocaleString(), point.x, point.y + yOffset);
                            ctx.restore();
                        });
                    });
                }
            };
            
            window.weeklyDailyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                            position: 'top',
                            labels: {
                                color: '#e2e8f0',
                                font: {
                                    family: "'Outfit', sans-serif",
                                    weight: 'bold',
                                    size: 11
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fef08a',
                            bodyColor: '#ffffff',
                            borderColor: '#eab308',
                            borderWidth: 1.5,
                            titleFont: { family: "'Outfit', sans-serif", weight: '900', size: 13 },
                            bodyFont: { family: "'Inter', sans-serif", size: 12 },
                            padding: 12,
                            cornerRadius: 10,
                            boxPadding: 8,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    const val = context.parsed.y;
                                    if (val !== null && val !== undefined) {
                                        return ` ${label}: ${val.toLocaleString()}`;
                                    }
                                    return ` ${label}`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 25,
                            right: 25,
                            top: 20,
                            bottom: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            },
                            beginAtZero: true
                        }
                    }
                },
                plugins: [datalabelsPlugin]
            });
        }, 100);

        return `
        <!-- GRÁFICO POR SEMANA Y DÍA -->
        <div style="background:#000000; border:2px solid #eab308; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(234,179,8,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid rgba(234,179,8,0.15); padding-bottom:8px;">
                <div style="border-left: 4px solid #eab308; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                    <h3 style="color:#fef08a; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                        GRÁFICO DE RENDIMIENTO SEMANA Y DÍA
                    </h3>
                    <div style="font-size:0.68rem; color:rgba(234, 179, 8, 0.6); font-weight:700; letter-spacing:0.5px;">
                        TENDENCIAS DIARIAS COMPARADAS POR SEMANAS (LUNES A SÁBADO)
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-family:'Inter', sans-serif;">
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Desde:</span>
                        <input type="date" id="chartStartDateInput" value="${window.__chartStartDate}" onchange="window.setChartDateRange(this.value, null)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Hasta:</span>
                        <input type="date" id="chartEndDateInput" value="${window.__chartEndDate}" onchange="window.setChartDateRange(null, this.value)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                </div>
            </div>
            <div style="position:relative; width:100%; height:250px; margin-top:0.5rem;">
                <canvas id="weeklyDailyChartCanvas" style="width:100%; height:100%; max-height:250px;"></canvas>
            </div>
        </div>
        `;"""
marcas = """<div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                            <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                                REPORTE ALMACENAJE - MARCAS
                            </h3>
                            <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                                SYNC_ID: ${(() => {
                                    const syncTimeStr = new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
                                    const startStr = window.__kpiStartDate.split('-').reverse().join('/');
                                    const endStr = window.__kpiEndDate.split('-').reverse().join('/');
                                    const syncDateStr = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
                                    return `${syncDateStr} ${syncTimeStr}`;
                                })()}
                            </div>
                        </div>
                        <button onclick="document.getElementById('btn_refresh_almacenaje').click()" title="Actualizar Reporte" style="background:rgba(0, 229, 255, 0.1); border:1px solid #00E5FF; color:#00E5FF; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9rem; transition:all 0.2s; box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);" onmouseover="this.style.background='rgba(0, 229, 255, 0.2)'; this.style.boxShadow='0 0 15px rgba(0, 229, 255, 0.4)'" onmouseout="this.style.background='rgba(0, 229, 255, 0.1)'; this.style.boxShadow='0 0 10px rgba(0, 229, 255, 0.2)'">
                            🔄
                        </button>
                    </div>
                    
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                            <thead>
                                <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                                    <th style="padding:6px 8px; text-align:left; width: 100px;">AREA</th>
                                    <th style="padding:6px 8px; text-align:left; max-width:130px; width:130px;">MARCAS</th>
                                    <th style="padding:6px 8px; text-align:center; width: 85px;">BUFFER</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px; color:#facc15;">DÍA</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px; color:#818cf8;">NOCHE</th>
                                    <th style="padding:6px 8px; text-align:center; width: 75px;">TOTAL</th>
                                    <th style="padding:6px 8px; text-align:center; width: 70px;">%</th>
                                    <th style="padding:6px 8px; text-align:center; width: 90px;">PENDIENTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
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
                                        return `<tr><td colspan="8" style="padding:4rem; text-align:center; color:rgba(0, 229, 255, 0.3); font-weight:700;">No hay datos de almacén para mostrar en esta selección.</td></tr>`;
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
                                                    <td style="padding:5px 6px; text-align:center; font-weight:800; font-size:0.75rem; white-space:nowrap;">${(() => { const _p = data.buffer > 0 ? Math.round((total/data.buffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (total < data.buffer ? '#fbbf24' : '#22c55e'); const _ic = _p === 0 ? '●' : '▲'; return `<span style="color:${_col}; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:3px;"><span>${_ic}</span><span>${_p}%</span></span>`; })()}</td>
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
                                                <td style="padding:7px 8px; text-align:center; font-size:0.82rem; font-weight:800; white-space:nowrap;">${(() => { const _p = areaBuffer > 0 ? Math.round((areaTotal/areaBuffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (areaTotal < areaBuffer ? '#fbbf24' : '#22c55e'); return `<span style="color:${_col}; font-weight:800; font-size:0.82rem;">${_p}%</span>`; })()}</td>
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
                                            <td style="padding:9px 8px; text-align:center; font-size:0.85rem; font-weight:900; white-space:nowrap;">${(() => { const _p = grandBuffer > 0 ? Math.round((grandTotal/grandBuffer)*100) : 0; const _col = _p === 0 ? '#ef4444' : (grandTotal < grandBuffer ? '#fbbf24' : '#22c55e'); return `<span style="color:${_col}; font-weight:900; font-size:0.85rem;">${_p}%</span>`; })()}</td>
                                            <td style="padding:9px 8px; text-align:center; color:#00E5FF; font-size:0.85rem; font-weight:900; text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);">${grandPendiente.toLocaleString()}</td>
                                        </tr>
                                    `;

                                    return brandTableRows;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>"""
operarios = """<div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                        <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                            RENDIMIENTO DE OPERARIOS
                        </h3>
                        <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                            MEDICIÓN DE TAREAS FINALIZADAS
                        </div>
                    </div>
                </div>
                
                <div style="overflow-x:auto; margin-top:0.4rem;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead>
                            <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                                <th style="padding:6px 4px; text-align:left; width:70px; white-space:nowrap;">FECHA</th>
                                <th style="padding:6px 4px; text-align:center; width:65px; white-space:nowrap;">TURNO</th>
                                <th style="padding:6px 8px; text-align:center; width: 90px; white-space:nowrap;">N° OPERARIOS</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">QTY TOTAL</th>
                                <th style="padding:6px 8px; text-align:center; width: 90px; white-space:nowrap;">QTY TAREAS</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">PRIMERA TAREA</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">ÚLTIMA TAREA</th>
                                <th style="padding:6px 8px; text-align:center; width: 110px; white-space:nowrap;">TRANSCURRIDO</th>
                                <th style="padding:6px 8px; text-align:center; width: 100px; white-space:nowrap;">QTY/HORA</th>
                                <th style="padding:6px 8px; text-align:center; width: 110px; white-space:nowrap;">QTY/TAREA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const shiftStats = {};
                                const workers = adminService.getWorkers() || [];

                                const findWorkerByUsername = (username) => {
                                    if (!username || username === '---') return null;
                                    const cleanUsername = String(username).trim().toLowerCase();
                                    return workers.find(w => {
                                        const nom = (w.nombre || w.Nombre || '').trim().toLowerCase();
                                        const ape = (w.apellidos || w.Apellidos || '').trim().split(' ')[0].toLowerCase();
                                        const formatStr = nom ? `${nom[0]}${ape}` : '';
                                        return formatStr === cleanUsername;
                                    });
                                };

                                const getTaskLogicalDate = (task, shiftVal) => {
                                    return task.fecha || '---';
                                };

                                const getBreakOverlapMs = (start, end) => {
                                    if (!start || !end || start >= end) return 0;
                                    let overlap = 0;
                                    let current = new Date(start.getTime());
                                    current.setHours(0, 0, 0, 0);
                                    
                                    const endLimit = new Date(end.getTime());
                                    endLimit.setHours(23, 59, 59, 999);
                                    
                                    while (current <= endLimit) {
                                        const bStart = new Date(current.getTime());
                                        bStart.setHours(23, 0, 0, 0); // 11:00 PM
                                        const bEnd = new Date(current.getTime());
                                        bEnd.setHours(23, 50, 0, 0); // 11:50 PM
                                        
                                        const oStart = start > bStart ? start : bStart;
                                        const oEnd = end < bEnd ? end : bEnd;
                                        
                                        if (oStart < oEnd) {
                                            overlap += (oEnd - oStart);
                                        }
                                        current.setDate(current.getDate() + 1);
                                    }
                                    return overlap;
                                };

                                // Procesar tareas y calcular su fecha lógica antes de agrupar y filtrar
                                const processedTasks = [];
                                tasks.forEach(t => {
                                    if (t.status !== 'Finalizado') return;

                                    const uList = [t.u1, t.u2].filter(u => u && u !== '---');
                                    if (uList.length > 0) {
                                        uList.forEach((user, idx) => {
                                            const username = String(user).trim().toLowerCase();
                                            const worker = findWorkerByUsername(username);
                                            
                                            let shift = 'DÍA';
                                            if (worker) {
                                                const wTurno = String(worker.turno || worker.Turno || '').trim().toUpperCase();
                                                if (wTurno === 'NOCHE') shift = 'NOCHE';
                                                else if (wTurno === 'DIA' || wTurno === 'DÍA') shift = 'DÍA';
                                            }
                                            
                                            const logicalDate = getTaskLogicalDate(t, shift);
                                            
                                            // [DECOUPLED] RENDIMIENTO DE OPERARIOS ya no es afectado por filtros de fecha del historial
                                            // if (selectedTaskDate && logicalDate !== selectedTaskDate) return;

                                            processedTasks.push({
                                                task: t,
                                                username,
                                                shift,
                                                logicalDate,
                                                qtyForUser: (uList.length === 2) 
                                                    ? (idx === 0 ? Math.ceil(getTaskTotalAvance(t) / 2) : Math.floor(getTaskTotalAvance(t) / 2)) 
                                                    : getTaskTotalAvance(t)
                                            });
                                        });
                                    }
                                });

                                processedTasks.forEach(pt => {
                                    const groupKey = `${pt.logicalDate}_${pt.shift}`;
                                    if (!shiftStats[groupKey]) {
                                        shiftStats[groupKey] = {
                                            fecha: pt.logicalDate,
                                            turno: pt.shift,
                                            operators: new Set(),
                                            tasks: new Set(),
                                            totalQty: 0,
                                            taskCount: 0,
                                            firstStart: null,
                                            lastEnd: null
                                        };
                                    }
                                    
                                    shiftStats[groupKey].operators.add(pt.username);
                                    shiftStats[groupKey].totalQty += pt.qtyForUser;
                                    
                                    const taskId = pt.task.id || pt.task.Id || JSON.stringify(pt.task);
                                    if (!shiftStats[groupKey].tasks.has(taskId)) {
                                        shiftStats[groupKey].tasks.add(taskId);
                                        shiftStats[groupKey].taskCount += 1;
                                    }
                                    
                                    if (pt.task.inicio) {
                                        let sTime = new Date(pt.task.inicio);
                                        if (pt.shift === 'NOCHE') {
                                            const hrs = sTime.getHours();
                                            if (hrs >= 0 && hrs < 7) {
                                                const sYear = sTime.getFullYear();
                                                const sMonth = String(sTime.getMonth() + 1).padStart(2, '0');
                                                const sDay = String(sTime.getDate()).padStart(2, '0');
                                                const sDateStr = `${sYear}-${sMonth}-${sDay}`;
                                                if (sDateStr === pt.logicalDate) {
                                                    sTime.setDate(sTime.getDate() + 1);
                                                }
                                            }
                                        }
                                        if (!shiftStats[groupKey].firstStart || sTime < shiftStats[groupKey].firstStart) {
                                            shiftStats[groupKey].firstStart = sTime;
                                        }
                                    }
                                    if (pt.task.termino) {
                                        let eTime = new Date(pt.task.termino);
                                        if (pt.shift === 'NOCHE') {
                                            const hrs = eTime.getHours();
                                            if (hrs >= 0 && hrs < 7) {
                                                const eYear = eTime.getFullYear();
                                                const eMonth = String(eTime.getMonth() + 1).padStart(2, '0');
                                                const eDay = String(eTime.getDate()).padStart(2, '0');
                                                const eDateStr = `${eYear}-${eMonth}-${eDay}`;
                                                if (eDateStr === pt.logicalDate) {
                                                    eTime.setDate(eTime.getDate() + 1);
                                                }
                                            }
                                        }
                                        if (!shiftStats[groupKey].lastEnd || eTime > shiftStats[groupKey].lastEnd) {
                                            shiftStats[groupKey].lastEnd = eTime;
                                        }
                                    }
                                });

                                const sortedGroupRows = Object.values(shiftStats)
                                    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.turno.localeCompare(b.turno));

                                if (sortedGroupRows.length === 0) {
                                    window.__perfTotalPages = 0;
                                    window.__perfTotalRows = 0;
                                    return `<tr><td colspan="10" style="padding:3rem; text-align:center; color:rgba(0, 229, 255, 0.4); font-weight:700;">No hay datos de desempeño para mostrar en este periodo.</td></tr>`;
                                }

                                if (!window.__perfSetPage) window.__perfSetPage = (p) => { const _sy=window.scrollY; window.__perfPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
                                const _perfPage = window.__perfPage || 0;
                                const _perfTotalPages = Math.ceil(sortedGroupRows.length / 25);
                                window.__perfTotalPages = _perfTotalPages;
                                window.__perfTotalRows = sortedGroupRows.length;
                                const activePerfPage = _perfPage >= _perfTotalPages ? 0 : _perfPage;
                                window.__perfPage = activePerfPage;
                                const pagedPerfRows = sortedGroupRows.slice(activePerfPage * 25, (activePerfPage + 1) * 25);

                                return pagedPerfRows.map(row => {
                                    const startStr = row.firstStart ? row.firstStart.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    const endStr = row.lastEnd ? row.lastEnd.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true}) : '---';
                                    
                                    // 1. Duración Transcurrida (TRANSCURRIDO)
                                    let durationStr = '---';
                                    let breakOverlapMs = 0;
                                    let activeHours = 0;
                                    if (row.firstStart && row.lastEnd) {
                                        const totalMs = row.lastEnd - row.firstStart;
                                        if (totalMs > 0) {
                                            const totalMin = Math.round(totalMs / 60000);
                                            const hours = Math.floor(totalMin / 60);
                                            const mins = totalMin % 60;
                                            durationStr = `${hours}h ${mins}m`;
                                            
                                            breakOverlapMs = getBreakOverlapMs(row.firstStart, row.lastEnd);
                                            const activeMs = totalMs - breakOverlapMs;
                                            activeHours = activeMs / 3600000;
                                        }
                                    }

                                    // 2. QTY/HORA
                                    let qtyPerHourStr = '---';
                                    if (activeHours > 0.08) { // Mínimo 5 minutos para evitar anomalías
                                        const qtyPerHour = Math.round(row.totalQty / activeHours);
                                        qtyPerHourStr = qtyPerHour.toLocaleString();
                                    }

                                    const avgQty = row.taskCount > 0 ? Math.round(row.totalQty / row.taskCount) : 0;
                                    const displayDate = (() => {
                                        if (!row.fecha) return '---';
                                        const parts = row.fecha.split('-');
                                        if (parts.length !== 3) return row.fecha;
                                        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                        const monthIdx = parseInt(parts[1], 10) - 1;
                                        if (monthIdx >= 0 && monthIdx < 12) {
                                            return `${parts[2]}-${months[monthIdx]}`;
                                        }
                                        return `${parts[2]}/${parts[1]}`;
                                    })();
                                    return `
                                        <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                            <td style="padding:6px 4px; color:#ffffff; font-weight:700; width:70px; white-space:nowrap;">${displayDate}</td>
                                            <td style="padding:6px 4px; text-align:center; width:65px; white-space:nowrap;"><span style="background:${row.turno === 'NOCHE' ? 'rgba(0,229,255,0.2)' : 'rgba(234,179,8,0.2)'}; color:${row.turno === 'NOCHE' ? '#00E5FF' : '#fef08a'}; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:800;">${row.turno}</span></td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:800; color:#ffffff;">${row.operators.size}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#ffffff;">${row.totalQty.toLocaleString()}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:700; color:#00E5FF;">${row.taskCount}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#a1a1aa; font-size:0.75rem;">${startStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#a1a1aa; font-size:0.75rem;">${endStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#38bdf8; font-weight:700;">${durationStr}</td>
                                            <td style="padding:6px 8px; text-align:center; color:#22c55e; font-weight:800;">${qtyPerHourStr}</td>
                                            <td style="padding:6px 8px; text-align:center; font-weight:800; color:#eab308;">${avgQty.toLocaleString()}</td>
                                        </tr>
                                    `;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
                ${(() => {
                    const tp = window.__perfTotalPages || 1;
                    const cp = window.__perfPage || 0;
                    if (tp <= 1) return '';
                    const btnStyle = (active, dis) => `padding:4px 9px; border-radius:6px; border:1px solid ${active?'#00E5FF':'rgba(255,255,255,0.1)'}; background:${active?'rgba(0,229,255,0.25)':'rgba(255,255,255,0.03)'}; color:${dis?'rgba(255,255,255,0.2)':active?'#fff':'#00E5FF'}; cursor:${dis?'default':'pointer'}; font-size:0.7rem; font-weight:${active?900:500};`;
                    const pages = Array.from({length: tp}, (_, i) => i);
                    return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid rgba(0,229,255,0.1); margin-top:0.4rem;">
                        <button onclick="window.__perfSetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                        ${pages.map(p=>`<button onclick="window.__perfSetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                        <button onclick="window.__perfSetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                        <span style="font-size:0.7rem; color:rgba(0,229,255,0.4); margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__perfTotalRows || 0} registros)</span>
                    </div>`;
                })()}
            </div>"""
