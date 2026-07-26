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
marcas = """console.error("marcas not found");"""
operarios = """console.error("operarios not found");"""
